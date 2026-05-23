// cycle-008 S9 (g30) · attributable-signal diff — "what changed vs the prod baseline".
//
// RLHF signal is far richer when it's CAUSAL: not "I like B" but "I like B's specific
// change." The composition rubric (feel-iterate-signal-feedback) treats the annotation
// trail as part of the rubric; this gives the operator the delta to annotate against.
// Each candidate is diffed against v0-baseline (the byte-identical-to-prod reference), so
// every preference can be attributed to a concrete format/surface change.

import type { Candidate } from './render-candidate.ts';
import type { BillboardSurface } from './billboard-surface.ts';

export interface CandidateDiff {
  readonly variantId: string;
  readonly surfaceChanged: boolean;
  readonly baselineSurface: BillboardSurface;
  readonly surface: BillboardSurface;
  /** baseline billboard lines absent from this candidate (removed). */
  readonly removed: ReadonlyArray<string>;
  /** this candidate's billboard lines absent from baseline (added). */
  readonly added: ReadonlyArray<string>;
  /** lines present in both (unchanged). */
  readonly unchanged: ReadonlyArray<string>;
  /** true when this candidate IS the baseline (no change). */
  readonly isBaseline: boolean;
}

/** Diff a candidate's billboard against the baseline candidate's. Order-insensitive set diff
 *  over lines (billboards are short; a line-set diff reads clearly and is stable). */
export function diffAgainstBaseline(candidate: Candidate, baseline: Candidate): CandidateDiff {
  const base = baseline.billboardLines;
  const cand = candidate.billboardLines;
  const baseSet = new Set(base);
  const candSet = new Set(cand);
  return {
    variantId: candidate.variantId,
    surfaceChanged: candidate.surface !== baseline.surface,
    baselineSurface: baseline.surface,
    surface: candidate.surface,
    removed: base.filter((l) => !candSet.has(l)),
    added: cand.filter((l) => !baseSet.has(l)),
    unchanged: cand.filter((l) => baseSet.has(l)),
    isBaseline: candidate.variantId === baseline.variantId,
  };
}

/** Diff every candidate in a batch against the chosen baseline variant (default the first). */
export function diffBatch(
  candidates: ReadonlyArray<Candidate>,
  baselineId = 'v0-baseline',
): ReadonlyArray<CandidateDiff> {
  const baseline = candidates.find((c) => c.variantId === baselineId) ?? candidates[0];
  if (!baseline) return [];
  return candidates.map((c) => diffAgainstBaseline(c, baseline));
}
