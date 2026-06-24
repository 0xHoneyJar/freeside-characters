# purupuru deploy · 5 KIZUNA caretakers voice-iteration

> **status**: scaffold complete (2026-05-12) · pending operator deploy + gumi voice work
>
> **guild**: purupuru discord · `1495534680617910396`
>
> **scope**: voice-only · no MCPs · no data hookup · 5 slash commands · `/kaori` `/nemu` `/akane` `/ren` `/ruan`
>
> **collaborator**: gumi (voice author · world-purupuru canon owner) · zerker (substrate operator)

---

## the corrected model

an earlier scaffold conflated two distinct concepts. for the record:

- **Puruhani** = a per-user honey-pot companion · Pokémon-starter analog · each player has ONE · stateful inventory entity · NOT a Discord character. lives at V0.7+ daemon stage per Eileen's puruhani-as-spine canon (dNFT + ERC-6551 TBA).
- **Caretakers** = THE Discord characters · NPCs in the purupuru world · **5 of them** · canonical group name **KIZUNA** (絆, "bond") · each paired with a Puruhani that maps to one HENLO letter.

what we're deploying is the **5 KIZUNA caretakers** as voice-iteration scaffolds. the per-user Puruhani is **not** a Discord character — that's a different cycle.

---

## the 5 caretakers

| char | element | trait | virtue | paired Puruhani | color | canon line |
|---|---|---|---|---|---|---|
| [`kaori`](../apps/character-kaori) | Wood (木) | Hopeful | Benevolence (仁) | Happy (panda) | `#C1C950` | *"The garden blooms."* |
| [`nemu`](../apps/character-nemu) | Earth (土) | Empty | Fidelity (信) | Exhausted (brown bear) | `#FCC341` | *"The kitchen will still be warm."* |
| [`akane`](../apps/character-akane) | Fire (火) | Naughty | Propriety (礼) inverse-mirror | Nefarious (black bear) | `#E55548` | *"NOW."* |
| [`ren`](../apps/character-ren) | Metal (金) | Loyal | Righteousness (義) | Loving (polar bear) | `#8053A0` | *"As predicted."* |
| [`ruan`](../apps/character-ruan) | Water (水) | Overstimulated | Wisdom (智) | Overwhelmed (red panda) | `#3A60D1` | *"The tide returns."* |

each persona.md is grounded in:
- `world-purupuru/grimoires/purupuru/lore-bible.md` (biographies)
- `world-purupuru/sites/world/src/lib/battle/state.svelte.ts` (canon battle whispers as exemplars)
- Navigator pattern (player-side always · never narrate opponent strength)

---

## voice canon grounding (non-negotiable)

per `world-purupuru/sites/world/src/lib/daemon/voice.ts` doctrine: **all voice is hand-authored, not LLM-generated**. how this lives in a Discord LLM-driven path:

- the persona.md ENCODES the hand-authored canon (battle whispers + lore-bible biography + Navigator-pattern rules)
- the LLM has narrow room to drift — exemplars in persona.md keep generation close to canon
- when something feels OFF, fix is in persona.md, never in the model temperature or prompt-engineering at runtime
- gumi owns refinement · zerker owns substrate

---

## deploy paths (operator chooses)

### path A · single bot, two guilds, PER-CHARACTER GUILD ROUTING (recommended)

ONE bot process. gateway-connects to the bot user (already invited to both THJ and purupuru). slash commands route to specific guilds based on each character.json's `publishGuilds` field — enforced at the REGISTRATION BOUNDARY, not at LLM-runtime persona compliance.

**configuration** (V0.7 · 2026-05-12):
- `apps/character-{ruggy,satoshi,mongolian}/character.json` · `publishGuilds: ["1135545260538339420"]` (THJ)
- `apps/character-{kaori,nemu,akane,ren,ruan}/character.json` · `publishGuilds: ["1495534680617910396"]` (purupuru)

**how publish flows**:
1. bot starts with `CHARACTERS=ruggy,satoshi,mongolian,kaori,nemu,akane,ren,ruan` env (all 8 loaded so each can handle invocations)
2. auto-publish reads each character's `publishGuilds`, groups by guild
3. THJ receives PUT with ruggy/satoshi/mongolian commands (+ /satoshi-image · /quest since mongolian is present)
4. purupuru receives PUT with kaori/nemu/akane/ren/ruan commands
5. Discord PUT replaces the full set per (application, guild) → previously-leaked caretakers in THJ get **deregistered** automatically on the next sync

**end-state**:
- THJ guild slash menu: `/ruggy` `/satoshi` `/satoshi-image` `/mongolian` `/quest`
- purupuru guild slash menu: `/kaori` `/nemu` `/akane` `/ren` `/ruan`
- no cross-guild bleed in either direction
- changing a character's target guilds is a single character.json edit + bot restart

