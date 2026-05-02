/**
 * Performed-silence register (V0.12 · session 04 · kickoff §4.4).
 *
 * Doctrine source: gumi block 6 walkthrough — *performed silence > literal
 * silence*. When there's nothing of note for the character to communicate,
 * they STAGE the silence rather than going dark. Active presence without
 * content beats absence.
 *
 * Satoshi's canonical pattern lives in `apps/character-satoshi/persona.md`
 * § "Quiet weeks — performed silence". Ruggy's templates were authored
 * 2026-05-02 in `apps/character-ruggy/silence-register.md`. THIS module
 * is the substrate-side template bank that the digest composer consults
 * on flat windows. When the .md doc and this module diverge, the .md is
 * canonical for voice direction; this module is what runs at compose time.
 *
 * Civic-layer ground truth: the substrate DETECTS the flat window (raw
 * stats shape · deterministic predicate); the character supplies the
 * voice that fills it. New characters add a templates row in this module
 * AND mirror the templates in their own `<character>/silence-register.md`.
 *
 * Reference: kickoff-2026-05-01 §4.4 + §9.2 (gumi sync coordination).
 */

import { Schema } from "effect";
import type { RawStats } from "../score/types.ts";
import { getWindowEventCount } from "../score/types.ts";

// ─── Schema ──────────────────────────────────────────────────────────

const TemplateSchema = Schema.String.pipe(
  Schema.minLength(1, {
    message: () => "silence-register: template body must be non-empty",
  }),
);

const SilenceRegistrySchema = Schema.Record({
  key: Schema.String,
  value: Schema.NonEmptyArray(TemplateSchema),
});

export type SilenceRegistry = Schema.Schema.Type<typeof SilenceRegistrySchema>;

// ─── Templates ───────────────────────────────────────────────────────
// Mirrors apps/character-ruggy/silence-register.md (see § "Templates").
// When this list changes, mirror changes in the .md doc in the same PR.

const TEMPLATES_RAW: Record<string, string[]> = {
  ruggy: [
    "yo team — quiet one this window. nothing wild moved. holding pattern.",
    "ngl, the festival is kinda chill rn. not much to peep — ruggy'll check back.",
    "no big moves to report this window. the festival's just breathing. see y'all later.",
    "*ruggy peeks at the lab, shrugs, walks back to the cave.*",
    "*ruggy peeks in, sees nothing wild, peace-signs out.*",
    "stack moves are quiet this window. nothing notable. stay groovy 🐻",
  ],
  // satoshi has explicit performed-silence in his persona.md ("Quiet
  // weeks") that the LLM consumes as part of the compose prompt. We
  // mirror those templates here so the substrate-side bypass path also
  // has a register-locked voice for satoshi when flat-window detection
  // fires (the LLM might still do well, but the substrate-bypass
  // doesn't depend on it).
  satoshi: [
    "there is nothing of note here for me to communicate.",
    "*satoshi observes the room and shakes his head. nothing of note to report.*",
  ],
};

/**
 * Decoded + validated default registry. Module-load decoding surfaces
 * any future schema/data drift loud, before the composer touches it.
 *
 * Per F3 (PR #19 bridgebuilder review): the contextual error prefix names
 * THIS module in the bot-startup failure path. The shape Schema enforces
 * (`Record<characterId, NonEmptyArray<string>>`) means an empty array on
 * a character row will throw at module load — the legible error tells
 * operators "every character row needs ≥1 template."
 */
export const DEFAULT_SILENCE_REGISTRY: SilenceRegistry = (() => {
  try {
    return Schema.decodeUnknownSync(SilenceRegistrySchema)(TEMPLATES_RAW);
  } catch (err) {
    throw new Error(
      `silence-register: invalid TEMPLATES_RAW shape — every character row must have ≥1 non-empty template — ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
})();

// ─── Flat-window detection (deterministic) ──────────────────────────

/** Threshold for "noise floor" total events. Mirrors the existing stub
 *  generator's threshold in agent-gateway.ts:stubDigest (`total < 100`)
 *  so substrate-bypass and stub-generation agree on what flat means. */
export const FLAT_WINDOW_EVENT_THRESHOLD = 100;

/**
 * Predicate: does this raw_stats window qualify as flat?
 *
 * Definition (kickoff §4.4): "no rank changes · no notable events".
 *   - total events in window < 100, AND
 *   - rank_changes.climbed is empty, AND
 *   - no spotlight surfaced
 *
 * Liberal "AND" — even one signal (a single climber, a single spotlight,
 * a high event count) prevents the flat-window classification. Substrate
 * stays out of the composer's way unless ALL three signals are absent.
 *
 * Defensive null-handling on `rank_changes` per F6 (PR #19 bridgebuilder
 * review): the score-mcp schema makes the field required across v1/v2
 * shapes today, but a missing/malformed payload from a future schema
 * version (or a partial fixture) shouldn't crash the compose path —
 * "no rank_changes shape" reads as "no climbers signal" which is the
 * flat-leaning classification.
 */
export function isFlatWindow(rawStats: RawStats): boolean {
  const events = getWindowEventCount(rawStats);
  if (events >= FLAT_WINDOW_EVENT_THRESHOLD) return false;
  if ((rawStats.rank_changes?.climbed?.length ?? 0) > 0) return false;
  if (rawStats.spotlight !== null) return false;
  return true;
}

// ─── Hot-path lookup ─────────────────────────────────────────────────

/**
 * Pick a random silence template for the given character. Returns null
 * when the character has no registered templates — caller (composer)
 * falls through to the LLM path in that case.
 *
 * Variance preservation per ALEXANDER craft principle: 6 ruggy templates
 * across registers (warm-dismissal · stage-direction · vibe-close) means
 * 30+ flat-window fires before a repeat would cluster. Recent-used
 * deduplication is intentionally NOT implemented at this layer — flat
 * windows are minority events; cron cadence + recency makes natural
 * variance sufficient.
 */
export function pickSilenceTemplate(
  characterId: string,
  registry: SilenceRegistry = DEFAULT_SILENCE_REGISTRY,
): string | null {
  const templates = registry[characterId];
  if (!templates) return null;
  return templates[Math.floor(Math.random() * templates.length)] ?? null;
}
