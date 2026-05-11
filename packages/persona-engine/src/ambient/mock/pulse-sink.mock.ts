import { Effect, Layer } from "effect";
import { PulseSink } from "../ports/pulse-sink.port.ts";
import type { ZoneId } from "../domain/event.ts";
import type { KansaiStir } from "../domain/pulse.ts";

const _writes: Array<KansaiStir> = [];
const _byZone: Map<ZoneId, KansaiStir> = new Map();

export function getMockStirWrites(): ReadonlyArray<KansaiStir> {
  return _writes;
}

export function resetMockPulseSink(): void {
  _writes.length = 0;
  _byZone.clear();
}

export const PulseSinkMock = Layer.succeed(
  PulseSink,
  PulseSink.of({
    write: (stir) =>
      Effect.sync(() => {
        _writes.push(stir);
        _byZone.set(stir.zone, stir);
      }),
    read: (zone) => Effect.sync(() => _byZone.get(zone) ?? null),
  }),
);
