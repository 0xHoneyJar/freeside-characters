/**
 * Pulse renderer tests — cycle-021.
 *
 * Uses real shapes pulled from production smoke (see closure doc at
 * score-mibera/grimoires/loa/cycles/cycle-021-ruggy-pulse-mcp/closure.md).
 * Snapshot-style assertions on the rendered embed text so soju can eyeball
 * the layout without running anything.
 */

import { describe, it, expect } from 'vitest';
import { buildPulseDimensionPayload } from './embed.ts';
import type {
  GetDimensionBreakdownResponse,
  PulseDimensionBreakdown,
} from '../score/types.ts';

// ───── Real production shape (OG dim, window=30, smoked 2026-05-13) ─────

const OG_DIM: PulseDimensionBreakdown = {
  id: 'og',
  display_name: 'OG',
  total_events: 4,
  previous_period_events: 26,
  delta_pct: -84.6153846,
  delta_count: -22,
  inactive_factor_count: 3,
  total_factor_count: 5,
  top_factors: [
    {
      factor_id: 'og:articles',
      display_name: 'Articles',
      primary_action: null,
      total: 2,
      previous: 14,
      delta_pct: -85.7142857,
      delta_count: -12,
    },
    {
      factor_id: 'og:sets',
      display_name: 'Sets',
      primary_action: null,
      total: 2,
      previous: 12,
      delta_pct: -83.3333333,
      delta_count: -10,
    },
  ],
  cold_factors: [
    {
      factor_id: 'og:cfang_keys',
      display_name: 'CFang Keys',
      primary_action: null,
      total: 0,
      previous: 0,
      delta_pct: null,
      delta_count: 0,
    },
    {
      factor_id: 'og:cubquest',
      display_name: 'CubQuest',
      primary_action: null,
      total: 0,
      previous: 0,
      delta_pct: null,
      delta_count: 0,
    },
    {
      factor_id: 'og:jani_keys',
      display_name: 'Jani Keys',
      primary_action: null,
      total: 0,
      previous: 0,
      delta_pct: null,
      delta_count: 0,
    },
  ],
};

const OG_RESPONSE: GetDimensionBreakdownResponse = {
  dimensions: [OG_DIM],
  schema_version: '1.0.0',
  generated_at: '2026-05-13T22:14:36.831Z',
};

describe('buildPulseDimensionPayload — OG live data', () => {
  const payload = buildPulseDimensionPayload(OG_RESPONSE, OG_DIM, 30);
  const embed = payload.embeds[0];

  it('emits dimension color sidebar (gold for OG)', () => {
    expect(embed.color).toBe(0xc9a44c);
  });

  it('description has dim name + windowDays + lean hero line (no was-N, no diversity chip, no "vs prior" suffix)', () => {
    expect(embed.description).toContain('OG dimension · last 30 days');
    expect(embed.description).toContain('**4** events');
    expect(embed.description).toContain('↓-84.6%');
    // Intentionally NOT in the description — kept lean per operator review
    expect(embed.description).not.toContain('(was');
    expect(embed.description).not.toContain('factors active');
    expect(embed.description).not.toContain('vs prior');
  });

  it('Most active field has both top factors with deltas (no was-N suffix)', () => {
    const mostActive = embed.fields?.find((f) => f.name === 'Most active');
    expect(mostActive).toBeDefined();
    expect(mostActive?.value).toContain('Articles');
    expect(mostActive?.value).toContain('Sets');
    expect(mostActive?.value).toContain('↓-85.7%');
    expect(mostActive?.value).toContain('↓-83.3%');
    // Intentionally NOT in the per-factor row — kept lean per operator review
    expect(mostActive?.value).not.toContain('(was');
  });

  it('Went quiet field lists all 3 cold factors', () => {
    const coldField = embed.fields?.find((f) => f.name === 'Went quiet');
    expect(coldField).toBeDefined();
    expect(coldField?.value).toContain('CFang Keys');
    expect(coldField?.value).toContain('CubQuest');
    expect(coldField?.value).toContain('Jani Keys');
  });

  it('field names are bare (no "· last 7d" or "· active prior" suffixes)', () => {
    const names = embed.fields?.map((f) => f.name) ?? [];
    expect(names).toContain('Most active');
    expect(names).toContain('Went quiet');
  });

  it('does not emit a footer (intentionally minimal)', () => {
    expect(embed.footer).toBeUndefined();
  });

  it('plain-text fallback for embed-disabled clients', () => {
    expect(payload.content).toContain('OG');
    expect(payload.content).toContain('30d');
    expect(payload.content).toContain('4 events');
  });
});

