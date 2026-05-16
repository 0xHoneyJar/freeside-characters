/**
 * voice-memory tests · cycle-005 latitude-grant work 2026-05-16.
 *
 * Verifies append-only JSONL roundtrip + iso-week computation + tail-scan
 * for last entry per zone + best-effort error handling.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendVoiceMemory,
  readLastVoiceMemory,
  formatPriorWeekHint,
  isoWeek,
  type VoiceMemoryEntry,
} from './voice-memory.ts';

let tmpDir = '';
let historyPath = '';

function freshEntry(over: Partial<VoiceMemoryEntry> = {}): VoiceMemoryEntry {
  return {
    at: '2026-05-16T00:00:00Z',
    iso_week: '2026-W20',
    zone: 'bear-cave',
    shape: 'A-all-quiet',
    header: 'four events. the bears nap.',
    outro: 'the honey brews slow.',
    key_numbers: {
      total_events: 4,
      previous_period_events: 26,
      permitted_factor_names: [],
    },
    ...over,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'voice-memory-'));
  historyPath = join(tmpDir, 'history.jsonl');
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe('isoWeek', () => {
  test('returns YYYY-Www format', () => {
    const w = isoWeek(new Date('2026-05-16T00:00:00Z'));
    expect(w).toMatch(/^\d{4}-W\d{2}$/);
  });

  test('week padded to 2 digits', () => {
    const w = isoWeek(new Date('2026-01-08T00:00:00Z')); // week 2
    expect(w).toBe('2026-W02');
  });
});

describe('appendVoiceMemory + readLastVoiceMemory', () => {
  test('roundtrip: append + read returns same entry', async () => {
    const e = freshEntry();
    const result = await appendVoiceMemory(e, { path: historyPath });
    expect(result.ok).toBe(true);
    const read = await readLastVoiceMemory('bear-cave', { path: historyPath });
    expect(read).toEqual(e);
  });

  test('read returns null when history file does not exist', async () => {
    const read = await readLastVoiceMemory('bear-cave', { path: join(tmpDir, 'missing.jsonl') });
    expect(read).toBeNull();
  });

  test('read returns null when no entry for that zone', async () => {
    await appendVoiceMemory(freshEntry({ zone: 'el-dorado' }), { path: historyPath });
    const read = await readLastVoiceMemory('bear-cave', { path: historyPath });
    expect(read).toBeNull();
  });

  test('read returns MOST RECENT entry for zone (multi-week history)', async () => {
    await appendVoiceMemory(
      freshEntry({ iso_week: '2026-W18', header: 'old' }),
      { path: historyPath },
    );
    await appendVoiceMemory(
      freshEntry({ iso_week: '2026-W19', header: 'middle' }),
      { path: historyPath },
    );
    await appendVoiceMemory(
      freshEntry({ iso_week: '2026-W20', header: 'newest' }),
      { path: historyPath },
    );
    const read = await readLastVoiceMemory('bear-cave', { path: historyPath });
    expect(read?.header).toBe('newest');
  });

  test('read skips malformed lines and returns nearest valid', async () => {
    // Append valid entry, then a malformed line, then another valid
    await appendVoiceMemory(
      freshEntry({ iso_week: '2026-W18', header: 'first' }),
      { path: historyPath },
    );
    // Inject a malformed line directly
    const { appendFile } = await import('node:fs/promises');
    await appendFile(historyPath, '{not json at all\n', 'utf8');
    await appendVoiceMemory(
      freshEntry({ iso_week: '2026-W19', header: 'after garbage' }),
      { path: historyPath },
    );
    const read = await readLastVoiceMemory('bear-cave', { path: historyPath });
    expect(read?.header).toBe('after garbage');
  });

  test('multi-zone history reads correct zone', async () => {
    await appendVoiceMemory(
      freshEntry({ zone: 'bear-cave', header: 'cave' }),
      { path: historyPath },
    );
    await appendVoiceMemory(
      freshEntry({ zone: 'el-dorado', header: 'dorado' }),
      { path: historyPath },
    );
    await appendVoiceMemory(
      freshEntry({ zone: 'owsley-lab', header: 'lab' }),
      { path: historyPath },
    );
    expect((await readLastVoiceMemory('bear-cave', { path: historyPath }))?.header).toBe('cave');
    expect((await readLastVoiceMemory('el-dorado', { path: historyPath }))?.header).toBe('dorado');
    expect((await readLastVoiceMemory('owsley-lab', { path: historyPath }))?.header).toBe('lab');
  });
});

describe('formatPriorWeekHint', () => {
  test('compact single-line format with iso week + shape + header + events', () => {
    const hint = formatPriorWeekHint(freshEntry());
    expect(hint).toContain('2026-W20');
    expect(hint).toContain('shape A');
    expect(hint).toContain('the bears nap');
    expect(hint).toContain('4 events');
  });

  test('includes permitted factor names when present', () => {
    const e = freshEntry({
      key_numbers: {
        total_events: 100,
        previous_period_events: 50,
        permitted_factor_names: ['Articles', 'Keys'],
      },
    });
    const hint = formatPriorWeekHint(e);
    expect(hint).toContain('Articles');
    expect(hint).toContain('Keys');
  });

  test('omits names block when permitted_factor_names empty', () => {
    const hint = formatPriorWeekHint(freshEntry());
    expect(hint).not.toContain('names');
  });
});
