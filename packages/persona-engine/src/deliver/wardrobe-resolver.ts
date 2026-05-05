/**
 * wardrobe-resolver.ts — L1 → L0 medium-capability resolution seam.
 *
 * Cycle R · sprint 4 · cmp-boundary-architecture-2026-05-04. Sprint 4 ships
 * the SCAFFOLD; the body fill happens in mibera-as-NPC cycle-3 (gated on
 * loa-finn#157 6/7 sprints).
 *
 * @future mibera-as-NPC cycle-3 — replace the scaffold body with the live
 *   metadata fetch + decode + per-medium override extraction documented
 *   in `Cycle-3 fill plan` below. Architect lock A6 grep-traceable marker.
 *
 * ============================================================================
 * Resolution precedence (per SDD §3.2 + IMP-011 disambiguation)
 * ============================================================================
 *
 *   1. character.tokenBinding set
 *      AND `resolveWardrobe(...)` returns { override: non-null, source: 'token-binding' }
 *      → use the L0 metadata override
 *
 *   2. character.mediumOverrides set
 *      → use character-default override
 *
 *   3. neither set
 *      → use registry default (DISCORD_WEBHOOK_DESCRIPTOR / CLI_DESCRIPTOR / ...)
 *
 * The composer (cycle-3 wires this) reads `WardrobeResolveResult.source`
 * to know which tier won. Sprint 4 establishes the seam shape.
 *
 * ============================================================================
 * Failure behavior (DISC-001 · explicit conservative defaults)
 * ============================================================================
 *
 * - Network timeout       — 2 second per fetch (`FETCH_TIMEOUT_MS`).
 *                           Resolver returns { override: null, source: 'character-default' }
 *                           and emits a `[wardrobe-resolve-failed]` telemetry
 *                           line. Consumer treats null as "no override; use
 *                           tier 2 or 3 of precedence chain".
 * - Retries               — 0 by default. Cycle-3 may add bounded retries
 *                           when caching is in place. Conservative default
 *                           because the L0 fetch is on a hot path; retrying
 *                           risks per-message latency stacking.
 * - HTTP non-2xx          — treated as `not-found` failure → null override.
 * - JSON parse failure    — treated as `invalid` failure → null override.
 * - Schema decode failure — treated as `invalid` failure → null override.
 * - Outage                — caller MUST never crash on resolver failure;
 *                           the resolver guarantees it returns null + emits
 *                           telemetry rather than throwing on outage paths.
 *
 * ============================================================================
 * Caching strategy (SKP-002 first concern · cycle-3 acceptance)
 * ============================================================================
 *
 * Sprint 4 scaffold returns null and does NO fetch. Cycle-3 MUST add a
 * cache layer before the body lands in production:
 *
 *   - Per-token cache key  — `{contract}:{tokenId}:{mediumId}`
 *   - TTL                  — 5 minutes default (operator-tunable);
 *                            metadata.0xhoneyjar.xyz CDN fronts S3 +
 *                            CF Function so origin load is bounded
 *   - Cache miss           — fetch + decode + cache + return
 *   - Cache hit            — return cached value (no network)
 *   - Capacity             — bounded (LRU 1024 entries default; characters
 *                            speak across 200-2000 tokens, fits comfortably)
 *
 * Reference: `~/vault/wiki/concepts/chathead-in-cache-pattern.md` § the
 * caching layer the doctrine is named after.
 *
 * ============================================================================
 * Telemetry (SKP-001 · silent fallback obscures L0 degradation)
 * ============================================================================
 *
 * Every fallback to null override emits one structured log line. The
 * format below is grep-stable for log aggregation. Cycle-3 SHOULD wire
 * these into the existing voice-discipline telemetry sink so operators
 * can detect L0 degradation patterns:
 *
 *   [wardrobe-resolve-failed] character={charId} contract={0x...} \
 *     tokenId={N} medium={mediumId} reason={network|notfound|invalid} \
 *     elapsed_ms={N}
 *
 * Telemetry is emitted via the `WardrobeTelemetrySink` interface — caller
 * supplies the sink at composer-wiring time. Sprint 4 scaffold accepts
 * an optional sink parameter and calls it on every non-null fallback
 * decision (none in scaffold body, but the contract is established).
 *
 * ============================================================================
 * Cycle-3 fill plan (mibera-as-NPC · gated on loa-finn#157)
 * ============================================================================
 *
 * The cycle-3 fill replaces the scaffold body with these steps:
 *
 *   1. Cache lookup  — `{contract}:{tokenId}:{mediumId}` in-memory LRU
 *   2. Cache miss    — fetch metadata.0xhoneyjar.xyz/{world}/[{collection}/]{tokenId}
 *                      with AbortController + 2s timeout
 *   3. Schema decode — Schema.decodeUnknownEither against
 *                      MetadataDocument from @0xhoneyjar/freeside-protocol@^1.4.0
 *   4. Field lookup  — `decoded.medium_capabilities?.[mediumId]`
 *   5. Type-safe merge — see § "Per-medium typed merge" below
 *   6. Cache write   — { override: validated, source: 'token-binding' }
 *   7. Telemetry on any fallback path
 *
 * ============================================================================
 * Per-medium typed merge (SKP-002 second concern · cycle-3 acceptance)
 * ============================================================================
 *
 * The L0 surface stores `medium_capabilities[mediumId]` as opaque
 * `Record<string, unknown>` (preserves L0 ⇄ L2 boundary at
 * freeside-storage layer · medium-registry not a freeside-storage dep).
 *
 * Cycle-3 MUST validate the L0 value before applying as override:
 *
 *   import { Schema } from 'effect';
 *   import {
 *     DiscordWebhookSchema,
 *     CliSchema,
 *   } from '@0xhoneyjar/medium-registry';
 *
 *   function validateOverride(
 *     mediumId: string,
 *     raw: unknown,
 *   ): MediumCapabilityType | null {
 *     // Per-medium patch validation. Each branch validates against the
 *     // narrow schema for that medium (DiscordWebhookSchema / CliSchema /
 *     // ...). The discriminator `_tag` on the schema makes each variant
 *     // type-safe; consumer doesn't have to dispatch on string.
 *     const schemaByMedium: Record<string, Schema.Schema<...>> = {
 *       'discord-webhook':    DiscordWebhookSchema,
 *       'discord-interaction': DiscordInteractionSchema,
 *       'cli':                CliSchema,
 *       'telegram-stub':      TelegramSchema,
 *     };
 *     const schema = schemaByMedium[mediumId];
 *     if (!schema) return null;  // unknown mediumId · safe fallback
 *     const decoded = Schema.decodeUnknownEither(schema)(raw);
 *     return Either.isRight(decoded) ? decoded.right : null;
 *   }
 *
 * The merge function then applies the validated override on top of the
 * registry default — fields not in the override fall through to the
 * default. The MERGED RESULT is itself decoded against MediumCapability
 * before delivery (last-line-of-defense check).
 *
 * ============================================================================
 * Refs
 * ============================================================================
 *
 *   grimoires/loa/sprint.md §Sprint 4 (R4.5 · @future cycle-3 marker)
 *   grimoires/loa/sdd.md §3.2 (resolution precedence) · §5.5 (scaffold)
 *   ~/vault/wiki/concepts/mibera-as-npc.md §6 (cycle-3 first instance plan)
 *   ~/vault/wiki/concepts/chathead-in-cache-pattern.md §6
 *     (instance-3 promotion · medium_capabilities)
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   @0xhoneyjar/medium-registry overrides.ts (TokenBinding shape)
 *   @0xhoneyjar/freeside-protocol metadata-document.ts
 *     (MediumCapabilitiesPerMedium · v1.4.0)
 */

