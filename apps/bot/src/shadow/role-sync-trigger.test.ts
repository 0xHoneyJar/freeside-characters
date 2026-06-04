/**
 * role-sync-trigger.test.ts — the VOICELESS CM tier→role sync trigger CORE
 * (bd-71y). NETWORK-FREE: the actor resolver, role-map reader, and orchestration
 * invoker are all INJECTED. Never touches discord.js, the network, or the real
 * substrate gate (the orchestration is a fake — the orchestrator itself has its
 * own end-to-end test against the real gate).
 *
 * Proves (the bd-71y gates):
 *   • not-verified CM is REFUSED before any read (no role-map read, no invoke).
 *   • a denied CM (orchestration authz-deny) surfaces as a voiceless error,
 *     ZERO writes (the fake records that applyMode reached it but threw).
 *   • SHADOW is the DEFAULT — an absent/typo mode never selects LIVE; the
 *     SHADOW invoke renders the structural result with zero writes.
 *   • the DEFAULT SEED map is used when config-service returns null (empty).
 *   • the CM-authored map is used when config-service returns one (mapSource).
 *   • LIVE requires the EXPLICIT choice — parseRoleSyncMode + the input.applyMode
 *     the orchestration sees is exactly the chosen mode.
 */
import { describe, expect, test } from "bun:test";
import {
  runRoleSyncTrigger,
  parseRoleSyncMode,
  computeMapHash,
  ROLE_SYNC_COMMAND_NAME,
  type RoleSyncTriggerDeps,
  type RoleSyncMode,
} from "./role-sync-trigger.ts";
import { buildPurupuruSeedRoleMap } from "./role-sync-seed-map.ts";
import type {
  GoLiveOrchestrationInput,
  GoLiveOrchestrationResult,
} from "./go-live-orchestrator.ts";
import type { RoleMapConfig, WriteIntentBatch } from "@freeside-worlds/shadow-substrate";

const WORLD = "purupuru";
const ACTOR = "identity:cm-1";

const WORLD_CONFIG = {
  guild_id: "111122223333444455",
  nft_contracts: ["0xabc"],
} as const;

const TOKEN_META = {
  kid: "kid-1",
  verified_at: "2026-06-04T00:00:00Z",
  exp: "2026-06-04T01:00:00Z",
};

/** A fake batch with one create + N assign ops (structural only). */
function fakeBatch(creates: string[], assigns: Array<[string, string]>): WriteIntentBatch {
  const ops = [
    ...creates.map((role_key, i) => ({
      op_id: `c${i}`,
      kind: "create_role" as const,
      intent: { role_key },
    })),
    ...assigns.map(([role_key, member_id], i) => ({
      op_id: `a${i}`,
      kind: "assign_role" as const,
      intent: { role_key, member_id },
    })),
  ];
  return { ops } as unknown as WriteIntentBatch;
}

/** A fake orchestration result (SHADOW preview shape: zero applied). */
function fakeResult(
  applyMode: RoleSyncMode,
  overrides: Partial<GoLiveOrchestrationResult> = {},
): GoLiveOrchestrationResult {
  const batch = fakeBatch(["purupuru:member", "purupuru:core"], [["purupuru:core", "700000000000000001"]]);
  return {
    applyMode,
    batch,
    job: {
      status: applyMode === "SHADOW" ? "failed" : "done",
      progress: {
        total: batch.ops.length,
        completed: applyMode === "SHADOW" ? 0 : batch.ops.length,
        failed: applyMode === "SHADOW" ? batch.ops.length : 0,
      },
      roles_created: [],
      op_status: batch.ops.map((o) => ({
        op_id: o.op_id,
        status: applyMode === "SHADOW" ? ("failed" as const) : ("ok" as const),
      })),
    },
    createCount: 2,
    assignCount: 1,
    skippedUnlinked: 1,
    skippedUnqualified: 2,
    skippedInvalid: 0,
    collapsedDuplicateMembers: 0,
    ...overrides,
  } as GoLiveOrchestrationResult;
}

