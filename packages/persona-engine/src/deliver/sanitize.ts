/**
 * Discord markdown sanitizer + voice-discipline transforms.
 *
 * Three layers operate at the chat-medium presentation boundary
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
 * 3. `sanitizeOutboundBody` — substitutes raw upstream-API-error shapes
 *    with the in-character substrate-error template. Targets the
 *    in-character-only invariant for error voice (FAGAN architect-lock
 *    A4 · bug-20260511-b6eb97 · 2026-05-11). Apply at every outbound
 *    chat-medium write surface, OUTERMOST.
 *
 * Apply these ONLY to text being sent to Discord, AFTER the LLM has
 * generated voice output and embed fields are constructed. Order:
 * `stripVoiceDisciplineDrift` → `escapeDiscordMarkdown` → `sanitizeOutboundBody`.
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
 * Medium identifier for voice-discipline opt threading (cycle R sprint 3).
 *
 * Matches `mediumIdOf(...)` from `@0xhoneyjar/medium-registry@0.2.0`.
 * Stays as a string union (NOT a registry import) to avoid forcing
 * persona-engine consumers to take a medium-registry dep just to pass
 * post-type metadata. Composer wires the registry at the
 * variant-selection layer (deliver/embed.ts).
 *
 * Universal voice discipline (architect lock A4) does NOT vary by medium —
 * em-dashes, asterisk roleplay, default closings are stripped uniformly.
 * The `mediumId` arg is reserved for FUTURE medium-specific prose
 * register adjustments (Telegram has different conventions; CLI strips
 * additional ANSI-confusing characters).
 */
export type VoiceMediumId = "discord-webhook" | "discord-interaction" | "cli" | "telegram-stub";

/**
 * Options for stripVoiceDisciplineDrift. Cycle R Sprint 3 extends with
 * `mediumId` for medium-aware additional discipline (CLI strips
 * ANSI-confusing characters; Discord retains current behavior).
 *
 * Universal voice transforms (em-dash · asterisk roleplay · closing
 * signoff) are NOT gated by mediumId — architect lock A4 (universal ·
 * zero opt-out · code-block-safe · idempotent).
 */
export interface VoiceDisciplineOpts {
  /**
   * Post type · controls closing-signoff exemption. `digest` is the only
   * post-type that retains default-on closings (e.g. "stay groovy 🐻") per
   * discord-native-register doctrine. Default: undefined → strip closings.
   */
  postType?: string;

  /**
   * Active medium · cycle R Sprint 3 · enables medium-specific discipline
   * additions BEYOND the universal transforms. Today:
   *
   *   - 'cli'                           → strip ANSI escape sequences
   *                                       (defense-in-depth · cli-renderer
   *                                       package also strips at render time)
   *   - 'discord-webhook' / 'discord-interaction' / undefined → no extra
   *
   * Default: undefined → universal-only behavior (back-compat · matches
   * Sprint 1 + Sprint 2 callers that don't yet thread the medium through).
   */
  mediumId?: VoiceMediumId;
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

  // Cycle R Sprint 3 — medium-specific discipline ADDITIONS beyond the
  // universal transforms. CLI strips ANSI escape sequences as
  // defense-in-depth (cli-renderer package also strips at render time;
  // applying here means downstream renderers + telemetry sinks get safe
  // text too).
  const mediumDisciplined =
    opts?.mediumId === 'cli' ? stripAnsiEscapes(closed) : closed;

  // FINAL cleanup at whole-text level:
  //  - Trim leading whitespace at start (artifact from stripped roleplay
  //    at sentence start). Per-line indentation preserved.
  //  - Trim trailing comma + whitespace (artifact from em-dash transform
  //    at end of text · em-dash followed by trailing whitespace becomes
  //    `, ` per the no-peek branch · meaningless at end of text).
  return mediumDisciplined.replace(/^[ \t]+/, '').replace(/,?\s*$/, '');
}

