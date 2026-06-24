# PR #54 · bug-20260511-b6eb97 · Outbound-body sanitizer for in-character error-voice invariant

## Context for adversarial review

**Branch**: `fix/sanitize-outbound-body-bug-20260511-b6eb97` (2 commits ahead of main)
**Commits**:
87889ec fix(sanitize): address bridgebuilder F1 + F4 + F12 inline
d88e37b fix(error-voice): sanitize outbound body to enforce in-character-only invariant at chat-medium boundary

**Goal**: Close FAGAN architect-lock A4 (defense-in-depth at the chat-medium write boundary).
Operator observed a raw `API Error: 500 …` in Discord during a transient Bedrock 500;
FAGAN code-reading verified the catch at dispatch.ts:593-598 was already routing through
`formatErrorBody → composeErrorBody` correctly. This PR adds a defense-in-depth sanitizer at
every body-bearing Discord write surface so the in-character-only invariant is load-bearing
at the medium boundary, not inductively at every catch site.

**Bridgebuilder (Opus, single-model) already reviewed**: 12 findings, 0 BLOCKER, 2 MEDIUM
(F1 dep-cycle risk, F4 format-drift defense), 8 LOW, 2 PRAISE. The two MEDIUMs + F12 (pattern
ordering doc) were addressed in commit 87889ec. This flatline review is multi-model (Opus + 
OpenAI Codex + Gemini) adversarial check on the result.

**Adversarial framing**: assume nothing. The defense-in-depth pattern, the regex anchors,
the 3-model agreement on what "in-character" means, the idempotency claim, the false-positive
guards on the generic catch-all — all open to challenge. Surface BLOCKERs if you find genuine
concerns (security, correctness, architecture). Surface DISPUTED items where models might
reasonably disagree.

---

## Files Changed

 .beads/issues.jsonl                                |  87 ++---
 apps/bot/src/discord-interactions/dispatch.ts      |  90 +++--
 apps/bot/src/tests/dispatch-error-routing.test.ts  | 268 +++++++++++++
 docs/EXPRESSION-TIMING.md                          |  58 +++
 grimoires/loa/NOTES.md                             |   6 +
 grimoires/loa/a2a/bug-20260511-b6eb97/reviewer.md  | 414 +++++++++++++++++++++
 grimoires/loa/a2a/bug-20260511-b6eb97/sprint.md    | 118 ++++++
 grimoires/loa/a2a/bug-20260511-b6eb97/triage.md    | 113 ++++++
 grimoires/loa/ledger.json                          |  13 +
 .../persona-engine/src/deliver/sanitize.test.ts    | 277 +++++++++++++-
 packages/persona-engine/src/deliver/sanitize.ts    | 148 +++++++-
 packages/persona-engine/src/index.ts               |   1 +
 12 files changed, 1524 insertions(+), 69 deletions(-)

---

## Full Diff

