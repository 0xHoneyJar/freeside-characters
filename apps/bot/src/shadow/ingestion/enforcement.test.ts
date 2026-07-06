/**
 * enforcement.test.ts — the load-bearing shadow-first invariant (cycle-010 S1.6;
 * SDD §4.4/§6, NG2). The ingestion layer is READ-ONLY: it must NEVER touch the
 * role-mutation surface. This is enforced MECHANICALLY by asserting no source
 * file in the ingestion module references a role-writer / role-mutation symbol.
 *
 * Mirrors the repo's existing cross-repo import-boundary lint posture, scoped to
 * the new module. Network-free.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// symbols that would indicate a role MUTATION on the ingestion path
const FORBIDDEN = [
  "RoleWriter",
  "GateCheckedRoleWriter",
  "guild.roles.create",
  "guild.roles.add",
  "roles.add(",
  "roles.remove(",
];

describe("shadow-first enforcement (NG2)", () => {
  test("no ingestion source file references a role-mutation symbol", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(HERE)) {
      if (!file.endsWith(".ts")) continue;
      if (file.endsWith(".test.ts")) continue; // tests may name the symbols
      const body = readFileSync(join(HERE, file), "utf8");
      for (const sym of FORBIDDEN) {
        if (body.includes(sym)) offenders.push(`${file}: ${sym}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no ingestion source file imports persona-engine voice (NG1 voiceless)", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(HERE)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const body = readFileSync(join(HERE, file), "utf8");
      // voice composition lives in persona-engine compose/orchestrator; ingestion must not import it
      if (/from\s+["'][^"']*persona-engine\/(compose|orchestrator)/.test(body)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
