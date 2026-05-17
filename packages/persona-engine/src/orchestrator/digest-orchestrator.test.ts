// cycle-007 S8 r4 (operator pivot 2026-05-17): digests are voiceless ·
// renderer mirrors score-dashboard's per-dimension card · no LLM call ·
// no voice-memory read/write.
//
// This file replaces the cycle-006 T6.7 voice-memory tests which targeted
// a path that no longer exists. The new contract is exercised in:
//   - dimension-pulse-payload.test.ts (renderer unit tests)
//   - this file (orchestrator integration: stub port → DigestPostResult shape)

import { describe, expect, test } from 'bun:test';
import { composeDigestPost } from './digest-orchestrator.ts';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { PulseDimensionBreakdown } from '../score/types.ts';

function config(overrides: Partial<Config> = {}): Config {
  return {
    STUB_MODE: true,
    DIGEST_REACTION_BAR_ENABLED: true,
    LLM_PROVIDER: 'stub',
    VOICE_DISABLED: false,
    SCORE_API_URL: 'https://score-api-production.up.railway.app',
    FREESIDE_BASE_URL: 'https://api.freeside.0xhoneyjar.xyz',
    FREESIDE_AGENT_MODEL: 'reasoning',
    AWS_REGION: 'eu-central-1',
    BEDROCK_TEXT_REGION: 'us-west-2',
    BEDROCK_IMAGE_REGION: 'us-east-1',
    BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: 'us-east-1',
    BEDROCK_IMAGE_DEFAULT_ACTION: 'text_to_image',
    CACHE_DIR: '/tmp/score-cache',
    POP_IN_FRACTION: 0.05,
    DIGEST_TZ: 'UTC',
    ...overrides,
  } as Config;
}

const character = {
  id: 'ruggy',
  displayName: 'ruggy',
  weights: {},
  systemPromptPath: '',
  guildSlashCommandSet: 'none',
} as unknown as CharacterConfig;

function makeBreakdown(
  partial: Partial<PulseDimensionBreakdown> = {},
): PulseDimensionBreakdown {
  return {
    id: 'nft',
    display_name: 'NFT',
    total_events: 152,
    previous_period_events: 141,
    delta_pct: 7.8,
    delta_count: 11,
    inactive_factor_count: 1,
    total_factor_count: 2,
    top_factors: [
      {
        factor_id: 'nft:mibera',
        display_name: 'Mibera',
        primary_action: 'Traded Mibera',
        total: 152,
        previous: 140,
        delta_pct: 8.6,
        delta_count: 12,
      },
    ],
    cold_factors: [
      {
        factor_id: 'nft:fractures',
        display_name: 'Fractures',
        primary_action: 'Minted Fractures',
        total: 0,
        previous: 1,
        delta_pct: null,
        delta_count: -1,
      },
    ],
    ...partial,
  };
}

function scoreStub(breakdowns: PulseDimensionBreakdown[]): ScoreFetchPort {
  return {
    fetchDigestSnapshot: () => {
      throw new Error('pulse path · fetchDigestSnapshot must not be called');
    },
    fetchActivityPulse: async () => ({
      generatedAt: '2026-05-17T00:00:00Z',
      events: [],
    }),
    fetchDimensionBreakdowns: async () => ({
      generatedAt: '2026-05-17T00:00:00Z',
      breakdowns,
    }),
  };
}

describe('composeDigestPost · pulse path (cycle-007 S8 r4)', () => {
  test('single-dim zone (el-dorado) produces ONE embed with dashboard format', async () => {
    const result = await composeDigestPost(config(), character, 'el-dorado', {
      score: scoreStub([makeBreakdown({ id: 'nft', display_name: 'NFT' })]),
    });

    expect(result.postType).toBe('digest');
    expect(result.zone).toBe('el-dorado');
    expect(result.voice).toBe(''); // voiceless · no LLM call
    expect(result.payload.content).toBe('');
    expect(result.payload.embeds).toHaveLength(1);

    const embed = result.payload.embeds[0]!;
    expect(embed.title).toBe('NFT  ↑ +7.8%');
    expect(embed.description).toContain('**152**');
    expect(embed.description).toContain('events / 7d');
    expect(embed.description).toContain('1/2 factors');
    // Fields: Most active + Went quiet
    expect(embed.fields).toHaveLength(2);
    expect(embed.fields![0].name).toBe('Most active this 7d');
    expect(embed.fields![0].value).toContain('Traded Mibera');
    expect(embed.fields![1].name).toMatch(/Went quiet/);
    expect(embed.fields![1].value).toContain('Minted Fractures');
    expect(embed.fields![1].value).toContain('was 1');
    expect(embed.footer!.text).toContain('zone: el-dorado');
    expect(embed.footer!.text).toContain('2026-05-17');
  });

  test('cross-dim zone (stonehenge) produces 3 embeds in canonical order', async () => {
    const breakdowns: PulseDimensionBreakdown[] = [
      makeBreakdown({
        id: 'og',
        display_name: 'OG',
        total_events: 0,
        delta_pct: 0,
        delta_count: 0,
        top_factors: [],
        cold_factors: [],
        previous_period_events: 0,
        inactive_factor_count: 5,
        total_factor_count: 5,
      }),
      makeBreakdown({ id: 'nft', display_name: 'NFT' }),
      makeBreakdown({
        id: 'onchain',
        display_name: 'Onchain',
        total_events: 157,
        delta_pct: 55.4,
        delta_count: 56,
        previous_period_events: 101,
      }),
    ];
    const result = await composeDigestPost(config(), character, 'stonehenge', {
      score: scoreStub(breakdowns),
    });

    expect(result.payload.embeds).toHaveLength(3);
    expect(result.payload.embeds[0]!.title).toMatch(/^OG/);
    expect(result.payload.embeds[1]!.title).toMatch(/^NFT/);
    expect(result.payload.embeds[2]!.title).toMatch(/^Onchain/);
    // OG has zero activity · field shows empty-state copy
    expect(result.payload.embeds[0]!.fields![0].value).toBe('No activity in this window');
  });

  test('voice field is always empty string · no LLM call regardless of VOICE_DISABLED', async () => {
    const a = await composeDigestPost(config({ VOICE_DISABLED: false }), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    const b = await composeDigestPost(config({ VOICE_DISABLED: true }), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    expect(a.voice).toBe('');
    expect(b.voice).toBe('');
  });

  test('digest result preserves raw_stats so downstream consumers still parse', async () => {
    const result = await composeDigestPost(config(), character, 'el-dorado', {
      score: scoreStub([makeBreakdown()]),
    });
    expect(result.digest.zone).toBe('el-dorado');
    // raw_stats is the cycle-005 substrate shape · validate the bridge through.
    expect(result.digest.raw_stats).toBeDefined();
  });
});
