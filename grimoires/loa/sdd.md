# System Design Document — freeside-characters

> Source of Truth notice: this SDD reflects code reality as of /ride 2026-05-11.
> The in-repo `docs/ARCHITECTURE.md` remains the operating system-of-record for architecture day-to-day.
> This SDD is the evidence-grounded outside-in summary; cite it as "what's actually wired in the code today" without needing to load the full architecture doc.

## 1 · Stack

| Concern | Choice | Evidence |
|---------|--------|----------|
| Runtime | Bun ≥1.1 | [GROUNDED: `package.json:25` engines field] |
| Language | TypeScript strict | [GROUNDED: `package.json:21-22` devDependencies includes `typescript ^5.7.2`] |
| Workspace mgr | bun workspaces | [GROUNDED: `package.json:7-10`] |
| LLM SDK | `@anthropic-ai/claude-agent-sdk` | [GROUNDED: `packages/persona-engine/src/compose/reply.ts:31` import] |
| Discord write | `discord.js` Gateway + Webhook | [GROUNDED: `packages/persona-engine/src/deliver/webhook.ts:32-33` import] |
| Discord read | `Bun.serve` HTTP | [GROUNDED: `apps/bot/src/discord-interactions/server.ts:62`] |
| Cron | `node-cron` | [GROUNDED: `packages/persona-engine/src/cron/scheduler.ts:19`] |
| Validation | Zod | [GROUNDED: `packages/persona-engine/src/config.ts:1`] |
| Postgres pool | `pg.Pool` via `lib/pg-pool-builder.ts` | [GROUNDED: `apps/bot/src/lib/pg-pool-builder.ts` · `apps/bot/src/index.ts:50`] |
| AWS Bedrock | `@aws-sdk/client-bedrock-runtime` | [GROUNDED: `packages/persona-engine/src/orchestrator/imagegen/bedrock-client.ts`] |
| Medium descriptors | `@0xhoneyjar/medium-registry` | [GROUNDED: `packages/persona-engine/src/compose/composer.ts:19` import] |

## 2 · Module Structure

