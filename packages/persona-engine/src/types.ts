/**
 * persona-engine substrate types — the contracts characters consume.
 *
 * Civic-layer note (Eileen 2026-04-20, agent-native-civic-architecture.md):
 * The substrate is the SYSTEM-AGENT layer — cron, delivery, MCP
 * orchestration, score-mcp client. Characters (participation agents) are
 * SPEAKERS that consume the substrate; they MUST NOT bypass it. This
 * types module is the only legitimate boundary between the two layers:
 * characters supply CharacterConfig, the substrate dispatches.
 */

import type { ZoneId } from './score/types.ts';
import type { PostType } from './compose/post-types.ts';

export type EmojiAffinityKind = 'mibera' | 'ruggy';

/**
 * CharacterConfig — what a character supplies to the substrate.
 *
 * Required:
 *   - id           : stable handle ('ruggy', 'satoshi', ...)
 *   - personaPath  : absolute path to persona.md (with system-prompt
 *                    template + post-type fragments)
 *
 * Optional:
 *   - exemplarsDir : absolute path to exemplars/<post_type>/*.md tree
 *                    for In-Context Exemplar (ICE) injection
 *   - emojiAffinity: hint for emoji MCP (V0.6-A: informational only;
 *                    V0.6-B+ wired into MCP server filtering)
 *   - displayName  : human-readable label for log lines (defaults to id)
 *
 * V0.6-D (Pattern B / webhook-shell):
 *   - webhookAvatarUrl : HTTPS URL to character avatar — used as
 *                        per-message `avatar_url` override in webhook
 *                        sends. When unset, delivery falls back to
 *                        bot.send (shell account's own avatar). The
 *                        target URL hierarchy is `assets.0xhoneyjar.xyz/
 *                        freeside-characters/<id>/avatar.png`; until
 *                        that CDN cycle reaches freeside-characters,
 *                        any stable HTTPS URL works.
 *   - webhookUsername  : per-message `username` override in webhook
 *                        sends. Defaults to displayName ?? id.
 */
export interface CharacterConfig {
  id: string;
  personaPath: string;
  exemplarsDir?: string;
  emojiAffinity?: {
    primary?: EmojiAffinityKind;
    fallback?: EmojiAffinityKind;
  };
  displayName?: string;
  webhookAvatarUrl?: string;
  webhookUsername?: string;
  /**
   * V0.6-D voice/v4: anchored archetypes per character — the 1-2 cabal
   * archetypes that genuinely map to who the character IS (NOT rotating
   * filters · gumi correction §0.5 #1 · 2026-04-29 walkthrough).
   *
   * Examples:
   *   ruggy   = ['Storyteller', 'GM']        // festival NPC narrator
   *   satoshi = ['Veteran', 'Chaos-Agent']   // long view + uncertainty
   *
   * Promoted from persona.md frontmatter to first-class CharacterConfig
   * field per WEAVER review 2026-04-30 (leverage point: enables /cabal
   * post-design reception tester to know which archetypes to AUDIT
   * against · enables future V0.6-D phase 2 router for character
   * selection per @mention pattern).
   *
   * The other 7 archetypes per character are CULLED — Newcomer-confusion
   * with satoshi's voice is correct reception, not a bug.
   */
  anchoredArchetypes?: CabalArchetype[];

  /**
   * V0.7-A.1: per-character slash command set. Eileen's framing
   * (2026-04-30): "commands are diff otherwise they'd be reporting the
   * same shit." When omitted, the substrate auto-generates the default
   * `/<id> prompt:<text> ephemeral:<bool>` command (V0.7-A.0 parity)
   * routed to the `chat` handler.
   *
   * Examples:
   *   ruggy   = undefined           → default /ruggy chat
   *   satoshi = [/satoshi (chat),
   *              /satoshi-image (imagegen)]
   *
   * The substrate flattens commands across all loaded characters at
   * publish time (see apps/bot/scripts/publish-commands.ts) and routes
   * by command name + handler at dispatch time
   * (apps/bot/src/discord-interactions/dispatch.ts).
   */
  slash_commands?: SlashCommandSpec[];
}

/**
 * V0.7-A.1: a single slash command declared by a character. Maps 1:1 to
 * Discord's Application Command shape so character.json can declare
 * commands without runtime translation. The `handler` field is the
 * substrate-side hook — `chat` runs through composeReply (V0.7-A.0
 * pipeline), `imagegen` runs through the imagegen MCP scaffold.
 *
 * Future handlers (`stats`, `lore`, `score`, etc.) extend the union; the
 * dispatch switch is the single point of registration.
 */
export interface SlashCommandSpec {
  /** Discord command name (lowercase, hyphenated). Must match Discord's
   *  /^[-_\p{L}\p{N}]{1,32}$/ regex. */
  name: string;
  /** 1-100 char description shown in Discord's autocomplete UI. */
  description: string;
  /** Substrate-side handler that runs when this command fires. */
  handler: SlashCommandHandler;
  /** Discord application command options (0-25). type values: 3=STRING,
   *  4=INTEGER, 5=BOOLEAN, 10=NUMBER (canonical Discord enum). */
  options?: SlashCommandOption[];
}

export type SlashCommandHandler = 'chat' | 'imagegen';

export interface SlashCommandOption {
  name: string;
  description: string;
  /** Discord application command option type. Common: 3=STRING, 5=BOOLEAN. */
  type: number;
  required?: boolean;
}

/**
 * The 9 cabal-gygax phantom-player archetypes — AUDIENCE postures, NOT
 * character voice modes (gumi correction §0.5 #1 · 2026-04-29). Used:
 * (a) per-character anchored identity declaration · (b) post-design
 * /cabal reception-test targeting (when that command lands).
 *
 * Source: packages/persona-engine/src/orchestrator/cabal/gygax.ts
 */
export type CabalArchetype =
  | 'Optimizer'
  | 'Newcomer'
  | 'Storyteller'
  | 'Rules-Lawyer'
  | 'Chaos-Agent'
  | 'GM'
  | 'Anxious-Player'
  | 'Veteran'
  | 'Explorer';

export type { ZoneId, PostType };
