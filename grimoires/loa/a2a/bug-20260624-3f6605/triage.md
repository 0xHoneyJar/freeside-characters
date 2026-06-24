# Bug Triage: recall-wedge-live-demo awaits Dixie network before ACK → 3s Discord timeout

## Metadata
- **schema_version**: 1
- **bug_id**: 20260624-3f6605
- **bead**: bd-uia (already filed · OPEN · P2 · type:bug — reuse, do not duplicate)
- **classification**: integration_issue (interaction-ACK timing on the Discord read side)
- **severity**: medium (P2 — dev/operator-only demo command, low traffic)
- **eligibility_score**: 4
- **eligibility_reasoning**: Reproducible via the 3s-ACK sweep harness (workflow wb3gcegbr, 2026-06-04, +2) + stack trace with verified source locations (recall-wedge-live-demo.ts:641, dispatch.ts:318, +1) + regression from a known baseline — the role-sync fix already closed this exact defect class; this is the same defect re-appearing in a sibling command (+1). No disqualifiers (no new endpoint / UI / schema / config — this is an ACK-timing fix to an existing command).
- **test_type**: integration
- **risk_level**: medium
- **created**: 2026-06-24

## Reproduction
### Steps
1. Configure `/recall-wedge-live-demo` so every gate passes (`RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED=true`, matching guild id, invoker in the operator allowlist).
2. Invoke `/recall-wedge-live-demo` in the gated guild while the live Dixie round-trip (`liveRecallViaDixie` → `/api/recall/intake`) takes longer than ~3s (a slow/cold upstream, which the 3s-ACK sweep wb3gcegbr exercises).
3. Observe Discord show "application did not respond" — the interaction ACK window expired before the handler returned.

### Expected Behavior
The command ACKs Discord within the 3s interaction window (a deferred ephemeral ACK), runs the slow Dixie call in the background, and delivers the operator-safe summary by PATCHing `@original`.

### Actual Behavior
`handleRecallWedgeLiveDemoInteraction` (`recall-wedge-live-demo.ts:641`) `await`s the network-bound `client.liveRecallViaDixie(input, config)` BEFORE returning a non-deferred `CHANNEL_MESSAGE_WITH_SOURCE` (type 4) response. dispatch.ts wires it synchronously (`return await handleRecallWedgeLiveDemoInteraction(interaction)` at `dispatch.ts:318`), so a Dixie round-trip slower than 3s blows Discord's interaction-ACK window and the interaction times out.

### Environment
Production Discord interactions endpoint (`/webhooks/discord`, Bun.serve · V0.7-A.0). Dev/operator-only; surfaced by the 3s-ACK sweep, not yet a user-facing incident (gated demo, low traffic).

## Analysis
### Suspected Files
| File | Line(s) | Confidence | Reason |
|------|---------|------------|--------|
| apps/bot/src/discord-interactions/dispatch.ts | 314-319 | high | Dispatches the live command via `return await handleRecallWedgeLiveDemoInteraction(interaction)` — the synchronous await of a network-bound handler that blows the 3s ACK window. **This is where the defer-first fix lands.** |
| apps/bot/src/discord-interactions/recall-wedge-live-demo.ts | 593-673 (esp. 641) | high | `handleRecallWedgeLiveDemoInteraction` awaits `client.liveRecallViaDixie(input, config)` (network) before returning a type-4 response. Root cause of the slow path. The handler itself stays UNCHANGED — it keeps returning its type-4 ephemeral response; dispatch reads `.data.content` for the PATCH. |
| apps/bot/src/discord-interactions/recall-wedge-demo.ts | 455-493 (esp. 476) | low | Sibling `/recall-wedge-demo` awaits a dynamic module import (`defaultLoadHarness` → in-memory, cached after first load). Lower-risk same shape; fix opportunistically (P3) by deferring its dispatch at dispatch.ts:295-300. |

