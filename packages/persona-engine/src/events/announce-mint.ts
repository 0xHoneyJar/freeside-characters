/**
 * announce-mint.ts — DEP-2 of cluster-events-pillar v1.
 *
 * The enrichment + dispatch path for a MST mint event. Called by the
 * announcement-dispatcher when the kansei router returns
 * { announce: true, channelId }.
 *
 * Pipeline:
 *   1. Parallel-fetch enrichment (Promise.allSettled, fail-soft):
 *      - identity-api `/v1/profile?world=mibera&wallet=<minter>` → nym
 *      - inventory-api `GET /nfts/{contract}/{tokenId}` → image + traits
 *   2. Derive display name: identity nym → shortenAddress (NEVER ENS).
 *   3. Build Components V2 payload via buildEnrichedMintAnnouncement.
 *   4. discordWebhookSendFn(payload) — wrapped in try/catch; never throws.
 *
 * Build-doc reference: `cluster-events-pillar-coordinator/grimoires/loa/sprint.md` §5.
 *
 * Failure-mode contract:
 *   - Both enrichment fetches fail → still posts with shortAddress + no image
 *     + no traits (canary-safe minimal post; visible rather than silent).
 *   - Either enrichment fetch exceeds `fetchTimeoutMs` (default 3000ms) → treated
 *     as failure (matches the resolve-nft-pfp.ts pattern).
 *   - `inventoryApiBaseUrl` unset (CI / dev / pre-deploy) → no image / no traits,
 *     announcement still ships. Image enrichment is dormant-until-deploy.
 *   - discordWebhookSendFn throws → returns { posted: false, reason } without
 *     bubbling — the subscriber must stay alive for the next envelope.
 *
 * inventory-api is a deployed Hyper (Bun) HTTP+MCP service, consumed over the
 * wire via the thin typed client in
 * `packages/persona-engine/src/orchestrator/inventory/inventory-http-client.ts`
 * — NEVER as an npm package (the earlier `@0xhoneyjar/inventory` dynamic-import
 * plan was a phantom dep; dead). The image path mirrors the identity-api fetch
 * posture exactly: bounded fetch, fail-soft to null.
 *
 * Identity API: plain HTTP fetch (no SDK exists yet). The endpoint
 * `/v1/profile?world=<slug>&wallet=<addr>` returns
 * `{ identity: { world_identities: [{world_slug, nym, ...}, ...] } }` per
 * the build doc §5 example.
 */

import type { NftMintDetected } from '@0xhoneyjar/events';
import type { MintEventSubscriberLogger } from './mint-event-subscriber.ts';
import {
  buildEnrichedMintAnnouncement,
  type MintTraitInput,
} from './mint-announcement-render.ts';
import { fetchNftMetadataHttp } from '../orchestrator/inventory/inventory-http-client.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The Discord payload shape the dispatcher consumes. Components-V2 array +
 * a plain-text fallback the caller may use when the medium doesn't support
 * Components V2 (e.g. a legacy webhook).
 */
export interface DiscordMessagePayload {
  channelId: string;
  components: unknown[];
  contentFallback?: string;
}

export type DiscordSendFn = (msg: DiscordMessagePayload) => Promise<void>;

export interface AnnounceMintOpts {
  payload: NftMintDetected;
  /** identity-api base URL — e.g. https://identity.0xhoneyjar.xyz */
  identityApiBaseUrl: string;
  /**
   * inventory-api base URL — e.g. https://inventory.0xhoneyjar.xyz. When set,
   * the image/traits enrichment fetches `GET {base}/nfts/{contract}/{tokenId}`.
   * When unset (CI / dev / pre-deploy), the announcement ships imageless +
   * traitless (fail-soft). Plumbed from announcement-dispatcher.
   */
  inventoryApiBaseUrl?: string;
  /** Injectable Discord send — keeps announceMint substrate-clean for tests. */
  discordWebhookSendFn: DiscordSendFn;
  /** Resolved by the router; passed in explicitly so this lib is router-agnostic. */
  channelId: string;
  /** Shared logger with the subscriber for consistent structured logging. */
  logger: MintEventSubscriberLogger;
  /** Default 3000ms — matches resolve-nft-pfp.ts. */
  fetchTimeoutMs?: number;
  /**
   * Override the human-readable collection name. When unset, derived from
   * the contract address (today only MST is recognized; others fall back to
   * a generic label, but the router gates non-MST out before reaching here).
   */
  collectionDisplayOverride?: string;
  /**
   * Test seam: override the global fetch (for identity-api requests).
   */
  fetchFn?: typeof fetch;
  /**
   * Test seam: override the fetch used for inventory-api metadata requests.
   * Kept distinct from `fetchFn` so the two enrichment paths stay
   * independently mockable (mirrors the identity-api fetchFn seam). Defaults
   * to `fetchFn ?? fetch` when unset.
   */
  metadataFetchFn?: typeof fetch;
}

