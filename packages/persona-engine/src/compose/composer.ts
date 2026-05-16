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

import type { MediumCapability } from '@0xhoneyjar/medium-registry';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import { fetchZoneDigest } from '../score/client.ts';
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { invoke } from './agent-gateway.ts';
import { enforceCanonicalHeadline } from './headline-lock.ts';
import { translateEmojiShortcodes } from './reply.ts';
import { buildPromptPair } from '../persona/loader.ts';
import { buildPostPayload, type DigestPayload } from '../deliver/embed.ts';
import { composeDigestPost } from '../orchestrator/digest-orchestrator.ts';
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

/**
 * Per-invocation opts for composeZonePost. Cycle R Sprint 3.
 *
 * `medium` defaults to DISCORD_WEBHOOK_DESCRIPTOR when omitted (Pattern B
 * shell-bot · the persona-bot default). Pass DISCORD_INTERACTION_DESCRIPTOR
 * for slash-command responses, CLI_DESCRIPTOR for cli-renderer fixtures,
 * etc. The medium threads through buildPostPayload to gate embed shape on
 * `hasCapability(medium, 'embed')` and through stripVoiceDisciplineDrift
 * for CLI ANSI strip / future medium-specific prose adjustments.
 */
export interface ComposeZonePostOpts {
  readonly medium?: MediumCapability;
}

export async function composeZonePost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  postType: PostType = 'digest',
  opts: ComposeZonePostOpts = {},
): Promise<PostComposeResult | null> {
  if (postType === 'digest') {
    return composeDigestPost(config, character, zone);
  }

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

  // Digest now routes through orchestrator/digest-orchestrator.ts above.
  // Non-digest surfaces keep the legacy full-voice path.
  let voice = applyHeadlineLock(rawVoice, zone, postType, character.id);

  // V0.12.0 emoji-rendering fix (2026-05-13): the digest path historically
  // bypassed `translateEmojiShortcodes`, which was only applied in the
  // chat-mode reply path. Production digest screenshots showed raw `:ruggy_
  // honeydrip:` shortcodes rendering as plain text instead of the custom
  // emoji. Apply the same translation here so digest, weaver, pop-in, and
  // any other composer-routed post type all render emoji consistently.
  //
  // Translation also drops hallucinated `ruggy_*`/`mibera_*` shortcodes
  // that don't exist in the registry — matches persona's "fall back to
  // bear emoji" convention rather than leak fake shortcodes.
  voice = translateEmojiShortcodes(voice);

  // Cycle R Sprint 3: thread the medium through to the payload builder.
  // Default (omitted opts.medium) preserves Sprint-1/Sprint-2 callsite
  // semantics — buildPostPayload internally falls back to
  // DISCORD_WEBHOOK_DESCRIPTOR.
  const payload = buildPostPayload(digest, voice, postType, { medium: opts.medium });
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
