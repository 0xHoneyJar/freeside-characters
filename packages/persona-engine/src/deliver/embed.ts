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
import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';
import { POST_TYPE_SPECS, type PostType } from '../compose/post-types.ts';
import {
  escapeDiscordMarkdown,
  stripVoiceDisciplineDrift,
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

export function buildPostPayload(
  digest: ZoneDigest,
  voice: string,
  postType: PostType,
): DigestPayload {
  const spec = POST_TYPE_SPECS[postType];
  // Voice discipline runs BEFORE markdown escape: strip em-dashes,
  // asterisk roleplay, and (non-digest) closing signoffs. Digest is the
  // only post-type that retains "stay groovy 🐻"-style closings per
  // discord-native-register doctrine. Per cmp-boundary §9 voice-discipline
  // drift class · cycle R cmp-boundary-architecture S1.
  const voiceCleaned = stripVoiceDisciplineDrift(voice, { postType });
  const sanitized = escapeDiscordMarkdown(voiceCleaned);

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
