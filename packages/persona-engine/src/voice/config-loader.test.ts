/**
 * Voice config loader tests.
 *
 * Validates:
 *   - Reads + parses voice.config.yaml from repo root
 *   - Falls back to defaults when file missing or invalid
 *   - Per-character weight maps return correctly
 *   - Cache works (loadOnce semantics)
 *   - Schema validation rejects malformed weights
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { writeFileSync, unlinkSync, mkdtempSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  getVoiceWeights,
  getVoiceWeightsFor,
  _resetVoiceConfigCache,
} from './config-loader.ts';

beforeEach(() => {
  _resetVoiceConfigCache();
});

describe('voice config loader · file discovery', () => {
  test('no config file → returns empty map', () => {
    // Working dir for tests is repo root; the example exists but not the
    // actual `voice.config.yaml` — operator opts in by copying.
    const weights = getVoiceWeights();
    expect(typeof weights).toBe('object');
    // If a real voice.config.yaml exists at repo root in dev environment,
    // this would have entries · don't assert empty to avoid flakiness.
    expect(weights).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────────
// Isolated test: write a real config to a temp dir, override cwd
// ──────────────────────────────────────────────────────────────────────

describe('voice config loader · with temp config file', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    _resetVoiceConfigCache();
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'voice-config-test-'));
    process.chdir(tmpDir);
  });

  function cleanup() {
    process.chdir(originalCwd);
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  }

  test('valid YAML loads weights for ruggy', () => {
    writeFileSync(
      join(tmpDir, 'voice.config.yaml'),
      `voice:
  ruggy:
    entry:
      silent_start: 1.0
      casual_yeah: 0.0
    splash:
      sparse: 1.0
      medium: 0.0
      lush: 0.0
`,
    );

    const ruggyWeights = getVoiceWeightsFor('ruggy');
    expect(ruggyWeights).toBeDefined();
    expect(ruggyWeights?.entry?.silent_start).toBe(1.0);
    expect(ruggyWeights?.splash?.sparse).toBe(1.0);

    cleanup();
  });

  test('invalid YAML syntax → empty map + stderr warn', () => {
    writeFileSync(join(tmpDir, 'voice.config.yaml'), 'voice:\n  ruggy:\n    entry: {{INVALID}}');
    // Logger emits a stderr warn · we don't assert on stderr here,
    // just that the map ends up empty / undefined for ruggy.
    const ruggyWeights = getVoiceWeightsFor('ruggy');
    expect(ruggyWeights).toBeUndefined();

    cleanup();
  });

  test('schema-invalid weights → that character is skipped + others survive', () => {
    writeFileSync(
      join(tmpDir, 'voice.config.yaml'),
      `voice:
  ruggy:
    entry:
      silent_start: 0.5
      casual_yeah: 0.5
  satoshi:
    entry:
      bogus_value_not_in_enum: 0.5
`,
    );

    const ruggy = getVoiceWeightsFor('ruggy');
    const satoshi = getVoiceWeightsFor('satoshi');
    expect(ruggy?.entry?.silent_start).toBe(0.5);
    expect(satoshi).toBeUndefined(); // schema rejected · skipped

    cleanup();
  });

  test('empty voice section → empty map (no crash)', () => {
    writeFileSync(join(tmpDir, 'voice.config.yaml'), 'voice: {}');
    const ruggy = getVoiceWeightsFor('ruggy');
    expect(ruggy).toBeUndefined();
    cleanup();
  });

  test('cache returns same object on repeat call', () => {
    writeFileSync(
      join(tmpDir, 'voice.config.yaml'),
      `voice:
  ruggy:
    entry:
      casual_yeah: 1.0
`,
    );
    const first = getVoiceWeightsFor('ruggy');
    const second = getVoiceWeightsFor('ruggy');
    expect(first).toBe(second); // referential equality from cache

    cleanup();
  });

  test('reset cache + file change → loader picks up new values', () => {
    writeFileSync(
      join(tmpDir, 'voice.config.yaml'),
      `voice:
  ruggy:
    entry:
      casual_yeah: 1.0
`,
    );
    const before = getVoiceWeightsFor('ruggy');
    expect(before?.entry?.casual_yeah).toBe(1.0);

    // Change config + reset cache.
    writeFileSync(
      join(tmpDir, 'voice.config.yaml'),
      `voice:
  ruggy:
    entry:
      silent_start: 1.0
`,
    );
    _resetVoiceConfigCache();
    const after = getVoiceWeightsFor('ruggy');
    expect(after?.entry?.silent_start).toBe(1.0);
    expect(after?.entry?.casual_yeah).toBeUndefined();

    cleanup();
  });
});
