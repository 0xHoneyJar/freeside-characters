/**
 * shadow/roster-source.live.ts — the LIVE `RosterSource` Layer (Sprint 405 /
 * Task 405.1, SDD §1.3 C4 / §4.5).
 *
 * Reads the CURRENT Discord guild roster (roles + per-role member counts) via
 * the bot's existing discord.js Gateway client (`getBotClient`). Produces the
 * substrate's `CurrentRoster` read-model the pure `diff` consumes.
 *
 * ── READ-ONLY — this is NOT a role mutation ──────────────────────────────────
 * `RosterSource.currentRoster` only READS (`guild.roles.fetch` /
 * `members.fetch`). Discord role *reads* are explicitly OUTSIDE the cross-repo
 * import-boundary lint (405.3), which forbids only role *mutations*
 * (`roles.create` / member `roles.add`/`set`). The single gated adapter
 * (`role-writer.live.ts`) is the ONLY module that mutates.
 *
 * ── managed vs pre-existing (D2) ─────────────────────────────────────────────
 * A role is FREESIDE-MANAGED iff its name starts with the world's
 * `namespace_prefix` (e.g. `purupuru:`). Pre-existing / Collab.Land roles
 * (everything else) carry `managed: false` so the lens NEVER shows them as
 * "would change" (SDD §6.4 / FR-9). Discord role NAMES are the namespacing
 * surface (snowflake ids are opaque); we match the prefix on the role name.
 *
 * The mock counterpart (`roster-source.mock.ts`) returns fixtures with ZERO
 * Discord calls — the shadow-preview path.
 */
import { Effect, Layer } from "effect";
import type { Client, Guild } from "discord.js";
import { RosterSource, RosterError } from "./substrate.ts";
import type { CurrentRoster } from "@freeside-worlds/shadow-substrate";

/**
 * Per-world wiring the LIVE roster reader needs: the Discord guild snowflake +
 * the Freeside namespace prefix (D2). Supplied by the composition root from the
 * world manifest (`purupuru.yaml` `guild_id` + `namespace_prefix`).
 */
export interface LiveRosterConfig {
  /** map a substrate WorldSlug → its Discord guild snowflake + namespace prefix. */
  readonly resolve: (
    world: string,
  ) => { readonly guild_id: string; readonly namespace_prefix: string } | undefined;
}

/**
 * Build the LIVE `RosterSource` Layer. `getBotClient` is the existing bot
 * Gateway client factory (returns `null` when `DISCORD_BOT_TOKEN` is unset).
 */
export function makeRosterSourceLive(
  getBotClient: () => Promise<Client | null>,
  cfg: LiveRosterConfig,
): Layer.Layer<RosterSource> {
  return Layer.succeed(
    RosterSource,
    RosterSource.of({
      currentRoster: (world) =>
        Effect.tryPromise({
          try: async (): Promise<CurrentRoster> => {
            const wiring = cfg.resolve(world as unknown as string);
            if (!wiring) {
              throw new Error(`no guild wiring for world '${world}'`);
            }
            const client = await getBotClient();
            if (!client) {
              throw new Error(
                "discord bot client unavailable (DISCORD_BOT_TOKEN unset) — cannot read live roster",
              );
            }
            const guild: Guild = await client.guilds.fetch(wiring.guild_id);
            // READ roles + members. roles.fetch() returns the full role cache;
            // each role's `.members` is the set of members holding it.
            const roles = await guild.roles.fetch();
            await guild.members.fetch(); // hydrate member→role caches for counts

            const out = roles
              // @everyone is the guild-id role; never a Freeside role, skip it.
              .filter((r) => r.id !== guild.id)
              .map((r) => ({
                role_key: r.name,
                members: r.members.size,
                managed: r.name.startsWith(wiring.namespace_prefix),
              }));

            return {
              world: world as unknown as string,
              roles: [...out.values()],
            };
          },
          catch: (e) =>
            new RosterError({
              message: `live roster read failed: ${e instanceof Error ? e.message : String(e)}`,
            }),
        }),
    }),
  );
}
