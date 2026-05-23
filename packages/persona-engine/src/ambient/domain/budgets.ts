/**
 * Budgets domain — refractory + daily cap + inter-character coordination.
 *
 * Per OSTROM (D14–D19, ratified in pair-point 3):
 *   - per-zone refractory (D15): EVENT_POP_IN_REFRACTORY_HOURS default 4
 *   - per-zone daily cap (D15): EVENT_POP_IN_DAILY_CAP default 3
 *   - inter-character coord (D17): characters share per-zone refractory
 *   - per-axis thresholds (D14): OR-gate, not single scalar
 *   - stochastic class-A bypass (D16): preserves rarity-as-felt
 *
 * Source of truth: grimoires/loa/sdd.md §3.6
 */

import { Schema } from "effect";
import { ZoneId, EventClass, Timestamp } from "./event.ts";

// ─── Default thresholds (env-overridable) ────────────────────────────

export const POP_IN_REFRACTORY_HOURS_DEFAULT = 4;
export const POP_IN_DAILY_CAP_DEFAULT = 3;

/** Per-axis OR-gate thresholds. Any axis crossing fires (D14).
 * Router annotates pop-in with the triggering axis so narration register
 * can lean into the specific stir-shape. */
export const POP_IN_THRESHOLD_PRESS_DEFAULT = 0.55;
export const POP_IN_THRESHOLD_STRANGERS_DEFAULT = 0.45;
export const POP_IN_THRESHOLD_GRAVITY_DEFAULT = 0.7; // also stochastic bypass prob
export const POP_IN_THRESHOLD_DRIFT_DEFAULT = 0.5;

// ─── Schema ──────────────────────────────────────────────────────────

/**
 * Per-zone budget state. Persisted in `.run/pop-in-ledger.jsonl` via the
 * ledger writer; the router reads it via `pop-in-ledger.port.ts` query
 * API (S3.T2a).
 */
export const Budget = Schema.Struct({
  zone: ZoneId,
  // D15 refractory: last fire timestamp per zone (cross-character per D17)
  last_fire_at: Schema.NullOr(Timestamp),
  last_fire_character_id: Schema.NullOr(Schema.String),
  refractory_hours: Schema.Number,
  // D15 daily cap: UTC date + count
  today_utc_date: Schema.String, // "YYYY-MM-DD"
  today_fire_count: Schema.Number,
  daily_cap: Schema.Number,
});
export type Budget = Schema.Schema.Type<typeof Budget>;

/** Per-axis OR-gate thresholds for pop-in fire decisions. */
export const PopInThresholds = Schema.Struct({
  press: Schema.Number,
  strangers: Schema.Number,
  gravity: Schema.Number,
  drift: Schema.Number,
});
export type PopInThresholds = Schema.Schema.Type<typeof PopInThresholds>;

export const DEFAULT_POP_IN_THRESHOLDS: PopInThresholds = {
  press: POP_IN_THRESHOLD_PRESS_DEFAULT,
  strangers: POP_IN_THRESHOLD_STRANGERS_DEFAULT,
  gravity: POP_IN_THRESHOLD_GRAVITY_DEFAULT,
  drift: POP_IN_THRESHOLD_DRIFT_DEFAULT,
};

/** Router decision types for ledger entries (NFR-18 observability). */
export const FireDecision = Schema.Literal(
  "fired", // pop-in fired through normal threshold path
  "bypassed", // gravity-class stochastic bypass (D16)
  "capped", // daily cap exhausted
  "queued", // class-A during refractory → late_felt candidate
  "suppressed", // below threshold + above bedrock-kick (silence-register)
  "yielded_to_character", // inter-character coord — another character fired in window (D17)
);
export type FireDecision = Schema.Schema.Type<typeof FireDecision>;

/** Triggering-axis annotation passed to narration (D14 OR-gate signal).
 * Null means a bypass-class firing (gravity-class) that didn't cross any
 * specific axis threshold but bypassed via D16 stochastic roll. */