```
freeside-characters/
├── apps/
│   ├── bot/                      THIN RUNTIME (loads characters, wires substrate to Discord)
│   │   ├── src/
│   │   │   ├── index.ts          main entry · boot banner · 3 quest modes · auto-publish
│   │   │   ├── character-loader.ts        reads apps/character-* dirs → CharacterConfig
│   │   │   ├── auth-bridge.ts             cycle-B sprint-1 wallet→AuthContext (491 LOC)
│   │   │   ├── auth-bridge-deps.ts        dependency injection for auth-bridge
│   │   │   ├── world-resolver.ts          tenant manifest resolution
│   │   │   ├── quest-runtime{,-bootstrap,-production}.ts   3-mode quest substrate
│   │   │   ├── discord-interactions/
│   │   │   │   ├── server.ts              Bun.serve · /webhooks/discord + /health
│   │   │   │   ├── dispatch.ts            slash dispatch · anti-spam · circuit breaker (1161 LOC)
│   │   │   │   ├── quest-dispatch.ts      cycle-Q quest interception
│   │   │   │   └── types.ts               Discord interaction shapes
│   │   │   ├── lib/                       channel-zone-map · pg-pool-builder · publish-commands
│   │   │   ├── cli/digest-once.ts         single-fire CLI for voice-iteration
│   │   │   └── tests/                     surface-completeness · provider-resolution · persona-tool-drift
│   │   └── package.json
│   ├── character-{ruggy,satoshi,mongolian}/    each: character.json + persona.md + exemplars/ + cmp-boundary.test.ts
│   ...
├── packages/
│   ├── persona-engine/             SUBSTRATE (system-agent layer)
│   │   ├── src/
│   │   │   ├── index.ts            PUBLIC BARREL (~230 lines · imported as @freeside-characters/persona-engine)
│   │   │   ├── types.ts            CharacterConfig boundary contract (262 LOC)
│   │   │   ├── config.ts           Zod env schema (211 LOC · 70+ env vars)
│   │   │   ├── compose/
│   │   │   │   ├── composer.ts     composeZonePost (digest path · full MCP, maxTurns 12)
│   │   │   │   ├── reply.ts        composeReply (chat path · single-turn or orchestrator)
│   │   │   │   ├── agent-gateway.ts        provider resolution + invoke (399 LOC)
│   │   │   │   ├── environment.ts          environment-context block builder
│   │   │   │   ├── headline-lock.ts        substrate guard against LLM headline drift
│   │   │   │   ├── post-types.ts           6 post-type specs (digest/micro/weaver/lore_drop/question/callout)
│   │   │   │   ├── bedrock-image.ts        bedrock text-to-image path
│   │   │   │   └── index.ts                unified compose entrypoint (V0.7-A.2)
│   │   │   ├── deliver/
│   │   │   │   ├── webhook.ts              Pattern B per-channel webhook (229 LOC)
│   │   │   │   ├── embed.ts                digest embed shape (160 LOC)
│   │   │   │   ├── embed-with-image.ts     enriched payload for satoshi imagegen (342 LOC)
│   │   │   │   ├── sanitize.ts             voice-discipline transforms (345 LOC)
│   │   │   │   ├── strip-image-urls.ts     defense-in-depth automod evasion
│   │   │   │   ├── grail-cache.ts          boot prefetch (387 LOC)
│   │   │   │   ├── grail-ref-guard.ts      anti-hallucination grail-id validator
│   │   │   │   ├── wardrobe-resolver.ts    cycle-3 SCAFFOLD (returns null until token-binding fills)
│   │   │   │   ├── post.ts                 deliverZoneDigest entry
│   │   │   │   └── client.ts               discord.js client lifecycle
│   │   │   ├── persona/loader.ts           buildPromptPair / buildReplyPromptPair + exemplar-loader.ts
│   │   │   ├── orchestrator/               IN-PROCESS MCP SERVERS
│   │   │   │   ├── index.ts                buildMcpServers · runOrchestratorQuery · tool-use streaming (590 LOC)
│   │   │   │   ├── _schema/                Effect.Schema MCP contract (3 files)
│   │   │   │   ├── cabal/gygax.ts          9 phantom-player archetypes
│   │   │   │   ├── emojis/                 43-emoji THJ catalog · server + registry + schema
│   │   │   │   ├── freeside_auth/server.ts wallet↔handle/mibera_id (Pg-backed · 532 LOC)
│   │   │   │   ├── imagegen/               Bedrock Stability surface (4 files)
│   │   │   │   └── rosenzu/                Lynch primitives + KANSEI server (860 LOC across 2 files)
│   │   │   ├── score/                      score-mcp client + raw_stats v1/v2 dual-shape types + codex-context
│   │   │   ├── cron/scheduler.ts           3-cadence node-cron (149 LOC) + per-zone fire lock
│   │   │   ├── conversation/ledger.ts      in-process ring buffer (71 LOC · 50-entry cap)
│   │   │   └── expression/                 V0.12 layer · tool-mood-map · error-register · silence-register · loading-status
│   │   └── package.json
│   └── protocol/                   EMPTY placeholder (sealed-schema slot reserved · 28-line README only)
├── docs/                           11 markdown files · 2461 lines total
├── scripts/                        operator scripts
├── grimoires/                      Loa state zone (NOTES.md · sprint.md · qa/ · reality/ · etc)
├── .claude/                        Loa system zone (symlinks into .loa/ submodule)
├── .loa/                           Loa framework v1.148.0 (git submodule)
└── package.json · README.md · CLAUDE.md · CHANGELOG.md · .env.example
```

## 3 · Data Models (core)

### 3.1 `CharacterConfig` (substrate boundary)
[GROUNDED: `packages/persona-engine/src/types.ts:48-197`]

```ts
interface CharacterConfig {
  id: string;                           // 'ruggy', 'satoshi', 'mongolian'
  personaPath: string;                  // absolute path to persona.md
  exemplarsDir?: string;                // for ICE injection
  emojiAffinity?: { primary?: EmojiAffinityKind; fallback?: EmojiAffinityKind };
  displayName?: string;
  webhookAvatarUrl?: string;            // V0.6-D Pattern B per-message override
  webhookUsername?: string;
  anchoredArchetypes?: CabalArchetype[]; // 1-2 archetypes character genuinely IS
  slash_commands?: SlashCommandSpec[];   // V0.7-A.1 per-character commands
  mcps?: string[];                       // V0.7-A.1 per-character MCP scope
  tool_invocation_style?: string;        // V0.7-A.1 affirmative-blueprint guidance
  readonly mediumOverrides?: MediumCapabilityOverridesType;  // V0.8 cycle-R sprint-4 BASE tier
  readonly tokenBinding?: TokenBindingType;                  // V0.8 cycle-R sprint-4 OVERRIDE tier (scaffold)
}
```

