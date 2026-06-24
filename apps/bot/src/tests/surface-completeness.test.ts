/**
 * Surface-completeness — drift gaps #2 + #5 (§4.3b).
 *
 * Two assertions, two surfaces:
 *
 *   1. Digest path · "every promised tool is equipped":
 *      For each character.json's `mcps[]`, with environment fully
 *      configured, the orchestrator's `buildMcpServers` actually
 *      registers a server for that name. Catches typos in
 *      `character.json` AND missed env-var bindings.
 *
 *   2. Chat-mode matrix · "the routing matrix matches the manifest":
 *      `shouldUseOrchestrator` returns `true` for the CHAT_MODE ×
 *      LLM_PROVIDER combinations that are SUPPOSED to wire tools, and
 *      `false` for the ones explicitly defined as no-tools (naive +
 *      stub/freeside). This is the test that catches the broken-chat
 *      regression class — the LLM should never be promised tools the
 *      surface won't deliver.
 *
 * The naive path being no-tools is INTENTIONAL design (revert hatch +
 * fallback for non-SDK providers). The bug is when persona prompts
 * reference tool names AND the resolved chat path is naive. Today
 * persona.md tool references coexist with the orchestrator path; this
 * test pins the matrix so adding a new provider can't silently land
 * users in a "promised tools, naive surface" cell.
 *
 * Reference: kickoff seed §4.3b + §0.5 drift gaps #2/#5.
 */

import { describe, test, expect } from "bun:test";
import {
  buildMcpServers,
  buildAllowedTools,
  shouldUseOrchestrator,
  resolveChatProvider,
  type Config,
} from "@freeside-characters/persona-engine";
import { loadCharacter } from "../character-loader.ts";

// ─── test fixtures ───────────────────────────────────────────────────

/**
 * "Full env" — every env-gated MCP is configured. Tests against this
 * config verify that NO character.mcps name is missing from the
 * registered server map. Drift surfaces as "character expects 'codex'
 * but CODEX_MCP_URL isn't a recognized config key" — which would be a
 * config-naming bug.
 */
function fullEnvConfig(overrides: Partial<Config> = {}): Config {
  return {
    STUB_MODE: false,
    LLM_PROVIDER: "anthropic",
    SCORE_API_URL: "https://score-api-production.up.railway.app",
    SCORE_API_KEY: undefined,
    MCP_KEY: "test-mcp-key",
    SCORE_BEARER: undefined,
    CODEX_MCP_URL: "https://codex.example.com",
    FREESIDE_BASE_URL: "https://api.freeside.0xhoneyjar.xyz",
    FREESIDE_API_KEY: undefined,
    FREESIDE_AGENT_MODEL: "reasoning",
    AWS_REGION: "us-east-1",
    AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
    BEDROCK_API_KEY: undefined,
    BEDROCK_TEXT_REGION: "us-west-2",
    BEDROCK_TEXT_MODEL_ID: "us.anthropic.claude-opus-4-7",
    BEDROCK_STABILITY_MODEL_ID: "stability.stable-image-ultra-v1:1",
    BEDROCK_IMAGE_REGION: "us-east-1",
    BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: "us-west-2",
    BEDROCK_IMAGE_DEFAULT_ACTION: "text-to-image",
    ANTHROPIC_API_KEY: "sk-ant-test",
    ANTHROPIC_MODEL: "claude-opus-4-7",
    CHAT_MODE: "auto",
    DIGEST_CADENCE: "weekly",
    DIGEST_DAY: "sunday",
    DIGEST_HOUR_UTC: 0,
    POP_IN_ENABLED: false,
    POP_IN_INTERVAL_HOURS: 6,
    POP_IN_PROBABILITY: 0.1,
    WEAVER_ENABLED: false,
    WEAVER_DAY: "wednesday",
    WEAVER_HOUR_UTC: 12,
    WEAVER_PRIMARY_ZONE: "stonehenge",
    INTERACTIONS_PORT: 3001,
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    MIX: false,
    ...overrides,
  } as Config;
}

