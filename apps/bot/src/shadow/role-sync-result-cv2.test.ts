/**
 * role-sync-result-cv2.test.ts — the VOICELESS structural render of a
 * GoLiveOrchestrationResult (bd-71y). Proves: the CV2 grammar (container 17 /
 * text 10 / separator 14), inert mentions, counts/role-lists surfaced, the
 * default-seed flag, and the injection guard (attacker role name neutralized).
 */
import { describe, expect, test } from "bun:test";
import {
  renderRoleSyncResultCV2,
  roleSyncResultCV2Payload,
} from "./role-sync-result-cv2.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import type { GoLiveOrchestrationResult } from "./go-live-orchestrator.ts";
import type { WriteIntentBatch } from "@freeside-worlds/shadow-substrate";

function result(applyMode: "SHADOW" | "LIVE", roleKeys: { create: string[]; assign: Array<[string, string]> }): GoLiveOrchestrationResult {
  const ops = [
    ...roleKeys.create.map((role_key, i) => ({ op_id: `c${i}`, kind: "create_role" as const, intent: { role_key } })),
    ...roleKeys.assign.map(([role_key, member_id], i) => ({ op_id: `a${i}`, kind: "assign_role" as const, intent: { role_key, member_id } })),
  ];
  const batch = { ops } as unknown as WriteIntentBatch;
  return {
    applyMode,
    batch,
    job: { status: applyMode === "SHADOW" ? "failed" : "done", progress: { total: ops.length, completed: applyMode === "SHADOW" ? 0 : ops.length, failed: applyMode === "SHADOW" ? ops.length : 0 }, roles_created: [], op_status: ops.map((o) => ({ op_id: o.op_id, status: applyMode === "SHADOW" ? ("failed" as const) : ("ok" as const) })) },
    createCount: roleKeys.create.length,
    assignCount: roleKeys.assign.length,
    skippedUnlinked: 3,
    skippedUnqualified: 5,
    skippedInvalid: 1,
    collapsedDuplicateMembers: 2,
  } as GoLiveOrchestrationResult;
}

describe("bd-71y — role-sync result CV2 render (structural, voiceless)", () => {
  test("CV2 grammar: container 17, text 10, separator 14", () => {
    const c = renderRoleSyncResultCV2(
      result("SHADOW", { create: ["purupuru:member"], assign: [["purupuru:core", "700000000000000001"]] }),
      { world: "purupuru", mapSource: "default-seed" },
    );
    expect(c.type).toBe(17);
    expect(typeof c.accent_color).toBe("number");
    const types = c.components.map((x) => x.type);
    expect(types).toContain(10); // text
    expect(types).toContain(14); // separator
  });

  test("payload: IS_COMPONENTS_V2 flag + inert mentions, no content/embeds", () => {
    const p = roleSyncResultCV2Payload(
      result("SHADOW", { create: [], assign: [] }),
      { world: "purupuru", mapSource: "config-service" },
    );
    expect(p.flags & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    expect(p.allowed_mentions).toEqual({ parse: [] });
    expect((p as { content?: string }).content).toBeUndefined();
  });

  test("counts + role lists + skip breakdown surfaced", () => {
    const c = renderRoleSyncResultCV2(
      result("LIVE", { create: ["purupuru:member", "purupuru:core"], assign: [["purupuru:core", "700000000000000001"], ["purupuru:core", "700000000000000002"]] }),
      { world: "purupuru", mapSource: "config-service" },
    );
    const text = JSON.stringify(c.components);
    expect(text).toContain("LIVE apply");
    expect(text).toContain("Roles to create (2)");
    expect(text).toContain("Assignments (2)");
    // assign aggregated by role: purupuru:core — 2 members
    expect(text).toContain("2 members");
    expect(text).toContain("3 qualified but"); // skippedUnlinked
    expect(text).toContain("5 below every rule"); // skippedUnqualified
    expect(text).toContain("1 invalid member id"); // skippedInvalid
    expect(text).toContain("2 duplicate"); // collapsedDuplicateMembers
  });

  test("default-seed provenance is flagged for the CM", () => {
    const c = renderRoleSyncResultCV2(
      result("SHADOW", { create: [], assign: [] }),
      { world: "purupuru", mapSource: "default-seed" },
    );
    expect(JSON.stringify(c.components)).toContain("DEFAULT SEED");
  });

  test("INJECTION GUARD: an attacker role name (@everyone, markdown) is neutralized", () => {
    const c = renderRoleSyncResultCV2(
      result("SHADOW", { create: ["@everyone"], assign: [["**bold** `code`", "700000000000000001"]] }),
      { world: "purupuru", mapSource: "config-service" },
    );
    // inspect the RAW component content (not JSON.stringify, which double-escapes).
    const contents = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content)
      .join("\n");
    // the literal "@everyone" must NOT appear unbroken (zero-width inserted after @).
    expect(contents).not.toContain("@everyone");
    // markdown control chars escaped (backslash-escaped in the rendered name).
    expect(contents).toContain("\\*\\*bold\\*\\*");
  });
});
