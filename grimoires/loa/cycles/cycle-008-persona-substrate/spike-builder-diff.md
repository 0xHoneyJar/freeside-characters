# spike · cycle-008 · structural diff · buildPrompt vs buildVoiceBrief

> **S0 output** · NET 0 LoC · drives S1 (persona.md placeholders) + S2 (buildPrompt enrichment) + S3 (cron migration) acceptance criteria. Authored 2026-05-17 · ARCH room · cycle-008 persona-as-substrate.

## Reframe 2026-05-17 · stats-out-of-voice + governance-vs-voice separation · SUPERSEDES Gap 1+2 + shapeRuntimeData + label vocabulary

> Mid-spike operator clarifications (TWO related principles):
>
> **A · Stats-out-of-voice**: ruggy's voice never cites aggregate-window stats. Stats live in the deterministic digest card body. Ruggy observes semantic events ("real things that happened") or sits with quiet. The substrate's PERMITTED/SILENCED licensing lists are the shape signal — populated = hot, empty = quiet.
>
> **B · Governance-vs-voice separation** (grounded in vault doctrines: themes-vs-personas-clean-separation + substrate-over-narrative + damp-as-default-voice-substrate): governance (substrate mechanics) and voice (character expression) live on PARALLEL architectural layers. They don't nest. Substrate-state blocks in prompts MUST use neutral mechanical vocabulary — substrate engineer's voice, not character voice. Voice-flavoring a substrate label ("what's worth naming") collapses both layers; the LLM loses grip on what's mechanics vs what's expression.

**Consequence**: 
- SHAPE_GUIDANCE placeholder is **DROPPED entirely**. 
- `{{WINDOW_DAYS}}` / `{{TOTAL_EVENTS}}` / `{{PREVIOUS_PERIOD_EVENTS}}` dropped from buildPrompt's signature (aggregate-window stats).
- `{{SILENCED_FACTORS}}` dropped from prompt (cycle-005 gate stays as engineering middleware; only its filtered result reaches the LLM). The permit/deny dichotomy is redundant under stats-out-of-voice — ruggy can't hallucinate the aggregate-magnitude claims the gate was designed to prevent, since he never speaks aggregates anymore. Substrate transparency simplifies to "factors that fired."
- Remaining factor placeholder renamed `{{PERMITTED_FACTORS}}` → `{{ACTIVE_FACTORS}}` (drops the permit/deny terminology artifact). Render shape: names-only.
- **Label vocabulary locked**: `factors with activity:` (under ACTIVE_FACTORS placeholder). Plain English, mechanical, no value judgment, no character voice.

**Surviving placeholders** (2 total): `{{ACTIVE_FACTORS}}` (names-only) · `{{PRIOR_WEEK_HINT}}` (pre-wrapped). Plus 2 code-appended cron suffixes (LOCK · JSON output schema).

**Placement locked**: base template AFTER `{{ENVIRONMENT}}` (persona.md:657), BEFORE `{{VOICE_ANCHORS}}` (persona.md:676). Universal to all cron post types · single insertion point.

**Reference target shape** (what the LLM sees in the assembled system prompt):
```
═══ SUBSTRATE STATE (this week) ═══
factors with activity:
  - Mibera NFT
  - Mibera Quality

<untrusted-content source="voice-memory" stream="digest" key="bear-cave-week-of-2026-05-12" use="background_only">
header content
outro content
</untrusted-content>
```

When empty (shape A signal · no factors, no prior week):
```
═══ SUBSTRATE STATE (this week) ═══
factors with activity:
  (none)
```

**Cycle-010+ deferred**: bypass the cycle-005 gate at the prompt layer entirely · pass raw semantic events from `ZoneDigest.top_events` directly. Requires score-mcp / orchestrator plumbing work. Operator-flagged.

**Cycle-010+ flag**: "ruggy observes activity as it comes in" implies a SEMANTIC-EVENT STREAM substrate, not aggregate window data. Today's score-mcp returns aggregates; tomorrow's substrate could feed ruggy a recent-events stream (e.g., `wallet 0xabc claimed Earth Tarot 14 in bear-cave at 03:42`). Worth a vault doctrine page when cycle-010 fires.

**S1 scope after reframe**: dramatically smaller. ZERO new prose to author for SHAPE_GUIDANCE (dropped). The remaining `persona.md` edits are 3 placeholder insertions (`{{PERMITTED_FACTORS}}`, `{{SILENCED_FACTORS}}`, `{{PRIOR_WEEK_HINT}}`) in the digest fragment with thin Gumi-shape-aligned framing. ~¼ day work (was ½ day).

**S2 scope after reframe**: equivalence-test matrix shrinks from 8 → ~5 scenarios. Shape A vs B vs C is now an artifact of empty vs populated PERMITTED_FACTORS list (engineering-rendered), not three separately-authored prose variants.

See memory: `feedback-ruggy-voice-principle`.

---

## Why this spike exists

Cycle-007 closed kebab-zone-leak (Bug A · INV-12) but operator live-testing surfaced a structural regression: cron's voice still parrots middots, spells out numbers, and lowercase-bleeds into proper nouns. Triage: two parallel prompt-builders, and cron uses the wrong one.

- **Canonical** · `packages/persona-engine/src/persona/loader.ts:237` `buildPrompt` · consumes Gumi-authored `persona.md` template · used by chat-mode ONLY
- **Legacy** · `packages/persona-engine/src/compose/voice-brief.ts:86` `buildVoiceBrief` · engineering-generated middot-heavy prose · used by ALL cron orchestrators

