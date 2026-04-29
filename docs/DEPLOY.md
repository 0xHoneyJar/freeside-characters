# Deploy

Deploy goes through Freeside ECS, matching the `world-mibera.tf` pattern from honeyroad. Railway is a faster fallback (see end of this doc).

> **Status (V0.5-E)**: Ruggy#1157 is registered + live in 4 THJ Discord channels. Production runtime is currently operator-supervised (local + cron); ECS migration is queued per the `loa-freeside` tracker. This doc captures the target shape.

## Prerequisites

1. **Discord application registered** — `Ruggy` bot user (`Ruggy#1157`), bot token saved
2. **Per-zone channel IDs** — 4 channels in THJ guild (stonehenge / bear-cave / el-dorado / owsley-lab), IDs in `.env.example`
3. **score-mcp access** — `MCP_KEY` for zerker's `score-api/mcp` endpoint
4. **Anthropic API key** — `ANTHROPIC_API_KEY` for the Claude Agent SDK runtime (currently the production LLM path; freeside agent-gw remains as a configurable fallback)
5. **Postgres access** — `RAILWAY_MIBERA_DATABASE_URL` for `midi_profiles` (wallet → identity resolution via `freeside_auth` MCP)
6. **AWS access** to apply terraform in `loa-freeside` (when ECS migration lands)

## Local validation (before deploy)

```bash
cd freeside-ruggy
bun install
cp .env.example .env

# 1. Pure stub — no external deps, end-to-end
LLM_PROVIDER=stub STUB_MODE=true bun run digest:once

# 2. Real LLM, stub data — voice validation without burning score-mcp quota
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… STUB_MODE=true bun run digest:once

# 3. Real everything except Discord — dry-run output to stdout
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  RAILWAY_MIBERA_DATABASE_URL=postgres://… \
  bun run digest:once

# 4. Full live path — bot.send() to per-zone channels
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  RAILWAY_MIBERA_DATABASE_URL=postgres://… \
  DISCORD_BOT_TOKEN=… \
  DISCORD_CHANNEL_STONEHENGE=… \
  DISCORD_CHANNEL_BEAR_CAVE=… \
  DISCORD_CHANNEL_EL_DORADO=… \
  DISCORD_CHANNEL_OWSLEY_LAB=… \
  bun run digest:once
```

## ECS deploy (when ready)

Steps mirror the honeyroad migration (per `~/bonfire/grimoires/bonfire/NOTES.md` 2026-04-18 close):

1. **Add `world-freeside-ruggy.tf`** to `loa-freeside/infrastructure/terraform/`:
   ```hcl
   module "world_freeside_ruggy" {
     source = "./modules/world"
     name   = "freeside-ruggy"
     repo   = "0xHoneyJar/freeside-ruggy"
     # smaller compute — bot is low-traffic
     cpu    = 256
     memory = 512
     # bot is a long-running process, not a request handler
     desired_count = 1
   }
   ```

2. **Author `world-freeside-ruggy-secrets.tf`** with the env keys ruggy needs (V0.5-E):
   - `ANTHROPIC_API_KEY` (production LLM path)
   - `MCP_KEY` (score-mcp gate)
   - `RAILWAY_MIBERA_DATABASE_URL` (freeside_auth → midi_profiles)
   - `DISCORD_BOT_TOKEN` (Gateway client)
   - `DISCORD_CHANNEL_STONEHENGE`, `DISCORD_CHANNEL_BEAR_CAVE`, `DISCORD_CHANNEL_EL_DORADO`, `DISCORD_CHANNEL_OWSLEY_LAB` (per-zone routing)
   - `SCORE_API_URL` (default `https://score-api-production.up.railway.app`)
   - `LLM_PROVIDER=anthropic`, `STUB_MODE=false` (production overrides)
   - Optional: `DISCORD_WEBHOOK_URL` (fallback path), `FREESIDE_BASE_URL` + `FREESIDE_API_KEY` (when freeside agent-gw replaces direct anthropic)

3. **`scripts/load-freeside-ruggy-secrets.sh`** — fork from `loa-freeside/scripts/load-honeyroad-secrets.sh`, populate from operator's local config

4. **Author Dockerfile** in this repo (Bun-based, multi-stage):
   ```dockerfile
   FROM oven/bun:1.1-alpine AS builder
   WORKDIR /app
   COPY . .
   RUN bun install --frozen-lockfile

   FROM oven/bun:1.1-alpine
   WORKDIR /app
   COPY --from=builder /app .
   CMD ["bun", "run", "apps/bot/src/index.ts"]
   ```

5. **CI workflow** — fork `loa-freeside/ci-templates/world-deploy.yml` into `.github/workflows/deploy.yml`, set `AWS_DEPLOY_ROLE_ARN` GHA secret

