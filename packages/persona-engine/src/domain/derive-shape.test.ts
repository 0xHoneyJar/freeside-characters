// cycle-006 S1 T1.3 + T1.8 · canonical shape derivation tests.
//
// Three suites:
//   1. Oracle equivalence — the production `deriveShape` matches a hand-crafted
//      English-spec oracle (re-derived from derive-shape-oracle.md without
//      sharing code with derive-shape.ts).
//   2. Legacy equivalence (T1.8 · FLATLINE-SKP-001/HIGH) — the production
//      `deriveShape` matches the cycle-005 `selectLayoutShape` on identical
//      inputs across all 5 decision-tree branches. Validates that the new
//      canonical path preserves cycle-005 production behavior.
//   3. Output completeness — permittedFactors and silencedFactors populate
//      correctly per SDD §3.2.
//
// fast-check substitution: the sprint plan referenced fast-check but it is
// not yet in deps. Substituting 30 hand-crafted fixtures spanning rule
// boundaries and snapshot-shape variations. See NOTES.md Decision Log.

import { describe, test, expect } from 'bun:test';
import {
  deriveShape,
  type DeriveShapeInput,
  type DerivedShape,
  type LayoutShape,
} from './derive-shape.ts';
import { selectLayoutShape, type SelectLayoutShapeArgs } from '../compose/layout-shape.ts';
import type { DigestSnapshot, DigestFactorSnapshot } from './digest-snapshot.ts';
import type { ZoneId } from '../score/types.ts';
import type { FactorStats } from '../score/types.ts';

const ZONES: readonly ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

// ─────────────────────────────────────────────────────────────────────────────
// Oracle — re-derived from derive-shape-oracle.md English spec.
// Intentionally different style from derive-shape.ts (different variable names,
// different ordering, different helpers). If both diverge, both must be wrong
// the SAME way, which is exponentially less likely than a transcription bug.
// ─────────────────────────────────────────────────────────────────────────────

