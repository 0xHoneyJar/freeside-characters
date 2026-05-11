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

/** Public helper — wraps init + tool call in one go. */
export async function callScoreToolAmbient<T>(
  config: Config,
  toolName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (!config.MCP_KEY) {
    throw new Error(
      `score-mcp ${toolName} called without MCP_KEY (use STUB_MODE adapter)`,
    );
  }
  const url = `${config.SCORE_API_URL}/mcp`;
  const bearer = config.SCORE_BEARER;
  const { sessionId } = await mcpInit(url, config.MCP_KEY, bearer, signal);
  return mcpToolCall<T>(
    url,
    config.MCP_KEY,
    sessionId,
    toolName,
    args,
    bearer,
    signal,
  );
}
