/**
 * check-substrate-conformance.ts — the CLI entrypoint for the characters' B7
 * cross-repo substrate compat check (Sprint 405 / Task 405.1, SDD §1.7.1).
 *
 * Run: `bun run conformance:check` (or `bun run scripts/check-substrate-conformance.ts`).
 *
 * This is a THIN SHIM. The conformance ROUTINE lives in
 * `src/shadow/substrate-conformance.ts` (importable from `src/`, so the
 * conformance-guard test can call `runConformance({ lockPath })` DIRECTLY —
 * injecting a temp/missing lockfile via the FUNCTION PARAMETER, never an env
 * var). This entrypoint calls `runConformance()` with NO argument → it ALWAYS
 * verifies the REAL monorepo bun.lock. It reads NO
 * CONFORMANCE_BUN_LOCK_PATH / CONFORMANCE_TEST_MODE env: there is no
 * caller/env-controlled override in the production path (B7 bypass closed,
 * FAGAN iter-4). A non-zero failure count maps to exit 1.
 */
import { runConformance } from "../src/shadow/substrate-conformance.ts";

if (runConformance() > 0) process.exit(1);
