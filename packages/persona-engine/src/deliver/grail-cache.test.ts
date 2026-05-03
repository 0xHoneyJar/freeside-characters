/**
 * grail-cache tests · V0.7-A.4 sprint Task T1.6.
 *
 * Verifies the boot-prefetch substrate that closes V0.7-A.3 cold-latency:
 *   - initGrailCache populates cache on success → subsequent get returns Buffer
 *   - cache miss after TTL expiry → get returns null + entry evicted
 *   - concurrent initGrailCache calls dedup (single in-flight Promise)
 *   - per-URL boot failures are non-blocking (InitResult.failed counts them)
 *   - isCacheEnabled honors GRAIL_CACHE_ENABLED env (defaults true)
 *   - setGrailBytes (live-fetch organic re-warm) populates cache for read
 *
 * Mocks the global `fetch` via `bun:test` mock so the test exercises the
 * cache substrate without hitting the network. All tests reset cache
 * state via `_resetGrailCacheForTests` in beforeEach so cross-test
 * pollution can't mask broken invalidation logic.
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  mock,
} from 'bun:test';

import {
  initGrailCache,
  getGrailBytes,
  setGrailBytes,
  isCacheEnabled,
  _resetGrailCacheForTests,
  _grailCacheSizeForTests,
  _canonicalGrailUrlsForTests,
} from './grail-cache.ts';

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TEST_URL = 'https://assets.0xhoneyjar.xyz/Mibera/grails/test.png';
const TEST_URL_2 = 'https://assets.0xhoneyjar.xyz/Mibera/grails/another.png';

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
  _resetGrailCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _resetGrailCacheForTests();
});

describe('initGrailCache · happy path', () => {
  test('populates cache for each URL · subsequent get returns Buffer', async () => {
    globalThis.fetch = mockFetchOk();

    const result = await initGrailCache({
      urls: [TEST_URL, TEST_URL_2],
      concurrency: 2,
    });

    expect(result.fetched).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(_grailCacheSizeForTests()).toBe(2);

    const bytes1 = getGrailBytes(TEST_URL);
    expect(bytes1).not.toBeNull();
    expect(Buffer.isBuffer(bytes1)).toBe(true);
    expect(bytes1!.byteLength).toBeGreaterThan(0);

    const bytes2 = getGrailBytes(TEST_URL_2);
    expect(bytes2).not.toBeNull();
  });

  test('default URL list is the canonical V1 set (non-empty)', () => {
    const urls = _canonicalGrailUrlsForTests();
    expect(urls.length).toBeGreaterThan(0);
    // All URLs must be on the allowlisted CDN host so they pass the
    // SSRF guard in embed-with-image.ts when looked up at runtime.
    for (const url of urls) {
      expect(url.startsWith('https://assets.0xhoneyjar.xyz/')).toBe(true);
    }
  });
});

describe('initGrailCache · failures are non-blocking', () => {
  test('per-URL fetch failure counts in InitResult.failed but does not throw', async () => {
    globalThis.fetch = mockFetchFail(404);

    const result = await initGrailCache({
      urls: [TEST_URL, TEST_URL_2],
      concurrency: 2,
    });

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(2);
    // Cache should be empty — failed fetches must not pollute the Map.
    expect(_grailCacheSizeForTests()).toBe(0);
    expect(getGrailBytes(TEST_URL)).toBeNull();
  });

  test('network throw does not propagate · counted as failed', async () => {
    globalThis.fetch = mockFetchThrow();

    const result = await initGrailCache({ urls: [TEST_URL] });

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(1);
  });

  test('mixed success and failure · partial cache fill', async () => {
    let callCount = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      callCount++;
      const url = String(input);
      if (url.includes('test.png')) {
        return new Response(PNG_MAGIC as unknown as BodyInit, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof globalThis.fetch;

    const result = await initGrailCache({
      urls: [TEST_URL, TEST_URL_2],
      concurrency: 2,
    });

    expect(callCount).toBe(2);
    expect(result.fetched).toBe(1);
    expect(result.failed).toBe(1);
    expect(getGrailBytes(TEST_URL)).not.toBeNull();
    expect(getGrailBytes(TEST_URL_2)).toBeNull();
  });

  test('empty body counts as failed (defensive against empty CDN responses)', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(new Uint8Array(0) as unknown as BodyInit, {
        status: 200,
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await initGrailCache({ urls: [TEST_URL] });

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(1);
    expect(_grailCacheSizeForTests()).toBe(0);
  });

  test('F3 follow-up: oversize Content-Length response counts as failed', async () => {
    // F3 follow-up (2026-05-02): boot prefetch caps per-entry (defense-in-depth ·
    // mirrors live-fetch path). Pre-fix the prefetch would store any size
    // verbatim, breaking memory residency claims at V1.5 scale. Post-fix
    // oversize Content-Length is rejected before arrayBuffer.
    // V0.7-A.4 patch (2026-05-03): cap bumped 5MB → 12MB to cover measured
    // 5-9MB grail set (PROD log evidence · STAMETS DIG). Test sizes bumped
    // to still exercise the rejection path under the new cap.
    globalThis.fetch = mock(async () => {
      return new Response(PNG_MAGIC as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(13 * 1024 * 1024), // 13MB > 12MB cap
        },
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await initGrailCache({ urls: [TEST_URL] });

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(1);
    expect(_grailCacheSizeForTests()).toBe(0);
  });

  test('F3 follow-up: oversize body without Content-Length rejected (belt-and-braces)', async () => {
    // Some CDNs omit Content-Length on chunked transfers; the post-arrayBuffer
    // byteLength check catches that case.
    // V0.7-A.4 patch (2026-05-03): bumped to 13MB to clear the new 12MB cap.
    const oversize = new Uint8Array(13 * 1024 * 1024); // 13MB, all zeros
    globalThis.fetch = mock(async () => {
      return new Response(oversize as unknown as BodyInit, {
        status: 200,
        headers: { 'Content-Type': 'image/png' }, // no Content-Length
      });
    }) as unknown as typeof globalThis.fetch;

    const result = await initGrailCache({ urls: [TEST_URL] });

    expect(result.fetched).toBe(0);
    expect(result.failed).toBe(1);
    expect(_grailCacheSizeForTests()).toBe(0);
  });

  test('V0.7-A.4 patch: 9MB grail accepted under new 12MB cap (PROD regression)', async () => {
    // V0.7-A.4 patch (2026-05-03 · cycle-A · STAMETS DIG): PROD log evidence
    // showed 6/7 grails rejected at the prior 5MB cap because measured grail
    // PNGs are 5-9MB. The 12MB cap MUST accept the worst-measured case
    // (`greek.png` 9.0MB) AND a representative grail (`black-hole.png` 6.4MB).
    // Pre-fix this test would have failed (rejected as oversize); post-fix it
    // passes — proves the cap is sized for the actual substrate.
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

    const result = await initGrailCache({ urls: [TEST_URL] });

    expect(result.fetched).toBe(1);
    expect(result.failed).toBe(0);
    expect(_grailCacheSizeForTests()).toBe(1);
    expect(getGrailBytes(TEST_URL)?.byteLength).toBe(9 * 1024 * 1024);
  });
});

describe('CANONICAL_GRAIL_URLS · V0.7-A.4 patch (hermes 403 → mercury fix)', () => {
  test('mercury.png is in the canonical V1 list (Roman name for Hermes · #4488)', () => {
    // V0.7-A.4 patch (2026-05-03): hermes.PNG returned 403 from S3 in PROD
    // (file genuinely doesn't exist). Replaced with mercury.png (Roman name
    // for the same archetype, grail #4488 Satoshi-as-Hermes) — verified 200
    // at 6.8MB. Cycle B URL canonicalization will replace this hardcoded
    // patch with substrate-discovered URLs.
    const urls = _canonicalGrailUrlsForTests();
    expect(
      urls.includes('https://assets.0xhoneyjar.xyz/Mibera/grails/mercury.png'),
    ).toBe(true);
  });

  test('hermes.PNG is NOT in the canonical V1 list (was 403 in PROD)', () => {
    // Asserts the broken URL stays out — guards against an accidental revert
    // of the V0.7-A.4 patch. If a future contributor re-adds hermes.PNG, this
    // test will catch it before another PROD prefetch failure.
    const urls = _canonicalGrailUrlsForTests();
    expect(
      urls.includes('https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.PNG'),
    ).toBe(false);
    expect(
      urls.includes('https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.png'),
    ).toBe(false);
  });
});

describe('initGrailCache · concurrent dedup', () => {
  test('two parallel calls share the same in-flight Promise · single fetch per URL', async () => {
    let fetchCallCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      // Slow fetch so the second initGrailCache call lands while the first
      // is still in-flight. If dedup is broken, fetchCallCount goes to 4
      // (2 URLs × 2 init calls); when working, stays at 2.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(PNG_MAGIC as unknown as BodyInit, { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    const [r1, r2] = await Promise.all([
      initGrailCache({ urls: [TEST_URL, TEST_URL_2] }),
      initGrailCache({ urls: [TEST_URL, TEST_URL_2] }),
    ]);

    expect(fetchCallCount).toBe(2);
    // Both callers see the same result object.
    expect(r1).toBe(r2);
    expect(r1.fetched).toBe(2);
  });

  test('F1 follow-up: explicit re-init after resolution actually re-runs', async () => {
    // F1 follow-up (2026-05-02): the prior implementation never cleared
    // initInFlight after resolve, so a startup that ran while CDN was
    // unreachable left the cache cold for the entire process lifetime
    // (explicit re-init was silently a no-op). Now cleared on resolution.
    let fetchCallCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCallCount++;
      return new Response(PNG_MAGIC as unknown as BodyInit, { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    // First init resolves.
    const r1 = await initGrailCache({ urls: [TEST_URL] });
    expect(r1.fetched).toBe(1);
    expect(fetchCallCount).toBe(1);

    // Second explicit init AFTER first resolved must actually re-fetch
    // (the dedup window is in-flight only). Pre-fix this would short-circuit
    // and return the stale Promise; post-fix the count goes to 2.
    const r2 = await initGrailCache({ urls: [TEST_URL] });
    expect(r2.fetched).toBe(1);
    expect(fetchCallCount).toBe(2); // Re-fetched.
    // Distinct result objects (each call ran independently after the first
    // resolved) — confirms the dedup window closed.
    expect(r1).not.toBe(r2);
  });
});

describe('getGrailBytes · TTL behavior', () => {
  test('returns cached buffer immediately after set', () => {
    setGrailBytes(TEST_URL, Buffer.from(PNG_MAGIC));
    const result = getGrailBytes(TEST_URL);
    expect(result).not.toBeNull();
    expect(result!.byteLength).toBe(PNG_MAGIC.byteLength);
  });

  test('returns null when URL not in cache', () => {
    expect(getGrailBytes('https://assets.0xhoneyjar.xyz/never-cached.png')).toBeNull();
  });

  test('TTL-expired entry returns null AND evicts itself', () => {
    // Mock Date.now to step time forward past the 24h TTL. Two windows:
    // (1) at t0: write entry (timestamps with t0)
    // (2) at t0 + 25h: read → past TTL → null + evict
    const t0 = 1_700_000_000_000; // arbitrary epoch ms
    const realNow = Date.now;
    let mockedNow = t0;
    Date.now = () => mockedNow;
    try {
      setGrailBytes(TEST_URL, Buffer.from(PNG_MAGIC));
      // Move clock 25h forward — past 24h TTL.
      mockedNow = t0 + 25 * 60 * 60 * 1000;
      const result = getGrailBytes(TEST_URL);
      expect(result).toBeNull();
      // Reset clock + verify the entry was evicted (so a re-set within
      // the same test doesn't accidentally read a stale buffer).
      mockedNow = t0 + 26 * 60 * 60 * 1000;
      expect(_grailCacheSizeForTests()).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });

  test('entry just under TTL still returns cached buffer', () => {
    const t0 = 1_700_000_000_000;
    const realNow = Date.now;
    let mockedNow = t0;
    Date.now = () => mockedNow;
    try {
      setGrailBytes(TEST_URL, Buffer.from(PNG_MAGIC));
      // Move 23h59m forward — still under TTL.
      mockedNow = t0 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
      const result = getGrailBytes(TEST_URL);
      expect(result).not.toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});

describe('isCacheEnabled · env flag', () => {
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

  test('defaults to enabled when env unset', () => {
    delete process.env.GRAIL_CACHE_ENABLED;
    expect(isCacheEnabled()).toBe(true);
  });

  test('enabled when env="true"', () => {
    process.env.GRAIL_CACHE_ENABLED = 'true';
    expect(isCacheEnabled()).toBe(true);
  });

  test('disabled when env="false"', () => {
    process.env.GRAIL_CACHE_ENABLED = 'false';
    expect(isCacheEnabled()).toBe(false);
  });

  test('disabled when env="0"', () => {
    process.env.GRAIL_CACHE_ENABLED = '0';
    expect(isCacheEnabled()).toBe(false);
  });

  test('any other value treated as enabled (defensive default-on)', () => {
    process.env.GRAIL_CACHE_ENABLED = 'yes';
    expect(isCacheEnabled()).toBe(true);
    process.env.GRAIL_CACHE_ENABLED = '';
    expect(isCacheEnabled()).toBe(true);
  });
});

describe('setGrailBytes · live-fetch organic re-warm', () => {
  test('called from live-fetch path makes subsequent get a hit', () => {
    // Simulates the cycle:
    // 1. composeWithImage cache miss → live fetch
    // 2. live fetch success → setGrailBytes(url, data)
    // 3. next composeWithImage call same URL → cache hit
    expect(getGrailBytes(TEST_URL)).toBeNull();
    setGrailBytes(TEST_URL, Buffer.from(PNG_MAGIC));
    expect(getGrailBytes(TEST_URL)).not.toBeNull();
  });

  test('overwriting same URL refreshes cachedAt timestamp', () => {
    const t0 = 1_700_000_000_000;
    const realNow = Date.now;
    let mockedNow = t0;
    Date.now = () => mockedNow;
    try {
      setGrailBytes(TEST_URL, Buffer.from([0x01]));
      mockedNow = t0 + 23 * 60 * 60 * 1000; // 23h later
      // Re-write at near-TTL → cachedAt moves to now → effectively another
      // 24h window before expiry.
      setGrailBytes(TEST_URL, Buffer.from([0x02]));
      mockedNow = t0 + 23 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000; // 35h after t0
      const result = getGrailBytes(TEST_URL);
      expect(result).not.toBeNull();
      expect(result![0]).toBe(0x02);
    } finally {
      Date.now = realNow;
    }
  });
});
