# `deriveShape` Oracle — hand-crafted PRD-derived classification rules

> Purpose: independent reference truth for property tests. The `derive-shape.test.ts`
> property test (fast-check, 100+ generated multi-zone snapshots) asserts
> `deriveShape(input).shape === oracle(input)`. Any divergence is a build failure.
>
> This file is the **canonical English-language spec** of the classification rules.
> Reading this should be sufficient to re-derive the implementation.

## Inputs

Each input is a `DeriveShapeInput`:
- `snapshot`: the focal zone snapshot
- `crossZone`: the multi-zone array (includes `snapshot`)
- `proseGate?`: optional pre-computed prose-gate output

## Permittedness gate (per zone)

A `DigestFactorSnapshot` is **permitted** iff ALL of:

1. `factorStats` is present (`factor.factorStats !== undefined`)
2. `factorStats.magnitude.current_percentile_rank` is a number AND `>= 90`
3. `factorStats.magnitude.percentiles.p95.reliable === true`

A zone is **claimed** iff it contains ≥ 1 permitted factor in `topFactors`.

## Hot-rank gate (per zone)

A zone is **hot-rank** iff its `max(topFactors[].factorStats.magnitude.current_percentile_rank)` is ≥ 90 (ignoring null ranks).

Note: A claimed zone is ALWAYS also hot-rank (claim requires rank ≥ 90 + reliable).
The converse is not true (hot-rank without reliability = hot-rank only).

## Classification rules (in order)

Let:
- `claimedZoneCount = count(zone in crossZone where zone is claimed)`
- `hotRankZoneCount = count(zone in crossZone where zone is hot-rank)`

Apply the FIRST matching rule:

| Rule | Condition | Output `shape` | Output `isNoClaimVariant` |
|---|---|---|---|
| 1 | `claimedZoneCount >= 2` | `C-multi-dim-hot` | `false` |
| 2 | `claimedZoneCount === 1` | `B-one-dim-hot` | `false` |
| 3 | `claimedZoneCount === 0 AND hotRankZoneCount >= 2` | `C-multi-dim-hot` | `true` (NO-CLAIM variant) |
| 4 | `claimedZoneCount === 0 AND hotRankZoneCount <= 1` | `A-all-quiet` | `false` |

Rule 4 catches both "all-zero hot AND all-zero claim" (case 5 in cycle-005 layout-shape.ts) and "single hot zone WITHOUT permission collapses to silence" (case 4).

## Output: `permittedFactors`

The set of permitted factors from the **focal** snapshot (NOT cross-zone aggregated).
Order matches `snapshot.topFactors` ordering. Each entry:
- `displayName: string` — copied verbatim from `DigestFactorSnapshot.displayName`
- `stats: FactorStats` — copied verbatim from `DigestFactorSnapshot.factorStats`

## Output: `silencedFactors`

Empty array if `proseGate` is omitted.

Otherwise: for each `violation` in `proseGate.violations`, for each `proximityName` in `violation.proximity_factors`:
- If `proximityName` matches the `displayName` of any factor in the focal `snapshot.topFactors`,
  add a `SilencedFactor` entry: `{ displayName: proximityName, reason: violation.reason }`

Duplicates are allowed (a factor can be silenced by multiple violations).

## Output: `claimedZoneCount` and `hotRankZoneCount`

Surfaced as diagnostic fields for orchestrators that need to log silence-mode telemetry.
Always ≥ 0. `claimedZoneCount <= hotRankZoneCount` is invariant (claim implies hot).

## Boundary fixtures (S0 spike pinning · 2026-05-16)

These ten fixtures were validated 10/10 MATCH against legacy `selectLayoutShape`:

| Fixture | `claimedCount` | `hotRankCount` | Rule | Output |
|---|---|---|---|---|
| F01 all-quiet cold | 0 | 0 | 4 | A-all-quiet |
| F02 all-quiet 1-hot unclaimed | 0 | 1 | 4 | A-all-quiet |
| F03 1-dim-hot claimed | 1 | 2 | 2 | B-one-dim-hot |
| F04 1-dim-hot claimed cold-rank | 1 | 0 | 2 | B-one-dim-hot |
| F05 multi-dim-hot 2-claimed | 2 | 2 | 1 | C-multi-dim-hot |
| F06 multi-dim-hot 4-claimed | 4 | 4 | 1 | C-multi-dim-hot |
| F07 NO-CLAIM 2-hot | 0 | 2 | 3 | C-multi-dim-hot (NO-CLAIM) |
| F08 NO-CLAIM 3-hot | 0 | 3 | 3 | C-multi-dim-hot (NO-CLAIM) |
| F09 rank exactly 90 | 0 | 0 | 4 | A-all-quiet |
| F10 rank just below 90 | 0 | 0 | 4 | A-all-quiet |

F09 (rank=90 exactly) confirms the `>= 90` inclusive boundary. F10 (rank=89) confirms strict `< 90` exclusion.

## Reference implementation (do NOT use this in the property test — that's the WHOLE point)

The implementation in `derive-shape.ts` is a faithful transcription of these rules.
The property test compares `deriveShape(input).shape` against a SEPARATE oracle implementation
(see `derive-shape.test.ts`) that re-derives shape from the spec above without sharing code.

This double-implementation is intentional: BB design-review F-001 flagged the cycle-005
"two clocks" pattern where two implementations drifted apart. cycle-006 closes that pattern
permanently by making one the LIVE source (`deriveShape`) and the other a TEST-ONLY oracle
that cannot affect production.
