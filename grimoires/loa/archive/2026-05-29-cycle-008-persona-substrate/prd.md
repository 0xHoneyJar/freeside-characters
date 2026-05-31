# cycle-008 · persona-as-substrate · PRD

> **Cycle**: cycle-008-persona-substrate
> **Working title**: persona-as-substrate
> **Date**: 2026-05-18 (drafted), 2026-05-17 (session work)
> **Status**: active · /simstim Phase 1 (Discovery) output · ready for Phase 2 Flatline PRD review
> **Branch target**: `feat/cycle-008-persona-substrate` (cut from `origin/main` post cycle-007 candidate)
> **Owner**: operator (zksoju) drives authoring · Loa drives execution
> **Mode**: ARCH (Ostrom) + craft lens (Alexander) · constructs the-arcade (BARTH scope) + artisan (ALEXANDER craft)
> **Depends on**: cycle-007-agent-debuggability (candidate · structural mechanical close 2026-05-17 · pair-points absorbed here)
> **Pre-simstim session artifacts**:
> - `grimoires/loa/cycles/cycle-008-persona-substrate/spike-builder-diff.md` (S0 spike output · authored 2026-05-17 · with 4 reframe rounds applied)
> - `apps/character-ruggy/persona.md` placeholder insertion (S1 mechanical work landed 2026-05-17 · 5 lines added · `═══ SUBSTRATE STATE ═══` section between ENVIRONMENT and VOICE ANCHORS)

---

## 0 · Vision

ruggy's voice substrate transitions from auto-generated engineering prose (`buildVoiceBrief`) to canonical authored substrate (`buildPrompt` consuming `persona.md`). The cron path joins the chat-mode path on the single canonical builder. Governance (substrate mechanics) and voice (character expression) settle onto parallel architectural layers that don't mix. Per-layer observability via fragment_sources[] makes the determinism boundary inspectable. Operator iterates voice quality via a kitchen-local /tweak Tweakpane tab without persona-engine restart cycles.

The doctrinal frame, established mid-session via three vault-grounded principles:
- **Stats-out-of-voice** — ruggy never cites aggregate-window stats (windowDays / prior period / rank thresholds / per-factor magnitudes). Stats live in the deterministic digest card body. Voice is observational/semantic.
- **Governance-vs-voice separation** — substrate mechanics and character expression live on parallel layers. Substrate-state blocks in prompts use neutral mechanical vocabulary, not voice flavor. Mixing causes layer-collapse where the LLM loses grip on both.
- **Author authors, engineering assembles, LLM consumes** — the boundary IS the prompt. Make it observable, tweakable, load-bearing on authored files.

---

## 1 · Problem statement

Cycle-007 closed kebab-zone-leak (Bug A · INV-12) and shipped agent-debuggability (5 trace CLI subcommands · trace dashboard · INV-13/14/17/18 invariants). Operator live-testing post cycle-007 surfaced a deeper structural regression: cron-digest voice still parrots engineering-prose artifacts (middots · em-dashes · spelled-out aggregates · kebab handles).

Triage revealed **two parallel prompt-building paths**:

| Path | File | Source | Used by |
|---|---|---|---|
| **Canonical** (V0.7-A.2 unified) | `packages/persona-engine/src/persona/loader.ts:237` `buildPrompt` | Gumi/operator-authored `persona.md` template + voice-anchors.md + codex-anchors.md + silence-register.md + exemplars/ | chat-mode (`compose/reply.ts:206`) only |
| **Legacy auto-generated** | `packages/persona-engine/src/compose/voice-brief.ts:86` `buildVoiceBrief` | Engineering prose with middots + em-dashes + aggregate-stat citation + inline ZONE_VOICE_CONTEXT flavor | ALL cron orchestrators (digest · micro · weaver · lore_drop · question · callout) |

The cron path is the one producing community-visible voice. It runs the wrong builder. Operator's authored files are invisible to it.

### 1.1 · Evidence from the PP-4 attestation trace (2026-05-17 20:35 · el-dorado digest)

Real production trace pasted in this session demonstrates the artifact class:

```
header: "el-dorado is napping — 575 events drifting through,
         none loud enough to wake the rank-ninety floor."
outro:  "the gold's still in the ground; we'll be here
         when something stirs."
```

