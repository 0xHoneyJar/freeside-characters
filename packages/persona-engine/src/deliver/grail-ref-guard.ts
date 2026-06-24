/**
 * Grail-ref guard (V0.7-A.3 · spec §11.2 anti-hallucination validator).
 *
 * Post-process character reply text for grail references and partition into
 * valid (canonical/session) vs invalid (unverified). The composer-side
 * companion to the persona instructions in spec §11.1: persona tells the
 * LLM to cite literal canonical refs; this guard catches the cases where
 * it didn't.
 *
 * Bridgebuilder triage 2026-05-02 (F1, F3, F4):
 *   - F1: only the `@g<digits>` shape is recognized. The bare `#<digits>`
 *     form was overly broad — it caught issue refs (`#123`), markdown
 *     anchors, channel mentions, ordinal lists. The `@g` prefix is the
 *     canonical disambiguator.
 *   - F4: validation is OPERATOR-ONLY telemetry, not user-visible.
 *     The previous footer leaked engineering jargon ("KEEPER", "V1.5",
 *     "corpus signal") into Discord text — broke persona illusion. V1.5
 *     may add an in-voice signal (character says "the codex doesn't
 *     return that") instead of engineering metadata.
 *   - F3: V1 hardcoded 7-id set is conservative; with footer removed in
 *     F4, false positives are observable telemetry signal (helpful) rather
 *     than user-visible noise (harmful). V1.5 will hydrate the canonical
 *     43 from mcp__codex__list_archetypes at startup.
 *
 * V1: telemetry-only — the caller logs invalid refs to the trajectory tail
 *     and emits a structured field on the return value for downstream
 *     consumers (analytics passes mining unverified refs as V1.5 corpus
 *     expansion candidates).
 * V1.5: stripping + character-side reinforcement (per spec §11.2 deferred).
 *
 * Canonical set source: codex MCP `list_archetypes` would be the
 * authoritative source if this codebase had a synchronous read against
 * it; for V1, we embed a curated set of refs that the spec + dogfood
 * captures explicitly named (operator-attested) plus structural counts
 * for the categories. This is honest about its scope: the V1 set is
 * intentionally conservative — refs NOT in this set fall to `invalid`,
 * which is now silent telemetry (post-F4) rather than user-visible.
 *
 * Per spec §11 the canonical 43 are categorized as:
 *   zodiac(12) + element(4) + planet(7) + luminary(2) + primordial(2)
 *   + ancestor(11) + concept(3) + community(1) + special(1) = 43
 *
 * V1.5 ROADMAP: replace CANONICAL_GRAIL_IDS with a startup-time fetch
 * from `mcp__codex__list_archetypes` (or similar) cached for process
 * lifetime. See bonfire/grimoires/bonfire/specs/build-env-aware-image-
 * composition-v07a3.md §11 V1.5 deferred.
 */

export interface GrailRefValidation {
  /** Refs that matched the canonical set OR a sessionRefs override. */
  valid: string[];
  /** Refs that didn't match either source. */
  invalid: string[];
}

/**
 * V1 hardcoded canonical grail ID set.
 *
 * Sources for inclusions:
 *   - 876   Black Hole (concept) — spec §0, §3, §4.4 reference
 *   - 4488  Satoshi-as-Hermes — apps/character-satoshi/codex-anchors.md
 *   - 235   Scorpio (zodiac) — spec §11 transformation regression
 *   - 6458  Fire (element) — spec §11 transformation regression
 *   - 4221  Past (concept) — MEMORY.md SC3 cite
 *   - 1606  Pluto (planet) — MEMORY.md SC2 cite
 *   - 6805  Aquarius (zodiac) — MEMORY.md SC2 cite
 *
 * All other canonical IDs MUST be passed via `sessionRefs` until V1.5
 * adds dynamic resolution. This is intentionally conservative — false
 * positives (canonical-but-unlisted-in-V1) DEGRADE to a warning footer,
 * not a strip; the behavior is observable but non-blocking.
 */
const CANONICAL_GRAIL_IDS = new Set<string>([
  '876',
  '4488',
  '235',
  '6458',
  '4221',
  '1606',
  '6805',
]);

/**
 * Match `@g<digits>` — the only recognized citation form (F1 2026-05-02).
 *
 * The bare `#<digits>` form was previously matched too, but caught false
 * positives across issue refs (`#123`), markdown anchors, channel mentions,
 * and ordinal lists. The `@g` prefix is the canonical disambiguator. The
 * persona instructions in apps/character-{ruggy,satoshi}/persona.md
 * (CODEX GROUNDING section) require the `@g<id>` form — this guard
 * enforces it.
 */
const REF_AT_PATTERN = /@g(\d+)/g;

/**
 * Validate grail references in a character reply text.
 *
 * Refs are accepted as canonical when EITHER:
 *   - they're in the embedded V1 hardcoded set, OR
 *   - they're listed in `sessionRefs` (caller-supplied refs from the
 *     active session's tool results — bypasses the V1 conservative cap).
 *
 * Returns both lists in original-text order, deduplicated by full-ref
 * shape. Only the `@g<digits>` shape is recognized (see REF_AT_PATTERN).
 */
export function validateGrailRefs(
  text: string,
  sessionRefs?: string[],
): GrailRefValidation {
  const sessionSet = new Set<string>(
    (sessionRefs ?? []).map((r) => r.replace(/^[@#]g?/, '')),
  );

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(REF_AT_PATTERN)) {
    const fullRef = match[0]!;
    if (seen.has(fullRef)) continue;
    seen.add(fullRef);
    const id = match[1]!;
    if (CANONICAL_GRAIL_IDS.has(id) || sessionSet.has(id)) {
      valid.push(fullRef);
    } else {
      invalid.push(fullRef);
    }
  }

  return { valid, invalid };
}

/**
 * Inspect the reply text for grail references and return validation +
 * the (unmodified) text. Bridgebuilder F4 2026-05-02: the previous
 * implementation appended a user-visible footer ("[KEEPER: contains
 * unverified ref(s) · captured for V1.5 corpus signal]") which leaked
 * engineering jargon into Discord output and broke the persona illusion.
 *
 * V1 contract:
 *   - Text is returned UNCHANGED. Always.
 *   - Validation is operator-only telemetry: caller logs invalid refs to
 *     the trajectory tail and exposes them via the structured return on
 *     `composeReplyWithEnrichment` (`grailRefValidation.invalid`).
 *
 * V1.5 will optionally strip unverified refs OR add an in-voice signal
 * (the character refusing the reach), per spec §11.2 — neither of which
 * looks like the prior engineering footer.
 *
 * Returns the validation alongside the original text so callers don't
 * need to call `validateGrailRefs` separately.
 */
export function inspectGrailRefs(
  text: string,
  sessionRefs?: string[],
): { text: string; validation: GrailRefValidation } {
  const validation = validateGrailRefs(text, sessionRefs);
  return { text, validation };
}
