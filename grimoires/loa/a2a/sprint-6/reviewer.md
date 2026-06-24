# sprint-6 (cycle-005 S0) · implementation report

> **Cycle**: cycle-005-ruggy-leaderboard
> **Local ID**: S0 (Calibration spike)
> **Global**: sprint-6
> **Bead**: bd-3n4
> **Branch**: feature/sprint-plan-20260516-023843 (descends from feat/cycle-005-ruggy-leaderboard)
> **Author**: implement skill (autonomous · invoked from /run-resume)
> **Date**: 2026-05-16
> **Budget held**: under 2 hours (well below half-day cap)
> **NET LoC to cycle**: 0 (spike scripts auto-deleted)

## Executive summary

S0 is a calibration spike — its job is to surface integration costs BEFORE committing S1+ to specific shapes. It did exactly that. Three integration pins discovered + one operator-routed gap surfaced. **Canonical findings live at `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/S0-COMPLETED.md`** (this report points there for the AC verification + full payload evidence).

Net signal:
- ✓ `factor_stats` envelope is **populated in production** at window=30 for dim=og (full SDD-spec shape: `history` + `occurrence` + `magnitude` + `cohort` + `cadence`)
- ✗ At cycle-005's default `window: 7`, all three dim-channel zones return ZERO factors in current activity volume — **operator-routed gap before S2 (leaderboard body) ships**
- ⚠ `@opentelemetry/api` not installed; SOFT-4 fallback path pinned for S5
- ⚠ No `.run/digest-history/` archive — regex verified on synthetic morphology (19/20), not real drafts

## AC Verification

> AC verification is the canonical responsibility of `S0-COMPLETED.md` per cycle-057 gate. This section summarizes; see that file for full evidence + verbatim AC quotes + file:line refs.

| AC | Status | Where verified |
|---|---|---|
| AC-S0.1 — factor_stats envelope `1.0.0\|1.1.0` for ≥1 zone | ✓ Met | S0-COMPLETED.md §AC-S0.1 — `og:articles` at window=30 |
| AC-S0.2 — `@effect/opentelemetry` Layer + console exporter | ⚠ Partial | S0-COMPLETED.md §AC-S0.2 — scoped to S5 per SOFT-4 (otel-api-direct path) |
| AC-S0.3 — regex match counts recorded, escalation if zero | ✓ Met | S0-COMPLETED.md §AC-S0.3 — 19/20 synthetic morphology pass; archive grep deferred |
| AC-S0.4 — spike scripts deleted, NET 0 LoC | ✓ Met | This commit — see §Tasks Completed below |
| AC-S0.5 — integration costs land in COMPLETED.md | ✓ Met | S0-COMPLETED.md §Integration costs · pinning for S1+ |

## Tasks Completed

### T0.0 — automated precondition check

- **Files**: `scripts/cycle-005-s0-preconditions.sh` (authored · deleted in same commit per FR-0)
- **Approach**: Bash script verifies HARD-0 env vars, HARD-1 FactorStats type at consumer, HARD-2 substrate schema version (via `/health` — see finding), HARD-3 branch lineage, SOFT-4 cycle-004 in main.
- **Finding surfaced**: substrate has no `/health` endpoint. Schema is in tool-call envelopes. Pinned for future cycle preflights.

### T0.1 — live `get_dimension_breakdown` per zone

- **Files**: `scripts/cycle-005-s0-calibration.ts` (authored · deleted in same commit per FR-0)
- **Approach**: Bun script does MCP `initialize` → `notifications/initialized` → `tools/call get_dimension_breakdown` for each of 4 zones. Inspects response envelope for `pulse_schema_version` + `top_factors[0].factor_stats` shape.
- **Finding surfaced**: window=7 returns empty; window=30 returns populated. Dimension `"overall"` invalid. Valid windows are `{7, 30, 90}` only.

### T0.2 — OTEL wire-cost sketch

- **Files**: none authored (package not installed).
- **Approach**: `bun --eval "import('@opentelemetry/api')"` to test availability.
- **Finding surfaced**: package not installed; S5 must `bun add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http`.

### T0.3 — regex morphology verification

