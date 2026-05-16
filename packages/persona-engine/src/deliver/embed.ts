/**
 * Discord post payload builder — varies shape by post type.
 *
 * digest / weaver / callout    → rich embed (sidebar color, structured)
 * micro / lore_drop / question → plain message.content (no embed)
 *
 * For embedded types: ALWAYS populate `message.content` as graceful
 * fallback for users with embeds disabled.
 *
 * Cycle R Sprint 3: opts.medium threads through @0xhoneyjar/medium-registry
 * descriptors. Default is DISCORD_WEBHOOK_DESCRIPTOR (Pattern B shell-bot
 * delivery) per architect lock A4 + the SKP-001 ctx-split. Future
 * non-Discord consumers (cli-renderer, telegram-renderer cycles) pass
 * their own descriptor.
 */

import {
  DISCORD_WEBHOOK_DESCRIPTOR,
  hasCapability,
  mediumIdOf,
  type MediumCapability,
} from '@0xhoneyjar/medium-registry';
import type {
  FactorStats,
  PulseDimensionBreakdown,
  PulseDimensionFactor,
  ZoneDigest,
  ZoneId,
} from '../score/types.ts';
import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';
import type { ProseGateValidation } from './prose-gate.ts';
import { POST_TYPE_SPECS, type PostType } from '../compose/post-types.ts';
import {
  escapeDiscordMarkdown,
  stripToolMarkup,
  stripVoiceDisciplineDrift,
  type VoiceMediumId,
} from './sanitize.ts';

/**
 * Discord-as-Material sanitize for the pulse-card path (cycle-005 UX nit
 * 2026-05-16): factor display_names often contain underscores (e.g.
 * `Boosted_Validator`, `mibera_acquire`) which Discord italicizes mid-word
 * without `escapeDiscordMarkdown`. Voice surface (header/outro) also runs
 * through `stripVoiceDisciplineDrift` to honor the em-dash / asterisk-
 * roleplay invariants. Mirrors `buildPostPayload` lines 99-100 pattern.
 */
function sanitizeForDiscord(text: string, opts: { isVoice?: boolean } = {}): string {
  if (!text) return text;
  let out = text;
  if (opts.isVoice) {
    out = stripVoiceDisciplineDrift(out, { postType: 'digest', mediumId: 'discord-webhook' });
  }
  return escapeDiscordMarkdown(out);
}

const DIRECTION_COLORS = {
  green: 0x2ecc71,
  red: 0xe74c3c,
  gray: 0x95a5a6,
  yellow: 0xf39c12,
} as const;

const ZONE_COLORS: Record<ZoneId, number> = {
  stonehenge: 0x808890,
  'bear-cave': 0x9b6a3f,
  'el-dorado': 0xc9a44c,
  'owsley-lab': 0x6f4ea1,
};

export interface DigestPayload {
  content: string;
  embeds: DiscordEmbed[];
}

