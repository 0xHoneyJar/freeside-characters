# Bug Triage: spotlight `resolveNftPfp` phantom-imports `@0xhoneyjar/inventory` — dead redundant pfp resolver

## Metadata
- **schema_version**: 1
- **bug_id**: 20260624-a87b73
- **classification**: logic_bug (dead-code / phantom-dependency wiring)
- **severity**: low (no live user-visible impact today — masked/redundant; see Reframe)
- **eligibility_score**: 4
- **eligibility_reasoning**: Followable repro (+2: the dynamic `import('@0xhoneyjar/inventory')` throws on every call, is caught, returns null) + source locations all verified to exist (+1: resolve-nft-pfp.ts:36, digest-orchestrator.ts:296/299/365) + regression from a known baseline (+1: PR #178 added the real HTTP resolver `resolveInventoryPfps` but left the phantom-importing `resolveNftPfp` wired as `enrichSpotlightPfp`'s default — two parallel resolvers, one dead). No disqualifiers — defect in existing behavior; fix retires dead code / re-seams an existing resolver onto an existing HTTP client.
- **test_type**: unit
- **risk_level**: medium (the CHANGE touches the load-bearing fail-soft contract + the safeImageUrl/httpsImageUrl host-allowlist trust boundary, even though the bug's live impact is low)
- **created**: 2026-06-24T07:35:54Z
- **refs**: Issue #87 · PR #178 (this branch) · bd-deg · branch feat/spotlight-pfp-inventory-api

## Reproduction
### Steps
1. Inspect `packages/persona-engine/src/orchestrator/inventory/resolve-nft-pfp.ts:36`: `resolveNftPfp` does `await import('@0xhoneyjar/inventory' as string)`.
2. Confirm the package exists nowhere: not in any `package.json`, not in `node_modules` (only `@0xhoneyjar/medium-registry` is present), and the Dockerfile injects only `@0xhoneyjar/events` (Dockerfile:36,57).
3. Therefore the import rejects on EVERY call → caught at resolve-nft-pfp.ts:43 → returns `null`.
4. `resolveNftPfp` is `enrichSpotlightPfp`'s default `nftResolver` (digest-orchestrator.ts:299), called from `resolveSpotlightIdentity` (line 365), which runs in `composeEnrichedDigestPost` (line 202). So the NFT-pfp enrichment branch always yields null.

### Expected Behavior
Both spotlight pfp surfaces resolve a holder's NFT pfp through the real, deployed `inventory-api` HTTP path (`fetchProfilePictureHttp`), with no phantom npm dependency anywhere in the tree.

### Actual Behavior
`resolveNftPfp` dynamic-imports a package that does not exist; the import throws, is caught, and always returns null. The code path can never succeed. It is a dead resolver left parallel to the working HTTP resolver added in PR #178.

### Environment
All environments (CI, dev, prod). The phantom import fails identically everywhere.

## Analysis

### REFRAME (grounded frame-correction — surfaced, not decided · MAY-LATITUDE-3)
The bug report frames this as "the `DIGEST_SURFACE=pulse` rollback path's spotlight pfp is broken / null on every digest." Reading the code, that framing is partly inaccurate and the real shape is:

- The **pulse path** (`composeDigestPost`, the DEFAULT when `DIGEST_SURFACE != 'enriched-v2'`) builds a dimension-pulse billboard via `buildDimensionPulsePayload` and **never resolves a spotlight identity or pfp at all** (digest-orchestrator.ts:111-152). So the pulse/rollback path has NO spotlight NFT pfp to break.
- `enrichSpotlightPfp` / `resolveNftPfp` execute **only** inside `resolveSpotlightIdentity`, which runs **only** in the **enriched-v2** path (the working prod surface) — line 202.
- In enriched-v2, the real PRIMARY pfp comes from `resolveInventoryPfps` (line 220, the HTTP path PR #178 added). The renderer's precedence is `resolvePfp: (w) => inventoryPfp.get(w) ?? identities.get(w)?.pfp_url ?? null` (line 236). The phantom `resolveNftPfp` writes into `identities.pfp_url`, but since it is always null, `identities.pfp_url` carries only the DB pfp — and `inventoryPfp` (the real HTTP map) shadows it anyway.

**Net:** `resolveNftPfp` is **dead AND redundant** — it runs only where `resolveInventoryPfps` already wins. There is **no user-visible broken pfp today** (the report's "null on every digest" impact is masked/shadowed, not surfaced). The defect is real (a phantom dynamic-import that can never succeed = a coherence footgun + leftover scaffolding from before `resolveInventoryPfps` existed), and worth fixing to complete PR #178 coherently — but its severity is **low**, not "spotlight broken in prod."

**Implementer fork (the load-bearing decision for /implement + /review-sprint):** the report's literal fix direction — "route `enrichSpotlightPfp`'s resolver through `fetchProfilePictureHttp`" — would, if applied naively, create a **DOUBLE-FETCH**: the same spotlight wallets' pfps fetched once via `resolveSpotlightIdentity → enrichSpotlightPfp` and again via `resolveInventoryPfps`. The coherent options are:
  - **Option A (retire):** delete `resolveNftPfp` and remove the now-redundant NFT-enrichment branch from `enrichSpotlightPfp`, leaving `resolveInventoryPfps` as the single PRIMARY HTTP resolver. Smallest, lowest-risk, no double-fetch. (Recommended starting point — but verify the `enrichSpotlightPfp` export / tests aren't relied on elsewhere first.)
  - **Option B (consolidate onto enrichSpotlightPfp):** move the HTTP fetch into `enrichSpotlightPfp` (thread baseUrl/timeout/fetch down through `resolveSpotlightIdentity`, which today takes only `wallet`) and remove the separate `resolveInventoryPfps` pass — one resolver, but a larger refactor that changes the enriched-v2 pre-resolve shape.
This decision is NOT made in triage. Both options retire the phantom import and satisfy the operator's "unify on the real HTTP path" intent; the implementer/reviewer picks based on the double-fetch + blast-radius trade-off and records it in the Decision Log.

### Suspected Files
| File | Line(s) | Confidence | Reason |
|------|---------|------------|--------|
| packages/persona-engine/src/orchestrator/inventory/resolve-nft-pfp.ts | 31-48 (esp. 36, 43) | high | The phantom `import('@0xhoneyjar/inventory')`. Retire it. If `NftPfpResolver` seam is kept, rebind it to `fetchProfilePictureHttp`; otherwise delete the module. |
| packages/persona-engine/src/orchestrator/digest-orchestrator.ts | 296-312 (`enrichSpotlightPfp`, default `nftResolver = resolveNftPfp` at 299) · 352-371 (`resolveSpotlightIdentity`, calls at 365) · 451-490 (`resolveInventoryPfps`, the working HTTP path to mirror) · 236 (`resolvePfp` precedence) | high | The dead wiring + the working pattern to mirror/consolidate onto. Threading note: `resolveSpotlightIdentity(wallet)` has NO config/deps in scope today — Option B requires threading baseUrl down. |
| packages/persona-engine/src/orchestrator/inventory/inventory-http-client.ts | 169-220 (`fetchProfilePictureHttp`) | high (reference; likely no change) | The real deployed HTTP pfp resolver. Already has `safeImageUrl` host-allowlist + full fail-soft. Both surfaces should route here. |

### Related Tests
| Test File | Coverage |
|-----------|----------|
| packages/persona-engine/src/orchestrator/digest-orchestrator.test.ts:732-782 | `enrichSpotlightPfp · inventory-api NFT pfp enrichment (Issue #87)` — DB-wins, NFT fallback, https-filter, null fail-soft, throwing-resolver fail-soft (FAGAN). The injection seam tests; the DEFAULT resolver behavior must be updated/retired per the chosen option. |
| packages/persona-engine/src/orchestrator/digest-orchestrator.test.ts:633-730 | `resolveInventoryPfps` map-keying / case-insensitivity / dormant-when-unset — the canonical HTTP-path behavior the unified resolver must continue to satisfy. |
| packages/persona-engine/src/orchestrator/inventory/inventory-http-client.test.ts:31-260 | `fetchProfilePictureHttp` fail-soft contract (missing baseUrl, non-OK, timeout-abort, malformed JSON, host-allowlist). Reference; likely unchanged. |

### Test Target
A failing test that asserts the chosen unified behavior: there is **no** `@0xhoneyjar/inventory` dynamic import in the live code path, and the legacy/default spotlight-pfp seam either (A) is removed with `resolveInventoryPfps` proven sole-PRIMARY, or (B) routes through `fetchProfilePictureHttp` against the configured baseUrl and stays dormant (null, no fetch) when `INVENTORY_API_URL` is unset. Test-first: it must fail against the current phantom-import wiring.

### Constraints (load-bearing invariants — MUST be preserved)
- **DB pfp wins** (operator-curated): `if (identity.pfp_url) return identity` (digest-orchestrator.ts:301) stays.
- **Fail-soft is sacred:** a down / slow / absent / malformed inventory-api → null → DB fallback, NEVER a thrown digest break and NEVER ANON-from-stall (FAGAN comments digest-orchestrator.ts:302-305).
- **Host-allowlist:** `safeImageUrl` (inventory-http-client.ts:75-86, https on assets./metadata.0xhoneyjar.xyz only) and `httpsImageUrl` (digest-orchestrator) trust boundary intact.
- **Dormant-until-deployed:** `INVENTORY_API_URL` / `inventoryApiBaseUrl` unset → no fetch, DB-only (identical to today).
- **Same posture as resolveInventoryPfps:** `INVENTORY_PFP_TIMEOUT_MS` (3s), `digestPfpLogger`, `deps.inventoryDoFetch ?? fetch` injection seam.
- **SCOPE — digest path / resolve-nft-pfp only.** Do NOT touch `packages/persona-engine/src/events/announce-mint.ts` (= bd-shadow-mint-image-repoint-gym, blocked on inventory-api Shadow support, cross-repo). Note: announce-mint already migrated to `fetchNftMetadataHttp`; its `@0xhoneyjar/inventory` mention is now only a tombstone comment (line 31), so the digest path is the LAST live phantom import.
- **Land on `feat/spotlight-pfp-inventory-api`** to complete PR #178 coherently.

## Fix Strategy
Unify the spotlight pfp resolution onto the real, deployed `inventory-api` HTTP path (`fetchProfilePictureHttp`) and retire the phantom `@0xhoneyjar/inventory` dynamic import in `resolve-nft-pfp.ts`. Because `resolveInventoryPfps` (PR #178) already supplies the real PRIMARY pfp in the only path that runs `enrichSpotlightPfp`, the implementer must FIRST resolve the Option A (retire the redundant resolver) vs Option B (consolidate the fetch into `enrichSpotlightPfp`, drop the separate pass) fork from the Reframe above — to avoid introducing a double-fetch. Whichever option, preserve every invariant in Constraints, drive it test-first (a test that fails against the current phantom wiring), and update the `enrichSpotlightPfp` nftResolver-injection tests (732-782) to match the new default. Record the chosen option + rationale in the NOTES.md Decision Log and reviewer.md.

### Fix Hints
Structured hints for multi-model handoff (each hint targets one file change):

| File | Action | Target | Constraint |
|------|--------|--------|------------|
| packages/persona-engine/src/orchestrator/inventory/resolve-nft-pfp.ts | remove | the `import('@0xhoneyjar/inventory')` dynamic import (phantom dep) | retire the dead resolver; keep `NftPfpResolver` type only if the seam is reused |
| packages/persona-engine/src/orchestrator/digest-orchestrator.ts | refactor | `enrichSpotlightPfp` default `nftResolver` (line 299) + its call in `resolveSpotlightIdentity` (line 365) | resolve Option A (retire) vs Option B (route through `fetchProfilePictureHttp`) FIRST; no double-fetch with `resolveInventoryPfps` |
| packages/persona-engine/src/orchestrator/digest-orchestrator.test.ts | fix | `enrichSpotlightPfp` injection tests (732-782) | preserve DB-wins + fail-soft + throwing-resolver assertions; update the DEFAULT-resolver expectation |
