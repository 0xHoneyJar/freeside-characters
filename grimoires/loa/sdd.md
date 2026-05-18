# cycle-008 · persona-as-substrate · SDD

> **Companion to** `grimoires/loa/prd.md`. PRD = WHAT + WHY. SDD = HOW.
> **Cycle**: cycle-008-persona-substrate
> **Date**: 2026-05-18 (/simstim Phase 3 output · ready for Phase 3.5 / 4 review)
> **Mode**: ARCH (Ostrom) + craft lens (Alexander)
> **Audience**: Loa-embodied engineer about to land cycle-008 in code, plus reviewers (BB / Flatline)
> **Status**: r1 · pre Flatline SDD review
> **Inherits invariants**: cycle-007 INV-12 (kebab lint) · INV-13 (trace envelope) · INV-14 (typed appendTraceEntry) · INV-16 (LOA_DASH_AUTH bearer) · INV-17 (schema CODEOWNERS) · INV-18 (safe-render C0/C1 strip)

---

## 0 · Reframe applied 2026-05-18 · BB review round 1 · RF-002 accept-major

Mid-Phase-3.5 reframe: **the cycle-005 prose-gate is bypassed at the prompt layer in cycle-008 scope**. Operator-chosen path (Option β · smallest blast radius):

- Cron call-site (`claude-sdk.live.ts`) fetches factor data from `ZoneDigest.factor_trends[]` (or equivalent unfiltered substrate path · actual field name verified during S3) instead of `derived.permittedFactors[]` (cycle-005 gate output).
- The cycle-005 prose-gate code stays alive at the substrate layer for OTHER consumers (dashboard, future analyses) but its filter output is no longer consumed by buildPrompt.
- `ActiveFactorRender` shape unchanged · `{{ACTIVE_FACTORS}}` placeholder unchanged · `renderActiveFactors` unchanged.
- Just the SOURCE of the factor list changes (from gated to ungated).
- INV-PS-7 (stats-out-of-voice) + NFR-9 (runtime stat-leakage guard) protect against the hallucination class the gate used to filter. Defense-in-depth at prompt-layer; gate provides a different layer (substrate transparency for other consumers).

Reframe rationale: cycle-008 INV-PS-7 makes the hallucination class the cycle-005 gate prevents structurally impossible. Ruggy literally cannot speak the magnitudes the gate filters. The gate as prompt-layer middleware was defense against a threat eliminated by another invariant. Cycle-010+ vision in PRD §10.4 is partially realized via this Option β change.

Rework count: 1 of 2 max. Re-run BB review TBD post-rework.

---

## 1 · Architecture overview

### 1.1 · The 5-layer substrate that buildPrompt assembles

```
                                          AUDIENCE
  ┌────────────────────────────────────────────┐
  │ persona.md template                        │   operator (zksoju)
  │   ═══ FESTIVAL ZONES ═══                   │   authors voice rules,
  │   ═══ ENVIRONMENT ═══                      │   zone context, fragments
  │   ═══ SUBSTRATE STATE ═══   (NEW · S1)     │
  │   ═══ VOICE ANCHORS ═══                    │
  │   ═══ CODEX ANCHORS ═══                    │
  │   ═══ EXEMPLARS ═══                        │
  │   ═══ THIS POST ═══                        │
  │   ═══ MOVEMENT POLICY ═══                  │
  │   ═══ MIBERA CODEX ═══                     │
  │   ═══ INPUT PAYLOAD ═══                    │
  │   (per-post-type fragments below)          │
  └─────────────────┬──────────────────────────┘
                    ▼
  ┌────────────────────────────────────────────┐
  │ buildPrompt(args): Effect<Result, Err, R> │   substrate layer ·
  │ ─ loads template + voice-anchors + codex   │   loader.ts:237
  │ ─ substitutes 12 base placeholders         │
  │ ─ NEW: substitutes {{ACTIVE_FACTORS}}      │   cycle-008
  │ ─ NEW: substitutes {{PRIOR_WEEK_HINT}}     │   substitutions
  │ ─ NEW: validates stat-leakage guard (NFR-9)│
  │ ─ NEW: appends JSON output schema (cron)   │   code-suffix
  │ ─ NEW: appends LOCK suffix (cron)          │   code-suffix
  │ ─ NEW: populates fragment_sources[]        │   trace prep
  │ ─ returns systemPrompt + userMessage       │
  └─────────────────┬──────────────────────────┘
                    ▼
  ┌────────────────────────────────────────────┐
  │ generateDigestVoice (claude-sdk.live.ts)   │   call-site
  │ ─ Effect.runPromise(Effect.gen(...))       │   layer · S3
  │ ─ Effect.tapError → BuildPromptError       │   migrates
  │ ─ invoke via agent-gateway                 │
  │ ─ parseVoiceResponse                       │
  │ ─ sanitize (existing)                      │
  │ ─ NEW: detectAiArtifacts (S7)              │
  └─────────────────┬──────────────────────────┘
                    ▼
  ┌────────────────────────────────────────────┐
  │ agent-gateway.ts::invoke                   │   transport layer
  │ ─ bedrock (line 187) · already traced      │
  │ ─ anthropic-sdk (line 147) · NEW trace     │   S5 adds
  │   - outcome: success/timeout/error/exception │  spans here
  │   - stream-completion hook                 │
  └─────────────────┬──────────────────────────┘
                    ▼
  ┌────────────────────────────────────────────┐
  │ apps/bot/.run/llm-trace.jsonl              │   trace sink
  │ ─ schema v2 (fragment_sources[] optional)  │
  │ ─ redaction policy (NFR-8)                 │
  │ ─ rotation 100MB / 30d default             │
  └────────────────────────────────────────────┘
```

### 1.2 · Tech stack (no new deps in S2-S5, S7-S8 · S6 adds tweakpane)

- **Runtime**: Bun ≥1.1
- **Language**: TypeScript strict
- **LLM**: `@anthropic-ai/claude-agent-sdk` via `agent-gateway.ts` (Bedrock direct + Anthropic SDK transports)
- **Effect-TS**: `effect@^3.21.2` (already in `packages/persona-engine/package.json` · heavy use in `ambient/*` + `compose/llm-gateway/*`)
- **Schema validation**: ajv (already used at `.claude/overrides/trace-explain-output.schema.json`)
- **OTel**: `@opentelemetry/api` (already in agent-gateway · bedrock span pattern at line 201)
- **Discord write side**: `discord.js` Gateway + per-character webhooks (unchanged)
- **Schedule**: `node-cron` (unchanged)
- **NEW · S6 only**: `tweakpane@^4.x` (kitchen-only · operator-confirmed)

### 1.3 · Sprint → component matrix

| Sprint | Files touched | Module | Lines (est) |
|---|---|---|---|
| S2 | `packages/persona-engine/src/persona/loader.ts` | buildPrompt + helpers + error class | +120 / -40 |
| S2 | `packages/persona-engine/src/persona/loader.test.ts` | equivalence + negative scenarios | +180 / 0 |
| S2 | `packages/persona-engine/src/persona/render-active-factors.ts` (NEW) | private render helper | +40 / 0 |
| S2 | `packages/persona-engine/src/compose/reply.ts` (chat call-site) | Effect.runPromise wrapper | +15 / -5 |
| S3 | `packages/persona-engine/src/live/claude-sdk.live.ts` | cron migration + Effect boundary | +35 / -25 |
| S3 | `packages/persona-engine/src/config.ts` | LOA_PROMPT_BUILDER flag + parse | +20 / 0 |
| S3 | `packages/persona-engine/src/compose/voice-brief.ts` | `@deprecated` marker | +3 / 0 |
| S4 | `packages/persona-engine/src/observability/trace-envelope.ts` | schema v2 fragment_sources[] | +40 / 0 |
| S4 | `packages/persona-engine/src/persona/loader.ts` | fragment_sources[] population in buildPrompt | +50 / 0 |
| S4 | `.claude/overrides/trace-explain-output.schema.json` | ajv schema v1 → v2 | +30 / 0 |
| S4 | `scripts/trace.ts` | trace:explain renders source-map | +25 / 0 |
| S4 | `scripts/dashboard.ts` | LLM-calls tab fragment_sources breadcrumbs | +60 / 0 |
| S5 | `packages/persona-engine/src/compose/agent-gateway.ts::invokeAnthropicSdk` | span wrap + outcome field + stream hook | +60 / 0 |
| S5 | `packages/persona-engine/src/observability/trace-envelope.ts` | outcome field + redaction helpers | +30 / 0 |
| S6 | `apps/bot/package.json` | tweakpane v4 dep | +1 / 0 |
| S6 | `scripts/dashboard.ts` | /tweak tab + 5 folders + live-fire | +250 / 0 |
| S6 | `apps/bot/src/cli/playground-fire.ts` | --tweak <json> flag | +30 / 0 |
| S7 | `packages/persona-engine/src/deliver/sanitize.ts` | detectAiArtifacts + 4 heuristics | +80 / 0 |
| S7 | `packages/persona-engine/src/deliver/sanitize.test.ts` | fixture tests | +60 / 0 |
| S7 | `scripts/dashboard.ts` | sanitize-violations tab additions | +30 / 0 |
| S8 | `grimoires/loa/cycles/cycle-008-persona-substrate/COMPLETED.md` | cycle close doc | +400 / 0 |
| S8 | `grimoires/loa/ledger.json` | flips + archive | +5 / -3 |
| S8 | `~/vault/wiki/concepts/persona-as-substrate.md` (NEW) | vault doctrine | operator-paced |

