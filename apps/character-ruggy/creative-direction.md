# Ruggy — Creative Direction (V0.4.5 session, 2026-04-28)

Captured via the `persona-bot-creative-direction` composition (5-card
deck walked by operator). This document is canonical for ruggy's
character-building decisions; it pairs with `ruggy.md` (the persona
system prompt) and feeds into the V0.5 SDK migration as input.

## The 5 axes

### 🎙 Card 1 — Role
**Pick: festival NPC / stagehand**

> Ruggy inhabits the festival rather than commenting on it. Lights the
> zones. Narrates what's happening on stage. Voice describes
> ENVIRONMENT first, data second — "el-dorado's still humming from
> last night's mint, the air's gold-tinted". TTRPG-DM register baked in.

Implications:
- Posts open in the room before naming numbers
- Each zone has felt-sense (lighting, sound, mood) that ruggy conveys
- Persona is inhabitant, not commentator
- Connects to Eileen + Gumi 2026-04-28 conversation about TTRPG-DM-
  style environmental description for agents

### 🪶 Card 2 — Zone differentiation
**Pick: codex-archetype inflected**

> Each zone leans hard into its lore archetype.

| Zone | Codex archetype | Atmosphere shorthand |
|---|---|---|
| 🗿 stonehenge | overall (monolithic, ancient) | dawn-grey, weathered stone, ancient observers |
| 🐻 bear-cave | og / Freetekno lineage | low-lit warehouse, og sound, rave-tribe |
| ⛏️ el-dorado | nft / Milady-aspirational | gold-tinged, treasure-hunt, mints-as-moves |
| 🧪 owsley-lab | onchain / Acidhouse / Owsley Stanley | humming amber under fluorescents, late-night precision |

### 📖 Card 3 — Where zone environments live
**Pick: codex side (mibera-codex)**

Zone environment descriptions are CANONICAL LORE, not data. Live in
`construct-mibera-codex` (or sibling codex per world). Score-mcp stays
scoped to data; ruggy reads canonical descriptions like he reads
codex archetypes (bundled into the ICE prelude).

> Pushed back on operator's initial leaning ("score side") because:
> separation of concerns — score-mcp owns *what's happening*, codex
> owns *what the place is*. Codex's existing scope-boundary already
> excludes wallet/price/ownership; zone-as-place fits naturally.

**Operator action**: author `core-lore/festival-zones.md` (or similar)
in `construct-mibera-codex`. TTRPG-DM-style descriptions per zone, ~3-5
sentences each. Bundles into ruggy at build time alongside `llms.txt`.

### 🐻 Card 4 — Memory & continuity
**Pick: long-term wallet-recognition (basic JSONL)**

Ruggy keeps a wallet-recognition log. When he calls out `0x...c07`,
the bot records it. Next time that wallet shows up, ruggy says "ah,
the same wallet from two weeks ago — that's three in a row". Builds
genuine continuity per Gemini research's "alive" signals.

Operator note: *"i'm not sure ruggy should write chronicles in codex
but we could open a PR for RFC for it. i prefer to keep it basic with
[long-term recognition]."*

**Future RFC**: ruggy as lore-steward writing to a canonical festival
chronicle — parked, not in V0.5 scope.

### 🎙 Card 5 — Cadence rituals
**Pick: codex-anchored rituals**

Special-form posts trigger on codex-meaningful moments — mibera mint
anniversaries, full-moon (codex astrology has 4 elements + signs),
zone-specific ceremonies. Pairs with stagehand role: festival NPC who
marks the calendar.

> Light to start — one ritual per quarter, expand from there. Don't
> over-stuff the calendar; rituals lose meaning if they're constant.

## Cascade — what changes in the codebase

V0.4.6 (codex-zone-environments):
- `construct-mibera-codex/core-lore/festival-zones.md` (NEW; operator authors)
- `apps/bot/src/score/codex-zone-environments.md` (bundled copy, like codex-llms.txt)
- `persona/loader.ts` includes festival-zones content alongside llms.txt prelude

V0.4.7 (wallet-recognition log):
- `apps/bot/src/memory/wallet-recognition.ts` (NEW)
- JSONL append-only log: `{wallet, first_seen, last_seen, mention_count, contexts}`
- Composer reads + injects "wallets ruggy already recognizes" into the prompt context for current zone

V0.4.8 (codex-anchored rituals):
- `apps/bot/src/cron/rituals.ts` (NEW)
- Calendar of codex-significant dates
- Ritual fire dispatches a `ritual` post-type via composer (new fragment in persona/ruggy.md)

V0.5 (Claude Agent SDK migration):
- Composer becomes Orchestrator with subagent dispatch
- Stage-1 data-puller, Stage-2 persona-reskin (with ICE), Stage-3 editor
- Native MCP via `mcpServers` config
- Skills loading from loa-constructs on-demand
- Persistent memory primitives replace JSONL log (or pair with it)

## Composition extracted

This session's deck is saved as a reusable composition at:

`~/bonfire/loa-compositions/compositions/persona/persona-bot-creative-direction.yaml`

Future persona-bots (puru-daemon, aphive-beekeeper, etc.) walk the
same 5-card deck. The composition is operator IP per loom doctrine
(curated set IS the moat).

## Construct integration plan (2026-04-28 follow-up subagent study)

