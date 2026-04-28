/**
 * Discord webhook delivery.
 *
 * V1 uses webhooks (not Gateway / discord.js) for delivery — simpler,
 * no Message Content Intent (MCI) privilege required, matches the
 * Sentry/PagerDuty/GitHub bot pattern.
 *
 * When `DISCORD_WEBHOOK_URL` is unset/empty, ruggy dry-runs to stdout
 * instead of posting. Useful for local dev + CI.
 */

import type { Config } from '../config.ts';
import { isDryRun } from '../config.ts';
import type { DigestPayload } from '../format/embed.ts';

export interface DeliveryResult {
  posted: boolean;
  dryRun: boolean;
  webhookUrl?: string;
  status?: number;
}

export async function deliverDigest(
  config: Config,
  payload: DigestPayload,
): Promise<DeliveryResult> {
  if (isDryRun(config)) {
    console.log('\n──── ruggy digest · DRY-RUN ──────────────────────────────────');
    console.log('content:', payload.content);
    if (payload.embeds[0]) {
      console.log('embed:');
      console.log('  color:', `0x${payload.embeds[0].color?.toString(16).padStart(6, '0')}`);
      console.log('  description:');
      const desc = payload.embeds[0].description ?? '';
      desc.split('\n').forEach((line) => console.log('    ' + line));
      console.log('  footer:', payload.embeds[0].footer?.text);
    }
    console.log('──────────────────────────────────────────────────────────────\n');
    return { posted: false, dryRun: true };
  }

  const url = config.DISCORD_WEBHOOK_URL!;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `discord webhook delivery failed: ${response.status} ${errorText}`,
    );
  }

  return { posted: true, dryRun: false, webhookUrl: url, status: response.status };
}
