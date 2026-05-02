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

/**
 * Tool-use event surfaced from the SDK's `assistant` stream. Callers
 * (chat dispatcher) use these to render Claude-style progressive UI:
 * "🔧 pulling zone digest…" while the round-trip is in flight.
 *
 * Pattern reference: `~/Documents/GitHub/ruggy-v2/src/agent.ts` onToolUse.
 */
export interface ToolUseEvent {
  /** Fully-qualified tool name (e.g., `mcp__score__get_zone_digest`). */
  name: string;
  /** SDK-assigned tool-use block id (stable for tool→result correlation). */
  id: string;
  /** Tool args the LLM sent (opaque · for trajectory logging only). */
  input: unknown;
}

export interface OrchestratorRequest {
  character: CharacterConfig;
  systemPrompt: string;
  userMessage: string;
  /** Required for digest path (caller's zone-of-fire). Optional for chat
   *  path — undefined when invoked from a DM or non-codex-mapped channel. */
  zone?: ZoneId;
  /** Required for digest (caller's PostType). Optional for chat ('chat'). */
  postType?: OrchestratorPostType;
  /**
   * V0.7-A.1: optional callback fired when the LLM emits a `tool_use` block
   * mid-stream (before the SDK invokes the tool). Used by the chat dispatcher
   * to PATCH the deferred Discord message with progress ("🔧 pulling X…").
   * Fires once per tool_use block; multiple tool calls in one query produce
   * multiple events.
   */
  onToolUse?: (event: ToolUseEvent) => void;
}

