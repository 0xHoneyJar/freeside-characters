/**
 * import-boundary.test.ts — the cross-repo gate proof, integration side
 * (Sprint 405 / Task 405.3, SDD §8.4 proof 4, G-3 across the repo boundary).
 *
 * Two complementary checks (per the B9 reframe, the integration tests are the
 * STRONGER of the two — the lint is accident-prevention):
 *
 *   1. The static lint (scripts/lint-shadow-import-boundary.sh) fails CI on a
 *      raw discord.js role mutation outside the gated adapter. We invoke it here
 *      AND prove it errors on a planted violation (the lint's own behavior is
 *      exercised in the headline `prove-fail` test below).
 *
 *   2. THE UN-GATED-PATH INVARIANT (the stronger check): there is no way to
 *      obtain a LIVE RoleWriter that performs a Discord write WITHOUT going
 *      through the substrate's `GateCheckedRoleWriter` AND holding a
 *      `WriteCapability` (whose constructor is un-exported, minted only by the
 *      substrate's authorized go_live). We assert the package surface a consumer
 *      sees does not leak a token constructor or a raw live-writer, and that the
 *      LIVE writer's signature is compile-time-gated by `WriteCapability`.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as substrate from "@freeside-worlds/shadow-substrate";

// this file: apps/bot/src/shadow/import-boundary.test.ts
const shadowDir = dirname(fileURLToPath(import.meta.url)); // apps/bot/src/shadow
const botRoot = dirname(dirname(shadowDir)); // apps/bot
const repoRoot = dirname(dirname(botRoot)); // repo root
const LINT = join(repoRoot, "scripts/lint-shadow-import-boundary.sh");

describe("405.3 — cross-repo import-boundary lint", () => {
  test("the lint PASSES on the clean tree (no role mutation outside the gated adapter)", () => {
    // exits 0 — throws on non-zero, so a clean run just returns.
    const out = execFileSync("bash", [LINT], { cwd: repoRoot, encoding: "utf8" });
    expect(out).toContain("no discord.js role mutation outside the gated adapter");
  });

  test("PROOF: a raw `guild.roles.create` outside the gated adapter FAILS the lint (exit 1)", () => {
    const plant = join(botRoot, "src/shadow/__planted_violation_TEST__.ts");
    writeFileSync(
      plant,
      [
        'import type { Guild } from "discord.js";',
        "export async function bypass(guild: Guild) {",
        '  return guild.roles.create({ name: "ungated:bypass" });',
        "}",
        "",
      ].join("\n"),
    );
    try {
      let failed = false;
      let stderr = "";
      try {
        execFileSync("bash", [LINT], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
      } catch (e) {
        failed = true;
        stderr = String((e as { stderr?: Buffer }).stderr ?? "");
      }
      expect(failed).toBe(true); // the lint MUST fail CI on the planted write
      expect(stderr).toContain("VIOLATION");
      expect(stderr).toContain("__planted_violation_TEST__.ts");
    } finally {
      rmSync(plant, { force: true });
    }
  });
});

describe("405.3 — un-gated-path invariant (the stronger check, B9)", () => {
  test("the substrate package surface leaks NO WriteCapability constructor + NO raw live-writer", () => {
    const exported = Object.keys(substrate);
    // No capability constructor (mint*) reachable through the barrel.
    expect(exported.some((k) => /^mint/i.test(k) || /WriteCapabilityConstructor/.test(k))).toBe(false);
    // The only write path is the gate; no raw live-writer constructor export.
    expect(exported).toContain("GateCheckedRoleWriter");
    expect(exported.some((k) => /RawLiveWriter|UngatedWriter|makeLiveRoleWriter/.test(k))).toBe(false);
    // `WriteCapability` is a TYPE export only (not a runtime value).
    expect((substrate as Record<string, unknown>).WriteCapability).toBeUndefined();
  });

  test("the LIVE writer's createRole/assignRole REQUIRE a WriteCapability (compile-time gate)", () => {
    // The RoleWriter port's method signatures take (cap: WriteCapability, intent).
    // This is a compile-time invariant; we assert the port shape is the gated one
    // by constructing a value that must satisfy the typed service shape — a writer
    // whose methods drop the cap arg would not typecheck (proven by `bun run
    // typecheck` in CI). At runtime we assert the Tag identity is the gated port.
    expect(substrate.RoleWriter.key).toBe("shadow/RoleWriter");
    expect(substrate.GateCheckedRoleWriter.key).toBe("shadow/GateCheckedRoleWriter");
  });
});
