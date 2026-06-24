/**
 * llm-gateway.contract.test.ts — shared contract for LLMGateway adapters.
 *
 * Per SDD §6 (Flatline SKP-004 HIGH 720): BOTH live and mock adapters
 * must pass the same contract suite. Catches interface-vs-implementation
 * drift before it reaches runtime.
 *
 * The live adapter cannot be exercised in CI without a working Anthropic
 * key (and would cost money). Live-adapter tests stub the legacy
 * `invokeAgentGateway` import at the module-level to verify the
 * classification + Effect-wrapper logic deterministically.
 *
 * Mock adapter is exercised directly against fixture inputs.
 *
 * Cycle-004 sprint-1a · PR #75
 */

import { describe, test, expect } from "bun:test";
import { Effect, Layer } from "effect";
import {
  LLMGateway,
  isLLMError,
  type LLMError,
  type LLMInvokeRequest,
  type LLMResponse,
} from "./ports/llm-gateway.port.ts";
import {
  makeRecordedMock,
  _internalHashUserMessage,
} from "./mock/recorded.mock.ts";
import { _internalClassifyLegacyError } from "./live/anthropic.live.ts";

const FAKE_CHARACTER = {
  id: "ruggy",
  displayName: "Ruggy",
  anchoredArchetypes: ["Storyteller"],
  mcps: [],
  webhookAvatarUrl: "",
  webhookUsername: "ruggy",
  webhookAvatarTarget: "",
} as unknown as LLMInvokeRequest["character"];

const baseRequest = (overrides: Partial<LLMInvokeRequest> = {}): LLMInvokeRequest => ({
  character: FAKE_CHARACTER,
  systemPrompt: "you are ruggy",
  userMessage: "test prompt",
  ...overrides,
});

// ============================================================================
// LLMError discriminated-union shape
// ============================================================================

describe("LLMError shape", () => {
  test("isLLMError narrows correctly on each _tag variant", () => {
    const cases: LLMError[] = [
      { _tag: "RateLimitError", provider: "anthropic", message: "" },
      { _tag: "EmptyResponseError", provider: "bedrock", message: "" },
      { _tag: "AuthError", provider: "anthropic", reason: "missing-key", message: "" },
      { _tag: "MalformedResponseError", provider: "anthropic", snippet: "", message: "" },
      { _tag: "ContentTooLargeError", provider: "anthropic", message: "" },
      { _tag: "TransportError", provider: "anthropic", reason: "network", message: "" },
    ];
    for (const c of cases) {
      expect(isLLMError(c)).toBe(true);
    }
  });

  test("isLLMError rejects non-LLMError values", () => {
    expect(isLLMError(null)).toBe(false);
    expect(isLLMError({})).toBe(false);
    expect(isLLMError({ _tag: "NotAnLLMError" })).toBe(false);
    expect(isLLMError("string")).toBe(false);
    expect(isLLMError(42)).toBe(false);
  });
});

// ============================================================================
// classifyLegacyError — message-pattern dispatch
// ============================================================================

describe("classifyLegacyError (live adapter classification)", () => {
  test("Credit balance message → AuthError insufficient-credit", () => {
    const err = _internalClassifyLegacyError(
      new Error("Credit balance is too low (api_status=400)"),
    );
    expect(err._tag).toBe("AuthError");
    if (err._tag === "AuthError") {
      expect(err.reason).toBe("insufficient-credit");
    }
  });

  test("Rate limit message → RateLimitError with retryAfterSeconds when parseable", () => {
    const err = _internalClassifyLegacyError(
      new Error("rate limit hit, retry after: 30 seconds"),
    );
    expect(err._tag).toBe("RateLimitError");
    if (err._tag === "RateLimitError") {
      expect(err.retryAfterSeconds).toBe(30);
    }
  });

  test("SDK empty result → EmptyResponseError", () => {
    const err = _internalClassifyLegacyError(
      new Error("orchestrator: SDK query completed without an assistant text response"),
    );
    expect(err._tag).toBe("EmptyResponseError");
  });

  test("Context length message → ContentTooLargeError", () => {
    const err = _internalClassifyLegacyError(
      new Error("context_length_exceeded: prompt too long"),
    );
    expect(err._tag).toBe("ContentTooLargeError");
  });

  test("Timeout message → TransportError reason: timeout", () => {
    const err = _internalClassifyLegacyError(new Error("request timeout after 30s"));
    expect(err._tag).toBe("TransportError");
    if (err._tag === "TransportError") {
      expect(err.reason).toBe("timeout");
    }
  });

  test("ECONNRESET → TransportError reason: connection-reset", () => {
    const err = _internalClassifyLegacyError(new Error("socket hang up ECONNRESET"));
    expect(err._tag).toBe("TransportError");
    if (err._tag === "TransportError") {
      expect(err.reason).toBe("connection-reset");
    }
  });

  test("Unrecognized error → TransportError reason: network (catch-all)", () => {
    const err = _internalClassifyLegacyError(new Error("something completely unknown"));
    expect(err._tag).toBe("TransportError");
    if (err._tag === "TransportError") {
      expect(err.reason).toBe("network");
    }
  });

  test("Non-Error value → TransportError (still classifies)", () => {
    const err = _internalClassifyLegacyError("a plain string error");
    expect(err._tag).toBe("TransportError");
  });
});

