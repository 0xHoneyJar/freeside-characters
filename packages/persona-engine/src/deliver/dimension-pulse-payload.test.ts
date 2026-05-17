// cycle-007 S8 r4 · renderer unit tests · mirrors score-dashboard format

import { describe, expect, test } from 'bun:test';
import {
  buildDimensionPulseEmbed,
  buildDimensionPulsePayload,
  resolveFactorLabel,
  fmtDelta,
} from './dimension-pulse-payload.ts';
import type { PulseDimensionBreakdown, PulseDimensionFactor } from '../score/types.ts';

function factor(partial: Partial<PulseDimensionFactor>): PulseDimensionFactor {
  return {
    factor_id: 'og:sets',
    display_name: 'Sets',
    primary_action: 'Acquired Sets',
    total: 10,
    previous: 5,
    delta_pct: 100,
    delta_count: 5,
    ...partial,
  };
}

function breakdown(partial: Partial<PulseDimensionBreakdown> = {}): PulseDimensionBreakdown {
  return {
    id: 'og',
    display_name: 'OG',
    total_events: 152,
    previous_period_events: 141,
    delta_pct: 7.8,
    delta_count: 11,
    inactive_factor_count: 1,
    total_factor_count: 2,
    top_factors: [factor({ factor_id: 'og:sets', total: 152, previous: 140, delta_pct: 8.6, delta_count: 12 })],
    cold_factors: [],
    ...partial,
  };
}

const OPTS = {
  zone: 'bear-cave' as const,
  windowDays: 7 as const,
  generatedAt: '2026-05-17T00:00:00.000Z',
};

describe('resolveFactorLabel · primary_action > fallback table > display_name', () => {
  test('uses primary_action when set', () => {
    expect(resolveFactorLabel(factor({ primary_action: 'Custom Label' }))).toBe('Custom Label');
  });

  test('falls back to FACTOR_ACTION_LABELS when primary_action is null', () => {
    expect(
      resolveFactorLabel(factor({ factor_id: 'onchain:validator_booster', primary_action: null, display_name: 'Validator Booster' })),
    ).toBe('Boosted Validator');
  });

  test('last-resort to display_name', () => {
    expect(
      resolveFactorLabel(factor({ factor_id: 'unknown:never_mapped', primary_action: null, display_name: 'Unknown Factor' })),
    ).toBe('Unknown Factor');
  });
});

describe('fmtDelta · score-dashboard parity (dimension-card.tsx:61-64, 91-103)', () => {
  test('positive < 100% → 1 decimal with +', () => {
    expect(fmtDelta(7.8, 11)).toEqual({ sign: '↑', value: '+7.8%' });
  });
  test('positive ≥ 100% → integer with +', () => {
    expect(fmtDelta(520, 152)).toEqual({ sign: '↑', value: '+520%' });
  });
  test('negative < 100% → 1 decimal', () => {
    expect(fmtDelta(-5.2, -7)).toEqual({ sign: '↓', value: '-5.2%' });
  });
  test('zero → NEUTRAL sign + 0% (operator pushback 2026-05-17 · em-dash reads as negative-ish)', () => {
    // V2: drop sign entirely on zero · just visually flat "0%"
    expect(fmtDelta(0, 0)).toEqual({ sign: ' ', value: '0%' });
  });
  test('honest-delta: null pct + positive count → ±N events (no fake +100%)', () => {
    // Operator deviation from dashboard · Discord has no hover tooltip ·
    // ±N events is the readable answer when previous=0.
    expect(fmtDelta(null, 12)).toEqual({ sign: '↑', value: '+12' });
  });
  test('honest-delta: null pct + zero count → NEUTRAL + 0% (both periods empty · render as flat)', () => {
    expect(fmtDelta(null, 0)).toEqual({ sign: ' ', value: '0%' });
  });
  test('honest-delta: null pct + negative count → ↓ -N', () => {
    expect(fmtDelta(null, -3)).toEqual({ sign: '↓', value: '-3' });
  });
});

