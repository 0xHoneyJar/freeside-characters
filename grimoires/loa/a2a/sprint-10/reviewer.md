# sprint-10 (cycle-005 S4) · implementation report

> **Cycle**: cycle-005-ruggy-leaderboard · S4 (Mood-emoji rules) · **Bead**: bd-1u1 · **Date**: 2026-05-16

## Executive summary

Replaced S2's `mood-emoji.ts` stub with the full FR-3 registry-mediated implementation. `moodEmojiForFactor` + `moodEmojiForColdFactor` route `factor_stats` state through `pickByMoods(mood, 'ruggy')` against the existing THJ emoji registry. 17 tests pass; full suite 755 pass · 1 skip · 0 fail (zero regressions; +30 tests from new file + ~7 from increased file count).

T4.3's caller wire (`buildPulseDimensionPayload` passing `moodEmojiForFactor`) deferred to S5 — co-locates with the digest-cron + OTEL wire-up per the S2/S3 deferral pattern.

## AC Verification

| AC | Verbatim text | Status | Evidence |
|---|---|---|---|
| AC-S4.1 | Per-row emoji slot populates from factor_stats rules via `pickByMoods(...)` registry lookup; cold factors (previous > 5, total === 0) get `['sadge', 'dazed']` mood | ✓ Met | `mood-emoji.ts:42-45` calls `pickByMoods([...moods], 'ruggy')`. Cold-factor path at `:88-95` matches `previous > 5 && total === 0`. Test at `mood-emoji.test.ts:172-184`. |
| AC-S4.2 | magnitude rank ≥95 + p95 reliable → `['flex']` | ✓ Met | `mood-emoji.ts:58-62`. Test at `mood-emoji.test.ts:86-89`. |
| AC-S4.3 | cohort rank ≥90 + unique_actors ≥5 → `['eyes', 'shocked']` | ✓ Met | `mood-emoji.ts:64-72`. Test at `mood-emoji.test.ts:91-95`. |
| AC-S4.4 | cadence gap rank ≥90 + currently active → `['noted', 'concerned']` | ✓ Met | `mood-emoji.ts:74-82`. Test at `mood-emoji.test.ts:97-101`. |
| AC-S4.5 | historic factor (stats undefined) → null | ✓ Met | `mood-emoji.ts:51-54` (undefined + no_data + error + unknown_factor all → null). 4 tests at `mood-emoji.test.ts:107-119`. |
| AC-S4.6 | MOOD_EMOJI_DISABLED=true → all calls return null | ✓ Met | `mood-emoji.ts:23` env-check used in `:50, :86, :103`. Tests at `mood-emoji.test.ts:161-178`. |
| AC-S4.7 | registry miss → null fallback; deterministic selection within hits (id ASC sort) | ✓ Met | `mood-emoji.ts:43-44` returns null on empty `pickByMoods`; `:45` sorts by id ASC before picking first. |

## Tasks Completed

- **T4.1** — `moodEmojiForFactor(stats)` with magnitude > cohort > cadence priority cascade (`mood-emoji.ts:48-84`)
- **T4.2** — `moodEmojiForColdFactor(factor)` (`mood-emoji.ts:88-95`)
- **T4.3** — 17 tests covering positive + negative + priority + env-disabled + cold cases (`mood-emoji.test.ts`). Caller wire DEFERRED to S5.

## Technical Highlights

- **Registry-mediated** per PRD r1 — no hardcoded unicode; tokens flow through the existing 43-emoji THJ catalog so emoji-translate regression suite holds
- **Deterministic** — `localeCompare` sorts by id ASC; same input always emits same token
- **Priority order tested** — magnitude-AND-cohort-qualifying factor emits magnitude token (verified by token-difference assertion)
- **Defense-in-depth historic detection** — undefined OR no_data OR error OR unknown_factor flag all return null

## Testing

- 17 tests · 21 expect calls · `bun test mood-emoji.test.ts` — pass in 13ms
- Full suite from repo root: **755 pass · 1 skip · 0 fail** across 39 files (was 725 pre-S4)

## Known Limitations

1. **T4.3 caller wire deferred to S5** — same pattern as S2/S3 deferrals (digest-cron + OTEL co-location)
2. **`pickByMoods(moods, 'ruggy')` filters by kind='ruggy'** — if THJ catalog adds non-ruggy moods later (e.g. 'satoshi' kind), the existing registry's `kind` filter keeps satoshi moods invisible. Acceptable per persona separation.

## Decision Log

1. T4.3 caller wire DEFERRED to S5 (digest-cron co-location)
2. Priority cascade is `if-cascade` (not table-driven) for readability at this scale (3 rules); table-driven if rule count grows.
