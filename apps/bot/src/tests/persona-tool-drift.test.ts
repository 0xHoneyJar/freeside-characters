/**
 * Persona-tool-drift — drift gap #4 (§4.3c).
 *
 * Parses each apps/character-{id}/persona.md for `mcp__<server>__<tool>`
 * references and asserts:
 *
 *   1. Every (server, tool) tuple referenced in a character's persona
 *      maps to an `mcps[]` entry in that character's character.json
 *      (i.e. the character is ALLOWED to call this MCP).
 *   2. The server is registered (in-bot OR known external).
 *   3. For in-bot servers: the tool name exists in the server's
 *      registered tools (catches `mcp__rosenzu__threshold_change` typo
 *      when server actually registers `threshold`).
 *   4. For external HTTP servers (score, codex): the tool name is in
 *      the test's known-external-tools allowlist. Updating this list
 *      when zerker / gumi ship a new tool is the operator-side
 *      bookkeeping cost — the alternative is a network fetch in tests
 *      (slow, flaky, unsafe in CI).
 *
 * Catches the broken-chat regression class at the LANGUAGE level: when
 * a persona prompts the LLM to call a tool that doesn't exist, the
 * model fabricates a response shape — classic broken-chat case (the
 * 2026-05-01 evidence that motivated this whole session).
 *
 * Reference: kickoff seed §4.3c + §0.5 drift gap #4.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCharacter } from "../character-loader.ts";
import { emojisServerContract } from "@freeside-characters/persona-engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = resolve(__dirname, "../../..");

// ─── canonical tool registries ───────────────────────────────────────

/**
 * In-bot tools — extracted from each MCP's server.ts. Source of truth
 * is the registered server name → registered tool names.
 *
 * `emojis` is sourced from the Effect contract (single-source-of-truth
 * pattern). Other in-bot MCPs are sourced from manual extraction;
 * future migrations (rosenzu, freeside_auth, imagegen → Effect.Schema)
 * will replace these with contract reads.
 */
const IN_BOT_TOOLS: Record<string, ReadonlySet<string>> = {
  emojis: new Set(emojisServerContract.tools.map((t) => t.name)),
  rosenzu: new Set([
    "get_current_district",
    "audit_spatial_threshold",
    "fetch_landmarks",
    "furnish_kansei",
    "threshold",
    "read_room",
  ]),
  freeside_auth: new Set(["resolve_wallet", "resolve_wallets"]),
  imagegen: new Set(["generate", "suggest_style"]),
};

/**
 * External HTTP MCPs — federated tenants on `mcp.0xhoneyjar.xyz`.
 *
 * Update this allowlist when a new tool ships upstream (score-mibera or
 * construct-mibera-codex). Per `gateway-as-registry` doctrine, the
 * upstream MCP is the source of truth — when v0.3 broadcast lands
 * (federation-extended `/.well-known/mcp.json`), we can replace this
 * with a build-time fetch + frozen snapshot.
 */
const EXTERNAL_TOOLS: Record<string, ReadonlySet<string>> = {
  score: new Set([
    // V0.5+ baseline
    "get_zone_digest",
    "get_leaderboard_changes",
    "get_recent_activity",
    "get_wallet_spotlight",
    "get_factor_trends",
    // V1.1.0 catalog tools (zerker PR #71, 2026-04-29)
    "describe_factor",
    "list_factors",
    "describe_dimension",
    "list_dimensions",
  ]),
  codex: new Set([
    "lookup_zone",
    "lookup_archetype",
    "lookup_factor",
    "lookup_grail",
    "lookup_mibera",
    "list_zones",
    "list_archetypes",
    "validate_world_element",
  ]),
};

const ALL_KNOWN_SERVERS = new Set([
  ...Object.keys(IN_BOT_TOOLS),
  ...Object.keys(EXTERNAL_TOOLS),
]);

// ─── persona parsing ─────────────────────────────────────────────────

const TOOL_REF_REGEX = /mcp__([a-z_]+)__([a-z_]+)/g;

interface ToolRef {
  server: string;
  tool: string;
  /** Line number in persona.md (for failure-message helpfulness). */
  line: number;
}

function extractToolRefs(content: string): ToolRef[] {
  const refs: ToolRef[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const m of line.matchAll(TOOL_REF_REGEX)) {
      refs.push({
        server: m[1]!,
        tool: m[2]!,
        line: i + 1,
      });
    }
  }
  return refs;
}

