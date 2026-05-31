/**
 * world-config.ts — C-4 · single-tenant → multi-tenant cutover seam.
 *
 * Two responsibilities, both default-OFF / fail-soft so an unconfigured or
 * unknown guild keeps TODAY'S single-tenant behaviour exactly:
 *
 *   1. resolveWorld(guildId) : world_slug | null
 *      Per-guild → per-world routing for the NON-quest surfaces (verify card,
 *      THJ channel reads). Quest routing already has its own resolver
 *      (`world-resolver.ts` · resolveWorldForGuild over WorldManifestQuestSubset);
 *      this is the lighter guild→slug map the verify/onboarding path needs and
 *      does NOT want to pull the full quest-manifest machinery for.
 *
 *      SOURCE-OF-TRUTH (intended): the freeside-worlds world-manifest
 *      `guild_ids` array (INFRA · `freeside-worlds/packages/protocol/
 *      world-manifest.schema.json` → `guild_ids: string[/^\d{17,20}$/]`).
 *      Those arrays are UNPOPULATED today (every registry manifest ships
 *      `guild_ids: []` — see `freeside-worlds/packages/registry/worlds/
 *      mibera.yaml:25`), so this module ships an INTERIM env/config-seeded map.
 *      When the manifests are populated + a registry loader lands, swap the
 *      seed for the loaded manifests; the `resolveWorld` signature is the
 *      stable seam.
 *
 *   2. fetchVerifyMessageConfig(...) : VerifyMessageConfig | null
 *      HTTP-read the per-world `verify-message` surface from the freeside-worlds
 *      config service (`GET /v1/config/:world/:surface`). Fail-soft to null →
 *      the caller uses its code defaults (mirrors announce-mint.ts's
 *      identity-api fetch posture: AbortController + timeout, non-OK → null,
 *      never throws). The service is NOT deployed yet
 *      (freeside-worlds bead arrakis-e5jk/C-6) so callers wire `configBaseUrl`
 *      only once it ships; until then the fetch is a no-op (null) and code
 *      defaults render.
 *
 * RENDER-CONTRACT (freeside-worlds `config-protocol/RENDER-CONTRACT.md`):
 * config stores raw-but-bounded; ESCAPING is the rendering medium's job
 * (freeside-mediums · C-5 · `renderThemeToDiscord`). This module is a READER —
 * it returns the bounded-but-raw copy verbatim. The post site MUST route the
 * copy through C-5's per-medium escaper before it reaches Discord. See the
 * forward-reference note at the verify-card post site.
 */

/* eslint-disable @typescript-eslint/consistent-type-imports */

import { buildVerifyCard } from '@freeside-characters/persona-engine/onboarding';

// ─── world_slug ────────────────────────────────────────────────────────────

/** Discord guild snowflake — mirrors world-manifest.schema.json guild_ids item. */
const GUILD_SNOWFLAKE = /^\d{17,20}$/;
/** world_slug — mirrors config-protocol WORLD_SLUG_PATTERN / world-manifest `slug`. */
const WORLD_SLUG = /^[a-z][a-z0-9-]{1,20}$/;

/**
 * Interim guild → world_slug seed.
 *
 * Two pressure-test tenants for C-4 (THJ + purupuru). Seeded constants below;
 * an operator may override / extend via the `WORLD_GUILD_MAP` env var (JSON
 * `{ "<guild_id>": "<world_slug>" }`) without a code change — env entries are
 * MERGED OVER the constants (operator wins), and each entry is validated
 * (snowflake key + slug value) before it's trusted.
 *
 * Slug decision (investigated against the world-registry vault SoT
 * `~/vault/wiki/entities/world-registry.md` + the freeside-worlds registry +
 * the bot's existing tenant convention):
 *
 *   • THJ guild 1135545260538339420 → `mibera`.
 *     Rationale: `mibera` is a REAL freeside-worlds registry slug
 *     (`packages/registry/worlds/mibera.yaml`), it is the tenant the bot
 *     ALREADY maps this guild to (index.ts production runtime:
 *     `slug:'mongolian', tenant_id:'mibera'`), and announce-mint.ts hardcodes
 *     `world: 'mibera'` for this exact guild's enrichment. Using `mibera`
 *     keeps the verify-message surface keyed by the same world the rest of the
 *     THJ surfaces already use.
 *     ALTERNATIVE considered: `mongolian` (the bot's quest-namespace world for
 *     this guild). Rejected for the config surface because `mongolian` is a
 *     quest-collection handle, not a freeside-worlds registry world — the
 *     config service is keyed by the registry `world_slug`. If the operator
 *     later wants the verify surface under `mongolian`, override via
 *     `WORLD_GUILD_MAP` — that's the whole point of the env seam.
 *
 *   • purupuru guild 1495534680617910396 → `purupuru`.
 *     Rationale: the world-registry vault SoT names the world `purupuru`
 *     ("Purupuru World"). No freeside-worlds registry manifest exists for it
 *     yet, so the config service will 404 for it (fail-soft → code defaults)
 *     until a `purupuru.yaml` manifest + verify-message config land. The slug
 *     is forward-declared so the seam is wired the moment the manifest ships.
 */
