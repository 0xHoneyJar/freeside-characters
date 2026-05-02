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
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { PostType } from '../compose/post-types.ts';
import { rosenzuServer } from './rosenzu/server.ts';
import { freesideAuthServer } from './freeside_auth/server.ts';
import { emojisServer } from './emojis/server.ts';
import { createImagegenServer } from './imagegen/server.ts';
import { isImagegenConfigured } from './imagegen/bedrock-client.ts';
// V0.6-C reconciliation 2026-04-30: cabalGygaxAgent retired from per-fire
// compose path per gumi correction §0.5 #1 — the 9 cabal archetypes are
// AUDIENCE postures, not character voice modes. The subagent code is
// preserved at ./cabal/gygax.ts as a building block for a future /cabal
// command (post-design audience reception tester). No longer imported here.

/**
 * V0.7-A.1 Phase D: chat-mode requests share the same SDK surface as
 * digest. The orchestrator doesn't read `zone` or `postType` (the prompt
 * pair already carries everything the LLM sees), but they're useful caller
 * metadata for telemetry and per-character MCP scoping. Both fields are
 * optional now so chat-mode callers without a resolved zone (DM, non-zone
 * channel) can pass through.
 */
export type OrchestratorPostType = PostType | 'chat';

export interface OrchestratorRequest {
  character: CharacterConfig;
  systemPrompt: string;
  userMessage: string;
  /** Required for digest path (caller's zone-of-fire). Optional for chat
   *  path — undefined when invoked from a DM or non-codex-mapped channel. */
  zone?: ZoneId;
  /** Required for digest (caller's PostType). Optional for chat ('chat'). */
  postType?: OrchestratorPostType;
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
    freeside_auth: freesideAuthServer,
    emojis: emojisServer,
  };

  // Register score-mcp whenever MCP_KEY is set. STUB_MODE used to gate
  // this in V0.4.x but its scope was the data layer's stub generator,
  // not the LLM tool-call layer. With MCP_KEY present, the LLM has a
  // real backend; STUB_MODE alone shouldn't strip it.
  //
  // V0.5-E: score-mcp v1.1.0 (zerker's PR #71, merged 2026-04-29) added
  // factor + dimension catalog tools (describe_factor, list_factors,
  // describe_dimension, list_dimensions). Ruggy's previous in-bot
  // factors mcp was a vendored translation table — retired now that
  // score is the canonical writer per UNIX self-description doctrine.
  if (config.MCP_KEY) {
    servers.score = {
      type: 'http',
      url: `${config.SCORE_API_URL}/mcp`,
      headers: {
        'X-MCP-Key': config.MCP_KEY,
        // SCORE_BEARER is the gateway gate; harmless when score is reached
        // direct (upstream ignores Authorization). Set both env vars to
        // route via mcp.0xhoneyjar.xyz/score.
        ...(config.SCORE_BEARER ? { Authorization: `Bearer ${config.SCORE_BEARER}` } : {}),
      },
    };
  }

  // codex-mcp v1 (gumi) — anti-hallucination lookup for narrative-bot
  // consumers. Public read, no auth. 8 tools: lookup_zone /
  // lookup_archetype / lookup_factor / lookup_grail / lookup_mibera /
  // list_zones / list_archetypes / validate_world_element.
  // Per-character scoping (ruggy:[score,codex], satoshi:[codex]) is
  // V0.7-A.3 work — for now codex is bot-wide, available in any
  // character's digest path when CODEX_MCP_URL is set. Chat-mode
  // (composeReply) still bypasses MCPs entirely by design.
  if (config.CODEX_MCP_URL) {
    servers.codex = {
      type: 'http',
      url: `${config.CODEX_MCP_URL}/mcp`,
    };
  }

  // imagegen-mcp (Bedrock Stability text-to-image) — V0.7-A.1 substrate
  // scaffold. Registered when AWS_REGION + BEDROCK_STABILITY_MODEL_ID
  // are set. Body is a placeholder stub awaiting Eileen's PR; the tool
  // surface is exercisable today via /satoshi-image dispatch. Per-
  // character scope (ruggy=no-imagegen, satoshi=imagegen) lands with
  // V0.7-A.3 — until then, chat-mode bypasses MCPs entirely so ruggy's
  // voice register is uncontested even when this server is registered.
  if (isImagegenConfigured(config)) {
    servers.imagegen = createImagegenServer(config);
  }

  return servers;
}

/**
 * Allowed tool whitelist for headless safety.
 *
 * `permissionMode: 'dontAsk'` denies anything not pre-approved. We
 * whitelist `mcp__<server>__*` for each registered MCP server.
 *
 * V0.6-C reconciliation 2026-04-30: `Task` removed from allowedTools.
 * The only consumer was cabal-gygax dispatch, which retired from per-fire
 * compose path per gumi correction §0.5 #1. If a future subagent needs
 * Task dispatch (e.g. the /cabal post-design reception tester running
 * separately from compose), re-add then.
 *
 * V0.7-A.1 (per-character MCP scoping): when `characterMcps` is provided,
 * the allowed list filters to servers whose names appear in that array.
 * Names that aren't currently registered are silently dropped — the
 * character expresses INTENT; what's actually available is the
 * intersection with what the substrate has wired. When `characterMcps`
 * is undefined, all registered servers are allowed (V0.6 parity).
 *
 * Exported (rather than file-private) so the substrate's smoke tests can
 * exercise the scoping logic without booting the Claude Agent SDK loop.
 */
export function buildAllowedTools(
  mcpServers: Record<string, McpServerConfig>,
  characterMcps?: string[],
): string[] {
  const allNames = Object.keys(mcpServers);
  const enabled = characterMcps
    ? allNames.filter((name) => characterMcps.includes(name))
    : allNames;
  return enabled.map((name) => `mcp__${name}__*`);
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
  const allowedTools = buildAllowedTools(mcpServers, req.character.mcps);

  // V0.7-A.1 observability: when a character's declared mcps name servers
  // not currently registered (env-gated MCP not configured, OR a typo in
  // character.json), they're silently dropped from the allowedTools
  // intersection. Surface that to the operator so a missed env var or a
  // misspelled scope name doesn't masquerade as "the LLM just chose not
  // to use the tool." Logged once per fire — for V0.6 cron cadence (1-2
  // fires/day) this is negligible noise; if it ever becomes load-bearing
  // we can dedup by (characterId, droppedSet) at startup.
  if (req.character.mcps) {
    const registered = Object.keys(mcpServers);
    const dropped = req.character.mcps.filter((n) => !registered.includes(n));
    if (dropped.length > 0) {
      console.warn(
        `orchestrator: character ${req.character.id} declared mcps [${dropped.join(', ')}] not currently registered — dropped from allowedTools`,
      );
    }
  }

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
    // V0.6-C reconciliation 2026-04-30: cabal-gygax subagent removed from
    // `agents` per gumi correction §0.5 #1 (cabal archetypes are audience
    // postures, not character voice modes). Per-character anchored
    // archetypes are now identity properties baked into persona.md prompts,
    // not runtime modes. No subagents registered for compose.
    // V0.5-C: 12 turns for rosenzu + score + factors + freeside_auth tool
    // rounds. V0.6-C: cabal dispatch removed — most posts settle in 6-8
    // turns; cap stays at 12 as safety bound.
    maxTurns: 12,
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
