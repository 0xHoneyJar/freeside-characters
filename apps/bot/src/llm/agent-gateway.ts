/**
 * LLM gateway — three routes:
 *   STUB_MODE=true (no keys)  → canned digest matching ZoneDigest input
 *   ANTHROPIC_API_KEY set     → anthropic-direct (V0 testing path)
 *   FREESIDE_API_KEY set      → freeside agent-gateway (production)
 *
 * Order: anthropic key wins (V0 voice testing); else stub; else freeside.
 */

import type { Config } from '../config.ts';
import type { ZoneDigest, ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR } from '../score/types.ts';
import type { PostType } from './post-types.ts';

export interface InvokeRequest {
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

export async function invoke(config: Config, req: InvokeRequest): Promise<InvokeResponse> {
  if (config.ANTHROPIC_API_KEY) {
    return invokeAnthropicDirect(config, req);
  }
  if (config.STUB_MODE) {
    return generateStubPost(req);
  }
  if (config.FREESIDE_API_KEY) {
    return invokeFreeside(config, req);
  }
  throw new Error(
    'no LLM provider configured: set STUB_MODE=true, or ANTHROPIC_API_KEY, or FREESIDE_API_KEY',
  );
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

// ──────────────────────────────────────────────────────────────────────
// Stub generators per post-type
// ──────────────────────────────────────────────────────────────────────

function generateStubPost(req: InvokeRequest): InvokeResponse {
  const digest = extractZoneDigest(req.userMessage);
  const postType = req.postTypeHint ?? 'digest';

  if (!digest) {
    return { text: 'yo team — stub could not parse the input.' };
  }

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
  const total = stats.total_events;
  const wallets = stats.active_wallets;
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
      `> ${total} events · ${wallets} wallets · ${factors.length} factors moved`,
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
      `> ${total.toLocaleString()} events · ${wallets} wallets · ${factors.length} factors moved`,
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
    `> ${total} events · ${wallets} wallets · ${factors.length} factors moved`,
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
    `quick peep at ${flavor.name} — ${digest.raw_stats.total_events} events, ${digest.raw_stats.active_wallets} wallets active. ${climbed ? `solid stack from \`${climbed.wallet}\`.` : 'steady.'}`,
  ];
  return opts[Math.floor(Math.random() * opts.length)] ?? opts[0]!;
}

function stubWeaver(digest: ZoneDigest): string {
  const flavor = ZONE_FLAVOR[digest.zone];
  return `noticed something across the festival this week — ${flavor.name} is buzzin (${digest.raw_stats.total_events} events) but the same wallets keep showing up across multiple zones. that's the og pattern: stack everywhere, not just one zone. keep a peep on the cross-zone movers.`;
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
    `ngl, ${flavor.name}'s been weirdly ${digest.raw_stats.total_events < 200 ? 'chill' : 'lively'} this week. anyone else see it?`,
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

function extractZoneDigest(userMessage: string): ZoneDigest | null {
  const jsonMatch = userMessage.match(/\{[\s\S]+\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as ZoneDigest;
  } catch {
    return null;
  }
}
