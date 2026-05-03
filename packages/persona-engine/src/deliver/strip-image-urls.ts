/**
 * Strip attached image URLs from reply text (V0.7-A.3 HOTFIX B2a).
 *
 * The env-aware composer (composeWithImage) downloads grail image bytes
 * and attaches them to the Discord webhook payload directly. Bytes are
 * the contract — bypassing Discord automod URL blocklists that filter
 * `assets.0xhoneyjar.xyz`. But the LLM, having seen
 * `image: "https://assets.0xhoneyjar.xyz/.../black-hole.png"` in the
 * tool result envelope, naturally pastes that URL inline in its voice
 * prose. Automod still triggers and the message disappears in Discord
 * even with attached=1 — operator hit this 2026-05-02 PM with Call A
 * (lookup_grail × 2).
 *
 * Defense in depth: B2b reinforces persona instructions to never paste
 * image URLs; B2a (this helper) is the composer-side belt-and-braces.
 *
 * Pattern shapes recognized + removed:
 *   - plain URL paste:           https://assets.0xhoneyjar.xyz/.../x.png
 *   - markdown image:            ![alt](https://assets.0xhoneyjar.xyz/.../x.png)
 *   - markdown link:             [text](https://assets.0xhoneyjar.xyz/.../x.png)
 *   - bare URL with surrounding orphan punctuation cleanup
 *
 * Whitespace cleanup: collapses 3+ consecutive newlines to 2, trims
 * leftover orphan punctuation (commas, periods) immediately adjacent
 * to a removed URL when no other word follows them on that line.
 */

/**
 * Escape regex metacharacters in a string so it can be embedded in a
 * RegExp pattern as a literal match.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip occurrences of each URL in `attachedUrls` from `text`. Handles
 * markdown image, markdown link, and plain URL forms. No-op when
 * `attachedUrls` is empty.
 *
 * Only removes URLs that appear in `attachedUrls` — URLs not in the list
 * are preserved (a non-attached link is not redundant, so leave it). This
 * is the contract: strip what we attached, leave everything else.
 */
export function stripAttachedImageUrls(
  text: string,
  attachedUrls: string[],
): string {
  if (!text || attachedUrls.length === 0) return text;

  let out = text;

  for (const url of attachedUrls) {
    if (!url) continue;
    const escaped = escapeRegex(url);

    // 1. Markdown image: ![alt text](url) — remove entire `![...](url)`.
    out = out.replace(
      new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, 'g'),
      '',
    );

    // 2. Markdown link: [text](url) — remove entire `[...](url)`. The
    //    image is attached separately so the link is redundant. Keeping
    //    only the link text would imply the URL exists somewhere; safer
    //    to drop the whole construct.
    out = out.replace(
      new RegExp(`\\[[^\\]]*\\]\\(${escaped}\\)`, 'g'),
      '',
    );

    // 3. Plain URL paste — remove the bare URL string.
    out = out.replace(new RegExp(escaped, 'g'), '');
  }

  // Whitespace + orphan punctuation cleanup:
  //   - " ." or " ," that were left dangling next to a removed URL
  //     (e.g. "see , the void" or "see . the void")
  //   - 3+ consecutive newlines collapsed to 2 (paragraph spacing)
  //   - trailing whitespace per line
  //   - trim final result
  out = out.replace(/\s+([.,;:!?])/g, '$1'); // close punctuation gap
  out = out.replace(/[ \t]+$/gm, ''); // trim trailing whitespace per line
  out = out.replace(/\n{3,}/g, '\n\n'); // collapse paragraph breaks
  // Collapse multiple consecutive spaces (left from URL removal mid-line)
  // but PRESERVE paragraph breaks (newlines) and leading indent.
  out = out.replace(/[ \t]{2,}/g, ' ');
  // Drop space immediately before newline (e.g. "see  \nnext line")
  out = out.replace(/ +\n/g, '\n');
  out = out.trim();

  return out;
}

/**
 * Helper: extract the URLs from a list of CodexGrailResult-shaped objects.
 * Returns the `image` (preferred) or `image_url` (alt) value when present.
 *
 * Used by composeReplyWithEnrichment to derive the strip-list from the
 * grail candidates that fed composeWithImage.
 */
export function extractAttachedUrls(
  candidates: Array<{ image?: string; image_url?: string }>,
): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    const url = c.image ?? c.image_url;
    if (typeof url === 'string' && url.length > 0) {
      out.push(url);
    }
  }
  return out;
}
