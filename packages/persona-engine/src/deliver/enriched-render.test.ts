import { describe, expect, test } from 'bun:test';
import { buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2, prettyFactorName, deriveSpotlights } from './enriched-render.ts';
import type { ZoneDigest, Spotlight, TopMover } from '../score/index.ts';

// cycle-008 S9 → prod · the enriched digest renderer (real ZoneDigest → Components V2).

function zd(over: { wallets?: number; spotlight?: ZoneDigest['raw_stats']['spotlight'] } = {}): ZoneDigest {
  return {
    zone: 'owsley-lab',
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
      window_wallet_count: over.wallets ?? 15,
      top_movers: [],
      top_events: [],
      spotlight:
        over.spotlight === undefined
          ? { wallet: '0xAB00000000000000000000000000000000000Cd', reason: 'new_badge', details: {} }
          : over.spotlight,
      rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
      factor_trends: [{ factor_id: 'onchain:lp_provide', current_count: 40, baseline_avg: 20, multiplier: 2 }],
    },
  } as ZoneDigest;
}

describe('buildEnrichedDigestComponentsV2 (prod module)', () => {
  test('IS_COMPONENTS_V2 flag is 1<<15', () => {
    expect(IS_COMPONENTS_V2).toBe(32768);
  });

  test('maps real digest fields → hero, movers, spotlight, wallets', () => {
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(zd()));
    expect(json).toContain('# 352'); // hero from window_event_count
    expect(json).toContain('15 miberas warm'); // window_wallet_count · member noun
    expect(json).toContain('LP Provide'); // prettify fallback (acronym-aware) when no resolver
    expect(json).toContain('Spotlight');
    expect(json).not.toContain('—'); // em-dash core strip holds
    // gen-3/4 · "don't bold moves and spotlight" + normal casing — labels are subtext, capitalized
    expect(json).toContain('-# Movers');
    expect(json).toContain('-# Spotlight');
    expect(json).not.toContain('### movers');
    expect(json).not.toContain('### spotlight');
  });

  test('names + bolds the badge from spotlight.details.badge_name (operator RLHF 2026-05-23)', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        zd({ spotlight: { wallet: '0xAB00000000000000000000000000000000000Cd', reason: 'new_badge', details: { badge_name: 'True HODLer' } } }),
      ),
    );
    expect(json).toContain('earned **True HODLer**');
    expect(json).not.toContain('earned a new badge');
  });

  test('falls back to "a new badge" when no badge_name (backward-compatible)', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        zd({ spotlight: { wallet: '0xAB00000000000000000000000000000000000Cd', reason: 'new_badge', details: {} } }),
      ),
    );
    expect(json).toContain('earned a new badge');
  });

  test('omits the members-warm footer when window_wallet_count is 0 (never "0 miberas warm")', () => {
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(zd({ wallets: 15 })))).toContain('15 miberas warm');
    const zero = JSON.stringify(buildEnrichedDigestComponentsV2(zd({ wallets: 0 })));
    expect(zero).not.toContain('miberas warm');
    expect(zero).not.toContain('0 miberas'); // the live pulse path can report 0 → must not surface it
  });

  test('omits the spotlight section when raw_stats.spotlight is null', () => {
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(zd({ spotlight: null })));
    expect(json).not.toContain('spotlight');
  });

  test('rank-climb spotlight surfaces the actual movement (#prior → #current)', () => {
    const base = zd();
    const climber = '0xCL11111111111111111111111111111111111111';
    const withClimb = {
      ...base,
      raw_stats: {
        ...base.raw_stats,
        spotlight: { wallet: climber, reason: 'rank_climb', details: {} },
        rank_changes: {
          ...base.raw_stats.rank_changes,
          climbed: [{ wallet: climber, rank_delta: 5, dimension: 'onchain', prior_rank: 12, current_rank: 7 }],
        },
      },
    } as ZoneDigest;
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(withClimb, { resolveHandle: () => 'degenharu' }));
    expect(json).toContain('climbed #12 → #7'); // the real rank change, not just "climbed the ranks"
    expect(json).toContain('degenharu');
  });

  test('rank-climb spotlight with no matching mover falls back to prose', () => {
    const base = zd();
    const withClimb = {
      ...base,
      raw_stats: {
        ...base.raw_stats,
        spotlight: { wallet: '0xNOMATCH', reason: 'rank_climb', details: {} },
        rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
        top_movers: [],
      },
    } as ZoneDigest;
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(withClimb, { resolveHandle: () => 'an anonymous mibera' }));
    expect(json).toContain('climbed the ranks'); // graceful fallback when the mover isn't found
  });

  test('resolveFactorName injects MCP names; resolveHandle injects the spotlight identity', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(zd(), {
        resolveFactorName: (id) => (id === 'onchain:lp_provide' ? 'Liquid Backing' : id),
        resolveHandle: () => 'degenharu',
      }),
    );
    expect(json).toContain('Liquid Backing');
    expect(json).not.toContain('Lp Provide');
    expect(json).toContain('degenharu');
    expect(json).not.toContain('0xAB00'); // resolved handle replaces the raw wallet
  });

  test('window length derived from bounds (not hardcoded)', () => {
    const base = zd();
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(base))).toContain('last 7 days');
    const thirty = { ...base, window_start: '2026-04-23T00:00:00Z', window_end: '2026-05-23T00:00:00Z' };
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(thirty))).toContain('last 30 days');
  });

  test('prettyFactorName strips the namespace, title-cases, and keeps acronyms uppercased', () => {
    expect(prettyFactorName('onchain:lp_provide')).toBe('LP Provide');
    expect(prettyFactorName('nft:mibera')).toBe('Mibera');
    expect(prettyFactorName('og:nft_holder')).toBe('NFT Holder');
  });
});

