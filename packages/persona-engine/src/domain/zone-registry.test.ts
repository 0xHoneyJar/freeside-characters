/**
 * Tests for domain/zone-registry.ts (cycle-007 S1/T1.2).
 *
 * Coverage matrix:
 * - Every ZoneId has a ZONE_REGISTRY entry (compile-time + runtime exhaustiveness)
 * - resolveZoneDisplayName + resolveZoneRichLabel correct values for all zones
 * - Both resolvers throw UnknownZoneError on unknown zone (IMP-011 Flatline Phase 2)
 * - detectKebabZoneIds case-insensitivity
 * - detectKebabZoneIds false-positive allowlist (IMP-002 Flatline Phase 2):
 *     fenced code · inline code · Discord :emoji: + <:emoji:id> · URLs · markdown link targets
 * - detectKebabZoneIds BB HIGH-2 Unicode bypass tests:
 *     U+2010 HYPHEN · U+2014 EM DASH · U+2013 EN DASH · U+2212 MINUS
 * - detectKebabZoneIds Flatline IMP-002 ReDoS benchmark (10K-char pathological input < 50ms)
 * - assertNeverZone compile-time exhaustiveness helper
 */

import { describe, expect, test } from 'bun:test';
import { ZONE_IDS } from '../score/types.ts';
import {
  ZONE_REGISTRY,
  resolveZoneDisplayName,
  resolveZoneRichLabel,
  detectKebabZoneIds,
  UnknownZoneError,
  assertNeverZone,
  type ZoneDisplayRecord,
} from './zone-registry.ts';

// ──────────────────────────────────────────────────────────────────────
// Exhaustiveness · every ZoneId has a registry entry
// ──────────────────────────────────────────────────────────────────────

