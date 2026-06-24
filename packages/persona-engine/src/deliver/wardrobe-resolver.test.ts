/**
 * wardrobe-resolver.test.ts — Sprint 4 R4.6 acceptance.
 *
 * Verifies:
 *   1. Scaffold seam compiles + scaffold returns null with predictable shape
 *   2. Resolution precedence (IMP-011) — character vs token vs registry tiers
 *   3. Telemetry shape (SKP-001) — event structure for grep-stable logs
 *
 * Cycle-3 (mibera-as-NPC · gated on loa-finn#157) replaces the resolver
 * body and extends this test file with fetch + decode coverage. Sprint 4
 * locks the seam shape.
 */

import { describe, expect, test } from 'bun:test';
import type {
  MediumCapabilityOverridesType,
  TokenBindingType,
} from '@0xhoneyjar/medium-registry';
import {
  DEFAULT_RETRIES,
  FETCH_TIMEOUT_MS,
  pickWardrobePrecedence,
  resolveWardrobe,
  type ResolveWardrobeArgs,
  type WardrobeFailureReason,
  type WardrobeResolveResult,
  type WardrobeSource,
  type WardrobeTelemetryEvent,
  type WardrobeTelemetrySink,
} from './wardrobe-resolver.ts';

// =============================================================================
// AC-4.6 — scaffold seam compiles + returns null with predictable shape
// =============================================================================

describe('wardrobe-resolver scaffold (Sprint 4 seam-compiles)', () => {
  test('resolveWardrobe returns null override with character-default source when binding undefined', async () => {
    const args: ResolveWardrobeArgs = {
      characterId: 'mongolian',
      binding: undefined,
      mediumId: 'discord-webhook',
    };
    const result = await resolveWardrobe(args);
    expect(result.override).toBeNull();
    expect(result.source).toBe('character-default');
    expect(result.failureReason).toBe('no-binding');
  });

  test('resolveWardrobe returns null override even when binding set (Sprint 4 stub · cycle-3 fills)', async () => {
    const binding: TokenBindingType = {
      contract: '0x1234567890abcdef1234567890abcdef12345678',
      tokenId: '507',
      resolverHint: 'cf-function-kv',
    };
    const args: ResolveWardrobeArgs = {
      characterId: 'mongolian',
      binding,
      mediumId: 'discord-webhook',
    };
    const result = await resolveWardrobe(args);
    expect(result.override).toBeNull();
    expect(result.source).toBe('character-default');
    // failureReason should be undefined (binding IS set · scaffold doesn't
    // attempt fetch · cycle-3 fills with appropriate reason on real failures)
    expect(result.failureReason).toBeUndefined();
  });

  test('FETCH_TIMEOUT_MS conservative default is 2000ms (DISC-001)', () => {
    expect(FETCH_TIMEOUT_MS).toBe(2000);
  });

  test('DEFAULT_RETRIES conservative default is 0 (DISC-001)', () => {
    expect(DEFAULT_RETRIES).toBe(0);
  });

  test('telemetry sink contract type-checks (SKP-001)', () => {
    const events: WardrobeTelemetryEvent[] = [];
    const sink: WardrobeTelemetrySink = {
      emit: (event) => {
        events.push(event);
      },
    };
    // Synthesize an event manually to verify shape — cycle-3 fills the
    // resolver body and this assertion will become observational.
    const event: WardrobeTelemetryEvent = {
      kind: 'wardrobe-resolve-failed',
      characterId: 'mongolian',
      contract: '0x1234567890abcdef1234567890abcdef12345678',
      tokenId: '507',
      mediumId: 'discord-webhook',
      reason: 'network',
      elapsedMs: 1234,
    };
    sink.emit(event);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('wardrobe-resolve-failed');
  });

  test('failure-reason union has expected variants', () => {
    const reasons: WardrobeFailureReason[] = [
      'network',
      'notfound',
      'invalid',
      'no-binding',
    ];
    expect(reasons).toHaveLength(4);
  });

  test('source union has expected variants', () => {
    const sources: WardrobeSource[] = [
      'token-binding',
      'character-default',
      'registry-default',
    ];
    expect(sources).toHaveLength(3);
  });
});

