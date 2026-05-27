/**
 * mint-event-subscriber.test.ts — DEP-1 tests
 *
 * Verifies the subscriber's contract against the @0xhoneyjar/events library:
 *   1. Subscriber starts at boot (returns a working stop() handle).
 *   2. Valid envelope → kansei.route called with typed payload + event_type.
 *   3. Broken-sig envelope → onVerificationFailure with reason 'signature-invalid'.
 *   4. Schema-invalid payload → reason 'payload-schema-invalid'.
 *   5. Subscriber stays alive after kansei throws.
 *
 * Uses an in-memory FakeNats mirroring the shape from the library's own
 * roundtrip.test.ts. The subscriber is exercised directly via subscribeEnvelope
 * (because startMintEventSubscriber calls `connect()` against a real socket);
 * the logger + router stubs are spies we assert against. This isolates the
 * DEP-1 contract surface (kansei wiring + verification-failure surfacing)
 * from the NATS connect path which is integration-tested upstream.
 */

import { describe, expect, test } from 'bun:test';
import {
  publishEnvelope,
  InMemoryPrevHashStore,
  LocalEd25519Signer,
  StaticPubkeyVerifier,
  subscribeEnvelope,
  nftMintDetectedTopic,
  NftMintDetectedSchema,
  type NftMintDetected,
  type EventEnvelope,
} from '@0xhoneyjar/events';

import {
  buildNatsConnectOptions,
  createKanseiRouterStub,
  type KanseiRouter,
  type MintEventSubscriberLogger,
} from './mint-event-subscriber.ts';

// ── FakeNats (mirrors @0xhoneyjar/events/tests/roundtrip.test.ts) ─────────────

interface FakeMessage {
  subject: string;
  data: Uint8Array;
}

class FakeNats {
  #queues = new Map<string, FakeMessage[]>();
  #waiters = new Map<string, Array<(msg: FakeMessage) => void>>();
  #subscriptions = new Set<string>();

  publish(subject: string, data: Uint8Array): void {
    const msg: FakeMessage = { subject, data };
    for (const sub of this.#subscriptions) {
      if (subjectMatches(sub, subject)) {
        const waiters = this.#waiters.get(sub);
        if (waiters && waiters.length > 0) {
          const resolve = waiters.shift()!;
          resolve(msg);
        } else {
          const q = this.#queues.get(sub) ?? [];
          q.push(msg);
          this.#queues.set(sub, q);
        }
      }
    }
  }

  subscribe(subject: string): AsyncIterable<FakeMessage> & { unsubscribe: () => void } {
    this.#subscriptions.add(subject);
    let cancelled = false;
    return {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          if (cancelled) return { value: undefined as unknown as FakeMessage, done: true as const };
          const q = this.#queues.get(subject) ?? [];
          if (q.length > 0) {
            const m = q.shift()!;
            this.#queues.set(subject, q);
            return { value: m, done: false as const };
          }
          return new Promise<{ value: FakeMessage; done: false }>((resolve) => {
            const waiters = this.#waiters.get(subject) ?? [];
            waiters.push((m) => resolve({ value: m, done: false as const }));
            this.#waiters.set(subject, waiters);
          });
        },
      }),
      unsubscribe: () => {
        cancelled = true;
        this.#subscriptions.delete(subject);
      },
    };
  }
}

