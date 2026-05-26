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
  /** Optional path to a CA cert file for NATS TLS. TLS-only in production. */
  natsTlsCa?: string;
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

export async function startMintEventSubscriber(
  opts: MintEventSubscriberOpts,
): Promise<MintEventSubscriberHandle> {
  const subject = opts.subject ?? 'nft.mint.detected.>';

  // Connect to NATS (TLS-only in production when a CA path is configured)
  const nc: NatsConnection = await connect({
    servers: opts.natsUrl,
    ...(opts.natsTlsCa ? { tls: { caFile: opts.natsTlsCa } } : {}),
  });
  opts.logger.info(
    { url: opts.natsUrl, subject, tls: Boolean(opts.natsTlsCa) },
    '[events-subscriber] NATS connected',
  );

  // Verifier: JWKS in prod, empty StaticPubkeyVerifier in dev (every sig
  // fails — visually obvious that traffic is not being trusted).
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
        { err },
        '[events-subscriber] JWKS init failed; falling back to empty StaticPubkeyVerifier (all sigs will fail)',
      );
      verifier = new StaticPubkeyVerifier();
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
