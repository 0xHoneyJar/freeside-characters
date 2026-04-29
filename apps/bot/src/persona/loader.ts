/**
 * Persona loader — extracts Ruggy's system prompt from the canonical
 * persona doc, substitutes runtime placeholders, returns prompt pair.
 *
 * Per-post-type design (V0.4): the persona doc has six fragments marked
 * with `<!-- @FRAGMENT: <name> --> ... <!-- @/FRAGMENT -->`. The loader
 * picks ONLY the matching fragment for the active post type — no
 * leakage from other types into the system prompt.
 *
 * Placeholders the persona doc uses:
 *   {{CODEX_PRELUDE}}                  — Mibera Codex llms.txt
 *   {{ZONE_ID}}                        — current zone
 *   {{POST_TYPE_GUIDANCE}}             — fragment for the current post type
 *   {{POST_TYPE_OUTPUT_INSTRUCTION}}   — what shape to output
 *   {{ZONE_DIGEST_JSON}}               — score-mcp ZoneDigest payload
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ZoneId } from '../score/types.ts';
import { loadCodexPrelude } from '../score/codex-context.ts';
import type { PostType } from '../llm/post-types.ts';
import { buildExemplarBlock } from './exemplar-loader.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = resolve(__dirname, 'ruggy.md');

const SECTION_HEADER = '## System prompt template';

let cachedTemplate: string | null = null;
let cachedDoc: string | null = null;

function loadDoc(): string {
  if (cachedDoc) return cachedDoc;
  cachedDoc = readFileSync(PERSONA_PATH, 'utf8');
  return cachedDoc;
}

function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  const raw = loadDoc();
  const sectionStart = raw.indexOf(SECTION_HEADER);
  if (sectionStart === -1) {
    throw new Error(`persona loader: could not find "${SECTION_HEADER}" in ruggy.md`);
  }

  const sectionBody = raw.slice(sectionStart);
  const fenceMatch = sectionBody.match(/^````([^\n]*)\n([\s\S]+?)\n````/m);
  if (!fenceMatch) {
    throw new Error('persona loader: could not extract fenced code block from system prompt section');
  }

  cachedTemplate = fenceMatch[2]!.trim();
  return cachedTemplate;
}

/** Extract a per-post-type fragment from the persona doc. */
function loadFragment(postType: PostType): string {
  const doc = loadDoc();
  const startMarker = `<!-- @FRAGMENT: ${postType} -->`;
  const endMarker = `<!-- @/FRAGMENT -->`;

  const start = doc.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`persona loader: fragment not found for post type "${postType}"`);
  }
  const after = doc.slice(start + startMarker.length);
  const endIdx = after.indexOf(endMarker);
  if (endIdx === -1) {
    throw new Error(`persona loader: fragment end marker missing for "${postType}"`);
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

export function loadSystemPrompt(): string {
  return loadTemplate();
}

export interface BuildPromptArgs {
  zoneId: ZoneId;
  postType: PostType;
}

export function buildPromptPair(args: BuildPromptArgs): {
  systemPrompt: string;
  userMessage: string;
} {
  const template = loadTemplate();
  const codex = loadCodexPrelude();
  const fragment = loadFragment(args.postType);
  const instruction = outputInstruction(args.postType);
  const exemplars = buildExemplarBlock(args.postType); // empty when no exemplars on disk

  const inputPayloadMarker = '═══ INPUT PAYLOAD ═══';
  const idx = template.indexOf(inputPayloadMarker);
  if (idx === -1) {
    throw new Error(`persona loader: could not find INPUT PAYLOAD marker in template`);
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
