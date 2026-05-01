/**
 * Imagegen — in-bot SDK MCP server (V0.7-A.1 substrate prep · scaffold).
 *
 * Pattern mirror of rosenzu/server.ts and emojis/server.ts: in-process
 * `createSdkMcpServer` registered conditionally by the orchestrator when
 * Bedrock Stability env is configured.
 *
 * Two tools:
 *   - generate        — Bedrock Stability text-to-image (placeholder body
 *                       until Eileen lands the real InvokeModelCommand)
 *   - suggest_style   — codex-archetype → style hint (static table for
 *                       scaffold; future iteration can hit codex MCP for
 *                       grounded archetype lookup)
 *
 * Per-character scoping (V0.7-A.3 wiring lands separately): satoshi gets
 * `imagegen` access; ruggy does NOT (he stays data-grounded; won't
 * hallucinate-and-illustrate). Until A.3 ships, the orchestrator
 * registers this server bot-wide when env is set — chat-mode replies
 * already bypass MCPs entirely so ruggy's voice register is uncontested.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { invokeStability } from './bedrock-client.ts';
import {
  ImageAspectRatioSchema,
  ImageStyleSchema,
  type ImageStyle,
  type SuggestStyleOutput,
} from './types.ts';
import type { Config } from '../../config.ts';

function ok(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Static archetype → style hint table. Covers the 9 cabal archetypes
 * (gygax) plus a generic mibera/ruggy split. The LLM treats this as a
 * suggestion, not a constraint — it can override per-prompt if the scene
 * needs a different register. The rationale field gives the model a
 * one-line cue to ground the choice.
 */
const ARCHETYPE_STYLE: Record<string, { style: ImageStyle; rationale: string }> = {
  Storyteller: { style: 'illustration', rationale: 'narrator voice — lean into illustrated scene-set rather than photorealism' },
  GM: { style: 'cinematic', rationale: 'session-presence — wide-frame composition reads as table-top stage' },
  Veteran: { style: 'photorealistic', rationale: 'long-view register — grounded materiality over stylization' },
  'Chaos-Agent': { style: 'abstract', rationale: 'unstable register — abstraction lets the unease land without literal anchors' },
  Optimizer: { style: 'illustration', rationale: 'systems-thinking voice — clean diagrammatic illustration' },
  Newcomer: { style: 'photorealistic', rationale: 'fresh-eyes register — concrete textures, no stylization veil' },
  'Rules-Lawyer': { style: 'illustration', rationale: 'ledger voice — tidy compositional clarity' },
  'Anxious-Player': { style: 'cinematic', rationale: 'emotional weight — cinematic light + shallow focus' },
  Explorer: { style: 'cinematic', rationale: 'discovery voice — wide vista + atmospheric depth' },
  // Lowercase fallbacks for tool-call ergonomics (LLMs sometimes lowercase)
  storyteller: { style: 'illustration', rationale: 'narrator voice — illustrated scene-set' },
  veteran: { style: 'photorealistic', rationale: 'long-view register — grounded materiality' },
  'chaos-agent': { style: 'abstract', rationale: 'unstable register — abstraction over literal anchors' },
};

const MOOD_OVERRIDES: Record<string, ImageStyle> = {
  hermetic: 'abstract',
  cypherpunk: 'cinematic',
  warm: 'illustration',
  ghibli: 'illustration',
  glitch: 'pixel-art',
  retro: 'pixel-art',
};

function suggestStyle(archetype: string, mood?: string): SuggestStyleOutput {
  const moodKey = mood?.toLowerCase().trim();
  if (moodKey && MOOD_OVERRIDES[moodKey]) {
    return {
      archetype,
      mood: moodKey,
      style: MOOD_OVERRIDES[moodKey]!,
      rationale: `mood "${moodKey}" steers toward ${MOOD_OVERRIDES[moodKey]!} regardless of archetype`,
    };
  }
  const hit = ARCHETYPE_STYLE[archetype] ?? ARCHETYPE_STYLE[archetype.trim()];
  if (hit) {
    return { archetype, mood: moodKey ?? null, style: hit.style, rationale: hit.rationale };
  }
  return {
    archetype,
    mood: moodKey ?? null,
    style: 'illustration',
    rationale: `unknown archetype "${archetype}" — defaulting to illustration as the safest neutral`,
  };
}

/**
 * Build the imagegen MCP server bound to a specific runtime config.
 *
 * The orchestrator passes `config` so the bedrock client reads model id
 * + region + auth from the already-validated zod parse rather than
 * process.env. Mirrors the freeside_auth pattern of capturing pool state
 * at module load — but here state is just the config reference, so we
 * factor it as a builder function called from buildMcpServers.
 */
export function createImagegenServer(config: Config) {
  return createSdkMcpServer({
    name: 'imagegen',
    version: '0.1.0',
    tools: [
      tool(
        'generate',
        'Generate an image from a text prompt via Bedrock Stability. Returns { url, model, seed, placeholder } — when `placeholder: true`, the substrate is in scaffold mode (Eileen\'s SDK body not yet landed) and the URL is synthetic. Call this when a character explicitly chooses to illustrate (e.g. /satoshi-image, or autoprompt-driven imagegen). Cost-aware: invoke once per reply, not per attempt — the seed is the variance lever, not repeated calls.',
        {
          prompt: z.string().min(1).describe('Text-to-image prompt. Be explicit about subject, scene, lighting; the model is literal.'),
          style: ImageStyleSchema.optional().describe('Visual style hint. Call mcp__imagegen__suggest_style first if unsure.'),
          aspect_ratio: ImageAspectRatioSchema.optional().describe('Output aspect ratio. 1:1 default; 16:9 for landscape; 9:16 for vertical/Discord-mobile.'),
          seed: z.number().int().nonnegative().optional().describe('Optional seed for reproducibility. Omit for fresh variance per call.'),
        },
        async ({ prompt, style, aspect_ratio, seed }) => {
          const result = await invokeStability(config, { prompt, style, aspect_ratio, seed });
          return ok(result);
        },
      ),

      tool(
        'suggest_style',
        'Returns a style hint derived from a character archetype (and optional mood). Use this BEFORE calling generate when you don\'t already have a strong style intent. Rationale field tells you WHY the style was picked — overrideable per-prompt if the scene calls for something else. Backed by a static archetype table; future iteration may hit codex MCP for grounded lookup.',
        {
          archetype: z.string().min(1).describe('Character archetype (e.g. "Storyteller", "Veteran", "Chaos-Agent") — typically the character\'s anchored archetype.'),
          mood: z.string().optional().describe('Optional mood override (e.g. "hermetic", "cypherpunk", "warm"). When set and recognized, takes precedence over archetype.'),
        },
        async ({ archetype, mood }) => {
          return ok(suggestStyle(archetype, mood));
        },
      ),
    ],
  });
}

export const IMAGEGEN_TOOL_PREFIX = 'mcp__imagegen__';
export const IMAGEGEN_ALLOWED_TOOLS = [`${IMAGEGEN_TOOL_PREFIX}*`];
