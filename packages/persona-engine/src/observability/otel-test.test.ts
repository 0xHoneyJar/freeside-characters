/**
 * OTEL memory-exporter test · cycle-005 S5 (sprint-11).
 *
 * Verifies AC-S5.1 + AC-S5.2 + AC-S5.3 + AC-S5.5: invoking
 * `composeDigestForZone` with the test tracer produces a `chat.invoke`
 * root span with named child spans (`compose.prose-gate`,
 * `compose.select-layout`, `compose.build-payload`) and emits the
 * `prose_gate.violation` event on the root span when the gate fires.
 *
 * Cardinality assertions cover NFR-4: pattern + reason are bounded
 * enums; factor_id is bounded by catalog size (verified by enum-shape
 * check, not by counting).
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { initOtelTest, resetOtelTest } from './otel-test.ts';
import { composeDigestForZone } from '../compose/digest.ts';
import type {
  FactorStats,
  PulseDimensionBreakdown,
  ZoneId,
} from '../score/types.ts';

function statsAt(rank: number, p99Reliable = true, p95Reliable = true): FactorStats {
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
        p95: { value: 45, reliable: p95Reliable },
        p99: { value: 130, reliable: p99Reliable },
      },
      current_percentile_rank: rank,
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

function dim(rank = 95): PulseDimensionBreakdown {
  return {
    id: 'og',
    display_name: 'OG',
    total_events: 100,
    previous_period_events: 80,
    delta_pct: 25,
    delta_count: 20,
    inactive_factor_count: 0,
    total_factor_count: 2,
    top_factors: [
      {
        factor_id: 'og:articles',
        display_name: 'Articles',
        primary_action: 'Mint',
        total: 50,
        previous: 30,
        delta_pct: 67,
        delta_count: 20,
        factor_stats: statsAt(rank),
      },
    ],
    cold_factors: [],
  };
}

let handle: ReturnType<typeof initOtelTest>;
beforeAll(() => {
  // Stable provider across the file — avoid the async shutdown race that
  // dropped spans when beforeEach re-registered each time.
  resetOtelTest();
  handle = initOtelTest();
});
beforeEach(() => {
  handle.reset(); // drop spans from prior test, keep provider stable
});
afterAll(() => {
  resetOtelTest();
});

describe('OTEL · chat.invoke span tree (AC-S5.1)', () => {
  test('composeDigestForZone emits chat.invoke root + 3 named children', () => {
    handle.reset();
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: dim(),
      allZones: new Map([
        ['bear-cave', dim(95)],
        ['el-dorado', dim(95)],
        ['owsley-lab', dim(95)],
        ['stonehenge', undefined],
      ]),
      voice: { header: 'this week', outro: 'stay groovy' },
      draft: 'the article minters had a good week',
      tracer: handle.tracer,
    });
    const spans = handle.getFinishedSpans();
    const names = spans.map((s) => s.name).sort();
    expect(names).toContain('chat.invoke');
    expect(names).toContain('compose.prose-gate');
    expect(names).toContain('compose.select-layout');
    expect(names).toContain('compose.build-payload');
  });

  test('child spans are descendants of chat.invoke', () => {
    handle.reset();
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: dim(),
      allZones: new Map([['bear-cave', dim(95)]]),
      voice: {},
      draft: 'a calm week',
      tracer: handle.tracer,
    });
    const spans = handle.getFinishedSpans();
    const root = spans.find((s) => s.name === 'chat.invoke');
    expect(root).toBeDefined();
    const rootContext = root!.spanContext();
    const children = spans.filter((s) => s.parentSpanContext?.spanId === rootContext.spanId);
    expect(children.length).toBeGreaterThanOrEqual(3);
  });
});

describe('OTEL · prose_gate.violation event (AC-S5.3)', () => {
  test('gate fires → root chat.invoke span carries prose_gate.violation event', () => {
    handle.reset();
    // Draft contains "structural shift" + factor in proximity; mechanical
    // check triggers because rank=50 < 90 threshold for structural-shift rule.
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: {
        ...dim(50),
        top_factors: [
          {
            factor_id: 'og:articles',
            display_name: 'Articles',
            primary_action: 'Mint',
            total: 10,
            previous: 8,
            delta_pct: 25,
            delta_count: 2,
            factor_stats: statsAt(50), // rank 50 < 90 → structural-shift fires
          },
        ],
      },
      allZones: new Map([['bear-cave', dim(50)]]),
      voice: {},
      draft: 'Articles is in a structural shift this week',
      tracer: handle.tracer,
    });
    const spans = handle.getFinishedSpans();
    const root = spans.find((s) => s.name === 'chat.invoke');
    expect(root).toBeDefined();
    const violationEvents = root!.events.filter((e) => e.name === 'prose_gate.violation');
    expect(violationEvents.length).toBeGreaterThanOrEqual(1);
    const attrs = violationEvents[0]!.attributes ?? {};
    expect(attrs['pattern']).toBe('structural-shift');
    expect(attrs['reason']).toBe('rank-below-threshold');
    expect(attrs['character_id']).toBe('ruggy');
    expect(attrs['mode']).toBe('log');
    expect(typeof attrs['draft_hash']).toBe('string');
    expect((attrs['draft_hash'] as string).length).toBe(8);
  });

  test('no gate violations → no prose_gate.violation event', () => {
    handle.reset();
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: dim(95),
      allZones: new Map([['bear-cave', dim(95)]]),
      voice: {},
      draft: 'a perfectly clean draft about nothing in particular',
      tracer: handle.tracer,
    });
    const root = handle.getFinishedSpans().find((s) => s.name === 'chat.invoke');
    expect(root).toBeDefined();
    expect(root!.events.filter((e) => e.name === 'prose_gate.violation').length).toBe(0);
  });
});

describe('OTEL · cardinality bounds (AC-S5.5 NFR-4)', () => {
  test('prose_gate.violation attributes use bounded enums (pattern + reason)', () => {
    handle.reset();
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: {
        ...dim(50),
        top_factors: [
          {
            factor_id: 'og:articles',
            display_name: 'Articles',
            primary_action: 'Mint',
            total: 10,
            previous: 8,
            delta_pct: 25,
            delta_count: 2,
            factor_stats: statsAt(50),
          },
        ],
      },
      allZones: new Map([['bear-cave', dim(50)]]),
      voice: {},
      draft: 'Articles is in a structural shift this week with coordinated cluster',
      tracer: handle.tracer,
    });
    const root = handle.getFinishedSpans().find((s) => s.name === 'chat.invoke')!;
    const events = root.events.filter((e) => e.name === 'prose_gate.violation');
    const validPatterns = new Set(['cluster-claim', 'p99-rare', 'structural-shift']);
    const validReasons = new Set([
      'cohort-singleton',
      'percentile-unreliable',
      'rank-below-threshold',
      'rank-null',
      'no-factor-context',
    ]);
    for (const e of events) {
      const attrs = e.attributes ?? {};
      expect(validPatterns.has(attrs['pattern'] as string)).toBe(true);
      expect(validReasons.has(attrs['reason'] as string)).toBe(true);
    }
  });

  test('full draft text does NOT appear in any span attribute (NFR-3 telemetry hygiene)', () => {
    handle.reset();
    const sensitiveDraft = 'a secret-looking draft with structural shift in it';
    composeDigestForZone({
      zone: 'bear-cave',
      dimension: {
        ...dim(50),
        top_factors: [
          {
            factor_id: 'og:articles',
            display_name: 'Articles',
            primary_action: 'Mint',
            total: 10,
            previous: 8,
            delta_pct: 25,
            delta_count: 2,
            factor_stats: statsAt(50),
          },
        ],
      },
      allZones: new Map([['bear-cave', dim(50)]]),
      voice: {},
      draft: sensitiveDraft,
      tracer: handle.tracer,
    });
    const allSpans = handle.getFinishedSpans();
    for (const s of allSpans) {
      const serialized = JSON.stringify({
        attrs: s.attributes,
        events: s.events.map((e) => ({ name: e.name, attrs: e.attributes })),
      });
      // The full draft text must not leak into telemetry
      expect(serialized).not.toContain('secret-looking');
    }
  });
});

describe('OTEL · mode-aware behavior (AC-S5.2 + skip/silence routing)', () => {
  test('mode=skip + HIGH violation → payload null + zone_post_skipped event', () => {
    process.env.PROSE_GATE_ON_VIOLATION = 'skip';
    handle.reset();
    const result = composeDigestForZone({
      zone: 'bear-cave',
      dimension: {
        ...dim(50),
        top_factors: [
          {
            factor_id: 'og:articles',
            display_name: 'Articles',
            primary_action: 'Mint',
            total: 10,
            previous: 8,
            delta_pct: 25,
            delta_count: 2,
            factor_stats: statsAt(50),
          },
        ],
      },
      allZones: new Map([['bear-cave', dim(50)]]),
      voice: {},
      draft: 'Articles structural shift this week',
      tracer: handle.tracer,
    });
    expect(result.payload).toBeNull();
    expect(result.mode).toBe('skip');
    const root = handle.getFinishedSpans().find((s) => s.name === 'chat.invoke')!;
    expect(root.events.some((e) => e.name === 'prose_gate.zone_post_skipped')).toBe(true);
    delete process.env.PROSE_GATE_ON_VIOLATION;
  });

  test('mode=silence + HIGH violation → shape A forced + shape_a_fallback event', () => {
    process.env.PROSE_GATE_ON_VIOLATION = 'silence';
    handle.reset();
    // For shape_a_fallback to fire, NATURAL shape must NOT be A. So set up
    // 2+ zones with permittedClaims (rank≥90 + p95.reliable=true) → C natural.
    // Compose dimension has a low-rank factor so structural-shift gate fires.
    const composeDim = {
      ...dim(50),
      top_factors: [
        {
          factor_id: 'og:articles',
          display_name: 'Articles',
          primary_action: 'Mint',
          total: 10,
          previous: 8,
          delta_pct: 25,
          delta_count: 2,
          factor_stats: statsAt(50),
        },
      ],
    };
    const result = composeDigestForZone({
      zone: 'bear-cave',
      dimension: composeDim,
      allZones: new Map([
        ['bear-cave', dim(95)], // permitted=1 (rank=95 + p95.reliable=true)
        ['el-dorado', dim(95)], // permitted=1 → 2 total → natural shape C
      ]),
      voice: {},
      draft: 'Articles structural shift',
      tracer: handle.tracer,
    });
    expect(result.shape).toBe('A-all-quiet');
    const root = handle.getFinishedSpans().find((s) => s.name === 'chat.invoke')!;
    expect(root.events.some((e) => e.name === 'prose_gate.shape_a_fallback')).toBe(true);
    delete process.env.PROSE_GATE_ON_VIOLATION;
  });
});

describe('OTEL · V1 contract — text byte-identical (AC-S5.3 + G-4)', () => {
  test('payload content reflects voice surface; draft text not embedded in payload', () => {
    handle.reset();
    const draft = 'a draft we never want leaked into the payload';
    const result = composeDigestForZone({
      zone: 'bear-cave',
      dimension: dim(95),
      allZones: new Map([['bear-cave', dim(95)]]),
      voice: { header: 'voice header', outro: 'voice outro' },
      draft,
      tracer: handle.tracer,
    });
    expect(result.payload).not.toBeNull();
    expect(JSON.stringify(result.payload)).not.toContain('never want leaked');
  });
});
