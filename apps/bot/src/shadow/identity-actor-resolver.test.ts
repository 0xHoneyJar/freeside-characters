/**
 * identity-actor-resolver.test.ts — the ISOLATED actor resolver for `/role-sync`
 * (bd-atm). NETWORK-FREE: `fetch` is injected.
 *
 * Proves (the isolation + fail-closed gates):
 *   • a 200 { user_id } hit ⇒ { actor: user_id } — the value runTierRoleGoLive
 *     authzs against admin_principals.
 *   • a 404 (unlinked discord) ⇒ null ⇒ the trigger refuses (fail-closed).
 *   • a non-2xx / transport error / malformed body ⇒ null (fail-closed).
 *   • a missing / malformed invoking id ⇒ null WITHOUT any HTTP call.
 *   • the request hits `/v1/resolve/account/discord/{id}` (the identity-api
 *     route), INDEPENDENT of any AUTH_BACKEND / AuthContext.
 *   • the optional service token is sent as `x-service-token` when configured.
 */
import { describe, expect, test } from "bun:test";
import {
  resolveActorFromDiscordId,
  makeIdentityActorResolverFor,
} from "./identity-actor-resolver.ts";

const BASE = "https://identity.example.test";
const DISCORD_ID = "700000000000000001"; // a valid 18-digit snowflake
const USER_ID = "ae0558c7-aeb2-48f0-906d-ad0a50108b19";

/** A fake fetch that records the URL+init and returns a fixed Response. */
function fakeFetch(
  res: Response,
  record?: (url: string, init?: RequestInit) => void,
): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    record?.(String(url), init);
    return res;
  }) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("bd-atm — resolveActorFromDiscordId: identity-api lookup, AUTH_BACKEND-independent", () => {
  test("200 { user_id } ⇒ { actor: user_id } and hits /v1/resolve/account/discord/{id}", async () => {
    let seenUrl = "";
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID }), (u) => (seenUrl = u)) },
      DISCORD_ID,
    );
    expect(r).toEqual({ actor: USER_ID });
    expect(seenUrl).toBe(`${BASE}/v1/resolve/account/discord/${DISCORD_ID}`);
  });

  test("404 (unlinked discord) ⇒ null (fail-closed → trigger refuses)", async () => {
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(404, { code: "not_found" })) },
      DISCORD_ID,
    );
    expect(r).toBeNull();
  });

  test("non-2xx (500) ⇒ null (fail-closed)", async () => {
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(500, { error: "boom" })) },
      DISCORD_ID,
    );
    expect(r).toBeNull();
  });

  test("transport error (fetch throws) ⇒ null (fail-closed)", async () => {
    const throwing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await resolveActorFromDiscordId({ baseUrl: BASE, fetchImpl: throwing }, DISCORD_ID);
    expect(r).toBeNull();
  });

  test("malformed body (no user_id) ⇒ null (fail-closed)", async () => {
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(200, { not_user_id: "x" })) },
      DISCORD_ID,
    );
    expect(r).toBeNull();
  });

  test("missing invoking id ⇒ null WITHOUT any HTTP call", async () => {
    let called = false;
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID }), () => (called = true)) },
      undefined,
    );
    expect(r).toBeNull();
    expect(called).toBe(false);
  });

  test("malformed invoking id ('unknown') ⇒ null WITHOUT any HTTP call", async () => {
    let called = false;
    const r = await resolveActorFromDiscordId(
      { baseUrl: BASE, fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID }), () => (called = true)) },
      "unknown",
    );
    expect(r).toBeNull();
    expect(called).toBe(false);
  });

  test("service token, when set, is sent as x-service-token", async () => {
    let seenHeaders: Record<string, string> = {};
    await resolveActorFromDiscordId(
      {
        baseUrl: BASE,
        serviceToken: "svc-tok-123",
        fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID }), (_u, init) => {
          seenHeaders = (init?.headers as Record<string, string>) ?? {};
        }),
      },
      DISCORD_ID,
    );
    expect(seenHeaders["x-service-token"]).toBe("svc-tok-123");
  });

  test("a trailing slash on baseUrl is normalized (no double slash)", async () => {
    let seenUrl = "";
    await resolveActorFromDiscordId(
      { baseUrl: `${BASE}/`, fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID }), (u) => (seenUrl = u)) },
      DISCORD_ID,
    );
    expect(seenUrl).toBe(`${BASE}/v1/resolve/account/discord/${DISCORD_ID}`);
  });
});

describe("bd-atm — makeIdentityActorResolverFor: ActorResolver factory keyed on discord id", () => {
  test("the curried factory binds config once + resolves per discord id", async () => {
    const factory = makeIdentityActorResolverFor({
      baseUrl: BASE,
      fetchImpl: fakeFetch(jsonResponse(200, { user_id: USER_ID })),
    });
    const resolver = factory(DISCORD_ID);
    expect(await resolver()).toEqual({ actor: USER_ID });
  });

  test("an unresolved id ⇒ the resolver yields null (the trigger refuses)", async () => {
    const factory = makeIdentityActorResolverFor({
      baseUrl: BASE,
      fetchImpl: fakeFetch(jsonResponse(404, {})),
    });
    expect(await factory(DISCORD_ID)()).toBeNull();
  });
});
