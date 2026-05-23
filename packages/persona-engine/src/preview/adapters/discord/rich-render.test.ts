import { describe, expect, test } from 'bun:test';
import { buildSnapshot } from '../../core/canonical-cases.ts';
import { resolveVariants, variantById } from '../../core/billboard-variants.ts';
import { renderCandidate } from '../../core/render-candidate.ts';
import { buildBillboardEmbed, buildBillboardComponentsV2, buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2 } from './rich-render.ts';
import type { ZoneDigest } from '../../../score/types.ts';
import { presentToDiscord } from './present.ts';
import type { VoiceAugment } from '../../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · rich Discord surfaces (embed · components-v2) from the visual-primitives dig.

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const active = () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 });
const quiet = () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: 0 });

describe('buildBillboardEmbed', () => {
  test('hero metric as H1 + zone title + footer; color = red when down', () => {
    const e = buildBillboardEmbed(active());
    expect(e.description).toContain('# 352'); // H1 hero
    expect(e.title).toMatch(/owsley/i);
    expect(e.color).toBe(0xed4245); // down → red
    expect(e.footer?.text).toContain('30d rolling');
    expect(e.fields?.some((f) => f.name === 'trend')).toBe(true);
  });

  test('flat delta → zone color, no trend field', () => {
    const e = buildBillboardEmbed(quiet());
    expect(e.color).toBe(0x6f4ea1); // owsley flat
    expect(e.fields?.some((f) => f.name === 'trend')).toBe(false);
  });
});

describe('buildBillboardComponentsV2', () => {
  test('returns a Container (type 17) with text-display children + accent color', () => {
    const c = buildBillboardComponentsV2(active()) as Array<{ type: number; accent_color?: number; components?: unknown[] }>;
    expect(c[0]!.type).toBe(17);
    expect(c[0]!.accent_color).toBe(0xed4245);
    expect(Array.isArray(c[0]!.components)).toBe(true);
  });
  test('IS_COMPONENTS_V2 flag is 1<<15', () => {
    expect(IS_COMPONENTS_V2).toBe(32768);
  });
});

describe('buildEnrichedDigestComponentsV2 (real ZoneDigest → enriched layout)', () => {
  const zd = (): ZoneDigest => ({
    zone: 'owsley-lab',
    window: 'weekly',
    computed_at: '2026-05-23T00:00:00Z',
    window_start: '2026-05-16T00:00:00Z',
    window_end: '2026-05-23T00:00:00Z',
    stale: false,
    schema_version: '2.0.0',
    narrative: null,
    raw_stats: {
      schema_version: '2.0.0',
      window_event_count: 352,
      window_wallet_count: 15,
      top_movers: [],
      top_events: [],
      spotlight: { wallet: '0xAB00000000000000000000000000000000000Cd', reason: 'new_badge', details: {} },
      rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
      factor_trends: [
        { factor_id: 'onchain:lp_provide', current_count: 40, baseline_avg: 20, multiplier: 2 },
        { factor_id: 'onchain:cold_storage', current_count: 5, baseline_avg: 30, multiplier: 0.2 },
      ],
    },
  });

  test('maps real digest fields → hero, movers, spotlight, wallets', () => {
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(zd()));
    expect(json).toContain('# 352'); // hero from window_event_count
    expect(json).toContain('15 miberas warm'); // window_wallet_count · member noun
    expect(json).toContain('movers');
    expect(json).toContain('LP Provide'); // factor_id prettified, acronym-aware (catalog = MCP)
    expect(json).toContain('spotlight');
    expect(json).toContain('earned a new badge'); // spotlight reason
    expect(json).toContain('0xAB00…00Cd'); // shortened wallet fallback
    expect(json).not.toContain('—'); // em-dash core strip holds
  });

  test('resolveHandle + resolvePfp inject handle + NFT thumbnail (the prod pfp_url path)', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(zd(), {
        resolveHandle: () => 'degenharu',
        resolvePfp: () => 'https://midi.test/pfp/degenharu.png',
      }),
    );
    expect(json).toContain('degenharu');
    expect(json).toContain('midi.test/pfp'); // Thumbnail accessory uses the pfp_url
    expect(json).toContain('"type":11'); // Thumbnail
  });

  test('window length is derived from the digest bounds, not hardcoded', () => {
    const d = zd(); // fixture window is 7 days (05-16 → 05-23)
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(d))).toContain('last 7 days');
    const thirty = { ...d, window_start: '2026-04-23T00:00:00Z', window_end: '2026-05-23T00:00:00Z' };
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(thirty))).toContain('last 30 days');
    // malformed bounds → validated 7-day fallback (never crash, never fabricate a wild number)
    const bad = { ...d, window_start: 'not-a-date', window_end: 'also-bad' };
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(bad))).toContain('last 7 days');
  });

  test('resolveFactorName injects MCP display names (not the prettify fallback)', () => {
    const withMcp = JSON.stringify(
      buildEnrichedDigestComponentsV2(zd(), {
        resolveFactorName: (id) => (id === 'onchain:lp_provide' ? 'Liquid Backing' : id),
      }),
    );
    expect(withMcp).toContain('Liquid Backing'); // the MCP-provided name
    expect(withMcp).not.toContain('Lp Provide'); // prettify fallback NOT used when resolver present
  });
});

describe('present renders the data beat per surface', () => {
  test('embed candidate posts an embeds[] data beat (not text)', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      if (String(url).includes('?wait=true')) bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: String(bodies.length), channel_id: 'c' }), { status: 200 });
    }) as unknown as typeof fetch;

    const batch = {
      batchId: 'b', zone: 'owsley-lab', zoneDisplay: 'Owsley Lab', snapshot: active(), voice: VOICE,
      candidates: [renderCandidate(active(), VOICE, variantById('embed-billboard')!)],
    };
    await presentToDiscord(batch, { webhookUrl: 'https://x/y', fetchImpl, sleepImpl: async () => {} });
    // one body must carry an embed (the data beat)
    expect(bodies.some((b) => Array.isArray(b.embeds) && (b.embeds as unknown[]).length > 0)).toBe(true);
  });

  test('components-v2 candidate posts a flags+components data beat', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = (async (url: string, init: { body: string }) => {
      if (String(url).includes('?wait=true')) bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: String(bodies.length), channel_id: 'c' }), { status: 200 });
    }) as unknown as typeof fetch;
    const batch = {
      batchId: 'b', zone: 'owsley-lab', zoneDisplay: 'Owsley Lab', snapshot: active(), voice: VOICE,
      candidates: [renderCandidate(active(), VOICE, variantById('components-v2')!)],
    };
    await presentToDiscord(batch, { webhookUrl: 'https://x/y', fetchImpl, sleepImpl: async () => {} });
    expect(bodies.some((b) => b.flags === IS_COMPONENTS_V2 && Array.isArray(b.components))).toBe(true);
  });
});
