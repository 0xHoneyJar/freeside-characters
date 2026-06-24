/**
 * voice-brief continuity tests · cycle-005 latitude-grant 2026-05-16.
 *
 * Verifies cross-week memory threads into the user prompt when
 * `priorWeekHint` is supplied, and stays absent otherwise.
 */

import { describe, test, expect } from 'bun:test';
import { buildVoiceBrief } from './voice-brief.ts';

describe('buildVoiceBrief · cross-week continuity', () => {
  test('omits continuity block when priorWeekHint absent', () => {
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
    expect(brief.user).not.toContain('continuity context');
    expect(brief.user).not.toContain('thread continuity');
  });

  test('includes continuity block + MAY-thread instruction when priorWeekHint present', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'A-all-quiet',
      isNoClaimVariant: false,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 4,
      windowDays: 30,
      previousPeriodEvents: 26,
      priorWeekHint:
        'last week (2026-W19 · shape A): said "the bears nap" over 26 events',
    });
    expect(brief.user).toContain('continuity context:');
    expect(brief.user).toContain('the bears nap');
    expect(brief.user).toContain('MAY thread continuity');
    expect(brief.user).toContain('do NOT mechanically copy');
  });

  test('continuity block works on shape C too (not just shape A)', () => {
    const brief = buildVoiceBrief({
      zone: 'bear-cave',
      shape: 'C-multi-dim-hot',
      isNoClaimVariant: false,
      permittedFactors: [],
      silencedFactors: [],
      totalEvents: 200,
      windowDays: 30,
      previousPeriodEvents: 100,
      priorWeekHint: 'last week (2026-W19 · shape A): said "the bears nap" over 26 events',
    });
    expect(brief.user).toContain('MULTI DIM HOT');
    expect(brief.user).toContain('continuity context');
  });
});
