/**
 * guild-role-source.live.ts — the LIVE Discord read for the role-snapshot exporter (S3 / EXPORT-1).
 *
 * Reads a guild's MEMBERS and the role SNOWFLAKES each one holds. The wire contract wants role
 * IDS, never names — `member-source.live.ts` (the CM-dashboard reader) deliberately surfaces role
 * NAMES filtered by the world's `namespace_prefix`, which is the wrong shape and the wrong filter
 * for this job, so this is a sibling reader rather than a change to that one.
 *
 * ── READ-ONLY — NOT a role mutation ──────────────────────────────────────────
 * `guild.members.fetch()` / `guild.roles.fetch()` are READS. Discord role/member reads sit
 * explicitly OUTSIDE the cross-repo import-boundary lint (`scripts/lint-shadow-import-boundary.sh`),
 * which confines only role MUTATIONS (roles.create / roles.add / roles.set / role.delete / …) to
 * the single gated adapter `role-writer.live.ts`. Nothing here mutates. Same posture as
 * roster-source.live.ts, which already calls `guild.roles.fetch()` under the same lint.
 *
 * Reuses `fetchGuildMembersCached` — gateway opcode 8 ("Request Guild Members") is rate-limited and
 * this exporter may be run repeatedly (dry-run, then live).
 */
import type { Client, Guild } from "discord.js";
import { fetchGuildMembersCached } from "../guild-members-cache.ts";
import type { GuildRoleMemberRef, GuildRoleMemberSource } from "./role-snapshot-export.ts";

/** One role as seen in the guild — what `--list-roles` prints so an operator can pick the gated id. */
export interface GuildRoleRef {
  readonly id: string;
  readonly name: string;
  readonly members: number;
}

async function requireGuild(getBotClient: () => Promise<Client | null>, guildId: string): Promise<Guild> {
  const client = await getBotClient();
  if (!client) {
    throw new Error(
      "guild-role-source: discord bot client unavailable (DISCORD_BOT_TOKEN unset) — cannot read guild members",
    );
  }
  return client.guilds.fetch(guildId);
}

/**
 * Build the LIVE `GuildRoleMemberSource`. Returns every guild member with the role snowflakes they
 * hold, EXCLUDING @everyone (whose role id equals the guild id and which every member holds — it
 * carries no information and is a trap for the gated-role filter).
 *
 * Requires the GuildMembers privileged gateway intent (the bot already requests it).
 */
export function makeGuildRoleMemberSourceLive(
  getBotClient: () => Promise<Client | null>,
): GuildRoleMemberSource {
  return async (guildId: string): Promise<ReadonlyArray<GuildRoleMemberRef>> => {
    const guild = await requireGuild(getBotClient, guildId);
    const members = await fetchGuildMembersCached(guild);
    return [...members.values()].map(
      (m): GuildRoleMemberRef => ({
        discord_id: m.id,
        role_ids: [...m.roles.cache.keys()].filter((roleId) => roleId !== guild.id),
      }),
    );
  };
}

/**
 * READ the guild's roles (id + name + member count) — the discovery path for `--list-roles`, so
 * picking the token-gated role snowflake is a lookup rather than a guess. @everyone is excluded.
 */
export async function listGuildRoles(
  getBotClient: () => Promise<Client | null>,
  guildId: string,
): Promise<ReadonlyArray<GuildRoleRef>> {
  const guild = await requireGuild(getBotClient, guildId);
  const roles = await guild.roles.fetch();
  // Hydrate the member caches so `role.members.size` is a real count, not 0.
  await fetchGuildMembersCached(guild);
  return [...roles.values()]
    .filter((r) => r.id !== guild.id)
    .map((r) => ({ id: r.id, name: r.name, members: r.members.size }))
    .sort((a, b) => b.members - a.members);
}
