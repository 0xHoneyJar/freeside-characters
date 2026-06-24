/**
 * role-sync-boot.test.ts — the LIVE `/role-sync` boot composition (bd-atm).
 * NETWORK-FREE: the bot client, fetch, wallet link, and role-map reader are all
 * injected; the only real I/O is reading the VENDORED apps/bot/worlds/purupuru.yaml
 * (a checked-in file, the FR-10 admin_principals + guild_id source).
 *
 * Proves (the bd-atm wiring gates):
 *   • env-present (ROLE_SYNC_ENABLED + a readable manifest) ⇒ deps compose, and
 *     the SHADOW invocation runs through the REAL substrate gate with ZERO writes.
 *   • env-absent (ROLE_SYNC_ENABLED unset) ⇒ buildRoleSyncBootDeps returns null
 *     (fail-closed; `/role-sync` is "not configured").
 *   • the isolated actor resolver refuses an unresolved (404) discord ⇒ the
 *     trigger refuses BEFORE any read (no orchestration), via the wired
 *     actorResolverFor.
 *   • manifestPathForWorld resolves to the vendored copy + that file carries the
 *     expected admin_principals (the bare-uuid actor resolveAuthz matches).
 *   • LIVE apply fails CLOSED (audit deps not wired) with a clear message.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import {
  buildRoleSyncBootDeps,
  manifestPathForWorld,
  type RoleSyncBootEnv,
  type RoleSyncBootSeams,
} from "./role-sync-boot.ts";
import { handleRoleSyncInteraction } from "./role-sync-interaction.ts";
import { makeWalletDiscordLinkMock } from "./wallet-discord-link.live.ts";
import type { DiscordInteraction } from "../discord-interactions/types.ts";
import { InteractionResponseType, MessageFlags } from "../discord-interactions/types.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import { Collection, type Client } from "discord.js";

const ADMIN_UUID = "ae0558c7-aeb2-48f0-906d-ad0a50108b19";
const PURUPURU_GUILD = "1495534680617910396";
const INVOKER_DISCORD_ID = "700000000000000001"; // a valid 18-digit snowflake
const ADMIN_WALLET = "0x79092a805f1cf9b0f5be3c5a296de6e51c1ded34";

/** A fake fetch returning a fixed identity-api Response (network-free). */
function identityFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

/**
 * A route-aware fetch double for the member-centric SHADOW path: the resolve
 * call (`/v1/resolve/account/discord/`) → { user_id }, the profile call
 * (`/v1/profile`) → { identity: { primary_wallet } }. Network-free.
 */
