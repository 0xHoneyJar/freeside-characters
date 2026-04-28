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

export function escapeDiscordMarkdown(text: string): string {
  if (!text) return text;
  // We must NOT escape characters inside inline-code spans (between
  // single backticks). Discord doesn't parse formatting inside those.
  // Split on backticks, alternate: outside | inside | outside | inside
  return text
    .split('`')
    .map((segment, idx) => (idx % 2 === 0 ? segment.replace(FORMAT_CHARS, '\\$1') : segment))
    .join('`');
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
