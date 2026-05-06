/**
 * quest-runtime-production.ts — production-mode QuestRuntime constructor
 * (cycle-B · sprint-1 · B-1.8).
 *
 * Replaces the memory-mode bootstrap with a tenant-aware runtime that:
 *   - reads operator-provided world manifests (real freeside-worlds entries
 *     once B-1.12 lands · injectable list for unit tests)
 *   - dispatches per-tenant Postgres pools via a TenantPgPoolFactory
 *     (translates world.slug → world.tenant_id → pg.Pool · matches the
 *     existing WorldPgPoolFactory contract in quest-runtime.ts)
 *   - lazily provisions pg.Pool instances from `TENANT_<TENANT>_DATABASE_URL`
 *     env vars (one pool per tenant · process lifetime)
 *   - accepts an injectable QuestCatalog so B-1.13's Mongolian cartridge
 *     loader plugs in without a refactor
 *
 * Architect locks honored:
 *   - I3 (Spine Seam): per-tenant heterogeneity is first-class · the factory
 *     dispatches by `tenant_id` · NO `if (tenant === 'mibera')` shortcut.
 *   - I5 (Construct Purity): pure orchestration · all side effects (pg.Pool
 *     creation, env reads) flow through injected ports/factories.
 *   - Lock-7 (Feature flag): production runtime composes orthogonally with
 *     `AUTH_BACKEND` · runtime selection at `QUEST_RUNTIME=production` ·
 *     auth backend at `AUTH_BACKEND=freeside-jwt` · operator flips each
 *     independently.
 *
 * Out of scope for this commit:
 *   - real freeside-worlds registry loader (B-1.12 ships mibera.yaml ·
 *     operator wires the loader path at index.ts level)
 *   - Mongolian cartridge catalog (B-1.13 · uses a memory stub catalog
 *     for now · same shape as memory-mode bootstrap)
 *   - auth-bridge orchestrator wiring (B-1.6 ships ports · this runtime
 *     does NOT consume the bridge directly · the bot's interaction handler
 *     will call attachAuthContext separately)
 *
 * Per CLAUDE.md royal decree (freeside-auth/CLAUDE.md): JWKS issuance
 * stays at loa-freeside/apps/gateway. The auth-bridge orchestrator
 * delegates signing there. This runtime does NOT touch JWKS surfaces.
 */

import { Effect } from "effect";
import type {
  CharacterRegistry,
  CuratorVoiceProfile,
  QuestCatalog,
} from "@0xhoneyjar/quests-discord-renderer";
import type {
  Quest,
  QuestId,
  NpcId,
  WorldSlug,
  BadgeFamilyId,
  PlayerIdentity,
  DiscordId,
} from "@0xhoneyjar/quests-protocol";
import type { CharacterConfig } from "@freeside-characters/persona-engine";
import type { QuestStatePostgresPool } from "@0xhoneyjar/quests-engine";
import type { QuestRuntime } from "./discord-interactions/quest-dispatch.ts";
import type { WorldPgPoolFactory } from "./quest-runtime.ts";
import type { WorldManifestQuestSubset } from "./world-resolver.ts";
import type { DiscordInteraction } from "./discord-interactions/types.ts";

// ---------------------------------------------------------------------------
// TenantPgPoolFactory — per-tenant pool dispatch (I3 Spine Seam)
// ---------------------------------------------------------------------------

/**
 * Per-tenant Postgres pool factory. Returns a pool for the given tenant_id
 * or null when no DB is provisioned for that tenant (operator hasn't set
 * `TENANT_<TENANT>_DATABASE_URL`). Caller then falls back to memory adapter
 * via the existing `quest-runtime.ts` resolver.
 *
 * Used by the bot's composition root to dispatch pools per interaction
 * driven by world.tenant_id (set in B-1.7).
 */
export interface TenantPgPoolFactory {
  readonly poolForTenant: (tenant_id: string) => QuestStatePostgresPool | null;
}

/**
 * Wrap a TenantPgPoolFactory as a WorldPgPoolFactory · honors the existing
 * quest-runtime.ts contract (poolForWorld takes world_slug). Translates
 * world.slug → tenant_id (via manifest lookup) → pool.
 *
 * Returns null when:
 *   - the slug isn't in the manifest list, OR
 *   - the matched manifest has no tenant_id (cycle-Q v1.0 forward-compat),
 *   - OR the tenant factory has no pool for that tenant.
 *
 * Each null path falls back to the memory adapter at quest-runtime.ts (per
 * existing resolver semantics).
 */
