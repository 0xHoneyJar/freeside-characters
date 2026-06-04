/**
 * role-sync-dispatch.test.ts — the two-step Apply→Confirm→LIVE component bridge
 * (bd-20x). NETWORK-FREE: actor resolution, role-map read, member-centric roster
 * reads, and the orchestration invoker are all INJECTED; the confirm PATCH
 * @original uses an injected fetch.
 *
 * Proves the state machine:
 *   • prefix ownership: `rolesync:` clicks are detected; a foreign squat is rejected.
 *   • apply click = NON-MUTATING → UPDATE_MESSAGE (type 7) with the CONFIRM card
 *     (the orchestration / gate is NEVER called).
 *   • cancel click → UPDATE_MESSAGE back to the dashboard (no write).
 *   • confirm click (fresh hash) → DEFERRED_UPDATE_MESSAGE (type 6) + a background
 *     LIVE run through the orchestration (the gate) + PATCH @original receipt.
 *   • confirm click (STALE hash) → re-preview, the orchestration NEVER called.
 *   • not-verified clicker → refused, no read.
 *   • the CONFIRM custom_id is the only mutating one (apply/cancel never invoke).
 */
import { describe, expect, test } from "bun:test";
import {
  isRoleSyncComponentInteraction,
  isForeignRoleSyncSquat,
  parseRoleSyncCustomId,
  computeRoleSyncComponentOutcome,
  handleRoleSyncComponentInteraction,
} from "./role-sync-dispatch.ts";
import type { RoleSyncInteractionDeps } from "./role-sync-interaction.ts";
import type { MemberCentricShadowDeps } from "./role-sync-trigger.ts";
import { computeMapHash } from "./role-sync-trigger.ts";
import { buildPurupuruSeedRoleMap } from "./role-sync-seed-map.ts";
import type {
  GoLiveOrchestrationInput,
  GoLiveOrchestrationResult,
} from "./go-live-orchestrator.ts";
import type { WriteIntentBatch } from "@freeside-worlds/shadow-substrate";
import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
} from "../discord-interactions/types.ts";

const WORLD = "purupuru";
const ACTOR = "identity:cm-1";
const CLICKER = "700000000000000001";
const WALLET_A = "0xaaa0000000000000000000000000000000000001";

const WORLD_CONFIG = {
  guild_id: "111122223333444455",
  nft_contracts: ["0xabc"],
} as const;

/** The FRESH map hash (seed map) for the configured world — used for content-addressing. */
function freshMapHash12(): string {
  const h = computeMapHash(buildPurupuruSeedRoleMap(), WORLD, WORLD_CONFIG) as unknown as string;
  return h.slice(0, 12);
}

/** member-centric deps: one ADD member (soju) + one unlinked. */
function memberCentricDeps(): MemberCentricShadowDeps {
  return {
    members: async () => [
      { discord_id: CLICKER, display_name: "soju", current_managed_roles: [] },
      { discord_id: "700000000000000002", display_name: "nolink", current_managed_roles: [] },
    ],
    resolveIdentity: async (id) =>
      id === CLICKER
        ? { kind: "linked", user_id: "u-a", wallet: WALLET_A }
        : { kind: "unlinked" },
    readTier: async (wallet) => (wallet.toLowerCase() === WALLET_A ? "member" : null),
  };
}

function fakeBatch(): WriteIntentBatch {
  return {
    ops: [
      { op_id: "c0", kind: "create_role" as const, intent: { role_key: "purupuru:member" } },
      { op_id: "a0", kind: "assign_role" as const, intent: { role_key: "purupuru:member", member_id: CLICKER } },
    ],
  } as unknown as WriteIntentBatch;
}

function fakeLiveResult(): GoLiveOrchestrationResult {
  const batch = fakeBatch();
  return {
    applyMode: "LIVE",
    batch,
    job: {
      status: "done",
      progress: { total: 2, completed: 2, failed: 0 },
      roles_created: [],
      op_status: batch.ops.map((o) => ({ op_id: o.op_id, status: "ok" as const })),
    },
    createCount: 1,
    assignCount: 1,
    skippedUnlinked: 1,
    skippedUnqualified: 0,
    skippedInvalid: 0,
    collapsedDuplicateMembers: 0,
  } as GoLiveOrchestrationResult;
}

/** Build interaction deps with injected ports + a capturing orchestration invoker. */
function makeDeps(opts: {
  actor?: string | null;
  invoke?: (input: GoLiveOrchestrationInput) => Promise<GoLiveOrchestrationResult>;
} = {}): { deps: RoleSyncInteractionDeps; calls: { invoked: boolean; mode?: string } } {
  const calls = { invoked: false, mode: undefined as string | undefined };
  const deps: RoleSyncInteractionDeps = {
    world: WORLD,
    // isolated actor factory (the clicker's id → an actor); null ⇒ refuse.
    actorResolverFor: () => () => (opts.actor === null ? null : { actor: opts.actor ?? ACTOR }),
    readRoleMap: () => null, // ⇒ seed
    invokeOrchestration: async (input) => {
      calls.invoked = true;
      calls.mode = input.applyMode;
      return (opts.invoke ?? (async () => fakeLiveResult()))(input);
    },
    worldConfig: WORLD_CONFIG,
    now: () => "2026-06-04T00:00:00Z",
    tokenMetadata: { kid: "k", verified_at: "2026-06-04T00:00:00Z", exp: "2026-06-04T01:00:00Z" },
    transitionVersion: 7,
    memberCentric: memberCentricDeps(),
  };
  return { deps, calls };
}

