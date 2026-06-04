/**
 * role-sync-interaction.test.ts — the Discord-interaction ADAPTER for the
 * voiceless tier→role sync trigger (bd-71y). NETWORK-FREE: the orchestration +
 * role-map reader are injected; the AuthContext is a fixture.
 *
 * Proves:
 *   • actorResolverFromAuth yields the actor (claims.sub) ONLY for a `verified`
 *     context; anon / anon-fallback / missing ⇒ null (the core refuses).
 *   • a verified CM's SHADOW invocation renders the CV2 payload as an EPHEMERAL
 *     response (IS_COMPONENTS_V2 | EPHEMERAL flags, no content/embeds).
 *   • an anon CM is refused with a plain ephemeral status (no CV2, no write).
 *   • the LIVE option flows through (explicit choice).
 */
import { describe, expect, test } from "bun:test";
import {
  handleRoleSyncInteraction,
  actorResolverFromAuth,
  roleSyncOutcomeToResponse,
  type RoleSyncInteractionDeps,
} from "./role-sync-interaction.ts";
import { InteractionResponseType, MessageFlags } from "../discord-interactions/types.ts";
import type { DiscordInteraction } from "../discord-interactions/types.ts";
import type { AuthContext, JWTClaim } from "../auth-bridge.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type {
  GoLiveOrchestrationInput,
  GoLiveOrchestrationResult,
} from "./go-live-orchestrator.ts";
import type { WriteIntentBatch } from "@freeside-worlds/shadow-substrate";

const WORLD = "purupuru";

function verifiedAuth(sub: string): AuthContext {
  return {
    kind: "verified",
    jwt: "jwt.token.value",
    claims: { sub } as unknown as JWTClaim,
  };
}

function fakeResult(applyMode: "SHADOW" | "LIVE"): GoLiveOrchestrationResult {
  const batch = { ops: [{ op_id: "c0", kind: "create_role", intent: { role_key: "purupuru:member" } }] } as unknown as WriteIntentBatch;
  return {
    applyMode,
    batch,
    job: { status: "failed", progress: { total: 1, completed: 0, failed: 1 }, roles_created: [], op_status: [{ op_id: "c0", status: "failed" }] },
    createCount: 1,
    assignCount: 0,
    skippedUnlinked: 0,
    skippedUnqualified: 0,
    skippedInvalid: 0,
    collapsedDuplicateMembers: 0,
  } as GoLiveOrchestrationResult;
}

function interactionDeps(
  capture?: (input: GoLiveOrchestrationInput) => void,
): RoleSyncInteractionDeps {
  return {
    world: WORLD,
    readRoleMap: () => null, // ⇒ default seed
    invokeOrchestration: async (input) => {
      capture?.(input);
      return fakeResult(input.applyMode);
    },
    worldConfig: { guild_id: "111122223333444455", nft_contracts: ["0xabc"] },
    now: () => "2026-06-04T00:00:00Z",
    tokenMetadata: { kid: "k", verified_at: "2026-06-04T00:00:00Z", exp: "2026-06-04T01:00:00Z" },
    transitionVersion: 7,
  };
}

function interaction(modeValue?: string): DiscordInteraction {
  return {
    type: 2,
    id: "999000111222333444",
    application_id: "app",
    token: "tok",
    guild_id: "111122223333444455",
    data: {
      id: "cmd",
      name: "role-sync",
      options: modeValue !== undefined ? [{ name: "mode", type: 3, value: modeValue }] : [],
    },
  } as unknown as DiscordInteraction;
}

describe("bd-71y — actorResolverFromAuth: actor only from a verified context", () => {
  test("verified ⇒ actor = claims.sub", async () => {
    const r = await actorResolverFromAuth(verifiedAuth("identity:cm-1"))();
    expect(r).toEqual({ actor: "identity:cm-1" });
  });
  test("anon ⇒ null", async () => {
    const r = await actorResolverFromAuth({ kind: "anon", discord_id: "5" })();
    expect(r).toBeNull();
  });
  test("anon-fallback ⇒ null", async () => {
    const r = await actorResolverFromAuth({ kind: "anon-fallback", discord_id: "5", reason: "no-tenant" })();
    expect(r).toBeNull();
  });
  test("undefined auth ⇒ null", async () => {
    const r = await actorResolverFromAuth(undefined)();
    expect(r).toBeNull();
  });
  test("verified but empty sub ⇒ null", async () => {
    const r = await actorResolverFromAuth(verifiedAuth(""))();
    expect(r).toBeNull();
  });
});

describe("bd-71y — handleRoleSyncInteraction: verified CM SHADOW → ephemeral CV2", () => {
  test("a verified CM (default mode) gets an EPHEMERAL CV2 response", async () => {
    let seenMode: string | undefined;
    const res = await handleRoleSyncInteraction(
      interaction(), // no mode ⇒ SHADOW
      verifiedAuth("identity:cm-1"),
      interactionDeps((i) => (seenMode = i.applyMode)),
    );
    expect(seenMode).toBe("SHADOW");
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    // flags = IS_COMPONENTS_V2 | EPHEMERAL; no content/embeds on a CV2 message.
    const flags = (res.data as { flags?: number }).flags ?? 0;
    expect(flags & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    expect(flags & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
    expect((res.data as { content?: string }).content).toBeUndefined();
    expect(Array.isArray((res.data as { components?: unknown[] }).components)).toBe(true);
  });

  test("LIVE option flows through (explicit choice)", async () => {
    let seenMode: string | undefined;
    await handleRoleSyncInteraction(
      interaction("live"),
      verifiedAuth("identity:cm-1"),
      interactionDeps((i) => (seenMode = i.applyMode)),
    );
    expect(seenMode).toBe("LIVE");
  });
});

describe("bd-71y — handleRoleSyncInteraction: anon CM refused (no CV2, no invoke)", () => {
  test("an anon invoker gets a plain ephemeral refusal; orchestration never called", async () => {
    let invoked = false;
    const deps = interactionDeps(() => (invoked = true));
    const res = await handleRoleSyncInteraction(
      interaction("live"), // even explicit LIVE
      { kind: "anon", discord_id: "5" },
      deps,
    );
    expect(invoked).toBe(false);
    expect(res.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    const data = res.data as { content?: string; flags?: number; components?: unknown };
    expect(data.content).toBeDefined();
    expect(data.content).toContain("verified identity");
    expect((data.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
    // a refusal is a plain string, NOT a CV2 component message.
    expect(data.components).toBeUndefined();
  });
});

describe("bd-71y — roleSyncOutcomeToResponse mapping", () => {
  test("error outcome ⇒ plain ephemeral content (voiceless)", () => {
    const res = roleSyncOutcomeToResponse({ kind: "error", message: "Tier→role sync (LIVE) failed: boom" });
    const data = res.data as { content?: string; flags?: number };
    expect(data.content).toContain("failed");
    expect((data.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
  });
});
