/**
 * shadow/score-tier-assignment.ts — the per-member tier→role ASSIGN-BATCH
 * builder (bd-tfl part 2): "manage Discord roles by score-api tier".
 *
 * ── THE PATH (grounded against the substrate's write model) ──────────────────
 *   score-api Purupuru leaderboard (wallet → tier)
 *     ⋈ identity (wallet ↔ discord SNOWFLAKE)
 *     ⋈ CM role-map rules (tier → role_key, via RoleRule.qualifies.min_tier)
 *   → for each linked wallet that qualifies a rule:
 *         AssignRoleIntent{ role_key, member_id: <discord snowflake> }
 *   → WriteOp[] (assign_role) → WriteIntentBatch → gate.applyBatch (the SINGLE
 *     gated write path; this module NEVER touches discord.js directly — the
 *     cross-repo import-boundary lint forbids it).
 *
 * ── WHAT THIS MODULE OWNS vs THE SUBSTRATE GAPS ──────────────────────────────
 * This module owns the PURE JOIN + the batch ASSEMBLY. It does NOT mint a
 * `WriteCapability` and does NOT manufacture an `AuthzContext` out of thin air —
 * BOTH come from the substrate's authorized `goLive` (the SHADOW→LIVE
 * transition; `goLive` is SACRED / SHA-pinned and returns
 * `{ capability, authzDecisionId }`). `assembleAssignBatch` therefore TAKES the
 * go_live outputs + a roster-freshness `RosterVersion` and threads them into a
 * well-formed `WriteIntentBatch` whose hash-binding invariants the gate enforces.
 *
 * TWO genuine seams are NOT closed here (flagged in the build report + a new
 * bead; do NOT fake them):
 *   1. The LIVE wallet↔discord-SNOWFLAKE adapter. The join needs a Discord
 *      snowflake `member_id` (the gate's `assignRole` does
 *      `guild.members.fetch(member_id)`). The repo's `WalletResolver` port
 *      surfaces a `discord_handle` (display string), NOT a snowflake — unusable
 *      for assignment. The freeside_auth MCP resolver DOES carry
 *      `ResolvedWallet.discord_id` (the snowflake, from `midi_profiles`), but no
 *      port exposes it to the shadow seam yet. So this builder takes an
 *      INJECTABLE `WalletDiscordLink` resolver; the live adapter that reads
 *      `discord_id` is the follow-up.
 *   2. The orchestration that calls `goLive` (mints the cap) then this builder
 *      then `applyBatch` is not wired into a bot entrypoint yet — `goLive`
 *      requires an authorized admin + roster-freshness inputs (the lens/CM
 *      flow). This module provides the reusable pieces; the entrypoint that
 *      sequences them is the next layer.
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 *   • assign-ONLY (FR-6 of the brief). This builder NEVER emits a create_role op
 *     and NEVER a role REMOVAL — shadow-onboarding never strips users (R-6). It
 *     assigns the highest-qualifying tier role per member.
 *   • namespace: every `role_key` comes from the CM role-map rules (already
 *     Freeside-namespaced); the gate's writer re-enforces the namespace guard.
 *   • idempotent: deterministic `op_id`/`idempotency_key` per (world, report,
 *     role_key, member_id) so a retried batch is safe (the gate dedups assigns;
 *     a held role is a Discord no-op).
 */
import { sha256 } from "@noble/hashes/sha256";
import { utf8ToBytes, bytesToHex } from "@noble/hashes/utils";
import type {
  RoleRule,
  RoleMapConfig,
  WriteOp,
  WriteIntentBatch,
  AuthzContext,
  RosterVersion,
  Hex64,
  WorldSlug,
} from "@freeside-worlds/shadow-substrate";
import type { CommunityLeaderboardEntry } from "@freeside-characters/persona-engine/score/community-client";
import { tierQualifies, type TierRankResolver, purupuruTierRank } from "./purupuru-tiers.ts";

