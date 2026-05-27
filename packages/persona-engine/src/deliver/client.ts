/**
 * Discord bot client (discord.js Gateway).
 *
 * V0.4 hardening (codex-rescue F5): on disconnect, clear cached client +
 * readyPromise so subsequent getBotClient() calls reconnect cleanly
 * instead of awaiting a dead promise.
 *
 * V1 use:
 *   • Login as the Ruggy bot user
 *   • Send digest payloads to per-zone channels via channel.send()
 *   • Stay connected (cron triggers fire posts)
 *   • Graceful shutdown on SIGINT/SIGTERM
 *
 * If DISCORD_BOT_TOKEN is unset, the bot client is unavailable; the
 * post layer falls back to webhook delivery.
 */

import { Client, GatewayIntentBits, Events } from 'discord.js';
import type { TextChannel, NewsChannel, ThreadChannel } from 'discord.js';
import type { Config } from '../config.ts';
import { postComponentsV2 } from './cv2-post.ts';

let cachedClient: Client | null = null;
let readyPromise: Promise<Client> | null = null;

function resetCachedClient(reason: string): void {
  console.log(`ruggy: discord client invalidated (${reason}) — will reconnect on next request`);
  if (cachedClient) {
    cachedClient.destroy().catch(() => {});
  }
  cachedClient = null;
  readyPromise = null;
}

export async function getBotClient(config: Config): Promise<Client | null> {
  if (!config.DISCORD_BOT_TOKEN) return null;
  if (cachedClient && cachedClient.isReady()) return cachedClient;
  // Cached client exists but not ready — likely disconnected; reset.
  if (cachedClient && !cachedClient.isReady()) {
    resetCachedClient('not ready');
  }
  if (readyPromise) return readyPromise;

  readyPromise = startClient(config);
  try {
    cachedClient = await readyPromise;
    return cachedClient;
  } catch (err) {
    // Connection failed — clear so next call retries cleanly
    readyPromise = null;
    cachedClient = null;
    throw err;
  }
}

async function startClient(config: Config): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  // Lifecycle handlers — invalidate cache on disconnect/error so the
  // next getBotClient() call reconnects from scratch.
  client.on(Events.ShardDisconnect, (closeEvent, shardId) => {
    console.log(`ruggy: discord shard ${shardId} disconnected (${closeEvent?.code ?? '?'})`);
    resetCachedClient('shard disconnect');
  });
  client.on(Events.Error, (err) => {
    console.error(`ruggy: discord client error:`, err);
    resetCachedClient('client error');
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    client.once(Events.ClientReady, (c) => {
      if (settled) return;
      settled = true;
      console.log(`ruggy: discord client ready as ${c.user.tag}`);
      resolve(client);
    });

    // Initial-connection error path
    client.once(Events.Error, fail);

    client.login(config.DISCORD_BOT_TOKEN!).catch(fail);
  });
}

/**
 * Discord channel post. Two payload shapes (mutually-exclusive in PRACTICE,
 * but kept loosely typed for backward compat with the cycle-008 digest path):
 *
 *   - Legacy: `{ content, embeds[, flags] }` — content + embeds passed to discord.js.
 *   - Components V2: `{ flags: 1<<15, components[] }` — content + embeds MUST NOT be
 *     populated; Discord REST rejects the call when both are present (BB#106 F-001).
 *
 * The runtime branches on `components`: when defined, ONLY `flags + components` are
 * forwarded to Discord (content + embeds are silently dropped — see line 110 below).
 * Callers MUST NOT set content / embeds when using the V2 path; doing so is dead-code
 * at runtime but indicates a wire-shape bug.
 */
export async function postToChannel(
  client: Client,
  channelId: string,
  payload: { content?: string; embeds?: object[]; flags?: number; components?: unknown[] },
): Promise<{ posted: true; messageId: string }> {
  // cycle-008 S9 · Components V2 → raw REST to the channel (Bot auth) + ?with_components=true.
  // discord.js channel.send rejects raw component JSON; raw REST is the proven path.
  if (payload.components !== undefined) {
    const token = client.token;
    if (!token) throw new Error('postToChannel: client has no token for Components V2 REST');
    const json = await postComponentsV2(
      `https://discord.com/api/v10/channels/${channelId}/messages?with_components=true`,
      { flags: payload.flags, components: payload.components },
      { authorization: `Bot ${token}` },
    );
    return { posted: true, messageId: json.id ?? '' };
  }

  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`channel not found: ${channelId}`);
  if (!isSendable(channel)) {
    throw new Error(`channel ${channelId} is not text-sendable (kind: ${channel.type})`);
  }

  // discord.js types want a specific embed shape; we cast since the embed
  // is already valid Discord JSON.
  const message = await channel.send({
    content: payload.content,
    embeds: payload.embeds as never,
  });

  return { posted: true, messageId: message.id };
}

function isSendable(
  channel: unknown,
): channel is TextChannel | NewsChannel | ThreadChannel {
  if (typeof channel !== 'object' || channel === null) return false;
  return 'send' in channel && typeof (channel as { send: unknown }).send === 'function';
}

export async function shutdownClient(): Promise<void> {
  if (cachedClient) {
    await cachedClient.destroy();
    cachedClient = null;
    readyPromise = null;
  }
}
