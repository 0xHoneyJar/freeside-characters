/**
 * shadow/config-service-client.ts — the CONFIG_SERVICE_URL cutover path for
 * apply/persist (Sprint 405 / Task 405.7, SDD §9 Phase-4 / NFR-6).
 *
 * The onboarding-lifecycle (per-CM resumable state + the `go_live_job` progress
 * the lens polls) is PERSISTED through the deployed config-service:
 *   GET  /v1/config/:world/onboarding-lifecycle?cm=<cm_identity_id>
 *   PUT  /v1/config/:world/onboarding-lifecycle?cm=<cm_identity_id>
 *
 * ── SHADOW-PREVIEW RUNS ON MOCK ──────────────────────────────────────────────
 * Shadow preview never touches the live config-service (it runs entirely on the
 * mock RosterSource/RoleWriter). The cutover here is for APPLY/PERSIST only —
 * persisting lifecycle state + go_live job progress. The flip is controlled by
 * `CONFIG_SERVICE_URL`: when unset, persistence is a no-op (preview-only mode);
 * when set, apply/persist hits the live service.
 *
 * ── FR-10 / auth (DEPLOY-PROVIDED, NOT set here) ─────────────────────────────
 * Writes require an identity-api token whose `claims.sub ∈ admin_principals`
 * (the config-service resolveWriter floor). The bearer token + the live JWKS
 * wiring are OPERATOR/DEPLOY-provided — this client takes a token getter; it does
 * NOT mint or read keys. `CONFIG_SERVICE_URL` + the token are env/secret inputs.
 */

export interface ConfigServiceClientDeps {
  /** the deployed config-service base URL. UNSET ⇒ preview-only (no persist). */
  readonly baseUrl: string | undefined;
  /** returns the CM's identity-api bearer token (deploy-provided). */
  readonly getToken: () => Promise<string | null> | string | null;
  /** injectable fetch (tests). */
  readonly fetchImpl?: typeof fetch;
  /**
   * Per-request timeout in ms (F5: every RPC needs a deadline). A hung/slow
   * config-service must NOT block the onboarding lifecycle indefinitely — that
   * path drives the go_live progress the lens polls. Defaults to 10s.
   */
  readonly timeoutMs?: number;
}

/** Default per-request deadline for config-service calls (F5). */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Typed timeout error so callers can distinguish a deadline-exceeded from a
 * transport/5xx (F5). The polling lens can surface "config-service slow" rather
 * than hanging on a stuck go_live progress bar with no error to act on.
 */
export class ConfigServiceTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(op: string, timeoutMs: number) {
    super(`config-service ${op} timed out after ${timeoutMs}ms (no response within deadline)`);
    this.name = "ConfigServiceTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export interface SurfaceEnvelope<T = unknown> {
  readonly envelope: T;
  readonly version: number;
}

