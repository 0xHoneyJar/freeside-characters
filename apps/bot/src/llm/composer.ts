/**
 * Post composer — builds prompt pairs and dispatches to the LLM gateway.
 *
 * V0.5-B shape — composer no longer prefetches ZoneDigest. The LLM is
 * directed by the persona prompt to call:
 *   - mcp__score__get_zone_digest      (data trigger)
 *   - mcp__rosenzu__get_current_district + mcp__rosenzu__furnish_kansei
 *     (place lens)
 * before composing. Composer's job shrinks to: build prompt pair → invoke.
 *
 * For digest delivery, the bot still needs SOME ZoneDigest in hand for
 * embed metadata (color, footer timestamp). We fetch a lean digest in
 * parallel with the LLM call, NOT to feed the LLM but to wrap the embed.
 *
 * Stub-mode (LLM_PROVIDER=stub) keeps its own canned-output path; never
 * touches the SDK or MCP layer.
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
} from './post-types.ts';

export interface PostComposeResult {
  zone: ZoneId;
  postType: PostType;
  digest: ZoneDigest;
  voice: string;
  payload: DigestPayload;
}

export async function composeZonePost(
  config: Config,
  zone: ZoneId,
  postType: PostType = 'digest',
): Promise<PostComposeResult | null> {
  // Fetch a digest in parallel with the LLM call — the LLM gets its own
  // copy via mcp__score__get_zone_digest; this one is for embed metadata
  // (color, footer timestamp, structured payload). Cheap; same MCP call.
  const digestPromise = fetchZoneDigest(config, zone);

  const { systemPrompt, userMessage } = buildPromptPair({
    zoneId: zone,
    postType,
  });

  const [digest, { text: voice }] = await Promise.all([
    digestPromise,
    invoke(config, {
      systemPrompt,
      userMessage,
      modelAlias: config.FREESIDE_AGENT_MODEL,
      zoneHint: zone,
      postTypeHint: postType,
    }),
  ]);

  const payload = buildPostPayload(digest, voice, postType);
  return { zone, postType, digest, voice, payload };
}

export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

export function describePost(zone: ZoneId, postType: PostType): string {
  return `${zone}/${postType} (${POST_TYPE_SPECS[postType].cadence})`;
}
