/**
 * Discord markdown sanitizer.
 *
 * Discord's parser interprets `_` as italic and `*` as italic too.
 * Onchain identifiers are full of underscores (e.g., `mibera_acquire`,
 * `transfer_from_wallet`) which would italicize-mid-word and break
 * factor IDs across the digest.
 *
 * This sanitizer escapes Discord formatting characters in already-formed
 * text. Apply it ONLY to text being sent to Discord, AFTER the LLM has
 * generated voice output and embed fields are constructed.
 *
 * Per persona-doc rule: persona writes plain text; bot guarantees
 * correctness via this sanitizer. The LLM never thinks about escaping.
 *
 * Refs:
 *   apps/bot/src/persona/ruggy.md "The underscore problem"
 */

// We escape underscores, asterisks, tildes, and pipes — but NOT backticks.
// Backticks are intentionally used by the LLM for inline-code spans on
// identifiers (`nft:mibera`, `0xa3...c1`), and Discord 2026 made those
// tap-to-copy on mobile. Stripping them would lose that affordance.
const FORMAT_CHARS = /(?<!\\)([_*~|])/g;

// Custom emoji syntax: <:name:id> or <a:name:id>. Escaping the
// underscore in `mibera_ninja` breaks Discord's emoji parser; the
// emoji renders as broken `<:mibera\_ninja:...>` text instead of the
// image. Same applies to user/role/channel mentions and timestamps —
// any `<...>` token is structural, not prose.
const PROTECTED_TOKEN = /<(a?:[\w]+:\d+|@[!&]?\d+|#\d+|t:\d+(?::[a-zA-Z])?)>/g;

// Placeholder uses Unicode Private-Use Area chars (U+E001..U+EFFE) —
// these never appear in normal text, contain no markdown format chars,
// and survive escapeDiscordMarkdown round-trip cleanly.
const PLACEHOLDER_BASE = 0xE001;

export function escapeDiscordMarkdown(text: string): string {
  if (!text) return text;

  // Step 1: pull protected tokens out into PUA placeholders.
  const protectedSegments: string[] = [];
  let withPlaceholders = text.replace(PROTECTED_TOKEN, (match) => {
    const i = protectedSegments.length;
    protectedSegments.push(match);
    return String.fromCharCode(PLACEHOLDER_BASE + i);
  });

  // Step 2: escape format chars outside inline-code spans.
  withPlaceholders = withPlaceholders
    .split('`')
    .map((segment, idx) => (idx % 2 === 0 ? segment.replace(FORMAT_CHARS, '\\$1') : segment))
    .join('`');

  // Step 3: restore protected tokens verbatim.
  return withPlaceholders.replace(/[-]/g, (ch) => {
    const i = ch.charCodeAt(0) - PLACEHOLDER_BASE;
    return protectedSegments[i] ?? '';
  });
}

/**
 * Specifically targets identifier-like substrings (snake_case, factor IDs)
 * to escape underscores while leaving prose alone. Preferred when you
 * have structured fields rather than free-form text.
 */
export function escapeIdentifier(id: string): string {
  return id.replace(/_/g, '\\_');
}

/**
 * Wrap an identifier in inline code AND escape underscores for safety.
 * Mobile users get tap-to-copy on inline code.
 */
export function inlineCode(id: string): string {
  // inside backticks, formatting chars are NOT parsed — but the renderer
  // is sometimes inconsistent. belt-and-suspenders: escape + wrap.
  return `\`${id}\``;
}
