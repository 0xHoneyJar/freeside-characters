// Regression gate for the ambient-stir boot-disable bug: an unset
// FREESIDE_AUTH_MCP_URL (the intended state until identity-api ships its
// resolve_wallet MCP) must NOT disable the entire stir tier. Before this fix,
// boot validation treated freeside-auth as equally tier-fatal to the event
// source, so production logged "AMBIENT STIR TIER DISABLED ... freeside-auth:
// freeside-auth-mcp URL not configured" hourly across all zones.
//
// Pure-policy tests — no env, no I/O, no effect runtime — so they run under
// `bun test` without installed deps.

import { describe, expect, test } from "bun:test";
import type { AmbientMcpEndpoint } from "./live/score-mcp-client.ts";
import {
  AMBIENT_ALL_ENDPOINTS,
  AMBIENT_OPTIONAL_ENDPOINTS,
  AMBIENT_REQUIRED_ENDPOINTS,
  classifyEndpointCriticality,
  isOptionalAmbientEndpoint,
  type EndpointValidationResult,
} from "./endpoint-criticality.ts";

// The exact reason validateEndpointConfig("freeside-auth", …) returns when the
// URL is unset (score-mcp-client.ts) — what production actually logged.
const FREESIDE_AUTH_UNCONFIGURED = "freeside-auth-mcp URL not configured";

describe("ambient endpoint criticality — policy membership", () => {
  test("score and codex are required; freeside-auth is optional", () => {
    expect(AMBIENT_REQUIRED_ENDPOINTS).toEqual(["score", "codex"]);
    expect(AMBIENT_OPTIONAL_ENDPOINTS).toEqual(["freeside-auth"]);
  });

  test("AMBIENT_ALL_ENDPOINTS lists every endpoint, required first", () => {
    expect(AMBIENT_ALL_ENDPOINTS).toEqual(["score", "codex", "freeside-auth"]);
  });

  test("isOptionalAmbientEndpoint reflects the policy", () => {
    expect(isOptionalAmbientEndpoint("freeside-auth")).toBe(true);
    expect(isOptionalAmbientEndpoint("score")).toBe(false);
    expect(isOptionalAmbientEndpoint("codex")).toBe(false);
  });
});

describe("classifyEndpointCriticality — the production regression", () => {
  test("unset FREESIDE_AUTH_MCP_URL alone does NOT disable the tier", () => {
    const results: EndpointValidationResult[] = [
      { endpoint: "score", ok: true },
      { endpoint: "codex", ok: true },
      {
        endpoint: "freeside-auth",
        ok: false,
        reason: FREESIDE_AUTH_UNCONFIGURED,
      },
    ];

    const outcome = classifyEndpointCriticality(results);

    expect(outcome.disabled).toBe(false);
    expect(outcome.reasons).toEqual([]);
    expect(outcome.warnings).toEqual([
      `freeside-auth: ${FREESIDE_AUTH_UNCONFIGURED}`,
    ]);
  });
});

describe("classifyEndpointCriticality — required endpoints stay tier-fatal", () => {
  test("a failed score endpoint disables the tier", () => {
    const outcome = classifyEndpointCriticality([
      { endpoint: "score", ok: false, reason: "score-mcp URL not configured" },
      { endpoint: "codex", ok: true },
      { endpoint: "freeside-auth", ok: true },
    ]);

    expect(outcome.disabled).toBe(true);
    expect(outcome.reasons).toEqual(["score: score-mcp URL not configured"]);
    expect(outcome.warnings).toEqual([]);
  });

  test("a failed codex endpoint disables the tier", () => {
    const outcome = classifyEndpointCriticality([
      { endpoint: "score", ok: true },
      { endpoint: "codex", ok: false, reason: "codex-mcp URL not configured" },
      { endpoint: "freeside-auth", ok: true },
    ]);

    expect(outcome.disabled).toBe(true);
    expect(outcome.reasons).toEqual(["codex: codex-mcp URL not configured"]);
    expect(outcome.warnings).toEqual([]);
  });
});

describe("classifyEndpointCriticality — mixed and edge cases", () => {
  test("a required failure disables even alongside an optional failure", () => {
    const outcome = classifyEndpointCriticality([
      { endpoint: "score", ok: false, reason: "score-mcp must use https://" },
      { endpoint: "codex", ok: true },
      {
        endpoint: "freeside-auth",
        ok: false,
        reason: FREESIDE_AUTH_UNCONFIGURED,
      },
    ]);

    expect(outcome.disabled).toBe(true);
    expect(outcome.reasons).toEqual(["score: score-mcp must use https://"]);
    expect(outcome.warnings).toEqual([
      `freeside-auth: ${FREESIDE_AUTH_UNCONFIGURED}`,
    ]);
  });

  test("all endpoints healthy — not disabled, no reasons, no warnings", () => {
    const outcome = classifyEndpointCriticality([
      { endpoint: "score", ok: true },
      { endpoint: "codex", ok: true },
      { endpoint: "freeside-auth", ok: true },
    ]);

    expect(outcome).toEqual({ disabled: false, reasons: [], warnings: [] });
  });

  test("an endpoint absent from the policy map fails safe to required", () => {
    // Fail-safe contract (F-004): if a future AmbientMcpEndpoint slips past the
    // exhaustiveness check (e.g. via a cast) and is not in the criticality map,
    // it must be treated as REQUIRED — tier-fatal until classified, never
    // silently optional.
    const outcome = classifyEndpointCriticality([
      {
        endpoint: "unknown-endpoint" as unknown as AmbientMcpEndpoint,
        ok: false,
        reason: "not in policy map",
      },
    ]);

    expect(outcome.disabled).toBe(true);
    expect(outcome.reasons).toEqual(["unknown-endpoint: not in policy map"]);
    expect(outcome.warnings).toEqual([]);
  });
});
