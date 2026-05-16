// cycle-006 S6 T6.6 · in-memory voice-memory mock for orchestrator tests.

import type {
  VoiceMemoryPort,
  VoiceMemoryWriteResult,
  StreamName,
  VoiceMemoryEntry,
} from '../ports/voice-memory.port.ts';

export interface VoiceMemoryMock extends VoiceMemoryPort {
  /** Per-(stream, key) entries; newest last. Test introspection. */
  readonly entries: Map<string, VoiceMemoryEntry[]>;
  /** Test fixture seed — populate entries before a test invocation. */
  readonly seed: (stream: StreamName, key: string, entries: VoiceMemoryEntry[]) => void;
  /** Append-call log for orchestrator-write verification. */
  readonly appendCalls: Array<{ stream: StreamName; entry: VoiceMemoryEntry }>;
  /** Read-call log for orchestrator-read verification. */
  readonly readCalls: Array<{ stream: StreamName; key: string; limit: number }>;
}

function lockKey(stream: StreamName, key: string): string {
  return `${stream}::${key}`;
}

export function createVoiceMemoryMock(): VoiceMemoryMock {
  const entries = new Map<string, VoiceMemoryEntry[]>();
  const appendCalls: Array<{ stream: StreamName; entry: VoiceMemoryEntry }> = [];
  const readCalls: Array<{ stream: StreamName; key: string; limit: number }> = [];

  return {
    entries,
    appendCalls,
    readCalls,

    seed(stream, key, fixtures) {
      entries.set(lockKey(stream, key), [...fixtures]);
    },

    async readRecent(stream, key, limit = 1) {
      readCalls.push({ stream, key, limit });
      const all = entries.get(lockKey(stream, key)) ?? [];
      // Newest first, sliced to limit.
      return all.slice(-limit).reverse();
    },

    async appendEntry(stream, entry): Promise<VoiceMemoryWriteResult> {
      appendCalls.push({ stream, entry });
      const k = lockKey(stream, entry.key);
      const existing = entries.get(k) ?? [];
      entries.set(k, [...existing, entry]);
      return { ok: true };
    },

    async forgetUser(userId) {
      let removed = 0;
      for (const [k, list] of entries.entries()) {
        const kept = list.filter((e) => e.user_id !== userId);
        removed += list.length - kept.length;
        entries.set(k, kept);
      }
      return removed;
    },
  };
}