Four artifacts in the header alone:
1. **Kebab leak** · `el-dorado` instead of `El Dorado` (persona.md:1421 explicitly forbids; cycle-007 closed in another path · cron-digest still bleeds via voice-brief.ts)
2. **Em-dash in voice** · `napping — 575 events` — mirroring of em-dash present in voice-brief.ts:106 system prompt (`one number max — the data list renders separately`)
3. **Spelled-out aggregate** · `rank-ninety floor` (cycle-007 invariant violation: numbers as digits)
4. **Aggregate-stat citation** · `575 events drifting through` (the stats-out-of-voice principle violation: ruggy is citing the substrate's window aggregate as if narrating)

The outro is clean (no kebab, no em-dash, no aggregate). The artifacts cluster on the line where the LLM was forced to acknowledge engineering-prose stat-citation from the legacy builder's user-message prose.

### 1.2 · Hidden second voice surface

`character.json::tool_invocation_style` (4000+ chars of engineer-authored middot-heavy prose) is spliced into `{{ENVIRONMENT}}` on every cron fire. Operator hasn't authored it. Pulling into Gumi-shape `apps/character-ruggy/tool-invocation.md` is **out of cycle-008 scope** (cycle-009 candidate · requires Gumi-pass) but flagged.

### 1.3 · Hidden observability gap

The Anthropic-SDK transport (used by chat-mode reply + future cron paths) writes NO `llm-trace.jsonl` today. Operator's debug surface from cycle-007 is partially blind. Bedrock-direct path already traces via `tracer.startActiveSpan('bedrock.converse')` at agent-gateway.ts:201. Anthropic-SDK path needs equivalent at agent-gateway.ts:147 (`invokeAnthropicSdk`).

---

## 2 · Goals

| ID | Goal | Closes |
|---|---|---|
| G-1 | Cron-digest migrates from `buildVoiceBrief` to `buildPrompt` | S3 |
| G-2 | Governance-vs-voice separation enforced (stats-out-of-voice principle · neutral mechanical vocabulary in substrate-state block) | S1-S3 |
| G-3 | `buildPrompt` returns Effect<Result, BuildPromptError, never> (full loader.ts Effect-TS migration) | S2 |
| G-4 | Trace envelope v2 with `fragment_sources[]` per-layer source-map | S4 |
| G-5 | Anthropic-SDK trace capture (chat-mode + cron-via-SDK invisibility closed) | S5 |
| G-6 | /tweak Tweakpane tab in kitchen for operator iteration without restart | S6 |
| G-7 | middot-detector in sanitize-violations pipeline (V1 log-only) | S7 |
| G-8 | `persona-as-substrate` vault doctrine page authored | S8 |
| G-9 | Cycle-007 pair-points absorbed and closed (PP-4 kitchen attestation · PP-5 mobile canary · branch protection · ledger archive flip) | S8 |
| G-10 | Voice-fidelity iteration unblocked: a Discord-fidelity billboard preview surface renders the same snapshot in N candidate presentations, operator picks + annotates → `preference-log.jsonl` (RLHF data-collection front-end), with cadence-honest data surface (FR-38) + two-beat billboard renderer (FR-39) landing *through* it | S9 (+ amend S3 for FR-38/39/43) |

> **Amendment 2026-05-22 (active):** G-10 + FR-38..43 promoted from `grimoires/loa/cycles/cycle-008-persona-substrate/amendment-voice-fidelity-gaps.md` (operator-authorized formalization). The reframe: iteration speed on user-facing craft is the bottleneck — the preference/iteration loop (FR-40/41/42) is the *keystone instrument* that makes FR-38/39 evidence-based. Two-beat won the manual preference loop fired 2026-05-22 (`preference-log.jsonl`, schema `rlhf-preference-v0`). See §5.9 (S9) + amendment FR table below.

### 2.1 · Non-goals

- `tool-invocation.md` extraction from `character.json::tool_invocation_style` (cycle-009 · operator-paced · Gumi pass)
- Cross-character migration (satoshi · ren · akane · kaori · mongolian persona.md updates) — cycle-009+
- Semantic-event-stream substrate (replace cycle-005 prose-gate output with raw `ZoneDigest.top_events` in prompt) — cycle-010+ candidate per operator's "all events from that specific events tool" framing
- Production-side tweakpane surface (INV-PS-5 · kitchen-only)
- `discord-render.live.ts` legacy renderer migration (will retire naturally via pulse-digest + buildPrompt landings)
- Cross-character persona linting (cycle-009)
- Hash-chain on persona.md edits (cycle-009+)
- Middot-detector V2 autocorrect (V1 log-only · V2 substitution future cycle)
- loa-straylight integration for continuity primitives (cycle-010+ candidate)
- Cron post-type pruning (operator signaled weaver/lore_drop/question/callout are removal candidates · separate cycle)

---

## 3 · Personas / Users / Stakeholders

| Role | Identity | Cycle-008 stake |
|---|---|---|
| Primary subject | ruggy (the character) | Voice quality reaches operator's authoring intent |
| Operator | zksoju | Owns ruggy persona.md · drives cycle-008 · attests pair-points |
| LLM agent | Claude Opus 4.7 (and any other model via cheval) | Consumes system prompt from buildPrompt · quality of voice output depends on it |
| Gumi (future cycles) | satoshi/ren/akane/kaori/mongolian persona.md author | Inherits the pattern cycle-008 establishes when other characters migrate |
| Operator (debug-side) | zksoju in kitchen | Iterates voice via /tweak Tweakpane tab without restart |

---

## 4 · Invariants (must not change)

| ID | Invariant | Why |
|---|---|---|
| INV-PS-1 | Author authors. Engineering assembles. LLM consumes. Persona content (voice rules · zone context · post-type guidance · tool prose) lives in human-authored Markdown under `apps/character-<id>/`. Engineering code NEVER generates persona prose · only assembles authored fragments with runtime data. | Closes the regression class structurally. |
| INV-PS-2 | Every **cron** LLM call (`shape.kind === 'cron'` post types: digest/micro/weaver/lore_drop/question/callout) produces a trace row with `fragment_sources[]`. Chat-mode (`shape.kind === 'reply'`) trace rows MAY omit `fragment_sources[]` because the chat-mode userHalf is built from transcript + prompt (not template-substitution) — no substrate-fragment provenance to record. | Makes the cron-assembled prompt inspectable. Clarifies INV-PS-2 vs INV-PS-3 overlap per Flatline IMP-003 (avg 777). |
| INV-PS-3 | Both LLM transport paths (Bedrock-direct via `agent-gateway.ts:187` AND Anthropic-SDK via `agent-gateway.ts:147`) write to `apps/bot/.run/llm-trace.jsonl`. Schema v2 `fragment_sources[]` is OPTIONAL (presence depends on post-type per INV-PS-2). Readers fall back gracefully when absent. | Operator's debug surface covers both transports. Per Flatline IMP-003. |
| INV-PS-4 | The deterministic-vs-LLM boundary is the prompt itself. Substrate produces deterministic input · post-LLM sanitizers + INV-12 (kebab lint) + new middot-detector catch drift. | Frames where Tweakpane lives (deterministic side) and where observability fires (boundary crossings). |
| INV-PS-5 | Tweakpane lives in the kitchen only. No production toggle surface. | Determinism integrity. |
| INV-PS-6 | Governance (substrate mechanics) and voice (character expression) live on parallel architectural layers. They do not nest. Substrate-state blocks in prompts use neutral mechanical vocabulary, not voice flavor. | Vault doctrine: themes-vs-personas-clean-separation · substrate-over-narrative · damp-as-default-voice-substrate. Mixing causes layer-collapse. |
| INV-PS-7 | Stats out of voice. Aggregate-window stats (windowDays · prior period · rank thresholds · per-factor magnitude) NEVER appear in the prompt prose ruggy sees. Stats live in the deterministic card body. | Ruggy never cites aggregates → cannot hallucinate aggregate-narrative claims. |
| INV-PS-8 (inherited) | Cycle-007 INV-12 kebab-zone lint applies to all cycle-008 new prose | Defense against kebab leak class re-introducing. |
| INV-PS-9 (inherited) | Cycle-007 INV-13 trace envelope schema (extended to v2 with fragment_sources[] in S4) | Trace consumers tolerate v1 absence; v2 readers parse fragment_sources[]. |

---

## 5 · Functional Requirements

### 5.1 · S1 · persona.md template extensions [STATUS: mechanical work landed pre-simstim]

| ID | FR | Notes |
|---|---|---|
| FR-1 | `apps/character-ruggy/persona.md` gains `═══ SUBSTRATE STATE (this week) ═══` section between ENVIRONMENT and VOICE ANCHORS | LANDED 2026-05-17 session · 5 lines added |
| FR-2 | Section contains 2 placeholders: `{{ACTIVE_FACTORS}}` + `{{PRIOR_WEEK_HINT}}` | LANDED |
| FR-3 | No operator-authored prose under section heading | LANDED · governance-vs-voice separation respected |

### 5.2 · S2 · buildPrompt enrichment + Effect-TS migration

| ID | FR | Notes |
|---|---|---|
| FR-4 | `buildPrompt` signature returns `Effect.Effect<BuildPromptResult, BuildPromptError, never>` | full loader.ts Effect-TS migration · Data.TaggedError pattern |
| FR-5 | New args: `activeFactors?: ReadonlyArray<ActiveFactorRender>` + `priorWeekHint?: string` | cron-only · undefined for chat-mode regression fence |
| FR-6 | Private `renderActiveFactors(snapshots)` helper renders names-only bullet block under `factors with activity:` label | engineering-owned · stats stripped (no rank/actors/active_days) |
| FR-7 | Cron-only code-appended suffixes after systemHalf substitution: (a) JSON output schema (b) `UNTRUSTED_CONTENT_LLM_INSTRUCTION` LOCK | engineering-owned · not Gumi-editable · FLATLINE-SKP-001 preserved |
| FR-8 | Existing native throws at loader.ts:108/281/414 migrate to `Effect.fail(new BuildPromptError({...}))` | whole-module migration per Effect-TS pattern in repo |
| FR-9 | `buildPromptPair` + `buildReplyPromptPair` become sync shims calling `Effect.runSync(buildPrompt(...))` | preserves smoke-script call-sites untouched |

### 5.3 · S3 · cron orchestrator migration + flag

| ID | FR | Notes |
|---|---|---|
| FR-10 | `generateDigestVoice` (`claude-sdk.live.ts:31`) migrates from `buildVoiceBrief` to Effect-wrapped `buildPrompt(...)`. **Effect boundary spec** (per Flatline SKP-002 CRITICAL 850 · 2026-05-18): cron call-site wraps in `Effect.runPromise(Effect.gen(function* () { const result = yield* buildPrompt(args); ...invoke + parse + sanitize... }))` with `Effect.tapError` before runPromise that pattern-matches on `BuildPromptError._tag`: on `'BuildPromptError'` → emit trace row with `layer_op: 'build-prompt-error'` + halt this digest fire + record span exception via existing OTel `span.recordException`. NO RETRY on BuildPromptError (it's a structural/spec violation, not transient — retry would loop). Promise rejection from runPromise propagates to the existing cron orchestrator error handler (caught by tracer span). | 1 production caller (`claude-sdk.live.ts`) + 2 test files (preserved) per S0 spike scope verification |
| FR-11 | `LOA_PROMPT_BUILDER` env flag added · `default: 'legacy'` post-S3 merge · flip to `'canonical'` at S8 after OP-G2 attests | rollback safety net survives cycle |
| FR-12 | `voice-brief.ts` marked `@deprecated` (NOT deleted · escape hatch) | cycle-009 candidate retirement |
| FR-13 | All other 5 cron post types (micro · weaver · lore_drop · question · callout) gain compatibility · engineering passes empty `activeFactors[]` for non-digest types until they migrate or get pruned | per `project-cron-post-types-pruning` memory · operator signaled 4 are removal candidates anyway |
| FR-13a | (Per Flatline IMP-004 avg 792) S3 acceptance MUST either (a) include explicit unit tests covering empty-array buildPrompt invocation for each of the 5 non-digest cron post types (proves compatibility · MUST PASS for S3 close), OR (b) explicitly remove the post type from `outputInstruction(postType)` + `PostType` discriminated union + fragment markers in persona.md. Hybrid is allowed (test the ones operator wants to retain · remove the rest). The "passed through silently" branch is REJECTED — every post type either has a green test or is gone. | Closes "untested compatibility surface" attack class. |

### 5.4 · S4 · trace schema v2 + fragment_sources[]

| ID | FR | Notes |
|---|---|---|
| FR-14 | `LlmTraceEntry` extended with optional `fragment_sources: FragmentSource[]` field | cycle-007 INV-13 v1 → v2 · old rows tolerate (readers fall back) |
| FR-15 | `buildPrompt` populates `fragment_sources[]` per substitution call · records `{layer, source_file, source_lines, prompt_offset, fragment_kind}` per fragment | every cron trace has 5+ entries (one per layer that contributed) |
| FR-15a | **fragment_sources[] invariants** (per Flatline IMP-011 DISPUTED · accepted 2026-05-18): (a) sorted by `prompt_offset.start` ascending, (b) `prompt_offset` values are CHARACTER indices into the assembled `systemPrompt` (NOT byte indices), (c) NO overlap — each character in systemPrompt belongs to exactly one fragment_source (gaps are allowed for whitespace/literal-template text), (d) `layer` field is constrained to the 5-layer enum: `'persona' | 'voice' | 'tool' | 'medium' | 'environment'`. Validation via (i) ajv schema enforcing the enum, (ii) runtime assertion in buildPrompt after populating the array but before returning — checks ascending order + no overlap + valid layer enum + returns `Effect.fail(new BuildPromptError({kind: 'fragment-sources-invariant-violation', detail: '<which invariant>'}))` on violation. | Schema v2 cross-tool consistency. |
| FR-16 | `.claude/overrides/trace-explain-output.schema.json` v1 → v2 ajv schema bump | INV-13 invariant compliance |
| FR-17 | `bun run trace:explain --line N` renders the source-map under the prompt | human-format trace inspection |
| FR-18 | Dashboard LLM-calls tab renders fragment_sources as colored breadcrumbs · click opens source file at line | operator click-to-source debug loop |

### 5.5 · S5 · Anthropic-SDK trace capture

| ID | FR | Notes |
|---|---|---|
| FR-19 | `agent-gateway.ts::invokeAnthropicSdk` (line 147) wraps in `tracer.startActiveSpan('anthropic.sdk.converse', ...)` mirroring bedrock pattern at line 201 | S5 scout already located target |
| FR-20 | `appendTraceEntry` emit to `apps/bot/.run/llm-trace.jsonl` for every invocation outcome (per Flatline SKP-003 + SKP-004 HIGH · accepted 2026-05-18). Trace envelope gains `outcome` field: `'success' \| 'provider-error' \| 'timeout' \| 'malformed-response' \| 'sdk-exception'`. **Streaming completion hook**: when `invokeAnthropicSdk` uses streaming (per SDK's onChunk/onComplete hooks), span closure + trace emission MUST hook into `onComplete`/`onEnd` (the stream's final-chunk event), NOT the initial request resolution. Use `Promise.all` wrapper around stream iterator OR SDK's native completion callback. Single trace row emitted per invocation regardless of streaming/non-streaming. **Error classification**: provider errors classified by HTTP status + Anthropic error code; timeouts detected via AbortController + 60s default; sdk-exception catches all non-classified errors. NO stack traces or credentials in trace; redacted error message only. | Stream-completion hook closes chat-mode invisibility gap. Outcome field enables debugging timeout/error cases. |
| FR-20a | **Failure-path test coverage** · S5 acceptance includes tests for each outcome class: success (happy path) · provider-error (mock 500 response) · timeout (mock 60s+ delay) · malformed-response (mock invalid JSON) · sdk-exception (mock thrown exception). Each test asserts trace row has correct `outcome` field + redacted-error if applicable. | Closes Flatline SKP-004. |
| FR-21 | `/ruggy <prompt>` slash command produces an llm-trace row | chat-mode visibility |
| FR-22 | Chat-mode reply produces an llm-trace row | invisibility gap closes |

### 5.6 · S6 · /tweak Tweakpane tab in kitchen

| ID | FR | Notes |
|---|---|---|
| FR-23 | `apps/bot/package.json` adds `tweakpane: ^4.x` dep | operator-confirmed library choice |
| FR-24 | `scripts/dashboard.ts` gains `/tweak` tab with 5 layer folders (PERSONA · VOICE · TOOL · MEDIUM · ENVIRONMENT) using cycle-007 INV-10 oklch palette as left-borders | per ARCH §3.1 |
| FR-25 | `apps/bot/src/cli/playground-fire.ts` accepts `--tweak <json>` for per-fire overrides | enables tweak-fire-observe loop |
| FR-26 | Result panel: live-fire with Discord embed preview + source-map breadcrumbs from S4 | tweak feedback loop visible |
| FR-27 | State persists via `localStorage.tweakpane:freeside-characters` + JSON export/import | preset library V1 minimal |
| FR-28 | OP-G3 attestation (operator iterates ≥15 min via /tweak · attests faster-than-file-edit-restart) | also satisfies cycle-007 PP-4-reframed |

### 5.7 · S7 · middot-detector + sanitize-violations integration (V1 log-only)

| ID | FR | Notes |
|---|---|---|
| FR-29 | `packages/persona-engine/src/deliver/sanitize.ts` gains `detectAiArtifacts(text, postType)` returning `AiArtifact[]` | heuristics: middot-density · spelled-number · em-dash · hyphenated-compound |
| FR-30 | `.run/sanitize-violations.jsonl` extended for new artifact kinds | reuses cycle-007 sanitize-violations infrastructure |
| FR-31 | Dashboard sanitize-violations tab surfaces new artifact kinds with sample-text + artifact-kind label | operator monitoring |

### 5.8 · S8 · cycle close + cycle-007 pair-point absorption

| ID | FR | Notes |
|---|---|---|
| FR-32 | `~/vault/wiki/concepts/persona-as-substrate.md` authored (operator-paced · anchor pages: ACVP · chat-medium-presentation-boundary · freeside-modules-as-installables · damp-as-default-voice-substrate · themes-vs-personas-clean-separation · substrate-over-narrative) · **include teachable-moments sections from BB-PR-001..004 + BB-SP-002 CSS-preprocessor pattern observation + BB-SP-001 fragment_sources bidirectional UX vision** (per BB review 2026-05-18 · institutional memory) | new vault doctrine |
| FR-33 | `grimoires/loa/cycles/cycle-008-persona-substrate/COMPLETED.md` per cycle-006/007 precedent · all invariants + sprints + lessons distilled · **include explicit section acknowledging cycle-007-pair-points-absorption trade** (per BB-RF-003 accept-minor 2026-05-18) so future cycles don't repeat the absorption pattern accidentally |
| FR-34 | `LOA_PROMPT_BUILDER` env flag default flips `'legacy'` → `'canonical'` | post OP-G2 + OP-G3 attestations |
| FR-35 | Cycle-007 pair-points closed as part of cycle-008 close: PP-4 kitchen attestation (via FR-28 OP-G3) · PP-5 mobile canary screenshot · GitHub branch protection on 3 schema files · cycle-007 ledger flip candidate → archived | single ledger sweep |
| FR-36 | `ledger.json` flip cycle-008 active → candidate + cycle-007 candidate → archived | absorbed cleanup |
| FR-37 | BB round 3 post-PR review via `/bridgebuilder --pr <N>` · APPROVED or PRAISE-only as close bar | quality gate |

### 5.9 · Amendment 2026-05-22 · voice-fidelity + RLHF preference loop (FR-38..43)

Promoted from `grimoires/loa/cycles/cycle-008-persona-substrate/amendment-voice-fidelity-gaps.md` (status: active). FR-38/39/43 amend S3; FR-40/41/42 form new sprint S9. Numbering continues from FR-37 (no collision; existing FRs end at FR-37).

| ID | FR | Placement | Notes |
|---|---|---|---|
| FR-43 | Adopt `@0xhoneyjar/score-api-types@0.6.0` as the score contract — **type-only** (`import type` = zero-runtime, no zod loaded). Replaces local hand-roll `packages/persona-engine/src/score/types.ts` (613 LoC at 2026-05-22 — amendment brief's "206 LoC" was stale; verify scope at T3.0 time). | S3 new task **T3.0** (runs before T3.1) | Verbatim constraints (issue #85 comment): keep local `score-fetch.port.ts` (import data shapes INTO it); `MostActiveWalletEntry` stays local (not in package until cycle-029); names in >1 entity (e.g. `DimensionSummary`) are **deep-import only** (`@0xhoneyjar/score-api-types/entities/<name>`), NOT the flat root barrel. Package JSON Schema (`/json/<entity>.v1.json`, permanent `$id`) feeds T3.1's verification gate (Fork D → D1). |
| FR-38 | **Cadence-honest data surface.** Separate the *licensing window* (how far back to decide what's worth narrating — stays 30d for factor density per cycle-005 r4) from the *reporting headline* (the number the reader sees — reflects cadence). Card hero shows a fresh "since last post" delta (reuse `compose/voice-memory.ts` per-zone state); 30d figure, if shown, is clearly-labeled rolling context. Close the "two clocks" drift (digest `PULSE_WINDOW_DAYS=7` vs micro `windowDays=30`). | S3 new task **T3.8** | Fork A → operator decision: *separate the data-read from voice as independently-tweakable surfaces* (not a window-formula choice — a separation requirement). Cadence-honesty applies to the data layer. Voice-half already covered by S3 buildPrompt migration (stats-out-of-voice). |
| FR-39 | **Two-beat billboard renderer** (locked spec, amendment §7.5). Two sequential Pattern-B webhook sends, neither pings on pop-in/digest cadence: **Beat 1 — the agent** (`voiceContent`): 1–2 short lowercase lines, ZERO numbers (stats-out-of-voice). **Beat 2 — the billboard** (`truthFields`, **bold**): zone header + cadence-honest data (FR-38 "since last" hero + 30d-rolling secondary + wallets + state). Beat 2 rendered as **bold text with U+2007 FIGURE-SPACE column alignment** (technique proven at `live/discord-render.live.ts:54` for Android `gg sans` tabular safety), NOT a code block (code blocks ignore `**bold**`; bold was the explicit ask). | S3 new task **T3.9** | Supersedes the narrow "two messages" framing → the **Billboard reframe** (Fork B): digest → clean data Billboard, pop-in → Event-spotlight, chat → ruggy-the-agent; each surface unmistakably itself. Convergence with `project-cron-post-types-pruning` (weaver/lore_drop/question/callout become prune candidates). Two-beat won the manual preference loop (`preference-log.jsonl`). Open micro-decisions (keep 30d-rolling row? exact labels? separator? all-quiet vs active register) defer to the S9 preview surface, don't block. `message.content` always populated (Discord-as-Material fallback) · underscore-escape preserved (`sanitize.ts`). |
| FR-40 | **Generate-N candidate fan-out (capture).** A "fire N" mode renders the SAME input (zone + state + snapshot) in N candidate presentations — varying seed and/or a named prompt/format-fragment variant — in one action. Each candidate captured (S5 trace row shape · `outcome` classified) grouped by a `batch_id`. First slice is *layout/format* (billboard look), then *voice*. | S9 (enhance S6's `--tweak` → `--fire-n`) | The S9 lead slice. Solves "iteration speed is too slow, none have landed" by making the billboard preview surface the FIRST thing S9 ships. RLHF capture front-end. |
| FR-41 | **Side-by-side compare + pick + annotate (elicitation).** Dashboard renders a batch's N candidates side-by-side at **Discord fidelity** (real bold · ~40-char mobile wrap · webhook avatar · reusing INV-10 oklch + embed preview from S6 T6.5). Operator picks a winner (or ranks) + writes a free-text annotation. Pick + annotation persist as a **preference record** (JSONL · `preference-log.jsonl` · schema `rlhf-preference-v0` · mirrors `compose/voice-memory.ts` zero-infra pattern). Records structured as preference-pairs/rankings (RLHF-ready), not just "winner picked." | S9 | Manually fired 2026-05-22 (amendment §7.4): two-beat won against scoreboard/event-spotlight/ticker-tile, annotation: *commits to the voice/data seam*. This task turns that manual loop into a self-serve tool. |
| FR-42 | **Backpressure — preference → eval set (the close).** A picked+annotated winner can be promoted to `evals/snapshots/` as a golden case (existing regression substrate). Annotations accumulate as a labeled corpus — the next prompt/format edit is validated against the operator's own past picks. The corpus is the training/calibration signal for the **cycle-009 LLM-as-judge** (Fork C → C3: RLHF full · human loop now, judge bootstrapped from picks in cycle-009). | S9 | OP-G-class live attestation: operator fires a fan-out batch, picks, annotates, promotes one to evals — end-to-end loop attestation (mirrors cycle-007 PP-4 paste-to-Loa shape). |

---

## 6 · Non-Functional Requirements

| ID | NFR | Notes |
|---|---|---|
| NFR-1 | All cycle-008 new code passes existing typecheck (`bun run typecheck`) | clean |
| NFR-2 | Test suite green at every sprint close (`bun test`) | 1068+ tests baseline · target maintained |
| NFR-3 | Cycle-007 lint suite green (`bun run lint:cycle-007` for INV-12/14/17/18) | inheritance respected |
| NFR-4 | Bundle size impact of tweakpane v4 dep: <50KB minified | acceptable kitchen-side cost |
| NFR-5 | S2 equivalence test matrix passes (5 scenarios + 3 negative · see §S2 acceptance in spike doc) | regression fence |
| NFR-6 | LOCK suffix appended unconditionally for `shape.kind === 'cron'` · NEVER for `shape.kind === 'reply'` | FLATLINE-SKP-001 preserved |
| NFR-7 | `<untrusted-content>` marker preservation through substitution chain (no re-escaping by buildPrompt — escaped at source by `formatPriorWeekHint`) | FLATLINE-SKP-002 preserved |
| NFR-8 | **Trace data policy** (per Flatline SKP-001 CRITICAL 880 · 2026-05-18). All trace rows written to `apps/bot/.run/llm-trace.jsonl` classify fields as public / internal / sensitive. Redaction at emit-time: wallet addresses (regex `0x[a-fA-F0-9]{40}`) replaced with `0x[REDACTED]`; API keys (`sk-…`, `Bearer …` headers) replaced with `[REDACTED-CREDENTIAL]`; JWT tokens (regex `eyJ[A-Za-z0-9+/=._-]+`) replaced with `[REDACTED-JWT]`; Discord user identifiers (snowflake IDs in user fields) MAY be retained if operator explicitly opts-in via `LOA_TRACE_INCLUDE_DISCORD_IDS=1` (default off). Retention: `apps/bot/.run/llm-trace.jsonl` rotates at 100MB or 30 days (whichever first) — older rolls move to `.run/llm-trace-archive/` (operator-tunable via `LOA_TRACE_RETENTION_DAYS` + `LOA_TRACE_MAX_SIZE_MB`). Dashboard access gated by existing `LOA_DASH_AUTH` bearer token (cycle-007 INV-16). Unit tests prove: (a) wallet redaction works, (b) API keys never reach .jsonl, (c) Discord IDs gated by env flag. |
| NFR-9 | **Aggregate-stat-leakage runtime guard** (per Flatline-PRD SKP-002 CRITICAL 830 + Flatline-SDD SKP-001/002/003 + BB-RA-002 HIGH 710 + cycle-008 Phase 4 HITL · 2026-05-18 FINAL · supersedes earlier log-only V1). V1 ships **fail-loud** with three guardrails to prevent false positives: (a) **factor-name allowlist** populated from score-mcp factor catalog at S2 fixture time · stored at `packages/persona-engine/src/persona/fixtures/factor-name-allowlist.json` · refreshed via `bun run --cwd packages/persona-engine sync-factor-allowlist` (S2 task) · names in the allowlist bypass NFR-9 regex check; (b) **warn-mode escape hatch** via `LOA_STAT_LEAKAGE_GUARD=warn` env var · downgrades fail-loud to log-only for emergency rollback (e.g., production false-positive blocking digest fires) · default unset → fail-loud · setting `=warn` logs a `[NFR-9] WARN: downgraded to log-only` stderr message per process; (c) **regex tightening** · patterns require explicit number context (e.g., `\brank[ -]?\d+\b` not `\brank\b`). On non-allowlisted, non-warn-mode detection: returns `Effect.fail(new BuildPromptError({kind: 'aggregate-stat-leakage', argName, sample, category: 'INPUT'}))`. Negative test scenarios 11-15 assert Effect.fail; positive test scenarios 16-20 assert allowlist bypass works for known-safe names. Cycle-009 promotion criteria: **remove the warn-mode escape hatch** (objective, observable change). |

---

## 7 · Operator-paced quality gates (cycle-008 OP + absorbed cycle-007 PP)

Per Flatline IMP-001 (avg 895 · auto-integrated 2026-05-18): each HARD gate has explicit PASS / FAIL criteria + remediation branch. Subjective "looks good" closures rejected.

| Gate | Type | PASS criteria | FAIL criteria | Remediation if FAIL | Sprint |
|---|---|---|---|---|---|
| **OP-G2** · live voice attestation | HARD | Operator fires `bun run --cwd apps/bot digest:once` × 4 zones via `railway run` post-S3. ALL 4 voice outputs satisfy: (1) zero kebab-form zone IDs in voice prose (regex `\b(bear-cave\|el-dorado\|owsley-lab)\b` returns no matches) (2) zero em-dashes in voice output (regex `[—–]` returns no matches) (3) zero spelled-out aggregate numbers (no word forms of zero-thousand in voice) (4) all numeric magnitudes as digits (5) no aggregate-stat citation (no rank/percentile/threshold words in voice). | Any of the 5 criteria fail in ANY of the 4 zones. | Roll back `LOA_PROMPT_BUILDER` to `legacy` · file regression in cycle-008 issue tracker with the failing trace row + which criterion failed · halt cycle close · loop back to S2/S3 to fix root cause. | S3 close |
| **OP-G3** · tweakpane teachability (also satisfies cycle-007 PP-4-reframed) | **SOFT** (reclassified per Flatline-Sprint IMP-005 835 · 2026-05-18 — earlier HARD label contradicted REMEDIATION "cycle-008 still closes" clause) | Operator runs ≥15 min `/tweak` tab iteration session · iterates ≥5 distinct tweaks (slider drag → fire → observe → adjust) · attests "loop is faster than file-edit-restart cycle" in a written line of NOTES.md. | Operator does NOT complete 15 min session OR does NOT iterate ≥5 tweaks OR explicitly says loop is slower. | If <15 min: schedule second session before close (still SOFT · doesn't block). If ≥5 tweaks but loop slow: open issue tagged `s6-tweakpane-ergonomics` for cycle-009. Cycle-008 still closes (G-6 has minimum-viable bar already met). **Soft-gate semantics**: OP-G3 does NOT block T8.3 PP-5 sequencing · does NOT block T8.8 ledger flip · operator attestation captured in NOTES.md for traceability but not gating. | S6 close |
| **PP-5 absorbed** · production canary mobile screenshot | HARD | Operator screenshots Discord Android post-digest-cron-fire showing: (1) zone header proper-cased (`Bear Cave` not `bear-cave`) (2) numeric column alignment on figure-space (3) voice line free of cycle-008 artifacts (kebab/em-dash/spelled-number/aggregate). One screenshot per zone (4 total) attached to cycle-008 close PR. | Screenshots show ANY of the 3 criteria failing OR screenshots not captured. | If artifacts: same as OP-G2 FAIL (rollback + regression file). If not captured: open dated TODO in NOTES.md · cycle close blocked until captured. | S8 |
| **PP-2 absorbed** · S3-close mobile screenshot | SOFT | Rolls into PP-5 session (same Discord Android batch) | Same as PP-5 FAIL | Rolls into PP-5 remediation. | S8 |
| **PP-3 absorbed** · 4-color encoding teachability | SOFT | Verifiable inside OP-G3 `/tweak` session: operator confirms 4-color trace timeline visible + interpretable in `/playground`. | If `/tweak` tab does not surface 4-color timeline OR operator can't decode it. | Open issue tagged `s6-trace-timeline-color` · soft gate · cycle still closes if OP-G3 passes overall. | S6 |
| **Branch protection absorbed** | OPERATOR-UI | GitHub Settings → Branches → New rule requiring CODEOWNERS approval for changes to: `.claude/overrides/voice-prompt-paths.json` + `voice-prompt-paths.schema.json` + `trace-explain-output.schema.json`. Screenshot of rule in cycle-008 close PR comment. | Rule not added OR scope wrong. | Add the rule before close. Hard gate (cannot close cycle without). | S8 |
| **Cycle-007 ledger flip absorbed** | LEDGER | `grimoires/loa/ledger.json` `cycle-007-agent-debuggability.status` flips from `candidate` to `archived` AND `archived_at` timestamp added. Commit lands in cycle-008 close PR. | Ledger not updated OR fields wrong. | Update + recommit. | S8 (FR-35) |

### 7.1 · LOA_PROMPT_BUILDER flag specification (per Flatline IMP-002 avg 850 · auto-integrated 2026-05-18)

| Aspect | Specification |
|---|---|
| **Ownership** | Operator (zksoju) decides flip from `'legacy'` → `'canonical'`. Rollback (canonical → legacy) is operator-authorized but engineering can recommend based on observed regressions. |
| **Evidence threshold for canonical → legacy rollback** | (a) OP-G2 attestation FAIL on any of the 4 zones, OR (b) production cron trace shows return of cycle-007 artifact class (kebab/em-dash/spelled-aggregate/stat-citation) for ≥2 consecutive cron fires, OR (c) Anthropic API error rate >5% over a 1-hour window correlated with canonical path. |
| **State effects on flip** | Cron post types use different builder · NO schema migration needed (trace v2 fragment_sources[] is OPTIONAL · old rows tolerate per INV-PS-3) · sanitize.ts behavior unchanged · downstream parseVoiceResponse unchanged. Flip is a process-restart-required env-var change (no graceful in-flight migration). |
| **Compatibility behavior** | Both builders co-exist in code until cycle-009 retires `voice-brief.ts`. `voice-brief.ts` callable as long as it's not `@deprecated`-removed. Flag flip does NOT delete files, only routes new invocations. |
| **Unset / malformed env var behavior** | Only literal `'canonical'` selects new path. ANY OTHER VALUE (unset, empty string, `'cannonical'` typo, whitespace, `'CANONICAL'` case-mismatch) falls back to `'legacy'` AND emits one stderr warning per process: `[LOA_PROMPT_BUILDER] WARN: unknown value '<x>' falling back to 'legacy'`. Unit test required for each branch. |
| **Cycle-008 default in `default: 'legacy'` rationale** | Safety-net preserves cycle-007 production behavior during S4-S7 work · flip to `'canonical'` in production at S8 happens only after OP-G2 attestation passes · operator-paced timing. |
| **Environment-stratified defaults** (per Flatline SKP-003 HIGH · accepted 2026-05-18) | `LOA_PROMPT_BUILDER=canonical` is REQUIRED (not optional default) in dev/CI/test environments throughout cycle-008. CI workflow asserts the env var before running cron-test fixtures. Production stays on `'legacy'` until OP-G2 + S8 flip. This gives canonical path real soak via tests + operator-paced `digest:once` invocations WITHOUT production-flip risk. Documented in: `.github/workflows/*.yml` env block + `apps/bot/scripts/digest:once` CLI entry asserts `LOA_PROMPT_BUILDER` is set to one of `'canonical' \| 'legacy'` (no silent unset). |

---

## 8 · Dependencies

| Dep | Source | Status |
|---|---|---|
| cycle-007-agent-debuggability | `grimoires/loa/cycles/cycle-007-agent-debuggability/` | candidate (structural close 2026-05-17) |
| cycle-006-substrate-presentation | merged 2026-05-16 (3324a8d on main) | candidate (ledger) |
| Effect-TS ^3.21.2 | `packages/persona-engine/package.json` | already in deps · heavy use in `ambient/*` + `compose/llm-gateway/*` |
| score-mcp | zerker · `score-api-production.up.railway.app/mcp` | unchanged · cycle-008 doesn't modify gate logic |
| @anthropic-ai/claude-agent-sdk | npm | unchanged · cycle-008 instruments tracing only |
| @0xhoneyjar/medium-registry ^0.2.0 | inherited from cycle-007 | unchanged |
| tweakpane v4.x | npm | NEW dep · S6 introduces |

---

## 9 · Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Effect-TS migration touches both cron + chat-mode call-sites | Low | Regression fence: byte-identical chat-mode test (Tier 1 in S0 spike scenario matrix) catches any drift |
| LOCK suffix appendage order matters (schema before LOCK) | Low | Explicit order in `buildPrompt` body · unit test verifies suffix presence + ordering |
| `<untrusted-content>` marker preservation through substitution chain | Medium | FLATLINE-SKP-002 escape happens at `formatPriorWeekHint` source · buildPrompt does literal substitution · negative test scenario 6 verifies marker integrity under `</untrusted-content>` injection attempt |
| Tweakpane v4 bundle weight / JS surface to maintain | Low | Kitchen-only (INV-PS-5) · production untouched |
| Operator PP-5 mobile attestation takes weeks (operator-paced) | Medium | Cycle close blocked but cycle-008 functional value can ship before final archive flip · ledger entry retains `candidate` status until pair-points clear |
| Cron post-type migration scope creep (5 non-digest types) | Medium | FR-13 ships empty-list compatibility · operator pruning decision (`project-cron-post-types-pruning`) happens in separate cycle |

---

## 10 · Out-of-band considerations

### 10.1 · Vault doctrines activated for this cycle (operator-authorized 2026-05-17)

```
Activated: ~/vault/wiki/concepts/themes-vs-personas-clean-separation.md
           ~/vault/wiki/concepts/substrate-over-narrative.md
           ~/vault/wiki/concepts/damp-as-default-voice-substrate.md
Operation: cycle-008 spike + PRD substrate-state-block design
Use: usable
Boundaries: cycle-008 vocabulary + placement only · does NOT extrapolate to other constructs/comms
Expiry: at cycle-008 close
```

### 10.2 · Memory entries informing this cycle

- `feedback-ruggy-voice-principle` · stats-out-of-voice
- `feedback-governance-voice-separation` · parallel layers, neutral mechanical vocabulary
- `feedback-effect-ts-new-surfaces` · Effect-TS for new error paths in persona-engine
- `project-persona-authorship` · operator owns ruggy persona, Gumi owns others
- `project-straylight-continuity-candidate` · cycle-010+ flag for typed memory primitives
- `project-cron-post-types-pruning` · operator signal that 4 of 6 cron types are removal candidates

### 10.3 · Cycle-009 candidates (out of scope, queue)

- `tool-invocation.md` extraction from `character.json::tool_invocation_style` (Gumi pass · operator-paced)
- Cross-character persona.md migration (satoshi/ren/akane/kaori/mongolian inherit cycle-008 placeholders)
- Middot-detector V2 (autocorrect instead of log-only)
- Tweakpane preset library (named configs · operator-shareable)
- voice-brief.ts retirement (deletion after S3 deprecation soak · per BB-RF-001 accept-minor 2026-05-18 cycle-009 task)
- **LOA_PROMPT_BUILDER flag retirement** (cycle-009 · per BB-RF-001 accept-minor · flag becomes meaningless after voice-brief.ts deletion · remove env-stratification + parse rules + unit tests)
- **NFR-9 stat-leakage promotion** (log-only V1 → fail-loud V2 · per BB-RA-002 accept · gated on production false-positive soak)
- **Cycle-005 prose-gate full retirement** (currently bypassed at prompt layer in cycle-008 per BB-RF-002 accept-major · cycle-009 evaluates removal if no other consumers)

### 10.4 · Cycle-010+ candidates (vision-tier)

- ~~Semantic-event-stream substrate~~ · **partially realized in cycle-008 via BB-RF-002 accept-major** · Option β shipped (`ZoneDigest.factor_trends[]` bypasses cycle-005 gate) · Option α (full top_events with wallet/time) still cycle-010+ candidate
- loa-straylight integration for ruggy continuity primitives
- Hash-chain on persona.md edits (ACVP component 6)
- Production-state branching for repro (Ramp pattern)
- Cron post-type pruning (remove 4 of 6 unused types · operator signal)
- **Persona-engine-as-pipeline** (hot-reload · AST validation · fmt command) · per BB-SP-002 SPECULATION 620 captured 2026-05-18
- **fragment_sources[] bidirectional UX** (hover-to-highlight + click-to-open in /tweak tab) · per BB-SP-001 VISION 680 captured 2026-05-18

---

## 11 · Sprint estimate

| Sprint | Scope | Effort | Risk |
|---|---|---|---|
| S0 | Spike (structural diff) | ½ day | LANDED |
| S1 | persona.md placeholder insertion | ~10 min operator review | LANDED |
| S2 | buildPrompt Effect-TS enrichment | ½-1 day | LOW |
| S3 | Cron orchestrator migration + flag | 1 day | LOW |
| S4 | Trace schema v2 + fragment_sources[] | 1 day | LOW |
| S5 | Anthropic-SDK trace capture | ½ day | LOW |
| S6 | /tweak Tweakpane kitchen tab | 1 day | MEDIUM (new dep + UI work) |
| S7 | middot-detector + sanitize-violations | ½ day | LOW |
| S8 | Cycle close + pair-point absorption | ½ day operator-paced gates · ½ day mechanical | LOW (mechanical) / MEDIUM (operator-paced timing) |

**Total**: ~4-5 days mechanical · plus operator-paced PP/OP gates that compress when operator engages.

---

## 12 · Glossary

| Term | Definition |
|---|---|
| **buildPrompt** | Canonical persona-engine prompt builder at `loader.ts:237` · consumes persona.md template · cycle-008 target for cron migration |
| **buildVoiceBrief** | Legacy auto-generated builder at `voice-brief.ts:86` · retired in cycle-008 S3 deprecation |
| **substrate-state block** | The `═══ SUBSTRATE STATE (this week) ═══` section in persona.md (S1 landed) · carries `{{ACTIVE_FACTORS}}` + `{{PRIOR_WEEK_HINT}}` placeholders |
| **fragment_sources[]** | Cycle-008 trace envelope v2 field · per-layer source-map identifying which authored file:line range contributed each prompt section |
| **gate-licensing** | Cycle-005 prose-gate mechanism · filters factors against rank-90 + p95-reliability bars · output is `permittedFactors[]` (the substrate's licensed list for narration) |
| **stats-out-of-voice** | INV-PS-7 · aggregate-window stats never in prompt prose for ruggy · they live in deterministic card body |
| **governance-vs-voice** | INV-PS-6 · substrate mechanics + character expression on parallel architectural layers · no mixing |
| **LOCK suffix** | `UNTRUSTED_CONTENT_LLM_INSTRUCTION` · FLATLINE-SKP-001/CRITICAL · cron-only systemPrompt tail |
| **PP-N** | Cycle-007 pair-points absorbed by cycle-008 (PP-2 SOFT · PP-3 SOFT · PP-4 reframed · PP-5 HARD) |
| **OP-G2/G3** | Cycle-008 operator-paced gates (live voice attestation · tweakpane teachability) |

---

## 13 · Open spike questions resolved (from S0 spike · audit trail)

| # | Question | Resolution |
|---|---|---|
| 1 | Zone-voice-context migration (Gap 8) | DROP entirely · {{ENVIRONMENT}} + score-mcp + codex prelude cover the gap |
| 2 | JSON output schema location (Gap 7) | Code-appended cron suffix (same pattern as LOCK) · not in persona.md |
| 3 | Chat-mode LOCK suffix (Gap 6) | Cron-only in cycle-008 · reply-mode evaluation deferred to cycle-009 |
| 4 | buildPrompt arg signature (Q1) | Structured snapshots · `ActiveFactorRender` shape · names-only |
| 5 | Negative cron shape behavior (Q5) | Fail-loud via `Effect.fail(new BuildPromptError(...))` |
| 6 | Effect-TS scope (Q2) | Full loader.ts module migration · `buildPrompt` returns Effect |
| 7 | Vocabulary for substrate-state labels (mid-spike reframe) | Neutral mechanical: "factors with activity:" · governance-vs-voice principle |
| 8 | Drop SILENCED list from prompt (final simplification) | YES · cycle-005 gate stays as engineering middleware · only "active" list shown |
| 9 | Placement in persona.md | Base template after {{ENVIRONMENT}} · universal to all cron post types |

Audit trail in `grimoires/loa/cycles/cycle-008-persona-substrate/spike-builder-diff.md`.

---

End of cycle-008 PRD r1. Ready for Phase 2 (Flatline PRD multi-model adversarial review).
