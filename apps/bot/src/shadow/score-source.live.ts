/**
 * shadow/score-source.live.ts — the LIVE `ScoreSource` Layer (bd-tfl).
 *
 * Closes the structural hole the brief named: `composition-root.ts` wired
 * `makeRosterSourceLive / RoleWriterLive / AcvpEmitterLive / AdminAllowlistLive`
 * but supplied NO `ScoreSource` Layer — so the substrate's
 * `ScoreSource.latentQualified` port was unimplemented and `loadLatentCounts`
 * had nothing to call. This is that Layer.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * `latentQualified(world, rule)` reads the Purupuru community leaderboard
 * (score-api REST, via `CommunityScoreClient`) and counts wallets whose `tier`
 * satisfies the rule's tier qualification (`rule.qualifies.min_tier`, evaluated
 * with the grounded Purupuru tier ladder in `purupuru-tiers.ts`). That count is
 * the per-rule "qualified members" number the substrate's `loadLatentCounts`
 * folds into the `Discrepancy.latent_qualified` projection.
 *
 * ── "latent" (qualified-but-not-joined) vs "qualified" — HONEST NUANCE ────────
 * The port name is `latentQualified` (SDD: "qualified-but-not-joined wallets").
 * This LIVE adapter returns the QUALIFIED count (wallets at/above the rule's
 * min_tier), NOT qualified-MINUS-joined. Computing the true latent (excluding
 * already-joined members) requires joining score-api tiers ⋈ identity-api
 * wallet↔discord ⋈ the live guild roster — which is exactly the per-member
 * assign-batch path (part 2 of bd-tfl, score-tier-assignment.ts). The substrate
 * MOCK has the same simple-count semantics; we match it here rather than
 * silently changing the projection's meaning. The fuller "minus joined" number
 * is a follow-up once the part-2 join is wired into a count surface.
 *
 * ── PROVENANCE GAP (substrate, NOT fakeable here) ────────────────────────────
 * Even when this LIVE adapter produces the count, the substrate's
 * `effectful/loaders.ts` HARDCODES `source: 'MOCK'` on every `LatentQualified`
 * (read at SHA 26d11b7). So a LIVE count surfaces as `source:'MOCK'` in the
 * Discrepancy until a freeside-worlds substrate change threads honest LIVE
 * provenance through `loadLatentCounts`. We DO NOT fake `source:'LIVE'` (the
 * substrate is SACRED / SHA-pinned). Tracked as a new bead — see the build
 * report. This adapter is honest about the count; the provenance label is the
 * substrate's to fix.
 *
 * ── FAIL-CLOSED ──────────────────────────────────────────────────────────────
 * Any REST failure (403 out-of-scope key, 4xx unresolved, 5xx upstream, decode,
 * transport) maps to a typed `ScoreError`. We NEVER return a silent 0 on error
 * (a 0 would understate the discrepancy and could be mistaken for "nobody
 * qualifies"). Mirrors the score-api community-resolver's own fail-closed posture.
 */
import { Effect, Layer } from "effect";
import { ScoreSource, ScoreError } from "./substrate.ts";
import type { RoleRule } from "@freeside-worlds/shadow-substrate";
import {
  CommunityScoreClient,
  CommunityScoreError,
} from "@freeside-characters/persona-engine/score/community-client";
import { tierQualifies, type TierRankResolver, purupuruTierRank } from "./purupuru-tiers.ts";

/**
 * Per-world wiring the LIVE ScoreSource needs: a factory that returns a
 * `CommunityScoreClient` for the world (or undefined if this world has no LIVE
 * score wiring — then we fail-closed with a ScoreError rather than guess).
 */
