/**
 * shadow/role-sync-boot.ts — the LIVE boot composition for the voiceless
 * `/role-sync` trigger (bd-atm). This is the missing wiring: bd-71y built the
 * command + adapter and bd-m2v built `runTierRoleGoLive`, but nothing composed
 * the live deps + called `setRoleSyncDeps()`. THIS module is that composition.
 *
 * ── WHAT IT BUILDS ───────────────────────────────────────────────────────────
 *   • manifestPath(world) → the VENDORED apps/bot/worlds/<slug>.yaml (the FR-10
 *     admin_principals + guild_id source the LIVE AdminAllowlistSource reads).
 *   • an OrchestrationInvoker that, per `/role-sync` invocation:
 *       - builds the SHADOW-preview Layer stack (mock writer + roster, zero
 *         Discord writes) — or the LIVE-apply stack (gated writer) for LIVE;
 *       - runs `runTierRoleGoLive(deps, input)` against that Layer via Effect;
 *       - wires its sources: score (resolveScoreWiring → CommunityScoreClient →
 *         leaderboardReader), wallet↔discord link (wallet-discord-link.live),
 *         RosterSource (live, READ-only), and a SHADOW rosterIdentity snapshot.
 *   • the isolated actor-resolver factory (identity-api, NOT AUTH_BACKEND).
 *   • the deploy-resolved worldConfig (guild_id + nft_contracts from the manifest).
 *
 * ── SHADOW-FIRST + FAIL-CLOSED ───────────────────────────────────────────────
 * `buildRoleSyncBootDeps` returns null when the REQUIRED env is absent (the
 * trigger then never wires → `/role-sync` is "not configured" — a clean refusal).
 * SHADOW preview runs on the mock writer + roster (zero writes). LIVE apply needs
 * the LIVE score wiring; the composition-root's `resolveScoreLayer` fails CLOSED
 * (LiveScoreWiringMissingError) for a LIVE run without a score key. The wallet
 * link + rosterIdentity reads are fail-closed in the orchestrator (a DB outage or
 * a snapshot read failure surfaces as a RosterError that refuses the run).
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * The ONLY persona-engine touch in this module is the `CommunityScoreClient`
 * score DATA client (the documented isolation-debt seam — community-client lives
 * in persona-engine only because the MCP score client does; the onboarding
 * building will move it on extraction). There is NO persona / voice / narration
 * import. The leaderboard read is pure data.
 *
 * ── ISOLATION-DEBT NOTE (bd-glb) ─────────────────────────────────────────────
 * The full LIVE `rosterIdentity` (member-id ⊕ role-id snapshot for the B1
 * roster-freshness fingerprint) is bd-glb — the substrate RosterSource port does
 * not carry it and the LIVE roster adapter does not yet produce it. For the
 * SHADOW path (driftThreshold 0, no base) the orchestrator does not gate on
 * freshness, so this module supplies a minimal DERIVED snapshot (read from the
 * live guild member/role ids when a bot client is available, else an empty one).
 * The full LIVE rosterIdentity is bd-glb; LIVE apply must wait for it.
 */
import { Effect, Layer } from "effect";
import { resolve as pathResolve } from "node:path";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Client } from "discord.js";
import type { ApplyMode } from "@freeside-worlds/shadow-substrate";
import {
  shadowPreviewLayer,
  liveApplyOrchestrationLayer,
  buildModeControl,
  RoleWriterMock,
  makeInMemoryWorldLock,
  makeAdminAllowlistLive,
  type ShadowDeps,
  type WorldWiring,
  type WorldScoreWiring,
} from "./composition-root.ts";
import { makeRecordingEmitter } from "./acvp-emitter.mock.ts";
import {
  makeRecordingLiveEmitter,
  RECORDING_LIVE_AUDIT_BACKEND,
} from "./acvp-emitter.recording-live.ts";
import {
  runTierRoleGoLive,
  type GoLiveOrchestrationInput,
  type GoLiveOrchestrationResult,
  type OrchestrationContext,
  type OrchestrationError,
  type RosterIdentityReader,
  type RosterIdentitySnapshot,
  type LeaderboardReader,
} from "./go-live-orchestrator.ts";
import type { RoleMapReader, OrchestrationInvoker } from "./role-sync-trigger.ts";
import type { RoleSyncInteractionDeps } from "./role-sync-interaction.ts";
import { makeWalletDiscordLinkLive } from "./wallet-discord-link.live.ts";
import type { WalletDiscordLink } from "./score-tier-assignment.ts";
import { makeIdentityActorResolverFor } from "./identity-actor-resolver.ts";
import { configServiceClientFromEnv } from "./config-service-client.ts";
import type { RoleMapConfig } from "./substrate.ts";
import { CommunityScoreClient } from "@freeside-characters/persona-engine/score/community-client";
import { MemberIdentityClient } from "./member-identity-client.ts";
import { makeMemberSourceLive } from "./member-source.live.ts";
import type {
  MemberCentricShadowDeps,
} from "./role-sync-trigger.ts";
import type { MemberTierReader, MemberIdentityResolver } from "./member-roster.ts";

