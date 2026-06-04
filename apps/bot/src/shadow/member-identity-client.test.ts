/**
 * member-identity-client.test.ts — the two-read MEMBER-CENTRIC identity client
 * (bd-l08). Proves the discord-id → user_id → primary_wallet chain, the wallet
 * fallback, and FAIL-SOFT at every step (404 / non-2xx / transport / malformed
 * never throws — a bad member resolves to unlinked/no_wallet). Network-free
 * (injected fetch).
 */
import { describe, expect, test } from "bun:test";
import { MemberIdentityClient, extractWallet } from "./member-identity-client.ts";

/** A tiny fetch double keyed on a URL substring → a {status, body} response. */
function fakeFetch(
  routes: Array<{ match: string; status: number; body?: unknown }>,
): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const hit = routes.find((r) => url.includes(r.match));
    if (!hit) return new Response("not found", { status: 404 });
    const init = { status: hit.status } as ResponseInit;
    if (hit.body === undefined) return new Response(null, init);
    return new Response(JSON.stringify(hit.body), init);
  }) as unknown as typeof fetch;
}

const cfg = (fetchImpl: typeof fetch) => ({
  baseUrl: "https://identity.test",
  world: "purupuru",
  fetchImpl,
  timeoutMs: 0, // disable the deadline in tests (no real timers).
});

const DISCORD_ID = "700000000000000001";
const USER_ID = "ae0558c7-aeb2-48f0-906d-ad0a50108b19";
const WALLET = "0x79092A805f1cf9B0F5bE3c5A296De6e51c1DEd34";

describe("bd-l08 — member-identity-client (member-centric, fail-soft)", () => {
  test("linked: discord id → user_id → primary_wallet (lowercased)", async () => {
    const client = new MemberIdentityClient(
      cfg(
        fakeFetch([
          { match: "/v1/resolve/account/discord/", status: 200, body: { user_id: USER_ID } },
          {
            match: "/v1/profile",
            status: 200,
            body: { identity: { user_id: USER_ID, primary_wallet: WALLET, wallets: [] } },
          },
        ]),
      ),
    );
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("linked");
    if (out.kind === "linked") {
      expect(out.user_id).toBe(USER_ID);
      expect(out.wallet).toBe(WALLET.toLowerCase());
    }
  });

  test("unlinked: resolve 404 ⇒ unlinked (no profile call needed)", async () => {
    const client = new MemberIdentityClient(
      cfg(fakeFetch([{ match: "/v1/resolve/account/discord/", status: 404 }])),
    );
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("unlinked");
  });

  test("no_wallet: linked user but profile 404 (primary_wallet_missing) ⇒ no_wallet", async () => {
    const client = new MemberIdentityClient(
      cfg(
        fakeFetch([
          { match: "/v1/resolve/account/discord/", status: 200, body: { user_id: USER_ID } },
          { match: "/v1/profile", status: 404, body: { reason: "primary_wallet_missing" } },
        ]),
      ),
    );
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("no_wallet");
    if (out.kind === "no_wallet") expect(out.user_id).toBe(USER_ID);
  });

  test("wallet fallback: no primary_wallet ⇒ first non-unlinked wallets[] entry", async () => {
    const client = new MemberIdentityClient(
      cfg(
        fakeFetch([
          { match: "/v1/resolve/account/discord/", status: 200, body: { user_id: USER_ID } },
          {
            match: "/v1/profile",
            status: 200,
            body: {
              identity: {
                primary_wallet: null,
                wallets: [
                  { wallet_address: "0xOLD", unlinked_at: "2026-01-01T00:00:00Z" },
                  { wallet_address: WALLET, unlinked_at: null },
                ],
              },
            },
          },
        ]),
      ),
    );
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("linked");
    if (out.kind === "linked") expect(out.wallet).toBe(WALLET.toLowerCase());
  });

  test("fail-soft: a malformed (non-snowflake) discord id ⇒ unlinked, no fetch", async () => {
    let calls = 0;
    const counting = (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const client = new MemberIdentityClient(cfg(counting));
    const out = await client.resolveMember("not-a-snowflake");
    expect(out.kind).toBe("unlinked");
    expect(calls).toBe(0);
  });

  test("fail-soft: a transport throw ⇒ unlinked (never propagates)", async () => {
    const throwing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const client = new MemberIdentityClient(cfg(throwing));
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("unlinked");
  });

  test("fail-soft: a 200 with malformed JSON ⇒ unlinked", async () => {
    const badJson = (async () =>
      new Response("{not json", { status: 200 })) as unknown as typeof fetch;
    const client = new MemberIdentityClient(cfg(badJson));
    const out = await client.resolveMember(DISCORD_ID);
    expect(out.kind).toBe("unlinked");
  });

  describe("extractWallet", () => {
    test("prefers primary_wallet (lowercased)", () => {
      expect(extractWallet({ identity: { primary_wallet: WALLET, wallets: [] } })).toBe(
        WALLET.toLowerCase(),
      );
    });
    test("null body / no identity ⇒ null", () => {
      expect(extractWallet(null)).toBeNull();
      expect(extractWallet({})).toBeNull();
      expect(extractWallet({ identity: null })).toBeNull();
    });
    test("skips unlinked wallets in the fallback", () => {
      expect(
        extractWallet({
          identity: {
            primary_wallet: null,
            wallets: [{ wallet_address: "0xDEAD", unlinked_at: "x" }],
          },
        }),
      ).toBeNull();
    });
  });
});
