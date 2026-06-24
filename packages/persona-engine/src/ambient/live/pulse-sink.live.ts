/**
 * PulseSink live adapter — writes stir as sibling channel on rosenzu state.
 *
 * Per D4: stir is written to a NEW field `KansaiVector.stir_modulation` (NOT
 * `feel` which is canon). The pulse-sink is the ONLY writer for stir;
 * downstream callers read it via `furnish_kansei` extension (S3.T5).
 *
 * Per D24: derives motion/shadow/density/warmth bias STRINGS (categorical
 * bumps), never numeric scalars.
 *
 * Storage: in-memory per-zone Map. Persisted across restarts via
 * the cursor + event replay (NFR-16) — stir state is reconstructible from
 * the last 6h of events.
 */

import { Effect, Layer } from "effect";
import { PulseSink } from "../ports/pulse-sink.port.ts";
import type { ZoneId } from "../domain/event.ts";
import type { KansaiStir } from "../domain/pulse.ts";

/** Module-private state — single ManagedRuntime ensures single instance. */
const _stirByZone: Map<ZoneId, KansaiStir> = new Map();

export function getCurrentStirSync(zone: ZoneId): KansaiStir | null {
  return _stirByZone.get(zone) ?? null;
}

export const PulseSinkLive = Layer.succeed(
  PulseSink,
  PulseSink.of({
    write: (stir) =>
      Effect.sync(() => {
        _stirByZone.set(stir.zone, stir);
      }),
    read: (zone) => Effect.sync(() => _stirByZone.get(zone) ?? null),
  }),
);
