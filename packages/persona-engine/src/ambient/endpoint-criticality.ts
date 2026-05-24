/**
 * Ambient MCP endpoint criticality policy.
 *
 * Boot-time endpoint validation (runtime.ts) must distinguish two kinds of
 * MCP endpoint, because they fail in fundamentally different ways:
 *
 *   required — the stir tier cannot do its job without it. A production
 *     validation failure disables the tier (digest cron + read-side stay
 *     healthy). `score` is the event source — no events, no stir. `codex`
 *     (mibera lookup) is here too because MiberaResolverLive PROPAGATES its
 *     error on transport/timeout failure (no terminal catchAll), so it is not
 *     yet fully fail-soft — its absence stays tier-fatal until that resolver
 *     also degrades gracefully. (Tracked follow-up: once MiberaResolverLive
 *     anonymizes / null-fallbacks like WalletResolverLive, move codex to
 *     "optional" and this comment goes away.)
 *
 *   optional — soft-degradable enrichment. Its live resolver already returns a
 *     safe fallback on ANY failure, so an absent or misconfigured URL must NOT
 *     take the tier down — narration simply runs without the enrichment.
 *     `freeside-auth` (wallet → handle): WalletResolverLive returns
 *     ANONYMOUS_KEEPER on circuit-break / failure / timeout and NEVER leaks a
 *     raw 0x… (NFR-29). When identity-api deploys its `resolve_wallet` MCP and
 *     FREESIDE_AUTH_MCP_URL is set, real resolution lights up with no further
 *     code change.
 *
 * This mirrors the identity-api PRD G-5 doctrine ("when a downstream building
 * is unreachable the response degrades gracefully rather than failing") on the
 * CONSUMER side.
 *
 * The previous policy treated all three endpoints as equally tier-fatal, so an
 * unset FREESIDE_AUTH_MCP_URL — the intended state until identity-api ships —
 * disabled the entire ambient stir tier in production. This module makes that
 * decision explicit, named, and unit-testable.
 *
 * Pure (no I/O, no env, no side effects) so it is importable in tests without
 * triggering runtime.ts's module-load ManagedRuntime construction.
 */

import type { AmbientMcpEndpoint } from "./live/score-mcp-client.ts";

export type EndpointCriticality = "required" | "optional";

/**
 * Single source of truth for endpoint criticality.
 *
 * `Record<AmbientMcpEndpoint, …>` makes this map EXHAUSTIVE: if
 * score-mcp-client.ts adds a new member to the `AmbientMcpEndpoint` union and
 * it is not classified here, this object literal fails to type-check. That
 * closes the silent-drift gap where an unclassified endpoint would never be
 * validated at boot. The required/optional arrays below are DERIVED from this
 * map, so they cannot fall out of sync with it.
 */
export const AMBIENT_ENDPOINT_CRITICALITY: Record<
  AmbientMcpEndpoint,
  EndpointCriticality
> = {
  score: "required",
  codex: "required",
  "freeside-auth": "optional",
};

const _ENDPOINTS = Object.keys(
  AMBIENT_ENDPOINT_CRITICALITY,
) as AmbientMcpEndpoint[];

/** Endpoints whose absence/misconfiguration disables the stir tier in prod. */
export const AMBIENT_REQUIRED_ENDPOINTS: ReadonlyArray<AmbientMcpEndpoint> =
  _ENDPOINTS.filter((e) => AMBIENT_ENDPOINT_CRITICALITY[e] === "required");

/** Soft-degradable enrichment endpoints — failures warn, never disable. */
export const AMBIENT_OPTIONAL_ENDPOINTS: ReadonlyArray<AmbientMcpEndpoint> =
  _ENDPOINTS.filter((e) => AMBIENT_ENDPOINT_CRITICALITY[e] === "optional");

/** All endpoints the bootstrap validates, required first. */
export const AMBIENT_ALL_ENDPOINTS: ReadonlyArray<AmbientMcpEndpoint> = [
  ...AMBIENT_REQUIRED_ENDPOINTS,
  ...AMBIENT_OPTIONAL_ENDPOINTS,
];

/**
 * Per-endpoint validation result fed into the criticality classifier.
 *
 * Discriminated on `ok`: a failure result MUST carry a `reason`, so the
 * classifier never has to invent diagnostic text for a context-free failure.
 */
export type EndpointValidationResult =
  | { readonly endpoint: AmbientMcpEndpoint; readonly ok: true }
  | {
      readonly endpoint: AmbientMcpEndpoint;
      readonly ok: false;
      readonly reason: string;
    };

/** Outcome of classifying a set of validation results. */
export interface EndpointCriticalityOutcome {
  /** True when ≥1 required endpoint failed — caller disables the stir tier. */
  readonly disabled: boolean;
  /** Failure details for required endpoints (drive the disable). */
  readonly reasons: ReadonlyArray<string>;
  /** Failure details for optional endpoints (degraded enrichment; non-fatal). */
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Whether an endpoint is soft-degradable. Fail-safe default: an endpoint NOT
 * present in the criticality map (e.g. a brand-new union member that slipped
 * past the exhaustiveness check via a cast) is treated as REQUIRED — the safe
 * direction is "tier-fatal until classified", never "silently optional".
 */
export function isOptionalAmbientEndpoint(endpoint: AmbientMcpEndpoint): boolean {
  return AMBIENT_ENDPOINT_CRITICALITY[endpoint] === "optional";
}

/**
 * Classify per-endpoint validation results into the tier-disable decision.
 *
 * Pure policy: a required endpoint failure contributes to `reasons` and forces
 * `disabled: true`; an optional endpoint failure contributes only to
 * `warnings`. Endpoints that validated OK are ignored. Prod-vs-dev gating is
 * the caller's concern — this function never reads the environment.
 */
export function classifyEndpointCriticality(
  results: ReadonlyArray<EndpointValidationResult>,
): EndpointCriticalityOutcome {
  const reasons: string[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (result.ok) continue;
    const detail = `${result.endpoint}: ${result.reason}`;
    if (isOptionalAmbientEndpoint(result.endpoint)) {
      warnings.push(detail);
    } else {
      reasons.push(detail);
    }
  }

  return { disabled: reasons.length > 0, reasons, warnings };
}
