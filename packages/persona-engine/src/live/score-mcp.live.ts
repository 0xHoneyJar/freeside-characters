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
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import { validateSnapshotPlausibility } from '../domain/validate-snapshot-plausibility.ts';
import { readBaseline, appendBaseline } from './score-baselines.ts';
import { recordRejection, detectStorm } from './score-snapshot-rejections.ts';
import { getTracer } from '../observability/otel-layer.ts';

export function createScoreMcpLive(config: Config): ScoreFetchPort {
  return {
    fetchDigestSnapshot: (zone) => fetchValidatedDigestSnapshot(config, zone),
    fetchActivityPulse: async ({ limit }) => {
      const response = await fetchRecentEvents(config, limit);
      return { generatedAt: response.generated_at, events: response.events };
    },
  };
}

/**
 * Fetch a digest snapshot from score-mcp AND validate it against the
 * zone's rolling-window baseline before handing it downstream.
 *
 * Red Team AC-RT-008 + FLATLINE-SKP-002/HIGH + FLATLINE-SKP-003/HIGH closure.
 *
 * On REJECTION:
 *   1. Record structured entry to `.run/score-snapshot-rejections.jsonl`
 *   2. Emit OTEL `score.snapshot.implausible` event on a fresh span
 *   3. Detect storm (>=2 rejections within 1h) — emit `score.snapshot.fallback_storm`
 *   4. Return a NEUTERED snapshot (topFactors stripped) so downstream
 *      `deriveShape` naturally yields `shape: A-all-quiet`. Baseline is
 *      NOT updated with rejected snapshot.
 *
 * On ACCEPT: append to baseline, return raw snapshot.
 *
 * Skipping validation: set `FREESIDE_SCORE_VALIDATION_SKIP=1` (test/operator escape).
 */
export async function fetchValidatedDigestSnapshot(config: Config, zone: ZoneId): Promise<DigestSnapshot> {
  const snapshot = await fetchDigestSnapshot(config, zone);

  if (process.env.FREESIDE_SCORE_VALIDATION_SKIP === '1') return snapshot;

  const baseline = readBaseline(zone);
  const validation = validateSnapshotPlausibility(snapshot, baseline);

  if (validation.ok) {
    appendBaseline(zone, snapshot);
    return snapshot;
  }

  // REJECTED — record + emit telemetry + return neutered.
  const entry = recordRejection(zone, snapshot, validation);

  const tracer = getTracer();
  tracer.startActiveSpan('score.snapshot.implausible', (span) => {
    try {
      span.setAttribute('zone', zone);
      span.setAttribute('reason', entry.reason);
      if (validation.computedSigma !== undefined) {
        span.setAttribute('computed_sigma', validation.computedSigma);
      }
      if (validation.threshold !== undefined) {
        span.setAttribute('threshold', validation.threshold);
      }
      span.setAttribute('baseline_sample_count', validation.baselineSampleCount);
    } finally {
      span.end();
    }
  });

  const stormEntries = detectStorm();
  if (stormEntries.length > 0) {
    tracer.startActiveSpan('score.snapshot.fallback_storm', (span) => {
      try {
        span.setAttribute('storm_size', stormEntries.length);
        span.setAttribute('zones', Array.from(new Set(stormEntries.map((e) => e.zone))).join(','));
      } finally {
        span.end();
      }
    });
  }

  // Return neutered — strip topFactors so deriveShape yields A-all-quiet.
  return {
    ...snapshot,
    topFactors: [],
    coldFactors: snapshot.coldFactors,
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
