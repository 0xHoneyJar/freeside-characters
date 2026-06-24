/**
 * Tests for deliver/medium-extensions.ts (cycle-007 S3/T3.2).
 *
 * Coverage matrix:
 * - DISCORD_EXTENDED.digitWidthSpaceChar codePointAt(0) === 0x2007 (Flatline SKP-002/HIGH)
 * - DISCORD_EXTENDED.digitWidthSpaceChar !== ' ' (ASCII-negative · Flatline IMP-006)
 * - DISCORD_EXTENDED frozen (mutation throws in strict mode)
 * - CLI_EXTENDED.digitWidthSpaceChar === ' ' (ASCII space · monospace terminal)
 * - metricsForMedium dispatch for all 4 registered _tag values
 * - metricsForMedium THROWS UnsupportedMediumError on unregistered medium (telegram-stub)
 *   (BB MEDIUM-5 · Flatline SKP-002/HIGH alignment)
 */

import { describe, expect, test } from 'bun:test';
import {
  DISCORD_WEBHOOK_DESCRIPTOR,
  DISCORD_INTERACTION_DESCRIPTOR,
  CLI_DESCRIPTOR,
} from '@0xhoneyjar/medium-registry';
import {
  DISCORD_EXTENDED,
  CLI_EXTENDED,
  metricsForMedium,
  UnsupportedMediumError,
} from './medium-extensions.ts';

// ──────────────────────────────────────────────────────────────────────
// DISCORD_EXTENDED · figure-space codepoint identity (Flatline SKP-002/HIGH)
// ──────────────────────────────────────────────────────────────────────

describe('DISCORD_EXTENDED · digitWidthSpaceChar (U+2007 FIGURE SPACE)', () => {
  test('codePointAt(0) === 0x2007 (codepoint identity · primary check)', () => {
    expect(DISCORD_EXTENDED.digitWidthSpaceChar.codePointAt(0)).toBe(0x2007);
  });

  test('!== ASCII space (negative assertion · Flatline IMP-006)', () => {
    expect(DISCORD_EXTENDED.digitWidthSpaceChar).not.toBe(' ');
  });

  test('length === 1 (sanity · insufficient alone but worth pinning)', () => {
    expect(DISCORD_EXTENDED.digitWidthSpaceChar.length).toBe(1);
  });

  test('UTF-8 byte sequence is 0xE2 0x80 0x87 (3-byte encoding)', () => {
    const bytes = new TextEncoder().encode(DISCORD_EXTENDED.digitWidthSpaceChar);
    expect(Array.from(bytes)).toEqual([0xe2, 0x80, 0x87]);
  });
});

describe('DISCORD_EXTENDED · other metrics', () => {
  test('codeBlockMonoCharWidth === 38 (discord.js#3030 wrap-40 minus 2 safety)', () => {
    expect(DISCORD_EXTENDED.codeBlockMonoCharWidth).toBe(38);
  });

  test('codeBlockMobileFallbackRisk === "high" (Android gg sans regression)', () => {
    expect(DISCORD_EXTENDED.codeBlockMobileFallbackRisk).toBe('high');
  });

  test('mobileProportionalWrap === 40', () => {
    expect(DISCORD_EXTENDED.mobileProportionalWrap).toBe(40);
  });

  test('emojiWidthInMonospace === 2', () => {
    expect(DISCORD_EXTENDED.emojiWidthInMonospace).toBe(2);
  });

  test('DISCORD_EXTENDED is frozen (mutation throws in strict mode)', () => {
    expect(Object.isFrozen(DISCORD_EXTENDED)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// CLI_EXTENDED · ASCII space + terminal defaults
// ──────────────────────────────────────────────────────────────────────

describe('CLI_EXTENDED', () => {
  test('digitWidthSpaceChar === " " (ASCII · terminal is monospace)', () => {
    expect(CLI_EXTENDED.digitWidthSpaceChar).toBe(' ');
    expect(CLI_EXTENDED.digitWidthSpaceChar.codePointAt(0)).toBe(0x0020);
  });

  test('codeBlockMobileFallbackRisk === "none"', () => {
    expect(CLI_EXTENDED.codeBlockMobileFallbackRisk).toBe('none');
  });

  test('CLI_EXTENDED is frozen', () => {
    expect(Object.isFrozen(CLI_EXTENDED)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// metricsForMedium · dispatch + BB MEDIUM-5 throw-on-unknown
// ──────────────────────────────────────────────────────────────────────

describe('metricsForMedium', () => {
  test('discord-webhook → DISCORD_EXTENDED', () => {
    expect(metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR)).toBe(DISCORD_EXTENDED);
  });

  test('discord-interaction → DISCORD_EXTENDED (both Discord variants share render knobs)', () => {
    expect(metricsForMedium(DISCORD_INTERACTION_DESCRIPTOR)).toBe(DISCORD_EXTENDED);
  });

  test('cli → CLI_EXTENDED', () => {
    expect(metricsForMedium(CLI_DESCRIPTOR)).toBe(CLI_EXTENDED);
  });

  test('telegram-stub THROWS UnsupportedMediumError (BB MEDIUM-5 force conscious registration)', () => {
    const fakeTelegram = { _tag: 'telegram-stub' } as any;
    expect(() => metricsForMedium(fakeTelegram)).toThrow(UnsupportedMediumError);
  });

  test('UnsupportedMediumError carries mediumTag for triage', () => {
    const fakeTelegram = { _tag: 'telegram-stub' } as any;
    try {
      metricsForMedium(fakeTelegram);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedMediumError);
      expect((e as UnsupportedMediumError).mediumTag).toBe('telegram-stub');
    }
  });

  test('unknown _tag THROWS (defensive against future descriptor additions)', () => {
    const future = { _tag: 'web-stub-2027' } as any;
    expect(() => metricsForMedium(future)).toThrow(UnsupportedMediumError);
  });
});
