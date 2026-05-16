/**
 * Regression tests for `translateEmojiShortcodes` — the `:name:` → `<:name:id>`
 * boundary that broke production-only on 2026-05-15 despite passing every
 * local unit test.
 *
 * The lesson encoded here: a function passing on synthetic inputs doesn't
 * mean it passes on PRODUCTION inputs. These tests use bytes EXTRACTED FROM
 * THE DISCORD-DELIVERED MESSAGE that exhibited the bug, so any future
 * regression at the same byte-level shape will fail loudly.
 *
 * Paired with: `packages/persona-engine/src/observability/chat-trace.ts` —
 * when the next mystery emerges, the trace primitive gives stage-by-stage
 * visibility; these tests verify the function-level contract.
 */

import { describe, expect, test } from 'bun:test';
import { translateEmojiShortcodes } from './reply.ts';

describe('translateEmojiShortcodes — production-shape coverage', () => {
  // Production case 1 (2026-05-15 12:50 PM PT): `:ruggy_point:` at end-of-message
  // after blockquote-formatted body. EXACT bytes pulled from Discord API.
  test('translates :ruggy_point: at end of multi-paragraph body', () => {
    const input =
      "Bear Cave's quiet on the surface but the floor's shifting underneath.\n\n" +
      '> 0 events this window · all 5 og factors cold\n' +
      '> 15 miberas entered top tier · 15 exited\n' +
      '> rank reshuffling, not new activity\n\n' +
      'scoring recalc moved everyone, twenty miberas climbed +10k positions each, ' +
      'no one in MiDi yet. one fresh hand `0xf65f...e630` jumped #11591 → #472, ' +
      'another `0xea50...f6f9` landed at #237. on the flip, `0xde42...1fd9` ' +
      'slid 533 → 10801.\n\n' +
      '🌫 Articles, Sets, Jani Keys, CFang, CubQuest, all silent. ' +
      "the rig hasn't fired this week, just the math underneath it settled.\n\n" +
      '👀 watch the entries, 15 newcomers at top tier with zero in-window events ' +
      'means lineage caught up, not new energy.\n\n' +
      ':ruggy_point:';

    const output = translateEmojiShortcodes(input);

    expect(output).toContain('<:ruggy_point:1142029237994389534>');
    // The raw shortcode MUST be gone — Discord renders raw `:name:` as text
    // (the bug). Check via regex with negative-lookbehind to ignore the
    // shortcode SUBSTRING inside the rendered token.
    const rawShortcodeRegex = /(?<!<a?):ruggy_point:(?!\d)/;
    expect(output).not.toMatch(rawShortcodeRegex);
  });

  // Production case 2 (2026-05-15 1:11 PM PT post-redeploy): same shape, fresh content.
  test('translates :ruggy_point: at end of body with rank-shift prose', () => {
    const input =
      "yeah og's been weird this week.\n\n" +
      'zero events recorded across the whole dimension, no Sets, no Articles, ' +
      'nothing logged. all five og factors went cold.\n\n' +
      '🪩 but the leaderboard reshuffled hard. 20+ miberas climbed 10k+ rank slots ' +
      'from a recalc, `0xf65f...e630` jumped #11591 → #472, `0xea50...f6f9` cracked #237.\n\n' +
      '🟢 `0xc957...78b3` arrived at og #2. fresh hand, off the map.\n\n' +
      '🚨 flip side, `0xde42...1fd9` slid #533 → #10801, the recalc cut both ways.\n\n' +
      "scoring shifted under everyone's feet. no new activity, just the math redrew " +
      'the room. :ruggy_point:';

    const output = translateEmojiShortcodes(input);

    expect(output).toContain('<:ruggy_point:1142029237994389534>');
    const rawShortcodeRegex = /(?<!<a?):ruggy_point:(?!\d)/;
    expect(output).not.toMatch(rawShortcodeRegex);
  });

  // Edge: shortcode preceded by single space (the most common LLM emission shape).
  test('translates :ruggy_point: with leading space + trailing newline', () => {
    const input = 'the math redrew the room. :ruggy_point:\n';
    const output = translateEmojiShortcodes(input);
    expect(output).toContain('<:ruggy_point:');
    expect(output).not.toMatch(/(?<!<a?):ruggy_point:(?!\d)/);
  });

  // Edge: shortcode at absolute end of string (no trailing whitespace).
  test('translates :ruggy_point: at exact end-of-string', () => {
    const input = ':ruggy_point:';
    const output = translateEmojiShortcodes(input);
    expect(output).toBe('<:ruggy_point:1142029237994389534>');
  });

  // Edge: multiple consecutive shortcodes (some persona patterns chain them).
  // Uses three names confirmed-registered in the THJ catalog as of 2026-04-29.
  // If any of these names get removed from the guild, this test fires —
  // surfaces a registry/guild drift signal which is itself useful debugging.
  test('translates multiple consecutive registered :name: shortcodes', () => {
    const input = ':ruggy_flex: :ruggy_point: :ruggy_zoom:';
    const output = translateEmojiShortcodes(input);
    expect(output).toContain('<:ruggy_flex:');
    expect(output).toContain('<:ruggy_point:');
    expect(output).toContain('<a:ruggy_zoom:');  // ruggy_zoom is animated
  });

  // Edge: rendered-token correction (LLM emits with hallucinated ID).
  test('rewrites <:ruggy_point:wrong_id> to canonical id', () => {
    const input = 'closing line. <:ruggy_point:99999999999999999>';
    const output = translateEmojiShortcodes(input);
    expect(output).toContain('<:ruggy_point:1142029237994389534>');
    expect(output).not.toContain('99999999999999999');
  });

  // Edge: animated-prefix correction (LLM gets the `a:` prefix wrong).
  test('corrects animated prefix from registry (ruggy_zoom is animated)', () => {
    // ruggy_zoom is animated; if LLM emits `<:ruggy_zoom:...>` (missing `a`),
    // the validator should force `<a:ruggy_zoom:...>`.
    const input = 'speed: <:ruggy_zoom:99999999999999999>';
    const output = translateEmojiShortcodes(input);
    // Must include the `a:` prefix even if LLM emitted bare `:`.
    expect(output).toContain('<a:ruggy_zoom:');
  });

  // Edge: non-existent custom-emoji prefix should DROP, not leak.
  test('drops :ruggy_<unknown>: hallucination silently', () => {
    const input = 'closing :ruggy_doesnt_exist:';
    const output = translateEmojiShortcodes(input);
    expect(output).not.toContain(':ruggy_doesnt_exist:');
    // Non-prefix-shaped shortcodes (`:my_var:`) should NOT be dropped — they pass through.
    const passThrough = translateEmojiShortcodes('the var :my_custom_thing: is set');
    expect(passThrough).toContain(':my_custom_thing:');
  });

  // Hostile: zero-width / Cf-class chars between colons would defeat the
  // regex without normalization. Documents the gap (not currently defended
  // against — the L7 soul-identity-doc pattern shows the canonical fix).
  test.skip('normalizes :Ｒｕｇｇｙ_point: (fullwidth attack) — DEFERRED, gap documented', () => {
    // Adopting the NFKC + Cf-strip pattern from L7 sanitization would close
    // this. Currently the regex passes the fullwidth shortcode through
    // (no warning, no translate). Open for cycle-XXX if hostile LLM output
    // ever materializes.
    const input = 'closing ：Ｒｕｇｇｙ_point：';  // fullwidth colons + name
    const output = translateEmojiShortcodes(input);
    expect(output).not.toContain('：Ｒｕｇｇｙ_point：');
  });
});

describe('translateEmojiShortcodes — diff against suspected production failure modes', () => {
  // If the bug recurs, ONE of these will fail and tell you which class.

  test('byte-for-byte match against extracted Discord message ends with rendered token', () => {
    // Bytes pulled via `curl /api/v10/channels/<stonehenge>/messages?limit=1`
    // on 2026-05-15 — the post-redeploy run that STILL showed `:ruggy_point:` raw.
    const productionInput =
      "yeah og's been weird this week.\n\n:ruggy_point:";
    const result = translateEmojiShortcodes(productionInput);
    // Must end with the rendered token (with optional trailing newline /
    // whitespace if input had it). Use a regex anchor.
    expect(result).toMatch(/<:ruggy_point:1142029237994389534>$/);
  });
});
