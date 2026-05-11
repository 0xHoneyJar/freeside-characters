/**
 * Canon vocabulary — chain-word → mibera-canon translation table.
 *
 * Bronze chain-words DO NOT enter the narration register. They pass through
 * this table at the `ambient/router.system.ts` boundary so ruggy/satoshi
 * speak in mibera lore vocabulary (D5–D8 per mibera-codex construct).
 *
 * Canon corrections that this table enforces:
 *   - "burn" is NEVER "sacrifice" (canon refuses offering-to-deity framing)
 *   - "transfer" is NEVER "migration" (not in canon)
 *   - elements are 4-element WESTERN (Fire/Water/Earth/Air) NOT wuxing
 *   - archetypes are Freetekno/Milady/Chicago-Detroit/Acidhouse (NOT "Founder")
 *   - field names: `time_period` not `era`, `drug` not `molecule`
 *
 * Source of truth: grimoires/loa/sdd.md §canon-vocabulary
 * Citations: construct-mibera-codex/{glossary.md,core-lore/official-lore.md,
 *           IDENTITY.md,fractures/README.md,_codex/data/42-motif.md}
 */

import type { EventClass } from "./event.ts";

// ─── Translation table ───────────────────────────────────────────────

export interface CanonTranslation {
  /** The blockchain word the score-mibera bronze table emits. */
  chain_word: string;
  /** Canon-approved synonyms, preferred-first. Narration MUST use one of these. */
  canon_words: ReadonlyArray<string>;
  /** Words that violate canon — FAGAN regex catches these. */
  forbidden: ReadonlyArray<string>;
  /** Brief lore note explaining why the canon framing is what it is. */
  lore_note: string;
}

export const CANON_TABLE: Record<EventClass, CanonTranslation> = {
  awakening: {
    chain_word: "mint",
    canon_words: [
      "awakening",
      "emergence",
      "arrival-from-Kaironic-time",
      "arrives",
    ],
    forbidden: [],
    lore_note:
      "official-lore.md:70 — 'Mibera awakens from hibernation.' Mints are temporal arrivals from Kaironic time.",
  },
  cross_wallets: {
    chain_word: "transfer",
    canon_words: ["crossed-wallets", "passed-through", "changed-hands"],
    forbidden: ["migration"],
    lore_note:
      "Lore 1 frames Miberas as 'temporal Messengers'. A transfer is a messenger handed off, NEVER migration.",
  },
  return_to_source: {
    chain_word: "burn",
    canon_words: [
      "return-to-source",
      "refusal",
      "pouring-back",
      "return-to-the-bear-cave",
      "returns",
      "poured back",
    ],
    forbidden: ["sacrifice"],
    lore_note:
      "official-lore.md:234 — 'REFUSAL IS THE RETURN... MIBERA RETURNS.' Latin re-fundere = pour back. NEVER sacrifice.",
  },
  reveal: {
    chain_word: "trait_shift",
    canon_words: ["reveal", "further-initiation", "phase-progression"],
    forbidden: [],
    lore_note:
      "fractures/README.md — 10-phase soulbound reveal cycle. A trait shift is a further reveal.",
  },
  backing: {
    chain_word: "loan",
    canon_words: ["backing", "posted-as-backing", "held-by-council"],
    forbidden: [],
    lore_note:
      "42-motif.md:36 — '4.20% annual interest on backing loans'. The Mibera is collateral; the Council holds her.",
  },
  committed: {
    chain_word: "stake",
    canon_words: [
      "committed-to-the-rave",
      "held-by-treasury",
      "committed",
    ],
    forbidden: [],
    lore_note:
      "official-lore.md:98,133 — staking $BERA / $HONEY for $BGT. Echoes 'Ungovernable Autonomous Rave Treasury'.",
  },
  fracture: {
    chain_word: "badge",
    canon_words: ["Fracture", "proof-of-presence", "soulbound"],
    forbidden: [],
    lore_note:
      "fractures/README.md — A Fracture is a soulbound proof-of-presence. Permanent. Cannot be undone.",
  },
};

// ─── Forbidden regex — the FAGAN gate (S6) ───────────────────────────

/**
 * Aggregate forbidden-word regex used as a CI gate (S6 verification per PRD §6.4).
 *
 * The full regex covers:
 *   - per-class forbidden words from CANON_TABLE
 *   - codex element corrections: NO wuxing (no `wood` or `metal` as elements)
 *   - codex archetype corrections: NO `Founder` (the four are Freetekno /
 *     Milady / Chicago-Detroit / Acidhouse)
 *   - field-name corrections: NO bare `era` or `molecule` (use `time_period`
 *     and `drug` respectively)
 *
 * Matched at narration text-pass; non-zero match fails CI.
 *
 * CI command:
 *   grep -rE "$FORBIDDEN_REGEX_PATTERN" packages/persona-engine/src/ambient \
 *     --include='*.ts'
 */
export const FORBIDDEN_REGEX = new RegExp(
  [
    // Per-class forbidden words
    "sacrifice",
    "migration",
    // Codex element corrections (wuxing leak)
    "wuxing",
    // Codex archetype corrections (no Founder)
    "founder.*archetype",
    // Field-name corrections
    "\\bera\\b",
    "\\bmolecule\\b",
  ].join("|"),
  "i",
);

export const FORBIDDEN_REGEX_PATTERN = FORBIDDEN_REGEX.source;

// ─── Helpers ─────────────────────────────────────────────────────────

/** Validate that a candidate narration string contains zero forbidden words. */
export function hasCanonViolation(text: string): boolean {
  return FORBIDDEN_REGEX.test(text);
}

/** Get the first matched forbidden word, or null if clean. */
export function findCanonViolation(text: string): string | null {
  const match = text.match(FORBIDDEN_REGEX);
  return match ? match[0] : null;
}

/** Pick a canon word for an event class. Choice should ideally come from the
 * narration register (ruggy = preferred-first, satoshi = more terse), but a
 * deterministic fallback is the first canon_word. */
export function pickCanonWord(eventClass: EventClass): string {
  return CANON_TABLE[eventClass].canon_words[0];
}
