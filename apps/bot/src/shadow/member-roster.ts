/**
 * shadow/member-roster.ts — the MEMBER-CENTRIC roster builder for the voiceless
 * `/role-sync` CM dashboard (bd-l08).
 *
 * ── THE PIVOT (member-centric, not leaderboard-centric) ──────────────────────
 * `score-tier-assignment.ts` builds the roster FROM the score-api leaderboard
 * (top wallets → discord). For "manage roles for the MEMBERS of our server by
 * their tier" that is the wrong frame: the Purupuru leaderboard top-50 are not
 * discord-linked, while real members (the operator) ARE scored + linked but rank
 * far below the top page — so the leaderboard view never shows actual members.
 *
 * This builder starts from the GUILD MEMBERS and walks UP to each one's tier:
 *
 *   for each guild member (discord id + display name + current purupuru:* roles):
 *     → member-identity-client.resolveMember(discordId)
 *         unlinked  ⇒ row {linked:false}                    (skip assignment)
 *         no_wallet ⇒ row {linked:true, wallet:undefined}   (skip assignment)
 *         linked    ⇒ continue with the resolved wallet
 *     → scoreTier(wallet)  (the score community-client walletProfile read)
 *         null tier ⇒ "untiered"                            (skip assignment)
 *     → tier → strongest qualifying rule → proposed_role_key (seed/role-map)
 *   → MemberTierRow with a change indicator (ADD / KEEP / NO-CHANGE / UNLINKED /
 *     UNTIERED).
 *
 * ── SHADOW ONLY · ZERO WRITES ────────────────────────────────────────────────
 * This module performs NO discord.js role mutation — it only READS (guild member
 * list + their current roles), identity-api, and score-api, and produces a pure
 * read-model. The single gated write path (`role-writer.live.ts`) is untouched.
 * Role READS / identity reads / score reads are explicitly OUTSIDE the cross-repo
 * import-boundary lint (which confines only role MUTATIONS to the gated adapter).
 *
 * ── FAIL-SOFT PER MEMBER (never abort the batch) ─────────────────────────────
 * Each member is resolved independently. A failed identity / score lookup for one
 * member produces an `unlinked` / `untiered` row (never a throw), so one bad
 * member can never abort the roster. The score read is wrapped: any thrown
 * `CommunityScoreError` (or anything) for a member ⇒ that member is untiered.
 *
 * ── COST NOTE ────────────────────────────────────────────────────────────────
 * This is O(N) identity reads (1-2 per linked member) + O(N) score reads (1 per
 * linked+walleted member). Fine for a TEST guild (a few dozen members). The
 * identity reads coalesce per discord-id via the per-member resolve; the score
 * read is cached per wallet within a single build (a member may share a wallet).
 * A batched/streamed version for a large production guild is a follow-up.
 *
 * ── VOICELESS ────────────────────────────────────────────────────────────────
 * No persona-engine voice import. The score DATA client (community-client) is the
 * documented isolation-debt seam — data, not voice.
 */
import type { RoleRule, RoleMapConfig } from "@freeside-worlds/shadow-substrate";
import { tierQualifies, type TierRankResolver, purupuruTierRank } from "./purupuru-tiers.ts";

/** One guild member as seen by the builder (the discord read, injected). */
export interface GuildMemberRef {
  /** the member's discord snowflake. */
  readonly discord_id: string;
  /** the member's display name (server nick / global name / username). */
  readonly display_name?: string;
  /**
   * the member's CURRENT Freeside-managed (namespaced) role keys — the
   * `<namespace_prefix>*` role NAMES they currently hold. Empty when they hold
   * none. Used to compute the before→after change indicator.
   */
  readonly current_managed_roles: ReadonlyArray<string>;
}

/**
 * Read the configured guild's members (+ display name + current managed roles).
 * INJECTED so the builder is network-free in tests; the live adapter reads the
 * bot's discord.js Gateway client (guild.members.fetch()) — a READ, not a write.
 */
export type MemberSource = (world: string) => Promise<ReadonlyArray<GuildMemberRef>>;

