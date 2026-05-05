/**
 * Embed medium-aware tests — cycle R Sprint 3 R3.3.
 *
 * Verifies buildPostPayload threads opts.medium through the registry:
 *   1. Default (omitted opts.medium) preserves Sprint 1/2 behavior
 *      (uses DISCORD_WEBHOOK_DESCRIPTOR · embed=true · digest emits embed)
 *   2. CLI_DESCRIPTOR (no embed capability) → digest emits plain content,
 *      no embed
 *   3. DISCORD_INTERACTION_DESCRIPTOR (full surface) behaves like webhook
 *      for embed purposes (both have embed=true)
 *   4. Output remains byte-identical to pre-Sprint-3 for default callers
 */

import { describe, it, expect } from "bun:test";
import {
  CLI_DESCRIPTOR,
  DISCORD_WEBHOOK_DESCRIPTOR,
  DISCORD_INTERACTION_DESCRIPTOR,
} from "@0xhoneyjar/medium-registry";
import { buildPostPayload } from "./embed.ts";
import type { ZoneDigest } from "../score/types.ts";

const FIXTURE_DIGEST: ZoneDigest = {
  zone: "owsley-lab",
  computed_at: "2026-05-04T21:00:00Z",
  raw_stats: {
    spotlight: null,
    factor_trends: [],
    rank_changes: { climbed: [], dropped: [], unchanged: [] },
    window_event_count: 5,
  } as unknown as ZoneDigest["raw_stats"],
  narrative: "the lab quiet",
  narrative_error: null,
} as unknown as ZoneDigest;

describe("buildPostPayload — medium threading (cycle R sprint 3)", () => {
  describe("Default (no opts.medium) — back-compat", () => {
    it("digest emits embed when no medium specified (DISCORD_WEBHOOK default)", () => {
      const payload = buildPostPayload(FIXTURE_DIGEST, "voice text", "digest");
      expect(payload.embeds.length).toBe(1);
      expect(payload.embeds[0]?.description).toContain("voice text");
    });

    it("micro emits plain content (no embed) regardless of medium", () => {
      const payload = buildPostPayload(FIXTURE_DIGEST, "yo", "micro");
      expect(payload.embeds.length).toBe(0);
      expect(payload.content).toContain("yo");
    });
  });

  describe("DISCORD_WEBHOOK_DESCRIPTOR (Pattern B shell-bot · the persona-bot default)", () => {
    it("digest emits embed (webhook context · embed=true)", () => {
      const payload = buildPostPayload(FIXTURE_DIGEST, "voice text", "digest", {
        medium: DISCORD_WEBHOOK_DESCRIPTOR,
      });
      expect(payload.embeds.length).toBe(1);
    });

    it("output byte-identical to default (omitted) caller", () => {
      const a = buildPostPayload(FIXTURE_DIGEST, "voice", "digest");
      const b = buildPostPayload(FIXTURE_DIGEST, "voice", "digest", {
        medium: DISCORD_WEBHOOK_DESCRIPTOR,
      });
      expect(a).toEqual(b);
    });
  });

  describe("DISCORD_INTERACTION_DESCRIPTOR (slash + button + modal flows)", () => {
    it("digest emits embed (interaction context · embed=true)", () => {
      const payload = buildPostPayload(FIXTURE_DIGEST, "voice text", "digest", {
        medium: DISCORD_INTERACTION_DESCRIPTOR,
      });
      expect(payload.embeds.length).toBe(1);
    });
  });

  describe("CLI_DESCRIPTOR (no embed capability)", () => {
    it("digest emits PLAIN content when CLI medium (no embed cap)", () => {
      const payload = buildPostPayload(FIXTURE_DIGEST, "voice text", "digest", {
        medium: CLI_DESCRIPTOR,
      });
      expect(payload.embeds.length).toBe(0);
      expect(payload.content).toContain("voice text");
    });

    it("CLI strips ANSI escapes from voice (mediumId threading)", () => {
      const payload = buildPostPayload(
        FIXTURE_DIGEST,
        "hello\x1b[31mred\x1b[0m",
        "digest",
        { medium: CLI_DESCRIPTOR },
      );
      expect(payload.content).not.toContain("\x1b");
      expect(payload.content).toContain("hello");
    });

    it("Discord media DOES NOT strip ANSI from voice (different threat model)", () => {
      const payload = buildPostPayload(
        FIXTURE_DIGEST,
        "hello\x1b[31mred\x1b[0m",
        "digest",
        { medium: DISCORD_WEBHOOK_DESCRIPTOR },
      );
      // The voice goes into embed.description for digest type
      expect(payload.embeds[0]?.description).toContain("\x1b");
    });
  });
});
