/**
 * role-snapshot.contract.ts — the VENDORED `RoleSnapshot` wire contract (S3 / EXPORT-1).
 *
 * ── PROVENANCE (this is a COPY — keep it in sync) ─────────────────────────────
 *   source repo:   0xHoneyJar/loa-freeside
 *   source path:   packages/services/shadow-audit/src/role-snapshot.ts
 *   source commit: 025cbe6d37f08346b1519c119d6982966836e894  (HEAD @ copy, 2026-07-12)
 *   schema commit: c674bd39  (the commit that last changed the schema itself)
 *   consumed by:   POST https://shadow-audit-api-production.up.railway.app/v1/role-snapshot
 *
 * ── WHY A COPY AND NOT AN IMPORT ──────────────────────────────────────────────
 * The canonical schema is a zod schema living at a SUBPATH inside the loa-freeside
 * monorepo (`packages/services/shadow-audit`). A git-URL dependency cannot install a
 * monorepo subdirectory, and this repo has zero `@freeside/*` deps. So the contract is
 * vendored. `role-snapshot.contract.test.ts` parses the vendored GOLDEN FIXTURE (also
 * copied verbatim from the source repo) with this validator — that test is the DRIFT
 * ALARM. If the upstream schema changes and the fixture is re-copied, the test fails
 * here instead of the ingest failing live with a 422.
 *
 * ── WHY HAND-WRITTEN AND NOT ZOD ──────────────────────────────────────────────
 * `zod` is NOT a dependency of apps/bot (it resolves only under packages/persona-engine's
 * own node_modules — `import { z } from "zod"` from here fails at runtime), and adding a
 * runtime dependency is out of scope for this task. So the validator below is a zero-dep
 * transcription of the source's zod rules. Every rule is annotated with the zod line it
 * mirrors. The rules, verbatim from the source:
 *
 *   RoleSnapshotEntrySchema = z.object({
 *     discord_user_id: z.string().min(1),
 *     wallet:          z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
 *     role_ids:        z.array(z.string().min(1)).min(1),
 *   }).strict();
 *
 *   RoleSnapshotSchema = z.object({
 *     source:                      z.string().min(1),
 *     community:                   z.string().min(1),
 *     captured_at:                 z.string().datetime(),      // ISO-8601, UTC "Z"
 *     export_method:               z.string().min(1),
 *     owner:                       z.string().min(1),
 *     freshness_threshold_seconds: z.number().int().positive(),
 *     entries:                     z.array(RoleSnapshotEntrySchema),
 *   }).strict();
 *
 * `.strict()` is load-bearing: an EXTRA field is a 422 from the live service, not a
 * warning. The validator below rejects unknown keys for exactly that reason.
 *
 * KNOWN NUANCE: zod's `.datetime()` uses a calendar-aware regex (it rejects 2026-02-30).
 * This transcription checks the ISO-UTC *shape* by regex and delegates calendar validity
 * to `Date.parse` returning a real instant — equivalent for every value this exporter
 * emits (always `new Date().toISOString()`), and never LOOSER than the source in a way
 * that would let us emit a snapshot the service rejects.
 */

/** A rejected snapshot, with the offending path (mirrors a zod issue closely enough to debug a 422). */
export class RoleSnapshotContractError extends Error {
  constructor(readonly path: string, message: string) {
    super(`role-snapshot contract violation at '${path}': ${message}`);
    this.name = "RoleSnapshotContractError";
  }
}

/** Resolved on-chain wallet: 0x + 40 hex. Mirrors the source regex EXACTLY. */
export const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

/** ISO-8601 UTC instant (zod `.datetime()`: the "Z" form; an offset like +02:00 is REJECTED). */
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?Z$/;

/** One role-holder. `wallet` ABSENT ⇒ the holder is FLAGGED as unmatched, never dropped. */
export interface RoleSnapshotEntry {
  readonly discord_user_id: string;
  readonly wallet?: string;
  readonly role_ids: ReadonlyArray<string>;
}

export interface RoleSnapshot {
  readonly source: string;
  readonly community: string;
  readonly captured_at: string;
  readonly export_method: string;
  readonly owner: string;
  readonly freshness_threshold_seconds: number;
  readonly entries: ReadonlyArray<RoleSnapshotEntry>;
}

const ENTRY_KEYS = ["discord_user_id", "wallet", "role_ids"] as const;
const SNAPSHOT_KEYS = [
  "source",
  "community",
  "captured_at",
  "export_method",
  "owner",
  "freshness_threshold_seconds",
  "entries",
] as const;

