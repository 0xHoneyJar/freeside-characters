/**
 * shadow/purupuru-tiers.ts — the Purupuru community tier LADDER (ordering).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The substrate's `RoleRule.qualifies` is `{ source: 'tier', min_tier: <string> }`
 * where `min_tier` is an OPAQUE tier id the substrate does not interpret
 * (score-api owns the values — #221). To evaluate "wallet qualifies for this rule"
 * we need a >= comparison, which needs an ORDERING over tier names. score-api's
 * `community_tier_config` HAS that ordering (`sort_order`), but the leaderboard
 * read returns only the `tier` STRING — not `sort_order`. So the ordering must
 * live on the consumer side.
 *
 * ── GROUNDING (score-api origin/main, read 2026-06-03) ───────────────────────
 * supabase/migrations/20260602_001_cycle032_purupuru_config.sql seeds the
 * Purupuru `community_tier_config` ladder (by `sort_order`):
 *   newcomer(1) < member(2) < devoted(3) < core(4) < sovereign(5) < elder(6)
 * (crowd: newcomer..core score-banded; elite: sovereign/elder rank-based —
 * elite overrides crowd, so a wallet's single `tier` is already the resolved
 * winner. The ladder here mirrors `sort_order` exactly so higher = stronger.)
 *
 * ⚠ The lore NAMES are PLACEHOLDERS (Jani/zerker calibrate, OQ-4). When the real
 * lore lands, update this map (and the matching score-api config) together. The
 * ranks are what's load-bearing; the names are display.
 */

/**
 * Purupuru tier → ordinal rank (higher = stronger). Mirrors score-api
 * `community_tier_config.sort_order` for community_id='purupuru'.
 */
export const PURUPURU_TIER_RANK: Readonly<Record<string, number>> = {
  newcomer: 1,
  member: 2,
  devoted: 3,
  core: 4,
  sovereign: 5,
  elder: 6,
};

/** A tier-rank resolver: a tier name → its ordinal, or undefined if unknown. */
export type TierRankResolver = (tier: string) => number | undefined;

/** The default resolver, grounded in the seeded Purupuru ladder. */
export const purupuruTierRank: TierRankResolver = (tier) =>
  PURUPURU_TIER_RANK[tier.toLowerCase()];

/**
 * Does `walletTier` satisfy `minTier` (>=) under `rank`? FAIL-CLOSED: an unknown
 * `walletTier` (not on the ladder) NEVER qualifies; an unknown `minTier` is a
 * misconfigured rule → NEVER qualifies (so a typo can't accidentally grant
 * everyone). A null/absent wallet tier (untiered wallet) never qualifies.
 */
export function tierQualifies(
  walletTier: string | null | undefined,
  minTier: string,
  rank: TierRankResolver = purupuruTierRank,
): boolean {
  if (walletTier == null) return false;
  const w = rank(walletTier);
  const m = rank(minTier);
  if (w === undefined || m === undefined) return false;
  return w >= m;
}
