/**
 * Per-zone post delivery — Pattern B (webhook shell) primary, bot.send fallback.
 *
 * Priority:
 *   1. character.webhookAvatarUrl set + DISCORD_BOT_TOKEN + channel mapped
 *      → fetch/create channel webhook → send with character identity override
 *      (THE PATH — Pattern B / shell-doctrine-aligned)
 *   2. DISCORD_BOT_TOKEN + channel mapped (no character avatar URL yet)
 *      → bot.send under the shell's own identity (transitional fallback)
 *   3. DISCORD_WEBHOOK_URL set (single-webhook V0 testing path)
 *      → POST raw to webhook URL (legacy, no per-character override)
 *   4. Otherwise → dry-run to stdout
 *
 * Per Eileen's `puruhani-as-spine.md` doctrine, Pattern B is the canonical
 * shell pattern: one Discord App = the runtime shell, N webhooks = identity
 * projection layer, characters = speakers carried by the shell.
 */

import type { Config } from '../config.ts';
import { isDryRun, getZoneChannelId } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { DigestPayload } from './embed.ts';
import { getBotClient, postToChannel } from './client.ts';
import { getOrCreateChannelWebhook, sendViaWebhook } from './webhook.ts';
import { attachReactionBar } from './reaction-bar.ts';

export interface DeliveryResult {
  posted: boolean;
  dryRun: boolean;
  via: 'webhook-shell' | 'bot' | 'webhook-fallback' | 'dry-run' | 'skipped';
  messageId?: string;
  channelId?: string;
}

export async function deliverZoneDigest(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  payload: DigestPayload,
): Promise<DeliveryResult> {
  // 1. Pattern B (webhook shell) — character has avatar URL configured
  if (config.DISCORD_BOT_TOKEN && character.webhookAvatarUrl) {
    const channelId = getZoneChannelId(config, zone);
    if (!channelId) {
      logDryRun(character, zone, payload, 'channel not mapped');
      return { posted: false, dryRun: true, via: 'skipped' };
    }
    const client = await getBotClient(config);
    if (!client) {
      throw new Error('bot token set but client failed to connect');
    }
    const webhook = await getOrCreateChannelWebhook(client, channelId);
    const result = await sendViaWebhook(webhook, character, payload);
    // Fire-and-forget reaction-bar attachment per
    // DIGEST_REACTION_BAR_ENABLED (default: true). Reactions are
    // augmentation, NOT critical path — never fail delivery on
    // reaction-attach error. messageId may be undefined if the
    // webhook didn't return one (legacy webhook variants).
    if (config.DIGEST_REACTION_BAR_ENABLED && result.messageId) {
      void attachReactionBar(client, channelId, result.messageId).catch((err) => {
        console.error('[reaction-bar] post-delivery attach threw:', err);
      });
    }
    return {
      posted: true,
      dryRun: false,
      via: 'webhook-shell',
      messageId: result.messageId,
      channelId,
    };
  }

  // 2. bot.send fallback — character has no webhook avatar yet; posts as
  //    the shell account's own identity. Useful during the migration
  //    window where avatar URLs haven't been uploaded to the CDN yet.
  if (config.DISCORD_BOT_TOKEN) {
    const channelId = getZoneChannelId(config, zone);
    if (!channelId) {
      logDryRun(character, zone, payload, 'channel not mapped');
      return { posted: false, dryRun: true, via: 'skipped' };
    }
    const client = await getBotClient(config);
    if (!client) {
      throw new Error('bot token set but client failed to connect');
    }
    const result = await postToChannel(client, channelId, payload);
    if (config.DIGEST_REACTION_BAR_ENABLED && result.messageId) {
      void attachReactionBar(client, channelId, result.messageId).catch((err) => {
        console.error('[reaction-bar] post-delivery attach threw:', err);
      });
    }
    return {
      posted: true,
      dryRun: false,
      via: 'bot',
      messageId: result.messageId,
      channelId,
    };
  }

  // 3. Legacy single-webhook fallback (V0 testing path)
  if (config.DISCORD_WEBHOOK_URL) {
    const response = await fetch(config.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`webhook delivery failed: ${response.status} ${await response.text()}`);
    }
    return { posted: true, dryRun: false, via: 'webhook-fallback' };
  }

  // 4. Dry-run to stdout
  logDryRun(character, zone, payload, 'no token, no webhook');
  return { posted: false, dryRun: true, via: 'dry-run' };
}

function logDryRun(
  character: CharacterConfig,
  zone: ZoneId,
  payload: DigestPayload,
  reason: string,
): void {
  console.log(`\n──── ${character.id} · ${zone} · DRY-RUN (${reason}) ────────────────`);
  console.log('content:', payload.content);
  if (payload.embeds[0]) {
    console.log(
      'embed.color:',
      `0x${payload.embeds[0].color?.toString(16).padStart(6, '0')}`,
    );
    const desc = payload.embeds[0].description ?? '';
    console.log('embed.description:');
    desc.split('\n').forEach((line) => console.log('    ' + line));
    console.log('embed.footer:', payload.embeds[0].footer?.text);
  }
  console.log('──────────────────────────────────────────────────────────────\n');
}

export { isDryRun };
