# PR #53 — Cycle-B Sprint-1: auth-bridge + tenant resolver + production runtime

**Repo**: 0xHoneyJar/freeside-characters
**Branch**: feature/cycle-b-sprint-1-auth-bridge → main
**Commits**: bcc76d7 (auth-bridge B-1.6) · 74668c2 (world-resolver tenant ext B-1.7) · 5b2514a (quest-runtime production B-1.8)
**Stats**: 8 files changed · +1960 / -6

## Architectural Locks (must validate)

- **I2 Cyberdeck Seam**: auth-bridge is L4 boundary. NEVER makes RPC calls. Delegates JWT signing to gateway via injected `@freeside-auth/engine` port.
- **I5 Construct Purity**: `pg` dependency confined to `apps/bot/src/lib/pg-pool-builder.ts`. Runtime is pure (no direct pg imports outside the pool builder).
- **I6 Tenant-Boundary Assertion**: Post-mint, `claims.tenant === expected_tenant` must hold or throws `AuthBridgeError`. Prevents cross-tenant identity confusion.
- **Lock-7**: `AUTH_BACKEND` env var defaults to `anon`. 1-line revert capability. `QUEST_RUNTIME` composes orthogonally.
- **Lock-9**: `pg.Pool` exposed as **structural type shim** (no `@types/pg` dependency added).

## Cross-Repo Contracts

- `@freeside-auth/engine` declared as **injected port**. Operator wires real orchestrator post `bun link`.
- 124 tests passing (auth-bridge: 24, world-resolver: 10, quest-runtime: 18, baseline: 72). Typecheck clean.

## Three Failure Modes (auth-bridge)

1. Anonymous fallback (Lock-7 default)
2. Backend unreachable → `AuthBridgeError('AUTH_BACKEND_UNREACHABLE')`
3. Tenant mismatch (I6) → `AuthBridgeError('TENANT_MISMATCH')`

