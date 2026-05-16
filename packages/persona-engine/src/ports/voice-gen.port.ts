import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';

export interface VoiceGenPort {
  readonly generateDigestVoice: (snapshot: DigestSnapshot) => Promise<VoiceAugment>;
}

