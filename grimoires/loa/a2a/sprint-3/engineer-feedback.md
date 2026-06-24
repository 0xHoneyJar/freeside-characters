# Senior Lead Review: Sprint 3 — Chat-Mode MCP Wiring (Phase D)

**Date:** 2026-05-02
**Reviewer:** Senior Tech Lead Reviewer Agent
**Sprint:** sprint-3 (cycle-001 / V0.7-A.1 environment substrate)
**Implementation Commit:** 1cc076d
**Verdict:** All good (with noted concerns + 2 forward-carry items for Sprint 4)

---

## Overall Assessment

Sprint 3 closes the chat-mode tool surface gap with the smallest reasonable diff (+583 lines across 9 files). The implementation is structurally sound: per-character MCP isolation flows through the existing `buildAllowedTools` filter, environment context lands via the Sprint 2 builder, and the routing decision (`shouldUseOrchestrator`) is explicit and testable. The two ACCEPTED-DEFERRED ACs (AC-3.1, AC-3.2) are correctly scoped to Sprint 4's E2E matrix per the spec verify gate.

**Karpathy verification:**
- Think Before Coding: two architectural deviations surfaced explicitly in reviewer.md AND NOTES.md (CHAT_MODE default, no conversationHistory field) ✓
- Simplicity First: routing decision is 8 lines of code; no overengineering ✓
- Surgical Changes: existing digest path (agent-gateway.ts:113-119) byte-identical; orchestrator type relaxation is purely additive ✓
- Goal-Driven: smoke explicitly maps to per-character isolation matrix + CHAT_MODE × provider routing matrix ✓

The implementer's three questions in reviewer.md are well-framed; my answers below.

---

## Adversarial Analysis

### Concerns Identified

1. **`CHAT_MODE` default deviation (AC-3.5 implicit)** (`packages/persona-engine/src/config.ts:117`)
   Spec line 441: "default `orchestrator` once verified, fallback to `naive` if regression." Implementer chose `auto` instead. The reasoning is correct (anthropic-SDK-only orchestrator would break bedrock/freeside), but the spec deviation is non-trivial: it changes the rollout posture from "tools-on-default, opt-out via env" to "tools-on-only-when-anthropic, opt-in via env." NOTES.md Decision Log entry 9 captures the rationale. Operator should ratify before Sprint 4 lands and persona prose locks in the new behavior assumptions.

