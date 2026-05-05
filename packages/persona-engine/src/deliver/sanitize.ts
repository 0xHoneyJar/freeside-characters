/**
 * Discord markdown sanitizer + voice-discipline transforms.
 *
 * Two layers operate at the chat-medium presentation boundary
 * (per `[[chat-medium-presentation-boundary]]` doctrine):
 *
 * 1. `escapeDiscordMarkdown` — escapes Discord format chars `_*~|` outside
 *    inline-code spans. Targets ID-leakage drift class. Onchain identifiers
 *    are full of underscores (e.g., `mibera_acquire`, `transfer_from_wallet`)
 *    which would italicize-mid-word and break factor IDs across the digest.
 *
 * 2. `stripVoiceDisciplineDrift` — strips em-dashes, en-dashes, asterisk
 *    roleplay, and default-on closing signoffs. Targets voice-discipline
 *    drift class (cmp-boundary §9, 2026-05-04). Operator + Eileen Discord
 *    4:45 PM PT 2026-05-04: "Do not under any circumstances use em dashes —
 *    Instant AI feel" + "shorter dialogues, one on ones don't work in this
 *    way." Universal · zero opt-out · code-block-safe · idempotent (per
 *    architect lock A4, cmp-boundary-architecture cycle SDD §13).
 *
 * Apply these ONLY to text being sent to Discord, AFTER the LLM has
 * generated voice output and embed fields are constructed. Order:
 * `stripVoiceDisciplineDrift` → `escapeDiscordMarkdown`.
 *
 * Per persona-doc rule: persona writes plain text; bot guarantees
 * correctness via these transforms. The LLM never thinks about escaping
 * or em-dashes.
 *
 * Refs:
 *   apps/bot/src/persona/ruggy.md "The underscore problem"
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   ~/vault/wiki/concepts/discord-native-register.md (2026-05-04 amend)
 *   ~/vault/wiki/concepts/negative-constraint-echo.md (affirmative blueprints)
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

// =============================================================================
// Voice-discipline transforms (cmp-boundary §9 · cycle-r-cmp-boundary-arch S1)
// =============================================================================

/**
 * Options for stripVoiceDisciplineDrift. Sprint 3 will extend with `medium`
 * for medium-aware variant selection per `MediumCapability` registry.
 */
export interface VoiceDisciplineOpts {
  /**
   * Post type · controls closing-signoff exemption. `digest` is the only
   * post-type that retains default-on closings (e.g. "stay groovy 🐻") per
   * discord-native-register doctrine. Default: undefined → strip closings.
   */
  postType?: string;
}

/**
 * Closing signoffs targeted in non-digest post types. Order LONGEST FIRST
 * so the trailing-emoji variant strips before the bare phrase (otherwise
 * the bare phrase could partial-match and leave the emoji orphan).
 */
const CLOSING_SIGNOFFS: readonly string[] = [
  'stay groovy 🐻',
  'stay groovy',
  'stay frosty',
  'keep mibing',
];

/**
 * Strip voice-discipline drift from already-composed text.
 *
 * Targets four classes:
 *   - em-dash (—, U+2014) — "instant AI feel" tell
 *   - en-dash (–, U+2013) — sibling tell at one rank lower
 *   - asterisk roleplay (`*adjusts cabling*`) — short mid-sentence stage
 *     direction. PRESERVES satoshi's `*performed-silence*` pattern (full
 *     sentence italics with periods)
 *   - closing signoffs — non-digest post types only
 *
 * Code-block safe: content inside backtick spans (inline OR triple-fence)
 * is preserved verbatim. Idempotent: running twice produces identical
 * output. Universal · zero opt-out per architect lock A4.
 *
 * Refs: cmp-boundary §9 · discord-native-register 2026-05-04 amend.
 */
export function stripVoiceDisciplineDrift(
  text: string,
  opts?: VoiceDisciplineOpts,
): string {
  if (!text) return text;

  // Apply em-dash · en-dash · asterisk transforms OUTSIDE code spans.
  // Same parity rule as escapeDiscordMarkdown: split('`') puts outside
  // segments at even idx, inside segments at odd idx. Triple-backtick
  // fences become multi-empties separated by content at odd idx
  // (preserved). Single-backtick inline code at odd idx (preserved).
  const transformed = text
    .split('`')
    .map((segment, idx) => (idx % 2 === 0 ? applyVoiceTransforms(segment) : segment))
    .join('`');

  // Closing-signoff strip is a per-text suffix transform (no need for
  // code-block awareness — closings don't live inside code blocks).
  const skipClosings = opts?.postType === 'digest';
  const closed = skipClosings ? transformed : stripTrailingClosings(transformed);

  // FINAL cleanup at whole-text level:
  //  - Trim leading whitespace at start (artifact from stripped roleplay
  //    at sentence start). Per-line indentation preserved.
  //  - Trim trailing comma + whitespace (artifact from em-dash transform
  //    at end of text · em-dash followed by trailing whitespace becomes
  //    `, ` per the no-peek branch · meaningless at end of text).
  return closed.replace(/^[ \t]+/, '').replace(/,?\s*$/, '');
}

