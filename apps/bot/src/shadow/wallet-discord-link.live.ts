/**
 * shadow/wallet-discord-link.live.ts — the LIVE `WalletDiscordLink` adapter
 * (bd-m2v SEAM 1): wallet → Discord SNOWFLAKE `member_id` | null.
 *
 * ── WHY THIS SOURCE (freeside_auth midi_profiles, NOT identity-api /v1/profile,
 *    NOT the WalletResolver port) ───────────────────────────────────────────
 * The assign builder (`score-tier-assignment.ts`) needs a Discord SNOWFLAKE for
 * `member_id` — the gate's `assignRole` does `guild.members.fetch(member_id)`, so
 * a handle/nym is useless. Three candidate sources exist in this repo:
 *
 *   1. `ambient/ports/wallet-resolver.port.ts` (WalletResolver) — surfaces
 *      `discord_handle` (a DISPLAY string), NOT the snowflake. UNUSABLE here.
 *   2. identity-api `/v1/profile?world=…&wallet=…` — surfaces a `nym`
 *      (display name per world), NOT the Discord snowflake. UNUSABLE here.
 *   3. `orchestrator/freeside_auth/server.ts` (`resolveWallet`)
 *      — reads `midi_profiles` directly (Railway Postgres) and returns
 *      `ResolvedWallet.discord_id` = the SNOWFLAKE (from `wallet_address` direct
 *      OR the `additional_wallets` jsonb fan-in). It is 5-min cached in-process.
 *      This is the ONE source that carries the snowflake AND is already wired in
 *      this repo (the persona narration path consumes it), so it adds NO new
 *      dependency.
 *
 * ⚠ NOTE (Bridgebuilder #11, grounded against server.ts @ this SHA): the header's
 * earlier claim that freeside_auth exports a TRUE batch `resolveWallets` is WRONG
 * — `server.ts` exports only the SINGLE-wallet `resolveWallet` (the `resolve_wallets`
 * MCP *tool* just `Promise.all`s it internally; no SQL `WHERE wallet = ANY($1)`
 * fan-in exists). So `defaultBatchResolver` below maps `resolveWallet` over the
 * slice — a TRUE batched SQL resolver is follow-up work on bead bd-m2v (it lives
 * in persona-engine, not this adapter; hand-rolling a `midi_profiles` query here
 * would duplicate the SoR + violate the seam). This adapter still COALESCES +
 * DEDUPES per-wallet calls so the upstream is hit at most once per distinct
 * wallet per flush — the right consumer-side discipline regardless.
 *
 * So this adapter wraps `freeside_auth`'s resolver. We depend on it through an
 * INJECTED function (`resolveWalletsImpl`) — not a static import of the MCP
 * server module — so:
 *   • tests inject a pure map (zero pg, zero MCP) — the conformance + assign
 *     tests stay network-free (a hard constraint of the dispatch);
 *   • the production default lazily imports `resolveWallets` from the
 *     freeside_auth server, which fail-softs to `db_unavailable` (→ null link →
 *     skipped) when `RAILWAY_MIBERA_DATABASE_URL` is unset. A wallet with no
 *     link is QUALIFIED-but-not-linked: counted in `skipped_unlinked`, NEVER
 *     assigned (FAIL-CLOSED, per the builder contract).
 *
 * ── BATCH + CACHE (the leaderboard can be large) ─────────────────────────────
 * The builder calls `link.resolve(wallet)` once PER leaderboard entry. A naive
 * adapter would issue one pg round-trip per wallet. Instead this adapter:
 *   • COALESCES per-wallet `resolve()` calls within a short flush window into ONE
 *     batched `resolveWallets([...])` call (request-coalescing), so an N-wallet
 *     leaderboard is O(ceil(N / batchSize)) round-trips, not O(N);
 *   • CACHES the wallet→snowflake|null result in-process with a TTL, so a
 *     re-preview / retried batch within the window reuses prior resolutions.
 * The underlying freeside_auth resolver ALSO caches (5-min), so this layer's
 * cache is a cheap coalescing + the-builder-asked-twice guard, not the only one.
 *
 * NOTE: this module performs NO discord.js role mutation (only an identity read
 * + the injected resolver) — it is OUTSIDE the import-boundary lint's concern
 * (role READS / identity reads are allowed everywhere; only role MUTATIONS are
 * confined to `role-writer.live.ts`).
 */
