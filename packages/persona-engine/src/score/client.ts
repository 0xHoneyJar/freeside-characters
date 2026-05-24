/**
 * Score-MCP client — calls zerker's `get_zone_digest` tool over the
 * real MCP protocol on score-api/mcp.
 *
 * Protocol shape (per @modelcontextprotocol/sdk StreamableHTTP):
 *   1. POST /mcp { method: "initialize" } → returns SSE response
 *      with Mcp-Session-Id header
 *   2. POST /mcp { method: "notifications/initialized" } with session id
 *   3. POST /mcp { method: "tools/call", ... } with session id → SSE
 *
 * Session is 30min TTL server-side. We reinit per call (stateless from
 * client's perspective). When V0.5 SDK migration lands, swap this for
 * `@anthropic-ai/claude-agent-sdk` mcpServers config.
 *
 * Routing:
 *   STUB_MODE=true (no MCP_KEY) → synthetic ZoneDigest
 *   MCP_KEY set                 → real MCP call
 */

import type { Config } from '../config.ts';
import type {
  GetDimensionBreakdownResponse,
  GetRecentEventsResponse,
  PulseDimension,
  PulseDimensionBreakdown,
  ZoneDigest,
  ZoneId,
  RawStats,
  NarrativeShape,
  GetRecentBadgesArgs,
  GetRecentBadgesResponse,
  BadgeRarity,
  BadgeType,
} from './types.ts';
import { ZONE_TO_DIMENSION } from './types.ts';
import { fetchWithRetry, type FetchRetryOptions } from './retry.ts';

interface McpInitResult {
  sessionId: string;
}

interface McpJsonRpcEnvelope<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * Retry policy for score-mcp transport calls. The weekly digest cron sweeps
 * all zones in a tight loop, so the burst trips score-mcp's rate limit and the
 * last zone (owsley-lab) used to drop on the first un-retried 429. Honors the
 * server's Retry-After and logs each backoff so the waits are visible in the
 * Sunday cron's prod logs.
 */
const SCORE_RETRY_OPTS: FetchRetryOptions = {
  onRetry: ({ attempt, status, delayMs, reason }) => {
    console.warn(
      `score-mcp: retry ${attempt} in ${delayMs}ms — ${reason}` +
        (status ? ` (status ${status})` : ''),
    );
  },
};

/** Parse a single SSE response body into the embedded JSON-RPC envelope. */
function parseSseEnvelope<T>(body: string): McpJsonRpcEnvelope<T> {
  // SSE format: lines like `event: message\ndata: {json}\n\n`. Find the data line.
  const dataLine = body.split(/\r?\n/).find((l) => l.startsWith('data: '));
  if (!dataLine) {
    throw new Error(`mcp: response had no SSE 'data:' line — body=${body.slice(0, 200)}`);
  }
  const json = dataLine.slice('data: '.length).trim();
  return JSON.parse(json) as McpJsonRpcEnvelope<T>;
}

function authHeaders(key: string, bearer?: string): Record<string, string> {
  return {
    'X-MCP-Key': key,
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  };
}

async function mcpInit(url: string, key: string, bearer?: string): Promise<McpInitResult> {
  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...authHeaders(key, bearer),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          clientInfo: { name: 'freeside-characters', version: '0.6.0' },
          capabilities: {},
        },
      }),
    },
    SCORE_RETRY_OPTS,
  );

  if (!response.ok) {
    throw new Error(`mcp init failed: ${response.status} ${await response.text()}`);
  }

  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('mcp init: response missing Mcp-Session-Id header');
  }

  // Drain the body so the connection releases cleanly
  await response.text();

  // Send the initialized notification (fire-and-forget; server expects it)
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...authHeaders(key, bearer),
      'Mcp-Session-Id': sessionId,
    },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });

  return { sessionId };
}

async function mcpToolCall<T>(
  url: string,
  key: string,
  sessionId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  bearer?: string,
): Promise<T> {
  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...authHeaders(key, bearer),
        'Mcp-Session-Id': sessionId,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 1e9),
        method: 'tools/call',
        params: { name: toolName, arguments: toolArgs },
      }),
    },
    SCORE_RETRY_OPTS,
  );

  if (!response.ok) {
    throw new Error(`mcp tools/call failed: ${response.status} ${await response.text()}`);
  }

  const envelope = parseSseEnvelope<McpToolResult>(await response.text());
  if (envelope.error) {
    throw new Error(`mcp tools/call error: ${JSON.stringify(envelope.error)}`);
  }

  const text = envelope.result?.content?.[0]?.text;
  if (!text) {
    throw new Error('mcp tools/call: empty content');
  }

  return JSON.parse(text) as T;
}

