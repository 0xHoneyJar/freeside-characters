/**
 * shadow/go-live-orchestrator.ts — the go_live → build → applyBatch RUNTIME
 * ENTRYPOINT for per-member tier→role assignment (bd-m2v SEAM 2).
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
 * The pure half (`score-tier-assignment.ts`) builds a gate-valid WriteIntentBatch
 * and the E2E test drives goLive→applyBatch by hand. But nothing in the RUNTIME
 * sequences the real flow. This module is that sequence — the bot entrypoint a
 * CM action (or a scheduled sweep) calls to manage Discord roles from score-api
 * tiers:
 *
 *   (a) AUTHORIZE the admin    — resolveAuthz({actor, world}) against the
 *                                manifest `admin_principals` (FR-10).
 *   (b) GO_LIVE (LIVE only)    — mint the WriteCapability (the substrate's
 *                                authorized SHADOW→LIVE transition; B1 roster-
 *                                freshness re-eval + the pure transition guard).
 *   (c) READ the world         — the LIVE Purupuru leaderboard (via the injected
 *                                `leaderboardReader`, backed by CommunityScoreClient,
 *                                bd-tfl) + the current guild roster (RosterSource)
 *                                + the roster identity snapshot (B1 fingerprint).
 *   (d) CREATE pass (FR-4)     — `assembleGoLiveBatch` runs the substrate's PURE
 *                                `computeProposed` to derive the not-yet-created
 *                                managed tier roles → `create_role` ops, ordered
 *                                BEFORE the assigns. We INTEGRATE with the
 *                                substrate's create flow, never reimplement it.
 *   (e) ASSIGN pass + apply    — the per-member assign ops + `applyBatch` through
 *                                the gate (the single gated write path).
 *
 * ── SHADOW vs LIVE (the DESIRED action is the switch — enforced at the gate) ──
 * The caller declares the DESIRED action via `input.applyMode` (a CM clicks
 * "preview" vs "go live"). The substrate's `goLive` IS the SHADOW→LIVE
 * transition (it flips the shared `apply_mode` Ref + mints the cap), and the gate
 * reads that Ref AT INVOCATION (R-10):
 *   • "SHADOW" (preview) → this entrypoint does NOT call goLive (no mint, no mode
 *               flip; the Ref stays SHADOW). It builds the would-be batch + a
 *               synthetic cap and runs `applyBatch` — the gate, seeing SHADOW,
 *               confirms a `shadow.role.rejected.v1` per op and performs ZERO
 *               inner writes (the substrate-proven invariant). The caller gets
 *               the batch shape + the gate's rejection, which IS the preview.
 *   • "LIVE" (apply)    → goLive performs the SHADOW→LIVE flip + mints the cap
 *               (after the fresh authz + roster-freshness guards), the batch is
 *               bound to that authorized transition, and `applyBatch` writes
 *               through the gated adapter (the gate now reads LIVE).
 * The mode value is NEVER captured here for the gate — the gate reads the shared
 * `ModeControl` Ref `goLive` just flipped. The DESIRED action picks the PATH; the
 * gate is the ENFORCED boundary either way.
 *
 * ── THE SUBSTRATE GAP THIS HITS (documented, NOT faked) ──────────────────────
 * The substrate's go_live roster-freshness (B1) needs a `RosterIdentitySnapshot`
 * (the member-id ⊕ role-id SETS), but the SHA-pinned `RosterSource` port surfaces
 * only the `CurrentRoster` render-model (per-role member COUNTS). The substrate's
 * own roster-freshness.ts header acknowledges this: the fingerprint operates on a
 * RosterIdentitySnapshot the LIVE RosterSource "produces ALONGSIDE the render-
 * model" — but the pinned `RosterSource` Context.Tag has NO method for the
 * snapshot, and the repo's LIVE roster adapter does not yet produce one. So this
 * entrypoint takes the snapshot via an INJECTED `RosterIdentityReader` (the thin
 * live wiring reads guild member/role ids; tests inject fixtures). When no base
 * fingerprint is supplied (first go_live, no prior preview), the fresh snapshot
 * is its own base (zero drift) — the conservative, non-blocking default. The
 * honest fix (a snapshot method on the substrate RosterSource port) is a
 * freeside-worlds change — see the seam-3 bead note + bd-m2v.
 */
