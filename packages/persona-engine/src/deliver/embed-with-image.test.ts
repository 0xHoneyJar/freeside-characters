/**
 * composeWithImage tests · V0.7-A.3 sprint Task 1.5.
 *
 * Verifies:
 *   - tool result with `image` field → returns {content, files: [Buffer]}
 *   - fetch failure (non-2xx, timeout, network) → returns text-only
 *   - tool results with no image fields → returns text-only
 *   - multi-image clamp: maxAttachments default 1 → returns single file
 *
 * Mocks the global `fetch` via `bun:test` spyOn so the test exercises the
 * composer's branching without hitting the network.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { composeWithImage, isAllowedImageUrl } from './embed-with-image.ts';
import {
  setGrailBytes,
  _resetGrailCacheForTests,
} from './grail-cache.ts';

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let originalFetch: typeof globalThis.fetch;

function mockFetchOk(body: Uint8Array = PNG_MAGIC): typeof globalThis.fetch {
  return mock(async () => {
    return new Response(body as unknown as BodyInit, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }) as unknown as typeof globalThis.fetch;
}

function mockFetchFail(status: number = 404): typeof globalThis.fetch {
  return mock(async () => {
    return new Response('not found', { status });
  }) as unknown as typeof globalThis.fetch;
}

function mockFetchThrow(): typeof globalThis.fetch {
  return mock(async () => {
    throw new TypeError('fetch failed');
  }) as unknown as typeof globalThis.fetch;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // V0.7-A.4: every test starts with an empty cache so prior live-fetch
  // tests (which now organically populate the cache via setGrailBytes)
  // can't shadow a subsequent mock-fetch assertion. The cache module is
  // process-scoped, so without this reset bun-test ordering effects would
  // leak through.
  _resetGrailCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetGrailCacheForTests();
});

describe('composeWithImage · happy path', () => {
  test('tool result with image URL returns enriched payload', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage(
      'voice text here.',
      [
        {
          ref: '@g876',
          name: 'Black Hole',
          image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
        },
      ],
    );

    expect(result.content).toBe('voice text here.');
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    expect(result.files![0]!.name).toBe('g876.png');
    expect(result.files![0]!.contentType).toBe('image/png');
    expect(result.files![0]!.data.byteLength).toBeGreaterThan(0);
    // F10 polish: attachedUrls present + matches the source URL of the file
    expect(result.attachedUrls).toEqual([
      'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png',
    ]);
  });

  test('image_url field works as alt key', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage(
      'reply.',
      [
        {
          ref: '@g4488',
          name: 'Satoshi-as-Hermes',
          // V0.7-A.4 patch (2026-05-03): was hermes.PNG (403); flipped to
          // mercury.png to mirror CANONICAL_GRAIL_URLS source change.
          image_url: 'https://assets.0xhoneyjar.xyz/Mibera/grails/mercury.png',
        },
      ],
    );

    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    expect(result.files![0]!.name).toBe('g4488.png');
    // F10 polish: attachedUrls reflects image_url alt-key URL too
    expect(result.attachedUrls).toEqual([
      'https://assets.0xhoneyjar.xyz/Mibera/grails/mercury.png',
    ]);
  });
});

describe('composeWithImage · graceful degrade', () => {
  test('fetch 404 returns text-only payload', async () => {
    globalThis.fetch = mockFetchFail(404);

    const result = await composeWithImage(
      'reply text.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/missing.png' }],
    );

    expect(result.content).toBe('reply text.');
    expect(result.files).toBeUndefined();
    // F10 polish: no attached files → no attachedUrls (text-only payload).
    expect(result.attachedUrls).toBeUndefined();
  });

  test('network throw returns text-only payload', async () => {
    globalThis.fetch = mockFetchThrow();

    const result = await composeWithImage(
      'reply text.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/black-hole.png' }],
    );

    expect(result.content).toBe('reply text.');
    expect(result.files).toBeUndefined();
  });

  test('tool results with no image fields returns text-only', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage(
      'no image here.',
      [
        { ref: '@g4221', name: 'Past', description: 'concept grail' },
        { ref: '@g235', name: 'Scorpio' },
      ],
    );

    expect(result.content).toBe('no image here.');
    expect(result.files).toBeUndefined();
  });

  test('empty tool results array returns text-only', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage('only text.', []);

    expect(result.content).toBe('only text.');
    expect(result.files).toBeUndefined();
  });
});

describe('composeWithImage · maxAttachments clamp', () => {
  test('multi-candidate with default maxAttachments=1 returns single file', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage(
      'compare grails.',
      [
        { ref: '@g4488', image: 'https://assets.0xhoneyjar.xyz/hermes.png' },
        { ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/black-hole.png' },
        { ref: '@g235', image: 'https://assets.0xhoneyjar.xyz/scorpio.png' },
      ],
    );

    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    expect(result.files![0]!.name).toBe('g4488.png');
  });

  test('explicit maxAttachments=2 returns up to two files', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await composeWithImage(
      'pair.',
      [
        { ref: '@g4488', image: 'https://assets.0xhoneyjar.xyz/hermes.png' },
        { ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/black-hole.png' },
        { ref: '@g235', image: 'https://assets.0xhoneyjar.xyz/scorpio.png' },
      ],
      { maxAttachments: 2 },
    );

    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(2);
    // F10 polish: attachedUrls aligns 1:1 with files in the same order.
    // The first two candidates win the maxAttachments=2 slice.
    expect(result.attachedUrls).toEqual([
      'https://assets.0xhoneyjar.xyz/hermes.png',
      'https://assets.0xhoneyjar.xyz/black-hole.png',
    ]);
  });
});

describe('isAllowedImageUrl · F5 SSRF allowlist', () => {
  test('https on canonical CDN allowed', () => {
    expect(isAllowedImageUrl('https://assets.0xhoneyjar.xyz/x.png')).toBe(true);
  });

  test('http scheme rejected', () => {
    expect(isAllowedImageUrl('http://assets.0xhoneyjar.xyz/x.png')).toBe(false);
  });

  test('file: scheme rejected', () => {
    expect(isAllowedImageUrl('file:///etc/passwd')).toBe(false);
  });

  test('data: scheme rejected', () => {
    expect(isAllowedImageUrl('data:image/png;base64,iVBOR=')).toBe(false);
  });

  test('cloud-metadata IP (link-local) rejected', () => {
    expect(isAllowedImageUrl('http://169.254.169.254/latest/meta-data/')).toBe(
      false,
    );
  });

  test('localhost rejected', () => {
    expect(isAllowedImageUrl('http://localhost:8080/leak')).toBe(false);
  });

  test('arbitrary attacker host on https rejected', () => {
    expect(isAllowedImageUrl('https://attacker.example/x.png')).toBe(false);
  });

  test('malformed URL returns false (no throw)', () => {
    expect(isAllowedImageUrl('not a url')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });
});

describe('composeWithImage · F5 SSRF graceful degrade', () => {
  test('disallowed scheme (file:) returns text-only', async () => {
    globalThis.fetch = mockFetchOk();
    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'file:///etc/passwd' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });

  test('disallowed host (localhost) returns text-only', async () => {
    globalThis.fetch = mockFetchOk();
    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'http://localhost:8080/leak' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });

  test('disallowed host (cloud metadata IP) returns text-only', async () => {
    globalThis.fetch = mockFetchOk();
    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'http://169.254.169.254/' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });

  test('redirect-error from fetch returns text-only (mock throw)', async () => {
    // Simulates undici throwing on a 301/302 because fetch() received
    // `redirect: 'error'`. F5 mitigation: even if an allowlisted host
    // tried to redirect, fetch would throw and we degrade gracefully.
    globalThis.fetch = mock(async () => {
      throw new TypeError('unexpected redirect');
    }) as unknown as typeof globalThis.fetch;
    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/x.png' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });
});

describe('composeWithImage · F6 size cap', () => {
  test('content-length above cap returns text-only', async () => {
    // V0.7-A.4 patch (2026-05-03): cap bumped 8MB → 12MB to accept measured
    // 9MB grails (`greek.png` PROD evidence · STAMETS DIG). Test size bumped
    // to 13MB to still exercise the rejection path.
    globalThis.fetch = mock(async () => {
      return new Response(PNG_MAGIC as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(13 * 1024 * 1024), // 13MB > 12MB cap
        },
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/big.png' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });

  test('post-fetch byteLength above cap returns text-only (no Content-Length)', async () => {
    // Server omits Content-Length but ships >12MB body. The post-arrayBuffer
    // belt-and-braces check should trip and degrade.
    // V0.7-A.4 patch (2026-05-03): bumped to 13MB to clear the new 12MB cap.
    const oversize = new Uint8Array(13 * 1024 * 1024); // 13MB, all zeros
    globalThis.fetch = mock(async () => {
      return new Response(oversize as unknown as BodyInit, {
        status: 200,
        headers: { 'Content-Type': 'image/png' }, // no Content-Length
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/big.png' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeUndefined();
  });

  test('V0.7-A.4 patch: 9MB image accepted under new 12MB cap (PROD regression)', async () => {
    // V0.7-A.4 patch (2026-05-03 · cycle-A · STAMETS DIG): PROD log evidence
    // showed `greek.png` 9.0MB rejected at the prior 8MB cap →
    // `[embed-with-image] rejected oversize image (content-length 9003216 >
    // 8388608)` → `attached=0` even when the LLM correctly resolved a grail.
    // The 12MB cap MUST accept this case. Pre-fix this test would have failed
    // (rejected as oversize); post-fix it passes — proves the cap is sized
    // for the actual substrate.
    const ninemb = new Uint8Array(9 * 1024 * 1024); // 9MB, mimics greek.png
    globalThis.fetch = mock(async () => {
      return new Response(ninemb as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(9 * 1024 * 1024),
        },
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/Mibera/grails/greek.png' }],
    );
    expect(result.content).toBe('reply.');
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    expect(result.files![0]!.data.byteLength).toBe(9 * 1024 * 1024);
    expect(result.attachedUrls).toEqual([
      'https://assets.0xhoneyjar.xyz/Mibera/grails/greek.png',
    ]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// V0.7-A.4 (cycle-003) — grail-cache integration
// ──────────────────────────────────────────────────────────────────────

describe('composeWithImage · V0.7-A.4 cache-first fast path', () => {
  const CACHED_URL = 'https://assets.0xhoneyjar.xyz/Mibera/grails/black-hole.png';
  const CACHED_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xde, 0xad, 0xbe, 0xef]);

  test('cache hit returns cached bytes WITHOUT invoking fetch', async () => {
    // Pre-populate cache with sentinel bytes.
    setGrailBytes(CACHED_URL, Buffer.from(CACHED_BYTES));

    // Wire a fetch mock that throws — if the cache fast path works, fetch
    // never runs so the throw never fires.
    let fetchCallCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      throw new Error('fetch should NOT be called when cache hit');
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'voice text.',
      [{ ref: '@g876', name: 'Black Hole', image: CACHED_URL }],
    );

    expect(fetchCallCount).toBe(0);
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    // Bytes returned to caller match what was cached.
    expect(Buffer.from(result.files![0]!.data).equals(Buffer.from(CACHED_BYTES))).toBe(true);
    // V0.7-A.4: cache_hits telemetry surfaces to caller for [cold-budget] log.
    expect(result.cacheHits).toBe(1);
    expect(result.attachedUrls).toEqual([CACHED_URL]);
  });

  test('cache miss falls through to live fetch · stores bytes for next call', async () => {
    let fetchCallCount = 0;
    const livePngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      return new Response(livePngMagic as unknown as BodyInit, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      });
    }) as unknown as typeof globalThis.fetch;

    // First call: cache miss → live fetch fires.
    const result1 = await composeWithImage(
      'voice.',
      [{ ref: '@g876', image: CACHED_URL }],
    );
    expect(fetchCallCount).toBe(1);
    expect(result1.files).toBeDefined();
    expect(result1.files!.length).toBe(1);
    expect(result1.cacheHits).toBe(0); // First call is live fetch, not cache.

    // Second call same URL: cache hit (live fetch populated it).
    const result2 = await composeWithImage(
      'voice again.',
      [{ ref: '@g876', image: CACHED_URL }],
    );
    expect(fetchCallCount).toBe(1); // No additional fetch on second call.
    expect(result2.files).toBeDefined();
    expect(result2.cacheHits).toBe(1);
  });

  test('mixed cache + live: counts hits separately', async () => {
    setGrailBytes(CACHED_URL, Buffer.from(CACHED_BYTES));
    const otherUrl = 'https://assets.0xhoneyjar.xyz/Mibera/grails/scorpio.png';
    let fetchCallCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      return new Response(CACHED_BYTES as unknown as BodyInit, { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'pair.',
      [
        { ref: '@g876', image: CACHED_URL },
        { ref: '@g235', image: otherUrl },
      ],
      { maxAttachments: 2 },
    );
    // First candidate hits cache (no fetch); second does live fetch.
    expect(fetchCallCount).toBe(1);
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(2);
    expect(result.cacheHits).toBe(1); // Only the first was a cache hit.
  });

  test('partial cache + partial 404: cacheHits counts only successes (F5 follow-up)', async () => {
    // F5 follow-up (2026-05-02): rewritten from a tautological 1<=1 sanity
    // assertion to exercise the actual invariant — when one candidate hits
    // cache and another candidate's URL 404s, cacheHits must equal exactly
    // the number of successful cache-served attachments (NOT the number of
    // input candidates). The 404 candidate drops out of `files` entirely
    // (per Promise.all + filter null logic), so cacheHits stays at 1.
    setGrailBytes(CACHED_URL, Buffer.from(CACHED_BYTES));
    const failedUrl = 'https://assets.0xhoneyjar.xyz/Mibera/grails/fail-404.png';
    let fetchCallCount = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      fetchCallCount++;
      if (String(input) === failedUrl) {
        return new Response('not found', { status: 404 });
      }
      // Cached URL should never reach fetch; if it does, the test must fail.
      throw new Error(`unexpected fetch for cached url: ${String(input)}`);
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'reply.',
      [
        { ref: '@g876', image: CACHED_URL },
        { ref: '@g999', image: failedUrl },
      ],
      { maxAttachments: 2 },
    );
    expect(fetchCallCount).toBe(1); // Only the failed URL hit fetch.
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1); // The 404 dropped.
    expect(result.cacheHits).toBe(1); // Cached URL counted; failure didn't.
    expect(result.attachedUrls).toEqual([CACHED_URL]);
  });

  test('cacheHits absent when text-only (graceful degrade path)', async () => {
    globalThis.fetch = mockFetchFail(404);
    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: 'https://assets.0xhoneyjar.xyz/never-cached.png' }],
    );
    expect(result.files).toBeUndefined();
    // Per the EnrichedPayload shape, cacheHits is absent when files is absent.
    expect(result.cacheHits).toBeUndefined();
  });
});

describe('composeWithImage · V0.7-A.4 cache kill-switch', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.GRAIL_CACHE_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GRAIL_CACHE_ENABLED;
    } else {
      process.env.GRAIL_CACHE_ENABLED = originalEnv;
    }
  });

  test('GRAIL_CACHE_ENABLED=false skips cache lookup AND skips cache write', async () => {
    process.env.GRAIL_CACHE_ENABLED = 'false';
    const url = 'https://assets.0xhoneyjar.xyz/Mibera/grails/test-killswitch.png';
    // Pre-populate cache with sentinel bytes that are DIFFERENT from what
    // the fetch mock returns. If kill-switch works, the live fetch wins
    // (cache lookup skipped) AND the cache stays untouched (no write).
    setGrailBytes(url, Buffer.from([0xff, 0xff, 0xff]));

    let fetchCallCount = 0;
    const liveBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      return new Response(liveBytes as unknown as BodyInit, { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const result = await composeWithImage(
      'reply.',
      [{ ref: '@g876', image: url }],
    );

    // Kill-switch ON → live fetch fires (cache skipped).
    expect(fetchCallCount).toBe(1);
    expect(result.files).toBeDefined();
    expect(result.cacheHits).toBe(0);
    // Bytes are the live fetch result, not the pre-populated sentinel.
    expect(Buffer.from(result.files![0]!.data).equals(Buffer.from(liveBytes))).toBe(true);
  });
});
