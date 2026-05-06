/**
 * world-resolver.ts — per-guild → per-world routing (cycle-Q · sprint-3 · Q3.4).
 *
 * Per SDD §7.2 + §7.3 + PRD D5: single-bot multi-world. World-manifest declares
 * compose_with: freeside-quests + quest_namespace + quest_engine_config + guild_ids
 * (additive minor bump · v1.1 · per Q3.1 in freeside-worlds#1).
 *
 * The bot has ONE binary that serves N worlds. Per-guild routing happens here:
 *   1. interaction.guild_id arrives at dispatch
 *   2. resolveWorldForGuild looks up which world owns that guild
 *   3. buildEngineConfigForWorld constructs the EngineConfig per world
 *   4. quest-runtime.ts (sibling) composes the QuestStatePort Layer
 *      (memory adapter for dev guilds · postgres for production worlds)
 *
 * The resolver is a pure-data function — no IO, no Discord API calls.
 *
 * Civic-layer note: substrate (freeside-quests) doesn't know about Discord
 * guilds. The bot owns this mapping via the world-manifest. This file is
 * the BOT's per-guild lookup, not substrate logic.
 */

/**
 * Subset of the world-manifest schema that the bot consumes for quest routing.
 *
 * Mirrors freeside-worlds/packages/protocol/world-manifest.schema.json v1.1
 * (additive minor · cycle-Q · per Q3.1). The bot doesn't load the JSON
 * Schema directly — it operates on this structural subset. The
 * world-manifest validator is the source-of-truth at deploy time.
 *
 * Fields are optional because v1.0 manifests omit them. The resolver
 * filters out manifests without quest fields.
 *
 * cycle-B sprint-1 (B-1.7): added `tenant_id` and `auth.backend` so the
 * bot's auth-bridge can resolve a per-guild tenant + know which backend
 * (anon or freeside-jwt) the world has opted into. Both fields are
 * optional to keep cycle-Q v1.0 manifests forward-compatible — only
 * worlds that declare an identity composition need to populate them.
 */
export interface WorldManifestQuestSubset {
  readonly slug: string;
  readonly tenant_id?: string;
  readonly quest_namespace?: string;
  readonly quest_engine_config?: {
    readonly questAcceptanceMode: "open" | "auth-required" | "open-badge-gated";
    readonly submissionStyle: "inline_thread" | "modal_form";
    readonly positiveFrictionDelayMs: number;
  };
  readonly auth?: {
    readonly backend: "anon" | "freeside-jwt";
  };
  readonly guild_ids?: readonly string[];
}

/**
 * EngineConfig shape consumed by @0xhoneyjar/quests-discord-renderer's
 * dispatchQuestInteraction. Mirrors EngineConfigShape exported from
 * the discord-renderer package — re-declared here as a structural type
 * so the bot doesn't need a hard runtime dep at the resolver layer.
 */
export interface EngineConfigShape {
  readonly questAcceptanceMode: "open" | "auth-required" | "open-badge-gated";
  readonly worldSlug: string;
  readonly submissionStyle: "inline_thread" | "modal_form";
  readonly positiveFrictionDelayMs: number;
}

/**
 * Find the world manifest that owns a given Discord guild.
 *
 * First-match wins per SDD §7.1 (worlds may overlap on shared guilds;
 * the operator decides ordering by manifest declaration order).
 *
 * Returns null when no world claims the guild (the bot then either
 * routes to a dev/fallback Layer or refuses the interaction — the
 * caller decides).
 */
export const resolveWorldForGuild = (
  guild_id: string,
  manifests: readonly WorldManifestQuestSubset[],
): WorldManifestQuestSubset | null => {
  for (const m of manifests) {
    if (!m.guild_ids || m.guild_ids.length === 0) continue;
    if (m.guild_ids.includes(guild_id)) return m;
  }
  return null;
};

/**
 * Build an EngineConfig from a resolved world manifest.
 *
 * Returns null when the manifest has no quest_engine_config
 * (i.e. the world declares quest_namespace + guild_ids but didn't ship
 * the engine config — operator authoring gap; the bot logs and skips).
 */
export const buildEngineConfigForWorld = (
  world: WorldManifestQuestSubset,
): EngineConfigShape | null => {
  if (!world.quest_engine_config) return null;
  return {
    questAcceptanceMode: world.quest_engine_config.questAcceptanceMode,
    worldSlug: world.slug,
    submissionStyle: world.quest_engine_config.submissionStyle,
    positiveFrictionDelayMs: world.quest_engine_config.positiveFrictionDelayMs,
  };
};

/**
 * Convenience: resolve guild → EngineConfig in one call. Returns null if
 * either step fails (no world OR no engine config).
 */
export const resolveEngineConfigForGuild = (
  guild_id: string,
  manifests: readonly WorldManifestQuestSubset[],
): EngineConfigShape | null => {
  const world = resolveWorldForGuild(guild_id, manifests);
  if (!world) return null;
  return buildEngineConfigForWorld(world);
};

/**
 * cycle-B sprint-1 (B-1.7): resolve the canonical tenant_id for a Discord
 * guild from the world-manifest registry.
 *
 * Returns null when:
 *   - no world claims the guild, OR
 *   - the matched world manifest does not declare `tenant_id` (cycle-Q
 *     v1.0 manifest · no identity composition)
 *
 * Auth-bridge consumes this to drive its `TenantResolverPort`. The bridge
 * decides what null means based on the per-route fail-mode (verified-required
 * → AuthBridgeError; verified-with-anon-fallback → audited downgrade;
 * public/anon → not consulted at all).
 *
 * Pure-data function · no IO · no Discord API call · safe to invoke per
 * interaction at the dispatch layer.
 */
export const resolveTenantFromGuild = (
  guild_id: string,
  manifests: readonly WorldManifestQuestSubset[],
): string | null => {
  const world = resolveWorldForGuild(guild_id, manifests);
  if (!world) return null;
  return world.tenant_id ?? null;
};

/**
 * cycle-B sprint-1 (B-1.7): resolve the auth backend the world has opted
 * into. Returns the manifest's declared backend or 'anon' when the world
 * doesn't declare identity composition.
 *
 * Composes orthogonally with the AUTH_BACKEND env var (Lock-7): operators
 * gate by env at the bot binary level; worlds advertise their preferred
 * backend at the manifest level. The strict policy (env=anon overrides
 * everything) is enforced inside auth-bridge · this resolver only surfaces
 * the world's stated preference.
 */
export const resolveAuthBackendForGuild = (
  guild_id: string,
  manifests: readonly WorldManifestQuestSubset[],
): "anon" | "freeside-jwt" => {
  const world = resolveWorldForGuild(guild_id, manifests);
  if (!world) return "anon";
  return world.auth?.backend ?? "anon";
};
