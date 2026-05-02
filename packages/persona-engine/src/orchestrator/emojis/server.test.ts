/**
 * Emojis MCP — boundary contract tests (§4.3a).
 *
 * For each tool:
 *   - VALID input round-trips through Effect.decode (no throw).
 *   - INVALID input fails Effect.decode at the boundary (throws).
 *   - Handler invocation with valid input produces SDK envelope shape;
 *     the parsed text payload decodes through the output schema.
 *
 * Catches drift gap #1 (per-MCP boundary contract). Authors of new
 * MCPs use this file as the template — boundary tests stay co-located
 * with the schema + server they verify.
 *
 * Reference: kickoff seed §4.3 + §5 (test coverage prioritization).
 */

import { describe, test, expect } from "bun:test";
import { Schema } from "effect";
import {
  // contracts
  listMoodsContract,
  pickByMoodContract,
  randomPickContract,
  markUsedContract,
  renderByNameContract,
  listAllContract,
  emojisServerContract,
} from "./schema.ts";
import { emojisHandlers } from "./server.ts";

// ─── helpers ─────────────────────────────────────────────────────────

/** Decode raw input through a schema; returns the decoded value or
 * throws ParseError. */
function decodeUnknown<A>(schema: Schema.Schema<A, any, never>, raw: unknown): A {
  return Schema.decodeUnknownSync(schema)(raw);
}

/** Parse an SDK envelope (`{ content: [{ type: 'text', text }] }`) into
 * its JSON payload — the shape the LLM actually sees. */
function unwrapEnvelope(envelope: { content: Array<{ type: string; text: string }> }): unknown {
  expect(envelope.content.length).toBeGreaterThan(0);
  const first = envelope.content[0]!;
  expect(first.type).toBe("text");
  return JSON.parse(first.text);
}

// ─── server contract sanity ──────────────────────────────────────────

