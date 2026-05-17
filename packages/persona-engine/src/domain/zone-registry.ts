/**
 * Canonical zone-display registry (cycle-007 S1/T1.1 · D1 closure).
 *
 * Replaces `score/types.ts::ZONE_FLAVOR` (prose-name only) and
 * `live/discord-render.live.ts::ZONE_LABEL` (Discord rich-label only) with a
 * single source of truth. Adds `detectKebabZoneIds` SINK-side sanitizer
 * primitive (FR-1.4 · log-only V1 per SR-1).
 *
 * Quality-gate provenance:
 * - Flatline PRD IMP-011 (Phase 2 · 850 GPT/Gem): resolvers MUST throw on unknown · TS-exhaustiveness AND runtime throw.
 * - BB design HIGH-2 (Phase 3.5 · 720): detectKebabZoneIds NFKC + Unicode dash substitution (U+2010..U+2015, U+2212) BEFORE regex match. Same pattern class as Loa cycle-098 sprint-7 cypherpunk HIGH-2 (L7 SOUL prescriptive matching).
 * - Flatline PRD IMP-002 (Phase 2 · 845): false-positive allowlist for Discord emoji syntax · code blocks · URLs · markdown links.
 * - BB REFRAME-2 (Phase 3.5 · accept-minor): richLabel coupled to Discord conventions for cycle-007 · cycle-008 follow-up extracts to presentation/zone-display.ts when Telegram adapter lands.
 * - Flatline SDD SKP-003/HIGH (Phase 4 · 750): callers MUST wrap in try/catch + safe fallback + OTEL counter (see SDD §2.1 SKP-003 block).
 *
 * Callers (per S0/T0.1 spike findings · 2026-05-17):
 *   23 inside packages/persona-engine/src/ + 8 in apps/bot/src/ (S1/T1.3 expanded scope)
 */

import { ZONE_IDS, type ZoneId, type ZoneDimension } from '../score/types.ts';

export class UnknownZoneError extends Error {
  constructor(public readonly attemptedZone: string) {
    super(
      `Zone "${attemptedZone}" not in ZONE_REGISTRY (expected one of: ${ZONE_IDS.join(', ')})`
    );
    this.name = 'UnknownZoneError';
  }
}

export interface ZoneDisplayRecord {
  readonly id: ZoneId;
  readonly emoji: string;
  readonly displayName: string;        // "El Dorado" — for prose
  readonly dimension: ZoneDimension;
  readonly richLabel: string;          // "⛏️ El Dorado (NFT)" — for Discord headlines · BB REFRAME-2 (cycle-008 may extract to presentation/)
}

/**
 * Frozen canonical map. Source of truth for ZoneId → display.
 * Merges previous `ZONE_FLAVOR.name` (prose) + `ZONE_LABEL` (Discord rich-label).
 */
export const ZONE_REGISTRY: Readonly<Record<ZoneId, ZoneDisplayRecord>> = Object.freeze({
  stonehenge: {
    id: 'stonehenge',
    emoji: '🗿',
    displayName: 'Stonehenge',
    dimension: 'overall',
    richLabel: '🗿 Stonehenge',
  },
  'bear-cave': {
    id: 'bear-cave',
    emoji: '🐻',
    displayName: 'Bear Cave',
    dimension: 'og',
    richLabel: '🐻 Bear Cave (OG)',
  },
  'el-dorado': {
    id: 'el-dorado',
    emoji: '⛏️',
    displayName: 'El Dorado',
    dimension: 'nft',
    richLabel: '⛏️ El Dorado (NFT)',
  },
  'owsley-lab': {
    id: 'owsley-lab',
    emoji: '🧪',
    displayName: 'Owsley Lab',
    dimension: 'onchain',
    richLabel: '🧪 Owsley Lab (Onchain)',
  },
});

/**
 * Returns the canonical prose display name (e.g. "El Dorado").
 * Throws UnknownZoneError if zone not in registry (IMP-011 · Flatline Phase 2).
 *
 * Callers in production paths (live/discord-render, deliver/sanitize, persona/loader,
 * compose/voice-brief) MUST wrap in try/catch + emit OTEL counter + safe fallback.
 * See SDD §2.1 SKP-003 block for canonical wrap pattern.
 */
export function resolveZoneDisplayName(zone: ZoneId): string {
  const record = ZONE_REGISTRY[zone];
  if (!record) throw new UnknownZoneError(zone);
  return record.displayName;
}

/**
 * Returns the Discord-rich label (e.g. "⛏️ El Dorado (NFT)").
 * Throws UnknownZoneError if zone not in registry (IMP-011).
 *
 * BB REFRAME-2: this is Discord-shaped. cycle-008 follow-up extracts to
 * presentation/zone-display.ts when Telegram adapter lands.
 */
export function resolveZoneRichLabel(zone: ZoneId): string {
  const record = ZONE_REGISTRY[zone];
  if (!record) throw new UnknownZoneError(zone);
  return record.richLabel;
}

