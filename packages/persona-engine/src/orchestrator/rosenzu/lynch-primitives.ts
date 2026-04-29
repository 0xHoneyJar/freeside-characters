/**
 * Lynch primitives + KANSEI vectors per festival zone.
 *
 * Per Kevin Lynch (The Image of the City): paths · edges · districts ·
 * nodes · landmarks. Ruggy's 4 postable zones map onto these primitives
 * via the V0.4.5 creative-direction.md table.
 *
 * KANSEI tokens (warmth, motion, shadow, easing, density, sound) are
 * the texture inputs Arneson translates into prose.
 *
 * V0.5-C: reconciled with gumi's PR #52 on construct-mibera-codex
 * (`core-lore/festival-zones-vocabulary.md`). Gumi's canonical
 * vocabulary now lands in this file:
 *   - landmarks/edges/districts/paths from her PR (richer than V0.5-B)
 *   - KANSEI vectors expanded with `density` token
 *   - `sound_atmosphere` prose stored alongside `sensory_palette.sound`
 *     ARRAY (operator pick: keep both — prose for atmosphere, array for
 *     per-fire anchor variance)
 *   - the-warehouse zone added as vocabulary-only (no Discord channel,
 *     not in postable ZoneId — accessible to rosenzu tools for
 *     cross-zone weaver references and future activation)
 */

import type { ZoneId } from '../../score/types.ts';

/**
 * Spatial zone IDs include the 4 postable zones plus vocabulary-only
 * zones (the-warehouse). Rosenzu tools accept SpatialZoneId; ZoneId
 * (postable) is the subset the cron/Discord layer uses.
 */
export type SpatialZoneId = ZoneId | 'the-warehouse';

export type LynchPrimitive = 'node' | 'district' | 'edge' | 'path' | 'inner_sanctum';

export type KansaiDensity = 'sparse' | 'low-medium' | 'medium' | 'medium-thick' | 'high';

export interface KansaiVector {
  /** 0 (cool) → 1 (warm) */
  warmth: number;
  /** descriptor of motion register */
  motion: string;
  /** depth of shadow / contrast */
  shadow: 'shallow' | 'mid' | 'deep';
  /** emotional easing */
  easing: string;
  /** spatial / visual density (gumi PR #52 addition) */
  density: KansaiDensity;
  /** one-line atmosphere shorthand */
  feel: string;
}

export interface ZoneSpatialProfile {
  zone: SpatialZoneId;
  /** Primary lynch primitive — what KIND of place this is */
  primitive: LynchPrimitive;
  /** Codex archetype the zone leans into */
  archetype: string;
  /** Era resonance (gumi PR #52) */
  era: string;
  /** One-paragraph essence (gumi PR #52) — atmosphere prose */
  essence: string;
  /** Baseline KANSEI vector — agent rotates anchors per fire for variance */
  base_kansei: KansaiVector;
  /** Persistent orientation cues — landmarks (gumi expanded set) */
  landmarks: string[];
  /** Boundaries / liminal seams — edges (gumi expanded set) */
  edges: string[];
  /** Sub-areas within the zone (gumi PR #52) */
  districts: string[];
  /** Navigation flows / corridors (gumi PR #52) */
  paths: string[];
  /** Convergence points (gumi PR #52) */
  nodes: string[];
  /**
   * Single-line ambient sound prose (gumi PR #52). Use this for
   * atmosphere texture; pair with sensory_palette.sound array for
   * per-fire variance.
   */
  sound_atmosphere: string;
  /**
   * Sensory palette agent can pull from — per-fire anchor rotation
   * source (V0.5-B). gumi's sound_atmosphere is the canon prose; this
   * array gives variance.
   */
  sensory_palette: {
    light: string[];
    sound: string[];
    temperature: string[];
    smell: string[];
    motion: string[];
  };
}