export async function fetchZoneDigest(config: Config, zone: ZoneId): Promise<ZoneDigest> {
  if (config.STUB_MODE && !config.MCP_KEY) {
    return generateStubZoneDigest(zone);
  }

  if (!config.MCP_KEY) {
    throw new Error('MCP_KEY required for live score-mcp; or set STUB_MODE=true for synthetic data');
  }

  const url = `${config.SCORE_API_URL}/mcp`;
  const bearer = config.SCORE_BEARER;
  const { sessionId } = await mcpInit(url, config.MCP_KEY, bearer);
  return mcpToolCall<ZoneDigest>(
    url,
    config.MCP_KEY,
    sessionId,
    'get_zone_digest',
    { zone, window: 'weekly' },
    bearer,
  );
}

export async function fetchDimensionBreakdown(
  config: Config,
  dimension?: PulseDimension,
  // cycle-007 S8 r4 (operator pivot 2026-05-17): opened window type to 7|30|90
  // for the dashboard-aligned pulse digest. score-mcp accepts all three; the
  // 7d path landed on score-dashboard side via 80d715f (FETCH_MIN_DAYS=14 floor).
  window: 7 | 30 | 90 = 30,
): Promise<GetDimensionBreakdownResponse> {
  if (config.STUB_MODE && !config.MCP_KEY) {
    const dimensions = dimension
      ? [generateStubDimensionBreakdown(dimension)]
      : (['og', 'nft', 'onchain'] as const).map((dim) => generateStubDimensionBreakdown(dim));
    return {
      dimensions,
      schema_version: '1.1.0',
      generated_at: new Date().toISOString(),
    };
  }

  if (!config.MCP_KEY) {
    throw new Error('MCP_KEY required for live score-mcp; or set STUB_MODE=true for synthetic data');
  }

  const url = `${config.SCORE_API_URL}/mcp`;
  const bearer = config.SCORE_BEARER;
  const { sessionId } = await mcpInit(url, config.MCP_KEY, bearer);
  return mcpToolCall<GetDimensionBreakdownResponse>(
    url,
    config.MCP_KEY,
    sessionId,
    'get_dimension_breakdown',
    { window, ...(dimension ? { dimension } : {}) },
    bearer,
  );
}

/**
 * fetchRecentBadges — score-mcp `get_recent_badges` tool (issue #83).
 *
 * Note: limit-only (no window param). Agent tracks "since last poll" via
 * `earned_at` cursor on its own side. If earnings.length === limit, you may
 * be missing some (bump limit or repoll faster).
 *
 * Per issue #83 MCP-client hygiene: tool errors surface as `isError: true`,
 * not thrown exceptions. mcpToolCall handles that; this wrapper is parallel
 * to fetchRecentEvents.
 */
export async function fetchRecentBadges(
  config: Config,
  args: GetRecentBadgesArgs = {},
): Promise<GetRecentBadgesResponse> {
  if (config.STUB_MODE && !config.MCP_KEY) {
    return generateStubRecentBadges(args);
  }

  if (!config.MCP_KEY) {
    throw new Error(
      'MCP_KEY required for live get_recent_badges; or set STUB_MODE=true for synthetic data',
    );
  }

  const url = `${config.SCORE_API_URL}/mcp`;
  const bearer = config.SCORE_BEARER;
  const { sessionId } = await mcpInit(url, config.MCP_KEY, bearer);
  return mcpToolCall<GetRecentBadgesResponse>(
    url,
    config.MCP_KEY,
    sessionId,
    'get_recent_badges',
    args as Record<string, unknown>,
    bearer,
  );
}

export async function fetchRecentEvents(
  config: Config,
  limit = 10,
): Promise<GetRecentEventsResponse> {
  if (config.STUB_MODE && !config.MCP_KEY) {
    return {
      events: [],
      by_factor: [],
      schema_version: '1.1.0',
      generated_at: new Date().toISOString(),
    };
  }

  if (!config.MCP_KEY) {
    throw new Error('MCP_KEY required for live score-mcp; or set STUB_MODE=true for synthetic data');
  }

  const url = `${config.SCORE_API_URL}/mcp`;
  const bearer = config.SCORE_BEARER;
  const { sessionId } = await mcpInit(url, config.MCP_KEY, bearer);
  return mcpToolCall<GetRecentEventsResponse>(
    url,
    config.MCP_KEY,
    sessionId,
    'get_recent_events',
    { limit },
    bearer,
  );
}

