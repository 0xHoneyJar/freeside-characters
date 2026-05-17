/**
 * Medium extensions · cycle-007 S3/T3.1 (D3 closure).
 *
 * Locally-owned extension of `@0xhoneyjar/medium-registry@^0.2.0` `MediumCapability`
 * adding Discord-specific render knobs (figure-space padding · mobile-fallback risk ·
 * code-block char width · proportional wrap · emoji width in monospace).
 *
 * The renderer (`live/discord-render.live.ts`) reads ALL medium-specific numeric
 * constants from `metricsForMedium(medium)` — hardcoded `1024 / 6000 / 19 / 40 / 38`
 * constants in render code are forbidden after S3.
 *
 * Quality-gate provenance:
 * - Arch D3 + D5: descriptor-driven render knobs + U+2007 FIGURE SPACE for digit-width invariance
 *   under Android `gg sans` proportional-fallback regression (discord.js#3030 + community report)
 * - BB REFRAME-2 (Phase 3.5 · accept-minor): richLabel coupling to Discord stays in domain/ for
 *   cycle-007 · cycle-008 follow-up extracts to presentation/zone-display.ts when Telegram lands.
 * - BB MEDIUM-5 (Phase 3.5): metricsForMedium THROWS UnsupportedMediumError on unregistered medium
 *   (replaces silent CLI_EXTENDED fallback · forces conscious decision when adding medium support).
 * - Flatline SDD SKP-002/HIGH (Phase 4 · 720): tests align with throw-on-unknown spec ·
 *   CLI_DESCRIPTOR fixture demonstrates explicit-register path.
 * - Flatline PRD IMP-006 + SKP-002/HIGH (Phase 2 · 845/760): digitWidthSpaceChar expressed as
 *   ' ' escape · tests use codePointAt(0) === 0x2007 + ASCII-negative + byte-snapshot.
 *
 * S0/T0.2 typography spike (mechanical-proxy) attested U+2007 as the default chosen padding char.
 * If S3 acceptance fails on Discord Android, fallback chain: U+2008 → U+00A0 → code-block wrap.
 */

import type { MediumCapability } from '@0xhoneyjar/medium-registry';
import {
  DISCORD_WEBHOOK_DESCRIPTOR,
  DISCORD_INTERACTION_DESCRIPTOR,
  CLI_DESCRIPTOR,
} from '@0xhoneyjar/medium-registry';

export interface ExtendedMediumMetrics {
  /** Code-block monospace character width · Discord desktop ~38 (discord.js#3030 wrap-40 minus 2 safety). */
  readonly codeBlockMonoCharWidth: number;
  /** Risk that the medium falls back to proportional font in code blocks (Android `gg sans` regression). */
  readonly codeBlockMobileFallbackRisk: 'high' | 'low' | 'none';
  /** Padding character with digit-width invariance · Discord uses U+2007 FIGURE SPACE · CLI uses ASCII. */
  readonly digitWidthSpaceChar: string;
  /** Mobile proportional wrap threshold · Discord ~40 per discord.js#3030. */
  readonly mobileProportionalWrap: number;
  /** Emoji width in monospace contexts · Discord embed = 2 · CLI varies (we default to 1). */
  readonly emojiWidthInMonospace: 1 | 2;
}

/**
 * Thrown by `metricsForMedium` when an unregistered MediumCapability descriptor is passed.
 * Per BB MEDIUM-5: prevents silent ASCII-padded output for Telegram / future mediums whose
 * extension descriptor hasn't been registered yet.
 */
export class UnsupportedMediumError extends Error {
  constructor(public readonly mediumTag: string) {
    super(`No extended metrics registered for medium "${mediumTag}" · register an ExtendedMediumMetrics descriptor before use`);
    this.name = 'UnsupportedMediumError';
  }
}

/**
 * Discord-extended metrics. `digitWidthSpaceChar` is U+2007 FIGURE SPACE (digit-width
 * invariant across OpenType tabular figures even when Android falls back to `gg sans`).
 *
 * Test assertions verify `codePointAt(0) === 0x2007` AND `!== ' '` (ASCII-negative)
 * — `' '.length === 1` alone is INSUFFICIENT (both ASCII and U+2007 are length-1 codepoints).
 */
export const DISCORD_EXTENDED: ExtendedMediumMetrics = Object.freeze({
  codeBlockMonoCharWidth: 38,
  codeBlockMobileFallbackRisk: 'high',
  digitWidthSpaceChar: ' ',
  mobileProportionalWrap: 40,
  emojiWidthInMonospace: 2,
});

/**
 * CLI-extended metrics. Terminal is monospace · ASCII space sufficient · digit-width invariance
 * via ANSI tabular figures not relevant for terminal rendering.
 */
export const CLI_EXTENDED: ExtendedMediumMetrics = Object.freeze({
  codeBlockMonoCharWidth: 80,
  codeBlockMobileFallbackRisk: 'none',
  digitWidthSpaceChar: ' ',
  mobileProportionalWrap: 80,
  emojiWidthInMonospace: 1,
});

/**
 * Resolve the extended metrics for a given upstream MediumCapability descriptor.
 *
 * BB MEDIUM-5 (Phase 3.5): THROWS `UnsupportedMediumError` on unregistered mediums.
 * Replaces previous silent CLI_EXTENDED fallback · forces conscious decision when adding
 * medium support (prevents silent ASCII-padded output for Telegram or future mediums).
 *
 * Currently registered: discord-webhook · discord-interaction · cli. Telegram-stub throws.
 */
export function metricsForMedium(medium: MediumCapability): ExtendedMediumMetrics {
  switch (medium._tag) {
    case 'discord-webhook':
    case 'discord-interaction':
      return DISCORD_EXTENDED;
    case 'cli':
      return CLI_EXTENDED;
    default:
      // telegram-stub OR future descriptors not yet registered · throw to force conscious
      // extension authorship (BB MEDIUM-5)
      throw new UnsupportedMediumError(medium._tag);
  }
}

// Re-export for caller convenience · prevents callers from importing the descriptor module directly.
export { DISCORD_WEBHOOK_DESCRIPTOR, DISCORD_INTERACTION_DESCRIPTOR, CLI_DESCRIPTOR };