Cycle-008 migrates the cron path from legacy → canonical. This spike catalogs every behavior the legacy builder carries that the canonical builder lacks today, maps each to either a new `persona.md` placeholder OR an engineering substitution, and locks the S2 equivalence-test cut-line so downstream sprints inherit it.

## Source files surveyed

| File | Line | Role |
|---|---|---|
| `packages/persona-engine/src/persona/loader.ts` | 237 | canonical `buildPrompt` (unified V0.7-A.2) |
| `packages/persona-engine/src/persona/loader.ts` | 286-300 | systemHalf substitution chain (the pattern S2 extends) |
| `packages/persona-engine/src/compose/voice-brief.ts` | 86 | legacy `buildVoiceBrief` |
| `packages/persona-engine/src/compose/voice-brief.ts` | 102-114 | baseSystem (identity + voice rules + JSON output schema) |
| `packages/persona-engine/src/compose/voice-brief.ts` | 116-128 | shape A all-quiet guidance |
| `packages/persona-engine/src/compose/voice-brief.ts` | 149-166 | shape B/C licensed-factors guidance |
| `packages/persona-engine/src/compose/voice-brief.ts` | 175-179 | continuity block (prior-week-hint) |
| `packages/persona-engine/src/live/claude-sdk.live.ts` | 18-67 | cron call-site `generateDigestVoice` |
| `packages/persona-engine/src/live/claude-sdk.live.ts` | 53 | LOCK suffix append (UNTRUSTED_CONTENT_LLM_INSTRUCTION) |
| `packages/persona-engine/src/orchestrator/format-prior-week-hint.ts` | 59 | `formatPriorWeekHint` (escape + marker-wrap) |
| `packages/persona-engine/src/orchestrator/format-prior-week-hint.ts` | 85 | `UNTRUSTED_CONTENT_LLM_INSTRUCTION` constant |
| `apps/character-ruggy/persona.md` | 630 | `## System prompt template` section |
| `apps/character-ruggy/persona.md` | 1224 | `═══ INPUT PAYLOAD ═══` marker (systemHalf/userHalf split) |
| `apps/character-ruggy/persona.md` | 1256+ | per-post-type fragments (`<!-- @FRAGMENT: digest -->`, etc.) |

## Existing placeholder grammar (from `persona.md` + loader.ts:286-300)

`{{ZONE_NAME}}` · `{{ZONE_ID}}` · `{{DIMENSION}}` · `{{ENVIRONMENT}}` · `{{VOICE_ANCHORS}}` · `{{CODEX_PRELUDE}}` · `{{CODEX_ANCHORS}}` · `{{EXEMPLARS}}` · `{{POST_TYPE_GUIDANCE}}` · `{{MOVEMENT_GUIDANCE}}` · `{{POST_TYPE}}` · `{{POST_TYPE_OUTPUT_INSTRUCTION}}` · `{{VOICE_GRIMOIRE}}`

Substitution chain shape: `template.replace(/\{\{X\}\}/g, fragment).replace(/\{\{Y\}\}/g, fragment2)...`. Substrate-canonical · every character follows.

## Gap catalog — every legacy behavior the canonical builder lacks

### Gap 1 · Shape A all-quiet prose guidance · REFRAMED OUT (2026-05-17)

**Original analysis** preserved for audit:
- Source: `voice-brief.ts:116-128`. Hardcoded TypeScript with `${windowDays}`, `${totalEvents}`, `${previousPeriodEvents}` interpolation.
- Originally proposed: `{{SHAPE_GUIDANCE}}` placeholder with operator-authored A/B/C variants.

**Reframe consequence**: SHAPE_GUIDANCE doesn't exist after the stats-out-of-voice principle lands. The empty `{{PERMITTED_FACTORS}}` list is the shape A signal. The LLM reads "permitted to narrate: (none)" and the persona voice rules + digest fragment handle the rest ("sit with what is", "don't fake energy"). No prose authoring required.

**Closes** · DROPPED entirely. Sprint 1 scope reduces accordingly.

### Gap 2 · Shape B/C licensed-factors prose guidance · REFRAMED OUT (2026-05-17)

**Original analysis** preserved for audit:
- Source: `voice-brief.ts:149-166`. Hardcoded TypeScript with shape-B-vs-C branch and inline factor-list interpolation.
- Originally proposed: same `{{SHAPE_GUIDANCE}}` placeholder.

**Reframe consequence**: same as Gap 1 — populated `{{PERMITTED_FACTORS}}` list is the shape B/C signal (1 entry = B-one-dim-hot, 2+ entries = C-multi-dim-hot). The LLM reads the named licensed factors and reasons from there. No separate B/C prose variants.

**Closes** · DROPPED entirely.

### Gap 3 · Active factors list rendering · NAMES-ONLY · `factors with activity:` label (post-reframe · final)

**Source** · `voice-brief.ts:130-140`
**Today** · engineering renders `permittedFactors[]` as bullet lines with rank + actors + active_days. The aggregate-window stats — REFRAMED OUT (stats-out-of-voice). The permit/deny terminology itself — REFRAMED OUT (gate is engineering middleware, prompt sees only the result).
**Migration target** · `{{ACTIVE_FACTORS}}` placeholder (renamed from `{{PERMITTED_FACTORS}}` to drop the permit/deny artifact). Engineering renders inside `buildPrompt` as names-only bullet block under the `factors with activity:` label.
**Post-reframe format**:
```
factors with activity:
  - Mibera NFT
  - Mibera Quality
```
or when empty (shape A · all-quiet signal):
```
factors with activity:
  (none)
```
**Acceptance shape** · pass `activeFactors?: ReadonlyArray<{displayName: string}>` to `buildPrompt`; private `renderActiveFactors(snapshots)` returns the block above. Caller (`claude-sdk.live.ts`) adapts `derived.permittedFactors[]` (cycle-005 substrate naming, unchanged) → `activeFactors[]` (prompt-layer naming). The substrate's cycle-005 gate still does its filtering work; only the LLM-facing vocabulary shifts.
**Closes** · S1 (placeholder lands) + S2 (renderer lands).

