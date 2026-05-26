// Phase 33C · public-safe Recall Wedge renderer regression gate.
//
// Drives `renderPublicRecallProjection` against the Phase 33B projected-DTO
// fixtures shipped in `docs/recall-wedge/fixtures/projected-dto/`. Proves:
//
//   1. public_discord/discord_public_character DTOs render successfully;
//   2. character-boundary referrals render with safe target + message;
//   3. operator_private/operator_debug DTOs are rejected for public render;
//   4. unknown recall_interface / unknown render_surface are rejected;
//   5. rendered public output contains none of the Phase 33B banned
//      substrings (PRIVATE_SENTINEL, raw_reasons, debug, assertion_id, etc);
//   6. rendered public output never carries a continuity actor identifier —
//      `actor:` line and the `freeside-characters:shared-substrate` id stay
//      off the public surface per docs/RECALL-WEDGE-MEMORY-MVP.md §9.
//
// Fixture files are read directly so the renderer is exercised on the
// canonical Phase 33B DTOs, not on hand-crafted inlined JSON.

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PublicRecallRenderError,
  isPublicRecallProjectionRenderable,
  renderPublicRecallProjection,
  renderPublicRecallProjectionLines,
} from "./render-public-recall.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(
  __dirname,
  "../../../../docs/recall-wedge/fixtures/projected-dto",
);

function loadFixture(name: string): unknown {
  const path = resolve(FIXTURE_DIR, name);
  return JSON.parse(readFileSync(path, "utf8"));
}

const PUBLIC_DISCORD_DTO = loadFixture("public-discord-view.dto.json");
const REFERRAL_DTO = loadFixture("character-boundary-referral.dto.json");
const OPERATOR_PRIVATE_DTO = loadFixture("operator-private-view.dto.json");

const BANNED_PUBLIC_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
  "debug",
  "private_assertion",
  "private assertion",
  "assertion_id",
  "source_material",
  "hidden estate",
  "full assertion bodies",
  "private identifiers",
] as const;

describe("isPublicRecallProjectionRenderable", () => {
  test("accepts a public_discord/discord_public_character ok DTO", () => {
    expect(isPublicRecallProjectionRenderable(PUBLIC_DISCORD_DTO)).toBe(true);
  });

  test("accepts a public_discord referral DTO", () => {
    expect(isPublicRecallProjectionRenderable(REFERRAL_DTO)).toBe(true);
  });

  test("rejects an operator_private/operator_debug DTO", () => {
    expect(isPublicRecallProjectionRenderable(OPERATOR_PRIVATE_DTO)).toBe(false);
  });

  test("rejects unknown recall_interface", () => {
    expect(
      isPublicRecallProjectionRenderable({
        ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
        recall_interface: "web_chat_fixture",
      }),
    ).toBe(false);
  });

  test("rejects unknown render_surface", () => {
    expect(
      isPublicRecallProjectionRenderable({
        ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
        render_surface: "operator_debug",
      }),
    ).toBe(false);
  });

  test("rejects non-object input", () => {
    expect(isPublicRecallProjectionRenderable(null)).toBe(false);
    expect(isPublicRecallProjectionRenderable("nope")).toBe(false);
    expect(isPublicRecallProjectionRenderable([PUBLIC_DISCORD_DTO])).toBe(false);
  });
});

