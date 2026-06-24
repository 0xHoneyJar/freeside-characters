# Sprint Plan: Bug Fix — raw "API Error: 500..." string leaked to Discord during transient Bedrock outage

**Type**: bugfix
**Bug ID**: 20260511-b6eb97
**Source**: /bug (triage)
**Sprint**: sprint-bug-1

---

## sprint-bug-1: in-character error voice invariant during upstream API outage

### Sprint Goal
Close FAGAN architect-lock A4: prove the catch at `dispatch.ts:593-598` correctly routes every SDK error variant through `formatErrorBody` AND add a defense-in-depth `sanitizeOutboundBody` so no raw upstream API string can ever land on the Discord write surface, even if a future drift introduces a path that bypasses `deliverError`.

### Deliverables
- [ ] Failing test that reproduces the leak shape (mocked `composeReplyWithEnrichment` throws `new Error('API Error: 500 …')`)
- [ ] `sanitizeOutboundBody(content, characterId)` helper in `packages/persona-engine/src/deliver/sanitize.ts`
- [ ] Re-export of `sanitizeOutboundBody` from `packages/persona-engine/src/index.ts`
- [ ] Every `patchOriginal` / `postFollowUp` / `sendChatReplyViaWebhook` content callsite in `apps/bot/src/discord-interactions/dispatch.ts` wrapped through the new sanitizer
- [ ] Telemetry log line on substitution (`[outbound-sanitize] character=<id> kind=raw-api-error matched=<pattern> original_len=<n>`)
- [ ] All existing tests pass (no regressions); typecheck clean
- [ ] Triage analysis document (grimoires/loa/a2a/bug-20260511-b6eb97/triage.md)

### Technical Tasks

#### Task 1: Write Failing Test [G-5]
- Create `apps/bot/src/tests/dispatch-error-routing.test.ts` (`bun test` runner)
- Cases (parameterized over `[ruggy, satoshi]` × error-source):
  - `composeReplyWithEnrichment` throws `new Error('API Error: 500 Internal Server Error')`
  - `composeReplyWithEnrichment` throws `new Error('orchestrator: SDK error subtype=error_during_execution errors=API Error: 529 overloaded')` (orchestrator throw shape, reply.ts:535)
  - `composeReplyWithEnrichment` throws `new Error('bedrock chat error: 500 {"type":"error","error":{"type":"api_error"}}')` (bedrock direct throw shape, reply.ts:934)
  - `composeReplyWithEnrichment` returns `null` (empty case)
  - `composeReplyWithEnrichment` returns `TIMEOUT_SENTINEL` via the `Promise.race` (timeout case)
- For each case, mock all Discord write surfaces (`patchOriginal`, `postFollowUp`, `sendChatReplyViaWebhook`) and CAPTURE the bodies sent.
- Assert:
  - Every captured body is one of: `composeErrorBody(character.id, 'error'|'timeout'|'empty')` (post-`stripVoiceDisciplineDrift`), OR a successful LLM output (in voice).
  - NO captured body contains substring `"API Error"`, `"Internal Server Error"`, `"status="`, `"subtype=error_"`, `"bedrock chat error"`, or `"orchestrator:"`.
- If `doReplyChat` is not directly exportable, add a minimal test-only export pattern (mirror the `apps/bot/src/tests/auth-bridge.test.ts` mock-injection pattern).
- Confirm at least one case fails against current code before proceeding to Task 2 — that surfaces the actual leak vector. If all cases pass against current code, the leak is elsewhere; pause and consult the operator with the test evidence.

**Acceptance Criteria**:
- Test file exists at `apps/bot/src/tests/dispatch-error-routing.test.ts`
- At least one case demonstrably fails on current `main` (proves the bug or surfaces a different vector for operator review)
- Test names clearly describe each scenario (e.g., `"upstream Bedrock 500 → in-character template, no raw body leak"`)
- Tests are isolated (no shared state between cases; mocks reset per case)
- Voice-rule compliance: lowercase, in-character template literals match `error-register.ts` TEMPLATES_RAW verbatim

#### Task 2: Add `sanitizeOutboundBody` helper [G-1, G-2]
- File: `packages/persona-engine/src/deliver/sanitize.ts` (extend existing module, alongside `stripVoiceDisciplineDrift`).
- Signature: `export function sanitizeOutboundBody(content: string, characterId: string): string`
- Implementation:
  - Match patterns (case-insensitive where appropriate):
    - `/^API Error: \d+/`
    - `/^Internal Server Error/i`
    - `/^bedrock chat error: \d+/i`
    - `/^orchestrator: SDK error subtype=/`
    - `/^orchestrator: SDK query completed without/`
    - `/^freeside agent-gateway chat error: \d+/i`
    - `/^{"type":"error"/` (raw JSON error envelopes)
    - `/status=\d{3} body=/` (the dispatch.ts:1083 / 1113 internal error wrapper format)
  - On match: return `composeErrorBody(characterId, 'error')` (substrate-quiet fallback if no character template registered).
  - On no match: return `content` unchanged (preserves all LLM success output + already-in-character template bodies).
  - Emit `console.warn('[outbound-sanitize] character=${characterId} kind=raw-api-error matched=${patternName} original_len=${content.length}')` on substitution.
- Add unit tests in `packages/persona-engine/src/deliver/sanitize.test.ts` (or a new sibling file) covering each pattern + the unchanged-passthrough cases.

