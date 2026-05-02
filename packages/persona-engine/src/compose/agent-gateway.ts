/**
 * LLM gateway — explicit provider routing (V0.4 → V0.5-A · auto-rule
 * flipped V0.12 to bedrock-first per operator 2026-05-01).
 *
 * Per codex-rescue F1: stub-vs-real selection should be EXPLICIT, not
 * inferred from key presence. LLM_PROVIDER env makes intent legible:
 *
 *   LLM_PROVIDER=stub        → canned digest (no LLM call). Fails loud
 *                              if anyone expected a real call.
 *   LLM_PROVIDER=anthropic   → Claude Agent SDK (`query()` runtime) via
 *                              `agent/orchestrator.ts`. Requires
 *                              ANTHROPIC_API_KEY; throws if missing.
 *   LLM_PROVIDER=freeside    → freeside agent-gateway. Requires
 *                              FREESIDE_API_KEY; throws if missing.
 *   LLM_PROVIDER=bedrock     → AWS Bedrock direct (this digest path uses
 *                              the converse REST API; chat path routes
 *                              bedrock through the Agent SDK with full
 *                              tool support). Requires AWS bearer token.
 *   LLM_PROVIDER=auto        → bedrock-first when AWS env present
 *                              (cost-bearing default · ES bedrock account)
 *                              → anthropic (dev/local fallback)
 *                              → stub (STUB_MODE=true)
 *                              → freeside.
 *                              Logs the resolved provider on first call.
 *
 * V0.5-A migration: the `anthropic` path moved from a manual fetch to
 * the Claude Agent SDK. Voice/output is unchanged — the SDK runs a
 * single-turn query, no tool calls, with the digest JSON pre-fetched
 * into the user message. V0.5-B activates Arneson + Rosenzu via the
 * SDK's mcpServers + skills primitives.
 *
 * V0.12 auto-rule flip (operator-named 2026-05-01 · cost-bearing default):
 * production removed ANTHROPIC_API_KEY so auto resolves to bedrock by
 * elimination. This change codifies the order: when AWS Bedrock env is
 * present (bearer token OR API key), bedrock wins regardless of whether
 * ANTHROPIC_API_KEY is also set. ANTHROPIC_API_KEY remains an explicit
 * opt-in for dev/local-testing — set LLM_PROVIDER=anthropic explicitly,
 * or unset bedrock env in dev. The orchestrator path
 * (resolveOrchestratorBackend) already used this preference order; this
 * brings the digest path's auto-resolver in line.
 */

import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR } from '../score/types.ts';
import { generateStubZoneDigest } from '../score/client.ts';
import { getWindowEventCount, getWindowWalletCount } from '../score/types.ts';
import type { PostType } from './post-types.ts';
import { runOrchestratorQuery } from '../orchestrator/index.ts';

export interface InvokeRequest {
  character: CharacterConfig;
  systemPrompt: string;
  userMessage: string;
  modelAlias?: 'cheap' | 'fast-code' | 'reviewer' | 'reasoning' | 'architect';
  zoneHint?: ZoneId;
  postTypeHint?: PostType;
}

export interface InvokeResponse {
  text: string;
  meta?: Record<string, unknown>;
}

export type ResolvedProvider = 'stub' | 'anthropic' | 'freeside' | 'bedrock';

let loggedAutoOnce = false;

/**
 * Resolve the digest-path provider. Exported (V0.12) so the auto-rule
 * matrix can be unit-tested directly — see
 * `apps/bot/src/tests/provider-resolution.test.ts`.
 */
export function resolveProvider(config: Config): ResolvedProvider {
  switch (config.LLM_PROVIDER) {
    case 'stub':
      return 'stub';
    case 'anthropic':
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset');
      }
      return 'anthropic';
    case 'freeside':
      if (!config.FREESIDE_API_KEY) {
        throw new Error('LLM_PROVIDER=freeside but FREESIDE_API_KEY is unset');
      }
      return 'freeside';
    case 'bedrock':
      if (!config.AWS_BEARER_TOKEN_BEDROCK && !config.BEDROCK_API_KEY) {
throw new Error(
  'LLM_PROVIDER=bedrock is configured, but this provider is not enabled in this runtime path. See docs/EILEEN-LOCAL-BEDROCK-SPLIT.md.',
);
      }
      return 'bedrock';
    case 'auto': {
      // V0.12: bedrock-first when AWS env present (cost-bearing default ·
      // operator-named 2026-05-01) → anthropic (dev fallback) → stub →
      // freeside. ANTHROPIC_API_KEY remains an explicit opt-in for dev:
      // either set LLM_PROVIDER=anthropic, or unset AWS_BEARER_TOKEN_BEDROCK
      // / BEDROCK_API_KEY in the dev env so the auto-resolver falls through.
      const bedrockEnv = config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY;
      const resolved: ResolvedProvider = bedrockEnv
        ? 'bedrock'
        : config.ANTHROPIC_API_KEY
          ? 'anthropic'
          : config.STUB_MODE
            ? 'stub'
            : config.FREESIDE_API_KEY
              ? 'freeside'
              : (() => {
                  throw new Error(
                    'LLM_PROVIDER=auto: no provider available — set bedrock (AWS_BEARER_TOKEN_BEDROCK), STUB_MODE=true, ANTHROPIC_API_KEY, or FREESIDE_API_KEY',
                  );
                })();
      if (!loggedAutoOnce) {
        console.log(
          `llm: ${resolved}-direct (LLM_PROVIDER=auto resolved · set explicitly to silence this notice)`,
        );
        loggedAutoOnce = true;
      }
      return resolved;
    }
  }
}

