/**
 * Provider resolution matrix — V0.12 bedrock-first auto-rule.
 *
 * Locks the auto-rule preference order against regression. Both resolvers
 * (digest path · chat path) MUST agree on which provider `auto` resolves
 * to so the boot log + chat-route telemetry stay legible together.
 *
 * Operator-named 2026-05-01 (verbatim):
 *   ES:   "set loa app's text as bedrock for main provider so we don't
 *          use jani's keys"
 *   soju: "ye think i flipped all to bedrock"
 *
 * Production status post-fix: ANTHROPIC_API_KEY removed from prod env.
 * `auto` now resolves to bedrock by elimination AND by preference. This
 * test pins the preference half — the elimination half is enforced by
 * production env management.
 *
 * Reference: kickoff seed §4.0 + §0.7 bedrock bug context.
 */

import { describe, test, expect } from "bun:test";
import {
  resolveProvider,
  resolveChatProvider,
  type Config,
} from "@freeside-characters/persona-engine";

// ─── fixture: minimal config that doesn't preset any provider env ────

function bareConfig(overrides: Partial<Config> = {}): Config {
  return {
    STUB_MODE: false,
    LLM_PROVIDER: "auto",
    SCORE_API_URL: "https://score-api-production.up.railway.app",
    SCORE_API_KEY: undefined,
    MCP_KEY: undefined,
    SCORE_BEARER: undefined,
    CODEX_MCP_URL: undefined,
    FREESIDE_BASE_URL: "https://api.freeside.0xhoneyjar.xyz",
    FREESIDE_API_KEY: undefined,
    FREESIDE_AGENT_MODEL: "reasoning",
    AWS_REGION: "us-east-1",
    AWS_BEARER_TOKEN_BEDROCK: undefined,
    BEDROCK_API_KEY: undefined,
    BEDROCK_TEXT_REGION: "us-west-2",
    BEDROCK_TEXT_MODEL_ID: "us.anthropic.claude-opus-4-7",
    BEDROCK_STABILITY_MODEL_ID: undefined,
    BEDROCK_IMAGE_REGION: "us-east-1",
    BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: "us-west-2",
    BEDROCK_IMAGE_DEFAULT_ACTION: "text-to-image",
    ANTHROPIC_API_KEY: undefined,
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

// ─── Table-driven auto-rule matrix ───────────────────────────────────
// Each row exercises both resolvers (digest + chat) so they stay aligned.

interface MatrixRow {
  label: string;
  env: Partial<Config>;
  expectsDigest: "bedrock" | "anthropic" | "stub" | "freeside" | "throws";
  expectsChat: "bedrock" | "anthropic" | "stub" | "freeside" | "throws";
}

const matrix: MatrixRow[] = [
  {
    label: "AWS bearer token + ANTHROPIC_API_KEY (production-shape mixed env)",
    env: {
      AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
      ANTHROPIC_API_KEY: "sk-ant-test",
    },
    expectsDigest: "bedrock",
    expectsChat: "bedrock",
  },
  {
    label: "AWS bearer token only (production after ANTHROPIC removal)",
    env: { AWS_BEARER_TOKEN_BEDROCK: "test-bearer" },
    expectsDigest: "bedrock",
    expectsChat: "bedrock",
  },
  {
    label: "BEDROCK_API_KEY (legacy alias) + no anthropic",
    env: { BEDROCK_API_KEY: "legacy-key" },
    expectsDigest: "bedrock",
    expectsChat: "bedrock",
  },
  {
    label: "ANTHROPIC_API_KEY only (dev fallback path)",
    env: { ANTHROPIC_API_KEY: "sk-ant-dev" },
    expectsDigest: "anthropic",
    expectsChat: "anthropic",
  },
  {
    label: "STUB_MODE=true alone (dev offline path)",
    env: { STUB_MODE: true },
    expectsDigest: "stub",
    expectsChat: "stub",
  },
  {
    label: "FREESIDE_API_KEY only (gateway-only path)",
    env: { FREESIDE_API_KEY: "fs-test" },
    expectsDigest: "freeside",
    expectsChat: "freeside",
  },
  {
    label: "no provider env at all (loud failure)",
    env: {},
    expectsDigest: "throws",
    expectsChat: "throws",
  },
];

describe("provider-resolution matrix · digest path (resolveProvider)", () => {
  for (const row of matrix) {
    test(`auto + ${row.label} → ${row.expectsDigest}`, () => {
      const config = bareConfig(row.env);
      if (row.expectsDigest === "throws") {
        expect(() => resolveProvider(config)).toThrow();
      } else {
        expect(resolveProvider(config)).toBe(row.expectsDigest);
      }
    });
  }
});

describe("provider-resolution matrix · chat path (resolveChatProvider)", () => {
  for (const row of matrix) {
    test(`auto + ${row.label} → ${row.expectsChat}`, () => {
      const config = bareConfig(row.env);
      if (row.expectsChat === "throws") {
        expect(() => resolveChatProvider(config)).toThrow();
      } else {
        expect(resolveChatProvider(config)).toBe(row.expectsChat);
      }
    });
  }
});

// ─── Explicit-provider tests (auto rule out of scope) ────────────────

describe("explicit-provider tests (LLM_PROVIDER set explicitly)", () => {
  test("LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY → anthropic (digest)", () => {
    const config = bareConfig({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-ant-test",
    });
    expect(resolveProvider(config)).toBe("anthropic");
  });

  test("LLM_PROVIDER=anthropic without key → throws", () => {
    const config = bareConfig({ LLM_PROVIDER: "anthropic" });
    expect(() => resolveProvider(config)).toThrow();
  });

  test("LLM_PROVIDER=bedrock + AWS bearer → bedrock (digest)", () => {
    const config = bareConfig({
      LLM_PROVIDER: "bedrock",
      AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
    });
    expect(resolveProvider(config)).toBe("bedrock");
  });

  test("LLM_PROVIDER=stub → stub regardless of env", () => {
    const config = bareConfig({
      LLM_PROVIDER: "stub",
      ANTHROPIC_API_KEY: "sk-ant-test",
      AWS_BEARER_TOKEN_BEDROCK: "test-bearer",
    });
    expect(resolveProvider(config)).toBe("stub");
    expect(resolveChatProvider(config)).toBe("stub");
  });
});
