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
});

afterEach(() => {
  globalThis.fetch = originalFetch;
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
          image_url: 'https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.PNG',
        },
      ],
    );

    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(1);
    expect(result.files![0]!.name).toBe('g4488.png');
    // F10 polish: attachedUrls reflects image_url alt-key URL too
    expect(result.attachedUrls).toEqual([
      'https://assets.0xhoneyjar.xyz/Mibera/grails/hermes.PNG',
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
    globalThis.fetch = mock(async () => {
      return new Response(PNG_MAGIC as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': String(9 * 1024 * 1024), // 9MB > 8MB cap
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
    // Server omits Content-Length but ships >8MB body. The post-arrayBuffer
    // belt-and-braces check should trip and degrade.
    const oversize = new Uint8Array(9 * 1024 * 1024); // 9MB, all zeros
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
});
