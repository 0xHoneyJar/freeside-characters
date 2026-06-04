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
  buildCreateOps,
  createOpId,
  assembleGoLiveBatch,
  type WalletDiscordLink,
  type AuthorizedTransition,
} from "./score-tier-assignment.ts";
import type { CurrentRoster } from "@freeside-worlds/shadow-substrate";

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

/** A valid 17-20-digit Discord snowflake from a short tag (post-#12 the builder
 *  counts non-snowflake member_ids as invalid, never assigned). */
function sf(tag: string | number): string {
  const digits = String(tag).replace(/\D/g, "") || "0";
  return ("8" + digits.padStart(17, "0")).slice(0, 18);
}

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
      link: linkFrom({ "0xcore": sf(100), "0xmember": sf(200), "0xelder": sf(300) }),
    });
    expect(res.assignments.length).toBe(3);
    const byMember = Object.fromEntries(res.assignments.map((a) => [a.member_id, a.role_key]));
    expect(byMember[sf(100)]).toBe("purupuru:core");
    expect(byMember[sf(200)]).toBe("purupuru:member");
    expect(byMember[sf(300)]).toBe("purupuru:core"); // elder > core, top configured rule
  });

  test("a qualified-but-unlinked wallet is skipped (counted), never assigned", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xa", "core"), lbEntry("0xb", "core")],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xa": sf(100) /* 0xb has no link */ }),
    });
    expect(res.assignments.length).toBe(1);
    expect(res.assignments[0]!.member_id).toBe(sf(100));
    expect(res.skipped_unlinked).toBe(1);
  });

  test("a wallet below every rule (or untiered) is skipped as unqualified", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xlow", "newcomer"), lbEntry("0xnull", null)],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xlow": sf(100), "0xnull": sf(200) }),
    });
    expect(res.assignments.length).toBe(0);
    expect(res.skipped_unqualified).toBe(2);
  });

  test("a disabled role-map produces zero assignments", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xa", "core")],
      roleMap: { ...ROLE_MAP, enabled: false },
      link: linkFrom({ "0xa": sf(100) }),
    });
    expect(res.assignments.length).toBe(0);
  });

  // #6 — per-MEMBER (not per-wallet) dedup
  test("#6: two wallets linked to ONE member emit ONE op (the strongest tier)", async () => {
    const SHARED = sf(777);
    const res = await buildTierAssignments({
      leaderboard: [
        lbEntry("0xw1", "member"), // member's weaker wallet
        lbEntry("0xw2", "core"),   // member's stronger wallet (→ should win)
      ],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xw1": SHARED, "0xw2": SHARED }), // SAME discord member
    });
    expect(res.assignments.length).toBe(1); // ONE op, not two
    expect(res.assignments[0]!.member_id).toBe(SHARED);
    expect(res.assignments[0]!.role_key).toBe("purupuru:core"); // strongest tier wins
    expect(res.collapsed_duplicate_members).toBe(1);
  });

  test("#6: dedup keeps the stronger tier regardless of leaderboard order", async () => {
    const SHARED = sf(888);
    const res = await buildTierAssignments({
      leaderboard: [
        lbEntry("0xstrong", "core"),  // stronger FIRST
        lbEntry("0xweak", "member"),  // weaker SECOND
      ],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xstrong": SHARED, "0xweak": SHARED }),
    });
    expect(res.assignments.length).toBe(1);
    expect(res.assignments[0]!.role_key).toBe("purupuru:core");
    expect(res.collapsed_duplicate_members).toBe(1);
  });

  // #12 — non-snowflake member_id counted invalid (separate from unlinked)
  test("#12: a non-snowflake member_id is counted INVALID, never assigned", async () => {
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xgood", "core"), lbEntry("0xbad", "core")],
      roleMap: ROLE_MAP,
      link: linkFrom({ "0xgood": sf(1), "0xbad": "not-a-snowflake" }),
    });
    expect(res.assignments.length).toBe(1);
    expect(res.assignments[0]!.member_id).toBe(sf(1));
    expect(res.skipped_invalid).toBe(1);
    expect(res.skipped_unlinked).toBe(0); // invalid is NOT counted as unlinked
  });

  // #13 — non-tier rule is explicitly skipped (observable)
  test("#13: a non-tier rule is explicitly skipped (not relied on accidental fail-close)", async () => {
    // a role-map carrying a NON-tier rule alongside a tier rule. (The substrate
    // types `source` as 'tier'; this fixture casts to exercise the runtime guard.)
    const mixedMap = {
      ...ROLE_MAP,
      rules: [
        { role_key: "purupuru:nft", display_name: "NFT", qualifies: { source: "nft", min_tier: "core" }, create_if_absent: true },
        { role_key: "purupuru:core", display_name: "Core", qualifies: { source: "tier", min_tier: "core" }, create_if_absent: true },
      ],
    } as unknown as RoleMapConfig;
    const res = await buildTierAssignments({
      leaderboard: [lbEntry("0xcore", "core")],
      roleMap: mixedMap,
      link: linkFrom({ "0xcore": sf(5) }),
    });
    // the tier rule still assigns; the non-tier rule never participates.
    expect(res.assignments.length).toBe(1);
    expect(res.assignments[0]!.role_key).toBe("purupuru:core");
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

// ── 2b. CREATE pass (FR-4) — buildCreateOps + assembleGoLiveBatch ─────────────

describe("buildCreateOps — the FR-4 create pass (via computeProposed)", () => {
  const ROSTER_NO_MANAGED: CurrentRoster = {
    world: "purupuru",
    roles: [{ role_key: "Holder", members: 5, managed: false }], // pre-existing, non-managed
  } as CurrentRoster;

  test("proposes create_role ops ONLY for not-yet-created managed roles", () => {
    const ops = buildCreateOps("purupuru", "h".repeat(64), ROLE_MAP, ROSTER_NO_MANAGED);
    expect(ops.length).toBe(2); // both tier roles absent → both created
    expect(ops.every((o) => o.kind === "create_role")).toBe(true);
    expect(ops.map((o) => o.intent.role_key).sort()).toEqual(["purupuru:core", "purupuru:member"]);
    // create_role carries display_name (CreateRoleIntent).
    const member = ops.find((o) => o.intent.role_key === "purupuru:member")!;
    expect((member.intent as { display_name: string }).display_name).toBe("Member");
  });

  test("SKIPS create for an already-existing managed role", () => {
    const rosterWithCore: CurrentRoster = {
      world: "purupuru",
      roles: [{ role_key: "purupuru:core", members: 2, managed: true }],
    } as CurrentRoster;
    const ops = buildCreateOps("purupuru", "h".repeat(64), ROLE_MAP, rosterWithCore);
    expect(ops.map((o) => o.intent.role_key)).toEqual(["purupuru:member"]); // core exists, skip
  });

  test("a disabled role-map produces zero create ops", () => {
    const ops = buildCreateOps("purupuru", "h".repeat(64), { ...ROLE_MAP, enabled: false }, ROSTER_NO_MANAGED);
    expect(ops.length).toBe(0);
  });

  test("create op_id + idempotency_key are deterministic + distinct from an assign for the same role", () => {
    const cId = createOpId("purupuru", "purupuru:core");
    expect(cId).toBe(createOpId("purupuru", "purupuru:core"));
    expect(cId).not.toBe(assignOpId("purupuru", "purupuru:core", "100"));
    const cKey = assignIdempotencyKey("purupuru", cId, "h".repeat(64));
    const aKey = assignIdempotencyKey("purupuru", assignOpId("purupuru", "purupuru:core", "100"), "h".repeat(64));
    expect(cKey).not.toBe(aKey); // create-key ≠ assign-key for same role
    expect(cKey).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("assembleGoLiveBatch — create pass FIRST, then assign pass", () => {
  test("orders create_role ops before assign_role ops, sharing one AuthzContext", () => {
    const transition: AuthorizedTransition = {
      actor: ADMIN,
      reportHash: MAP_HASH,
      authzDecisionId: "decision-1",
      transitionVersion: 3,
      tokenMetadata: { kid: "kid-1", verified_at: "2026-06-02T00:00:00Z", exp: "2026-06-02T01:00:00Z" },
    };
    const batch = assembleGoLiveBatch({
      world: "purupuru",
      transition,
      rosterVersion: ROSTER_VERSION,
      assignments: [{ wallet: "0xc", member_id: "100", tier: "core", role_key: "purupuru:core" }],
      roleMap: ROLE_MAP,
      currentRoster: { world: "purupuru", roles: [] } as CurrentRoster, // nothing exists → both created
    });
    const kinds = batch.ops.map((o) => o.kind);
    // 2 creates then 1 assign; the last create index < the first assign index.
    expect(kinds.filter((k) => k === "create_role").length).toBe(2);
    expect(kinds.filter((k) => k === "assign_role").length).toBe(1);
    expect(kinds.lastIndexOf("create_role")).toBeLessThan(kinds.indexOf("assign_role"));
    // one shared AuthzContext bound to the transition.
    expect(batch.authz.authz_decision_id).toBe("decision-1");
    expect(batch.authz.actor).toBe(ADMIN);
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
      link: linkFrom({ "0xcore": sf("11"), "0xelder": sf("22") }),
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
    expect(assigns.map((w) => w.member_id).sort()).toEqual([sf("11"), sf("22")].sort());
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