/** Build trigger deps with injected ports; capture the orchestration input. */
function makeDeps(opts: {
  actor?: string | null;
  authoredMap?: RoleMapConfig | null;
  invoke: (input: GoLiveOrchestrationInput) => Promise<GoLiveOrchestrationResult>;
}): { deps: RoleSyncTriggerDeps } {
  const deps: RoleSyncTriggerDeps = {
    world: WORLD,
    resolveActor: () => (opts.actor === null ? null : { actor: opts.actor ?? ACTOR }),
    readRoleMap: () => opts.authoredMap ?? null,
    invokeOrchestration: opts.invoke,
    worldConfig: WORLD_CONFIG,
    now: () => "2026-06-04T00:00:00Z",
    tokenMetadata: TOKEN_META,
    transitionVersion: 7,
  };
  return { deps };
}

describe("bd-71y — role-sync trigger: SAFE-BY-DEFAULT mode parsing", () => {
  test("absent / undefined / null ⇒ SHADOW", () => {
    expect(parseRoleSyncMode(undefined)).toBe("SHADOW");
    expect(parseRoleSyncMode(null)).toBe("SHADOW");
    expect(parseRoleSyncMode("")).toBe("SHADOW");
  });
  test("a typo or anything-not-live ⇒ SHADOW (LIVE never selected accidentally)", () => {
    expect(parseRoleSyncMode("liv")).toBe("SHADOW");
    expect(parseRoleSyncMode("LIVE ")).toBe("LIVE"); // trimmed
    expect(parseRoleSyncMode("preview")).toBe("SHADOW");
    expect(parseRoleSyncMode("shadow")).toBe("SHADOW");
  });
  test("the explicit (case-insensitive) 'live' ⇒ LIVE", () => {
    expect(parseRoleSyncMode("live")).toBe("LIVE");
    expect(parseRoleSyncMode("LIVE")).toBe("LIVE");
    expect(parseRoleSyncMode("Live")).toBe("LIVE");
  });
});

describe("bd-71y — role-sync trigger: not-verified CM is REFUSED before any read", () => {
  test("a null actor ⇒ refused; the role-map reader + orchestration are NEVER called", async () => {
    let readCalled = false;
    let invokeCalled = false;
    const { deps } = makeDeps({
      actor: null,
      invoke: async () => {
        invokeCalled = true;
        return fakeResult("SHADOW");
      },
    });
    const outcome = await runRoleSyncTrigger(
      { ...deps, readRoleMap: () => ((readCalled = true), null) },
      "LIVE", // even an explicit LIVE is refused with no actor
    );
    expect(outcome.kind).toBe("refused");
    if (outcome.kind === "refused") expect(outcome.reason).toBe("not_verified");
    expect(readCalled).toBe(false);
    expect(invokeCalled).toBe(false);
  });
});

describe("bd-71y — role-sync trigger: SHADOW renders structural result, zero writes", () => {
  test("default mode is SHADOW; the orchestration sees applyMode SHADOW; result rendered", async () => {
    let seenMode: RoleSyncMode | undefined;
    const { deps } = makeDeps({
      invoke: async (input) => {
        seenMode = input.applyMode;
        return fakeResult("SHADOW");
      },
    });
    // no explicit mode ⇒ default SHADOW
    const outcome = await runRoleSyncTrigger(deps);
    expect(seenMode).toBe("SHADOW");
    expect(outcome.kind).toBe("rendered");
    if (outcome.kind === "rendered") {
      expect(outcome.applyMode).toBe("SHADOW");
      // SHADOW job = zero completed (zero writes), every op rejected.
      expect(outcome.result.job.status).toBe("failed");
      expect(outcome.result.job.progress.completed).toBe(0);
      // CV2 payload: components + inert mentions, no content/embeds.
      expect(outcome.payload.flags).toBeGreaterThan(0);
      expect(outcome.payload.allowed_mentions).toEqual({ parse: [] });
      expect(Array.isArray(outcome.payload.components)).toBe(true);
      // structural render mentions the mode + the SHADOW preview note.
      const text = JSON.stringify(outcome.payload.components);
      expect(text).toContain("SHADOW preview");
      expect(text).toContain("ZERO writes");
    }
  });
});

