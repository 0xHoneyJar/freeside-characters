/**
 * mst-kansei-router.test.ts — DEP-2 router contract.
 *
 * Asserts the v1-scope discipline gates:
 *   - MST subject + enabled + channel set → { announce: true, channelId }
 *   - non-MST subject → { announce: false } (other Mibera/PuruPuru events
 *     reach the subscriber but do NOT surface in Discord)
 *   - MST subject + enabled=false → { announce: false } (canary-safe default)
 *   - MST subject + enabled=true + empty channelId → { announce: false }
 *     (defense-in-depth misconfig guard)
 *   - dispatcher invoked on { announce: true } (no-op when undefined)
 *   - dispatcher throws → { announce: false } + logger.error (router
 *     refuses to log a false-positive routed outcome)
 */

import { describe, expect, test } from 'bun:test';
import {
  createMstKanseiRouter,
  MST_EVENT_TYPE,
  type AnnouncementDispatchFn,
} from './mst-kansei-router.ts';
import type {
  MintEventSubscriberLogger,
} from './mint-event-subscriber.ts';
import type { NftMintDetected } from '@0xhoneyjar/events';

// ── fixtures ─────────────────────────────────────────────────────────────────

const PAYLOAD: NftMintDetected = {
  chain_id: 80094,
  contract: '0x048327a187b944ddac61c6e202bfccd20d17c008',
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

// ── tests ────────────────────────────────────────────────────────────────────

describe('DEP-2 · createMstKanseiRouter · scope gate', () => {
  test('MST event + enabled + channel set → { announce: true, channelId }', async () => {
    const logger = makeSpyLogger();
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(true);
    expect(decision.channelId).toBe('CHAN_123');
    expect(logger.errors.length).toBe(0);
  });

  test('non-MST events (mibera-collection, mibera-zora, purupuru-apiculture, etc.) → { announce: false }', async () => {
    const logger = makeSpyLogger();
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
    });

    const nonMstSubjects = [
      'nft.mint.detected.mibera-collection.v1',
      'nft.mint.detected.mibera-zora.v1',
      'nft.mint.detected.purupuru-apiculture.v1',
      'nft.mint.detected.v1', // catch-all
      'nft.mint.detected.mibera-shadow.v2', // wrong version
      'vault.deposit.detected.mibera.v1', // different class entirely
    ];

    for (const subject of nonMstSubjects) {
      const decision = await router.route({
        eventType: subject,
        payload: PAYLOAD,
      });
      expect(decision.announce).toBe(false);
      expect(decision.channelId).toBeUndefined();
    }
    // No suppress-info log for non-MST events (those go directly to
    // the no-match return without logging) — keeps logs scannable.
    expect(logger.infos.length).toBe(0);
  });

  test('MST event + enabled=false → { announce: false } with suppress info log', async () => {
    const logger = makeSpyLogger();
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: false,
      logger,
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(false);
    const suppressLogs = logger.infos.filter((l) =>
      l.msg?.includes('MST event suppressed'),
    );
    expect(suppressLogs.length).toBe(1);
  });

  test('MST event + enabled=true + empty channelId → { announce: false } with warn log (defense-in-depth)', async () => {
    const logger = makeSpyLogger();
    const router = createMstKanseiRouter({
      canaryChannelId: '',
      enabled: true,
      logger,
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(false);
    const warns = logger.warns.filter((w) =>
      w.msg?.includes('MST_CANARY_CHANNEL_ID is empty'),
    );
    expect(warns.length).toBe(1);
  });
});

describe('DEP-2 · createMstKanseiRouter · dispatcher composition', () => {
  test('dispatcher invoked with eventType/channelId/payload when announce=true', async () => {
    const logger = makeSpyLogger();
    const calls: Array<{ eventType: string; channelId: string; tokenId: string }> = [];
    const dispatcher: AnnouncementDispatchFn = async ({ eventType, channelId, payload }) => {
      calls.push({ eventType, channelId, tokenId: payload.token_id });
    };
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
      dispatchAnnouncement: dispatcher,
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(true);
    expect(calls).toEqual([
      { eventType: MST_EVENT_TYPE, channelId: 'CHAN_123', tokenId: '234' },
    ]);
  });

  test('dispatcher NOT invoked when announce=false (non-MST event)', async () => {
    const logger = makeSpyLogger();
    let dispatcherCalls = 0;
    const dispatcher: AnnouncementDispatchFn = async () => {
      dispatcherCalls++;
    };
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
      dispatchAnnouncement: dispatcher,
    });

    await router.route({
      eventType: 'nft.mint.detected.purupuru-apiculture.v1',
      payload: PAYLOAD,
    });

    expect(dispatcherCalls).toBe(0);
  });

  test('dispatcher NOT invoked when canary disabled (MST event suppressed)', async () => {
    const logger = makeSpyLogger();
    let dispatcherCalls = 0;
    const dispatcher: AnnouncementDispatchFn = async () => {
      dispatcherCalls++;
    };
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: false,
      logger,
      dispatchAnnouncement: dispatcher,
    });

    await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(dispatcherCalls).toBe(0);
  });

  test('dispatcher throws → router returns { announce: false } + error log (no false-positive routed log)', async () => {
    const logger = makeSpyLogger();
    const dispatcher: AnnouncementDispatchFn = async () => {
      throw new Error('boom — bot client unavailable');
    };
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
      dispatchAnnouncement: dispatcher,
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(false);
    const errs = logger.errors.filter((e) =>
      e.msg?.includes('dispatcher threw'),
    );
    expect(errs.length).toBe(1);
  });

  test('router with no dispatcher returns { announce: true, channelId } (decision-only mode)', async () => {
    const logger = makeSpyLogger();
    const router = createMstKanseiRouter({
      canaryChannelId: 'CHAN_123',
      enabled: true,
      logger,
      // no dispatchAnnouncement — decision-only mode (matches DEP-1 stub shape)
    });

    const decision = await router.route({
      eventType: MST_EVENT_TYPE,
      payload: PAYLOAD,
    });

    expect(decision.announce).toBe(true);
    expect(decision.channelId).toBe('CHAN_123');
  });
});
