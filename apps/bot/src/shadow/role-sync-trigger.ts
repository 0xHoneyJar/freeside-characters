/**
 * shadow/role-sync-trigger.ts — the VOICELESS, CM-facing INVOKER for the
 * Purupuru tier→role sync (bd-71y).
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
 * `go-live-orchestrator.ts::runTierRoleGoLive` is the RUNTIME entrypoint for
 * per-member tier→role assignment — but nothing INVOKES it. This module is that
 * invoker: a Discord admin slash command (`/role-sync`) an authorized community
 * manager (CM) uses to run the sync, SHADOW preview (default) → LIVE apply.
 *
 * ── THE FLOW (bd-71y) ────────────────────────────────────────────────────────
 *   1. CM invokes `/role-sync` with an explicit `mode` (SHADOW preview | LIVE
 *      apply). DEFAULT is SHADOW — safe-by-default; LIVE requires the explicit
 *      choice AND passes through runTierRoleGoLive's authz + goLive.
 *   2. Resolve the CM's ACTOR — the invoking CM's identity-api `user_id`, taken
 *      from the existing verified `AuthContext` the bot's auth-bridge attaches
 *      (`claims.sub`). A non-verified invocation is REFUSED before any read (we
 *      cannot authz an anon actor). The actor flows to runTierRoleGoLive, which
 *      calls `resolveAuthz` against `admin_principals` (deny ⇒ refuse, no reads).
 *   3. Read the tier→role map (`RoleMapConfig`) from config-service. If
 *      config-service is unwired/empty, fall back to the CM-OVERRIDABLE DEFAULT
 *      SEED map for Purupuru (role-sync-seed-map.ts).
 *   4. Call runTierRoleGoLive with the chosen apply_mode (the INJECTED
 *      orchestration port — the live wiring provides the real Effect run + the
 *      composition-root layer; tests inject a fake).
 *   5. Respond with the STRUCTURAL CV2 render of the result (role-sync-result-cv2)
 *      — who'd get / has which role, counts, skip breakdown. STRUCTURAL ONLY.
 *
 * ── VOICELESS (bd-71y / onboarding-as-voiceless-building brief) ───────────────
 * NO persona voice anywhere. The response is the structural result render +
 * plain status. There is NO import of any persona-engine voice/narration module
 * in this file (the score read path lives behind the INJECTED orchestration
 * port; this module never imports persona-engine at all). Messaging/components
 * come from config or the structural render — never persona-inferred.
 *
 * ── SAFE-BY-DEFAULT ──────────────────────────────────────────────────────────
 * The mode defaults to SHADOW (preview, zero writes). LIVE is reachable ONLY
 * when the CM passes `mode: LIVE` explicitly, and even then every write goes
 * through runTierRoleGoLive → goLive (authz + roster-freshness + the gate). This
 * trigger NEVER writes a role directly — the single gated write path
 * (`role-writer.live.ts` behind the substrate gate) is untouched.
 */
import type { RoleMapConfig, Hex64, RoleMapVersionInput } from "@freeside-worlds/shadow-substrate";
import { roleMapVersionHash } from "./substrate.ts";
import type {
  GoLiveOrchestrationInput,
  GoLiveOrchestrationResult,
} from "./go-live-orchestrator.ts";
import {
  buildPurupuruSeedRoleMap,
  type RoleMapSource,
} from "./role-sync-seed-map.ts";
import {
  roleSyncResultCV2Payload,
  type RoleSyncRenderContext,
} from "./role-sync-result-cv2.ts";
import {
  buildMemberRoster,
  type MemberSource,
  type MemberIdentityResolver,
  type MemberTierReader,
} from "./member-roster.ts";
import {
  memberDashboardCV2Payload,
  type MemberDashboardContext,
} from "./member-dashboard-cv2.ts";

/** The CM's resolved actor — the invoking CM's identity-api user_id. */
export interface ResolvedActor {
  /** identity-api `user_id` (claims.sub) — the value runTierRoleGoLive authzs. */
  readonly actor: string;
}

