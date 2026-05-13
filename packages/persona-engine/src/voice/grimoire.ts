/**
 * Voice Grimoire — schema for per-fire chat-reply variance.
 *
 * The problem this module solves (2026-05-12 operator dogfood):
 *   Two consecutive `/ruggy` data-shaped replies in the same channel,
 *   same exact shape: blockquote → prose → 🪩/🟢/👀 bullets → close.
 *   The persona prose I just shipped is over-determined — it prescribes
 *   ONE shape and the LLM faithfully reproduces it every fire.
 *
 * The architectural answer (operator's gradient-descent cue):
 *   Persona prose should encode INVARIANTS (voice, vocabulary, taste)
 *   and READ FROM PARAMETERS for shape (entry, structure, density,
 *   emoji palette, close). The parameters live in a schema — a
 *   "voice grimoire" — and the substrate samples one card per fire.
 *
 * Why "grimoire" not "config":
 *   - It's not just RNG. Each fire DRAWS A CARD with a stance.
 *   - The cards have names (the entry · the shape · the splash · the
 *     exit · the density · the witness) that match ruggy's festival
 *     register. Operator tunes weights via YAML; the cards themselves
 *     carry the texture.
 *   - Composes with the cabal-gygax + emoji-registry + rosenzu-kansei
 *     patterns the substrate already uses for variance.
 *
 * The parameter space:
 *   Entry × Shape × Splash × Exit × Density × Witness × BulletPalette
 *   ≈ 7 × 6 × 3 × 5 × 4 × 17 × C(6,3) ≈ 2.4M distinct cards. Plus
 *   per-channel recent-used dodge → effectively never repeats within
 *   a session.
 */

import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────
// Knob enumerations
// ──────────────────────────────────────────────────────────────────────

/** THE ENTRY — how ruggy opens. NEVER the digest "yo Zone team" greeting. */
export const ENTRY_VALUES = [
  'casual_yeah', // "yeah Owsley Lab's humming."
  'thoughtful_hmm', // "hmm, lab's been weird today."
  'pivot', // "ok so the lab —"
  'declarative', // "Owsley Lab. four-ex Paddle Borrower."
  'ascii_bear', // "ʕ •ᴥ•ʔ lab took some shifts"
  'silent_start', // straight into the data, no opener
  'observation', // "the lab's loud."
] as const;
export type Entry = (typeof ENTRY_VALUES)[number];

/** THE SHAPE — structural skeleton ruggy reaches for this fire. */
export const SHAPE_VALUES = [
  'blockquote_first', // > scanline · prose · emoji-bullets · close
  'prose_first', // story prose · > footer-stats · maybe one bullet
  'bullets_only', // just 2-4 emoji-bullets, no scaffold prose
  'single_punchline', // 1-3 lines, ONE signal, terse
  'inverted', // bullets first, prose tail at bottom
  'fragment_chain', // short dropping sentences, no formal scaffold
] as const;
export type Shape = (typeof SHAPE_VALUES)[number];

/** THE SPLASH — emoji density across the whole post. */
export const SPLASH_VALUES = [
  'sparse', // 0-1 emoji total · text carries
  'medium', // 2-3 emoji · one per signal-bullet
  'lush', // 4+ emoji · generous · usually for spike weeks
] as const;
export type Splash = (typeof SPLASH_VALUES)[number];

/** THE EXIT — how ruggy lands the post. */
export const EXIT_VALUES = [
  'custom_emoji', // single :ruggy_*: from registry
  'fragment', // "anyway." / "worth a peek." / "yeah."
  'silence', // no close, end on last bullet
  'bear_emoji', // 🐻
  'observation', // single-line read · "someone's making moves"
] as const;
export type Exit = (typeof EXIT_VALUES)[number];

/** THE DENSITY — length target. Bias toward terse; "flowing" is rare. */
export const DENSITY_VALUES = [
  'fragment', // ~30 words · single-thought drop
  'terse', // ~50 words · 3-4 visible blocks
  'standard', // ~100 words · 5-6 visible blocks
  'flowing', // ~150 words · 7-8 visible blocks · rare
] as const;
export type Density = (typeof DENSITY_VALUES)[number];

