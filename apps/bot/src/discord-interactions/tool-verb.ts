/**
 * Tool-name → human-verb mapping for chat-mode progressive UX.
 *
 * When the orchestrator surfaces a `tool_use` block via the onToolUse
 * callback, the dispatcher PATCHes the deferred Discord interaction
 * message with a status line. This module returns the
 * "🔧 [verb]…" string for each tool the bot can invoke.
 *
 * Pattern reference: ruggy-v2 `getToolMessage` at
 * `~/Documents/GitHub/ruggy-v2/src/index.ts:340+` and the tool-mode
 * verb tables it loads from. We mirror the shape — affirmative,
 * lowercase, in-character — and centralize the mapping so dispatcher
 * code stays terse.
 *
 * V1: static unicode emojis. V2 candidate: query the THJ guild emoji
 * registry (`emojis` MCP) for animated guild emojis like the moltbot
 * thinking-frame loop.
 */

const TOOL_VERBS: Record<string, string> = {
  // score-mcp — zone digests + factor catalogs
  'mcp__score__get_zone_digest': '📊 pulling zone digest',
  'mcp__score__describe_factor': '📐 translating factor',
  'mcp__score__list_factors': '📐 surveying factors',
  'mcp__score__describe_dimension': '🌐 reading dimension',
  'mcp__score__list_dimensions': '🌐 surveying dimensions',

  // codex-mcp — mibera-codex lookups
  'mcp__codex__lookup_zone': '🗺️ checking codex zone',
  'mcp__codex__lookup_archetype': '🃏 looking up archetype',
  'mcp__codex__lookup_factor': '🔖 cross-referencing factor',
  'mcp__codex__lookup_grail': '🏆 checking grail',
  'mcp__codex__lookup_mibera': '🐝 looking up mibera',
  'mcp__codex__list_zones': '🗺️ surveying zones',
  'mcp__codex__list_archetypes': '🃏 surveying archetypes',
  'mcp__codex__validate_world_element': '✓ validating world element',

  // rosenzu — spatial + temporal/social grounding
  'mcp__rosenzu__get_current_district': '🧭 orienting in zone',
  'mcp__rosenzu__audit_spatial_threshold': '🚪 checking threshold',
  'mcp__rosenzu__fetch_landmarks': '🗿 fetching landmarks',
  'mcp__rosenzu__furnish_kansei': '🌅 reading the kansei',
  'mcp__rosenzu__threshold': '🌉 crossing zones',
  'mcp__rosenzu__read_room': '👀 reading the room',

  // freeside_auth — wallet identity resolution
  'mcp__freeside_auth__resolve_wallet': '🔑 resolving wallet',
  'mcp__freeside_auth__resolve_wallets': '🔑 resolving wallets',

  // emojis — THJ guild emoji catalog
  'mcp__emojis__list_emojis': '🎴 picking emoji',
  'mcp__emojis__lookup_emoji': '🎴 looking up emoji',

  // imagegen — Bedrock Stability text-to-image
  'mcp__imagegen__generate_image': '🎨 generating image',
};

/**
 * Map a tool name to a status string for progressive Discord PATCH updates.
 * Falls back to a generic "🔧 invoking [tool]…" for unmapped names.
 */
export function toolVerb(toolName: string): string {
  const exact = TOOL_VERBS[toolName];
  if (exact) return exact;

  // Strip the `mcp__server__` prefix for unmapped tools so the fallback
  // text stays readable: "mcp__score__future_tool" → "🔧 invoking score::future_tool…"
  const stripped = toolName.replace(/^mcp__/, '').replace(/__/g, '::');
  return `🔧 invoking ${stripped}`;
}
