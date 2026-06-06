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
  ScoreSource,
  AcvpEmitter,
  WorldLock,
  AdminAllowlistSource,
  type ModeControl,
} from "./substrate.ts";
import type { ApplyMode } from "@freeside-worlds/shadow-substrate";
import type { WriteCapability } from "@freeside-worlds/shadow-substrate";
import { makeRosterSourceLive, type LiveRosterConfig } from "./roster-source.live.ts";
import { RosterSourceMock } from "./roster-source.mock.ts";
import { makeRoleWriterLive, makeGatedRoleGc, type LiveWriterConfig } from "./role-writer.live.ts";
import { RoleWriterMock } from "./role-writer.mock.ts";
import { makeScoreSourceLive, type LiveScoreConfig } from "./score-source.live.ts";
import { ScoreSourceMock } from "./score-source.mock.ts";
import { makeAcvpEmitterLive } from "./acvp-emitter.live.ts";
import { makeAdminAllowlistLive, type LiveAllowlistConfig } from "./admin-allowlist.live.ts";
import { makeInMemoryWorldLock } from "./world-lock.ts";
import { computeRollbackPlan, type RolesCreatedEntry, type RoleAssignmentCount } from "./coexistence.ts";
import { CommunityScoreClient } from "@freeside-characters/persona-engine/score/community-client";

// ── Per-world wiring resolved from the world manifest (purupuru.yaml) ────────

export interface WorldWiring {
  readonly guild_id: string;
  readonly namespace_prefix: string;
}

/**
 * Per-world LIVE score wiring (bd-tfl). Resolves a world slug → the score-api
 * base URL + the community slug + the community-scoped API key. The presence of
 * the API KEY is the LIVE/MOCK flag (see `resolveScoreClient`): present ⇒ LIVE
 * ScoreSource (real Purupuru tiers); absent/undefined ⇒ MOCK ScoreSource.
 */
export interface WorldScoreWiring {
  /** score-api base URL, e.g. https://score-api-production.up.railway.app. */
  readonly scoreApiUrl: string;
  /** the community slug, e.g. "purupuru". */
  readonly community: string;
  /** the community-scoped score-api key (x-api-key). undefined ⇒ MOCK. */
  readonly apiKey: string | undefined;
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
  /**
   * map a world slug → its LIVE score wiring (bd-tfl). OPTIONAL: when omitted (or
   * when the resolved wiring has no `apiKey`), the composition uses the MOCK
   * ScoreSource — so the substrate's `loadLatentCounts` still resolves and the
   * shadow preview works with NO score-api provisioning. Supply it (with a real
   * `apiKey`) to read live Purupuru tiers.
   */
  readonly resolveScoreWiring?: (world: string) => WorldScoreWiring | undefined;
}

/** Deploy-provided NATS + signer for the LIVE AcvpEmitter (operator boundary). */
export interface LiveAuditDeps {
  readonly nats: {
    publish(subject: string, data: Uint8Array, opts?: { headers?: unknown }): void | Promise<unknown>;
  };
  readonly signer: Signer;
  readonly prevHashStore?: PrevHashStore;
}

/**
 * SHARED world→guild resolver (CLEANUP, FAGAN iter-2): the single helper the
 * roster reader, the live writer, AND the rollback GC all derive their per-world
 * wiring from. One place maps a world slug → `{ guild_id, namespace_prefix }`, so
 * the namespace prefix the writer/GC guard against can never drift from the one
 * the roster reader classifies `managed` with.
 */
function resolveGuild(
  deps: ShadowDeps,
  world: string,
): { readonly guild_id: string; readonly namespace_prefix: string } | undefined {
  const wiring = deps.resolveWorld(world);
  return wiring && { guild_id: wiring.guild_id, namespace_prefix: wiring.namespace_prefix };
}

function liveRosterCfg(deps: ShadowDeps): LiveRosterConfig {
  return { resolve: (w) => resolveGuild(deps, w) };
}
function liveWriterCfg(deps: ShadowDeps): LiveWriterConfig {
  const wiring = resolveGuild(deps, deps.world);
  return {
    resolve: (w) => {
      const g = resolveGuild(deps, w);
      return g && { guild_id: g.guild_id };
    },
    world: deps.world,
    // FR-9 prefix the live writer's create/assign guard enforces. Resolved from
    // the SAME manifest wiring the roster reader uses (resolveGuild). A missing
    // wiring → empty prefix, which the writer's FAIL-CLOSED guard treats as
    // refuse-EVERY-role_key (fail-safe: no write can slip through an unconfigured
    // world; the guard refuses on "" rather than passing via startsWith("")).
    namespacePrefix: wiring?.namespace_prefix ?? "",
  };
}
function liveAllowlistCfg(deps: ShadowDeps): LiveAllowlistConfig {
  return { manifestPath: deps.manifestPath, ttlMs: 10_000 };
}

