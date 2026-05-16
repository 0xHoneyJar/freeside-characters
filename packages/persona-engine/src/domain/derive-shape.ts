// cycle-006 S1 · canonical shape derivation (SDD §3.2 · closes BB design-review F-001).
// Single source of truth for (shape, permittedFactors, silencedFactors). The legacy
// `compose/layout-shape.ts::selectLayoutShape` is reduced to a thin re-export of
// `deriveShape({...}).shape` for backwards-compat during S1 transition.
//
// S0 calibration spike (10/10 MATCH) validated equivalence with selectLayoutShape
// across all 5 decision-tree branches. See sprint-0-COMPLETED.md for pinning decisions.

import type { FactorStats } from '../score/types.ts';
import type { DigestSnapshot, DigestFactorSnapshot } from './digest-snapshot.ts';
import type { ProseGateValidation, ProseGateViolation } from '../deliver/prose-gate.ts';

export type LayoutShape = 'A-all-quiet' | 'B-one-dim-hot' | 'C-multi-dim-hot';

export interface PermittedFactor {
  readonly displayName: string;
  readonly stats: FactorStats;
}

export interface SilencedFactor {
  readonly displayName: string;
  readonly reason: ProseGateViolation['reason'];
}

export interface DerivedShape {
  readonly shape: LayoutShape;
  readonly isNoClaimVariant: boolean;
  readonly permittedFactors: ReadonlyArray<PermittedFactor>;
  readonly silencedFactors: ReadonlyArray<SilencedFactor>;
  /** Diagnostic: count of zones with ≥1 permitted claim. */
  readonly claimedZoneCount: number;
  /** Diagnostic: count of zones with top-factor rank ≥ 90. */
  readonly hotRankZoneCount: number;
}

export interface DeriveShapeInput {
  readonly snapshot: DigestSnapshot;
  /**
   * REQUIRED multi-zone context for shape C resolution (BB design-review F-006
   * closure · Flatline SKP-001/860). Single-zone callers must pass
   * `crossZone: [snapshot]` explicitly. Making this required prevents the
   * silent-divergence path where single-zone deriveShape can never return
   * `C-multi-dim-hot`.
   */
  readonly crossZone: ReadonlyArray<DigestSnapshot>;
  /** Optional pre-computed prose-gate output (when orchestrator already ran it). */
  readonly proseGate?: ProseGateValidation;
}

const RANK_HOT_THRESHOLD = 90;

function isFactorPermitted(factor: DigestFactorSnapshot): boolean {
  const stats = factor.factorStats;
  if (!stats) return false;
  const rank = stats.magnitude?.current_percentile_rank;
  const p95Reliable = stats.magnitude?.percentiles?.p95?.reliable;
  return rank !== null && rank !== undefined && rank >= RANK_HOT_THRESHOLD && p95Reliable === true;
}

function topRankOfSnapshot(snapshot: DigestSnapshot): number | null {
  let best: number | null = null;
  for (const factor of snapshot.topFactors) {
    const rank = factor.factorStats?.magnitude?.current_percentile_rank;
    if (rank === null || rank === undefined) continue;
    if (best === null || rank > best) best = rank;
  }
  return best;
}

function permittedFactorsOfSnapshot(snapshot: DigestSnapshot): ReadonlyArray<PermittedFactor> {
  const out: PermittedFactor[] = [];
  for (const factor of snapshot.topFactors) {
    if (isFactorPermitted(factor) && factor.factorStats) {
      out.push({ displayName: factor.displayName, stats: factor.factorStats });
    }
  }
  return out;
}

function silencedFactorsOfSnapshot(
  snapshot: DigestSnapshot,
  proseGate: ProseGateValidation | undefined,
): ReadonlyArray<SilencedFactor> {
  if (!proseGate) return [];
  const out: SilencedFactor[] = [];
  const factorNames = new Set(snapshot.topFactors.map((f) => f.displayName));
  for (const violation of proseGate.violations) {
    for (const proximityName of violation.proximity_factors) {
      if (factorNames.has(proximityName)) {
        out.push({ displayName: proximityName, reason: violation.reason });
      }
    }
  }
  return out;
}

export function deriveShape(input: DeriveShapeInput): DerivedShape {
  const permittedFactors = permittedFactorsOfSnapshot(input.snapshot);
  const silencedFactors = silencedFactorsOfSnapshot(input.snapshot, input.proseGate);

  // Cross-zone shape resolution. Uses permittedFactors-count (not raw topFactors)
  // as the "claimed" signal — the rank+reliability gate is the licensing boundary.
  let claimedZoneCount = 0;
  let hotRankZoneCount = 0;
  for (const zoneSnapshot of input.crossZone) {
    if (permittedFactorsOfSnapshot(zoneSnapshot).length > 0) claimedZoneCount += 1;
    const topRank = topRankOfSnapshot(zoneSnapshot);
    if (topRank !== null && topRank >= RANK_HOT_THRESHOLD) hotRankZoneCount += 1;
  }

  let shape: LayoutShape;
  if (claimedZoneCount >= 2) shape = 'C-multi-dim-hot';
  else if (claimedZoneCount === 1) shape = 'B-one-dim-hot';
  else if (hotRankZoneCount >= 2) shape = 'C-multi-dim-hot';
  else shape = 'A-all-quiet';

  const isNoClaimVariant = shape === 'C-multi-dim-hot' && claimedZoneCount === 0;

  return { shape, isNoClaimVariant, permittedFactors, silencedFactors, claimedZoneCount, hotRankZoneCount };
}
