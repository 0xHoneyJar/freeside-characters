/**
 * Dimension-pulse payload · cycle-007 S8 r4 (operator pivot 2026-05-17)
 *
 * Mirrors score-dashboard's per-dimension card layout in Discord.
 * Voiceless · data-only · ruggy stays silent on digests · personality
 * lives in micro/weaver/lore_drop/question/callout posts instead.
 *
 * Source-of-truth for format is github.com/0xHoneyJar/score-dashboard
 * (HEAD aae96e4, 2026-05-16). Specifically:
 *   - src/components/home/dimension-card.tsx · render contract
 *   - src/lib/factor-labels.ts · verb-label fallback table
 *   - src/lib/design-tokens.ts:44-75 · DIMENSION_COLORS
 *   - src/app/actions.ts:1652-1656 · delta formula
 *
 * Honest-delta posture: when previous_period === 0 (delta_pct === null),
 * render ±N events directly. The dashboard caps to ±100% with a tooltip
 * caveat; Discord has no hover affordance so ±N events is the readable
 * answer. score-mcp returns both fields.
 */

import type {
  PulseDimensionBreakdown,
  PulseDimensionFactor,
  PulseDimension,
  ZoneId,
} from '../score/index.ts';
import type { DigestPayload, DiscordEmbed } from './embed.ts';

// ──────────────────────────────────────────────────────────────────────
// Dashboard hex (decimal) per dimension · score-dashboard /lib/design-tokens.ts:44-75
// ──────────────────────────────────────────────────────────────────────

const DIMENSION_COLORS: Record<PulseDimension | 'overall', number> = {
  og: 0xd6a83a, // ochre / gold
  nft: 0x7fdfe7, // cyan / teal
  onchain: 0x5cce80, // phosphor / light green
  overall: 0x808890, // grey (cross-dim · stonehenge)
};

// ──────────────────────────────────────────────────────────────────────
// Factor-action label fallback · mirrored from score-dashboard
// /src/lib/factor-labels.ts:19-52 (transition-period fallback table).
//
// score-mcp's PulseDimensionFactor.primary_action is the AUTHORITATIVE
// source · this map only fires when primary_action is null (historic /
// pre-catalog-update factors). Source-of-truth chain ends in score-api's
// /v1/config/factors::primaryAction (UnifiedFactorConfig, PR #96).
// ──────────────────────────────────────────────────────────────────────

const FACTOR_ACTION_LABELS: Readonly<Record<string, string>> = {
  // OG
  'og:sets': 'Acquired Sets',
  'og:articles': 'Minted Mirror Articles',
  'og:jani_keys': 'Bought Jani Keys',
  'og:cfang_keys': 'Bought CFang Keys',
  'og:cubquest': 'Earned OG CubQuest Badges',
  // NFT
  'nft:mibera': 'Traded Mibera',
  'nft:fractures': 'Minted Fractures',
  // Onchain
  'onchain:milady_burner': 'Burned Milady',
  'onchain:liquid_backing': 'Contributed to Liquid Backing',
  'onchain:loan_taker': 'Borrowed against Backing',
  'onchain:liquidator': 'Performed Liquidations',
  'onchain:paddle_supplier': 'Supplied to Paddle',
  'onchain:paddle_borrower': 'Pawned Miberas on Paddle',
  'onchain:paddle_liquidator': 'Performed Paddle Liquidations',
  'onchain:beraji_staker': 'Staked on Beraji',
  'onchain:miberamaker': 'Transacted $MIBERAMAKER333',
  'onchain:shadows_minter': 'Minted Shadows',
  'onchain:candies_minter': 'Minted Candies',
  'onchain:gif_minter': 'Minted GIFs',
  'onchain:tarot_minter': 'Minted Tarot',
  'onchain:validator_booster': 'Boosted Validator',
  'onchain:cubquest_badges': 'Earned CubQuest Badges',
  'onchain:zora_collector': 'Collected on Zora',
  'onchain:loan_defaulter': 'Defaulted on Loans',
  'onchain:paddle_liquidated': 'Got Liquidated on Paddle',
};

export function resolveFactorLabel(factor: PulseDimensionFactor): string {
  return (
    factor.primary_action ??
    FACTOR_ACTION_LABELS[factor.factor_id] ??
    factor.display_name
  );
}

// ──────────────────────────────────────────────────────────────────────
// Delta formatting
// ──────────────────────────────────────────────────────────────────────

const ARROW_UP = '↑';
const ARROW_DOWN = '↓';
const DASH = '—';
const NEUTRAL = ' '; // operator feedback 2026-05-17: em-dash on zero reads as
                    // "negative-ish" · drop sign entirely · just show "0%" or "0"

export interface DeltaFmt {
  readonly sign: string;
  readonly value: string;
}

