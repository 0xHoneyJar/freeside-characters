/**
 * shadow-loop.test.ts — the characters-side shadow loop + gate tests
 * (Sprint 405 / Task 405.E2E, SDD §8.4).
 *
 * Drives the REAL substrate gate (`GateCheckedRoleWriter` via `goLive` →
 * `applyBatch`) with the characters' MOCK RosterSource/RoleWriter Layers, so we
 * prove on THIS side:
 *   • G-3 SHADOW ⇒ zero writes (no inner-writer call; a confirmed
 *     `shadow.role.rejected.v1` per attempted write).
 *   • the gate REQUIRES a WriteCapability (LIVE applyBatch only succeeds with the
 *     cap `goLive` mints; SHADOW rejects regardless).
 *   • idempotent create/assign (a retried batch re-runs only failed ops; a
 *     create for an existing role_key reuses the id — no double create).
 *   • the MOCK writer captures intent only — zero REAL Discord writes.
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
import type {
  WriteIntentBatch,
  WriteCapability,
  RoleMapVersionInput,
  WorldSlug,
  Hex64,
  ModeControl,
} from "@freeside-worlds/shadow-substrate";
import { rosterFingerprint } from "@freeside-worlds/shadow-substrate";
import { RoleWriterMock, resetMockRoleWriter, capturedWrites } from "./role-writer.mock.ts";
import { makeRecordingEmitter } from "./acvp-emitter.mock.ts";
import { makeInMemoryWorldLock } from "./world-lock.ts";
import { makeAdminAllowlistInMemory } from "./admin-allowlist.live.ts";

const WORLD = "purupuru" as unknown as WorldSlug;
const ADMIN = "identity:admin-1";

const MAP_INPUT: RoleMapVersionInput = {
  role_rules: [
    { role_key: "purupuru:holder", display_name: "Purupuru Holder", qualifies: { source: "tier", min_tier: "tier-1" }, create_if_absent: true },
  ],
  scaffolding_config: { channels: [] },
  world_config: { world_slug: "purupuru", guild_id: "111122223333444455", namespace_prefix: "purupuru:", nft_contracts: ["0xabc"] },
};
const MAP_HASH = roleMapVersionHash(MAP_INPUT);
const h64 = (s: string) => s as unknown as Hex64;

// No-drift roster-freshness block: identical base + fresh snapshots.
const EMPTY_SNAPSHOT = { member_ids: [] as string[], role_ids: [] as string[] };
const NO_DRIFT = {
  baseFingerprint: rosterFingerprint(EMPTY_SNAPSHOT),
  baseSnapshot: EMPTY_SNAPSHOT,
  freshSnapshot: EMPTY_SNAPSHOT,
};

function makeBatch(reportHash: string, authzDecisionId: string, transitionVersion: number): WriteIntentBatch {
  return {
    world: WORLD,
    report_hash: h64(reportHash),
    authz: {
      actor: ADMIN,
      world: WORLD,
      report_hash: h64(reportHash),
      token_metadata: { kid: "kid-1", verified_at: "2026-06-02T00:00:00Z", exp: "2026-06-02T01:00:00Z" },
      transition_version: transitionVersion,
      authz_decision_id: authzDecisionId,
      roster_version: { fingerprint: h64("a".repeat(64)), fetched_at: "2026-06-02T00:00:00Z", member_count: 0 },
    },
    ops: [
      { op_id: "op-create-holder", idempotency_key: h64("b".repeat(64)), kind: "create_role", intent: { role_key: "purupuru:holder", display_name: "Purupuru Holder" } },
      { op_id: "op-assign-holder", idempotency_key: h64("c".repeat(64)), kind: "assign_role", intent: { role_key: "purupuru:holder", member_id: "member-1" as never } },
    ],
    max_concurrent: 4,
  };
}

/**
 * The FULL gate stack the gate's `applyBatch` service method requires:
 * gate + RoleWriter + AcvpEmitter + WorldLock + AdminAllowlistSource (the LIVE
 * path re-resolves authz at the write boundary, so all are needed at the call
 * site). Mint a cap via goLive, then run applyBatch through this stack.
 */
function fullStack(mode: ModeControl, emitterLayer: Layer.Layer<AcvpEmitter>, allow: readonly string[]) {
  const allowlist = makeAdminAllowlistInMemory(new Map([[WORLD as unknown as string, allow]]));
  const lock = makeInMemoryWorldLock();
  const gate = makeGateCheckedRoleWriter(mode, () => MAP_HASH).pipe(
    Layer.provide(Layer.mergeAll(RoleWriterMock, emitterLayer, lock)),
  );
  return Layer.mergeAll(gate, RoleWriterMock, emitterLayer, lock, allowlist);
}

