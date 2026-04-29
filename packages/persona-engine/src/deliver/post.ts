/**
 * Per-zone post delivery — routes to bot.send() or webhook based on config.
 *
 * Priority:
 *   1. DISCORD_BOT_TOKEN set + per-zone channel mapped → bot.send()
 *   2. DISCORD_WEBHOOK_URL set                          → webhook
 *   3. Otherwise                                        → dry-run to stdout
 */

import type { Config } from '../config.ts';
import { isDryRun, getZoneChannelId } from '../config.ts';
import type { ZoneId } from '../score/types.ts';
import type { DigestPayload } from './embed.ts';
import { getBotClient, postToChannel } from './client.ts';

export interface DeliveryResult {
  posted: boolean;
  dryRun: boolean;
  via: 'bot' | 'webhook' | 'dry-run' | 'skipped';
  messageId?: string;
  channelId?: string;
}

export async function deliverZoneDigest(
  config: Config,
  zone: ZoneId,
  payload: DigestPayload,
): Promise<DeliveryResult> {
  // 1. Bot client + per-zone channel mapping
  if (config.DISCORD_BOT_TOKEN) {
    const channelId = getZoneChannelId(config, zone);
    if (!channelId) {
      logDryRun(zone, payload, 'channel not mapped');
      return { posted: false, dryRun: true, via: 'skipped' };
    }
    const client = await getBotClient(config);
    if (!client) {
      throw new Error('bot token set but client failed to connect');
    }
    const result = await postToChannel(client, channelId, payload);
    return {
      posted: true,
      dryRun: false,
      via: 'bot',
      messageId: result.messageId,
      channelId,
    };
  }

  // 2. Webhook fallback (V0 testing path)
  if (config.DISCORD_WEBHOOK_URL) {
    const response = await fetch(config.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`webhook delivery failed: ${response.status} ${await response.text()}`);
    }
    return { posted: true, dryRun: false, via: 'webhook' };
  }

  // 3. Dry-run to stdout
  logDryRun(zone, payload, 'no token, no webhook');
  return { posted: false, dryRun: true, via: 'dry-run' };
}

function logDryRun(zone: ZoneId, payload: DigestPayload, reason: string): void {
  console.log(`\n──── post · ${zone} · DRY-RUN (${reason}) ────────────────`);
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
