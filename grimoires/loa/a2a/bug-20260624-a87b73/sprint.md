# Sprint Plan: Bug Fix — spotlight `resolveNftPfp` phantom-imports `@0xhoneyjar/inventory`

**Type**: bugfix
**Bug ID**: 20260624-a87b73
**Source**: /bug (triage)
**Sprint**: sprint-bug-2
**Refs**: Issue #87 · PR #178 · bd-deg · branch feat/spotlight-pfp-inventory-api

---

## sprint-bug-2: retire the phantom `@0xhoneyjar/inventory` resolver; unify spotlight pfp on the inventory-api HTTP path

### Sprint Goal
Remove the dead/redundant phantom-importing `resolveNftPfp` and ensure spotlight pfp resolution flows solely through the real, deployed `inventory-api` HTTP path (`fetchProfilePictureHttp`), with a failing test proving the fix and every fail-soft / host-allowlist / dormant-when-unset invariant preserved.

### Decision Gate (resolve BEFORE Task 2 — see triage.md "REFRAME")
`resolveInventoryPfps` (PR #178) already supplies the real PRIMARY pfp in the only path that runs `enrichSpotlightPfp`. Choose and record in the Decision Log:
- **Option A (recommended start):** delete `resolveNftPfp` + the redundant NFT-enrichment branch of `enrichSpotlightPfp`; `resolveInventoryPfps` becomes the single PRIMARY. Smallest blast radius, no double-fetch.
- **Option B:** move the HTTP fetch into `enrichSpotlightPfp` (thread baseUrl/timeout/fetch through `resolveSpotlightIdentity`), drop the separate `resolveInventoryPfps` pass. Larger refactor.
Naively "routing `enrichSpotlightPfp` through `fetchProfilePictureHttp`" without retiring `resolveInventoryPfps` would DOUBLE-FETCH — do not do that.

### Deliverables
- [ ] Failing test that proves the bug (no `@0xhoneyjar/inventory` import in the live path; the chosen unified behavior)
- [ ] Source fix per the chosen option (phantom import retired)
- [ ] Updated `enrichSpotlightPfp` nftResolver-injection tests (digest-orchestrator.test.ts:732-782)
- [ ] All existing tests pass (no regressions)
- [ ] Decision Log entry (Option A vs B + rationale) in NOTES.md + reviewer.md

### Technical Tasks

#### Task 1: Write Failing Test [G-5]
- Create a `unit` test reproducing the defect: assert the live spotlight-pfp path does NOT dynamic-import `@0xhoneyjar/inventory` and exhibits the chosen unified behavior (Option A: `resolveInventoryPfps` is sole PRIMARY and `enrichSpotlightPfp`'s NFT branch is gone; Option B: `enrichSpotlightPfp` routes through `fetchProfilePictureHttp`, dormant null when `INVENTORY_API_URL` unset).
- Verify the test fails against the current phantom-import wiring.
- Test file: `packages/persona-engine/src/orchestrator/digest-orchestrator.test.ts` (extend the existing `enrichSpotlightPfp` describe at 732) — or `resolve-nft-pfp.test.ts` if the module survives.

**Acceptance Criteria**:
- Test fails with current code, proving the phantom-import path exists / is reachable as the default
- Test name clearly describes the scenario (phantom dep retired / unified HTTP resolver)
- Test is isolated (hermetic — inject fetch/resolver; no real network)

#### Task 2: Implement Fix [G-1, G-2]
- Apply the chosen option in `resolve-nft-pfp.ts` + `digest-orchestrator.ts`; retire the `@0xhoneyjar/inventory` dynamic import.
- Preserve: DB-pfp-wins, fail-soft (never throw past the seam, never ANON-from-stall), `safeImageUrl`/`httpsImageUrl` host-allowlist, dormant-until-deployed, `INVENTORY_PFP_TIMEOUT_MS` (3s), the `deps.inventoryDoFetch ?? fetch` injection seam.
- Update the `enrichSpotlightPfp` injection tests (732-782) to the new default.
- Verify the failing test now passes; run the full suite (`bun run test`).

**Acceptance Criteria**:
- Failing test now passes
- No `@0xhoneyjar/inventory` (or other phantom) import remains in the live path
- No regressions in existing tests (including `resolveInventoryPfps` 633-730 + `fetchProfilePictureHttp` suite)
- Fix addresses root cause (dead phantom resolver retired), not symptoms

### Acceptance Criteria
- [ ] No phantom `@0xhoneyjar/inventory` import anywhere in the digest path
- [ ] Spotlight pfp resolves solely via `fetchProfilePictureHttp` (no double-fetch)
- [ ] Failing test proves the fix; all existing tests pass
- [ ] Every fail-soft / host-allowlist / dormant-when-unset invariant preserved (triage.md Constraints)
- [ ] `announce-mint.ts` untouched (out of scope — bd-shadow-mint-image-repoint-gym)
- [ ] Lands on `feat/spotlight-pfp-inventory-api` (completes PR #178)

### Triage Reference
See: grimoires/loa/a2a/bug-20260624-a87b73/triage.md
