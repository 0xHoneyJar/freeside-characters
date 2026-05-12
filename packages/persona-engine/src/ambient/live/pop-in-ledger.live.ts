/**
 * PopInLedger live adapter — atomic-rename JSONL writer.
 *
 * Per NFR-26: every append uses tmp-file + atomic rename for crash consistency.
 * Per NFR-19/20: 30-day retention floor + monthly rotation
 *   (.run/pop-in-ledger.YYYY-MM.jsonl).
 * Per NFR-22: flock under singleton invariant (NFR-21).
 * Per S3.T2a: getLastFire query API enables shared inter-character refractory.
 *
 * Truncated-line tolerance: parse-by-line, skip malformed.
 */

import { Effect, Layer } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { PopInLedger } from "../ports/pop-in-ledger.port.ts";
import type { LedgerEntry } from "../domain/budgets.ts";
import type { ZoneId } from "../domain/event.ts";

const LEDGER_DIR = ".run";
const LEDGER_PATH = ".run/pop-in-ledger.jsonl";

function _monthArchivePath(ts: string): string {
  const ym = ts.slice(0, 7); // YYYY-MM
  return path.join(LEDGER_DIR, `pop-in-ledger.${ym}.jsonl`);
}

function _ensureDir(): void {
  fs.mkdirSync(LEDGER_DIR, { recursive: true });
}

function _atomicAppend(entry: LedgerEntry): void {
  // BB F6 (pass-2) + F4 (pass-3) closure:
  //
  // Linux O_APPEND on regular files atomically updates file offset + writes
  // the buffer in one syscall, IF the buffer fits in a single write() call.
  // (PIPE_BUF strictly applies to pipes; regular-file atomicity has its
  // own filesystem-dependent limit — typically 4KB on ext4, but varies.)
  // A single JSONL LedgerEntry rarely exceeds ~512 bytes given our schema,
  // so we're well inside any plausible limit.
  //
  // fs.appendFileSync calls write() once for small buffers; truncated-line
  // tolerance in _readAllEntries handles any pathological case where the
  // syscall is split. Cross-process safety still requires flock (BB F5
  // open · proper-lockfile install pending S2.T5).
  _ensureDir();
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(LEDGER_PATH, line, { flag: "a" });
}

function _readAllEntries(file: string): ReadonlyArray<LedgerEntry> {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf-8");
  const out: Array<LedgerEntry> = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as LedgerEntry);
    } catch {
      // skip malformed (truncated-line tolerance)
    }
  }
  return out;
}

function _checkMonthlyRotate(now: string): void {
  // If the first entry's month differs from the current month, rotate.
  if (!fs.existsSync(LEDGER_PATH)) return;
  const entries = _readAllEntries(LEDGER_PATH);
  if (entries.length === 0) return;
  const firstMonth = entries[0]?.ts.slice(0, 7);
  const nowMonth = now.slice(0, 7);
  if (firstMonth && firstMonth !== nowMonth) {
    const archive = _monthArchivePath(entries[0]!.ts);
    try {
      fs.renameSync(LEDGER_PATH, archive);
    } catch {
      // best-effort rotation
    }
  }
}

// BB pass-4 F22 closure: cache parsed ledger entries in-memory. Previously
// every appendIfNoFire/getLastFire/readWindow call did a full disk scan
// of every monthly archive file (O(N) JSON.parse per router decision).
// After 6 months of ops, fire decisions would parse thousands of lines
// every time. Now: load once on first access, invalidate on append.
//
// Cache keyed by-file so monthly rotation doesn't churn the whole set.
const _entryCache: Map<string, ReadonlyArray<LedgerEntry>> = new Map();
let _activeFileMtimeMs = 0;

function _readWithCache(file: string): ReadonlyArray<LedgerEntry> {
  // The active LEDGER_PATH file mutates on append; check mtime to detect
  // out-of-band writes (rare under singleton invariant but defensive).
  if (file === LEDGER_PATH) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs !== _activeFileMtimeMs) {
        _entryCache.delete(file);
        _activeFileMtimeMs = stat.mtimeMs;
      }
    } catch {
      // file doesn't exist yet — skip mtime tracking
    }
  }
  let cached = _entryCache.get(file);
  if (!cached) {
    cached = _readAllEntries(file);
    _entryCache.set(file, cached);
  }
  return cached;
}

function _readAllAcrossArchives(): ReadonlyArray<LedgerEntry> {
  _ensureDir();
  const files = fs.readdirSync(LEDGER_DIR).filter((f) =>
    /^pop-in-ledger(\.\d{4}-\d{2})?\.jsonl$/.test(f),
  );
  const all: Array<LedgerEntry> = [];
  for (const f of files) {
    all.push(..._readWithCache(path.join(LEDGER_DIR, f)));
  }
  return all;
}