/**
 * Resolve the invoking CM's actor (identity-api user_id) from the request.
 * Returns null when the CM is NOT verified (anon / anon-fallback) — the trigger
 * refuses such an invocation before any read (we cannot authz an anon actor).
 *
 * The live wiring supplies this from the bot's existing verified `AuthContext`
 * (auth-bridge `claims.sub`); tests inject a fake. This is the existing identity
 * path the bot already uses for verify — NOT a new identity surface.
 */
export type ActorResolver = () => Promise<ResolvedActor | null> | ResolvedActor | null;

/**
 * Read the world's CM-authored tier→role map. Returns null when no map is
 * authored / config-service is unwired (caller falls back to the seed). The live
 * wiring backs this with `ConfigServiceClient.getRoleMap`; tests inject a fake.
 */
export type RoleMapReader = (world: string) => Promise<RoleMapConfig | null> | RoleMapConfig | null;

/**
 * Invoke the orchestration. INJECTED so the testable core is network-free: the
 * live wiring runs `runTierRoleGoLive(deps, input)` against the composition-root
 * layer (SHADOW preview = mock stack, LIVE apply = gated stack) and returns the
 * result; tests inject a fake that returns a fixed result (or throws to exercise
 * the failure path). The port surface is the orchestration INPUT (the trigger
 * builds it) → the orchestration RESULT.
 */
export type OrchestrationInvoker = (
  input: GoLiveOrchestrationInput,
) => Promise<GoLiveOrchestrationResult>;

/** The deploy-/test-provided ports the trigger core depends on. */
export interface RoleSyncTriggerDeps {
  /** the world this trigger targets (e.g. "purupuru"). */
  readonly world: string;
  /** resolve the invoking CM's actor (identity-api user_id) — null ⇒ not verified. */
  readonly resolveActor: ActorResolver;
  /** read the CM-authored role-map — null ⇒ use the default seed. */
  readonly readRoleMap: RoleMapReader;
  /** invoke runTierRoleGoLive against the composition-root layer. */
  readonly invokeOrchestration: OrchestrationInvoker;
  /**
   * the FR-7 world-config hash fields (guild_id + nft_contracts + namespace) the
   * `roleMapVersionHash` covers. Deploy-resolved from the world manifest; tests
   * supply a fixture. The role-map's `namespace_prefix` is used when this omits
   * one, but the guild_id + nft_contracts MUST come from the manifest.
   */
  readonly worldConfig: {
    readonly guild_id: string;
    readonly nft_contracts: ReadonlyArray<string>;
    /** optional override; defaults to the role-map's namespace_prefix. */
    readonly namespace_prefix?: string;
  };
  /** caller-supplied evaluation timestamp (no clock read in the core). */
  readonly now: () => string;
  /** verified token metadata for the batch AuthzContext (deploy-provided). */
  readonly tokenMetadata: GoLiveOrchestrationInput["tokenMetadata"];
  /** the FR-7 go_live transition version (deploy-/lifecycle-provided). */
  readonly transitionVersion: number;
  /**
   * OPTIONAL member-centric SHADOW wiring (bd-l08). When present AND the run is
   * SHADOW, the trigger produces the MEMBER-CENTRIC CM dashboard (each guild
   * member → their tier → their role + a before→after change indicator) instead
   * of the leaderboard-centric orchestration result. When absent OR the run is
   * LIVE, the trigger uses the existing orchestration path (preserved for the
   * LIVE-apply follow-up). Authz is unchanged — the actor is still resolved +
   * refused BEFORE any read.
   */
  readonly memberCentric?: MemberCentricShadowDeps;
}

/**
 * The member-centric SHADOW deps (bd-l08). All I/O is injected so the build is
 * network-free in tests; the boot composition backs `members` with the bot's
 * guild member READ, `resolveIdentity` with the two identity-api reads, and
 * `readTier` with the score community-client `walletProfile`.
 */
