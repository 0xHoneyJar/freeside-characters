# cycle-005 · ruggy-as-leaderboard + hybrid-staged prose-gate · SDD

> Companion to `prd.md`. PRD = WHAT + WHY. SDD = HOW.

## System Overview

cycle-005 sits ATOP cycle-004's substrate refactor (LLM gateway port pattern, Effect-Layer foundation) and consumes PR #77's `factor_stats` type mirror. It restructures ruggy's chat-reply + digest output shape and introduces a deterministic prose-gate as a sibling to the existing `grail-ref-guard.ts`.

```
┌──────────────────────────────────────────────────────────────┐
│ DIGEST PATH (V1 prose-gate runs HERE only)                  │
│                                                              │
│   cron/scheduler.ts ── digest tick ──► composeDigest         │
│       │                          │                           │
│       │                          ▼                           │
│       │              ┌─────────────────┐                     │
│       │              │ chat.invoke OTEL│  ◄── @effect/      │
│       │              │      span       │      opentelemetry │
│       │              └────────┬────────┘                     │
│       │                       │ child spans per transform   │
│       │                       ▼                              │
│       │              fetchDimensionBreakdown                 │
│       │              buildFactorStatsMap                     │
│       │              composeRuggyDraftProse (LLM)            │
│       │              inspectProse ◄── NEW gate (FR-2)        │
│       │              selectLayoutShape (consumes overrides)  │
│       │              buildPulseDimensionPayload ◄── FR-1     │
│       │                       │                              │
│       │                       ▼                              │
│       └─────────────► deliverViaWebhook → Discord            │
│                                                              │
│ CHAT PATH (V1 prose-gate DOES NOT run · V1.5 destination)   │
│                                                              │
│   dispatch.ts ────► composeReplyWithEnrichment ────►        │
│       │              [SAME chat.invoke OTEL span +           │
│       │               translate-emoji + grail-ref-guard      │
│       │               + strip-voice-drift + sanitize]        │
│       │                       │                              │
│       └─────────────► deliverViaWebhook → Discord            │
└──────────────────────────────────────────────────────────────┘
```

**V1 routing invariant** (closes flatline blocker SDD-SKP-001 [840] r2 · chat-vs-digest contradiction): `inspectProse` is invoked from the DIGEST PATH ONLY in V1. The `composeReplyWithEnrichment` (chat-mode) path emits OTEL `chat.invoke` spans for transform visibility but does NOT call `inspectProse`. Chat-mode gate is V1.5 destination per PRD §Accepted V1 Limitations A2.

## Component Specs

### 1. `packages/persona-engine/src/deliver/prose-gate.ts` (NEW — FR-2)

Mirrors `grail-ref-guard.ts` in shape + telemetry surface. Pure-regex denylist; no Effect Layer required at V1.

**Public API:**

```typescript
/**
 * Canonical V1 interface (closes flatline blockers SDD-SKP-002 [760] r2 +
 * SDD-SKP-009 [720] r3 · responsibility split). This is THE definition.
 * The duplicate in §"Data Models" below was removed in r2 in favor of this.
 *
 * inspectProse() is PURE: returns ProseGateValidation only. The digest
 * orchestrator augments to ProseGateOutcome (below) with shape_override
 * after reading PROSE_GATE_ON_VIOLATION env.
 */
export interface ProseGateValidation {
  matched_patterns: readonly { pattern: string; span: readonly [number, number] }[];
  violations: readonly {
    pattern: string;
    factor_id: string | null;
    reason:
      | 'cohort-singleton'
      | 'percentile-unreliable'
      | 'rank-below-threshold'
      | 'rank-null'
      | 'no-factor-context';  // closes SDD-SKP-002 [735] r1 · factor attribution
    /** Best-effort window context (which factor names appeared in proximity, for operator debugging). */
    proximity_factors: readonly string[];
  }[];
}

/**
 * Orchestrator-augmented type after the digest path applies kill-switch
 * routing. NOT populated by inspectProse — populated by compose/digest.ts
 * AFTER reading resolveProseGateMode() + counting HIGH-severity violations.
 */
export interface ProseGateOutcome extends ProseGateValidation {
  /** When mode='silence' AND HIGH-violations exist, set to 'A' to force
   *  the per-zone Shape A render regardless of permitted_claims/rank.
   *  Threaded into selectLayoutShape via the layoutShape arg.
   *  Closes flatline blockers PRD-SKP-001 [740] r2 + SDD-SKP-009 [720] r3. */
  shape_override?: 'A';
}

export type ProseGateMode = 'log' | 'skip' | 'silence';  // PROSE_GATE_ON_VIOLATION env

export function inspectProse(
  draft: string,
  factorStatsByFactorId: ReadonlyMap<string, FactorStats>,
  factors: readonly { id: string; display_name: string }[],  // for proximity attribution
): { text: string; validation: ProseGateValidation };

export function resolveProseGateMode(): ProseGateMode;  // reads env, defaults 'log'
```

