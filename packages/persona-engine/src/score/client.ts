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
import type { ZoneDigest, ZoneId, RawStats, NarrativeShape } from './types.ts';
import { ZONE_TO_DIMENSION } from './types.ts';

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
  const response = await fetch(url, {
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
  });

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
  const response = await fetch(url, {
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
  });

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
