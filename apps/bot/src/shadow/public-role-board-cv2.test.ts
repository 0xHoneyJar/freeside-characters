/**
 * public-role-board-cv2.test.ts — the PUBLIC, world-themed, VOICELESS live role
 * board render (cycle public-role-board). Network-free: inject a
 * `MemberRosterResult` fixture + a role-map → assert the CV2 tree: the tier
 * ladder with per-tier counts, the honey accent, the adoption line, world
 * theming, the injection guard, and that it is READ-ONLY (no per-member action /
 * no Apply affordance).
 */
import { describe, expect, test } from "bun:test";
import {
  renderPublicRoleBoardCV2,
  publicRoleBoardCV2Payload,
  buildLadder,
  ACCENT_HONEY,
  type PublicRoleBoardContext,
} from "./public-role-board-cv2.ts";
import { IS_COMPONENTS_V2 } from "./discrepancy-cv2.ts";
import { summarize, type MemberTierRow, type MemberRosterResult } from "./member-roster.ts";
import { buildPurupuruSeedRoleMap } from "./role-sync-seed-map.ts";
import type { RoleMapConfig } from "./substrate.ts";

function rosterOf(rows: MemberTierRow[]): MemberRosterResult {
  return { rows, summary: summarize(rows) };
}

const SEED_MAP: RoleMapConfig = buildPurupuruSeedRoleMap();
const CTX: PublicRoleBoardContext = { world: "purupuru", roleMap: SEED_MAP, generatedAt: "2026-06-04T00:00:00Z" };

/** A linked member resolved to a given tier (counts toward that rung). */
function tieredMember(id: string, name: string, tier: string): MemberTierRow {
  return {
    discord_id: id,
    display_name: name,
    linked: true,
    wallet: `0x${id}`,
    tier,
    proposed_role_key: `purupuru:${tier}`,
    current_managed_roles: [],
    change: "ADD",
  };
}

const UNLINKED: MemberTierRow = {
  discord_id: "700000000000000099",
  display_name: "nolink",
  linked: false,
  current_managed_roles: [],
  change: "UNLINKED",
};

const FIXTURE = rosterOf([
  tieredMember("700000000000000001", "soju", "sovereign"),
  tieredMember("700000000000000002", "elderA", "elder"),
  tieredMember("700000000000000003", "elderB", "elder"),
  tieredMember("700000000000000004", "coreA", "core"),
  tieredMember("700000000000000005", "memberA", "member"),
  tieredMember("700000000000000006", "memberB", "member"),
  tieredMember("700000000000000007", "memberC", "member"),
  UNLINKED,
]);

function textContents(c: ReturnType<typeof renderPublicRoleBoardCV2>): string[] {
  return c.components
    .filter((x): x is { type: 10; content: string } => x.type === 10)
    .map((x) => x.content);
}

