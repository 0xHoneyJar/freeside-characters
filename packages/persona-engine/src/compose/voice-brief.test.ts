/**
 * voice-brief tests · cycle-005 T2.4 (authored 2026-05-16).
 *
 * Verifies the system + user prompt construction for shape A (the
 * dominant real-world case) and shape B/C licensed paths.
 */

import { describe, test, expect } from 'bun:test';
import { buildVoiceBrief, parseVoiceResponse } from './voice-brief.ts';
import type { FactorStats } from '../score/types.ts';

function stats(rank: number): FactorStats {
  return {
    history: { active_days: 100, last_active_date: '2026-05-10', stale: false, no_data: false, sufficiency: { p50: true, p90: true, p99: true } },
    occurrence: { active_day_frequency: 0.3, current_is_active: true },
    magnitude: {
      event_count: 5,
      percentiles: {
        p10: { value: 1, reliable: true }, p25: { value: 2, reliable: true }, p50: { value: 4, reliable: true },
        p75: { value: 10, reliable: true }, p90: { value: 23, reliable: true }, p95: { value: 45, reliable: true }, p99: { value: 130, reliable: true },
      },
      current_percentile_rank: rank,
    },
    cohort: {
      unique_actors: 7,
      percentiles: {
        p10: { value: 1, reliable: true }, p25: { value: 1, reliable: true }, p50: { value: 2, reliable: true },
        p75: { value: 5, reliable: true }, p90: { value: 11, reliable: true }, p95: { value: 22, reliable: true }, p99: { value: 81, reliable: true },
      },
      current_percentile_rank: 50,
    },
    cadence: { days_since_last_active: 0, median_active_day_gap_days: 1, current_gap_percentile_rank: 50 },
  };
}

describe('buildVoiceBrief · shape A (all-quiet · the dominant case)', () => {
  test('shape-A system prompt names ruggy + zone + voice rules', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'A-all-quiet',
      isNoClaimVariant: false,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 4,
      windowDays: 30,
      previousPeriodEvents: 26,
    });
    expect(brief.system).toContain('you are ruggy');
    expect(brief.system).toContain('bear-cave');
    expect(brief.system).toContain('lowercase');
    // Per operator doctrine 2026-05-16: negation rules removed from prompt.
    // (mentioning artifacts in the prompt teaches the LLM they're in scope.)
    // The substrate's sanitize.ts::stripVoiceDisciplineDrift is the regex
    // backstop. Prompt stays positive — assert the voice-shape we DO want.
    expect(brief.system).toContain('warm and grounded');
    expect(brief.system).toContain('character first');
  });

  test('shape-A user prompt names the quiet + provides previous-period context', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'A-all-quiet',
      isNoClaimVariant: false,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 4,
      windowDays: 30,
      previousPeriodEvents: 26,
    });
    expect(brief.user).toContain('ALL QUIET');
    expect(brief.user).toContain('4 events');
    expect(brief.user).toContain('30 days');
    expect(brief.user).toContain('26 events'); // previous period
    expect(brief.user).toContain('must NOT');
    expect(brief.user).toContain('invent activity');
  });

  test('shape-A guidance includes evocative atmosphere prompts (bears sleeping)', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'A-all-quiet',
      isNoClaimVariant: false,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 0,
      windowDays: 30,
      previousPeriodEvents: 0,
    });
    expect(brief.user).toMatch(/bears.*sleeping|honey.*brewing/i);
  });
});

describe('buildVoiceBrief · shape B/C (licensed narration)', () => {
  test('shape-B user prompt lists permitted factors with axes', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'B-one-dim-hot',
      isNoClaimVariant: false,
      permittedFactors: [{ display_name: 'Articles', stats: stats(96) }],
      silencedFactors: [],
      totalEvents: 100,
      windowDays: 30,
      previousPeriodEvents: 50,
    });
    expect(brief.user).toContain('ONE DIM HOT');
    expect(brief.user).toContain('Articles');
    expect(brief.user).toContain('rank 96');
    expect(brief.user).toContain('7 actors'); // cohort.unique_actors
    expect(brief.user).toContain('100 active days');
  });

  test('shape-C user prompt names silenced factors with reasons (DO NOT NARRATE)', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'C-multi-dim-hot',
      isNoClaimVariant: false,
      permittedFactors: [{ display_name: 'Articles', stats: stats(96) }],
      silencedFactors: [{ display_name: 'Keys', reason: 'cohort-singleton' }],
      totalEvents: 200,
      windowDays: 30,
      previousPeriodEvents: 100,
    });
    expect(brief.user).toContain('MULTI DIM HOT');
    expect(brief.user).toContain('Keys');
    expect(brief.user).toContain('cohort-singleton');
    expect(brief.user).toContain('DO NOT NARRATE');
  });

  test('NO-CLAIM variant routes to shape-A guidance even though shape is C', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'C-multi-dim-hot',
      isNoClaimVariant: true, // <-- key flag
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 5,
      windowDays: 30,
      previousPeriodEvents: 2,
    });
    expect(brief.user).toContain('ALL QUIET'); // shape A treatment
    expect(brief.user).not.toContain('LICENSED factors');
  });
});

describe('parseVoiceResponse', () => {
  test('parses clean JSON', () => {
    const r = parseVoiceResponse('{"header": "hi from the cave", "outro": "stay groovy"}');
    expect(r.header).toBe('hi from the cave');
    expect(r.outro).toBe('stay groovy');
  });

  test('strips markdown fence around JSON', () => {
    const r = parseVoiceResponse('```json\n{"header": "h", "outro": "o"}\n```');
    expect(r.header).toBe('h');
    expect(r.outro).toBe('o');
  });

  test('falls back to two-line split on plain text', () => {
    const r = parseVoiceResponse('first line is the header\nsecond line is the outro');
    expect(r.header).toBe('first line is the header');
    expect(r.outro).toBe('second line is the outro');
  });

  test('handles single-line response (header only)', () => {
    const r = parseVoiceResponse('one line only');
    expect(r.header).toBe('one line only');
    expect(r.outro).toBe('');
  });

  test('returns empty on completely malformed input', () => {
    const r = parseVoiceResponse('');
    expect(r.header).toBe('');
    expect(r.outro).toBe('');
  });
});
