# PR #54 v4 · FINAL verification pass (post all flatline triangulation rounds)

**Branch**: `fix/sanitize-outbound-body-bug-20260511-b6eb97` (5 commits ahead of main)
**Commits**:
e246dac feat(sanitize): broaden zero-width strip to \p{Cf} + defer confusables (flatline v3)
fcc4f3b feat(flatline): wire hounfour to headless CLI adapters + close BLOCKER #1 + bracketed discord.js patterns + zero-width strip
db7169f fix(sanitize): close flatline C1 BLOCKER + C4 voice-discipline + G2 regex tightening
87889ec fix(sanitize): address bridgebuilder F1 + F4 + F12 inline
d88e37b fix(error-voice): sanitize outbound body to enforce in-character-only invariant at chat-medium boundary

**Round-by-round closure summary**:
- d88e37b: initial sanitizer + 8 anchored patterns + dispatch wiring
- 87889ec: bridgebuilder F1 (purity) + F4 (generic catch-all) + F12 (ordering doc)
- db7169f: flatline-v0 (single-model Opus bridgebuilder) found C1 (placement) + C4 (voice-discipline) + G2 (regex tightening)
- fcc4f3b: headless CLI flatline pipeline + v1/v2 BLOCKER #1 (whitespace) + SKP-001 (zero-width) + SKP-002 (bracketed discord.js) + IMP-002 (invariant) + IMP-005 (Unicode lookalike)
- e246dac (HEAD): flatline-v3 IMP-001 broad \p{Cf} upgrade + SKP-001 confusables DEFERRED with audit decision

**Final defense layers**:
1. \p{Cf} format-char strip (zero-width + bidi isolates + ALM + Soft Hyphen)
2. NFKC normalize (full-width Unicode → ASCII)
3. trimStart (leading whitespace)
4. 11 anchored RAW_API_ERROR_PATTERNS (Anthropic/Bedrock/Orchestrator/Gateway/JSON/REST/discord-js × 2/generic-PascalCase)
5. Caller-supplied stripVoiceDisciplineDrift(composeErrorBody) substitution
6. Sanitize OUTERMOST in dispatch chain (raw → sanitize → prefix → split → wire)

**Adversarial framing**: pressure-test the FINAL state. Look for orthogonal-defense interaction bugs, new bypass classes the prior 4 rounds missed, or telemetry/observability gaps.

---

## Files Changed

 .beads/issues.jsonl                                |   87 +-
 .loa.config.yaml                                   |   99 ++
 apps/bot/src/discord-interactions/dispatch.ts      |  120 +-
 apps/bot/src/tests/dispatch-error-routing.test.ts  |  343 +++++
 docs/EXPRESSION-TIMING.md                          |   59 +
 grimoires/loa/NOTES.md                             |    8 +
 .../flatline-input/pr-54-codex-review.json         |   67 +
 .../flatline-input/pr-54-diff-v2.md                | 1182 ++++++++++++++++
 .../flatline-input/pr-54-diff-v3.md                | 1418 ++++++++++++++++++++
 .../flatline-input/pr-54-diff.md                   | 1047 +++++++++++++++
 .../flatline-input/pr-54-flatline-headless-log.txt |   35 +
 .../pr-54-flatline-headless-result.json            |  130 ++
 .../flatline-input/pr-54-flatline-log.txt          |   50 +
 .../flatline-input/pr-54-flatline-result.json      |   36 +
 .../flatline-input/pr-54-flatline-v2-log.txt       |   34 +
 .../flatline-input/pr-54-flatline-v2-result.json   |  177 +++
 .../flatline-input/pr-54-flatline-v3-log.txt       |   35 +
 .../flatline-input/pr-54-flatline-v3-result.json   |  106 ++
 .../flatline-input/pr-54-gemini-review.txt         |   59 +
 grimoires/loa/a2a/bug-20260511-b6eb97/reviewer.md  |  414 ++++++
 grimoires/loa/a2a/bug-20260511-b6eb97/sprint.md    |  118 ++
 grimoires/loa/a2a/bug-20260511-b6eb97/triage.md    |  113 ++
 grimoires/loa/ledger.json                          |   13 +
 grimoires/loa/{prd.md => prd-ride-baseline.md}     |    0
 grimoires/loa/{sdd.md => sdd-ride-baseline.md}     |    0
 grimoires/loa/{sprint.md => sprint-v07a1.md}       |    0
 .../persona-engine/src/deliver/sanitize.test.ts    |  597 +++++++-
 packages/persona-engine/src/deliver/sanitize.ts    |  191 ++-
 packages/persona-engine/src/index.ts               |    1 +
 29 files changed, 6467 insertions(+), 72 deletions(-)

