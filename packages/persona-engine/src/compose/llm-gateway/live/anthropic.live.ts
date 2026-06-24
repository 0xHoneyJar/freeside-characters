/**
 * AnthropicLive — Effect-wrapped adapter delegating to the legacy
 * `compose/agent-gateway.ts::invoke()` Anthropic path.
 *
 * Strategy (cycle-004 S1A migration window): rather than rewriting
 * the SDK call, this adapter is a thin Effect.tryPromise wrapper
 * around the existing imperative path. As callers migrate to the
 * port, the legacy path becomes dead code and gets deleted in a
 * later sprint.
 *
 * The provider-routing logic (resolveProvider · stub / freeside /
 * bedrock fallbacks) stays in agent-gateway.ts for now. Each
 * provider gets its own *.live.ts in a follow-up so callers can
 * explicitly select an adapter; provider auto-resolution lives at
 * the composition root (apps/bot/src/runtime.ts when shipped).
 *
 * Cycle-004 sprint-1a · PR #75
 */

import { Effect, Layer } from "effect";
import type { Config } from "../../../config.ts";
import {
  invoke as invokeAgentGateway,
  type InvokeRequest,
  type InvokeResponse,
} from "../../agent-gateway.ts";
import {
  LLMGateway,
  type LLMInvokeRequest,
  type LLMResponse,
  type LLMError,
} from "../ports/llm-gateway.port.ts";

/**
 * Translate legacy `Error` instances thrown by `invokeAgentGateway`
 * into typed `LLMError` discriminated-union values.
 *
 * Pattern-match on the error message because the legacy path throws
 * `new Error("...")` without typed shapes. Each pattern maps to a
 * specific `_tag`; the catch-all returns `TransportError` (most
 * recoverable assumption). Provider-specific patterns are documented
 * inline with their producing call site in `agent-gateway.ts`.
 */
function classifyLegacyError(
  err: unknown,
  provider: "anthropic" | "bedrock" | "freeside" | "stub" = "anthropic",
): LLMError {
  const message = err instanceof Error ? err.message : String(err);

  // Auth / credit failures — produced by Anthropic API direct path.
  if (
    /credit balance|insufficient_quota|api_status=400/i.test(message) ||
    /Credit balance is too low/i.test(message)
  ) {
    return {
      _tag: "AuthError",
      provider,
      reason: "insufficient-credit",
      message,
    };
  }
  if (/API[ _]KEY|api_key|unset|throws if missing/i.test(message)) {
    return {
      _tag: "AuthError",
      provider,
      reason: "missing-key",
      message,
    };
  }
  if (/unauthorized|invalid_api_key/i.test(message)) {
    return {
      _tag: "AuthError",
      provider,
      reason: "invalid-key",
      message,
    };
  }

  // Rate limiting.
  if (/rate.?limit|429|too many requests/i.test(message)) {
    const retryMatch = /retry.?after[:\s]+(\d+)/i.exec(message);
    return {
      _tag: "RateLimitError",
      provider,
      retryAfterSeconds: retryMatch ? Number(retryMatch[1]) : undefined,
      message,
    };
  }

  // Empty response (Bedrock-routed responses occasionally return success
  // status with no text — the legacy `accumulatedAssistantText` fallback
  // existed for this case).
  if (
    /SDK query completed without an assistant text response/i.test(message) ||
    /empty.*result/i.test(message)
  ) {
    return {
      _tag: "EmptyResponseError",
      provider,
      message,
    };
  }

  // Content too large.
  if (
    /context[_ ]length|content.*too.*large|413|prompt.*too.*long/i.test(message)
  ) {
    return {
      _tag: "ContentTooLargeError",
      provider,
      message,
    };
  }

  // Malformed.
  if (/parse|malformed|invalid_request_error/i.test(message)) {
    return {
      _tag: "MalformedResponseError",
      provider,
      snippet: message.slice(0, 200),
      message,
    };
  }

  // Transport (default catch-all — most recoverable assumption).
  if (/timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND|fetch failed/i.test(message)) {
    let reason: "timeout" | "network" | "tls" | "connection-reset" = "network";
    if (/timeout/i.test(message)) reason = "timeout";
    else if (/ECONNRESET|connection.*reset/i.test(message))
      reason = "connection-reset";
    else if (/tls|ssl|certificate/i.test(message)) reason = "tls";
    return {
      _tag: "TransportError",
      provider,
      reason,
      message,
    };
  }

  // Final catch-all: unknown errors become TransportError so callers
  // can apply retry-with-backoff. This is a deliberate over-coercion
  // — if a new failure mode emerges, the classification table gets a
  // new branch and the TransportError catch-all narrows.
  return {
    _tag: "TransportError",
    provider,
    reason: "network",
    message,
  };
}

/**
 * Translate a port-shaped `LLMInvokeRequest` to the legacy `InvokeRequest`
 * shape. Field-for-field identical in cycle-004; this conversion is here
 * to keep the port surface independent of the legacy types so future
 * adapters don't depend on agent-gateway.ts.
 */
function toLegacyRequest(req: LLMInvokeRequest): InvokeRequest {
  return {
    character: req.character,
    systemPrompt: req.systemPrompt,
    userMessage: req.userMessage,
    modelAlias: req.modelAlias,
    zoneHint: req.zoneHint,
    postTypeHint: req.postTypeHint,
  };
}

function fromLegacyResponse(res: InvokeResponse): LLMResponse {
  return {
    text: res.text,
    meta: res.meta,
  };
}

/**
 * Build a Layer that provides LLMGateway via the legacy agent-gateway
 * Anthropic path. The composition root in apps/bot/src/runtime.ts
 * (cycle-004 S5) wires this Layer into the world; for now, the legacy
 * `invoke()` function in agent-gateway.ts remains the production code
 * path. This Layer is exercised by contract tests + new code that
 * opts into the port (e.g., eval harness in S1A.T10).
 */
export function makeAnthropicLive(config: Config): Layer.Layer<LLMGateway> {
  return Layer.succeed(
    LLMGateway,
    {
      invoke: (req: LLMInvokeRequest): Effect.Effect<LLMResponse, LLMError> =>
        Effect.tryPromise({
          try: async () => {
            const legacyResponse = await invokeAgentGateway(
              config,
              toLegacyRequest(req),
            );
            return fromLegacyResponse(legacyResponse);
          },
          catch: (err) => classifyLegacyError(err, "anthropic"),
        }),
    },
  );
}

/** Internal export for contract tests. NOT part of the public API. */
export const _internalClassifyLegacyError = classifyLegacyError;
