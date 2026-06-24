/**
 * wallet-discord-link.live.test.ts — the LIVE `WalletDiscordLink` adapter
 * (bd-m2v SEAM 1). All network-free: the freeside_auth batch resolver is
 * INJECTED (a pure map-backed double), zero pg / zero MCP.
 *
 * Proves:
 *   • wallet → snowflake when midi_profiles has a found row with discord_id;
 *   • FAIL-CLOSED → null when not found, or found-but-no-discord_id (skipped,
 *     never assigned by the builder);
 *   • case-insensitive wallet matching (the source normalizes lowercase);
 *   • BATCHING: an N-wallet flush coalesces into a bounded number of underlying
 *     calls (request-coalescing), not O(N);
 *   • CACHING: a repeat resolve() within TTL does NOT re-hit the resolver;
 *   • a resolver THROW is fail-closed (null this run) and NOT cached;
 *   • the MOCK helper.
 */
import { describe, expect, test } from "bun:test";
import {
  makeWalletDiscordLinkLive,
  makeWalletDiscordLinkMock,
  LinkResolutionError,
  type BatchWalletResolver,
  type ResolvedWalletLike,
} from "./wallet-discord-link.live.ts";

/** A valid 17-20-digit Discord snowflake from a short tag (post-#12 the live
 *  adapter rejects non-snowflake ids, so fixtures must be well-formed). */
function sf(tag: string | number): string {
  const digits = String(tag).replace(/\D/g, "") || "0";
  return ("9" + digits.padStart(17, "0")).slice(0, 18);
}

/** Build an injectable batch resolver from a wallet→(discord_id|null) map. */
function resolverFrom(
  map: Record<string, string | null>,
  counter?: { calls: number; batches: string[][] },
): BatchWalletResolver {
  return async (wallets) => {
    if (counter) {
      counter.calls += 1;
      counter.batches.push([...wallets]);
    }
    return wallets.map((w): ResolvedWalletLike => {
      const key = w.toLowerCase();
      const has = Object.prototype.hasOwnProperty.call(map, key);
      const discord = has ? map[key]! : null;
      return { wallet: key, found: has, discord_id: discord ?? null };
    });
  };
}

describe("makeWalletDiscordLinkLive — resolution", () => {
  test("resolves wallet → discord snowflake when midi_profiles has the link", async () => {
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom({ "0xabc": "123456789012345678" }),
    });
    expect(await link.resolve("0xABC")).toBe("123456789012345678"); // case-insensitive
  });

  test("FAIL-CLOSED → null when the wallet is not found (skipped, never assigned)", async () => {
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom({ "0xabc": sf("111") }),
    });
    expect(await link.resolve("0xnotlinked")).toBeNull();
  });

  test("FAIL-CLOSED → null when found but discord_id is null/empty", async () => {
    const resolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({ wallet: w.toLowerCase(), found: true, discord_id: null }));
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolver });
    expect(await link.resolve("0xfoundnodiscord")).toBeNull();

    const resolverEmpty: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({ wallet: w.toLowerCase(), found: true, discord_id: "" }));
    const link2 = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolverEmpty });
    expect(await link2.resolve("0xfoundempty")).toBeNull();
  });

  test("empty / whitespace wallet → null without hitting the resolver", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolverFrom({}, counter) });
    expect(await link.resolve("   ")).toBeNull();
    expect(counter.calls).toBe(0);
  });
});

