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
}