describe("bd-71y — role-sync trigger: DEFAULT SEED map vs CM-authored map", () => {
  test("config-service empty (null) ⇒ DEFAULT SEED map; the seed reaches the orchestration", async () => {
    let seenMap: RoleMapConfig | undefined;
    const { deps } = makeDeps({
      authoredMap: null, // config empty
      invoke: async (input) => {
        seenMap = input.roleMap;
        return fakeResult("SHADOW");
      },
    });
    const outcome = await runRoleSyncTrigger(deps);
    expect(outcome.kind).toBe("rendered");
    if (outcome.kind === "rendered") expect(outcome.mapSource).toBe("default-seed");
    // the seed map (one namespaced role per Purupuru tier) reached the orchestration.
    const seed = buildPurupuruSeedRoleMap();
    expect(seenMap?.namespace_prefix).toBe("purupuru:");
    expect(seenMap?.rules.map((r) => r.role_key).sort()).toEqual(
      seed.rules.map((r) => r.role_key).sort(),
    );
    // every seed rule is create_if_absent (unblocks the first test).
    expect(seenMap?.rules.every((r) => r.create_if_absent === true)).toBe(true);
    // the structural render flags the seed as a CM-overridable default.
    const text = JSON.stringify((outcome as { payload: unknown }).payload);
    expect(text).toContain("DEFAULT SEED");
  });

  test("config-service returns a map ⇒ CM-authored is used (mapSource config-service)", async () => {
    const authored: RoleMapConfig = {
      enabled: true,
      namespace_prefix: "purupuru:",
      rules: [
        {
          role_key: "purupuru:vip",
          display_name: "VIP",
          qualifies: { source: "tier", min_tier: "core" },
          create_if_absent: true,
        },
      ],
    } as RoleMapConfig;
    let seenMap: RoleMapConfig | undefined;
    const { deps } = makeDeps({
      authoredMap: authored,
      invoke: async (input) => {
        seenMap = input.roleMap;
        return fakeResult("SHADOW");
      },
    });
    const outcome = await runRoleSyncTrigger(deps);
    expect(outcome.kind).toBe("rendered");
    if (outcome.kind === "rendered") expect(outcome.mapSource).toBe("config-service");
    expect(seenMap?.rules.map((r) => r.role_key)).toEqual(["purupuru:vip"]);
  });
});

describe("bd-71y — role-sync trigger: LIVE requires the explicit choice", () => {
  test("an explicit LIVE flows applyMode:LIVE into the orchestration", async () => {
    let seenMode: RoleSyncMode | undefined;
    const { deps } = makeDeps({
      invoke: async (input) => {
        seenMode = input.applyMode;
        return fakeResult("LIVE");
      },
    });
    const outcome = await runRoleSyncTrigger(deps, "LIVE");
    expect(seenMode).toBe("LIVE");
    expect(outcome.kind).toBe("rendered");
    if (outcome.kind === "rendered") {
      expect(outcome.applyMode).toBe("LIVE");
      const text = JSON.stringify(outcome.payload.components);
      expect(text).toContain("LIVE apply");
    }
  });

  test("the reportHash == currentMapHash (an unchanged map) and matches computeMapHash", async () => {
    let seenInput: GoLiveOrchestrationInput | undefined;
    const { deps } = makeDeps({
      invoke: async (input) => {
        seenInput = input;
        return fakeResult("SHADOW");
      },
    });
    await runRoleSyncTrigger(deps);
    expect(seenInput).toBeDefined();
    // an unchanged map: report == current.
    expect(seenInput!.reportHash).toBe(seenInput!.currentMapHash);
    // and it equals the deterministic hash of the seed map + world-config.
    const expected = computeMapHash(buildPurupuruSeedRoleMap(), WORLD, WORLD_CONFIG);
    expect(seenInput!.reportHash).toBe(expected);
  });
});

describe("bd-71y — role-sync trigger: a denied/erroring orchestration ⇒ voiceless error", () => {
  test("an orchestration throw (authz deny) surfaces as kind:error, no render", async () => {
    let invoked = false;
    const { deps } = makeDeps({
      invoke: async () => {
        invoked = true;
        throw new Error("actor 'identity:cm-1' is not allowlisted for world 'purupuru' (not_allowlisted) — preview refused before any read");
      },
    });
    const outcome = await runRoleSyncTrigger(deps, "LIVE");
    expect(invoked).toBe(true); // authz happens INSIDE the orchestration
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.message).toContain("failed");
      expect(outcome.message).toContain("not allowlisted");
    }
  });
});