const SEEDED_GUILD_WORLD_MAP: Readonly<Record<string, string>> = Object.freeze({
  // THJ (0xHoneyJar main guild) — verified slug-decision above.
  '1135545260538339420': 'mibera',
  // Purupuru World — forward-declared; config 404s fail-soft until manifest lands.
  '1495534680617910396': 'purupuru',
});

/**
 * Build the effective guild→world map: seeded constants, with valid
 * `WORLD_GUILD_MAP` env entries merged over them (operator override wins).
 * Invalid env (bad JSON, non-snowflake key, non-slug value) is IGNORED with a
 * single warn — never throws (an unparseable env must not crash the bot).
 */
function buildGuildWorldMap(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const map: Record<string, string> = { ...SEEDED_GUILD_WORLD_MAP };
  const raw = env.WORLD_GUILD_MAP?.trim();
  if (!raw) return map;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[world-config] WORLD_GUILD_MAP is not valid JSON — ignoring override.');
    return map;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[world-config] WORLD_GUILD_MAP must be a JSON object {guildId:worldSlug} — ignoring.');
    return map;
  }
  for (const [guildId, slug] of Object.entries(parsed as Record<string, unknown>)) {
    if (!GUILD_SNOWFLAKE.test(guildId)) {
      console.warn(`[world-config] WORLD_GUILD_MAP skip: '${guildId}' is not a guild snowflake.`);
      continue;
    }
    if (typeof slug !== 'string' || !WORLD_SLUG.test(slug)) {
      console.warn(`[world-config] WORLD_GUILD_MAP skip: value for '${guildId}' is not a valid world_slug.`);
      continue;
    }
    map[guildId] = slug;
  }
  return map;
}

/**
 * resolveWorld — per-guild → per-world_slug lookup.
 *
 * Returns the world_slug owning `guildId`, or null when:
 *   - guildId is undefined / empty / not a snowflake (DM, malformed), OR
 *   - no seed/override entry claims the guild (UNKNOWN guild).
 *
 * null is the FAIL-SOFT default: the caller falls back to today's
 * single-tenant behaviour (the global DISCORD_GUILD_ID / THJ constants).
 * Pure-data · no IO · safe per-interaction.
 *
 * @param env injectable for tests (defaults to process.env).
 */
export function resolveWorld(
  guildId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!guildId || !GUILD_SNOWFLAKE.test(guildId)) return null;
  const map = buildGuildWorldMap(env);
  return map[guildId] ?? null;
}

// ─── verify-message config (HTTP-read; fail-soft to code defaults) ──────────

/**
 * Structural mirror of freeside-worlds `config-protocol` `VerifyMessageConfig`
 * (`packages/config-protocol/surface-config.ts:248`). Re-declared locally as a
 * structural subset — the SAME pattern `world-resolver.ts` uses for
 * `WorldManifestQuestSubset` (the bot operates on a structural subset, the
 * freeside-worlds Effect.Schema is the deploy-time source-of-truth).
 *
 * UPGRADE PATH: when freeside-worlds publishes `@freeside-worlds/config-protocol`
 * as a source-distributed package (github: tarball, the cluster's
 * sovereign-code-distribution channel — cf. persona-engine's
 * `@0xhoneyjar/events` github: dep), replace this with
 * `import type { VerifyMessageConfig } from '@freeside-worlds/config-protocol'`.
 * The shape below is field-for-field with C-1.
 */
export interface VerifyMessageCopy {
  readonly title: string;
  readonly body: string;
  readonly buttonLabel: string;
}
export interface VerifyMessageConfig {
  readonly enabled: boolean;
  readonly copy: VerifyMessageCopy;
  /** Optional Jani Theme override; omitted shape is opaque to the bot (C-5 consumes it). */
  readonly theme?: unknown;
}

/** The `GET /v1/config/:world/:surface` 200 body (config-service `app.ts`). */
interface SurfaceConfigResponse {
  envelope?: {
    schema_version?: string;
    world_slug?: string;
    surface?: string;
    config?: VerifyMessageConfig;
  };
  version?: number;
  updated_at?: string;
}

