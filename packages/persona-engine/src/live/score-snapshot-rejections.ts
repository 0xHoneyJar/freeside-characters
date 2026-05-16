// cycle-006 S2 T2.5 · rejection log + storm-alert detection.
// FLATLINE-SKP-002/HIGH closure: NO silent fallback. Every rejected snapshot
// produces a structured Decision Log entry; >1 rejection per 24h triggers a
// storm alert (caller surfaces as OTEL `score.snapshot.fallback_storm`).

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ZoneId } from '../score/types.ts';
import type { PlausibilityValidation } from '../domain/validate-snapshot-plausibility.ts';

const REJECTIONS_PATH = '.run/score-snapshot-rejections.jsonl';
const STORM_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const STORM_THRESHOLD = 2; // 2 rejections within window → storm
const PRUNE_OLDER_THAN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface RejectionEntry {
  readonly zone: ZoneId;
  readonly rejected_at: string;
  readonly reason: string;
  readonly computed_sigma?: number;
  readonly threshold?: number;
  readonly baseline_sample_count: number;
  readonly snapshot_generated_at: string;
  readonly snapshot_total_events: number;
}

export function recordRejection(
  zone: ZoneId,
  snapshot: DigestSnapshot,
  validation: PlausibilityValidation,
): RejectionEntry {
  const entry: RejectionEntry = {
    zone,
    rejected_at: new Date().toISOString(),
    reason: validation.reason ?? 'unknown',
    ...(validation.computedSigma !== undefined ? { computed_sigma: validation.computedSigma } : {}),
    ...(validation.threshold !== undefined ? { threshold: validation.threshold } : {}),
    baseline_sample_count: validation.baselineSampleCount,
    snapshot_generated_at: snapshot.generatedAt,
    snapshot_total_events: snapshot.totalEvents,
  };
  mkdirSync(dirname(REJECTIONS_PATH), { recursive: true });
  appendFileSync(REJECTIONS_PATH, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Check whether the last `STORM_THRESHOLD` rejections (for any zone) fall
 * within `STORM_WINDOW_MS` of `nowIso`. Returns the offending entries when
 * a storm is detected; otherwise an empty array.
 *
 * Pruning: drops entries older than PRUNE_OLDER_THAN_MS during read to keep
 * the file from growing unbounded.
 */
export function detectStorm(nowIso: string = new Date().toISOString()): ReadonlyArray<RejectionEntry> {
  if (!existsSync(REJECTIONS_PATH)) return [];
  const now = Date.parse(nowIso);
  let entries: RejectionEntry[];
  try {
    const text = readFileSync(REJECTIONS_PATH, 'utf-8');
    entries = text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l) as RejectionEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is RejectionEntry => e !== null);
  } catch {
    return [];
  }
  // Prune ancient entries (in-place rewrite).
  const recent = entries.filter((e) => now - Date.parse(e.rejected_at) <= PRUNE_OLDER_THAN_MS);
  if (recent.length !== entries.length) {
    writeFileSync(REJECTIONS_PATH, recent.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }
  // Within the storm window — count.
  const inWindow = recent.filter((e) => now - Date.parse(e.rejected_at) <= STORM_WINDOW_MS);
  if (inWindow.length >= STORM_THRESHOLD) return inWindow;
  return [];
}
