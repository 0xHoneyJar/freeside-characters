/**
 * config-service-client.test.ts — the CONFIG_SERVICE_URL cutover client +
 * the deployed-config-service smoke shape (Sprint 405 / Task 405.7, D4).
 *
 * Shadow-preview runs on mock (no config-service); the cutover is for
 * apply/persist. These tests exercise the client's contract against a fake
 * fetch — the LIVE URL + token are operator/deploy-provided (the deployed smoke
 * test runs against the real service in CI/deploy, hitting GET/PUT + /health).
 */
import { describe, expect, test } from "bun:test";
import { ConfigServiceClient, ConfigServiceTimeoutError } from "./config-service-client.ts";

function fakeFetch(handler: (url: string, init?: RequestInit) => Response): typeof fetch {
  return (async (url: string, init?: RequestInit) => handler(String(url), init)) as unknown as typeof fetch;
}

describe("405.7 — config-service cutover client", () => {
  test("preview-only mode (no CONFIG_SERVICE_URL): GET returns null, PUT refuses", async () => {
    const c = new ConfigServiceClient({ baseUrl: undefined, getToken: () => null });
    expect(c.isLive).toBe(false);
    expect(await c.getOnboardingLifecycle("purupuru", "cm-1")).toBeNull();
    await expect(c.putOnboardingLifecycle("purupuru", "cm-1", {}, 0)).rejects.toThrow(
      /CONFIG_SERVICE_URL unset/,
    );
  });

  test("LIVE cutover: GET routes to /v1/config/:world/onboarding-lifecycle?cm=…with bearer", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "tok-abc",
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenAuth = String((init?.headers as Record<string, string>)?.authorization ?? "");
        return new Response(JSON.stringify({ envelope: { step: "preview" }, version: 2 }), { status: 200 });
      }),
    });
    expect(c.isLive).toBe(true);
    const got = await c.getOnboardingLifecycle<{ step: string }>("purupuru", "cm-1");
    expect(seenUrl).toContain("/v1/config/purupuru/onboarding-lifecycle?cm=cm-1");
    expect(seenAuth).toBe("Bearer tok-abc");
    expect(got?.version).toBe(2);
    expect(got?.envelope.step).toBe("preview");
  });

  test("GET 404 → null (default → SHADOW)", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: fakeFetch(() => new Response("", { status: 404 })),
    });
    expect(await c.getOnboardingLifecycle("purupuru", "cm-1")).toBeNull();
  });

  test("PUT 403 (not allowlisted) surfaces the FR-10 floor message", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: fakeFetch(() => new Response("", { status: 403 })),
    });
    await expect(c.putOnboardingLifecycle("purupuru", "cm-1", { step: "go_live" }, 1)).rejects.toThrow(
      /403.*not authorized.*admin_principals/s,
    );
  });

  test("PUT 409 surfaces the optimistic-lock conflict", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: fakeFetch(() => new Response("", { status: 409 })),
    });
    await expect(c.putOnboardingLifecycle("purupuru", "cm-1", {}, 1)).rejects.toThrow(/409.*version conflict/);
  });

  test("D4 smoke shape: /health probe", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => null,
      fetchImpl: fakeFetch((url) => new Response("ok", { status: url.endsWith("/health") ? 200 : 500 })),
    });
    expect(await c.health()).toBe(true);
  });
});

describe("F5 — every config-service RPC has a bounded deadline", () => {
  // A fetch impl that honors the AbortSignal and never resolves until aborted —
  // models a hung/slow config-service. The client's deadline must abort it.
  function hangingFetch(): typeof fetch {
    return ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            return;
          }
          signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }
        // otherwise: never resolves (the hang).
      })) as unknown as typeof fetch;
  }

  test("GET onboarding-lifecycle times out (typed ConfigServiceTimeoutError) instead of hanging", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: hangingFetch(),
      timeoutMs: 20,
    });
    await expect(c.getOnboardingLifecycle("purupuru", "cm-1")).rejects.toBeInstanceOf(
      ConfigServiceTimeoutError,
    );
  });

  test("PUT onboarding-lifecycle times out (typed error) instead of hanging", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: hangingFetch(),
      timeoutMs: 20,
    });
    await expect(c.putOnboardingLifecycle("purupuru", "cm-1", {}, 0)).rejects.toBeInstanceOf(
      ConfigServiceTimeoutError,
    );
  });

  test("health() returns false on a hung service (bounded probe, no hang)", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => null,
      fetchImpl: hangingFetch(),
      timeoutMs: 20,
    });
    expect(await c.health()).toBe(false);
  });

  test("a non-abort transport error is re-thrown as-is (not masked as a timeout)", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch,
      timeoutMs: 1000,
    });
    await expect(c.getOnboardingLifecycle("purupuru", "cm-1")).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe("bd-71y — getRoleMap (the role-sync trigger's CM-authored-map read)", () => {
  test("unwired (no CONFIG_SERVICE_URL) ⇒ null (caller uses the default seed)", async () => {
    const c = new ConfigServiceClient({ baseUrl: undefined, getToken: () => null });
    expect(await c.getRoleMap("purupuru")).toBeNull();
  });

  test("LIVE: GET routes to /v1/config/:world/role-map (world-scoped, no cm param) with bearer", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "tok-abc",
      fetchImpl: fakeFetch((url, init) => {
        seenUrl = url;
        seenAuth = String((init?.headers as Record<string, string>)?.authorization ?? "");
        return new Response(JSON.stringify({ envelope: { enabled: true, namespace_prefix: "purupuru:", rules: [] }, version: 3 }), { status: 200 });
      }),
    });
    const got = await c.getRoleMap<{ namespace_prefix: string }>("purupuru");
    expect(seenUrl).toContain("/v1/config/purupuru/role-map");
    expect(seenUrl).not.toContain("cm="); // world-scoped, not per-CM
    expect(seenAuth).toBe("Bearer tok-abc");
    expect(got?.version).toBe(3);
    expect(got?.envelope.namespace_prefix).toBe("purupuru:");
  });

  test("404 (no map authored) ⇒ null (caller uses the seed)", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: fakeFetch(() => new Response("", { status: 404 })),
    });
    expect(await c.getRoleMap("purupuru")).toBeNull();
  });

  test("a 5xx THROWS (a real outage is never silently treated as 'no map')", async () => {
    const c = new ConfigServiceClient({
      baseUrl: "https://config.example",
      getToken: () => "t",
      fetchImpl: fakeFetch(() => new Response("boom", { status: 503 })),
    });
    await expect(c.getRoleMap("purupuru")).rejects.toThrow(/role-map 503/);
  });
});