describe("makeWalletDiscordLinkLive — batching + caching", () => {
  test("coalesces concurrent resolves into ONE underlying batch call (not O(N))", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom(
        { "0xa": sf(1), "0xb": sf(2), "0xc": sf(3) },
        counter,
      ),
    });
    // Fire all three in the SAME tick (mirrors the builder's loop awaiting later).
    const [a, b, c] = await Promise.all([
      link.resolve("0xa"),
      link.resolve("0xb"),
      link.resolve("0xc"),
    ]);
    expect([a, b, c]).toEqual([sf(1), sf(2), sf(3)]);
    expect(counter.calls).toBe(1); // ONE batched lookup, not three
    expect(counter.batches[0]!.sort()).toEqual(["0xa", "0xb", "0xc"]);
  });

  test("respects batchSize (chunks a large flush)", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    const map: Record<string, string> = {};
    const wallets: string[] = [];
    for (let i = 0; i < 5; i++) {
      const w = `0x${i}`;
      map[w] = sf(`10${i}`); // distinct valid snowflakes
      wallets.push(w);
    }
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom(map, counter),
      batchSize: 2,
    });
    const out = await Promise.all(wallets.map((w) => link.resolve(w)));
    expect(out).toEqual([sf("100"), sf("101"), sf("102"), sf("103"), sf("104")]);
    // 5 distinct wallets / batchSize 2 → 3 underlying slices.
    expect(counter.calls).toBe(3);
  });

  test("caches a resolved link — a repeat resolve does NOT re-hit the resolver", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom({ "0xa": sf(1) }, counter),
    });
    expect(await link.resolve("0xa")).toBe(sf(1));
    expect(await link.resolve("0xa")).toBe(sf(1)); // served from cache
    expect(counter.calls).toBe(1);
  });

  test("caches resolved-null too (a known-unlinked wallet is not re-queried)", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom({ "0xa": sf(1) }, counter),
    });
    expect(await link.resolve("0xmissing")).toBeNull();
    expect(await link.resolve("0xmissing")).toBeNull();
    expect(counter.calls).toBe(1); // resolved-null cached
  });

  test("a resolver THROW is fail-closed by REJECTING (#7) and NOT cached (retries)", async () => {
    let throwOnce = true;
    const counter = { calls: 0 };
    const resolver: BatchWalletResolver = async (wallets) => {
      counter.calls += 1;
      if (throwOnce) {
        throwOnce = false;
        throw new Error("midi_profiles unavailable");
      }
      return wallets.map((w) => ({
        wallet: w.toLowerCase(),
        found: true,
        discord_id: "123456789012345678",
      }));
    };
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolver });
    // first flush throws → REJECT (NOT a silent null — that was the #7 fail-open bug).
    await expect(link.resolve("0xa")).rejects.toBeInstanceOf(LinkResolutionError);
    // NOT cached → a later resolve retries, now resolves.
    expect(await link.resolve("0xa")).toBe("123456789012345678");
    expect(counter.calls).toBe(2);
  });

  // #7 — db_unavailable must FAIL the run, not be treated as confirmed-unlinked
  test("FAIL-CLOSED #7: a `db_unavailable` resolution REJECTS (not a silent skip)", async () => {
    const resolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({
        wallet: w.toLowerCase(),
        found: false,
        discord_id: null,
        resolved_via: "db_unavailable", // the identity DB was down — NOT confirmed-unlinked
      }));
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolver });
    await expect(link.resolve("0xa")).rejects.toBeInstanceOf(LinkResolutionError);
  });

  test("a confirmed `unknown` (not db_unavailable) is null, NOT a reject (#7 boundary)", async () => {
    const resolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({
        wallet: w.toLowerCase(),
        found: false,
        discord_id: null,
        resolved_via: "unknown", // genuinely not in midi_profiles
      }));
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolver });
    expect(await link.resolve("0xa")).toBeNull(); // confirmed-unlinked → skipped, never throws
  });

  // #12 — snowflake-shape validation
  test("FAIL-CLOSED #12: a NON-SNOWFLAKE discord_id is invalid → null (never assigned)", async () => {
    const resolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({
        wallet: w.toLowerCase(),
        found: true,
        discord_id: "not-a-snowflake", // a handle leaked into the column
        resolved_via: "direct",
      }));
    const link = makeWalletDiscordLinkLive({ resolveWalletsImpl: resolver });
    expect(await link.resolve("0xbad")).toBeNull();

    // a too-short numeric value is also rejected.
    const shortResolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({ wallet: w.toLowerCase(), found: true, discord_id: "12345" }));
    const link2 = makeWalletDiscordLinkLive({ resolveWalletsImpl: shortResolver });
    expect(await link2.resolve("0xshort")).toBeNull();

    // a well-formed 18-digit snowflake passes.
    const okResolver: BatchWalletResolver = async (wallets) =>
      wallets.map((w) => ({ wallet: w.toLowerCase(), found: true, discord_id: "123456789012345678" }));
    const link3 = makeWalletDiscordLinkLive({ resolveWalletsImpl: okResolver });
    expect(await link3.resolve("0xok")).toBe("123456789012345678");
  });

  test("expires cache after TTL (re-queries with an injected clock)", async () => {
    const counter = { calls: 0, batches: [] as string[][] };
    let t = 1_000;
    const link = makeWalletDiscordLinkLive({
      resolveWalletsImpl: resolverFrom({ "0xa": sf(1) }, counter),
      cacheTtlMs: 100,
      now: () => t,
    });
    expect(await link.resolve("0xa")).toBe(sf(1));
    expect(counter.calls).toBe(1);
    t += 50; // within TTL
    expect(await link.resolve("0xa")).toBe(sf(1));
    expect(counter.calls).toBe(1);
    t += 200; // past TTL → re-query
    expect(await link.resolve("0xa")).toBe(sf(1));
    expect(counter.calls).toBe(2);
  });
});

describe("makeWalletDiscordLinkMock", () => {
  test("returns mapped snowflake, case-insensitive; null when absent", async () => {
    const link = makeWalletDiscordLinkMock({ "0xAaa": "555", "0xbbb": null });
    expect(await link.resolve("0xaaa")).toBe("555");
    expect(await link.resolve("0xBBB")).toBeNull();
    expect(await link.resolve("0xccc")).toBeNull();
  });
});
