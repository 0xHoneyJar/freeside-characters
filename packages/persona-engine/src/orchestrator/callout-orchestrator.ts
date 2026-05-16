import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { CalloutMessage } from '../domain/post-messages.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import { createScoreMcpLive } from '../live/score-mcp.live.ts';
import { createClaudeSdkLive } from '../live/claude-sdk.live.ts';
import { presentation } from '../live/discord-render.live.ts';
import { toCalloutPayload } from '../live/discord-webhook.live.ts';
import { deriveShape } from '../domain/derive-shape.ts';

export interface CalloutPostResult {
  readonly zone: ZoneId;
  readonly postType: 'callout';
  readonly message: CalloutMessage;
  readonly payload: DigestPayload;
  readonly triggerId?: string;
}

export interface CalloutOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
  /**
   * Event-driven trigger ID. Validates against [A-Za-z0-9._:-]+ per SDD §3.7
   * pathFor safety regex. Untrusted input: caller supplies, orchestrator
   * rejects with throw on validation failure.
   */
  readonly triggerId?: string;
}

const TRIGGER_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export async function composeCalloutPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: CalloutOrchestratorDeps = {},
): Promise<CalloutPostResult> {
  if (deps.triggerId !== undefined && !TRIGGER_ID_PATTERN.test(deps.triggerId)) {
    throw new Error(`callout-orchestrator: invalid triggerId "${deps.triggerId}"`);
  }

  const score = deps.score ?? createScoreMcpLive(config);
  const voiceGen = deps.voice ?? createClaudeSdkLive(config, character);
  const renderer = deps.presentation ?? presentation;

  const snapshot = await score.fetchDigestSnapshot(zone);
  const derived = deriveShape({ snapshot, crossZone: [snapshot] });
  const augment: VoiceAugment | undefined = config.VOICE_DISABLED
    ? undefined
    : await voiceGen.generateDigestVoice(snapshot, { derived });

  const message = renderer.renderCallout(snapshot, augment);
  return {
    zone,
    postType: 'callout',
    message,
    payload: toCalloutPayload(message),
    ...(deps.triggerId ? { triggerId: deps.triggerId } : {}),
  };
}
