/**
 * member-dashboard-cv2.test.ts — the VOICELESS member-centric CM dashboard render
 * (bd-l08; redesigned bd-xaa). Proves the CV2 grammar, inert mentions, the
 * 3-tier weight gradient (# title · ## strong center · ### groups · -# dim),
 * change-aware rows (ADD proposed-leads, KEEP compressed), the collapsed
 * non-actionable line, the namespace-strip, the seed accent flip, the adoption
 * line, the Apply decision-fence affordance, and the injection guard.
 */
import { describe, expect, test } from "bun:test";
import {
  renderMemberDashboardCV2,
  memberDashboardCV2Payload,
  buildApplyButton,
  ROLE_SYNC_PREFIX,
  type MemberDashboardContext,
} from "./member-dashboard-cv2.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import { summarize, type MemberTierRow, type MemberRosterResult } from "./member-roster.ts";

function rosterOf(rows: MemberTierRow[]): MemberRosterResult {
  return { rows, summary: summarize(rows) };
}

const CTX: MemberDashboardContext = { world: "purupuru", mapSource: "default-seed" };
const CTX_AUTHORED: MemberDashboardContext = { world: "purupuru", mapSource: "config-service" };

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
const UNTIERED_ROW: MemberTierRow = {
  discord_id: "700000000000000003",
  display_name: "lowtier",
  linked: true,
  wallet: "0xeee",
  current_managed_roles: ["purupuru:member"],
  change: "UNTIERED",
};

/** Collect every type-10 text content joined for substring assertions. */
function texts(c: ReturnType<typeof renderMemberDashboardCV2>): string {
  return c.components
    .filter((x): x is { type: 10; content: string } => x.type === 10)
    .map((x) => x.content)
    .join("\n");
}

describe("bd-xaa — member dashboard redesign (3-tier weight gradient, voiceless)", () => {
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

  test("TITLE: `# Member roles — \\`world\\`` (no SHADOW-preview parenthetical)", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    const t = texts(c);
    expect(t).toContain("# Member roles — `purupuru`");
    expect(t).not.toContain("(SHADOW preview)");
  });

  test("TRUST FRAME: ONE dim -# line (SHADOW · zero writes · map provenance)", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    const t = texts(c);
    expect(t).toContain("-# SHADOW preview · zero writes · map:");
  });

  test("STRONG CENTER: `## N would gain a role` + correct/not-actionable line", () => {
    const c = renderMemberDashboardCV2(
      rosterOf([ADD_ROW, KEEP_ROW, UNLINKED_ROW, UNTIERED_ROW]),
      CTX,
    );
    const t = texts(c);
    expect(t).toContain("## 1 would gain a role");
    // keep=1, not-actionable = unlinked(1)+untiered(1)+noChange(0) = 2
    expect(t).toContain("`1` already correct · 2 not actionable");
    // headline drops members/linked from the strong center.
    expect(t).not.toContain("members ·");
  });

  test("ADD rows are change-aware: proposed LEADS, no dead `_(none)_ →` arrow", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    const t = texts(c);
    expect(t).toContain("### Would gain a role (1)");
    expect(t).toContain("➕ **soju** → `member`"); // namespace stripped
    expect(t).toContain("(tier `member`)");
    expect(t).not.toContain("_(none)_ →");
  });

  test("KEEP rows compress: `✅ **name** \\`role\\`` (no before→after)", () => {
    const c = renderMemberDashboardCV2(rosterOf([KEEP_ROW]), CTX);
    const t = texts(c);
    expect(t).toContain("### Already correct (1)");
    expect(t).toContain("✅ **keeper** `core`");
    expect(t).not.toContain("→"); // KEEP carries no arrow
  });

  test("namespace prefix `purupuru:` is STRIPPED from rendered role spans", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW, KEEP_ROW]), CTX);
    const t = texts(c);
    expect(t).not.toContain("purupuru:member");
    expect(t).not.toContain("purupuru:core");
    expect(t).toContain("`member`");
    expect(t).toContain("`core`");
  });

  test("groups are actionable-first: ADD heading precedes KEEP heading", () => {
    const c = renderMemberDashboardCV2(rosterOf([KEEP_ROW, ADD_ROW]), CTX);
    const headings = c.components
      .filter((x): x is { type: 10; content: string } => x.type === 10)
      .map((x) => x.content);
    const addIdx = headings.findIndex((h) => h.includes("Would gain a role ("));
    const keepIdx = headings.findIndex((h) => h.includes("Already correct"));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(keepIdx).toBeGreaterThan(addIdx);
  });

  test("NON-ACTIONABLE collapses to ONE -# line, NO per-member rows", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW, UNLINKED_ROW, UNTIERED_ROW]), CTX);
    const t = texts(c);
    expect(t).toContain("-# Not actionable — 1 untiered · 1 unlinked · 0 no change");
    // the unlinked / untiered members do NOT get their own rows.
    expect(t).not.toContain("nolink");
    expect(t).not.toContain("lowtier");
  });

  test("ADOPTION line: `N of M members have linked a wallet` (KEEPER)", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW, UNLINKED_ROW]), CTX);
    const t = texts(c);
    // linked=1, members=2
    expect(t).toContain("-# 1 of 2 members have linked a wallet");
  });

  test("ADOPTION line omitted when every member has linked", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW, KEEP_ROW]), CTX);
    const t = texts(c);
    expect(t).not.toContain("have linked a wallet");
  });

  test("ACCENT: default-seed flips to amber 0xe0a83d", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    expect(c.accent_color).toBe(0xe0a83d);
    const t = texts(c);
    expect(t).toContain("⚠ default seed (overridable)");
  });

  test("ACCENT: CM-authored map → honey 0x6f4ea1, no seed warning token", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX_AUTHORED);
    expect(c.accent_color).toBe(0x6f4ea1);
    const t = texts(c);
    expect(t).toContain("map: CM-authored");
    expect(t).not.toContain("default seed (overridable)");
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
    const t = texts(c);
    expect(t).not.toContain("@everyone"); // zero-width inserted after @
    expect(t).toContain("\\*\\*bold\\*\\*"); // markdown control chars escaped
  });

  test("empty roster renders title + strong center, no row groups", () => {
    const c = renderMemberDashboardCV2(rosterOf([]), CTX);
    const t = texts(c);
    expect(t).toContain("## 0 would gain a role");
    expect(t).not.toContain("### Would gain a role (");
    expect(t).not.toContain("### Already correct");
  });
});

