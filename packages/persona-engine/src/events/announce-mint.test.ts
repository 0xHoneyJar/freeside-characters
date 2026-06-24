/**
 * announce-mint.test.ts — DEP-2 enrichment + dispatch contract.
 *
 * Covers the fail-soft posture mandated by the build doc §5 + task brief §5:
 *   - Happy path: both enrichments succeed → renderer receives nym + image + traits
 *   - identity-api fail-soft → renderer receives shortAddress
 *   - inventory-api fail-soft → renderer receives null image + null traits
 *   - Both fail-soft → still posts (canary visibility) with shortAddress only
 *   - discordWebhookSendFn throws → returns { posted: false, reason } (subscriber stays alive)
 *   - Timeout: identity fetch exceeds fetchTimeoutMs → treated as failure
 *
 * Both enrichment paths are HTTP. identity-api uses the injectable `fetchFn`
 * seam; inventory-api (GET /nfts/{contract}/{tokenId}) uses the dedicated
 * `metadataFetchFn` seam so the two stay independently mockable. No real
 * network I/O. The `@0xhoneyjar/inventory` dynamic import (phantom dep) is
 * gone — inventory-api is consumed over the wire, never as a package.
 */

import { describe, expect, test } from 'bun:test';
import {
  announceMint,
  shortenAddress,
  extractMiberaNym,
  deriveCollectionDisplay,
  type DiscordMessagePayload,
} from './announce-mint.ts';
import type { NftMintDetected } from '@0xhoneyjar/events';
import type { MintEventSubscriberLogger } from './mint-event-subscriber.ts';

// ── fixtures ─────────────────────────────────────────────────────────────────

const MST_CONTRACT = '0x048327a187b944ddac61c6e202bfccd20d17c008';

const PAYLOAD: NftMintDetected = {
  chain_id: 80094,
  contract: MST_CONTRACT,
  token_id: '234',
  minter: '0x000000000000000000000000000000000000abcd',
  block_number: 12345678,
  transaction_hash: '0x' + 'ab'.repeat(32),
  timestamp: '2026-05-26T21:30:00Z',
};

function makeSpyLogger(): MintEventSubscriberLogger & {
  infos: Array<{ obj: unknown; msg?: string }>;
  warns: Array<{ obj: unknown; msg?: string }>;
  errors: Array<{ obj: unknown; msg?: string }>;
} {
  const infos: Array<{ obj: unknown; msg?: string }> = [];
  const warns: Array<{ obj: unknown; msg?: string }> = [];
  const errors: Array<{ obj: unknown; msg?: string }> = [];
  return {
    info: (obj, msg) => infos.push({ obj, msg }),
    warn: (obj, msg) => warns.push({ obj, msg }),
    error: (obj, msg) => errors.push({ obj, msg }),
    infos,
    warns,
    errors,
  };
}

function makeSpySender(): {
  send: (msg: DiscordMessagePayload) => Promise<void>;
  calls: DiscordMessagePayload[];
} {
  const calls: DiscordMessagePayload[] = [];
  return {
    send: async (msg) => {
      calls.push(msg);
    },
    calls,
  };
}

/**
 * Build a fake fetch that returns a JSON body for the identity-api endpoint.
 * Set `nym: undefined` to simulate a wallet with no mibera-world nym.
 * Set `throwError: true` to simulate a network failure.
 * Set `delayMs` to simulate a slow response (for timeout testing).
 */
