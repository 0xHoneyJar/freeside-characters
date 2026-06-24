/**
 * shadow/acvp-emitter.live.ts — the LIVE `AcvpEmitter` Layer (Sprint 405 / Task
 * 405.2, SDD §4.4.2/§6.3). Wraps the real `@0xhoneyjar/events` `publishEnvelope`
 * pipeline (JCS-canonical payload → sha256 → Ed25519 sign → hash-chain → NATS
 * publish) so each `shadow.*` event is a SIGNED, hash-chained ACVP envelope.
 *
 * ── CONFIRM SEMANTICS (write-after-audit) ────────────────────────────────────
 * `emitConfirmed(event)` resolves ONLY after the envelope is published AND
 * acknowledged. The substrate's `GateCheckedRoleWriter` calls this BEFORE each
 * inner write; a failed confirm ⇒ `WriteError("audit_unavailable")` and the
 * write does NOT run (there is no un-audited LIVE write). We treat a successful
 * `publishEnvelope` (which awaits the NATS publish) as confirmation. A throw
 * surfaces as `AuditError` in the Effect error channel.
 *
 * ── DEPLOY-PROVIDED (NOT set here) ───────────────────────────────────────────
 * The NATS connection + the Ed25519 signing key are OPERATOR/DEPLOY-provided
 * (NATS_URL + signing seed/key-id in Secrets Manager). This Layer factory takes
 * an already-connected `nats` + an already-constructed `signer` so the bot's
 * composition root owns connection lifecycle (mirrors persona-engine's
 * inject-mint-event.ts / mint-event-subscriber.ts NATS wiring). The factory does
 * NOT read env or open sockets — that is the deploy boundary.
 *
 * ── RECONCILIATION (events-pin bump / task 402.7) ────────────────────────────
 * The `shadow.*` families are not yet in the canonical events registry (402.7,
 * operator-gated). Until then we publish on the 3-segment topic stem directly
 * (`shadow.role.intent.v1` etc.) using the generic `publishEnvelope`. When 402.7
 * registers the SchemaIds, this Layer maps `(event_type, payload)` → the
 * registered SchemaId; the confirm contract is unchanged.
 */
import { Effect, Layer } from "effect";
import {
  publishEnvelope,
  InMemoryPrevHashStore,
  type PrevHashStore,
  type Signer,
} from "@0xhoneyjar/events";
import { AcvpEmitter, AuditError } from "./substrate.ts";
import type { ShadowEvent } from "@freeside-worlds/shadow-substrate";

/** Minimal NATS surface the events publisher needs (matches `NatsLike`). */
interface NatsLike {
  publish(subject: string, data: Uint8Array, opts?: { headers?: unknown }): void | Promise<unknown>;
}

export interface LiveEmitterDeps {
  /** an already-connected NATS connection (deploy-provided lifecycle). */
  readonly nats: NatsLike;
  /** an already-constructed Ed25519 signer (deploy-provided key material). */
  readonly signer: Signer;
  /** cell slug populating `emitted_by` — default `freeside-characters`. */
  readonly emittedBy?: string;
  /** per-publisher hash chain store — default in-memory (single process). */
  readonly prevHashStore?: PrevHashStore;
}

/** The NATS subject for a shadow event — the 3-segment ACVP topic stem. */
function subjectFor(event: ShadowEvent): string {
  return event.event_type; // e.g. "shadow.role.intent.v1"
}

/**
 * Build the LIVE `AcvpEmitter` Layer. The publish AWAITS the NATS send; a
 * resolved publish IS the confirmation (write-after-audit). A throw → AuditError.
 */
export function makeAcvpEmitterLive(deps: LiveEmitterDeps): Layer.Layer<AcvpEmitter> {
  const emittedBy = deps.emittedBy ?? "freeside-characters";
  const prevHashStore = deps.prevHashStore ?? new InMemoryPrevHashStore();

  return Layer.succeed(
    AcvpEmitter,
    AcvpEmitter.of({
      emitConfirmed: (event: ShadowEvent) =>
        Effect.tryPromise({
          try: async () => {
            await publishEnvelope({
              nats: deps.nats,
              subject: subjectFor(event),
              payload: event.payload,
              emittedBy,
              signer: deps.signer,
              prevHashStore,
            });
          },
          catch: (e) =>
            new AuditError({
              message: `ACVP confirm failed for ${event.event_type}: ${e instanceof Error ? e.message : String(e)}`,
            }),
        }),
    }),
  );
}
