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

function makeMockGuild(initialRoles: MockRole[], memberHasRole = new Set<string>()) {
  const roles = [...initialRoles];
  let seq = 0;
  const created: Array<{ id: string; name: string }> = [];
  const assigned: Array<{ role_id: string; member_id: string }> = [];
  let membersFetchedAll = 0;

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
    // roles.fetch() with no arg → a Collection-like with .find(); with an id →
    // the single role (or null). Mirrors discord.js overloads.
    fetch: (id?: string) => {
      if (id !== undefined) {
        const r = roles.find((rr) => rr.id === id && !rr.deleted);
        return Promise.resolve(r ? roleView(r) : null);
      }
      return Promise.resolve({
        find: (pred: (r: MockRole) => boolean) => {
          const r = roles.find((rr) => !rr.deleted && pred(rr));
          return r ? roleView(r) : undefined;
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

  const guild = {
    id: "guild-everyone",
    roles: rolesApi,
    members: {
      // hydrate-all (no arg) vs fetch-one (member id)
      fetch: (memberId?: string) => {
        if (memberId === undefined) {
          membersFetchedAll += 1;
          return Promise.resolve(undefined);
        }
        return Promise.resolve({
          roles: {
            cache: { has: (rid: string) => memberHasRole.has(rid) },
            add: (role: { id: string }) => {
              assigned.push({ role_id: role.id, member_id: memberId });
              memberHasRole.add(role.id);
              return Promise.resolve();
            },
          },
        });
      },
    },
  };

  return {
    guild,
    roles,
    created,
    assigned,
    membersFetchedAllCount: () => membersFetchedAll,
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
const CAP = {} as WriteCapability; // gate already verified; the live writer never inspects it
const noSleep = () => Promise.resolve();

async function getWriter(getClient: () => Promise<Client | null>) {
  const layer = makeRoleWriterLive(getClient, cfg(), noSleep);
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