function subjectMatches(pattern: string, subject: string): boolean {
  if (pattern === subject) return true;
  if (pattern.endsWith('>')) return subject.startsWith(pattern.slice(0, -1));
  return false;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_PAYLOAD: NftMintDetected = {
  chain_id: 80094,
  contract: '0x048327a187b944ddac61c6e202bfccd20d17c008',
  token_id: '234',
  minter: '0x000000000000000000000000000000000000abcd',
  block_number: 12345678,
  transaction_hash: '0x' + 'ab'.repeat(32),
  timestamp: '2026-05-26T21:30:00Z',
};

async function buildSigner() {
  const signer = await LocalEd25519Signer.fromSeedHex('0'.repeat(64), 'sonar-api-1');
  const verifier = new StaticPubkeyVerifier().add('sonar-api-1', signer.publicKeyBytes());
  return { signer, verifier };
}

async function tick(ms = 10): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

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

function makeSpyRouter(
  routeImpl?: (input: { eventType: string; payload: NftMintDetected }) => Promise<{ announce: boolean; channelId?: string }>,
): KanseiRouter & { calls: Array<{ eventType: string; payload: NftMintDetected }> } {
  const calls: Array<{ eventType: string; payload: NftMintDetected }> = [];
  return {
    route: async (input) => {
      calls.push(input);
      if (routeImpl) return routeImpl(input);
      return { announce: false };
    },
    calls,
  };
}

/**
 * Bridge used by tests: mirror the production subscriber's contract using
 * subscribeEnvelope + the FakeNats. This factors out the NATS-connect path
 * (which requires a real socket) while exercising the SAME handler +
 * onVerificationFailure wiring that startMintEventSubscriber sets up.
 */
async function startSubscriberWithFakeNats(opts: {
  nats: FakeNats;
  verifier: StaticPubkeyVerifier;
  router: KanseiRouter;
  logger: MintEventSubscriberLogger;
  subject?: string;
}) {
  const subject = opts.subject ?? 'nft.mint.detected.>';
  const handle = await subscribeEnvelope({
    nats: opts.nats,
    subject,
    schema: NftMintDetectedSchema,
    verifier: opts.verifier,
    chainStore: new InMemoryPrevHashStore(),
    initialPrevHashPolicy: 'any',
    handler: async ({ payload, envelope, subject: delivered }) => {
      try {
        const decision = await opts.router.route({
          eventType: envelope.event_type,
          payload,
        });
        opts.logger.info(
          {
            subject: delivered,
            tokenId: payload.token_id,
            contract: payload.contract,
            chainId: payload.chain_id,
            announce: decision.announce,
            channelId: decision.channelId ?? null,
          },
          '[events-subscriber] mint routed',
        );
      } catch (err) {
        opts.logger.error(
          { err, subject: delivered },
          '[events-subscriber] kansei router threw',
        );
      }
    },
    onVerificationFailure: (reason, detail) => {
      opts.logger.warn(
        {
          reason,
          subject: detail.subject,
          emitted_by: detail.envelope?.emitted_by,
          signing_key_id: detail.envelope?.signing_key_id,
          error: detail.error ? String(detail.error).slice(0, 200) : undefined,
        },
        '[events-subscriber] envelope verification failed',
      );
    },
  });
  return {
    stop: async () => {
      handle.unsubscribe();
    },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('DEP-1 · mint-event-subscriber', () => {
  test('1. starts and returns a working stop() handle', async () => {
    const nats = new FakeNats();
    const { verifier } = await buildSigner();
    const router = makeSpyRouter();
    const logger = makeSpyLogger();

    const sub = await startSubscriberWithFakeNats({ nats, verifier, router, logger });

    expect(typeof sub.stop).toBe('function');
    expect(router.calls.length).toBe(0);

    await sub.stop();
    // stop() must be safely re-callable (idempotent for our purposes)
    await sub.stop();
  });

  test('2. valid envelope → kansei.route invoked with typed payload + event_type; logger.info "mint routed"', async () => {
    const nats = new FakeNats();
    const { signer, verifier } = await buildSigner();
    const router = makeSpyRouter();
    const logger = makeSpyLogger();
    const subject = nftMintDetectedTopic({ collectionSlug: 'mibera-shadow' });

    const sub = await startSubscriberWithFakeNats({ nats, verifier, router, logger });

    await publishEnvelope({
      nats,
      subject,
      payload: VALID_PAYLOAD,
      emittedBy: 'sonar-api',
      signer,
      prevHashStore: new InMemoryPrevHashStore(),
    });

    await tick();

    expect(router.calls.length).toBe(1);
    expect(router.calls[0]!.payload.token_id).toBe('234');
    expect(router.calls[0]!.payload.chain_id).toBe(80094);
    expect(router.calls[0]!.eventType).toBe(subject);

    const routedLogs = logger.infos.filter((l) => l.msg === '[events-subscriber] mint routed');
    expect(routedLogs.length).toBe(1);
    expect((routedLogs[0]!.obj as { announce: boolean }).announce).toBe(false);

    await sub.stop();
  });

  test('3. broken-sig envelope → onVerificationFailure with reason "signature-invalid"; kansei NOT called', async () => {
    const nats = new FakeNats();
    const goodSigner = await LocalEd25519Signer.fromSeedHex('0'.repeat(64), 'sonar-api-1');
    const wrongSigner = await LocalEd25519Signer.fromSeedHex('1'.repeat(64), 'sonar-api-1');
    const verifier = new StaticPubkeyVerifier().add(
      'sonar-api-1',
      goodSigner.publicKeyBytes(),
    );
    const router = makeSpyRouter();
    const logger = makeSpyLogger();
    const subject = nftMintDetectedTopic({ collectionSlug: 'mibera-shadow' });

    const sub = await startSubscriberWithFakeNats({ nats, verifier, router, logger });

    await publishEnvelope({
      nats,
      subject,
      payload: VALID_PAYLOAD,
      emittedBy: 'sonar-api',
      signer: wrongSigner,
      prevHashStore: new InMemoryPrevHashStore(),
    });

    await tick();

    expect(router.calls.length).toBe(0);
    const failWarns = logger.warns.filter(
      (w) => w.msg === '[events-subscriber] envelope verification failed',
    );
    expect(failWarns.length).toBe(1);
    expect((failWarns[0]!.obj as { reason: string }).reason).toBe('signature-invalid');

    await sub.stop();
  });

  test('4. schema-invalid payload → reason "payload-schema-invalid"; kansei NOT called', async () => {
    const nats = new FakeNats();
    const { signer, verifier } = await buildSigner();
    const router = makeSpyRouter();
    const logger = makeSpyLogger();
    const subject = nftMintDetectedTopic({ collectionSlug: 'mibera-shadow' });

    const sub = await startSubscriberWithFakeNats({ nats, verifier, router, logger });

    // Intentionally drop required field (token_id) to trip the schema check.
    const bad = { ...VALID_PAYLOAD, token_id: undefined } as unknown as NftMintDetected;
    await publishEnvelope({
      nats,
      subject,
      payload: bad,
      emittedBy: 'sonar-api',
      signer,
      prevHashStore: new InMemoryPrevHashStore(),
    });

    await tick();

    expect(router.calls.length).toBe(0);
    const failWarns = logger.warns.filter(
      (w) => w.msg === '[events-subscriber] envelope verification failed',
    );
    expect(failWarns.length).toBe(1);
    expect((failWarns[0]!.obj as { reason: string }).reason).toBe(
      'payload-schema-invalid',
    );

    await sub.stop();
  });

  test('5. subscriber stays alive after kansei throws; processes next envelope', async () => {
    const nats = new FakeNats();
    const { signer, verifier } = await buildSigner();
    const logger = makeSpyLogger();
    const subject = nftMintDetectedTopic({ collectionSlug: 'mibera-shadow' });

    let callCount = 0;
    const router: KanseiRouter = {
      route: async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('kansei is unhealthy');
        }
        return { announce: false };
      },
    };

    const sub = await startSubscriberWithFakeNats({ nats, verifier, router, logger });

    // Use a single per-publisher chain so the second envelope's prev_hash
    // correctly references the first envelope's hash (the subscriber
    // advances its chain tip before the handler runs per rd-3 F-002).
    const publisherStore = new InMemoryPrevHashStore();

    // first envelope — kansei throws (subscriber surfaces handler-error)
    await publishEnvelope({
      nats,
      subject,
      payload: VALID_PAYLOAD,
      emittedBy: 'sonar-api',
      signer,
      prevHashStore: publisherStore,
    });
    // second envelope — kansei recovers; subscriber must still process it
    await publishEnvelope({
      nats,
      subject,
      payload: { ...VALID_PAYLOAD, token_id: '235' },
      emittedBy: 'sonar-api',
      signer,
      prevHashStore: publisherStore,
    });

    await tick(20);

    expect(callCount).toBe(2);
    const errorLogs = logger.errors.filter(
      (e) => e.msg === '[events-subscriber] kansei router threw',
    );
    expect(errorLogs.length).toBe(1);
    // The 2nd envelope's success path logs "mint routed" via logger.info
    const routedLogs = logger.infos.filter(
      (l) => l.msg === '[events-subscriber] mint routed',
    );
    expect(routedLogs.length).toBe(1);

    await sub.stop();
  });
});

// ── Path-ε mTLS client-cert tests (cluster-events-pillar-v1) ────────────────
//
// buildNatsConnectOptions is the pure helper extracted from
// startMintEventSubscriber so the Path-ε partial-config refuse + TLS-options
// assembly is unit-testable without touching the real `nats.connect()` socket.
// Existing tests in this file deliberately bypass `startMintEventSubscriber`
// (FakeNats + direct subscribeEnvelope) for the same isolation reason; these
// tests target the new helper alongside.
//
// Mirrors the sonar PR #25 test shape (partial-config rejected ×2, both-set
// assembly, backward-compat neither-set) adapted to the subscriber's
// `caFile` (path) + `cert`/`key` (PEM body) asymmetric TLS contract.

describe('Path-ε · buildNatsConnectOptions (NATS mTLS options assembly)', () => {
  const NATS_URL = 'tls://broker.example:4222';
  const CA_PATH = '/etc/nats/ca.pem';
  // Dummy PEM bodies — opaque to buildNatsConnectOptions (passed through to
  // nats.connect's tls options unchanged; real PEM validation only happens
  // at TLS handshake time which we never reach in a unit test).
  const FAKE_CLIENT_CERT =
    '-----BEGIN CERTIFICATE-----\nMIIBdummyclientcert\n-----END CERTIFICATE-----\n';
  const FAKE_CLIENT_KEY =
    '-----BEGIN PRIVATE KEY-----\nMIIBdummyclientkey\n-----END PRIVATE KEY-----\n';

  test('refuses partial config: natsTlsClientCert set without natsTlsClientKey → throws', () => {
    expect(() =>
      buildNatsConnectOptions({
        natsUrl: NATS_URL,
        natsTlsCa: CA_PATH,
        natsTlsClientCert: FAKE_CLIENT_CERT,
        // natsTlsClientKey intentionally unset
      }),
    ).toThrow(
      /NATS_TLS_CLIENT_CERT and NATS_TLS_CLIENT_KEY must both be set or both unset/,
    );
  });

  test('refuses partial config: natsTlsClientKey set without natsTlsClientCert → throws', () => {
    expect(() =>
      buildNatsConnectOptions({
        natsUrl: NATS_URL,
        natsTlsCa: CA_PATH,
        natsTlsClientKey: FAKE_CLIENT_KEY,
        // natsTlsClientCert intentionally unset
      }),
    ).toThrow(
      /NATS_TLS_CLIENT_CERT and NATS_TLS_CLIENT_KEY must both be set or both unset/,
    );
  });

  test('both client-cert env set → returned tls includes caFile, cert, key', () => {
    const result = buildNatsConnectOptions({
      natsUrl: NATS_URL,
      natsTlsCa: CA_PATH,
      natsTlsClientCert: FAKE_CLIENT_CERT,
      natsTlsClientKey: FAKE_CLIENT_KEY,
    });
    expect(result.servers).toBe(NATS_URL);
    expect(result.tls).toBeDefined();
    expect(result.tls!.caFile).toBe(CA_PATH);
    expect(result.tls!.cert).toBe(FAKE_CLIENT_CERT);
    expect(result.tls!.key).toBe(FAKE_CLIENT_KEY);
  });

  test('both client-cert env set, no CA → returned tls includes cert + key only (system-CA mode)', () => {
    const result = buildNatsConnectOptions({
      natsUrl: NATS_URL,
      // no natsTlsCa
      natsTlsClientCert: FAKE_CLIENT_CERT,
      natsTlsClientKey: FAKE_CLIENT_KEY,
    });
    expect(result.tls).toBeDefined();
    expect(result.tls!.caFile).toBeUndefined();
    expect(result.tls!.cert).toBe(FAKE_CLIENT_CERT);
    expect(result.tls!.key).toBe(FAKE_CLIENT_KEY);
  });

  test('backward-compat: neither client-cert env set, CA set → returned tls = { caFile }, no cert/key', () => {
    const result = buildNatsConnectOptions({
      natsUrl: NATS_URL,
      natsTlsCa: CA_PATH,
    });
    expect(result.tls).toBeDefined();
    expect(result.tls!.caFile).toBe(CA_PATH);
    expect(result.tls!.cert).toBeUndefined();
    expect(result.tls!.key).toBeUndefined();
  });

  test('backward-compat: no CA, no client-cert → returned options omit tls entirely', () => {
    const result = buildNatsConnectOptions({
      natsUrl: NATS_URL,
    });
    expect(result.servers).toBe(NATS_URL);
    expect(result.tls).toBeUndefined();
  });
});

// ── kansei router stub contract ──────────────────────────────────────────────

describe('DEP-1 · createKanseiRouterStub', () => {
  test('always returns { announce: false } for DEP-1; logs through the supplied logger', async () => {
    const logger = makeSpyLogger();
    const router = createKanseiRouterStub(logger);

    const decision = await router.route({
      eventType: 'nft.mint.detected.mibera-shadow.v1',
      payload: VALID_PAYLOAD,
    });

    expect(decision.announce).toBe(false);
    expect(decision.channelId).toBeUndefined();

    const stubLogs = logger.infos.filter(
      (l) => l.msg === '[kansei-stub] DEP-1 stub — DEP-2 will wire real threshold routing',
    );
    expect(stubLogs.length).toBe(1);
  });
});
