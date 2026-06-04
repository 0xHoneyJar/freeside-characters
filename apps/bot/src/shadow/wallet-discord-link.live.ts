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
 *   3. `orchestrator/freeside_auth/server.ts` (`resolveWallet`/`resolveWallets`)
 *      — reads `midi_profiles` directly (Railway Postgres) and returns
 *      `ResolvedWallet.discord_id` = the SNOWFLAKE (from `wallet_address` direct
 *      OR the `additional_wallets` jsonb fan-in). It is ALREADY batched
 *      (`resolveWallets`) and 5-min cached in-process. This is the ONE source
 *      that carries the snowflake AND is already wired in this repo (the persona
 *      narration path consumes it), so it adds NO new dependency.
 *
 * So this adapter wraps `freeside_auth`'s batch resolver. We depend on it through
 * an INJECTED function (`resolveWalletsImpl`) — not a static import of the MCP
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
 * resolver. Matches `resolveWallets(wallets) → ResolvedWallet[]` where each
 * carries `wallet` (echoed, normalized lowercase) + `discord_id` (snowflake|null)
 * + `found`. We read ONLY these three fields, so any compatible resolver (the
 * real MCP-backed `resolveWallets`, or a test double) satisfies the seam.
 */
export interface ResolvedWalletLike {
  readonly wallet: string;
  readonly found: boolean;
  readonly discord_id: string | null;
}

/** The injected batch resolver: a list of wallets → their resolutions. */
export type BatchWalletResolver = (
  wallets: ReadonlyArray<string>,
) => Promise<ReadonlyArray<ResolvedWalletLike>>;

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
 * SINGLE-wallet `resolveWallet` (the batch `resolve_wallets` MCP tool just
 * `Promise.all`s it); the underlying resolver is 5-min cached, so mapping it over
 * the slice is cheap. We map it here to satisfy the batch seam.
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
  // The pending queue: wallets awaiting the next flush + their resolvers.
  let pending: Array<{ wallet: string; resolve: (v: string | null) => void }> = [];
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

  /** Run one batched lookup over a slice of distinct wallets; cache + settle. */
  const runBatch = async (
    batch: Array<{ wallet: string; resolve: (v: string | null) => void }>,
  ): Promise<void> => {
    // distinct wallets for the underlying call (the builder may repeat a wallet)
    const distinct = [...new Set(batch.map((b) => b.wallet))];
    let bySnowflake = new Map<string, string | null>();
    try {
      for (let i = 0; i < distinct.length; i += batchSize) {
        const slice = distinct.slice(i, i + batchSize);
        const resolved = await resolveImpl(slice);
        for (const r of resolved) {
          const w = r.wallet.toLowerCase();
          // FAIL-CLOSED: only a found row with a non-empty snowflake is a link.
          const link = r.found && r.discord_id && r.discord_id.length > 0 ? r.discord_id : null;
          bySnowflake.set(w, link);
        }
      }
    } catch (e) {
      // A transient resolver failure ⇒ this whole flush resolves to null
      // (fail-closed: skip, never assign). Do NOT cache a null-on-error (so a
      // later flush retries); log for operator visibility.
      console.warn(
        `[wallet-discord-link] batch resolve failed (${distinct.length} wallets) — treating as unlinked this run: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      for (const item of batch) {
        inflight.delete(item.wallet);
        item.resolve(null);
      }
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

      const p = new Promise<string | null>((resolve) => {
        pending.push({ wallet, resolve });
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