// ── Multi-user spotlight (cycle-008 · the RLHF-winning V3 leaderboard direction) ──

const heroBadge = (wallet: string, badge: string): Spotlight => ({
  wallet,
  reason: 'new_badge',
  details: { badge_name: badge },
});
const mover = (wallet: string, prior: number, current: number): TopMover => ({
  wallet,
  rank_delta: prior - current,
  dimension: 'onchain',
  prior_rank: prior,
  current_rank: current,
});

/** zd() + multi-user knobs: climbers (rank_changes.climbed) and the V2 curated spotlights[]. */
function multiZd(
  o: { spotlight?: ZoneDigest['raw_stats']['spotlight']; climbed?: TopMover[]; spotlights?: Spotlight[] } = {},
): ZoneDigest {
  const base = zd({ spotlight: o.spotlight });
  return {
    ...base,
    raw_stats: {
      ...base.raw_stats,
      rank_changes: { ...base.raw_stats.rank_changes, climbed: o.climbed ?? [] },
      ...(o.spotlights ? { spotlights: o.spotlights } : {}),
    },
  } as ZoneDigest;
}

describe('deriveSpotlights (multi-user data shape)', () => {
  test('hero first, then climbers, in order', () => {
    const { entries } = deriveSpotlights(
      multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7), mover('0xC2', 41, 19)] }),
    );
    expect(entries.map((e) => e.spotlight.wallet)).toEqual(['0xHERO', '0xC1', '0xC2']);
    expect(entries[0]!.hero).toBe(true);
    expect(entries[0]!.synthesized).toBe(false); // curated hero
    expect(entries[1]!.hero).toBe(false);
    expect(entries[1]!.synthesized).toBe(true); // derived climber
  });

  test('dedups the hero out of the climber list (case-insensitive)', () => {
    const { entries } = deriveSpotlights(
      multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xhero', 84, 7), mover('0xC2', 41, 19)] }),
    );
    // 0xhero == 0xHERO → the hero is not rendered twice
    expect(entries.map((e) => e.spotlight.wallet.toLowerCase())).toEqual(['0xhero', '0xc2']);
  });

  test('caps at 3 and reports the climber overflow count', () => {
    const { entries, moreCount } = deriveSpotlights(
      multiZd({
        spotlight: heroBadge('0xHERO', 'True HODLer'),
        climbed: [mover('0xC1', 1, 2), mover('0xC2', 3, 4), mover('0xC3', 5, 6), mover('0xC4', 7, 8)],
      }),
      3,
    );
    expect(entries).toHaveLength(3); // hero + 2 climbers
    expect(moreCount).toBe(2); // hero + 4 climbers = 5 total, cap 3 → 2 overflow
  });

  test('prefers a curated raw_stats.spotlights[] over derivation (V2 hook)', () => {
    const { entries } = deriveSpotlights(
      multiZd({
        spotlight: heroBadge('0xDERIVED', 'Ignored'),
        climbed: [mover('0xC1', 1, 2)],
        spotlights: [
          { wallet: '0xCURATED1', reason: 'new_badge', details: { badge_name: 'Pioneer' } },
          { wallet: '0xCURATED2', reason: 'rank_climb', details: {} },
        ],
      }),
    );
    expect(entries.map((e) => e.spotlight.wallet)).toEqual(['0xCURATED1', '0xCURATED2']);
    expect(entries.every((e) => e.synthesized === false)).toBe(true); // curated → reason respected
  });

  test('empty when there is no curated spotlight and no climbers', () => {
    expect(deriveSpotlights(multiZd({ spotlight: null, climbed: [] })).entries).toHaveLength(0);
  });

  test('synthesized climbers carry their mover for the rank line', () => {
    const { entries } = deriveSpotlights(multiZd({ spotlight: null, climbed: [mover('0xC1', 84, 7)] }));
    expect(entries[0]!.spotlight.reason).toBe('rank_climb');
    expect(entries[0]!.mover?.prior_rank).toBe(84);
    expect(entries[0]!.mover?.current_rank).toBe(7);
  });
});

