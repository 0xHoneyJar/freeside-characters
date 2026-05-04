/**
 * quest-runtime-bootstrap.test.ts — smoke test for the memory-mode
 * QuestRuntime constructor (cycle-Q post-merge QA bootstrap).
 *
 * Validates:
 *   - buildMemoryDevQuestRuntime returns a fully-shaped QuestRuntime
 *   - catalog.listAvailableQuests returns the stub quest scoped to
 *     world="mongolian" · returns [] for any other world slug
 *   - catalog.findQuest("mongolian", "munkh-introduction-v1") returns
 *     the stub · returns undefined for any other (world, quest) pair
 *   - resolvePlayer extracts user.id correctly from interaction.member.user
 *     and returns null when no Discord user is present (per anon-default
 *     PRD D4 with anon-only stub)
 *   - worldManifests scope to QUEST_DEV_GUILD_ID exactly when provided
 */

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import {
  buildMemoryDevQuestRuntime,
  MEMORY_DEV_STUB_QUEST_ID,
  MEMORY_DEV_STUB_WORLD_SLUG,
} from '../quest-runtime-bootstrap.ts';
import type { CharacterConfig } from '@freeside-characters/persona-engine';
import type { DiscordInteraction } from '../discord-interactions/types.ts';

const stubCharacters: readonly CharacterConfig[] = [
  {
    id: 'mongolian',
    displayName: 'Munkh',
    personaPath: '/dev/null/persona.md',
    exemplarsDir: undefined,
    emojiAffinity: { primary: 'mibera', fallback: 'mibera' },
  } as unknown as CharacterConfig,
];

describe('cycle-Q · quest-runtime-bootstrap · buildMemoryDevQuestRuntime shape', () => {
  test('returns a fully-shaped QuestRuntime', () => {
    const r = buildMemoryDevQuestRuntime({
      devGuildId: '111111111111111111',
      characters: stubCharacters,
    });
    expect(Array.isArray(r.worldManifests)).toBe(true);
    expect(typeof r.catalog.listAvailableQuests).toBe('function');
    expect(typeof r.catalog.findQuest).toBe('function');
    expect(typeof r.characters.resolveDisplayName).toBe('function');
    expect(typeof r.pgPools.poolForWorld).toBe('function');
    expect(typeof r.resolvePlayer).toBe('function');
  });

  test('worldManifests scope to devGuildId exactly when provided', () => {
    const r = buildMemoryDevQuestRuntime({
      devGuildId: '999888777666555444',
      characters: stubCharacters,
    });
    expect(r.worldManifests).toHaveLength(1);
    expect(r.worldManifests[0]?.slug).toBe(MEMORY_DEV_STUB_WORLD_SLUG);
    expect(r.worldManifests[0]?.guild_ids).toEqual(['999888777666555444']);
  });

  test('worldManifests have no guild_ids when devGuildId omitted', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    expect(r.worldManifests).toHaveLength(1);
    expect(r.worldManifests[0]?.guild_ids).toEqual([]);
  });

  test('CharacterRegistry resolves Munkh display name from loaded character', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    expect(r.characters.resolveDisplayName('mongolian')).toBe('Munkh');
    expect(r.characters.resolveDisplayName('unknown')).toBeUndefined();
  });

  test('pgPools.poolForWorld always returns null (memory adapter only)', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    expect(r.pgPools.poolForWorld('mongolian')).toBeNull();
    expect(r.pgPools.poolForWorld('mibera')).toBeNull();
  });
});

describe('cycle-Q · quest-runtime-bootstrap · catalog', () => {
  test('listAvailableQuests returns 1 stub quest for mongolian', async () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const quests = await Effect.runPromise(
      r.catalog.listAvailableQuests(MEMORY_DEV_STUB_WORLD_SLUG),
    );
    expect(quests).toHaveLength(1);
    expect(String(quests[0]?.quest_id)).toBe(MEMORY_DEV_STUB_QUEST_ID);
    expect(String(quests[0]?.world_slug)).toBe(MEMORY_DEV_STUB_WORLD_SLUG);
  });

  test('listAvailableQuests returns [] for any other world', async () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const quests = await Effect.runPromise(
      r.catalog.listAvailableQuests('mibera'),
    );
    expect(quests).toEqual([]);
  });

  test('findQuest returns stub for matching (world, id)', async () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const q = await Effect.runPromise(
      r.catalog.findQuest(MEMORY_DEV_STUB_WORLD_SLUG, MEMORY_DEV_STUB_QUEST_ID),
    );
    expect(String(q?.quest_id)).toBe(MEMORY_DEV_STUB_QUEST_ID);
    expect(q?.title).toBeTruthy();
    expect(q?.prompt).toBeTruthy();
    expect(q?.rubric_pointer.type).toBe('codex_ref');
  });

  test('findQuest returns undefined for unknown quest', async () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const q = await Effect.runPromise(
      r.catalog.findQuest(MEMORY_DEV_STUB_WORLD_SLUG, 'no-such-quest'),
    );
    expect(q).toBeUndefined();
  });

  test('findQuest returns undefined for non-mongolian world', async () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const q = await Effect.runPromise(
      r.catalog.findQuest('mibera', MEMORY_DEV_STUB_QUEST_ID),
    );
    expect(q).toBeUndefined();
  });
});

describe('cycle-Q · quest-runtime-bootstrap · resolvePlayer', () => {
  test('extracts anon PlayerIdentity from interaction.member.user.id', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const interaction = {
      type: 2,
      id: 'i1',
      application_id: 'a',
      token: 't',
      guild_id: '111111111111111111',
      member: {
        user: {
          id: '12345678901234567', // 17-digit Discord ID
          username: 'tester',
        },
      },
      data: { id: 'd', name: 'quest' },
    } as unknown as DiscordInteraction;
    const player = r.resolvePlayer(interaction);
    expect(player).not.toBeNull();
    expect(player?.type).toBe('anon');
    if (player?.type === 'anon') {
      expect(String(player.discord_id)).toBe('12345678901234567');
    }
  });

  test('returns null when interaction has no member.user', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const interaction = {
      type: 2,
      id: 'i1',
      application_id: 'a',
      token: 't',
      data: { id: 'd', name: 'quest' },
    } as unknown as DiscordInteraction;
    const player = r.resolvePlayer(interaction);
    expect(player).toBeNull();
  });

  test('returns null when user.id fails Discord ID pattern', () => {
    const r = buildMemoryDevQuestRuntime({ characters: stubCharacters });
    const interaction = {
      type: 2,
      id: 'i1',
      application_id: 'a',
      token: 't',
      guild_id: '111111111111111111',
      member: {
        user: { id: 'not-a-discord-id', username: 'tester' },
      },
      data: { id: 'd', name: 'quest' },
    } as unknown as DiscordInteraction;
    const player = r.resolvePlayer(interaction);
    expect(player).toBeNull();
  });
});
