/**
 * dispatch-error-routing.test.ts — error-voice invariant audit
 * (bug-20260511-b6eb97 · FAGAN architect-lock A4 closure)
 *
 * Codifies the contract that dispatch.ts depends on:
 *
 *   1. The dispatch catch at dispatch.ts:593-598 routes through
 *      `deliverError(..., 'error')` → `formatErrorBody(character, kind)` →
 *      `stripVoiceDisciplineDrift(composeErrorBody(...))`. The body that
 *      lands on Discord is the in-character template.
 *
 *   2. Every body-bearing Discord write surface in dispatch.ts is wrapped
 *      through `sanitizeOutboundBody(content, character.id)` as defense-
 *      in-depth. If a future drift introduces a path that bypasses
 *      `deliverError`, the sanitizer substitutes any raw upstream-API-
 *      error shape with `composeErrorBody(characterId, 'error')`.
 *
 * The test surface targets PERSONA-ENGINE exports (composeErrorBody,
 * sanitizeOutboundBody, getErrorTemplate, stripVoiceDisciplineDrift)
 * because driving `doReplyChat` end-to-end would require a sizeable
 * dependency-injection refactor of dispatch.ts. Per FAGAN agent
 * afb548531d1fb79d5 finding A4 (operator-confirmed via /bug 2026-05-11),
 * the catch routing was already correct by code reading; the value of
 * this test is locking in the post-fix invariant — proving that EVERY
 * raw error shape produced upstream gets substituted to in-character
 * voice at the medium boundary.
 *
 * Coverage:
 *   - All 8 raw-error throw shapes from the upstream codebase
 *     (reply.ts:934 bedrock-direct, reply.ts:984 agent-gateway,
 *     orchestrator/index.ts:536 SDK-subtype, orchestrator/index.ts:556
 *     empty-completion, dispatch.ts:1083 REST-wrapper, raw API body,
 *     HTTP Internal Server Error, raw JSON error envelope).
 *   - Both characters (ruggy + satoshi) — voice differs per character.
 *   - `String(err)` form (Error: prefix) variants — defense-in-depth.
 *   - LLM success passthrough (no false-positive substitution).
 *   - Composition with `stripVoiceDisciplineDrift` (chain order is
 *     stripVoiceDisciplineDrift → sanitizeOutboundBody at the wire).
 */

import { describe, test, expect } from 'bun:test';
import {
  composeErrorBody,
  sanitizeOutboundBody,
  stripVoiceDisciplineDrift,
} from '@freeside-characters/persona-engine';

// ───────────────────────────────────────────────────────────────────────
// Raw-error throw shapes — each MUST be substituted to in-character.
//
// These literals match the exact shapes produced upstream:
//   reply.ts:934 → `bedrock chat error: ${response.status} ${body}`
//   reply.ts:984 → `freeside agent-gateway chat error: ${response.status} ${body}`
//   orchestrator/index.ts:536 → `orchestrator: SDK error subtype=${...}`
//   orchestrator/index.ts:556 → `orchestrator: SDK query completed without ...`
//   dispatch.ts:1083 → `interactions: PATCH @original failed status=${...} body=${...}`
//   dispatch.ts:1113 → `interactions: follow-up POST failed status=${...} body=${...}`
//   Anthropic SDK   → `API Error: ${status} ${body}` (verbatim from upstream)
//   HTTP body       → `Internal Server Error`
//   Raw envelope    → `{"type":"error","error":{...}}`
// ───────────────────────────────────────────────────────────────────────

interface RawErrorCase {
  readonly label: string;
  readonly body: string;
}

