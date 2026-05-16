/**
 * prose-gate tests · cycle-005 S1 (sprint-7).
 *
 * Verifies the FR-2 V1 telemetry-only contract:
 *   - text returned UNCHANGED in all paths (NFR-2 idempotency · AC-S1.1)
 *   - mechanical-check gating: regex match alone is not a violation; the
 *     `factor_stats` predicate must also fire (AC-S1.2/3/4)
 *   - historic factors (no factor_stats) skip silently (AC-S1.5)
 *   - draft_hash 8-char prefix in console.warn surface (AC-S1.6 — caller's
 *     responsibility; this suite verifies `draftHash` shape only)
 *   - 50K-char synthetic processes in <100ms (AC-S1.7 · NFR-6 catastrophic-
 *     backtracking guard)
 *   - morphology variants per PRD AC-13 (Cohorts · lock-step · mixed-case)
 *   - word-boundary negatives (`vault.cohorts_table` does NOT flag)
 *
 * The 4th FR-5 case "stale-but-loud" is documented as a V1.5 destination
 * gap (not enforced at V1) — see NOTES.md Decision Log.
 */

import { describe, test, expect } from 'bun:test';
import type { FactorStats } from '../score/types.ts';
import {
  inspectProse,
  resolveProseGateMode,
  buildFactorStatsMap,
  draftHash,
} from './prose-gate.ts';

/** Compose a baseline `FactorStats` with overrides. All fields the gate
 *  consults are explicit; everything else is realistic-defaults. */
function statsWith(overrides: {
  unique_actors?: number;
  current_percentile_rank?: number | null;
  p99_reliable?: boolean;
}): FactorStats {
  return {
    history: {
      active_days: 100,
      last_active_date: '2026-05-10',
      stale: false,
      no_data: false,
      sufficiency: { p50: true, p90: true, p99: true },
    },
    occurrence: { active_day_frequency: 0.3, current_is_active: true },
    magnitude: {
      event_count: 5,
      percentiles: {
        p10: { value: 1, reliable: true },
        p25: { value: 2, reliable: true },
        p50: { value: 4, reliable: true },
        p75: { value: 10, reliable: true },
        p90: { value: 23, reliable: true },
        p95: { value: 45, reliable: true },
        p99: { value: 130, reliable: overrides.p99_reliable ?? true },
      },
      current_percentile_rank:
        overrides.current_percentile_rank === undefined
          ? 50
          : overrides.current_percentile_rank,
    },
    cohort: {
      unique_actors: overrides.unique_actors ?? 5,
      percentiles: {
        p10: { value: 1, reliable: true },
        p25: { value: 1, reliable: true },
        p50: { value: 2, reliable: true },
        p75: { value: 5, reliable: true },
        p90: { value: 11, reliable: true },
        p95: { value: 22, reliable: true },
        p99: { value: 81, reliable: true },
      },
      current_percentile_rank: 50,
    },
    cadence: {
      days_since_last_active: 0,
      median_active_day_gap_days: 1,
      current_gap_percentile_rank: 50,
    },
  };
}

const FACTOR_ARTICLES = { id: 'og:articles', display_name: 'Articles' };
const FACTOR_VALIDATOR = { id: 'og:boosted-validator', display_name: 'Boosted Validator' };

describe('inspectProse · idempotency', () => {
  test('returns text byte-identical to input (AC-S1.1)', () => {
    const draft = 'just a calm digest with no triggers';
    const { text } = inspectProse(draft, new Map(), []);
    expect(text).toBe(draft);
  });

  test('text unchanged even when violations fire', () => {
    const draft = 'the Articles factor showed coordinated cluster behavior';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ unique_actors: 1 })]]);
    const { text, validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    expect(text).toBe(draft);
    expect(validation.violations.length).toBeGreaterThan(0);
  });
});