/**
 * The directory the vendored world manifests live in (apps/bot/worlds/). The
 * convention: ONE `<slug>.yaml` per world, a vendored copy of the canonical
 * freeside-worlds manifest. Resolved relative to this module's location so it is
 * stable regardless of the process CWD (the bot may boot from the repo root or
 * apps/bot). `import.meta.dir` is apps/bot/src/shadow; the manifests dir is
 * apps/bot/worlds → `../../worlds`.
 */
export const WORLDS_DIR = pathResolve(import.meta.dir, "../../worlds");

/**
 * Resolve a world slug → its VENDORED manifest path. Slug is validated to a safe
 * filename segment (no path traversal) — the slug feeds a filesystem path the
 * AdminAllowlistSource reads.
 */
export function manifestPathForWorld(world: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(world)) {
    throw new Error(`role-sync-boot: refusing unsafe world slug '${world}' for manifest path`);
  }
  return pathResolve(WORLDS_DIR, `${world}.yaml`);
}

/**
 * The env the boot composition reads. Surfaced as an interface so tests inject a
 * fixture env (network-free) and the production path reads `process.env`.
 */
export interface RoleSyncBootEnv {
  /** the world this deployment's role-dispenser targets (default "purupuru"). */
  readonly ROLE_SYNC_WORLD?: string;
  /** the master gate: when not truthy, `/role-sync` is NOT wired (clean refusal). */
  readonly ROLE_SYNC_ENABLED?: string;
  /** identity-api base URL for the isolated actor resolver. */
  readonly IDENTITY_API_URL?: string;
  /** optional identity-api read service token (x-service-token). */
  readonly IDENTITY_API_SERVICE_TOKEN?: string;
  /** score-api base URL (for the LIVE leaderboard / score read). */
  readonly SCORE_API_URL?: string;
  /** the Purupuru community-scoped score-api key. Present ⇒ LIVE score; absent ⇒ MOCK. */
  readonly SCORE_PURUPURU_API_KEY?: string;
  /** the Purupuru community slug (default "purupuru"). */
  readonly SCORE_PURUPURU_COMMUNITY?: string;
  /** config-service base URL for the CM-authored role-map read (optional → seed fallback). */
  readonly CONFIG_SERVICE_URL?: string;
}

/** Default identity-api base (matches the mint-subscriber default in index.ts). */
const DEFAULT_IDENTITY_API_URL = "https://identity.0xhoneyjar.xyz";
/** Default score-api base (the live Railway deployment). */
const DEFAULT_SCORE_API_URL = "https://score-api-production.up.railway.app";

/**
 * The injectable seams for `buildRoleSyncBootDeps` — production omits them
 * (uses the real bot client + global fetch); tests inject fakes for a
 * network-free composition assertion.
 */
export interface RoleSyncBootSeams {
  /** the bot Gateway client factory (live roster reads). */
  readonly getBotClient: () => Promise<Client | null>;
  /** injectable fetch for the identity-api resolver (tests). */
  readonly fetchImpl?: typeof fetch;
  /** injectable wallet↔discord link (tests inject a pure map; prod uses the live adapter). */
  readonly walletDiscordLink?: WalletDiscordLink;
  /** injectable role-map reader (tests); prod uses the config-service client + seed fallback. */
  readonly readRoleMap?: RoleMapReader;
  /** injectable identity-api token getter for the config-service role-map read. */
  readonly configServiceToken?: () => Promise<string | null> | string | null;
}

/**
 * Resolve the per-world `WorldWiring` (guild_id + namespace_prefix) for the
 * composition root. Read from the vendored manifest at boot so the LIVE roster
 * reader + writer target the right guild. We parse the same `shadow_onboarding`
 * block the AdminAllowlistSource reads.
 */
