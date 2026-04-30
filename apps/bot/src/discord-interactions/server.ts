/**
 * Discord Interactions HTTP server (V0.7-A.0).
 *
 * Bun HTTP server that receives signed POSTs from Discord, verifies the
 * Ed25519 signature, dispatches APPLICATION_COMMAND interactions through
 * `dispatch.ts`, and replies synchronously with the deferred ACK.
 *
 * Pattern source:
 *   - Bun.serve shape    → `~/Documents/GitHub/ruggy-v2/src/webhook-server.ts`
 *   - Ed25519 + PING     → `~/Documents/GitHub/ruggy-moltbot/src/webhooks/discord.ts:248-277`
 *
 * Env required:
 *   DISCORD_PUBLIC_KEY  Ed25519 public key from Discord developer portal
 *   INTERACTIONS_PORT   default 3001 (any free port works · only Discord
 *                       public-internet URL needs to match Railway routing)
 *
 * Routes:
 *   GET  /health              health probe
 *   POST /webhooks/discord    Discord interactions endpoint
 */

import type { CharacterConfig, Config } from '@freeside-characters/persona-engine';
import {
  InteractionResponseType,
  InteractionType,
  type DiscordInteraction,
  type DiscordInteractionResponse,
} from './types.ts';
import { dispatchSlashCommand } from './dispatch.ts';

const DEFAULT_PORT = 3001;

export interface InteractionServerHandle {
  /** Stop the HTTP server (called from shutdown handlers). */
  stop: () => void;
  /** The actual port the server is listening on (helpful for tests). */
  port: number;
}

export interface InteractionServerArgs {
  config: Config;
  characters: CharacterConfig[];
  /** Optional override for tests · production reads INTERACTIONS_PORT from env. */
  port?: number;
}

export function startInteractionServer(args: InteractionServerArgs): InteractionServerHandle {
  // Port resolution order (highest precedence first):
  //   1. explicit args.port (tests / overrides)
  //   2. INTERACTIONS_PORT env (operator-pinned)
  //   3. PORT env (Railway / Heroku / Fly auto-inject — the platform's
  //      reverse proxy maps public 443 → this port)
  //   4. DEFAULT_PORT 3001 (local dev)
  const port =
    args.port ??
    Number(process.env.INTERACTIONS_PORT ?? process.env.PORT ?? DEFAULT_PORT);
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('DISCORD_PUBLIC_KEY is required to start the interactions server');
  }

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return jsonResponse({
          status: 'ok',
          service: 'freeside-characters-interactions',
          characters: args.characters.map((c) => c.id),
        });
      }

      if (request.method === 'POST' && url.pathname === '/webhooks/discord') {
        return handleDiscordPost(request, publicKey, args);
      }

      return new Response('Not Found', { status: 404 });
    },
    error(err) {
      console.error('interactions: server error:', err);
      return new Response('Internal Server Error', { status: 500 });
    },
  });

  return {
    port,
    stop: () => server.stop(true),
  };
}

// ──────────────────────────────────────────────────────────────────────
// Discord POST handler
// ──────────────────────────────────────────────────────────────────────

async function handleDiscordPost(
  request: Request,
  publicKey: string,
  args: InteractionServerArgs,
): Promise<Response> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');

  if (!signature || !timestamp) {
    return new Response('missing signature headers', { status: 401 });
  }

  const body = await request.text();

  let isValid: boolean;
  try {
    isValid = await verifyDiscordSignature(body, signature, timestamp, publicKey);
  } catch (err) {
    console.error('interactions: signature verification threw:', err);
    return new Response('signature verification error', { status: 401 });
  }
  if (!isValid) {
    return new Response('invalid signature', { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return new Response('invalid json body', { status: 400 });
  }

  // PING (type 1) → PONG (type 1). Required for Discord to validate the
  // endpoint at registration time. Trivial but mandatory.
  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const response = await dispatchSlashCommand(interaction, args.config, args.characters);
    return jsonResponse(response);
  }

  // Other interaction types (component, autocomplete, modal_submit) aren't
  // wired in V0.7-A.0. Return a generic ephemeral acknowledgement so Discord
  // doesn't show "interaction failed" to the user.
  console.warn(`interactions: unhandled interaction type ${interaction.type}`);
  const fallback: DiscordInteractionResponse = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: `interaction type ${interaction.type} not yet supported`, flags: 64 },
  };
  return jsonResponse(fallback);
}

// ──────────────────────────────────────────────────────────────────────
// Ed25519 signature verification (Bun WebCrypto · Ed25519 since Bun 1.1)
// ──────────────────────────────────────────────────────────────────────

/**
 * Verify the Discord Ed25519 signature against `timestamp + body` using the
 * application's public key. Returns false on any failure (key import error,
 * malformed hex, signature mismatch).
 */
export async function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): Promise<boolean> {
  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;
  try {
    publicKeyBytes = hexToBytes(publicKey);
    signatureBytes = hexToBytes(signature);
  } catch (err) {
    console.error('interactions: malformed hex in signature/key:', err);
    return false;
  }

  // crypto.subtle's BufferSource type is strict (rejects SharedArrayBuffer).
  // We know our buffers are ArrayBuffer-backed (TextEncoder + hex parse),
  // but TS still flags the `.buffer` access. Cast through BufferSource.
  const message = new TextEncoder().encode(timestamp + body);

  const key = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes as unknown as BufferSource,
    { name: 'Ed25519' },
    false,
    ['verify'],
  );

  return crypto.subtle.verify(
    'Ed25519',
    key,
    signatureBytes as unknown as BufferSource,
    message as unknown as BufferSource,
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string must have even length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex byte at index ${i}`);
    out[i / 2] = byte;
  }
  return out;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