2. **No `conversationHistory` field on `OrchestratorRequest`** (`packages/persona-engine/src/orchestrator/index.ts:50-65`)
   Spec called for it explicitly. Implementer chose to keep it implicit (history flows through `userMessage` via `buildReplyPromptPair`'s transcript rendering). Cleaner architecture; minor spec deviation. The risk: future consumers of `OrchestratorRequest` (a /cabal post-design tester, future orchestrator extensions) might want history as structured data, not just rendered prose. Logged as latent design choice; non-blocking.

3. **Orchestrator path is anthropic-SDK-only** (`packages/persona-engine/src/orchestrator/index.ts:186-190`)
   `runOrchestratorQuery` throws "ANTHROPIC_API_KEY required for SDK path" if anthropic isn't configured. Mixed-provider deployments (e.g., ruggy on anthropic, satoshi on bedrock) get asymmetric tool surfaces — only the anthropic character gets tools on chat path. This is a structural limitation, not a Sprint 3 introduction, but Sprint 3's chat-mode wiring inherits it. Worth surfacing explicitly: future cycle should consider an orchestrator-equivalent path for bedrock/freeside (substantial work; out of scope for V0.7-A.1).

4. **Routing-logic recreation in smoke is brittle** (`apps/bot/scripts/smoke-chat-routing.ts:128-140`)
   The smoke recreates `shouldUseOrchestrator`'s decision matrix in a local `expectedRoute` function. If the actual implementation in `compose/reply.ts:158-163` drifts from this matrix, the smoke would pass while production broke. Better pattern: export `shouldUseOrchestrator` (or just the decision function) so the smoke imports it. Non-blocking — the matrix is small enough that drift is unlikely; flag for hardening if the routing logic grows.

5. **No typing-indicator implementation** (`apps/bot/src/discord-interactions/dispatch.ts`)
   Spec line 528 mentioned `POST /channels/{id}/typing` as a UX nicety for tool round-trips. Sprint 3 doesn't add it. Cost: when chat-mode tool round-trips take 5-15 seconds, users see no acknowledgment; they may re-invoke or assume failure. Non-blocking for V1 ship; recommend follow-up cycle if dev-guild testing surfaces user friction.

### Assumptions Challenged

- **Assumption**: Anthropic is the right provider lock-in for the orchestrator path.
- **Risk if wrong**: If V0.7-A.x or V0.8.0 work surfaces that satoshi-on-bedrock needs tooled chat, the current implementation can't accommodate. Workaround: switch satoshi to anthropic provider. Cost: per-character LLM-provider override is already deferred per kickoff-substrate-prep §out-of-scope.
- **Recommendation**: Non-blocking for Sprint 3 since the operator hasn't requested mixed-provider tooled chat. Re-evaluate at V0.7-A.2+ if multi-character voice fidelity testing reveals this gap. Logged as forward-carry latent constraint.

### Alternatives Not Considered

- **Alternative**: Make `runOrchestratorQuery` provider-agnostic by abstracting the SDK boundary (anthropic SDK / bedrock fetch / freeside fetch) into a provider strategy.
- **Tradeoff**: Significant refactor (the SDK loop semantics — `query()`, MCP servers, allowedTools, settingSources — don't have direct equivalents in bedrock or freeside). Tool-call orchestration in non-anthropic providers requires either (a) a provider-side tool framework, or (b) prompt-engineering tool-mimicry. Both are large undertakings.
- **Verdict**: Out of scope for Sprint 3. Sprint 3 closes the operator's stated gap (anthropic-mode tooled chat) with the simplest delta. Deferring multi-provider tool surface to a future cycle is correct scope discipline.

---

## Documentation Verification

| Item | Status | Evidence |
|------|--------|----------|
| CHANGELOG entry | Deferred | Cycle-level CHANGELOG bump deferred to Sprint 4 (cycle close) per Sprint 1 + Sprint 2 pattern |
| CLAUDE.md updates | N/A | No new operator commands; chat surface unchanged from operator's view (it just gets smarter) |
| Code comments | PASS | `compose/reply.ts:142-165` documents the routing rule inline; `config.ts:97-117` documents CHAT_MODE values; deviation rationale at NOTES.md Decision Log entries 8 + 9 |
| Architecture docs | PASS | NOTES.md captures both deviations with reasoning |
| Test coverage | PASS | 24+ assertions across per-character isolation + CHAT_MODE matrix; live tool invocation deferred to Sprint 4 E2E |
| Test infrastructure | DEFERRED | Bun test migration carry-over from Sprint 1 + Sprint 2 |

---

## Previous Feedback Status

**From Sprint 2 review** (`grimoires/loa/a2a/sprint-2/engineer-feedback.md`):
- Forward-carry concern: "Sprint 3's reviewer must validate the channel-zone resolution step is in place" — **VERIFIED**. `apps/bot/src/discord-interactions/dispatch.ts:243-244` calls `getZoneForChannel(config, channelId)` and `selectedCharacterIds()` before invoking composeReply. Resolved zone + otherCharactersHere flow into composeReply correctly.

**From Sprint 1 review:**
- Bun test deferral: still deferred. Acknowledged in Sprint 3 reviewer.md Known Limitations §3.

---

## Decision

**Sprint 3 APPROVED** with 5 non-blocking concerns documented + 2 forward-carry items for Sprint 4:

**Forward-carry to Sprint 4:**
1. **Operator ratification of CHAT_MODE default** — Sprint 4's E2E validation should explicitly test both `auto` and `naive` paths to verify the rollout posture is correct.
2. **AC-3.1 + AC-3.2 live verification** — Sprint 4's E2E matrix exercises the live LLM tool invocations that Sprint 3 deferred.

Engineer's three questions answered:

1. **CHAT_MODE default deviation**: I accept `auto` as the default. The reasoning (avoid breaking bedrock/freeside) is correct. Operator can flip to `orchestrator` post-ratification if they want forcing-function rollout. Don't change in Sprint 3.

2. **No `conversationHistory` field**: acceptable. The implicit-via-userMessage pattern is cleaner. If a future caller wants structured history, add it then; YAGNI for now.

3. **AC-3.1/3.2 deferral**: proceed with Sprint 4. Live LLM round-trip in this session is wasteful (consumes credits, doesn't validate the deployed dispatcher endpoint) — Sprint 4's E2E matrix is the correct exercise point.

---

## Next Steps

1. Proceed to `/audit-sprint sprint-3` (security audit gate).
2. On audit pass → Sprint 4 (Phase E: persona prose + E2E validation).
3. Sprint 4 picks up: AC-3.1 + AC-3.2 live verification, voice-fidelity strip-the-name baseline, all 5 G-IDs validated.

---

*Generated by Senior Tech Lead Reviewer Agent · cycle-001 · 2026-05-02*
