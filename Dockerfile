# freeside-characters — Discord persona bot (Bun runtime)
#
# Builds a long-running bot service. Same image deploys to:
#   - staging-ruggy   (project purupuru guild, ruggy bot account)
#   - staging-satoshi (project purupuru guild, satoshi bot account)
#
# Per-service ENV picks the character via CHARACTERS=<id> and which bot
# account speaks via DISCORD_BOT_TOKEN. See docs/DEPLOY.md for full env
# matrix per service.
#
# Memory: discord.js + pg pool + claude-agent-sdk subprocess. Allocate
# at least 512MB; 1GB headroom is comfortable.

FROM oven/bun:1.3-alpine AS base

WORKDIR /app

# ─── workspace metadata first — keeps layer cache hot when source ─────
# changes but deps don't. V0.6 monorepo has 5 workspaces:
#   apps/bot · apps/character-ruggy · apps/character-satoshi
#   packages/persona-engine · packages/protocol
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/
COPY apps/character-ruggy/package.json ./apps/character-ruggy/
COPY apps/character-satoshi/package.json ./apps/character-satoshi/
COPY packages/persona-engine/package.json ./packages/persona-engine/
COPY packages/protocol/package.json ./packages/protocol/

# Install production deps only. claude-agent-sdk pulls a Claude Code
# bundle (~25MB) — needed at runtime for the SDK subprocess.
RUN bun install --frozen-lockfile --production

# ─── source after deps ────────────────────────────────────────────────
# substrate (system-agent layer)
COPY packages/persona-engine ./packages/persona-engine
COPY packages/protocol ./packages/protocol

# bot runtime (loads characters, dispatches via substrate)
# includes apps/bot/.claude/skills/arneson loaded via SDK settingSources
COPY apps/bot ./apps/bot

# character profiles — markdown + json. persona.md + exemplars/ + codex
# anchors are read at runtime by persona-engine's loader. CHARACTERS env
# selects which to load.
COPY apps/character-ruggy ./apps/character-ruggy
COPY apps/character-satoshi ./apps/character-satoshi

# tsconfig for Bun's TS resolution
COPY tsconfig.json ./

ENV NODE_ENV=production

# Default command — run the bot's index.ts via Bun. The bot opens a
# Discord gateway connection + schedules cron + serves digest fires.
# Logs go to stdout; Railway captures them.
#
# Per-service overrides via ENV (set in Railway portal):
#   CHARACTERS=ruggy            (staging-ruggy service)
#   CHARACTERS=satoshi          (staging-satoshi service)
#   DISCORD_BOT_TOKEN=...       per-character bot account token
#   DISCORD_CHANNEL_*=...       per-zone channel IDs (staging guild)
CMD ["bun", "run", "apps/bot/src/index.ts"]