export interface LiveScoreConfig {
  /** map a world slug → its community-scoped score client (undefined ⇒ no wiring). */
  readonly clientFor: (world: string) => CommunityScoreClient | undefined;
  /** tier ordering (defaults to the grounded Purupuru ladder). */
  readonly tierRank?: TierRankResolver;
  /**
   * leaderboard memo TTL in ms (Bridgebuilder #9). The substrate's
   * `loadLatentCounts` calls `latentQualified(world, rule)` ONCE PER RULE — a
   * naive adapter fetches the full leaderboard N times for N rules. We memoize
   * the per-world leaderboard for this short window so N rules = 1 fetch (mirrors
   * the prior cycle's read-roster-once-per-batch fix). Default 5s — long enough
   * to span the per-rule loop, short enough that a fresh discrepancy build re-reads.
   * Set 0/negative to disable the memo (always fetch fresh).
   */
  readonly leaderboardMemoTtlMs?: number;
  /** injectable clock (tests). */
  readonly now?: () => number;
}

/** Default leaderboard memo window (ms) — spans the per-rule `loadLatentCounts` loop. */
const DEFAULT_LEADERBOARD_MEMO_TTL_MS = 5_000;

/** Map a CommunityScoreError (or any throw) to the substrate's typed ScoreError. */
function toScoreError(e: unknown, ctx: string): ScoreError {
  if (e instanceof CommunityScoreError) {
    return new ScoreError({ message: `${ctx}: [${e.kind}] ${e.message}` });
  }
  return new ScoreError({
    message: `${ctx}: ${e instanceof Error ? e.message : String(e)}`,
  });
}

/**
 * Build the LIVE `ScoreSource` Layer. The composition root supplies `clientFor`
 * (resolved from the world manifest + the SCORE_PURUPURU_API_KEY env).
 */
export function makeScoreSourceLive(cfg: LiveScoreConfig): Layer.Layer<ScoreSource> {
  const rank = cfg.tierRank ?? purupuruTierRank;
  const memoTtl = cfg.leaderboardMemoTtlMs ?? DEFAULT_LEADERBOARD_MEMO_TTL_MS;
  const now = cfg.now ?? (() => Date.now());

  // Per-world leaderboard memo (Bridgebuilder #9): MEMOIZE the in-flight fetch +
  // its result for a short TTL so N tier rules = 1 fetch, not N. We memo the
  // PROMISE (not just the resolved value) so concurrent per-rule calls within one
  // tick coalesce onto a single round-trip. An error rejects the shared promise
  // and is NOT memoized (the entry is cleared so a later call retries).
  interface MemoEntry {
    readonly promise: Promise<Awaited<ReturnType<CommunityScoreClient["leaderboard"]>>>;
    readonly expires_at: number;
  }
  const memo = new Map<string, MemoEntry>();

  const leaderboardFor = (
    world: string,
    client: CommunityScoreClient,
  ): Promise<Awaited<ReturnType<CommunityScoreClient["leaderboard"]>>> => {
    if (memoTtl > 0) {
      const hit = memo.get(world);
      if (hit && hit.expires_at > now()) return hit.promise;
    }
    const promise = client.leaderboard().catch((e) => {
      // do not memoize a failure — clear so the next call retries.
      memo.delete(world);
      throw e;
    });
    if (memoTtl > 0) memo.set(world, { promise, expires_at: now() + memoTtl });
    return promise;
  };

  return Layer.succeed(
    ScoreSource,
    ScoreSource.of({
      latentQualified: (world, rule: RoleRule) =>
        Effect.tryPromise({
          try: async (): Promise<number> => {
            const w = world as unknown as string;
            const client = cfg.clientFor(w);
            if (!client) {
              // fail-closed: no LIVE score wiring for this world. Never silently 0.
              throw new CommunityScoreError(
                "bad_request",
                `no community score client wired for world '${w}' (SCORE_PURUPURU_API_KEY unset or world unmapped)`,
              );
            }
            // #13: a NON-tier rule never participates in the tier→count — skip it
            // explicitly (observably 0), don't rely on min_tier coincidence.
            if (rule.qualifies.source !== "tier") return 0;
            const page = await leaderboardFor(w, client); // MEMOIZED (#9)
            const minTier = rule.qualifies.min_tier;
            let count = 0;
            for (const entry of page.wallets) {
              if (tierQualifies(entry.tier, minTier, rank)) count += 1;
            }
            return count;
          },
          catch: (e) => toScoreError(e, `latentQualified(${rule.role_key})`),
        }),
    }),
  );
}
