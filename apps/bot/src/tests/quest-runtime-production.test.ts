/**
 * quest-runtime-production.test.ts — coverage of the production-mode
 * QuestRuntime constructor and tenant→pool dispatch (cycle-B sprint-1 ·
 * B-1.8).
 *
 * Validates:
 *   - buildProductionQuestRuntime returns a fully-shaped QuestRuntime
 *   - tenant→world dispatch translates world.slug → tenant_id → pool
 *     (I3 Spine Seam · per-tenant heterogeneity is first-class)
 *   - WorldPgPoolFactory falls back to null (memory-fallback path) when
 *     tenant_id is missing OR no pool is provisioned for that tenant
 *   - envConnectionStringSource reads `TENANT_<TENANT>_DATABASE_URL` keys
 *     · uppercase + dashes → underscores · empty string treated as null
 *   - buildEnvTenantPgPoolFactory caches pools per tenant (lazy init ·
 *     one pool per tenant for process lifetime)
 *   - resolvePlayer defaults to anon-only (matching memory-mode · PRD D4)
 *
 * Tests do NOT open real Pg connections · pool builder is injected as a
 * recording stub. Integration tests for end-to-end Pg lands in B-1.14
 * (operator-bounded smoke).
 */

import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import {
  PRODUCTION_STUB_QUEST_ID,
  PRODUCTION_STUB_WORLD_SLUG,
  buildEnvTenantPgPoolFactory,
  buildProductionQuestRuntime,
  buildWorldPgPoolFactoryFromTenants,
  envConnectionStringSource,
  type PoolBuilder,
  type ProductionQuestRuntimeOptions,
  type TenantPgPoolFactory,
} from '../quest-runtime-production.ts';
import type { QuestStatePostgresPool } from '@0xhoneyjar/quests-engine';
import type { CharacterConfig } from '@freeside-characters/persona-engine';
import type { WorldManifestQuestSubset } from '../world-resolver.ts';
import type { DiscordInteraction } from '../discord-interactions/types.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stubCharacters: readonly CharacterConfig[] = [
  {
    id: 'mongolian',
    displayName: 'Munkh',
    personaPath: '/dev/null/persona.md',
    exemplarsDir: undefined,
    emojiAffinity: { primary: 'mibera', fallback: 'mibera' },
  } as unknown as CharacterConfig,
];

const miberaManifest: WorldManifestQuestSubset = {
  slug: 'mongolian',
  tenant_id: 'mibera',
  guild_ids: ['111111111111111111'],
  auth: { backend: 'freeside-jwt' },
  quest_engine_config: {
    questAcceptanceMode: 'auth-required',
    submissionStyle: 'inline_thread',
    positiveFrictionDelayMs: 12000,
  },
};

const stubPool = (tag: string): QuestStatePostgresPool => ({
  query: async () => ({ rows: [{ tag } as never], rowCount: 0 }),
});

const buildOpts = (
  overrides: Partial<ProductionQuestRuntimeOptions> = {},
): ProductionQuestRuntimeOptions => ({
  worldManifests: [miberaManifest],
  characters: stubCharacters,
  tenantPgPoolFactory: { poolForTenant: () => null },
  ...overrides,
});

// ---------------------------------------------------------------------------
// buildProductionQuestRuntime · shape
// ---------------------------------------------------------------------------

