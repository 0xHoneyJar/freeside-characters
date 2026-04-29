/**
 * Persona loader — character-aware (V0.6-A).
 *
 * Loads a character's persona.md, extracts the system-prompt template,
 * picks the post-type fragment, and substitutes runtime placeholders.
 *
 * Per-post-type design (V0.4): the persona doc has six fragments marked
 * with `<!-- @FRAGMENT: <name> --> ... <!-- @/FRAGMENT -->`. The loader
 * picks ONLY the matching fragment for the active post type — no
 * leakage from other types into the system prompt.
 *
 * V0.6-A: PERSONA_PATH is no longer hardcoded to ruggy.md. The substrate
 * accepts a CharacterConfig and reads the character's persona file. Cache
 * is keyed per-character so multi-character runtimes don't collide.
 *
 * Persona doc convention (substrate-canonical — every character follows):
 *   - `## System prompt template` section with a fenced-block template
 *   - `═══ INPUT PAYLOAD ═══` marker splits system half / user half
 *   - `<!-- @FRAGMENT: <post-type> -->` blocks for each of the 6 post types
 *   - Placeholders: {{CODEX_PRELUDE}} {{ZONE_ID}} {{POST_TYPE}}
 *     {{POST_TYPE_GUIDANCE}} {{POST_TYPE_OUTPUT_INSTRUCTION}} {{EXEMPLARS}}
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR, DIMENSION_NAME } from '../score/types.ts';
import { loadCodexPrelude } from '../score/codex-context.ts';
import type { PostType } from '../compose/post-types.ts';
import type { CharacterConfig } from '../types.ts';
import { buildExemplarBlock } from './exemplar-loader.ts';

const SECTION_HEADER = '## System prompt template';

const docCache = new Map<string, string>();
const templateCache = new Map<string, string>();
const voiceAnchorsCache = new Map<string, string>();
const codexAnchorsCache = new Map<string, string>();

/**
 * Load a sibling-of-persona markdown file by convention. Used by both
 * voice-anchors and codex-anchors loaders — the same auto-discover pattern.
 * Returns empty string when absent (graceful · most characters won't have all).
 *
 * Cache lifetime: process-lifetime (no TTL · no invalidation). Edits to
 * voice-anchors.md / codex-anchors.md require a bot restart to take effect.
 * V0.6 ships with this constraint; hot-reload is V0.7+ daemon-stage work.
 */
function loadSiblingMarkdown(
  personaPath: string,
  filename: string,
  cache: Map<string, string>,
): string {
  const cached = cache.get(personaPath);
  if (cached !== undefined) return cached;

  const filePath = resolve(dirname(personaPath), filename);
  if (!existsSync(filePath)) {
    cache.set(personaPath, '');
    return '';
  }
  const content = readFileSync(filePath, 'utf8');
  cache.set(personaPath, content);
  return content;
}

/**
 * voice-anchors.md — operator-curated cross-post-type VOICE TEXTURE grounding.
 * Past character utterances that calibrate "is this character?" — distinct from
 * per-post-type ICE exemplars (which calibrate "is this a digest?").
 */
function loadVoiceAnchors(personaPath: string): string {
  return loadSiblingMarkdown(personaPath, 'voice-anchors.md', voiceAnchorsCache);
}

/**
 * codex-anchors.md — per-character mibera-codex SOIL grounding. The codex
 * prelude ({{CODEX_PRELUDE}}) loads a substrate-wide schema index. This file
 * is character-specific lore tilts: which archetypes resonate, which ancestor
 * lineage they live in, which factor → lore mappings their voice should pull.
 *
 * V0.6 character-stage: text-as-anchor (codex IS character memory).
 * V0.7+ daemon-stage: this file becomes voice template DNA the dNFT points at.
 *
 * Mirrors voice-anchors auto-discover. Empty string if absent.
 */
function loadCodexAnchors(personaPath: string): string {
  return loadSiblingMarkdown(personaPath, 'codex-anchors.md', codexAnchorsCache);
}

function loadDoc(personaPath: string): string {
  const cached = docCache.get(personaPath);
  if (cached !== undefined) return cached;
  const doc = readFileSync(personaPath, 'utf8');
  docCache.set(personaPath, doc);
  return doc;
}

