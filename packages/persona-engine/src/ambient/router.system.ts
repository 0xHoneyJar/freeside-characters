/**
 * Router system — stir state + new gravity event → pop-in fire decision.
 *
 * Decision tree (per FR-3.18 + S3.T2a + OSTROM):
 *   1. Inter-character coord (D17 · NEW S3.T2a): query ledger for any
 *      character's recent fire in same zone within refractory window.
 *      If found, write "yielded_to_character" entry + return suppressed.
 *   2. Per-character daily cap check (D15 · NFR-17 bypass precedence).
 *      Exhausted → "capped" entry + return suppressed.
 *   3. Stochastic class-A bypass roll (D16). 0.7 probability triggers
 *      bypass of per-axis threshold; still respects refractory + cap.
 *      During refractory → "queued" entry (late_felt candidate).
 *   4. Per-axis OR-gate threshold check (D14). Any axis crossing fires.
 *   5. Fire: write "fired" entry · invalidate caches · return triggering axis.
 */

import { Effect } from "effect";
import { PopInLedger } from "./ports/pop-in-ledger.port.ts";
import {
  type Budget,
  type LedgerEntry,
  type PopInThresholds,
  type TriggeringAxis,
  DEFAULT_POP_IN_THRESHOLDS,
  isWithinRefractory,
  isDailyCapExhausted,
  toUtcDate,
  POP_IN_REFRACTORY_HOURS_DEFAULT,
} from "./domain/budgets.ts";
import type { ZoneId, EventClass, MiberaEvent } from "./domain/event.ts";
import { isGravityClass } from "./domain/event.ts";
import {
  CLASS_A_BYPASS_PROBABILITY,
  INTER_CHARACTER_SHARED_REFRACTORY,
} from "./domain/class-weights.ts";
import type { KansaiStir } from "./domain/pulse.ts";

export interface RouterInput {
  readonly zone: ZoneId;
  readonly characterId: string;
  readonly stir: KansaiStir;
  readonly latestEvent: MiberaEvent | null; // for queued/bypass tracking
  readonly budget: Budget;
  readonly now: string;
  readonly thresholds?: PopInThresholds;
  readonly refractoryHours?: number;
  readonly rng?: () => number; // injectable for deterministic tests
}

export interface RouterDecision {
  readonly entry: LedgerEntry;
  readonly shouldFire: boolean;
  readonly triggeringAxis: TriggeringAxis;
}

/**
 * Pure-ish: yields ledger ops (the only Effect-y part). All logic is
 * synchronous given the inputs.
 *
 * F13 TOCTOU closure (BB review · post-PR fixup): the inter-character
 * coordination check is no longer a separate `getLastFire` call followed
 * later by a write. Inter-character atomicity now lives in
 * `ledger.appendIfNoFire` — caller invokes that helper for "fired" /
 * "bypassed" decisions. The router decision tree below covers all
 * character-local gates (refractory + cap + bypass + threshold); the
 * shared-zone check is deferred to the atomic write boundary.
 */
