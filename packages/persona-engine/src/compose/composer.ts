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
import type { CharacterConfig } from '../types.ts';
import { fetchZoneDigest } from '../score/client.ts';
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { invoke } from './agent-gateway.ts';
import { enforceCanonicalHeadline } from './headline-lock.ts';
import { buildPromptPair } from '../persona/loader.ts';
import { buildPostPayload, type DigestPayload } from '../deliver/embed.ts';
import {
  POST_TYPE_SPECS,
  type PostType,
} from './post-types.ts';
import {
  isFlatWindow,
  pickSilenceTemplate,
} from '../expression/silence-register.ts';

export interface PostComposeResult {
  zone: ZoneId;
  postType: PostType;
  digest: ZoneDigest;
  voice: string;
  payload: DigestPayload;
}

export async function composeZonePost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  postType: PostType = 'digest',
): Promise<PostComposeResult | null> {
  // Fetch a digest in parallel with the LLM call — the LLM gets its own
  // copy via mcp__score__get_zone_digest; this one is for embed metadata
  // (color, footer timestamp, structured payload). Cheap; same MCP call.
  const digestPromise = fetchZoneDigest(config, zone);

  const { systemPrompt, userMessage } = buildPromptPair({
    character,
    zoneId: zone,
    postType,
  });

  // V0.12 expression layer (kickoff §4.4): on a flat window AND when the
  // character has a registered silence template, the substrate routes to
  // performed-silence rather than asking the LLM to elaborate prose for
  // an empty data window. We still parallelize the digest fetch + LLM
  // invocation because (a) flat windows are the minority case so
  // optimizing for the common path matters more, and (b) the LLM call
  // is cheap relative to digest fetch latency. The wasted LLM call on a
  // flat window is small cost; latency on non-flat windows is the
  // load-bearing metric.
  const [digest, { text: rawVoice }] = await Promise.all([
    digestPromise,
    invoke(config, {
      character,
      systemPrompt,
      userMessage,
      modelAlias: config.FREESIDE_AGENT_MODEL,
      zoneHint: zone,
      postTypeHint: postType,
    }),
  ]);

  // Performed-silence override: only the digest post-type qualifies (pop-
  // ins, weavers, lore_drops, questions, callouts have their own
  // register-locked emptiness handling). Skip when the LLM produced
  // nothing — empty rawVoice routes through the existing chunk-empty
  // guard downstream. Skip when the character has no silence template —
  // fall through to the LLM voice rather than emit a substrate-quiet
  // fallback that has no register.
  let voice: string;
  if (postType === 'digest' && isFlatWindow(digest.raw_stats)) {
    const silence = pickSilenceTemplate(character.id);
    if (silence) {
      console.log(
        `${character.id}: flat-window detected on ${zone}/digest ` +
          `(events=${digest.raw_stats.window_event_count ?? 0}) · ` +
          `routing to silence-register (skipped LLM elaboration)`,
      );
      voice = silence;
    } else {
      // No silence template — fall through to LLM voice as today.
      voice = applyHeadlineLock(rawVoice, zone, postType, character.id);
    }
  } else {
    voice = applyHeadlineLock(rawVoice, zone, postType, character.id);
  }

  const payload = buildPostPayload(digest, voice, postType);
  return { zone, postType, digest, voice, payload };
}

/**
 * Apply the canonical-headline lock to LLM-produced voice. Extracted to
 * a helper so the silence-register branch can share the same shape and
 * the LLM-voice path stays terse. Headline lock is a substrate-level
 * guard against LLM drift — world elements (zone identity) are not in
 * the LLM's creative territory.
 */
function applyHeadlineLock(
  rawVoice: string,
  zone: ZoneId,
  postType: PostType,
  characterId: string,
): string {
  const lockResult = enforceCanonicalHeadline(rawVoice, zone, postType);
  if (lockResult.enforced) {
    console.log(
      `${characterId}: headline-lock enforced on ${zone}/${postType} ` +
        `· replaced "${lockResult.replaced}" with canonical zone emoji`,
    );
  }
  return lockResult.voice;
}

export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

export function describePost(zone: ZoneId, postType: PostType): string {
  return `${zone}/${postType} (${POST_TYPE_SPECS[postType].cadence})`;
}
