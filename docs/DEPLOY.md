# Deploy

V0.6 deploy shape: **2 bot accounts × 3 Railway services × branch-based prod/staging separation.** Iterate on staging without touching prod-ruggy. Promote to main when V0.6 is production-ready.

> ECS migration via `loa-freeside` is queued (see end of this doc). Railway is the active path.

## Topology

```
                  github: 0xHoneyJar/freeside-ruggy
                   │                          │
              ┌────┴───┐                ┌────┴────┐
              │  main  │                │ staging │
              │ V0.5-E │                │ V0.6+   │
              └────┬───┘                └────┬────┘
                   │                         │
                   ▼                         ▼
              ╔═════════╗      ╔═════════════╗ ╔════════════════╗
              ║prod     ║      ║staging      ║ ║staging         ║
              ║ruggy    ║      ║ruggy        ║ ║satoshi         ║
              ╠═════════╣      ╠═════════════╣ ╠════════════════╣
              ║token:   ║      ║token:       ║ ║token:          ║
              ║ ruggy   ║      ║ ruggy       ║ ║ satoshi (NEW)  ║
              ║guild:   ║      ║guild:       ║ ║guild:          ║
              ║ THJ     ║      ║ purupuru    ║ ║ purupuru       ║
              ║CHARS:   ║      ║CHARS:       ║ ║CHARS:          ║
              ║ (n/a)   ║      ║ ruggy       ║ ║ satoshi        ║
              ║manual   ║      ║auto-deploy  ║ ║auto-deploy     ║
              ║deploy   ║      ║on push      ║ ║on push         ║
              ╚═════════╝      ╚═════════════╝ ╚════════════════╝
```