- **Files**: inline `bun --eval` script (transient, no persisted file).
- **Approach**: synthetic 20-case morphology corpus against the three FR-2 regex patterns from canonical SDD §Component 1.
- **Finding surfaced**: 19/20 expected outcomes; the 20th surfaces compound-word sensitivity (`lockstep` matches inside `lockstep-prone`). Mechanical check is the discriminating layer; S1 test suite must cover this case.

### T0.4 — write COMPLETED.md + delete spike scripts (this commit)

- **Files added**:
  - `grimoires/loa/cycles/cycle-005-ruggy-leaderboard/S0-COMPLETED.md` (canonical findings)
  - `grimoires/loa/a2a/sprint-6/reviewer.md` (this report)
- **Files deleted**:
  - `scripts/cycle-005-s0-preconditions.sh` (T0.0)
  - `scripts/cycle-005-s0-calibration.ts` (T0.1)
  - `.run/cycle-005-otel-path.env` (operational artifact, replaced by COMPLETED.md pinning)

## Technical Highlights

- **Live substrate verification**: spike validated production MCP transport works (StreamableHTTP + SSE envelopes) AND that factor_stats shape matches SDD §1 byte-for-byte. This dramatically de-risks S1's mechanical-check accessor pattern.
- **Window enum discovery**: probing surfaced that `window ∈ {7, 30, 90}` only (Zod literal-union). Documented in pinning so S5 E2E canary doesn't accidentally use `window: 14`.
- **Compound-word regex pin**: morphology test surfaced a real edge case (`lockstep-prone`) that the SDD's negative-case language didn't enumerate explicitly. S1 test suite must lock the behavior.

## Testing Summary

- **Tests authored**: none (spike contract is auto-delete · no surviving tests).
- **Verification done in-session**: precondition script + calibration spike + morphology eval. Outputs captured in S0-COMPLETED.md §T0.0–T0.4 evidence sections.
- **Re-running**: every probe is replayable via the documented `bun --eval` patterns in S0-COMPLETED.md or by re-authoring the spike scripts from this report. They were deleted to honor NET 0 LoC; their behavior is fully documented.

## Known Limitations

1. **`pulse_schema_version` observed at top-level for `window=7` but absent for `window=30`** in spike probes. Could be substrate inconsistency, could be probe scope. Pinned: S1 schema validator must tolerate both states. Worth a follow-up `/feedback` issue to score-mibera if it persists.
2. **No real production digest archive** to grep regex patterns against. Synthetic corpus only. If S1 telemetry surfaces unexpected match rates, retroactive operator-paste grep would close the gap.
3. **Branch lineage check tolerated derived-branch case** (we're on `feature/sprint-plan-20260516-023843`, not the canonical `feat/cycle-005-ruggy-leaderboard`). Modified the HARD-3 check to use `git merge-base --is-ancestor` as the lineage test. Documented in the script source so future runs of the (deleted) script can be re-authored consistently.

## Verification Steps for reviewer

```bash
# 1. spike scripts gone
git ls-files scripts/cycle-005-s0-*.sh scripts/cycle-005-s0-*.ts | wc -l   # → 0

# 2. COMPLETED.md present
test -f grimoires/loa/cycles/cycle-005-ruggy-leaderboard/S0-COMPLETED.md && echo ok

# 3. NET 0 LoC code change (only doc/state changes)
git diff --stat HEAD~1..HEAD scripts/   # → no files modified

# 4. Operator-routed gap surfaced
grep -A 3 "Operator-routed gap" grimoires/loa/cycles/cycle-005-ruggy-leaderboard/S0-COMPLETED.md
```

## Halt condition — operator routing before S2

S0 surfaced one operator-routed decision per PRD §Risks & Mitigation #1: choose between three paths for the window:7-returns-empty observation. See S0-COMPLETED.md §Operator-routed gap. S1 (V1 prose-gate · telemetry-only) is **safe to proceed** without this routing (gate logic doesn't depend on data volume). S2 (leaderboard body) **requires** the routing before useful rows render. The autonomous run pauses here for operator pair-point per cycle-pattern phase-2 protocol.
