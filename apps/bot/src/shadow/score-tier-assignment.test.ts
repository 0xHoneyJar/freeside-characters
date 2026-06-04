/**
 * score-tier-assignment.test.ts — the per-member tier→role assign-batch builder
 * (bd-tfl part 2).
 *
 * Two layers of proof:
 *   1. PURE join + assembly: leaderboard ⋈ identity-link ⋈ role-map → assignments
 *      → WriteOp[] → WriteIntentBatch (no network, injected WalletDiscordLink).
 *      Covers: strongest-rule selection, unlinked/unqualified skips, disabled
 *      map, deterministic op_id/idempotency_key.
 *   2. END-TO-END through the REAL substrate gate (mirrors shadow-loop.test):
 *      goLive mints a cap → assembleAssignBatch builds the batch bound to the
 *      go_live decision → gate.applyBatch writes the assign ops through the MOCK
 *      writer (zero real Discord I/O). This proves the builder's output is a
 *      VALID, gate-acceptable batch (the hash-binding invariants hold).
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Effect, Layer } from "effect";
import {
  GateCheckedRoleWriter,
  makeGateCheckedRoleWriter,
  makeModeControl,
  goLive,
  AcvpEmitter,
  roleMapVersionHash,
} from "./substrate.ts";
import { rosterFingerprint } from "@freeside-worlds/shadow-substrate";
import type {
  RoleMapConfig,
  RoleMapVersionInput,
  WorldSlug,
  Hex64,
  ModeControl,
  RosterVersion,
} from "@freeside-worlds/shadow-substrate";
import type { CommunityLeaderboardEntry } from "@freeside-characters/persona-engine/score/community-client";
import { RoleWriterMock, resetMockRoleWriter, capturedWrites } from "./role-writer.mock.ts";
import { makeRecordingEmitter } from "./acvp-emitter.mock.ts";
import { makeInMemoryWorldLock } from "./world-lock.ts";
import { makeAdminAllowlistInMemory } from "./admin-allowlist.live.ts";
import {
  buildTierAssignments,
  assignmentsToOps,
  assignOpId,
  assignIdempotencyKey,
  assembleAssignBatch,
  type WalletDiscordLink,
  type AuthorizedTransition,
} from "./score-tier-assignment.ts";

// ── fixtures ────────────────────────────────────────────────────────────────

function lbEntry(wallet: string, tier: string | null, rank = 1): CommunityLeaderboardEntry {
  return { wallet, rank, combined_score: 50, tier } as CommunityLeaderboardEntry;
}

/** A role-map with a low + high tier rule (both Freeside-namespaced). */
const ROLE_MAP: RoleMapConfig = {
  enabled: true,
  namespace_prefix: "purupuru:",
  rules: [
    { role_key: "purupuru:member", display_name: "Member", qualifies: { source: "tier", min_tier: "member" }, create_if_absent: true },
    { role_key: "purupuru:core", display_name: "Core", qualifies: { source: "tier", min_tier: "core" }, create_if_absent: true },
  ],
} as RoleMapConfig;

/** Injected link map (wallet → discord snowflake | null). */
function linkFrom(map: Record<string, string | null>): WalletDiscordLink {
  return {
    resolve: async (wallet: string) => map[wallet.toLowerCase()] ?? null,
  };
}

// ── 1. pure join ──────────────────────────────────────────────────────────────

describe("buildTierAssignments — the join", () => {
  test("assigns each linked wallet its STRONGEST qualifying tier role", async () => {
    const res = await buildTierAssignments({
      leaderboard: [
        lbEntry("0xcore", "core"),       // qualifies member AND core → core (strongest)
        lbEntry("0xmember", "member"),   // qualifies member only
        lbEntry("0xelder", "elder"),     // qualifies both → core (strongest configured)
      ],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xcore": "100", "0xmember": "200", "0xelder": "300" }),
    });
    expect(res.assignments.length).toBe(3);
    const byMember = Object.fromEntries(res.assignments.map((a) => [a.member_id, a.role_key]));
    expect(byMember["100"]).toBe("purupuru:core");
    expect(byMember["200"]).toBe("purupuru:member");
    expect(byMember["300"]).toBe("purupuru:core"); // elder > core, top configured rule
  });

  test("a qualified-but-unlinked wallet is skipped (counted), never assigned", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xa", "core"), lbEntry("0xb", "core")],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xa": "100" /* 0xb has no link */ }),
    });
    expect(res.assignments.length).toBe(1);
    expect(res.assignments[0]!.member_id).toBe("100");
    expect(res.skipped_unlinked).toBe(1);
  });

  test("a wallet below every rule (or untiered) is skipped as unqualified", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xlow", "newcomer"), lbEntry("0xnull", null)],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xlow": "100", "0xnull": "200" }),
    });
    expect(res.assignments.length).toBe(0);
    expect(res.skipped_unqualified).toBe(2);
  });

  test("a disabled role-map produces zero assignments", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xa", "core")],
      roleMap: { ...ROLE_MAP, enabled: false },
      link: linkFrom({ "0xa": "100" }),
    });
    expect(res.assignments.length).toBe(0);
  });
});

