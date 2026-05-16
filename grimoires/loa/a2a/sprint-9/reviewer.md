# sprint-9 (cycle-005 S3) · implementation report

> **Cycle**: cycle-005-ruggy-leaderboard · S3 (Layout shape selector A/B/C)
> **Global**: sprint-9 · **Bead**: bd-2dh
> **Date**: 2026-05-16 · **Author**: implement skill (autonomous)

## Executive summary

Shipped `packages/persona-engine/src/compose/layout-shape.ts` — pure decision-tree function `selectLayoutShape` + helper `isNoClaimVariant`. 13 tests pass (covers AC-S3.1 all 8 permittedClaims × hot-rank combinations + boundary cases + NO-CLAIM variant detection). Zero regressions; full suite holds at 725 pass · 0 fail.

T3.3 (caller wire) + T3.4 (silence-register reuse in shape-A renderer) deferred to S5 — same co-location rationale as S2's deferrals (digest pipeline + OTEL spans land together in S5).

## AC Verification

| AC | Verbatim text | Status | Evidence |
|---|---|---|---|
| AC-S3.1 | `selectLayoutShape` covers ALL 8 combinations of (permittedClaims ≥ 1) × (high-rank zone count); explicit Shape C NO-CLAIM variant tested | ✓ Met | Decision tree at `layout-shape.ts:43-58` exhaustively covers `claimedCount ∈ {0, 1, ≥2}` × `hotRankCount ∈ {0, 1, ≥2}` (9 logical regions; collapses to 4 outcomes). Tests at `layout-shape.test.ts:32-145` cover A/B/C-std/C-NO-CLAIM. |
| AC-S3.2 | shape A: all 4 zones empty + total events < 50 → `'A-all-quiet'`; renderer produces italicized stage direction + tally | ⚠ Partial | Function returns `'A-all-quiet'` (verified at `layout-shape.test.ts:33-43`). Renderer DEFERRED to S5 silence-register wire. |
| AC-S3.3 | shape B: exactly one zone has permittedClaims ≥ 1 → `'B-one-dim-hot'` | ✓ Met | Tested at `layout-shape.test.ts:67-77` (one permitted) + `:79-89` (one permitted + others rank-hot unpermitted). |
| AC-S3.4 | shape C: ≥2 zones have permittedClaims ≥ 1 → `'C-multi-dim-hot'` | ✓ Met | Tested at `layout-shape.test.ts:93-103` (exactly 2) + `:105-117` (all 4 permitted) + `:119-128` (mixed). |
| AC-S3.5 | shape C NO-CLAIM variant: `permittedClaims === 0` AND ≥2 zones rank ≥ 90 → `'C-multi-dim-hot'` + telemetry | ⚠ Partial | Function returns `'C-multi-dim-hot'` (tested at `:131-142` + `:144-159`). Renderer-level telemetry (`prose_gate.zone_data_no_voice`) DEFERRED to S5. `isNoClaimVariant()` helper at `layout-shape.ts:71-77` provides the renderer's discriminator. |
| AC-S3.6 | boundary: exactly 2 zones with permitted_claims → shape C (NOT B) | ✓ Met | Tested at `layout-shape.test.ts:93-103`. |
| AC-S3.7 | shape A confirms PRD Open Question #1 disposition (tally line posted) | ⏸ [ACCEPTED-DEFERRED] | Renderer concern, not selector. The tally rendering lands with S5's shape-A handler. The selector's job — choosing shape — is complete. |

## Tasks Completed

- **T3.1** — `LayoutShape` type + `selectLayoutShape` impl (`layout-shape.ts:30-58`)
- **T3.2** — 13 tests covering 4-shape decision tree + 3 `isNoClaimVariant` tests
- **T3.3** — DEFERRED to S5 (digest wire + OTEL spans co-locate; same pattern as S2 T2.3)
- **T3.4** — DEFERRED to S5 (silence-register wire is the shape-A renderer in the digest path)

## Technical Highlights

- **Pure decision tree** — zero side effects, fully testable in isolation, deterministic
- **`isNoClaimVariant()` helper** — co-located rule for the renderer's variant detection (avoids the renderer re-implementing the count-zones logic)
- **AC-S3.5 boundary pin** — single rank-hot zone WITHOUT permissions collapses to Shape A per PRD AC-8 r1 (NOT shape B). Tested at `:46-58`.

## Testing

- 13 tests · 16 expect calls · `bun test packages/persona-engine/src/compose/layout-shape.test.ts` — pass in 13ms
- Full suite from repo root: **725 pass · 1 skip · 0 fail** across 37 files (S3 adds tests but no behavior touches outside its own file)

## Known Limitations

1. **AC-S3.2 + AC-S3.5 + AC-S3.7 renderer pieces deferred to S5** — three deferred items, all renderer-level. The selector returns the correct shape; the visual rendering co-locates with S5's digest wire.
2. **S3 LoC count**: `layout-shape.ts` ~77 lines · `layout-shape.test.ts` ~165 lines = ~242 LoC. Spec said ≤80 LoC for `layout-shape.ts + tests + digest wire`; the function file is at 77, tests grew larger for AC-S3.1 exhaustive coverage. Spec-budget overage of ~3x for tests; function file on target.

## Verification Steps

```bash
ls packages/persona-engine/src/compose/layout-shape.ts packages/persona-engine/src/compose/layout-shape.test.ts
bun test packages/persona-engine/src/compose/layout-shape.test.ts   # → 13 pass
bun test 2>&1 | tail -3                                              # → 725/0/1
```

## Decision Log

1. T3.3 + T3.4 DEFERRED to S5 — co-locate with digest-cron wire + OTEL spans (same rationale as S2 T2.3/T2.4).
2. `isNoClaimVariant()` helper added (not in spec) — keeps the variant-detection rule co-located with shape selection. Renderer reads it instead of re-counting.
3. Test file (165 lines) exceeds spec budget for AC-S3.1's exhaustive 8-combination coverage. Acceptable per PRD AC-coverage standard.