export interface OrchestratorResponse {
  text: string;
  meta?: Record<string, unknown>;
  /** Tool calls observed during the run, in stream order (oldest first). */
  toolUses?: ToolUseEvent[];
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
export function buildMcpServers(config: Config): Record<string, McpServerConfig> {
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

  // V0.10.2 telemetry (session-09 codex-rescue recommendation): surface
  // which MCP servers actually registered so operators can correlate
  // chat-route logs with available tools. If `score` or `codex` is missing
  // here despite character.mcps requesting them, the env vars (MCP_KEY,
  // CODEX_MCP_URL) are unset in production — H4 from the kickoff brief.
  const registeredNames = Object.keys(servers).sort();
  console.log(`orchestrator: registered MCP servers=[${registeredNames.join(',')}]`);
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
 * Resolve the SDK backend for the orchestrator path. The Anthropic Agent
 * SDK supports anthropic.com (firstParty) AND Bedrock as backends via
 * the `CLAUDE_CODE_USE_BEDROCK=1` env var. We pick based on
 * `LLM_PROVIDER` so a single deployment can route Claude (Opus 4.7) via
 * either path. Stub/freeside aren't SDK-eligible — they fall through
 * to the naive `invokeChat` shim in compose/reply.ts.
 *
 * Per Loa PR #662 (jani · 2026-04-30): Bedrock model identifiers use
 * inference profile IDs (`us.anthropic.claude-opus-4-7`), NOT the bare
 * `anthropic.claude-opus-4-7` form (which returns HTTP 400). Default
 * follows that convention.
 */
type SdkBackend = 'anthropic' | 'bedrock';

function resolveOrchestratorBackend(config: Config): SdkBackend {
  switch (config.LLM_PROVIDER) {
    case 'bedrock':
      return 'bedrock';
    case 'anthropic':
      return 'anthropic';
    case 'auto':
      // Operator-aware default: bedrock takes precedence when its bearer
      // token is present (V0.8.0 satoshi setup + Loa PR #662 stack).
      // Fall back to anthropic key. If neither, throw at the runtime
      // check below.
      if (config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY) return 'bedrock';
      if (config.ANTHROPIC_API_KEY) return 'anthropic';
      return 'anthropic'; // unreachable in practice; runtime guard catches
    case 'stub':
    case 'freeside':
      // Not SDK-eligible. Caller should route through invokeChat instead;
      // we throw here to surface the misuse.
      throw new Error(
        `orchestrator: LLM_PROVIDER='${config.LLM_PROVIDER}' is not SDK-eligible. ` +
          `Use the invokeChat shim in compose/reply.ts for stub/freeside paths.`,
      );
    default: {
      // Bridgebuilder F1 (PR #11) · exhaustiveness guard. If LLM_PROVIDER
      // ever widens (e.g., adds 'vertex' or 'foundry') without a matching
      // case, this assertion fails at compile time so the issue is loud.
      const _exhaustive: never = config.LLM_PROVIDER;
      throw new Error(
        `orchestrator: unhandled LLM_PROVIDER='${_exhaustive}'. ` +
          `Add a case to resolveOrchestratorBackend.`,
      );
    }
  }
}

/**
 * Inference profile / model alias for the active backend. Anthropic SDK
 * resolves these as model IDs against the chosen backend. We default to
 * Opus 4.7 in both shapes — Bedrock takes the inference profile form,
 * anthropic.com takes the bare alias.
 */
function resolveSdkModel(config: Config, backend: SdkBackend): string {
  if (backend === 'bedrock') {
    return (
      config.BEDROCK_TEXT_MODEL_ID ?? 'us.anthropic.claude-opus-4-7'
    );
  }
  return config.ANTHROPIC_MODEL;
}

/**
 * Build the env passed to the SDK subprocess.
 *
 * When ruggy runs inside another Claude Code session (e.g. during dev),
 * inheriting `CLAUDECODE=1` + `CLAUDE_CODE_ENTRYPOINT` etc. flips the
 * SDK into bridge-mode auth, which then fails ("Invalid API key"). We
 * scrub those vars FIRST to ensure we control the auth path.
 *
 * Then we set the active backend explicitly:
 *   - anthropic: ANTHROPIC_API_KEY (direct firstParty auth)
 *   - bedrock:   CLAUDE_CODE_USE_BEDROCK=1 + AWS_BEARER_TOKEN_BEDROCK
 *               + AWS_REGION (Bearer-token flow per Loa PR #662)
 *
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN are
 * preserved if present (SigV4 fallback for environments without bearer
 * token; the SDK auto-detects).
 */
function buildSdkEnv(config: Config, backend: SdkBackend): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_') || k === 'CLAUDECODE' || k === 'CLAUDE_PLUGIN_DATA') {
      continue;
    }
    env[k] = v;
  }

  if (backend === 'bedrock') {
    // Activate Bedrock backend. The SDK reads CLAUDE_CODE_USE_BEDROCK
    // to route through Bedrock instead of api.anthropic.com.
    env.CLAUDE_CODE_USE_BEDROCK = '1';
    env.AWS_REGION = config.BEDROCK_TEXT_REGION || config.AWS_REGION;
    if (config.AWS_BEARER_TOKEN_BEDROCK) {
      env.AWS_BEARER_TOKEN_BEDROCK = config.AWS_BEARER_TOKEN_BEDROCK;
    }
    if (config.BEDROCK_API_KEY && !env.AWS_BEARER_TOKEN_BEDROCK) {
      // Fallback alias — operator may have set BEDROCK_API_KEY (V0.8.0
      // shape) instead of AWS_BEARER_TOKEN_BEDROCK (Loa PR #662 shape).
      env.AWS_BEARER_TOKEN_BEDROCK = config.BEDROCK_API_KEY;
    }
    // Explicitly DELETE ANTHROPIC_API_KEY from the subprocess env so the
    // SDK doesn't accidentally route firstParty when bedrock is intended.
    // Bridgebuilder F3 (PR #11): setting to `undefined` is unreliable —
    // Node's child_process may inherit from parent. `delete` is the safe
    // pattern for env-var removal.
    delete env.ANTHROPIC_API_KEY;
  } else {
    env.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY!;
  }
  return env;
}