function loadTemplate(personaPath: string): string {
  const cached = templateCache.get(personaPath);
  if (cached !== undefined) return cached;

  const raw = loadDoc(personaPath);
  const sectionStart = raw.indexOf(SECTION_HEADER);
  if (sectionStart === -1) {
    throw new Error(`persona loader: could not find "${SECTION_HEADER}" in ${personaPath}`);
  }

  const sectionBody = raw.slice(sectionStart);
  const fenceMatch = sectionBody.match(/^````([^\n]*)\n([\s\S]+?)\n````/m);
  if (!fenceMatch) {
    throw new Error(`persona loader: could not extract fenced code block from system prompt section in ${personaPath}`);
  }

  const template = fenceMatch[2]!.trim();
  templateCache.set(personaPath, template);
  return template;
}

/** Extract a per-post-type fragment from the persona doc. */
function loadFragment(personaPath: string, postType: PostType): string {
  const doc = loadDoc(personaPath);
  const startMarker = `<!-- @FRAGMENT: ${postType} -->`;
  const endMarker = `<!-- @/FRAGMENT -->`;

  const start = doc.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`persona loader: fragment not found for post type "${postType}" in ${personaPath}`);
  }
  const after = doc.slice(start + startMarker.length);
  const endIdx = after.indexOf(endMarker);
  if (endIdx === -1) {
    throw new Error(`persona loader: fragment end marker missing for "${postType}" in ${personaPath}`);
  }

  return after.slice(0, endIdx).trim();
}

/** Brief output-instruction string per post type. */
function outputInstruction(postType: PostType): string {
  switch (postType) {
    case 'digest':
      return 'Write the weekly digest now. Stay groovy.';
    case 'micro':
      return 'Surface the one observation now. Casual, no greeting, no closing — just the thing you noticed.';
    case 'weaver':
      return 'Write the weaver observation now — name the cross-zone connection (or honestly say no pattern jumped out).';
    case 'lore_drop':
      return 'Write the lore-anchored observation now. Light, head-nod-to-regulars register.';
    case 'question':
      return 'Ask the question now. One question, anchored in the data, low-pressure.';
    case 'callout':
      return 'Write the callout now. Lead with 🚨 + the zone. Calm voice over alarm-shaped data.';
  }
}

/**
 * Load a character's system-prompt template (used by apps/bot's banner
 * to log persona-load size). Pass any character to inspect its template.
 */
export function loadSystemPrompt(character: CharacterConfig): string {
  return loadTemplate(character.personaPath);
}

export interface BuildPromptArgs {
  character: CharacterConfig;
  zoneId: ZoneId;
  postType: PostType;
}