### Reference Pattern (the model — do NOT change, copy the shape)
| File | Line(s) | Role |
|------|---------|------|
| apps/bot/src/discord-interactions/dispatch.ts | 397-414 | role-sync SLASH command: `void runRoleSyncDeferred(...)` then `return { type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: EPHEMERAL } }`. Exact match for a fresh ephemeral reply (type 5). |
| apps/bot/src/discord-interactions/dispatch.ts | 1308-1332, 1368-1389 | `patchOriginal(interaction, true, content)` helper + `runRoleSyncDeferred` background runner — the template for `runRecallWedgeLiveDemoDeferred`. |
| apps/bot/src/shadow/role-sync-dispatch.ts | 250-317 | `handleRoleSyncComponentInteraction` defer-first + `completeRoleSyncComponent` — the broader defer-first doctrine (and its comment explaining why tests miss it: injected deps are instant; the 3s window is prod-only). |

### Related Tests
| Test File | Coverage |
|-----------|----------|
| apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts | Existing gate / refusal / render / static-guard suite. **TWO assertions are coupled to the current synchronous wiring and MUST be updated by the fix (see Constraints).** |
| apps/bot/src/shadow/role-sync-dispatch.test.ts | The behavioral defer test to model the new failing test on: asserts the immediate response is a deferred ACK and `@original` is PATCHed via an injected `fetch` after the slow work settles. |

### Test Target
Write a FAILING test (test-first) that proves the dispatch path ACKs Discord immediately with `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5, ephemeral) and delivers the result via a `@original` PATCH — i.e. it does NOT block on the slow Dixie call before responding. Model it on `role-sync-dispatch.test.ts`. Because dispatch calls the handler with no injectable deps, the cleanest behavioral seam is to export the new `runRecallWedgeLiveDemoDeferred(interaction, deps?, fetchFn?)` runner and drive it with a deliberately-slow injected `loadLiveClient` + an injected `fetch`, asserting: (a) the dispatcher returns type 5 synchronously, and (b) `@original` is PATCHed with the rendered content only AFTER the slow client resolves. Pair it with the updated source-assertion wiring test below.

### Constraints (load-bearing)
1. **Keep the deferral in dispatch.ts, NOT in recall-wedge-live-demo.ts.** The module static-guard at `recall-wedge-live-demo.test.ts:1775-1783` asserts the handler module source contains NO `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` and that every `data: { ... }` block carries `MessageFlags.EPHEMERAL`. Adding the deferral inside the handler would break it — and is unnecessary, since role-sync defers in dispatch. The handler is left untouched.
2. **Update the dispatch-wiring assertion at `recall-wedge-live-demo.test.ts:1844-1853.** It currently pins the regex `/return\s+await\s+handleRecallWedgeLiveDemoInteraction\(interaction\)/`. The defer-first fix removes that exact pattern, so the assertion must change to the deferred form (a `void runRecallWedgeLiveDemoDeferred(...)` background call + a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` ACK). Changing a test to match the fix's intentionally-new response shape is legitimate here — surface it explicitly in reviewer.md.
3. **Use `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5), not `DEFERRED_UPDATE_MESSAGE` (type 6).** The recall demo creates a fresh ephemeral message (like the role-sync SLASH command), it does not edit an existing one (type 6 is for the role-sync component/button path). dispatch.ts already imports `InteractionResponseType` + `MessageFlags`; the constant `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5` is defined in types.ts:27.
4. **Reuse the existing `patchOriginal(interaction, true, content)` helper.** The handler already fails closed to a refusal string on every error path (load / config / live throw), so the background runner reads `response.data.content` and PATCHes it. Keep a try/catch around the runner (defense-in-depth) → `patchOriginal` with a generic fallback string on an unexpected throw, mirroring `runRoleSyncDeferred`.
5. **Preserve the §K no-leak / no-raw-id posture.** The runner must not log raw ids / payloads; `patchOriginal` already truncates error bodies. Mirror role-sync's lowercase, id-free logging.
6. **Anti-spam invariant unaffected.** This stays an explicit slash-command path; no auto-respond is introduced.

## Fix Strategy
Mirror `runRoleSyncDeferred` exactly. In `dispatch.ts`, replace the synchronous block at lines 314-319:

```ts
if (!isQuest && interaction.data?.name === RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME) {
  return await handleRecallWedgeLiveDemoInteraction(interaction);
}
```

with a defer-first block:

```ts
if (!isQuest && interaction.data?.name === RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME) {
  // The live Dixie round-trip (liveRecallViaDixie → /api/recall/intake) can
  // exceed Discord's 3s ACK window, so DEFER (ephemeral) immediately and run
  // the gated handler in the background, PATCHing @original. Mirrors the
  // /role-sync slash deferral. Returning the full response synchronously timed
  // the interaction out ("application did not respond") under a slow Dixie.
  void runRecallWedgeLiveDemoDeferred(interaction);
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: MessageFlags.EPHEMERAL },
  };
}
```

Add a background runner next to `runRoleSyncDeferred` (≈ after line 1389):

```ts
async function runRecallWedgeLiveDemoDeferred(
  interaction: DiscordInteraction,
): Promise<void> {
  try {
    const resp = await handleRecallWedgeLiveDemoInteraction(interaction);
    const content =
      (resp.data as { content?: string } | undefined)?.content ??
      RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL;
    await patchOriginal(interaction, true, content);
  } catch (err) {
    console.error('recall-wedge-live-demo: deferred run failed:', err);
    await patchOriginal(
      interaction,
      true,
      RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL,
    ).catch(() => {});
  }
}
```

(Import `RECALL_WEDGE_LIVE_DEMO_GENERIC_REFUSAL` alongside the existing `handleRecallWedgeLiveDemoInteraction` import from `./recall-wedge-live-demo.ts`, or inline the literal string.) To make the runner unit-testable, optionally thread `deps?: RecallWedgeLiveDemoDeps` and `fetchFn: typeof fetch = fetch` through it (the handler already accepts `deps`; `patchOriginal` would need an injectable fetch to assert the PATCH — or test `runRecallWedgeLiveDemoDeferred` against an injected slow `loadLiveClient` and spy on global `fetch`, as role-sync's slash test does).

**Opportunistic (P3):** apply the same defer-first transform to `/recall-wedge-demo` at `dispatch.ts:295-300`. Its handler awaits a cached dynamic import (in-memory, much lower risk), but deferring removes the residual cold-import-on-first-call risk and keeps the two commands symmetric. **Same two-test caveat applies:** `recall-wedge-demo.test.ts:758` has the identical "no DEFERRED branch" module guard (keep deferral in dispatch) and `recall-wedge-demo.test.ts:802-816` has a dispatch-wiring assertion to update. Treat the opportunistic fix as in-scope only if it can ship clean; otherwise leave bd-uia's sibling note and skip.

### Fix Hints
Structured hints for multi-model handoff (each hint targets one file change):

| File | Action | Target | Constraint |
|------|--------|--------|------------|
| apps/bot/src/discord-interactions/dispatch.ts | refactor | the `RECALL_WEDGE_LIVE_DEMO_COMMAND_NAME` dispatch block (L314-319): `return await handleRecallWedgeLiveDemoInteraction` → `void runRecallWedgeLiveDemoDeferred` + type-5 ephemeral ACK | defer-first; type 5 (not 6); reuse existing helpers |
| apps/bot/src/discord-interactions/dispatch.ts | add | `runRecallWedgeLiveDemoDeferred(interaction)` background runner mirroring `runRoleSyncDeferred` | reads `resp.data.content`; PATCHes `@original` via `patchOriginal(.., true, ..)`; try/catch with generic fallback; no raw-id logging |
| apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts | fix | update dispatch-wiring assertion (L1850-1852) from the `return await ...` regex to the deferred form; add a behavioral defer test modeled on role-sync-dispatch.test.ts | the module static-guard at L1775-1783 must still pass (handler stays type-4) |
| apps/bot/src/discord-interactions/recall-wedge-demo.ts | refactor | (P3, opportunistic) defer its dispatch the same way | only if it ships clean; update recall-wedge-demo.test.ts:758 + :802-816 too |
