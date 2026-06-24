import type { DigestPayload } from '../deliver/embed.ts';

export interface DeliverPort {
  readonly deliver: (payload: DigestPayload) => Promise<unknown>;
}

