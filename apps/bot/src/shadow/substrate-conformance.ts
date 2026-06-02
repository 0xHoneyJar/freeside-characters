/**
 * substrate-conformance.ts — the characters' B7 cross-repo substrate compat
 * check ROUTINE (Sprint 405 / Task 405.1, SDD §1.7.1).
 *
 * The CLI entrypoint is `scripts/check-substrate-conformance.ts`, a thin shim
 * that imports `runConformance` from here and runs it against the REAL monorepo
 * bun.lock. This module is importable from `src/` (under the bot's tsc rootDir)
 * so the test can call `runConformance({ lockPath })` DIRECTLY — injecting a
 * temp/missing lockfile via the FUNCTION PARAMETER, never an env var. There is
 * NO caller/env-controlled override in the production path (B7 bypass closed,
 * FAGAN iter-4): the CLI always verifies the real bun.lock.
 *
 * The substrate (`@freeside-worlds/shadow-substrate`) is the security boundary,
 * consumed git-source / SHA-pinned by THREE repos (worlds, characters,
 * dashboard). If they pin DIFFERENT SHAs they could silently disagree on the
 * `roleMapVersionHash` algorithm or a schema shape — a dangerous skew on the
 * "SHADOW ⇒ zero writes" boundary. `runConformance` returns a non-zero failure
 * count on ANY mismatch (the CLI shim maps that to exit 1), asserting four
 * things (mirrors the dashboard's check-substrate-conformance.ts, adapted for
 * bun.lock):
 *
 *   1. The substrate SHA pinned in `bun.lock` == the cycle-canonical SHA recorded
 *      in loa-freeside's `substrate-sha.lock` (B7 single-SHA contract).
 *   2. The substrate's package.json `@0xhoneyjar/events` SHA == the canonical
 *      `events_pin` (the substrate's only external dep — drift changes the hash).
 *   3. The SHA-pinned substrate's `roleMapVersionHash(CANONICAL_VERSION_HASH_INPUT)`
 *      reproduces `CANONICAL_VERSION_HASH` byte-for-byte (cross-producer
 *      determinism — proves THIS consumer computes the same hash worlds does).
 *   4. The REAL exported `@effect/schema` schemas (`Discrepancy` + nested role
 *      elements, `RoleCountProjection`, `AuthzContext` + nested) carry key sets
 *      SET-EQUAL to the substrate's own `FROZEN_SHAPES` manifest — a render-model
 *      / types shape skew is caught here before deploy.
 *
 * It imports the fixture + the real schemas FROM THE SHA-PINNED SUBSTRATE, so it
 * is asserting against exactly the bytes the bot's build will consume.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  roleMapVersionHash,
  Discrepancy,
  BeforeRole,
  AfterRole,
  PreexistingRole,
  LatentQualified,
  RoleCountProjection,
  AuthzContext,
  RosterVersion,
} from "@freeside-worlds/shadow-substrate";
import type { WriteCapability } from "@freeside-worlds/shadow-substrate";
import {
  CANONICAL_VERSION_HASH_INPUT,
  CANONICAL_VERSION_HASH,
  FROZEN_SHAPES,
} from "@freeside-worlds/shadow-substrate/conformance";

const TAG = "[substrate-conformance]";

// The cycle-canonical pins (substrate-sha.lock). Inlined fallback; the env-pointed
// substrate-sha.lock (if present) is the authority and is asserted to match.
const CANONICAL_SUBSTRATE_SHA = "26d11b78e6f0c2ce81cbd1fc24088157cea74e53";
const CANONICAL_EVENTS_PIN = "68f5a89cb02c6b3ddf5ab14a1d65753bc02bd9fe";

// this file lives at apps/bot/src/shadow/ → botRoot is THREE dirs up from the
// file (shadow → src → bot), monorepo root is two more.
const shadowDir = dirname(fileURLToPath(import.meta.url));
const botRoot = dirname(dirname(shadowDir));
const monorepoRoot = dirname(dirname(botRoot));

/** The real monorepo bun.lock — the production lockfile this check verifies. */
const REAL_BUN_LOCK = join(monorepoRoot, "bun.lock");

/** Options for {@link runConformance}. Test-injectable inputs are FUNCTION
 *  PARAMETERS — there is NO env-controlled override in the production path. */
export interface ConformanceOptions {
  /**
   * Path to the bun.lock to verify the substrate pin against. Defaults to the
   * REAL monorepo bun.lock. Tests inject a temp/missing path HERE (via the
   * parameter, not an env var) to exercise the deterministic-FAIL + missing-
   * lockfile guards. The CLI entrypoint calls runConformance() with no argument,
   * so production ALWAYS verifies the real bun.lock — no caller/env can redirect
   * the B7 integrity check at an arbitrary lockfile.
   */
  readonly lockPath?: string;
}

