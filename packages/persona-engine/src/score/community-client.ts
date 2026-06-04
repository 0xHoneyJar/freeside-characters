/**
 * score/community-client.ts — the LIVE REST client for score-api's
 * per-community leaderboard surface (cycle-032 #229/#231/#232, MERGED to
 * score-api main).
 *
 * ── WHY A NEW SURFACE (not the existing client.ts) ───────────────────────────
 * `client.ts` is the score-MCP transport (`get_zone_digest` / `get_recent_*`
 * over StreamableHTTP + SSE). This is a DIFFERENT surface: a plain JSON REST
 * read of the community leaderboard / single-wallet community profile, with
 * `x-api-key` auth. It shares the transport-hardening (`fetchWithRetry` from
 * `retry.ts`: honors Retry-After, backs off on 429/5xx) but speaks the REST
 * contract, not JSON-RPC. The shadow ScoreSource adapter
 * (apps/bot/src/shadow/score-source.live.ts) is the consumer.
 *
 * ── CONTRACT GROUNDING (score-api origin/main, read 2026-06-03) ──────────────
 *   - GET {SCORE_API_URL}/v1/leaderboard?community={slug}
 *       → 200 { community, wallets: CommunityLeaderboardEntry[], total, meta,
 *               cohort_total, truncated }
 *       (score-api packages/score-api-types entities/leaderboard-entry.ts:
 *        `communityLeaderboardResponseSchema` + `communityLeaderboardEntrySchema`,
 *        which extends `leaderboardEntrySchema` with combined_score:number|null
 *        + tier:string|null.)
 *   - GET {SCORE_API_URL}/v1/wallets/{address}?community={slug}
 *       → 200 a single community wallet profile (tier + per-dim tiers).
 *   - Auth: `x-api-key: <key>` whose `api_key_community_scope.allowedCommunities`
 *     includes the community (or its `defaultCommunityId` is the community).
 *     FAIL-CLOSED (score-api src/middleware/community-resolver.ts):
 *       out-of-scope → 403, unresolved → 4xx, non-active → 404, NEVER a silent
 *       Mibera read. A community-bound key never falls back to Mibera.
 *
 * ── WHY A HAND-MIRRORED SCHEMA, NOT `@0xhoneyjar/score-api-types` ─────────────
 * `@0xhoneyjar/score-api-types` is published to the GitHub npm registry
 * (`npm.pkg.github.com`, restricted/authed) as a BUILT `dist/` and lives in a
 * SUBDIRECTORY of the score-api repo (`packages/score-api-types`) — a bun
 * git-tarball source (the cluster's sovereign-distribution channel) cannot
 * target a repo subpath, and the package ships compiled dist rather than source.
 * Adding it as a dep would require a GH-authed registry + a postinstall build in
 * a headless dispatch. So we MIRROR the exact community shapes here (via
 * `@effect/schema`, matching the shadow seam's validation idiom), grounded
 * against score-api origin/main. This is the SAME precedent already established
 * in this repo's `apps/bot/src/auth-bridge.ts` (Lock-9: local `JWTClaim` mirrors
 * the canonical schema "until the bot workspace links the published package").
 * If/when the typed package becomes consumable, swap these schemas for its
 * re-exports — the response field names are byte-identical to the upstream.
 */

import { Schema as S } from '@effect/schema';
import { fetchWithRetry, type FetchRetryOptions } from './retry.ts';

// ─── Hand-mirrored community contract (grounded: score-api origin/main) ──────

/**
 * One community leaderboard row. Mirrors score-api
 * `communityLeaderboardEntrySchema` = base `leaderboardEntrySchema` extended
 * with `combined_score`/`tier`. We model only the fields this client consumes +
 * the load-bearing identity/score fields; `@effect/schema` Struct is OPEN here
 * (we do NOT `.strict()`) so additive upstream fields (display_name, ens_name,
 * …) never break the read — the consumer reads `wallet`/`tier` and ignores the
 * rest. Reading is the read-amplification-safe posture: tolerate-extra on a
 * contract we mirror rather than own.
 */
export const CommunityLeaderboardEntry = S.Struct({
  /** 0x-prefixed EVM address (lowercase per score-api wallet_scores). */
  wallet: S.String,
  /** rank-1 is best; null when score-but-no-rank (live-mode rows). */
  rank: S.NullOr(S.Number),
  og_score: S.optional(S.NullOr(S.Number)),
  nft_score: S.optional(S.NullOr(S.Number)),
  onchain_score: S.optional(S.NullOr(S.Number)),
  combined_score: S.NullOr(S.Number),
  /** the community's OWN lore tier name (e.g. "sovereign"); null = untiered. */
  tier: S.NullOr(S.String),
});
export type CommunityLeaderboardEntry = S.Schema.Type<typeof CommunityLeaderboardEntry>;

/**
 * The `GET /v1/leaderboard?community=` response envelope. Mirrors score-api
 * `communityLeaderboardResponseSchema`. We validate the load-bearing fields
 * (`community`, `wallets`) and tolerate the rest (`total`, `meta`,
 * `cohort_total`, `truncated`).
 */
export const CommunityLeaderboardResponse = S.Struct({
  community: S.String,
  wallets: S.Array(CommunityLeaderboardEntry),
});
export type CommunityLeaderboardResponse = S.Schema.Type<typeof CommunityLeaderboardResponse>;

/**
 * The `GET /v1/wallets/{address}?community=` single-profile response. score-api
 * returns the community wallet profile with a `tier` (+ per-dim tiers we don't
 * consume here). Modeled tolerant-of-extra; we read `wallet` + `tier`.
 */
