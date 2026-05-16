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
function renderTopFactorRow(
  factor: PulseDimensionFactor,
  moodEmoji?: (stats: FactorStats | undefined) => string | null,
): string {
  const emoji = moodEmoji?.(factor.factor_stats);
  const prefix = emoji ? `${emoji} ` : '';
  // UX nit 2026-05-16: negative delta_count used to render `+-12` (the
  // unconditional `+` prefix doubled with `-`). Sign-aware formatting:
  //   delta_count > 0 → "+N"
  //   delta_count < 0 → "-N"  (the minus IS the sign · no `+` prefix)
  //   delta_count == 0 → "±0" (rare · zero-delta on top-factor implies
  //                            same volume as previous · unusual but real)
  const dc = factor.delta_count;
  const delta = dc > 0 ? `+${dc}` : dc < 0 ? `${dc}` : '±0';
  const rank =
    factor.factor_stats?.magnitude?.current_percentile_rank !== undefined &&
    factor.factor_stats?.magnitude?.current_percentile_rank !== null
      ? ` rank-${factor.factor_stats.magnitude.current_percentile_rank}`
      : '';
  // sanitize display_name to defend against underscore-italicize bug
  // (Discord-as-Material rule per `sanitize.ts:7`).
  const safeName = sanitizeForDiscord(factor.display_name);
  return `${prefix}${safeName} ${delta}${rank}`;
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
 * (PRD FR-1 truncation policy · SDD T2.1.5 dynamic algorithm) AND the
 * soft `LEADERBOARD_MAX_FACTORS` cap. Stops appending when EITHER the
 * next row would breach the cap OR the soft hint is reached; emits
 * `…and N more silent` with the count of skipped rows from the FULL
 * available set (not just sliced-to-hint).
 *
 * `totalAvailable` is the count of rows the caller originally had
 * before any soft-cap slicing; allows the overflow token to correctly
 * account for both char-truncation drops AND soft-cap drops.
 */
function packRowsIntoField(
  rows: readonly string[],
  totalAvailable: number,
): { value: string; packed: number; skipped: number } {
  if (rows.length === 0) return { value: '', packed: 0, skipped: 0 };
  let acc = '';
  let packed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const sep = acc.length > 0 ? ROW_SEPARATOR : '';
    const remaining = totalAvailable - packed - 1;
    const overflowSlot =
      remaining > 0 ? ROW_SEPARATOR + OVERFLOW_TOKEN.replace('N', String(remaining)) : '';
    const projected = acc.length + sep.length + row.length + overflowSlot.length;
    if (projected > EMBED_FIELD_CHAR_CAP) {
      const skipped = totalAvailable - packed;
      const token = OVERFLOW_TOKEN.replace('N', String(skipped));
      const closer = acc.length > 0 ? ROW_SEPARATOR + token : token;
      return { value: acc + closer, packed, skipped };
    }
    acc += sep + row;
    packed += 1;
  }
  const skipped = totalAvailable - packed;
  if (skipped > 0) {
    // Soft-cap dropped rows even though the chars fit. Append overflow token.
    const token = OVERFLOW_TOKEN.replace('N', String(skipped));
    const closer = acc.length > 0 ? ROW_SEPARATOR + token : token;
    // Re-check against cap after appending (rare; only triggers when soft-cap
    // bites first and overflow token itself pushes over 1024 — falls into
    // the per-row check above next iteration, but on the closure-append we
    // do a defensive truncate if needed)
    if ((acc + closer).length > EMBED_FIELD_CHAR_CAP) {
      // Drop the last packed row to make space for the closer
      const lastSepIdx = acc.lastIndexOf(ROW_SEPARATOR);
      if (lastSepIdx > 0) acc = acc.slice(0, lastSepIdx);
      return { value: acc + ROW_SEPARATOR + OVERFLOW_TOKEN.replace('N', String(skipped + 1)), packed: packed - 1, skipped: skipped + 1 };
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
  /** Optional 1-line LLM-composed outro (FR-1 voice seasoning). */
  outro?: string;
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

  const topRows = topRaw.map((f) => renderTopFactorRow(f, opts.moodEmoji));
  const coldRows = coldRaw.map((f) => renderColdFactorRow(f, opts.moodEmoji));

  // totalAvailable is the caller's full count (before soft-cap slice), so
  // the overflow token accounts for BOTH char-trunc and soft-cap drops.
  const topPacked = packRowsIntoField(topRows, dim.top_factors.length);
  const coldPacked = packRowsIntoField(coldRows, dim.cold_factors.length);

  // Trim 6000-char total cap: cold first, then top
  const fixedChars =
    (opts.header?.length ?? 0) +
    (opts.outro?.length ?? 0) +
    'top'.length +
    'cold'.length;
  let totalProjected = fixedChars + topPacked.value.length + coldPacked.value.length;
  let coldValue = coldPacked.value;
  let topValue = topPacked.value;
  if (totalProjected > EMBED_TOTAL_CHAR_CAP) {
    // Drop cold field entirely first
    coldValue = '';
    totalProjected = fixedChars + topValue.length;
    if (totalProjected > EMBED_TOTAL_CHAR_CAP) {
      // Then truncate top to fit (rare — would need extraordinarily long names)
      const budget = EMBED_TOTAL_CHAR_CAP - fixedChars - ROW_SEPARATOR.length - OVERFLOW_TOKEN.length;
      topValue = topValue.slice(0, Math.max(0, budget)) + ROW_SEPARATOR + OVERFLOW_TOKEN.replace('N', '?');
    }
  }

  const flavor = ZONE_FLAVOR[zone];
  const dimensionParen = flavor.dimension === 'overall' ? '' : ` (${DIMENSION_NAME[flavor.dimension]})`;
  const fallback = `${flavor.emoji} ${flavor.name}${dimensionParen}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (topValue.length > 0) {
    fields.push({ name: 'top', value: topValue });
  }
  if (coldValue.length > 0) {
    fields.push({ name: 'cold', value: coldValue });
  }

  // Header + outro flank the field block. Voice is the seasoning; card body is the meal.
  // Voice surface gets full sanitize (em-dashes, asterisk roleplay, etc.) per
  // sanitize.ts §2 stripVoiceDisciplineDrift + Discord underscore escape.
  const descParts: string[] = [];
  if (opts.header) descParts.push(sanitizeForDiscord(opts.header, { isVoice: true }));
  if (opts.outro) descParts.push(sanitizeForDiscord(opts.outro, { isVoice: true }));
  const description = descParts.length > 0 ? descParts.join('\n') : undefined;

  // Trim decisions (regression-guarded): NO footer, NO was-N, NO diversity-chip,
  // NO field-name suffixes (fields are "top" and "cold" — bare). Dimension name
  // lives in the fallback content line, not in the field name.
  const embed: DiscordEmbed = {
    color: ZONE_COLORS[zone],
    ...(description ? { description } : {}),
    ...(fields.length > 0 ? { fields } : {}),
  };

  // proseGate option is accepted but does NOT modify text (V1 telemetry-only contract).
  // void-ref to satisfy strict unused-param check while documenting the V1 contract.
  void opts.proseGate;
  // window arg is accepted for API symmetry / future cycles · NOT rendered (no field-suffix).
  void windowDays;

  return {
    content: fallback,
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