// ═════════════════════════════════════════════════════════════════════
// Digest path · per-character mcps[] resolution
// ═════════════════════════════════════════════════════════════════════

describe("digest path · per-character mcps[] surface", () => {
  test("ruggy: every declared mcp name resolves to a registered server (full env)", () => {
    const ruggy = loadCharacter("ruggy");
    const servers = buildMcpServers(fullEnvConfig());
    expect(ruggy.mcps).toBeDefined();
    for (const name of ruggy.mcps ?? []) {
      expect(Object.keys(servers)).toContain(name);
    }
  });

  test("satoshi: every declared mcp name resolves to a registered server (full env)", () => {
    const satoshi = loadCharacter("satoshi");
    const servers = buildMcpServers(fullEnvConfig());
    expect(satoshi.mcps).toBeDefined();
    for (const name of satoshi.mcps ?? []) {
      expect(Object.keys(servers)).toContain(name);
    }
  });

  test("buildAllowedTools per character produces non-empty tool whitelist", () => {
    const ruggy = loadCharacter("ruggy");
    const servers = buildMcpServers(fullEnvConfig());
    const allowed = buildAllowedTools(servers, ruggy.mcps);
    expect(allowed.length).toBe(ruggy.mcps?.length ?? 0);
    // Every entry is `mcp__<server>__*`
    for (const tool of allowed) {
      expect(tool).toMatch(/^mcp__[a-z_]+__\*$/);
    }
  });

  test("env-gated MCP unconfigured · character mcps silently dropped (operational drift)", () => {
    // ruggy declares 'codex' + 'score'. Without CODEX_MCP_URL + MCP_KEY,
    // those servers don't register. The dropped names are filtered from
    // allowedTools — this is INTENTIONAL (env-gated registration), but the
    // test pins the behavior so a future change that flips this default
    // surfaces here.
    const ruggy = loadCharacter("ruggy");
    const sparseConfig = fullEnvConfig({
      MCP_KEY: undefined,
      CODEX_MCP_URL: undefined,
    });
    const servers = buildMcpServers(sparseConfig);
    expect(Object.keys(servers)).not.toContain("score");
    expect(Object.keys(servers)).not.toContain("codex");
    const allowed = buildAllowedTools(servers, ruggy.mcps);
    // ruggy's allowlist intersects with registered (rosenzu, freeside_auth, emojis only).
    expect(allowed.length).toBeLessThan(ruggy.mcps?.length ?? Infinity);
    expect(allowed).toContain("mcp__emojis__*");
    expect(allowed).toContain("mcp__rosenzu__*");
    expect(allowed).toContain("mcp__freeside_auth__*");
  });
});

// ═════════════════════════════════════════════════════════════════════
// Chat-mode matrix · CHAT_MODE × LLM_PROVIDER × tool-availability
// ═════════════════════════════════════════════════════════════════════

