/**
 * shadow/identity-actor-resolver.ts — the ISOLATED actor resolver for the
 * voiceless `/role-sync` trigger (bd-atm, isolation principle).
 *
 * ── WHY ISOLATED (NOT via the auth-bridge AuthContext) ───────────────────────
 * The trigger's default `actorResolverFromAuth` reads the per-interaction
 * `AuthContext` the auth-bridge attaches — which only yields a `verified` actor
 * when the GLOBAL `AUTH_BACKEND=freeside-jwt` is flipped (the persona daemon's
 * auth). The onboarding/role-dispenser is a SEPARABLE, voiceless building (see
 * grimoires/.../onboarding-as-separable-voiceless-building.md): it MUST NOT
 * infer its identity system from the persona daemon's auth backend. A community
 * could mount the role-dispenser WITHOUT the persona daemon.
 *
 * So `/role-sync` resolves the invoking CM's actor ITSELF, independent of
 * AUTH_BACKEND:
 *   invoking Discord user id → identity-api `GET /v1/resolve/account/discord/{id}`
 *     → 200 { user_id } ⇒ actor = user_id (the value runTierRoleGoLive authzs
 *                          against admin_principals)
 *     → 404            ⇒ no linked account ⇒ REFUSE (fail-closed)
 *
 * ── FAIL-CLOSED ──────────────────────────────────────────────────────────────
 * No invoking discord id, a 404 (unlinked), a non-2xx, a transport error, or a
 * malformed body ALL resolve to null ⇒ the trigger core refuses BEFORE any read
 * (it cannot authz an unresolved actor). A clear structural message is surfaced
 * by the trigger's refusal path.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * This module imports NOTHING from persona-engine. It is a thin identity-api
 * read (one HTTP GET) behind an injected `fetch`, so tests are network-free.
 *
 * ── GROUNDING (freeside-auth, read 2026-06-04) ───────────────────────────────
 * The identity-api route is `GET /v1/resolve/account/:provider/:externalId`
 * (freeside-auth src/api/__tests__/routes.test.ts:232) — provider "discord",
 * externalId = the Discord user snowflake. 200 ⇒ { user_id }, 404 ⇒ not_found.
 */
import type { ResolvedActor } from "./role-sync-trigger.ts";

/**
 * Config for the isolated identity-api actor resolver. `fetchImpl` is injected so
 * tests are network-free; production omits it (uses global `fetch`).
 */
export interface IdentityActorResolverConfig {
  /** identity-api base URL (e.g. https://identity.0xhoneyjar.xyz). REQUIRED. */
  readonly baseUrl: string;
  /**
   * optional service token (sent as `x-service-token`) — the role-dispenser's
   * read credential for identity-api. Resolve is a public read in the canonical
   * routes today, but a deployment MAY gate it; the token is sent when present.
   */
  readonly serviceToken?: string;
  /** injectable fetch (tests). */
  readonly fetchImpl?: typeof fetch;
  /** per-request deadline in ms (default 10s). */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** Discord user snowflakes are 17-20 digit decimal ids. */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Resolve the invoking CM's actor from a Discord user id via identity-api,
 * INDEPENDENT of the global AUTH_BACKEND. Returns the {@link ResolvedActor}
 * (`{ actor: user_id }`) on a 200 hit, or null on ANY failure (no discord id,
 * 404 unlinked, non-2xx, transport, malformed body) — fail-closed. The trigger
 * core refuses a null actor before any read.
 */
export async function resolveActorFromDiscordId(
  cfg: IdentityActorResolverConfig,
  discordId: string | undefined,
): Promise<ResolvedActor | null> {
  const id = (discordId ?? "").trim();
  // A missing / malformed invoking id can never resolve — fail closed.
  if (!SNOWFLAKE_RE.test(id)) return null;

  const base = cfg.baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1/resolve/account/discord/${encodeURIComponent(id)}`;
  const doFetch = cfg.fetchImpl ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (cfg.serviceToken && cfg.serviceToken.length > 0) {
      headers["x-service-token"] = cfg.serviceToken;
    }
    res = await doFetch(url, { method: "GET", headers, signal: controller.signal });
  } catch {
    // transport error / abort (deadline) — fail closed (null ⇒ refuse).
    return null;
  } finally {
    clearTimeout(timer);
  }

  // 404 (unlinked) and any non-2xx ⇒ fail closed.
  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null; // malformed body ⇒ fail closed.
  }
  const userId = (body as { user_id?: unknown } | null)?.user_id;
  if (typeof userId !== "string" || userId.length === 0) return null;
  return { actor: userId };
}

/**
 * Build an {@link ActorResolver}-shaped factory keyed on the invoking Discord
 * user id. The interaction adapter calls this with the id it reads from the
 * interaction; the returned thunk performs the identity-api lookup. Curried so
 * the boot composition can bind the config once and the adapter supplies the id
 * per interaction.
 */
export function makeIdentityActorResolverFor(
  cfg: IdentityActorResolverConfig,
): (discordId: string | undefined) => () => Promise<ResolvedActor | null> {
  return (discordId) => () => resolveActorFromDiscordId(cfg, discordId);
}