export interface AnnounceMintResult {
  posted: boolean;
  reason?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// internal types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Renderer-facing metadata shape (image + attributes are all the renderer
 * consumes). Returned by the inventory-api HTTP client; mapped from the
 * `GET /nfts/{contract}/{tokenId}` 200 body.
 */
interface NftMetadata {
  image?: string | null;
  attributes?: Array<{ trait_type?: string; value?: string | number }> | null;
}

interface IdentityProfileResponse {
  identity?: {
    world_identities?: Array<{
      world_slug?: string;
      nym?: string | null;
    } | null> | null;
  };
}

// Mibera Shadows contract address (lowercase, canonical 0x form per schema).
const MST_CONTRACT = '0x048327a187b944ddac61c6e202bfccd20d17c008';
const DEFAULT_FETCH_TIMEOUT_MS = 3_000;

// ──────────────────────────────────────────────────────────────────────────────
// entrypoint
// ──────────────────────────────────────────────────────────────────────────────

export async function announceMint(
  opts: AnnounceMintOpts,
): Promise<AnnounceMintResult> {
  const timeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const doFetch = opts.fetchFn ?? fetch;
  const metadataFetch = opts.metadataFetchFn ?? doFetch;

  // 1. Parallel-fetch enrichment, both bounded by timeoutMs, both fail-soft.
  const [identityRes, metadataRes] = await Promise.allSettled([
    fetchIdentityProfile({
      baseUrl: opts.identityApiBaseUrl,
      world: 'mibera',
      wallet: opts.payload.minter,
      timeoutMs,
      doFetch,
      logger: opts.logger,
    }),
    fetchNftMetadata({
      baseUrl: opts.inventoryApiBaseUrl,
      contract: opts.payload.contract,
      tokenId: opts.payload.token_id,
      timeoutMs,
      doFetch: metadataFetch,
      logger: opts.logger,
    }),
  ]);

  // 2. Derive display name (nym → shortAddress; NEVER ENS).
  let displayName = shortenAddress(opts.payload.minter);
  if (identityRes.status === 'fulfilled' && identityRes.value) {
    const nym = extractMiberaNym(identityRes.value);
    if (nym) displayName = nym;
  } else if (identityRes.status === 'rejected') {
    opts.logger.warn(
      { err: String(identityRes.reason).slice(0, 200), minter: opts.payload.minter },
      '[announce-mint] identity-api fail-soft → shortAddress',
    );
  }

  // 3. Extract metadata fields (fail-soft).
  let imageUrl: string | null = null;
  let traits: MintTraitInput[] | null = null;
  if (metadataRes.status === 'fulfilled' && metadataRes.value) {
    imageUrl = typeof metadataRes.value.image === 'string' ? metadataRes.value.image : null;
    traits = normalizeAttributes(metadataRes.value.attributes ?? null);
  } else if (metadataRes.status === 'rejected') {
    opts.logger.warn(
      {
        err: String(metadataRes.reason).slice(0, 200),
        contract: opts.payload.contract,
        tokenId: opts.payload.token_id,
      },
      '[announce-mint] inventory-api fail-soft → no image / no traits',
    );
  }

  // 4. Build Components V2 payload.
  const rendered = buildEnrichedMintAnnouncement({
    displayName,
    collection: opts.collectionDisplayOverride ?? deriveCollectionDisplay(opts.payload.contract),
    tokenId: opts.payload.token_id,
    imageUrl,
    traits,
    txHash: opts.payload.transaction_hash,
    chainId: opts.payload.chain_id,
    emittedAt: opts.payload.timestamp,
  });

  // 5. Dispatch via injected send fn — wrap in try/catch so subscriber stays alive.
  try {
    await opts.discordWebhookSendFn({
      channelId: opts.channelId,
      components: rendered.components,
      contentFallback: rendered.contentFallback,
    });
    opts.logger.info(
      {
        channelId: opts.channelId,
        tokenId: opts.payload.token_id,
        contract: opts.payload.contract,
        displayName,
        hasImage: imageUrl != null,
        hasTraits: traits != null,
      },
      '[announce-mint] posted',
    );
    return { posted: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    opts.logger.error(
      {
        err: reason.slice(0, 200),
        channelId: opts.channelId,
        tokenId: opts.payload.token_id,
      },
      '[announce-mint] discord send failed',
    );
    return { posted: false, reason };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// helpers (exported for testing)
// ──────────────────────────────────────────────────────────────────────────────

/** 0xABCD…wxyz shape — NEVER ENS. Per the auth substitution roadmap, ENS is excised from THJ surfaces. */
export function shortenAddress(addr: string): string {
  if (!addr.startsWith('0x') || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Pull the Mibera-world nym out of an identity-api profile response.
 * Returns null if the response is missing the mibera world entry OR the nym
 * is empty.
 */
export function extractMiberaNym(
  profile: IdentityProfileResponse | null | undefined,
): string | null {
  const worlds = profile?.identity?.world_identities;
  if (!worlds || !Array.isArray(worlds)) return null;
  for (const w of worlds) {
    if (!w) continue;
    if (w.world_slug === 'mibera' && typeof w.nym === 'string' && w.nym.trim().length > 0) {
      return w.nym.trim();
    }
  }
  return null;
}

/**
 * Map a contract address to a human-readable collection name. Today only
 * MST is recognized — the router gates non-MST out before reaching here,
 * so the fallback is defensive only.
 */
export function deriveCollectionDisplay(contract: string): string {
  if (contract.toLowerCase() === MST_CONTRACT) return 'Mibera Shadow';
  return 'NFT';
}

/** Coerce inventory attributes into the renderer's strict shape; drop malformed entries. */
function normalizeAttributes(
  raw: Array<{ trait_type?: string; value?: string | number }> | null,
): MintTraitInput[] | null {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null;
  const out: MintTraitInput[] = [];
  for (const a of raw) {
    if (!a) continue;
    const k = typeof a.trait_type === 'string' ? a.trait_type.trim() : '';
    if (!k) continue;
    const v =
      typeof a.value === 'string'
        ? a.value.trim()
        : typeof a.value === 'number'
          ? String(a.value)
          : '';
    if (!v) continue;
    out.push({ trait_type: k, value: v });
  }
  return out.length > 0 ? out : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// enrichment fetchers (internal)
// ──────────────────────────────────────────────────────────────────────────────

async function fetchIdentityProfile(opts: {
  baseUrl: string;
  world: string;
  wallet: string;
  timeoutMs: number;
  doFetch: typeof fetch;
  logger: MintEventSubscriberLogger;
}): Promise<IdentityProfileResponse | null> {
  // Defensive: missing baseUrl → no-op fail-soft (caller may not have configured it yet).
  if (!opts.baseUrl || opts.baseUrl.trim().length === 0) return null;
  const trimmed = opts.baseUrl.replace(/\/+$/, '');
  const url = `${trimmed}/v1/profile?world=${encodeURIComponent(opts.world)}&wallet=${encodeURIComponent(opts.wallet)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await opts.doFetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      opts.logger.warn(
        { status: res.status, url },
        '[announce-mint] identity-api non-OK → fail-soft',
      );
      return null;
    }
    return (await res.json()) as IdentityProfileResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch token metadata (image + traits) from inventory-api over HTTP.
 *
 * Delegates to the thin typed client (inventory-http-client.ts) which mirrors
 * fetchIdentityProfile's posture (AbortController + timeout, accept JSON,
 * non-OK → null, fail-soft). When `baseUrl` is unset (pre-deploy), the client
 * returns null without fetching → announcement ships imageless.
 *
 * The outer try/catch is a defense-in-depth fail-soft seam: the client already
 * fails soft internally, but a malformed JSON body (`res.json()` throws) or any
 * unexpected error here must NEVER bubble past enrichment — the canary stays
 * visible. Mirrors the Promise.allSettled rejection handling in announceMint.
 */
async function fetchNftMetadata(opts: {
  baseUrl: string | undefined;
  contract: string;
  tokenId: string;
  timeoutMs: number;
  doFetch: typeof fetch;
  logger: MintEventSubscriberLogger;
}): Promise<NftMetadata | null> {
  try {
    if (!opts.baseUrl) return null; // pre-deploy / unconfigured → no image, fail-soft
    return await fetchNftMetadataHttp({
      baseUrl: opts.baseUrl,
      contract: opts.contract,
      tokenId: opts.tokenId,
      timeoutMs: opts.timeoutMs,
      doFetch: opts.doFetch,
      logger: opts.logger,
    });
  } catch (err) {
    // inventory-api unavailable / errored / malformed body — fail-soft to no metadata.
    opts.logger.warn(
      {
        err: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        contract: opts.contract,
        tokenId: opts.tokenId,
      },
      '[announce-mint] inventory-api unavailable',
    );
    return null;
  }
}
