# Implementation Report — sprint-bug-2 (bd-g53 / bd-deg)

**Bug**: spotlight `resolveNftPfp` phantom-imports `@0xhoneyjar/inventory`
**Bug ID**: 20260624-a87b73 · **Refs**: #87 · PR #178 · bd-deg · branch `feat/spotlight-pfp-inventory-api`
**Option chosen**: **A** (retire dead+redundant resolver) — see Decision Log.

## Executive Summary

Retired the dead, redundant, phantom-importing `resolveNftPfp`. It dynamic-imported `@0xhoneyjar/inventory` — a package present nowhere (not a dep, not in `node_modules`; the Dockerfile injects only `@0xhoneyjar/events`) — so it threw on every call and returned null, every time. It was also redundant: `resolveInventoryPfps` (PR #178) already supplies the real PRIMARY spotlight pfp over HTTP, and the renderer precedence `inventoryPfp ?? identities.pfp_url ?? null` (`digest-orchestrator.ts:236`) shadowed the phantom result entirely. **Net behavioral change: zero** — the NFT branch was always null, so removing it changes no output; it only deletes a dead code path and the last live phantom import in the digest path.

## AC Verification

> "No phantom `@0xhoneyjar/inventory` import anywhere in the digest path" (sprint.md:54)
- **✓ Met** — `resolve-nft-pfp.ts` (the sole live `import('@0xhoneyjar/inventory')` call site) deleted; import dropped from `digest-orchestrator.ts:20`. Enforced by a new regression guard: `digest-orchestrator.test.ts:733-756` scans the `src/orchestrator` tree for the dynamic-import-call regex and asserts zero offenders (passes).

> "Spotlight pfp resolves solely via `fetchProfilePictureHttp` (no double-fetch)" (sprint.md:55)
- **✓ Met** — the only pfp resolution is now `resolveInventoryPfps` → `fetchProfilePictureHttp` (`digest-orchestrator.ts:220,464`), surfaced via `resolvePfp` (`:236`). `resolveSpotlightIdentity` returns `pickSpotlightDisplay(resolved)` directly (handle + DB pfp only, `:365`) — no second fetch.

> "Failing test proves the fix; all existing tests pass" (sprint.md:56)
- **✓ Met** — guard test confirmed RED against the phantom (`offenders = [resolve-nft-pfp.ts]`), GREEN after deletion. Full persona-engine suite **1777 pass / 2 skip / 0 fail**; apps/bot **803 pass / 0 fail**; persona-engine `tsc --noEmit` exit 0.

> "Every fail-soft / host-allowlist / dormant-when-unset invariant preserved" (sprint.md:57)
- **✓ Met** — DB-pfp-wins precedence unchanged (`:236`); `resolveSpotlightIdentity`'s `catch → anon` fail-soft intact (`:366`, handle still resolved); host-allowlist for the inventory pfp lives in `fetchProfilePictureHttp`'s `safeImageUrl` (untouched) + DB pfp still guarded by `httpsImageUrl` in `pickSpotlightDisplay` (`:282`); dormant-when-unset preserved in `resolveInventoryPfps` (`:475` — no baseUrl/resolver → empty map → DB-only).

> "`announce-mint.ts` untouched (out of scope — bd-shadow-mint-image-repoint-gym)" (sprint.md:58)
- **✓ Met** — no edits to `events/`. (Triage note: `announce-mint.ts` already migrated to `fetchNftMetadataHttp`; its `@0xhoneyjar/inventory` is a tombstone comment, not a live import.)

> "Lands on `feat/spotlight-pfp-inventory-api` (completes PR #178)" (sprint.md:59)
- **✓ Met** — implemented on the current branch.

### Task ACs
- **Task 1** (failing test, sprint.md:36-39): ✓ — hermetic source-scan guard, no network; named for the scenario; verified RED-then-GREEN.
- **Task 2** (fix, sprint.md:47-51): ✓ — root cause (dead phantom resolver) removed, not symptom-patched; no regressions.

## Tasks Completed

- **Deleted** `packages/persona-engine/src/orchestrator/inventory/resolve-nft-pfp.ts` (the phantom dynamic import + `NftPfpResolver` type).
- **`digest-orchestrator.ts`**: removed the `resolve-nft-pfp` import (was `:20`); removed the dead `enrichSpotlightPfp` function (was `:286-312`); `resolveSpotlightIdentity` now returns `pickSpotlightDisplay(resolved)` directly (`:365`) with a comment documenting the inventory-PRIMARY / DB-FALLBACK split; de-referenced the deleted symbol in the `INVENTORY_PFP_TIMEOUT_MS` comment.
- **`digest-orchestrator.test.ts`**: replaced the 5-case `enrichSpotlightPfp` describe block (was `:732-782`) with the phantom-import regression guard; dropped the now-unused `enrichSpotlightPfp` import; added `node:fs`/`node:path` helpers.

## Technical Highlights

- **Zero-behavior-change deletion**: proved by analysis (the NFT branch was always-null phantom + shadowed by `resolvePfp` precedence) and by the full suite staying green with no test logic changes beyond removing tests for the deleted function.
- **Regression guard matches the import CALL, not prose**: regex `/import\s*\(\s*['"]@0xhoneyjar\/inventory/` so historical comments in `inventory-http-client.ts` / `announce-mint.ts` don't false-positive.

## Testing Summary

- `bun test src/orchestrator/digest-orchestrator.test.ts -t phantom` — guard (RED→GREEN verified).
- `bun test` (persona-engine) — 1777 pass / 2 skip / 0 fail (88 files).
- `bun run --cwd apps/bot test` — 803 pass / 0 fail.
- `bun run typecheck` (persona-engine) — exit 0.

## Known Limitations

- **Pre-existing, NOT introduced here**: `apps/bot` `tsc` fails with 8 `currentRosterIdentity` errors in `apps/bot/src/shadow/roster-source.mock.ts` (shadow roster mock missing a method on its `RosterSource` shape). Verified via `git stash` that this reproduces at committed HEAD (37983e9) before any of my edits — it is unrelated branch debt in the shadow module. Worth a separate `/bug`.
- `announce-mint.ts` shadow-mint image path (`bd-shadow-mint-image-repoint-gym`) remains blocked on inventory-api Mibera-Shadow support (`bd-bbp` / inventory-api#8) — out of scope by design.

## Verification Steps (reviewer)

```bash
cd packages/persona-engine
bun test src/orchestrator/digest-orchestrator.test.ts -t phantom   # guard passes
bun test && bun run typecheck                                       # 1777 pass, tsc clean
git grep -nE "import\s*\(\s*['\"]@0xhoneyjar/inventory" -- packages apps   # no matches
```

## Decision Log

**Option A over Option B** (sprint.md:16-20). The triage's REFRAME established `resolveNftPfp` is dead AND redundant — `resolveInventoryPfps` (PR #178) is already the real PRIMARY in the only path that ran `enrichSpotlightPfp`, and the `resolvePfp` precedence shadows the NFT result. Option B (thread baseUrl through `resolveSpotlightIdentity` to fetch in `enrichSpotlightPfp`) would add wiring to a redundant path and risk a double-fetch. Option A deletes the dead code, smallest blast radius, zero behavior change. Simplicity-first (Karpathy).
