// cycle-008 capability-wiring slice 3 · "the shim, made honest".
//
// score/types.ts hand-mirrors score-mibera's schemas (RAW_STATS_SCHEMA_VERSION et al.).
// Invariant #4 (build doc): the shim MAY lag upstream, but it must be PROVABLY in sync —
// never silently stale. FAANG-shape: split the guard by tier rather than putting an
// authenticated live call in the per-PR gate (flaky, slow, couples CI to an external
// service, widens secret surface):
//
//   - OFFLINE tier (every PR · no secret): lock the local mirror against accidental edits
//     and assert the structural fields the digest path actually dereferences. Hermetic, fast.
//   - LIVE tier (MCP_KEY-gated · loud-skip): fetch the real score MCP and assert its advertised
//     schema_version is one this mirror is BUILT TO HANDLE (ACCEPTED_RAW_STATS_VERSIONS, which
//     mirrors the RawStats['schema_version'] union). A version outside that set = the mirror is
//     stale and must be extended. (We accept the whole handled-set, not a single pin: parseRow
//     auto-migrates v1→v2 so live emits 2.0.0 while RAW_STATS_SCHEMA_VERSION still labels the
//     mirrored base as 1.0.0 — both are handled.) Run where the key lives (railway / a scheduled
//     job), NOT keyless CI. The visible skip IS the "never silently stale" signal.
//
// The durable fix is producer-side (a consumer-driven contract verified in score-mibera's
// own CI) — that's the federation arc, not this slice (see NOTES cycle-007 "schema-keeper").

import { describe, expect, test } from 'bun:test';
import {
  RAW_STATS_SCHEMA_VERSION,
  getWindowEventCount,
  getWindowWalletCount,
  type RawStats,
  type ZoneDigest,
} from './types.ts';
import { fetchZoneDigest } from './client.ts';
import { loadConfig } from '../config.ts';

// The raw_stats schema_versions this consumer is built to HANDLE — must mirror the
// RawStats['schema_version'] union in types.ts. score's parseRow auto-migrates v1 → v2 on read,
// so live payloads advertise one of these (currently 2.0.0). ADDING a value here is the
// deliberate sync gesture — it pairs with a reviewed types.ts union edit, never a silent widening.
const ACCEPTED_RAW_STATS_VERSIONS = ['1.0.0', '2.0.0'] as const;

// "real upstream" = a key is present AND we are not in stub mode (STUB_MODE defaults to stub
// when unset, so real mode requires it explicitly false — see config.ts).
const LIVE_UPSTREAM = !!process.env.MCP_KEY && process.env.STUB_MODE === 'false';

if (!LIVE_UPSTREAM) {
  // Loud, visible in the runner output — the opposite of a silent pass.
  console.warn(
    '[schema-drift] MCP_KEY/STUB_MODE not set for real upstream — LIVE freshness check SKIPPED ' +
      '(run on railway/cron where the key lives). Offline mirror-integrity is still enforced.',
  );
}

describe('score shim · mirror integrity (offline · every PR · no key)', () => {
  test('pinned RAW_STATS_SCHEMA_VERSION is the documented value', () => {
    // Locks the const against accidental local edits. Bumping it is a conscious, reviewed
    // change paired with an upstream sync — this test failing means "you changed the mirror".
    expect(RAW_STATS_SCHEMA_VERSION).toBe('1.0.0');
  });

  test('the pinned version sits within the accepted set', () => {
    expect(ACCEPTED_RAW_STATS_VERSIONS as readonly string[]).toContain(RAW_STATS_SCHEMA_VERSION);
  });

  test('count helpers honor the v1→v2 field ladder the digest depends on', () => {
    const base: Omit<RawStats, 'schema_version'> = {
      top_movers: [],
      top_events: [],
      spotlight: null,
      rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
      factor_trends: [],
    };
    // v2: real window_* counts win
    const v2: RawStats = { ...base, schema_version: '2.0.0', window_event_count: 352, window_wallet_count: 15 };
    expect(getWindowEventCount(v2)).toBe(352);
    expect(getWindowWalletCount(v2)).toBe(15);
    // v1: falls back down the ladder to total_events / active_wallets
    const v1: RawStats = { ...base, schema_version: '1.0.0', total_events: 99, active_wallets: 7 };
    expect(getWindowEventCount(v1)).toBe(99);
    expect(getWindowWalletCount(v1)).toBe(7);
  });

  test('ZoneDigest carries the field paths enriched-render dereferences (structural contract)', () => {
    // A typed fixture that compiles is the compile-time half of the contract; these assertions
    // pin the runtime field paths the renderer walks (raw_stats.spotlight / factor_trends[].multiplier
    // / rank_changes.climbed). If upstream renames one, the live tier catches it; this documents it.
    const zd: ZoneDigest = {
      zone: 'owsley-lab',
      window: 'weekly',
      computed_at: 't',
      window_start: 't',
      window_end: 't',
      stale: false,
      schema_version: 'digest-snapshot/1.0.0',
      narrative: null,
      raw_stats: {
        schema_version: '2.0.0',
        window_event_count: 1,
        window_wallet_count: 1,
        top_movers: [],
        top_events: [],
        spotlight: { wallet: '0xAB00000000000000000000000000000000000Ccd', reason: 'rank_climb', details: {} },
        rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
        factor_trends: [{ factor_id: 'nft:mibera', current_count: 2, baseline_avg: 1, multiplier: 2 }],
      },
    };
    expect(zd.raw_stats).toHaveProperty('spotlight');
    expect(zd.raw_stats).toHaveProperty('factor_trends');
    expect(zd.raw_stats.rank_changes).toHaveProperty('climbed');
    expect(zd.raw_stats.factor_trends[0]).toHaveProperty('multiplier');
  });
});

describe('score shim · upstream freshness (live · MCP_KEY-gated · the key tier)', () => {
  // Loud skip when there's no real upstream — visible, never a silent pass. Detects REAL
  // upstream drift when run where the key lives (railway / scheduled monitor).
  test.skipIf(!LIVE_UPSTREAM)('live get_zone_digest advertises a version this mirror handles', async () => {
    const config = loadConfig();
    const zd = await fetchZoneDigest(config, 'owsley-lab');
    expect(typeof zd.raw_stats.schema_version).toBe('string');
    // The drift signal: upstream must advertise a version inside the handled-set. NOT a single-pin
    // equality — the mirror handles 1.0.0|2.0.0 and live emits 2.0.0, so `=== RAW_STATS_SCHEMA_VERSION`
    // (1.0.0) would false-fail. A value OUTSIDE the set (e.g. a future 3.0.0) means upstream moved
    // past what this mirror handles → the test fails → extend the union + ACCEPTED set deliberately.
    expect(ACCEPTED_RAW_STATS_VERSIONS as readonly string[]).toContain(zd.raw_stats.schema_version);
    // the renderer would break if these went missing upstream
    expect(zd.raw_stats).toHaveProperty('factor_trends');
    expect(zd.raw_stats).toHaveProperty('rank_changes');
  });
});
