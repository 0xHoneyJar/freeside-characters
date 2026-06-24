/**
 * grail-ref-guard tests · V0.7-A.3 sprint Task 1.9 + bridgebuilder F1/F4
 * triage 2026-05-02.
 *
 * Verifies:
 *   - canonical refs (`@g876`) are recognized as valid
 *   - unknown refs (`@g99999`) flagged as invalid
 *   - F1: bare `#<id>` form is no longer recognized (issue-ref noise)
 *   - text with no refs returns empty lists
 *   - sessionRefs override allows per-session-canonical refs
 *   - F4: inspectGrailRefs returns text UNCHANGED + validation (no footer)
 */

import { describe, test, expect } from 'bun:test';
import {
  inspectGrailRefs,
  validateGrailRefs,
} from './grail-ref-guard.ts';

describe('validateGrailRefs · canonical refs', () => {
  test('canonical @g876 returns valid singleton', () => {
    const result = validateGrailRefs('see @g876 black hole');
    expect(result.valid).toEqual(['@g876']);
    expect(result.invalid).toEqual([]);
  });

  test('canonical @g4488 (Hermes) returns valid', () => {
    const result = validateGrailRefs('hermes is @g4488');
    expect(result.valid).toEqual(['@g4488']);
    expect(result.invalid).toEqual([]);
  });
});

describe('validateGrailRefs · unknown refs', () => {
  test('unknown @g99999 flagged as invalid', () => {
    const result = validateGrailRefs('see @g99999 fake grail');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['@g99999']);
  });

  test('unknown @g123 flagged as invalid', () => {
    const result = validateGrailRefs('@g123 unknown');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['@g123']);
  });
});

describe('validateGrailRefs · mixed refs', () => {
  test('canonical + unknown @g refs partition correctly', () => {
    const result = validateGrailRefs(
      'compare @g876 with @g99999 and @g4488',
    );
    expect(result.valid).toContain('@g876');
    expect(result.valid).toContain('@g4488');
    expect(result.invalid).toContain('@g99999');
    expect(result.valid.length).toBe(2);
    expect(result.invalid.length).toBe(1);
  });

  test('duplicate refs deduped within shape', () => {
    const result = validateGrailRefs(
      '@g876 first and @g876 again',
    );
    expect(result.valid).toEqual(['@g876']);
  });
});

describe('validateGrailRefs · F1 — `#<id>` form ignored', () => {
  // Bridgebuilder F1 (2026-05-02): the bare `#<id>` shape was overly broad
  // and false-positived on issue refs (`#123`), markdown anchors, and
  // ordinal lists. Only `@g<id>` is recognized — `@g` is the disambiguator.
  test('bare #876 is ignored (issue-ref / channel-mention shape)', () => {
    const result = validateGrailRefs('see #876 fixed in PR #4488');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  test('@g876 IS recognized when present alongside ignored #876', () => {
    const result = validateGrailRefs('@g876 vs #876');
    expect(result.valid).toEqual(['@g876']);
    expect(result.invalid).toEqual([]);
  });

  test('plain issue ref like "#123" never reaches validation buckets', () => {
    const result = validateGrailRefs('this fixes #123 and refs #4488');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});

describe('validateGrailRefs · no-ref text', () => {
  test('plain text returns empty validation', () => {
    const result = validateGrailRefs('the chain has held.');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  test('empty string returns empty validation', () => {
    const result = validateGrailRefs('');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});

describe('validateGrailRefs · sessionRefs override', () => {
  test('sessionRefs allows non-canonical id', () => {
    const result = validateGrailRefs('see @g99999', ['@g99999']);
    expect(result.valid).toEqual(['@g99999']);
    expect(result.invalid).toEqual([]);
  });

  test('sessionRefs work with bare-id form', () => {
    const result = validateGrailRefs('see @g7777', ['7777']);
    expect(result.valid).toEqual(['@g7777']);
    expect(result.invalid).toEqual([]);
  });

  test('sessionRefs and canonical compose', () => {
    const result = validateGrailRefs(
      '@g876 and @g7777 and @g99999',
      ['@g7777'],
    );
    expect(result.valid).toContain('@g876');
    expect(result.valid).toContain('@g7777');
    expect(result.invalid).toEqual(['@g99999']);
  });
});

describe('inspectGrailRefs · F4 — telemetry, not user-visible footer', () => {
  // Bridgebuilder F4 (2026-05-02): the previous `appendGrailRefGuardFooter`
  // appended an engineering-jargon footer to user-facing Discord text.
  // V1 contract is now: text returned UNCHANGED, validation is operator-
  // only telemetry. Asserts the footer is gone in all branches.

  test('text is unchanged when invalid refs surfaced — telemetry only', () => {
    const original = 'see @g99999';
    const result = inspectGrailRefs(original);
    expect(result.text).toBe(original);
    expect(result.text).not.toContain('KEEPER');
    expect(result.text).not.toContain('unverified');
    expect(result.text).not.toContain('corpus signal');
    expect(result.validation.invalid).toEqual(['@g99999']);
  });

  test('text unchanged when all refs canonical', () => {
    const original = 'see @g876 and @g4488';
    const result = inspectGrailRefs(original);
    expect(result.text).toBe(original);
    expect(result.validation.invalid).toEqual([]);
  });

  test('text unchanged when no refs at all', () => {
    const original = 'the chain has held.';
    const result = inspectGrailRefs(original);
    expect(result.text).toBe(original);
    expect(result.validation.valid).toEqual([]);
    expect(result.validation.invalid).toEqual([]);
  });

  test('sessionRefs override surfaces in validation, text still unchanged', () => {
    const original = 'see @g7777';
    const result = inspectGrailRefs(original, ['7777']);
    expect(result.text).toBe(original);
    expect(result.validation.valid).toEqual(['@g7777']);
    expect(result.validation.invalid).toEqual([]);
  });
});
