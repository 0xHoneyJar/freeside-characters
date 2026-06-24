/**
 * Tests for scripts/trace.ts CLI (cycle-007 S4/T4.4).
 *
 * Coverage:
 * - sanitizeForTerminal strips ANSI escapes + OSC 8 → plain `[url]` (AC-RT-003)
 * - trace-readers: rowFromLine envelope vs legacy detection
 * - explainRow correct identified_layer for envelope rows (passthrough)
 * - explainRow correct shape-inference for legacy rows (heuristic match)
 * - explainRow output validates against INV-13 schema (BB HIGH-5)
 *
 * Note: integration-level tests (spawning trace.ts as subprocess and verifying
 * exit codes for stdin overflow · positional-arg reject · etc.) live in
 * scripts/trace-cli.integration.test.ts as a follow-up. This file covers the
 * lib-layer + safe-render contracts which are the load-bearing pieces.
 */

import { describe, expect, test } from 'bun:test';
import { sanitizeForTerminal, sanitizeForBrowser } from './lib/safe-render.ts';
import { explainRow, type ExplainedRow } from './lib/trace-readers.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ──────────────────────────────────────────────────────────────────────
// sanitizeForTerminal · AC-RT-003 · CVE-2003-0063 terminal escape injection
// ──────────────────────────────────────────────────────────────────────

