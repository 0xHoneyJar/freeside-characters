import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { DerivedShape } from '../domain/derive-shape.ts';
import type { CronPostType, EventTrigger } from '../compose/post-types.ts';

/**
 * cycle-006 S1 T1.6 · voice-gen port now accepts `ctx` carrying the derived
 * shape + optional prior-week hint. The port no longer derives shape itself
 * (that was the BB review F-006 anti-pattern in cycle-005). Callers
 * (orchestrators) compute `DerivedShape` via `deriveShape()` and pass it in.
 */
export interface VoiceGenContext {
  readonly derived: DerivedShape;
  /**
   * Pre-formatted prior-week hint (already wrapped in <untrusted-content>
   * markers + HTML-escaped via `formatPriorWeekHint`). Empty string or
   * undefined when no prior memory exists for this stream/key.
   */
  readonly priorWeekHint?: string;
  /**
   * cycle-008 T3.3 · the cron post type this voice is for (micro/lore_drop/
   * question/weaver/callout). Selects the persona.md fragment in the canonical
   * (buildPrompt) path. Defaults to 'micro' when absent. Ignored by the legacy
   * (buildVoiceBrief) path. CronPostType (excludes 'reply' — chat goes through
   * compose/reply.ts, never this port).
   */
  readonly postType?: CronPostType;
  /**
   * cycle-008 slice 2b · for event-driven pop-ins, the live moment that triggered the fire (canon
   * event class + kansei axis). Surfaced as RUNTIME context in the prompt so the voice leans into
   * the actual event — NEUTRAL semantic signal, never numbers. Absent for scheduled/non-event posts.
   */
  readonly eventTrigger?: EventTrigger;
}

export interface VoiceGenPort {
  readonly generateDigestVoice: (snapshot: DigestSnapshot, ctx: VoiceGenContext) => Promise<VoiceAugment>;
}
