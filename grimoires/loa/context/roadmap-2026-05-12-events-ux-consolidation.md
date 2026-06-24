---
title: cycle-004 → cycle-006 roadmap — events silence detection · discord-native UX · multi-community fold-in
status: candidate
mode: pre-planning
created: 2026-05-12
source_session: simstim-workflow operator-DIG (2026-05-12)
threads:
  - thread-a · events pipeline silent-degradation
  - thread-c · discord-native badge/trend surfacing
  - thread-d · purupuru daemon-NFT fold-in
  - thread-e · multi-community consolidation w/ loa-freeside
expiry: until cycle-004 PRD lands OR operator revokes
use_label: usable
boundaries:
  - does not replace any active loa workflow gate
  - does not commit to cycle scope until operator promotes
---

# roadmap · cycle-004 → cycle-006

## frame

operator observed (2026-05-12): "i haven't been seeing any events being shared from the recent commit … doesn't seem like there have been any updates in the last three days … i'm seeing lower activity and new members this week … want to make sure we're surfacing this in a way that feels native to discord … if you take a look at purupuru / compass … free side characters needs to support multiple communities."

three threads pulled in parallel during DIG turn:

- **thread-a · events pipeline**: cycle-003 (PR #55) + pass-4/5 fixes shipped a correctness-clean pipeline (cursor transactional, lex-min collapse). but no eval covers the 3d-empty case. silent-degradation is the open gap.
- **thread-c · discord surfacing**: `raw_stats.spotlight` + `factor_trends` + `rank_changes` flow into compose but only as LLM-prose emoji bullets. no embed.fields[], no threaded leaderboard, no milestone @-mention, no zone thumbnail.
- **thread-d + e · consolidation**: loa-freeside cycle-C (`cycle-c-freeside-auth-substrate-2026-05-05`) generalizes sietch → multi-tenant + writes midi-link for freeside-characters to consume. compass owns daemon doctrine but mint deferred (compass PRD §0 D8). lock L-7 says **no writes to freeside-characters during cycle-C**.

operator's stated bias: "design around evals and tests, focus on what matters for actually surfacing bugs and being able to resolve them."

---

## thread-a · events pipeline silent-degradation

**current state (post pass-4/5):**
- fetch: `mcp__score__get_events_since` hourly · `ambient/live/event-source.live.ts:93-104`
- stir accumulation: `ambient/pulse.system.ts:113-189` (4-axis kansei drift · half-life 24h)
- cursor: `ambient/scheduler-task.ts:118-237` (idle-cursor advance fixed in pass-4 F2, transactional with sink in F1)
- silence gate: `ambient/router.system.ts` `isFlatWindowWithStir` + bedrock-kick · `ambient/domain/budgets.ts` `baseline_silence_minutes`
- digest cron reads stir-sibling channel from `rosenzu/server.ts:124-125`

**the bug shape (3-day silence):**
- score-mibera goes quiet → cursor pauses (`event_time` frozen, `updated_at` advances) → stir decays exponentially → by hour 72 axes float near `STIR_FLOOR 0.1`
- `isFlatWindowWithStir` was designed for "low stir on otherwise normal upstream" — has no branch for "upstream silent for N hours"
- digest composes on flat-stale stir + zero events; persona has no signal that upstream is dark vs just-quiet
- **no eval/test exercises this path.** stub mode produces synthetic events; no fixture for sustained empty result

**proposed scope (cycle-004):**
1. **verify first**: call `mcp__score__get_events_since` to confirm score-mibera is actually silent (not a fetch-path bug). resolves the 'is it real' question in one MCP call.
2. **silence detection**: add `isUpstreamSilent(hoursThreshold)` branch to `router.system.ts` — uses `cursor.event_time` lag, not stir floor. default threshold via `budgets.ts` (e.g. `silence_threshold_hours = 6`).
3. **silence surfacing**: signal flows into digest as a discrete `stir_modulation` channel reason (e.g. `upstream_silent: hours_since_last_event`). persona surface gets in-character voice for the case ("zerker been still since tuesday").
4. **eval infrastructure**: bun test fixture seeding cursor at T-72h with empty `get_events_since` response · property test asserting digest composes (or suppresses with rationale) deterministically across silence durations.
5. **observability**: stderr log line on each tick that hits `isUpstreamSilent` branch (cycle-003 NFR-29 wallet redaction respected).

**scope-bounds:**
- NOT rewriting the stir-decay model (current half-life is correct per cycle-003 D14)
- NOT changing the digest cron cadence
- NOT adding a fallback "lorem ipsum" digest — silence speaks for itself when surfaced

**deps:** none. self-contained inside `ambient/` + `compose/`.

**evals delivered:**
- 3d-silence path covered
- 6h-silence path covered
- cursor-resume-after-silence path covered
- digest composes deterministically across each

---

## thread-c · discord-native badge/trend surfacing

**current state:**
- embed builder: `packages/persona-engine/src/deliver/embed.ts:68-132` emits ONE prose embed (color + description + footer)
- compose: `packages/persona-engine/src/compose/composer.ts` LLM produces prose bullets w/ emoji decision tree per `apps/character-ruggy/persona.md:1379-1398`
- raw_stats available but unused as structured surface: `spotlight {reason: 'rank_climb' | 'new_badge'}`, `factor_trends[*] {factor_id, current_count, baseline_avg, multiplier}`, `rank_changes {climbed, dropped, entered_top_tier, exited_top_tier}`

**the gap (discord-native):**
- no `embed.fields[]` — leaderboard, badge unlock, factor spike all collapse into prose
- no threaded reply for full leaderboard (top 5 movers)
- no `@user` mention on `entered_top_tier` milestone — even when discord_username is resolvable via auth-bridge
- no zone thumbnail (atmosphere = prose only)
- no auto-reaction signaling activity-class (🔥 hot week, 🌊 drift week)
- NFT badge image never embedded — persona warns "never paste image urls" `persona.md:1085-1091` but that applies to prose body, not `embed.image` / `embed.thumbnail` fields

**proposed scope (cycle-005):**
1. **`embed.fields[]` expansion**: 1-3 structured fields per digest, mapped from `raw_stats`:
   - "🏆 top mover" — single field, name + rank delta + factor
   - "⚡ factor spike" — single field for highest `factor_trends.multiplier`
   - "🎖 new badge" — when `spotlight.reason === 'new_badge'`
2. **threaded leaderboard**: opt-in per zone — thread reply containing 5-row codeblock leaderboard (top movers by rank delta). respects mobile word-wrap (~40 chars per persona).
3. **milestone @-mention**: when `entered_top_tier[0]` resolves via auth-bridge `resolveWallet` → `discord_user_id`, mention them in the embed (anti-spam: only on first-tier-entry, not every digest). **tenant-aware** through `auth-bridge.ts` so v2 (multi-community) doesn't need rework.
4. **zone thumbnail**: 4 zone images (`stonehenge / bear-cave / el-dorado / owsley-lab`) wired to `embed.thumbnail.url`. assets need a home — likely `apps/bot/public/zones/` or hosted via `freeside-storage`.
5. **auto-reaction signal**: post-send reaction (🔥 / 🌊 / 👀) keyed on stir-class. zero-message-content, just emoji affordance.

**scope-bounds:**
- not redesigning the embed color/coordinate system (current zone-color logic is fine)
- not changing the LLM prose; structured fields COMPOSE with prose, don't replace
- tenant routing for @-mentions is v1 single-tenant (THJ guild) → v2 multi-tenant after cycle-C lands
- NFT image embed deferred to cycle-006 (depends on purupuru-assets repo)

**deps:**
- (soft) loa-freeside cycle-C for proper multi-tenant @-mention. v1 ships THJ-only.
- thread-a evals provide regression coverage for "does compose still work when stir is flat?"

---

## thread-d + e · multi-community + daemon-hosting fold-in

**current state:**
- freeside-characters is **single-community** (THJ guild · 43-emoji THJ catalog · zone-channel mapping hardcoded)
- `apps/bot/src/auth-bridge.ts` + `auth-bridge-deps.ts` already scaffold tenant resolution · `AUTH_BACKEND=anon` default
- loa-freeside cycle-C will write `midi_profiles.{discord_id, wallet_address}` linkage that freeside-characters' auth-bridge reads via `@freeside-auth`
- **cycle-C lock L-7**: no writes to freeside-characters during cycle-C
- compass owns daemon doctrine (hounfour schemas, straylight 9-step force chain) · daemon-NFT mint **DEFERRED** (compass PRD §0 D8)

**the gap (consolidation):**
- no freeside-characters PRD plans tenant-aware world manifest resolution
- zone-to-channel mapping is single-guild — needs per-tenant config
- character roster (ruggy/satoshi/mongolian) is bot-wide — needs per-tenant subset
- daemon-NFT hosting (puruhani TBA) is currently character-shaped here but NFT-shaped in compass · no integration spec
- consolidation with loa-freeside is **inherited readiness, not active scope**

**proposed scope (cycle-006 · post cycle-C):**
1. **tenant-aware world manifests**: extend `tenantResolver.resolveTenantFromGuild` to load per-tenant config (which characters, which zones, which canon vocabulary)
2. **per-tenant zone-channel mapping**: env-level `.env.example` extension for `<TENANT>_ZONE_<NAME>_CHANNEL_ID`
3. **per-tenant emoji catalog**: extend `orchestrator/emojis/registry.ts` to read per-guild
4. **daemon-NFT hosting (deferred deeper)**: integration spec with compass — how a minted daemon NFT becomes a freeside-character entity. requires compass to lift daemon-NFT-mint out of D8-deferred. **likely cycle-007+.**
5. **consolidation tests**: e2e fixture spinning up 2-tenant fake guild · digest fires deterministically per tenant · no cross-tenant leakage

**scope-bounds:**
- BLOCKED until loa-freeside cycle-C ships midi-link writes (lock L-7)
- BLOCKED on daemon-NFT mint until compass PRD §0 D8 unblocks
- NOT a sietch rewrite — sietch stays in loa-freeside, this is the freeside-characters downstream consumer

**deps:**
- loa-freeside cycle-C must merge first
- compass daemon-NFT mint integration (separate compass cycle)
- thread-c v1 (`embed.fields[]` shipping) so multi-tenant @-mention work has a surface to attach to

---

## sequencing rationale

| cycle | thread | why this order |
|---|---|---|
| **004** | thread-a (events silence detection + eval) | operator's bias: bugs + evals first. self-contained, no deps. builds eval infra used by every later cycle. cheap verify step (1 MCP call) before scope locks. |
| **005** | thread-c v1 (discord-native UX, THJ-only) | visible weekly impact. operator's "good starting point for us" framing. tenant-aware code from day 1 so v2 doesn't churn. depends on thread-a evals (regression safety). |
| **006** | thread-d + e (consolidation PRD + tenant routing) | unblocked after cycle-C lands. compass daemon-NFT may still be blocked → that piece slips to cycle-007. |

**rationale anti-patterns avoided:**
- not starting with the strategic PRD (thread-d+e) — premature, blocked, low signal
- not starting with thread-c — would build embed surface without eval coverage and without verify on whether thread-a is masking real bugs
- not bundling thread-a + thread-c — different surfaces, different test shapes, different reviewer concerns

---

## open questions (operator pair-point)

1. **thread-a verify mechanism**: should i propose a one-shot script (e.g. `scripts/verify-score-events.ts`) that calls `mcp__score__get_events_since` for the last 72h and prints event count + timestamps? or do you want to do that out-of-band?
2. **thread-a silence threshold**: 6h default seems right (matches score-mibera's 6h bronze ingestion ceiling). agree or different?
3. **thread-c thumbnail assets**: do zone images exist anywhere (purupuru-assets? freeside-storage?) or do we need to generate them as part of cycle-005?
4. **thread-c milestone @-mention**: v1 stays THJ-only — is that acceptable, or do we wait for cycle-C and ship full tenant-aware mentions in cycle-005?
5. **thread-d+e scope-bounds**: should cycle-006 INCLUDE the daemon-NFT integration spec (collaborate with compass) or strictly handle multi-community first (and let daemon hosting be its own future cycle)?

---

## what's NOT in this roadmap

- backfill of cycle-003 deferred items (S4.T1 chat-mode reply injection, S4.T4 BUTTERFREEZONE regen, S2.T5 dep install, property test infra) — these stay in their respective tracker (PRD §9.2 tech debt addendum) and may slot into any of cycle-004/005/006 opportunistically per MAY-LATITUDE-2
- new characters beyond ruggy/satoshi/mongolian
- chat-mode (slash-command) UX changes
- sietch (loa-freeside) implementation — fully owned upstream
- compass card-game integration

---

## next concrete moves (if operator promotes this brief to active)

1. operator confirms: cycle-004 = thread-a · cycle-005 = thread-c v1 · cycle-006 = thread-d+e
2. operator answers open questions 1-5
3. assistant runs the score-side verify call (open question 1 resolved)
4. assistant enters simstim-workflow Phase 1 (DISCOVERY) for cycle-004 — translates this thread-a section into a proper PRD
5. roadmap brief frontmatter updates to `status: active` once cycle-004 PRD lands
