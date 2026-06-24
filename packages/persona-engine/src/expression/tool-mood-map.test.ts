/**
 * Tool-mood-map tests · §4.1 (kickoff-2026-05-01).
 *
 * Per-MCP coverage · null-return for unknown tools · empty-array for
 * self-referential MCPs · pickRandomMood deterministic boundary cases.
 */

import { describe, test, expect } from "bun:test";
import {
  DEFAULT_TOOL_MOOD_MAP,
  getMoodsForTool,
  pickRandomMood,
} from "./tool-mood-map.ts";
import { ALL_MOODS, type EmojiMood } from "../orchestrator/emojis/registry.ts";

describe("DEFAULT_TOOL_MOOD_MAP · schema-validated default", () => {
  test("contains entries for the 6 MCPs the bot equips today", () => {
    const prefixes = DEFAULT_TOOL_MOOD_MAP.map((e) => e.prefix).sort();
    expect(prefixes).toEqual(
      [
        "mcp__codex__",
        "mcp__emojis__",
        "mcp__freeside_auth__",
        "mcp__imagegen__",
        "mcp__rosenzu__",
        "mcp__score__",
      ].sort(),
    );
  });

  test("every mood referenced is a member of the registry mood vocabulary", () => {
    const registryMoods = new Set<EmojiMood>(ALL_MOODS);
    for (const entry of DEFAULT_TOOL_MOOD_MAP) {
      for (const mood of entry.moods) {
        expect(registryMoods.has(mood)).toBe(true);
      }
    }
  });

  test("each non-empty entry carries a non-empty rationale (Alexander craft trail)", () => {
    for (const entry of DEFAULT_TOOL_MOOD_MAP) {
      expect(entry.rationale.length).toBeGreaterThan(0);
    }
  });

  test("emojis MCP entry is self-referential silent (empty moods)", () => {
    const entry = DEFAULT_TOOL_MOOD_MAP.find((e) => e.prefix === "mcp__emojis__");
    expect(entry?.moods.length).toBe(0);
  });

  test("imagegen MCP entry is V1-deferred silent (empty moods)", () => {
    const entry = DEFAULT_TOOL_MOOD_MAP.find((e) => e.prefix === "mcp__imagegen__");
    expect(entry?.moods.length).toBe(0);
  });
});

describe("getMoodsForTool · prefix matching", () => {
  test("score tool resolves to non-empty mood pool", () => {
    const moods = getMoodsForTool("mcp__score__get_zone_digest");
    expect(moods).not.toBeNull();
    expect(moods!.length).toBeGreaterThan(0);
    expect(moods).toContain("eyes");
  });

  test("codex tool resolves to non-empty mood pool", () => {
    const moods = getMoodsForTool("mcp__codex__lookup_grail");
    expect(moods).not.toBeNull();
    expect(moods!.length).toBeGreaterThan(0);
  });

  test("rosenzu tool resolves to reading-the-room register", () => {
    const moods = getMoodsForTool("mcp__rosenzu__read_room");
    expect(moods).toContain("eyes");
  });

  test("freeside_auth tool resolves to who-is-this register", () => {
    const moods = getMoodsForTool("mcp__freeside_auth__resolve_wallet");
    expect(moods).not.toBeNull();
    expect(moods!.length).toBeGreaterThan(0);
  });

  test("emojis tool returns EMPTY array (intentional skip)", () => {
    const moods = getMoodsForTool("mcp__emojis__pick_by_mood");
    expect(moods).not.toBeNull();
    expect(moods!.length).toBe(0);
  });

  test("imagegen tool returns EMPTY array (V1 deferred)", () => {
    const moods = getMoodsForTool("mcp__imagegen__generate_image");
    expect(moods).not.toBeNull();
    expect(moods!.length).toBe(0);
  });

  test("unmapped tool returns null (substrate default = quiet)", () => {
    const moods = getMoodsForTool("mcp__unknown_future_server__some_op");
    expect(moods).toBeNull();
  });

  test("non-mcp tool name returns null", () => {
    expect(getMoodsForTool("Bash")).toBeNull();
    expect(getMoodsForTool("")).toBeNull();
  });

  test("future tool under existing server inherits the prefix's pool", () => {
    // Prefix-match means new tools added to score-mcp pick up the same
    // mood pool without a code change here.
    const existing = getMoodsForTool("mcp__score__get_zone_digest");
    const future = getMoodsForTool("mcp__score__future_factor_op");
    expect(future).toEqual(existing);
  });
});

describe("pickRandomMood · variance preservation", () => {
  test("returns null on empty pool (caller should skip patching)", () => {
    expect(pickRandomMood([])).toBeNull();
  });

  test("returns the only element when pool has one", () => {
    expect(pickRandomMood(["eyes"])).toBe("eyes");
  });

  test("returns a mood from the pool over many iterations", () => {
    const pool: EmojiMood[] = ["eyes", "flex", "noted"];
    const seen = new Set<EmojiMood>();
    for (let i = 0; i < 100; i++) {
      const pick = pickRandomMood(pool);
      expect(pick).not.toBeNull();
      seen.add(pick!);
    }
    // All three should appear at some point — if the pool has variance,
    // 100 picks across 3 elements should hit each one (probability of
    // missing any single element across 100 picks ≈ (2/3)^100 ≈ 2e-18).
    expect(seen.size).toBe(pool.length);
  });
});