`text` returned unchanged in V1 default mode (`log`). `factorStatsByFactorId` + `factors` array are composed by the caller from `get_dimension_breakdown.top_factors[]` + `cold_factors[]` (factor.id + factor.display_name pairs).

**Three regex rules (private) — case-insensitive, word-boundary anchored** (closes SDD/PRD regex-brittleness):

```typescript
const PROSE_GATE_RULES = [
  {
    name: 'cluster-claim',
    pattern: /\b(coordinated\s+clusters?|lockstep|lock-step|same\s+wallets?|cohorts?)\b/gi,
    check: (stats: FactorStats) => stats.cohort.unique_actors <= 1,
    reason: 'cohort-singleton' as const,
  },
  {
    name: 'p99-rare',
    pattern: /\b(p99[-\s]rare|tail\s+events?|top\s+decile)\b/gi,
    check: (stats: FactorStats) =>
      !stats.magnitude.percentiles.p99.reliable ||
      (stats.magnitude.current_percentile_rank ?? 0) < 95,
    reason: 'percentile-unreliable' as const,
  },
  {
    name: 'structural-shift',
    pattern: /\b(structural\s+shifts?|unprecedented|breakouts?|breaking\s+patterns?)\b/gi,
    check: (stats: FactorStats) =>
      (stats.magnitude.current_percentile_rank ?? 0) < 90 ||
      stats.magnitude.current_percentile_rank === null,
    reason: 'rank-below-threshold' as const,
  },
] as const;
```

**Factor-attribution algorithm** (closes SDD-SKP-001 [750] · misattribution + SDD-SKP-001 [720] · factor_id TBD):

```typescript
const PROXIMITY_WINDOW_CHARS = 200;

function attributeFactor(
  draft: string,
  matchSpan: readonly [number, number],
  factors: readonly { id: string; display_name: string }[],
): { factor_id: string | null; proximity_factors: readonly string[] } {
  const start = Math.max(0, matchSpan[0] - PROXIMITY_WINDOW_CHARS);
  const end = Math.min(draft.length, matchSpan[1] + PROXIMITY_WINDOW_CHARS);
  const window = draft.slice(start, end);
  // Longest-match-first to handle multi-word names like "Boosted Validator"
  const sorted = [...factors].sort((a, b) => b.display_name.length - a.display_name.length);
  const found: { factor_id: string; pos: number }[] = [];
  for (const f of sorted) {
    const re = new RegExp(`\\b${escapeRegex(f.display_name)}\\b`, 'i');
    const m = re.exec(window);
    if (m) found.push({ factor_id: f.id, pos: m.index + start });
  }
  // Sort by absolute position closest to match
  found.sort((a, b) => Math.abs(a.pos - matchSpan[0]) - Math.abs(b.pos - matchSpan[0]));
  return {
    factor_id: found[0]?.factor_id ?? null,
    proximity_factors: found.map((f) => factors.find((x) => x.id === f.factor_id)!.display_name),
  };
}
```

Behavior:
1. For each match, define proximity window N=200 chars before AND after `matchSpan`
2. Scan window for each factor's `display_name` token (longest-match-first)
3. Closest match wins; `factor_id = found[0].factor_id`
4. Empty `found` → `factor_id: null` + violation `reason: 'no-factor-context'` (caller can decide if this is informational vs HIGH severity; V1 treats as `log` regardless of `PROSE_GATE_ON_VIOLATION` mode)

**Kill-switch handling** (closes SDD-SKP-001 [760] · telemetry-only-vs-known-bad):