export interface DiscordEmbed {
  color?: number;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

export interface BuildPostPayloadOpts {
  /**
   * Active medium descriptor. Cycle R Sprint 3 — defaults to
   * DISCORD_WEBHOOK_DESCRIPTOR (Pattern B shell-bot · the persona-bot
   * default). Pass DISCORD_INTERACTION_DESCRIPTOR for slash-command
   * responses or CLI_DESCRIPTOR for cli-renderer pre-formatting.
   */
  readonly medium?: MediumCapability;
}

export function buildPostPayload(
  digest: ZoneDigest,
  voice: string,
  postType: PostType,
  opts: BuildPostPayloadOpts = {},
): DigestPayload {
  const spec = POST_TYPE_SPECS[postType];
  const medium = opts.medium ?? DISCORD_WEBHOOK_DESCRIPTOR;
  const mediumId = mediumIdOf(medium) as VoiceMediumId;

  // Strip tool-call markup FIRST — defense in depth for the production
  // digest leak (2026-05-13). Primary defense lives in orchestrator/
  // index.ts (skip text from tool-using assistant turns), but this
  // catches any stringified tool-call that slips through (LLM emitting
  // tool-call as text in a synthesis turn). No-op when the orchestrator
  // produced clean output.
  const toolMarkupStripped = stripToolMarkup(voice);
  // Voice discipline runs BEFORE markdown escape: strip em-dashes,
  // asterisk roleplay, and (non-digest) closing signoffs. Digest is the
  // only post-type that retains "stay groovy 🐻"-style closings per
  // discord-native-register doctrine. Per cmp-boundary §9 voice-discipline
  // drift class · cycle R cmp-boundary-architecture S1. Sprint 3 threads
  // mediumId for CLI ANSI-strip + future medium-specific register tunes.
  const voiceCleaned = stripVoiceDisciplineDrift(toolMarkupStripped, { postType, mediumId });
  const sanitized = escapeDiscordMarkdown(voiceCleaned);

  // Cycle R Sprint 3 — gate embed shape on registry capability. Most
  // calls land DISCORD_WEBHOOK_DESCRIPTOR which has embed=true; the
  // gate is a safety net for future non-Discord callers.
  const useEmbed = spec.useEmbed && hasCapability(medium, 'embed');

  if (!useEmbed) {
    // Plain content for micro / lore_drop / question OR for any medium
    // that doesn't render embeds (CLI · future Telegram).
    return {
      content: sanitized,
      embeds: [],
    };
  }

  // Embedded types: digest / weaver / callout
  const flavor = ZONE_FLAVOR[digest.zone];
  const stats = digest.raw_stats;

  const hasSpike = stats.spotlight !== null || stats.factor_trends.some((t) => t.multiplier > 2);
  const isThin = !digest.narrative && digest.narrative_error !== null;
  const hasDrops = stats.rank_changes.dropped.length > 0;

  const color =
    postType === 'callout'
      ? DIRECTION_COLORS.red // callout always red
      : isThin
        ? DIRECTION_COLORS.yellow
        : hasSpike
          ? DIRECTION_COLORS.green
          : hasDrops && stats.rank_changes.climbed.length === 0
            ? DIRECTION_COLORS.red
            : ZONE_COLORS[digest.zone];

  const fallback = buildFallback(digest, postType);
  // Staleness-aware footer (V0.12.0 fix, 2026-05-13): per operator's
  // producer/consumer/middle-zone framing, the middle zone (us, persona-
  // engine) is responsible for surfacing data validity. Two signals
  // combined: substrate-emitted `stale: boolean` (score-mibera's own
  // freshness flag) OR `computed_at` older than 8 days (weekly digest
  // should refresh within 7 days; 8-day buffer accounts for slack between
  // cron fires).
  //
  // Surface staleness in the footer so the operator can see freshness
  // at a glance; never hide upstream cache misalignment by displaying
  // a stale digest as if it were fresh. Substrate fix tracked separately.
  const computedMs = Date.parse(digest.computed_at);
  const ageMs = Number.isFinite(computedMs) ? Date.now() - computedMs : 0;
  const STALE_THRESHOLD_MS = 8 * 24 * 60 * 60 * 1000;
  const isStale = digest.stale === true || ageMs > STALE_THRESHOLD_MS;
  const staleMarker = isStale
    ? ` · STALE (${Math.round(ageMs / (24 * 60 * 60 * 1000))}d old)`
    : '';
  const footerText = `${postType} · computed at ${digest.computed_at}${staleMarker} · zone:${digest.zone}`;

  return {
    content: fallback,
    embeds: [
      {
        color,
        description: sanitized,
        footer: { text: footerText },
      },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────
// cycle-005 FR-1 · buildPulseDimensionPayload
//
// NEW renderer authored 2026-05-16 (cycle-005 S2). PR #73 shipped only
// types + ruggy prompt (verified via gh pr view 73); the "lean renderer"
// in the PR title never materialized. This implementation lands the
// deterministic dashboard-mirrored card body that becomes ruggy's
// digest body per PRD §FR-1 + SDD §Component 2.
//
// Six PR #73 trim decisions are regression-guarded:
//   1. NO footer line in the embed (footer reserved for other post-types)
//   2. NO "was-N" previous-period count chip
//   3. NO diversity-chip line
//   4. NO field-name suffixes (e.g. "(7d)" appended to "Top factors")
//   5. Dynamic char-truncation (per SDD T2.1.5 — was "no truncation"
//      in PR #73; cycle-005 r1 added dynamic algorithm for the 1024 cap)
//   6. ALL active factors sorted desc by `total` (substrate already
//      sorts; we preserve order verbatim)
// ────────────────────────────────────────────────────────────────────

/** Per-field Discord embed-field max (chars · NOT bytes). */
const EMBED_FIELD_CHAR_CAP = 1024;
/** Per-embed total max (chars · NOT bytes) across title + description + fields + footer. */
const EMBED_TOTAL_CHAR_CAP = 6000;
/** Token rendered when char-truncation drops rows. */
const OVERFLOW_TOKEN = '…and N more silent';
/** Soft cap (env-overridable) on factor count; dynamic char-truncation wins on overflow. */
const DEFAULT_MAX_FACTORS = 19;
/** Row separator inside the field value. */
const ROW_SEPARATOR = ' · ';

function maxFactorsHint(): number {
  const raw = process.env.LEADERBOARD_MAX_FACTORS;
  if (!raw) return DEFAULT_MAX_FACTORS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_FACTORS;
}

/**
 * Render a single factor row. Format:
 *   `[emoji ]<display_name> +N rank-XX`
 * with `emoji ` prefix only when `moodEmoji(stats)` returns a non-null token.
 * `+N` is `delta_count`; `rank-XX` is the magnitude percentile rank
 * (omitted when null). Pure function.
 */
/**
 * Render a single top-factor row in code-block table form (UX r4 ·
 * 2026-05-16 · operator: emojis sacrificed for monospace alignment).
 * Returns column-padded tuple suitable for joining with `\n` inside a
 * ```code block``` field value.
 */
function renderTopFactorRow(
  factor: PulseDimensionFactor,
  _moodEmoji?: (stats: FactorStats | undefined) => string | null,
): string {
  // Discord-as-material sanitize (underscore italicize defense)
  const safeName = sanitizeForDiscord(factor.display_name);
  const N = String(factor.total);
  const W = factor.factor_stats?.cohort?.unique_actors;
  const wallets = W !== undefined && W !== null ? String(W) : '?';

  const dp = factor.delta_pct;
  let delta = '·';
  if (dp !== null && dp !== undefined) {
    if (Math.abs(dp) < 1) {
      delta = 'steady';
    } else {
      const rounded = Math.round(dp);
      delta = rounded > 0 ? `+${rounded}%` : `${rounded}%`;
    }
  }

  const rank = factor.factor_stats?.magnitude?.current_percentile_rank;
  const rankStr = rank !== null && rank !== undefined ? String(rank) : '·';

  // Column widths: factor=18 · events=6 · wallets=8 · delta=7 · rank=4
  // Tuned for typical factor name lengths; truncate over-long names with
  // an ellipsis to keep the table aligned.
  const TRUNC = 18;
  const nameCol = safeName.length > TRUNC ? safeName.slice(0, TRUNC - 1) + '…' : safeName;
  return [
    nameCol.padEnd(TRUNC, ' '),
    N.padStart(6, ' '),
    wallets.padStart(8, ' '),
    delta.padStart(7, ' '),
    rankStr.padStart(4, ' '),
  ].join(' ');
}

/**
 * Code-block table header row. Pinned to the column widths in
 * renderTopFactorRow. Returns the header string that goes ABOVE the
 * factor rows inside the ```fenced``` block.
 */
function renderTopFactorHeader(): string {
  return [
    'factor'.padEnd(18, ' '),
    'events'.padStart(6, ' '),
    'wallets'.padStart(8, ' '),
    'delta'.padStart(7, ' '),
    'rank'.padStart(4, ' '),
  ].join(' ');
}

/**
 * Render a single cold-factor row. Format:
 *   `[emoji ]<display_name>`
 * (No delta · no rank — cold factors are zero-row by definition.)
 */
function renderColdFactorRow(
  factor: PulseDimensionFactor,
  moodEmoji?: (stats: FactorStats | undefined) => string | null,
): string {
  const emoji = moodEmoji?.(factor.factor_stats);
  const prefix = emoji ? `${emoji} ` : '';
  return `${prefix}${sanitizeForDiscord(factor.display_name)}`;
}

/**
 * Pack rows into a field value, respecting the 1024-char per-field cap
 * AND the soft `LEADERBOARD_MAX_FACTORS` cap.
 *
 * UX nit 2026-05-16 r3 (operator): rows are joined with NEWLINES, not
 * ` · `, so each row reads as a discrete table line. Operator showed
 * the cramped form ("Articles · 2 by 2 · -86% · rank-35 · Sets · ...")
 * was unreadable; per-line rendering is the table form.
 *
 * Within a row, ` · ` separators still join the column data — that's the
 * caller's responsibility (renderTopFactorRow / renderColdFactorRow).
 */
const ROW_JOIN = '\n';

function packRowsIntoField(
  rows: readonly string[],
  totalAvailable: number,
): { value: string; packed: number; skipped: number } {
  if (rows.length === 0) return { value: '', packed: 0, skipped: 0 };
  let acc = '';
  let packed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const sep = acc.length > 0 ? ROW_JOIN : '';
    const remaining = totalAvailable - packed - 1;
    const overflowSlot =
      remaining > 0 ? ROW_JOIN + OVERFLOW_TOKEN.replace('N', String(remaining)) : '';
    const projected = acc.length + sep.length + row.length + overflowSlot.length;
    if (projected > EMBED_FIELD_CHAR_CAP) {
      const skipped = totalAvailable - packed;
      const token = OVERFLOW_TOKEN.replace('N', String(skipped));
      const closer = acc.length > 0 ? ROW_JOIN + token : token;
      return { value: acc + closer, packed, skipped };
    }
    acc += sep + row;
    packed += 1;
  }
  const skipped = totalAvailable - packed;
  if (skipped > 0) {
    const token = OVERFLOW_TOKEN.replace('N', String(skipped));
    const closer = acc.length > 0 ? ROW_JOIN + token : token;
    if ((acc + closer).length > EMBED_FIELD_CHAR_CAP) {
      const lastSepIdx = acc.lastIndexOf(ROW_JOIN);
      if (lastSepIdx > 0) acc = acc.slice(0, lastSepIdx);
      return {
        value: acc + ROW_JOIN + OVERFLOW_TOKEN.replace('N', String(skipped + 1)),
        packed: packed - 1,
        skipped: skipped + 1,
      };
    }
    return { value: acc + closer, packed, skipped };
  }
  return { value: acc, packed, skipped: 0 };
}

export interface BuildPulseDimensionPayloadOpts {
  /** FR-3 mood-emoji callback. Returns a Discord render token or null. */
  moodEmoji?: (stats: FactorStats | undefined) => string | null;
  /** FR-2 prose-gate validation — telemetry-only in V1, does NOT modify text. */
  proseGate?: ProseGateValidation;
  /** Optional 1-line LLM-composed header (FR-1 voice seasoning). */
  header?: string;
  /** Optional 1-line LLM-composed outro (FR-1 voice seasoning · UX nit
   *  2026-05-16: operator option A — single-sentence voice. when only
   *  `header` is provided and `outro` is absent, voice is one sentence). */
  outro?: string;
  /** Optional dim-level snapshot — when provided, prepends a headline
   *  field showing the dashboard-equivalent summary line (events, active
   *  wallets, w/w delta, cold-factor count). UX nit 2026-05-16. */
  snapshot?: {
    /** Total active wallets across the dimension's top factors. */
    weeklyActiveWallets?: number;
    /** Cold factor count (zero-row factors in dim). */
    coldFactorCount?: number;
  };
}

/**
 * Build the snapshot as a code-block table (UX r4 · 2026-05-16 ·
 * operator: clear left-label / right-value form, monospace alignment).
 * Returns ONE field with a fenced code block as its value.
 */
function buildSnapshotField(
  dim: PulseDimensionBreakdown,
  snapshot: BuildPulseDimensionPayloadOpts['snapshot'],
  windowDays: number,
): { name: string; value: string; inline?: boolean } {
  const rows: string[] = [];
  rows.push(`events    ${String(dim.total_events).padStart(8, ' ')} / ${windowDays}d`);
  if (snapshot?.weeklyActiveWallets !== undefined) {
    rows.push(`wallets   ${String(snapshot.weeklyActiveWallets).padStart(8, ' ')} active`);
  }
  if (dim.delta_pct !== null && dim.delta_pct !== undefined) {
    let v: string;
    if (Math.abs(dim.delta_pct) < 1) {
      v = 'steady';
    } else {
      const r = Math.round(dim.delta_pct);
      v = r > 0 ? `+${r}%` : `${r}%`;
    }
    rows.push(`w/w       ${v.padStart(8, ' ')}`);
  }
  const k = snapshot?.coldFactorCount ?? dim.cold_factors.length;
  if (k > 0) {
    rows.push(`cold      ${String(k).padStart(8, ' ')} factors`);
  }
  return {
    name: `${windowDays}d snapshot`,
    value: '```\n' + rows.join('\n') + '\n```',
    inline: false,
  };
}

/**
 * Build the deterministic dashboard-mirrored card body for one dimension.
 *
 * Renders `top_factors` + `cold_factors` as two separate embed fields
 * (each respecting 1024-char cap independently). The total embed length
 * is then trimmed if it exceeds 6000 chars (cold-factors first, then
 * top-factors) per FR-1 progressive-shrink rule.
 *
 * Voice surface (header + outro) is a small fraction of the post; the
 * deterministic card body is 85-95% of the pixels per PRD §FR-1.
 */
export function buildPulseDimensionPayload(
  dim: PulseDimensionBreakdown,
  zone: ZoneId,
  windowDays: number,
  opts: BuildPulseDimensionPayloadOpts = {},
): DigestPayload {
  const hint = maxFactorsHint();
  const topRaw = dim.top_factors.slice(0, hint); // soft hint; dynamic algorithm refines
  const coldRaw = dim.cold_factors.slice(0, hint);

  // Top factors: code-block table (UX r4 · monospace alignment · no emoji).
  // Cold factors: flat ` · ` joined tag line (just labels · not data rows).
  const topRows = topRaw.map((f) => renderTopFactorRow(f, opts.moodEmoji));
  const coldRows = coldRaw.map((f) => renderColdFactorRow(f, opts.moodEmoji));

  const topPacked = packRowsIntoField(topRows, dim.top_factors.length);
  const coldValue =
    coldRows.length === 0
      ? ''
      : coldRows.slice(0, Math.min(coldRows.length, 30)).join(' · ');

  // Trim 6000-char total cap: cold first, then top
  const fixedChars =
    (opts.header?.length ?? 0) +
    (opts.outro?.length ?? 0) +
    `top this ${windowDays}d`.length +
    'cold'.length;
  let coldFieldValue = coldValue;
  let topValue = topPacked.value;
  let totalProjected = fixedChars + topValue.length + coldFieldValue.length;
  if (totalProjected > EMBED_TOTAL_CHAR_CAP) {
    coldFieldValue = '';
    totalProjected = fixedChars + topValue.length;
    if (totalProjected > EMBED_TOTAL_CHAR_CAP) {
      const budget = EMBED_TOTAL_CHAR_CAP - fixedChars - ROW_JOIN.length - OVERFLOW_TOKEN.length;
      topValue = topValue.slice(0, Math.max(0, budget)) + ROW_JOIN + OVERFLOW_TOKEN.replace('N', '?');
    }
  }

  const flavor = ZONE_FLAVOR[zone];
  const dimensionParen = flavor.dimension === 'overall' ? '' : ` (${DIMENSION_NAME[flavor.dimension]})`;
  const fallback = `${flavor.emoji} ${flavor.name}${dimensionParen}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  // UX r4 (operator 2026-05-16): snapshot as a code-block table · clean
  // left-label / right-value form with monospace alignment.
  if (dim.total_events > 0 || dim.top_factors.length > 0) {
    fields.push(buildSnapshotField(dim, opts.snapshot, windowDays));
  }

  // Top factors: code-block table with header row + per-factor rows.
  if (topValue.length > 0) {
    const tableBlock =
      '```\n' + renderTopFactorHeader() + '\n' + topValue + '\n```';
    fields.push({
      name: `top this ${windowDays}d`,
      value: tableBlock,
      inline: false,
    });
  }
  if (coldFieldValue.length > 0) {
    // Cold-factor names: flat ` · ` tag-line (they're just labels, not data rows).
    fields.push({ name: 'cold', value: coldFieldValue, inline: false });
  }

  // UX r4 doctrine (operator 2026-05-16): "divs are truth areas straight from
  // the substrate · ruggy SHOULD NOT talk inside the UI div. if we do have him
  // talk it should be outside of divs." The embed.description used to carry
  // voice — wrong. Voice now lives in message.content (above the embed),
  // joined to the zone-flavor fallback line. The embed has NO description ·
  // it's pure substrate.
  const voiceHeader = opts.header ? sanitizeForDiscord(opts.header, { isVoice: true }) : '';
  const voiceOutro = opts.outro ? sanitizeForDiscord(opts.outro, { isVoice: true }) : '';
  const voiceText = [voiceHeader, voiceOutro].filter((s) => s.length > 0).join('\n');
  const content = voiceText ? `${fallback}\n${voiceText}` : fallback;

  const embed: DiscordEmbed = {
    color: ZONE_COLORS[zone],
    // NO description · per voice-outside-divs doctrine
    ...(fields.length > 0 ? { fields } : {}),
  };

  // proseGate option is accepted but does NOT modify text (V1 telemetry-only contract).
  void opts.proseGate;
  // window arg already used above for field naming / snapshot rendering.

  return {
    content,
    embeds: [embed],
  };
}

function buildFallback(digest: ZoneDigest, postType: PostType): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const dimensionName = DIMENSION_NAME[flavor.dimension];

  // V0.6-D voice/v5 (operator 2026-04-30): fallback content is the line
  // OUTSIDE the embed. Channel name already covers location → keep stats out
  // (no duplication with embed headline) BUT pair zone↔dimension explicitly
  // for world-building. Per operator: "in world-building, these words make
  // sense when there's more weight to them. Over time, when there's history
  // of people being familiar with these locations, it'll be a little bit
  // more familiar, and we could drop some of these wordings. Right now, it's
  // important that people are still aware of the connection between these
  // things." Stonehenge = Overall (cross-zone hub), so omit the dimension
  // paren for it (would read "Stonehenge (Overall)" stilted; the hub is
  // self-explanatory).
  const dimensionParen = flavor.dimension === 'overall' ? '' : ` (${dimensionName})`;
  switch (postType) {
    case 'digest':
    case 'weaver':
      return `${flavor.emoji} ${flavor.name}${dimensionParen}`;
    case 'callout':
      return `🚨 ${flavor.name}${dimensionParen}`;
    default:
      return `${flavor.emoji} ${flavor.name}${dimensionParen}`;
  }
}
