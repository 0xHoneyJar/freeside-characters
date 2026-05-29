# cycle-008 · persona-as-substrate · Sprint Plan

> **Version**: 1.0
> **Date**: 2026-05-18 (/simstim Phase 5 output · ready for Phase 6 Flatline Sprint review)
> **Author**: planning-sprints skill (Loa-embodied · ARCH/Ostrom + craft/Alexander · BARTH for ship discipline)
> **Cycle**: cycle-008-persona-substrate
> **Branch target**: `feat/cycle-008-persona-substrate`
> **Companion docs**: `grimoires/loa/prd.md` (388 lines · Flatline-hardened) · `grimoires/loa/sdd.md` (1248 lines · Flatline + BB + RT integrations applied)
> **Inheritance**: cycle-007-agent-debuggability (candidate · structural mechanical close · pair-points absorbed)
> **Ledger registration**: sprint-21 through sprint-29 (next_sprint_number=21 at cycle-008 start)

---

## 1 · Overview

Cycle-008 ships in **10 sprints** (was 9 · amendment 2026-05-22 adds S9). Two have already landed pre-/simstim (mechanical work) · S2-S8 remain · S9 added by amendment. Total estimated effort: ~6.5-7.5 days mechanical + operator-paced attestation gates (OP-G2 · OP-G3 · OP-G4 · PP-5 · cycle-007 absorption ceremony).

> **Amendment 2026-05-22 (active)**: amends S3 with T3.0 (FR-43 score-api-types) · T3.8 (FR-38 cadence-honest data surface) · T3.9 (FR-39 two-beat billboard renderer · locked spec), and adds new sprint **S9** (FR-40/41/42 RLHF preference loop · billboard-preview-first lead slice). Source: `grimoires/loa/cycles/cycle-008-persona-substrate/amendment-voice-fidelity-gaps.md`. Two-beat won the manual preference loop (`preference-log.jsonl`).

### 1.1 · Sprint matrix

| Sprint | Local ID | Global # | Title | Status | Scope | Tasks | Est days | Risk |
|---|---|---|---|---|---|---|---|---|
| S0 | sprint-0 | sprint-21 | Structural diff spike + reframe rounds | ✅ LANDED pre-/simstim | RESEARCH | 1 (spike doc + 4 reframe iterations) | ½ | LOW |
| S1 | sprint-1 | sprint-22 | Persona.md placeholder insertion | ✅ LANDED pre-/simstim | TEMPLATE | 1 (5 lines added to apps/character-ruggy/persona.md) | ¼ | LOW |
| S2 | sprint-2 | sprint-23 | buildPrompt Effect-TS migration + render helpers + runtime guards | PLANNED | CORE | 9 tasks | 1-1½ | MEDIUM (regression fence load-bearing) |
| S3 | sprint-3 | sprint-24 | Cron orchestrator migration + flag + score-mcp schema gate (+ T3.0/T3.8/T3.9 amendment) | PLANNED | INTEGRATION | 10 tasks | 1½-2 | MEDIUM (RF-002 source-swap + type-surface swap + delivery split) |
| S4 | sprint-4 | sprint-25 | Trace schema v2 + fragment_sources[] + redaction architecture | PLANNED | OBSERVABILITY | 8 tasks | 1 | MEDIUM (two-pass offset + lock atomicity) |
| S5 | sprint-5 | sprint-26 | Anthropic-SDK trace capture + outcome classification + stream hooks | PLANNED | OBSERVABILITY | 6 tasks | ½ | LOW |
| S6 | sprint-6 | sprint-27 | /tweak Tweakpane kitchen tab + layered enforcement | PLANNED | KITCHEN | 7 tasks | 1 | MEDIUM (new dep + UI work + 3-layer auth) |
| S7 | sprint-7 | sprint-28 | middot-detector + sanitize-violations integration | PLANNED | QUALITY | 4 tasks | ½ | LOW |
| S8 | sprint-8 | sprint-29 | Cycle close + cycle-007 pair-points absorption + vault doctrine | PLANNED | CEREMONY | 8 tasks | ½ mechanical + operator-paced | MEDIUM (OP-G2/OP-G3/PP-5 attestation timing) |
| S9 | sprint-9 | sprint-30 | RLHF preference loop · billboard-preview-first lead slice (FR-40/41/42) | PLANNED · amendment | RLHF | 6 tasks | 1½ | MEDIUM (new preview UI + JSONL persist + fidelity parity) |

**Total**: 10 sprints · 61 tasks · ~6.5-7.5 days mechanical + operator-paced ceremony. Cycle-007 absorption ceremony folds into S8. S9 executes BEFORE S8's close ceremony (it's the instrument that unblocks the S3 craft work) — S8 T8.8 close sweep accounts for S9.

### 1.2 · Dependency graph

```
S0 ✅ → S1 ✅ → S2 ─┬─→ S3 ─┬─→ S4 ──┬─→ S5 ─→ ┐
                   │       │        │           │
                   │       │        │           ├─→ S9 ─→ S8 close
                   │       │        │           │   ↑
                   │       │        └─→ S6 ────┤   │ (S9 reuses S6 dashboard
                   │       │                    │   │  + INV-10 + embed preview;
                   │       └─→ S7 ─────────────┘   │  S5 trace-row shape;
                   │                                   │  S3 T3.9 render path)
                   │
                   └─ FR-15a invariant validation function is IMPLEMENTED in S2 T2.3a
                      (moved from S4 T4.3 per Flatline-Sprint IMP-001 dependency-contradiction fix 2026-05-18)
                      so buildPrompt (T2.5) can call it at substitution time.
                      Schema rendering + dashboard breadcrumbs stay in S4 (T4.4 / T4.8).

  Amendment 2026-05-22 — S3 internal ordering: T3.0 (score-api-types) runs BEFORE T3.1
  (so the schema gate validates against the package schema). T3.8 (cadence-honest data)
  feeds T3.9 (two-beat billboard · the "since last" hero comes from T3.8).
  S9 (RLHF preview loop) DEPENDS ON S5 + S6 + S3 T3.9, and EXECUTES BEFORE S8 close.
```

S2 is the linchpin. S4-S7 parallelize after S3 lands. **S9 depends on S5 (trace shape) + S6 (dashboard surface) + S3 T3.9 (render path the preview mirrors), and runs BEFORE S8's close ceremony** — it's the instrument that unblocks the FR-38/39 craft work, so its preview surface ships first and the craft lands through it. S8 absorbs all upstream + cycle-007 pair-points + the S9 sweep. Note: the previous version of this graph implied FR-15a validation flows from S4 back into S2 (circular). Resolved by moving the validation function implementation upstream into S2 (T2.3a) where it's first consumed; S4 owns the schema + renderer concerns only.

### 1.3 · Critical-path summary (post-Flatline + BB + RT integrations)

**Load-bearing decisions locked**:
- buildPrompt returns `Effect.Effect<BuildPromptResult, BuildPromptError, never>` (S2)
- LOA_PROMPT_BUILDER ships `default: 'legacy'` in prod · `'canonical'` required in dev/CI (S3) · flip in prod at S8 post OP-G2
- Cron call-site sources factor_trends (NOT permittedFactors) post RF-002 + verified score-mcp schema (S3)
- NFR-9 ships FAIL-LOUD V1 with allowlist + LOA_STAT_LEAKAGE_GUARD=warn escape hatch (S2)
- ActiveFactorRender wrapped in `<untrusted-content source="score-mcp">` markers (S2)
- Redaction moved INTO appendTraceEntry (unconditional · S4)
- fragment_sources[] populated via TWO-PASS offset recovery (S4)
- Tweakpane: localhost bind + LOA_DASH_AUTH + LOA_TWEAKPANE_ENABLED (S6)

---

## 2 · S0 · Structural diff spike + reframe rounds [LANDED]

