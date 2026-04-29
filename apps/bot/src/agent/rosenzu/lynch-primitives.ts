/**
 * Lynch primitives + KANSEI vectors per festival zone.
 *
 * Per Kevin Lynch (The Image of the City): paths · edges · districts ·
 * nodes · landmarks. Ruggy's 4 zones map onto these primitives via the
 * V0.4.5 creative-direction.md table.
 *
 * KANSEI tokens (warmth, motion, shadow, easing, feel) are the texture
 * inputs Arneson translates into prose.
 *
 * V0.5-B baseline: this file holds inline canon. V0.5-B+ migration target:
 * `construct-mibera-codex/core-lore/festival-zones-vocabulary.md` (gumi
 * authors). When that file lands, this module loads from it; for now it
 * IS the vocabulary.
 */

import type { ZoneId } from '../../score/types.ts';

export type LynchPrimitive = 'node' | 'district' | 'edge' | 'path' | 'inner_sanctum';

export interface KansaiVector {
  /** 0 (cool) → 1 (warm) */
  warmth: number;
  /** descriptor of motion register */
  motion: string;
  /** depth of shadow / contrast */
  shadow: 'shallow' | 'mid' | 'deep';
  /** emotional easing */
  easing: string;
  /** one-line atmosphere shorthand */
  feel: string;
}

export interface ZoneSpatialProfile {
  zone: ZoneId;
  /** Primary lynch primitive — what KIND of place this is */
  primitive: LynchPrimitive;
  /** Codex archetype the zone leans into */
  archetype: string;
  /** Baseline KANSEI vector — agent rotates anchors per fire for variance */
  base_kansei: KansaiVector;
  /** Persistent orientation cues */
  landmarks: string[];
  /** Boundaries / liminal seams */
  edges: string[];
  /** Sensory palette agent can pull from */
  sensory_palette: {
    light: string[];
    sound: string[];
    temperature: string[];
    smell: string[];
    motion: string[];
  };
}

