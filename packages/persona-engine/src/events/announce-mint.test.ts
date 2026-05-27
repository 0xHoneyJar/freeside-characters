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
 * Bypasses the lazy-import path for @0xhoneyjar/inventory via the
 * inventoryModule option (test seam). identity-api uses the injectable
 * fetchFn (test seam). No real network I/O.
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
      discordWebhookSendFn: sender.send,
      channelId: 'CHAN_123',
      logger,
      fetchFn,
      inventoryModule: {
        getNftMetadata: async () => ({
          image: 'https://cdn.test/shadow-234.png',
          attributes: [
            { trait_type: 'Background', value: 'Void' },
            { trait_type: 'Eyes', value: 'Glowing' },
          ],
        }),
      },
    });

    expect(result.posted).toBe(true);
    expect(sender.calls.length).toBe(1);
    const msg = sender.calls[0]!;
    expect(msg.channelId).toBe('CHAN_123');
    expect(Array.isArray(msg.components)).toBe(true);
    // ensure plain-text fallback carries the nym
    expect(msg.contentFallback).toContain('shadowmaker');
    expect(msg.contentFallback).toContain('#234');
    expect(msg.contentFallback).toContain('https://cdn.test/shadow-234.png');
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
      inventoryModule: {
        getNftMetadata: async () => ({ image: 'https://cdn.test/x.png', attributes: [] }),
      },
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
      inventoryModule: { getNftMetadata: async () => null },
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
      inventoryModule: { getNftMetadata: async () => null },
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
      inventoryModule: {
        getNftMetadata: async () => {
          throw new Error('inventory unhealthy');
        },
      },
    });

    expect(result.posted).toBe(true);
    // posted, but no image url in fallback (only the header line + tx)
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
    expect(fallback).not.toContain('https://cdn.');
    const warns = logger.warns.filter((w) =>
      w.msg?.includes('inventory module unavailable'),
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
      inventoryModule: { getNftMetadata: async () => null },
    });

    expect(result.posted).toBe(true);
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
    expect(fallback).not.toContain('https://cdn.');
  });

  test('inventory module missing getNftMetadata function → fail-soft', async () => {
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
      inventoryModule: {}, // no getNftMetadata
    });

    expect(result.posted).toBe(true);
    const fallback = sender.calls[0]!.contentFallback ?? '';
    expect(fallback).toContain('shadowmaker');
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
      inventoryModule: {
        getNftMetadata: async () => {
          throw new Error('inventory down');
        },
      },
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
      inventoryModule: { getNftMetadata: async () => null },
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
      inventoryModule: { getNftMetadata: async () => null },
    });

    expect(result.posted).toBe(true);
    // timed-out identity fetch → fell back to shortAddress
    expect(sender.calls[0]!.contentFallback).toContain('0x0000…abcd');
  });
});
