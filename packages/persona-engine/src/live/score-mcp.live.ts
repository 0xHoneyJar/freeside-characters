import type { Config } from '../config.ts';
import {
  fetchDimensionBreakdown,
  fetchRecentEvents,
} from '../score/client.ts';
import {
  ZONE_TO_DIMENSION,
  type PulseDimensionBreakdown,
  type ZoneId,
} from '../score/types.ts';
import type { DigestSnapshot, DigestFactorSnapshot } from '../domain/digest-snapshot.ts';
import type { ActivityPulse } from '../domain/activity-pulse.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';

export function createScoreMcpLive(config: Config): ScoreFetchPort {
  return {
    fetchDigestSnapshot: (zone) => fetchDigestSnapshot(config, zone),
    fetchActivityPulse: async ({ limit }) => {
      const response = await fetchRecentEvents(config, limit);
      return { generatedAt: response.generated_at, events: response.events };
    },
  };
}

export async function fetchDigestSnapshot(config: Config, zone: ZoneId): Promise<DigestSnapshot> {
  const dimension = ZONE_TO_DIMENSION[zone];
  const response =
    dimension === 'overall'
      ? await fetchDimensionBreakdown(config, undefined, 30)
      : await fetchDimensionBreakdown(config, dimension, 30);
  const snapshot =
    dimension === 'overall'
      ? aggregateBreakdowns(zone, response.generated_at, response.dimensions)
      : fromBreakdown(zone, response.generated_at, response.dimensions[0]);
  if (!snapshot) {
    throw new Error(`score-mcp: no dimension breakdown returned for zone ${zone}`);
  }
  return snapshot;
}

function fromFactor(factor: PulseDimensionBreakdown['top_factors'][number]): DigestFactorSnapshot {
  return {
    factorId: factor.factor_id,
    displayName: factor.display_name,
    primaryAction: factor.primary_action,
    total: factor.total,
    previous: factor.previous,
    deltaPct: factor.delta_pct,
    deltaCount: factor.delta_count,
    ...(factor.factor_stats ? { factorStats: factor.factor_stats } : {}),
  };
}

function fromBreakdown(
  zone: ZoneId,
  generatedAt: string,
  breakdown: PulseDimensionBreakdown | undefined,
): DigestSnapshot | null {
  if (!breakdown) return null;
  return {
    zone,
    dimension: breakdown.id,
    displayName: breakdown.display_name,
    windowDays: 30,
    generatedAt,
    totalEvents: breakdown.total_events,
    previousPeriodEvents: breakdown.previous_period_events,
    deltaPct: breakdown.delta_pct,
    deltaCount: breakdown.delta_count,
    activeWallets: sumActiveWallets(breakdown.top_factors),
    coldFactorCount: breakdown.inactive_factor_count,
    totalFactorCount: breakdown.total_factor_count,
    topFactors: breakdown.top_factors.map(fromFactor),
    coldFactors: breakdown.cold_factors.map(fromFactor),
  };
}

function aggregateBreakdowns(
  zone: ZoneId,
  generatedAt: string,
  breakdowns: ReadonlyArray<PulseDimensionBreakdown>,
): DigestSnapshot {
  const totalEvents = breakdowns.reduce((sum, dim) => sum + dim.total_events, 0);
  const previousPeriodEvents = breakdowns.reduce((sum, dim) => sum + dim.previous_period_events, 0);
  const topFactors = breakdowns
    .flatMap((dim) => dim.top_factors.map(fromFactor))
    .sort((a, b) => b.total - a.total || a.factorId.localeCompare(b.factorId));
  const coldFactors = breakdowns
    .flatMap((dim) => dim.cold_factors.map(fromFactor))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.factorId.localeCompare(b.factorId));
  return {
    zone,
    dimension: 'overall',
    displayName: 'Overall',
    windowDays: 30,
    generatedAt,
    totalEvents,
    previousPeriodEvents,
    deltaPct:
      previousPeriodEvents === 0
        ? null
        : ((totalEvents - previousPeriodEvents) / previousPeriodEvents) * 100,
    deltaCount: totalEvents - previousPeriodEvents,
    activeWallets: sumActiveWallets(breakdowns.flatMap((dim) => dim.top_factors)),
    coldFactorCount: breakdowns.reduce((sum, dim) => sum + dim.inactive_factor_count, 0),
    totalFactorCount: breakdowns.reduce((sum, dim) => sum + dim.total_factor_count, 0),
    topFactors,
    coldFactors,
  };
}

function sumActiveWallets(factors: ReadonlyArray<PulseDimensionBreakdown['top_factors'][number]>): number {
  return factors.reduce((sum, factor) => sum + (factor.factor_stats?.cohort?.unique_actors ?? 0), 0);
}

