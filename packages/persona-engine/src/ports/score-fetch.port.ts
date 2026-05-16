import type { ZoneId } from '../score/types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ActivityPulse } from '../domain/activity-pulse.ts';

export interface ScoreFetchPort {
  readonly fetchDigestSnapshot: (zone: ZoneId) => Promise<DigestSnapshot>;
  readonly fetchActivityPulse: (args: { limit: number }) => Promise<ActivityPulse>;
}