describe('buildPulseDimensionPayload — empty cold list edge case', () => {
  const noCold: PulseDimensionBreakdown = { ...OG_DIM, cold_factors: [] };
  const payload = buildPulseDimensionPayload(
    { ...OG_RESPONSE, dimensions: [noCold] },
    noCold,
    30,
  );
  it('omits Went quiet field entirely when no cold factors', () => {
    expect(payload.embeds[0].fields?.find((f) => f.name.startsWith('Went quiet'))).toBeUndefined();
  });
});

describe('buildPulseDimensionPayload — empty top list edge case', () => {
  const noTop: PulseDimensionBreakdown = { ...OG_DIM, top_factors: [] };
  const payload = buildPulseDimensionPayload(
    { ...OG_RESPONSE, dimensions: [noTop] },
    noTop,
    30,
  );
  it('Most active field shows the empty-state copy', () => {
    const mostActive = payload.embeds[0].fields?.find((f) => f.name.startsWith('Most active'));
    expect(mostActive?.value).toBe('_no factor activity in this window_');
  });
});

describe('buildPulseDimensionPayload — full top_factors list (no truncation)', () => {
  // Onchain has 19 base factors max; verify all render without cap.
  const many: PulseDimensionBreakdown = {
    ...OG_DIM,
    top_factors: Array.from({ length: 19 }, (_, i) => ({
      factor_id: `onchain:fake_${i}`,
      display_name: `Fake ${i}`,
      primary_action: null,
      total: 100 - i,
      previous: 50,
      delta_pct: 100,
      delta_count: 50,
    })),
  };
  const payload = buildPulseDimensionPayload(
    { ...OG_RESPONSE, dimensions: [many] },
    many,
    30,
  );
  const mostActive = payload.embeds[0].fields?.find((f) => f.name.startsWith('Most active'));

  it('renders ALL 19 factors with no overflow truncation', () => {
    expect(mostActive?.value).toContain('Fake 0');
    expect(mostActive?.value).toContain('Fake 18');
    expect(mostActive?.value).not.toContain('more active factors');
  });

  it('field value stays under Discord 1024 char cap', () => {
    expect(mostActive?.value.length).toBeLessThan(1024);
  });
});

describe('buildPulseDimensionPayload — full cold list (no truncation)', () => {
  // Worst case: 19 cold factors (entire onchain dim went silent).
  const allCold: PulseDimensionBreakdown = {
    ...OG_DIM,
    top_factors: [],
    cold_factors: Array.from({ length: 19 }, (_, i) => ({
      factor_id: `onchain:cold_${i}`,
      display_name: `Cold Factor ${i}`,
      primary_action: `Did Cold Thing ${i}`,
      total: 0,
      previous: 0,
      delta_pct: null,
      delta_count: 0,
    })),
  };
  const payload = buildPulseDimensionPayload(
    { ...OG_RESPONSE, dimensions: [allCold] },
    allCold,
    30,
  );
  const cold = payload.embeds[0].fields?.find((f) => f.name.startsWith('Went quiet'));

  it('renders ALL 19 cold factors', () => {
    expect(cold?.value).toContain('Did Cold Thing 0');
    expect(cold?.value).toContain('Did Cold Thing 18');
  });

  it('field value stays under Discord 1024 char cap', () => {
    expect(cold?.value.length).toBeLessThan(1024);
  });
});

describe('buildPulseDimensionPayload — verb-form rendering when primary_action populated', () => {
  // Once score-mibera PR #112 deploys, primary_action will be populated
  // from PRIMARY_ACTION_MAP. This test uses the post-fix shape.
  const verbDim: PulseDimensionBreakdown = {
    ...OG_DIM,
    top_factors: [
      {
        factor_id: 'og:articles',
        display_name: 'Articles',
        primary_action: 'Minted Mirror Articles',
        total: 2,
        previous: 14,
        delta_pct: -85.7142857,
        delta_count: -12,
      },
      {
        factor_id: 'onchain:validator_booster',
        display_name: 'Validator',
        primary_action: 'Boosted Validator',
        total: 29,
        previous: 103,
        delta_pct: -71.84,
        delta_count: -74,
      },
    ],
  };
  const payload = buildPulseDimensionPayload(
    { ...OG_RESPONSE, dimensions: [verbDim] },
    verbDim,
    30,
  );
  const mostActive = payload.embeds[0].fields?.find((f) => f.name.startsWith('Most active'));

  it('uses primary_action verb form when present (not display_name noun)', () => {
    expect(mostActive?.value).toContain('Minted Mirror Articles');
    expect(mostActive?.value).toContain('Boosted Validator');
    // Should NOT show the noun fallback when verb is present
    expect(mostActive?.value).not.toMatch(/`Articles\s/);
    expect(mostActive?.value).not.toMatch(/`Validator\s/);
  });
});
