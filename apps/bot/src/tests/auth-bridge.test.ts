/**
 * auth-bridge.test.ts — coverage of the 3 fail-modes + Lock-7 backend gate
 * + I6 tenant-boundary assertion (cycle-B · sprint-1 · B-1.6).
 *
 * Validates:
 *   - AC-B1.6 — attachAuthContext mints JWT for verified path · attaches anon
 *     for AUTH_BACKEND=anon · feature-flag protected
 *   - AC-B1.6.1 — fail-mode classification (public · verified-required ·
 *     verified-with-anon-fallback) · default = verified-required for
 *     unspecified routes (fail-closed)
 *   - AC-B1.11.1 — post-mint tenant-boundary assertion throws
 *     AuthBridgeError when mint returns wrong tenant (I6 invariant)
 *   - Logger discipline · audit-line emitted for every anon-fallback
 *
 * Test seam: `attachAuthContext` consumes 3 injected ports + a logger so the
 * suite never hits Discord, the freeside-auth orchestrator, or process.env
 * directly. Each `describe` block builds a recording stub set per case.
 */

import { describe, expect, test } from 'bun:test';
import {
  attachAuthContext,
  AuthBridgeError,
  DEFAULT_FAIL_MODE,
  resolveFailMode,
  readAuthBackend,
  SLICE_B_FAIL_MODES,
  type AuthBridgeLogger,
  type DynamicUserIdLookupPort,
  type FailMode,
  type InteractionContext,
  type JWTClaim,
  type MintJwtPort,
  type TenantResolverPort,
} from '../auth-bridge.ts';
import type { DiscordInteraction } from '../discord-interactions/types.ts';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const FIXTURE_DISCORD_ID = '111111111111111111';
const FIXTURE_GUILD_ID = '222222222222222222';
const FIXTURE_DYNAMIC_USER_ID = 'd-user-mibera-001';
const FIXTURE_INTERACTION_ID = '333333333333333333';

const buildCtx = (overrides: Partial<InteractionContext> = {}): InteractionContext => ({
  interaction_id: FIXTURE_INTERACTION_ID,
  guild_id: FIXTURE_GUILD_ID,
  discord_id: FIXTURE_DISCORD_ID,
  ...overrides,
});

const stubInteraction = {} as DiscordInteraction;

const buildClaims = (tenant: string = 'mibera'): JWTClaim => ({
  schema_version: '1.0',
  sub: FIXTURE_DYNAMIC_USER_ID,
  tenant,
  wallets: [{ chain: 'ethereum', address: '0xabc...123' }],
  iss: 'freeside-auth.0xhoneyjar.xyz',
  aud: tenant,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  jti: '00000000-0000-4000-8000-000000000001',
  v: 1,
});

interface RecordingLogger extends AuthBridgeLogger {
  readonly info_lines: string[];
  readonly warn_lines: string[];
  readonly audit_lines: string[];
}

const buildLogger = (): RecordingLogger => {
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

const tenantResolver = (mapping: Record<string, string | null>): TenantResolverPort => ({
  resolveTenantFromGuild: async (gid) =>
    gid in mapping ? mapping[gid] ?? null : null,
});

const dynamicLookup = (mapping: Record<string, string | null>): DynamicUserIdLookupPort => ({
  fetchDynamicUserIdFromDiscord: async (did) =>
    did in mapping ? mapping[did] ?? null : null,
});

interface MintCall {
  tenant_id: string;
  dynamic_user_id: string;
}

const mintJwtOk = (claims: JWTClaim, jwt = 'fake.jwt.token'): MintJwtPort & {
  readonly calls: MintCall[];
} => {
  const calls: MintCall[] = [];
  return {
    calls,
    mintJwt: async (input) => {
      calls.push(input);
      return { jwt, claims };
    },
  };
};

const mintJwtThrows = (err: Error = new Error('gateway 503')): MintJwtPort => ({
  mintJwt: async () => {
    throw err;
  },
});

// ---------------------------------------------------------------------------
// resolveFailMode + DEFAULT_FAIL_MODE (AC-B1.6.1 fail-closed default)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · fail-mode resolution (AC-B1.6.1)', () => {
  test('default for unspecified command is verified-required (fail-closed)', () => {
    expect(DEFAULT_FAIL_MODE).toBe('verified-required');
    expect(resolveFailMode('unknown-command-name')).toBe('verified-required');
  });

  test('SLICE_B_FAIL_MODES classifies the 5 slice-B commands explicitly', () => {
    expect(resolveFailMode('quest_list')).toBe('public');
    expect(resolveFailMode('quest')).toBe('verified-with-anon-fallback');
    expect(resolveFailMode('quest_accept')).toBe('verified-required');
    expect(resolveFailMode('quest_submit')).toBe('verified-required');
    expect(resolveFailMode('badge_issue')).toBe('verified-required');
  });

  test('custom registry overrides slice-B defaults', () => {
    const custom = new Map<string, FailMode>([['quest', 'public']]);
    expect(resolveFailMode('quest', custom)).toBe('public');
    // unknown still falls through to verified-required, not the slice-B default
    expect(resolveFailMode('unknown', custom)).toBe('verified-required');
  });
});

