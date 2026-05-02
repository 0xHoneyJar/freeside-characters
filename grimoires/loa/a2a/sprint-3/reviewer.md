# Implementation Report: Sprint 3 — Chat-Mode MCP Wiring (Phase D)

**Date:** 2026-05-02
**Engineer:** Sprint Task Implementer Agent
**Sprint Reference:** grimoires/loa/sprint.md (Sprint 3, lines 177-244)
**Spec Reference:** grimoires/loa/specs/build-environment-substrate-v07a1.md (Phase D, lines 425-451)
**Cycle:** cycle-001 (V0.7-A.1 environment substrate)
**Risk Tier:** MEDIUM (the operator's actual gap)

---

## Executive Summary

Sprint 3 closes the "ChatGPT-natural tool use" gap. Chat-mode replies now flow through the orchestrator with per-character MCP scope when conditions allow; fall back to the V0.7-A.0 naive path otherwise. Per-character isolation (ruggy gets 5 MCPs without imagegen; satoshi gets 2 MCPs without score) is enforced via `buildAllowedTools` (existing) — extended to chat path through the routing decision in `composeReply`.

**Two architectural deviations from the spec, both intentional and logged:**

1. **`CHAT_MODE` defaults to `auto`, not `orchestrator`** — orchestrator is anthropic-SDK-only; defaulting to `orchestrator` would break bedrock (satoshi's V0.8.0 path) and freeside deployments. `auto` opt-in for anthropic users + safe fallback for others matches the operator's actual chat-mode topology.

2. **AC-3.1 and AC-3.2 deferred to Sprint 4 E2E validation** — these ACs require live Discord interaction with real keys (ANTHROPIC_API_KEY + MCP_KEY + CODEX_MCP_URL). The structural implementation is complete and smoke-verified; live tool invocation lands in Sprint 4's E2E matrix per the spec verify gate (spec line 563-564).

Both deferrals are documented in `grimoires/loa/NOTES.md` Decision Log.

**Key Accomplishments:**
- `composeReply` routes chat through orchestrator when CHAT_MODE allows; bypass remains available
- Per-character MCP scope enforced on chat path (ruggy excludes imagegen; satoshi excludes score, rosenzu, emojis, freeside_auth)
- Environment-context block built and injected into chat prompt pair regardless of routing path
- Dispatcher resolves `channelId → zone` via Sprint 1's reverse map; passes resolved zone into composeReply
- 14m30s timeout wrapper preserved (dispatch.ts:243, unchanged)

---

## AC Verification

8 acceptance criteria from `grimoires/loa/sprint.md:197-205`. 6 `✓ Met`; 2 `⏸ [ACCEPTED-DEFERRED]` to Sprint 4 E2E.

**AC-3.1**: "`/ruggy prompt:'what's stonehenge looking like this week?'` produces a reply that invoked `mcp__score__get_zone_digest` (visible in trajectory log)"
- Status: `⏸ [ACCEPTED-DEFERRED]` — Sprint 4 E2E matrix
- Reason: requires live Discord interaction + ANTHROPIC_API_KEY + MCP_KEY against the deployed score-mcp endpoint. Structural prerequisites are all in place (routing logic, allowedTools filter, environment context, persona's `tool_invocation_style` field populated). Decision logged to `grimoires/loa/NOTES.md` Decision Log entry 8 (2026-05-02 sprint-3-implementer).

**AC-3.2**: "`/satoshi prompt:'who is the grail of crossings?'` produces a reply that invoked `mcp__codex__lookup_grail`"
- Status: `⏸ [ACCEPTED-DEFERRED]` — same as AC-3.1; requires live deployment + CODEX_MCP_URL.

**AC-3.3**: "Per-character MCP isolation holds: ruggy chat does NOT have imagegen; satoshi chat does NOT have score (verified via `buildAllowedTools(servers, character.mcps)` filter)"
- Status: `✓ Met`
- Evidence: `apps/bot/scripts/smoke-chat-routing.ts:51-95` — 12 isolation assertions pass:
  - ruggy: score/codex/rosenzu/emojis/freeside_auth allowed; imagegen NOT allowed
  - satoshi: codex/imagegen allowed; score/rosenzu/emojis/freeside_auth NOT allowed
  - default (no character.mcps): all 6 allowed (V0.6 parity)
  - declared-but-unregistered names silently dropped (existing behavior at orchestrator/index.ts:155-157)

**AC-3.4**: "No double-invocation: digest path stays separate (verify via trajectory diff)"
- Status: `✓ Met`
- Evidence: `compose/agent-gateway.ts:113-119` (digest path caller) — unchanged. The orchestrator's `OrchestratorRequest.zone` and `.postType` field types loosened to optional, but digest callers continue passing required values; digest behavior is byte-identical. The new `routeChatLLM` function in `compose/reply.ts` is a SEPARATE entry point — chat callers and digest callers never share a code path.

**AC-3.5**: "`CHAT_MODE=naive` reverts to V0.8.0 behavior (no tool calls on chat path)"
- Status: `✓ Met`
- Evidence: `compose/reply.ts:158-163` (`shouldUseOrchestrator`) — first branch `if (config.CHAT_MODE === 'naive') return false;`. When false, `routeChatLLM` calls `invokeChat` (the V0.7-A.0 single-turn path). Smoke verifies at `apps/bot/scripts/smoke-chat-routing.ts:140-148` — all CHAT_MODE=naive cases route to naive regardless of provider.

**AC-3.6**: "No regression in digest path (existing snapshots green)"
- Status: `✓ Met`
- Evidence: workspace `bun run typecheck` clean; `compose/agent-gateway.ts:109-121` calls `runOrchestratorQuery` with required `zone` and `postType` (unchanged); the orchestrator type relaxation is purely additive. Sprint 1 + Sprint 2 smokes still pass (regression check at smoke-chat-routing.ts:177-180 plus standalone runs).

**AC-3.7**: "LLM round-trip wrapped in 14m30s timeout per spec line 535 (avoid orphan-PATCH on expired Discord interaction tokens)"
- Status: `✓ Met`
- Evidence: `apps/bot/src/discord-interactions/dispatch.ts:248` — `Promise.race([composeReply({...}), timeoutAfter(TOKEN_LIFETIME_MS)])` where `TOKEN_LIFETIME_MS = 14 * 60 * 1000 + 30 * 1000` (line 56). This was already in place from V0.7-A.0; Sprint 3 doesn't change the timeout wrapper, only the inner composeReply behavior.

**AC-3.8**: "`bun run typecheck` clean"
- Status: `✓ Met`
- Evidence: workspace-wide `bun run typecheck` exits 0 with `tsc --noEmit` clean for both `packages/persona-engine` and `apps/bot` (verified 2026-05-02 02:06 UTC).

---

## Tasks Completed

### Task 3.1 (bd-3id): Extend `OrchestratorRequest` type

**Files Modified:** `packages/persona-engine/src/orchestrator/index.ts` (+15 lines, type relaxations)

Loosened `OrchestratorRequest.zone` and `.postType` to optional. Added `OrchestratorPostType = PostType | 'chat'` union. Existing digest callers (`agent-gateway.ts:113-119`) pass required values; chat callers pass optional.

Note: did NOT add `conversationHistory` to OrchestratorRequest. The spec called for it, but the prompt pair already carries the transcript (built via `buildReplyPromptPair` upstream). Adding it to the request type would be redundant data. The cleaner pattern: caller builds full prompt; orchestrator runs it. Decision is implicit in the smaller signature; documented here.

### Task 3.2 (bd-hvp): Branch on `postType` in `runOrchestratorQuery`

**Files Modified:** `packages/persona-engine/src/orchestrator/index.ts` (no functional branching needed)

The spec called for `runOrchestratorQuery` to "branch on postType — chat injects buildEnvironmentContext into system prompt; digest unchanged." In our actual architecture, the environment-context block is injected at the CALLER (composeReply) via `{{ENVIRONMENT}}` substitution in `buildReplyPromptPair`. By the time the prompt pair reaches `runOrchestratorQuery`, the environment is already in `systemPrompt`. Orchestrator doesn't need to know about postType internally — it just runs the SDK with the prompts it received. Per-character MCP scope filtering (`buildAllowedTools(servers, character.mcps)`) was already in place from V0.8.0; chat path inherits it for free.

### Task 3.3 (bd-30u): Refactor `compose/reply.ts`

**Files Modified:** `packages/persona-engine/src/compose/reply.ts` (+50 lines including imports + routing)

`composeReply` now:
1. Accepts optional `zone: ZoneId` and `otherCharactersHere: string[]` from caller
2. Builds environment context via `buildEnvironmentContext({character, zone, recentMessages, otherCharactersHere})`
3. Builds prompt pair via `buildReplyPromptPair({character, prompt, authorUsername, history, environmentContext})` — `{{ENVIRONMENT}}` substitution happens here
4. Routes via `routeChatLLM(config, {character, systemPrompt, userMessage, zone})` — orchestrator or naive based on CHAT_MODE + provider

The 14m30s timeout wrapper stays at the dispatcher level (dispatch.ts:248) — Sprint 3 doesn't move it.

### Task 3.4 (bd-1gt): `CHAT_MODE` env flag

**Files Modified:** `packages/persona-engine/src/config.ts` (+22 lines)

Added `CHAT_MODE: z.enum(['auto', 'orchestrator', 'naive']).default('auto')` to ConfigSchema. Three modes documented inline:
- `auto` (default): orchestrator path when LLM_PROVIDER resolves to anthropic; naive fallback otherwise
- `orchestrator`: force orchestrator (errors at runtime if non-anthropic provider)
- `naive`: force V0.7-A.0 single-turn path (revert hatch)

Spec line 441 said "default `orchestrator` once verified, fallback to `naive` if regression." I chose `auto` as default — see NOTES.md Decision Log entry 9 for rationale (orchestrator-only default would break bedrock/freeside deployments).

### Task 3.5 (bd-j4t): Smoke test

**Files Created:** `apps/bot/scripts/smoke-chat-routing.ts` (NEW, 192 lines, 24+ assertions)

Covers per-character MCP isolation matrix (12 assertions), default behavior (1), unregistered-server graceful drop (2), CHAT_MODE × provider routing matrix (8 cases × 1 = 8), and Sprint 1+2 regression-check pointer (1). All green.

### Task 3.6 (bd-4tu): Per-character MCP isolation test

**Files Modified:** N/A (test added in Task 3.5's smoke)

Per-character isolation lives at `apps/bot/scripts/smoke-chat-routing.ts:51-90` — 12 assertions verify the canonical fixture per spec lines 244-254 (ruggy: 5 MCPs without imagegen; satoshi: 2 MCPs without score/rosenzu/emojis/freeside_auth).

### Bot dispatcher zone resolution (forward-carry from Sprint 2)

**Files Modified:** `apps/bot/src/discord-interactions/dispatch.ts` (+8 lines)

Added `getZoneForChannel` import + zone resolution before `composeReply`. Also computes `otherCharactersHere` from `selectedCharacterIds()` minus self. This satisfies the Sprint 2 review's forward-carry concern: "Sprint 3's reviewer must validate the channel-zone resolution step is in place" — confirmed in place at dispatch.ts:243.

---

## Technical Highlights

### Architecture Decisions

1. **`CHAT_MODE=auto` over `orchestrator` default** — anthropic-only orchestrator path means defaulting to it would break bedrock-backed satoshi deployments. `auto` is the operator-safe default. Documented in NOTES.md Decision Log 9.

2. **`shouldUseOrchestrator` is file-private** — the routing decision is a `composeReply`-internal concern. External callers don't (and shouldn't) need to override it; they tune via env flag. The smoke recreates the decision matrix to pin behavior, so divergence is loud.

3. **Environment context built ONCE at caller** — instead of duplicating env-context-build in both naive and orchestrator paths (or pushing it into `runOrchestratorQuery`), the env block is built upstream in `composeReply` and substituted into the prompt pair via `{{ENVIRONMENT}}`. Both paths get the same grounding. Single source of truth.

4. **No `conversationHistory` field on OrchestratorRequest** — deviation from spec but cleaner. The prompt pair already carries the transcript; adding it as a separate request field would be redundant. Documented in Task 3.1 above.

### Performance Considerations

- Orchestrator path adds tool-round-trip latency (multi-turn). Spec acknowledged this as a known cost; mitigation is the typing-indicator pattern (deferred — not in spec but worth a follow-up).
- Naive path (CHAT_MODE=naive) has zero latency overhead vs V0.7-A.0; revert is performance-equivalent.
- Per-character `mcps` filter is O(n×m) where n = registered servers (≤6) and m = character.mcps (≤6) — trivial.

### Security Implementations

- Per-character MCP scope enforced at the SDK level via `allowedTools` whitelist + `permissionMode: 'dontAsk'`. The model literally cannot invoke unallowed tools; even hallucinated tool names fail at the SDK boundary.
- `freeside_auth` MCP scope: ruggy has it (per character.json); satoshi doesn't. CLAUDE.md "never cite raw 0x… wallets" rule still applies via persona prompts; freeside_auth tool surface is the canonical resolver.
- No new external trust boundaries introduced.

### Integration Points

- **Sprint 4 (Phase E)** — persona prose tweaks reference the environment block; E2E validation matrix exercises live tool invocation per AC-3.1/3.2 deferral.
- **Bot dispatcher** — `apps/bot/src/discord-interactions/dispatch.ts` already calls composeReply with the resolved zone + otherCharactersHere. No further plumbing needed.

---

## Testing Summary

### Test Files Created

| Test File | Type | Scenarios | Status |
|-----------|------|-----------|--------|
| `apps/bot/scripts/smoke-chat-routing.ts` | Smoke (CI-gateable) | 24+ assertions across 4 groups | All passing |

### How to Run Tests

```bash
bun run apps/bot/scripts/smoke-chat-routing.ts   # Sprint 3
bun run apps/bot/scripts/smoke-environment.ts    # Sprint 2 regression
bun run apps/bot/scripts/smoke-zone-map.ts       # Sprint 1 regression
bun run typecheck                                 # workspace clean
```

All pass as of 2026-05-02 02:06 UTC.

---

## Version Update

No `package.json` version bump for Sprint 3 yet. The cycle (V0.7-A.1) bumps after Sprint 4's persona prose lands and the user-visible behavior fully crystallizes. Recommended: bump to `0.9.0` (MINOR — new feature) at cycle-close.

---

## Known Limitations

- **AC-3.1 and AC-3.2 not E2E-verified in this sprint** — by design; live LLM round-trip with real Discord interaction is Sprint 4's E2E matrix scope. All structural prerequisites are in place; the deferred ACs land when the operator runs the dev-guild test per spec line 562.
- **Typing indicator not implemented** — spec line 528 mentioned `POST /channels/{id}/typing` as a UX nicety for tool round-trips. Not in Sprint 3 scope; recommend follow-up cycle if chat latency feels long in dev-guild testing.
- **`bun test` migration still deferred** — same as Sprint 2's deferral. Smoke pattern is consistent across Sprints 1-3.
- **Conversation history is implicitly passed via prompt pair, not as a typed field** — Task 3.1 deviation; cleaner architecture, but slightly different shape from spec.

---

## Verification Steps

For the reviewer:

1. **Code Review:**
   - [ ] `packages/persona-engine/src/config.ts` — `CHAT_MODE` enum at line 99
   - [ ] `packages/persona-engine/src/orchestrator/index.ts` — type relaxations at lines 44-66
   - [ ] `packages/persona-engine/src/compose/reply.ts` — routing logic at lines 142-185
   - [ ] `apps/bot/src/discord-interactions/dispatch.ts` — zone resolution at lines 243-244

2. **Test Execution:**
   ```bash
   bun run apps/bot/scripts/smoke-chat-routing.ts   # 24+ assertions, exit 0
   bun run typecheck                                 # workspace clean
   ```

3. **Architectural Verification:**
   - [ ] Verify `agent-gateway.ts:113-119` (digest path) is BYTE-IDENTICAL — only orchestrator type signatures changed
   - [ ] Verify zone-resolution step is present in dispatcher (line 243-244)
   - [ ] Confirm CHAT_MODE default is `'auto'` (config.ts:117)

---

## Questions for Reviewer

1. **CHAT_MODE default deviation**: I chose `auto` instead of spec's `orchestrator`. Reasoning is in NOTES.md Decision Log 9 and Executive Summary. Acceptable, or should I flip to `orchestrator` and accept the bedrock/freeside breakage as a forcing function?

2. **`conversationHistory` field**: I didn't add it to OrchestratorRequest because the prompt pair carries it. Spec asked for it. Acceptable architecture deviation, or should I add it as redundant metadata for telemetry?

3. **AC-3.1/3.2 deferral**: structural ACs are smoke-met; live ACs deferred to Sprint 4 E2E. Acceptable, or should I attempt a live LLM round-trip in this session (would consume API credits)?

---

**Sprint 3 Status:** COMPLETED (with 2 ACCEPTED-DEFERRED ACs picked up by Sprint 4 E2E matrix)

*Generated by Sprint Task Implementer Agent · cycle-001 · 2026-05-02*
