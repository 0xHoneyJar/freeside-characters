/**
 * guild-members-cache.test.ts — the TTL cache + rate-limit fallback around the
 * opcode-8 `guild.members.fetch()`. Proves: a burst within the TTL issues ONE
 * fetch; a stale window re-fetches; and a gateway rate-limit falls back to the
 * last good fetch / the event-maintained gateway cache instead of throwing.
 */
import { describe, expect, test } from "bun:test";
import type { Guild } from "discord.js";
import {
  fetchGuildMembersCached,
  _clearGuildMembersCache,
  DEFAULT_MEMBERS_TTL_MS,
} from "./guild-members-cache.ts";

function fakeGuild(opts: {
  id?: string;
  fetchImpl: () => Promise<unknown>;
  cacheSize?: number;
}) {
  let calls = 0;
  const cache = { size: opts.cacheSize ?? 0, tag: "gateway-cache" };
  const guild = {
    id: opts.id ?? "guild-1",
    members: {
      fetch: async () => {
        calls++;
        return opts.fetchImpl();
      },
      cache,
    },
  };
  return { guild: guild as unknown as Guild, calls: () => calls, cache };
}

describe("fetchGuildMembersCached — opcode-8 burst protection", () => {
  test("two reads within the TTL issue ONE opcode-8 fetch", async () => {
    _clearGuildMembersCache();
    const fetched = { tag: "fetched", size: 3 };
    const { guild, calls } = fakeGuild({ fetchImpl: async () => fetched });

    const a = await fetchGuildMembersCached(guild, DEFAULT_MEMBERS_TTL_MS, 1_000);
    const b = await fetchGuildMembersCached(guild, DEFAULT_MEMBERS_TTL_MS, 1_500); // +500ms < TTL
    expect(a).toBe(fetched as unknown as typeof a);
    expect(b).toBe(fetched as unknown as typeof b);
    expect(calls()).toBe(1); // the second read reused the cache — no second opcode 8
  });

  test("a read past the TTL re-fetches", async () => {
    _clearGuildMembersCache();
    const { guild, calls } = fakeGuild({ fetchImpl: async () => ({ tag: "fetched" }) });

    await fetchGuildMembersCached(guild, 60_000, 1_000);
    await fetchGuildMembersCached(guild, 60_000, 1_000 + 60_001); // just past TTL
    expect(calls()).toBe(2);
  });

  test("rate-limited fetch falls back to the last good fetch (no throw)", async () => {
    _clearGuildMembersCache();
    const good = { tag: "good", size: 5 };
    let mode: "ok" | "ratelimit" = "ok";
    const { guild } = fakeGuild({
      fetchImpl: async () => {
        if (mode === "ratelimit") {
          throw new Error("Request with opcode 8 was rate limited. Retry after 28.5 seconds.");
        }
        return good;
      },
    });

    const first = await fetchGuildMembersCached(guild, 1_000, 1_000); // populates cache
    expect(first).toBe(good as unknown as typeof first);

    mode = "ratelimit";
    const second = await fetchGuildMembersCached(guild, 1_000, 1_000 + 5_000); // past TTL → refetch → 429
    expect(second).toBe(good as unknown as typeof second); // served stale, did NOT throw
  });

  test("rate-limited cold fetch falls back to the event-maintained gateway cache", async () => {
    _clearGuildMembersCache();
    const { guild, cache } = fakeGuild({
      cacheSize: 7, // GuildMembers intent kept the gateway cache populated
      fetchImpl: async () => {
        throw new Error("Request with opcode 8 was rate limited. Retry after 28.5 seconds.");
      },
    });
    const out = await fetchGuildMembersCached(guild, 1_000, 1_000);
    expect(out).toBe(cache as unknown as typeof out); // fell back to the gateway cache
  });

  test("rate-limited cold fetch with an empty gateway cache re-throws", async () => {
    _clearGuildMembersCache();
    const { guild } = fakeGuild({
      cacheSize: 0,
      fetchImpl: async () => {
        throw new Error("Request with opcode 8 was rate limited. Retry after 28.5 seconds.");
      },
    });
    await expect(fetchGuildMembersCached(guild, 1_000, 1_000)).rejects.toThrow("opcode 8");
  });
});
