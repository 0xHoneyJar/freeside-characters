# Sprint Plan — ruggy-as-leaderboard + hybrid-staged prose-gate (cycle-005)

> **Version**: 1.0
> **Date**: 2026-05-16
> **Author**: planning-sprints skill
> **PRD**: `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/prd.md`
> **SDD**: `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/sdd.md`
> **Origin track**: `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` (r1 supersedes r0)
> **Target branch**: `feat/cycle-005-ruggy-leaderboard` (created from `main` after cycle-004 substrate refactor lands)

## 0 · context

Hybrid-staged shipment of (a) the deterministic leaderboard card body
that mirrors the dashboard for ruggy's weekly digest and (b) zerker's
V1 telemetry-only prose-gate that ties phrase patterns to mechanical
`factor_stats` substrate checks.

> From PRD: "The deterministic dashboard-mirrored card (PR #73's
> dormant `buildPulseDimensionPayload`) becomes the BODY of ruggy's
> output — 85–95% of the post's pixels are data. Voice becomes
> seasoning — 1-line header + per-row mood-emoji + 1-line outro."
> (prd.md:21-23)

V1 contract is **telemetry-only** (mirrors `grail-ref-guard.ts` F4
doctrine): gate flags violations to console.warn + OTEL events, prose
text is returned UNCHANGED. V1.5 adds register-map + soft-enforce; V2
adds cross-family LLM-as-judge + regenerate-with-refusal. Both are
explicitly out of scope this cycle.

> From PRD: "V1 (this cycle) — zerker's telemetry-only gate +
> leaderboard restructure + OTEL wire-up. ~470 LoC, ~5 days."
> (prd.md:30)

Observability adopts `@effect/opentelemetry` (`Effect.Tracer`)
instead of the self-scaffolded chat-trace primitive that was
scaffolded + reverted 2026-05-15. Operator directive locked in PRD
FR-6: "EffectTS with OTEL is what we are reaching for here not a
self scaffolded version of this." (prd.md:146)

### Preconditions (must hold before S0 fires)

Three HARD preconditions and one SOFT precondition (closes flatline blocker SPRINT-SKP-001 [720] · cycle-004 gate contradiction):

**HARD** (S0.T0.0 verifies; STOP on fail):

1. **PR #77 merged** — provides `FactorStats` type at consumer
   (`packages/persona-engine/src/score/types.ts`). MERGED 2026-05-16
   01:27 UTC per PRD metadata.
2. **score-mibera 1.1.0 in prod** — emits `factor_stats` envelope
   with `schema_version: '1.0.0' | '1.1.0'`. MERGED 2026-05-15.
3. **Target branch `feat/cycle-005-ruggy-leaderboard` cut from main**.

**SOFT** (S0.T0.0 records; S5 chooses ergonomic vs fallback path):

4. **cycle-004 substrate refactor merged** — Effect-Layer foundation + LLM gateway port pattern.
   - If MERGED: S5 uses `@effect/opentelemetry` `NodeSdk.layer(...)` Tracer service (FR-6 ergonomic path).
   - If NOT MERGED: S5 falls back to `@opentelemetry/api` direct (the global `trace.getTracer('freeside-characters')` form). Functional equivalent, less Effect-idiomatic. SDD §5 + §6 document both paths.
   - Either way: AC-7 (memory exporter test) + AC-9 (chat.invoke span emits transform-stage children) hold.

If any HARD precondition fails, **STOP** and surface to operator. SOFT precondition just routes S5 to one of two documented paths.

### S0.T0.0 — automated precondition check (NEW · closes SPRINT-SKP-001 [720])

Before any other S0 work, run an automated precondition verifier:

```bash
# scripts/cycle-005-s0-preconditions.sh (deleted at S0 close with the spike)

set -euo pipefail
FAIL=0

# HARD-0: env-var prerequisites (closes flatline blocker SPRINT-SKP-002 [750] r2)
# Verify required env vars EXIST before any network call. Empty / unset → HARD fail.
: "${MCP_KEY:?HARD-0: MCP_KEY env var is unset or empty; export it before running S0}"
: "${SCORE_API_URL:?HARD-0: SCORE_API_URL env var is unset or empty}"
echo "✓ HARD-0: MCP_KEY + SCORE_API_URL env vars present"

# HARD-1: FactorStats type exists in score/types.ts (PR #77 merged into local main)
if ! grep -q "export interface FactorStats" packages/persona-engine/src/score/types.ts; then
  echo "✗ HARD-1: FactorStats interface missing from score/types.ts (PR #77 not merged here)"; FAIL=1
else echo "✓ HARD-1: FactorStats interface present"; fi

# HARD-2: score-mibera substrate emits 1.1.0 — HARD-fail on unknown
# (closes flatline blocker SPRINT-SKP-001 [740] r2 · unknown-schema silent downgrade)
SCORE_VER=$(curl -sS --fail -H "Authorization: Bearer $MCP_KEY" \
  "$SCORE_API_URL/health" 2>/dev/null | jq -r '.pulse_schema_version // .schema_version // "MISSING"' 2>/dev/null || echo "FETCH_FAILED")
case "$SCORE_VER" in
  "1.1.0")
    echo "✓ HARD-2: score-api pulse_schema_version=1.1.0" ;;
  "MISSING"|"FETCH_FAILED"|"")
    # Unknown schema → HARD fail unless operator override file present
    if [ -f "grimoires/loa/cycles/cycle-005-ruggy-leaderboard/.HARD-2-OVERRIDE" ]; then
      echo "⚠ HARD-2: schema unknown; override file present with operator approval — accepting"
      cat grimoires/loa/cycles/cycle-005-ruggy-leaderboard/.HARD-2-OVERRIDE
    else
      echo "✗ HARD-2: /health returned no schema_version OR fetch failed (SCORE_VER='$SCORE_VER')"
      echo "  REMEDIATION: verify substrate manually, then drop a .HARD-2-OVERRIDE file with evidence"
      echo "  (e.g. \`echo 'verified live get_dimension_breakdown returns 1.1.0 envelope' > .HARD-2-OVERRIDE\`)"
      FAIL=1
    fi ;;
  *)
    echo "✗ HARD-2: unexpected schema $SCORE_VER (expected 1.1.0)"; FAIL=1 ;;
esac

# HARD-3: target branch exists
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "feat/cycle-005-ruggy-leaderboard" ]; then
  echo "✗ HARD-3: current branch is $CURRENT_BRANCH, expected feat/cycle-005-ruggy-leaderboard"; FAIL=1
else echo "✓ HARD-3: on target branch"; fi

# SOFT-4: cycle-004 merged into main
mkdir -p .run
if git log main --oneline 2>/dev/null | grep -q "cycle-004"; then
  echo "✓ SOFT-4: cycle-004 found in main history → S5 ergonomic path (Effect.Tracer)"
  echo "OTEL_PATH=effect-tracer" > .run/cycle-005-otel-path.env
else
  echo "ℹ SOFT-4: cycle-004 NOT in main → S5 fallback path (@opentelemetry/api direct)"
  echo "OTEL_PATH=otel-api-direct" > .run/cycle-005-otel-path.env
fi

[ "$FAIL" = "1" ] && { echo "STOP: HARD precondition failed; surface to operator"; exit 1; }
exit 0
```

The script writes `.run/cycle-005-otel-path.env` documenting the chosen OTEL wiring path. S5 reads this to know which path to take.

## 1 · sprint shape

**6 sprints · 28 tasks · single-track sequential** with soft
parallelism inside each sprint where noted.

