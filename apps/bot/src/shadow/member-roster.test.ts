/**
 * member-roster.test.ts — the MEMBER-CENTRIC roster builder (bd-l08). Proves the
 * per-member chain (member → identity → wallet → tier → proposed role), the
 * change indicators (ADD / KEEP / UNLINKED / UNTIERED / NO-CHANGE), the summary
 * counts, fail-soft per member, and the operator-style case (linked, tier
 * "member" → purupuru:member, ADD). Network-free (all I/O injected).
 */
import { describe, expect, test } from "bun:test";
import {
  buildMemberRoster,
  computeChange,
  summarize,
  type GuildMemberRef,
  type MemberIdentityResolver,
  type MemberTierReader,
  type MemberTierRow,
} from "./member-roster.ts";
import { buildPurupuruSeedRoleMap } from "./role-sync-seed-map.ts";

const ROLE_MAP = buildPurupuruSeedRoleMap();

/** Build a roster from fixed members + a discord-id→identity map + a wallet→tier map. */
function build(
  members: GuildMemberRef[],
  identities: Record<string, ReturnType<MemberIdentityResolver> extends Promise<infer T> ? T : never>,
  tiers: Record<string, string | null>,
) {
  const resolveIdentity: MemberIdentityResolver = async (id) =>
    identities[id] ?? { kind: "unlinked" };
  const readTier: MemberTierReader = async (wallet) => tiers[wallet.toLowerCase()] ?? null;
  return buildMemberRoster({
    world: "purupuru",
    roleMap: ROLE_MAP,
    members: async () => members,
    resolveIdentity,
    readTier,
  });
}

const A = "700000000000000001"; // operator-style: linked, tier member, ADD
const B = "700000000000000002"; // unlinked
const C = "700000000000000003"; // linked, untiered
const D = "700000000000000004"; // linked, tier core, already holds the role → KEEP
const WALLET_A = "0xaaa0000000000000000000000000000000000001";
const WALLET_C = "0xccc0000000000000000000000000000000000003";
const WALLET_D = "0xddd0000000000000000000000000000000000004";

