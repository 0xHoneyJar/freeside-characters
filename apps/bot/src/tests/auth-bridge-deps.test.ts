/**
 * auth-bridge-deps.test.ts — coverage of the bot composition root for
 * auth-bridge ports + storm-aware logger (cycle-B sprint-1 review fix ·
 * PR #53 Blocker #1 + #8).
 *
 * Validates:
 *   - default-anon deps surface (tenant resolver returns null · dynamic
 *     lookup returns null · mint throws · logger present)
 *   - setAuthBridgeDeps replaces the active deps · getAuthBridgeDeps
 *     returns the wired deps for downstream dispatch
 *   - __resetAuthBridgeDepsForTest restores defaults
 *   - storm-aware logger emits STORM warning every Nth fallback +
 *     emits another STORM warning after the cooldown elapses with
 *     non-zero count
 *   - storm logger does NOT emit STORM warning before the threshold
 */

import { describe, expect, test } from 'bun:test';
import {
  __resetAuthBridgeDepsForTest,
  buildStormAwareLogger,
  getAuthBridgeDeps,
  setAuthBridgeDeps,
} from '../auth-bridge-deps.ts';
import type { AuthBridgeDeps, AuthBridgeLogger } from '../auth-bridge.ts';

const buildRecordingLogger = (): AuthBridgeLogger & {
  info_lines: string[];
  warn_lines: string[];
  audit_lines: string[];
} => {
  const info_lines: string[] = [];
  const warn_lines: string[] = [];
  const audit_lines: string[] = [];
  return {
    info_lines,
    warn_lines,
    audit_lines,
    info: (m) => info_lines.push(m),
    warn: (m) => warn_lines.push(m),
    audit: (m) => audit_lines.push(m),
  };
};

describe('cycle-B · auth-bridge-deps · default-anon deps', () => {
  test('default tenantResolver returns null for any guild', async () => {
    __resetAuthBridgeDepsForTest();
    const deps = getAuthBridgeDeps();
    const result = await deps.tenantResolver.resolveTenantFromGuild('any-guild');
    expect(result).toBeNull();
  });

  test('default dynamicLookup returns null for any discord_id', async () => {
    __resetAuthBridgeDepsForTest();
    const deps = getAuthBridgeDeps();
    const result = await deps.dynamicLookup.fetchDynamicUserIdFromDiscord('any');
    expect(result).toBeNull();
  });

  test('default mintJwt throws structured error pointing at bun-link gate', async () => {
    __resetAuthBridgeDepsForTest();
    const deps = getAuthBridgeDeps();
    await expect(
      deps.mintJwt.mintJwt({ tenant_id: 'mibera', dynamic_user_id: 'x' }),
    ).rejects.toThrow(/bun-link.*@freeside-auth\/engine/);
  });

  test('default logger is present (storm-aware wrapper)', () => {
    __resetAuthBridgeDepsForTest();
    const deps = getAuthBridgeDeps();
    expect(typeof deps.logger?.info).toBe('function');
    expect(typeof deps.logger?.audit).toBe('function');
  });
});

