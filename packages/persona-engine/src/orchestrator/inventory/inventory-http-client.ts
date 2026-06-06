/**
 * inventory-http-client — thin typed HTTP client for inventory-api's
 * single-token metadata route.
 *
 * inventory-api is a deployed Hyper (Bun) HTTP+MCP SERVICE, consumed over the
 * wire — NEVER as an npm package (its own beacon + src/app.ts say so; the
 * earlier `@0xhoneyjar/inventory` / `@freeside/inventory` dynamic-import plan
 * was a phantom dep and is dead). This module is the lightweight consumer-owned
 * SDK: one call, one route, no cross-repo package.
 *
 * Routes:
 *   GET {baseUrl}/nfts/{contract}/{tokenId}
 *     200 → { name, description, image, attributes: [{ trait_type, value }] }
 *     400/404 → { error: { status, message, code? } }
 *   The 200 body is the metadata document directly (NOT wrapped).
 *
 *   GET {baseUrl}/profile/{wallet}  (#87 GAP-2 · spotlight pfp)
 *     200 → { address, contract, imageUrl: string | null }
 *     400/404/5xx → fail-soft to null (see fetchProfilePictureHttp).
 *
 * FAIL-SOFT (mirrors fetchIdentityProfile in announce-mint.ts EXACTLY): missing
 * baseUrl, non-OK status, timeout, or any throw → returns null. The caller
 * (announce-mint) then ships the announcement imageless + traitless — the
 * canary stays visible, never silently suppressed, never throws past this seam.
 *
 * End-to-end image rendering only activates once inventory-api is DEPLOYED and
 * `inventoryApiBaseUrl` is configured in the bot. Absent (CI/dev) → dormant
 * fail-soft, by design.
 */

import type { MintEventSubscriberLogger } from '../../events/mint-event-subscriber.ts';

/**
 * The renderer-facing metadata shape. Matches the `NftMetadata` internal type
 * in announce-mint.ts (image + attributes are the only fields the renderer
 * consumes; name/description are carried for completeness/future use).
 */
export interface InventoryNftMetadata {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  attributes?: Array<{ trait_type?: string; value?: string | number }> | null;
}

/** Raw 200 body shape from inventory-api GET /nfts/:contract/:tokenId. */
interface InventoryMetadataResponse {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  attributes?: Array<{ trait_type?: string; value?: string | number }> | null;
}

/** Raw 200 body shape from inventory-api GET /profile/:wallet (#87 GAP-2). */
interface InventoryProfileResponse {
  address?: string | null;
  contract?: string | null;
  /** https CDN pfp url for the spotlight surface, or null when none is on file. */
  imageUrl?: string | null;
}

/** Image hosts allowed into a rendered Discord card (THJ sovereign assets). */
const ALLOWED_IMAGE_HOSTS = new Set([
  'assets.0xhoneyjar.xyz',
  'metadata.0xhoneyjar.xyz',
]);

/**
 * Allowlist guard for the upstream `image` before it lands in a Discord card.
 * The 200 body is untrusted (inventory-api → storage-api JSON): reject anything
 * that isn't `https` on a known THJ asset host, so a compromised/buggy upstream
 * can't inject an arbitrary-scheme (`javascript:`, `data:`) or off-domain URL
 * into the announcement card or its plain-text fallback. null → render omits the
 * image (fail-soft), exactly as for missing metadata.
 */
function safeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!ALLOWED_IMAGE_HOSTS.has(u.hostname)) return null;
  return raw;
}

/**
 * Fetch a single token's metadata from inventory-api over HTTP.
 *
 * Mirrors fetchIdentityProfile's posture: AbortController + setTimeout(abort),
 * `accept: application/json`, non-OK → logger.warn + null, fail-soft on any
 * throw, clearTimeout in finally.
 */
