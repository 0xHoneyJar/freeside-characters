// cycle-006 S6 T6.5 + T6.10 tests · voice-memory.live.
// Covers AC-RT-001 (path-traversal allowlist), FLATLINE-SKP-001/850 (mutex
// cleanup), FLATLINE-SKP-004 (retention TTL + forget-user).

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVoiceMemoryLive } from './voice-memory.live.ts';
import {
  VOICE_MEMORY_SCHEMA_VERSION,
  type VoiceMemoryEntry,
} from '../domain/voice-memory-entry.ts';

let testDir: string;
let basePath: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'voice-memory-test-'));
  basePath = join(testDir, 'voice-memory');
});

afterEach(() => {
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
});

function entryOf(overrides: Partial<VoiceMemoryEntry> = {}): VoiceMemoryEntry {
  return {
    schema_version: VOICE_MEMORY_SCHEMA_VERSION,
    at: '2026-05-15T12:00:00.000Z',
    stream: 'digest',
    key: 'stonehenge',
    header: 'header line',
    outro: 'outro line',
    key_numbers: { total_events: 100, permitted_factor_names: ['mint'] },
    use_label: 'background_only',
    expiry: '2026-08-15T12:00:00.000Z', // 90+ days from at
    signed_by: 'agent:claude',
    ...overrides,
  };
}

describe('voice-memory.live · AC-RT-001 path-traversal defense', () => {
  test('appendEntry with valid stream + key succeeds', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    const result = await vm.appendEntry('digest', entryOf());
    expect(result).toEqual({ ok: true });
  });

  test('readRecent throws on stream value bypassing TS union (cast)', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vm.readRecent('../etc' as any, 'stonehenge'),
    ).rejects.toThrow(/invalid stream/);
  });

  test('readRecent throws on path-traversal in key', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    await expect(vm.readRecent('digest', '../../etc/passwd')).rejects.toThrow(/invalid key/);
  });

  test('appendEntry rejects on invalid stream (layered defense: F-001 mismatch guard fires first)', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    // After BB F-001 fix: the stream-mismatch guard catches 'not_a_stream' as
    // param vs 'digest' as entry.stream BEFORE pathFor's allowlist throw fires.
    // Both layers defend; the earlier one wins. Return-shape rejection rather
    // than throw — this is correct layered defense, not a regression.
    const result = await vm.appendEntry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'not_a_stream' as any,
      entryOf(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either stream-mismatch (param vs entry.stream) OR pathFor's invalid-stream
      // throw — both are valid rejections; the test asserts one of them fires.
      expect(result.reason).toMatch(/stream-mismatch|invalid stream/);
    }
  });

  test('appendEntry layered defense: Zod schema catches invalid stream first', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    // When entry.stream is not in the StreamName enum, Zod's safeParse fails
    // BEFORE the mismatch guard or pathFor's allowlist throw fire. Three-layer
    // defense: schema (first) → mismatch guard (second) → pathFor (third).
    const result = await vm.appendEntry(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'not_a_stream' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entryOf({ stream: 'not_a_stream' as any }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/schema validation failed|stream-mismatch|invalid stream/);
    }
  });

  test('pathFor throws directly on invalid stream (still active third-layer defense)', async () => {
    // Direct readRecent (no schema/mismatch path) → pathFor allowlist fires.
    const vm = createVoiceMemoryLive({ basePath });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vm.readRecent('not_a_stream' as any, 'stonehenge'),
    ).rejects.toThrow(/invalid stream/);
  });
});

describe('voice-memory.live · BB F-001 stream-mismatch guard', () => {
  test('appendEntry rejects when stream param ≠ entry.stream', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    // Entry claims stream='callout' but caller passes stream='digest' —
    // would silently write to digest path while payload says callout.
    const result = await vm.appendEntry(
      'digest',
      entryOf({ stream: 'callout', key: 'stonehenge:trigger123' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/stream-mismatch/);
      expect(result.reason).toContain('param="digest"');
      expect(result.reason).toContain('entry.stream="callout"');
    }
  });

  test('appendEntry accepts when stream param === entry.stream', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    const result = await vm.appendEntry('digest', entryOf({ stream: 'digest' }));
    expect(result.ok).toBe(true);
  });
});

