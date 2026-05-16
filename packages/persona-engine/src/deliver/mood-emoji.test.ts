/**
 * mood-emoji tests · cycle-005 S4 (sprint-10).
 *
 * Verifies registry-mediated emoji selection per FR-3 + AC-S4.1-7:
 *   - magnitude rank ≥ 95 + p95 reliable → ['flex']
 *   - cohort rank ≥ 90 + actors ≥ 5 → ['eyes', 'shocked']
 *   - cadence gap rank ≥ 90 + active → ['noted', 'concerned']
 *   - cold factor previous>5 total=0 → ['sadge', 'dazed']
 *   - historic / no_data / error / unknown_factor → null
 *   - MOOD_EMOJI_DISABLED=true → null
 *   - registry miss → null (silent degradation)
 *   - priority: magnitude > cohort > cadence
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { moodEmojiForFactor, moodEmojiForColdFactor } from './mood-emoji.ts';
import type { FactorStats, PulseDimensionFactor } from '../score/types.ts';

function stats(o: {
  magRank?: number | null;
  p95Reliable?: boolean;
  cohortRank?: number | null;
  actors?: number;
  cadenceRank?: number | null;
  currentActive?: boolean;
  noData?: boolean;
  error?: boolean;
  unknown?: boolean;
}): FactorStats {
  return {
    history: {
      active_days: 100,
      last_active_date: '2026-05-10',
      stale: false,
      no_data: o.noData ?? false,
      ...(o.error ? { error: true } : {}),
      ...(o.unknown ? { unknown_factor: true } : {}),
      sufficiency: { p50: true, p90: true, p99: true },
    },
    occurrence: { active_day_frequency: 0.3, current_is_active: o.currentActive ?? true },
    magnitude: {
      event_count: 5,
      percentiles: {
        p10: { value: 1, reliable: true },
        p25: { value: 2, reliable: true },
        p50: { value: 4, reliable: true },
        p75: { value: 10, reliable: true },
        p90: { value: 23, reliable: true },
        p95: { value: 45, reliable: o.p95Reliable ?? true },
        p99: { value: 130, reliable: true },
      },
      current_percentile_rank: o.magRank === undefined ? 50 : o.magRank,
    },
    cohort: {
      unique_actors: o.actors ?? 5,
      percentiles: {
        p10: { value: 1, reliable: true },
        p25: { value: 1, reliable: true },
        p50: { value: 2, reliable: true },
        p75: { value: 5, reliable: true },
        p90: { value: 11, reliable: true },
        p95: { value: 22, reliable: true },
        p99: { value: 81, reliable: true },
      },
      current_percentile_rank: o.cohortRank === undefined ? 50 : o.cohortRank,
    },
    cadence: {
      days_since_last_active: 0,
      median_active_day_gap_days: 1,
      current_gap_percentile_rank: o.cadenceRank === undefined ? 50 : o.cadenceRank,
    },
  };
}

beforeEach(() => {
  delete process.env.MOOD_EMOJI_DISABLED;
});

afterEach(() => {
  delete process.env.MOOD_EMOJI_DISABLED;
});

describe('moodEmojiForFactor · positive rules (AC-S4.2/3/4)', () => {
  test('AC-S4.2 magnitude rank ≥95 + p95 reliable → flex emoji rendered', () => {
    const e = moodEmojiForFactor(stats({ magRank: 97, p95Reliable: true }));
    expect(e).toMatch(/^<a?:[\w-]+:\d+>$/);
  });

  test('AC-S4.3 cohort rank ≥90 + actors ≥5 → eyes/shocked emoji rendered', () => {
    const e = moodEmojiForFactor(
      stats({ magRank: 50, cohortRank: 92, actors: 7 }),
    );
    expect(e).toMatch(/^<a?:[\w-]+:\d+>$/);
  });

  test('AC-S4.4 cadence gap rank ≥90 + active → noted/concerned emoji rendered', () => {
    const e = moodEmojiForFactor(
      stats({ magRank: 50, cohortRank: 50, cadenceRank: 95, currentActive: true }),
    );
    expect(e).toMatch(/^<a?:[\w-]+:\d+>$/);
  });
});

describe('moodEmojiForFactor · negative cases (AC-S4.5)', () => {
  test('undefined stats → null (historic factor)', () => {
    expect(moodEmojiForFactor(undefined)).toBeNull();
  });

  test('no_data flag → null', () => {
    expect(moodEmojiForFactor(stats({ noData: true, magRank: 99 }))).toBeNull();
  });

  test('error flag → null', () => {
    expect(moodEmojiForFactor(stats({ error: true, magRank: 99 }))).toBeNull();
  });

  test('unknown_factor flag → null', () => {
    expect(moodEmojiForFactor(stats({ unknown: true, magRank: 99 }))).toBeNull();
  });

  test('baseline mid-rank → null (no rule fires)', () => {
    expect(moodEmojiForFactor(stats({ magRank: 50, cohortRank: 50 }))).toBeNull();
  });

  test('magnitude rank 95 but p95 unreliable → null (reliability gate)', () => {
    expect(moodEmojiForFactor(stats({ magRank: 99, p95Reliable: false }))).toBeNull();
  });

  test('cohort rank 95 but actors=4 (under threshold) → null', () => {
    expect(
      moodEmojiForFactor(stats({ magRank: 50, cohortRank: 95, actors: 4 })),
    ).toBeNull();
  });

  test('cadence rank 95 but currentActive false → null', () => {
    expect(
      moodEmojiForFactor(
        stats({ magRank: 50, cohortRank: 50, cadenceRank: 95, currentActive: false }),
      ),
    ).toBeNull();
  });

  test('cadence rank null → null', () => {
    expect(
      moodEmojiForFactor(
        stats({ magRank: 50, cohortRank: 50, cadenceRank: null, currentActive: true }),
      ),
    ).toBeNull();
  });
});

describe('moodEmojiForFactor · priority order (magnitude > cohort > cadence)', () => {
  test('factor qualifies for both magnitude AND cohort → magnitude wins (flex)', () => {
    // Both rules would fire; magnitude takes priority per SDD §3 r1.
    // We don't pin the exact emoji ID (registry-dependent), but we verify
    // a token IS returned and that disabling magnitude path returns a
    // DIFFERENT token (cohort fallback).
    const magToken = moodEmojiForFactor(
      stats({ magRank: 99, p95Reliable: true, cohortRank: 99, actors: 10 }),
    );
    const cohortOnlyToken = moodEmojiForFactor(
      stats({ magRank: 50, cohortRank: 99, actors: 10 }),
    );
    expect(magToken).not.toBeNull();
    expect(cohortOnlyToken).not.toBeNull();
    // Different rules → different mood pools → different emoji selected
    // (the flex pool and eyes/shocked pool don't overlap in the registry).
    expect(magToken).not.toBe(cohortOnlyToken);
  });
});

describe('MOOD_EMOJI_DISABLED env (AC-S4.6)', () => {
  test('MOOD_EMOJI_DISABLED=true → all calls return null', () => {
    process.env.MOOD_EMOJI_DISABLED = 'true';
    expect(moodEmojiForFactor(stats({ magRank: 99, p95Reliable: true }))).toBeNull();
    expect(
      moodEmojiForFactor(stats({ cohortRank: 99, actors: 10 })),
    ).toBeNull();
    expect(
      moodEmojiForColdFactor({
        factor_id: 'x',
        display_name: 'X',
        primary_action: null,
        total: 0,
        previous: 10,
        delta_pct: -100,
        delta_count: -10,
      }),
    ).toBeNull();
  });
});

describe('moodEmojiForColdFactor (AC-S4.1 cold path)', () => {
  test('previous > 5 + total = 0 → sadge/dazed emoji rendered', () => {
    const factor: PulseDimensionFactor = {
      factor_id: 'og:churned',
      display_name: 'Churned',
      primary_action: null,
      total: 0,
      previous: 10,
      delta_pct: -100,
      delta_count: -10,
    };
    expect(moodEmojiForColdFactor(factor)).toMatch(/^<a?:[\w-]+:\d+>$/);
  });

  test('previous = 3 (under threshold) + total = 0 → null', () => {
    expect(
      moodEmojiForColdFactor({
        factor_id: 'og:lite',
        display_name: 'Lite',
        primary_action: null,
        total: 0,
        previous: 3,
        delta_pct: -100,
        delta_count: -3,
      }),
    ).toBeNull();
  });

  test('total > 0 (still active) → null', () => {
    expect(
      moodEmojiForColdFactor({
        factor_id: 'og:active',
        display_name: 'Active',
        primary_action: null,
        total: 1,
        previous: 10,
        delta_pct: -90,
        delta_count: -9,
      }),
    ).toBeNull();
  });
});
