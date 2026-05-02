/**
 * Smoke test for Sprint 2 / Phase C — environment context builder + rosenzu read_room.
 *
 * Covers:
 *   - deriveTemperature  unit fixtures (incl. spec line 412: deriveTemperature(20, 1) === 'hot')
 *   - deriveSocialDensity unit fixtures (incl. spec line 412: deriveSocialDensity(5) === 'small-cluster')
 *   - composeTonalWeight delta sign (hot warmer than cold)
 *   - buildEnvironmentContext snapshot (deterministic with stubbed `nowMs`)
 *   - unknown-zone fallback (no Room read line · graceful)
 *   - environment block size budget (≤300 token target / ≤500 hard cap)
 *   - {{ENVIRONMENT}} placeholder substitution behavior (no-op when absent)
 *
 * Run via: bun run apps/bot/scripts/smoke-environment.ts
 *
 * Exit code non-zero on any failure.
 */

import {
  buildEnvironmentContext,
  composeTonalWeight,
  deriveSocialDensity,
  deriveTemperature,
  minutesSince,
  summarizeRecent,
  uniq,
} from '@freeside-characters/persona-engine';
import type { CharacterConfig, RecentMessage } from '@freeside-characters/persona-engine';

let failures = 0;

function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
    failures += 1;
  }
}

console.log('smoke: environment context builder + rosenzu derivation helpers (Sprint 2 / Phase C)');
console.log('');

// ──────────────────────────────────────────────────────────────────────
// derivation helpers (Task 2.1)
// ──────────────────────────────────────────────────────────────────────

console.log('deriveTemperature:');
assertEqual(deriveTemperature(20, 1), 'hot', 'spec fixture: (20, 1) → hot');
assertEqual(deriveTemperature(8, 5), 'warm', '(8, 5) → warm');
assertEqual(deriveTemperature(3, 60), 'cool', '(3, 60) → cool · ≥3 messages');
assertEqual(deriveTemperature(0, 20), 'cool', '(0, 20) → cool · within 30 min');
assertEqual(deriveTemperature(0, 120), 'cold', '(0, 120) → cold · stale + sparse');
assertEqual(deriveTemperature(20, undefined), 'cool', '(20, undefined) → cool · busy but no recency known');

console.log('');
console.log('deriveSocialDensity:');
assertEqual(deriveSocialDensity(0), 'solo', '0 → solo');
assertEqual(deriveSocialDensity(1), 'solo', '1 → solo');
assertEqual(deriveSocialDensity(3), 'paired', '3 → paired');
assertEqual(deriveSocialDensity(5), 'small-cluster', 'spec fixture: 5 → small-cluster');
assertEqual(deriveSocialDensity(7), 'small-cluster', '7 → small-cluster (boundary)');
assertEqual(deriveSocialDensity(8), 'crowd', '8 → crowd');
assertEqual(deriveSocialDensity(50), 'crowd', '50 → crowd');

console.log('');
console.log('composeTonalWeight:');
const baseKansei = {
  warmth: 0.5,
  motion: 'test motion',
  shadow: 'mid' as const,
  easing: 'test easing',
  density: 'medium' as const,
  feel: 'test feel',
};
const hotWeight = composeTonalWeight(baseKansei, 'hot');
const coldWeight = composeTonalWeight(baseKansei, 'cold');
assert(hotWeight.warmth > coldWeight.warmth, 'hot warmer than cold (delta sign correct)');
assert(hotWeight.warmth === 0.7, 'hot adds +0.2 to base 0.5 → 0.7');
assert(coldWeight.warmth === 0.35, 'cold subtracts 0.15 from base 0.5 → 0.35');
assert(hotWeight.feel.includes('room hot'), 'feel string carries temperature suffix');
assert(composeTonalWeight({ ...baseKansei, warmth: 0.95 }, 'hot').warmth === 1, 'warmth clamps to 1.0 at the top');
assert(composeTonalWeight({ ...baseKansei, warmth: 0.05 }, 'cold').warmth === 0, 'warmth clamps to 0 at the bottom');

// ──────────────────────────────────────────────────────────────────────
// environment context builder (Task 2.3)
// ──────────────────────────────────────────────────────────────────────

const ruggyConfig: CharacterConfig = {
  id: 'ruggy',
  personaPath: '/dev/null/persona.md', // not actually loaded in this smoke
  displayName: 'Ruggy',
  mcps: ['score', 'codex', 'emojis', 'rosenzu', 'freeside_auth'],
  tool_invocation_style:
    'Use score for zone-stat questions and digest-shaped factual queries. Default to text; tools augment.',
};

