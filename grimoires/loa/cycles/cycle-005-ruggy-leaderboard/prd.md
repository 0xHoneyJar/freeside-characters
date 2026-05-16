# cycle-005 · ruggy-as-leaderboard + hybrid-staged prose-gate · PRD

> Promoted from `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` r1
> 2026-05-15 PM — operator-blessed consolidated direction. See that track file for the
> r0 → r1 design lineage and the HERALD-pattern that was rejected.

## Metadata

| field | value |
|---|---|
| cycle | cycle-005 |
| working title | ruggy-leaderboard |
| target branch | `feat/cycle-005-ruggy-leaderboard` (created from `main` after cycle-004 substrate refactor lands) |
| depends_on | PR #77 (cycle-022 factor_stats type mirror, MERGED 2026-05-16 01:27 UTC) · score-mibera 1.1.0 in prod (MERGED 2026-05-15) · cycle-004 substrate refactor (Effect-Layer foundation) |
| sibling tracks | `track-2026-05-15-medium-registry-emoji-capability.md` (emoji catalog as discoverable primitive — defers to follow-up cycle) |
| closes | issue #74 (architectural deferral · path B refined) · issue #79 (OTEL DX · folded into FR-6) |

## Intent

Restructure ruggy's weekly digest + slash-reply surface so that:

1. The **deterministic dashboard-mirrored card** (PR #73's dormant `buildPulseDimensionPayload`) becomes the BODY of ruggy's output — 85–95% of the post's pixels are data.
2. **Voice becomes seasoning** — 1-line header + per-row mood-emoji + 1-line outro. ~5–15% of the post's pixels.
3. A **regex-denylist prose-gate** (zerker V1 telemetry-only, ~100 LoC) catches the recurring failure modes (`#3230 → #3233` sequential-mint-as-chain, "structural shift" on quiet weeks, "p99-rare" with thin history) by tying phrase patterns to mechanical `factor_stats` substrate checks.
4. **Layout itself adapts** to what the substrate licenses — shapes A (all quiet) / B (one dim hot) / C (multi dim hot).
5. **Observability via @effect/opentelemetry** — replaces the reverted self-scaffolded chat-trace primitive with industry-standard `Effect.Tracer` spans + events, queryable in Honeycomb / Grafana Tempo / Jaeger.

Hybrid-staged shipping:

- **V1 (this cycle)** — zerker's telemetry-only gate + leaderboard restructure + OTEL wire-up. ~470 LoC, ~5 days.
- **V1.5 (later)** — register-map (`rank → permitted vocabulary tier`) + soft-enforce (auto-downgrade vocabulary instead of just logging).
- **V2 (later)** — cross-family LLM-as-judge for residual claims that regex misses + regenerate-with-refusal.

The r0 cycle-spec described the V1.5/V2 destination as the "immediate" sprint scope. Operator pivot 2026-05-15 PM: zerker's V1 ships first, telemetry validates the rules over 2-4 weeks, then graduate.

## Non-Intent

- Third bear / separate webhook identity (HERALD pattern — rejected by operator)
- Multi-guild rollout (THJ only this cycle)
- User-visible gate signal V1 (telemetry-only mirrors grail-ref-guard F4 doctrine — persona illusion preserved)
- Self-scaffolded observability (reverted in favor of @effect/opentelemetry)
- Removing existing LLM-enrichment in `tool_invocation_style` — the gate REPLACES the unbounded surface; the prompt becomes "interpret only what the gate licenses"
- Replacing satoshi's locked sparse register
- Cadence-claim primitive (score-mibera #118 deferred)
- Medium-registry emoji catalog discovery — sibling track, separate cycle

## Functional Requirements

### FR-1 · ruggy digest body = deterministic dashboard-mirrored card

Reactivate `packages/persona-engine/src/deliver/embed.ts::buildPulseDimensionPayload` (shipped dormant in PR #73). Extend to render the `factor_stats` per-row context as part of each factor line.

Per zone:

1. `digest` cron fires (existing path, no cron-shape change)
2. Fetch `get_dimension_breakdown(window: 7, dimension: <zone>)` for dim-channels; `get_community_counts(window: 7) + get_most_active_wallets(7, 5)` for stonehenge
3. Schema-validate response is `schema_version: '1.0.0' | '1.1.0'`; `factor_stats` populated for live factors
4. Run draft through prose-gate (FR-2); collect telemetry; text unchanged in V1
5. Compose payload: deterministic card BODY + voice seasoning (header + per-row mood emoji + outro)
6. Post via Pattern B webhook to zone's channel

The PR #73 operator-locked trim decisions stay locked (no footer, no was-N, no diversity chip line, no field-name suffixes — the six trims are regression-guarded).

**Substrate API failure handling** (closes flatline blocker PRD-SKP-002 [750] · substrate-error-handling): the fetch step is wrapped with a 5-second timeout and a single retry with exponential backoff (1s · 2s). On exhausted-retry, 5xx, network partition, or `FEATURE_DISABLED` / `UPSTREAM_ERROR` envelope from score-mcp:

- **digest cron** — skip the broadcast for that zone, log `[digest] zone=<id> skipped reason=<code>` (telemetry-only · no in-character error post to the channel · matches the existing anti-spam invariant)
- **slash-command path** — surface as in-character error per `expression/error-register.ts` (operator-witnessed cases already covered)

The cron skip is intentional silence; weekly digest cadence absorbs occasional substrate hiccups without forcing degraded posts.

**Truncation policy** (closes flatline blockers PRD-SKP-001 [850] r1 + PRD-SKP-001 [750] r2 + SPRINT-SKP-001 [850] r2 + PRD-SKP-001 [840] r3 + PRD-SKP-001 [850] r3 + PRD-SKP-002 [760] r3 · discord-1024-cap + total-embed-size): the deterministic card body MUST fit within Discord's:
- **1024 characters per embed field** (Discord codepoint count, NOT bytes; emojis like `<:name:id>` count as N codepoints where N is the rendered-token length)
- **6000 characters total across embed** (Discord total-size cap; fields + title + description + footer + author all count)
- **2000 characters for message.content** (when present as graceful fallback for users with embeds disabled)

Algorithm (per SDD §Component 2) · operates on **character count (`.length` on string)**, NOT byte length:
1. Render rows one at a time, accumulating CHARACTER count via `accumulator += row.length`
2. Before appending each row: check `accumulated + row.length + " · ".length + "…and N more silent".length` ≤ 1024
3. If next row would breach the per-field cap, stop and emit `…and N more silent` as final token (with N computed)
4. Same algorithm for top-factors AND cold-factors sections (each is its own field, each respects its own 1024 cap)
5. After per-field truncation, sum all fields + title + description + footer; if total exceeds 6000, progressively shrink the lowest-priority fields (cold-factors first, top-factors second) until total ≤ 6000

`LEADERBOARD_MAX_FACTORS` env (default 19) is a **soft hint** — the dynamic algorithm overrides it when char-length would exceed the cap (typical onchain dim w/ standard names ~950 chars fits 19; pathological long names trigger fewer). Tests verify worst-case PAYLOAD across multiple factor-name-length distributions, not just a static 19-count snapshot.

### FR-2 · zerker's V1 prose-gate (telemetry + optional kill-switch)

Lives at `packages/persona-engine/src/deliver/prose-gate.ts` (next to `grail-ref-guard.ts`, sibling pattern). New `verify/` module deferred to V1.5+ when more verifiers warrant a category.

Three regex rules tied to mechanical no-data checks from `factor_stats`. **All patterns use the `gi` flag** (case-insensitive · global) and **word boundaries `\b`** to defend against morphological variation (closes flatline blocker PRD-SKP-002 [750] · regex-brittleness):

> **Markdown-render note** (closes flatline blocker PRD-SKP-001 [860] r3 · regex-pipe-escape): the `\|` characters in the regex column below are MARKDOWN ESCAPES for the table-column delimiter `|`. The actual JavaScript regex source uses **unescaped `|` (alternation)**. SDD §Component 1 shows the canonical TypeScript form with proper unescaped pipes.

| trigger phrase pattern (regex · markdown-escaped) | flag as violation when |
|---|---|
| `/\b(coordinated\s+clusters?\|lockstep\|same\s+wallets?\|cohorts?\|lock-step)\b/gi` | `cohort.unique_actors <= 1` |
| `/\b(p99[-\s]rare\|tail\s+events?\|top\s+decile)\b/gi` | `magnitude.percentiles.p99.reliable === false` OR `magnitude.current_percentile_rank < 95` |
| `/\b(structural\s+shifts?\|unprecedented\|breakouts?\|breaking\s+patterns?)\b/gi` | `magnitude.current_percentile_rank < 90` OR rank is `null` |

Test suite MUST cover morphological variations: `Cohorts`, `lock-step`, `coordinated clusters`, mixed-case `Structural Shift`, punctuation-adjacent (`(coordinated cluster).`), etc. Negative cases also required (false-positive prevention: `the cohort of validators` should NOT flag unless `unique_actors <= 1`).

**Factor-attribution algorithm** (closes flatline blocker PRD-SKP-003 [705] · factor-attribution · 4× recurring across PRD/SDD):

For each matched phrase, attribute to a factor via **proximity-based lookup**:

1. Define a proximity window of N=200 chars before AND after the match span
2. Scan the window for any `factor.display_name` token from `factorStatsByFactorId` (longest-match-first to handle multi-word names like "Boosted Validator")
3. First factor name found within proximity → `factor_id = factor.id`
4. No factor name in proximity → `factor_id = null`, augment violation with `reason: 'no-factor-context'`

Per-violation `reason` enum expanded:
- `cohort-singleton` (rule 1 fired · factor has unique_actors ≤ 1)
- `percentile-unreliable` (rule 2 fired · p99 reliability false)
- `rank-below-threshold` (rules 2 or 3 · rank < threshold)
- `rank-null` (rules 2 or 3 · rank null = sufficiency.p50 false OR factor not active)
- `no-factor-context` (proximity lookup failed · violation logged for review but no factor pinned)

Returns a structured `ProseGateValidation` interface mirroring `GrailRefValidation`:

```typescript
export interface ProseGateValidation {
  /** Phrase patterns matched in draft (regex order, with span positions). */
  matched_patterns: readonly { pattern: string; span: readonly [number, number] }[];
  /** Substrate states that triggered flag. */
  violations: readonly {
    pattern: string;
    factor_id: string | null;
    reason: 'cohort-singleton' | 'percentile-unreliable' | 'rank-below-threshold' | 'rank-null' | 'no-factor-context';
    /** Best-effort window context (which factor names appeared in proximity, for operator debugging). */
    proximity_factors: readonly string[];
  }[];
}
```

`inspectProse(draft, factorStatsByFactorId)`: returns `{text, validation}` — text returned UNCHANGED in V1 default mode. V1 default = telemetry-only (NO user-visible footer, NO regenerate, NO refusal). Behavior follows F4 grail-ref-guard precedent.

**Kill-switch behavior** (closes flatline blockers PRD-SKP-001 [760, 720] r1 + SDD-SKP-001 [760] r1 + PRD-SKP-001 [740] r2 · telemetry-only-vs-known-bad · silence-mode shape_override threading):

The `PROSE_GATE_ON_VIOLATION` env var controls behavior when `validation.violations.length > 0`:

| value | behavior |
|---|---|
| `log` (DEFAULT) | V1 telemetry-only doctrine. Log violation; post the draft unchanged. Matches grail-ref-guard F4 precedent. |
| `skip` | Drop the digest post for that zone entirely. Emit `[prose-gate] zone=<id> skipped reason=high-severity-violation`. Stonehenge / dim channel goes silent for that fire. |
| `silence` | Route the digest through Shape A layout (italicized stage direction + cross-dim tally line · no card body). Channel stays present without forcing the offending prose. |

V1 ships with `log` default to preserve telemetry-collection phase (2-4 weeks). Operator escalates to `silence` or `skip` per-environment without code changes when telemetry-validation confirms rules are well-tuned.

**Per-zone vs cycle-wide gate decisions** (closes PRD-SKP-001 [740] r2 + SDD-SKP-009 [720] r3 · responsibility split): the gate fires PER-ZONE during digest composition. Each zone's `inspectProse(...)` returns a validation (pure-functional, deterministic).

**Responsibility split for `shape_override`:**
- `inspectProse(...)` is **pure** — no env reads, no env-dependent fields populated. Returns `{text, validation}` where validation has `matched_patterns + violations + proximity_factors` only.
- The **digest orchestrator** (in `compose/digest.ts`) reads `PROSE_GATE_ON_VIOLATION`, decides the per-zone `shape_override` based on mode + violation severity, and threads it into `selectLayoutShape(...)` with **precedence over** the (permittedClaims, high-rank-zone) decision table.

Concretely: if zone OG would otherwise route to Shape C (multi-dim hot) but the orchestrator (NOT inspectProse) computed `shape_override='A'` from silence-mode + HIGH-severity violations, the orchestrator passes shape_override into `selectLayoutShape`, which forces OG to render Shape-A inline (stage direction + tally line for OG only) while other zones render their natural shapes.

Single routing path — keeps inspectProse testable in isolation + makes the kill-switch logic visible at the orchestration layer (not buried inside the gate). Interface shape with the orchestrator-populated field:

```typescript
export interface ProseGateValidation {
  // ... pure-substrate fields populated by inspectProse ...
}

// Augmented type after digest orchestrator decides shape_override:
export interface ProseGateOutcome extends ProseGateValidation {
  /** Caller-populated AFTER inspectProse, based on resolveProseGateMode()
   *  + violations.filter(v => v.reason !== 'no-factor-context').length > 0.
   *  When mode='silence' AND HIGH-violations exist, set to 'A' to force
   *  the per-zone Shape A render regardless of permitted_claims/rank. */
  shape_override?: 'A';
}
```

Mode applies ONLY to HIGH-severity violations (V1 defines all non-`no-factor-context` violations as HIGH; `no-factor-context` falls back to `log` behavior under any mode since attribution failed — see "Accepted V1 Limitations" below for the operator-blessed disposition of this).

Telemetry surfaces TWO channels regardless of kill-switch mode:
- `console.warn`: `[prose-gate] character=ruggy violations=[cohort-singleton:Boosted_Validator] mode=log draft_hash=abc123`
- OTEL: `prose_gate.violation` span event on chat span with attributes `{pattern, factor_id, reason, character_id, draft_hash, mode}` (FR-6)

### FR-3 · per-row mood emoji from factor_stats (registry-mediated)

Each per-factor row in the leaderboard card gets an optional 1-char emoji slot. **Mood-emoji selection MUST go through the existing THJ guild emoji registry** at `packages/persona-engine/src/orchestrator/emojis/registry.ts` via `pickByMoods(moods, 'ruggy')` (closes flatline blocker SDD-SKP-003 [710] · hardcoded-emoji vs registry rule). This preserves the persona's voice rules + makes the cycle compatible with the sibling medium-registry capability track when it ships.

Mood-mapping rules (factor_stats state → mood tags from `EmojiMood` enum):

| factor_stats state | mood tags (registry pickByMoods) |
|---|---|
| `magnitude.current_percentile_rank >= 95 && magnitude.percentiles.p95.reliable` | `['flex']` → e.g. `ruggy_flex` |
| `cohort.current_percentile_rank >= 90 && cohort.unique_actors >= 5` | `['eyes', 'shocked']` → e.g. `ruggy_point` / `ruggy_aaa` |
| `cadence.current_gap_percentile_rank >= 90 && cadence.occurrence.current_is_active` | `['noted', 'concerned']` → e.g. `ruggy_smoke` |
| `factor.previous > 5 && factor.total === 0` (went-quiet) | `['sadge', 'dazed']` → e.g. `ruggy_sadge` / `ruggy_zoom` |
| (everything else) | (no emoji slot) |

The renderer in `deliver/embed.ts` formats the row with the rendered emoji token `<:name:id>` (or `<a:name:id>` for animated) inline. Falls back to NO emoji slot when:
- pickByMoods returns empty array (no registry entry matches the mood)
- `MOOD_EMOJI_DISABLED=true` env var is set (operator override for non-THJ guild testing or when emoji catalog churn lands)

Per-fire variance: pickByMoods returns ALL matches; renderer uses deterministic selection (first by id ASC) for snapshot test reproducibility. V1.5 may add randomized rotation for visual variety.

### FR-4 · layout shape selector adapts to substrate license

Three shape variants, chosen at compose time:

- **shape A · all quiet** — italicized stage direction + one-line cross-dim tally, no card body
- **shape B · one dim hot** — full card for hot dim + tally line for others
- **shape C · multi dim hot** — full card per zone (one post per dim channel) + optional weaver cross-zone post

Decision rule — **ordered mutually-exclusive predicates** (closes flatline blockers SPRINT-SKP-001 [850] r1 · layout-decision-gap + PRD-SKP-002 [705] r2 · Shape B vs C overlap). Predicates evaluated TOP-TO-BOTTOM; first match wins. `gate_overrides` are ANY zones where `validation.shape_override === 'A'` (silence-mode triggered):

| # | predicate | shape | per-zone behavior |
|---|---|---|---|
| 1 | `gate_overrides ≥ 1 zone` | **mixed** | per-zone: override-zones render Shape A; remaining zones evaluated against rules 2-6 |
| 2 | `permittedClaims == 0 AND highRankZones == 0` | A · all quiet | italicized stage direction + cross-dim tally · no card body |
| 3 | `permittedClaims == 0 AND highRankZones == 1` | A · all quiet | data hot in one zone but no claim earned · honest silence |
| 4 | `permittedClaims == 0 AND highRankZones ≥ 2` | **C · NO-CLAIM** | data hot across dims · gate refused all interpretation · cards WITHOUT prose seasoning · emit `prose_gate.zone_data_no_voice` telemetry event |
| 5 | `permittedClaims == 1` | B · one dim hot | full card for the zone that earned prose + tally for others (regardless of highRankZones in those others) |
| 6 | `permittedClaims ≥ 2` | C · multi dim hot | full card per zone with permittedClaims; optional weaver cross-zone post in stonehenge |

This is the "substrate-driven typography" surface — data chooses layout density. Predicates are non-overlapping by construction (each row's `permittedClaims` band is disjoint from siblings).

### FR-5 · regression guards (gate-validation tests, not enforcement)

Per V1 telemetry-only contract, each operator-witnessed-drift case asserts the GATE FLAGS the violation. Does NOT assert prose modification.

1. **sequential-mint chain** (2026-05-14 incident) — input draft: "the four wallets moved in lockstep, coordinated cluster." When `cohort.unique_actors === 1`, gate produces `cohort-singleton` violation. Prose unchanged in V1.
2. **forced "structural shift"** — input draft: "structural shift this week" with `magnitude.current_percentile_rank: 88`. Gate produces `rank-below-threshold` violation (threshold ≥90).
3. **fake "p99-rare"** — input draft: "p99-rare event" with `magnitude.percentiles.p99.reliable: false`. Gate produces `percentile-unreliable` violation regardless of current rank.
4. **stale-but-loud** — input draft: ambient-claim language with `factor_stats.history.stale: true`. (V1 may not have a rule for this; document the gap for V1.5.)

### FR-6 · Effect.Tracer observability via @effect/opentelemetry

Add `@effect/opentelemetry` as a dependency to `packages/persona-engine`. Wire `Tracer` service:

- `composeReplyWithEnrichment`: outer span `chat.invoke` with attributes `{character_id, channel_id, prompt_len}`
- Each transform stage: child span (`compose.translate-emoji`, `compose.strip-voice-drift`, etc) with attributes from the existing log lines
- `dispatch.ts`: outer span `dispatch.slash-command` parent for all chat work
- `prose-gate.ts`: span events `prose_gate.violation` on the chat span (events are cheaper than separate spans for high-cardinality flags)

Wire-up budget: one OTEL Layer registering a Tracer. Production exports to operator-configured endpoint (Honeycomb / Grafana Tempo / Jaeger). Tests use a memory exporter for assertion.

SUPERSEDES the self-scaffolded chat-trace primitive scaffolded + reverted 2026-05-15. Operator directive: "EffectTS with OTEL is what we are reaching for here not a self scaffolded version of this." Reference: https://effect.website/docs/observability/tracing/.

## Acceptance Criteria

| AC | check |
|---|---|
| AC-1 | Sat/Sun digest produces a post per zone channel with dashboard-mirrored card body (when shape ≠ A) |
| AC-2 | Card lists active factors sorted desc, **capped at `LEADERBOARD_MAX_FACTORS` (default 19)** to fit Discord 1024-char embed-field cap; cold factors join with `·` separator up to cap; overflow renders `…and N more silent` token. Tests pin worst-case (19 onchain factors + cold-factor row) to ≤1024 chars. (closes PRD-SKP-001 [850]) |
| AC-3 | Per-row emoji slot populates from `factor_stats` rules **via registry `pickByMoods(...)` lookup, NOT hardcoded unicode**; cold factors get `['sadge', 'dazed']` mood; falls back to NO emoji when registry miss OR `MOOD_EMOJI_DISABLED=true`. (closes SDD-SKP-003 [710]) |
| AC-4 | Gate violation telemetry behavior gated by `PROSE_GATE_ON_VIOLATION=log\|skip\|silence`: `log` (default) preserves V1 doctrine (prose unchanged + telemetry); `skip` drops the post + emits skip-reason log; `silence` re-routes to Shape A layout (italicized stage direction + tally). All modes emit console.warn + OTEL span event. (closes PRD-SKP-001 [760, 720] + SDD-SKP-001 [760]) |
| AC-5 | Regression test for sequential-mint chain: gate flags `cohort-singleton` violation with `factor_id` resolved via proximity-window algorithm (200-char window, longest-match-first) |
| AC-6 | Regression test for forced "structural shift": gate flags `rank-below-threshold`; case-insensitive + word-boundary tests verify `Structural Shift`, `structural shifts`, `(structural shift).` all flag |
| AC-7 | OTEL `chat.invoke` span captures ALL transform stages as child spans (memory exporter test) |
| AC-8 | Layout-shape selector covers ALL 8 combinations of (permittedClaims ≥ 1) × (high-rank zone count); explicit Shape C NO-CLAIM variant tested. (closes SPRINT-SKP-001 [850]) |
| AC-9 | Both digest path AND composeReply (chat-mode) emit OTEL `chat.invoke` spans for transform-stage visibility; **prose-gate events fire ONLY on the digest path in V1** (chat-mode gate is V1.5 destination · closes PRD-SKP-002 [720] · chat-mode-scope) |
| AC-10 | factor_stats schema_version `'1.0.0' \| '1.1.0'` both accepted; absent factor_stats handled (historic factors fall through gate without violation per `factor_id: null` + `reason: no-factor-context`) |
| AC-11 | reply-emoji-translate.test.ts prod-byte tests continue to pass (regression on translateEmojiShortcodes contract) |
| AC-12 | Substrate API failure path: `get_dimension_breakdown` 5xx/timeout/`UPSTREAM_ERROR` envelope on digest cron → that zone is skipped with telemetry log; OTHER zones continue. Slash-command path: in-character error per existing register. (closes PRD-SKP-002 [750] · substrate-error-handling) |
| AC-13 | Regex morphology test pack: cluster pattern matches `Cohorts`, `lock-step`, `coordinated clusters`, mixed case; does NOT match `the cohort of validators` when `unique_actors > 1`. Word-boundary `\b` prevents false matches inside identifiers (e.g., `vault.cohorts_table` should not match). (closes PRD-SKP-002 [750] · regex-brittleness) |
| AC-14 | **Escalation runbook present** (closes flatline blocker PRD-SKP-005 [720] r3): `S5-CANARY.md` includes an "Escalation Criteria" section enumerating when operator promotes `PROSE_GATE_ON_VIOLATION` from `log` → `silence` → `skip`. Criteria: minimum 1-week telemetry observation; ≥3 confirmed user-facing complaints; OR ≥10 distinct violations of same `reason` per week. Review cadence: weekly operator check of `prose_gate.violation` OTEL events for the first month post-deploy; monthly thereafter. |
| AC-15 | **Discord total-embed limit guarded** (closes flatline blockers PRD-SKP-002 [760] r3 + PRD-SKP-001 [850] r3): renderer sums all fields + title + description + footer + author against the 6000-char Discord total cap; progressive shrink applies (cold-factors field shrinks first, top-factors second) when over. Tests verify worst-case total payload ≤ 6000. |

## Open Questions

1. **What if all factors are sub-threshold every week?** silence-register handles the "shape A" case; but the new shape posts the tally line even on shape A. Confirm with operator that's acceptable feel.
2. **Emoji source until medium-registry schema ships** — V1 ships with registry-mediated `pickByMoods(...)` using the existing THJ 43-emoji catalog (`orchestrator/emojis/registry.ts`). Sibling track `track-2026-05-15-medium-registry-emoji-capability.md` lands the discoverable catalog primitive in a later cycle; this cycle's renderer adopts that primitive when available without spec change.
3. **Chat-mode gate parity** — RESOLVED V1: chat-mode does NOT route through prose-gate. Chat is interactive + user-initiated; rubber-stamp risk surfaces in unprompted broadcasts (digests). Chat-mode gate is V1.5 destination if drift recurs in chat per telemetry review. Both paths still emit OTEL `chat.invoke` spans for transform visibility (AC-9). (closes PRD-SKP-002 [720] · chat-mode-scope)
4. **OTEL exporter choice** — Honeycomb / Grafana Tempo / Jaeger? Operator preference drives the prod env var (`OTEL_EXPORTER_OTLP_ENDPOINT=...`).
5. **Kill-switch default mode in prod** — V1 ships `PROSE_GATE_ON_VIOLATION=log` (telemetry-only). After 1-2 weeks of telemetry validation, operator may escalate per environment to `silence` (preserves channel presence with Shape A fallback) or `skip` (channel goes quiet on violation). Should the cycle-005 ship include a runbook for operator escalation decision criteria?

## Accepted V1 Limitations (operator-blessed · V1.5/V2 graduate)

Items the 2026-05-16 flatline review surfaced where gemini's skeptic flagged a substantive concern, but the V1-doctrine resolution is deliberate. Each carries an explicit graduation owner.

### A1 · `log` default may still post known-bad prose to Discord (PRD-SKP-001 [760] r1 + [760] r2)

**Gemini concern:** "Default production behavior still posts known-bad prose unchanged when the gate detects HIGH-severity violations."

**V1 resolution:** Accepted. The `PROSE_GATE_ON_VIOLATION=log` default IS the operator-controlled escalation surface (FR-2 r1 kill-switch). Operator promotes per-environment to `silence` or `skip` when 2-4 weeks of telemetry validates rules. Mirrors grail-ref-guard F4 doctrine precedent (V1 telemetry-only; V1.5 graduation).

**Graduation:** Operator runbook section in `S5-CANARY.md` enumerates escalation criteria (e.g., "≥3 confirmed user-facing complaints about gate-flagged prose → escalate to `silence` mode in prod").

### A2 · Chat-mode path unguarded against prose-drift (SDD-SKP-003 [750] r2)

**Gemini concern:** "Chat mode remains completely unguarded against structural hallucinations. inspectProse should integrate into composeReplyWithEnrichment for telemetry parity."

**V1 resolution:** Accepted scope. Operator pivot 2026-05-15 PM resolved chat-mode gate as V1.5 destination. Rationale: chat is interactive + user-initiated; rubber-stamp risk surfaces in unprompted broadcasts (digests). Digest path covers the actual incident surface (sequential-mint-chain etc were broadcast posts, not chat replies).

**Graduation:** V1.5 cycle integrates `inspectProse` into `composeReplyWithEnrichment` chat path with the same kill-switch surface. Telemetry from V1 informs whether chat-mode drift is empirically observed.

### A3 · Paraphrase/synonym bypass via proximity-attribution miss (SDD-SKP-001 [850] r2)

**Gemini concern:** "Prose gate fails open when factor names are paraphrased. Unattributed statistical claims should be treated as violations."

**V1 resolution:** Accepted as best-effort surface. `no-factor-context` violations log as telemetry but DON'T trigger HIGH-severity kill-switch escalation. Gemini's "fallback to digest's primary factor" would over-attribute (assuming the prose meant the primary factor when LLM may have meant a totally different one).

**Graduation:** V1.5 LLM-judge can adjudicate paraphrase semantics; V1 regex denylist is intentionally syntactic.

### A4 · Regex bypassable by morphological/Unicode variants (SDD-SKP-001 [740] r2)

**Gemini concern:** "Prose-gate regex denylist is trivially bypassable by morphological/Unicode variants and synonyms; LLM output is non-deterministic and will drift around the patterns."

**V1 resolution:** Accepted gap with explicit defensive layer. **Added NFR-7 (new, this cycle):** "gate detects literal pattern occurrences only. Adversarial bypasses (homoglyphs, fullwidth, zero-width insertions, semantic equivalents) are out of scope for V1. NFKC normalize + zero-width strip pattern from L7 sprint-7 HIGH-2 closure MAY land as V1 hardening if telemetry shows real-world LLM bypass; V1.5 LLM-judge is the canonical fix." Adversarial regression test cases added to T1.4 mature set (hyphen-variant, fullwidth, ZWSP-insertion) — they fail gracefully + are documented as known bypasses.

**Graduation:** V1.5 add NFKC + Cf-strip preprocessing if telemetry surfaces real bypasses. V2 LLM-judge closes semantic equivalence.

### A5 · `factor_stats` absent for historic factors → skip rule (SDD-SKP-002 [780] r2)

**Gemini concern:** "Skipping checks for absent factor stats validates hallucinations. Should emit `unsupported-claim` violation."

**V1 resolution:** **DISAGREE with gemini's framing.** Substrate doctrine (PR #77 + score-mibera #116 closure comment) explicitly states: `factor_stats` **absent** means "out of scope for this surface", NOT "no data, treat as hallucination." Historic factors (catalog `status:'historic'`) are pre-enrichment legacy data; the substrate refuses to enrich them by design. Treating absent stats as a violation would generate noise on every historic-factor reference, drowning the telemetry signal.

**Graduation:** No graduation needed — this is intentional cycle-022 substrate doctrine. If gemini's concern proves out empirically (operator sees hallucinated claims slip through because the proxy factor was historic), file separately as a SUBSTRATE-side issue (re-enrich historic factors, OR add a "historic-attributed claim" telemetry channel).

---

## V1.5 / V2 Destinations (out of scope this cycle, preserved for continuity)

- **V1.5** · register-map (`rank ≤ 5 → "quieter than usual"`, `rank ≥ 95 + p95 reliable → "top decile"`); soft-enforce (auto-downgrade vocabulary tier instead of just logging)
- **V1.5** · `verify/` module split when more verifiers warrant the category
- **V1.5** · stale-but-loud regression rule (FR-5 case 4)
- **V2** · cross-family LLM-as-judge for residual claims that regex misses
- **V2** · regenerate-with-refusal loop (returns refusal → re-prompt LLM with explicit refusal instruction)
- **V2** · in-band gate via Effect Layer (`ProseGate.provideService` at top of digest compose chain)

The full r0 design — Effect-Layer in-band gate, regenerate, silence-register fallback — is preserved at `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` under the "r0 (superseded but preserved as V1.5/V2 destination)" section. That artifact is the architectural destination, not the immediate sprint.

## Mad-AI Forward-Pointers (operator latitude · informational)

- The prose-gate's accumulated telemetry IS a corpus. Future cycles can mine it for "shape patterns ruggy keeps reaching for despite substrate not licensing them." A periodic post (satoshi role? sparse, gnomic) could REFLECT on the patterns: "the patterns ruggy reached for this week: lockstep (5 flags). cohort (3 flags). when nothing earned them." The bot speaking about its own discipline in character.
- OTEL spans + events make this corpus QUERYABLE in industry-standard dashboards. The agent's body becomes self-observable through Jaeger/Tempo/Honeycomb — proprioception via well-tested primitives, not self-scaffolded ones.
- The substrate-driven typography (FR-4 layout adapts to license) is novel territory. Layout-as-output of substrate-licensing — operator described this as "mad-AI-stuff i don't have language for." Worth a written reflection in a separate vault entry post-ship.

## Refs

- `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` (origin track · r0 destination preserved)
- `grimoires/loa/context/track-2026-05-15-herald-substrate-renderer-boundary.md` (r1 ruggy-as-leaderboard design lineage · HERALD r0 superseded)
- `grimoires/loa/context/track-2026-05-15-medium-registry-emoji-capability.md` (sibling track · medium-registry emoji catalog as discoverable primitive)
- PR #73 (cycle-021 pulse cards · dormant renderer that reactivates as FR-1)
- PR #77 (cycle-022 factor_stats type mirror · MERGED 2026-05-16 · precondition for FR-2/3)
- score-mibera PR #116 / issue #115 (substrate-side "numbers not verdicts" doctrine)
- zerker's V1 gate proposal: https://github.com/0xHoneyJar/freeside-characters/pull/77#issuecomment-4463325245
- issue #74 (CLOSED · architectural deferral resolved by this cycle)
- issue #79 (CLOSED · OTEL DX folded into FR-6)
- construct-effect-substrate doctrine: ECS ≡ Effect ≡ Hexagonal isomorphism · four-folder pattern · hand-port-with-drift · doc-only-then-runtime · single-effect-provide-site
- Effect.Tracer reference: https://effect.website/docs/observability/tracing/