export async function invoke(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  const provider = resolveProvider(config);
  switch (provider) {
    case 'anthropic':
      return invokeAnthropicSdk(config, req);
    case 'stub':
      return generateStubPost(req);
    case 'freeside':
      return invokeFreeside(config, req);
    case 'bedrock':
      return invokeBedrockPlaceholder(config, req);
  }
}

async function invokeAnthropicSdk(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  if (!req.zoneHint || !req.postTypeHint) {
    throw new Error('invokeAnthropicSdk: zoneHint and postTypeHint are required');
  }
  const result = await runOrchestratorQuery(config, {
    character: req.character,
    systemPrompt: req.systemPrompt,
    userMessage: req.userMessage,
    zone: req.zoneHint,
    postType: req.postTypeHint,
  });
  return { text: result.text, meta: result.meta };
}

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

async function invokeBedrockPlaceholder(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  const apiKey = config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY;
  if (!apiKey) {
    throw new Error('Bedrock provider selected but AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY is unset');
  }

  const region = config.BEDROCK_TEXT_REGION || config.AWS_REGION;
  const modelId = config.BEDROCK_TEXT_MODEL_ID;
  if (!modelId) {
    throw new Error('Bedrock provider selected but BEDROCK_TEXT_MODEL_ID is unset');
  }

  const encodedModelId = encodeURIComponent(modelId);
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModelId}/converse`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      system: [
        {
          text: req.systemPrompt,
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              text: req.userMessage,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`bedrock converse error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    output?: {
      message?: {
        content?: Array<{ text?: string }>;
      };
    };
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  };

  const text = data.output?.message?.content
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error(`bedrock converse returned no text: ${JSON.stringify(data)}`);
  }

  return {
    text,
    meta: {
      provider: 'bedrock',
      modelId,
      region,
      usage: data.usage,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Stub generators per post-type
// ──────────────────────────────────────────────────────────────────────

function generateStubPost(req: InvokeRequest): InvokeResponse {
  const zone = req.zoneHint;
  if (!zone) {
    return { text: 'yo team — stub needs a zoneHint to generate.' };
  }
  const digest = generateStubZoneDigest(zone);
  const postType = req.postTypeHint ?? 'digest';

  switch (postType) {
    case 'digest':
      return { text: stubDigest(digest) };
    case 'micro':
      return { text: stubMicro(digest) };
    case 'weaver':
      return { text: stubWeaver(digest) };
    case 'lore_drop':
      return { text: stubLoreDrop(digest) };
    case 'question':
      return { text: stubQuestion(digest) };
    case 'callout':
      return { text: stubCallout(digest) };
    default:
      return { text: stubDigest(digest) };
  }
}

function stubDigest(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const stats = digest.raw_stats;
  const total = getWindowEventCount(stats);
  const wallets = getWindowWalletCount(stats);
  const factors = stats.factor_trends;
  const lead = factors[0];
  const climbed = stats.rank_changes.climbed[0];

  if (!digest.narrative) {
    return `hey ${flavor.name} team — partial snapshot this window. ${total} events confirmed, more pending. ruggy'll repost when the analyst pipeline completes.`;
  }

  if (total < 100) {
    return [
      `henlo ${flavor.name}, week check-in`,
      ``,
      `> ${total} events · ${wallets} miberas · ${factors.length} factors moved`,
      ``,
      `quiet one. ${lead ? `\`${lead.factor_id}\` carried it (${lead.current_count} events).` : 'nothing notable moved.'} holding pattern.`,
      ``,
      `see you next sunday.`,
    ].join('\n');
  }

  const isSpike = (factors[0]?.multiplier ?? 1) > 3 || stats.spotlight !== null;
  if (isSpike) {
    return [
      `ooga booga ${flavor.name} team, big week`,
      ``,
      `> ${total.toLocaleString()} events · ${wallets} miberas · ${factors.length} factors moved`,
      ``,
      lead ? `\`${lead.factor_id}\` ate the leaderboard — ${lead.current_count} events at ${lead.multiplier.toFixed(1)}× baseline. ngl, this is wild.` : '',
      ``,
      stats.spotlight
        ? `🚨 spotlight — \`${stats.spotlight.wallet}\` flagged for ${stats.spotlight.reason.replace('_', ' ')}.`
        : climbed
          ? `🟢 \`${climbed.wallet}\` climbed #${climbed.prior_rank} → #${climbed.current_rank}.`
          : '',
      ``,
      `stay groovy 🐻`,
    ].filter(Boolean).join('\n');
  }

  return [
    `yo ${flavor.name} team, week check-in`,
    ``,
    `> ${total} events · ${wallets} miberas · ${factors.length} factors moved`,
    ``,
    lead ? `\`${lead.factor_id}\` carried the week (${lead.current_count} events). steady run.` : 'steady week.',
    ``,
    climbed ? `🟢 peep \`${climbed.wallet}\` — climbed #${climbed.prior_rank} → #${climbed.current_rank}.` : '',
    ``,
    `stay groovy 🐻`,
  ].filter(Boolean).join('\n');
}

function stubMicro(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const lead = digest.raw_stats.factor_trends[0];
  const climbed = digest.raw_stats.rank_changes.climbed[0];

  const opts = [
    `yo, just peeped ${flavor.name} — ${lead ? `\`${lead.factor_id}\` is steady (${lead.current_count} events). ` : ''}${climbed ? `\`${climbed.wallet}\` quietly climbing.` : 'nothing wild but the og crew is moving.'}`,
    `${flavor.name}'s been ${lead && lead.multiplier > 2 ? 'buzzin' : 'kinda chill'} today. ${lead ? `\`${lead.factor_id}\` carrying the load.` : 'holding pattern.'}`,
    `quick peep at ${flavor.name} — ${getWindowEventCount(digest.raw_stats)} events, ${getWindowWalletCount(digest.raw_stats)} miberas active. ${climbed ? `solid stack from \`${climbed.wallet}\`.` : 'steady.'}`,
  ];
  return opts[Math.floor(Math.random() * opts.length)] ?? opts[0]!;
}

function stubWeaver(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  return `noticed something across the festival this week — ${flavor.name} is buzzin (${getWindowEventCount(digest.raw_stats)} events) but the same miberas keep showing up across multiple zones. that's the og pattern: stack everywhere, not just one zone. keep a peep on the cross-zone movers.`;
}

