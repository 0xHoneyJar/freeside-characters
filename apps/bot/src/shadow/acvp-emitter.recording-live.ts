/**
 * shadow/acvp-emitter.recording-live.ts — a DURABLE-RECORDING `AcvpEmitter` Layer
 * for the LIVE role-sync apply path (bd-han / PART C).
 *
 * ── WHY THIS EXISTS (the honest middle ground) ───────────────────────────────
 * The gate's write-after-audit (`GateCheckedRoleWriter`) calls `emitConfirmed`
 * BEFORE each LIVE write; a failed confirm ⇒ `WriteError("audit_unavailable")`
 * and the write does NOT run (there is no un-audited LIVE write). The PRODUCTION
 * target is the SIGNED, Ed25519 hash-chained NATS envelope (`acvp-emitter.live.ts`
 * → `@0xhoneyjar/events::publishEnvelope`), which needs deploy-provided NATS +
 * signing key material (an operator boundary — NATS_URL + signing seed/key-id in
 * Secrets Manager). That full wiring is the FOLLOW-UP bead (bd-3v2).
 *
 * Until the signed-NATS deps are wired, a LIVE role-sync apply must still produce
 * an HONEST, DURABLE audit trail — not a no-op that silently lies, and not a hard
 * fail-closed that blocks the operator from granting roles at all. This Layer is
 * that: it records each confirmed `shadow.*` ACVP event to a durable structured
 * log (a single-line JSON record on stdout, captured by the platform log sink)
 * AND into an in-process recorder for assertions. It is CLEARLY MARKED as the
 * interim audit (every record carries `audit_backend: "recording-live (interim — bd-3v2 signed-NATS follow-up)"`).
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 * It is NOT a signature. It does NOT hash-chain. It does NOT publish to NATS. It
 * does NOT relax any of the gate's authz / binding / write-boundary guards — those
 * are upstream and untouched (this only satisfies the AUDIT half of write-after-
 * audit). A LIVE grant through this path is real (roles ARE written through
 * role-writer.live.ts) and durably logged, but the cryptographic audit envelope
 * is pending bd-3v2.
 */
import { Effect, Layer } from "effect";
import { AcvpEmitter } from "./substrate.ts";
import type { ShadowEvent } from "@freeside-worlds/shadow-substrate";

/** The marker that flags this as the INTERIM audit backend (not signed NATS). */
export const RECORDING_LIVE_AUDIT_BACKEND =
  "recording-live (interim — bd-3v2 signed-NATS follow-up)";

export interface RecordingLiveRecorder {
  readonly events: ShadowEvent[];
  countOf(type: string): number;
}

export interface RecordingLiveEmitterOptions {
  /** cell/world tag for the durable record. */
  readonly world?: string;
  /** sink for the durable line (default: console.log). Injectable for tests. */
  readonly sink?: (line: string) => void;
}

/**
 * Build the DURABLE-RECORDING LIVE `AcvpEmitter` Layer. Each confirmed event is
 * (a) written as a single-line JSON record to the durable sink and (b) pushed to
 * an in-process recorder. The confirm RESOLVES (never fails) once the record is
 * durably emitted — that is the write-after-audit contract this interim backend
 * honors. The signed-NATS backend (bd-3v2) replaces this with a real
 * `publishEnvelope` whose confirm awaits the NATS ack.
 */
export function makeRecordingLiveEmitter(opts: RecordingLiveEmitterOptions = {}): {
  readonly layer: Layer.Layer<AcvpEmitter>;
  readonly recorder: RecordingLiveRecorder;
} {
  const events: ShadowEvent[] = [];
  const sink = opts.sink ?? ((line: string) => console.log(line));
  const recorder: RecordingLiveRecorder = {
    events,
    countOf: (type) => events.filter((e) => e.event_type === type).length,
  };

  const layer = Layer.succeed(
    AcvpEmitter,
    AcvpEmitter.of({
      emitConfirmed: (event: ShadowEvent) =>
        Effect.sync(() => {
          events.push(event);
          // a durable, structured single-line record. Honest provenance: this is
          // the INTERIM recording backend, NOT a signed/hash-chained envelope.
          sink(
            JSON.stringify({
              kind: "role-sync-audit",
              audit_backend: RECORDING_LIVE_AUDIT_BACKEND,
              world: opts.world,
              event_type: event.event_type,
              payload: event.payload,
              recorded_at: new Date().toISOString(),
            }),
          );
        }),
    }),
  );

  return { layer, recorder };
}
