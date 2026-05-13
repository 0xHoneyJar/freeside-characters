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
  stripToolMarkup,
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
