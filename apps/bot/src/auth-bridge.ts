/**
 * auth-bridge.ts — session-start identity attach (cycle-B · sprint-1 · B-1.6).
 *
 * Per SDD §3.2.1 + §13.1-3: at the START of every Discord interaction the bot
 * resolves an AuthContext and attaches it to the per-interaction context object.
 * Downstream quest dispatch / Sietch / finn invoke read `ctx.auth` to make
 * authorization decisions.
 *
 * # The 3 fail-modes (per AC-B1.6.1)
 *
 * Each route declares its fail-mode. The bridge fails closed by default — any
 * unspecified command is treated as `verified-required`, which means missing
 * or invalid JWT raises `AuthBridgeError` and the dispatcher returns 401.
 *
 *   - `public`                     anon allowed (read-only quest list, public metadata)
 *   - `verified-required`          401 + structured error if no valid JWT
 *                                  (default · quest accept · quest submit · badge issue)
 *   - `verified-with-anon-fallback` audit-logged anon fallback (operator-supervised V1
 *                                  rollout for slice-B kickoff · ratchet to verified-required
 *                                  once midi profile coverage reaches threshold)
 *
 * # Lock-7 feature flag (`AUTH_BACKEND` env)
 *
 *   - `anon`           default · all interactions short-circuit to anon AuthContext.
 *                      Discord interactions remain functional with anon-tier permissions.
 *                      One-line revert path per architect Lock-7.
 *   - `freeside-jwt`   verified path · resolve tenant + lookup dynamic_user_id +
 *                      mint JWT via @freeside-auth/engine MintJWTOrchestrator.
 *
 * # Architect locks honored
 *
 *   - I2 (Cyberdeck Seam): this module is L4 boundary code · NEVER touches RPC
 *     directly · NEVER signs JWTs locally (delegation pattern per SDD §12.3).
 *   - I5 (Construct Purity): pure orchestration · all side effects (HTTP mint
 *     call, MCP user lookup, env reads) flow through injected ports so the
 *     module is unit-testable without a network.
 *   - I6 (Tenant-Boundary Assertion): every successful mint asserts
 *     `claims.tenant === expected_tenant` before returning.
 *   - Lock-7: AUTH_BACKEND env is the only kill switch.
 *   - Lock-8: V1 single-keypair · 1h JWT TTL · jti denylist deferred to V2 ·
 *     no revocation logic in this layer (verifier hook handles it upstream).
 *   - Lock-9: schema source-of-truth = JSON Schema. Local `JWTClaim` shape
 *     mirrors `@freeside-auth/protocol/jwt-claims.schema.json` until the bot
 *     workspace links the published package (B-1.8 deferred).
 *
 * # Cross-repo dep status
 *
 * `@freeside-auth/engine` lives at `~/Documents/GitHub/freeside-auth` and is
 * not yet bun-linked into this workspace (deferred to B-1.8). For B-1.6 we
 * declare the orchestrator surface as an injected port; the bot wires the
 * real `MintJWTOrchestrator` at boot once the link lands.
 */

import type { DiscordInteraction } from './discord-interactions/types.ts';

// ---------------------------------------------------------------------------
// Local schema mirror (Lock-9 · canonical = @freeside-auth/protocol)
// ---------------------------------------------------------------------------

/**
 * Wallet shape inside JWT claims. Mirrors `@freeside-auth/protocol/jwt-claims`
 * (chain enum + address). Local copy until B-1.8 bun-links the package; the
 * canonical source is the JSON Schema, this is just the TS binding the bot
 * consumes.
 */
export interface JWTWallet {
  readonly chain: 'ethereum' | 'berachain' | 'solana' | 'bitcoin';
  readonly address: string;
}

/**
 * JWT claim shape. Mirrors `JWTClaimSchema` in @freeside-auth/protocol. The
 * Rust gateway at loa-freeside/apps/gateway is the canonical signer; this
 * shape is what verifiers honor. Slice-B populates the required fields;
 * pool_id/byok/req_hash are reserved for execution-context (V2).
 */
export interface JWTClaim {
  readonly schema_version?: '1.0';
  readonly sub: string;
  readonly tenant: string;
  readonly wallets: readonly JWTWallet[];
  readonly iss: string;
  readonly aud: string;
  readonly exp: number;
  readonly iat: number;
  readonly jti: string;
  readonly v: 1;
  readonly tier?: 'public' | 'verified' | 'bearer' | 'initiate' | 'keeper';
  readonly display_name?: string;
  readonly discord_id?: string;
  readonly nft_id?: number;
}

// ---------------------------------------------------------------------------
// AuthContext discriminated union
// ---------------------------------------------------------------------------

/**
 * Anonymous interaction · default for `AUTH_BACKEND=anon` and for routes
 * declared `public`. discord_id is the only fact known about the invoker.
 */
