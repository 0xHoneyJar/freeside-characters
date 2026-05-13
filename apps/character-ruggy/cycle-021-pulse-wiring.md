---
title: cycle-021 ruggy-pulse — per-dimension cards wiring proposal
status: proposal (post-PR draft)
date: 2026-05-13
author: zerker + claude opus 4.7
target-pr: feat/cycle-021-pulse-tools-companion
related:
  - score-mibera PR #111 (merged 2026-05-13 — 4 pulse tools live)
  - score-mibera PR #112 (merged 2026-05-13 — primary_action verb-form fix)
---

# Cycle-021 ruggy-pulse — Per-Dimension Cards Wiring

## Scope

**4 channels, 3 of them get per-dim breakdown cards.** Stonehenge (cross-dim hub) intentionally **out of scope** this PR — different post shape, ship later.

| Discord channel | Dimension | Card content |
|-----------------|-----------|--------------|
| `bear-cave`     | og        | OG dimension breakdown |
| `el-dorado`     | nft       | NFT dimension breakdown |
| `owsley-lab`    | onchain   | Onchain dimension breakdown |
| `stonehenge`    | overall   | _Out of scope this PR — future cycle wires community-counts post here_ |

## Card layout (locked 2026-05-13)

Discord embed with structured fields. **No prose narrative** — the embed shape is the post. Cron fires → renderer pulls from `get_dimension_breakdown(window=7, dimension=X)` → posts to the zone's channel.

```
┌─[colored sidebar — dim color]──────────────────┐
│ ## <Dim> dimension · last 7 days               │
│ **<N>** events  ↑+12.5% vs prior 7d  (was <P>) │
│ <active>/<total> factors active                │
│                                                │
│ Most active · last 7d                          │
│ ```                                            │
│ • `Boosted Validator`     29  ↓-71.8%  (was 103)│
│ • `Burned Mibera`         12  ↑+50.0%  (was 8) │
│ • ... (ALL active factors, no truncation)      │
│ ```                                            │
│                                                │
│ Went quiet · active prior, 0 this period       │
│ `Beraji Staker` · `CubQuest Minter` · ...      │
│                                                │
│ pulse · <dim> · generated <ISO timestamp>      │
└────────────────────────────────────────────────┘
```

**Decisions:**

| # | Decision | Why |
|---|----------|-----|
| 1 | Discord embed, not prose | Structured fields read better for data-heavy posts; consistent week to week |
| 2 | Per-zone routing | Each dim has its own channel; readers see only their dim's signal |
| 3 | Window=7, weekly cadence | More movement signal at 7d; weekly fires keep the cards fresh without channel spam |
| 4 | Verb form (`primary_action`) | Reads as "what people are doing" not "what the factor is named". Score-mibera PR #112 wires the fallback to PRIMARY_ACTION_MAP. |
| 5 | Full top + cold lists (no truncation) | 19 onchain factors max × ~50 chars = ~950 chars, under Discord's 1024 cap. Tests verify. |
| 6 | Text-only v1; sparkline images deferred | Numbers + delta arrows carry the signal. Image-gen step is a whole new code surface; revisit if CMs ask for charts. |

## What this PR ships (already done)

| Area | File | Status |
|------|------|--------|
| Type mirrors | `packages/persona-engine/src/score/types.ts` | ✅ committed |
| Persona prompt extension | `apps/character-ruggy/character.json::tool_invocation_style` | ✅ committed |
| MCP client function | `packages/persona-engine/src/score/client.ts::fetchDimensionBreakdown()` | ✅ committed |
| Embed renderer | `packages/persona-engine/src/deliver/embed.ts::buildPulseDimensionPayload()` | ✅ committed |
| Renderer tests | `packages/persona-engine/src/deliver/embed-pulse.test.ts` | ✅ committed (5 describe blocks, snapshot-style assertions against live production data) |

## What soju wires (this PR's owner action)

The pulse renderer + client are ready. **3 plug points** in the existing pipeline:

### 1. Add a `'pulse'` PostType

File: `packages/persona-engine/src/compose/post-types.ts`

```ts
// Append to PostType union:
export type PostType =
  | 'digest'
  | 'micro'
  | 'weaver'
  | 'lore_drop'
  | 'question'
  | 'callout'
  | 'reply'
  | 'pulse';   // NEW

// Append to ALL_POST_TYPES + CRON_POST_TYPES arrays

// Add spec entry:
pulse: {
  type: 'pulse',
  useEmbed: true,
  cadence: 'weekly',
  maxLines: 30,  // accommodates full top + cold lists
  description: 'per-dimension pulse card (cycle-021) — dim breakdown + cold factors, weekly window=7d',
},
```

