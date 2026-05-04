/**
 * quest-runtime.ts — per-guild Layer composition for QuestStatePort
 * (cycle-Q · sprint-3 · Q3.4 supporting Q3.5).
 *
 * Per SDD §7.3 (Bot composition root): the bot owns the QuestStatePort
 * Layer composition. ONE bot binary · N worlds served · per-world DB
 * isolation. Memory adapter for dev/test; Postgres adapter for
 * production worlds (mibera-db / apdao-db / cubquest-db).
 *
 * This module wraps the @freeside-quests/engine adapter Layers behind a
 * single resolver function the dispatch caller invokes per interaction.
 *
 * Architect lock A2 (SDD §10.2): QuestStatePort Tag identity is the
 * load-bearing string `@freeside-quests/QuestStatePort` — preserved
 * across packages. Same Tag, different Layer.
 */

import type { Layer } from "effect";
import {
  QuestStatePort,
  QuestStatePortMemoryLayer,
  QuestStatePortPostgresLayer,
  type PostgresAdapterConfig,
  type QuestStatePostgresPool,
} from "@freeside-quests/engine";
import type { WorldManifestQuestSubset } from "./world-resolver.ts";
import { resolveWorldForGuild } from "./world-resolver.ts";

/**
 * Per-world Postgres pool factory. The bot consumer constructs this from
 * runtime config (e.g. Railway env vars per-world). The factory closes
 * over the operator's connection wiring and returns a pool keyed by
 * world.slug.
 *
 * For dev/test, supply a stub that returns null — the resolver then
 * falls back to the memory adapter.
 */
export interface WorldPgPoolFactory {
  readonly poolForWorld: (world_slug: string) => QuestStatePostgresPool | null;
}

/**
 * Compose the QuestStatePort Layer for a given Discord guild.
 *
 * Resolution path:
 *   1. resolveWorldForGuild → world (or null)
 *   2. if no world: memory layer (dev/fallback)
 *   3. if world: try poolForWorld(world.slug)
 *      a. pool exists: postgres adapter
 *      b. pool null:    memory adapter (dev guild attached to a world)
 *
 * The returned Layer has zero requirements (`never, never`) — it's a
 * fully-composed Layer the caller passes to Effect.provide.
 */
export const buildQuestStatePortLayerForGuild = (
  guild_id: string,
  manifests: readonly WorldManifestQuestSubset[],
  pools: WorldPgPoolFactory,
): Layer.Layer<QuestStatePort> => {
  const world = resolveWorldForGuild(guild_id, manifests);
  if (!world) return QuestStatePortMemoryLayer;

  const pool = pools.poolForWorld(world.slug);
  if (!pool) return QuestStatePortMemoryLayer;

  const config: PostgresAdapterConfig = {
    pool,
    world_slug: world.slug,
  };
  return QuestStatePortPostgresLayer(config);
};

export { QuestStatePort } from "@freeside-quests/engine";
