# Sprint Plan: Bug Fix — recall-wedge-live-demo awaits Dixie network before ACK → 3s Discord timeout

**Type**: bugfix
**Bug ID**: 20260624-3f6605
**Bead**: bd-uia (reuse — do NOT create a duplicate)
**Source**: /bug (triage)
**Sprint**: sprint-bug-3

---

## sprint-bug-3: recall-wedge-live-demo awaits Dixie network before ACK → 3s Discord timeout

### Sprint Goal
Make `/recall-wedge-live-demo` ACK Discord within the 3s interaction window by deferring first and delivering the gated result via a background `@original` PATCH — with a failing test proving the deferral.

### Deliverables
- [x] Failing test that reproduces the bug (dispatch blocks on the slow Dixie call before ACK)
- [x] Source code fix (defer-first in dispatch.ts + `runRecallWedgeLiveDemoDeferred` runner)
- [x] Updated dispatch-wiring assertion in recall-wedge-live-demo.test.ts (was pinned to the synchronous `return await` shape)
- [x] All existing tests pass (no regressions) — especially the module static-guard at recall-wedge-live-demo.test.ts:1775-1783 — 805/805
- [x] Triage analysis document

### Technical Tasks

#### Task 1: Write Failing Test [G-5]
- Create an integration test proving the dispatch path ACKs with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5, ephemeral) and PATCHes `@original` with the rendered content AFTER the slow Dixie call resolves — i.e. it does not block on `liveRecallViaDixie` before responding.
- Model on `apps/bot/src/shadow/role-sync-dispatch.test.ts` (immediate deferred ACK + injected-fetch PATCH assertion). Drive the deferred runner with a deliberately-slow injected `loadLiveClient` (the handler accepts `deps.loadLiveClient`) and capture the `@original` PATCH.
- Test file: `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` (extend the existing `Phase 41B · dispatch wiring` area, or a new `describe`).

**Acceptance Criteria**:
- Test fails with current code (current dispatch awaits the handler synchronously → no deferred ACK; with a slow client the response only arrives after the network call)
- Test name clearly describes the 3s-ACK-deferral scenario
- Test is isolated (no real network; injected slow client + injected/spied fetch)

#### Task 2: Implement Fix [G-1, G-2]
- In `dispatch.ts`, replace the synchronous `return await handleRecallWedgeLiveDemoInteraction(interaction)` (L314-319) with `void runRecallWedgeLiveDemoDeferred(interaction)` + a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) ephemeral ACK.
- Add the `runRecallWedgeLiveDemoDeferred(interaction)` background runner next to `runRoleSyncDeferred`: await the gated handler, read `resp.data.content`, PATCH `@original` via the existing `patchOriginal(interaction, true, content)`; try/catch with a generic-refusal fallback; no raw-id logging.
- Update the dispatch-wiring assertion at recall-wedge-live-demo.test.ts:1850-1852 to the deferred form (the `return await ...` regex no longer holds — this is intended).
- Keep the handler module (`recall-wedge-live-demo.ts`) UNCHANGED so the static-guard at recall-wedge-live-demo.test.ts:1775-1783 still passes.
- (P3, opportunistic) Apply the same defer-first transform to `/recall-wedge-demo` at dispatch.ts:295-300 ONLY if it ships clean; it carries the same two-test caveat (recall-wedge-demo.test.ts:758 + :802-816).
- Verify the new failing test passes; run the full `bun test` suite from `apps/bot`.

**Acceptance Criteria**:
- Failing test now passes
- No regressions (the existing gate / refusal / render / static-guard tests still pass)
- Fix addresses root cause (ACK before the network call), not just symptoms

### Acceptance Criteria
- [x] Bug is no longer reproducible — a slow Dixie round-trip no longer times out the interaction (the deferred ACK fires within 3s)
- [x] Failing test proves the fix (deferred ACK + background `@original` PATCH)
- [x] No regressions in existing tests (module static-guard intact) — 805/805
- [x] Fix addresses root cause (defer-first), mirroring the role-sync fix; deferral lives in dispatch.ts, handler unchanged

### Test Runner
`bun test` (run via `bun run --cwd apps/bot test`).

### Triage Reference
See: grimoires/loa/a2a/bug-20260624-3f6605/triage.md
