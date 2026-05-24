// cycle-007 S8 r4 (operator pivot 2026-05-17): digests are voiceless ·
// renderer mirrors score-dashboard's per-dimension card · no LLM call ·
// no voice-memory read/write.
//
// This file replaces the cycle-006 T6.7 voice-memory tests which targeted
// a path that no longer exists. The new contract is exercised in:
//   - dimension-pulse-payload.test.ts (renderer unit tests)
//   - this file (orchestrator integration: stub port → DigestPostResult shape)

import { describe, expect, test } from 'bun:test';
import { composeDigestPost, pickSpotlightDisplay, httpsImageUrl, enrichSpotlightPfp } from './digest-orchestrator.ts';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { PulseDimensionBreakdown, ZoneDigest } from '../score/index.ts';
import type { ResolvedWallet } from './freeside_auth/server.ts';
import { IS_COMPONENTS_V2 } from '../deliver/enriched-render.ts';

function config(overrides: Partial<Config> = {}): Config {
  return {
    STUB_MODE: true,
    DIGEST_REACTION_BAR_ENABLED: true,
    LLM_PROVIDER: 'stub',
    VOICE_DISABLED: false,
    SCORE_API_URL: 'https://score-api-production.up.railway.app',
    FREESIDE_BASE_URL: 'https://api.freeside.0xhoneyjar.xyz',
    FREESIDE_AGENT_MODEL: 'reasoning',
    AWS_REGION: 'eu-central-1',
    BEDROCK_TEXT_REGION: 'us-west-2',
    BEDROCK_IMAGE_REGION: 'us-east-1',
    BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: 'us-east-1',
    BEDROCK_IMAGE_DEFAULT_ACTION: 'text_to_image',
    CACHE_DIR: '/tmp/score-cache',
    POP_IN_FRACTION: 0.05,
    DIGEST_TZ: 'UTC',
    ...overrides,
  } as Config;
}

const character = {
  id: 'ruggy',
  displayName: 'ruggy',
  weights: {},
  systemPromptPath: '',
  guildSlashCommandSet: 'none',
} as unknown as CharacterConfig;

function makeBreakdown(
  partial: Partial<PulseDimensionBreakdown> = {},
): PulseDimensionBreakdown {
  return {
    id: 'nft',
    display_name: 'NFT',
    total_events: 152,
    previous_period_events: 141,
    delta_pct: 7.8,
    delta_count: 11,
    inactive_factor_count: 1,
    total_factor_count: 2,
    top_factors: [
      {
        factor_id: 'nft:mibera',
        display_name: 'Mibera',
        primary_action: 'Traded Mibera',
        total: 152,
        previous: 140,
        delta_pct: 8.6,
        delta_count: 12,
      },
    ],
    cold_factors: [
      {
        factor_id: 'nft:fractures',
        display_name: 'Fractures',
        primary_action: 'Minted Fractures',
        total: 0,
        previous: 1,
        delta_pct: null,
        delta_count: -1,
      },
    ],
    ...partial,
  };
}

function scoreStub(breakdowns: PulseDimensionBreakdown[]): ScoreFetchPort {
  return {
    fetchDigestSnapshot: () => {
      throw new Error('pulse path · fetchDigestSnapshot must not be called');
    },
    fetchActivityPulse: async () => ({
      generatedAt: '2026-05-17T00:00:00Z',
      events: [],
    }),
    fetchDimensionBreakdowns: async () => ({
      generatedAt: '2026-05-17T00:00:00Z',
      breakdowns,
    }),
  };
}