export const ZONE_SPATIAL: Record<SpatialZoneId, ZoneSpatialProfile> = {
  stonehenge: {
    zone: 'stonehenge',
    primitive: 'node',
    archetype: 'overall — monolithic, ancient, observatory hub',
    era: 'timeless — pre-rave, pre-history, the gathering impulse itself',
    essence:
      "Dawn-grey stone circle. The festival's shared axis. Not owned by any archetype — where all four converge before dispersing to their zones.",
    base_kansei: {
      warmth: 0.3,
      motion: 'panoramic — slow sweeping gaze, geological time',
      shadow: 'mid',
      easing: 'objective — observational distance, wide-angle, documentary',
      density: 'sparse',
      feel: 'broad observatory · cross-zone convergence point',
    },
    landmarks: [
      'the trilithons',
      'the heel stone',
      'the slaughter stone',
      'the aubrey holes',
      'the central stone — pinned edicts of the elders',
      'the cabling rig at the obelisk',
      'the strobe scaffolding',
    ],
    edges: [
      'standing-stone perimeter',
      'fog boundary',
      'horizon line where sky meets field',
      'crowd-edge',
      'between-the-stones',
    ],
    districts: [
      'the henge circle (ceremonial center)',
      'the avenue approach',
      'outer campground ring',
    ],
    paths: [
      'processional stone avenues',
      'ley-line corridors between stages',
      'trampled grass desire paths',
    ],
    nodes: [
      'altar stone (center)',
      'sunrise gap between trilithons',
      'bonfire gathering points',
    ],
    sound_atmosphere:
      'wind through stone gaps, distant bass from other zones, footsteps on packed earth',
    sensory_palette: {
      light: ['neon static', 'strobe', 'dawn-grey wash', 'cold spotlight on the central stone'],
      sound: [
        'low rhythmic thrum of freetekno from the trees',
        'crowd murmur',
        'wind through the obelisks',
        'distant kicks from main stage',
      ],
      temperature: ['cool-neutral', 'wind-cooled', 'ground-cold underfoot', 'pre-dawn chill'],
      smell: ['ozone', 'crushed mint', 'damp earth', 'old amplifier dust'],
      motion: [
        'the crowd converging in chaotic swirl',
        'shadows wheeling across the stones',
        'cables shifting in wind',
        'clouds passing over monoliths',
      ],
    },
  },
  'bear-cave': {
    zone: 'bear-cave',
    primitive: 'district',
    archetype: 'og · freetekno lineage · low-lit warehouse',
    era: 'early-late 90s — castlemorton, spiral tribe, the criminal justice act and everything after',
    essence:
      "Deep in the tree line, past the generator perimeter. UV strips on cable. Tea and speed and someone's dog asleep by the fire barrel. The rig hasn't stopped since Thursday.",
    base_kansei: {
      warmth: 0.7,
      motion: '700ms ritual — slow head-nods, fire-flicker rhythm, unhurried',
      shadow: 'deep',
      easing: 'intimate — close-range, eye-contact distance, whispered-over-bass',
      density: 'medium-thick',
      feel: 'low-lit warehouse · og sound · rave-tribe',
    },
    landmarks: [
      'the spiral tribe banner',
      'the tallest stack',
      "the burnt-out van that's always been there",
      'the information tent',
      'the back-room server racks (humming with latent heat)',
      'the boundary wall (where the noise drops)',
      'the henlock alcove',
      'the old subwoofer stack',
    ],
    edges: [
      'tree line',
      'sound-system wall of bass',
      'generator perimeter',
      'the point where torchlight gives out',
      'cavern-mouth (the threshold from stonehenge)',
    ],
    districts: [
      'main rig clearing',
      'chill-out zone (tarps and cushions)',
      'tea stall cluster',
      'vehicle circle (vans and converted ambulances)',
    ],
    paths: [
      'narrow tunnels lit by UV strips',
      'cable-strewn corridors',
      'muddy ruts between rigs',
      'torch-lit trails through woods',
    ],
    nodes: [
      'speaker stack',
      'fire barrel',
      'DJ position behind the rig',
      'kettle on a camp stove',
    ],
    sound_atmosphere:
      'relentless kick drum through leaves, generator hum, dog bark, kettle whistle, someone laughing in the dark',
    sensory_palette: {
      light: [
        'amber bulbs',
        'the glow of server lights',
        'red-warning LED on the desk',
        'no overheads — just floor lamps',
        'UV strips on cable',
        'cigarette cherries in the dark',
      ],
      sound: [
        'muffled silence after the festival noise drops',
        'low subwoofer hum',
        'whispered conversations',
        'the drip somewhere in the back',
        'generator hum',
        'distant kick drum through leaves',
      ],
      temperature: [
        'warm — almost stifling',
        'humid',
        'machine-heat',
        'fire-barrel glow on your hands',
      ],
      smell: ['damp earth', 'circuitry', 'old leather', 'spilled beer ghost', 'tea steam'],
      motion: [
        'ruggy wiping grease from his hands',
        'the slow turn of regulars at the back',
        'cables coiling in the corner',
        'fire-flicker on faces',
      ],
    },
  },
  'el-dorado': {
    zone: 'el-dorado',
    primitive: 'edge',
    archetype: 'nft · milady-aspirational · treasure-hunt',
    era: 'current — network spirituality, post-ironic aspiration, the screen as altar',
    essence:
      "Everything glows and everything's for sale. Neon kanji over velvet rope. The treasure is real but the map keeps changing. Somewhere between a shrine and a night market.",
    base_kansei: {
      warmth: 0.5,
      motion: '200ms snap — quick cuts, swipe-speed, notification cadence',
      shadow: 'mid',
      easing: 'playful — bouncy, overshoot, emoji-logic, irony-coated sincerity',
      density: 'high',
      feel: 'gold-tinged · treasure-hunt · mints-as-moves',
    },
    landmarks: [
      'the neon kanji sign',
      'the vault door',
      'the giant Milady projection',
      'the wishing well (drop tokens in)',
      'the gilded archway',
      'the mint-counter',
      'the honeycomb display',
      'the gen3 vault',
    ],
    edges: [
      'velvet rope lines',
      'holographic barriers',
      'screen walls cycling Remilia art',
      'the drop-off where the platform ends',
      'the threshold from stonehenge (gold-laced)',
    ],
    districts: [
      'the bazaar (merch and mints)',
      'the shrine (projection-mapped devotional space)',
      'the viewing deck',
      'the catboy lounge',
    ],
    paths: [
      'neon-lit market alleys',
      'rope bridges between platforms',
      'glowing stairways',
      'QR-code breadcrumb trails',
    ],
    nodes: [
      'the golden throne',
      'the display case',
      'the bidding altar',
      'the selfie mirror',
    ],
    sound_atmosphere:
      'notification chimes layered over hyperpop, crowd murmur, someone saying "gm", cash register ka-ching',
    sensory_palette: {
      light: [
        'gold-tinted',
        'warm-edge neon',
        'spotlight on the mint counter',
        'reflected sheen off coins',
        'screen-wash from the projections',
      ],
      sound: [
        'the click of recorded mints',
        'celebration whoops nearby',
        'cash-register chime in the distance',
        'a soft anticipatory hum',
        'hyperpop bleeding from the catboy lounge',
      ],
      temperature: ['warm — buzzing', 'sun-soaked', 'flushed', 'screen-temperature synthetic'],
      smell: ['warm metal', 'incense from the vault', 'sweet honey', 'fresh paper'],
      motion: [
        'quick darting between mints',
        'the glint of gold catching motion',
        'a regular pocketing a fresh mint',
        'screens cycling Remilia art',
      ],
    },
  },
  'owsley-lab': {
    zone: 'owsley-lab',
    primitive: 'inner_sanctum',
    archetype: 'onchain · acidhouse · owsley stanley · late-night precision',
    era: 'late 90s / 2000s — second summer of love afterglow, PLUR, the smiley face as sigil',
    essence:
      "Fluorescent tubes and dripping condensation. Everything hums at 440Hz. The periodic table on the wall but the elements have been renamed. Someone left a copy of PiHKAL on the centrifuge.",
    base_kansei: {
      warmth: 0.4,
      motion: '2000ms breathing — slow pulsing, come-up pacing, time-dilation',
      shadow: 'deep',
      easing: 'otherworldly — sine-wave, liquid, no hard edges',
      density: 'low-medium',
      feel: 'humming amber under fluorescents · late-night precision',
    },
    landmarks: [
      'the periodic table mural (elements renamed after molecules)',
      'the crystal display',
      'the Owsley portrait',
      'the giant Erlenmeyer flask',
      'the primary corridor (where the synthesis is racked)',
      'the wall of vials',
      'the lp-provide rig',
      'the shadow-minter station',
    ],
    edges: [
      'glass partition walls',
      'chemical-spill tape perimeters',
      'ventilation grate boundaries',
      'the threshold where fluorescent light meets blacklight',
      'the airlock from el-dorado',
    ],
    districts: [
      'the synthesis floor (main dance area)',
      'the greenhouse (chill zone, actual plants)',
      'the testing chamber (immersive AV)',
      'the library (zine table, harm reduction)',
    ],
    paths: [
      'fluorescent-lit corridors',
      'grated metal walkways',
      'dripping pipe tunnels',
      'paths marked with smiley-face stickers',
    ],
    nodes: [
      'the centrifuge (center-floor installation)',
      'the microscope station (close-looking art)',
      'the dosing window (bar/distribution)',
      'the reagent rack',
    ],
    sound_atmosphere:
      '303 acid line, white noise washes, dripping water, heartbeat kick, someone reading Shulgin aloud over the PA',
    sensory_palette: {
      light: [
        'kaleidoscopic uv wash',
        'humming amber under fluorescents',
        'cold-blue from the rigs',
        'a single desk lamp at 3am',
        'blacklight bleeding into fluorescent',
      ],
      sound: [
        'high-pitched resonant frequency that makes teeth ache',
        'fluorescent buzz',
        'the click of typing in the back',
        'liquid moving in glass',
        '303 acid line in the next room',
        'dripping condensation',
      ],
      temperature: [
        'sterile-cool',
        'edge-of-cold',
        'climate-controlled',
        'warmth only from bodies',
      ],
      smell: [
        'synthetic citrus',
        'sharp chemical tang',
        'sterile cleaning agents',
        'electric ozone',
      ],
      motion: [
        'ruggy at the clipboard, not looking up',
        'liquid swirling in a vial',
        'a regular adjusting a dial',
        'the slow turn of a centrifuge',
      ],
    },
  },
  'the-warehouse': {
    zone: 'the-warehouse',
    primitive: 'district',
    archetype: 'chicago/detroit · birthplace of house',
    era: 'early 80s — the warehouse, music box, abandoned auto plants, the birth of house',
    essence:
      "Concrete floor, steel columns, no decoration that wasn't already here. The building was a factory, then it was nothing, now Ron Hardy is behind the decks and 400 people are losing their minds. The genre is named after this room.",
    base_kansei: {
      warmth: 0.8,
      motion: '400ms pulse — relentless 4/4, mechanical, assembly-line precision',
      shadow: 'deep',
      easing: 'raw — no smoothing, no irony, no mediation',
      density: 'high',
      feel: 'concrete-and-steel · sweat-dark birthplace of house',
    },
    landmarks: [
      'the industrial ceiling fan (always spinning)',
      'the freight elevator (permanently open)',
      'the fire exit sign (the only signage)',
      'the chosen few banner',
    ],
    edges: [
      'roller-shutter doors (half-open to the street)',
      'chain-link fencing',
      'exposed brick walls sweating with condensation',
      'the line where streetlight ends and bass begins',
    ],
    districts: [
      'the main floor (open warehouse span, columns as the only structure)',
      'the balcony (mezzanine, looking down)',
      'the back room (smaller, darker, deeper)',
      'the parking lot (cool-down, smoking, dawn)',
    ],
    paths: [
      'loading-dock ramps',
      'concrete corridors',
      'fire-escape stairwells',
      'freight-elevator shafts repurposed as light wells',
    ],
    nodes: [
      'the DJ booth (elevated, minimal — a table and two turntables)',
      'the 303 on a milk crate',
      'the water fountain',
      'the single working bathroom',
    ],
    sound_atmosphere:
      "808 kick through concrete, Ron Hardy's reel-to-reel edits, crowd vocals, hand-claps, squeaking sneakers on wet floor, the door opening and street noise rushing in",
    sensory_palette: {
      light: [
        'one light on the DJ',
        'silhouette and strobe-flash',
        'streetlight bleeding through roller-shutter doors',
        'cigarette cherries in the back room',
      ],
      sound: [
        'relentless 4/4 808 kick',
        "Ron Hardy's reel-to-reel edits",
        'crowd vocals layered over the track',
        'squeaking sneakers on wet concrete',
        'the door opening and street noise rushing in',
      ],
      temperature: [
        'hot — body heat in a box',
        'no ventilation',
        'sweat on concrete',
        'radiator-pipe warmth',
      ],
      smell: ['concrete dust', 'sweat', 'cigarette smoke', 'old machine oil from the factory days'],
      motion: [
        'the crowd as a single organism',
        'shoulder-to-shoulder, one breath',
        'industrial ceiling fan turning',
        'someone climbing the freight elevator',
      ],
    },
  },
};