export function buildPromptPair(args: BuildPromptArgs): {
  systemPrompt: string;
  userMessage: string;
} {
  const { character } = args;
  const template = loadTemplate(character.personaPath);
  const codex = loadCodexPrelude();
  const fragment = loadFragment(character.personaPath, args.postType);
  const instruction = outputInstruction(args.postType);
  const exemplars = buildExemplarBlock(character, args.postType); // empty when no exemplars on disk
  const voiceAnchors = loadVoiceAnchors(character.personaPath);  // empty when voice-anchors.md absent
  const codexAnchors = loadCodexAnchors(character.personaPath);  // empty when codex-anchors.md absent

  const inputPayloadMarker = '═══ INPUT PAYLOAD ═══';
  const idx = template.indexOf(inputPayloadMarker);
  if (idx === -1) {
    throw new Error(`persona loader: could not find INPUT PAYLOAD marker in template (${character.personaPath})`);
  }

  // Display-cased zone + dimension names for prose substitution.
  // ZONE_ID stays kebab (routing key); ZONE_NAME is the proper-cased
  // display ("Owsley Lab"); DIMENSION_NAME is the proper-cased dimension
  // ("Onchain"). Persona templates use ZONE_NAME / DIMENSION_NAME in
  // prose; ZONE_ID is reserved for tool calls + routing-shaped contexts.
  const zoneName = ZONE_FLAVOR[args.zoneId].name;
  const zoneDimension = ZONE_FLAVOR[args.zoneId].dimension;
  const dimensionName = DIMENSION_NAME[zoneDimension];

  // Movement framing per ANNOUNCE_NEGATIVE_MOVEMENT env flag (V0.6-D
  // operator pick 2026-04-30: default false — internal observation phase
  // wants positive-only movement; toggleable to true once tone calibrated).
  //
  // KEEPER + WEAVER reframe (2026-04-30 post-gumi-feedback): when
  // negative movement IS surfaced, frame it as DIMENSION SHIFT not
  // PERSONAL DROP. Dimensions are raves; movement between them is
  // ecosystem motion. NEVER use punitive emoji (🔴) or verbs (slid /
  // fell / tumbled) — the system has retired those.
  const announceNegative = process.env.ANNOUNCE_NEGATIVE_MOVEMENT === 'true';
  const movementGuidance = announceNegative
    ? `MOVEMENT POLICY: announce both positive AND shift movement, with
KEEPER+WEAVER framing — dimensions are different raves, movement
BETWEEN them is ecosystem motion, NOT personal failure. Frame
positive movement as ARRIVAL / CLIMBING DEEPER (🟢, "arrived at NFT
top 100", "climbed deep into Onchain"). Frame relative drops or
exits as DIMENSION SHIFT (🌊, "drifted from NFT — last #68", "rave
moved?"). NEVER use 🔴 / "slid" / "fell" / "tumbled" — punitive
coding has been retired per KEEPER+WEAVER doctrine 2026-04-30.
The rank-change is data, not a verdict.`
    : `MOVEMENT POLICY: announce POSITIVE movement only this phase —
arrivals (🟢 entered_top_tier), climbs (🟢 deeper into a dimension),
factor advances. DO NOT surface drops, exits, or shifts in prose.
Negative-movement data is in raw_stats.rank_changes.dropped /
exited_top_tier — read it for context, NEVER mention it in output.
Internal-observation phase per operator 2026-04-30; toggleable via
ANNOUNCE_NEGATIVE_MOVEMENT env flag. When toggled on, the shift
framing kicks in (dimensions-as-raves, not punitive). Until then,
silence on relative drops is the conservative + KEEPER-aligned
default.`;

  // Substitution order matters: BLOCK INJECTIONS first (fragment + anchors +
  // codex + exemplars), then per-zone substitutions. This way any {{ZONE_NAME}}
  // / {{DIMENSION}} placeholders embedded in the injected blocks (e.g., the
  // digest fragment's headline shape `yo {{ZONE_NAME}} ({{DIMENSION}}) ...`)
  // also get substituted in the final prompt — no leak of literal placeholder
  // syntax to the LLM.
  const systemHalf = template
    .slice(0, idx)
    .replace(/\{\{POST_TYPE_GUIDANCE\}\}/g, fragment)
    .replace(/\{\{MOVEMENT_GUIDANCE\}\}/g, movementGuidance)
    .replace(/\{\{VOICE_ANCHORS\}\}/g, voiceAnchors)
    .replace(/\{\{CODEX_ANCHORS\}\}/g, codexAnchors)
    .replace(/\{\{CODEX_PRELUDE\}\}/g, codex)
    .replace(/\{\{EXEMPLARS\}\}/g, exemplars)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{ZONE_NAME\}\}/g, zoneName)
    .replace(/\{\{DIMENSION\}\}/g, dimensionName)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .trimEnd();

  // User-half intentionally covers the SAME block-injection placeholders as
  // system-half. Today's templates only use a subset in the user message, but
  // future template moves (e.g. exemplars or codex prelude relocated below
  // ═══ INPUT PAYLOAD ═══) won't leak literals if we cover them defensively.
  const userHalf = template
    .slice(idx)
    .replace(/\{\{POST_TYPE_OUTPUT_INSTRUCTION\}\}/g, instruction)
    .replace(/\{\{MOVEMENT_GUIDANCE\}\}/g, movementGuidance)
    .replace(/\{\{VOICE_ANCHORS\}\}/g, voiceAnchors)
    .replace(/\{\{CODEX_ANCHORS\}\}/g, codexAnchors)
    .replace(/\{\{CODEX_PRELUDE\}\}/g, codex)
    .replace(/\{\{EXEMPLARS\}\}/g, exemplars)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{ZONE_NAME\}\}/g, zoneName)
    .replace(/\{\{DIMENSION\}\}/g, dimensionName)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .trim();

  return {
    systemPrompt: systemHalf,
    userMessage: userHalf,
  };
}