export const routerDecide = (
  input: RouterInput,
): Effect.Effect<RouterDecision, never, PopInLedger> =>
  Effect.gen(function* (_) {
    yield* _(PopInLedger); // ensures DI even though we only call ledger from appendDecision now
    const thresholds = input.thresholds ?? DEFAULT_POP_IN_THRESHOLDS;
    const refractoryHrs =
      input.refractoryHours ?? POP_IN_REFRACTORY_HOURS_DEFAULT;
    const rng = input.rng ?? Math.random;

    // STEP 2: Per-character refractory + daily cap
    const utcDate = toUtcDate(input.now);
    if (isDailyCapExhausted(input.budget, utcDate)) {
      const entry: LedgerEntry = {
        ts: input.now,
        zone: input.zone,
        character_id: input.characterId,
        decision: "capped",
        triggering_axis: null,
        event_class: input.latestEvent?.event_class ?? null,
        event_id: input.latestEvent?.id ?? null,
        yielded_to: null,
      };
      return { entry, shouldFire: false, triggeringAxis: null };
    }

    const inRefractory = isWithinRefractory(input.budget, input.now, refractoryHrs);
    const isClassA =
      input.latestEvent !== null && isGravityClass(input.latestEvent.event_class);

    // STEP 3: Stochastic class-A bypass (D16)
    let bypassedThreshold = false;
    if (isClassA && !inRefractory) {
      const roll = rng();
      if (roll < CLASS_A_BYPASS_PROBABILITY) {
        bypassedThreshold = true;
      }
    } else if (isClassA && inRefractory) {
      // class-A during refractory → queue as late_felt candidate
      const entry: LedgerEntry = {
        ts: input.now,
        zone: input.zone,
        character_id: input.characterId,
        decision: "queued",
        triggering_axis: null,
        event_class: input.latestEvent!.event_class,
        event_id: input.latestEvent!.id,
        yielded_to: null,
      };
      return { entry, shouldFire: false, triggeringAxis: null };
    }

    if (inRefractory) {
      const entry: LedgerEntry = {
        ts: input.now,
        zone: input.zone,
        character_id: input.characterId,
        decision: "suppressed",
        triggering_axis: null,
        event_class: input.latestEvent?.event_class ?? null,
        event_id: input.latestEvent?.id ?? null,
        yielded_to: null,
      };
      return { entry, shouldFire: false, triggeringAxis: null };
    }

    // STEP 4: Per-axis OR-gate threshold check (D14)
    let triggeringAxis: TriggeringAxis = null;
    if (bypassedThreshold) {
      triggeringAxis = "gravity";
    } else {
      const absPress = Math.abs(input.stir.press);
      if (absPress >= thresholds.press) {
        triggeringAxis = "press";
      } else if (input.stir.strangers >= thresholds.strangers) {
        triggeringAxis = "strangers";
      } else if (input.stir.drift >= thresholds.drift) {
        triggeringAxis = "drift";
      } else if (input.stir.gravity.last_significant_event_within_window) {
        triggeringAxis = "gravity";
      }
    }

    if (triggeringAxis === null) {
      // below threshold + no bypass — silence-register territory
      const entry: LedgerEntry = {
        ts: input.now,
        zone: input.zone,
        character_id: input.characterId,
        decision: "suppressed",
        triggering_axis: null,
        event_class: input.latestEvent?.event_class ?? null,
        event_id: input.latestEvent?.id ?? null,
        yielded_to: null,
      };
      return { entry, shouldFire: false, triggeringAxis: null };
    }

    // STEP 5: FIRE
    const entry: LedgerEntry = {
      ts: input.now,
      zone: input.zone,
      character_id: input.characterId,
      decision: bypassedThreshold ? "bypassed" : "fired",
      triggering_axis: triggeringAxis,
      event_class: input.latestEvent?.event_class ?? null,
      event_id: input.latestEvent?.id ?? null,
      yielded_to: null,
    };
    return { entry, shouldFire: true, triggeringAxis };
  });

/** F13-aware write helper: for fire-class decisions (fired / bypassed),
 * routes through `appendIfNoFire` so the inter-character race is closed
 * atomically. Returns the actual outcome — the decision may be downgraded
 * to a yielded_to_character if another character won the race.
 *
 * For non-fire decisions (capped / queued / suppressed / yielded), writes
 * verbatim via `append`. */
export const appendDecision = (
  decision: RouterDecision,
  refractoryHours: number = POP_IN_REFRACTORY_HOURS_DEFAULT,
): Effect.Effect<{ wrote: boolean; yieldedTo: string | null }, never, PopInLedger> =>
  Effect.gen(function* (_) {
    const ledger = yield* _(PopInLedger);
    if (decision.shouldFire && INTER_CHARACTER_SHARED_REFRACTORY) {
      // atomic check-then-write under F13 closure
      const afterMs = Date.parse(decision.entry.ts) - refractoryHours * 3_600_000;
      const afterTs = new Date(afterMs).toISOString();
      const result = yield* _(
        ledger
          .appendIfNoFire({ proposedEntry: decision.entry, afterTs })
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed({
                writtenAsProposed: false as const,
                yieldedTo: null as string | null,
              }),
            ),
          ),
      );
      return { wrote: result.writtenAsProposed, yieldedTo: result.yieldedTo };
    }
    yield* _(
      ledger.append(decision.entry).pipe(
        Effect.catchAll(() => Effect.void),
      ),
    );
    return { wrote: true, yieldedTo: null };
  });