import type {
  MediumCapabilityOverridesType,
  TokenBindingType,
} from '@0xhoneyjar/medium-registry';

/**
 * Per-fetch network timeout. Conservative default — keeps the wardrobe
 * resolver off the critical path latency budget. Override at cycle-3 if
 * SLO measurement reveals tighter ceilings make sense.
 */
export const FETCH_TIMEOUT_MS = 2000;

/**
 * Default retry count. Conservative — zero retries means the resolver
 * fails fast on transient error and falls through to the next precedence
 * tier rather than stacking latency.
 */
export const DEFAULT_RETRIES = 0;

/**
 * Why the wardrobe resolver fell back to null override (per SKP-001
 * telemetry contract).
 */
export type WardrobeFailureReason =
  | 'network'      // fetch error (timeout · DNS · TLS · connection reset)
  | 'notfound'     // HTTP non-2xx · JSON missing · token id out of bounds
  | 'invalid'      // JSON parsed but Schema decode failed
  | 'no-binding';  // tokenBinding not set on character (precedence tier 2 path)

/**
 * Source attribution for the resolved wardrobe — which tier of the
 * precedence chain produced the result.
 *
 * - `token-binding`     — L0 metadata override won (tier 1)
 * - `character-default` — L1 character.mediumOverrides won (tier 2);
 *                         OR the resolver fell back (returns null with
 *                         this source · caller falls through to tier 2)
 * - `registry-default`  — neither tier set (tier 3); composer reads
 *                         registry defaults directly
 */
export type WardrobeSource =
  | 'token-binding'
  | 'character-default'
  | 'registry-default';

/**
 * Result shape returned by `resolveWardrobe`.
 *
 * - `override` is the per-medium override value to apply OVER the
 *   registry default. Null when the resolver fell back (tier 1 → tier 2).
 *   The composer interprets null as "no L0 override; use character or
 *   registry tier".
 * - `source` indicates which tier produced the value (or which tier the
 *   caller should fall through to when override is null).
 *
 * This shape is FROZEN for cycle-3 implementation — adding new fields is
 * an additive minor bump; renaming or removing is a major bump that
 * requires migration plan.
 */