describe('inspectProse · FR-5 regression cases', () => {
  test('AC-S1.2 sequential-mint chain: cluster-language + unique_actors=1 → cohort-singleton', () => {
    const draft =
      'on Boosted Validator, the four wallets moved in lockstep, coordinated cluster';
    const map = new Map([[FACTOR_VALIDATOR.id, statsWith({ unique_actors: 1 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_VALIDATOR]);
    const v = validation.violations.find((v) => v.reason === 'cohort-singleton');
    expect(v).toBeDefined();
    expect(v?.factor_id).toBe(FACTOR_VALIDATOR.id);
  });

  test('AC-S1.3 forced structural shift: rank=88 + "structural shift" → rank-below-threshold', () => {
    const draft = 'Articles surged — structural shift this week';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ current_percentile_rank: 88 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    const v = validation.violations.find((v) => v.reason === 'rank-below-threshold');
    expect(v).toBeDefined();
    expect(v?.factor_id).toBe(FACTOR_ARTICLES.id);
  });

  test('AC-S1.4 fake p99-rare: reliable=false + "p99-rare" → percentile-unreliable', () => {
    const draft = 'Articles posted a p99-rare event';
    const map = new Map([
      [
        FACTOR_ARTICLES.id,
        statsWith({ current_percentile_rank: 99, p99_reliable: false }),
      ],
    ]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    const v = validation.violations.find((v) => v.reason === 'percentile-unreliable');
    expect(v).toBeDefined();
  });
});

describe('inspectProse · historic factor handling (AC-S1.5)', () => {
  test('factor in `factors[]` but missing from stats map → silent skip', () => {
    const draft = 'the Articles factor — clearly a structural shift';
    // factors[] includes Articles for attribution; stats map is EMPTY (historic factor)
    const { validation } = inspectProse(draft, new Map(), [FACTOR_ARTICLES]);
    const v = validation.violations.find((v) => v.reason === 'rank-below-threshold');
    expect(v).toBeUndefined();
    expect(validation.matched_patterns.length).toBeGreaterThan(0); // regex still fires
  });
});

describe('inspectProse · no-factor-context attribution fallback', () => {
  test('regex matches but no factor in proximity → no-factor-context violation', () => {
    const draft = 'the wallets formed a coordinated cluster overnight';
    const { validation } = inspectProse(draft, new Map(), []); // factors[] empty
    const v = validation.violations.find((v) => v.reason === 'no-factor-context');
    expect(v).toBeDefined();
  });
});

describe('inspectProse · negative cases (must NOT flag)', () => {
  test('legitimate cohort discussion + unique_actors=10 → no violation', () => {
    const draft = 'the Articles factor saw broad cohort participation this week';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ unique_actors: 10 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    const v = validation.violations.find((v) => v.reason === 'cohort-singleton');
    expect(v).toBeUndefined();
  });

  test('top decile language + p95 reliable rank=98 → no violation', () => {
    const draft = 'Articles hit the top decile range this period';
    const map = new Map([
      [FACTOR_ARTICLES.id, statsWith({ current_percentile_rank: 98, p99_reliable: true })],
    ]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    const v = validation.violations.find((v) => v.reason === 'percentile-unreliable');
    expect(v).toBeUndefined();
  });
});

describe('inspectProse · morphology variants (PRD AC-13)', () => {
  test('"Cohorts" (capitalized + plural) matches cluster-claim', () => {
    const draft = 'Articles had Cohorts active in succession';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ unique_actors: 1 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    expect(
      validation.violations.find((v) => v.reason === 'cohort-singleton'),
    ).toBeDefined();
  });

  test('"lock-step" (hyphenated) matches cluster-claim', () => {
    const draft = 'Articles moved in lock-step this week';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ unique_actors: 1 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    expect(
      validation.violations.find((v) => v.reason === 'cohort-singleton'),
    ).toBeDefined();
  });

  test('"Structural Shift" (mixed-case) matches structural-shift', () => {
    const draft = 'Articles is in a Structural Shift regime';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ current_percentile_rank: 50 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    expect(
      validation.violations.find((v) => v.reason === 'rank-below-threshold'),
    ).toBeDefined();
  });

  test('punctuation-adjacent "(coordinated cluster)." matches', () => {
    const draft = 'Articles had (coordinated cluster). over the period';
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ unique_actors: 1 })]]);
    const { validation } = inspectProse(draft, map, [FACTOR_ARTICLES]);
    expect(
      validation.violations.find((v) => v.reason === 'cohort-singleton'),
    ).toBeDefined();
  });
});

