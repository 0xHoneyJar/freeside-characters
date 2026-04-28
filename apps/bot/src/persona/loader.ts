/**
 * Persona loader — extracts Ruggy's system prompt from the canonical
 * persona doc at `apps/bot/src/persona/ruggy.md`.
 *
 * The persona doc embeds a "## System prompt template — paste-ready for V1"
 * section containing the system prompt inside a fenced code block. This
 * loader finds that section and returns the prompt with the
 * `{{ACTIVITY_SUMMARY_JSON}}` placeholder still in place — the digest
 * composer substitutes it just-in-time.
 *
 * Per CLAUDE.md: never edit persona/ruggy.md without syncing back to
 * bonfire grimoires.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA_PATH = resolve(__dirname, 'ruggy.md');

const SECTION_HEADER = '## System prompt template';
const PLACEHOLDER = '{{ACTIVITY_SUMMARY_JSON}}';

let cached: string | null = null;

export function loadSystemPrompt(): string {
  if (cached) return cached;

  const raw = readFileSync(PERSONA_PATH, 'utf8');

  const sectionStart = raw.indexOf(SECTION_HEADER);
  if (sectionStart === -1) {
    throw new Error(
      `persona loader: could not find "${SECTION_HEADER}" in ruggy.md`,
    );
  }

  // Find the next fenced code block after the section header.
  // The template is wrapped in ` ```` ` (4-backtick fence) since it contains
  // 3-backtick code blocks itself.
  const sectionBody = raw.slice(sectionStart);
  const fenceMatch = sectionBody.match(/^````([^\n]*)\n([\s\S]+?)\n````/m);
  if (!fenceMatch) {
    throw new Error(
      'persona loader: could not extract fenced code block from system prompt section',
    );
  }

  cached = fenceMatch[2]!.trim();
  return cached;
}

/**
 * Compose the user message for the LLM call by substituting the
 * `{{ACTIVITY_SUMMARY_JSON}}` placeholder into the system prompt.
 *
 * Returns the system prompt with the placeholder REMOVED, plus the
 * user message containing the JSON. This lets the LLM treat the data
 * as user input (which it is — fresh per call) rather than baking it
 * into the system role.
 */
export function buildPromptPair(activitySummaryJson: string): {
  systemPrompt: string;
  userMessage: string;
} {
  const fullPrompt = loadSystemPrompt();

  // Split the prompt at the placeholder line. Everything before becomes
  // the system role; everything after (including the "Write the digest now"
  // instruction) is appended to the user message.
  const parts = fullPrompt.split(PLACEHOLDER);
  if (parts.length !== 2) {
    throw new Error(
      `persona loader: expected exactly one "${PLACEHOLDER}" in system prompt`,
    );
  }

  const systemPrompt = parts[0]!.trimEnd();
  const userMessage = `${parts[1]!.trimStart()}\n\nINPUT PAYLOAD:\n${activitySummaryJson}`;

  return { systemPrompt, userMessage };
}
