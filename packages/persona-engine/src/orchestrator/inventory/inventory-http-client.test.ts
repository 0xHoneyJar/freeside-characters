// Hermetic tests for the inventory-api HTTP client (#87 GAP-2). All fetches are
// mocked via an injected `doFetch` — NO real network. The fail-soft posture is
// the load-bearing contract: every non-happy path returns null, never throws.

import { describe, expect, test } from 'bun:test';
import { fetchNftMetadataHttp, fetchProfilePictureHttp } from './inventory-http-client.ts';
import type { MintEventSubscriberLogger } from '../../events/mint-event-subscriber.ts';

// A logger that records nothing but satisfies the interface (warn is the only
// path the client uses; we assert behavior, not log content).
const silentLogger: MintEventSubscriberLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Build a fetch stub that returns one canned Response (ok=200 unless overridden). */
function jsonFetch(body: unknown, init: { status?: number; ok?: boolean } = {}): typeof fetch {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return (async () =>
    ({
      ok,
      status,
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch;
}

const WALLET = '0xAB00000000000000000000000000000000000Cd';

describe('fetchProfilePictureHttp · #87 GAP-2 spotlight pfp (fail-soft mirror of fetchNftMetadataHttp)', () => {
  test('happy: imageUrl on an allowlisted https host → returned verbatim', async () => {
    const url = 'https://assets.0xhoneyjar.xyz/mibera/pfp/1234.png';
    let calledUrl = '';
    const doFetch = (async (input: string) => {
      calledUrl = String(input);
      return {
        ok: true,
        status: 200,
        json: async () => ({ address: WALLET, contract: '0x6666', imageUrl: url }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });

    expect(out).toBe(url);
    // GETs {baseUrl}/profile/{encodeURIComponent(wallet.toLowerCase())} — base trailing slashes
    // trimmed, wallet LOWERCASED defensively so a checksummed address can't 404 a case-sensitive
    // inventory-api (WALLET is intentionally mixed-case → this locks the normalization).
    expect(calledUrl).toBe(`https://inventory.0xhoneyjar.xyz/profile/${encodeURIComponent(WALLET.toLowerCase())}`);
  });

  test('trims trailing slashes on baseUrl before composing the route', async () => {
    let calledUrl = '';
    const doFetch = (async (input: string) => {
      calledUrl = String(input);
      return {
        ok: true,
        status: 200,
        json: async () => ({ imageUrl: 'https://assets.0xhoneyjar.xyz/x.png' }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz///',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(calledUrl).toBe(`https://inventory.0xhoneyjar.xyz/profile/${encodeURIComponent(WALLET.toLowerCase())}`);
  });

  test('imageUrl: null in the body → null (no pfp on file)', async () => {
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch: jsonFetch({ address: WALLET, contract: '0x6666', imageUrl: null }),
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('off-allowlist host (good https, wrong domain) → null (Discord-card trust boundary)', async () => {
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch: jsonFetch({ imageUrl: 'https://evil.example.com/steal.png' }),
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('non-https scheme (data:) on imageUrl → null', async () => {
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch: jsonFetch({ imageUrl: 'data:image/png;base64,AAAA' }),
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('non-OK status (404) → null', async () => {
    let warned = false;
    const logger: MintEventSubscriberLogger = {
      info: () => {},
      warn: () => {
        warned = true;
      },
      error: () => {},
    };
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch: jsonFetch({ error: 'not found' }, { status: 404, ok: false }),
      logger,
    });
    expect(out).toBeNull();
    expect(warned).toBe(true);
  });

  test('non-OK status (500) → null', async () => {
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch: jsonFetch({}, { status: 500, ok: false }),
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('a thrown fetch (network failure) → null, never propagates', async () => {
    const doFetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('malformed JSON body (json() throws) → null', async () => {
    const doFetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('timeout/abort: a hung fetch is aborted by the timer → null (digest never wedged)', async () => {
    // The fetch honors the AbortSignal: rejects with an AbortError when the
    // controller fires, exactly as the real runtime fetch does.
    const doFetch = ((_url: string, opts?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = opts?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            (err as Error & { name: string }).name = 'AbortError';
            reject(err);
          });
        }
        // never resolves on its own
      })) as unknown as typeof fetch;

    const out = await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 10, // fire fast
      doFetch,
      logger: silentLogger,
    });
    expect(out).toBeNull();
  });

  test('missing baseUrl (empty string) → no fetch, null (dormant-until-deployed)', async () => {
    let fetchCalled = false;
    const doFetch = (async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ imageUrl: 'https://assets.0xhoneyjar.xyz/x.png' }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const out = await fetchProfilePictureHttp({
      baseUrl: '',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(out).toBeNull();
    expect(fetchCalled).toBe(false); // no network attempt when unconfigured
  });

  test('whitespace-only baseUrl → no fetch, null', async () => {
    let fetchCalled = false;
    const doFetch = (async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({ imageUrl: null }) } as unknown as Response;
    }) as unknown as typeof fetch;

    const out = await fetchProfilePictureHttp({
      baseUrl: '   ',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(out).toBeNull();
    expect(fetchCalled).toBe(false);
  });

  test('sends accept: application/json (mirrors the metadata client)', async () => {
    let sentAccept: string | undefined;
    const doFetch = (async (_url: string, opts?: { headers?: Record<string, string> }) => {
      sentAccept = opts?.headers?.accept;
      return { ok: true, status: 200, json: async () => ({ imageUrl: null }) } as unknown as Response;
    }) as unknown as typeof fetch;

    await fetchProfilePictureHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      wallet: WALLET,
      timeoutMs: 1000,
      doFetch,
      logger: silentLogger,
    });
    expect(sentAccept).toBe('application/json');
  });
});

// Sanity: the existing metadata client still behaves (guards against a regression
// in the shared safeImageUrl guard during this change).
describe('fetchNftMetadataHttp · unchanged shared-guard sanity', () => {
  test('still passes an allowlisted https image and drops off-host', async () => {
    const ok = await fetchNftMetadataHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      contract: '0x6666',
      tokenId: '1',
      timeoutMs: 1000,
      doFetch: jsonFetch({ image: 'https://assets.0xhoneyjar.xyz/a.png', attributes: [] }),
      logger: silentLogger,
    });
    expect(ok?.image).toBe('https://assets.0xhoneyjar.xyz/a.png');

    const bad = await fetchNftMetadataHttp({
      baseUrl: 'https://inventory.0xhoneyjar.xyz',
      contract: '0x6666',
      tokenId: '1',
      timeoutMs: 1000,
      doFetch: jsonFetch({ image: 'https://evil.example/a.png', attributes: [] }),
      logger: silentLogger,
    });
    expect(bad?.image).toBeNull();
  });
});