```typescript
export function resolveProseGateMode(): ProseGateMode {
  const m = (process.env.PROSE_GATE_ON_VIOLATION || 'log').toLowerCase();
  if (m === 'skip' || m === 'silence' || m === 'log') return m;
  // Invalid value falls back to default; emit one-time warn
  return 'log';
}
```

The CALLER (composeReplyWithEnrichment / digest path) interprets the mode:
- `log` → continue with draft unchanged
- `skip` → caller drops the post (does NOT call `deliverViaWebhook`); telemetry recorded
- `silence` → caller re-routes to Shape A layout via `selectLayoutShape({...forced: 'A-all-quiet'})`

The mode is ONLY consulted when `validation.violations.filter(v => v.reason !== 'no-factor-context').length > 0`. `no-factor-context` violations always pass through (attribution failed, can't authoritatively block).

**Telemetry surfaces (all modes):**

- `console.warn('[prose-gate] character=<id> mode=<log|skip|silence> violations=<list> draft_hash=<8 chars>')`
- OTEL span event on the active chat span: `prose_gate.violation` with attributes `{pattern, factor_id, reason, character_id, draft_hash, mode}` — events are cheaper than separate spans for high-cardinality flags

**File layout:**

```
packages/persona-engine/src/deliver/
  ├─ prose-gate.ts                ← NEW · ~120 LoC (regex rules + attribution + mode resolver)
  ├─ prose-gate.test.ts           ← NEW · ~80 LoC · 8+ regression cases (4 from FR-5 + edge cases + morphology + attribution)
  ├─ grail-ref-guard.ts           ← unchanged · sibling pattern
  └─ embed.ts                     ← MODIFIED · buildPulseDimensionPayload extended with factor_stats per-row emoji slot (FR-3)
```

### 2. `packages/persona-engine/src/deliver/embed.ts::buildPulseDimensionPayload` (REACTIVATE + EXTEND — FR-1, FR-3)

Function exists, was operator-locked in PR #73, has been DORMANT since (no caller wired). This cycle reactivates it as ruggy's digest BODY.

**Extension surface:**

```typescript
function buildPulseDimensionPayload(
  response: DimensionBreakdownResponse,
  dim: DimensionData,
  window: number,
  options?: {
    /** Mood-emoji rules (FR-3). When provided, per-factor rows get an emoji slot. */
    moodEmoji?: (stats: FactorStats | undefined) => string | null;
    /** Prose-gate validation (FR-2). When provided, gate output enriches OTEL telemetry. */
    proseGate?: ProseGateValidation;
  },
): DiscordPayload;
```

The renderer stays deterministic. The mood-emoji callback is a pure function — operator-tunable.

### 3. `packages/persona-engine/src/deliver/mood-emoji.ts` (NEW — FR-3)

Registry-mediated mood-emoji selection (closes SDD-SKP-003 [710] · hardcoded-emoji vs registry rule). Returns the rendered Discord token `<:name:id>` (or `<a:name:id>` animated) sourced from `orchestrator/emojis/registry.ts::pickByMoods(...)`, NOT hardcoded unicode.

```typescript
import { pickByMoods, renderEmoji, type EmojiMood } from '../orchestrator/emojis/registry.ts';
import type { FactorStats, PulseDimensionFactor } from '../score/types.ts';

const MOOD_EMOJI_DISABLED = () => process.env.MOOD_EMOJI_DISABLED === 'true';

/**
 * Pick the first matching emoji for a set of mood tags. Returns the rendered
 * `<:name:id>` token, or null on miss / disabled.
 *
 * Deterministic selection: registry returns ALL matches; we pick the first
 * after sorting by `id ASC` for snapshot-test stability. V1.5 may add
 * randomization for visual variety.
 */
function pickMood(moods: readonly EmojiMood[]): string | null {
  if (MOOD_EMOJI_DISABLED()) return null;
  const candidates = pickByMoods([...moods], 'ruggy');
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  return renderEmoji(sorted[0]!);
}

export function moodEmojiForFactor(stats: FactorStats | undefined): string | null {
  if (!stats) return null;  // historic factor or no enrichment
  if (stats.history.no_data || stats.history.error || stats.history.unknown_factor) return null;
  if (stats.magnitude.current_percentile_rank !== null
      && stats.magnitude.current_percentile_rank >= 95
      && stats.magnitude.percentiles.p95.reliable) {
    return pickMood(['flex']);
  }
  if (stats.cohort.current_percentile_rank !== null
      && stats.cohort.current_percentile_rank >= 90
      && stats.cohort.unique_actors !== undefined
      && stats.cohort.unique_actors >= 5) {
    return pickMood(['eyes', 'shocked']);
  }
  if (stats.cadence.current_gap_percentile_rank !== null
      && stats.cadence.current_gap_percentile_rank >= 90
      && stats.occurrence.current_is_active) {
    return pickMood(['noted', 'concerned']);
  }
  return null;
}

export function moodEmojiForColdFactor(factor: PulseDimensionFactor): string | null {
  if (factor.previous > 5 && factor.total === 0) return pickMood(['sadge', 'dazed']);
  return null;
}
```

Pure-with-env-read. ~60 LoC including doc + tests. Each call to `pickByMoods` is cached at registry-load time (registry is a const array). Output is a Discord render token like `<:ruggy_flex:1143652000110747720>` which `compose/reply.ts::translateEmojiShortcodes` will pass through unchanged (already-rendered tokens skip the colon-form translation pass).

**Fallback behaviors:**
- Registry miss (pickByMoods returns []) → return null → renderer emits no emoji slot for that row
- `MOOD_EMOJI_DISABLED=true` → all calls return null (operator override for non-THJ guild testing)
- Registry contains animated variants → `renderEmoji` automatically uses `<a:name:id>` prefix (registry is source of truth for animated flag)

### 4. `packages/persona-engine/src/compose/layout-shape.ts` (NEW — FR-4)

```typescript
export type LayoutShape = 'A-all-quiet' | 'B-one-dim-hot' | 'C-multi-dim-hot';

export function selectLayoutShape(args: {
  zones: readonly ZoneId[];
  permittedClaimsByZone: ReadonlyMap<ZoneId, number>;
  topRankByZone: ReadonlyMap<ZoneId, number | null>;
  totalEventsByZone: ReadonlyMap<ZoneId, number>;
}): LayoutShape;
```

Decision tree from FR-4 + tests. ~30 LoC.

### 5. Digest path (MODIFIED — FR-1, FR-2, FR-6) · `cron/scheduler.ts` → digest compose chain

Note: per PRD AC-9 + Open Q #3 resolution, **the prose-gate runs ONLY on the digest path in V1**, NOT in `composeReplyWithEnrichment` (chat-mode). Chat-mode gate is V1.5 destination. Both paths still emit OTEL `chat.invoke` spans for transform-stage visibility.

Digest compose pseudocode:

```typescript
// Inside the digest cron handler, after fetch + LLM compose:
const factorStatsMap = buildFactorStatsMap(dimensionResponse);  // composes id → FactorStats from breakdown.top_factors[] + cold_factors[]
const factors = [...dimensionResponse.top_factors, ...dimensionResponse.cold_factors]
  .map(f => ({ id: f.factor_id, display_name: f.display_name }));

const draft = await composeRuggyDraftProse(...);  // small voice surface — header + per-row mood + outro
const proseValidation = inspectProse(draft, factorStatsMap, factors);

// Filter informational violations (no-factor-context) from mode-gating
const highViolations = proseValidation.violations.filter(v => v.reason !== 'no-factor-context');
const mode = resolveProseGateMode();

if (highViolations.length > 0) {
  // Telemetry (all modes)
  Tracer.addEvents(highViolations.map(v => ({
    name: 'prose_gate.violation',
    attributes: { ...v, character_id: 'ruggy', draft_hash: hash8(draft), mode },
  })));
  console.warn(`[prose-gate] character=ruggy mode=${mode} violations=${JSON.stringify(highViolations)} draft_hash=${hash8(draft)}`);

  // Mode-specific behavior (closes SDD-SKP-001 [760] · kill-switch)
  if (mode === 'skip') {
    Tracer.addEvent('prose_gate.zone_post_skipped', { zone, draft_hash: hash8(draft) });
    console.warn(`[prose-gate] zone=${zone} skipped (mode=skip · ${highViolations.length} violations)`);
    return;  // do NOT call buildPulseDimensionPayload / deliverViaWebhook for this zone
  }
  if (mode === 'silence') {
    Tracer.addEvent('prose_gate.shape_a_fallback', { zone, draft_hash: hash8(draft) });
    return composeShapeA({ zones, tallies });  // routes to Shape A renderer (italicized stage direction + tally line)
  }
  // mode === 'log' falls through to normal compose; draft posts unchanged
}

// Even when no violations, the layout selector may pick Shape C NO-CLAIM variant
// when permitted_claims_count === 0 but rank≥90 zones exist (closes SPRINT-SKP-001 [850])
const shape = selectLayoutShape({
  zones,
  permittedClaimsByZone,
  topRankByZone,
  totalEventsByZone,
});

const payload = buildPulseDimensionPayload(dimensionResponse, dim, 7, {
  moodEmoji: moodEmojiForFactor,
  proseGate: proseValidation,
  layoutShape: shape,
});

await deliverViaWebhook(payload);
```

Text unchanged in `log` mode. `skip` returns early; `silence` re-routes to Shape A. The chat-mode path (composeReplyWithEnrichment) skips `inspectProse` entirely in V1.

### 6. OTEL Layer (NEW — FR-6)

`packages/persona-engine/src/observability/otel-layer.ts`:

```typescript
import { NodeSdk } from '@effect/opentelemetry';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export const OtelLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'freeside-characters' },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  })),
}));
```

Tests use a memory exporter:

```typescript
// observability/otel-test.ts
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
export const OtelTest = NodeSdk.layer(() => ({
  resource: { serviceName: 'freeside-characters-test' },
  spanProcessor: new SimpleSpanProcessor(new InMemorySpanExporter()),
}));
```

Wire via `Effect.provideLayer(OtelLive)` (or `OtelTest`) at the top of `composeReplyWithEnrichment` once it's Effect-aware (cycle-004 substrate refactor enables this).

For non-Effect contexts (e.g., the dispatch.ts handler that's still imperative), use the OpenTelemetry API directly via `trace.getTracer('freeside-characters')`. The Effect.Tracer in composeReply integrates with that global tracer.

### 7. Existing files unchanged

- `compose/reply.ts::translateEmojiShortcodes` — pinned by `reply-emoji-translate.test.ts` regression tests
- `score/types.ts` — `FactorStats` interface mirrors cycle-022 #116 substrate, lands via merged PR #77
- `score/client.ts::fetchDimensionBreakdown` — reactivates (was dormant since PR #73)
- `apps/character-ruggy/character.json::tool_invocation_style` — already updated by PR #77 to teach "numbers not verdicts" register

## Data Models

> **Canonical type lineage** (closes flatline blocker SDD-SKP-003 [735] r2 · FactorStatsSurface incompatibility):
> All `FactorStats` references in this SDD are the EXACT type exported from
> `packages/persona-engine/src/score/types.ts` (PR #77 merged 2026-05-16 01:27 UTC),
> which mirrors `score-mibera/src/services/factor-stats.service.ts:57-77`. Implementation
> imports via `import type { FactorStats, FactorStatsSurface } from '../score/types.ts'`
> NOT a local redefinition. S0.T0.0 precondition check verifies the export exists.
> The shape excerpt below is for reading convenience only; the importable type is authoritative.

### FactorStats (from score-mibera #116, mirrored via PR #77)

```typescript
interface FactorStats {
  history: {
    active_days: number;
    last_active_date: string | null;
    stale: boolean;
    no_data: boolean;
    error?: boolean;
    unknown_factor?: boolean;
    sufficiency: { p50: boolean; p90: boolean; p99: boolean };
  };
  occurrence: {
    active_day_frequency: number;
    current_is_active: boolean;
  };
  magnitude: FactorStatsSurface;  // {event_count, percentiles, current_percentile_rank}
  cohort: FactorStatsSurface;     // {unique_actors, percentiles, current_percentile_rank}
  cadence: {
    days_since_last_active: number;
    median_active_day_gap_days: number | null;
    current_gap_percentile_rank: number | null;
  };
}
```

### ProseGateValidation (canonical definition · see §Component 1 above)

Removed duplicate stale definition in r2 (closes flatline blocker SDD-SKP-002 [760] r2). The CANONICAL `ProseGateValidation` interface is defined in §Component 1 above with `proximity_factors` field and `shape_override` extension. Refer there.

## Security + NFRs

- **NFR-1 · No user-facing leak** — V1 telemetry-only contract. Gate's `inspectProse(...)` returns `{text, validation}` with `text` UNCHANGED. NO footer, NO regenerate. Mirrors grail-ref-guard F4 doctrine (operator-only telemetry; persona illusion preserved).
- **NFR-2 · Idempotency** — `inspectProse` is a pure function. Running twice produces identical output. No side effects on draft text.
- **NFR-3 · Telemetry hygiene** — `draft_hash` (8-char SHA-256) in log lines; full draft NOT logged at info level (potential PII or persona-secret leak in dev). OTEL events carry hash + reasons, not full text.
- **NFR-4 · OTEL cardinality** — pattern + reason are bounded enums (~10 values). `factor_id` is bounded by score-mibera's catalog (~28 factors). Safe for high-cardinality OTEL backends (Honeycomb, Tempo).
- **NFR-5 · Substrate independence** — gate consumes `factor_stats` via map argument; no direct MCP call from inside `inspectProse`. Caller composes the map from already-fetched tool results.
- **NFR-6 · Test coverage** — gate has ≥6 regression cases (4 from FR-5 + 2 negative cases that should NOT flag). Memory-exporter test verifies OTEL events emit correctly.

## Failure Modes + Recovery

- **`factor_stats` absent** (historic factor) → `factorStatsByFactorId` lookup returns undefined → gate skips that factor's rule check. NO violation emitted. Aligns with #116 doctrine: "absent means out of scope, NOT no data."
- **`current_percentile_rank: null`** → rank-below-threshold check still fires (null < 90 evaluates false-y; specific `rank-null` reason captures it). Operator decides V1.5 if this should be permissive vs strict.
- **OTEL exporter unavailable** → spans buffer in BatchSpanProcessor; eventual drop on overflow. Console.warn telemetry continues. NEVER blocks chat compose.
- **Regex catastrophic backtracking** — patterns are simple alternations (no nested quantifiers). Manually verified to be linear in draft length. Test with a 50K-char synthetic draft.

## Migration Path (V1 → V1.5 → V2)

### V1 → V1.5

Add register-map module: `packages/persona-engine/src/deliver/register-map.ts`. Pure function: `mapRankToRegister(rank, reliable): RegisterTier`. Returns one of `'silent' | 'quiet' | 'ordinary' | 'elevated' | 'top-decile'`.

Update `inspectProse` to optionally return a `suggested_register` per violation. Caller can soft-enforce by passing draft + suggestion to a follow-up LLM call that DOWNGRADES the vocabulary tier in-place.

### V1.5 → V2

Add `verify/` module split when multiple verifiers warrant the category. Move `prose-gate.ts` + `register-map.ts` from `deliver/` to `verify/`. This is the four-folder-pattern adoption.

Add cross-family LLM-as-judge: a `judge.live.ts` adapter that calls a different model family (e.g., if ruggy/satoshi are on Bedrock Claude, judge runs on OpenAI). Effect Service shape: `Judge.evaluate(draft, factorStats): Effect<Judgment, JudgeError, never>`.

Add regenerate-with-refusal loop in `composeReplyWithEnrichment`: when violations.length > 0 AND register downgrade isn't enough, re-prompt LLM with explicit refusal instruction. Bound retries (≤2).

## Test Strategy

- **Unit** — `prose-gate.test.ts`, `mood-emoji.test.ts`, `layout-shape.test.ts` (pure-function tests, ~150 LoC total)
- **Regression** — `prose-gate.test.ts` includes the 4 operator-witnessed cases from FR-5 + the existing `reply-emoji-translate.test.ts` continues to pin the translation contract
- **OTEL** — memory-exporter test verifies the span tree (`chat.invoke` > N transform child spans > prose_gate.violation events)
- **Integration** — `compose/digest.test.ts` snapshot per layout shape (A/B/C) verifies the deterministic card body + voice seasoning composition
- **End-to-end** — dry-run canary on staging Discord channel before THJ deploy

## Refs

- `prd.md` (companion · WHAT + WHY)
- `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` (r0 architectural destination · V1.5/V2 preserved)
- score-mibera/src/services/factor-stats.service.ts:57-77 (substrate canonical type)
- PR #73 (dormant renderer that reactivates as FR-1)
- PR #77 (merged 2026-05-16 · provides `FactorStats` type at consumer)
- https://effect.website/docs/observability/tracing/ (FR-6 reference)
- `packages/persona-engine/src/deliver/grail-ref-guard.ts` (sibling pattern · F4 telemetry-only doctrine precedent)
