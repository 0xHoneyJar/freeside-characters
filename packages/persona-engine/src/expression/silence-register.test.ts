/**
 * Silence-register tests · §4.4 (kickoff-2026-05-01).
 *
 * Verifies:
 *   - flat-window predicate returns true for the canonical empty case
 *     and false on each individual signal (events / climbed / spotlight)
 *   - ruggy has 4-6 templates per kickoff §4.4 deliverable
 *   - templates carry the in-voice register markers (lowercase ruggy ·
 *     italicized stage direction · vibe-close)
 *   - pickSilenceTemplate produces variance over many invocations
 *   - unknown character returns null (composer falls through to LLM)
 */

import { describe, test, expect } from "bun:test";
import {
  DEFAULT_SILENCE_REGISTRY,
  FLAT_WINDOW_EVENT_THRESHOLD,
  isFlatWindow,
  pickSilenceTemplate,
} from "./silence-register.ts";
import type { RawStats } from "../score/types.ts";

const FLAT_RAW_STATS: RawStats = {
  schema_version: "2.0.0",
  window_event_count: 12,
  window_wallet_count: 3,
  top_event_count: 12,
  top_wallet_count: 3,
  top_movers: [],
  top_events: [],
  spotlight: null,
  rank_changes: { climbed: [], dropped: [], entered_top_tier: [], exited_top_tier: [] },
  factor_trends: [],
};

describe("isFlatWindow · predicate", () => {
  test("flat: low events, no climbed, no spotlight", () => {
    expect(isFlatWindow(FLAT_RAW_STATS)).toBe(true);
  });

  test("not flat: high event count tips the predicate", () => {
    const stats: RawStats = {
      ...FLAT_RAW_STATS,
      window_event_count: FLAT_WINDOW_EVENT_THRESHOLD,
    };
    expect(isFlatWindow(stats)).toBe(false);
  });

  test("not flat: a single climber tips the predicate", () => {
    const stats: RawStats = {
      ...FLAT_RAW_STATS,
      rank_changes: {
        ...FLAT_RAW_STATS.rank_changes,
        climbed: [
          {
            wallet: "0xtest",
            current_rank: 5,
            prior_rank: 12,
            rank_delta: 7,
          } as RawStats["rank_changes"]["climbed"][number],
        ],
      },
    };
    expect(isFlatWindow(stats)).toBe(false);
  });

  test("not flat: a spotlight tips the predicate", () => {
    const stats: RawStats = {
      ...FLAT_RAW_STATS,
      spotlight: {
        wallet: "0xspotlight",
        reason: "anomaly",
      } as unknown as RawStats["spotlight"],
    };
    expect(isFlatWindow(stats)).toBe(false);
  });

  test("v1 shape (total_events fallback) still detects flat", () => {
    const stats: RawStats = {
      schema_version: "1.0.0",
      total_events: 5,
      active_wallets: 1,
      top_movers: [],
      top_events: [],
      spotlight: null,
      rank_changes: {
        climbed: [],
        dropped: [],
        entered_top_tier: [],
        exited_top_tier: [],
      },
      factor_trends: [],
    };
    expect(isFlatWindow(stats)).toBe(true);
  });
});

describe("DEFAULT_SILENCE_REGISTRY · ruggy templates", () => {
  test("ruggy has 4-6 templates per kickoff §4.4 deliverable", () => {
    const templates = DEFAULT_SILENCE_REGISTRY["ruggy"];
    expect(templates).toBeDefined();
    expect(templates!.length).toBeGreaterThanOrEqual(4);
    expect(templates!.length).toBeLessThanOrEqual(6);
  });

  test("ruggy templates include at least one italicized stage direction", () => {
    const templates = DEFAULT_SILENCE_REGISTRY["ruggy"]!;
    const italicized = templates.filter(
      (t) => t.startsWith("*") && t.trimEnd().endsWith("*"),
    );
    expect(italicized.length).toBeGreaterThanOrEqual(1);
  });

  test("ruggy templates include a vibe-close (stay groovy 🐻)", () => {
    const templates = DEFAULT_SILENCE_REGISTRY["ruggy"]!;
    const vibeClose = templates.find((t) => t.includes("stay groovy 🐻"));
    expect(vibeClose).toBeDefined();
  });

  test("non-italicized ruggy templates start lowercase (slangy register)", () => {
    const templates = DEFAULT_SILENCE_REGISTRY["ruggy"]!;
    for (const template of templates) {
      // Skip italicized stage directions (start with *).
      if (template.startsWith("*")) continue;
      const firstAlpha = template.match(/[A-Za-z]/);
      if (!firstAlpha) continue;
      expect(firstAlpha[0]).toBe(firstAlpha[0]!.toLowerCase());
    }
  });
});

describe("DEFAULT_SILENCE_REGISTRY · satoshi mirror of persona doctrine", () => {
  test("satoshi entry exists (mirrors persona.md performed-silence)", () => {
    expect(DEFAULT_SILENCE_REGISTRY["satoshi"]).toBeDefined();
  });

  test("satoshi templates include the brief dismissal from persona.md", () => {
    const templates = DEFAULT_SILENCE_REGISTRY["satoshi"]!;
    const briefDismissal = templates.find((t) =>
      t.includes("nothing of note here"),
    );
    expect(briefDismissal).toBeDefined();
  });
});

describe("pickSilenceTemplate · hot-path lookup", () => {
  test("returns one of the registered templates for ruggy", () => {
    const ruggyTemplates = new Set(DEFAULT_SILENCE_REGISTRY["ruggy"]!);
    const pick = pickSilenceTemplate("ruggy");
    expect(pick).not.toBeNull();
    expect(ruggyTemplates.has(pick!)).toBe(true);
  });

  test("variance — 60 invocations yield > 1 distinct templates", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const pick = pickSilenceTemplate("ruggy");
      if (pick) seen.add(pick);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("unknown character returns null (composer falls through to LLM)", () => {
    expect(pickSilenceTemplate("nonexistent-char")).toBeNull();
  });
});
