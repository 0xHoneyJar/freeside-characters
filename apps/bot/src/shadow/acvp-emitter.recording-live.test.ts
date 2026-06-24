/**
 * acvp-emitter.recording-live.test.ts — the DURABLE-RECORDING interim LIVE audit
 * emitter (bd-han / PART C). Proves it satisfies the gate's `AcvpEmitter` port
 * (emitConfirmed resolves, recording the event durably) and stamps the honest
 * interim-backend marker so a LIVE grant through this path is never mistaken for
 * a signed-NATS envelope.
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  makeRecordingLiveEmitter,
  RECORDING_LIVE_AUDIT_BACKEND,
} from "./acvp-emitter.recording-live.ts";
import { AcvpEmitter } from "./substrate.ts";
import {
  SHADOW_ROLE_INTENT,
  SHADOW_ROLE_APPLIED,
} from "@freeside-worlds/shadow-substrate";
import type { ShadowEvent } from "@freeside-worlds/shadow-substrate";

function intentEvent(roleKey: string): ShadowEvent {
  return {
    event_type: SHADOW_ROLE_INTENT,
    payload: { world: "purupuru", role_key: roleKey } as unknown as ShadowEvent["payload"],
  } as ShadowEvent;
}
function appliedEvent(roleKey: string): ShadowEvent {
  return {
    event_type: SHADOW_ROLE_APPLIED,
    payload: { world: "purupuru", role_key: roleKey } as unknown as ShadowEvent["payload"],
  } as ShadowEvent;
}

describe("bd-han (PART C) — recording-live AcvpEmitter", () => {
  test("emitConfirmed resolves + records the event into the recorder", async () => {
    const lines: string[] = [];
    const { layer, recorder } = makeRecordingLiveEmitter({ world: "purupuru", sink: (l) => lines.push(l) });
    const emitter = await Effect.runPromise(AcvpEmitter.pipe(Effect.provide(layer)));

    await Effect.runPromise(emitter.emitConfirmed(intentEvent("purupuru:member")));
    await Effect.runPromise(emitter.emitConfirmed(appliedEvent("purupuru:member")));

    expect(recorder.events.length).toBe(2);
    expect(recorder.countOf(SHADOW_ROLE_INTENT)).toBe(1);
    expect(recorder.countOf(SHADOW_ROLE_APPLIED)).toBe(1);
  });

  test("each durable line carries the HONEST interim-backend marker (not signed NATS)", async () => {
    const lines: string[] = [];
    const { layer } = makeRecordingLiveEmitter({ world: "purupuru", sink: (l) => lines.push(l) });
    const emitter = await Effect.runPromise(AcvpEmitter.pipe(Effect.provide(layer)));

    await Effect.runPromise(emitter.emitConfirmed(intentEvent("purupuru:core")));

    expect(lines.length).toBe(1);
    const rec = JSON.parse(lines[0]!);
    expect(rec.kind).toBe("role-sync-audit");
    expect(rec.audit_backend).toBe(RECORDING_LIVE_AUDIT_BACKEND);
    expect(rec.world).toBe("purupuru");
    expect(rec.event_type).toBe(SHADOW_ROLE_INTENT);
    expect(typeof rec.recorded_at).toBe("string");
  });
});
