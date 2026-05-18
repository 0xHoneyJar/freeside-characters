/**
 * cycle-008 T2.0 · pre-S2 baseline capture script
 *
 * Per Flatline-Sprint SKP-002 CRITICAL 820 + IMP-003 825 · 2026-05-18.
 * Captures current buildVoiceBrief + buildReplyPromptPair outputs as immutable
 * fixtures BEFORE T2.1+ Effect-TS migration mutates loader.ts. The fixtures
 * become the byte-identical regression-fence baseline for S2 acceptance.
 *
 * Run BEFORE any S2 code changes:
 *   bun run packages/persona-engine/scripts/capture-c008-baseline.ts
 *
 * Outputs:
 *   packages/persona-engine/src/persona/fixtures/cron-baselines-pre-c008/*.txt
 *   packages/persona-engine/src/persona/fixtures/chat-mode-baseline-pre-c008.txt
 *
 * Each fixture has a header documenting the git SHA the baseline was captured from.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { buildVoiceBrief } from '../src/compose/voice-brief.ts';
import { buildReplyPromptPair } from '../src/persona/loader.ts';
import type { CharacterConfig } from '../src/types.ts';
import type { ZoneId, FactorStats } from '../src/score/types.ts';

const CYCLE = 'cycle-008-persona-substrate';
const FIXTURE_BASE = resolve(__dirname, '../src/persona/fixtures');
const CRON_DIR = resolve(FIXTURE_BASE, 'cron-baselines-pre-c008');
const CHAT_PATH = resolve(FIXTURE_BASE, 'chat-mode-baseline-pre-c008.txt');

const GIT_SHA = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const CAPTURE_TS = new Date().toISOString();

function header(scenario: string): string {
  return [
    `=== ${CYCLE} T2.0 baseline fixture ===`,
    `Scenario: ${scenario}`,
    `Captured at: ${CAPTURE_TS}`,
    `Git SHA: ${GIT_SHA}`,
    `Source: buildVoiceBrief (voice-brief.ts) + buildReplyPromptPair (loader.ts) BEFORE S2 Effect-TS migration`,
    `Purpose: byte-identical regression-fence baseline (per Flatline-Sprint SKP-002 CRITICAL 820)`,
    `DO NOT EDIT manually. Regenerate only by reverting to this SHA and re-running capture script.`,
    `=== end header ===`,
    '',
    '',
  ].join('\n');
}

// FactorStats helper mirroring voice-brief.test.ts
function stats(rank: number): FactorStats {
  return {
    history: { active_days: 100, last_active_date: '2026-05-10', stale: false, no_data: false, sufficiency: { p50: true, p90: true, p99: true } },
    occurrence: { active_day_frequency: 0.3, current_is_active: true },
    magnitude: {
      event_count: 5,
      percentiles: {
        p10: { value: 1, reliable: true }, p25: { value: 2, reliable: true }, p50: { value: 4, reliable: true },
        p75: { value: 10, reliable: true }, p90: { value: 23, reliable: true }, p95: { value: 45, reliable: true }, p99: { value: 130, reliable: true },
      },
      current_percentile_rank: rank,
    },
    cohort: {
      unique_actors: 7,
      percentiles: {
        p10: { value: 1, reliable: true }, p25: { value: 1, reliable: true }, p50: { value: 2, reliable: true },
        p75: { value: 5, reliable: true }, p90: { value: 11, reliable: true }, p95: { value: 22, reliable: true }, p99: { value: 81, reliable: true },
      },
      current_percentile_rank: 50,
    },
    cadence: { days_since_last_active: 0, median_active_day_gap_days: 1, current_gap_percentile_rank: 50 },
  };
}

const RUGGY: CharacterConfig = {
  id: 'ruggy',
  displayName: 'Ruggy',
  personaPath: resolve(__dirname, '../../../apps/character-ruggy/persona.md'),
  tool_invocation_style: undefined as unknown as string,
  webhookUsername: 'Ruggy',
  webhookAvatarUrl: undefined,
  postingMode: 'webhook' as const,
};

mkdirSync(CRON_DIR, { recursive: true });

// --- CRON baselines (voice-brief.ts · 4 zones × shape A) ---

const ZONES: ZoneId[] = ['bear-cave', 'el-dorado', 'owsley-lab', 'stonehenge'];

for (const zone of ZONES) {
  const brief = buildVoiceBrief({
    zone,
    shape: 'A-all-quiet',
    isNoClaimVariant: false,
    permittedFactors: [],
    silencedFactors: [],
    totalEvents: 4,
    windowDays: 30,
    previousPeriodEvents: 26,
  });

  const content = [
    header(`CRON · ${zone} · shape A all-quiet (canonical empty case)`),
    '--- SYSTEM PROMPT ---',
    brief.system,
    '',
    '--- USER MESSAGE ---',
    brief.user,
  ].join('\n');

  const outPath = resolve(CRON_DIR, `${zone}-shape-a.txt`);
  writeFileSync(outPath, content, 'utf8');
  console.log(`✓ wrote ${outPath} (${content.length} chars)`);
}

// Shape B fixture · bear-cave with one permitted factor
const briefB = buildVoiceBrief({
  zone: 'bear-cave',
  shape: 'B-one-dim-hot',
  isNoClaimVariant: false,
  permittedFactors: [{ display_name: 'Mibera NFT', stats: stats(92) }],
  silencedFactors: [],
  totalEvents: 24,
  windowDays: 30,
  previousPeriodEvents: 10,
});

writeFileSync(
  resolve(CRON_DIR, 'bear-cave-shape-b.txt'),
  [
    header('CRON · bear-cave · shape B one-dim-hot · 1 permitted factor'),
    '--- SYSTEM PROMPT ---',
    briefB.system,
    '',
    '--- USER MESSAGE ---',
    briefB.user,
  ].join('\n'),
  'utf8',
);
console.log(`✓ wrote bear-cave-shape-b.txt`);

// --- CHAT mode baseline (buildReplyPromptPair) ---

const chatPair = buildReplyPromptPair({
  character: RUGGY,
  prompt: 'hey ruggy, how was the digest this week?',
  authorUsername: 'zksoju',
  history: [],
});

writeFileSync(
  CHAT_PATH,
  [
    header('CHAT MODE · buildReplyPromptPair · zone-agnostic'),
    '--- SYSTEM PROMPT ---',
    chatPair.systemPrompt,
    '',
    '--- USER MESSAGE ---',
    chatPair.userMessage,
  ].join('\n'),
  'utf8',
);
console.log(`✓ wrote ${CHAT_PATH}`);

console.log('\n--- T2.0 baseline capture complete ---');
console.log(`Total fixtures: 6 (4 cron shape-A + 1 cron shape-B + 1 chat-mode)`);
console.log(`Git SHA pinned: ${GIT_SHA}`);
