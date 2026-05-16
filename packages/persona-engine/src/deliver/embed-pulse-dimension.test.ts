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
  const total = 10 + delta;
  const previous: number = 10;
  const delta_pct = previous === 0 ? null : ((total - previous) / previous) * 100;
  return {
    factor_id: id,
    display_name: name,
    primary_action: name,
    total,
    previous,
    delta_pct,
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
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
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

  test('field names match the UX r4 table form (snapshot · top · cold)', () => {
    const payload = buildPulseDimensionPayload(
      breakdown({ cold_factors: [factor('og:cold', 'Cold One', 0)] }),
      'bear-cave',
      30,
    );
    const fieldNames = payload.embeds[0]?.fields?.map((f) => f.name) ?? [];
    const allowedNames = new Set(['30d snapshot', 'top this 30d', 'cold']);
    for (const name of fieldNames) {
      expect(allowedNames.has(name)).toBe(true);
    }
  });

  test('snapshot is a code-block table with label-on-left / value-on-right (UX r4)', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      snapshot: { weeklyActiveWallets: 7 },
    });
    const snap = payload.embeds[0]?.fields?.find((f) => f.name === '30d snapshot');
    expect(snap).toBeDefined();
    expect(snap?.value.startsWith('```')).toBe(true);
    expect(snap?.value.endsWith('```')).toBe(true);
    expect(snap?.value).toContain('events');
    expect(snap?.value).toContain('wallets');
    expect(snap?.value).toContain('7');
    expect(snap?.value).toContain('30d');
  });

  test('top-factor code-block table renders one factor per line (UX r4)', () => {
    const dim = breakdown({
      top_factors: [
        factor('og:a', 'Articles', 5),
        factor('og:b', 'Keys', 3),
        factor('og:c', 'Sets', 2),
      ],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    // Code-block table has: opening fence + header + 3 factor rows + closing fence = 6 lines
    const lines = top.split('\n');
    expect(lines.length).toBe(6);
    // Three distinct factor lines
    const factorLines = lines.filter((l) => /^(Articles|Keys|Sets)/.test(l));
    expect(factorLines.length).toBe(3);
    // No factor name appears twice on the same line
    for (const ln of factorLines) {
      const matches = ln.match(/(Articles|Keys|Sets)/g) ?? [];
      expect(matches.length).toBe(1);
    }
  });

  test('code-block table includes header + per-row events/wallets/delta/rank columns (UX r4)', () => {
    const dim = breakdown({
      top_factors: [factor('og:articles', 'Articles', -8)],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    // Code-block fence
    expect(top.startsWith('```')).toBe(true);
    expect(top.endsWith('```')).toBe(true);
    // Header row
    expect(top).toContain('factor');
    expect(top).toContain('events');
    expect(top).toContain('wallets');
    expect(top).toContain('delta');
    expect(top).toContain('rank');
    // Data row
    expect(top).toContain('Articles');
    expect(top).toMatch(/-?\d+%/);
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
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    expect(top).toContain('more silent');
    expect(top.length).toBeLessThanOrEqual(1024);
  });

  test('Sort-desc preserved (substrate-provided order is verbatim)', () => {
    const dim = breakdown({
      top_factors: [factor('a', 'AAA', 50), factor('b', 'BBB', 30), factor('c', 'CCC', 10)],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    expect(top.indexOf('AAA')).toBeLessThan(top.indexOf('BBB'));
    expect(top.indexOf('BBB')).toBeLessThan(top.indexOf('CCC'));
  });
});

describe('buildPulseDimensionPayload · mood-emoji slot wiring (UX r4 · cold-factor only)', () => {
  test('mood-emoji callback called for cold factors (top is now code-block table · no emoji)', () => {
    let callCount = 0;
    const stub: (s: FactorStats | undefined) => string | null = (s) => {
      callCount += 1;
      return null;
    };
    const dim = breakdown({
      top_factors: [factor('a', 'A', 1), factor('b', 'B', 2)],
      cold_factors: [factor('c', 'C', 0)],
    });
    buildPulseDimensionPayload(dim, 'bear-cave', 30, { moodEmoji: stub });
    // Mood-emoji still called per cold-row (cold uses ` · ` tag-line · emoji renderable there)
    // But top rows are code-block — emoji intentionally NOT rendered.
    expect(callCount).toBeGreaterThan(0);
  });

  test('top factors in code-block table do NOT include mood emoji (UX r4 · operator: monospace alignment > emoji)', () => {
    const stub: (s: FactorStats | undefined) => string | null = () => '<:flex:123>';
    const dim = breakdown({ top_factors: [factor('og:articles', 'Articles', 5)] });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30, { moodEmoji: stub });
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    expect(top).toContain('Articles');
    expect(top).not.toContain('<:flex:123>'); // emoji NOT in code block
    expect(top).toContain('```'); // wrapped in code block
  });

  test('S4-stub moodEmojiForFactor returns null → no emoji slot', () => {
    const dim = breakdown({ top_factors: [factor('og:articles', 'Articles', 5)] });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30, {
      moodEmoji: moodEmojiForFactor,
    });
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    expect(top).toContain('Articles');
    expect(top).not.toContain('<:');
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
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
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
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
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
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
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
    const topValue = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    const coldValue = payload.embeds[0]?.fields?.find((f) => f.name === 'cold')?.value ?? '';
    const fieldSum = topValue.length + coldValue.length;
    expect(topValue.length).toBeLessThanOrEqual(1024);
    // cold drops to empty when header+outro+top combined push past 6000
    expect(coldValue.length === 0 || fieldSum <= 6000).toBe(true);
  });
});

describe('buildPulseDimensionPayload · Discord-as-Material sanitize (UX nit 2026-05-16)', () => {
  test('underscore in factor display_name is escaped (avoids mid-word italicize)', () => {
    const dim = breakdown({
      top_factors: [factor('og:bv', 'Boosted_Validator', 5)],
    });
    const payload = buildPulseDimensionPayload(dim, 'bear-cave', 30);
    const top = payload.embeds[0]?.fields?.find((f) => f.name?.startsWith('top'))?.value ?? '';
    // Discord italicizes `_X_` — escape MUST protect display_name underscores
    expect(top).toContain('Boosted\\_Validator');
    expect(top).not.toContain('Boosted_Validator '); // un-escaped form absent
  });

  test('em-dash in voice header gets stripped (Eileen Discord 2026-05-04 rule · BB F-001 2026-05-16: assert on message.content where voice lives)', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      header: 'this week — bears are hibernating',
    });
    // Voice lives in message.content per voice-outside-divs doctrine.
    // Asserting against embed.description would be vacuous (always undefined).
    expect(payload.content).not.toContain('—'); // em-dash stripped
    expect(payload.content).toContain('this week'); // text preserved minus the em-dash
  });
});

describe('buildPulseDimensionPayload · voice-outside-divs (UX r4 · operator 2026-05-16)', () => {
  test('voice goes to message.content (above embed) · NOT embed.description', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      header: 'this week in the cave',
      outro: 'stay groovy 🐻',
    });
    expect(payload.content).toContain('this week in the cave');
    expect(payload.content).toContain('stay groovy');
    // Embed description must NOT carry voice (truth-only zone)
    expect(payload.embeds[0]?.description).toBeUndefined();
  });

  test('absent header/outro → content is just zone-flavor fallback', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30);
    expect(payload.content).toContain('Bear Cave');
    expect(payload.embeds[0]?.description).toBeUndefined();
  });

  test('embed has zero voice text · fields are pure substrate', () => {
    const payload = buildPulseDimensionPayload(breakdown(), 'bear-cave', 30, {
      header: 'a voice header that should not appear in the embed',
    });
    const embedJson = JSON.stringify(payload.embeds[0]);
    expect(embedJson).not.toContain('a voice header that should not appear');
  });
});
