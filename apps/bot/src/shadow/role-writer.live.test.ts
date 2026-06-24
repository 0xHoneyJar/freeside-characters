/**
 * role-writer.live.test.ts — FAGAN iter-2 hardening proofs for the single gated
 * adapter (Sprint 405 / Task 405.2/405.4, SDD §4.4.1 FR-9 / B2 / R-6).
 *
 * These exercise the LIVE writer's SECURITY guards directly with a hand-rolled
 * minimal discord.js client mock (no real Discord I/O):
 *   • FR-9 namespace guard REFUSES a non-namespaced create AND assign BEFORE any
 *     mutation (confused-deputy bound).
 *   • the rollback GC REFUSES a role that has hydrated members (never strip
 *     users, R-6) — proving the member-cache hydration makes the zero-member
 *     guard reflect LIVE membership.
 *   • a same-batch create→assign binds to the id WE created, not a same-named
 *     pre-existing role an attacker planted (confused-deputy precision).
 */
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { Client } from "discord.js";
import { makeRoleWriterLive, makeGatedRoleGc, type LiveWriterConfig } from "./role-writer.live.ts";
import { RoleWriter, WriteError } from "./substrate.ts";
import type { WriteCapability, CreateRoleIntent, AssignRoleIntent } from "@freeside-worlds/shadow-substrate";

// ── minimal discord.js mock (only the surfaces the writer touches) ──────────

interface MockRole {
  id: string;
  name: string;
  members: { size: number };
  deleted?: boolean;
}

/**
 * Optional member-count wiring (F7): when provided, the mock exposes
 * `guild.memberCount` + `guild.members.cache.size` so the GC's full-membership
 * COMPLETENESS assertion can be exercised. `hydratedCacheSize` is what a
 * `members.fetch()` populates the cache to; `total` is the authoritative count.
 * When omitted, the mock exposes NEITHER counter (the pre-F7 behavior) — the
 * completeness assertion then cannot fire and the explicit-fetch R-6 guard stands.
 */
interface MemberCountCfg {
  readonly total: number;
  readonly hydratedCacheSize: number;
}

function makeMockGuild(
  initialRoles: MockRole[],
  memberHasRole = new Set<string>(),
  memberCounts?: MemberCountCfg,
) {
  const roles = [...initialRoles];
  let seq = 0;
  const created: Array<{ id: string; name: string }> = [];
  const assigned: Array<{ role_id: string; member_id: string }> = [];
  let membersFetchedAll = 0;
  let rolesFetchedAll = 0;

  // Wrap a stored MockRole so it carries a discord.js-Role-like `delete()` (used
  // by the GC) while still exposing `id`/`name`/`members`.
  const roleView = (r: MockRole) => ({
    id: r.id,
    name: r.name,
    members: r.members,
    delete: (_reason?: string) => {
      r.deleted = true;
      return Promise.resolve();
    },
  });

  const rolesApi = {
    // roles.fetch() with no arg → a Collection-like with .find()/.forEach(); with
    // an id → the single role (or null). Mirrors discord.js overloads.
    fetch: (id?: string) => {
      if (id !== undefined) {
        const r = roles.find((rr) => rr.id === id && !rr.deleted);
        return Promise.resolve(r ? roleView(r) : null);
      }
      rolesFetchedAll += 1;
      return Promise.resolve({
        find: (pred: (r: MockRole) => boolean) => {
          const r = roles.find((rr) => !rr.deleted && pred(rr));
          return r ? roleView(r) : undefined;
        },
        forEach: (fn: (r: { id: string; name: string }) => void) => {
          roles.filter((rr) => !rr.deleted).forEach((rr) => fn({ id: rr.id, name: rr.name }));
        },
      });
    },
    create: ({ name }: { name: string; reason?: string }) => {
      const role: MockRole = { id: `live-${++seq}`, name, members: { size: 0 } };
      roles.push(role);
      created.push({ id: role.id, name });
      return Promise.resolve({
        id: role.id,
        delete: () => {
          role.deleted = true;
          return Promise.resolve();
        },
        members: role.members,
      });
    },
  };

  const membersApi = {
    // discord.js exposes `guild.members.cache` (a Collection); we surface only the
    // `.size` the completeness assertion reads. Present ONLY when memberCounts set.
    ...(memberCounts ? { cache: { size: memberCounts.hydratedCacheSize } } : {}),
    // hydrate-all (no arg) vs fetch-one (member id)
    fetch: (memberId?: string) => {
      if (memberId === undefined) {
        membersFetchedAll += 1;
        // discord.js resolves a Collection of the fetched members; expose a `.size`
        // mirroring the hydrated cache when counts are configured.
        return Promise.resolve(
          memberCounts ? { size: memberCounts.hydratedCacheSize } : undefined,
        );
      }
      // PER-MEMBER held-role view: `memberHasRole` is keyed `${memberId}:${roleId}`
      // so two different members do not share one held set (a single member-id can
      // still observe an already-held role as a no-op). Legacy bare-roleId entries
      // (set by tests that pre-seed `memberHasRole`) are also honored.
      return Promise.resolve({
        roles: {
          cache: {
            has: (rid: string) => memberHasRole.has(rid) || memberHasRole.has(`${memberId}:${rid}`),
          },
          // discord.js `roles.add` accepts a RoleResolvable: a Role object OR a
          // role-id string. The live writer now passes the id string (no Role
          // object needed when the id is already resolved). Handle both forms.
          add: (role: string | { id: string }) => {
            const rid = typeof role === "string" ? role : role.id;
            assigned.push({ role_id: rid, member_id: memberId });
            memberHasRole.add(`${memberId}:${rid}`);
            return Promise.resolve();
          },
        },
      });
    },
  };

  const guild = {
    id: "guild-everyone",
    ...(memberCounts ? { memberCount: memberCounts.total } : {}),
    roles: rolesApi,
    members: membersApi,
  };

  return {
    guild,
    roles,
    created,
    assigned,
    membersFetchedAllCount: () => membersFetchedAll,
    rolesFetchedAllCount: () => rolesFetchedAll,
  };
}

