# Sprint-24 (cycle-008 local S3) · Implementation Report — VISIBLE SLICE (T3.8 + T3.9)

> **Global sprint-24** (cycle-008 local `sprint-3` · epic `bd-3li`). Local→global
> resolved via Sprint Ledger; cycle-001's `a2a/sprint-3/` is a different sprint, untouched.
>
> **Scope**: operator chose "visible slice now, defer gated" (2026-05-22). This
> report covers ONLY **T3.8** (cadence-honest data surface) + **T3.9** (two-beat
> billboard renderer). Tasks **T3.0/T3.1/T3.1a/T3.2/T3.3/T3.4/T3.5/T3.6/T3.7**
> are DEFERRED (secret-gated: GITHUB_TOKEN read:packages + MCP_KEY). S3 remains
> partially open; S4 stays blocked per the dependency graph.

## Executive Summary

Shipped the two-beat delivery (the operator's picked direction from the manual
preference loop, `preference-log.jsonl`): cron "plain" posts (micro/lore_drop/
question) now deliver as **two distinct Discord messages** — Beat 1 the agent
voice, Beat 2 a **bold data billboard** — instead of one muddy message that
"reads too bot". The billboard is cadence-honest: the window total is labeled
`30d rolling` so it can never masquerade as "since you last looked".

5 files changed, 0 new test failures (+11 tests), apps/bot typecheck clean,
cycle-007 lint green. No application code written outside this `/implement`.

## AC Verification

### T3.8 · Cadence-honest data surface

1. **"(a) card hero shows a fresh 'since last post' delta computed from voice-memory.ts per-zone state"**
   — ⏸ **[ACCEPTED-DEFERRED]**. Voice-memory is not wired into the render path:
   `digest-orchestrator.ts:70` stubs the port (`void (deps.voiceMemory ?? createVoiceMemoryLive())`)
   and the standalone `compose/voice-memory.ts` writer is orphaned (zero callers,
   verified). Shipped AC(e) graceful-degradation instead. Deferral logged in NOTES.md Decision Log.
2. **"(b) licensing/factor-density logic unchanged — still 30d"**
   — ✓ **Met**. No edit to `live/score-mcp.live.ts` (windowDays:30 at :164,:195 untouched).
3. **"(c) two-clocks closed — digest + micro report the SAME clock"**
   — ⏸ **[ACCEPTED-DEFERRED]**. The clock divergence is at the FETCH layer
   (`digest-orchestrator.ts:36` PULSE_WINDOW_DAYS=7 vs the live 30d micro fetch),
   not the render layer this slice touches. Belongs with the cron-migration (T3.3, deferred). NOTES.md logged.
4. **"(d) 30d figure labeled rolling context (clearly secondary)"**
   — ✓ **Met**. `discord-render.live.ts` `buildSubstrateFacts` emits `` `${snapshot.windowDays}d rolling` `` (label).
5. **"(e) type-guard fallback — missing per-zone state degrades headline to 30d-rolling-labeled (never a wrong fresh number)"**
   — ✓ **Met**. This is the shipped default: the labeled rolling figure is always shown; no fabricated fresh number. `two-beat.test.ts` "window total is labeled … never implies 'since last'".
6. **"(f) byte-snapshot regression fixture in evals/snapshots/"**
   — ✓ **Met**. `evals/snapshots/cycle-008-two-beat-owsley-lab.md` (real rendered bytes) + behavioral suite `packages/persona-engine/src/live/two-beat.test.ts`.

### T3.9 · Two-beat billboard renderer

1. **"(a) delivery emits two sequential Pattern-B webhook sends"**
   — ✓ **Met**. `deliver/post.ts` `beatsOf()` + send loops in all 3 delivery branches (webhook-shell, bot, fetch-fallback).
2. **"(b) Beat 1 — agent voice: 1-2 lowercase lines, ZERO numbers"**
   — ✓ **Met**. `plainToPayload` sets `content = message.voiceContent`. Test asserts beat 1 has no `rolling`/`**`.
3. **"(c) Beat 2 — billboard: bold via U+2007 figure-space, NOT a code block"**
   — ✓ **Met**. `plainToPayload` wraps each line `**…**`; `buildSubstrateFacts` aligns with `metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR).digitWidthSpaceChar` (U+2007). Test asserts no triple-backtick and per-line bold.
