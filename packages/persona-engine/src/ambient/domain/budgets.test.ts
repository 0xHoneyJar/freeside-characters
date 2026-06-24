// cycle-008 capability-wiring slice 2a · the firing-gate's budget builder, unit-tested in
// isolation (it's greenfield logic the router depends on — correctness is load-bearing).

import { describe, expect, test } from 'bun:test';
import { budgetFromLedger } from './budgets.ts';
import type { LedgerEntry } from './budgets.ts';

const NOW = '2026-05-23T12:00:00.000Z';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  ts: '2026-05-23T10:00:00.000Z',
  zone: 'owsley-lab',
  character_id: 'ruggy',
  decision: 'fired',
  triggering_axis: 'press',
  event_class: null,
  event_id: null,
  yielded_to: null,
  ...over,
});

describe('budgetFromLedger (cycle-008 slice 2a)', () => {
  test('empty ledger → no last fire, zero count, defaults', () => {
    const b = budgetFromLedger('owsley-lab', [], NOW);
    expect(b.last_fire_at).toBeNull();
    expect(b.last_fire_character_id).toBeNull();
    expect(b.today_fire_count).toBe(0);
    expect(b.today_utc_date).toBe('2026-05-23');
    expect(b.refractory_hours).toBe(4);
    expect(b.daily_cap).toBe(3);
  });

  test('counts fired + bypassed today; ignores suppressed/capped/queued/yielded', () => {
    const b = budgetFromLedger(
      'owsley-lab',
      [
        entry({ decision: 'fired', ts: '2026-05-23T08:00:00.000Z' }),
        entry({ decision: 'bypassed', ts: '2026-05-23T09:00:00.000Z' }),
        entry({ decision: 'suppressed', ts: '2026-05-23T09:30:00.000Z' }),
        entry({ decision: 'capped', ts: '2026-05-23T09:40:00.000Z' }),
        entry({ decision: 'queued', ts: '2026-05-23T09:50:00.000Z' }),
        entry({ decision: 'yielded_to_character', ts: '2026-05-23T09:55:00.000Z' }),
      ],
      NOW,
    );
    expect(b.today_fire_count).toBe(2);
  });

  test('last_fire is the most recent fired/bypassed, cross-character (D17)', () => {
    const b = budgetFromLedger(
      'owsley-lab',
      [
        entry({ ts: '2026-05-23T08:00:00.000Z', character_id: 'ruggy' }),
        entry({ ts: '2026-05-23T11:30:00.000Z', character_id: 'satoshi', decision: 'bypassed' }),
        entry({ ts: '2026-05-23T11:00:00.000Z', character_id: 'ruggy' }),
      ],
      NOW,
    );
    expect(b.last_fire_at).toBe('2026-05-23T11:30:00.000Z');
    expect(b.last_fire_character_id).toBe('satoshi');
  });

  test('ignores entries from other zones', () => {
    const b = budgetFromLedger('owsley-lab', [entry({ zone: 'bear-cave', ts: '2026-05-23T11:00:00.000Z' })], NOW);
    expect(b.today_fire_count).toBe(0);
    expect(b.last_fire_at).toBeNull();
  });

  test("yesterday's fire feeds last_fire (refractory) but NOT today_fire_count (calendar cap)", () => {
    const b = budgetFromLedger('owsley-lab', [entry({ ts: '2026-05-22T23:00:00.000Z' })], NOW);
    expect(b.today_fire_count).toBe(0);
    expect(b.last_fire_at).toBe('2026-05-22T23:00:00.000Z');
  });

  test('opts override refractoryHours + dailyCap', () => {
    const b = budgetFromLedger('owsley-lab', [], NOW, { refractoryHours: 6, dailyCap: 5 });
    expect(b.refractory_hours).toBe(6);
    expect(b.daily_cap).toBe(5);
  });
});
