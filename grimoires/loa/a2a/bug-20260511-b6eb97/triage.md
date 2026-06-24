# Bug Triage: raw "API Error: 500..." string leaked to Discord during transient Bedrock outage

## Metadata
- **schema_version**: 1
- **bug_id**: 20260511-b6eb97
- **classification**: defect (error-path voice leak)
- **severity**: medium
- **eligibility_score**: 4
- **eligibility_reasoning**: production incident observation (+1 prod log) + reproducible pattern (transient upstream 500 during compose) + stack-trace-localized suspect line `apps/bot/src/discord-interactions/dispatch.ts:593-598` (+1 stack ref) + regression baseline cited (FAGAN agent afb548531d1fb79d5 finding A4) (+1) + an operator-named observed failure on a specific timestamp (`before 2026-05-11T19:07Z UTC`) (+1). Disqualifier check: no new endpoint, no new UI flow, no schema change, no new config — purely a defense-in-depth fix to existing error-routing surface. Substrate is otherwise healthy (Bedrock + composeReply probed 200 OK after the outage). ACCEPT.
- **test_type**: unit
- **risk_level**: medium
- **created**: 2026-05-11T19:23:06Z

## Reproduction
### Steps
Strong-mode repro requires a transient upstream outage, which can't be triggered on demand. The repro path that the test must encode:

