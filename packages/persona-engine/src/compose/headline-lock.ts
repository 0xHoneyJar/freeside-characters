/**
 * Headline canonical-emoji lock — substrate-level enforcement that the LLM
 * cannot choose the headline emoji slot.
 *
 * Per operator directive 2026-04-29 (post v7 staging fire · cycle 4 of /smol
 * autonomous review loop): canonical zone emojis are HARD LOCK. The LLM
 * should not choose from a per-character emoji palette in the headline —
 * world elements (zone identity) are not LLM-creative-territory.
 *
 * v7 observed drift: bear-cave digest opened
 *   `yo Bear Cave (OG) <a:ruggy_smoke:1142014302040104991> · ...`
 * instead of canonical
 *   `yo Bear Cave (OG) 🐻 · ...`
 *
 * The character-affinity emoji escaped the body (where it belongs as a closing
 * mood-marker) into the headline (where it doesn't). This module enforces
 * the contract at the seam between LLM output and Discord delivery.
 *
 * V0.7+ daemon-stage answer per codex-rescue D finding: replace this with
 * structured output schema — daemon returns { headlineClass, bullets, body,
 * footer }; substrate renders headline deterministically. Until then, this
 * is the V0.6 minimum-viable hard-lock.
 *
 * Future: when the construct-mibera-codex MCP exists (gumi issue pending),
 * the canonical zone emoji should come from MCP lookup not from local
 * ZONE_FLAVOR — the codex becomes the single source of world-element truth.
 */

import { type ZoneId } from '../score/types.ts';
// cycle-007 S1/T1.3 · ZONE_FLAVOR migration to canonical zone-registry.
import { ZONE_REGISTRY } from '../domain/zone-registry.ts';
import type { PostType } from './post-types.ts';

/**
 * Post types that carry a contracted headline shape (and thus get the lock).
 * micro / lore_drop / question are lighter-weight pop-ins without a fixed
 * headline. weaver / callout share digest's headline contract per persona.md.
 */
const HEADLINE_POST_TYPES: ReadonlySet<PostType> = new Set(['digest', 'weaver', 'callout']);

/**
 * Match Discord custom emoji refs: `<:name:id>` (static) or `<a:name:id>`
 * (animated). The LLM tends to pull these from the bot's available-emoji
 * list (per-character affinity), which is welcome in body prose but a
 * drift signal when it lands in the headline emoji slot.
 */
const CUSTOM_EMOJI_REGEX = /<a?:[A-Za-z0-9_]+:\d+>/;

export interface EnforceResult {
  voice: string;
  /** True if substrate rewrote the headline; false if LLM output already canonical. */
  enforced: boolean;
  /** The replaced span, when enforced; for logging/observability. */
  replaced?: string;
}

/**
 * Replace a non-canonical headline emoji with the zone's canonical emoji.
 * Currently handles the observed drift case: a Discord custom-emoji ref in
 * the first line (the headline). Unicode-emoji swaps are NOT yet handled —
 * those haven't been observed in production · enforcement narrows when no
 * data warrants the wider regex.
 */
export function enforceCanonicalHeadline(
  voice: string,
  zone: ZoneId,
  postType: PostType,
): EnforceResult {
  if (!HEADLINE_POST_TYPES.has(postType)) {
    return { voice, enforced: false };
  }

  const lines = voice.split('\n');
  const firstLine = lines[0] ?? '';
  const canonical = ZONE_REGISTRY[zone].emoji;

  // Already canonical → no enforcement needed.
  if (firstLine.includes(canonical)) {
    return { voice, enforced: false };
  }

  // Drift case: custom-emoji ref in the headline slot. Replace with canonical.
  const customMatch = firstLine.match(CUSTOM_EMOJI_REGEX);
  if (customMatch) {
    const replaced = customMatch[0];
    lines[0] = firstLine.replace(CUSTOM_EMOJI_REGEX, canonical);
    return { voice: lines.join('\n'), enforced: true, replaced };
  }

  // Other drift shapes (unicode emoji swap, no emoji at all) not currently
  // enforced. If observed, extend this module.
  return { voice, enforced: false };
}
