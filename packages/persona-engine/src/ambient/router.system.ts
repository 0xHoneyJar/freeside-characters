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
import {
  PopInLedger,
  type GetLastFireParams,
} from "./ports/pop-in-ledger.port.ts";
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
 */
export const routerDecide = (
  input: RouterInput,
): Effect.Effect<RouterDecision, never, PopInLedger> =>
  Effect.gen(function* (_) {
    const ledger = yield* _(PopInLedger);
    const thresholds = input.thresholds ?? DEFAULT_POP_IN_THRESHOLDS;
    const refractoryHrs =
      input.refractoryHours ?? POP_IN_REFRACTORY_HOURS_DEFAULT;
    const rng = input.rng ?? Math.random;

    // STEP 1: Inter-character coordination (D17 · S3.T2a)
    if (INTER_CHARACTER_SHARED_REFRACTORY) {
      const afterMs = Date.parse(input.now) - refractoryHrs * 3_600_000;
      const afterTs = new Date(afterMs).toISOString();
      const params: GetLastFireParams = { zone: input.zone, afterTs };
      const lastFire = yield* _(
        ledger.getLastFire(params).pipe(
          Effect.catchAll(() => Effect.succeed(null as LedgerEntry | null)),
        ),
      );
      if (lastFire && lastFire.character_id !== input.characterId) {
        const entry: LedgerEntry = {
          ts: input.now,
          zone: input.zone,
          character_id: input.characterId,
          decision: "yielded_to_character",
          triggering_axis: null,
          event_class: input.latestEvent?.event_class ?? null,
          event_id: input.latestEvent?.id ?? null,
          yielded_to: lastFire.character_id,
        };
        return { entry, shouldFire: false, triggeringAxis: null };
      }
    }

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

/** Helper: write the decision's ledger entry. Used by callers post-decision. */
export const appendDecision = (
  decision: RouterDecision,
): Effect.Effect<void, never, PopInLedger> =>
  Effect.gen(function* (_) {
    const ledger = yield* _(PopInLedger);
    yield* _(
      ledger.append(decision.entry).pipe(
        Effect.catchAll(() => Effect.void),
      ),
    );
  });