describe('buildDimensionPulseEmbed · single dim card', () => {
  test('title carries dimension name + delta · single space (V2 collapsed)', () => {
    const e = buildDimensionPulseEmbed(breakdown(), OPTS);
    expect(e.title).toBe('OG ↑ +7.8%');
  });

  test('description is hero number ONLY (V2 · subtitle moved to footer)', () => {
    const e = buildDimensionPulseEmbed(breakdown(), OPTS);
    expect(e.description).toBe('**152**');
  });

  test('footer carries subtitle: "events / Nd · X/Y factors · zone: Z"', () => {
    const e = buildDimensionPulseEmbed(breakdown(), OPTS);
    expect(e.footer!.text).toContain('events / 7d');
    expect(e.footer!.text).toContain('1/2 factors');
    expect(e.footer!.text).toContain('zone: bear-cave');
    // V2 default footer is simplistic · no date · no See-all
    expect(e.footer!.text).not.toContain('See all');
    expect(e.footer!.text).not.toContain('2026-05-17');
  });

  test('color is dashboard hex per dimension (#d6a83a OG / #7fdfe7 NFT / #5cce80 Onchain)', () => {
    expect(buildDimensionPulseEmbed(breakdown({ id: 'og' }), OPTS).color).toBe(0xd6a83a);
    expect(buildDimensionPulseEmbed(breakdown({ id: 'nft' }), OPTS).color).toBe(0x7fdfe7);
    expect(buildDimensionPulseEmbed(breakdown({ id: 'onchain' }), OPTS).color).toBe(0x5cce80);
  });

  test('empty top_factors renders "No activity in this window" exact string', () => {
    const e = buildDimensionPulseEmbed(breakdown({ top_factors: [] }), OPTS);
    expect(e.fields![0].value).toBe('No activity in this window');
  });

  test('cold section omitted when no cold factors', () => {
    const e = buildDimensionPulseEmbed(breakdown({ cold_factors: [] }), OPTS);
    expect(e.fields).toHaveLength(1);
    expect(e.fields![0].name).toBe('Most active this 7d');
  });

  test('cold section header matches dashboard "Went quiet · active prior, 0 this Nd"', () => {
    const e = buildDimensionPulseEmbed(
      breakdown({
        cold_factors: [factor({ factor_id: 'nft:fractures', primary_action: 'Minted Fractures', total: 0, previous: 1, delta_pct: null, delta_count: -1 })],
      }),
      OPTS,
    );
    expect(e.fields![1].name).toBe('Went quiet · active prior, 0 this 7d');
    expect(e.fields![1].value).toContain('Minted Fractures');
    expect(e.fields![1].value).toContain('was 1');
    expect(e.fields![1].value).toContain('cold');
  });

  test('top_factors sorted by total (caller-provided order preserved) · top-5 cap', () => {
    const tops = Array.from({ length: 8 }, (_, i) =>
      factor({
        factor_id: `og:f${i}`,
        primary_action: `Action ${i}`,
        total: 100 - i,
        previous: 50,
        delta_pct: ((100 - i) / 50 - 1) * 100,
        delta_count: 100 - i - 50,
      }),
    );
    const e = buildDimensionPulseEmbed(breakdown({ top_factors: tops, total_factor_count: 10 }), OPTS);
    // 5 lines in the code block (top 5)
    const lines = e.fields![0].value.replace(/```/g, '').trim().split('\n');
    expect(lines).toHaveLength(5);
    // V2 simplistic footer · See-all suppressed by default · subtitle present
    expect(e.footer!.text).toContain('events / 7d');
    expect(e.footer!.text).not.toContain('See all');
  });

  test('V2 simplistic footer is consistent regardless of factor count', () => {
    const e = buildDimensionPulseEmbed(
      breakdown({ total_factor_count: 1, inactive_factor_count: 0, top_factors: [factor({})] }),
      OPTS,
    );
    expect(e.footer!.text).not.toContain('See all');
    expect(e.footer!.text).toContain('events / 7d');
    expect(e.footer!.text).toContain('1/1 factors');
  });

  test('windowDays propagates into field name + footer (description is hero-only)', () => {
    const e30 = buildDimensionPulseEmbed(breakdown(), { ...OPTS, windowDays: 30 });
    expect(e30.fields![0].name).toBe('Most active this 30d');
    expect(e30.footer!.text).toContain('events / 30d');
    // Description is hero-only in V2 · no window subtitle
    expect(e30.description).toBe('**152**');
  });
});

describe('buildDimensionPulsePayload · multi-dim (stonehenge)', () => {
  test('renders one embed per breakdown in caller-supplied order', () => {
    const payload = buildDimensionPulsePayload(
      [
        breakdown({ id: 'og', display_name: 'OG' }),
        breakdown({ id: 'nft', display_name: 'NFT' }),
        breakdown({ id: 'onchain', display_name: 'Onchain' }),
      ],
      OPTS,
    );
    expect(payload.embeds).toHaveLength(3);
    expect(payload.embeds[0]!.title).toMatch(/^OG/);
    expect(payload.embeds[1]!.title).toMatch(/^NFT/);
    expect(payload.embeds[2]!.title).toMatch(/^Onchain/);
  });

  test('content is empty string · voiceless contract', () => {
    const payload = buildDimensionPulsePayload([breakdown()], OPTS);
    expect(payload.content).toBe('');
  });
});
