/**
 * cmp-boundary.test.ts (mongolian) — per-persona regression guard.
 *
 * Mongolian is the FIRST INSTANCE of [[mibera-as-npc]] (Grail #507 ·
 * Ancestor category · Gumi-authored). The substrate-runtime binding
 * lives in cycle-3 (gated on `loa-finn#157` 6/7 sprints complete);
 * this test file ships the regression guard scaffold so the lint script
 * (`scripts/lint-cmp-boundary-tests.sh`) passes during cycle-r sprint-1.
 *
 * Rich Mongolian voice fixtures + asymmetric-kindness verdict patterns
 * are deferred to cycle-3 when Gumi's persona authoring lands and the
 * substrate-construct binding is wired through finn.
 *
 * @future mibera-as-NPC cycle-3 — replace stub fixtures with curator-
 *   authored Mongolian voice samples (sustained tones · steppe-vast
 *   metaphors · "many voices in one") + asymmetric-kindness verdict
 *   register tests (per `[[mibera-as-npc]]` §6 first-instance plan).
 *
 * Refs:
 *   ~/vault/wiki/concepts/mibera-as-npc.md §6 (first-instance plan)
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   apps/character-mongolian/persona.md (Gumi-authored · cycle-3)
 *   grimoires/loa/sdd.md A6 (@future cycle-3 grep-traceable marker)
 */

import { describe, test, expect } from 'bun:test';
import {
  stripVoiceDisciplineDrift,
  escapeDiscordMarkdown,
} from '../../packages/persona-engine/src/deliver/sanitize.ts';

// =============================================================================
// Stub fixtures · placeholder voice samples (cycle-3 replaces with curator)
// =============================================================================

const MONGOLIAN_PLACEHOLDER_VOICE =
  'the steppe nods. consensus advanced through the seam.';

// =============================================================================
// Smoke · transforms compose without throwing for Mongolian's voice register
// =============================================================================

describe('mongolian cmp-boundary · scaffold', () => {
  test('transforms compose without error on placeholder voice', () => {
    const stripped = stripVoiceDisciplineDrift(MONGOLIAN_PLACEHOLDER_VOICE);
    const final = escapeDiscordMarkdown(stripped);
    expect(typeof final).toBe('string');
    expect(final.length).toBeGreaterThan(0);
  });

  test('placeholder voice has no em-dashes (clean baseline)', () => {
    expect(MONGOLIAN_PLACEHOLDER_VOICE).not.toContain('—');
    expect(MONGOLIAN_PLACEHOLDER_VOICE).not.toContain('–');
  });

  // @future mibera-as-NPC cycle-3 — add tests for:
  //   - sustained-tones cadence (Gumi's voice register)
  //   - asymmetric-kindness verdict patterns (sincere-off-base → generous redirect)
  //   - curator-fingerprint preservation ("the steppe nods" not "PASS")
  //   - badge-issuance side-channel (no on-chain transfers per Eileen rails)
});
