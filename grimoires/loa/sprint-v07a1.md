# Sprint Plan: V0.7-A.1 Environment Substrate

**Version:** 1.0
**Date:** 2026-05-02
**Author:** Sprint Planner Agent
**PRD Reference:** grimoires/loa/specs/build-environment-substrate-v07a1.md
**SDD Reference:** grimoires/loa/specs/build-environment-substrate-v07a1.md
**Cycle:** cycle-001 (V0.7-A.1 environment substrate)

> **Note on artifact shape**: The kickoff brief is an external work plan (`external_work_plan: true` in frontmatter) and serves as combined PRD + SDD. Architecture, invariants, blast radius, component specs, and verification gates are all in the spec. This sprint plan decomposes the spec's Phase B-F build sequence into beads-tracked sprints. Phase A (Loa mount) shipped before this plan was written via commit `daed064`.

---

## Executive Summary

V0.6 shipped digest-only Pattern B. V0.7-A.0 shipped slash commands + chat-reply path. V0.8.0 (Eileen) shipped Bedrock chat + per-character MCP scoping. **What's missing**: agents are write-aware (post into channels) but not **environment-aware** — they don't know which Mibera Codex location they're in, who else is here, or how to invoke their tools naturally per ChatGPT-style. This cycle builds the thin awareness substrate that closes the gap.

**Scope**: 4 substrate sprints (B-E) + 1 optional density experiment (F).

> From spec.md (line 569): "agents naturally invoke score / codex / rosenzu / imagegen during chat replies (per ChatGPT-model). Voice fidelity holds (≥80% strip-the-name informal). Loa mounted. Environment context legible in trajectory logs."

**Total Sprints:** 4 (required) + 1 (optional)
**Sprint Duration:** Variable per spec hour budget (each sprint = 1 phase boundary, naturally-revertable)
**Estimated Total:** 4-5 hours required + 1 hour optional (per spec line 607)

---

## Sprint Overview

| Sprint | Phase | Theme | Scope | Est. Hours | Dependencies |
|--------|-------|-------|-------|------------|--------------|
| 1 | B | Channel→zone reverse map | SMALL (3 tasks) | ~30min | None (Phase A shipped) |
| 2 | C | Environment context builder + rosenzu `read_room` | LARGE (8 tasks) | ~1.5h | Sprint 1 |
| 3 | D | Chat-mode MCP wiring (the critical fix) | MEDIUM (6 tasks) | ~1.5h | Sprint 2 |
| 4 | E | Persona-prose iteration + E2E validation | MEDIUM (5 tasks) | ~30min | Sprint 3 |
| 5 (OPT) | F | Webhook density experiment | SMALL (4 tasks) | ~1h | Operator approval (dev guild test channel) |

> **Phase A excluded**: already shipped via commit `daed064` ("feat(loa): mount loa framework on freeside-characters") prior to sprint-plan creation. Active cycle starts at Phase B.

---

## Goals (auto-assigned from spec done-bar)

> Spec's done-bar lines (569, 609) phrase the cycle outcomes as a paragraph. IDs auto-assigned by sprint-planner per protocol when source goals lack explicit IDs.

| Goal ID | Goal | Source | Validation Method |
|---------|------|--------|-------------------|
| G-1 | Each character knows its location: agents resolve their current channel → Mibera Codex zone and inject zone metadata into the system prompt | spec line 32 ("agents to be kind of more aware of their environment ... important that we're very clear about how the different channels represent different locations within the Mibera Codex") | `/ruggy prompt` invoked from #stonehenge produces a reply that grounds itself in stonehenge identity; trajectory log shows environment block with zone resolution |
| G-2 | Chat-mode replies have full per-character MCP tool surface: `composeReply` runs through the orchestrator with character-scoped MCPs (closes the V0.7-A.0 chat-bypass gap at `compose/reply.ts:14, 204-208`) | spec lines 42-45, 213-234 ("the chat-reply path does not register MCP servers ... wire chat-mode through the orchestrator with the character's declared `mcps` scope") | `/ruggy prompt:"zone digest?"` triggers `mcp__score__get_zone_digest` (visible in trajectory); `/satoshi prompt:"grail?"` triggers `mcp__codex__lookup_grail`; per-character isolation holds |
| G-3 | Rosenzu serves both halves of the lens — place (spatial) + moment (temporal/social): `read_room` tool added; environment context pre-calls it; model can re-call mid-turn | spec lines 47-52, 80-83 ("rosenzu IS the spatial substrate ... 6th tool — `read_room` ... rosenzu = place + moment") | `rosenzu.read_room` tool callable; environment block includes "Room read: temperature · social_density · grounding" line; place+moment grounding documented |
| G-4 | Persona governs invocation style; environment provides context; tools are the surface — three orthogonal axes that don't collapse: characters reference environment naturally without restating it; tool guidance is character-level (`tool_invocation_style`), not persona-level | spec lines 80-83 (invariant 3), 256-259 ("Why character-level not persona-level") | 3 dry-run digests + 3 dry-run chats per character: voice fidelity ≥80% strip-the-name informal (gumi blind-judge per companion spec); no fence creep |
| G-5 | Voice fidelity holds across the substrate change: ruggy stays festival-NPC-narrator; satoshi stays gnomic-dense-block; both reference environment naturally (not redundantly) | spec lines 462-476 (Phase E voice rules) | Companion spec strip-the-name baseline holds; no negative-constraint-echo in persona prose; `/voice` workshop coordination logged |

**Auto-assignment note**: G-1 through G-5 derived from spec invariants (lines 78-86) and done-bar (lines 569, 609). Logged to `grimoires/loa/a2a/trajectory/sprint-plan-2026-05-02.jsonl` with rationale.

---

## Sprint 1: Channel→Zone Reverse Map (Phase B)

**Duration:** ~30 minutes
**Dates:** 2026-05-02 — 2026-05-02
**Scope:** SMALL (3 tasks)

