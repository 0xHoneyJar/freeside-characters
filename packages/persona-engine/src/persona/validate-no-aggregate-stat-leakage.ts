/**
 * cycle-008 T2.4 · NFR-9 aggregate-stat-leakage runtime guard.
 *
 * Per sprint plan §4 T2.4 (Phase 4 HITL FINAL · supersedes log-only V1).
 * Ships FAIL-LOUD with three guardrails:
 *   (a) factor-name allowlist bypass (fixtures/factor-name-allowlist.json)
 *   (b) production-restricted warn-mode escape hatch (LOA_STAT_LEAKAGE_GUARD=warn)
 *   (c) tightened regex patterns (require explicit number context)
 *
 * On non-allowlisted, non-warn-mode detection:
 *   Effect.fail(new BuildPromptError({kind: 'aggregate-stat-leakage', ...}))
 *
 * Warn-mode in production: process exits with code 78 + stderr FATAL message.
 * Warn-mode in dev/CI/test: downgrades fail-loud to log-only (stderr) with WARN message.
 */

import { Effect } from 'effect';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { BuildPromptError } from './build-prompt-error.ts';
import type { ActiveFactorRender } from './render-active-factors.ts';

const ALLOWLIST_PATH = resolve(
  dirname(import.meta.url.replace('file://', '')),
  'fixtures/factor-name-allowlist.json',
);

interface AllowlistFile {
  readonly _meta: { readonly schema_version: number };
  readonly allowlisted_names: ReadonlyArray<string>;
}

let allowlistCache: Set<string> | null = null;

function loadAllowlist(): Set<string> {
  if (allowlistCache !== null) return allowlistCache;
  if (!existsSync(ALLOWLIST_PATH)) {
    allowlistCache = new Set();
    return allowlistCache;
  }
  const raw = readFileSync(ALLOWLIST_PATH, 'utf8');
  const parsed: AllowlistFile = JSON.parse(raw);
  allowlistCache = new Set(parsed.allowlisted_names);
  return allowlistCache;
}

/** Tightened patterns · all require explicit number context per Phase 4 HITL */
const STAT_LEAKAGE_PATTERNS: ReadonlyArray<{ regex: RegExp; label: string }> = [
  // Integer ≥10 followed by aggregate unit
  { regex: /\b\d{2,}\s+(events?|factors?|miberas?|actors?|days?)\b/i, label: 'aggregate-count' },
  // Spelled-out number followed by aggregate unit
  {
    regex:
      /\b(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\s+(events?|factors?|miberas?|actors?|days?)\b/i,
    label: 'spelled-number',
  },
  // Rank language WITH explicit number (tightened from \brank\b)
  { regex: /\brank[ -]?\d+\b|\bpercentile\b|\btop-?\d+\b/i, label: 'rank-language' },
  // Window phrases WITH explicit number
  {
    regex: /\b\d+\s*-?\s*day\b|\bprior\s+period\b|\bprevious\s+week\b|\bpast\s+\d+\s+days?\b/i,
    label: 'window-language',
  },
  // Threshold phrases WITH explicit number context
  {
    regex: /\bcrossed\s+(rank|the\s+line)\b|\babove\s+rank\s+\d+\b|\bbelow\s+rank\s+\d+\b/i,
    label: 'threshold-language',
  },
];

interface DetectedLeak {
  readonly target: 'activeFactors' | 'priorWeekHint';
  readonly subject: string; // factor name or 'priorWeekHint body'
  readonly patternLabel: string;
  readonly sample: string;
}

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.LOA_ENV === 'production'
  );
}

function detectLeaks(
  activeFactors: ReadonlyArray<ActiveFactorRender>,
  priorWeekHint: string | undefined,
): DetectedLeak[] {
  const allowlist = loadAllowlist();
  const leaks: DetectedLeak[] = [];

  for (const factor of activeFactors) {
    if (allowlist.has(factor.displayName)) continue;
    for (const { regex, label } of STAT_LEAKAGE_PATTERNS) {
      if (regex.test(factor.displayName)) {
        leaks.push({
          target: 'activeFactors',
          subject: factor.displayName,
          patternLabel: label,
          sample: factor.displayName,
        });
        break;
      }
    }
  }

  if (priorWeekHint) {
    // Strip <untrusted-content> wrapper to inspect inner body only
    const inner = priorWeekHint.replace(/<\/?untrusted-content[^>]*>/g, '');
    for (const { regex, label } of STAT_LEAKAGE_PATTERNS) {
      const match = inner.match(regex);
      if (match) {
        leaks.push({
          target: 'priorWeekHint',
          subject: 'priorWeekHint inner body',
          patternLabel: label,
          sample: match[0],
        });
      }
    }
  }

  return leaks;
}

/**
 * Validate that no aggregate-stat-leakage exists in cycle-008 args.
 *
 * Production behavior: fail-loud unless allowlisted.
 * Dev/CI behavior with LOA_STAT_LEAKAGE_GUARD=warn: log-only (stderr).
 * Production with LOA_STAT_LEAKAGE_GUARD=warn: process.exit(78) + FATAL message.
 *
 * Returns Effect that succeeds on no-leakage or warn-mode-downgrade-in-dev.
 * Fails with BuildPromptError on detected non-allowlisted leakage (fail-loud default).
 */
export function validateNoAggregateStatLeakage(
  activeFactors: ReadonlyArray<ActiveFactorRender>,
  priorWeekHint: string | undefined,
): Effect.Effect<void, BuildPromptError, never> {
  return Effect.gen(function* () {
    // Guard against warn-mode in production (FATAL exit · NOT downgrade)
    const guardMode = process.env.LOA_STAT_LEAKAGE_GUARD;
    if (guardMode === 'warn' && isProduction()) {
      process.stderr.write(
        '[NFR-9] FATAL: LOA_STAT_LEAKAGE_GUARD=warn is forbidden in production environments.\n',
      );
      process.exit(78);
    }

    const leaks = detectLeaks(activeFactors, priorWeekHint);
    if (leaks.length === 0) return;

    // Detected leakage · dispatch by mode
    if (guardMode === 'warn') {
      // Dev/CI warn-mode · log to stderr but DO NOT fail
      for (const leak of leaks) {
        process.stderr.write(
          `[NFR-9] WARN: aggregate-stat-leakage detected (${leak.patternLabel}) in ${leak.target}: "${leak.sample}"\n`,
        );
      }
      return;
    }

    // Default · fail-loud
    const firstLeak = leaks[0]!;
    yield* Effect.fail(
      new BuildPromptError({
        kind: 'aggregate-stat-leakage',
        argName: firstLeak.target,
        sample: `${firstLeak.subject} matched ${firstLeak.patternLabel}: "${firstLeak.sample}"`,
      }),
    );
  });
}

// Test-only export · do not use in production paths
export const _testInternals = {
  detectLeaks,
  loadAllowlist,
  STAT_LEAKAGE_PATTERNS,
  isProduction,
} as const;
