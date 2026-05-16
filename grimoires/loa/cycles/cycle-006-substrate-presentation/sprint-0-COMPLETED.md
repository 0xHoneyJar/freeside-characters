# Sprint 0 · COMPLETED — Calibration spike (deriveShape ↔ selectLayoutShape equivalence)

**Cycle**: cycle-006-substrate-presentation
**Beads epic**: bd-1rx
**Closed**: 2026-05-16
**Branch**: feat/cycle-006-substrate-presentation
**Duration**: ~0.5 days (single session)
**Operator**: autonomous ("Loa you decide for all")

## Verdict

🟢 **GREEN-LIGHT S1 migration.** Spike found zero semantic drift between legacy `selectLayoutShape` and prototype `deriveShape` across all 5 decision-tree branches.

## HARD preconditions (T0.2)

All verified upstream this session before spike execution:

| Precondition | Status | Evidence |
|---|---|---|
| HARD-1 · PR #81 resolved | ✓ MERGED | commit b9be701 on main (Merge pull request #81) |
| HARD-2 · cycle-005 status | ✓ CLOSED | PR #81 merged · cycle-005 work landed |
| HARD-3 · score-mibera 1.1.0 in prod | ✓ ON MAIN | commit 598e3e4 `feat(score): consume cycle-022 factor_stats substrate (score-mibera #116)` |

No handoff required — preconditions clean.

## Spike execution (T0.1)

**Script**: `scripts/spike-derive-shape-equivalence.ts` (auto-deleted at sprint close per FR-0 NET-0-LoC contract)
**Report**: `.run/cycle-006-s0-derive-shape-spike.json`
**Runtime**: <1s

**Fixture coverage** (10 fixtures spanning all 5 cases of layout-shape.ts decision tree):

| ID | Branch | Legacy | Prototype | Verdict |
|---|---|---|---|---|
| F01 | A · claimed=0, hot=0 (case 5) | A-all-quiet | A-all-quiet | MATCH |
| F02 | A · claimed=0, hot=1 (case 4) | A-all-quiet | A-all-quiet | MATCH |
| F03 | B · claimed=1, any hot (case 2) | B-one-dim-hot | B-one-dim-hot | MATCH |
| F04 | B · claimed=1, hot=0 (case 2 cold-rank) | B-one-dim-hot | B-one-dim-hot | MATCH |
| F05 | C-standard · claimed≥2 (case 1) | C-multi-dim-hot | C-multi-dim-hot | MATCH |
| F06 | C-standard · claimed=4 (fully-lit) | C-multi-dim-hot | C-multi-dim-hot | MATCH |
| F07 | C-NO-CLAIM · claimed=0, hot=2 (case 3) | C-multi-dim-hot | C-multi-dim-hot | MATCH |
| F08 | C-NO-CLAIM · claimed=0, hot=3 (case 3) | C-multi-dim-hot | C-multi-dim-hot | MATCH |
| F09 | A · rank exactly at threshold (90 ≥ 90) | A-all-quiet | A-all-quiet | MATCH |
| F10 | A · rank just below threshold (89 < 90) | A-all-quiet | A-all-quiet | MATCH |

**Aggregate**: 10/10 MATCH · 100% match rate · ≥95% threshold met → GREEN-LIGHT.

**Branches covered**: A, B, C-standard, C-NO-CLAIM (all branches the SDD §3.2 specifies for cycle-006 `deriveShape`).

## Pinning decisions surfaced (S0 lesson for S1+)

Per CLAUDE.md "Calibration spike" pattern — what S1+ inherits:

1. **`RANK_HOT_THRESHOLD = 90`** is the canonical hot-rank boundary. Prototype `deriveShape` must use this constant verbatim. ≥ comparison (not >). F09 (rank=90 exactly) was the boundary fixture — matches both functions returning A-all-quiet (because no claim).

2. **`claimedCount === 1 → B` (case 2)** fires regardless of `hotRankCount`. F04 (claimed=1 but no zone is hot) returns B-one-dim-hot — the claim is what counts, not the rank. S1 deriveShape MUST preserve this.

3. **`claimedCount === 0 AND hotRank ≥ 2 → C-multi-dim-hot` (case 3) is the NO-CLAIM variant**. The shape returned is identical to standard C; only `claimedCount === 0` distinguishes it. S1's `DerivedShape.isNoClaimVariant: boolean` field is the explicit-form replacement for the `isNoClaimVariant(args)` helper currently in `layout-shape.ts`.

4. **`topRankByZone.get(zone) === null` is treated as cold** (not hot). The legacy explicit null-check at line 53 (`rank !== null && rank !== undefined && rank >= 90`) is preserved in the prototype.

5. **Prototype `deriveShape` is a faithful transcription of legacy `selectLayoutShape`** — zero semantic adjustments. S1 task T1.1 can copy the prototype verbatim into `domain/derive-shape.ts` (after extending the return type with `permittedFactors` and `silencedFactors` per SDD §3.2).

## Drift report

**None.** No `s0-drift-report.md` written.

## Integration cost surfaced

**Zero.** No new dependencies introduced. No version pinning required. No upstream changes (hounfour / score-mcp / Effect / Bun) discovered to be incompatible.

## Operator pair-point opportunity

None taken — green-light is deterministic from the report. Per simstim Phase 7 contract, autonomous proceeds to S1.

## Next sprint (S1)

**Scope**: MEDIUM (9 tasks · ~+300 LoC) · **Duration**: ~2 days
**Beads epic**: bd-1b0
**Title**: Type-level substrate-presentation seam + Red Team AC-RT-002 wrapping
**First task**: T1.1 — Author `domain/derive-shape.ts` with `DeriveShapeInput.crossZone` REQUIRED

The S0 prototype lives in `scripts/spike-derive-shape-equivalence.ts` BEFORE deletion — S1 implementer reads this COMPLETED.md (which preserves the algorithm in the fixture table) for guidance.

## Files touched (with auto-delete at sprint close)

- `scripts/spike-derive-shape-equivalence.ts` — DELETED at sprint close (NET 0 LoC per FR-0)
- `.run/cycle-006-s0-derive-shape-spike.json` — preserved as audit-trail (gitignored .run/)
- `grimoires/loa/cycles/cycle-006-substrate-presentation/sprint-0-COMPLETED.md` — this file (PRESERVED)

## Acceptance criteria status

- [x] Spike runs to completion against ≥10 fixtures (10 hand-crafted spanning all 5 branches)
- [x] Drift surfaced: NONE → no operator handoff written
- [x] Spike script self-deletes at sprint close (NET 0 LoC contribution)
- [x] sprint-0-COMPLETED.md captures: integration cost (zero), pinning decisions (5), lesson for S1