describe("chat-mode matrix · shouldUseOrchestrator", () => {
  // ── auto: orchestrator when provider is SDK-eligible (anthropic OR bedrock)

  test("auto + anthropic → orchestrator (tools wired)", () => {
    const config = fullEnvConfig({ CHAT_MODE: "auto", LLM_PROVIDER: "anthropic" });
    expect(shouldUseOrchestrator(config)).toBe(true);
  });

  test("auto + bedrock → orchestrator (tools wired · V0.11.1)", () => {
    const config = fullEnvConfig({ CHAT_MODE: "auto", LLM_PROVIDER: "bedrock" });
    expect(shouldUseOrchestrator(config)).toBe(true);
  });

  test("auto + stub → naive (no tools · stub doesn't go through SDK)", () => {
    const config = fullEnvConfig({ CHAT_MODE: "auto", LLM_PROVIDER: "stub" });
    expect(shouldUseOrchestrator(config)).toBe(false);
  });

  test("auto + freeside → naive (no tools · freeside-gateway path)", () => {
    const config = fullEnvConfig({
      CHAT_MODE: "auto",
      LLM_PROVIDER: "freeside",
      FREESIDE_API_KEY: "fs-test",
    });
    expect(shouldUseOrchestrator(config)).toBe(false);
  });

  // ── orchestrator: forced on (errors at SDK layer if not eligible)

  test("orchestrator + anthropic → orchestrator", () => {
    const config = fullEnvConfig({
      CHAT_MODE: "orchestrator",
      LLM_PROVIDER: "anthropic",
    });
    expect(shouldUseOrchestrator(config)).toBe(true);
  });

  test("orchestrator + stub → orchestrator (will throw at SDK layer · loud)", () => {
    const config = fullEnvConfig({
      CHAT_MODE: "orchestrator",
      LLM_PROVIDER: "stub",
    });
    // shouldUseOrchestrator says yes; the actual call inside runOrchestratorQuery
    // throws because resolveOrchestratorBackend rejects stub. This is the
    // intended behavior — explicit `CHAT_MODE=orchestrator` opts into a
    // loud-failure mode if the resolved provider can't honor it.
    expect(shouldUseOrchestrator(config)).toBe(true);
  });

  // ── naive: forced off (revert hatch · NO tools across all providers)

  test("naive + anthropic → naive (revert hatch holds)", () => {
    const config = fullEnvConfig({ CHAT_MODE: "naive", LLM_PROVIDER: "anthropic" });
    expect(shouldUseOrchestrator(config)).toBe(false);
  });

  test("naive + bedrock → naive (revert hatch holds)", () => {
    const config = fullEnvConfig({ CHAT_MODE: "naive", LLM_PROVIDER: "bedrock" });
    expect(shouldUseOrchestrator(config)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Provider resolution sanity (auto-resolution rules per reply.ts)
// ═════════════════════════════════════════════════════════════════════

describe("resolveChatProvider · auto rules (V0.12 bedrock-first)", () => {
  // V0.12 (operator 2026-05-01): bedrock wins when AWS env present, even
  // if ANTHROPIC_API_KEY is also set. Production removed ANTHROPIC_API_KEY
  // so bedrock won by elimination; this rule codifies the preference order.

  test("auto + AWS bedrock env + anthropic key → bedrock (cost-bearing default)", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(resolveChatProvider(config)).toBe("bedrock");
  });

  test("auto + AWS bedrock env, no anthropic key → bedrock", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
      ANTHROPIC_API_KEY: undefined,
    });
    expect(resolveChatProvider(config)).toBe("bedrock");
  });

  test("auto + BEDROCK_API_KEY (legacy alias) + no anthropic → bedrock", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      AWS_BEARER_TOKEN_BEDROCK: undefined,
      BEDROCK_API_KEY: "legacy-key",
      ANTHROPIC_API_KEY: undefined,
    });
    expect(resolveChatProvider(config)).toBe("bedrock");
  });

  test("auto + ANTHROPIC_API_KEY only (dev fallback path) → anthropic", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      AWS_BEARER_TOKEN_BEDROCK: undefined,
      BEDROCK_API_KEY: undefined,
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(resolveChatProvider(config)).toBe("anthropic");
  });

  test("auto + STUB_MODE=true (no anthropic key, no AWS env) → stub", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      STUB_MODE: true,
      AWS_BEARER_TOKEN_BEDROCK: undefined,
      BEDROCK_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    });
    expect(resolveChatProvider(config)).toBe("stub");
  });

  test("auto + only freeside key (no AWS, no anthropic, no stub) → freeside", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      AWS_BEARER_TOKEN_BEDROCK: undefined,
      BEDROCK_API_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
      STUB_MODE: false,
      FREESIDE_API_KEY: "fs-test",
    });
    expect(resolveChatProvider(config)).toBe("freeside");
  });

  test("auto + no provider keys → throws (loud failure)", () => {
    const config = fullEnvConfig({
      LLM_PROVIDER: "auto",
      ANTHROPIC_API_KEY: undefined,
      STUB_MODE: false,
      FREESIDE_API_KEY: undefined,
      AWS_BEARER_TOKEN_BEDROCK: undefined,
      BEDROCK_API_KEY: undefined,
    });
    expect(() => resolveChatProvider(config)).toThrow();
  });
});
