/**
 * MiberaResolver live adapter — wraps mcp__codex__lookup_mibera.
 *
 * Confirmed at construct-mibera-codex/src/server.ts:122.
 * Returns 28-key MiberaEntry; we surface only narration-relevant fields.
 *
 * Cache: 60-item LRU · 5-min TTL · IMP-012 reveal/burn invalidation.
 * Resilience: NFR-7 5s timeout · NFR-8 3 retries · NFR-9 circuit breaker.
 */

import { Effect, Layer, Duration, Schedule, Schema } from "effect";
import {
  MiberaResolver,
  type MiberaIdentity,
  type MiberaResolverError,
} from "../ports/mibera-resolver.port.ts";
import { CircuitBreaker } from "../ports/circuit-breaker.port.ts";
import { callScoreToolAmbient } from "./score-mcp-client.ts";
import { loadConfig } from "../../config.ts";

const CACHE_MAX = 60;
const CACHE_TTL_MS = 5 * 60 * 1000;
const RESOLVER_TIMEOUT_MS = 5_000;
const CB_KEY = "codex-mcp";

interface CacheEntry {
  identity: MiberaIdentity | null;
  fetched_at: number;
}

const _cache: Map<number, CacheEntry> = new Map();

const ArchetypeLit = Schema.Literal(
  "Freetekno",
  "Milady",
  "Chicago/Detroit",
  "Acidhouse",
);
const ElementLit = Schema.Literal("Fire", "Water", "Earth", "Air");

const RawMiberaEntry = Schema.Struct({
  id: Schema.Number,
  archetype: ArchetypeLit,
  ancestor: Schema.String,
  element: ElementLit,
  time_period: Schema.String,
  drug: Schema.String,
  swag_rank: Schema.String,
  sun_sign: Schema.String,
  moon_sign: Schema.String,
  ascending_sign: Schema.String,
});

function _evictExpired(): void {
  const now = Date.now();
  for (const [id, entry] of _cache.entries()) {
    if (now - entry.fetched_at > CACHE_TTL_MS) _cache.delete(id);
  }
  while (_cache.size > CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey === undefined) break;
    _cache.delete(firstKey);
  }
}

export const MiberaResolverLive = Layer.effect(
  MiberaResolver,
  Effect.gen(function* (_) {
    const cb = yield* _(CircuitBreaker);

    return MiberaResolver.of({
      lookup: (tokenId) =>
        Effect.gen(function* (_) {
          _evictExpired();
          const id = tokenId as unknown as number;
          const cached = _cache.get(id);
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
            return null;
          }

          const config = loadConfig();
          const call = Effect.tryPromise<unknown, MiberaResolverError>({
            try: (signal) =>
              callScoreToolAmbient<unknown>(
                config,
                "lookup_mibera",
                { id },
                signal,
              ),
            catch: (e): MiberaResolverError => ({
              _tag: "MiberaResolverError",
              reason: "transport",
              message: e instanceof Error ? e.message : String(e),
            }),
          }).pipe(
            Effect.timeoutFail({
              duration: Duration.millis(RESOLVER_TIMEOUT_MS),
              onTimeout: (): MiberaResolverError => ({
                _tag: "MiberaResolverError",
                reason: "timeout",
                message: `codex-mcp lookup_mibera timeout ${RESOLVER_TIMEOUT_MS}ms`,
              }),
            }),
            Effect.retry({
              schedule: Schedule.exponential(Duration.seconds(1), 2).pipe(
                Schedule.jittered,
                Schedule.intersect(Schedule.recurs(2)),
              ),
            }),
          );

          const raw = yield* _(
            call.pipe(
              Effect.tap(() =>
                cb.recordSuccess(CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
              Effect.tapError(() =>
                cb.recordFailure(CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
            ),
          );

          const decoded = Schema.decodeUnknownEither(RawMiberaEntry)(raw);
          if (decoded._tag === "Left") {
            _cache.set(id, { identity: null, fetched_at: now });
            return null;
          }

          const identity: MiberaIdentity = {
            tokenId: decoded.right.id,
            archetype: decoded.right.archetype,
            ancestor: decoded.right.ancestor,
            element: decoded.right.element,
            time_period: decoded.right.time_period,
            drug: decoded.right.drug,
            swag_rank: decoded.right.swag_rank,
            sun_sign: decoded.right.sun_sign,
            moon_sign: decoded.right.moon_sign,
            ascending_sign: decoded.right.ascending_sign,
          };
          _cache.set(id, { identity, fetched_at: now });
          return identity;
        }),

      invalidate: (tokenId) =>
        Effect.sync(() => {
          _cache.delete(tokenId as unknown as number);
        }),
    });
  }),
);
