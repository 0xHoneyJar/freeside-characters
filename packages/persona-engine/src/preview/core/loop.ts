// cycle-008 S9 (g30) · the CORE feedback loop — medium-blind.
//
// generate → present → capture → record → (breed). The orchestrator depends ONLY on the
// port (MediumAdapter); it never imports an adapter. Swapping Discord for terminal (or a
// future medium) is a one-line adapter change at the CLI edge — the loop is unchanged.
//
// present + capture are SEPARATE phases in wall-clock time (post now, operator reacts later,
// collect later), so they're exposed as distinct steps the CLI sequences; `runSyncStep` is
// the convenience path for adapters whose capture is synchronous (terminal).

import type { DigestSnapshot } from '../../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';
import type { BillboardVariant } from './billboard-variants.ts';
import { renderBatch, type RenderBatch } from './render-candidate.ts';
import {
  buildRatedRecord,
  appendPreferenceRecord,
  PREFERENCE_LOG_PATH,
  type PreferenceRecord,
} from './preference-log.ts';
import type { MediumAdapter, PresentedBatch, CapturedFeedback } from '../ports/medium-adapter.ts';

export interface GenerateInput {
  readonly snapshot: DigestSnapshot;
  readonly voice: VoiceAugment;
  readonly variants: ReadonlyArray<BillboardVariant>;
  readonly batchId?: string;
}

/** Phase 0 — generate N candidates for a fixed snapshot (medium-agnostic). */
export function generate(input: GenerateInput): RenderBatch {
  return renderBatch(input.snapshot, input.voice, input.variants, input.batchId);
}

/** Phase 1 — present candidates to the medium (post + attach affordances). */
export function present(adapter: MediumAdapter, batch: RenderBatch): Promise<PresentedBatch> {
  return adapter.present(batch);
}

/** Phase 2 — capture feedback from the medium and record it as a preference (rlhf-preference-v1). */
export async function captureAndRecord(
  adapter: MediumAdapter,
  batch: RenderBatch,
  presented: PresentedBatch,
  opts: { preferenceLogPath?: string } = {},
): Promise<{ feedback: CapturedFeedback; record: PreferenceRecord; recordPath: string }> {
  const feedback = await adapter.capture(presented);
  const record = buildRatedRecord({ batch, ratings: feedback.ratings });
  const recordPath = appendPreferenceRecord(record, opts.preferenceLogPath ?? PREFERENCE_LOG_PATH);
  return { feedback, record, recordPath };
}

/** Convenience — one synchronous turn (generate → present → capture → record). For adapters
 *  whose capture returns immediately (terminal). Discord uses the phased path (post, then
 *  collect later) since the operator reacts asynchronously. */
export async function runSyncStep(
  adapter: MediumAdapter,
  input: GenerateInput,
  opts: { preferenceLogPath?: string } = {},
): Promise<{ batch: RenderBatch; presented: PresentedBatch; record: PreferenceRecord; recordPath: string }> {
  const batch = generate(input);
  const presented = await present(adapter, batch);
  const { record, recordPath } = await captureAndRecord(adapter, batch, presented, opts);
  return { batch, presented, record, recordPath };
}