describe('composeDigestPost · pulse path (cycle-007 S8 r4)', () => {
  test('single-dim zone (el-dorado) produces ONE embed with dashboard format', async () => {
    const result = await composeDigestPost(config(), character, 'el-dorado', {
      score: scoreStub([makeBreakdown({ id: 'nft', display_name: 'NFT' })]),
    });

    expect(result.postType).toBe('digest');
    expect(result.zone).toBe('el-dorado');
    expect(result.voice).toBe(''); // voiceless · no LLM call
    expect(result.payload.content).toBe('');
    expect(result.payload.embeds).toHaveLength(1);

    const embed = result.payload.embeds[0]!;
    // V2 layout (2026-05-17 operator refinement):
    //   - title is single-space collapsed (no double-space)
    //   - description is hero-only
    //   - subtitle moved to footer
    expect(embed.title).toBe('NFT ↑ +7.8%');
    expect(embed.description).toBe('**152**');
    expect(embed.footer!.text).toContain('events / 7d');
    expect(embed.footer!.text).toContain('1/2 factors');
    // Fields: Most active + Went quiet
    expect(embed.fields).toHaveLength(2);
    expect(embed.fields![0].name).toBe('Most active this 7d');
    expect(embed.fields![0].value).toContain('Traded Mibera');
    expect(embed.fields![1].name).toMatch(/Went quiet/);
    expect(embed.fields![1].value).toContain('Minted Fractures');
    expect(embed.fields![1].value).toContain('was 1');
    expect(embed.footer!.text).toContain('zone: el-dorado');
    // V2 simplistic footer · date dropped by default (DIM_CARD_VERBOSE=1 restores it)
  });

  test('cross-dim zone (stonehenge) produces 3 embeds in canonical order', async () => {
    const breakdowns: PulseDimensionBreakdown[] = [
      makeBreakdown({
        id: 'og',
        display_name: 'OG',
        total_events: 0,
        delta_pct: 0,
        delta_count: 0,
        top_factors: [],
        cold_factors: [],
        previous_period_events: 0,
        inactive_factor_count: 5,
        total_factor_count: 5,
      }),
      makeBreakdown({ id: 'nft', display_name: 'NFT' }),
      makeBreakdown({
        id: 'onchain',
        display_name: 'Onchain',
        total_events: 157,
        delta_pct: 55.4,
        delta_count: 56,
        previous_period_events: 101,
      }),
    ];
    const result = await composeDigestPost(config(), character, 'stonehenge', {
      score: scoreStub(breakdowns),
    });

    expect(result.payload.embeds).toHaveLength(3);
    expect(result.payload.embeds[0]!.title).toMatch(/^OG/);
    expect(result.payload.embeds[1]!.title).toMatch(/^NFT/);
    expect(result.payload.embeds[2]!.title).toMatch(/^Onchain/);
    // OG has zero activity · field shows empty-state copy
    expect(result.payload.embeds[0]!.fields![0].value).toBe('No activity in this window');
  });

  test('voice field is always empty string · no LLM call regardless of VOICE_DISABLED', async () => {
    const a = await composeDigestPost(config({ VOICE_DISABLED: false }), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    const b = await composeDigestPost(config({ VOICE_DISABLED: true }), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    expect(a.voice).toBe('');
    expect(b.voice).toBe('');
  });

  test('digest result preserves raw_stats so downstream consumers still parse', async () => {
    const result = await composeDigestPost(config(), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    expect(result.digest.zone).toBe('el-dorado');
    // raw_stats is the cycle-005 substrate shape · validate the bridge through.
    expect(result.digest.raw_stats).toBeDefined();
  });
});

// cycle-008 S9 · enriched-v2 surface (DIGEST_SURFACE flag · the RLHF-validated billboard).
function zoneDigestStub(partial: Partial<ZoneDigest> = {}): ZoneDigest {
  return {
    zone: 'el-dorado',
    window: 'weekly',
    computed_at: '2026-05-23T00:00:00Z',
    window_start: '2026-05-16T00:00:00Z',
    window_end: '2026-05-23T00:00:00Z',
    stale: false,
    schema_version: '2.0.0',
    narrative: null,
    narrative_error: null,
    raw_stats: {
      schema_version: '2.0.0',
      window_event_count: 352,
      window_wallet_count: 15,
      top_movers: [],
      top_events: [],
      spotlight: { wallet: '0xAB00000000000000000000000000000000000Cd', reason: 'new_badge', details: {} },
      rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
      factor_trends: [{ factor_id: 'nft:mibera', current_count: 152, baseline_avg: 76, multiplier: 2 }],
    },
    ...partial,
  } as ZoneDigest;
}

describe('composeDigestPost · enriched-v2 path (cycle-008 S9)', () => {
  const enrichedDeps = (over: Partial<Parameters<typeof composeDigestPost>[3]> = {}) => ({
    score: scoreStub([makeBreakdown({ id: 'nft', display_name: 'NFT' })]),
    fetchZoneDigest: async () => zoneDigestStub(),
    resolveSpotlightIdentity: async () => ({ handle: 'degenharu', pfp_url: null }),
    ...over,
  });

  test('flag on → payload carries IS_COMPONENTS_V2 + components (the enriched billboard)', async () => {
    const result = await composeDigestPost(config({ DIGEST_SURFACE: 'enriched-v2' }), character, 'el-dorado', enrichedDeps());
    expect(result.postType).toBe('digest');
    expect(result.voice).toBe(''); // enriched digest is voiceless like the pulse digest
    expect(result.payload.flags).toBe(IS_COMPONENTS_V2);
    expect(Array.isArray(result.payload.components)).toBe(true);
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('# 352'); // hero from real window_event_count
    expect(json).toContain('15 miberas warm'); // real window_wallet_count (not the pulse-path 0)
    expect(json).toContain('degenharu'); // resolved spotlight handle
    expect(json).not.toContain('0xAB00'); // NFR-29: raw wallet NEVER reaches prose
  });

  test('threads MCP factor display names from the breakdown catalog (not prettified)', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      enrichedDeps({
        score: scoreStub([
          makeBreakdown({
            top_factors: [
              { factor_id: 'nft:mibera', display_name: 'Mibera Trades', primary_action: 'x', total: 152, previous: 76, delta_pct: 1, delta_count: 1 },
            ],
          }),
        ]),
      }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('Mibera Trades'); // catalog display_name, not the prettified "Mibera"
  });

  test('spotlight resolver returning the member-noun fallback → "an anonymous mibera", never raw 0x', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      enrichedDeps({ resolveSpotlightIdentity: async () => ({ handle: 'an anonymous mibera', pfp_url: null }) }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('an anonymous mibera');
    expect(json).not.toContain('an anonymous keeper');
    expect(json).not.toContain('0xAB00');
  });

  test('no spotlight in raw_stats → no spotlight section, resolver not required', async () => {
    let resolverCalled = false;
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      enrichedDeps({
        fetchZoneDigest: async () =>
          zoneDigestStub({ raw_stats: { ...zoneDigestStub().raw_stats, spotlight: null } }),
        resolveSpotlightIdentity: async () => {
          resolverCalled = true;
          return { handle: 'unused', pfp_url: null };
        },
      }),
    );
    expect(resolverCalled).toBe(false); // resolver skipped when no spotlight
    expect(JSON.stringify(result.payload.components)).not.toContain('spotlight');
  });

  test('spotlight pfp_url → renders an NFT Thumbnail accessory on the spotlight section', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      enrichedDeps({
        resolveSpotlightIdentity: async () => ({
          handle: 'degenharu',
          pfp_url: 'https://assets.0xhoneyjar.xyz/mibera/1234.png',
        }),
      }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('https://assets.0xhoneyjar.xyz/mibera/1234.png');
    expect(json).toContain('"type":11'); // THUMBNAIL_TYPE accessory present
    expect(json).toContain('degenharu');
  });

  test('spotlight without pfp → handle only, no Thumbnail accessory', async () => {
    const result = await composeDigestPost(config({ DIGEST_SURFACE: 'enriched-v2' }), character, 'el-dorado', enrichedDeps());
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('degenharu');
    expect(json).not.toContain('"type":11'); // no thumbnail when pfp_url is null
  });

  test('default pulse path is unchanged when the flag is absent', async () => {
    const result = await composeDigestPost(config(), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    expect(result.payload.flags).toBeUndefined();
    expect(result.payload.components).toBeUndefined();
    expect(result.payload.embeds.length).toBeGreaterThan(0); // still the embed dashboard mirror
  });
});

// cycle-008 · multi-user spotlight board (the RLHF V3 leaderboard direction · option b badge-join)
describe('composeDigestPost · enriched-v2 multi-user spotlight (cycle-008)', () => {
  const HERO = '0xHE00000000000000000000000000000000000000';
  const C1 = '0xC100000000000000000000000000000000000000';
  const C2 = '0xC200000000000000000000000000000000000000';

  const multiDigest = (): ZoneDigest =>
    zoneDigestStub({
      raw_stats: {
        ...zoneDigestStub().raw_stats,
        spotlight: { wallet: HERO, reason: 'new_badge', details: { badge_name: 'True HODLer' } },
        rank_changes: {
          climbed: [
            { wallet: C1, rank_delta: 77, dimension: 'onchain', prior_rank: 84, current_rank: 7 },
            { wallet: C2, rank_delta: 22, dimension: 'onchain', prior_rank: 41, current_rank: 19 },
          ],
          dropped: [],
          entered_top_tier: [],
          exited_top_tier: [],
        },
      },
    });

  const handleOf: Record<string, string> = { [HERO]: 'owsleymibera', [C1]: 'jadebera', [C2]: 'kaelbera' };

  const multiDeps = (over: Partial<Parameters<typeof composeDigestPost>[3]> = {}) => ({
    score: scoreStub([makeBreakdown({ id: 'nft', display_name: 'NFT' })]),
    fetchZoneDigest: async () => multiDigest(),
    resolveSpotlightIdentity: async (w: string) => ({ handle: handleOf[w] ?? 'an anonymous mibera', pfp_url: null }),
    // deterministic default: no badges → climbers render rank-lines (overridden per-test)
    fetchRecentBadges: async () => ({ earnings: [], generated_at: '2026-05-23T00:00:00Z' }),
    ...over,
  });

  test('resolves identity for hero + each climber and renders the leaderboard (NFR-29 per entry)', async () => {
    const result = await composeDigestPost(config({ DIGEST_SURFACE: 'enriched-v2' }), character, 'el-dorado', multiDeps());
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('-# Spotlight'); // gen-2 header (no ⚡, no "this week")
    expect(json).toContain('owsleymibera'); // hero resolved
    expect(json).toContain('jadebera'); // climber 1 resolved
    expect(json).toContain('kaelbera'); // climber 2 resolved
    expect(json).toContain('climbed #84 → #7'); // climber rank line (empty badge feed)
    expect(json).not.toContain('0xHE0'); // NFR-29: no raw wallet, any entry
    expect(json).not.toContain('0xC10');
    expect(json).not.toContain('0xC20');
  });

  test('option (b) badge-join: an injected get_recent_badges upgrades the matching climber', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      multiDeps({
        fetchRecentBadges: async () => ({
          earnings: [
            { badge_id: 'b1', badge_name: 'Diamond Paws', badge_type: 'count', rarity: 'rare', description: null, earned_at: '2026-05-22T00:00:00Z', wallet: C1 },
          ],
          generated_at: '2026-05-23T00:00:00Z',
        }),
      }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('**jadebera** earned **Diamond Paws**'); // matched climber → badge
    expect(json).toContain('**kaelbera** climbed #41 → #19'); // unmatched climber → rank fallback
    expect(json).toContain('earned **True HODLer**'); // curated hero keeps its own badge
  });

  test('badge-join window guard: a badge earned OUTSIDE the digest window is ignored (no stale attribution)', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      multiDeps({
        fetchRecentBadges: async () => ({
          // window is 2026-05-16 → 2026-05-23 (zoneDigestStub); this badge is from a month before.
          earnings: [
            { badge_id: 'b0', badge_name: 'Ancient Relic', badge_type: 'count', rarity: 'rare', description: null, earned_at: '2026-04-01T00:00:00Z', wallet: C1 },
          ],
          generated_at: '2026-05-23T00:00:00Z',
        }),
      }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).not.toContain('Ancient Relic'); // out-of-window badge not attributed to this-week climb
    expect(json).toContain('**jadebera** climbed #84 → #7'); // climber falls back to its rank line
  });

  test('the badge feed is NOT fetched when there are no climbers (single-spotlight digest)', async () => {
    let badgeCalled = false;
    await composeDigestPost(config({ DIGEST_SURFACE: 'enriched-v2' }), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
      fetchZoneDigest: async () => zoneDigestStub(), // climbed: [] → single spotlight only
      resolveSpotlightIdentity: async () => ({ handle: 'degenharu', pfp_url: null }),
      fetchRecentBadges: async () => {
        badgeCalled = true;
        return { earnings: [], generated_at: '' };
      },
    });
    expect(badgeCalled).toBe(false); // the common single-spotlight digest adds zero new MCP calls
  });

  test('badge feed fail-soft: a throwing feed → climbers render rank-lines, the digest still ships', async () => {
    const result = await composeDigestPost(
      config({ DIGEST_SURFACE: 'enriched-v2' }),
      character,
      'el-dorado',
      multiDeps({
        fetchRecentBadges: async () => {
          throw new Error('score-mcp unavailable');
        },
      }),
    );
    const json = JSON.stringify(result.payload.components);
    expect(json).toContain('climbed #84 → #7'); // option (a) fallback held
    expect(json).toContain('-# Spotlight'); // digest never blocked on the badge enrichment
  });
});

// cycle-008 capability-wiring slice 1 · the load-bearing NFR-29 logic, unit-tested without a DB.
describe('pickSpotlightDisplay · NFR-29 spotlight fallback ladder', () => {
  const base: ResolvedWallet = {
    found: true,
    wallet: '0xab00000000000000000000000000000000000ccd',
    handle: null,
    discord_id: null,
    discord_username: null,
    mibera_id: null,
    pfp_url: null,
    fallback: '0xAB00…00Cd',
    resolved_via: 'direct',
  };

  test('display_name (handle) wins over everything', () => {
    const id = pickSpotlightDisplay({ ...base, handle: 'nomadbera', discord_username: 'nomad', mibera_id: 'MIBERA-1' });
    expect(id.handle).toBe('nomadbera');
  });

  test('falls to discord_username when no display_name', () => {
    const id = pickSpotlightDisplay({ ...base, discord_username: 'nomad', mibera_id: 'MIBERA-1' });
    expect(id.handle).toBe('nomad');
  });

  test('falls to mibera_id when no display_name and no discord (operator choice)', () => {
    const id = pickSpotlightDisplay({ ...base, mibera_id: 'MIBERA-1234' });
    expect(id.handle).toBe('MIBERA-1234');
  });

  test('falls to the member noun when nothing resolves — NEVER the truncated wallet', () => {
    const id = pickSpotlightDisplay({ ...base, found: false, resolved_via: 'unknown' });
    expect(id.handle).toBe('an anonymous mibera');
    expect(id.handle).not.toContain('0x');
    expect(id.handle).not.toBe(base.fallback); // .fallback (truncated 0x) is never surfaced
  });

  test('passes an https pfp through; drops a non-https one', () => {
    expect(pickSpotlightDisplay({ ...base, pfp_url: 'https://cdn.x/1.png' }).pfp_url).toBe('https://cdn.x/1.png');
    expect(pickSpotlightDisplay({ ...base, pfp_url: 'http://cdn.x/1.png' }).pfp_url).toBeNull();
  });
});

describe('httpsImageUrl · pfp thumbnail guard', () => {
  test('passes https urls verbatim', () => {
    expect(httpsImageUrl('https://assets.0xhoneyjar.xyz/m/1.png')).toBe('https://assets.0xhoneyjar.xyz/m/1.png');
  });
  test('drops http, data, and malformed urls and null', () => {
    expect(httpsImageUrl('http://insecure.example/x.png')).toBeNull();
    expect(httpsImageUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(httpsImageUrl('not a url')).toBeNull();
    expect(httpsImageUrl(null)).toBeNull();
  });
});

describe('enrichSpotlightPfp · inventory-api NFT pfp enrichment (Issue #87)', () => {
  test('keeps the DB pfp when present (DB wins)', async () => {
    const id = await enrichSpotlightPfp(
      { handle: 'nomadbera', pfp_url: 'https://db/pfp.png' },
      '0xabc',
      async () => 'https://nft/art.png',
    );
    expect(id.pfp_url).toBe('https://db/pfp.png');
  });

  test('falls back to inventory NFT artwork when DB pfp is null', async () => {
    const id = await enrichSpotlightPfp(
      { handle: 'nomadbera', pfp_url: null },
      '0xabc',
      async () => 'https://nft/art.png',
    );
    expect(id.pfp_url).toBe('https://nft/art.png');
    expect(id.handle).toBe('nomadbera');
  });

  test('https-filters the inventory url (non-https dropped → unchanged)', async () => {
    const id = await enrichSpotlightPfp(
      { handle: 'nomadbera', pfp_url: null },
      '0xabc',
      async () => 'ipfs://Qm/art.png',
    );
    expect(id.pfp_url).toBeNull();
  });

  test('fail-soft: null from inventory leaves the identity unchanged (never anon from a stall)', async () => {
    const id = await enrichSpotlightPfp(
      { handle: 'nomadbera', pfp_url: null },
      '0xabc',
      async () => null,
    );
    expect(id.pfp_url).toBeNull();
    expect(id.handle).toBe('nomadbera');
  });
});
