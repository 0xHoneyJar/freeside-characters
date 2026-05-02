/**
 * persona-engine public API — what apps/bot/ and apps/character-* import.
 *
 * The substrate exposes:
 *   - composeForCharacter        full compose pipeline (replaces V0.5
 *                                composeZonePost)
 *   - schedule                   cron entry (substrate-managed cadences)
 *   - deliverZoneDigest          Discord delivery (bot/webhook/dry-run)
 *   - getBotClient/shutdownClient Discord lifecycle
 *   - loadConfig + helpers       runtime config (env)
 *   - exemplarStats              ICE diagnostics
 *   - All public types
 *
 * Characters MUST NOT import from substrate internals (orchestrator/,
 * compose/composer.ts directly, etc.). Use this barrel.
 */

// Public types
export type {
  CharacterConfig,
  ZoneId,
  PostType,
  EmojiAffinityKind,
  SlashCommandSpec,
  SlashCommandHandler,
  SlashCommandOption,
  DiscordApplicationCommandOptionType,
} from './types.ts';

export type { Config } from './config.ts';
export type { FireRequest, SchedulerHandles, ScheduleArgs } from './cron/scheduler.ts';

// Compose API — substrate's top-level entry for "make a post for character X in zone Y"
export { composeZonePost as composeForCharacter, ALL_ZONES } from './compose/composer.ts';
export { POST_TYPE_SPECS } from './compose/post-types.ts';

// Cron API
export { schedule } from './cron/scheduler.ts';

// Delivery API
export { deliverZoneDigest, isDryRun } from './deliver/post.ts';
export { getBotClient, shutdownClient } from './deliver/client.ts';

// Webhook delivery primitives (V0.7-A.0 — slash replies use Pattern B too)
export {
  getOrCreateChannelWebhook,
  sendChatReplyViaWebhook,
  sendImageReplyViaWebhook,
  invalidateWebhookCache,
} from './deliver/webhook.ts';

// Config API
export { loadConfig, getZoneChannelId, selectedZones } from './config.ts';

// Persona / exemplar diagnostics (apps/bot uses these on boot)
export { loadSystemPrompt } from './persona/loader.ts';
export { exemplarStats } from './persona/exemplar-loader.ts';

// Reply API (V0.7-A.0 — chat-mode pipeline for slash command replies)
export { composeReply, splitForDiscord } from './compose/reply.ts';
export type { ReplyComposeArgs, ReplyComposeResult } from './compose/reply.ts';

// Chat-mode routing helpers (V0.7-A.4 surface-completeness test surface)
export { shouldUseOrchestrator, resolveChatProvider } from './compose/reply.ts';
export type { ChatProvider } from './compose/reply.ts';

// Digest-path provider resolution (V0.12 · exported so the bedrock-first
// auto-rule matrix can be unit-tested — see provider-resolution.test.ts).
export { resolveProvider } from './compose/agent-gateway.ts';
export type { ResolvedProvider } from './compose/agent-gateway.ts';

// Orchestrator MCP-server registration (V0.7-A.4 surface-completeness)
export { buildMcpServers, buildAllowedTools } from './orchestrator/index.ts';

// Expression layer (V0.12 · session 04 — character voice during loading,
// errors, and performed silence). Substrate routes; character expression
// fills. Per multi-axis-daemon-architecture §axis-3 capability-equipping.
export {
  DEFAULT_TOOL_MOOD_MAP,
  getMoodsForTool,
  pickRandomMood,
} from './expression/tool-mood-map.ts';
export type { ToolMoodMapping } from './expression/tool-mood-map.ts';
export { composeToolUseStatusForCharacter } from './expression/loading-status.ts';
export {
  DEFAULT_ERROR_REGISTRY,
  getErrorTemplate,
  composeErrorReply,
} from './expression/error-register.ts';
export type {
  ErrorClass,
  ErrorRegistry,
  CharacterErrorTemplates,
} from './expression/error-register.ts';
export {
  DEFAULT_SILENCE_REGISTRY,
  FLAT_WINDOW_EVENT_THRESHOLD,
  isFlatWindow,
  pickSilenceTemplate,
} from './expression/silence-register.ts';
export type { SilenceRegistry } from './expression/silence-register.ts';

// Emoji registry primitives (V0.12 — surfaced for tests and direct
// inspection; the loading-status composer wraps these for the dispatch
// path's hot-path use).
export {
  pickByMoods as pickEmojiByMoods,
  findByName as findEmojiByName,
  renderEmoji,
  ALL_MOODS as ALL_EMOJI_MOODS,
} from './orchestrator/emojis/registry.ts';
export type {
  EmojiEntry,
  EmojiKind,
  EmojiMood,
} from './orchestrator/emojis/registry.ts';

// MCP server contracts (V0.7-A.4 — Effect.Schema source of truth · used
// by surface-completeness + persona-tool-drift tests)
export { emojisServerContract } from './orchestrator/emojis/schema.ts';
export type { McpToolContract, McpServerContract } from './orchestrator/_schema/index.ts';

// Unified compose entrypoint (V0.7-A.2 — single dispatcher for cron + chat)
export { compose } from './compose/index.ts';
export type {
  ComposeArgs,
  ComposeEnvironment,
  ComposeResult,
  Invocation,
} from './compose/index.ts';

// Orchestrator tool-use streaming (V0.7-A.1 · chat dispatcher uses this
// to surface tool calls progressively in Discord — see ruggy-v2 pattern).
export type { ToolUseEvent } from './orchestrator/index.ts';

// Bedrock image generation
export * from './compose/bedrock-image.ts';

// Conversation ledger (V0.7-A.0 — in-process per-channel ring buffer)
export {
  appendToLedger,
  getLedgerSnapshot,
  ledgerChannelCount,
} from './conversation/ledger.ts';
export type { LedgerEntry } from './conversation/ledger.ts';

// Score helpers — bot's CLI uses ZONE_FLAVOR for log emoji + counts
export { ZONE_FLAVOR, getWindowEventCount, getWindowWalletCount } from './score/types.ts';
export { getCodexLineCount } from './score/codex-context.ts';

// Environment context (V0.7-A.1 Phase C — substrate awareness block)
export {
  buildEnvironmentContext,
  summarizeRecent,
  minutesSince,
  uniq,
} from './compose/environment.ts';
export type { RecentMessage, BuildEnvironmentContextArgs } from './compose/environment.ts';

// Rosenzu derivation helpers (V0.7-A.1 — temporal/social moment-half)
export {
  deriveTemperature,
  deriveSocialDensity,
  composeTonalWeight,
} from './orchestrator/rosenzu/lynch-primitives.ts';
export type {
  RoomTemperature,
  RoomSocialDensity,
} from './orchestrator/rosenzu/lynch-primitives.ts';