import { Effect } from "effect";
import {
  GateCheckedRoleWriter,
  ScoreSource,
  RosterSource,
  RoleWriter,
  WorldLock,
  resolveAuthz,
  goLive,
  rosterFingerprint,
  AdminAllowlistSource,
  AcvpEmitter,
  ScoreError,
  AuthzError,
  RosterError,
} from "./substrate.ts";
import type {
  RoleMapConfig,
  WorldSlug,
  Hex64,
  CurrentRoster,
  ApplyBatchResult,
  WriteIntentBatch,
  RosterVersion,
  WriteCapability,
  ModeControl,
  GuardFailed,
  ShadowGateRejected,
  WriteError,
} from "@freeside-worlds/shadow-substrate";
import { type CommunityLeaderboardEntry } from "@freeside-characters/persona-engine/score/community-client";
import {
  buildTierAssignments,
  assembleGoLiveBatch,
  type WalletDiscordLink,
  type AuthorizedTransition,
  type TierAssignment,
} from "./score-tier-assignment.ts";
import { LinkResolutionError } from "./wallet-discord-link.live.ts";
import { type TierRankResolver, purupuruTierRank } from "./purupuru-tiers.ts";

/**
 * The coarse identity snapshot the B1 roster-freshness fingerprint covers (the
 * member-id ⊕ role-id sets). Structurally mirrors the substrate's
 * `RosterIdentitySnapshot` (the substrate exports it only on roster-freshness,
 * and the RosterSource port that should carry it does not).
 */
export interface RosterIdentitySnapshot {
  readonly member_ids: ReadonlyArray<string>;
  readonly role_ids: ReadonlyArray<string>;
}

/**
 * Reads the live guild's member-id ⊕ role-id snapshot for the B1 fingerprint.
 * INJECTED (the thin live wiring reads the discord.js guild; tests inject a
 * fixture). This is the seam the substrate's RosterSource port SHOULD carry but
 * does not (documented above + in the bead).
 */
export type RosterIdentityReader = (world: string) => Promise<RosterIdentitySnapshot>;

/**
 * Reads the full leaderboard (wallet → tier) for the assign pass. The ScoreSource
 * port surfaces only a COUNT (`latentQualified`) — not the full roster — so the
 * per-member assign pass needs the leaderboard directly. The composition root
 * supplies this (it already builds the `CommunityScoreClient`). When omitted
 * (MOCK / preview with no live key), the assign pass sees an empty leaderboard →
 * zero assignments (the create pass still runs from the role-map) — never a
 * silent guess.
 */
export type LeaderboardReader = () => Promise<ReadonlyArray<CommunityLeaderboardEntry>>;

/** Token metadata the upstream (config-service / go_live) already verified. */
export interface VerifiedTokenMetadata {
  readonly kid: string;
  readonly verified_at: string;
  readonly exp: string;
}

export interface GoLiveOrchestrationInput {
  /** the world slug (e.g. "purupuru"). */
  readonly world: string;
  /**
   * the DESIRED action: "SHADOW" (preview — no mint, no flip, gate rejects → zero
   * writes) or "LIVE" (apply — goLive flips SHADOW→LIVE + mints, gate writes via
   * the gated adapter). This is the shadow/apply switch, surfaced explicitly so
   * the caller declares intent rather than the entrypoint inferring it from the
   * (possibly already-flipped) Ref.
   */
  readonly applyMode: "SHADOW" | "LIVE";
  /** the verified admin actor (identity-api claims.sub). */
  readonly actor: string;
  /** the FR-7 report hash (roleMapVersionHash of the current map). */
  readonly reportHash: Hex64;
  /** roleMapVersionHash(current map), re-derived fresh at go_live (== reportHash for an unchanged map). */
  readonly currentMapHash: Hex64;
  /** ties the minted cap + batch to ONE authorized transition. */
  readonly transitionVersion: number;
  /** ISO timestamp the decision is evaluated at (caller-supplied; no clock read). */
  readonly evaluatedAt: string;
  /** the CM role-map (tier→role_key rules). */
  readonly roleMap: RoleMapConfig;
  /** verified token metadata for the batch AuthzContext. */
  readonly tokenMetadata: VerifiedTokenMetadata;
  /** reads the live leaderboard (wallet → tier) for the assign pass. */
  readonly leaderboardReader?: LeaderboardReader;
  /**
   * the frozen base roster fingerprint from the preview the CM approved (B1). If
   * omitted (a direct go_live with no prior preview), the fresh snapshot is used
   * as its own base — zero drift, the conservative non-blocking default.
   */
  readonly baseRosterFingerprint?: Hex64;
  /** the base identity snapshot the preview captured (paired with baseRosterFingerprint). */
  readonly baseRosterSnapshot?: RosterIdentitySnapshot;
  /** B1 drift threshold override (default: substrate default = 0). */
  readonly rosterDriftThreshold?: number;
  /** tier ordering (defaults to the grounded Purupuru ladder). */
  readonly tierRank?: TierRankResolver;
  /** intra-batch in-flight cap (gate default 4). */
  readonly maxConcurrent?: number;
  /** SOFT 2-week-soak advisory (FR-7) — surfaced, NEVER blocks. */
  readonly soakSatisfied?: boolean;
}

