import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneDigest, ZoneId, RawStats } from '../score/index.ts';
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
import { fetchZoneDigest } from '../score/client.ts';
import { buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2, prettyFactorName } from '../deliver/enriched-render.ts';
import { ZONE_REGISTRY } from '../domain/zone-registry.ts';
import { resolveWallet, type ResolvedWallet } from './freeside_auth/server.ts';

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
  /** cycle-008 S9 · enriched-v2 path · full ZoneDigest fetch (defaults to the score client). */
  readonly fetchZoneDigest?: (config: Config, zone: ZoneId) => Promise<ZoneDigest>;
  /**
   * cycle-008 capability-wiring slice 1 · enriched-v2 spotlight identity (handle + pfp).
   * Defaults to the in-process freeside_auth resolver (`resolveWallet`). `handle` is a display
   * string already through the NFR-29 ladder — never a raw or truncated wallet.
   */
  readonly resolveSpotlightIdentity?: (wallet: string) => Promise<SpotlightIdentity>;
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
  // cycle-008 S9 · enriched-v2 surface (DIGEST_SURFACE flag, default 'pulse').
  // The RLHF-validated Components V2 billboard, fed by the full ZoneDigest (real
  // raw_stats: spotlight, wallets, factor movers). Gated → canary → flip.
  if (config.DIGEST_SURFACE === 'enriched-v2') {
    return composeEnrichedDigestPost(config, zone, deps);
  }

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

/**
 * composeEnrichedDigestPost — the cycle-008 S9 RLHF-validated enriched digest (Components V2).
 *
 * Fed by the FULL ZoneDigest (`get_zone_digest` → real raw_stats: spotlight, window_wallet_count,
 * factor movers) rather than the dimension-pulse breakdown. Two real-data hookups the operator
 * asked to wire before flipping:
 *   - factor display names — `raw_stats.factor_trends` carries only factor_id, so a name catalog
 *     is built from `get_dimension_breakdown` (its top/cold factors carry display_name).
 *   - spotlight identity — the wallet is resolved IN-PROCESS via freeside_auth's resolve_wallet
 *     (NFR-29: NEVER a raw 0x… in prose; ladder display_name → discord → mibera_id → ANON_MEMBER).
 *     The NFT pfp (when an https image is on file) renders as the spotlight Section's Thumbnail.
 *
 * Voiceless, like the pulse digest — the container IS the billboard, no two-beat.
 */
async function composeEnrichedDigestPost(
  config: Config,
  zone: ZoneId,
  deps: DigestOrchestratorDeps,
): Promise<DigestPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  const fetchZd = deps.fetchZoneDigest ?? fetchZoneDigest;
  const resolveIdentityFn = deps.resolveSpotlightIdentity ?? resolveSpotlightIdentity;

  const zd = await fetchZd(config, zone);

  // factor display-name catalog (factor_trends → factor_id only; names live on the breakdown).
  const nameMap = new Map<string, string>();
  try {
    const { breakdowns } = await score.fetchDimensionBreakdowns({ zone, windowDays: PULSE_WINDOW_DAYS });
    for (const b of breakdowns) {
      for (const f of [...b.top_factors, ...b.cold_factors]) nameMap.set(f.factor_id, f.display_name);
    }
  } catch {
    // names fall back to prettify — never fail the digest on the name-catalog hop.
  }

  // spotlight identity (NFR-29 · resolve before any 0x… reaches prose; ANON_MEMBER on miss).
  // handle is ladder-resolved (display_name → discord → mibera_id → "an anonymous mibera");
  // pfp_url, when an https NFT image is on file, renders as the Section's Thumbnail accessory.
  const sp = zd.raw_stats.spotlight;
  const identity = sp ? await resolveIdentityFn(sp.wallet) : undefined;

  const components = buildEnrichedDigestComponentsV2(zd, {
    resolveFactorName: (id) => nameMap.get(id) ?? prettyFactorName(id),
    ...(sp && identity
      ? { resolveHandle: () => identity.handle, resolvePfp: () => identity.pfp_url }
      : {}),
  });

  const flavor = ZONE_REGISTRY[zone];
  const payload: DigestPayload = {
    // content is the Discord-as-Material fallback label; Discord renders `components` under the flag.
    content: `${flavor.emoji} ${flavor.displayName}`,
    embeds: [],
    flags: IS_COMPONENTS_V2,
    components,
  };

  return { zone, postType: 'digest', digest: zd, voice: '', payload };
}

