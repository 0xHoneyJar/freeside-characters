/**
 * role-snapshot.contract.test.ts — the EXPORTER side of the cross-repo `/v1/role-snapshot`
 * contract pin (S3 / EXPORT-1).
 *
 * This is the MIRROR of the consumer's test (loa-freeside
 * `packages/services/shadow-audit/src/__tests__/role-snapshot-contract.test.ts`), run against
 * the SAME golden fixture, copied verbatim into `./fixtures/role-snapshot.golden.json`.
 *
 * ── WHAT THIS TEST IS FOR ────────────────────────────────────────────────────
 * It is the DRIFT ALARM. The contract is vendored (see role-snapshot.contract.ts's provenance
 * header) because the canonical zod schema is not importable across the repo boundary. A
 * vendored contract can silently rot. This test makes the rot LOUD: re-copy the fixture from
 * the source repo and, if the wire shape moved, these assertions fail HERE — instead of the
 * live POST failing with an opaque 422 at 3am.
 *
 * Each case pins one rule of the source schema.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  parseRoleSnapshot,
  parseRoleSnapshotEntry,
  RoleSnapshotContractError,
} from "./role-snapshot.contract.ts";

const golden: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/role-snapshot.golden.json", import.meta.url), "utf8"),
);

describe("/v1/role-snapshot cross-repo contract (S3 exporter side)", () => {
  test("the canonical fixture parses against the vendored contract", () => {
    const parsed = parseRoleSnapshot(golden);
    expect(parsed.community).toBe("thj");
    expect(parsed.entries.length).toBe(2);
  });

  test("pins the EXACT top-level wire keys — an add/remove breaks the exporter contract", () => {
    expect(Object.keys(golden as object).sort()).toEqual(
      [
        "captured_at",
        // The gated collection (S5-T1 upstream): thj gates SEVEN collections, each behind its own Discord
        // role, and the store keys snapshots by (community, collection). Without it, exporting HJG1 would
        // OVERWRITE Honeycomb's snapshot and the Honeycomb audit would compute drift against HoneyJar1's
        // role-holders — silently. This pin is the DRIFT ALARM; it fired when upstream added the field.
        "collection",
        "community",
        "entries",
        "export_method",
        "freshness_threshold_seconds",
        "owner",
        "source",
      ].sort(),
    );
  });

  test("pins entry shape: wallet is OPTIONAL (an unmatched role-holder is FLAGGED, never dropped)", () => {
    const entries = (golden as { entries: unknown[] }).entries.map((e) => parseRoleSnapshotEntry(e));
    const matched = entries.find((e) => e.wallet);
    const unmatched = entries.find((e) => !e.wallet);
    expect(matched?.wallet).toMatch(/^0x[0-9a-fA-F]{40}$/);
    // The fixture MUST carry an unmatched entry — that is the contract the exporter must honor.
    expect(unmatched).toBeDefined();
    expect(unmatched?.role_ids.length).toBeGreaterThan(0);
  });

  test("the schema is CLOSED — an extra top-level field is rejected (strict wire shape ⇒ live 422)", () => {
    expect(() => parseRoleSnapshot({ ...(golden as object), unexpected: "nope" })).toThrow(
      RoleSnapshotContractError,
    );
  });

  test("the schema is CLOSED at the ENTRY level too — an extra entry field is rejected", () => {
    expect(() =>
      parseRoleSnapshotEntry({ discord_user_id: "1", role_ids: ["r"], display_name: "leaky" }),
    ).toThrow(RoleSnapshotContractError);
  });

  test("a bad wallet in an entry is rejected (identity fields are shape-checked)", () => {
    expect(() => parseRoleSnapshotEntry({ discord_user_id: "x", wallet: "0xnothex", role_ids: ["h"] })).toThrow(
      RoleSnapshotContractError,
    );
  });

  test("role_ids must carry at least one id", () => {
    expect(() => parseRoleSnapshotEntry({ discord_user_id: "x", role_ids: [] })).toThrow(
      RoleSnapshotContractError,
    );
  });

  test("captured_at must be an ISO-8601 UTC instant (an offset form is rejected)", () => {
    const withOffset = { ...(golden as object), captured_at: "2026-07-10T00:00:00+02:00" };
    expect(() => parseRoleSnapshot(withOffset)).toThrow(RoleSnapshotContractError);
    const notADate = { ...(golden as object), captured_at: "yesterday" };
    expect(() => parseRoleSnapshot(notADate)).toThrow(RoleSnapshotContractError);
  });

  test("freshness_threshold_seconds must be a POSITIVE INTEGER", () => {
    for (const bad of [0, -1, 1.5, "86400"]) {
      expect(() => parseRoleSnapshot({ ...(golden as object), freshness_threshold_seconds: bad })).toThrow(
        RoleSnapshotContractError,
      );
    }
  });
});
