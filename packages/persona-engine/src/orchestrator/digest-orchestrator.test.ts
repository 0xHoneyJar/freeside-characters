import { describe, expect, test } from 'bun:test';
import { composeDigestPost } from './digest-orchestrator.ts';
import { createScoreMcpMock } from '../mock/score-mcp.mock.ts';
import { createClaudeSdkMock } from '../mock/claude-sdk.mock.ts';
import { initOtelTest, resetOtelTest } from '../observability/otel-test.ts';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';

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
    BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: 'us-west-2',
    BEDROCK_IMAGE_DEFAULT_ACTION: 'text-to-image',
    ANTHROPIC_MODEL: 'claude-opus-4-7',
    CHAT_MODE: 'auto',
    DISCORD_WEBHOOK_URL: '',
    MIX: false,
    DIGEST_CADENCE: 'weekly',
    DIGEST_DAY: 'sunday',
    DIGEST_HOUR_UTC: 0,
    POP_IN_ENABLED: false,
    POP_IN_INTERVAL_HOURS: 6,
    POP_IN_PROBABILITY: 0.1,
    WEAVER_ENABLED: false,
    WEAVER_DAY: 'wednesday',
    WEAVER_HOUR_UTC: 12,
    WEAVER_PRIMARY_ZONE: 'stonehenge',
    INTERACTIONS_PORT: 3001,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    ...overrides,
  };
}

const character: CharacterConfig = {
  id: 'ruggy',
  displayName: 'ruggy',
  personaPath: 'apps/character-ruggy/persona.md',
};

describe('composeDigestPost · port contracts', () => {
  test('VOICE_DISABLED skips voice port and still renders full substrate embed', async () => {
    resetOtelTest();
    const otel = initOtelTest();
    const voice = createClaudeSdkMock({ header: 'should not run', outro: '' });
    const result = await composeDigestPost(
      config({ VOICE_DISABLED: true }),
      character,
      'bear-cave',
      { score: createScoreMcpMock(), voice },
    );

    expect(voice.calls.length).toBe(0);
    expect(result.payload.content).toContain('Bear Cave');
    expect(result.payload.embeds[0]?.fields?.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(result.payload.embeds[0])).not.toContain('should not run');
    expect(otel.getFinishedSpans().some((span) => span.name === 'voice.invoke')).toBe(false);
    resetOtelTest();
  });

  test('voice-enabled path puts voice in content and leaves embed description absent', async () => {
    const result = await composeDigestPost(config(), character, 'bear-cave', {
      score: createScoreMcpMock(),
      voice: createClaudeSdkMock({ header: 'mock voice line', outro: '' }),
    });
    expect(result.payload.content).toContain('mock voice line');
    expect(result.payload.embeds[0]?.description).toBeUndefined();
  });
});