describe('cycle-B · auth-bridge-deps · setAuthBridgeDeps wiring', () => {
  test('setAuthBridgeDeps replaces active deps · getAuthBridgeDeps reads back', async () => {
    __resetAuthBridgeDepsForTest();
    const customResolver = {
      resolveTenantFromGuild: async (gid: string) =>
        gid === 'guild-mibera' ? 'mibera' : null,
    };
    const customDeps: AuthBridgeDeps = {
      tenantResolver: customResolver,
      dynamicLookup: { fetchDynamicUserIdFromDiscord: async () => 'd-user-xyz' },
      mintJwt: { mintJwt: async () => ({ jwt: 'stub.jwt', claims: {} as never }) },
    };
    setAuthBridgeDeps(customDeps);

    const deps = getAuthBridgeDeps();
    expect(await deps.tenantResolver.resolveTenantFromGuild('guild-mibera')).toBe(
      'mibera',
    );
    expect(await deps.dynamicLookup.fetchDynamicUserIdFromDiscord('any')).toBe(
      'd-user-xyz',
    );
    expect((await deps.mintJwt.mintJwt({ tenant_id: 'mibera', dynamic_user_id: 'x' })).jwt).toBe(
      'stub.jwt',
    );

    __resetAuthBridgeDepsForTest();
  });

  test('__resetAuthBridgeDepsForTest restores default-anon path', async () => {
    setAuthBridgeDeps({
      tenantResolver: { resolveTenantFromGuild: async () => 'cubquest' },
      dynamicLookup: { fetchDynamicUserIdFromDiscord: async () => 'd-cub' },
      mintJwt: { mintJwt: async () => ({ jwt: 'cub.jwt', claims: {} as never }) },
    });
    __resetAuthBridgeDepsForTest();
    const deps = getAuthBridgeDeps();
    expect(await deps.tenantResolver.resolveTenantFromGuild('any')).toBeNull();
  });
});

describe('cycle-B · auth-bridge-deps · storm-aware logger (PR #53 Blocker #8)', () => {
  test('emits no STORM warning when audit count is below threshold', () => {
    const base = buildRecordingLogger();
    const logger = buildStormAwareLogger(
      base,
      { count: 0, last_warn_at_ms: Date.now() },
      10,
      60_000,
    );

    for (let i = 0; i < 5; i++) {
      logger.audit(`fallback #${i + 1}`);
    }
    expect(base.audit_lines).toHaveLength(5);
    expect(base.warn_lines).toHaveLength(0);
  });

  test('emits STORM warning every Nth audit (count-based threshold)', () => {
    const base = buildRecordingLogger();
    const logger = buildStormAwareLogger(
      base,
      { count: 0, last_warn_at_ms: Date.now() },
      10, // every 10th
      60_000,
    );

    for (let i = 0; i < 25; i++) {
      logger.audit(`fallback #${i + 1}`);
    }
    expect(base.audit_lines).toHaveLength(25);
    // Audit count crosses 10 and 20 · two STORM warnings expected
    expect(base.warn_lines.length).toBeGreaterThanOrEqual(2);
    expect(
      base.warn_lines.every((l) => l.includes('[auth-bridge:STORM]')),
    ).toBe(true);
    expect(base.warn_lines[0]).toContain('count=10');
    expect(base.warn_lines[1]).toContain('count=20');
  });

  test('emits STORM warning after cooldown elapses with non-zero count', () => {
    const base = buildRecordingLogger();
    const state = { count: 0, last_warn_at_ms: Date.now() - 10 * 60_000 }; // 10min ago
    const logger = buildStormAwareLogger(
      base,
      state,
      1000, // high threshold so count-based rule won't fire
      5 * 60_000, // 5min cooldown
    );

    // Single fallback after cooldown elapsed → STORM warning fires
    logger.audit('fallback #1');
    expect(base.warn_lines).toHaveLength(1);
    expect(base.warn_lines[0]).toContain('count=1');
  });

  test('STORM warning does not double-emit when both rules trigger same call', () => {
    const base = buildRecordingLogger();
    const state = { count: 0, last_warn_at_ms: Date.now() - 10 * 60_000 };
    const logger = buildStormAwareLogger(base, state, 1, 5 * 60_000);

    // count threshold = every 1st AND cooldown elapsed → would warn twice
    // if we didn't guard against it
    logger.audit('fallback #1');
    expect(base.warn_lines).toHaveLength(1);
  });

  test('preserves info + warn passthrough', () => {
    const base = buildRecordingLogger();
    const logger = buildStormAwareLogger(base);

    logger.info('hello');
    logger.warn('uh oh');
    expect(base.info_lines).toEqual(['hello']);
    expect(base.warn_lines).toEqual(['uh oh']);
  });
});
