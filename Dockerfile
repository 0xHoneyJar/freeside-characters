# freeside-characters — Discord persona bot (Bun runtime)
#
# Builds a long-running bot service. The image contains ALL characters;
# per-service ENV selects which to instantiate at runtime via CHARACTERS
# (comma-separated character ids). Adding a new character requires ZERO
# Dockerfile edits — bun's workspace globs auto-discover it.
#
# Per-service ENV (set in Railway portal):
#   CHARACTERS=ruggy            staging-ruggy service
#   CHARACTERS=satoshi          staging-satoshi service
#   CHARACTERS=mongolian        staging-mongolian service (V0.7-A.x cycle-3)
#   CHARACTERS=ruggy,satoshi    multi-character service
#   DISCORD_BOT_TOKEN=...       per-character bot account token
#   DISCORD_CHANNEL_*=...       per-zone channel IDs
#
# Memory: discord.js + pg pool + claude-agent-sdk subprocess. Allocate
# at least 512MB; 1GB headroom is comfortable.

FROM oven/bun:1.3-alpine

WORKDIR /app

# Monorepo workspace shape · root package.json declares:
#   "workspaces": ["apps/*", "packages/*"]
# so adding `apps/character-{slug}/` is auto-discovered by bun and
# auto-included in the image. Single surface for character roster:
# the CHARACTERS env at runtime. The Dockerfile is character-agnostic.
#
# Security note: `.dockerignore` is the security boundary for these
# wholesale copies — depth-aware patterns there exclude .env files,
# node_modules, logs, IDE caches, etc from the build context.
COPY package.json bun.lock tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

# claude-agent-sdk pulls a Claude Code bundle (~25MB) — runtime
# requirement for the persona-engine SDK subprocess (e.g.
# apps/bot/.claude/skills/arneson loaded via SDK settingSources).
# BuildKit cache mount preserves `~/.bun/install/cache` across rebuilds
# so source-only changes don't re-download the SDK bundle (addresses
# the deps-cache-invalidation trade-off documented in PR #38 review).
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

ENV NODE_ENV=production

# Default command — Bun runs the bot's index.ts directly. Bot opens a
# Discord gateway connection + schedules cron + serves digest fires.
# Logs go to stdout; Railway captures them.
CMD ["bun", "run", "apps/bot/src/index.ts"]