export interface FetchVerifyMessageOpts {
  /**
   * config-service base URL — e.g. https://config.worlds.0xhoneyjar.xyz (no
   * trailing slash required; trimmed). When unset/empty (NOT deployed yet ·
   * arrakis-e5jk/C-6), the fetch is a no-op → null → caller uses code defaults.
   */
  readonly configBaseUrl?: string;
  /** the resolved world_slug (from resolveWorld). */
  readonly worldSlug: string;
  /** Shared service token for the read gate (`x-service-token`). Optional in dev (reads open). */
  readonly serviceToken?: string;
  /** Default 3000ms — matches announce-mint.ts / resolve-nft-pfp.ts. */
  readonly fetchTimeoutMs?: number;
  /** Test seam — inject fetch. */
  readonly fetchFn?: typeof fetch;
  /** Optional structured logger; defaults to console. */
  readonly logger?: { warn: (msg: string) => void };
}

const DEFAULT_FETCH_TIMEOUT_MS = 3_000;
const VERIFY_MESSAGE_SURFACE = 'verify-message';

/**
 * fetch the per-world verify-message config over HTTP. Fail-soft to null on
 * EVERY non-happy path (unset baseUrl, timeout, non-2xx incl. 404 "not
 * configured", malformed body, thrown error). NEVER throws — the verify card
 * must always render with at minimum its code defaults.
 *
 * Mirrors announce-mint.ts `fetchIdentityProfile` exactly: AbortController +
 * timeout, accept JSON, non-OK → null, finally clearTimeout.
 */
