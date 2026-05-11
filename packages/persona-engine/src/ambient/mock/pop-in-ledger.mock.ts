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
  }),
);
