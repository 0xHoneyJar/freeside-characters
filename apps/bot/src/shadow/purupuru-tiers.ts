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
 * Purupuru `community_tier_config`. ⚠ `sort_order` is PRESENTATION order, NOT
 * strength order — it does NOT match status for the elite tiers. Ground truth:
 *   • crowd (score-banded, ascending strength):
 *       newcomer(score 0-39) < member(40-69) < devoted(70-89) < core(90-99)
 *   • elite (rank-banded, OVERRIDES crowd — lower rank number = higher status):
 *       sovereign(rank 1-7, live=7 wallets) is the TOP; elder(rank 8-50,
 *       live=43 wallets) is next-strongest.
 * So although `sort_order` lists sovereign(5) before elder(6), sovereign is the
 * STRONGER tier. The STRENGTH ladder below corrects this:
 *   newcomer(1) < member(2) < devoted(3) < core(4) < elder(5) < sovereign(6)
 *
 * SEMANTIC ASSUMPTION (a CM should confirm): elite OVERRIDES crowd, so EVERY
 * elite tier ranks above EVERY crowd tier (core(4) < elder(5)). This follows
 * score-api's "elite overrides crowd" resolveTier model — a wallet's single
 * resolved `tier` is the elite one whenever it earns one. If a community ever
 * wants a high-score crowd wallet to outrank a low-rank elite wallet, this
 * cross-class ordering is the one knob to revisit.
 *
 * ⚠ The lore NAMES are PLACEHOLDERS (Jani/zerker calibrate, OQ-4). When the real
 * lore lands, update this map (and the matching score-api config) together. The
 * ranks are what's load-bearing; the names are display.
 */

/**
 * Purupuru tier → ordinal STRENGTH rank (higher = stronger). This is NOT
 * score-api's `sort_order` (which inverts the elite pair) — it is the corrected
 * status ladder: crowd ascending, then elite above all crowd, with sovereign
 * (rank 1-7) above elder (rank 8-50). See the file header for the grounding.
 */
export const PURUPURU_TIER_RANK: Readonly<Record<string, number>> = {
  // crowd (score-banded, ascending)
  newcomer: 1,
  member: 2,
  devoted: 3,
  core: 4,
  // elite (rank-banded, OVERRIDES crowd — sovereign rank 1-7 > elder rank 8-50)
  elder: 5,
  sovereign: 6,
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
