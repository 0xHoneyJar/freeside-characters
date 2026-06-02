/**
 * conformance-guard.test.ts — FAGAN iter-2 proof that the B7 substrate
 * conformance check (scripts/check-substrate-conformance.ts) FAILS DETERMINISTICALLY
 * (exit 1 + `[FAIL]`) on a missing/mis-pathed bun.lock, rather than throwing an
 * unguarded ENOENT stack.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
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
        env: { ...process.env, CONFORMANCE_BUN_LOCK_PATH: "/nonexistent/__no_such_bun__.lock" },
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
});
