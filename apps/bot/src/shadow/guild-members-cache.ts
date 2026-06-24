/**
 * shadow/guild-members-cache.ts — a tiny TTL cache + rate-limit fallback around
 * `guild.members.fetch()` (Discord Gateway opcode 8, "Request Guild Members").
 *
 * WHY: opcode 8 is gateway-rate-limited. A single voiceless `/role-sync` →
 * Apply → Confirm flow reads the roster ~3-4× (the SHADOW dashboard build, the
 * Apply recompute, the Confirm stale-guard, and the LIVE gate's roster-freshness
 * read), across TWO readers (member-source.live.ts + roster-source.live.ts). A
 * couple of those flows back-to-back (or an operator retrying) trips the limit:
 *   "Request with opcode 8 was rate limited. Retry after 28.5 seconds."
 * which then fails the whole LIVE apply.
 *
 * The GuildMembers PRIVILEGED gateway intent is requested, so `guild.members.cache`
 * is kept fresh by member events (ADD/UPDATE/REMOVE) after an initial hydration.
 * So we:
 *   1. serve a recent fetch (within `ttlMs`) without re-issuing opcode 8, and
 *   2. on a rate-limit (or any fetch error), fall back to the last good fetch and
 *      then to the event-maintained gateway cache rather than failing the read.
 *
 * This is a READ-only convenience; it never mutates roles or members.
 */
import type { Collection, Guild, GuildMember } from "discord.js";

type MemberCollection = Collection<string, GuildMember>;

/** Default freshness window: collapses an Apply→Confirm burst (+ retries) into one fetch. */
export const DEFAULT_MEMBERS_TTL_MS = 60_000;

interface CacheEntry {
  readonly at: number;
  readonly members: MemberCollection;
}

/** Per-process, per-guild last-fetch cache. Module-scoped on purpose (shared by
 *  both live readers within one bot process). */
const cache = new Map<string, CacheEntry>();

/** Test-only: clear the cache between cases. */
export function _clearGuildMembersCache(): void {
  cache.clear();
}

/**
 * Fetch the guild's members, reusing a recent fetch within `ttlMs` and falling
 * back to cached data on a gateway rate-limit instead of throwing. Returns the
 * full member Collection (same shape as `guild.members.fetch()`).
 */
export async function fetchGuildMembersCached(
  guild: Guild,
  ttlMs: number = DEFAULT_MEMBERS_TTL_MS,
  now: number = Date.now(),
): Promise<MemberCollection> {
  const hit = cache.get(guild.id);
  if (hit && now - hit.at < ttlMs) return hit.members;

  try {
    const members = await guild.members.fetch();
    cache.set(guild.id, { at: now, members });
    return members;
  } catch (e) {
    // opcode 8 is rate-limited. Prefer a slightly-stale answer over a failed read:
    // (1) our last good fetch this process, then (2) the event-maintained gateway
    // cache. Only re-throw if we have neither.
    if (hit) return hit.members;
    if (guild.members.cache.size > 0) return guild.members.cache;
    throw e;
  }
}
