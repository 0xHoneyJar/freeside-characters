import type { RecentEventRow } from '../score/index.ts';

export interface ActivityPulse {
  readonly generatedAt: string;
  readonly events: ReadonlyArray<RecentEventRow>;
}

export interface ActivityPulseMessage {
  readonly content: string;
}