export const ZONE_SPATIAL: Record<ZoneId, ZoneSpatialProfile> = {
  stonehenge: {
    zone: 'stonehenge',
    primitive: 'node',
    archetype: 'overall — monolithic, ancient, observatory hub',
    base_kansei: {
      warmth: 0.3,
      motion: 'panoramic broad-view',
      shadow: 'mid',
      easing: 'objective',
      feel: 'broad observatory · cross-zone convergence point',
    },
    landmarks: [
      'the central stone — pinned edicts of the elders',
      'the ring of monoliths',
      'the cabling rig at the obelisk',
      'the strobe scaffolding',
    ],
    edges: ['festival-perimeter', 'crowd-edge', 'between-the-stones'],
    sensory_palette: {
      light: ['neon static', 'strobe', 'dawn-grey wash', 'cold spotlight on the central stone'],
      sound: ['low rhythmic thrum of freetekno', 'crowd murmur', 'wind through the obelisks', 'distant kicks from main stage'],
      temperature: ['cool-neutral', 'wind-cooled', 'ground-cold underfoot'],
      smell: ['ozone', 'crushed mint', 'damp earth', 'old amplifier dust'],
      motion: ['the crowd converging in chaotic swirl', 'shadows wheeling across the stones', 'cables shifting in wind'],
    },
  },
  'bear-cave': {
    zone: 'bear-cave',
    primitive: 'district',
    archetype: 'og · freetekno lineage · low-lit warehouse',
    base_kansei: {
      warmth: 0.7,
      motion: '700ms+ ritual motion — slower, tribal',
      shadow: 'deep',
      easing: 'intimate',
      feel: 'low-lit warehouse · og sound · rave-tribe',
    },
    landmarks: [
      'the back-room server racks (humming with latent heat)',
      'the boundary wall (where the noise drops)',
      'the henlock alcove',
      'the old subwoofer stack',
    ],
    edges: ['cavern-mouth (the threshold from stonehenge)', 'back-room-door', 'where-the-noise-drops'],
    sensory_palette: {
      light: ['amber bulbs', 'the glow of server lights', 'red-warning LED on the desk', 'no overheads — just floor lamps'],
      sound: ['muffled silence after the festival noise drops', 'low subwoofer hum', 'whispered conversations', 'the drip somewhere in the back'],
      temperature: ['warm — almost stifling', 'humid', 'machine-heat'],
      smell: ['damp earth', 'circuitry', 'old leather', 'spilled beer ghost'],
      motion: ['ruggy wiping grease from his hands', 'the slow turn of regulars at the back', 'cables coiling in the corner'],
    },
  },
  'el-dorado': {
    zone: 'el-dorado',
    primitive: 'edge',
    archetype: 'nft · milady-aspirational · treasure-hunt',
    base_kansei: {
      warmth: 0.5,
      motion: '200ms snap — playful, alert',
      shadow: 'mid',
      easing: 'playful · alert',
      feel: 'gold-tinged · treasure-hunt · mints-as-moves',
    },
    landmarks: [
      'the gilded archway',
      'the mint-counter (where moves are recorded)',
      'the honeycomb display',
      'the gen3 vault',
    ],
    edges: ['the threshold from stonehenge (gold-laced)', 'the vault-door', 'between-the-mints'],
    sensory_palette: {
      light: ['gold-tinted', 'warm-edge neon', 'spotlight on the mint counter', 'reflected sheen off coins'],
      sound: ['the click of recorded mints', 'celebration whoops nearby', 'cash-register chime in the distance', 'a soft anticipatory hum'],
      temperature: ['warm — buzzing', 'sun-soaked', 'flushed'],
      smell: ['warm metal', 'incense from the vault', 'sweet honey', 'fresh paper'],
      motion: ['quick darting between mints', 'the glint of gold catching motion', 'a regular pocketing a fresh mint'],
    },
  },
  'owsley-lab': {
    zone: 'owsley-lab',
    primitive: 'inner_sanctum',
    archetype: 'onchain · acidhouse · owsley stanley · late-night precision',
    base_kansei: {
      warmth: 0.4,
      motion: '2000ms+ breathing',
      shadow: 'deep',
      easing: 'otherworldly',
      feel: 'humming amber under fluorescents · late-night precision',
    },
    landmarks: [
      'the primary corridor (where the synthesis is racked)',
      'the wall of vials',
      'the lp-provide rig',
      'the shadow-minter station',
    ],
    edges: ['the airlock from el-dorado', 'the door to the back-stacks', 'where-the-fluorescents-end'],
    sensory_palette: {
      light: ['kaleidoscopic uv wash', 'humming amber under fluorescents', 'cold-blue from the rigs', 'a single desk lamp at 3am'],
      sound: ['high-pitched resonant frequency that makes teeth ache', 'fluorescent buzz', 'the click of typing in the back', 'liquid moving in glass'],
      temperature: ['sterile-cool', 'edge-of-cold', 'climate-controlled'],
      smell: ['synthetic citrus', 'sharp chemical tang', 'sterile cleaning agents', 'electric ozone'],
      motion: ['ruggy at the clipboard, not looking up', 'liquid swirling in a vial', 'a regular adjusting a dial', 'the slow turn of a centrifuge'],
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
  zone: ZoneId,
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
  zone: ZoneId,
  fireId?: number,
): KansaiVector & {
  current_anchors: {
    light: string;
    sound: string;
    temperature: string;
    smell: string;
    motion: string;
  };
  archetype: string;
  primitive: LynchPrimitive;
} {
  const profile = ZONE_SPATIAL[zone];
  return {
    ...profile.base_kansei,
    archetype: profile.archetype,
    primitive: profile.primitive,
    current_anchors: {
      light: pickSensoryAnchor(zone, 'light', fireId),
      sound: pickSensoryAnchor(zone, 'sound', (fireId ?? 0) + 1),
      temperature: pickSensoryAnchor(zone, 'temperature', (fireId ?? 0) + 2),
      smell: pickSensoryAnchor(zone, 'smell', (fireId ?? 0) + 3),
      motion: pickSensoryAnchor(zone, 'motion', (fireId ?? 0) + 4),
    },
  };
}

export const ALL_ZONES: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];
