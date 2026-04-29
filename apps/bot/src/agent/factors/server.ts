/**
 * Factors — in-bot SDK MCP server.
 *
 * Exposes the score-api factor translation table (vendored from midi)
 * as MCP tools so the LLM can render `nft:mibera` → "Mibera NFT" in
 * prose. Keeps a UNIX-style single responsibility: id → human label.
 *
 * V0.5-C scope. When freeside-auth proper ships a translation API,
 * swap the implementation behind these tools; persona-facing surface
 * stays stable.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  FACTORS,
  DIMENSIONS,
  STONEHENGE_OBSERVES,
  translateFactor,
  translateDimension,
} from './score-factors.ts';

function ok(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

export const factorsServer = createSdkMcpServer({
  name: 'factors',
  version: '0.1.0',
  tools: [
    tool(
      'translate',
      'Translate a score-api factor_id (e.g. `nft:mibera`, `og:sets`, `onchain:lp_provide`) into its human-readable name + description + dimension. Use this BEFORE mentioning a factor in prose so readers see "Mibera NFT" not the machine label.',
      { factor_id: z.string() },
      async ({ factor_id }) => {
        const entry = translateFactor(factor_id);
        if (!entry) {
          return ok({
            factor_id,
            found: false,
            fallback: factor_id,
            note: 'Unknown factor — fall back to the raw id in backticks',
          });
        }
        return ok({ found: true, ...entry });
      },
    ),

    tool(
      'translate_many',
      'Translate multiple factor IDs at once. Returns an array. More efficient than calling translate one at a time when composing a digest mentioning several factors.',
      { factor_ids: z.array(z.string()) },
      async ({ factor_ids }) => {
        const results = factor_ids.map((id) => {
          const entry = translateFactor(id);
          return entry ? { found: true, ...entry } : { factor_id: id, found: false };
        });
        return ok(results);
      },
    ),

    tool(
      'list_by_dimension',
      'List all known factors in a dimension (og / nft / onchain). Useful for getting a sense of the landscape before composing a digest. Returns id + name pairs only (no descriptions, kept lean).',
      { dimension: z.enum(['og', 'nft', 'onchain']) },
      async ({ dimension }) => {
        const entries = Object.values(FACTORS)
          .filter((f) => f.dimension === dimension)
          .map(({ id, name }) => ({ id, name }));
        return ok({ dimension, factors: entries });
      },
    ),

    tool(
      'describe_dimension',
      'Describe a score dimension (og / nft / onchain). Returns proper-cased name (use VERBATIM in prose — "NFT" not "nft"), description, archetype alignment, primary zone. Call this BEFORE writing a dimension name in prose. Returns null for stonehenge — it observes all three rather than carrying its own dimension.',
      { dimension: z.string() },
      async ({ dimension }) => {
        const entry = translateDimension(dimension);
        if (!entry) {
          return ok({
            found: false,
            dimension,
            note: 'Unknown dimension — fall back to ALL CAPS rendering of the id',
          });
        }
        return ok({ found: true, ...entry });
      },
    ),

    tool(
      'list_dimensions',
      'List all live dimensions with proper-cased names + archetype + primary zone. Use this when composing a digest or weaver to ground dimension-talk in canonical names. Stonehenge observes all three (cross-zone hub).',
      {},
      async () => {
        return ok({
          dimensions: Object.values(DIMENSIONS),
          stonehenge_observes: STONEHENGE_OBSERVES,
        });
      },
    ),
  ],
});