function makeClient(guild: unknown): () => Promise<Client | null> {
  const client = { guilds: { fetch: () => Promise.resolve(guild) } } as unknown as Client;
  return () => Promise.resolve(client);
}

const NS = "purupuru:";
const cfg = (resolveTo: { guild_id: string } | undefined = { guild_id: "g1" }): LiveWriterConfig => ({
  resolve: () => resolveTo,
  world: "purupuru",
  namespacePrefix: NS,
});
/** A MISCONFIGURED world: guild wiring present but no namespace_prefix (→ ""). */
const cfgNoPrefix = (prefix = ""): LiveWriterConfig => ({
  resolve: () => ({ guild_id: "g1" }),
  world: "purupuru",
  namespacePrefix: prefix,
});
const CAP = {} as WriteCapability; // gate already verified; the live writer never inspects it
const noSleep = () => Promise.resolve();

async function getWriter(getClient: () => Promise<Client | null>) {
  const layer = makeRoleWriterLive(getClient, cfg(), noSleep);
  return Effect.runPromise(RoleWriter.pipe(Effect.provide(layer)));
}

async function getWriterWithCfg(
  getClient: () => Promise<Client | null>,
  c: LiveWriterConfig,
) {
  const layer = makeRoleWriterLive(getClient, c, noSleep);
  return Effect.runPromise(RoleWriter.pipe(Effect.provide(layer)));
}

