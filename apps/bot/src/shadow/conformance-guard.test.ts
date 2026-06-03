/**
 * conformance-guard.test.ts — FAGAN proof that the B7 substrate conformance
 * check (scripts/check-substrate-conformance.ts) FAILS DETERMINISTICALLY
 * (returns failures > 0 + emits `[FAIL]`) on a missing/mis-pathed bun.lock,
 * rather than throwing an unguarded ENOENT stack.
 *
 * FAGAN iter-4: the lockfile is injected via the FUNCTION PARAMETER
 * (`runConformance({ lockPath })`), NOT an env var. There is no
 * caller/env-controlled override in the production path, so the test exercises
 * the missing-lockfile + deterministic-FAIL guards by passing a bogus
 * `lockPath` directly to the exported routine.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runConformance } from "./substrate-conformance.ts";

describe("405.1 — substrate conformance lockfile guard (B7)", () => {
  // Capture console output so we can assert on the deterministic [FAIL] line
  // without it spamming the test runner's stdout.
  const logged: string[] = [];
  const origLog = console.log;
  const origError = console.error;

  beforeEach(() => {
    logged.length = 0;
    console.log = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
  });

  test("a missing bun.lock yields a deterministic [FAIL] (no thrown ENOENT) and a non-zero failure count", () => {
    let failures = -1;
    let threw: unknown;
    try {
      // Inject the bogus lockfile path via the PARAMETER — no env, no subprocess.
      failures = runConformance({ lockPath: "/nonexistent/__no_such_bun__.lock" });
    } catch (e) {
      threw = e;
    }

    // The missing-lockfile guard is a deterministic conformance FAILURE, NOT a
    // thrown ENOENT stack.
    expect(threw).toBeUndefined();
    expect(failures).toBeGreaterThan(0);

    const out = logged.join("\n");
    expect(out).toContain("[FAIL] bun.lock missing");
    expect(out).not.toMatch(/ENOENT|Uncaught|no such file or directory/);
  });

  test("the default lockPath verifies the REAL monorepo bun.lock (no caller/env override exists)", () => {
    // Called with NO argument — exactly the production CLI path. The real
    // bun.lock exists and pins the canonical substrate SHA, so the missing-
    // lockfile FAIL must NOT fire. (A non-zero count here would mean a genuine
    // pin/shape drift, not the bypass we closed.)
    const failures = runConformance();
    const out = logged.join("\n");
    expect(out).not.toContain("[FAIL] bun.lock missing");
    expect(failures).toBe(0);
  });
});