---

## Full Diff

```diff
diff --git a/apps/bot/src/discord-interactions/dispatch.ts b/apps/bot/src/discord-interactions/dispatch.ts
index f22f92f..f11d8e7 100644
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
@@ -360,6 +361,14 @@ async function doReplyAsync(args: AsyncWorkerArgs): Promise<void> {
 async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
   const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
   const t0 = Date.now();
+  // Hoisted once per dispatch · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip so substituted bodies
+  // and normal error bodies share identical treatment (codex C4 · 2026-05-11).
+  // IMP-006: This is a deliberate trade-off. The sanitizer substitutes
+  // with the 'error' kind template, even if the upstream failure was a
+  // 'timeout' or 'empty' class. The primary goal is preventing a raw
+  // API error leak; kind-attribution is secondary.
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
 
   console.log(
     `interactions: ${character.id}/chat dispatch · invoker=${invoker.username} ` +
@@ -436,7 +445,11 @@ async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
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
@@ -610,6 +623,14 @@ async function doReplyChat(args: AsyncWorkerArgs): Promise<void> {
 async function doReplyImagegen(args: AsyncWorkerArgs): Promise<void> {
   const { interaction, config, character, prompt, ephemeral, channelId, invoker } = args;
   const t0 = Date.now();
+  // Hoisted once per dispatch · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip so substituted bodies
+  // and normal error bodies share identical treatment (codex C4 · 2026-05-11).
+  // IMP-006: This is a deliberate trade-off. The sanitizer substitutes
+  // with the 'error' kind template, even if the upstream failure was a
+  // 'timeout' or 'empty' class. The primary goal is preventing a raw
+  // API error leak; kind-attribution is secondary.
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
 
   console.log(
     `interactions: ${character.id}/imagegen dispatch · invoker=${invoker.username} ` +
@@ -691,9 +712,9 @@ async function doReplyImagegen(args: AsyncWorkerArgs): Promise<void> {
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
@@ -835,16 +856,28 @@ async function deliverViaWebhook(
     throw new Error('webhook path: bot client unavailable');
   }
   const webhook = await getOrCreateChannelWebhook(client, channelId);
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip (codex C4 · 2026-05-11).
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
+
+  // Sanitize raw chunks BEFORE adding the quote prefix (codex C1 · 2026-05-11).
+  // The sanitizer patterns are anchored at `^`, so a raw-error-shaped chunk
+  // would NOT match `^API Error:` once a quote prefix is prepended. Sanitize
+  // first → prefix second → split → wire. This makes the defense-in-depth
+  // load-bearing on the success path (not just the error path).
+  const sanitizedChunks = chunks.map((c) =>
+    sanitizeOutboundBody(c, character.id, errorTemplate),
+  );
 
   // Prepend the user's prompt as a Discord blockquote on the first chunk so
   // others in the channel see context. allowedMentions:[] (set in
   // sendChatReplyViaWebhook) prevents the @ from triggering a ping.
   const quote = buildQuotePrefix(authorUsername, prompt);
-  const firstWithQuote = quote + chunks[0]!;
+  const firstWithQuote = quote + sanitizedChunks[0]!;
   const allChunks =
     firstWithQuote.length <= DISCORD_CHAR_LIMIT
-      ? [firstWithQuote, ...chunks.slice(1)]
-      : [...splitForDiscord(firstWithQuote, DISCORD_CHAR_LIMIT), ...chunks.slice(1)];
+      ? [firstWithQuote, ...sanitizedChunks.slice(1)]
+      : [...splitForDiscord(firstWithQuote, DISCORD_CHAR_LIMIT), ...sanitizedChunks.slice(1)];
 
   // V0.7-A.3: attach env-aware grail image bytes to the FIRST chunk only —
   // image follows voice text per ALEXANDER craft lens (spec §5). Subsequent
@@ -852,7 +885,12 @@ async function deliverViaWebhook(
   for (let i = 0; i < allChunks.length; i++) {
     if (i > 0) await sleep(FOLLOW_UP_THROTTLE_MS);
     const attachOnThisChunk = i === 0 && files && files.length > 0 ? files : undefined;
-    await sendChatReplyViaWebhook(webhook, character, allChunks[i]!, attachOnThisChunk);
+    await sendChatReplyViaWebhook(
+      webhook,
+      character,
+      allChunks[i]!,
+      attachOnThisChunk,
+    );
     if (i === 0) {
       // Delete the deferred "thinking..." placeholder once the first
       // webhook chunk is up. Best-effort — if it fails (e.g., expired
@@ -895,7 +933,17 @@ async function deliverViaInteraction(
   rawChunks: string[],
   ephemeral: boolean,
 ): Promise<void> {
-  const { chunks } = formatReply(character, rawChunks);
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip (codex C4 · 2026-05-11).
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
+  // Sanitize raw chunks BEFORE formatReply prepends `**DisplayName**\n\n`
+  // (codex C1 · 2026-05-11). The sanitizer's `^`-anchored patterns would
+  // not match a raw-error chunk once the name prefix is in place; sanitize
+  // first → format second → wire.
+  const sanitizedRaw = rawChunks.map((c) =>
+    sanitizeOutboundBody(c, character.id, errorTemplate),
+  );
+  const { chunks } = formatReply(character, sanitizedRaw);
   await patchOriginal(interaction, ephemeral, chunks[0] ?? '');
   for (let i = 1; i < chunks.length; i++) {
     await sleep(FOLLOW_UP_THROTTLE_MS);
@@ -986,8 +1034,17 @@ async function deliverErrorViaWebhook(
   }
   const webhook = await getOrCreateChannelWebhook(client, channelId);
   const body = formatErrorBody(character, kind);
-
-  await sendChatReplyViaWebhook(webhook, character, body);
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip (codex C4 · 2026-05-11).
+  // Defense-in-depth: body already came from formatErrorBody but the
+  // wrap closes the invariant by construction at the wire.
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
+
+  await sendChatReplyViaWebhook(
+    webhook,
+    character,
+    sanitizeOutboundBody(body, character.id, errorTemplate),
+  );
 
   // Clean up the deferred "thinking" placeholder (Pattern B convention).
   void deleteOriginal(interaction).catch((err) => {
@@ -1020,15 +1077,24 @@ async function deliverError(
   ephemeral: boolean,
   kind: ErrorClass,
 ): Promise<void> {
+  // Hoisted once per delivery · sanitizer is pure (bridgebuilder F1).
+  // Match formatErrorBody's voice-discipline strip (codex C4 · 2026-05-11).
+  // Defense-in-depth: formatErrorBody already produces in-character text,
+  // but the sanitize wrap closes the invariant by construction at the wire
+  // (a future drift that bypasses deliverError gets caught here too).
+  const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'));
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
@@ -1039,14 +1105,16 @@ async function deliverError(
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
index 0000000..6c65c3b
--- /dev/null
+++ b/apps/bot/src/tests/dispatch-error-routing.test.ts
@@ -0,0 +1,343 @@
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
+
+// ─────────────────────────────────────────────────────────────────────
+// CODEX C1 REGRESSION GUARDS (2026-05-11)
+//
+// Anchored `^` patterns are defeated if a prefix is prepended BEFORE
+// sanitize fires. dispatch.ts must sanitize the raw chunk FIRST, then
+// add framing (quote prefix in deliverViaWebhook · `**DisplayName**\n\n`
+// in deliverViaInteraction). These tests pin the correct ordering AND
+// document the failure mode of the inverted (buggy) ordering, so future
+// refactors cannot silently move sanitize outside the prefix step.
+// ─────────────────────────────────────────────────────────────────────
+
+describe('dispatch error-routing · codex C1 prefix-ordering regression', () => {
+  test('CORRECT ORDER: sanitize chunk → prepend quote → wire (deliverViaWebhook)', () => {
+    // Mirrors dispatch.ts:851-858 (post-fix). LLM emits a raw error in chunks[0];
+    // sanitize must run BEFORE buildQuotePrefix is prepended.
+    const rawChunk = 'API Error: 500 Internal Server Error';
+    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
+    const sanitized = sanitizeOutboundBody(rawChunk, 'ruggy', errorTemplate);
+    const quote = '> @user asked: tell me about the bears\n\n';
+    const final = quote + sanitized;
+    // Final body has quote + in-character template. NO raw error substring.
+    expect(final).toBe(quote + composeErrorBody('ruggy', 'error'));
+    expect(final).not.toContain('API Error');
+    expect(final).not.toContain('Internal Server Error');
+  });
+
+  test('CORRECT ORDER: sanitize chunk → prepend name → wire (deliverViaInteraction)', () => {
+    // Mirrors dispatch.ts:909-925 (post-fix). formatReply prepends
+    // `**DisplayName**\n\n` to chunks[0]; sanitize must run on rawChunks BEFORE.
+    const rawChunk = 'API Error: 529 overloaded';
+    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('satoshi', 'error'));
+    const sanitized = sanitizeOutboundBody(rawChunk, 'satoshi', errorTemplate);
+    const namePrefix = '**Satoshi**\n\n';
+    const final = namePrefix + sanitized;
+    expect(final).toBe(namePrefix + composeErrorBody('satoshi', 'error'));
+    expect(final).not.toContain('API Error');
+  });
+
+  test('BUGGY ORDER (pre-fix): prepend quote → sanitize → wire = LEAKS raw body', () => {
+    // This is the failure mode codex C1 caught. Keep this test as a
+    // documentation guard — if a refactor moves sanitize back outside
+    // the prefix step, the assertion below will hold (sanitize is a
+    // no-op on prefixed input), which is the exact bug.
+    const rawChunk = 'API Error: 500 Internal Server Error';
+    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
+    const quote = '> @user asked: hello\n\n';
+    const prefixed = quote + rawChunk;
+    const final = sanitizeOutboundBody(prefixed, 'ruggy', errorTemplate);
+    // BUGGY: anchor `^API Error:` doesn't see `^>` so sanitize doesn't fire.
+    expect(final).toBe(prefixed);
+    expect(final).toContain('API Error');
+  });
+
+  test('BUGGY ORDER (pre-fix): prepend name → sanitize → wire = LEAKS raw body', () => {
+    const rawChunk = 'bedrock chat error: 500 {"message":"upstream timeout"}';
+    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('satoshi', 'error'));
+    const namePrefix = '**Satoshi**\n\n';
+    const prefixed = namePrefix + rawChunk;
+    const final = sanitizeOutboundBody(prefixed, 'satoshi', errorTemplate);
+    expect(final).toBe(prefixed);
+    expect(final).toContain('bedrock chat error');
+  });
+
+  test('multi-chunk: only chunks[0] gets the quote prefix; chunks[1..N] still sanitize cleanly', () => {
+    // Webhook delivery prefixes only chunks[0]. Subsequent chunks are
+    // bare. If a raw-error somehow lands in chunks[1+], sanitize catches it
+    // because no prefix shadows the anchor.
+    const errorChunkInMiddle = 'orchestrator: SDK error subtype=error_during_execution';
+    const errorTemplate = stripVoiceDisciplineDrift(composeErrorBody('ruggy', 'error'));
+    const sanitized = sanitizeOutboundBody(errorChunkInMiddle, 'ruggy', errorTemplate);
+    expect(sanitized).toBe(composeErrorBody('ruggy', 'error'));
+    expect(sanitized).not.toContain('orchestrator: SDK error');
+  });
+});
diff --git a/packages/persona-engine/src/deliver/sanitize.test.ts b/packages/persona-engine/src/deliver/sanitize.test.ts
index 0eb28b3..b17a99a 100644
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
@@ -204,3 +206,596 @@ describe('stripVoiceDisciplineDrift · composition with escapeDiscordMarkdown',
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
+  // Capture telemetry · restore console.error between cases.
+  let warnings: string[] = [];
+  const originalWarn = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalWarn;
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
+  const originalWarn = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalWarn;
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
+  test('PascalCase Exception class WITH colon catches', () => {
+    const input = 'RateLimitException: rate limit exceeded at line 42';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('PascalCase Failure class WITH colon catches', () => {
+    const input = 'BedrockTimeoutFailure: connection reset by peer';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=generic-error-class-prefix');
+  });
+
+  test('Error: prefix + PascalCase class WITH colon catches', () => {
+    const input = 'Error: OpenAIRateLimitException: too many requests';
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
+    const input = 'Error: ruggy is here, just kidding';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('Lowercase prose mentioning "rate limit error" mid-body does NOT match', () => {
+    const input = 'yo. saw a rate limit error earlier but cleared.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  // ─── FALSE-POSITIVE GUARDS (flatline gemini G2 · 2026-05-11) ───
+  // The catch-all now requires trailing `:` so legitimate character voice
+  // that opens with PascalCase identifier ending in Error/Exception/Failure
+  // (followed by anything other than `:`) passes through.
+
+  test('character voice: "TotalFailure is the name of my zine" passes through (G2 guard)', () => {
+    const input = 'TotalFailure is the name of my new zine, you should see it.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('character voice: "ValidationError was his middle name" passes through (G2 guard)', () => {
+    const input = 'ValidationError was his middle name, the codex told me so.';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('character voice: PascalCase Error class followed by space-and-prose passes through', () => {
+    // Even though `RateLimitException at line 42` would have matched the old
+    // `\b` pattern (false positive), the new `:` requirement protects it.
+    const input = 'RateLimitException sounds like a band name, lowkey.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+});
+
+describe('sanitizeOutboundBody · passthrough cases', () => {
+  let warnings: string[] = [];
+  const originalWarn = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalWarn;
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
+  const originalError = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalError;
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
+
+describe('sanitizeOutboundBody · idempotency invariant (IMP-002)', () => {
+  // This test enforces the invariant that our own error templates do not
+  // themselves match the raw-error patterns. If they did, a second pass
+  // of the sanitizer would substitute them AGAIN, breaking idempotency
+  // and firing telemetry twice for one event.
+  const CHARACTER_IDS_TO_TEST = ['ruggy', 'satoshi', 'unknown-character'];
+
+  for (const charId of CHARACTER_IDS_TO_TEST) {
+    test(`error template for "${charId}" should not match any raw error patterns`, () => {
+      const errorBody = composeErrorBody(charId, 'error');
+      // A "clean" run of the sanitizer on the template should produce no
+      // warnings and return the template unchanged.
+      const sanitizedResult = sanitizeOutboundBody(errorBody, charId, "SHOULD_NOT_BE_USED");
+      expect(sanitizedResult).toBe(errorBody);
+    });
+  }
+});
+
+describe('sanitizeOutboundBody · unicode/locale variants (IMP-005)', () => {
+    let warnings: string[] = [];
+    const originalError = console.error;
+    beforeEach(() => {
+        warnings = [];
+        console.error = (msg: string) => {
+            warnings.push(typeof msg === 'string' ? msg : String(msg));
+        };
+    });
+    afterEach(() => {
+        console.error = originalError;
+    });
+
+    test('full-width unicode lookalikes are sanitized', () => {
+        // Use full-width characters for "API Error: 500"
+        const input = 'ＡＰＩ Ｅｒｒｏｒ: ５００';
+        const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+        expect(out).toBe(composeErrorBody('ruggy', 'error'));
+        expect(warnings).toHaveLength(1);
+        // NFKC normalization converts full-width to ASCII before matching,
+        // so the SPECIFIC anthropic-api-error pattern wins (not the generic
+        // catch-all). This is the desired outcome: telemetry attributes
+        // origin correctly.
+        expect(warnings[0]).toContain('matched=anthropic-api-error');
+    });
+
+    test('full-width unicode passes through when not error-shaped', () => {
+        // Character voice with intentional full-width text — must not
+        // false-positive after NFKC normalization.
+        const input = 'Ｈｅｌｌｏ ｆｒｉｅｎｄ, the bear watches today.';
+        const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+        expect(out).toBe(input);
+        expect(warnings).toHaveLength(0);
+    });
+});
+
+// ─────────────────────────────────────────────────────────────────────
+// BLOCKER #1 whitespace-tolerance regression (gemini-skeptic · 2026-05-11)
+//
+// Anchored `^` patterns are defeated if the raw error body has leading
+// whitespace or newlines. The fix: trimStart() the probe BEFORE matching.
+// We compare against trimmed input but return the substitution (on match)
+// or the original content (on no-match, preserving LLM whitespace).
+//
+// Plus: tolerate spaced JSON envelopes (`{"type": "error"…}` with space
+// after colon) since the JSON pattern is widened to use `\s*`.
+// ─────────────────────────────────────────────────────────────────────
+
+describe('sanitizeOutboundBody · whitespace tolerance (BLOCKER #1)', () => {
+  let warnings: string[] = [];
+  const originalError = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalError;
+  });
+
+  test('leading newline + API Error substitutes', () => {
+    const input = '\nAPI Error: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('leading multiple newlines + raw JSON envelope substitutes', () => {
+    const input = '\n\n{"type":"error","error":{"type":"api_error"}}';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
+  });
+
+  test('leading spaces + bedrock chat error substitutes', () => {
+    const input = '   bedrock chat error: 503 service unavailable';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=bedrock-chat-error');
+  });
+
+  test('leading tab + orchestrator SDK throw substitutes', () => {
+    const input = '\torchestrator: SDK error subtype=error_during_execution';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=orchestrator-sdk-error-subtype');
+  });
+
+  test('spaced JSON envelope `{ "type" : "error" }` substitutes', () => {
+    const input = '{ "type" : "error", "error" : { "type" : "api_error" } }';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
+  });
+
+  test('mixed-whitespace + spaced JSON substitutes', () => {
+    const input = '  \n  { "type": "error", "error": { "message": "upstream" } }';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
+  });
+
+  test('LLM output with leading whitespace passes through verbatim (no-match preserves)', () => {
+    // No raw-error pattern matches; LLM whitespace must survive.
+    const input = '\n\nyo. just got the ledger update.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  test('LLM-shaped multi-line response with internal JSON code block passes through', () => {
+    // Internal JSON is mid-body (after the LLM's prose preamble), so the
+    // `^` anchor on the trimStart()ed input doesn't match it.
+    const input = "here's the shape:\n\n```json\n{\"type\":\"error\",\"hint\":\"example\"}\n```";
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+});
+
+// ─────────────────────────────────────────────────────────────────────
+// Zero-width / Cf-category bypass guards
+// (flatline gemini-skeptic SKP-001 HIGH/760 · 2026-05-11)
+//
+// NFKC alone doesn't strip zero-width characters (ZWSP, ZWNJ, ZWJ, LRM,
+// RLM, Word Joiner, BOM). An attacker could prefix or insert these to
+// defeat the `^` anchor or break literal-byte matching.
+// ─────────────────────────────────────────────────────────────────────
+
+describe('sanitizeOutboundBody · zero-width strip (SKP-001 HIGH/760)', () => {
+  let warnings: string[] = [];
+  const originalError = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalError;
+  });
+
+  test('BOM (U+FEFF) prefix + API Error substitutes', () => {
+    const input = '﻿API Error: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('ZWSP (U+200B) inserted mid-token substitutes', () => {
+    // `A​PI` with a zero-width space between A and P.
+    const input = 'A​PI Error: 500 Internal Server Error';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('Word Joiner (U+2060) prefix + JSON envelope substitutes', () => {
+    const input = '⁠{"type":"error","error":{"type":"api_error"}}';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=raw-json-error-envelope');
+  });
+
+  test('ZWNJ (U+200C) + ZWJ (U+200D) scattered through error prefix substitutes', () => {
+    const input = 'API‌ Error‍: 500';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('LRM (U+200E) + RLM (U+200F) bidi-mark obfuscation substitutes', () => {
+    const input = '‎API Error: 500‏';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('NFKC + zero-width + leading whitespace: triple-stack substitutes', () => {
+    // Combine all three defenses: full-width ＡＰＩ + ZWSP + leading newline.
+    const input = '\n​ＡＰＩ Ｅｒｒｏｒ: ５００';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('LLM output with intentional zero-width chars passes through verbatim', () => {
+    // ZWNJ is used in some scripts (e.g. Persian/Hindi) for legitimate
+    // text rendering. LLM output must survive if it's not error-shaped.
+    const input = 'hello‌world, the bear watches.';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(input);
+    expect(warnings).toHaveLength(0);
+  });
+
+  // ─── Cf-broader coverage (flatline v3 SKP-002 + IMP-001 · HIGH-CONSENSUS 870) ───
+  // `\p{Cf}` covers every format char, not just the zero-width subset.
+
+  test('bidi LRI (U+2066) wrapping + API Error substitutes', () => {
+    const input = '⁦API Error: 500⁩';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('bidi FSI (U+2066) + RLI (U+2067) + PDI (U+2069) obfuscation substitutes', () => {
+    const input = '⁦AP⁧I Error⁩: 500';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+
+  test('Arabic Letter Mark (U+061C) + bedrock chat error substitutes', () => {
+    const input = '؜bedrock chat error: 500';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=bedrock-chat-error');
+  });
+
+  test('Soft Hyphen (U+00AD) injected mid-token substitutes', () => {
+    // `API­ Error` — Soft Hyphen between API and Error.
+    const input = 'API­ Error: 500';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=anthropic-api-error');
+  });
+});
+
+// ─────────────────────────────────────────────────────────────────────
+// discord.js bracketed error forms (flatline gemini-skeptic SKP-002 HIGH/720)
+//
+// discord.js stringifies errors like `DiscordAPIError[Cannot send messages
+// to this user]: 50007`. Plain `DiscordAPIError:` regex misses the bracketed
+// form. Widened pattern handles both bare and bracketed signatures.
+// ─────────────────────────────────────────────────────────────────────
+
+describe('sanitizeOutboundBody · bracketed discord.js errors (SKP-002 HIGH/720)', () => {
+  let warnings: string[] = [];
+  const originalError = console.error;
+  beforeEach(() => {
+    warnings = [];
+    console.error = (msg: string) => {
+      warnings.push(typeof msg === 'string' ? msg : String(msg));
+    };
+  });
+  afterEach(() => {
+    console.error = originalError;
+  });
+
+  test('bare DiscordAPIError: substitutes', () => {
+    const input = 'DiscordAPIError: Missing Permissions';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=discord-js-api-error');
+  });
+
+  test('bracketed DiscordAPIError[Cannot send messages]: substitutes', () => {
+    const input = 'DiscordAPIError[Cannot send messages to this user]: 50007';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=discord-js-api-error');
+  });
+
+  test('bracketed HTTPError[Rate Limited]: substitutes', () => {
+    const input = 'HTTPError[Rate Limited]: 429';
+    const out = sanitizeOutboundBody(input, 'satoshi', tmpl('satoshi'));
+    expect(out).toBe(composeErrorBody('satoshi', 'error'));
+    expect(warnings[0]).toContain('matched=discord-js-http-error');
+  });
+
+  test('Error: prefix + bracketed DiscordAPIError substitutes', () => {
+    const input = 'Error: DiscordAPIError[Unknown Channel]: 10003';
+    const out = sanitizeOutboundBody(input, 'ruggy', tmpl('ruggy'));
+    expect(out).toBe(composeErrorBody('ruggy', 'error'));
+    expect(warnings[0]).toContain('matched=discord-js-api-error');
+  });
+});
diff --git a/packages/persona-engine/src/deliver/sanitize.ts b/packages/persona-engine/src/deliver/sanitize.ts
index 6abe40a..8086f14 100644
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
@@ -343,3 +349,184 @@ function stripTrailingClosings(text: string): string {
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
+  // Raw Anthropic JSON error envelope · whitespace-tolerant
+  // (flatline gemini-skeptic BLK-1 · 2026-05-11). Tolerates both compact
+  // `{"type":"error",…}` and spaced `{ "type": "error", … }` forms. The
+  // trimStart in sanitizeOutboundBody handles leading newlines / whitespace.
+  { name: 'raw-json-error-envelope', regex: /^(?:Error: )?\{\s*"type"\s*:\s*"error"/ },
+  // dispatch.ts:1083 / 1113 internal REST throw shape
+  {
+    name: 'dispatch-rest-wrapper',
+    regex: /^(?:Error: )?interactions: (?:PATCH @original|follow-up POST) failed status=\d+/,
+  },
+  // discord.js specific errors (explicitly named per IMP-001 · tightened per
+  // flatline gemini-skeptic SKP-002 HIGH/720 · 2026-05-11 to handle bracketed
+  // forms like `DiscordAPIError[Cannot send messages to this user]: 50007`).
+  { name: 'discord-js-api-error', regex: /^(?:Error: )?DiscordAPIError(?:\[[^\]]+\])?:/ },
+  { name: 'discord-js-http-error', regex: /^(?:Error: )?HTTPError(?:\[[^\]]+\])?:/ },
+  // GENERIC CATCH-ALL (bridgebuilder F4 · 2026-05-11 · tightened per flatline
+  // codex G2 · 2026-05-11): last-line defense against upstream format drift.
+  // Matches any PascalCase identifier ending in Error/Exception/Failure
+  // FOLLOWED BY A COLON at start-of-string (with optional `Error: ` prefix
+  // for String(err) forms). The trailing `:` (not `\b`) prevents
+  // false-positives on legitimate character voice like
+  // `"TotalFailure is the name of my zine"` or
+  // `"ValidationError was his middle name"` — those have a word boundary
+  // after the suffix but no colon, so they pass through.
+  //
+  // Real upstream throws ALWAYS use `XxxError: message` format
+  // (Anthropic/OpenAI/Bedrock convention), so requiring `:` is both safer
+  // and matches the actual leak shape.
+  {
+    name: 'generic-error-class-prefix',
+    regex: /^(?:Error: )?[A-Z][a-zA-Z]+(?:Error|Exception|Failure):/,
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
+  // Probe = trimStart + NFKC-normalize + zero-width-strip content for matching
+  // (flatline gemini-skeptic BLK-1, SKP-001 HIGH/760 · 2026-05-11). Three
+  // defenses combined:
+  //
+  //   1. trimStart catches `\n{"type":"error",…}` or `  API Error: 500…`
+  //      shapes where whitespace would otherwise defeat the `^` anchor.
+  //   2. NFKC normalization catches full-width Unicode lookalike attacks
+  //      (IMP-005): `ＡＰＩ Ｅｒｒｏｒ: ５００` → `API Error: 500` so the
+  //      ASCII-only regex patterns (`[A-Z]`, `\d`) still match.
+  //   3. Format character strip catches Cf-category obfuscation
+  //      (`A​PI Error`, BOM-prefixed `﻿{"type":"error",…}`, bidi-isolate-
+  //      wrapped variants). The `\p{Cf}` Unicode property class
+  //      (with `/u` flag) covers EVERY format char (HIGH-CONSENSUS IMP-001
+  //      + SKP-002 · flatline v3 · 2026-05-11): ZWSP/ZWNJ/ZWJ (U+200B-D),
+  //      LRM/RLM (U+200E-F), Word Joiner (U+2060), BOM (U+FEFF), bidi
+  //      isolates (U+2066-9), Arabic Letter Mark (U+061C), Soft Hyphen
+  //      (U+00AD), and the full Cf range. Broader and simpler than
+  //      enumerating. NOT Cc (would strip \n, \r, \t and break legitimate
+  //      mid-body content if it happened to produce an error-shaped match
+  //      after newlines were collapsed — trimStart already handles leading
+  //      whitespace, the only spot where \n needs stripping for matching).
+  //
+  // Mirrors the L7 soul-identity sanitization pattern (cycle-098 sprint-7
+  // HIGH-2: "NFKC-normalize + zero-width-strip section bodies before
+  // prescriptive-pattern matching" — same defense-class).
+  //
+  // We compare with `probe` but return the substitution OR the ORIGINAL
+  // `content` (preserving any whitespace / full-width text / zero-width
+  // characters on the pass-through path · LLM output with intentional
+  // Unicode survives if no error pattern matches).
+  const probe = content
+    .normalize('NFKC')
+    .replace(/\p{Cf}/gu, '')
+    .trimStart();
+  for (const { name, regex } of RAW_API_ERROR_PATTERNS) {
+    if (regex.test(probe)) {
+      console.error(
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