describe('sanitizeForTerminal · AC-RT-003 terminal escape defense', () => {
  test('strips OSC 0 title-bar hijack', () => {
    const attack = '\x1b]0;rm -rf $HOME\x07normal text';
    const safe = sanitizeForTerminal(attack);
    expect(safe).toBe('normal text');
    expect(safe.includes('\x1b')).toBe(false);
  });

  test('strips CSI screen-clear + cursor-home', () => {
    const attack = '\x1b[2J\x1b[Hclear-screen attempt';
    const safe = sanitizeForTerminal(attack);
    expect(safe).toBe('clear-screen attempt');
  });

  test('strips C0 control bytes (BEL · BS) · preserves TAB · LF · CR (legitimate text)', () => {
    // BEL (0x07) + BS (0x08) stripped · CR (0x0D) preserved (line-break · not hostile)
    const attack = 'a\x07b\x08c';
    expect(sanitizeForTerminal(attack)).toBe('abc');
    // CR + LF + TAB preserved
    expect(sanitizeForTerminal('line1\nline2\r\ncol1\tcol2')).toBe('line1\nline2\r\ncol1\tcol2');
  });

  test('rewrites OSC 8 hyperlink to plain `text [url]` suffix', () => {
    const attack = '\x1b]8;;https://attacker.example/exfil\x07docs.freeside\x1b]8;;\x07';
    const safe = sanitizeForTerminal(attack);
    expect(safe).toContain('docs.freeside');
    expect(safe).toContain('[https://attacker.example/exfil]');
    expect(safe.includes('\x1b')).toBe(false);
  });

  test('preserves plain ASCII + Unicode prose', () => {
    const safe = sanitizeForTerminal('hello El Dorado · 你好 · 1247 events');
    expect(safe).toBe('hello El Dorado · 你好 · 1247 events');
  });

  test('strips C1 control bytes (0x80-0x9F)', () => {
    const attack = 'a\x80b\x9Fc';
    const safe = sanitizeForTerminal(attack);
    expect(safe).toBe('abc');
  });

  test('strips embedded ESC + single-char sequences', () => {
    const attack = 'a\x1b=b\x1bDc';
    const safe = sanitizeForTerminal(attack);
    expect(safe.includes('\x1b')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// sanitizeForBrowser · Phase 6 SKP-001/CRITICAL XSS defense
// ──────────────────────────────────────────────────────────────────────

describe('sanitizeForBrowser · XSS escape', () => {
  test('escapes <script> tag injection', () => {
    expect(sanitizeForBrowser('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes attribute injection (single + double quotes)', () => {
    expect(sanitizeForBrowser(`x"y'z`)).toBe('x&quot;y&#39;z');
  });

  test('escapes ampersand-first (avoids double-escaping)', () => {
    expect(sanitizeForBrowser('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

// ──────────────────────────────────────────────────────────────────────
// explainRow · IMP-012 reader-tolerance + shape-inference
// ──────────────────────────────────────────────────────────────────────

describe('explainRow · envelope passthrough', () => {
  test('envelope row → identified_layer matches envelope.layer', () => {
    const row = JSON.stringify({
      layer: 'voice',
      layer_op: 'bedrock-converse',
      emitted_at: '2026-05-17T12:00:00Z',
      zone: 'el-dorado',
    });
    const e = explainRow(row);
    expect(e.schema_version).toBe('1');
    expect(e.identified_layer).toBe('voice');
    expect(e.identified_op).toBe('bedrock-converse');
    expect(e.warnings).toEqual([]);
  });

  test('envelope row · likely_source null (envelope tags are authoritative)', () => {
    const row = JSON.stringify({
      layer: 'substrate',
      layer_op: 'snapshot-rejection',
      emitted_at: '2026-05-17T12:00:00Z',
      zone: 'bear-cave',
    });
    const e = explainRow(row);
    expect(e.likely_source).toBeNull();
  });
});

describe('explainRow · legacy-row shape-inference (IMP-012 reader-tolerance)', () => {
  test('llm-trace shape (system_prompt + duration_ms + output) → voice/bedrock-converse', () => {
    const row = JSON.stringify({
      at: '2026-05-16T10:00:00Z',
      duration_ms: 2500,
      system_prompt: 'x',
      output: 'y',
    });
    const e = explainRow(row);
    expect(e.identified_layer).toBe('voice');
    expect(e.identified_op).toBe('bedrock-converse');
    expect(e.likely_source?.file).toContain('llm-trace.ts');
    expect(e.warnings.some((w) => w.includes('row-predates-envelope'))).toBe(true);
  });

  test('score-rejection shape (rejected_at + reason) → substrate/snapshot-rejection', () => {
    const row = JSON.stringify({
      zone: 'bear-cave',
      rejected_at: '2026-05-16T10:00:00Z',
      reason: 'event-count-outlier',
    });
    const e = explainRow(row);
    expect(e.identified_layer).toBe('substrate');
    expect(e.identified_op).toBe('snapshot-rejection');
    expect(e.likely_source?.file).toContain('score-snapshot-rejections.ts');
  });

  test('sanitize-violation shape (violations + sample) → presentation/sanitize-violation', () => {
    const row = JSON.stringify({
      violations: ['el-dorado'],
      sample: 'el-dorado wakes',
    });
    const e = explainRow(row);
    expect(e.identified_layer).toBe('presentation');
    expect(e.identified_op).toBe('sanitize-violation');
  });

  test('voice-memory shape (stream + key + user_id) → voice/memory-write', () => {
    const row = JSON.stringify({
      stream: 'digest',
      key: 'k1',
      user_id: 'u1',
    });
    const e = explainRow(row);
    expect(e.identified_layer).toBe('voice');
    expect(e.identified_op).toBe('memory-write');
  });

  test('unknown shape → identified_layer "unknown" + recommendation warning', () => {
    const row = JSON.stringify({ random: 'shape', mystery: true });
    const e = explainRow(row);
    expect(e.identified_layer).toBe('unknown');
    expect(e.identified_op).toBeNull();
    expect(e.likely_source).toBeNull();
    expect(e.warnings.some((w) => w.includes('no-shape-hint-matched'))).toBe(true);
  });

  test('malformed JSON → identified_layer "unknown" + malformed-json warning', () => {
    const e = explainRow('not-json{{');
    expect(e.identified_layer).toBe('unknown');
    expect(e.warnings.some((w) => w.includes('malformed-json'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// BB HIGH-5 · explainRow output validates against INV-13 schema
// ──────────────────────────────────────────────────────────────────────

describe('explainRow · INV-13 schema conformance (BB HIGH-5)', () => {
  test('output shape matches .claude/overrides/trace-explain-output.schema.json', () => {
    const schemaPath = resolve(__dirname, '..', '.claude/overrides/trace-explain-output.schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Lightweight structural check (no ajv dep · validates required fields + types).
    const output: ExplainedRow = explainRow(
      JSON.stringify({ layer: 'voice', layer_op: 'test', emitted_at: 't' }),
    );

    // Required fields present
    for (const required of schema.required) {
      expect(Object.prototype.hasOwnProperty.call(output, required)).toBe(true);
    }

    // schema_version === "1"
    expect(output.schema_version).toBe(schema.properties.schema_version.const);

    // identified_layer in enum
    expect(schema.properties.identified_layer.enum).toContain(output.identified_layer);

    // raw is object
    expect(typeof output.raw).toBe('object');

    // warnings is array of strings
    expect(Array.isArray(output.warnings)).toBe(true);
    for (const w of output.warnings) expect(typeof w).toBe('string');
  });
});
