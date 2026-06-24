/**
 * Tests for observability/trace-envelope.ts (cycle-007 S2/T2.2).
 *
 * Coverage matrix:
 * - wrapTraceEntry shape + envelope-wins-on-conflict (top-level attacker key squashed)
 * - sanitizeNestedReservedKeys rewrites nested layer/layer_op/emitted_at → payload_*
 * - sanitizeNestedReservedKeys recursion depth bound (MAX_SANITIZE_DEPTH=32)
 * - isTraceEnvelope predicate (legacy-row tolerance · IMP-012)
 * - appendTraceEntry compile-time type enforcement (BB HIGH-4) via @ts-expect-error
 * - appendTraceEntry mutex serializes concurrent writes (Flatline SKP-003 atomic line append)
 * - Red Team AC-RT-005 (ATK-009): nested-layer-spoof survives top-level wrap but is sanitized
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  TRACE_LAYERS,
  type TraceLayer,
  type TraceEnvelope,
  wrapTraceEntry,
  isTraceEnvelope,
  appendTraceEntry,
} from './trace-envelope.ts';

// ──────────────────────────────────────────────────────────────────────
// TRACE_LAYERS · frozen 5-value enum
// ──────────────────────────────────────────────────────────────────────

describe('TRACE_LAYERS', () => {
  test('contains exactly 5 layers', () => {
    expect(TRACE_LAYERS.length).toBe(5);
    expect(TRACE_LAYERS).toEqual([
      'substrate',
      'voice',
      'presentation',
      'medium-render',
      'orchestrator',
    ]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// wrapTraceEntry · envelope-wins-on-conflict
// ──────────────────────────────────────────────────────────────────────

describe('wrapTraceEntry', () => {
  test('returns payload + envelope fields', () => {
    const result = wrapTraceEntry('substrate', 'score-fetch', { zone: 'el-dorado', count: 3 });
    expect(result.zone).toBe('el-dorado');
    expect(result.count).toBe(3);
    expect(result.layer).toBe('substrate');
    expect(result.layer_op).toBe('score-fetch');
    expect(typeof result.emitted_at).toBe('string');
  });

  test('emitted_at is valid ISO 8601', () => {
    const result = wrapTraceEntry('voice', 'bedrock-converse', {});
    const parsed = new Date(result.emitted_at);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(result.emitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('envelope WINS on top-level conflict (attacker-controlled layer field squashed)', () => {
    const attackerPayload = { layer: 'admin', layer_op: 'pwn', emitted_at: '1970-01-01' };
    const result = wrapTraceEntry('voice', 'memory-write', attackerPayload as any);
    expect(result.layer).toBe('voice'); // envelope wins, not 'admin'
    expect(result.layer_op).toBe('memory-write'); // envelope wins, not 'pwn'
    expect(result.emitted_at).not.toBe('1970-01-01'); // envelope wins
  });
});

// ──────────────────────────────────────────────────────────────────────
// sanitizeNestedReservedKeys · Red Team AC-RT-005 · INV-15
// ──────────────────────────────────────────────────────────────────────

describe('sanitizeNestedReservedKeys (via wrapTraceEntry)', () => {
  test('nested layer field renamed to payload_layer (ATK-009 spoof rewritten)', () => {
    const result = wrapTraceEntry('voice', 'test', { metadata: { layer: 'orchestrator' } });
    expect(result.layer).toBe('voice'); // top-level: envelope wins
    expect((result as any).metadata.layer).toBeUndefined(); // nested: sanitized
    expect((result as any).metadata.payload_layer).toBe('orchestrator');
  });

  test('all 3 reserved keys nested → payload_* prefix', () => {
    const result = wrapTraceEntry('substrate', 'test', {
      meta: { layer: 'a', layer_op: 'b', emitted_at: 'c' },
    });
    expect((result as any).meta.payload_layer).toBe('a');
    expect((result as any).meta.payload_layer_op).toBe('b');
    expect((result as any).meta.payload_emitted_at).toBe('c');
  });

  test('deeply nested reserved keys (2+ levels) all sanitized', () => {
    const result = wrapTraceEntry('substrate', 'test', {
      a: { b: { c: { layer: 'deep' } } },
    });
    expect((result as any).a.b.c.payload_layer).toBe('deep');
    expect((result as any).a.b.c.layer).toBeUndefined();
  });

  test('arrays of objects sanitized recursively', () => {
    const result = wrapTraceEntry('substrate', 'test', {
      items: [{ layer: 'one' }, { layer: 'two' }],
    });
    expect((result as any).items[0].payload_layer).toBe('one');
    expect((result as any).items[1].payload_layer).toBe('two');
  });

  test('recursion depth bound (MAX=32 · pathological nesting does not stack-overflow)', () => {
    // Build a 100-deep nested object · should not throw despite exceeding MAX
    let nested: any = { layer: 'bottom' };
    for (let i = 0; i < 100; i++) nested = { wrap: nested };
    expect(() => wrapTraceEntry('substrate', 'test', { deep: nested })).not.toThrow();
  });

  test('non-reserved nested keys passed through unchanged', () => {
    const result = wrapTraceEntry('substrate', 'test', {
      data: { zone: 'el-dorado', count: 42 },
    });
    expect((result as any).data.zone).toBe('el-dorado');
    expect((result as any).data.count).toBe(42);
  });
});

// ──────────────────────────────────────────────────────────────────────
// isTraceEnvelope · IMP-012 reader-tolerance
// ──────────────────────────────────────────────────────────────────────

describe('isTraceEnvelope', () => {
  test('returns true for wrapped entries', () => {
    const wrapped = wrapTraceEntry('voice', 'test', {});
    expect(isTraceEnvelope(wrapped)).toBe(true);
  });

  test('returns false for pre-cycle-007 legacy rows (absent layer)', () => {
    expect(isTraceEnvelope({ zone: 'el-dorado', count: 3 })).toBe(false);
  });

  test('returns false for malformed envelope (bad layer value)', () => {
    expect(isTraceEnvelope({ layer: 'invalid-layer', layer_op: 'x', emitted_at: 'x' })).toBe(false);
  });

  test('returns false for null / non-object', () => {
    expect(isTraceEnvelope(null)).toBe(false);
    expect(isTraceEnvelope('string')).toBe(false);
    expect(isTraceEnvelope(42)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// appendTraceEntry · INV-14 type-enforcement + SKP-003 mutex
// ──────────────────────────────────────────────────────────────────────

describe('appendTraceEntry', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'trace-envelope-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes a single JSONL line to the target file', async () => {
    const filePath = join(tmpDir, 'test.jsonl');
    const entry = wrapTraceEntry('voice', 'memory-write', { stream: 'digest', key: 'k1' });
    await appendTraceEntry(filePath, entry);

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.layer).toBe('voice');
    expect(parsed.stream).toBe('digest');
  });

  test('creates parent directories as needed', async () => {
    const filePath = join(tmpDir, 'a/b/c/nested.jsonl');
    const entry = wrapTraceEntry('substrate', 'test', {});
    await appendTraceEntry(filePath, entry);
    expect(existsSync(filePath)).toBe(true);
  });

  test('mutex serializes concurrent writes (SKP-003 atomic line append)', async () => {
    const filePath = join(tmpDir, 'concurrent.jsonl');
    // Fire 50 concurrent writes · all should land as complete lines · no interleaving
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      writes.push(
        appendTraceEntry(filePath, wrapTraceEntry('substrate', 'concurrent-test', { i, x: 'a'.repeat(200) })),
      );
    }
    await Promise.all(writes);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    expect(lines.length).toBe(50);
    // Every line should be parseable JSON · proves no byte interleaving
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test('compile-time type enforcement (BB HIGH-4 · @ts-expect-error verified at typecheck)', () => {
    // The following expression SHOULD fail at typecheck because the payload is not envelope-wrapped.
    // We never invoke at runtime — verifying the type-fn signature ALONE is the assertion.
    // The @ts-expect-error directive is the load-bearing check (compile-time · not runtime).
    type _Check = typeof appendTraceEntry;
    // @ts-expect-error · plain payload missing TraceEnvelope intersection
    const _typed: (path: string, entry: { zone: string }) => Promise<void> = appendTraceEntry;
    void _typed; // suppress unused-var · the @ts-expect-error on assignment is what we're testing
    expect(true).toBe(true); // sentinel · the real check happened at typecheck above
  });
});
