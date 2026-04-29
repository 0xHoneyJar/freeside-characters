/**
 * Custom emoji registry — The Honey Jar Discord guild.
 *
 * Names + animated flags fetched 2026-04-29 from
 * `GET /api/v10/guilds/1135545260538339420/emojis` (THJ guild).
 * Bot is in 2 guilds: The Honey Jar + project purupuru. All 43 IDs
 * the operator gave are in THJ; bot can render every one.
 *
 * Operator dropped 2 batches: 26 mibera + 17 ruggy. The "mibera batch"
 * is mibera-themed reaction stickers. The "ruggy batch" is ruggy-bear
 * reactions, mostly animated.
 *
 * Discord render syntax:
 *   - static: `<:name:id>`
 *   - animated: `<a:name:id>`
 * Wrong prefix breaks rendering. The `renderEmoji` helper picks the
 * correct prefix from the `animated` field.
 *
 * Mood tags are aids for `pick_by_mood`; the LLM can also search by
 * name (use real meme/expression handles directly).
 */

export type EmojiKind = 'mibera' | 'ruggy';

export type EmojiMood =
  | 'cute'
  | 'shocked'
  | 'love'
  | 'celebrate'
  | 'snark'
  | 'cry'
  | 'confused'
  | 'angry'
  | 'cool'
  | 'dazed'
  | 'shy'
  | 'wave'
  | 'peace'
  | 'hands-up'
  | 'flex'
  | 'mining'
  | 'dapper'
  | 'honey'
  | 'psychedelic'
  | 'concerned'
  | 'shrug'
  | 'pls'
  | 'nope'
  | 'eyes'
  | 'noted'
  | 'rave'
  | 'meme';

export interface EmojiEntry {
  id: string;
  kind: EmojiKind;
  /** ACTUAL Discord emoji name (matches server canon). */
  name: string;
  /**
   * Mood tags — many-to-many. Each emoji is taggable with multiple
   * moods so common register requests (e.g. `eyes`, `cute`, `flex`)
   * have wide candidate pools and the LLM can vary picks naturally.
   * The first entry is the PRIMARY mood; secondary moods help the
   * pick_by_mood tool surface this emoji for adjacent registers.
   */
  moods: EmojiMood[];
  /** What the emoji looks like (visual notes from CDN PNG inspection). */
  visual: string;
  /** When to use it — context cue for LLM picking. */
  use_when: string;
  /** True if animated GIF — requires `<a:name:id>` syntax (not `<:name:id>`). */
  animated: boolean;
}

