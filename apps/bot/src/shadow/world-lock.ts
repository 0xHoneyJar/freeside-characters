/**
 * shadow/world-lock.ts — the consumer `WorldLock` Layer (Sprint 405, SDD
 * §4.4.1, B10). The substrate ships an in-memory lock as a TEST-ONLY module
 * (not in its `exports` map), so the characters bot supplies its own.
 *
 * For a SINGLE-PROCESS bot, an in-memory per-world `Semaphore(1)` is the
 * faithful, correct impl: concurrent `withWorldLock(world, …)` calls for the
 * SAME world serialize; calls for DIFFERENT worlds run in parallel. This is the
 * cross-batch B10 (TOCTOU) guard — it serializes the gate's check-then-create
 * span per world so two concurrent same-world batches cannot both create a role.
 *
 * NOTE (deploy): a multi-INSTANCE deploy (load-balanced) would need a
 * cross-process lock (Postgres `pg_advisory_lock` keyed on `world_slug`, or
 * Redis `SETNX`) — the substrate documents this as the consumer's concern. The
 * bot currently runs single-instance; this in-memory lock is sufficient and is
 * swappable behind the same `WorldLock` port without touching the substrate.
 */
import { Effect, Layer } from "effect";
import type { Semaphore } from "effect/Effect";
import { WorldLock, WriteError } from "./substrate.ts";

export function makeInMemoryWorldLock(): Layer.Layer<WorldLock> {
  return Layer.effect(
    WorldLock,
    Effect.gen(function* () {
      const locks = new Map<string, Semaphore>();
      // Serialize per-world semaphore CREATION so two parallel first-touches for
      // the same world share ONE semaphore (otherwise the lock would be defeated).
      const registryGuard = yield* Effect.makeSemaphore(1);

      const acquireFor = (world: string): Effect.Effect<Semaphore> =>
        registryGuard.withPermits(1)(
          Effect.gen(function* () {
            const existing = locks.get(world);
            if (existing !== undefined) return existing;
            const sem = yield* Effect.makeSemaphore(1);
            locks.set(world, sem);
            return sem;
          }),
        );

      return {
        withWorldLock: <A, E>(world: unknown, effect: Effect.Effect<A, E>) =>
          Effect.gen(function* () {
            const sem = yield* acquireFor(world as string);
            return yield* sem.withPermits(1)(effect);
          }) as Effect.Effect<A, E | WriteError>,
      };
    }),
  );
}
