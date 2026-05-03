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
  const files = fetched.filter((f): f is EnrichedFile => f !== null);

  if (files.length === 0) {
    return { content: replyText };
  }
  return { content: replyText, files };
}

async function fetchAttachment(
  candidate: CodexGrailResult,
  timeoutMs: number,
): Promise<EnrichedFile | null> {
  const url = candidate.image ?? candidate.image_url;
  if (!url) return null;

  const slug = (candidate.ref ?? 'grail').replace(/^@/, '').trim() || 'grail';
  const ext = inferExtension(url);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.byteLength === 0) return null;
    return {
      name: `${slug}.${ext}`,
      data,
      contentType: extToContentType(ext),
    };
  } catch {
    return null;
  }
}

function inferExtension(url: string): string {
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