export interface WardrobeResolveResult {
  readonly override: MediumCapabilityOverridesType | null;
  readonly source: WardrobeSource;
  /**
   * If the resolver fell back to null, why? Useful for telemetry +
   * debugging operator-side. Only populated when `override` is null;
   * undefined on success paths.
   */
  readonly failureReason?: WardrobeFailureReason;
}

/**
 * Telemetry sink — caller supplies the implementation. Sprint 4 scaffold
 * accepts an optional sink and forwards to it on every fallback. Cycle-3
 * wires the sink to the existing voice-discipline telemetry pipeline so
 * operators can detect L0 degradation patterns.
 *
 * Per SKP-001 acceptance: every fallback emits one structured event.
 */
export interface WardrobeTelemetrySink {
  readonly emit: (event: WardrobeTelemetryEvent) => void;
}

/**
 * Telemetry event emitted on every fallback.
 *
 * Structured to match the grep-stable line format documented in the
 * file header: `[wardrobe-resolve-failed] character=... contract=... ...`.
 */
export interface WardrobeTelemetryEvent {
  readonly kind: 'wardrobe-resolve-failed';
  readonly characterId: string;
  readonly contract?: `0x${string}`;
  readonly tokenId?: string;
  readonly mediumId: string;
  readonly reason: WardrobeFailureReason;
  readonly elapsedMs: number;
}

/**
 * Resolver input shape. The caller (composer) supplies all 4 fields per
 * resolution attempt. Caching keyed on `{contract}:{tokenId}:{mediumId}`
 * (cycle-3 acceptance per SKP-002 first concern).
 */
export interface ResolveWardrobeArgs {
  /** Stable character id ('ruggy', 'satoshi', 'mongolian', ...). */
  readonly characterId: string;
  /** From CharacterConfig.tokenBinding · undefined when tier 2 wins. */
  readonly binding: TokenBindingType | undefined;
  /** Active medium ('discord-webhook', 'cli', 'telegram-stub', ...). */
  readonly mediumId: string;
  /** Optional telemetry sink (required at cycle-3 wire-in time). */
  readonly telemetry?: WardrobeTelemetrySink;
}

/**
 * Resolve the L0 metadata wardrobe override for a token-bound character
 * on a specific medium.
 *
 * Sprint 4 SCAFFOLD: returns `{ override: null, source: 'character-default' }`
 * unconditionally · no network · no cache · no telemetry. The seam
 * exists; cycle-3 fills the body.
 *
 * @future mibera-as-NPC cycle-3 — see file-header "Cycle-3 fill plan".
 *
 * @param args — resolver input · see ResolveWardrobeArgs
 * @returns WardrobeResolveResult — caller MUST handle override === null
 *          (precedence tier 2/3 fallthrough); MUST NOT crash on null.
 */
// @future mibera-as-NPC cycle-3
export async function resolveWardrobe(
  args: ResolveWardrobeArgs,
): Promise<WardrobeResolveResult> {
  // Sprint 4 SCAFFOLD: no L0 read · all callers fall through to tier 2.
  // Cycle-3 will replace this body per the "Cycle-3 fill plan" in the
  // file header (cache lookup → fetch → decode → validate → cache →
  // return). The signature is FROZEN as the cross-cycle handoff contract.
  return {
    override: null,
    source: 'character-default',
    failureReason: args.binding === undefined ? 'no-binding' : undefined,
  };
}

/**
 * Test helper · pure precedence-chain calculator.
 *
 * Exposed for IMP-011 precedence test (Sprint 4 R4.6) without coupling
 * to the resolver fetch path. Given a `WardrobeResolveResult` and the
 * character's `mediumOverrides`, return which tier wins and the override
 * value to apply (or null if tier 3 — caller reads registry default).
 *
 * Pure function · synchronous · no side effects · no telemetry.
 *
 * Cycle-3 composer wiring: call `resolveWardrobe(...)` first, then pipe
 * the result + character.mediumOverrides through this function.
 */
export function pickWardrobePrecedence(
  resolverResult: WardrobeResolveResult,
  characterOverrides: MediumCapabilityOverridesType | undefined,
): {
  readonly override: MediumCapabilityOverridesType | null;
  readonly source: WardrobeSource;
} {
  // Tier 1 — resolver returned a non-null override
  if (resolverResult.override !== null) {
    return {
      override: resolverResult.override,
      source: 'token-binding',
    };
  }
  // Tier 2 — character mediumOverrides set
  if (characterOverrides !== undefined) {
    return {
      override: characterOverrides,
      source: 'character-default',
    };
  }
  // Tier 3 — registry default (caller reads it directly)
  return {
    override: null,
    source: 'registry-default',
  };
}