// =============================================================================
// AC-4.6 — IMP-011 resolution precedence test (cycle R sprint 4)
// =============================================================================

describe('pickWardrobePrecedence (IMP-011 disambiguation)', () => {
  // Reusable fixtures
  const characterOverrides: MediumCapabilityOverridesType = {
    discord: { sticker: false },
  };
  const tokenOverrides: MediumCapabilityOverridesType = {
    discord: { customEmoji: false },
  };

  test('Tier 1 wins · resolver returned a non-null override (token-binding)', () => {
    const resolverResult: WardrobeResolveResult = {
      override: tokenOverrides,
      source: 'token-binding',
    };
    const out = pickWardrobePrecedence(resolverResult, characterOverrides);
    expect(out.override).toBe(tokenOverrides);
    expect(out.source).toBe('token-binding');
  });

  test('Tier 2 wins · resolver returned null + character mediumOverrides set', () => {
    const resolverResult: WardrobeResolveResult = {
      override: null,
      source: 'character-default',
    };
    const out = pickWardrobePrecedence(resolverResult, characterOverrides);
    expect(out.override).toBe(characterOverrides);
    expect(out.source).toBe('character-default');
  });

  test('Tier 3 wins · resolver returned null + no character mediumOverrides', () => {
    const resolverResult: WardrobeResolveResult = {
      override: null,
      source: 'character-default',
      failureReason: 'no-binding',
    };
    const out = pickWardrobePrecedence(resolverResult, undefined);
    expect(out.override).toBeNull();
    expect(out.source).toBe('registry-default');
  });

  test('Tier 1 OVER Tier 2 · resolver wins even when characterOverrides also set', () => {
    // The disambiguation per IMP-011: tokenBinding → resolver-non-null → tier 1
    // takes precedence over character-level mediumOverrides.
    const resolverResult: WardrobeResolveResult = {
      override: tokenOverrides,
      source: 'token-binding',
    };
    const out = pickWardrobePrecedence(resolverResult, characterOverrides);
    expect(out.override).toBe(tokenOverrides);
    expect(out.source).toBe('token-binding');
    // characterOverrides was NOT applied — tier 1 won
    expect(out.override).not.toBe(characterOverrides);
  });

  test('Tier 2 path ALSO when resolver returned null with token-binding source (resolver fallback)', () => {
    // Edge case: cycle-3 fetched and decoded, but the L0 medium_capabilities
    // for this mediumId was undefined, so resolver returned null. Source
    // 'character-default' on null indicates fallthrough to tier 2.
    const resolverResult: WardrobeResolveResult = {
      override: null,
      source: 'character-default',
      failureReason: 'notfound',
    };
    const out = pickWardrobePrecedence(resolverResult, characterOverrides);
    expect(out.override).toBe(characterOverrides);
    expect(out.source).toBe('character-default');
  });

  test('precedence is pure · same inputs produce same outputs', () => {
    const resolverResult: WardrobeResolveResult = {
      override: null,
      source: 'character-default',
    };
    const a = pickWardrobePrecedence(resolverResult, characterOverrides);
    const b = pickWardrobePrecedence(resolverResult, characterOverrides);
    expect(a).toEqual(b);
  });
});

// =============================================================================
// @future mibera-as-NPC cycle-3 — additional tests to extend in cycle-3 fill:
//   - Cache hit / miss paths
//   - Schema decode failure → 'invalid' reason emitted to telemetry
//   - Network timeout → 'network' reason emitted
//   - HTTP 404 → 'notfound' reason emitted
//   - merge-then-validate against MediumCapability narrow Schema
// =============================================================================