export interface AuthAnon {
  readonly kind: 'anon';
  readonly discord_id: string;
}

/**
 * Verified interaction · JWT minted by freeside-auth orchestrator + signed
 * by loa-freeside/apps/gateway. claims.tenant has been asserted to match
 * the resolved guild's tenant_id (I6 invariant).
 */
export interface AuthVerified {
  readonly kind: 'verified';
  readonly jwt: string;
  readonly claims: JWTClaim;
}

/**
 * Anon-fallback · audit-logged downgrade from verified to anon. Only emitted
 * for routes declared `verified-with-anon-fallback`; never for the default
 * `verified-required` mode (which throws AuthBridgeError instead).
 *
 * `reason` enumerates the divergence so operators can ratchet the policy:
 *   - `no-tenant`       guild has no tenant binding (public discord guild)
 *   - `no-dynamic-user` invoker not yet onboarded via Dynamic SDK
 *   - `mint-failed`     orchestrator threw (gateway 5xx, network, etc)
 *   - `policy-fallback` route policy explicitly chose fallback
 */
export interface AuthAnonFallback {
  readonly kind: 'anon-fallback';
  readonly discord_id: string;
  readonly reason: 'no-tenant' | 'no-dynamic-user' | 'mint-failed' | 'policy-fallback';
}

export type AuthContext = AuthAnon | AuthVerified | AuthAnonFallback;

/**
 * Per-interaction context object. The bot constructs one of these at the top
 * of every interaction handler · auth-bridge attaches `auth` · downstream
 * quest dispatch and Sietch read it.
 *
 * Fields beyond `auth` are owned by their respective layers; this interface
 * is intentionally minimal so each consumer extends as needed.
 */
export interface InteractionContext {
  readonly interaction_id: string;
  readonly guild_id: string | null;
  readonly discord_id: string;
  auth?: AuthContext;
}

// ---------------------------------------------------------------------------
// Fail-mode classification (AC-B1.6.1)
// ---------------------------------------------------------------------------

/**
 * Per-route fail-mode. Default for unspecified routes is `verified-required`
 * (fail-closed by default · BARTH safety per SDD §13.1).
 */
export type FailMode =
  | 'public'
  | 'verified-required'
  | 'verified-with-anon-fallback';

export const DEFAULT_FAIL_MODE: FailMode = 'verified-required';

/**
 * Slice-B fail-mode registry. Operator extends as new commands ship.
 *
 * Mongolian B-1 ships `quest` as `verified-with-anon-fallback` to honor the
 * operator-supervised V1 rollout (mibera midi profile coverage is incomplete;
 * fallback gives anon-tier UX without breaking the flow). Once coverage hits
 * threshold the policy ratchets to `verified-required`.
 *
 * `quest_list` is `public` because reading available quests is metadata.
 */
export const SLICE_B_FAIL_MODES: ReadonlyMap<string, FailMode> = new Map([
  ['quest', 'verified-with-anon-fallback'],
  ['quest_list', 'public'],
  ['quest_accept', 'verified-required'],
  ['quest_submit', 'verified-required'],
  ['badge_issue', 'verified-required'],
]);

/**
 * Look up the fail-mode for a slash command name. Unknown commands fall back
 * to `DEFAULT_FAIL_MODE` (verified-required · fail-closed by default).
 */
export const resolveFailMode = (
  commandName: string,
  registry: ReadonlyMap<string, FailMode> = SLICE_B_FAIL_MODES,
): FailMode => registry.get(commandName) ?? DEFAULT_FAIL_MODE;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Verified-required route received no valid JWT. Caller maps to a 401-style
 * structured response · does NOT silently downgrade to anon.
 */
export class AuthBridgeError extends Error {
  constructor(
    public readonly code:
      | 'no_tenant'
      | 'no_dynamic_user'
      | 'mint_failed'
      | 'tenant_assertion_failed',
    public readonly reason: string,
    public readonly discord_id: string,
  ) {
    super(`auth-bridge: ${code} (${reason})`);
    this.name = 'AuthBridgeError';
  }
}

// ---------------------------------------------------------------------------
// Injectable ports (I5 Construct Purity)
// ---------------------------------------------------------------------------

/**
 * Tenant-resolution port. Wraps the world-manifest lookup added in B-1.7
 * (`resolveTenantFromGuild` extension to world-resolver.ts). Returns null
 * when the guild has no tenant binding (public Discord channel).
 */
export interface TenantResolverPort {
  resolveTenantFromGuild(guildId: string): Promise<string | null>;
}

/**
 * Dynamic SDK lookup port. Wraps the freeside_auth MCP tool that maps a
 * Discord user_id → Dynamic SDK dynamic_user_id (the canonical identity
 * key downstream consumers join on). Returns null for users not yet
 * onboarded.
 */