describe('buildEnrichedDigestComponentsV2 · multi-user spotlight board', () => {
  const handles: Record<string, string> = { '0xHERO': 'owsleymibera', '0xC1': 'jadebera', '0xC2': 'kaelbera' };
  const baseOpts = { resolveHandle: (w: string) => handles[w] ?? 'an anonymous mibera' };

  test('renders the leaderboard header + a section per entry; ONLY the hero gets ⚡', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7), mover('0xC2', 41, 19)] }),
        baseOpts,
      ),
    );
    expect(json).toContain('-# Spotlight'); // gen-2 leaderboard header (no ⚡, no "this week")
    expect(json).not.toContain('this week'); // window lives in the hoisted subtitle now
    expect(json).toContain('⚡ **owsleymibera** earned **True HODLer**'); // hero: bolt + curated badge
    expect(json).toContain('**jadebera** climbed #84 → #7'); // climber: rank line, no bolt
    expect(json).toContain('**kaelbera** climbed #41 → #19');
    expect(json.match(/⚡ \*\*/g) ?? []).toHaveLength(1); // the ⚡ marks exactly one featured user
  });

  test('option (b) badge-join: a climber with a matching recent badge reads "earned **Badge**"', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7), mover('0xC2', 41, 19)] }),
        { ...baseOpts, resolveBadge: (w) => (w === '0xC1' ? 'Diamond Paws' : null) },
      ),
    );
    expect(json).toContain('**jadebera** earned **Diamond Paws**'); // matched climber → badge
    expect(json).toContain('**kaelbera** climbed #41 → #19'); // unmatched climber → rank fallback
  });

  test('the badge-join NEVER overrides a curated hero (only synthesized climbers)', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7)] }),
        { ...baseOpts, resolveBadge: (w) => (w === '0xHERO' ? 'Should Not Apply To Hero' : null) },
      ),
    );
    expect(json).toContain('earned **True HODLer**'); // hero keeps its curated badge
    expect(json).not.toContain('Should Not Apply To Hero'); // a hero-wallet badge match is ignored
    expect(json).toContain('**jadebera** climbed #84 → #7'); // climber unmatched → rank line
  });

  test('per-entry escape: BOTH handle and badge run through escapeDiscordMarkdown', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7)] }),
        { resolveHandle: () => 'mibera_acquire', resolveBadge: () => 'Iron_Paws' },
      ),
    );
    // JSON.stringify doubles the escaping backslash → match "\\_" (two) in the JSON text.
    expect(json).toContain('mibera\\\\_acquire'); // handle escaped (underscore would italicize)
    expect(json).toContain('Iron\\\\_Paws'); // badge escaped
  });

  test('fail-soft per entry: a null pfp degrades that entry to handle-only; the digest still renders', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [mover('0xC1', 84, 7)] }),
        { ...baseOpts, resolvePfp: (w) => (w === '0xHERO' ? 'https://cdn/h.png' : null) },
      ),
    );
    expect(json).toContain('https://cdn/h.png'); // hero thumbnail present
    expect(json).toContain('jadebera'); // climber still rendered (bare TextDisplay, no thumbnail)
  });

  test('caps the board at 3 and footers the overflow as "+K more climbing"', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(
        multiZd({
          spotlight: heroBadge('0xHERO', 'True HODLer'),
          climbed: [mover('0xC1', 1, 2), mover('0xC2', 3, 4), mover('0xC3', 5, 6), mover('0xC4', 7, 8)],
        }),
        { resolveHandle: (w) => w.slice(0, 4) },
      ),
    );
    expect(json).toContain('+2 more climbing');
  });

  test('single spotlight (no climbers): gen-2 header is "-# Spotlight" with ⚡ on the featured user', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [] }), baseOpts),
    );
    expect(json).toContain('-# Spotlight'); // gen-2: header carries no ⚡
    expect(json).not.toContain('### ⚡ spotlight'); // the ⚡ moved off the header
    expect(json).not.toContain('this week');
    expect(json).toContain('⚡ **owsleymibera** earned **True HODLer**'); // sole ⚡ marks the lone featured user
  });

  test('window is hoisted into the subtitle in parens (gen-2), not on the hero count line', () => {
    const json = JSON.stringify(
      buildEnrichedDigestComponentsV2(multiZd({ spotlight: heroBadge('0xHERO', 'True HODLer'), climbed: [] }), baseOpts),
    );
    expect(json).toContain('(last 7 days)'); // window in the subtitle, parenthetical
    expect(json).toContain('# 352\\nevents'); // hero count line no longer carries the window
    expect(json).not.toContain('events · last'); // old placement gone
  });
});
