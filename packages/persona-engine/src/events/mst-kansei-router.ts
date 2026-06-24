/**
 * mst-kansei-router.ts — DEP-2 of cluster-events-pillar v1.
 *
 * Replaces the DEP-1 `createKanseiRouterStub`. The real router decides
 * whether to announce based on the event_type matching the MST subject
 * pattern:
 *
 *   nft.mint.detected.mibera-shadow.v1 → { announce: true, channelId } (when enabled)
 *   any other event_type               → { announce: false }
 *
 * v1 scope discipline (per sprint plan): sonar publishes for ~7 collections;
 * only mibera-shadow surfaces in Discord. The other Mibera-family +
 * PuruPuru events flow on NATS + reach the subscriber + log routing decisions
 * — but the router returns { announce: false } so no Discord post happens.
 *
 * Canary safety: when `enabled: false` (the default per env config),
 * EVERY event — including MST — returns { announce: false }. The bot
 * boots cleanly with the new wire but does not post until the operator
 * flips MST_CANARY_ENABLED=1 in production env.
 *
 * Build-doc reference: sprint.md §3-4 (display/announcement scope) +
 * the task brief's §3c (router gate).
 *
 * Future arc (post-v1): a per-collection routing table, threshold logic
 * (refractory + daily-cap + zone affinity), and a richer KanseiRouteDecision
 * carrying voice / wardrobe / channel-zone selectors. That belongs to
 * DEP-3+ once the canary proves out the substrate.
 */

import type { NftMintDetected } from '@0xhoneyjar/events';
import type {
  KanseiRouter,
  KanseiRouteDecision,
  MintEventSubscriberLogger,
} from './mint-event-subscriber.ts';

/** Canonical MST subject — must match the publisher's nftMintDetectedTopic({collectionSlug:'mibera-shadow'}). */
export const MST_EVENT_TYPE = 'nft.mint.detected.mibera-shadow.v1';

/**
 * Decision-driven announcement function. The router awaits this when it
 * decides to announce; the subscriber's handler stays untouched (it just
 * awaits the router). See `announcement-dispatcher.ts` for the canonical
 * implementation.
 */
export type AnnouncementDispatchFn = (input: {
  eventType: string;
  channelId: string;
  payload: NftMintDetected;
}) => Promise<void>;

export interface MstKanseiRouterOpts {
  /** MST canary Discord channel id (flips to the production channel post-validation). */
  canaryChannelId: string;
  /** When true, route MST events to canaryChannelId; when false, no announce (canary-safe default). */
  enabled: boolean;
  logger: MintEventSubscriberLogger;
  /**
   * Optional dispatcher. When present, the router AWAITS it on
   * { announce: true } before returning the decision — so the subscriber's
   * existing handler logging reflects the post-attempt state. Absent → router
   * is decision-only (matches the DEP-1 stub shape; useful for unit tests).
   */
  dispatchAnnouncement?: AnnouncementDispatchFn;
}

export function createMstKanseiRouter(opts: MstKanseiRouterOpts): KanseiRouter {
  return {
    route: async ({ eventType, payload }): Promise<KanseiRouteDecision> => {
      // MST subject ONLY — every other event type is a no-op announcement-wise.
      // (Non-MST events still reach the subscriber + log via mint-event-subscriber;
      // they just don't surface in Discord per v1 scope.)
      if (eventType !== MST_EVENT_TYPE) {
        return { announce: false };
      }

      // Canary-safety gate: even MST events are suppressed until operator flips
      // MST_CANARY_ENABLED=1 in production env. This is the load-bearing safety
      // posture from the build doc + task brief §4 (default disabled).
      if (!opts.enabled) {
        opts.logger.info(
          {
            eventType,
            tokenId: payload.token_id,
            contract: payload.contract,
          },
          '[kansei] MST event suppressed (MST_CANARY_ENABLED=false)',
        );
        return { announce: false };
      }

      // Defensive: empty canaryChannelId means the operator hasn't supplied the
      // channel yet — refuse to route rather than post to "" (which would 400 at
      // the Discord REST boundary, but better to be visibly silent here).
      if (!opts.canaryChannelId || opts.canaryChannelId.trim().length === 0) {
        opts.logger.warn(
          {
            eventType,
            tokenId: payload.token_id,
          },
          '[kansei] MST_CANARY_ENABLED=1 but MST_CANARY_CHANNEL_ID is empty — suppressing announce',
        );
        return { announce: false };
      }

      // Decision is { announce: true, channelId }. If a dispatcher is wired,
      // await it BEFORE returning so the subscriber's downstream logging
      // reflects the post-attempt state. Any throw inside the dispatcher
      // surfaces as a subscriber handler-error (the subscriber's existing
      // try/catch around router.route() catches it), but the dispatcher
      // itself MUST NOT throw on Discord-send failure — see announcement-dispatcher.ts.
      if (opts.dispatchAnnouncement) {
        try {
          await opts.dispatchAnnouncement({
            eventType,
            channelId: opts.canaryChannelId,
            payload,
          });
        } catch (err) {
          // Dispatcher contract says fail-soft (announceMint catches Discord
          // errors + returns { posted: false }). A throw here is a bug; log
          // + return { announce: false } so the subscriber doesn't log a
          // false-positive "routed" outcome.
          opts.logger.error(
            {
              err: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
              eventType,
              tokenId: payload.token_id,
            },
            '[kansei] dispatcher threw (announcement contract violated)',
          );
          return { announce: false };
        }
      }

      return { announce: true, channelId: opts.canaryChannelId };
    },
  };
}
