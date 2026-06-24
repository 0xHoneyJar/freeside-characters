/**
 * coexistence.test.ts — FR-9 coexistence + rollback-GC (B2) + 250-role quota
 * (D3) (Sprint 405 / Task 405.4, SDD §1.5/§4.4.1, R-6/R-16).
 */
import { describe, expect, test } from "bun:test";
import {
  computeRollbackPlan,
  checkRoleCountQuota,
  isFreesideNamespaced,
  DISCORD_ROLE_LIMIT,
  type RolesCreatedEntry,
  type RoleAssignmentCount,
} from "./coexistence.ts";

describe("405.4 — rollback GC (B2): keep assigned, GC unassigned Freeside roles", () => {
  const ledger: RolesCreatedEntry[] = [
    { role_key: "purupuru:holder", role_id: "r-holder", op_id: "op1" },
    { role_key: "purupuru:whale", role_id: "r-whale", op_id: "op2" },
    { role_key: "purupuru:empty", role_id: "r-empty", op_id: "op3" },
  ];

  test("assigned Freeside roles are KEPT (never strip users) + warned; unassigned are GC'd", () => {
    const assignments: RoleAssignmentCount[] = [
      { role_id: "r-holder", assignments: 5 }, // assigned → keep
      { role_id: "r-whale", assignments: 1 }, // assigned → keep
      { role_id: "r-empty", assignments: 0 }, // unassigned → GC
    ];
    const plan = computeRollbackPlan(ledger, assignments);
    expect(plan.keep.map((k) => k.role_key).sort()).toEqual(["purupuru:holder", "purupuru:whale"]);
    expect(plan.gc.map((g) => g.role_key)).toEqual(["purupuru:empty"]);
    expect(plan.warnings.length).toBe(2);
    expect(plan.warnings[0]).toContain("never strips users");
  });

  test("a role absent from the ledger (pre-existing / Collab.Land) is NEVER touched", () => {
    // Only ledger entries are ever in scope; a pre-existing role isn't in the ledger.
    const assignments: RoleAssignmentCount[] = [{ role_id: "collabland-vip", assignments: 99 }];
    const plan = computeRollbackPlan(ledger, assignments);
    // none of the ledger roles have assignments here → all 3 GC'd; collabland-vip
    // is not in the plan at all (not Freeside-created).
    expect(plan.keep.length).toBe(0);
    expect(plan.gc.length).toBe(3);
    expect([...plan.keep, ...plan.gc].some((r) => r.role_key === "collabland-vip")).toBe(false);
  });

  test("repeated go_live/rollback cycles do not accumulate orphans (every unassigned Freeside role is GC-eligible)", () => {
    const plan = computeRollbackPlan(ledger, []); // nothing assigned
    expect(plan.gc.length).toBe(3); // all orphan empties collected
    expect(plan.keep.length).toBe(0);
  });
});

describe("405.4 — pre-go_live 250-role quota (D3)", () => {
  test("under the limit → not exceeded, no refusal message", () => {
    const q = checkRoleCountQuota(200, 10);
    expect(q.exceeds).toBe(false);
    expect(q.projected_total).toBe(210);
    expect(q.limit).toBe(DISCORD_ROLE_LIMIT);
    expect(q.message).toBe("");
  });

  test("exactly at the limit (250) is allowed; one over is refused with a clear message", () => {
    expect(checkRoleCountQuota(248, 2).exceeds).toBe(false); // 250 == limit, ok
    const over = checkRoleCountQuota(249, 2); // 251 > 250
    expect(over.exceeds).toBe(true);
    expect(over.projected_total).toBe(251);
    expect(over.message).toContain("exceeding Discord's 250-role limit");
  });
});

describe("405.4 — FR-9 namespacing", () => {
  test("only namespaced roles are Freeside-scoped", () => {
    expect(isFreesideNamespaced("purupuru:holder", "purupuru:")).toBe(true);
    expect(isFreesideNamespaced("CollabLand VIP", "purupuru:")).toBe(false);
    expect(isFreesideNamespaced("@everyone", "purupuru:")).toBe(false);
  });
});
