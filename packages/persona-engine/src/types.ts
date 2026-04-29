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
}

export type { ZoneId, PostType };