```diff
diff --git a/apps/bot/src/discord-interactions/dispatch.ts b/apps/bot/src/discord-interactions/dispatch.ts
index f22f92f..de75e86 100644
--- a/apps/bot/src/discord-interactions/dispatch.ts
+++ b/apps/bot/src/discord-interactions/dispatch.ts
@@ -32,6 +32,7 @@ import {
   getBotClient,
   getOrCreateChannelWebhook,
   invalidateWebhookCache,
+  sanitizeOutboundBody,
   sendChatReplyViaWebhook,
   sendImageReplyViaWebhook,
   splitForDiscord,
@@ -360,6 +361,8 @@ async function doReplyAsync(args: AsyncWorkerArgs): Promise<void> {
 async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
   const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
   const t0 = Date.now();
+  // Hoisted once per dispatch · sanitizer is pure (bridgebuilder F1)
+  const errorTemplate = composeErrorBody(character.id, 'error');
 
   console.log(
     `interactions: ${character.id}/chat dispatch · invoker=${invoker.username} ` +
@@ -436,7 +439,11 @@ async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
         return;
       }
       lastToolPatchMs = now;
-      patchOriginal(interaction, ephemeral, status).catch((err) => {
+      patchOriginal(
+        interaction,
+        ephemeral,
+        sanitizeOutboundBody(status, character.id, errorTemplate),
+      ).catch((err) => {
         console.warn(
           `interactions: ${character.id}/chat onToolUse PATCH failed (best-effort):`,
           err,
@@ -610,6 +617,8 @@ async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
 async function doReplyImagegen(args: AsyncWorkerArgs): Promise<void> {
   const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
   const t0 = Date.now();
+  // Hoisted once per dispatch · sanitizer is pure (bridgebuilder F1)
+  const errorTemplate = composeErrorBody(character.id, 'error');
 
   console.log(
     `interactions: ${character.id}/imagegen dispatch · invoker=${invoker.username} ` +
@@ -691,9 +700,9 @@ async function doReplyImagegen(args: AsyncWorkerArgs): Promise<void> {
         const caption =
           `${character.displayName ?? character.id} in Freeside\n\n` +
           `${buildQuotePrefix(invoker.username, prompt).trimEnd()}`;
-        
+
         await sendImageReplyViaWebhook(webhook, character, {
-          content: caption,
+          content: sanitizeOutboundBody(caption, character.id, errorTemplate),
           imageBytes,
           filename: result.filename!,
         });
@@ -835,6 +844,8 @@ async function deliverViaWebhook(
     throw new Error('webhook path: bot client unavailable');
   }
   const webhook = await getOrCreateChannelWebhook(client, channelId);
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1)
+  const errorTemplate = composeErrorBody(character.id, 'error');
 
   // Prepend the user's prompt as a Discord blockquote on the first chunk so
   // others in the channel see context. allowedMentions:[] (set in
@@ -852,7 +863,12 @@ async function deliverViaWebhook(
   for (let i = 0; i < allChunks.length; i++) {
     if (i > 0) await sleep(FOLLOW_UP_THROTTLE_MS);
     const attachOnThisChunk = i === 0 && files && files.length > 0 ? files : undefined;
-    await sendChatReplyViaWebhook(webhook, character, allChunks[i]!, attachOnThisChunk);
+    await sendChatReplyViaWebhook(
+      webhook,
+      character,
+      sanitizeOutboundBody(allChunks[i]!, character.id, errorTemplate),
+      attachOnThisChunk,
+    );
     if (i === 0) {
       // Delete the deferred "thinking..." placeholder once the first
       // webhook chunk is up. Best-effort — if it fails (e.g., expired
@@ -896,10 +912,20 @@ async function deliverViaInteraction(
   ephemeral: boolean,
 ): Promise<void> {
   const { chunks } = formatReply(character, rawChunks);
-  await patchOriginal(interaction, ephemeral, chunks[0] ?? '');
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1)
+  const errorTemplate = composeErrorBody(character.id, 'error');
+  await patchOriginal(
+    interaction,
+    ephemeral,
+    sanitizeOutboundBody(chunks[0] ?? '', character.id, errorTemplate),
+  );
   for (let i = 1; i < chunks.length; i++) {
     await sleep(FOLLOW_UP_THROTTLE_MS);
-    await postFollowUp(interaction, ephemeral, chunks[i]!);
+    await postFollowUp(
+      interaction,
+      ephemeral,
+      sanitizeOutboundBody(chunks[i]!, character.id, errorTemplate),
+    );
   }
 }
 
@@ -986,8 +1012,16 @@ async function deliverErrorViaWebhook(
   }
   const webhook = await getOrCreateChannelWebhook(client, channelId);
   const body = formatErrorBody(character, kind);
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Defense-in-depth: body already came from formatErrorBody but the
+  // wrap closes the invariant by construction at the wire.
+  const errorTemplate = composeErrorBody(character.id, 'error');
 
-  await sendChatReplyViaWebhook(webhook, character, body);
+  await sendChatReplyViaWebhook(
+    webhook,
+    character,
+    sanitizeOutboundBody(body, character.id, errorTemplate),
+  );
 
   // Clean up the deferred "thinking" placeholder (Pattern B convention).
   void deleteOriginal(interaction).catch((err) => {
@@ -1020,15 +1054,23 @@ async function deliverError(
   ephemeral: boolean,
   kind: ErrorClass,
 ): Promise<void> {
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Defense-in-depth: formatErrorBody already produces in-character text,
+  // but the sanitize wrap closes the invariant by construction at the wire
+  // (a future drift that bypasses deliverError gets caught here too).
+  const errorTemplate = composeErrorBody(character.id, 'error');
+
   if (ephemeral) {
-    await patchOriginal(interaction, true, formatErrorBody(character, kind)).catch(
-      (patchErr) => {
-        console.error(
-          `interactions: ${character.id} error PATCH (ephemeral) failed:`,
-          patchErr,
-        );
-      },
-    );
+    await patchOriginal(
+      interaction,
+      true,
+      sanitizeOutboundBody(formatErrorBody(character, kind), character.id, errorTemplate),
+    ).catch((patchErr) => {
+      console.error(
+        `interactions: ${character.id} error PATCH (ephemeral) failed:`,
+        patchErr,
+      );
+    });
     return;
   }
   try {
@@ -1039,14 +1081,16 @@ async function deliverError(
       webhookErr,
     );
     invalidateWebhookCache(channelId);
-    await patchOriginal(interaction, false, formatErrorBody(character, kind)).catch(
-      (patchErr) => {
-        console.error(
-          `interactions: ${character.id} error PATCH after webhook fallback also failed:`,
-          patchErr,
-        );
-      },
-    );
+    await patchOriginal(
+      interaction,
+      false,
+      sanitizeOutboundBody(formatErrorBody(character, kind), character.id, errorTemplate),
+    ).catch((patchErr) => {
+      console.error(
+        `interactions: ${character.id} error PATCH after webhook fallback also failed:`,
+        patchErr,
+      );
+    });
   }
 }
 
diff --git a/apps/bot/src/tests/dispatch-error-routing.test.ts b/apps/bot/src/tests/dispatch-error-routing.test.ts
new file mode 100644
index 0000000..18362cb
--- /dev/null
+++ b/apps/bot/src/tests/dispatch-error-routing.test.ts
@@ -0,0 +1,268 @@
+/**
+ * dispatch-error-routing.test.ts — error-voice invariant audit
+ * (bug-20260511-b6eb97 · FAGAN architect-lock A4 closure)
+ *
+ * Codifies the contract that dispatch.ts depends on:
+ *
+ *   1. The dispatch catch at dispatch.ts:593-598 routes through
+ *      `deliverError(..., 'error')` → `formatErrorBody(character, kind)` →
+ *      `stripVoiceDisciplineDrift(composeErrorBody(...))`. The body that
+ *      lands on Discord is the in-character template.
+ *
+ *   2. Every body-bearing Discord write surface in dispatch.ts is wrapped
+ *      through `sanitizeOutboundBody(content, character.id)` as defense-
+ *      in-depth. If a future drift introduces a path that bypasses
+ *      `deliverError`, the sanitizer substitutes any raw upstream-API-
+ *      error shape with `composeErrorBody(characterId, 'error')`.
+ *
+ * The test surface targets PERSONA-ENGINE exports (composeErrorBody,
+ * sanitizeOutboundBody, getErrorTemplate, stripVoiceDisciplineDrift)
+ * because driving `doReplyChat` end-to-end would require a sizeable
+ * dependency-injection refactor of dispatch.ts. Per FAGAN agent
+ * afb548531d1fb79d5 finding A4 (operator-confirmed via /bug 2026-05-11),
+ * the catch routing was already correct by code reading; the value of
+ * this test is locking in the post-fix invariant — proving that EVERY
+ * raw error shape produced upstream gets substituted to in-character
+ * voice at the medium boundary.
+ *
+ * Coverage:
+ *   - All 8 raw-error throw shapes from the upstream codebase
+ *     (reply.ts:934 bedrock-direct, reply.ts:984 agent-gateway,
+ *     orchestrator/index.ts:536 SDK-subtype, orchestrator/index.ts:556
+ *     empty-completion, dispatch.ts:1083 REST-wrapper, raw API body,
+ *     HTTP Internal Server Error, raw JSON error envelope).
+ *   - Both characters (ruggy + satoshi) — voice differs per character.
+ *   - `String(err)` form (Error: prefix) variants — defense-in-depth.
+ *   - LLM success passthrough (no false-positive substitution).
+ *   - Composition with `stripVoiceDisciplineDrift` (chain order is
+ *     stripVoiceDisciplineDrift → sanitizeOutboundBody at the wire).
+ */
+
+import { describe, test, expect } from 'bun:test';
+import {
+  composeErrorBody,
+  sanitizeOutboundBody,
+  stripVoiceDisciplineDrift,
+} from '@freeside-characters/persona-engine';
+
+// ───────────────────────────────────────────────────────────────────────
+// Raw-error throw shapes — each MUST be substituted to in-character.
+//
+// These literals match the exact shapes produced upstream:
+//   reply.ts:934 → `bedrock chat error: ${response.status} ${body}`
+//   reply.ts:984 → `freeside agent-gateway chat error: ${response.status} ${body}`
+//   orchestrator/index.ts:536 → `orchestrator: SDK error subtype=${...}`
+//   orchestrator/index.ts:556 → `orchestrator: SDK query completed without ...`
+//   dispatch.ts:1083 → `interactions: PATCH @original failed status=${...} body=${...}`
+//   dispatch.ts:1113 → `interactions: follow-up POST failed status=${...} body=${...}`
+//   Anthropic SDK   → `API Error: ${status} ${body}` (verbatim from upstream)
+//   HTTP body       → `Internal Server Error`
+//   Raw envelope    → `{"type":"error","error":{...}}`
+// ───────────────────────────────────────────────────────────────────────
+
+interface RawErrorCase {
+  readonly label: string;
+  readonly body: string;
+}
+
+const RAW_ERROR_CASES: readonly RawErrorCase[] = [
+  {
+    label: 'anthropic api error (Bedrock 500)',
+    body: 'API Error: 500 Internal Server Error',
+  },
+  {
+    label: 'anthropic api error (Bedrock 529 overloaded)',
+    body: 'API Error: 529 {"type":"error","error":{"type":"overloaded_error"}}',
+  },
+  {
+    label: 'http internal server error',
+    body: 'Internal Server Error',
+  },
+  {
+    label: 'bedrock direct throw (reply.ts:934)',
+    body: 'bedrock chat error: 500 {"message":"upstream timeout"}',
+  },
+  {
+    label: 'agent-gateway throw (reply.ts:984)',
+    body: 'freeside agent-gateway chat error: 503 Service Unavailable',
+  },
+  {
+    label: 'orchestrator SDK subtype throw (index.ts:536)',
+    body: 'orchestrator: SDK error subtype=error_during_execution errors=API call failed',
+  },
+  {
+    label: 'orchestrator empty completion throw (index.ts:556)',
+    body: 'orchestrator: SDK query completed without an assistant text response. tool_uses=2',
+  },
+  {
+    label: 'raw anthropic JSON envelope',
+    body: '{"type":"error","error":{"type":"api_error","message":"upstream timeout"}}',
+  },
+  {
+    label: 'dispatch REST wrapper (PATCH @original)',
+    body: 'interactions: PATCH @original failed status=429 body={"retry_after":1.234}',
+  },
+  {
+    label: 'dispatch REST wrapper (follow-up POST)',
+    body: 'interactions: follow-up POST failed status=403 body={"code":50013}',
+  },
+];
+
+// Patterns that MUST NOT appear in any outbound body after sanitization.
+// These are the substrings the operator + FAGAN A4 flagged as the leak class.
+const FORBIDDEN_SUBSTRINGS: readonly string[] = [
+  'API Error',
+  'Internal Server Error',
+  'bedrock chat error',
+  'freeside agent-gateway chat error',
+  'orchestrator: SDK error',
+  'orchestrator: SDK query completed',
+  '{"type":"error"',
+  'interactions: PATCH @original failed status=',
+  'interactions: follow-up POST failed status=',
+];
+
+const CHARACTERS = ['ruggy', 'satoshi'] as const;
+
+describe('dispatch error-routing · raw-error substitution invariant', () => {
+  for (const characterId of CHARACTERS) {
+    for (const { label, body } of RAW_ERROR_CASES) {
+      test(`${characterId} · ${label} → in-character substrate template`, () => {
+        // Simulate the hypothetical leak: a raw error body arrives at the
+        // Discord write surface without going through deliverError. The
+        // sanitizer wraps every such surface in dispatch.ts; this proves
+        // the wrap closes the invariant.
+        const sanitized = sanitizeOutboundBody(body, characterId, composeErrorBody(characterId, 'error'));
+
+        // The substituted output is the character's 'error' template.
+        expect(sanitized).toBe(composeErrorBody(characterId, 'error'));
+
+        // No forbidden substring leaks.
+        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
+          expect(sanitized).not.toContain(forbidden);
+        }
+      });
+
+      test(`${characterId} · ${label} · String(err) prefix variant → substrate template`, () => {
+        // `String(new Error(msg))` produces "Error: <msg>". A future
+        // drift that passes String(err) instead of err.message would still
+        // be caught.
+        const withErrorPrefix = `Error: ${body}`;
+        const sanitized = sanitizeOutboundBody(withErrorPrefix, characterId, composeErrorBody(characterId, 'error'));
+        expect(sanitized).toBe(composeErrorBody(characterId, 'error'));
+        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
+          expect(sanitized).not.toContain(forbidden);
+        }
+      });
+    }
+  }
+});
+
+describe('dispatch error-routing · in-character template passthrough', () => {
+  // formatErrorBody(character, kind) is what deliverError invokes today:
+  // it returns stripVoiceDisciplineDrift(composeErrorBody(character.id, kind)).
+  // The sanitizer must be a no-op on this output (idempotency proof).
+  const KINDS = ['timeout', 'empty', 'error'] as const;
+
+  for (const characterId of CHARACTERS) {
+    for (const kind of KINDS) {
+      test(`${characterId} · formatErrorBody(${kind}) passes through sanitizer verbatim`, () => {
+        const body = stripVoiceDisciplineDrift(composeErrorBody(characterId, kind));
+        const sanitized = sanitizeOutboundBody(body, characterId, composeErrorBody(characterId, 'error'));
+        expect(sanitized).toBe(body);
+      });
+    }
+  }
+});
+
+describe('dispatch error-routing · LLM success passthrough', () => {
+  // LLM success output must traverse the sanitizer without modification.
+  // These cases cover the chunk shapes that the wired call sites
+  // (dispatch.ts:860 deliverViaWebhook, dispatch.ts:909/916
+  // deliverViaInteraction) pass.
+
+  test('ruggy success — lowercase, slangy, multi-paragraph passes through', () => {
+    const llmOutput =
+      'yo, ruggy here. been watching the bear-cave all morning. ' +
+      'three transfers caught my eye — wait, ledger says four.\n\n' +
+      'want to peek? lmk.';
+    const cleaned = stripVoiceDisciplineDrift(llmOutput);
+    const sanitized = sanitizeOutboundBody(cleaned, 'ruggy', composeErrorBody('ruggy', 'error'));
+    expect(sanitized).toBe(cleaned);
+  });
+
+  test('satoshi success — sentence case, gnomic passes through', () => {
+    const llmOutput =
+      'The bear watches. ' +
+      'Four windows opened today. ' +
+      'The signal is unclear, but the pattern holds.';
+    const cleaned = stripVoiceDisciplineDrift(llmOutput);
+    const sanitized = sanitizeOutboundBody(cleaned, 'satoshi', composeErrorBody('satoshi', 'error'));
+    expect(sanitized).toBe(cleaned);
+  });
+
+  test('emoji-rich + onchain identifiers pass through', () => {
+    const llmOutput =
+      '<:mibera_acquire:111> spotted, <:bear_pog:222>. ' +
+      'transfer_from_wallet at 0xabc...def.';
+    const sanitized = sanitizeOutboundBody(llmOutput, 'ruggy', composeErrorBody('ruggy', 'error'));
+    expect(sanitized).toBe(llmOutput);
+  });
+
+  test('code block with API-shaped content (no anchor match) passes through', () => {
+    // The sanitizer is anchored at start-of-string; embedded shapes in
+    // code blocks must NOT trigger a false-positive substitution.
+    const llmOutput =
+      'heres the shape:\n\n' +
+      '```\nstatus=200 body={"ok":true}\nAPI Error: 500 (example)\n```\n\n' +
+      'basic.';
+    const sanitized = sanitizeOutboundBody(llmOutput, 'ruggy', composeErrorBody('ruggy', 'error'));
+    expect(sanitized).toBe(llmOutput);
+  });
+});
+
+describe('dispatch error-routing · transform chain order', () => {
+  // The wire order in dispatch.ts:
+  //   1. result.chunks → stripVoiceDisciplineDrift (cleanedChunks)
+  //   2. cleanedChunks → sendChatReplyViaWebhook / patchOriginal / postFollowUp
+  //      (sanitizeOutboundBody wraps the content arg at the call site,
+  //       receiving the pre-computed errorTemplate hoisted at function entry)
+  //
+  // Sanitize is OUTERMOST — last transform before the wire. This test
+  // verifies the chain produces the same result whether applied in two
+  // steps or composed.
+
+  test('compose chain: stripVoiceDisciplineDrift then sanitizeOutboundBody on success', () => {
+    const llmOutput = 'yo. observed — laid-back day.';
+    // Step 1: voice discipline replaces em-dash → ", "
+    const voiced = stripVoiceDisciplineDrift(llmOutput);
+    expect(voiced).toBe('yo. observed, laid-back day.');
+    // Step 2: sanitize passes through (no error pattern match)
+    const wired = sanitizeOutboundBody(voiced, 'ruggy', composeErrorBody('ruggy', 'error'));
+    expect(wired).toBe(voiced);
+  });
+
+  test('compose chain: stripVoiceDisciplineDrift then sanitizeOutboundBody on error template', () => {
+    // formatErrorBody runs stripVoiceDisciplineDrift internally; the
+    // sanitize wrap at the call site must be a no-op on the output.
+    const errorTemplate = composeErrorBody('ruggy', 'error');
+    const voiced = stripVoiceDisciplineDrift(errorTemplate);
+    const wired = sanitizeOutboundBody(voiced, 'ruggy', errorTemplate);
+    expect(wired).toBe(voiced);
+    expect(wired).toBe("something snapped on ruggy's end. cool to retry?");
+  });
+
+  test('compose chain catches raw error even when stripVoiceDisciplineDrift runs first', () => {
+    // Hypothetical drift: a raw error body slips through the chunks
+    // pipeline. stripVoiceDisciplineDrift won't touch the error-shape
+    // tokens; sanitizeOutboundBody must catch it at the wire.
+    const rawError = 'API Error: 500 Internal Server Error';
+    const voiced = stripVoiceDisciplineDrift(rawError);
+    // voice-discipline doesn't strip the error shape — that's the
+    // sanitizer's job.
+    expect(voiced).toContain('API Error');
+    const wired = sanitizeOutboundBody(voiced, 'ruggy', composeErrorBody('ruggy', 'error'));
+    expect(wired).toBe(composeErrorBody('ruggy', 'error'));
+    expect(wired).not.toContain('API Error');
+  });
+});
diff --git a/docs/EXPRESSION-TIMING.md b/docs/EXPRESSION-TIMING.md
index 16f91d1..460865f 100644
--- a/docs/EXPRESSION-TIMING.md
+++ b/docs/EXPRESSION-TIMING.md
@@ -147,3 +147,61 @@ intermediate state.
 - **Per-tool tempo modulation** (slower for codex, faster for score) —
   the mood map alone differentiates by emoji choice; tempo modulation
   would be a YANAGI-level refinement worth its own session.
+
+## Error-voice discipline · outbound-body sanitizer (2026-05-11)
+
+A separate surface from timing but lives in the same expression layer:
+when an upstream API throws transiently (Bedrock 500, Anthropic SDK
+error_during_execution, etc.) the raw error body MUST NOT reach Discord.
+Per CLAUDE.md "Discord-as-Material" rule: *in-character errors only —
+"cables got crossed" not "I apologize for the inconvenience"*.
+
+The dispatch catch at `apps/bot/src/discord-interactions/dispatch.ts:593-598`
+routes through `formatErrorBody → composeErrorBody` which produces the
+in-character template. As defense-in-depth (FAGAN architect-lock A4 ·
+bug-20260511-b6eb97) every body-bearing Discord write surface is wrapped
+through `sanitizeOutboundBody(content, character.id)`:
+
+| surface | location |
+|---|---|
+| onToolUse PATCH (mid-stream) | `dispatch.ts:439-444` |
+| `sendChatReplyViaWebhook` (success chunks) | `dispatch.ts:860` |
+| `patchOriginal` + `postFollowUp` (PATCH delivery) | `dispatch.ts:909`, `dispatch.ts:916` |
+| `sendChatReplyViaWebhook` (error webhook) | `dispatch.ts:1008` |
+| `patchOriginal` (error PATCH fallback × 2) | `dispatch.ts:1046`, `dispatch.ts:1066` |
+| `sendImageReplyViaWebhook` (imagegen caption) | `dispatch.ts:700` |
+
+The sanitizer pattern-matches 8 raw-error throw shapes (Anthropic API
+body, bedrock chat error, orchestrator SDK subtype + empty completion,
+agent-gateway, JSON envelope, dispatch REST wrapper, HTTP 500 body) and
+substitutes with `composeErrorBody(characterId, 'error')`. LLM success
+output and in-character template bodies pass through verbatim.
+
+### Operator telemetry
+
+On substitution emits a single line (mirrors `[cold-budget]` and
+`[chat-route]` conventions — line-oriented, no JSON envelope on the
+hot path):
+
+```
+[outbound-sanitize] character=<id> kind=raw-api-error matched=<pattern> original_len=<n>
+```
+
+**Reading the signal:**
+
+- **Zero firings over a 30-day window** → the catch routing is
+  sufficient; the sanitizer is purely belt-and-suspenders. Open audit
+  question for `/audit-sprint`: remove the helper (Loa minimalism) or
+  keep permanently (ALEXANDER craft · the rule "every write to a chat
+  medium passes through a medium-boundary sanitizer chain" generalizes).
+  Default position: KEEP.
+- **One or more firings** → there IS a real bypass path. The `matched=`
+  field surfaces which throw shape (one of 8 patterns); the `original_len`
+  surfaces whether it was a short error body or a longer one with
+  embedded JSON. Operator can grep the deploy logs for that pattern to
+  trace which code path produced the raw string.
+
+Refs:
+- `packages/persona-engine/src/deliver/sanitize.ts` (helper + patterns)
+- `grimoires/loa/a2a/bug-20260511-b6eb97/` (triage + sprint + report)
+- `~/vault/wiki/concepts/chat-medium-presentation-boundary.md` §9
diff --git a/packages/persona-engine/src/deliver/sanitize.test.ts b/packages/persona-engine/src/deliver/sanitize.test.ts
index 0eb28b3..5b789fa 100644
--- a/packages/persona-engine/src/deliver/sanitize.test.ts
+++ b/packages/persona-engine/src/deliver/sanitize.test.ts
@@ -13,11 +13,13 @@
  *   ~/vault/wiki/concepts/discord-native-register.md (2026-05-04 amend)
  */
 
-import { describe, test, expect } from 'bun:test';
+import { afterEach, beforeEach, describe, test, expect } from 'bun:test';
 import {
   stripVoiceDisciplineDrift,
   escapeDiscordMarkdown,
+  sanitizeOutboundBody,
 } from './sanitize.ts';
+import { composeErrorBody } from '../expression/error-register.ts';
 
 describe('stripVoiceDisciplineDrift · em-dash transform', () => {
   test('em-dash followed by lowercase becomes comma + space', () => {
@@ -204,3 +206,276 @@ describe('stripVoiceDisciplineDrift · composition with escapeDiscordMarkdown',
     expect(final).toBe('mibera\\_acquire, heavy lifting today');
   });
 });
+
+// ─────────────────────────────────────────────────────────────────────
+// sanitizeOutboundBody (FAGAN A4 · bug-20260511-b6eb97)
+// ─────────────────────────────────────────────────────────────────────
+
+// Test helper · mirrors what dispatch.ts call sites do: compute the
+// in-character template once and pass it as the substitution arg.
+const tmpl = (characterId: string) => composeErrorBody(characterId, 'error');
+
+describe('sanitizeOutboundBody · raw-api-error substitution', () => {
+  // Capture telemetry · restore console.warn between cases.
+  let warnings: string[] = [];
+  const originalWarn = console.warn;
+  beforeEach(() => {
+    warnings = [];
+    console.warn = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.warn = originalWarn;
+  });
+
+  test('Anthropic API error body substitutes to in-character', () => {
+    const input = 'API Error: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(out).toBe("something snapped on ruggy's end. cool to retry?");
+    expect(warnings).toHaveLength(1);
+    expect(warnings[0]).toContain('[outbound-sanitize]');
+    expect(warnings[0]).toContain('character=ruggy');
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+    expect(warnings[0]).toContain('original_len=36');
+  });
+
+  test('Anthropic API error with Error: prefix (String(err) form) substitutes', () => {
+    const input = 'Error: API Error: 529 overloaded';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe('The channel between worlds slipped. Retry on the next.');
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('Internal Server Error substitutes', () => {
+    const out = sanitizeOutboundBody('Internal Server Error', 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=http-internal-server-error');
+  });
+
+  test('bedrock chat error (reply.ts:934 throw shape) substitutes', () => {
+    const input = 'bedrock chat error: 500 {"message":"upstream timeout"}';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=bedrock-chat-error');
+  });
+
+  test('orchestrator SDK error subtype (index.ts:536 throw shape) substitutes', () => {
+    const input = 'orchestrator: SDK error subtype=error_during_execution errors=Anthropic API failed';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=orchestrator-sdk-error-subtype');
+  });
+
+  test('orchestrator empty completion (index.ts:556 throw shape) substitutes', () => {
+    const input = 'orchestrator: SDK query completed without an assistant text response. tool_uses=2';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=orchestrator-empty-completion');
+  });
+
+  test('freeside agent-gateway error (reply.ts:984 throw shape) substitutes', () => {
+    const input = 'freeside agent-gateway chat error: 503 Service Unavailable';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=freeside-agent-gateway-error');
+  });
+
+  test('raw JSON error envelope substitutes', () => {
+    const input = '{"type":"error","error":{"type":"api_error","message":"upstream timeout"}}';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
+  });
+
+  test('dispatch REST wrapper (dispatch.ts:1083 throw shape) substitutes', () => {
+    const input = 'interactions: PATCH @original failed status=429 body={"retry_after":1.234}';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=dispatch-rest-wrapper');
+  });
+
+  test('dispatch follow-up POST wrapper substitutes', () => {
+    const input = 'interactions: follow-up POST failed status=403 body={"code":50013}';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=dispatch-rest-wrapper');
+  });
+
+  test('unknown character falls through to caller-supplied substrate template', () => {
+    // Caller decides the fallback template; sanitizer is pure.
+    const out = sanitizeOutboundBody('API Error: 500', 'unknown-character', tmpl('unknown-character'));
+    expect(out).toBe('something broke. try again?');
+  });
+});
+
+describe('sanitizeOutboundBody · generic catch-all (F4 · format-drift defense)', () => {
+  let warnings: string[] = [];
+  const originalWarn = console.warn;
+  beforeEach(() => {
+    warnings = [];
+    console.warn = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.warn = originalWarn;
+  });
+
+  test('PascalCase Error class — hypothetical Anthropic SDK rename catches', () => {
+    // Format drift: Anthropic renames `API Error: 500` to `AnthropicAPIError: 500`.
+    // Specific pattern stops matching; generic catch-all fires.
+    const input = 'AnthropicAPIError: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('PascalCase Exception class catches', () => {
+    const input = 'RateLimitException at line 42 in chat.ts';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('PascalCase Failure class catches', () => {
+    const input = 'BedrockTimeoutFailure: connection reset by peer';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('Error: prefix + PascalCase class catches', () => {
+    const input = 'Error: OpenAIRateLimitException at line 42';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('Specific pattern wins over generic when both could match', () => {
+    // `AnthropicAPIError:` matches the generic, but `Error: API Error:`
+    // matches the SPECIFIC `anthropic-api-error` pattern. First-match-wins
+    // → specific attribution preserved.
+    const input = 'Error: API Error: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('Bare "Error" prefix without trailing class name does NOT match', () => {
+    // `Error: ruggy is here` — bare Error followed by lowercase prose.
+    // No specific pattern matches (no known shape after `Error: `).
+    // No generic match (needs PascalCase identifier ending in
+    // Error|Exception|Failure with at least one letter between).
+    const input = 'Error: ruggy is here, just kidding';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('Lowercase prose mentioning "rate limit error" mid-body does NOT match', () => {
+    // Real character voice — never starts with PascalCase identifier.
+    const input = 'yo. saw a rate limit error earlier but cleared.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+});
+
+describe('sanitizeOutboundBody · passthrough cases', () => {
+  let warnings: string[] = [];
+  const originalWarn = console.warn;
+  beforeEach(() => {
+    warnings = [];
+    console.warn = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.warn = originalWarn;
+  });
+
+  test('in-character ruggy error template passes through verbatim', () => {
+    const input = "cables got crossed, nothing came back. try again?";
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('in-character satoshi error template passes through verbatim', () => {
+    const input = 'The signal is unclear this window. Retry on the next.';
+    expect(sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('substrate-quiet generic passes through verbatim', () => {
+    const input = 'something broke. try again?';
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('LLM success — multi-paragraph prose passes through verbatim', () => {
+    const input =
+      "yo, ruggy here. been watching the bear-cave today, lots of " +
+      "mibera_acquire signal. the cubs are restless.\n\n" +
+      "want to peek at the ledger? lmk.";
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('LLM success — emoji-rich passes through verbatim', () => {
+    const input = '<:mibera_acquire:123> spotted three transfers today. <:bear_pog:456>';
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('LLM success — code block with API-looking content passes through (no anchor match)', () => {
+    const input =
+      "here's the shape:\n\n```\nstatus=200 body={\"ok\":true}\n```\n\nbasic.";
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('empty string passes through', () => {
+    expect(sanitizeOutboundBody('', 'ruggy', tmpl('ruggy'))).toBe('');
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('LLM prose that legitimately mentions an error number does not falsely match', () => {
+    // Anchored regex protects against mid-body false positives.
+    const input = 'saw a HTTP 500 status earlier but it self-healed.';
+    expect(sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'))).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+});
+
+describe('sanitizeOutboundBody · idempotency', () => {
+  let warnings: string[] = [];
+  const originalWarn = console.warn;
+  beforeEach(() => {
+    warnings = [];
+    console.warn = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.warn = originalWarn;
+  });
+
+  test('running twice on a raw-error body produces identical output', () => {
+    const input = 'API Error: 500 Internal Server Error';
+    const first = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    const second = sanitizeOutboundBody(first, 'ruggy', tmpl('ruggy'));
+    expect(second).toBe(first);
+    // First pass fires telemetry; second pass should not.
+    expect(warnings).toHaveLength(1);
+  });
+
+  test('running twice on LLM success produces identical output (no telemetry)', () => {
+    const input = "yo. been thinking about the cave.";
+    const first = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    const second = sanitizeOutboundBody(first, 'ruggy', tmpl('ruggy'));
+    expect(second).toBe(first);
+    expect(warnings).toHaveLength(0);
+  });
+});
diff --git a/packages/persona-engine/src/deliver/sanitize.ts b/packages/persona-engine/src/deliver/sanitize.ts
index 6abe40a..8316241 100644
--- a/packages/persona-engine/src/deliver/sanitize.ts
+++ b/packages/persona-engine/src/deliver/sanitize.ts
@@ -1,7 +1,7 @@
 /**
  * Discord markdown sanitizer + voice-discipline transforms.
  *
- * Two layers operate at the chat-medium presentation boundary
+ * Three layers operate at the chat-medium presentation boundary
  * (per `[[chat-medium-presentation-boundary]]` doctrine):
  *
  * 1. `escapeDiscordMarkdown` — escapes Discord format chars `_*~|` outside
@@ -17,9 +17,15 @@
  *    way." Universal · zero opt-out · code-block-safe · idempotent (per
  *    architect lock A4, cmp-boundary-architecture cycle SDD §13).
  *
+ * 3. `sanitizeOutboundBody` — substitutes raw upstream-API-error shapes
+ *    with the in-character substrate-error template. Targets the
+ *    in-character-only invariant for error voice (FAGAN architect-lock
+ *    A4 · bug-20260511-b6eb97 · 2026-05-11). Apply at every outbound
+ *    chat-medium write surface, OUTERMOST.
+ *
  * Apply these ONLY to text being sent to Discord, AFTER the LLM has
  * generated voice output and embed fields are constructed. Order:
- * `stripVoiceDisciplineDrift` → `escapeDiscordMarkdown`.
+ * `stripVoiceDisciplineDrift` → `escapeDiscordMarkdown` → `sanitizeOutboundBody`.
  *
  * Per persona-doc rule: persona writes plain text; bot guarantees
  * correctness via these transforms. The LLM never thinks about escaping
@@ -343,3 +349,141 @@ function stripTrailingClosings(text: string): string {
   }
   return out;
 }
+
+// =============================================================================
+// Outbound-body sanitizer (FAGAN A4 · bug-20260511-b6eb97 · 2026-05-11)
+// =============================================================================
+
+/**
+ * Raw upstream-API-error pattern · used by `sanitizeOutboundBody`.
+ *
+ * Each pattern is anchored at start-of-string (with an optional `Error: `
+ * prefix for `String(err)` forms) so legitimate prose containing the
+ * substring mid-body never matches.
+ *
+ * Pattern ordering rationale (first-match-wins, bridgebuilder F12 ·
+ * 2026-05-11):
+ *   1. SPECIFIC patterns first — each names a known upstream throw shape
+ *      so the `matched=` telemetry field attributes origin correctly.
+ *      `anthropic-api-error` before `bedrock-chat-error` etc. is by
+ *      callsite frequency observed in production logs (Anthropic SDK is
+ *      the dominant throw class today).
+ *   2. GENERIC catch-all LAST — `generic-error-class-prefix` is the
+ *      last-line defense against upstream format drift (bridgebuilder
+ *      F4 · 2026-05-11). When a future SDK renames `API Error:` to
+ *      `AnthropicAPIError:` the specific pattern stops matching but the
+ *      generic shape catches it. Telemetry attributes to the generic
+ *      pattern → operator sees a previously-known throw class started
+ *      hitting the catch-all → cue to add a more-specific entry.
+ *
+ * The ordering is INVARIANT to functional correctness (every pattern
+ * substitutes the same template). It only affects telemetry attribution.
+ */
+interface RawApiErrorPattern {
+  readonly name: string;
+  readonly regex: RegExp;
+}
+
+const RAW_API_ERROR_PATTERNS: readonly RawApiErrorPattern[] = [
+  // Anthropic SDK / Bedrock direct: `API Error: 500 …`
+  { name: 'anthropic-api-error', regex: /^(?:Error: )?API Error: \d+/ },
+  // Generic HTTP body: `Internal Server Error`
+  { name: 'http-internal-server-error', regex: /^(?:Error: )?Internal Server Error/i },
+  // reply.ts:934 direct Bedrock throw: `bedrock chat error: 500 {…}`
+  { name: 'bedrock-chat-error', regex: /^(?:Error: )?bedrock chat error: \d+/i },
+  // orchestrator/index.ts:536 throw: `orchestrator: SDK error subtype=…`
+  { name: 'orchestrator-sdk-error-subtype', regex: /^(?:Error: )?orchestrator: SDK error subtype=/ },
+  // orchestrator/index.ts:556 throw: `orchestrator: SDK query completed without …`
+  { name: 'orchestrator-empty-completion', regex: /^(?:Error: )?orchestrator: SDK query completed without/ },
+  // reply.ts:984 throw: `freeside agent-gateway chat error: 500 …`
+  { name: 'freeside-agent-gateway-error', regex: /^(?:Error: )?freeside agent-gateway chat error: \d+/i },
+  // Raw Anthropic JSON error envelope: `{"type":"error",…}`
+  { name: 'raw-json-error-envelope', regex: /^(?:Error: )?\{"type":"error"/ },
+  // dispatch.ts:1083 / 1113 internal REST throw shape
+  {
+    name: 'dispatch-rest-wrapper',
+    regex: /^(?:Error: )?interactions: (?:PATCH @original|follow-up POST) failed status=\d{3}/,
+  },
+  // GENERIC CATCH-ALL (bridgebuilder F4 · 2026-05-11): last-line defense
+  // against upstream format drift. Matches any PascalCase identifier ending
+  // in Error/Exception/Failure at start-of-string (with optional `Error: `
+  // prefix for String(err) forms). The trailing `\b` requires a word
+  // boundary — so `Error` alone (5 chars then end-of-string) does NOT match
+  // here (it requires the leading [A-Z][a-zA-Z]+ to be non-empty BEFORE
+  // the Error|Exception|Failure suffix); the bare `Error: ` prefix is
+  // handled by the (?:Error: )? optional capture in the specific patterns
+  // above. False-positive risk: a character would have to start a reply
+  // with a PascalCase identifier ending in Error/Exception/Failure — not
+  // a shape ruggy/satoshi voice produces (lowercase prose · gnomic
+  // sentence-case · neither uses PascalCase identifiers as voice openers).
+  {
+    name: 'generic-error-class-prefix',
+    regex: /^(?:Error: )?[A-Z][a-zA-Z]+(?:Error|Exception|Failure)\b/,
+  },
+];
+
+/**
+ * Substitute raw upstream-API-error shapes with the caller-supplied
+ * in-character substrate error template. Defense-in-depth at the
+ * chat-medium write boundary.
+ *
+ * Closes FAGAN architect-lock A4 (agent afb548531d1fb79d5 · bug
+ * 20260511-b6eb97 · 2026-05-11): the dispatch catch at
+ * dispatch.ts:593-598 already routes through `formatErrorBody` →
+ * `composeErrorBody`, but the in-character-only invariant should be
+ * LOAD-BEARING at the boundary, not inductively at every catch site. A
+ * future Discord write surface that forgets to route through
+ * `deliverError` could leak; this sanitizer makes the rule
+ * construction-true at the wire.
+ *
+ * Pure helper · no module-level dependencies on `expression/` (per
+ * bridgebuilder F1 · 2026-05-11): callers supply the substitution
+ * template. This keeps `deliver/sanitize.ts` free of the character
+ * registry coupling that the prior signature implied.
+ *
+ * Behavior:
+ *   - LLM success output                    → passes through verbatim
+ *   - In-character template body            → passes through verbatim
+ *   - Raw upstream-API-error shape          → `errorTemplate` (verbatim)
+ *
+ * Idempotent: a substituted body equals `errorTemplate` — provided the
+ * template itself does not match any `RAW_API_ERROR_PATTERNS` regex
+ * (the canonical `composeErrorBody(characterId, 'error')` outputs
+ * "something snapped on ruggy's end. cool to retry?",
+ * "The channel between worlds slipped. Retry on the next.", and the
+ * substrate-quiet "something broke. try again?" all clear the regex
+ * shapes). A second pass is a no-op.
+ *
+ * On substitution emits structured telemetry (line-oriented · mirrors
+ * `[cold-budget]` and `[chat-route]` conventions at dispatch.ts:584 +
+ * reply.ts:761 · no JSON envelope on the hot path):
+ *
+ *   [outbound-sanitize] character=<id> kind=raw-api-error matched=<pattern> original_len=<n>
+ *
+ * Operators watching this log line in production can verify whether the
+ * leak vector was real (firings observed) or purely belt-and-suspenders
+ * (zero firings over the observation window).
+ *
+ * Refs:
+ *   FAGAN agent afb548531d1fb79d5 finding A4
+ *   bridgebuilder PR #54 findings F1 (pure helper) + F4 (catch-all) + F12 (ordering)
+ *   grimoires/loa/a2a/bug-20260511-b6eb97/triage.md · sprint.md
+ *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
+ *   CLAUDE.md "Discord-as-Material" rule: in-character errors only
+ */
+export function sanitizeOutboundBody(
+  content: string,
+  characterId: string,
+  errorTemplate: string,
+): string {
+  if (!content) return content;
+  for (const { name, regex } of RAW_API_ERROR_PATTERNS) {
+    if (regex.test(content)) {
+      console.warn(
+        `[outbound-sanitize] character=${characterId} kind=raw-api-error matched=${name} original_len=${content.length}`,
+      );
+      return errorTemplate;
+    }
+  }
+  return content;
+}
diff --git a/packages/persona-engine/src/index.ts b/packages/persona-engine/src/index.ts
index 8ff3eee..9448142 100644
--- a/packages/persona-engine/src/index.ts
+++ b/packages/persona-engine/src/index.ts
@@ -114,6 +114,7 @@ export {
 export {
   stripVoiceDisciplineDrift,
   escapeDiscordMarkdown,
+  sanitizeOutboundBody,
 } from './deliver/sanitize.ts';
 export type { VoiceDisciplineOpts } from './deliver/sanitize.ts';
 
```