/**
 * Resolve a wallet → its community tier (or null when untiered / the wallet is
 * absent). INJECTED — the live wiring backs it with the score community-client
 * `walletProfile(wallet).tier`; tests inject a pure map. MUST be fail-soft: a
 * throw is treated as untiered for that member (logged), never aborting the batch.
 */
export type MemberTierReader = (wallet: string) => Promise<string | null>;

/** The before→after change indicator for one member row. */
export type MemberChange =
  /** no linked identity-api account (no wallet to score). */
  | "UNLINKED"
  /** linked (+wallet) but no qualifying tier ⇒ would get no managed role. */
  | "UNTIERED"
  /** has a proposed tier role they do NOT currently hold ⇒ would gain it. */
  | "ADD"
  /** has a proposed tier role they ALREADY hold ⇒ unchanged. */
  | "KEEP"
  /** fully resolved, no proposed role AND holds no managed role ⇒ clean no-op. */
  | "NO-CHANGE";

/** One member-centric dashboard row (the CM's per-member before→after view). */
export interface MemberTierRow {
  readonly discord_id: string;
  readonly display_name?: string;
  /** has a linked identity-api account (false ⇒ UNLINKED). */
  readonly linked: boolean;
  /** the resolved primary wallet (absent when unlinked / no usable wallet). */
  readonly wallet?: string;
  /** the resolved community tier (absent when unlinked / untiered). */
  readonly tier?: string;
  /** the role this member's tier maps to (absent when unlinked / untiered). */
  readonly proposed_role_key?: string;
  /** the member's CURRENT managed (namespaced) roles. */
  readonly current_managed_roles: ReadonlyArray<string>;
  /** the before→after change indicator. */
  readonly change: MemberChange;
}

/** Summary counts for the dashboard header (derived from the rows). */
export interface MemberRosterSummary {
  readonly members: number;
  readonly linked: number;
  readonly would_add: number;
  readonly keep: number;
  readonly unlinked: number;
  readonly untiered: number;
}

export interface MemberRosterResult {
  readonly rows: ReadonlyArray<MemberTierRow>;
  readonly summary: MemberRosterSummary;
}

/**
 * The resolver the builder uses to turn a discord id into an identity outcome.
 * Matches `MemberIdentityClient.resolveMember`'s return; injected so the builder
 * is network-free in tests.
 */
export type MemberIdentityResolver = (
  discordId: string,
) => Promise<
  | { kind: "unlinked" }
  | { kind: "no_wallet"; user_id: string }
  | { kind: "linked"; user_id: string; wallet: string }
>;

export interface BuildMemberRosterInput {
  readonly world: string;
  readonly roleMap: RoleMapConfig;
  readonly members: MemberSource;
  readonly resolveIdentity: MemberIdentityResolver;
  readonly readTier: MemberTierReader;
  readonly tierRank?: TierRankResolver;
}

/**
 * Pick the STRONGEST rule a member's tier qualifies (highest min_tier rank). A
 * member maps to at most ONE managed tier role — the top one their tier earns.
 * Returns the winning rule's `role_key`, or undefined when none qualifies.
 * FAIL-CLOSED: a null/unknown tier qualifies nothing; a non-tier rule is skipped.
 */
function proposedRoleForTier(
  tier: string | null,
  rules: ReadonlyArray<RoleRule>,
  rank: TierRankResolver,
): string | undefined {
  let bestKey: string | undefined;
  let bestRank = -Infinity;
  for (const rule of rules) {
    if (rule.qualifies.source !== "tier") continue;
    if (!tierQualifies(tier, rule.qualifies.min_tier, rank)) continue;
    const r = rank(rule.qualifies.min_tier) ?? -Infinity;
    if (r > bestRank) {
      bestKey = rule.role_key;
      bestRank = r;
    }
  }
  return bestKey;
}

/**
 * Compute the change indicator for one member from its resolved state. Pure.
 */