export interface MemberCentricShadowDeps {
  /** read the configured guild's members (+ display name + current managed roles). */
  readonly members: MemberSource;
  /** discord id → identity outcome (unlinked / no_wallet / linked + wallet). */
  readonly resolveIdentity: MemberIdentityResolver;
  /** wallet → community tier (or null when untiered). fail-soft per member. */
  readonly readTier: MemberTierReader;
}

/** The CM's chosen action — SHADOW preview (default) or LIVE apply. */
export type RoleSyncMode = "SHADOW" | "LIVE";

/** The trigger's structured outcome. `payload` is the CV2 message to send. */
export type RoleSyncOutcome =
  | {
      readonly kind: "rendered";
      /** the CV2 message payload (flags + components + inert mentions). */
      readonly payload: ReturnType<typeof roleSyncResultCV2Payload>;
      /** the apply_mode the run executed under (echoes the gate's Ref). */
      readonly applyMode: RoleSyncMode;
      /** the role-map provenance (CM-authored vs default seed). */
      readonly mapSource: RoleMapSource;
      readonly result: GoLiveOrchestrationResult;
    }
  | {
      readonly kind: "rendered-members";
      /** the member-centric dashboard CV2 payload (flags + components + inert mentions). */
      readonly payload: ReturnType<typeof memberDashboardCV2Payload>;
      /** SHADOW (the member-centric view is SHADOW-only in this build). */
      readonly applyMode: "SHADOW";
      /** the role-map provenance (CM-authored vs default seed). */
      readonly mapSource: RoleMapSource;
    }
  | {
      readonly kind: "refused";
      /** machine reason: why the trigger refused (no write, no read happened). */
      readonly reason: "not_verified";
      /** a plain, voiceless status string for the CM. */
      readonly message: string;
    }
  | {
      readonly kind: "error";
      /** the orchestration failed (authz deny, roster error, etc). */
      readonly message: string;
    };

/**
 * Compute the FR-7 `roleMapVersionHash` for a (role-map, world-config) pair. The
 * trigger uses the same value for `reportHash` and `currentMapHash` (an unchanged
 * map at invocation time — the gate's binding guard compares them).
 */
export function computeMapHash(
  roleMap: RoleMapConfig,
  worldSlug: string,
  worldConfig: RoleSyncTriggerDeps["worldConfig"],
): Hex64 {
  const namespace = worldConfig.namespace_prefix ?? roleMap.namespace_prefix;
  const input: RoleMapVersionInput = {
    role_rules: roleMap.rules,
    scaffolding_config: roleMap.scaffolding,
    world_config: {
      world_slug: worldSlug,
      guild_id: worldConfig.guild_id,
      namespace_prefix: namespace,
      nft_contracts: worldConfig.nft_contracts,
    },
  };
  return roleMapVersionHash(input);
}

/**
 * Run the voiceless tier→role sync trigger. The TESTABLE CORE — network-free:
 * actor resolution, role-map read, orchestration invocation, and config-service
 * read are all INJECTED ports. Returns a structured {@link RoleSyncOutcome}; the
 * Discord-interaction wiring (below / in the live module) maps it to a response.
 *
 * SAFE-BY-DEFAULT: `mode` defaults to SHADOW. Authz happens INSIDE
 * runTierRoleGoLive (the actor → admin_principals check); a not-verified CM is
 * refused HERE, before any read, because there is no actor to authz.
 */