diff --git a/apps/bot/src/auth-bridge.ts b/apps/bot/src/auth-bridge.ts
new file mode 100644
index 0000000..8a45a53
--- /dev/null
+++ b/apps/bot/src/auth-bridge.ts
@@ -0,0 +1,491 @@
+/**
+ * auth-bridge.ts — session-start identity attach (cycle-B · sprint-1 · B-1.6).
+ *
+ * Per SDD §3.2.1 + §13.1-3: at the START of every Discord interaction the bot
+ * resolves an AuthContext and attaches it to the per-interaction context object.
+ * Downstream quest dispatch / Sietch / finn invoke read `ctx.auth` to make
+ * authorization decisions.
+ *
+ * # The 3 fail-modes (per AC-B1.6.1)
+ *
+ * Each route declares its fail-mode. The bridge fails closed by default — any
+ * unspecified command is treated as `verified-required`, which means missing
+ * or invalid JWT raises `AuthBridgeError` and the dispatcher returns 401.
+ *
+ *   - `public`                     anon allowed (read-only quest list, public metadata)
+ *   - `verified-required`          401 + structured error if no valid JWT
+ *                                  (default · quest accept · quest submit · badge issue)
+ *   - `verified-with-anon-fallback` audit-logged anon fallback (operator-supervised V1
+ *                                  rollout for slice-B kickoff · ratchet to verified-required
+ *                                  once midi profile coverage reaches threshold)
+ *
+ * # Lock-7 feature flag (`AUTH_BACKEND` env)
+ *
+ *   - `anon`           default · all interactions short-circuit to anon AuthContext.
+ *                      Discord interactions remain functional with anon-tier permissions.
+ *                      One-line revert path per architect Lock-7.
+ *   - `freeside-jwt`   verified path · resolve tenant + lookup dynamic_user_id +
+ *                      mint JWT via @freeside-auth/engine MintJWTOrchestrator.
+ *
+ * # Architect locks honored
+ *
+ *   - I2 (Cyberdeck Seam): this module is L4 boundary code · NEVER touches RPC
+ *     directly · NEVER signs JWTs locally (delegation pattern per SDD §12.3).
+ *   - I5 (Construct Purity): pure orchestration · all side effects (HTTP mint
+ *     call, MCP user lookup, env reads) flow through injected ports so the
+ *     module is unit-testable without a network.
+ *   - I6 (Tenant-Boundary Assertion): every successful mint asserts
+ *     `claims.tenant === expected_tenant` before returning.
+ *   - Lock-7: AUTH_BACKEND env is the only kill switch.
+ *   - Lock-8: V1 single-keypair · 1h JWT TTL · jti denylist deferred to V2 ·
+ *     no revocation logic in this layer (verifier hook handles it upstream).
+ *   - Lock-9: schema source-of-truth = JSON Schema. Local `JWTClaim` shape
+ *     mirrors `@freeside-auth/protocol/jwt-claims.schema.json` until the bot
+ *     workspace links the published package (B-1.8 deferred).
+ *
+ * # Cross-repo dep status
+ *
+ * `@freeside-auth/engine` lives at `~/Documents/GitHub/freeside-auth` and is
+ * not yet bun-linked into this workspace (deferred to B-1.8). For B-1.6 we
+ * declare the orchestrator surface as an injected port; the bot wires the
+ * real `MintJWTOrchestrator` at boot once the link lands.
+ */
+
+import type { DiscordInteraction } from './discord-interactions/types.ts';
+
+// ---------------------------------------------------------------------------
+// Local schema mirror (Lock-9 · canonical = @freeside-auth/protocol)
+// ---------------------------------------------------------------------------
+
+/**
+ * Wallet shape inside JWT claims. Mirrors `@freeside-auth/protocol/jwt-claims`
+ * (chain enum + address). Local copy until B-1.8 bun-links the package; the
+ * canonical source is the JSON Schema, this is just the TS binding the bot
+ * consumes.
+ */
+export interface JWTWallet {
+  readonly chain: 'ethereum' | 'berachain' | 'solana' | 'bitcoin';
+  readonly address: string;
+}
+
+/**
+ * JWT claim shape. Mirrors `JWTClaimSchema` in @freeside-auth/protocol. The
+ * Rust gateway at loa-freeside/apps/gateway is the canonical signer; this
+ * shape is what verifiers honor. Slice-B populates the required fields;
+ * pool_id/byok/req_hash are reserved for execution-context (V2).
+ */
+export interface JWTClaim {
+  readonly schema_version?: '1.0';
+  readonly sub: string;
+  readonly tenant: string;
+  readonly wallets: readonly JWTWallet[];
+  readonly iss: string;
+  readonly aud: string;
+  readonly exp: number;
+  readonly iat: number;
+  readonly jti: string;
+  readonly v: 1;
+  readonly tier?: 'public' | 'verified' | 'bearer' | 'initiate' | 'keeper';
+  readonly display_name?: string;
+  readonly discord_id?: string;
+  readonly nft_id?: number;
+}
+
+// ---------------------------------------------------------------------------
+// AuthContext discriminated union
+// ---------------------------------------------------------------------------
+
+/**
+ * Anonymous interaction · default for `AUTH_BACKEND=anon` and for routes
+ * declared `public`. discord_id is the only fact known about the invoker.
+ */
+export interface AuthAnon {
+  readonly kind: 'anon';
+  readonly discord_id: string;
+}
+
+/**
+ * Verified interaction · JWT minted by freeside-auth orchestrator + signed
+ * by loa-freeside/apps/gateway. claims.tenant has been asserted to match
+ * the resolved guild's tenant_id (I6 invariant).
+ */
+export interface AuthVerified {
+  readonly kind: 'verified';
+  readonly jwt: string;
+  readonly claims: JWTClaim;
+}
+
+/**
+ * Anon-fallback · audit-logged downgrade from verified to anon. Only emitted
+ * for routes declared `verified-with-anon-fallback`; never for the default
+ * `verified-required` mode (which throws AuthBridgeError instead).
+ *
+ * `reason` enumerates the divergence so operators can ratchet the policy:
+ *   - `no-tenant`       guild has no tenant binding (public discord guild)
+ *   - `no-dynamic-user` invoker not yet onboarded via Dynamic SDK
+ *   - `mint-failed`     orchestrator threw (gateway 5xx, network, etc)
+ *   - `policy-fallback` route policy explicitly chose fallback
+ */
+export interface AuthAnonFallback {
+  readonly kind: 'anon-fallback';
+  readonly discord_id: string;
+  readonly reason: 'no-tenant' | 'no-dynamic-user' | 'mint-failed' | 'policy-fallback';
+}
+
+export type AuthContext = AuthAnon | AuthVerified | AuthAnonFallback;
+
+/**
+ * Per-interaction context object. The bot constructs one of these at the top
+ * of every interaction handler · auth-bridge attaches `auth` · downstream
+ * quest dispatch and Sietch read it.
+ *
+ * Fields beyond `auth` are owned by their respective layers; this interface
+ * is intentionally minimal so each consumer extends as needed.
+ */
+export interface InteractionContext {
+  readonly interaction_id: string;
+  readonly guild_id: string | null;
+  readonly discord_id: string;
+  auth?: AuthContext;
+}
+
+// ---------------------------------------------------------------------------
+// Fail-mode classification (AC-B1.6.1)
+// ---------------------------------------------------------------------------
+
+/**
+ * Per-route fail-mode. Default for unspecified routes is `verified-required`
+ * (fail-closed by default · BARTH safety per SDD §13.1).
+ */
+export type FailMode =
+  | 'public'
+  | 'verified-required'
+  | 'verified-with-anon-fallback';
+
+export const DEFAULT_FAIL_MODE: FailMode = 'verified-required';
+
+/**
+ * Slice-B fail-mode registry. Operator extends as new commands ship.
+ *
+ * Mongolian B-1 ships `quest` as `verified-with-anon-fallback` to honor the
+ * operator-supervised V1 rollout (mibera midi profile coverage is incomplete;
+ * fallback gives anon-tier UX without breaking the flow). Once coverage hits
+ * threshold the policy ratchets to `verified-required`.
+ *
+ * `quest_list` is `public` because reading available quests is metadata.
+ */
+export const SLICE_B_FAIL_MODES: ReadonlyMap<string, FailMode> = new Map([
+  ['quest', 'verified-with-anon-fallback'],
+  ['quest_list', 'public'],
+  ['quest_accept', 'verified-required'],
+  ['quest_submit', 'verified-required'],
+  ['badge_issue', 'verified-required'],
+]);
+
+/**
+ * Look up the fail-mode for a slash command name. Unknown commands fall back
+ * to `DEFAULT_FAIL_MODE` (verified-required · fail-closed by default).
+ */
+export const resolveFailMode = (
+  commandName: string,
+  registry: ReadonlyMap<string, FailMode> = SLICE_B_FAIL_MODES,
+): FailMode => registry.get(commandName) ?? DEFAULT_FAIL_MODE;
+
+// ---------------------------------------------------------------------------
+// Errors
+// ---------------------------------------------------------------------------
+
+/**
+ * Verified-required route received no valid JWT. Caller maps to a 401-style
+ * structured response · does NOT silently downgrade to anon.
+ */
+export class AuthBridgeError extends Error {
+  constructor(
+    public readonly code:
+      | 'no_tenant'
+      | 'no_dynamic_user'
+      | 'mint_failed'
+      | 'tenant_assertion_failed',
+    public readonly reason: string,
+    public readonly discord_id: string,
+  ) {
+    super(`auth-bridge: ${code} (${reason})`);
+    this.name = 'AuthBridgeError';
+  }
+}
+
+// ---------------------------------------------------------------------------
+// Injectable ports (I5 Construct Purity)
+// ---------------------------------------------------------------------------
+
+/**
+ * Tenant-resolution port. Wraps the world-manifest lookup added in B-1.7
+ * (`resolveTenantFromGuild` extension to world-resolver.ts). Returns null
+ * when the guild has no tenant binding (public Discord channel).
+ */
+export interface TenantResolverPort {
+  resolveTenantFromGuild(guildId: string): Promise<string | null>;
+}
+
+/**
+ * Dynamic SDK lookup port. Wraps the freeside_auth MCP tool that maps a
+ * Discord user_id → Dynamic SDK dynamic_user_id (the canonical identity
+ * key downstream consumers join on). Returns null for users not yet
+ * onboarded.
+ */
+export interface DynamicUserIdLookupPort {
+  fetchDynamicUserIdFromDiscord(discordId: string): Promise<string | null>;
+}
+
+/**
+ * Mint orchestrator port. Wraps `@freeside-auth/engine` MintJWTOrchestrator's
+ * `mintJwt({tenant_id, credential})` surface (per SDD §12.3 delegation
+ * pattern: this layer constructs claims · loa-freeside/apps/gateway signs).
+ *
+ * Throws if the orchestrator can't resolve identity OR the gateway rejects
+ * the issue request. Caller maps to AuthBridgeError or anon-fallback per
+ * fail-mode.
+ */
+export interface MintJwtPort {
+  mintJwt(input: {
+    tenant_id: string;
+    dynamic_user_id: string;
+  }): Promise<{ jwt: string; claims: JWTClaim }>;
+}
+
+/**
+ * Logger port. Default impl writes to console; tests inject a recording stub.
+ */
+export interface AuthBridgeLogger {
+  info(message: string): void;
+  warn(message: string): void;
+  /**
+   * Audit log · used for `verified-with-anon-fallback` downgrades. Operator
+   * dashboards aggregate these to track midi profile coverage gaps.
+   */
+  audit(message: string): void;
+}
+
+export const consoleLogger: AuthBridgeLogger = {
+  info: (m) => console.log(m),
+  warn: (m) => console.warn(m),
+  audit: (m) => console.log(`[auth-bridge:audit] ${m}`),
+};
+
+export interface AuthBridgeDeps {
+  readonly tenantResolver: TenantResolverPort;
+  readonly dynamicLookup: DynamicUserIdLookupPort;
+  readonly mintJwt: MintJwtPort;
+  readonly logger?: AuthBridgeLogger;
+}
+
+// ---------------------------------------------------------------------------
+// Backend selection (Lock-7)
+// ---------------------------------------------------------------------------
+
+export type AuthBackend = 'anon' | 'freeside-jwt';
+
+/**
+ * Read `AUTH_BACKEND` env. Defaults to `anon` per Lock-7 · operator flips
+ * each consumer independently to `freeside-jwt` after slice-B B-1.5 gateway
+ * deploy verifies. Unknown values fall back to `anon` with a warning so
+ * misconfiguration doesn't fail closed for the entire bot.
+ */
+export const readAuthBackend = (
+  env: NodeJS.ProcessEnv = process.env,
+  logger: AuthBridgeLogger = consoleLogger,
+): AuthBackend => {
+  const raw = (env.AUTH_BACKEND ?? 'anon').trim();
+  if (raw === 'anon' || raw === 'freeside-jwt') return raw;
+  logger.warn(
+    `[auth-bridge] AUTH_BACKEND="${raw}" unrecognized · defaulting to anon (Lock-7 fallback)`,
+  );
+  return 'anon';
+};
+
+// ---------------------------------------------------------------------------
+// Public entry · attachAuthContext
+// ---------------------------------------------------------------------------
+
+export interface AttachAuthOptions {
+  readonly interaction: DiscordInteraction;
+  readonly ctx: InteractionContext;
+  readonly commandName: string;
+  readonly deps: AuthBridgeDeps;
+  /** Override `process.env` reads (test injection). */
+  readonly env?: NodeJS.ProcessEnv;
+  /** Override the fail-mode registry (test injection). */
+  readonly failModes?: ReadonlyMap<string, FailMode>;
+}
+
+/**
+ * Attach an AuthContext to the InteractionContext.
+ *
+ * Decision tree (matches AC-B1.6.1):
+ *
+ *   AUTH_BACKEND=anon
+ *     → ctx.auth = anon
+ *
+ *   AUTH_BACKEND=freeside-jwt + fail_mode=public
+ *     → ctx.auth = anon (route doesn't need verified)
+ *
+ *   AUTH_BACKEND=freeside-jwt + fail_mode=verified-required
+ *     → resolve tenant + lookup dynamic_user_id + mint
+ *     → on any failure throw AuthBridgeError (caller returns 401)
+ *
+ *   AUTH_BACKEND=freeside-jwt + fail_mode=verified-with-anon-fallback
+ *     → resolve tenant + lookup dynamic_user_id + mint
+ *     → on any failure audit-log + return anon-fallback context
+ *
+ * Throws `AuthBridgeError` only for verified-required failures. Anon and
+ * anon-fallback paths never throw.
+ */
+export const attachAuthContext = async (
+  opts: AttachAuthOptions,
+): Promise<InteractionContext> => {
+  const { interaction, ctx, commandName, deps } = opts;
+  const logger = deps.logger ?? consoleLogger;
+  const env = opts.env ?? process.env;
+  const failModes = opts.failModes ?? SLICE_B_FAIL_MODES;
+  const failMode = resolveFailMode(commandName, failModes);
+  const backend = readAuthBackend(env, logger);
+  const discord_id = ctx.discord_id;
+
+  // ── Anon paths (Lock-7 default · or public route) ───────────────────
+  if (backend === 'anon' || failMode === 'public') {
+    ctx.auth = { kind: 'anon', discord_id };
+    logger.info(
+      `[auth-bridge] guild=${ctx.guild_id ?? 'dm'} user=${discord_id} ` +
+        `cmd=${commandName} fail_mode=${failMode} → ANON ` +
+        `(backend=${backend})`,
+    );
+    return ctx;
+  }
+
+  // ── Verified path (mint or fail per fail_mode) ──────────────────────
+  if (!ctx.guild_id) {
+    return handleVerifiedFailure({
+      ctx,
+      failMode,
+      logger,
+      code: 'no_tenant',
+      reason: 'interaction has no guild_id (DM context · no tenant binding)',
+      commandName,
+      discord_id,
+    });
+  }
+
+  const tenant_id = await deps.tenantResolver.resolveTenantFromGuild(ctx.guild_id);
+  if (!tenant_id) {
+    return handleVerifiedFailure({
+      ctx,
+      failMode,
+      logger,
+      code: 'no_tenant',
+      reason: `guild ${ctx.guild_id} has no tenant binding`,
+      commandName,
+      discord_id,
+    });
+  }
+
+  const dynamic_user_id = await deps.dynamicLookup.fetchDynamicUserIdFromDiscord(discord_id);
+  if (!dynamic_user_id) {
+    return handleVerifiedFailure({
+      ctx,
+      failMode,
+      logger,
+      code: 'no_dynamic_user',
+      reason: `discord_id=${discord_id} not onboarded via Dynamic SDK (midi gap)`,
+      commandName,
+      discord_id,
+    });
+  }
+
+  const mintStartedAt = Date.now();
+  let mintResult: { jwt: string; claims: JWTClaim };
+  try {
+    mintResult = await deps.mintJwt.mintJwt({ tenant_id, dynamic_user_id });
+  } catch (err) {
+    return handleVerifiedFailure({
+      ctx,
+      failMode,
+      logger,
+      code: 'mint_failed',
+      reason: `mint orchestrator threw: ${(err as Error)?.message ?? String(err)}`,
+      commandName,
+      discord_id,
+    });
+  }
+
+  // I6 invariant · assert tenant boundary BEFORE attaching context
+  if (mintResult.claims.tenant !== tenant_id) {
+    throw new AuthBridgeError(
+      'tenant_assertion_failed',
+      `mint returned tenant=${mintResult.claims.tenant} but expected ${tenant_id}`,
+      discord_id,
+    );
+  }
+
+  ctx.auth = { kind: 'verified', jwt: mintResult.jwt, claims: mintResult.claims };
+  logger.info(
+    `[auth-bridge] guild=${ctx.guild_id} user=${discord_id} cmd=${commandName} ` +
+      `→ VERIFIED tenant=${tenant_id} mint_ms=${Date.now() - mintStartedAt} ` +
+      `jwt_exp=${new Date(mintResult.claims.exp * 1000).toISOString()}`,
+  );
+  // mark interaction as touched so eslint-no-unused doesn't flag the parameter
+  // when this module is consumed by tests that supply minimal interaction stubs
+  void interaction;
+  return ctx;
+};
+
+// ---------------------------------------------------------------------------
+// Failure handling per fail-mode
+// ---------------------------------------------------------------------------
+
+interface VerifiedFailureArgs {
+  ctx: InteractionContext;
+  failMode: FailMode;
+  logger: AuthBridgeLogger;
+  code: AuthBridgeError['code'];
+  reason: string;
+  commandName: string;
+  discord_id: string;
+}
+
+const handleVerifiedFailure = (args: VerifiedFailureArgs): InteractionContext => {
+  const { ctx, failMode, logger, code, reason, commandName, discord_id } = args;
+
+  if (failMode === 'verified-required') {
+    logger.warn(
+      `[auth-bridge] FAIL-CLOSED guild=${ctx.guild_id ?? 'dm'} user=${discord_id} ` +
+        `cmd=${commandName} code=${code} reason="${reason}"`,
+    );
+    throw new AuthBridgeError(code, reason, discord_id);
+  }
+
+  // verified-with-anon-fallback — audit log + return anon-fallback
+  const fallbackReason = mapCodeToFallbackReason(code);
+  logger.audit(
+    `guild=${ctx.guild_id ?? 'dm'} user=${discord_id} cmd=${commandName} ` +
+      `fallback_reason=${fallbackReason} code=${code} detail="${reason}"`,
+  );
+  ctx.auth = { kind: 'anon-fallback', discord_id, reason: fallbackReason };
+  return ctx;
+};
+
+const mapCodeToFallbackReason = (
+  code: AuthBridgeError['code'],
+): AuthAnonFallback['reason'] => {
+  switch (code) {
+    case 'no_tenant':
+      return 'no-tenant';
+    case 'no_dynamic_user':
+      return 'no-dynamic-user';
+    case 'mint_failed':
+      return 'mint-failed';
+    case 'tenant_assertion_failed':
+      // tenant_assertion_failed never reaches here because it ALWAYS throws
+      // (I6 invariant · cannot fall back). Defensive default.
+      return 'mint-failed';
+  }
+};
diff --git a/apps/bot/src/index.ts b/apps/bot/src/index.ts
index 4fd9c89..58efb9c 100644
--- a/apps/bot/src/index.ts
+++ b/apps/bot/src/index.ts
@@ -42,6 +42,13 @@ import {
 } from './discord-interactions/server.ts';
 import { setQuestRuntime } from './discord-interactions/dispatch.ts';
 import { buildMemoryDevQuestRuntime } from './quest-runtime-bootstrap.ts';