/** The orchestration result the caller (lens / CLI / scheduled sweep) consumes. */
export interface GoLiveOrchestrationResult {
  /** the apply_mode this run executed under (read from the gate's Ref). */
  readonly applyMode: "SHADOW" | "LIVE";
  /** the assembled batch (create pass + assign pass). */
  readonly batch: WriteIntentBatch;
  /** the gate's terminal job state (op_status + roles_created ledger). */
  readonly job: ApplyBatchResult;
  /** how many tier roles the create pass proposed. */
  readonly createCount: number;
  /** how many member assignments the assign pass resolved. */
  readonly assignCount: number;
  /** qualified-but-unlinked wallets (counted, never assigned). */
  readonly skippedUnlinked: number;
  /** wallets below every rule (untiered / too low). */
  readonly skippedUnqualified: number;
  /** qualified+linked wallets whose member_id was not a valid snowflake (#12). */
  readonly skippedInvalid: number;
  /** extra wallet→member assignments collapsed by per-member dedup (#6). */
  readonly collapsedDuplicateMembers: number;
}

/**
 * The Effect requirements this orchestration needs in context. Beyond the gate +
 * sources, the gate's `applyBatch` re-resolves authz server-side at the write
 * boundary, so it pulls `RoleWriter | AcvpEmitter | WorldLock |
 * AdminAllowlistSource` into the SERVICE method's requirement channel (per the
 * substrate gate's `applyBatch` signature). The composition root provides all of
 * them (the shadow-preview / live-apply Layer stacks already merge them).
 */
export type OrchestrationContext =
  | GateCheckedRoleWriter
  | ScoreSource
  | RosterSource
  | RoleWriter
  | WorldLock
  | AdminAllowlistSource
  | AcvpEmitter;

/** Typed error union the orchestration can fail with. */
export type OrchestrationError =
  | GuardFailed
  | AuthzError
  | ScoreError
  | RosterError
  | WriteError
  | ShadowGateRejected;

export interface OrchestrationDeps {
  /** the apply_mode control the gate reads (SHADOW/LIVE switch). */
  readonly mode: ModeControl;
  /** wallet → discord snowflake | null (SEAM 1; live adapter or mock). */
  readonly link: WalletDiscordLink;
  /** reads the live guild member-id ⊕ role-id snapshot (B1 fingerprint). */
  readonly rosterIdentity: RosterIdentityReader;
}

interface BuiltAssignments {
  readonly assignments: ReadonlyArray<TierAssignment>;
  readonly skipped_unlinked: number;
  readonly skipped_unqualified: number;
  readonly skipped_invalid: number;
  readonly collapsed_duplicate_members: number;
}

/**
 * Drive the full go_live → build → applyBatch sequence. EFFECTFUL — requires the
 * gate + ScoreSource + RosterSource + AdminAllowlistSource + AcvpEmitter in
 * context (the composition root supplies them; SHADOW preview uses MOCK writer,
 * LIVE apply uses the gated adapter).
 *
 * The DESIRED action (`input.applyMode`) chooses the PATH:
 *   • LIVE  → resolveAuthz (deny ⇒ fail), goLive (SHADOW→LIVE flip + mint cap),
 *             build batch bound to the authorized transition, applyBatch (real
 *             writes via the gate, which now reads LIVE).
 *   • SHADOW→ no goLive (no mint / no flip); build a PREVIEW batch + applyBatch,
 *             which the gate rejects per op with ZERO inner writes (the preview).
 */
