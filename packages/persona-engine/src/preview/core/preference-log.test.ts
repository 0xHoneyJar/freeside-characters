import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { caseById, buildSnapshot } from './canonical-cases.ts';
import { resolveVariants, variantById } from './billboard-variants.ts';
import { renderBatch, renderCandidate } from './render-candidate.ts';
import {
  buildPreferenceRecord,
  appendPreferenceRecord,
  promoteToEvals,
} from './preference-log.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · FR-41 persistence + FR-42 backpressure.

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: "i'll keep the lamp on." };
const owsleyQuiet = () => caseById('owsley-all-quiet')!.build();
const tmpDirs: string[] = [];

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rlhf-pref-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildPreferenceRecord (rlhf-preference-v0)', () => {
  test('produces the seeded schema shape', () => {
    const batch = renderBatch(owsleyQuiet(), VOICE, resolveVariants(), 'rlhf-test-pref');
    const record = buildPreferenceRecord({
      batch,
      chosen: 'v1-plain',
      annotation: 'plain english landed; dropped the score jargon',
    });
    expect(record.schema).toBe('rlhf-preference-v0');
    expect(record.loop).toBe('billboard-format');
    expect(record.zone).toBe('owsley-lab');
    expect(record.state).toBe('all-quiet');
    expect(record.snapshot).toEqual({ events_30d: 352, since_last: 0, active_wallets: 15 });
    expect(record.candidates).toEqual(batch.candidates.map((c) => c.variantId));
    expect(record.chosen).toBe('v1-plain');
    expect(record.ranking).toBeNull();
    expect(record.operator).toBe('zksoju');
  });

  test('active case classifies state="active"', () => {
    const active = buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 });
    const batch = renderBatch(active, VOICE, resolveVariants({ fireN: 2 }), 'b');
    const record = buildPreferenceRecord({ batch, chosen: 'v0-baseline', annotation: 'x' });
    expect(record.state).toBe('active');
  });

  test('rejects a chosen variant not in the batch', () => {
    const batch = renderBatch(owsleyQuiet(), VOICE, resolveVariants({ fireN: 1 }), 'b');
    expect(() => buildPreferenceRecord({ batch, chosen: 'v3-minimal', annotation: 'x' })).toThrow(
      /not in this batch/,
    );
  });
});

describe('appendPreferenceRecord (zero-infra JSONL)', () => {
  test('appends a parseable JSONL line that round-trips', () => {
    const dir = tmp();
    const path = join(dir, 'preference-log.jsonl');
    const batch = renderBatch(owsleyQuiet(), VOICE, resolveVariants(), 'rlhf-test-append');
    const record = buildPreferenceRecord({ batch, chosen: 'v2-narrative', annotation: 'caption-like' });
    appendPreferenceRecord(record, path);
    appendPreferenceRecord(record, path);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]!)).toEqual(record);
  });
});

describe('promoteToEvals (FR-42 backpressure)', () => {
  test('writes a golden fixture with both beats + variant rationale', () => {
    const dir = tmp();
    const batch = renderBatch(owsleyQuiet(), VOICE, resolveVariants(), 'rlhf-test-promote');
    const candidate = renderCandidate(owsleyQuiet(), VOICE, variantById('v1-plain')!);
    const path = promoteToEvals({ batch, candidate, annotation: 'winner', dir });
    const md = readFileSync(path, 'utf8');
    expect(md).toContain('Beat 1 — the agent');
    expect(md).toContain('Beat 2 — the billboard');
    expect(md).toContain('v1-plain');
    expect(md).toContain("the lab's quiet today.");
    // exactly one file written into the eval dir
    expect(readdirSync(dir).length).toBe(1);
  });
});
