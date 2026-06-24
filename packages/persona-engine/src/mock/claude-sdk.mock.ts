import type { VoiceGenPort, VoiceGenContext } from '../ports/voice-gen.port.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';

export interface ClaudeSdkMockCall {
  readonly snapshot: DigestSnapshot;
  readonly ctx: VoiceGenContext;
}

export interface ClaudeSdkMock extends VoiceGenPort {
  readonly calls: ReadonlyArray<ClaudeSdkMockCall>;
}

export function createClaudeSdkMock(augment: VoiceAugment = { header: 'mock voice', outro: '' }): ClaudeSdkMock {
  const calls: ClaudeSdkMockCall[] = [];
  return {
    calls,
    generateDigestVoice: async (snapshot, ctx) => {
      calls.push({ snapshot, ctx });
      return augment;
    },
  };
}
