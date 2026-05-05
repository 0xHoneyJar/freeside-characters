/**
 * sanitize.test.ts — voice-discipline transforms (cmp-boundary §9 · cycle R S1).
 *
 * Verifies stripVoiceDisciplineDrift handles em-dash, en-dash, asterisk
 * roleplay, and closing signoffs while preserving:
 *   - code blocks (triple-backtick fences AND inline backticks)
 *   - bold formatting (**...**)
 *   - satoshi's performed-silence pattern (full-sentence italics with periods)
 *   - digest-type closings (digest is the only post-type that retains them)
 *
 * Refs:
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   ~/vault/wiki/concepts/discord-native-register.md (2026-05-04 amend)
 */

import { describe, test, expect } from 'bun:test';
import {
  stripVoiceDisciplineDrift,
  escapeDiscordMarkdown,
} from './sanitize.ts';

describe('stripVoiceDisciplineDrift · em-dash transform', () => {
  test('em-dash followed by lowercase becomes comma + space', () => {
    const input = 'the bear — laid-back';
    expect(stripVoiceDisciplineDrift(input)).toBe('the bear, laid-back');
  });

  test('em-dash followed by uppercase becomes period + space', () => {
    const input = 'the bear was here — Then it left';
    expect(stripVoiceDisciplineDrift(input)).toBe(
      'the bear was here. Then it left',
    );
  });

  test('em-dash with no surrounding spaces collapses to comma', () => {
    const input = 'mibera-dimensions—activity';
    expect(stripVoiceDisciplineDrift(input)).toBe(
      'mibera-dimensions, activity',
    );
  });

  test('multiple em-dashes in same sentence all transformed', () => {
    const input = 'one — two — three — four';
    expect(stripVoiceDisciplineDrift(input)).toBe('one, two, three, four');
  });

  test('em-dash at end of text drops cleanly', () => {
    const input = 'final word — ';
    expect(stripVoiceDisciplineDrift(input)).toBe('final word');
  });
});

describe('stripVoiceDisciplineDrift · en-dash transform', () => {
  test('en-dash receives same treatment as em-dash', () => {
    const input = 'the bear – laid-back';
    expect(stripVoiceDisciplineDrift(input)).toBe('the bear, laid-back');
  });

  test('en-dash followed by uppercase → period', () => {
    const input = 'observed – Then noted';
    expect(stripVoiceDisciplineDrift(input)).toBe('observed. Then noted');
  });
});

describe('stripVoiceDisciplineDrift · asterisk roleplay strip', () => {
  test('short stage direction stripped', () => {
    const input = 'ruggy says *adjusts cabling* hi';
    expect(stripVoiceDisciplineDrift(input)).toBe('ruggy says hi');
  });

  test('multiple stage directions all stripped', () => {
    const input = '*adjusts ledger* and *peeks at chain* observed';
    expect(stripVoiceDisciplineDrift(input)).toBe('and observed');
  });

  test('PRESERVES satoshi performed-silence (full sentence with period)', () => {
    const input =
      '*satoshi observes the room and shakes his head. nothing of note to report.*';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });

  test('PRESERVES bold (**bold**) — adjacent-asterisk guard', () => {
    const input = '**important** observation **here**';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });

  test('PRESERVES italic with uppercase first char (emphasis, not roleplay)', () => {
    const input = 'see *Important* for context';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · closing-signoff strip', () => {
  test('non-digest strips trailing "stay groovy 🐻"', () => {
    const input = 'the chain has held.\nstay groovy 🐻';
    expect(stripVoiceDisciplineDrift(input)).toBe('the chain has held.');
  });

  test('digest preserves trailing closing', () => {
    const input = 'the chain has held.\nstay groovy 🐻';
    expect(stripVoiceDisciplineDrift(input, { postType: 'digest' })).toBe(
      input,
    );
  });

  test('strips bare "stay groovy" (no emoji)', () => {
    const input = 'observation made.\nstay groovy';
    expect(stripVoiceDisciplineDrift(input)).toBe('observation made.');
  });

  test('strips "stay frosty" (satoshi-region closing)', () => {
    const input = 'the ledger holds.\nstay frosty';
    expect(stripVoiceDisciplineDrift(input)).toBe('the ledger holds.');
  });

  test('preserves "stay groovy" mid-text (only end-of-text strip)', () => {
    const input = 'when ruggy says stay groovy he means it';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · code-block preservation', () => {
  test('em-dash inside triple-backtick fence preserved', () => {
    const input = ['voice line.', '```', 'code — em-dash here', '```', 'more.'].join(
      '\n',
    );
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('code — em-dash here');
    expect(result).toContain('voice line.');
    expect(result).toContain('more.');
  });

  test('em-dash inside inline backticks preserved', () => {
    const input = 'use `mibera—id` as identifier — never as prose dash';
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('`mibera—id`');
    // outside-backtick em-dash transformed
    expect(result).toContain('identifier, never');
  });

  test('asterisk inside backticks preserved', () => {
    const input = 'glob pattern `*.test.ts` — useful';
    const result = stripVoiceDisciplineDrift(input);
    expect(result).toContain('`*.test.ts`');
  });
});

describe('stripVoiceDisciplineDrift · idempotency', () => {
  test('running twice produces same output as running once', () => {
    const input =
      'the bear — laid-back — *adjusts cabling* — observed.\nstay groovy 🐻';
    const once = stripVoiceDisciplineDrift(input);
    const twice = stripVoiceDisciplineDrift(once);
    expect(twice).toBe(once);
  });

  test('clean input returns unchanged', () => {
    const input = 'the chain has held. mibera_acquire lifted heavy.';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('stripVoiceDisciplineDrift · edge cases', () => {
  test('empty string returns empty', () => {
    expect(stripVoiceDisciplineDrift('')).toBe('');
  });

  test('whitespace-only returns whitespace-stripped', () => {
    expect(stripVoiceDisciplineDrift('   ')).toBe('');
  });

  test('no transforms needed → identical output', () => {
    const input = 'plain prose without any drift markers.';
    expect(stripVoiceDisciplineDrift(input)).toBe(input);
  });
});

describe('escapeDiscordMarkdown · regression smoke (existing function)', () => {
  test('underscores escaped outside backticks', () => {
    expect(escapeDiscordMarkdown('mibera_acquire')).toBe('mibera\\_acquire');
  });

  test('content inside backticks preserved', () => {
    expect(escapeDiscordMarkdown('use `mibera_acquire` here')).toBe(
      'use `mibera_acquire` here',
    );
  });

  test('custom emoji preserved', () => {
    expect(escapeDiscordMarkdown('hello <:ruggy_grin:12345>')).toBe(
      'hello <:ruggy_grin:12345>',
    );
  });
});

describe('stripVoiceDisciplineDrift · composition with escapeDiscordMarkdown', () => {
  test('voice-discipline runs before markdown escape (canonical order)', () => {
    const input = 'mibera_acquire — heavy lifting today';
    // step 1: voice discipline replaces em-dash
    const voice = stripVoiceDisciplineDrift(input);
    expect(voice).toBe('mibera_acquire, heavy lifting today');
    // step 2: markdown escape preserves the comma, escapes underscore
    const final = escapeDiscordMarkdown(voice);
    expect(final).toBe('mibera\\_acquire, heavy lifting today');
  });
});
