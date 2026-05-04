/**
 * translateEmojiShortcodes tests · CMP-boundary 2026-05-04 finding 5.
 *
 * Verifies that raw `:name:` emoji shortcodes are translated into Discord
 * render format `<:name:id>` (or `<a:name:id>` for animated entries).
 *
 * Operator dogfood evidence (2026-05-04 8:36 PT):
 *   prompt: /ruggy "what's xabbu's score"
 *   reply ended with: ":ruggy_salute:"  ← rendered as plain text
 *   expected: animated/static custom emoji rendered inline
 *
 * Per [[chat-medium-presentation-boundary]] doctrine: substrate-correct
 * shortcode form (which the LLM emits per persona convention) needs
 * presentation-time translation to Discord render shape, plus silent
 * drop of hallucinated custom-prefix shortcodes (ruggy_salute is NOT
 * in the registry · operator's screenshot proves the leak).
 */

import { describe, test, expect } from 'bun:test';
import { translateEmojiShortcodes } from './reply.ts';

describe('translateEmojiShortcodes · happy path (real registry entries)', () => {
  test('static emoji ruggy_cheers translates to <:name:id> form', () => {
    // ruggy_cheers is in registry · static (no `a` prefix)
    const out = translateEmojiShortcodes('chill vibes :ruggy_cheers:');
    expect(out).toMatch(/^chill vibes <:ruggy_cheers:\d+>$/);
  });

  test('animated emoji ruggy_dab translates to <a:name:id> form', () => {
    // ruggy_dab is animated:true · must use <a: prefix
    const out = translateEmojiShortcodes('we ate :ruggy_dab:');
    expect(out).toMatch(/^we ate <a:ruggy_dab:\d+>$/);
  });

  test('multiple emoji in same text all translate', () => {
    const out = translateEmojiShortcodes(':ruggy_cheers: and :ruggy_dab:');
    expect(out).toMatch(/^<:ruggy_cheers:\d+> and <a:ruggy_dab:\d+>$/);
  });
});

describe('translateEmojiShortcodes · the operator-dogfood hallucination case', () => {
  test('ruggy_salute (NOT in registry) is silently dropped', () => {
    // EXACT REPRODUCTION of operator dogfood 2026-05-04 8:36 PT screenshot.
    // ruggy_salute is hallucinated · not in the 17-entry ruggy registry.
    // Pre-fix: rendered as plain ":ruggy_salute:" text in Discord.
    // Post-fix: silently dropped so the hallucination doesn't leak.
    const out = translateEmojiShortcodes('dude\'s on the map :ruggy_salute:');
    expect(out).toBe('dude\'s on the map');
  });

  test('hallucinated nani_X (matches known nani_ prefix from registry) is silently dropped', () => {
    // nani_ IS a known prefix per derived KNOWN_EMOJI_PREFIXES (the lone
    // mibera entry uses `nani_` shape · registry data drives the predicate).
    const out = translateEmojiShortcodes('honey moment :nani_fake: yes');
    expect(out).toBe('honey moment yes');
  });

  test('legitimate non-emoji underscore shortcode passes through (F1 MED fix)', () => {
    // Bridgebuilder PR #32 pass-2 MED `F1-underscore-heuristic-false-positives`:
    // technical jargon like `:my_var:` or `:file_path:` does NOT match any
    // known emoji prefix (ruggy_, nani_) so it passes through unchanged.
    // The previous underscore-heuristic would have dropped these · registry-
    // derived prefixes bound the false-positive surface.
    expect(translateEmojiShortcodes('see :my_var: in code')).toBe('see :my_var: in code');
    expect(translateEmojiShortcodes('the :file_path: matters')).toBe('the :file_path: matters');
  });
});

describe('translateEmojiShortcodes · non-custom shortcodes left alone', () => {
  test('time-shaped string :30: not translated (digit start)', () => {
    // Regex requires alpha first character, so :30: does not match
    expect(translateEmojiShortcodes('meeting at 12:30:00 sharp')).toBe(
      'meeting at 12:30:00 sharp',
    );
  });

  test('non-custom prefix shortcode left alone (not ruggy_/mibera_)', () => {
    // :hello: is shortcode-shaped but doesn't have a custom emoji prefix
    // so we leave it alone (avoids breaking ascii art / random colon-pairs)
    expect(translateEmojiShortcodes('say :hello: there')).toBe('say :hello: there');
  });

  test('plain text with no shortcodes is unchanged', () => {
    const text = 'just a chat message with no emojis at all';
    expect(translateEmojiShortcodes(text)).toBe(text);
  });

  test('shortcode-like with uppercase first letter (Ruggy_smoke) treated as hallucination · dropped', () => {
    // Custom emoji names are conventionally lowercase. Uppercase variant
    // doesn't match findByName · contains underscore so the underscore-
    // heuristic drops it as a custom-prefix-shaped hallucination
    // (per bridgebuilder PR #32 MED F2 fix).
    expect(translateEmojiShortcodes(':Ruggy_smoke:')).toBe('');
  });
});

