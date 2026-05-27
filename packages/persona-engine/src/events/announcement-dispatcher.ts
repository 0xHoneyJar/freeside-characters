/**
 * announcement-dispatcher.ts — DEP-2 of cluster-events-pillar v1.
 *
 * The dispatch layer between the kansei router and announceMint. Keeps the
 * subscriber substrate-clean (subscriber knows about KanseiRouter; nothing
 * else) and the announceMint enrichment-renderer swappable (different events
 * could compose with different announceXxx functions later).
 *
 * Architectural choice (per task brief §3d option b): the dispatcher is a
 * SEPARATE composable layer the router awaits. The subscriber stays untouched.
 * The router is the integration seam — it accepts a dispatcher injected at
 * bot-boot wire time and invokes it when announce=true.
 *
 * Contract:
 *   - dispatchAnnouncement MUST NOT throw on Discord-send failure (announceMint
 *     already catches + returns { posted: false }).
 *   - It MAY throw on misconfiguration (bot client unavailable, etc.) — the
 *     router surfaces that as a subscriber handler-error.
 *
 * Test seam: `createAnnouncementDispatcher` accepts every external dependency
 * (logger, send fn, identity-api base URL) — the bun:test suite injects
 * stubs and asserts the dispatcher composes them correctly.
 */

import type { NftMintDetected } from '@0xhoneyjar/events';
import {
  announceMint,
  type DiscordSendFn,
  type AnnounceMintResult,
} from './announce-mint.ts';
import type { MintEventSubscriberLogger } from './mint-event-subscriber.ts';
import type { AnnouncementDispatchFn } from './mst-kansei-router.ts';

export interface AnnouncementDispatcherOpts {
  /** identity-api base URL (e.g. https://identity.0xhoneyjar.xyz). */
  identityApiBaseUrl: string;
  /** Optional dev override for the inventory-api base URL. */
  inventoryApiBaseUrl?: string;
  /** Injected by the bot: wraps the discord.js client + Components-V2 REST path. */
  discordSendFn: DiscordSendFn;
  /** Shared subscriber logger (consistent structured logging across the pillar). */
  logger: MintEventSubscriberLogger;
  /** Enrichment timeout — defaults to 3000ms per the resolve-nft-pfp.ts pattern. */
  fetchTimeoutMs?: number;
}

/**
 * Build the dispatch function that the router awaits. The returned function
 * is router-shaped (eventType, channelId, payload) → Promise<void>, but
 * internally composes the enrichment + render + dispatch via announceMint.
 */
export function createAnnouncementDispatcher(
  opts: AnnouncementDispatcherOpts,
): AnnouncementDispatchFn {
  return async ({ eventType, channelId, payload }) => {
    const result: AnnounceMintResult = await announceMint({
      payload,
      identityApiBaseUrl: opts.identityApiBaseUrl,
      inventoryApiBaseUrl: opts.inventoryApiBaseUrl,
      discordWebhookSendFn: opts.discordSendFn,
      channelId,
      logger: opts.logger,
      fetchTimeoutMs: opts.fetchTimeoutMs,
    });
    if (!result.posted) {
      // announceMint already logged the failure; we surface a single
      // dispatcher-level breadcrumb for traceability.
      opts.logger.warn(
        {
          eventType,
          channelId,
          tokenId: payload.token_id,
          reason: result.reason,
        },
        '[announcement-dispatcher] post failed (announceMint returned posted=false)',
      );
    }
    // Always resolve — fail-soft is the contract (the router's try/catch
    // is for misconfig only, not Discord-send failures).
  };
}

export type { AnnouncementDispatchFn } from './mst-kansei-router.ts';
export type { NftMintDetected };
