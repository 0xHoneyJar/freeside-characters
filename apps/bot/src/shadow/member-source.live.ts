/**
 * shadow/member-source.live.ts — the LIVE `MemberSource` for the member-centric
 * `/role-sync` CM dashboard (bd-l08).
 *
 * Reads the configured guild's MEMBERS (+ display name + their current
 * Freeside-managed role NAMES) via the bot's existing discord.js Gateway client
 * (`getBotClient`). Produces `GuildMemberRef[]` the member-roster builder
 * consumes.
 *
 * ── READ-ONLY — NOT a role mutation ──────────────────────────────────────────
 * This adapter only READS (`guild.members.fetch()` + each member's role names).
 * Discord member/role *reads* are explicitly OUTSIDE the cross-repo
 * import-boundary lint (which forbids only role *mutations*). The single gated
 * adapter (`role-writer.live.ts`) is the only module that mutates. The
 * GuildMembers gateway intent is now requested (commit 39496ea) so
 * `guild.members.fetch()` returns the full member list.
 *
 * ── managed roles (the BEFORE side) ──────────────────────────────────────────
 * A member's "current managed roles" are the role NAMES they hold that start
 * with the world's `namespace_prefix` (e.g. `purupuru:`). Pre-existing /
 * Collab.Land roles are NOT included — the dashboard only reasons about Freeside
 * managed roles (FR-9 coexistence; mirrors roster-source.live.ts D2).
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * No persona-engine import. A pure discord read → a structural read-model.
 */
import type { Client, Guild } from "discord.js";
import type { GuildMemberRef, MemberSource } from "./member-roster.ts";
import { fetchGuildMembersCached } from "./guild-members-cache.ts";

/** Per-world wiring the live member reader needs: the guild snowflake + prefix. */
export interface LiveMemberSourceConfig {
  /** map a world slug → its Discord guild snowflake + namespace prefix. */
  readonly resolve: (
    world: string,
  ) => { readonly guild_id: string; readonly namespace_prefix: string } | undefined;
}

/**
 * Build the LIVE `MemberSource`. `getBotClient` is the existing bot Gateway
 * client factory (returns null when DISCORD_BOT_TOKEN is unset → throws a clear
 * error so the trigger surfaces a voiceless "member roster failed"). Reads the
 * guild's members + each member's current managed (namespaced) role names.
 */
export function makeMemberSourceLive(
  getBotClient: () => Promise<Client | null>,
  cfg: LiveMemberSourceConfig,
): MemberSource {
  return async (world: string): Promise<ReadonlyArray<GuildMemberRef>> => {
    const wiring = cfg.resolve(world);
    if (!wiring) {
      throw new Error(`member-source: no guild wiring for world '${world}'`);
    }
    const client = await getBotClient();
    if (!client) {
      throw new Error(
        "member-source: discord bot client unavailable (DISCORD_BOT_TOKEN unset) — cannot read guild members",
      );
    }
    const guild: Guild = await client.guilds.fetch(wiring.guild_id);
    // READ the full member list (requires the GuildMembers gateway intent, now
    // requested). Each member's `.roles.cache` carries the role objects. Cached +
    // rate-limit-fallback: opcode 8 ("Request Guild Members") is gateway-rate-
    // limited, and one Apply→Confirm flow reads the roster several times.
    const members = await fetchGuildMembersCached(guild);

    return [...members.values()].map((m): GuildMemberRef => {
      // current managed roles = role NAMES starting with the namespace prefix.
      const current_managed_roles = [...m.roles.cache.values()]
        .map((r) => r.name)
        .filter((name) => name.startsWith(wiring.namespace_prefix));
      // display name: server nick > global display name > username.
      const display_name =
        m.nickname ??
        (m.user.globalName as string | null | undefined) ??
        m.user.username ??
        undefined;
      return {
        discord_id: m.id,
        display_name: display_name ?? undefined,
        current_managed_roles,
      };
    });
  };
}
