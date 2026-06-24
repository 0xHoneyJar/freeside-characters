/**
 * reaction-bar.test.ts — unit tests for the community-signaling primitive.
 *
 * Mocks discord.js Client + Channel + Message surface to verify the
 * auto-react sequence works against the public API contract without
 * requiring a live Discord connection.
 *
 * E2E test (against real Discord) lives downstream in the manual
 * `bun run digest:once` flow with DISCORD_BOT_TOKEN set — see
 * `apps/bot/scripts/digest-tally.ts` for the operator-side tally.
 */

import { describe, test, expect } from 'bun:test';
import type { Client } from 'discord.js';
import {
  attachReactionBar,
  REACTION_BAR_EMOJI,
  MAX_REACTION_BAR_LENGTH,
} from './reaction-bar.ts';

// ============================================================================
// Mock factory — produces a Client-shaped object with controllable
// channel.messages.fetch + message.react behavior
// ============================================================================

interface MockReactCall {
  emoji: string;
  result: 'success' | { error: string };
}

interface MockBehavior {
  channelExists?: boolean;
  channelIsTextBased?: boolean;
  messageFetchError?: string | null;
  reactBehavior?: Record<string, 'success' | { error: string }>; // per-emoji
}

interface MockResult {
  client: Client;
  reactCalls: MockReactCall[];
}

function makeMockClient(behavior: MockBehavior = {}): MockResult {
  const reactCalls: MockReactCall[] = [];
  const {
    channelExists = true,
    channelIsTextBased = true,
    messageFetchError = null,
    reactBehavior = {},
  } = behavior;

  const message = {
    react: async (emoji: string) => {
      const result = reactBehavior[emoji] ?? 'success';
      reactCalls.push({ emoji, result });
      if (result === 'success') return { emoji };
      throw new Error(result.error);
    },
  };

  const channel = {
    isTextBased: () => channelIsTextBased,
    messages: {
      fetch: async (_messageId: string) => {
        if (messageFetchError) throw new Error(messageFetchError);
        return message;
      },
    },
  };

  const client = {
    channels: {
      fetch: async (_channelId: string) => {
        return channelExists ? channel : null;
      },
    },
  } as unknown as Client;

  return { client, reactCalls };
}

// ============================================================================
// Happy path
// ============================================================================

describe('attachReactionBar · happy path', () => {
  test('attaches all 3 default emoji in order', async () => {
    const { client, reactCalls } = makeMockClient();
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(reactCalls).toHaveLength(3);
    // Post-KEEPER+OSTROM dual review (2026-05-14): swapped 💤→🪲.
    // 💤 reads as preemptive judgment (KEEPER); 🪲 day-one preserves
    // verifier-correlation history when score-mibera#115 ships (OSTROM).
    expect(reactCalls.map((c) => c.emoji)).toEqual(['👀', '🤔', '🪲']);
  });

  test('reaction set does NOT include 💤 (KEEPER 2026-05-14 review)', () => {
    expect(REACTION_BAR_EMOJI).not.toContain('💤');
  });

  test('reaction set includes 🪲 day-one (OSTROM 2026-05-14 review)', () => {
    expect(REACTION_BAR_EMOJI).toContain('🪲');
  });

  test('emoji order matches REACTION_BAR_EMOJI const', async () => {
    const { client, reactCalls } = makeMockClient();
    await attachReactionBar(client, 'channel-1', 'msg-1');
    expect(reactCalls.map((c) => c.emoji)).toEqual([...REACTION_BAR_EMOJI]);
  });

  test('REACTION_BAR_EMOJI contains only non-banned emoji (per CLAUDE.md)', () => {
    const banned = ['🚀', '💯', '🎉', '🔥', '🤑', '💎', '🙌', '💪', '⚡️', '✨', '🌟'];
    for (const emoji of REACTION_BAR_EMOJI) {
      expect(banned).not.toContain(emoji);
    }
  });

  test('REACTION_BAR_EMOJI is exactly 3 reactions (v1 scope)', () => {
    expect(REACTION_BAR_EMOJI).toHaveLength(3);
  });

  test('REACTION_BAR_EMOJI length within MAX_REACTION_BAR_LENGTH invariant (OSTROM anti-Goodhart constraint)', () => {
    expect(REACTION_BAR_EMOJI.length).toBeLessThanOrEqual(MAX_REACTION_BAR_LENGTH);
    expect(REACTION_BAR_EMOJI.length).toBeGreaterThan(0);
    // The TS-level constraint via conditional type also enforces this at
    // compile-time, but the runtime check is the operator-facing failure
    // surface (compile errors are quiet during dev).
  });

  test('opts.emoji override replaces default set', async () => {
    const { client, reactCalls } = makeMockClient();
    await attachReactionBar(client, 'channel-1', 'msg-1', {
      emoji: ['🌫', '🪲'],
    });
    expect(reactCalls.map((c) => c.emoji)).toEqual(['🌫', '🪲']);
  });
});

// ============================================================================
// Channel-level failures
// ============================================================================

describe('attachReactionBar · channel failures', () => {
  test('null channel → all reactions reported as failed, no throw', async () => {
    const { client, reactCalls } = makeMockClient({ channelExists: false });
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(0);
    expect(result.failed).toBe(3);
    expect(reactCalls).toHaveLength(0); // never even tried to react
    expect(result.errors.every((e) => e.reason === 'channel-not-text-based')).toBe(true);
  });

  test('non-text-based channel → all reactions failed, no throw', async () => {
    const { client, reactCalls } = makeMockClient({ channelIsTextBased: false });
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(0);
    expect(result.failed).toBe(3);
    expect(reactCalls).toHaveLength(0);
  });
});

// ============================================================================
// Message-level failures
// ============================================================================

describe('attachReactionBar · message-fetch failures', () => {
  test('message-fetch error → all reactions reported failed, no throw', async () => {
    const { client, reactCalls } = makeMockClient({
      messageFetchError: 'Unknown Message',
    });
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(0);
    expect(result.failed).toBe(3);
    expect(reactCalls).toHaveLength(0);
    expect(result.errors[0]?.reason).toMatch(/message-fetch-failed.*Unknown Message/);
  });
});

// ============================================================================
// Partial failures (per-reaction)
// ============================================================================

describe('attachReactionBar · per-reaction failures', () => {
  test('one reaction fails → others still attach + result reflects partial', async () => {
    const { client, reactCalls } = makeMockClient({
      reactBehavior: {
        '🤔': { error: 'Missing Permissions' },
      },
    });
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.emoji).toBe('🤔');
    expect(result.errors[0]?.reason).toBe('Missing Permissions');
    expect(reactCalls).toHaveLength(3); // all 3 were attempted
  });

  test('all reactions fail → 3 errors, never throws to caller', async () => {
    const { client } = makeMockClient({
      reactBehavior: {
        '👀': { error: 'rate limit' },
        '🤔': { error: 'rate limit' },
        '🪲': { error: 'rate limit' },
      },
    });
    const result = await attachReactionBar(client, 'channel-1', 'msg-1');

    expect(result.attached).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.errors).toHaveLength(3);
  });
});

// ============================================================================
// Verbose mode
// ============================================================================

describe('attachReactionBar · verbose mode', () => {
  test('verbose: true does not throw + does not change reaction behavior', async () => {
    const { client, reactCalls } = makeMockClient();
    const result = await attachReactionBar(client, 'channel-1', 'msg-1', {
      verbose: true,
    });

    expect(result.attached).toBe(3);
    expect(reactCalls).toHaveLength(3);
  });
});
