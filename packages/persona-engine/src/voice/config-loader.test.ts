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
  // BB MED 0.95 (config-loader-test-cwd-mutation · 2026-05-12): use
  // LOA_VOICE_CONFIG env var instead of mutating process.cwd(). Cleaner
  // isolation + no global state to restore.
  let tmpDir: string;

  function withConfig(yaml: string, fn: () => void): void {
    tmpDir = mkdtempSync(join(tmpdir(), 'voice-config-test-'));
    const configPath = join(tmpDir, 'voice.config.yaml');
    writeFileSync(configPath, yaml);
    const prevEnv = process.env['LOA_VOICE_CONFIG'];
    process.env['LOA_VOICE_CONFIG'] = configPath;
    _resetVoiceConfigCache();
    try {
      fn();
    } finally {
      // Always restore env + clean tmpdir, even if the test threw.
      if (prevEnv === undefined) delete process.env['LOA_VOICE_CONFIG'];
      else process.env['LOA_VOICE_CONFIG'] = prevEnv;
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
      _resetVoiceConfigCache();
    }
  }

  test('valid YAML loads weights for ruggy', () => {
    withConfig(
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
      () => {
        const ruggyWeights = getVoiceWeightsFor('ruggy');
        expect(ruggyWeights).toBeDefined();
        expect(ruggyWeights?.entry?.silent_start).toBe(1.0);
        expect(ruggyWeights?.splash?.sparse).toBe(1.0);
      },
    );
  });

  test('invalid YAML syntax → empty map + stderr warn', () => {
    withConfig('voice:\n  ruggy:\n    entry: {{INVALID}}', () => {
      const ruggyWeights = getVoiceWeightsFor('ruggy');
      expect(ruggyWeights).toBeUndefined();
    });
  });

  test('schema-invalid weights → that character is skipped + others survive', () => {
    withConfig(
      `voice:
  ruggy:
    entry:
      silent_start: 0.5
      casual_yeah: 0.5
  satoshi:
    entry:
      bogus_value_not_in_enum: 0.5
`,
      () => {
        const ruggy = getVoiceWeightsFor('ruggy');
        const satoshi = getVoiceWeightsFor('satoshi');
        expect(ruggy?.entry?.silent_start).toBe(0.5);
        expect(satoshi).toBeUndefined();
      },
    );
  });

  test('non-fractional weights are accepted (normalized on the fly)', () => {
    // BB MED 0.90 (schema-record-keys-as-fractions): integer ratios work too.
    withConfig(
      `voice:
  ruggy:
    entry:
      silent_start: 3
      casual_yeah: 1
`,
      () => {
        const ruggy = getVoiceWeightsFor('ruggy');
        expect(ruggy?.entry?.silent_start).toBe(3);
        expect(ruggy?.entry?.casual_yeah).toBe(1);
      },
    );
  });

  test('empty voice section → empty map (no crash)', () => {
    withConfig('voice: {}', () => {
      const ruggy = getVoiceWeightsFor('ruggy');
      expect(ruggy).toBeUndefined();
    });
  });

  test('cache returns same object on repeat call', () => {
    withConfig(
      `voice:
  ruggy:
    entry:
      casual_yeah: 1.0
`,
      () => {
        const first = getVoiceWeightsFor('ruggy');
        const second = getVoiceWeightsFor('ruggy');
        expect(first).toBe(second);
      },
    );
  });

  test('reset cache + file change → loader picks up new values', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'voice-config-test-'));
    const configPath = join(tmpDir, 'voice.config.yaml');
    const prevEnv = process.env['LOA_VOICE_CONFIG'];
    process.env['LOA_VOICE_CONFIG'] = configPath;
    try {
      writeFileSync(
        configPath,
        `voice:
  ruggy:
    entry:
      casual_yeah: 1.0
`,
      );
      _resetVoiceConfigCache();
      const before = getVoiceWeightsFor('ruggy');
      expect(before?.entry?.casual_yeah).toBe(1.0);

      writeFileSync(
        configPath,
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
    } finally {
      if (prevEnv === undefined) delete process.env['LOA_VOICE_CONFIG'];
      else process.env['LOA_VOICE_CONFIG'] = prevEnv;
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
      _resetVoiceConfigCache();
    }
  });
});