describe("405.2 — FR-9 namespace guard ENFORCED on create AND assign (confused-deputy)", () => {
  test("createRole REFUSES a non-namespaced role_key BEFORE any Discord mutation", async () => {
    const m = makeMockGuild([]);
    const writer = await getWriter(makeClient(m.guild));
    const intent: CreateRoleIntent = { role_key: "admin", display_name: "Admin" };
    const res = await Effect.runPromise(Effect.either(writer.createRole(CAP, intent)));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left).toBeInstanceOf(WriteError);
    expect((res as { left: WriteError }).left.kind).toBe("op_failed");
    expect((res as { left: WriteError }).left.message).toContain("refused non-namespaced role");
    // proves the guard fired BEFORE the mutation: zero roles created.
    expect(m.created.length).toBe(0);
  });

  test("assignRole REFUSES a non-namespaced role_key BEFORE any Discord mutation", async () => {
    const m = makeMockGuild([{ id: "x", name: "@everyone", members: { size: 0 } }]);
    const writer = await getWriter(makeClient(m.guild));
    const intent: AssignRoleIntent = { role_key: "@everyone", member_id: "member-1" as never };
    const res = await Effect.runPromise(Effect.either(writer.assignRole(CAP, intent)));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("refused non-namespaced role");
    expect(m.assigned.length).toBe(0);
  });

  test("a namespaced create then assign in the SAME batch binds to the id WE created (not a planted same-named role)", async () => {
    // An attacker pre-creates a same-named role with a DIFFERENT id.
    const planted: MockRole = { id: "ATTACKER", name: "purupuru:holder", members: { size: 0 } };
    const m = makeMockGuild([planted]);
    const writer = await getWriter(makeClient(m.guild));
    // create adopts the pre-existing role (idempotent, B10) → records its id.
    // (In the pre-existing-adopt case, the bound id is the adopted role's id —
    // the point of the guard is the assign uses the id create resolved, not a
    // fresh name re-resolve.) Here we instead prove the create-then-assign on a
    // FRESH role binds the NEWLY created id.
    const freshM = makeMockGuild([]); // no pre-existing role
    const freshWriter = await getWriter(makeClient(freshM.guild));
    await Effect.runPromise(freshWriter.createRole(CAP, { role_key: "purupuru:holder", display_name: "H" }));
    const createdId = freshM.created[0]!.id;
    await Effect.runPromise(freshWriter.assignRole(CAP, { role_key: "purupuru:holder", member_id: "m1" as never }));
    expect(freshM.assigned.length).toBe(1);
    expect(freshM.assigned[0]!.role_id).toBe(createdId); // bound to the id WE created
    // sanity: the planted-role scenario still namespace-passes (it IS namespaced)
    expect(planted.name.startsWith(NS)).toBe(true);
  });
});

describe("405.2 — FAIL-CLOSED: an empty/missing namespace_prefix refuses ALL mutations (FAGAN iter-3)", () => {
  test("createRole is REFUSED when namespace_prefix is '' (misconfigured world) — fail-closed, no mutation", async () => {
    const m = makeMockGuild([]);
    const writer = await getWriterWithCfg(makeClient(m.guild), cfgNoPrefix(""));
    // a key that WOULD pass startsWith("") (anything) — the fail-closed guard
    // must still refuse it because no prefix is configured.
    const intent: CreateRoleIntent = { role_key: "purupuru:holder", display_name: "H" };
    const res = await Effect.runPromise(Effect.either(writer.createRole(CAP, intent)));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left).toBeInstanceOf(WriteError);
    expect((res as { left: WriteError }).left.kind).toBe("op_failed");
    expect((res as { left: WriteError }).left.message).toContain("no namespace_prefix configured");
    expect((res as { left: WriteError }).left.message).toContain("fail-closed");
    // proves the guard fired BEFORE the mutation: zero roles created.
    expect(m.created.length).toBe(0);
  });

  test("assignRole is REFUSED when namespace_prefix is '' (misconfigured world) — fail-closed, no mutation", async () => {
    const m = makeMockGuild([{ id: "x", name: "purupuru:holder", members: { size: 0 } }]);
    const writer = await getWriterWithCfg(makeClient(m.guild), cfgNoPrefix(""));
    const intent: AssignRoleIntent = { role_key: "purupuru:holder", member_id: "member-1" as never };
    const res = await Effect.runPromise(Effect.either(writer.assignRole(CAP, intent)));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("no namespace_prefix configured");
    expect(m.assigned.length).toBe(0);
  });

  test("the rollback GC delete is REFUSED when namespace_prefix is '' — fail-closed, never deletes arbitrary roles", async () => {
    // A genuinely zero-member role that WOULD be deletable under a configured
    // prefix. With "" prefix the GC must refuse-all (a misconfigured world cannot
    // delete arbitrary, e.g. Collab.Land, roles).
    const role: MockRole = { id: "r-empty", name: "purupuru:empty", members: { size: 0 } };
    const m = makeMockGuild([role]);
    const gc = makeGatedRoleGc(makeClient(m.guild), cfgNoPrefix(""), "", noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-empty", "purupuru:empty")));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("no namespace_prefix configured");
    // the role was NOT deleted.
    expect(role.deleted).toBeUndefined();
  });

  test("a correctly-namespaced world still works (create succeeds under a configured prefix)", async () => {
    const m = makeMockGuild([]);
    const writer = await getWriterWithCfg(makeClient(m.guild), cfg());
    const id = await Effect.runPromise(
      writer.createRole(CAP, { role_key: "purupuru:holder", display_name: "H" }),
    );
    expect(typeof id).toBe("string");
    expect(m.created.length).toBe(1);
    expect(m.created[0]!.name).toBe("purupuru:holder");
  });

  test("a non-namespaced key under a CONFIGURED prefix is still refused (prefix-mismatch, not fail-closed)", async () => {
    const m = makeMockGuild([]);
    const writer = await getWriterWithCfg(makeClient(m.guild), cfg());
    const res = await Effect.runPromise(
      Effect.either(writer.createRole(CAP, { role_key: "admin", display_name: "Admin" })),
    );
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("refused non-namespaced role");
    expect(m.created.length).toBe(0);
  });
});