/** A `rolesync:` component (type 3) click with the given custom_id. */
function click(customId: string): DiscordInteraction {
  return {
    type: 3,
    id: "999000111222333444",
    application_id: "app",
    token: "tok",
    guild_id: WORLD_CONFIG.guild_id,
    member: { user: { id: CLICKER, username: "soju" } },
    data: { id: "cmp", name: "", custom_id: customId },
  } as unknown as DiscordInteraction;
}

describe("bd-20x — prefix ownership", () => {
  test("a `rolesync:` click is detected", () => {
    expect(isRoleSyncComponentInteraction(click("rolesync:apply:purupuru:abc"))).toBe(true);
  });
  test("a non-rolesync click is not detected", () => {
    expect(isRoleSyncComponentInteraction(click("onboard:verify"))).toBe(false);
  });
  test("a foreign squat of the `rolesync:` prefix is rejected", () => {
    expect(isForeignRoleSyncSquat(click("rolesync:evil:purupuru:abc"))).toBe(true);
    expect(isForeignRoleSyncSquat(click("rolesync:apply:purupuru:abc"))).toBe(false);
  });
  test("custom_id parse: action / world / hash", () => {
    expect(parseRoleSyncCustomId("rolesync:apply:purupuru:abc123")).toEqual({
      action: "apply",
      world: "purupuru",
      mapHash12: "abc123",
    });
    expect(parseRoleSyncCustomId("rolesync:bogus:purupuru:abc")).toBeNull();
    expect(parseRoleSyncCustomId("onboard:verify")).toBeNull();
  });
});

describe("bd-20x — apply click is NON-MUTATING → CONFIRM card", () => {
  test("apply → UPDATE_MESSAGE (type 7) confirm card; orchestration NEVER called", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleRoleSyncComponentInteraction(
      click(`rolesync:apply:${WORLD}:${freshMapHash12()}`),
      undefined,
      deps,
    );
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(calls.invoked).toBe(false); // NO write on apply
    const data = res.data as { flags?: number; components?: unknown };
    expect((data.flags ?? 0) & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
    const text = JSON.stringify(data.components);
    // the confirm card: ADD-only count + the confirm custom_id + the scope invariant.
    expect(text).toContain("Confirm — grant 1 role");
    expect(text).toContain("does not touch Keep / Unlinked / Untiered");
    expect(text).toContain(`rolesync:confirm:${WORLD}:`);
  });
});

describe("bd-20x — cancel click → dashboard (no write)", () => {
  test("cancel → UPDATE_MESSAGE back to the dashboard; orchestration NEVER called", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleRoleSyncComponentInteraction(
      click(`rolesync:cancel:${WORLD}:${freshMapHash12()}`),
      undefined,
      deps,
    );
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(calls.invoked).toBe(false);
    const text = JSON.stringify((res.data as { components?: unknown }).components);
    expect(text).toContain("# Member roles");
    expect(text).toContain("rolesync:apply:"); // the dashboard's Apply button is back
  });
});

describe("bd-20x — confirm click is the ONLY mutating path (through the gate)", () => {
  test("confirm (fresh hash) → DEFERRED_UPDATE_MESSAGE + a LIVE orchestration run + receipt PATCH", async () => {
    const { deps, calls } = makeDeps();
    let patched: Record<string, unknown> | null = null;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      patched = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const res = await handleRoleSyncComponentInteraction(
      click(`rolesync:confirm:${WORLD}:${freshMapHash12()}`),
      undefined,
      deps,
      fakeFetch,
    );
    // the immediate response is a DEFERRED update (the LIVE work runs in the background).
    expect(res.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);

    // let the background runConfirmLive settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.invoked).toBe(true); // the LIVE write went through the orchestration
    expect(calls.mode).toBe("LIVE"); // and it was LIVE
    expect(patched).not.toBeNull();
    // the receipt is the LIVE structural CV2 payload, EPHEMERAL.
    const p = patched as unknown as { flags: number; components: unknown };
    expect(p.flags & MessageFlags.EPHEMERAL).toBe(MessageFlags.EPHEMERAL);
    expect(JSON.stringify(p.components)).toContain("LIVE apply");
  });

  test("confirm (STALE hash) → re-preview; the orchestration is NEVER called", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleRoleSyncComponentInteraction(
      click(`rolesync:confirm:${WORLD}:deadbeefstale`), // a hash that won't match the fresh one
      undefined,
      deps,
    );
    // a stale confirm re-renders the dashboard (UPDATE_MESSAGE), never applies.
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.invoked).toBe(false); // NEVER applied a stale map
    const text = JSON.stringify((res.data as { components?: unknown }).components);
    expect(text).toContain("# Member roles"); // back to the dashboard
  });
});

describe("bd-20x — not-verified clicker is refused before any read", () => {
  test("a null-actor clicker → refused status; orchestration NEVER called", async () => {
    let membersRead = false;
    const { deps, calls } = makeDeps({ actor: null });
    const mc = deps.memberCentric!;
    const guarded: RoleSyncInteractionDeps = {
      ...deps,
      memberCentric: { ...mc, members: async (w) => ((membersRead = true), mc.members(w)) },
    };
    const res = await handleRoleSyncComponentInteraction(
      click(`rolesync:confirm:${WORLD}:${freshMapHash12()}`),
      undefined,
      guarded,
    );
    expect(res.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(membersRead).toBe(false); // refused before any roster read
    expect(calls.invoked).toBe(false);
    expect((res.data as { content?: string }).content).toContain("verified identity");
  });
});
