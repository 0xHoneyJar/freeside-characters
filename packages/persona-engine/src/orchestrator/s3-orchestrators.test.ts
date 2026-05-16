// cycle-006 S3 · combined test suite for 5 migrated orchestrators.
// Each orchestrator has happy-path + voice-disabled fallback coverage.

import { describe, test, expect } from 'bun:test';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import { composeMicroPost } from './micro-orchestrator.ts';
import { composeLoreDropPost } from './lore-drop-orchestrator.ts';
import { composeQuestionPost } from './question-orchestrator.ts';
import { composeWeaverPost } from './weaver-orchestrator.ts';
import { composePopInPost } from './pop-in-orchestrator.ts';
import { createClaudeSdkMock } from '../mock/claude-sdk.mock.ts';
import { presentation } from '../live/discord-render.live.ts';

function snapshotOf(zone: 'stonehenge' | 'bear-cave' | 'el-dorado' | 'owsley-lab' = 'stonehenge'): DigestSnapshot {
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

function mockScore(): ScoreFetchPort {
  return {
    fetchDigestSnapshot: async (zone) => snapshotOf(zone),
    fetchActivityPulse: async () => ({ generatedAt: '2026-05-15T00:00:00Z', events: [] }),
  };
}

const STUB_CONFIG = { VOICE_DISABLED: false, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;
const VOICE_OFF_CONFIG = { VOICE_DISABLED: true, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;
const STUB_CHARACTER = { id: 'ruggy' } as unknown as CharacterConfig;

describe('composeMicroPost', () => {
  test('happy path returns MicroMessage + DigestPayload', async () => {
    const result = await composeMicroPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'micro header', outro: '' }),
      presentation,
    });
    expect(result.postType).toBe('micro');
    expect(result.message.voiceContent).toContain('micro header');
    expect(result.payload.embeds).toHaveLength(0);
    expect(result.payload.content).toBeTruthy();
  });

  test('voice-disabled fallback yields no voice in content', async () => {
    const result = await composeMicroPost(VOICE_OFF_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.message.voiceContent).toContain('checking in');
    expect(result.payload.embeds).toHaveLength(0);
  });
});

describe('composeLoreDropPost', () => {
  test('happy path', async () => {
    const result = await composeLoreDropPost(STUB_CONFIG, STUB_CHARACTER, 'bear-cave', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'lore header', outro: '' }),
      presentation,
    });
    expect(result.postType).toBe('lore_drop');
    expect(result.message.voiceContent).toContain('lore header');
  });

  test('voice-disabled fallback', async () => {
    const result = await composeLoreDropPost(VOICE_OFF_CONFIG, STUB_CHARACTER, 'bear-cave', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.message.voiceContent).toContain('codex');
  });
});

describe('composeQuestionPost', () => {
  test('happy path', async () => {
    const result = await composeQuestionPost(STUB_CONFIG, STUB_CHARACTER, 'el-dorado', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'q header', outro: '' }),
      presentation,
    });
    expect(result.postType).toBe('question');
    expect(result.message.voiceContent).toContain('q header');
  });

  test('voice-disabled fallback', async () => {
    const result = await composeQuestionPost(VOICE_OFF_CONFIG, STUB_CHARACTER, 'el-dorado', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.message.voiceContent).toContain('?');
  });
});

describe('composeWeaverPost', () => {
  test('fetches all 4 zones and renders cross-zone embed', async () => {
    let fetchedZones: string[] = [];
    const score: ScoreFetchPort = {
      fetchDigestSnapshot: async (zone) => {
        fetchedZones.push(zone);
        return snapshotOf(zone);
      },
      fetchActivityPulse: async () => ({ generatedAt: 'x', events: [] }),
    };
    const result = await composeWeaverPost(STUB_CONFIG, STUB_CHARACTER, 'owsley-lab', {
      score,
      voice: createClaudeSdkMock({ header: 'weaver header', outro: '' }),
      presentation,
    });
    expect(result.postType).toBe('weaver');
    expect(fetchedZones).toHaveLength(4);
    expect(result.payload.embeds[0]?.fields).toHaveLength(4);
  });

  test('voice-disabled fallback', async () => {
    const result = await composeWeaverPost(VOICE_OFF_CONFIG, STUB_CHARACTER, 'owsley-lab', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(result.message.voiceContent).toContain('weaving');
  });
});

describe('composePopInPost', () => {
  test('dispatches to micro by default selection', async () => {
    const result = await composePopInPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'h', outro: '' }),
      presentation,
      pickType: () => 'micro',
    });
    expect(result.postType).toBe('micro');
  });

  test('dispatches to lore_drop when picker returns it', async () => {
    const result = await composePopInPost(STUB_CONFIG, STUB_CHARACTER, 'bear-cave', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'h', outro: '' }),
      presentation,
      pickType: () => 'lore_drop',
    });
    expect(result.postType).toBe('lore_drop');
  });

  test('dispatches to question when picker returns it', async () => {
    const result = await composePopInPost(STUB_CONFIG, STUB_CHARACTER, 'el-dorado', {
      score: mockScore(),
      voice: createClaudeSdkMock({ header: 'h', outro: '' }),
      presentation,
      pickType: () => 'question',
    });
    expect(result.postType).toBe('question');
  });

  test('default pickType is deterministic per zone', async () => {
    const r1 = await composePopInPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    const r2 = await composePopInPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore(),
      voice: createClaudeSdkMock(),
      presentation,
    });
    expect(r1.postType).toBe(r2.postType);
  });
});
