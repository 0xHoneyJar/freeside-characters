/**
 * mint-announcement-render.test.ts — DEP-2 Components-V2 renderer.
 *
 * Pure-function tests (no I/O). Asserts the per-section optionality posture
 * from the build doc §5: header + footer always present; image + traits
 * sections OMITTED when enrichment failed. contentFallback always populated.
 *
 * Mirrors the enriched-render.test.ts pattern (cycle-008 #87) — same
 * Components-V2 shape, different content (one mint instead of a zone digest).
 */

import { describe, expect, test } from 'bun:test';
import {
  buildEnrichedMintAnnouncement,
  MINT_ANNOUNCEMENT_ACCENT,
  MINT_ANNOUNCEMENT_EMOJI,
  type MintAnnouncementContext,
} from './mint-announcement-render.ts';

// Component type ids (mirror enriched-render.ts).
const TYPE_CONTAINER = 17;
const TYPE_TEXT_DISPLAY = 10;
const TYPE_SEPARATOR = 14;
// Full-bleed HERO image — MediaGallery (type 12), replacing the prior
// Section(9)+Thumbnail(11) 80px accessory.
const TYPE_MEDIA_GALLERY = 12;

const BASE_CTX: MintAnnouncementContext = {
  displayName: 'shadowmaker',
  collection: 'Mibera Shadow',
  tokenId: '234',
  imageUrl: 'https://cdn.test/shadow-234.png',
  traits: [
    { trait_type: 'Background', value: 'Void' },
    { trait_type: 'Eyes', value: 'Glowing' },
  ],
  txHash: '0x' + 'ab'.repeat(32),
  chainId: 80094,
  emittedAt: '2026-05-26T21:30:00Z',
};

function extractBlocks(components: unknown[]): unknown[] {
  expect(components.length).toBe(1);
  const container = components[0] as { type: number; components: unknown[]; accent_color: number };
  expect(container.type).toBe(TYPE_CONTAINER);
  return container.components;
}

function countSeparators(blocks: unknown[]): number {
  return blocks.filter((b) => (b as { type: number }).type === TYPE_SEPARATOR).length;
}

function findMediaGallery(blocks: unknown[]): unknown | null {
  return blocks.find((b) => (b as { type: number }).type === TYPE_MEDIA_GALLERY) ?? null;
}