export const buildWorldPgPoolFactoryFromTenants = (
  manifests: readonly WorldManifestQuestSubset[],
  tenantFactory: TenantPgPoolFactory,
): WorldPgPoolFactory => ({
  poolForWorld: (world_slug: string) => {
    const world = manifests.find((m) => m.slug === world_slug);
    if (!world || !world.tenant_id) return null;
    return tenantFactory.poolForTenant(world.tenant_id);
  },
});

// ---------------------------------------------------------------------------
// Env-driven tenant pool factory (lazy pg.Pool · process-lifetime cache)
// ---------------------------------------------------------------------------

/**
 * Connection-string lookup port. Default impl reads `TENANT_<TENANT>_DATABASE_URL`
 * from process.env. Tests inject a recording stub.
 *
 * Pattern: `mibera` → `TENANT_MIBERA_DATABASE_URL` (uppercase + underscores ·
 * tenant slugs may contain dashes which become underscores in env var names).
 */
export interface TenantConnectionStringSource {
  /** Returns connection string for tenant or null if not provisioned. */
  readonly forTenant: (tenant_id: string) => string | null;
}

export const envConnectionStringSource = (
  env: NodeJS.ProcessEnv = process.env,
): TenantConnectionStringSource => ({
  forTenant: (tenant_id: string) => {
    const key = `TENANT_${tenant_id.toUpperCase().replace(/-/g, "_")}_DATABASE_URL`;
    const value = env[key];
    return value && value.trim().length > 0 ? value : null;
  },
});

/**
 * Pool builder · constructs a QuestStatePostgresPool from a connection
 * string. Default impl creates a `pg.Pool`; tests inject a stub.
 *
 * The minimal QuestStatePostgresPool surface (`query`) means we don't need
 * a hard `pg` import at this module level — the bot's composition root
 * supplies the real `pg.Pool`-derived adapter.
 */
export interface PoolBuilder {
  readonly build: (connection_string: string) => QuestStatePostgresPool;
}

/**
 * Build a TenantPgPoolFactory backed by env-driven connection strings.
 * Pools are constructed lazily on first lookup and cached for the process
 * lifetime (one pool per tenant).
 *
 * The factory returns null for tenants without `TENANT_<TENANT>_DATABASE_URL`
 * set · existing memory-fallback path engages downstream.
 */
export const buildEnvTenantPgPoolFactory = (
  poolBuilder: PoolBuilder,
  source: TenantConnectionStringSource = envConnectionStringSource(),
): TenantPgPoolFactory => {
  const cache = new Map<string, QuestStatePostgresPool>();
  return {
    poolForTenant: (tenant_id: string) => {
      const cached = cache.get(tenant_id);
      if (cached) return cached;
      const conn = source.forTenant(tenant_id);
      if (!conn) return null;
      const pool = poolBuilder.build(conn);
      cache.set(tenant_id, pool);
      return pool;
    },
  };
};

// ---------------------------------------------------------------------------
// Production runtime constructor
// ---------------------------------------------------------------------------

export interface ProductionQuestRuntimeOptions {
  /**
   * Real world manifests sourced from freeside-worlds registry. Until B-1.12
   * lands the operator-readable mibera.yaml in freeside-worlds, the bot's
   * composition root supplies a hardcoded mibera entry inline (see
   * index.ts wiring).
   */
  readonly worldManifests: readonly WorldManifestQuestSubset[];

  /** Loaded characters (from character-loader). */
  readonly characters: readonly CharacterConfig[];

  /** Per-tenant Pg pool dispatch · null tenant returns memory fallback. */
  readonly tenantPgPoolFactory: TenantPgPoolFactory;

  /**
   * Quest catalog. Defaults to a stub (Mongolian munkh-introduction-v1)
   * mirroring the memory-mode bootstrap. B-1.13 swaps in cartridge-loaded
   * catalog without changing this constructor's shape.
   */
  readonly catalog?: QuestCatalog;

  /**
   * Curator voice profile. Defaults to empty · phaseToNarrative substrate
   * fallback applies until Track A populates per-NPC cadence.
   */
  readonly voice?: CuratorVoiceProfile;

