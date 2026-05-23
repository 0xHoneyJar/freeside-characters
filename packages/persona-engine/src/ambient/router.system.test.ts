// cycle-008 capability-wiring slice 2a · baseline for routerDecide (the fire-decision the stir
// tier now consumes). Previously ZERO tests existed for the router — this establishes the gate's
// contract: per-axis OR-gate thresholds, daily-cap, refractory, and class-A stochastic bypass.

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { routerDecide } from './router.system.ts';
import { emptyStir } from './domain/pulse.ts';
import { budgetFromLedger } from './domain/budgets.ts';
import type { LedgerEntry } from './domain/budgets.ts';
import { GRAVITY_CLASSES } from './domain/event.ts';
import type { MiberaEvent } from './domain/event.ts';

const NOW = '2026-05-23T12:00:00.000Z';
const ZONE = 'owsley-lab' as const;

const stir = (over: Partial<ReturnType<typeof emptyStir>> = {}) => ({ ...emptyStir(ZONE, NOW), ...over });
const gravityStir = () => {
  const s = emptyStir(ZONE, NOW);
  return { ...s, gravity: { ...s.gravity, last_significant_event_within_window: true } };
};

const firedAt = (ts: string): LedgerEntry => ({
  ts,
  zone: ZONE,
  character_id: 'ruggy',
  decision: 'fired',
  triggering_axis: 'press',
  event_class: null,
  event_id: null,
  yielded_to: null,
});

const decide = (over: Partial<Parameters<typeof routerDecide>[0]>) =>
  Effect.runSync(
    routerDecide({
      zone: ZONE,
      characterId: 'ruggy',
      stir: stir(),
      latestEvent: null,
      budget: budgetFromLedger(ZONE, [], NOW),
      now: NOW,
      ...over,
    }),
  );

describe('routerDecide (cycle-008 slice 2a baseline)', () => {
  test('fires when press crosses its threshold', () => {
    const d = decide({ stir: stir({ press: 0.6 }) }); // default press threshold 0.55
    expect(d.shouldFire).toBe(true);
    expect(d.triggeringAxis).toBe('press');
    expect(d.entry.decision).toBe('fired');
  });

  test('fires on the strangers axis (OR-gate, not a single scalar)', () => {
    const d = decide({ stir: stir({ strangers: 0.5 }) }); // default strangers threshold 0.45
    expect(d.shouldFire).toBe(true);
    expect(d.triggeringAxis).toBe('strangers');
  });

  test('fires on the gravity flag (transient significant event in window)', () => {
    const d = decide({ stir: gravityStir() });
    expect(d.shouldFire).toBe(true);
    expect(d.triggeringAxis).toBe('gravity');
  });

  test('suppresses when every axis sits below threshold (silence register)', () => {
    const d = decide({ stir: stir() }); // fresh = all at floor
    expect(d.shouldFire).toBe(false);
    expect(d.entry.decision).toBe('suppressed');
  });

  test('daily cap exhausted → capped, never fires even with a hot stir', () => {
    const capped = budgetFromLedger(
      ZONE,
      [firedAt('2026-05-23T06:00:00.000Z'), firedAt('2026-05-23T08:00:00.000Z'), firedAt('2026-05-23T10:00:00.000Z')],
      NOW,
    ); // 3 fires today == default daily cap
    const d = decide({ stir: stir({ press: 0.9 }), budget: capped });
    expect(d.shouldFire).toBe(false);
    expect(d.entry.decision).toBe('capped');
  });

  test('within refractory → suppressed even with a hot stir (no class-A)', () => {
    const refractory = budgetFromLedger(ZONE, [firedAt('2026-05-23T11:00:00.000Z')], NOW); // 1h ago < 4h
    const d = decide({ stir: stir({ press: 0.9 }), budget: refractory });
    expect(d.shouldFire).toBe(false);
    expect(d.entry.decision).toBe('suppressed');
  });

  test('class-A gravity event bypasses the threshold on a winning roll', () => {
    const gravityEvent = { id: 'evt-1', event_class: GRAVITY_CLASSES[0] } as unknown as MiberaEvent;
    const d = decide({ stir: stir(), latestEvent: gravityEvent, rng: () => 0.1 }); // < 0.7 bypass prob
    expect(d.shouldFire).toBe(true);
    expect(d.entry.decision).toBe('bypassed');
    expect(d.triggeringAxis).toBe('gravity');
  });

  test('class-A gravity event during refractory → queued (late_felt candidate), no fire', () => {
    const gravityEvent = { id: 'evt-2', event_class: GRAVITY_CLASSES[0] } as unknown as MiberaEvent;
    const refractory = budgetFromLedger(ZONE, [firedAt('2026-05-23T11:00:00.000Z')], NOW);
    const d = decide({ stir: stir(), latestEvent: gravityEvent, budget: refractory, rng: () => 0.1 });
    expect(d.shouldFire).toBe(false);
    expect(d.entry.decision).toBe('queued');
  });
});
