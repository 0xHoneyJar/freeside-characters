/**
 * Primitive weights — lynch primitive → axis weight matrix.
 *
 * Per LYNCH ratification (D10/D11/D12 · construct-rosenzu pair-point 3):
 * the 4 axes (press · strangers · gravity · drift) read DIFFERENTLY across
 * the lynch primitive types. A density-in-an-inner-sanctum is materially
 * different from a density-in-a-node.
 *
 * Source of truth:
 *   grimoires/loa/context/ambient-events-as-rave.md §the 4-axis kansei stir
 *   grimoires/loa/sdd.md §3.4
 *   construct ratification log (LYNCH verdict 2026-05-11)
 *
 * The matrix is applied as:
 *   stir_delta_zone = class_axis_weight ⊙ primitive_axis_weight
 *
 * with the special case that `inner_sanctum.press = -1.0` INVERTS the sign
 * (density-inversion per D11 — fewer events higher weight).
 */

import type { AxisDelta } from "./class-weights.ts";

export type LynchPrimitive =
  | "node"
  | "district"
  | "edge"
  | "path"
  | "inner_sanctum";

/**
 * Per-primitive axis weight matrix.
 *
 * Interpretation per primitive:
 *   - node (e.g. stonehenge)             — convergence point; baseline IS density
 *   - district (e.g. bear-cave)          — named area; turnover dominates (regulars vs tourists)
 *   - edge (e.g. el-dorado)              — crossings; every transfer made visible
 *   - inner_sanctum (e.g. owsley-lab)    — sacred quiet; awe dominates; press INVERTED (D11)
 *   - path                                — flow corridor; BPM-shaped
 *
 * Negative press in inner_sanctum is the LYNCH-locked behavior. The stir
 * schema (pulse.ts) keeps `press: Schema.Number` unbounded so decode does
 * not fail (Flatline IMP-001 fix).
 */
export const PRIMITIVE_AXIS_WEIGHTS: Record<LynchPrimitive, AxisDelta> = {
  node: { press: 1.0, strangers: 0.4, gravity: 0.6, drift: 0.8 },
  district: { press: 0.5, strangers: 0.7, gravity: 0.3, drift: 1.0 },
  edge: { press: 0.9, strangers: 0.9, gravity: 0.9, drift: 0.6 },
  inner_sanctum: {
    press: -1.0, // D11 INVERSION
    strangers: 0.5,
    gravity: 1.0,
    drift: 0.4,
  },
  path: { press: 0.7, strangers: 0.5, gravity: 0.4, drift: 0.7 },
};

/**
 * D12 edge transfer-class boost.
 *
 * LYNCH spotted that the brief's transfer-class gravity weight (0.2) is too
 * low for an edge primitive — every transfer at an edge (el-dorado) is a
 * boundary-crossing made visible. This boost adds to the gravity axis when
 * `class === "cross_wallets" && primitive === "edge"`.
 */
export const EDGE_TRANSFER_GRAVITY_BOOST = 0.3; // 0.2 → 0.5

/**
 * Combine class delta + primitive weight + optional edge-transfer boost
 * into a final per-axis stir delta for the zone.
 */
export function applyPrimitiveWeights(
  classDelta: AxisDelta,
  primitive: LynchPrimitive,
  isCrossWallets: boolean,
): AxisDelta {
  const pweight = PRIMITIVE_AXIS_WEIGHTS[primitive];
  const transferBoost =
    primitive === "edge" && isCrossWallets ? EDGE_TRANSFER_GRAVITY_BOOST : 0;

  return {
    press: classDelta.press * pweight.press,
    strangers: classDelta.strangers * pweight.strangers,
    gravity: classDelta.gravity * pweight.gravity + transferBoost,
    drift: classDelta.drift * pweight.drift,
  };
}
