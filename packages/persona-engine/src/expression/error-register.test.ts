/**
 * Error-register tests · §4.3 (kickoff-2026-05-01).
 *
 * Verifies:
 *   - every (character × error class) cell is populated
 *   - no template carries corporate-bot register ("apologize", "we're sorry",
 *     "an error occurred", etc.)
 *   - voice register holds: ruggy templates are lowercase + slangy;
 *     satoshi templates are sentence-case + dense
 *   - composeErrorReply preserves the bold-prefix attribution shape so
 *     dispatch.ts can swap getter-for-direct-string with no shape change
 */

import { describe, test, expect } from "bun:test";
import {
  DEFAULT_ERROR_REGISTRY,
  getErrorTemplate,
  composeErrorReply,
  type ErrorClass,
} from "./error-register.ts";

const ALL_ERROR_CLASSES: ErrorClass[] = [
  "timeout",
  "empty",
  "error",
  "image-too-large",
  "image-delivery-failed",
];

const CHARACTERS = ["ruggy", "satoshi"];

// Words that mark the corporate-bot register the doctrine bans (CLAUDE.md).
// Voice rules: substrate-shaped errors collapse the character register.
const CORPORATE_BOT_BANNED = [
  "apologize",
  "apologies",
  "we're sorry",
  "we apologize",
  "an error occurred",
  "an error has occurred",
  "please try again later",
  "try again later",
  "inconvenience",
  "we encountered",
  "request could not be completed",
];

describe("DEFAULT_ERROR_REGISTRY · coverage", () => {
  for (const characterId of CHARACTERS) {
    for (const errorClass of ALL_ERROR_CLASSES) {
      test(`${characterId} × ${errorClass} has a template`, () => {
        const template = getErrorTemplate(characterId, errorClass);
        expect(template).not.toBeNull();
        expect(typeof template).toBe("string");
        expect(template!.length).toBeGreaterThan(0);
      });
    }
  }

  test("unknown character → null (substrate-quiet fallback)", () => {
    expect(getErrorTemplate("nonexistent-char", "error")).toBeNull();
  });
});

describe("DEFAULT_ERROR_REGISTRY · voice register", () => {
  test("no corporate-bot register slips through", () => {
    for (const characterId of CHARACTERS) {
      for (const errorClass of ALL_ERROR_CLASSES) {
        const template = getErrorTemplate(characterId, errorClass)!;
        const lower = template.toLowerCase();
        for (const banned of CORPORATE_BOT_BANNED) {
          expect(lower.includes(banned)).toBe(false);
        }
      }
    }
  });

  test("ruggy templates are lowercase (no leading capital · slangy register)", () => {
    for (const errorClass of ALL_ERROR_CLASSES) {
      const template = getErrorTemplate("ruggy", errorClass)!;
      // First non-whitespace character should be lowercase letter.
      const firstAlpha = template.match(/[A-Za-z]/);
      expect(firstAlpha).not.toBeNull();
      expect(firstAlpha![0]).toBe(firstAlpha![0]!.toLowerCase());
    }
  });

  test("satoshi templates start with capital letter (sentence-case · gnomic register)", () => {
    for (const errorClass of ALL_ERROR_CLASSES) {
      const template = getErrorTemplate("satoshi", errorClass)!;
      const firstAlpha = template.match(/[A-Za-z]/);
      expect(firstAlpha).not.toBeNull();
      expect(firstAlpha![0]).toBe(firstAlpha![0]!.toUpperCase());
    }
  });

  test("ruggy and satoshi do not share template bodies (registers diverge)", () => {
    // The whole point of the register is voice differentiation. If a
    // template ends up identical between characters, that's a copy-paste
    // smell — surface it.
    for (const errorClass of ALL_ERROR_CLASSES) {
      const r = getErrorTemplate("ruggy", errorClass);
      const s = getErrorTemplate("satoshi", errorClass);
      expect(r).not.toBe(s);
    }
  });
});

describe("composeErrorReply · bold-prefix shape", () => {
  test("output begins with **DisplayName** (shell-bot disambiguation)", () => {
    const reply = composeErrorReply("ruggy", "Ruggy", "timeout");
    expect(reply.startsWith("**Ruggy**\n\n")).toBe(true);
  });

  test("body follows the prefix and matches the registered template", () => {
    const reply = composeErrorReply("satoshi", "Satoshi", "empty");
    expect(reply).toContain("**Satoshi**");
    const template = getErrorTemplate("satoshi", "empty")!;
    expect(reply).toContain(template);
  });

  test("unknown character falls back to a bare template (still in-character minimal)", () => {
    const reply = composeErrorReply("stranger", "Stranger", "error");
    expect(reply.startsWith("**Stranger**\n\n")).toBe(true);
    // Substrate fallback should still avoid corporate register.
    const lower = reply.toLowerCase();
    for (const banned of CORPORATE_BOT_BANNED) {
      expect(lower.includes(banned)).toBe(false);
    }
  });
});

describe("DEFAULT_ERROR_REGISTRY · schema validation at module load", () => {
  test("registry decoded successfully (Schema.decodeUnknownSync at module load)", () => {
    // If the schema decode threw, this test wouldn't execute (module load
    // would fail). Reaching here proves the decode succeeded. We also
    // assert the shape one level deep for legibility.
    expect(DEFAULT_ERROR_REGISTRY).toBeDefined();
    expect(Object.keys(DEFAULT_ERROR_REGISTRY).sort()).toEqual([
      "ruggy",
      "satoshi",
    ]);
  });
});