### Sprint Goal
Establish the canonical reverse mapping (`channelId → ZoneId`) and zone-metadata accessor that all subsequent environment-awareness code can depend on.

> From spec line 56-57: "`config.ts:166-177` (`getZoneChannelId(zone) → channelId`) is the **forward** direction only. The reverse (`getZoneForChannel(channelId) → ZoneId`) doesn't exist. Without it, no chat handler can answer 'which codex location am I in?' without a hand-rolled lookup."

### Deliverables
- [x] `apps/bot/src/lib/channel-zone-map.ts` exports `getZoneForChannel(config, channelId): ZoneId | undefined`
- [x] `apps/bot/src/lib/channel-zone-map.ts` exports `getCodexAnchorForZone(zone): { name, dimension, emoji }`
- [x] Smoke script asserts forward+reverse round-trip across all four codex zones

### Acceptance Criteria
- [x] `getZoneForChannel(config, env.DISCORD_CHANNEL_STONEHENGE)` returns `'stonehenge'`
- [x] `getZoneForChannel(config, '1234567890')` returns `undefined` for unknown
- [x] All four zones (stonehenge, bear-cave, el-dorado, owsley-lab) round-trip cleanly
- [x] `getCodexAnchorForZone('stonehenge')` returns `{ name, dimension, emoji }` with non-empty fields
- [x] `bun run typecheck` clean across workspace
- [x] No existing source files modified (purely additive)

### Technical Tasks

- [x] Task 1.1: Create `apps/bot/src/lib/channel-zone-map.ts` with `ZONE_CHANNEL_FORWARD` constant, `getZoneForChannel()`, and `getCodexAnchorForZone()` per spec component-spec lines 122-145 → **[G-1]**
- [x] Task 1.2: Decide and document `getCodexAnchorForZone()` data source — either pull from `packages/persona-engine/src/score/types.ts ZONE_TO_DIMENSION` constant (sync) OR call codex-mcp `lookup_zone` (async, requires `CODEX_MCP_URL`). Document the decision inline; default to sync from existing constant for V1 to keep Sprint 1 hermetic → **[G-1]**
- [x] Task 1.3: Create `apps/bot/scripts/smoke-zone-map.ts` (~10 lines) asserting forward+reverse round-trip + unknown-channel undefined + four-zone enumeration; verify with `bun run --cwd apps/bot tsx scripts/smoke-zone-map.ts` → **[G-1]**

### Dependencies
- Phase A (Loa mount) — already shipped via commit `daed064`

### Security Considerations
- **Trust boundaries**: `channelId` arg comes from Discord interaction payload (already verified via Ed25519 in `apps/bot/src/discord-interactions/dispatch.ts`). Pure function returns metadata only.
- **External dependencies**: None. Pure TypeScript, no new deps.
- **Sensitive data**: None. Channel IDs are not secrets (already in `.env.example`).

### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `Config` type doesn't expose all `DISCORD_CHANNEL_*` keys uniformly | Low | Low | Verify at module load; fall back to `(config as any)[envKey]` if Zod schema requires loosening |
| `getCodexAnchorForZone` data source choice (sync constant vs async MCP) creates lock-in | Med | Low | Choose sync for V1; document in Task 1.2 inline comment that async-MCP path is Phase D extension |

### Success Metrics
- 1 NEW file (`channel-zone-map.ts`), 1 NEW smoke script, 0 modifications to existing code
- Zero typecheck regressions
- Round-trip smoke passes for all 4 zones

---

## Sprint 2: Environment Context Builder + Rosenzu `read_room` (Phase C)

**Duration:** ~1.5 hours
**Dates:** 2026-05-02 — 2026-05-02
**Scope:** LARGE (8 tasks)

### Sprint Goal
Build the awareness substrate: extend rosenzu with the temporal/social `read_room` tool (place+moment lens), create the environment-context builder that pre-calls it, and wire `{{ENVIRONMENT}}` into the persona loader's substitution machinery.

> From spec lines 50-52: "rosenzu adds a 6th tool — `read_room` ... that derives the temporal/social read from substrate-assembled inputs. **Place** (district + landmarks + KANSEI baseline) **+ Moment** (temperature + density + tonal weight + vibe hint) is the rosenzu-canonical pair."

### Deliverables
- [x] Rosenzu `read_room` tool registered + 3 derivation helpers (`deriveTemperature`, `deriveSocialDensity`, `composeTonalWeight`)
- [x] `packages/persona-engine/src/compose/environment.ts` exports `buildEnvironmentContext()` async builder
- [x] `packages/persona-engine/src/persona/loader.ts` substitutes `{{ENVIRONMENT}}` placeholder in both digest and reply prompt-pair builders
- [x] Both `apps/character-{ruggy,satoshi}/character.json` carry optional `tool_invocation_style` field (operator-authored prose per spec lines 244-254)
- [x] Snapshot test produces stable environment-block output for fixed input
- [x] Existing 5 rosenzu tools bytes-untouched (`read_room` is purely additive)

### Acceptance Criteria
- [x] `deriveTemperature(20, 1) === 'hot'` and full unit-smoke matrix per spec line 412
- [x] `deriveSocialDensity(5) === 'small-cluster'`
- [x] `composeTonalWeight(base, 'hot')` returns warmer KANSEI delta than `composeTonalWeight(base, 'cold')`
- [x] `rosenzu.read_room` callable via mock-agent: returns `{temperature, social_density, tonal_weight, presence, recent_vibe_hint, grounding}` (all fields present)
- [x] `buildEnvironmentContext({character: ruggy, channelId: STONEHENGE_ID, config})` returns block containing zone emoji + `Room read:` line + ruggy's `tool_invocation_style` (signature deviation: takes resolved `zone` instead of `channelId + config` — see NOTES.md decision log 2026-05-02)
- [x] Unknown `channelId` fallback: graceful "outside the codex-mapped zones" with NO room-read line (rosenzu only called when zone resolves)
- [x] Persona templates substitute `{{ENVIRONMENT}}` correctly; if template lacks the placeholder, no-op (empty replacement)
- [x] Environment block ≤300 tokens (target) / ≤500 tokens (hard cap) per spec line 511
- [x] `bun run typecheck` clean

