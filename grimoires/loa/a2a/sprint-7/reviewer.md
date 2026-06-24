# sprint-7 (cycle-005 S1) · implementation report

> **Cycle**: cycle-005-ruggy-leaderboard
> **Local ID**: S1 (V1 prose-gate · telemetry-only)
> **Global**: sprint-7
> **Bead**: bd-q8f
> **Branch**: feature/sprint-plan-20260516-023843
> **Author**: implement skill (autonomous · invoked from /run-resume after S0)
> **Date**: 2026-05-16

## Executive summary

Shipped `packages/persona-engine/src/deliver/prose-gate.ts` mirroring `grail-ref-guard.ts` shape + telemetry surface. Pure-regex denylist with three rules tied to mechanical `factor_stats` predicates. Returns `{text, validation}` with text UNCHANGED (V1 telemetry-only contract). 23 tests pass; full suite 706 pass · 1 skip · 0 fail (zero regressions).

Two surgical deviations from sprint.md flagged in Decision Log below — both align implementation with SDD r2/r3 hardening that the original sprint.md predates.

## AC Verification

| AC | Verbatim text | Status | Evidence |
|---|---|---|---|
| AC-S1.1 | `inspectProse` returns `{text, validation}` with `text` byte-identical to input draft (NFR-2 idempotency) | ✓ Met | `prose-gate.ts:175` returns `{text: draft, ...}` unconditionally · test `prose-gate.test.ts:79-90` ("returns text byte-identical to input") + `:91-99` ("text unchanged even when violations fire") |
| AC-S1.2 | regression test for sequential-mint chain (FR-5 case 1): when `cohort.unique_actors === 1` and draft contains "the four wallets moved in lockstep, coordinated cluster", gate produces violation with `reason: 'cohort-singleton'` | ✓ Met | `prose-gate.test.ts:103-114` — passes with `factor_id: 'og:boosted-validator'` resolved via proximity attribution |
| AC-S1.3 | regression test for forced "structural shift" (FR-5 case 2): rank=88 + "structural shift" → `reason: 'rank-below-threshold'` | ✓ Met | `prose-gate.test.ts:115-122` — passes with `factor_id: 'og:articles'` |
| AC-S1.4 | regression test for fake "p99-rare" (FR-5 case 3): `p99.reliable: false` + "p99-rare" → `reason: 'percentile-unreliable'` regardless of current rank | ✓ Met | `prose-gate.test.ts:124-133` — rank=99 + p99_reliable=false still violates |
| AC-S1.5 | historic-factor case (no factor_stats): `factorStatsByFactorId.get(factor_id)` returns undefined → gate skips that factor's rule check, no violation emitted | ✓ Met | `prose-gate.ts:189-190` (`if (!stats) continue`) + `prose-gate.test.ts:138-145` ("factor in factors[] but missing from stats map → silent skip") |
| AC-S1.6 | `draft_hash` (8-char SHA-256) appears in console.warn line, full draft text does NOT (NFR-3 telemetry hygiene) | ⚠ Partial | `prose-gate.ts:235-247` (`draftHash` helper returns 8 hex chars · uses FNV-1a non-crypto digest for sync access · acceptable for telemetry correlation). **The console.warn telemetry line itself is the CALLER's responsibility** — wired in S2 digest path per SDD §5 routing-invariant deviation (see Decision Log). |
| AC-S1.7 | 50K-char synthetic draft processes in <100ms (NFR-6: no catastrophic regex backtracking) | ✓ Met | `prose-gate.test.ts:222-232` — measured via `performance.now()`, `<100ms` assertion |
| AC-S1.8 | existing `reply-emoji-translate.test.ts` continues to pass (regression on translateEmojiShortcodes contract per AC-11) | ✓ Met | Full `bun test` suite: 706 pass · 1 skip · 0 fail (no regressions across 36 test files) |

## Tasks Completed

### T1.1 — `ProseGateValidation` interface

