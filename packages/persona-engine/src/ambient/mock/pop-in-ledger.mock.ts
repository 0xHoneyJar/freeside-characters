import { Effect, Layer } from "effect";
import { PopInLedger } from "../ports/pop-in-ledger.port.ts";
import type { LedgerEntry } from "../domain/budgets.ts";

const _entries: Array<LedgerEntry> = [];

/** BB pass-5 F1 + F11: read-side lex-min collapse for same-ts fires.
 * Live + mock must agree on resolution strategy or tests written against
 * the mock won't catch the live duplicate-fire issue. */
function _collapseSameTsLexMin(
  entries: ReadonlyArray<LedgerEntry>,
): ReadonlyArray<LedgerEntry> {
  const fireKeyToLexMinCharId: Map<string, string> = new Map();
  for (const e of entries) {
    if (e.decision !== "fired" && e.decision !== "bypassed") continue;
    const key = `${e.zone}|${e.ts}`;
    const current = fireKeyToLexMinCharId.get(key);
    if (!current || e.character_id < current) {
      fireKeyToLexMinCharId.set(key, e.character_id);
    }
  }
  return entries.filter((e) => {
    if (e.decision !== "fired" && e.decision !== "bypassed") return true;
    const key = `${e.zone}|${e.ts}`;
    return fireKeyToLexMinCharId.get(key) === e.character_id;
  });
}

export function getMockLedgerEntries(): ReadonlyArray<LedgerEntry> {
  return _entries;
}

export function seedMockLedger(entries: ReadonlyArray<LedgerEntry>): void {
  _entries.length = 0;
  _entries.push(...entries);
}

export function resetMockLedger(): void {
  _entries.length = 0;
}

export const PopInLedgerMock = Layer.succeed(
  PopInLedger,
  PopInLedger.of({
    append: (entry) =>
      Effect.sync(() => {
        _entries.push(entry);
      }),

    getLastFire: ({ zone, afterTs }) =>
      Effect.sync(() => {
        const collapsed = _collapseSameTsLexMin(_entries);
        let best: LedgerEntry | null = null;
        for (const e of collapsed) {
          if (e.zone !== zone) continue;
          if (e.decision !== "fired") continue;
          if (e.ts < afterTs) continue;
          if (!best || e.ts > best.ts) best = e;
        }
        return best;
      }),

    readWindow: ({ zone, sinceTs, untilTs }) =>
      Effect.sync(() =>
        _collapseSameTsLexMin(_entries).filter(
          (e) =>
            (!zone || e.zone === zone) &&
            e.ts >= sinceTs &&
            e.ts <= untilTs,
        ),
      ),

    appendIfNoFire: ({ proposedEntry, afterTs }) =>
      Effect.sync(() => {
        const collapsed = _collapseSameTsLexMin(_entries);
        let blocker = null as typeof _entries[number] | null;
        for (const e of collapsed) {
          if (e.zone !== proposedEntry.zone) continue;
          if (e.decision !== "fired" && e.decision !== "bypassed") continue;
          if (e.ts <= afterTs) continue;
          if (e.ts > proposedEntry.ts) continue;
          if (e.character_id === proposedEntry.character_id) continue;
          if (!blocker || e.ts > blocker.ts) blocker = e;
        }
        if (blocker) {
          // BB pass-4 F7: lex-min character_id wins on exact-millisecond ties.
          const sameWallClock = blocker.ts === proposedEntry.ts;
          const proposerLexLess =
            proposedEntry.character_id < blocker.character_id;
          if (sameWallClock && proposerLexLess) {
            _entries.push({ ...proposedEntry, yielded_to: null });
            return { writtenAsProposed: true, yieldedTo: null };
          }
          _entries.push({
            ...proposedEntry,
            decision: "yielded_to_character",
            triggering_axis: null,
            yielded_to: blocker.character_id,
          });
          return { writtenAsProposed: false, yieldedTo: blocker.character_id };
        }
        _entries.push(proposedEntry);
        return { writtenAsProposed: true, yieldedTo: null };
      }),
  }),
);
