/**
 * PulseSink port — writes stir as a SIBLING channel on rosenzu state.
 *
 * Per D4 (LYNCH + ALEXANDER · pair-point 3): the stir vector MUST NOT
 * mutate KansaiVector.feel. It lives on a new sibling field
 * `KansaiVector.stir_modulation`. Schema-extend, not schema-mutate.
 *
 * Per D24 (ALEXANDER): pulse-sink writes only CATEGORICAL bumps into
 * the existing KansaiVector primitives (motion / shadow / density /
 * warmth biases). Numeric stir scalars NEVER enter the prompt.
 */

import { Context, Effect } from "effect";
import type { ZoneId } from "../domain/event.ts";
import type { KansaiStir } from "../domain/pulse.ts";

export interface PulseSinkError {
  readonly _tag: "PulseSinkError";
  readonly message: string;
}

export class PulseSink extends Context.Tag("ambient/PulseSink")<
  PulseSink,
  {
    /** Write the current stir state for a zone. Adapter derives
     * KansaiVector.stir_modulation biases internally (motion string,
     * shadow bias, density bias, warmth bias) per D24 categorical bump. */
    readonly write: (
      stir: KansaiStir,
    ) => Effect.Effect<void, PulseSinkError>;

    /** Read the current stir state for a zone. Returns null if no stir
     * has been written yet (stir-tier no-op state). */
    readonly read: (
      zone: ZoneId,
    ) => Effect.Effect<KansaiStir | null, PulseSinkError>;
  }
>() {}
