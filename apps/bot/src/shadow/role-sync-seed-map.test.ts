/**
 * role-sync-seed-map.test.ts — the CM-overridable DEFAULT seed role-map (bd-71y).
 * Proves the seed is a valid `RoleMapConfig`: one namespaced role per Purupuru
 * tier, each create_if_absent, qualifying at >= that tier. NETWORK-FREE.
 */
import { describe, expect, test } from "bun:test";
import {
  buildPurupuruSeedRoleMap,
  PURUPURU_NAMESPACE_PREFIX,
} from "./role-sync-seed-map.ts";
import { PURUPURU_TIER_RANK } from "./purupuru-tiers.ts";

describe("bd-71y — Purupuru seed role-map", () => {
  test("one namespaced role per tier, all create_if_absent, qualifying at that tier", () => {
    const map = buildPurupuruSeedRoleMap();
    expect(map.enabled).toBe(true);
    expect(map.namespace_prefix).toBe(PURUPURU_NAMESPACE_PREFIX);

    const tiers = Object.keys(PURUPURU_TIER_RANK);
    expect(map.rules.length).toBe(tiers.length);

    for (const rule of map.rules) {
      expect(rule.role_key.startsWith(PURUPURU_NAMESPACE_PREFIX)).toBe(true);
      const tier = rule.role_key.slice(PURUPURU_NAMESPACE_PREFIX.length);
      expect(tiers).toContain(tier);
      expect(rule.qualifies).toEqual({ source: "tier", min_tier: tier });
      expect(rule.create_if_absent).toBe(true);
      expect(rule.display_name.length).toBeGreaterThan(0);
    }
    // covers exactly the ladder: newcomer..sovereign
    expect(map.rules.map((r) => r.role_key.slice(PURUPURU_NAMESPACE_PREFIX.length)).sort()).toEqual(
      tiers.slice().sort(),
    );
  });

  test("rules are emitted in ascending strength order (deterministic)", () => {
    const map = buildPurupuruSeedRoleMap();
    const ranks = map.rules.map((r) => PURUPURU_TIER_RANK[r.role_key.slice(PURUPURU_NAMESPACE_PREFIX.length)]!);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  test("the seed has exactly the RoleMapConfig top-level keys (no extras the closed schema rejects)", () => {
    const map = buildPurupuruSeedRoleMap();
    // the substrate RoleMapConfig is a CLOSED @effect/schema Struct
    // (enabled, namespace_prefix, rules, scaffolding?). The seed must carry no
    // extra keys (we assert structurally — the orchestrator's own test decodes
    // through the real schema end-to-end).
    expect(Object.keys(map).sort()).toEqual(["enabled", "namespace_prefix", "rules"]);
    for (const rule of map.rules) {
      expect(Object.keys(rule).sort()).toEqual([
        "create_if_absent",
        "display_name",
        "qualifies",
        "role_key",
      ]);
    }
  });
});
