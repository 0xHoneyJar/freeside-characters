/**
 * LLM gateway — explicit provider routing (V0.4 → V0.5-A).
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
 *   LLM_PROVIDER=auto        → V0.3 back-compat: anthropic key wins,
 *                              else stub if STUB_MODE, else freeside.
 *                              Logs the resolved provider on first call.
 *
 * V0.5-A migration: the `anthropic` path moved from a manual fetch to
 * the Claude Agent SDK. Voice/output is unchanged — the SDK runs a
 * single-turn query, no tool calls, with the digest JSON pre-fetched
 * into the user message. V0.5-B activates Arneson + Rosenzu via the
 * SDK's mcpServers + skills primitives.
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

export type ResolvedProvider = 'stub' | 'anthropic' | 'freeside';

let loggedAutoOnce = false;

function resolveProvider(config: Config): ResolvedProvider {
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
    case 'auto': {
      // V0.3 back-compat: anthropic > stub > freeside
      const resolved: ResolvedProvider = config.ANTHROPIC_API_KEY
        ? 'anthropic'
        : config.STUB_MODE
          ? 'stub'
          : config.FREESIDE_API_KEY
            ? 'freeside'
            : (() => {
                throw new Error(
                  'LLM_PROVIDER=auto: no provider available — set STUB_MODE=true, ANTHROPIC_API_KEY, or FREESIDE_API_KEY',
                );
              })();
      if (!loggedAutoOnce) {
        console.log(`llm: LLM_PROVIDER=auto resolved to '${resolved}' (set explicitly to silence this notice)`);
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
