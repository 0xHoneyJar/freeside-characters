/**
 * stripAttachedImageUrls tests · V0.7-A.3 HOTFIX B2a.
 *
 * Verifies the composer-side belt-and-braces stripper that removes URLs
 * from voice text when the corresponding image bytes are already attached
 * to the Discord webhook payload (env-aware composition contract). LLM
 * voice prose tends to paste the URL it saw in the tool envelope; Discord
 * automod still triggers on inline URL even when bytes are attached →
 * message disappears. B2a removes the URL from text before send.
 */

import { describe, test, expect } from 'bun:test';
import { stripAttachedImageUrls, extractAttachedUrls } from './strip-image-urls.ts';

const URL_BLACK_HOLE =
  'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png';
const URL_HERMES =
  'https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.png';

describe('stripAttachedImageUrls · plain URL paste', () => {
  test('plain URL inline removed cleanly', () => {
    const text = `the dark grail is ${URL_BLACK_HOLE} — the void pulls back.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('the dark grail is — the void pulls back.');
    expect(result).not.toContain(URL_BLACK_HOLE);
  });

  test('plain URL at start of text removed', () => {
    const text = `${URL_BLACK_HOLE} is what you asked for.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('is what you asked for.');
  });

  test('plain URL at end of text removed', () => {
    const text = `the void: ${URL_BLACK_HOLE}`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('the void:');
  });
});

describe('stripAttachedImageUrls · markdown image', () => {
  test('markdown image with alt text removed entirely', () => {
    const text = `![Black Hole](${URL_BLACK_HOLE}) — the absence pulls.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('— the absence pulls.');
  });

  test('markdown image with empty alt removed', () => {
    const text = `![](${URL_BLACK_HOLE}) gaze into it.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('gaze into it.');
  });

  test('markdown image embedded mid-paragraph removed', () => {
    const text = `here it is: ![Black Hole](${URL_BLACK_HOLE}) and that's the grail.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe(`here it is: and that's the grail.`);
  });
});

describe('stripAttachedImageUrls · markdown link (V0.7-A.3 polish F3)', () => {
  test('markdown link with text PRESERVES link text as plain prose', () => {
    // F3 fix: link text is part of voice prose ("the void" is the noun
    // phrase the LLM wrote into the sentence). Earlier behavior dropped
    // it entirely, leaving "is the dark grail" — broken sentence.
    const text = `[the void](${URL_BLACK_HOLE}) is the dark grail.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('the void is the dark grail.');
  });

  test('markdown link inside sentence preserves link text inline', () => {
    const text = `that's [Black Hole](${URL_BLACK_HOLE}) right there.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe(`that's Black Hole right there.`);
  });

  test('image-then-link nested in same paragraph: image gone, link text preserved', () => {
    // Edge case: LLM emits both forms in same paragraph. Image alt is
    // invisible (drop entirely). Link text is visible (preserve as prose).
    const text = `![](${URL_HERMES})\n[the way](${URL_BLACK_HOLE})`;
    const result = stripAttachedImageUrls(text, [URL_HERMES, URL_BLACK_HOLE]);
    // Image removed → leading newline trimmed. Link text "the way" survives.
    expect(result).toContain('the way');
    expect(result).not.toContain(URL_HERMES);
    expect(result).not.toContain(URL_BLACK_HOLE);
    expect(result).not.toContain('![');
  });
});

describe('stripAttachedImageUrls · preservation rules', () => {
  test('URL not in attachedUrls list is preserved', () => {
    const text = `here's ${URL_BLACK_HOLE} and also ${URL_HERMES}.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toContain(URL_HERMES);
    expect(result).not.toContain(URL_BLACK_HOLE);
  });

  test('empty attachedUrls returns text unchanged (no-op)', () => {
    const text = `here's ${URL_BLACK_HOLE} inline.`;
    const result = stripAttachedImageUrls(text, []);
    expect(result).toBe(text);
  });

  test('empty text returns empty (no-op)', () => {
    const result = stripAttachedImageUrls('', [URL_BLACK_HOLE]);
    expect(result).toBe('');
  });

  test('text without any URL returns text unchanged', () => {
    const text = 'no urls here just voice prose.';
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe(text);
  });
});

describe('stripAttachedImageUrls · multi-paragraph + structure preservation', () => {
  test('multi-paragraph text with URL in middle preserves paragraph breaks', () => {
    const text = [
      'first paragraph with the citation.',
      '',
      `second paragraph: ${URL_BLACK_HOLE} the void pulls back.`,
      '',
      'third paragraph closes.',
    ].join('\n');

    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);

    expect(result).not.toContain(URL_BLACK_HOLE);
    expect(result).toContain('first paragraph');
    expect(result).toContain('second paragraph');
    expect(result).toContain('third paragraph closes');
    // Paragraph breaks (\n\n) still present
    expect(result.split('\n\n').length).toBeGreaterThanOrEqual(3);
  });

  test('multiple URL forms in same text all removed', () => {
    const text = [
      `the grail: ${URL_BLACK_HOLE}`,
      ``,
      `or in markdown: ![Black Hole](${URL_BLACK_HOLE})`,
      ``,
      `or as link: [void](${URL_BLACK_HOLE})`,
    ].join('\n');

    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);

    expect(result).not.toContain(URL_BLACK_HOLE);
    expect(result).not.toContain('![');
    expect(result).not.toContain('](');
  });
});

describe('stripAttachedImageUrls · whitespace cleanup', () => {
  test('orphan comma after removed URL collapsed', () => {
    const text = `see ${URL_BLACK_HOLE}, the void.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    expect(result).toBe('see, the void.');
  });

  test('triple newlines collapsed to double', () => {
    const text = `before\n\n\n${URL_BLACK_HOLE}\n\n\nafter`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    // Only paragraph breaks survive (max two consecutive newlines)
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  test('multiple consecutive spaces from URL removal collapsed', () => {
    const text = `prefix ${URL_BLACK_HOLE} suffix.`;
    const result = stripAttachedImageUrls(text, [URL_BLACK_HOLE]);
    // No double spaces
    expect(result).not.toMatch(/  +/);
    expect(result).toBe('prefix suffix.');
  });
});

describe('extractAttachedUrls', () => {
  test('extracts image field from candidates', () => {
    const result = extractAttachedUrls([
      { image: URL_BLACK_HOLE, image_url: undefined },
      { image: URL_HERMES, image_url: undefined },
    ]);
    expect(result).toEqual([URL_BLACK_HOLE, URL_HERMES]);
  });

  test('falls back to image_url when image absent', () => {
    const result = extractAttachedUrls([
      { image_url: URL_HERMES },
    ]);
    expect(result).toEqual([URL_HERMES]);
  });

  test('skips candidates with no URL field', () => {
    const result = extractAttachedUrls([
      { image: URL_BLACK_HOLE },
      {},
      { image: URL_HERMES },
    ]);
    expect(result).toEqual([URL_BLACK_HOLE, URL_HERMES]);
  });

  test('empty array returns empty', () => {
    expect(extractAttachedUrls([])).toEqual([]);
  });
});