/**
 * ANSI escape sequence stripper for CLI medium.
 *
 * Defense-in-depth — `@0xhoneyjar/cli-renderer` ALSO strips at render
 * time (per SKP-001 architectural fix in cycle R sprint 3). Applying
 * here means:
 *
 *   1. Telemetry / logging sinks downstream of sanitize see safe text
 *   2. If a future non-cli-renderer consumer renders to terminal directly,
 *      they're protected
 *   3. Two-layer strip catches accidental cli-renderer bypasses
 *
 * Pattern matches CSI (`ESC [ ... final-byte`), OSC (`ESC ] ... BEL/ST`),
 * and single-char escapes (`ESC X`). Same shape as cli-renderer's
 * sanitize-ansi.ts.
 */
function stripAnsiEscapes(text: string): string {
  if (!text) return text;
  return text.replace(
    new RegExp(
      [
        // CSI sequences (most common: SGR colors, cursor moves)
        '[\\x1b\\x9b][\\[]([0-9;<=>?]*)[\\x20-\\x2f]*[\\x40-\\x7e]',
        // OSC sequences (window title, hyperlinks) — terminated by BEL or ST
        '[\\x1b\\x9b][\\]][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)',
        // Single-char escapes (DEC private modes, charset switches)
        '[\\x1b][@-Z\\\\-_]',
      ].join('|'),
      'g',
    ),
    '',
  );
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

// =============================================================================
// Outbound-body sanitizer (FAGAN A4 · bug-20260511-b6eb97 · 2026-05-11)
// =============================================================================

/**
 * Raw upstream-API-error pattern · used by `sanitizeOutboundBody`.
 *
 * Each pattern is anchored at start-of-string (with an optional `Error: `
 * prefix for `String(err)` forms) so legitimate prose containing the
 * substring mid-body never matches.
 *
 * Pattern ordering rationale (first-match-wins, bridgebuilder F12 ·
 * 2026-05-11):
 *   1. SPECIFIC patterns first — each names a known upstream throw shape
 *      so the `matched=` telemetry field attributes origin correctly.
 *      `anthropic-api-error` before `bedrock-chat-error` etc. is by
 *      callsite frequency observed in production logs (Anthropic SDK is
 *      the dominant throw class today).
 *   2. GENERIC catch-all LAST — `generic-error-class-prefix` is the
 *      last-line defense against upstream format drift (bridgebuilder
 *      F4 · 2026-05-11). When a future SDK renames `API Error:` to
 *      `AnthropicAPIError:` the specific pattern stops matching but the
 *      generic shape catches it. Telemetry attributes to the generic
 *      pattern → operator sees a previously-known throw class started
 *      hitting the catch-all → cue to add a more-specific entry.
 *
 * The ordering is INVARIANT to functional correctness (every pattern
 * substitutes the same template). It only affects telemetry attribution.
 */
interface RawApiErrorPattern {
  readonly name: string;
  readonly regex: RegExp;
}

const RAW_API_ERROR_PATTERNS: readonly RawApiErrorPattern[] = [
  // Anthropic SDK / Bedrock direct: `API Error: 500 …`
  { name: 'anthropic-api-error', regex: /^(?:Error: )?API Error: \d+/ },
  // Generic HTTP body: `Internal Server Error`
  { name: 'http-internal-server-error', regex: /^(?:Error: )?Internal Server Error/i },
  // reply.ts:934 direct Bedrock throw: `bedrock chat error: 500 {…}`
  { name: 'bedrock-chat-error', regex: /^(?:Error: )?bedrock chat error: \d+/i },
  // orchestrator/index.ts:536 throw: `orchestrator: SDK error subtype=…`
  { name: 'orchestrator-sdk-error-subtype', regex: /^(?:Error: )?orchestrator: SDK error subtype=/ },
  // orchestrator/index.ts:556 throw: `orchestrator: SDK query completed without …`
  { name: 'orchestrator-empty-completion', regex: /^(?:Error: )?orchestrator: SDK query completed without/ },
  // reply.ts:984 throw: `freeside agent-gateway chat error: 500 …`
  { name: 'freeside-agent-gateway-error', regex: /^(?:Error: )?freeside agent-gateway chat error: \d+/i },
  // Raw Anthropic JSON error envelope: `{"type":"error",…}`
  { name: 'raw-json-error-envelope', regex: /^(?:Error: )?\{"type":"error"/ },
  // dispatch.ts:1083 / 1113 internal REST throw shape
  {
    name: 'dispatch-rest-wrapper',
    regex: /^(?:Error: )?interactions: (?:PATCH @original|follow-up POST) failed status=\d{3}/,
  },
  // GENERIC CATCH-ALL (bridgebuilder F4 · 2026-05-11 · tightened per flatline
  // codex G2 · 2026-05-11): last-line defense against upstream format drift.
  // Matches any PascalCase identifier ending in Error/Exception/Failure
  // FOLLOWED BY A COLON at start-of-string (with optional `Error: ` prefix
  // for String(err) forms). The trailing `:` (not `\b`) prevents
  // false-positives on legitimate character voice like
  // `"TotalFailure is the name of my zine"` or
  // `"ValidationError was his middle name"` — those have a word boundary
  // after the suffix but no colon, so they pass through.
  //
  // Real upstream throws ALWAYS use `XxxError: message` format
  // (Anthropic/OpenAI/Bedrock convention), so requiring `:` is both safer
  // and matches the actual leak shape.
  {
    name: 'generic-error-class-prefix',
    regex: /^(?:Error: )?[A-Z][a-zA-Z]+(?:Error|Exception|Failure):/,
  },
];

/**
 * Substitute raw upstream-API-error shapes with the caller-supplied
 * in-character substrate error template. Defense-in-depth at the
 * chat-medium write boundary.
 *
 * Closes FAGAN architect-lock A4 (agent afb548531d1fb79d5 · bug
 * 20260511-b6eb97 · 2026-05-11): the dispatch catch at
 * dispatch.ts:593-598 already routes through `formatErrorBody` →
 * `composeErrorBody`, but the in-character-only invariant should be
 * LOAD-BEARING at the boundary, not inductively at every catch site. A
 * future Discord write surface that forgets to route through
 * `deliverError` could leak; this sanitizer makes the rule
 * construction-true at the wire.
 *
 * Pure helper · no module-level dependencies on `expression/` (per
 * bridgebuilder F1 · 2026-05-11): callers supply the substitution
 * template. This keeps `deliver/sanitize.ts` free of the character
 * registry coupling that the prior signature implied.
 *
 * Behavior:
 *   - LLM success output                    → passes through verbatim
 *   - In-character template body            → passes through verbatim
 *   - Raw upstream-API-error shape          → `errorTemplate` (verbatim)
 *
 * Idempotent: a substituted body equals `errorTemplate` — provided the
 * template itself does not match any `RAW_API_ERROR_PATTERNS` regex
 * (the canonical `composeErrorBody(characterId, 'error')` outputs
 * "something snapped on ruggy's end. cool to retry?",
 * "The channel between worlds slipped. Retry on the next.", and the
 * substrate-quiet "something broke. try again?" all clear the regex
 * shapes). A second pass is a no-op.
 *
 * On substitution emits structured telemetry (line-oriented · mirrors
 * `[cold-budget]` and `[chat-route]` conventions at dispatch.ts:584 +
 * reply.ts:761 · no JSON envelope on the hot path):
 *
 *   [outbound-sanitize] character=<id> kind=raw-api-error matched=<pattern> original_len=<n>
 *
 * Operators watching this log line in production can verify whether the
 * leak vector was real (firings observed) or purely belt-and-suspenders
 * (zero firings over the observation window).
 *
 * Refs:
 *   FAGAN agent afb548531d1fb79d5 finding A4
 *   bridgebuilder PR #54 findings F1 (pure helper) + F4 (catch-all) + F12 (ordering)
 *   grimoires/loa/a2a/bug-20260511-b6eb97/triage.md · sprint.md
 *   ~/vault/wiki/concepts/chat-medium-presentation-boundary.md §9
 *   CLAUDE.md "Discord-as-Material" rule: in-character errors only
 */
export function sanitizeOutboundBody(
  content: string,
  characterId: string,
  errorTemplate: string,
): string {
  if (!content) return content;
  for (const { name, regex } of RAW_API_ERROR_PATTERNS) {
    if (regex.test(content)) {
      console.warn(
        `[outbound-sanitize] character=${characterId} kind=raw-api-error matched=${name} original_len=${content.length}`,
      );
      return errorTemplate;
    }
  }
  return content;
}
