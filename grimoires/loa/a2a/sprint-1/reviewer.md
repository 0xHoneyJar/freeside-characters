# Implementation Report: Sprint 1 — Channel↔Zone Reverse Map (Phase B)

**Date:** 2026-05-02
**Engineer:** Sprint Task Implementer Agent
**Sprint Reference:** grimoires/loa/sprint.md (Sprint 1, lines 58-106)
**Spec Reference:** grimoires/loa/specs/build-environment-substrate-v07a1.md (Phase B, lines 298-313)
**Cycle:** cycle-001 (V0.7-A.1 environment substrate)

---

## Executive Summary

Sprint 1 lands the canonical channel→zone reverse map. The forward direction (`zone → channelId`) was already at `packages/persona-engine/src/config.ts:166-177` (`getZoneChannelId`); the reverse (`channelId → ZoneId`) was missing. Without it no chat handler could answer "which codex location am I in?" without a hand-rolled lookup. Sprint 2's environment-context builder (Phase C) will be the first consumer; future zone-aware paths inherit it for free.

Approach: delegate to the existing forward map rather than duplicate it. `getZoneForChannel` iterates `ALL_ZONES` and calls `getZoneChannelId(config, zone)` per zone — single source of truth, no drift risk if env-key names ever change.

**Key Accomplishments:**
- `apps/bot/src/lib/channel-zone-map.ts` — pure-function module exporting `getZoneForChannel` + `getCodexAnchorForZone`
- `apps/bot/scripts/smoke-zone-map.ts` — 9 assertions covering forward+reverse round-trip across 4 zones, unknown→undefined fallback, and metadata completeness
- Workspace-wide `bun run typecheck` clean; zero modifications to existing source files (purely additive)

---

## AC Verification

All 6 acceptance criteria from `grimoires/loa/sprint.md:75-80` walked verbatim with file:line evidence.

**AC-1.1**: "`getZoneForChannel(config, env.DISCORD_CHANNEL_STONEHENGE)` returns `'stonehenge'`"
- Status: `✓ Met`
- Evidence: `apps/bot/src/lib/channel-zone-map.ts:31` — `return ALL_ZONES.find((zone) => getZoneChannelId(config, zone) === channelId);`
- Test: `apps/bot/scripts/smoke-zone-map.ts:46` — assertion `ch-stonehenge-1000 → stonehenge (got stonehenge)` passes (smoke run 2026-05-02)

**AC-1.2**: "`getZoneForChannel(config, '1234567890')` returns `undefined` for unknown"
- Status: `✓ Met`
- Evidence: `apps/bot/src/lib/channel-zone-map.ts:31` — `Array.prototype.find` returns `undefined` when no zone matches
- Test: `apps/bot/scripts/smoke-zone-map.ts:53` — assertion `unknown channel returns undefined (got undefined)` passes

**AC-1.3**: "All four zones (stonehenge, bear-cave, el-dorado, owsley-lab) round-trip cleanly"
- Status: `✓ Met`
- Evidence: `apps/bot/src/lib/channel-zone-map.ts:31` covers forward inversion; `ALL_ZONES` is the canonical list at `packages/persona-engine/src/compose/composer.ts:87`
- Test: `apps/bot/scripts/smoke-zone-map.ts:44-47` — 4 round-trip assertions pass for all four zones

**AC-1.4**: "`getCodexAnchorForZone('stonehenge')` returns `{ name, dimension, emoji }` with non-empty fields"
- Status: `✓ Met`
- Evidence: `apps/bot/src/lib/channel-zone-map.ts:46` — `return ZONE_FLAVOR[zone];` where `ZONE_FLAVOR` is defined at `packages/persona-engine/src/score/types.ts:53-58` with `{emoji, name, dimension}` populated for all four `ZoneId`s
- Test: `apps/bot/scripts/smoke-zone-map.ts:60-63` — 4 assertions verify all three fields are non-empty for all four zones (smoke output: `stonehenge: { name: "Stonehenge", dimension: "overall", emoji: "🗿" }` and parallel for bear-cave/el-dorado/owsley-lab)

**AC-1.5**: "`bun run typecheck` clean across workspace"
- Status: `✓ Met`
- Evidence: workspace-wide `bun run typecheck` exits 0 with `tsc --noEmit` clean for both `packages/persona-engine` and `apps/bot` (verified 2026-05-02 01:36 UTC)

**AC-1.6**: "No existing source files modified (purely additive)"
- Status: `✓ Met`
- Evidence: `git diff --stat HEAD origin/main -- packages/ apps/bot/src/ apps/bot/scripts/` shows only NEW files (`apps/bot/src/lib/channel-zone-map.ts`, `apps/bot/scripts/smoke-zone-map.ts`); no existing files modified

