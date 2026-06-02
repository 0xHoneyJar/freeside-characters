/**
 * shadow/composition-root.ts — the bot's composition root for the shadow
 * Layers (Sprint 405 / Task 405.2/405.7, SDD §4.4.3/§4.5).
 *
 * This is where the actor CHOOSES the Layer — and that choice IS the
 * shadow/apply switch (SDD §4.5):
 *   • SHADOW PREVIEW  → MOCK RosterSource + MOCK RoleWriter (zero Discord calls).
 *   • LIVE APPLY      → LIVE RosterSource + LIVE RoleWriter (the gated adapter),
 *                       reachable ONLY through the substrate's
 *                       `GateCheckedRoleWriter`.
 *
 * The composition root is the ONLY place that:
 *   1. Provides the substrate's required `AdminAllowlistSource` Layer (FR-10 —
 *      reads `purupuru.yaml` `admin_principals`) + a LIVE `AcvpEmitter` (NATS via
 *      `@0xhoneyjar/events`) for the gate's write-after-audit + a `WorldLock`.
 *   2. Hands the LIVE `RoleWriter` to `GateCheckedRoleWriter` as its `inner`
 *      Layer — nothing else ever touches the LIVE writer (R-13).
 *
 * VOICELESS: this wires I/O Layers + a mode `Ref`. It holds NO onboarding logic;
 * the gate, the pure transition, and the authz decision all live in the
 * substrate. The bot only supplies the seams + fires events + renders.
 */
import { Effect, Layer } from "effect";
import type { Client } from "discord.js";
import type { Signer, PrevHashStore } from "@0xhoneyjar/events";
import {
  GateCheckedRoleWriter,
  makeGateCheckedRoleWriter,
  makeModeControl,
  RosterSource,
  RoleWriter,
  AcvpEmitter,
  WorldLock,
  AdminAllowlistSource,
  type ModeControl,
} from "./substrate.ts";
import type { ApplyMode } from "@freeside-worlds/shadow-substrate";
import { makeRosterSourceLive, type LiveRosterConfig } from "./roster-source.live.ts";
import { RosterSourceMock } from "./roster-source.mock.ts";
import { makeRoleWriterLive, type LiveWriterConfig } from "./role-writer.live.ts";
import { RoleWriterMock } from "./role-writer.mock.ts";
import { makeAcvpEmitterLive } from "./acvp-emitter.live.ts";
import { makeAdminAllowlistLive, type LiveAllowlistConfig } from "./admin-allowlist.live.ts";
import { makeInMemoryWorldLock } from "./world-lock.ts";

// ── Per-world wiring resolved from the world manifest (purupuru.yaml) ────────

export interface WorldWiring {
  readonly guild_id: string;
  readonly namespace_prefix: string;
}

export interface ShadowDeps {
  /** existing bot Gateway client factory. */
  readonly getBotClient: () => Promise<Client | null>;
  /** map a world slug → its guild snowflake + namespace prefix (from manifest). */
  readonly resolveWorld: (world: string) => WorldWiring | undefined;
  /** map a world slug → its manifest file path (for the FR-10 allowlist read). */
  readonly manifestPath: (world: string) => string;
  /** the world this composition targets. */
  readonly world: string;
  /** initial apply_mode (seeded from the apply-mode config surface). */
  readonly initialMode: ApplyMode;
}

/** Deploy-provided NATS + signer for the LIVE AcvpEmitter (operator boundary). */
export interface LiveAuditDeps {
  readonly nats: {
    publish(subject: string, data: Uint8Array, opts?: { headers?: unknown }): void | Promise<unknown>;
  };
  readonly signer: Signer;
  readonly prevHashStore?: PrevHashStore;
}

function liveRosterCfg(deps: ShadowDeps): LiveRosterConfig {
  return {
    resolve: (w) => {
      const wiring = deps.resolveWorld(w);
      return wiring && { guild_id: wiring.guild_id, namespace_prefix: wiring.namespace_prefix };
    },
  };
}
function liveWriterCfg(deps: ShadowDeps): LiveWriterConfig {
  return {
    resolve: (w) => {
      const wiring = deps.resolveWorld(w);
      return wiring && { guild_id: wiring.guild_id };
    },
    world: deps.world,
  };
}
function liveAllowlistCfg(deps: ShadowDeps): LiveAllowlistConfig {
  return { manifestPath: deps.manifestPath, ttlMs: 10_000 };
}