export interface DynamicUserIdLookupPort {
  fetchDynamicUserIdFromDiscord(discordId: string): Promise<string | null>;
}

/**
 * Mint orchestrator port. Wraps `@freeside-auth/engine` MintJWTOrchestrator's
 * `mintJwt({tenant_id, credential})` surface (per SDD §12.3 delegation
 * pattern: this layer constructs claims · loa-freeside/apps/gateway signs).
 *
 * Throws if the orchestrator can't resolve identity OR the gateway rejects
 * the issue request. Caller maps to AuthBridgeError or anon-fallback per
 * fail-mode.
 */
export interface MintJwtPort {
  mintJwt(input: {
    tenant_id: string;
    dynamic_user_id: string;
  }): Promise<{ jwt: string; claims: JWTClaim }>;
}

/**
 * Logger port. Default impl writes to console; tests inject a recording stub.
 */
export interface AuthBridgeLogger {
  info(message: string): void;
  warn(message: string): void;
  /**
   * Audit log · used for `verified-with-anon-fallback` downgrades. Operator
   * dashboards aggregate these to track midi profile coverage gaps.
   */
  audit(message: string): void;
}

export const consoleLogger: AuthBridgeLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  audit: (m) => console.log(`[auth-bridge:audit] ${m}`),
};

export interface AuthBridgeDeps {
  readonly tenantResolver: TenantResolverPort;
  readonly dynamicLookup: DynamicUserIdLookupPort;
  readonly mintJwt: MintJwtPort;
  readonly logger?: AuthBridgeLogger;
}

// ---------------------------------------------------------------------------
// Backend selection (Lock-7)
// ---------------------------------------------------------------------------

export type AuthBackend = 'anon' | 'freeside-jwt';

/**
 * Read `AUTH_BACKEND` env. Defaults to `anon` per Lock-7 · operator flips
 * each consumer independently to `freeside-jwt` after slice-B B-1.5 gateway
 * deploy verifies. Unknown values fall back to `anon` with a warning so
 * misconfiguration doesn't fail closed for the entire bot.
 */
export const readAuthBackend = (
  env: NodeJS.ProcessEnv = process.env,
  logger: AuthBridgeLogger = consoleLogger,
): AuthBackend => {
  const raw = (env.AUTH_BACKEND ?? 'anon').trim();
  if (raw === 'anon' || raw === 'freeside-jwt') return raw;
  logger.warn(
    `[auth-bridge] AUTH_BACKEND="${raw}" unrecognized · defaulting to anon (Lock-7 fallback)`,
  );
  return 'anon';
};

// ---------------------------------------------------------------------------
// Public entry · attachAuthContext
// ---------------------------------------------------------------------------

export interface AttachAuthOptions {
  readonly interaction: DiscordInteraction;
  readonly ctx: InteractionContext;
  readonly commandName: string;
  readonly deps: AuthBridgeDeps;
  /** Override `process.env` reads (test injection). */
  readonly env?: NodeJS.ProcessEnv;
  /** Override the fail-mode registry (test injection). */
  readonly failModes?: ReadonlyMap<string, FailMode>;
}

/**
 * Attach an AuthContext to the InteractionContext.
 *
 * Decision tree (matches AC-B1.6.1):
 *
 *   AUTH_BACKEND=anon
 *     → ctx.auth = anon
 *
 *   AUTH_BACKEND=freeside-jwt + fail_mode=public
 *     → ctx.auth = anon (route doesn't need verified)
 *
 *   AUTH_BACKEND=freeside-jwt + fail_mode=verified-required
 *     → resolve tenant + lookup dynamic_user_id + mint
 *     → on any failure throw AuthBridgeError (caller returns 401)
 *
 *   AUTH_BACKEND=freeside-jwt + fail_mode=verified-with-anon-fallback
 *     → resolve tenant + lookup dynamic_user_id + mint
 *     → on any failure audit-log + return anon-fallback context
 *
 * Throws `AuthBridgeError` only for verified-required failures. Anon and
 * anon-fallback paths never throw.
 */