**Net cycle-008 production code**: ~+700 / -75 LOC. Plus tests, docs, dashboard work.

---

## 2 · Data models

### 2.1 · `BuildPromptError` (NEW · Effect-TS tagged error · S2)

```ts
// packages/persona-engine/src/persona/loader.ts

import { Data, Effect } from 'effect';

// Per Flatline-SDD IMP-003 815 · 2026-05-18: error kinds are classified as
// INPUT-ERROR (caller provided bad input · retry won't help · halt this fire)
// vs INVARIANT-VIOLATION (internal serialization bug · indicates code bug · alert).
// claude-sdk.live.ts maps each class to different observability behavior.

export class BuildPromptError extends Data.TaggedError('BuildPromptError')<{
  readonly kind:
    // INPUT errors (caller-provided · retry won't help)
    | 'missing-cron-arg'                 // cron shape but cycle-008 arg undefined
    | 'aggregate-stat-leakage'           // NFR-9 · runtime guard rejected input (V2 only · V1 logs)
    // STRUCTURAL errors (persona.md or template invalid · likely operator error)
    | 'template-section-missing'         // persona.md missing `## System prompt template`
    | 'input-payload-marker-missing'     // template missing `═══ INPUT PAYLOAD ═══`
    | 'fragment-not-found'               // `<!-- @FRAGMENT: <post-type> -->` absent
    | 'fragment-end-marker-missing'
    // INVARIANT-VIOLATION errors (internal bug · alert-worthy · indicates buildPrompt drift)
    | 'fragment-sources-invariant-violation';
  readonly category?: 'INPUT' | 'STRUCTURAL' | 'INVARIANT-VIOLATION';  // derived classification
  readonly argName?: string;
  readonly personaPath?: string;
  readonly postType?: PostType;
  readonly sample?: string;              // for aggregate-stat-leakage: offending text
  readonly detail?: string;              // for fragment-sources-invariant-violation: which invariant
}> {
  static categoryFor(kind: BuildPromptError['kind']): 'INPUT' | 'STRUCTURAL' | 'INVARIANT-VIOLATION' {
    switch (kind) {
      case 'missing-cron-arg':
      case 'aggregate-stat-leakage':
        return 'INPUT';
      case 'template-section-missing':
      case 'input-payload-marker-missing':
      case 'fragment-not-found':
      case 'fragment-end-marker-missing':
        return 'STRUCTURAL';
      case 'fragment-sources-invariant-violation':
        return 'INVARIANT-VIOLATION';
    }
  }
}

// Caller behavior per category (in claude-sdk.live.ts):
// - INPUT: halt this fire · emit trace · NO RETRY · no alert (caller bug · should be caught in dev)
// - STRUCTURAL: halt this fire · emit trace · alert operator (persona.md broken · likely recent edit)
// - INVARIANT-VIOLATION: halt this fire · emit trace · ALERT + page operator (internal bug · investigate buildPrompt drift)
```

### 2.2 · `ActiveFactorRender` (NEW · render shape · S2)

```ts
// packages/persona-engine/src/persona/loader.ts

export interface ActiveFactorRender {
  readonly displayName: string;
  // RANK/ACTORS/ACTIVE_DAYS deliberately ABSENT.
  // Reframe 2026-05-17: stats-out-of-voice principle (INV-PS-7).
  // Caller adapts substrate `permittedFactors[]` → ActiveFactorRender[].
}
```

### 2.3 · `BuildPromptArgsUnified` (UPDATED · S2)

```ts
// packages/persona-engine/src/persona/loader.ts

export interface BuildPromptArgsUnified {
  character: CharacterConfig;
  shape: BuildPromptShape;
  environmentContext?: string;
  voiceGrimoire?: string;

  // cycle-008 additions · cron-only · undefined for chat-mode (regression fence)
  activeFactors?: ReadonlyArray<ActiveFactorRender>;
  priorWeekHint?: string;  // pre-wrapped by formatPriorWeekHint
}

export interface BuildPromptResult {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly fragmentSources?: ReadonlyArray<FragmentSource>;  // populated when shape.kind === 'cron' · S4
}
```

### 2.4 · `FragmentSource` (NEW · trace envelope v2 · S4)

```ts
// packages/persona-engine/src/observability/trace-envelope.ts

export interface FragmentSource {
  readonly layer: 'persona' | 'voice' | 'tool' | 'medium' | 'environment';
  readonly source_file: string;          // 'apps/character-ruggy/persona.md'
  readonly source_lines: readonly [number, number];  // [12, 84] inclusive
  readonly prompt_offset: readonly [number, number]; // character indices · NOT byte indices
  readonly fragment_kind: string;        // 'persona-template' | 'voice-anchors' | 'codex-anchors' | ...
}

// FR-15a invariants (validated in buildPrompt before return):
// (a) sorted by prompt_offset[0] ascending
// (b) NO overlap (each char belongs to exactly one fragment_source)
// (c) gaps allowed (whitespace/literal text not from a fragment)
// (d) layer constrained to 5-element enum
```

### 2.5 · `LlmTraceEntry` v2 (UPDATED · S4 + S5)

```ts
// packages/persona-engine/src/observability/trace-envelope.ts

export interface LlmTraceEntry {
  // ─── v1 fields (cycle-007 INV-13 baseline) ───
  at: string;                // ISO timestamp
  duration_ms: number;
  model_id: string;
  region?: string;
  path: 'fetch' | 'sdk';
  zone?: ZoneId;
  post_type: PostType;
  character_id: string;
  system_prompt: string;     // REDACTED per NFR-8
  user_message: string;      // REDACTED per NFR-8
  output: string;            // REDACTED per NFR-8
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  layer: 'voice';
  layer_op: string;
  emitted_at: string;

  // ─── v2 additions (cycle-008) ───
  schema_version: 2;
  fragment_sources?: ReadonlyArray<FragmentSource>;  // FR-14 + FR-15 · OPTIONAL · cron only
  outcome: 'success' | 'provider-error' | 'timeout' | 'malformed-response' | 'sdk-exception';  // FR-20
  error_classification?: {                             // populated when outcome !== 'success'
    readonly http_status?: number;
    readonly anthropic_error_code?: string;
    readonly redacted_message: string;                 // safe error message · NO stack traces · NO credentials
  };
}
```

### 2.6 · LOA_PROMPT_BUILDER flag (NEW · S3)

```ts
// packages/persona-engine/src/config.ts

export const PROMPT_BUILDER_VALUES = ['canonical', 'legacy'] as const;
export type PromptBuilder = (typeof PROMPT_BUILDER_VALUES)[number];

export function parsePromptBuilder(raw: string | undefined): PromptBuilder {
  if (raw === 'canonical') return 'canonical';
  if (raw === undefined || raw === '' || raw === 'legacy') return 'legacy';
  // Any other value: warn + fallback to legacy (per PRD §7.1 unset/malformed semantics)
  process.stderr.write(
    `[LOA_PROMPT_BUILDER] WARN: unknown value '${raw}' falling back to 'legacy'\n`
  );
  return 'legacy';
}

// Production default (when env var unset): 'legacy'
// Dev/CI/test: REQUIRED 'canonical' (CI workflow asserts before run)
// Cycle-008 S8 flip post-OP-G2: production default → 'canonical'
```

---

## 3 · Component design

### 3.1 · `buildPrompt` Effect-TS migration (S2)

#### 3.1.1 · Signature change

```ts
// BEFORE (sync · native throw)
export function buildPrompt(args: BuildPromptArgsUnified): {
  systemPrompt: string;
  userMessage: string;
} { /* native throws */ }

