/**
 * medium-binding.test.ts — IMediumBinding (cycle-010 S3.3; #72). Proves the
 * interaction descriptor exposes modal/ephemeral and that capability assertion
 * refuses an unsupported surface (the webhook-vs-interaction split). Network-free.
 */
import { describe, expect, test } from "bun:test";
import {
  DISCORD_INTERACTION_DESCRIPTOR,
  DISCORD_WEBHOOK_DESCRIPTOR,
  assertCapability,
  interactionMediumBinding,
} from "./medium-binding.ts";
import type { WorldRef } from "./source-producer.ts";

const WORLD: WorldRef = {
  community_id: "pythenian",
  world_slug: "pythenian",
  guild_id: "g1",
  namespace_prefix: "pythenian:",
  watched_contracts: [],
  score_community_slug: "pythenian",
};

describe("IMediumBinding", () => {
  test("MVP binding resolves to the Discord interaction descriptor", () => {
    expect(interactionMediumBinding.resolve(WORLD)).toBe(DISCORD_INTERACTION_DESCRIPTOR);
  });

  test("interaction context supports modal + ephemeral; webhook does not", () => {
    expect(DISCORD_INTERACTION_DESCRIPTOR.capabilities.modal).toBe(true);
    expect(DISCORD_WEBHOOK_DESCRIPTOR.capabilities.modal).toBe(false);
  });

  test("assertCapability passes for a supported cap", () => {
    expect(() => assertCapability(DISCORD_INTERACTION_DESCRIPTOR, "modal")).not.toThrow();
  });

  test("assertCapability throws for an unsupported cap (modal over webhook)", () => {
    expect(() => assertCapability(DISCORD_WEBHOOK_DESCRIPTOR, "modal")).toThrow(/interaction context/);
  });
});
