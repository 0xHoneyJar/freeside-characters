import type { ZoneId, PulseDimension, FactorStats } from '../score/types.ts';

export type DigestSnapshotDimension = PulseDimension | 'overall';

export interface DigestFactorSnapshot {
  readonly factorId: string;
  readonly displayName: string;
  readonly primaryAction: string | null;
  readonly total: number;
  readonly previous: number;
  readonly deltaPct: number | null;
  readonly deltaCount: number;
  readonly factorStats?: FactorStats;
}

export interface DigestSnapshot {
  readonly zone: ZoneId;
  readonly dimension: DigestSnapshotDimension;
  readonly displayName: string;
  readonly windowDays: 30;
  readonly generatedAt: string;
  readonly totalEvents: number;
  readonly previousPeriodEvents: number;
  readonly deltaPct: number | null;
  readonly deltaCount: number;
  readonly activeWallets?: number;
  readonly coldFactorCount: number;
  readonly totalFactorCount: number;
  readonly topFactors: ReadonlyArray<DigestFactorSnapshot>;
  readonly coldFactors: ReadonlyArray<DigestFactorSnapshot>;
}