// The THJ community's member noun (operator: "each community has a name for their members and we
// call them Miberas"). The spotlight fallback when no identity resolves — never "an anonymous keeper".
// Repo-scoped to the mibera world; lift to CharacterConfig if a non-mibera community digest lands here.
const ANON_MEMBER = 'an anonymous mibera';

/** Resolved spotlight identity — display string (ladder-applied) + optional NFT/pfp thumbnail url. */
export interface SpotlightIdentity {
  /** Display string already through the NFR-29 ladder — NEVER a raw or truncated wallet. */
  readonly handle: string;
  /** https NFT/pfp image url for the Section Thumbnail accessory, or null when none. */
  readonly pfp_url: string | null;
}

/** Only https image urls reach the Discord thumbnail (drops null / non-https / malformed). */
export function httpsImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * NFR-29 spotlight fallback ladder: display_name → discord_username → mibera_id → ANON_MEMBER.
 * The truncated 0x `.fallback` is NEVER surfaced — a shortened wallet is still a leaked wallet.
 */
export function pickSpotlightDisplay(r: ResolvedWallet): SpotlightIdentity {
  return {
    handle: r.handle ?? r.discord_username ?? r.mibera_id ?? ANON_MEMBER,
    pfp_url: httpsImageUrl(r.pfp_url),
  };
}

/**
 * Default spotlight resolver — IN-PROCESS (cycle-008 capability-wiring slice 1). Calls
 * freeside_auth's `resolve_wallet` directly: no HTTP hop. The in-bot auth is an SDK MCP (not an
 * endpoint), and the federated `auth` tenant is a V2 arc (decision #2) — the prior HTTP default
 * read `display_handle`/`discord_handle`, fields freeside_auth never emits, so it leaked nothing
 * but always fell back. resolve_wallet itself never throws (internal fallback); the try/catch is
 * belt-and-suspenders for NFR-29. One call per weekly digest, so freeside_auth's 5-min cache covers it.
 */
// resolveWallet hits Postgres on a cache-miss: pool.connect (already bounded — the pool sets
// connectionTimeoutMillis:5000 · server.ts:84) + midi_profiles queries (UNBOUNDED — no
// statement_timeout). It runs inside the digest cron's per-zone lock, so a stalled QUERY would wedge
// that zone's whole posting pipeline (the scheduler skips a zone while zoneLocks.has(zone)). This race
// bounds the TOTAL at 5s — its real job is the unbounded query phase (connect is already capped).
// Honest caveat (FAGAN composer+gpt): Promise.race ABANDONS, it does not cancel — a timed-out
// resolveWallet keeps running, then releases its client in its own finally (server.ts:238). No
// accumulation, because connect is pool-bounded, so an abandoned op resolves/rejects within ~5s, not
// forever. (opus-skeptic raised the bound · composer+gpt caught the abandons-not-cancels overclaim ·
// the pool's connectionTimeoutMillis closes the residual.) 2026-05-23.
const SPOTLIGHT_RESOLVE_TIMEOUT_MS = 5_000;

async function resolveSpotlightIdentity(wallet: string): Promise<SpotlightIdentity> {
  const anon: SpotlightIdentity = { handle: ANON_MEMBER, pfp_url: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resolved = await Promise.race([
      resolveWallet(wallet),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('resolve_wallet timeout')),
          SPOTLIGHT_RESOLVE_TIMEOUT_MS,
        );
      }),
    ]);
    return pickSpotlightDisplay(resolved);
  } catch {
    return anon; // NFR-29: never a raw 0x… reaches prose, even on timeout
  } finally {
    if (timer) clearTimeout(timer);
  }
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
