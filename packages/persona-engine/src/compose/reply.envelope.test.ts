/**
 * pickFirstGrailFromEnvelope tests · V0.7-A.3 HOTFIX B1.
 *
 * The codex MCP `search_codex` handler returns `SearchHit[]` (top-level
 * JSON array, no `{ results: }` wrapper) per
 * /tmp/codex-probe/src/lookups/search.ts:204 + server.ts handler. The
 * V0.7-A.3 PR #21 implementation expected `{ results: [...] }` and silently
 * dropped every search_codex hit — operator's "the dark grail" Discord
 * test surfaced this in prod. This suite covers the corrected envelope
 * shape PLUS the scan-all-results fallback (bridgebuilder F9 deferred —
 * top hit may be non-grail; later hits with image fields must still win).
 *
 * Also covers `lookup_grail` regression (flat envelope) so the hotfix
 * doesn't break PR #21's verified path.
 */

import { describe, test, expect } from 'bun:test';
import { pickFirstGrailFromEnvelope } from './reply.ts';

describe('pickFirstGrailFromEnvelope · search_codex direct-array (V0.7-A.3 hotfix B1)', () => {
  test('top-1 grail hit with image returns the candidate', () => {
    const parsed = [
      {
        ref: '@g876',
        type: 'grail',
        name: 'Black Hole',
        score: 0.92,
        collection: 'mibera',
        file: 'grails/black-hole.md',
        image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
      },
    ];

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__search_codex',
      parsed,
    );

    expect(result).not.toBeNull();
    expect(result!.ref).toBe('@g876');
    expect(result!.name).toBe('Black Hole');
    expect(result!.image).toBe(
      'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
    );
  });

  test('empty array returns null (no candidate)', () => {
    const result = pickFirstGrailFromEnvelope('mcp__codex__search_codex', []);
    expect(result).toBeNull();
  });

  test('non-grail top-1 + grail-with-image second hit returns the grail (scan-all)', () => {
    // The actual scenario operator hit: search_codex returns a core-lore
    // hit at top-1 (no image), grail at index 1. Old top-1-only behavior
    // returned null; new scan-all walks until a hit with image surfaces.
    const parsed = [
      {
        ref: 'snippet-42',
        type: 'core-lore',
        name: 'underworld iconography',
        score: 0.88,
        collection: 'mibera',
        file: 'lore/underworld.md',
      },
      {
        ref: '@g876',
        type: 'grail',
        name: 'Black Hole',
        score: 0.83,
        collection: 'mibera',
        file: 'grails/black-hole.md',
        image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
      },
    ];

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__search_codex',
      parsed,
    );

    expect(result).not.toBeNull();
    expect(result!.ref).toBe('@g876');
    expect(result!.image).toBe(
      'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
    );
  });

  test('all hits non-grail (no image fields) returns null gracefully', () => {
    const parsed = [
      {
        ref: 'snippet-42',
        type: 'core-lore',
        name: 'underworld iconography',
        score: 0.88,
        collection: 'mibera',
        file: 'lore/underworld.md',
      },
      {
        ref: 'snippet-43',
        type: 'core-lore',
        name: 'death imagery',
        score: 0.86,
        collection: 'mibera',
        file: 'lore/death.md',
      },
    ];

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__search_codex',
      parsed,
    );

    expect(result).toBeNull();
  });

  test('image_url field works as alt key from search_codex', () => {
    const parsed = [
      {
        ref: '@g4488',
        type: 'grail',
        name: 'Satoshi-as-Hermes',
        score: 0.91,
        collection: 'mibera',
        file: 'grails/satoshi-as-hermes.md',
        image_url: 'https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.png',
      },
    ];

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__search_codex',
      parsed,
    );

    expect(result).not.toBeNull();
    expect(result!.image_url).toBe(
      'https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.png',
    );
  });

  test('legacy {results: [...]} envelope shape returns null (now wrong)', () => {
    // Defensive: if some upstream still returns the old wrapper shape, we
    // detect it as non-array and return null. The OLD code expected this
    // shape — this test documents the shape change.
    const parsed = {
      results: [
        {
          ref: '@g876',
          type: 'grail',
          name: 'Black Hole',
          image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
        },
      ],
    };

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__search_codex',
      parsed,
    );

    expect(result).toBeNull();
  });
});

describe('pickFirstGrailFromEnvelope · lookup_grail regression (V0.7-A.3 hotfix B1)', () => {
  test('flat envelope with image still works', () => {
    const parsed = {
      id: 876,
      ref: '@g876',
      name: 'Black Hole',
      image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
      description: 'concept grail',
    };

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__lookup_grail',
      parsed,
    );

    expect(result).not.toBeNull();
    expect(result!.ref).toBe('@g876');
    expect(result!.image).toBe(
      'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
    );
  });

  test('nested {result: {...}} envelope works', () => {
    const parsed = {
      result: {
        ref: '@g876',
        name: 'Black Hole',
        image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
      },
    };

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__lookup_grail',
      parsed,
    );

    expect(result).not.toBeNull();
    expect(result!.ref).toBe('@g876');
  });

  test('lookup_grail with no image returns null', () => {
    const parsed = {
      ref: '@g4221',
      name: 'Past',
      description: 'concept grail',
    };

    const result = pickFirstGrailFromEnvelope(
      'mcp__codex__lookup_grail',
      parsed,
    );

    expect(result).toBeNull();
  });
});

describe('pickFirstGrailFromEnvelope · null safety', () => {
  test('null parsed returns null', () => {
    expect(pickFirstGrailFromEnvelope('mcp__codex__lookup_grail', null)).toBeNull();
  });

  test('undefined parsed returns null', () => {
    expect(
      pickFirstGrailFromEnvelope('mcp__codex__lookup_grail', undefined),
    ).toBeNull();
  });

  test('string parsed returns null', () => {
    expect(
      pickFirstGrailFromEnvelope('mcp__codex__lookup_grail', 'not an object'),
    ).toBeNull();
  });
});
