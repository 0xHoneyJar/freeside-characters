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

### path A · single bot, two guilds (recommended for v1)

ONE bot process. gateway-connects to the bot user (already invited to both THJ and purupuru). slash commands published globally — discord propagates to all guilds.

- THJ guild gets: `/ruggy` · `/satoshi` (existing)
- purupuru guild gets: `/kaori` `/nemu` `/akane` `/ren` `/ruan` (new)
- THJ users could ALSO see all 5 caretakers globally · fine for v1 since each caretaker's persona declines mibera-context and stays in voice

steps:

1. **env**:
   ```
   CHARACTERS=ruggy,satoshi,kaori,nemu,akane,ren,ruan
   DISCORD_BOT_TOKEN=<existing token>
   ANTHROPIC_API_KEY=sk-...
   LLM_PROVIDER=anthropic
   ```

2. **publish slash commands**:
   ```bash
   bun run apps/bot/scripts/publish-commands.ts
   ```
   global propagation up to 1h · or scope-test first:
   ```
   DISCORD_GUILD_ID=1495534680617910396 bun run apps/bot/scripts/publish-commands.ts
   ```

3. **avatars** (placeholder URLs in each character.json currently point at `raw.githubusercontent.com/project-purupuru/world-purupuru/main/public/caretakers/<name>-pfp.png` — operator confirms the canonical CDN target, OR places fallback PNGs at those raw GitHub paths):
   - `caretaker-kaori-pfp.png`, `caretaker-nemu-pfp.png`, `caretaker-akane-pfp.png`, `caretaker-ren-pfp.png`, `caretaker-ruan-pfp.png`
   - world-purupuru CDN already has tiered assets (`caretaker-kaori-pfp-wood-pastel.png` etc.) — wire those URLs once confirmed

4. **restart**: railway redeploy OR local `bun run start`

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

- character configs: `apps/character-kaori/character.json` (etc · 5 total)
- persona scaffolds: `apps/character-{kaori,nemu,akane,ren,ruan}/persona.md`
- existing reference (DO NOT mimic): `apps/character-ruggy/`
- canon source: `/Users/zksoju/Documents/GitHub/world-purupuru/grimoires/purupuru/lore-bible.md:131-187`
- battle whispers: `/Users/zksoju/Documents/GitHub/world-purupuru/sites/world/src/lib/battle/state.svelte.ts:59-144`
- voice doctrine: `/Users/zksoju/Documents/GitHub/world-purupuru/sites/world/src/lib/daemon/voice.ts`
- dialogue research: `/Users/zksoju/Documents/GitHub/world-purupuru/grimoires/purupuru/research/battle-dialogue-patterns.md`
- pattern B (webhook delivery): `docs/DISCORD-INTERACTIONS-SETUP.md`
- character loader: `apps/bot/src/character-loader.ts:52-84`
- slash command publish: `apps/bot/scripts/publish-commands.ts`
