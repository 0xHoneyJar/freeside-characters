/**
 * orderAttachmentsByCitation tests · CMP-boundary 2026-05-04 finding 3.
 *
 * Verifies that grail candidates are sorted by their first-citation position
 * in voice text BEFORE composeWithImage attaches. With default maxAttachments=1,
 * candidates[0] wins · ordering matters or the user sees image-text mismatch.
 *
 * Operator dogfood evidence (2026-05-03 6:14PM PT):
 *   prompt: /satoshi prompt:"the dark grail"
 *   search_codex returned: [Fire 0.88, Black Hole 0.92]
 *   voice text cited: Black Hole (@g876)
 *   wrong outcome (pre-fix): Fire image attached (candidates[0] = Fire)
 *   fix: orderAttachmentsByCitation moves Black Hole to slot[0] because
 *        @g876 appears before @g6458 in the voice text (only @g876 cited).
 *
 * Per [[chat-medium-presentation-boundary]] doctrine: substrate-correct
 * candidate retrieval (search_codex by relevance) needs presentation-time
 * reordering to align with what the LLM actually voiced.
 */

import { describe, test, expect } from 'bun:test';
import { orderAttachmentsByCitation } from './reply.ts';
import type { CodexGrailResult } from '../deliver/embed-with-image.ts';

const FIRE: CodexGrailResult = {
  ref: '@g6458',
  name: 'Fire',
  image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/fire.webp',
};
const BLACK_HOLE: CodexGrailResult = {
  ref: '@g876',
  name: 'Black Hole',
  image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.webp',
};
const HERMES: CodexGrailResult = {
  ref: '@g4488',
  name: 'Satoshi-as-Hermes',
  image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/satoshi-as-hermes.webp',
};
const SCORPIO: CodexGrailResult = {
  ref: '@g235',
  name: 'Scorpio',
  image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/scorpio.webp',
};

describe('orderAttachmentsByCitation · the operator-dogfood bug case', () => {
  test('voice cites only @g876 · candidates [Fire, Black Hole] reorder to [Black Hole, Fire]', () => {
    // EXACT REPRODUCTION of the 2026-05-03 6:14PM PT operator dogfood:
    // search_codex returned [Fire 0.88, Black Hole 0.92] (Fire first by
    // relevance order). Voice text cited only Black Hole. Pre-fix: Fire
    // image attached. Post-fix: Black Hole image attached.
    const voiceText =
      'no "dark" grail straight up, but closest read is Black Hole (@g876) — concept-tier, mibera drawn inside the void, whole piece evokes uncertainty.';
    const candidates = [FIRE, BLACK_HOLE];
    const ordered = orderAttachmentsByCitation(voiceText, candidates);
    expect(ordered.map((c) => c.ref)).toEqual(['@g876', '@g6458']);
    expect(ordered[0]).toBe(BLACK_HOLE); // Black Hole moved to slot[0]
    expect(ordered[1]).toBe(FIRE); // Fire moved to slot[1] (uncited · preserves relative order)
  });
});

describe('orderAttachmentsByCitation · single candidate', () => {
  test('single candidate cited in text returned as-is', () => {
    const text = 'Black Hole @g876 is the void.';
    const result = orderAttachmentsByCitation(text, [BLACK_HOLE]);
    expect(result).toEqual([BLACK_HOLE]);
  });

  test('single candidate uncited still returned as-is', () => {
    const text = 'no grail refs in this text';
    const result = orderAttachmentsByCitation(text, [BLACK_HOLE]);
    expect(result).toEqual([BLACK_HOLE]);
  });
});

describe('orderAttachmentsByCitation · multiple candidates · in-order citations', () => {
  test('two candidates cited in input order returns input order', () => {
    const text = 'compare @g876 with @g6458';
    const result = orderAttachmentsByCitation(text, [BLACK_HOLE, FIRE]);
    expect(result).toEqual([BLACK_HOLE, FIRE]);
  });

  test('three candidates all cited in input order', () => {
    const text = '@g4488 then @g876 then @g235';
    const result = orderAttachmentsByCitation(text, [HERMES, BLACK_HOLE, SCORPIO]);
    expect(result.map((c) => c.ref)).toEqual(['@g4488', '@g876', '@g235']);
  });
});

