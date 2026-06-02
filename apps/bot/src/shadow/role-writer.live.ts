/**
 * shadow/role-writer.live.ts — THE SINGLE GATED ADAPTER (Sprint 405 / Task
 * 405.2, SDD §4.4.1/§4.4.4/§4.5).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THIS IS THE ONLY MODULE IN freeside-characters ALLOWED TO PERFORM         ║
 * ║  discord.js ROLE MUTATION (`guild.roles.create`, member `roles.add`).      ║
 * ║                                                                            ║
 * ║  The cross-repo import-boundary lint (scripts/lint-shadow-import-          ║
 * ║  boundary.sh, Task 405.3) ENFORCES this: a raw role-mutation ANYWHERE      ║
 * ║  ELSE is a CI failure. This file is the lint's single allowlisted module.  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── WHERE THE REAL SECURITY BOUNDARY LIVES (B9 reframe, SDD §4.4.4) ──────────
 * The `WriteCapability` argument these methods require is a COMPILE-TIME
 * accident-prevention seam — NOT a runtime secret. It stops an honest dev from
 * forgetting the gate (the signature won't type-check without it). The ENFORCED
 * boundary is the substrate's `GateCheckedRoleWriter`: invocation-time
 * `apply_mode` read + server-side `AuthzContext`/`admin_principals` re-check +
 * write-after-audit. This LIVE writer is reachable ONLY as the `inner` Layer of
 * `GateCheckedRoleWriter` — the composition root NEVER hands it to anything
 * else, and `applyBatch` is the ONLY call path. A consumer cannot get a
 * `WriteCapability` (its constructor is un-exported; minted only inside the
 * substrate's authorized go_live path), so this writer's methods are
 * un-callable except through the gate.
 *
 * ── PORT CONTRACT (B10 TOCTOU) ───────────────────────────────────────────────
 * `createRole` is CHECK-THEN-CREATE against LIVE state: GET the guild roleset,
 * create ONLY IF a role with the namespaced `role_key` (== the role name) is
 * ABSENT; if present, return the existing id WITHOUT a second create. The gate
 * serializes the GET-then-create span per world via the `WorldLock`, so the
 * cross-batch "exactly one create per role_key per world" guarantee is the
 * composition of (lock-serialized span) × (check-then-create against live
 * state). `assignRole` is naturally idempotent (re-assign is a Discord no-op).
 *
 * ── FR-9 namespacing (ENFORCED, not just claimed) ───────────────────────────
 * Freeside touches ONLY namespaced roles (the substrate's `role_key` carries the
 * namespace prefix, e.g. `purupuru:holder`). The writer never creates or
 * assigns a non-namespaced role — Collab.Land roles are never contended. This is
 * ENFORCED at the top of BOTH `createRole` and `assignRole`: a `role_key` that
 * does not start with the world's `namespacePrefix` is REFUSED with a typed
 * `WriteError("op_failed", …)` BEFORE any Discord read or mutation. This bounds
 * the confused-deputy: a batch can never create/assign a NON-namespaced role
 * (e.g. an admin role or a Collab.Land role), even if a malicious `role_key`
 * reached the intent. The composition root supplies the prefix to the live
 * writer (threaded through `LiveWriterConfig`, like the GC).
 *
 * ── CONFUSED-DEPUTY: bind to the role WE created, not a same-named pre-existing
 *    one (FAGAN iter-2). `createRole`'s check-then-create still adopts a
 *    same-named pre-existing role for cross-batch idempotency (the port contract,
 *    B10), but within ONE batch the writer threads a local
 *    `{role_key → created_role_id}` map: a create records the id it created, and
 *    a subsequent assign in the SAME batch resolves the target by THAT id rather
 *    than re-resolving purely by name. This shrinks the window where an attacker
 *    pre-creates a `<namespace>:holder` role to get it adopted by an in-batch
 *    assign. The namespace guard above is the hard bound; the id-map is the
 *    extra precision. NOTE the cross-batch case (assign in a LATER batch than the
 *    create) cannot bind by id on the consumer side: the substrate's gate
 *    dispatches `assignRole(cap, {role_key, member_id})` with NO `role_id`, and
 *    its `roles_created` ledger id is not threaded into the assign call. Carrying
 *    `role_id` into the assign would be a substrate (freeside-worlds governor)
 *    change — FLAGGED as a follow-up, NOT hacked here.
 */
