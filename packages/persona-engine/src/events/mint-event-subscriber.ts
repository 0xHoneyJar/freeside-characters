/**
 * mint-event-subscriber.ts — DEP-1 of the cluster-events-pillar v1 cycle.
 *
 * Wires the @0xhoneyjar/events ACVP envelope subscriber at bot boot, verifies
 * mint envelopes published by sonar-api on `nft.mint.detected.>`, and hands
 * the typed payload to a kansei router that decides whether to announce.
 *
 * DEP-1 scope: subscriber + verifier wiring + kansei router invocation.
 * DEP-2 (separate task) will replace the router stub with real threshold
 * logic and wire the decision to a Discord channel announcement.
 *
 * Per cluster sovereignty doctrine (memory:cluster-no-npm-sovereignty,
 * 2026-05-26), the events package is consumed via git-URL pinned to a
 * commit SHA + a postinstall hook that rebuilds dist/ from source. See
 * scripts/rebuild-events-dist.sh and the README quick-start (subscriber).
 *
 * Subscriber failure-mode contract (from @0xhoneyjar/events README):
 *   - Never throws; broken envelopes surface via onVerificationFailure.
 *   - VerificationFailureReason discriminates: envelope-schema-invalid,
 *     payload-schema-invalid, payload-hash-mismatch, signature-invalid,
 *     subject-mismatch, prev-hash-broken-chain, initial-anchor-policy-violation,
 *     json-parse-error, handler-error, internal-error.
 *
 * Verifier choice:
 *   - Production: JwksVerifier.fromUrl(opts.jwksUrl) — fetches cluster JWKS,
 *     caches with TTL.
 *   - Dev / no JWKS configured: empty StaticPubkeyVerifier — EVERY signature
 *     fails, surfaced via onVerificationFailure. This is intentional: it's
 *     visually loud rather than silently accepting unsigned traffic.
 *
 * Initial-anchor policy: default 'any' (EVT-002 backward-compat); operator
 * can tighten to 'genesis' or a pinned hex anchor when the publisher's chain
 * tip is known.
 */

import { connect, type NatsConnection } from 'nats';
import {
  subscribeEnvelope,
  JwksVerifier,
  StaticPubkeyVerifier,
  InMemoryPrevHashStore,
  NftMintDetectedSchema,
  type Verifier,
  type NftMintDetected,
} from '@0xhoneyjar/events';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Decision returned by the kansei threshold router. For DEP-1 the stub
 * always returns { announce: false } — DEP-2 wires real threshold logic and
 * the channelId for posting.
 */
export interface KanseiRouteDecision {
  announce: boolean;
  channelId?: string;
}

export interface KanseiRouter {
  route(input: {
    eventType: string;
    payload: NftMintDetected;
  }): Promise<KanseiRouteDecision>;
}

export interface MintEventSubscriberLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export interface MintEventSubscriberOpts {
  natsUrl: string;
  /**
   * Optional CA cert PEM **body** for NATS TLS. TLS-only in production.
   *
   * BREAKING CHANGE (Path-ε consistency with dash loa-freeside#242):
   * previously this option was a filesystem PATH passed to nats.js as `caFile`.
   * It is now a PEM body passed to nats.js as `ca`. Railway service-variables
   * inject full PEM content; local dev must update from
   * `NATS_TLS_CA=/path/to/ca.pem` to `NATS_TLS_CA=$(cat /path/to/ca.pem)`.
   *
   * All three TLS options (`natsTlsCa`, `natsTlsClientCert`, `natsTlsClientKey`)
   * are now PEM bodies — uniform contract, no path/body split.
   */
  natsTlsCa?: string;
  /**
   * Path-ε mTLS client-cert presentation. Both fields are OPTIONAL env-wired
   * PEM **bodies** (not paths — Railway service-variables inject the full PEM
   * content). When BOTH are set, `nats.connect()`'s `tls` options include
   * `cert` + `key` alongside the existing CA, enabling mTLS auth against the
   * Path-ε broker (`--tlsverify` on nats-server requires + verifies a client
   * cert signed by the cluster CA).
   *
   * Partial config (one set, the other missing) is refused at start with an
   * explicit throw — proceeding either way (cert-without-key, key-without-cert)
   * masks a deployment misconfiguration: cert-without-key fails the TLS
   * handshake; key-without-cert silently falls back to anonymous TLS. Mirrors
   * the JWKS-init refuse path (BB#105 rd-3) and the sonar publisher's
   * partial-config refuse at sonar PR #25.
   *
   * Uniform with `natsTlsCa` (all three are PEM bodies, handed to nats.js as
   * `ca` / `cert` / `key`). Reference: ~/Documents/GitHub/loa-freeside/
   * grimoires/loa/specs/cluster-events-pillar-v1/
   * go-live-path-epsilon-railway-nats.md §Step 3b.
   */
  natsTlsClientCert?: string;
  natsTlsClientKey?: string;
  /** Cluster JWKS endpoint for verifying publisher signatures. Absent → dev mode. */
  jwksUrl?: string;
  kanseiRouter: KanseiRouter;
  logger: MintEventSubscriberLogger;
  /**
   * Optional initial-anchor policy per EVT-002. Default 'any' for
   * backward-compat. Set to 'genesis' to require GENESIS_PREV_HASH on the
   * first envelope from each publisher, or pin a hex anchor.
   */
  initialPrevHashPolicy?: 'any' | 'genesis' | string;
  /**
   * Subject pattern to subscribe to. Default 'nft.mint.detected.>' (wildcard
   * across all collections).
   */
  subject?: string;
}

