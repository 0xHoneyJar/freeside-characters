# API Surface — freeside-characters

> Public exports, HTTP routes, slash commands. Updated /ride 2026-05-11.

## HTTP Routes (`apps/bot/src/discord-interactions/server.ts:62-86`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/health` | Health probe | none |
| POST | `/webhooks/discord` | Discord interactions endpoint | Ed25519 (Discord public key) |

`health` returns `{status: 'ok', service: 'freeside-characters-interactions', characters: string[]}`.

## Slash Commands

[GROUNDED: `apps/character-*/character.json`, `apps/bot/src/character-loader.ts:102-115`]

| Command | Handler | Owner | Options |
|---------|---------|-------|---------|
| `/ruggy` | chat | ruggy | prompt:string · ephemeral?:bool |
| `/satoshi` | chat | satoshi | prompt:string · ephemeral?:bool |
| `/satoshi-image` | imagegen | satoshi | prompt:string |
| `/mongolian` | chat | mongolian | prompt:string · ephemeral?:bool (default fallback) |
| `/quest` (+ buttons + modal_submit) | quest | system | intercepted before character routing |

## Public Module API (`packages/persona-engine/src/index.ts`)

### Compose
- `composeForCharacter(config, character, zone, postType)` — digest path · full MCP, maxTurns 12
- `composeReply({config, character, prompt, channelId, zone?, ...})` — chat path
- `composeReplyWithEnrichment(...)` — V0.7-A.3 env-aware enrichment
- `composeWithImage(...)` — satoshi imagegen attachment payload
- `compose(args)` — V0.7-A.2 unified dispatcher
- `splitForDiscord(text)` — chunk into 2000-char-safe slices

### Cron
- `schedule({config, zones, onFire})` — start 3 cadences (digest · pop-in · weaver)

### Delivery
- `deliverZoneDigest(config, character, zone, payload)` — digest path delivery
- `getBotClient(config)` / `shutdownClient()` — discord.js lifecycle
- `getOrCreateChannelWebhook(client, channelId)` — Pattern B webhook fetch-or-create
- `sendChatReplyViaWebhook(...)` / `sendImageReplyViaWebhook(...)` — chat-mode delivery
- `invalidateWebhookCache(channelId)` — admin-deleted-webhook recovery

### Persona
- `loadSystemPrompt(character)` — load persona.md
- `exemplarStats(character)` — ICE diagnostics

### Sanitize
- `stripVoiceDisciplineDrift(text, opts?)` — voice-discipline transform (em-dash strip etc)
- `escapeDiscordMarkdown(text)` — underscore-escape onchain identifiers

### Validation
- `validateGrailRefs(text)` / `inspectGrailRefs(text)` — anti-hallucination guard
- `stripAttachedImageUrls(text)` / `extractAttachedUrls(text)` — automod evasion

### Cache
- `initGrailCache()` — boot-time prefetch
- `isCacheEnabled()` — readout

### Conversation
- `appendToLedger(channelId, entry)` / `getLedgerSnapshot(channelId, lastN)` / `ledgerChannelCount()`

### Config
- `loadConfig()` — Zod-validated env parse
- `isDryRun(config)` — true when neither bot token nor webhook URL set
- `getZoneChannelId(config, zone)` — env-driven channel-ID lookup
- `selectedZones(config)` — `ZONES` env split, filtered

### Expression (V0.12)
- `DEFAULT_TOOL_MOOD_MAP`, `getMoodsForTool`, `pickRandomMood`
- `composeToolUseStatusForCharacter(...)` — character-voiced loading status
- `composeErrorReply(...)`, `composeErrorBody(...)`, `getErrorTemplate(...)` — in-character error register
- `pickSilenceTemplate(characterId)`, `isFlatWindow(stats)` — performed silence

### Emoji
- `pickEmojiByMoods`, `findEmojiByName`, `renderEmoji`, `ALL_EMOJI_MOODS`

### Orchestrator
- `buildMcpServers(config, character)` — per-character MCP scope
- `buildAllowedTools(mcps[])` — allowed-tool list for Claude Agent SDK

### Environment
- `buildEnvironmentContext(args)` — env-context block builder
- `summarizeRecent`, `minutesSince`, `uniq` — helpers

### Rosenzu (V0.7-A.1)
- `deriveTemperature(...)` · `deriveSocialDensity(...)` · `composeTonalWeight(...)`
