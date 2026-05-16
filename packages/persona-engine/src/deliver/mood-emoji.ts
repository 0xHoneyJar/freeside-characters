/**
 * Mood-emoji selection (FR-3 · cycle-005 S4).
 *
 * Registry-mediated per PRD r1 (closes SDD-SKP-003 [710] · hardcoded-
 * emoji vs registry rule). `factor_stats` state maps to mood tags;
 * mood tags route through `pickByMoods(mood, 'ruggy')` against the
 * existing THJ guild registry; the first match (after id-ASC sort for
 * deterministic snapshot stability) is rendered as the Discord token.
 *
 * Priority order (magnitude > cohort > cadence): a factor that qualifies
 * for MULTIPLE rules emits the highest-priority mood — magnitude rare-
 * event wins over cohort breadth, which wins over cadence streak.
 *
 * Env override `MOOD_EMOJI_DISABLED=true` short-circuits to null (operator
 * override for non-THJ guild testing). Registry miss (pickByMoods returns
 * []) also returns null — silent degradation per V1 doctrine.
 */

import {
  pickByMoods,
  renderEmoji,
  type EmojiMood,
} from '../orchestrator/emojis/registry.ts';
import type { FactorStats, PulseDimensionFactor } from '../score/types.ts';

const isMoodEmojiDisabled = (): boolean => process.env.MOOD_EMOJI_DISABLED === 'true';

/**
 * Pick the first matching emoji for a set of mood tags. Returns the
 * rendered `<:name:id>` token, or null on miss / env-disabled.
 *
 * Deterministic: registry returns ALL matches; pick the first after
 * sorting by `id ASC` for snapshot reproducibility. V1.5 may add
 * randomization for visual variety.
 */
function pickMood(moods: readonly EmojiMood[]): string | null {
  if (isMoodEmojiDisabled()) return null;
  const candidates = pickByMoods([...moods], 'ruggy');
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
  return renderEmoji(sorted[0]!);
}

/**
 * Map a factor's `factor_stats` to a mood-emoji Discord token, or null
 * when no rule fires. Priority: magnitude (rank ≥ 95 reliable) > cohort
 * (rank ≥ 90 + ≥5 actors) > cadence (gap rank ≥ 90 + active today).
 *
 * Historic factors (`stats === undefined` OR `history.no_data/error/
 * unknown_factor`) return null — no emoji rendered for the row.
 */
export function moodEmojiForFactor(stats: FactorStats | undefined): string | null {
  if (isMoodEmojiDisabled()) return null;
  if (!stats) return null;
  if (stats.history.no_data || stats.history.error || stats.history.unknown_factor) {
    return null;
  }

  const magRank = stats.magnitude.current_percentile_rank;
  const p95Reliable = stats.magnitude.percentiles.p95?.reliable;
  if (magRank !== null && magRank !== undefined && magRank >= 95 && p95Reliable === true) {
    return pickMood(['flex']);
  }

  const cohortRank = stats.cohort.current_percentile_rank;
  const uniqueActors = stats.cohort.unique_actors;
  if (
    cohortRank !== null &&
    cohortRank !== undefined &&
    cohortRank >= 90 &&
    uniqueActors !== undefined &&
    uniqueActors >= 5
  ) {
    return pickMood(['eyes', 'shocked']);
  }

  const cadenceRank = stats.cadence.current_gap_percentile_rank;
  if (
    cadenceRank !== null &&
    cadenceRank !== undefined &&
    cadenceRank >= 90 &&
    stats.occurrence.current_is_active === true
  ) {
    return pickMood(['noted', 'concerned']);
  }

  return null;
}

/**
 * Cold-factor mood — `previous > 5 && total === 0` triggers a
 * `['cry', 'dazed']` token, signaling a factor that USED to fire
 * but went silent this period.
 */
export function moodEmojiForColdFactor(factor: PulseDimensionFactor): string | null {
  if (isMoodEmojiDisabled()) return null;
  if (factor.previous > 5 && factor.total === 0) {
    return pickMood(['cry', 'dazed']);
  }
  return null;
}
