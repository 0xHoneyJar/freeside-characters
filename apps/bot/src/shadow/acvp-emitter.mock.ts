/**
 * shadow/acvp-emitter.mock.ts — a consumer-side recording `AcvpEmitter` Layer
 * for the characters' own tests (Sprint 405). The substrate ships a recording
 * mock too, but it is test-only and not in the package's `exports` map, so the
 * characters repo provides its own (same contract: record every confirmed event,
 * optional `failOn` to simulate a NATS confirm failure).
 *
 * Records into a shared array so a test can assert e.g. "a confirmed
 * `shadow.role.rejected.v1` per attempted write" or "zero `shadow.role.applied.v1`
 * under SHADOW".
 */
import { Effect, Layer } from "effect";
import { AcvpEmitter, AuditError } from "./substrate.ts";
import type { ShadowEvent } from "@freeside-worlds/shadow-substrate";

export interface MockEmitterOptions {
  /** when true for an event, emitConfirmed FAILS with AuditError (NATS down). */
  readonly failOn?: (event: ShadowEvent) => boolean;
}

export interface Recorder {
  readonly events: ShadowEvent[];
  countOf(type: string): number;
}

export function makeRecordingEmitter(opts: MockEmitterOptions = {}): {
  readonly layer: Layer.Layer<AcvpEmitter>;
  readonly recorder: Recorder;
} {
  const events: ShadowEvent[] = [];
  const recorder: Recorder = {
    events,
    countOf: (type) => events.filter((e) => e.event_type === type).length,
  };
  const layer = Layer.succeed(
    AcvpEmitter,
    AcvpEmitter.of({
      emitConfirmed: (event: ShadowEvent) =>
        Effect.suspend(() => {
          if (opts.failOn?.(event)) {
            return Effect.fail(
              new AuditError({
                message: `ACVP confirm failed (NATS unavailable) for ${event.event_type}`,
              }),
            );
          }
          events.push(event);
          return Effect.void;
        }),
    }),
  );
  return { layer, recorder };
}
