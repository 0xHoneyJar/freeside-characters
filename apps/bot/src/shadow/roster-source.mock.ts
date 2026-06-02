/**
 * shadow/roster-source.mock.ts — the MOCK `RosterSource` Layer (Sprint 405 /
 * Task 405.1, SDD §4.5). Mirrors the persona-engine `*.mock.ts` idiom
 * (`Layer.succeed` + `seed*`/`reset*` fixtures, like `wallet-resolver.mock.ts`).
 *
 * Returns fixture rosters with ZERO Discord calls — the shadow/visualize path.
 * The shadow-preview ALWAYS runs on the mock (or live-roster + gate-rejected
 * writer); this Layer is the "no real reads" half of the mock↔live switch.
 */
import { Effect, Layer } from "effect";
import { RosterSource, RosterError } from "./substrate.ts";
import type { CurrentRoster } from "@freeside-worlds/shadow-substrate";

const _fixtures = new Map<string, CurrentRoster>();
let _forceFailure = false;

/** Seed a fixture roster for a world (keyed by slug). */
export function seedRoster(roster: CurrentRoster): void {
  _fixtures.set(roster.world, roster);
}

/** Force the next reads to fail with RosterError (failure-path tests). */
export function setMockRosterFailure(fail: boolean): void {
  _forceFailure = fail;
}

/** Clear all fixtures + reset the failure flag. */
export function resetMockRosterSource(): void {
  _fixtures.clear();
  _forceFailure = false;
}

/** A default empty roster (no Freeside-managed roles yet, no pre-existing). */
function emptyRoster(world: string): CurrentRoster {
  return { world, roles: [] };
}

export const RosterSourceMock: Layer.Layer<RosterSource> = Layer.succeed(
  RosterSource,
  RosterSource.of({
    currentRoster: (world) =>
      Effect.suspend(() => {
        if (_forceFailure) {
          return Effect.fail(
            new RosterError({ message: "mock roster failure (forced)" }),
          );
        }
        const w = world as unknown as string;
        return Effect.succeed(_fixtures.get(w) ?? emptyRoster(w));
      }),
  }),
);
