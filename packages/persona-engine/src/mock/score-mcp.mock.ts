import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ActivityPulse } from '../domain/activity-pulse.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { ZoneId } from '../score/types.ts';

export function createScoreMcpMock(fixtures: Partial<Record<ZoneId, DigestSnapshot>> = {}): ScoreFetchPort {
  return {
    fetchDigestSnapshot: async (zone) => fixtures[zone] ?? mockDigestSnapshot(zone),
    fetchActivityPulse: async ({ limit }): Promise<ActivityPulse> => ({
      generatedAt: '2026-05-16T00:00:00.000Z',
      events: Array.from({ length: Math.min(limit, 2) }, (_, i) => ({
        event_id: `evt-${i}`,
        wallet: `0x${String(i + 1).padStart(40, '0')}`,
        factor_id: 'og:sets',
        factor_display_name: 'Sets',
        dimension: 'og',
        category_key: 'og',
        description: `mock event ${i + 1}`,
        raw_value: 1,
        raw_value_kind: 'count',
        timestamp: '2026-05-16T00:00:00.000Z',
      })),
    }),
  };
}

export function mockDigestSnapshot(zone: ZoneId = 'bear-cave'): DigestSnapshot {
  return {
    zone,
    dimension: zone === 'stonehenge' ? 'overall' : 'og',
    displayName: zone === 'stonehenge' ? 'Overall' : 'OG',
    windowDays: 30,
    generatedAt: '2026-05-16T00:00:00.000Z',
    totalEvents: 12,
    previousPeriodEvents: 10,
    deltaPct: 20,
    deltaCount: 2,
    activeWallets: 4,
    coldFactorCount: 1,
    totalFactorCount: 3,
    topFactors: [
      {
        factorId: 'og:sets',
        displayName: 'Sets',
        primaryAction: 'Sets',
        total: 8,
        previous: 6,
        deltaPct: 33,
        deltaCount: 2,
      },
      {
        factorId: 'og:articles',
        displayName: 'Articles',
        primaryAction: 'Articles',
        total: 4,
        previous: 4,
        deltaPct: 0,
        deltaCount: 0,
      },
    ],
    coldFactors: [
      {
        factorId: 'og:cold',
        displayName: 'Cold One',
        primaryAction: null,
        total: 0,
        previous: 0,
        deltaPct: null,
        deltaCount: 0,
      },
    ],
  };
}

