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
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';
import { POST_TYPE_SPECS, type PostType } from '../compose/post-types.ts';
import {
  escapeDiscordMarkdown,
  stripVoiceDisciplineDrift,
  type VoiceMediumId,
} from './sanitize.ts';

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

  // Voice discipline runs BEFORE markdown escape: strip em-dashes,
  // asterisk roleplay, and (non-digest) closing signoffs. Digest is the
  // only post-type that retains "stay groovy 🐻"-style closings per
  // discord-native-register doctrine. Per cmp-boundary §9 voice-discipline
  // drift class · cycle R cmp-boundary-architecture S1. Sprint 3 threads
  // mediumId for CLI ANSI-strip + future medium-specific register tunes.
  const voiceCleaned = stripVoiceDisciplineDrift(voice, { postType, mediumId });
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
  const footerText = `${postType} · computed at ${digest.computed_at} · zone:${digest.zone}`;

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

// ══════════════════════════════════════════════════════════════════════
// Cycle-021 ruggy-pulse-mcp — Discord embed renderers
// ══════════════════════════════════════════════════════════════════════
//
// Per operator decision 2026-05-13:
//   - Per-zone routing: each pulse-dim post lands in the dim's owning
//     channel (bear-cave→og, el-dorado→nft, owsley-lab→onchain).
//   - Stonehenge gets an "overall pulse" (community_counts) — the
//     cross-dim hub.
//   - Discord embed shape with structured fields (NOT prose-only).
//   - Text-only v1; sparkline images deferred to a future cycle.
//
// Renderers are deterministic — no LLM call. Embed shape is locked so
// the cards look identical week to week. Numbers are emitted verbatim
// from the MCP tool response (no rounding, no editorialization).
// Spec: PRD v0.4 §FR-2 + §FR-1; SDD v0.3 §3 + §4.

import type {
  GetDimensionBreakdownResponse,
  PulseDimensionBreakdown,
  PulseDimensionFactor,
} from '../score/types.ts';

/** Dim color sidebar — matches dashboard design tokens. */
const DIM_COLORS = {
  og: 0xc9a44c,        // gold (matches el-dorado-ish; OG is the "gold" dim)
  nft: 0x6f4ea1,       // purple (matches owsley-ish in tone)
  onchain: 0x4a90c0,   // cyan (matches dashboard onchain)
} as const;

/** Format event count with 1k abbrev for readability. */
function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Render a percent delta with arrow + sign. null → em-dash. */
function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null) return '—';
  const arrow = deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·';
  const sign = deltaPct > 0 ? '+' : '';
  const abs = Math.abs(deltaPct);
  const rounded = abs >= 100 ? Math.round(abs) : Number(abs.toFixed(1));
  return `${arrow}${sign}${deltaPct < 0 ? '-' : ''}${rounded}%`;
}

/** Render a single factor row for the Most active section. */
function renderFactorRow(f: PulseDimensionFactor): string {
  const verb = f.primary_action ?? f.display_name;
  const delta = formatDelta(f.delta_pct);
  const wasNote = f.previous > 0 && f.delta_pct === null
    ? ''
    : f.previous > 0 ? `  (was ${formatCount(f.previous)})` : '';
  return `• \`${verb.padEnd(18).slice(0, 18)}\` ${formatCount(f.total).padStart(4)}  ${delta}${wasNote}`;
}

/** Render the Went quiet inline list. Full list per operator decision —
 *  Discord embed field value cap is 1024 chars; even onchain (19 cold
 *  factors max) at ~25 chars/factor (incl. delimiters) sits well under. */
function renderColdList(cold: PulseDimensionFactor[]): string {
  if (cold.length === 0) return '_no factors went silent this period_';
  return cold.map((f) => `\`${f.primary_action ?? f.display_name}\``).join(' · ');
}

/**
 * Build a Discord post payload for a per-dimension pulse card.
 * Maps to the dashboard's `/dimension/[id]` page surface (full breakdown).
 *
 * Routing (caller's responsibility): post to the channel owned by the
 * zone whose dimension matches `dim.id`:
 *   og → bear-cave, nft → el-dorado, onchain → owsley-lab.
 */
export function buildPulseDimensionPayload(
  response: GetDimensionBreakdownResponse,
  dim: PulseDimensionBreakdown,
  windowDays: 7 | 30 | 90,
): DigestPayload {
  const color = DIM_COLORS[dim.id];
  const activeFactorCount = dim.total_factor_count - dim.inactive_factor_count;
  const dimDelta = formatDelta(dim.delta_pct);
  const wasTotal = dim.previous_period_events > 0
    ? `  (was ${formatCount(dim.previous_period_events)})`
    : '';

  // Hero line: large event count + dim-level delta + diversity chip.
  const heroLine = `**${formatCount(dim.total_events)}** events  ${dimDelta} vs prior ${windowDays}d${wasTotal}`;
  const diversityLine = `${activeFactorCount} of ${dim.total_factor_count} factors active`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  // Most active block — full list (no truncation). Discord field value
  // cap is 1024 chars; onchain has 19 max base factors, ~50 chars per row
  // (incl. verb-form padding) → ~950 chars worst case, under the limit.
  // If a future cycle pushes this over, fall back to a 2-field split
  // (e.g. "Most active 1-15" + "Most active 16-30").
  if (dim.top_factors.length > 0) {
    const topRows = dim.top_factors.map(renderFactorRow).join('\n');
    fields.push({
      name: `Most active · last ${windowDays}d`,
      value: `\`\`\`\n${topRows}\n\`\`\``,
    });
  } else {
    fields.push({
      name: `Most active · last ${windowDays}d`,
      value: '_no factor activity in this window_',
    });
  }

  // Went quiet — separate field, only when cold factors exist.
  if (dim.cold_factors.length > 0) {
    fields.push({
      name: 'Went quiet · active prior, 0 this period',
      value: renderColdList(dim.cold_factors),
    });
  }

  // Plain-text fallback for embed-disabled clients.
  const fallback = `${dim.display_name} · ${windowDays}d · ${formatCount(dim.total_events)} events ${dimDelta}`;

  // Footer: timestamp + tool provenance.
  const footerText = `pulse · ${dim.id} · generated ${response.generated_at}`;

  return {
    content: fallback,
    embeds: [
      {
        color,
        description: `## ${dim.display_name} dimension · last ${windowDays} days\n${heroLine}\n${diversityLine}`,
        fields,
        footer: { text: footerText },
      },
    ],
  };
}

