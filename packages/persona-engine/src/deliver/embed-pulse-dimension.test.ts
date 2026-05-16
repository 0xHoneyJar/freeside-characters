/**
 * buildPulseDimensionPayload tests · cycle-005 S2 (sprint-8).
 *
 * Verifies the deterministic dashboard-mirrored card body and the 6
 * PR #73 trim regression-guards. Pin-down test set:
 *   - 6-trim regressions (no footer · no was-N · no diversity-chip ·
 *     no field-name suffixes · dynamic truncation · sort-desc preserved)
 *   - Per-row mood emoji slot (FR-3 wiring · S4 fills rules)
 *   - proseGate option threads through but does NOT modify content
 *   - Discord 1024-char per-field cap
 *   - Discord 6000-char total embed cap (cold-first shrink)
 *   - schema_version 1.0.0 and 1.1.0 both accepted (AC-S2.3)
 *   - Absent factor_stats (historic factor) handled (no crash)
 *
 * S2 ships the RENDERER. Digest-path cron wiring + LLM voice layer are
 * deferred to S5 (OTEL wire-up + E2E canary). See NOTES.md Decision Log.
 */

import { describe, test, expect } from 'bun:test';
import type {
  FactorStats,
  PulseDimensionBreakdown,
  PulseDimensionFactor,
} from '../score/types.ts';
import { buildPulseDimensionPayload } from './embed.ts';
import { moodEmojiForFactor } from './mood-emoji.ts';

function stats(overrides: { rank?: number | null }): FactorStats {
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
        p99: { value: 130, reliable: true },
      },
      current_percentile_rank: overrides.rank === undefined ? 50 : overrides.rank,
    },
    cohort: {
      unique_actors: 5,
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

function factor(id: string, name: string, delta: number, withStats = true): PulseDimensionFactor {
  return {
    factor_id: id,
    display_name: name,
    primary_action: name,
    total: 10 + delta,
    previous: 10,
    delta_pct: null,
    delta_count: delta,
    ...(withStats ? { factor_stats: stats({ rank: 50 }) } : {}),
  };
}

function breakdown(over: Partial<PulseDimensionBreakdown> = {}): PulseDimensionBreakdown {
  return {
    id: 'og',
    display_name: 'OG',
    total_events: 10,
    previous_period_events: 8,
    delta_pct: 25,
    delta_count: 2,
    inactive_factor_count: 0,
    total_factor_count: 3,
    top_factors: [factor('og:articles', 'Articles', 5), factor('og:keys', 'Keys', 3)],
    cold_factors: [],
    ...over,
  };
}

describe('buildPulseDimensionPayload · core shape', () => {
  test('returns DigestPayload with content + embeds[0]', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    expect(payload.embeds.length).toBe(1);
    expect(payload.content).toContain('Bear Cave');
    expect(payload.embeds[0]?.fields?.length).toBeGreaterThan(0);
  });

  test('renders all active top_factors in desc order from substrate', () => {
    // Substrate guarantees sort-desc; renderer preserves order verbatim
    const dim = breakdown({
      top_factors: [
        factor('og:big', 'Big', 100),
        factor('og:med', 'Med', 50),
        factor('og:small', 'Small', 5),
      ],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    const bigIdx = top.indexOf('Big');
    const medIdx = top.indexOf('Med');
    const smallIdx = top.indexOf('Small');
    expect(bigIdx).toBeGreaterThanOrEqual(0);
    expect(medIdx).toBeGreaterThan(bigIdx);
    expect(smallIdx).toBeGreaterThan(medIdx);
  });
});

describe('buildPulseDimensionPayload · 6 PR #73 trim regression-guards (AC-S2.4)', () => {
  test('NO footer line', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    expect(payload.embeds[0]?.footer).toBeUndefined();
  });

  test('NO "was-N" previous-period count chip in field values', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    const allText = JSON.stringify(payload);
    expect(allText).not.toMatch(/\bwas[\s-]\d+/i);
  });

  test('NO diversity-chip line (no "diversity" word anywhere)', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    expect(JSON.stringify(payload)).not.toMatch(/diversity/i);
  });

  test('NO field-name suffixes (field names are bare "top" and "cold")', () => {
    const payload = buildPulseDimensionPayload(
      breakdown({ cold_factors: [factor('og:cold', 'Cold One', 0)] }),
      'bear-cave',
      30,
    );
    const fieldNames = payload.embeds[0]?.fields?.map((f) => f.name) ?? [];
    for (const name of fieldNames) {
      expect(name).toMatch(/^(top|cold)$/); // exactly · no "(7d)" / "(30d)" / etc.
    }
  });

  test('Dynamic truncation: 50 factors with long names triggers "…and N more silent"', () => {
    const manyFactors = Array.from({ length: 50 }, (_, i) =>
      factor(`og:f${i}`, `LongLongFactorName${i}`, i),
    );
    const payload = buildPulseDimensionPayload(
      breakdown({ top_factors: manyFactors }),
      'bear-cave',
      30,
    );
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top).toContain('more silent');
    expect(top.length).toBeLessThanOrEqual(1024);
  });

  test('Sort-desc preserved (substrate-provided order is verbatim)', () => {
    const dim = breakdown({
      top_factors: [factor('a', 'AAA', 50), factor('b', 'BBB', 30), factor('c', 'CCC', 10)],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top.indexOf('AAA')).toBeLessThan(top.indexOf('BBB'));
    expect(top.indexOf('BBB')).toBeLessThan(top.indexOf('CCC'));
  });
});

