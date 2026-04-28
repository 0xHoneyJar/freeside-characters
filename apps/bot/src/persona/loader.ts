/**
 * Persona loader — extracts Ruggy's system prompt from the canonical
 * persona doc, substitutes runtime placeholders, returns prompt pair.
 *
 * Placeholders the persona doc uses:
 *   {{CODEX_PRELUDE}}       — Mibera Codex llms.txt
 *   {{ZONE_ID}}             — current zone (stonehenge / bear-cave / …)
 *   {{POST_TYPE}}           — current post type (digest / micro / weaver / …)
 *   {{ZONE_DIGEST_JSON}}    — score-mcp ZoneDigest payload
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ZoneId } from '../score/types.ts';
import { loadCodexPrelude } from '../score/codex-context.ts';
import type { PostType } from '../llm/post-types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = resolve(__dirname, 'ruggy.md');

const SECTION_HEADER = '## System prompt template';

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;

  const raw = readFileSync(PERSONA_PATH, 'utf8');
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

export function loadSystemPrompt(): string {
  return loadTemplate();
}

export interface BuildPromptArgs {
  zoneId: ZoneId;
  postType: PostType;
  zoneDigestJson: string;
  /** Optional supplementary context (used by weaver to include other zones' digests) */
  supplement?: string;
}

export function buildPromptPair(args: BuildPromptArgs): {
  systemPrompt: string;
  userMessage: string;
} {
  const template = loadTemplate();
  const codex = loadCodexPrelude();

  const inputPayloadMarker = '═══ INPUT PAYLOAD ═══';
  const idx = template.indexOf(inputPayloadMarker);
  if (idx === -1) {
    throw new Error(`persona loader: could not find INPUT PAYLOAD marker in template`);
  }

  const systemHalf = template
    .slice(0, idx)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .replace(/\{\{CODEX_PRELUDE\}\}/g, codex)
    .trimEnd();

  const userHalfBase = template
    .slice(idx)
    .replace(/\{\{ZONE_ID\}\}/g, args.zoneId)
    .replace(/\{\{POST_TYPE\}\}/g, args.postType)
    .replace(/\{\{ZONE_DIGEST_JSON\}\}/g, args.zoneDigestJson)
    .trim();

  const userHalf = args.supplement
    ? `${userHalfBase}\n\n═══ SUPPLEMENTARY CONTEXT ═══\n${args.supplement}`
    : userHalfBase;

  return {
    systemPrompt: systemHalf,
    userMessage: userHalf,
  };
}
