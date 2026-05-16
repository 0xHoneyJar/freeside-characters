---
status: candidate
mode: arch+feel
authored_by: claude opus 4.7 (1m) acting as OPERATOR + KEEPER + FEEL
authored_for: zksoju
operator_session: 2026-05-15
target_cycle: TBD (cycle-023 working number · operator assigns at promotion)
target_branch: feat/cycle-XXX-ruggy-leaderboard (after current cycle-004 substrate-refactor lands)
depends_on:
  - PR #77 (cycle-022 factor_stats type mirror) — must merge first
  - score-mibera 1.1.0 in prod (✓ merged 2026-05-15)
  - cycle-004 substrate refactor (LLM gateway port pattern; Effect-Layer foundation)
related:
  - track-2026-05-15-herald-substrate-renderer-boundary.md (r1)
  - track-2026-05-15-medium-registry-emoji-capability.md (sibling track)
  - PR #77 comment 4463325245 (zerker's V1 prose-gate proposal, 2026-05-15 20:30 UTC)
  - issue: cron silence diagnostic (filed separately, #78)
revisions:
  - 2026-05-15 r0 — initial cycle-spec · my fuller in-band Effect-Layer gate (5 sprints, ~600 LoC)
  - 2026-05-15 r1 — operator-directed pivot · hybrid-staged gate (zerker V1 first, my fuller as V1.5/V2 destination); ship gate + leaderboard as ONE cycle; observability via @effect/opentelemetry not ad-hoc primitive
expiry: until promoted to sprint OR superseded
---

# cycle-XXX · ruggy-as-leaderboard + hybrid-staged prose-gate

> **r1 supersedes r0.** Operator decisions today (2026-05-15 PM):
> - Gate ships HYBRID-STAGED — zerker's V1 (telemetry-only, ~100 LoC) first; my fuller in-band Effect-Layer spec becomes the V1.5/V2 destination after 2-4 weeks of telemetry validates the rules
> - Gate UI is **telemetry-only V1** — no user-visible signal (mirrors grail-ref-guard F4 doctrine)
> - Leaderboard + gate ship as **ONE CYCLE** — coherent shipment, not split
> - Observability is **@effect/opentelemetry (Effect.Tracer)** — operator-named alternative to the ad-hoc chat-trace primitive I scaffolded earlier today (which was reverted; the test fixture at `packages/persona-engine/src/compose/reply-emoji-translate.test.ts` survives as a prod-byte regression suite for the translation function)
>
> The r0 design below is preserved as the V1.5/V2 destination, NOT as the immediate sprint.

## r1 consolidated shape (operator-blessed)

### Sprint phasing

| sprint | scope | LoC est | days |
|---|---|---|---|
| S0 | Calibration spike — verify `factor_stats` v1.1.0 in prod for each dim; verify @effect/opentelemetry wire-up cost; verify zerker's three regex patterns match real ruggy drafts in the archive (pull from grail-ref-guard.ts as the precedent) | <half-day, deletes itself | 0.5 |
| S1 | **V1 gate** (zerker proposal) — single file mirroring `deliver/grail-ref-guard.ts`. Three regex denylist rules tied to mechanical no-data checks from `factor_stats`. Telemetry-only: log violations to `.run/prose-gate.jsonl` AND emit OTEL events on the chat span. No user-visible signal. ~100 LoC including tests. | ~100 | 1 |
| S2 | **Leaderboard body** — reactivate `buildPulseDimensionPayload` (PR #73 dormant renderer) as ruggy's digest BODY. Extend to consume `factor_stats` per-row when permitted. Renderer is deterministic; voice layer is 1-line header + per-row mood-emoji + 1-line outro. | ~150 | 1-2 |
| S3 | **Layout shape selector** — A (all quiet) / B (one dim hot) / C (multi dim hot). Decision rule consumes gate output + factor_stats. Tests per shape. | ~80 | 1 |
| S4 | **Mood-emoji rules** — `factor_stats` → emoji slot per-row. Hardcoded unicode defaults V1; resolves to medium-registry capability when sibling track ships. | ~60 | 0.5 |
| S5 | **OTEL wire-up + end-to-end canary** — add `@effect/opentelemetry` Tracer service. Chat span auto-created on dispatch; gate violations emit as span events; transform stages emit as child spans. End-to-end canary on dev channel before THJ. | ~80 | 1 |

Total: ~470 LoC + ~5 days. Half the original r0 estimate. Substrate-side colleague's lean V1 proposal makes this feasible.

### r1 functional requirements

#### FR-1 · ruggy digest body = deterministic dashboard-mirrored card (unchanged from r0)

See "FR-1" in r0 section below. No revision needed — operator endorsed.

#### FR-2 · zerker's V1 prose-gate (REPLACES r0 FR-2 Effect-Layer gate)

Lives at `packages/persona-engine/src/deliver/prose-gate.ts` (next to `grail-ref-guard.ts` — leverage sibling pattern; new `verify/` module deferred to V1.5+ when more verifiers exist).

Three regex rules, telemetry-only:

| trigger phrase pattern (regex) | flag as violation when |
|---|---|
| `coordinated cluster\|lockstep\|same wallets\|cohort` | `cohort.unique_actors <= 1` |
| `p99-rare\|tail event\|top decile` | `magnitude.percentiles.p99.reliable === false` OR `magnitude.current_percentile_rank < 95` |
| `structural shift\|unprecedented\|breakout\|breaking pattern` | `magnitude.current_percentile_rank < 90` OR rank is `null` |

Returns a structured `ProseGateValidation` interface mirroring `GrailRefValidation`:

```ts
export interface ProseGateValidation {
  /** Phrase patterns matched in draft. */
  matched_patterns: readonly { pattern: string; span: readonly [number, number] }[];
  /** Substrate states that triggered flag. */
  violations: readonly {
    pattern: string;
    factor_id: string | null;
    reason: 'cohort-singleton' | 'percentile-unreliable' | 'rank-below-threshold' | 'rank-null';
  }[];
}
```

`inspectProse(draft: string, factorStatsByFactorId: Map<string, FactorStats>): { text: string; validation: ProseGateValidation }` — text returned unchanged (V1 telemetry). Behavior follows F4 grail-ref-guard precedent: NO user-visible footer, NO regenerate loop, NO refusal.

Telemetry surfaces via two channels:
- `console.warn` line: `[prose-gate] character=ruggy violations=[cohort-singleton:Boosted_Validator] draft_hash=abc123`
- OTEL span event: `prose_gate.violation` with attributes `{pattern, factor_id, reason, character_id, draft_hash}` (FR-6 OTEL surface; queryable from Jaeger/Tempo/Honeycomb)

#### FR-3 · per-row mood emoji (unchanged from r0)

See r0 FR-3 below.

#### FR-4 · layout shape selector A/B/C (unchanged from r0)

See r0 FR-4 below.

#### FR-5 · regression guards (REVISED)

The r0 four regression cases (sequential-mint, forced-shift, fake-p99, stale-but-loud) become **gate-validation tests**, not gate-enforcement tests. Each case asserts the gate FLAGS the violation in telemetry — does NOT assert that prose is altered or refused (V1 telemetry-only contract).

The zerker proposal calls out that `cohort.unique_actors === 1` is the MECHANICAL no-cluster check that kills the sequential-mint-chain class structurally. So the test for that case asserts: when `factor_stats.cohort.unique_actors === 1` AND draft contains "cohort" / "lockstep" / "coordinated cluster", the gate produces a violation. No prose modification.

#### FR-6 · Effect.Tracer observability (NEW · replaces r0 ad-hoc trace)

Add `@effect/opentelemetry` as a dependency to `packages/persona-engine`. Wire `Tracer` service in:
- `composeReplyWithEnrichment`: outer span `chat.invoke` with attributes `{character_id, channel_id, prompt_len}`
- Each transform stage: child span (`compose.translate-emoji`, `compose.strip-voice-drift`, etc) with attributes captured from the existing log lines
- `dispatch.ts`: outer span `dispatch.slash-command` parent for all chat work
- `prose-gate.ts`: span events `prose_gate.violation` on the chat span (not separate spans — events are cheaper)

This SUPERSEDES the chat-trace primitive I scaffolded earlier today. Operator directive 2026-05-15: "EffectTS with OTEL is what we are reaching for here not a self scaffolded version of this."

Wire-up budget: one OTEL Layer that registers a Tracer. In production, exports to operator-configured endpoint (Honeycomb / Grafana Tempo / Jaeger). In tests, a memory exporter for assertion.

Reference: https://effect.website/docs/observability/tracing/

#### Out of scope (V1.5 / V2 destinations)

- r0 FR-2's in-band gate + regenerate-with-refusal → V1.5
- r0 FR-2's register-map (rank → permitted vocabulary tier) → V1.5
- Cross-family LLM-as-judge for residual claims → V2
- `verify/` module split (when more verifiers warrant a category) → V1.5+
- Cadence-claim primitive (score-mibera #118 deferred) → blocked on substrate
- Medium-registry emoji catalog discovery → sibling track, separate cycle

### Phasing summary

```
NOW (1 week)         · S0 → S5 ship V1 cycle (gate telemetry-only + leaderboard + OTEL)
2-4 weeks AFTER ship · review prose-gate.jsonl + OTEL events; tune rules; decide V1.5
V1.5 (later cycle)   · register-map · soft-enforce (downgrade vocabulary tier instead of just logging)
V2 (later cycle)     · cross-family LLM-as-judge for residual · regenerate-with-refusal
```

---

# r0 (superseded but preserved as V1.5/V2 destination)

> Operator-directed pivot 2026-05-15 PM to hybrid-staged shape per zerker's V1 proposal. The r0 design below remains the architectural DESTINATION (V1.5/V2). It is NOT the next-sprint scope.

> Sprint-ready candidate spec. Operator promotes by moving to
> `grimoires/loa/cycles/cycle-XXX-name/prd.md` + assigning cycle number.
> Status remains `candidate` until promotion.

## intent

Restructure ruggy's weekly digest so the deterministic data card from PR #73
becomes the body and ruggy's voice becomes seasoning (~10% of the post's
pixels). Add an in-band Effect Layer prose-gate that type-checks ruggy's voice
elements against `factor_stats` v1.1.0 to mechanically prevent shape-before-
signal drift (the bug surfaced in the 2026-05-14 Discord exchange).

## non-intent

- replacing satoshi's locked sparse register
- introducing a third character / webhook / cadence
- removing LLM from the path (ruggy still composes the header / outro / per-row mood — just with a smaller surface)
- breaking the existing chat-mode reply path (`composeReply` is untouched)
- shipping a hardcoded emoji palette (the per-row mood-emoji binds to the medium-registry capability described in the sibling track)

## prd-level functional requirements

### FR-1 · ruggy digest body = deterministic dashboard-mirrored card

The current digest path (LLM picks 1-3 factors within 80-140 word prose budget)
is replaced. New flow per zone:

1. `digest` cron fires
2. Fetch `get_dimension_breakdown(window: 7, dimension: <zone>)` (for dim-channels) or `get_community_counts(window: 7) + get_most_active_wallets(7, 5)` (for stonehenge)
3. Schema-validate response is 1.1.0 + `factor_stats` populated per live factor
4. Pass through `buildPulseDimensionPayload` (reactivated from PR #73) extended to render the `factor_stats` per-row emoji slot
5. LLM is invoked ONCE for the voice-seasoning slot: header (1 line) + per-row emoji selections + outro (1 line)
6. Post the composed payload via Pattern B webhook to the zone's channel

The dashboard's `/dimension/[id]` page is the reference shape. Operator-locked
PR #73 trim decisions stay locked (no footer, no was-N, no diversity chip line,
no field-name suffixes — the six trims are regression-guarded).

### FR-2 · in-band Effect Layer prose-gate

Lives at `packages/persona-engine/src/verify/`. Four files:

- `prose-gate.port.ts` — Effect Service tag + interface
- `percentile-register.live.ts` — production adapter (rules below)
- `prose-gate.mock.ts` — stub-mode adapter (returns everything as `permitted` for tests)
- `claim-parser.ts` — pure function that scans ruggy's draft for claim-types

Rules (production adapter):

| claim-type | parser hits on | adjudicator | permits |
|---|---|---|---|
| magnitude-elevation | "elevated" / "structural shift" / "rare" / "p99" / percentile language | `factor_stats.magnitude.current_percentile_rank >= 95 && magnitude.percentiles.p95.reliable === true` | "elevated, top decile" |
| magnitude-quiet | "subdued" / "quiet" / "low" | `factor_stats.magnitude.current_percentile_rank <= 25` | "subdued" |
| cluster-coordinated | "lockstep" / "coordinated" / "cluster" / "same wallets" | `factor_stats.cohort.unique_actors > 1 && cohort.current_percentile_rank >= 90` | "growing cohort" |
| cadence-break | "breaking pattern" / "after a quiet stretch" | `factor_stats.cadence.current_gap_percentile_rank >= 90 && cadence.occurrence.current_is_active === true` | "after a quiet stretch" |
| (anything outside the grammar) | catch-all | refuse | empty register |

The gate returns `{ permitted_claims: Claim[], refused_claims: Claim[], permitted_stance: StanceCard | null }`. The compose chain consumes:

- If `permitted_claims` is empty AND `permitted_stance` is null → drop the header line entirely; fall back to silence-register template
- If `permitted_claims` has entries → ruggy's header line composes against the permitted vocabulary only
- `refused_claims` are LOGGED (telemetry) for operator observability

### FR-3 · per-row mood emoji from factor_stats

Each per-factor row in the card gets an optional 1-char emoji slot. Rule
sheet draft (see sibling track `track-2026-05-15-medium-registry-emoji-capability.md`
for the schema proposal; this lists current-cycle defaults if the schema isn't
shipped yet):

| factor_stats state | emoji slot |
|---|---|
| `magnitude.current_percentile_rank >= 95 && magnitude.percentiles.p95.reliable` | 🔥 (or registry-bound "top-decile reliable") |
| `cohort.current_percentile_rank >= 90 && cohort.unique_actors >= 5` | 👀 (or registry-bound "growing cohort") |
| `cadence.current_gap_percentile_rank >= 90 && cadence.occurrence.current_is_active` | ⚡ (or registry-bound "breaking quiet") |
| `factor.previous > 5 && factor.total === 0` (went-quiet) | ☁️ (or registry-bound "cold") |
| (everything else) | (no emoji) |

Emoji source resolves at runtime per character's `mediumOverrides.emojiCatalog`
when the medium-registry capability ships (sibling track FR-1). Until then,
hardcoded unicode defaults above + a fallback to ruggy's 43-emoji
THJ-guild catalog if a registry hit is available.

### FR-4 · layout adapts to substrate license

Three layout shapes per zone, chosen at compose time by inspecting permitted_claims + factor_stats:

- **shape A · all quiet** — italicized stage direction + one-line cross-dim tally, no card body
- **shape B · one dim hot** — full card for the hot dim + tally line for others
- **shape C · multi dim hot** — full card per zone (one post per dim channel) + optional weaver cross-zone post (requires WEAVER_ENABLED — see cron diagnostic)

Decision rule:
- shape A: zero zones have any permitted_claims AND total events < 50
- shape B: exactly one zone has permitted_claims OR exactly one zone has `magnitude.current_percentile_rank >= 90` for any factor
- shape C: ≥2 zones have permitted_claims

This is the "substrate-driven typography" surface — data chooses layout density.

### FR-5 · regression guards (operator-witnessed drifts)

Test cases that MUST refuse:

1. **sequential-mint chain** (2026-05-14 incident) — input: 4 wallets minting `#3230, #3231, #3232, #3233`. claim-parser sees "chain" / "lockstep". gate adjudicates `cohort.unique_actors = 4 && cohort.current_percentile_rank` against eligibility → refuse if cohort isn't actually exceptional.
2. **forced "structural shift"** — input: 30-event week with `magnitude.current_percentile_rank = 88`. gate refuses (threshold is ≥95 with reliable=true).
3. **fake "p99-rare"** — input: factor with `magnitude.percentiles.p99.reliable = false`. gate refuses regardless of current rank.
4. **stale-but-loud** — input: `factor_stats.history.stale = true`. gate refuses cadence claims, downgrades magnitude.

## sdd-level architecture

### file layout (additive — no breaking changes)

```
packages/persona-engine/src/
  ├─ verify/                               ← NEW
  │   ├─ prose-gate.port.ts                ← Effect.Tag + Service interface
  │   ├─ prose-gate.live.ts                ← Layer.succeed(ProseGate, ProseGateLive)
  │   ├─ percentile-register.ts            ← pure rules (factor_stats → register)
  │   ├─ mood-emoji.ts                     ← pure rules (factor_stats → emoji slot)
  │   ├─ claim-parser.ts                   ← pure scan of draft → Claim[]
  │   ├─ prose-gate.mock.ts                ← Layer.succeed(ProseGate, ProseGateMock)
  │   └─ *.test.ts                         ← rule tests + regression guards
  ├─ compose/
  │   ├─ digest.ts                         ← MODIFIED: pulls ProseGate, restructures path
  │   └─ digest.test.ts                    ← MODIFIED: snapshot per layout-shape
  ├─ deliver/
  │   ├─ embed.ts                          ← MODIFIED: buildPulseDimensionPayload extended with emoji slot
  │   └─ embed-pulse.test.ts               ← MODIFIED: extend trimmed-layout tests
  └─ score/
      └─ client.ts                         ← reactivate fetchDimensionBreakdown
```

### Effect Service shape

```typescript
// verify/prose-gate.port.ts
import { Context, Effect } from 'effect';
import type { FactorStats } from '../score/types.ts';

export interface Claim {
  readonly type: 'magnitude-elevation' | 'magnitude-quiet' | 'cluster-coordinated' | 'cadence-break';
  readonly factor_id: string;
  readonly text_span: readonly [number, number];  // index range in draft
}

export interface GateOutput {
  readonly permitted_claims: readonly Claim[];
  readonly refused_claims: readonly Claim[];
  readonly permitted_stance: StanceCard | null;
  readonly permitted_register: ReadonlyMap<Claim['type'], string>;
}

export class ProseGate extends Context.Tag('ProseGate')<
  ProseGate,
  {
    readonly check: (draft: string, factor_stats: ReadonlyMap<string, FactorStats>) => Effect.Effect<GateOutput>;
    readonly emojiForFactor: (stats: FactorStats) => Effect.Effect<string | null>;
  }
>() {}
```

Single provide site at top of `compose/digest.ts`:

```typescript
// compose/digest.ts (excerpt)
const program = Effect.gen(function* () {
  const gate = yield* ProseGate;
  const breakdown = yield* fetchDimensionBreakdown(zone);
  const factor_stats_map = breakdown.factor_stats_by_id;
  const draft = yield* generateRuggyDraft(zone, breakdown);  // small voice surface
  const gate_output = yield* gate.check(draft, factor_stats_map);
  const card = yield* buildLeaderboard(breakdown, gate_output);
  return composeWebhookPayload(card);
});

const main = program.pipe(Effect.provide(ProseGateLive));
```

### voice surface (what the LLM is asked for)

Three slots, each gate-checked:

1. **header** — 1 line, gated against `permitted_stance` from voice-grimoire sampler. When refused → drop the line.
2. **per-row mood** — 1 char per factor row, sourced from `gate.emojiForFactor(stats)`. No LLM call here — pure rule lookup.
3. **outro** — 1 line, always allowed, rotated from `silence-register.md` templates OR `stay groovy 🐻` close.

The 80-140 word prose budget collapses to ~20-40 words total (header + outro lines). The card body carries the rest.

## acceptance criteria

| AC | check |
|---|---|
| AC-1 | Sat/Sun digest produces a post per zone channel with the dashboard-mirrored card body |
| AC-2 | Card lists ALL active factors sorted desc (no truncation), within Discord 1024-char field cap |
| AC-3 | Per-row emoji slot populates from factor_stats rules; cold factors get the "went quiet" emoji |
| AC-4 | When gate refuses all claims → header line is dropped; silence-register template substitutes |
| AC-5 | Regression test for sequential-mint chain: prose-gate refuses "lockstep" claim |
| AC-6 | Regression test for forced "structural shift": prose-gate refuses below percentile threshold |
| AC-7 | Refused claims log to `.run/prose-gate.jsonl` with `{factor_id, claim_type, factor_stats_snapshot}` |
| AC-8 | layout-shape selector (A/B/C) chosen deterministically; tests for each shape |
| AC-9 | composeReply (chat-mode) unaffected — chat path still gateless (gate is digest-only) |
| AC-10 | factor_stats schema_version `'1.0.0' \| '1.1.0'` accepted; absent factor_stats handled (historic factors) |

## risks + open questions

1. **what if all factors are sub-threshold?** every week. silence-register handles it; this is doctrine. operator should confirm the silence-register templates feel right for the data-card-with-no-prose case (currently the templates assume "all quiet means I'm not even posting" — but new shape posts the tally line even on shape A).
2. **emoji source until medium-registry schema ships** — fallback path is unicode defaults + best-effort lookup in ruggy's 43-emoji THJ catalog. character-flavor loss is acceptable for one cycle.
3. **chat-mode parity** — should `/ruggy "what's the og pulse"` also route through the gate? recommendation: NOT in this cycle. chat is interactive + user-initiated; the rubber-stamp risk surfaces in unprompted broadcasts (digests). chat-mode gate is a follow-up cycle if drift recurs in chat.
4. **cadence-interval primitive** — score-mibera #118 (deferred) would enable a richer cadence claim. spec consumes what 1.1.0 already exposes; doesn't block on #118.

## proposed sprint shape

| sprint | scope |
|---|---|
| S0 | calibration spike — confirm `factor_stats` populated in prod for one live factor across each dim; half-day budget; spike script auto-deletes |
| S1 | `verify/` module — pure rules, no LLM, no Effect Layer wiring yet; ship with 4+ regression tests |
| S2 | Effect Layer integration — `ProseGateLive`, `ProseGateMock`, single-provide-site in `compose/digest.ts` |
| S3 | renderer extension — `buildPulseDimensionPayload` gets factor_stats per-row emoji slot |
| S4 | layout shape selector — A/B/C decision rule + tests |
| S5 | end-to-end — sat/sun fire produces a real post, post-merge canary in dev channel before THJ |

## refs

- track-2026-05-15-herald-substrate-renderer-boundary.md (r1) — design pivot lineage
- track-2026-05-15-medium-registry-emoji-capability.md — sibling track for FR-3 schema home
- PR #73 — dormant deterministic renderer + 7 trim regression guards
- PR #77 — factor_stats type mirror (must merge before S0)
- score-mibera #115 — three-primitive doctrine (claim-type / set-overlap / cadence-interval)
- score-mibera #116 — verification primitives substrate (1.1.0)
- construct-effect-substrate — domain/ports/live/mock pattern · single-effect-provide-site · hand-port-with-drift · doc-only-then-runtime
