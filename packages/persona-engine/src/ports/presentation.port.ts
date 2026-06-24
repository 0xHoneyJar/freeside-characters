import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestMessage } from '../domain/digest-message.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { ActivityPulse, ActivityPulseMessage } from '../domain/activity-pulse.ts';
import type {
  MicroMessage,
  LoreDropMessage,
  QuestionMessage,
  WeaverMessage,
  CalloutMessage,
} from '../domain/post-messages.ts';
import type { DigestPayload } from '../deliver/embed.ts';

export interface PresentationPort {
  readonly renderDigest: (snapshot: DigestSnapshot, augment?: VoiceAugment) => DigestMessage;
  readonly renderActivityPulse?: (pulse: ActivityPulse) => ActivityPulseMessage;
  // cycle-006 S3 · per-post-type renderers · all take snapshot + optional voice.
  readonly renderMicro: (snapshot: DigestSnapshot, augment?: VoiceAugment) => MicroMessage;
  readonly renderLoreDrop: (snapshot: DigestSnapshot, augment?: VoiceAugment) => LoreDropMessage;
  readonly renderQuestion: (snapshot: DigestSnapshot, augment?: VoiceAugment) => QuestionMessage;
  readonly renderWeaver: (
    snapshot: DigestSnapshot,
    crossZone: ReadonlyArray<DigestSnapshot>,
    augment?: VoiceAugment,
  ) => WeaverMessage;
  readonly renderCallout: (snapshot: DigestSnapshot, augment?: VoiceAugment) => CalloutMessage;
  // cycle-007 S7 · G-6 leak closure: payload conversion is a presentation-layer concern.
  // Orchestrators import via this port instead of reaching into live/discord-webhook directly.
  // The medium-render layer (live/discord-webhook.live.ts) still OWNS the implementations;
  // the port re-exposes them so the seam is honored.
  readonly toDigestPayload: (message: DigestMessage) => DigestPayload;
  readonly toMicroPayload: (message: MicroMessage) => DigestPayload;
  readonly toLoreDropPayload: (message: LoreDropMessage) => DigestPayload;
  readonly toQuestionPayload: (message: QuestionMessage) => DigestPayload;
  readonly toWeaverPayload: (message: WeaverMessage) => DigestPayload;
  readonly toCalloutPayload: (message: CalloutMessage) => DigestPayload;
}
