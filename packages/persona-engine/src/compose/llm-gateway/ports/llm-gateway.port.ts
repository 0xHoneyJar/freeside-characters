/**
 * LLMGateway port — typed-error LLM invocation surface for cycle-004.
 *
 * Surgical Effect adoption per SDD §1.2: this is a load-bearing failure
 * surface (Bedrock empty result · rate limit · content too large · auth)
 * where loud error surfacing matters across multiple consumers (digest
 * cron · chat reply · weaver · pop-in). Plain TS gateway hid these
 * failures behind thrown exceptions; Effect's typed error channel makes
 * every failure case visible at the call site.
 *
 * Export-boundary convention per SDD §1.6: callers see `Promise<Result<
 * LLMResponse, LLMError>>` at the module boundary. The Effect runtime
 * is INTERNAL to live adapters. Lint rule `no-effect-export` enforces.
 *
 * Replaces compose/agent-gateway.ts::invoke for cycle-004 onwards. The
 * legacy invoke() stays in place during the migration window (S1A) so
 * callers can be migrated incrementally without breaking production.
 *
 * Cycle-004 sprint-1a · PR #75
 */

import { Context, Effect } from "effect";
import type { CharacterConfig } from "../../../types.ts";
import type { ZoneId } from "../../../score/types.ts";
import type { PostType } from "../../post-types.ts";

// ============================================================================
// Domain types (request / response)
// ============================================================================

/** Model alias mirrors the legacy InvokeRequest signature — unchanged. */
export type ModelAlias =
  | "cheap"
  | "fast-code"
  | "reviewer"
  | "reasoning"
  | "architect";

export interface LLMInvokeRequest {
  readonly character: CharacterConfig;
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly modelAlias?: ModelAlias;
  readonly zoneHint?: ZoneId;
  readonly postTypeHint?: PostType;
}

export interface LLMResponse {
  readonly text: string;
  readonly meta?: Record<string, unknown>;
}

// ============================================================================
// Typed error channel — discriminated union
// ============================================================================
//
// Each error case carries the minimum context a caller needs to handle it.
// `RawProvider` is the bare provider string (`anthropic` · `bedrock` ·
// `freeside` · `stub`) so observability can route metrics per-provider.

export type LLMProvider = "stub" | "anthropic" | "freeside" | "bedrock";

export interface RateLimitError {
  readonly _tag: "RateLimitError";
  readonly provider: LLMProvider;
  readonly retryAfterSeconds?: number;
  readonly message: string;
}

export interface EmptyResponseError {
  readonly _tag: "EmptyResponseError";
  readonly provider: LLMProvider;
  /** Some providers (Bedrock) return success status but no text. The
   * legacy `accumulatedAssistantText` fallback in orchestrator/index.ts
   * was created for this case. With typed errors, callers can pick a
   * different strategy (retry · degraded prose · silence-register). */
  readonly message: string;
}

export interface AuthError {
  readonly _tag: "AuthError";
  readonly provider: LLMProvider;
  /** Distinguish "no key configured" vs "key rejected at runtime". */
  readonly reason: "missing-key" | "invalid-key" | "insufficient-credit";
  readonly message: string;
}

export interface MalformedResponseError {
  readonly _tag: "MalformedResponseError";
  readonly provider: LLMProvider;
  /** Snippet of the malformed payload for debugging (truncated to 200 chars). */
  readonly snippet: string;
  readonly message: string;
}

export interface ContentTooLargeError {
  readonly _tag: "ContentTooLargeError";
  readonly provider: LLMProvider;
  /** Token-or-character count when known. */
  readonly size?: number;
  readonly limit?: number;
  readonly message: string;
}

export interface TransportError {
  readonly _tag: "TransportError";
  readonly provider: LLMProvider;
  /** Network / DNS / TLS / connection-reset / timeout. */
  readonly reason: "timeout" | "network" | "tls" | "connection-reset";
  readonly message: string;
}

export type LLMError =
  | RateLimitError
  | EmptyResponseError
  | AuthError
  | MalformedResponseError
  | ContentTooLargeError
  | TransportError;

/** Type-narrowing helper for LLMError consumers. */
export function isLLMError(value: unknown): value is LLMError {
  if (typeof value !== "object" || value === null) return false;
  const tag = (value as { _tag?: unknown })._tag;
  return (
    tag === "RateLimitError" ||
    tag === "EmptyResponseError" ||
    tag === "AuthError" ||
    tag === "MalformedResponseError" ||
    tag === "ContentTooLargeError" ||
    tag === "TransportError"
  );
}

// ============================================================================
// Port (Effect.Tag) — adapter implementations live in {live,mock}/
// ============================================================================

export class LLMGateway extends Context.Tag("compose/LLMGateway")<
  LLMGateway,
  {
    /** Invoke the LLM provider. Effect.Effect<LLMResponse, LLMError>
     * INTERNAL only — see SDD §1.6. The exported module surface (per
     * each adapter's index.ts) wraps in Promise<Result<X, E>>. */
    readonly invoke: (
      req: LLMInvokeRequest,
    ) => Effect.Effect<LLMResponse, LLMError>;
  }
>() {}
