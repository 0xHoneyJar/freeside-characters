/**
 * auth-bridge-deps.ts — bot composition root for auth-bridge ports
 * (cycle-B sprint-1 review fix · PR #53 Blocker #1 + #8).
 *
 * Cross-reviewer flatline (PR #53 · CRITICAL Blocker #1): without dispatch
 * wiring, the auth-bridge module is dead code at runtime. This module
 * provides the boot-time hook (setAuthBridgeDeps) + the dispatch-time
 * accessor (getAuthBridgeDeps) that the dispatch layer consumes.
 *
 * Default deps are anon-only: tenant resolver returns null · dynamic lookup
 * returns null · mint throws. Combined with AUTH_BACKEND=anon (Lock-7
 * default), every interaction takes the short-circuit anon path. Operators
 * wire real ports at boot once @freeside-auth/* packages are bun-linked
 * (cycle-B B-1.5 gateway deploy ceremony).
 *
 * Storm warning (B#8 · cross-reviewer flatline #53): the default logger
 * wraps consoleLogger with a fallback counter that emits louder warnings
 * as anon-fallback events accumulate. Approximation of a circuit breaker
 * — operator-visible signal that gateway availability or midi profile
 * coverage may be degraded, even when individual interactions still work.
 */

import {
  consoleLogger,
  type AuthBridgeDeps,
  type AuthBridgeLogger,
  type DynamicUserIdLookupPort,
  type MintJwtPort,
  type TenantResolverPort,
} from './auth-bridge.ts';

// ---------------------------------------------------------------------------
// Default-anon ports (active when AUTH_BACKEND=anon · Lock-7 default)
// ---------------------------------------------------------------------------

const defaultTenantResolver: TenantResolverPort = {
  resolveTenantFromGuild: async () => null,
};

const defaultDynamicLookup: DynamicUserIdLookupPort = {
  fetchDynamicUserIdFromDiscord: async () => null,
};

const defaultMintJwt: MintJwtPort = {
  mintJwt: async () => {
    throw new Error(
      'MintJwtPort default-stub: AUTH_BACKEND=freeside-jwt requires ' +
        'bun-link of @freeside-auth/engine + setAuthBridgeDeps wired at boot ' +
        '(cycle-B B-1.5 gateway deploy ceremony).',
    );
  },
};

// ---------------------------------------------------------------------------
// Storm-aware logger · per cross-reviewer flatline #53 Blocker #8
// ---------------------------------------------------------------------------

interface StormState {
  count: number;
  last_warn_at_ms: number;
}

const STORM_THRESHOLD = 50;
const STORM_WARN_INTERVAL_MS = 5 * 60_000; // 5min

/**
 * Build a logger that tracks audit (anon-fallback) volume and emits a louder
 * STORM warning when fallbacks accumulate. The threshold (every Nth
 * fallback OR after the cooldown elapses with non-zero count) gives the
 * operator a clear signal in logs without spamming when fallbacks are
 * occasional.
 *
 * NOT a hard circuit breaker: Lock-7 anon-default keeps the bot functional
 * during outages. The warning is a telemetry surface for operators to
 * investigate (gateway 5xx · midi profile coverage gap · etc).
 */
export const buildStormAwareLogger = (
  base: AuthBridgeLogger = consoleLogger,
  state: StormState = { count: 0, last_warn_at_ms: 0 },
  thresholdEvery: number = STORM_THRESHOLD,
  warnIntervalMs: number = STORM_WARN_INTERVAL_MS,
): AuthBridgeLogger => ({
  info: base.info,
  warn: base.warn,
  audit: (m) => {
    base.audit(m);
    state.count++;
    const now = Date.now();
    const stormByCount = state.count % thresholdEvery === 0;
    const stormByCooldown =
      state.count > 0 && now - state.last_warn_at_ms > warnIntervalMs;
    if (stormByCount || stormByCooldown) {
      base.warn(
        `[auth-bridge:STORM] anon-fallback count=${state.count} since boot · ` +
          `operator may want to investigate gateway availability or midi profile coverage`,
      );
      state.last_warn_at_ms = now;
    }
  },
});

// ---------------------------------------------------------------------------
// Composition root accessors (set at boot · read at dispatch)
// ---------------------------------------------------------------------------

const defaultAnonDeps: AuthBridgeDeps = {
  tenantResolver: defaultTenantResolver,
  dynamicLookup: defaultDynamicLookup,
  mintJwt: defaultMintJwt,
  logger: buildStormAwareLogger(),
};

let activeDeps: AuthBridgeDeps = defaultAnonDeps;

/**
 * Bot main wires real deps here at boot. Default is anon-only · the verified
 * path engages when operator (a) bun-links @freeside-auth/protocol +
 * @freeside-auth/engine and (b) constructs real port impls + calls
 * setAuthBridgeDeps before dispatch fires.
 */
export const setAuthBridgeDeps = (deps: AuthBridgeDeps): void => {
  activeDeps = deps;
};

/**
 * Dispatch layer reads deps per interaction. The returned object is stable
 * for the process lifetime once setAuthBridgeDeps lands; before that, the
 * default-anon deps are returned.
 */
export const getAuthBridgeDeps = (): AuthBridgeDeps => activeDeps;

/**
 * Test reset · restores the default-anon deps. Production code never calls
 * this · it exists only for test isolation.
 */
export const __resetAuthBridgeDepsForTest = (): void => {
  activeDeps = defaultAnonDeps;
};
