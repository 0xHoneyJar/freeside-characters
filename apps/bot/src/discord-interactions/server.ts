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
 *   GET  /guild-roles?world=  authenticated role-awareness surface (dashboard
 *                             role-map editor populates its picker from this)
 */

import { timingSafeEqual } from 'node:crypto';
import type { CharacterConfig, Config } from '@freeside-characters/persona-engine';
import { getBotClient } from '@freeside-characters/persona-engine';
import {
  resolveGuildForWorld,
  type WorldManifestQuestSubset,
} from '../world-resolver.ts';
import {
  InteractionResponseType,
  InteractionType,
  type DiscordInteraction,
  type DiscordInteractionResponse,
} from './types.ts';
import { dispatchSlashCommand } from './dispatch.ts';
import {
  handleVerifyRoot,
  handleOAuthCallback,
  handleVerifyComplete,
  type VerifyRuntime,
} from '../verify/verify-routes.ts';
import { verifyMetricsSnapshot } from '@freeside-characters/persona-engine/onboarding';

const DEFAULT_PORT = 3001;

/**
 * The discord.js `Client | null` returned by `getBotClient`. Derived from the
 * function's return type so `apps/bot` needn't take a direct `discord.js`
 * dependency (it only depends on `persona-engine`, which owns that import).
 */
type BotClient = Awaited<ReturnType<typeof getBotClient>>;

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
  /** cycle-009 · sprint-3 — the onboarding verify web surface (C4). Off when absent/disabled. */
  verifyRuntime?: VerifyRuntime;
  /**
   * World manifests for the `/guild-roles` role-awareness surface. Same list
   * the quest runtime consumes (slug + guild_ids). When absent or empty, every
   * `?world=` resolves to 404 `world_not_found` (the endpoint stays inert
   * rather than leaking — fail-closed default). Defaults to `[]`.
   */
  manifests?: readonly WorldManifestQuestSubset[];
  /**
   * Discord client accessor for `/guild-roles`. Defaults to the production
   * `getBotClient`; tests inject a mock so no real DISCORD_BOT_TOKEN / gateway
   * connection is required.
   */
  getClient?: (config: Config) => Promise<BotClient>;
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
          // cycle-009 · T5.4 — verify metrics for the cutover monitor (only when onboarding is on).
          onboarding: args.verifyRuntime?.enabled ? verifyMetricsSnapshot() : 'disabled',
        });
      }

      // Role-awareness surface — authenticated (X-Service-Token / Bearer),
      // fail-closed. Sibling of a future role-GRANT endpoint, so auth is
      // auth-grade here even though this is read-only.
      if (request.method === 'GET' && url.pathname === '/guild-roles') {
        return handleGuildRoles(request, url, args);
      }

      if (request.method === 'POST' && url.pathname === '/webhooks/discord') {
        return handleDiscordPost(request, publicKey, args);
      }

      // ─── cycle-009 · sprint-3 — onboarding verify web surface (C4) ──────
      // Gated by the verify runtime (off → 404, never leaks the routes). The
      // SIWE/OAuth flow is entirely separate from the Discord-signed webhook above.
      const vrt = args.verifyRuntime;
      if (vrt?.enabled) {
        if (request.method === 'GET' && url.pathname === '/verify/oauth/callback') {
          return handleOAuthCallback(url, vrt);
        }
        const complete = request.method === 'POST' && /^\/verify\/[0-9a-f]{32}\/complete$/.test(url.pathname);
        if (complete) {
          const token = url.pathname.split('/')[2]!;
          return handleVerifyComplete(token, request, vrt);
        }
        const root = request.method === 'GET' && /^\/verify\/[0-9a-f]{32}$/.test(url.pathname);
        if (root) {
          const token = url.pathname.split('/')[2]!;
          return handleVerifyRoot(token, vrt);
        }
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

/**
 * Maximum age of a Discord-signed request, in seconds. Beyond this, the
 * request is rejected as stale (replay protection · bridgebuilder F6
 * 2026-04-30). Discord's reference implementations use a 5-minute window.
 */
const SIGNATURE_FRESHNESS_WINDOW_SECONDS = 5 * 60;

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

  // Freshness check before crypto verify — rejects stale/replayed signatures
  // cheaply (no Ed25519 work on captured POSTs older than the window).
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return new Response('malformed signature timestamp', { status: 401 });
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_FRESHNESS_WINDOW_SECONDS) {
    return new Response('stale signature timestamp', { status: 401 });
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

  // cycle-Q · sprint-3 · Q3.5 (+ cycle-009 · sprint-2): forward MESSAGE_COMPONENT
  // (button) and MODAL_SUBMIT into dispatchSlashCommand · the dispatch entry
  // intercepts quest_* (isQuestInteraction) AND onboard:* (isOnboardingInteraction)
  // custom_ids before per-character resolution. Other button/modal interactions
  // fall through to the legacy ephemeral fallback below.
  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT ||
    interaction.type === InteractionType.MODAL_SUBMIT
  ) {
    const customId =
      (interaction as unknown as { data?: { custom_id?: string } }).data
        ?.custom_id ?? '';
    if (customId.startsWith('quest_') || customId.startsWith('onboard:')) {
      const response = await dispatchSlashCommand(
        interaction,
        args.config,
        args.characters,
      );
      return jsonResponse(response);
    }
  }

  // Other interaction types (autocomplete, non-quest components) aren't
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
// GET /guild-roles?world=SLUG — role-awareness surface
// ──────────────────────────────────────────────────────────────────────

/**
 * World-slug grammar accepted on `?world=`. Lowercase-leading, then
 * lowercase-alnum / hyphen, 2–21 chars total. Mirrors the slug shape used
 * across the world-manifest registry. Anything else → 400.
 */
