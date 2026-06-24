/**
 * RecordedMock — deterministic LLMGateway adapter for tests + eval.
 *
 * Replays canned LLM responses from a fixture map keyed by request shape
 * (character.id + post_type + zone + user message hash). Falls back to
 * a default error case if no fixture matches.
 *
 * Used by:
 *   - llm-gateway.contract.test.ts (the cycle-004 S1A contract gate)
 *   - eval harness fixtures (S1A.T13+ when those tasks land)
 *
 * Cycle-004 sprint-1a · PR #75
 */

import { Effect, Layer } from "effect";
import { createHash } from "node:crypto";
import {
  LLMGateway,
  type LLMError,
  type LLMInvokeRequest,
  type LLMResponse,
} from "../ports/llm-gateway.port.ts";

export interface RecordedFixture {
  /** Match against `character.id`. */
  readonly characterId: string;
  /** Optional: match against post_type if present in request. */
  readonly postType?: string;
  /** Optional: match against zone if present in request. */
  readonly zoneHint?: string;
  /** Optional: SHA-256 prefix (first 16 hex chars) of `userMessage` for tight match. */
  readonly userMessageHash?: string;
  /** Response to return when this fixture matches. */
  readonly response: LLMResponse;
}

export interface RecordedErrorFixture {
  /** Same matching shape as RecordedFixture but returns an error. */
  readonly characterId: string;
  readonly postType?: string;
  readonly zoneHint?: string;
  readonly userMessageHash?: string;
  readonly error: LLMError;
}

export interface RecordedMockConfig {
  /** Ordered list of success fixtures — first match wins. */
  readonly fixtures: ReadonlyArray<RecordedFixture>;
  /** Optional: ordered error fixtures (checked AFTER success fixtures). */
  readonly errorFixtures?: ReadonlyArray<RecordedErrorFixture>;
  /** Behavior when no fixture matches. Default: throw MalformedResponseError. */
  readonly onUnmatched?: "throw" | "return-default";
  /** Default response when onUnmatched: "return-default". */
  readonly defaultResponse?: LLMResponse;
}

function hashUserMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex").slice(0, 16);
}

function matches(
  fixture: RecordedFixture | RecordedErrorFixture,
  req: LLMInvokeRequest,
): boolean {
  if (fixture.characterId !== req.character.id) return false;
  if (fixture.postType !== undefined && fixture.postType !== req.postTypeHint)
    return false;
  if (fixture.zoneHint !== undefined && fixture.zoneHint !== req.zoneHint)
    return false;
  if (fixture.userMessageHash !== undefined) {
    if (fixture.userMessageHash !== hashUserMessage(req.userMessage))
      return false;
  }
  return true;
}

/**
 * Build a Layer that provides LLMGateway via canned fixtures.
 *
 * Lookup order:
 *   1. Try success fixtures in order — first match returns its response
 *   2. Try error fixtures in order — first match returns its error
 *   3. If onUnmatched: "return-default" + defaultResponse set → return default
 *   4. Otherwise → MalformedResponseError so the test surface fails loud
 */
export function makeRecordedMock(
  config: RecordedMockConfig,
): Layer.Layer<LLMGateway> {
  return Layer.succeed(
    LLMGateway,
    {
      invoke: (req: LLMInvokeRequest): Effect.Effect<LLMResponse, LLMError> =>
        Effect.suspend(() => {
          for (const fixture of config.fixtures) {
            if (matches(fixture, req)) {
              return Effect.succeed(fixture.response);
            }
          }
          for (const ef of config.errorFixtures ?? []) {
            if (matches(ef, req)) {
              return Effect.fail(ef.error);
            }
          }
          if (
            config.onUnmatched === "return-default" &&
            config.defaultResponse
          ) {
            return Effect.succeed(config.defaultResponse);
          }
          const error: LLMError = {
            _tag: "MalformedResponseError",
            provider: "stub",
            snippet: `no fixture matched character=${req.character.id} postType=${req.postTypeHint ?? "n/a"} zone=${req.zoneHint ?? "n/a"} msg-hash=${hashUserMessage(req.userMessage)}`,
            message: "RecordedMock: no fixture matched (consider widening fixture or setting onUnmatched: 'return-default')",
          };
          return Effect.fail(error);
        }),
    },
  );
}

/** Internal export for tests. */
export const _internalHashUserMessage = hashUserMessage;