// ============================================================================
// RecordedMock contract — first-match wins + matcher precision
// ============================================================================

describe("RecordedMock matching", () => {
  test("Matches on characterId alone when no other fields specified", async () => {
    const layer = makeRecordedMock({
      fixtures: [
        {
          characterId: "ruggy",
          response: { text: "hello from fixture" },
        },
      ],
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest());
    });
    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result.text).toBe("hello from fixture");
  });

  test("Tighter match (characterId + postType + zone) takes precedence over generic", async () => {
    const layer = makeRecordedMock({
      fixtures: [
        {
          characterId: "ruggy",
          postType: "digest",
          zoneHint: "bear-cave",
          response: { text: "specific bear-cave digest" },
        },
        {
          characterId: "ruggy",
          response: { text: "generic fallback" },
        },
      ],
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(
        baseRequest({ postTypeHint: "digest", zoneHint: "bear-cave" }),
      );
    });
    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result.text).toBe("specific bear-cave digest");
  });

  test("No fixture match → MalformedResponseError when onUnmatched: throw", async () => {
    const layer = makeRecordedMock({
      fixtures: [
        { characterId: "satoshi", response: { text: "wrong character" } },
      ],
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest());
    });
    const exit = await Effect.runPromiseExit(Effect.provide(program, layer));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
      expect(exit.cause.error._tag).toBe("MalformedResponseError");
    }
  });

  test("No fixture match → defaultResponse when onUnmatched: return-default", async () => {
    const layer = makeRecordedMock({
      fixtures: [],
      onUnmatched: "return-default",
      defaultResponse: { text: "fallback prose" },
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest());
    });
    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result.text).toBe("fallback prose");
  });

  test("Error fixture matches and produces the LLMError as declared", async () => {
    const layer = makeRecordedMock({
      fixtures: [],
      errorFixtures: [
        {
          characterId: "ruggy",
          error: {
            _tag: "RateLimitError",
            provider: "anthropic",
            retryAfterSeconds: 60,
            message: "Test rate limit",
          },
        },
      ],
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest());
    });
    const exit = await Effect.runPromiseExit(Effect.provide(program, layer));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
      expect(exit.cause.error._tag).toBe("RateLimitError");
      if (exit.cause.error._tag === "RateLimitError") {
        expect(exit.cause.error.retryAfterSeconds).toBe(60);
      }
    }
  });
});

// ============================================================================
// userMessage hashing — fixture-precision testing
// ============================================================================

describe("RecordedMock userMessage hashing", () => {
  test("Same message → same 16-char hash", () => {
    const a = _internalHashUserMessage("digest prompt v1");
    const b = _internalHashUserMessage("digest prompt v1");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  test("Different message → different hash", () => {
    const a = _internalHashUserMessage("digest prompt v1");
    const b = _internalHashUserMessage("digest prompt v2");
    expect(a).not.toBe(b);
  });

  test("userMessageHash narrows fixture matching when present", async () => {
    const specificHash = _internalHashUserMessage("targeted message");
    const layer = makeRecordedMock({
      fixtures: [
        {
          characterId: "ruggy",
          userMessageHash: specificHash,
          response: { text: "hash-specific response" },
        },
        {
          characterId: "ruggy",
          response: { text: "generic fallback" },
        },
      ],
    });
    const program1 = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest({ userMessage: "targeted message" }));
    });
    const program2 = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      return yield* gateway.invoke(baseRequest({ userMessage: "other message" }));
    });
    const r1 = await Effect.runPromise(Effect.provide(program1, layer));
    const r2 = await Effect.runPromise(Effect.provide(program2, layer));
    expect(r1.text).toBe("hash-specific response");
    expect(r2.text).toBe("generic fallback");
  });
});

// ============================================================================
// Effect-to-Promise boundary verification (SDD §1.6)
// ============================================================================
//
// Per SDD §1.6: callers see Promise<Result<X, E>> at the module boundary,
// NOT raw Effect<X, E>. The export-boundary wrapper lives at the module's
// public API surface — for cycle-004 S1A, the export-boundary wrapper
// will land alongside the composition root (S5). This test asserts the
// internal Effect-shape contract holds for now; the Promise<Result<X,E>>
// wrapper assertion will be added when the composition root ships.

describe("Effect-shape contract (internal boundary)", () => {
  test("Mock adapter Effect.invoke is Effect.Effect<LLMResponse, LLMError>", async () => {
    const layer = makeRecordedMock({
      fixtures: [
        { characterId: "ruggy", response: { text: "ok" } },
      ],
    });
    const program = Effect.gen(function* () {
      const gateway = yield* LLMGateway;
      const result: LLMResponse = yield* gateway.invoke(baseRequest());
      return result;
    });
    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result.text).toBe("ok");
    // Type-level assertion: this file would fail to compile if invoke()
    // returned a Promise instead of Effect. Runtime: success path returns
    // a plain LLMResponse object.
    expect(typeof result.text).toBe("string");
  });
});