function stubLoreDrop(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const archetypes = ['Freetekno', 'Milady', 'Chicago Detroit', 'Acidhouse'];
  const arc = archetypes[Math.floor(Math.random() * archetypes.length)];
  return `this week's ${flavor.name} energy feels real ${arc} — ${digest.raw_stats.factor_trends.length > 2 ? 'distributed and kinetic' : 'narrow and focused'}. the codex remembers.`;
}

function stubQuestion(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const opts = [
    `ngl, ${flavor.name}'s been weirdly ${getWindowEventCount(digest.raw_stats) < 200 ? 'chill' : 'lively'} this week. anyone else see it?`,
    `serious question — what's everyone's read on ${flavor.name} right now?`,
    `${flavor.name} regulars: y'all noticing the same patterns ruggy is?`,
  ];
  return opts[Math.floor(Math.random() * opts.length)] ?? opts[0]!;
}

function stubCallout(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  const stats = digest.raw_stats;
  if (stats.spotlight) {
    return `🚨 ${flavor.name} — \`${stats.spotlight.wallet}\` flagged for ${stats.spotlight.reason.replace('_', ' ')}. that's the heaviest move ruggy's logged this cycle. someone's making moves.`;
  }
  const climbed = stats.rank_changes.climbed[0];
  if (climbed) {
    return `🚨 ${flavor.name} — \`${climbed.wallet}\` jumped from #${climbed.prior_rank} → #${climbed.current_rank}. that's a ${climbed.rank_delta}-place delta in one window. worth a peek.`;
  }
  const factor = stats.factor_trends.find((t) => t.multiplier >= 5);
  if (factor) {
    return `🚨 ${flavor.name} — \`${factor.factor_id}\` running at ${factor.multiplier.toFixed(1)}× baseline this window. that's well above pattern.`;
  }
  return `🚨 ${flavor.name} — anomaly check tripped but pattern is unclear. ruggy'll dig into this.`;
}