export function runTierRoleGoLive(
  deps: OrchestrationDeps,
  input: GoLiveOrchestrationInput,
): Effect.Effect<GoLiveOrchestrationResult, OrchestrationError, OrchestrationContext> {
  return Effect.gen(function* () {
    const worldSlug = input.world as unknown as WorldSlug;
    const rank = input.tierRank ?? purupuruTierRank;

    // The DESIRED action picks the path; goLive (LIVE) flips the shared Ref the
    // gate reads at apply, SHADOW leaves it untouched (gate rejects → preview).
    const applyMode = input.applyMode;

    // ── (0) AUTHORIZE FIRST — for BOTH shadow and live, BEFORE any read or batch
    //        assembly (Bridgebuilder #1). The SHADOW preview reads roster /
    //        leaderboard / wallet-links and assembles a batch carrying Discord
    //        snowflakes — that is sensitive even though it never WRITES, so a
    //        denied actor must fail BEFORE we read anything. `bypassCache:true`
    //        matches the freshness goLive uses. (LIVE re-resolves again inside
    //        goLive + the gate re-resolves at the write boundary — defense in
    //        depth; this is the FRONT gate that protects the reads.)
    const decision = yield* resolveAuthz({
      actor: input.actor,
      world: worldSlug,
      evaluatedAt: input.evaluatedAt,
      bypassCache: true,
    });
    if (decision.decision !== "grant") {
      return yield* Effect.fail(
        new AuthzError({
          message: `actor '${input.actor}' is not allowlisted for world '${input.world}' (${decision.reason}) — ${applyMode === "LIVE" ? "go_live" : "preview"} refused before any read`,
        }),
      );
    }

    // ── (b-pre) ROSTER-FRESHNESS INPUT VALIDATION (Bridgebuilder #2) ──────────
    // A `baseRosterFingerprint` WITHOUT a `baseRosterSnapshot` (or vice-versa)
    // when a drift threshold is active would make goLive compare freshSnapshot vs
    // freshSnapshot (zero drift = a silent BYPASS of the freshness guard). Require
    // them as a PAIR, and assert the supplied fingerprint actually matches the
    // supplied snapshot (a mismatched pair is a corrupt/forged base).
    const driftThreshold = input.rosterDriftThreshold ?? 0;
    const hasFp = input.baseRosterFingerprint !== undefined;
    const hasSnap = input.baseRosterSnapshot !== undefined;
    if (hasFp !== hasSnap) {
      return yield* Effect.fail(
        new RosterError({
          message: `roster-freshness base is half-specified: baseRosterFingerprint ${hasFp ? "set" : "unset"} but baseRosterSnapshot ${hasSnap ? "set" : "unset"} — they MUST be supplied as a pair (an fp without its snapshot silently bypasses the drift guard)`,
        }),
      );
    }
    if (hasFp && hasSnap) {
      const computed = rosterFingerprint(input.baseRosterSnapshot!);
      if ((computed as unknown as string) !== (input.baseRosterFingerprint as unknown as string)) {
        return yield* Effect.fail(
          new RosterError({
            message: `roster-freshness base mismatch: rosterFingerprint(baseRosterSnapshot) ≠ baseRosterFingerprint — the supplied base pair is inconsistent (rejecting; a forged/corrupt base would bypass drift detection)`,
          }),
        );
      }
    }
    // A positive drift threshold with NO base pair would compare fresh-vs-fresh
    // (zero drift) — refuse rather than silently no-op the guard.
    if (driftThreshold > 0 && !(hasFp && hasSnap)) {
      return yield* Effect.fail(
        new RosterError({
          message: `rosterDriftThreshold=${driftThreshold} requires a base roster snapshot+fingerprint pair (from the approved preview) — without one, drift compares fresh-vs-fresh = 0 (a bypass). Supply the base pair or set threshold 0.`,
        }),
      );
    }

    // ── (c) READ the world: roster (counts) + leaderboard + identity snapshot ─
    const rosterSource = yield* RosterSource;
    const currentRoster: CurrentRoster = yield* rosterSource.currentRoster(worldSlug);

    const leaderboard = yield* readLeaderboard(input, applyMode);

    const freshSnapshot = yield* Effect.tryPromise({
      try: () => deps.rosterIdentity(input.world),
      catch: (e) =>
        new RosterError({
          message: `roster identity snapshot read failed: ${e instanceof Error ? e.message : String(e)}`,
        }),
    });

    // ── build the per-member ASSIGN set (SEAM 1 link join) ────────────────────
    // A `LinkResolutionError` (identity DB unavailable, Bridgebuilder #7) is
    // FAIL-CLOSED: it propagates as a RosterError so the run FAILS (LIVE must not
    // proceed creating roles + assigning nobody when the link source was down).
    // Other build errors map to ScoreError.
    const built: BuiltAssignments = yield* Effect.tryPromise({
      try: () =>
        buildTierAssignments({
          leaderboard,
          roleMap: input.roleMap,
          link: deps.link,
          tierRank: rank,
        }),
      catch: (e) =>
        e instanceof LinkResolutionError
          ? new RosterError({
              message: `identity link resolution failed (DB unavailable) — go_live refused, NOT skipped: ${e.message}`,
            })
          : new ScoreError({
              message: `assignment build failed: ${e instanceof Error ? e.message : String(e)}`,
            }),
    });

    // ── ROSTER VERSION for the batch authz (B1) ───────────────────────────────
    const rosterVersion: RosterVersion = {
      fingerprint: rosterFingerprint(freshSnapshot),
      fetched_at: input.evaluatedAt,
      member_count: freshSnapshot.member_ids.length,
    };

    if (applyMode === "LIVE") {
      return yield* applyLive(deps, input, currentRoster, built, freshSnapshot, rosterVersion);
    }
    return yield* applyShadowPreview(deps, input, currentRoster, built, rosterVersion);
  });
}