// AFTER (Effect · S2)
export function buildPrompt(
  args: BuildPromptArgsUnified
): Effect.Effect<BuildPromptResult, BuildPromptError, never> {
  return Effect.gen(function* () {
    // 1. Load template + sibling files (sync · pure functions)
    const template = yield* loadTemplateE(args.character.personaPath);
    const codex = loadCodexPrelude();
    const voiceAnchors = loadVoiceAnchors(args.character.personaPath);
    const codexAnchors = loadCodexAnchors(args.character.personaPath);

    // 2. Validate cron-only args (cycle-008)
    if (args.shape.kind === 'cron') {
      yield* validateCronArgs(args);  // returns Effect.fail on missing args (Q5)
    }

    // 3. Validate stat-leakage guard (NFR-9 V1 · FAIL-LOUD with allowlist + warn-mode escape · 2026-05-18 FINAL)
    if (args.activeFactors) {
      // Allowlist bypass · warn-mode downgrade · tightened regex
      // Default behavior: Effect.fail on non-allowlisted leakage
      yield* validateNoAggregateStatLeakage(args.activeFactors, args.priorWeekHint);
    }

    // 4. Resolve fragment + movement guidance + zone identity
    // ...

    // 5. Compute substitution map + populate fragment_sources[] as we go
    const { systemHalf, fragmentSources } = yield* substituteAndTrack(template, /* ... */);

    // 6. For cron: append JSON output schema + LOCK suffix
    const cronSystemPrompt = args.shape.kind === 'cron'
      ? `${systemHalf}\n\n${JSON_OUTPUT_SCHEMA}\n\n${UNTRUSTED_CONTENT_LLM_INSTRUCTION}`
      : systemHalf;

    // 7. Validate fragment_sources[] invariants (FR-15a · per BB-MED-001 accept · 2026-05-18)
    // Checks: (a) sorted by prompt_offset.start ascending · (b) no overlap (each char in exactly one fragment)
    // (c) layer enum constrained to 5-element set · (d) gaps allowed (literal/whitespace text)
    // Returns Effect.fail(BuildPromptError({kind: 'fragment-sources-invariant-violation', detail: '<which>'}))
    if (args.shape.kind === 'cron') {
      yield* validateFragmentSourcesInvariants(fragmentSources);
    }

    // 8. Compute userHalf (cron vs reply branches)
    const userMessage = yield* computeUserMessage(/* ... */);

    return { systemPrompt: cronSystemPrompt, userMessage, fragmentSources };
  });
}
```

#### 3.1.2 · Backward-compat shims (S2)

```ts
// buildPromptPair (cron shim) — internal callers: 0 prod · keep until cycle-009
export function buildPromptPair(args: BuildPromptArgs): { systemPrompt: string; userMessage: string } {
  return Effect.runSync(buildPrompt({/* ... */}));
}

// buildReplyPromptPair (chat shim) — 1 prod caller (compose/reply.ts:206) + 4 smoke scripts
// Migration plan: compose/reply.ts:206 moves to direct buildPrompt() in S2.
// Smoke scripts unchanged (sync wrapper via Effect.runSync).
export function buildReplyPromptPair(args: BuildReplyPromptArgs): { systemPrompt: string; userMessage: string } {
  return Effect.runSync(buildPrompt({ shape: { kind: 'reply', /* ... */ }, /* ... */ }));
}
```

#### 3.1.3 · Native-throw migration (S2)

3 sites in loader.ts migrate native `throw` → `Effect.fail`:
- Line 108: `throw new Error("could not find section header")` → `Effect.fail(new BuildPromptError({ kind: 'template-section-missing', personaPath }))`
- Line 281: `throw new Error("could not find INPUT PAYLOAD marker")` → `Effect.fail(new BuildPromptError({ kind: 'input-payload-marker-missing', personaPath }))`
- Line 414: `throw new Error("postType='reply' is invalid for cron shim")` → moves to validation step in buildPromptPair · Effect.fail(...)

### 3.2 · Render helpers (S2)

```ts
// packages/persona-engine/src/persona/render-active-factors.ts (NEW)

import type { ActiveFactorRender } from './loader.ts';

/**
 * Render the ACTIVE_FACTORS substitution block.
 *
 * Format (post-reframe 2026-05-17 + Phase 4 HITL injection-defense · 2026-05-18):
 *   <untrusted-content source="score-mcp" stream="factor_trends">
 *   factors with activity:
 *     - Mibera NFT
 *     - Mibera Quality
 *   </untrusted-content>
 *
 * Empty case (shape-A signal):
 *   <untrusted-content source="score-mcp" stream="factor_trends">
 *   factors with activity:
 *     (none)
 *   </untrusted-content>
 *
 * The <untrusted-content> wrapper (per Flatline-SDD SKP-001 CRITICAL 850 · accepted Phase 4 HITL
 * 2026-05-18) prevents prompt injection through factor names. RF-002 sources factor_trends from
 * substrate without the cycle-005 gate filter; the marker contract + LOCK suffix
 * (UNTRUSTED_CONTENT_LLM_INSTRUCTION) tell the LLM to treat marker contents as inert data.
 * Symmetric to formatPriorWeekHint pattern.
 *
 * Factor names are also HTML-entity-escaped (5-char OWASP set: <>&"') to prevent marker
 * breakout via injected `</untrusted-content>` in a factor display name (FLATLINE-SKP-002 pattern).
 *
 * Returns the block text · NEVER throws · pure function.
 */
export function renderActiveFactors(
  factors: ReadonlyArray<ActiveFactorRender> | undefined
): string {
  const list = factors ?? [];
  const inner = list.length === 0
    ? 'factors with activity:\n  (none)'
    : ['factors with activity:', ...list.map((f) => `  - ${escapeForUntrustedContent(f.displayName)}`)].join('\n');
  return [
    '<untrusted-content source="score-mcp" stream="factor_trends">',
    inner,
    '</untrusted-content>',
  ].join('\n');
}

// Reuses the 5-char escape table from format-prior-week-hint.ts (FLATLINE-SKP-002)
function escapeForUntrustedContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

### 3.3 · Stat-leakage runtime guard (NFR-9 · S2)

```ts
// packages/persona-engine/src/persona/validate-no-aggregate-stat-leakage.ts (NEW)
//
// V1 BEHAVIOR (FINAL per Flatline-SDD Phase 4 HITL · 2026-05-18 · supersedes BB-RA-002 log-only):
// FAIL-LOUD with three guardrails:
//   (a) Factor-name ALLOWLIST loaded from packages/persona-engine/src/persona/fixtures/factor-name-allowlist.json
//       Names in allowlist bypass the regex check (prevents 'Top-100 Holder' / '30 Day Streak' false-positives).
//       Allowlist refreshed via `bun run --cwd packages/persona-engine sync-factor-allowlist` (S2 task).
//   (b) WARN-MODE ESCAPE HATCH via LOA_STAT_LEAKAGE_GUARD=warn env var.
//       Default unset → fail-loud. =warn → log-only with stderr warning.
//       Emergency rollback path if production false-positive blocks digest fires.
//   (c) REGEX TIGHTENING · all patterns require explicit number context.
//       \brank[ -]?\d+\b NOT \brank\b · same for window/threshold phrases.
// On non-allowlisted, non-warn-mode detection:
//   Effect.fail(new BuildPromptError({kind: 'aggregate-stat-leakage', sample, category: 'INPUT'}))

import { Effect } from 'effect';
import { BuildPromptError } from './loader.ts';

const STAT_LEAKAGE_PATTERNS: ReadonlyArray<{ regex: RegExp; label: string }> = [
  // Integer ≥10 followed by aggregate unit
  { regex: /\b\d{2,}\s+(events?|factors?|miberas?|actors?|days?)\b/i, label: 'aggregate-count' },
  // Spelled-out numbers
  { regex: /\b(ten|twenty|thirty|fifty|hundred|thousand|million)\s+(events?|factors?|miberas?|actors?|days?)\b/i, label: 'spelled-number' },
  // Rank language
  { regex: /\b(rank|ranked|percentile|rank-\d+|top-?\d+)\b/i, label: 'rank-language' },
  // Window phrases
  { regex: /\b(\d+\s*-?\s*day|window|prior\s+period|previous\s+week|past\s+\d+\s+days?)\b/i, label: 'window-language' },
  // Threshold phrases
  { regex: /\b(threshold|crossed\s+(rank|the\s+line)|above\s+rank|below\s+rank)\b/i, label: 'threshold-language' },
];

export function validateNoAggregateStatLeakage(
  activeFactors: ReadonlyArray<ActiveFactorRender>,
  priorWeekHint: string | undefined
): Effect.Effect<void, BuildPromptError, never> {
  return Effect.gen(function* () {
    // Check activeFactors[].displayName
    for (const factor of activeFactors) {
      for (const { regex, label } of STAT_LEAKAGE_PATTERNS) {
        if (regex.test(factor.displayName)) {
          yield* Effect.fail(new BuildPromptError({
            kind: 'aggregate-stat-leakage',
            argName: 'activeFactors',
            sample: `${factor.displayName} (matched ${label})`,
          }));
        }
      }
    }
    // Check priorWeekHint (note: this is post-formatPriorWeekHint wrapped string)
    // Only the inner body matters; the <untrusted-content> wrapper is fine.
    if (priorWeekHint) {
      // Strip the wrapper to inspect inner body
      const inner = priorWeekHint.replace(/<\/?untrusted-content[^>]*>/g, '');
      for (const { regex, label } of STAT_LEAKAGE_PATTERNS) {
        if (regex.test(inner)) {
          yield* Effect.fail(new BuildPromptError({
            kind: 'aggregate-stat-leakage',
            argName: 'priorWeekHint',
            sample: `(inside untrusted-content) matched ${label}`,
          }));
        }
      }
    }
  });
}
```