function memberIdentityFetch(): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/v1/resolve/account/discord/")) return json({ user_id: ADMIN_UUID });
    if (url.includes("/v1/profile")) {
      return json({ identity: { user_id: ADMIN_UUID, primary_wallet: ADMIN_WALLET, wallets: [] } });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

/**
 * A minimal fake discord.js Client exposing only `guilds.fetch().members.fetch()`
 * with the shape `makeMemberSourceLive` reads (id, roles.cache, nickname, user).
 * One member: the operator-style invoker, holding NO managed roles yet.
 */
function fakeBotClient(): Client {
  const member = {
    id: INVOKER_DISCORD_ID,
    nickname: "soju",
    user: { globalName: "soju", username: "soju" },
    roles: { cache: new Map() },
  };
  const guild = {
    members: { fetch: async () => new Map([[member.id, member]]) },
  };
  return {
    guilds: { fetch: async () => guild },
  } as unknown as Client;
}

/** Seams with NO live discord client (SHADOW uses mock roster, zero writes). */
function seams(overrides: Partial<RoleSyncBootSeams> = {}): RoleSyncBootSeams {
  return {
    getBotClient: async () => null,
    walletDiscordLink: makeWalletDiscordLinkMock({}),
    readRoleMap: () => null, // ⇒ default seed
    ...overrides,
  };
}

/** A `/role-sync` interaction (SHADOW by default) invoked by INVOKER_DISCORD_ID. */
function interaction(modeValue?: string): DiscordInteraction {
  return {
    type: 2,
    id: "999000111222333444",
    application_id: "app",
    token: "tok",
    guild_id: PURUPURU_GUILD,
    member: { user: { id: INVOKER_DISCORD_ID, username: "soju" } },
    data: {
      id: "cmd",
      name: "role-sync",
      options: modeValue !== undefined ? [{ name: "mode", type: 3, value: modeValue }] : [],
    },
  } as unknown as DiscordInteraction;
}

describe("bd-atm — manifestPathForWorld + the vendored manifest", () => {
  test("resolves to the vendored apps/bot/worlds/<slug>.yaml", () => {
    const p = manifestPathForWorld("purupuru");
    expect(p.endsWith("apps/bot/worlds/purupuru.yaml")).toBe(true);
  });

  test("the vendored manifest carries the expected admin_principals (FR-10)", () => {
    const doc = parseYaml(readFileSync(manifestPathForWorld("purupuru"), "utf8")) as {
      shadow_onboarding?: { admin_principals?: unknown; guild_id?: unknown; namespace_prefix?: unknown };
    };
    expect(doc.shadow_onboarding?.admin_principals).toEqual([ADMIN_UUID]);
    expect(doc.shadow_onboarding?.guild_id).toBe(PURUPURU_GUILD);
    expect(doc.shadow_onboarding?.namespace_prefix).toBe("purupuru:");
  });

  test("an unsafe slug is refused (no path traversal into the manifest read)", () => {
    expect(() => manifestPathForWorld("../etc/passwd")).toThrow();
  });
});

describe("bd-atm — buildRoleSyncBootDeps: env gate (fail-closed)", () => {
  test("env-absent (ROLE_SYNC_ENABLED unset) ⇒ null (not configured)", () => {
    const deps = buildRoleSyncBootDeps({}, seams());
    expect(deps).toBeNull();
  });

  test("ROLE_SYNC_ENABLED falsey ⇒ null", () => {
    const deps = buildRoleSyncBootDeps({ ROLE_SYNC_ENABLED: "0" } as RoleSyncBootEnv, seams());
    expect(deps).toBeNull();
  });

  test("env-present ⇒ deps compose (world + worldConfig from the manifest)", () => {
    const deps = buildRoleSyncBootDeps({ ROLE_SYNC_ENABLED: "1" } as RoleSyncBootEnv, seams());
    expect(deps).not.toBeNull();
    expect(deps!.world).toBe("purupuru");
    expect(deps!.worldConfig.guild_id).toBe(PURUPURU_GUILD);
    expect(deps!.worldConfig.namespace_prefix).toBe("purupuru:");
    expect(typeof deps!.invokeOrchestration).toBe("function");
    expect(typeof deps!.actorResolverFor).toBe("function");
  });
});

describe("bd-l08 — end-to-end: SHADOW runs the MEMBER-CENTRIC dashboard, ZERO writes", () => {
  test("a resolved CM (200) runs the member-centric SHADOW dashboard → EPHEMERAL CV2", async () => {
    // The boot composition wires memberCentric: a SHADOW run reads guild members
    // (fake client) → identity (resolve+profile) → tier → the CM dashboard.
    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1" } as RoleSyncBootEnv,
      seams({ getBotClient: async () => fakeBotClient(), fetchImpl: memberIdentityFetch() }),
    )!;

    const res = await handleRoleSyncInteraction(interaction(), undefined, deps);

    // SHADOW preview → the member-centric CV2 dashboard, EPHEMERAL, zero writes
    // (the member path never calls the orchestration / gate).
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    const flags = (res.data as { flags?: number }).flags ?? 0;
    expect(flags & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    expect(flags & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
    expect((res.data as { content?: string }).content).toBeUndefined();
    // the member-centric dashboard renders (redesigned bd-xaa). With NO score key
    // the operator's member resolves to tier=null → NO-CHANGE → the redesign
    // COLLAPSES non-actionable members into ONE dim line (no per-member row), so
    // we assert the title + the strong center + the collapse line, not a per-row nick.
    const text = JSON.stringify((res.data as { components?: unknown }).components);
    expect(text).toContain("Member roles");
    expect(text).toContain("## 0 would gain a role");
    expect(text).toContain("Not actionable");
  });

  test("with a score key, the operator-style member resolves tier 'member' → ADD", async () => {
    // route-aware fetch: identity reads + the score wallet-profile read (tier).
    const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      if (url.includes("/v1/resolve/account/discord/")) return json({ user_id: ADMIN_UUID });
      if (url.includes("/v1/profile")) {
        return json({ identity: { primary_wallet: ADMIN_WALLET, wallets: [] } });
      }
      // score-api GET /v1/wallets/{wallet}?community=purupuru → { wallet, tier }
      if (url.includes("/v1/wallets/")) return json({ wallet: ADMIN_WALLET, tier: "member" });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1", SCORE_PURUPURU_API_KEY: "k" } as RoleSyncBootEnv,
      seams({ getBotClient: async () => fakeBotClient(), fetchImpl }),
    )!;
    const res = await handleRoleSyncInteraction(interaction(), undefined, deps);
    const text = JSON.stringify((res.data as { components?: unknown }).components);
    // operator-style: linked, tier member → purupuru:member, in the ADD group.
    // Redesign (bd-xaa): ADD rows lead with the proposed role + tier note, and the
    // `purupuru:` namespace prefix is STRIPPED from the rendered span (data keeps it).
    expect(text).toContain("## 1 would gain a role");
    expect(text).toContain("Would gain a role (1)");
    expect(text).toContain("**soju**");
    expect(text).toContain("(tier `member`)");
    expect(text).not.toContain("purupuru:member"); // prefix stripped in the render
  });
});

describe("bd-atm — isolated actor resolution refuses an unlinked CM (fail-closed)", () => {
  test("an unresolved (404) discord ⇒ refusal, orchestration NEVER called", async () => {
    let invoked = false;
    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1" } as RoleSyncBootEnv,
      seams({ fetchImpl: identityFetch(404, { code: "not_found" }) }),
    )!;
    // wrap the invoker to detect any orchestration call
    const wrapped = {
      ...deps,
      invokeOrchestration: async (...args: Parameters<typeof deps.invokeOrchestration>) => {
        invoked = true;
        return deps.invokeOrchestration(...args);
      },
    };

    const res = await handleRoleSyncInteraction(interaction("live"), undefined, wrapped);
    expect(invoked).toBe(false); // refused BEFORE any read
    const data = res.data as { content?: string; components?: unknown };
    expect(data.content).toBeDefined();
    expect(data.content).toContain("verified identity");
    expect(data.components).toBeUndefined(); // a plain refusal, not CV2
  });

  test("isolation: the actor comes from identity-api, NOT the AuthContext (auth ignored)", async () => {
    // Pass a `verified` AuthContext with a DIFFERENT sub — the isolated resolver
    // must use the identity-api result, proving independence from AUTH_BACKEND.
    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1" } as RoleSyncBootEnv,
      seams({ fetchImpl: identityFetch(404, {}) }), // identity-api says unlinked
    )!;
    const res = await handleRoleSyncInteraction(
      interaction(),
      { kind: "verified", jwt: "x", claims: { sub: "some-other-jwt-sub" } as never },
      deps,
    );
    // Despite a verified AuthContext, the identity-api 404 wins → refused.
    expect((res.data as { content?: string }).content).toContain("verified identity");
  });
});

