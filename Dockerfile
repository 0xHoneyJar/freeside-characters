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

FROM oven/bun:1.3

# Switched 2026-05-26 from `oven/bun:1.3-alpine` to the Debian base for the
# Path ε cluster-events-pillar v1 canary flip. The bot's package.json
# postinstall hook (`bash scripts/fixup-events-bun.sh && (cd packages/persona-engine
# && bash ../../scripts/rebuild-events-dist.sh)` added in DEP-1 PR #105)
# requires bash + git + pnpm in the image — alpine ships none of these, leading
# to a 4-deep iterative debug loop (PRs #108/#109/#110/#111). Debian base has
# bash + git out of the box, and pnpm installs cleanly via `bun add -g`.
#
# Pre-existing context: postinstall has been failing since DEP-1 landed
# (silent because Railway kept the v0.12.0 container alive when new builds
# failed). Path ε mTLS code in PR #107 needs to actually deploy, surfacing
# the long-broken chain.
#
# The rebuild-events-dist.sh script (cluster's sovereign-code-distribution
# pattern per memory `project_sovereign-code-distribution`) clones loa-freeside
# at the cluster.eventsPin.sha + builds @0xhoneyjar/events from packages/events
# subdir via pnpm. That toolchain ships with this Debian image by default
# (apart from pnpm which we add via bun's global install).
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && bun add -g pnpm

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
# scripts/ is referenced by package.json's postinstall hook
# (bash scripts/fixup-events-bun.sh + scripts/rebuild-events-dist.sh)
# for the @0xhoneyjar/events dist rebuild. Without this COPY,
# `bun install --frozen-lockfile` fails with exit 127 at the postinstall step.
COPY scripts ./scripts

# claude-agent-sdk pulls a Claude Code bundle (~25MB) — runtime
# requirement for the persona-engine SDK subprocess (e.g.
# apps/bot/.claude/skills/arneson loaded via SDK settingSources).
#
# Note: a `--mount=type=cache,id=bun-cache,...` was tried in PRs #38/#39
# to preserve `~/.bun/install/cache` across rebuilds, but Railway's
# BuildKit parser requires a Railway-specific cacheKey prefix on the
# `id` argument (undocumented format · errors with "missing the cacheKey
# prefix from its id"). Dropped the cache mount entirely until the
# Railway-correct syntax is clarified — bun install is fast enough on
# cold builds for the current monorepo size that the cache optimization
# is non-essential.
RUN bun install --frozen-lockfile --production

ENV NODE_ENV=production

# Default command — Bun runs the bot's index.ts directly. Bot opens a
# Discord gateway connection + schedules cron + serves digest fires.
# Logs go to stdout; Railway captures them.
CMD ["bun", "run", "apps/bot/src/index.ts"]
