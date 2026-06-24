// cycle-008 S9 (g30) · the fixed input the RLHF preview fans variants over.
//
// The preview surface holds the DATA constant and varies the PRESENTATION — so the
// operator is comparing format, not noise. These cases are grounded in the operator's
// own live examples: `owsley-all-quiet` is the exact snapshot behind the first
// preference record (preference-log.jsonl · 352 events / 30d / 15 wallets / deltaPct 0)
// and the promoted golden (evals/snapshots/cycle-008-two-beat-owsley-lab.md).
// `owsley-active` adds the `-13%` delta the operator flagged as "reads alarmist", so
// the change-row framing can be iterated too.

import type { DigestSnapshot } from '../../domain/digest-snapshot.ts';
import type { ZoneId } from '../../score/index.ts';
import { ZONE_REGISTRY } from '../../domain/zone-registry.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

export interface SnapshotCaseInput {
  readonly zone: ZoneId;
  readonly windowDays?: 7 | 30 | 90;
  readonly totalEvents: number;
  readonly activeWallets?: number;
  /** null = no prior-period comparison; |value| < 1 renders as no change row (all-quiet). */
  readonly deltaPct?: number | null;
  readonly generatedAt?: string;
}

/**
 * Build a complete `DigestSnapshot` for preview. The two-beat micro billboard only
 * reads zone/windowDays/totalEvents/deltaPct/activeWallets, but the type requires a
 * full shape — topFactors/coldFactors are empty (the micro path renders neither).
 */
export function buildSnapshot(input: SnapshotCaseInput): DigestSnapshot {
  const windowDays = input.windowDays ?? 30;
  const deltaPct = input.deltaPct ?? null;
  // Derive a plausible prior-period total from the delta so the snapshot is internally
  // consistent (the billboard never reads it, but consumers/tests may).
  const previousPeriodEvents =
    deltaPct === null || deltaPct <= -100
      ? input.totalEvents
      : Math.round(input.totalEvents / (1 + deltaPct / 100));
  return {
    zone: input.zone,
    dimension: ZONE_REGISTRY[input.zone].dimension,
    displayName: ZONE_REGISTRY[input.zone].displayName,
    windowDays,
    generatedAt: input.generatedAt ?? '2026-05-22T00:00:00.000Z',
    totalEvents: input.totalEvents,
    previousPeriodEvents,
    deltaPct,
    deltaCount: input.totalEvents - previousPeriodEvents,
    activeWallets: input.activeWallets,
    coldFactorCount: 0,
    totalFactorCount: 0,
    topFactors: [],
    coldFactors: [],
  };
}

export interface CanonicalCase {
  readonly id: string;
  readonly note: string;
  /** A sensible default beat-1 voice (stats-out-of-voice · zero numbers). `--voice` overrides. */
  readonly defaultVoice: VoiceAugment;
  readonly build: () => DigestSnapshot;
}

const CASE_LIST: CanonicalCase[] = [
  {
    id: 'owsley-all-quiet',
    note: 'the first preference record + promoted golden: owsley-lab all-quiet, 352 events / 30d / 15 wallets / deltaPct 0.',
    defaultVoice: { header: "the lab's quiet today.", outro: "i'll keep the lamp on." },
    build: () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: 0 }),
  },
  {
    id: 'owsley-active',
    note: 'the same zone with the "-13%" delta the operator flagged as alarmist — for iterating the change-row framing.',
    defaultVoice: { header: 'the lab cooled off this week.', outro: 'still worth a look.' },
    build: () => buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 }),
  },
];

export const CANONICAL_CASES: ReadonlyArray<CanonicalCase> = CASE_LIST;

export function caseById(id: string): CanonicalCase | undefined {
  return CANONICAL_CASES.find((c) => c.id === id);
}
