import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { DerivedShape } from '../domain/derive-shape.ts';

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
}

export interface VoiceGenPort {
  readonly generateDigestVoice: (snapshot: DigestSnapshot, ctx: VoiceGenContext) => Promise<VoiceAugment>;
}