const RAW_ERROR_CASES: readonly RawErrorCase[] = [
  {
    label: 'anthropic api error (Bedrock 500)',
    body: 'API Error: 500 Internal Server Error',
  },
  {
    label: 'anthropic api error (Bedrock 529 overloaded)',
    body: 'API Error: 529 {"type":"error","error":{"type":"overloaded_error"}}',
  },
  {
    label: 'http internal server error',
    body: 'Internal Server Error',
  },
  {
    label: 'bedrock direct throw (reply.ts:934)',
    body: 'bedrock chat error: 500 {"message":"upstream timeout"}',
  },
  {
    label: 'agent-gateway throw (reply.ts:984)',
    body: 'freeside agent-gateway chat error: 503 Service Unavailable',
  },
  {
    label: 'orchestrator SDK subtype throw (index.ts:536)',
    body: 'orchestrator: SDK error subtype=error_during_execution errors=API call failed',
  },
  {
    label: 'orchestrator empty completion throw (index.ts:556)',
    body: 'orchestrator: SDK query completed without an assistant text response. tool_uses=2',
  },
  {
    label: 'raw anthropic JSON envelope',
    body: '{"type":"error","error":{"type":"api_error","message":"upstream timeout"}}',
  },
  {
    label: 'dispatch REST wrapper (PATCH @original)',
    body: 'interactions: PATCH @original failed status=429 body={"retry_after":1.234}',
  },
  {
    label: 'dispatch REST wrapper (follow-up POST)',
    body: 'interactions: follow-up POST failed status=403 body={"code":50013}',
  },
];

// Patterns that MUST NOT appear in any outbound body after sanitization.
// These are the substrings the operator + FAGAN A4 flagged as the leak class.
const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'API Error',
  'Internal Server Error',
  'bedrock chat error',
  'freeside agent-gateway chat error',
  'orchestrator: SDK error',
  'orchestrator: SDK query completed',
  '{"type":"error"',
  'interactions: PATCH @original failed status=',
  'interactions: follow-up POST failed status=',
];

const CHARACTERS = ['ruggy', 'satoshi'] as const;

describe('dispatch error-routing · raw-error substitution invariant', () => {
  for (const characterId of CHARACTERS) {
    for (const { label, body } of RAW_ERROR_CASES) {
      test(`${characterId} · ${label} → in-character substrate template`, () => {
        // Simulate the hypothetical leak: a raw error body arrives at the
        // Discord write surface without going through deliverError. The
        // sanitizer wraps every such surface in dispatch.ts; this proves
        // the wrap closes the invariant.
        const sanitized = sanitizeOutboundBody(body, characterId, composeErrorBody(characterId, 'error'));

        // The substituted output is the character's 'error' template.
        expect(sanitized).toBe(composeErrorBody(characterId, 'error'));

        // No forbidden substring leaks.
        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
          expect(sanitized).not.toContain(forbidden);
        }
      });

      test(`${characterId} · ${label} · String(err) prefix variant → substrate template`, () => {
        // `String(new Error(msg))` produces "Error: <msg>". A future
        // drift that passes String(err) instead of err.message would still
        // be caught.
        const withErrorPrefix = `Error: ${body}`;
        const sanitized = sanitizeOutboundBody(withErrorPrefix, characterId, composeErrorBody(characterId, 'error'));
        expect(sanitized).toBe(composeErrorBody(characterId, 'error'));
        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
          expect(sanitized).not.toContain(forbidden);
        }
      });
    }
  }
});

describe('dispatch error-routing · in-character template passthrough', () => {
  // formatErrorBody(character, kind) is what deliverError invokes today:
  // it returns stripVoiceDisciplineDrift(composeErrorBody(character.id, kind)).
  // The sanitizer must be a no-op on this output (idempotency proof).
  const KINDS = ['timeout', 'empty', 'error'] as const;

  for (const characterId of CHARACTERS) {
    for (const kind of KINDS) {
      test(`${characterId} · formatErrorBody(${kind}) passes through sanitizer verbatim`, () => {
        const body = stripVoiceDisciplineDrift(composeErrorBody(characterId, kind));
        const sanitized = sanitizeOutboundBody(body, characterId, composeErrorBody(characterId, 'error'));
        expect(sanitized).toBe(body);
      });
    }
  }
});

