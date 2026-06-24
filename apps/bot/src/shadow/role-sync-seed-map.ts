/**
 * shadow/role-sync-seed-map.ts — the CM-OVERRIDABLE DEFAULT seed role-map for
 * the voiceless tier→role sync trigger (bd-71y).
 *
 * ── WHY A SEED EXISTS ────────────────────────────────────────────────────────
 * The tier→role map is CM-OWNED config: the community manager authors it via the
 * dashboard role-map editor → config-service, and the bot READS it (per the
 * onboarding-as-voiceless-building brief — "CM has full control of the tier→role
 * map"). But the first test of the sync must be runnable BEFORE a CM has authored
 * anything: when config-service is unwired (CONFIG_SERVICE_URL unset) or returns
 * no `role-map` surface, this seed is the fallback so the trigger can produce a
 * SHADOW preview against a sensible Purupuru default.
 *
 * ── THIS IS A DEFAULT, NOT THE TRUTH ─────────────────────────────────────────
 * The CM's authored map ALWAYS wins. This seed is marked clearly as a default in
 * the structural render (`mapSource: "default-seed"`) so a CM never mistakes it
 * for their real map. The moment the CM authors a map in config-service, the read
 * path returns that map and this seed is never used.
 *
 * ── GROUNDING (purupuru-tiers.ts, read 2026-06-03) ───────────────────────────
 * One namespaced role per Purupuru tier on the strength ladder
 * (newcomer < member < devoted < core < elder < sovereign), each rule
 * `qualifies: { source: 'tier', min_tier: <that tier> }` with
 * `create_if_absent: true`. The `min_tier` values are the OPAQUE tier ids the
 * score-api owns (#221); the ordering lives in purupuru-tiers.ts. The
 * `namespace_prefix` "purupuru:" is the FR-9 managed-role boundary.
 *
 * VOICELESS: this module is pure data + a builder. No persona, no voice, no I/O.
 */
import type { RoleMapConfig } from "./substrate.ts";
import { PURUPURU_TIER_RANK } from "./purupuru-tiers.ts";

/** The FR-9 namespace prefix for the Purupuru managed-role set. */
export const PURUPURU_NAMESPACE_PREFIX = "purupuru:";

/**
 * Human-readable display names for each seed tier role. PLACEHOLDERS (the lore
 * names are calibrated elsewhere — see purupuru-tiers.ts header); the CM's
 * authored map supplies the real display names. Title-cased tier id by default.
 */
function seedDisplayName(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Build the CM-overridable DEFAULT seed role-map for Purupuru: ONE namespaced
 * role per tier on the strength ladder, each a `create_if_absent: true` rule
 * qualifying at >= that tier. Deterministic (tier order follows the ladder rank).
 *
 * The returned map satisfies the substrate's `RoleMapConfig` schema exactly
 * (`enabled`, `namespace_prefix`, `rules`); it is a plain object the orchestrator
 * + the FR-7 `roleMapVersionHash` consume directly.
 */
export function buildPurupuruSeedRoleMap(): RoleMapConfig {
  // order tiers by ascending strength rank (deterministic, matches the ladder).
  const tiers = Object.entries(PURUPURU_TIER_RANK)
    .sort((a, b) => a[1] - b[1])
    .map(([tier]) => tier);

  const rules = tiers.map((tier) => ({
    role_key: `${PURUPURU_NAMESPACE_PREFIX}${tier}`,
    display_name: seedDisplayName(tier),
    qualifies: { source: "tier" as const, min_tier: tier },
    create_if_absent: true,
  }));

  return {
    enabled: true,
    namespace_prefix: PURUPURU_NAMESPACE_PREFIX,
    rules,
  } as RoleMapConfig;
}

/**
 * The provenance of the role-map the trigger ran against — surfaced in the
 * structural render so a CM can tell the authored map from the default seed.
 *   • "config-service" — the CM's authored map (read from config-service).
 *   • "default-seed"   — this module's fallback (config-service unwired/empty).
 */
export type RoleMapSource = "config-service" | "default-seed";