export async function fetchNftMetadataHttp(opts: {
  /** inventory-api base URL — e.g. https://inventory.0xhoneyjar.xyz */
  baseUrl: string;
  /** 0x-prefixed contract address. */
  contract: string;
  /** Decimal token id string (NftMintDetectedSchema enforces `^\d+$`). */
  tokenId: string;
  timeoutMs: number;
  doFetch: typeof fetch;
  logger: MintEventSubscriberLogger;
}): Promise<InventoryNftMetadata | null> {
  // Defensive: missing baseUrl → no-op fail-soft (deploy hasn't configured it).
  if (!opts.baseUrl || opts.baseUrl.trim().length === 0) return null;
  const trimmed = opts.baseUrl.replace(/\/+$/, '');
  const url = `${trimmed}/nfts/${encodeURIComponent(opts.contract)}/${encodeURIComponent(opts.tokenId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await opts.doFetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 400/404 (unknown token / bad input) and 5xx all fail-soft to no image.
      opts.logger.warn(
        { status: res.status, contract: opts.contract, tokenId: opts.tokenId },
        '[announce-mint] inventory-api non-OK → fail-soft (no image / no traits)',
      );
      return null;
    }
    const body = (await res.json()) as InventoryMetadataResponse;
    return {
      name: body.name ?? null,
      description: body.description ?? null,
      image: safeImageUrl(body.image),
      attributes: Array.isArray(body.attributes) ? body.attributes : null,
    };
  } catch (err) {
    // Honor this seam's contract ("never throws past this seam"): a network
    // failure, timeout-abort, or malformed JSON fail-softs to null rather than
    // propagating. (announce-mint's outer catch is then belt-and-suspenders.)
    opts.logger.warn(
      {
        err: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        contract: opts.contract,
        tokenId: opts.tokenId,
      },
      '[announce-mint] inventory-api fetch errored → fail-soft (no image / no traits)',
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a wallet's NFT profile picture from inventory-api over HTTP (#87 GAP-2).
 *
 * The exact fail-soft sibling of fetchNftMetadataHttp: AbortController +
 * setTimeout(abort), `accept: application/json`, non-OK → logger.warn + null,
 * any throw (network failure, timeout-abort, malformed JSON) → null, clearTimeout
 * in finally. Missing baseUrl → no fetch, null (dormant-until-deployed; the digest
 * stays DB-only until INVENTORY_API_URL is configured).
 *
 * The returned url passes the SAME `safeImageUrl` host-allowlist as the mint card
 * — it lands in a Discord card's Section Thumbnail, so the trust boundary is
 * identical (https on assets./metadata.0xhoneyjar.xyz only; anything else → null).
 *
 * Returns the validated https pfp url, or null on EVERY non-happy path. NEVER
 * throws past this seam — a down/undeployed/slow/malformed inventory-api must not
 * break or block the digest render (the load-bearing fail-soft invariant).
 */
export async function fetchProfilePictureHttp(opts: {
  /** inventory-api base URL — e.g. https://inventory.0xhoneyjar.xyz */
  baseUrl: string;
  /** 0x-prefixed wallet address. */
  wallet: string;
  timeoutMs: number;
  doFetch: typeof fetch;
  logger: MintEventSubscriberLogger;
}): Promise<string | null> {
  // Defensive: missing baseUrl → no-op fail-soft (deploy hasn't configured it).
  if (!opts.baseUrl || opts.baseUrl.trim().length === 0) return null;
  const trimmed = opts.baseUrl.replace(/\/+$/, '');
  const url = `${trimmed}/profile/${encodeURIComponent(opts.wallet)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await opts.doFetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 400/404 (unknown wallet / bad input) and 5xx all fail-soft to no pfp.
      opts.logger.warn(
        { status: res.status, wallet: opts.wallet },
        '[spotlight-pfp] inventory-api non-OK → fail-soft (DB pfp fallback / no image)',
      );
      return null;
    }
    const body = (await res.json()) as InventoryProfileResponse;
    // safeImageUrl: same Discord-card trust boundary as the mint card — null on
    // null/non-https/off-allowlist-host. The DB pfp fallback then applies upstream.
    return safeImageUrl(body.imageUrl);
  } catch (err) {
    // Honor the seam's contract: a network failure, timeout-abort, or malformed
    // JSON fail-softs to null rather than propagating into the digest pipeline.
    opts.logger.warn(
      {
        err: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        wallet: opts.wallet,
      },
      '[spotlight-pfp] inventory-api fetch errored → fail-soft (DB pfp fallback / no image)',
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
