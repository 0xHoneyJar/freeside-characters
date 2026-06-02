/**
 * conformance-guard.test.ts — FAGAN iter-2 proof that the B7 substrate
 * conformance check (scripts/check-substrate-conformance.ts) FAILS DETERMINISTICALLY
 * (exit 1 + `[FAIL]`) on a missing/mis-pathed bun.lock, rather than throwing an
 * unguarded ENOENT stack.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const shadowDir = dirname(fileURLToPath(import.meta.url)); // apps/bot/src/shadow
const botRoot = dirname(dirname(shadowDir)); // apps/bot
const SCRIPT = join(botRoot, "scripts/check-substrate-conformance.ts");

describe("405.1 — substrate conformance lockfile guard (B7)", () => {
  test("a missing bun.lock yields a deterministic [FAIL] + exit 1 (no thrown ENOENT stack)", () => {
    let failed = false;
    let stdout = "";
    let stderr = "";
    try {
      execFileSync("bun", ["run", SCRIPT], {
        cwd: botRoot,
        encoding: "utf8",
        stdio: "pipe",
        // FAGAN iter-3: the lockfile override is gated behind CONFORMANCE_TEST_MODE
        // — set BOTH so the override is honored and the missing-lockfile proof
        // still exercises the deterministic-FAIL guard.
        env: {
          ...process.env,
          CONFORMANCE_TEST_MODE: "1",
          CONFORMANCE_BUN_LOCK_PATH: "/nonexistent/__no_such_bun__.lock",
        },
      });
    } catch (e) {
      failed = true;
      stdout = String((e as { stdout?: Buffer }).stdout ?? "");
      stderr = String((e as { stderr?: Buffer }).stderr ?? "");
    }
    expect(failed).toBe(true); // exit 1
    const out = stdout + stderr;
    // deterministic conformance failure, NOT an unhandled throw.
    expect(out).toContain("[FAIL] bun.lock missing");
    expect(out).not.toMatch(/ENOENT|Uncaught|no such file or directory/);
  }, 30_000);

  test("the lockfile override is IGNORED without CONFORMANCE_TEST_MODE (B7 bypass closed) — uses the real bun.lock", () => {
    // Override env set but TEST_MODE absent → the script must IGNORE the override,
    // use the real monorepo bun.lock (which exists), and warn on stderr. The
    // "bun.lock missing" FAIL must NOT appear (it would mean the bogus override
    // path was honored — the bypass we closed). spawnSync captures stdout+stderr
    // regardless of exit code (the script exits 0 when the real lockfile passes).
    const r = spawnSync("bun", ["run", SCRIPT], {
      cwd: botRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CONFORMANCE_TEST_MODE: "",
        CONFORMANCE_BUN_LOCK_PATH: "/nonexistent/__no_such_bun__.lock",
      },
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    // the bogus override was NOT honored — the real bun.lock was read, so the
    // missing-lockfile FAIL never fires.
    expect(out).not.toContain("[FAIL] bun.lock missing");
    // the attempt is surfaced (production-safe visibility).
    expect(out).toContain("CONFORMANCE_BUN_LOCK_PATH is set but CONFORMANCE_TEST_MODE");
  }, 30_000);
});