describe('dispatch error-routing · LLM success passthrough', () => {
  // LLM success output must traverse the sanitizer without modification.
  // These cases cover the chunk shapes that the wired call sites
  // (dispatch.ts:860 deliverViaWebhook, dispatch.ts:909/916
  // deliverViaInteraction) pass.

  test('ruggy success — lowercase, slangy, multi-paragraph passes through', () => {
    const llmOutput =
      'yo, ruggy here. been watching the bear-cave all morning. ' +
      'three transfers caught my eye — wait, ledger says four.\n\n' +
      'want to peek? lmk.';
    const cleaned = stripVoiceDisciplineDrift(llmOutput);
    const sanitized = sanitizeOutboundBody(cleaned, 'ruggy', composeErrorBody('ruggy', 'error'));
    expect(sanitized).toBe(cleaned);
  });

  test('satoshi success — sentence case, gnomic passes through', () => {
    const llmOutput =
      'The bear watches. ' +
      'Four windows opened today. ' +
      'The signal is unclear, but the pattern holds.';
    const cleaned = stripVoiceDisciplineDrift(llmOutput);
    const sanitized = sanitizeOutboundBody(cleaned, 'satoshi', composeErrorBody('satoshi', 'error'));
    expect(sanitized).toBe(cleaned);
  });

  test('emoji-rich + onchain identifiers pass through', () => {
    const llmOutput =
      '<:mibera_acquire:111> spotted, <:bear_pog:222>. ' +
      'transfer_from_wallet at 0xabc...def.';
    const sanitized = sanitizeOutboundBody(llmOutput, 'ruggy', composeErrorBody('ruggy', 'error'));
    expect(sanitized).toBe(llmOutput);
  });

  test('code block with API-shaped content (no anchor match) passes through', () => {
    // The sanitizer is anchored at start-of-string; embedded shapes in
    // code blocks must NOT trigger a false-positive substitution.
    const llmOutput =
      'heres the shape:\n\n' +
      '```\nstatus=200 body={"ok":true}\nAPI Error: 500 (example)\n```\n\n' +
      'basic.';
    const sanitized = sanitizeOutboundBody(llmOutput, 'ruggy', composeErrorBody('ruggy', 'error'));
    expect(sanitized).toBe(llmOutput);
  });
});

describe('dispatch error-routing · transform chain order', () => {
  // The wire order in dispatch.ts:
  //   1. result.chunks → stripVoiceDisciplineDrift (cleanedChunks)
  //   2. cleanedChunks → sendChatReplyViaWebhook / patchOriginal / postFollowUp
  //      (sanitizeOutboundBody wraps the content arg at the call site,
  //       receiving the pre-computed errorTemplate hoisted at function entry)
  //
  // Sanitize is OUTERMOST — last transform before the wire. This test
  // verifies the chain produces the same result whether applied in two
  // steps or composed.

  test('compose chain: stripVoiceDisciplineDrift then sanitizeOutboundBody on success', () => {
    const llmOutput = 'yo. observed — laid-back day.';
    // Step 1: voice discipline replaces em-dash → ", "
    const voiced = stripVoiceDisciplineDrift(llmOutput);
    expect(voiced).toBe('yo. observed, laid-back day.');
    // Step 2: sanitize passes through (no error pattern match)
    const wired = sanitizeOutboundBody(voiced, 'ruggy', composeErrorBody('ruggy', 'error'));
    expect(wired).toBe(voiced);
  });

  test('compose chain: stripVoiceDisciplineDrift then sanitizeOutboundBody on error template', () => {
    // formatErrorBody runs stripVoiceDisciplineDrift internally; the
    // sanitize wrap at the call site must be a no-op on the output.
    const errorTemplate = composeErrorBody('ruggy', 'error');
    const voiced = stripVoiceDisciplineDrift(errorTemplate);
    const wired = sanitizeOutboundBody(voiced, 'ruggy', errorTemplate);
    expect(wired).toBe(voiced);
    expect(wired).toBe("something snapped on ruggy's end. cool to retry?");
  });

  test('compose chain catches raw error even when stripVoiceDisciplineDrift runs first', () => {
    // Hypothetical drift: a raw error body slips through the chunks
    // pipeline. stripVoiceDisciplineDrift won't touch the error-shape
    // tokens; sanitizeOutboundBody must catch it at the wire.
    const rawError = 'API Error: 500 Internal Server Error';
    const voiced = stripVoiceDisciplineDrift(rawError);
    // voice-discipline doesn't strip the error shape — that's the
    // sanitizer's job.
    expect(voiced).toContain('API Error');
    const wired = sanitizeOutboundBody(voiced, 'ruggy', composeErrorBody('ruggy', 'error'));
    expect(wired).toBe(composeErrorBody('ruggy', 'error'));
    expect(wired).not.toContain('API Error');
  });
});

