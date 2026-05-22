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
    // cycle-008 T3.9 · two-beat: voice (beat 1) then bold billboard (beat 2) as
    // separate messages. `secondary` absent → single send (back-compat).
    let firstMessageId: string | undefined;
    for (const beat of beatsOf(payload)) {
      const r = await sendViaWebhook(webhook, character, beat);
      if (firstMessageId === undefined) firstMessageId = r.messageId;
    }
    // Fire-and-forget reaction-bar attachment per
    // DIGEST_REACTION_BAR_ENABLED (default: true). Reactions are
    // augmentation, NOT critical path — never fail delivery on
    // reaction-attach error. Attaches to beat 1 (the post the channel
    // sees first). messageId may be undefined if the webhook didn't
    // return one (legacy webhook variants).
    if (config.DIGEST_REACTION_BAR_ENABLED && firstMessageId) {
      void attachReactionBar(client, channelId, firstMessageId).catch((err) => {
        console.error('[reaction-bar] post-delivery attach threw:', err);
      });
    }
    return {
      posted: true,
      dryRun: false,
      via: 'webhook-shell',
      messageId: firstMessageId,
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
    // cycle-008 T3.9 · two-beat sequential send (see beatsOf).
    let firstMessageId: string | undefined;
    for (const beat of beatsOf(payload)) {
      const r = await postToChannel(client, channelId, beat);
      if (firstMessageId === undefined) firstMessageId = r.messageId;
    }
    if (config.DIGEST_REACTION_BAR_ENABLED && firstMessageId) {
      void attachReactionBar(client, channelId, firstMessageId).catch((err) => {
        console.error('[reaction-bar] post-delivery attach threw:', err);
      });
    }
    return {
      posted: true,
      dryRun: false,
      via: 'bot',
      messageId: firstMessageId,
      channelId,
    };
  }

  // 3. Legacy single-webhook fallback (V0 testing path)
  if (config.DISCORD_WEBHOOK_URL) {
    // cycle-008 T3.9 · two-beat: POST each beat as its own message.
    for (const beat of beatsOf(payload)) {
      const response = await fetch(config.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(beat),
      });
      if (!response.ok) {
        throw new Error(`webhook delivery failed: ${response.status} ${await response.text()}`);
      }
    }
    return { posted: true, dryRun: false, via: 'webhook-fallback' };
  }

  // 4. Dry-run to stdout
  logDryRun(character, zone, payload, 'no token, no webhook');
  return { posted: false, dryRun: true, via: 'dry-run' };
}

/**
 * cycle-008 T3.9 · split a (possibly two-beat) payload into the ordered list of
 * Discord messages to send. `secondary` present → [voice beat, billboard beat];
 * absent → [single message]. Strips `secondary` from each beat so it never
 * recurses.
 */
function beatsOf(payload: DigestPayload): DigestPayload[] {
  const primary: DigestPayload = { content: payload.content, embeds: payload.embeds };
  return payload.secondary
    ? [primary, { content: payload.secondary.content, embeds: payload.secondary.embeds }]
    : [primary];
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
    for (const field of payload.embeds[0].fields ?? []) {
      console.log(`embed.field ${field.name}:`);
      field.value.split('\n').forEach((line) => console.log('    ' + line));
    }
    console.log('embed.footer:', payload.embeds[0].footer?.text);
  }
  if (payload.secondary) {
    console.log('──── beat 2 (billboard) ────');
    payload.secondary.content.split('\n').forEach((line) => console.log('    ' + line));
  }
  console.log('──────────────────────────────────────────────────────────────\n');
}

export { isDryRun };
