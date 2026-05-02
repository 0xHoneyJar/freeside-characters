/**
 * Webhook delivery — Pattern B (the shell pattern).
 *
 * One Discord application acts as the runtime shell; per-channel webhooks
 * carry per-character identity (avatar + username) via per-message override.
 * Each character's posts visually appear as their own identity in the chat
 * timeline; the shell occupies one slot in the guild member list.
 *
 * Per Eileen's vault canon (`puruhani-as-spine.md`): "The Discord App
 * becomes the interface/runtime shell." Characters are speakers within
 * the shell. Pattern B is the only architecture that survives the
 * 50-bot-per-guild ceiling.
 *
 * Reference implementation: PluralKit ("Members within Systems"). Core
 * mechanic mirrors theirs — fetch-or-create one webhook per channel,
 * cache, send with `username` + `avatarURL` override. The ❓ reaction
 * protocol (V0.6-D scope) provides the "who actually wrote this?"
 * affordance that the lost member-list visibility forces.
 *
 * Permissions required on the shell bot account:
 *   - MANAGE_WEBHOOKS (per channel)
 *   - SEND_MESSAGES (per channel)
 *   - EMBED_LINKS (for embed-shape posts)
 *
 * Rate limits (Discord API ground truth, 2024-2026):
 *   - Webhook execute: 5 requests / 2 seconds, per webhook_id.
 *     Bursts beyond this return 429 with Retry-After header.
 *   - Cloudflare ban threshold: 10,000 invalid req / 10 min.
 *   - V0.6-D adds a token-bucket queue per webhook.
 */

import { AttachmentBuilder, ChannelType } from 'discord.js';
import type { Client, Webhook, TextChannel, NewsChannel } from 'discord.js';
import type { CharacterConfig } from '../types.ts';
import type { DigestPayload } from './embed.ts';

/**
 * Webhook name used for the shell. One webhook per channel per shell —
 * fetch-or-create is idempotent on this name. Owner check guards against
 * collisions with other apps using the same name in the channel.
 */
const SHELL_WEBHOOK_NAME = 'freeside-characters-shell';

const webhookCache = new Map<string, Webhook>();

/**
 * Get the shell's webhook for a channel — reuse if it exists, create if
 * not. Cached at the process level; cache invalidates when send fails
 * with "unknown webhook" (admin deleted it via Discord UI).
 */
export async function getOrCreateChannelWebhook(
  client: Client,
  channelId: string,
): Promise<Webhook> {
  const cached = webhookCache.get(channelId);
  if (cached) return cached;

  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`webhook: channel not found: ${channelId}`);
  if (!isWebhookableChannel(channel)) {
    throw new Error(
      `webhook: channel ${channelId} (kind ${(channel as { type: ChannelType }).type}) doesn't accept webhooks`,
    );
  }

  // Reuse — fetch existing webhooks the bot owns and find one with our name
  const existing = await channel.fetchWebhooks();
  const reuse = existing.find(
    (w) => w.name === SHELL_WEBHOOK_NAME && w.owner?.id === client.user?.id,
  );
  if (reuse) {
    webhookCache.set(channelId, reuse);
    return reuse;
  }

  // Create — first time in this channel
  const created = await channel.createWebhook({
    name: SHELL_WEBHOOK_NAME,
    reason: 'freeside-characters shell webhook for character-identity posts',
  });
  webhookCache.set(channelId, created);
  return created;
}

function isWebhookableChannel(
  channel: unknown,
): channel is TextChannel | NewsChannel {
  if (typeof channel !== 'object' || channel === null) return false;
  if (!('type' in channel)) return false;
  const t = (channel as { type: ChannelType }).type;
  return t === ChannelType.GuildText || t === ChannelType.GuildAnnouncement;
}

