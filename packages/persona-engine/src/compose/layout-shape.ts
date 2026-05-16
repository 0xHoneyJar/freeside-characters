/**
 * @deprecated cycle-006 S1 · use `domain/derive-shape.ts::deriveShape` instead.
 * This file remains alive ONLY because `compose/digest.ts::composeDigestForZone`
 * still imports it. S2 deletes `composeDigestForZone` (the sole non-test caller),
 * after which this file becomes orphaned and can be removed.
 *
 * The S0 calibration spike (10/10 MATCH, sprint-0-COMPLETED.md) validated that
 * `deriveShape` produces identical `shape` output for all 5 decision-tree
 * branches. The cycle-006 single-canonical-shape invariant (BB design-review
 * F-001 closure) is upheld by the fact that the orchestrator path (cycle-006's
 * only production path) now exclusively uses `deriveShape`.
 *
 * Layout shape selector (FR-4 · cycle-005 S3) — substrate-driven typography.
 *
 * Data chooses layout density:
 *   - A-all-quiet     → italicized stage direction + cross-dim tally (silence register)
 *   - B-one-dim-hot   → full card for the hot dim + tally for others
 *   - C-multi-dim-hot → full card per zone (optional weaver cross-zone post)
 *
 * The function is pure: it returns ONLY the shape literal. The renderer
 * (S5's digest path) reads the same inputs to decide whether to emit the
 * "C NO-CLAIM" variant (cards without prose seasoning + `prose_gate.
 * zone_data_no_voice` telemetry) — that detection lives in the renderer
 * because it knows the OTEL tracer, this module doesn't.
 *
 * Decision tree:
 *   claimed = count of zones where permittedClaims ≥ 1
 *   hotRank = count of zones where topRank ≥ 90
 *
 *   1. claimed ≥ 2                          → C-multi-dim-hot (standard)
 *   2. claimed === 1                        → B-one-dim-hot
 *   3. claimed === 0 AND hotRank ≥ 2        → C-multi-dim-hot (NO-CLAIM)
 *   4. claimed === 0 AND hotRank === 1      → A-all-quiet (single hot zone WITHOUT permission collapses to silence)
 *   5. claimed === 0 AND hotRank === 0      → A-all-quiet
 *
 * AC-S3.5 NO-CLAIM variant note: this function returns `'C-multi-dim-hot'`
 * for both standard and NO-CLAIM cases. The renderer distinguishes by
 * re-reading `permittedClaims` (variant: all-zero with ≥2 hot ranks).
 */

import type { ZoneId } from '../score/types.ts';

export type LayoutShape = 'A-all-quiet' | 'B-one-dim-hot' | 'C-multi-dim-hot';

export interface SelectLayoutShapeArgs {
  zones: readonly ZoneId[];
  permittedClaimsByZone: ReadonlyMap<ZoneId, number>;
  topRankByZone: ReadonlyMap<ZoneId, number | null>;
  /**
   * Currently unused by the decision tree (BB review F-004 · 2026-05-16).
   * Retained in the public signature for callers that already build it
   * (e.g. `composeDigestForZone`) AND to leave a hook for the PRD AC-S3.2
   * "all 4 zones empty + total events < 50" check if S3.2 is ever
   * promoted from renderer-level to selector-level. If still unused after
   * V1.5, drop the field.
   */
  totalEventsByZone?: ReadonlyMap<ZoneId, number>;
}

const RANK_HOT_THRESHOLD = 90;

export function selectLayoutShape(args: SelectLayoutShapeArgs): LayoutShape {
  let claimedCount = 0;
  let hotRankCount = 0;

  for (const zone of args.zones) {
    if ((args.permittedClaimsByZone.get(zone) ?? 0) >= 1) claimedCount += 1;
    const rank = args.topRankByZone.get(zone);
    if (rank !== null && rank !== undefined && rank >= RANK_HOT_THRESHOLD) {
      hotRankCount += 1;
    }
  }

  if (claimedCount >= 2) return 'C-multi-dim-hot';
  if (claimedCount === 1) return 'B-one-dim-hot';
  // claimedCount === 0 — possibly the NO-CLAIM variant of C
  if (hotRankCount >= 2) return 'C-multi-dim-hot';
  return 'A-all-quiet';
}

/**
 * Helper: does this combination of inputs constitute the C NO-CLAIM
 * variant? Used by the renderer to decide whether to suppress prose +
 * emit the `prose_gate.zone_data_no_voice` telemetry event.
 *
 * Lives in this module so the rule stays co-located with the shape
 * selector — but the renderer is the only caller (S5 wires).
 */
export function isNoClaimVariant(args: SelectLayoutShapeArgs): boolean {
  const shape = selectLayoutShape(args);
  if (shape !== 'C-multi-dim-hot') return false;
  for (const zone of args.zones) {
    if ((args.permittedClaimsByZone.get(zone) ?? 0) >= 1) return false;
  }
  return true;
}
