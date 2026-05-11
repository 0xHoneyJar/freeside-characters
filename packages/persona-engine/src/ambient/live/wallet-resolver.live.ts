/**
 * WalletResolver live adapter — wraps mcp__freeside_auth__resolve_wallet.
 *
 * Per CLAUDE.md "Don't do" rule + NFR-29: MANDATORY in narration path.
 * Cache miss + MCP failure path returns ANONYMOUS_KEEPER (NEVER raw 0x...).
 *
 * Cache: 200-item LRU · 10-min TTL.
 *
 * Resilience: NFR-7 5s timeout (default to anonymized on timeout, NOT throw).
 */

import { Effect, Layer, Duration, Schema } from "effect";
import {
  WalletResolver,
  ANONYMOUS_KEEPER,
  type WalletIdentity,
} from "../ports/wallet-resolver.port.ts";
import { CircuitBreaker } from "../ports/circuit-breaker.port.ts";
import { callScoreToolAmbient } from "./score-mcp-client.ts";
import { loadConfig } from "../../config.ts";

const CACHE_MAX = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RESOLVER_TIMEOUT_MS = 5_000;
const CB_KEY = "freeside-auth-mcp";

interface CacheEntry {
  identity: WalletIdentity;
  fetched_at: number;
}

const _cache: Map<string, CacheEntry> = new Map();

const RawIdentitySchema = Schema.Struct({
  wallet_address: Schema.String,
  discord_handle: Schema.NullOr(Schema.String),
  display_handle: Schema.NullOr(Schema.String),
  mibera_id: Schema.NullOr(Schema.Number),
  midi_profile_url: Schema.NullOr(Schema.String),
});

function _evict(): void {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) {
    if (now - v.fetched_at > CACHE_TTL_MS) _cache.delete(k);
  }
  while (_cache.size > CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey === undefined) break;
    _cache.delete(firstKey);
  }
}

export const WalletResolverLive = Layer.effect(
  WalletResolver,
  Effect.gen(function* (_) {
    const cb = yield* _(CircuitBreaker);

    return WalletResolver.of({
      resolve: (wallet) =>
        Effect.gen(function* (_) {
          _evict();
          const addr = wallet as unknown as string;
          const cached = _cache.get(addr);
          const now = Date.now();
          if (cached && now - cached.fetched_at < CACHE_TTL_MS) {
            return cached.identity;
          }

          const shortCircuited = yield* _(
            cb.isShortCircuited(CB_KEY).pipe(
              Effect.catchAll(() => Effect.succeed(false)),
            ),
          );
          if (shortCircuited) {
            // NFR-29: NEVER leak raw 0x... — return anonymized
            const anon = { ...ANONYMOUS_KEEPER };
            _cache.set(addr, { identity: anon, fetched_at: now });
            return anon;
          }

          const config = loadConfig();
          const call = Effect.tryPromise({
            try: (signal: AbortSignal) =>
              callScoreToolAmbient<unknown>(
                config,
                "resolve_wallet",
                { wallet: addr },
                signal,
              ),
            catch: (e: unknown): Error =>
              e instanceof Error ? e : new Error(String(e)),
          }).pipe(
            Effect.timeout(Duration.millis(RESOLVER_TIMEOUT_MS)),
          );

          const raw = yield* _(
            call.pipe(
              Effect.tap(() =>
                cb.recordSuccess(CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
              Effect.tapError(() =>
                cb.recordFailure(CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
              Effect.catchAll(() => Effect.succeed(null as unknown)),
            ),
          );

          if (raw === null || raw === undefined) {
            const anon = { ...ANONYMOUS_KEEPER };
            _cache.set(addr, { identity: anon, fetched_at: now });
            return anon;
          }

          const decoded = Schema.decodeUnknownEither(RawIdentitySchema)(raw);
          const identity: WalletIdentity =
            decoded._tag === "Right" ? decoded.right : { ...ANONYMOUS_KEEPER };
          _cache.set(addr, { identity, fetched_at: now });
          return identity;
        }),

      invalidate: (wallet) =>
        Effect.sync(() => {
          _cache.delete(wallet as unknown as string);
        }),
    });
  }),
);