export class ConfigServiceClient {
  private readonly baseUrl: string | undefined;
  private readonly getToken: ConfigServiceClientDeps["getToken"];
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(deps: ConfigServiceClientDeps) {
    this.baseUrl = deps.baseUrl?.replace(/\/$/, "");
    this.getToken = deps.getToken;
    this.doFetch = deps.fetchImpl ?? fetch;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** true when a live config-service URL is configured (cutover active). */
  get isLive(): boolean {
    return Boolean(this.baseUrl);
  }

  private async authHeader(): Promise<Record<string, string>> {
    const tok = await this.getToken();
    return tok ? { authorization: `Bearer ${tok}` } : {};
  }

  /**
   * fetch with a bounded deadline (F5). Aborts the request when `timeoutMs`
   * elapses and surfaces a typed {@link ConfigServiceTimeoutError} so a hung
   * config-service cannot silently consume the caller's liveness. The
   * AbortController is always cleared (clearTimeout) on settle so we never leak a
   * pending timer.
   */
  private async fetchWithDeadline(op: string, url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.doFetch(url, { ...init, signal: controller.signal });
    } catch (e) {
      // Map an abort (deadline) to the typed timeout error; re-throw others.
      if (controller.signal.aborted || (e as { name?: string })?.name === "AbortError") {
        throw new ConfigServiceTimeoutError(op, this.timeoutMs);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * GET the world's `role-map` surface (the CM-authored tier→role map). Returns
   * null when config-service is unwired (no baseUrl) OR on 404 (no map authored
   * yet) — the CALLER falls back to the default seed map (bd-71y). Throws on
   * transport / 5xx so a real service error is never silently treated as "no map"
   * (which would mask an outage as a seed-map run).
   *
   * The `role-map` surface follows the same `/v1/config/:world/<surface>` shape
   * as `onboarding-lifecycle`. It is a WORLD-scoped surface (NOT per-CM): the map
   * belongs to the world, not the individual CM, so there is no `cm` query param.
   */
  async getRoleMap<T = unknown>(world: string): Promise<SurfaceEnvelope<T> | null> {
    if (!this.baseUrl) return null; // unwired ⇒ caller uses the default seed
    const url = `${this.baseUrl}/v1/config/${encodeURIComponent(world)}/role-map`;
    const res = await this.fetchWithDeadline("GET role-map", url, {
      headers: { ...(await this.authHeader()) },
    });
    if (res.status === 404) return null; // no map authored ⇒ caller uses the seed
    if (!res.ok) {
      throw new Error(`config-service GET role-map ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return (await res.json()) as SurfaceEnvelope<T>;
  }

  /**
   * GET the per-CM onboarding-lifecycle record. Returns null on 404 (default →
   * the lens treats apply_mode as SHADOW). Throws on transport / 5xx.
   */
  async getOnboardingLifecycle<T = unknown>(
    world: string,
    cmIdentityId: string,
  ): Promise<SurfaceEnvelope<T> | null> {
    if (!this.baseUrl) return null; // preview-only mode
    const url = `${this.baseUrl}/v1/config/${encodeURIComponent(world)}/onboarding-lifecycle?cm=${encodeURIComponent(cmIdentityId)}`;
    const res = await this.fetchWithDeadline("GET onboarding-lifecycle", url, {
      headers: { ...(await this.authHeader()) },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`config-service GET onboarding-lifecycle ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return (await res.json()) as SurfaceEnvelope<T>;
  }

  /**
   * PUT (persist) the per-CM onboarding-lifecycle record (apply/persist cutover).
   * Optimistic-lock `version` — a 409 indicates a concurrent write.
   * 403 indicates the CM is not allowlisted (FR-10 floor).
   */
  async putOnboardingLifecycle<T = unknown>(
    world: string,
    cmIdentityId: string,
    envelope: T,
    expectedVersion: number,
  ): Promise<SurfaceEnvelope<T>> {
    if (!this.baseUrl) {
      throw new Error(
        "putOnboardingLifecycle: CONFIG_SERVICE_URL unset — apply/persist requires the config-service cutover (preview-only mode cannot persist)",
      );
    }
    const url = `${this.baseUrl}/v1/config/${encodeURIComponent(world)}/onboarding-lifecycle?cm=${encodeURIComponent(cmIdentityId)}`;
    const res = await this.fetchWithDeadline("PUT onboarding-lifecycle", url, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(await this.authHeader()) },
      body: JSON.stringify({ envelope, version: expectedVersion }),
    });
    if (res.status === 409) {
      throw new Error("config-service PUT 409: version conflict (concurrent write) — re-read and retry");
    }
    if (res.status === 403) {
      throw new Error("config-service PUT 403: CM not authorized (claims.sub not in admin_principals) — FR-10 floor");
    }
    if (!res.ok) {
      throw new Error(`config-service PUT onboarding-lifecycle ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return (await res.json()) as SurfaceEnvelope<T>;
  }

  /** Health probe (D4 smoke): GET /health → 200. Bounded by the deadline (F5) so
   *  a hung service surfaces as a failed probe, not a hang. */
  async health(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await this.fetchWithDeadline("GET /health", `${this.baseUrl}/health`);
      return res.ok;
    } catch {
      // a timeout / transport error on the health probe is simply "not healthy".
      return false;
    }
  }
}

/** Construct a client from env (CONFIG_SERVICE_URL + a token getter). */
export function configServiceClientFromEnv(
  getToken: ConfigServiceClientDeps["getToken"],
  fetchImpl?: typeof fetch,
): ConfigServiceClient {
  return new ConfigServiceClient({
    baseUrl: process.env.CONFIG_SERVICE_URL?.trim() || undefined,
    getToken,
    fetchImpl,
  });
}