### Gap 4 · Silenced factors list rendering · DROPPED (cycle-008 simplification 2026-05-17)

**Original analysis** preserved for audit:
- Source: `voice-brief.ts:142-147`.
- Originally proposed: `{{SILENCED_FACTORS}}` placeholder rendering name + filter reason under "do not narrate:" label.

**Simplification consequence**: cycle-005 prose-gate stays as engineering middleware (still filters factors mechanically per its existing logic) but the SILENCED list NEVER reaches the LLM. The permit/deny dichotomy was designed to prevent aggregate-narrative hallucinations ("X climbed rank 47 → 12 while Y didn't"); the stats-out-of-voice reframe makes that hallucination class impossible (ruggy literally cannot speak the magnitudes the gate prevents). The SILENCED list becomes redundant infrastructure.

**Closes** · DROPPED entirely. `{{SILENCED_FACTORS}}` placeholder never lands in persona.md. `silencedFactors` arg never lands in buildPrompt's signature. `SilencedFactorRender` type never defined.

**Cycle-010+ continuation** · the next reduction (operator-flagged): bypass the cycle-005 gate entirely at the prompt layer. New substrate path returns `ZoneDigest.top_events` (semantic event details). Ruggy narrates from real events that fired. Out of cycle-008 scope.

### Gap 5 · Prior-week-hint continuity block

**Source** · `voice-brief.ts:175-179` (Gumi-adjacent prose wrapper) + `claude-sdk.live.ts:55-57` (user-half append) + `format-prior-week-hint.ts:59` (escape + `<untrusted-content>` marker-wrap)
**Today** · the hint string is pre-wrapped by `formatPriorWeekHint` (HTML-entity-escape + `<untrusted-content source="voice-memory" stream="..." key="..." use="background_only">...</untrusted-content>` markers). Cron call-site appends it to `brief.user` if present.
**Migration target** · `{{PRIOR_WEEK_HINT}}` placeholder. Engineering substitutes the pre-wrapped string directly. The wrapper prose ("you MAY thread continuity OR pivot...") is Gumi-authored and lives adjacent to the placeholder in `persona.md`.
**Critical preservation** · the `<untrusted-content>` marker wrapping is FLATLINE-SKP-002/CRITICAL · MUST NOT be re-escaped or stripped by buildPrompt's substitution chain. The placeholder receives the already-escaped string; `.replace(/\{\{PRIOR_WEEK_HINT\}\}/g, prewrappedHint)` is byte-faithful.
**Closes** · S1 + S2.

### Gap 6 · UNTRUSTED_CONTENT_LLM_INSTRUCTION (LOCK suffix)

**Source** · `format-prior-week-hint.ts:85` (constant) + `claude-sdk.live.ts:53` (append at call-site)
**Today** · engineering appends the verbatim instruction string to `brief.system` after buildVoiceBrief returns. FLATLINE-SKP-001/CRITICAL · cycle-006 sprint review · MUST be in cron systemPrompt.
**Migration decision** · **(a) inject in `buildPrompt` directly** as a final piece of `systemHalf` when `shape.kind === 'cron'`. Do NOT expose as a placeholder editable by persona authors. Reason: this is a substrate-LLM security contract, not character voice. Keeping it in code (vs persona.md) keeps the security gate immutable and version-controlled with the security review.
**Migration target** · post-substitution append in `buildPrompt`, guarded by `shape.kind === 'cron'`. Chat-mode (`shape.kind === 'reply'`) currently doesn't append — preserve that, defer reply-mode LOCK question to cycle-009.
**Closes** · S2.

### Gap 7 · Identity preamble + voice rules (covered) · JSON output schema (NEW migration target)

**Source** · `voice-brief.ts:102-114` (baseSystem)
**Today** · two distinct pieces conflated in baseSystem:
  - **Identity preamble + voice rules** ("you are ruggy, a warm and grounded bear narrator..." + lowercase rule + proper-noun rule + one-sentence rule + sit-with-quiet) — already covered by `apps/character-ruggy/persona.md` + `voice-anchors.md` + LOCK section. The buildVoiceBrief copy is duplicate · drops on migration.
  - **JSON output schema** (`output: SINGLE JSON object on ONE line, two fields: {"header": "...", "outro": ""}` + outro-emit rule + "no markdown fences. no preamble.") — NOT in persona.md (verified 2026-05-17 grep). This is a substrate-LLM contract (`parseVoiceResponse` depends on the exact JSON shape).

**Migration decision** · the JSON output schema joins LOCK suffix as a **cron-only code-appended suffix** in `buildPrompt` (engineering-owned, NOT a persona.md placeholder). Order: schema first, then LOCK. Both appended after `systemHalf` substitution chain completes when `shape.kind === 'cron'`. Reason: substrate-LLM contracts (the schema · the security gate) are engineering-owned and must not drift via persona.md edits. Cycle-009 may unify both into a single `{{CRON_SUFFIX}}` placeholder if the pattern becomes load-bearing.

**Closes** · S2 (schema appendage lands alongside LOCK appendage).