function mintCap(mode: ModeControl, emitterLayer: Layer.Layer<AcvpEmitter>, transitionVersion: number) {
  const allowlist = makeAdminAllowlistInMemory(new Map([[WORLD as unknown as string, [ADMIN]]]));
  return goLive(mode, {
    actor: ADMIN, world: WORLD, reportHash: h64(MAP_HASH), currentMapHash: h64(MAP_HASH),
    transitionVersion, evaluatedAt: "2026-06-02T00:00:00Z", rosterFreshness: NO_DRIFT,
  }).pipe(Effect.provide(Layer.mergeAll(allowlist, emitterLayer)));
}

function runBatch(
  mode: ModeControl,
  emitterLayer: Layer.Layer<AcvpEmitter>,
  batch: WriteIntentBatch,
  cap: WriteCapability,
  prior?: Awaited<ReturnType<typeof Effect.runPromise>> | undefined,
) {
  return GateCheckedRoleWriter.pipe(
    Effect.flatMap((g) => g.applyBatch(batch, cap, prior as never)),
    Effect.provide(fullStack(mode, emitterLayer, [ADMIN])),
  );
}

beforeEach(() => resetMockRoleWriter());

describe("405.E2E — shadow loop through the real gate (MOCK writer)", () => {
  test("G-3: a SHADOW batch makes ZERO inner writes + confirms a rejection per op", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const mode = yield* makeModeControl("SHADOW");
        // mint a cap on a SEPARATE mode (so `mode` stays SHADOW for the test).
        const capMode = yield* makeModeControl("SHADOW");
        const out = yield* mintCap(capMode, emitterLayer, 1);
        const batch = makeBatch(MAP_HASH, out.authzDecisionId, 1);
        return yield* Effect.either(runBatch(mode, emitterLayer, batch, out.capability));
      }),
    );
    expect(result._tag).toBe("Left"); // ShadowGateRejected
    expect(capturedWrites().length).toBe(0); // ZERO real writes
    expect(recorder.countOf("shadow.role.rejected.v1")).toBe(2); // one per attempted op
    expect(recorder.countOf("shadow.role.applied.v1")).toBe(0);
    expect(recorder.countOf("shadow.role.intent.v1")).toBe(0);
  });

  test("LIVE: gate writes through the MOCK writer ONLY with a goLive-minted cap; intent-before-applied", async () => {
    const { layer: emitterLayer, recorder } = makeRecordingEmitter();
    const res = await Effect.runPromise(
      Effect.gen(function* () {
        const mode = yield* makeModeControl("SHADOW");
        const out = yield* mintCap(mode, emitterLayer, 7); // flips `mode` → LIVE
        const batch = makeBatch(MAP_HASH, out.authzDecisionId, 7);
        return yield* runBatch(mode, emitterLayer, batch, out.capability);
      }),
    );
    expect(res.status).toBe("done");
    expect(res.progress.completed).toBe(2);
    expect(capturedWrites().length).toBe(2); // 1 create + 1 assign, captured only
    expect(capturedWrites().filter((w) => w.kind === "create_role").length).toBe(1);
    expect(recorder.countOf("shadow.role.intent.v1")).toBe(2);
    expect(recorder.countOf("shadow.role.applied.v1")).toBe(2);
    expect(recorder.countOf("shadow.role.rejected.v1")).toBe(0);
    expect(res.roles_created.length).toBe(1);
    expect(res.roles_created[0]!.role_key).toBe("purupuru:holder");
  });

  test("idempotent: a retried batch reuses the existing role_key (no double create)", async () => {
    const { layer: emitterLayer } = makeRecordingEmitter();
    const { first, second } = await Effect.runPromise(
      Effect.gen(function* () {
        const mode = yield* makeModeControl("SHADOW");
        const out = yield* mintCap(mode, emitterLayer, 3);
        const batch = makeBatch(MAP_HASH, out.authzDecisionId, 3);
        const first = yield* runBatch(mode, emitterLayer, batch, out.capability);
        const second = yield* runBatch(mode, emitterLayer, batch, out.capability, first);
        return { first, second };
      }),
    );
    expect(first.status).toBe("done");
    expect(second.status).toBe("done");
    // EXACTLY ONE role created across both runs (idempotent create).
    expect(capturedWrites().filter((w) => w.kind === "create_role").length).toBe(1);
  });
});
