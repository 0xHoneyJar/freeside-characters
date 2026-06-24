/**
 * world-resolver.test.ts — coverage for tenant + auth-backend extensions
 * (cycle-B · sprint-1 · B-1.7).
 *
 * Validates:
 *   - resolveTenantFromGuild returns tenant_id for matched worlds
 *   - resolveTenantFromGuild returns null for unmatched guilds (auth-bridge
 *     decides fail-closed vs anon-fallback per route)
 *   - resolveTenantFromGuild returns null when matched world has no
 *     tenant_id field (cycle-Q v1.0 manifest forward-compat)
 *   - resolveAuthBackendForGuild defaults to 'anon' for unmatched and for
 *     worlds without auth.backend declaration
 *   - resolveAuthBackendForGuild returns the manifest's declared backend
 *   - First-match-wins ordering for guilds claimed by multiple worlds
 *     (operator-controlled via manifest declaration order)
 */

import { describe, expect, test } from 'bun:test';
import {
  resolveAuthBackendForGuild,
  resolveTenantFromGuild,
  type WorldManifestQuestSubset,
} from '../world-resolver.ts';

const MIBERA_GUILD = '111111111111111111';
const CUBQUEST_GUILD = '222222222222222222';
const ANON_GUILD = '333333333333333333';
const SHARED_GUILD = '999999999999999999';

const miberaWorld: WorldManifestQuestSubset = {
  slug: 'mibera',
  tenant_id: 'mibera',
  guild_ids: [MIBERA_GUILD, SHARED_GUILD],
  auth: { backend: 'freeside-jwt' },
  quest_namespace: 'mibera',
  quest_engine_config: {
    questAcceptanceMode: 'auth-required',
    submissionStyle: 'inline_thread',
    positiveFrictionDelayMs: 12000,
  },
};

const cubquestWorld: WorldManifestQuestSubset = {
  slug: 'cubquest',
  tenant_id: 'cubquest',
  guild_ids: [CUBQUEST_GUILD, SHARED_GUILD],
  auth: { backend: 'freeside-jwt' },
};

// cycle-Q v1.0 shape · no tenant_id, no auth.backend
const legacyMongolianWorld: WorldManifestQuestSubset = {
  slug: 'mongolian',
  guild_ids: [ANON_GUILD],
};

describe('cycle-B · world-resolver · resolveTenantFromGuild (B-1.7)', () => {
  test('returns tenant_id for matched world', () => {
    expect(resolveTenantFromGuild(MIBERA_GUILD, [miberaWorld, cubquestWorld])).toBe(
      'mibera',
    );
    expect(resolveTenantFromGuild(CUBQUEST_GUILD, [miberaWorld, cubquestWorld])).toBe(
      'cubquest',
    );
  });

  test('returns null for unmatched guild', () => {
    expect(resolveTenantFromGuild('444444444444444444', [miberaWorld])).toBeNull();
  });

  test('returns null for matched world without tenant_id (cycle-Q v1.0 forward-compat)', () => {
    expect(resolveTenantFromGuild(ANON_GUILD, [legacyMongolianWorld])).toBeNull();
  });

  test('returns null for empty manifest list', () => {
    expect(resolveTenantFromGuild(MIBERA_GUILD, [])).toBeNull();
  });

  test('first-match-wins for guilds claimed by multiple worlds', () => {
    // mibera comes first in the list → claims SHARED_GUILD
    expect(resolveTenantFromGuild(SHARED_GUILD, [miberaWorld, cubquestWorld])).toBe(
      'mibera',
    );
    // reverse the list · cubquest claims SHARED_GUILD
    expect(resolveTenantFromGuild(SHARED_GUILD, [cubquestWorld, miberaWorld])).toBe(
      'cubquest',
    );
  });

  test('skips manifests with no guild_ids', () => {
    const noGuilds: WorldManifestQuestSubset = {
      slug: 'no-guild-world',
      tenant_id: 'orphan',
    };
    expect(resolveTenantFromGuild(MIBERA_GUILD, [noGuilds, miberaWorld])).toBe(
      'mibera',
    );
  });
});

describe('cycle-B · world-resolver · resolveAuthBackendForGuild (B-1.7)', () => {
  test("returns world's declared backend for matched guild", () => {
    expect(resolveAuthBackendForGuild(MIBERA_GUILD, [miberaWorld])).toBe('freeside-jwt');
    expect(resolveAuthBackendForGuild(CUBQUEST_GUILD, [cubquestWorld])).toBe(
      'freeside-jwt',
    );
  });

  test("defaults to 'anon' for unmatched guild", () => {
    expect(resolveAuthBackendForGuild('444444444444444444', [miberaWorld])).toBe(
      'anon',
    );
  });

  test("defaults to 'anon' for matched world without auth.backend", () => {
    expect(resolveAuthBackendForGuild(ANON_GUILD, [legacyMongolianWorld])).toBe('anon');
  });

  test("defaults to 'anon' for empty manifest list", () => {
    expect(resolveAuthBackendForGuild(MIBERA_GUILD, [])).toBe('anon');
  });
});