export const attachAuthContext = async (
  opts: AttachAuthOptions,
): Promise<InteractionContext> => {
  const { interaction, ctx, commandName, deps } = opts;
  const logger = deps.logger ?? consoleLogger;
  const env = opts.env ?? process.env;
  const failModes = opts.failModes ?? SLICE_B_FAIL_MODES;
  const failMode = resolveFailMode(commandName, failModes);
  const backend = readAuthBackend(env, logger);
  const discord_id = ctx.discord_id;

  // ── Anon paths (Lock-7 default · or public route) ───────────────────
  if (backend === 'anon' || failMode === 'public') {
    ctx.auth = { kind: 'anon', discord_id };
    logger.info(
      `[auth-bridge] guild=${ctx.guild_id ?? 'dm'} user=${discord_id} ` +
        `cmd=${commandName} fail_mode=${failMode} → ANON ` +
        `(backend=${backend})`,
    );
    return ctx;
  }

  // ── Verified path (mint or fail per fail_mode) ──────────────────────
  if (!ctx.guild_id) {
    return handleVerifiedFailure({
      ctx,
      failMode,
      logger,
      code: 'no_tenant',
      reason: 'interaction has no guild_id (DM context · no tenant binding)',
      commandName,
      discord_id,
    });
  }

  const tenant_id = await deps.tenantResolver.resolveTenantFromGuild(ctx.guild_id);
  if (!tenant_id) {
    return handleVerifiedFailure({
      ctx,
      failMode,
      logger,
      code: 'no_tenant',
      reason: `guild ${ctx.guild_id} has no tenant binding`,
      commandName,
      discord_id,
    });
  }

  const dynamic_user_id = await deps.dynamicLookup.fetchDynamicUserIdFromDiscord(discord_id);
  if (!dynamic_user_id) {
    return handleVerifiedFailure({
      ctx,
      failMode,
      logger,
      code: 'no_dynamic_user',
      reason: `discord_id=${discord_id} not onboarded via Dynamic SDK (midi gap)`,
      commandName,
      discord_id,
    });
  }

  const mintStartedAt = Date.now();
  let mintResult: { jwt: string; claims: JWTClaim };
  try {
    mintResult = await deps.mintJwt.mintJwt({ tenant_id, dynamic_user_id });
  } catch (err) {
    return handleVerifiedFailure({
      ctx,
      failMode,
      logger,
      code: 'mint_failed',
      reason: `mint orchestrator threw: ${(err as Error)?.message ?? String(err)}`,
      commandName,
      discord_id,
    });
  }

  // I6 invariant · assert tenant boundary BEFORE attaching context
  if (mintResult.claims.tenant !== tenant_id) {
    throw new AuthBridgeError(
      'tenant_assertion_failed',
      `mint returned tenant=${mintResult.claims.tenant} but expected ${tenant_id}`,
      discord_id,
    );
  }

  ctx.auth = { kind: 'verified', jwt: mintResult.jwt, claims: mintResult.claims };
  logger.info(
    `[auth-bridge] guild=${ctx.guild_id} user=${discord_id} cmd=${commandName} ` +
      `→ VERIFIED tenant=${tenant_id} mint_ms=${Date.now() - mintStartedAt} ` +
      `jwt_exp=${new Date(mintResult.claims.exp * 1000).toISOString()}`,
  );
  // mark interaction as touched so eslint-no-unused doesn't flag the parameter
  // when this module is consumed by tests that supply minimal interaction stubs
  void interaction;
  return ctx;
};

// ---------------------------------------------------------------------------
// Failure handling per fail-mode
// ---------------------------------------------------------------------------

interface VerifiedFailureArgs {
  ctx: InteractionContext;
  failMode: FailMode;
  logger: AuthBridgeLogger;
  code: AuthBridgeError['code'];
  reason: string;
  commandName: string;
  discord_id: string;
}

const handleVerifiedFailure = (args: VerifiedFailureArgs): InteractionContext => {
  const { ctx, failMode, logger, code, reason, commandName, discord_id } = args;

  if (failMode === 'verified-required') {
    logger.warn(
      `[auth-bridge] FAIL-CLOSED guild=${ctx.guild_id ?? 'dm'} user=${discord_id} ` +
        `cmd=${commandName} code=${code} reason="${reason}"`,
    );
    throw new AuthBridgeError(code, reason, discord_id);
  }

  // verified-with-anon-fallback — audit log + return anon-fallback
  const fallbackReason = mapCodeToFallbackReason(code);
  logger.audit(
    `guild=${ctx.guild_id ?? 'dm'} user=${discord_id} cmd=${commandName} ` +
      `fallback_reason=${fallbackReason} code=${code} detail="${reason}"`,
  );
  ctx.auth = { kind: 'anon-fallback', discord_id, reason: fallbackReason };
  return ctx;
};

const mapCodeToFallbackReason = (
  code: AuthBridgeError['code'],
): AuthAnonFallback['reason'] => {
  switch (code) {
    case 'no_tenant':
      return 'no-tenant';
    case 'no_dynamic_user':
      return 'no-dynamic-user';
    case 'mint_failed':
      return 'mint-failed';
    case 'tenant_assertion_failed':
      // tenant_assertion_failed never reaches here because it ALWAYS throws
      // (I6 invariant · cannot fall back). Defensive default.
      return 'mint-failed';
  }
};
