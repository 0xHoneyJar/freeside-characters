/**
 * Internal helper — calls score-mibera MCP tools for ambient module.
 *
 * Mirrors the existing pattern at packages/persona-engine/src/score/client.ts
 * (mcpInit + mcpToolCall) but exposes ambient-specific calls.
 *
 * Score-mibera Phase 1 ships v1.2.0 with new tools:
 *   - get_events_since
 *   - get_event_by_id
 *   - get_recent_mints
 *   - list_event_classes
 *
 * Until Phase 1 lands, this client is exercised primarily by tests via the
 * mock adapter. Production deployment requires score-mibera@1.2.0.
 */

import type { Config } from "../../config.ts";

const MCP_PROTOCOL_VERSION = "2024-11-05";

interface McpInitResult {
  sessionId: string;
}

interface McpJsonRpcEnvelope<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

function parseSseEnvelope<T>(body: string): McpJsonRpcEnvelope<T> {
  const dataLine = body.split(/\r?\n/).find((l) => l.startsWith("data: "));
  if (!dataLine) {
    throw new Error(
      `score-mcp: response had no SSE 'data:' line — body=${body.slice(0, 200)}`,
    );
  }
  const json = dataLine.slice("data: ".length).trim();
  return JSON.parse(json) as McpJsonRpcEnvelope<T>;
}

function authHeaders(
  key: string,
  bearer?: string,
): Record<string, string> {
  return {
    "X-MCP-Key": key,
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
  };
}

async function mcpInit(
  url: string,
  key: string,
  bearer?: string,
  signal?: AbortSignal,
): Promise<McpInitResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...authHeaders(key, bearer),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "freeside-characters-ambient", version: "1.0.0" },
      },
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`score-mcp init failed: ${res.status} ${res.statusText}`);
  }
  const sessionId = res.headers.get("Mcp-Session-Id");
  if (!sessionId) {
    throw new Error("score-mcp init missing Mcp-Session-Id header");
  }
  // Drain the init response body
  await res.text();
  // Send notifications/initialized to complete handshake
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Mcp-Session-Id": sessionId,
      ...authHeaders(key, bearer),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
    signal,
  });
  return { sessionId };
}

async function mcpToolCall<T>(
  url: string,
  key: string,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  bearer?: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
      ...authHeaders(key, bearer),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(
      `score-mcp ${toolName} failed: ${res.status} ${res.statusText}`,
    );
  }
  const body = await res.text();
  const envelope = parseSseEnvelope<McpToolResult>(body);
  if (envelope.error) {
    throw new Error(
      `score-mcp ${toolName} error: ${envelope.error.message}`,
    );
  }
  const content = envelope.result?.content?.[0]?.text;
  if (!content) {
    throw new Error(`score-mcp ${toolName} returned empty content`);
  }
  return JSON.parse(content) as T;
}

/** Endpoint identifier — picks which MCP the call routes to.
 * BB F10 closure: separate transports per MCP. `lookup_mibera` lives on
 * codex-mcp; `resolve_wallet` lives on freeside-auth-mcp; `get_events_*`
 * lives on score-mcp. The previous design routed ALL three through
 * `SCORE_API_URL` which would 404 in production. */
export type AmbientMcpEndpoint = "score" | "codex" | "freeside-auth";

interface EndpointConfig {
  url: string | undefined;
  key: string | undefined;
  bearer?: string;
}

function _endpointConfig(
  config: Config,
  endpoint: AmbientMcpEndpoint,
): EndpointConfig {
  switch (endpoint) {
    case "score":
      return {
        url: config.SCORE_API_URL
          ? `${config.SCORE_API_URL}/mcp`
          : undefined,
        key: config.MCP_KEY,
        bearer: config.SCORE_BEARER,
      };
    case "codex":
      return {
        url: process.env.CODEX_MCP_URL,
        key: process.env.CODEX_MCP_KEY ?? config.MCP_KEY,
      };
    case "freeside-auth":
      return {
        url: process.env.FREESIDE_AUTH_MCP_URL,
        key: process.env.FREESIDE_AUTH_MCP_KEY ?? config.MCP_KEY,
      };
  }
}

/** BB F3 closure (NFR-30): boot-time transport security check.
 * Caller invokes once at AmbientLayer construction to fail-fast on
 * misconfigured endpoints. */
export function validateEndpointConfig(
  endpoint: AmbientMcpEndpoint,
  config: Config,
): { ok: true } | { ok: false; reason: string } {
  const ec = _endpointConfig(config, endpoint);
  if (!ec.url) {
    return { ok: false, reason: `${endpoint}-mcp URL not configured` };
  }
  let parsed: URL;
  try {
    parsed = new URL(ec.url);
  } catch {
    return { ok: false, reason: `${endpoint}-mcp URL not parseable: ${ec.url}` };
  }
  if (parsed.protocol !== "https:") {
    // localhost http allowed only in NODE_ENV=development
    if (
      !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")
    ) {
      return {
        ok: false,
        reason: `${endpoint}-mcp must use https:// (got ${parsed.protocol})`,
      };
    }
  }
  const allowlist = (process.env.MCP_ENDPOINT_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(parsed.hostname)) {
    return {
      ok: false,
      reason: `${endpoint}-mcp hostname '${parsed.hostname}' not in MCP_ENDPOINT_ALLOWLIST`,
    };
  }
  return { ok: true };
}

/** Public helper — call an MCP tool on the named endpoint.
 * BB F10 closure: routes to score / codex / freeside-auth MCPs separately. */
export async function callAmbientMcpTool<T>(
  config: Config,
  endpoint: AmbientMcpEndpoint,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const ec = _endpointConfig(config, endpoint);
  if (!ec.url) {
    throw new Error(
      `ambient-mcp ${endpoint}: ${toolName} called but ${endpoint}-mcp URL not configured`,
    );
  }
  if (!ec.key) {
    throw new Error(
      `ambient-mcp ${endpoint}: ${toolName} called without MCP key (use STUB_MODE adapter or set ${endpoint.toUpperCase().replace("-", "_")}_MCP_KEY)`,
    );
  }
  const { sessionId } = await mcpInit(ec.url, ec.key, ec.bearer, signal);
  return mcpToolCall<T>(
    ec.url,
    ec.key,
    sessionId,
    toolName,
    args,
    ec.bearer,
    signal,
  );
}

/** Legacy alias — pre-F10. Score-only path. Kept for event-source.live.ts
 * which legitimately calls score-mcp tools (`get_events_since`, etc.). */
export async function callScoreToolAmbient<T>(
  config: Config,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  return callAmbientMcpTool<T>(config, "score", toolName, args, signal);
}