// ---------------------------------------------------------------------------
// readAuthBackend (Lock-7 feature flag · default anon)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · readAuthBackend (Lock-7)', () => {
  test('defaults to anon when AUTH_BACKEND is unset', () => {
    expect(readAuthBackend({}, buildLogger())).toBe('anon');
  });

  test('honors AUTH_BACKEND=anon', () => {
    expect(readAuthBackend({ AUTH_BACKEND: 'anon' }, buildLogger())).toBe('anon');
  });

  test('honors AUTH_BACKEND=freeside-jwt', () => {
    expect(readAuthBackend({ AUTH_BACKEND: 'freeside-jwt' }, buildLogger())).toBe(
      'freeside-jwt',
    );
  });

  test('unknown values fall back to anon WITH a warn log', () => {
    const logger = buildLogger();
    expect(readAuthBackend({ AUTH_BACKEND: 'magic-mode' }, logger)).toBe('anon');
    expect(logger.warn_lines).toHaveLength(1);
    expect(logger.warn_lines[0]).toContain('AUTH_BACKEND="magic-mode"');
  });

  test('whitespace is trimmed', () => {
    expect(readAuthBackend({ AUTH_BACKEND: '  freeside-jwt  ' }, buildLogger())).toBe(
      'freeside-jwt',
    );
  });
});

// ---------------------------------------------------------------------------
// attachAuthContext · anon paths (AUTH_BACKEND=anon · public route)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · anon paths', () => {
  test('AUTH_BACKEND=anon attaches anon ctx · skips tenant + mint resolution', async () => {
    const tenant = tenantResolver({});
    const lookup = dynamicLookup({});
    const mint = mintJwtOk(buildClaims());
    const logger = buildLogger();
    const ctx = buildCtx();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest_accept',
      deps: { tenantResolver: tenant, dynamicLookup: lookup, mintJwt: mint, logger },
      env: { AUTH_BACKEND: 'anon' },
    });

    expect(out.auth).toEqual({ kind: 'anon', discord_id: FIXTURE_DISCORD_ID });
    expect(mint.calls).toHaveLength(0);
    expect(logger.info_lines.some((l) => l.includes('→ ANON'))).toBe(true);
  });

  test('public route returns anon even when AUTH_BACKEND=freeside-jwt', async () => {
    const mint = mintJwtOk(buildClaims());
    const logger = buildLogger();
    const ctx = buildCtx();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest_list',
      deps: {
        tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
        dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
        mintJwt: mint,
        logger,
      },
      env: { AUTH_BACKEND: 'freeside-jwt' },
    });

    expect(out.auth?.kind).toBe('anon');
    expect(mint.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// attachAuthContext · verified path · happy case
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · verified path (mint succeeds)', () => {
  test('mints JWT · attaches verified ctx · I6 tenant assertion passes', async () => {
    const claims = buildClaims('mibera');
    const mint = mintJwtOk(claims, 'mibera.jwt.token');
    const logger = buildLogger();
    const ctx = buildCtx();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest_accept',
      deps: {
        tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
        dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
        mintJwt: mint,
        logger,
      },
      env: { AUTH_BACKEND: 'freeside-jwt' },
    });

    expect(out.auth).toEqual({ kind: 'verified', jwt: 'mibera.jwt.token', claims });
    expect(mint.calls).toEqual([
      { tenant_id: 'mibera', dynamic_user_id: FIXTURE_DYNAMIC_USER_ID },
    ]);
    expect(
      logger.info_lines.some(
        (l) => l.includes('→ VERIFIED') && l.includes('tenant=mibera'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-B1.11.1 · I6 tenant-boundary assertion (mint returns wrong tenant)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · I6 tenant-boundary assertion (AC-B1.11.1)', () => {
  test('mint returning tenant != expected throws AuthBridgeError', async () => {
    // Orchestrator mistakenly returns cubquest claims for a mibera mint
    const claims = buildClaims('cubquest');
    const mint = mintJwtOk(claims);
    const logger = buildLogger();
    const ctx = buildCtx();

    let caught: AuthBridgeError | null = null;
    try {
      await attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'quest_accept',
        deps: {
          tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
          dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
          mintJwt: mint,
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      });
    } catch (err) {
      caught = err as AuthBridgeError;
    }
    expect(caught).not.toBeNull();
    expect(caught).toBeInstanceOf(AuthBridgeError);
    expect(caught?.code).toBe('tenant_assertion_failed');
    expect(caught?.reason).toContain('cubquest');
    expect(caught?.reason).toContain('mibera');
    // ctx must NOT have a verified auth attached when the assertion fails
    expect(ctx.auth).toBeUndefined();
  });

  test('tenant_assertion_failed throws even on verified-with-anon-fallback routes', async () => {
    // Per I6 the assertion is non-negotiable · cannot silently fall back.
    const claims = buildClaims('cubquest');
    const mint = mintJwtOk(claims);
    const ctx = buildCtx();

    expect(
      attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'quest', // verified-with-anon-fallback in slice-B
        deps: {
          tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
          dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
          mintJwt: mint,
          logger: buildLogger(),
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      }),
    ).rejects.toThrow(AuthBridgeError);
  });
});