/**
 * Raised when a LIVE-apply composition is requested for a world that has no LIVE
 * score wiring (Bridgebuilder #3). The pre-fix `resolveScoreLayer` returned the
 * MOCK (zeros) for an unwired world REGARDLESS of mode — a fail-OPEN in the gated
 * LIVE path (a LIVE go_live would read mock-zeros and create roles assigning
 * nobody). The composition root refuses to build a LIVE stack on mock score.
 */
export class LiveScoreWiringMissingError extends Error {
  constructor(public readonly world: string) {
    super(
      `LIVE apply requested for world '${world}' but no LIVE score wiring is configured ` +
        `(resolveScoreWiring absent, or the world has no non-empty apiKey). Refusing to fall back ` +
        `to the MOCK ScoreSource in a LIVE path (it would read mock-zeros and assign nobody). ` +
        `MOCK score is allowed ONLY for SHADOW preview.`,
    );
    this.name = "LiveScoreWiringMissingError";
  }
}

/**
 * Resolve the ScoreSource Layer for this composition (bd-tfl). MODE-AWARE
 * (Bridgebuilder #3) — the SHADOW-vs-LIVE distinction is load-bearing:
 *   • LIVE  → REQUIRE live score wiring; FAIL CLOSED (throw
 *     `LiveScoreWiringMissingError`) when the target world lacks a non-empty
 *     `apiKey`. NEVER silently fall back to mock-zeros in the gated write path.
 *   • SHADOW→ MOCK is an allowed fallback (a shadow preview must work with NO
 *     score-api provisioning); LIVE wiring is still used when present (the read
 *     is read-only, so a production preview MAY read real Purupuru tiers).
 *
 * The API-KEY's presence is the LIVE/MOCK selector (mirrors the brief's env gate:
 * `SCORE_PURUPURU_API_KEY` present ⇒ LIVE, absent ⇒ MOCK).
 */
function resolveScoreLayer(deps: ShadowDeps, mode: "SHADOW" | "LIVE"): Layer.Layer<ScoreSource> {
  const resolve = deps.resolveScoreWiring;
  const target = resolve?.(deps.world);
  const targetIsLive = !!target && !!target.apiKey && target.apiKey.length > 0;

  if (mode === "LIVE" && !targetIsLive) {
    // FAIL CLOSED: a LIVE composition on mock score is the fail-open the review
    // flagged. Refuse at build time.
    throw new LiveScoreWiringMissingError(deps.world);
  }
  if (!resolve || !targetIsLive) {
    // SHADOW (or LIVE with — unreachable here — wiring): MOCK is the safe default.
    return ScoreSourceMock;
  }
  // Eagerly build a per-world client factory; LIVE only when an apiKey is present.
  const cfg: LiveScoreConfig = {
    clientFor: (world: string): CommunityScoreClient | undefined => {
      const w = resolve(world);
      if (!w || !w.apiKey || w.apiKey.length === 0) return undefined;
      return new CommunityScoreClient({
        baseUrl: w.scoreApiUrl,
        apiKey: w.apiKey,
        community: w.community,
      });
    },
  };
  return makeScoreSourceLive(cfg);
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
): Layer.Layer<GateCheckedRoleWriter | RosterSource | ScoreSource> {
  const innerWriter = RoleWriterMock;
  const allowlist = makeAdminAllowlistLive(liveAllowlistCfg(deps));
  const worldLock = makeInMemoryWorldLock();

  // The gate composes the inner writer + emitter + world-lock at build; the
  // allowlist is required at INVOCATION (the fresh write-boundary re-check), so
  // it is provided alongside the gate Layer.
  const gate = makeGateCheckedRoleWriter(mode, currentMapHash).pipe(
    Layer.provide(Layer.mergeAll(innerWriter, emitterLayer, worldLock)),
  );

  // ScoreSource (bd-tfl): MOCK by default; LIVE only when the target world has a
  // community-scoped key wired (resolveScoreWiring). The score READ is read-only
  // (no Discord writes), so a production shadow preview MAY read real Purupuru
  // tiers while the writer stays mocked — that IS the point of the preview. MOCK
  // fallback is allowed here because this is the SHADOW stack (#3).
  const score = resolveScoreLayer(deps, "SHADOW");

  return Layer.mergeAll(gate, RosterSourceMock, allowlist, score) as Layer.Layer<
    GateCheckedRoleWriter | RosterSource | ScoreSource
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
): Layer.Layer<GateCheckedRoleWriter | RosterSource | ScoreSource> {
  const emitter = makeAcvpEmitterLive({
    nats: audit.nats,
    signer: audit.signer,
    prevHashStore: audit.prevHashStore,
  });
  return liveApplyLayerWithEmitter(deps, emitter, mode, currentMapHash);
}