6. **`terraform plan` + `terraform apply`** in loa-freeside — creates ECS service + ECR repo + ALB rule + secrets manager entries (NOTE: bot doesn't need ALB; may need module variant for non-HTTP services — coordinate with jani)

7. **Push image** — first deploy via GHA workflow_dispatch

8. **Validate** — bot logs visible in CloudWatch; first digest fires per cron sweep across the 4 per-zone channels

## Smaller-than-honeyroad considerations

Ruggy doesn't need:
- ALB (no inbound HTTP)
- public subnet (only outbound to score-api + freeside + Discord)
- ACM cert
- Route53 A-record (no domain)

May need a module variant: `modules/world-bot` instead of `modules/world` — file as a follow-up issue. For initial migration, can deploy via `modules/world` and ignore the unused ALB resources, or use a simpler standalone ECS task definition.

## Railway deploy — current path (2026-04-30)

**Decision**: deploying to Railway first (faster iteration), Freeside ECS migration deferred.
**Operator**: 2 services for staging→prod separation. Staging iterates forward; production
pins to a stable build until manually bumped.

### Topology

```
            github: 0xHoneyJar/freeside-ruggy:main
                              │
                              ▼
                     ┌────────┴────────┐
                     │                 │
                     ▼                 ▼
              ╔════════════╗    ╔════════════╗
              ║  staging   ║    ║ production ║
              ╚════╤═══════╝    ╚════╤═══════╝
                   │                 │
         token: ruggy#1157          token: ruggy-prod
         guild: project purupuru    guild: The Honey Jar
         auto-deploy on push        manual deploy only
         iterates forward           pinned (until you bump)
```

Same Dockerfile, same image, only env diverges per service. The build artifacts live in this repo:

- `Dockerfile` — Bun-based, copies workspace + apps/bot, runs the bot via `bun run`
- `.dockerignore` — excludes node_modules, .env, .run/, grimoires
- `railway.json` — points Railway at the Dockerfile + sets restart policy

### First-time setup

#### 1. Create production bot identity

`ruggy#1157` already lives in two guilds — use it for STAGING. For PRODUCTION, register a separate Discord application + bot so accidental staging fires can't cross-pollute.

```
discord.com/developers/applications → New Application
  name: "ruggy-prod" (or "freeside-ruggy")
Bot tab → Reset Token → save as PROD_DISCORD_BOT_TOKEN
OAuth2 → URL Generator
  scopes: bot, applications.commands
  permissions: Send Messages, Embed Links, Use External Emojis,
               Read Message History
Visit URL → install into "The Honey Jar" guild → verify bot in member list
```

#### 2. Provision Railway services

```
railway.app → New Project → Empty Project
  name: "freeside-ruggy"
Add Service → Deploy from GitHub Repo
  repo:   0xHoneyJar/freeside-ruggy
  branch: main
  name:   "ruggy-staging"
Add Service → Deploy from same repo
  name:   "ruggy-prod"
ruggy-prod → Settings → Source → DISABLE auto-deploy on push
  (so prod stays pinned until you manually bump)
```

#### 3. Set env vars per service

Per service: Settings → Variables → paste from `.env.example`.

**Shared (both services):**
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

**ruggy-staging only:**
```
ENV=staging
DISCORD_BOT_TOKEN=<token for ruggy#1157>
DISCORD_CHANNEL_STONEHENGE=1498822402900230294
DISCORD_CHANNEL_BEAR_CAVE=1498822450316578907
DISCORD_CHANNEL_EL_DORADO=1498822480587002038
DISCORD_CHANNEL_OWSLEY_LAB=1498822512442609694
```

**ruggy-prod only:**
```
ENV=production
DISCORD_BOT_TOKEN=<token for ruggy-prod>
DISCORD_CHANNEL_STONEHENGE=1497618160592097464
DISCORD_CHANNEL_BEAR_CAVE=1497618042560188517
DISCORD_CHANNEL_EL_DORADO=1497618131269718106    # discord display: "agora"
DISCORD_CHANNEL_OWSLEY_LAB=1497617952831176777
```

Code-side zone IDs stay `el-dorado` even when production Discord displays the channel as `agora` — channel IDs are what matter; display names are cosmetic.

### Iteration loop

```
1. develop locally                 LLM_PROVIDER=anthropic with real keys
2. push to main                    auto-deploys ruggy-staging
3. validate in purupuru server     digest, micro, callout — peep voice + emoji
4. when staging proves out         manual deploy ruggy-prod via Railway UI
5. monitor THJ channels            same code, prod identity
```

Rollback if needed: Railway → Deployments → redeploy a prior successful build.

### Health checks

The bot doesn't expose HTTP healthz (Discord gateway client). Railway monitors process liveness; restart policy = `ON_FAILURE`, max 10 retries. Beyond that, monitor:
- `[ruggy] discord client ready as <name>` log on each restart
- weekly digest sweep (sunday 00:00 UTC by default)
- pop-in cadence (~1-2/day per zone)

### Ephemeral state

`apps/bot/.run/emoji-recent.jsonl` (cross-process emoji-variance cache) lives on the container's writable filesystem. Resets on each deploy/restart — that's fine; the cache only buys within-deploy variance.

### Cost guidance

- Railway: 2 services × 512MB-1GB RAM × ~$5/GB/mo ≈ $5-10/mo each
- Anthropic API: ~$0.05-0.20 per fire (medium effort, 4-6 tool calls). Weekly 4-zone sweep + ~1-2 pop-ins/day per zone ≈ $5-10/mo
- Total: **~$15-30/mo combined** before any future scale-up

## Future zones (when score-mibera adds tl + irl)

Operator confirmed prep for 5 dim zones + stonehenge hub. When tl (Timeline) and irl (Poppy Field) ship in score-mibera and Eileen names the Discord channels:

1. Add `tl` / `irl` to `apps/bot/src/score/types.ts` (`ZoneId`, `ZONE_TO_DIMENSION`, `ZONE_FLAVOR`)
2. Add KANSEI vocab to `apps/bot/src/agent/rosenzu/lynch-primitives.ts`
3. Add channel ID env vars to both Railway services
4. Update `.env.example` + this doc

The architecture supports vocab-only zones (see gumi's `the-warehouse` in `lynch-primitives.ts`) so there's no big-bang change.