function textContents(blocks: unknown[]): string[] {
  return blocks
    .filter((b) => (b as { type: number }).type === TYPE_TEXT_DISPLAY)
    .map((b) => (b as { content: string }).content);
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('DEP-2 · buildEnrichedMintAnnouncement · happy path', () => {
  test('all fields present → 4 sections (header, image, traits, footer) + 3 separators', () => {
    const out = buildEnrichedMintAnnouncement(BASE_CTX);
    const blocks = extractBlocks(out.components);

    // header (text) + sep + image-gallery (type 12) + sep + traits (text) + sep + footer (text)
    expect(countSeparators(blocks)).toBe(3);

    // image HERO present as a full-bleed MediaGallery (type 12), not a thumbnail
    const gallery = findMediaGallery(blocks);
    expect(gallery).not.toBeNull();
    expect(
      (gallery as { items: Array<{ media: { url: string } }> }).items[0]!.media.url,
    ).toBe('https://cdn.test/shadow-234.png');

    // text contents
    const texts = textContents(blocks);
    expect(texts[0]).toContain('## 🌒 Mibera Shadow');
    expect(texts[0]).toContain('**shadowmaker**');
    expect(texts[0]).toContain('#234');

    // traits row joined with separator
    const traitsText = texts.find((t) => t.includes('Traits'));
    expect(traitsText).toContain('**Background** · Void');
    expect(traitsText).toContain('**Eyes** · Glowing');

    // footer carries tx + chain marker
    const footer = texts[texts.length - 1]!;
    expect(footer).toContain('berascan.com');
    expect(footer).toContain('Berachain');
  });

  test('contentFallback always populated with key fields', () => {
    const out = buildEnrichedMintAnnouncement(BASE_CTX);
    expect(out.contentFallback).toContain('shadowmaker');
    expect(out.contentFallback).toContain('#234');
    expect(out.contentFallback).toContain('Mibera Shadow');
    expect(out.contentFallback).toContain('https://cdn.test/shadow-234.png');
    expect(out.contentFallback).toContain('berascan.com');
  });

  test('container has MST accent color', () => {
    const out = buildEnrichedMintAnnouncement(BASE_CTX);
    const container = out.components[0] as { accent_color: number };
    expect(container.accent_color).toBe(MINT_ANNOUNCEMENT_ACCENT);
  });

  test('header uses canonical MST emoji', () => {
    const out = buildEnrichedMintAnnouncement(BASE_CTX);
    const blocks = extractBlocks(out.components);
    const header = textContents(blocks)[0]!;
    expect(header).toContain(MINT_ANNOUNCEMENT_EMOJI);
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · image omitted', () => {
  test('imageUrl null → no image gallery; header + traits + footer remain', () => {
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, imageUrl: null });
    const blocks = extractBlocks(out.components);

    // MediaGallery (type 12) should NOT appear
    expect(findMediaGallery(blocks)).toBeNull();

    // traits still rendered
    const traitsText = textContents(blocks).find((t) => t.includes('Traits'));
    expect(traitsText).toBeDefined();
  });

  test('contentFallback omits image URL when imageUrl is null', () => {
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, imageUrl: null });
    expect(out.contentFallback).not.toContain('https://cdn.test');
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · traits omitted', () => {
  test('traits null → no traits text; header + image + footer remain', () => {
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, traits: null });
    const blocks = extractBlocks(out.components);

    // no "Traits" text content
    expect(textContents(blocks).some((t) => t.includes('Traits'))).toBe(false);

    // image gallery still present
    expect(findMediaGallery(blocks)).not.toBeNull();
  });

  test('traits empty array → treated like null (no traits text)', () => {
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, traits: [] });
    const blocks = extractBlocks(out.components);
    expect(textContents(blocks).some((t) => t.includes('Traits'))).toBe(false);
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · both image + traits omitted (minimal canary post)', () => {
  test('imageUrl null + traits null → header + footer only (canary-safe minimal)', () => {
    const out = buildEnrichedMintAnnouncement({
      ...BASE_CTX,
      imageUrl: null,
      traits: null,
    });
    const blocks = extractBlocks(out.components);

    expect(findMediaGallery(blocks)).toBeNull();
    const texts = textContents(blocks);
    // header + footer = 2 text displays
    expect(texts.length).toBe(2);
    // only ONE separator (between header and footer)
    expect(countSeparators(blocks)).toBe(1);

    // contentFallback still carries displayName + tokenId + tx
    expect(out.contentFallback).toContain('shadowmaker');
    expect(out.contentFallback).toContain('#234');
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · escape contract', () => {
  test('displayName carrying markdown chars is escaped at the boundary', () => {
    const out = buildEnrichedMintAnnouncement({
      ...BASE_CTX,
      displayName: 'mibera_*shadow*',
    });
    const blocks = extractBlocks(out.components);
    const header = textContents(blocks)[0]!;
    // escapeDiscordMarkdown wraps disruptive chars; the raw markdown sequence
    // must not survive into the rendered prose
    expect(header).not.toContain('_*shadow*');
  });

  test('trait values carrying markdown chars are escaped at the boundary', () => {
    const out = buildEnrichedMintAnnouncement({
      ...BASE_CTX,
      traits: [{ trait_type: 'Vibe', value: '*radiant*' }],
    });
    const blocks = extractBlocks(out.components);
    const traitsText = textContents(blocks).find((t) => t.includes('Vibe'))!;
    // the raw value with disruptive markdown is escaped (we don't assert exact
    // escape form — only that the bare disruptive sequence isn't preserved)
    expect(traitsText).not.toContain('*radiant*');
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · chain-label fallback', () => {
  test('unknown chainId → footer falls back to "chain N" without explorer link', () => {
    const out = buildEnrichedMintAnnouncement({
      ...BASE_CTX,
      chainId: 999999,
    });
    const blocks = extractBlocks(out.components);
    const footer = textContents(blocks).slice(-1)[0]!;
    expect(footer).toContain('chain 999999');
    expect(footer).not.toContain('berascan');
  });

  test('Ethereum chainId → etherscan link', () => {
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, chainId: 1 });
    const blocks = extractBlocks(out.components);
    const footer = textContents(blocks).slice(-1)[0]!;
    expect(footer).toContain('etherscan.io');
    expect(footer).toContain('Ethereum');
  });
});

describe('DEP-2 · buildEnrichedMintAnnouncement · trait cap', () => {
  test('more than 6 traits → capped at 6 (scannable)', () => {
    const manyTraits = Array.from({ length: 10 }, (_, i) => ({
      trait_type: `T${i}`,
      value: `V${i}`,
    }));
    const out = buildEnrichedMintAnnouncement({ ...BASE_CTX, traits: manyTraits });
    const blocks = extractBlocks(out.components);
    const traitsText = textContents(blocks).find((t) => t.includes('Traits'))!;
    expect(traitsText).toContain('T0');
    expect(traitsText).toContain('T5');
    expect(traitsText).not.toContain('T6');
    expect(traitsText).not.toContain('T9');
  });
});
