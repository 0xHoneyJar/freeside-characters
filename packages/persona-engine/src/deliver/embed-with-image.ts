/**
 * Env-aware image composition (V0.7-A.3 · spec §4.2).
 *
 * The composer downloads image bytes server-side and returns them as
 * an EnrichedPayload that the webhook layer attaches via discord.js
 * AttachmentBuilder. Bytes are the contract — bypasses Discord automod
 * URL blocklists that filter `assets.0xhoneyjar.xyz` and similar.
 *
 * Mirror of the imagegen V0.11.3 / PR #15 path (`sendImageReplyViaWebhook`)
 * for grail-from-codex tool results. Same architectural shape: bytes →
 * Buffer → discord.js attachment → webhook.send({files: [...]}).
 *
 * Per spec §2 invariants:
 *   - Composer is character-agnostic; only fires when tool result envelope
 *     has `image`/`image_url` field (V1: lookup_grail / lookup_mibera /
 *     search_codex when top-1 has image)
 *   - V1 single-image (maxAttachments default 1); multi deferred to V1.5
 *   - Single-shot fetch with 5s timeout · graceful degrade to text-only
 *     on any failure (no retry-storm on CDN failures)
 *
 * Uses global `fetch` (Bun/Node 22+ ship undici-based fetch globally) +
 * AbortSignal.timeout for the timeout — no new dep added.
 */

export interface CodexGrailResult {
  /** `@g<id>` ref or similar (e.g. `@g876`). */
  ref?: string;
  /** Display name (e.g. "Black Hole"). */
  name?: string;
  /** Image URL — primary key for grail tool results. */
  image?: string;
  /** Alt URL key — search_codex envelope sometimes uses image_url. */
  image_url?: string;
  /** Optional lore/description text — unused by composer, present for caller. */
  description?: string;
}

export interface EnrichedFile {
  /** Filename Discord shows on the attachment (e.g. `g876.png`). */
  name: string;
  /** Raw image bytes. */
  data: Buffer;
  /** MIME content type (e.g. `image/png`). */
  contentType: string;
}

export interface EnrichedPayload {
  /** Reply text — passed through unchanged from composeReply. */
  content: string;
  /** Optional attachments — undefined when no candidates fetched cleanly. */
  files?: EnrichedFile[];
  /**
   * V0.7-A.3 polish (F10 · 2026-05-02):
   * URLs corresponding to successfully-fetched + attached `files`, in the
   * same order. Present only when `files` is present. Lets callers strip
   * the EXACT URLs we attached from voice text (B2a hotfix path) without
   * having to re-derive from the input candidate list (which would assume
   * file ordering matches input ordering — true today but couples caller
   * to internal slice/filter behavior).
   */
  attachedUrls?: string[];
}

export interface ComposeWithImageOptions {
  /** Cap on attachments fetched per call (V1 default 1; V1.5 may raise). */
  maxAttachments?: number;
  /** Per-fetch timeout in milliseconds (default 5000ms — spec §2.5 budget). */
  fetchTimeoutMs?: number;
}

const DEFAULT_MAX_ATTACHMENTS = 1;
const DEFAULT_FETCH_TIMEOUT_MS = 5000;

/**
 * SSRF defense (V0.7-A.3 bridgebuilder F5 · 2026-05-02):
 * The codex MCP returns image URL strings from the substrate but a misbehaving
 * or compromised upstream could return file:, data:, internal addresses
 * (link-local 169.254.169.254 cloud metadata, http://localhost adjacent
 * services), or https://attacker redirects to those. Bytes are then attached
 * to a Discord webhook = exfiltration channel. Mitigations:
 *   - ALLOWED_SCHEMES whitelist scheme check
 *   - ALLOWED_IMAGE_HOSTS whitelist hostname check (canonical CDN only)
 *   - redirect: 'error' on fetch — no redirect-to-internal pivot
 *   - MAX_ATTACHMENT_BYTES cap — Content-Length check + post-arrayBuffer
 *     belt-and-braces (some servers omit Content-Length)
 * V1.5: load allowlist from config/env so adding metadata.0xhoneyjar.xyz
 * or per-tenant CDNs doesn't require a code change.
 */
const ALLOWED_SCHEMES = new Set(['https:']);
const ALLOWED_IMAGE_HOSTS = new Set(['assets.0xhoneyjar.xyz']);
/** 8MB — well under Discord's 25MB single-attachment cap; per spec §2 invariant 6. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/**
 * Allowlist gate for image URLs sourced from external tool results.
 * Returns false on unparseable URL, disallowed scheme, or disallowed host.
 */
export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return false;
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return false;
  return true;
}