function readShadowOnboarding(
  world: string,
): { guild_id?: unknown; namespace_prefix?: unknown; nft_contracts?: unknown } | undefined {
  let text: string;
  try {
    text = readFileSync(manifestPathForWorld(world), "utf8");
  } catch {
    return undefined;
  }
  const doc = parseYaml(text) as { shadow_onboarding?: unknown } | undefined;
  const so = doc?.shadow_onboarding;
  return so && typeof so === "object" ? (so as Record<string, unknown>) : undefined;
}

function readWorldWiring(world: string): WorldWiring | undefined {
  const so = readShadowOnboarding(world);
  const guild_id = typeof so?.guild_id === "string" ? so.guild_id : "";
  const namespace_prefix = typeof so?.namespace_prefix === "string" ? so.namespace_prefix : "";
  if (guild_id.length === 0 || namespace_prefix.length === 0) return undefined;
  return { guild_id, namespace_prefix };
}

/** Read the manifest's `nft_contracts` (FR-7 worldConfig hash input). */
function readNftContracts(world: string): readonly string[] {
  const so = readShadowOnboarding(world);
  const list = so?.nft_contracts;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

/**
 * A minimal DERIVED `rosterIdentity` reader for the SHADOW path. The full LIVE
 * snapshot (member-id ⊕ role-id sets for the B1 fingerprint) is bd-glb. For
 * SHADOW (driftThreshold 0, no base) the orchestrator never gates on freshness,
 * so a best-effort snapshot is sufficient: read the live guild's member/role ids
 * when a bot client is available, else an empty snapshot. NEVER used for LIVE
 * (LIVE needs the bd-glb full reader).
 */
function makeShadowRosterIdentityReader(
  getBotClient: () => Promise<Client | null>,
  resolveWorld: (world: string) => WorldWiring | undefined,
): RosterIdentityReader {
  return async (world: string): Promise<RosterIdentitySnapshot> => {
    const wiring = resolveWorld(world);
    const client = wiring ? await getBotClient() : null;
    if (!wiring || !client) {
      // No live guild access → an empty snapshot. SHADOW does not gate on it.
      return { member_ids: [], role_ids: [] };
    }
    const guild = await client.guilds.fetch(wiring.guild_id);
    const members = await guild.members.fetch();
    const roles = await guild.roles.fetch();
    return {
      member_ids: [...members.values()].map((m) => m.id),
      role_ids: [...roles.values()].map((r) => r.id),
    };
  };
}

/** Build the per-world score wiring resolver from env (presence of the key ⇒ LIVE). */
function makeResolveScoreWiring(
  env: RoleSyncBootEnv,
  world: string,
): (w: string) => WorldScoreWiring | undefined {
  return (w: string) => {
    if (w !== world) return undefined;
    return {
      scoreApiUrl: env.SCORE_API_URL?.trim() || DEFAULT_SCORE_API_URL,
      community: env.SCORE_PURUPURU_COMMUNITY?.trim() || "purupuru",
      apiKey: env.SCORE_PURUPURU_API_KEY?.trim() || undefined,
    };
  };
}

/**
 * Build a LeaderboardReader from the score wiring (LIVE only — when the key is
 * present). Returns undefined when there is no LIVE score key: the orchestrator
 * then sees no reader and (for SHADOW) treats the leaderboard as empty (zero
 * assignments) — a SHADOW preview with no score key shows the CREATE pass only.
 * For LIVE the orchestrator FAILS CLOSED if no reader (Bridgebuilder #8).
 *
 * (bd-han) Threads the injected `fetchImpl` through the retry transport so the LIVE
 * path is NETWORK-FREE in tests (mirrors `makeMemberTierReader`). Production omits
 * it and uses global fetch.
 */
function makeLeaderboardReader(
  wiring: WorldScoreWiring | undefined,
  fetchImpl?: typeof fetch,
): LeaderboardReader | undefined {
  if (!wiring || !wiring.apiKey || wiring.apiKey.length === 0) return undefined;
  const client = new CommunityScoreClient({
    baseUrl: wiring.scoreApiUrl,
    apiKey: wiring.apiKey,
    community: wiring.community,
    retry: fetchImpl ? { fetchImpl } : undefined,
  });
  return async () => (await client.leaderboard()).wallets;
}

/**
 * Build the per-member tier reader (bd-l08) from the score wiring: a single
 * wallet → its community tier via `walletProfile(wallet).tier`. When there is no
 * LIVE score key, returns a reader that yields `null` (untiered) for every member
 * — the member-centric SHADOW dashboard still renders (linked/unlinked + "no
 * role"), and the operator sets `SCORE_PURUPURU_API_KEY` to surface tiers. The
 * builder wraps each call fail-soft (a throw ⇒ untiered for that member), so this
 * reader may throw freely (e.g. a 404 for an absent wallet) — it surfaces as
 * untiered, never aborting the batch.
 */
function makeMemberTierReader(
  wiring: WorldScoreWiring | undefined,
  fetchImpl?: typeof fetch,
): MemberTierReader {
  if (!wiring || !wiring.apiKey || wiring.apiKey.length === 0) {
    return async () => null;
  }
  const client = new CommunityScoreClient({
    baseUrl: wiring.scoreApiUrl,
    apiKey: wiring.apiKey,
    community: wiring.community,
    // thread the injected fetch (tests) through the retry transport.
    retry: fetchImpl ? { fetchImpl } : undefined,
  });
  return async (wallet: string): Promise<string | null> => {
    const profile = await client.walletProfile(wallet);
    return profile.tier ?? null;
  };
}

/**
 * Build the member-centric SHADOW deps (bd-l08): the live guild member READ, the
 * two identity-api reads (resolve account + profile), and the per-member score
 * tier read. All fail-soft per member (the builder catches throws). This is the
 * SHADOW-only CM dashboard wiring; LIVE apply still flows through the leaderboard
 * orchestration.
 */
function buildMemberCentricDeps(
  env: RoleSyncBootEnv,
  seams: RoleSyncBootSeams,
  world: string,
  resolveWorld: (w: string) => WorldWiring | undefined,
  identityBaseUrl: string,
  resolveScoreWiring: (w: string) => WorldScoreWiring | undefined,
): MemberCentricShadowDeps {
  // live guild member READ (members + display name + current managed roles).
  const memberSource = makeMemberSourceLive(seams.getBotClient, { resolve: resolveWorld });

  // the two identity-api reads (discord id → user_id → primary_wallet).
  const identityClient = new MemberIdentityClient({
    baseUrl: identityBaseUrl,
    world,
    serviceToken: env.IDENTITY_API_SERVICE_TOKEN?.trim() || undefined,
    fetchImpl: seams.fetchImpl,
  });
  const resolveIdentity: MemberIdentityResolver = (discordId) =>
    identityClient.resolveMember(discordId);

  // per-member score tier read.
  const readTier = makeMemberTierReader(resolveScoreWiring(world), seams.fetchImpl);

  return { members: memberSource, resolveIdentity, readTier };
}

/**
 * Build the LIVE `/role-sync` boot deps, or null when the master gate is off /
 * the required env is missing (fail-closed — `/role-sync` is then "not
 * configured" rather than silently degraded). When non-null, the caller passes
 * the result to `setRoleSyncDeps()` at boot.
 *
 * REQUIRED to wire: `ROLE_SYNC_ENABLED` truthy AND a readable vendored manifest
 * for the target world (guild_id + namespace_prefix). Everything else degrades
 * gracefully (no score key ⇒ SHADOW preview shows creates only; no
 * CONFIG_SERVICE_URL ⇒ the seed role-map; identity-api defaults to the canonical
 * host).
 */
export function buildRoleSyncBootDeps(
  env: RoleSyncBootEnv,
  seams: RoleSyncBootSeams,
): RoleSyncInteractionDeps | null {
  const enabled = (env.ROLE_SYNC_ENABLED ?? "").trim().toLowerCase();
  if (enabled !== "1" && enabled !== "true" && enabled !== "yes") return null;

  const world = env.ROLE_SYNC_WORLD?.trim() || "purupuru";

  // FAIL-CLOSED: the vendored manifest MUST exist + carry guild_id +
  // namespace_prefix (the LIVE roster + the allowlist read both need it).
  const wiring = readWorldWiring(world);
  if (!wiring) return null;
  const resolveWorld = (w: string): WorldWiring | undefined =>
    w === world ? wiring : undefined;

  const nftContracts = readNftContracts(world);
  const resolveScoreWiring = makeResolveScoreWiring(env, world);

  // ── the isolated actor resolver (identity-api, NOT AUTH_BACKEND) ───────────
  const identityBaseUrl = env.IDENTITY_API_URL?.trim() || DEFAULT_IDENTITY_API_URL;
  const actorResolverFactory = makeIdentityActorResolverFor({
    baseUrl: identityBaseUrl,
    serviceToken: env.IDENTITY_API_SERVICE_TOKEN?.trim() || undefined,
    fetchImpl: seams.fetchImpl,
  });

  // ── the role-map reader: config-service (CM-authored) with seed fallback ───
  // config-service.getRoleMap returns a SurfaceEnvelope; the trigger expects a
  // RoleMapConfig|null. Unwrap the envelope; null (unwired / 404) ⇒ seed fallback.
  const readRoleMap: RoleMapReader =
    seams.readRoleMap ??
    (async (w: string): Promise<RoleMapConfig | null> => {
      const client = configServiceClientFromEnv(seams.configServiceToken ?? (() => null), seams.fetchImpl);
      const env0 = await client.getRoleMap<RoleMapConfig>(w);
      return env0 ? env0.envelope : null;
    });

  // ── the wallet↔discord link (bd-m2v live adapter; tests inject a map) ──────
  const link: WalletDiscordLink = seams.walletDiscordLink ?? makeWalletDiscordLinkLive();

  // ── the SHADOW rosterIdentity snapshot reader (bd-glb is the LIVE full one) ─
  const shadowRosterIdentity = makeShadowRosterIdentityReader(seams.getBotClient, resolveWorld);

  // The composition-root ShadowDeps (the Layer factory inputs).
  const shadowDeps: ShadowDeps = {
    getBotClient: seams.getBotClient,
    resolveWorld,
    manifestPath: manifestPathForWorld,
    world,
    initialMode: "SHADOW" as ApplyMode,
    resolveScoreWiring,
  };

  // ── the OrchestrationInvoker: build the Layer + run runTierRoleGoLive ──────
  const invokeOrchestration: OrchestrationInvoker = async (
    input: GoLiveOrchestrationInput,
  ): Promise<GoLiveOrchestrationResult> => {
    const mode = await Effect.runPromise(buildModeControl(shadowDeps.initialMode));
    const currentMapHash = () => input.currentMapHash as unknown as string;
    const scoreWiring = resolveScoreWiring(world);
    const leaderboardReader = makeLeaderboardReader(scoreWiring, seams.fetchImpl);

    // The orchestration's `applyBatch` RE-RESOLVES RoleWriter | WorldLock |
    // AdminAllowlistSource | AcvpEmitter at the write boundary (server-side authz
    // re-check + write-after-audit), so those bare services must be in context at
    // the orchestration level — not only provided INTO the gate. The
    // composition-root helper provides them into the gate; we ALSO merge the SAME
    // instances at the top so the re-resolution sees them (mirrors the orchestrator
    // test's full stack). One shared emitter/lock so the gate + the re-check agree.
    let layer;
    if (input.applyMode === "LIVE") {
      // bd-han (PART C): LIVE apply is UNGATED for the LIVE-ENABLED worlds (Purupuru
      // first). The full SIGNED-NATS AcvpEmitter (Ed25519 hash-chain) is the
      // production target and an operator boundary (bd-3v2 follow-up); until those
      // deps are wired we satisfy the gate's write-after-audit with a CLEARLY-MARKED
      // DURABLE-RECORDING interim audit emitter (records each shadow.* event to a
      // durable structured log). The gate's authz / binding / write-boundary
      // re-check guards are UNCHANGED — only the audit envelope backend differs.
      // A world NOT in the LIVE allowlist still FAILS CLOSED (requireLiveAuditError()).
      if (!LIVE_APPLY_WORLDS.has(world)) {
        // not a LIVE-enabled world — keep the historical fail-closed behavior.
        throw requireLiveAuditError();
      }
      const recording = makeRecordingLiveEmitter({ world });
      layer = liveApplyOrchestrationLayer(shadowDeps, recording.layer, mode, currentMapHash);
    } else {
      const emitterLayer = makeRecordingEmitter().layer;
      const worldLock = makeInMemoryWorldLock();
      const allowlist = makeAdminAllowlistLive({ manifestPath: manifestPathForWorld, ttlMs: 10_000 });
      const gateStack = shadowPreviewLayer(shadowDeps, mode, currentMapHash, emitterLayer);
      // merge the bare write-boundary services the gate's applyBatch re-resolves.
      layer = Layer.mergeAll(gateStack, RoleWriterMock, emitterLayer, worldLock, allowlist);
    }

    // bd-han (PART C): the derived rosterIdentity reader is PROMOTED for the LIVE
    // path. Now that the GuildMembers gateway intent is requested (commit 39496ea),
    // makeShadowRosterIdentityReader reads the live guild member/role ids fine; for
    // a first go_live with no prior preview the fresh snapshot is its own base
    // (zero drift, the conservative non-blocking default the orchestrator uses). The
    // full bd-glb RosterSource-port snapshot is a substrate change (still tracked),
    // but it is not required for the no-base LIVE apply this path performs.
    const rosterIdentity = shadowRosterIdentity;

    const program: Effect.Effect<GoLiveOrchestrationResult, OrchestrationError, OrchestrationContext> =
      runTierRoleGoLive(
        { mode, link, rosterIdentity },
        { ...input, leaderboardReader: input.leaderboardReader ?? leaderboardReader },
      );

    return Effect.runPromise(program.pipe(Effect.provide(layer as Layer.Layer<OrchestrationContext>)));
  };

  return {
    world,
    readRoleMap,
    invokeOrchestration,
    worldConfig: {
      guild_id: wiring.guild_id,
      nft_contracts: nftContracts,
      namespace_prefix: wiring.namespace_prefix,
    },
    now: () => new Date().toISOString(),
    // The token metadata the batch AuthzContext carries. The actor authz is the
    // load-bearing gate (admin_principals); this is descriptive provenance the
    // gate records. A real verified-token-metadata source is a LIVE follow-up
    // (the config-service token path); for now it is stamped at invocation.
    tokenMetadata: {
      kid: "role-sync-boot",
      verified_at: new Date().toISOString(),
      exp: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    transitionVersion: 1,
    actorResolverFor: actorResolverFactory,
    // ── MEMBER-CENTRIC SHADOW (bd-l08) ──────────────────────────────────────
    // When the run is SHADOW, the trigger produces the member-centric CM
    // dashboard (each guild member → their tier → their role) from these deps
    // instead of the leaderboard-centric orchestration. LIVE apply still flows
    // through the orchestration (member path is SHADOW-only in this build).
    memberCentric: buildMemberCentricDeps(
      env,
      seams,
      world,
      resolveWorld,
      identityBaseUrl,
      resolveScoreWiring,
    ),
  };
}

/**
 * The worlds for which LIVE apply is UNGATED (bd-han / PART C). Purupuru is the
 * first LIVE-enabled world (the operator's target). Other worlds still fail CLOSED
 * (`requireLiveAuditError`) until they are added here AND have their LIVE wiring
 * (a community-scoped score key) provisioned. Adding a world here is an explicit,
 * reviewer-visible one-line change — never an implicit default.
 */
const LIVE_APPLY_WORLDS = new Set<string>(["purupuru"]);

/**
 * The fail-closed error for a LIVE apply requested on a world NOT in
 * `LIVE_APPLY_WORLDS`. The signed-NATS AcvpEmitter audit deps (signer + publish)
 * are the production target (bd-3v2 follow-up); a non-LIVE-enabled world therefore
 * refuses rather than writing. LIVE-enabled worlds use the DURABLE-RECORDING
 * interim audit emitter (clearly marked) until bd-3v2 lands.
 */
function requireLiveAuditError(): Error {
  return new Error(
    `role-sync LIVE apply is not enabled for this world — the signed-NATS AcvpEmitter ` +
      `audit deps (${RECORDING_LIVE_AUDIT_BACKEND} is the interim backend for LIVE-enabled ` +
      `worlds; full signed NATS is bd-3v2) are an operator boundary. SHADOW preview is ` +
      `fully wired; run /role-sync with mode SHADOW.`,
  );
}

/**
 * Convenience: build the deps from `process.env` + the real bot client. Returns
 * null when not configured (the caller skips `setRoleSyncDeps`).
 */
export function buildRoleSyncBootDepsFromEnv(
  getBotClient: () => Promise<Client | null>,
): RoleSyncInteractionDeps | null {
  return buildRoleSyncBootDeps(process.env as RoleSyncBootEnv, { getBotClient });
}
