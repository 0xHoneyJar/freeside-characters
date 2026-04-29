# Deploy

V0.6-D deploy shape: **1 bot account · 2 Railway services · webhook-shell pattern.** One Discord App acts as the runtime shell hosting N characters via per-channel webhooks with per-message identity override (`username` + `avatar_url`). Per Eileen's `puruhani-as-spine.md`: *"the Discord App becomes the interface/runtime shell."*

> ECS migration via `loa-freeside` is queued (see end of this doc). Railway is the active path.

## Topology

```
            github: 0xHoneyJar/freeside-characters
              │                          │
         ┌────┴───┐                ┌────┴────┐
         │  main  │                │ staging │
         │ V0.5-E │                │ V0.6-D+ │
         │ (Pat A)│                │ (Pat B) │
         └────┬───┘                └────┬────┘
              │                         │
              ▼                         ▼
         ╔═════════════╗      ╔═══════════════════════════╗
         ║prod-ruggy   ║      ║staging-shell              ║
         ╠═════════════╣      ╠═══════════════════════════╣
         ║token:       ║      ║token:                     ║
         ║ ruggy       ║      ║ ruggy (same account)      ║
         ║guild:       ║      ║guild:                     ║
         ║ THJ         ║      ║ project purupuru          ║
         ║CHARS:       ║      ║CHARS:                     ║
         ║ (n/a · V0.5)║      ║ ruggy,satoshi             ║
         ║delivery:    ║      ║delivery:                  ║
         ║ bot.send    ║      ║ webhook-shell             ║
         ║             ║      ║ (per-character avatar +   ║
         ║             ║      ║  username override)       ║
         ║manual deploy║      ║auto-deploy on push        ║
         ╚═════════════╝      ╚═══════════════════════════╝
```

| Layer | What |
|---|---|
| **bot accounts** | **1 total.** `ruggy` (already registered, `ruggy#1157`, in BOTH guilds — THJ + project purupuru). Same token used by prod-ruggy and staging-shell. The shell account name will be renamed away from "Ruggy" once the operator picks a neutral shell name. |
| **branches** | `main` = prod source (V0.5-E shape, single-character monolith). `staging` = V0.6+ source (substrate-extracted, Pattern B webhook-shell). |
| **services** | 2 Railway services. prod-ruggy ships V0.5-E ruggy to THJ via bot.send. staging-shell ships V0.6 Pattern B to project purupuru via per-channel webhooks; CHARACTERS=ruggy,satoshi means the same process loads both characters. |
| **promotion** | When V0.6-D Pattern B is prod-ready, fast-forward `staging` → `main`. prod-ruggy redeploys with `CHARACTERS=ruggy` (single-character on the new substrate). |

Same Dockerfile, same image, only ENV diverges per service.

## Build artifacts

- `Dockerfile` — Bun-based, V0.6 monorepo aware (copies persona-engine + character profiles + bot)
- `.dockerignore` — excludes `node_modules`, `.env`, `apps/bot/.run/`, `grimoires/`
- `railway.json` — points Railway at the Dockerfile + sets restart policy (ON_FAILURE, max 10)
- `apps/bot/.claude/skills/arneson/` — TTRPG-DM scene-gen skill loaded via SDK `settingSources: ['project']` (NOT excluded by `.dockerignore` — `.claude` is root-level only)

## Prerequisites

1. **Shell bot account** — `ruggy` (already registered). When the operator picks a neutral shell name, rename via Discord Developer Portal. Same token survives the rename.
2. **Bot OAuth permissions** — V0.6-D adds `MANAGE_WEBHOOKS` to the existing `Send Messages · Embed Links · Use External Emojis · Read Message History` set. Re-invite via OAuth URL OR grant per-channel via guild settings (admin → channel permissions → bot role → Manage Webhooks).
3. **Per-zone channel IDs** for both guilds
   - THJ guild `1135545260538339420` — 4 channels
   - project purupuru guild `1495534680617910396` — 4 channels (already in `.env.example`)
4. **score-mcp access** — `MCP_KEY` for zerker's `score-api/mcp` endpoint
5. **Anthropic API key** — `ANTHROPIC_API_KEY` for the Claude Agent SDK runtime
6. **Postgres access** — `RAILWAY_MIBERA_DATABASE_URL` for `midi_profiles` (wallet → identity via `freeside_auth` MCP)
7. **Character avatar URLs** — `webhookAvatarUrl` per character in `apps/character-<id>/character.json`. Target hierarchy per SDD §0.2: `assets.0xhoneyjar.xyz/freeside-characters/<id>/avatar.png`. Until that CDN cycle reaches `/freeside-characters/`, any stable HTTPS URL works (operator-uploaded). When `webhookAvatarUrl` is `null`, delivery falls back gracefully to `bot.send` under the shell's own identity — Pattern B is opt-in per-character via config.

