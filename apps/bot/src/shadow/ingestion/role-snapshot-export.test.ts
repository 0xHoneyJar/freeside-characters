/**
 * role-snapshot-export.test.ts — the exporter's pure core (S3 / EXPORT-1).
 *
 * Pins the three things that, if wrong, produce a CONFIDENTLY-WRONG audit rather than a loud
 * failure:
 *   1. an unmatched role-holder is FLAGGED (emitted, wallet absent), never DROPPED;
 *   2. only holders of the TOKEN-GATED role are exported (the audit reads every entry as a
 *      role-holder — exporting the whole guild would report the server as stale access);
 *   3. the emitted snapshot satisfies the vendored wire contract.
 *
 * Network-free: the guild read and the wallet resolver are injected.
 */
import { describe, expect, test } from "bun:test";
import {
  buildRoleSnapshot,
  assertLiveSnapshotHasSignal,
  redactDiscordId,
  redactWallet,
  RoleSnapshotExportError,
  EXPORT_METHOD,
  type GuildRoleMemberRef,
} from "./role-snapshot-export.ts";
import { parseRoleSnapshot } from "./role-snapshot.contract.ts";

const GUILD = "1135545260538339420"; // THJ
const GATED = "900000000000000001"; // the token-gated role
const OTHER = "900000000000000002"; // some unrelated role

const RESOLVED_MEMBER = "111111111111111111";
const UNMATCHED_MEMBER = "222222222222222222";
const UNGATED_MEMBER = "333333333333333333";
const WALLET = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const MEMBERS: GuildRoleMemberRef[] = [
  { discord_id: RESOLVED_MEMBER, role_ids: [GATED, OTHER] },
  { discord_id: UNMATCHED_MEMBER, role_ids: [GATED] },
  { discord_id: UNGATED_MEMBER, role_ids: [OTHER] }, // holds NO gated role ⇒ must not be exported
];

/** Resolves exactly one member; everyone else is unmatched. */
const resolveWallet = async (id: string): Promise<string | undefined> =>
  id === RESOLVED_MEMBER ? WALLET : undefined;

const BASE = {
  guildId: GUILD,
  community: "thj",
    collection: { chain: '80094', contract: '0x886d2176d899796cd1affa07eff07b9b2b80f1be' },
  owner: "0x886d2176d899796cd1affa07eff07b9b2b80f1be",
  gatedRoleIds: [GATED],
  members: MEMBERS,
  resolveWallet,
  capturedAt: "2026-07-12T12:00:00.000Z",
};

describe("buildRoleSnapshot — envelope + resolved + unmatched", () => {
  test("emits a contract-valid envelope", async () => {
    const { snapshot } = await buildRoleSnapshot(BASE);
    expect(() => parseRoleSnapshot(snapshot)).not.toThrow();
    expect(snapshot.source).toBe(`discord:guild:${GUILD}`);
    expect(snapshot.community).toBe("thj");
    expect(snapshot.captured_at).toBe("2026-07-12T12:00:00.000Z");
    expect(snapshot.export_method).toBe(EXPORT_METHOD);
    expect(snapshot.freshness_threshold_seconds).toBe(86_400);
  });

  test("a RESOLVED holder carries a lowercased wallet", async () => {
    const { snapshot } = await buildRoleSnapshot(BASE);
    const entry = snapshot.entries.find((e) => e.discord_user_id === RESOLVED_MEMBER);
    expect(entry?.wallet).toBe(WALLET.toLowerCase());
    expect(entry?.role_ids).toEqual([GATED]);
  });

  test("an UNMATCHED holder is FLAGGED (emitted, wallet ABSENT), never dropped", async () => {
    const { snapshot, stats } = await buildRoleSnapshot(BASE);
    const entry = snapshot.entries.find((e) => e.discord_user_id === UNMATCHED_MEMBER);
    expect(entry).toBeDefined(); // ← the load-bearing assertion: present, not dropped
    expect(entry?.wallet).toBeUndefined();
    expect(entry).not.toHaveProperty("wallet"); // the KEY is absent (strict schema; `null` would 422)
    expect(entry?.role_ids).toEqual([GATED]);
    expect(stats.unmatched).toBe(1);
    expect(stats.resolved).toBe(1);
  });

  test("a JSON round-trip keeps the unmatched entry and omits its wallet key", async () => {
    const { snapshot } = await buildRoleSnapshot(BASE);
    const wire = JSON.parse(JSON.stringify(snapshot)) as { entries: Array<Record<string, unknown>> };
    const unmatched = wire.entries.find((e) => e.discord_user_id === UNMATCHED_MEMBER)!;
    expect(Object.keys(unmatched).sort()).toEqual(["discord_user_id", "role_ids"]);
    expect(() => parseRoleSnapshot(wire)).not.toThrow();
  });

  test("a resolver THROW ⇒ unmatched, never a lost member (fail-soft per member)", async () => {
    const { snapshot, stats } = await buildRoleSnapshot({
      ...BASE,
      resolveWallet: async (id) => {
        if (id === UNMATCHED_MEMBER) throw new Error("identity-api 503");
        return WALLET;
      },
    });
    expect(snapshot.entries.length).toBe(2);
    expect(snapshot.entries.find((e) => e.discord_user_id === UNMATCHED_MEMBER)?.wallet).toBeUndefined();
    expect(stats.unmatched).toBe(1);
  });

  test("a malformed wallet from the resolver ⇒ unmatched (never a 422-poisoned snapshot)", async () => {
    const { snapshot } = await buildRoleSnapshot({ ...BASE, resolveWallet: async () => "not-a-wallet" });
    expect(snapshot.entries.every((e) => e.wallet === undefined)).toBe(true);
    expect(() => parseRoleSnapshot(snapshot)).not.toThrow();
  });
});