function makeFakeFetch(opts: {
  nym?: string | null;
  status?: number;
  throwError?: boolean;
  delayMs?: number;
}): typeof fetch {
  return (async (_url: string | URL, init?: RequestInit) => {
    if (opts.throwError) {
      throw new Error('network unreachable');
    }
    if (opts.delayMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, opts.delayMs);
        // honor abort signal so AbortController timeout works under bun:test
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    const body = {
      identity: {
        world_identities:
          opts.nym !== undefined
            ? [{ world_slug: 'mibera', nym: opts.nym }]
            : [],
      },
    };
    return {
      ok: (opts.status ?? 200) >= 200 && (opts.status ?? 200) < 300,
      status: opts.status ?? 200,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

/**
 * Build a fake fetch for the inventory-api endpoint
 * (GET /nfts/{contract}/{tokenId} → metadata document, unwrapped).
 *   - `metadata` set → 200 with that body (image + attributes).
 *   - `status` (e.g. 404) → non-OK → client fail-softs to null.
 *   - `throwError` → network failure.
 *   - `delayMs` → slow response (honors abort signal for timeout testing).
 */
function makeInventoryFetch(opts: {
  metadata?: { image?: string | null; attributes?: Array<{ trait_type?: string; value?: string | number }> } | null;
  status?: number;
  throwError?: boolean;
  delayMs?: number;
}): typeof fetch {
  return (async (_url: string | URL, init?: RequestInit) => {
    if (opts.throwError) {
      throw new Error('inventory unreachable');
    }
    if (opts.delayMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, opts.delayMs);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    const status = opts.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => opts.metadata ?? { error: { status, message: 'not found' } },
    } as Response;
  }) as unknown as typeof fetch;
}

// ── helper exports tests ─────────────────────────────────────────────────────

describe('DEP-2 · helpers', () => {
  test('shortenAddress: 0xABCD…wxyz form (NEVER ENS)', () => {
    expect(shortenAddress('0x000000000000000000000000000000000000abcd')).toBe(
      '0x0000…abcd',
    );
  });

  test('shortenAddress: passthrough on malformed input', () => {
    expect(shortenAddress('not-an-address')).toBe('not-an-address');
    expect(shortenAddress('0xabc')).toBe('0xabc'); // too short → passthrough
  });

  test('extractMiberaNym: returns nym when mibera world present', () => {
    expect(
      extractMiberaNym({
        identity: { world_identities: [{ world_slug: 'mibera', nym: 'shadowmaker' }] },
      }),
    ).toBe('shadowmaker');
  });

  test('extractMiberaNym: returns null when no mibera world', () => {
    expect(
      extractMiberaNym({
        identity: { world_identities: [{ world_slug: 'arrakis', nym: 'spiceboy' }] },
      }),
    ).toBeNull();
  });

  test('extractMiberaNym: returns null when nym empty or whitespace', () => {
    expect(
      extractMiberaNym({
        identity: { world_identities: [{ world_slug: 'mibera', nym: '' }] },
      }),
    ).toBeNull();
    expect(
      extractMiberaNym({
        identity: { world_identities: [{ world_slug: 'mibera', nym: '   ' }] },
      }),
    ).toBeNull();
  });

  test('extractMiberaNym: defensive returns null on malformed shapes', () => {
    expect(extractMiberaNym(null)).toBeNull();
    expect(extractMiberaNym(undefined)).toBeNull();
    expect(extractMiberaNym({})).toBeNull();
    expect(extractMiberaNym({ identity: {} })).toBeNull();
    expect(extractMiberaNym({ identity: { world_identities: null } })).toBeNull();
  });

  test('deriveCollectionDisplay: MST contract → Mibera Shadow', () => {
    expect(deriveCollectionDisplay(MST_CONTRACT)).toBe('Mibera Shadow');
    expect(deriveCollectionDisplay(MST_CONTRACT.toUpperCase())).toBe('Mibera Shadow');
    expect(deriveCollectionDisplay('0xdead00000000000000000000000000000000beef')).toBe('NFT');
  });
});

// ── announceMint tests ───────────────────────────────────────────────────────

describe('DEP-2 · announceMint · happy path', () => {
  test('both enrichments succeed → renderer receives nym + image + traits', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      inventoryApiBaseUrl: 'https://inventory.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      metadataFetchFn: makeInventoryFetch({
        metadata: {
          image: 'https://assets.0xhoneyjar.xyz/Mibera/generated/234.webp',
          attributes: [
            { trait_type: 'Background', value: 'Void' },
            { trait_type: 'Eyes', value: 'Glowing' },
          ],
        },
      }),
    });

    expect(result.posted).toBe(true);
    expect(sender.calls.length).toBe(1);
    const msg = sender.calls[0]!;
    expect(msg.channelId).toBe('CHAN_123');
    expect(Array.isArray(msg.components)).toBe(true);
    // ensure plain-text fallback carries the nym
    expect(msg.contentFallback).toContain('shadowmaker');
    expect(msg.contentFallback).toContain('#234');
    expect(msg.contentFallback).toContain('https://assets.0xhoneyjar.xyz/Mibera/generated/234.webp');
  });

  test('off-domain / non-allowlisted image URL is dropped (no injection into the card)', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      inventoryApiBaseUrl: 'https://inventory.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      metadataFetchFn: makeInventoryFetch({
        // off-domain host — an injection vector if rendered. The client's
        // allowlist guard must drop it; traits still flow.
        metadata: {
          image: 'https://cdn.evil/pwn.png',
          attributes: [{ trait_type: 'Background', value: 'Void' }],
        },
      }),
    });

    expect(result.posted).toBe(true);
    const msg = sender.calls[0]!;
    expect(msg.contentFallback).not.toContain('cdn.evil'); // image omitted
    expect(msg.contentFallback).toContain('shadowmaker'); // announcement still ships
  });
});