describe("renderPublicRecallProjection · public-discord ok DTO", () => {
  const text = renderPublicRecallProjection(PUBLIC_DISCORD_DTO);
  const lines = renderPublicRecallProjectionLines(PUBLIC_DISCORD_DTO);

  test("returns a non-empty multi-line billboard", () => {
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(lines.length).toBeGreaterThan(1);
  });

  test("header tags the public character frame", () => {
    expect(lines[0]).toContain("[recall · public · ruggy · ok]");
  });

  test("includes counts derived from the DTO (not raw private reasons)", () => {
    expect(text).toContain("included=3");
    expect(text).toContain("redacted=1");
    expect(text).toContain("excluded=1");
    expect(text).toContain("marked=0");
  });

  test("includes safe public reason labels and counts", () => {
    expect(text).toContain("redacted_for_public_surface=1");
    expect(text).toContain("excluded_from_public_surface=1");
    expect(text).toContain("redacted_for_public_surface");
    expect(text).toContain("excluded_from_public_surface");
  });

  test("includes the DTO's public_summary verbatim", () => {
    expect(text).toContain(
      "actor is rehearsing the cross-interface continuity demo",
    );
  });

  test("contains no banned-public substrings", () => {
    for (const banned of BANNED_PUBLIC_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("does not emit a continuity actor line on the public surface", () => {
    // §9 allowlist excludes continuity_actor_id from public output. The
    // renderer must never emit an `actor:` line, even when the DTO carries
    // a non-empty continuity_actor_id.
    expect(text).not.toContain("actor:");
    expect(text).not.toContain("freeside-characters:shared-substrate");
    for (const line of lines) {
      expect(line.startsWith("actor:")).toBe(false);
    }
  });
});

describe("renderPublicRecallProjection · character-boundary referral DTO", () => {
  const text = renderPublicRecallProjection(REFERRAL_DTO);
  const lines = renderPublicRecallProjectionLines(REFERRAL_DTO);

  test("header tags the referral outcome", () => {
    expect(lines[0]).toContain("referral");
  });

  test("includes the safe_referral_target", () => {
    expect(text).toContain("referral target: satoshi");
  });

  test("includes the public_referral_message", () => {
    expect(text).toContain("referral message: that lives closer to satoshi");
  });

  test("contains no banned-public substrings", () => {
    for (const banned of BANNED_PUBLIC_SUBSTRINGS) {
      expect(text).not.toContain(banned);
    }
  });

  test("does not emit a continuity actor line on the public surface", () => {
    expect(text).not.toContain("actor:");
    expect(text).not.toContain("freeside-characters:shared-substrate");
    for (const line of lines) {
      expect(line.startsWith("actor:")).toBe(false);
    }
  });
});

describe("renderPublicRecallProjection · rejection paths", () => {
  test("rejects operator_private DTO with a typed render error", () => {
    expect(() => renderPublicRecallProjection(OPERATOR_PRIVATE_DTO)).toThrow(
      PublicRecallRenderError,
    );
  });

  test("operator_debug render_surface is rejected", () => {
    const dto = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      render_surface: "operator_debug",
    };
    expect(() => renderPublicRecallProjection(dto)).toThrow(
      /render_surface must be discord_public_character/,
    );
  });

  test("unknown recall_interface is rejected", () => {
    const dto = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      recall_interface: "totally_unknown_frame",
    };
    expect(() => renderPublicRecallProjection(dto)).toThrow(
      /recall_interface must be public_discord/,
    );
  });

  test("unknown outcome is rejected", () => {
    const dto = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      outcome: "exploding",
    };
    expect(() => renderPublicRecallProjection(dto)).toThrow(/outcome must be/);
  });

  test("referral outcome without safe_referral_target is rejected", () => {
    const dto = {
      ...(REFERRAL_DTO as Record<string, unknown>),
      safe_referral_target: undefined,
    };
    expect(() => renderPublicRecallProjection(dto)).toThrow(
      /safe_referral_target/,
    );
  });

  test("referral outcome without public_referral_message is rejected", () => {
    const dto = {
      ...(REFERRAL_DTO as Record<string, unknown>),
      public_referral_message: undefined,
    };
    expect(() => renderPublicRecallProjection(dto)).toThrow(
      /public_referral_message/,
    );
  });

  test("non-object input is rejected", () => {
    expect(() => renderPublicRecallProjection(null)).toThrow(
      PublicRecallRenderError,
    );
    expect(() => renderPublicRecallProjection("nope")).toThrow(
      PublicRecallRenderError,
    );
  });
});

describe("renderPublicRecallProjection · fail-closed on contaminated public-framed DTOs", () => {
  // A public-framed DTO that smuggles operator-private material must fail
  // closed — the renderer rejects on input deep-scan before any projection,
  // even if the banned field would be ignored by the safe-output allowlist.
  // Defense in depth: the rendered-output scan still catches anything that
  // somehow slips into a surfaced field.
  test("rejects when public framing is claimed but PRIVATE_SENTINEL is smuggled in public_summary", () => {
    const smuggled = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      public_summary:
        "summary with PRIVATE_SENTINEL_OPERATOR_ONLY embedded — must not be emitted",
    };
    expect(() => renderPublicRecallProjection(smuggled)).toThrow(
      PublicRecallRenderError,
    );
    try {
      renderPublicRecallProjection(smuggled);
    } catch (err) {
      expect(err).toBeInstanceOf(PublicRecallRenderError);
      expect((err as PublicRecallRenderError).code).toMatch(
        /banned_private_material_in_input|banned_substring_in_output/,
      );
    }
  });

  test("rejects a public-framed DTO contaminated with raw_reasons_for_operator_review and PRIVATE_SENTINEL in an ignored field", () => {
    const polluted = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      operator_private_diagnostics: {
        raw_reasons_for_operator_review: ["should_not_appear"],
        operator_private_note: "PRIVATE_SENTINEL_OPERATOR_ONLY",
      },
    };
    expect(() => renderPublicRecallProjection(polluted)).toThrow(
      PublicRecallRenderError,
    );
    try {
      renderPublicRecallProjection(polluted);
    } catch (err) {
      expect(err).toBeInstanceOf(PublicRecallRenderError);
      expect((err as PublicRecallRenderError).code).toBe(
        "banned_private_material_in_input",
      );
    }
  });

  test("isPublicRecallProjectionRenderable returns false for a contaminated public-framed DTO", () => {
    const polluted = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      operator_private_diagnostics: {
        raw_reasons_for_operator_review: ["should_not_appear"],
        operator_private_note: "PRIVATE_SENTINEL_OPERATOR_ONLY",
      },
    };
    expect(isPublicRecallProjectionRenderable(polluted)).toBe(false);
  });

  test("rejects a banned substring buried in a deeply nested array value", () => {
    const buried = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      extra_envelope: {
        nested: [
          { harmless: "fine" },
          { also_harmless: ["ok", "PRIVATE_SENTINEL_DEEPLY_BURIED"] },
        ],
      },
    };
    expect(() => renderPublicRecallProjection(buried)).toThrow(
      PublicRecallRenderError,
    );
    try {
      renderPublicRecallProjection(buried);
    } catch (err) {
      expect((err as PublicRecallRenderError).code).toBe(
        "banned_private_material_in_input",
      );
    }
  });

  test("rejects a banned key name even when the value is innocuous", () => {
    const bannedKey = {
      ...(PUBLIC_DISCORD_DTO as Record<string, unknown>),
      private_assertion_id: "anything-here",
    };
    expect(() => renderPublicRecallProjection(bannedKey)).toThrow(
      PublicRecallRenderError,
    );
    expect(isPublicRecallProjectionRenderable(bannedKey)).toBe(false);
  });
});
