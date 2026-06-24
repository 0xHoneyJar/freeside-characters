/**
 * cmp-boundary.test.ts (ruggy) — per-persona regression guard.
 *
 * Verifies the chat-medium presentation boundary transforms (cmp-boundary
 * §0 ID-leakage class + §9 voice-discipline class) hold for ruggy's voice
 * fixtures. Ships as part of cycle-r-cmp-boundary-architecture sprint 1
 * per architect lock A4 + sprint plan R1.6.
 *
 * Catches future drift in same class as the 6 fixes shipped 2026-05-04
 * (PRs freeside-characters #27, #28, #29, #30, #31, #32).
 *
 * Refs:
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §0 + §9
 *   ~/vault/wiki/concepts/discord-native-register.md (2026-05-04 amend)
 *   apps/character-ruggy/persona.md (canonical voice)
 */

import { describe, test, expect } from 'bun:test';
import {
  stripVoiceDisciplineDrift,
  escapeDiscordMarkdown,
} from '../../packages/persona-engine/src/deliver/sanitize.ts';

// =============================================================================
// Fixtures · ruggy voice samples (lowercase OG register)
// =============================================================================

const RUGGY_DIGEST_PRE = [
  'yo bear-cave team — quiet week ngl.',
  '',
  'peep `0xa3...c1` — climbed from #84 to #41. solid stack.',
  'el-dorado was tight — `nft:mibera` ate most of the action.',
  '',
  'stay groovy 🐻',
].join('\n');

const RUGGY_MICRO_PRE =
  'just peeped bear-cave — `0x91...22` is quietly stacking. solid.';

const RUGGY_WEAVER_PRE =
  '@nomadbera hit bear-cave on tuesday and el-dorado on thursday — same mibera stacking both sides — keep a peep on this one.';

// Drift fixtures (what NOT to ship)
const ROLEPLAY_DRIFT =
  'ruggy says *adjusts cabling* peep this — chain held tight.';

const CLOSING_DRIFT_NON_DIGEST =
  'just peeped el-dorado, action is light.\nstay groovy 🐻';

// =============================================================================
// Voice-discipline class (cmp-boundary §9)
// =============================================================================

describe('ruggy cmp-boundary · voice-discipline class', () => {
  test('digest preserves "stay groovy 🐻" closing (digest exempt)', () => {
    const out = stripVoiceDisciplineDrift(RUGGY_DIGEST_PRE, {
      postType: 'digest',
    });
    expect(out).toContain('stay groovy 🐻');
    // em-dashes in digest body still stripped (universal · zero opt-out per A4)
    expect(out).not.toContain('—');
  });

  test('non-digest strips trailing closing', () => {
    const out = stripVoiceDisciplineDrift(CLOSING_DRIFT_NON_DIGEST);
    expect(out).not.toContain('stay groovy');
    expect(out).toContain('action is light.');
  });

  test('em-dash with lowercase next becomes comma', () => {
    const out = stripVoiceDisciplineDrift(RUGGY_MICRO_PRE);
    expect(out).not.toContain('—');
    expect(out).toContain('bear-cave, `0x91...22`');
  });

  test('multiple em-dashes in weaver all transformed', () => {
    const out = stripVoiceDisciplineDrift(RUGGY_WEAVER_PRE);
    expect(out).not.toContain('—');
    // Original "thursday — same" → "thursday, same"
    expect(out).toContain('thursday, same mibera');
  });

  test('asterisk roleplay stripped from ruggy voice', () => {
    const out = stripVoiceDisciplineDrift(ROLEPLAY_DRIFT);
    expect(out).not.toContain('*adjusts cabling*');
    expect(out).toContain('peep this');
  });
});

// =============================================================================
// ID-leakage class (cmp-boundary §0 · regression guard for shipped fixes)
// =============================================================================

describe('ruggy cmp-boundary · ID-leakage class regression', () => {
  test('factor identifiers preserved verbatim inside backticks', () => {
    const voice = 'peep `mibera_acquire` — heavy hitter today.';
    const cleaned = stripVoiceDisciplineDrift(voice);
    const final = escapeDiscordMarkdown(cleaned);
    // Inside backticks, `mibera_acquire` survives both transforms.
    expect(final).toContain('`mibera_acquire`');
  });

  test('underscores escaped outside backticks (regression for PR #27 class)', () => {
    const voice = 'mibera_acquire heavy lifter today';
    const final = escapeDiscordMarkdown(voice);
    expect(final).toBe('mibera\\_acquire heavy lifter today');
  });

  test('custom emoji syntax preserved through both transforms', () => {
    const voice = 'big day <:ruggy_grin:12345> — see for yourself';
    const cleaned = stripVoiceDisciplineDrift(voice);
    const final = escapeDiscordMarkdown(cleaned);
    expect(final).toContain('<:ruggy_grin:12345>');
    expect(final).not.toContain('—');
  });

  test('wallet truncation preserved (no over-strip)', () => {
    const voice = '`0xa3...c1` climbed — solid.';
    const cleaned = stripVoiceDisciplineDrift(voice);
    expect(cleaned).toContain('`0xa3...c1`');
    expect(cleaned).toContain('climbed, solid.');
  });

  test('Discord mention syntax preserved', () => {
    const voice = 'shout to <@!12345> — big climb today.';
    const cleaned = stripVoiceDisciplineDrift(voice);
    const final = escapeDiscordMarkdown(cleaned);
    expect(final).toContain('<@!12345>');
  });
});

// =============================================================================
// Compositional · transforms compose correctly in canonical order
// =============================================================================

describe('ruggy cmp-boundary · composition with delivery', () => {
  test('voice-discipline runs before markdown escape', () => {
    const voice = 'mibera_acquire — heavy hitter today.';
    // canonical order: stripVoiceDisciplineDrift → escapeDiscordMarkdown
    const stripped = stripVoiceDisciplineDrift(voice);
    expect(stripped).toBe('mibera_acquire, heavy hitter today.');
    const final = escapeDiscordMarkdown(stripped);
    expect(final).toBe('mibera\\_acquire, heavy hitter today.');
  });

  test('idempotent across realistic ruggy digest fixture', () => {
    const once = stripVoiceDisciplineDrift(RUGGY_DIGEST_PRE);
    const twice = stripVoiceDisciplineDrift(once);
    expect(twice).toBe(once);
  });
});
