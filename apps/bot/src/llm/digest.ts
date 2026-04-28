/**
 * Digest composer — orchestrates the full pipeline:
 *   1. Fetch ActivitySummary from score-api (or stub)
 *   2. Load Ruggy's system prompt from persona doc
 *   3. Substitute summary JSON into prompt
 *   4. Invoke freeside agent-gateway (or stub)
 *   5. Build Discord payload (embed + graceful fallback content)
 *
 * The composer is the only orchestration layer that knows about all
 * three subsystems (score / persona / llm / format). Everything else
 * is single-responsibility.
 */

import type { Config } from '../config.ts';
import { fetchSummary } from '../score/client.ts';
import type { ActivitySummary, ActivitySummaryRequest } from '../score/types.ts';
import { invoke } from './agent-gateway.ts';
import { buildPromptPair } from '../persona/loader.ts';
import { buildDigestPayload, type DigestPayload } from '../format/embed.ts';

export interface ComposeOptions {
  /** Override the default window — useful for backfill or test runs */
  windowStart?: string;
  windowEnd?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  topActors?: number;
  topFactors?: number;
}

export async function composeDigest(
  config: Config,
  opts: ComposeOptions = {},
): Promise<{ summary: ActivitySummary; voice: string; payload: DigestPayload }> {
  // 1. Window boundaries — default to the past 7 days, ending now
  const granularity = opts.granularity ?? 'week';
  const windowEnd = opts.windowEnd ?? new Date().toISOString();
  const windowStart =
    opts.windowStart ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const req: ActivitySummaryRequest = {
    worldId: config.WORLD_ID,
    appId: config.APP_ID,
    windowStart,
    windowEnd,
    granularity,
    groupBy: 'factor',
    topActors: opts.topActors ?? 5,
    topFactors: opts.topFactors ?? 3,
  };

  // 2. Fetch summary
  const summary = await fetchSummary(config, req);

  // 3. Build prompt pair
  const summaryJson = JSON.stringify(summary, null, 2);
  const { systemPrompt, userMessage } = buildPromptPair(summaryJson);

  // 4. Invoke LLM
  const { text: voice } = await invoke(config, {
    systemPrompt,
    userMessage,
    modelAlias: config.FREESIDE_AGENT_MODEL,
  });

  // 5. Build Discord payload
  const payload = buildDigestPayload(summary, voice);

  return { summary, voice, payload };
}
