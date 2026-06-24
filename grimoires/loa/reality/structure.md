# Structure — freeside-characters

> Annotated directory tree + module responsibilities.

```
freeside-characters/
├── apps/
│   ├── bot/                      THIN RUNTIME — loads characters, wires substrate to Discord
│   │   ├── src/
│   │   │   ├── index.ts          main entry · boot banner · 3 quest modes · auto-publish slash commands
│   │   │   ├── character-loader.ts        reads apps/character-*/character.json → CharacterConfig
│   │   │   ├── auth-bridge.ts             cycle-B sprint-1 wallet→AuthContext (491 LOC)
│   │   │   ├── auth-bridge-deps.ts        DI shim for auth-bridge
│   │   │   ├── world-resolver.ts          tenant manifest resolution
│   │   │   ├── quest-runtime.ts           QuestRuntime contract (73 LOC)
│   │   │   ├── quest-runtime-bootstrap.ts memory-mode runtime builder
│   │   │   ├── quest-runtime-production.ts Pg-backed runtime + tenant pool factory
│   │   │   ├── discord-interactions/
│   │   │   │   ├── server.ts              Bun.serve · /webhooks/discord + /health (253 LOC)
│   │   │   │   ├── dispatch.ts            slash dispatch · anti-spam · circuit breaker (1161 LOC)
│   │   │   │   ├── quest-dispatch.ts      cycle-Q quest interception
│   │   │   │   └── types.ts               Discord interaction shapes
│   │   │   ├── lib/
│   │   │   │   ├── channel-zone-map.ts    channelId → zone reverse map
│   │   │   │   ├── pg-pool-builder.ts     pg.Pool factory
│   │   │   │   └── publish-commands.ts    Discord PUT for slash registration
│   │   │   ├── cli/digest-once.ts         single-fire CLI for voice-iteration
│   │   │   └── tests/                     surface-completeness · provider-resolution · persona-tool-drift · quest-runtime-bootstrap
│   │   ├── scripts/                       operator scripts
│   │   └── package.json
│   ├── character-ruggy/          festival NPC narrator · lowercase OG · Storyteller/GM
│   │   ├── character.json
│   │   ├── persona.md            VOICE SOURCE OF TRUTH (sync to bonfire grimoires per CLAUDE.md)
│   │   ├── creative-direction.md · codex-anchors.md · voice-anchors.md · silence-register.md · ledger.md
│   │   ├── exemplars/{micro,digest,lore_drop,question,callout,weaver}/
│   │   ├── avatar.png
│   │   └── cmp-boundary.test.ts
│   ├── character-satoshi/        mibera-codex agent · sentence-case cypherpunk · Veteran/Chaos-Agent
│   │   ├── character.json        (2 slash commands: chat + imagegen)
│   │   ├── persona.md · creative-direction.md · codex-anchors.md · ledger.md
│   │   ├── exemplars/
│   │   ├── avatar.png
│   │   └── cmp-boundary.test.ts
│   └── character-mongolian/      Munkh · first mibera-as-NPC quest character · Ancient Witness/Quest Keeper
│       ├── character.json        (has quest_substrate block · 2 MCPs: codex + freeside_auth)
│       ├── persona.md · badge-spec.md · codex-anchors.md · creative-direction.md
│       └── cmp-boundary.test.ts
├── packages/
│   ├── persona-engine/           SUBSTRATE (system-agent layer · @freeside-characters/persona-engine)
│   │   ├── src/
│   │   │   ├── index.ts          PUBLIC BARREL (~230 LOC · what bot + characters import)
│   │   │   ├── types.ts          CharacterConfig + SlashCommandSpec + CabalArchetype (262 LOC)
│   │   │   ├── config.ts         Zod env schema (211 LOC · 70+ env vars)
│   │   │   ├── compose/
│   │   │   │   ├── composer.ts          composeZonePost (digest path · full MCP, maxTurns 12)
│   │   │   │   ├── reply.ts             composeReply (chat path · single-turn OR orchestrator) (1066 LOC)
│   │   │   │   ├── agent-gateway.ts     provider resolution + invoke (399 LOC)
│   │   │   │   ├── environment.ts       env-context block builder
│   │   │   │   ├── headline-lock.ts     substrate guard against LLM headline drift
│   │   │   │   ├── post-types.ts        6 post-type specs
│   │   │   │   ├── bedrock-image.ts     bedrock text-to-image
│   │   │   │   └── index.ts             unified compose() entry (V0.7-A.2)
│   │   │   ├── deliver/
│   │   │   │   ├── webhook.ts           Pattern B per-channel webhook (229 LOC)
│   │   │   │   ├── embed.ts             digest embed shape
│   │   │   │   ├── embed-with-image.ts  satoshi imagegen attachment payload (342 LOC)
│   │   │   │   ├── sanitize.ts          voice-discipline transforms (345 LOC)
│   │   │   │   ├── strip-image-urls.ts  defense-in-depth automod evasion
│   │   │   │   ├── grail-cache.ts       boot prefetch (387 LOC)
│   │   │   │   ├── grail-ref-guard.ts   anti-hallucination grail-id validator
│   │   │   │   ├── wardrobe-resolver.ts cycle-3 SCAFFOLD (returns null until token-binding fills)
│   │   │   │   ├── post.ts              deliverZoneDigest entry
│   │   │   │   └── client.ts            discord.js client lifecycle
│   │   │   ├── persona/                 buildPromptPair · buildReplyPromptPair · exemplar-loader.ts
│   │   │   ├── orchestrator/            IN-PROCESS MCP SERVERS
│   │   │   │   ├── index.ts             buildMcpServers · runOrchestratorQuery · tool-use streaming (590 LOC)
│   │   │   │   ├── _schema/             Effect.Schema MCP contract (3 files)
│   │   │   │   ├── cabal/gygax.ts       9 phantom-player archetypes
│   │   │   │   ├── emojis/              43-emoji THJ catalog (registry + server + schema)
│   │   │   │   ├── freeside_auth/server.ts  wallet↔handle/mibera_id (Pg) (532 LOC)
│   │   │   │   ├── imagegen/            Bedrock Stability (4 files)
│   │   │   │   └── rosenzu/             Lynch primitives + KANSEI vectors (860 LOC across 2 files)
│   │   │   ├── score/                   score-mcp client + raw_stats v1/v2 dual-shape types + codex-context
│   │   │   ├── cron/scheduler.ts        3-cadence node-cron (149 LOC) + per-zone fire lock
│   │   │   ├── conversation/ledger.ts   in-process ring buffer (71 LOC · 50-entry cap)
│   │   │   └── expression/              V0.12 layer: tool-mood-map · error-register · silence-register · loading-status
│   │   └── package.json
│   └── protocol/                 EMPTY placeholder (sealed-schema slot reserved per loa-org-naming-conventions)
├── docs/                         11 markdown files · 2461 lines total · ARCHITECTURE, AGENTS, CIVIC-LAYER, etc.
├── scripts/                      operator scripts
├── grimoires/                    Loa state zone (NOTES.md · sprint.md · qa/ · reality/ · etc)
├── .claude/                      Loa system zone (symlinks into .loa/ submodule)
├── .loa/                         Loa framework v1.148.0 (git submodule)
├── package.json                  bun workspaces apps/* + packages/*
├── README.md · CLAUDE.md · CHANGELOG.md
└── .env.example                  env contract
```

## Module responsibilities (one-line)

| Module | Owns | Doesn't own |
|--------|------|-------------|
| `apps/bot` | Discord lifecycle, character loading, quest runtime selection, slash auto-publish | voice, prompt composition, MCP servers, persona content |
| `packages/persona-engine` | cron, compose, deliver, MCP orchestration, voice-discipline transforms, ledger | filesystem character discovery, Discord application config |
| `apps/character-<id>` | voice (persona.md), lore anchors, exemplars, register-locks, character.json declaration | substrate behaviors, runtime, delivery |
| `packages/protocol` | (empty placeholder — sealed-schema slot reserved) | currently nothing |