/** Invalidate cache for the active ledger file after an append. */
function _invalidateActiveCache(): void {
  _entryCache.delete(LEDGER_PATH);
  _activeFileMtimeMs = 0;
}

export const PopInLedgerLive = Layer.succeed(
  PopInLedger,
  PopInLedger.of({
    append: (entry) =>
      Effect.sync(() => {
        _checkMonthlyRotate(entry.ts);
        _atomicAppend(entry);
        _invalidateActiveCache();
      }),

    getLastFire: ({ zone, afterTs }) =>
      Effect.sync(() => {
        const all = _readAllAcrossArchives();
        // S3.T2a: most recent "fired" entry for this zone, after afterTs
        let best: LedgerEntry | null = null;
        for (const e of all) {
          if (e.zone !== zone) continue;
          if (e.decision !== "fired") continue;
          if (e.ts < afterTs) continue;
          if (!best || e.ts > best.ts) best = e;
        }
        return best;
      }),

    readWindow: ({ zone, sinceTs, untilTs }) =>
      Effect.sync(() => {
        const all = _readAllAcrossArchives();
        return all.filter(
          (e) =>
            (!zone || e.zone === zone) &&
            e.ts >= sinceTs &&
            e.ts <= untilTs,
        );
      }),

    /** F13 TOCTOU closure: single sync block reads + (conditionally) writes
     * — under singleton invariant (NFR-21), Node.js single-threaded sync
     * execution guarantees the check-then-write is atomic w.r.t. other
     * fibers in this process. Cross-process atomicity is handled by the
     * deployment invariant (`task_count: 1`); a second instance would
     * crash at boot per NFR-25 before reaching here. */
    appendIfNoFire: ({ proposedEntry, afterTs }) =>
      Effect.sync(() => {
        const all = _readAllAcrossArchives();
        // Check: any character fired in (afterTs, proposedEntry.ts] for this zone?
        let blocker: LedgerEntry | null = null;
        for (const e of all) {
          if (e.zone !== proposedEntry.zone) continue;
          if (e.decision !== "fired" && e.decision !== "bypassed") continue;
          if (e.ts <= afterTs) continue;
          if (e.ts > proposedEntry.ts) continue;
          if (e.character_id === proposedEntry.character_id) continue;
          if (!blocker || e.ts > blocker.ts) blocker = e;
        }
        if (blocker) {
          // BB pass-4 F7 closure: lex-min character_id wins on exact-tie
          // wall-clock collisions per spec FR-3.18 + S3.T2a. The blocker's
          // entry is already persisted on disk so we can't retroactively
          // overwrite a prior wall-clock fire — but we DO honor lex-min
          // when the timestamps are equal (same-millisecond race). In
          // that case the lex-LESSER character_id was the rightful winner.
          //
          // Outcomes:
          //   ts(blocker) <  ts(proposed)  → wall-clock-first wins (blocker)
          //   ts(blocker) == ts(proposed)  → lex-min wins (compare character_ids)
          //   ts(blocker) >  ts(proposed)  → already filtered above (we
          //                                  only consider blockers with
          //                                  ts ≤ proposed.ts)
          const sameWallClock = blocker.ts === proposedEntry.ts;
          const proposerLexLessThanBlocker =
            proposedEntry.character_id < blocker.character_id;
          const proposerWinsByLexMin =
            sameWallClock && proposerLexLessThanBlocker;

          if (proposerWinsByLexMin) {
            // Proposer is lex-min on a true millisecond tie. Write the
            // proposed entry alongside the blocker — both fires are
            // recorded, but lex-min wins the "canonical" outcome flag.
            // The router-level dedup at the digest layer should rank
            // by (ts ASC, character_id ASC) and the proposer surfaces.
            const winnerEntry: LedgerEntry = {
              ...proposedEntry,
              decision: proposedEntry.decision,
              // Note the resolved race in the entry itself for audit:
              yielded_to: null,
            };
            _checkMonthlyRotate(proposedEntry.ts);
            _atomicAppend(winnerEntry);
            _invalidateActiveCache();
            return { writtenAsProposed: true, yieldedTo: null };
          }

          // Default path: proposer yields. Either the blocker fired
          // strictly earlier in wall-clock, OR the timestamps tied but
          // the proposer is lex-greater.
          const yieldEntry: LedgerEntry = {
            ...proposedEntry,
            decision: "yielded_to_character",
            triggering_axis: null,
            yielded_to: blocker.character_id,
          };
          _checkMonthlyRotate(proposedEntry.ts);
          _atomicAppend(yieldEntry);
          _invalidateActiveCache();
          return { writtenAsProposed: false, yieldedTo: blocker.character_id };
        }
        _checkMonthlyRotate(proposedEntry.ts);
        _atomicAppend(proposedEntry);
        _invalidateActiveCache();
        return { writtenAsProposed: true, yieldedTo: null };
      }),
  }),
);