/**
 * SINK-side detector for kebab ZoneId leaks in voice output (FR-1.4).
 *
 * Matches case-insensitively at word boundaries. SKIPS false-positive contexts
 * (per Flatline PRD IMP-002):
 *   - Fenced code blocks (``` ... ```)
 *   - Inline code (`text`)
 *   - Discord emoji syntax (:name: or <:name:id>)
 *   - URL path segments (https?://...)
 *   - Markdown link targets ([text](url))
 *
 * BB HIGH-2 hardening: NFKC-normalizes input + substitutes Unicode dash variants
 * (U+2010 HYPHEN, U+2011 NB-HYPHEN, U+2012 FIGURE DASH, U+2013 EN DASH,
 * U+2014 EM DASH, U+2015 HORIZONTAL BAR, U+2212 MINUS) → ASCII hyphen BEFORE
 * regex match. Closes the Unicode normalization bypass class where an LLM
 * produces 'el‐dorado' (U+2010) or 'el—dorado' (U+2014). Same pattern class as
 * Loa cycle-098 sprint-7 cypherpunk HIGH-2 (L7 SOUL prescriptive matching).
 *
 * Known gap (per Red Team ATK-003 · CREATIVE_ONLY · deferred-to-V2):
 *   NFKC does NOT collapse Latin/Cyrillic homoglyphs (e.g. Cyrillic Ye U+0435
 *   vs Latin e U+0065). V2 defense via UTS #39 confusable-skeleton transform.
 */
export function detectKebabZoneIds(text: string): ZoneId[] {
  // BB HIGH-2: NFKC + Unicode dash substitution defensively normalizes attack input
  // Range U+2010..U+2015 covers HYPHEN, NB-HYPHEN, FIGURE DASH, EN DASH, EM DASH, HORIZONTAL BAR
  const normalized = text
    .normalize('NFKC')
    .replace(/[‐-―−]/g, '-');

  // IMP-002 false-positive allowlist — strip these contexts BEFORE regex
  const stripped = normalized
    .replace(/```[\s\S]*?```/g, '')                     // fenced code blocks
    .replace(/`[^`\n]+`/g, '')                          // inline code
    .replace(/<:[a-z0-9_-]+:\d+>/gi, '')                // Discord custom emoji <:name:id>
    .replace(/:[a-z0-9_-]+:/gi, '')                     // Discord emoji syntax :name:
    .replace(/https?:\/\/\S+/gi, '')                    // URLs
    .replace(/\[[^\]]*\]\([^)]*\)/g, '');               // markdown link targets [text](url)

  const hits = new Set<ZoneId>();
  for (const zone of ZONE_IDS) {
    // Escape any regex-meta chars in zone (defensive · ZoneIds are kebab-safe today but future-proof)
    const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (pattern.test(stripped)) hits.add(zone);
  }
  return Array.from(hits);
}

/**
 * SKP-003-compliant safe resolver wrapping `resolveZoneDisplayName`.
 *
 * Returns the canonical display name on success. On UnknownZoneError, emits a
 * `zone.resolution_failed` warning with caller context and returns the raw
 * ZoneId string as fallback (so prose continues without crashing the pipeline).
 *
 * Other errors re-throw.
 *
 * Per SDD §2.1 Flatline SKP-003 disposition (Phase 4 · 2026-05-17): preserves
 * IMP-011 throw-on-unknown contract at the resolver layer while preventing
 * production pipeline crash from LLM hallucination / data-corruption injection
 * of unknown ZoneId values. OTEL counter integration deferred to S2 trace
 * envelope work — for cycle-007 S1, console.warn structured log is the
 * placeholder telemetry (S2 swaps to `wrapTraceEntry('substrate', 'zone-resolution-failed', ...)`
 * + `appendTraceEntry`).
 */
export function safeResolveZoneDisplayName(zone: ZoneId, caller: string): string {
  try {
    return resolveZoneDisplayName(zone);
  } catch (e) {
    if (e instanceof UnknownZoneError) {
      console.warn(
        `[zone.resolution_failed] zone=${e.attemptedZone} caller=${caller} fallback=raw-id`,
      );
      return String(zone);
    }
    throw e;
  }
}

/**
 * SKP-003-compliant safe variant of `resolveZoneRichLabel`.
 * Same fallback semantics as `safeResolveZoneDisplayName`.
 */
export function safeResolveZoneRichLabel(zone: ZoneId, caller: string): string {
  try {
    return resolveZoneRichLabel(zone);
  } catch (e) {
    if (e instanceof UnknownZoneError) {
      console.warn(
        `[zone.resolution_failed] zone=${e.attemptedZone} caller=${caller} fallback=raw-id`,
      );
      return String(zone);
    }
    throw e;
  }
}

/**
 * Compile-time exhaustiveness helper (TS-side INV-12 guard).
 * Use in switch/case over ZoneId to force compile-fail on unhandled zones.
 *
 * Pairs with UnknownZoneError for runtime exhaustiveness in dynamic-ZoneId code paths.
 *
 * Example:
 *   switch (zone) {
 *     case 'stonehenge': return ...;
 *     case 'bear-cave': return ...;
 *     case 'el-dorado': return ...;
 *     case 'owsley-lab': return ...;
 *     default: return assertNeverZone(zone);
 *   }
 */
export function assertNeverZone(zone: never): never {
  throw new UnknownZoneError(String(zone));
}