describe('DEP-2 · announceMint · identity-api fail-soft', () => {
  test('identity fetch throws → falls back to shortenAddress', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ throwError: true });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({
        metadata: { image: 'https://assets.0xhoneyjar.xyz/Mibera/generated/234.webp', attributes: [] },
      }),
    });

    expect(result.posted).toBe(true);
    expect(sender.calls[0]!.contentFallback).toContain('0x0000…abcd');
    // warn log surfaced for traceability
    const warns = logger.warns.filter((w) =>
      w.msg?.includes('identity-api fail-soft'),
    );
    expect(warns.length).toBe(1);
  });

  test('identity returns non-OK status → falls back to shortenAddress', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ status: 500 });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ status: 404 }),
    });

    expect(result.posted).toBe(true);
    expect(sender.calls[0]!.contentFallback).toContain('0x0000…abcd');
  });

  test('identity returns no mibera-world entry → falls back to shortenAddress', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({}); // no nym → empty world_identities

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ status: 404 }),
    });

    expect(result.posted).toBe(true);
    expect(sender.calls[0]!.contentFallback).toContain('0x0000…abcd');
  });
});

describe('DEP-2 · announceMint · inventory-api fail-soft', () => {
  test('inventory throws → posts with no image / no traits', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ throwError: true }),
    });

    expect(result.posted).toBe(true);
    // posted, but no image url in fallback (only the header line + tx)
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
    expect(fallback).not.toContain('https://cdn.');
    // F2: the HTTP client self-catches the throw (honors "never throws past this
    // seam") and logs here, rather than propagating to announce-mint's outer catch.
    const warns = logger.warns.filter((w) =>
      w.msg?.includes('inventory-api fetch errored'),
    );
    expect(warns.length).toBe(1);
  });

  test('inventory returns null metadata → posts with no image / no traits', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ status: 404 }),
    });

    expect(result.posted).toBe(true);
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
    expect(fallback).not.toContain('https://cdn.');
  });

  test('inventoryApiBaseUrl unset (pre-deploy / CI) → no fetch, fail-soft no image', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });
    let inventoryCalled = false;
    const metadataFetchFn = (async () => {
      inventoryCalled = true;
      throw new Error('should not be called when baseUrl is unset');
    }) as unknown as typeof fetch;

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      // inventoryApiBaseUrl intentionally omitted — the dormant-until-deploy case
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      metadataFetchFn,
    });

    expect(result.posted).toBe(true);
    expect(inventoryCalled).toBe(false); // no baseUrl → no fetch at all
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
    expect(fallback).not.toContain('https://cdn.');
  });
});

