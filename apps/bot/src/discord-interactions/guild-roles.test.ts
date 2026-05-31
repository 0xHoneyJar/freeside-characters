// guild-roles.test.ts — GET /guild-roles?world=SLUG role-awareness surface.
//
// Covers the auth-grade, fail-closed handler exported from server.ts:
//   - 503 when ROLE_AWARENESS_SERVICE_TOKEN is unset (misconfigured)
//   - 401 when the caller token is missing or wrong (constant-time compare)
//   - 400 when ?world= fails the slug grammar
//   - 404 when no manifest claims the world
//   - 200 happy path: roles mapped, @everyone excluded, sorted position-desc
//   - 500 when the discord fetch rejects (clean, no leaked error text)
//   - 503 when the bot client is unavailable / not ready
//
// The discord client + manifests are injected via InteractionServerArgs, so
// no real DISCORD_BOT_TOKEN or gateway connection is required.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Config } from '@freeside-characters/persona-engine';
import { handleGuildRoles, type InteractionServerArgs } from './server.ts';
import type { WorldManifestQuestSubset } from '../world-resolver.ts';

// The mock client only needs the surface handleGuildRoles touches: isReady()
// + guilds.fetch() → { id, roles.cache }. Typed via the getClient slot on
// InteractionServerArgs (no direct discord.js dependency in apps/bot).
type GetClient = NonNullable<InteractionServerArgs['getClient']>;
type BotClient = Awaited<ReturnType<GetClient>>;

const TOKEN = 'svc-token-abcdef-0123456789';
const GUILD_ID = '111111111111111111';

const MANIFESTS: readonly WorldManifestQuestSubset[] = [
  { slug: 'mongolian', tenant_id: 'mibera', guild_ids: [GUILD_ID] },
];

// A discord.js Role is iterable out of guild.roles.cache (a Collection). We
// only read id/name/hexColor/managed/position, so a plain array of these
// structural objects is a faithful stand-in.
const ROLE_EVERYONE = {
  id: GUILD_ID, // @everyone shares the guild id — must be excluded
  name: '@everyone',
  hexColor: '#000000',
  managed: false,
  position: 0,
};
const ROLE_MOD = {
  id: '222',
  name: 'Moderator',
  hexColor: '#ff0000',
  managed: false,
  position: 5,
};
const ROLE_MEMBER = {
  id: '333',
  name: 'Member',
  hexColor: '#000000', // no-color — surfaced as-is
  managed: false,
  position: 2,
};
const ROLE_BOT = {
  id: '444',
  name: 'BotManaged',
  hexColor: '#00ff00',
  managed: true,
  position: 8,
};

// A discord.js DiscordAPIError carries a numeric `.code`. We stand it in with
// a plain Error + a `code` property so the handler's defensive `.code` probe
// (no direct discord.js dep in apps/bot) matches what production sees.
class FakeDiscordAPIError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
  }
}

function fakeGuild(id: string) {
  return {
    id,
    roles: {
      // Unsorted on purpose so the handler's sort is exercised.
      // An array exposes `.values()`, matching the Collection the
      // handler iterates in production.
      cache: [ROLE_MEMBER, ROLE_BOT, ROLE_EVERYONE, ROLE_MOD],
    },
  };
}

function mockClient(
  over: Partial<{
    ready: boolean;
    fetchThrows: boolean;
    fetchRejectCode: number;
    cacheHit: boolean;
  }> = {},
): BotClient {
  const ready = over.ready ?? true;
  // Cache-first lookup: by default the cache MISSES (empty Map) so existing
  // tests still exercise the `guilds.fetch` REST fallback. `cacheHit: true`
  // pre-populates the cache so the handler should NOT call fetch.
  const cache = new Map<string, ReturnType<typeof fakeGuild>>();
  if (over.cacheHit) cache.set(GUILD_ID, fakeGuild(GUILD_ID));
  return {
    isReady: () => ready,
    guilds: {
      cache,
      fetch: async (id: string) => {
        if (over.fetchRejectCode !== undefined) {
          throw new FakeDiscordAPIError(over.fetchRejectCode, 'discord REST — internal detail');
        }
        if (over.fetchThrows) throw new Error('discord REST 500 — internal detail');
        return fakeGuild(id);
      },
    },
  } as unknown as BotClient;
}

function makeArgs(
  over: Partial<InteractionServerArgs> = {},
  clientOver: Partial<{
    ready: boolean;
    fetchThrows: boolean;
    fetchRejectCode: number;
    cacheHit: boolean;
  }> = {},
): InteractionServerArgs {
  return {
    config: {} as Config,
    characters: [],
    manifests: MANIFESTS,
    getClient: async () => mockClient(clientOver),
    ...over,
  };
}

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/guild-roles', { headers });
}

function urlFor(world: string | null): URL {
  const u = new URL('http://localhost/guild-roles');
  if (world !== null) u.searchParams.set('world', world);
  return u;
}

