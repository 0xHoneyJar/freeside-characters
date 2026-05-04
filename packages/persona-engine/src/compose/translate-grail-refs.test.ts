/**
 * translateGrailRefsForChat tests · CMP-boundary 2026-05-04 finding 2.
 *
 * Verifies that the chat-medium presentation translation:
 *   - replaces `@g<id>` → `Mibera #<id>` for any digit-id shape
 *   - preserves surrounding characters (parens, backticks, punctuation)
 *   - handles multiple refs in the same text
 *   - is idempotent on already-translated text
 *   - leaves non-grail-shape strings alone (e.g. handles, channel mentions)
 *
 * Per [[chat-medium-presentation-boundary]] doctrine: backend `@g<id>` is
 * load-bearing for grail-ref-guard hallucination detection · this transform
 * runs at the substrate→chat-medium boundary so the user sees NFT-style
 * display while substrate refs persist in telemetry/validation.
 */

import { describe, test, expect } from 'bun:test';
import { translateGrailRefsForChat } from './reply.ts';

describe('translateGrailRefsForChat · single ref', () => {
  test('translates bare @g<id> in mid-sentence', () => {
    expect(
      translateGrailRefsForChat('closest read is Black Hole @g876 — concept-tier'),
    ).toBe('closest read is Black Hole Mibera #876 — concept-tier');
  });

  test('preserves surrounding parentheses', () => {
    expect(
      translateGrailRefsForChat('closest read is Black Hole (@g876) — concept-tier'),
    ).toBe('closest read is Black Hole (Mibera #876) — concept-tier');
  });

  test('preserves surrounding backticks (Discord code-area styling)', () => {
    expect(
      translateGrailRefsForChat('closest read is Black Hole (`@g876`) — concept-tier'),
    ).toBe('closest read is Black Hole (`Mibera #876`) — concept-tier');
  });

  test('handles multi-digit IDs (4488)', () => {
    expect(translateGrailRefsForChat('@g4488 is Satoshi-as-Hermes')).toBe(
      'Mibera #4488 is Satoshi-as-Hermes',
    );
  });
});

describe('translateGrailRefsForChat · multiple refs', () => {
  test('translates all refs in the same text', () => {
    expect(
      translateGrailRefsForChat('compare @g876 with @g4488 and @g235'),
    ).toBe('compare Mibera #876 with Mibera #4488 and Mibera #235');
  });

  test('handles same ref repeated', () => {
    expect(translateGrailRefsForChat('@g876 then @g876 again')).toBe(
      'Mibera #876 then Mibera #876 again',
    );
  });
});

describe('translateGrailRefsForChat · idempotence', () => {
  test('already-translated text is unchanged', () => {
    const already = 'closest read is Mibera #876 — concept-tier';
    expect(translateGrailRefsForChat(already)).toBe(already);
  });

  test('text with no refs returns input unchanged', () => {
    const plain = 'just a chat message with no grail refs at all';
    expect(translateGrailRefsForChat(plain)).toBe(plain);
  });
});

describe('translateGrailRefsForChat · non-grail shapes left alone', () => {
  test('Discord channel mention (`#stonehenge` style) untouched', () => {
    expect(translateGrailRefsForChat('see #stonehenge channel')).toBe(
      'see #stonehenge channel',
    );
  });

  test('user @mention untouched', () => {
    expect(translateGrailRefsForChat('@soju asked: the dark grail')).toBe(
      '@soju asked: the dark grail',
    );
  });

  test('@g without digits untouched', () => {
    expect(translateGrailRefsForChat('@grail and @general are not grail refs')).toBe(
      '@grail and @general are not grail refs',
    );
  });

  test('digits without @g prefix untouched', () => {
    expect(translateGrailRefsForChat('PR #876 and issue #4488')).toBe(
      'PR #876 and issue #4488',
    );
  });
});

describe('translateGrailRefsForChat · empty + edge cases', () => {
  test('empty string returns empty string', () => {
    expect(translateGrailRefsForChat('')).toBe('');
  });

  test('single @g876 alone', () => {
    expect(translateGrailRefsForChat('@g876')).toBe('Mibera #876');
  });

  test('multi-line text preserves line breaks', () => {
    expect(translateGrailRefsForChat('line one @g876\nline two @g4488')).toBe(
      'line one Mibera #876\nline two Mibera #4488',
    );
  });
});