1. Stand up a synthetic test harness that drives `doReplyChat()` (or directly exercises the catch path at `apps/bot/src/discord-interactions/dispatch.ts:593-598`).
2. Inject a mock `composeReplyWithEnrichment` that throws an Error whose `.message` is a raw upstream API body — e.g., `new Error('API Error: 500 {"type":"error","error":{"type":"api_error","message":"Internal server error"}}')`.
3. Capture every call to `patchOriginal` / `postFollowUp` / `sendChatReplyViaWebhook` during dispatch.
4. Assert: every captured body contains a known in-character error template fragment (e.g., the substrate-quiet generic `"something broke. try again?"` OR a registered character template like ruggy's `"something snapped on ruggy's end. cool to retry?"`) AND DOES NOT contain the substring `"API Error"` or `"Internal server error"` or any raw JSON-shaped body.

### Expected Behavior
On any compose-time throw (upstream API 500, network reset, SDK subtype `error_during_execution`, accumulated-text-empty throw at orchestrator/index.ts:555), the user-visible Discord message MUST be an in-character error template wrapped through `formatErrorBody(character, kind)` → `composeErrorBody`. No raw upstream API string ever reaches `patchOriginal` content or webhook send.

### Actual Behavior
During the transient Bedrock outage (operator observation before 2026-05-11T19:07Z UTC), a raw `API Error: 500 …` string appeared verbatim in Discord as the bot's reply. Substrate logs / Bedrock + composeReply probes after the window all return 200 OK — confirming the outage was upstream-transient, not a persistent substrate failure.

### Environment
- Production (Discord application "Ruggy#1157" shell-bot)
- LLM_PROVIDER=bedrock (Opus 4.7 via inference profile)
- Orchestrator path (`shouldUseOrchestrator` returns true for bedrock per V0.11.1)
- Affected commands: `/ruggy <prompt>`, `/satoshi <prompt>` (and presumably any future chat character)

## Analysis
### Suspected Files
| File | Line(s) | Confidence | Reason |
|------|---------|------------|--------|
| `apps/bot/src/discord-interactions/dispatch.ts` | 593-598 | high | Operator + FAGAN A4 localized here. Top-level chat catch correctly calls `deliverError(...)` → `formatErrorBody` → `composeErrorBody`. Path analysis shows this catch IS wrapping; the leak must come from a sibling path the catch doesn't cover OR from a non-`ErrorClass`-bearing error variant. |
| `apps/bot/src/discord-interactions/dispatch.ts` | 317-321 | medium | Top-level `void doReplyAsync(...).catch(err => console.error(...))` — this catches AFTER `doReplyChat` has already returned. It only fires if `doReplyChat` itself throws synchronously OUTSIDE its own try/catch (e.g., a throw in the variable destructuring at line 361, or in `truncate(prompt, 80)` log line). In that case NO `deliverError` ever runs → the deferred PATCH is never updated → Discord shows "thinking…" forever. But Discord's interaction surface times out at 15min and shows the LAST PATCHed body OR a Discord-side "interaction failed". This path doesn't directly leak the API body to Discord. |
| `apps/bot/src/discord-interactions/dispatch.ts` | 411-445 | medium | `onToolUse` fires `patchOriginal(interaction, ephemeral, status)` mid-stream. `status` is `stripVoiceDisciplineDrift(composeToolUseStatusForCharacter(character, event.name))` — sourced from character catalog, never from error string. BUT: if `composeToolUseStatusForCharacter` ever returns a passthrough of an unknown-tool error message, or if the SDK emits a synthetic `tool_use` carrying upstream API-error metadata in `event.name`, that string would land in `patchOriginal`. Low probability; high impact. |
| `packages/persona-engine/src/orchestrator/index.ts` | 535-538 | high | `throw new Error(\`orchestrator: SDK error subtype=${message.subtype}\` + (message.errors?.length ? \` errors=${message.errors.join('; ')}\` : ''))` — when the SDK reports an error subtype, `message.errors[]` may contain the raw upstream API body. This Error.message string then propagates UP. Dispatch.ts:593 catches it and calls `deliverError(..., 'error')` — which DOES wrap to in-character body. So this throw alone doesn't leak. But: if any other consumer of this error (e.g., a logger that PATCHes a status to Discord) ever forwards `err.message`, the raw body leaks. |
| `packages/persona-engine/src/orchestrator/index.ts` | 555-560 | medium | `throw new Error('orchestrator: SDK query completed without an assistant text response…')` — this fires on the empty-result path. `doReplyChat` already has both `result === TIMEOUT_SENTINEL` (→ `'timeout'`) and `!result` (→ `'empty'`) branches BUT if `runOrchestratorQuery` throws DURING the for-await loop (e.g., SDK aborts mid-stream with an upstream 500), it hits the catch at line 593 (→ `'error'`). That path is correct. |
| `apps/bot/src/discord-interactions/dispatch.ts` | 545-552 | medium | Webhook delivery fallback: when `deliverViaWebhook` throws, it falls back to `deliverViaInteraction(interaction, character, cleanedChunks, false)`. `cleanedChunks` comes from `result.chunks.map(stripVoiceDisciplineDrift)` — i.e., the SUCCESSFUL LLM output, not an error. So even if webhook fails post-LLM-success, the body sent is the LLM's actual reply (in-character). Not a leak vector. |
| `packages/persona-engine/src/compose/reply.ts` | 250-371 | low | `composeReplyWithEnrichment` post-processes the success result. Any throw here (e.g., `composeWithImage` network fail during enrichment) propagates back to `doReplyChat`'s catch → `deliverError('error')`. Defense-in-depth wrap is already there. |

### Related Tests
| Test File | Coverage |
|-----------|----------|
| `packages/persona-engine/src/expression/error-register.test.ts` | Existing coverage of `composeErrorBody` shape — confirms templates are register-correct per character. Does NOT cover the dispatch-side catch routing. |
| `apps/bot/src/tests/auth-bridge.test.ts` | Has a pattern (`mintJwtThrows`) for testing thrown-error error paths in dispatch — useful as a reference. |
| `apps/bot/src/tests/` (no existing dispatch.ts test file) | NO unit test currently exercises the dispatch catch at line 593. This is the gap the bug exposes. |

### Test Target
A new unit test (`apps/bot/src/tests/dispatch-error-routing.test.ts`) that:
1. Mocks `composeReplyWithEnrichment` with a function that throws an Error whose `.message` is a raw upstream API body (e.g., `"API Error: 500 Internal Server Error {...}"`).
2. Mocks `patchOriginal`, `postFollowUp`, `sendChatReplyViaWebhook`, and any other Discord write surface. Captures all bodies sent.
3. Drives `doReplyChat` (or the closest exported test seam — may require adding a small export for testability).
4. Asserts: every captured body is `composeErrorBody(character.id, 'error')` (verbatim, post-`stripVoiceDisciplineDrift`). No captured body contains substring `"API Error"`, `"Internal server"`, `"status="`, or any JSON-shaped body.
5. Add parameterized cases covering: `'timeout'`, `'empty'`, `'error'`, and the orchestrator throw subtypes (`error_during_execution`, `error_max_turns`, `error_during_query`).

If `doReplyChat` is not directly exportable, the minimal seam is to extract a helper `routeChatErrorToDeliverError(err, args)` (or simply export `doReplyChat` for tests via a test-only export pattern). The architect lock to honor: don't widen the public surface; add the test seam as the smallest change that lets the test fire.

### Constraints
- Test runner: `bun test` (per package.json `test` script). Tests live under `apps/bot/src/tests/*.test.ts`.
- Voice rules: any test fixtures that include character names MUST stay lowercase + use the in-character template strings verbatim (matching `error-register.ts` TEMPLATES_RAW).
- PII redaction: when synthesizing fake API errors, do NOT embed real-looking API keys / tokens. Use `[REDACTED_SK]` or `sk-fake-...` patterns.
- Architect lock A4 (operator-named via FAGAN agent afb548531d1fb79d5): the catch block must route ALL SDK error subtypes through `deliverError` with a valid `ErrorClass`. The fix must close the audit by either (a) proving via test that the existing routing is correct AND adding a defense-in-depth sanitizer that scrubs any error-shaped string from EVERY `patchOriginal` content path, OR (b) finding the actual leak vector and patching it.
- `voice-discipline` invariant: `formatErrorBody` already applies `stripVoiceDisciplineDrift` to the in-character template body. The fix must NOT bypass this transform.
- Anti-spam invariant (load-bearing per CLAUDE.md): the fix must NOT introduce any new path that auto-PATCHes or auto-WebhookSends outside the explicit-invocation contract.

## Fix Strategy

The bug surfaces an audit gap: the existing catch at `dispatch.ts:593-598` DOES route through `deliverError(...)` and wrap the in-character template. So the leak vector is one of:

1. **A code path that PATCHes Discord without going through `deliverError`/`formatErrorBody`**. Audit every `patchOriginal(...)` / `postFollowUp(...)` / `sendChatReplyViaWebhook(...)` callsite for "is the content guaranteed to be either (a) successful LLM output, (b) an in-character `composeErrorBody` result, or (c) a static substrate-quiet string?" Any callsite that fails this audit is the leak.

2. **A `deliverError` invocation with an `ErrorClass` value that bypasses `composeErrorBody`**. The current type system enforces `ErrorClass` as a literal union of the 5 known classes, BUT if a string is force-cast (e.g., `errKind as ErrorClass` after concatenation), the runtime template lookup returns `null` → fallback `"something broke. try again?"`. So far so good, but if the concatenated string contains the raw API body, the fallback still ships. Audit: at line 713-716 the `errKind` is computed from `String(webhookErr).includes(...)` — that string can't leak (only used for conditional branching), but worth verifying no future drift writes `errKind = errMsg` directly.

3. **Defense-in-depth via output sanitization**. Add a `sanitizeOutboundBody(content: string): string` helper that detects upstream-API-error shapes (regex: `/^API Error: \d+/`, `/Internal Server Error/`, `/^{"type":"error"/`, `/status=\d{3} body=/`) and replaces them with `composeErrorBody(characterId, 'error')`. Wrap every `patchOriginal` / `sendChatReplyViaWebhook` / `postFollowUp` content arg through this helper. This is the BELT-AND-SUSPENDERS fix that closes A4 even if the actual leak vector is misidentified.

Recommended fix shape (minimal, defense-in-depth, ALEXANDER craft lens):

**Step A** — write a failing test that simulates the production incident: mock `composeReplyWithEnrichment` to throw `new Error('API Error: 500 {"type":"error",...}')`, capture all Discord write surfaces, assert the captured body is in-character (not raw).

**Step B** — run the test against the CURRENT code. If the test PASSES, that confirms the catch routing is correct and the leak vector is elsewhere (maybe a path we haven't analyzed: the `void deleteOriginal(...)` chains, the `void patchOriginal(...)` fire-and-forget at line 439, or a Discord-side cache-miss on a previously-PATCHed pre-fix body). If the test FAILS, it surfaces the exact path that bypasses `formatErrorBody`.

**Step C** — add a `sanitizeOutboundBody(content, characterId)` helper in `packages/persona-engine/src/deliver/sanitize.ts`, exported through the engine. Wrap every body-bearing Discord surface in `dispatch.ts` (the four `patchOriginal` callsites at lines 439, 899, 1024, 1042; the `postFollowUp` at 902; the `sendChatReplyViaWebhook` at 855 and 990 — anywhere CONTENT lands on the wire). The helper preserves successful LLM output verbatim AND in-character templates verbatim, but pattern-matches and replaces raw upstream-API-error shapes.

**Step D** — re-run the test; assert PASS. Add additional parameterized cases covering: orchestrator throw at line 535 (`SDK error subtype=...`), 555 (`empty assistant text response`), and bedrock-direct invokeChatBedrock throw at reply.ts:934 (`bedrock chat error: ${response.status}`).

**Step E** — telemetry: when `sanitizeOutboundBody` substitutes, log a structured warning `[outbound-sanitize] character=<id> kind=raw-api-error matched=<pattern> original_len=<n>` so operators can see in production whether the leak vector was hit (closes the loop on "did the fix actually catch the real leak vector").

### Fix Hints
Structured hints for multi-model handoff (each hint targets one file change):

| File | Action | Target | Constraint |
|------|--------|--------|------------|
| `apps/bot/src/tests/dispatch-error-routing.test.ts` | add | new unit test driving doReplyChat with mocked composeReplyWithEnrichment throwing raw API body | must use bun test; must capture all Discord write surfaces; must assert no `"API Error"` substring leaks |
| `packages/persona-engine/src/deliver/sanitize.ts` | add | `sanitizeOutboundBody(content, characterId)` helper that pattern-matches raw API-error shapes and substitutes `composeErrorBody(characterId, 'error')` | preserve LLM success output verbatim; preserve in-character templates verbatim; only substitute on regex match against raw-API-error patterns; emit structured telemetry on substitution |
| `packages/persona-engine/src/index.ts` | add | export `sanitizeOutboundBody` from sanitize.ts re-export block | follow existing re-export pattern alongside `stripVoiceDisciplineDrift` |
| `apps/bot/src/discord-interactions/dispatch.ts` | wrap | every `patchOriginal(interaction, ephemeral, X)` call's content argument with `sanitizeOutboundBody(X, character.id)` | lines 439, 899, 1024, 1042; preserve existing `stripVoiceDisciplineDrift` chain |
| `apps/bot/src/discord-interactions/dispatch.ts` | wrap | every `postFollowUp(interaction, ephemeral, X)` call's content argument with `sanitizeOutboundBody(X, character.id)` | line 902 |
| `apps/bot/src/discord-interactions/dispatch.ts` | wrap | every `sendChatReplyViaWebhook(webhook, character, X, ...)` call's content argument with `sanitizeOutboundBody(X, character.id)` | lines 855, 990; verify imagegen webhook delivery is also covered |

### Open Audit Questions
Surface for operator/reviewer attention:

1. The catch at dispatch.ts:593 APPEARS to correctly route through `deliverError`. Either (a) the operator's observation was real and the catch missed an async branch (the test will surface this), or (b) the leak happened via a Discord-side cache of a PRE-fix bot reply (PR #45 landed `fix(error-ux): webhook-first error delivery · bare body on PATCH fallback` — pre-#45 bot bodies that were still in Discord's message history could look like raw leaks). Step B above will disambiguate.

2. FAGAN agent afb548531d1fb79d5 finding A4 — full context for that finding is not in `grimoires/` based on a scan; the operator should confirm whether A4 has a stored artifact (e.g., trajectory log) that pins the exact line range. If yes, attach reference to the sprint.md so /implement has the upstream-of-truth.

3. The `void patchOriginal(interaction, ephemeral, status)` at line 439 is fire-and-forget. If `composeToolUseStatusForCharacter` ever returns something error-shaped (currently impossible per the catalog, but a future drift candidate), it would PATCH a non-error-routed body. Defense-in-depth `sanitizeOutboundBody` closes this.