## Local validation (before deploy)

```bash
cd freeside-characters
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

# 4. Full live Pattern B path — webhook-shell delivery to staging guild
#    (requires character.webhookAvatarUrl set in character.json + bot has MANAGE_WEBHOOKS)
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  RAILWAY_MIBERA_DATABASE_URL=postgres://… \
  DISCORD_BOT_TOKEN=… \
  DISCORD_CHANNEL_STONEHENGE=… \
  DISCORD_CHANNEL_BEAR_CAVE=… \
  DISCORD_CHANNEL_EL_DORADO=… \
  DISCORD_CHANNEL_OWSLEY_LAB=… \
  CHARACTERS=ruggy,satoshi bun run digest:once
```

## First-time setup

### 1. Grant `MANAGE_WEBHOOKS` to the shell bot

> See [`DISCORD-SETUP.md`](./DISCORD-SETUP.md) for the canonical Discord-side
> doc — invite-link generator script, full permission bitmask reference,
> intents matrix, troubleshooting. The summary below is the operator-quick
> path; consult the full doc for new guild provisioning or debugging
> 403/code 50013 errors.

Pattern B (webhook-shell · per-character avatar+username override) needs
`MANAGE_WEBHOOKS` to fetch-or-create webhooks per channel. Two paths:

**Option A — generate invite link with the right perms (cleanest):**
```bash
DISCORD_BOT_TOKEN=<bot-token> bun run scripts/print-invite-link.ts
```
Outputs an OAuth URL with `permissions=537185280` preconfigured (covers
`VIEW_CHANNEL · SEND_MESSAGES · EMBED_LINKS · ATTACH_FILES · USE_EXTERNAL_EMOJIS · MANAGE_WEBHOOKS`).
Visit URL → authorize in target guild.

**Option B — per-channel grant (no re-OAuth needed):**
- Guild Settings → Roles → bot role → Permissions → enable `Manage Webhooks`
- Or per-channel: channel settings → Permissions → bot role → enable `Manage Webhooks`

Per-channel scope is tighter security; do this in BOTH the THJ + project purupuru per-zone channels.

### 2. Upload character avatars to a stable HTTPS endpoint

Until the assets.0xhoneyjar.xyz CDN cycle reaches `/freeside-characters/`, the operator uploads avatar images to any stable HTTPS endpoint. Options:

- Direct upload to S3 in account `891376933289` under a temp prefix (e.g. `s3://thj-temp/freeside-characters/ruggy/avatar.png`) → CloudFront URL works
- GitHub raw URL on the freeside-characters repo (e.g. `https://raw.githubusercontent.com/0xHoneyJar/freeside-characters/staging/apps/character-ruggy/avatar.png`)
- Discord CDN (after uploading via the Developer Portal Avatar field) — works if you can extract the CDN URL

Once uploaded, set `webhookAvatarUrl` in `apps/character-<id>/character.json`. When the canonical CDN cycle lands `assets.0xhoneyjar.xyz/freeside-characters/<id>/avatar.png`, swap the URL in one config change.

If `webhookAvatarUrl` stays `null`, posts go via `bot.send` under the shell account's avatar — functional but loses per-character visual identity.

### 3. Provision Railway services

Railway portal → **New Project** → name: `freeside-characters`

```
# ─── service 1: prod-ruggy ──────────────────────────
Add Service → Deploy from GitHub Repo
  repo:   0xHoneyJar/freeside-characters
  branch: main                     ← V0.5-E source
  name:   "prod-ruggy"
  Settings → Source → DISABLE auto-deploy on push
    (prod stays pinned until manually bumped)

# ─── service 2: staging-shell ───────────────────────
Add Service → Deploy from same repo
  branch: staging                  ← V0.6-D+ source
  name:   "staging-shell"
  Settings → Source → KEEP auto-deploy on push
    (staging iterates forward; one process hosts both characters)
```

### 4. Set env vars per service

Per service: Settings → Variables.