/**
 * Format a delta for display. Honest-delta posture:
 * - previous = 0 (delta_pct === null) → return ±N events
 * - delta_pct !== 0 → return sign + percentage (1 decimal under 100, integer at/above)
 * - delta_pct === 0 → return NEUTRAL (no sign) + "0%" · operator-pushback closure
 */
export function fmtDelta(deltaPct: number | null, deltaCount: number): DeltaFmt {
  if (deltaPct === null) {
    // null pct + 0 count = both periods had zero activity · render as flat 0%
    // (dashboard would render em-dash here · operator pushback: neutral is cleaner)
    if (deltaCount === 0) return { sign: NEUTRAL, value: '0%' };
    const sign = deltaCount > 0 ? ARROW_UP : ARROW_DOWN;
    const value = `${deltaCount > 0 ? '+' : ''}${deltaCount}`;
    return { sign, value };
  }
  if (deltaPct === 0) return { sign: NEUTRAL, value: '0%' };
  const sign = deltaPct > 0 ? ARROW_UP : ARROW_DOWN;
  const abs = Math.abs(deltaPct);
  const rounded = abs >= 100 ? `${Math.round(deltaPct)}%` : `${deltaPct.toFixed(1)}%`;
  // Add explicit + for positive
  const value =
    deltaPct > 0 && !rounded.startsWith('+') ? `+${rounded}` : rounded;
  return { sign, value };
}

// Keep DASH exported for callers that want the explicit em-dash semantics
// (e.g., visually-loud "this section is empty"). NEUTRAL is the new default
// for zero-deltas inside fmtDelta.
export { DASH };

// ──────────────────────────────────────────────────────────────────────
// Table formatting for embed-field code blocks
//
// Discord renders triple-backtick code blocks in monospace. ASCII space
// padding works inside code blocks · we don't need U+2007 figure-space here
// (that's for OUT-of-code-block alignment per cycle-007 S3 D5 closure).
// ──────────────────────────────────────────────────────────────────────

const FIELD_VALUE_MAX = 1024; // Discord embed field value cap

function formatActiveFactorTable(
  factors: ReadonlyArray<PulseDimensionFactor>,
): string {
  if (factors.length === 0) return 'no factors with activity in this window';
  const rows = factors.map((f) => ({
    label: resolveFactorLabel(f),
    count: String(f.total),
    delta: fmtDelta(f.delta_pct, f.delta_count),
  }));
  // Pad every column to the widest value across rows. Operator feedback
  // 2026-05-17: "spacing for the tables must be appropriate and consistent
  // every single time" · 3-column rigid alignment fixes the wobble.
  const labelW = Math.max(...rows.map((r) => r.label.length));
  const countW = Math.max(...rows.map((r) => r.count.length));
  const deltaValueW = Math.max(...rows.map((r) => r.delta.value.length));
  return rows
    .map((r) => {
      const label = r.label.padEnd(labelW);
      const count = r.count.padStart(countW);
      // Single-char sign + space + right-padded value · keeps both columns
      // visually anchored even when one row is "↑ +520%" and the next is "  0%".
      const delta = `${r.delta.sign} ${r.delta.value.padStart(deltaValueW)}`;
      return `${label}  ${count}  ${delta}`;
    })
    .join('\n');
}

function formatColdFactorTable(
  factors: ReadonlyArray<PulseDimensionFactor>,
): string {
  if (factors.length === 0) return '';
  const rows = factors.map((f) => ({
    label: resolveFactorLabel(f),
    was: f.previous,
  }));
  const labelW = Math.max(...rows.map((r) => r.label.length));
  return rows
    .map((r) => `${r.label.padEnd(labelW)}  cold  was ${r.was}`)
    .join('\n');
}

function wrapCodeBlock(body: string): string {
  // Triple-backtick fenced · no language hint (plain monospace)
  return '```\n' + body + '\n```';
}

