/**
 * Voice Grimoire sampler — draws one VoiceCard per fire.
 *
 * Algorithm:
 *   1. Seeded PRNG (xfnv1a + mulberry32) for reproducibility.
 *   2. Per-knob weighted pick · normalized on the fly from operator
 *      weights (or DEFAULT_VOICE_WEIGHTS). Missing keys = 0 weight.
 *   3. Recent-used dodge per channel (optional · in-process cache).
 *      Avoids same (entry, shape) pair firing in the same channel
 *      within the last `dodge_window` fires. Matches emoji-registry
 *      cross-fire variance pattern.
 *   4. Bullet palette: sample k (2/3/4) then sample k distinct emoji
 *      from the canonical 6 without replacement.
 *   5. Witness: caller-supplied function (typically findByMood from
 *      emoji-registry). Module stays pure — no orchestrator coupling.
 *
 * Seeded design lets tests assert exact draws by seed; production
 * caller passes Date.now() + channelId for organic variance.
 */

import {
  type Entry,
  type Shape,
  type Splash,
  type Exit,
  type Density,
  type BulletEmoji,
  type VoiceCard,
  type VoiceWeights,
  ENTRY_VALUES,
  SHAPE_VALUES,
  SPLASH_VALUES,
  EXIT_VALUES,
  DENSITY_VALUES,
  BULLET_EMOJI_POOL,
  DEFAULT_VOICE_WEIGHTS,
} from './grimoire.ts';

// ──────────────────────────────────────────────────────────────────────
// PRNG · xfnv1a hash + mulberry32 (small, fast, deterministic, well-tested)
// ──────────────────────────────────────────────────────────────────────