/**
 * Pick a sensory anchor for THIS fire — variance source for arneson.
 * Default: random (different anchor each call, prevents Westworld-loop
 * static descriptions). Pass an explicit fireId for deterministic
 * reproduction (testing, replay).
 */
export function pickSensoryAnchor(
  zone: SpatialZoneId,
  category: keyof ZoneSpatialProfile['sensory_palette'],
  fireId?: number,
): string {
  const palette = ZONE_SPATIAL[zone].sensory_palette[category];
  if (fireId === undefined) {
    return palette[Math.floor(Math.random() * palette.length)]!;
  }
  const idx = ((fireId % palette.length) + palette.length) % palette.length;
  return palette[idx]!;
}

/**
 * Build a per-fire KANSEI vector for the agent. Carries the baseline +
 * a current-anchor pick across each sensory channel. Arneson reads this
 * to layer sensory description.
 */
export function furnishKansei(
  zone: SpatialZoneId,
  fireId?: number,
): KansaiVector & {
  current_anchors: {
    light: string;
    sound: string;
    temperature: string;
    smell: string;
    motion: string;
  };
  sound_atmosphere: string;
  archetype: string;
  primitive: LynchPrimitive;
  era: string;
} {
  const profile = ZONE_SPATIAL[zone];
  return {
    ...profile.base_kansei,
    archetype: profile.archetype,
    primitive: profile.primitive,
    era: profile.era,
    sound_atmosphere: profile.sound_atmosphere,
    current_anchors: {
      light: pickSensoryAnchor(zone, 'light', fireId),
      sound: pickSensoryAnchor(zone, 'sound', fireId === undefined ? undefined : fireId + 1),
      temperature: pickSensoryAnchor(zone, 'temperature', fireId === undefined ? undefined : fireId + 2),
      smell: pickSensoryAnchor(zone, 'smell', fireId === undefined ? undefined : fireId + 3),
      motion: pickSensoryAnchor(zone, 'motion', fireId === undefined ? undefined : fireId + 4),
    },
  };
}

/** Postable zones — the 4 with live Discord channels. */
export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];

/** All spatial zones including vocab-only (the-warehouse). Use for rosenzu tool surfaces. */
export const ALL_SPATIAL_ZONES: SpatialZoneId[] = [
  'stonehenge',
  'bear-cave',
  'el-dorado',
  'owsley-lab',
  'the-warehouse',
];
