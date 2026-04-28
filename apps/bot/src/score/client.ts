/**
 * Score-mibera (score-api) HTTP client.
 *
 * V1 calls `GET /v1/activity-summary` — endpoint pending zerker per
 * loa-freeside#191. Until then, STUB_MODE returns a synthetic
 * `ActivitySummary` so the rest of the pipeline is testable end-to-end.
 *
 * When the real endpoint lands, replace fetchSummary's stub branch with
 * an HTTP call. Type contract is stable.
 */

import type { Config } from '../config.ts';
import type { ActivitySummary, ActivitySummaryRequest } from './types.ts';

export async function fetchSummary(
  config: Config,
  req: ActivitySummaryRequest,
): Promise<ActivitySummary> {
  if (config.STUB_MODE) {
    return generateStubSummary(req);
  }

  // V2: real call — currently 404 until zerker ships /v1/activity-summary
  const url = `${config.SCORE_API_URL}/v1/activity-summary`;
  const params = new URLSearchParams({
    worldId: req.worldId,
    ...(req.appId && { appId: req.appId }),
    windowStart: req.windowStart,
    windowEnd: req.windowEnd,
    granularity: req.granularity,
    groupBy: req.groupBy,
    ...(req.topActors && { topActors: String(req.topActors) }),
    ...(req.topFactors && { topFactors: String(req.topFactors) }),
  });

  const response = await fetch(`${url}?${params}`, {
    headers: {
      ...(config.SCORE_API_KEY && { 'x-api-key': config.SCORE_API_KEY }),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`score-api error: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as ActivitySummary;
}

/**
 * Stub generator — produces a deterministic synthetic ActivitySummary
 * so the bot can run end-to-end without a real score-api.
 *
 * Varies the shape based on the day of week to surface different digest cases:
 * - sunday: normal week
 * - monday: quiet week
 * - tuesday: spike week
 * - wednesday: thin-data week
 * - rest: normal week
 */
export function generateStubSummary(req: ActivitySummaryRequest): ActivitySummary {
  const now = Date.now();
  const dow = new Date(now).getUTCDay();

  const baseFactors = [
    { factorId: 'nft:mibera', baseline: 51 },
    { factorId: 'og:sets', baseline: 38 },
    { factorId: 'onchain:lp_provide', baseline: 24 },
    { factorId: 'nft:honeycomb', baseline: 18 },
  ];

  // shape modulation
  const shapes: Record<number, ShapeOverride> = {
    0: { multiplier: 1, label: 'normal', notable: 1, rankShifts: 1, direction: 'flat' },
    1: { multiplier: 0.1, label: 'quiet', notable: 0, rankShifts: 0, direction: 'flat' },
    2: { multiplier: 4.5, label: 'spike', notable: 3, rankShifts: 3, direction: 'up' },
    3: { multiplier: 0.2, label: 'thin', notable: 0, rankShifts: 0, direction: 'flat' },
  };
  const shape = shapes[dow] ?? shapes[0]!;

  const topFactors: ActivitySummary['topFactors'] = baseFactors.map((f) => ({
    factorId: f.factorId,
    eventCount: Math.floor(f.baseline * shape.multiplier),
    uniqueActors: Math.max(1, Math.floor(f.baseline * shape.multiplier * 0.25)),
    rankDelta: shape.label === 'spike' ? Math.floor(Math.random() * 4) - 2 : 0,
  }));

  const totalEvents = topFactors.reduce((s, f) => s + f.eventCount, 0);
  const totalActors = Math.floor(totalEvents * 0.22);
  const factorsTouched = topFactors.filter((f) => f.eventCount > 0).length;

  const notableEvents: ActivityEvent[] = Array.from({ length: shape.notable }, (_, i) => ({
    eventId: `8453:0xfa${i}3e:1`,
    worldId: req.worldId,
    appId: req.appId ?? 'midi',
    actor: `0x${randomHex(2)}...${randomHex(2)}`,
    factorId: 'og:sets',
    categoryKey: 'mibera_acquire',
    txHash: `0xfa${randomHex(4)}3e`,
    chainId: '8453',
    timestamp: now - i * 3600 * 1000,
    numeric1: '1000000000000000000',
  }));

  const rankMovements: ActivitySummary['rankMovements'] = Array.from(
    { length: shape.rankShifts },
    (_, i) => ({
      address: `0x${randomHex(2)}...${randomHex(2)}`,
      prevRank: 84 - i * 20,
      newRank: 41 - i * 15,
      factorId: i === 0 ? 'og:sets' : 'nft:mibera',
    }),
  );

  return {
    worldId: req.worldId,
    appId: req.appId,
    window: {
      start: req.windowStart,
      end: req.windowEnd,
      granularity: req.granularity,
    },
    totals: {
      eventCount: shape.label === 'thin' ? 89 : totalEvents,
      activeActors: shape.label === 'thin' ? 12 : totalActors,
      factorsTouched: shape.label === 'thin' ? 4 : factorsTouched,
    },
    topFactors: topFactors.filter((f) => f.eventCount > 0),
    topActors: topFactors.slice(0, req.topActors ?? 3).map((f, i) => ({
      address: `0x${randomHex(2)}...${randomHex(2)}`,
      eventCount: Math.floor(f.eventCount / 4),
      factorsTouched: 2 + i,
      scoreDelta: shape.label === 'spike' ? 12 + i : 0,
    })),
    notableEvents,
    rankMovements,
    windowComparison:
      shape.label !== 'thin'
        ? {
            eventCount: Math.floor(totalEvents * 0.85),
            activeActors: Math.floor(totalActors * 0.9),
            direction: shape.direction,
            eventCountDelta: totalEvents - Math.floor(totalEvents * 0.85),
          }
        : undefined,
    computedAt: now,
  };
}

interface ShapeOverride {
  multiplier: number;
  label: 'normal' | 'quiet' | 'spike' | 'thin';
  notable: number;
  rankShifts: number;
  direction: 'up' | 'down' | 'flat';
}

import type { ActivityEvent } from './types.ts';

function randomHex(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
