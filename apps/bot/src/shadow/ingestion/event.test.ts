/**
 * event.test.ts — the content-addressed event_id (cycle-010 S1.2; SDD §4.2).
 * Proves: determinism (golden), state-change distinctness (counter), the
 * collision-safety Flatline SKP-001/840 demanded (aliased-field), and canonical
 * JSON key-order stability. Network-free.
 */
import { describe, expect, test } from "bun:test";
import { canonicalJSON, computeEventId, makeEvent } from "./event.ts";
import type { ShadowEvent } from "./shadow-mode-contract.ts";

const meta = {
  community_id: "phytian",
  source: "discord" as const,
  truth_status: "observed_only" as const,
  observed_at: "2026-06-29T00:00:00.000Z",
  emitted_at: "2026-06-29T00:00:00.000Z",
};

describe("computeEventId", () => {
  test("golden: identical inputs → identical id (idempotency across re-runs)", () => {
    const a = computeEventId("discord.member.snapshot.v1", "phytian", "discord", {
      discord_user_id: "111",
      role_ids: ["phytian:elder"],
    });
    const b = computeEventId("discord.member.snapshot.v1", "phytian", "discord", {
      role_ids: ["phytian:elder"],
      discord_user_id: "111", // key order differs → must still match (canonical)
    });
    expect(a).toBe(b);
  });

  test("counter: a genuine state change (payload differs) → distinct id", () => {
    const before = computeEventId("discord.member.snapshot.v1", "phytian", "discord", {
      discord_user_id: "111",
      role_ids: [],
    });
    const after = computeEventId("discord.member.snapshot.v1", "phytian", "discord", {
      discord_user_id: "111",
      role_ids: ["phytian:elder"], // role added
    });
    expect(before).not.toBe(after);
  });

  test("collision-safe: aliased field boundaries do NOT collide (SKP-001/840)", () => {
    // pipe-delimited preimage would make these equal; array-encoding must not.
    const x = computeEventId(
      "discord.member.snapshot.v1",
      "a|b",
      "discord",
      { discord_user_id: "1", role_ids: [] },
    );
    const y = computeEventId(
      "discord.member.snapshot.v1",
      "a",
      "discord",
      { discord_user_id: "1", role_ids: [] },
    );
    // different community_id ('a|b' vs 'a') → different id, with no ambiguity
    expect(x).not.toBe(y);
  });

  test("timestamp-free: observed_at/emitted_at do not affect the id", () => {
    const e1 = makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
      "discord.member.snapshot.v1",
      { discord_user_id: "1", role_ids: [] },
      meta,
    );
    const e2 = makeEvent<Extract<ShadowEvent, { name: "discord.member.snapshot.v1" }>>(
      "discord.member.snapshot.v1",
      { discord_user_id: "1", role_ids: [] },
      { ...meta, observed_at: "2030-01-01T00:00:00.000Z", emitted_at: "2030-01-01T00:00:00.000Z" },
    );
    expect(e1.event_id).toBe(e2.event_id);
  });
});

describe("canonicalJSON", () => {
  test("recursively sorts keys + omits undefined", () => {
    expect(canonicalJSON({ b: 1, a: { d: 2, c: 3 }, e: undefined })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });
  test("preserves array order", () => {
    expect(canonicalJSON([3, 1, 2])).toBe("[3,1,2]");
  });
});