**Status**: ✅ LANDED pre-/simstim · 2026-05-17
**Global sprint #**: sprint-21
**Effort actual**: ~½ day
**Artifact**: `grimoires/loa/cycles/cycle-008-persona-substrate/spike-builder-diff.md`

### Tasks

- **T0.1** ✅ · Author spike doc cataloging buildPrompt vs buildVoiceBrief diff · 9 gaps identified · placeholder mapping · operator-paced reframe rounds applied (stats-out-of-voice → governance-vs-voice → label vocab → SILENCED drop)

**Acceptance verified at landing**: spike doc reflects locked design decisions Q1-Q5 + 4 reframe rounds + cycle-007 pair-point absorption framing. No production code touched.

---

## 3 · S1 · Persona.md placeholder insertion [LANDED]

**Status**: ✅ LANDED pre-/simstim · 2026-05-17
**Global sprint #**: sprint-22
**Effort actual**: ~10 min operator review
**Artifact**: `apps/character-ruggy/persona.md` lines 663-668 (new ═══ SUBSTRATE STATE ═══ section)

### Tasks

- **T1.1** ✅ · Insert `═══ SUBSTRATE STATE (this week) ═══` section between ENVIRONMENT and VOICE ANCHORS · 2 placeholders (`{{ACTIVE_FACTORS}}` · `{{PRIOR_WEEK_HINT}}`)

**Acceptance verified at landing**: persona.md still parses · placeholder insertion preserves cycle-007 INV-12 compliance · 5 lines added.

---

## 4 · S2 · buildPrompt Effect-TS migration + render helpers + runtime guards [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-23
**Estimate**: 1-1½ days
**Risk tier**: MEDIUM (regression fence load-bearing · chat-mode byte-identical assertion)
**Branch**: `feat/cycle-008-persona-substrate`

### Tasks

- **T2.0** · **Capture pre-migration baseline fixture BEFORE T2.1 lands** (per Flatline-Sprint SKP-002 CRITICAL 820 + IMP-003 825 · 2026-05-18)
  - On the pre-S2 commit (current main · pre-Effect-migration): run `buildVoiceBrief(...)` + `buildReplyPromptPair(...)` against canonical fixture set
  - Write outputs to `packages/persona-engine/src/persona/fixtures/chat-mode-baseline-pre-c008.txt` AND `packages/persona-engine/src/persona/fixtures/cron-baselines-pre-c008/{zone}.txt` (one per zone)
  - Document the git SHA the baseline was captured from in fixture file header
  - Acceptance: fixtures committed in the S2 PR (first commit · BEFORE T2.1) · git SHA in header · no fixture means S2 cannot land (regression fence is tautological without it)
  - LOC: ~+200 fixture content

- **T2.1** · Define `BuildPromptError` tagged error class with INPUT/STRUCTURAL/INVARIANT-VIOLATION categorization (per Flatline IMP-003)
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+30
  - Acceptance: `BuildPromptError.categoryFor(kind)` returns correct category for all 7 kinds · unit tested

- **T2.2** · Define `ActiveFactorRender` shape · NAMES ONLY
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+5
  - Acceptance: type exposes only `displayName` · rank/actors/active_days deliberately absent (stats-out-of-voice)

- **T2.3a** · **Implement FR-15a invariant validation function** (moved from S4 T4.3 per Flatline-Sprint IMP-001 dependency-fix 2026-05-18)
  - File: `packages/persona-engine/src/persona/validate-fragment-sources-invariants.ts` (NEW)
  - LOC: ~+40
  - Acceptance: function called from buildPrompt's PASS 2 (T2.5) · validates (a) sorted ascending by prompt_offset[0] · (b) no overlap (each char in exactly one fragment_source) · (c) layer enum constrained to 5 values · (d) prompt_offset within template_region bounds · returns `Effect.fail(BuildPromptError({kind: 'fragment-sources-invariant-violation', detail: ...}))` on violation · pure function · unit-tested independently from buildPrompt

- **T2.3** · Implement `renderActiveFactors` with strict normalization + `<untrusted-content>` marker wrap + 5-char OWASP escape
  - File: `packages/persona-engine/src/persona/render-active-factors.ts` (NEW)
  - LOC: ~+90
  - Acceptance: per Flatline-Sprint SKP-001 CRITICAL 880 (LLMs don't enforce XML trust boundaries): factor displayName MUST normalize BEFORE entering prompt — (a) max length 80 chars (truncate longer with `…`), (b) char class `[A-Za-z0-9 \-'.&]` only (strip everything else), (c) control-character strip (C0/C1), (d) newline removal (`\r\n` → space), (e) bidi character strip (RLO/LRO/RLE/LRE/PDF). Then 5-char OWASP HTML-entity-escape (`<>&"'`). Then wrap in `<untrusted-content source="score-mcp" stream="factor_trends">`. Negative test: hostile factor names with `\n## System override:` · bidi RLO + reversed text · 200-char overflow · null bytes · `</untrusted-content>` injection — all return safe rendered string with NO directive leak.

- **T2.4** · Implement `validateNoAggregateStatLeakage` with fail-loud + allowlist + production-restricted warn-mode escape (NFR-9 V1 FINAL · per Flatline-Sprint SKP-003 HIGH 730 + IMP-011/IMP-013)
  - Files: `packages/persona-engine/src/persona/validate-no-aggregate-stat-leakage.ts` (NEW) + `packages/persona-engine/src/persona/fixtures/factor-name-allowlist.json` (NEW) + `packages/persona-engine/src/persona/scripts/sync-factor-allowlist.ts` (NEW)
  - LOC: ~+130
  - Acceptance: (a) regex tightened (`\brank[ -]?\d+\b` not `\brank\b`); (b) allowlist seeded from production score-mcp factor catalog via `sync-factor-allowlist` script · operator reviews diff at S2 fixture time · stored at `fixtures/factor-name-allowlist.json`; (c) **`LOA_STAT_LEAKAGE_GUARD=warn` is REJECTED in production** — config validator detects `NODE_ENV=production` (or Railway-set env signal) AND `LOA_STAT_LEAKAGE_GUARD=warn` → process exits with code 78 + stderr `[NFR-9] FATAL: warn-mode forbidden in production`; warn-mode allowed only in dev/CI/test; (d) **warn-mode test scenarios**: assert that toggling `LOA_STAT_LEAKAGE_GUARD=warn` in dev downgrades fail-loud to log-only, AND that toggling it in mock-production fails with exit 78; (e) default (unset) fails with `BuildPromptError({kind: 'aggregate-stat-leakage'})`.

- **T2.5** · Convert `buildPrompt` signature to `Effect.Effect<BuildPromptResult, BuildPromptError, never>` · Effect.gen body
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+60 / -40
  - Acceptance: 7-step pipeline implemented (load template · validate cron args · validate stat-leakage · resolve fragment · substituteAndRecord (PASS 1) · append cron suffixes · recoverOffsets (PASS 2) · validate FR-15a invariants)

- **T2.6** · Migrate native throws at loader.ts:108/281/414 to `Effect.fail(BuildPromptError({...}))`
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+10 / -10
  - Acceptance: zero `throw new Error` in loader.ts (lint check) · all error paths via Effect.fail

- **T2.7** · Update `buildPromptPair` + `buildReplyPromptPair` as sync shims (`Effect.runSync`)
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+15 / -10
  - Acceptance: smoke scripts (4 in apps/bot/scripts/) work unchanged · throws synchronously on BuildPromptError

- **T2.8** · Migrate `compose/reply.ts:206` from `buildReplyPromptPair` to direct `Effect.runPromise(buildPrompt(...))`
  - File: `packages/persona-engine/src/compose/reply.ts`
  - LOC: ~+15 / -5
  - Acceptance: chat-mode reply path uses Effect-shaped call · `BuildPromptError` propagates through promise rejection