export const CommunityWalletProfile = S.Struct({
  wallet: S.String,
  tier: S.optional(S.NullOr(S.String)),
});
export type CommunityWalletProfile = S.Schema.Type<typeof CommunityWalletProfile>;

const decodeLeaderboard = S.decodeUnknownEither(CommunityLeaderboardResponse);
const decodeProfile = S.decodeUnknownEither(CommunityWalletProfile);

// ─── Client ──────────────────────────────────────────────────────────────────

/** A typed failure from the REST community surface. Mirrors the fail-closed
 *  posture: 403 = out-of-scope key, 4xx = unresolved/bad request, 5xx = upstream.
 *  The shadow adapter maps this to the substrate's `ScoreError`. */
export class CommunityScoreError extends Error {
  constructor(
    public readonly kind:
      | 'forbidden'        // 403 — key not scoped for this community (fail-closed)
      | 'not_found'        // 404 — community paused/disabled or wallet absent
      | 'bad_request'      // other 4xx — unresolved community / bad params
      | 'upstream'         // 5xx after bounded retry
      | 'decode'           // response did not match the mirrored contract
      | 'transport',       // network throw
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'CommunityScoreError';
  }
}

export interface CommunityScoreClientConfig {
  /** base URL, e.g. https://score-api-production.up.railway.app (no trailing slash needed). */
  readonly baseUrl: string;
  /** the community-scoped score-api key (x-api-key). REQUIRED for the LIVE path. */
  readonly apiKey: string;
  /** the community slug, e.g. "purupuru". */
  readonly community: string;
  /** retry tuning (tests inject fetchImpl/sleep/random). */
  readonly retry?: FetchRetryOptions;
}

/**
 * The community-scoped REST client. Two reads:
 *   - `leaderboard()`  → the full community roster (wallet → tier).
 *   - `walletProfile(address)` → a single wallet's community tier.
 *
 * Fail-closed: any non-2xx maps to a typed `CommunityScoreError` (never a silent
 * empty/Mibera result). A 403 specifically signals the key is out-of-scope.
 */
export class CommunityScoreClient {
  constructor(private readonly cfg: CommunityScoreClientConfig) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      // score-api community-resolver reads `x-api-key` (Vary: X-API-Key).
      'x-api-key': this.cfg.apiKey,
    };
  }

  private base(): string {
    return this.cfg.baseUrl.replace(/\/+$/, '');
  }

  /** classify a non-OK Response into a typed error (after the body is consumed). */
  private async fail(res: Response): Promise<never> {
    const body = await res.text().catch(() => '');
    const snippet = body.slice(0, 200);
    const s = res.status;
    if (s === 403) {
      throw new CommunityScoreError(
        'forbidden',
        `score-api 403 — key not scoped for community '${this.cfg.community}' (fail-closed): ${snippet}`,
        s,
      );
    }
    if (s === 404) {
      throw new CommunityScoreError(
        'not_found',
        `score-api 404 — community '${this.cfg.community}' unavailable or wallet absent: ${snippet}`,
        s,
      );
    }
    if (s >= 400 && s < 500) {
      throw new CommunityScoreError(
        'bad_request',
        `score-api ${s} — unresolved community / bad request: ${snippet}`,
        s,
      );
    }
    throw new CommunityScoreError(
      'upstream',
      `score-api ${s} — upstream error after bounded retry: ${snippet}`,
      s,
    );
  }

  /** GET /v1/leaderboard?community=<slug> — the full community roster. */
  async leaderboard(): Promise<CommunityLeaderboardResponse> {
    const url = `${this.base()}/v1/leaderboard?community=${encodeURIComponent(this.cfg.community)}`;
    let res: Response;
    try {
      res = await fetchWithRetry(url, { method: 'GET', headers: this.headers() }, this.cfg.retry);
    } catch (e) {
      throw new CommunityScoreError(
        'transport',
        `score-api leaderboard transport error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (!res.ok) return this.fail(res);
    const json = await res.json().catch((e) => {
      throw new CommunityScoreError('decode', `score-api leaderboard: invalid JSON: ${String(e)}`);
    });
    const decoded = decodeLeaderboard(json);
    if (decoded._tag === 'Left') {
      throw new CommunityScoreError(
        'decode',
        `score-api leaderboard response did not match the community contract: ${String(decoded.left)}`,
      );
    }
    return decoded.right;
  }

  /** GET /v1/wallets/<address>?community=<slug> — a single wallet's tier. */
  async walletProfile(address: string): Promise<CommunityWalletProfile> {
    const url = `${this.base()}/v1/wallets/${encodeURIComponent(address)}?community=${encodeURIComponent(this.cfg.community)}`;
    let res: Response;
    try {
      res = await fetchWithRetry(url, { method: 'GET', headers: this.headers() }, this.cfg.retry);
    } catch (e) {
      throw new CommunityScoreError(
        'transport',
        `score-api wallet-profile transport error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (!res.ok) return this.fail(res);
    const json = await res.json().catch((e) => {
      throw new CommunityScoreError('decode', `score-api wallet-profile: invalid JSON: ${String(e)}`);
    });
    const decoded = decodeProfile(json);
    if (decoded._tag === 'Left') {
      throw new CommunityScoreError(
        'decode',
        `score-api wallet-profile did not match the community contract: ${String(decoded.left)}`,
      );
    }
    return decoded.right;
  }
}