describe('ZONE_REGISTRY exhaustiveness', () => {
  test('every ZoneId in ZONE_IDS has a ZONE_REGISTRY entry', () => {
    for (const zone of ZONE_IDS) {
      expect(ZONE_REGISTRY[zone]).toBeDefined();
      expect(ZONE_REGISTRY[zone].id).toBe(zone);
    }
  });

  test('ZONE_REGISTRY is frozen (mutation throws in strict mode)', () => {
    expect(Object.isFrozen(ZONE_REGISTRY)).toBe(true);
  });

  test('ZONE_REGISTRY has no extra keys beyond ZONE_IDS', () => {
    const registryKeys = Object.keys(ZONE_REGISTRY).sort();
    const zoneIdsSorted = [...ZONE_IDS].sort();
    expect(registryKeys).toEqual(zoneIdsSorted);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Resolvers · canonical values
// ──────────────────────────────────────────────────────────────────────

describe('resolveZoneDisplayName', () => {
  test('returns canonical prose name for el-dorado', () => {
    expect(resolveZoneDisplayName('el-dorado')).toBe('El Dorado');
  });

  test('returns canonical prose name for bear-cave', () => {
    expect(resolveZoneDisplayName('bear-cave')).toBe('Bear Cave');
  });

  test('returns canonical prose name for owsley-lab', () => {
    expect(resolveZoneDisplayName('owsley-lab')).toBe('Owsley Lab');
  });

  test('returns canonical prose name for stonehenge', () => {
    expect(resolveZoneDisplayName('stonehenge')).toBe('Stonehenge');
  });

  // IMP-011 · Flatline Phase 2: MUST throw on unknown
  test('throws UnknownZoneError on unknown zone (IMP-011)', () => {
    expect(() => resolveZoneDisplayName('does-not-exist' as never)).toThrow(UnknownZoneError);
  });

  test('UnknownZoneError message includes attempted zone + valid options', () => {
    try {
      resolveZoneDisplayName('mystery-zone' as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownZoneError);
      expect((e as UnknownZoneError).attemptedZone).toBe('mystery-zone');
      expect((e as Error).message).toContain('mystery-zone');
      expect((e as Error).message).toContain('el-dorado');
    }
  });
});

describe('resolveZoneRichLabel', () => {
  test('returns Discord rich label with emoji + dimension for el-dorado', () => {
    expect(resolveZoneRichLabel('el-dorado')).toBe('⛏️ El Dorado (NFT)');
  });

  test('starts with the zone emoji', () => {
    expect(resolveZoneRichLabel('bear-cave').startsWith('🐻')).toBe(true);
    expect(resolveZoneRichLabel('el-dorado').startsWith('⛏️')).toBe(true);
    expect(resolveZoneRichLabel('owsley-lab').startsWith('🧪')).toBe(true);
    expect(resolveZoneRichLabel('stonehenge').startsWith('🗿')).toBe(true);
  });

  test('throws UnknownZoneError on unknown zone (IMP-011)', () => {
    expect(() => resolveZoneRichLabel('unknown' as never)).toThrow(UnknownZoneError);
  });
});

// ──────────────────────────────────────────────────────────────────────
// detectKebabZoneIds · case-insensitivity
// ──────────────────────────────────────────────────────────────────────

describe('detectKebabZoneIds · basic detection', () => {
  test('detects el-dorado in lowercase prose', () => {
    expect(detectKebabZoneIds('el-dorado wakes from a long sleep')).toEqual(['el-dorado']);
  });

  test('detects el-dorado case-insensitively', () => {
    expect(detectKebabZoneIds('El-Dorado wakes')).toEqual(['el-dorado']);
    expect(detectKebabZoneIds('EL-DORADO rises')).toEqual(['el-dorado']);
  });

  test('detects multiple zones in same text', () => {
    const hits = detectKebabZoneIds('bear-cave and el-dorado both quiet today');
    expect(hits.sort()).toEqual(['bear-cave', 'el-dorado']);
  });

  test('returns empty for clean prose with no kebab IDs', () => {
    expect(detectKebabZoneIds('Bear Cave is quiet today, El Dorado roars.')).toEqual([]);
  });

  test('does not match partial words (word-boundary check)', () => {
    expect(detectKebabZoneIds('mybear-caveplace')).toEqual([]);
    expect(detectKebabZoneIds('xel-doradoy')).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// detectKebabZoneIds · IMP-002 false-positive allowlist
// ──────────────────────────────────────────────────────────────────────

describe('detectKebabZoneIds · IMP-002 false-positive allowlist', () => {
  test('skips fenced code blocks (```)', () => {
    expect(detectKebabZoneIds('```\nel-dorado\n```')).toEqual([]);
    expect(detectKebabZoneIds('here is code:\n```\nconst z = "el-dorado";\n```\nend')).toEqual([]);
  });

  test('skips inline code (`text`)', () => {
    expect(detectKebabZoneIds('the zone `el-dorado` is unused')).toEqual([]);
  });

  test('skips Discord emoji syntax (:name:)', () => {
    expect(detectKebabZoneIds('use :el-dorado: emoji')).toEqual([]);
  });

  test('skips Discord custom emoji (<:name:id>)', () => {
    expect(detectKebabZoneIds('check <:el-dorado:123456789> emoji')).toEqual([]);
  });

  test('skips URL path segments', () => {
    expect(detectKebabZoneIds('see https://example.com/el-dorado/x for details')).toEqual([]);
    expect(detectKebabZoneIds('http://localhost:3001/bear-cave')).toEqual([]);
  });

  test('skips markdown link targets [text](url)', () => {
    expect(detectKebabZoneIds('[link](https://example.com/el-dorado)')).toEqual([]);
    expect(detectKebabZoneIds('check [link text](https://x.com/bear-cave/page)')).toEqual([]);
  });

  test('detects kebab in prose even when other zones are in allowed contexts', () => {
    // Prose-form bear-cave should still be detected; el-dorado-in-emoji should not
    const text = 'bear-cave is loud while :el-dorado: emoji is muted';
    expect(detectKebabZoneIds(text)).toEqual(['bear-cave']);
  });
});

// ──────────────────────────────────────────────────────────────────────
// detectKebabZoneIds · BB HIGH-2 Unicode bypass tests
// ──────────────────────────────────────────────────────────────────────

describe('detectKebabZoneIds · BB HIGH-2 Unicode dash substitution', () => {
  test('detects el-dorado with U+2010 HYPHEN (el‐dorado)', () => {
    expect(detectKebabZoneIds('el‐dorado wakes')).toEqual(['el-dorado']);
  });

  test('detects el-dorado with U+2014 EM DASH (el—dorado)', () => {
    expect(detectKebabZoneIds('el—dorado roars')).toEqual(['el-dorado']);
  });

  test('detects el-dorado with U+2013 EN DASH (el–dorado)', () => {
    expect(detectKebabZoneIds('el–dorado stirs')).toEqual(['el-dorado']);
  });

  test('detects el-dorado with U+2212 MINUS (el−dorado)', () => {
    expect(detectKebabZoneIds('el−dorado')).toEqual(['el-dorado']);
  });

  test('detects bear-cave with U+2014 EM DASH (bear—cave)', () => {
    expect(detectKebabZoneIds('bear—cave hums')).toEqual(['bear-cave']);
  });

  // Known V2-deferred gap (Red Team ATK-003 · CREATIVE_ONLY · 670)
  test('Cyrillic homoglyph bypass NOT closed in V1 (V2 work · UTS #39 skeleton)', () => {
    // Cyrillic 'е' (U+0435) vs Latin 'e' (U+0065) — NFKC does NOT collapse these
    // This test pins the V1 gap explicitly · V2 will close via confusable-skeleton.
    const cyrillicE = 'е';                          // Cyrillic 'е'
    expect(detectKebabZoneIds(`${cyrillicE}l-dorado`)).toEqual([]);   // V1 bypass · documented
  });
});

// ──────────────────────────────────────────────────────────────────────
// detectKebabZoneIds · Flatline IMP-002 ReDoS benchmark
// ──────────────────────────────────────────────────────────────────────

describe('detectKebabZoneIds · ReDoS benchmark (IMP-002 Phase 2)', () => {
  test('linear-time on 10K-char pathological input (<50ms wall-clock)', () => {
    // Pathological input: word-boundary-separated zone names + interleaved dash
    // variants + filler designed to trip backtracking explosions in poorly-written regex
    const pathological = 'el-dorado x '.repeat(300) +
      'el—dorado y '.repeat(300) +
      'el‐dorado z '.repeat(300) +
      'bear-cave w '.repeat(300);

    const start = performance.now();
    const hits = detectKebabZoneIds(pathological);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);                    // 50ms wall-clock budget
    expect(hits.sort()).toEqual(['bear-cave', 'el-dorado']);
  });

  test('linear-time on adversarial dash-variant mix (<50ms)', () => {
    // Mix of unicode dashes + emoji prefix attempts + URL-like patterns
    const adversarial = (
      'el‐dorado—el-dorado–el−dorado :el-dorado: ' +
      '<:el-dorado:1234> https://x.com/el-dorado [text](https://y.com/el-dorado) ' +
      '`el-dorado` \n```\nel-dorado\n```\n'
    ).repeat(200);

    const start = performance.now();
    const hits = detectKebabZoneIds(adversarial);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(hits).toContain('el-dorado');                 // unicode-dash variants still detected
  });
});

// ──────────────────────────────────────────────────────────────────────
// assertNeverZone · exhaustiveness helper
// ──────────────────────────────────────────────────────────────────────

describe('assertNeverZone', () => {
  test('throws UnknownZoneError when called with any value', () => {
    expect(() => assertNeverZone('runtime-only-value' as never)).toThrow(UnknownZoneError);
  });

  test('produces UnknownZoneError with attemptedZone set', () => {
    try {
      assertNeverZone('runtime-leak' as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownZoneError);
      expect((e as UnknownZoneError).attemptedZone).toBe('runtime-leak');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// ZoneDisplayRecord shape · type-level invariant
// ──────────────────────────────────────────────────────────────────────

describe('ZoneDisplayRecord shape', () => {
  test('every record has id · emoji · displayName · dimension · richLabel', () => {
    for (const zone of ZONE_IDS) {
      const r: ZoneDisplayRecord = ZONE_REGISTRY[zone];
      expect(typeof r.id).toBe('string');
      expect(typeof r.emoji).toBe('string');
      expect(typeof r.displayName).toBe('string');
      expect(typeof r.dimension).toBe('string');
      expect(typeof r.richLabel).toBe('string');
      expect(r.id).toBe(zone);
    }
  });

  test('richLabel always starts with emoji', () => {
    for (const zone of ZONE_IDS) {
      const r = ZONE_REGISTRY[zone];
      expect(r.richLabel.startsWith(r.emoji)).toBe(true);
    }
  });
});