- **T2.9** · Add equivalence + negative + smoke test scenarios (S2 acceptance matrix)
  - File: `packages/persona-engine/src/persona/loader.test.ts`
  - LOC: ~+250
  - Acceptance: All 10 test scenarios pass (1-4 cron normalize · 5 chat byte-identical · 6 marker injection survives · 7-8 negative missing-args · 9 E2E smoke · 10 chat before/after fixture)

### S2 acceptance gates

- `bun test packages/persona-engine/src/persona/loader.test.ts` green
- `bun run typecheck` clean
- Chat-mode regression fence: `expect(buildPrompt(args_for_reply))` byte-identical to pre-cycle-008 baseline fixture at `packages/persona-engine/src/persona/fixtures/chat-mode-baseline-pre-c008.txt`
- LOCK suffix appended for `shape.kind === 'cron'` · NEVER for `shape.kind === 'reply'` (assertion in T2.9)
- All BuildPromptError emit categorized (INPUT/STRUCTURAL/INVARIANT-VIOLATION)

---

## 5 · S3 · Cron orchestrator migration + flag + score-mcp schema gate [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-24
**Estimate**: 1 day
**Risk tier**: MEDIUM (RF-002 source-swap depends on unverified score-mcp field name)
**Depends on**: S2 (Effect-shaped buildPrompt) + score-mcp schema verification

### Tasks

- **T3.0** · **Adopt `@0xhoneyjar/score-api-types@0.6.0` (type-only)** → **[G-10]** (FR-43 · amendment 2026-05-22 · Fork D→D1 · runs BEFORE T3.1)
  - Files: `apps/bot/package.json` (or `packages/persona-engine/package.json`) add devDep + `packages/persona-engine/src/score/types.ts` (verified **613 LoC** at amendment time · NOT 206) + imports into `packages/persona-engine/src/ports/score-fetch.port.ts` (verified path under `ports/`, NOT `score/`)
  - LOC: ~+30 / -120 net (delete-leaning — hand-roll types replaced by `import type`)
  - Acceptance: (a) `bun add -D @0xhoneyjar/score-api-types@0.6.0` resolves; (b) **type-only** adoption (`import type` — zero runtime, no zod loaded); (c) data shapes import INTO the existing local `score-fetch.port.ts`; (d) `MostActiveWalletEntry` stays LOCAL (not in package until cycle-029); (e) names in >1 entity (e.g. `DimensionSummary`) are **deep-import only** (`@0xhoneyjar/score-api-types/entities/<name>`), NOT the flat root barrel; (f) `bun run typecheck` green after swap; (g) package JSON Schema (`/json/<entity>.v1.json`) noted for T3.1 to consume as its verification source.
  - **Runs BEFORE T3.1** so the schema-verification gate validates against the package schema instead of hand-sampling.

- **T3.1** · **score-mcp schema CONTRACT verification gate** (Flatline IMP-001 + SKP-001 CRITICAL 880 + SKP-004 HIGH 710 + Flatline-Sprint IMP-002 880 · pre-implementation)
  - Files: read score-mcp schema/types (no edits) + write verification report + fixture tests
  - LOC: ~+80 (test fixtures) · report at `grimoires/loa/cycles/cycle-008-persona-substrate/s3-schema-verification.md`
  - Acceptance: (a) confirm `ZoneDigest.factor_trends[]` (or equivalent unfiltered field) exists in score-mcp TypeScript types/schema (NOT just representative-zone sampling); (b) shape contract validated · `array<{displayName: string, ...}>` types match; (c) fixture coverage for: empty zone (factor_trends=[]), missing zone (factor_trends=undefined OR field absent), null factor_trends, normal zone with N factors, hostile factor name (injection attempt); (d) semantic equivalence test: `factor_trends[].displayName ⊇ permittedFactors[].displayName` across ALL 4 zones (not just representative).
  - **BLOCKS** subsequent S3 tasks until report attests OR T3.1a executes
  
- **T3.1a** · **Fallback design spike** (NEW · conditional · per Flatline-Sprint SKP-001 CRITICAL 860 + IMP-002 880)
  - Conditional task: ONLY executes if T3.1 returns NEGATIVE on any acceptance criterion
  - File: `grimoires/loa/cycles/cycle-008-persona-substrate/s3-fallback-design.md` (NEW)
  - LOC: ~+150 design doc
  - Acceptance: 1-page design enumerating: (a) request new score-mcp field via PR to score-mcp repo · (b) alternative unfiltered source already in ZoneDigest (operator names which) · (c) cycle-008 scope cut (revert RF-002 · keep cycle-005 gate consumption · NFR-9 still ships). Operator decides BEFORE T3.3 starts. If chosen path = cycle-008 scope cut → ledger.json cycle-008 status flips to `blocked` (NEW status semantic) · cycle pauses until operator unblocks. Other paths proceed to T3.3 with documented alternative source.

- **T3.2** · Add `LOA_PROMPT_BUILDER` flag to config with parse rules
  - File: `packages/persona-engine/src/config.ts`
  - LOC: ~+25
  - Acceptance: `parsePromptBuilder(raw)` returns 'canonical' only on literal 'canonical' string · everything else returns 'legacy' + stderr warning · unit tests for each branch ('canonical'/'legacy'/unset/empty/'Canonical'/'cannonical'/'  canonical  ')

- **T3.3** · Migrate `generateDigestVoice` in `claude-sdk.live.ts` from `buildVoiceBrief` to `buildPrompt` with defensive null-handling
  - File: `packages/persona-engine/src/live/claude-sdk.live.ts`
  - LOC: ~+45 / -25
  - Acceptance: (a) cron call-site uses Effect.runPromise wrapper + Effect.tapError for BuildPromptError; (b) source is `ctx.zoneDigest.factor_trends` (verified T3.1) · NOT `ctx.derived.permittedFactors`; (c) **null-coalescing required** (per Flatline-Sprint SKP-001 CRITICAL 820) — `const factorList = ctx.zoneDigest?.factor_trends ?? [];` followed by type-guard `if (!Array.isArray(factorList)) { Effect.fail(...) }`; (d) maps BuildPromptError category to span event + halt-this-fire (no retry); (e) trace emit on error path with redaction.

- **T3.4** · Mark `voice-brief.ts` as `@deprecated`
  - File: `packages/persona-engine/src/compose/voice-brief.ts`
  - LOC: ~+5
  - Acceptance: JSDoc `@deprecated cycle-008 S3 · retire in cycle-009 · use buildPrompt directly` · type-check passes (other test files still importable)

- **T3.5** · Add CI workflow assertion: `LOA_PROMPT_BUILDER=canonical` required in dev/CI
  - File: `.github/workflows/test.yml` (or equivalent CI config)
  - LOC: ~+10
  - Acceptance: CI fails if LOA_PROMPT_BUILDER unset OR set to anything other than 'canonical' · production env-stratification preserved

- **T3.6** · Implement FR-13a non-digest cron post-type compatibility tests
  - File: `packages/persona-engine/src/persona/loader.test.ts`
  - LOC: ~+120
  - Acceptance: 5 tests (micro · weaver · lore_drop · question · callout) · each invokes buildPrompt with empty `activeFactors[]` + undefined `priorWeekHint` · all succeed with `factors with activity:\n  (none)` in systemPrompt · OR explicit removal of the post type from `outputInstruction` + PostType enum + persona.md fragments (operator decision per `project-cron-post-types-pruning`)

- **T3.7** · **OP-G2 live voice attestation** (HARD operator-paced gate)
  - Operator runs `LOA_PROMPT_BUILDER=canonical bun run --cwd apps/bot digest:once` × 4 zones via `railway run`
  - Acceptance per PRD §7: zero kebab-form zone IDs · zero em-dashes · zero spelled-aggregate numbers · digits as digits · no aggregate-stat citation in any of 4 zone outputs
  - REMEDIATION if FAIL: roll back LOA_PROMPT_BUILDER to 'legacy' · file regression in cycle-008 issue tracker with failing trace row · halt cycle close · loop back to T3.3 root-cause