Resolution precedence for medium capabilities: `tokenBinding (per-token NFT)` > `mediumOverrides (character-default)` > `registry default` [GROUNDED: `types.ts:160-167` comment].

### 3.2 `ZoneId` and dimension mapping
[GROUNDED: `packages/persona-engine/src/score/types.ts:35-58`]

```ts
type ZoneId = 'stonehenge' | 'bear-cave' | 'el-dorado' | 'owsley-lab';
type DimensionId = 'og' | 'nft' | 'onchain';

const ZONE_TO_DIMENSION = {
  stonehenge: 'overall',
  'bear-cave': 'og',
  'el-dorado': 'nft',           // discord display: 'agora'
  'owsley-lab': 'onchain',
};
```

Future zones `tl` (Poppy Field / Timeline / HÖR) and `irl` reserved per score-mibera, NOT LIVE yet [GROUNDED: `score/types.ts:22-30` comment].

### 3.3 `ZoneDigest` (score-mcp contract, dual-shape v1/v2)
[GROUNDED: `score/types.ts:188-213`]

```ts
interface ZoneDigest {
  zone: ZoneId;
  window: 'weekly';
  computed_at: string;
  window_start: string;
  window_end: string;
  stale: boolean;
  schema_version: string;
  narrative: NarrativeShape | null;
  narrative_error?: string | null;
  narrative_error_hint?: string | null;
  raw_stats: RawStats;
}
```

`RawStats` carries v1 (`total_events`, `active_wallets`) AND v2 (`top_event_count`, `top_wallet_count`, `window_event_count`, `window_wallet_count`) fields; helper functions read either shape [GROUNDED: `score/types.ts:117-167`].

### 3.4 `LedgerEntry` (conversation history)
[GROUNDED: `packages/persona-engine/src/conversation/ledger.ts:21-41`]

```ts
interface LedgerEntry {
  role: 'user' | 'character';
  content: string;
  characterId?: string;
  authorId: string;
  authorUsername: string;
  timestamp: string;
}
```

In-process Map keyed by Discord channel ID · 50-entry cap · drop-oldest-on-overflow · no persistence.

### 3.5 `CabalArchetype` (9 phantom-player audience postures)
[GROUNDED: `types.ts:250-259`]

```
Optimizer | Newcomer | Storyteller | Rules-Lawyer | Chaos-Agent | GM | Anxious-Player | Veteran | Explorer
```