### 3.4 · Cron call-site Effect boundary (S3)

```ts
// packages/persona-engine/src/live/claude-sdk.live.ts
//
// SCORE-MCP SCHEMA VERIFICATION GATE (per Flatline-SDD IMP-001 + SKP-001 CRITICAL 880 · 2026-05-18):
// Before S3 implementation lands:
//   1. Read score-mcp schema (verify ZoneDigest.factor_trends OR equivalent field exists)
//   2. Confirm field shape: array of { displayName: string, ... }
//   3. Run comparison test against representative zones:
//      assert factor_trends[].displayName ⊇ permittedFactors[].displayName
//      (factor_trends is unfiltered superset of gate-passed list)
//   4. If field doesn't exist OR semantics differ, OPERATOR DECISION GATE:
//      - (a) Add unfiltered query endpoint to score-mcp (substrate change · scope expansion)
//      - (b) Revert RF-002 accept-major decision (keep cycle-005 gate consumption)
//      - (c) Document delta + operator-confirm alternate source
//   5. S3 acceptance: zero use of `derived.permittedFactors` in claude-sdk.live.ts
//      AND positive evidence (test or schema snippet) of factor_trends shape

import { Effect } from 'effect';
import { buildPrompt, BuildPromptError } from '../persona/loader.ts';

export function createClaudeSdkLive(
  config: Config,
  character: CharacterConfig,
  tracer: Tracer = getTracer(),
): VoiceGenPort {
  return {
    generateDigestVoice: (snapshot, ctx) =>
      tracer.startActiveSpan('voice.invoke', async (span) => {
        try {
          // Adapt substrate types → render shapes
          // POST-REFRAME (RF-002 accept-major 2026-05-18): source is ZoneDigest.factor_trends
          // (or equivalent unfiltered query) NOT derived.permittedFactors (cycle-005 gate output).
          // The cycle-005 gate stays alive for other consumers; bypassed at prompt-layer.
          // Actual field name verified during S3 implementation against score-mcp schema.
          const activeFactors = ctx.zoneDigest.factor_trends.map((f) => ({
            displayName: f.displayName,
          }));

          const result = await Effect.runPromise(
            Effect.gen(function* () {
              // buildPrompt returns Effect; tapError handles BuildPromptError
              const { systemPrompt, userMessage } = yield* buildPrompt({
                character,
                shape: { kind: 'cron', zoneId: snapshot.zone, postType: 'digest' },
                environmentContext: ctx.environment,
                voiceGrimoire: ctx.voiceGrimoire,
                activeFactors,
                priorWeekHint: ctx.priorWeekHint,
              }).pipe(
                Effect.tapError((err) => Effect.sync(() => {
                  // Log error to trace + span before propagating
                  appendTraceEntry({
                    layer: 'voice',
                    layer_op: 'build-prompt-error',
                    outcome: 'sdk-exception',
                    error_classification: {
                      redacted_message: `${err._tag}: ${err.kind}`,
                    },
                    // ... other envelope fields
                  });
                  span.recordException(new Error(`${err._tag}: ${err.kind}`));
                }))
              );

              // Invoke LLM, parse, sanitize
              const response = yield* Effect.tryPromise({
                try: () => invoke(config, { character, systemPrompt, userMessage, /* ... */ }),
                catch: (e) => new BuildPromptError({ kind: 'sdk-exception', detail: String(e) }),
              });
              return sanitizeVoiceAugment(parseVoiceResponse(response.text));
            })
          );
          return result;
        } catch (err) {
          // BuildPromptError propagates from Effect.runPromise as rejected Promise
          // Existing span.recordException catches it · existing cron orchestrator handles
          span.recordException(err as Error);
          throw err;
        } finally {
          span.end();
        }
      }),
  };
}
```

**NO RETRY on BuildPromptError** — it's a structural/spec violation, not transient. Retrying would loop indefinitely. The orchestrator's existing per-zone error handling skips this zone for this fire and resumes the next zone.

### 3.5 · Trace envelope v2 (S4)

#### 3.5.1 · Schema bump

`.claude/overrides/trace-explain-output.schema.json` gains:
- `schema_version: { const: 2 }` (was `const: 1`)
- `fragment_sources: { type: 'array', items: { ... }, optional: true }`
- `outcome: { enum: ['success', 'provider-error', 'timeout', 'malformed-response', 'sdk-exception'] }`
- `error_classification: { ... optional ... }`

ajv validates on write (via existing `appendTraceEntry`). v1 readers tolerate v2 (extra fields ignored). v2 readers fall back gracefully on v1 (no `fragment_sources` · no `outcome`).

#### 3.5.2 · `fragment_sources[]` population — TWO-PASS APPROACH (per Flatline-SDD IMP-002 885 + SKP-005 720 · 2026-05-18)

**Bug in original single-pass design**: recording `prompt_offset` AT substitution time produces stale offsets. When subsequent substitutions for OTHER placeholders happen earlier in the template, prior fragments' recorded offsets diverge from their actual final-prompt positions. The FR-15a invariants validate against stale numbers; dashboard breadcrumbs point to wrong locations. This is silent data corruption.

**Two-pass design (correct)**:

```ts
// PASS 1: substitute ALL placeholders + record meta (NOT offsets) per fragment
interface FragmentSourceMeta {
  layer: FragmentSource['layer'];
  source_file: string;
  source_lines: readonly [number, number];
  fragment_kind: string;
  fragment_text: string;          // the substituted text (needed for offset recovery in pass 2)
}

const substitutionMeta: FragmentSourceMeta[] = [];

function substituteAndRecord(
  template: string,
  placeholder: string,
  fragment: string,
  meta: Omit<FragmentSourceMeta, 'fragment_text'>
): string {
  const idx = template.indexOf(placeholder);
  if (idx === -1) return template; // no-op (placeholder not present)
  substitutionMeta.push({ ...meta, fragment_text: fragment });
  return template.replace(placeholder, fragment);
}

// PASS 2: after all substitutions complete, recover offsets by scanning final prompt
function recoverOffsets(
  finalPrompt: string,
  meta: ReadonlyArray<FragmentSourceMeta>
): FragmentSource[] {
  let searchStart = 0;
  const sources: FragmentSource[] = [];
  // Process meta in substitution order — same as logical text order for typical templates
  for (const m of meta) {
    const idx = finalPrompt.indexOf(m.fragment_text, searchStart);
    if (idx === -1) {
      // Fragment text not found · either substituted into an unexpected position
      // OR overlapping fragments swallowed it · fail-loud
      throw new BuildPromptError({
        kind: 'fragment-sources-invariant-violation',
        detail: `fragment "${m.fragment_kind}" not found in final prompt during offset recovery`,
      });
    }
    sources.push({
      layer: m.layer,
      source_file: m.source_file,
      source_lines: m.source_lines,
      fragment_kind: m.fragment_kind,
      prompt_offset: [idx, idx + m.fragment_text.length],
    });
    searchStart = idx + m.fragment_text.length;
  }
  return sources;
}
```