- **T3.8** · **Cadence-honest data surface** → **[G-10]** (FR-38 · amendment 2026-05-22 · Fork A: separate data-read from voice as independently-tweakable surfaces)
  - Files: `packages/persona-engine/src/live/discord-render.live.ts` (`buildSubstrateFacts`/`renderMicro`) + `packages/persona-engine/src/compose/voice-memory.ts` (per-zone state read for "since last" delta) + new fixture in `evals/snapshots/`
  - LOC: ~+70
  - Acceptance: (a) card hero shows a fresh **"since last post" delta** computed from `voice-memory.ts` per-zone state; (b) **licensing/factor-density logic unchanged** — still 30d (`live/score-mcp.live.ts:164,195` per cycle-005 r4); (c) **two-clocks closed** — digest (`PULSE_WINDOW_DAYS=7` · `digest-orchestrator.ts:36`) + micro (`windowDays=30`) report the SAME clock; (d) 30d figure, if shown, labeled rolling context (clearly secondary); (e) type-guard fallback — missing per-zone state degrades headline to 30d-rolling-labeled (never a wrong fresh number); (f) byte-snapshot regression fixture in `evals/snapshots/`.
  - Note: the voice-half (ruggy citing aggregate stats in prose) is already covered by S3's buildPrompt migration + stats-out-of-voice. T3.8 is ONLY the card/data surface.

- **T3.9** · **Two-beat billboard renderer** → **[G-10]** (FR-39 · amendment 2026-05-22 · LOCKED SPEC brief §7.5 · Fork B billboard reframe · two-beat won `preference-log.jsonl`)
  - File: `packages/persona-engine/src/live/discord-webhook.live.ts` (`plainToPayload` at `:30` currently joins voice+facts into one message)
  - LOC: ~+90
  - Acceptance: (a) delivery emits **two sequential Pattern-B webhook sends** (neither pings on pop-in/digest cadence); (b) **Beat 1 — the agent** (`voiceContent`): 1–2 short lowercase lines, ZERO numbers (stats-out-of-voice); (c) **Beat 2 — the billboard** (`truthFields`): zone header + cadence-honest data (FR-38 "since last" hero + 30d-rolling secondary + wallets warm + state), rendered as **bold text with U+2007 FIGURE-SPACE column alignment** (technique proven `live/discord-render.live.ts:54` `metrics.digitWidthSpaceChar`), NOT a code block (code blocks ignore `**bold**`; bold was the explicit ask); (d) `message.content` ALWAYS populated (Discord-as-Material fallback); (e) underscore-escape preserved (`deliver/sanitize.ts`); (f) byte-snapshot fixture in `evals/snapshots/`.
  - **Open micro-decisions deferred to S9 preview surface (do NOT block T3.9)**: keep `30d rolling` row at all · exact label wording · separator between beats · all-quiet vs active register.
  - **Craft flag to push back on**: bold-figure-space depends on figure-space rendering (validated cycle-007 S3); code-block would be bulletproof-monospace but un-bold. Recommendation stands on bold because bold was the explicit ask.

### S3 acceptance gates

- All cycle-007 lint suite green (`bun run lint:cycle-007`)
- `bun test` 1068+ baseline maintained
- T3.0 typecheck green after score-api-types swap (FR-43)
- T3.1 verification report attests score-mcp field availability
- T3.8 cadence-honest data surface byte-snapshot fixture green (FR-38)
- T3.9 two-beat billboard byte-snapshot fixture green + `message.content` fallback verified (FR-39)
- OP-G2 PASS attestation in NOTES.md or PR comment

---

## 6 · S4 · Trace schema v2 + fragment_sources[] + redaction architecture [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-25
**Estimate**: 1 day
**Risk tier**: MEDIUM (two-pass offset correctness · lock atomicity)
**Depends on**: S2 (buildPrompt populates fragment_sources[])

### Tasks

- **T4.1** · Extend `LlmTraceEntry` interface with v2 fields (schema_version, fragment_sources, outcome, error_classification)
  - File: `packages/persona-engine/src/observability/trace-envelope.ts`
  - LOC: ~+40
  - Acceptance: TypeScript shape matches §2.5 of SDD · `schema_version: 2` literal type

- **T4.2** · Implement two-pass offset recovery using **ephemeral cryptographic markers** (per Flatline-Sprint SKP-004 HIGH 720 + SKP-003 HIGH 760 · 2026-05-18 supersedes brittle string-matching)
  - File: `packages/persona-engine/src/persona/loader.ts`
  - LOC: ~+90
  - Acceptance: (a) PASS 1 injects each fragment with a unique sentinel marker pair: `FRAG-START:${uuid}${fragment}FRAG-END:${uuid}`. The markers use ASCII SOH (0x01) bytes which (i) cannot appear in legitimate prompt content (substrate sanitization strips C0/C1) (ii) are unique per fragment via uuid (no false matches across substitutions or cron-suffix collisions); (b) PASS 2: scan final prompt for sentinel pairs, record offsets, then STRIP the sentinels before returning systemPrompt (the sentinels never reach the LLM); (c) `template_region: [start, end]` recorded for the post-substitution prompt — fragment_sources offsets MUST fall within template_region (NOT inside userMessage or appended cron suffixes) · FR-15a invariant addition; (d) negative test: userMessage contains coincidental fragment-text lookalike → recoverOffsets generates NO fragment_source for it (template_region boundary check); (e) negative test: cron suffix contains string fragment matching persona fragment → sentinel-uuid uniqueness prevents false attribution; (f) fail loud with `BuildPromptError({kind: 'fragment-sources-invariant-violation', detail: 'sentinel-pair-mismatch'})` if any PASS 1 fragment doesn't recover in PASS 2.