### Gap 8 · Zone-voice-context map — DROPPED (operator decision 2026-05-17)

**Source** · `voice-brief.ts:28-37` (`ZONE_VOICE_CONTEXT[zoneId]`)
**Today** · engineering-owned map: "the OG dimension · pre-mint history · sets/keys/articles/cubquest · the deep cave where the long-history bears nap" etc. Substituted inline at line 87 of voice-brief.ts via `zoneCtx`.
**Decision** · **DROP entirely from cycle-008.** Structurally redundant with what the LLM already has:
  - **`{{ENVIRONMENT}}`** (built by `compose/environment.ts:69-112`) already carries: zone identity (`You are in 🐻 #bear-cave — Bear Cave (OG dimension)`), room read (`temperature · social_density · archetype · era` via `ZONE_SPATIAL` from `lynch-primitives.ts`), tool guidance, recent room context.
  - **Score MCP** digest data carries the activity context (events count · factor stats · ranks) — the LLM derives "what's happening" from data, not from pre-baked prose.
  - **`{{CODEX_PRELUDE}}` + `{{CODEX_ANCHORS}}`** carry substrate-wide lore + per-character lore tilt.
  - **`persona.md` digest fragment** carries voice rules + per-zone headline shape.

Combined, no need for a separate `ZONE_VOICE_CONTEXT` lore one-liner. The narrative flavor it provides is lore territory (codex), not data territory (score). Score MCP is the operator's named substrate-of-record for context, and score provides aggregate data that the LLM converts into voice.
**Cycle-009 candidate** · IF voice degrades without it, add a new `{{ZONE_LORE}}` placeholder fed by `mcp__codex__lookup_zone({slug})` pre-fetch at orchestrator startup. Defer until the regression is observed in live-fire.
**Closes** · DROP IN S3 (when voice-brief.ts is `@deprecated` · the map dies with the file).

### Gap 9 · `parseVoiceResponse` (NOT a prompt-builder gap)

**Source** · `voice-brief.ts:198-232`
**Today** · LLM response parser. Lives in voice-brief.ts file but isn't part of buildVoiceBrief — separate exported function.
**Migration** · move to `packages/persona-engine/src/compose/parse-voice-response.ts` (or similar) when voice-brief.ts is retired. Behavior preserved verbatim. NOT covered by S2 equivalence tests (output parsing is downstream of prompt building).
**Closes** · S3 cleanup (deprecation) · cycle-009 final retirement of voice-brief.ts.

## Placeholder map summary (post-reframe 2026-05-17)

| Gap | New placeholder | Owned by | Substitution source | Sprint |
|---|---|---|---|---|
| ~~1+2~~ | ~~`{{SHAPE_GUIDANCE}}`~~ | ~~Gumi/operator~~ | ~~persona.md prose~~ | **DROPPED (reframe)** |
| ~~1~~ | ~~`{{WINDOW_DAYS}}` `{{TOTAL_EVENTS}}` `{{PREVIOUS_PERIOD_EVENTS}}`~~ | ~~engineering~~ | ~~runtime numbers~~ | **DROPPED (reframe)** |
| 3 | `{{PERMITTED_FACTORS}}` | engineering | `renderPermittedFactors({displayName}[])` — names only | S1 + S2 |
| 4 | `{{SILENCED_FACTORS}}` | engineering | `renderSilencedFactors({displayName, reason}[])` — name + reason | S1 + S2 |
| 5 | `{{PRIOR_WEEK_HINT}}` | engineering | pre-wrapped string from `formatPriorWeekHint` (passed verbatim) | S1 + S2 |
| 6 | (no placeholder · code-injected suffix) | engineering | `UNTRUSTED_CONTENT_LLM_INSTRUCTION` constant | S2 |
| 7 | (no placeholder · code-injected suffix) | engineering | JSON output schema string (cron-only · pre-LOCK in append order) | S2 |
| ~~8~~ | ~~zone-voice-context~~ | ~~~~ | ~~~~ | **DROPPED (operator decision)** |

**Net cycle-008 placeholders added to persona.md**: 3 (`{{PERMITTED_FACTORS}}`, `{{SILENCED_FACTORS}}`, `{{PRIOR_WEEK_HINT}}`).
**Net cycle-008 code-appended cron suffixes**: 2 (JSON schema, LOCK).

## Proposed buildPrompt signature (S2 input shape · LOCKED 2026-05-17)

**Architecture decisions locked**:
- Q1 → structured snapshots (caller passes `FactorSnapshotForRender[]`; buildPrompt renders internally via private helpers; S4 trace records per-item `prompt_offset` per factor line)
- Q2 → `buildPrompt` returns `Effect<Result, BuildPromptError, never>` (full Effect-TS migration on the buildPrompt API). Touches both cron call-site (`claude-sdk.live.ts`) and chat call-site (`compose/reply.ts`).
- Q5 (negative cron shape) → fail-loud via `Effect.fail(new MissingCronArgError({...}))` discriminated-tagged error.

