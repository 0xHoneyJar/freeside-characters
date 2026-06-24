# Implementation Report — bug-20260624-3f6605 (bd-uia)

**Sprint**: sprint-bug-3
**Bug**: `/recall-wedge-live-demo` awaited the Dixie network round-trip before ACK → blew Discord's 3s interaction window ("application did not respond").
**Bead**: bd-uia (reused, not duplicated)

## Executive Summary

Defer-first fix mirroring the existing `/role-sync` slash deferral. `dispatch.ts`
now ACKs `/recall-wedge-live-demo` immediately with a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`
(type 5, ephemeral) and runs the gated handler in a background `runRecallWedgeLiveDemoDeferred`
runner that PATCHes `@original` with the handler's content once the lazy live-Dixie
client + network call resolve — entirely off the 3s ACK clock. The handler module
(`recall-wedge-live-demo.ts`) is **unchanged**, so its EPHEMERAL-only static guard
stays green; the deferral lives only in `dispatch.ts`.

- 2 files changed, +154 / −2.
- Full `apps/bot` suite: **805 pass / 0 fail** (164 in the live-demo file, incl. 2 new behavioral tests).
- Typecheck: **0 new errors** (6 pre-existing errors confirmed unrelated — see Known Limitations).

## AC Verification

### Sprint-level ACs (sprint.md:48-52)

1. **"Bug is no longer reproducible — a slow Dixie round-trip no longer times out the interaction (the deferred ACK fires within 3s)"**
   - ✓ Met — `dispatch.ts:314-330` now returns `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` synchronously and dispatches the network work via `void runRecallWedgeLiveDemoDeferred(interaction)`. The slow-client test proves the recall call starts but no `@original` PATCH occurs until it resolves: `recall-wedge-live-demo.test.ts` test "content reaches @original via a background PATCH only AFTER the slow Dixie call resolves" (asserts `patches.length === 0` while the gated call is pending).

2. **"Failing test proves the fix (deferred ACK + background `@original` PATCH)"**
   - ✓ Met — new `describe('bd-uia · /recall-wedge-live-demo defers past the 3s ACK window')` in `recall-wedge-live-demo.test.ts`. Gates the fix: it imports `runRecallWedgeLiveDemoDeferred` (absent on old code → would not compile) and asserts exactly one PATCH to `/messages/@original` carrying `classification: served` after a controllable slow client resolves.

3. **"No regressions in existing tests (module static-guard intact)"**
   - ✓ Met — handler module untouched; static guard "renders only via the EPHEMERAL flag — no non-ephemeral / deferred branch" (`recall-wedge-live-demo.test.ts:1775-1783`) still passes. Full suite 805/805.

4. **"Fix addresses root cause (defer-first), mirroring the role-sync fix; deferral lives in dispatch.ts, handler unchanged"**
   - ✓ Met — `runRecallWedgeLiveDemoDeferred` (`dispatch.ts`, added next to `runRoleSyncDeferred`) is a structural copy of the role-sync runner: await gated work → PATCH `@original` → try/catch fall back to the generic ephemeral refusal. Handler diff is zero lines.

### Task ACs

- **Task 1 (failing test)**: ✓ — isolated, no real network (injected slow `loadLiveClient` + global `fetch` spy with `mockRestore`), name describes the 3s-ACK-deferral scenario.
- **Task 2 (fix)**: ✓ — synchronous `return await handleRecallWedgeLiveDemoInteraction(interaction)` removed (`dispatch.ts`), replaced by defer-first + background runner; dispatch-wiring assertion updated to the deferred form (`recall-wedge-live-demo.test.ts:~1850`).

## Tasks Completed

### `apps/bot/src/discord-interactions/dispatch.ts` (+52)
- Import: added `RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL` + type `RecallWedgeLiveDemoDeps`.
- Live-demo branch: replaced the synchronous `return await handler(interaction)` with `void runRecallWedgeLiveDemoDeferred(interaction)` + a type-5 ephemeral ACK.
- Added `export async function runRecallWedgeLiveDemoDeferred(interaction, env=process.env, deps={})`: awaits the gated handler, reads `resp.data?.content` (falls back to the generic refusal if absent), PATCHes `@original` via the existing `patchOriginal(interaction, true, content)`; try/catch logs + PATCHes the generic refusal (never throws; no raw error/id/secret to Discord).
  - The runner is `export`ed solely as a testability seam (the deferral is otherwise unobservable without a deps-injection point); production dispatch calls it with no `env`/`deps`.

### `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` (+104 / −2)
- Imported `runRecallWedgeLiveDemoDeferred` from `./dispatch.ts` (app→app, not across the app→package boundary — respects the test's own deep-import guard at :1786-1806).
- Flipped the dispatch-wiring assertion: `not.toMatch(/return await handle.../)` + `toMatch(/void runRecallWedgeLiveDemoDeferred\(interaction\)/)` + `toContain('DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE')`.
- Added 2 behavioral tests (slow-client deferral + failed-client refusal-delivery) using the existing `interaction()` / `fullEnv()` / `liveResult()` helpers and a controllable `slowClient`.

## Testing Summary
- Runner: `bun test` (from `apps/bot`). File: `bun test src/discord-interactions/recall-wedge-live-demo.test.ts` → 164 pass. Full: `bun test` → 805 pass / 0 fail.

## Known Limitations
- **Pre-existing typecheck errors (NOT this change)**: `bun run typecheck` reports 6 errors in `src/shadow/` (`roster-source.{live,mock}.ts`, `role-writer.{live,mock}.ts`, `go-live-orchestrator.test.ts`) — a missing `currentRosterIdentity` / `revokeRole` / `renameRole`. Confirmed identical with my changes stashed (6 → 6). These belong to the in-flight RosterSource-port work tracked under **bd-glb** (`add RosterIdentitySnapshot to RosterSource port`), not this bug.
- **P3 sibling deferred**: `/recall-wedge-demo` (`dispatch.ts:295-300`) awaits a cached dynamic import (in-memory, low risk). Triage scoped it opportunistic-only; NOT changed here to keep the diff surgical (it carries its own two-test caveat). Left for a follow-up if it proves to matter.
- Always-defer means even a gate-refused interaction now does ACK→PATCH (two round-trips) instead of one synchronous refusal. Harmless for a dev-only, low-traffic command; matches the unconditional-defer pattern role-sync already uses.

## Verification Steps (reviewer)
1. `cd apps/bot && bun test src/discord-interactions/recall-wedge-live-demo.test.ts` → 164 pass.
2. `cd apps/bot && bun test` → 805 pass / 0 fail.
3. Confirm handler module diff is empty: `git diff apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` → no output.
4. Confirm the pre-existing typecheck errors are shadow-only and unrelated (stash → typecheck → pop).
