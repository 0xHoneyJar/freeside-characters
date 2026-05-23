import { describe, expect, test, afterEach } from 'bun:test';
import { deliverZoneDigest } from './post.ts';
import { IS_COMPONENTS_V2 } from './enriched-render.ts';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { DigestPayload } from './embed.ts';

// cycle-008 S9 · the legacy single-webhook delivery branch must speak Components V2
// (?with_components=true + {flags, components}) for the enriched digest surface, and stay
// byte-identical for plain content/embed payloads. (Pattern-B + bot branches need a live
// discord.js client/webhook; they share the same beat shape and are exercised at canary.)

const origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = origFetch;
});

const character = {
  id: 'ruggy',
  displayName: 'ruggy',
  weights: {},
  systemPromptPath: '',
  guildSlashCommandSet: 'none',
} as unknown as CharacterConfig;

// legacy webhook branch = DISCORD_WEBHOOK_URL set, NO DISCORD_BOT_TOKEN.
const cfg = () => ({ DISCORD_WEBHOOK_URL: 'https://discord.test/webhook' }) as unknown as Config;

function captureFetch(): Array<{ url: string; body: Record<string, unknown> }> {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return calls;
}

describe('deliverZoneDigest · legacy webhook · Components V2', () => {
  test('components payload → ?with_components=true + {flags, components}, no content/embeds', async () => {
    const calls = captureFetch();
    const payload: DigestPayload = {
      content: '🏜 El Dorado',
      embeds: [],
      flags: IS_COMPONENTS_V2,
      components: [{ type: 17, accent_color: 0x6f4ea1, components: [{ type: 10, content: '# 352' }] }],
    };
    const r = await deliverZoneDigest(cfg(), character, 'el-dorado', payload);
    expect(r.via).toBe('webhook-fallback');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('with_components=true');
    expect(calls[0]!.body.flags).toBe(IS_COMPONENTS_V2);
    expect(calls[0]!.body.components).toBeDefined();
    expect(calls[0]!.body.content).toBeUndefined(); // CV2 sends only flags+components
  });

  test('plain payload → unchanged (no ?with_components; content/embeds in body)', async () => {
    const calls = captureFetch();
    const payload: DigestPayload = { content: 'the lab is quiet', embeds: [] };
    await deliverZoneDigest(cfg(), character, 'owsley-lab', payload);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).not.toContain('with_components');
    expect(calls[0]!.body.content).toBe('the lab is quiet');
    expect(calls[0]!.body.flags).toBeUndefined();
  });

  test('two-beat with a CV2 secondary → first beat plain, second beat Components V2', async () => {
    const calls = captureFetch();
    const payload: DigestPayload = {
      content: 'voice beat',
      embeds: [],
      secondary: { content: '', embeds: [], flags: IS_COMPONENTS_V2, components: [{ type: 17, components: [] }] },
    };
    await deliverZoneDigest(cfg(), character, 'el-dorado', payload);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).not.toContain('with_components'); // beat 1 = plain voice
    expect(calls[0]!.body.content).toBe('voice beat');
    expect(calls[1]!.url).toContain('with_components=true'); // beat 2 = CV2
    expect(calls[1]!.body.flags).toBe(IS_COMPONENTS_V2);
  });
});