function xfnv1a(str: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mulberry32(seed: string): () => number {
  const next = xfnv1a(seed);
  return () => next();
}

// ──────────────────────────────────────────────────────────────────────
// Weighted pick — normalized on the fly, missing keys = 0
// ──────────────────────────────────────────────────────────────────────

function weightedPick<T extends string>(
  values: readonly T[],
  weights: Partial<Record<T, number>>,
  rand: () => number,
): T {
  // Build entries · only positive-weight values are candidates.
  const entries: Array<[T, number]> = [];
  let total = 0;
  for (const v of values) {
    const w = weights[v] ?? 0;
    if (w > 0) {
      entries.push([v, w]);
      total += w;
    }
  }
  // Fallback · all weights 0 → uniform pick across all values. Prevents
  // accidental misconfiguration from blowing up the sampler.
  if (total === 0) {
    return values[Math.floor(rand() * values.length)]!;
  }
  const r = rand() * total;
  let acc = 0;
  for (const [v, w] of entries) {
    acc += w;
    if (r <= acc) return v;
  }
  return entries[entries.length - 1]![0];
}

function sampleBulletPalette(
  weights: Partial<Record<2 | 3 | 4, number>>,
  rand: () => number,
): BulletEmoji[] {
  const kWeights = { 2: weights[2] ?? 0, 3: weights[3] ?? 0, 4: weights[4] ?? 0 };
  // weightedPick wants string · cast through.
  const k = parseInt(
    weightedPick(['2', '3', '4'] as const, kWeights as unknown as Partial<Record<'2' | '3' | '4', number>>, rand),
    10,
  ) as 2 | 3 | 4;

  // Sample k distinct emoji without replacement · Fisher-Yates partial shuffle.
  const pool = [...BULLET_EMOJI_POOL];
  const picked: BulletEmoji[] = [];
  for (let i = 0; i < k && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length);
    picked.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return picked;
}

// ──────────────────────────────────────────────────────────────────────
// Recent-used dodge cache · per-channel (entry, shape) pair history
// ──────────────────────────────────────────────────────────────────────

const recentCardsByChannel = new Map<string, Array<{ entry: Entry; shape: Shape }>>();
const DEFAULT_DODGE_WINDOW = 3;

function recordRecent(channelId: string, card: { entry: Entry; shape: Shape }, windowSize: number): void {
  const cur = recentCardsByChannel.get(channelId) ?? [];
  cur.push(card);
  while (cur.length > windowSize) cur.shift();
  recentCardsByChannel.set(channelId, cur);
}

function isRecent(channelId: string, entry: Entry, shape: Shape): boolean {
  const cur = recentCardsByChannel.get(channelId);
  if (!cur) return false;
  return cur.some((c) => c.entry === entry && c.shape === shape);
}

// Exposed for tests · reset cache between scenarios.
export function _resetVoiceCache(): void {
  recentCardsByChannel.clear();
}

// ──────────────────────────────────────────────────────────────────────
// The draw · public API
// ──────────────────────────────────────────────────────────────────────

export interface SampleVoiceCardArgs {
  seed: string;
  weights?: VoiceWeights;
  channelId?: string;
  dodgeWindow?: number;
  /**
   * Caller-supplied witness picker. Receives the sampled card so the
   * picker can compose its choice with the rest of the stance (e.g.
   * pick a "celebratory" emoji when shape=single_punchline + density=
   * fragment, vs a "thoughtful" one when density=flowing). Return null
   * to indicate no custom emoji this fire.
   */
  witnessPicker?: (card: Omit<VoiceCard, 'witness'>) => string | null;
}

export function sampleVoiceCard(args: SampleVoiceCardArgs): VoiceCard {
  const { seed, channelId, dodgeWindow = DEFAULT_DODGE_WINDOW } = args;
  const w = { ...DEFAULT_VOICE_WEIGHTS, ...(args.weights ?? {}) } as Required<VoiceWeights>;
  // Merge nested distributions: operator-supplied partial maps OVERRIDE
  // defaults rather than replace · this lets operators tweak ONE knob.
  for (const k of ['entry', 'shape', 'splash', 'exit', 'density'] as const) {
    w[k] = { ...DEFAULT_VOICE_WEIGHTS[k], ...((args.weights?.[k] as object) ?? {}) } as never;
  }
  w.bullet_palette_k = {
    ...DEFAULT_VOICE_WEIGHTS.bullet_palette_k,
    ...(args.weights?.bullet_palette_k ?? {}),
  };

  const rand = mulberry32(seed);

  // Resample entry/shape pair if it matches a recent draw in this channel ·
  // capped at 4 attempts so we don't loop forever under tight constraints.
  let entry: Entry;
  let shape: Shape;
  let attempt = 0;
  do {
    entry = weightedPick(ENTRY_VALUES, w.entry, rand);
    shape = weightedPick(SHAPE_VALUES, w.shape, rand);
    attempt++;
  } while (channelId && attempt < 4 && isRecent(channelId, entry, shape));

  const splash = weightedPick(SPLASH_VALUES, w.splash, rand);
  const exit = weightedPick(EXIT_VALUES, w.exit, rand);
  const density = weightedPick(DENSITY_VALUES, w.density, rand);
  const bullet_palette = sampleBulletPalette(w.bullet_palette_k, rand);

  const baseCard: Omit<VoiceCard, 'witness'> = {
    entry,
    shape,
    splash,
    exit,
    density,
    bullet_palette,
    seed,
  };
  const witness = args.witnessPicker ? args.witnessPicker(baseCard) : null;

  if (channelId) {
    recordRecent(channelId, { entry, shape }, dodgeWindow);
  }

  return { ...baseCard, witness };
}

// ──────────────────────────────────────────────────────────────────────
// Card → prompt-block renderer
// ──────────────────────────────────────────────────────────────────────

const ENTRY_GUIDE: Record<Entry, string> = {
  casual_yeah: "open with a casual 'yeah {Zone}...' or 'yeah, lab's been...' — mid-thought, low-key.",
  thoughtful_hmm: "open with a soft hesitation — 'hmm', 'huh', 'wait', the sound of someone noticing.",
  pivot: "open with a connector — 'ok so', 'so the lab', 'right, {Zone} —', as if mid-sentence already.",
  declarative: 'open with a short noun-phrase declaration — "{Zone}. {Factor} at four-ex." Period after each noun.',
  ascii_bear: "open with an ASCII bear face (ʕ •ᴥ•ʔ or similar) then a short fragment.",
  silent_start: 'NO opener — go straight to the data. No "yeah" no "hmm" no zone-name. First line IS content.',
  observation: "open with a single declarative observation — 'the lab's loud.' or '{Zone} loud today.'",
};

const SHAPE_GUIDE: Record<Shape, string> = {
  blockquote_first:
    'STRUCTURE: 1) opener · 2) blockquote with 2-3 scanline facts · 3) 1-2 prose sentences · 4) emoji-handle bullets · 5) exit. (the default established shape)',
  prose_first:
    'STRUCTURE: 1) opener · 2) 2-3 sentences of prose carrying the story · 3) blockquote footer with the hero stats · 4) optionally one emoji-handle bullet · 5) exit.',
  bullets_only:
    'STRUCTURE: 1) opener (or skip) · 2) 2-4 emoji-handle bullets, one signal each · 3) exit. NO blockquote, NO prose-stanza. Bullets are the whole post.',
  single_punchline:
    'STRUCTURE: ONE signal · 1-3 short lines max · the strongest observation. NO blockquote, NO bullets, NO scaffolding. Just the punchline.',
  inverted:
    'STRUCTURE: 1) opener (or skip) · 2) emoji-handle bullets FIRST · 3) 1-2 sentences of prose tail at the bottom · 4) exit. Inverted from default.',
  fragment_chain:
    'STRUCTURE: 3-5 short dropping sentences. NO blockquote, NO bullets. Each sentence is a fragment that lands and stops. Build the shape from rhythm, not from scaffold.',
};

const SPLASH_GUIDE: Record<Splash, string> = {
  sparse: '0-1 emoji TOTAL across the whole post. Text carries everything. Most bullets unmarked or text-only.',
  medium: '2-3 emoji TOTAL. One per signal-bullet. Standard density.',
  lush: '4+ emoji. Generous · use the full bullet palette · the visual layer is loud this fire.',
};

const EXIT_GUIDE: Record<Exit, string> = {
  custom_emoji: 'close with a single :ruggy_*: custom emoji from the registry. The witness pick is below.',
  fragment: 'close with a single short fragment · "anyway." / "worth a peek." / "kinda sus." / "yeah." — no period sometimes.',
  silence: 'NO close. End on the last bullet or prose line. The silence IS the close.',
  bear_emoji: 'close with a lone 🐻. Nothing else.',
  observation: 'close with a single-line observation as the read · "someone\'s making moves." / "the lab\'s patient." / "huh."',
};

const DENSITY_GUIDE: Record<Density, string> = {
  fragment: '~30 words. ~3 visible blocks. Single-thought drop. Don\'t pad.',
  terse: '~50 words. ~4 visible blocks. Lean.',
  standard: '~100 words. ~5-6 visible blocks. The flowing default.',
  flowing: '~150 words. ~7-8 visible blocks. Use only when the story genuinely needs the room.',
};

export function renderVoiceCard(card: VoiceCard): string {
  const lines = [
    '═══ VOICE GRIMOIRE · this fire\'s draw ═══',
    '',
    '(per-fire stance · NOT a description of all replies · these knobs',
    'override the persona\'s default DATA-SHAPED template. Follow them.)',
    '',
    `THE ENTRY · ${card.entry}`,
    `  → ${ENTRY_GUIDE[card.entry]}`,
    '',
    `THE SHAPE · ${card.shape}`,
    `  → ${SHAPE_GUIDE[card.shape]}`,
    '',
    `THE SPLASH · ${card.splash}`,
    `  → ${SPLASH_GUIDE[card.splash]}`,
    '',
    `THE DENSITY · ${card.density}`,
    `  → ${DENSITY_GUIDE[card.density]}`,
    '',
    `THE BULLET PALETTE · ${card.bullet_palette.join(' ')}`,
    `  → if you reach for emoji-handle bullets this fire, use ONLY these.`,
    `    DON'T mix in 🪩🌊👀 if they're not in this palette. The persona`,
    `    doc shows the meanings; the palette restricts the SET.`,
    '',
    `THE EXIT · ${card.exit}`,
    `  → ${EXIT_GUIDE[card.exit]}`,
    '',
    card.witness
      ? `THE WITNESS · :${card.witness}: (use only if exit === 'custom_emoji')`
      : `THE WITNESS · none this fire (skip custom emoji if exit === 'custom_emoji' falls back to fragment)`,
    '',
    '═══',
  ];
  return lines.join('\n');
}
