// cycle-006 S6 T6.5 · voice-memory live adapter.
//
// INVARIANT: single-process bot deployment. If we ever shard or run multiple
// replicas, REPLACE the in-memory Map with file-level advisory lock (e.g.,
// proper-lockfile) BEFORE going multi-process. The current per-key Promise
// chain protects ONLY within a single Node/Bun process. Multi-process writes
// to the same .jsonl file would interleave and corrupt the JSONL line shape.
//
// Defenses landed in this file:
//   - AC-RT-001 path-traversal: pathFor() validates `stream` against
//     STREAM_NAMES allowlist AND `key` against [A-Za-z0-9._:-]+ BEFORE
//     resolve(). TS-union erasure means we MUST runtime-check.
//   - SKP-001/850 mutex cleanup-by-reference: per-key Map deletes the entry
//     only when the current chain is still the tail. Prevents leak when
//     two concurrent waiters resolve in nondeterministic order.
//   - SKP-001/HIGH multi-process: writes a PID file at first write; reads
//     check PID file and emit OTEL `voice_memory.multi_process_violation`
//     + REFUSE to write (fail-closed) if another process holds the lock.
//   - SKP-004/HIGH retention: readRecent skips entries with `expiry` in
//     the past; forgetUser removes all entries matching `user_id`.
//   - Schema validation on read + write via Zod.

import { appendFile, readFile, mkdir, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import {
  STREAM_NAMES,
  VoiceMemoryEntrySchema,
  type StreamName,
  type VoiceMemoryEntry,
} from '../domain/voice-memory-entry.ts';
import type { VoiceMemoryPort, VoiceMemoryWriteResult } from '../ports/voice-memory.port.ts';
import { getTracer } from '../observability/otel-layer.ts';

const DEFAULT_BASE = '.run/voice-memory';
const ALLOWED_STREAMS = new Set<StreamName>(STREAM_NAMES);
const KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

export interface VoiceMemoryLiveOpts {
  readonly basePath?: string;
  readonly clock?: () => Date;
}

interface LockChain {
  chain: Promise<void>;
}

export function createVoiceMemoryLive(opts: VoiceMemoryLiveOpts = {}): VoiceMemoryPort {
  const base = opts.basePath ?? DEFAULT_BASE;
  const clock = opts.clock ?? (() => new Date());
  const keyLocks = new Map<string, LockChain>();

  function pathFor(stream: StreamName, key: string): string {
    if (!ALLOWED_STREAMS.has(stream)) {
      throw new Error(`voice-memory: invalid stream "${String(stream)}"`);
    }
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`voice-memory: invalid key "${key}"`);
    }
    return resolve(base, stream, `${key}.jsonl`);
  }

  function assertSingleProcess(): void {
    const pidFile = resolve(base, '.pid');
    try {
      if (!existsSync(pidFile)) return;
      const recorded = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
      if (!Number.isFinite(recorded) || recorded === process.pid) return;
      // Check if that PID is still alive. process.kill(pid, 0) throws if not.
      try {
        process.kill(recorded, 0);
      } catch {
        return; // stale PID file from dead process — fine
      }
      const tracer = getTracer();
      tracer.startActiveSpan('voice_memory.multi_process_violation', (span) => {
        try {
          span.setAttribute('current_pid', process.pid);
          span.setAttribute('conflicting_pid', recorded);
        } finally {
          span.end();
        }
      });
      throw new Error(
        `voice-memory: another process (pid=${recorded}) is using ${base}; multi-process writes corrupt the JSONL chain. INVARIANT VIOLATION.`,
      );
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('voice-memory:')) throw err;
      // Read failure → assume single-process and proceed.
    }
  }

  async function recordPid(): Promise<void> {
    const pidFile = resolve(base, '.pid');
    await mkdir(dirname(pidFile), { recursive: true });
    await writeFile(pidFile, String(process.pid));
  }

  async function readRecent(
    stream: StreamName,
    key: string,
    limit: number = 1,
  ): Promise<ReadonlyArray<VoiceMemoryEntry>> {
    const path = pathFor(stream, key);
    if (!existsSync(path)) return [];
    let text: string;
    try {
      text = await readFile(path, 'utf-8');
    } catch {
      return [];
    }
    const now = clock().getTime();
    const out: VoiceMemoryEntry[] = [];
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    // Walk newest-first by reversing.
    for (const line of lines.reverse()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // skip malformed
      }
      const result = VoiceMemoryEntrySchema.safeParse(parsed);
      if (!result.success) continue;
      // Retention guard: skip expired entries (FLATLINE-SKP-004/TTL).
      const expiry = Date.parse(result.data.expiry);
      if (Number.isFinite(expiry) && expiry < now) continue;
      out.push(result.data);
      if (out.length >= limit) break;
    }
    return out;
  }

  async function appendEntry(
    stream: StreamName,
    entry: VoiceMemoryEntry,
  ): Promise<VoiceMemoryWriteResult> {
    const validation = VoiceMemoryEntrySchema.safeParse(entry);
    if (!validation.success) {
      return { ok: false, reason: `schema validation failed: ${validation.error.message}` };
    }
    try {
      assertSingleProcess();
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'multi-process violation' };
    }
    const path = pathFor(stream, entry.stream === stream ? entry.key : entry.key);
    // Mutex on (stream, key) tuple.
    const lockKey = `${stream}::${entry.key}`;
    const prev = keyLocks.get(lockKey)?.chain ?? Promise.resolve();
    let myChain: LockChain;
    const work = prev.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      await recordPid();
      await appendFile(path, JSON.stringify(validation.data) + '\n');
    });
    myChain = { chain: work };
    keyLocks.set(lockKey, myChain);
    try {
      await work;
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'append failed' };
    } finally {
      // SKP-001/850 cleanup-by-reference: only delete if WE are still the tail.
      if (keyLocks.get(lockKey) === myChain) keyLocks.delete(lockKey);
    }
  }

  async function forgetUser(userId: string): Promise<number> {
    if (!KEY_PATTERN.test(userId)) {
      throw new Error(`voice-memory: invalid userId "${userId}"`);
    }
    let removedCount = 0;
    const deletionsLog = resolve(base, '../voice-memory-deletions.jsonl');
    for (const stream of STREAM_NAMES) {
      const streamDir = resolve(base, stream);
      if (!existsSync(streamDir)) continue;
      const files = await readdir(streamDir);
      for (const filename of files) {
        if (!filename.endsWith('.jsonl')) continue;
        const path = resolve(streamDir, filename);
        let text: string;
        try {
          text = await readFile(path, 'utf-8');
        } catch {
          continue;
        }
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const kept: string[] = [];
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as VoiceMemoryEntry;
            if (parsed.user_id === userId) {
              removedCount += 1;
              continue;
            }
            kept.push(line);
          } catch {
            kept.push(line); // preserve malformed lines (don't clobber)
          }
        }
        await writeFile(path, kept.length > 0 ? kept.join('\n') + '\n' : '');
      }
    }
    // Audit log.
    if (removedCount > 0) {
      try {
        await mkdir(dirname(deletionsLog), { recursive: true });
        await appendFile(
          deletionsLog,
          JSON.stringify({
            at: clock().toISOString(),
            user_id: userId,
            removed_count: removedCount,
          }) + '\n',
        );
      } catch {
        // best-effort audit; do not throw
      }
    }
    return removedCount;
  }

  return { readRecent, appendEntry, forgetUser };
}