+import {
+  buildEnvTenantPgPoolFactory,
+  buildProductionQuestRuntime,
+  envConnectionStringSource,
+} from './quest-runtime-production.ts';
+import { pgPoolBuilder } from './lib/pg-pool-builder.ts';
+import type { WorldManifestQuestSubset } from './world-resolver.ts';
 import { publishCommands } from './lib/publish-commands.ts';
 
 const banner = `─── freeside-characters bot · v0.6.0-A ────────────────────────`;
@@ -111,12 +118,60 @@ async function main(): Promise<void> {
       `quest-runtime:  memory · world=${'mongolian'} · guild=${guildId ?? '(unset · /quest will return polite no-path reply)'} · ${runtimeContext}`,
     );
   } else if (questRuntimeMode === 'production') {
-    // OPERATOR-AUTHORED: production runtime requires a real world-manifest
-    // source + per-world Pg pools (mibera-db / apdao-db / cubquest-db).
-    // Out of scope for the QA bootstrap. Operator wires this when Q2.9
-    // DB migration lands + world-manifest source is published.
-    throw new Error(
-      'QUEST_RUNTIME=production not yet wired · use QUEST_RUNTIME=memory for QA',
+    // === PRODUCTION RUNTIME · cycle-B sprint-1 · B-1.8 ============
+    // Composition:
+    //   - world manifests: hardcoded mibera entry until B-1.12 lands the
+    //     freeside-worlds registry loader. Operator extends this list as
+    //     additional worlds onboard (cubquest in B-2 · others in V2).
+    //   - tenant Pg pool factory: env-driven · TENANT_<TENANT>_DATABASE_URL
+    //     · pools created lazily via `pg.Pool` on first access · cached
+    //     for process lifetime.
+    //   - catalog: defaults to memory stub (Mongolian munkh-introduction-v1)
+    //     until B-1.13 lands cartridge loader. Same shape as memory-mode
+    //     bootstrap — swap-in target.
+    //   - resolvePlayer: defaults to anon-only (PRD D4) · auth-bridge wires
+    //     verified player identity at the dispatch layer (B-1.6 ports
+    //     declared · operator wires bridge call in dispatch.ts upstream).
+    //
+    // Per Lock-7 the production runtime composes orthogonally with
+    // AUTH_BACKEND. Operator runs `QUEST_RUNTIME=production AUTH_BACKEND=anon`
+    // to validate Pg path before flipping verified.
+    // =================================================================
+    const guildId =
+      process.env.QUEST_GUILD_ID ?? process.env.DISCORD_GUILD_ID;
+    const worldManifests: readonly WorldManifestQuestSubset[] = [
+      {
+        slug: 'mongolian',
+        tenant_id: 'mibera',
+        guild_ids: guildId ? [guildId] : [],
+        auth: { backend: 'freeside-jwt' },
+        quest_namespace: 'mongolian',
+        quest_engine_config: {
+          questAcceptanceMode: 'auth-required',
+          submissionStyle: 'inline_thread',
+          positiveFrictionDelayMs: 12000,
+        },
+      },
+    ];
+
+    const tenantPgPoolFactory = buildEnvTenantPgPoolFactory(
+      pgPoolBuilder,
+      envConnectionStringSource(),
+    );
+
+    const runtime = buildProductionQuestRuntime({
+      worldManifests,
+      characters,
+      tenantPgPoolFactory,
+    });
+    setQuestRuntime(runtime);
+
+    const tenantsConfigured = ['mibera', 'cubquest']
+      .filter((t) => process.env[`TENANT_${t.toUpperCase()}_DATABASE_URL`])
+      .join(',') || '(none)';
+    console.log(
+      `quest-runtime:  production · world=mongolian · guild=${guildId ?? '(unset)'} ` +
+        `· tenants_configured=${tenantsConfigured}`,
     );
   } else {
     console.log(
diff --git a/apps/bot/src/lib/pg-pool-builder.ts b/apps/bot/src/lib/pg-pool-builder.ts
new file mode 100644
index 0000000..ea3d984
--- /dev/null
+++ b/apps/bot/src/lib/pg-pool-builder.ts
@@ -0,0 +1,72 @@
+/**
+ * pg-pool-builder.ts — node-postgres adapter for the production runtime
+ * (cycle-B sprint-1 · B-1.8).
+ *
+ * Bridges `pg.Pool` to `QuestStatePostgresPool` (the minimal `query`
+ * surface @0xhoneyjar/quests-engine consumes).
+ *
+ * Why this lives in its own module:
+ *   - keeps `quest-runtime-production.ts` pure (no node-postgres import ·
+ *     unit-testable without a network)
+ *   - inline ambient type declaration for `pg` (no `@types/pg` dep needed
+ *     in this workspace · the types we use are minimal and stable)
+ *   - the bot's main() imports this lazily via the production-runtime branch
+ *     · memory/disabled paths never load pg
+ *
+ * Per Lock-9 (schema source-of-truth = JSON Schema): the runtime pool
+ * surface is a structural subset of pg.Pool · drift-tolerant.
+ */
+
+import type { QuestStatePostgresPool } from '@0xhoneyjar/quests-engine';
+import type { PoolBuilder } from '../quest-runtime-production.ts';
+
+// Minimal ambient declaration for `pg`. We don't depend on @types/pg
+// because the Pool surface we use is small and stable, and adding a
+// 100kB types dep just for two methods is overkill. Drift surfaces as
+// runtime mismatch · caught by integration tests in B-1.14.
+interface PgPoolLike {
+  query: (
+    text: string,
+    values?: readonly unknown[],
+  ) => Promise<{
+    rows: ReadonlyArray<Record<string, unknown>>;
+    rowCount: number | null;
+  }>;
+}
+
+interface PgModuleLike {
+  Pool: new (config: { connectionString: string }) => PgPoolLike;
+}
+
+/**
+ * Default PoolBuilder · constructs a `pg.Pool` from a connection string
+ * and adapts it to QuestStatePostgresPool's query contract.
+ *
+ * Runtime resolution: `require('pg')` at first call · the dep is hoisted
+ * via the workspace (transitively present from score-mibera / sibling
+ * packages). If pg is missing the require throws · operator surfaces a
+ * clear runtime error.
+ */
+export const pgPoolBuilder: PoolBuilder = {
+  build: (connection_string: string): QuestStatePostgresPool => {
+    // eslint-disable-next-line @typescript-eslint/no-var-requires
+    const pg = require('pg') as PgModuleLike;
+    const pool = new pg.Pool({ connectionString: connection_string });
+    return {
+      query: async <T extends Record<string, unknown> = Record<string, unknown>>(
+        text: string,
+        values?: ReadonlyArray<unknown>,
+      ): Promise<{ rows: T[]; rowCount: number | null }> => {
+        const result = await pool.query(text, values);
+        // Cast through unknown · the QuestStatePostgresPool generic T is the
+        // caller's expected row shape · pg returns whatever Postgres yields.
+        // The quests-engine adapter validates rows via Effect Schema so any
+        // structural drift surfaces there.
+        return {
+          rows: result.rows as unknown as T[],
+          rowCount: result.rowCount,
+        };
+      },
+    };
+  },
+};
diff --git a/apps/bot/src/quest-runtime-production.ts b/apps/bot/src/quest-runtime-production.ts
new file mode 100644
index 0000000..a3ede56
--- /dev/null
+++ b/apps/bot/src/quest-runtime-production.ts
@@ -0,0 +1,317 @@
+/**
+ * quest-runtime-production.ts — production-mode QuestRuntime constructor
+ * (cycle-B · sprint-1 · B-1.8).
+ *
+ * Replaces the memory-mode bootstrap with a tenant-aware runtime that:
+ *   - reads operator-provided world manifests (real freeside-worlds entries
+ *     once B-1.12 lands · injectable list for unit tests)
+ *   - dispatches per-tenant Postgres pools via a TenantPgPoolFactory
+ *     (translates world.slug → world.tenant_id → pg.Pool · matches the
+ *     existing WorldPgPoolFactory contract in quest-runtime.ts)
+ *   - lazily provisions pg.Pool instances from `TENANT_<TENANT>_DATABASE_URL`
+ *     env vars (one pool per tenant · process lifetime)
+ *   - accepts an injectable QuestCatalog so B-1.13's Mongolian cartridge
+ *     loader plugs in without a refactor
+ *
+ * Architect locks honored:
+ *   - I3 (Spine Seam): per-tenant heterogeneity is first-class · the factory
+ *     dispatches by `tenant_id` · NO `if (tenant === 'mibera')` shortcut.
+ *   - I5 (Construct Purity): pure orchestration · all side effects (pg.Pool
+ *     creation, env reads) flow through injected ports/factories.
+ *   - Lock-7 (Feature flag): production runtime composes orthogonally with
+ *     `AUTH_BACKEND` · runtime selection at `QUEST_RUNTIME=production` ·
+ *     auth backend at `AUTH_BACKEND=freeside-jwt` · operator flips each
+ *     independently.
+ *
+ * Out of scope for this commit:
+ *   - real freeside-worlds registry loader (B-1.12 ships mibera.yaml ·
+ *     operator wires the loader path at index.ts level)
+ *   - Mongolian cartridge catalog (B-1.13 · uses a memory stub catalog
+ *     for now · same shape as memory-mode bootstrap)
+ *   - auth-bridge orchestrator wiring (B-1.6 ships ports · this runtime
+ *     does NOT consume the bridge directly · the bot's interaction handler
+ *     will call attachAuthContext separately)
+ *
+ * Per CLAUDE.md royal decree (freeside-auth/CLAUDE.md): JWKS issuance
+ * stays at loa-freeside/apps/gateway. The auth-bridge orchestrator
+ * delegates signing there. This runtime does NOT touch JWKS surfaces.
+ */
+
+import { Effect } from "effect";
+import type {
+  CharacterRegistry,
+  CuratorVoiceProfile,
+  QuestCatalog,
+} from "@0xhoneyjar/quests-discord-renderer";
+import type {
+  Quest,
+  QuestId,
+  NpcId,
+  WorldSlug,
+  BadgeFamilyId,
+  PlayerIdentity,
+  DiscordId,
+} from "@0xhoneyjar/quests-protocol";
+import type { CharacterConfig } from "@freeside-characters/persona-engine";
+import type { QuestStatePostgresPool } from "@0xhoneyjar/quests-engine";
+import type { QuestRuntime } from "./discord-interactions/quest-dispatch.ts";
+import type { WorldPgPoolFactory } from "./quest-runtime.ts";
+import type { WorldManifestQuestSubset } from "./world-resolver.ts";
+import type { DiscordInteraction } from "./discord-interactions/types.ts";
+
+// ---------------------------------------------------------------------------
+// TenantPgPoolFactory — per-tenant pool dispatch (I3 Spine Seam)
+// ---------------------------------------------------------------------------
+
+/**
+ * Per-tenant Postgres pool factory. Returns a pool for the given tenant_id
+ * or null when no DB is provisioned for that tenant (operator hasn't set
+ * `TENANT_<TENANT>_DATABASE_URL`). Caller then falls back to memory adapter
+ * via the existing `quest-runtime.ts` resolver.
+ *
+ * Used by the bot's composition root to dispatch pools per interaction
+ * driven by world.tenant_id (set in B-1.7).
+ */
+export interface TenantPgPoolFactory {
+  readonly poolForTenant: (tenant_id: string) => QuestStatePostgresPool | null;
+}
+
+/**
+ * Wrap a TenantPgPoolFactory as a WorldPgPoolFactory · honors the existing
+ * quest-runtime.ts contract (poolForWorld takes world_slug). Translates
+ * world.slug → tenant_id (via manifest lookup) → pool.
+ *
+ * Returns null when:
+ *   - the slug isn't in the manifest list, OR
+ *   - the matched manifest has no tenant_id (cycle-Q v1.0 forward-compat),
+ *   - OR the tenant factory has no pool for that tenant.
+ *
+ * Each null path falls back to the memory adapter at quest-runtime.ts (per
+ * existing resolver semantics).
+ */
+export const buildWorldPgPoolFactoryFromTenants = (
+  manifests: readonly WorldManifestQuestSubset[],
+  tenantFactory: TenantPgPoolFactory,
+): WorldPgPoolFactory => ({
+  poolForWorld: (world_slug: string) => {
+    const world = manifests.find((m) => m.slug === world_slug);
+    if (!world || !world.tenant_id) return null;
+    return tenantFactory.poolForTenant(world.tenant_id);
+  },
+});
+
+// ---------------------------------------------------------------------------
+// Env-driven tenant pool factory (lazy pg.Pool · process-lifetime cache)
+// ---------------------------------------------------------------------------
+
+/**
+ * Connection-string lookup port. Default impl reads `TENANT_<TENANT>_DATABASE_URL`
+ * from process.env. Tests inject a recording stub.
+ *
+ * Pattern: `mibera` → `TENANT_MIBERA_DATABASE_URL` (uppercase + underscores ·
+ * tenant slugs may contain dashes which become underscores in env var names).
+ */
+export interface TenantConnectionStringSource {
+  /** Returns connection string for tenant or null if not provisioned. */
+  readonly forTenant: (tenant_id: string) => string | null;
+}
+
+export const envConnectionStringSource = (
+  env: NodeJS.ProcessEnv = process.env,
+): TenantConnectionStringSource => ({
+  forTenant: (tenant_id: string) => {
+    const key = `TENANT_${tenant_id.toUpperCase().replace(/-/g, "_")}_DATABASE_URL`;
+    const value = env[key];
+    return value && value.trim().length > 0 ? value : null;
+  },
+});
+
+/**
+ * Pool builder · constructs a QuestStatePostgresPool from a connection
+ * string. Default impl creates a `pg.Pool`; tests inject a stub.
+ *
+ * The minimal QuestStatePostgresPool surface (`query`) means we don't need
+ * a hard `pg` import at this module level — the bot's composition root
+ * supplies the real `pg.Pool`-derived adapter.
+ */
+export interface PoolBuilder {
+  readonly build: (connection_string: string) => QuestStatePostgresPool;
+}
+
+/**
+ * Build a TenantPgPoolFactory backed by env-driven connection strings.
+ * Pools are constructed lazily on first lookup and cached for the process
+ * lifetime (one pool per tenant).
+ *
+ * The factory returns null for tenants without `TENANT_<TENANT>_DATABASE_URL`
+ * set · existing memory-fallback path engages downstream.
+ */
+export const buildEnvTenantPgPoolFactory = (
+  poolBuilder: PoolBuilder,
+  source: TenantConnectionStringSource = envConnectionStringSource(),
+): TenantPgPoolFactory => {
+  const cache = new Map<string, QuestStatePostgresPool>();
+  return {
+    poolForTenant: (tenant_id: string) => {
+      const cached = cache.get(tenant_id);
+      if (cached) return cached;
+      const conn = source.forTenant(tenant_id);
+      if (!conn) return null;
+      const pool = poolBuilder.build(conn);
+      cache.set(tenant_id, pool);
+      return pool;
+    },
+  };
+};
+
+// ---------------------------------------------------------------------------
+// Production runtime constructor
+// ---------------------------------------------------------------------------
+
+export interface ProductionQuestRuntimeOptions {
+  /**
+   * Real world manifests sourced from freeside-worlds registry. Until B-1.12
+   * lands the operator-readable mibera.yaml in freeside-worlds, the bot's
+   * composition root supplies a hardcoded mibera entry inline (see
+   * index.ts wiring).
+   */
+  readonly worldManifests: readonly WorldManifestQuestSubset[];
+
+  /** Loaded characters (from character-loader). */
+  readonly characters: readonly CharacterConfig[];
+
+  /** Per-tenant Pg pool dispatch · null tenant returns memory fallback. */
+  readonly tenantPgPoolFactory: TenantPgPoolFactory;
+
+  /**
+   * Quest catalog. Defaults to a stub (Mongolian munkh-introduction-v1)
+   * mirroring the memory-mode bootstrap. B-1.13 swaps in cartridge-loaded
+   * catalog without changing this constructor's shape.
+   */
+  readonly catalog?: QuestCatalog;
+
+  /**
+   * Curator voice profile. Defaults to empty · phaseToNarrative substrate
+   * fallback applies until Track A populates per-NPC cadence.
+   */
+  readonly voice?: CuratorVoiceProfile;
+
+  /**
+   * Player resolver. Defaults to anon-only (matching memory-mode · per
+   * PRD D4). Once auth-bridge wires verified player identity in the bot's
+   * dispatch chain, the resolver promotes to JWT-claim-derived identity.
+   */
+  readonly resolvePlayer?: (interaction: DiscordInteraction) => PlayerIdentity | null;
+}
+
+/**
+ * Build a production-mode QuestRuntime.
+ *
+ * Composition:
+ *   - manifests + tenant pool factory → WorldPgPoolFactory (existing
+ *     quest-runtime.ts contract)
+ *   - catalog defaults to memory stub (B-1.13 swap point)
+ *   - voice defaults to empty profile
+ *   - resolvePlayer defaults to anon-only
+ *   - characters → CharacterRegistry (NpcId → displayName)
+ *
+ * Returns a QuestRuntime the bot wires via setQuestRuntime at boot.
+ */
+export const buildProductionQuestRuntime = (
+  opts: ProductionQuestRuntimeOptions,
+): QuestRuntime => {
+  const pgPools = buildWorldPgPoolFactoryFromTenants(
+    opts.worldManifests,
+    opts.tenantPgPoolFactory,
+  );
+  const catalog = opts.catalog ?? buildStubCatalog();
+  const voice = opts.voice ?? {};
+  const resolvePlayer = opts.resolvePlayer ?? buildAnonPlayerResolver();
+  const characters = buildCharacterRegistry(opts.characters);
+
+  return {
+    worldManifests: opts.worldManifests,
+    catalog,
+    characters,
+    voice,
+    pgPools,
+    resolvePlayer,
+  };
+};
+
+// ---------------------------------------------------------------------------
+// Defaults · same shape as memory-mode bootstrap (B-1.13 swap targets)
+// ---------------------------------------------------------------------------
+
+const STUB_QUEST_ID = "munkh-introduction-v1";
+const STUB_WORLD_SLUG = "mongolian";
+const STUB_NPC_ID = "mongolian";
+
+const buildStubQuest = (): Quest =>
+  ({
+    quest_id: STUB_QUEST_ID as unknown as QuestId,
+    npc_pointer: STUB_NPC_ID as unknown as NpcId,
+    world_slug: STUB_WORLD_SLUG as unknown as WorldSlug,
+    title: "Why did you come?",
+    prompt:
+      "Share why you came · what brought you to the steppe today. A few lines is enough · the wind carries everything you do not say.",
+    rubric_pointer: {
+      type: "codex_ref",
+      construct_slug: "construct-mongolian",
+      cell_id: "stub-v1-munkh-quest",
+    },
+    badge_spec: {
+      family_id: "mongolian-petroglyph-stub" as unknown as BadgeFamilyId,
+      display_name: "First Mark on the Steppe",
+      prompt_seed:
+        "A simple petroglyph carved into weathered stone · the first mark a traveler leaves on Mongolian soil.",
+      format_hint: "webp",
+    },
+    published_at: new Date("2026-05-04T00:00:00Z").toISOString(),
+    step_count: 1,
+    contract_version: "1.0.0",
+  }) as Quest;
+
+const buildStubCatalog = (): QuestCatalog => {
+  const stub = buildStubQuest();
+  return {
+    listAvailableQuests: (worldSlug: string) =>
+      Effect.succeed(worldSlug === STUB_WORLD_SLUG ? [stub] : []),
+    findQuest: (worldSlug: string, quest_id: string) =>
+      Effect.succeed(
+        worldSlug === STUB_WORLD_SLUG && quest_id === STUB_QUEST_ID
+          ? stub
+          : undefined,
+      ),
+  };
+};
+
+const DISCORD_ID_PATTERN = /^\d{17,20}$/;
+
+const buildAnonPlayerResolver =
+  () =>
+  (interaction: DiscordInteraction): PlayerIdentity | null => {
+    const userId = interaction.member?.user?.id ?? interaction.user?.id;
+    if (!userId) return null;
+    if (!DISCORD_ID_PATTERN.test(userId)) return null;
+    return {
+      type: "anon",
+      discord_id: userId as unknown as DiscordId,
+    };
+  };
+
+const buildCharacterRegistry = (
+  characters: readonly CharacterConfig[],
+): CharacterRegistry => {
+  const map = new Map<string, string>();
+  for (const c of characters) {
+    if (c.displayName) map.set(c.id, c.displayName);
+  }
+  return {
+    resolveDisplayName: (npc_id: string) => map.get(npc_id),
+  };
+};
+
+export const PRODUCTION_STUB_QUEST_ID = STUB_QUEST_ID;
+export const PRODUCTION_STUB_WORLD_SLUG = STUB_WORLD_SLUG;
+export const PRODUCTION_STUB_NPC_ID = STUB_NPC_ID;
diff --git a/apps/bot/src/world-resolver.ts b/apps/bot/src/world-resolver.ts
index abf9cbf..f8a4f2a 100644
--- a/apps/bot/src/world-resolver.ts
+++ b/apps/bot/src/world-resolver.ts
@@ -29,15 +29,25 @@
  *
  * Fields are optional because v1.0 manifests omit them. The resolver
  * filters out manifests without quest fields.
+ *
+ * cycle-B sprint-1 (B-1.7): added `tenant_id` and `auth.backend` so the
+ * bot's auth-bridge can resolve a per-guild tenant + know which backend
+ * (anon or freeside-jwt) the world has opted into. Both fields are
+ * optional to keep cycle-Q v1.0 manifests forward-compatible — only
+ * worlds that declare an identity composition need to populate them.
  */
 export interface WorldManifestQuestSubset {
   readonly slug: string;
+  readonly tenant_id?: string;
   readonly quest_namespace?: string;
   readonly quest_engine_config?: {
     readonly questAcceptanceMode: "open" | "auth-required" | "open-badge-gated";
     readonly submissionStyle: "inline_thread" | "modal_form";
     readonly positiveFrictionDelayMs: number;
   };
+  readonly auth?: {
+    readonly backend: "anon" | "freeside-jwt";
+  };
   readonly guild_ids?: readonly string[];
 }
 
@@ -106,3 +116,49 @@ export const resolveEngineConfigForGuild = (
   if (!world) return null;
   return buildEngineConfigForWorld(world);
 };
+
+/**
+ * cycle-B sprint-1 (B-1.7): resolve the canonical tenant_id for a Discord
+ * guild from the world-manifest registry.
+ *
+ * Returns null when:
+ *   - no world claims the guild, OR
+ *   - the matched world manifest does not declare `tenant_id` (cycle-Q
+ *     v1.0 manifest · no identity composition)
+ *
+ * Auth-bridge consumes this to drive its `TenantResolverPort`. The bridge
+ * decides what null means based on the per-route fail-mode (verified-required
+ * → AuthBridgeError; verified-with-anon-fallback → audited downgrade;
+ * public/anon → not consulted at all).
+ *
+ * Pure-data function · no IO · no Discord API call · safe to invoke per
+ * interaction at the dispatch layer.
+ */
+export const resolveTenantFromGuild = (
+  guild_id: string,
+  manifests: readonly WorldManifestQuestSubset[],
+): string | null => {
+  const world = resolveWorldForGuild(guild_id, manifests);
+  if (!world) return null;
+  return world.tenant_id ?? null;
+};
+
+/**
+ * cycle-B sprint-1 (B-1.7): resolve the auth backend the world has opted
+ * into. Returns the manifest's declared backend or 'anon' when the world
+ * doesn't declare identity composition.
+ *
+ * Composes orthogonally with the AUTH_BACKEND env var (Lock-7): operators
+ * gate by env at the bot binary level; worlds advertise their preferred
+ * backend at the manifest level. The strict policy (env=anon overrides
+ * everything) is enforced inside auth-bridge · this resolver only surfaces
+ * the world's stated preference.
+ */
+export const resolveAuthBackendForGuild = (
+  guild_id: string,
+  manifests: readonly WorldManifestQuestSubset[],
+): "anon" | "freeside-jwt" => {
+  const world = resolveWorldForGuild(guild_id, manifests);
+  if (!world) return "anon";
+  return world.auth?.backend ?? "anon";
+};
