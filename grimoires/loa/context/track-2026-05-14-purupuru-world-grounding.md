---
title: purupuru world-grounding — Zone→Room rename + Tsuheji re-theme + caretaker fold-in
status: candidate
mode: pre-planning
created: 2026-05-14
source_session: /update-loa session — operator embodied, DIG turn
expiry: when the world-grounding cycle PRD lands OR operator revokes
use_label: usable
boundaries:
  - does not replace any active loa workflow gate — this is a pre-planning brief, /plan still required
  - does not commit cycle scope until operator promotes status→active
  - does not touch the cycle-004 substrate-refactor-eval-harness branch's scope (separate concern)
  - does not redefine "World" / "Room" in freeside-worlds or honeycomb — adopts their sealed vocabulary
related-doctrine:
  - freeside-worlds/packages/protocol/world-manifest.schema.json ($defs/Room — the sealed term)
  - construct-honeycomb-substrate (four-folder domain/ports/live/mock — "World" as ECS layer)
  - construct-rooms-substrate (the OTHER "room" — agent-invocation boundary; different domain)
  - vault/wiki/concepts/freeside-modules-as-installables.md (the installable doctrine)
  - grimoires/loa/context/roadmap-2026-05-12-events-ux-consolidation.md (thread-d purupuru fold-in)
---

# track · purupuru world-grounding

## frame

operator framing (2026-05-14 in-session):

> "Freeside is intended to be the deployer of worlds … the idea of being
> able to deploy many apps, many areas within your apps, all encapsulated
> within a broader brand or a broader world … these places, canonical
> zones, are areas within our places … naming is a pretty important thing
> for us so we don't end up where wording is not clear … we're going for
> domain-driven design, and there will be times where words are used in
> different ways in different domains."

The ask: re-theme freeside-characters' Discord channels from their current
mibera-flavored names (`stonehenge` / `bear-cave` / `el-dorado` /
`owsley-lab`) to the **purupuru / Tsuheji** world — because the environment
block (`compose/environment.ts`) feeds place-identity into *every* persona
system prompt, so the place genuinely reshapes voice. And do it with
vocabulary discipline, because "zone" is a muddy term across domains.

This is one instance of a general pattern: freeside deploys *worlds*
(purupuru, mibera, sprawl…), each with composable internal places.

## the vocabulary landscape (DIG payoff)

| term | domain | means |
|---|---|---|
| **World** | freeside-worlds / honeycomb-substrate | a branded universe — `world-{slug}` repo. purupuru/Tsuheji is one; mibera, apdao, sprawl are siblings. honeycomb also uses "World" as the ECS architectural layer. |
| **Room** | freeside-worlds `world-manifest.schema.json` (**sealed schema**) | a named place *within* a world. `$defs/Room` carries a `kind` per world-funnel-topology: Doors (entry surfaces) · Landing (first-touch) · Identity (bonding) · Depth (replay/build). Reserved for v1.1+ when a Freeside Navigation System reads it at runtime. |
| **Room** | construct-rooms-substrate / OperatorOS | an isolated agent-invocation boundary. **Different domain (agent-infra)** — acceptable DDD overlap with a clean boundary. |
| **Zone** (`ZoneId`) | freeside-characters code today | a Discord channel. The muddy local term being retired. |
| **Named Location** | purupuru `lore-bible.md` | the actual content — Sora Tower, Sky-eyes Dome, Musubi Station, The Golden Veil, etc. |
| **node / district / edge / inner_sanctum** | rosenzu spatial primitives (already in `primitive-weights.ts` + `ZONE_SPATIAL`) | the spatial *archetype / feel* of a place — drives `deriveTemperature` / `deriveSocialDensity` in `environment.ts`. |

## locked decisions (operator, 2026-05-14)

1. **Term — adopt `Room`.** `ZoneId → RoomId`, `ZONE_FLAVOR → ROOM_FLAVOR`,
   `ZONE_SPATIAL → ROOM_SPATIAL`. freeside-characters speaks the sealed
   schema's word. Zero translation layer. The rooms-substrate "room" is a
   different domain with a clean boundary.
