# Entry Points — freeside-characters

> Main files, CLI commands, env requirements.

## Main entry

- `apps/bot/src/index.ts` — `main()` (lines 56-380)
  - Loaded via `bun run --cwd apps/bot start` or `bun run start` (root)
  - Boot sequence: loadConfig → loadCharacters → discord.js login → grail cache prefetch → publish slash commands → schedule cron → start interactions server → optional one-shot fire (dev/manual)

## CLI commands (root `package.json` scripts)

| Command | Action |
|---------|--------|
| `bun run dev` | dev mode (delegates to `apps/bot dev`) |
| `bun run start` | production start |
| `bun run build` | build (delegates to `apps/bot build`) |
| `bun run test` | run tests (delegates to `apps/bot test`) |
| `bun run typecheck` | typecheck persona-engine + bot |
| `bun run digest:once` | single-fire CLI (`apps/bot/src/cli/digest-once.ts`) — fires one post per zone and exits |

## Minimum-viable env (.env)

```
# stub-mode quickstart — no external deps
LLM_PROVIDER=stub
STUB_MODE=true
NODE_ENV=development
```

## Production env (typical)

```
NODE_ENV=production
ENV=production
LLM_PROVIDER=auto             # bedrock-first when AWS env present

# LLM
ANTHROPIC_API_KEY=sk-...      # dev fallback
ANTHROPIC_MODEL=claude-opus-4-7
AWS_BEARER_TOKEN_BEDROCK=...  # preferred
BEDROCK_TEXT_MODEL_ID=us.anthropic.claude-opus-4-7

# Discord
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
DISCORD_PUBLIC_KEY=...        # Ed25519 from developer portal
DISCORD_GUILD_ID=...
DISCORD_CHANNEL_STONEHENGE=...
DISCORD_CHANNEL_BEAR_CAVE=...
DISCORD_CHANNEL_EL_DORADO=...
DISCORD_CHANNEL_OWSLEY_LAB=...

# Score data
SCORE_API_URL=https://score-api-production.up.railway.app
MCP_KEY=...

# Characters
CHARACTERS=ruggy,satoshi,mongolian

# Cadence
DIGEST_CADENCE=weekly
DIGEST_DAY=sunday
DIGEST_HOUR_UTC=0
POP_IN_ENABLED=true
POP_IN_INTERVAL_HOURS=6
POP_IN_PROBABILITY=0.1
WEAVER_ENABLED=true

# Auth (cycle-B)
RAILWAY_MIBERA_DATABASE_URL=...

# Quest (cycle-Q · optional)
QUEST_RUNTIME=production
TENANT_MIBERA_DATABASE_URL=...

# Feature flags
AUTO_PUBLISH_COMMANDS=true
GRAIL_CACHE_ENABLED=true
CHAT_MODE=auto
```

## Discord developer portal

For slash commands to work, in the Discord developer portal:
1. Set Interactions Endpoint URL to your public `https://<host>/webhooks/discord`
2. Set Ed25519 public key in your env as `DISCORD_PUBLIC_KEY`
3. Bot needs MANAGE_WEBHOOKS + SEND_MESSAGES + EMBED_LINKS per channel
4. See `docs/DISCORD-INTERACTIONS-SETUP.md` for the walkthrough.