// ──────────────────────────────────────────────────────────────────────
// Stub generator — synthetic ZoneDigest matching zerker's schema
// (kept for STUB_MODE=true testing; not used when MCP_KEY is set)
// ──────────────────────────────────────────────────────────────────────

export function generateStubZoneDigest(zone: ZoneId): ZoneDigest {
  const now = Date.now();
  const dow = new Date(now).getUTCDay();
  const dimension = ZONE_TO_DIMENSION[zone];

  const shapes: Record<number, ShapeSpec> = {
    0: { multiplier: 1, label: 'normal', notable: 1, climbers: 1, narrative: true },
    1: { multiplier: 0.1, label: 'quiet', notable: 0, climbers: 0, narrative: true },
    2: { multiplier: 4.5, label: 'spike', notable: 3, climbers: 3, narrative: true },
    3: { multiplier: 0.2, label: 'thin', notable: 0, climbers: 0, narrative: false },
  };
  const shape = shapes[dow] ?? shapes[0]!;

  const factorBaselines: Record<ZoneId, Array<{ factor_id: string; baseline: number }>> = {
    stonehenge: [
      { factor_id: 'og:sets', baseline: 38 },
      { factor_id: 'nft:mibera', baseline: 51 },
      { factor_id: 'onchain:lp_provide', baseline: 24 },
      { factor_id: 'nft:honeycomb', baseline: 18 },
    ],
    'bear-cave': [
      { factor_id: 'og:sets', baseline: 38 },
      { factor_id: 'og:henlocked', baseline: 22 },
      { factor_id: 'og:cubquests', baseline: 17 },
    ],
    'el-dorado': [
      { factor_id: 'nft:mibera', baseline: 51 },
      { factor_id: 'nft:honeycomb', baseline: 18 },
      { factor_id: 'nft:gen3', baseline: 12 },
    ],
    'owsley-lab': [
      { factor_id: 'onchain:lp_provide', baseline: 24 },
      { factor_id: 'onchain:liquid_backing', baseline: 15 },
      { factor_id: 'onchain:shadow_minter', baseline: 8 },
    ],
  };
  const factors = factorBaselines[zone];

  const factorTrends = factors.map((f) => ({
    factor_id: f.factor_id,
    current_count: Math.floor(f.baseline * shape.multiplier),
    baseline_avg: f.baseline,
    multiplier: shape.multiplier,
  }));

  const totalEvents = factorTrends.reduce((s, t) => s + t.current_count, 0);
  const activeWallets = Math.max(1, Math.floor(totalEvents * 0.22));

  const climbed = Array.from({ length: shape.climbers }, (_, i) => ({
    wallet: synthAddress(i, 'climb'),
    rank_delta: 30 + i * 12,
    dimension: dimension === 'overall' ? 'og' : (dimension as 'og' | 'nft' | 'onchain'),
    prior_rank: 84 - i * 20,
    current_rank: 41 - i * 15,
  }));

  const topEvents = factorTrends.flatMap((trend, i) =>
    Array.from({ length: Math.min(2, trend.current_count) }, (_, j) => ({
      event_id: synthUUID(i, j),
      wallet: synthAddress(i + j, 'event'),
      factor_id: trend.factor_id,
      raw_value: 1 + j,
      timestamp: new Date(now - (i * 3600 + j * 600) * 1000).toISOString(),
    })),
  );

  const totalE = shape.label === 'thin' ? 89 : totalEvents;
  const activeW = shape.label === 'thin' ? 12 : activeWallets;
  const rawStats: RawStats = {
    schema_version: '2.0.0',
    // v2 names — real window totals (stub fakes them as = sample for simplicity)
    window_event_count: totalE,
    window_wallet_count: activeW,
    top_event_count: topEvents.length,
    top_wallet_count: activeW,
    top_movers: climbed,
    top_events: topEvents,
    spotlight:
      shape.label === 'spike'
        ? {
            wallet: synthAddress(99, 'spotlight'),
            reason: 'rank_climb',
            details: { dimension, rank_delta: 77, prior_rank: 84, current_rank: 7 },
          }
        : null,
    rank_changes: {
      climbed,
      dropped: [],
      entered_top_tier: shape.label === 'spike' ? climbed.slice(0, 2) : [],
      exited_top_tier: [],
    },
    factor_trends: factorTrends,
  };

  const narrative: NarrativeShape | null = shape.narrative
    ? buildStubNarrative(zone, shape.label, rawStats)
    : null;

  const windowEnd = new Date(now);
  const windowStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

  return {
    zone,
    window: 'weekly',
    computed_at: new Date(now).toISOString(),
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    stale: false,
    schema_version: '2.0.0',
    narrative,
    narrative_error: shape.narrative ? null : 'narrative_unavailable',
    narrative_error_hint: shape.narrative
      ? null
      : 'Score-analyst narrative pipeline returned partial data this window.',
    raw_stats: rawStats,
  };
}

