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
} from './types.ts';
export type { Config } from './config.ts';
export type { FireRequest, SchedulerHandles, ScheduleArgs } from './cron/scheduler.ts';
export type { PostComposeResult } from './compose/composer.ts';
export type { DeliveryResult } from './deliver/post.ts';
export type { DigestPayload, DiscordEmbed } from './deliver/embed.ts';
export type { ZoneDigest, RawStats } from './score/types.ts';

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