describe('voice-memory.live · schema validation', () => {
  test('appendEntry rejects entry with invalid schema_version', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    const result = await vm.appendEntry('digest', entryOf({ schema_version: '2.0.0' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('schema validation failed');
    }
  });

  test('appendEntry rejects entry with too-long header', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    const result = await vm.appendEntry('digest', entryOf({ header: 'x'.repeat(300) }));
    expect(result.ok).toBe(false);
  });

  test('readRecent skips malformed JSON lines silently', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    await vm.appendEntry('digest', entryOf());
    // Manually corrupt the file.
    const path = join(basePath, 'digest', 'stonehenge.jsonl');
    const existing = readFileSync(path, 'utf-8');
    require('node:fs').writeFileSync(path, existing + 'not-json-at-all\n');
    const entries = await vm.readRecent('digest', 'stonehenge', 5);
    // Should return the valid entry, skipping the malformed line.
    expect(entries.length).toBe(1);
  });
});

describe('voice-memory.live · FLATLINE-SKP-004 retention TTL', () => {
  test('readRecent skips expired entries', async () => {
    const vm = createVoiceMemoryLive({ basePath, clock: () => new Date('2026-09-01T00:00:00.000Z') });
    await vm.appendEntry('digest', entryOf({ expiry: '2026-08-15T12:00:00.000Z' })); // expired
    await vm.appendEntry('digest', entryOf({ expiry: '2026-12-31T00:00:00.000Z' })); // valid
    const entries = await vm.readRecent('digest', 'stonehenge', 5);
    expect(entries.length).toBe(1);
    expect(entries[0]!.expiry).toBe('2026-12-31T00:00:00.000Z');
  });
});

describe('voice-memory.live · forgetUser (per-user deletion)', () => {
  test('removes all entries with matching user_id across streams', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    // 3 entries across 2 streams · 2 with user_id "alice", 1 with "bob"
    await vm.appendEntry('chat-reply', entryOf({ stream: 'chat-reply', key: 'g:c:alice', user_id: 'alice' }));
    await vm.appendEntry('chat-reply', entryOf({ stream: 'chat-reply', key: 'g:c2:alice', user_id: 'alice' }));
    await vm.appendEntry('chat-reply', entryOf({ stream: 'chat-reply', key: 'g:c:bob', user_id: 'bob' }));

    const removed = await vm.forgetUser('alice');
    expect(removed).toBe(2);

    // Bob's entry survives.
    const bobEntries = await vm.readRecent('chat-reply', 'g:c:bob');
    expect(bobEntries.length).toBe(1);
    expect(bobEntries[0]!.user_id).toBe('bob');

    // Audit log written.
    const auditPath = join(basePath, '..', 'voice-memory-deletions.jsonl');
    expect(existsSync(auditPath)).toBe(true);
    const auditLine = readFileSync(auditPath, 'utf-8').trim();
    expect(auditLine).toContain('"user_id":"alice"');
    expect(auditLine).toContain('"removed_count":2');
  });

  test('forgetUser rejects invalid userId (path-traversal defense)', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    await expect(vm.forgetUser('../etc/passwd')).rejects.toThrow(/invalid userId/);
  });

  test('forgetUser returns 0 when no entries match', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    await vm.appendEntry('digest', entryOf({ user_id: 'alice' }));
    const removed = await vm.forgetUser('eve');
    expect(removed).toBe(0);
  });
});

describe('voice-memory.live · mutex cleanup (SKP-001/850)', () => {
  test('concurrent writes to same key serialize without leak', async () => {
    const vm = createVoiceMemoryLive({ basePath });
    const writes = Array.from({ length: 10 }, (_, i) =>
      vm.appendEntry('digest', entryOf({ header: `entry ${i}` })),
    );
    const results = await Promise.all(writes);
    expect(results.every((r) => r.ok)).toBe(true);
    const entries = await vm.readRecent('digest', 'stonehenge', 20);
    expect(entries.length).toBe(10);
  });
});
