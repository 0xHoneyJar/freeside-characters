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
  _ensureDir();
  const line = JSON.stringify(entry) + "\n";
  const tmpPath = `${LEDGER_PATH}.tmp.${process.pid}.${Date.now()}`;
  const existing = fs.existsSync(LEDGER_PATH)
    ? fs.readFileSync(LEDGER_PATH, "utf-8")
    : "";
  fs.writeFileSync(tmpPath, existing + line);
  fs.renameSync(tmpPath, LEDGER_PATH);
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

function _readAllAcrossArchives(): ReadonlyArray<LedgerEntry> {
  _ensureDir();
  const files = fs.readdirSync(LEDGER_DIR).filter((f) =>
    /^pop-in-ledger(\.\d{4}-\d{2})?\.jsonl$/.test(f),
  );
  const all: Array<LedgerEntry> = [];
  for (const f of files) {
    all.push(..._readAllEntries(path.join(LEDGER_DIR, f)));
  }
  return all;
}

export const PopInLedgerLive = Layer.succeed(
  PopInLedger,
  PopInLedger.of({
    append: (entry) =>
      Effect.sync(() => {
        _checkMonthlyRotate(entry.ts);
        _atomicAppend(entry);
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
  }),
);