```ts
import { Data, Effect } from 'effect';

// Tagged error class (Effect-TS discriminated union pattern · matches
// existing `packages/persona-engine/src/ambient/*` and `compose/llm-gateway/*`).
export class BuildPromptError extends Data.TaggedError('BuildPromptError')<{
  readonly kind:
    | 'missing-cron-arg'        // cron shape but cycle-008 arg undefined
    | 'template-section-missing' // persona.md missing `## System prompt template`
    | 'input-payload-marker-missing' // template missing `═══ INPUT PAYLOAD ═══`
    | 'fragment-not-found'      // `<!-- @FRAGMENT: <post-type> -->` absent
    | 'fragment-end-marker-missing';
  readonly argName?: string;
  readonly personaPath?: string;
  readonly postType?: PostType;
}> {}

export interface BuildPromptArgsUnified {
  character: CharacterConfig;
  shape: BuildPromptShape;
  environmentContext?: string;
  voiceGrimoire?: string;

  // cycle-008 additions · cron-only · undefined for chat-mode (regression fence)
  // (Gap 1+2 + shapeRuntimeData REFRAMED OUT 2026-05-17 · stats-out-of-voice)
  // (Gap 4 SILENCED dropped from prompt · gate stays as engineering middleware)
  activeFactors?: ReadonlyArray<ActiveFactorRender>;  // Gap 3 · names only
  priorWeekHint?: string;                             // Gap 5 (pre-wrapped by formatPriorWeekHint)
}

export interface BuildPromptResult {
  readonly systemPrompt: string;
  readonly userMessage: string;
}

// LOCKED return type · Effect-TS
export function buildPrompt(
  args: BuildPromptArgsUnified,
): Effect.Effect<BuildPromptResult, BuildPromptError, never> { /* ... */ }

// Engineering-owned render shape — buildPrompt does not depend on
// score/types directly · caller adapts substrate `permittedFactors[]`
// (cycle-005 naming, unchanged) → `activeFactors[]` (prompt-layer naming).
// Reframe 2026-05-17: rank/actors/active_days dropped from render shape.
export interface ActiveFactorRender {
  readonly displayName: string;
}
```

**Why structured (not pre-rendered strings)** · S4 needs `buildPrompt` to populate `fragment_sources[]` per substitution. Keeping the render inside `buildPrompt` means trace entries can accurately attribute `{layer: 'voice', fragment_kind: 'permitted-factors', source_file: 'score-snapshot', prompt_offset: [start, end]}` per factor line. Pre-rendering at the call-site would lose the prompt_offset precision.

**Why full Effect return (not Effect-at-call-site-only)** · loader.ts already throws native errors at lines 108/281 (`SECTION_HEADER` missing · `INPUT PAYLOAD` marker missing) — promoting those to `BuildPromptError` is a one-stop migration that covers ALL of loader.ts's error surface. The alternative (Effect at call-site only, native throws inside loader.ts) would leave a mixed-error-style file. Cleaner to migrate the whole module.

**Cron call-site migration** (`claude-sdk.live.ts::generateDigestVoice`) becomes:

```ts
import { Effect } from 'effect';

generateDigestVoice: (snapshot, ctx) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { systemPrompt, userMessage } = yield* buildPrompt({
        character,
        shape: { kind: 'cron', zoneId: snapshot.zone, postType: 'digest' },
        environmentContext: /* ... */,
        voiceGrimoire: /* ... */,
        shapeGuidance: pickShapeGuidance(ctx.derived.shape),
        shapeRuntimeData: { windowDays: snapshot.windowDays, totalEvents: snapshot.totalEvents, previousPeriodEvents: snapshot.previousPeriodEvents },
        permittedFactors: ctx.derived.permittedFactors.map(adaptToRender),
        silencedFactors: ctx.derived.silencedFactors.map(adaptToRender),
        priorWeekHint: ctx.priorWeekHint,
      });
      // ... invoke + parse + sanitize
    }),
  )
