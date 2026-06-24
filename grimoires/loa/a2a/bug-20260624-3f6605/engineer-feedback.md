All good (with noted concerns)

# Senior Lead Review — bug-20260624-3f6605 (bd-uia) · sprint-bug-3

**Verdict: APPROVED.** Concerns below are non-blocking and documented; the fix is
correct, surgical, tested (805/805), type-clean, and mirrors the established
`/role-sync` deferral pattern.

## What I verified (code, not just the report)
- `dispatch.ts` live-demo branch: the synchronous `return await handleRecallWedgeLiveDemoInteraction(interaction)` is gone; replaced with `void runRecallWedgeLiveDemoDeferred(interaction)` + a `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (type 5) ephemeral ACK. ✓
- `runRecallWedgeLiveDemoDeferred`: structural twin of `runRoleSyncDeferred` — await gated handler → read `resp.data?.content` (fallback to generic refusal) → `patchOriginal(@original)` → catch logs + PATCHes refusal, never throws. ✓
- Handler module (`recall-wedge-live-demo.ts`) byte-unchanged → EPHEMERAL-only static guard (`:1775-1783`) intact. ✓
- AC Verification section present in reviewer.md, every AC walked verbatim with file:line. ✓
- New behavioral tests genuinely gate the fix (import a symbol absent on old code; assert no `@original` PATCH until the slow client resolves, then exactly one served PATCH). ✓
- Pre-existing typecheck errors confirmed shadow-only and unrelated (stash → 6 → 6), tracked under bd-glb. ✓
- Doc verification PASS: CHANGELOG is post-merge-automation-owned (not a manual gate here); no new command (delivery-shape change only); dispatch branch + runner both carry explanatory comments.

## Adversarial Analysis

### Concerns Identified
1. **Always-defer on the refusal path** (`dispatch.ts`, live-demo branch). Every invocation — including gate-refused ones doing zero network work — now ACKs (type 5) then PATCHes `@original`. Previously a refusal was a single synchronous type-4. Net: two round-trips + a brief "thinking…" spinner before the refusal. Harmless for a dev-only, low-traffic command, and it matches role-sync's unconditional-defer. **Non-blocking.**
2. **A failed `@original` PATCH leaves the defer unresolved** (`runRecallWedgeLiveDemoDeferred` catch). If the happy-path `patchOriginal` throws (Discord transient outage), the catch attempts a second PATCH that likely also fails (`.catch(()=>{})`), leaving the user on a permanent ephemeral spinner. This is identical to role-sync's failure mode — accepted parity, not a new risk. **Non-blocking.**
3. **Gate evaluation now happens post-ACK** (the runner recomputes gates in the background). We commit to a response before knowing if the invoker is authorized. Functionally fine (the refusal is delivered via PATCH), just mildly wasteful for refused users. The efficient alternative (sync gate-check, defer only on pass) would duplicate gate logic into dispatch.ts — worse coupling. **Justified.**

### Assumption Challenged
- **Assumption**: `resp.data?.content` is always the full intended message.
- **Risk if wrong**: if the live-demo handler ever returns a CV2 components payload (like role-sync's `rendered` path) instead of `content`, the runner silently falls back to the generic refusal and drops the real response.
- **Recommendation**: acceptable today (handler only ever returns `ephemeralResponse(content)`) and the fallback is fail-safe (never leaks). Make it explicit: if the live-demo ever renders CV2, the runner needs a `patchOriginalData` branch mirroring role-sync. Add a one-line note at the runner (done implicitly via the role-sync reference). **Non-blocking.**

### Alternative Not Considered
- **Alternative**: a module-level deps-injection seam (`setRecallWedgeLiveDemoDeps`) mirroring `setRoleSyncDeps`, letting the test drive the full `dispatchSlashCommand` entry and assert the type-5 ACK end-to-end.
- **Tradeoff**: more faithful E2E coverage of the ACK shape, but adds a settable production singleton for a dev-only command and risks the test firing the real `void` runner with default deps (real import/network).
- **Verdict**: current approach (export the runner + a static dispatch-wiring assertion + a behavioral runner test) is the right call — less production surface, and the static + behavioral tests together cover both the ACK shape and the deferral. **Current approach justified.**

## Next Steps
Proceed to `/audit-sprint sprint-bug-3`. No changes required.