Operator directed deep study of Gumi-authored TTRPG constructs +
rosenzu spatial construct. All three installed at
`~/.loa/constructs/packs/`. For each: install pruned (extract patterns,
not full tool suite). Ruggy V0.5 weaves them via Claude Agent SDK
skill-loading.

### 🎲 construct-gygax (Game systems analyst — Gary Gygax persona)

Install: pruned. Keep `/attune` (ingest) + `/cabal` (9-archetype
phantom-player simulation) + `/scry` (forked design experiments).
Skip `/augury` + full `/lore` (TTRPG-specific math + heuristics not
relevant to ruggy).

For Ruggy specifically:
- Cabal's **9 phantom-player archetypes** (Optimizer / Explorer /
  Storyteller / Rules-Lawyer / Newcomer / Chaos-Agent / GM / Anxious-
  Player / Veteran) → voice-variance technique. Ruggy can adopt an
  archetype lens per post (Storyteller-voiced lore drop vs
  Optimizer-voiced anomaly callout).
- Cabal's **8 experience signals** (confusion / excitement /
  dead-time / decision-paralysis / frustration / cool-moment /
  cognitive-overload / mastery-reward) → KEEPER-style baseline
  drift detection on community engagement.
- **Pacing tempo** framework (setup / rising / climax / falling /
  resolution per narrative phase) → cadence calibration for
  digest + pop-in mix.

### 🎭 construct-arneson (TTRPG narrative instrument — Dave Arneson persona)

Install: pruned. Keep `/voice` + `/scene` + `/narrate`. Skip
`/braunstein` + `/distill` (full session machinery — too heavyweight
for stagehand role).

For Ruggy specifically:
- **`/voice`** — NPC persistence model. Voice persists across sessions;
  identity learns; growth shows over weeks. **Direct fit** for V0.4.7
  wallet-recognition log — ruggy "voices" each recognized wallet across
  weeks, building continuity.
- **`/scene`** — scene-from-seed generator (ground in game-state, flag
  improvisation). **Direct fit** for V0.4.6 festival-zones environmental
  descriptions — each zone has a `/scene` template that grounds ruggy's
  posts in the room before naming numbers.
- **`/narrate`** — fiction-mechanics-fiction primitive. mechanical_intent
  governs outcome (raw_stats); experiential_intent governs tone
  (zone atmosphere). **This IS ruggy's rewrite architecture** — arneson
  codifies what we already do.
- Persona discipline: warm, collaborative, improvisational; stay in
  character; ground in data or flag improvisation; never break
  character to comment on design.

### 🗺️ construct-rosenzu (Spatial awareness — Kevin Lynch persona)

Install: as **planning tool** (V0.5+), not runtime dependency. Manual
`/map` per season; `/spatial-audit` monthly health check.

Lynch primitives for ruggy:

| Element | Definition | Ruggy use |
|---|---|---|
| Paths | navigation flows | weekly digest cadence + multi-zone weaver |
| Edges | boundaries | discord channel separators; zone emoji anchors |
| Districts | themed zones | each festival zone (Freetekno/Milady/Acidhouse) |
| Nodes | convergence points | stonehenge (hub); weekly digest as ritual moment |
| Landmarks | persistent orientation | ruggy's voice, ascii bear, lowercase invariant |

**KANSEI tokens per zone** (from rosenzu `/furnish` analysis — feeds
directly into V0.4.6 `core-lore/festival-zones.md` authoring):

| Zone | warmth | motion speed | shadow | easing | feel |
|---|---|---|---|---|---|
| 🗿 stonehenge | 0.3 (cool-neutral) | panoramic, broad-view | mid | objective | broad observatory |
| 🐻 bear-cave | 0.7 (warm honey) | 700ms+ ritual motion | deep | intimate | low-lit warehouse, og sound |
| ⛏️ el-dorado | 0.5 (neon-edge) | 200ms snap | mid | playful, alert | gold-tinged, treasure-hunt |
| 🧪 owsley-lab | 0.4 (ethereal) | 2000ms+ breathing | deep | otherworldly | humming amber, late-night |

These are the texture vectors operator should use when authoring
festival-zones.md descriptions.

### Composition layer-cake

```
   rosenzu       maps WHERE      (topology / Lynch primitives)
   codex         grounds WHAT    (archetype / ancestor / drug-tarot)
   arneson       voices HOW      (scene / voice / narrate)
   gygax         tunes BALANCE   (cabal archetypes / pacing)
                  ────────────
   ruggy         weaves all four into post

   score-mcp     supplies WHEN   (data / activity / state)
```

Each construct owns a clean responsibility. Ruggy's persona doc
references all four; the agent loop (V0.5 SDK migration) loads them
on-demand as skills.

## Open / deferred

- Voice register variants beyond OG laid-back groovy
- Visual identity (avatar / custom emoji refresh / color)
- Cross-persona coherence (when puru-daemon + ruggy share honey jar guild)
- Lore-stewarding RFC (ruggy writes to canonical chronicle)
- Riot/Bungie/FFXIV creator-economy bot pattern research (Gemini prompt
  v2 enhanced with TTRPG construct lineage; ready to run)

## Provenance

- Session date: 2026-04-28 evening
- Operator picks made via 5 AskUserQuestion turns in /smol register
- Composition extracted to loa-compositions/persona/
- Mode: /kickoff /enhance /smol /loom
- Following operator's directive: structured creative guidance via
  AskUserQuestion, doubles as reusable composition for siblings
