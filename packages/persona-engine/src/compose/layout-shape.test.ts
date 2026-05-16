/**
 * layout-shape tests · cycle-005 S3 (sprint-9).
 *
 * Covers AC-S3.1 (all 8 combinations of permittedClaims × hot-rank-count)
 * plus boundary/variant cases. Pure function · 10 tests across:
 *   - 3 shape-A (all-quiet baseline · just-under-50-events · single
 *     rank-hot WITHOUT permission collapses to A per PRD AC-8 r1)
 *   - 2 shape-B (one zone with permitted_claims · vs zero-permitted)
 *   - 3 shape-C standard (exactly 2 permitted · 4 permitted · mixed)
 *   - 2 shape-C NO-CLAIM (zero permitted + ≥2 rank-hot · 4-zone rank-hot)
 *
 * Telemetry assertion (`prose_gate.zone_data_no_voice`) is renderer-level
 * — verified in S5's E2E canary, not at the function layer.
 */

import { describe, test, expect } from 'bun:test';
import { selectLayoutShape, isNoClaimVariant } from './layout-shape.ts';
import type { ZoneId } from '../score/types.ts';

const ZONES: readonly ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

function mk(map: Partial<Record<ZoneId, number>>): ReadonlyMap<ZoneId, number> {
  return new Map(Object.entries(map) as [ZoneId, number][]);
}
function mkRank(
  map: Partial<Record<ZoneId, number | null>>,
): ReadonlyMap<ZoneId, number | null> {
  return new Map(Object.entries(map) as [ZoneId, number | null][]);
}

describe('selectLayoutShape · shape A (all-quiet)', () => {
  test('AC-S3.2 all zones empty (zero permitted, no hot ranks, low events) → A', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({}),
        topRankByZone: mkRank({}),
        totalEventsByZone: mk({ stonehenge: 5, 'bear-cave': 5, 'el-dorado': 5, 'owsley-lab': 5 }),
      }),
    ).toBe('A-all-quiet');
  });

  test('just-under-50 total events with no permissions → A', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({}),
        topRankByZone: mkRank({ 'bear-cave': 45 }),
        totalEventsByZone: mk({ 'bear-cave': 49 }),
      }),
    ).toBe('A-all-quiet');
  });

  test('AC-S3.5 boundary: single rank-hot zone without permissions → A (NOT B)', () => {
    // Per PRD AC-8 r1 + sprint-9 §T3.2: "zero permitted but exactly-one
    // rank-hot → still Shape A". A single hot zone without licensing
    // collapses to silence.
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({}),
        topRankByZone: mkRank({ 'bear-cave': 95 }),
        totalEventsByZone: mk({ 'bear-cave': 100 }),
      }),
    ).toBe('A-all-quiet');
  });
});

describe('selectLayoutShape · shape B (one-dim-hot)', () => {
  test('AC-S3.3 exactly one zone with permittedClaims ≥ 1 → B', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({ 'bear-cave': 3 }),
        topRankByZone: mkRank({ 'bear-cave': 95 }),
        totalEventsByZone: mk({ 'bear-cave': 100 }),
      }),
    ).toBe('B-one-dim-hot');
  });

  test('one permitted + others rank-hot but unpermitted → still B', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({ 'bear-cave': 2 }),
        topRankByZone: mkRank({ 'bear-cave': 92, 'el-dorado': 91, 'owsley-lab': 90 }),
        totalEventsByZone: mk({ 'bear-cave': 50, 'el-dorado': 40, 'owsley-lab': 30 }),
      }),
    ).toBe('B-one-dim-hot');
  });
});

describe('selectLayoutShape · shape C standard', () => {
  test('AC-S3.6 boundary: exactly 2 permitted → C (NOT B)', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({ 'bear-cave': 1, 'el-dorado': 1 }),
        topRankByZone: mkRank({}),
        totalEventsByZone: mk({ 'bear-cave': 50, 'el-dorado': 50 }),
      }),
    ).toBe('C-multi-dim-hot');
  });

  test('AC-S3.4 all 4 zones permitted → C', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({
          stonehenge: 2,
          'bear-cave': 5,
          'el-dorado': 3,
          'owsley-lab': 1,
        }),
        topRankByZone: mkRank({}),
        totalEventsByZone: mk({}),
      }),
    ).toBe('C-multi-dim-hot');
  });

  test('permitted + rank-hot mix → C', () => {
    expect(
      selectLayoutShape({
        zones: ZONES,
        permittedClaimsByZone: mk({ 'bear-cave': 3, 'el-dorado': 2 }),
        topRankByZone: mkRank({ 'owsley-lab': 95 }),
        totalEventsByZone: mk({}),
      }),
    ).toBe('C-multi-dim-hot');
  });
});

describe('selectLayoutShape · shape C NO-CLAIM variant', () => {
  test('AC-S3.5 zero permitted + 2 zones rank-hot → C', () => {
    const args = {
      zones: ZONES,
      permittedClaimsByZone: mk({}),
      topRankByZone: mkRank({ 'bear-cave': 92, 'el-dorado': 91 }),
      totalEventsByZone: mk({ 'bear-cave': 100, 'el-dorado': 80 }),
    };
    expect(selectLayoutShape(args)).toBe('C-multi-dim-hot');
    expect(isNoClaimVariant(args)).toBe(true);
  });

  test('zero permitted + 4 zones rank-hot → C, NO-CLAIM variant detected', () => {
    const args = {
      zones: ZONES,
      permittedClaimsByZone: mk({}),
      topRankByZone: mkRank({
        stonehenge: 90,
        'bear-cave': 95,
        'el-dorado': 92,
        'owsley-lab': 99,
      }),
      totalEventsByZone: mk({}),
    };
    expect(selectLayoutShape(args)).toBe('C-multi-dim-hot');
    expect(isNoClaimVariant(args)).toBe(true);
  });
});

describe('isNoClaimVariant', () => {
  test('returns false for shape A', () => {
    const args = {
      zones: ZONES,
      permittedClaimsByZone: mk({}),
      topRankByZone: mkRank({}),
      totalEventsByZone: mk({}),
    };
    expect(isNoClaimVariant(args)).toBe(false);
  });

  test('returns false for shape B (one permitted)', () => {
    const args = {
      zones: ZONES,
      permittedClaimsByZone: mk({ 'bear-cave': 1 }),
      topRankByZone: mkRank({}),
      totalEventsByZone: mk({}),
    };
    expect(isNoClaimVariant(args)).toBe(false);
  });

  test('returns false for shape C with any permission', () => {
    const args = {
      zones: ZONES,
      permittedClaimsByZone: mk({ 'bear-cave': 1, 'el-dorado': 1 }),
      topRankByZone: mkRank({ 'owsley-lab': 95 }),
      totalEventsByZone: mk({}),
    };
    expect(selectLayoutShape(args)).toBe('C-multi-dim-hot');
    expect(isNoClaimVariant(args)).toBe(false);
  });
});
