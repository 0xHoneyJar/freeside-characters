import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneDigest, ZoneId, RawStats } from '../score/types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort, VoiceGenContext } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceMemoryPort } from '../ports/voice-memory.port.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { createVoiceMemoryLive } from '../live/voice-memory.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { toDigestPayload } from '../live/discord-webhook.live.ts';
import { deriveShape } from '../domain/derive-shape.ts';
import { formatPriorWeekHint } from './format-prior-week-hint.ts';
import { sanitizeMemoryText } from '../domain/voice-memory-sanitize.ts';
import { keyForDigest } from '../domain/voice-memory-keys.ts';
import {
  VOICE_MEMORY_SCHEMA_VERSION,
  type VoiceMemoryEntry,
} from '../domain/voice-memory-entry.ts';

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

const TTL_DAYS = 90;

export async function composeDigestPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: DigestOrchestratorDeps = {},
): Promise<DigestPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  const voiceGen = deps.voice ?? createClaudeSdkLive(config, character);
  const renderer = deps.presentation ?? presentation;
  const voiceMemory = deps.voiceMemory ?? createVoiceMemoryLive();

  const snapshot = await score.fetchDigestSnapshot(zone);

  // cycle-006 S1 T1.6 · canonical shape derivation upstream of voice-gen.
  const derived = deriveShape({ snapshot, crossZone: [snapshot] });

  // cycle-006 S6 T6.7 · voice-memory read-before-voice-gen.
  // Fail-safe: any read failure → empty prior hint, never blocks the post.
  const streamKey = keyForDigest(zone);
  let priorWeekHint = '';
  try {
    const prior = await voiceMemory.readRecent('digest', streamKey, 1);
    if (prior.length > 0) {
      priorWeekHint = formatPriorWeekHint({
        entry: { header: prior[0]!.header, outro: prior[0]!.outro },
        stream: 'digest',
        key: streamKey,
      });
    }
  } catch {
    // swallow — voice-memory is non-critical for post delivery
  }

  const ctx: VoiceGenContext = { derived, priorWeekHint };
  const augment: VoiceAugment | undefined = config.VOICE_DISABLED
    ? undefined
    : await voiceGen.generateDigestVoice(snapshot, ctx);

  const message = renderer.renderDigest(snapshot, augment);
  const payload = toDigestPayload(message);

  // cycle-006 S6 T6.7 · voice-memory write-after-voice-gen with sanitization.
  if (augment && augment.header) {
    const now = new Date();
    const expiry = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);
    const entry: VoiceMemoryEntry = {
      schema_version: VOICE_MEMORY_SCHEMA_VERSION,
      at: now.toISOString(),
      stream: 'digest',
      zone,
      key: streamKey,
      header: sanitizeMemoryText(augment.header).slice(0, 280),
      outro: sanitizeMemoryText(augment.outro ?? '').slice(0, 280),
      key_numbers: {
        total_events: snapshot.totalEvents,
        previous_period_events: snapshot.previousPeriodEvents,
        permitted_factor_names: derived.permittedFactors.map((f) => f.displayName),
      },
      use_label: 'background_only',
      expiry: expiry.toISOString(),
      signed_by: `agent:${character.id ?? 'claude'}`,
    };
    try {
      await voiceMemory.appendEntry('digest', entry);
    } catch {
      // swallow — write failure should never block delivery (SDD §6.1)
    }
  }

  return {
    zone,
    postType: 'digest',
    digest: snapshotToZoneDigest(snapshot),
    voice: augment ? [augment.header, augment.outro].filter(Boolean).join('\n') : '',
    payload,
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