describe("bd-20x — Apply decision-fence affordance (two-step entrypoint)", () => {
  test("with apply ctx: a full-weight Separator + an ActionRow are the LAST children", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), {
      ...CTX,
      apply: { mapHash12: "abc123def456" },
    });
    const last = c.components[c.components.length - 1]!;
    expect(last.type).toBe(1); // ActionRow last
    const prevSep = c.components[c.components.length - 2]!;
    expect(prevSep.type).toBe(14); // decision fence (Separator) precedes it
  });

  test("Apply button: PRIMARY + enabled with `Apply (N)` when would_add > 0", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), {
      ...CTX,
      apply: { mapHash12: "abc123def456" },
    });
    const row = c.components.find((x) => x.type === 1) as { type: 1; components: unknown[] };
    const btn = (row.components as Array<{ style: number; label: string; custom_id: string; disabled?: boolean }>)[0]!;
    expect(btn.style).toBe(1); // PRIMARY
    expect(btn.label).toBe("Apply (1)");
    expect(btn.disabled).toBeFalsy();
    expect(btn.custom_id).toBe(`${ROLE_SYNC_PREFIX}apply:purupuru:abc123def456`);
  });

  test("Apply button: SECONDARY + disabled `Nothing to apply` when would_add === 0", () => {
    const c = renderMemberDashboardCV2(rosterOf([KEEP_ROW]), {
      ...CTX,
      apply: { mapHash12: "abc123def456" },
    });
    const row = c.components.find((x) => x.type === 1) as { type: 1; components: unknown[] };
    const btn = (row.components as Array<{ style: number; label: string; disabled?: boolean }>)[0]!;
    expect(btn.style).toBe(2); // SECONDARY
    expect(btn.label).toBe("Nothing to apply");
    expect(btn.disabled).toBe(true);
  });

  test("no apply ctx ⇒ no decision fence / button (pure render)", () => {
    const c = renderMemberDashboardCV2(rosterOf([ADD_ROW]), CTX);
    expect(c.components.some((x) => x.type === 1)).toBe(false);
  });

  test("buildApplyButton custom_id is content-addressed by the map hash", () => {
    const btn = buildApplyButton("purupuru", 3, "deadbeef0000");
    expect(btn.custom_id).toBe("rolesync:apply:purupuru:deadbeef0000");
    expect(btn.label).toBe("Apply (3)");
  });
});
