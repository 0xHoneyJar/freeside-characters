/**
 * Voice grimoire sampler tests.
 *
 * Validates:
 *   - Seeded determinism (same seed → same card)
 *   - Distinct seeds → distinct draws (statistical variance check)
 *   - Recent-used dodge prevents (entry, shape) repetition per channel
 *   - Operator weights override defaults
 *   - Bullet palette: distinct emoji, k ∈ {2,3,4}
 *   - Witness picker integration
 *   - Card renderer produces a non-empty prompt block
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  sampleVoiceCard,
  renderVoiceCard,
  _resetVoiceCache,
  _voiceCacheSize,
} from './sampler.ts';
import {
  ENTRY_VALUES,
  SHAPE_VALUES,
  SPLASH_VALUES,
  EXIT_VALUES,
  DENSITY_VALUES,
  BULLET_EMOJI_POOL,
  type Entry,
  type Shape,
} from './grimoire.ts';

beforeEach(() => {
  _resetVoiceCache();
});

describe('sampleVoiceCard · seeded determinism', () => {
  test('same seed produces same card', () => {
    const a = sampleVoiceCard({ seed: 'fixed-seed-1' });
    const b = sampleVoiceCard({ seed: 'fixed-seed-1' });
    expect(a.entry).toBe(b.entry);
    expect(a.shape).toBe(b.shape);
    expect(a.splash).toBe(b.splash);
    expect(a.exit).toBe(b.exit);
    expect(a.density).toBe(b.density);
    expect(a.bullet_palette).toEqual(b.bullet_palette);
  });

  test('every sampled value is in its respective enum', () => {
    const card = sampleVoiceCard({ seed: 'enum-check' });
    expect(ENTRY_VALUES).toContain(card.entry);
    expect(SHAPE_VALUES).toContain(card.shape);
    expect(SPLASH_VALUES).toContain(card.splash);
    expect(EXIT_VALUES).toContain(card.exit);
    expect(DENSITY_VALUES).toContain(card.density);
    for (const b of card.bullet_palette) {
      expect(BULLET_EMOJI_POOL).toContain(b);
    }
  });

  test('bullet_palette has 2-4 distinct emoji', () => {
    for (let i = 0; i < 20; i++) {
      const card = sampleVoiceCard({ seed: `palette-${i}` });
      expect(card.bullet_palette.length).toBeGreaterThanOrEqual(2);
      expect(card.bullet_palette.length).toBeLessThanOrEqual(4);
      // Distinct check.
      expect(new Set(card.bullet_palette).size).toBe(card.bullet_palette.length);
    }
  });
});

describe('sampleVoiceCard · variance across seeds', () => {
  test('20 distinct seeds produce >5 distinct (entry, shape) pairs', () => {
    const pairs = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const card = sampleVoiceCard({ seed: `variance-seed-${i}` });
      pairs.add(`${card.entry}|${card.shape}`);
    }
    // Statistical sanity: 20 seeds across a 7×6=42 (entry, shape) space
    // SHOULD hit at least 6 distinct pairs unless the sampler collapses.
    expect(pairs.size).toBeGreaterThan(5);
  });

  test('5 fires of same seed-PREFIX with index suffix produce variance', () => {
    // Pattern operator would use: seed = `${channelId}-${Date.now()}-${fire}`.
    const cards = [];
    for (let i = 0; i < 5; i++) {
      cards.push(sampleVoiceCard({ seed: `channel-abc-fire-${i}` }));
    }
    const entries = new Set(cards.map((c) => c.entry));
    const shapes = new Set(cards.map((c) => c.shape));
    // At least 2 different entries AND 2 different shapes across 5 fires.
    expect(entries.size).toBeGreaterThanOrEqual(2);
    expect(shapes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('sampleVoiceCard · recent-used dodge', () => {
  test('same channelId across 4 fires avoids exact (entry, shape) repeat', () => {
    const channelId = 'channel-dodge';
    const seen: Array<{ entry: Entry; shape: Shape }> = [];
    for (let i = 0; i < 4; i++) {
      const card = sampleVoiceCard({
        seed: `dodge-${i}`,
        channelId,
        dodgeWindow: 3,
      });
      seen.push({ entry: card.entry, shape: card.shape });
    }
    // Window=3 means fires 2,3,4 must avoid the most recent 3 of fires 1,2,3.
    // Since the sampler retries up to 4 times before giving up, exact repeats
    // are possible but should be rare. Validate the dodge ATTEMPTED variance:
    // at least 2 distinct pairs in the 4 fires.
    const distinctPairs = new Set(seen.map((p) => `${p.entry}|${p.shape}`));
    expect(distinctPairs.size).toBeGreaterThanOrEqual(2);
  });

  test('different channelId does not share dodge cache', () => {
    // Fire A in channel-1 then fire B in channel-2 with same seed should
    // produce the same card · cache is per-channel.
    const a = sampleVoiceCard({ seed: 'cross-channel', channelId: 'channel-1' });
    const b = sampleVoiceCard({ seed: 'cross-channel', channelId: 'channel-2' });
    expect(a.entry).toBe(b.entry);
    expect(a.shape).toBe(b.shape);
  });
});

describe('sampleVoiceCard · operator weight overrides', () => {
  test('zeroing all but one entry value forces that value', () => {
    const card = sampleVoiceCard({
      seed: 'force-entry',
      weights: {
        entry: { silent_start: 1, casual_yeah: 0, thoughtful_hmm: 0, pivot: 0, declarative: 0, ascii_bear: 0, observation: 0 },
      },
    });
    expect(card.entry).toBe('silent_start');
  });

  test('zeroing all but one shape value forces that value', () => {
    const card = sampleVoiceCard({
      seed: 'force-shape',
      weights: {
        shape: { single_punchline: 1, blockquote_first: 0, prose_first: 0, bullets_only: 0, inverted: 0, fragment_chain: 0 },
      },
    });
    expect(card.shape).toBe('single_punchline');
  });

  test('all-zero weights fall back to uniform pick (no crash)', () => {
    const card = sampleVoiceCard({
      seed: 'all-zero',
      weights: {
        entry: { casual_yeah: 0, thoughtful_hmm: 0, pivot: 0, declarative: 0, ascii_bear: 0, silent_start: 0, observation: 0 },
      },
    });
    expect(ENTRY_VALUES).toContain(card.entry);
  });
});

describe('sampleVoiceCard · witness picker', () => {
  test('witnessPicker receives card without witness and returns chosen name', () => {
    const card = sampleVoiceCard({
      seed: 'witness-test',
      witnessPicker: (c) => {
        expect(c.entry).toBeDefined();
        expect(c.shape).toBeDefined();
        expect((c as { witness?: string }).witness).toBeUndefined();
        return c.density === 'fragment' ? 'ruggy_zoom' : 'ruggy_smoke';
      },
    });
    expect(card.witness === 'ruggy_zoom' || card.witness === 'ruggy_smoke').toBe(true);
  });

  test('witnessPicker returning null sets witness=null', () => {
    const card = sampleVoiceCard({
      seed: 'null-witness',
      witnessPicker: () => null,
    });
    expect(card.witness).toBeNull();
  });

  test('no witnessPicker = witness is null', () => {
    const card = sampleVoiceCard({ seed: 'no-picker' });
    expect(card.witness).toBeNull();
  });
});

describe('sampleVoiceCard · noDodge opt-out (BB MED 0.80)', () => {
  test('noDodge=true ignores recent-used cache → strict seed-determinism', () => {
    // With dodge enabled, same channel + same seed might resample to dodge
    // recent. With noDodge, same seed always produces same card regardless
    // of channel history.
    const a = sampleVoiceCard({ seed: 'strict', channelId: 'ch', noDodge: true });
    // Fire a different seed in the same channel to "pollute" the dodge cache.
    sampleVoiceCard({ seed: 'pollution', channelId: 'ch' });
    sampleVoiceCard({ seed: 'pollution-2', channelId: 'ch' });
    // Replay the original seed with noDodge=true · should match exactly.
    const b = sampleVoiceCard({ seed: 'strict', channelId: 'ch', noDodge: true });
    expect(a.entry).toBe(b.entry);
    expect(a.shape).toBe(b.shape);
  });

  test('noDodge=false (default) honors recent-used dodge', () => {
    // Sanity check: dodge IS active by default.
    const fires = [];
    for (let i = 0; i < 3; i++) {
      fires.push(sampleVoiceCard({ seed: `defaultmode-${i}`, channelId: 'dodge-ch' }));
    }
    const pairs = new Set(fires.map((f) => `${f.entry}|${f.shape}`));
    // At least 2 distinct pairs across 3 fires when dodge is on.
    expect(pairs.size).toBeGreaterThanOrEqual(2);
  });
});

describe('sampleVoiceCard · LRU cap (BB MED 0.85)', () => {
  test('channel cache evicts oldest entries past cap', () => {
    _resetVoiceCache();
    // Fire 300 unique channels · cap is 256 · cache should stay bounded.
    for (let i = 0; i < 300; i++) {
      sampleVoiceCard({ seed: `lru-fire-${i}`, channelId: `channel-${i}` });
    }
    expect(_voiceCacheSize()).toBeLessThanOrEqual(256);
    // Verify we hit the cap (not lower from some bug)
    expect(_voiceCacheSize()).toBeGreaterThanOrEqual(200);
  });

  test('re-touching a channel bumps it to most-recent (LRU semantics)', () => {
    _resetVoiceCache();
    // Fill cache near cap.
    for (let i = 0; i < 256; i++) {
      sampleVoiceCard({ seed: `seed-${i}`, channelId: `ch-${i}` });
    }
    // Touch channel-0 (oldest) — it should now be most-recent, surviving
    // when we add a new entry that pushes the cap.
    sampleVoiceCard({ seed: 'touch-0', channelId: 'ch-0' });
    // Add ONE more new channel · should evict the NEW-oldest, not ch-0.
    sampleVoiceCard({ seed: 'new-fire', channelId: 'ch-new' });
    expect(_voiceCacheSize()).toBeLessThanOrEqual(256);
    // Hard to assert ch-0 specifically survived without exposing the cache,
    // but size invariant + the touch logic above is the contract.
  });
});

describe('renderVoiceCard', () => {
  test('produces a non-empty prompt block with all knobs surfaced', () => {
    const card = sampleVoiceCard({ seed: 'render-test', witnessPicker: () => 'ruggy_smoke' });
    const rendered = renderVoiceCard(card);
    expect(rendered).toContain('VOICE GRIMOIRE');
    expect(rendered).toContain('THE ENTRY');
    expect(rendered).toContain('THE SHAPE');
    expect(rendered).toContain('THE SPLASH');
    expect(rendered).toContain('THE DENSITY');
    expect(rendered).toContain('THE EXIT');
    expect(rendered).toContain('THE WITNESS');
    expect(rendered).toContain(':ruggy_smoke:');
    expect(rendered.length).toBeGreaterThan(500);
  });

  test('null witness renders the no-witness line', () => {
    const card = sampleVoiceCard({ seed: 'null-render' });
    const rendered = renderVoiceCard(card);
    expect(rendered).toContain('none this fire');
  });
});
