import { describe, expect, test } from 'bun:test';
import { caseById, buildSnapshot } from './canonical-cases.ts';
import { resolveVariants, variantById } from './billboard-variants.ts';
import { templateToVariant, type BillboardTemplate } from './billboard-templates.ts';
import { renderCandidate, renderBatch } from './render-candidate.ts';
import { diffAgainstBaseline, diffBatch } from './candidate-diff.ts';
import { buildRatedRecord } from './preference-log.ts';
import type { VoiceAugment } from '../../domain/voice-augment.ts';

// cycle-008 S9 (g30) · attributable-signal diff + rlhf-preference-v1 ratings.

const VOICE: VoiceAugment = { header: "the lab's quiet today.", outro: '' };
const owsleyQuiet = () => caseById('owsley-all-quiet')!.build();
const codeTpl: BillboardTemplate = {
  id: 'tc', label: 'c', note: 'n', header: 'rich', surface: 'code-block',
  rows: [{ kind: 'metric', label: 'last 30 days', source: 'totalEvents' }],
};

describe('candidate diff (what changed vs baseline)', () => {
  test('baseline diffs to itself as isBaseline with no changes', () => {
    const v0 = renderCandidate(owsleyQuiet(), VOICE, variantById('v0-baseline')!);
    const d = diffAgainstBaseline(v0, v0);
    expect(d.isBaseline).toBe(true);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });

  test('a relabeled variant shows added + removed lines', () => {
    const v0 = renderCandidate(owsleyQuiet(), VOICE, variantById('v0-baseline')!);
    const v1 = renderCandidate(owsleyQuiet(), VOICE, variantById('v1-plain')!);
    const d = diffAgainstBaseline(v1, v0);
    expect(d.isBaseline).toBe(false);
    // v1 relabels "30d rolling"→"last 30 days", "wallets warm"→"active wallets"
    expect(d.added.some((l) => l.includes('last 30 days'))).toBe(true);
    expect(d.removed.some((l) => l.includes('30d rolling'))).toBe(true);
  });

  test('a code-block variant flags the surface change', () => {
    const v0 = renderCandidate(owsleyQuiet(), VOICE, variantById('v0-baseline')!);
    const code = renderCandidate(owsleyQuiet(), VOICE, templateToVariant(codeTpl));
    const d = diffAgainstBaseline(code, v0);
    expect(d.surfaceChanged).toBe(true);
    expect(d.baselineSurface).toBe('bold-text');
    expect(d.surface).toBe('code-block');
  });

  test('diffBatch diffs every candidate against v0-baseline', () => {
    const batch = renderBatch(owsleyQuiet(), VOICE, resolveVariants());
    const diffs = diffBatch(batch.candidates);
    expect(diffs.length).toBe(batch.candidates.length);
    expect(diffs.find((d) => d.variantId === 'v0-baseline')!.isBaseline).toBe(true);
  });
});

describe('buildRatedRecord (rlhf-preference-v1)', () => {
  const batch = () => renderBatch(owsleyQuiet(), VOICE, resolveVariants({ fireN: 3 }), 'b');

  test('argmax score → chosen, scores → ranking, v1 schema', () => {
    const rec = buildRatedRecord({
      batch: batch(),
      ratings: [
        { variant: 'v0-baseline', score: 2, why: 'too raw' },
        { variant: 'v1-plain', score: 5, why: 'legible' },
        { variant: 'v2-narrative', score: 3 },
      ],
    });
    expect(rec.schema).toBe('rlhf-preference-v1');
    expect(rec.chosen).toBe('v1-plain'); // highest score
    expect(rec.ranking).toEqual(['v1-plain', 'v2-narrative', 'v0-baseline']);
    expect(rec.annotation).toBe('legible'); // winner's why
    expect(rec.ratings!.length).toBe(3);
  });

  test('is a strict superset of v0 (chosen/ranking/annotation all populated)', () => {
    const rec = buildRatedRecord({ batch: batch(), ratings: [{ variant: 'v0-baseline', score: 4 }] });
    expect(rec.chosen).toBe('v0-baseline');
    expect(rec.ranking).toEqual(['v0-baseline']);
    expect(typeof rec.annotation).toBe('string');
  });

  test('why-only ratings (no score) are kept; chosen = argmax over the scored ones', () => {
    const rec = buildRatedRecord({
      batch: batch(),
      ratings: [
        { variant: 'v0-baseline', score: 1, why: 'raw' },
        { variant: 'v1-plain', why: 'none of these are formatted nicely' }, // reply-only, no reaction
      ],
    });
    expect(rec.chosen).toBe('v0-baseline'); // only scored candidate
    expect(rec.ratings!.length).toBe(2); // the why-only one is NOT dropped
    expect(rec.ratings!.find((r) => r.variant === 'v1-plain')!.score).toBeUndefined();
  });

  test('rejects out-of-range score + unknown variant + empty + no-signal', () => {
    expect(() => buildRatedRecord({ batch: batch(), ratings: [{ variant: 'v0-baseline', score: 6 }] })).toThrow(/1-5/);
    expect(() => buildRatedRecord({ batch: batch(), ratings: [{ variant: 'ghost', score: 3 }] })).toThrow(/not in batch/);
    expect(() => buildRatedRecord({ batch: batch(), ratings: [] })).toThrow(/empty/);
    expect(() => buildRatedRecord({ batch: batch(), ratings: [{ variant: 'v0-baseline' }] })).toThrow(/neither a score nor a why/);
  });

  test('active case classifies state="active"', () => {
    const active = buildSnapshot({ zone: 'owsley-lab', totalEvents: 352, activeWallets: 15, deltaPct: -13 });
    const b = renderBatch(active, VOICE, resolveVariants({ fireN: 1 }), 'b');
    expect(buildRatedRecord({ batch: b, ratings: [{ variant: 'v0-baseline', score: 3 }] }).state).toBe('active');
  });
});