export async function runRoleSyncTrigger(
  deps: RoleSyncTriggerDeps,
  mode: RoleSyncMode = "SHADOW",
): Promise<RoleSyncOutcome> {
  // (1) Resolve the CM's actor — REFUSE a non-verified invocation before any
  //     read. We cannot authz an anon; runTierRoleGoLive needs a real
  //     identity-api user_id to resolve against admin_principals.
  const resolved = await deps.resolveActor();
  if (!resolved) {
    return {
      kind: "refused",
      reason: "not_verified",
      message:
        "Refused: this command requires a verified identity. Run /verify to link your identity, then try again. (No data was read.)",
    };
  }

  // (2) Read the CM-authored role-map; fall back to the CM-overridable seed.
  const authored = await deps.readRoleMap(deps.world);
  const roleMap: RoleMapConfig = authored ?? buildPurupuruSeedRoleMap();
  const mapSource: RoleMapSource = authored ? "config-service" : "default-seed";

  // (2b) MEMBER-CENTRIC SHADOW (bd-l08): when the deploy wired the member-centric
  //      deps AND the run is SHADOW, produce the CM dashboard (each guild member →
  //      their tier → their role + a before→after indicator) instead of the
  //      leaderboard-centric orchestration. SHADOW-only + ZERO writes (this path
  //      never calls the orchestration / gate). The actor is already resolved +
  //      authz'd against admin_principals is the LIVE concern; for the SHADOW
  //      READ-ONLY preview the verified-actor refusal above is the gate. LIVE
  //      still flows through the existing orchestration path below.
  if (deps.memberCentric && mode === "SHADOW") {
    try {
      const roster = await buildMemberRoster({
        world: deps.world,
        roleMap,
        members: deps.memberCentric.members,
        resolveIdentity: deps.memberCentric.resolveIdentity,
        readTier: deps.memberCentric.readTier,
      });
      const ctx: MemberDashboardContext = { world: deps.world, mapSource };
      return {
        kind: "rendered-members",
        payload: memberDashboardCV2Payload(roster, ctx),
        applyMode: "SHADOW",
        mapSource,
      };
    } catch (e) {
      // The member roster read (guild members) failed entirely — a voiceless
      // structural error (fail-soft is per-member; a total guild-read failure
      // surfaces here). NO write occurred (SHADOW read-only).
      return {
        kind: "error",
        message: `Member roster (SHADOW) failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // (3) The FR-7 hash binds the run to the map it was computed against.
  const mapHash = computeMapHash(roleMap, deps.world, deps.worldConfig);

  // (4) Build the orchestration input + invoke. The chosen `mode` is the
  //     shadow/apply switch (SHADOW ⇒ no goLive, gate rejects → zero writes;
  //     LIVE ⇒ goLive flips + the gate writes through the gated adapter).
  const input: GoLiveOrchestrationInput = {
    world: deps.world,
    applyMode: mode,
    actor: resolved.actor,
    reportHash: mapHash,
    currentMapHash: mapHash,
    transitionVersion: deps.transitionVersion,
    evaluatedAt: deps.now(),
    roleMap,
    tokenMetadata: deps.tokenMetadata,
  };

  let result: GoLiveOrchestrationResult;
  try {
    result = await deps.invokeOrchestration(input);
  } catch (e) {
    // authz deny, roster error, score error, etc — all surface as a voiceless
    // structural error. NO write occurred for an authz-deny (it fails before the
    // mint); a LIVE error after the gate is reflected in the message.
    return {
      kind: "error",
      message: `Tier→role sync (${mode}) failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // (5) STRUCTURAL CV2 render of the result — voiceless.
  const ctx: RoleSyncRenderContext = { world: deps.world, mapSource };
  return {
    kind: "rendered",
    payload: roleSyncResultCV2Payload(result, ctx),
    applyMode: result.applyMode,
    mapSource,
    result,
  };
}

// ─── Discord-interaction surface (the slash command name + mode parsing) ──────

/** The slash command name a CM invokes to run the sync. */
export const ROLE_SYNC_COMMAND_NAME = "role-sync";
/** The option name carrying the SHADOW/LIVE choice. */
export const ROLE_SYNC_MODE_OPTION = "mode";

/**
 * Parse the CM's chosen mode from a raw option value. SAFE-BY-DEFAULT: anything
 * that is not exactly the (case-insensitive) string "live" resolves to SHADOW.
 * An absent option ⇒ SHADOW. The LIVE path requires the explicit, unambiguous
 * choice; a typo or absent value can NEVER silently select LIVE.
 */
export function parseRoleSyncMode(raw: string | undefined | null): RoleSyncMode {
  if (typeof raw !== "string") return "SHADOW";
  return raw.trim().toLowerCase() === "live" ? "LIVE" : "SHADOW";
}
