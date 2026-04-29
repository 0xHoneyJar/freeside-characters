/**
 * Post-type variants — many shapes, one voice.
 *
 * Per persona/ruggy.md "Post Types — many shapes, one voice":
 *   digest    structured weekly. backbone of cadence.
 *   micro     casual drop-in. 1-3 sentences. random pop-in.
 *   weaver    cross-zone connection. weekly mid-week or trigger.
 *   lore_drop codex-anchored reference. random.
 *   question  open-ended invitation. random.
 *   callout   anomaly alert. trigger-driven.
 *
 * Same OG voice carries across all six. Different shape per type.
 * The arcade move: surprise > schedule. Mix shapes so channels feel alive.
 */

import type { ZoneDigest } from '../score/types.ts';

export type PostType = 'digest' | 'micro' | 'weaver' | 'lore_drop' | 'question' | 'callout';

export const ALL_POST_TYPES: readonly PostType[] = [
  'digest',
  'micro',
  'weaver',
  'lore_drop',
  'question',
  'callout',
] as const;

export interface PostTypeSpec {
  type: PostType;
  /** Use embed (digest, weaver, callout) or plain message content (micro, lore_drop, question)? */
  useEmbed: boolean;
  /** Cadence — when this type fires */
  cadence: 'weekly' | 'random' | 'trigger';
  /** Maximum length the LLM should produce */
  maxLines: number;
  /** Human-readable description (for logging) */
  description: string;
}

export const POST_TYPE_SPECS: Record<PostType, PostTypeSpec> = {
  digest: {
    type: 'digest',
    useEmbed: true,
    cadence: 'weekly',
    maxLines: 10,
    description: 'structured weekly digest (greeting + blockquote stat + prose + notable + closing)',
  },
  micro: {
    type: 'micro',
    useEmbed: false,
    cadence: 'random',
    maxLines: 4,
    description: 'casual drop-in observation — 1-3 sentences, no formal structure',
  },
  weaver: {
    type: 'weaver',
    useEmbed: true,
    cadence: 'weekly',
    maxLines: 6,
    description: 'cross-zone observation — names a connection across 2+ zones',
  },
  lore_drop: {
    type: 'lore_drop',
    useEmbed: false,
    cadence: 'random',
    maxLines: 4,
    description: 'codex-anchored reference connecting activity to mibera lore',
  },
  question: {
    type: 'question',
    useEmbed: false,
    cadence: 'random',
    maxLines: 3,
    description: 'open-ended invitation to the channel — no answer expected',
  },
  callout: {
    type: 'callout',
    useEmbed: true,
    cadence: 'trigger',
    maxLines: 5,
    description: 'anomaly alert — fires when raw_stats exceeds threshold',
  },
};

/**
 * Whether a callout type fits the digest data — only fires if raw_stats
 * actually exceeds anomaly thresholds.
 */
export function calloutFits(digest: ZoneDigest): boolean {
  const stats = digest.raw_stats;
  if (stats.spotlight !== null) return true;
  // Rank-jump >20 places
  if (stats.rank_changes.climbed.some((m) => m.rank_delta >= 20)) return true;
  // Factor multiplier >5×
  if (stats.factor_trends.some((t) => t.multiplier >= 5)) return true;
  return false;
}

/**
 * Whether a pop-in (micro / lore_drop / question) has enough signal to
 * anchor in. Skip pop-ins on truly flat data — don't pop in to say
 * "still nothing." The keeper move requires SOMETHING to observe.
 *
 * Threshold: at least ONE of —
 *   • a factor multiplier ≥ 1.3 (something moved off baseline)
 *   • a wallet climbed in rank
 *   • a spotlight wallet exists
 *   • factor_trends has 2+ entries (variety to comment on)
 */
export function popInFits(digest: ZoneDigest): boolean {
  const stats = digest.raw_stats;
  if (stats.spotlight !== null) return true;
  if (stats.rank_changes.climbed.length > 0) return true;
  if (stats.factor_trends.some((t) => t.multiplier >= 1.3 || t.multiplier <= 0.7)) return true;
  const totalEvents = stats.window_event_count ?? stats.top_event_count ?? stats.total_events ?? 0;
  if (stats.factor_trends.length >= 2 && totalEvents >= 50) return true;
  return false;
}

/**
 * Whether a post type fits the data right now. Used by composer to
 * skip cleanly instead of generating filler.
 *
 *   digest    — always fits (writes "quiet week" honest digest if flat)
 *   weaver    — always fits (uses cross-zone context, can name absence)
 *   callout   — fits only if calloutFits()
 *   micro / lore_drop / question — fits if popInFits()
 */
export function postTypeFitsData(postType: PostType, digest: ZoneDigest): boolean {
  switch (postType) {
    case 'digest':
    case 'weaver':
      return true;
    case 'callout':
      return calloutFits(digest);
    case 'micro':
    case 'lore_drop':
    case 'question':
      return popInFits(digest);
  }
}

/**
 * Pick a random non-digest post type for a pop-in. Excludes digest
 * (which has its own weekly slot) and callout (only when triggered).
 */
export function pickRandomPopInType(digest: ZoneDigest, exclude: PostType[] = []): PostType {
  const base: PostType[] = ['micro', 'weaver', 'lore_drop', 'question'];
  const candidates: PostType[] = base.filter((t) => !exclude.includes(t));

  // Bias slightly: weaver is rarer (needs cross-zone context); lore_drop
  // and question are flavor; micro is the default pop-in.
  const allWeighted: PostType[] = [
    'micro', 'micro', 'micro',         // 3x weight
    'lore_drop',
    'question',
    'weaver',                          // weaver mostly fires from scheduler, not random
  ];
  const weighted: PostType[] = allWeighted.filter((t) => candidates.includes(t));

  // If callout fits the data, surface it occasionally
  if (calloutFits(digest) && Math.random() < 0.4) return 'callout';

  return weighted[Math.floor(Math.random() * weighted.length)] ?? 'micro';
}

export function describePostType(type: PostType): string {
  const spec = POST_TYPE_SPECS[type];
  return `${type} (${spec.cadence} · ${spec.description})`;
}
