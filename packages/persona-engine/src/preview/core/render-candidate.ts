// cycle-008 S9 (g30) · FR-40 generate-N + FR-41 compare — the candidate fan-out.
//
// REUSE INVARIANT (T9.1 AC-b · T9.5 AC-d fidelity-parity): a candidate is built by
// running the variant's billboard facts through the EXACT production payload mapper
// (`presentation.toMicroPayload` === `live/discord-webhook.live.ts::plainToPayload`),
// the same two-beat delivery the cron path uses. For `v0-baseline` the result is
// byte-identical to what prod would ship for the same snapshot+voice — that identity
// is asserted in render-candidate.test.ts. The preview NEVER re-implements delivery.

import type { DigestSnapshot } from '../../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';
import type { DigestPayload } from '../../deliver/embed.ts';
import type { MicroMessage } from '../../domain/post-messages.ts';
import { presentation } from '../../live/discord-render.live.ts';
import { safeResolveZoneDisplayName } from '../../domain/zone-registry.ts';
import type { BillboardVariant } from './billboard-variants.ts';
import { type BillboardSurface, toCodeBlock, toAnsiBlock } from './billboard-surface.ts';

export interface Candidate {
  readonly variantId: string;
  readonly variantLabel: string;
  readonly variantNote: string;
  /** The Discord delivery surface of the data beat (bold-text / code-block / ansi). */
  readonly surface: BillboardSurface;
  /** Beat 1 — the agent voice (payload.content), zero numbers (stats-out-of-voice). */
  readonly voiceContent: string;
  /** Beat 2 — the data billboard, exactly as Discord receives it (bold lines, ``` block, or ```ansi). */
  readonly billboard: string;
  /** The raw billboard lines (truthFields) before surface formatting — for the eval fixture. */
  readonly billboardLines: ReadonlyArray<string>;
  /** The exact two-beat payload prod would deliver for this candidate. */
  readonly payload: DigestPayload;
  /** Components-V2 surface override — when set, the Discord adapter posts these components
   *  verbatim (used by the post-type gallery so each layout rides the same rate/collect loop). */
  readonly componentsV2Override?: ReadonlyArray<unknown>;
}

export interface RenderBatch {
  readonly batchId: string;
  readonly zone: string;
  readonly zoneDisplay: string;
  readonly snapshot: DigestSnapshot;
  readonly voice: VoiceAugment;
  readonly candidates: ReadonlyArray<Candidate>;
}

/** Build ONE candidate by routing `variant.buildFacts` through the prod render path. */
export function renderCandidate(
  snapshot: DigestSnapshot,
  voice: VoiceAugment,
  variant: BillboardVariant,
): Candidate {
  const surface: BillboardSurface = variant.surface ?? 'bold-text';
  // beat 1 (voice) always comes from the prod renderMicro so it matches prod exactly.
  const voiceContent = presentation.renderMicro(snapshot, voice).voiceContent;
  const lines = variant.buildFacts(snapshot);

  if (surface === 'code-block' || surface === 'ansi') {
    // monospace text tier — Discord code block (plain or ANSI-colored).
    const billboard = surface === 'ansi' ? toAnsiBlock(lines) : toCodeBlock(lines);
    const payload: DigestPayload = { content: voiceContent, embeds: [], secondary: { content: billboard, embeds: [] } };
    return {
      variantId: variant.id,
      variantLabel: variant.label,
      variantNote: variant.note,
      surface,
      voiceContent,
      billboard,
      billboardLines: lines,
      payload,
    };
  }

  // bold-text (v0 byte-identical to prod) + rich tiers (embed / components-v2 / canvas).
  // The rich tiers carry a bold-text payload as the TERMINAL fallback; the Discord adapter
  // re-renders them natively (rich-render.ts) using the snapshot at present time.
  {
    const message: MicroMessage = { voiceContent, truthFields: lines };
    const payload = presentation.toMicroPayload(message);
    return {
      variantId: variant.id,
      variantLabel: variant.label,
      variantNote: variant.note,
      surface,
      voiceContent: payload.content,
      billboard: payload.secondary?.content ?? payload.content,
      billboardLines: lines,
      payload,
    };
  }
}

/**
 * Generate-N: fan out the SAME snapshot+voice over N variants in one action (FR-40).
 * `batchId` groups the candidates (T9.2 AC-b) — pass one for determinism (tests),
 * else a fresh `rlhf-<YYYYMMDD>-<6hex>` id is minted.
 */
export function renderBatch(
  snapshot: DigestSnapshot,
  voice: VoiceAugment,
  variants: ReadonlyArray<BillboardVariant>,
  batchId?: string,
): RenderBatch {
  return {
    batchId: batchId ?? mintBatchId(),
    zone: snapshot.zone,
    zoneDisplay: safeResolveZoneDisplayName(snapshot.zone, 'rlhf-preview'),
    snapshot,
    voice,
    candidates: variants.map((variant) => renderCandidate(snapshot, voice, variant)),
  };
}

function mintBatchId(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(16).slice(2, 8).padEnd(6, '0');
  return `rlhf-${day}-${rand}`;
}