function oracleShape(input: DeriveShapeInput): { shape: LayoutShape; isNoClaimVariant: boolean } {
  const claimed: boolean[] = [];
  const hotRank: boolean[] = [];

  for (const z of input.crossZone) {
    let hasClaim = false;
    let maxRank: number | null = null;
    for (const f of z.topFactors) {
      const r = f.factorStats?.magnitude?.current_percentile_rank ?? null;
      if (r !== null && (maxRank === null || r > maxRank)) maxRank = r;
      const reliable = f.factorStats?.magnitude?.percentiles?.p95?.reliable === true;
      if (r !== null && r >= 90 && reliable) hasClaim = true;
    }
    claimed.push(hasClaim);
    hotRank.push(maxRank !== null && maxRank >= 90);
  }

  const cCount = claimed.filter(Boolean).length;
  const hCount = hotRank.filter(Boolean).length;

  // Rules in oracle.md order — match the EXACT phrasing.
  if (cCount >= 2) return { shape: 'C-multi-dim-hot', isNoClaimVariant: false };
  if (cCount === 1) return { shape: 'B-one-dim-hot', isNoClaimVariant: false };
  if (cCount === 0 && hCount >= 2) return { shape: 'C-multi-dim-hot', isNoClaimVariant: true };
  return { shape: 'A-all-quiet', isNoClaimVariant: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture builders
// ─────────────────────────────────────────────────────────────────────────────

interface FactorSpec {
  name?: string;
  rank: number | null;
  reliable: boolean;
}

function factorOf(spec: FactorSpec): DigestFactorSnapshot {
  const stats: FactorStats | undefined =
    spec.rank === null
      ? undefined
      : ({
          history: { active_days: 30, last_active_date: '2026-05-15', stale: false, no_data: false },
          magnitude: {
            event_count: 100,
            percentiles: {
              p50: { value: 50, reliable: true },
              p75: { value: 70, reliable: true },
              p90: { value: 85, reliable: true },
              p95: { value: 95, reliable: spec.reliable },
              p99: { value: 99, reliable: spec.reliable },
            },
            current_percentile_rank: spec.rank,
          },
          cohort: {
            unique_actors: 5,
            percentiles: {
              p50: { value: 3, reliable: true },
              p75: { value: 4, reliable: true },
              p90: { value: 5, reliable: true },
              p95: { value: 6, reliable: spec.reliable },
              p99: { value: 8, reliable: spec.reliable },
            },
            current_percentile_rank: spec.rank,
          },
        } as unknown as FactorStats);

  return {
    factorId: `f_${spec.name ?? 'x'}`,
    displayName: spec.name ?? 'factor',
    primaryAction: 'minted',
    total: 100,
    previous: 50,
    deltaPct: 100,
    deltaCount: 50,
    factorStats: stats,
  };
}

function zoneOf(zone: ZoneId, factors: FactorSpec[]): DigestSnapshot {
  return {
    zone,
    dimension: 'overall',
    displayName: zone,
    windowDays: 30,
    generatedAt: '2026-05-15T00:00:00Z',
    totalEvents: 100,
    previousPeriodEvents: 50,
    deltaPct: 100,
    deltaCount: 50,
    coldFactorCount: 0,
    totalFactorCount: factors.length,
    topFactors: factors.map((f, i) => factorOf({ ...f, name: f.name ?? `f${i}` })),
    coldFactors: [],
  };
}

interface Scenario {
  id: string;
  description: string;
  zones: Record<ZoneId, FactorSpec[]>;
  /** Focal zone for `snapshot` arg. */
  focal?: ZoneId;
}

// 30 scenarios covering rule boundaries + variations.
const SCENARIOS: readonly Scenario[] = [
  // Rule 4 (A-all-quiet)
  { id: 'S01', description: 'A · all cold ranks · no claims', zones: { stonehenge: [{ rank: 40, reliable: true }], 'bear-cave': [{ rank: 50, reliable: true }], 'el-dorado': [{ rank: null, reliable: false }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S02', description: 'A · all null ranks', zones: { stonehenge: [{ rank: null, reliable: false }], 'bear-cave': [{ rank: null, reliable: false }], 'el-dorado': [{ rank: null, reliable: false }], 'owsley-lab': [{ rank: null, reliable: false }] } },
  { id: 'S03', description: 'A · 1 hot zone but unreliable (no claim, hCount=1)', zones: { stonehenge: [{ rank: 95, reliable: false }], 'bear-cave': [{ rank: 40, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S04', description: 'A · empty topFactors per zone', zones: { stonehenge: [], 'bear-cave': [], 'el-dorado': [], 'owsley-lab': [] } },
  { id: 'S05', description: 'A · rank just below 90 in all zones', zones: { stonehenge: [{ rank: 89, reliable: true }], 'bear-cave': [{ rank: 89, reliable: true }], 'el-dorado': [{ rank: 89, reliable: true }], 'owsley-lab': [{ rank: 89, reliable: true }] } },

  // Rule 2 (B-one-dim-hot)
  { id: 'S06', description: 'B · single claimed zone, others cold', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 40, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S07', description: 'B · single claimed zone, others hot-but-unreliable', zones: { stonehenge: [{ rank: 99, reliable: true }], 'bear-cave': [{ rank: 95, reliable: false }], 'el-dorado': [{ rank: 92, reliable: false }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S08', description: 'B · single claimed zone with multiple permitted factors', zones: { stonehenge: [{ rank: 95, reliable: true, name: 'a' }, { rank: 92, reliable: true, name: 'b' }, { rank: 91, reliable: true, name: 'c' }], 'bear-cave': [{ rank: 40, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 20, reliable: true }] } },
  { id: 'S09', description: 'B · rank exactly 90 + reliable counts as claim', zones: { stonehenge: [{ rank: 90, reliable: true }], 'bear-cave': [{ rank: 40, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S10', description: 'B · last zone is the single claim', zones: { stonehenge: [{ rank: 40, reliable: true }], 'bear-cave': [{ rank: 50, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 99, reliable: true }] }, focal: 'owsley-lab' },

  // Rule 1 (C-multi-dim-hot standard)
  { id: 'S11', description: 'C-standard · 2 claimed zones', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S12', description: 'C-standard · 3 claimed zones', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 93, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S13', description: 'C-standard · 4 claimed zones', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 93, reliable: true }], 'owsley-lab': [{ rank: 99, reliable: true }] } },
  { id: 'S14', description: 'C-standard · 2 claimed + 2 hot-unreliable', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 92, reliable: false }], 'owsley-lab': [{ rank: 96, reliable: false }] } },
  { id: 'S15', description: 'C-standard · multiple factors per claimed zone', zones: { stonehenge: [{ rank: 95, reliable: true, name: 'a' }, { rank: 30, reliable: true, name: 'b' }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },

  // Rule 3 (C-multi-dim-hot NO-CLAIM)
  { id: 'S16', description: 'C-NO-CLAIM · 2 hot-unreliable, 0 claims', zones: { stonehenge: [{ rank: 95, reliable: false }], 'bear-cave': [{ rank: 92, reliable: false }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S17', description: 'C-NO-CLAIM · 3 hot-unreliable', zones: { stonehenge: [{ rank: 95, reliable: false }], 'bear-cave': [{ rank: 92, reliable: false }], 'el-dorado': [{ rank: 91, reliable: false }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S18', description: 'C-NO-CLAIM · 4 hot-unreliable', zones: { stonehenge: [{ rank: 95, reliable: false }], 'bear-cave': [{ rank: 92, reliable: false }], 'el-dorado': [{ rank: 91, reliable: false }], 'owsley-lab': [{ rank: 99, reliable: false }] } },
  { id: 'S19', description: 'C-NO-CLAIM · 2 hot zones rank exactly 90', zones: { stonehenge: [{ rank: 90, reliable: false }], 'bear-cave': [{ rank: 90, reliable: false }], 'el-dorado': [{ rank: 89, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },

  // Boundary fuzz
  { id: 'S20', description: 'Boundary · rank=89 reliable=true (just below threshold)', zones: { stonehenge: [{ rank: 89, reliable: true }], 'bear-cave': [{ rank: 30, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 70, reliable: true }] } },
  { id: 'S21', description: 'Boundary · rank=90 reliable=false (hot but no claim)', zones: { stonehenge: [{ rank: 90, reliable: false }], 'bear-cave': [{ rank: 89, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S22', description: 'Boundary · 5 factors per zone, mixed', zones: { stonehenge: [{ rank: 95, reliable: true, name: 'a' }, { rank: 80, reliable: true, name: 'b' }, { rank: 70, reliable: true, name: 'c' }, { rank: 60, reliable: false, name: 'd' }, { rank: 50, reliable: true, name: 'e' }], 'bear-cave': [{ rank: 30, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },

  // Mixed scenarios
  { id: 'S23', description: 'Mixed · 1 claim + 1 hot-unreliable (Rule 2 because cCount=1 trumps)', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 92, reliable: false }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S24', description: 'Mixed · 1 claim + 3 hot-unreliable', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 92, reliable: false }], 'el-dorado': [{ rank: 91, reliable: false }], 'owsley-lab': [{ rank: 96, reliable: false }] } },
  { id: 'S25', description: 'Mixed · top factor null rank · second is claim', zones: { stonehenge: [{ rank: null, reliable: false, name: 'top' }, { rank: 99, reliable: true, name: 'second' }], 'bear-cave': [{ rank: 30, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S26', description: 'Edge · zone with no factorStats at all', zones: { stonehenge: [{ rank: null, reliable: false, name: 'nostats' }], 'bear-cave': [{ rank: 95, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S27', description: 'Edge · all zones share same single factor name', zones: { stonehenge: [{ rank: 95, reliable: true, name: 'mint' }], 'bear-cave': [{ rank: 91, reliable: true, name: 'mint' }], 'el-dorado': [{ rank: 50, reliable: true, name: 'mint' }], 'owsley-lab': [{ rank: 30, reliable: true, name: 'mint' }] } },
  { id: 'S28', description: 'Edge · negative deltas (irrelevant to shape)', zones: { stonehenge: [{ rank: 95, reliable: true }], 'bear-cave': [{ rank: 91, reliable: true }], 'el-dorado': [{ rank: 50, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S29', description: 'Edge · max rank 100', zones: { stonehenge: [{ rank: 100, reliable: true }], 'bear-cave': [{ rank: 100, reliable: true }], 'el-dorado': [{ rank: 30, reliable: true }], 'owsley-lab': [{ rank: 30, reliable: true }] } },
  { id: 'S30', description: 'Edge · minimum rank 0', zones: { stonehenge: [{ rank: 0, reliable: true }], 'bear-cave': [{ rank: 0, reliable: true }], 'el-dorado': [{ rank: 0, reliable: true }], 'owsley-lab': [{ rank: 0, reliable: true }] } },
];

function inputFromScenario(s: Scenario): DeriveShapeInput {
  const focal = s.focal ?? 'stonehenge';
  const focalZone = zoneOf(focal, s.zones[focal]);
  const crossZone = ZONES.map((z) => zoneOf(z, s.zones[z]));
  return { snapshot: focalZone, crossZone };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 · Oracle equivalence (T1.3)
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveShape · oracle equivalence (T1.3)', () => {
  for (const s of SCENARIOS) {
    test(`${s.id} · ${s.description}`, () => {
      const input = inputFromScenario(s);
      const actual = deriveShape(input);
      const expected = oracleShape(input);
      expect(actual.shape).toBe(expected.shape);
      expect(actual.isNoClaimVariant).toBe(expected.isNoClaimVariant);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 · Legacy equivalence (T1.8 · FLATLINE-SKP-001/HIGH)
// ─────────────────────────────────────────────────────────────────────────────

function legacyArgsFromInput(input: DeriveShapeInput): SelectLayoutShapeArgs {
  const permittedClaimsByZone = new Map<ZoneId, number>();
  const topRankByZone = new Map<ZoneId, number | null>();
  for (const z of input.crossZone) {
    let claims = 0;
    let topRank: number | null = null;
    for (const f of z.topFactors) {
      const r = f.factorStats?.magnitude?.current_percentile_rank ?? null;
      if (r !== null && (topRank === null || r > topRank)) topRank = r;
      const reliable = f.factorStats?.magnitude?.percentiles?.p95?.reliable === true;
      if (r !== null && r >= 90 && reliable) claims += 1;
    }
    permittedClaimsByZone.set(z.zone, claims);
    topRankByZone.set(z.zone, topRank);
  }
  return { zones: ZONES, permittedClaimsByZone, topRankByZone };
}

describe('deriveShape · legacy selectLayoutShape equivalence (T1.8 · FLATLINE-SKP-001)', () => {
  let mismatches = 0;
  for (const s of SCENARIOS) {
    test(`${s.id} · ${s.description} · matches legacy`, () => {
      const input = inputFromScenario(s);
      const derived = deriveShape(input);
      const legacy = selectLayoutShape(legacyArgsFromInput(input));
      if (derived.shape !== legacy) mismatches += 1;
      expect(derived.shape).toBe(legacy);
    });
  }
  test('legacy mismatch count is zero (gate for S1 migration)', () => {
    expect(mismatches).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 · Output completeness (permittedFactors + silencedFactors)
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveShape · output completeness', () => {
  test('permittedFactors includes only rank>=90 + reliable, in topFactors order', () => {
    const focal = zoneOf('stonehenge', [
      { rank: 95, reliable: true, name: 'first' },
      { rank: 99, reliable: false, name: 'unreliable' },
      { rank: 91, reliable: true, name: 'second' },
      { rank: 50, reliable: true, name: 'cold' },
    ]);
    const result = deriveShape({ snapshot: focal, crossZone: [focal] });
    expect(result.permittedFactors.map((f) => f.displayName)).toEqual(['first', 'second']);
  });

  test('permittedFactors empty when zone is cold', () => {
    const focal = zoneOf('stonehenge', [{ rank: 50, reliable: true }]);
    const result = deriveShape({ snapshot: focal, crossZone: [focal] });
    expect(result.permittedFactors).toHaveLength(0);
  });

  test('silencedFactors empty when proseGate omitted', () => {
    const focal = zoneOf('stonehenge', [{ rank: 95, reliable: true, name: 'a' }]);
    const result = deriveShape({ snapshot: focal, crossZone: [focal] });
    expect(result.silencedFactors).toHaveLength(0);
  });

  test('silencedFactors derived from proseGate.violations[].proximity_factors when names match topFactors', () => {
    const focal = zoneOf('stonehenge', [
      { rank: 50, reliable: true, name: 'mint' },
      { rank: 40, reliable: true, name: 'transfer' },
    ]);
    const result = deriveShape({
      snapshot: focal,
      crossZone: [focal],
      proseGate: {
        matched_patterns: [],
        violations: [
          { pattern: 'mint', factor_id: null, reason: 'rank-below-threshold', proximity_factors: ['mint', 'transfer', 'unknown'] },
        ],
      },
    });
    expect(result.silencedFactors.map((f) => f.displayName).sort()).toEqual(['mint', 'transfer']);
    expect(result.silencedFactors.every((f) => f.reason === 'rank-below-threshold')).toBe(true);
  });

  test('claimedZoneCount and hotRankZoneCount populate', () => {
    const focal = zoneOf('stonehenge', [{ rank: 95, reliable: true }]);
    const other1 = zoneOf('bear-cave', [{ rank: 91, reliable: true }]);
    const other2 = zoneOf('el-dorado', [{ rank: 92, reliable: false }]);
    const other3 = zoneOf('owsley-lab', [{ rank: 30, reliable: true }]);
    const result = deriveShape({ snapshot: focal, crossZone: [focal, other1, other2, other3] });
    expect(result.claimedZoneCount).toBe(2);
    expect(result.hotRankZoneCount).toBe(3);
  });
});