// ─── identity link port (the wallet ↔ discord-snowflake seam) ────────────────

/**
 * Resolve a wallet → its Discord snowflake `member_id`, or null when the wallet
 * is not linked. INJECTABLE: tests provide a map; the LIVE adapter (follow-up,
 * see header gap #1) reads `ResolvedWallet.discord_id` from the freeside_auth /
 * identity-api source. A null link means the wallet is QUALIFIED-but-not-linked
 * (counted in `skipped_unlinked`), never assigned.
 */
export interface WalletDiscordLink {
  /** wallet (any case) → discord snowflake, or null if not linked. */
  resolve(wallet: string): Promise<string | null>;
}

// ─── the pure join → assign ops ──────────────────────────────────────────────

/** One resolved assignment (pre-WriteOp), for legibility + testing. */
export interface TierAssignment {
  readonly wallet: string;
  readonly member_id: string;
  readonly tier: string;
  readonly role_key: string;
}

export interface BuildAssignmentsInput {
  readonly leaderboard: ReadonlyArray<CommunityLeaderboardEntry>;
  readonly roleMap: RoleMapConfig;
  readonly link: WalletDiscordLink;
  readonly tierRank?: TierRankResolver;
}

export interface BuildAssignmentsResult {
  readonly assignments: ReadonlyArray<TierAssignment>;
  /** qualified wallets with NO discord link (counted, never assigned). */
  readonly skipped_unlinked: number;
  /** wallets that qualified no rule (below every rule's min_tier / untiered). */
  readonly skipped_unqualified: number;
}

/**
 * Pick the STRONGEST rule a wallet's tier qualifies (highest min_tier rank). A
 * wallet gets at most ONE managed tier role — the top one it earns. Returns the
 * winning rule or undefined when the wallet qualifies none.
 */
function strongestQualifyingRule(
  tier: string | null,
  rules: ReadonlyArray<RoleRule>,
  rank: TierRankResolver,
): RoleRule | undefined {
  let best: RoleRule | undefined;
  let bestRank = -Infinity;
  for (const rule of rules) {
    if (!tierQualifies(tier, rule.qualifies.min_tier, rank)) continue;
    const r = rank(rule.qualifies.min_tier) ?? -Infinity;
    if (r > bestRank) {
      best = rule;
      bestRank = r;
    }
  }
  return best;
}

/**
 * Build the per-member assignments by joining the leaderboard ⋈ identity links ⋈
 * role-map rules. Pure except for the injected `link.resolve` (async). Emits at
 * most one assignment per linked, qualified wallet (its strongest tier role).
 * Disabled role-maps (`enabled:false`) produce zero assignments.
 */
export async function buildTierAssignments(
  input: BuildAssignmentsInput,
): Promise<BuildAssignmentsResult> {
  const rank = input.tierRank ?? purupuruTierRank;
  if (!input.roleMap.enabled) {
    return { assignments: [], skipped_unlinked: 0, skipped_unqualified: 0 };
  }
  const rules = input.roleMap.rules;
  const assignments: TierAssignment[] = [];
  let skipped_unlinked = 0;
  let skipped_unqualified = 0;

  for (const entry of input.leaderboard) {
    const rule = strongestQualifyingRule(entry.tier, rules, rank);
    if (!rule) {
      skipped_unqualified += 1;
      continue;
    }
    const memberId = await input.link.resolve(entry.wallet);
    if (memberId === null || memberId.length === 0) {
      skipped_unlinked += 1;
      continue;
    }
    assignments.push({
      wallet: entry.wallet,
      member_id: memberId,
      // entry.tier is non-null here (strongestQualifyingRule returned a rule).
      tier: entry.tier as string,
      role_key: rule.role_key,
    });
  }

  return { assignments, skipped_unlinked, skipped_unqualified };
}

// ─── op_id / idempotency_key (deterministic, retry-safe) ─────────────────────

