import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';

export interface ClaudeSdkMock extends VoiceGenPort {
  readonly calls: ReadonlyArray<DigestSnapshot>;
}

export function createClaudeSdkMock(augment: VoiceAugment = { header: 'mock voice', outro: '' }): ClaudeSdkMock {
  const calls: DigestSnapshot[] = [];
  return {
    calls,
    generateDigestVoice: async (snapshot) => {
      calls.push(snapshot);
      return augment;
    },
  };
}