  /**
   * Player resolver. Defaults to anon-only (matching memory-mode · per
   * PRD D4). Once auth-bridge wires verified player identity in the bot's
   * dispatch chain, the resolver promotes to JWT-claim-derived identity.
   */
  readonly resolvePlayer?: (interaction: DiscordInteraction) => PlayerIdentity | null;
}

/**
 * Build a production-mode QuestRuntime.
 *
 * Composition:
 *   - manifests + tenant pool factory → WorldPgPoolFactory (existing
 *     quest-runtime.ts contract)
 *   - catalog defaults to memory stub (B-1.13 swap point)
 *   - voice defaults to empty profile
 *   - resolvePlayer defaults to anon-only
 *   - characters → CharacterRegistry (NpcId → displayName)
 *
 * Returns a QuestRuntime the bot wires via setQuestRuntime at boot.
 */
export const buildProductionQuestRuntime = (
  opts: ProductionQuestRuntimeOptions,
): QuestRuntime => {
  const pgPools = buildWorldPgPoolFactoryFromTenants(
    opts.worldManifests,
    opts.tenantPgPoolFactory,
  );
  const catalog = opts.catalog ?? buildStubCatalog();
  const voice = opts.voice ?? {};
  const resolvePlayer = opts.resolvePlayer ?? buildAnonPlayerResolver();
  const characters = buildCharacterRegistry(opts.characters);

  return {
    worldManifests: opts.worldManifests,
    catalog,
    characters,
    voice,
    pgPools,
    resolvePlayer,
  };
};

// ---------------------------------------------------------------------------
// Defaults · same shape as memory-mode bootstrap (B-1.13 swap targets)
// ---------------------------------------------------------------------------

const STUB_QUEST_ID = "munkh-introduction-v1";
const STUB_WORLD_SLUG = "mongolian";
const STUB_NPC_ID = "mongolian";

const buildStubQuest = (): Quest =>
  ({
    quest_id: STUB_QUEST_ID as unknown as QuestId,
    npc_pointer: STUB_NPC_ID as unknown as NpcId,
    world_slug: STUB_WORLD_SLUG as unknown as WorldSlug,
    title: "Why did you come?",
    prompt:
      "Share why you came · what brought you to the steppe today. A few lines is enough · the wind carries everything you do not say.",
    rubric_pointer: {
      type: "codex_ref",
      construct_slug: "construct-mongolian",
      cell_id: "stub-v1-munkh-quest",
    },
    badge_spec: {
      family_id: "mongolian-petroglyph-stub" as unknown as BadgeFamilyId,
      display_name: "First Mark on the Steppe",
      prompt_seed:
        "A simple petroglyph carved into weathered stone · the first mark a traveler leaves on Mongolian soil.",
      format_hint: "webp",
    },
    published_at: new Date("2026-05-04T00:00:00Z").toISOString(),
    step_count: 1,
    contract_version: "1.0.0",
  }) as Quest;

const buildStubCatalog = (): QuestCatalog => {
  const stub = buildStubQuest();
  return {
    listAvailableQuests: (worldSlug: string) =>
      Effect.succeed(worldSlug === STUB_WORLD_SLUG ? [stub] : []),
    findQuest: (worldSlug: string, quest_id: string) =>
      Effect.succeed(
        worldSlug === STUB_WORLD_SLUG && quest_id === STUB_QUEST_ID
          ? stub
          : undefined,
      ),
  };
};

const DISCORD_ID_PATTERN = /^\d{17,20}$/;

const buildAnonPlayerResolver =
  () =>
  (interaction: DiscordInteraction): PlayerIdentity | null => {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    if (!userId) return null;
    if (!DISCORD_ID_PATTERN.test(userId)) return null;
    return {
      type: "anon",
      discord_id: userId as unknown as DiscordId,
    };
  };

const buildCharacterRegistry = (
  characters: readonly CharacterConfig[],
): CharacterRegistry => {
  const map = new Map<string, string>();
  for (const c of characters) {
    if (c.displayName) map.set(c.id, c.displayName);
  }
  return {
    resolveDisplayName: (npc_id: string) => map.get(npc_id),
  };
};

export const PRODUCTION_STUB_QUEST_ID = STUB_QUEST_ID;
export const PRODUCTION_STUB_WORLD_SLUG = STUB_WORLD_SLUG;
export const PRODUCTION_STUB_NPC_ID = STUB_NPC_ID;
