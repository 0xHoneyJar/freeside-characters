/**
 * shadow/coexistence.ts — FR-9 coexistence + rollback-GC + 250-role quota
 * (Sprint 405 / Task 405.4, SDD §1.5/§4.4.1, B2/D3, R-6/R-16).
 *
 * PURE decision logic (data-in/data-out, no I/O) over the substrate's
 * `roles_created` ledger + the current guild roster. The composition root feeds
 * these decisions to the gated adapter (`role-writer.live.ts` `deleteRole`,
 * which is the only place a Discord role-DELETE happens). Keeping the decisions
 * pure makes them unit-testable with zero Discord calls — the same discipline
 * the substrate's pure core uses.
 *
 * ── FR-9 coexistence ─────────────────────────────────────────────────────────
 * Freeside touches ONLY namespaced (Freeside-prefixed) roles. Collab.Land /
 * pre-existing roles are NEVER contended. The `roles_created` ledger is the
 * source of truth for "Freeside-created"; a role present in the guild but NOT in
 * the ledger is pre-existing and out of scope.
 *
 * ── Rollback GC (B2) ─────────────────────────────────────────────────────────
 * Rollback is NON-DESTRUCTIVE for ASSIGNED roles (≥1 member → keep + warn,
 * never strip users — R-6). It GARBAGE-COLLECTS created-but-UNASSIGNED
 * Freeside-namespaced roles so repeated go_live/rollback/partial-failure cycles
 * cannot accumulate orphan empty roles toward Discord's 250-role ceiling.
 *
 * ── 250-role quota (D3) ──────────────────────────────────────────────────────
 * Before a go_live batch starts: refuse if `(existing + to_create) > 250` with a
 * clear limit error, surfaced predictively in the comparison (the substrate's
 * `Discrepancy.role_count` mirrors this).
 */

export const DISCORD_ROLE_LIMIT = 250 as const;

/** A row of the substrate's `roles_created` ledger (Freeside-created roles). */
export interface RolesCreatedEntry {
  readonly role_key: string;
  readonly role_id: string;
  readonly op_id: string;
}

/** Current per-role member counts (from the live roster read), keyed by role_id. */
export interface RoleAssignmentCount {
  readonly role_id: string;
  readonly assignments: number;
}

/** The rollback plan: which Freeside roles to KEEP (warn) vs GC (delete). */
export interface RollbackPlan {
  /** assigned Freeside roles — KEEP (never strip users); surfaced as warnings. */
  readonly keep: ReadonlyArray<{ role_key: string; role_id: string; assignments: number }>;
  /** created-but-UNASSIGNED Freeside roles — GC-eligible (delete to free budget). */
  readonly gc: ReadonlyArray<{ role_key: string; role_id: string }>;
  /** human-readable warnings for the kept roles. */
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Compute the rollback plan (B2). ONLY Freeside-created roles (in the ledger) are
 * ever in scope — pre-existing roles are untouched. A role with ≥1 assignment is
 * KEPT (warn); a zero-assignment Freeside role is GC'd.
 *
 * @param rolesCreated  the substrate `roles_created` ledger.
 * @param assignments   current member counts per role_id (from the live roster).
 */
export function computeRollbackPlan(
  rolesCreated: readonly RolesCreatedEntry[],
  assignments: readonly RoleAssignmentCount[],
): RollbackPlan {
  const countById = new Map(assignments.map((a) => [a.role_id, a.assignments]));
  const keep: Array<{ role_key: string; role_id: string; assignments: number }> = [];
  const gc: Array<{ role_key: string; role_id: string }> = [];
  const warnings: string[] = [];

  for (const entry of rolesCreated) {
    const n = countById.get(entry.role_id) ?? 0;
    if (n > 0) {
      keep.push({ role_key: entry.role_key, role_id: entry.role_id, assignments: n });
      warnings.push(
        `kept Freeside role '${entry.role_key}' (${n} member${n === 1 ? "" : "s"}) — rollback never strips users (FR-9/R-6)`,
      );
    } else {
      gc.push({ role_key: entry.role_key, role_id: entry.role_id });
    }
  }
  return { keep, gc, warnings };
}

/** The result of a pre-go_live 250-role quota check (D3). */
export interface QuotaCheck {
  readonly existing: number;
  readonly to_create: number;
  readonly projected_total: number;
  readonly limit: number;
  readonly exceeds: boolean;
  /** clear refusal message when `exceeds` (empty otherwise). */
  readonly message: string;
}

/**
 * Pre-go_live role-count quota check (D3): `(existing + to_create) ≤ 250`.
 * `exceeds: true` is the hard refusal — the composition root MUST NOT dispatch
 * the batch when this is set.
 *
 * @param existingRoleCount  current guild role count (incl. pre-existing + @everyone-excluded).
 * @param toCreate           number of NEW Freeside roles this batch would create.
 */
export function checkRoleCountQuota(
  existingRoleCount: number,
  toCreate: number,
): QuotaCheck {
  const projected = existingRoleCount + toCreate;
  const exceeds = projected > DISCORD_ROLE_LIMIT;
  return {
    existing: existingRoleCount,
    to_create: toCreate,
    projected_total: projected,
    limit: DISCORD_ROLE_LIMIT,
    exceeds,
    message: exceeds
      ? `go_live refused: creating ${toCreate} role(s) would push the guild to ${projected}, exceeding Discord's ${DISCORD_ROLE_LIMIT}-role limit (currently ${existingRoleCount}). Reduce the proposed set or remove unused roles first.`
      : "",
  };
}

/**
 * FR-9 namespacing guard: a role_key is in Freeside scope iff it carries the
 * world's namespace prefix. Used to ensure the writer never touches a
 * non-namespaced (Collab.Land / pre-existing) role.
 */
export function isFreesideNamespaced(roleKey: string, namespacePrefix: string): boolean {
  return roleKey.startsWith(namespacePrefix);
}
