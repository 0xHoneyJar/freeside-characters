// cycle-006 S6 T6.7 · canary test for digest-orchestrator voice-memory wiring.
// Verifies: read-before-voice-gen passes prior entry to formatPriorWeekHint;
// write-after-voice-gen persists sanitized + TTL'd entry; fail-safe try/catch
// around memory failures.

import { describe, test, expect } from 'bun:test';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import { composeDigestPost } from './digest-orchestrator.ts';
import { createClaudeSdkMock } from '../mock/claude-sdk.mock.ts';
import { createVoiceMemoryMock } from '../mock/voice-memory.mock.ts';
import { presentation } from '../live/discord-render.live.ts';
import {
  VOICE_MEMORY_SCHEMA_VERSION,
  type VoiceMemoryEntry,
} from '../domain/voice-memory-entry.ts';

function snapshotOf(): DigestSnapshot {
  return {
    zone: 'stonehenge',
    dimension: 'overall',
    displayName: 'Stonehenge',
    windowDays: 30,
    generatedAt: '2026-05-15T12:00:00Z',
    totalEvents: 1234,
    previousPeriodEvents: 1000,
    deltaPct: 23.4,
    deltaCount: 234,
    activeWallets: 50,
    coldFactorCount: 0,
    totalFactorCount: 0,
    topFactors: [],
    coldFactors: [],
  };
}

const mockScore: ScoreFetchPort = {
  fetchDigestSnapshot: async () => snapshotOf(),
  fetchActivityPulse: async () => ({ generatedAt: 'x', events: [] }),
};

const STUB_CONFIG = { VOICE_DISABLED: false, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;
const STUB_CHARACTER = { id: 'ruggy' } as unknown as CharacterConfig;

function priorEntry(overrides: Partial<VoiceMemoryEntry> = {}): VoiceMemoryEntry {
  return {
    schema_version: VOICE_MEMORY_SCHEMA_VERSION,
    at: '2026-05-08T12:00:00.000Z',
    stream: 'digest',
    zone: 'stonehenge',
    key: 'stonehenge',
    header: 'gold scatters across the table',
    outro: 'next week — the hum drops',
    key_numbers: { total_events: 1000, permitted_factor_names: [] },
    use_label: 'background_only',
    expiry: '2099-12-31T00:00:00.000Z',
    signed_by: 'agent:ruggy',
    ...overrides,
  };
}

describe('digest-orchestrator · voice-memory read-before-voice-gen (T6.7)', () => {
  test('prior entry → formatPriorWeekHint → voice-gen receives wrapped content', async () => {
    const voiceMemory = createVoiceMemoryMock();
    voiceMemory.seed('digest', 'stonehenge', [priorEntry()]);
    const voice = createClaudeSdkMock({ header: 'new header', outro: 'new outro' });

    await composeDigestPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice,
      presentation,
      voiceMemory,
    });

    // voice-gen captured the priorWeekHint with the marker wrapping.
    expect(voice.calls.length).toBe(1);
    const ctx = voice.calls[0]!.ctx;
    expect(ctx.priorWeekHint).toContain('<untrusted-content');
    expect(ctx.priorWeekHint).toContain('stream="digest"');
    expect(ctx.priorWeekHint).toContain('gold scatters');
  });

  test('no prior entry → priorWeekHint is empty string', async () => {
    const voiceMemory = createVoiceMemoryMock();
    const voice = createClaudeSdkMock();

    await composeDigestPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice,
      presentation,
      voiceMemory,
    });

    expect(voice.calls[0]!.ctx.priorWeekHint).toBe('');
  });
});

describe('digest-orchestrator · voice-memory write-after-voice-gen (T6.7)', () => {
  test('persists sanitized entry with TTL after successful voice-gen', async () => {
    const voiceMemory = createVoiceMemoryMock();
    const voice = createClaudeSdkMock({ header: 'new\x07header', outro: 'new outro' });

    await composeDigestPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice,
      presentation,
      voiceMemory,
    });

    expect(voiceMemory.appendCalls.length).toBe(1);
    const written = voiceMemory.appendCalls[0]!.entry;
    // Control byte 0x07 stripped by sanitizeMemoryText.
    expect(written.header).toBe('newheader');
    expect(written.stream).toBe('digest');
    expect(written.key).toBe('stonehenge');
    expect(written.key_numbers.total_events).toBe(1234);
    expect(written.signed_by).toBe('agent:ruggy');
    // TTL ~90 days from now.
    const expiry = Date.parse(written.expiry);
    const nowApprox = Date.now();
    const days = (expiry - nowApprox) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
  });

  test('voice-disabled config does NOT write to memory', async () => {
    const voiceMemory = createVoiceMemoryMock();
    const VOICE_OFF = { VOICE_DISABLED: true, FREESIDE_AGENT_MODEL: 'mock' } as unknown as Config;

    await composeDigestPost(VOICE_OFF, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock(),
      presentation,
      voiceMemory,
    });

    expect(voiceMemory.appendCalls.length).toBe(0);
  });

  test('voice-memory write failure does NOT block post delivery (SDD §6.1 fail-safe)', async () => {
    // Mock that rejects on append.
    const failingMemory = {
      ...createVoiceMemoryMock(),
      appendEntry: async () => {
        throw new Error('disk full');
      },
    };

    const result = await composeDigestPost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', {
      score: mockScore,
      voice: createClaudeSdkMock({ header: 'h', outro: 'o' }),
      presentation,
      voiceMemory: failingMemory,
    });

    expect(result.postType).toBe('digest');
    expect(result.payload.content).toBeTruthy();
  });
});