import type { WalletDiscordLink } from "./score-tier-assignment.ts";

/**
 * The minimal shape this adapter consumes from a `freeside_auth`-style batch
 * resolver. Matches the `ResolvedWallet` rows `resolveWallet`/`resolveWallets`
 * return: `wallet` (echoed, normalized lowercase) + `discord_id` (snowflake|null)
 * + `found` + `resolved_via` (the resolution PATH — load-bearing for fail-closed:
 * `'db_unavailable'` means the pg pool was missing OR the query threw, which is
 * NOT a confirmed-unlinked wallet). We read ONLY these fields, so any compatible
 * resolver (the real `resolveWallet`/`resolveWallets`, or a test double)
 * satisfies the seam.
 */
export interface ResolvedWalletLike {
  readonly wallet: string;
  readonly found: boolean;
  readonly discord_id: string | null;
  /**
   * the resolution path. `'db_unavailable'` is a FAILURE (no pg pool / query
   * threw), distinct from a confirmed `'unknown'` (the wallet is genuinely not in
   * midi_profiles). Optional so a minimal test double can omit it (absence ⇒ NOT
   * a db outage — treated as a normal resolution).
   */
  readonly resolved_via?: string;
}

/** The injected batch resolver: a list of wallets → their resolutions. */
export type BatchWalletResolver = (
  wallets: ReadonlyArray<string>,
) => Promise<ReadonlyArray<ResolvedWalletLike>>;