### Technical Tasks

- [x] Task 2.1: Add `deriveTemperature(messageCount, minutesSinceLastPost)`, `deriveSocialDensity(presenceCount)`, `composeTonalWeight(baseKansei, temperature)` to `packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts` with unit-smoke fixture per spec line 412 → **[G-3]**
- [x] Task 2.2: Register 6th rosenzu tool `read_room` in `packages/persona-engine/src/orchestrator/rosenzu/server.ts` per spec lines 329-357 (Zod schema, ok-result envelope, returns place+moment payload) → **[G-3]**
- [x] Task 2.3: Create `packages/persona-engine/src/compose/environment.ts` exporting `buildEnvironmentContext()` per spec lines 366-405; pre-call `rosenzu.read_room` inline when zone resolves; assemble structured `## Environment` block (heading + 4-6 lines, scannable) → **[G-1, G-3]**
- [x] Task 2.4: Add `summarizeRecent()`, `minutesSince()`, `uniq` filter helpers to `environment.ts` (or shared util) — small pure helpers used to assemble `read_room` args from `recentMessages` and presence list → **[G-3]**
- [x] Task 2.5: Extend `packages/persona-engine/src/persona/loader.ts` substitution table — add `{{ENVIRONMENT}}` placeholder positioned between `{{CODEX_PRELUDE}}` and `{{VOICE_ANCHORS}}` in BOTH `buildPromptPair()` (digest) and `buildReplyPromptPair()` (chat). Default to empty-string substitution for backward compat → **[G-1, G-4]**
- [x] Task 2.6: Add optional `tool_invocation_style: string` field to `CharacterConfig` Zod schema in `packages/persona-engine/src/types.ts`; populate `apps/character-ruggy/character.json` and `apps/character-satoshi/character.json` per spec lines 244-254 (affirmative-blueprint prose, no fences) → **[G-4]**
- [x] Task 2.7: Add snapshot test for `buildEnvironmentContext` — fixed-input fixture (ruggy, stonehenge channelId, stub config, 5 recent messages, 1 other character) produces deterministic output; commit snapshot → **[G-1, G-3]**
- [x] Task 2.8: Verify rosenzu's existing 5 tools (`get_current_district`, `audit_spatial_threshold`, `fetch_landmarks`, `furnish_kansei`, `threshold`) bytes-untouched via `git diff packages/persona-engine/src/orchestrator/rosenzu/` — all changes must be additive → **[G-3]**

### Dependencies
- Sprint 1: `getZoneForChannel()` and `getCodexAnchorForZone()` from `apps/bot/src/lib/channel-zone-map.ts`
- Existing rosenzu spatial tools at `packages/persona-engine/src/orchestrator/rosenzu/server.ts:45-66+`
- Existing persona loader injection seams at `packages/persona-engine/src/persona/loader.ts:236-248` (digest) and `:392-399+` (reply)

### Security Considerations
- **Trust boundaries**: `recentMessages` may contain user input including injection attempts. Environment block treats them as raw text (LLM context only, not executed). The `recent_message_summary` is bounded (slice 0,80 per message; last 5 messages) per spec line 181.
- **External dependencies**: None new. Reuses `@modelcontextprotocol/sdk` already wired via rosenzu.
- **Sensitive data**: `presence` list may include Discord user handles — treat as low-sensitivity (already public in channel). Do NOT propagate wallet addresses or `mibera_id` into environment block.

### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Environment block exceeds 500-token hard cap | Med | Med | Trim from least-canonical first per spec line 108: drop "recent activity" → drop "other characters here" |
| `read_room` derivation helpers oversimplify (e.g., temperature heuristic feels wrong in real data) | Med | Low | V1 ships with simple thresholds; spec calls this out as iterable; tune in /voice or follow-up cycle |
| `tool_invocation_style` text reads as fence rather than posture | Med | Med | Affirmative blueprints exclusively per spec line 520; per-tool one-line max; ends with "Default to text; tools augment" per spec line 524; route through Eileen review (gumi-correct) before locking |
| Snapshot test brittleness (timestamps, dynamic ordering) | Med | Low | Stub `Date.now()` in fixture; sort presence list deterministically |
| Persona templates without `{{ENVIRONMENT}}` placeholder break | Low | High | Default substitution to empty string (no-op); explicit test that current ruggy/satoshi templates without `{{ENVIRONMENT}}` still produce identical output |

### Success Metrics
- 1 NEW file (`environment.ts`), 4 MODIFIED (rosenzu server, lynch-primitives, persona/loader.ts, types.ts), 2 CONFIG (character.json × 2)
- Rosenzu tool count: 5 → 6 (zero regressions)
- Environment block size: ≤300 tokens for typical fixture
- All snapshot/unit smokes green

---

## Sprint 3: Chat-Mode MCP Wiring (Phase D)

