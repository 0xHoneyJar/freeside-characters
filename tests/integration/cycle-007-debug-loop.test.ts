/**
 * cycle-007 E2E debug loop · S8/T8.2 mechanical half (PRD §FR-7 · G-7).
 *
 * Validates the agent-paste-to-Loa primitive at the mechanical layer: given a
 * trace row (envelope-tagged OR legacy), `explainRow` returns the correct
 * `identified_layer` + `identified_op` + (for legacy rows) `likely_source`
 * file:line range.
 *
 * 5 envelope-tagged fixtures span all 5 TraceLayers ('substrate' · 'voice' ·
 * 'presentation' · 'medium-render' · 'orchestrator'). 3 legacy-row fixtures
 * exercise the shape-inference fallback (IMP-012 reader-tolerance · pre-cycle-007
 * row support).
 *
 * The HARD half of FR-7 (operator pastes a real row to Loa chat · confirms
 * 1-step layer identification) is PP-4 · gated separately at S8 close.
 */

import { describe, expect, test } from 'bun:test';
import { explainRow } from '../../scripts/lib/trace-readers.ts';
import { wrapTraceEntry } from '../../packages/persona-engine/src/observability/trace-envelope.ts';

describe('cycle-007 FR-7 · paste-to-Loa mechanical proof · all 5 layers', () => {
  test('envelope row · layer=substrate · score-snapshot-rejection', () => {
    const row = wrapTraceEntry('substrate', 'snapshot-rejection', {
      run_id: 'run-substrate-001',
      zone: 'el-dorado',
      rejected_at: '2026-05-17T20:00:00Z',
      reason: 'percentile-rank deviates >3σ from 30d baseline',
    });
    const out = explainRow(JSON.stringify(row));
    expect(out.schema_version).toBe('1');
    expect(out.identified_layer).toBe('substrate');
    expect(out.identified_op).toBe('snapshot-rejection');
    expect(out.warnings).toEqual([]);
  });

  test('envelope row · layer=voice · bedrock-converse', () => {
    const row = wrapTraceEntry('voice', 'bedrock-converse', {
      run_id: 'run-voice-001',
      zone: 'bear-cave',
      system_prompt: 'you are ruggy · the festival NPC narrator',
      output: 'the bears are restless this week · 1247 events across el dorado',
      duration_ms: 2143,
    });
    const out = explainRow(JSON.stringify(row));
    expect(out.identified_layer).toBe('voice');
    expect(out.identified_op).toBe('bedrock-converse');
    expect(out.warnings).toEqual([]);
  });

  test('envelope row · layer=presentation · sanitize-violation', () => {
    const row = wrapTraceEntry('presentation', 'sanitize-violation', {
      run_id: 'run-presentation-001',
      zone: 'el-dorado',
      violations: ['kebab-zone-leak'],
      sample: 'el-dorado bears woke up early',
    });
    const out = explainRow(JSON.stringify(row));
    expect(out.identified_layer).toBe('presentation');
    expect(out.identified_op).toBe('sanitize-violation');
  });

  test('envelope row · layer=medium-render · discord-webhook-post', () => {
    const row = wrapTraceEntry('medium-render', 'discord-webhook-post', {
      run_id: 'run-medium-001',
      zone: 'lockstep-valley',
      webhook_id: 'wh-test',
      payload_bytes: 1843,
      status: 200,
    });
    const out = explainRow(JSON.stringify(row));
    expect(out.identified_layer).toBe('medium-render');
    expect(out.identified_op).toBe('discord-webhook-post');
  });

  test('envelope row · layer=orchestrator · digest-compose', () => {
    const row = wrapTraceEntry('orchestrator', 'digest-compose', {
      run_id: 'run-orchestrator-001',
      zone: 'el-dorado',
      stages: ['inspectProse', 'selectLayoutShape', 'buildPulseDimensionPayload'],
      ok: true,
    });
    const out = explainRow(JSON.stringify(row));
    expect(out.identified_layer).toBe('orchestrator');
    expect(out.identified_op).toBe('digest-compose');
  });
});

describe('cycle-007 FR-7 · legacy-row shape inference (pre-envelope · IMP-012 tolerance)', () => {
  test('legacy llm-trace row · shape-inferred → voice + likely_source llm-trace.ts', () => {
    const legacy = {
      run_id: 'legacy-voice-001',
      system_prompt: 'pre-cycle-007 voice prompt',
      output: 'pre-cycle-007 output',
      duration_ms: 3000,
    };
    const out = explainRow(JSON.stringify(legacy));
    expect(out.identified_layer).toBe('voice');
    expect(out.identified_op).toBe('bedrock-converse');
    expect(out.likely_source?.file).toBe(
      'packages/persona-engine/src/observability/llm-trace.ts',
    );
    expect(out.warnings[0]).toMatch(/row-predates-envelope/);
  });

  test('legacy score-snapshot-rejection · shape-inferred → substrate', () => {
    const legacy = {
      rejected_at: '2026-05-01T00:00:00Z',
      reason: 'pre-cycle-007 rejection',
    };
    const out = explainRow(JSON.stringify(legacy));
    expect(out.identified_layer).toBe('substrate');
    expect(out.identified_op).toBe('snapshot-rejection');
    expect(out.likely_source?.file).toBe(
      'packages/persona-engine/src/live/score-snapshot-rejections.ts',
    );
  });

  test('legacy unmatched-shape · falls back to unknown · operator-grep recommended', () => {
    const opaque = { unknown_shape: true, blob: 'something' };
    const out = explainRow(JSON.stringify(opaque));
    expect(out.identified_layer).toBe('unknown');
    expect(out.identified_op).toBeNull();
    expect(out.likely_source).toBeNull();
    expect(out.warnings.some((w) => w.includes('no-shape-hint-matched'))).toBe(true);
  });
});

describe('cycle-007 FR-7 · INV-13 schema_version pin (BB HIGH-5)', () => {
  test('every explainRow output carries schema_version:"1"', () => {
    const envelope = wrapTraceEntry('voice', 'bedrock-converse', { ok: true });
    const legacy = { rejected_at: '2026-05-01', reason: 'test' };
    const opaque = { blob: true };
    const broken = '{not-json';

    for (const input of [
      JSON.stringify(envelope),
      JSON.stringify(legacy),
      JSON.stringify(opaque),
      broken,
    ]) {
      expect(explainRow(input).schema_version).toBe('1');
    }
  });
});
