// cycle-006 S2 T2.5 · rejection-log + storm-alert tests.
// FLATLINE-SKP-002/HIGH closure verification: 2 rejections within 1h → storm.

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordRejection, detectStorm } from './score-snapshot-rejections.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { PlausibilityValidation } from '../domain/validate-snapshot-plausibility.ts';

function snapshotOf(zone: 'stonehenge' | 'bear-cave' = 'stonehenge'): DigestSnapshot {
  return {
    zone,
    dimension: 'overall',
    displayName: zone,
    windowDays: 30,
    generatedAt: '2026-05-15T00:00:00Z',
    totalEvents: 100,
    previousPeriodEvents: 50,
    deltaPct: 100,
    deltaCount: 50,
    coldFactorCount: 0,
    totalFactorCount: 0,
    topFactors: [],
    coldFactors: [],
  };
}

const VALIDATION_BLOCK: PlausibilityValidation = {
  ok: false,
  reason: 'event-count-outlier',
  computedSigma: 5,
  threshold: 3,
  baselineSampleCount: 30,
};

let testDir: string;
let originalCwd: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'rejection-test-'));
  originalCwd = process.cwd();
  process.chdir(testDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
});

describe('recordRejection', () => {
  test('appends a structured entry to .run/score-snapshot-rejections.jsonl', () => {
    const entry = recordRejection('stonehenge', snapshotOf(), VALIDATION_BLOCK);
    expect(entry.zone).toBe('stonehenge');
    expect(entry.reason).toBe('event-count-outlier');
    expect(entry.computed_sigma).toBe(5);
    expect(entry.threshold).toBe(3);
    expect(entry.baseline_sample_count).toBe(30);
  });

  test('multiple appends accumulate', () => {
    recordRejection('stonehenge', snapshotOf(), VALIDATION_BLOCK);
    recordRejection('bear-cave', snapshotOf('bear-cave'), VALIDATION_BLOCK);
    const fs = require('node:fs');
    const content = fs.readFileSync('.run/score-snapshot-rejections.jsonl', 'utf-8');
    expect(content.split('\n').filter((l: string) => l.trim()).length).toBe(2);
  });
});

describe('detectStorm', () => {
  test('returns empty when no rejections exist', () => {
    expect(detectStorm()).toEqual([]);
  });

  test('returns empty when only 1 rejection in window', () => {
    recordRejection('stonehenge', snapshotOf(), VALIDATION_BLOCK);
    expect(detectStorm()).toEqual([]);
  });

  test('FLATLINE-SKP-002 · 2 rejections within 1h triggers storm', () => {
    recordRejection('stonehenge', snapshotOf(), VALIDATION_BLOCK);
    recordRejection('bear-cave', snapshotOf('bear-cave'), VALIDATION_BLOCK);
    const storm = detectStorm();
    expect(storm.length).toBe(2);
    expect(storm.some((e) => e.zone === 'stonehenge')).toBe(true);
    expect(storm.some((e) => e.zone === 'bear-cave')).toBe(true);
  });

  test('rejections older than 7d are pruned + don\'t count toward storm', () => {
    // Simulate an old rejection by writing directly.
    const fs = require('node:fs');
    fs.mkdirSync('.run', { recursive: true });
    const oldEntry = {
      zone: 'stonehenge',
      rejected_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'event-count-outlier',
      baseline_sample_count: 30,
      snapshot_generated_at: '2026-05-08T00:00:00Z',
      snapshot_total_events: 100,
    };
    fs.writeFileSync('.run/score-snapshot-rejections.jsonl', JSON.stringify(oldEntry) + '\n');
    // Add one recent — should not trigger storm alone.
    recordRejection('bear-cave', snapshotOf('bear-cave'), VALIDATION_BLOCK);
    const storm = detectStorm();
    expect(storm.length).toBe(0);
    // The old entry should have been pruned from the file.
    const content = fs.readFileSync('.run/score-snapshot-rejections.jsonl', 'utf-8');
    expect(content).not.toContain('2026-05-08');
  });
});