// ─── LIVE path ────────────────────────────────────────────────────────────────

function applyLive(
  deps: OrchestrationDeps,
  input: GoLiveOrchestrationInput,
  currentRoster: CurrentRoster,
  built: BuiltAssignments,
  freshSnapshot: RosterIdentitySnapshot,
  rosterVersion: RosterVersion,
): Effect.Effect<GoLiveOrchestrationResult, OrchestrationError, OrchestrationContext> {
  return Effect.gen(function* () {
    const worldSlug = input.world as unknown as WorldSlug;

    // NOTE: the FRONT authz gate (resolveAuthz, bypassCache) already ran in
    // `runTierRoleGoLive` BEFORE any read (Bridgebuilder #1). goLive re-resolves
    // fresh at the mint, and the gate re-resolves AGAIN at the write boundary —
    // defense in depth. We do not re-check here (it would be a 4th identical
    // resolve); the reads upstream of this point were already authz-gated.

    // (b) GO_LIVE — mint the cap. B1 roster-freshness uses the fresh snapshot as
    //     its own base when no prior preview fingerprint was supplied (zero
    //     drift, non-blocking default). The fp/snapshot PAIRING + match was
    //     validated up-front (#2), so a half-specified/forged base never reaches
    //     here.
    const baseSnapshot = input.baseRosterSnapshot ?? freshSnapshot;
    const baseFingerprint = input.baseRosterFingerprint ?? rosterFingerprint(baseSnapshot);
    const out = yield* goLive(deps.mode, {
      actor: input.actor,
      world: worldSlug,
      reportHash: input.reportHash,
      currentMapHash: input.currentMapHash,
      transitionVersion: input.transitionVersion,
      evaluatedAt: input.evaluatedAt,
      soakSatisfied: input.soakSatisfied,
      rosterFreshness: {
        baseFingerprint,
        baseSnapshot,
        freshSnapshot,
        threshold: input.rosterDriftThreshold,
      },
    });

    // (d)+(e) build the FULL batch (CREATE pass + ASSIGN pass) bound to the
    // authorized transition, then applyBatch through the gate.
    const transition: AuthorizedTransition = {
      actor: input.actor,
      reportHash: input.reportHash as unknown as string,
      authzDecisionId: out.authzDecisionId,
      transitionVersion: input.transitionVersion,
      tokenMetadata: input.tokenMetadata,
    };
    const batch = assembleGoLiveBatch({
      world: input.world,
      transition,
      rosterVersion,
      assignments: built.assignments,
      roleMap: input.roleMap,
      currentRoster,
      maxConcurrent: input.maxConcurrent,
    });

    const gate = yield* GateCheckedRoleWriter;
    const job = yield* gate.applyBatch(batch, out.capability);

    return result("LIVE", batch, job, built);
  });
}

// ─── SHADOW preview path ────────────────────────────────────────────────────

