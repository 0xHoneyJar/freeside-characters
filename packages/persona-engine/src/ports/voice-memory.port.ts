// cycle-006 S6 T6.4 · voice-memory port.

import type { StreamName, VoiceMemoryEntry } from '../domain/voice-memory-entry.ts';

export type { StreamName, VoiceMemoryEntry };

export type VoiceMemoryWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export interface VoiceMemoryPort {
  /**
   * Read the most-recent entries for a stream/key combination, newest first.
   * Returns at most `limit` entries (default 1). Malformed lines are skipped
   * with a warn-log; never throws on corrupted data.
   */
  readonly readRecent: (
    stream: StreamName,
    key: string,
    limit?: number,
  ) => Promise<ReadonlyArray<VoiceMemoryEntry>>;
  /**
   * Append a new entry. Validates via Zod; rejects malformed entries with
   * structured { ok: false, reason }. Acquires per-key mutex to serialize
   * concurrent writes within a single process.
   */
  readonly appendEntry: (
    stream: StreamName,
    entry: VoiceMemoryEntry,
  ) => Promise<VoiceMemoryWriteResult>;
  /**
   * cycle-006 S6 T6.10 · per-user retention deletion (FLATLINE-SKP-004).
   * Removes all entries where entry.user_id === userId across all streams.
   * Returns the count of deletions; logs audit entry to
   * `.run/voice-memory-deletions.jsonl`.
   */
  readonly forgetUser: (userId: string) => Promise<number>;
}
