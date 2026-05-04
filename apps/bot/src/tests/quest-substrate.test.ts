/**
 * quest-substrate.test.ts — cycle-Q · sprint-3 smoke test for the bot's
 * quest substrate wiring (world-resolver · quest-runtime · quest-dispatch
 * interception).
 *
 * Validates:
 *   - world-resolver resolves guild_id → world manifest correctly
 *   - buildEngineConfigForWorld constructs EngineConfigShape from manifest
 *   - quest-dispatch.isQuestInteraction detects /quest slash + quest_*
 *     button + quest_submission_* modal
 *   - the no-op default runtime makes the interceptor return a polite
 *     ephemeral reply (not a crash)
 */
import { describe, expect, test } from 'bun:test';
import {
  buildEngineConfigForWorld,
  resolveEngineConfigForGuild,
  resolveWorldForGuild,
  type WorldManifestQuestSubset,
} from '../world-resolver.ts';
import {
  isQuestInteraction,
  noQuestRuntime,
  handleQuestInteraction,
} from '../discord-interactions/quest-dispatch.ts';
import type { DiscordInteraction } from '../discord-interactions/types.ts';

const fixtureManifests: readonly WorldManifestQuestSubset[] = [
  {
    slug: 'mibera',
    quest_namespace: 'mibera-grails',
    quest_engine_config: {
      questAcceptanceMode: 'open-badge-gated',
      submissionStyle: 'inline_thread',
      positiveFrictionDelayMs: 12000,
    },
    guild_ids: ['111111111111111111', '222222222222222222'],
  },
  {
    slug: 'apdao',
    guild_ids: ['333333333333333333'],
    // no quest_engine_config · should resolve world but config null
  },
  {
    slug: 'rektdrop',
    // no guild_ids · never resolves
  },
];

describe('cycle-Q · world-resolver', () => {
  test('resolveWorldForGuild matches the world by guild_id', () => {
    const world = resolveWorldForGuild('111111111111111111', fixtureManifests);
    expect(world?.slug).toBe('mibera');
  });

  test('resolveWorldForGuild returns null when no world claims the guild', () => {
    expect(resolveWorldForGuild('999999999999999999', fixtureManifests)).toBeNull();
  });

  test('resolveWorldForGuild skips manifests without guild_ids', () => {
    expect(resolveWorldForGuild('any', [{ slug: 'rektdrop' }])).toBeNull();
  });

  test('buildEngineConfigForWorld returns full config when present', () => {
    const world = fixtureManifests[0]!;
    const config = buildEngineConfigForWorld(world);
    expect(config).toEqual({
      questAcceptanceMode: 'open-badge-gated',
      worldSlug: 'mibera',
      submissionStyle: 'inline_thread',
      positiveFrictionDelayMs: 12000,
    });
  });

  test('buildEngineConfigForWorld returns null when world lacks quest_engine_config', () => {
    const world = fixtureManifests[1]!; // apdao · no quest_engine_config
    expect(buildEngineConfigForWorld(world)).toBeNull();
  });

  test('resolveEngineConfigForGuild composes both steps in one call', () => {
    const config = resolveEngineConfigForGuild('111111111111111111', fixtureManifests);
    expect(config?.worldSlug).toBe('mibera');
  });
});

describe('cycle-Q · quest-dispatch · isQuestInteraction', () => {
  test('matches /quest APPLICATION_COMMAND', () => {
    const i: DiscordInteraction = {
      type: 2,
      id: 'i1',
      application_id: 'a',
      token: 't',
      data: { id: 'd', name: 'quest' },
      // biome-ignore lint: structural cast
    } as DiscordInteraction;
    expect(isQuestInteraction(i)).toBe(true);
  });

  test('does NOT match /satoshi APPLICATION_COMMAND', () => {
    const i: DiscordInteraction = {
      type: 2,
      id: 'i2',
      application_id: 'a',
      token: 't',
      data: { id: 'd', name: 'satoshi' },
    } as DiscordInteraction;
    expect(isQuestInteraction(i)).toBe(false);
  });

  test('matches MESSAGE_COMPONENT with quest_accept_<id> custom_id', () => {
    const i = {
      type: 3,
      id: 'i3',
      application_id: 'a',
      token: 't',
      data: { custom_id: 'quest_accept_q-test-01' },
    } as unknown as DiscordInteraction;
    expect(isQuestInteraction(i)).toBe(true);
  });

  test('matches MODAL_SUBMIT with quest_submission_<id> custom_id', () => {
    const i = {
      type: 5,
      id: 'i4',
      application_id: 'a',
      token: 't',
      data: { custom_id: 'quest_submission_q-test-01' },
    } as unknown as DiscordInteraction;
    expect(isQuestInteraction(i)).toBe(true);
  });

  test('does NOT match MESSAGE_COMPONENT with non-quest custom_id', () => {
    const i = {
      type: 3,
      id: 'i5',
      application_id: 'a',
      token: 't',
      data: { custom_id: 'image_regen_x' },
    } as unknown as DiscordInteraction;
    expect(isQuestInteraction(i)).toBe(false);
  });
});

describe('cycle-Q · quest-dispatch · handleQuestInteraction with noQuestRuntime', () => {
  test('non-guild interaction returns polite ephemeral reply', async () => {
    const i: DiscordInteraction = {
      type: 2,
      id: 'i',
      application_id: 'a',
      token: 't',
      data: { id: 'd', name: 'quest', options: [{ name: 'browse', type: 1 }] },
    } as DiscordInteraction;
    const r = await handleQuestInteraction(i, noQuestRuntime);
    expect(r.type).toBe(4);
    expect(r.data?.content).toContain('guild-only');
  });

  test('guild interaction with no resolvable player returns identity-error reply', async () => {
    const i: DiscordInteraction = {
      type: 2,
      id: 'i',
      application_id: 'a',
      token: 't',
      guild_id: '111111111111111111',
      data: { id: 'd', name: 'quest', options: [{ name: 'browse', type: 1 }] },
    } as DiscordInteraction;
    const r = await handleQuestInteraction(i, noQuestRuntime);
    expect(r.type).toBe(4);
    expect(r.data?.content).toContain('identity');
  });
});