describe('GET /guild-roles — auth (fail-closed)', () => {
  afterEach(() => {
    delete process.env.ROLE_AWARENESS_SERVICE_TOKEN;
  });

  test('503 when ROLE_AWARENESS_SERVICE_TOKEN is unset', async () => {
    delete process.env.ROLE_AWARENESS_SERVICE_TOKEN;
    const res = await handleGuildRoles(req({ 'X-Service-Token': TOKEN }), urlFor('mongolian'), makeArgs());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'service_misconfigured' });
  });

  test('401 when caller token is missing', async () => {
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
    const res = await handleGuildRoles(req(), urlFor('mongolian'), makeArgs());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('401 when caller token is wrong', async () => {
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': 'wrong-token-same-len-aaaaaa' }),
      urlFor('mongolian'),
      makeArgs(),
    );
    expect(res.status).toBe(401);
  });

  test('401 (not 500/throw) when caller token has a DIFFERENT length', async () => {
    // The auth block runs OUTSIDE the try/catch, and timingSafeEqual throws on
    // unequal-length buffers — so the length pre-check in serviceTokenMatches is
    // load-bearing. A single-char token against the multi-char configured secret
    // must return 401 cleanly, never propagate a RangeError as a 500.
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': 'x' }),
      urlFor('mongolian'),
      makeArgs(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('whitespace-only ROLE_AWARENESS_SERVICE_TOKEN trims to misconfig (503), not a valid secret', async () => {
    // A trailing-whitespace / whitespace-only env must NOT become a usable
    // secret. `.trim()` collapses it to '' → the 503 misconfig gate fires.
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = '   ';
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': '   ' }),
      urlFor('mongolian'),
      makeArgs(),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'service_misconfigured' });
  });

  test('Authorization: Bearer is accepted as a fallback', async () => {
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
    const res = await handleGuildRoles(
      req({ Authorization: `Bearer ${TOKEN}` }),
      urlFor('mongolian'),
      makeArgs(),
    );
    expect(res.status).toBe(200);
  });
});

describe('GET /guild-roles — input validation', () => {
  beforeEach(() => {
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.ROLE_AWARENESS_SERVICE_TOKEN;
  });

  test('400 on a bad slug (uppercase / illegal chars)', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('Mongolian!'),
      makeArgs(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_world_slug' });
  });

  test('400 when ?world is absent', async () => {
    const res = await handleGuildRoles(req({ 'X-Service-Token': TOKEN }), urlFor(null), makeArgs());
    expect(res.status).toBe(400);
  });

  test('404 when no manifest claims the world', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('unknown-world'),
      makeArgs(),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'world_not_found' });
  });
});

describe('GET /guild-roles — fetch + mapping', () => {
  beforeEach(() => {
    process.env.ROLE_AWARENESS_SERVICE_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.ROLE_AWARENESS_SERVICE_TOKEN;
  });

  test('200 happy path — roles mapped, @everyone excluded, sorted position desc', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs(),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      world: string;
      guild_id: string;
      roles: Array<{ id: string; name: string; color: string; managed: boolean; position: number }>;
    };
    expect(body.world).toBe('mongolian');
    expect(body.guild_id).toBe(GUILD_ID);

    // @everyone (id === guild.id) excluded.
    expect(body.roles.find((r) => r.id === GUILD_ID)).toBeUndefined();
    expect(body.roles).toHaveLength(3);

    // Sorted by position descending: BotManaged(8) > Moderator(5) > Member(2).
    expect(body.roles.map((r) => r.id)).toEqual(['444', '222', '333']);

    // Field mapping: color comes from hexColor; "#000000" surfaced as-is.
    expect(body.roles[1]).toEqual({
      id: '222',
      name: 'Moderator',
      color: '#ff0000',
      managed: false,
      position: 5,
    });
    expect(body.roles.find((r) => r.id === '333')?.color).toBe('#000000');
    expect(body.roles.find((r) => r.id === '444')?.managed).toBe(true);
  });

  test('200 cache-first — a cached guild is served without a REST fetch', async () => {
    // The Guilds intent populates guilds.cache on the gateway. When the guild
    // is already cached, the handler must read from cache and skip guilds.fetch.
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({}, { cacheHit: true }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guild_id: string; roles: Array<{ id: string }> };
    expect(body.guild_id).toBe(GUILD_ID);
    // @everyone still excluded; same 3 roles surface from the cached guild.
    expect(body.roles.map((r) => r.id)).toEqual(['444', '222', '333']);
  });

  test('404 guild_not_joined when the bot is not in the guild (Unknown Guild 10004)', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({}, { fetchRejectCode: 10004 }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'guild_not_joined' });
  });

  test('404 guild_not_joined on Missing Access (50001)', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({}, { fetchRejectCode: 50001 }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'guild_not_joined' });
  });

  test('503 when the bot client is not ready', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({}, { ready: false }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'bot_unavailable' });
  });

  test('503 when getClient resolves null (no DISCORD_BOT_TOKEN)', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({ getClient: async () => null }),
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'bot_unavailable' });
  });

  test('500 when the discord fetch rejects — no internal error text leaked', async () => {
    const res = await handleGuildRoles(
      req({ 'X-Service-Token': TOKEN }),
      urlFor('mongolian'),
      makeArgs({}, { fetchThrows: true }),
    );
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toBe(JSON.stringify({ error: 'internal_error' }));
    expect(body).not.toContain('internal detail');
  });
});
