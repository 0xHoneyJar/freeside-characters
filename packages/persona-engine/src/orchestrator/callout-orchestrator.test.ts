import { describe, test, expect } from 'bun:test';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import { composeCalloutPost } from './callout-orchestrator.ts';
import { createClaudeSdkMock } from '../mock/claude-sdk.mock.ts';
import { presentation } from '../live/discord-render.live.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';

function snapshotOf(zone: 'stonehenge' = 'stonehenge'): DigestSnapshot {
  return {
    zone,
    dimension: 'overall',
    displayName: zone,
    windowDays: 30,
    generatedAt: '2026-05-15T00:00:00Z',
    totalEvents: 100,
    previousPeriodEvents: 50,
    deltaPct: 100,
    deltaCount: 50,
    activeWallets: 10,
    coldFactorCount: 0,
    totalFactorCount: 0,
    topFactors: [],
    coldFactors: [],
  };
}

const mockScore: ScoreFetchPort = {
  fetchDigestSnapshot: async (zone) => snapshotOf(zone as 'stonehenge'),
  fetchActivityPulse: async () => ({ generatedAt: 'x', events: [] }),
};

const STUB_CONFIG = { VOICE_DISABLED: false, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;
const VOICE_OFF_CONFIG = { VOICE_DISABLED: true, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;
const STUB_CHARACTER = { id: 'ruggy' } as unknown as CharacterConfig;

describe('composeCalloutPost', () => {
  test('happy path returns CalloutMessage with embed', async () => {
    const result = await composeCalloutPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock({ header: 'callout header', outro: '' }),
      presentation,
    });
    expect(result.postType).toBe('callout');
    expect(result.message.voiceContent).toContain('callout header');
    expect(result.payload.embeds).toHaveLength(1);
    expect(result.payload.embeds[0]?.color).toBe(0xe74c3c);
  });

  test('voice-disabled fallback', async () => {
    const result = await composeCalloutPost(VOICE_OFF_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.message.voiceContent).toContain('callout');
    expect(result.payload.embeds[0]?.color).toBe(0xe74c3c);
  });

  test('valid triggerId is accepted + echoed in result', async () => {
    const result = await composeCalloutPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock(),
      presentation,
      triggerId: 'valid_trigger.123:abc-x',
    });
    expect(result.triggerId).toBe('valid_trigger.123:abc-x');
  });

  test('invalid triggerId rejected with throw', async () => {
    await expect(
      composeCalloutPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
        score: mockScore,
        voice: createClaudeSdkMock(),
        presentation,
        triggerId: '../etc/passwd',
      }),
    ).rejects.toThrow(/invalid triggerId/);
  });

  test('triggerId omitted is fine', async () => {
    const result = await composeCalloutPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.triggerId).toBeUndefined();
  });
});