/**
 * The LIVE-APPLY Layer stack, parameterized by an INJECTED `AcvpEmitter` Layer
 * (bd-han / PART C). Identical to {@link liveApplyLayer} except the audit emitter
 * is supplied directly rather than constructed from `LiveAuditDeps` (NATS +
 * signer). This is the seam the role-sync LIVE boot uses to run a LIVE apply with
 * a DURABLE-RECORDING interim audit backend (`acvp-emitter.recording-live.ts`)
 * BEFORE the signed-NATS deps are wired (bd-3v2). The gate's write-after-audit,
 * authz re-check at the write boundary, and the LIVE writer (the single gated
 * adapter) are UNCHANGED — only the audit envelope backend differs.
 *
 * The LIVE writer is handed to `GateCheckedRoleWriter` as its `inner` Layer and is
 * reachable ONLY through it (R-13). ScoreSource still FAILS CLOSED in LIVE mode
 * when no community-scoped key is wired (no mock-zeros in the gated write path).
 */
export function liveApplyLayerWithEmitter(
  deps: ShadowDeps,
  emitter: Layer.Layer<AcvpEmitter>,
  mode: ModeControl,
  currentMapHash: () => string,
): Layer.Layer<GateCheckedRoleWriter | RosterSource | ScoreSource> {
  const innerWriter = makeRoleWriterLive(deps.getBotClient, liveWriterCfg(deps));
  const allowlist = makeAdminAllowlistLive(liveAllowlistCfg(deps));
  const worldLock = makeInMemoryWorldLock();

  const gate = makeGateCheckedRoleWriter(mode, currentMapHash).pipe(
    Layer.provide(Layer.mergeAll(innerWriter, emitter, worldLock)),
  );

  // ScoreSource (bd-tfl): LIVE requires a community-scoped key — resolveScoreLayer
  // FAILS CLOSED (throws LiveScoreWiringMissingError) in LIVE mode if absent (#3).
  // No mock-zeros fallback in the gated write path.
  const score = resolveScoreLayer(deps, "LIVE");

  return Layer.mergeAll(
    gate,
    makeRosterSourceLive(deps.getBotClient, liveRosterCfg(deps)),
    allowlist,
    score,
  ) as Layer.Layer<GateCheckedRoleWriter | RosterSource | ScoreSource>;
}

/**
 * Build the FULL LIVE orchestration-level Layer stack for the role-sync invoker
 * (bd-han / PART C). The substrate gate's `applyBatch` RE-RESOLVES the bare
 * `RoleWriter | AcvpEmitter | WorldLock | AdminAllowlistSource` at the write
 * boundary (server-side authz re-check + write-after-audit), so those SAME
 * instances must ALSO be present at the orchestration's top level — not only
 * provided INTO the gate. This helper builds ONE shared set of bare LIVE services
 * (the LIVE writer, the injected emitter, an in-memory world lock, the FR-10 live
 * allowlist), wires them into the gate, AND merges them at the top so the
 * re-resolution sees the SAME instances (mirrors the SHADOW branch + the
 * orchestrator test's full stack). The result satisfies the orchestration's
 * required context exactly. Authz / binding guards are untouched — this only
 * assembles the LIVE stack with the provided audit backend.
 */
export function liveApplyOrchestrationLayer(
  deps: ShadowDeps,
  emitter: Layer.Layer<AcvpEmitter>,
  mode: ModeControl,
  currentMapHash: () => string,
): Layer.Layer<
  | GateCheckedRoleWriter
  | RosterSource
  | ScoreSource
  | RoleWriter
  | AcvpEmitter
  | WorldLock
  | AdminAllowlistSource
