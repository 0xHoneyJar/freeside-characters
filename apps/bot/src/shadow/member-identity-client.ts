/**
 * shadow/member-identity-client.ts — the MEMBER-CENTRIC identity reads for the
 * voiceless `/role-sync` CM dashboard (bd-l08).
 *
 * ── WHY (the member-centric pivot) ───────────────────────────────────────────
 * The leaderboard-centric path (`score-tier-assignment.ts`) starts from the
 * score-api leaderboard (top wallets) and joins DOWN to discord — but the
 * Purupuru leaderboard top-50 are NOT discord-linked, while a real server member
 * (the operator) IS scored + linked yet sits at rank 3329, so the leaderboard
 * view never surfaces actual members. The CM dashboard must start from the
 * GUILD MEMBERS and walk UP to their tier:
 *
 *   discord member id
 *     → identity-api GET /v1/resolve/account/discord/{id}  → { user_id }
 *       (404 ⇒ no linked account ⇒ "unlinked")
 *     → identity-api GET /v1/profile?world={world}&userId={user_id}
 *       → { identity: { primary_wallet, wallets:[{wallet_address}] } }
 *       (404 / primary_wallet_missing ⇒ linked-but-no-wallet)
 *     → score-api walletProfile(primary_wallet) → { tier } (done by the roster
 *       builder via the score community-client — NOT this module).
 *
 * This module owns the TWO identity-api reads. The score read stays in the
 * community-client (the documented isolation-debt seam). Step 1 (resolve) is the
 * SAME route the isolated actor resolver uses (identity-actor-resolver.ts).
 *
 * ── FAIL-SOFT (per-member, never abort the batch) ────────────────────────────
 * Every read is fail-soft: a 404, a non-2xx, a transport error, a deadline, or a
 * malformed body resolves to a typed null-ish outcome (`unlinked` /
 * `no_wallet`), NEVER a throw that aborts the whole roster. A member whose
 * lookup fails simply shows as unlinked / untiered in the dashboard.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * This module imports NOTHING from persona-engine. It is a thin pair of HTTP
 * GETs behind an injected `fetch`, so tests are network-free.
 *
 * ── GROUNDING (freeside-auth, read 2026-06-04) ───────────────────────────────
 *   • GET /v1/resolve/account/:provider/:externalId — provider "discord",
 *     externalId = the discord snowflake; 200 ⇒ { user_id }, 404 ⇒ not_found
 *     (src/api/routes — same route identity-actor-resolver.ts grounds against).
 *   • GET /v1/profile?world=&userId= — 200 ⇒ { identity: { user_id,
 *     primary_wallet, wallets:[{ wallet_address, ... }], ... }, ... }; a userId
 *     with no primary_wallet ⇒ 404 { reason: "primary_wallet_missing" }
 *     (src/api/routes/profile.ts + src/api/__tests__/profile-route.test.ts).
 */

/** Discord user snowflakes are 17-20 digit decimal ids. */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/** Default per-request deadline (ms). */
const DEFAULT_TIMEOUT_MS = 10_000;

/** The outcome of resolving a member's identity (fail-soft, never throws). */
export type MemberIdentity =
  /** the discord id has no linked identity-api account (404 on resolve). */
  | { readonly kind: "unlinked" }
  /** linked to a user_id but no usable primary wallet (404 / missing on profile). */
  | { readonly kind: "no_wallet"; readonly user_id: string }
  /** fully resolved: a linked account with a usable wallet. */
  | {
      readonly kind: "linked";
      readonly user_id: string;
      /** the member's primary wallet (lowercased), or the first linked wallet. */
      readonly wallet: string;
    };

export interface MemberIdentityClientConfig {
  /** identity-api base URL (e.g. https://identity.0xhoneyjar.xyz). REQUIRED. */
  readonly baseUrl: string;
  /** the world slug for the /v1/profile read (e.g. "purupuru"). REQUIRED. */
  readonly world: string;
  /** optional service token (x-service-token) — the role-dispenser's read cred. */
  readonly serviceToken?: string;
  /** injectable fetch (tests). production omits it (global fetch). */
  readonly fetchImpl?: typeof fetch;
  /** per-request deadline in ms (default 10s; <=0 disables). */
  readonly timeoutMs?: number;
}