describe("405.4 — rollback GC refuses a role with HYDRATED members (R-6, never strip users)", () => {
  test("GC of a role that reads zero members ONLY before hydration is REFUSED after members.fetch()", async () => {
    // The role object's `members.size` starts 0 (un-hydrated cache). The mock
    // FLIPS it to a non-zero count when members.fetch() (hydrate-all) runs —
    // simulating discord.js deriving role.members from the member cache. If the
    // GC read members.size WITHOUT hydrating, it would see 0 and delete (strip
    // users). With the hydration fix it sees the live count and refuses.
    const role: MockRole = { id: "r-assigned", name: "purupuru:holder", members: { size: 0 } };
    const m = makeMockGuild([role]);
    // patch members.fetch hydrate-all to reflect live membership onto the role.
    const origFetch = m.guild.members.fetch;
    m.guild.members.fetch = ((memberId?: string) => {
      if (memberId === undefined) {
        role.members.size = 3; // hydration reveals 3 live members
      }
      return origFetch(memberId);
    }) as typeof m.guild.members.fetch;

    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-assigned", "purupuru:holder")));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("member(s)");
    expect((res as { left: WriteError }).left.message).toContain("R-6");
    // the role was NOT deleted.
    expect(role.deleted).toBeUndefined();
  });

  test("GC DELETES a genuinely zero-member Freeside role (after hydration confirms empty)", async () => {
    const role: MockRole = { id: "r-empty", name: "purupuru:empty", members: { size: 0 } };
    const m = makeMockGuild([role]);
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-empty", "purupuru:empty")));
    expect(res._tag).toBe("Right");
    expect(role.deleted).toBe(true);
  });

  test("GC REFUSES a non-namespaced role id (defense-in-depth, never touches Collab.Land)", async () => {
    const role: MockRole = { id: "r-cl", name: "CollabLand VIP", members: { size: 0 } };
    const m = makeMockGuild([role]);
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-cl", "CollabLand VIP")));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("non-namespaced");
    expect(role.deleted).toBeUndefined();
  });
});

describe("F7 — GC zero-member guard HARD-DEPENDS on COMPLETE membership hydration", () => {
  test("a role that reads zero members but the cache hydrated PARTIALLY is REFUSED (fail-closed)", async () => {
    // The role's `members.size` is 0 (it looks empty), BUT the guild member cache
    // hydrated only 40 of 100 members (e.g. GUILD_MEMBERS intent missing / partial
    // fetch). On a DESTRUCTIVE path, "couldn't see everyone" must NOT be treated as
    // "nobody is here" — the completeness assertion fails closed and refuses.
    const role: MockRole = { id: "r-maybe-empty", name: "purupuru:holder", members: { size: 0 } };
    const m = makeMockGuild([role], new Set(), { total: 100, hydratedCacheSize: 40 });
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-maybe-empty", "purupuru:holder")));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left).toBeInstanceOf(WriteError);
    expect((res as { left: WriteError }).left.message).toContain("hydrated only 40/100");
    expect((res as { left: WriteError }).left.message).toContain("FAILS CLOSED");
    expect((res as { left: WriteError }).left.message).toContain("R-6");
    // CRITICAL: the role was NOT deleted despite members.size === 0.
    expect(role.deleted).toBeUndefined();
  });

  test("a zero-member role with FULLY hydrated membership (cache size == memberCount) IS deleted", async () => {
    // Same surface as above but hydration is COMPLETE (40/40): the guard can now
    // TRUST members.size === 0 and the genuinely-empty role is GC'd.
    const role: MockRole = { id: "r-truly-empty", name: "purupuru:empty", members: { size: 0 } };
    const m = makeMockGuild([role], new Set(), { total: 40, hydratedCacheSize: 40 });
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-truly-empty", "purupuru:empty")));
    expect(res._tag).toBe("Right");
    expect(role.deleted).toBe(true);
  });

  test("a NON-empty role with full hydration is still refused (R-6) — completeness does not override membership", async () => {
    // Full hydration AND the role has members → still refuse (the R-6 guard).
    const role: MockRole = { id: "r-has-members", name: "purupuru:holder", members: { size: 2 } };
    const m = makeMockGuild([role], new Set(), { total: 50, hydratedCacheSize: 50 });
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    const res = await Effect.runPromise(Effect.either(gc(CAP, "r-has-members", "purupuru:holder")));
    expect(res._tag).toBe("Left");
    expect((res as { left: WriteError }).left.message).toContain("2 member(s)");
    expect(role.deleted).toBeUndefined();
  });
});

