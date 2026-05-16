import type { RecentEventRow } from '../score/types.ts';

export interface ActivityPulse {
  readonly generatedAt: string;
  readonly events: ReadonlyArray<RecentEventRow>;
}

export interface ActivityPulseMessage {
  readonly content: string;
}
