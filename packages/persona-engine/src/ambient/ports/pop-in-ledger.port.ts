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

export interface AppendIfNoFireParams {
  readonly proposedEntry: LedgerEntry;
  /** Lower bound for the check-side search window
   * — typically `now - refractory_hours`. */
  readonly afterTs: string;
}

export interface AppendIfNoFireResult {
  /** True if the proposedEntry's decision was written verbatim.
   * False if another character fired in the window and a
   * yielded_to_character entry was written instead. */
  readonly writtenAsProposed: boolean;
  /** When `writtenAsProposed` is false, this names the character_id
   * that holds the window. Null otherwise. */
  readonly yieldedTo: string | null;
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

    /** F13 TOCTOU closure: atomic check-then-write under a single
     * flock-acquired critical section. If another character has a "fired"
     * entry within (afterTs, now] for the same zone, this character
     * yields — a "yielded_to_character" entry is written in place of the
     * proposedEntry. Otherwise proposedEntry is written verbatim.
     *
     * Caller still does refractory + daily-cap checks (those are
     * character-local; only the inter-character race needs atomicity).
     * Lex-min character_id wins ties for fairness/determinism. */
    readonly appendIfNoFire: (
      params: AppendIfNoFireParams,
    ) => Effect.Effect<AppendIfNoFireResult, PopInLedgerError>;
  }
>() {}
