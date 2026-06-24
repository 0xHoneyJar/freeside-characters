/**
 * Safe render · cycle-007 S4/T4.4 + AC-RT-003 closure (INV-18).
 *
 * Red Team AC-RT-003 (Phase 4.5 · 740 THEORETICAL): trace payloads contain attacker-
 * influenced text (Discord input · LLM hallucination). When the CLI prints human-format
 * output to a TTY, ANSI escape sequences in payload fields can hijack the terminal
 * (title bar change · OSC 8 fake-hyperlink · screen-clear-and-fake-prompt). CVE-2003-0063
 * family.
 *
 * sanitizeForTerminal strips C0/C1 control bytes + renders OSC 8 hyperlinks as plain
 * `[url]` suffixes BEFORE printing to TTY. Defense-in-depth for any code path that
 * displays user-influenced trace content to operator's terminal.
 *
 * Also exported for dashboard SSE pre-sanitization (server-side defense even though
 * the browser-side renderer must independently use textContent · per Phase 6
 * SKP-001/CRITICAL XSS finding).
 */

// Pattern matches:
//  - CSI: ESC [ ... final-byte (0x40-0x7E)
//  - OSC: ESC ] ... (BEL OR ESC \)
//  - All other ESC X single-char sequences
//  - C0 control bytes (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F)
//  - DEL (0x7F)
//  - C1 control bytes (0x80-0x9F)
const ANSI_AND_CONTROL_REGEX = new RegExp(
  [
    String.raw`\x1B\[[0-?]*[ -/]*[@-~]`,
    String.raw`\x1B\][^\x07\x1B]*(\x07|\x1B\\)`,
    String.raw`\x1B[@-Z\\-_]`,
    String.raw`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]`,
  ].join('|'),
  'g',
);

// OSC 8 hyperlink: ESC ] 8 ; params ; URL BEL/ST text ESC ] 8 ; ; BEL/ST
// (covered by the OSC pattern above · we extract the URL to keep it visible)
const OSC8_REGEX = /\x1B\]8;[^;]*;([^\x07\x1B]+)(?:\x07|\x1B\\)([^\x1B]*)\x1B\]8;;(?:\x07|\x1B\\)/g;

/**
 * Strip ANSI escapes + C0/C1 control bytes from a string. OSC 8 hyperlinks
 * are rewritten as `text [url]` plain-text suffixes (preserves info · removes
 * the click-this-link-to-secretly-run-X attack surface).
 *
 * The CLI's own ANSI color emission (layer-glyph TTY coloring) bypasses this
 * function · only PAYLOAD strings flow through here.
 */
export function sanitizeForTerminal(value: string): string {
  // First pass: extract OSC 8 hyperlinks into plain text (must run before generic strip)
  const withLinks = value.replace(OSC8_REGEX, (_, url, text) => `${text} [${url}]`);
  // Second pass: strip remaining ANSI + control bytes
  return withLinks.replace(ANSI_AND_CONTROL_REGEX, '');
}

/**
 * HTML-escape a string for browser rendering (defense against XSS in dashboard
 * SSE-streamed payload content).
 *
 * Per Phase 6 SKP-001/CRITICAL: sanitizeForTerminal does NOT close DOM XSS.
 * Browser renderer MUST use `.textContent` (NEVER `.innerHTML`) for payload
 * string values. This function is for paths that MUST emit HTML (e.g. deliberate
 * markup) · those should be rare.
 */
export function sanitizeForBrowser(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
