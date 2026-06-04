/**
 * community-client.test.ts — the LIVE REST community score client (bd-tfl).
 *
 * Pure: injected fetch (response factories), injected sleep (records delays,
 * never waits). No network. Pins the grounded score-api community contract:
 *   - leaderboard parse (wallet + tier)
 *   - x-api-key auth header
 *   - fail-closed classification (403 forbidden / 404 not_found / 4xx bad / 5xx
 *     upstream / decode / transport) — NEVER a silent empty result.
 */
import { describe, expect, test } from "bun:test";
import {
  CommunityScoreClient,
  CommunityScoreError,
} from "./community-client.ts";
import type { FetchRetryOptions } from "./retry.ts";

const noWait: Pick<FetchRetryOptions, "sleep" | "random"> = {
  sleep: async () => {},
  random: () => 0.5,
};

/** Build a client whose transport is the supplied fake fetch. */
function client(
  fakeFetch: typeof fetch,
  over: Partial<{ community: string; apiKey: string; baseUrl: string }> = {},
) {
  return new CommunityScoreClient({
    baseUrl: over.baseUrl ?? "https://score-api.test",
    apiKey: over.apiKey ?? "sk-test-key",
    community: over.community ?? "purupuru",
    retry: { ...noWait, fetchImpl: fakeFetch, maxAttempts: 1 },
  });
}

/** A fake fetch returning a single Response and capturing the request. */
function once(resp: Response, sink?: { url?: string; init?: RequestInit }) {
  return (async (url: string, init: RequestInit) => {
    if (sink) {
      sink.url = url;
      sink.init = init;
    }
    return resp;
  }) as unknown as typeof fetch;
}

const COMMUNITY_BODY = {
  community: "purupuru",
  total: 3,
  cohort_total: 3,
  truncated: false,
  meta: { foo: "bar" }, // extra/tolerated
  wallets: [
    { wallet: "0xaaa", rank: 1, combined_score: 98, tier: "sovereign", og_score: 50, nft_score: 30, onchain_score: 18 },
    { wallet: "0xbbb", rank: 12, combined_score: 70, tier: "devoted" },
    { wallet: "0xccc", rank: null, combined_score: null, tier: null },
  ],
};

describe("CommunityScoreClient.leaderboard", () => {
  test("parses the community leaderboard + sends x-api-key", async () => {
    const sink: { url?: string; init?: RequestInit } = {};
    const c = client(once(Response.json(COMMUNITY_BODY), sink));
    const page = await c.leaderboard();

    expect(page.community).toBe("purupuru");
    expect(page.wallets.length).toBe(3);
    expect(page.wallets[0]!.wallet).toBe("0xaaa");
    expect(page.wallets[0]!.tier).toBe("sovereign");
    expect(page.wallets[2]!.tier).toBeNull(); // untiered wallet preserved

    // grounded auth + URL shape
    expect(sink.url).toBe("https://score-api.test/v1/leaderboard?community=purupuru");
    const headers = sink.init!.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test-key");
  });

  test("tolerates additive upstream fields (open struct)", async () => {
    const body = {
      community: "purupuru",
      total: 1,
      wallets: [{ wallet: "0xddd", rank: 2, combined_score: 80, tier: "core", new_future_field: "x" }],
    };
    const c = client(once(Response.json(body)));
    const page = await c.leaderboard();
    expect(page.wallets[0]!.tier).toBe("core");
  });

  test("403 → forbidden (out-of-scope key, fail-closed)", async () => {
    const c = client(once(new Response("nope", { status: 403 })));
    const res = await c.leaderboard().catch((e) => e);
    expect(res).toBeInstanceOf(CommunityScoreError);
    expect((res as CommunityScoreError).kind).toBe("forbidden");
    expect((res as CommunityScoreError).status).toBe(403);
  });

  test("404 → not_found", async () => {
    const c = client(once(new Response("gone", { status: 404 })));
    const res = await c.leaderboard().catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("not_found");
  });

  test("400 → bad_request (unresolved community)", async () => {
    const c = client(once(new Response("bad", { status: 400 })));
    const res = await c.leaderboard().catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("bad_request");
  });

  test("500 → upstream", async () => {
    const c = client(once(new Response("boom", { status: 500 })));
    const res = await c.leaderboard().catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("upstream");
  });

  test("malformed body → decode (never a silent empty result)", async () => {
    const c = client(once(Response.json({ not: "a leaderboard" })));
    const res = await c.leaderboard().catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("decode");
  });

  test("network throw → transport", async () => {
    const throwing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const c = client(throwing);
    const res = await c.leaderboard().catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("transport");
  });
});