export const EMOJIS: EmojiEntry[] = [
  // ─── mibera (26) — all static ─────────────────────────────────────
  {
    id: '1450229316255355010',
    kind: 'mibera',
    name: 'KIII',
    moods: ['cute', 'shy'],
    visual: 'bear-hooded mibera peeking, soft kawaii eyes',
    use_when: 'soft kawaii moment, "KIII!", warm acknowledgement',
    animated: false,
  },
  {
    id: '1448669925076893776',
    kind: 'mibera',
    name: 'aarrrr',
    moods: ['shocked', 'dazed'],
    visual: 'blue-haired mibera, big surprised wide eyes',
    use_when: 'shocked reaction, "aarrrr", whoa moment',
    animated: false,
  },
  {
    id: '1448667662958858422',
    kind: 'mibera',
    name: 'ackshually',
    moods: ['snark', 'eyes', 'cool'],
    visual: 'fedora-hatted mibera with peace fingers',
    use_when: 'um-actually moment, light correction, "ackshually..."',
    animated: false,
  },
  {
    id: '1448669964692230226',
    kind: 'mibera',
    name: 'bleh',
    moods: ['cute', 'snark'],
    visual: 'dark-skinned mibera with sparkly anime eyes',
    use_when: 'tongue-out playful, "bleh", cheeky',
    animated: false,
  },
  {
    id: '1448670055947567136',
    kind: 'mibera',
    name: 'bm',
    moods: ['cute', 'peace', 'wave'],
    visual: 'mibera in cap "I could be shittin\'"',
    use_when: 'bera morning, casual gm, daily greeting',
    animated: false,
  },
  {
    id: '1450228983638655062',
    kind: 'mibera',
    name: 'cryingniqab1_1toogmiladystickerp',
    moods: ['cry', 'shocked'],
    visual: 'mibera with face-mask covering, eyes only — crying milady sticker',
    use_when: 'mock-crying, "im crying", milady-coded reaction',
    animated: false,
  },
  {
    id: '1448670251519574138',
    kind: 'mibera',
    name: 'glowy',
    moods: ['cool', 'eyes', 'celebrate'],
    visual: 'dark-skinned mibera with green oversized glasses',
    use_when: 'glow-up moment, looking sharp, "glowy"',
    animated: false,
  },
  {
    id: '1448669989208068116',
    kind: 'mibera',
    name: 'hehe',
    moods: ['cute', 'snark', 'love'],
    visual: 'blue-haired mibera looking up, big eyes',
    use_when: 'playful giggle, "hehe", soft mischief',
    animated: false,
  },
  {
    id: '1450228846602358836',
    kind: 'mibera',
    name: 'inlove',
    moods: ['love', 'celebrate'],
    visual: 'pink-haired mibera with heart eyes',
    use_when: 'genuine love, fren respect, "inlove"',
    animated: false,
  },
  {
    id: '1450228890390761492',
    kind: 'mibera',
    name: 'mcdevil',
    moods: ['snark', 'angry'],
    visual: 'mibera in red McDonald\'s-style cap, devilish',
    use_when: 'playful menace, jokey villainy, "mcdevil"',
    animated: false,
  },
  {
    id: '1450228956560097320',
    kind: 'mibera',
    name: 'nani_',
    moods: ['shocked', 'eyes', 'confused'],
    visual: 'mibera with dark intense eyes',
    use_when: 'nani?! disbelief, "what just happened"',
    animated: false,
  },
  {
    id: '1448670207936696431',
    kind: 'mibera',
    name: 'noted',
    moods: ['noted', 'eyes'],
    visual: 'green-haired mibera writing/scribbling',
    use_when: 'noted, recording, "ruggy logged that"',
    animated: false,
  },
  {
    id: '1448670128110571601',
    kind: 'mibera',
    name: 'peek',
    moods: ['cute', 'eyes', 'shy'],
    visual: 'brown bear-hooded mibera peeking',
    use_when: 'peeking in, "peep", cautious approach',
    animated: false,
  },
  {
    id: '1448670014076092562',
    kind: 'mibera',
    name: 'pls',
    moods: ['pls', 'shy', 'love'],
    visual: 'blue-haired mibera with "PLS" text',
    use_when: 'begging, "pls show up", playful ask',
    animated: false,
  },
  {
    id: '1448670356167463075',
    kind: 'mibera',
    name: 'pokubera',
    moods: ['shocked', 'concerned'],
    visual: 'blue-bandana mibera, hands at face',
    use_when: 'pokubera reaction, mild shock, fren moment',
    animated: false,
  },
  {
    id: '1450229012923416616',
    kind: 'mibera',
    name: 'proud',
    moods: ['flex', 'celebrate', 'snark'],
    visual: 'mibera with text "you fuckin a punk", chest-out',
    use_when: 'proud moment, big move from a fren, "respect"',
    animated: false,
  },
  {
    id: '1450228781636915344',
    kind: 'mibera',
    name: 'qq',
    moods: ['cry', 'concerned'],
    visual: 'teal-haired mibera with tearful eyes',
    use_when: 'genuine sad, "qq", a fren slipping',
    animated: false,
  },
  {
    id: '1450228913996431382',
    kind: 'mibera',
    name: 'slapped',
    moods: ['shocked', 'angry'],
    visual: 'mibera with red palm/hand mark',
    use_when: 'slapped reaction, blindsided, "got slapped"',
    animated: false,
  },
  {
    id: '1448670378808311971',
    kind: 'mibera',
    name: 'spiraling',
    moods: ['dazed', 'psychedelic', 'confused'],
    visual: 'grey-toned mibera with spiral eyes',
    use_when: 'spiraling, overwhelmed, lost in the swirl',
    animated: false,
  },
  {
    id: '1450228868232515655',
    kind: 'mibera',
    name: 'sweaty',
    moods: ['concerned', 'shocked', 'shy'],
    visual: 'blonde wide-eyed mibera, nervous',
    use_when: 'sweaty palms, nervous reaction, "yikes"',
    animated: false,
  },
  {
    id: '1450228934796116029',
    kind: 'mibera',
    name: 'takeyourmeds',
    moods: ['snark', 'meme', 'angry'],
    visual: 'green-haired mibera with red sign',
    use_when: 'absurd take callout, "take your meds", kindly mocking',
    animated: false,
  },
  {
    id: '1448670327533207692',
    kind: 'mibera',
    name: 'talktothehands',
    moods: ['nope', 'snark', 'angry'],
    visual: 'bear-hat mibera, hands-up gesture',
    use_when: 'not engaging, "talk to the hand", dismissive',
    animated: false,
  },
  {
    id: '1450228703660609708',
    kind: 'mibera',
    name: 'tedeyes',
    moods: ['cute', 'love', 'peace'],
    visual: 'bear-hooded mibera, classic peek pose',
    use_when: 'teddy-eyes, soft warmth, classic mibera energy',
    animated: false,
  },
  {
    id: '1448670279978188901',
    kind: 'mibera',
    name: 'understood',
    moods: ['confused', 'snark'],
    visual: 'white panda mibera with red question mark',
    use_when: '"understood" (sarcastic), confused acknowledgement',
    animated: false,
  },
  {
    id: '1448670300404318350',
    kind: 'mibera',
    name: 'uwueyes',
    moods: ['love', 'cute', 'shy'],
    visual: 'mibera in blue rug-pattern, soft uwu eyes',
    use_when: 'uwu moment, soft delight, "cute"',
    animated: false,
  },
  {
    id: '1448670229839482921',
    kind: 'mibera',
    name: 'wtf',
    moods: ['shocked', 'confused', 'concerned'],
    visual: 'blonde concerned mibera',
    use_when: 'wtf reaction, what-the genuine surprise',
    animated: false,
  },

  // ─── ruggy (17) — 12 of 17 are ANIMATED ───────────────────────────
  {
    id: '1138775429482819645',
    kind: 'ruggy',
    name: 'ruggy',
    moods: ['cute', 'eyes', 'peace'],
    visual: 'ruggy face, neutral squinting bear',
    use_when: 'default ruggy presence, base bear energy',
    animated: false,
  },
  {
    id: '1142034838124253185',
    kind: 'ruggy',
    name: 'ruggy_aaa',
    moods: ['shocked', 'angry', 'dazed'],
    visual: 'ruggy with yellow accent, aaaa scream',
    use_when: 'screaming reaction, "aaa", overwhelmed',
    animated: true,
  },
  {
    id: '1141258308737585162',
    kind: 'ruggy',
    name: 'ruggy_cheers',
    moods: ['celebrate', 'dapper'],
    visual: 'ruggy in suit holding champagne',
    use_when: 'cheers / toast, big-week wins, celebration',
    animated: false,
  },
  {
    id: '1142035114008772608',
    kind: 'ruggy',
    name: 'ruggy_dab',
    moods: ['celebrate', 'flex', 'meme'],
    visual: 'ruggy in yellow shirt, dab pose',
    use_when: 'dab, victory move, "we ate", playful win',
    animated: true,
  },
  {
    id: '1143652000110747720',
    kind: 'ruggy',
    name: 'ruggy_flex',
    moods: ['flex', 'celebrate', 'hands-up'],
    visual: 'ruggy raising arms — flex pose',
    use_when: 'big stack flex, strong move, "flexing"',
    animated: false,
  },
  {
    id: '1142014493476532234',
    kind: 'ruggy',
    name: 'ruggy_honeydrip',
    moods: ['honey', 'love', 'celebrate'],
    visual: 'ruggy with melting/dripping yellow honey',
    use_when: 'honey moment, $HENLO, sticky-good vibes',
    animated: true,
  },
  {
    id: '1142020693123420223',
    kind: 'ruggy',
    name: 'ruggy_onfire',
    moods: ['celebrate', 'flex', 'psychedelic'],
    visual: 'ruggy with yellow flame burst behind',
    use_when: 'on fire, hot streak, "ruggy on fire"',
    animated: true,
  },
  {
    id: '1142029237994389534',
    kind: 'ruggy',
    name: 'ruggy_point',
    moods: ['flex', 'eyes', 'cool'],
    visual: 'ruggy in yellow shirt, pointing',
    use_when: 'pointing at something, calling attention, "look here"',
    animated: false,
  },
  {
    id: '1142514520032555189',
    kind: 'ruggy',
    name: 'ruggy_rainbow',
    moods: ['psychedelic', 'rave', 'celebrate'],
    visual: 'ruggy with rainbow/tie-dye background',
    use_when: 'rainbow vibes, owsley-lab energy, trippy moment',
    animated: true,
  },
  {
    id: '1144175906412314634',
    kind: 'ruggy',
    name: 'ruggy_rave',
    moods: ['rave', 'celebrate', 'love'],
    visual: 'ruggy in pink, raving / heart-eyes',
    use_when: 'rave moment, bear-cave energy, full party',
    animated: true,
  },
  {
    id: '1141009764864770068',
    kind: 'ruggy',
    name: 'ruggy_reee',
    moods: ['angry', 'shocked'],
    visual: 'small ruggy chibi, reee rage face',
    use_when: 'reee rage, frustrated reaction, "REEE"',
    animated: true,
  },
  {
    id: '1143651985208385628',
    kind: 'ruggy',
    name: 'ruggy_reeegun',
    moods: ['angry', 'snark'],
    visual: 'ruggy with bear pendant/key, reee with gun',
    use_when: 'reee with weapon, hyperbolic frustration',
    animated: true,
  },
  {
    id: '1141256545779331123',
    kind: 'ruggy',
    name: 'ruggy_sadge',
    moods: ['cry', 'concerned', 'dazed'],
    visual: 'ruggy with pickaxe, sadge face',
    use_when: 'sadge moment, fren slipping, soft loss',
    animated: true,
  },
  {
    id: '1142014302040104991',
    kind: 'ruggy',
    name: 'ruggy_smoke',
    moods: ['dapper', 'cool', 'eyes'],
    visual: 'ruggy in suit smoking',
    use_when: 'dapper smoke, contemplating, formal observation',
    animated: true,
  },
  {
    id: '1142020697376444497',
    kind: 'ruggy',
    name: 'ruggy_tears',
    moods: ['cry', 'love'],
    visual: 'ruggy big-faced grinning OR teared up',
    use_when: 'tears (joy or sad), strong emotional moment',
    animated: false,
  },
  {
    id: '1148914343291928619',
    kind: 'ruggy',
    name: 'ruggy_zoom',
    moods: ['eyes', 'cool', 'dapper'],
    visual: 'ruggy face, zoomed/serious',
    use_when: 'zooming in, focused look, "let me peep that"',
    animated: true,
  },
  {
    id: '1143937395998331071',
    kind: 'ruggy',
    name: 'ruggytubbies',
    moods: ['cute', 'meme', 'love'],
    visual: 'ruggy with golden honey blob, teletubbies-style',
    use_when: 'absurd cute moment, ruggytubbies meme',
    animated: false,
  },
];