function readPersona(characterId: string): string {
  const personaPath = resolve(
    APPS_DIR,
    `character-${characterId}`,
    "persona.md",
  );
  return readFileSync(personaPath, "utf8");
}

// ─── tests ───────────────────────────────────────────────────────────

const CHARACTERS = ["ruggy", "satoshi"] as const;

for (const characterId of CHARACTERS) {
  describe(`${characterId}/persona.md · tool-name drift`, () => {
    const persona = readPersona(characterId);
    const refs = extractToolRefs(persona);
    const character = loadCharacter(characterId);
    const allowedMcps = new Set(character.mcps ?? []);

    test(`extracts at least one mcp__ reference (smoke: persona is wired)`, () => {
      expect(refs.length).toBeGreaterThan(0);
    });

    test(`every referenced server is in character.mcps[]`, () => {
      const referencedServers = new Set(refs.map((r) => r.server));
      for (const server of referencedServers) {
        if (!allowedMcps.has(server)) {
          throw new Error(
            `${characterId}/persona.md references mcp__${server}__* but ` +
              `character.json mcps[] does not list "${server}". ` +
              `Either add to mcps[] or remove the persona reference.`,
          );
        }
      }
    });

    test(`every referenced server is a known MCP (in-bot or external)`, () => {
      const referencedServers = new Set(refs.map((r) => r.server));
      for (const server of referencedServers) {
        if (!ALL_KNOWN_SERVERS.has(server)) {
          throw new Error(
            `${characterId}/persona.md references mcp__${server}__* but ` +
              `"${server}" is not a registered in-bot MCP nor a known ` +
              `external MCP. Update IN_BOT_TOOLS or EXTERNAL_TOOLS in ` +
              `apps/bot/src/tests/persona-tool-drift.test.ts if this is ` +
              `a new MCP, otherwise fix the typo in persona.md.`,
          );
        }
      }
    });

    test(`every referenced tool exists in its server's tool registry`, () => {
      const failures: string[] = [];
      for (const ref of refs) {
        const inBot = IN_BOT_TOOLS[ref.server];
        const external = EXTERNAL_TOOLS[ref.server];
        const registry = inBot ?? external;
        if (!registry) continue; // server-known check handled by previous test
        if (!registry.has(ref.tool)) {
          failures.push(
            `  L${ref.line}: mcp__${ref.server}__${ref.tool} — "${ref.tool}" ` +
              `is not in the ${inBot ? "in-bot" : "external"} ${ref.server} ` +
              `tool registry. Known tools: ${[...registry].sort().join(", ")}`,
          );
        }
      }
      if (failures.length > 0) {
        throw new Error(
          `${characterId}/persona.md tool-name drift detected:\n` +
            failures.join("\n"),
        );
      }
    });
  });
}

// ─── cross-character ─────────────────────────────────────────────────

describe("cross-character · all in-bot MCPs have at least one persona reference", () => {
  test("every in-bot MCP that some character can access is referenced by that character", () => {
    // Sanity check: if an MCP is wired but no persona prompts the LLM
    // to use it, the MCP is dead weight. Inverse drift — registration
    // promises capability that personas never invoke.
    const allRefs = new Map<string, Set<string>>();
    for (const characterId of CHARACTERS) {
      const refs = extractToolRefs(readPersona(characterId));
      const character = loadCharacter(characterId);
      for (const server of character.mcps ?? []) {
        const characterRefs = new Set(
          refs.filter((r) => r.server === server).map((r) => r.tool),
        );
        const existing = allRefs.get(server) ?? new Set<string>();
        for (const t of characterRefs) existing.add(t);
        allRefs.set(server, existing);
      }
    }
    // Each in-bot server (that's character-allowlisted somewhere) should
    // have at least one tool referenced. This catches the inverse drift:
    // MCP wired but never prompted.
    for (const [server, tools] of allRefs.entries()) {
      if (server in IN_BOT_TOOLS && tools.size === 0) {
        // Document the drift but don't fail — some MCPs (freeside_auth,
        // imagegen) are wired for runtime use without explicit persona
        // prompts (e.g., satoshi's imagegen is dispatched via slash
        // command, not LLM tool-call). Warn instead of fail.
        console.warn(
          `[persona-tool-drift] inverse-drift candidate: server "${server}" ` +
            `is in some character's mcps[] but no persona references any of ` +
            `its tools. Either prompt the LLM to use it or remove from mcps[].`,
        );
      }
    }
    expect(allRefs.size).toBeGreaterThan(0);
  });
});
