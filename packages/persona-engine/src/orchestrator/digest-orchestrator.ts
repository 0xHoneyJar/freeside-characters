import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneDigest, ZoneId, RawStats } from '../score/types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceMemoryPort } from '../ports/voice-memory.port.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { createVoiceMemoryLive } from '../live/voice-memory.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { getTracer } from '../observability/otel-layer.ts';
import { buildDimensionPulsePayload } from '../deliver/dimension-pulse-payload.ts';

export interface DigestPostResult {
  readonly zone: ZoneId;
  readonly postType: 'digest';
  readonly digest: ZoneDigest;
  readonly voice: string;
  readonly payload: DigestPayload;
}

export interface DigestOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
  readonly voiceMemory?: VoiceMemoryPort;
}

// Default pulse window · cycle-007 S8 r4 (operator pivot 2026-05-17):
// digests fire weekly · score-dashboard's WoW window. score-dashboard's
// FETCH_MIN_DAYS=14 floor (commit 80d715f) ensures 7d has a prior period
// to compare against.
const PULSE_WINDOW_DAYS = 7;

/**
 * composeDigestPost — voiceless dashboard-mirror digest (cycle-007 S8 r4).
 *
 * Operator pivot 2026-05-17: digests are NOT a voice moment. They surface the
 * score-dashboard per-dimension card layout faithfully · no LLM call · no
 * ruggy narrative · ruggy's character lives in micro/weaver/lore_drop/question/
 * callout posts (the conversational moments).
 *
 * Behavior:
 *   - Fetches raw PulseDimensionBreakdown from score-mcp (window=7d)
 *   - For per-dim zones: one embed with that dimension's card
 *   - For stonehenge (overall): 3 embeds in canonical [og, nft, onchain] order
 *   - No voice gen, no voice-memory read/write, no derived shape (the dashboard
 *     mirror doesn't need the cycle-006 derived shape · it consumes raw breakdowns
 *     and applies score-dashboard formatting rules directly)
 *
 * The `voice`/`augment`/`derived` ports remain in DigestOrchestratorDeps for
 * test injection compatibility but are not invoked. DigestPostResult.voice is
 * always empty string.
 */
export async function composeDigestPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: DigestOrchestratorDeps = {},
): Promise<DigestPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  // Resolve other deps even if unused · ensures shape parity with prior callers
  // that may inject mocks. voice/presentation/voiceMemory are constructed but
  // intentionally unused in the pulse path.
  void (deps.voice ?? createClaudeSdkLive(config, character));
  void (deps.presentation ?? presentation);
  void (deps.voiceMemory ?? createVoiceMemoryLive());

  const tracer = getTracer();
  const { generatedAt, breakdowns } = await score.fetchDimensionBreakdowns({
    zone,
    windowDays: PULSE_WINDOW_DAYS,
  });

  tracer.startActiveSpan('dimension_pulse.fetch', (span) => {
    try {
      span.setAttribute('zone', zone);
      span.setAttribute('window_days', PULSE_WINDOW_DAYS);
      span.setAttribute('breakdown_count', breakdowns.length);
    } finally {
      span.end();
    }
  });

  const payload = buildDimensionPulsePayload(breakdowns, {
    zone,
    windowDays: PULSE_WINDOW_DAYS,
    generatedAt,
  });

  // Synthesize a DigestSnapshot from the first breakdown (or aggregated for
  // overall) · keeps DigestPostResult.digest stable for downstream consumers
  // that inspect raw_stats / score / etc. (No domain change · just adapter.)
  const snapshot: DigestSnapshot = synthesizeSnapshot(zone, generatedAt, breakdowns);

  return {
    zone,
    postType: 'digest',
    digest: snapshotToZoneDigest(snapshot),
    voice: '',
    payload,
  };
}

function synthesizeSnapshot(
  zone: ZoneId,
  generatedAt: string,
  breakdowns: ReadonlyArray<import('../score/types.ts').PulseDimensionBreakdown>,
): DigestSnapshot {
  const totalEvents = breakdowns.reduce((s, b) => s + b.total_events, 0);
  const previousPeriodEvents = breakdowns.reduce((s, b) => s + b.previous_period_events, 0);
  const dimension = breakdowns.length === 1 ? breakdowns[0]!.id : 'overall';
  const displayName = breakdowns.length === 1 ? breakdowns[0]!.display_name : 'Overall';
  return {
    zone,
    dimension,
    displayName,
    windowDays: PULSE_WINDOW_DAYS,
    generatedAt,
    totalEvents,
    previousPeriodEvents,
    deltaPct:
      previousPeriodEvents === 0
        ? null
        : ((totalEvents - previousPeriodEvents) / previousPeriodEvents) * 100,
    deltaCount: totalEvents - previousPeriodEvents,
    activeWallets: 0, // not exposed in raw breakdown · derive-shape is not used in pulse path
    coldFactorCount: breakdowns.reduce((s, b) => s + b.inactive_factor_count, 0),
    totalFactorCount: breakdowns.reduce((s, b) => s + b.total_factor_count, 0),
    topFactors: breakdowns.flatMap((b) =>
      b.top_factors.map((f) => ({
        factorId: f.factor_id,
        displayName: f.display_name,
        primaryAction: f.primary_action,
        total: f.total,
        previous: f.previous,
        deltaPct: f.delta_pct,
        deltaCount: f.delta_count,
        ...(f.factor_stats ? { factorStats: f.factor_stats } : {}),
      })),
    ),
    coldFactors: breakdowns.flatMap((b) =>
      b.cold_factors.map((f) => ({
        factorId: f.factor_id,
        displayName: f.display_name,
        primaryAction: f.primary_action,
        total: f.total,
        previous: f.previous,
        deltaPct: f.delta_pct,
        deltaCount: f.delta_count,
        ...(f.factor_stats ? { factorStats: f.factor_stats } : {}),
      })),
    ),
  };
}

function snapshotToZoneDigest(snapshot: DigestSnapshot): ZoneDigest {
  const now = snapshot.generatedAt;
  return {
    zone: snapshot.zone,
    window: 'weekly',
    computed_at: now,
    window_start: now,
    window_end: now,
    stale: false,
    schema_version: 'digest-snapshot/1.0.0',
    narrative: null,
    narrative_error: null,
    raw_stats: snapshotToRawStats(snapshot),
  };
}

function snapshotToRawStats(snapshot: DigestSnapshot): RawStats {
  return {
    schema_version: '2.0.0',
    window_event_count: snapshot.totalEvents,
    window_wallet_count: snapshot.activeWallets ?? 0,
    top_event_count: snapshot.topFactors.reduce((sum, factor) => sum + factor.total, 0),
    top_wallet_count: snapshot.activeWallets ?? 0,
    top_movers: [],
    top_events: [],
    spotlight: null,
    rank_changes: {
      climbed: [],
      dropped: [],
      entered_top_tier: [],
      exited_top_tier: [],
    },
    factor_trends: snapshot.topFactors.map((factor) => ({
      factor_id: factor.factorId,
      current_count: factor.total,
      baseline_avg: factor.previous,
      multiplier: factor.previous > 0 ? factor.total / factor.previous : factor.total,
    })),
  };
}