/**
 * Em-dash + en-dash + asterisk-roleplay transforms applied to a code-
 * block-free segment. Pure function, idempotent.
 */
function applyVoiceTransforms(text: string): string {
  let out = text;

  // EM-DASH + EN-DASH: replace context-aware based on next char.
  //   "word — word" (lowercase next)  → "word, word"
  //   "word — Word" (uppercase next)  → "word. Word"
  //   "word—word"   (no-space, identifier-like) → drop dash, single space
  //   edge cases (start/end, no peek) → collapse to single space if
  //     surrounded by whitespace, else drop
  // The regex captures leading whitespace, the dash, trailing whitespace,
  // then peeks at the first letter (if any). Non-letter peek (e.g. digit,
  // punctuation) takes the lowercase branch (comma).
  out = out.replace(
    /([\t ]*)[—–]([\t ]*)([A-Za-z]?)/g,
    (_match, lead: string, trail: string, peek: string) => {
      if (!peek) {
        // No letter to peek (end of segment or followed by punct/code).
        // When dash is surrounded by whitespace, fall back to comma —
        // the most common case is "word — `code`" which voices as
        // "word, `code`". Asymmetric whitespace → drop entirely.
        return lead && trail ? ', ' : '';
      }
      if (peek === peek.toUpperCase() && peek !== peek.toLowerCase()) {
        return `. ${peek}`;
      }
      return `, ${peek}`;
    },
  );

  // ASTERISK ROLEPLAY: `*<lowercase-start, no-period, no-asterisk, ≤30 chars>*`
  //
  // Discriminator preserves satoshi's performed-silence pattern (full
  // sentences with periods, e.g. `*satoshi observes the room. nothing
  // of note.*`). The 30-char cap + period exclusion catches stage-direction
  // (`*adjusts cabling*` = 16 chars, no period) without touching atmospheric
  // italicization (which uses periods or longer content).
  //
  // Negative lookbehind/lookahead `(?<!\*)`/`(?!\*)` ensures bold (`**X**`)
  // is never touched: bold's outer asterisks would match the regex shape
  // but are guarded by adjacent-asterisk checks.
  //
  // Matched roleplay collapses to empty string. The post-pass space-
  // collapse handles any orphan spaces.
  out = out.replace(/(?<!\*)\*([a-z][^*\n.]{0,29})\*(?!\*)/g, '');

  // Collapse multiple spaces created by removals
  out = out.replace(/ {2,}/g, ' ');

  // NOTE: do NOT trim per-line trailing whitespace here — this function
  // operates on segments split on backticks, and trailing whitespace at
  // segment boundaries is the intentional space between prose and adjacent
  // inline-code spans (e.g. `bear-cave \`0x...\``). Per-line trim would
  // collapse `bear-cave \`...\`` into `bear-cave\`...\`` after rejoin.
  // Trailing-whitespace cleanup happens at whole-text level via
  // stripTrailingClosings's trimEnd() and the leading-whitespace pass in
  // the public function.

  return out;
}

/**
 * Strip default-on closing signoffs at the end of text. Iterative: keeps
 * stripping while changes occur (defensive against multiple closings
 * appended in same response). Pre-emoji-aware: longer patterns (with 🐻)
 * tried first so the bare variant doesn't partial-match and orphan the
 * emoji.
 */
function stripTrailingClosings(text: string): string {
  let out = text.trimEnd();
  let changed = true;
  while (changed) {
    changed = false;
    for (const closing of CLOSING_SIGNOFFS) {
      // Escape regex metachars in the closing string (defense-in-depth;
      // the catalog above contains literals only, but adding new entries
      // shouldn't require regex-escape vigilance).
      const escaped = closing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match: optional leading whitespace OR start-of-text · closing ·
      // optional trailing terminal punct (.!?) · optional trailing
      // whitespace · end. Case-insensitive (matches "Stay groovy" too).
      const re = new RegExp(
        `(?:^|[\\s\\n])${escaped}[.!?]*\\s*$`,
        'i',
      );
      if (re.test(out)) {
        out = out.replace(re, '').trimEnd();
        changed = true;
      }
    }
  }
  return out;
}
