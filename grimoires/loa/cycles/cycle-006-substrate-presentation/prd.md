# cycle-006 · substrate-presentation refactor · PRD

> **Cycle**: cycle-006
> **Working title**: substrate-presentation-refactor
> **Date**: 2026-05-16
> **Status**: candidate (pre-SDD · post /plan-and-analyze interview)
> **Predecessor**: cycle-005 (PR #80 merged · PR #81 open with BB REQUEST_CHANGES)
> **Branch target**: `feat/cycle-006-substrate-presentation` (cut from main once cycle-005 PR #81 resolves)
> **Depends on**: PR #81 (codex's ports/live/mock initial split · either merged or rebased into 006)

---

## Metadata

| field | value |
|---|---|
| origin | BB review of PR #81 surfaced 3 HIGH structural gaps (F-002 shape drift · F-003 two renderers · F-016 voice-memory gallery-only) + REFRAME concern (F-014 dual-architecture needs ADR) |
| operator directive 2026-05-16 | "clear routes to bypass the agent · agents who work on this repo should understand purpose and intent of each section through clear contracts/schemas/boundaries · enforced by types, not vigilance" |
| load-bearing doctrine | `chat-medium-presentation-boundary` (vault · active · 6 proof points) · `construct-honeycomb-substrate` (4-folder · suffix-as-type) · `straylight-memory-discipline` (governance over recall · CLAUDE.md OperatorOS) |
| upstream packages (consume only · do not modify) | `loa-hounfour` (TypeBox schemas) · `loa-straylight` (continuity-under-authorization) |
| closes (cycle-005 follow-up) | BB findings F-002 · F-003 · F-016 (HIGH) · F-014 (REFRAME) · F-004 silence-register parity · F-005 ZoneDigest naming |

---

## 1. Problem & Vision

### 1.1 problem statement

cycle-005 shipped a substantive refactor that introduced the `domain/ports/live/mock/orchestrator` honeycomb pattern for the digest path. BB round 2 review on PR #81 verdict: **REQUEST_CHANGES**. Three HIGH structural gaps remain:

- **F-002** Shape derivation in `claude-sdk.live.ts` diverges from the canonical `selectLayoutShape`. The voice-brief gate is a Potemkin guardrail · silencedFactors always empty.
- **F-003** Two divergent renderers for the same digest message contract (`discord-render.live.ts` + legacy `buildPulseDimensionPayload`). Drift surface.
- **F-016** Production orchestrator (`composeDigestPost`) never reads or writes voice memory. Cross-week continuity is gallery-only. Demo green, prod gray.

Plus a REFRAME concern (F-014): the transitional dual-architecture (digest = orchestrator · non-digest = legacy imperative) needs an ADR or the boundary will be re-litigated.

> Source: BB review PR #81 round 2 · 2026-05-16T07:03Z · `https://github.com/0xHoneyJar/freeside-characters/pull/81`

### 1.2 vision

After cycle-006, the substrate-presentation seam is **structurally impossible to violate**:

- Every post type (digest · pop-in · weaver · micro · lore_drop · question · callout · chat-mode-reply) flows through the orchestrator/ports/live/mock pattern. The legacy imperative path in `composer.ts` is deleted.
- A `DeterministicEmbed` type with no `description` field makes voice-in-truth-zone a compile error.
- Voice-gen and presentation are isolated ports; an agent given task "modify the voice prompt" can touch `claude-sdk.live.ts` + `voice-brief.ts` ONLY and verifiably cannot affect the Discord payload data.
- Voice memory per-post-type streams (hounfour/straylight-aligned local schema) provide cross-week continuity in production, not just in galleries.

> Operator quote 2026-05-16: "an agent given task `modify the voice prompt` can ONLY touch `claude-sdk.live.ts` + `voice-brief.ts` and verifiably cannot affect Discord payload data · enforced by types, not vigilance."

### 1.3 why now

- BB ROUND 2 verdict is REQUEST_CHANGES; PR #81 cannot merge as-is.
- The transitional dual-architecture creates the same drift surface the refactor was meant to close. Re-litigating the boundary in every future cycle is worse than completing the migration.
- Voice-memory was a cycle-005 deliverable that ships gallery-only. The cross-week-continuity feature exists in tests + manual demos but NOT in the production digest path. "Demo green, prod gray."
- Operator's substrate-vs-presentation doctrine is load-bearing and was operator-witnessed; the longer the substrate-presentation seam stays porous, the more cycles will need to repeat the lesson.

---

## 2. Goals & Success Metrics

### 2.1 goals

- **G-1** Close all 3 BB HIGH findings on PR #81 (F-002 shape unification · F-003 single renderer · F-016 production voice-memory wiring).
- **G-2** Codify the voice-outside-divs contract at the type level (DeterministicEmbed has no `description` · DigestMessage carries `voiceContent` + `truthEmbed` split).
- **G-3** Migrate ALL post types to the orchestrator/ports/live/mock pattern. Delete the legacy imperative path in `composer.ts`.
- **G-4** Voice memory becomes a memory-governance primitive · per-post-type streams · hounfour/straylight-aligned local TypeBox schema.
- **G-5** Ship the daily-pulse renderer (`get_recent_events` activity feed · wallet+description pairs · 2-line per event).
- **G-6** Verify the seam with belt-and-suspenders (compile-time type enforcement + runtime mock-driven contract tests).

### 2.2 success metrics

| metric | target | verification |
|---|---|---|
| BB review verdict on cycle-006 PR | APPROVED (or PRAISE-only findings) | `/bridgebuilder-review` posts the review |
| F-002 (shape drift) | closed | runtime test: voice-brief shape derived from same util as `selectLayoutShape` |
| F-003 (two renderers) | closed | `buildPulseDimensionPayload` deleted · `git grep -n buildPulseDimensionPayload` returns zero hits |
| F-016 (voice-memory gallery-only) | closed | production digest cron writes to `.run/voice-memory/digest.jsonl` · verifiable post-cron |
| voice-outside-divs type enforcement | compile-fail when violated | `DeterministicEmbed` has no `description` field · `@ts-expect-error` test pins this |
| migration completeness | 100% of post types use orchestrator | `git grep -n "buildPostPayload\|composeReplyWithEnrichment.*=>"` in compose/ returns zero non-deprecated references |
| test suite | 0 regressions · +N new tests | full suite passes · BB round 3 shows no new HIGH/MEDIUM findings |
| LoC budget | ~2000 LoC churn (~+1800 new · ~-200 deleted) | `git diff --stat HEAD~N..HEAD` |

### 2.3 timeline

- S0 calibration spike (½ day · half day buffer for the substrate audit)
- S1-S2 substrate-presentation seam · type-level enforcement
- S3-S4 per-post-type orchestrator migration (digest already done · 6 others)
- S5 chat-mode-reply migration (largest sub-scope)
- S6 per-type voice memory streams · hounfour/straylight-aligned schema
- S7 daily-pulse renderer + orchestrator
- S8 OTEL wire + canary + cycle close

Estimate: 8 sprints · ~10-14 working days.

---

## 3. User & Stakeholder Context

### 3.1 primary stakeholders

- **Operator (soju)** · holds the substrate-presentation doctrine · authored the voice-outside-divs clarification 2026-05-16 · approves cycle gates.
- **Future agents working in the repo** · explicit doctrine target. The win condition is that a future agent reading the file tree understands the substrate-vs-presentation seam in <60 seconds without operator vigilance. From operator's prior framing: "agents who work on this repo to understand purpose and intent of each section through clear contracts/schemas and boundaries."
- **Discord users in THJ guild** · downstream consumers of ruggy's posts (cron-fired) and slash-command replies (interaction-triggered).

### 3.2 secondary stakeholders

- **Codex** · executes the implementation per the handoff prompt. Has already shipped PR #81's initial split.
- **Bridgebuilder** · multi-model reviewer that gates merge. Round 2 was REQUEST_CHANGES; round 3 (after cycle-006) is the merge gate.
- **score-mibera substrate team** · consumed by this cycle but not modified. `get_dimension_breakdown` + `get_most_active_wallets` + `get_recent_events` are stable.

### 3.3 stakeholders deliberately NOT in scope

- **Purupuru caretakers** · cycle-004 world-grounding work. Separate guild. Separate persona set.
- **score-mibera substrate** · consumer-side only. Any gap (e.g. weekly_active count in `get_dimension_breakdown` · already filed at score-mibera#122) is upstream.

---

## 4. Functional Requirements

### FR-1 · type-level substrate-presentation seam (G-1, G-2, G-6)

The cycle introduces two load-bearing types in `packages/persona-engine/src/domain/`:

```typescript
// domain/discord-message.ts (or wherever the boundary lives)
export interface DeterministicEmbed {
  readonly color: number;
  readonly fields: ReadonlyArray<{ name: string; value: string; inline?: boolean }>;
  readonly footer?: { text: string };
  // NOTE: `description` is INTENTIONALLY absent.
  // The truth-zone embed cannot carry voice text.
  // Future cycles may introduce an explicit `AugmentedEmbed` type with
  // operator sign-off; do not relax this one.
}

export interface DigestMessage {
  /** Voice surface. Agent-generated text lives ONLY here. */
  readonly voiceContent: string;
  /** Substrate surface. Pure data, zero LLM influence. */
  readonly truthEmbed: DeterministicEmbed;
}
```

`renderDigest(snapshot, augment?)` returns `DigestMessage`. The runtime delivery layer maps `DigestMessage → Discord webhook payload` where `voiceContent → message.content` and `truthEmbed → message.embeds[0]`.

A `@ts-expect-error` test asserts that adding `description` to `DeterministicEmbed` is a compile-time error.

A runtime contract test asserts: pass `createClaudeSdkMock` with `voice.calls.length === 0` after composing a digest with mock voice-gen → the rendered payload contains all snapshot data + zero voice text.

### FR-2 · unified shape derivation (closes BB F-002)

A single utility — `domain/derive-shape.ts` (or co-located with `selectLayoutShape`) — produces `(shape, permittedFactors, silencedFactors)` from a `DigestSnapshot` + cross-zone context. Both the orchestrator (for layout dispatch) and `claude-sdk.live.ts` (for voice-brief) read from the same return value. No parallel implementations.

The util gates factors as permitted iff:
- `factor.factorStats?.magnitude?.current_percentile_rank >= 90` AND
- `factor.factorStats?.magnitude?.percentiles?.p95?.reliable === true`

silencedFactors include any factor whose name matches a prose-gate regex pattern in `inspectProse` but failed the mechanical check (e.g. matched "cohort" but `unique_actors > 1`). The orchestrator computes silencedFactors using the existing `inspectProse` output BEFORE voice-gen, then passes them into the voice-brief alongside permittedFactors.

A runtime test pairs the derive-shape util against `selectLayoutShape` on a property-test suite: 100+ generated snapshots must agree on shape classification.

### FR-3 · single renderer (closes BB F-003)

`packages/persona-engine/src/live/discord-render.live.ts` is the canonical renderer. `buildPulseDimensionPayload` in `deliver/embed.ts` is **deleted entirely** — no deprecation shim. All callers go through the orchestrator path which calls `presentation.renderDigest`.

The renderer:
- Snapshot field: code-block table · monospace label-on-left / value-on-right
- Top factors field: code-block table · `factor / events / wallets / delta / rank` columns
- Cold factors field: flat ` · ` joined tag-line
- No per-row mood emoji (sacrificed for monospace alignment · operator-locked 2026-05-16)
- Voice → `voiceContent` (becomes `message.content`); embed has NO `description`

A `git grep` test asserts `buildPulseDimensionPayload` appears in zero source files outside the cycle-006 deletion commit history.

### FR-4 · production voice-memory wiring (closes BB F-016)

`composeDigestPost` (orchestrator) reads prior-week voice-memory before voice-gen and writes this-week voice-memory after voice-gen. Same for `composeChatReplyPost` (chat-mode orchestrator) reading per-conversation prior context. Same for every other post type's orchestrator.

The memory port `VoiceMemoryPort` provides:
- `readPriorEntry(stream: string, key: string): Promise<VoiceMemoryEntry | null>`
- `appendEntry(stream: string, entry: VoiceMemoryEntry): Promise<void>`

Default live adapter: `voice-memory.live.ts` writes JSONL to `.run/voice-memory/{stream}.jsonl`. The port boundary allows future swap to a straylight-runtime adapter without changing orchestrator code.

A canary test runs the digest orchestrator twice with seeded prior-week memory and asserts:
- The second run's voice-brief input contains a `priorWeekHint` derived from the first run's voice
- The second run writes a new entry to memory
- Both runs are independently testable with `createVoiceMemoryMock`

### FR-5 · per-post-type voice memory streams (G-4)

8 streams maintained as separate JSONL files under `.run/voice-memory/`:

| stream | post type | cadence | continuity window |
|---|---|---|---|
| `digest` | weekly cron | weekly | last 4 entries per zone |
| `chat-reply` | slash-command | per-message | last 5 entries per channel |
| `pop-in` | random cron | per-fire | last 3 entries per zone |
| `weaver` | weekly cron | weekly | last 4 entries (cross-zone) |
| `micro` | manual / scripted | sparse | last 3 entries per zone |
| `lore_drop` | manual / scripted | sparse | last 3 entries per zone |
| `question` | manual / scripted | sparse | last 3 entries per zone |
| `callout` | event-driven | event-driven | last 3 entries per zone |

Each `VoiceMemoryEntry` carries:
- `at` (ISO timestamp)
- `iso_week` (when applicable)
- `stream` (post type · matches filename)
- `zone` (when applicable)
- `header` + `outro` (the rendered voice surface)
- `key_numbers` (substrate values the voice referenced · for cross-week diff)
- `use_label` (Straylight-aligned · `usable | background_only | mark_as_contested | do_not_use_for_action`)
- `expiry` (ISO date · when this entry no longer feeds continuity)
- `signed_by` (operator/agent identity if available · defaults to `agent:claude`)

The schema lives as a local TypeBox definition in `domain/voice-memory-entry.ts`. It does NOT get upstreamed to hounfour (per operator + ES governance directive 2026-05-15). Local schema patterns mirror hounfour conventions so future migration is mechanical.

### FR-6 · migrate ALL post types (G-3)

Every post type currently routed through `composer.ts` gets its own orchestrator:
- `digest-orchestrator.ts` (exists · gets F-016 voice-memory wire)
- `chat-reply-orchestrator.ts` (NEW · replaces `composeReplyWithEnrichment` core)
- `pop-in-orchestrator.ts` (NEW)
- `weaver-orchestrator.ts` (NEW)
- `micro-orchestrator.ts` (NEW · or batch-handled via post-type-config)
- `lore-drop-orchestrator.ts` (NEW · or batch-handled)
- `question-orchestrator.ts` (NEW · or batch-handled)
- `callout-orchestrator.ts` (NEW · or batch-handled)

`composer.ts::composeZonePost` becomes a thin router: switch on postType → dispatch to the corresponding orchestrator. No business logic remains in `composer.ts`.

Per-orchestrator behavior preserves the legacy transforms:
- `chat-reply-orchestrator` MUST preserve the V1 routing invariant (prose-gate runs digest-only · the gate port is wired but the chat-reply orchestrator passes the no-op gate adapter). Per cycle-005 SDD §5.
- All transforms currently in `composeReplyWithEnrichment` (translateEmojiShortcodes · stripVoiceDisciplineDrift · grail-ref-guard) move to dedicated ports with mock-able test surfaces.

### FR-7 · daily-pulse renderer (G-5)

`presentation.renderActivityPulse(pulse: ActivityPulse): ActivityPulseMessage` renders the `get_recent_events` feed as wallet+description pairs:

```
0xe6a2…4bc8
Received Mibera #8768

0x58ef…8d4e
Transferred Mibera #8768
```

~10 events per post. Flat chronological (newest first). Wallet display: `0xXXXX…YYYY` (first 4 + ellipsis + last 4 of hex address). Description: pre-rendered server-side from `RecentEvent.description`.

The `pulse-orchestrator.ts` is callable from cron. Cron wire-up is operator-attested (same pattern as cycle-005's digest cron wire · deferred to operator commit).

---

## 5. Technical & Non-Functional

### NFR-1 · type-system enforcement (compile-time)

- `DeterministicEmbed` has no `description` field. Adding one is a compile error.
- `live/discord-render.live.ts` does not import `live/claude-sdk.live.ts` or anything from `compose/agent-gateway.ts`.
- A CI script (`scripts/audit-substrate-presentation-seam.sh`) greps for cross-boundary imports and fails the build on violation.

### NFR-2 · runtime-test enforcement (mock-driven)

- Mock-driven contract test: `createClaudeSdkMock` with `voice.calls.length === 0` after composing → payload still has full snapshot data.
- Property-test pair: `derive-shape util` and `selectLayoutShape` agree on 100+ generated snapshots.
- Voice-memory roundtrip test: append then read returns identical entry · multi-stream multi-key isolation verified.

### NFR-3 · schema conformance (hounfour-aligned, straylight-aligned, local)

- Voice memory entry schema authored as TypeBox in `domain/voice-memory-entry.ts`.
- Schema patterns mirror hounfour conventions (single source of validators · runtime check on read + write).
- Governance fields (use_label · expiry · signed_by) mirror straylight semantics.
- NO upstream PR to hounfour (per operator + ES governance directive 2026-05-15).

### NFR-4 · voice memory storage growth

- Per-stream JSONL append-only.
- Bounded by retention window per stream (e.g. last 4 weeks for `digest`, last 5 messages per channel for `chat-reply`).
- Pruning is a periodic cron job (NOT in cycle-006 scope · deferred · cycle-007+).
- Storage volume estimate: ~5 KB / week / stream · 8 streams · ~210 KB / year. Negligible.

### NFR-5 · observability continuity

- All orchestrators emit OTEL `chat.invoke` span tree (preserves cycle-005 S5 wire).
- Span attribute `voice.shape` and `voice.permitted_count` (added in my F-006 fix · keep).
- Voice-memory operations emit `voice_memory.read` and `voice_memory.write` events on the active span.
- `voice.invoke` span is NOT emitted when `VOICE_DISABLED=true` (verified by mock-driven test).

### NFR-6 · backwards compatibility

- `buildPulseDimensionPayload` deleted entirely · no shim · no @deprecated wrapper.
- External callers (if any · unlikely) are responsible for migrating to `composeDigestPost`.
- Public exports in `packages/persona-engine/src/index.ts` audited · deletions documented in CHANGELOG.

### NFR-7 · sanitize regex backstop

- `sanitize.ts::stripVoiceDisciplineDrift` continues to be the regex backstop at the LLM→content wall.
- Voice prompt remains positive-guidance-only (no negation rules per operator doctrine 2026-05-16 "mentioning artifacts in the prompt teaches the LLM they're in scope").

---

## 6. Scope & Prioritization

### in scope (MVP)

| feature | LoC est | sprint |
|---|---:|---|
| Type-level substrate-presentation seam (DeterministicEmbed · DigestMessage) | 150 | S1 |
| Unified `derive-shape` util · F-002 closure | 100 | S1 |
| Delete `buildPulseDimensionPayload` · consolidate to `discord-render.live` | -200 net | S2 |
| Migrate all post types to orchestrators (6 new orchestrators) | 800 | S3-S4 |
| chat-mode-reply orchestrator migration · preserve V1 routing invariant | 400 | S5 |
| Per-post-type voice memory streams + TypeBox schema | 200 | S6 |
| Production voice-memory wiring in digest + chat-reply orchestrators · F-016 closure | 150 | S6 |
| Daily-pulse renderer + pulse-orchestrator | 200 | S7 |
| Compile-time enforcement script + tests | 100 | S2 |
| Mock-driven runtime contract tests | 200 | S2 + per-orchestrator |
| OTEL span wiring + canary + cycle close | 100 | S8 |

**Total estimate**: ~2000 LoC net churn (~+2200 new · ~-200 deleted)

### out of scope

- Stonehenge zone composition (uses `get_community_counts` + `get_most_active_wallets` · separate orchestrator shape · cycle-007+)
- Backwards-compat shim for `buildPulseDimensionPayload` (delete cleanly · operator-directed)
- Upstream schemas to hounfour (consume only · per ES/operator governance directive)
- score-mcp wire format changes (score-mibera#122 filed for `weekly_active` count gap · upstream concern)
- Reaction-bar polish (still failing silently per cycle-005 · separate fix · cycle-007+)
- Voice-memory pruning cron (storage bounded informally · cycle-007+ if needed)
- Cron-firing cadence definition (renderer + orchestrator ship · cron wire is operator-attested live-behavior change)
- Purupuru caretaker world (separate cycle · separate guild · cycle-004 territory)
- AC-S5.2 chat-mode OTEL spans (V1.5 destination per cycle-005 PRD §Accepted V1 Limitations A2 · cycle-007+)

### accepted V1 limitations (cycle-006 ships with these · documented)

- A1 · per-type voice memory has NO cross-type continuity (e.g. ruggy doesn't reference last week's chat-reply in this week's digest). Future cycles may add cross-stream synthesis.
- A2 · TypeBox schema is LOCAL only. If loa-hounfour later adds a `voiceMemory` namespace, persona-engine migrates in a separate cycle.
- A3 · voice-memory entries are operator-readable but NOT cryptographically signed. `signed_by` field is informational (e.g. `agent:claude`) · straylight-runtime adapter would add signing.
- A4 · pruning is manual (operator runs `tail -n 100 file > file.tmp && mv file.tmp file` if needed). Automated pruning is cycle-007+.
- A5 · stonehenge zone is NOT covered. Cron path for stonehenge continues to use legacy `composer.ts::composeZonePost` until cycle-007+ migrates it. Acceptable: the legacy path is preserved during transition since `composer.ts` becomes a router (FR-6).

---

## 7. Risks & Dependencies

### technical risks

- **Risk · chat-mode migration is the largest sub-scope** (~400 LoC · multiple ports · preserves V1 routing invariant). Production slash-command path is high-traffic surface; regression risk is real.
  - **Mitigation**: dedicated sprint (S5) · port-by-port migration · existing chat-mode tests must pass before merge · staging dev guild canary before production.

- **Risk · transitional dual-architecture during sprints S3-S5** (some post types on new orchestrator · some still legacy). composeZonePost router needs careful coexistence semantics.
  - **Mitigation**: composer.ts becomes a router that dispatches based on a `MIGRATED_POST_TYPES` set. Each completed orchestrator is added to the set. CI verifies all post types in `POST_TYPE_SPECS` are eventually in the set by cycle close.

- **Risk · voice-memory schema drift** between local TypeBox and future hounfour publication. If hounfour ships a `voiceMemory` namespace later with different shape, persona-engine must migrate.
  - **Mitigation**: track hounfour repo for `voiceMemory` namespace · file an issue when seen · cycle-007+ migrates if/when published.

- **Risk · property-test pair (derive-shape vs selectLayoutShape) discovers semantic drift** during S1.
  - **Mitigation**: this is the GOAL of the property test. Drift discovered in S1 is documented + closed before S2 starts. If drift is irreconcilable, surface to operator.

- **Risk · per-type voice memory file growth** unbounded without pruning.
  - **Mitigation**: NFR-4 caps retention informally (last N entries per stream). Pruning cron deferred to cycle-007+. Storage estimate < 1MB/year per stream · negligible.

### business / operational risks

- **Risk · cycle-006 scope is large (~2000 LoC · 8 sprints · ~14 days)**.
  - **Mitigation**: assumption 1 in the PRD asks operator to split into 006-a + 006-b if too large. Default: ship as one cycle with sprint-level checkpoints.

- **Risk · operator-attested live-behavior changes accumulate** (cron-wire for daily-pulse · cron-wire for migrated post types · ledger flip).
  - **Mitigation**: cycle-006 produces a single "operator handoff" document listing every live-behavior commit operator must execute post-merge. Mirrors cycle-005's pattern.

### external dependencies

- **PR #81 disposition** · either merged into main (cycle-006 cuts from updated main) or rebased into cycle-006's branch. Pre-S0 task.
- **score-mibera substrate** · stable · no changes.
- **loa-hounfour** · stable · cycle-006 consumes patterns, does not upstream. Track for `voiceMemory` namespace.
- **loa-straylight** · governance doctrine reference · cycle-006 mirrors patterns locally.
- **THJ guild Discord** · production canary surface · operator-attested visual sign-off required.

---

## 8. Appendix

### A · refs

- BB review PR #81 round 2: https://github.com/0xHoneyJar/freeside-characters/pull/81 (verdict REQUEST_CHANGES · 16 findings)
- Operator quotes 2026-05-16 (this session):
  - "divs are truth areas straight from the substrate · ruggy SHOULD NOT talk inside of the UI div"
  - "clear routes as well to bypass the agent which serves no purpose if the substrate can be formatted through code and presented to the discord medium"
  - "agents who work on this repo to understand purpose and intent of each section through clear contracts/schemas and boundaries"
  - "We consume hounfour/straylight not upstream anything" (re: governance · ES exchange 2026-05-15)
- Doctrine:
  - `~/vault/wiki/concepts/chat-medium-presentation-boundary.md` (active · load-bearing)
  - https://github.com/0xHoneyJar/construct-honeycomb-substrate
  - CLAUDE.md OperatorOS Straylight memory discipline
- cycle-005 artifacts:
  - `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/{prd,sdd,sprint}.md`
  - PR #80 merged (8ffa337)
  - PR #81 open (codex's substrate-presentation split)
- score-mibera#122 (weekly_active count gap · filed 2026-05-16)

### B · ledger registration

This cycle registers as `cycle-006-substrate-presentation` in `grimoires/loa/ledger.json`. Reserves sprint IDs 12-19 (8 sprints S0-S7) · `next_sprint_number` advances to 20 on registration.

### C · interview log

7-phase /plan-and-analyze discovery completed 2026-05-16. 4 sequential directional questions asked:

| Q | answer | drives |
|---|---|---|
| Q1 Migration scope | Migrate ALL post types | FR-6 · NFR-6 · risk transitional dual-architecture |
| Q2 Voice-memory scope | Per-post-type streams · design around hounfour/straylight | FR-4 · FR-5 · NFR-3 |
| Q3 Schema home | Local TypeBox in persona-engine · consume hounfour/straylight only | NFR-3 · accepted A2 |
| Q4 Win verification | Belt-and-suspenders (compile + runtime) | NFR-1 · NFR-2 |
| Q5 MVP scope | + daily-pulse · + chat-mode migration · - stonehenge · - shim | scope/out-of-scope tables |

Phases 1 (problem) · 3 (users) · 7 (risks) covered from session-grounded context (BB review · operator quotes · doctrine refs). No phase reopened during interview.

### D · assumptions (operator-accepted pre-generation gate)

- **A-1** cycle-006 ships as ONE cycle (~2000 LoC · 8 sprints). Split deferred unless sprint plan surfaces real overrun.
- **A-2** chat-mode migration preserves V1 routing invariant (prose-gate stays digest-only).
- **A-3** voice-memory uses 8 separate JSONL files (NOT one mega-file with type column).
- **A-4** reaction-bar polish stays out of scope.
- **A-5** daily-pulse cron cadence is NOT defined in this cycle (renderer + orchestrator ship · cron wire is operator-attested).