export function computeChange(
  linked: boolean,
  proposedRoleKey: string | undefined,
  currentManagedRoles: ReadonlyArray<string>,
): MemberChange {
  if (!linked) return "UNLINKED";
  if (!proposedRoleKey) {
    // linked but no qualifying tier role. UNTIERED unless they already hold
    // nothing managed AND nothing is proposed — then it is a clean NO-CHANGE.
    return currentManagedRoles.length === 0 ? "NO-CHANGE" : "UNTIERED";
  }
  return currentManagedRoles.includes(proposedRoleKey) ? "KEEP" : "ADD";
}

/**
 * Build the member-centric roster. Reads the guild members, resolves each
 * member's identity → wallet → tier → proposed role, and produces a
 * {@link MemberTierRow} per member plus summary counts. SHADOW-only, zero writes,
 * fail-soft per member.
 */
export async function buildMemberRoster(
  input: BuildMemberRosterInput,
): Promise<MemberRosterResult> {
  const rank = input.tierRank ?? purupuruTierRank;
  const rules = input.roleMap.enabled ? input.roleMap.rules : [];
  const members = await input.members(input.world);

  // cache score reads per wallet within this build (members may share a wallet).
  const tierCache = new Map<string, string | null>();
  const readTierCached = async (wallet: string): Promise<string | null> => {
    const key = wallet.toLowerCase();
    if (tierCache.has(key)) return tierCache.get(key)!;
    let tier: string | null;
    try {
      tier = await input.readTier(wallet);
    } catch (e) {
      // FAIL-SOFT: a score lookup throw ⇒ untiered for this member (logged).
      console.warn(
        `[member-roster] score read failed for wallet ${key} — treating member as untiered: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      tier = null;
    }
    tierCache.set(key, tier);
    return tier;
  };

  const rows: MemberTierRow[] = [];
  for (const m of members) {
    const current = m.current_managed_roles ?? [];
    let identity:
      | { kind: "unlinked" }
      | { kind: "no_wallet"; user_id: string }
      | { kind: "linked"; user_id: string; wallet: string };
    try {
      identity = await input.resolveIdentity(m.discord_id);
    } catch (e) {
      // FAIL-SOFT: an identity throw ⇒ unlinked for this member (logged).
      console.warn(
        `[member-roster] identity resolve failed for member ${m.discord_id} — treating as unlinked: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      identity = { kind: "unlinked" };
    }

    if (identity.kind === "unlinked") {
      rows.push({
        discord_id: m.discord_id,
        display_name: m.display_name,
        linked: false,
        current_managed_roles: current,
        change: "UNLINKED",
      });
      continue;
    }

    if (identity.kind === "no_wallet") {
      // linked but no usable wallet ⇒ can't be scored ⇒ untiered.
      rows.push({
        discord_id: m.discord_id,
        display_name: m.display_name,
        linked: true,
        current_managed_roles: current,
        change: computeChange(true, undefined, current),
      });
      continue;
    }

    // linked + wallet ⇒ read the tier.
    const tier = await readTierCached(identity.wallet);
    const proposed = proposedRoleForTier(tier, rules, rank);
    rows.push({
      discord_id: m.discord_id,
      display_name: m.display_name,
      linked: true,
      wallet: identity.wallet,
      tier: tier ?? undefined,
      proposed_role_key: proposed,
      current_managed_roles: current,
      change: computeChange(true, proposed, current),
    });
  }

  return { rows, summary: summarize(rows) };
}

/** Derive the dashboard summary counts from the rows. */
export function summarize(rows: ReadonlyArray<MemberTierRow>): MemberRosterSummary {
  let linked = 0;
  let would_add = 0;
  let keep = 0;
  let unlinked = 0;
  let untiered = 0;
  for (const r of rows) {
    if (r.linked) linked += 1;
    switch (r.change) {
      case "ADD":
        would_add += 1;
        break;
      case "KEEP":
        keep += 1;
        break;
      case "UNLINKED":
        unlinked += 1;
        break;
      case "UNTIERED":
        untiered += 1;
        break;
      // NO-CHANGE counts toward none of the action buckets.
    }
  }
  return { members: rows.length, linked, would_add, keep, unlinked, untiered };
}