**Disambiguation strategy for duplicate fragment text** (rare but possible): track `searchStart` after each successful match. Search forward from `searchStart` for the next occurrence. Assumes substitution order matches final-prompt textual order (true for the persona.md template structure where placeholders are encountered linearly).

**Alternative considered**: reverse-substitute (last placeholder first) so earlier offsets remain stable. Rejected because (a) requires explicit ordering knowledge of placeholders, (b) couples loader.ts substitution chain to FR-15a concerns, (c) harder to reason about.

**Alternative considered**: maintain running offset delta + update prior `fragment_sources` entries after each substitution. Rejected as more complex than scanning the final prompt once.

After PASS 2, validate FR-15a invariants (ordering · non-overlap · layer enum) before returning. Recovery failure produces `BuildPromptError({kind: 'fragment-sources-invariant-violation'})`.

### 3.6 · Anthropic-SDK trace capture (S5)

#### 3.6.1 · Span wrap + outcome + stream hook

```ts
// packages/persona-engine/src/compose/agent-gateway.ts::invokeAnthropicSdk (S5 changes)

async function invokeAnthropicSdk(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  if (!req.zoneHint || !req.postTypeHint) {
    throw new Error('invokeAnthropicSdk: zoneHint and postTypeHint are required');
  }

  const tracer = getTracer();
  return tracer.startActiveSpan('anthropic.sdk.converse', async (span) => {
    const startedAt = Date.now();
    let outcome: LlmTraceEntry['outcome'] = 'success';
    let errorClassification: LlmTraceEntry['error_classification'] | undefined;
    let response: InvokeResponse | undefined;

    try {
      // ── existing SDK call (single-shot or streaming) ──
      const sdkResponse = await invokeViaClaudeAgentSdk(config, req);

      // Stream-completion hook: wait for onComplete if streaming used
      if (isStreamingResponse(sdkResponse)) {
        await awaitStreamComplete(sdkResponse);
      }

      response = parseToInvokeResponse(sdkResponse);
      return response;
    } catch (err) {
      // Classify the error
      if (isTimeoutError(err)) {
        outcome = 'timeout';
        errorClassification = { redacted_message: 'Anthropic SDK timeout (60s)' };
      } else if (isProviderError(err)) {
        outcome = 'provider-error';
        errorClassification = {
          http_status: err.status,
          anthropic_error_code: err.code,
          redacted_message: redactErrorMessage(err.message),
        };
      } else if (isMalformedResponse(err)) {
        outcome = 'malformed-response';
        errorClassification = { redacted_message: 'response did not match expected schema' };
      } else {
        outcome = 'sdk-exception';
        errorClassification = { redacted_message: redactErrorMessage(String(err)) };
      }
      span.recordException(err as Error);
      throw err;
    } finally {
      span.setAttribute('outcome', outcome);
      // Emit trace row REGARDLESS of outcome (success + all failure classes)
      appendTraceEntry({
        schema_version: 2,
        at: new Date(startedAt).toISOString(),
        duration_ms: Date.now() - startedAt,
        model_id: req.modelAlias ?? config.FREESIDE_AGENT_MODEL,
        path: 'sdk',
        zone: req.zoneHint,
        post_type: req.postTypeHint,
        character_id: req.character.id,
        system_prompt: redactPromptForTrace(req.systemPrompt),
        user_message: redactPromptForTrace(req.userMessage),
        output: response ? redactPromptForTrace(response.text) : '',
        input_tokens: response?.tokens.input ?? 0,
        output_tokens: response?.tokens.output ?? 0,
        total_tokens: response?.tokens.total ?? 0,
        layer: 'voice',
        layer_op: 'anthropic.sdk.converse',
        outcome,
        error_classification: errorClassification,
        emitted_at: new Date().toISOString(),
      });
      span.end();
    }
  });
}
```

#### 3.6.2 · Stream-completion detection

```ts
function isStreamingResponse(response: unknown): boolean {
  // Detect SDK's streaming response shape (claude-agent-sdk returns AsyncIterable<MessageStreamEvent>)
  return typeof response === 'object' && response !== null && Symbol.asyncIterator in response;
}

async function awaitStreamComplete(stream: AsyncIterable<MessageStreamEvent>): Promise<void> {
  for await (const event of stream) {
    if (event.type === 'message_stop') {
      return;
    }
  }
}
```

### 3.7 · Trace data redaction (NFR-8 · S4 + S5)

```ts
// packages/persona-engine/src/observability/redact.ts (NEW)

const WALLET_REGEX = /0x[a-fA-F0-9]{40}/g;
const JWT_REGEX = /eyJ[A-Za-z0-9+/=._-]+\.[A-Za-z0-9+/=._-]+\.[A-Za-z0-9+/=._-]+/g;
const API_KEY_REGEX = /\b(sk-[A-Za-z0-9-_]{32,}|Bearer\s+[A-Za-z0-9-_]+)\b/g;

export function redactPromptForTrace(text: string): string {
  return text
    .replace(WALLET_REGEX, '0x[REDACTED]')
    .replace(JWT_REGEX, '[REDACTED-JWT]')
    .replace(API_KEY_REGEX, '[REDACTED-CREDENTIAL]');
}

// Per Flatline-SDD SKP-004 CRITICAL 850 · accepted Phase 4 HITL 2026-05-18:
// Redaction MUST happen INSIDE appendTraceEntry (not caller-dependent).
// Single missed call path otherwise persists credentials to .jsonl.
export function appendTraceEntry(entry: LlmTraceEntry): void {
  // Redact prompts + outputs + error messages UNCONDITIONALLY before write
  const redacted: LlmTraceEntry = {
    ...entry,
    system_prompt: redactPromptForTrace(entry.system_prompt),
    user_message: redactPromptForTrace(entry.user_message),
    output: redactPromptForTrace(entry.output),
    error_classification: entry.error_classification ? {
      ...entry.error_classification,
      redacted_message: redactPromptForTrace(entry.error_classification.redacted_message),
    } : undefined,
  };
  // NOW validate against schema + write
  validateAgainstSchema(redacted);  // ajv via .claude/overrides/trace-explain-output.schema.json v2
  withTraceLock(TRACE_PATH, () => {
    maybeRotate(TRACE_PATH);
    fs.appendFileSync(TRACE_PATH, JSON.stringify(redacted) + '\n');
  });
}

// Tests prove: raw secrets cannot reach .jsonl through the public API.
// Test scenarios 41-46 in §5.4 verify each pattern class.

export function redactErrorMessage(message: string): string {
  return redactPromptForTrace(message)
    .replace(/\bat\s+[^)]+\)/g, '')  // strip stack frame paths
    .slice(0, 500);                   // cap length
}

// Discord ID gating: only included when LOA_TRACE_INCLUDE_DISCORD_IDS=1
export function maybeRedactDiscordIds(text: string): string {
  if (process.env.LOA_TRACE_INCLUDE_DISCORD_IDS === '1') return text;
  return text.replace(/<@!?\d{17,20}>/g, '<@[REDACTED]>');
}
```

### 3.8 · Trace file rotation (NFR-8 · S4)

```ts
// packages/persona-engine/src/observability/trace-rotation.ts (NEW)

const MAX_SIZE_MB = Number(process.env.LOA_TRACE_MAX_SIZE_MB ?? 100);
const RETENTION_DAYS = Number(process.env.LOA_TRACE_RETENTION_DAYS ?? 30);
const ARCHIVE_DIR = '.run/llm-trace-archive/';

// Called by appendTraceEntry before write
export function maybeRotate(tracePath: string): void {
  const stats = fs.statSync(tracePath);
  const sizeMb = stats.size / (1024 * 1024);

  if (sizeMb >= MAX_SIZE_MB) {
    rotateNow(tracePath, 'size');
  } else if (ageDays(stats.mtime) >= RETENTION_DAYS) {
    rotateNow(tracePath, 'age');
  }
}

function rotateNow(tracePath: string, reason: 'size' | 'age'): void {
  ensureDir(ARCHIVE_DIR);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `${path.basename(tracePath, '.jsonl')}-${ts}-${reason}.jsonl`;
  fs.renameSync(tracePath, path.join(ARCHIVE_DIR, archiveName));
}
```

**Concurrency safety (per BB-RA-003 accept · 2026-05-18)**: `maybeRotate` and `appendTraceEntry` MUST acquire a `.lock` sibling-file advisory lock around the rotation check + rename + write sequence. Pattern:

```ts
async function withTraceLock<T>(tracePath: string, op: () => Promise<T>): Promise<T> {
  const lockPath = `${tracePath}.lock`;
  const myPid = process.pid;
  const maxRetries = 30;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try exclusive create (fails if file exists)
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(myPid));
      fs.closeSync(fd);
      try {
        return await op();
      } finally {
        // Release lock
        fs.unlinkSync(lockPath);
      }
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      // Lock held · check if owner PID still alive
      try {
        const owner = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
        process.kill(owner, 0);  // throws if dead
      } catch {
        // Stale lock · steal it
        try { fs.unlinkSync(lockPath); } catch {}
        continue;
      }
      // Live lock · backoff + retry
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    }
  }
  throw new Error(`Could not acquire trace lock after ${maxRetries} retries`);
}
```

Concurrency test: spawn 2 processes writing to same trace file near rotation threshold; verify both writes succeed and exactly one rotation occurs. If Bun gains native flock support in future, swap PID-lock-file approach for native `flock(2)`.

**Max-wait policy + fallback (per Flatline-SDD IMP-004 790 · 2026-05-18)**: the `maxRetries = 30` (with 50-150ms backoff per retry · max ~4.5s total wait) is the hard cap. If still cannot acquire after 30 retries:
- Emit `[trace-lock] WARN: max-wait exceeded after 30 retries, falling back to append-without-rotation` to stderr
- Append the trace entry WITHOUT performing rotation check
- The next successful lock-acquirer handles rotation when it's their turn
- Operator-facing OTel span event records the fallback occurrence for monitoring
- This prevents trace loss under sustained lock contention (better stale rotation than dropped traces)

**Atomic lock acquisition (per Flatline-SDD SKP-002 HIGH 750 · 2026-05-18)**: the `fs.openSync('wx')` + `fs.writeSync(PID)` sequence is NOT atomic. If process A is delayed between open and write, process B can read empty file → parseInt(NaN) → TypeError → assume stale → steal. Mitigation:

```ts
// ATOMIC: write PID to temp file FIRST, then rename into place
function tryAcquireLockAtomic(lockPath: string): boolean {
  const tmpPath = `${lockPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, String(process.pid), { flag: 'w' });
  try {
    // fs.linkSync fails if destination exists (atomic check-and-create)
    fs.linkSync(tmpPath, lockPath);
    fs.unlinkSync(tmpPath);
    return true;
  } catch (err: any) {
    fs.unlinkSync(tmpPath);
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

// Stale-PID detection: read MUST tolerate empty/malformed contents
function isLockStale(lockPath: string): boolean {
  try {
    const content = fs.readFileSync(lockPath, 'utf8').trim();
    if (!content) return false;  // EMPTY: another process is mid-acquire · back off, don't steal
    const ownerPid = parseInt(content, 10);
    if (isNaN(ownerPid)) return false;  // MALFORMED: same as empty, back off
    process.kill(ownerPid, 0);  // throws ESRCH if PID dead
    return false;  // owner alive
  } catch (err: any) {
    if (err.code === 'ESRCH') return true;  // owner truly dead, safe to steal
    return false;  // any other error: don't steal
  }
}
```

Backoff on transient unreadability is safer than stealing on empty/malformed reads. Only true dead-PID (ESRCH) authorizes lock theft.

### 3.9 · `/tweak` Tweakpane tab (S6)

5 folders matching the 5-layer substrate:

```
┌─ /tweak tab ─────────────────────────────────────────────┐
│                                                          │
│  PERSONA   [cool-blue border]                           │
│    character: ▼ ruggy ▼                                 │
│    [reload persona.md]                                  │
│                                                          │
│  VOICE     [warm-gold border]                           │
│    voice-anchors: ☑ enabled                            │
│    silence-register: ☑ enabled                         │
│    LOCK suffix: ☑ enabled                              │
│    grimoire sampler seed: |■────────────|  42          │
│    temperature:           |───■────────|  0.7          │
│                                                          │
│  TOOL      [sage border]                                │
│    MCPs: ☑ score  ☑ codex  ☑ emojis ☑ rosenzu          │
│    tool-invocation.md: ☐ (extracted in cycle-009)       │
│                                                          │
│  MEDIUM    [lavender border]                            │
│    descriptor: ▼ discord-webhook ▼                      │
│    padding char preview: " " (figure-space U+2007)     │
│                                                          │
│  ENVIRONMENT [dim-purple border]                        │
│    window: ▼ 30d ▼ (7d · 30d · 90d)                    │
│    zone: ▼ bear-cave ▼                                  │
│    post-type: ▼ digest ▼                                │
│    prior-week-hint: ☑ inject                            │
│                                                          │
│  [FIRE]   (live-fire with current tweak state)          │
│                                                          │
│  ────── result panel (reserved space) ──────             │
│  [Discord embed preview]                                 │
│  [source-map breadcrumbs · clickable]                    │
└──────────────────────────────────────────────────────────┘
```

State persists via `localStorage.tweakpane:freeside-characters` JSON. Export/import as preset.

### 3.10 · middot-detector (S7)

```ts
// packages/persona-engine/src/deliver/sanitize.ts (S7 addition)

export interface AiArtifact {
  kind: 'middot-density' | 'spelled-number' | 'em-dash' | 'hyphenated-compound';
  sample: string;
  position?: number;
}

export function detectAiArtifacts(text: string, postType: PostType): AiArtifact[] {
  const artifacts: AiArtifact[] = [];

  // 1. middot-density: > 2 middots AND > 1% density
  const middotCount = (text.match(/·/g) ?? []).length;
  if (middotCount > 2 && middotCount / text.length > 0.01) {
    artifacts.push({ kind: 'middot-density', sample: `${middotCount} middots in ${text.length} chars` });
  }

  // 2. spelled-number followed by aggregate unit
  const spelledMatch = text.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand|million)\s+(events?|miberas?|wallets?|factors?|actors?)/i);
  if (spelledMatch) {
    artifacts.push({ kind: 'spelled-number', sample: spelledMatch[0] });
  }

  // 3. em-dash · only flagged in voice output · grimoire-licensed sources exempt
  if (/[—–]/.test(text)) {
    artifacts.push({ kind: 'em-dash', sample: text.match(/[^.]*[—–][^.]*/)?.[0]?.trim() ?? '<em-dash>' });
  }

  // 4. hyphenated-compound from system prompt (V2 candidate · expensive · skip in V1)
  // V1: log-only · no autocorrect

  return artifacts;
}
```

Wired to existing `.run/sanitize-violations.jsonl` infrastructure (cycle-007). Dashboard sanitize-violations tab gets new artifact-kind rows.

---

## 4 · API contracts

### 4.1 · `buildPrompt` (S2)

```ts
export function buildPrompt(
  args: BuildPromptArgsUnified
): Effect.Effect<BuildPromptResult, BuildPromptError, never>;
```

**Caller responsibilities**:
- Cron: provide `activeFactors` + `priorWeekHint` (may be empty list / empty string · but ARG REQUIRED for cron · undefined → fail-loud per Q5)
- Chat: all cycle-008 args default `undefined` (regression fence preserved)

**buildPrompt responsibilities**:
- Validate cron args present when `shape.kind === 'cron'`
- Validate no aggregate-stat leakage (NFR-9)
- Load template + sibling files
- Substitute placeholders + track fragment_sources[]
- Append cron-only suffixes (JSON schema · LOCK)
- Validate fragment_sources[] invariants (FR-15a)
- Return Effect with systemPrompt + userMessage + optional fragmentSources

### 4.2 · `renderActiveFactors` (S2)

```ts
export function renderActiveFactors(
  factors: ReadonlyArray<ActiveFactorRender> | undefined
): string;
```

Pure function · never throws. Empty list → `(none)` block. Non-empty → bullet list.

### 4.3 · `validateNoAggregateStatLeakage` (S2)

```ts
export function validateNoAggregateStatLeakage(
  activeFactors: ReadonlyArray<ActiveFactorRender>,
  priorWeekHint: string | undefined
): Effect.Effect<void, BuildPromptError, never>;
```

Returns `Effect.unit` on pass, `Effect.fail(BuildPromptError({kind: 'aggregate-stat-leakage', ...}))` on detect.

### 4.4 · `appendTraceEntry` (S4 · cycle-007 INV-14 typed shim)

```ts
export function appendTraceEntry(entry: LlmTraceEntry): void;
```

Validates against trace-explain-output.schema.json v2 before write. Throws on schema violation. Caller responsible for redaction (use `redactPromptForTrace` helpers).

### 4.5 · Tweakpane fire endpoint (S6)

**Enforcement (per Flatline-SDD SKP-008 HIGH 760 · accepted Phase 4 HITL 2026-05-18 · layered defense)**:

1. **Localhost bind**: `/api/playground/*` routes bind ONLY to `127.0.0.1` (not `0.0.0.0`). Server listen call enforces. Express/Bun.serve config: `{ host: '127.0.0.1' }`. Any attempt to access via LAN-routable IP returns 404.
2. **LOA_DASH_AUTH bearer**: every `/api/playground/*` request requires `Authorization: Bearer <LOA_DASH_AUTH>` header. Reuses cycle-007 INV-16 mechanism. Missing/invalid token returns 401.
3. **Production gate**: routes return 404 unless `LOA_TWEAKPANE_ENABLED=1` env var is set. Default unset → tweakpane disabled. Operator opts in per environment. Enforces INV-PS-5 (kitchen-only) via code, not just convention.
4. **Response redaction**: returned `systemPrompt` + `userMessage` + `output` fields run through `redactPromptForTrace` before serialization (same redaction policy as trace data per NFR-8). Operator sees redacted prompts in /tweak UI; raw prompts stay in memory only.

```ts
// POST /api/playground/fire
{
  "tweak": {
    "persona": { "characterId": "ruggy", "reloadFromDisk": true },
    "voice": { "voiceAnchorsEnabled": true, "silenceRegisterEnabled": true, "lockEnabled": true, "seed": 42, "temperature": 0.7 },
    "tool": { "mcps": ["score", "codex", "emojis", "rosenzu"] },
    "medium": { "descriptor": "discord-webhook" },
    "environment": { "window": "30d", "zone": "bear-cave", "postType": "digest", "priorWeekHint": true }
  }
}
// Returns (redacted): { runId, systemPrompt, userMessage, output, fragmentSources, embedPreview }
// Headers: Authorization: Bearer <LOA_DASH_AUTH>
// Enforcement: 401 if no/wrong bearer · 404 if LOA_TWEAKPANE_ENABLED unset
```

---

## 5 · Test strategy

### 5.1 · Equivalence matrix (S2 · per spike doc 5+3 scenarios + BB-RA-001 9th E2E smoke)

| # | Scenario | Tier | Assertion |
|---|---|---|---|
| 1 | cron · empty active factors · no prior week | 2 (normalize) | `normalize(actual) === normalize(expected)` against fixture |
| 2 | cron · empty active factors · prior week present | 2 | same |
| 3 | cron · 1 active factor · no prior week | 2 | same |
| 4 | cron · 2+ active factors · no prior week | 2 | same |
| 5 | chat-mode (regression fence) | 1 (byte-identical) | `actual === buildReplyPromptPair(args)` from pre-cycle-008 baseline |
| 6 | cron · priorWeekHint containing `</untrusted-content>` | 2 | marker integrity survives (no re-escaping by buildPrompt) |
| 7 | cron · activeFactors undefined | NEGATIVE | `Effect.runSyncExit(...)` returns Failure with BuildPromptError({kind: 'missing-cron-arg', argName: 'activeFactors'}) |
| 8 | cron · priorWeekHint undefined | NEGATIVE | same shape (argName: 'priorWeekHint') |
| 9 | **end-to-end smoke** (BB-RA-001 accept · 2026-05-18) · pre-deploy gate | E2E | Runs `bun run --cwd apps/bot digest:once --stub` AND `bun run smoke-non-data-reply` against fixture-mode buildPrompt. Both paths must produce valid output OR pre-deploy halts. Catches all-paths-broken case structurally (SPOF defense). |
| 10 | **chat-mode before/after fixture verification** (Flatline-SDD IMP-006 accept · 2026-05-18) · pre-S2-merge gate | 1 (byte-identical) | Capture a fixture of `buildReplyPromptPair(args)` output from the pre-cycle-008 commit baseline. Store at `packages/persona-engine/src/persona/fixtures/chat-mode-baseline-pre-c008.txt`. After S2 lands, run `Effect.runSync(buildPrompt(args_for_reply))` with same args. Diff MUST be empty. Catches any drift introduced by the Effect-TS migration into the regression-fence path. |

Plus NFR-9 stat-leakage scenarios (5):
| # | Scenario | Assertion |
|---|---|---|
| 11 | `activeFactors[].displayName` contains `"30 events"` | `Effect.fail(BuildPromptError({kind: 'aggregate-stat-leakage', sample: ...}))` |
| 12 | `activeFactors[].displayName` contains `"thirty events"` | same |
| 13 | `priorWeekHint` inner body contains `"rank 90"` | same |
| 14 | `priorWeekHint` inner body contains `"prior period"` | same |
| 15 | `activeFactors[].displayName` contains `"top-10"` | same |

### 5.2 · FR-15a fragment_sources[] invariant tests (S4)

| # | Scenario | Assertion |
|---|---|---|
| 21 | Well-formed cron prompt with 5 layer fragments | `fragment_sources.length >= 5` · sorted ascending · no overlap |
| 22 | Cron prompt with no environment data | fragment_sources only includes layers actually substituted (>= 4) |
| 23 | Mutated buildPrompt produces overlapping offsets | `Effect.fail(BuildPromptError({kind: 'fragment-sources-invariant-violation', detail: 'overlap'}))` |
| 24 | Mutated buildPrompt produces out-of-order offsets | `Effect.fail(...)` |

### 5.3 · FR-20a failure-path tests (S5)

5 tests for outcome classes:
| # | Mock condition | Expected trace |
|---|---|---|
| 31 | Successful response | outcome='success' · error_classification absent |
| 32 | Mock SDK 500 response | outcome='provider-error' · http_status=500 |
| 33 | Mock 60s timeout via AbortController | outcome='timeout' |
| 34 | Mock invalid JSON response | outcome='malformed-response' |
| 35 | Mock thrown exception in SDK call | outcome='sdk-exception' · redacted_message present |

### 5.4 · NFR-8 redaction tests (S4)

| # | Input | Expected redacted output |
|---|---|---|
| 41 | systemPrompt contains `0xabc123...0xdef456` (40-hex) | `0x[REDACTED]` substituted |
| 42 | systemPrompt contains `sk-anthropic-xyz123...` | `[REDACTED-CREDENTIAL]` |
| 43 | systemPrompt contains `Bearer abc123def456` | `[REDACTED-CREDENTIAL]` |
| 44 | systemPrompt contains JWT `eyJhbGci...` | `[REDACTED-JWT]` |
| 45 | output contains Discord ID `<@123456789012345678>` (LOA_TRACE_INCLUDE_DISCORD_IDS unset) | `<@[REDACTED]>` |
| 46 | output contains Discord ID + LOA_TRACE_INCLUDE_DISCORD_IDS=1 | not redacted |

### 5.5 · FR-13a non-digest post-type compatibility tests (S3)

5 tests covering empty-arg buildPrompt invocation for non-digest types:
| # | post_type | activeFactors | priorWeekHint | Expected |
|---|---|---|---|---|
| 51 | micro | [] | undefined | buildPrompt succeeds · ACTIVE_FACTORS = "factors with activity:\n  (none)" |
| 52 | weaver | [] | undefined | same |
| 53 | lore_drop | [] | undefined | same |
| 54 | question | [] | undefined | same |
| 55 | callout | [] | undefined | same |

OR explicit removal of these post types from `outputInstruction(postType)` + `PostType` discriminated union + persona.md fragment markers. The pruning decision per `project-cron-post-types-pruning` memory is operator-paced · S3 acceptance accepts either path.

### 5.6 · End-to-end live-fire (OP-G2 · S3 close)

Operator runs `bun run --cwd apps/bot digest:once` × 4 zones via `railway run`:
- bear-cave · el-dorado · owsley-lab · stonehenge
- 5 PASS criteria per §7 of PRD: zero kebab · zero em-dash · zero spelled-aggregate · digits as digits · no aggregate-stat citation
- Trace rows verified via `bun run trace:explain --latest`

---

## 6 · Migration plan (sprint-by-sprint dependency graph)

```
S2 ─┬─→ S3 ─┬─→ S4 ─→ S5 ──→ S6 ──→ S7 ──→ S8
    │      │                                  ▲
    │      └─→ FR-10 Effect boundary           │
    │      └─→ FR-11 LOA_PROMPT_BUILDER flag   │
    │      └─→ FR-12 voice-brief.ts deprecated │
    │      └─→ FR-13/FR-13a non-digest compat  │
    │      └─→ OP-G2 live voice attestation ───┘
    │                                          │
    └─→ FR-4/5/6/7/8/9 buildPrompt Effect      │
       FR-15a fragment_sources invariants      │
       NFR-9 stat-leakage guard                │
       (no functional change to chat-mode)     │
                                               │
                                               └─→ OP-G3 tweakpane ≥15 min (S6 close)
                                               └─→ PP-5 mobile canary (S8)
                                               └─→ Branch protection (S8 · operator UI)
                                               └─→ Cycle-007 ledger flip (S8)
```

S2 + S3 are the load-bearing dependency. S4-S7 can parallelize after S3 lands. S8 absorbs all cycle-007 pair-points + final attestations.

---

### 6.1 · Placeholder syntax convention (per Flatline-SDD IMP-009 accept · 2026-05-18)

All persona.md placeholders use double-brace `{{NAME}}` syntax. The loader's substitution chain (`loader.ts:286-300`) uses `template.replace(/\{\{X\}\}/g, fragment)` against this convention. Test fixtures + render helpers must reference this convention. NOT `${NAME}` (JS template literals), NOT `<%= NAME %>` (EJS), NOT `{NAME}` (single-brace). Preserved convention from cycle-006/007 inherited templates. Pinning here prevents drift between persona edits and test authoring.

### 6.2 · Cron post-type pruning ambiguity (per Flatline-SDD IMP-010 REJECTED · 2026-05-18)

Concern flagged that post-type pruning ambiguity could create downstream churn. **Resolved by FR-13a** (PRD §5.3): S3 acceptance requires every cron post type to either (a) have explicit unit tests covering empty-array buildPrompt invocation, OR (b) be explicitly removed from `outputInstruction(postType)` + `PostType` enum + persona.md fragments. The "passed through silently" branch is rejected by FR-13a. Operator-paced pruning decisions per `project-cron-post-types-pruning` memory happen at S3 implementation time. No additional SDD spec needed.

---

## 7 · Security architecture

### 7.0 · Red Team SDD findings · 0 confirmed (Phase 4.5 · 2026-05-18)

10 attack scenarios generated · 0 CONFIRMED_ATTACK · 4 THEORETICAL · 6 CREATIVE_ONLY · 0 DEFENDED. Opus model consistently scored 0 on the theoretical attacks (no consensus that they're practically achievable). Zero sprint tasks added per skill protocol (sprint tasks gated on CONFIRMED_ATTACK ≥700).

Theoretical attack surfaces surfaced for defense-in-depth awareness (not load-bearing for cycle-008 acceptance):

| Attack | Severity | Counter-design (out-of-scope for cycle-008 unless operator promotes) |
|---|---|---|
| ATK-003 · Trace JSONL credential leak via race window (new code path bypasses `appendTraceEntry`) | 860 | Already addressed by Flatline-SDD SKP-004 acceptance (redaction moved INTO appendTraceEntry · §3.7). Future code paths writing directly to `.run/llm-trace.jsonl` must be reviewed; consider adding a lint rule that flags non-appendTraceEntry writes. |
| ATK-005 · Tweakpane SSRF/exposure via misconfig (operator enables `LOA_TWEAKPANE_ENABLED=1` on non-loopback bind) | 820 | Already partially addressed (§4.5 specifies localhost bind). Hardening candidate: refuse to start dashboard if `LOA_TWEAKPANE_ENABLED=1` AND non-loopback bind detected (process exits with code 78). Cycle-009 candidate. |
| ATK · Persona.md prescriptive drift in feature-branch (hidden directive added without operator review) | 780 | Already partially addressed via cycle-007 INV-17 CODEOWNERS for schema files. Hardening candidate: extend CODEOWNERS to `apps/character-*/persona.md` AND run SOUL-style descriptive-pattern lint in CI (warn-mode initially). Cycle-009 candidate. |
| ATK-010 · Cycle-005 gate bypass amplifies upstream factor catalog poisoning (compromised maintainer adds malicious factor names) | 740 | Mitigated by NFR-9 allowlist (factor names sourced from score-mcp catalog snapshot at S2 fixture time; cross-reference at runtime). The allowlist effectively narrows the trust boundary to the catalog snapshot maintainer at S2 time. Future cycles consider git-commit-signing on score-mcp factor catalog edits. |

### 7.1 · Preserved from cycle-007

### 7.1 · Preserved from cycle-007

| Invariant | Source | How preserved |
|---|---|---|
| FLATLINE-SKP-001/CRITICAL | LOCK suffix in system prompt | buildPrompt appends `UNTRUSTED_CONTENT_LLM_INSTRUCTION` unconditionally for `shape.kind === 'cron'` after substitution (unit test verifies presence + position) |
| FLATLINE-SKP-002/CRITICAL | `<untrusted-content>` marker escape | `formatPriorWeekHint` does the 5-char OWASP escape at SOURCE · buildPrompt does literal substitution (no re-escaping) · negative test scenario 6 verifies marker integrity under injection attempt |
| INV-12 (kebab-zone lint) | cycle-007 | applies to all new cycle-008 prose (zero kebab in voice outputs · OP-G2 attestation enforces) |
| INV-17 (schema CODEOWNERS) | cycle-007 | cycle-008 adds 3 schema files to the CODEOWNERS rule (operator-paced GitHub UI · S8) |
| INV-18 (safe-render C0/C1 strip) | cycle-007 | trace renderer (S4 trace:explain) inherits via existing `scripts/lib/safe-render.ts` |

### 7.2 · NEW in cycle-008

| ID | Surface | Control |
|---|---|---|
| NFR-8 | trace data | redaction at emit-time (wallets · API keys · JWTs · Discord IDs gated) · rotation (100MB / 30d) · LOA_DASH_AUTH gate (cycle-007 INV-16) |
| NFR-9 | prompt input | regex-based runtime guard rejects aggregate-stat leakage in `activeFactors[].displayName` + `priorWeekHint` inner body |
| FR-15a | trace schema | ajv enforces fragment_sources[] enum + ordering + non-overlap invariants |
| INV-PS-5 | tweakpane | kitchen-only · no production toggle surface |

---

## 8 · Open spike questions resolved (cross-reference)

All resolved in PRD §13. Reproduced here for SDD self-containment:

| # | Question | Resolution |
|---|---|---|
| 1 | Zone-voice-context (Gap 8) | DROP from cycle-008 |
| 2 | JSON output schema location (Gap 7) | Code-appended cron suffix in buildPrompt |
| 3 | Chat-mode LOCK suffix (Gap 6) | Cron-only · reply-mode evaluation deferred to cycle-009 |
| 4 | buildPrompt arg signature (Q1) | Structured `ActiveFactorRender` · names-only |
| 5 | Negative cron shape behavior (Q5) | Fail-loud via `Effect.fail(BuildPromptError({...}))` |
| 6 | Effect-TS scope (Q2) | Full loader.ts module migration · buildPrompt returns Effect |
| 7 | Vocabulary for substrate-state labels | Neutral mechanical · `factors with activity:` |
| 8 | Drop SILENCED list from prompt | YES · gate stays as engineering middleware |
| 9 | Placement in persona.md | Base template after {{ENVIRONMENT}} · LANDED in S1 |

---

## 9 · Risks specific to SDD

| Risk | Severity | Mitigation |
|---|---|---|
| Effect.runPromise rejection propagation through tracer span may double-handle errors | Low | Span.recordException is idempotent; existing pattern at agent-gateway.ts:201 shows safe coexistence |
| Stream-completion detection at agent-gateway depends on SDK shape · could break on SDK upgrade | Medium | Add explicit version pin on `@anthropic-ai/claude-agent-sdk` in package.json · test fixture covers AsyncIterable detection |
| Tweakpane v4 controlled-vs-uncontrolled state divergence (live-fire vs displayed state) | Low | One-way state flow · tweak event → fire → result panel update · no controlled-input ambiguity |
| Trace rotation race condition (two concurrent appendTraceEntry calls during rotation) | Medium | Use `flock`-style file lock around rotation check + rename · existing pattern available |
| LOA_PROMPT_BUILDER stderr warning gets buried in operator's terminal noise | Low | Also emit OTel span event (per operator's "Strengthen" option had this been picked · current decision: stderr-only acceptable) |
| Discord ID redaction regex misses uncommon snowflake forms | Low | Pattern `<@!?\d{17,20}>` covers all known Discord ID surfaces · operator can extend via PR if new shapes emerge |

---

End of cycle-008 SDD r1. Ready for Phase 3.5 (Bridgebuilder SDD if enabled) → Phase 4 (Flatline SDD multi-model review).