---

## Tasks Completed

### Task 1.1 (bd-1dp): Create `channel-zone-map.ts` with reverse map + zone metadata accessor

**Status:** Complete
**Approach:** Pure-function module. `getZoneForChannel` delegates to `getZoneChannelId` (existing forward map) for DRY — iterating `ALL_ZONES` (canonical zone list at `compose/composer.ts:87`) and returning the first match. `getCodexAnchorForZone` returns `ZONE_FLAVOR[zone]` directly. No duplication of zone metadata.

**Files Created/Modified:**
| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `apps/bot/src/lib/channel-zone-map.ts` | Created | 47 | Reverse map + metadata accessor |

**Deviations from Plan:** Spec example used a hand-rolled `ZONE_CHANNEL_FORWARD: Record<ZoneId, keyof Config>` constant that re-states the forward mapping. I chose to delegate to `getZoneChannelId` instead — single source of truth at `config.ts:166-177`. Functionally equivalent; lower drift risk if env-key names change.

### Task 1.2 (bd-1kr): Decide `getCodexAnchorForZone` data source (sync constant for V1)

**Status:** Complete
**Decision:** V1 reads from `ZONE_FLAVOR` (sync constant at `packages/persona-engine/src/score/types.ts:53-58`). Async-MCP path (`codex-mcp lookup_zone`) is a Phase D extension — chat-mode doesn't currently access codex-mcp; once Sprint 3 wires that through, callers can choose to refine metadata at compose time, but `getCodexAnchorForZone` itself stays sync. Decision documented inline at `apps/bot/src/lib/channel-zone-map.ts:38-44`.

**Rationale:** Keeps Sprint 1 hermetic (zero new runtime deps); `ZONE_FLAVOR` already carries everything `getCodexAnchorForZone` needs to return; a sync accessor is a strictly broader contract than an async one (callers can always wrap a sync read in `Promise.resolve` if they need uniformity later).

### Task 1.3 (bd-2bf): Create smoke script asserting forward+reverse round-trip across 4 zones

**Status:** Complete
**Approach:** Mirror existing `apps/bot/scripts/smoke-interactions.ts` shape — assertion-counting smoke with explicit `process.exit(failures > 0 ? 1 : 0)` for CI gating. Three assertion groups: forward+reverse round-trip (4 zones), unknown channel ID (1 case), metadata completeness (4 zones × 3 fields). 9 assertions total.

**Files Created/Modified:**
| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `apps/bot/scripts/smoke-zone-map.ts` | Created | 70 | CI-gateable smoke covering all ACs |

---

## Technical Highlights

### Architecture Decisions

1. **Delegate, don't duplicate** — `getZoneForChannel` calls `getZoneChannelId` per zone rather than maintaining a parallel `Record<ZoneId, keyof Config>` constant. This keeps `config.ts:166-177` as the single source of truth for the zone↔channel binding. If a future env-key rename happens, only the switch in `config.ts` needs editing.

2. **Sync metadata accessor** — `getCodexAnchorForZone` is a sync read from `ZONE_FLAVOR`. Phase D will introduce codex-mcp `lookup_zone` as a chat-mode tool; that's a different access pattern (operates per-character, runtime fetch) and belongs in `compose/environment.ts` (Sprint 2), not in this lib module. Keeping the lib accessor sync widens the contract.

3. **Workspace import path** — used `@freeside-characters/persona-engine` root barrel (matching existing `apps/bot/src/*.ts` imports) rather than the deeper `@freeside-characters/persona-engine/config` and `/types` paths shown in the spec example. Both are valid per the package's `exports` map; the root barrel matches existing conventions in the bot app.

### Security Considerations

- `channelId` arg comes from Discord interaction payload (already Ed25519-verified at `apps/bot/src/discord-interactions/dispatch.ts`). Reverse-map functions are pure with no side effects; no new trust boundaries introduced.
- No secrets, network calls, or filesystem access. The `Config` arg is read-only.

### Integration Points

Future consumers (Phase C / Sprint 2):
- `packages/persona-engine/src/compose/environment.ts` — `buildEnvironmentContext({channelId, ...})` will call `getZoneForChannel` to resolve the channel, then `getCodexAnchorForZone(zone)` to inject the emoji + name + dimension into the `## Environment` block

---

## Testing Summary

### Test Files Created

| Test File | Type | Scenarios | Status |
|-----------|------|-----------|--------|
| `apps/bot/scripts/smoke-zone-map.ts` | Smoke (CI-gateable) | 9 assertions across 3 groups | All passing |

### Scenarios Covered