export function generateStubDimensionBreakdown(dimension: PulseDimension): PulseDimensionBreakdown {
  const now = Date.now();
  const labels = {
    og: 'OG',
    nft: 'NFT',
    onchain: 'Onchain',
  } as const;
  const factorIds = {
    og: ['og:sets', 'og:articles', 'og:cubquests'],
    nft: ['nft:mibera', 'nft:honeycomb', 'nft:fractures'],
    onchain: ['onchain:lp_provide', 'onchain:liquid_backing', 'onchain:staking'],
  } as const;
  const topFactors = factorIds[dimension].map((factorId, i) => {
    const total = Math.max(1, 14 - i * 4);
    const previous = Math.max(1, 10 - i * 2);
    return {
      factor_id: factorId,
      display_name: factorId.split(':')[1]!.replace(/_/g, ' '),
      primary_action: null,
      total,
      previous,
      delta_pct: ((total - previous) / previous) * 100,
      delta_count: total - previous,
      factor_stats: stubFactorStats(total, 5 + i, 70 + i * 10, now),
    };
  });
  const previous = topFactors.reduce((sum, factor) => sum + factor.previous, 0);
  const total = topFactors.reduce((sum, factor) => sum + factor.total, 0);
  return {
    id: dimension,
    display_name: labels[dimension],
    total_events: total,
    previous_period_events: previous,
    delta_pct: previous === 0 ? null : ((total - previous) / previous) * 100,
    delta_count: total - previous,
    inactive_factor_count: 2,
    total_factor_count: topFactors.length + 2,
    top_factors: topFactors,
    cold_factors: [
      {
        factor_id: `${dimension}:quiet_corner`,
        display_name: 'quiet corner',
        primary_action: null,
        total: 0,
        previous: 0,
        delta_pct: null,
        delta_count: 0,
      },
      {
        factor_id: `${dimension}:sleeping_bees`,
        display_name: 'sleeping bees',
        primary_action: null,
        total: 0,
        previous: 0,
        delta_pct: null,
        delta_count: 0,
      },
    ],
  };
}

function stubFactorStats(
  eventCount: number,
  uniqueActors: number,
  rank: number,
  now: number,
): NonNullable<PulseDimensionBreakdown['top_factors'][number]['factor_stats']> {
  const percentile = { value: eventCount, reliable: true };
  return {
    history: {
      active_days: 90,
      last_active_date: new Date(now).toISOString().slice(0, 10),
      stale: false,
      no_data: false,
      sufficiency: { p50: true, p90: true, p99: true },
    },
    occurrence: { active_day_frequency: 0.4, current_is_active: true },
    magnitude: {
      event_count: eventCount,
      percentiles: {
        p10: percentile,
        p25: percentile,
        p50: percentile,
        p75: percentile,
        p90: percentile,
        p95: percentile,
        p99: percentile,
      },
      current_percentile_rank: rank,
    },
    cohort: {
      unique_actors: uniqueActors,
      percentiles: {
        p10: { value: 1, reliable: true },
        p25: { value: 2, reliable: true },
        p50: { value: 3, reliable: true },
        p75: { value: 5, reliable: true },
        p90: { value: 8, reliable: true },
        p95: { value: 13, reliable: true },
        p99: { value: 21, reliable: true },
      },
      current_percentile_rank: 70,
    },
    cadence: {
      days_since_last_active: 0,
      median_active_day_gap_days: 2,
      current_gap_percentile_rank: 40,
    },
  };
}

function buildStubNarrative(zone: ZoneId, label: string, stats: RawStats): NarrativeShape {
  const totalEvents = stats.window_event_count ?? stats.top_event_count ?? 0;
  const activeWallets = stats.window_wallet_count ?? stats.top_wallet_count ?? 0;
  const topFactor = stats.factor_trends[0];

  const headlines: Record<string, string> = {
    normal: `${zone} held steady this week — ${totalEvents} events, ${activeWallets} active wallets`,
    quiet: `${zone} quiet this week — ${totalEvents} events across ${activeWallets} wallets`,
    spike: `${zone} elevated activity — ${totalEvents} events from ${activeWallets} wallets`,
  };

  const sections: NarrativeShape['sections'] = [];
  if (topFactor) {
    sections.push({
      kind: 'movers',
      body: `${topFactor.factor_id} led with ${topFactor.current_count} events at ${topFactor.multiplier.toFixed(2)}× baseline.`,
    });
  }
  if (stats.rank_changes.climbed.length > 0) {
    const top = stats.rank_changes.climbed[0]!;
    sections.push({
      kind: 'movers',
      body: `Wallet ${top.wallet} climbed from rank ${top.prior_rank} to ${top.current_rank}.`,
    });
  }
  if (stats.spotlight) {
    sections.push({
      kind: 'spotlight',
      body: `Spotlight: ${stats.spotlight.wallet} flagged for ${stats.spotlight.reason.replace('_', ' ')}.`,
    });
  }

  return {
    headline: headlines[label] ?? headlines.normal!,
    sections,
  };
}

