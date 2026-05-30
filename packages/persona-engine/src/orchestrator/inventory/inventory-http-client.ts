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
 * Route (verified against inventory-api@831123c src/routes.ts):
 *   GET {baseUrl}/nfts/{contract}/{tokenId}
 *     200 → { name, description, image, attributes: [{ trait_type, value }] }
 *     400/404 → { error: { status, message, code? } }
 *   The 200 body is the metadata document directly (NOT wrapped).
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
      image: typeof body.image === 'string' ? body.image : null,
      attributes: Array.isArray(body.attributes) ? body.attributes : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
