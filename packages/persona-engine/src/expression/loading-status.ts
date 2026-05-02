/**
 * Tool-use loading status composer (V0.12 · session 04).
 *
 * Composes the in-channel patch shown while a chat-mode tool round-trip
 * is in flight. The substrate ROUTES the moment to character expression:
 *
 *   - characters with `emojis` in their mcps[] AND an `emojiAffinity`
 *     (today: ruggy) get an animated emoji picked from their catalog
 *     using the per-tool mood map. Variety is preserved across calls
 *     via random pick within the mood pool + the emojis MCP recent-used
 *     cache.
 *
 *   - characters without `emojis` in their mcps[] (today: satoshi) get
 *     a uniform plain-text register-locked template per kickoff seed §3.
 *     No custom emoji — that's gumi-locked register doctrine.
 *
 *   - tools with empty mood pools (emojis MCP self-reference, imagegen
 *     V1-deferred) and unmapped tools resolve to null. The dispatcher
 *     interprets null as "skip the patch" — substrate-shaped quiet is
 *     preferable to substrate-shaped noise.
 *
 * Reference: kickoff-2026-05-01 §3 expression matrix · §4.2 wiring step.
 * Civic-layer ground truth: substrate ROUTES the moment; character (via
 * emojiAffinity + mcps[] declarations) supplies the catalog this draws
 * from. Per axis-3 the body-part firing IS the expression.
 */

import type { CharacterConfig } from "../types.ts";
import {
  pickByMoods,
  renderEmoji,
  type EmojiKind,
} from "../orchestrator/emojis/registry.ts";
import { getMoodsForTool } from "./tool-mood-map.ts";

/**
 * Per-character plain-text register for tool-use loading states. Used
 * when the character does NOT have `emojis` in their mcps[] allowlist
 * (today: satoshi · gumi-locked "no custom emoji" register).
 *
 * Per kickoff §3:
 *   satoshi → "the ledger advances — one moment." (NO custom emoji ·
 *             locked register · sentence case · gnomic)
 *
 * The map is keyed by character.id. New characters added without a
 * plain-text fallback resolve to null (substrate-shaped quiet — caller
 * skips the patch). This is intentional: a generic plain-text fallback
 * would re-introduce substrate-voice during a character moment.
 */
const PLAIN_TEXT_LOADING_REGISTER: Readonly<Record<string, string>> = {
  satoshi: "the ledger advances — one moment.",
};

/**
 * Compose the loading-state patch string for a single tool-use event.
 * Returns null when the substrate should stay quiet — see module docstring
 * for the three null cases.
 */
export function composeToolUseStatusForCharacter(
  character: CharacterConfig,
  toolName: string,
): string | null {
  const moods = getMoodsForTool(toolName);
  // Unmapped tool — substrate stays quiet rather than emit a generic
  // marker (per civic-layer category-error doctrine).
  if (moods === null) return null;
  // Intentional silence (emojis self-ref, imagegen V1-deferred) —
  // empty mood pool means the substrate should NOT patch.
  if (moods.length === 0) return null;

  const characterMcps = character.mcps ?? [];
  const hasEmojiCatalog = characterMcps.includes("emojis");
  const affinity = character.emojiAffinity?.primary;

  if (hasEmojiCatalog && affinity) {
    // Emoji-affinity path. Implementation deviation from kickoff §3
    // ("pick one mood at random, then look up an emoji"): we union the
    // ENTIRE mood pool and random-pick from the union. Reason: registry
    // moods like `noted` carry zero ruggy-kind emojis (every `noted`
    // emoji is `mibera`-kind). Single-mood-pick would silently null on
    // those moods, dropping a patch the operator wanted visible. Union-
    // pick preserves variance (the union spans 4-7 emojis per category)
    // AND ensures every mapped tool emits a patch when ruggy fires it.
    // Surfaced in NOTES.md per feedback_spec_deviation_pattern.
    const candidates = pickByMoods([...moods], affinity as EmojiKind);
    if (candidates.length === 0) {
      // Catalog has no matching emoji for ANY mood in the pool/kind. Stay
      // quiet — KEEPER discipline: listen for whether this case surfaces
      // in production before adding fallback text. (If it does, file a
      // capability-request to extend the registry mood vocabulary.)
      return null;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
    return renderEmoji(pick);
  }

  // Plain-text register path (no emoji catalog declared on this character).
  const template = PLAIN_TEXT_LOADING_REGISTER[character.id];
  return template ?? null;
}