/**
 * Stable JSON (sorted keys) for the hash inputs. The inputs are flat objects of
 * strings, so a sorted-key serialize is a sufficient canonical form (a full RFC
 * 8785 JCS is overkill for primitive-only maps and would add a dep apps/bot
 * doesn't carry). Determinism is the requirement; this delivers it.
 */
function stableStringify(obj: Record<string, string>): string {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, obj[k]])));
}

function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

/** Deterministic op_id for an assign op (stable across retries). */
export function assignOpId(world: string, roleKey: string, memberId: string): string {
  return `assign:${world}:${roleKey}:${memberId}`;
}

/** = sha256(stableJSON({world, op_id, report_hash})) — the gate's retry key. */
export function assignIdempotencyKey(
  world: string,
  opId: string,
  reportHash: string,
): Hex64 {
  return sha256Hex(stableStringify({ world, op_id: opId, report_hash: reportHash })) as unknown as Hex64;
}

/** Map resolved assignments → substrate `WriteOp[]` (assign_role only). */
export function assignmentsToOps(
  world: string,
  reportHash: string,
  assignments: ReadonlyArray<TierAssignment>,
): WriteOp[] {
  return assignments.map((a) => {
    const op_id = assignOpId(world, a.role_key, a.member_id);
    return {
      op_id,
      idempotency_key: assignIdempotencyKey(world, op_id, reportHash),
      kind: "assign_role" as const,
      intent: { role_key: a.role_key, member_id: a.member_id as never },
    };
  });
}

// ─── full batch assembly (threads the goLive outputs) ────────────────────────

/**
 * The pieces the substrate's authorized `goLive` hands back (its `GoLiveOutput`
 * carries `authzDecisionId`; the caller already knows `reportHash` /
 * `transitionVersion` it passed in). We take them as inputs rather than
 * recomputing — the gate binds all four of {current map hash, cap report_hash,
 * batch report_hash, authz report_hash} + decision_id + transition_version.
 */
export interface AuthorizedTransition {
  readonly actor: string;
  readonly reportHash: string;
  readonly authzDecisionId: string;
  readonly transitionVersion: number;
  readonly tokenMetadata: { readonly kid: string; readonly verified_at: string; readonly exp: string };
}

export interface AssembleBatchInput {
  readonly world: string;
  readonly transition: AuthorizedTransition;
  readonly rosterVersion: RosterVersion;
  readonly assignments: ReadonlyArray<TierAssignment>;
  /** intra-batch in-flight cap (gate default 4). */
  readonly maxConcurrent?: number;
}

/**
 * Assemble a gate-ready `WriteIntentBatch` of assign ops from resolved
 * assignments + an authorized transition. The returned batch is what
 * `GateCheckedRoleWriter.applyBatch(batch, cap)` consumes — the cap being the one
 * `goLive` minted for the SAME `{reportHash, authzDecisionId, transitionVersion}`.
 *
 * NOTE: this builds the assign-only batch. If the namespaced tier roles don't yet
 * exist on the guild, a SEPARATE create-role pass (the substrate's go_live /
 * computeProposed flow, FR-4) must precede it — this builder is the ASSIGN half
 * (per the brief: "per-member tier→role assign-batch").
 */
export function assembleAssignBatch(input: AssembleBatchInput): WriteIntentBatch {
  const { world, transition: t } = input;
  const authz: AuthzContext = {
    actor: t.actor,
    world: world as unknown as WorldSlug,
    report_hash: t.reportHash as unknown as Hex64,
    token_metadata: t.tokenMetadata,
    transition_version: t.transitionVersion,
    authz_decision_id: t.authzDecisionId,
    roster_version: input.rosterVersion,
  };
  return {
    world: world as unknown as WorldSlug,
    report_hash: t.reportHash as unknown as Hex64,
    authz,
    ops: assignmentsToOps(world, t.reportHash, input.assignments),
    max_concurrent: input.maxConcurrent ?? 4,
  };
}
