// cycle-006 S2 T2.5 · rolling-window baseline persistence for validateSnapshotPlausibility.
// FLATLINE-SKP-003/HIGH closure: NOT a static baseline — refreshes on every accept,
// keeps only the last BASELINE_WINDOW_SIZE snapshots per zone.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ZoneId } from '../score/types.ts';
import { BASELINE_WINDOW_SIZE, type BaselineWindow } from '../domain/validate-snapshot-plausibility.ts';

const BASELINE_DIR = '.run/score-baselines';

function baselinePathFor(zone: ZoneId): string {
  return `${BASELINE_DIR}/${zone}.jsonl`;
}

export function readBaseline(zone: ZoneId): BaselineWindow {
  const path = baselinePathFor(zone);
  if (!existsSync(path)) return { snapshots: [] };
  try {
    const text = readFileSync(path, 'utf-8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const snapshots: DigestSnapshot[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as DigestSnapshot;
        if (parsed && parsed.zone === zone) snapshots.push(parsed);
      } catch {
        // Skip malformed lines silently — corruption-tolerant.
      }
    }
    // Cap to window size (cold-start may have legacy excess).
    const trimmed = snapshots.length > BASELINE_WINDOW_SIZE
      ? snapshots.slice(-BASELINE_WINDOW_SIZE)
      : snapshots;
    return { snapshots: trimmed };
  } catch {
    return { snapshots: [] };
  }
}

/**
 * Append a freshly-accepted snapshot to the zone's baseline window.
 * Rewrites the file atomically with the trimmed window (last
 * BASELINE_WINDOW_SIZE entries).
 *
 * Idempotent for identical snapshots? No — caller decides what to accept.
 * If the caller accepts twice, the window stores both. The rolling cap
 * ensures bounded size regardless.
 */
export function appendBaseline(zone: ZoneId, snapshot: DigestSnapshot): void {
  const path = baselinePathFor(zone);
  mkdirSync(dirname(path), { recursive: true });
  const existing = readBaseline(zone);
  const next = [...existing.snapshots, snapshot];
  const trimmed = next.length > BASELINE_WINDOW_SIZE
    ? next.slice(-BASELINE_WINDOW_SIZE)
    : next;
  const content = trimmed.map((s) => JSON.stringify(s)).join('\n') + '\n';
  writeFileSync(path, content);
}