// ─── helpers ─────────────────────────────────────────────────────────

export function renderEmoji(entry: EmojiEntry): string {
  const prefix = entry.animated ? 'a' : '';
  return `<${prefix}:${entry.name}:${entry.id}>`;
}

export function findById(id: string): EmojiEntry | null {
  return EMOJIS.find((e) => e.id === id) ?? null;
}

export function findByName(name: string): EmojiEntry | null {
  return EMOJIS.find((e) => e.name === name) ?? null;
}

export function pickByMood(mood: EmojiMood, kind?: EmojiKind): EmojiEntry[] {
  return EMOJIS.filter((e) => e.moods.includes(mood) && (kind ? e.kind === kind : true));
}

/** Pick by ANY of the supplied moods — broadens candidate pool. */
export function pickByMoods(moods: EmojiMood[], kind?: EmojiKind): EmojiEntry[] {
  const moodSet = new Set(moods);
  return EMOJIS.filter(
    (e) => e.moods.some((m) => moodSet.has(m)) && (kind ? e.kind === kind : true),
  );
}

/** Fisher-Yates shuffle for variance — variance is anti-Westworld for emoji too. */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const ALL_MOODS: EmojiMood[] = [
  'cute',
  'shocked',
  'love',
  'celebrate',
  'snark',
  'cry',
  'confused',
  'angry',
  'cool',
  'dazed',
  'shy',
  'wave',
  'peace',
  'hands-up',
  'flex',
  'mining',
  'dapper',
  'honey',
  'psychedelic',
  'concerned',
  'shrug',
  'pls',
  'nope',
  'eyes',
  'noted',
  'rave',
  'meme',
];
