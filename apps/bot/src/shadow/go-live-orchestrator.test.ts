/**
 * go-live-orchestrator.test.ts — the go_live → build → applyBatch RUNTIME
 * entrypoint (bd-m2v SEAM 2). End-to-end through the REAL substrate gate with
 * the MOCK writer (zero real Discord I/O) + injected link + injected snapshot +
 * injected leaderboard. NEVER touches the network or discord.js.
 *
 * Proves:
 *   • LIVE path: resolveAuthz grant → goLive mints cap → CREATE pass (FR-4,
 *     not-yet-created managed roles) + ASSIGN pass → applyBatch writes through
 *     the gate (MOCK writer captures the intents).
 *   • CREATE ordering: create_role ops precede assign_role ops in the batch.
 *   • SHADOW path: NO goLive (no mint, no flip) — applyBatch under SHADOW rejects
 *     every op, ZERO inner writes; result reflects the preview.
 *   • the shadow-vs-live branch is the apply_mode Ref (the gate reads it).
 *   • authz DENY: a non-allowlisted actor fails the LIVE orchestration BEFORE any
 *     mint or write.
 *   • SEAM 1 join: an unlinked qualified wallet is skipped (skippedUnlinked), an
 *     untiered wallet is skipped (skippedUnqualified).
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Effect, Layer } from "effect";
import {
  makeGateCheckedRoleWriter,
  makeModeControl,
  RosterSource,
  roleMapVersionHash,
} from "./substrate.ts";
import type {
  RoleMapConfig,
  RoleMapVersionInput,
  Hex64,
  CurrentRoster,
} from "@freeside-worlds/shadow-substrate";
import type { CommunityLeaderboardEntry } from "@freeside-characters/persona-engine/score/community-client";
import { RoleWriterMock, resetMockRoleWriter, capturedWrites } from "./role-writer.mock.ts";
import { makeRecordingEmitter } from "./acvp-emitter.mock.ts";
import { makeInMemoryWorldLock } from "./world-lock.ts";
import { makeAdminAllowlistInMemory } from "./admin-allowlist.live.ts";
import { ScoreSourceMock } from "./score-source.mock.ts";
import { makeWalletDiscordLinkMock } from "./wallet-discord-link.live.ts";
import {
  runTierRoleGoLive,
  type GoLiveOrchestrationInput,
  type RosterIdentityReader,
} from "./go-live-orchestrator.ts";

// ── fixtures ────────────────────────────────────────────────────────────────

const WORLD = "purupuru";
const ADMIN = "identity:admin-1";
const h64 = (s: string) => s as unknown as Hex64;

function lbEntry(wallet: string, tier: string | null, rank = 1): CommunityLeaderboardEntry {
  return { wallet, rank, combined_score: 50, tier } as CommunityLeaderboardEntry;
}

const ROLE_MAP: RoleMapConfig = {
  enabled: true,
  namespace_prefix: "purupuru:",
  rules: [
    { role_key: "purupuru:member", display_name: "Member", qualifies: { source: "tier", min_tier: "member" }, create_if_absent: true },
    { role_key: "purupuru:core", display_name: "Core", qualifies: { source: "tier", min_tier: "core" }, create_if_absent: true },
  ],
} as RoleMapConfig;

// The current-map hash the gate's binding guard checks against. Must match the
// reportHash/currentMapHash the orchestration passes (an unchanged map).
const MAP_INPUT: RoleMapVersionInput = {
  role_rules: ROLE_MAP.rules,
  scaffolding_config: { channels: [] },
  world_config: {
    world_slug: WORLD,
    guild_id: "111122223333444455",
    namespace_prefix: "purupuru:",
    nft_contracts: ["0xabc"],
  },
};
const MAP_HASH = roleMapVersionHash(MAP_INPUT);

// A roster with NO managed roles yet → the create pass proposes both tier roles.
const EMPTY_MANAGED_ROSTER: CurrentRoster = {
  world: WORLD,
  roles: [
    // a pre-existing Collab.Land role (non-managed) — never created/assigned.
    { role_key: "Holder", members: 10, managed: false },
  ],
} as CurrentRoster;

function rosterSourceFixed(roster: CurrentRoster): Layer.Layer<RosterSource> {
  return Layer.succeed(
    RosterSource,
    RosterSource.of({ currentRoster: () => Effect.succeed(roster) }),
  );
}

const SNAPSHOT_READER: RosterIdentityReader = async () => ({
  member_ids: ["member-1", "member-2"],
  role_ids: ["role-a"],
});

function fullStack(
  mode: Awaited<ReturnType<typeof runMode>>,
  emitterLayer: ReturnType<typeof makeRecordingEmitter>["layer"],
  allow: readonly string[],
  roster: CurrentRoster,
) {
  const allowlist = makeAdminAllowlistInMemory(new Map([[WORLD, allow]]));
  const lock = makeInMemoryWorldLock();
  const gate = makeGateCheckedRoleWriter(mode, () => MAP_HASH).pipe(
    Layer.provide(Layer.mergeAll(RoleWriterMock, emitterLayer, lock)),
  );
  return Layer.mergeAll(
    gate,
    RoleWriterMock,
    emitterLayer,
    lock,
    allowlist,
    rosterSourceFixed(roster),
    ScoreSourceMock,
  );
}

// helper to construct a ModeControl outside Effect.gen for typing fullStack
async function runMode(initial: "SHADOW" | "LIVE") {
  return Effect.runPromise(makeModeControl(initial));
}

function baseInput(overrides: Partial<GoLiveOrchestrationInput> = {}): GoLiveOrchestrationInput {
  return {
    world: WORLD,
    applyMode: "LIVE",
    actor: ADMIN,
    reportHash: h64(MAP_HASH),
    currentMapHash: h64(MAP_HASH),
    transitionVersion: 7,
    evaluatedAt: "2026-06-04T00:00:00Z",
    roleMap: ROLE_MAP,
    tokenMetadata: { kid: "kid-1", verified_at: "2026-06-04T00:00:00Z", exp: "2026-06-04T01:00:00Z" },
    leaderboardReader: async () => [lbEntry("0xcore", "core"), lbEntry("0xmember", "member")],
    ...overrides,
  };
}

beforeEach(() => resetMockRoleWriter());

// ── LIVE path ──────────────────────────────────────────────────────────────

describe("runTierRoleGoLive — LIVE path (create pass + assign pass through the gate)", () => {
  test("goLive → CREATE pass + ASSIGN pass → applyBatch writes through the gate", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();
    const mode = await runMode("SHADOW");

    const res = await Effect.runPromise(
      runTierRoleGoLive(
        {
          mode,
          link: makeWalletDiscordLinkMock({ "0xcore": "member-1", "0xmember": "member-2" }),
          rosterIdentity: SNAPSHOT_READER,
        },
        baseInput(),
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            fullStack(mode, emitterLayer, [ADMIN], EMPTY_MANAGED_ROSTER),
          ),
        ),
      ),
    );

    expect(res.applyMode).toBe("LIVE");
    expect(res.job.status).toBe("done");

    // CREATE pass (FR-4): both managed tier roles are not-yet-created → 2 creates.
    expect(res.createCount).toBe(2);
    // ASSIGN pass: 0xcore→core, 0xmember→member → 2 assigns.
    expect(res.assignCount).toBe(2);

    // ordering: all create_role ops precede all assign_role ops.
    const kinds = res.batch.ops.map((o) => o.kind);
    const firstAssign = kinds.indexOf("assign_role");
    const lastCreate = kinds.lastIndexOf("create_role");
    expect(lastCreate).toBeLessThan(firstAssign);

    // MOCK writer captured both passes (zero REAL discord writes).
    const creates = capturedWrites().filter((w) => w.kind === "create_role");
    const assigns = capturedWrites().filter((w) => w.kind === "assign_role");
    expect(creates.map((c) => c.role_key).sort()).toEqual(["purupuru:core", "purupuru:member"]);
    expect(assigns.map((a) => a.member_id).sort()).toEqual(["member-1", "member-2"]);

    // audit trail: applied per op, zero rejections.
    expect(recorder.countOf("shadow.role.applied.v1")).toBe(4); // 2 create + 2 assign
    expect(recorder.countOf("shadow.role.rejected.v1")).toBe(0);
    // The Ref started SHADOW; applyMode:"LIVE" drove goLive to perform the real
    // SHADOW→LIVE flip + mint, emitting EXACTLY ONE `mode.transitioned` (the
    // substrate's go_live transition audit). The gate then read LIVE at apply.
    expect(recorder.countOf("shadow.mode.transitioned.v1")).toBe(1);
  });

  test("create pass is SKIPPED for already-existing managed roles", async () => {
    const { layer: emitterLayer } = makeRecordingEmitter();
    const mode = await runMode("SHADOW");
    const rosterWithCore: CurrentRoster = {
      world: WORLD,
      roles: [{ role_key: "purupuru:core", members: 1, managed: true }],
    } as CurrentRoster;

    const res = await Effect.runPromise(
      runTierRoleGoLive(
        {
          mode,
          link: makeWalletDiscordLinkMock({ "0xcore": "member-1" }),
          rosterIdentity: SNAPSHOT_READER,
        },
        baseInput({ leaderboardReader: async () => [lbEntry("0xcore", "core")] }),
      ).pipe(Effect.provide(fullStack(mode, emitterLayer, [ADMIN], rosterWithCore))),
    );

    // only purupuru:member needs creating (purupuru:core exists).
    expect(res.createCount).toBe(1);
    expect(res.batch.ops.filter((o) => o.kind === "create_role").map((o) => o.intent.role_key)).toEqual([
      "purupuru:member",
    ]);
    expect(res.assignCount).toBe(1);
  });

  test("authz DENY fails the LIVE orchestration BEFORE any mint/write", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();
    const mode = await runMode("SHADOW");

    const exit = await Effect.runPromiseExit(
      runTierRoleGoLive(
        {
          mode,
          link: makeWalletDiscordLinkMock({ "0xcore": "member-1" }),
          rosterIdentity: SNAPSHOT_READER,
        },
        baseInput({ actor: "identity:not-admin" }),
      ).pipe(
        // allowlist contains ONLY ADMIN, not the actor.
        Effect.provide(fullStack(mode, emitterLayer, [ADMIN], EMPTY_MANAGED_ROSTER)),
      ),
    );

    expect(exit._tag).toBe("Failure");
    // no writes, no go_live transition.
    expect(capturedWrites().length).toBe(0);
    expect(recorder.countOf("shadow.mode.transitioned.v1")).toBe(0);
  });

  test("SEAM 1 join: unlinked wallet skipped (skippedUnlinked); untiered skipped (skippedUnqualified)", async () => {
    const { layer: emitterLayer } = makeRecordingEmitter();
    const mode = await runMode("SHADOW");

    const res = await Effect.runPromise(
      runTierRoleGoLive(
        {
          mode,
          // 0xcore linked, 0xunlinked NOT linked.
          link: makeWalletDiscordLinkMock({ "0xcore": "member-1" }),
          rosterIdentity: SNAPSHOT_READER,
        },
        baseInput({
          leaderboardReader: async () => [
            lbEntry("0xcore", "core"), // qualifies + linked → assigned
            lbEntry("0xunlinked", "core"), // qualifies but NOT linked → skipped_unlinked
            lbEntry("0xlow", "newcomer"), // below every rule → skipped_unqualified
          ],
        }),
      ).pipe(Effect.provide(fullStack(mode, emitterLayer, [ADMIN], EMPTY_MANAGED_ROSTER))),
    );

    expect(res.assignCount).toBe(1);
    expect(res.skippedUnlinked).toBe(1);
    expect(res.skippedUnqualified).toBe(1);
    expect(capturedWrites().filter((w) => w.kind === "assign_role").map((w) => w.member_id)).toEqual([
      "member-1",
    ]);
  });
});

// ── SHADOW path ──────────────────────────────────────────────────────────────

describe("runTierRoleGoLive — SHADOW path (preview, zero writes)", () => {
  test("SHADOW: NO goLive, gate rejects every op, ZERO inner writes", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();
    const mode = await runMode("SHADOW");

    const res = await Effect.runPromise(
      runTierRoleGoLive(
        {
          mode,
          link: makeWalletDiscordLinkMock({ "0xcore": "member-1", "0xmember": "member-2" }),
          rosterIdentity: SNAPSHOT_READER,
        },
        baseInput({ applyMode: "SHADOW" }),
      ).pipe(Effect.provide(fullStack(mode, emitterLayer, [ADMIN], EMPTY_MANAGED_ROSTER))),
    );

    expect(res.applyMode).toBe("SHADOW");
    // the would-be batch is still built (the preview shape): 2 creates + 2 assigns.
    expect(res.createCount).toBe(2);
    expect(res.assignCount).toBe(2);
    expect(res.job.status).toBe("failed"); // every op rejected = preview, no writes

    // ZERO real writes; per-op rejections confirmed; NO mode transition (no goLive).
    expect(capturedWrites().length).toBe(0);
    expect(recorder.countOf("shadow.role.rejected.v1")).toBe(4); // 2 create + 2 assign rejected
    expect(recorder.countOf("shadow.role.applied.v1")).toBe(0);
    expect(recorder.countOf("shadow.mode.transitioned.v1")).toBe(0);
  });
});