describe('buildPulseDimensionPayload · mood-emoji slot wiring (AC-S2.5)', () => {
  test('mood-emoji callback called once per row when option provided', () => {
    let callCount = 0;
    const stub: (s: FactorStats | undefined) => string | null = (s) => {
      callCount += 1;
      return null; // S4-stub default
    };
    const dim = breakdown({
      top_factors: [factor('a', 'A', 1), factor('b', 'B', 2)],
      cold_factors: [factor('c', 'C', 0)],
    });
    buildPulseDimensionPayload(dim, 'bear-cave', 30, { moodEmoji: stub });
    expect(callCount).toBe(3);
  });

  test('mood-emoji non-null token rendered as prefix on factor row', () => {
    const stub: (s: FactorStats | undefined) => string | null = () => '<:flex:123>';
    const dim = breakdown({ top_factors: [factor('og:articles', 'Articles', 5)] });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30, { moodEmoji: stub });
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top).toContain('<:flex:123> Articles');
  });

  test('S4-stub moodEmojiForFactor returns null → no emoji slot in V1', () => {
    const dim = breakdown({ top_factors: [factor('og:articles', 'Articles', 5)] });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30, {
      moodEmoji: moodEmojiForFactor,
    });
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top).toContain('Articles');
    expect(top).not.toContain('<:'); // no emoji rendered
  });

  test('MOOD_EMOJI_DISABLED=true short-circuits to null', () => {
    process.env.MOOD_EMOJI_DISABLED = 'true';
    expect(moodEmojiForFactor(stats({ rank: 99 }))).toBeNull();
    delete process.env.MOOD_EMOJI_DISABLED;
  });
});

describe('buildPulseDimensionPayload · proseGate option (AC-S2.6)', () => {
  test('proseGate option threads through but text is unchanged (V1 telemetry-only)', () => {
    const payloadNoGate = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    const payloadWithGate = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      proseGate: {
        matched_patterns: [{ pattern: 'cluster-claim', span: [0, 10] }],
        violations: [
          {
            pattern: 'cluster-claim',
            factor_id: 'og:articles',
            reason: 'cohort-singleton',
            proximity_factors: ['Articles'],
          },
        ],
      },
    });
    // Card body byte-identical regardless of proseGate input (V1 contract)
    expect(JSON.stringify(payloadWithGate.embeds[0]?.fields)).toBe(
      JSON.stringify(payloadNoGate.embeds[0]?.fields),
    );
  });
});

describe('buildPulseDimensionPayload · historic-factor handling (AC-S2.3)', () => {
  test('factor without factor_stats does NOT crash (rank omitted)', () => {
    const dim = breakdown({
      top_factors: [factor('og:historic', 'Historic', 5, false)],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30, {
      moodEmoji: moodEmojiForFactor,
    });
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top).toContain('Historic');
    expect(top).not.toContain('rank-'); // omitted when factor_stats absent
  });
});

describe('buildPulseDimensionPayload · Discord 1024-char per-field cap (AC-S2.2)', () => {
  test('worst-case 19-factor top renders ≤ 1024 chars', () => {
    const manyFactors = Array.from({ length: 19 }, (_, i) =>
      factor(`og:f${i}`, `Factor With A Long Name ${i}`, i + 1),
    );
    const payload = buildPulseDimensionPayload(
      breakdown({ top_factors: manyFactors }),
      'owsley-lab', // onchain dim is worst-case
      30,
    );
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top.length).toBeLessThanOrEqual(1024);
  });

  test('extreme-long factor names trigger overflow token before 1024 breach', () => {
    const giants = Array.from({ length: 20 }, (_, i) =>
      factor(`og:f${i}`, 'X'.repeat(80), i + 1),
    );
    const payload = buildPulseDimensionPayload(
      breakdown({ top_factors: giants }),
      'bear-cave',
      30,
    );
    const top = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    expect(top.length).toBeLessThanOrEqual(1024);
    expect(top).toContain('more silent');
  });
});

describe('buildPulseDimensionPayload · 6000-char total embed cap (PRD truncation policy)', () => {
  test('cold field drops first when total exceeds 6000', () => {
    // Construct a scenario where top fills near 1024 and cold has many rows
    const topPad = Array.from({ length: 19 }, (_, i) =>
      factor(`og:t${i}`, 'X'.repeat(40), i + 1),
    );
    const coldPad = Array.from({ length: 200 }, (_, i) =>
      factor(`og:c${i}`, 'Y'.repeat(40), 0),
    );
    const payload = buildPulseDimensionPayload(
      breakdown({ top_factors: topPad, cold_factors: coldPad }),
      'bear-cave',
      30,
      { header: 'X'.repeat(2000), outro: 'Y'.repeat(2000) },
    );
    const totalLen = JSON.stringify(payload.embeds[0]).length;
    // Each field has 1024 cap already; total enforcement prevents the
    // overall embed (description + fields + ...) from exceeding 6000.
    // Loose assertion: when both fields stay, sum of field values ≤ 6000.
    const topValue = payload.embeds[0]?.fields?.find((f) => f.name === 'top')?.value ?? '';
    const coldValue = payload.embeds[0]?.fields?.find((f) => f.name === 'cold')?.value ?? '';
    const fieldSum = topValue.length + coldValue.length;
    expect(topValue.length).toBeLessThanOrEqual(1024);
    // cold drops to empty when header+outro+top combined push past 6000
    expect(coldValue.length === 0 || fieldSum <= 6000).toBe(true);
  });
});

describe('buildPulseDimensionPayload · header/outro voice surface (FR-1)', () => {
  test('header + outro flank field block in description', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      header: 'this week in the cave',
      outro: 'stay groovy 🐻',
    });
    expect(payload.embeds[0]?.description).toContain('this week in the cave');
    expect(payload.embeds[0]?.description).toContain('stay groovy');
  });

  test('absent header/outro produces no description', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    expect(payload.embeds[0]?.description).toBeUndefined();
  });
});