```

**Chat-mode call-site migration** (`compose/reply.ts`) becomes a similar `Effect.runPromise(Effect.gen(...))` wrapper. Backward-compat shims `buildPromptPair` and `buildReplyPromptPair` get the same Effect-return treatment OR get removed if all callers migrate.

**Regression fence preserved** · all cycle-008 args default to `undefined`. When undefined, the corresponding `.replace(/\{\{X\}\}/g, '')` yields empty substitution — chat-mode `Effect.runPromise(buildPrompt(...))` resolves to byte-identical output as today's V0.7-A.2 `buildReplyPromptPair(...)`.

## S2 equivalence-rule cut-line (#3 baked in)

The S2 acceptance criterion of "string-identical OR structurally equivalent" needs a written rule, or the bar collapses to PR-review judgment. Three tiers:

### Tier 1 · Strict (byte-identical)

Apply to:
- **systemPrompt for chat-mode** (`shape.kind === 'reply'`) — regression fence. `buildPrompt(args without cycle-008 fields)` MUST produce byte-identical output to today's `buildReplyPromptPair(args)`.
- **systemPrompt LOCK suffix** for cron — `UNTRUSTED_CONTENT_LLM_INSTRUCTION` text MUST be appended verbatim.

Bar: `expect(newPrompt).toBe(oldPrompt)`.

### Tier 2 · Normalized (whitespace + ordering tolerance)

Apply to:
- **userMessage for cron shape B/C** with `{{PERMITTED_FACTORS}}` / `{{SILENCED_FACTORS}}` substituted. Factor lines may differ in order if upstream sort is non-deterministic (today they're sorted-desc per voice-brief.ts:45 doc · but the new render helper has its own sort — different ordering ≠ regression).
- **userMessage for cron shape A** when prose has been migrated to Gumi-authored `{{SHAPE_GUIDANCE}}` variant (Gumi's prose ≠ engineering's prose byte-by-byte — that's the WHOLE POINT of the migration).

Normalization for compare:
1. Strip trailing whitespace per line
2. Collapse blank-line runs to single blank
3. For factor-list blocks (lines matching `^\s*·\s*`): sort by display_name alphabetic
4. Apply `.trim()` to the whole

Bar: `expect(normalize(newPrompt)).toBe(normalize(oldPrompt))` — WHERE the test's "oldPrompt" is a hand-curated expected fixture (NOT calling buildVoiceBrief, since voice-brief.ts will be deprecated in S3). The fixture lives at `packages/persona-engine/src/persona/fixtures/expected-prompts/<scenario>.txt`.

### Tier 3 · Reject (always fail)

Hard fail on:
- Missing sections (e.g., "permitted factors" header absent when `permittedFactors.length > 0`)
- Reordered shape (e.g., LOCK suffix landing before voice rules, or `{{PRIOR_WEEK_HINT}}` landing in systemHalf instead of userHalf)
- Changed semantic content (rank threshold values shifted, JSON output schema fields renamed, factor stats columns missing)
- Empty SHAPE_GUIDANCE when shape ∈ {A, B, C} (silent fallback to no-prose is a regression — fail loud)

### Test scenario matrix (S2 acceptance · post-reframe · 5 scenarios)

Reframe simplifies the matrix: no SHAPE_GUIDANCE variants to compare; shape A/B/C is just empty vs populated PERMITTED_FACTORS list.

| # | scenario | continuity | tier |
|---|---|---|---|
| 1 | cron · empty permitted (shape-A signal) | none | 2 (normalize) |
| 2 | cron · empty permitted (shape-A signal) | prior-week-hint present | 2 |
| 3 | cron · 1 permitted (shape-B signal) | none | 2 (factor list · normalize) |
| 4 | cron · 2+ permitted (shape-C signal) | none | 2 |
| 5 | chat-mode (regression fence) | n/a | 1 (byte-identical to today's buildReplyPromptPair) |

Plus negative tests:
- 6 · cron with `priorWeekHint` containing `</untrusted-content>` · marker integrity MUST survive substitution (no re-escaping by buildPrompt — already escaped by formatPriorWeekHint)
- 7 · cron with `permittedFactors` undefined · MUST `Effect.fail(new BuildPromptError({kind: 'missing-cron-arg', argName: 'permittedFactors'}))` per Q5 lock
- 8 · cron with `silencedFactors` undefined · same fail-loud behavior

## Open spike questions — RESOLVED 2026-05-17

| # | Question | Resolution |
|---|---|---|
| 1 | Zone-voice-context migration (Gap 8) | **DROP entirely** from cycle-008. {{ENVIRONMENT}} + score-mcp data + codex prelude cover the gap. Cycle-009 candidate: codex MCP pre-fetch into `{{ZONE_LORE}}` IF voice degrades. |
| 2 | JSON output schema location (Gap 7) | **Stay in code** as part of `outputInstruction('digest')` in loader.ts — substrate-LLM contract, not voice. Spike-validate by grepping `persona.md` digest fragment for "JSON" / "header" / "outro" at S1 kickoff to confirm Gumi-shape isn't already authoring it. |
| 3 | Chat-mode LOCK suffix (Gap 6) | **Cron-only** in cycle-008. Reply-mode LOCK injection deferred to cycle-009 (untrusted-content in `userPrompt` is the call-site's escape responsibility today). |
| 4 | buildPrompt arg signature | **Structured snapshots** · caller passes `FactorSnapshotForRender[]`; buildPrompt renders internally; S4 trace gets per-item `prompt_offset`. |
| 5 | Negative cron shape behavior | **Fail-loud via `Effect.fail(new BuildPromptError({kind: 'missing-cron-arg', argName: '...'}))`**. Matches loader.ts:108 throw pattern + composes with Q2's full Effect migration. |

## Pre-S1 verification results (2026-05-17)

### ✅ Task 1 · JSON output schema location

**Finding**: NOT in `apps/character-ruggy/persona.md` digest fragment. Grep of the fragment block returned only unrelated hits ("headers" as in headline shape · "section-header your bullets"). The `output: SINGLE JSON object on ONE line, two fields: {"header": "...", "outro": ""}` schema lives ONLY in `voice-brief.ts:110-114` today.

**Implication**: confirms Gap 7's "stays in code" direction, but cycle-008 must explicitly migrate the schema when `voice-brief.ts` is `@deprecated` in S3.

**Decision (locked 2026-05-17 per operator latitude)**: append the JSON output schema in `buildPrompt` as a **cron-only suffix**, same shape as LOCK suffix (Gap 6). Two separate code-appendages at the end of cron systemHalf:
1. JSON output schema block (`output: SINGLE JSON object on ONE line, two fields: ...`)
2. LOCK suffix (`UNTRUSTED_CONTENT_LLM_INSTRUCTION`)

Order: schema first, LOCK second (LOCK closes the system prompt with the security gate). Both engineering-owned, both NOT exposed as persona.md placeholders, both injected only when `shape.kind === 'cron'`. Cycle-009 may reconsider if a `{{CRON_SUFFIX}}` placeholder unifies them, but for cycle-008 simplicity wins.

### ✅ Task 2 · buildVoiceBrief callers (S3 migration scope)

**Production**: 1 call-site — `packages/persona-engine/src/live/claude-sdk.live.ts` (import at line 8 · call at line 31)

**Test fixtures** (preserved post-S3, NOT migrated):
- `packages/persona-engine/src/compose/voice-brief.test.ts`
- `packages/persona-engine/src/compose/voice-brief-continuity.test.ts`

**Implication**: S3 acceptance "only test fixtures retain `buildVoiceBrief` reference after migration" is tight. No surprise call-sites. The test files stay as-is until cycle-009 retires `voice-brief.ts` entirely.

### ✅ Task 3 · Effect blast-radius for Q2 lock-in

**`buildPromptPair`** (cron shim, `loader.ts:403`):
- **0 production callers** · Defined but only referenced in internal comments and the `postType === 'reply'` guard at line 415. Can be removed in S3 cleanup (or kept dormant until cycle-009).

**`buildReplyPromptPair`** (chat shim, `loader.ts:478`):
- **1 production caller** · `packages/persona-engine/src/compose/reply.ts:206`
- **4 smoke scripts** (operator debug tools · NOT prod):
  - `apps/bot/scripts/smoke-data-shape-reply.ts:29,86`
  - `apps/bot/scripts/smoke-voice-variance.ts:19,81`
  - `apps/bot/scripts/smoke-non-data-reply.ts:16,32`
  - `apps/bot/scripts/smoke-resolved-handles.ts:20,95`

**Implication**: effective Effect-TS migration radius is **2 production call-sites**:
- S2: migrate `compose/reply.ts:206` to use `buildPrompt` directly with Effect
- S3: migrate `claude-sdk.live.ts:31` to use `buildPrompt` directly with Effect

**Smoke scripts strategy**: keep `buildReplyPromptPair` as a sync wrapper that internally calls `Effect.runSync(buildPrompt(...))` and unwraps. The 4 smoke scripts stay untouched. Throws synchronously on `BuildPromptError` (`Effect.runSync` semantics). This preserves operator-debug ergonomics while the underlying buildPrompt gains the Effect signature.

### ✅ Task 4 · S5 SDK trace-capture insertion site (scout)

**Primary target**: `packages/persona-engine/src/compose/agent-gateway.ts::invokeAnthropicSdk` (line 147). This is the function `generateDigestVoice` ultimately calls via `invoke(config, req)` dispatch at line 133.

**Pattern to mirror**: the bedrock-direct path at `agent-gateway.ts:187` (`invokeBedrockPlaceholder`) already uses `tracer.startActiveSpan('bedrock.converse', ...)` at line 201 — that span structure is the template. S5 adds an equivalent `tracer.startActiveSpan('anthropic.sdk.converse', ...)` wrapper around `invokeAnthropicSdk`, plus `appendTraceEntry` emit to `apps/bot/.run/llm-trace.jsonl` matching the cycle-007 INV-13 envelope.

**Secondary path**: `packages/persona-engine/src/compose/llm-gateway/live/anthropic.live.ts` is an Effect.tryPromise-wrapped Anthropic adapter (per line 6 doc) — separate consumer of the Anthropic SDK. May already trace via its Effect Layer; verify in S5 implementation. If untraced, mirror the same `appendTraceEntry` injection.

**Other Anthropic SDK importers** (defensive scan): `compose/reply.ts`, `observability/raindrop-instrumentation.ts`, `score/client.ts`, `orchestrator/index.ts` + 4 sub-orchestrator servers. These either:
- Already trace via agent-gateway dispatch (no work needed)
- Are non-LLM SDK uses (e.g., `score/client.ts` — verify)
- Will inherit tracing through agent-gateway centralization

S5 acceptance: at least `invokeAnthropicSdk` traces · `/ruggy <prompt>` slash command produces an llm-trace row · chat-mode reply produces an llm-trace row · both have `fragment_sources[]` from buildPrompt.

## Acceptance criteria for downstream sprints (derived from this spike)

### S1 · persona.md template extensions (post-reframe · much smaller scope)

- `apps/character-ruggy/persona.md` gains **2 new placeholders** (down from 7 originally proposed):
  - `{{ACTIVE_FACTORS}}` — engineering substitutes "factors with activity:" + names-only bullet block
  - `{{PRIOR_WEEK_HINT}}` — engineering substitutes pre-wrapped `<untrusted-content>` continuity hint
- Placement: base template (NOT inside the digest fragment) AFTER `{{ENVIRONMENT}}` (persona.md:657), BEFORE `{{VOICE_ANCHORS}}` (persona.md:664). New `═══ SUBSTRATE STATE (this week) ═══` section heading in the persona.md style.
- NO operator-authored prose under the section heading (would risk voice-flavoring the substrate layer · governance-vs-voice principle).
- NO prose authoring for SHAPE_GUIDANCE variants (placeholder dropped). NO runtime-number placeholders.
- `persona.md` still parses · `loadTemplate()` and `loadFragment('digest')` succeed under Effect-wrapped `buildPrompt`.
- Placeholders unresolved by `buildPrompt` substitution chain fail loud via `BuildPromptError` — no silent leak of literal `{{X}}` to LLM.
- **OP-G1 status**: COLLAPSED for cycle-008 scope (ruggy-only).
- **Effort**: ~10 min operator review of the diff (was ½ day pre-reframe).

### S2 · buildPrompt enrichment + equivalence tests (Effect-shaped)

- `buildPrompt` returns `Effect<BuildPromptResult, BuildPromptError, never>` per locked signature above
- All cycle-008 args default to `undefined` · chat-mode regression fence: `Effect.runPromise(buildPrompt(args_without_cycle008))` produces byte-identical output to today's `buildReplyPromptPair(args)` (Tier 1 strict)
- Eight equivalence scenarios pass at their assigned tier (see matrix above) · ALL run under `Effect.runSync` / `Effect.runPromise` wrappers
- Negative scenarios 9 + 10 pass · scenario 9 verifies `Effect.runSyncExit` returns a `Failure` with `BuildPromptError({kind: 'missing-cron-arg'})`
- New substitution sites land in the systemHalf chain (loader.ts:286-300) and the userHalf cron branch (loader.ts:307-320) — NOT in reply branch
- `bun test packages/persona-engine/src/persona/loader.test.ts` green
- LOCK suffix is appended UNCONDITIONALLY for `shape.kind === 'cron'` · NEVER for `shape.kind === 'reply'` (verified by both positive and negative test)
- All native `throw new Error(...)` sites in loader.ts (lines 108, 281, 414) migrate to `Effect.fail(new BuildPromptError({...}))` — same scope as Effect API migration

### S3 · cron orchestrator migration

- `generateDigestVoice` in `claude-sdk.live.ts` switches from `buildVoiceBrief` to Effect-wrapped `buildPrompt({character, shape: {kind: 'cron', ...}, shapeGuidance, permittedFactors, silencedFactors, priorWeekHint, ...})` per signature above
- Cron call-site becomes `Effect.runPromise(Effect.gen(function* () { const { systemPrompt, userMessage } = yield* buildPrompt(...) ... }))` — `claude-sdk.live.ts` introduces Effect into a module that's currently native try/catch + OTel span
- All 6 cron orchestrators (digest · micro · weaver · lore_drop · question · callout) migrate · spike-validate by grepping for `buildVoiceBrief` import — only test fixtures should retain the reference after S3
- `voice-brief.ts` marked `@deprecated` (NOT deleted · escape hatch for S3 rollback) · `ZONE_VOICE_CONTEXT` map dies with the file (per Gap 8 DROP decision)
- `LOA_PROMPT_BUILDER` env flag added per build doc · **ships `default: 'legacy'`** (operator decision locked 2026-05-17) · S8 flips to `'canonical'` after OP-G2 attestation
- Live-fire gate OP-G2 passes — operator fires `digest:once` × 4 zones via railway run · attests voice is clean

## Spike script auto-delete

This doc is NET 0 LoC. No spike script needed — the diff catalog IS the deliverable. When cycle-008 closes (S8 ledger flip), this doc moves alongside the cycle's COMPLETED.md as historical reference (precedent: cycle-007/agent-debuggability/sdd.md).

## What this spike did NOT survey

- **Other characters' persona.md files** (`satoshi`, `ren`, `akane`, `kaori`, `mongolian`) · cycle-008 scopes Gumi's authoring effort to `apps/character-ruggy/persona.md` only. Cross-character placeholder propagation is cycle-009 candidate.
- **`tool-invocation.md` extraction** from `character.json::tool_invocation_style` · explicitly cut from cycle-008 (Gumi pass · operator-paced · cycle-009).
- **`discord-render.live.ts` legacy renderer migration** · cut from cycle-008 V1 per build doc · expected to retire naturally as pulse-digest + buildPrompt land downstream.
- **buildVoiceBrief test fixtures** at `packages/persona-engine/src/compose/voice-brief.test.ts` · enumerated in scenario matrix but not read into this spike doc. S2 inherits them as the source-of-truth for expected-prompt fixtures.

---

## Pushback items + operator decisions (cycle-008 kickoff · 2026-05-17)

- **#1 OP-G1 critical path** · **RESOLVED** · OP-G1 collapsed (ruggy persona is operator-authored).
- **#2 S3 flag default flip timing** · **LOCKED** · ships `default: 'legacy'`, flip to `'canonical'` in S8.
- **#3 S2 equivalence bar** · **BAKED IN** · 3 tiers + scenario matrix (post-reframe: 5 scenarios + 3 negative).
- **Q1 buildPrompt arg shape** · **LOCKED** · structured render shapes (`PermittedFactorRender` + `SilencedFactorRender`).
- **Q2 Effect-TS scope** · **LOCKED** · `buildPrompt` returns `Effect<Result, BuildPromptError>`. Full loader.ts migration.
- **Q4 zone-voice-context** · **LOCKED** · DROP entirely.
- **Q5 negative cron shape** · **LOCKED** · fail-loud via `Effect.fail(new BuildPromptError(...))`.

### Mid-spike reframe · 2026-05-17

- **Stats-out-of-voice principle** (operator clarification) · **SUPERSEDES** Gap 1+2 and Gap 1 runtime-number substitutions. Ruggy's voice never cites aggregate-window stats (windowDays · prior period · rank thresholds · per-factor magnitude). Substrate's PERMITTED/SILENCED licensing lists ARE the shape signal.
- `{{SHAPE_GUIDANCE}}` placeholder · **DROPPED**.
- `{{WINDOW_DAYS}}` `{{TOTAL_EVENTS}}` `{{PREVIOUS_PERIOD_EVENTS}}` placeholders · **DROPPED**.
- `{{PERMITTED_FACTORS}}` rendered shape · **NAMES-ONLY** (no rank/actors/active_days).
- `{{SILENCED_FACTORS}}` rendered shape · **NAME + REASON** (no rank).
- Memory: `feedback-ruggy-voice-principle`.

End of S0 spike. Ready for S1 kickoff:
- Insert 3 placeholders into `apps/character-ruggy/persona.md` digest fragment (`{{PERMITTED_FACTORS}}` · `{{SILENCED_FACTORS}}` · `{{PRIOR_WEEK_HINT}}`).
- Optional thin operator-authored framing prose around the placeholders ("Below is what the substrate has licensed this week:") if desired; the lists are self-explanatory either way.
- Extend `buildPrompt` (Effect-shaped) with the 3 new args + 2 cron-only code-appended suffixes (JSON schema + LOCK).
- ~¼ day operator authoring + ½-1 day engineering (S2 implementation).
