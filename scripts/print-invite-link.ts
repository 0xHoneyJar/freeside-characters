#!/usr/bin/env bun
/**
 * Discord OAuth invite-link generator for the freeside-characters shell bot.
 *
 * Usage:
 *   DISCORD_BOT_TOKEN=... bun run scripts/print-invite-link.ts
 *   bun run scripts/print-invite-link.ts                     # reads .env automatically
 *
 * Pattern B (webhook-shell · per-character avatar+username override) requires
 * MANAGE_WEBHOOKS at the channel-or-role level. Without it, the substrate's
 * `getOrCreateChannelWebhook()` call returns 403 Missing Permissions and
 * delivery silently fails after compose (text composed by LLM but lost).
 *
 * Discord permission bitmask reference:
 *   VIEW_CHANNEL          1024         1 << 10
 *   SEND_MESSAGES         2048         1 << 11
 *   EMBED_LINKS           16384        1 << 14
 *   ATTACH_FILES          32768        1 << 15
 *   USE_EXTERNAL_EMOJIS   262144       1 << 18
 *   ADD_REACTIONS         64           1 << 6   (V0.6-D phase 2)
 *   MANAGE_WEBHOOKS       536870912    1 << 29  (Pattern B critical)
 *
 * V0.6 phase 1 minimum (cron-driven webhook delivery):
 *   VIEW_CHANNEL + SEND_MESSAGES + EMBED_LINKS + ATTACH_FILES +
 *   USE_EXTERNAL_EMOJIS + MANAGE_WEBHOOKS = 537185280
 *
 * V0.6-D phase 2 future (reaction handler · ❓ canonical-via-PluralKit):
 *   add ADD_REACTIONS = 537185344
 *
 * Per Discord OAuth2 spec: the bot scope is sufficient for cron-driven posting.
 * applications.commands scope is NOT needed unless slash commands are added later.
 *
 * Source: ported from `warroom-bot/src/get-invite-link.ts` (operator's prior
 * pattern) with Pattern B permissions added per V0.6-D phase 1 requirements.
 */

const PERMISSIONS_V06_PHASE_1 =
  1024 +        // VIEW_CHANNEL
  2048 +        // SEND_MESSAGES
  16384 +       // EMBED_LINKS
  32768 +       // ATTACH_FILES
  262144 +      // USE_EXTERNAL_EMOJIS
  536870912;    // MANAGE_WEBHOOKS  ← Pattern B critical

const SCOPE = 'bot';

function extractClientId(token: string): string | null {
  // Discord bot tokens are `<base64-encoded-client-id>.<timestamp>.<signature>`
  // We only need the first segment, which is the application ID.
  const firstSegment = token.split('.')[0];
  if (!firstSegment) return null;
  try {
    return atob(firstSegment);
  } catch {
    return null;
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('error: DISCORD_BOT_TOKEN not set');
  console.error('       set it in .env or pass as env var: DISCORD_BOT_TOKEN=... bun run scripts/print-invite-link.ts');
  process.exit(1);
}

const clientId = extractClientId(token);
if (!clientId) {
  console.error('error: could not extract client_id from DISCORD_BOT_TOKEN');
  console.error('       token format expected: <base64-client-id>.<timestamp>.<signature>');
  process.exit(1);
}

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${PERMISSIONS_V06_PHASE_1}&scope=${SCOPE}`;

console.log('');
console.log('🔗 freeside-characters · Discord shell-bot invite');
console.log('');
console.log(inviteUrl);
console.log('');
console.log('permissions encoded:');
console.log('  ✓ View Channel              (read channel listing)');
console.log('  ✓ Send Messages             (deliver via webhook + bot fallback)');
console.log('  ✓ Embed Links               (rich embed for digest/weaver/callout)');
console.log('  ✓ Attach Files              (avatar fetches, future image posts)');
console.log('  ✓ Use External Emojis       (per-character emoji affinity refs)');
console.log('  ✓ Manage Webhooks           (Pattern B critical · per-character override)');
console.log('');
console.log('scope: bot');
console.log('');
console.log('after invite:');
console.log('  · the role-level grant covers all channels in the guild');
console.log('  · for per-channel scoping (more conservative): grant Manage Webhooks');
console.log('    individually on each character-target channel');
console.log('  · validate by booting the bot · DEPLOY.md "validate first deploy"');
console.log('');