### 2. Wire scheduler to fire pulse per zone

File: `packages/persona-engine/src/cron/scheduler.ts`

The existing scheduler iterates over `zones` and calls `onFire({ zone, postType })`. Two ways to fire pulse weekly:

**Option A (simpler):** add a 4th cadence (pulse) parallel to digest/popIn/weaver. Independent cron expression, default `0 14 * * 1` (Monday 2pm UTC).

**Option B (cleaner):** treat pulse as a `weekly`-cadence post type that fires alongside the digest backbone. Each weekly tick fires BOTH digest + pulse per zone. Easier to operator-tune cadence later via env var.

Lean: **A**, because digests and pulses are different post types with different shapes — keeping them on independent cron lines lets you adjust pulse cadence (or drop it entirely for a season) without touching digest.

```ts
// In scheduler.ts ScheduleArgs / SchedulerHandles:
pulseExpression?: string;

// New cron task in schedule():
const pulseExpr = config.PULSE_CRON_EXPRESSION ?? '0 14 * * 1'; // Monday 2pm UTC
const pulseTask = cron.schedule(pulseExpr, async () => {
  for (const zone of zones) {
    // Skip stonehenge — out of scope this cycle (no per-dim mapping)
    if (zone === 'stonehenge') continue;
    await withZoneLock(zone, () => onFire({ zone, postType: 'pulse' }), 'pulse');
  }
});
```

### 3. Wire the handler that routes `postType: 'pulse'` to the renderer

This is wherever your `onFire` callback dispatches by `postType` — most likely in `apps/bot/src/index.ts` or similar (I didn't dig deep enough to be sure; the existing path for digest is the model). Logic:

```ts
import { fetchDimensionBreakdown } from '@persona-engine/score/client';
import { buildPulseDimensionPayload } from '@persona-engine/deliver/embed';
import { ZONE_TO_DIMENSION } from '@persona-engine/score/types';

// In the dispatcher for postType === 'pulse':
async function handlePulse(zone: ZoneId, config: Config): Promise<void> {
  const dimension = ZONE_TO_DIMENSION[zone];
  if (dimension === 'overall') return; // stonehenge — out of scope this cycle

  const response = await fetchDimensionBreakdown(config, {
    window: 7,
    dimension,
  });
  const dim = response.dimensions[0];
  if (!dim) {
    log.warn({ zone, dimension }, 'pulse: no dimension in response');
    return;
  }

  const payload = buildPulseDimensionPayload(response, dim, 7);
  await postToZoneChannel(zone, payload); // existing webhook path
}
```

## Test plan

- [x] Renderer tests pass against real production shapes (see `embed-pulse.test.ts`)
- [ ] Once wired: smoke a single pulse fire to a staging channel
- [ ] Confirm Discord renders the embed correctly (colored sidebar visible; code block monospaced; field labels readable)
- [ ] Confirm fallback `content` line shows when embeds are disabled on the client
- [ ] One full week tick — confirm 3 cards land (bear-cave, el-dorado, owsley-lab) Monday 2pm UTC

## Open items

| # | Item | Decision |
|---|------|----------|
| 1 | Stonehenge content | OUT OF SCOPE this PR. Future cycle: `get_community_counts` overall + maybe `get_recent_events` ticker. |
| 2 | Recognition callouts (`get_most_active_wallets`) | OUT OF SCOPE this PR. Future cycle: "most active this week" post type that names wallets via `freeside_auth.resolve_wallet`. |
| 3 | Cadence tuning | Default Monday 2pm UTC. Operator adjustable via `PULSE_CRON_EXPRESSION` env var. |
| 4 | LLM-prepended caption? | Defer. Embed shape is the post; no narrative layer this cycle. If CMs request "Ruggy says X" framing, add a `caption` field driven by an optional persona LLM call in a follow-up. |
| 5 | Sparkline images | Deferred per operator decision 2026-05-13. |

## Verb form note

The first production smoke (2026-05-13) showed `primary_action: null` on every factor — the score-mibera service was reading the wrong field. **Fixed in score-mibera PR #112 (merged same day)**: `pulse-dimension.service.ts` now falls back through `getPrimaryAction()` to the `PRIMARY_ACTION_MAP` table. Renderer code in this PR already handles both cases (`f.primary_action ?? f.display_name`) so it lights up automatically once the fix deploys.
