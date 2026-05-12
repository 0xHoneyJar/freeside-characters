import { Effect, Layer } from "effect";
import { PopInLedger } from "../ports/pop-in-ledger.port.ts";
import type { LedgerEntry } from "../domain/budgets.ts";

const _entries: Array<LedgerEntry> = [];

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
        let best: LedgerEntry | null = null;
        for (const e of _entries) {
          if (e.zone !== zone) continue;
          if (e.decision !== "fired") continue;
          if (e.ts < afterTs) continue;
          if (!best || e.ts > best.ts) best = e;
        }
        return best;
      }),

    readWindow: ({ zone, sinceTs, untilTs }) =>
      Effect.sync(() =>
        _entries.filter(
          (e) =>
            (!zone || e.zone === zone) &&
            e.ts >= sinceTs &&
            e.ts <= untilTs,
        ),
      ),

    appendIfNoFire: ({ proposedEntry, afterTs }) =>
      Effect.sync(() => {
        let blocker = null as typeof _entries[number] | null;
        for (const e of _entries) {
          if (e.zone !== proposedEntry.zone) continue;
          if (e.decision !== "fired" && e.decision !== "bypassed") continue;
          if (e.ts <= afterTs) continue;
          if (e.ts > proposedEntry.ts) continue;
          if (e.character_id === proposedEntry.character_id) continue;
          if (!blocker || e.ts > blocker.ts) blocker = e;
        }
        if (blocker) {
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
