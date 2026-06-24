// cycle-006 S4 T4.4 · drift-guard: every ZoneRoutedPostType must be
// in MIGRATED_POST_TYPES. If a new post type is added to POST_TYPE_SPECS
// without being added to MIGRATED_POST_TYPES, this test fails — caller
// either migrates it or explicitly excludes it via ZoneRoutedPostType.

import { describe, test, expect } from 'bun:test';
import {
  MIGRATED_POST_TYPES,
  ZONE_ROUTED_POST_TYPES,
  composeZonePost,
  type ZoneRoutedPostType,
} from './composer.ts';
import { POST_TYPE_SPECS, type PostType } from './post-types.ts';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';

describe('composer router · drift-guard (T4.4)', () => {
  test('every ZONE_ROUTED_POST_TYPES entry is in MIGRATED_POST_TYPES', () => {
    for (const pt of ZONE_ROUTED_POST_TYPES) {
      expect(MIGRATED_POST_TYPES.has(pt)).toBe(true);
    }
  });

  test('MIGRATED_POST_TYPES has no entries outside ZONE_ROUTED_POST_TYPES', () => {
    const routedSet = new Set<PostType>(ZONE_ROUTED_POST_TYPES);
    for (const migrated of MIGRATED_POST_TYPES) {
      expect(routedSet.has(migrated)).toBe(true);
    }
  });

  test('POST_TYPE_SPECS has every ZoneRoutedPostType (except reply)', () => {
    const specKeys = Object.keys(POST_TYPE_SPECS);
    for (const pt of ZONE_ROUTED_POST_TYPES) {
      expect(specKeys).toContain(pt);
    }
  });

  test('reply is NOT in ZONE_ROUTED_POST_TYPES (BB F-007 closure)', () => {
    expect((ZONE_ROUTED_POST_TYPES as readonly string[]).includes('reply')).toBe(false);
  });

  test('composeZonePost throws on legacy/unsupported post type', async () => {
    const STUB_CONFIG = { VOICE_DISABLED: true } as unknown as Config;
    const STUB_CHARACTER = { id: 'ruggy' } as unknown as CharacterConfig;
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      composeZonePost(STUB_CONFIG, STUB_CHARACTER, 'stonehenge', 'unknown_type' as ZoneRoutedPostType),
    ).rejects.toThrow(/unsupported zone-routed post type/);
  });
});