export const TriggeringAxis = Schema.NullOr(
  Schema.Literal("press", "strangers", "gravity", "drift"),
);
export type TriggeringAxis = Schema.Schema.Type<typeof TriggeringAxis>;

/** Ledger entry — one per router decision. */
export const LedgerEntry = Schema.Struct({
  ts: Timestamp,
  zone: ZoneId,
  character_id: Schema.String,
  decision: FireDecision,
  triggering_axis: TriggeringAxis,
  event_class: Schema.NullOr(EventClass),
  event_id: Schema.NullOr(Schema.String),
  yielded_to: Schema.NullOr(Schema.String), // other character's id when decision=yielded
});
export type LedgerEntry = Schema.Schema.Type<typeof LedgerEntry>;

// ─── Helper functions ────────────────────────────────────────────────

/** Check whether a budget is within refractory window from `now`. */
export function isWithinRefractory(
  budget: Budget,
  now: Timestamp,
  refractoryHours: number = POP_IN_REFRACTORY_HOURS_DEFAULT,
): boolean {
  if (!budget.last_fire_at) return false;
  const lastMs = Date.parse(budget.last_fire_at);
  const nowMs = Date.parse(now);
  return nowMs - lastMs < refractoryHours * 3600 * 1000;
}

/** Check whether the daily cap is exhausted for today's UTC date. */
export function isDailyCapExhausted(
  budget: Budget,
  nowUtcDate: string,
  cap: number = POP_IN_DAILY_CAP_DEFAULT,
): boolean {
  if (budget.today_utc_date !== nowUtcDate) return false; // roll-over day
  return budget.today_fire_count >= cap;
}

/** Compute UTC date string "YYYY-MM-DD" from an ISO timestamp. */
export function toUtcDate(ts: Timestamp): string {
  return ts.slice(0, 10);
}

/** Lexicographic-min comparison for inter-character tie-breaking (D17 +
 * S3.T2a). When two characters attempt to fire on the same event in the
 * same flock-window, the lex-min character_id wins. */
export function lexMinCharacter(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Build a per-zone Budget from recent ledger entries (cycle-008 capability-wiring slice 2a).
 *
 * The PopInLedger port has no `getBudget`; the router REQUIRES a Budget. This reconstructs it
 * from the append-only entries the ledger already keeps:
 *   - `today_fire_count` counts fired/bypassed entries by UTC CALENDAR date (matches
 *     isDailyCapExhausted's date-equality check — NOT a rolling 24h window).
 *   - `last_fire_*` is the most recent fired/bypassed entry across ALL characters (D17 shared
 *     refractory). The truncated-window query is the caller's job: pass entries from
 *     `ledger.readWindow` covering at least the last ~25h so both the calendar-day count and the
 *     refractory window are fully represented.
 *
 * Pure + deterministic (no clock read beyond the supplied `now`) so it unit-tests without the
 * Effect runtime — the firing gate's correctness is checkable in isolation.
 */
export function budgetFromLedger(
  zone: ZoneId,
  entries: ReadonlyArray<LedgerEntry>,
  now: Timestamp,
  opts?: { refractoryHours?: number; dailyCap?: number },
): Budget {
  const refractory_hours = opts?.refractoryHours ?? POP_IN_REFRACTORY_HOURS_DEFAULT;
  const daily_cap = opts?.dailyCap ?? POP_IN_DAILY_CAP_DEFAULT;
  const today_utc_date = toUtcDate(now);

  let last: LedgerEntry | null = null;
  let today_fire_count = 0;
  for (const e of entries) {
    if (e.zone !== zone) continue;
    if (e.decision !== "fired" && e.decision !== "bypassed") continue;
    if (toUtcDate(e.ts) === today_utc_date) today_fire_count++;
    if (!last || e.ts > last.ts) last = e;
  }

  return {
    zone,
    last_fire_at: last?.ts ?? null,
    last_fire_character_id: last?.character_id ?? null,
    refractory_hours,
    today_utc_date,
    today_fire_count,
    daily_cap,
  };
}