/**
 * Compose a webhook payload with the reply text plus optional image
 * attachments fetched from codex grail tool results.
 *
 * Returns text-only `{ content }` when:
 *   - tool results have no image/image_url candidates
 *   - all fetches fail (404, timeout, network error)
 *
 * Returns `{ content, files }` when at least one fetch succeeds. Failed
 * fetches inside a multi-candidate batch are dropped silently — the
 * caller still gets a partial-success payload rather than a complete
 * graceful-degrade.
 */
export async function composeWithImage(
  replyText: string,
  toolResults: CodexGrailResult[],
  opts: ComposeWithImageOptions = {},
): Promise<EnrichedPayload> {
  const max = opts.maxAttachments ?? DEFAULT_MAX_ATTACHMENTS;
  const timeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  const candidates = toolResults
    .filter((t) => Boolean(t.image ?? t.image_url))
    .slice(0, max);

  if (candidates.length === 0) {
    return { content: replyText };
  }

  const fetched = await Promise.all(
    candidates.map((c) => fetchAttachment(c, timeoutMs)),
  );
  // F10 polish (2026-05-02): pair each successful fetch with its source URL
  // so callers (composeReplyWithEnrichment) can strip attached URLs from
  // voice text without having to re-derive ordering from the input list.
  // Failed fetches drop out cleanly — the surviving entries are the actual
  // attached set in the order discord.js receives them.
  const successes = fetched.filter(
    (f): f is FetchedAttachment => f !== null,
  );
  if (successes.length === 0) {
    return { content: replyText };
  }
  const files = successes.map(({ file }) => file);
  const attachedUrls = successes.map(({ sourceUrl }) => sourceUrl);
  return { content: replyText, files, attachedUrls };
}

/**
 * Internal pairing of a successfully-fetched EnrichedFile with the source
 * URL that produced it. Lets composeWithImage publish the authoritative
 * attached-URL list alongside the file list (F10 polish).
 */
interface FetchedAttachment {
  file: EnrichedFile;
  sourceUrl: string;
}

async function fetchAttachment(
  candidate: CodexGrailResult,
  timeoutMs: number,
): Promise<FetchedAttachment | null> {
  const url = candidate.image ?? candidate.image_url;
  if (!url) return null;

  // F5 SSRF guard: reject before fetch on disallowed scheme/host. Logged so
  // operators see substrate misbehavior in trajectory tail; degrade to
  // text-only (treated like fetch failure by composeWithImage).
  if (!isAllowedImageUrl(url)) {
    console.warn(
      `[embed-with-image] rejected disallowed image URL ` +
        `(scheme/host not in allowlist): ${url}`,
    );
    return null;
  }

  const slug = (candidate.ref ?? 'grail').replace(/^@/, '').trim() || 'grail';
  const ext = inferExtension(url);

  try {
    // F5 SSRF guard pt 2: `redirect: 'error'` makes undici throw on any 3xx
    // so an allowlisted host can't redirect to an internal address.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    if (!res.ok) return null;

    // F6 size cap: pre-fetch Content-Length check (cheap, headers-only).
    // Some servers omit it — secondary check after arrayBuffer covers that.
    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader !== null) {
      const declared = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(declared) && declared > MAX_ATTACHMENT_BYTES) {
        console.warn(
          `[embed-with-image] rejected oversize image (content-length ` +
            `${declared} > ${MAX_ATTACHMENT_BYTES}): ${url}`,
        );
        return null;
      }
    }

    const data = Buffer.from(await res.arrayBuffer());
    if (data.byteLength === 0) return null;

    // F6 belt-and-braces: catch chunked or Content-Length-less responses
    // that exceeded the cap during streaming.
    if (data.byteLength > MAX_ATTACHMENT_BYTES) {
      console.warn(
        `[embed-with-image] rejected oversize image (post-fetch byteLength ` +
          `${data.byteLength} > ${MAX_ATTACHMENT_BYTES}): ${url}`,
      );
      return null;
    }

    return {
      file: {
        name: `${slug}.${ext}`,
        data,
        contentType: extToContentType(ext),
      },
      sourceUrl: url,
    };
  } catch {
    return null;
  }
}

function inferExtension(url: string): string {
  // Bridgebuilder F6 (LOW · 2026-05-02): codex returns canonical paths
  // with no query-string suffix. The `split('?')` + `split('#')` are
  // defensive belt-and-braces in case future grail substrates introduce
  // signed-URL params or fragment anchors. Tunable; not a blocker.
  const tail = url.split('?')[0]?.split('#')[0] ?? '';
  const dot = tail.lastIndexOf('.');
  if (dot < 0) return 'png';
  const ext = tail.slice(dot + 1).toLowerCase();
  // Guard: extensions can include path noise on malformed URLs.
  if (!/^[a-z0-9]{1,5}$/.test(ext)) return 'png';
  return ext;
}

function extToContentType(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}
