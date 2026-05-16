// cycle-006 S2 T2.5 tests · validateSnapshotPlausibility.
// Red Team AC-RT-008 + FLATLINE-SKP-002/HIGH (no-silent-fallback) +
// FLATLINE-SKP-003/HIGH (rolling-window-not-static).

import { describe, test, expect } from 'bun:test';
import {
  validateSnapshotPlausibility,
  BASELINE_WINDOW_SIZE,
  MIN_SAMPLES_FOR_DETECTION,
  SIGMA_THRESHOLD,
  type BaselineWindow,
} from './validate-snapshot-plausibility.ts';
import type { DigestSnapshot, DigestFactorSnapshot } from './digest-snapshot.ts';
import type { FactorStats } from '../score/types.ts';

function statsOf(rank: number, reliable: boolean): FactorStats {
  return {
    history: { active_days: 30, last_active_date: '2026-05-15', stale: false, no_data: false },
    magnitude: {
      event_count: 100,
      percentiles: {
        p50: { value: 50, reliable: true },
        p75: { value: 70, reliable: true },
        p90: { value: 85, reliable: true },
        p95: { value: 95, reliable },
        p99: { value: 99, reliable },
      },
      current_percentile_rank: rank,
    },
    cohort: {
      unique_actors: 5,
      percentiles: {
        p50: { value: 3, reliable: true },
        p75: { value: 4, reliable: true },
        p90: { value: 5, reliable: true },
        p95: { value: 6, reliable },
        p99: { value: 8, reliable },
      },
      current_percentile_rank: rank,
    },
  } as unknown as FactorStats;
}

function snapshotOf(
  totalEvents: number,
  factors: Array<{ rank: number; reliable: boolean }>,
): DigestSnapshot {
  const top: DigestFactorSnapshot[] = factors.map((f, i) => ({
    factorId: `f${i}`,
    displayName: `factor${i}`,
    primaryAction: 'minted',
    total: 10,
    previous: 5,
    deltaPct: 100,
    deltaCount: 5,
    factorStats: statsOf(f.rank, f.reliable),
  }));
  return {
    zone: 'stonehenge',
    dimension: 'overall',
    displayName: 'stonehenge',
    windowDays: 30,
    generatedAt: '2026-05-15T00:00:00Z',
    totalEvents,
    previousPeriodEvents: 50,
    deltaPct: 100,
    deltaCount: totalEvents - 50,
    coldFactorCount: 0,
    totalFactorCount: top.length,
    topFactors: top,
    coldFactors: [],
  };
}

const NOMINAL_FACTORS = [
  { rank: 50, reliable: true },
  { rank: 55, reliable: true },
  { rank: 45, reliable: false },
  { rank: 60, reliable: false },
  { rank: 40, reliable: false },
];

/**
 * Produce a baseline with realistic variance — each snapshot has slightly
 * different ranks + one varying reliability flag — so stddev > 0 across the
 * window. Real production baselines look like this; identical fixtures would
 * artificially short-circuit the validator.
 */
function nominalBaseline(size: number): BaselineWindow {
  return {
    snapshots: Array.from({ length: size }, (_, i) => {
      const drift = i % 5;
      const factors = NOMINAL_FACTORS.map((f, j) => ({
        rank: Math.max(0, Math.min(100, f.rank + drift - 2 + j)),
        // Cycle factor[4]'s reliability EVERY 5 SNAPSHOTS so reliable-fraction
        // varies modestly (mean ~0.42, narrow stddev). An attack spike to 1.0
        // is a clear > 3σ outlier.
        reliable: j === 4 ? i % 5 === 0 : f.reliable,
      }));
      return snapshotOf(100 + i, factors);
    }),
  };
}

describe('validateSnapshotPlausibility · baseline thinness fail-open', () => {
  test('returns ok when baseline has 0 samples', () => {
    const result = validateSnapshotPlausibility(snapshotOf(999, NOMINAL_FACTORS), { snapshots: [] });
    expect(result.ok).toBe(true);
    expect(result.insufficientBaseline).toBe(true);
    expect(result.baselineSampleCount).toBe(0);
  });

  test('returns ok when baseline has < MIN_SAMPLES_FOR_DETECTION samples', () => {
    const baseline = nominalBaseline(MIN_SAMPLES_FOR_DETECTION - 1);
    const result = validateSnapshotPlausibility(snapshotOf(99999, NOMINAL_FACTORS), baseline);
    expect(result.ok).toBe(true);
    expect(result.insufficientBaseline).toBe(true);
  });
});