export interface MintEventSubscriberHandle {
  stop(): Promise<void>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Internal type describing the connect-options shape this module hands to
 * `nats.connect()`. Exported only to make the `buildNatsConnectOptions`
 * helper unit-testable without exposing the nats.js types.
 */
export interface BuiltNatsConnectOptions {
  servers: string;
  tls?: {
    ca?: string;
    cert?: string;
    key?: string;
  };
}

/**
 * Build the options object handed to `nats.connect()`. Pure helper extracted
 * so the Path-ε partial-config refuse + TLS-options assembly is unit-testable
 * without spinning up a NATS connection.
 *
 * Throws on partial mTLS config (one of `natsTlsClientCert` / `natsTlsClientKey`
 * set without the other). Matches the JWKS-init refuse path (BB#105 rd-3) and
 * sonar PR #25's `markPermanentDisabled` style adapted to the subscriber's
 * throw-on-misconfig contract.
 */
export function buildNatsConnectOptions(opts: {
  natsUrl: string;
  natsTlsCa?: string;
  natsTlsClientCert?: string;
  natsTlsClientKey?: string;
}): BuiltNatsConnectOptions {
  const { natsUrl, natsTlsCa, natsTlsClientCert, natsTlsClientKey } = opts;

  // Path-ε partial-config refuse: one set without the other is a deployment
  // misconfiguration. Proceeding either way (cert-without-key, key-without-cert)
  // masks the error — fail-closed at config-load is the audit-friendly path.
  if (Boolean(natsTlsClientCert) !== Boolean(natsTlsClientKey)) {
    throw new Error(
      '[events-subscriber] NATS_TLS_CLIENT_CERT and NATS_TLS_CLIENT_KEY must both be set or both unset (Path-ε mTLS)',
    );
  }

  // TLS options assembly: ca-only (custom CA), ca+client-cert (Path-ε mTLS),
  // or client-cert-only (system-CA verification + client auth). All values
  // are PEM bodies (handed to nats.js as `ca` / `cert` / `key`). The ternary
  // keeps the no-TLS-options branch unchanged when neither CA nor client cert
  // is configured (preserves DEP-1 default behavior).
  const tls =
    natsTlsCa || natsTlsClientCert
      ? {
          ...(natsTlsCa ? { ca: natsTlsCa } : {}),
          ...(natsTlsClientCert
            ? { cert: natsTlsClientCert, key: natsTlsClientKey }
            : {}),
        }
      : undefined;

  return {
    servers: natsUrl,
    ...(tls ? { tls } : {}),
  };
}

export async function startMintEventSubscriber(
  opts: MintEventSubscriberOpts,
): Promise<MintEventSubscriberHandle> {
  const subject = opts.subject ?? 'nft.mint.detected.>';

  // Connect to NATS (TLS-only in production when a CA path is configured).
  // buildNatsConnectOptions throws on Path-ε partial-config (cert-without-key
  // or key-without-cert) BEFORE the NATS connection attempt — caller (bot
  // wire at apps/bot/src/index.ts) routes the throw through the existing
  // BB#105 rd-3 startup-failure path.
  const connectOpts = buildNatsConnectOptions({
    natsUrl: opts.natsUrl,
    natsTlsCa: opts.natsTlsCa,
    natsTlsClientCert: opts.natsTlsClientCert,
    natsTlsClientKey: opts.natsTlsClientKey,
  });
  const nc: NatsConnection = await connect(connectOpts);
  const tlsMode = opts.natsTlsClientCert
    ? opts.natsTlsCa
      ? 'mTLS-with-custom-CA'
      : 'mTLS-via-system-CA'
    : opts.natsTlsCa
      ? 'with-custom-CA'
      : 'via-scheme';
  opts.logger.info(
    { url: opts.natsUrl, subject, tls: Boolean(opts.natsTlsCa), tlsMode },
    '[events-subscriber] NATS connected',
  );

  // Verifier choice (BB#105 F-001 closed):
  //   - opts.jwksUrl SET + reachable: JwksVerifier loads + caches keys.
  //   - opts.jwksUrl SET + UNREACHABLE: THROW from startMintEventSubscriber.
  //     The old fallback-to-empty-StaticPubkeyVerifier path was an
  //     availability hazard: every signed envelope failed verification,
  //     events flowed through NATS but never reached kansei, and no retry
  //     path recovered when JWKS came back. Failing loud at startup forces
  //     the operator to fix config / wait for JWKS / disable verifier
  //     explicitly. Matches the bot's other boot wires (gate on NATS_URL
  //     absent → log + skip; gate on JWKS unreachable when configured →
  //     throw + skip).
  //   - opts.jwksUrl UNSET: intentional dev fallback to empty
  //     StaticPubkeyVerifier — every signature surfaces invalid via
  //     onVerificationFailure (visually loud, never silently accepts
  //     unsigned traffic).
  let verifier: Verifier;
  if (opts.jwksUrl) {
    try {
      verifier = await JwksVerifier.fromUrl(opts.jwksUrl, { timeoutMs: 5_000 });
      opts.logger.info(
        { jwksUrl: opts.jwksUrl },
        '[events-subscriber] JWKS verifier loaded',
      );
    } catch (err) {
      opts.logger.error(
        { err, jwksUrl: opts.jwksUrl },
        '[events-subscriber] JWKS init failed — refusing to start (operator must fix JWKS or remove jwksUrl)',
      );
      // Drain NATS before throwing so we don't leak the connection.
      await nc.drain().catch(() => undefined);
      throw new Error(
        `[events-subscriber] JWKS init failed at ${opts.jwksUrl}: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  } else {
    opts.logger.warn(
      {},
      '[events-subscriber] No JWKS_URL configured — using empty StaticPubkeyVerifier (all sigs will surface as invalid)',
    );
    verifier = new StaticPubkeyVerifier();
  }

  const handle = await subscribeEnvelope({
    nats: nc,
    subject,
    schema: NftMintDetectedSchema,
    verifier,
    chainStore: new InMemoryPrevHashStore(),
    initialPrevHashPolicy: opts.initialPrevHashPolicy ?? 'any',
    handler: async ({ payload, envelope, subject: deliveredSubject }) => {
      try {
        const decision = await opts.kanseiRouter.route({
          eventType: envelope.event_type,
          payload,
        });
        opts.logger.info(
          {
            subject: deliveredSubject,
            tokenId: payload.token_id,
            contract: payload.contract,
            chainId: payload.chain_id,
            announce: decision.announce,
            channelId: decision.channelId ?? null,
          },
          '[events-subscriber] mint routed',
        );
        // DEP-2 will wire decision → Discord announcement. For DEP-1 we log only.
      } catch (err) {
        opts.logger.error(
          { err, subject: deliveredSubject },
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
    stop: async (): Promise<void> => {
      try {
        handle.unsubscribe();
      } catch (err) {
        opts.logger.warn({ err }, '[events-subscriber] unsubscribe error');
      }
      try {
        await nc.drain();
      } catch (err) {
        opts.logger.warn({ err }, '[events-subscriber] NATS drain error');
      }
    },
  };
}

/**
 * DEP-1 stub kansei router. Always returns { announce: false } — DEP-2 will
 * replace this with the real threshold-based router that consults
 * refractory + daily-cap + zone affinity.
 */
export function createKanseiRouterStub(
  logger: MintEventSubscriberLogger,
): KanseiRouter {
  return {
    route: async ({ eventType, payload }) => {
      logger.info(
        {
          eventType,
          tokenId: payload.token_id,
          contract: payload.contract,
        },
        '[kansei-stub] DEP-1 stub — DEP-2 will wire real threshold routing',
      );
      return { announce: false };
    },
  };
}