describe("bd-l08 — member-centric roster builder", () => {
  test("operator-style: linked + tier 'member' → purupuru:member, change ADD", async () => {
    const { rows } = await build(
      [{ discord_id: A, display_name: "soju", current_managed_roles: [] }],
      { [A]: { kind: "linked", user_id: "u-a", wallet: WALLET_A } },
      { [WALLET_A]: "member" },
    );
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.linked).toBe(true);
    expect(r.wallet).toBe(WALLET_A);
    expect(r.tier).toBe("member");
    expect(r.proposed_role_key).toBe("purupuru:member");
    expect(r.change).toBe("ADD");
  });

  test("unlinked member ⇒ linked:false, UNLINKED row, no assignment", async () => {
    const { rows } = await build(
      [{ discord_id: B, display_name: "nolink", current_managed_roles: [] }],
      { [B]: { kind: "unlinked" } },
      {},
    );
    const r = rows[0]!;
    expect(r.linked).toBe(false);
    expect(r.wallet).toBeUndefined();
    expect(r.proposed_role_key).toBeUndefined();
    expect(r.change).toBe("UNLINKED");
  });

  test("linked but untiered (null tier) ⇒ UNTIERED, no proposed role", async () => {
    const { rows } = await build(
      [{ discord_id: C, display_name: "untiered", current_managed_roles: ["purupuru:devoted"] }],
      { [C]: { kind: "linked", user_id: "u-c", wallet: WALLET_C } },
      { [WALLET_C]: null },
    );
    const r = rows[0]!;
    expect(r.linked).toBe(true);
    expect(r.tier).toBeUndefined();
    expect(r.proposed_role_key).toBeUndefined();
    expect(r.change).toBe("UNTIERED");
  });

  test("already holds the proposed role ⇒ KEEP", async () => {
    const { rows } = await build(
      [{ discord_id: D, display_name: "keeper", current_managed_roles: ["purupuru:core"] }],
      { [D]: { kind: "linked", user_id: "u-d", wallet: WALLET_D } },
      { [WALLET_D]: "core" },
    );
    const r = rows[0]!;
    expect(r.proposed_role_key).toBe("purupuru:core");
    expect(r.change).toBe("KEEP");
  });

  test("linked, no_wallet (primary_wallet_missing) ⇒ treated untiered (no managed roles ⇒ NO-CHANGE)", async () => {
    const { rows } = await build(
      [{ discord_id: A, display_name: "nowallet", current_managed_roles: [] }],
      { [A]: { kind: "no_wallet", user_id: "u-a" } },
      {},
    );
    const r = rows[0]!;
    expect(r.linked).toBe(true);
    expect(r.wallet).toBeUndefined();
    expect(r.change).toBe("NO-CHANGE");
  });

  test("summary counts across a mixed roster", async () => {
    const { rows, summary } = await build(
      [
        { discord_id: A, display_name: "soju", current_managed_roles: [] }, // ADD
        { discord_id: B, display_name: "nolink", current_managed_roles: [] }, // UNLINKED
        { discord_id: C, display_name: "untiered", current_managed_roles: ["purupuru:devoted"] }, // UNTIERED
        { discord_id: D, display_name: "keeper", current_managed_roles: ["purupuru:core"] }, // KEEP
      ],
      {
        [A]: { kind: "linked", user_id: "u-a", wallet: WALLET_A },
        [B]: { kind: "unlinked" },
        [C]: { kind: "linked", user_id: "u-c", wallet: WALLET_C },
        [D]: { kind: "linked", user_id: "u-d", wallet: WALLET_D },
      },
      { [WALLET_A]: "member", [WALLET_C]: null, [WALLET_D]: "core" },
    );
    expect(rows).toHaveLength(4);
    expect(summary.members).toBe(4);
    expect(summary.linked).toBe(3);
    expect(summary.would_add).toBe(1);
    expect(summary.keep).toBe(1);
    expect(summary.unlinked).toBe(1);
    expect(summary.untiered).toBe(1);
  });

  test("FAIL-SOFT: an identity throw for one member does NOT abort the batch", async () => {
    const resolveIdentity: MemberIdentityResolver = async (id) => {
      if (id === B) throw new Error("identity-api 500");
      return { kind: "linked", user_id: "u-a", wallet: WALLET_A };
    };
    const readTier: MemberTierReader = async () => "member";
    const { rows, summary } = await buildMemberRoster({
      world: "purupuru",
      roleMap: ROLE_MAP,
      members: async () => [
        { discord_id: A, current_managed_roles: [] },
        { discord_id: B, current_managed_roles: [] },
      ],
      resolveIdentity,
      readTier,
    });
    expect(rows).toHaveLength(2);
    // the throwing member is treated unlinked, the other still resolves ADD.
    expect(rows.find((r) => r.discord_id === B)!.change).toBe("UNLINKED");
    expect(rows.find((r) => r.discord_id === A)!.change).toBe("ADD");
    expect(summary.unlinked).toBe(1);
  });

  test("FAIL-SOFT: a score-read throw ⇒ that member is untiered, batch continues", async () => {
    const resolveIdentity: MemberIdentityResolver = async () => ({
      kind: "linked",
      user_id: "u",
      wallet: WALLET_A,
    });
    const readTier: MemberTierReader = async () => {
      throw new Error("score-api 503");
    };
    const { rows } = await buildMemberRoster({
      world: "purupuru",
      roleMap: ROLE_MAP,
      members: async () => [{ discord_id: A, current_managed_roles: [] }],
      resolveIdentity,
      readTier,
    });
    expect(rows[0]!.change).toBe("NO-CHANGE"); // untiered + no managed roles
    expect(rows[0]!.tier).toBeUndefined();
  });

  describe("computeChange (pure)", () => {
    test("not linked ⇒ UNLINKED", () => {
      expect(computeChange(false, undefined, [])).toBe("UNLINKED");
    });
    test("linked, no proposal, no managed roles ⇒ NO-CHANGE", () => {
      expect(computeChange(true, undefined, [])).toBe("NO-CHANGE");
    });
    test("linked, no proposal, holds a stale managed role ⇒ UNTIERED", () => {
      expect(computeChange(true, undefined, ["purupuru:core"])).toBe("UNTIERED");
    });
    test("proposed role not held ⇒ ADD", () => {
      expect(computeChange(true, "purupuru:member", [])).toBe("ADD");
    });
    test("proposed role already held ⇒ KEEP", () => {
      expect(computeChange(true, "purupuru:core", ["purupuru:core"])).toBe("KEEP");
    });
  });

  test("summarize is consistent with the rows", () => {
    const rows: MemberTierRow[] = [
      { discord_id: A, linked: true, change: "ADD", current_managed_roles: [] },
      { discord_id: B, linked: false, change: "UNLINKED", current_managed_roles: [] },
    ];
    const s = summarize(rows);
    expect(s).toEqual({ members: 2, linked: 1, would_add: 1, keep: 0, unlinked: 1, untiered: 0 });
  });
});
