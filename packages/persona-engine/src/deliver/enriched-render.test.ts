import { describe, expect, test } from 'bun:test';
import { buildEnrichedDigestComponentsV2, IS_COMPONENTS_V2, prettyFactorName } from './enriched-render.ts';
import type { ZoneDigest } from '../score/types.ts';

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
    expect(json).toContain('15 wallets warm'); // window_wallet_count
    expect(json).toContain('LP Provide'); // prettify fallback (acronym-aware) when no resolver
    expect(json).toContain('spotlight');
    expect(json).not.toContain('—'); // em-dash core strip holds
  });

  test('omits the wallets-warm footer when window_wallet_count is 0 (never "0 wallets warm")', () => {
    expect(JSON.stringify(buildEnrichedDigestComponentsV2(zd({ wallets: 15 })))).toContain('15 wallets warm');
    const zero = JSON.stringify(buildEnrichedDigestComponentsV2(zd({ wallets: 0 })));
    expect(zero).not.toContain('wallets warm');
    expect(zero).not.toContain('0 wallets'); // the live pulse path can report 0 → must not surface it
  });

  test('omits the spotlight section when raw_stats.spotlight is null', () => {
    const json = JSON.stringify(buildEnrichedDigestComponentsV2(zd({ spotlight: null })));
    expect(json).not.toContain('spotlight');
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