- **File**: `packages/persona-engine/src/deliver/prose-gate.ts:68-76` (`ProseGateViolation`) + `:78-81` (`ProseGateValidation`)
- **Approach**: matched_patterns + violations as readonly arrays; literal-union reason field includes all 5 SDD-spec reasons (`cohort-singleton` · `percentile-unreliable` · `rank-below-threshold` · `rank-null` · `no-factor-context`).
- **Test coverage**: indirect — every test asserts on `validation.violations[].reason` (AC-S1.2/3/4/5).

### T1.2 — `PROSE_GATE_RULES` const

- **File**: `packages/persona-engine/src/deliver/prose-gate.ts:35-58`
- **Approach**: three rules per SDD §1 lines 108-131; each pattern uses `gi` flag + `\b` boundaries (closes SDD/PRD regex-brittleness flatline finding); mechanical-check predicates wired to `cohort.unique_actors`, `magnitude.percentiles.p99.reliable`, `magnitude.current_percentile_rank` accessors confirmed live in S0 spike.
- **Test coverage**: 7 morphology + 3 FR-5 + 2 negative cases.

### T1.3 — `inspectProse` + `attributeFactor`

- **File**: `packages/persona-engine/src/deliver/prose-gate.ts:96-127` (`attributeFactor` proximity) + `:147-191` (`inspectProse` orchestrator)
- **Approach**: each rule's regex iterates over draft via `RegExpExecArray` exec loop; proximity attribution runs per match (N=200 chars before/after, longest-match-first, closest-pos wins); `factor_id: null` emits `no-factor-context` violation; mechanical check runs only when factor + stats both resolve.
- **Test coverage**: AC-S1.2 (cluster + uniq=1) · AC-S1.3 (struct-shift + rank=88) · AC-S1.4 (p99-rare + reliable=false) · `no-factor-context` fallback when factors[] empty · word-boundary negative test.

### T1.4 — `prose-gate.test.ts`