interface ShapeSpec {
  multiplier: number;
  label: 'normal' | 'quiet' | 'spike' | 'thin';
  notable: number;
  climbers: number;
  narrative: boolean;
}

function synthAddress(seed: number, kind: string): string {
  const base = `${kind}${seed}`;
  let hash = 0;
  for (const ch of base) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = hash.toString(16).padStart(8, '0').repeat(5).slice(0, 40);
  return `0x${hex}`;
}

function synthUUID(i: number, j: number): string {
  const seed = `${i}-${j}-${Date.now()}`;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}0000`;
}

/**
 * Stub generator for get_recent_badges (cycle-007 S8 kitchen · issue #83).
 * Deterministic-enough output for playground iteration. Honors badge_type
 * + badge_id filters + limit (default 50, cap 200) per the production tool.
 */
export function generateStubRecentBadges(
  args: GetRecentBadgesArgs = {},
): GetRecentBadgesResponse {
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
  const now = Date.now();
  const types: BadgeType[] = [
    'pioneer',
    'count',
    'timing',
    'streak',
    'collection',
    'quality',
    'behavior',
  ];
  const rarities: BadgeRarity[] = [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'mythic',
  ];
  const seedEarnings: ReadonlyArray<{
    badge_id: string;
    badge_name: string;
    badge_type: BadgeType;
    rarity: BadgeRarity;
    description: string;
  }> = [
    {
      badge_id: 'behavior:hodler',
      badge_name: 'True HODLer',
      badge_type: 'behavior',
      rarity: 'rare',
      description:
        'Acquire at least twice as much as you sell across all tracked collections',
    },
    {
      badge_id: 'pioneer:first_mint_week',
      badge_name: 'Pioneer · First Week',
      badge_type: 'pioneer',
      rarity: 'epic',
      description: 'Minted within the first week of the collection going live',
    },
    {
      badge_id: 'count:5_mint_burst',
      badge_name: 'Five-Mint Burst',
      badge_type: 'count',
      rarity: 'common',
      description: 'Five mints within a single 24h window',
    },
    {
      badge_id: 'timing:weekend_warrior',
      badge_name: 'Weekend Warrior',
      badge_type: 'timing',
      rarity: 'uncommon',
      description: 'Active across 4+ consecutive weekends',
    },
    {
      badge_id: 'streak:30_day_holder',
      badge_name: 'Thirty-Day Streak',
      badge_type: 'streak',
      rarity: 'rare',
      description: 'Held a primary asset for 30+ consecutive days without selling',
    },
    {
      badge_id: 'collection:cross_set',
      badge_name: 'Cross-Set Collector',
      badge_type: 'collection',
      rarity: 'legendary',
      description: 'Owns at least one piece from every tracked collection',
    },
    {
      badge_id: 'quality:floor_lifter',
      badge_name: 'Floor Lifter',
      badge_type: 'quality',
      rarity: 'mythic',
      description: 'Single transaction lifted the floor by ≥10%',
    },
  ];

  const filtered = seedEarnings.filter((e) => {
    if (args.badge_type && e.badge_type !== args.badge_type) return false;
    if (args.badge_id && e.badge_id !== args.badge_id) return false;
    return true;
  });

  const earnings = Array.from({ length: Math.min(limit, filtered.length || 1) }, (_, i) => {
    const seed = filtered[i % Math.max(filtered.length, 1)] ?? seedEarnings[i % seedEarnings.length]!;
    void rarities;
    void types;
    return {
      badge_id: seed.badge_id,
      badge_name: seed.badge_name,
      badge_type: seed.badge_type,
      rarity: seed.rarity,
      description: seed.description,
      // Newest first, spaced ~3 min apart for visual ordering in the playground.
      earned_at: new Date(now - i * 3 * 60_000).toISOString(),
      wallet: synthAddress(i, 'badge'),
    };
  });

  return {
    earnings,
    generated_at: new Date().toISOString(),
  };
}
