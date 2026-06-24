// cycle-006 S5 T5.6 tests · Red Team AC-RT-007 verification.

import { describe, test, expect } from 'bun:test';
import {
  keyForDigest,
  keyForChatReply,
  keyForCallout,
  keyForPopIn,
} from './voice-memory-keys.ts';

describe('keyForChatReply · Red Team AC-RT-007 tuple-key foundation', () => {
  test('returns a 3-tuple-style key from (guildId, channelId, userId)', () => {
    expect(keyForChatReply('guild_thj', 'channel_general', 'user_alice')).toBe(
      'guild_thj:channel_general:user_alice',
    );
  });

  test('distinct users in same channel produce DISTINCT keys (cross-user isolation)', () => {
    const userA = keyForChatReply('g', 'c', 'alice');
    const userB = keyForChatReply('g', 'c', 'bob');
    expect(userA).not.toBe(userB);
  });

  test('distinct channels for same user produce DISTINCT keys', () => {
    const channelX = keyForChatReply('g', 'channelX', 'alice');
    const channelY = keyForChatReply('g', 'channelY', 'alice');
    expect(channelX).not.toBe(channelY);
  });

  test('distinct guilds isolate users (cross-guild contamination guard)', () => {
    const guildA = keyForChatReply('guildA', 'c', 'alice');
    const guildB = keyForChatReply('guildB', 'c', 'alice');
    expect(guildA).not.toBe(guildB);
  });

  test('rejects path-traversal in any component (AC-RT-001 defense-in-depth)', () => {
    expect(() => keyForChatReply('../etc', 'c', 'u')).toThrow(/invalid guildId/);
    expect(() => keyForChatReply('g', '/passwd', 'u')).toThrow(/invalid channelId/);
    expect(() => keyForChatReply('g', 'c', 'u\\0')).toThrow(/invalid userId/);
  });
});

describe('keyForCallout · trigger-id key tuple', () => {
  test('returns zone:triggerId', () => {
    expect(keyForCallout('stonehenge', 'spike_2026_05_15')).toBe('stonehenge:spike_2026_05_15');
  });

  test('rejects invalid triggerId', () => {
    expect(() => keyForCallout('stonehenge', '../etc/passwd')).toThrow(/invalid triggerId/);
  });
});

describe('zone-keyed streams', () => {
  test('digest / pop-in produce identity zone key', () => {
    expect(keyForDigest('bear-cave')).toBe('bear-cave');
    expect(keyForPopIn('el-dorado')).toBe('el-dorado');
  });
});
