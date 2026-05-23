import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { caseById } from './canonical-cases.ts';
import { resolveVariants } from './billboard-variants.ts';
import { runSyncStep, generate, captureAndRecord } from './loop.ts';
import { createTerminalAdapter } from '../adapters/terminal/index.ts';
import type { MediumAdapter } from '../ports/medium-adapter.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · core loop is medium-blind — proven via the terminal adapter + a stub.

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const tmpDirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'rlhf-loop-'));
  tmpDirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const input = () => ({
  snapshot: caseById('owsley-all-quiet')!.build(),
  voice: VOICE,
  variants: resolveVariants({ fireN: 3 }),
  batchId: 'rlhf-loop-test',
});

describe('core loop (medium-blind)', () => {
  test('runSyncStep with the terminal adapter records a rlhf-preference-v1 from supplied ratings', async () => {
    const dir = tmp();
    const adapter = createTerminalAdapter({
      log: () => {}, // silence
      ratings: [
        { variant: 'v0-baseline', score: 2, why: 'raw' },
        { variant: 'v1-plain', score: 5, why: 'legible' },
      ],
    });
    const { record, recordPath } = await runSyncStep(adapter, input(), { preferenceLogPath: join(dir, 'pref.jsonl') });
    expect(record.schema).toBe('rlhf-preference-v1');
    expect(record.chosen).toBe('v1-plain');
    expect(JSON.parse(readFileSync(recordPath, 'utf8').trim()).chosen).toBe('v1-plain');
  });

  test('the loop calls present then capture on the port (order + handoff)', async () => {
    const dir = tmp();
    const calls: string[] = [];
    const stub: MediumAdapter = {
      name: 'stub',
      present: async (batch) => {
        calls.push('present');
        return { batchId: batch.batchId, zone: batch.zone, presented: batch.candidates.map((c) => ({ variantId: c.variantId, handle: c.variantId })) };
      },
      capture: async () => {
        calls.push('capture');
        return { ratings: [{ variant: 'v0-baseline', score: 4 }] };
      },
    };
    const batch = generate(input());
    const presented = await stub.present(batch);
    const { record } = await captureAndRecord(stub, batch, presented, { preferenceLogPath: join(dir, 'p.jsonl') });
    expect(calls).toEqual(['present', 'capture']);
    expect(record.chosen).toBe('v0-baseline');
  });
});