describe("emojisServerContract", () => {
  test("declares 6 tools with unique names", () => {
    expect(emojisServerContract.name).toBe("emojis");
    const names = emojisServerContract.tools.map((t) => t.name);
    expect(names.sort()).toEqual([
      "list_all",
      "list_moods",
      "mark_used",
      "pick_by_mood",
      "random_pick",
      "render_by_name",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  test("every contract tool has a matching handler in emojisHandlers", () => {
    for (const t of emojisServerContract.tools) {
      expect(emojisHandlers).toHaveProperty(t.name);
    }
  });
});

// ─── list_moods ──────────────────────────────────────────────────────

describe("list_moods", () => {
  test("input: empty object decodes", () => {
    expect(() => decodeUnknown(listMoodsContract.input, {})).not.toThrow();
  });

  test("output: handler produces decodable response", async () => {
    const env = await emojisHandlers.list_moods();
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(listMoodsContract.output, payload);
    expect(decoded.moods.length).toBe(27);
  });
});

// ─── pick_by_mood ────────────────────────────────────────────────────

describe("pick_by_mood", () => {
  test("input: valid mood decodes", () => {
    expect(() =>
      decodeUnknown(pickByMoodContract.input, { mood: "celebrate" }),
    ).not.toThrow();
  });

  test("input: invalid mood is rejected at the boundary", () => {
    expect(() =>
      decodeUnknown(pickByMoodContract.input, { mood: "not-a-mood" }),
    ).toThrow();
  });

  test("input: optional fields elide gracefully", () => {
    const decoded = decodeUnknown(pickByMoodContract.input, {
      mood: "love",
      kind: "ruggy",
      scope: "stonehenge",
    });
    expect(decoded.kind).toBe("ruggy");
    expect(decoded.scope).toBe("stonehenge");
  });

  test("input: invalid kind is rejected", () => {
    expect(() =>
      decodeUnknown(pickByMoodContract.input, {
        mood: "love",
        kind: "imposter",
      }),
    ).toThrow();
  });

  test("output: handler produces decodable response (success branch)", async () => {
    // 'celebrate' has wide candidate pool — this should always find.
    const env = await emojisHandlers.pick_by_mood({
      mood: "celebrate",
      // no scope → no recent-cache filtering interferes
    });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(pickByMoodContract.output, payload);
    if (decoded.found) {
      expect(decoded.mood).toBe("celebrate");
      expect(decoded.render).toMatch(/^<a?:[^:]+:\d+>$/);
    } else {
      // empty branch — also a valid contract response.
      expect(decoded.hint).toBeString();
    }
  });

  test("output: handler exclude_names path yields a decodable response", async () => {
    // Force empty pool by excluding everything in 'celebrate'.
    const all = await emojisHandlers.pick_by_mood({ mood: "celebrate" });
    const payloadAll = unwrapEnvelope(all);
    const decodedAll = decodeUnknown(pickByMoodContract.output, payloadAll);
    if (!decodedAll.found) return; // already empty; nothing to exclude

    // Exclude every emoji that could match — output should be the empty branch.
    // (Use a kind+exclude combination that's guaranteed to wipe the pool.)
    const env = await emojisHandlers.pick_by_mood({
      mood: "celebrate",
      kind: "ruggy",
      exclude_names: [
        "ruggy_cheers",
        "ruggy_dab",
        "ruggy_flex",
        "ruggy_honeydrip",
        "ruggy_onfire",
        "ruggy_rainbow",
        "ruggy_rave",
      ],
    });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(pickByMoodContract.output, payload);
    expect(decoded.found).toBe(false);
  });
});

// ─── random_pick ─────────────────────────────────────────────────────

describe("random_pick", () => {
  test("input: empty object decodes (all fields optional)", () => {
    expect(() => decodeUnknown(randomPickContract.input, {})).not.toThrow();
  });

  test("input: invalid mood in moods[] is rejected", () => {
    expect(() =>
      decodeUnknown(randomPickContract.input, { moods: ["love", "fictional"] }),
    ).toThrow();
  });

  test("output: handler produces decodable response", async () => {
    const env = await emojisHandlers.random_pick({});
    const payload = unwrapEnvelope(env);
    expect(() =>
      decodeUnknown(randomPickContract.output, payload),
    ).not.toThrow();
  });
});

// ─── mark_used ───────────────────────────────────────────────────────

describe("mark_used", () => {
  test("input: name + scope required", () => {
    expect(() =>
      decodeUnknown(markUsedContract.input, { name: "ruggy_dab", scope: "stonehenge" }),
    ).not.toThrow();
  });

  test("input: missing scope is rejected", () => {
    expect(() =>
      decodeUnknown(markUsedContract.input, { name: "ruggy_dab" }),
    ).toThrow();
  });

  test("output: unknown name yields skipped branch", async () => {
    const env = await emojisHandlers.mark_used({
      name: "definitely_not_a_real_emoji",
      scope: "test",
    });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(markUsedContract.output, payload);
    expect(decoded.recorded).toBe(false);
  });
});

// ─── render_by_name ──────────────────────────────────────────────────

describe("render_by_name", () => {
  test("input: name required", () => {
    expect(() =>
      decodeUnknown(renderByNameContract.input, { name: "ruggy_dab" }),
    ).not.toThrow();
  });

  test("input: empty object is rejected (name required)", () => {
    expect(() =>
      decodeUnknown(renderByNameContract.input, {}),
    ).toThrow();
  });

  test("output: known emoji yields found branch with render syntax", async () => {
    const env = await emojisHandlers.render_by_name({ name: "ruggy_dab" });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(renderByNameContract.output, payload);
    expect(decoded.found).toBe(true);
    if (decoded.found) {
      expect(decoded.name).toBe("ruggy_dab");
      expect(decoded.render).toMatch(/^<a?:ruggy_dab:\d+>$/);
    }
  });

  test("output: unknown emoji yields missing branch with hint", async () => {
    const env = await emojisHandlers.render_by_name({ name: "fabricated_id" });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(renderByNameContract.output, payload);
    expect(decoded.found).toBe(false);
    if (!decoded.found) {
      expect(decoded.hint).toContain("Do NOT guess names");
    }
  });
});

// ─── list_all ────────────────────────────────────────────────────────

describe("list_all", () => {
  test("input: empty object decodes", () => {
    expect(() => decodeUnknown(listAllContract.input, {})).not.toThrow();
  });

  test("input: invalid kind is rejected", () => {
    expect(() =>
      decodeUnknown(listAllContract.input, { kind: "satoshi" }),
    ).toThrow();
  });

  test("output: full catalog has count = 43", async () => {
    const env = await emojisHandlers.list_all({});
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(listAllContract.output, payload);
    expect(decoded.count).toBe(43);
    expect(decoded.emojis.length).toBe(43);
  });

  test("output: kind=ruggy returns ruggy-only subset", async () => {
    const env = await emojisHandlers.list_all({ kind: "ruggy" });
    const payload = unwrapEnvelope(env);
    const decoded = decodeUnknown(listAllContract.output, payload);
    expect(decoded.count).toBe(17);
    for (const e of decoded.emojis) {
      expect(e.kind).toBe("ruggy");
    }
  });
});
