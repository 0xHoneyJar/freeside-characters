/**
 * world-config.test.ts — C-4 · single-tenant → multi-tenant cutover seam.
 *
 * The config service is NOT deployed (freeside-worlds arrakis-e5jk/C-6), so the
 * service is MOCKED here via an injected `fetchFn`. Coverage:
 *   - resolveWorld: seed (THJ + purupuru), env override (WORLD_GUILD_MAP),
 *     invalid env (ignored, no throw), DM/unknown/malformed → null.
 *   - fetchVerifyMessageConfig: happy 200, 404 fail-soft, 401 fail-soft,
 *     timeout/abort fail-soft, malformed body fail-soft, unset baseUrl no-op,
 *     service-token header forwarding.
 *   - resolveVerifyCardCopy: per-medium escaping (RENDER-CONTRACT), disabled
 *     surface → defaults, unknown guild → defaults.
 *   - buildVerifyCardForGuild: end-to-end (known+configured → per-world copy;
 *     unknown/outage → today's single-tenant card).
 */

import { describe, test, expect } from 'bun:test';
import {
  resolveWorld,
  effectiveGuildWorldMap,
  fetchVerifyMessageConfig,
  resolveVerifyCardCopy,
  buildVerifyCardForGuild,
  type VerifyMessageConfig,
} from '../world-config.ts';
import { ONBOARD_VERIFY_CUSTOM_ID } from '@freeside-characters/persona-engine/onboarding';

const THJ_GUILD = '1135545260538339420';
const PURUPURU_GUILD = '1495534680617910396';
const UNKNOWN_GUILD = '999999999999999999';

// A config-service 200 body (config-service app.ts shape).
function okBody(config: VerifyMessageConfig) {
  return {
    envelope: { schema_version: '1.0', world_slug: 'mibera', surface: 'verify-message', config },
    version: 3,
    updated_at: '2026-05-31T00:00:00Z',
  };
}

function mockFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(impl(String(url), init))) as unknown as typeof fetch;
}

const silentLogger = { warn: () => {} };

// ─── resolveWorld ──────────────────────────────────────────────────────────

describe('resolveWorld — guild → world_slug', () => {
  test('THJ guild seeds to mibera (verified slug-decision)', () => {
    expect(resolveWorld(THJ_GUILD, {})).toBe('mibera');
  });

  test('purupuru guild seeds to purupuru', () => {
    expect(resolveWorld(PURUPURU_GUILD, {})).toBe('purupuru');
  });

  test('unknown guild → null (fail-soft to single-tenant defaults)', () => {
    expect(resolveWorld(UNKNOWN_GUILD, {})).toBeNull();
  });

  test('DM / undefined / empty guild → null', () => {
    expect(resolveWorld(undefined, {})).toBeNull();
    expect(resolveWorld(null, {})).toBeNull();
    expect(resolveWorld('', {})).toBeNull();
  });

  test('malformed (non-snowflake) guild → null', () => {
    expect(resolveWorld('not-a-snowflake', {})).toBeNull();
    expect(resolveWorld('123', {})).toBeNull(); // too short
  });

  test('WORLD_GUILD_MAP env override wins over seed', () => {
    const env = { WORLD_GUILD_MAP: JSON.stringify({ [THJ_GUILD]: 'mongolian' }) };
    expect(resolveWorld(THJ_GUILD, env)).toBe('mongolian');
  });

  test('WORLD_GUILD_MAP env adds a new guild', () => {
    const env = { WORLD_GUILD_MAP: JSON.stringify({ [UNKNOWN_GUILD]: 'apdao' }) };
    expect(resolveWorld(UNKNOWN_GUILD, env)).toBe('apdao');
    // seed entries still present
    expect(resolveWorld(THJ_GUILD, env)).toBe('mibera');
  });

  test('invalid WORLD_GUILD_MAP (bad JSON) is ignored — never throws', () => {
    expect(() => resolveWorld(THJ_GUILD, { WORLD_GUILD_MAP: '{not json' })).not.toThrow();
    expect(resolveWorld(THJ_GUILD, { WORLD_GUILD_MAP: '{not json' })).toBe('mibera');
  });

  test('invalid WORLD_GUILD_MAP entries (bad key / bad slug) are skipped', () => {
    const env = {
      WORLD_GUILD_MAP: JSON.stringify({
        'bad-key': 'mibera', // non-snowflake key → skipped
        [UNKNOWN_GUILD]: 'Bad_Slug!', // invalid slug → skipped
      }),
    };
    expect(resolveWorld(UNKNOWN_GUILD, env)).toBeNull();
    expect(resolveWorld(THJ_GUILD, env)).toBe('mibera'); // seed intact
  });

  test('WORLD_GUILD_MAP as a JSON array (not object) is ignored', () => {
    expect(resolveWorld(THJ_GUILD, { WORLD_GUILD_MAP: '["a","b"]' })).toBe('mibera');
  });

  test('effectiveGuildWorldMap exposes the seed', () => {
    const map = effectiveGuildWorldMap({});
    expect(map[THJ_GUILD]).toBe('mibera');
    expect(map[PURUPURU_GUILD]).toBe('purupuru');
  });
});