describe('cycle-B · production runtime · buildProductionQuestRuntime shape (B-1.8)', () => {
  test('returns a fully-shaped QuestRuntime', () => {
    const r = buildProductionQuestRuntime(buildOpts());
    expect(Array.isArray(r.worldManifests)).toBe(true);
    expect(typeof r.catalog.listAvailableQuests).toBe('function');
    expect(typeof r.catalog.findQuest).toBe('function');
    expect(typeof r.characters.resolveDisplayName).toBe('function');
    expect(typeof r.pgPools.poolForWorld).toBe('function');
    expect(typeof r.resolvePlayer).toBe('function');
  });

  test('CharacterRegistry resolves Munkh display name from loaded character', () => {
    const r = buildProductionQuestRuntime(buildOpts());
    expect(r.characters.resolveDisplayName('mongolian')).toBe('Munkh');
    expect(r.characters.resolveDisplayName('unknown')).toBeUndefined();
  });

  test('default catalog ships the Mongolian stub quest', async () => {
    const r = buildProductionQuestRuntime(buildOpts());
    const quests = await Effect.runPromise(
      r.catalog.listAvailableQuests(PRODUCTION_STUB_WORLD_SLUG),
    );
    expect(quests).toHaveLength(1);
    // quest_id is branded · coerce for value comparison
    expect(String(quests[0]?.quest_id)).toBe(PRODUCTION_STUB_QUEST_ID);
  });

  test('default catalog returns empty list for unknown world', async () => {
    const r = buildProductionQuestRuntime(buildOpts());
    const quests = await Effect.runPromise(
      r.catalog.listAvailableQuests('unknown-world'),
    );
    expect(quests).toEqual([]);
  });

  test('default resolvePlayer returns anon player for valid Discord ID', () => {
    const r = buildProductionQuestRuntime(buildOpts());
    const interaction = {
      user: { id: '123456789012345678' },
    } as unknown as DiscordInteraction;
    const player = r.resolvePlayer(interaction);
    expect(player?.type).toBe('anon');
    if (player?.type === 'anon') {
      // discord_id is branded · coerce for value comparison
      expect(String(player.discord_id)).toBe('123456789012345678');
    }
  });

  test('default resolvePlayer returns null for missing user', () => {
    const r = buildProductionQuestRuntime(buildOpts());
    const interaction = {} as unknown as DiscordInteraction;
    expect(r.resolvePlayer(interaction)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildWorldPgPoolFactoryFromTenants · I3 Spine Seam dispatch
// ---------------------------------------------------------------------------

describe('cycle-B · production runtime · world→tenant→pool dispatch (I3)', () => {
  test('dispatches world.slug → tenant_id → pool', () => {
    const pool = stubPool('mibera-pg');
    const tenantFactory: TenantPgPoolFactory = {
      poolForTenant: (t) => (t === 'mibera' ? pool : null),
    };
    const factory = buildWorldPgPoolFactoryFromTenants([miberaManifest], tenantFactory);
    expect(factory.poolForWorld('mongolian')).toBe(pool);
  });

  test('returns null for unknown world slug (memory fallback engages)', () => {
    const factory = buildWorldPgPoolFactoryFromTenants([miberaManifest], {
      poolForTenant: () => stubPool('any'),
    });
    expect(factory.poolForWorld('not-in-manifest')).toBeNull();
  });

  test('returns null when matched manifest has no tenant_id (cycle-Q v1.0 forward-compat)', () => {
    const noTenant: WorldManifestQuestSubset = {
      slug: 'cycleq-legacy',
      guild_ids: ['xxx'],
    };
    const factory = buildWorldPgPoolFactoryFromTenants([noTenant], {
      poolForTenant: () => stubPool('any'),
    });
    expect(factory.poolForWorld('cycleq-legacy')).toBeNull();
  });

  test('returns null when tenant factory has no pool for that tenant', () => {
    const factory = buildWorldPgPoolFactoryFromTenants([miberaManifest], {
      poolForTenant: () => null,
    });
    expect(factory.poolForWorld('mongolian')).toBeNull();
  });

  test('two worlds same tenant share the same pool (no cache duplication)', () => {
    const pool = stubPool('shared-mibera-pg');
    const second: WorldManifestQuestSubset = {
      slug: 'mongolian-v2',
      tenant_id: 'mibera',
      guild_ids: ['222'],
    };
    const factory = buildWorldPgPoolFactoryFromTenants(
      [miberaManifest, second],
      { poolForTenant: () => pool },
    );
    expect(factory.poolForWorld('mongolian')).toBe(pool);
    expect(factory.poolForWorld('mongolian-v2')).toBe(pool);
  });
});

// ---------------------------------------------------------------------------
// envConnectionStringSource · TENANT_<TENANT>_DATABASE_URL
// ---------------------------------------------------------------------------

describe('cycle-B · production runtime · envConnectionStringSource', () => {
  test('reads TENANT_<UPPER>_DATABASE_URL pattern', () => {
    const source = envConnectionStringSource({
      TENANT_MIBERA_DATABASE_URL: 'postgres://mibera-railway/db',
    });
    expect(source.forTenant('mibera')).toBe('postgres://mibera-railway/db');
  });

  test('translates dash-tenants to underscore env keys', () => {
    const source = envConnectionStringSource({
      TENANT_CUB_QUEST_DATABASE_URL: 'postgres://cubquest/db',
    });
    expect(source.forTenant('cub-quest')).toBe('postgres://cubquest/db');
  });

  test('returns null for missing tenant key', () => {
    const source = envConnectionStringSource({});
    expect(source.forTenant('mibera')).toBeNull();
  });

  test('treats empty string as null (operator misconfig)', () => {
    const source = envConnectionStringSource({
      TENANT_MIBERA_DATABASE_URL: '   ',
    });
    expect(source.forTenant('mibera')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildEnvTenantPgPoolFactory · lazy + cached per-tenant
// ---------------------------------------------------------------------------

describe('cycle-B · production runtime · buildEnvTenantPgPoolFactory caching', () => {
  test('lazily builds pool on first access · caches subsequent calls', () => {
    const builds: string[] = [];
    const builder: PoolBuilder = {
      build: (conn) => {
        builds.push(conn);
        return stubPool(conn);
      },
    };
    const source = envConnectionStringSource({
      TENANT_MIBERA_DATABASE_URL: 'postgres://mibera/db',
    });
    const factory = buildEnvTenantPgPoolFactory(builder, source);

    const a = factory.poolForTenant('mibera');
    const b = factory.poolForTenant('mibera');
    expect(a).toBe(b);
    expect(builds).toEqual(['postgres://mibera/db']); // only ONE build
  });

  test('returns null without building when env is unset', () => {
    const builds: string[] = [];
    const builder: PoolBuilder = {
      build: (conn) => {
        builds.push(conn);
        return stubPool(conn);
      },
    };
    const source = envConnectionStringSource({});
    const factory = buildEnvTenantPgPoolFactory(builder, source);

    expect(factory.poolForTenant('mibera')).toBeNull();
    expect(builds).toHaveLength(0);
  });

  test('builds separate pools for different tenants', () => {
    const builds: string[] = [];
    const builder: PoolBuilder = {
      build: (conn) => {
        builds.push(conn);
        return stubPool(conn);
      },
    };
    const source = envConnectionStringSource({
      TENANT_MIBERA_DATABASE_URL: 'postgres://mibera/db',
      TENANT_CUBQUEST_DATABASE_URL: 'postgres://cubquest/db',
    });
    const factory = buildEnvTenantPgPoolFactory(builder, source);

    const mibera = factory.poolForTenant('mibera');
    const cubquest = factory.poolForTenant('cubquest');
    expect(mibera).not.toBe(cubquest);
    expect(builds).toEqual([
      'postgres://mibera/db',
      'postgres://cubquest/db',
    ]);
  });
});