| Layer | What |
|---|---|
| **bot accounts** | **2 total.** `ruggy` (already registered, ruggy#1157, in BOTH guilds — THJ + project purupuru). `satoshi` (NEW, staging-only — register before staging-satoshi service starts). |
| **branches** | `main` = prod source (V0.5-E shape, no persona-engine workspace). `staging` = V0.6+ source (substrate-extracted multi-character monorepo). |
| **services** | 3 Railway services, one per (env × character). Prod-ruggy + staging-ruggy share the same bot token but post to different guilds via different channel IDs. |
| **promotion** | When V0.6 is prod-ready, fast-forward `staging` → `main`. prod-ruggy redeploys (or keep manual gate). |

Same Dockerfile, same image, only ENV diverges per service.

## Build artifacts

- `Dockerfile` — Bun-based, V0.6 monorepo aware (copies persona-engine + character profiles + bot)
- `.dockerignore` — excludes `node_modules`, `.env`, `apps/bot/.run/`, `grimoires/`
- `railway.json` — points Railway at the Dockerfile + sets restart policy (ON_FAILURE, max 10)
- `apps/bot/.claude/skills/arneson/` — TTRPG-DM scene-gen skill loaded via SDK `settingSources: ['project']` (NOT excluded by .dockerignore — `.claude` is root-level only)

## Prerequisites

1. **Discord bot accounts**
   - `ruggy` — already registered, token saved
   - `satoshi` — register fresh (one-time, see step 1 below)
2. **Per-zone channel IDs** for both guilds
   - THJ guild `1135545260538339420` — 4 channels
   - project purupuru guild `1495534680617910396` — 4 channels (already in `.env.example`)
3. **score-mcp access** — `MCP_KEY` for zerker's `score-api/mcp` endpoint
4. **Anthropic API key** — `ANTHROPIC_API_KEY` for the Claude Agent SDK runtime
5. **Postgres access** — `RAILWAY_MIBERA_DATABASE_URL` for `midi_profiles` (wallet → identity via `freeside_auth` MCP)
6. **GitHub secrets** — already set; Railway uses GitHub OAuth integration

## Local validation (before deploy)

```bash
cd freeside-ruggy
bun install

# 1. Pure stub — substrate accepts both characters end-to-end
LLM_PROVIDER=stub STUB_MODE=true CHARACTERS=ruggy bun run digest:once
LLM_PROVIDER=stub STUB_MODE=true CHARACTERS=satoshi bun run digest:once

# 2. Real LLM, stub data — voice validation per character
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… STUB_MODE=true \
  CHARACTERS=ruggy bun run digest:once

LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… STUB_MODE=true \
  CHARACTERS=satoshi bun run digest:once

# 3. Real everything except Discord — dry-run output to stdout
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  RAILWAY_MIBERA_DATABASE_URL=postgres://… \
  CHARACTERS=ruggy bun run digest:once

# 4. Full live path — bot.send() to per-zone channels (staging guild)
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  RAILWAY_MIBERA_DATABASE_URL=postgres://… \
  DISCORD_BOT_TOKEN=… \
  DISCORD_CHANNEL_STONEHENGE=… \
  DISCORD_CHANNEL_BEAR_CAVE=… \
  DISCORD_CHANNEL_EL_DORADO=… \
  DISCORD_CHANNEL_OWSLEY_LAB=… \
  CHARACTERS=ruggy bun run digest:once
```

## First-time setup

### 1. Register satoshi bot account

```
discord.com/developers/applications → New Application
  name: "Satoshi" (display name shown to users)
  description: hermetic mediator · cypherpunk · grail #4488
Bot tab
  - Reset Token → save as $SATOSHI_DISCORD_BOT_TOKEN
  - Bot Public: ON (set per your preference; can be private)
  - Avatar: upload (operator picks — Lugano front-view image, hermes glyph,
            or codex grail #4488 art per gumi)
OAuth2 → URL Generator
  scopes: bot
  permissions: Send Messages, Embed Links, Use External Emojis,
               Read Message History
Visit URL → install into "project purupuru" guild → verify bot in member list
```

`ruggy` bot is already in both guilds — no fresh registration needed for the
ruggy services. Just reuse the existing token.

### 2. Provision Railway services

Railway portal:

```
railway.app → New Project → Empty Project
  name: "freeside-characters"

# ─── service 1: prod-ruggy ──────────────────────────
Add Service → Deploy from GitHub Repo
  repo:   0xHoneyJar/freeside-ruggy
  branch: main                               ← V0.5-E source
  name:   "prod-ruggy"
  Settings → Source → DISABLE auto-deploy on push
    (prod stays pinned until manually bumped)

# ─── service 2: staging-ruggy ───────────────────────
Add Service → Deploy from same repo
  branch: staging                            ← V0.6+ source
  name:   "staging-ruggy"
  Settings → Source → KEEP auto-deploy on push
    (staging iterates forward)

# ─── service 3: staging-satoshi ─────────────────────
Add Service → Deploy from same repo
  branch: staging                            ← V0.6+ source (shared with staging-ruggy)
  name:   "staging-satoshi"
  Settings → Source → KEEP auto-deploy on push
```

### 3. Set env vars per service

Per service: Settings → Variables.

#### Shared across all three services

```
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6
LLM_PROVIDER=anthropic
SCORE_API_URL=https://score-api-production.up.railway.app
MCP_KEY=<X-MCP-Key from zerker>
RAILWAY_MIBERA_DATABASE_URL=<from `railway variables` in mibera-dimensions>
NODE_ENV=production
LOG_LEVEL=info
```

#### prod-ruggy only

```
ENV=production
DISCORD_BOT_TOKEN=<ruggy bot token — same one used by staging-ruggy>
DISCORD_CHANNEL_STONEHENGE=1497618160592097464
DISCORD_CHANNEL_BEAR_CAVE=1497618042560188517
DISCORD_CHANNEL_EL_DORADO=1497618131269718106    # Discord display: "agora"
DISCORD_CHANNEL_OWSLEY_LAB=1497617952831176777

# CHARACTERS not set on V0.5-E (main has no character-loader); the bot is
# hardcoded ruggy. When V0.6 promotes to main, also set CHARACTERS=ruggy.
```

#### staging-ruggy only

```
ENV=staging
CHARACTERS=ruggy
DISCORD_BOT_TOKEN=<ruggy bot token — same one used by prod-ruggy>
DISCORD_CHANNEL_STONEHENGE=1498822402900230294
DISCORD_CHANNEL_BEAR_CAVE=1498822450316578907
DISCORD_CHANNEL_EL_DORADO=1498822480587002038
DISCORD_CHANNEL_OWSLEY_LAB=1498822512442609694
```

#### staging-satoshi only

```
ENV=staging
CHARACTERS=satoshi
DISCORD_BOT_TOKEN=<NEW satoshi bot token from step 1>

# satoshi's primary zone is stonehenge (cross-zone observatory).
# He visits other zones rarely. Reuse the staging channel IDs:
DISCORD_CHANNEL_STONEHENGE=1498822402900230294
DISCORD_CHANNEL_BEAR_CAVE=1498822450316578907
DISCORD_CHANNEL_EL_DORADO=1498822480587002038
DISCORD_CHANNEL_OWSLEY_LAB=1498822512442609694
```

Code-side zone IDs stay `el-dorado` even when production Discord displays
the channel as `agora` — channel IDs are what matter; display names are
cosmetic.

### 4. Validate first deploy

After env is set, Railway redeploys. Watch logs:

```bash
# in Railway portal → service → Deployments → View Logs

# Expected boot sequence (staging-ruggy):
─── freeside-characters bot · v0.6.0-A ────────────────────────
characters:     ruggy (primary: ruggy)
data:           LIVE (score-mcp)
llm:            anthropic-direct (claude-sonnet-4-6)
zones:          🗿 stonehenge · 🐻 bear-cave · ⛏️ el-dorado · 🧪 owsley-lab
digest cadence: weekly · sunday 00:00 UTC
pop-ins:        every 6h · 10% chance/zone/tick
weaver:         disabled
delivery:       BOT (4/4 zones mapped: ...)
persona:        loaded (NNNNN chars · MMM codex lines)
exemplars:      no exemplars (ICE off — rules-only voice)
discord:        bot client connected (Ruggy#1157)
ruggy: digest cron · 0 0 * * 0
ruggy: pop-in cron · 0 */6 * * *
```

Same shape for staging-satoshi (substituting `satoshi` for `ruggy` in log lines).

For prod-ruggy on V0.5-E: log lines say `ruggy:` directly (no character-loader
banner — V0.5-E predates V0.6-A's character abstraction).

## Iteration loop

```
1. develop locally on staging branch         CHARACTERS=ruggy or satoshi
2. push to origin/staging                    auto-deploys both staging services
3. observe in project purupuru guild         voice + cadence + cross-character feel
4. iterate freely on staging branch          prod-ruggy untouched
5. when V0.6 proves out                      fast-forward merge staging → main
                                              + manually redeploy prod-ruggy
6. monitor THJ channels                      same code, prod identity
```

Rollback: Railway → Deployments → redeploy a prior successful build.

## Health checks

The bot doesn't expose HTTP healthz (Discord gateway client). Railway monitors
process liveness; restart policy = `ON_FAILURE`, max 10 retries. Beyond that,
monitor:

- `discord client ready as <name>` log on each restart
- weekly digest sweep (sunday 00:00 UTC by default)
- pop-in cadence (~1-2/day per zone)

## Ephemeral state

`apps/bot/.run/emoji-recent.jsonl` (cross-process emoji-variance cache) lives
on the container's writable filesystem. Resets on each deploy/restart — fine;
the cache only buys within-deploy variance.

V0.6-D (queued) introduces per-character JSONL memory under
`apps/bot/.run/memory/<character>/`. Same ephemeral story until jani's storage
architecture lands.

## Cost guidance

- Railway: 3 services × 512MB-1GB RAM × ~$5/GB/mo ≈ $5-10/mo each (~$15-30/mo total)
- Anthropic API: ~$0.05-0.20 per fire (medium effort, 4-6 tool calls).
  - prod-ruggy: weekly 4-zone sweep + ~1-2 pop-ins/day per zone ≈ $5-10/mo
  - staging-ruggy: same cadence; iteration intensity adds ~$2-5/mo
  - staging-satoshi: SLOWER cadence per ledger (weaver-natural, weekly) ≈ $1-3/mo
- Total: **~$25-50/mo combined** before any future scale-up

## ECS migration (deferred)

Steps mirror the honeyroad migration (per `~/bonfire/grimoires/bonfire/NOTES.md`
2026-04-18 close):

1. Add `world-freeside-characters.tf` to `loa-freeside/infrastructure/terraform/` with one module per service
2. Author `world-freeside-characters-secrets.tf` with the env keys (mirror Railway env)
3. Fork `loa-freeside/scripts/load-honeyroad-secrets.sh`
4. CI workflow — fork `loa-freeside/ci-templates/world-deploy.yml` into `.github/workflows/deploy.yml`
5. `terraform plan` + `terraform apply` — coordinate ALB-less variant with jani (bot doesn't need ALB)
6. Push image — first deploy via GHA workflow_dispatch
7. Validate — bot logs in CloudWatch; first cron sweep across mapped channels

ECS gives stronger isolation + observability; Railway is faster for V0.6 iteration.

## Future zones (when score-mibera adds tl + irl)

Operator confirmed prep for 5 dim zones + stonehenge hub. When tl (Timeline)
and irl (Poppy Field) ship in score-mibera and Eileen names the Discord
channels:

1. Add `tl` / `irl` to `packages/persona-engine/src/score/types.ts`
   (`ZoneId`, `ZONE_TO_DIMENSION`, `ZONE_FLAVOR`)
2. Add KANSEI vocab to
   `packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts`
3. Add channel ID env vars to all three Railway services
4. Update `.env.example` + this doc

The architecture supports vocab-only zones (see gumi's `the-warehouse` in
`lynch-primitives.ts`) so there's no big-bang change.

## Per-character cadence reference

| character | digest | pop-ins | weaver | notes |
|---|---|---|---|---|
| ruggy | weekly Sun 00:00 UTC, all 4 zones | ~10% per 6h tick | optional Wed mid-week, stonehenge | warm OG register · TTRPG-DM scene-gen · custom emoji |
| satoshi | optional (only on structural week-shape) | rare, only on cross-zone movement | natural register, weekly Wed | sparse · gnomic · cypherpunk-coded · NO emoji decoration |

See `apps/character-{ruggy,satoshi}/ledger.md` for full cadence specifics.