/** Full canonical bullet-emoji set. Card samples 2-4 of these per fire. */
export const BULLET_EMOJI_POOL = ['🚨', '🪩', '🟢', '🌊', '👀', '🌫'] as const;
export type BulletEmoji = (typeof BULLET_EMOJI_POOL)[number];

// ──────────────────────────────────────────────────────────────────────
// The Card · the per-fire draw
// ──────────────────────────────────────────────────────────────────────

/** A single fire's voice stance. The persona reads this and shapes accordingly. */
export interface VoiceCard {
  /** THE ENTRY · how to open. */
  entry: Entry;
  /** THE SHAPE · structural skeleton. */
  shape: Shape;
  /** THE SPLASH · emoji density. */
  splash: Splash;
  /** THE EXIT · how to close. */
  exit: Exit;
  /** THE DENSITY · length target. */
  density: Density;
  /** THE BULLET PALETTE · 2-4 bullet-emoji ruggy reaches for THIS fire. */
  bullet_palette: BulletEmoji[];
  /**
   * THE WITNESS · the custom-emoji slot. Name from emoji-registry by
   * mood, or null = no custom emoji this fire. Persona uses this when
   * exit === 'custom_emoji' (otherwise informational).
   */
  witness: string | null;
  /** Stochastic seed used · enables reproducible replay in tests. */
  seed: string;
}

// ──────────────────────────────────────────────────────────────────────
// Weight distributions (operator-tunable)
// ──────────────────────────────────────────────────────────────────────

/**
 * Weight map per knob · operator tunes via .loa.config.yaml. Defaults
 * lean toward terse + medium-splash + casual_yeah — the most ruggy-
 * native stance. Distributions are NOT normalized at load · the
 * sampler normalizes on the fly so partial maps work too (missing
 * keys = 0 weight).
 */
export interface VoiceWeights {
  entry?: Partial<Record<Entry, number>>;
  shape?: Partial<Record<Shape, number>>;
  splash?: Partial<Record<Splash, number>>;
  exit?: Partial<Record<Exit, number>>;
  density?: Partial<Record<Density, number>>;
  /** Bullet palette samples k from the canonical 6 · k drawn from {2,3,4}. */
  bullet_palette_k?: { 2?: number; 3?: number; 4?: number };
}

export const DEFAULT_VOICE_WEIGHTS: Required<VoiceWeights> = {
  entry: {
    casual_yeah: 0.22,
    thoughtful_hmm: 0.15,
    pivot: 0.15,
    declarative: 0.1,
    ascii_bear: 0.05,
    silent_start: 0.15,
    observation: 0.18,
  },
  shape: {
    blockquote_first: 0.3,
    prose_first: 0.15,
    bullets_only: 0.1,
    single_punchline: 0.15,
    inverted: 0.15,
    fragment_chain: 0.15,
  },
  splash: {
    sparse: 0.25,
    medium: 0.5,
    lush: 0.25,
  },
  exit: {
    custom_emoji: 0.3,
    fragment: 0.25,
    silence: 0.2,
    bear_emoji: 0.1,
    observation: 0.15,
  },
  density: {
    fragment: 0.15,
    terse: 0.35,
    standard: 0.35,
    flowing: 0.15,
  },
  bullet_palette_k: { 2: 0.35, 3: 0.5, 4: 0.15 },
};

// ──────────────────────────────────────────────────────────────────────
// Zod schema · runtime validation for config-loaded weights
// ──────────────────────────────────────────────────────────────────────

const fractionRecord = <T extends string>(values: readonly T[]) =>
  z
    .record(z.enum(values as unknown as [T, ...T[]]), z.number().min(0).max(1))
    .optional();

export const VoiceWeightsSchema = z
  .object({
    entry: fractionRecord(ENTRY_VALUES),
    shape: fractionRecord(SHAPE_VALUES),
    splash: fractionRecord(SPLASH_VALUES),
    exit: fractionRecord(EXIT_VALUES),
    density: fractionRecord(DENSITY_VALUES),
    bullet_palette_k: z
      .object({
        2: z.number().min(0).max(1).optional(),
        3: z.number().min(0).max(1).optional(),
        4: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .optional();

export type VoiceWeightsInput = z.infer<typeof VoiceWeightsSchema>;
