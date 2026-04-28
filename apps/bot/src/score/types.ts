/**
 * Score-vault contract types — mirror of the proposed schemas in:
 * vault/wiki/concepts/score-vault.md
 *
 * V1 keeps these types local; when score-vault repo ships, we import from
 * `@score-vault/ports` instead. Same shape, formal source.
 */

export interface ActivitySummaryRequest {
  worldId: string;
  appId?: string;
  windowStart: string; // ISO-8601
  windowEnd: string;   // ISO-8601
  granularity: 'hour' | 'day' | 'week' | 'month';
  groupBy: 'factor' | 'category' | 'actor' | 'world';
  topActors?: number;
  topFactors?: number;
}

export interface ActivitySummary {
  worldId: string;
  appId?: string;
  window: {
    start: string;
    end: string;
    granularity: string;
  };
  totals: {
    eventCount: number;
    activeActors: number;
    factorsTouched: number;
  };
  topFactors: TopFactor[];
  topActors: TopActor[];
  notableEvents: ActivityEvent[];
  rankMovements: RankMovement[];
  /** Optional comparison field — only present when prior window exists */
  windowComparison?: {
    eventCount: number;
    activeActors: number;
    direction: 'up' | 'down' | 'flat';
    eventCountDelta: number;
  };
  computedAt: number; // unix ms
}

export interface TopFactor {
  factorId: string;       // 'nft:mibera', 'og:sets'
  eventCount: number;
  uniqueActors: number;
  rankDelta?: number;
}

export interface TopActor {
  address: string;        // lowercase
  eventCount: number;
  factorsTouched: number;
  scoreDelta?: number;
}

export interface ActivityEvent {
  eventId: string;        // dedup key — `${chainId}:${txHash}:${logIndex}`
  worldId: string;
  appId: string;
  actor: string;
  factorId: string;
  categoryKey: string;
  txHash?: string;
  chainId?: string;
  timestamp: number;      // unix ms
  numeric1?: string;      // BigInt as string
  numeric2?: string;
  metadata?: Record<string, unknown>;
}

export interface RankMovement {
  address: string;
  prevRank: number;
  newRank: number;
  factorId?: string;
}
