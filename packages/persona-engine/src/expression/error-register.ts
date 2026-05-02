/**
 * In-character error register (V0.12 · session 04 · kickoff §4.3).
 *
 * Formalizes the CLAUDE.md voice rule:
 *   "in-character errors only — 'cables got crossed' not
 *    'I apologize for the inconvenience'"
 *
 * Pre-V0.12, dispatch.ts had character-agnostic error strings — same body
 * for ruggy and satoshi, only differing by the bold-prefix display name.
 * Per the kickoff §3 expression matrix, ruggy and satoshi MUST have
 * distinct register-locked error templates per error class:
 *
 *   ruggy  → lowercase · slangy · "cables got crossed" register
 *   satoshi → sentence case · gnomic · "the signal is unclear" register
 *
 * Strip-the-name test (Alexander craft): read each template without the
 * **CharacterName** prefix; you should know who said it from voice alone.
 *
 * This module is the substrate-side TEMPLATE BANK. dispatch.ts wraps
 * each template with the bold-prefix attribution that disambiguates
 * shell-bot identity in interaction-PATCH delivery (Pattern B's per-
 * message webhook override is unavailable for interaction PATCHes per
 * Gemini DR 2026-04-30, so the bold-prefix carries that load).
 *
 * Civic-layer: substrate provides the template bank; per-character voice
 * fills it. New characters add a templates row; missing characters fall
 * through to the substrate-quiet generic per the dispatch fallback.
 */

import { Schema } from "effect";

// ─── Error classes the dispatch surfaces today ──────────────────────

const ERROR_CLASSES = [
  "timeout", // composeReply exceeded TOKEN_LIFETIME_MS (14m30s)
  "empty", // composeReply returned null / no result
  "error", // dispatch top-level catch (any unhandled compose throw)
  "image-too-large", // imagegen attachment > 8 MB Discord webhook ceiling
  "image-delivery-failed", // imagegen rendered but webhook delivery threw
] as const;

export type ErrorClass = (typeof ERROR_CLASSES)[number];

const ErrorClassSchema = Schema.Literal(...ERROR_CLASSES);

// ─── Schema ──────────────────────────────────────────────────────────

const ErrorTemplateBodySchema = Schema.String.pipe(
  Schema.minLength(1, {
    message: () => "error-register: template body must be non-empty",
  }),
).annotations({
  description: "single-line in-character template body (no character prefix)",
});

const CharacterErrorTemplatesSchema = Schema.Record({
  key: ErrorClassSchema,
  value: ErrorTemplateBodySchema,
});

const ErrorRegistrySchema = Schema.Record({
  key: Schema.String,
  value: CharacterErrorTemplatesSchema,
});

export type CharacterErrorTemplates = Schema.Schema.Type<
  typeof CharacterErrorTemplatesSchema
>;
export type ErrorRegistry = Schema.Schema.Type<typeof ErrorRegistrySchema>;

// ─── Templates ───────────────────────────────────────────────────────

const TEMPLATES_RAW: Record<string, Record<ErrorClass, string>> = {
  // RUGGY — lowercase, slangy, in-voice. "Cables got crossed" register.
  // Each line should pass the strip-the-name test: read without the bold
  // **Ruggy** prefix; the voice is unmistakably ruggy.
  ruggy: {
    timeout: "took longer than ruggy could hold the line for. wanna try that again?",
    empty: "cables got crossed — nothing came back. try again?",
    error: "something snapped on ruggy's end. cool to retry?",
    "image-too-large":
      "the image came out too thicc for discord. try tightening the prompt?",
    "image-delivery-failed":
      "image rendered but delivery hiccuped. same seed should reproduce — try again?",
  },

  // SATOSHI — sentence case, gnomic, dense. "Signal between worlds" register.
  // Strip-the-name test: even without the **Satoshi** prefix, the cadence
  // (declarative · cyclical · "this window" / "the next") reads satoshi.
  satoshi: {
    timeout: "The signal exceeded the window. Retry on the next.",
    empty: "The signal is unclear this window. Retry on the next.",
    error: "The channel between worlds slipped. Retry on the next.",
    "image-too-large":
      "The image carried more weight than the channel allows. Try again with less.",
    "image-delivery-failed":
      "The image surfaced but failed to cross. Retry — the seed remembers.",
  },
};

/**
 * Decoded + validated default registry. Decoding at module load surfaces
 * any future schema/data drift loud, before the dispatch path touches it.
 *
 * Per F3 (PR #19 bridgebuilder review): the contextual error prefix makes
 * a bot-startup failure name THIS module so operators know which static
 * config tripped — Effect's default message names field shape but not
 * authoring location.
 */
export const DEFAULT_ERROR_REGISTRY: ErrorRegistry = (() => {
  try {
    return Schema.decodeUnknownSync(ErrorRegistrySchema)(TEMPLATES_RAW);
  } catch (err) {
    throw new Error(
      `error-register: invalid TEMPLATES_RAW shape — every character row must be a non-empty record of {[ErrorClass]: non-empty string} — ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
})();

// ─── Hot-path lookup ─────────────────────────────────────────────────

/**
 * Get the in-character error template body for (characterId, errorClass).
 *
 * Returns null when the character has no registered template bank — the
 * dispatcher should fall through to a substrate-quiet generic in that
 * case (today: a minimal "**Name** — something broke. try again?" line
 * preserves the disambiguation prefix without inventing a register).
 *
 * Returns null for unknown error classes too, so the type system covers
 * the static cases and the runtime guard covers the dynamic ones.
 */
export function getErrorTemplate(
  characterId: string,
  errorClass: ErrorClass,
  registry: ErrorRegistry = DEFAULT_ERROR_REGISTRY,
): string | null {
  const templates = registry[characterId];
  if (!templates) return null;
  return templates[errorClass] ?? null;
}

/**
 * Compose the full error-reply string with bold-prefix attribution.
 * Mirrors the existing dispatch.ts shape (`**DisplayName**\n\nbody`) so
 * shell-bot disambiguation continues to work for interaction PATCHes.
 *
 * `displayName` is the character's preferred attribution surface (falls
 * back to character.id at the call site).
 */
export function composeErrorReply(
  characterId: string,
  displayName: string,
  errorClass: ErrorClass,
): string {
  const body =
    getErrorTemplate(characterId, errorClass) ?? "something broke. try again?";
  return `**${displayName}**\n\n${body}`;
}
