/**
 * role-snapshot-export.ts — build a `RoleSnapshot` from a Discord guild's members (S3 / EXPORT-1).
 *
 * The PURE core of the exporter: guild members (+ their role snowflakes) × a discord→wallet
 * resolver → a contract-valid `RoleSnapshot`. Zero I/O, zero discord.js, zero network — the live
 * adapters are INJECTED (`guild-role-source.live.ts` reads Discord; the CLI wires the identity
 * client), so this module is fully testable without a bot token. Mirrors the repo's existing
 * live/mock split (member-roster.ts + member-source.live.ts).
 *
 * ── WHY A GATED-ROLE FILTER IS MANDATORY (the correctness spine) ─────────────
 * Read the consumer before changing this. The audit
 * (loa-freeside `packages/services/shadow-audit/src/audit-service.ts`) does:
 *
 *     const { roleWallets, unmatched } = resolveRoles(snapshot);   // EVERY entry ⇒ a role-holder
 *     const staleAccess = [...roleWallets].filter((w) => !qualifies(curBal, w));
 *     stale_access_risk_band = staleRiskBand(staleAccess.length, roleWallets.size);
 *
 * i.e. it treats EVERY entry in the snapshot as "this member holds the token-gated role", and
 * reports the ones who no longer own the tokens as STALE ACCESS — the drift the product exists to
 * measure. So the snapshot must contain the holders of the GATED role and nobody else. Exporting
 * every guild member would report the entire server as stale access: a confidently-wrong audit,
 * which is the exact failure mode this cycle is built to prevent.
 *
 * `gatedRoleIds` is therefore REQUIRED and FAIL-CLOSED — there is no "export everyone" default,
 * and an `@everyone` role id (which every member holds, and which would silently degenerate into
 * exactly that) is REFUSED.
 *
 * ── UNMATCHED HOLDERS ARE FLAGGED, NEVER DROPPED ─────────────────────────────
 * A gated-role holder whose wallet does not resolve is emitted with `wallet` ABSENT. Silently
 * dropping them would understate the drift (they'd vanish from `roleWallets` rather than being
 * counted as a role-holder we cannot verify). The consumer's `resolveRoles` collects exactly these
 * into its `unmatched` set. The golden fixture carries an unmatched entry to pin this.
 *
 * ── PII FLOOR ────────────────────────────────────────────────────────────────
 * This module NEVER logs. Callers log through `redactDiscordId` / `redactWallet` — a raw wallet or
 * a raw discord snowflake must never reach stdout/stderr or a log sink.
 */
import {
  parseRoleSnapshot,
  WALLET_RE,
  type RoleSnapshot,
  type RoleSnapshotEntry,
} from "./role-snapshot.contract.ts";

/** Discord snowflakes are 17-20 digit decimal ids (same shape the identity client enforces). */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/** The exporter's provenance stamp (`export_method` on the wire). */
export const EXPORT_METHOD = "freeside-characters:role-snapshot-exporter@1";

/** Default freshness window — a snapshot older than this drives an `uncertain` audit downstream. */
export const DEFAULT_FRESHNESS_THRESHOLD_SECONDS = 86_400;

/** How many identity resolutions to run at once. The guild read is one call; identity is 1-2 HTTP
 *  GETs PER MEMBER, so a serial walk over a large gated set is the whole runtime. Bounded so we
 *  never open hundreds of sockets against identity-api. */
const RESOLVE_CONCURRENCY = 8;

/** One guild member as read from Discord: their snowflake + the role SNOWFLAKES they hold. */
export interface GuildRoleMemberRef {
  readonly discord_id: string;
  /** ALL role snowflakes this member holds (ids, NEVER names — the wire contract wants ids). */
  readonly role_ids: ReadonlyArray<string>;
}

/** Read the guild's members + their role ids. INJECTED (live adapter reads discord.js). */
export type GuildRoleMemberSource = (guildId: string) => Promise<ReadonlyArray<GuildRoleMemberRef>>;

/**
 * Resolve a member's discord snowflake → their wallet, or `undefined` when it cannot be resolved.
 * INJECTED. MUST be fail-soft: the CLI backs this with `MemberIdentityClient.resolveMember`, whose
 * every read is fail-soft. A throw here is caught and treated as unmatched (never dropped).
 */
export type MemberWalletResolver = (discordId: string) => Promise<string | undefined>;

export interface BuildRoleSnapshotInput {
  readonly guildId: string;
  /** MUST be an operated community (`thj`), else the live service answers 403. */
  readonly community: string;
  /**
   * The GATED COLLECTION this export is for — `{chain, contract}`, chain = NUMERIC EVM chain id.
   *
   * REQUIRED upstream (S5-T1). thj gates SEVEN collections, each behind its own Discord role; the store
   * keys snapshots by (community, collection). Without it the HJG1 export would OVERWRITE the Honeycomb
   * one and the Honeycomb audit would compute drift against HoneyJar1's role-holders — silently.
   * ANY deployment of the collection addresses it (the service canonicalizes across the union).
   */
  readonly collection: { readonly chain: string; readonly contract: string };
  /** Provenance only — the audit does not consume it. Conventionally the community owner wallet. */
  readonly owner: string;
  /** The token-gated role snowflake(s). REQUIRED — see the header. */
  readonly gatedRoleIds: ReadonlyArray<string>;
  readonly members: ReadonlyArray<GuildRoleMemberRef>;
  readonly resolveWallet: MemberWalletResolver;
  /** ISO-8601 UTC. Injected so tests are deterministic; the CLI passes `new Date().toISOString()`. */
  readonly capturedAt: string;
  readonly freshnessThresholdSeconds?: number;
  readonly exportMethod?: string;
}