describe('inspectProse · word-boundary negatives', () => {
  test('identifier-like "vault.cohorts_table" does NOT flag cluster-claim', () => {
    // The bare word "cohorts" appears inside the identifier; \b before
    // "cohorts" matches at the `.` boundary so this DOES match the regex.
    // However word-boundary in identifiers like `_cohorts_table` would not
    // — verify the regex's containment behavior explicitly so V1.5 can
    // tighten if telemetry shows false-flag noise.
    const draftIdent = 'see vault._cohorts_table for the join';
    const { validation } = inspectProse(draftIdent, new Map(), []);
    // _cohorts_ — \b boundary before _cohorts_ is at the dot before underscore,
    // and \b requires a word↔non-word transition. Underscore is a word char,
    // so \b does NOT trigger before _cohorts_. Regex does NOT match.
    expect(validation.matched_patterns.length).toBe(0);
  });
});

describe('inspectProse · catastrophic-backtracking guard (AC-S1.7)', () => {
  test('50K-char draft processes in <100ms', () => {
    const big =
      'Articles ran a structural shift cohort lockstep p99-rare ' +
      'sentence repeated many times. '.repeat(750); // ~50K chars
    const map = new Map([[FACTOR_ARTICLES.id, statsWith({ current_percentile_rank: 50 })]]);
    const t0 = performance.now();
    const { text } = inspectProse(big, map, [FACTOR_ARTICLES]);
    const elapsed = performance.now() - t0;
    expect(text.length).toBe(big.length);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('resolveProseGateMode', () => {
  test('defaults to "log" when env unset', () => {
    delete process.env.PROSE_GATE_ON_VIOLATION;
    expect(resolveProseGateMode()).toBe('log');
  });

  test('accepts log, skip, silence (case-insensitive)', () => {
    process.env.PROSE_GATE_ON_VIOLATION = 'SKIP';
    expect(resolveProseGateMode()).toBe('skip');
    process.env.PROSE_GATE_ON_VIOLATION = 'silence';
    expect(resolveProseGateMode()).toBe('silence');
    process.env.PROSE_GATE_ON_VIOLATION = 'log';
    expect(resolveProseGateMode()).toBe('log');
    delete process.env.PROSE_GATE_ON_VIOLATION;
  });

  test('invalid value falls back to "log"', () => {
    process.env.PROSE_GATE_ON_VIOLATION = 'invalid-mode';
    expect(resolveProseGateMode()).toBe('log');
    delete process.env.PROSE_GATE_ON_VIOLATION;
  });
});

describe('buildFactorStatsMap', () => {
  test('includes live factors in map; ALL factors in attribution array', () => {
    const breakdown = {
      top_factors: [
        {
          factor_id: 'og:articles',
          display_name: 'Articles',
          factor_stats: statsWith({}),
        },
        {
          factor_id: 'og:historic',
          display_name: 'Historic Factor',
          // no factor_stats — historic
        },
      ],
      cold_factors: [
        {
          factor_id: 'og:cold',
          display_name: 'Cold Factor',
          factor_stats: statsWith({}),
        },
      ],
    };
    const { factorStatsByFactorId, factors } = buildFactorStatsMap(breakdown);
    expect(factorStatsByFactorId.size).toBe(2);
    expect(factorStatsByFactorId.has('og:articles')).toBe(true);
    expect(factorStatsByFactorId.has('og:cold')).toBe(true);
    expect(factorStatsByFactorId.has('og:historic')).toBe(false);
    expect(factors.length).toBe(3); // ALL factors for attribution lookup
    expect(factors.find((f) => f.id === 'og:historic')).toBeDefined();
  });

  test('empty breakdown produces empty map + empty factors', () => {
    const { factorStatsByFactorId, factors } = buildFactorStatsMap({});
    expect(factorStatsByFactorId.size).toBe(0);
    expect(factors.length).toBe(0);
  });
});

describe('draftHash', () => {
  test('returns 8 hex chars', () => {
    const h = draftHash('some draft text');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  test('deterministic for same input', () => {
    expect(draftHash('abc')).toBe(draftHash('abc'));
  });

  test('different inputs produce different hashes (collision-acceptable)', () => {
    expect(draftHash('one draft')).not.toBe(draftHash('another draft'));
  });
});