import { Effect, Layer } from "effect";
import type { Client, Guild, Role } from "discord.js";
import { RoleWriter, WriteError } from "./substrate.ts";
import type {
  WriteCapability,
  CreateRoleIntent,
  AssignRoleIntent,
} from "@freeside-worlds/shadow-substrate";

/** Per-world wiring the LIVE writer needs (guild snowflake + namespace prefix). */
export interface LiveWriterConfig {
  readonly resolve: (world: string) => { readonly guild_id: string } | undefined;
  /** the world the batch targets — threaded from the composition root. */
  readonly world: string;
  /**
   * the world's FR-9 namespace prefix (e.g. `purupuru:`). The live writer REFUSES
   * to create/assign any `role_key` that does not start with this — the enforced
   * confused-deputy bound. Supplied by the composition root from the manifest.
   */
  readonly namespacePrefix: string;
}

const DEFAULT_MAX_RETRIES = 4;

/** Sleep helper (overridable in tests). */
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/**
 * Exponential backoff with jitter for a Discord call that may 429. The substrate
 * classifies 429 as a TRANSIENT `WriteError("rate_limited")`, NEVER a hard
 * failure that triggers rollback (SDD §4.4.1). discord.js surfaces a 429 as an
 * error with `.status === 429` / a `retry_after`; we honor it, bounded.
 */
async function withRateLimitBackoff<A>(
  fn: () => Promise<A>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<A> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number; httpStatus?: number })?.status
        ?? (e as { httpStatus?: number })?.httpStatus;
      const retryAfterSec =
        (e as { retry_after?: number })?.retry_after
        ?? (e as { retryAfter?: number })?.retryAfter;
      if (status === 429 && attempt < maxRetries) {
        const base = retryAfterSec != null ? retryAfterSec * 1000 : 1000 * 2 ** attempt;
        const jitter = Math.floor(Math.random() * 250);
        await sleep(base + jitter);
        attempt += 1;
        continue;
      }
      throw e;
    }
  }
}

/**
 * Build the LIVE `RoleWriter` Layer — the single gated discord.js adapter.
 *
 * @param getBotClient  the existing bot Gateway client factory.
 * @param cfg           per-world guild wiring + the target world slug.
 * @param sleep         injectable sleep (tests).
 */