// ---------------------------------------------------------------------------
// AC-B1.6.1 · verified-required fail-closed (no silent anon downgrade)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · verified-required fail-closed', () => {
  test('no tenant binding throws AuthBridgeError (does NOT downgrade)', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    let caught: AuthBridgeError | null = null;
    try {
      await attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'quest_accept', // verified-required
        deps: {
          tenantResolver: tenantResolver({}), // no mapping → null
          dynamicLookup: dynamicLookup({}),
          mintJwt: mintJwtOk(buildClaims()),
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      });
    } catch (err) {
      caught = err as AuthBridgeError;
    }
    expect(caught?.code).toBe('no_tenant');
    expect(ctx.auth).toBeUndefined();
    expect(logger.warn_lines.some((l) => l.includes('FAIL-CLOSED'))).toBe(true);
    expect(logger.audit_lines).toHaveLength(0); // not an audited fallback
  });

  test('no dynamic_user_id throws AuthBridgeError', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    let caught: AuthBridgeError | null = null;
    try {
      await attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'badge_issue', // verified-required
        deps: {
          tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
          dynamicLookup: dynamicLookup({}), // no mapping → null
          mintJwt: mintJwtOk(buildClaims()),
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      });
    } catch (err) {
      caught = err as AuthBridgeError;
    }
    expect(caught?.code).toBe('no_dynamic_user');
    expect(ctx.auth).toBeUndefined();
  });

  test('mint orchestrator throw propagates as AuthBridgeError', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    let caught: AuthBridgeError | null = null;
    try {
      await attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'quest_submit', // verified-required
        deps: {
          tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
          dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
          mintJwt: mintJwtThrows(new Error('gateway 503 service unavailable')),
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      });
    } catch (err) {
      caught = err as AuthBridgeError;
    }
    expect(caught?.code).toBe('mint_failed');
    expect(caught?.reason).toContain('gateway 503');
    expect(ctx.auth).toBeUndefined();
  });

  test('unspecified command falls through to verified-required default', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    expect(
      attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'totally-new-command',
        deps: {
          tenantResolver: tenantResolver({}),
          dynamicLookup: dynamicLookup({}),
          mintJwt: mintJwtOk(buildClaims()),
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      }),
    ).rejects.toThrow(AuthBridgeError);
  });

  test('DM context (guild_id=null) fails closed with no_tenant', async () => {
    const ctx = buildCtx({ guild_id: null });
    const logger = buildLogger();

    let caught: AuthBridgeError | null = null;
    try {
      await attachAuthContext({
        interaction: stubInteraction,
        ctx,
        commandName: 'quest_accept',
        deps: {
          tenantResolver: tenantResolver({}),
          dynamicLookup: dynamicLookup({}),
          mintJwt: mintJwtOk(buildClaims()),
          logger,
        },
        env: { AUTH_BACKEND: 'freeside-jwt' },
      });
    } catch (err) {
      caught = err as AuthBridgeError;
    }
    expect(caught?.code).toBe('no_tenant');
    expect(caught?.reason).toContain('DM');
  });
});

