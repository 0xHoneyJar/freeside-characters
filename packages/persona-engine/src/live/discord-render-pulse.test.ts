// cycle-006 S7 T7.1 tests · renderActivityPulse + shortenWallet per PRD FR-7.

import { describe, test, expect } from 'bun:test';
import { presentation, renderActivityPulse, shortenWallet } from './discord-render.live.ts';
import type { ActivityPulse } from '../domain/activity-pulse.ts';

import type { RecentEventRow, PulseDimension } from '../score/types.ts';

function eventOf(
  wallet: string,
  description: string,
  factor = 'mint',
  dimension: PulseDimension = 'og',
  ts = '2026-05-15T12:00:00Z',
): RecentEventRow {
  return {
    event_id: `evt-${wallet}-${ts}`,
    factor_id: 'f_mint',
    category_key: 'mint',
    raw_value: 1,
    raw_value_kind: 'count',
    wallet,
    description,
    factor_display_name: factor,
    dimension,
    timestamp: ts,
  } as RecentEventRow;
}

describe('shortenWallet · PRD FR-7 format', () => {
  test('full 0xN+ hex wallet → 0xXXXX…YYYY (first-4 + last-4)', () => {
    expect(shortenWallet('0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4bc8')).toBe('0xe6a2…4bc8');
  });

  test('short non-hex string passes through unchanged', () => {
    expect(shortenWallet('soju')).toBe('soju');
  });

  test('empty string passes through', () => {
    expect(shortenWallet('')).toBe('');
  });

  test('long opaque ID gets shortened defensively', () => {
    expect(shortenWallet('aaaaaaaaaaaaaaaaaa')).toBe('aaaaaa…aaaa');
  });

  test('0x-prefix without enough hex falls to passthrough', () => {
    expect(shortenWallet('0x12')).toBe('0x12');
  });
});

describe('renderActivityPulse · PRD FR-7 format', () => {
  test('empty events → ledger message', () => {
    const pulse: ActivityPulse = { generatedAt: 'x', events: [] };
    expect(renderActivityPulse(pulse).content).toBe('no recent events in the ledger.');
  });

  test('one event → 2 lines (wallet + meta)', () => {
    const pulse: ActivityPulse = {
      generatedAt: 'x',
      events: [eventOf('0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4bc8', 'minted a thing')],
    };
    const out = renderActivityPulse(pulse);
    const lines = out.content.split('\n');
    expect(lines[0]).toContain('0xe6a2…4bc8 →');
    expect(lines[0]).toContain('minted a thing');
    expect(lines[1]).toContain('mint · og ·');
  });

  test('multiple events separated by blank line', () => {
    const pulse: ActivityPulse = {
      generatedAt: 'x',
      events: [
        eventOf('0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4bc8', 'minted A'),
        eventOf('0xf1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e80000', 'minted B'),
      ],
    };
    const out = renderActivityPulse(pulse);
    // 2 events × 2 lines = 4 lines + 1 blank separator
    expect(out.content.split('\n').length).toBe(5);
    expect(out.content).toMatch(/minted A\n.+\n\n.+minted B/);
  });

  test('caps at 10 events per post (PULSE_DEFAULT_EVENT_COUNT)', () => {
    const pulse: ActivityPulse = {
      generatedAt: 'x',
      events: Array.from({ length: 15 }, (_, i) => eventOf(`0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4b${String(i).padStart(2, '0')}`, `event ${i}`)),
    };
    const out = renderActivityPulse(pulse);
    // 10 events × 2 lines = 20 lines (plus 9 blank separators → joined via '\n\n')
    // Count "event N" mentions — should be exactly 10.
    expect((out.content.match(/event \d+/g) ?? []).length).toBe(10);
  });

  test('truncation appends ellipsis when content exceeds cap', () => {
    const longDesc = 'x'.repeat(2000);
    const pulse: ActivityPulse = {
      generatedAt: 'x',
      events: Array.from({ length: 10 }, () => eventOf('0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4bc8', longDesc)),
    };
    const out = renderActivityPulse(pulse);
    expect(out.content.length).toBeLessThanOrEqual(3700 + 5); // cap + "\n\n…"
    expect(out.content.endsWith('…')).toBe(true);
  });

  test('missing description falls back to placeholder', () => {
    const pulse: ActivityPulse = {
      generatedAt: 'x',
      events: [eventOf('0xe6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f4bc8', undefined as unknown as string)],
    };
    expect(renderActivityPulse(pulse).content).toContain('(no description)');
  });

  test('presentation.renderActivityPulse is the same function', () => {
    expect(presentation.renderActivityPulse).toBe(renderActivityPulse);
  });
});