**Acceptance Criteria**:
- All 8+ patterns match correctly with positive + negative test cases
- LLM-success content (varied: emoji-rich, multi-paragraph, code blocks) passes through verbatim
- In-character template bodies (`"cables got crossed, nothing came back. try again?"` etc.) pass through verbatim
- Substitution emits structured telemetry log
- Re-exported from `packages/persona-engine/src/index.ts`

#### Task 3: Wire `sanitizeOutboundBody` into every dispatch write surface [G-2]
- File: `apps/bot/src/discord-interactions/dispatch.ts`
- Wrap each content argument:
  - Line 439 (onToolUse fire-and-forget PATCH): `patchOriginal(interaction, ephemeral, sanitizeOutboundBody(status, character.id))` — note this is INSIDE an `if (status === null) return;` guard so `status` is always string here.
  - Line 855 (`sendChatReplyViaWebhook` in `deliverViaWebhook`): wrap `allChunks[i]!`
  - Line 899 (`patchOriginal` in `deliverViaInteraction`): wrap `chunks[0] ?? ''`
  - Line 902 (`postFollowUp` in `deliverViaInteraction`): wrap `chunks[i]!`
  - Line 990 (`sendChatReplyViaWebhook` in `deliverErrorViaWebhook`): wrap `body` (defense-in-depth even though `body` already came from `formatErrorBody`)
  - Line 1024 (`patchOriginal` in `deliverError` ephemeral path): wrap `formatErrorBody(character, kind)`
  - Line 1042 (`patchOriginal` in `deliverError` PATCH fallback): wrap `formatErrorBody(character, kind)`
  - For imagegen (`doReplyImagegen`): wrap the corresponding callsites — line 666 (`deliverViaInteraction`), line 744 (`deliverViaInteraction` fallback), line 696 (caption in `sendImageReplyViaWebhook` — wrap `caption`).
- Import `sanitizeOutboundBody` alongside existing engine imports at the top of the file.

**Acceptance Criteria**:
- Every body-bearing Discord write surface is wrapped
- No raw error string can land on Discord without passing through the sanitizer
- Existing voice-discipline chain (`stripVoiceDisciplineDrift`) order is preserved (sanitize is the OUTERMOST wrap)
- The failing test from Task 1 now passes
- `bun typecheck` clean
- `bun test` clean (no regressions in existing surface tests)

#### Task 4: Verify production telemetry catches the leak vector [G-3]
- Confirm the `[outbound-sanitize]` log line shape matches what the operator's CloudWatch/Vector parser expects (line-oriented, no JSON envelope on the hot path — mirrors `[cold-budget]` and `[chat-route]` conventions at dispatch.ts:584 + reply.ts:761).
- Document in NOTES.md (operator-facing): "the substitution fires only on raw-API-error shapes — if it fires in production, the catch routing has a real gap; if it never fires, the catch is sufficient and this is purely belt-and-suspenders."
- Surface in the post-fix /audit-sprint: open audit question to the operator on whether to KEEP the sanitizer permanently (defense-in-depth, ALEXANDER craft) or REMOVE it after a 30-day observation window if it never fires (Loa-equivalent of "delete unused defense" minimalism).

**Acceptance Criteria**:
- Telemetry log shape documented in code comment + a brief addition to `docs/EXPRESSION-TIMING.md` or a new `docs/ERROR-VOICE-DISCIPLINE.md`
- NOTES.md entry recording the observation question for /audit-sprint

### Acceptance Criteria
- [ ] Bug is no longer reproducible — synthetic test simulating the transient upstream 500 surfaces an in-character template only
- [ ] Failing test proves the fix (or surfaces and closes the actual leak vector for operator review)
- [ ] No regressions in existing tests (`bun test` clean across all workspaces)
- [ ] Typecheck clean (`bun typecheck`)
- [ ] Fix is defense-in-depth at the write boundary, not a fragile per-catch patch
- [ ] Voice rules respected: lowercase, in-character templates verbatim, no corporate-bot tells in any new test fixture
- [ ] Telemetry observable so the operator can verify in production whether the leak vector was real

### Triage Reference
See: grimoires/loa/a2a/bug-20260511-b6eb97/triage.md

### Architectural Notes (FAGAN A4 follow-up)
- The catch at `dispatch.ts:593-598` was verified by code reading to call `deliverError(..., 'error')` which routes through `formatErrorBody` → `composeErrorBody` → in-character template. PR #45 already landed the bare-body PATCH fallback shape. So the question A4 was flagging is more likely about CLOSING THE AUDIT than fixing a missed branch — the sanitizer makes the invariant true by construction at the write boundary, not by induction over every error-raising callsite.
- This is a CLAUDE.md "Discord-as-Material" rule enforcement: "in-character errors only — 'cables got crossed' not 'I apologize for the inconvenience'." A raw upstream API string violates the rule. The sanitizer makes the rule load-bearing AT THE BOUNDARY, which is exactly the substrate vs character split that `docs/CIVIC-LAYER.md` describes.
- Decision Log (for /audit-sprint): the sanitizer is OUTERMOST so it catches drift even if a future contributor adds a new Discord write surface that doesn't go through `deliverError`. This is the same pattern as `stripVoiceDisciplineDrift` (defense-in-depth at the medium boundary) and `escapeDiscordMarkdown` (Discord-shape sanitizer). New principle to add to the construct: "every write to a chat medium passes through a medium-boundary sanitizer chain."
