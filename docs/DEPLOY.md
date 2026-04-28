# Deploy

V1 deploy goes through Freeside ECS, matching the `world-mibera.tf` pattern from honeyroad.

## Prerequisites

1. **Discord application registered** — `Ruggy` bot user, token saved
2. **Discord webhook URL** for the target channel (e.g., `#midi-watch` in Honey Jar guild)
3. **score-api endpoint** exposing `GET /v1/activity-summary` (zerker, awaiting per [loa-freeside#191](https://github.com/0xHoneyJar/loa-freeside/issues/191))
4. **Freeside agent-gateway access** — API key from jani for `freeside-ruggy` community
5. **AWS access** to apply terraform in `loa-freeside`

## Local validation (before deploy)

```bash
cd freeside-ruggy
bun install
cp .env.example .env

# Run with stubs end-to-end (no external deps)
STUB_MODE=true bun run digest:once

# Run with real score-api but stub LLM
STUB_MODE=false SCORE_API_URL=https://score-api-production.up.railway.app bun run digest:once
# (will fail until /v1/activity-summary lands — that's the gate)

# Run with real everything (LIVE)
STUB_MODE=false \
  SCORE_API_URL=... \
  FREESIDE_BASE_URL=... \
  FREESIDE_API_KEY=... \
  DISCORD_WEBHOOK_URL=... \
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

2. **Author `world-freeside-ruggy-secrets.tf`** with the env keys ruggy needs:
   - `DISCORD_WEBHOOK_URL`
   - `SCORE_API_URL`, `SCORE_API_KEY`
   - `FREESIDE_BASE_URL`, `FREESIDE_API_KEY`
   - `WORLD_ID=mibera`, `APP_ID=midi`

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

8. **Validate** — bot logs visible in CloudWatch; first digest fires per cron; webhook URL produces a post in `#midi-watch`

## Smaller-than-honeyroad considerations

Ruggy doesn't need:
- ALB (no inbound HTTP)
- public subnet (only outbound to score-api + freeside + Discord)
- ACM cert
- Route53 A-record (no domain)

May need a module variant: `modules/world-bot` instead of `modules/world` — file as a follow-up issue. For V1, can deploy via `modules/world` and ignore the unused ALB resources, or use a simpler standalone ECS task definition.

## Alternative: Railway deploy (V0.5)

If ECS coordination delays V1, Railway is a faster path matching `score-api`'s deploy pattern:

```bash
railway link
railway up
# set env vars via Railway dashboard
```

Easier ops; no Freeside infra coupling. Migration to Freeside ECS happens after V1 validates the experiment. Operator's call.