#### Shared across both services

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
DISCORD_BOT_TOKEN=<ruggy bot token>
DISCORD_CHANNEL_STONEHENGE=1497618160592097464
DISCORD_CHANNEL_BEAR_CAVE=1497618042560188517
DISCORD_CHANNEL_EL_DORADO=1497618131269718106    # Discord display: "agora"
DISCORD_CHANNEL_OWSLEY_LAB=1497617952831176777

# CHARACTERS not set on V0.5-E (main has no character-loader).
# When V0.6 promotes to main, also set CHARACTERS=ruggy.
```

#### staging-shell only

```
ENV=staging
CHARACTERS=ruggy,satoshi
DISCORD_BOT_TOKEN=<same ruggy bot token as prod>
DISCORD_CHANNEL_STONEHENGE=1498822402900230294
DISCORD_CHANNEL_BEAR_CAVE=1498822450316578907
DISCORD_CHANNEL_EL_DORADO=1498822480587002038
DISCORD_CHANNEL_OWSLEY_LAB=1498822512442609694
```

Both characters fire on the same cron schedule. Pattern B's per-character webhook override means each character's posts visually appear with their own avatar+username while the shell process serves both. Since this is V0.6-D phase 1 (no router/reaction yet), characters don't @-mention or interact with each other — just cron-driven independent cadence.

### 5. Validate first deploy

After env is set, Railway redeploys. Watch staging-shell logs:

```
─── freeside-characters bot · v0.6.0-A ────────────────────────
characters:     Ruggy · Satoshi (primary: ruggy)
data:           LIVE (score-mcp)
llm:            anthropic-direct (claude-sonnet-4-6)
zones:          🗿 stonehenge · 🐻 bear-cave · ⛏️ el-dorado · 🧪 owsley-lab
digest cadence: weekly · sunday 00:00 UTC
delivery:       BOT (4/4 zones mapped: ...)
persona:        loaded (NNNNN chars · MMM codex lines)
discord:        bot client connected (Ruggy#1157)
ruggy: digest cron · 0 0 * * 0
ruggy: pop-in cron · 0 */6 * * *
```

Note: V0.6-D phase 1 dispatches all fires through the **primary** character only (the first one in `CHARACTERS`). Phase 2 (router) adds per-character cron dispatch by affinity + mention parsing. For now `CHARACTERS=ruggy,satoshi` means both load but only `ruggy` fires; satoshi loaded but quiet.

To exercise satoshi's path: change `CHARACTERS=satoshi` and redeploy briefly. Both characters use the same shared webhook per channel; satoshi's posts will appear with his per-character override (once `webhookAvatarUrl` is set).

## V0.6-D deferred to post-observation

Per operator pick 2026-04-30 (after gemini deep research dig on shell pattern), Phase 2 ships AFTER cron-driven Pattern B is observed in staging:

- **Router** (`apps/bot/src/router.ts`) — Gateway message listener; content-name parser (e.g. "satoshi, what do you make of this?" → dispatch satoshi). Design open: what does the character POST when mentioned? probably a new compose path that takes user-message context.
- **Reaction handler** (`apps/bot/src/reaction-handler.ts`) — PluralKit-canonical: react ❓ to a webhook post → bot DMs the reactor with the true author identity (character id + codex anchor). Substitutes for the right-click-profile affordance Discord webhooks lack.
- **Per-webhook burst queue** — token bucket parsing `X-RateLimit-Remaining` + `Retry-After` to handle the 5/2sec rate limit when bursts of dialogue happen in one channel. discord.js handles some of this internally but not optimally for multi-character bursts.
- **File-based JSONL memory v1** — per-character storage in `apps/bot/.run/memory/<character>/` with the 4-way matrix (human↔agent · agent→world · world→agent · agent↔agent). Cross-character read so ruggy can reference satoshi's stonehenge posts without inventing them.

These get spec'd informed by what we observe in cron-driven Pattern B. The seed §5 V0.6-D scope was speculative; observation tightens the design.

## Iteration loop

```
1. develop locally on staging branch        CHARACTERS=ruggy,satoshi
2. push to origin/staging                    auto-deploys staging-shell
3. observe in project purupuru guild         per-character voice + avatar + cadence
4. iterate freely on staging branch          prod-ruggy untouched
5. when V0.6-D proves out                    fast-forward merge staging → main
                                              + manually redeploy prod-ruggy
6. monitor THJ channels                      same code, prod identity
```

Rollback: Railway → Deployments → redeploy a prior successful build.

## Health checks

The bot doesn't expose HTTP healthz (Discord gateway client). Railway monitors process liveness; restart policy = `ON_FAILURE`, max 10 retries. Beyond that, monitor:

- `discord client ready as <name>` log on each restart
- weekly digest sweep (sunday 00:00 UTC by default)
- pop-in cadence (~1-2/day per zone)
- webhook fetch/create logs at boot (one per zone the bot posts to)

## Ephemeral state

`apps/bot/.run/emoji-recent.jsonl` (cross-process emoji-variance cache) lives on the container's writable filesystem. Resets on each deploy/restart — fine; the cache only buys within-deploy variance.

V0.6-D Phase 2 (deferred) introduces per-character JSONL memory under `apps/bot/.run/memory/<character>/`. Same ephemeral story until jani's storage architecture lands.

## Cost guidance

- Railway: 2 services × 512MB-1GB RAM × ~$5/GB/mo ≈ $5-10/mo each (~$10-20/mo total)
- Anthropic API: ~$0.05-0.20 per fire (medium effort, 4-6 tool calls).
  - prod-ruggy: weekly 4-zone sweep + ~1-2 pop-ins/day per zone ≈ $5-10/mo
  - staging-shell: 2 characters × same cadence ≈ $10-15/mo (satoshi's slower cadence per ledger reduces this in V0.6-D phase 2)
- Total: **~$25-45/mo combined** before any future scale-up

## Webhook rate limits (Pattern B specifics)

Discord enforces 5 webhook executes per 2 seconds per webhook (top-level resource, scoped to webhook_id). For typical character cadence (1-10 posts/day per character × 4 channels) this is trivial. The limit bites when:

- Multiple characters post in the same channel within a 2-second window (e.g. burst dialogue)
- A weaver-event causes coordinated cross-character posts

Phase 2's burst queue handles this with token-bucket per webhook + `Retry-After` parsing. Phase 1 relies on cron's natural pacing (digests sunday-only; pop-ins ~6h tick) which never hits the limit organically.

Cloudflare ban threshold: 10,000 invalid requests per 10 minutes terminates outbound connections from the host. Phase 1 won't approach this; only buggy retry storms would.

## ECS migration (deferred)

Steps mirror the honeyroad migration:

1. Add `world-freeside-characters.tf` to `loa-freeside/infrastructure/terraform/` with one module per service
2. Author `world-freeside-characters-secrets.tf` with the env keys (mirror Railway env)
3. Fork `loa-freeside/scripts/load-honeyroad-secrets.sh`
4. CI workflow — fork `loa-freeside/ci-templates/world-deploy.yml` into `.github/workflows/deploy.yml`
5. `terraform plan` + `terraform apply` — coordinate ALB-less variant with jani (bot doesn't need ALB)
6. Push image — first deploy via GHA workflow_dispatch
7. Validate — bot logs in CloudWatch; first cron sweep across mapped channels

ECS gives stronger isolation + observability; Railway is faster for V0.6 iteration.

## Future zones (when score-mibera adds tl + irl)

Operator confirmed prep for 5 dim zones + stonehenge hub. When tl (Timeline) and irl (Poppy Field) ship in score-mibera and Eileen names the Discord channels:

1. Add `tl` / `irl` to `packages/persona-engine/src/score/types.ts` (`ZoneId`, `ZONE_TO_DIMENSION`, `ZONE_FLAVOR`)
2. Add KANSEI vocab to `packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts`
3. Add channel ID env vars to staging-shell (and prod-ruggy when promoted)
4. Update `.env.example` + this doc

The architecture supports vocab-only zones (see gumi's `the-warehouse` in `lynch-primitives.ts`) so there's no big-bang change.

## Per-character cadence reference

| character | digest | pop-ins | weaver | notes |
|---|---|---|---|---|
| ruggy | weekly Sun 00:00 UTC, all 4 zones | ~10% per 6h tick | optional Wed mid-week, stonehenge | warm OG register · TTRPG-DM scene-gen · custom emoji |
| satoshi | optional (only on structural week-shape) | rare, only on cross-zone movement | natural register, weekly Wed | sparse · gnomic · cypherpunk-coded · NO emoji decoration |

See `apps/character-{ruggy,satoshi}/ledger.md` for full cadence specifics.

V0.6-D phase 1 limitation: only the **primary** character (first in CHARACTERS env) fires on cron. Phase 2's router adds per-character affinity dispatch.