| sprint | scope | task count | risk | LoC budget | dependencies |
|---|---|---|---|---|---|
| **S0** calibration spike (auto-delete) | SMALL | 4 | LOW | spike-only | preconditions |
| **S1** V1 prose-gate (telemetry-only) | SMALL | 5 | LOW | ~100 | S0 |
| **S2** leaderboard body + mood emoji slot | MEDIUM | 6 | MEDIUM | ~150 | S1 (proseGate option) |
| **S3** layout shape selector A/B/C | SMALL | 4 | LOW | ~80 | S2 |
| **S4** mood-emoji rules from factor_stats | SMALL | 3 | LOW | ~60 | S2 |
| **S5** OTEL wire-up + E2E canary + goal validation | MEDIUM | 6 | MEDIUM | ~80 | S1+S2+S3+S4 |

**Total**: ~470 LoC, ~5 working days, 28 tasks across 6 sprints.

**Soft parallelism**:
- S3 and S4 can land in parallel after S2 ships (independent files).
- Within S1: regex authoring (T1.2) and ProseGateValidation shape
  (T1.1) can land in either order.

**Hard sequence**:
- S0 → S1 (spike validates regex matches real archive)
- S1 → S2 (proseGate option in `buildPulseDimensionPayload` signature)
- S1 + S2 + S3 + S4 → S5 (OTEL spans wrap all transform stages)

## 2 · global numbering (Sprint Ledger)

Per `grimoires/loa/ledger.json` after this plan registers:

| local_id | global_number | title |
|---|---|---|
| S0 | sprint-6 | Calibration spike — factor_stats live verify + OTEL wire-cost + regex-vs-archive |
| S1 | sprint-7 | V1 prose-gate (telemetry-only) — sibling to grail-ref-guard |
| S2 | sprint-8 | Leaderboard body — reactivate buildPulseDimensionPayload + mood emoji slot |
| S3 | sprint-9 | Layout shape selector (A/B/C) — substrate-driven typography |
| S4 | sprint-10 | Mood-emoji rules — factor_stats → unicode emoji per-row |
| S5 | sprint-11 | OTEL wire-up (@effect/opentelemetry) + E2E canary + goal validation |

`next_sprint_number` advances to 12 on registration.

---

## Sprint 0: Calibration spike — factor_stats live verify + OTEL wire-cost + regex-vs-archive

**Scope**: SMALL (4 tasks · spike-only LoC · auto-delete on close)
**Sprint Goal**: De-risk three integration unknowns in a half-day before committing S1+ to specific shapes — (1) `factor_stats` populated in prod for one live factor per dim, (2) `@effect/opentelemetry` wire-up cost is bounded, (3) zerker's three regex patterns match real ruggy drafts in the archive.

> From PRD: "S0 | Calibration spike — verify factor_stats v1.1.0 in
> prod for each dim; verify @effect/opentelemetry wire-up cost;
> verify zerker's three regex patterns match real ruggy drafts in
> the archive (pull from grail-ref-guard.ts as the precedent)
> | <half-day, deletes itself | 0.5"
> (context cycle-spec:40)

### Deliverables

- [ ] **D0.1** — spike script `scripts/cycle-005-s0-calibration.ts` that exercises one `get_dimension_breakdown` call per zone against staging score-mcp; logs `factor_stats.schema_version`, `top_factors[].factor_stats` shape, and any factors missing the envelope
- [ ] **D0.2** — half-day spike of `@effect/opentelemetry` wire-up: import `NodeSdk`, register `OtelLive` Layer, emit one test span via `Effect.Tracer`, verify console exporter receives it (no real OTLP endpoint required for spike)
- [ ] **D0.3** — regex-vs-archive: pull last 4 weekly ruggy digests from prod (operator paste or `.run/` archive); manually grep for the three FR-2 trigger patterns (`coordinated cluster|lockstep|...`, `p99-rare|tail event|...`, `structural shift|unprecedented|...`); record match counts per pattern
- [ ] **D0.4** — spike findings logged to `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/S0-COMPLETED.md`; spike script `scripts/cycle-005-s0-calibration.ts` deleted in the same commit (NET 0 LoC to cycle, mirrors compass-cycle-1 FR-0 contract per CLAUDE.md fallback-patterns §2)

### Acceptance Criteria

- [ ] **AC-S0.1** — at least one zone (stonehenge/bear-cave/el-dorado/owsley-lab) returns `factor_stats` envelope with `schema_version: '1.0.0' | '1.1.0'` for at least one factor; absent-factor cases documented
- [ ] **AC-S0.2** — `@effect/opentelemetry` Layer constructs without runtime error; one test span emits to console exporter
- [ ] **AC-S0.3** — regex match counts per pattern recorded in S0-COMPLETED.md; if zero matches across all three patterns, **STOP** and surface to operator (the gate has nothing to flag)
- [ ] **AC-S0.4** — spike script deleted; `git diff --stat` shows NET 0 LoC to cycle (only the COMPLETED.md remains)
- [ ] **AC-S0.5** — any integration cost surfaced (e.g., missing FactorStats type import path, OTEL package version pin, Bun vs Node-only API) lands in S0-COMPLETED.md so S1+ inherits the pinning

### Technical Tasks

- [ ] **T0.0** (P0) — run `scripts/cycle-005-s0-preconditions.sh` (defined in §Preconditions above); STOP on HARD-precondition failure; record OTEL path (effect-tracer vs otel-api-direct) to `.run/cycle-005-otel-path.env`. (closes flatline blocker SPRINT-SKP-001 [720] · S0-precondition-manual)
- [ ] **T0.1** — author `scripts/cycle-005-s0-calibration.ts` that calls `get_dimension_breakdown(window: 7, dimension: <zone>)` for each of the 4 zones; print `top_factors[0].factor_stats` JSON.stringify per zone → **[G-1]** **[G-2]**
- [ ] **T0.2** — sketch `OtelLive` Layer (or fallback `@opentelemetry/api` direct shape per `.run/cycle-005-otel-path.env`) in scratch file; verify TracerProvider works with console exporter; record any package-version drift or peer-dep gotchas → **[G-3]**
- [ ] **T0.3** — pull 4 weekly digest texts (operator paste OR `.run/digest-history/*.jsonl` if present); grep for the three FR-2 patterns; tabulate match count per pattern per draft; verify morphology test pack (case-insensitive · word boundaries) catches at least one variant in archive → **[G-2]**
- [ ] **T0.4** — write `S0-COMPLETED.md` with findings (precondition results · factor_stats live state per zone · OTEL wire-cost + chosen path · regex match counts · pinning notes for S1+); delete spike scripts (T0.0 + T0.1 + T0.2); commit (NET 0 LoC to cycle) → **[G-1]**

### Dependencies

