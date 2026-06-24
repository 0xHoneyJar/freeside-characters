APPROVED - LETS FUCKING GO

# Security Audit — bug-20260624-3f6605 (bd-uia) · sprint-bug-3

**Paranoid Cypherpunk Auditor verdict: APPROVED.** The fix is security-neutral-to-positive.
No CRITICAL / HIGH / MEDIUM / LOW findings introduced.

## Scope audited
`apps/bot/src/discord-interactions/dispatch.ts` (live-demo defer-first branch +
`runRecallWedgeLiveDemoDeferred` runner) and its test. A Discord interaction
ACK-timing fix; no auth, schema, contract, wallet, or secret surface added.

## Checklist
- **Secrets**: none hardcoded; no secret read/logged. The catch's `console.error('... deferred run failed:', err)` is server-side only and `err` is a fetch/Discord error (the existing `patchOriginal` only ever surfaces Discord's own response body, sliced to 200 chars — never our token/env). Matches the role-sync `console.error` precedent. ✓
- **Auth/Authz**: NOT weakened by deferring before gate-eval. The deferred ACK is an opaque "thinking…" with no data; the handler's enable/guild/operator gates run unchanged inside the runner and gate the actual content. A refused invoker receives the generic refusal via PATCH — no privileged data leaves before gating. ✓
- **Input validation**: no newly-trusted input. The runner reads `resp.data?.content` (a string produced by our own gated handler) and the fixed synthetic probe is unchanged — the interaction's options are still never read. ✓
- **Info disclosure**: improved. On any failure the runner PATCHes the SAME generic ephemeral refusal the handler uses — no raw error / id / token / env / payload reaches Discord (Phase 37B §K posture preserved). The prior synchronous-timeout path risked a less controlled failure surface. ✓
- **Egress**: no new outbound call. The only fetch is the pre-existing `patchOriginal` (`PATCH /webhooks/{app}/{token}/messages/@original`, interaction-token-in-URL, no Authorization header — correct contract). The gated live client is the same single seam, still loaded lazily only after gates pass. ✓
- **Surface**: `runRecallWedgeLiveDemoDeferred` is `export`ed for testability; exporting a function is not a new ingress (it is wired only by the dispatch branch). Test's global `fetch` spy is test-only and `mockRestore`d in `finally`. ✓
- **Tests/regressions**: 805/805; handler module byte-unchanged (EPHEMERAL-only static guard intact). Pre-existing shadow typecheck errors are unrelated (tracked bd-glb). ✓

## Non-blocking notes (carried from the lead review, accepted)
- Always-defer means refused users now see ACK→PATCH (two round-trips) — accepted parity with role-sync.
- A failed `@original` PATCH leaves the ephemeral defer unresolved — accepted parity with role-sync's identical failure mode.

Gate: PASS. COMPLETED marker created.