export async function fetchVerifyMessageConfig(
  opts: FetchVerifyMessageOpts,
): Promise<VerifyMessageConfig | null> {
  const log = opts.logger ?? { warn: (m: string) => console.warn(m) };
  const base = opts.configBaseUrl?.trim();
  // Pre-deploy / unconfigured → no-op fail-soft (the service isn't live yet).
  if (!base) return null;
  if (!WORLD_SLUG.test(opts.worldSlug)) {
    log.warn(`[world-config] refusing fetch for malformed world_slug '${opts.worldSlug}'`);
    return null;
  }

  const trimmed = base.replace(/\/+$/, '');
  const url = `${trimmed}/v1/config/${encodeURIComponent(opts.worldSlug)}/${VERIFY_MESSAGE_SURFACE}`;
  const doFetch = opts.fetchFn ?? fetch;
  const timeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.serviceToken) headers['x-service-token'] = opts.serviceToken;
    const res = await doFetch(url, { method: 'GET', headers, signal: controller.signal });
    if (!res.ok) {
      // 404 = "never configured" (fail-soft to defaults); 401/5xx likewise.
      if (res.status !== 404) {
        log.warn(`[world-config] config-service non-OK (${res.status}) for ${opts.worldSlug} → defaults`);
      }
      return null;
    }
    const body = (await res.json()) as SurfaceConfigResponse;
    // TENANT-ISOLATION (HIGH-2): trust config ONLY when its envelope is stamped
    // for the world we asked for. A misconfigured / compromised config service
    // returning world B's config for a world-A request is a cross-tenant
    // leak/spoof on a verify surface — refuse it and fail-soft to defaults.
    // The envelope's own `world_slug` is the tenant binding; the bot is the
    // verifier (ACVP: agents reason, substrate verifies).
    const responseWorld = body.envelope?.world_slug;
    if (responseWorld !== opts.worldSlug) {
      log.warn(
        `[world-config] config-service world mismatch: asked '${opts.worldSlug}' got '${
          responseWorld ?? '<none>'
        }' → defaults (refusing cross-tenant config)`,
      );
      return null;
    }
    const config = body.envelope?.config;
    if (!config || typeof config.enabled !== 'boolean' || !config.copy) {
      log.warn(`[world-config] config-service body missing verify-message config for ${opts.worldSlug} → defaults`);
      return null;
    }
    return config;
  } catch (err) {
    log.warn(
      `[world-config] config-service fetch failed for ${opts.worldSlug} (${
        err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160)
      }) → defaults`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Exported for tests / operator introspection — the effective seed map. */
export function effectiveGuildWorldMap(env: NodeJS.ProcessEnv = process.env): Readonly<Record<string, string>> {
  return Object.freeze(buildGuildWorldMap(env));
}

// ─── verify-card copy resolution (the per-event read-path seam) ─────────────

/**
 * The resolved verify-card copy a post site feeds to `buildVerifyCard`.
 * `undefined` fields → `buildVerifyCard` uses its OWN code defaults (the
 * single-tenant behaviour). This is the shape the verify-card builder already
 * accepts (`VerifyCardOpts`), re-declared here to avoid a cross-package import
 * cycle (apps/bot → persona-engine); the post site passes it straight through.
 */
export interface ResolvedVerifyCopy {
  readonly title?: string;
  readonly body?: string;
  readonly buttonLabel?: string;
}

/**
 * Escape per-medium for Discord — the RENDER-side half of the BLOCKER-1
 * contract (config stores raw-but-bounded; the medium escapes).
 *
 * FORWARD-REFERENCE · C-5 (`freeside-mediums` · bead arrakis-4re1):
 *   import { renderThemeToDiscord } from '@freeside/mediums'  // or escapeDiscordCV2
 * C-5 owns the canonical Discord CV2 / markdown escaper. Until it ships as a
 * consumable export, this is a CONSERVATIVE local placeholder that strips the
 * Discord-markdown control set most likely to break a Components-V2 text
 * display (`@/#` mentions are already neutralised at send via
 * `allowed_mentions: {parse:[]}` in onboarding-dispatch.ts:222). The store
 * already rejected control bytes / zero-width chars at WRITE (config-protocol
 * BoundedString), so this only handles markdown-structural chars.
 *
 * INTENTIONALLY MINIMAL — do NOT grow this into a full escaper. When C-5 lands,
 * DELETE this and route through `renderThemeToDiscord`. The seam is the call
 * site `escapeForDiscord(...)`, not this body.
 */
function escapeForDiscord(s: string): string {
  // Backslash-escape the Discord markdown structural set: * _ ~ ` | > and
  // backslash itself. Mirrors the char set Discord's own markdown engine reads.
  return s.replace(/([\\*_~`|>])/g, '\\$1');
}

/**
 * resolveVerifyCardCopy — the per-event read path.
 *
 *   interaction.guild_id  →  resolveWorld  →  fetchVerifyMessageConfig
 *                         →  escape-per-medium (C-5)  →  ResolvedVerifyCopy
 *
 * Fail-soft at EVERY step (default-OFF = today's behaviour):
 *   - unknown/DM guild      → {} (buildVerifyCard uses its code defaults)
 *   - config 404 / outage   → {} (fetchVerifyMessageConfig returned null)
 *   - config.enabled=false  → {} (the world has the surface OFF → code defaults;
 *                                 the bot's existing onboarding gate decides
 *                                 whether to post AT ALL — this only governs copy)
 *
 * Returns the escaped copy ready to hand to `buildVerifyCard(copy)`. The post
 * site does NOT re-escape. Never throws.
 */
export async function resolveVerifyCardCopy(opts: {
  readonly guildId: string | null | undefined;
  readonly configBaseUrl?: string;
  readonly serviceToken?: string;
  readonly fetchTimeoutMs?: number;
  readonly fetchFn?: typeof fetch;
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: { warn: (msg: string) => void };
}): Promise<ResolvedVerifyCopy> {
  const worldSlug = resolveWorld(opts.guildId, opts.env ?? process.env);
  if (!worldSlug) return {}; // unknown guild → today's single-tenant defaults.

  const config = await fetchVerifyMessageConfig({
    configBaseUrl: opts.configBaseUrl,
    worldSlug,
    serviceToken: opts.serviceToken,
    fetchTimeoutMs: opts.fetchTimeoutMs,
    fetchFn: opts.fetchFn,
    logger: opts.logger,
  });
  // null (not configured / outage) OR surface disabled → code defaults.
  if (!config || config.enabled !== true) return {};

  // RENDER-CONTRACT: escape the raw-but-bounded copy per-medium (Discord) HERE.
  return {
    title: escapeForDiscord(config.copy.title),
    body: escapeForDiscord(config.copy.body),
    buttonLabel: escapeForDiscord(config.copy.buttonLabel),
  };
}

/**
 * buildVerifyCardForGuild — the per-event verify-card builder a POST SITE calls.
 *
 * Composes the whole C-4 seam in one call:
 *   guild_id → resolveWorld → fetchVerifyMessageConfig → escape (C-5) →
 *   buildVerifyCard(copy)
 *
 * Default-OFF / fail-soft: an unknown guild, an unconfigured world, a config
 * outage, or a disabled surface all fall through to `buildVerifyCard()`'s own
 * code defaults — i.e. EXACTLY today's single-tenant card. The ONLY behaviour
 * change for a KNOWN, CONFIGURED, ENABLED world is the per-world copy.
 *
 * Returns the Components-V2 array ready to send (with the IS_COMPONENTS_V2 flag).
 * This is the seam the eventual live channel-post site wires; today only the
 * preview gallery renders the card (no guild), so the single-tenant path is
 * unaffected.
 */
export async function buildVerifyCardForGuild(opts: {
  readonly guildId: string | null | undefined;
  readonly configBaseUrl?: string;
  readonly serviceToken?: string;
  readonly fetchTimeoutMs?: number;
  readonly fetchFn?: typeof fetch;
  readonly env?: NodeJS.ProcessEnv;
  readonly logger?: { warn: (msg: string) => void };
}): Promise<unknown[]> {
  const copy = await resolveVerifyCardCopy(opts);
  // buildVerifyCard treats undefined fields as "use my code default".
  return buildVerifyCard(copy);
}
