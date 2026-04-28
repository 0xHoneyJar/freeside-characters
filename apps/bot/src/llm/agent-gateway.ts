/**
 * Freeside agent-gateway HTTP client.
 *
 * Calls `POST /api/agents/invoke` (non-streaming) to get a digest in
 * Ruggy's voice, given the system prompt + summary payload.
 *
 * STUB_MODE returns a canned digest matching the persona-doc sample
 * outputs, so the bot can run end-to-end without freeside auth.
 *
 * Refs:
 *   - bonfire/grimoires/bonfire/research/freeside-request-surface.md §2
 *   - loa-freeside themes/sietch/src/discord/commands/agent.ts:120-153
 */

import type { Config } from '../config.ts';
import type { ActivitySummary } from '../score/types.ts';

export interface InvokeRequest {
  systemPrompt: string;
  userMessage: string;
  modelAlias?: 'cheap' | 'fast-code' | 'reviewer' | 'reasoning' | 'architect';
}

export interface InvokeResponse {
  text: string;
  /** When stub-mode, this is null. When real, contains the agent-gateway response metadata. */
  meta?: Record<string, unknown>;
}

/**
 * Routing (anthropic key takes priority — V0 testing pattern):
 *
 *   ANTHROPIC_API_KEY set   → anthropic-direct (V0 testing; works even with
 *                              STUB_MODE=true so score stays stubbed)
 *   STUB_MODE=true          → canned digest (default)
 *   FREESIDE_API_KEY set    → freeside agent-gateway (production)
 *
 * Common combinations:
 *   STUB_MODE=true,  ANTHROPIC_API_KEY set  → real voice · stub data (V0 voice test)
 *   STUB_MODE=false, ANTHROPIC_API_KEY set  → real voice · real score-api data
 *   STUB_MODE=false, FREESIDE_API_KEY set   → real voice via freeside (production)
 *   STUB_MODE=true,  no keys                → all stub
 */
export async function invoke(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  if (config.ANTHROPIC_API_KEY) {
    return invokeAnthropicDirect(config, req);
  }
  if (config.STUB_MODE) {
    return generateStubDigest(req);
  }
  if (config.FREESIDE_API_KEY) {
    return invokeFreeside(config, req);
  }
  throw new Error(
    'no LLM provider configured: set STUB_MODE=true, or ANTHROPIC_API_KEY, or FREESIDE_API_KEY',
  );
}

/**
 * Production path — freeside agent-gateway. Routes through model-tier
 * (cheap/fast-code/reviewer/reasoning/architect), budget accounting, etc.
 */
async function invokeFreeside(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  const url = `${config.FREESIDE_BASE_URL}/api/agents/invoke`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.FREESIDE_API_KEY && { 'x-api-key': config.FREESIDE_API_KEY }),
    },
    body: JSON.stringify({
      agent: 'default',
      modelAlias: req.modelAlias ?? config.FREESIDE_AGENT_MODEL,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`freeside agent-gateway error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { text: string; usage?: Record<string, unknown> };
  return { text: data.text, meta: data.usage };
}

/**
 * Testing path — direct Anthropic Messages API. Bypasses freeside (no
 * budget accounting, no model-tier routing, no audit trail).
 *
 * Use this to validate Ruggy's voice + system prompt while waiting for
 * jani to provision a freeside-agent-gw key. Switch to invokeFreeside()
 * for production by clearing ANTHROPIC_API_KEY in env.
 */
async function invokeAnthropicDirect(
  config: Config,
  req: InvokeRequest,
): Promise<InvokeResponse> {
  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': config.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userMessage }],
    }),
  });

  if (!response.ok) {
    throw new Error(`anthropic api error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: Record<string, unknown>;
  };

  const text = data.content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text)
    .join('\n');

  return { text, meta: data.usage };
}

/**
 * Stub digest generator — produces output that looks like Ruggy's voice
 * given a synthetic ActivitySummary parsed out of req.userMessage.
 *
 * Pattern-matches the four cases in apps/bot/src/persona/ruggy.md:
 * normal / quiet / spike / thin-data.
 */
function generateStubDigest(req: InvokeRequest): InvokeResponse {
  const summary = extractSummaryFromUserMessage(req.userMessage);
  if (!summary) {
    return {
      text: '> 📊 mibera midi · this week\n\ni don\'t have signal on that yet — stub digest could not parse the summary.',
    };
  }

  const { totals, topFactors, topActors, rankMovements, windowComparison } = summary;
  const eventCount = totals.eventCount;

  // thin-data case
  if (eventCount < 100) {
    return {
      text: [
        '> 📊 mibera midi · this week',
        '',
        '> partial snapshot.',
        '',
        `⚠️ score-mibera reported partial data this window. ${eventCount} events confirmed, rank movements pending.`,
        '',
        'i\'ll repost when the snapshot completes.',
      ].join('\n'),
    };
  }

  // quiet week
  if (eventCount < 200) {
    const lead = topFactors[0];
    return {
      text: [
        '> 📊 mibera midi · this week',
        '',
        `> ${eventCount} events · ${totals.activeActors} actors · ${totals.factorsTouched} factors moved`,
        '',
        `quiet one. \`${lead?.factorId ?? 'nft:mibera'}\` carried most of it (${lead?.eventCount ?? 29} events, ${lead?.uniqueActors ?? 8} actors). nothing else stood out.`,
        '',
        'rank board didn\'t shuffle. holding pattern.',
      ].join('\n'),
    };
  }

  // spike case
  if (eventCount > 1500) {
    const top = topFactors[0];
    const newEntrants = topActors.slice(0, 3);
    const heaviest = rankMovements[0];
    return {
      text: [
        '> 📊 mibera midi · this week',
        '',
        `> ${eventCount.toLocaleString()} events · ${totals.activeActors} actors · ${totals.factorsTouched} factors moved`,
        '',
        `biggest week since we started counting. \`${top?.factorId ?? 'og:sets'}\` ate the leaderboard — ${top?.eventCount} events, ${top?.uniqueActors} unique actors. \`onchain:lp_provide\` and \`nft:mibera\` both up too.`,
        '',
        `three new top-10 entrants. ${newEntrants.map((a) => `\`${a.address}\``).join(', ')}. all came in via og:sets velocity. worth watching.`,
        '',
        heaviest
          ? `🚨 \`${heaviest.address}\` went unranked → #${heaviest.newRank} in 6 days. heaviest rank-jump i've logged.`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  // normal week (default)
  const f1 = topFactors[0];
  const f2 = topFactors[1];
  const f3 = topFactors[2];
  const movement = rankMovements[0];

  return {
    text: [
      '> 📊 mibera midi · this week',
      '',
      `> ${eventCount} events · ${totals.activeActors} actors · ${totals.factorsTouched} factors moved`,
      '',
      `top movers: \`${f1?.factorId}\` kept pace (${f1?.eventCount} events, ${f1?.uniqueActors} actors), \`${f2?.factorId}\` had a quiet rebound (${f2?.eventCount}, ${f2?.uniqueActors}), \`${f3?.factorId}\` picked up out of nowhere (${f3?.eventCount}, ${f3?.uniqueActors}).`,
      '',
      movement
        ? `🟢 \`${movement.address}\` jumped #${movement.prevRank} → #${movement.newRank}. honey-flow's been there a while; nice to see them claim a top-50 seat.`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function extractSummaryFromUserMessage(userMessage: string): ActivitySummary | null {
  // Match the JSON block embedded in the user message
  const jsonMatch = userMessage.match(/\{[\s\S]+\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as ActivitySummary;
  } catch {
    return null;
  }
}