/**
 * Build the MODE-CONTROL (the apply_mode `Ref` + the shared batch-duration lock,
 * B5/R-10). The gate reads this `Ref` AT INVOCATION; a `rollback` flips it under
 * the same lock so it serializes to a batch boundary.
 */
export function buildModeControl(initial: ApplyMode): Effect.Effect<ModeControl> {
  return makeModeControl(initial);
}

/**
 * The SHADOW-PREVIEW Layer stack — MOCK RosterSource + MOCK RoleWriter +
 * recording-or-live AcvpEmitter + in-memory WorldLock + the FR-10 allowlist.
 * Zero Discord writes. The gate (provided here) STILL rejects writes under
 * SHADOW exactly as it would for the LIVE stack — the only difference is the
 * inner writer never gets called.
 *
 * `emitterLayer` is passed in so a shadow preview can use a recording emitter
 * (tests) or the live NATS emitter (production preview). The gate's
 * write-after-audit still confirms `shadow.role.rejected.v1` per attempted write.
 */
export function shadowPreviewLayer(
  deps: ShadowDeps,
  mode: ModeControl,
  currentMapHash: () => string,
  emitterLayer: Layer.Layer<AcvpEmitter>,
): Layer.Layer<GateCheckedRoleWriter | RosterSource> {
  const innerWriter = RoleWriterMock;
  const allowlist = makeAdminAllowlistLive(liveAllowlistCfg(deps));
  const worldLock = makeInMemoryWorldLock();

  // The gate composes the inner writer + emitter + world-lock at build; the
  // allowlist is required at INVOCATION (the fresh write-boundary re-check), so
  // it is provided alongside the gate Layer.
  const gate = makeGateCheckedRoleWriter(mode, currentMapHash).pipe(
    Layer.provide(Layer.mergeAll(innerWriter, emitterLayer, worldLock)),
  );

  return Layer.mergeAll(gate, RosterSourceMock, allowlist) as Layer.Layer<
    GateCheckedRoleWriter | RosterSource
  >;
}

/**
 * The LIVE-APPLY Layer stack — LIVE RosterSource + LIVE RoleWriter (the gated
 * adapter) + LIVE NATS AcvpEmitter + in-memory WorldLock + FR-10 allowlist.
 *
 * The LIVE writer is handed to `GateCheckedRoleWriter` as its `inner` Layer and
 * is reachable ONLY through it (R-13). The CV2/web lenses never see the raw
 * writer. Apply requires apply_mode == LIVE (read at invocation) AND a
 * `WriteCapability` (minted only by the substrate's authorized go_live).
 */
export function liveApplyLayer(
  deps: ShadowDeps,
  audit: LiveAuditDeps,
  mode: ModeControl,
  currentMapHash: () => string,
): Layer.Layer<GateCheckedRoleWriter | RosterSource> {
  const innerWriter = makeRoleWriterLive(deps.getBotClient, liveWriterCfg(deps));
  const emitter = makeAcvpEmitterLive({
    nats: audit.nats,
    signer: audit.signer,
    prevHashStore: audit.prevHashStore,
  });
  const allowlist = makeAdminAllowlistLive(liveAllowlistCfg(deps));
  const worldLock = makeInMemoryWorldLock();

  const gate = makeGateCheckedRoleWriter(mode, currentMapHash).pipe(
    Layer.provide(Layer.mergeAll(innerWriter, emitter, worldLock)),
  );

  return Layer.mergeAll(
    gate,
    makeRosterSourceLive(deps.getBotClient, liveRosterCfg(deps)),
    allowlist,
  ) as Layer.Layer<GateCheckedRoleWriter | RosterSource>;
}

/** Re-exported for tests / callers that need the raw building blocks. */
export {
  makeRosterSourceLive,
  RosterSourceMock,
  makeRoleWriterLive,
  RoleWriterMock,
  makeAcvpEmitterLive,
  makeAdminAllowlistLive,
  makeInMemoryWorldLock,
};
