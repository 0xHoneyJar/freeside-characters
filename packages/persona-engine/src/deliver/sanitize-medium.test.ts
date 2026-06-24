/**
 * Sanitize medium-aware extension tests — cycle R Sprint 3 R3.4.
 *
 * Verifies:
 *   1. mediumId='cli' threading strips ANSI escape sequences (defense-in-depth)
 *   2. mediumId='discord-webhook' / 'discord-interaction' / undefined → no extra
 *      transforms (back-compat with Sprint 1 callers)
 *   3. Universal voice-discipline transforms (em-dash, asterisk, closings)
 *      remain UNCONDITIONAL across all mediumId values per architect lock A4
 */

import { describe, it, expect } from "bun:test";
import { stripVoiceDisciplineDrift } from "./sanitize.ts";

describe("stripVoiceDisciplineDrift — medium threading (cycle R sprint 3)", () => {
  describe("CLI medium · ANSI strip", () => {
    it("strips CSI sequences when mediumId='cli'", () => {
      const dirty = "hello\x1b[31mred\x1b[0m world";
      const out = stripVoiceDisciplineDrift(dirty, {
        postType: "micro",
        mediumId: "cli",
      });
      expect(out).not.toMatch(/\x1b/);
      // Non-ANSI text content survives the strip
      expect(out).toContain("hello");
      expect(out).toContain("world");
    });

    it("strips OSC sequences (window title injection) when CLI", () => {
      const dirty = "hello\x1b]0;PWNED\x07world";
      const out = stripVoiceDisciplineDrift(dirty, {
        postType: "micro",
        mediumId: "cli",
      });
      expect(out).not.toMatch(/\x1b/);
      expect(out).not.toContain("PWNED");
    });

    it("strips screen-clear escapes when CLI", () => {
      const dirty = "hello\x1b[2Jworld";
      const out = stripVoiceDisciplineDrift(dirty, {
        postType: "micro",
        mediumId: "cli",
      });
      expect(out).not.toContain("\x1b[2J");
    });
  });

  describe("Discord medium · ANSI escapes preserved (different threat model)", () => {
    it("does NOT strip ANSI when mediumId='discord-webhook'", () => {
      // Discord renders ANSI as-text (no terminal interpretation), so the
      // injection threat model doesn't apply. Persona-bots may quote
      // `\x1b[31m` in code blocks intentionally.
      const text = "see `\\x1b[31m` for SGR red";
      const out = stripVoiceDisciplineDrift(text, {
        postType: "micro",
        mediumId: "discord-webhook",
      });
      // The text was NOT touched by ANSI strip (it had no real ANSI either)
      expect(out).toContain("\\x1b[31m");
    });

    it("does NOT strip ANSI when mediumId='discord-interaction'", () => {
      const dirty = "hello\x1b[31mred\x1b[0m";
      const out = stripVoiceDisciplineDrift(dirty, {
        postType: "micro",
        mediumId: "discord-interaction",
      });
      // ANSI bytes pass through (Discord won't render them as colors)
      expect(out).toContain("\x1b");
    });

    it("does NOT strip ANSI when mediumId is undefined (back-compat)", () => {
      // Sprint 1 callers don't thread mediumId — preserve their behavior.
      const dirty = "hello\x1b[31mred\x1b[0m";
      const out = stripVoiceDisciplineDrift(dirty, { postType: "micro" });
      expect(out).toContain("\x1b");
    });
  });

  describe("Universal voice-discipline UNCHANGED across mediums (architect lock A4)", () => {
    it("strips em-dash for CLI medium", () => {
      const out = stripVoiceDisciplineDrift("yo — wild stuff", {
        postType: "micro",
        mediumId: "cli",
      });
      expect(out).not.toMatch(/—/);
    });

    it("strips em-dash for Discord webhook medium", () => {
      const out = stripVoiceDisciplineDrift("yo — wild stuff", {
        postType: "micro",
        mediumId: "discord-webhook",
      });
      expect(out).not.toMatch(/—/);
    });

    it("strips em-dash for Discord interaction medium", () => {
      const out = stripVoiceDisciplineDrift("yo — wild stuff", {
        postType: "micro",
        mediumId: "discord-interaction",
      });
      expect(out).not.toMatch(/—/);
    });

    it("strips asterisk roleplay regardless of medium", () => {
      const text = "*adjusts cabling* the score is up";
      const cli = stripVoiceDisciplineDrift(text, {
        postType: "micro",
        mediumId: "cli",
      });
      const dw = stripVoiceDisciplineDrift(text, {
        postType: "micro",
        mediumId: "discord-webhook",
      });
      expect(cli).not.toMatch(/\*adjusts cabling\*/);
      expect(dw).not.toMatch(/\*adjusts cabling\*/);
    });

    it("preserves digest closing across mediums", () => {
      const text = "big week.\n\nstay groovy 🐻";
      const cli = stripVoiceDisciplineDrift(text, {
        postType: "digest",
        mediumId: "cli",
      });
      const dw = stripVoiceDisciplineDrift(text, {
        postType: "digest",
        mediumId: "discord-webhook",
      });
      expect(cli).toMatch(/stay groovy/);
      expect(dw).toMatch(/stay groovy/);
    });

    it("strips micro closing across mediums", () => {
      const text = "thinking on it.\n\nstay groovy 🐻";
      const cli = stripVoiceDisciplineDrift(text, {
        postType: "micro",
        mediumId: "cli",
      });
      const dw = stripVoiceDisciplineDrift(text, {
        postType: "micro",
        mediumId: "discord-webhook",
      });
      expect(cli).not.toMatch(/stay groovy/);
      expect(dw).not.toMatch(/stay groovy/);
    });
  });

  describe("Idempotency across medium threading", () => {
    it("CLI medium is idempotent", () => {
      const dirty = "hello\x1b[31mred\x1b[0m world — cool";
      const once = stripVoiceDisciplineDrift(dirty, {
        postType: "micro",
        mediumId: "cli",
      });
      const twice = stripVoiceDisciplineDrift(once, {
        postType: "micro",
        mediumId: "cli",
      });
      expect(once).toBe(twice);
    });
  });
});