describe("bd-71y — command name constant", () => {
  test("the command a CM invokes is /role-sync", () => {
    expect(ROLE_SYNC_COMMAND_NAME).toBe("role-sync");
  });
});

// ─── bd-l08 — member-centric SHADOW routing ──────────────────────────────────
import type { MemberCentricShadowDeps } from "./role-sync-trigger.ts";

const MEMBER_A = "700000000000000001"; // operator-style: linked, tier member, ADD
const WALLET_A = "0xaaa0000000000000000000000000000000000001";

function memberCentricDeps(): MemberCentricShadowDeps {
  return {
    members: async () => [
      { discord_id: MEMBER_A, display_name: "soju", current_managed_roles: [] },
      { discord_id: "700000000000000002", display_name: "nolink", current_managed_roles: [] },
    ],
    resolveIdentity: async (id) =>
      id === MEMBER_A
        ? { kind: "linked", user_id: "u-a", wallet: WALLET_A }
        : { kind: "unlinked" },
    readTier: async (wallet) => (wallet.toLowerCase() === WALLET_A ? "member" : null),
  };
}

describe("bd-l08 — role-sync trigger: member-centric SHADOW dashboard", () => {
  test("when memberCentric is wired + mode SHADOW ⇒ rendered-members, NO orchestration call", async () => {
    let invoked = false;
    const { deps } = makeDeps({
      invoke: async () => {
        invoked = true;
        return fakeResult("SHADOW");
      },
    });
    const outcome = await runRoleSyncTrigger(
      { ...deps, memberCentric: memberCentricDeps() },
      "SHADOW",
    );
    // the leaderboard-centric orchestration is NEVER called on the member path.
    expect(invoked).toBe(false);
    expect(outcome.kind).toBe("rendered-members");
    if (outcome.kind === "rendered-members") {
      expect(outcome.applyMode).toBe("SHADOW");
      expect(outcome.payload.allowed_mentions).toEqual({ parse: [] });
      const text = JSON.stringify(outcome.payload.components);
      // member-centric dashboard headings + the operator-style ADD row.
      expect(text).toContain("Member roles");
      expect(text).toContain("Would add");
      expect(text).toContain("soju");
      expect(text).toContain("purupuru:member");
      // summary counts surfaced.
      expect(text).toContain("2** members");
      expect(text).toContain("1** would-add");
      expect(text).toContain("1** unlinked");
    }
  });

  test("not-verified CM is STILL refused before the member roster read", async () => {
    let membersRead = false;
    const mc = memberCentricDeps();
    const { deps } = makeDeps({ actor: null, invoke: async () => fakeResult("SHADOW") });
    const outcome = await runRoleSyncTrigger(
      {
        ...deps,
        memberCentric: { ...mc, members: async (w) => ((membersRead = true), mc.members(w)) },
      },
      "SHADOW",
    );
    expect(outcome.kind).toBe("refused");
    expect(membersRead).toBe(false);
  });

  test("LIVE still flows through the orchestration (member path is SHADOW-only)", async () => {
    let invoked = false;
    const { deps } = makeDeps({
      invoke: async (input) => {
        invoked = true;
        return fakeResult(input.applyMode);
      },
    });
    const outcome = await runRoleSyncTrigger(
      { ...deps, memberCentric: memberCentricDeps() },
      "LIVE",
    );
    expect(invoked).toBe(true);
    expect(outcome.kind).toBe("rendered"); // leaderboard-centric render, not member.
  });

  test("a total guild-members read failure ⇒ voiceless error (zero writes)", async () => {
    const mc = memberCentricDeps();
    const { deps } = makeDeps({ invoke: async () => fakeResult("SHADOW") });
    const outcome = await runRoleSyncTrigger(
      {
        ...deps,
        memberCentric: {
          ...mc,
          members: async () => {
            throw new Error("guild fetch 503");
          },
        },
      },
      "SHADOW",
    );
    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") expect(outcome.message).toContain("Member roster");
  });
});
