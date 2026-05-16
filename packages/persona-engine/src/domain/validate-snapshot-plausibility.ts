// cycle-006 S2 T2.5 · score-mcp snapshot plausibility check.
// Red Team AC-RT-008 + FLATLINE-SKP-002/HIGH + FLATLINE-SKP-003/HIGH closure.
//
// The cycle-006 architecture centralizes shape derivation through deriveShape,
// which amplifies score-mcp authority. A compromised score endpoint (Railway
// account takeover, leaked MCP_KEY, MITM, dependency confusion) could feed
// crafted snapshots that flip permittedFactors → false voice claims under
// Pattern B character identity.
//
// Defense: validate every snapshot against a rolling-window baseline (last 30
// accepted snapshots) before deriveShape consumes it. Rejected snapshots emit
// telemetry + log to a decision-log JSONL; orchestrator falls back to
// shape: A-all-quiet rather than crashing. No silent fallback.

import type { DigestSnapshot } from './digest-snapshot.ts';

export interface BaselineWindow {
  /** Per-zone accepted snapshots, newest last. Capped at WINDOW_SIZE. */
  readonly snapshots: ReadonlyArray<DigestSnapshot>;
}

export interface BaselineStats {
  readonly mean: number;
  readonly stddev: number;
  readonly sampleCount: number;
}

export const BASELINE_WINDOW_SIZE = 30;
export const SIGMA_THRESHOLD = 3;
/** Below this sample count the baseline is too thin to detect outliers reliably. */
export const MIN_SAMPLES_FOR_DETECTION = 5;

export type RejectionReason =
  | 'percentile-distribution-deviation'
  | 'unreliable-floor-violation'
  | 'event-count-outlier'
  | 'wallet-count-outlier';

export interface PlausibilityValidation {
  readonly ok: boolean;
  readonly reason?: RejectionReason;
  readonly computedSigma?: number;
  readonly threshold?: number;
  readonly baselineSampleCount: number;
  readonly insufficientBaseline?: boolean;
}

function computeStats(values: ReadonlyArray<number>): BaselineStats {
  if (values.length === 0) return { mean: 0, stddev: 0, sampleCount: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1);
  return { mean, stddev: Math.sqrt(variance), sampleCount: values.length };
}

/** Average `current_percentile_rank` across all top factors in a snapshot (skipping nulls). */
function avgPercentileRank(snapshot: DigestSnapshot): number | null {
  const ranks: number[] = [];
  for (const f of snapshot.topFactors) {
    const r = f.factorStats?.magnitude?.current_percentile_rank;
    if (r !== null && r !== undefined) ranks.push(r);
  }
  if (ranks.length === 0) return null;
  return ranks.reduce((a, b) => a + b, 0) / ranks.length;
}

/** Fraction of top factors with `p95.reliable === true`. */
function reliableFraction(snapshot: DigestSnapshot): number {
  if (snapshot.topFactors.length === 0) return 0;
  let reliable = 0;
  for (const f of snapshot.topFactors) {
    if (f.factorStats?.magnitude?.percentiles?.p95?.reliable === true) reliable += 1;
  }
  return reliable / snapshot.topFactors.length;
}

/**
 * Validate that a fresh snapshot is plausibly consistent with the rolling-window
 * baseline of recent accepted snapshots from the same zone.
 *
 * Returns `{ ok: true, baselineSampleCount }` when:
 *   - the baseline window has fewer than MIN_SAMPLES_FOR_DETECTION samples
 *     (too thin to detect outliers — fail-open to avoid blocking early operation
 *     of a new zone), OR
 *   - all checks pass within SIGMA_THRESHOLD.
 *
 * Returns `{ ok: false, reason, computedSigma, threshold, baselineSampleCount }`
 * when any check detects a > SIGMA_THRESHOLD deviation. The caller (orchestrator)
 * is responsible for fallback semantics + telemetry emission.
 */
export function validateSnapshotPlausibility(
  snapshot: DigestSnapshot,
  baseline: BaselineWindow,
): PlausibilityValidation {
  const sampleCount = baseline.snapshots.length;

  if (sampleCount < MIN_SAMPLES_FOR_DETECTION) {
    return { ok: true, baselineSampleCount: sampleCount, insufficientBaseline: true };
  }

  // 1. avg percentile-rank deviation
  const snapshotAvgRank = avgPercentileRank(snapshot);
  if (snapshotAvgRank !== null) {
    const baselineRanks = baseline.snapshots
      .map((s) => avgPercentileRank(s))
      .filter((r): r is number => r !== null);
    if (baselineRanks.length >= MIN_SAMPLES_FOR_DETECTION) {
      const stats = computeStats(baselineRanks);
      if (stats.stddev > 0) {
        const sigma = Math.abs(snapshotAvgRank - stats.mean) / stats.stddev;
        if (sigma > SIGMA_THRESHOLD) {
          return {
            ok: false,
            reason: 'percentile-distribution-deviation',
            computedSigma: sigma,
            threshold: SIGMA_THRESHOLD,
            baselineSampleCount: sampleCount,
          };
        }
      }
    }
  }

  // 2. reliable-fraction floor violation
  const snapshotReliable = reliableFraction(snapshot);
  const baselineReliable = baseline.snapshots.map((s) => reliableFraction(s));
  const reliableStats = computeStats(baselineReliable);
  if (reliableStats.stddev > 0) {
    const sigma = Math.abs(snapshotReliable - reliableStats.mean) / reliableStats.stddev;
    if (sigma > SIGMA_THRESHOLD && snapshotReliable > reliableStats.mean) {
      // Only flag when the snapshot is MORE reliable than the baseline — a
      // sudden spike in `p95.reliable: true` is the attacker pattern (licensing
      // factors that historically were unreliable).
      return {
        ok: false,
        reason: 'unreliable-floor-violation',
        computedSigma: sigma,
        threshold: SIGMA_THRESHOLD,
        baselineSampleCount: sampleCount,
      };
    }
  }

  // 3. totalEvents outlier
  const eventStats = computeStats(baseline.snapshots.map((s) => s.totalEvents));
  if (eventStats.stddev > 0) {
    const sigma = Math.abs(snapshot.totalEvents - eventStats.mean) / eventStats.stddev;
    if (sigma > SIGMA_THRESHOLD) {
      return {
        ok: false,
        reason: 'event-count-outlier',
        computedSigma: sigma,
        threshold: SIGMA_THRESHOLD,
        baselineSampleCount: sampleCount,
      };
    }
  }

  return { ok: true, baselineSampleCount: sampleCount };
}