// ─── fetchVerifyMessageConfig (mocked service) ──────────────────────────────

const sampleConfig: VerifyMessageConfig = {
  enabled: true,
  copy: { title: 'verify in the steppe', body: 'link your wallet, traveller.', buttonLabel: 'verify' },
};

describe('fetchVerifyMessageConfig — mocked config-service', () => {
  test('200 → returns the verify-message config', async () => {
    const fetchFn = mockFetch((url) => {
      expect(url).toBe('https://cfg.example/v1/config/mibera/verify-message');
      return new Response(JSON.stringify(okBody(sampleConfig)), { status: 200 });
    });
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example/',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toEqual(sampleConfig);
  });

  test('forwards x-service-token header when provided', async () => {
    const seen: { token: string | null } = { token: null };
    const fetchFn = mockFetch((_url, init) => {
      seen.token = new Headers(init?.headers).get('x-service-token');
      return new Response(JSON.stringify(okBody(sampleConfig)), { status: 200 });
    });
    await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      serviceToken: 'secret-token',
      fetchFn,
      logger: silentLogger,
    });
    expect(seen.token).toBe('secret-token');
  });

  test('404 (not configured) → null (fail-soft to defaults)', async () => {
    const fetchFn = mockFetch(() => new Response(JSON.stringify({ error: 'not_configured' }), { status: 404 }));
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'purupuru',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('401 (unauthorized) → null (fail-soft)', async () => {
    const fetchFn = mockFetch(() => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('5xx (outage) → null (fail-soft)', async () => {
    const fetchFn = mockFetch(() => new Response('boom', { status: 503 }));
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('malformed body (missing config) → null', async () => {
    const fetchFn = mockFetch(() => new Response(JSON.stringify({ envelope: {} }), { status: 200 }));
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('thrown fetch (network error) → null, never throws', async () => {
    const fetchFn = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('timeout (slow service) → null via AbortController', async () => {
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        // never resolve; reject when the AbortController fires.
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'mibera',
      fetchTimeoutMs: 10,
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
  });

  test('unset baseUrl → no fetch, null (service not deployed)', async () => {
    let called = false;
    const fetchFn = mockFetch(() => {
      called = true;
      return new Response('{}', { status: 200 });
    });
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: '',
      worldSlug: 'mibera',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
    expect(called).toBe(false);
  });

  test('malformed world_slug → no fetch, null', async () => {
    let called = false;
    const fetchFn = mockFetch(() => {
      called = true;
      return new Response('{}', { status: 200 });
    });
    const cfg = await fetchVerifyMessageConfig({
      configBaseUrl: 'https://cfg.example',
      worldSlug: 'Bad Slug!',
      fetchFn,
      logger: silentLogger,
    });
    expect(cfg).toBeNull();
    expect(called).toBe(false);
  });
});

// ─── resolveVerifyCardCopy (escaping + fail-soft) ───────────────────────────

describe('resolveVerifyCardCopy — per-event read path', () => {
  test('known + configured + enabled → per-world copy (escaped per-medium)', async () => {
    const cfg: VerifyMessageConfig = {
      enabled: true,
      // Raw-but-bounded copy with Discord-markdown structural chars to escape.
      copy: { title: 'verify *now*', body: 'use _this_ link `here`', buttonLabel: 'go|now' },
    };
    const fetchFn = mockFetch(() => new Response(JSON.stringify(okBody(cfg)), { status: 200 }));
    const copy = await resolveVerifyCardCopy({
      guildId: THJ_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    // RENDER-CONTRACT: markdown structural chars are backslash-escaped.
    expect(copy.title).toBe('verify \\*now\\*');
    expect(copy.body).toBe('use \\_this\\_ link \\`here\\`');
    expect(copy.buttonLabel).toBe('go\\|now');
  });

  test('unknown guild → {} (single-tenant defaults; no fetch)', async () => {
    let called = false;
    const fetchFn = mockFetch(() => {
      called = true;
      return new Response('{}', { status: 200 });
    });
    const copy = await resolveVerifyCardCopy({
      guildId: UNKNOWN_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    expect(copy).toEqual({});
    expect(called).toBe(false);
  });

  test('enabled=false → {} (surface OFF → code defaults)', async () => {
    const cfg: VerifyMessageConfig = {
      enabled: false,
      copy: { title: 'x', body: 'y', buttonLabel: 'z' },
    };
    const fetchFn = mockFetch(() => new Response(JSON.stringify(okBody(cfg)), { status: 200 }));
    const copy = await resolveVerifyCardCopy({
      guildId: THJ_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    expect(copy).toEqual({});
  });

  test('config outage (404) → {} (fail-soft)', async () => {
    const fetchFn = mockFetch(() => new Response('{}', { status: 404 }));
    const copy = await resolveVerifyCardCopy({
      guildId: THJ_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    expect(copy).toEqual({});
  });
});

// ─── buildVerifyCardForGuild (end-to-end) ───────────────────────────────────

interface CV2Container {
  type: number;
  components: Array<{ type: number; content?: string; components?: Array<{ label?: string; custom_id?: string }> }>;
}

function cardTexts(card: unknown[]): { texts: string[]; buttonLabel?: string; customId?: string } {
  const container = card[0] as CV2Container;
  const texts = container.components.filter((c) => c.type === 10).map((c) => c.content ?? '');
  const row = container.components.find((c) => c.type === 1);
  const button = row?.components?.[0];
  return { texts, buttonLabel: button?.label, customId: button?.custom_id };
}

describe('buildVerifyCardForGuild — the post-site seam', () => {
  test('known+configured+enabled world → per-world copy in the card', async () => {
    const cfg: VerifyMessageConfig = {
      enabled: true,
      copy: { title: 'enter the steppe', body: 'bind your wallet, wanderer.', buttonLabel: 'bind' },
    };
    const fetchFn = mockFetch(() => new Response(JSON.stringify(okBody(cfg)), { status: 200 }));
    const card = await buildVerifyCardForGuild({
      guildId: THJ_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    const { texts, buttonLabel, customId } = cardTexts(card);
    expect(texts.some((t) => t.includes('enter the steppe'))).toBe(true);
    expect(texts.some((t) => t.includes('bind your wallet'))).toBe(true);
    expect(buttonLabel).toBe('bind');
    // The custom_id binding is preserved (RT-6) — config only governs copy.
    expect(customId).toBe(ONBOARD_VERIFY_CUSTOM_ID);
  });

  test('unknown guild → identical to today single-tenant default card', async () => {
    const fetchFn = mockFetch(() => new Response('{}', { status: 200 }));
    const card = await buildVerifyCardForGuild({
      guildId: UNKNOWN_GUILD,
      configBaseUrl: 'https://cfg.example',
      fetchFn,
      env: {},
      logger: silentLogger,
    });
    const { texts, buttonLabel } = cardTexts(card);
    // The code-default verify card copy (verify-card.ts defaults).
    expect(texts.some((t) => t.includes('verify your wallet'))).toBe(true);
    expect(buttonLabel).toBe('verify');
  });

  test('config service down (no baseUrl) → single-tenant default card', async () => {
    const card = await buildVerifyCardForGuild({
      guildId: THJ_GUILD,
      configBaseUrl: undefined, // service not deployed
      env: {},
      logger: silentLogger,
    });
    const { buttonLabel } = cardTexts(card);
    expect(buttonLabel).toBe('verify'); // code default
  });
});
