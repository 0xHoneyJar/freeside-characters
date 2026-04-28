/**
 * Post composer — orchestrates per-zone post generation across all
 * post types (digest, micro, weaver, lore_drop, question, callout).
 *
 * For zone-local types (digest, micro, lore_drop, question, callout):
 *   1. Fetch ZoneDigest from score-mcp (or stub)
 *   2. Build prompt pair with post-type guidance
 *   3. Invoke LLM
 *   4. Build Discord payload (embed for digest/callout/weaver; plain
 *      message.content for micro/lore_drop/question)
 *
 * For weaver (cross-zone):
 *   1. Fetch ALL configured zones' digests
 *   2. Pick a primary zone (where the post lands)
 *   3. Build prompt with all 4 digests as supplementary context
 *   4. Invoke LLM
 *   5. Build Discord payload
 */

import type { Config } from '../config.ts';
import { fetchZoneDigest } from '../score/client.ts';
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { invoke } from './agent-gateway.ts';
import { buildPromptPair } from '../persona/loader.ts';
import { buildPostPayload, type DigestPayload } from '../format/embed.ts';
import {
  POST_TYPE_SPECS,
  type PostType,
  calloutFits,
} from './post-types.ts';

export interface PostComposeResult {
  zone: ZoneId;
  postType: PostType;
  digest: ZoneDigest;
  voice: string;
  payload: DigestPayload;
  /** When weaver post: also includes the supplementary digests */
  supplementaryDigests?: ZoneDigest[];
}

export async function composeZonePost(
  config: Config,
  zone: ZoneId,
  postType: PostType = 'digest',
): Promise<PostComposeResult | null> {
  // Callout only fires if data warrants it
  if (postType === 'callout') {
    const probe = await fetchZoneDigest(config, zone);
    if (!calloutFits(probe)) {
      console.log(`[${zone}] callout requested but data doesn't meet threshold — skipping`);
      return null;
    }
  }

  // Weaver needs cross-zone context
  if (postType === 'weaver') {
    return composeWeaverPost(config, zone);
  }

  // Standard zone-local types
  const digest = await fetchZoneDigest(config, zone);

  const { systemPrompt, userMessage } = buildPromptPair({
    zoneId: zone,
    postType,
    zoneDigestJson: JSON.stringify(digest, null, 2),
  });

  const { text: voice } = await invoke(config, {
    systemPrompt,
    userMessage,
    modelAlias: config.FREESIDE_AGENT_MODEL,
    zoneHint: zone,
    postTypeHint: postType,
  });

  const payload = buildPostPayload(digest, voice, postType);

  return { zone, postType, digest, voice, payload };
}

/**
 * Weaver post: fetches all 4 zone digests, asks LLM to find a connection
 * across them, posts in the primary zone (default: stonehenge — the
 * cross-zone observatory).
 */
async function composeWeaverPost(
  config: Config,
  primaryZone: ZoneId,
): Promise<PostComposeResult> {
  const allZones: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

  const allDigests = await Promise.all(allZones.map((z) => fetchZoneDigest(config, z)));
  const primaryIndex = allZones.indexOf(primaryZone);
  const primaryDigest = allDigests[primaryIndex]!;

  // Compose supplementary context — slim summaries of the OTHER zones
  const supplements = allZones
    .map((z, i) => {
      if (z === primaryZone) return null;
      const d = allDigests[i]!;
      return `${z}: ${d.raw_stats.total_events} events, ${d.raw_stats.active_wallets} wallets, top factor: ${d.raw_stats.factor_trends[0]?.factor_id ?? 'none'} @ ${d.raw_stats.factor_trends[0]?.multiplier?.toFixed(2) ?? '?'}× baseline${d.raw_stats.spotlight ? ` · spotlight: ${d.raw_stats.spotlight.wallet}` : ''}`;
    })
    .filter(Boolean)
    .join('\n');

  const supplement = `Other zones in this window (for cross-zone weaving — find a connection if one exists):\n${supplements}`;

  const { systemPrompt, userMessage } = buildPromptPair({
    zoneId: primaryZone,
    postType: 'weaver',
    zoneDigestJson: JSON.stringify(primaryDigest, null, 2),
    supplement,
  });

  const { text: voice } = await invoke(config, {
    systemPrompt,
    userMessage,
    modelAlias: config.FREESIDE_AGENT_MODEL,
    zoneHint: primaryZone,
    postTypeHint: 'weaver',
  });

  const payload = buildPostPayload(primaryDigest, voice, 'weaver');

  return {
    zone: primaryZone,
    postType: 'weaver',
    digest: primaryDigest,
    voice,
    payload,
    supplementaryDigests: allDigests.filter((_, i) => i !== primaryIndex),
  };
}

export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

export function describePost(zone: ZoneId, postType: PostType): string {
  return `${zone}/${postType} (${POST_TYPE_SPECS[postType].cadence})`;
}