- All 3 preconditions (PR #77, score-mibera 1.1.0, cycle-004 substrate)
- Staging score-mcp reachable from dev environment (`MCP_KEY` env)
- 4 weeks of prior ruggy digest archive (operator paste path acceptable)

### Risks & Mitigation

- **Risk**: `factor_stats` not actually populated in prod despite score-mibera 1.1.0 merge. **Mitigation**: spike's AC-S0.1 surfaces this immediately; if true, route to operator for score-mibera follow-up before S1 fires (S1 has nothing to test against without live data).
- **Risk**: regex patterns produce zero matches across 4-week archive (gate has nothing to flag). **Mitigation**: AC-S0.3 escalates to operator; may indicate patterns need broadening OR that ruggy's recent drafts are already clean (which would be a happy surprise but warrants re-scoping S1 telemetry expectations).
- **Risk**: `@effect/opentelemetry` peer-dep conflict with existing Effect 3.x pin. **Mitigation**: spike T0.2 records exact package versions; S5 inherits the pin.
- **Risk**: half-day budget overrun (S0 becomes 2-day rabbithole). **Mitigation**: hard-cap at half-day; if any AC unresolved, file follow-up sprint and proceed to S1 with documented gap.

### Success Metrics

- Half-day budget held (≤ 4 hours work)
- All 3 unknowns resolved OR explicitly documented as gaps with operator-routed follow-ups
- NET 0 LoC to cycle (spike script auto-deleted)

---

## Sprint 1: V1 prose-gate (telemetry-only) — sibling to grail-ref-guard

**Scope**: SMALL (5 tasks · ~100 LoC)
**Sprint Goal**: Ship `packages/persona-engine/src/deliver/prose-gate.ts` mirroring `grail-ref-guard.ts` shape + telemetry surface. Three regex denylist rules tied to mechanical `factor_stats` substrate checks. Returns `{text, validation}` with text UNCHANGED. Telemetry via `console.warn` only this sprint; OTEL wiring deferred to S5.

> From SDD: "Mirrors grail-ref-guard.ts in shape + telemetry surface.
> Pure-regex denylist; no Effect Layer required at V1."
> (sdd.md:38)

### Deliverables

- [ ] **D1.1** — `packages/persona-engine/src/deliver/prose-gate.ts` exporting `ProseGateValidation` interface + `inspectProse(draft, factorStatsByFactorId)` function (~80 LoC)
- [ ] **D1.2** — `packages/persona-engine/src/deliver/prose-gate.test.ts` with ≥6 regression cases: 4 from FR-5 (sequential-mint, structural-shift-forced, fake-p99-rare, stale-but-loud) + 2 negative cases that should NOT flag (~50 LoC)
- [ ] **D1.3** — helper `buildFactorStatsMap(captured)` that walks toolResults envelopes (from `score/types.ts`) and constructs the `ReadonlyMap<string, FactorStats>` lookup
- [ ] **D1.4** — `composeReplyWithEnrichment` insertion after `translateEmojiShortcodes`: calls `inspectProse`, emits `console.warn` on violations (OTEL events deferred to S5)
- [ ] **D1.5** — NOTES.md decision-log entry documenting the V1 telemetry-only contract + the V1.5/V2 destination preserved at PRD lines 171-180

### Acceptance Criteria

- [ ] **AC-S1.1** — `inspectProse` returns `{text, validation}` with `text` byte-identical to input draft (NFR-2 idempotency)
- [ ] **AC-S1.2** — regression test for sequential-mint chain (FR-5 case 1): when `cohort.unique_actors === 1` and draft contains "the four wallets moved in lockstep, coordinated cluster", gate produces violation with `reason: 'cohort-singleton'`
- [ ] **AC-S1.3** — regression test for forced "structural shift" (FR-5 case 2): when `magnitude.current_percentile_rank: 88` and draft contains "structural shift this week", gate produces violation with `reason: 'rank-below-threshold'`
- [ ] **AC-S1.4** — regression test for fake "p99-rare" (FR-5 case 3): when `magnitude.percentiles.p99.reliable: false` and draft contains "p99-rare event", gate produces violation with `reason: 'percentile-unreliable'` regardless of current rank
- [ ] **AC-S1.5** — historic-factor case (no factor_stats): `factorStatsByFactorId.get(factor_id)` returns undefined → gate skips that factor's rule check, no violation emitted (NFR per SDD §"Failure Modes")
- [ ] **AC-S1.6** — `draft_hash` (8-char SHA-256) appears in console.warn line, full draft text does NOT (NFR-3 telemetry hygiene)
- [ ] **AC-S1.7** — 50K-char synthetic draft processes in <100ms (NFR-6: no catastrophic regex backtracking)
- [ ] **AC-S1.8** — existing `reply-emoji-translate.test.ts` continues to pass (regression on translateEmojiShortcodes contract per AC-11)

### Technical Tasks

- [ ] **T1.1** — author `ProseGateValidation` interface in `deliver/prose-gate.ts` per SDD §1 spec (matched_patterns + violations arrays with readonly + literal-union reasons) → **[G-2]**
- [ ] **T1.2** — implement `PROSE_GATE_RULES` const array (3 rules per SDD §1.60-86) with regex patterns + check callbacks + reason literals → **[G-2]**
- [ ] **T1.3** — implement `inspectProse(draft, factorStatsByFactorId, factors)`: loop rules → run regex over draft (each pattern uses `gi` flag + `\b` boundaries per SDD §1) → for each match, run `attributeFactor(...)` proximity algorithm (N=200 chars before/after, longest-match-first, closest-pos wins) to resolve `factor_id`; null fallback emits violation with `reason: 'no-factor-context'` → assemble validation. Closes flatline blockers PRD-SKP-003 [705] + SDD-SKP-001 [750] + SDD-SKP-001 [720] + SDD-SKP-002 [735]. → **[G-2]**
- [ ] **T1.4** — write `prose-gate.test.ts` with 4 FR-5 regression cases (3 must-flag from FR-5 + 1 negative for stale-but-loud documented as V1.5 gap) + **morphology test pack per PRD AC-13** (`Cohorts`, `lock-step`, `coordinated clusters`, mixed-case `Structural Shift`, punctuation-adjacent) + word-boundary negative tests (no false match inside `vault.cohorts_table` identifier) + 2 negative cases (low-cohort draft with no cluster language, top-decile draft with p95 reliable rank=98) + 1 historic-factor (undefined lookup) case + 1 catastrophic-backtracking 50K-char case → **[G-2]** **[G-4]**
- [ ] **T1.5** — write `buildFactorStatsMap(captured)` helper that walks `toolResults` envelopes from score MCP and constructs lookup map + factors array (id + display_name pairs for proximity attribution); wire into **digest path** per SDD §5 (NOT chat-mode in V1 per PRD AC-9); add `resolveProseGateMode()` env-reader + kill-switch routing (log/skip/silence per PRD FR-2 + SDD §1); console.warn telemetry line with `draft_hash` + `mode` + violation reasons → **[G-1]** **[G-2]**

### Dependencies

- S0 completed (regex patterns validated against real-archive drafts)
- `FactorStats` type imported from `packages/persona-engine/src/score/types.ts` (PR #77 precondition)
- Existing `grail-ref-guard.ts` as the sibling-pattern reference

### Risks & Mitigation

- **Risk**: SDD §1.89 ambiguity — "V1 may run check against ALL active factors and emit per failing one; simpler V1 = run check against the FIRST factor in the breakdown that the draft references by name". **Mitigation**: pick "first-referenced" for V1 (simpler); document the alternate in NOTES.md so V1.5 can revisit. Tests pin the V1 behavior.
- **Risk**: `factor_id` extraction from draft is non-trivial when ruggy uses prose like "the Boosted_Validator factor" vs "boosted validator". **Mitigation**: V1 match is exact factor-id-substring; if no exact match, `factor_id: null` and rule check runs against all factors (any one failing produces violation). Document in T1.3.
- **Risk**: regex catastrophic backtracking on long drafts. **Mitigation**: AC-S1.7 pins a 50K-char synthetic test; patterns are simple alternations per NFR-6.
- **Risk**: false-positive on legitimate cohort-discussion language ("the cohort of holders"). **Mitigation**: V1 telemetry-only means no user-visible damage — operator reviews telemetry over 2-4 weeks before V1.5 graduates to soft-enforce.

### Success Metrics

- ≥6 test cases pass; 100% of FR-5 cases 1-3 produce expected violation reasons
- `console.warn` line includes `character_id`, violations array, `draft_hash` per NFR-3
- LoC budget held: ≤ 100 LoC total across prose-gate.ts + prose-gate.test.ts + composeReply insertion
- Zero regressions in existing test suite (174+ passing per recent baseline)

---

## Sprint 2: Leaderboard body — reactivate buildPulseDimensionPayload + mood emoji slot

**Scope**: MEDIUM (6 tasks · ~150 LoC)
**Sprint Goal**: Reactivate `buildPulseDimensionPayload` (PR #73's operator-locked dormant renderer) as ruggy's digest BODY. Extend signature to accept `moodEmoji` callback (FR-3) and `proseGate` validation (FR-2 telemetry-only). Six PR #73 trim decisions stay locked + regression-guarded.

> From SDD: "Function exists, was operator-locked in PR #73, has been
> DORMANT since (no caller wired). This cycle reactivates it as
> ruggy's digest BODY." (sdd.md:108)

> From PRD: "The PR #73 operator-locked trim decisions stay locked
> (no footer, no was-N, no diversity chip line, no field-name
> suffixes — the six trims are regression-guarded)." (prd.md:62)

### Deliverables

- [ ] **D2.1** — `buildPulseDimensionPayload` signature extended with optional `options: { moodEmoji?, proseGate? }` per SDD §2; default behavior unchanged when options absent
- [ ] **D2.2** — caller wire: `compose/digest.ts` (or whichever module owns digest composition) imports + invokes `buildPulseDimensionPayload` with fresh data from `fetchDimensionBreakdown` + composed factor_stats map
- [ ] **D2.3** — voice layer: 1-line LLM-composed header + 1-line outro flank the card body per PRD intent; LLM prompt explicitly says "interpret only what the gate licenses" (replaces prior unbounded `tool_invocation_style` surface per PRD Non-Intent §"Removing existing LLM-enrichment...")
- [ ] **D2.4** — per-row mood emoji slot in card body: each factor row gets optional 1-char emoji via the `moodEmoji` callback (rules implemented in S4; S2 wires the slot)
- [ ] **D2.5** — regression test for the 6 PR #73 trims: no footer line, no `was-N` count, no diversity-chip line, no field-name suffixes, no truncation, all active factors sorted desc
- [ ] **D2.6** — snapshot test of one full digest payload per zone (4 snapshots) verifying card body matches dashboard mirror within Discord 1024-char field cap

### Acceptance Criteria

- [ ] **AC-S2.1** (PRD AC-1) — Sat/Sun digest cron fires; one post per zone channel produced with dashboard-mirrored card BODY (Pattern B webhook delivery)
- [ ] **AC-S2.2** (PRD AC-2 r1) — Card lists active factors sorted desc, **capped at `LEADERBOARD_MAX_FACTORS` (default 19)** to fit Discord 1024-char embed-field cap; cold factors join with `·` separator up to cap; overflow renders `…and N more silent` token. Tests pin worst-case (19 onchain factors + cold-factor row) ≤ 1024 chars. Future dim with >19 factors triggers automatic pagination across multiple embed fields (SDD §Component 2 implementation note). (closes flatline blocker PRD-SKP-001 [850] + SPRINT-SKP-002 [750])
- [ ] **AC-S2.3** (PRD AC-10) — `factor_stats schema_version: '1.0.0' | '1.1.0'` both accepted; absent `factor_stats` for historic factors handled (no crash; falls back to no emoji)
- [ ] **AC-S2.4** — 6 PR #73 trims regression-guarded by test (no footer, no was-N, no diversity-chip, no field-suffixes, no truncation, sort desc)
- [ ] **AC-S2.5** — `moodEmoji` callback wired as optional; called once per row; rendering puts emoji in the per-row slot per FR-3 layout
- [ ] **AC-S2.6** — `proseGate` validation option wired but does NOT modify text (V1 contract); telemetry side-effect only (continues S1's console.warn surface)
- [ ] **AC-S2.7** — schema validation: response fails fast with structured error when `schema_version` is outside the `'1.0.0' | '1.1.0'` union (per PRD FR-1 step 3)

### Technical Tasks

- [ ] **T2.1** — extend `buildPulseDimensionPayload` signature in `deliver/embed.ts` per SDD §2 spec; default `options = {}` preserves current behavior → **[G-1]**
- [ ] **T2.1.5** — implement **dynamic char-length truncation** in the renderer (closes flatline blocker SPRINT-SKP-001 [850] r2 · static-count-vs-dynamic-chars): accumulate row character lengths as rows append; before each row, check `accumulated + row.length + separator + truncation_token` against 1024; on breach, stop appending + emit `…and N more silent` token with computed N. Apply to both `top_factors` and `cold_factors` sections (each is a separate embed field, each respects its own 1024 cap). `LEADERBOARD_MAX_FACTORS` (default 19) is a soft hint; dynamic algorithm wins on long-name overflow. → **[G-1]**
- [ ] **T2.2** — render per-row emoji slot in the embed: when `options.moodEmoji?.(stats)` returns a string, prepend (or append per design TBD with operator) to factor row; when null, no slot rendered → **[G-1]**
- [ ] **T2.3** — wire caller in `compose/digest.ts` (or equivalent): `fetchDimensionBreakdown` → `buildFactorStatsMap` (from S1.T1.5) → `buildPulseDimensionPayload(response, dim, 7, { moodEmoji: moodEmojiForFactor, proseGate: validation })` → `deliverViaWebhook` → **[G-1]**
- [ ] **T2.4** — LLM voice layer: refactor existing digest LLM prompt to (a) take the deterministic card body as context, (b) generate 1-line header + 1-line outro, (c) instruct "interpret only what the gate licenses — do not invent claims about cohorts, rarity, or shifts unless the substrate data permits" → **[G-1]** **[G-4]**
- [ ] **T2.5** — write regression test `compose/digest.test.ts` per layout shape (placeholder for S3): for shape B (one dim hot), snapshot the full payload and assert (1) no footer line, (2) no was-N, (3) no diversity-chip, (4) no field-name suffixes, (5) active factors present sorted desc + `…and N more silent` token when truncated, (6) total length ≤ 1024-char field cap PER FIELD across multiple long-name distributions (verify dynamic algorithm, not just static-19 case) → **[G-1]** **[G-2]**
- [ ] **T2.6** — schema validation tightening in `fetchDimensionBreakdown` (or its decoder): when `schema_version` falls outside `'1.0.0' | '1.1.0'`, throw structured error; add test for this case → **[G-1]**

### Dependencies

- S1 completed (proseGate option type + buildFactorStatsMap helper)
- `buildPulseDimensionPayload` exists in `deliver/embed.ts` from PR #73
- `fetchDimensionBreakdown` exists in `score/client.ts` (reactivates from PR #73)
- `compose/digest.ts` or equivalent digest-composition module from existing codebase

### Risks & Mitigation

- **Risk**: Discord 1024-char field cap exceeded when zone has many active factors. **Mitigation**: V1 r1 resolution per PRD AC-2 — cap at top 19 factors (`LEADERBOARD_MAX_FACTORS` env, default 19, verified worst-case for onchain dim) + overflow renders `…and N more silent` token. Tests pin worst-case. Future dim growth >19 factors → automatic pagination across embed fields (SDD §Component 2 implementation note). NOT fail-fast.
- **Risk**: LLM voice layer over-claims even when prompt says "interpret only what the gate licenses". **Mitigation**: prose-gate (S1) flags it via telemetry; operator reviews flagged drafts over 2-4 weeks; V1.5 adds soft-enforce.
- **Risk**: caller wiring deviates from existing digest path's shape (current path may be `compose/digest.ts` or `cron/digest.ts` or elsewhere). **Mitigation**: T2.3 explicitly grounds against the existing path; document any deviation in NOTES.md per `feedback_spec_deviation_pattern` discipline.
- **Risk**: PR #73 dormant renderer was operator-locked at a specific shape; reactivating without re-verifying the 6 trims drifts. **Mitigation**: AC-S2.4 + T2.5 pin all 6 trims via test; any drift surfaces in CI.

### Success Metrics

- LoC budget held: ≤ 150 LoC total across embed.ts extension + digest.ts wire + tests
- 4 zone-snapshot tests pass; 6-trim regression test passes
- Zero regressions in 174+ existing tests
- One end-to-end manual dry-run via `bun run digest:once` (forced DRY-RUN per existing pattern) produces a valid payload that prints correctly

---

## Sprint 3: Layout shape selector (A/B/C) — substrate-driven typography

**Scope**: SMALL (4 tasks · ~80 LoC)
**Sprint Goal**: Ship `packages/persona-engine/src/compose/layout-shape.ts` implementing the FR-4 decision rule: A (all quiet) / B (one dim hot) / C (multi dim hot). Layout chosen at compose time based on substrate license per zone (permitted_claims, top rank, total events).

> From PRD: "This is the 'substrate-driven typography' surface —
> data chooses layout density." (prd.md:125)

### Deliverables

- [ ] **D3.1** — `packages/persona-engine/src/compose/layout-shape.ts` exporting `LayoutShape` type + `selectLayoutShape(args)` function per SDD §4
- [ ] **D3.2** — `layout-shape.test.ts` with ≥9 test cases (3 per shape · positive + boundary + negative)
- [ ] **D3.3** — caller wire in `compose/digest.ts`: `selectLayoutShape(...)` → dispatch to shape-A renderer (silence-register style) / shape-B renderer (full card for hot dim + tally for others) / shape-C renderer (full card per zone + optional weaver cross-zone post)
- [ ] **D3.4** — shape-A handler reuses existing silence-register from PR-V0.7-A.4 expression layer; shape-B + shape-C wire to `buildPulseDimensionPayload` per appropriate zone subset

### Acceptance Criteria

- [ ] **AC-S3.1** (PRD AC-8 r1) — `selectLayoutShape` covers ALL 8 combinations of (permittedClaims ≥ 1) × (high-rank zone count); explicit Shape C NO-CLAIM variant tested. (closes flatline blocker SPRINT-SKP-001 [850] · layout-decision-gap)
- [ ] **AC-S3.2** — shape A: all 4 zones empty + total events < 50 → returns `'A-all-quiet'`; renderer produces italicized stage direction + one-line cross-dim tally (no card body)
- [ ] **AC-S3.3** — shape B: exactly one zone has permittedClaims ≥ 1 → returns `'B-one-dim-hot'`; renderer produces full card for hot dim + tally for others
- [ ] **AC-S3.4** — shape C (standard): ≥2 zones have permittedClaims ≥ 1 → returns `'C-multi-dim-hot'`; renderer produces full card per zone
- [ ] **AC-S3.5** — **shape C NO-CLAIM variant** (NEW per PRD FR-4 r1): `permittedClaims === 0` zones AND ≥2 zones have `rank ≥ 90` → returns `'C-multi-dim-hot'` BUT renderer outputs cards WITHOUT prose seasoning; emits `prose_gate.zone_data_no_voice` telemetry event for operator review
- [ ] **AC-S3.6** — boundary case: exactly 2 zones with permitted_claims → shape C (NOT B); test pins this boundary
- [ ] **AC-S3.7** — shape A confirms PRD Open Question #1 disposition: tally line posted even on all-quiet (operator confirmation captured in S0 or pre-S3)

### Technical Tasks

- [ ] **T3.1** — implement `LayoutShape` type + `selectLayoutShape({zones, permittedClaimsByZone, topRankByZone, totalEventsByZone})` per SDD §4 decision tree → **[G-1]**
- [ ] **T3.2** — write `layout-shape.test.ts` with 11 cases: 3 shape-A (all-quiet · just-under-50-events · just-over-49-events boundary), 2 shape-B (one dim with permittedClaims · zero permitted but exactly-one rank-hot → still Shape A per PRD AC-8 r1), 3 shape-C standard (exactly 2 permitted · 4 permitted · permitted + rank-hot mix), 2 **shape-C NO-CLAIM variant** (zero permitted but multi-zone rank-hot · zero permitted but 4-zone rank-hot mix) + 1 telemetry assertion verifying `prose_gate.zone_data_no_voice` event emits in NO-CLAIM variant → **[G-2]**
- [ ] **T3.3** — wire caller in `compose/digest.ts`: build the three `Map<ZoneId, ...>` inputs from `fetchDimensionBreakdown` per-zone responses; call `selectLayoutShape`; switch on result to choose renderer path → **[G-1]**
- [ ] **T3.4** — shape-A renderer: reuse existing `silence-register` module (`expression/silence-register.ts` per NOTES.md V0.7-A.4 entry) for the italicized stage direction; add cross-dim tally line below → **[G-1]**

### Dependencies

- S2 completed (`buildPulseDimensionPayload` reactivated, callable for shape-B + shape-C paths)
- Existing silence-register module from V0.7-A.4 expression layer
- PRD Open Question #1 resolved with operator (acceptable to post tally line on shape A)

### Risks & Mitigation

- **Risk**: PRD Open Question #1 ("all-quiet but post tally") unresolved at S3 start → operator may reject the tally-on-all-quiet shape. **Mitigation**: surface to operator at S0-COMPLETED checkpoint OR S2 close; if rejected, shape-A becomes silence-register-only (no tally), simpler. T3.4 adapts.
- **Risk**: shape boundary ambiguity ("exactly one zone has permitted_claims OR exactly one zone has rank ≥90 — what if BOTH are true for the same dim?"). **Mitigation**: boundary tests in T3.2 pin every edge case; document the decision tree in code comments.
- **Risk**: shape-C produces multi-post burst that triggers Discord rate limits. **Mitigation**: existing webhook delivery has back-off; S5 E2E canary surfaces any real rate-limit hits.

### Success Metrics

- 9 test cases pass deterministically
- LoC budget held: ≤ 80 LoC across layout-shape.ts + tests + digest.ts wire
- Zero regressions

---

## Sprint 4: Mood-emoji rules — factor_stats → registry-mediated emoji per-row

**Scope**: SMALL (3 tasks · ~60 LoC)
**Sprint Goal**: Ship `packages/persona-engine/src/deliver/mood-emoji.ts` implementing the FR-3 per-row emoji rules — pure-with-env-read functions mapping `factor_stats` state to a registry-mediated Discord render token (`<:name:id>` or `<a:name:id>`) via `pickByMoods(...)` from `orchestrator/emojis/registry.ts`. **Registry-mediated, NOT hardcoded unicode** per PRD r1 (closes SDD-SKP-003 [710]).

> From PRD r1 FR-3: "Mood-emoji selection MUST go through the existing
> THJ guild emoji registry at `orchestrator/emojis/registry.ts` via
> `pickByMoods(moods, 'ruggy')`. This preserves the persona's voice
> rules + makes the cycle compatible with the sibling medium-registry
> capability track when it ships." (prd.md FR-3 r1)

### Deliverables

- [ ] **D4.1** — `packages/persona-engine/src/deliver/mood-emoji.ts` exporting `moodEmojiForFactor(stats)` + `moodEmojiForColdFactor(factor)` per SDD §3 r1 (registry-mediated implementation)
- [ ] **D4.2** — `mood-emoji.test.ts` with one case per mood-tag set (4 must-emit + 1 negative no-emoji baseline + 1 historic-factor undefined-stats case + 1 `MOOD_EMOJI_DISABLED=true` env-disabled case)
- [ ] **D4.3** — `buildPulseDimensionPayload` caller in `compose/digest.ts` passes `moodEmojiForFactor` as the `moodEmoji` option (wires S2's slot)

### Acceptance Criteria

- [ ] **AC-S4.1** (PRD AC-3 r1) — Per-row emoji slot populates from factor_stats rules **via `pickByMoods(...)` registry lookup**; cold factors (previous > 5, total === 0) get the `['sadge', 'dazed']` mood
- [ ] **AC-S4.2** — `magnitude.current_percentile_rank >= 95 && magnitude.percentiles.p95.reliable === true` → registry `['flex']` → e.g. `<:ruggy_flex:1143652000110747720>`
- [ ] **AC-S4.3** — `cohort.current_percentile_rank >= 90 && cohort.unique_actors >= 5` → registry `['eyes', 'shocked']`
- [ ] **AC-S4.4** — `cadence.current_gap_percentile_rank >= 90 && occurrence.current_is_active === true` → registry `['noted', 'concerned']`
- [ ] **AC-S4.5** — historic factor (stats undefined) → null (no emoji rendered)
- [ ] **AC-S4.6** — `MOOD_EMOJI_DISABLED=true` env → all calls return null (operator override; documented in `.env.example`)
- [ ] **AC-S4.7** — registry miss (pickByMoods returns []) → falls back to null (no crash); deterministic selection within hits (sorted by id ASC for snapshot reproducibility)

### Technical Tasks

- [ ] **T4.1** — implement `moodEmojiForFactor(stats)` per SDD §3 r1 priority order via `pickByMoods` registry lookup: no_data/error/unknown_factor → null; magnitude top → `['flex']`; cohort top → `['eyes', 'shocked']`; cadence top → `['noted', 'concerned']`; else null → **[G-1]**
- [ ] **T4.2** — implement `moodEmojiForColdFactor(factor)` checking `factor.previous > 5 && factor.total === 0` → `['sadge', 'dazed']` else null → **[G-1]**
- [ ] **T4.3** — write `mood-emoji.test.ts` with 7 cases (one per emit rule + negative + historic-undefined + MOOD_EMOJI_DISABLED env-override); wire `moodEmojiForFactor` into `compose/digest.ts` caller per S2's open slot → **[G-1]** **[G-2]**

### Dependencies

- S2 completed (`moodEmoji` callback slot wired in `buildPulseDimensionPayload`)
- `FactorStats` + `PulseDimensionFactor` types accessible
- THJ emoji registry at `orchestrator/emojis/registry.ts` (existing · 43 emojis fetched 2026-04-29)

### Risks & Mitigation

- **Risk**: rule priority order is operator-tunable but not documented in PRD (e.g., what if a factor qualifies for BOTH magnitude-top AND cohort-top?). **Mitigation**: SDD §3 r1 implies magnitude > cohort > cadence priority via if-cascade order; T4.1 implements that order and adds a test asserting it; document in code comment.
- **Risk**: registry miss for a mood tag (e.g., if catalog churn removes all `flex`-tagged emojis). **Mitigation**: AC-S4.7 covers null-fallback; test asserts no crash; operator visibility via lack of emoji slot (silent degradation acceptable per V1 doctrine).
- **Risk**: bot's webhook lacks USE_EXTERNAL_EMOJIS or emoji ID changes (the original `:ruggy_point:` rendering bug class). **Mitigation**: registry rebuild process when emoji churn is observed; `reply-emoji-translate.test.ts` regression suite continues to pin known-good IDs.
- **Risk**: medium-registry sibling track ships mid-cycle and operator wants live integration. **Mitigation**: V1 r1 already uses the existing registry; if sibling track introduces a NEW capability surface, this implementation gets a swap point (resolveEmojiCatalog) without blocking the cycle.

### Success Metrics

- 6 test cases pass
- LoC budget held: ≤ 60 LoC
- Zero regressions

---

## Sprint 5: OTEL wire-up (@effect/opentelemetry) + E2E canary + goal validation

**Scope**: MEDIUM (6 tasks · ~80 LoC)
**Sprint Goal**: Add `@effect/opentelemetry` dependency; wire `OtelLive` Layer (prod) + `OtelTest` Layer (in-memory exporter for tests); enrich `composeReplyWithEnrichment` + `dispatch.ts` with chat.invoke span + transform child spans + `prose_gate.violation` span events. End-to-end canary on staging Discord channel before THJ deploy. Final sprint includes **E2E goal validation** per Appendix C.

> From PRD: "SUPERSEDES the self-scaffolded chat-trace primitive
> scaffolded + reverted 2026-05-15. Operator directive: 'EffectTS
> with OTEL is what we are reaching for here not a self scaffolded
> version of this.'" (prd.md:146)

### Deliverables

- [ ] **D5.1** — `@effect/opentelemetry` + `@opentelemetry/sdk-trace-base` + `@opentelemetry/exporter-trace-otlp-http` added to `packages/persona-engine/package.json`; lockfile updated
- [ ] **D5.2** — `packages/persona-engine/src/observability/otel-layer.ts` exports `OtelLive` (BatchSpanProcessor + OTLP HTTP exporter via `OTEL_EXPORTER_OTLP_ENDPOINT` env)
- [ ] **D5.3** — `packages/persona-engine/src/observability/otel-test.ts` exports `OtelTest` (SimpleSpanProcessor + `InMemorySpanExporter` for assertion)
- [ ] **D5.4** — `composeReplyWithEnrichment` wraps in `chat.invoke` outer span (attributes: `character_id`, `channel_id`, `prompt_len`); each transform stage (`compose.translate-emoji`, `compose.strip-voice-drift`, `compose.grail-ref-guard`, `compose.prose-gate`) emits child spans
- [ ] **D5.5** — `prose-gate.ts` (extended from S1) emits `prose_gate.violation` as span event (not separate span) on the active chat span with attributes `{pattern, factor_id, reason, character_id, draft_hash}` per NFR-4 cardinality
- [ ] **D5.6** — `dispatch.ts` wraps slash-command handler in `dispatch.slash-command` outer span as parent for all chat work (still imperative — uses OpenTelemetry API directly via `trace.getTracer('freeside-characters')` per SDD §6.224)
- [ ] **D5.7** — memory-exporter test in `observability/otel-test.test.ts` verifies the span tree: `chat.invoke` > N transform child spans > prose_gate.violation events
- [ ] **D5.8** — end-to-end canary: dry-run `bun run digest:once` on dev guild channel BEFORE production deploy; operator visually validates card body + voice layer + emoji slots; record canary findings in `S5-CANARY.md`
- [ ] **D5.9** — `CHANGELOG.md` entry + cycle-005 archive metadata; ledger marks cycle status `archived` on close

### Acceptance Criteria

- [ ] **AC-S5.1** (PRD AC-7) — OTEL `chat.invoke` span captures ALL transform stages as child spans (verified via memory-exporter test)
- [ ] **AC-S5.2** (PRD AC-9) — `composeReply` chat-mode AND digest path both emit OTEL spans; chat-mode `chat.invoke` span correlates with `prose_gate.violation` events when fired
- [ ] **AC-S5.3** (PRD AC-4) — when gate flags a violation: console.warn (S1) + OTEL span event (S5) both emit; prose text unchanged (V1 contract)
- [ ] **AC-S5.4** — `OTEL_EXPORTER_OTLP_ENDPOINT` env var documented in `.env.example`; absence-of-endpoint case handled (BatchSpanProcessor buffers; never blocks chat compose per SDD failure-modes)
- [ ] **AC-S5.5** — OTEL cardinality bounded: pattern enum (~3 values), reason enum (~4 values), factor_id bounded by score-mibera catalog (~28 factors) — NFR-4 satisfied
- [ ] **AC-S5.6** — dev-guild canary post visually validates: card body matches dashboard mirror, voice layer is 1-line header + 1-line outro, per-row emojis render correctly, no engineering jargon leaks (KEEPER discipline)
- [ ] **AC-S5.7** — **E2E goal validation** per Appendix C: all 5 cycle goals (G-1..G-5) traced to delivered surfaces; any unvalidated goal blocks cycle close

### Technical Tasks

- [ ] **T5.1** — `bun add @effect/opentelemetry @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http` in `packages/persona-engine`; pin versions per S0 spike findings; verify peer-dep compat with Effect 3.x → **[G-3]**
- [ ] **T5.2** — author `observability/otel-layer.ts` per SDD §6 · **PATH DEPENDS ON SOFT-4 precondition (cycle-004 merged?)** recorded in `.run/cycle-005-otel-path.env` from T0.0. If `OTEL_PATH=effect-tracer` → use `NodeSdk.layer(() => ({...}))` from `@effect/opentelemetry`. If `OTEL_PATH=otel-api-direct` (cycle-004 absent) → use the global `trace.getTracer('freeside-characters')` form from `@opentelemetry/api` directly + a manual `NodeTracerProvider` setup. Both paths satisfy AC-S5.4. (closes flatline blocker SPRINT-SKP-001 [720] · cycle-004 gate contradiction) → **[G-3]**
- [ ] **T5.3** — author `observability/otel-test.ts` per SDD §6: same shape with `SimpleSpanProcessor(new InMemorySpanExporter())` for assertion → **[G-3]**
- [ ] **T5.4** — wire `Effect.provideLayer(OtelLive)` (or `OtelTest`) at top of `composeReplyWithEnrichment`; wrap each transform stage in `Effect.useSpan('compose.<stage>', {attributes: {...}})`; emit prose_gate.violation events on the active span per SDD §5 → **[G-3]**
- [ ] **T5.5** — wire `dispatch.ts` slash-command handler in `dispatch.slash-command` outer span using OpenTelemetry API directly (`trace.getTracer('freeside-characters').startActiveSpan(...)`); ensure child spans from composeReply propagate via context per SDD §6 non-Effect note → **[G-3]**
- [ ] **T5.6** — write `observability/otel-test.test.ts` memory-exporter test: invoke composeReplyWithEnrichment with `OtelTest` Layer + a draft that triggers prose-gate violation; assert `InMemorySpanExporter.getFinishedSpans()` contains `chat.invoke` span with N child spans + `prose_gate.violation` event → **[G-3]** **[G-2]**
- [ ] **T5.7** — run `bun run digest:once` against dev guild channel; collect operator visual sign-off; record `S5-CANARY.md` with screenshots / paste of the live post + any rendering anomalies → **[G-1]** **[G-5]**
- [ ] **T5.E2E** — **End-to-End Goal Validation** (P0 · final-sprint required):
  - G-1 (leaderboard body as 85-95% pixels): confirm via S2 snapshot + S5 canary
  - G-2 (gate flags FR-5 cases): confirm via S1 test suite pass
  - G-3 (OTEL spans queryable): confirm via S5 memory-exporter test + canary OTEL export (if endpoint configured)
  - G-4 (V1 contract — prose text UNCHANGED): confirm via S1 idempotency test + S2 wire-through
  - G-5 (E2E canary green on dev channel before THJ): confirm via T5.7 canary deliverable

### Dependencies

- S1 + S2 + S3 + S4 completed (all transform stages exist for OTEL to wrap)
- S0 spike findings on `@effect/opentelemetry` peer-dep + version pins
- `OTEL_EXPORTER_OTLP_ENDPOINT` env var configured (or canary runs without OTLP export — console exporter acceptable for dev canary)
- Dev guild channel access for canary post

### Risks & Mitigation

- **Risk**: `@effect/opentelemetry` peer-dep conflict with Effect 3.x pin (cycle-004 substrate). **Mitigation**: S0 spike T0.2 records compat; T5.1 pins exact versions; if hard conflict, fall back to OpenTelemetry API direct (no Effect integration for V1, defer to V1.5).
- **Risk**: OTLP endpoint unconfigured in prod → spans buffer indefinitely → memory pressure. **Mitigation**: NFR-OTEL-EXPORTER-UNAVAILABLE per SDD failure-modes: BatchSpanProcessor caps at default buffer size + drops on overflow; never blocks chat compose. AC-S5.4 documents `.env.example`.
- **Risk**: canary post produces visible drift from dashboard mirror (operator rejects). **Mitigation**: S2's snapshot tests catch most drift; canary is final visual check; any rejection becomes follow-up sprint and cycle stays in active status.
- **Risk**: OTEL span attributes leak full draft text (PII / persona-secret). **Mitigation**: NFR-3 + AC-S5.5: only `draft_hash` (8-char) flows; T5.4 explicitly asserts no full-text attribute.

### Success Metrics

- All 5 cycle goals (G-1..G-5) validated per T5.E2E
- LoC budget held: ≤ 80 LoC across observability/* + composeReply/dispatch wire + memory-exporter test
- Canary visually approved by operator
- Zero regressions in 174+ existing test suite
- Cycle status flips `active → archived` in `grimoires/loa/ledger.json`

---

## 3 · dependencies & risks (sprint-level)

| sprint | upstream dependency | risk if dependency slips |
|---|---|---|
| S0 | PR #77 merged · score-mibera 1.1.0 in prod · cycle-004 substrate landed | spike has nothing to verify against; STOP before S1 |
| S1 | S0 calibration findings | regex patterns may need tuning if archive shows zero matches |
| S2 | S1 (proseGate option + buildFactorStatsMap) | telemetry-only contract decouples this — text never modified |
| S3 | S2 (renderer reactivated, callable from per-shape paths) | shape boundary tests can be authored against S2 snapshots |
| S4 | S2 (moodEmoji slot wired) | hardcoded emojis are pure functions — low risk |
| S5 | S1+S2+S3+S4 (all transform stages exist for OTEL to wrap) | OTEL wire could land late as ad-hoc, but adopting `@effect/opentelemetry` is operator-locked per FR-6 |

### Cross-cycle dependencies

- **score-mibera #118** (cadence-claim primitive) — DEFERRED per PRD Non-Intent; not blocking this cycle
- **medium-registry emoji catalog** (sibling track) — DEFERRED; S4 ships unicode hardcoded defaults
- **cycle-004 substrate refactor** — required for OTEL Effect.Tracer integration in S5; if cycle-004 not yet merged, S5 falls back to OpenTelemetry API direct (loses some Effect integration but ships) and files follow-up to revisit

### Risk register summary (cross-sprint)

| risk class | severity | mitigation tier |
|---|---|---|
| factor_stats not populated in prod | HIGH | S0 AC-S0.1 surfaces immediately |
| regex pattern over/under-match | MEDIUM | V1 telemetry-only = no user damage; operator review window 2-4 weeks |
| LLM voice over-claims past gate license | MEDIUM | S1 telemetry flags it; V1.5 soft-enforce |
| Discord 1024-char field cap | LOW | S2 AC-S2.2 explicit test |
| OTEL peer-dep conflict | LOW | S0 spike + fallback to OTel-API-direct |
| canary visual rejection by operator | LOW | iterative; cycle stays active until operator-blessed |

## 4 · estimated effort

| sprint | low | high | notes |
|---|---|---|---|
| S0 | 2h | 4h | hard half-day cap |
| S1 | 6h | 12h | ~100 LoC + 6+ regression tests |
| S2 | 10h | 18h | ~150 LoC + caller wire + voice prompt refactor |
| S3 | 4h | 8h | ~80 LoC + 9 boundary tests |
| S4 | 2h | 4h | ~60 LoC pure functions |
| S5 | 6h | 12h | OTEL plumbing + memory-exporter test + canary |

**Total**: 30-58 hours; ~5 working days at full focus; ~7-10 days at typical interleave with ops + other tracks.

## 5 · acceptance gates (cycle-level)

Per PRD acceptance criteria (AC-1..AC-11):

- **AC-1..AC-3** — validated via S2 + S4 (leaderboard body + per-row emoji slot)
- **AC-4..AC-6** — validated via S1 regression tests (gate flags violations; prose unchanged)
- **AC-7..AC-9** — validated via S5 memory-exporter test + canary (OTEL span tree + chat-mode + digest path)
- **AC-10** — validated via S2 (schema_version `1.0.0 | 1.1.0` both accepted)
- **AC-11** — validated via S1 + S2 (existing reply-emoji-translate.test.ts continues to pass)

**Cycle-completion checklist**:

- [ ] All 11 PRD acceptance criteria validated by named sprint
- [ ] All 5 cycle goals (G-1..G-5) confirmed via S5.T5.E2E
- [ ] Dev-guild canary visually approved by operator
- [ ] Zero regressions across 174+ test baseline
- [ ] LoC budget within 470 ± 10% (~423-517 LoC total across S1+S2+S3+S4+S5)
- [ ] `CHANGELOG.md` entry + ledger archived

---

## Appendix A · Task Dependencies (sprint-level)

```
preconditions (PR #77 · score-mibera 1.1.0 · cycle-004)
    │
    ▼
   S0 calibration spike (half-day, auto-delete)
    │
    ▼
   S1 V1 prose-gate (~100 LoC, telemetry-only)
    │
    ▼
   S2 leaderboard body + moodEmoji slot (~150 LoC)
    │       │
    │       ├──► S3 layout shape selector (~80 LoC)
    │       │       │
    │       └──► S4 mood-emoji rules (~60 LoC)
    │               │
    │       ┌───────┘
    ▼       ▼
   S5 OTEL wire-up + E2E canary + goal validation (~80 LoC)
    │
    ▼
   cycle-005 archived
```

S3 + S4 can land in parallel after S2 (independent files).

## Appendix B · LoC Budget Tracking

| sprint | budget | running total |
|---|---|---|
| S0 | 0 (spike auto-delete) | 0 |
| S1 | ~100 | ~100 |
| S2 | ~150 | ~250 |
| S3 | ~80 | ~330 |
| S4 | ~60 | ~390 |
| S5 | ~80 | ~470 |

**Hard cap**: ±10% (~423-517 LoC) per cycle-completion checklist.

## Appendix C · Goal Traceability

PRD does not declare explicit goal IDs; auto-assigned G-1..G-5 from PRD Intent §"Restructure ruggy's weekly digest + slash-reply surface so that:" + Acceptance Criteria. Auto-assignment logged to trajectory.

| ID | Goal | PRD Source | Validation Method |
|---|---|---|---|
| **G-1** | Deterministic dashboard-mirrored card BODY = 85-95% of post pixels | prd.md:22 Intent §1 | S2 snapshot tests + S5 canary visual approval |
| **G-2** | Regex-denylist prose-gate ties phrase patterns to mechanical factor_stats substrate checks | prd.md:24 Intent §3 | S1 regression test suite (≥6 cases incl. all 3 FR-5 must-flag cases) |
| **G-3** | Observability via @effect/opentelemetry replaces self-scaffolded chat-trace primitive | prd.md:26 Intent §5 | S5 memory-exporter test + OTLP endpoint smoke-test |
| **G-4** | V1 contract — prose text returned UNCHANGED (telemetry-only); persona illusion preserved | prd.md:91 + NFR-1 | S1 idempotency test + S2 wire-through (text byte-identical) |
| **G-5** | E2E canary green on dev guild channel before THJ deploy | prd.md AC-9 + SDD §"end-to-end" | S5.T5.7 canary deliverable + operator visual sign-off |

### Goal → Task Mapping

| Goal | Contributing Tasks |
|---|---|
| **G-1** | T0.1 · T0.4 · T1.5 · T2.1 · T2.2 · T2.3 · T2.4 · T2.5 · T2.6 · T3.1 · T3.3 · T3.4 · T4.1 · T4.2 · T4.3 · T5.7 |
| **G-2** | T0.1 · T0.3 · T1.1 · T1.2 · T1.3 · T1.4 · T1.5 · T2.5 · T3.2 · T4.3 · T5.6 |
| **G-3** | T0.2 · T5.1 · T5.2 · T5.3 · T5.4 · T5.5 · T5.6 |
| **G-4** | T1.4 (idempotency test) · T2.6 (gate wired but no text mod) |
| **G-5** | T5.7 (canary) · T5.E2E |

### E2E Validation Task

**T5.E2E** in Sprint 5 (P0 — Must Complete · final sprint) validates every PRD goal:
- G-1: S2 snapshot tests pass + S5 canary visually mirrors dashboard
- G-2: S1 test suite passes including all 3 FR-5 must-flag cases
- G-3: S5 memory-exporter test verifies span tree; OTLP endpoint smoke-test if configured
- G-4: S1 idempotency test asserts text byte-identical input vs output
- G-5: T5.7 canary deliverable signed off by operator in `S5-CANARY.md`

All 5 goals have contributing tasks. No warnings raised.

---

## Refs

- `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/prd.md` (companion · WHAT + WHY)
- `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/sdd.md` (companion · HOW)
- `grimoires/loa/context/cycle-spec-ruggy-leaderboard-2026-05-15.md` (r1 origin track · V1.5/V2 destination preserved)
- `grimoires/loa/context/track-2026-05-15-herald-substrate-renderer-boundary.md` (r1 design lineage)
- `packages/persona-engine/src/deliver/grail-ref-guard.ts` (sibling pattern · F4 telemetry-only doctrine precedent)
- `packages/persona-engine/src/deliver/embed.ts` (`buildPulseDimensionPayload` dormant since PR #73)
- `packages/persona-engine/src/compose/reply.ts` (`composeReplyWithEnrichment` insertion point)
- PR #73 (cycle-021 pulse cards · dormant renderer reactivates as S2)
- PR #77 (cycle-022 factor_stats type mirror · MERGED 2026-05-16 · precondition)
- score-mibera #118 (cadence-claim primitive · DEFERRED · out of scope)
- https://effect.website/docs/observability/tracing/ (FR-6 OTEL reference)
- CLAUDE.md fallback patterns §S0 calibration spike (template for this cycle's S0)
