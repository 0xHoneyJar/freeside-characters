/**
 * Factor translation table — vendored from mibera-dimensions
 * `lib/midi/score-api-factors.ts` (V0.5-C, 2026-04-29).
 *
 * Score-mcp returns factor IDs as machine labels (`nft:mibera`,
 * `og:sets`, `onchain:lp_provide`). This table maps them to human
 * names + descriptions so ruggy's prose says "Mibera NFT" instead of
 * "`nft:mibera`".
 *
 * Migration target: when freeside-auth ships a translation MCP, swap
 * implementation; in-bot factors MCP stays as the persona-facing
 * surface. Keeping a stale label here is preferable to importing midi
 * directly — single-writer + low-coupling per ECS doctrine.
 *
 * Source: midi `lib/midi/score-api-factors.ts` (28 factors as of
 * 2026-04-29). Add new factors as they ship in midi.
 */

export type FactorDimension = 'og' | 'nft' | 'onchain';

export interface FactorEntry {
  id: string;
  name: string;
  dimension: FactorDimension;
  description: string;
}

export const FACTORS: Record<string, FactorEntry> = {
  // OG dimension
  'og:jani_keys': {
    id: 'og:jani_keys',
    name: 'Jani Keys',
    dimension: 'og',
    description: 'Jani Friend.tech keys on Base.',
  },
  'og:cfang_keys': {
    id: 'og:cfang_keys',
    name: 'CFang Keys',
    dimension: 'og',
    description: 'CFang Friend.tech keys on Base.',
  },
  'og:articles': {
    id: 'og:articles',
    name: 'Mibera Articles',
    dimension: 'og',
    description: '7 canonical Mibera lore articles (ERC-721 on Optimism).',
  },
  'og:sets': {
    id: 'og:sets',
    name: 'Mibera Sets',
    dimension: 'og',
    description: 'Mibera Sets on Optimism.',
  },
  'og:cubquest': {
    id: 'og:cubquest',
    name: 'CubQuest OG',
    dimension: 'og',
    description: 'OG CubQuest badges: Mibera Demon & Ketamine Queen.',
  },

  // NFT dimension
  'nft:mibera': {
    id: 'nft:mibera',
    name: 'Mibera NFT',
    dimension: 'nft',
    description: 'Mibera NFT trading activity, holdings, and timing.',
  },
  'nft:fractures': {
    id: 'nft:fractures',
    name: 'Fractures',
    dimension: 'nft',
    description: 'Mibera Fracture NFTs.',
  },
  'nft:mibera_quality': {
    id: 'nft:mibera_quality',
    name: 'Mibera Quality',
    dimension: 'nft',
    description: 'Quality / rarity tier of held Mibera NFTs.',
  },
  'nft:fractures_complete': {
    id: 'nft:fractures_complete',
    name: 'Fracture Sets',
    dimension: 'nft',
    description: 'Complete Fracture sets (10 of 10).',
  },

  // Onchain dimension
  'onchain:miberamaker': {
    id: 'onchain:miberamaker',
    name: 'MiberaMaker',
    dimension: 'onchain',
    description: '$MIBERAMAKER333 ERC-20 token on Base.',
  },
  'onchain:mibera_burner': {
    id: 'onchain:mibera_burner',
    name: 'Mibera Burner',
    dimension: 'onchain',
    description: 'Mibera NFTs burned.',
  },
  'onchain:milady_burner': {
    id: 'onchain:milady_burner',
    name: 'Milady Burner',
    dimension: 'onchain',
    description: 'Milady NFTs burned.',
  },
  'onchain:liquid_backing': {
    id: 'onchain:liquid_backing',
    name: 'Liquid Backing Contributor',
    dimension: 'onchain',
    description: 'BERA contributed to liquid backing.',
  },
  'onchain:loan_taker': {
    id: 'onchain:loan_taker',
    name: 'Loan Taker',
    dimension: 'onchain',
    description: 'Loans taken through the liquid backing.',
  },
  'onchain:liquidator': {
    id: 'onchain:liquidator',
    name: 'Liquidator',
    dimension: 'onchain',
    description: 'Liquidations through the liquid backing.',
  },
  'onchain:beraji_staker': {
    id: 'onchain:beraji_staker',
    name: 'Beraji Staker',
    dimension: 'onchain',
    description: 'Mibera NFT staking on Beraji.',
  },
  'onchain:paddle_supplier': {
    id: 'onchain:paddle_supplier',
    name: 'Paddle Supplier',
    dimension: 'onchain',
    description: 'WBERA supplied to PaddleFi.',
  },
  'onchain:paddle_borrower': {
    id: 'onchain:paddle_borrower',
    name: 'Paddle Borrower',
    dimension: 'onchain',
    description: 'Miberas pawned as collateral on PaddleFi.',
  },
  'onchain:paddle_liquidator': {
    id: 'onchain:paddle_liquidator',
    name: 'Paddle Liquidator',
    dimension: 'onchain',
    description: 'Liquidations performed on PaddleFi.',
  },
  'onchain:validator_booster': {
    id: 'onchain:validator_booster',
    name: 'Validator Booster',
    dimension: 'onchain',
    description: 'BGT boosted to the Ancient Mibera validator.',
  },
  'onchain:shadow_minter': {
    id: 'onchain:shadow_minter',
    name: 'Shadow Minter',
    dimension: 'onchain',
    description: 'Shadow VM NFT mints on Honeyroad.',
  },
  'onchain:tarot_minter': {
    id: 'onchain:tarot_minter',
    name: 'Tarot Minter',
    dimension: 'onchain',
    description: 'Tarot card NFT mints on Honeyroad.',
  },
  'onchain:candies_minter': {
    id: 'onchain:candies_minter',
    name: 'Candies Minter',
    dimension: 'onchain',
    description: 'Candy NFT mints on Honeyroad.',
  },
  'onchain:gif_minter': {
    id: 'onchain:gif_minter',
    name: 'GIF Minter',
    dimension: 'onchain',
    description: 'MiGIF NFT mints on Honeyroad.',
  },
  'onchain:zora_collector': {
    id: 'onchain:zora_collector',
    name: 'Zora Collector',
    dimension: 'onchain',
    description: 'Zora collects.',
  },
  'onchain:cubquest_minter': {
    id: 'onchain:cubquest_minter',
    name: 'CubQuest Minter',
    dimension: 'onchain',
    description: 'Onchain CubQuest badges earned through ecosystem challenges.',
  },
  'onchain:loan_defaulter': {
    id: 'onchain:loan_defaulter',
    name: 'Loan Defaulter',
    dimension: 'onchain',
    description: 'Defaults through the liquid backing.',
  },
  'onchain:paddle_liquidated': {
    id: 'onchain:paddle_liquidated',
    name: 'Paddle Liquidated',
    dimension: 'onchain',
    description: 'Mibera positions liquidated on PaddleFi.',
  },

  // Aliases for legacy IDs ruggy may see in stub data.
  // These map to the canonical Mibera Acquire / lp_provide flow until
  // score-api emits the canonical IDs only.
  'onchain:lp_provide': {
    id: 'onchain:lp_provide',
    name: 'LP Provide',
    dimension: 'onchain',
    description: 'Liquidity provided to AMM pools.',
  },
  'nft:honeycomb': {
    id: 'nft:honeycomb',
    name: 'Honeycomb',
    dimension: 'nft',
    description: 'Honeycomb NFT — early THJ membership artifact.',
  },
  'nft:gen3': {
    id: 'nft:gen3',
    name: 'Gen3',
    dimension: 'nft',
    description: 'Third-generation NFT cohort.',
  },
  'og:henlocked': {
    id: 'og:henlocked',
    name: 'Henlocked',
    dimension: 'og',
    description: 'Henlocked — OG community badge.',
  },
  'og:cubquests': {
    id: 'og:cubquests',
    name: 'CubQuests',
    dimension: 'og',
    description: 'CubQuests participation.',
  },
};

export function translateFactor(factor_id: string): FactorEntry | null {
  return FACTORS[factor_id] ?? null;
}

export function describeFactor(factor_id: string): string {
  const entry = FACTORS[factor_id];
  if (!entry) return factor_id;
  return entry.name;
}