describe('orderAttachmentsByCitation · multiple candidates · reverse-citation order', () => {
  test('three candidates cited in reverse order returns reversed', () => {
    const text = '@g235 first then @g876 then @g4488';
    const result = orderAttachmentsByCitation(text, [HERMES, BLACK_HOLE, SCORPIO]);
    expect(result.map((c) => c.ref)).toEqual(['@g235', '@g876', '@g4488']);
  });
});

describe('orderAttachmentsByCitation · uncited candidates go last', () => {
  test('one cited + one uncited · cited goes first', () => {
    const text = 'just @g876 here';
    const result = orderAttachmentsByCitation(text, [FIRE, BLACK_HOLE]);
    expect(result.map((c) => c.ref)).toEqual(['@g876', '@g6458']);
  });

  test('two uncited preserve relative input order (stable sort)', () => {
    const text = 'no refs at all';
    const result = orderAttachmentsByCitation(text, [FIRE, BLACK_HOLE, SCORPIO]);
    expect(result.map((c) => c.ref)).toEqual(['@g6458', '@g876', '@g235']);
  });

  test('cited-uncited-cited input · cited move to front in citation order', () => {
    const text = '@g876 referenced and @g235 too';
    const result = orderAttachmentsByCitation(text, [HERMES, SCORPIO, FIRE, BLACK_HOLE]);
    // BLACK_HOLE first (cited at pos 0), SCORPIO second (cited later), then uncited HERMES + FIRE in input order
    expect(result.map((c) => c.ref)).toEqual(['@g876', '@g235', '@g4488', '@g6458']);
  });
});

describe('orderAttachmentsByCitation · digit-prefix collision (bridgebuilder PR #29 MED)', () => {
  test('@g876 candidate is UNCITED when text only contains @g8761 (longer id with same prefix)', () => {
    // Bridgebuilder finding `ref-substring-collision`: bare `text.indexOf('@g876')`
    // would match position 12 inside '@g8761' (same prefix). Negative-lookahead
    // `@g876(?!\d)` correctly says "not cited" because the next char IS a digit.
    const G8761: CodexGrailResult = {
      ref: '@g8761',
      name: 'Some Long-Id Grail',
      image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/some-long.webp',
    };
    const text = 'voice cites @g8761 only';
    const result = orderAttachmentsByCitation(text, [BLACK_HOLE, G8761]);
    // G8761 cited at pos 12 → first · BLACK_HOLE uncited → second
    // (pre-fix would put BLACK_HOLE first because indexOf('@g876') = 12 ties G8761
    // and stable-sort preserves input order [BLACK_HOLE, G8761])
    expect(result.map((c) => c.ref)).toEqual(['@g8761', '@g876']);
  });

  test('both prefix-overlapping refs cited · each matches its own occurrence', () => {
    const G8761: CodexGrailResult = {
      ref: '@g8761',
      name: 'Long-Id',
      image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/x.webp',
    };
    // text cites @g876 at pos 5, @g8761 at pos 18
    const text = 'cite @g876 then @g8761 too';
    const result = orderAttachmentsByCitation(text, [G8761, BLACK_HOLE]);
    // BLACK_HOLE first (cited earlier at pos 5) · G8761 second (pos 18)
    expect(result.map((c) => c.ref)).toEqual(['@g876', '@g8761']);
  });
});

describe('orderAttachmentsByCitation · edge cases', () => {
  test('empty candidates returns empty array', () => {
    const result = orderAttachmentsByCitation('any text', []);
    expect(result).toEqual([]);
  });

  test('candidate with no ref field goes to end', () => {
    const noRef: CodexGrailResult = {
      name: 'Some Grail',
      image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/x.webp',
    };
    const text = 'cite @g876 here';
    const result = orderAttachmentsByCitation(text, [noRef, BLACK_HOLE]);
    expect(result.map((c) => c.name)).toEqual(['Black Hole', 'Some Grail']);
  });

  test('does not mutate input array', () => {
    const text = '@g876 first';
    const input = [FIRE, BLACK_HOLE];
    orderAttachmentsByCitation(text, input);
    expect(input.map((c) => c.ref)).toEqual(['@g6458', '@g876']); // input unchanged
  });

  test('same ref repeated in text · uses first occurrence', () => {
    const text = '@g6458 and @g876 and @g876 again';
    const result = orderAttachmentsByCitation(text, [BLACK_HOLE, FIRE]);
    // Fire @ pos 0, Black Hole @ pos 11
    expect(result.map((c) => c.ref)).toEqual(['@g6458', '@g876']);
  });
});