export interface RoleSnapshotStats {
  /** members read from the guild. */
  readonly guild_members: number;
  /** members holding at least one gated role (⇒ the snapshot's entries). */
  readonly gated_members: number;
  /** gated members whose wallet resolved. */
  readonly resolved: number;
  /** gated members with NO resolvable wallet — FLAGGED in the snapshot, never dropped. */
  readonly unmatched: number;
}

export interface BuildRoleSnapshotResult {
  readonly snapshot: RoleSnapshot;
  readonly stats: RoleSnapshotStats;
}

/** Thrown when the exporter's inputs are unsafe — fail-closed, never a silently-degraded export. */
export class RoleSnapshotExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleSnapshotExportError";
  }
}

/** first4…last4 — the PII floor for a discord snowflake. NEVER log the raw id. */
export function redactDiscordId(id: string): string {
  return id.length <= 8 ? "…" : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/** 0x1234…abcd — the PII floor for a wallet. NEVER log the raw address. */
export function redactWallet(wallet: string): string {
  return wallet.length <= 10 ? "0x…" : `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/**
 * Validate the gated-role ids. FAIL-CLOSED on the two mistakes that would silently produce a
 * confidently-wrong audit:
 *   • an EMPTY list — there is no "export everyone" default (see the header).
 *   • the @everyone role — in Discord its id EQUALS the guild id, and every member holds it, so it
 *     would degenerate into exporting the whole guild as token-gated role-holders.
 */
function assertGatedRoleIds(gatedRoleIds: ReadonlyArray<string>, guildId: string): void {
  if (gatedRoleIds.length === 0) {
    throw new RoleSnapshotExportError(
      "gatedRoleIds is empty — refusing to export. The audit treats EVERY entry as a holder of the " +
        "token-gated role, so exporting the whole guild would report the entire server as stale access. " +
        "Pass the token-gated role snowflake(s) explicitly.",
    );
  }
  for (const id of gatedRoleIds) {
    if (!SNOWFLAKE_RE.test(id)) {
      throw new RoleSnapshotExportError(
        `gated role id '${id}' is not a Discord snowflake (17-20 digits). Role NAMES are not accepted — ` +
          "the wire contract requires ids.",
      );
    }
    if (id === guildId) {
      throw new RoleSnapshotExportError(
        "gated role id equals the guild id — that is @everyone, which every member holds. Exporting it " +
          "would mark the entire guild as token-gated role-holders. Refusing.",
      );
    }
  }
}

/** Run `fn` over `items` with bounded concurrency, preserving order. */
async function mapBounded<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Build the snapshot. The returned snapshot is VALIDATED against the vendored contract before it is
 * handed back — this module cannot emit a shape the live service would 422.
 */
export async function buildRoleSnapshot(input: BuildRoleSnapshotInput): Promise<BuildRoleSnapshotResult> {
  assertGatedRoleIds(input.gatedRoleIds, input.guildId);

  const gated = new Set(input.gatedRoleIds);

  // The gated cohort: members holding >= 1 gated role. Their entry carries ONLY the gated roles they
  // hold — not their whole role list. Minimal disclosure (the audit only ever reports role_ids back
  // for unmatched holders), and it keeps the wire payload about the audited grant, nothing else.
  const cohort: Array<{ discord_id: string; role_ids: string[] }> = [];
  for (const m of input.members) {
    const held = m.role_ids.filter((r) => gated.has(r));
    if (held.length > 0) cohort.push({ discord_id: m.discord_id, role_ids: held });
  }

  const entries = await mapBounded(cohort, RESOLVE_CONCURRENCY, async (m): Promise<RoleSnapshotEntry> => {
    let wallet: string | undefined;
    try {
      wallet = await input.resolveWallet(m.discord_id);
    } catch {
      // FAIL-SOFT ⇒ UNMATCHED, never dropped. A transient identity blip on one member must not
      // remove them from the snapshot — that would understate the drift.
      wallet = undefined;
    }
    // A resolver that hands back a malformed address is treated as unmatched rather than poisoning
    // the whole snapshot with a 422 (the contract would reject a non-0x40hex wallet).
    const usable = wallet && WALLET_RE.test(wallet) ? wallet.toLowerCase() : undefined;
    return usable
      ? { discord_user_id: m.discord_id, wallet: usable, role_ids: m.role_ids }
      : { discord_user_id: m.discord_id, role_ids: m.role_ids };
  });

  const snapshot = parseRoleSnapshot({
    source: `discord:guild:${input.guildId}`,
    community: input.community,
    collection: input.collection,
    captured_at: input.capturedAt,
    export_method: input.exportMethod ?? EXPORT_METHOD,
    owner: input.owner,
    freshness_threshold_seconds:
      input.freshnessThresholdSeconds ?? DEFAULT_FRESHNESS_THRESHOLD_SECONDS,
    entries,
  });

  const resolved = entries.filter((e) => e.wallet).length;
  return {
    snapshot,
    stats: {
      guild_members: input.members.length,
      gated_members: cohort.length,
      resolved,
      unmatched: entries.length - resolved,
    },
  };
}