function applyShadowPreview(
  deps: OrchestrationDeps,
  input: GoLiveOrchestrationInput,
  currentRoster: CurrentRoster,
  built: BuiltAssignments,
  rosterVersion: RosterVersion,
): Effect.Effect<GoLiveOrchestrationResult, OrchestrationError, OrchestrationContext> {
  return Effect.gen(function* () {
    // SHADOW: NO goLive (no mint, no flip). We still build the would-be batch so
    // the caller sees the preview shape, and we run it through the gate — which,
    // reading SHADOW at invocation, confirms a per-op rejection and performs ZERO
    // inner writes (the substrate-proven SHADOW⇒no-writes invariant). The gate
    // rejects under SHADOW BEFORE it validates the cap binding, so the preview
    // never needs a real mint.
    const transition: AuthorizedTransition = {
      actor: input.actor,
      reportHash: input.reportHash as unknown as string,
      authzDecisionId: `preview:${input.actor}:${input.world}`,
      transitionVersion: input.transitionVersion,
      tokenMetadata: input.tokenMetadata,
    };
    const batch = assembleGoLiveBatch({
      world: input.world,
      transition,
      rosterVersion,
      assignments: built.assignments,
      roleMap: input.roleMap,
      currentRoster,
      maxConcurrent: input.maxConcurrent,
    });

    const gate = yield* GateCheckedRoleWriter;
    // A SHADOW applyBatch fails ShadowGateRejected AFTER confirming a rejection
    // per op (zero inner writes). We RECOVER it into a preview job result rather
    // than failing the orchestration — a SHADOW preview "succeeding" means the
    // gate correctly rejected every op.
    const job = yield* gate.applyBatch(batch, makePreviewCap()).pipe(
      Effect.catchTag("ShadowGateRejected", () => Effect.succeed(shadowRejectedJob(batch))),
    );

    return result("SHADOW", batch, job, built);
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function readLeaderboard(
  input: GoLiveOrchestrationInput,
  applyMode: "SHADOW" | "LIVE",
): Effect.Effect<ReadonlyArray<CommunityLeaderboardEntry>, ScoreError> {
  const reader = input.leaderboardReader;
  if (!reader) {
    // Bridgebuilder #8: the leaderboard read is MANDATORY for LIVE. A missing
    // reader silently returning [] would flip SHADOW→LIVE + create roles with
    // ZERO assignments (a destructive no-op that still mutates Discord). FAIL
    // CLOSED. `[]`-on-missing is allowed ONLY for SHADOW preview.
    if (applyMode === "LIVE") {
      return Effect.fail(
        new ScoreError({
          message: `LIVE go_live requires a leaderboardReader — none supplied. Refusing (a LIVE run with no leaderboard would create roles and assign nobody).`,
        }),
      );
    }
    return Effect.succeed([]);
  }
  return Effect.tryPromise({
    try: () => reader(),
    catch: (e) =>
      new ScoreError({
        message: `leaderboard read failed: ${e instanceof Error ? e.message : String(e)}`,
      }),
  });
}

function result(
  applyMode: "SHADOW" | "LIVE",
  batch: WriteIntentBatch,
  job: ApplyBatchResult,
  built: BuiltAssignments,
): GoLiveOrchestrationResult {
  const createCount = batch.ops.filter((o) => o.kind === "create_role").length;
  const assignCount = batch.ops.filter((o) => o.kind === "assign_role").length;
  return {
    applyMode,
    batch,
    job,
    createCount,
    assignCount,
    skippedUnlinked: built.skipped_unlinked,
    skippedUnqualified: built.skipped_unqualified,
    skippedInvalid: built.skipped_invalid,
    collapsedDuplicateMembers: built.collapsed_duplicate_members,
  };
}

/**
 * A synthetic preview `WriteCapability` for the SHADOW path. The gate
 * short-circuits to per-op rejection under SHADOW BEFORE it validates the cap
 * binding, so this value is never inspected — it exists only to satisfy the
 * `applyBatch(batch, cap)` signature. We cannot mint a real cap (the constructor
 * is internal to the substrate's authorized go_live), and SHADOW must NOT mint
 * one anyway (no transition occurs). The cast is sound: the cap is unreachable
 * under SHADOW.
 */
function makePreviewCap(): WriteCapability {
  return {
    report_hash: "0".repeat(64),
    transition_version: -1,
    authz_decision_id: "preview",
  } as unknown as WriteCapability;
}

/** The job shape a SHADOW applyBatch implies: every op rejected, zero writes. */
function shadowRejectedJob(batch: WriteIntentBatch): ApplyBatchResult {
  return {
    status: "failed",
    progress: { total: batch.ops.length, completed: 0, failed: batch.ops.length },
    roles_created: [],
    op_status: batch.ops.map((o) => ({
      op_id: o.op_id,
      status: "failed" as const,
      error: "shadow_rejected: apply_mode is SHADOW — preview only, zero writes",
    })),
  };
}