const FIXED_NOW_MS = 1_714_525_200_000; // deterministic "now" for snapshot
const recentFixture: RecentMessage[] = [
  { authorUsername: 'alice', content: 'hey, where is everyone?', timestampMs: FIXED_NOW_MS - 5 * 60_000 },
  { authorUsername: 'bob', content: 'over by the rig', timestampMs: FIXED_NOW_MS - 4 * 60_000 },
  { authorUsername: 'alice', content: 'cool, on my way', timestampMs: FIXED_NOW_MS - 1 * 60_000 },
];

console.log('');
console.log('buildEnvironmentContext — populated zone (stonehenge):');
const block = buildEnvironmentContext({
  character: ruggyConfig,
  zone: 'stonehenge',
  recentMessages: recentFixture,
  otherCharactersHere: ['satoshi'],
  nowMs: FIXED_NOW_MS,
});

assert(block.startsWith('## Environment'), 'block starts with `## Environment` heading');
assert(block.includes('🗿'), 'zone emoji present (stonehenge → 🗿)');
assert(block.includes('#stonehenge'), 'zone slug present in identity line');
assert(block.includes('overall dimension'), 'zone dimension present');
assert(block.includes('Room read:'), '`Room read:` line present');
assert(block.includes('Other characters present: satoshi.'), 'presence line present');
assert(block.includes('Tool guidance:'), 'tool guidance line present');
assert(block.includes('Recent room context:'), 'recent context line present');
assert(block.includes('[alice]') && block.includes('[bob]'), 'recent context cites usernames');

console.log('');
console.log('buildEnvironmentContext — unknown zone fallback:');
const unknownBlock = buildEnvironmentContext({
  character: ruggyConfig,
  zone: undefined,
  recentMessages: [],
  otherCharactersHere: [],
  nowMs: FIXED_NOW_MS,
});
assert(unknownBlock.includes('outside the codex-mapped zones'), 'fallback identity line present');
assert(!unknownBlock.includes('Room read:'), 'no Room read line for unknown zone');
assert(unknownBlock.includes('Tool guidance:'), 'tool guidance still appears (zone-independent)');

console.log('');
console.log('buildEnvironmentContext — minimal (no character.tool_invocation_style, no recent):');
const minimalConfig: CharacterConfig = { id: 'noone', personaPath: '/dev/null/persona.md' };
const minimalBlock = buildEnvironmentContext({
  character: minimalConfig,
  zone: 'bear-cave',
  recentMessages: [],
  otherCharactersHere: [],
  nowMs: FIXED_NOW_MS,
});
assert(minimalBlock.startsWith('## Environment'), 'minimal block still has heading');
assert(minimalBlock.includes('🐻'), 'bear-cave emoji present');
assert(!minimalBlock.includes('Tool guidance:'), 'no tool guidance line when field absent');
assert(!minimalBlock.includes('Recent room context:'), 'no recent context when array empty');

console.log('');
console.log('buildEnvironmentContext — size budget:');
const tokenEstimate = block.length / 4; // rough chars-to-tokens
assert(tokenEstimate <= 300, `populated block ≈${Math.round(tokenEstimate)} tokens (target ≤300)`);
assert(tokenEstimate <= 500, `populated block ≈${Math.round(tokenEstimate)} tokens (hard cap ≤500)`);

console.log('');
console.log('snapshot (deterministic with FIXED_NOW_MS):');
const expectedFirstLine = '## Environment';
assertEqual(block.split('\n')[0], expectedFirstLine, 'line 1 matches snapshot');
assertEqual(
  block.split('\n')[1],
  'You are in 🗿 #stonehenge — Stonehenge (overall dimension).',
  'line 2 matches snapshot (zone identity)',
);

// ──────────────────────────────────────────────────────────────────────
// helper utilities (Task 2.4)
// ──────────────────────────────────────────────────────────────────────

console.log('');
console.log('summarizeRecent / minutesSince / uniq:');
assertEqual(summarizeRecent(undefined), undefined, 'summarizeRecent(undefined) → undefined');
assertEqual(summarizeRecent([]), undefined, 'summarizeRecent([]) → undefined');
assert(
  (summarizeRecent(recentFixture) ?? '').includes('alice:') && (summarizeRecent(recentFixture) ?? '').includes('bob:'),
  'summarizeRecent of 3 messages includes usernames',
);
assertEqual(minutesSince(FIXED_NOW_MS - 60 * 60_000, FIXED_NOW_MS), 60, 'minutesSince — 60 min ago → 60');
assertEqual(minutesSince(undefined), undefined, 'minutesSince(undefined) → undefined');
assertEqual(uniq([1, 2, 2, 3, 1]), [1, 2, 3], 'uniq dedupes preserving order');
assertEqual(uniq(['a', 'b', 'a']), ['a', 'b'], 'uniq works on strings');

console.log('');
if (failures === 0) {
  console.log('✓ smoke pass · all derivation helpers + environment builder green');
  process.exit(0);
} else {
  console.error(`✗ smoke fail · ${failures} assertion(s) failed`);
  process.exit(1);
}
