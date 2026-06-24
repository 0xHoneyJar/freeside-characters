/**
 * Tool → mood mapping for chat-mode expression patches (V0.12).
 *
 * Per the multi-axis-daemon-architecture §axis-3 (capability-equipping):
 * a tool fire IS a body-part performing in real time. The substrate's job
 * is to make that performance visible AS character expression — not as a
 * generic 🔧 marker. This file is the routing table.
 *
 * Per civic-layer (agent-native-civic-architecture): substrate provides
 * the channel + the patch primitive · character chooses what to put there.
 * This map ROUTES from tool-name to mood; the actual emoji selection
 * happens against the character's catalog at the dispatch site.
 *
 * The seed (§3) named metaphor moods (`digging`, `pattern-watching`,
 * `lore-checking`, `reading-the-room`, `who-is-this`). The current
 * registry doesn't carry those tags — registry moods are emotional
 * registers (`eyes`, `flex`, `noted`, `cool`, `dapper`, etc.). This map
 * resolves the seed's tool-categories to the closest existing register
 * moods that read in voice for each category. Vocabulary deviation is
 * surfaced in NOTES.md per feedback_spec_deviation_pattern; a
 * capability-request to extend the registry is a follow-up if the
 * register-mood mapping ever feels off in production.
 *
 * Reference: kickoff-2026-05-01 §3 + §9.3 (mood-vocabulary coordination).
 */

import { Schema } from "effect";
import type { EmojiMood } from "../orchestrator/emojis/registry.ts";
import { EMOJI_MOOD_LITERALS } from "../orchestrator/emojis/schema.ts";

// ─── Schema ──────────────────────────────────────────────────────────

/**
 * A single mapping entry: a tool-name prefix paired with the register
 * moods the substrate should pick from when that tool fires.
 *
 * `prefix` matches the SDK's tool naming convention (`mcp__<server>__`).
 * Prefix-match — covers existing AND future tools registered under the
 * same server without re-touching this file.
 *
 * Empty `moods` → skip patching (the tool fires silently · used for
 * self-referential tools like `mcp__emojis__*` where rendering a loading
 * emoji to ANNOUNCE that we're picking an emoji would be category noise).
 */
const ToolMoodMappingSchema = Schema.Struct({
  prefix: Schema.String.annotations({
    description: "tool-name prefix (e.g. 'mcp__score__') — matched as String.startsWith()",
  }),
  // Per F4 (PR #19 bridgebuilder review): the mood vocabulary is owned
  // by `orchestrator/emojis/schema.ts`. Importing the const tuple makes
  // this module's schema a structural consumer of that source — adding/
  // removing a registry mood updates this validator in lockstep.
  moods: Schema.Array(Schema.Literal(...EMOJI_MOOD_LITERALS)).annotations({
    description: "register moods to pick from · empty array = skip patch",
  }),
  rationale: Schema.String.annotations({
    description: "voice rationale for this mood pool (Alexander craft trail)",
  }),
});

export type ToolMoodMapping = Schema.Schema.Type<typeof ToolMoodMappingSchema>;

// ─── Default map ─────────────────────────────────────────────────────

/**
 * Per-tool-category mood pools. Authored per kickoff §3 mapping table
 * with §0.5 audit-confirmed register vocabulary.
 *
 * Variance preservation per ALEXANDER craft principle: each pool has 2-3
 * moods so picks rotate naturally. The recent-used cache (emojis MCP
 * `mark_used` / `recentNames`) deduplicates within scope on top of that.
 */
const DEFAULT_MAP_RAW: readonly ToolMoodMapping[] = [
  {
    prefix: "mcp__score__",
    moods: ["eyes", "flex", "noted"],
    rationale: "data pull · peeking at the ledger · ruggy reading score data with intent",
  },
  {
    prefix: "mcp__codex__",
    moods: ["noted", "eyes"],
    rationale: "lore lookup · checking the books · recording the reference",
  },
  {
    prefix: "mcp__rosenzu__",
    moods: ["eyes", "cool", "dapper"],
    rationale: "reading the room · the verb is observation · cool/dapper for the register",
  },
  {
    prefix: "mcp__freeside_auth__",
    moods: ["eyes", "wave", "peace"],
    rationale: "who-is-this · greeting at the door · cautious peek at identity",
  },
  // Self-referential — the emoji-picking tool itself MUST NOT emit a
  // loading emoji. Empty moods array = skip patch.
  {
    prefix: "mcp__emojis__",
    moods: [],
    rationale: "self-referential · picking an emoji to announce emoji-picking is category noise",
  },
  // V1 deferred — imagegen progress is out of scope per kickoff §6
  // (couples with the imagegen pipeline rewire under parent §7). Empty
  // moods array = skip patch until V1.5 brings imagegen-progress in.
  {
    prefix: "mcp__imagegen__",
    moods: [],
    rationale: "V1 deferred · couples with imagegen pipeline rewire (parent §7)",
  },
];

/**
 * Decoded + validated default map. Decoding at module load surfaces any
 * future schema/data drift loud, before the dispatch path touches it.
 *
 * Per F3 (PR #19 bridgebuilder review): wrapping the decode with a
 * contextual prefix gives operators a legible bot-startup error when a
 * future contributor breaks the static config. Effect's default
 * decode-error message names the field shape; the prefix names the
 * module so the operator knows where to look.
 */
export const DEFAULT_TOOL_MOOD_MAP: readonly ToolMoodMapping[] = DEFAULT_MAP_RAW.map(
  (entry, idx) => {
    try {
      return Schema.decodeUnknownSync(ToolMoodMappingSchema)(entry);
    } catch (err) {
      throw new Error(
        `tool-mood-map: invalid DEFAULT_MAP_RAW entry at index ${idx} (prefix="${entry.prefix}") — ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  },
);

// ─── Hot-path lookup ─────────────────────────────────────────────────

/**
 * Resolve a tool-name to a mood pool. Returns:
 *   - non-empty array → caller should pick one mood (random or first)
 *     and look up an emoji from the character's catalog
 *   - empty array     → caller should SKIP patching (intentional silence;
 *     e.g. emojis MCP self-reference)
 *   - null            → tool isn't covered by the map; caller falls back
 *     to substrate default (today: skip · keeps the channel quiet for
 *     unknown tools rather than emitting a generic marker)
 *
 * The fallback semantics (null = skip) mean adding a new MCP without
 * a corresponding mood-map entry leaves the channel quiet during loading
 * for that MCP. That's intentional — substrate-shaped quiet is preferable
 * to substrate-shaped noise. Operators add a mapping when the new MCP
 * has a register that fits.
 */
export function getMoodsForTool(
  toolName: string,
  map: readonly ToolMoodMapping[] = DEFAULT_TOOL_MOOD_MAP,
): readonly EmojiMood[] | null {
  for (const entry of map) {
    if (toolName.startsWith(entry.prefix)) {
      return entry.moods;
    }
  }
  return null;
}

/**
 * Pick a single mood at random from a pool. Variance preservation is the
 * point — the LLM doesn't deliberate on a "best fit"; the substrate
 * rotates naturally. Returns null when the pool is empty (caller should
 * skip patching).
 */
export function pickRandomMood(
  pool: readonly EmojiMood[],
): EmojiMood | null {
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx]!;
}