describe("CommunityScoreClient.leaderboard — fail-closed safety guards", () => {
  // #4 — community match
  test("REFUSES a community mismatch (foreign tiers would poison assignment)", async () => {
    const foreign = {
      community: "mibera", // ← gateway/default-community fallback bug
      total: 1,
      wallets: [{ wallet: "0xaaa", rank: 1, combined_score: 98, tier: "sovereign" }],
    };
    const c = client(once(Response.json(foreign))); // client asks for "purupuru"
    const res = await c.leaderboard().catch((e) => e);
    expect(res).toBeInstanceOf(CommunityScoreError);
    expect((res as CommunityScoreError).kind).toBe("decode");
    expect((res as CommunityScoreError).message).toContain("community mismatch");
  });

  test("accepts a matching community (no false positive)", async () => {
    const c = client(once(Response.json(COMMUNITY_BODY)));
    const page = await c.leaderboard();
    expect(page.community).toBe("purupuru");
  });

  // #5 — truncation
  test("REFUSES a TRUNCATED page (partial roster would under-assign roles)", async () => {
    const truncated = {
      community: "purupuru",
      total: 500,
      truncated: true, // ← only a partial page returned
      wallets: [{ wallet: "0xaaa", rank: 1, combined_score: 98, tier: "sovereign" }],
    };
    const c = client(once(Response.json(truncated)));
    const res = await c.leaderboard().catch((e) => e);
    expect(res).toBeInstanceOf(CommunityScoreError);
    expect((res as CommunityScoreError).kind).toBe("decode");
    expect((res as CommunityScoreError).message).toContain("TRUNCATED");
  });

  test("truncated:false (or absent) is accepted (the normal full-page case)", async () => {
    const c1 = client(once(Response.json({ ...COMMUNITY_BODY, truncated: false })));
    expect((await c1.leaderboard()).wallets.length).toBe(3);
    // absent field (older score-api build) ⇒ treated NOT truncated.
    const noField = { community: "purupuru", total: 1, wallets: [{ wallet: "0xddd", rank: 2, combined_score: 80, tier: "core" }] };
    const c2 = client(once(Response.json(noField)));
    expect((await c2.leaderboard()).wallets.length).toBe(1);
  });

  // #10 — request timeout
  test("aborts a hung request after the deadline → transport error", async () => {
    // a fetch that never resolves UNTIL its signal aborts (mirrors a hung upstream).
    const hung = ((url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        if (signal) {
          if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }
      })) as unknown as typeof fetch;
    const c = new CommunityScoreClient({
      baseUrl: "https://score-api.test",
      apiKey: "sk-test-key",
      community: "purupuru",
      requestTimeoutMs: 5, // tiny deadline
      retry: { ...noWait, fetchImpl: hung, maxAttempts: 1 },
    });
    const res = await c.leaderboard().catch((e) => e);
    expect(res).toBeInstanceOf(CommunityScoreError);
    expect((res as CommunityScoreError).kind).toBe("transport");
  });
});

describe("CommunityScoreClient.walletProfile", () => {
  test("parses a single wallet profile + correct URL", async () => {
    const sink: { url?: string; init?: RequestInit } = {};
    const c = client(once(Response.json({ wallet: "0xaaa", tier: "elder" }), sink));
    const p = await c.walletProfile("0xAAA");
    expect(p.wallet).toBe("0xaaa");
    expect(p.tier).toBe("elder");
    expect(sink.url).toBe("https://score-api.test/v1/wallets/0xAAA?community=purupuru");
  });

  test("403 fail-closed on single profile too", async () => {
    const c = client(once(new Response("nope", { status: 403 })));
    const res = await c.walletProfile("0xaaa").catch((e) => e);
    expect((res as CommunityScoreError).kind).toBe("forbidden");
  });
});