describe('validateSnapshotPlausibility · nominal snapshots pass (AC-RT-008 no false-positives)', () => {
  test('snapshot near baseline mean passes with full window', () => {
    const result = validateSnapshotPlausibility(
      snapshotOf(105, NOMINAL_FACTORS),
      nominalBaseline(BASELINE_WINDOW_SIZE),
    );
    expect(result.ok).toBe(true);
    expect(result.baselineSampleCount).toBe(BASELINE_WINDOW_SIZE);
  });

  test('snapshot at edge but within 3σ passes', () => {
    const baseline = nominalBaseline(20);
    // totalEvents=120 is within 3σ of baseline range [100,119]
    const result = validateSnapshotPlausibility(snapshotOf(120, NOMINAL_FACTORS), baseline);
    expect(result.ok).toBe(true);
  });
});

describe('validateSnapshotPlausibility · attack scenarios reject (AC-RT-008 detection)', () => {
  test('attack: percentile distribution jumps from ~50 to ~95 (rank-license attack)', () => {
    const ATTACK_FACTORS = [
      { rank: 99, reliable: true },
      { rank: 98, reliable: true },
      { rank: 97, reliable: true },
      { rank: 96, reliable: true },
      { rank: 95, reliable: true },
    ];
    const result = validateSnapshotPlausibility(
      snapshotOf(105, ATTACK_FACTORS),
      nominalBaseline(BASELINE_WINDOW_SIZE),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('percentile-distribution-deviation');
    expect(result.computedSigma).toBeGreaterThan(SIGMA_THRESHOLD);
  });

  test('attack: reliable-fraction spike (factor-licensing attack)', () => {
    const ATTACK_FACTORS = [
      { rank: 50, reliable: true },
      { rank: 55, reliable: true },
      { rank: 45, reliable: true },
      { rank: 60, reliable: true },
      { rank: 40, reliable: true },
    ];
    const result = validateSnapshotPlausibility(
      snapshotOf(105, ATTACK_FACTORS),
      nominalBaseline(BASELINE_WINDOW_SIZE),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unreliable-floor-violation');
    expect(result.computedSigma).toBeGreaterThan(SIGMA_THRESHOLD);
  });

  test('attack: event-count blow-up (volume injection)', () => {
    const result = validateSnapshotPlausibility(
      snapshotOf(50000, NOMINAL_FACTORS),
      nominalBaseline(BASELINE_WINDOW_SIZE),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('event-count-outlier');
    expect(result.computedSigma).toBeGreaterThan(SIGMA_THRESHOLD);
  });
});

describe('validateSnapshotPlausibility · rolling-window survives organic growth (FLATLINE-SKP-003)', () => {
  test('60-week +10%/week growth produces zero false-positives when baseline rolls', () => {
    let baseline: BaselineWindow = { snapshots: [] };
    let falsePositives = 0;
    let totalEvents = 100;
    for (let week = 0; week < 60; week++) {
      const snapshot = snapshotOf(Math.round(totalEvents), NOMINAL_FACTORS);
      const result = validateSnapshotPlausibility(snapshot, baseline);
      if (!result.ok) falsePositives += 1;
      // Rolling window: append, cap at WINDOW_SIZE.
      const next = baseline.snapshots.concat(snapshot);
      baseline = {
        snapshots: next.length > BASELINE_WINDOW_SIZE ? next.slice(-BASELINE_WINDOW_SIZE) : next,
      };
      totalEvents *= 1.1;
    }
    expect(falsePositives).toBe(0);
  });

  test('STATIC baseline (no rolling) WOULD produce false-positives — sanity check that motivates SKP-003', () => {
    // This test exists to make the SKP-003 closure visible. A static baseline
    // at week 0 (totalEvents=100) cannot accommodate 60-week organic growth.
    const staticBaseline = nominalBaseline(BASELINE_WINDOW_SIZE);
    const week30Snapshot = snapshotOf(Math.round(100 * Math.pow(1.1, 30)), NOMINAL_FACTORS);
    const result = validateSnapshotPlausibility(week30Snapshot, staticBaseline);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('event-count-outlier');
  });
});

describe('validateSnapshotPlausibility · stddev=0 doesn\'t divide-by-zero', () => {
  test('flat-line baseline + exact match passes', () => {
    const baseline: BaselineWindow = {
      snapshots: Array.from({ length: 10 }, () => snapshotOf(100, NOMINAL_FACTORS)),
    };
    const result = validateSnapshotPlausibility(snapshotOf(100, NOMINAL_FACTORS), baseline);
    expect(result.ok).toBe(true);
  });

  test('flat-line baseline + small variation passes (stddev=0 check skipped)', () => {
    const baseline: BaselineWindow = {
      snapshots: Array.from({ length: 10 }, () => snapshotOf(100, NOMINAL_FACTORS)),
    };
    // totalEvents=101 differs from 100, but stddev=0 means we can't compute
    // sigma — the check is skipped (fail-open by design).
    const result = validateSnapshotPlausibility(snapshotOf(101, NOMINAL_FACTORS), baseline);
    expect(result.ok).toBe(true);
  });
});