- **Forward+reverse round-trip** (4 assertions): each of `stonehenge` / `bear-cave` / `el-dorado` / `owsley-lab` resolved correctly from its stub channelId
- **Unknown channel** (1 assertion): non-mapped channelId returns `undefined`
- **Metadata accessor** (4 assertions): each zone's `ZONE_FLAVOR` entry returns non-empty `name` / `dimension` / `emoji`

### How to Run Tests

```bash
# smoke (CI-gateable; exits 0 on pass, 1 on fail)
bun run apps/bot/scripts/smoke-zone-map.ts

# workspace typecheck
bun run typecheck
```

Smoke output (verified 2026-05-02 01:35 UTC):
```
smoke: channel↔zone reverse map (Sprint 1 / Phase B)
  ✓ ch-stonehenge-1000 → stonehenge
  ✓ ch-bear-cave-2000 → bear-cave
  ✓ ch-el-dorado-3000 → el-dorado
  ✓ ch-owsley-lab-4000 → owsley-lab
  ✓ unknown channel returns undefined
  ✓ stonehenge / bear-cave / el-dorado / owsley-lab metadata complete
✓ smoke pass · 4 zones round-trip · unknown→undefined · metadata complete
```

---

## Version Update

No `package.json` version bump for Sprint 1 — additive helper module, no public-API surface change at the persona-engine boundary. Workspace version (`0.8.0`) holds. The cycle as a whole (V0.7-A.1) will warrant a bump when Sprint 3's chat-mode MCP wiring lands; deferring the bump until then keeps the version-marker meaningful.

---

## Known Limitations

- **`getCodexAnchorForZone` is sync-only**: cannot lazily resolve from codex-mcp `lookup_zone`. By design for Sprint 1; Phase D / Sprint 3 will add codex-mcp as a chat-mode tool, at which point environment.ts can refine metadata at compose time without changing this accessor.
- **No DM/non-zone fallback metadata**: `getCodexAnchorForZone` only handles the four codex-mapped zones. Callers handling unknown channels (DMs, non-mapped channels) must check `getZoneForChannel` returns `undefined` first and provide their own fallback. Sprint 2's `buildEnvironmentContext` does this explicitly per the spec ("graceful 'outside the codex-mapped zones' with no room-read line").
- **Smoke uses stub config, not loaded `.env`**: by design — the smoke is a hermetic round-trip test, not an integration test. Production wiring is verified by the dispatch handler at runtime when `DISCORD_CHANNEL_*` env vars resolve.

---

## Verification Steps

For the reviewer to verify this implementation:

1. **Code Review:**
   - [ ] Review `apps/bot/src/lib/channel-zone-map.ts` (47 lines)
   - [ ] Review `apps/bot/scripts/smoke-zone-map.ts` (70 lines)
   - [ ] Confirm no existing source files modified: `git diff --stat HEAD~1 -- packages/ apps/bot/src/ apps/bot/scripts/` shows only the two new files (plus the planning artifacts on the prior commit)

2. **Test Execution:**
   ```bash
   bun run apps/bot/scripts/smoke-zone-map.ts   # 9 assertions, exit 0
   bun run typecheck                             # workspace clean
   ```

3. **Acceptance Criteria Check:**
   - [x] `getZoneForChannel(config, env.DISCORD_CHANNEL_STONEHENGE)` returns `'stonehenge'`
   - [x] `getZoneForChannel(config, '1234567890')` returns `undefined`
   - [x] All four zones round-trip cleanly
   - [x] `getCodexAnchorForZone('stonehenge')` returns non-empty `{ name, dimension, emoji }`
   - [x] `bun run typecheck` clean across workspace
   - [x] No existing source files modified

---

## Questions for Reviewer

1. **Delegation vs. spec-shown duplication**: I chose to delegate to `getZoneChannelId` instead of building a parallel `ZONE_CHANNEL_FORWARD: Record<ZoneId, keyof Config>` constant as the spec illustrated. Functionally equivalent; lower drift risk. Acceptable, or do you want the explicit constant for some reason (e.g., future tooling that wants to introspect the map shape)?

2. **Smoke vs. unit-test**: I wrote a smoke script (CI-gateable, `process.exit` on fail) following `apps/bot/scripts/smoke-interactions.ts` shape rather than a `bun test`-style unit test. Sprint 2 may want true unit tests once `buildEnvironmentContext` snapshot-tests land — should I retroactively port this smoke to a `*.test.ts`, or is the smoke script the right shape for this kind of check?

---

**Sprint 1 Status:** COMPLETED

*Generated by Sprint Task Implementer Agent · cycle-001 · 2026-05-02*
