/**
 * Class weights — chain-class → per-axis stir delta lookup.
 *
 * CANON-locked per D16 (operator-decided · code-level lock, NOT env-tunable).
 *
 * Per axis (D9 ALEXANDER rename):
 *   - press     events/hour vs baseline (how MUCH happened)
 *   - strangers first-seen-wallets ratio (how UNFAMILIAR)
 *   - gravity   class weight for transient-flag fire (how WEIGHTY)
 *   - drift     unique-wallets/total-events (how FLUID)
 *
 * Source of truth: grimoires/loa/sdd.md §3 + grimoires/loa/context/ambient-events-as-rave.md
 */

import type { EventClass } from "./event.ts";

export interface AxisDelta {
  readonly press: number;
  readonly strangers: number;
  readonly gravity: number; // class weight (NOT decaying — gravity is transient)
  readonly drift: number;
}

/**
 * Per-class axis weights. Each event contributes its delta scaled by the
 * primitive-weights matrix (see primitive-weights.ts) to the zone's stir.
 *
 * Tuning principles:
 *   - awakening (mint) is rare-to-medium · gravity 0.7 (felt but not violation)
 *   - return_to_source (burn) is rare · gravity 1.0 (highest awe weight)
 *   - cross_wallets (transfer) is frequent · gravity 0.2 (low ambient noise)
 *   - reveal is rare · gravity 0.6 (further-initiation register)
 *   - backing/committed/fracture are mid-frequency · low-to-mid gravity
 */
export const CLASS_AXIS_WEIGHTS: Record<EventClass, AxisDelta> = {
  awakening: {
    press: 1.0,
    strangers: 0.7, // mints often introduce new keepers
    gravity: 0.7,
    drift: 0.5,
  },
  cross_wallets: {
    press: 0.3,
    strangers: 0.4, // sometimes new keeper, sometimes regular
    gravity: 0.2, // bumped to 0.5 at edge primitive (D12)
    drift: 0.8, // turnover signal
  },
  return_to_source: {
    press: 0.6,
    strangers: 0.1, // burns are usually familiar holders
    gravity: 1.0, // CANON: weightiest event
    drift: 0.3,
  },
  reveal: {
    press: 0.4,
    strangers: 0.0, // reveals are owner-initiated
    gravity: 0.6,
    drift: 0.0,
  },
  backing: {
    press: 0.5,
    strangers: 0.3,
    gravity: 0.4,
    drift: 0.5,
  },
  committed: {
    press: 0.4,
    strangers: 0.2,
    gravity: 0.3,
    drift: 0.4,
  },
  fracture: {
    press: 0.5,
    strangers: 0.6, // proof-of-presence often new participants
    gravity: 0.5,
    drift: 0.4,
  },
};

/** D16 stochastic class-A bypass probability — CANON locked.
 *
 * gravity-class events (awakening, return_to_source) bypass the per-axis
 * OR-gate threshold check (D14) with this probability. Refractory + daily
 * cap + inter-character refractory still apply (NFR-17 bypass precedence). */
export const CLASS_A_BYPASS_PROBABILITY = 0.7;

/** Inter-character coordination — shared per-zone refractory (D17).
 * CANON locked: characters are alternative voices of one substrate, not
 * independent agents.
 */
export const INTER_CHARACTER_SHARED_REFRACTORY = true;