describe('translateEmojiShortcodes · bare <:ID> repair (issue #35)', () => {
  // Operator dogfood 2026-05-04 9:39 AM PT · ruggy webhook in El Capitan thread
  // emitted `<:1138775429482819645>` (one colon · ID-only · missing :name:).
  // Discord's canonical form is `<:NAME:ID>` so the malformed token rendered
  // as raw text. Pass-1 of translateEmojiShortcodes now repairs ID-only tokens
  // by registry lookup; valid tokens emitted by pass-1 must NOT be re-corrupted
  // by pass-2's :name: regex (negative lookbehind handles this).

  test('bare <:ID> for static emoji is repaired to <:name:id>', () => {
    // ruggy ID 1138775429482819645 · the exact operator-dogfood case
    const out = translateEmojiShortcodes('text <:1138775429482819645> tail');
    expect(out).toBe('text <:ruggy:1138775429482819645> tail');
  });

  test('bare <a:ID> for animated emoji is repaired to <a:name:id>', () => {
    // ruggy_dab ID 1142035114008772608 · animated:true
    const out = translateEmojiShortcodes('we ate <a:1142035114008772608>');
    expect(out).toBe('we ate <a:ruggy_dab:1142035114008772608>');
  });

  test('already-valid <:name:id> is preserved (lookbehind prevents re-corruption)', () => {
    const valid = '<:ruggy:1138775429482819645>';
    expect(translateEmojiShortcodes(valid)).toBe(valid);
  });

  test('already-valid <a:name:id> is preserved (lookbehind prevents re-corruption)', () => {
    const valid = '<a:ruggy_dab:1142035114008772608>';
    expect(translateEmojiShortcodes(valid)).toBe(valid);
  });

  test('unknown snowflake <:ID> falls through unchanged (not every <:NUM> is emoji)', () => {
    // 17-20 digit number not in registry · could be a Discord channel/user
    // mention quirk or other shape · do not corrupt.
    const out = translateEmojiShortcodes('mystery <:9999999999999999999>');
    expect(out).toBe('mystery <:9999999999999999999>');
  });

  test('multiple bare IDs in same text all repair', () => {
    const out = translateEmojiShortcodes(
      '<:1138775429482819645> then <a:1142035114008772608>',
    );
    expect(out).toBe(
      '<:ruggy:1138775429482819645> then <a:ruggy_dab:1142035114008772608>',
    );
  });

  test('mix of bare <:ID> and :name: forms both translate', () => {
    const out = translateEmojiShortcodes(
      '<:1138775429482819645> :ruggy_dab: done',
    );
    expect(out).toBe(
      '<:ruggy:1138775429482819645> <a:ruggy_dab:1142035114008772608> done',
    );
  });
});

describe('translateEmojiShortcodes · edge cases', () => {
  test('empty string returns empty', () => {
    expect(translateEmojiShortcodes('')).toBe('');
  });

  test('shortcode at start of text', () => {
    const out = translateEmojiShortcodes(':ruggy_cheers: opens the message');
    expect(out).toMatch(/^<:ruggy_cheers:\d+> opens the message$/);
  });

  test('shortcode at end of text', () => {
    const out = translateEmojiShortcodes('closes the message :ruggy_cheers:');
    expect(out).toMatch(/closes the message <:ruggy_cheers:\d+>$/);
  });

  test('repeated same shortcode translates each occurrence', () => {
    const out = translateEmojiShortcodes(':ruggy_cheers: and :ruggy_cheers: again');
    expect(out).toMatch(
      /^<:ruggy_cheers:\d+> and <:ruggy_cheers:\d+> again$/,
    );
  });

  test('mix of real, hallucinated, and non-custom shortcodes', () => {
    const out = translateEmojiShortcodes(
      ':ruggy_cheers: real, :ruggy_fake: gone, :hello: kept, :ruggy_dab: animated',
    );
    expect(out).toMatch(
      /^<:ruggy_cheers:\d+> real, gone, :hello: kept, <a:ruggy_dab:\d+> animated$/,
    );
  });
});
