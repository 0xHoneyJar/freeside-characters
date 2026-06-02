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
import { ConfigServiceClient } from "./config-service-client.ts";

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