describe("bd-han (PART C) — LIVE apply for Purupuru is UNGATED (reaches the gate)", () => {
  test("a LIVE invocation NO LONGER fails-closed at requireLiveAudit — it reaches the gate", async () => {
    // PART C ungated Purupuru: LIVE now runs through the substrate gate + the LIVE
    // writer + the DURABLE-RECORDING interim audit emitter. With the null-client
    // seam (getBotClient → null) the LIVE roster READ fails — but that proves the
    // path reached the gate's live read, NOT the old "not yet wired"/"SHADOW only"
    // pre-write refusal. The audit gate is satisfied (recording-live), not closed.
    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1", SCORE_PURUPURU_API_KEY: "k" } as RoleSyncBootEnv,
      seams({
        fetchImpl: identityFetch(200, { user_id: ADMIN_UUID }),
      }),
    )!;
    const res = await handleRoleSyncInteraction(interaction("live"), undefined, deps);
    const data = res.data as { content?: string };
    expect(data.content).toContain("failed"); // (no live bot client in this seam)
    expect(data.content).toContain("LIVE");
    // the OLD fail-closed message is gone — LIVE is no longer pre-write-refused.
    expect(data.content).not.toContain("not yet wired");
    expect(data.content).not.toContain("run /role-sync with mode SHADOW");
    // the failure is the LIVE roster READ (gate reached), not an audit-deps refusal.
    expect(data.content).toContain("roster");
  });
});

/**
 * A discord.js-faithful guild fixture (real `Collection` for roles) that supports
 * BOTH the LIVE roster READ (roles.fetch() Collection chain + members.fetch())
 * AND the LIVE writer (roles.create / members.fetch(id).roles.add). Used to prove
 * a CM Confirm on Purupuru ACTUALLY grants roles through the gate (LIVE).
 */