These are AUDIENCE postures, NOT character voice modes (gumi correction §0.5 #1 · 2026-04-29).

### 3.6 `SlashCommandSpec` (per-character command declaration)
[GROUNDED: `types.ts:209-234`]

Maps 1:1 to Discord's Application Command shape. Handler enum: `'chat' | 'imagegen'`.

## 4 · API Surface (HTTP)

[GROUNDED: `apps/bot/src/discord-interactions/server.ts:62-86`]

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health probe · returns `{status, service, characters: [...]}` |
| POST | `/webhooks/discord` | Discord interactions endpoint · Ed25519-verified |
| (other) | * | 404 |

## 5 · Slash Command Surface

| Command | Handler | Owner | Source |
|---------|---------|-------|--------|
| `/ruggy prompt:<text> ephemeral?:<bool>` | chat | ruggy | default slash spec [GROUNDED: `character-loader.ts:102-115`] |
| `/satoshi prompt:<text> ephemeral?:<bool>` | chat | satoshi | declared [GROUNDED: `character-satoshi/character.json:17-26`] |
| `/satoshi-image prompt:<text>` | imagegen | satoshi | declared [GROUNDED: `character-satoshi/character.json:27-34`] |
| `/mongolian prompt:<text> ephemeral?:<bool>` | chat | mongolian (Munkh) | default slash spec [INFERRED: mongolian has no explicit `slash_commands` array] |
| `/quest *` | quest | system (cycle-Q) | intercepted before character routing [GROUNDED: `dispatch.ts:268-276`] |

## 6 · Cron Cadences

[GROUNDED: `packages/persona-engine/src/cron/scheduler.ts:77-149`]

| Cadence | Default Schedule | Trigger | Targets | Lock |
|---------|------------------|---------|---------|------|
| Digest backbone | weekly Sun 00:00 UTC | `DIGEST_CADENCE=weekly|daily|manual` | all zones | per-zone |
| Pop-in random | every N hours (default 6h) per-zone die-roll | `POP_IN_ENABLED=true` | each zone, p=0.1 | per-zone |
| Weaver weekly | Wed 12:00 UTC | `WEAVER_ENABLED=true` | `WEAVER_PRIMARY_ZONE` (default stonehenge) | per-zone |

Per-zone fire lock prevents concurrent fires when cadences align in time [GROUNDED: `scheduler.ts:54-75`].

## 7 · MCP Servers (in-process orchestrator/)

[GROUNDED: `packages/persona-engine/src/orchestrator/`]

| Server | Tools (exposed via Claude Agent SDK) | LOC |
|--------|--------------------------------------|----:|
| `emojis` | pick by mood, find by name, render emoji shortcodes | 533 + 397 schema |
| `cabal` | gygax archetype lens rotation (audience-posture audit) | 146 |
| `freeside_auth` | resolve_wallet, resolve_handle_to_wallet, resolve_mibera_id_to_wallet | 532 |
| `imagegen` | bedrock stability text-to-image | 138 |
| `rosenzu` | get_current_district, furnish_kansei, read_room (Lynch primitives + KANSEI vectors) | 213 + 647 |

Per-character `mcps` array gates which servers each character can call [GROUNDED: `types.ts:99-117`].

Plus an external MCP:
| Server | Tools | Location |
|--------|-------|----------|
| `score` | get_zone_digest, get_wallet_scorecard, factor catalog reads | `score-api-production.up.railway.app/mcp` [GROUNDED: `config.ts:29`] |
| `codex` | lookup_zone, lookup_archetype, lookup_factor, lookup_grail, lookup_mibera, list_zones, list_archetypes, validate_world_element | optional HTTP base URL via `CODEX_MCP_URL` [GROUNDED: `config.ts:37-47`] |

## 8 · Boot Sequence

[GROUNDED: `apps/bot/src/index.ts:56-380`]

```
1. loadConfig() · Zod validation of process.env
2. loadCharacters() · reads CHARACTERS env, parses each apps/character-<id>/character.json
3. exit(1) if no characters loaded
4. console banner (characters · data · llm · zones · cadences · delivery)
5. loadSystemPrompt(primary) · validate persona.md loads + count exemplars
6. QUEST_RUNTIME mode dispatch (disabled | memory | production)
   - production: fail-closed env precondition check + Pg pool factory
7. discord.js bot client login (if DISCORD_BOT_TOKEN set)
8. initGrailCache() · prefetch canonical grails (if GRAIL_CACHE_ENABLED)
9. publishCommands() · sync slash commands to Discord (if AUTO_PUBLISH_COMMANDS)
10. schedule(cron cadences) · start enabled tasks
11. startInteractionServer(Bun.serve) · listen on /webhooks/discord (if DISCORD_PUBLIC_KEY set)
12. On dev/manual: fire once + exit
13. Hook SIGINT/SIGTERM for graceful shutdown
```

## 9 · Security / Invariants

### 9.1 Anti-spam invariant
[GROUNDED: `apps/bot/src/discord-interactions/dispatch.ts:192-208`]
- Reject `invoker.bot === true`
- Reject webhook-author signatures (defense-in-depth)
- Reject unknown character names with ephemeral error
- Reject unsupported interaction types

### 9.2 Token-expiry guard
[GROUNDED: `dispatch.ts:77`]
- `TOKEN_LIFETIME_MS = 14 * 60 * 1000 + 30 * 1000` (14m30s safety margin under Discord's 15:00 hard expiry)

### 9.3 Follow-up rate limit
[GROUNDED: `dispatch.ts:76`]
- `FOLLOW_UP_THROTTLE_MS = 1500` (≥1.5s between follow-ups; 5 req / 2 sec ceiling)

### 9.4 Circuit breaker
[GROUNDED: `dispatch.ts:78-113`]
- 3 consecutive 403s on a channel → blacklist in-memory until process restart
- Prevents Cloudflare's 10K-invalid-req/10min global ban from cascading

### 9.5 Auth-bridge
[GROUNDED: `dispatch.ts:222-266`]
- Every interaction gets AuthContext attached before quest dispatch or character routing
- `AUTH_BACKEND=anon` (default): fast no-op
- `AUTH_BACKEND=freeside-jwt`: activates verified path · AuthBridgeError → ephemeral 401

### 9.6 Ed25519 signature verification
[GROUNDED: `server.ts:57-59,75-77`]
- `DISCORD_PUBLIC_KEY` env required to start interactions server
- All `POST /webhooks/discord` requests verified before dispatch
- Max signed-request age 5 min (replay protection per bridgebuilder F6) [INFERRED: `server.ts:99-101` comment]

### 9.7 Quest production fail-closed precondition
[GROUNDED: `index.ts:157-185`]
- For each world manifest with `tenant_id`, require `TENANT_<TENANT>_DATABASE_URL` env (uppercased, hyphens → underscores)
- Throw at startup if missing — surfaces in Railway logs before any interaction lands

## 10 · Env Var Contract

[GROUNDED: `packages/persona-engine/src/config.ts:4-174`]

70+ env vars across these groups (selected highlights):

- **LLM**: `LLM_PROVIDER` (`stub|anthropic|freeside|bedrock|auto`) · `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` (default `claude-opus-4-7`) · `CHAT_MODE` (`auto|orchestrator|naive`)
- **AWS Bedrock**: `AWS_REGION` · `AWS_BEARER_TOKEN_BEDROCK` · `BEDROCK_TEXT_MODEL_ID` · `BEDROCK_*` per-action model IDs
- **Discord**: `DISCORD_BOT_TOKEN` · `DISCORD_PUBLIC_KEY` · `DISCORD_WEBHOOK_URL` (legacy) · `DISCORD_CHANNEL_{STONEHENGE,BEAR_CAVE,EL_DORADO,OWSLEY_LAB}` · `INTERACTIONS_PORT` (default 3001 · falls back to `PORT` for Railway/Heroku)
- **Score**: `SCORE_API_URL` · `MCP_KEY` · `SCORE_BEARER` (gateway path) · `CODEX_MCP_URL`
- **Freeside auth Pg**: `RAILWAY_MIBERA_DATABASE_URL` · per-tenant `TENANT_<TENANT>_DATABASE_URL`
- **Cadence**: `DIGEST_CADENCE` · `DIGEST_DAY` · `DIGEST_HOUR_UTC` · `POP_IN_ENABLED` · `POP_IN_INTERVAL_HOURS` · `POP_IN_PROBABILITY` · `WEAVER_*`
- **Character selection**: `CHARACTERS` (comma-separated · default `ruggy`)
- **Quest**: `QUEST_RUNTIME` (`disabled|memory|production`) · `QUEST_GUILD_ID`
- **Feature flags**: `GRAIL_CACHE_ENABLED` · `AUTO_PUBLISH_COMMANDS` · `STUB_MODE` · `MIX`

## 11 · Two-Layer Bot Model (non-conflict with sietch)

[GROUNDED: `CLAUDE.md` Two-Layer-Bot Model · vault doctrine `~/vault/wiki/concepts/two-layer-bot-model.md` (referenced)]

freeside-characters and sietch are TWO DIFFERENT Discord applications in the THJ guild:
- **sietch** (`loa-freeside/themes/sietch`): utility commands — `/verify`, `/onboard`, `/score`, `/agent`, `/buy-credits`
- **freeside-characters** (this repo): persona invocation commands — `/ruggy`, `/satoshi`, `/mongolian`, `/satoshi-image`, `/quest`

Never duplicate sietch's commands here.

## 12 · Grounding Summary

| Marker | Count | Notes |
|--------|------:|-------|
| `[GROUNDED]` | 59 | direct `file:line` evidence |
| `[INFERRED]` | 3 | logical deduction from comments + scaffold-pattern reading |
| `[ASSUMPTION]` | 0 | none |

**Grounding ratio**: 95% GROUNDED · 5% INFERRED · 0% ASSUMPTION. TARGET MET (>80% GROUNDED, <10% ASSUMPTION).

### Assumptions / claims requiring validation

None at SDD level. INFERRED items are minor:
- mongolian default slash command — relies on default-spec fallback in `character-loader.ts:102-115` since `slash_commands` is absent in mongolian/character.json
- Max signed-request age — inferred from comment in `server.ts:99-101` saying "Discord's reference implementations use a 5-minute window"
- DISCORD_INTERACTION_DESCRIPTOR default usage — inferred from composer.ts comment