export function makeRoleWriterLive(
  getBotClient: () => Promise<Client | null>,
  cfg: LiveWriterConfig,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Layer.Layer<RoleWriter> {
  const guildFor = async (): Promise<Guild> => {
    const wiring = cfg.resolve(cfg.world);
    if (!wiring) throw new Error(`no guild wiring for world '${cfg.world}'`);
    const client = await getBotClient();
    if (!client) {
      throw new Error(
        "discord bot client unavailable (DISCORD_BOT_TOKEN unset) — cannot perform LIVE role writes",
      );
    }
    return client.guilds.fetch(wiring.guild_id);
  };

  // FR-9 namespace guard (ENFORCED): refuse any role_key not under the world's
  // prefix BEFORE any Discord read/mutation. The hard confused-deputy bound on
  // BOTH create and assign.
  //
  // FAIL-CLOSED (FAGAN iter-3): an EMPTY/missing namespacePrefix REFUSES every
  // mutation. In JS `anything.startsWith("") === true`, so a `startsWith`-only
  // guard would PASS EVERYTHING when a world is misconfigured (guild wiring
  // present but `namespace_prefix` absent → ""). A misconfigured world must
  // refuse ALL role mutations — the fail-safe the iter-2 brief intended — so an
  // unconfigured prefix can never grant create/assign over arbitrary (e.g.
  // Collab.Land) roles.
  const assertNamespaced = (roleKey: string, op: string): void => {
    if (!cfg.namespacePrefix || cfg.namespacePrefix.length === 0) {
      throw new WriteError({
        kind: "op_failed",
        message: `${op}: refused — no namespace_prefix configured for this world (fail-closed: a misconfigured world refuses ALL role mutations, FR-9 confused-deputy guard)`,
      });
    }
    if (!roleKey.startsWith(cfg.namespacePrefix)) {
      throw new WriteError({
        kind: "op_failed",
        message: `refused non-namespaced role '${roleKey}' in ${op} (FR-9: writer touches ONLY '${cfg.namespacePrefix}…' roles — confused-deputy guard)`,
      });
    }
  };

  // Local PER-BATCH id binding (this Layer instance lives for one batch's
  // applyBatch). createRole records the id it created; an assign in the SAME
  // batch binds to THAT id instead of re-resolving by name (confused-deputy
  // precision). Cross-batch binding requires a substrate change — see header.
  const createdInBatch = new Map<string, string>();

  return Layer.succeed(
    RoleWriter,
    RoleWriter.of({
      // CHECK-THEN-CREATE against live state (port contract, B10). The `cap` is
      // the compile-time gate; the substrate's GateCheckedRoleWriter already
      // verified mode==LIVE + authz + write-after-audit before reaching here.
      createRole: (_cap: WriteCapability, intent: CreateRoleIntent) =>
        Effect.tryPromise({
          try: async () => {
            // FR-9 hard guard FIRST — before any Discord read or mutation.
            assertNamespaced(intent.role_key, `createRole`);
            // same-batch fast-path: we already created this key in THIS batch.
            const priorInBatch = createdInBatch.get(intent.role_key);
            if (priorInBatch !== undefined) {
              return priorInBatch as never;
            }
            const guild = await guildFor();
            const roles = await guild.roles.fetch();
            const existing: Role | undefined = roles.find(
              (r) => r.name === intent.role_key,
            );
            if (existing) {
              // Idempotent: a role with this namespaced key already exists —
              // reuse its id, no second create (the cross-batch dedup, B10).
              createdInBatch.set(intent.role_key, existing.id);
              return existing.id as never;
            }
            // ── THE role mutation. The ONLY allowlisted create in the repo. ──
            const created = await withRateLimitBackoff(
              () => guild.roles.create({ name: intent.role_key, reason: "freeside shadow-onboarding" }),
              sleep,
            );
            // Bind the id WE created so a same-batch assign uses it, not a name
            // re-resolve (confused-deputy: never adopt an attacker's same-named
            // role for an in-batch assign).
            createdInBatch.set(intent.role_key, created.id);
            return created.id as never;
          },
          catch: (e) => classifyWriteError(e, `createRole(${intent.role_key})`),
        }),

      // Idempotent assign — PUT-member-role; re-assigning a held role is a no-op.
      assignRole: (_cap: WriteCapability, intent: AssignRoleIntent) =>
        Effect.tryPromise({
          try: async () => {
            // FR-9 hard guard FIRST — before any Discord read or mutation.
            assertNamespaced(intent.role_key, `assignRole`);
            const guild = await guildFor();
            // Prefer the id WE created in THIS batch (confused-deputy: do not
            // re-resolve a same-named pre-existing role an attacker may have
            // planted). Fall back to a name re-resolve only when this batch did
            // not create the role (e.g. it pre-existed and was adopted by
            // createRole, which also records the adopted id).
            const boundId = createdInBatch.get(intent.role_key);
            let role: Role | null;
            if (boundId !== undefined) {
              role = await guild.roles.fetch(boundId);
            } else {
              const roles = await guild.roles.fetch();
              role = roles.find((r) => r.name === intent.role_key) ?? null;
            }
            if (!role) {
              throw new Error(
                `assignRole: role '${intent.role_key}' not found — create it first`,
              );
            }
            const member = await guild.members.fetch(
              intent.member_id as unknown as string,
            );
            if (member.roles.cache.has(role.id)) {
              return; // already held — idempotent no-op
            }
            // ── THE role mutation (assign). The ONLY allowlisted add in the repo. ──
            await withRateLimitBackoff(
              () => member.roles.add(role!, "freeside shadow-onboarding"),
              sleep,
            );
          },
          catch: (e) =>
            classifyWriteError(e, `assignRole(${intent.role_key}→${intent.member_id})`),
        }),
    }),
  );
}

/**
 * GATED rollback-GC delete (Sprint 405 / Task 405.4, B2). Deletes a
 * created-but-UNASSIGNED Freeside-namespaced role to free budget toward the
 * 250-role ceiling. This is a discord.js role MUTATION, so it lives in THIS
 * single gated adapter module (the lint's allowlisted file). It requires a
 * `WriteCapability` (compile-time gate) exactly like the write path — a GC delete
 * cannot be performed without one. The coexistence logic (which roles are
 * GC-eligible) is decided PURELY in coexistence.ts; this only executes the
 * decision under the gate.
 *
 * SAFETY: the caller MUST pass only zero-assignment Freeside-namespaced role ids
 * (per `computeRollbackPlan`). This function does NOT re-derive eligibility — it
 * trusts the pure plan — but it DOES guard by namespace prefix as defense in
 * depth so a non-namespaced (Collab.Land) role can never be deleted here.
 */
export function makeGatedRoleGc(
  getBotClient: () => Promise<Client | null>,
  cfg: LiveWriterConfig,
  namespacePrefix: string,
  sleep: (ms: number) => Promise<void> = defaultSleep,
) {
  return (
    _cap: WriteCapability,
    roleId: string,
    roleKey: string,
  ): Effect.Effect<void, WriteError> =>
    Effect.tryPromise({
      try: async () => {
        // FAIL-CLOSED (FAGAN iter-3): an EMPTY/missing prefix refuses EVERY GC.
        // `startsWith("")` is always true, so a `startsWith`-only guard on a
        // misconfigured world (no namespace_prefix) would permit deleting
        // arbitrary (e.g. Collab.Land) roles. Refuse-all when unconfigured.
        if (!namespacePrefix || namespacePrefix.length === 0) {
          throw new Error(
            `refused GC — no namespace_prefix configured for this world (fail-closed: a misconfigured world refuses ALL role deletes) — coexistence guard`,
          );
        }
        if (!roleKey.startsWith(namespacePrefix)) {
          throw new Error(
            `refused GC of non-namespaced role '${roleKey}' (not Freeside-managed) — coexistence guard`,
          );
        }
        const wiring = cfg.resolve(cfg.world);
        if (!wiring) throw new Error(`no guild wiring for world '${cfg.world}'`);
        const client = await getBotClient();
        if (!client) {
          throw new Error("discord bot client unavailable — cannot GC role");
        }
        const guild = await client.guilds.fetch(wiring.guild_id);
        const role = await guild.roles.fetch(roleId);
        if (!role) return; // already gone — idempotent
        // HYDRATE the member cache before reading membership: discord.js derives
        // `role.members` from the guild MEMBER cache, which is empty until fetched.
        // Without this, an assigned role reads `members.size === 0` and the guard
        // below would wrongly delete it — stripping users (violates R-6). Fetching
        // all members makes `role.members.size` reflect LIVE membership.
        await guild.members.fetch();
        if (role.members.size > 0) {
          // defense-in-depth: never strip users even if the plan was stale.
          throw new Error(
            `refused GC of role '${roleKey}' — it has ${role.members.size} member(s) (rollback is non-destructive for assigned roles, R-6)`,
          );
        }
        // ── THE role mutation (delete). Allowlisted GC in the gated adapter. ──
        await withRateLimitBackoff(() => role.delete("freeside rollback GC (unassigned)"), sleep);
      },
      catch: (e) => classifyWriteError(e, `gcRole(${roleKey})`),
    });
}

/** Map a thrown Discord error to the substrate's typed WriteError. */
function classifyWriteError(e: unknown, ctx: string): WriteError {
  // An already-typed WriteError (e.g. the FR-9 namespace refusal thrown inside
  // the try) passes through verbatim — do NOT re-wrap it (would bury the precise
  // refusal message inside an op_failed string).
  if (e instanceof WriteError) return e;
  const status = (e as { status?: number; httpStatus?: number })?.status
    ?? (e as { httpStatus?: number })?.httpStatus;
  if (status === 429) {
    return new WriteError({
      kind: "rate_limited",
      message: `${ctx}: rate limited (429) after bounded backoff`,
    });
  }
  return new WriteError({
    kind: "op_failed",
    message: `${ctx}: ${e instanceof Error ? e.message : String(e)}`,
  });
}