const WORLD_SLUG_RE = /^[a-z][a-z0-9-]{1,20}$/;

/**
 * Structural subset of discord.js `Role` we read from `guild.roles.cache`.
 * Kept minimal so tests mock freely without constructing a real Role.
 */
interface RoleLike {
  readonly id: string;
  readonly name: string;
  readonly hexColor: string;
  readonly managed: boolean;
  readonly position: number;
}

/** Shape returned to the dashboard role picker (one entry per role). */
interface RoleView {
  readonly id: string;
  readonly name: string;
  /** `role.hexColor` — Discord emits "#000000" for no-color · surfaced as-is. */
  readonly color: string;
  readonly managed: boolean;
  readonly position: number;
}

/**
 * Constant-time service-token compare. Length is checked FIRST (and short-
 * circuits) so `timingSafeEqual` never throws on unequal-length buffers and
 * never leaks length via the exception path. The pre-check itself is not the
 * timing-sensitive comparison — the byte compare on equal-length buffers is.
 */
function serviceTokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extract the caller's service token. Primary header is `X-Service-Token`
 * (cluster seam-1 convention); `Authorization: Bearer <token>` is accepted as
 * a fallback. Returns null when neither is present.
 */
function extractServiceToken(request: Request): string | null {
  const direct = request.headers.get('X-Service-Token');
  if (direct) return direct;
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}

/**
 * GET /guild-roles?world=SLUG → the Discord roles of the guild the world maps
 * to, for the dashboard role-map editor's role picker.
 *
 * Auth (fail-closed): requires `ROLE_AWARENESS_SERVICE_TOKEN`. Unset → 503
 * (misconfigured). Missing / wrong caller token → 401. Constant-time compare.
 *
 * Response 200: `{ world, guild_id, roles: [{ id, name, color, managed,
 * position }] }` where `color` is `role.hexColor` (Discord emits "#000000"
 * for no-color — surfaced as-is). The `@everyone` role (id === guild.id) is
 * excluded; roles are sorted by `position` descending (top of the Discord
 * hierarchy first).
 */
export async function handleGuildRoles(
  request: Request,
  url: URL,
  args: InteractionServerArgs,
): Promise<Response> {
  // 1. AUTH — fail-closed. Unset env = misconfiguration, not a 401.
  // `.trim()` matches the repo convention (onboarding-runtime.ts:45) and
  // removes the trailing-newline silent-401 footgun. A whitespace-only env
  // trims to '' → still falls into the 503 misconfig gate, never a valid secret.
  const expectedToken = process.env.ROLE_AWARENESS_SERVICE_TOKEN?.trim();
  if (!expectedToken || expectedToken.length === 0) {
    console.error('guild-roles: ROLE_AWARENESS_SERVICE_TOKEN unset — refusing (503)');
    return jsonResponse({ error: 'service_misconfigured' }, 503);
  }
  const provided = extractServiceToken(request);
  if (!provided || !serviceTokenMatches(provided, expectedToken)) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // 2. INPUT — validate slug grammar before any lookup.
  const world = url.searchParams.get('world') ?? '';
  if (!WORLD_SLUG_RE.test(world)) {
    return jsonResponse({ error: 'invalid_world_slug' }, 400);
  }

  // 3. RESOLVE — world slug → guild_id via the manifests.
  const manifests = args.manifests ?? [];
  const guildId = resolveGuildForWorld(world, manifests);
  if (!guildId) {
    return jsonResponse({ error: 'world_not_found' }, 404);
  }

  // 4. FETCH — wrap so a rejected promise becomes a clean 500 (no crash, no
  //    internal error text leaked to the body).
  try {
    const getClient = args.getClient ?? getBotClient;
    const client = await getClient(args.config);
    if (!client || !client.isReady()) {
      return jsonResponse({ error: 'bot_unavailable' }, 503);
    }

    // Cache-first: the Guilds intent populates guild.roles.cache on the
    // gateway, so a cached guild avoids the REST round-trip. Fall back to
    // a fetch when the gateway hasn't cached it yet.
    const guild =
      client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
    // discord.js `guild.roles.cache` is a Collection (extends Map) — iterate
    // `.values()` to get Roles (a bare `for…of` over a Collection yields
    // [id, Role] tuples). Arrays expose `.values()` too, so test mocks work.
    const roleCache = guild.roles.cache as unknown as { values(): Iterable<RoleLike> };
    const roles: RoleView[] = [];
    for (const role of roleCache.values()) {
      // EXCLUDE @everyone — its id is identical to the FETCHED guild's id.
      if (role.id === guild.id) continue;
      roles.push({
        id: role.id,
        name: role.name,
        color: role.hexColor, // "#000000" for no-color · surfaced as-is
        managed: role.managed,
        position: role.position,
      });
    }
    // Discord role hierarchy: highest position first.
    roles.sort((x, y) => y.position - x.position);

    return jsonResponse({ world, guild_id: guildId, roles });
  } catch (err) {
    // Bot-not-in-guild is an expected, distinct failure — not a transient
    // backend error. discord.js DiscordAPIError exposes a numeric `.code`:
    //   10004 Unknown Guild   · the guild doesn't exist or the bot can't see it
    //   50001 Missing Access  · the bot isn't a member of the guild
    // Check `.code` defensively (apps/bot takes NO direct discord.js dep, so we
    // avoid importing DiscordAPIError — a property probe is enough). Genuine
    // transient failures (REST 500s, timeouts) still fall through to the 500.
    const code = (err as { code?: unknown }).code;
    if (code === 10004 || code === 50001) {
      return jsonResponse({ error: 'guild_not_joined' }, 404);
    }
    console.error('guild-roles: failed to fetch roles:', err);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
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
