/**
 * Discord post payload builder — varies shape by post type.
 *
 * digest / weaver / callout    → rich embed (sidebar color, structured)
 * micro / lore_drop / question → plain message.content (no embed)
 *
 * For embedded types: ALWAYS populate `message.content` as graceful
 * fallback for users with embeds disabled.
 */

import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR, getWindowEventCount, getWindowWalletCount } from '../score/types.ts';
import { POST_TYPE_SPECS, type PostType } from '../llm/post-types.ts';
import { escapeDiscordMarkdown } from './sanitize.ts';

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

export function buildPostPayload(
  digest: ZoneDigest,
  voice: string,
  postType: PostType,
): DigestPayload {
  const spec = POST_TYPE_SPECS[postType];
  const sanitized = escapeDiscordMarkdown(voice);

  if (!spec.useEmbed) {
    // Plain content for micro / lore_drop / question — lightweight
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
  const stats = digest.raw_stats;

  switch (postType) {
    case 'digest':
      return `${flavor.emoji} ${flavor.name} · ${getWindowEventCount(stats)} events · ${getWindowWalletCount(stats)} miberas`;
    case 'weaver':
      return `${flavor.emoji} ${flavor.name} · cross-zone weave 🪡`;
    case 'callout':
      return `🚨 ${flavor.name} · anomaly`;
    default:
      return `${flavor.emoji} ${flavor.name}`;
  }
}