function clampToFieldValue(s: string): string {
  if (s.length <= FIELD_VALUE_MAX) return s;
  return s.slice(0, FIELD_VALUE_MAX - 16) + '…\n[truncated]';
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export interface BuildDimensionPulseOpts {
  readonly zone: ZoneId;
  readonly windowDays: 7 | 30 | 90;
  readonly generatedAt: string;
  /**
   * Cap on rows in the MOST ACTIVE section. Default 5 (matches dashboard
   * home variant). The dashboard detail variant uses unbounded; Discord
   * field char limit (1024) keeps this practical at 5-10.
   */
  readonly topFactorsLimit?: number;
  /**
   * Cap on rows in the WENT QUIET section. Default 5 (matches upstream
   * dashboard cap at /actions.ts:1724). Detail variant uses 10.
   */
  readonly coldFactorsLimit?: number;
}

/**
 * Build ONE dimension embed (single dim card · matches /dimension/{id} layout).
 *
 * Operator-refined 2026-05-17 (V2 layout):
 *   Title:   "NFT  ↑ +7.8%"            (delta-driven · 0% reads neutral with no sign)
 *   Desc:    "**152**"                 (hero number only · subtitle moved to footer)
 *   Fields:  "Most active this 7d" + (optional) "Went quiet · ..."
 *   Footer:  "events / 7d · 1/2 factors · zone: el-dorado"  (low-signal context · simple)
 *
 * env-configurable for future-me:
 *   DIM_CARD_VERBOSE=1 → restore the V1 verbose footer (See-all · date · old layout)
 */
const VERBOSE = process.env.DIM_CARD_VERBOSE === '1';

export function buildDimensionPulseEmbed(
  breakdown: PulseDimensionBreakdown,
  opts: BuildDimensionPulseOpts,
): DiscordEmbed {
  const color = DIMENSION_COLORS[breakdown.id] ?? DIMENSION_COLORS.overall;
  const delta = fmtDelta(breakdown.delta_pct, breakdown.delta_count);
  const activeCount = breakdown.total_factor_count - breakdown.inactive_factor_count;
  const topLimit = opts.topFactorsLimit ?? 5;
  const coldLimit = opts.coldFactorsLimit ?? 5;

  // Title · sign + space + value. NEUTRAL sign for zero is a single space ·
  // tightens to "NFT  0%" (no em-dash) per operator feedback.
  const titleSign = delta.sign.trim().length === 0 ? '' : `${delta.sign} `;
  const title = `${breakdown.display_name}  ${titleSign}${delta.value}`.replace(/\s+/g, ' ').trim();

  // Description · hero number only by default (V2). VERBOSE restores subtitle inline.
  const description = VERBOSE
    ? `**${breakdown.total_events}**\nevents / ${opts.windowDays}d · ${activeCount}/${breakdown.total_factor_count} factors`
    : `**${breakdown.total_events}**`;

  const fields: DiscordEmbed['fields'] = [];

  // Most active this {N}d
  const topFactors = breakdown.top_factors
    .filter((f) => f.total > 0)
    .slice(0, topLimit);
  fields.push({
    name: `Most active this ${opts.windowDays}d`,
    value:
      topFactors.length === 0
        ? 'No activity in this window'
        : clampToFieldValue(wrapCodeBlock(formatActiveFactorTable(topFactors))),
    inline: false,
  });

  // Went quiet · active prior, 0 this {N}d
  // Dashboard COLD threshold (score-dashboard/src/app/actions.ts:1713-1715):
  // `current_period === 0 AND previous_period > 0` · score-mcp's cold_factors
  // includes BOTH "went quiet" AND "never started" rows · filter to dashboard's
  // semantic (only show the dropouts · not the perpetually-inactive).
  const coldFactors = breakdown.cold_factors
    .filter((f) => f.previous > 0)
    .sort((a, b) => b.previous - a.previous) // dashboard sort: largest dropouts first
    .slice(0, coldLimit);
  if (coldFactors.length > 0) {
    fields.push({
      name: `Went quiet · active prior, 0 this ${opts.windowDays}d`,
      value: clampToFieldValue(wrapCodeBlock(formatColdFactorTable(coldFactors))),
      inline: false,
    });
  }

  // Footer · simplistic by default (V2): hero subtitle + zone. Drops See-all + date.
  // VERBOSE adds them back.
  const subtitle = `events / ${opts.windowDays}d · ${activeCount}/${breakdown.total_factor_count} factors`;
  const footerParts: string[] = VERBOSE
    ? [
        `zone: ${opts.zone}`,
        `${Math.min(topFactors.length, breakdown.total_factor_count)} of ${breakdown.total_factor_count} factors`,
        opts.generatedAt.slice(0, 10),
        ...(breakdown.total_factor_count > topFactors.length
          ? [`See all ${breakdown.total_factor_count} →`]
          : []),
      ]
    : [subtitle, `zone: ${opts.zone}`];

  return {
    color,
    title,
    description,
    fields,
    footer: { text: footerParts.join(' · ') },
  };
}

/**
 * Build a complete DigestPayload from one-or-many dimension breakdowns.
 *
 * For per-dimension zones (bear-cave/el-dorado/owsley-lab) the caller
 * passes the one matching dimension · single embed in the message.
 *
 * For stonehenge (cross-dim) the caller passes all 3 dimensions ·
 * Discord renders up to 10 embeds per message (we use 3 max).
 *
 * No `content` text · the operator's pivot 2026-05-17 explicitly removed
 * narrative voice from digests. The embeds carry everything.
 */
export function buildDimensionPulsePayload(
  breakdowns: ReadonlyArray<PulseDimensionBreakdown>,
  opts: BuildDimensionPulseOpts,
): DigestPayload {
  return {
    content: '',
    embeds: breakdowns.map((b) => buildDimensionPulseEmbed(b, opts)),
  };
}