/**
 * Send a payload through the channel webhook with per-character identity
 * override. The webhook's persistent name is irrelevant — every message
 * carries its own `username` + `avatarURL` that Discord renders as the
 * speaker identity in the chat timeline.
 *
 * `allowedMentions: { parse: [] }` defaults to no pings; honors Discord's
 * conservative posture on webhook-driven role/@everyone mentions. V0.6-D's
 * router can opt-in per-post when explicit role mentions are intended.
 */
export async function sendViaWebhook(
  webhook: Webhook,
  character: CharacterConfig,
  payload: DigestPayload,
): Promise<{ posted: true; messageId: string }> {
  const username =
    character.webhookUsername ?? character.displayName ?? character.id;
  const avatarURL = character.webhookAvatarUrl;

  const message = await webhook.send({
    username,
    avatarURL,
    content: payload.content,
    embeds: payload.embeds as never,
    allowedMentions: { parse: [] },
  });

  return { posted: true, messageId: message.id };
}

/**
 * Send a plain-text chat reply through the channel webhook with per-character
 * identity (V0.7-A.0). Mirror of `sendViaWebhook` but for the conversation
 * surface — no embed, no digest payload shape, just the LLM's reply text.
 *
 * Pattern B identity preservation for slash command replies: the user sees
 * the character's avatar + username as the speaker, not the shell-bot
 * identity. Aligns chat replies with digest writes per Eileen's vault canon.
 */
export async function sendChatReplyViaWebhook(
  webhook: Webhook,
  character: CharacterConfig,
  content: string,
): Promise<{ posted: true; messageId: string }> {
  const username =
    character.webhookUsername ?? character.displayName ?? character.id;
  const avatarURL = character.webhookAvatarUrl;

  const message = await webhook.send({
    username,
    avatarURL,
    content,
    allowedMentions: { parse: [] },
  });

  return { posted: true, messageId: message.id };
}

/**
 * V0.11.3: send an imagegen reply via the channel webhook with the
 * generated image attached. Mirrors `sendChatReplyViaWebhook` but adds
 * a multipart file part so Discord renders the image inline.
 *
 * Background: V0.7-A.1's imagegen scaffold returned a synthetic
 * `attachment://...` URL but never actually attached the bytes. The
 * V0.11.x dev-guild test (issue #14) caught the gap — Bedrock Stability
 * delivered real bytes (`placeholder=false`); the webhook send only
 * posted the meaningless URL as text content. Discord can't resolve
 * `attachment://` without a multipart file part.
 *
 * The fix: take the image bytes (decoded from base64), build a
 * discord.js `AttachmentBuilder`, and pass via `files` in `webhook.send`.
 * Discord renders PNG/JPG/GIF attachments inline below the text content.
 *
 * Pattern B identity preservation holds — per-character `username` +
 * `avatarURL` overrides apply the same as for chat replies.
 */
export async function sendImageReplyViaWebhook(
  webhook: Webhook,
  character: CharacterConfig,
  args: {
    /** Caption text shown above the image (model + seed metadata, etc). */
    content: string;
    /** Raw image bytes (e.g., decoded from Bedrock's base64 payload). */
    imageBytes: Buffer;
    /** Filename Discord shows on the attachment (e.g., "image-12345.png"). */
    filename: string;
  },
): Promise<{ posted: true; messageId: string }> {
  const username =
    character.webhookUsername ?? character.displayName ?? character.id;
  const avatarURL = character.webhookAvatarUrl;

  const attachment = new AttachmentBuilder(args.imageBytes, {
    name: args.filename,
  });

  const message = await webhook.send({
    username,
    avatarURL,
    content: args.content,
    files: [attachment],
    allowedMentions: { parse: [] },
  });

  return { posted: true, messageId: message.id };
}

/**
 * Invalidate the cache entry for a channel — call when send fails with
 * "unknown webhook" (HTTP 404) so the next call re-fetches/re-creates.
 */
export function invalidateWebhookCache(channelId: string): void {
  webhookCache.delete(channelId);
}

/**
 * Clear all cached webhooks — call on shutdown for clean re-init on next boot.
 */
export function clearAllWebhooks(): void {
  webhookCache.clear();
}