2. **Topology — both (agent's call).** rosenzu archetype stays the *active*
   driver for env.ts feel. `Room.kind` (Doors/Landing/Identity/Depth) gets
   *declared* in the room manifest but **not yet consumed** — mirrors how
   `world-manifest` itself says "v1.0 accepts but does not consume" rooms.
   Each Room carries both fields.
3. **Source of truth — local manifest, swap-ready.** freeside-characters
   ships `worlds/purupuru.rooms.ts` shaped to `world-manifest.schema.json`'s
   `$defs/Room`. When purupuru is registered in `freeside-worlds/registry`,
   swap to consuming it. ⚠️ **Registry gap**: today the registry holds only
   `apdao / mibera / midi / rektdrop` — **purupuru and sprawl are NOT
   registered.** Operator wants purupuru/mibera/sprawl as the focus worlds.
   → registering purupuru is a parallel task (see open questions).
4. **Scope — full fold-in incl. caretakers.** Re-theme channels + rename
   code term + env.ts grounding + bind the 5 elemental caretakers to home
   Rooms so environment shapes their voice.

## canonical world data

### the 5 KIZUNA caretakers (already specced in `apps/character-*/character.json`)

HENLO letters spell **H-E-N-L-O**:

| caretaker | element | virtue | letter | color | archetypes | puruhani pair |
|---|---|---|---|---|---|---|
| **Kaori** | Wood 木 | Benevolence 仁 | H (hopeful) | #C1C950 | Gardener / Companion | Happy |
| **Nemu** | Earth 土 | Fidelity 信 | E (empty) | #FCC341 | Wanderer / Quiet-One | Exhausted (brown bear) |
| **Akane** | Fire 火 | Propriety 礼 | N (naughty) | #E55548 | Trickster / Risk-Taker | Nefarious (black bear) |
| **Ren** | Metal 金 | Righteousness 義 | L (loyal) | #8053A0 | Scholar / Loyalist | Loving (polar bear) |
| **Ruan** | Water 水 | Wisdom 智 | O (overstim.) | #3A60D1 | Artist / Empath | Overwhelmed (red panda) |

All 5 currently `stage: character` voice-iteration scaffolds (persona.md +
character.json + README.md only — no codex-anchors, no tests, not wired
into the runtime roster). All declare `publishGuilds: ["1495534680617910396"]`
— **a purupuru-specific Discord guild, separate from the THJ guild** where
ruggy/satoshi live.

### purupuru Named Locations (from `world-purupuru` lore-bible)

Hōrai (the main city) + Old Hōrai (underground). ~18 named places. Strongest
Room candidates: Musubi Station (train hub), Sky-eyes Dome (observatory atop
Sora Tower), The Golden Veil / Kinsha (honey district), Gateway Cafe (base of
Sora Tower, "first stop for visitors"), Kiln & Kettle (earthy pottery cafe),
Spiderweb Mall (maze + open plaza), Amber Garden, Konka Market, Old Hōrai
(underground — the Puru Cult).

## proposed Room model — DIG-drafted, **rosenzu to refine**

Operator asked to collaborate with **rosenzu** (`mapping-topology` +
`naming-rooms` skills) on the spatial composition. The mapping below is a
DIG-proposed starting point, NOT a locked design — rosenzu owns the final
archetype / kind / home-binding matrix.

Candidate: **6 Rooms = 5 caretaker homes + 1 shared hub** (matches the
`.env.example` note already in the codebase: "prep for 5 dim zones + hub = 6").
ruggy / satoshi / mongolian stay roamers (no home Room).

| Room (place) | candidate archetype | candidate Room.kind | home caretaker | resonance |
|---|---|---|---|---|
| **Gateway Cafe** | node | Landing | — (shared hub) | "first stop for visitors and residents" — literally the landing |
| **Sky-eyes Dome** | inner_sanctum | Depth | **Ren** (Metal/Scholar) | observatory = data, stars, science — the scholar's home |
| **Musubi Station** | edge | Doors | **Ruan** (Water/Artist) | the chime = "oldest recorded melody"; music; connection; transit-depth |
| **The Golden Veil** | district | Identity | **Kaori** (Wood/Gardener) | terraced apiaries, cultivation, growth |
| **Kiln & Kettle** | district | Identity | **Nemu** (Earth/Quiet) | earthy decor, pottery, heritage — Earth element literal, quiet warmth |
| **Spiderweb Mall** | district | Doors | **Akane** (Fire/Trickster) | maze of tight alleys + open plaza — high-energy trickster playground |

Open design tensions for rosenzu: (a) 6 Rooms means 3× `district` — the
current code has exactly one of each archetype; expanding needs an archetype
that repeats cleanly; (b) places are not inherently elemental, so
caretaker→place binding is interpretive — rosenzu should pressure-test it;
(c) whether the THJ-guild rooms (ruggy/satoshi) and the purupuru-guild rooms
share one manifest or are per-guild.

## blast radius

`RoomId` is a typed enum threaded through ~10+ files: `score/types.ts`
(`ZoneId`, `ZONE_FLAVOR`), `orchestrator/rosenzu/lynch-primitives.ts`
(`ZONE_SPATIAL`, `SpatialZoneId`), `config.ts`, `compose/composer.ts`
(`ALL_ZONES`), `compose/environment.ts`, `ambient/domain/event.ts`,
`ambient/domain/primitive-weights.ts`, `ambient/domain/canon-vocabulary.ts`,
plus tests + `.env.example` channel-id keys. Plus: new `worlds/` manifest
dir, 5 caretaker character wirings, a purupuru-guild surface in apps/bot.
ARCH-mode, high blast radius — needs PRD/SDD/sprint.

## open questions (operator pair-point)

1. **Sequencing** — new dedicated cycle via `/plan`? Or fold into a later
   cycle? It's distinct from cycle-004 (substrate-refactor-eval-harness) and
   overlaps cycle-006 (roadmap thread-d "purupuru daemon-NFT fold-in"). Best
   read: this IS cycle-006 pulled forward and reshaped — confirm.
2. **purupuru registration** — register `world-purupuru` in
   `freeside-worlds/registry` as part of this cycle (cross-repo PR +
   COSMOGRAPHER authoring), or ship the local manifest now and register
   later? Same question for `sprawl`.
3. **Guild model** — do the 5 caretakers (purupuru guild) and ruggy/satoshi
   (THJ guild) share one Room manifest, or one manifest per world/guild?
   This is the multi-community shape — leans toward per-world manifests.
4. **Room count** — confirm 6 (5 homes + hub), or different? rosenzu pass
   may argue for a different set.
5. **Bot identity** — `Ruggy#1157` is still the shell account name (rename
   to "Freeside" was deferred to V0.7-A.6). Does world-grounding pull that
   rename forward, or stay deferred?

## recommended next moves (if operator promotes this brief)

1. operator answers open questions 1–5; promotes frontmatter `status→active`
2. **rosenzu collaboration**: invoke `mapping-topology` + `naming-rooms` to
   harden the Room model (archetype / kind / caretaker-home matrix)
3. `/plan` — translate this brief + the rosenzu map into a cycle PRD
4. (parallel) decide purupuru registration path with freeside-worlds

---

## RESOLVED (operator, 2026-05-14)

Open questions closed in-session:

1. **Sequencing** — NOT a separate cycle. **Combined into cycle-004**
   (`grimoires/loa/prd.md`, `simstim-20260513-b7126e67`). World-grounding +
   substrate-refactor are one edit through the same files. Run via `/simstim`.
2. **Server scaffolding is OUT of scope here** — pulled to the `discord-deploy`
   zone, filed as **[freeside-cli#14](https://github.com/0xHoneyJar/freeside-cli/issues/14)**.
   freeside-characters is a *consumer* of that chain, never a scaffolder.
3. **Guild model** — per-world manifests. The Codex→World→Server authority
   chain: per-world Codex (`construct-{world}-codex`) *informs* the
   world-manifest, which *guides (not enforces)* the server-manifest. The
   server is final authority for its own instance. Validation is fuzzy +
   coverage-gap-logging (`codex-mcp validate_world_element`), never rejecting.
4. **Room count** — 6 confirmed (5 caretaker homes + Gateway Cafe hub).
   Caretaker↔Room bindings stay **rosenzu-to-confirm** (refined in Phase 1 via
   `mapping-topology` / `naming-rooms` — "directionally correct" per operator).
5. **Bot identity** — bot is currently named **Loa**. Rename deferred — "figure
   this out later." Not in this cycle.

### the 6 Rooms — Discord channel IDs (purupuru guild `1495534680617910396`)

Operator-created 2026-05-14. These feed the `RoomId` manifest (`RoomManifestPort`
v1 `live` adapter — local `worlds/purupuru.rooms.ts` shaped to
`world-manifest.schema.json` `$defs/Room`).

| RoomId | display | channel ID | candidate archetype / kind | home caretaker |
|---|---|---|---|---|
| `gateway-cafe` | ☕gateway-cafe | `1498822402900230294` | node / Landing | — (hub) |
| `sky-eyes-dome` | 🔭sky-eyes-dome | `1498822450316578907` | inner_sanctum / Depth | Ren (Metal) |
| `musubi-station` | 🚉musubi-station | `1498822480587002038` | edge / Doors | Ruan (Water) |
| `golden-veil` | 🍯golden-veil | `1498822512442609694` | district / Identity | Kaori (Wood) |
| `kiln-and-kettle` | 🏺kiln-and-kettle | `1504543404065947762` | district / Identity | Nemu (Earth) |
| `spiderweb-mall` | 🕸️spiderweb-mall | `1504543433740652615` | district / Doors | Akane (Fire) |

archetype / kind / caretaker-home columns are DIG-proposed — rosenzu confirms in Phase 1.