> {
  // ONE shared set of bare LIVE services (gate AND top-level re-resolution agree).
  const innerWriter = makeRoleWriterLive(deps.getBotClient, liveWriterCfg(deps));
  const allowlist = makeAdminAllowlistLive(liveAllowlistCfg(deps));
  const worldLock = makeInMemoryWorldLock();

  const gate = makeGateCheckedRoleWriter(mode, currentMapHash).pipe(
    Layer.provide(Layer.mergeAll(innerWriter, emitter, worldLock)),
  );

  // ScoreSource FAILS CLOSED in LIVE mode when no community-scoped key is wired.
  const score = resolveScoreLayer(deps, "LIVE");

  return Layer.mergeAll(
    gate,
    makeRosterSourceLive(deps.getBotClient, liveRosterCfg(deps)),
    score,
    // the bare write-boundary services the gate's applyBatch re-resolves:
    innerWriter,
    emitter,
    worldLock,
    allowlist,
  ) as Layer.Layer<
    | GateCheckedRoleWriter
    | RosterSource
    | ScoreSource
    | RoleWriter
    | AcvpEmitter
    | WorldLock
    | AdminAllowlistSource
  >;
}

/**
 * Wire the rollback-GC execution path (B2, FAGAN iter-2). Sprint 405 / Task
 * 405.4 added the pure `computeRollbackPlan` + the gated `makeGatedRoleGc`, but
 * nothing connected them — so a rollback could not actually delete the orphan
 * empty roles. THIS is the only allowlisted delete path (the GC lives in the
 * single gated adapter; the namespace guard + member-cache-hydrated zero-member
 * guard live there).
 *
 * Computes the plan from the substrate's `roles_created` ledger + the current
 * per-role assignment counts (from the live roster), then executes ONLY the
 * `gc` (zero-assignment Freeside-namespaced) deletes under the provided
 * `WriteCapability`. Assigned roles are KEPT (R-6 — never strip users); the
 * returned `warnings` surface them. A per-role GC failure is collected, not
 * thrown (a failed delete frees no budget but must not abort the rollback).
 *
 * The `cap` is minted by the substrate's authorized `rollback`/`goLive` path —
 * the GC requires it exactly like the write path (a delete is a mutation).
 */
export function executeRollbackGc(
  deps: ShadowDeps,
  cap: WriteCapability,
  rolesCreated: readonly RolesCreatedEntry[],
  assignments: readonly RoleAssignmentCount[],
  sleep?: (ms: number) => Promise<void>,
): Effect.Effect<{
  readonly gc_attempted: number;
  readonly gc_deleted: number;
  readonly kept: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}> {
  const plan = computeRollbackPlan(rolesCreated, assignments);
  // CLEANUP (FAGAN iter-3): derive the GC's namespace prefix from the SAME config
  // object the live writer's create/assign guard uses (`liveWriterCfg`). Both the
  // writer Layer config and the GC guard now read ONE `namespacePrefix` field, so
  // they can never drift (and both share the fail-closed "" → refuse-all
  // semantics). Previously the GC recomputed `wiring?.namespace_prefix ?? ""`
  // independently — a second source of truth that could skew from the writer's.
  const writerCfg = liveWriterCfg(deps);
  const gc = makeGatedRoleGc(deps.getBotClient, writerCfg, writerCfg.namespacePrefix, sleep);

  return Effect.gen(function* () {
    const errors: string[] = [];
    let deleted = 0;
    for (const r of plan.gc) {
      const res = yield* Effect.either(gc(cap, r.role_id, r.role_key));
      if (res._tag === "Right") deleted += 1;
      else errors.push(`GC '${r.role_key}' (${r.role_id}): ${res.left.kind}: ${res.left.message}`);
    }
    return {
      gc_attempted: plan.gc.length,
      gc_deleted: deleted,
      kept: plan.keep.length,
      warnings: plan.warnings,
      errors,
    };
  });
}

/** Re-exported for tests / callers that need the raw building blocks. */
export {
  makeRosterSourceLive,
  RosterSourceMock,
  makeRoleWriterLive,
  makeGatedRoleGc,
  RoleWriterMock,
  makeScoreSourceLive,
  ScoreSourceMock,
  makeAcvpEmitterLive,
  makeAdminAllowlistLive,
  makeInMemoryWorldLock,
};