function asObject(v: unknown, path: string): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new RoleSnapshotContractError(path, "expected an object");
  }
  return v as Record<string, unknown>;
}

/** `.strict()` — an unknown key is a 422 from the live service, so it is a rejection here. */
function rejectUnknownKeys(o: Record<string, unknown>, allowed: ReadonlyArray<string>, path: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) {
      throw new RoleSnapshotContractError(path, `unrecognized key '${k}' (the schema is strict)`);
    }
  }
}

/** z.string().min(1) */
function nonEmptyString(v: unknown, path: string): string {
  if (typeof v !== "string") throw new RoleSnapshotContractError(path, "expected a string");
  if (v.length < 1) throw new RoleSnapshotContractError(path, "expected a non-empty string");
  return v;
}

/** z.string().datetime() */
function isoUtcDatetime(v: unknown, path: string): string {
  const s = nonEmptyString(v, path);
  if (!ISO_UTC_RE.test(s) || Number.isNaN(Date.parse(s))) {
    throw new RoleSnapshotContractError(path, `expected an ISO-8601 UTC datetime (e.g. 2026-07-12T00:00:00.000Z), got '${s}'`);
  }
  return s;
}

/** z.number().int().positive() */
function positiveInt(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new RoleSnapshotContractError(path, "expected a finite number");
  }
  if (!Number.isInteger(v)) throw new RoleSnapshotContractError(path, "expected an integer");
  if (v <= 0) throw new RoleSnapshotContractError(path, "expected a positive integer");
  return v;
}

/** RoleSnapshotEntrySchema */
export function parseRoleSnapshotEntry(input: unknown, path = "entry"): RoleSnapshotEntry {
  const o = asObject(input, path);
  rejectUnknownKeys(o, ENTRY_KEYS, path);

  const discord_user_id = nonEmptyString(o.discord_user_id, `${path}.discord_user_id`);

  const role_ids_raw = o.role_ids;
  if (!Array.isArray(role_ids_raw)) {
    throw new RoleSnapshotContractError(`${path}.role_ids`, "expected an array");
  }
  if (role_ids_raw.length < 1) {
    throw new RoleSnapshotContractError(`${path}.role_ids`, "expected at least one role id");
  }
  const role_ids = role_ids_raw.map((r, i) => nonEmptyString(r, `${path}.role_ids[${i}]`));

  // `wallet` is OPTIONAL by design: an unmatched role-holder is FLAGGED (emitted with the
  // key ABSENT), never dropped. Dropping them would understate the drift the audit exists
  // to measure. An explicit `undefined` is tolerated (it JSON-serializes to absent).
  if (o.wallet === undefined) {
    return { discord_user_id, role_ids };
  }
  const wallet = nonEmptyString(o.wallet, `${path}.wallet`);
  if (!WALLET_RE.test(wallet)) {
    throw new RoleSnapshotContractError(`${path}.wallet`, "expected 0x + 40 hex characters");
  }
  return { discord_user_id, wallet, role_ids };
}

/** RoleSnapshotSchema — the full wire shape. Throws {@link RoleSnapshotContractError} on any violation. */
export function parseRoleSnapshot(input: unknown, path = "snapshot"): RoleSnapshot {
  const o = asObject(input, path);
  rejectUnknownKeys(o, SNAPSHOT_KEYS, path);

  const entries_raw = o.entries;
  if (!Array.isArray(entries_raw)) {
    throw new RoleSnapshotContractError(`${path}.entries`, "expected an array");
  }

  return {
    source: nonEmptyString(o.source, `${path}.source`),
    community: nonEmptyString(o.community, `${path}.community`),
    captured_at: isoUtcDatetime(o.captured_at, `${path}.captured_at`),
    export_method: nonEmptyString(o.export_method, `${path}.export_method`),
    owner: nonEmptyString(o.owner, `${path}.owner`),
    freshness_threshold_seconds: positiveInt(
      o.freshness_threshold_seconds,
      `${path}.freshness_threshold_seconds`,
    ),
    entries: entries_raw.map((e, i) => parseRoleSnapshotEntry(e, `${path}.entries[${i}]`)),
  };
}

/** Non-throwing variant. */
export function safeParseRoleSnapshot(
  input: unknown,
): { ok: true; snapshot: RoleSnapshot } | { ok: false; error: RoleSnapshotContractError } {
  try {
    return { ok: true, snapshot: parseRoleSnapshot(input) };
  } catch (e) {
    if (e instanceof RoleSnapshotContractError) return { ok: false, error: e };
    throw e;
  }
}