describe('DEP-2 · announceMint · both fail-soft (canary-safe minimal post)', () => {
  test('both enrichments fail → still posts with shortAddress + no image + no traits', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ throwError: true });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ throwError: true }),
    });

    expect(result.posted).toBe(true);
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('0x0000…abcd');
    expect(fallback).toContain('#234');
    expect(fallback).not.toContain('https://cdn.');
  });
});

describe('DEP-2 · announceMint · discord send failure', () => {
  test('discordWebhookSendFn throws → returns { posted: false, reason } without throwing', async () => {
    const logger = makeSpyLogger();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });
    const sendFn = async () => {
      throw new Error('discord 403 forbidden');
    };

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sendFn,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ status: 404 }),
    });

    expect(result.posted).toBe(false);
    expect(result.reason).toContain('discord 403');
    const errs = logger.errors.filter((e) =>
      e.msg?.includes('discord send failed'),
    );
    expect(errs.length).toBe(1);
  });
});

describe('DEP-2 · announceMint · timeout', () => {
  test('identity fetch exceeds fetchTimeoutMs → treated as failure (falls back to shortAddress)', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    // simulate a slow identity-api: 200ms response, timeout 30ms
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker', delayMs: 200 });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      fetchTimeoutMs: 30,
      inventoryApiBaseUrl: 'https://inventory.test',
      metadataFetchFn: makeInventoryFetch({ status: 404 }),
    });

    expect(result.posted).toBe(true);
    // timed-out identity fetch → fell back to shortAddress
    expect(sender.calls[0]!.contentFallback).toContain('0x0000…abcd');
  });

  test('inventory fetch exceeds fetchTimeoutMs → no image, announcement still ships', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });
    // slow inventory-api: 200ms response, timeout 30ms → AbortController aborts
    const metadataFetchFn = makeInventoryFetch({
      metadata: { image: 'https://cdn.test/slow.png', attributes: [] },
      delayMs: 200,
    });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      inventoryApiBaseUrl: 'https://inventory.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      fetchTimeoutMs: 30,
      metadataFetchFn,
    });

    expect(result.posted).toBe(true);
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker'); // identity still resolved
    expect(fallback).not.toContain('https://cdn.'); // image timed out → omitted
  });
});

describe('DEP-2 · announceMint · inventory-api HTTP contract', () => {
  test('inventory fetch hits GET {base}/nfts/{contract}/{tokenId} and renders the image', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const seenUrls: string[] = [];
    const metadataFetchFn = (async (url: string | URL) => {
      seenUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: 'Shadow #234',
          description: 'a shadow',
          image: 'https://metadata.0xhoneyjar.xyz/mibera-shadow/234.png',
          attributes: [{ trait_type: 'Element', value: 'Shadow' }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      inventoryApiBaseUrl: 'https://inventory.test/', // trailing slash → stripped
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      metadataFetchFn,
    });

    expect(result.posted).toBe(true);
    // URL shape: trailing slash stripped, contract + tokenId path-encoded
    expect(seenUrls.length).toBe(1);
    expect(seenUrls[0]).toBe(
      `https://inventory.test/nfts/${encodeURIComponent(MST_CONTRACT)}/${encodeURIComponent('234')}`,
    );
    // image flowed through to the fallback (and thus the MediaGallery)
    expect(sender.calls[0]!.contentFallback).toContain(
      'https://metadata.0xhoneyjar.xyz/mibera-shadow/234.png',
    );
  });

  test('inventory 400 (bad input) → fail-soft no image, warn logged', async () => {
    const logger = makeSpyLogger();
    const sender = makeSpySender();
    const fetchFn = makeFakeFetch({ nym: 'shadowmaker' });

    const result = await announceMint({
      payload: PAYLOAD,
      identityApiBaseUrl: 'https://identity.test',
      inventoryApiBaseUrl: 'https://inventory.test',
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      metadataFetchFn: makeInventoryFetch({ status: 400 }),
    });

    expect(result.posted).toBe(true);
    expect(sender.calls[0]!.contentFallback).not.toContain('https://cdn.');
    const warns = logger.warns.filter((w) => w.msg?.includes('inventory-api non-OK'));
    expect(warns.length).toBe(1);
  });
});
