/**
 * shadow/score-source.mock.ts — the MOCK `ScoreSource` Layer (bd-tfl).
 *
 * Mirrors the `roster-source.mock.ts` idiom (`Layer.succeed` + `seed*`/`reset*`
 * fixtures). This is the DEFAULT ScoreSource (the SHADOW/preview path AND the
 * fallback when `SCORE_PURUPURU_API_KEY` is unset — see composition-root.ts).
 *
 * Returns latent-qualified COUNTS per rule with ZERO network calls. The
 * substrate's `loadLatentCounts` tags every count `source: 'MOCK'` (it hardcodes
 * that — see the substrate-gap NOTE in score-source.live.ts), so a mock count
 * and a live count are indistinguishable in provenance until the substrate
 * carries the LIVE flag. Until then this mock is the honest default.
 */
import { Effect, Layer } from "effect";
import { ScoreSource, ScoreError } from "./substrate.ts";
import type { RoleRule } from "@freeside-worlds/shadow-substrate";

/** Fixture: keyed by `${world}::${role_key}` → latent count. */
const _fixtures = new Map<string, number>();
let _forceFailure = false;

function key(world: string, roleKey: string): string {
  return `${world}::${roleKey}`;
}

/** Seed a latent count for a (world, role_key). */
export function seedLatentCount(world: string, roleKey: string, count: number): void {
  _fixtures.set(key(world, roleKey), count);
}

/** Force the next reads to fail with ScoreError (failure-path tests). */
export function setMockScoreFailure(fail: boolean): void {
  _forceFailure = fail;
}

/** Clear all fixtures + reset the failure flag. */
export function resetMockScoreSource(): void {
  _fixtures.clear();
  _forceFailure = false;
}

export const ScoreSourceMock: Layer.Layer<ScoreSource> = Layer.succeed(
  ScoreSource,
  ScoreSource.of({
    latentQualified: (world, rule: RoleRule) =>
      Effect.suspend(() => {
        if (_forceFailure) {
          return Effect.fail(new ScoreError({ message: "mock score failure (forced)" }));
        }
        const w = world as unknown as string;
        return Effect.succeed(_fixtures.get(key(w, rule.role_key)) ?? 0);
      }),
  }),
);
