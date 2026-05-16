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
import type { DigestPayload } from '../deliver/embed.ts';
import { composeDigestPost } from '../orchestrator/digest-orchestrator.ts';
import { composeMicroPost } from '../orchestrator/micro-orchestrator.ts';
import { composeLoreDropPost } from '../orchestrator/lore-drop-orchestrator.ts';
import { composeQuestionPost } from '../orchestrator/question-orchestrator.ts';
import { composeWeaverPost } from '../orchestrator/weaver-orchestrator.ts';
import { composePopInPost } from '../orchestrator/pop-in-orchestrator.ts';
import { composeCalloutPost } from '../orchestrator/callout-orchestrator.ts';
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
 * etc. The medium threads through the per-orchestrator renderer chain via
 * `hasCapability(medium, 'embed')` and through stripVoiceDisciplineDrift
 * for CLI ANSI strip / future medium-specific prose adjustments.
 */
export interface ComposeZonePostOpts {
  readonly medium?: MediumCapability;
}

/**
 * cycle-006 S3 · post types that route through the new orchestrator layer.
 * S4 adds 'callout', S5 adds 'reply' (→ 'chat-reply'). Once all 7 land,
 * the legacy composeZonePost body becomes unreachable and can be removed.
 */
/**
 * cycle-006 S4 · BB design-review F-007 closure · type-level rejection of
 * 'reply' from zone-routed dispatch. `composeZonePost` only handles cron
 * cadences; chat-reply takes its own path through chat-reply-orchestrator (S5).
 */
export type ZoneRoutedPostType = Exclude<PostType, 'reply'>;

export const MIGRATED_POST_TYPES = new Set<ZoneRoutedPostType>([
  'digest',
  'micro',
  'lore_drop',
  'question',
  'weaver',
  'callout',
]);

/**
 * Canonical list of zone-routed post types (excludes 'reply'). Used by
 * composer-router.test.ts to assert MIGRATED_POST_TYPES is complete.
 */
export const ZONE_ROUTED_POST_TYPES: readonly ZoneRoutedPostType[] = [
  'digest',
  'micro',
  'lore_drop',
  'question',
  'weaver',
  'callout',
] as const;

/**
 * Adapter — orchestrators return `{ payload }` + a domain message; the
 * caller-facing PostComposeResult needs `digest` (legacy ZoneDigest) + `voice`.
 * S3 synthesizes a minimal ZoneDigest from the snapshot path so callers
 * compile. S8 cleans this up when the legacy ZoneDigest field is retired.
 */
async function composeOrchestratedPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  postType: ZoneRoutedPostType,
): Promise<PostComposeResult> {
  // The orchestrator already fetches its own snapshot via ScoreFetchPort.
  // We still need a ZoneDigest for the caller's logging surface — fetch once
  // here and let the orchestrator do its own fetch. Slight redundancy in S3;
  // S8 unifies.
  const digestPromise = fetchZoneDigest(config, zone);
  let payload: DigestPayload;
  let voice: string;
  switch (postType) {
    case 'digest': {
      const r = await composeDigestPost(config, character, zone);
      payload = r.payload;
      voice = r.voice;
      break;
    }
    case 'micro': {
      const r = await composeMicroPost(config, character, zone);
      payload = r.payload;
      voice = r.message.voiceContent;
      break;
    }
    case 'lore_drop': {
      const r = await composeLoreDropPost(config, character, zone);
      payload = r.payload;
      voice = r.message.voiceContent;
      break;
    }
    case 'question': {
      const r = await composeQuestionPost(config, character, zone);
      payload = r.payload;
      voice = r.message.voiceContent;
      break;
    }
    case 'weaver': {
      const r = await composeWeaverPost(config, character, zone);
      payload = r.payload;
      voice = r.message.voiceContent;
      break;
    }
    case 'callout': {
      const r = await composeCalloutPost(config, character, zone);
      payload = r.payload;
      voice = r.message.voiceContent;
      break;
    }
    default:
      throw new Error(`composeOrchestratedPost: post type "${postType}" not migrated yet`);
  }
  const digest = await digestPromise;
  return { zone, postType, digest, voice, payload };
}

/**
 * cycle-006 pop-in dispatch helper — for cron-cadence callers that want
 * a deterministic pop-in (random sub-type selection). Returns the same
 * PostComposeResult shape via the orchestrator path.
 */
export async function composePopInDispatch(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
): Promise<PostComposeResult> {
  const digestPromise = fetchZoneDigest(config, zone);
  const r = await composePopInPost(config, character, zone);
  const digest = await digestPromise;
  return {
    zone,
    postType: r.postType as PostType,
    digest,
    voice: r.message.voiceContent,
    payload: r.payload,
  };
}

export async function composeZonePost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  postType: PostType = 'digest',
  _opts: ComposeZonePostOpts = {},
): Promise<PostComposeResult | null> {
  // BB design-review F-007 closure: 'reply' takes chat-reply-orchestrator (S5).
  // Cron callsites pass cron-cadence post types; reply leaking here is a
  // programming error. Type-level rejection is enforced via ZoneRoutedPostType
  // (see ZONE_ROUTED_POST_TYPES); runtime check guards JS callers.
  if (postType === 'reply') {
    throw new Error(`composeZonePost: 'reply' is chat-only — use chat-reply-orchestrator instead`);
  }
  const routed = postType as ZoneRoutedPostType;
  if (MIGRATED_POST_TYPES.has(routed)) {
    return composeOrchestratedPost(config, character, zone, routed);
  }
  throw new Error(`composeZonePost: unsupported zone-routed post type "${postType}"`);
}

// cycle-006 S4 · applyHeadlineLock helper removed alongside the legacy
// LLM-call path. Headline-lock enforcement now lives inside each
// orchestrator's voice-gen chain (claude-sdk.live.ts already sanitizes
// voice output via stripVoiceDisciplineDrift + escapeDiscordMarkdown).

export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

export function describePost(zone: ZoneId, postType: PostType): string {
  return `${zone}/${postType} (${POST_TYPE_SPECS[postType].cadence})`;
}
