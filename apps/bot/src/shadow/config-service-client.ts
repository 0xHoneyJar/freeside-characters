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
}

export interface SurfaceEnvelope<T = unknown> {
  readonly envelope: T;
  readonly version: number;
}

export class ConfigServiceClient {
  private readonly baseUrl: string | undefined;
  private readonly getToken: ConfigServiceClientDeps["getToken"];
  private readonly doFetch: typeof fetch;

  constructor(deps: ConfigServiceClientDeps) {
    this.baseUrl = deps.baseUrl?.replace(/\/$/, "");
    this.getToken = deps.getToken;
    this.doFetch = deps.fetchImpl ?? fetch;
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
   * GET the per-CM onboarding-lifecycle record. Returns null on 404 (default →
   * the lens treats apply_mode as SHADOW). Throws on transport / 5xx.
   */
  async getOnboardingLifecycle<T = unknown>(
    world: string,
    cmIdentityId: string,
  ): Promise<SurfaceEnvelope<T> | null> {
    if (!this.baseUrl) return null; // preview-only mode
    const url = `${this.baseUrl}/v1/config/${encodeURIComponent(world)}/onboarding-lifecycle?cm=${encodeURIComponent(cmIdentityId)}`;
    const res = await this.doFetch(url, { headers: { ...(await this.authHeader()) } });
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
    const res = await this.doFetch(url, {
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

  /** Health probe (D4 smoke): GET /health → 200. */
  async health(): Promise<boolean> {
    if (!this.baseUrl) return false;
    const res = await this.doFetch(`${this.baseUrl}/health`);
    return res.ok;
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