// ---------------------------------------------------------------------------
// AC-B1.6.1 · verified-with-anon-fallback (audited downgrade)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · verified-with-anon-fallback (audited)', () => {
  test('no_dynamic_user → anon-fallback ctx with audit log', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest', // verified-with-anon-fallback in slice-B
      deps: {
        tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
        dynamicLookup: dynamicLookup({}), // no mapping
        mintJwt: mintJwtOk(buildClaims()),
        logger,
      },
      env: { AUTH_BACKEND: 'freeside-jwt' },
    });

    expect(out.auth).toEqual({
      kind: 'anon-fallback',
      discord_id: FIXTURE_DISCORD_ID,
      reason: 'no-dynamic-user',
    });
    expect(logger.audit_lines).toHaveLength(1);
    expect(logger.audit_lines[0]).toContain('fallback_reason=no-dynamic-user');
    expect(logger.audit_lines[0]).toContain(`user=${FIXTURE_DISCORD_ID}`);
  });

  test('no_tenant → anon-fallback ctx with audit log', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest',
      deps: {
        tenantResolver: tenantResolver({}), // no tenant binding
        dynamicLookup: dynamicLookup({}),
        mintJwt: mintJwtOk(buildClaims()),
        logger,
      },
      env: { AUTH_BACKEND: 'freeside-jwt' },
    });

    expect(out.auth?.kind).toBe('anon-fallback');
    if (out.auth?.kind === 'anon-fallback') {
      expect(out.auth.reason).toBe('no-tenant');
    }
    expect(logger.audit_lines[0]).toContain('fallback_reason=no-tenant');
  });

  test('mint_failed → anon-fallback ctx with audit log', async () => {
    const ctx = buildCtx();
    const logger = buildLogger();

    const out = await attachAuthContext({
      interaction: stubInteraction,
      ctx,
      commandName: 'quest',
      deps: {
        tenantResolver: tenantResolver({ [FIXTURE_GUILD_ID]: 'mibera' }),
        dynamicLookup: dynamicLookup({ [FIXTURE_DISCORD_ID]: FIXTURE_DYNAMIC_USER_ID }),
        mintJwt: mintJwtThrows(new Error('network timeout')),
        logger,
      },
      env: { AUTH_BACKEND: 'freeside-jwt' },
    });

    expect(out.auth?.kind).toBe('anon-fallback');
    if (out.auth?.kind === 'anon-fallback') {
      expect(out.auth.reason).toBe('mint-failed');
    }
    expect(logger.audit_lines[0]).toContain('fallback_reason=mint-failed');
    expect(logger.audit_lines[0]).toContain('network timeout');
  });
});

// ---------------------------------------------------------------------------
// SLICE_B_FAIL_MODES sanity (frozen invariants the slice-B sprint relies on)
// ---------------------------------------------------------------------------

describe('cycle-B · auth-bridge · SLICE_B_FAIL_MODES invariants', () => {
  test('quest_accept and quest_submit are verified-required (no fallback)', () => {
    expect(SLICE_B_FAIL_MODES.get('quest_accept')).toBe('verified-required');
    expect(SLICE_B_FAIL_MODES.get('quest_submit')).toBe('verified-required');
  });

  test('badge_issue is verified-required (BARTH safety · cannot anon-issue)', () => {
    expect(SLICE_B_FAIL_MODES.get('badge_issue')).toBe('verified-required');
  });

  test('quest_list is public (read-only metadata)', () => {
    expect(SLICE_B_FAIL_MODES.get('quest_list')).toBe('public');
  });
});