// ── 2. ops + determinism ──────────────────────────────────────────────────────

describe("assignmentsToOps — op_id / idempotency_key", () => {
  test("emits assign_role ops only (never create/remove)", () => {
    const ops = assignmentsToOps("purupuru", "h".repeat(64), [
      { wallet: "0xa", member_id: "100", tier: "core", role_key: "purupuru:core" },
    ]);
    expect(ops.length).toBe(1);
    expect(ops[0]!.kind).toBe("assign_role");
    expect((ops[0]!.intent as { role_key: string }).role_key).toBe("purupuru:core");
    expect((ops[0]!.intent as { member_id: string }).member_id).toBe("100");
  });

  test("op_id + idempotency_key are deterministic (retry-safe)", () => {
    const id1 = assignOpId("purupuru", "purupuru:core", "100");
    const id2 = assignOpId("purupuru", "purupuru:core", "100");
    expect(id1).toBe(id2);
    const k1 = assignIdempotencyKey("purupuru", id1, "h".repeat(64));
    const k2 = assignIdempotencyKey("purupuru", id2, "h".repeat(64));
    expect(k1).toBe(k2);
    // a different member → different key
    const k3 = assignIdempotencyKey("purupuru", assignOpId("purupuru", "purupuru:core", "999"), "h".repeat(64));
    expect(k3).not.toBe(k1);
    // 64-hex (sha256)
    expect(k1).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── 3. END-TO-END through the real gate (mirrors shadow-loop.test) ────────────

const WORLD = "purupuru" as unknown as WorldSlug;
const ADMIN = "identity:admin-1";
const h64 = (s: string) => s as unknown as Hex64;

const MAP_INPUT: RoleMapVersionInput = {
  role_rules: [
    { role_key: "purupuru:core", display_name: "Core", qualifies: { source: "tier", min_tier: "core" }, create_if_absent: true },
  ],
  scaffolding_config: { channels: [] },
  world_config: { world_slug: "purupuru", guild_id: "111122223333444455", namespace_prefix: "purupuru:", nft_contracts: ["0xabc"] },
};
const MAP_HASH = roleMapVersionHash(MAP_INPUT);

const EMPTY_SNAPSHOT = { member_ids: [] as string[], role_ids: [] as string[] };
const NO_DRIFT = {
  baseFingerprint: rosterFingerprint(EMPTY_SNAPSHOT),
  baseSnapshot: EMPTY_SNAPSHOT,
  freshSnapshot: EMPTY_SNAPSHOT,
};

const ROSTER_VERSION: RosterVersion = {
  fingerprint: h64("a".repeat(64)),
  fetched_at: "2026-06-02T00:00:00Z",
  member_count: 0,
};

function fullStack(mode: ModeControl, emitterLayer: Layer.Layer<AcvpEmitter>, allow: readonly string[]) {
  const allowlist = makeAdminAllowlistInMemory(new Map([[WORLD as unknown as string, allow]]));
  const lock = makeInMemoryWorldLock();
  const gate = makeGateCheckedRoleWriter(mode, () => MAP_HASH).pipe(
    Layer.provide(Layer.mergeAll(RoleWriterMock, emitterLayer, lock)),
  );
  return Layer.mergeAll(gate, RoleWriterMock, emitterLayer, lock, allowlist);
}

beforeEach(() => resetMockRoleWriter());

describe("score-tier-assignment — END-TO-END through the real gate", () => {
  test("assembled assign-batch writes through the gate (LIVE, MOCK writer)", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();

    // The PRE-CREATED tier role the gate's writer adopts on assign (a real flow
    // would create it via the FR-4 create pass first; the MOCK writer's assign
    // path resolves by name, so seed it through a create captured-write would be
    // needed — instead we rely on the MOCK writer's create-then-assign path by
    // including the create op is NOT this builder's job; here we prove the ASSIGN
    // op the builder emits is gate-VALID and flows). The MOCK writer captures the
    // assign intent regardless of pre-existing roleset.
    const assignmentsRes = await buildTierAssignments({
      leaderboard: [lbEntry("0xcore", "core"), lbEntry("0xelder", "elder")],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xcore": "member-1", "0xelder": "member-2" }),
    });
    expect(assignmentsRes.assignments.length).toBe(2);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mode = yield* makeModeControl("SHADOW");
        const out = yield* goLive(mode, {
          actor: ADMIN, world: WORLD, reportHash: h64(MAP_HASH), currentMapHash: h64(MAP_HASH),
          transitionVersion: 5, evaluatedAt: "2026-06-02T00:00:00Z", rosterFreshness: NO_DRIFT,
        }).pipe(Effect.provide(Layer.mergeAll(
          makeAdminAllowlistInMemory(new Map([[WORLD as unknown as string, [ADMIN]]])),
          emitterLayer,
        )));

        const transition: AuthorizedTransition = {
          actor: ADMIN,
          reportHash: MAP_HASH,
          authzDecisionId: out.authzDecisionId,
          transitionVersion: 5,
          tokenMetadata: { kid: "kid-1", verified_at: "2026-06-02T00:00:00Z", exp: "2026-06-02T01:00:00Z" },
        };
        const batch = assembleAssignBatch({
          world: "purupuru",
          transition,
          rosterVersion: ROSTER_VERSION,
          assignments: assignmentsRes.assignments,
        });

        return yield* GateCheckedRoleWriter.pipe(
          Effect.flatMap((g) => g.applyBatch(batch, out.capability)),
          Effect.provide(fullStack(mode, emitterLayer, [ADMIN])),
        );
      }),
    );

    expect(result.status).toBe("done");
    expect(result.progress.completed).toBe(2);
    // exactly the two assign ops, captured by the MOCK writer (zero REAL writes).
    const assigns = capturedWrites().filter((w) => w.kind === "assign_role");
    expect(assigns.length).toBe(2);
    expect(assigns.map((w) => w.member_id).sort()).toEqual(["member-1", "member-2"]);
    expect(capturedWrites().filter((w) => w.kind === "create_role").length).toBe(0); // assign-only
    expect(recorder.countOf("shadow.role.applied.v1")).toBe(2);
    expect(recorder.countOf("shadow.role.rejected.v1")).toBe(0);
  });

  test("a batch with a MISBOUND report_hash is refused by the gate (hash binding)", async () => {
    const { layer: emitterLayer } = makeRecordingEmitter();
    const res = await Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const mode = yield* makeModeControl("SHADOW");
          const out = yield* goLive(mode, {
            actor: ADMIN, world: WORLD, reportHash: h64(MAP_HASH), currentMapHash: h64(MAP_HASH),
            transitionVersion: 9, evaluatedAt: "2026-06-02T00:00:00Z", rosterFreshness: NO_DRIFT,
          }).pipe(Effect.provide(Layer.mergeAll(
            makeAdminAllowlistInMemory(new Map([[WORLD as unknown as string, [ADMIN]]])),
            emitterLayer,
          )));
          // build a batch bound to the WRONG report hash (not the go_live one).
          const transition: AuthorizedTransition = {
            actor: ADMIN,
            reportHash: "f".repeat(64), // ≠ MAP_HASH → gate refuses
            authzDecisionId: out.authzDecisionId,
            transitionVersion: 9,
            tokenMetadata: { kid: "kid-1", verified_at: "2026-06-02T00:00:00Z", exp: "2026-06-02T01:00:00Z" },
          };
          const batch = assembleAssignBatch({
            world: "purupuru",
            transition,
            rosterVersion: ROSTER_VERSION,
            assignments: [{ wallet: "0xa", member_id: "m-1", tier: "core", role_key: "purupuru:core" }],
          });
          return yield* GateCheckedRoleWriter.pipe(
            Effect.flatMap((g) => g.applyBatch(batch, out.capability)),
            Effect.provide(fullStack(mode, emitterLayer, [ADMIN])),
          );
        }),
      ),
    );
    expect(res._tag).toBe("Left"); // WriteError: authz binding mismatch
  });
});
