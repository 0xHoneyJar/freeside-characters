/**
 * Orchestrator — Claude Agent SDK execution layer.
 *
 * Wraps each LLM call through `@anthropic-ai/claude-agent-sdk`'s `query()`
 * runtime. The SDK gives us mcpServers, settingSources, permissionMode,
 * subagents — the loop primitives V0.5 leans on.
 *
 * V0.5-A:
 *   - Single-turn, no tool calls (parity with V0.4.5)
 *   - Digest data pre-fetched, embedded in user message
 *   - mcpServers wired but unused
 *
 * V0.5-B (this file's current state):
 *   - Tripartite locus active — codex (vocab) + score-mcp (trigger) +
 *     persona/arneson (lens). LLM calls tools to compose grounded posts.
 *   - rosenzu in-bot MCP via `createSdkMcpServer` (no separate deploy)
 *   - score-mcp lit; LLM calls `mcp__score__get_zone_digest` directly
 *   - arneson SKILL.md loaded via `settingSources: ['project']`
 *   - maxTurns: 8 — allows tool-call rounds
 *   - effort: 'medium' — ~15s/zone (operator pick)
 *
 * V0.5-C will:
 *   - Add Gygax subagent via `agents` config
 *   - Wire `/memories` for wallet-recognition
 *   - Implement 5 anti-pattern guards
 */

import { query, type McpServerConfig, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { Config } from '../config.ts';
import type { ZoneId } from '../score/types.ts';
import type { PostType } from '../llm/post-types.ts';
import { rosenzuServer } from './rosenzu/server.ts';

export interface OrchestratorRequest {
  systemPrompt: string;
  userMessage: string;
  zone: ZoneId;
  postType: PostType;
}

export interface OrchestratorResponse {
  text: string;
  meta?: Record<string, unknown>;
}

/**
 * Build the mcpServers map for the SDK query options.
 *
 * - `score` — zerker's HTTP MCP (live ZoneDigest path). Registered when
 *   MCP_KEY is set and STUB_MODE is off. The LLM is directed by persona
 *   prompt to call `mcp__score__get_zone_digest` before composing.
 * - `rosenzu` — in-process SDK MCP (spatial awareness). Always
 *   registered; no env requirement. The LLM is directed to call
 *   `mcp__rosenzu__furnish_kansei` + `mcp__rosenzu__get_current_district`
 *   before scene-gen.
 */
function buildMcpServers(config: Config): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {
    rosenzu: rosenzuServer,
  };

  // Register score-mcp whenever MCP_KEY is set. STUB_MODE used to gate
  // this in V0.4.x but its scope was the data layer's stub generator,
  // not the LLM tool-call layer. With MCP_KEY present, the LLM has a
  // real backend; STUB_MODE alone shouldn't strip it.
  if (config.MCP_KEY) {
    servers.score = {
      type: 'http',
      url: `${config.SCORE_API_URL}/mcp`,
      headers: { 'X-MCP-Key': config.MCP_KEY },
    };
  }

  return servers;
}

/**
 * Allowed tool whitelist for headless safety.
 *
 * `permissionMode: 'dontAsk'` denies anything not pre-approved. We
 * whitelist `mcp__<server>__*` for each registered MCP server.
 */
function buildAllowedTools(mcpServers: Record<string, McpServerConfig>): string[] {
  return Object.keys(mcpServers).map((name) => `mcp__${name}__*`);
}

/**
 * Build the env passed to the SDK subprocess.
 *
 * When ruggy runs inside another Claude Code session (e.g. during dev),
 * inheriting `CLAUDECODE=1` + `CLAUDE_CODE_ENTRYPOINT` etc. flips the
 * SDK into bridge-mode auth, which then fails ("Invalid API key"). We
 * scrub those vars so the SDK uses direct Anthropic API auth via
 * `ANTHROPIC_API_KEY` in production and dev alike.
 */
function buildSdkEnv(config: Config): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_') || k === 'CLAUDECODE' || k === 'CLAUDE_PLUGIN_DATA') {
      continue;
    }
    env[k] = v;
  }
  env.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY!;
  return env;
}

export async function runOrchestratorQuery(
  config: Config,
  req: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error(
      'orchestrator: ANTHROPIC_API_KEY required for SDK path. Set it or switch LLM_PROVIDER to stub/freeside.',
    );
  }

  const mcpServers = buildMcpServers(config);
  const allowedTools = buildAllowedTools(mcpServers);

  const options: Options = {
    systemPrompt: req.systemPrompt,
    model: config.ANTHROPIC_MODEL,
    mcpServers,
    allowedTools,
    permissionMode: 'dontAsk',
    // V0.5-B: load arneson skill via project's .claude/skills/arneson/.
    // The skill carries TTRPG-DM scene-gen rules; loads progressively.
    settingSources: ['project'],
    tools: [],
    // V0.5-B: 8 turns to allow rosenzu + score tool-call rounds before
    // final compose. Most posts settle in 3-4 turns; cap is a safety
    // bound, not a target.
    maxTurns: 8,
    // V0.5-B: medium effort — operator pick. high (~30-77s/zone) was
    // overkill for cron-driven cadence; medium is ~15s/zone. drop to
    // 'low' if voice holds and we want closer to V0.4.5 latency.
    effort: 'medium',
    env: buildSdkEnv(config),
    stderr: (data) => {
      if (config.LOG_LEVEL === 'debug') {
        console.error(`[sdk] ${data.trimEnd()}`);
      }
    },
  };

  let text = '';
  let usage: Record<string, unknown> | undefined;

  for await (const message of query({ prompt: req.userMessage, options })) {
    if (message.type !== 'result') continue;

    if (message.subtype === 'success') {
      text = message.result;
      usage = {
        duration_ms: message.duration_ms,
        duration_api_ms: message.duration_api_ms,
        num_turns: message.num_turns,
        total_cost_usd: message.total_cost_usd,
        ...message.usage,
      };
      break;
    }

    throw new Error(
      `orchestrator: SDK error subtype=${message.subtype}` +
        (message.errors?.length ? ` errors=${message.errors.join('; ')}` : ''),
    );
  }

  if (!text) {
    throw new Error('orchestrator: SDK query completed without an assistant text response');
  }

  return { text, meta: usage };
}