type WriteCapabilityDataKey = Extract<keyof WriteCapability, string>;

/**
 * Run the full B7 substrate conformance suite. Pure of process state: it reads
 * the lockfile at `lockPath` (default: the real monorepo bun.lock) and the
 * SHA-pinned substrate, asserts the four invariants, and returns the failure
 * count. Reads NO environment variables that control the lockfile path. The CLI
 * shim maps a non-zero return to `process.exit(1)`.
 *
 * @returns the number of conformance assertions that FAILED (0 == clean).
 */
export function runConformance({ lockPath = REAL_BUN_LOCK }: ConformanceOptions = {}): number {
  let failures = 0;
  const ok = (label: string) => console.log(`${TAG} [OK] ${label}`);
  const fail = (label: string, detail: string) => {
    console.error(`${TAG} [FAIL] ${label}: ${detail}`);
    failures += 1;
  };

  // ── 0. read the canonical SHAs from substrate-sha.lock if reachable ───────
  (() => {
    const candidates = [
      process.env.LOA_FREESIDE_DIR &&
        join(process.env.LOA_FREESIDE_DIR, "grimoires/loa/cycles/shadow-onboarding-substrate/substrate-sha.lock"),
      join(monorepoRoot, "..", "loa-freeside", "grimoires/loa/cycles/shadow-onboarding-substrate/substrate-sha.lock"),
    ].filter(Boolean) as string[];
    const shaLockPath = candidates.find((p) => existsSync(p));
    if (!shaLockPath) {
      console.log(`${TAG} [note] substrate-sha.lock not reachable locally — asserting against inlined canonical pins`);
      return;
    }
    const lock = readFileSync(shaLockPath, "utf8");
    const sha = lock.match(/^canonical_substrate_sha:\s*([0-9a-f]{40})/m)?.[1] ?? "";
    const ev = lock.match(/events_pin:\s*"?github:[^#]+#([0-9a-f]{40})"?/m)?.[1] ?? "";
    if (sha && sha !== CANONICAL_SUBSTRATE_SHA) {
      fail("substrate-sha.lock drift", `lock says ${sha}, this check has ${CANONICAL_SUBSTRATE_SHA} — re-sync the inlined pin (lockstep rollout)`);
    } else if (sha) {
      ok(`substrate-sha.lock canonical SHA matches inlined (${sha.slice(0, 12)}…)`);
    }
    if (ev && ev !== CANONICAL_EVENTS_PIN) {
      fail("substrate-sha.lock events_pin drift", `lock says ${ev}, this check has ${CANONICAL_EVENTS_PIN}`);
    }
  })();

  // ── 1. bun.lock substrate pin == canonical ──────────────────────────────
  (() => {
    if (!existsSync(lockPath)) {
      // deterministic FAIL (not a thrown stack) — a missing/mis-pathed lockfile is
      // a conformance failure, not a crash. Surfaces as [FAIL] + exit 1.
      fail("bun.lock missing", `expected at ${lockPath} — cannot verify the substrate pin`);
      return;
    }
    const lock = readFileSync(lockPath, "utf8");
    // SCOPE the SHA match to the `@freeside-worlds/shadow-substrate` dependency
    // entry (the line is `"@freeside-worlds/shadow-substrate": "github:…#<sha>"`),
    // so an unrelated package that also pins a freeside-worlds SHA cannot produce a
    // false pass. The `[^"]*` allows the resolution-table form on either side.
    const subSha =
      lock.match(/@freeside-worlds\/shadow-substrate"[^#]*freeside-worlds#([0-9a-f]{40})/)?.[1] ?? "";
    if (subSha === CANONICAL_SUBSTRATE_SHA) {
      ok(`bun.lock substrate pin == canonical (${subSha.slice(0, 12)}…)`);
    } else {
      fail("substrate lockfile pin skew", `bun.lock @freeside-worlds/shadow-substrate pin is "${subSha}", canonical is ${CANONICAL_SUBSTRATE_SHA} — run lockstep rollout (substrate-sha.lock)`);
    }
  })();

  // ── 2. the substrate's OWN events pin == canonical ───────────────────────
  // (read from the SHA-pinned substrate's package.json — drift changes the hash)
  (() => {
    const candidates = [
      join(botRoot, "node_modules/@freeside-worlds/shadow-substrate/package.json"),
      join(monorepoRoot, "node_modules/@freeside-worlds/shadow-substrate/package.json"),
    ];
    const pkgPath = candidates.find((p) => existsSync(p));
    if (!pkgPath) {
      fail("substrate package.json", `not found at any of: ${candidates.join(", ")}`);
      return;
    }
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string> };
    const ev = pkg.dependencies?.["@0xhoneyjar/events"] ?? "";
    const evSha = ev.match(/#([0-9a-f]{40})$/)?.[1] ?? "";
    if (evSha === CANONICAL_EVENTS_PIN) {
      ok(`substrate @0xhoneyjar/events pin == canonical (${evSha.slice(0, 12)}…)`);
    } else {
      fail("substrate events pin skew", `substrate package.json has "${evSha}", canonical is ${CANONICAL_EVENTS_PIN}`);
    }
  })();

  // ── 3. cross-producer determinism: the frozen hash reproduces ────────────
  {
    const computed = roleMapVersionHash(CANONICAL_VERSION_HASH_INPUT);
    if (computed === CANONICAL_VERSION_HASH) {
      ok(`roleMapVersionHash reproduces canonical hash (${computed.slice(0, 12)}…)`);
    } else {
      fail("roleMapVersionHash drift", `expected ${CANONICAL_VERSION_HASH} got ${computed} — a SHA bump changed the hash algorithm; re-freeze + lockstep rollout`);
    }
  }

  // ── 4. frozen shapes: the REAL schemas carry exactly the frozen keys ─────
  const structKeys = (schema: unknown): string[] => {
    const fields = (schema as { fields?: Record<string, unknown> } | undefined)?.fields;
    return fields ? Object.keys(fields) : [];
  };
  const nestedStruct = (parent: unknown, key: string): unknown =>
    (parent as { fields?: Record<string, unknown> } | undefined)?.fields?.[key];
  const assertSetEqual = (label: string, schemaKeys: readonly string[], frozenKeys: readonly string[]): void => {
    const schemaSet = new Set(schemaKeys);
    const frozenSet = new Set(frozenKeys);
    const missingFromSchema = [...frozenSet].filter((k) => !schemaSet.has(k));
    const missingFromFrozen = [...schemaSet].filter((k) => !frozenSet.has(k));
    if (missingFromSchema.length === 0 && missingFromFrozen.length === 0) {
      ok(`${label} schema keys ≡ frozen manifest (${schemaKeys.length} keys)`);
    } else {
      fail(
        `${label} schema-shape skew`,
        `frozen-but-absent-from-schema=[${missingFromSchema.join(", ")}] schema-but-not-frozen=[${missingFromFrozen.join(", ")}]`,
      );
    }
  };

  const dShape = FROZEN_SHAPES.Discrepancy;
  assertSetEqual("Discrepancy.top_level", structKeys(Discrepancy), dShape.top_level);
  assertSetEqual("Discrepancy.before_role", structKeys(BeforeRole), dShape.before_role);
  assertSetEqual("Discrepancy.after_role", structKeys(AfterRole), dShape.after_role);
  assertSetEqual("Discrepancy.preexisting_role", structKeys(PreexistingRole), dShape.preexisting_role);
  assertSetEqual("Discrepancy.latent_qualified", structKeys(LatentQualified), dShape.latent_qualified);
  assertSetEqual("Discrepancy.role_count", structKeys(RoleCountProjection), dShape.role_count);

  const aShape = FROZEN_SHAPES.AuthzContext;
  assertSetEqual("AuthzContext.top_level", structKeys(AuthzContext), aShape.top_level);
  assertSetEqual("AuthzContext.token_metadata", structKeys(nestedStruct(AuthzContext, "token_metadata")), aShape.token_metadata);
  assertSetEqual("AuthzContext.roster_version", structKeys(RosterVersion), aShape.roster_version);

  // WriteCapability is a TS branded `export type`. Derive its data keys at compile
  // time (a full mapped type, so adding a field is a tsc error here) + assert the
  // runtime key set.
  const writeCapSample: { readonly [K in WriteCapabilityDataKey]: WriteCapability[K] } = {
    report_hash: "0".repeat(64) as WriteCapability["report_hash"],
    transition_version: 1,
    authz_decision_id: "authz-decision-conformance-sample",
  };
  assertSetEqual("WriteCapability.data_keys", Object.keys(writeCapSample), FROZEN_SHAPES.WriteCapability.data_keys);

  if (failures > 0) {
    console.error(`${TAG} ${failures} conformance assertion(s) FAILED`);
  } else {
    console.log(`${TAG} all conformance assertions passed`);
  }
  return failures;
}