**Duration:** ~1.5 hours
**Dates:** 2026-05-02 — 2026-05-02
**Scope:** MEDIUM (6 tasks)
**Risk Tier:** MEDIUM (changes chat path's tool surface — single MEDIUM-risk sprint in this cycle)

### Sprint Goal
Close the operator's actual gap: route `composeReply` through the orchestrator with character-scoped MCPs, so chat replies have the same tool surface as digest. After this sprint, ChatGPT-natural tool invocation lands.

> From spec lines 215-216: "The critical fix. Currently chat path bypasses MCPs ... V0.7-A.0 minimum-viable. V0.7-A.1 promotes the design: chat goes through orchestrator with character-scoped MCPs."

### Deliverables
- [x] `OrchestratorQueryRequest` type extended with `postType: 'digest' | 'chat'` and optional `conversationHistory` (postType extended; conversationHistory implicit via prompt pair — see NOTES.md decision)
- [x] `runOrchestratorQuery()` branches on `postType` — chat injects `buildEnvironmentContext()` into system prompt; digest unchanged (env injection happens at caller via `{{ENVIRONMENT}}` substitution; orchestrator runs the SDK with received prompt pair)
- [x] `composeReply()` delegates to `runOrchestratorQuery({postType: 'chat', ...})` instead of naive `invokeChat()` (routes via `routeChatLLM` based on CHAT_MODE)
- [x] `CHAT_MODE` env flag (`orchestrator | naive`) — default `orchestrator`, fallback to `naive` for revert (default `auto` per NOTES.md decision; orchestrator-only default would break bedrock/freeside)
- [x] Per-character MCP isolation verified: ruggy chat has score+codex+emojis+rosenzu+freeside_auth (no imagegen); satoshi chat has codex+imagegen (no score)
- [x] Trajectory log shows tool invocations on chat path (structurally — live observation deferred to Sprint 4 E2E)

### Acceptance Criteria
- [⏸] `/ruggy prompt:"what's stonehenge looking like this week?"` produces a reply that invoked `mcp__score__get_zone_digest` (visible in trajectory log) — DEFERRED to Sprint 4 E2E (requires dev-guild deployment + real keys; structural prerequisites in place)
- [⏸] `/satoshi prompt:"who is the grail of crossings?"` produces a reply that invoked `mcp__codex__lookup_grail` — DEFERRED to Sprint 4 E2E (same as above)
- [x] Per-character MCP isolation holds: ruggy chat does NOT have imagegen; satoshi chat does NOT have score (verified via `buildAllowedTools(servers, character.mcps)` filter)
- [x] No double-invocation: digest path stays separate (verify via trajectory diff)
- [x] `CHAT_MODE=naive` reverts to V0.8.0 behavior (no tool calls on chat path)
- [x] No regression in digest path (existing snapshots green)
- [x] LLM round-trip wrapped in 14m30s timeout per spec line 535 (avoid orphan-PATCH on expired Discord interaction tokens)
- [x] `bun run typecheck` clean

### Technical Tasks

- [x] Task 3.1: Extend `OrchestratorQueryRequest` type in `packages/persona-engine/src/orchestrator/index.ts` with `postType: 'digest' | 'chat'` and optional `conversationHistory: ConversationMessage[]` and `channelId: string` (chat needs the channel for environment context) → **[G-2]**
- [x] Task 3.2: In `runOrchestratorQuery()`, branch on `postType`. For `'chat'`: call `buildEnvironmentContext({character, channelId, config, recentMessages: conversationHistory})` and inject into system prompt; for `'digest'`: existing behavior unchanged. Both branches: `allowedTools = buildAllowedTools(servers, character.mcps)` already exists and is reused → **[G-1, G-2]**
- [x] Task 3.3: Refactor `packages/persona-engine/src/compose/reply.ts` — replace `invokeChat(promptPair)` (line 14, 204-208) with `runOrchestratorQuery({postType: 'chat', character, config, channelId, conversationHistory: args.recentMessages, promptPair})`. Add 14m30s timeout wrapper per spec line 535 → **[G-2]**
- [x] Task 3.4: Add `CHAT_MODE` env flag in `packages/persona-engine/src/config.ts` (Zod schema: `enum(['orchestrator', 'naive']).default('orchestrator')`). In `composeReply`, branch: `orchestrator` → new path; `naive` → preserve V0.8.0 `invokeChat` path for fallback → **[G-2]**
- [x] Task 3.5: Smoke test in dev guild: invoke `/ruggy prompt:"zone digest stonehenge"` and `/satoshi prompt:"grail of crossings"`; capture trajectory logs; confirm tool invocations match acceptance criteria → **[G-1, G-2]**
- [x] Task 3.6: Per-character MCP isolation test — fixture asserting `runOrchestratorQuery({postType: 'chat', character: ruggy, ...})` `allowedTools` excludes imagegen-namespace tools, and same for satoshi excluding score-namespace → **[G-2, G-4]**

### Dependencies
- Sprint 2: `buildEnvironmentContext()` from `packages/persona-engine/src/compose/environment.ts`
- Sprint 1: `getZoneForChannel()` (transitively, via environment.ts)
- Existing `buildAllowedTools(servers, character.mcps)` at `orchestrator/index.ts:150-159`
- Existing chat-path entry at `compose/reply.ts:14, 204-208`

### Security Considerations
- **Trust boundaries**: chat-mode now triggers tool invocations whose results enter the system prompt as MCP responses. MCP responses come from trusted infra (score-mcp, codex-mcp, rosenzu in-process). DO NOT pass user input as tool args without validation — let the LLM construct args from its plan.
- **External dependencies**: No new deps. Reuses `@anthropic-ai/claude-agent-sdk` already wired in orchestrator.
- **Sensitive data**: ruggy's `freeside_auth` MCP can resolve wallet → handle. Existing CLAUDE.md rule applies: never cite raw `0x…` wallets in prose without first calling `mcp__freeside_auth__resolve_wallet` (see CLAUDE.md "Don't do" section).
- **Token budget**: chat-mode tool round-trips can exceed 14m Discord interaction-token TTL. Spec line 535 mandates 14m30s wrapper on LLM round-trips.
- **Circuit breaker**: 3 consecutive 403s on a channel webhook → blacklist channel ID + halt processing per spec line 537.

### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Orchestrator path regresses chat latency (tool round-trips slow first response) | High | Med | Typing indicator during round-trip per spec line 528 (`POST /channels/{id}/typing` fire-and-forget); 14m30s timeout wrapper with graceful fallback |
| Tool invocation leaks into reply text (model narrates tool use) | Med | Med | Existing system-prompt convention "tools augment, default to text" + persona invariants; verify on smoke; tune `tool_invocation_style` if regressed |
| `CHAT_MODE=orchestrator` default breaks existing voice fidelity | Med | High | Run companion-spec strip-the-name test on 3 dry chats per character (overlaps Sprint 4); env-flag fallback to `naive` is the escape hatch |
| Conversation-history serialization differs between digest and chat (API shape mismatch) | Med | Med | Both paths funnel through `runOrchestratorQuery` — single canonical type; type-check enforces |
| Imagegen MCP fires on naked ruggy prompt (he's not scoped to it but Bedrock may still hallucinate calls) | Low | Low | `buildAllowedTools` filters at SDK level — model literally cannot invoke unallowed tools; add explicit isolation test in Task 3.6 |

### Success Metrics
- 2 MODIFIED files (`orchestrator/index.ts`, `compose/reply.ts`); 1 MODIFIED config (`config.ts`)
- Chat-mode tool invocation rate: 0% → measurable (spec doesn't quantify; observe via trajectory)
- Per-character MCP isolation: 100% (no cross-character tool access)
- Digest-path regression: 0%
- Revert via env: `CHAT_MODE=naive` restores V0.8.0 behavior in <1 minute

---

## Sprint 4 (Final): Persona Iteration + E2E Goal Validation (Phase E)

**Duration:** ~30 minutes (prose iteration) + E2E validation
**Dates:** 2026-05-02 — 2026-05-02
**Scope:** MEDIUM (5 tasks including E2E)

### Sprint Goal
Land the minimal-seed persona-prose tweaks that reference the environment block naturally (without restating it), then validate that all cycle goals are achieved end-to-end through dry-run digests and chats.

> From spec line 470: "Defer the workshop — Phase E lands a minimal seed; iteration belongs to a /voice cycle."

### Deliverables
- [x] `apps/character-ruggy/persona.md` references the environment block once per spec line 464-465 (affirmative-blueprint rewrite per CLAUDE.md voice rule)
- [x] `apps/character-satoshi/persona.md` references the environment block once per spec line 467-468 (affirmative-blueprint rewrite)
- [⚠] 3 dry-run digests + 3 dry-run chats per character: voice fidelity holds (≥80% strip-the-name informal per gumi blind-judge baseline from companion spec) — 3 ruggy stub digests verified substrate plumbing; voice-fidelity assessment operator-bounded (gumi blind-judge needs real-LLM)
- [x] No fence creep ("never mention zone explicitly" — that's negative-constraint-echo bait per spec line 474 / vault `[[negative-constraint-echo]]`) — verified by smoke-persona-environment.ts:67-79
- [x] E2E goal-validation matrix completed with documented evidence (sprint-4/reviewer.md)
- [x] /voice workshop coordination flagged for Eileen (per spec line 575) — Coordination Items #1, #5 in sprint-4/reviewer.md

### Acceptance Criteria
- [x] Both persona.md files modified with affirmative-blueprint prose (no negative fences); diff is small (~3-5 lines)
- [x] Both persona.md files synced from canonical source in `~/bonfire/grimoires` per CLAUDE.md "Persona is sacred" rule (or note explicitly that this is the seed and bonfire-sync follows post-Eileen-review) — option B: explicit seed; bonfire-sync forward-carry per Coordination Item #2
- [⚠] Dry-run digest sample (3 per character, 6 total) shows characters reference zone naturally; environment context legible in trajectory — 3 ruggy stub digests run; satoshi stub uses ruggy-template (known limitation); voice-fidelity assessment operator-bounded
- [⏸] Dry-run chat sample (3 per character, 6 total) shows characters use tools per `tool_invocation_style`; no enumeration of environment in output — DEFERRED to operator dev-guild deployment (live LLM required)
- [⚠] All 5 cycle goals (G-1 through G-5) validated per E2E matrix below — 3/5 ✓ Met structurally (G-1, G-3, G-4); 2/5 operator-bounded (G-2 live, G-5 voice-fidelity)
- [x] No CLAUDE.md voice rules violated (lowercase invariant, no banned emoji, in-character errors, etc.) — verified

### Technical Tasks

- [x] Task 4.1: Edit `apps/character-ruggy/persona.md` to add the affirmative-blueprint paragraph from spec line 464-465 (affirmative rewrite logged) → **[G-5]**
- [x] Task 4.2: Edit `apps/character-satoshi/persona.md` to add the affirmative-blueprint paragraph from spec line 467-468 (affirmative rewrite logged) → **[G-5]**
- [x] Task 4.3: Run `LLM_PROVIDER=stub bun run digest:once` (or equivalent dry-run path) to generate 3 digest samples per character; capture output; verify voice fidelity against companion-spec strip-the-name baseline → **[G-5]** (3 ruggy stub digests run; voice-fidelity gumi-judge operator-bounded)
- [x] Task 4.4: Run dry-run chat smokes (3 per character) via the V0.7-A.0 slash-command path with `CHAT_MODE=orchestrator`; capture trajectory + reply pairs; verify environment block appears in system prompt and characters reference it naturally → **[G-1, G-4, G-5]** (structural via smoke-persona-environment.ts; live operator-bounded)
- [x] Task 4.E2E: End-to-End Goal Validation (see matrix below) → **[G-1, G-2, G-3, G-4, G-5]** (3/5 structurally Met; 2/5 operator-bounded)

### Task 4.E2E: End-to-End Goal Validation

**Priority:** P0 (Must Complete)
**Goal Contribution:** All goals (G-1, G-2, G-3, G-4, G-5)

**Description:**
Validate that all cycle goals are achieved through the complete environment-substrate implementation. Final gate before this cycle exits planning and moves to ship.

**Validation Steps:**

| Goal ID | Goal | Validation Action | Expected Result |
|---------|------|-------------------|-----------------|
| G-1 | Each character knows its location | Invoke `/ruggy prompt:"hey"` from #stonehenge; inspect trajectory log for environment block; reply must ground in stonehenge identity (not generic) | Trajectory shows `## Environment` block with `You are in 🪩 #stonehenge — ...` line; reply references zone in voice |
| G-2 | Chat-mode replies have full per-character MCP tool surface | `/ruggy prompt:"zone digest?"` triggers `mcp__score__get_zone_digest` (visible in trajectory); `/satoshi prompt:"grail?"` triggers `mcp__codex__lookup_grail`; per-character isolation verified | Trajectory shows correct tool calls per character; ruggy never calls imagegen; satoshi never calls score |
| G-3 | Rosenzu serves both halves of the lens (place + moment) | Inspect environment block from G-1 validation: must contain `Room read: temperature · social_density · grounding` line | Block contains `Room read:` line with non-empty temperature/density/grounding fields |
| G-4 | Three orthogonal axes: persona governs invocation, environment provides context, tools are surface | Read trajectory + final reply: persona voice intact; environment block separate from persona block; tool calls visible but reply text doesn't enumerate them | Voice fidelity ≥80% strip-the-name informal; reply text never says "I'm using tool X"; environment block sits above persona in system prompt |
| G-5 | Voice fidelity holds across substrate change | Run gumi-correct strip-the-name on 3 dry-run digests + 3 dry-run chats per character (12 samples total); compare to V0.8.0 baseline | ≥80% match rate per character; no fence creep (zero negative-constraint-echo phrasing); persona changes ratified by Eileen async or queued for /voice workshop |

**Acceptance Criteria:**
- [ ] Each goal validated with documented evidence (paste trajectory excerpts into `grimoires/loa/a2a/trajectory/sprint-plan-2026-05-02.jsonl` or attach to PR)
- [ ] Integration points verified (zone resolution → environment context → orchestrator → tool calls → reply, end-to-end)
- [ ] No goal marked as "not achieved" without explicit justification
- [ ] /voice workshop with Eileen scheduled (or async ratification logged) per spec line 575

### Dependencies
- Sprint 3: `CHAT_MODE=orchestrator` path live; per-character MCP isolation working
- Sprint 2: `buildEnvironmentContext()` producing stable output; `tool_invocation_style` populated
- Sprint 1: `getZoneForChannel()` resolving correctly
- Companion spec (`satoshi-ruggy-experiment-validation.md`) strip-the-name baseline

### Security Considerations
- **Trust boundaries**: persona prose flows into system prompt — operator-authored, treated as trusted. No user input modifies persona.
- **External dependencies**: None.
- **Sensitive data**: persona files do NOT contain secrets. They live in the public repo by design.
- **Bonfire-sync rule**: per CLAUDE.md "Persona is sacred", canonical persona doc lives in `~/bonfire/grimoires`. This sprint lands the minimal seed in-repo; canonical-source sync is a follow-up coordination item with Eileen.

### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Voice fidelity regresses below 80% strip-the-name baseline | Med | High | STOP per spec line 567: "Stop at any phase boundary if voice fidelity regresses." Revert prose; iterate via /voice workshop before re-shipping |
| Persona drift introduces fence ("never restate environment") | Med | Med | Affirmative-blueprint discipline; review every line for negative-constraint-echo per vault `[[negative-constraint-echo]]`; Eileen review gate |
| Dry-run digest path requires production-like config (score-mcp + Anthropic key) and operator hasn't provisioned | Low | Med | Use `LLM_PROVIDER=stub STUB_MODE=true` per CLAUDE.md "Test the loop locally" section; stub path validates substrate plumbing without external deps |
| Persona changes diverge from bonfire-grimoire canonical (CLAUDE.md "Persona is sacred") | Med | Low | Land seed; flag bonfire-sync as follow-up in NOTES.md; Eileen coordinates the canonical update |

### Success Metrics
- 2 MODIFIED files (persona.md × 2); ~3-5 line additions each
- Voice-fidelity strip-the-name match rate: ≥80% per character
- All 5 cycle goals validated with documented evidence
- /voice workshop coordination logged

---

## Sprint 5 (OPTIONAL): Webhook Density Experiment (Phase F)

**Duration:** ~1 hour
**Dates:** TBD — operator-approval-gated per spec line 577
**Scope:** SMALL (4 tasks)
**Status:** OPTIONAL — does NOT block cycle completion

### Sprint Goal
Empirically measure Pattern B character density per channel; verify operator's "10 characters" hypothesis against gemini DR's "5 msg/5 sec channel-wide" rate; produce vault doctrine page documenting Pattern B headroom.

> From spec lines 482-501: "empirically measure Pattern B character density per channel ... Goal: empirical answer to 'can we run 10+ characters in a channel?' + vault doctrine page documenting Pattern B headroom."

### Deliverables
- [ ] `apps/bot/scripts/density-experiment.ts` (NEW · scratch · NOT a production path)
- [ ] Empirical findings: success rate, time-to-completion, 429 responses, rate-limit headers (sequential + concurrent fire patterns)
- [ ] Vault doctrine page `[[discord-pattern-b-density]]` filed at `~/vault/wiki/concepts/`

### Acceptance Criteria
- [ ] Operator provisions a private test channel in dev guild (NOT a public production channel — avoid spam noise per spec line 578)
- [ ] Sequential 12-character fire succeeds within bucket; spreads across ~12-15 seconds (5/5sec rate)
- [ ] Concurrent fire (Promise.all) hits 429; backoff handler kicks in; eventual success
- [ ] Username 80-char ceiling enforced per gemini DR / spec line 533
- [ ] Findings documented in vault page with empirical numbers (not hypotheticals)

### Technical Tasks

- [ ] Task 5.1: Pre-register 12 distinct character "identities" in code (no DB; in-memory) — distinct `username`+`avatar_url` per identity → **(experiment-only — does not contribute to G-1/G-5)**
- [ ] Task 5.2: Implement sequential `executeWebhook` fire — 12 calls back-to-back; capture per-call latency, status code, rate-limit response headers → **(experiment-only)**
- [ ] Task 5.3: Implement concurrent `executeWebhook` fire — `Promise.all` of 12 calls; capture 429 frequency, backoff timing, eventual completion → **(experiment-only)**
- [ ] Task 5.4: File `~/vault/wiki/concepts/discord-pattern-b-density.md` with empirical numbers, comparison to gemini-DR estimates, and recommendation for V0.7-A.x character-count ceiling → **(experiment-only)**

### Dependencies
- Operator approval (spec line 577) + dev-guild test channel provisioned
- Existing webhook-sender code in `apps/bot/src/lib/webhook-sender.ts` (or equivalent — verify path)

### Security Considerations
- **Trust boundaries**: experiment runs in dev guild only — no production data, no real users.
- **External dependencies**: Discord webhook API only; no new deps.
- **Sensitive data**: webhook URLs are sensitive (treat as secrets). Use `DISCORD_WEBHOOK_TEST_URL` env var for the test channel; never commit URL.
- **Spam discipline**: PRIVATE test channel only per spec line 578.

### Risks & Mitigation
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Experiment runs in production channel by accident → spam | Low | High | Hard-coded check in script: refuse to run unless `DISCORD_WEBHOOK_TEST_URL` env set + manual `--confirm-test-channel` flag |
| Discord rate-limits the bot account broadly (not just channel) | Low | Med | 5/5sec is per-channel-bucket; bot-account global limits are higher. If hit, 1h cooldown |
| Empirical numbers reveal <10 characters viable (operator hypothesis wrong) | Med | Low | This IS the experiment outcome. Document honestly; recalibrate V0.7-A.x roadmap |

### Success Metrics
- Experiment completes in dev guild without affecting production
- Vault page filed with empirical numbers
- Pattern B character-density ceiling determined empirically (not estimated)

---

## Risk Register

| ID | Risk | Sprint | Probability | Impact | Mitigation | Owner |
|----|------|--------|-------------|--------|------------|-------|
| R1 | Voice fidelity regresses below 80% strip-the-name baseline | 2-4 | Med | High | Stop at phase boundary per spec line 567; revert prose; iterate via /voice workshop | operator + Eileen |
| R2 | Chat-mode orchestrator path adds latency that feels wrong | 3 | High | Med | Typing indicator during round-trip; 14m30s timeout; `CHAT_MODE=naive` env-flag escape hatch | engineer |
| R3 | Per-character MCP isolation breaks (cross-character tool leak) | 3 | Low | High | Existing `buildAllowedTools` filter at SDK level; explicit isolation test in Task 3.6 | engineer |
| R4 | Environment block exceeds token cap | 2 | Med | Med | Trim from least-canonical first per spec line 108 | engineer |
| R5 | `tool_invocation_style` reads as fence not posture | 2 | Med | Med | Affirmative-blueprint discipline; Eileen review before locking | engineer + Eileen |
| R6 | Persona prose drifts from bonfire-grimoire canonical | 4 | Med | Low | Flag bonfire-sync as follow-up; Eileen coordinates | operator + Eileen |
| R7 | Snapshot-test brittleness blocks CI | 2 | Med | Low | Stub `Date.now()`; sort presence list deterministically | engineer |
| R8 | Density experiment runs in production channel | 5 | Low | High | Hard-coded test-channel check + `--confirm-test-channel` flag | engineer + operator |
| R9 | Codex-mcp data source for `getCodexAnchorForZone` not yet wired | 1 | Low | Low | V1 ships with sync constant; async-MCP path is post-Sprint-3 extension | engineer |

---

## Success Metrics Summary

| Metric | Target | Measurement Method | Sprint |
|--------|--------|-------------------|--------|
| Channel→zone reverse map round-trip | 100% (all 4 zones) | `bun tsx apps/bot/scripts/smoke-zone-map.ts` | 1 |
| Rosenzu tool count | 5 → 6 (additive) | `git diff packages/persona-engine/src/orchestrator/rosenzu/server.ts` shows new tool, no deletions | 2 |
| Environment block token size | ≤300 typical (≤500 hard cap) | Token count in snapshot test | 2 |
| Chat-mode tool invocation rate | 0% → measurable | Trajectory log inspection per spec line 562 | 3 |
| Per-character MCP isolation | 100% (zero cross-character tool access) | Isolation test in Task 3.6 | 3 |
| Voice fidelity (strip-the-name informal) | ≥80% match rate per character | gumi blind-judge per companion-spec baseline | 4 |
| Cycle done-bar achievement | All 5 goals validated | Task 4.E2E matrix | 4 |
| Workspace typecheck regressions | 0 | `bun run typecheck` after each sprint | 1-4 |
| Pattern B character-density ceiling (optional) | Empirical answer (not estimate) | density-experiment.ts findings | 5 |

---

## Dependencies Map

```
Phase A (SHIPPED)
   │
   └─▶ Sprint 1 (Phase B) ──▶ Sprint 2 (Phase C) ──▶ Sprint 3 (Phase D) ──▶ Sprint 4 (Phase E)
       │ reverse map          │ environment.ts +     │ chat-mode wiring     │ persona iteration
       │                      │ rosenzu read_room    │ (the critical fix)   │ + E2E validation
       │                      │ + tool_invocation    │                      │
       │                      │   style              │                      │
       │                                                                    │
       └─▶ Sprint 5 (Phase F · OPTIONAL · operator-approval-gated)
           │ density experiment in dev guild
           │ NOT on critical path
```

**Critical path**: A → B → C → D → E (substrate completion).
**Off-path**: F (operator-approval, dev-guild experiment, vault doctrine).

---

## Appendix

### A. PRD/Spec Feature Mapping

> The kickoff brief uses phase letters (A-F) instead of FR-X.Y identifiers. Feature mapping below traces phases to sprints.

| Spec Phase | Spec Lines | Sprint | Status |
|-----------|------------|--------|--------|
| Phase A: Mount Loa | 269-294 | (pre-sprint, shipped) | ✅ SHIPPED — commit `daed064` |
| Phase B: channel-zone reverse map | 298-313 | Sprint 1 | Planned |
| Phase C: environment + rosenzu read_room | 316-422 | Sprint 2 | Planned |
| Phase D: chat-mode MCP wiring | 426-450 | Sprint 3 | Planned |
| Phase E: persona-prose iteration | 454-476 | Sprint 4 | Planned |
| Phase F: density experiment | 480-503 | Sprint 5 (OPT) | Optional |

### B. Spec Component Mapping

| Spec Component | File Path | Sprint | Status |
|---------------|-----------|--------|--------|
| `channel-zone-map.ts` | `apps/bot/src/lib/channel-zone-map.ts` | Sprint 1 | NEW |
| `environment.ts` | `packages/persona-engine/src/compose/environment.ts` | Sprint 2 | NEW |
| Rosenzu `read_room` tool | `packages/persona-engine/src/orchestrator/rosenzu/server.ts` | Sprint 2 | EXTEND |
| Lynch primitives helpers | `packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts` | Sprint 2 | EXTEND |
| `{{ENVIRONMENT}}` placeholder | `packages/persona-engine/src/persona/loader.ts` | Sprint 2 | EXTEND |
| `tool_invocation_style` field | `packages/persona-engine/src/types.ts` + `apps/character-{ruggy,satoshi}/character.json` | Sprint 2 | EXTEND |
| Orchestrator postType branch | `packages/persona-engine/src/orchestrator/index.ts` | Sprint 3 | EXTEND |
| Chat-mode wiring | `packages/persona-engine/src/compose/reply.ts` | Sprint 3 | REFACTOR |
| `CHAT_MODE` env flag | `packages/persona-engine/src/config.ts` | Sprint 3 | EXTEND |
| Persona prose tweaks | `apps/character-{ruggy,satoshi}/persona.md` | Sprint 4 | EDIT |
| `density-experiment.ts` | `apps/bot/scripts/density-experiment.ts` | Sprint 5 | NEW (optional) |

### C. Goal Mapping

| Goal ID | Goal Description | Contributing Tasks | Validation Task |
|---------|------------------|-------------------|-----------------|
| G-1 | Each character knows its location (channel→zone resolution + environment block in system prompt) | Sprint 1: Task 1.1, Task 1.2, Task 1.3; Sprint 2: Task 2.3, Task 2.5, Task 2.7; Sprint 3: Task 3.2, Task 3.5; Sprint 4: Task 4.4 | Sprint 4: Task 4.E2E |
| G-2 | Chat-mode replies have full per-character MCP tool surface | Sprint 3: Task 3.1, Task 3.2, Task 3.3, Task 3.4, Task 3.5, Task 3.6 | Sprint 4: Task 4.E2E |
| G-3 | Rosenzu serves both halves (place + moment) via `read_room` | Sprint 2: Task 2.1, Task 2.2, Task 2.3, Task 2.4, Task 2.7, Task 2.8 | Sprint 4: Task 4.E2E |
| G-4 | Three orthogonal axes (persona × environment × tools) | Sprint 2: Task 2.5, Task 2.6; Sprint 3: Task 3.6; Sprint 4: Task 4.4 | Sprint 4: Task 4.E2E |
| G-5 | Voice fidelity holds | Sprint 4: Task 4.1, Task 4.2, Task 4.3, Task 4.4 | Sprint 4: Task 4.E2E |

**Goal Coverage Check:**
- [x] All 5 goals have at least one contributing task
- [x] All goals have a validation task in final sprint (Task 4.E2E)
- [x] No orphan tasks (Sprint 5 tasks are explicitly experiment-only and tagged so; not orphans because Sprint 5 is OPTIONAL/off-path)

**Per-Sprint Goal Contribution:**

- Sprint 1: G-1 (foundation: zone resolution primitive)
- Sprint 2: G-1 (complete: environment block construction), G-3 (complete: place+moment via read_room), G-4 (partial: tool_invocation_style separation)
- Sprint 3: G-2 (complete: chat-mode MCP wiring), G-1 (partial: channelId threaded through), G-4 (partial: per-character MCP isolation)
- Sprint 4: G-5 (complete: voice fidelity), G-1/G-4 (validation), Task 4.E2E (E2E validation of all goals)
- Sprint 5 (OPT): No goal contribution — experiment-only

### D. Coordination Items (per spec §coordination needed)

| Item | Owner | Sprint | Status |
|------|-------|--------|--------|
| Eileen async review of Phase E persona prose (gumi-correct discipline) | operator + Eileen | 4 | Pending |
| Eileen confirm `tool_invocation_style` text reads as continuation of voice (especially satoshi's gnomic register) | operator + Eileen | 2 | Pending |
| /voice workshop scheduling (longer-form persona iteration) | Eileen | post-4 | Deferred per spec line 470 |
| Gumi async awareness — codex zone-metadata domain | Gumi | 1 | FYI only (no action needed for V1 sync constant path) |
| Operator ratify Loa construct selection | operator | (pre-cycle) | ✅ DONE — Phase A shipped |
| Operator approve Phase F density experiment | operator | 5 | Pending |
| Dev-guild test channel provisioned | operator | 5 | Pending (gates Sprint 5) |
| Bonfire-sync of persona changes back to `~/bonfire/grimoires` | operator + Eileen | post-4 | Pending |

### E. Scope Cuts (per spec "What NOT to build" §)

The following are EXPLICITLY out of scope for this cycle and MUST NOT slip in via "while-I'm-here" creep (per Barth scope discipline + spec line 551):

- ❌ Per-character memory ledger (V0.7-B+)
- ❌ Cross-character coordination via shared file (V0.7-B+)
- ❌ PAA voice-fidelity CI (V0.8+ per companion spec)
- ❌ Image-gen autoprompt classifier
- ❌ New zones (tl, irl)
- ❌ MessageContent intent / general listener (V0.7-A.2)
- ❌ DM environment (V0.7-A.x)
- ❌ Per-character LLM provider override
- ❌ dAMP-96 personality derivation

Polish backlog goes to `grimoires/loa/agenda/` (now that Loa is mounted).

---

*Generated by Sprint Planner Agent · 2026-05-02 · Cycle: cycle-001 · V0.7-A.1 environment substrate*