describe("buildRoleSnapshot — the gated-role filter (the correctness spine)", () => {
  test("members holding NO gated role are excluded", async () => {
    const { snapshot, stats } = await buildRoleSnapshot(BASE);
    expect(snapshot.entries.map((e) => e.discord_user_id).sort()).toEqual(
      [RESOLVED_MEMBER, UNMATCHED_MEMBER].sort(),
    );
    expect(snapshot.entries.find((e) => e.discord_user_id === UNGATED_MEMBER)).toBeUndefined();
    expect(stats.guild_members).toBe(3);
    expect(stats.gated_members).toBe(2);
  });

  test("an entry carries ONLY the gated roles it holds — not the member's whole role list", async () => {
    const { snapshot } = await buildRoleSnapshot(BASE);
    const entry = snapshot.entries.find((e) => e.discord_user_id === RESOLVED_MEMBER);
    expect(entry?.role_ids).toEqual([GATED]);
    expect(entry?.role_ids).not.toContain(OTHER); // minimal disclosure
  });

  test("REFUSES an empty gated-role list (no 'export everyone' default)", async () => {
    await expect(buildRoleSnapshot({ ...BASE, gatedRoleIds: [] })).rejects.toThrow(RoleSnapshotExportError);
  });

  test("REFUSES @everyone (role id === guild id) — it would export the whole guild as role-holders", async () => {
    await expect(buildRoleSnapshot({ ...BASE, gatedRoleIds: [GUILD] })).rejects.toThrow(
      RoleSnapshotExportError,
    );
  });

  test("REFUSES a role NAME in place of a snowflake", async () => {
    await expect(buildRoleSnapshot({ ...BASE, gatedRoleIds: ["Mibera Holder"] })).rejects.toThrow(
      RoleSnapshotExportError,
    );
  });
});

describe("assertLiveSnapshotHasSignal — live-write safety gate", () => {
  test("REFUSES a live snapshot with no gated-role holders", () => {
    expect(() =>
      assertLiveSnapshotHasSignal({ guild_members: 100, gated_members: 0, resolved: 0, unmatched: 0 }),
    ).toThrow(RoleSnapshotExportError);
  });

  test("REFUSES a live snapshot when every gated holder is unmatched", () => {
    expect(() =>
      assertLiveSnapshotHasSignal({ guild_members: 100, gated_members: 5, resolved: 0, unmatched: 5 }),
    ).toThrow(RoleSnapshotExportError);
  });

  test("allows a live snapshot with at least one resolved gated holder", () => {
    expect(() =>
      assertLiveSnapshotHasSignal({ guild_members: 100, gated_members: 5, resolved: 1, unmatched: 4 }),
    ).not.toThrow();
  });
});

describe("PII floor — never log a raw wallet or a raw discord id", () => {
  test("redactDiscordId keeps first4…last4", () => {
    expect(redactDiscordId(RESOLVED_MEMBER)).toBe("1111…1111");
    expect(redactDiscordId(RESOLVED_MEMBER)).not.toContain(RESOLVED_MEMBER);
  });

  test("redactWallet keeps 0x+4…last4", () => {
    const redacted = redactWallet(WALLET.toLowerCase());
    expect(redacted).toBe("0xaaaa…aaaa");
    expect(redacted.length).toBeLessThan(WALLET.length);
  });
});
