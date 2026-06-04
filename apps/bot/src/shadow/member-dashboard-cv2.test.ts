/**
 * member-dashboard-cv2.test.ts — the VOICELESS member-centric CM dashboard render
 * (bd-l08). Proves the CV2 grammar, inert mentions, the summary counts, the
 * per-member before→after rows grouped by indicator, the default-seed flag, and
 * the injection guard (attacker nick / role name neutralized).
 */
import { describe, expect, test } from "bun:test";
import {
  renderMemberDashboardCV2,
  memberDashboardCV2Payload,
  type MemberDashboardContext,
} from "./member-dashboard-cv2.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import { summarize, type MemberTierRow, type MemberRosterResult } from "./member-roster.ts";

function rosterOf(rows: MemberTierRow[]): MemberRosterResult {
  return { rows, summary: summarize(rows) };
}

const CTX: MemberDashboardContext = { world: "purupuru", mapSource: "default-seed" };

const ADD_ROW: MemberTierRow = {
  discord_id: "700000000000000001",
  display_name: "soju",
  linked: true,
  wallet: "0xabc",
  tier: "member",
  proposed_role_key: "purupuru:member",
  current_managed_roles: [],
  change: "ADD",
};
const KEEP_ROW: MemberTierRow = {
  discord_id: "700000000000000004",
  display_name: "keeper",
  linked: true,
  wallet: "0xdef",
  tier: "core",
  proposed_role_key: "purupuru:core",
  current_managed_roles: ["purupuru:core"],
  change: "KEEP",
};
const UNLINKED_ROW: MemberTierRow = {
  discord_id: "700000000000000002",
  display_name: "nolink",
  linked: false,
  current_managed_roles: [],
  change: "UNLINKED",
};

describe("bd-l08 — member-centric dashboard CV2 render (structural, voiceless)", () => {
  test("CV2 grammar: container 17, text 10, separator 14", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    expect(c.type).toBe(17);
    expect(typeof c.accent_color).toBe("number");
    const types = c.components.map((x) => x.type);
    expect(types).toContain(10);
    expect(types).toContain(14);
  });

  test("payload: IS_COMPONENTS_V2 flag + inert mentions, no content/embeds", () => {
    const p = memberDashboardCV2Payload(rosterOf([]), CTX);
    expect(p.flags & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    expect(p.allowed_mentions).toEqual({ parse: [] });
    expect((p as { content?: string }).content).toBeUndefined();
  });

  test("summary counts surfaced in the header", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW, KEEP_ROW, UNLINKED_ROW]), CTX);
    const txt = JSON.stringify(c.components);
    expect(txt).toContain("3** members");
    expect(txt).toContain("2** linked");
    expect(txt).toContain("1** would-add");
    expect(txt).toContain("1** keep");
    expect(txt).toContain("1** unlinked");
  });

  test("per-member before→after row: current → proposed with the tier note", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    const contents = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content)
      .join("\n");
    // operator-style row: soju (tier member) · (none) → purupuru:member, ADD group.
    expect(contents).toContain("Would add (1)");
    expect(contents).toContain("soju");
    expect(contents).toContain("purupuru:member");
    expect(contents).toContain("→");
  });

  test("groups are actionable-first: ADD heading precedes KEEP heading", () => {
    const c = renderMemberDashboardCV2(rosterOf([KEEP_ROW, ADD_ROW]), CTX);
    const headings = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content);
    const addIdx = headings.findIndex((h) => h.includes("Would add"));
    const keepIdx = headings.findIndex((h) => h.includes("Keep"));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(keepIdx).toBeGreaterThan(addIdx);
  });

  test("default-seed provenance flagged for the CM", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    expect(JSON.stringify(c.components)).toContain("DEFAULT SEED");
  });

  test("unlinked row renders an (unlinked) proposed cell", () => {
    const c = renderMemberDashboardCV2(rosterOf([UNLINKED_ROW]), CTX);
    const contents = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content)
      .join("\n");
    expect(contents).toContain("Unlinked");
    expect(contents).toContain("nolink");
  });

  test("INJECTION GUARD: an attacker nick / role name is neutralized", () => {
    const evil: MemberTierRow = {
      discord_id: "700000000000000009",
      display_name: "@everyone",
      linked: true,
      wallet: "0x1",
      tier: "core",
      proposed_role_key: "**bold** `code`",
      current_managed_roles: [],
      change: "ADD",
    };
    const c = renderMemberDashboardCV2(rosterOf([evil]), CTX);
    const contents = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content)
      .join("\n");
    // @everyone broken (zero-width inserted after @).
    expect(contents).not.toContain("@everyone");
    // markdown control chars escaped.
    expect(contents).toContain("\\*\\*bold\\*\\*");
  });

  test("empty roster renders header + summary, no row groups", () => {
    const c = renderMemberDashboardCV2(rosterOf([]), CTX);
    const txt = JSON.stringify(c.components);
    expect(txt).toContain("0** members");
    expect(txt).not.toContain("Would add");
  });
});