/**
 * The two-read member-identity client. Reads are fail-soft: a member whose
 * lookup fails resolves to `unlinked` / `no_wallet`, never a throw — so one bad
 * member can never abort the roster batch.
 */
export class MemberIdentityClient {
  constructor(private readonly cfg: MemberIdentityClientConfig) {}

  private base(): string {
    return this.cfg.baseUrl.replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.cfg.serviceToken && this.cfg.serviceToken.length > 0) {
      h["x-service-token"] = this.cfg.serviceToken;
    }
    return h;
  }

  /** GET under a per-request deadline; null on ANY non-2xx / transport / abort. */
  private async getJson(url: string): Promise<unknown | null> {
    const doFetch = this.cfg.fetchImpl ?? fetch;
    const timeoutMs = this.cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "GET",
        headers: this.headers(),
        signal: timeoutMs > 0 ? controller.signal : undefined,
      });
    } catch {
      return null; // transport error / abort (deadline) ⇒ fail-soft.
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok) return null; // 404 (unlinked / no-wallet) + any non-2xx ⇒ fail-soft.
    try {
      return await res.json();
    } catch {
      return null; // malformed body ⇒ fail-soft.
    }
  }

  /**
   * Resolve a guild member's discord id → their {@link MemberIdentity}. Fail-soft
   * at every step:
   *   • bad/missing discord id        ⇒ `unlinked`
   *   • resolve 404 / no user_id      ⇒ `unlinked`
   *   • profile 404 / no wallet       ⇒ `no_wallet`
   *   • profile OK with a wallet      ⇒ `linked`
   */
  async resolveMember(discordId: string | undefined): Promise<MemberIdentity> {
    const id = (discordId ?? "").trim();
    if (!SNOWFLAKE_RE.test(id)) return { kind: "unlinked" };

    // (1) discord id → user_id.
    const resolveUrl = `${this.base()}/v1/resolve/account/discord/${encodeURIComponent(id)}`;
    const resolveBody = await this.getJson(resolveUrl);
    const userId = (resolveBody as { user_id?: unknown } | null)?.user_id;
    if (typeof userId !== "string" || userId.length === 0) return { kind: "unlinked" };

    // (2) user_id → primary_wallet (+ wallets[] fallback).
    const profileUrl =
      `${this.base()}/v1/profile?world=${encodeURIComponent(this.cfg.world)}` +
      `&userId=${encodeURIComponent(userId)}`;
    const profileBody = await this.getJson(profileUrl);
    const wallet = extractWallet(profileBody);
    if (!wallet) return { kind: "no_wallet", user_id: userId };

    return { kind: "linked", user_id: userId, wallet };
  }
}

/**
 * Extract a usable wallet from a /v1/profile body. Prefers `identity.primary_wallet`;
 * falls back to the first non-unlinked `identity.wallets[].wallet_address`. Returns
 * a lowercased address, or null when none is usable. Tolerant of the exact shape
 * (a missing `identity`, a null primary_wallet, an empty wallets list ⇒ null).
 */
export function extractWallet(body: unknown): string | null {
  const identity = (body as { identity?: unknown } | null)?.identity as
    | { primary_wallet?: unknown; wallets?: unknown }
    | undefined;
  if (!identity || typeof identity !== "object") return null;

  const primary = identity.primary_wallet;
  if (typeof primary === "string" && primary.length > 0) return primary.toLowerCase();

  const wallets = identity.wallets;
  if (Array.isArray(wallets)) {
    for (const w of wallets) {
      const addr = (w as { wallet_address?: unknown; unlinked_at?: unknown } | null)?.wallet_address;
      const unlinked = (w as { unlinked_at?: unknown } | null)?.unlinked_at;
      if (typeof addr === "string" && addr.length > 0 && unlinked == null) {
        return addr.toLowerCase();
      }
    }
  }
  return null;
}
