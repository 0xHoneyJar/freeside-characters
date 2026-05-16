import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { LoreDropMessage } from '../domain/post-messages.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { toLoreDropPayload } from '../live/discord-webhook.live.ts';
import { deriveShape } from '../domain/derive-shape.ts';

export interface LoreDropPostResult {
  readonly zone: ZoneId;
  readonly postType: 'lore_drop';
  readonly message: LoreDropMessage;
  readonly payload: DigestPayload;
}

export interface LoreDropOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
}

export async function composeLoreDropPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: LoreDropOrchestratorDeps = {},
): Promise<LoreDropPostResult> {
  const score = deps.score ?? createScoreMcpLive(config);
  const voiceGen = deps.voice ?? createClaudeSdkLive(config, character);
  const renderer = deps.presentation ?? presentation;

  const snapshot = await score.fetchDigestSnapshot(zone);
  const derived = deriveShape({ snapshot, crossZone: [snapshot] });
  const augment: VoiceAugment | undefined = config.VOICE_DISABLED
    ? undefined
    : await voiceGen.generateDigestVoice(snapshot, { derived });

  const message = renderer.renderLoreDrop(snapshot, augment);
  return { zone, postType: 'lore_drop', message, payload: toLoreDropPayload(message) };
}