describe("public-role-board — CV2 render (structural, voiceless, read-only)", () => {
  test("CV2 grammar: container 17, honey accent, text 10 + separator 14", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    expect(c.type).toBe(17);
    expect(c.accent_color).toBe(ACCENT_HONEY);
    const types = c.components.map((x) => x.type);
    expect(types).toContain(10);
    expect(types).toContain(14);
  });

  test("payload: IS_COMPONENTS_V2 flag + inert mentions, no content/embeds", () => {
    const p = publicRoleBoardCV2Payload(FIXTURE, CTX);
    expect(p.flags & IS_COMPONENTS_V2).toBe(IS_COMPONENTS_V2);
    expect(p.allowed_mentions).toEqual({ parse: [] });
    expect((p as { content?: string }).content).toBeUndefined();
    expect((p as { embeds?: unknown[] }).embeds).toBeUndefined();
  });

  test("world theming: the world title appears in the header", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const txt = textContents(c).join("\n");
    expect(txt).toContain("Purupuru");
    expect(txt).toContain("tier landscape");
  });

  test("tier ladder: every configured tier renders with its lore name + count", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const txt = textContents(c).join("\n");
    // lore display names (seed = title-cased tier ids; world-customizable via map).
    for (const name of ["Sovereign", "Elder", "Core", "Member", "Devoted", "Newcomer"]) {
      expect(txt).toContain(name);
    }
    // per-tier counts: 1 sovereign, 2 elder, 1 core, 3 member, 0 devoted/newcomer.
    expect(txt).toContain("`1` member");
    expect(txt).toContain("`2` members");
    expect(txt).toContain("`3` members");
    expect(txt).toContain("`0` members");
  });

  test("ladder is a top-down progression: apex (Sovereign) precedes the crowd (Newcomer)", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const ladder = textContents(c).find((t) => t.includes("Sovereign"))!;
    const sovIdx = ladder.indexOf("Sovereign");
    const newIdx = ladder.indexOf("Newcomer");
    expect(sovIdx).toBeGreaterThanOrEqual(0);
    expect(newIdx).toBeGreaterThan(sovIdx);
  });

  test("buildLadder: ascending strength order, exact per-tier counts", () => {
    const rungs = buildLadder(FIXTURE, SEED_MAP, (t) =>
      ({ newcomer: 1, member: 2, devoted: 3, core: 4, elder: 5, sovereign: 6 })[t.toLowerCase()],
    );
    expect(rungs.map((r) => r.tier)).toEqual([
      "newcomer",
      "member",
      "devoted",
      "core",
      "elder",
      "sovereign",
    ]);
    const counts = Object.fromEntries(rungs.map((r) => [r.tier, r.count]));
    expect(counts).toEqual({ newcomer: 0, member: 3, devoted: 0, core: 1, elder: 2, sovereign: 1 });
  });

  test("adoption line: X of Y linked + percentage", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const txt = textContents(c).join("\n");
    // 7 linked of 8 members → 88%.
    expect(txt).toContain("**7** of **8**");
    expect(txt).toContain("88% onboarded");
    expect(txt).toContain("linked a wallet");
  });

  test("READ-ONLY: no per-member action, no Apply affordance, no per-member rows", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const txt = JSON.stringify(c.components);
    // no action verbs / apply affordance from the CM dashboard surface.
    expect(txt).not.toContain("Apply");
    expect(txt).not.toContain("Would add");
    expect(txt).not.toContain("would-add");
    // no Discord button/action-row components (only text 10 + separator 14).
    const allowed = new Set([10, 14]);
    for (const comp of c.components) expect(allowed.has(comp.type)).toBe(true);
    // a member's display name must NOT surface (this is aggregate-only, not a roster).
    expect(txt).not.toContain("soju");
    expect(txt).not.toContain("memberA");
  });

  test("VOICELESS: every string is a structural label / count / lore name", () => {
    const c = renderPublicRoleBoardCV2(FIXTURE, CTX);
    const txt = textContents(c).join("\n");
    // structural framing only; no persona narration markers.
    expect(txt).toContain("Read-only");
    expect(txt).toContain("The ladder");
  });

  test("INJECTION GUARD: an attacker-shaped world slug / lore name is neutralized", () => {
    const evilMap: RoleMapConfig = {
      enabled: true,
      namespace_prefix: "purupuru:",
      rules: [
        {
          role_key: "purupuru:evil",
          display_name: "@everyone **pwn**",
          qualifies: { source: "tier", min_tier: "member" },
          create_if_absent: true,
        },
      ],
    } as RoleMapConfig;
    const c = renderPublicRoleBoardCV2(
      rosterOf([tieredMember("700000000000000010", "x", "member")]),
      { world: "@everyone", roleMap: evilMap, generatedAt: "2026-06-04T00:00:00Z" },
    );
    const txt = textContents(c).join("\n");
    // @everyone broken (zero-width inserted after @) in both header + ladder.
    expect(txt).not.toContain("@everyone");
    // markdown control chars escaped in the lore name.
    expect(txt).toContain("\\*\\*pwn\\*\\*");
  });

  test("empty roster renders the ladder + a no-members adoption line, no throw", () => {
    const c = renderPublicRoleBoardCV2(rosterOf([]), CTX);
    const txt = textContents(c).join("\n");
    expect(txt).toContain("Purupuru");
    expect(txt).toContain("No members yet");
    // ladder still renders all tiers at 0.
    expect(txt).toContain("`0` members");
  });

  test("world-customizable: a different world reskins via its own map + accent", () => {
    const altMap: RoleMapConfig = {
      enabled: true,
      namespace_prefix: "tsuheji:",
      rules: [
        {
          role_key: "tsuheji:flame",
          display_name: "Flamebearer",
          qualifies: { source: "tier", min_tier: "sovereign" },
          create_if_absent: true,
        },
        {
          role_key: "tsuheji:spark",
          display_name: "Spark",
          qualifies: { source: "tier", min_tier: "member" },
          create_if_absent: true,
        },
      ],
    } as RoleMapConfig;
    const c = renderPublicRoleBoardCV2(
      rosterOf([tieredMember("700000000000000020", "y", "sovereign")]),
      { world: "tsuheji", roleMap: altMap, accent: 0x123456, generatedAt: "2026-06-04T00:00:00Z" },
    );
    expect(c.accent_color).toBe(0x123456);
    const txt = textContents(c).join("\n");
    expect(txt).toContain("Tsuheji");
    expect(txt).toContain("Flamebearer");
    expect(txt).toContain("Spark");
    // the Purupuru lore names must NOT leak — the board is fully reskinned.
    expect(txt).not.toContain("Sovereign");
  });
});