- **T4.3** · ~~Implement FR-15a invariant validation~~ MOVED to S2 T2.3a per Flatline-Sprint IMP-001 dependency-fix 2026-05-18
  - (Original task obsolete. Function implementation lives in S2 where it's first consumed by buildPrompt. S4 inherits the function for downstream test fixtures + dashboard rendering · zero S4-specific implementation work.)

- **T4.4** · Bump ajv schema v1 → v2 for trace-explain-output
  - File: `.claude/overrides/trace-explain-output.schema.json`
  - LOC: ~+30 (additive)
  - Acceptance: `schema_version: { const: 2 }` · optional fragment_sources array with items conforming to FragmentSource interface · outcome enum · error_classification optional · existing readers tolerate (extra fields ignored)

- **T4.5** · Move redaction INTO `appendTraceEntry` (unconditional, per Flatline SDD SKP-004 CRITICAL 850 + Flatline-Sprint SKP-002 HIGH 760 redaction-aware offsets)
  - File: `packages/persona-engine/src/observability/trace-envelope.ts`
  - LOC: ~+45
  - Acceptance: (a) `appendTraceEntry` redacts system_prompt + user_message + output + error_classification.redacted_message BEFORE schema validation + write · callers cannot skip redaction; (b) **fragment_sources offsets are computed AGAINST REDACTED PROMPT** (not raw) — fragment_sources stored in trace row MUST map to the system_prompt field as stored (post-redaction) so trace:explain highlights match what reviewer sees; (c) offset recovery happens AFTER redaction · buildPrompt returns raw + redacted versions for downstream; (d) test scenarios 41-46 prove raw secrets cannot reach .jsonl · scenario 47 NEW: assert fragment_sources[N].prompt_offset[0..1] correctly indexes into the REDACTED system_prompt string of the same trace row.

- **T4.6** · Implement trace rotation with atomic **mkdirSync-based** lock pattern (per Flatline IMP-004 + SKP-002 HIGH 750 + Flatline-Sprint SKP-002 HIGH 780 EXDEV-cross-filesystem · 2026-05-18 supersedes fs.linkSync)
  - Files: `packages/persona-engine/src/observability/trace-rotation.ts` (NEW) + `packages/persona-engine/src/observability/trace-envelope.ts`
  - LOC: ~+90
  - Acceptance: (a) atomic acquire via `fs.mkdirSync(lockPath, { recursive: false })` — mkdir is atomic AND cross-filesystem-safe (works on Railway containers where temp/log volumes can be different mounts). NOT `fs.linkSync` (throws EXDEV across mount points). NOT `fs.openSync('wx')` (non-atomic with subsequent writeSync). The lock is a *directory* not a file; existence-test = directory-stat. (b) PID stored in `{lockPath}/owner.txt` via separate write inside the directory (non-atomic but okay because directory existence already atomic-locked); (c) stale-detection only on ESRCH from process.kill (not on empty/malformed reads); (d) max-wait policy: 30 retries × 50-150ms backoff · fallback `append-without-rotation` after 30 retries with stderr warning · OTel span event `trace.lock.fallback`; (e) concurrency test (2 processes near rotation threshold) verifies both writes succeed + exactly one rotation; (f) cross-filesystem fixture test simulating EXDEV scenario (mock fs.linkSync to throw EXDEV) confirms mkdirSync path stays green.

- **T4.7** · Extend `scripts/trace.ts trace:explain` to render source-map
  - File: `scripts/trace.ts`
  - LOC: ~+25
  - Acceptance: `bun run trace:explain --line N` outputs fragment_sources[] as human-readable source-map under the prompt · groups by layer · shows source_file:source_lines + prompt_offset range

- **T4.8** · Extend `scripts/dashboard.ts` LLM-calls tab with fragment_sources breadcrumbs
  - File: `scripts/dashboard.ts`
  - LOC: ~+60
  - Acceptance: breadcrumb rendered per fragment_source · click opens vscode://file/<absolute-path>:<line> · breadcrumb chip color follows cycle-007 INV-10 oklch palette (substrate cool-blue · voice warm-gold · etc.) · reserved space (no content-shift on update)

### S4 acceptance gates

- `bun test` green (new redaction tests + invariant tests + rotation concurrency test)
- `bun run trace:explain --latest` renders source-map for any cron trace
- Dashboard LLM-calls tab shows breadcrumbs · click works
- ajv schema v2 validates at-rest · readers handle both v1 + v2 rows

---

## 7 · S5 · Anthropic-SDK trace capture + outcome classification + stream hooks [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-26
**Estimate**: ½ day
**Risk tier**: LOW (well-located insertion site · pattern mirrors bedrock-direct)

### Tasks

- **T5.1** · Wrap `agent-gateway.ts::invokeAnthropicSdk` (line 147) in `tracer.startActiveSpan('anthropic.sdk.converse')`
  - File: `packages/persona-engine/src/compose/agent-gateway.ts`
  - LOC: ~+15
  - Acceptance: span structure mirrors bedrock-direct path (line 201) · `outcome` attribute set

- **T5.2** · Implement outcome classification (success/timeout/provider-error/malformed-response/sdk-exception)
  - File: `packages/persona-engine/src/compose/agent-gateway.ts` + `packages/persona-engine/src/observability/error-classify.ts` (NEW)
  - LOC: ~+50
  - Acceptance: each outcome class distinguishable via type-guard · classification logic isolated for unit-testing

- **T5.3** · Stream-completion hook detection + bounded awaiting (Flatline SDD SKP-003 750 + Flatline-Sprint SKP-003 HIGH 750 IMP-006 805 · timeout requirement)
  - File: `packages/persona-engine/src/compose/agent-gateway.ts`
  - LOC: ~+50
  - Acceptance: (a) `isStreamingResponse` detects AsyncIterable shape; (b) `awaitStreamComplete` consumes events until `message_stop` OR absolute max-duration timeout (default 60s · operator-tunable via `LOA_SDK_STREAM_TIMEOUT_MS`); (c) timeout uses `Promise.race` with an AbortController-cancelled timer · NOT setTimeout-callback (which leaks if the promise resolves first); (d) on timeout: emit trace row with `outcome: 'timeout'` + span forcefully closed + AsyncIterable iterator closed via `for-await` early-break; (e) test scenario: mock streaming AsyncIterable that never emits `message_stop` · verify span closes within 60s + 1 second tolerance · verify trace row outcome='timeout'.

- **T5.4** · Emit trace row for ALL outcomes (success + failure paths · per Flatline SDD SKP-004)
  - File: `packages/persona-engine/src/compose/agent-gateway.ts`
  - LOC: ~+30
  - Acceptance: try/catch/finally pattern · finally block always calls `appendTraceEntry` · success outcome carries response data · failure outcomes carry `error_classification` with redacted_message · NO stack traces or credentials in trace

- **T5.5** · Add S5 test scenarios (5 outcome classes)
  - File: `packages/persona-engine/src/compose/agent-gateway.test.ts` (extend) + `packages/persona-engine/src/observability/error-classify.test.ts` (NEW)
  - LOC: ~+150
  - Acceptance: 5 mock scenarios (success · provider-error 500 · timeout via AbortController · malformed-response · sdk-exception) · each asserts correct trace `outcome` field + redacted error if applicable

- **T5.6** · Verify chat-mode + /ruggy slash-command both produce trace rows
  - Manual operator test or fixture-based scripted verification
  - Acceptance: `/ruggy <prompt>` produces llm-trace row · chat-mode reply produces llm-trace row · both have fragment_sources[] (since they go through buildPrompt post-S2)

### S5 acceptance gates

- `bun test` green (new agent-gateway tests + error-classify tests)
- All 5 outcome classes covered by tests
- Stream completion verified (mock streaming AsyncIterable)
- Anthropic-SDK invisibility gap closed (chat-mode + cron-via-SDK both trace)

---

## 8 · S6 · /tweak Tweakpane kitchen tab + layered enforcement [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-27
**Estimate**: 1 day
**Risk tier**: MEDIUM (new dep + UI + 3-layer auth)

### Tasks

- **T6.1** · Add `tweakpane@^4.x` dep to `apps/bot/package.json`
  - LOC: ~+1
  - Acceptance: `bun install` succeeds · no peer-dep conflicts

- **T6.2** · Implement `/tweak` tab in `scripts/dashboard.ts` with 5 layer folders
  - File: `scripts/dashboard.ts`
  - LOC: ~+250
  - Acceptance: PERSONA · VOICE · TOOL · MEDIUM · ENVIRONMENT folders rendered with cycle-007 INV-10 oklch left-borders · controls per SDD §3.9 (character picker · MCP toggles · seed slider · etc.) · localStorage persistence

- **T6.3** · Implement `POST /api/playground/fire` endpoint with layered enforcement (Flatline SDD SKP-008)
  - File: `scripts/dashboard.ts` (or `apps/bot/src/api/playground.ts` · operator decides location)
  - LOC: ~+120
  - Acceptance: (a) listens on 127.0.0.1 only · (b) requires Authorization: Bearer LOA_DASH_AUTH · (c) returns 404 unless LOA_TWEAKPANE_ENABLED=1 · (d) response prompts/output redacted via redactPromptForTrace before serialization · returns 401 on bad bearer · returns 404 on disabled

- **T6.4** · Implement `--tweak <json>` flag in `apps/bot/src/cli/playground-fire.ts`
  - File: `apps/bot/src/cli/playground-fire.ts`
  - LOC: ~+30
  - Acceptance: tweak JSON parsed + applied as per-fire overrides · invalid JSON exits with clear error · empty `--tweak '{}'` is no-op

- **T6.5** · Implement result panel rendering with source-map breadcrumbs
  - File: `scripts/dashboard.ts`
  - LOC: ~+80
  - Acceptance: live-fire result includes Discord embed preview · source-map breadcrumbs (reused S4 component) · 200ms fade-in on new fire · NO content-shift (reserved space)

- **T6.6** · Implement preset export/import (JSON)
  - File: `scripts/dashboard.ts`
  - LOC: ~+30
  - Acceptance: "Export preset" button serializes current tweakpane state to JSON · "Import preset" applies a pasted JSON

- **T6.7** · **OP-G3 tweakpane teachability** (HARD operator-paced gate · also satisfies cycle-007 PP-4-reframed)
  - Operator runs ≥15 min `/tweak` session · ≥5 distinct tweaks (slider drag → fire → observe → adjust) · attests "faster than file-edit-restart"
  - Acceptance: written attestation in NOTES.md or PR comment
  - REMEDIATION if FAIL: <15 min session → schedule second · loop-slow attestation → open `s6-tweakpane-ergonomics` cycle-009 issue · cycle-008 still closes (G-6 minimum-viable already met)

### S6 acceptance gates

- `bun install` clean (tweakpane v4 added)
- Dashboard renders /tweak tab without console errors
- 3-layer enforcement verified: localhost-only · LOA_DASH_AUTH bearer · LOA_TWEAKPANE_ENABLED env gate
- Response redaction verified via curl + grep
- OP-G3 attestation in NOTES.md

---

## 9 · S7 · middot-detector + sanitize-violations integration [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-28
**Estimate**: ½ day
**Risk tier**: LOW (additive · log-only V1)

### Tasks

- **T7.1** · Implement `detectAiArtifacts(text, postType)` returning `AiArtifact[]`
  - File: `packages/persona-engine/src/deliver/sanitize.ts`
  - LOC: ~+80
  - Acceptance: 4 heuristics (middot-density · spelled-number · em-dash · hyphenated-compound stub for V2) · returns array of `{kind, sample, position?}` violations · log-only (NOT autocorrect)

- **T7.2** · Wire detection to `.run/sanitize-violations.jsonl` (existing cycle-007 infrastructure)
  - File: `packages/persona-engine/src/deliver/sanitize.ts`
  - LOC: ~+15
  - Acceptance: each detected artifact emits a row to sanitize-violations.jsonl with kind + sample + timestamp · existing infrastructure unchanged

- **T7.3** · Extend dashboard sanitize-violations tab with new artifact kinds
  - File: `scripts/dashboard.ts`
  - LOC: ~+30
  - Acceptance: middot-density / spelled-number / em-dash rows render with sample text · artifact-kind label badge · cycle-007 INV-10 palette compliance

- **T7.4** · Add fixture tests for each heuristic
  - File: `packages/persona-engine/src/deliver/sanitize.test.ts`
  - LOC: ~+60
  - Acceptance: 4+ test fixtures (one per artifact kind · plus negative cases) · each asserts correct AiArtifact returned · log-only behavior verified (no exception thrown)

### S7 acceptance gates

- `bun test packages/persona-engine/src/deliver/sanitize.test.ts` green
- Sanitize-violations tab in dashboard renders new artifact kinds
- Real digest fires emit artifact rows when applicable (manual verify)

---

## 10 · S8 · Cycle close + cycle-007 pair-points absorption + vault doctrine [PLANNED]

**Status**: PLANNED
**Global sprint #**: sprint-29
**Estimate**: ½ day mechanical + operator-paced ceremony
**Risk tier**: MEDIUM (operator-paced timing for attestations)

### Tasks

- **T8.1** · Author `~/vault/wiki/concepts/persona-as-substrate.md` vault doctrine page
  - File: `~/vault/wiki/concepts/persona-as-substrate.md` (NEW)
  - LOC: ~+200-400 (operator-paced authoring)
  - Acceptance: doctrine page anchors to ACVP + chat-medium-presentation-boundary + freeside-modules-as-installables + damp-as-default-voice-substrate + themes-vs-personas-clean-separation + substrate-over-narrative · includes teachable-moments from BB PR-001..004 + SP-001 fragment_sources bidirectional UX vision + SP-002 CSS-preprocessor pattern · operator-attestation that page is publishable

- **T8.2** · Author `grimoires/loa/cycles/cycle-008-persona-substrate/COMPLETED.md`
  - File: `grimoires/loa/cycles/cycle-008-persona-substrate/COMPLETED.md` (NEW)
  - LOC: ~+400
  - Acceptance: structure per cycle-006/007 precedent · all 9 invariants enumerated · all 9 goals attested · all 37 FRs + 9 NFRs status · 4-round-reframe audit trail · explicit section acknowledging **cycle-007-pair-points-absorption trade** (per BB-RF-003 accept-minor)

- **T8.3** · **PP-5 absorbed · production canary mobile screenshot FIRST** (HARD operator-paced · ordering revised per Flatline-Sprint SKP-004 HIGH 740 · 2026-05-18)
  - **REORDERED**: PP-5 mobile attestation NOW runs BEFORE prod default flip + ledger flip. Sequencing: T8.3 PP-5 → T8.4 prod flip → T8.5-T8.7 ledger + COMPLETED.md. Reason: a cycle that has flipped to candidate status AND authored COMPLETED.md, then discovers a production regression via mobile screenshot, has no clean revert mechanism. PP-5 FIRST = atomic gate.
  - Operator fires digest cron via railway run + screenshots Discord Android (one per zone × 4 zones)
  - Acceptance: 4 screenshots showing (1) zone header proper-cased · (2) numeric column alignment on figure-space · (3) voice line free of cycle-008 artifacts · attached to cycle-008 close PR
  - REMEDIATION if FAIL: roll back `LOA_PROMPT_BUILDER` to 'legacy' in production (env change · no code commit) · file regression in cycle-008 issue tracker · cycle-008 status stays 'active' (NOT advanced to candidate) · loop back to T3.3 root-cause OR scope-cut decision · NO ledger flip · NO COMPLETED.md commit until clean PP-5 PASS

- **T8.4** · **Flip `LOA_PROMPT_BUILDER` default from 'legacy' → 'canonical' in prod** (post PP-5 PASS · gated by T8.3)
  - File: `packages/persona-engine/src/config.ts`
  - LOC: ~+2 / -2
  - Acceptance: production default changes to 'canonical' · cycle-007 lint suite + cycle-008 lint suite still green · prod flip commit lands BEFORE T8.6 ledger flip
  - **Rollback procedure** (per Flatline-Sprint IMP-012 820 accept · 2026-05-18): if post-flip regression discovered (e.g., subsequent mobile canary fails OR production trace shows artifact): (1) revert this commit · (2) revert T8.6 ledger flip if landed · (3) cycle-008 status reverts to 'active' OR new status 'rollback-pending' added · (4) operator-paced re-attestation OR scope-cut decision. NO ledger archive flip until rollback decision settled.

- **T8.5** · **Absorbed PP-2 + PP-3** (SOFT · roll into PP-5 + OP-G3 sessions)
  - Acceptance: PP-2 verified inside PP-5 screenshot session · PP-3 4-color encoding teachability verified inside OP-G3 /tweak session

- **T8.6** · **GitHub branch protection absorbed** (operator-UI)
  - Operator adds CODEOWNERS-required rule on: `.claude/overrides/voice-prompt-paths.json` + `voice-prompt-paths.schema.json` + `trace-explain-output.schema.json`
  - Acceptance: screenshot of GitHub Settings → Branches rule in cycle-008 close PR comment

- **T8.7** · **BB round 3** post-PR review via `/bridgebuilder --pr <N>` (operator-paced · external session · BEFORE ledger flip per Flatline-Sprint SKP-004 ordering)
  - Acceptance: APPROVED or PRAISE-only as close bar · 1 CRITICAL+ blocks close until addressed · operator-paced timing · MUST PASS before T8.8 fires

- **T8.8** · `grimoires/loa/ledger.json` flips (LAST · after all attestations + BB-3 PASS · per Flatline-Sprint SKP-004 HIGH 740 ordering)
  - File: `grimoires/loa/ledger.json`
  - LOC: ~+5 / -3
  - Acceptance: cycle-008 status active → candidate · cycle-007 status candidate → archived · cycle-007 archived_at timestamp added · `next_sprint_number` advances 21 → **31** (was 30 · amendment 2026-05-22 adds S9 = global sprint-30, so close advances past it) · S9 included in the close sweep · commit lands as FINAL cycle-008 close PR commit · ALL upstream gates (S9 OP-G4 · T8.3 PP-5 PASS · T8.4 prod flip · T8.5 PP-2/3 · T8.6 branch protection · T8.7 BB-3 PASS) cleared FIRST
  - **Registration-gap reconciliation (amendment 2026-05-22)**: cycle-008 S0–S8 were never registered in `ledger.json` `cycles[].sprints[]` and no beads epics existed at amendment time. The amendment registers ALL of cycle-008 (S0–S9) in the ledger `sprints[]` array + creates beads epics. T8.8 is the final flip on top of that now-complete registration.

### S8 acceptance gates

- COMPLETED.md authored + lessons distilled
- vault doctrine published
- LOA_PROMPT_BUILDER prod default = 'canonical'
- All operator-paced attestations cleared (OP-G2 · OP-G3 · PP-5 · PP-2/3 absorbed · branch protection · BB-3)
- ledger.json flips committed
- BB-3 APPROVED or PRAISE-only

---

## 10b · S9 · RLHF preference loop · billboard-preview-first lead slice [PLANNED · amendment 2026-05-22]

**Status**: PLANNED (added by amendment 2026-05-22 · `amendment-voice-fidelity-gaps.md` status: active)
**Global sprint #**: sprint-30 (next after cycle-008's sprint-21..29 · close-gate now advances `next_sprint_number` 21→31)
**Estimate**: ~1½ days (FR-41 ~1d UI+persist · FR-40 ~¼d fan-out · FR-42 ~½d promote-to-evals)
**Risk tier**: MEDIUM (new preview UI + JSONL persistence + fidelity-parity with production render)
**Depends on**: S5 (trace-row shape for candidate capture) · S6 (`--tweak` CLI + dashboard surface + INV-10 oklch + embed preview reused) · S3 T3.9 (the two-beat render path that the preview must mirror at fidelity)
**Sequencing note**: per amendment §7.3/§7.6, the **preview surface is the FIRST thing S9 ships** — it's the instrument that unblocks the FR-38/39 craft work (which lands *through* it with side-by-side evidence). S9 executes BEFORE S8's close ceremony (ledger flip / COMPLETED.md) despite holding the highest global sprint number; S8 T8.8 must account for S9 in the close sweep.

### Tasks

- **T9.1** · **Billboard preview surface (the lead slice · iteration-speed unlock)** → **[G-10]** (FR-41 core)
  - File: `scripts/dashboard.ts` (new preview view · reuses S6 T6.5 embed-preview component + INV-10 oklch palette)
  - LOC: ~+180
  - Acceptance: (a) renders any **zone + state + snapshot** in N candidate presentations **side-by-side at Discord fidelity** — real bold, ~40-char mobile wrap, webhook avatar; (b) reuses the SAME `plainToPayload`/figure-space render path as production (FR-39) — NOT a re-implementation (one render function, two callers); (c) renders against the real owsley-lab snapshot shape (`events_30d` · `since_last` · `active_wallets` · state) per `preference-log.jsonl` reference record; (d) localhost-bound + LOA_DASH_AUTH bearer (cycle-007 INV-16) + LOA_TWEAKPANE_ENABLED gate (inherits S6 3-layer enforcement).

- **T9.2** · **Generate-N candidate fan-out** → **[G-10]** (FR-40 · capture)
  - File: `apps/bot/src/cli/playground-fire.ts` (extend S6's `--tweak <json>` into `--fire-n <N>`)
  - LOC: ~+60
  - Acceptance: (a) `--fire-n N` renders the SAME input in N candidates varying seed and/or a named format-fragment variant in ONE action; (b) each candidate captured as an S5-shaped trace row (`outcome` classified per T5.2) grouped by a `batch_id`; (c) first slice targets layout/format (billboard look), voice variance is a follow-on flag; (d) `--fire-n 1` is equivalent to the existing single-fire (backward compatible).

- **T9.3** · **Pick + annotate → preference record** → **[G-10]** (FR-41 · elicitation + persistence)
  - File: `scripts/dashboard.ts` (pick/rank + annotation UI) + `grimoires/loa/cycles/cycle-008-persona-substrate/preference-log.jsonl` (append target · verified present · schema `rlhf-preference-v0`)
  - LOC: ~+90
  - Acceptance: (a) operator picks a winner OR ranks the batch + writes a free-text annotation; (b) record appended to `preference-log.jsonl` matching the existing `rlhf-preference-v0` schema (`{ts, loop, zone, state, snapshot, candidates[], chosen, ranking, annotation, elicited_by, operator, schema}`); (c) records structured as preference-pairs/rankings (RLHF-ready) not just "winner picked"; (d) mirrors `compose/voice-memory.ts` zero-infra JSONL pattern (no DB · per CLAUDE.md "Don't do: add a database").

- **T9.4** · **Backpressure — promote winner to eval set** → **[G-10]** (FR-42 · the close)
  - File: `evals/snapshots/` (verified dir · promote target) + a small promote script (`scripts/promote-preference.ts` or equivalent)
  - LOC: ~+70
  - Acceptance: (a) a picked+annotated winner promotes to `evals/snapshots/` as a byte-snapshot golden case (the existing regression substrate FR-38/39 fixtures live in); (b) annotations accumulate as a labeled corpus; (c) the next prompt/format edit is validated against the operator's own past picks (regression signal); (d) corpus structured for the cycle-009 LLM-as-judge to consume (Fork C → C3 · judge bootstrapped from picks · NOT built this cycle).

- **T9.5** · **S9 tests** → **[G-10]**
  - File: preference-persistence + batch-grouping + promote-to-evals test files (locations per implementer)
  - LOC: ~+140
  - Acceptance: (a) batch grouping by `batch_id` tested; (b) preference record append validates against `rlhf-preference-v0` schema; (c) promote-to-evals writes a valid `evals/snapshots/` fixture; (d) fidelity-parity test: preview render === production `plainToPayload` render for the same input (no divergence).

- **T9.6** · **OP-G4 end-to-end RLHF loop attestation** (HARD operator-paced gate · mirrors cycle-007 PP-4 paste-to-Loa shape)
  - Operator fires a fan-out batch (`--fire-n`), picks a winner side-by-side, annotates, promotes one to `evals/snapshots/` — the full FR-40→41→42 loop self-served.
  - Acceptance: written attestation in NOTES.md or PR comment that the self-serve loop is faster than the manual loop fired 2026-05-22 (§7.4) AND a new `preference-log.jsonl` record landed via the tool (not by hand).
  - REMEDIATION if FAIL: if loop slower-than-manual → open `s9-preview-ergonomics` cycle-009 issue · S9 functional value (FR-38/39 lands through it) still ships · cycle-008 still closes.

### S9 acceptance gates

- `bun test` green (new preference-persistence + batch-grouping + promote-to-evals + fidelity-parity tests)
- `bun run typecheck` clean
- Preview surface renders N candidates side-by-side at Discord fidelity (no console errors)
- A new `preference-log.jsonl` record lands via the tool (OP-G4)
- At least one winner promoted to `evals/snapshots/` end-to-end
- 3-layer enforcement inherited (localhost · LOA_DASH_AUTH · LOA_TWEAKPANE_ENABLED)

---

## 11 · Verification matrix per sprint

| Sprint | Tests | Lint | Build | Manual |
|---|---|---|---|---|
| S2 | loader.test.ts (10 scenarios) | typecheck + cycle-007 lint | bun install + check | chat-mode regression fixture |
| S3 | + cron migration tests + flag parse tests + T3.0 typecheck + T3.8/T3.9 byte-snapshot fixtures | typecheck + cycle-007 lint | bun install (score-api-types v0.6.0) + check | OP-G2 live voice attestation |
| S4 | + trace envelope tests + redaction tests + rotation concurrency | typecheck | bun install + check | trace:explain renders source-map · dashboard breadcrumbs render |
| S5 | + agent-gateway tests + error-classify tests | typecheck | bun install + check | /ruggy slash command + chat-mode reply both trace |
| S6 | (UI tests · operator manual) | typecheck | bun install (tweakpane v4) | OP-G3 teachability attestation |
| S7 | + sanitize.test.ts (4 heuristics) | typecheck | bun install + check | dashboard sanitize-violations tab renders |
| S9 | + preference-persist + batch-group + promote-to-evals + fidelity-parity tests | typecheck | bun install + check | OP-G4 end-to-end RLHF loop · new preference-log record via tool |
| S8 | (none new · all prior green) | typecheck | bun install + check | COMPLETED.md + vault doctrine + ledger flip + PP-5 mobile + BB-3 approval (+ S9 swept) |

---

## 12 · Risk register

| Risk | Severity | Likelihood | Mitigation | Owner |
|---|---|---|---|---|
| Effect-TS migration breaks chat-mode regression fence | HIGH | LOW | T2.9 scenario 5 byte-identical assertion + scenario 10 before/after fixture | S2 implementer |
| score-mcp `factor_trends` field doesn't exist or has different semantics | HIGH | MEDIUM | T3.1 verification gate BLOCKS S3 until confirmed · operator-decision-gate on findings | S3 implementer |
| NFR-9 fail-loud halts legitimate digest fires (false-positive on factor names like 'Top-100 Holder') | MEDIUM | MEDIUM | T2.4 allowlist + LOA_STAT_LEAKAGE_GUARD=warn escape hatch | S2 implementer |
| Two-pass offset recovery fails on duplicate fragment text in final prompt | MEDIUM | LOW | T4.2 disambiguation via searchStart + fail-loud on not-found · fragment_kind diversity in practice prevents duplicates | S4 implementer |
| Trace rotation race produces corrupt JSONL | MEDIUM | LOW | T4.6 atomic acquire via fs.linkSync + stale-PID detect only on ESRCH · concurrency test | S4 implementer |
| OP-G2 attestation FAIL surfaces a real regression late in cycle | HIGH | LOW | LOA_PROMPT_BUILDER=legacy fallback preserves cycle-007 production behavior | operator |
| OP-G3 tweakpane attestation FAIL (loop slower than file-edit-restart) | LOW | LOW | Soft gate · cycle still closes · cycle-009 ergonomics issue filed | operator |
| PP-5 mobile screenshot reveals artifact returned post-S3 | HIGH | LOW | Same fallback as OP-G2 (revert canonical flag) + cycle-008 issue + S2/S3 re-loop | operator + S3 implementer |
| BB-3 round 3 surfaces CRITICAL post-PR | MEDIUM | MEDIUM | Standard bug-fix cycle prior to close · cycle-008 issue tracker | operator + responsible-S implementer |
| Tweakpane v4 bundle size impact on dashboard | LOW | LOW | Kitchen-only (INV-PS-5) · production untouched | S6 implementer |

---

## 13 · Sprint ledger registration

Each sprint registers in `grimoires/loa/ledger.json` cycle-008 entry with `global_number` assigned from `next_sprint_number` starting at 21.

> **Registration-gap reconciliation (amendment 2026-05-22)**: cycle-008's `sprints[]` array was NEVER populated in `ledger.json` (the cycle entry had metadata but no sprint registrations) and no beads epics existed. This amendment registers ALL of cycle-008 (S0–S9) in the ledger + creates the beads epics. The block below is the canonical registration applied to `ledger.json`.

```json
{
  "id": "cycle-008-persona-substrate",
  "sprints": [
    { "local_id": "sprint-0", "global_number": 21, "title": "Structural diff spike + reframe rounds", "status": "completed", "scope": "RESEARCH", "task_count": 1 },
    { "local_id": "sprint-1", "global_number": 22, "title": "Persona.md placeholder insertion", "status": "completed", "scope": "TEMPLATE", "task_count": 1 },
    { "local_id": "sprint-2", "global_number": 23, "title": "buildPrompt Effect-TS + render helpers + runtime guards", "status": "planned", "scope": "CORE", "task_count": 9, "risk_tier": "MEDIUM" },
    { "local_id": "sprint-3", "global_number": 24, "title": "Cron orchestrator migration + flag + score-mcp schema gate (+ T3.0/T3.8/T3.9 amendment)", "status": "planned", "scope": "INTEGRATION", "task_count": 10, "risk_tier": "MEDIUM" },
    { "local_id": "sprint-4", "global_number": 25, "title": "Trace schema v2 + fragment_sources + redaction architecture", "status": "planned", "scope": "OBSERVABILITY", "task_count": 8, "risk_tier": "MEDIUM" },
    { "local_id": "sprint-5", "global_number": 26, "title": "Anthropic-SDK trace capture + outcome classification + stream hooks", "status": "planned", "scope": "OBSERVABILITY", "task_count": 6, "risk_tier": "LOW" },
    { "local_id": "sprint-6", "global_number": 27, "title": "/tweak Tweakpane kitchen tab + layered enforcement", "status": "planned", "scope": "KITCHEN", "task_count": 7, "risk_tier": "MEDIUM" },
    { "local_id": "sprint-7", "global_number": 28, "title": "middot-detector + sanitize-violations integration", "status": "planned", "scope": "QUALITY", "task_count": 4, "risk_tier": "LOW" },
    { "local_id": "sprint-8", "global_number": 29, "title": "Cycle close + cycle-007 absorption + vault doctrine", "status": "planned", "scope": "CEREMONY", "task_count": 8, "risk_tier": "MEDIUM", "is_final": true },
    { "local_id": "sprint-9", "global_number": 30, "title": "RLHF preference loop · billboard-preview-first lead slice (FR-40/41/42)", "status": "planned", "scope": "RLHF", "task_count": 6, "risk_tier": "MEDIUM", "added_by": "amendment-2026-05-22" }
  ],
  "next_sprint_number_after_cycle_008": 31
}
```

T8.8 advances `next_sprint_number` 21 → **31** in the ledger at cycle close (was 30 · S9 = global sprint-30 added by amendment). S9 executes before S8's close ceremony but holds the highest global number; the close sweep includes it.

---

## Appendix C · Goal → task traceability

PRD goals G-1..G-9 map to S0–S8 (unchanged · see PRD §2). The amendment adds **G-10** (voice-fidelity iteration unblocked · RLHF preference loop) mapping to the amendment tasks:

| Goal | Contributing tasks |
|---|---|
| G-1 Cron-digest → buildPrompt | T3.3 |
| G-2 Governance-vs-voice separation | T1.1 · T2.2 · T2.3 · T2.4 · T3.3 |
| G-3 buildPrompt returns Effect | T2.1 · T2.5 · T2.6 · T2.7 · T2.8 |
| G-4 Trace envelope v2 + fragment_sources[] | T4.1 · T4.2 · T2.3a · T4.4 · T4.7 · T4.8 |
| G-5 Anthropic-SDK trace capture | T5.1..T5.6 |
| G-6 /tweak Tweakpane kitchen tab | T6.1..T6.7 |
| G-7 middot-detector | T7.1..T7.4 |
| G-8 persona-as-substrate vault doctrine | T8.1 |
| G-9 cycle-007 pair-points absorbed | T8.3 · T8.4 · T8.5 · T8.6 · T8.7 · T8.8 |
| **G-10 voice-fidelity iteration unblocked (RLHF loop)** | **T3.0 (FR-43) · T3.8 (FR-38) · T3.9 (FR-39) · T9.1..T9.6 (FR-40/41/42)** |

E2E goal validation: G-10's end-to-end loop attestation is OP-G4 (S9 T9.6) — fire fan-out → pick → annotate → promote-to-evals, self-served, with a new `preference-log.jsonl` record landing via the tool.

---

End of cycle-008 sprint plan r1 + amendment 2026-05-22. Ready for Phase 6 (Flatline Sprint multi-model review).