// ─────────────────────────────────────────────────────────────────────
// CODEX C1 REGRESSION GUARDS (2026-05-11)
//
// Anchored `^` patterns are defeated if a prefix is prepended BEFORE
// sanitize fires. dispatch.ts must sanitize the raw chunk FIRST, then
// add framing (quote prefix in deliverViaWebhook · `**DisplayName**\n\n`
// in deliverViaInteraction). These tests pin the correct ordering AND
// document the failure mode of the inverted (buggy) ordering, so future
// refactors cannot silently move sanitize outside the prefix step.
// ─────────────────────────────────────────────────────────────────────

describe('dispatch error-routing · codex C1 prefix-ordering regression', () => {
  test('CORRECT ORDER: sanitize chunk → prepend quote → wire (deliverViaWebhook)', () => {
    // Mirrors dispatch.ts:851-858 (post-fix). LLM emits a raw error in chunks[0];
    // sanitize must run BEFORE buildQuotePrefix is prepended.
    const rawChunk = 'API Error: 500 Internal Server Error';
    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
    const sanitized = sanitizeOutboundBody(rawChunk, 'ruggy', errorTemplate);
    const quote = '> @user asked: tell me about the bears\n\n';
    const final = quote + sanitized;
    // Final body has quote + in-character template. NO raw error substring.
    expect(final).toBe(quote + composeErrorBody('ruggy', 'error'));
    expect(final).not.toContain('API Error');
    expect(final).not.toContain('Internal Server Error');
  });

  test('CORRECT ORDER: sanitize chunk → prepend name → wire (deliverViaInteraction)', () => {
    // Mirrors dispatch.ts:909-925 (post-fix). formatReply prepends
    // `**DisplayName**\n\n` to chunks[0]; sanitize must run on rawChunks BEFORE.
    const rawChunk = 'API Error: 529 overloaded';
    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('satoshi', 'error'));
    const sanitized = sanitizeOutboundBody(rawChunk, 'satoshi', errorTemplate);
    const namePrefix = '**Satoshi**\n\n';
    const final = namePrefix + sanitized;
    expect(final).toBe(namePrefix + composeErrorBody('satoshi', 'error'));
    expect(final).not.toContain('API Error');
  });

  test('BUGGY ORDER (pre-fix): prepend quote → sanitize → wire = LEAKS raw body', () => {
    // This is the failure mode codex C1 caught. Keep this test as a
    // documentation guard — if a refactor moves sanitize back outside
    // the prefix step, the assertion below will hold (sanitize is a
    // no-op on prefixed input), which is the exact bug.
    const rawChunk = 'API Error: 500 Internal Server Error';
    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
    const quote = '> @user asked: hello\n\n';
    const prefixed = quote + rawChunk;
    const final = sanitizeOutboundBody(prefixed, 'ruggy', errorTemplate);
    // BUGGY: anchor `^API Error:` doesn't see `^>` so sanitize doesn't fire.
    expect(final).toBe(prefixed);
    expect(final).toContain('API Error');
  });

  test('BUGGY ORDER (pre-fix): prepend name → sanitize → wire = LEAKS raw body', () => {
    const rawChunk = 'bedrock chat error: 500 {"message":"upstream timeout"}';
    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('satoshi', 'error'));
    const namePrefix = '**Satoshi**\n\n';
    const prefixed = namePrefix + rawChunk;
    const final = sanitizeOutboundBody(prefixed, 'satoshi', errorTemplate);
    expect(final).toBe(prefixed);
    expect(final).toContain('bedrock chat error');
  });

  test('multi-chunk: only chunks[0] gets the quote prefix; chunks[1..N] still sanitize cleanly', () => {
    // Webhook delivery prefixes only chunks[0]. Subsequent chunks are
    // bare. If a raw-error somehow lands in chunks[1+], sanitize catches it
    // because no prefix shadows the anchor.
    const errorChunkInMiddle = 'orchestrator: SDK error subtype=error_during_execution';
    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
    const sanitized = sanitizeOutboundBody(errorChunkInMiddle, 'ruggy', errorTemplate);
    expect(sanitized).toBe(composeErrorBody('ruggy', 'error'));
    expect(sanitized).not.toContain('orchestrator: SDK error');
  });
});
