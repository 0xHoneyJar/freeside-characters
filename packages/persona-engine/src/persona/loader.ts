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

import { readFileSync } from 'node:fs';
import type { ZoneId } from '../score/types.ts';
import { loadCodexPrelude } from '../score/codex-context.ts';
import type { PostType } from '../compose/post-types.ts';
import type { CharacterConfig } from '../types.ts';
import { buildExemplarBlock } from './exemplar-loader.ts';

const SECTION_HEADER = '## System prompt template';

const docCache = new Map<string, string>();
const templateCache = new Map<string, string>();

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

  const inputPayloadMarker = '═══ INPUT PAYLOAD ═══';
  const idx = template.indexOf(inputPayloadMarker);
  if (idx === -1) {
    throw new Error(`persona loader: could not find INPUT PAYLOAD marker in template (${character.personaPath})`);
  }

  const systemHalf = template
    .slice(0, idx)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .replace(/\{\{POST_TYPE_GUIDANCE\}\}/g, fragment)
    .replace(/\{\{CODEX_PRELUDE\}\}/g, codex)
    .replace(/\{\{EXEMPLARS\}\}/g, exemplars)
    .trimEnd();

  const userHalf = template
    .slice(idx)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .replace(/\{\{POST_TYPE_OUTPUT_INSTRUCTION\}\}/g, instruction)
    .trim();

  return {
    systemPrompt: systemHalf,
    userMessage: userHalf,
  };
}