- **File**: `packages/persona-engine/src/deliver/prose-gate.test.ts` (318 lines · 23 tests)
- **Coverage** (more than the spec's ≥6-case minimum, to lock down morphology per PRD AC-13):
  - 3 FR-5 cases (cluster · struct-shift · p99-rare) — AC-S1.2/3/4
  - 1 historic-factor silent-skip — AC-S1.5
  - 1 no-factor-context fallback
  - 2 negative cases (legitimate cohort discussion + top decile with reliable p95 high rank)
  - 4 morphology variants (Cohorts cap+plural · lock-step hyphen · Structural Shift mixed-case · punctuation-adjacent)
  - 1 word-boundary negative (`vault._cohorts_table` should NOT flag)
  - 1 50K-char catastrophic-backtracking guard — AC-S1.7
  - 3 mode-resolver tests (default · valid values · invalid fallback)
  - 3 `buildFactorStatsMap` tests (mixed-historic · empty · live)
  - 3 `draftHash` tests (shape · determinism · differentiation)
  - 2 idempotency tests — AC-S1.1

### T1.5 — `buildFactorStatsMap` helper + mode-resolver + `draftHash`

- **Files**:
  - `prose-gate.ts:212-228` — `buildFactorStatsMap`
  - `prose-gate.ts:200-204` — `resolveProseGateMode`
  - `prose-gate.ts:237-247` — `draftHash`
- **Approach**: helper walks `top_factors[] + cold_factors[]` from a `get_dimension_breakdown` response (S0-confirmed envelope shape). Historic factors (no `factor_stats`) are **included in `factors[]` for proximity attribution** but **omitted from the map** so rule checks naturally skip them per V1 historic-factor contract.

## Technical Highlights

- **Sibling-pattern fidelity** to `grail-ref-guard.ts`: same `inspect<Thing>(...): {text, validation}` signature shape; same telemetry-only V1 contract (text unchanged regardless of validation result); same V1.5 graduation path documented in JSDoc.
- **Responsibility split** per SDD-SKP-002/009 closure: `inspectProse` is PURE (returns `ProseGateValidation`). The orchestrator augments to `ProseGateOutcome` with `shape_override` after reading mode + counting HIGH-severity violations — that's S2's job.
- **`no-factor-context` always passes through** even when other violations fire (SDD §1.186: "attribution failed, can't authoritatively block"). The orchestrator filters these from mode-gating.
- **`draftHash` is sync** (FNV-1a) so the gate doesn't need to await crypto.subtle. Acceptable for telemetry correlation; collision risk only matters within a single zone's hour-window which is well within the 32-bit space.

## Testing Summary

- **New test file**: `packages/persona-engine/src/deliver/prose-gate.test.ts` (23 tests, 36 expect calls)
- **Test run**: `bun test packages/persona-engine/src/deliver/prose-gate.test.ts` — 23 pass / 0 fail · 14ms
- **Regression**: `bun test` (full suite) — 706 pass · 1 skip · 0 fail · 686ms across 36 files

```bash
# Reproduce:
bun test packages/persona-engine/src/deliver/prose-gate.test.ts  # spot
bun test                                                          # full suite regression
```

## Known Limitations

1. **Stale-but-loud not enforced at V1** (sprint.md FR-5 case 4 mentioned in D1.2). Per PRD §Accepted V1 Limitations: `factor_stats.history.stale` exists but no V1 rule consumes it. V1.5 destination. Documented in NOTES.md Decision Log.
2. **Chat-mode skipped per SDD §5 V1 routing invariant**. The sprint.md D1.4 specified `composeReplyWithEnrichment` insertion, but SDD r2 closed SDD-SKP-001 [840] by routing the gate **digest-only in V1** to avoid chat-mode token cost for unenforced telemetry. Reconciled in Decision Log entry.
3. **`draftHash` is FNV-1a, not SHA-256**. SDD spec called it "8-char SHA-256". Implementation uses FNV-1a (32-bit non-crypto) for sync access. Equivalent telemetry signal; not a security hash. Pin documented.
4. **Test file LoC (318) exceeds SDD §1 layout target (~80)**. AC-coverage requires ≥6 cases; morphology + word-boundary + 50K-char + helper-trio coverage pushed to 23. Implementation file (262 lines · ~130 substantive code lines after JSDoc) is roughly on target with SDD §1 (~120 LoC). Decision-Log documents the trade-off.

## Verification Steps for reviewer

```bash
# 1. files present
ls packages/persona-engine/src/deliver/prose-gate.ts packages/persona-engine/src/deliver/prose-gate.test.ts

# 2. tests pass + no regressions
bun test packages/persona-engine/src/deliver/prose-gate.test.ts
bun test 2>&1 | tail -3   # → 706 pass · 1 skip · 0 fail

# 3. typecheck clean (one pre-existing unrelated error in expression/error-register.test.ts is NOT this sprint's)
bunx tsc --noEmit 2>&1 | grep "prose-gate" | wc -l   # → 0

# 4. text-unchanged invariant
grep -n "return { text: draft" packages/persona-engine/src/deliver/prose-gate.ts   # → :191

# 5. V1 routing invariant (gate NOT wired into chat-mode)
grep -rn "inspectProse\b" packages/persona-engine/src apps/bot/src 2>/dev/null
# → expect: only prose-gate.ts (declaration) + prose-gate.test.ts (test imports).
# composeReplyWithEnrichment + dispatch.ts should have ZERO references this cycle.
```

## Decision Log entries (for NOTES.md)

1. **Sprint.md D1.4 deviation**: chat-mode `composeReplyWithEnrichment` insertion REMOVED in favor of SDD §5 V1 routing invariant (digest-only in V1). S2 wires the digest path; chat-mode gate is V1.5 destination per PRD §Accepted V1 Limitations A2.
2. **`draftHash` FNV-1a vs SDD-spec SHA-256**: sync access prioritized over cryptographic hash strength. Pure-function pre-S5-OTEL telemetry; not a security signal.
3. **`buildFactorStatsMap` lives in `prose-gate.ts` (not a separate file)**: ~17 lines doesn't earn its own module per Karpathy simplicity. Co-located with the consumer.
4. **23 tests > spec-minimum 6**: morphology + word-boundary + helper-trio coverage. Test-LoC overage offset by future-cycle confidence (V1.5 / V2 graduation needs locked V1 behavior).