export async function runOrchestratorQuery(
  config: Config,
  req: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const backend = resolveOrchestratorBackend(config);

  // Per-backend preflight: anthropic needs ANTHROPIC_API_KEY; bedrock
  // needs AWS bearer token (or AWS creds for SigV4 fallback). Surface
  // the missing-credential failure mode loudly rather than silently
  // routing through with bad auth.
  if (backend === 'anthropic' && !config.ANTHROPIC_API_KEY) {
    throw new Error(
      'orchestrator: ANTHROPIC_API_KEY required for LLM_PROVIDER=anthropic. ' +
        'Set ANTHROPIC_API_KEY, switch LLM_PROVIDER to bedrock, or use stub/freeside.',
    );
  }
  if (
    backend === 'bedrock' &&
    !config.AWS_BEARER_TOKEN_BEDROCK &&
    !config.BEDROCK_API_KEY &&
    !process.env.AWS_ACCESS_KEY_ID
  ) {
    throw new Error(
      'orchestrator: Bedrock backend requires AWS_BEARER_TOKEN_BEDROCK ' +
        '(per Loa PR #662) OR AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (SigV4 fallback). ' +
        'None set — set credentials or switch LLM_PROVIDER.',
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
    model: resolveSdkModel(config, backend),
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
    env: buildSdkEnv(config, backend),
    stderr: (data) => {
      if (config.LOG_LEVEL === 'debug') {
        console.error(`[sdk] ${data.trimEnd()}`);
      }
    },
  };

  let text = '';
  let accumulatedAssistantText = '';
  let usage: Record<string, unknown> | undefined;
  const toolUses: ToolUseEvent[] = [];

  // V0.7-A.1 streaming refactor (pattern: ruggy-v2/src/agent.ts):
  // We previously skipped every event except `result.success`, which made
  // mid-flight tool_use blocks invisible. Now we extract tool_use AND text
  // from `assistant` messages so the dispatcher can surface tools to Discord
  // AND we have a fallback when `result.success.result` comes back empty
  // (observed on Bedrock-routed responses post-V0.11.1: SDK reports success
  // but the result field is empty even though the LLM produced text in
  // assistant turns · ruggy-v2 has shipped this fallback pattern for months).
  for await (const message of query({ prompt: req.userMessage, options })) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          // V0.11.2: accumulate text from each assistant turn (ruggy-v2 pattern).
          // The final synthesis turn lands here even when the SDK doesn't
          // populate `result.success.result` — Bedrock-routed responses
          // sometimes leave the result field empty.
          accumulatedAssistantText += block.text;
        } else if (block.type === 'tool_use') {
          const event: ToolUseEvent = {
            name: block.name,
            id: block.id,
            input: block.input,
          };
          toolUses.push(event);
          // Best-effort callback — caller errors don't break the SDK loop.
          try {
            req.onToolUse?.(event);
          } catch (err) {
            console.error(`orchestrator: onToolUse callback threw — ${err}`);
          }
        }
      }
      continue;
    }

    if (message.type !== 'result') continue;

    if (message.subtype === 'success') {
      text = message.result || '';
      usage = {
        duration_ms: message.duration_ms,
        duration_api_ms: message.duration_api_ms,
        num_turns: message.num_turns,
        total_cost_usd: message.total_cost_usd,
        tool_uses: toolUses.length,
        tool_names: toolUses.map((t) => t.name),
        ...message.usage,
      };
      break;
    }

    throw new Error(
      `orchestrator: SDK error subtype=${message.subtype}` +
        (message.errors?.length ? ` errors=${message.errors.join('; ')}` : ''),
    );
  }

  // V0.11.2: fallback chain. If the SDK's `result.success.result` came
  // back empty (observed on Bedrock-routed multi-tool responses), use the
  // text accumulated from assistant turns — that's where the LLM's actual
  // output lives. Only throw when BOTH paths produced nothing.
  if (!text && accumulatedAssistantText) {
    console.warn(
      `orchestrator: result.success.result was empty; falling back to ` +
        `accumulated assistant text (${accumulatedAssistantText.length} chars · ` +
        `${toolUses.length} tool_uses)`,
    );
    text = accumulatedAssistantText;
  }

  if (!text) {
    throw new Error(
      'orchestrator: SDK query completed without an assistant text response. ' +
        `tool_uses=${toolUses.length} accumulated_text_length=0. ` +
        'Likely causes: maxTurns hit before synthesis · model returned no text · ' +
        'Bedrock auth/model-ID mismatch.',
    );
  }

  return { text, meta: usage, toolUses };
}