/**
 * Discord snowflakes are 17-20 digit decimal ids (the gate's `assignRole` does
 * `guild.members.fetch(member_id)`; a non-snowflake value can never resolve).
 * Bridgebuilder #12: a found row carrying a malformed `discord_id` is counted
 * INVALID (separate from unlinked), never emitted as an assignment.
 */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Thrown when a wallet's link could NOT be determined because the identity DB was
 * unavailable (pool missing or query threw). This is NOT a confirmed-unlinked
 * wallet — a LIVE run that swallowed it would "succeed" with everyone skipped
 * while still creating roles (Bridgebuilder #7). The orchestrator lets this fail
 * the run rather than treating it as unlinked.
 */
export class LinkResolutionError extends Error {
  constructor(
    message: string,
    public readonly wallets: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = "LinkResolutionError";
  }
}

export interface LiveWalletDiscordLinkConfig {
  /**
   * The batch resolver. PRODUCTION: omit it and the adapter lazily imports
   * `resolveWallets` from `orchestrator/freeside_auth/server.ts`. TESTS: inject a
   * pure map-backed resolver (zero I/O).
   */
  readonly resolveWalletsImpl?: BatchWalletResolver;
  /** cache TTL in ms for a resolved wallet→link (default 5min, matches upstream). */
  readonly cacheTtlMs?: number;
  /** max wallets per underlying batch call (default 100). */
  readonly batchSize?: number;
  /** injectable clock (tests). */
  readonly now?: () => number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;

interface CacheEntry {
  /** the resolved snowflake, or null when the wallet is not linked. */
  link: string | null;
  expires_at: number;
}

/**
 * Lazily import the real freeside_auth resolver (production default). Kept behind
 * a function so the MCP-server module (which lazily constructs a pg Pool only on
 * first `getPool()`, not at module load) is only pulled when actually used —
 * tests inject `resolveWalletsImpl` and never reach this. The server exports a
 * SINGLE-wallet `resolveWallet` (there is no true batch SQL — see header NOTE +
 * bd-m2v); the underlying resolver is 5-min cached, so mapping it over the slice
 * is cheap. The `resolved_via` field flows through unchanged so the adapter can
 * distinguish a genuine `'db_unavailable'` outage from a confirmed-unlinked row.
 */
async function defaultBatchResolver(
  wallets: ReadonlyArray<string>,
): Promise<ReadonlyArray<ResolvedWalletLike>> {
  const mod = await import("@freeside-characters/persona-engine/orchestrator/freeside_auth/server");
  return Promise.all([...wallets].map((w) => mod.resolveWallet(w)));
}

/**
 * Build the LIVE `WalletDiscordLink`. Coalesces per-wallet `resolve()` calls into
 * batched underlying lookups + caches results (TTL). FAIL-CLOSED: any wallet that
 * does not resolve to a non-empty `discord_id` returns null (→ skipped_unlinked,
 * never assigned). A resolver THROW is also treated fail-closed as null for THAT
 * flush (logged) — a single transient lookup error must not assign nor crash the
 * whole batch; the wallet is simply skipped this run.
 */
export function makeWalletDiscordLinkLive(
  cfg: LiveWalletDiscordLinkConfig = {},
): WalletDiscordLink {
  const resolveImpl = cfg.resolveWalletsImpl ?? defaultBatchResolver;
  const ttlMs = cfg.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const batchSize = Math.max(1, cfg.batchSize ?? DEFAULT_BATCH_SIZE);
  const now = cfg.now ?? (() => Date.now());

  const cache = new Map<string, CacheEntry>();
  // In-flight coalescing: wallet (lowercased) → the promise resolving its link.
  // A second resolve() for the same wallet while a batch is in flight joins it.
  const inflight = new Map<string, Promise<string | null>>();
  // The pending queue: wallets awaiting the next flush + their settle handles.
  // `reject` lets a fail-closed flush (#7) REJECT (throw) rather than coerce to
  // null — the orchestrator's LIVE path then fails the run.
  let pending: Array<{
    wallet: string;
    resolve: (v: string | null) => void;
    reject: (e: unknown) => void;
  }> = [];
  let flushScheduled = false;

  const cacheGet = (wallet: string): string | null | undefined => {
    const hit = cache.get(wallet);
    if (!hit) return undefined;
    if (hit.expires_at <= now()) {
      cache.delete(wallet);
      return undefined;
    }
    return hit.link;
  };

  const cachePut = (wallet: string, link: string | null): void => {
    cache.set(wallet, { link, expires_at: now() + ttlMs });
  };

  /**
   * Settle every pending resolver of this flush with `err` (a rejection). Used
   * for fail-closed paths: a DB outage MUST surface as a thrown
   * `LinkResolutionError` (so a LIVE run fails rather than silently skipping
   * everyone — Bridgebuilder #7), and a resolver THROW likewise propagates. We do
   * NOT cache on a failure (a later flush retries).
   */
  const rejectFlush = (
    batch: Array<{ wallet: string; resolve: (v: string | null) => void; reject: (e: unknown) => void }>,
    err: unknown,
  ): void => {
    for (const item of batch) {
      inflight.delete(item.wallet);
      item.reject(err);
    }
  };

  /** Run one batched lookup over a slice of distinct wallets; cache + settle. */
  const runBatch = async (
    batch: Array<{ wallet: string; resolve: (v: string | null) => void; reject: (e: unknown) => void }>,
  ): Promise<void> => {
    // distinct wallets for the underlying call (the builder may repeat a wallet)
    const distinct = [...new Set(batch.map((b) => b.wallet))];
    let bySnowflake = new Map<string, string | null>();
    const dbDown: string[] = [];
    try {
      for (let i = 0; i < distinct.length; i += batchSize) {
        const slice = distinct.slice(i, i + batchSize);
        const resolved = await resolveImpl(slice);
        for (const r of resolved) {
          const w = r.wallet.toLowerCase();
          // FAIL-CLOSED #7: a `db_unavailable` resolution is NOT a confirmed
          // unlinked wallet — the identity DB could not answer. Collect them;
          // ANY db_unavailable fails the whole flush (a LIVE run must refuse,
          // not skip-then-create-roles).
          if (r.resolved_via === "db_unavailable") {
            dbDown.push(w);
            continue;
          }
          // FAIL-CLOSED #12: only a found row with a SNOWFLAKE-SHAPED discord_id
          // is a link. A found-but-malformed id (e.g. a handle leaked into the
          // column, or a truncated value) can never `guild.members.fetch` — it is
          // INVALID, not a link → null (skipped), logged distinctly.
          let link: string | null = null;
          if (r.found && r.discord_id && r.discord_id.length > 0) {
            if (SNOWFLAKE_RE.test(r.discord_id)) {
              link = r.discord_id;
            } else {
              console.warn(
                `[wallet-discord-link] wallet ${w} has a NON-SNOWFLAKE discord_id (${JSON.stringify(
                  r.discord_id,
                )}) — treating as invalid (skipped, never assigned)`,
              );
            }
          }
          bySnowflake.set(w, link);
        }
      }
    } catch (e) {
      // A resolver THROW (the injected resolver rejected) ⇒ fail-closed: REJECT
      // the flush (LIVE refuses; SHADOW likewise — the safest default). Do NOT
      // cache. NOT coerced to null any more (that was the #7 fail-OPEN bug).
      rejectFlush(batch, new LinkResolutionError(
        `[wallet-discord-link] batch resolve threw (${distinct.length} wallets): ${
          e instanceof Error ? e.message : String(e)
        }`,
        distinct,
      ));
      return;
    }
    if (dbDown.length > 0) {
      // FAIL-CLOSED #7: the identity DB was unavailable for at least one wallet
      // in this flush. Refuse the whole flush — a LIVE run MUST NOT proceed with
      // a partial / empty link set (it would create roles + assign nobody).
      rejectFlush(batch, new LinkResolutionError(
        `[wallet-discord-link] identity DB unavailable for ${dbDown.length} wallet(s) — refusing (a partial link set would under-assign; fail the run)`,
        dbDown,
      ));
      return;
    }
    for (const item of batch) {
      const link = bySnowflake.has(item.wallet) ? bySnowflake.get(item.wallet)! : null;
      cachePut(item.wallet, link); // cache resolved results (incl. resolved-null)
      inflight.delete(item.wallet);
      item.resolve(link);
    }
  };

  const scheduleFlush = (): void => {
    if (flushScheduled) return;
    flushScheduled = true;
    // microtask flush: coalesce all synchronous resolve() calls the builder's
    // loop issues in one tick into a single batched lookup, then settle.
    queueMicrotask(() => {
      const batch = pending;
      pending = [];
      flushScheduled = false;
      void runBatch(batch);
    });
  };

  return {
    resolve(walletInput: string): Promise<string | null> {
      const wallet = walletInput.trim().toLowerCase();
      if (wallet.length === 0) return Promise.resolve(null);

      const cached = cacheGet(wallet);
      if (cached !== undefined) return Promise.resolve(cached);

      const existing = inflight.get(wallet);
      if (existing) return existing;

      const p = new Promise<string | null>((resolve, reject) => {
        pending.push({ wallet, resolve, reject });
      });
      inflight.set(wallet, p);
      scheduleFlush();
      return p;
    },
  };
}

/**
 * A pure in-memory `WalletDiscordLink` for tests (zero I/O). Mirrors the
 * `roster-source.mock` / `score-source.mock` idiom. Keys are matched
 * case-insensitively (the live source normalizes lowercase).
 */
export function makeWalletDiscordLinkMock(
  links: Record<string, string | null>,
): WalletDiscordLink {
  const norm = new Map<string, string | null>(
    Object.entries(links).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    resolve: async (wallet: string) => {
      const v = norm.get(wallet.trim().toLowerCase());
      return v ?? null;
    },
  };
}