function liveGuildFixture() {
  const created: Array<{ id: string; name: string }> = [];
  const assigned: Array<{ role_id: string; member_id: string }> = [];
  const heldByMember = new Set<string>(); // `${memberId}:${roleId}`
  let seq = 0;

  // the live role Collection — starts with @everyone only (no managed roles yet).
  const roleColl = new Collection<string, { id: string; name: string; members: { size: number } }>();
  roleColl.set(PURUPURU_GUILD, { id: PURUPURU_GUILD, name: "@everyone", members: { size: 1 } });

  const member = {
    id: INVOKER_DISCORD_ID,
    nickname: "soju",
    user: { globalName: "soju", username: "soju" },
    roles: { cache: new Map() },
  };
  const memberColl = new Collection<string, typeof member>();
  memberColl.set(member.id, member);

  const guild = {
    id: PURUPURU_GUILD,
    roles: {
      // no-arg → the full Collection (roster READ uses .filter/.map/.values);
      // the writer's no-arg fetch uses .find/.forEach (Collection has both).
      fetch: async (id?: string) => {
        if (id !== undefined) {
          return roleColl.get(id) ?? null;
        }
        return roleColl;
      },
      create: async ({ name }: { name: string; reason?: string }) => {
        const id = `live-${++seq}`;
        roleColl.set(id, { id, name, members: { size: 0 } });
        created.push({ id, name });
        return { id };
      },
    },
    members: {
      cache: memberColl,
      fetch: async (memberId?: string) => {
        if (memberId === undefined) return memberColl;
        return {
          roles: {
            cache: { has: (rid: string) => heldByMember.has(`${memberId}:${rid}`) },
            add: async (role: string | { id: string }) => {
              const rid = typeof role === "string" ? role : role.id;
              assigned.push({ role_id: rid, member_id: memberId });
              heldByMember.add(`${memberId}:${rid}`);
            },
          },
        };
      },
    },
  };

  const client = { guilds: { fetch: async () => guild } } as unknown as Client;
  return { client, created, assigned };
}

/** Route-aware fetch: identity reads + the score wallet-profile + the leaderboard. */
function liveFetchImpl(): typeof fetch {
  return (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/v1/resolve/account/discord/")) return json({ user_id: ADMIN_UUID });
    if (url.includes("/v1/profile")) return json({ identity: { primary_wallet: ADMIN_WALLET, wallets: [] } });
    if (url.includes("/v1/wallets/")) return json({ wallet: ADMIN_WALLET, tier: "member" });
    if (url.includes("leaderboard")) {
      return json({
        community: "purupuru",
        wallets: [
          { wallet: ADMIN_WALLET, rank: 1, combined_score: 100, tier: "member" },
        ],
      });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("bd-han (PART C) — a LIVE apply ACTUALLY grants roles through the gate", () => {
  test("LIVE on Purupuru: the create+assign batch writes through role-writer.live (with recording audit)", async () => {
    const fx = liveGuildFixture();
    const deps = buildRoleSyncBootDeps(
      { ROLE_SYNC_ENABLED: "1", SCORE_PURUPURU_API_KEY: "k" } as RoleSyncBootEnv,
      seams({
        getBotClient: async () => fx.client,
        // the wallet↔discord link the assign pass joins on (operator's wallet → discord id).
        walletDiscordLink: makeWalletDiscordLinkMock({ [ADMIN_WALLET.toLowerCase()]: INVOKER_DISCORD_ID }),
        fetchImpl: liveFetchImpl(),
        readRoleMap: () => null, // ⇒ default seed
      }),
    )!;

    const res = await handleRoleSyncInteraction(interaction("live"), undefined, deps);

    // LIVE → the structural LIVE receipt (CV2), EPHEMERAL, NOT a refusal/error.
    const data = res.data as { content?: string; components?: unknown; flags?: number };
    expect(data.content).toBeUndefined(); // a CV2 render, not a plain error string
    expect((data.flags ?? 0) & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    const text = JSON.stringify(data.components);
    expect(text).toContain("LIVE apply"); // the LIVE receipt verb
    expect(text).toContain("Gate job"); // the gate's terminal job state surfaced

    // THE PROOF: roles were ACTUALLY written through the single gated adapter.
    expect(fx.created.length).toBeGreaterThan(0); // at least the member tier role was created
    expect(fx.created.some((r) => r.name === "purupuru:member")).toBe(true);
    expect(fx.assigned.length).toBeGreaterThan(0); // the operator got assigned
    expect(fx.assigned.some((a) => a.member_id === INVOKER_DISCORD_ID)).toBe(true);
  });
});
