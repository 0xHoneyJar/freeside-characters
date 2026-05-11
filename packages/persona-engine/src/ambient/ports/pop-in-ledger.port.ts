/**
 * PopInLedger port — append-only ledger of router decisions.
 *
 * Per OSTROM (D14–D19, ratified pair-point 3):
 *   - every router decision writes a ledger entry (NFR-18 observability)
 *   - shared inter-character refractory queries the ledger (D17 + S3.T2a)
 *   - 30-day retention floor (NFR-19); monthly rotation (NFR-20)
 *   - atomic tmp-file + rename per append (NFR-26)
 *
 * S3.T2a NEW: `getLastFire({zone, after_ts})` — the shared-refractory
 * query API that the router uses to enforce inter-character coord
 * (lex-min character_id wins per Flatline SPRINT SKP-001 860 closure).
 */

import { Context, Effect } from "effect";
import type { ZoneId } from "../domain/event.ts";
import type { LedgerEntry } from "../domain/budgets.ts";

export interface PopInLedgerError {
  readonly _tag: "PopInLedgerError";
  readonly message: string;
}

export interface GetLastFireParams {
  readonly zone: ZoneId;
  /** Lower bound for the search window — typically `now - refractory_hours`. */
  readonly afterTs: string;
}

export class PopInLedger extends Context.Tag("ambient/PopInLedger")<
  PopInLedger,
  {
    /** Atomic append (tmp-file + rename · NFR-26) under flock (NFR-22). */
    readonly append: (
      entry: LedgerEntry,
    ) => Effect.Effect<void, PopInLedgerError>;

    /** S3.T2a · shared inter-character refractory query.
     *
     * Returns the most recent `decision === "fired"` entry in the given
     * zone, across ALL characters, after `afterTs`. Returns null if no
     * character fired in the window. The router uses this BEFORE checking
     * its own character's refractory; if any character fired, this
     * character yields (writes `decision: "yielded_to_character"` entry). */
    readonly getLastFire: (
      params: GetLastFireParams,
    ) => Effect.Effect<LedgerEntry | null, PopInLedgerError>;

    /** Read entries in a window. Used by S4 (14-day inter-character
     * non-coincidence assertion · PRD §6.4 S4 verification). */
    readonly readWindow: (params: {
      zone?: ZoneId;
      sinceTs: string;
      untilTs: string;
    }) => Effect.Effect<ReadonlyArray<LedgerEntry>, PopInLedgerError>;
  }
>() {}
