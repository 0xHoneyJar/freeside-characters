import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { WeaverMessage } from '../domain/post-messages.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { toWeaverPayload } from '../live/discord-webhook.live.ts';
import { deriveShape } from '../domain/derive-shape.ts';
import { ZONE_IDS } from '../score/types.ts';

export interface WeaverPostResult {
  readonly zone: ZoneId;
  readonly postType: 'weaver';
  readonly message: WeaverMessage;
  readonly payload: DigestPayload;
}

export interface WeaverOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
}

/**
 * Weaver crosses zones — per FLATLINE-SKP-001/860 contract, weaver MUST pass
 * the full multi-zone array to deriveShape. Fetches all 4 zones in parallel.
 */
export async function composeWeaverPost(
  config: Config,
  character: CharacterConfig,
  focalZone: ZoneId,
  deps: WeaverOrchestratorDeps = {},
): Promise<WeaverPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  const voiceGen = deps.voice ?? createClaudeSdkLive(config, character);
  const renderer = deps.presentation ?? presentation;

  const allZones = await Promise.all(ZONE_IDS.map((z) => score.fetchDigestSnapshot(z)));
  const focal = allZones.find((s) => s.zone === focalZone) ?? allZones[0]!;
  const derived = deriveShape({ snapshot: focal, crossZone: allZones });

  const augment: VoiceAugment | undefined = config.VOICE_DISABLED
    ? undefined
    : await voiceGen.generateDigestVoice(focal, { derived });

  const message = renderer.renderWeaver(focal, allZones, augment);
  return { zone: focalZone, postType: 'weaver', message, payload: toWeaverPayload(message) };
}
