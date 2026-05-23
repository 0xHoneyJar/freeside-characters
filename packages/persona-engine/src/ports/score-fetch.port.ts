import type { ZoneId, PulseDimensionBreakdown } from '../score/index.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ActivityPulse } from '../domain/activity-pulse.ts';

export type PulseWindowDays = 7 | 30 | 90;

export interface ScoreFetchPort {
  readonly fetchDigestSnapshot: (zone: ZoneId) => Promise<DigestSnapshot>;
  readonly fetchActivityPulse: (args: { limit: number }) => Promise<ActivityPulse>;
  /**
   * cycle-007 S8 r4 (operator pivot 2026-05-17): raw per-dimension breakdowns
   * for the dashboard-aligned voiceless digest. Returns the actual score-mcp
   * `get_dimension_breakdown` payload (drop-in shape for score-dashboard's
   * /dimension/{id} card). Caller picks how to slice for the active zone.
   */
  readonly fetchDimensionBreakdowns: (args: {
    zone: ZoneId;
    windowDays: PulseWindowDays;
  }) => Promise<{
    generatedAt: string;
    /**
     * For per-dimension zones (bear-cave/el-dorado/owsley-lab) the array
     * holds exactly the one matching dimension. For stonehenge (overall)
     * it holds all 3 dimensions in canonical order [og, nft, onchain].
     */
    breakdowns: ReadonlyArray<PulseDimensionBreakdown>;
  }>;
}