describe("F1/F2 — read-roster-once-per-batch (read-amplification remediation)", () => {
  test("GC over M roles hydrates the FULL member set ONCE, not once per role (F1)", async () => {
    // Three zero-member Freeside roles to GC. The old code called
    // `guild.members.fetch()` once PER role → 3 full member fetches. The fix
    // memoizes the hydration per batch (the factory closure) → exactly 1.
    const r1: MockRole = { id: "r1", name: "purupuru:a", members: { size: 0 } };
    const r2: MockRole = { id: "r2", name: "purupuru:b", members: { size: 0 } };
    const r3: MockRole = { id: "r3", name: "purupuru:c", members: { size: 0 } };
    const m = makeMockGuild([r1, r2, r3], new Set(), { total: 10, hydratedCacheSize: 10 });
    const gc = makeGatedRoleGc(makeClient(m.guild), cfg(), NS, noSleep);
    // run the gc for all three roles through the SAME factory (one batch).
    for (const [id, key] of [["r1", "purupuru:a"], ["r2", "purupuru:b"], ["r3", "purupuru:c"]] as const) {
      const res = await Effect.runPromise(Effect.either(gc(CAP, id, key)));
      expect(res._tag).toBe("Right");
    }
    expect(r1.deleted).toBe(true);
    expect(r2.deleted).toBe(true);
    expect(r3.deleted).toBe(true);
    // THE assertion: exactly ONE full-member hydration across the 3-role batch.
    expect(m.membersFetchedAllCount()).toBe(1);
  });

  test("create + assign across a batch fetch the full roleset ONCE, reusing the snapshot (F2)", async () => {
    // A batch that creates one role then assigns three members. The old code did a
    // full `guild.roles.fetch()` per create AND per name-resolve assign. The fix
    // fetches the roleset once and reuses the snapshot; a created role is reflected
    // into the snapshot so a same-batch name-resolve sees it without re-fetching.
    const m = makeMockGuild([]);
    const writer = await getWriter(makeClient(m.guild));
    await Effect.runPromise(writer.createRole(CAP, { role_key: "purupuru:holder", display_name: "H" }));
    // assigns bind to the id WE created (createdInBatch) → no roleset re-fetch.
    await Effect.runPromise(writer.assignRole(CAP, { role_key: "purupuru:holder", member_id: "m1" as never }));
    await Effect.runPromise(writer.assignRole(CAP, { role_key: "purupuru:holder", member_id: "m2" as never }));
    await Effect.runPromise(writer.assignRole(CAP, { role_key: "purupuru:holder", member_id: "m3" as never }));
    expect(m.assigned.length).toBe(3);
    // THE assertion: the create's check did ONE full roles.fetch(); the three
    // same-batch assigns bound by created-id and did NOT re-fetch the roleset.
    expect(m.rolesFetchedAllCount()).toBe(1);
  });

  test("a same-batch assign of a PRE-EXISTING (adopted) role name-resolves against the cached snapshot (one roleset fetch)", async () => {
    // The role pre-exists (createRole adopts it, recording the adopted id). The
    // first create triggers ONE roleset fetch; the adopted id is bound, so the
    // assign reuses it — still exactly one full roleset fetch for the batch.
    const planted: MockRole = { id: "ADOPTED", name: "purupuru:holder", members: { size: 0 } };
    const m = makeMockGuild([planted]);
    const writer = await getWriter(makeClient(m.guild));
    const id = await Effect.runPromise(writer.createRole(CAP, { role_key: "purupuru:holder", display_name: "H" }));
    expect(String(id)).toBe("ADOPTED"); // adopted the pre-existing role's id (B10)
    await Effect.runPromise(writer.assignRole(CAP, { role_key: "purupuru:holder", member_id: "m1" as never }));
    expect(m.assigned[0]!.role_id).toBe("ADOPTED");
    expect(m.rolesFetchedAllCount()).toBe(1);
  });
});
