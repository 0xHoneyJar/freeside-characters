import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { DigestMessage } from '../domain/digest-message.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { ActivityPulse, ActivityPulseMessage } from '../domain/activity-pulse.ts';

export interface PresentationPort {
  readonly renderDigest: (snapshot: DigestSnapshot, augment?: VoiceAugment) => DigestMessage;
  readonly renderActivityPulse?: (pulse: ActivityPulse) => ActivityPulseMessage;
}