4. **"(d) message.content ALWAYS populated (Discord-as-Material fallback)"**
   — ✓ **Met**. No-voice branch returns billboard as primary `content` (`|| '·'`). Tests "message.content ALWAYS populated" + "no-voice fallback".
5. **"(e) underscore-escape preserved (deliver/sanitize.ts)"**
   — ✓ **Met** (with note). Billboard rows are static labels + numbers + the
   canonical zone label (no underscores); existing sanitize path untouched. Note:
   the bold wrapper does not itself escape — safe for current aggregate-only rows;
   re-check if factor names (which can contain `_`) ever enter `truthFields`.
6. **"(f) byte-snapshot fixture in evals/snapshots/"**
   — ✓ **Met**. Same fixture + tests as T3.8(f).

**Open micro-decisions** (deferred to S9 preview surface per spec, NOT blocking):
keep `30d rolling` row · label wording · beat separator · all-quiet vs active register.
The `state: all quiet` line stays in Beat 1 (voice) — data ≠ narrative.

## Tasks Completed

| File | Change | Lines |
|------|--------|-------|
| `packages/persona-engine/src/deliver/embed.ts` | `DigestPayload.secondary?` (additive, back-compat) | +9 |
| `packages/persona-engine/src/live/discord-render.live.ts` | `buildSubstrateFacts` → billboard rows (header + figure-space-aligned label/value, cadence-honest `Nd rolling`) | ~+30/-6 |
| `packages/persona-engine/src/live/discord-webhook.live.ts` | `plainToPayload` → two-beat (voice primary + bold billboard secondary; no-voice fallback) | ~+25/-6 |
| `packages/persona-engine/src/deliver/post.ts` | `deliverZoneDigest` sends both beats (3 branches) + `beatsOf()` helper + dry-run logs beat 2 | ~+35/-12 |
| `packages/persona-engine/src/live/two-beat.test.ts` | NEW · 11 tests (T3.8 billboard + T3.9 two-beat) | +110 |
| `evals/snapshots/cycle-008-two-beat-owsley-lab.md` | NEW · reference fixture (real rendered bytes) | +40 |

## Technical Highlights

- **Backwards-compatible contract**: `DigestPayload.secondary?` is optional —
  embed-bearing types (digest/weaver/callout) and any single-message payload are
  unchanged. `beatsOf()` collapses to `[primary]` when absent.
- **Bold + alignment coexist**: code blocks ignore `**bold**`, so beat 2 bolds
  each line individually and relies on U+2007 figure-space (digit-width) for column
  alignment — the technique already proven for Android `gg sans` in `renderSnapshotField`.
- **Honest degradation over fabrication**: rather than wire an ambiguous/stubbed
  voice-memory system under time pressure, the billboard shows a labeled rolling
  figure. The fresh "since last" delta is a clean follow-up once voice-memory is wired.

## Testing Summary

- `bun test packages/persona-engine/src/live/two-beat.test.ts` → 11 pass / 0 fail.
- Full suite: **1091 pass · 1 skip · 1 fail** (was 1080; +11 new). The 1 fail is
  the pre-existing `Playground · live=true is accepted` HTTP test (network-dependent,
  unrelated to render/delivery).
- `bun run --cwd apps/bot typecheck` → clean.
- `bun run lint:cycle-007` → green (INV-12/14/17).

## Known Limitations

- Fresh "since last post" delta deferred (voice-memory unwired — see T3.8 AC(a)/(c)).
- Two-clocks fetch divergence (digest 7d vs micro 30d) deferred to T3.3.
- `evals/snapshots/` has no automated assertion harness yet — the fixture is a
  human-readable reference; the real guards are in `two-beat.test.ts`.
- Pre-existing (NOT introduced here): `loader.test.ts:40` typecheck error
  (`postingMode`); the playground-live test failure.

## Verification Steps (reviewer)

1. `bun test packages/persona-engine/src/live/two-beat.test.ts` — 11/0.
2. `bun run --cwd apps/bot typecheck` — clean.
3. Inspect `evals/snapshots/cycle-008-two-beat-owsley-lab.md` for the rendered bytes.
4. Dry-run delivery: a voiced micro now logs `── beat 2 (billboard) ──` in `logDryRun` (`deliver/post.ts`).
