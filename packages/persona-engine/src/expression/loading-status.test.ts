/**
 * Loading-status composer tests · §4.2 (kickoff-2026-05-01).
 *
 * Verifies:
 *   - ruggy (emoji-affinity) gets an animated/static emoji rendered to
 *     Discord syntax for mapped tools
 *   - satoshi (no emoji-affinity) gets the locked plain-text register
 *   - emojis MCP tools resolve to null (intentional self-ref silence)
 *   - imagegen tools resolve to null (V1 deferred per §6)
 *   - unmapped tools resolve to null (substrate stays quiet)
 */

import { describe, test, expect } from "bun:test";
import { composeToolUseStatusForCharacter } from "./loading-status.ts";
import type { CharacterConfig } from "../types.ts";

// Test fixtures — only the fields composeToolUseStatusForCharacter
// actually reads (id · mcps · emojiAffinity) need to be populated. The
// rest is filled in production by the character-loader from
// `apps/character-<id>/character.json`.

const ruggy: CharacterConfig = {
  id: "ruggy",
  displayName: "Ruggy",
  personaPath: "/tmp/persona.md",
  emojiAffinity: { primary: "ruggy", fallback: "ruggy" },
  mcps: ["score", "codex", "emojis", "rosenzu", "freeside_auth"],
};

const satoshi: CharacterConfig = {
  id: "satoshi",
  displayName: "Satoshi",
  personaPath: "/tmp/persona.md",
  emojiAffinity: { primary: "mibera", fallback: "mibera" },
  mcps: ["score", "codex", "rosenzu", "freeside_auth", "imagegen"],
};

// Custom character without emojis allowlist AND without a plain-text
// register entry — used to confirm the substrate-quiet fallback fires.
const stranger: CharacterConfig = {
  id: "stranger-no-template",
  displayName: "Stranger",
  personaPath: "/tmp/persona.md",
  emojiAffinity: { primary: "ruggy", fallback: "ruggy" },
  mcps: ["score"],
};

describe("composeToolUseStatusForCharacter · ruggy emoji-affinity path", () => {
  test("score tool produces a Discord-syntax emoji string", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__score__get_zone_digest",
    );
    expect(status).not.toBeNull();
    // Render syntax: <:name:id> or <a:name:id>
    expect(status!).toMatch(/^<a?:[^:]+:\d+>$/);
  });

  test("codex tool produces an emoji string", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__codex__lookup_grail",
    );
    expect(status).not.toBeNull();
    expect(status!).toMatch(/^<a?:[^:]+:\d+>$/);
  });

  test("rosenzu tool produces an emoji string", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__rosenzu__read_room",
    );
    expect(status).not.toBeNull();
    expect(status!).toMatch(/^<a?:[^:]+:\d+>$/);
  });

  test("freeside_auth tool produces an emoji string", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__freeside_auth__resolve_wallet",
    );
    expect(status).not.toBeNull();
    expect(status!).toMatch(/^<a?:[^:]+:\d+>$/);
  });

  test("variance — 30 invocations on score yield more than one distinct emoji", () => {
    // Variance preservation per ALEXANDER craft principle. With 3 moods
    // in the score pool and multiple ruggy emojis per mood, the random
    // pick should produce at least 2 distinct results across 30 trials.
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const status = composeToolUseStatusForCharacter(
        ruggy,
        "mcp__score__get_zone_digest",
      );
      if (status) seen.add(status);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("emojis MCP returns null (self-referential silence)", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__emojis__pick_by_mood",
    );
    expect(status).toBeNull();
  });

  test("imagegen MCP returns null (V1 deferred · seed §6)", () => {
    const status = composeToolUseStatusForCharacter(
      ruggy,
      "mcp__imagegen__generate_image",
    );
    expect(status).toBeNull();
  });

  test("unmapped tool returns null (substrate stays quiet)", () => {
    expect(
      composeToolUseStatusForCharacter(ruggy, "mcp__future_server__op"),
    ).toBeNull();
  });
});

describe("composeToolUseStatusForCharacter · satoshi plain-text register", () => {
  test("score tool returns gnomic-locked plain-text template (NO emoji)", () => {
    const status = composeToolUseStatusForCharacter(
      satoshi,
      "mcp__score__get_zone_digest",
    );
    expect(status).toBe("the ledger advances — one moment.");
    // Defense-in-depth: no Discord custom emoji syntax
    expect(status).not.toMatch(/<a?:[^:]+:\d+>/);
  });

  test("codex tool returns the same locked template", () => {
    const status = composeToolUseStatusForCharacter(
      satoshi,
      "mcp__codex__lookup_grail",
    );
    expect(status).toBe("the ledger advances — one moment.");
  });

  test("rosenzu tool returns the same locked template", () => {
    const status = composeToolUseStatusForCharacter(
      satoshi,
      "mcp__rosenzu__read_room",
    );
    expect(status).toBe("the ledger advances — one moment.");
  });

  test("emojis MCP returns null (defense — satoshi's mcps[] omits emojis anyway)", () => {
    expect(
      composeToolUseStatusForCharacter(satoshi, "mcp__emojis__pick_by_mood"),
    ).toBeNull();
  });

  test("imagegen MCP returns null (V1 deferred · empty mood pool)", () => {
    expect(
      composeToolUseStatusForCharacter(
        satoshi,
        "mcp__imagegen__generate_image",
      ),
    ).toBeNull();
  });
});

describe("composeToolUseStatusForCharacter · stranger fallback (no template)", () => {
  test("character without emojis[] AND without plain-text entry returns null", () => {
    // Substrate-quiet fallback: rather than emit a generic substrate
    // marker, stay quiet until a per-character template is authored.
    expect(
      composeToolUseStatusForCharacter(stranger, "mcp__score__get_zone_digest"),
    ).toBeNull();
  });
});