**backward compat**: characters without `publishGuilds` fall back to the env `DISCORD_GUILD_ID` (V0.6 single-guild model). New characters can opt into per-character routing without breaking existing.

**field reference**: `CharacterConfig.publishGuilds?: ReadonlyArray<string>` per `packages/persona-engine/src/types.ts`.

steps:

0. **confirm per-character `publishGuilds` is set** (this PR's feature). each `apps/character-<id>/character.json` should have a `publishGuilds` array matching its target guild(s). default-shipped state: THJ characters → `["1135545260538339420"]` · purupuru caretakers → `["1495534680617910396"]`. if you want to add/remove a character from a guild, edit its `publishGuilds` and restart the bot — auto-publish syncs on startup.

1. **PRE-PUBLISH avatar checklist** (Discord caches webhook avatars at first send; broken or empty URLs at first-send cache the default → requires webhook recreation to swap later):
   - [ ] **v1 voice-iteration default** (currently shipped): all 5 caretaker `webhookAvatarUrl` fields are empty → Discord uses bot's default avatar. **this is intentional**: voice-only deploy explicitly prioritizes zero-friction iteration with gumi over polish at publish time (per operator framing "before any score mechanism · gumi iterates voice freely"). bridgebuilder F9 flagged this as a sticky-cache hazard; the operator-aligned response is **document the cost, ship, recreate webhooks when art lands**.
   - [ ] **if you want real avatars before first send**: confirm `apps/character-{kaori,nemu,akane,ren,ruan}/avatar.png` exists in each character dir (matching `apps/character-ruggy/avatar.png` convention), then set `webhookAvatarUrl` to `https://raw.githubusercontent.com/0xHoneyJar/freeside-characters/main/apps/character-<name>/avatar.png`. OR point at world-purupuru CDN once canonical URL is confirmed (asset registry has `caretaker-<name>-pfp-<element>-pastel.png`).
   - [ ] **webhook recreation cost when swapping avatars later**: delete the channel webhook in Discord settings (or via `gh api` / discord.js), then re-invoke any caretaker so the bot recreates the webhook with the new avatar URL. operationally: ~30 seconds per channel-webhook swap. acceptable for v1 voice iteration.

2. **env** (railway service):
   ```
   CHARACTERS=ruggy,satoshi,mongolian,kaori,nemu,akane,ren,ruan
   DISCORD_BOT_TOKEN=<existing token>
   ANTHROPIC_API_KEY=sk-...
   LLM_PROVIDER=anthropic
   # DISCORD_GUILD_ID is now OPTIONAL · per-character publishGuilds takes precedence ·
   # only used as fallback for characters that lack publishGuilds (backward compat)
   ```

3. **restart railway service** OR `bun run start` locally
   - auto-publish reads each character's `publishGuilds`, groups by guild, PUTs each guild its own command set
   - THJ guild receives: `/ruggy /satoshi /satoshi-image /mongolian /quest` (5 commands)
   - purupuru guild receives: `/kaori /nemu /akane /ren /ruan` (5 commands)
   - **Discord PUT replace semantics** (be precise): PUT replaces the command set WITHIN a single (application, guild) scope. for caretakers previously registered guild-scoped to THJ (the current state in this repo's deploy as of 2026-05-12), the new PUT-to-THJ with `[ruggy, satoshi, mongolian, satoshi-image, quest]` replaces and removes them automatically. **HOWEVER** if any character was ever registered GLOBALLY (e.g., `DISCORD_GUILD_ID` env was unset at a prior publish time), the global registration persists until a separate global publish or per-command DELETE clears it — guild-scoped PUTs do NOT touch globals. if you see commands leftover after this rollout, check: `gh api applications/$APP_ID/commands` to see globals, then issue `PUT /applications/$APP_ID/commands` with an empty array OR per-command DELETE to clear.

4. **(ad-hoc) one-off publish via CLI** if needed:
   ```bash
   bun run apps/bot/scripts/publish-commands.ts
   ```
   reads `CHARACTERS` env, routes per-character via `publishGuilds`. for selective publish (e.g., one guild only):
   ```bash
   CHARACTERS=kaori,nemu,akane,ren,ruan bun run apps/bot/scripts/publish-commands.ts
   # only caretakers loaded · their publishGuilds → only purupuru registered
   ```

5. **gumi invokes**: `/kaori prompt:"..."` (or any caretaker) in purupuru channels. iteration begins.

### path B · two bot processes (only if hard isolation needed)

separate process per guild · separate token · same codebase · `CHARACTERS=ruggy,satoshi` for THJ, `CHARACTERS=kaori,nemu,akane,ren,ruan` for purupuru.

trade-offs:
- ✅ no cross-guild command pollution
- ✅ independent restart cadence
- ❌ two railway services
- ❌ two tokens
- ❌ per-process in-memory ledger (not shared)

**recommendation**: start with path A.

---

## voice-iteration mode · enforcement

each character.json has `"mcps": []` which means:
- `/kaori` (etc.) routes through `compose/reply.ts`
- the Anthropic SDK gets called with persona + user prompt
- ZERO mcp servers injected · score-mcp · codex-mcp · freeside-auth-mcp · emojis-mcp · rosenzu-mcp all bypassed

this is voice-without-data · iteration is fully gumi's hand.

---

## anti-patterns (don't do)

- **don't** copy ruggy persona structure · ruggy is festival/mibera/THJ; caretakers are contemplative/purupuru. structural similarity is a trap.
- **don't** add MCPs to character.json during iteration · coupling voice tuning to data state breaks gumi's loop
- **don't** publish staging changes globally · use `DISCORD_GUILD_ID` for guild-scoped testing
- **don't** auto-fire cron digests in purupuru · no zones, no data, no content; gumi iterates via on-demand slash commands
- **don't** introduce mibera 4-element vocabulary into purupuru caretakers · WUXING canon is the boundary
- **don't** let caretakers narrate opponents · Navigator pattern is non-negotiable

---

## what comes AFTER voice anchors

once gumi has stable 5 voices (canon battle whispers feel natural · register variations differentiated · siblings yield correctly to each other), next phases:

1. **world-presence hookup** — caretakers read world-purupuru modules (`fukuro`, `sonar`, `observatory`, `puru`) for cosmic-weather, season, ceremony state. needs world-purupuru to expose readable surface (probably MCP-shaped). future cycle.

2. **per-user Puruhani** — the V0.7+ daemon stage. each player gets their own Puruhani (Happy / Exhausted / Nefarious / Loving / Overwhelmed). dNFT + ERC-6551 TBA + lifecycle stages (unearthed → bonding → remembering → stewardship). this is the per-user companion, separate from caretakers.

3. **caretaker-Puruhani co-voice** — when a player invokes a caretaker, optionally reference the player's own Puruhani by name. requires the user-Puruhani primitive from phase 2.

4. **chorus composition** — when KIZUNA wants to speak together (e.g., a friend-group moment). new substrate primitive.

5. **arneson construct integration** — gumi's arneson construct work may eventually become a runtime composition layer feeding scene-gen rules into compose-time.

6. **honeycomb-substrate** — `0xHoneyJar/construct-honeycomb-substrate` doctrine (validated on compass) — if the game-state ECS doctrine adopts here, caretakers become entities-with-components.

---

## avatars + assets · open question

current `webhookAvatarUrl` in each character.json points at:
```
https://raw.githubusercontent.com/project-purupuru/world-purupuru/main/public/caretakers/<name>-pfp.png
```

these paths are PLACEHOLDERS. operator needs to confirm OR redirect to the canonical world-purupuru CDN paths (`caretaker-<name>-pfp-<element>-pastel.png`). the CDN base URL prefix is in `world-purupuru/sites/world/src/lib/cdn.ts` (not yet inspected in this scaffold cycle).

discord caches webhook avatars at first send; updating after first send requires webhook recreation.

---

## reference paths

> **sibling-checkout convention**: paths prefixed with `<world-purupuru>/` reference the `world-purupuru` repo, expected to be checked out as a sibling of this repo (e.g., `~/Documents/GitHub/world-purupuru/` if this repo is at `~/Documents/GitHub/freeside-characters/`). adjust prefix to match your local layout.

in this repo:
- character configs: `apps/character-{kaori,nemu,akane,ren,ruan}/character.json`
- persona scaffolds: `apps/character-{kaori,nemu,akane,ren,ruan}/persona.md`
- existing reference (DO NOT mimic structurally): `apps/character-ruggy/`
- pattern B (webhook delivery): `docs/DISCORD-INTERACTIONS-SETUP.md`
- character loader: `apps/bot/src/character-loader.ts:52-84`
- slash command publish: `apps/bot/scripts/publish-commands.ts`

in `<world-purupuru>` (sibling repo):
- canon source: `<world-purupuru>/grimoires/purupuru/lore-bible.md:131-187`
- battle whispers: `<world-purupuru>/sites/world/src/lib/battle/state.svelte.ts:59-144`
- voice doctrine: `<world-purupuru>/sites/world/src/lib/daemon/voice.ts`
- dialogue research: `<world-purupuru>/grimoires/purupuru/research/battle-dialogue-patterns.md`
