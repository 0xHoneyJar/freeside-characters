/**
 * roster-source.test.ts — MOCK RosterSource Layer (Sprint 405 / Task 405.1).
 * The mock returns fixtures with ZERO Discord calls (the shadow-preview path).
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Effect } from "effect";
import { RosterSource } from "./substrate.ts";
import {
  RosterSourceMock,
  seedRoster,
  setMockRosterFailure,
  resetMockRosterSource,
} from "./roster-source.mock.ts";

beforeEach(() => resetMockRosterSource());

describe("405.1 — MOCK RosterSource (zero Discord calls)", () => {
  test("returns a seeded fixture roster", async () => {
    seedRoster({
      world: "purupuru",
      roles: [
        { role_key: "purupuru:holder", members: 3, managed: true },
        { role_key: "CollabLand VIP", members: 42, managed: false },
      ],
    });
    const roster = await Effect.runPromise(
      RosterSource.pipe(
        Effect.flatMap((rs) => rs.currentRoster("purupuru" as never)),
        Effect.provide(RosterSourceMock),
      ),
    );
    expect(roster.world).toBe("purupuru");
    expect(roster.roles.length).toBe(2);
    expect(roster.roles.find((r) => r.managed)?.role_key).toBe("purupuru:holder");
  });

  test("an unseeded world returns an empty roster (no Discord call, no throw)", async () => {
    const roster = await Effect.runPromise(
      RosterSource.pipe(
        Effect.flatMap((rs) => rs.currentRoster("unknown" as never)),
        Effect.provide(RosterSourceMock),
      ),
    );
    expect(roster.roles.length).toBe(0);
  });

  test("forced failure surfaces a typed RosterError", async () => {
    setMockRosterFailure(true);
    const res = await Effect.runPromise(
      Effect.either(
        RosterSource.pipe(
          Effect.flatMap((rs) => rs.currentRoster("purupuru" as never)),
          Effect.provide(RosterSourceMock),
        ),
      ),
    );
    expect(res._tag).toBe("Left");
    if (res._tag === "Left") expect(res.left._tag).toBe("RosterError");
  });
});
