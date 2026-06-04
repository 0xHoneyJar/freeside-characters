/**
 * score-source.test.ts — the LIVE + MOCK `ScoreSource` Layers (bd-tfl).
 *
 * Pins:
 *   • tier qualification (>=) against the grounded Purupuru ladder, fail-closed
 *     on unknown/null tiers.
 *   • makeScoreSourceLive.latentQualified counts wallets at/above min_tier from a
 *     mocked CommunityScoreClient (NO network — the client's transport is an
 *     injected fetch).
 *   • a REST failure surfaces a typed ScoreError (never a silent 0).
 *   • the MOCK Layer returns seeded counts / 0 default, with a forced-failure path.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Effect } from "effect";
import { ScoreSource } from "./substrate.ts";
import type { RoleRule } from "@freeside-worlds/shadow-substrate";
import { makeScoreSourceLive, type LiveScoreConfig } from "./score-source.live.ts";
import {
  ScoreSourceMock,
  seedLatentCount,
  setMockScoreFailure,
  resetMockScoreSource,
} from "./score-source.mock.ts";
import {
  CommunityScoreClient,
  type CommunityScoreClientConfig,
} from "@freeside-characters/persona-engine/score/community-client";
import { tierQualifies, purupuruTierRank } from "./purupuru-tiers.ts";

// ── a rule helper (the substrate's RoleRule shape) ──────────────────────────
function rule(role_key: string, min_tier: string): RoleRule {
  return {
    role_key,
    display_name: role_key,
    qualifies: { source: "tier", min_tier },
    create_if_absent: true,
  } as RoleRule;
}

// ── a CommunityScoreClient backed by an injected fetch (no network) ─────────
function clientReturning(wallets: Array<{ wallet: string; tier: string | null }>) {
  const body = {
    community: "purupuru",
    total: wallets.length,
    wallets: wallets.map((w, i) => ({
      wallet: w.wallet,
      rank: i + 1,
      combined_score: 50,
      tier: w.tier,
    })),
  };
  const fakeFetch = (async () => Response.json(body)) as unknown as typeof fetch;
  const cfg: CommunityScoreClientConfig = {
    baseUrl: "https://score-api.test",
    apiKey: "sk-test",
    community: "purupuru",
    retry: { fetchImpl: fakeFetch, maxAttempts: 1, sleep: async () => {} },
  };
  return new CommunityScoreClient(cfg);
}

function failingClient() {
  const fakeFetch = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
  return new CommunityScoreClient({
    baseUrl: "https://score-api.test",
    apiKey: "sk-test",
    community: "purupuru",
    retry: { fetchImpl: fakeFetch, maxAttempts: 1, sleep: async () => {} },
  });
}

describe("purupuru-tiers — tierQualifies", () => {
  test("STRENGTH ladder: newcomer < member < devoted < core < elder < sovereign", () => {
    // crowd ascending
    expect(purupuruTierRank("newcomer")).toBeLessThan(purupuruTierRank("member")!);
    expect(purupuruTierRank("member")).toBeLessThan(purupuruTierRank("devoted")!);
    expect(purupuruTierRank("devoted")).toBeLessThan(purupuruTierRank("core")!);
    // elite OVERRIDES crowd: every elite tier > every crowd tier
    expect(purupuruTierRank("core")).toBeLessThan(purupuruTierRank("elder")!);
    // within elite: sovereign (rank 1-7) is STRONGER than elder (rank 8-50).
    // NOTE: this is the OPPOSITE of score-api sort_order (which lists sovereign
    // before elder) — sort_order is presentation, not strength.
    expect(purupuruTierRank("elder")).toBeLessThan(purupuruTierRank("sovereign")!);
  });

  test(">= semantics: a wallet at-or-above min_tier qualifies", () => {
    expect(tierQualifies("sovereign", "core")).toBe(true); // 6 >= 4
    expect(tierQualifies("core", "core")).toBe(true); // 4 >= 4 (boundary)
    expect(tierQualifies("member", "core")).toBe(false); // 2 < 4
  });

  test("elite > all crowd: a core wallet does NOT qualify an elite min_tier", () => {
    expect(tierQualifies("core", "elder")).toBe(false); // 4 < 5
    expect(tierQualifies("core", "sovereign")).toBe(false); // 4 < 6
  });

  test("min_tier='sovereign' qualifies ONLY sovereign (NOT elder)", () => {
    expect(tierQualifies("sovereign", "sovereign")).toBe(true); // 6 >= 6
    expect(tierQualifies("elder", "sovereign")).toBe(false); // 5 < 6 — elder is NOT sovereign-strong
    expect(tierQualifies("core", "sovereign")).toBe(false);
  });

  test("min_tier='elder' qualifies elder AND sovereign (the two elite tiers)", () => {
    expect(tierQualifies("elder", "elder")).toBe(true); // 5 >= 5
    expect(tierQualifies("sovereign", "elder")).toBe(true); // 6 >= 5 — sovereign outranks elder
    expect(tierQualifies("core", "elder")).toBe(false); // 4 < 5
  });

  test("fail-closed: null/unknown wallet tier never qualifies", () => {
    expect(tierQualifies(null, "newcomer")).toBe(false);
    expect(tierQualifies(undefined, "newcomer")).toBe(false);
    expect(tierQualifies("ghost-tier", "newcomer")).toBe(false);
  });

  test("fail-closed: unknown min_tier (misconfigured rule) never qualifies", () => {
    expect(tierQualifies("sovereign", "typo-tier")).toBe(false);
  });

  test("case-insensitive on the wallet tier", () => {
    expect(tierQualifies("SOVEREIGN", "core")).toBe(true);
  });
});

describe("makeScoreSourceLive.latentQualified (no network)", () => {
  const cfgFor = (client: CommunityScoreClient | undefined): LiveScoreConfig => ({
    clientFor: () => client,
  });

  test("counts wallets at/above the rule min_tier", async () => {
    const client = clientReturning([
      { wallet: "0x1", tier: "elder" },     // 5 >= 4 ✓ (elite > core)
      { wallet: "0x2", tier: "sovereign" }, // 6 >= 4 ✓ (top tier)
      { wallet: "0x3", tier: "core" },      // 4 >= 4 ✓ (boundary)
      { wallet: "0x4", tier: "member" },    // 2 < 4 ✗
      { wallet: "0x5", tier: null },        // untiered ✗
      { wallet: "0x6", tier: "newcomer" },  // 1 < 4 ✗
    ]);
    const layer = makeScoreSourceLive(cfgFor(client));
    const count = await Effect.runPromise(
      ScoreSource.pipe(
        Effect.flatMap((s) => s.latentQualified("purupuru" as never, rule("purupuru:core", "core"))),
        Effect.provide(layer),
      ),
    );
    expect(count).toBe(3);
  });

  test("min_tier=newcomer counts every tiered wallet (lowest rung)", async () => {
    const client = clientReturning([
      { wallet: "0x1", tier: "newcomer" },
      { wallet: "0x2", tier: "elder" },
      { wallet: "0x3", tier: null }, // untiered still excluded
    ]);
    const count = await Effect.runPromise(
      ScoreSource.pipe(
        Effect.flatMap((s) =>
          s.latentQualified("purupuru" as never, rule("purupuru:member", "newcomer")),
        ),
        Effect.provide(makeScoreSourceLive(cfgFor(client))),
      ),
    );
    expect(count).toBe(2);
  });

  test("a REST 403 surfaces a typed ScoreError (never a silent 0)", async () => {
    const layer = makeScoreSourceLive(cfgFor(failingClient()));
    const res = await Effect.runPromise(
      Effect.either(
        ScoreSource.pipe(
          Effect.flatMap((s) =>
            s.latentQualified("purupuru" as never, rule("purupuru:core", "core")),
          ),
          Effect.provide(layer),
        ),
      ),
    );
    expect(res._tag).toBe("Left");
    if (res._tag === "Left") {
      expect(res.left._tag).toBe("ScoreError");
      expect(res.left.message).toContain("forbidden");
    }
  });

  test("no client wired for the world → fail-closed ScoreError (not a 0)", async () => {
    const layer = makeScoreSourceLive(cfgFor(undefined));
    const res = await Effect.runPromise(
      Effect.either(
        ScoreSource.pipe(
          Effect.flatMap((s) =>
            s.latentQualified("purupuru" as never, rule("purupuru:core", "core")),
          ),
          Effect.provide(layer),
        ),
      ),
    );
    expect(res._tag).toBe("Left");
    if (res._tag === "Left") expect(res.left._tag).toBe("ScoreError");
  });
});

describe("MOCK ScoreSource", () => {
  beforeEach(() => resetMockScoreSource());

  test("returns a seeded count", async () => {
    seedLatentCount("purupuru", "purupuru:core", 7);
    const count = await Effect.runPromise(
      ScoreSource.pipe(
        Effect.flatMap((s) =>
          s.latentQualified("purupuru" as never, rule("purupuru:core", "core")),
        ),
        Effect.provide(ScoreSourceMock),
      ),
    );
    expect(count).toBe(7);
  });

  test("unseeded rule → 0 (no network, no throw)", async () => {
    const count = await Effect.runPromise(
      ScoreSource.pipe(
        Effect.flatMap((s) =>
          s.latentQualified("purupuru" as never, rule("purupuru:unknown", "core")),
        ),
        Effect.provide(ScoreSourceMock),
      ),
    );
    expect(count).toBe(0);
  });

  test("forced failure → typed ScoreError", async () => {
    setMockScoreFailure(true);
    const res = await Effect.runPromise(
      Effect.either(
        ScoreSource.pipe(
          Effect.flatMap((s) =>
            s.latentQualified("purupuru" as never, rule("purupuru:core", "core")),
          ),
          Effect.provide(ScoreSourceMock),
        ),
      ),
    );
    expect(res._tag).toBe("Left");
    if (res._tag === "Left") expect(res.left._tag).toBe("ScoreError");
  });
});
