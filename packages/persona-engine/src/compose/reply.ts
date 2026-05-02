/**
 * Reply composer (V0.7-A.0 + V0.7-A.1 Phase D) — slash-command chat-mode pipeline.
 *
 * Mirror of `composeForCharacter` for conversational replies. The substrate
 * supplies plumbing (ledger snapshot, env context, prompt build, LLM call,
 * chunk split); the character supplies voice via persona.md.
 *
 * Civic-layer note: this is a SUBSTRATE-level composer. It speaks Discord
 * shape (chunks, character limits) and persona-engine shape (config,
 * CharacterConfig, LedgerEntry) — never both. Characters consume the
 * result through `apps/bot/src/discord-interactions/dispatch.ts`.
 *
 * V0.7-A.0 invariants honored:
 *   - No memory primitive — ledger is in-process per channel only.
 *   - No persistent state — restart loses ledger by design.
 *   - Voice fidelity preserved via persona template + chat-mode override.
 *
 * V0.7-A.1 Phase D — chat-mode tool surface (closes the operator's
 * "ChatGPT-natural tool use" gap):
 *   - With `CHAT_MODE=orchestrator|auto` and LLM_PROVIDER=anthropic:
 *     route through `runOrchestratorQuery` with the character's declared
 *     `mcps` scope. Per-character MCP isolation: ruggy gets score+codex+
 *     emojis+rosenzu+freeside_auth; satoshi gets codex+imagegen.
 *   - With `CHAT_MODE=naive` OR a non-anthropic provider: keep the V0.7-A.0
 *     `invokeChat()` single-turn path (no MCPs, no tools).
 *   - The environment-context block (`compose/environment.ts`) is built
 *     and substituted into the prompt pair regardless of routing — same
 *     `## Environment` grounding lands either way.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import { buildReplyPromptPair } from '../persona/loader.ts';
import {
  buildEnvironmentContext,
  type RecentMessage,
} from './environment.ts';
import { runOrchestratorQuery, type ToolUseEvent } from '../orchestrator/index.ts';
import {
  appendToLedger,
  getLedgerSnapshot,
  type LedgerEntry,
} from '../conversation/ledger.ts';

export interface ReplyComposeArgs {
  config: Config;
  character: CharacterConfig;
  /** The user's message text (the slash-command `prompt:` option). */
  prompt: string;
  /** Discord channel id where the slash was invoked. */
  channelId: string;
  /**
   * V0.7-A.1: codex zone resolved by the caller (apps/bot dispatcher
   * resolves channelId→zone via `getZoneForChannel`). Undefined when the
   * channel is outside the four codex-mapped zones (DM, etc.) — the
   * environment block falls back to the "outside the codex-mapped zones"
   * line and skips the room-read line.
   */
  zone?: ZoneId;
  /**
   * V0.7-A.1: other characters loaded into the same Discord shell process
   * (caller's CHARACTERS env split, minus self). Surfaces as the "Other
   * characters present" line when non-empty.
   */
  otherCharactersHere?: string[];
  /** Discord user id of the invoker (stored in ledger for transcript). */
  authorId: string;
  /** Discord username (or display name) of the invoker. */
  authorUsername: string;
  /**
   * V0.7-A.1: optional callback fired when the LLM emits a `tool_use` block
   * during chat-mode orchestrator round-trips. The dispatcher uses this to
   * PATCH the deferred Discord message with progress ("🔧 pulling X…").
   * No-op when the chat path resolves to naive (no tools available).
   */
  onToolUse?: (event: ToolUseEvent) => void;
  options?: {
    /** How many recent ledger entries to feed the prompt. Default 10. */
    historyDepth?: number;
    /** For telemetry only — actual ephemeral flag handled by dispatch. */
    ephemeral?: boolean;
  };
}

export interface ReplyComposeResult {
  /** The full reply text (pre-split). */
  content: string;
  /** Pre-split chunks, each ≤ 2000 chars (Discord message limit). */
  chunks: string[];
  contextUsed: {
    ledgerSize: number;
    promptTokens?: number;
    durationMs: number;
  };
}

const DISCORD_CHAR_LIMIT = 2000;
const DEFAULT_HISTORY_DEPTH = 10;

export async function composeReply(
  args: ReplyComposeArgs,
): Promise<ReplyComposeResult | null> {
  const t0 = Date.now();
  const historyDepth = args.options?.historyDepth ?? DEFAULT_HISTORY_DEPTH;
  const history = getLedgerSnapshot(args.channelId, historyDepth);

  // V0.7-A.1 Phase D: build the environment-context block from the resolved
  // zone + ledger snapshot. Empty string when nothing useful to say (no
  // zone + no tool guidance + no presence) — substitution is a no-op.
  const recentMessages: RecentMessage[] = history.map((h) => ({
    authorUsername: h.authorUsername,
    content: h.content,
    timestampMs: h.timestamp ? Date.parse(h.timestamp) : undefined,
  }));
  const environmentContext = buildEnvironmentContext({
    character: args.character,
    zone: args.zone,
    recentMessages,
    otherCharactersHere: args.otherCharactersHere,
  });

  const { systemPrompt, userMessage } = buildReplyPromptPair({
    character: args.character,
    prompt: args.prompt,
    authorUsername: args.authorUsername,
    history: history.map((h) => ({
      role: h.role,
      authorUsername: h.authorUsername,
      content: h.content,
    })),
    environmentContext,
  });

  // Routing decision: orchestrator (full MCP scope) vs naive (V0.7-A.0
  // single-turn). Decided per call by `CHAT_MODE` + provider resolution.
  const replyText = (await routeChatLLM(args.config, {
    character: args.character,
    systemPrompt,
    userMessage,
    zone: args.zone,
    onToolUse: args.onToolUse,
  })) ?? '';

  if (!replyText || replyText.trim().length === 0) {
    return null;
  }

  const trimmed = replyText.trim();
  const chunks = splitForDiscord(trimmed, DISCORD_CHAR_LIMIT);

  // Ledger discipline: append BOTH the user message AND the character
  // reply, in order. Future invocations in the same channel see this as
  // shared context. The ledger entry stores the FULL reply (not chunks)
  // so transcript rendering doesn't repeat the split.
  const nowIso = new Date().toISOString();
  const userEntry: LedgerEntry = {
    role: 'user',
    content: args.prompt.trim(),
    authorId: args.authorId,
    authorUsername: args.authorUsername,
    timestamp: nowIso,
  };
  const characterEntry: LedgerEntry = {
    role: 'character',
    content: trimmed,
    characterId: args.character.id,
    authorId: args.character.id,
    authorUsername: args.character.displayName ?? args.character.id,
    timestamp: new Date().toISOString(),
  };
  appendToLedger(args.channelId, userEntry);
  appendToLedger(args.channelId, characterEntry);

  return {
    content: trimmed,
    chunks,
    contextUsed: {
      ledgerSize: history.length,
      durationMs: Date.now() - t0,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// Chat-mode LLM routing (V0.7-A.1 Phase D)
// ──────────────────────────────────────────────────────────────────────

interface ChatInvokeArgs {
  character: CharacterConfig;
  systemPrompt: string;
  userMessage: string;
  /** Optional resolved zone — passed through to orchestrator for telemetry. */
  zone?: ZoneId;
  /** V0.7-A.1: tool_use stream callback (orchestrator path only). */
  onToolUse?: (event: ToolUseEvent) => void;
}

/**
 * Decide whether chat-mode flows through the orchestrator (with the
 * character's per-character MCP scope) or the naive `invokeChat()` path.
 *
 *   CHAT_MODE=naive          — always naive
 *   CHAT_MODE=orchestrator   — always orchestrator (errors if not SDK-eligible)
 *   CHAT_MODE=auto (default) — orchestrator when provider is SDK-eligible
 *                              (anthropic OR bedrock); naive for stub/freeside
 *
 * V0.11.1: bedrock is now SDK-eligible. The orchestrator's `buildSdkEnv`
 * sets CLAUDE_CODE_USE_BEDROCK=1 + AWS bearer token when LLM_PROVIDER=bedrock,
 * and the Anthropic Agent SDK routes through Bedrock with full tool support
 * via inference profile model IDs (per Loa PR #662). This unblocks chat-mode
 * tool calling for the operator's Bedrock-backed Opus 4.7 deployment.
 */
export function shouldUseOrchestrator(config: Config): boolean {
  if (config.CHAT_MODE === 'naive') return false;
  if (config.CHAT_MODE === 'orchestrator') return true;
  // auto: orchestrator when provider is SDK-eligible (anthropic OR bedrock).
  const provider = resolveChatProvider(config);
  return provider === 'anthropic' || provider === 'bedrock';
}

/**
 * Top-level chat-mode router. Branches between orchestrator (full per-
 * character MCP scope, multi-turn) and naive (single-turn, no tools).
 *
 * V0.10.2: chat-route telemetry per session-09 codex-rescue recommendation
 * (`grimoires/loa/specs/kickoff-tool-call-faking-investigation-2026-05-02.md`).
 * One log line per chat surfaces (a) which path we resolved to, (b) the
 * provider resolution, (c) the character's `mcps` scope. If `useOrchestrator`
 * is `false` in production, the LLM is faking tool calls because the SDK has
 * no tools wired (naive path). That confirms H2 (provider routing) — the
 * top-priority hypothesis post codex review.
 */
async function routeChatLLM(config: Config, req: ChatInvokeArgs): Promise<string> {
  const useOrchestrator = shouldUseOrchestrator(config);
  console.warn('[chat-route]', {
    character: req.character.id,
    chatMode: config.CHAT_MODE,
    llmProvider: config.LLM_PROVIDER,
    resolvedProvider: resolveChatProvider(config),
    useOrchestrator,
    mcps: req.character.mcps,
  });

  if (useOrchestrator) {
    const result = await runOrchestratorQuery(config, {
      character: req.character,
      systemPrompt: req.systemPrompt,
      userMessage: req.userMessage,
      zone: req.zone,
      postType: 'chat',
      onToolUse: req.onToolUse,
    });
    return result.text;
  }
  // Naive path has no tools wired — onToolUse is a no-op for this branch.
  return invokeChat(config, req);
}

async function invokeChat(config: Config, req: ChatInvokeArgs): Promise<string> {
  // Provider resolution mirrors agent-gateway.ts but for chat-mode the
  // anthropic path is the canonical one. Stub returns a canned in-voice
  // reply; freeside path uses the gateway's chat shape; bedrock path is
  // Eileen's satoshi setup (in-flight at apps/character-satoshi/...).
  switch (resolveChatProvider(config)) {
    case 'anthropic':
      return invokeChatAnthropicSdk(config, req);
    case 'stub':
      return invokeChatStub(req);
    case 'freeside':
      return invokeChatFreeside(config, req);
    case 'bedrock':
      return invokeChatBedrock(config, req);
  }
}

export type ChatProvider = 'stub' | 'anthropic' | 'freeside' | 'bedrock';

export function resolveChatProvider(config: Config): ChatProvider {
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
        throw new Error('LLM_PROVIDER=bedrock but AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY is unset');
      }
      return 'bedrock';
    case 'auto':
      if (config.ANTHROPIC_API_KEY) return 'anthropic';
      if (config.STUB_MODE) return 'stub';
      if (config.FREESIDE_API_KEY) return 'freeside';
      if (config.BEDROCK_API_KEY) return 'bedrock';
      throw new Error('LLM_PROVIDER=auto: no chat provider available');
  }
}

async function invokeChatAnthropicSdk(
  config: Config,
  req: ChatInvokeArgs,
): Promise<string> {
  // Single-turn chat shape: no MCP servers, no allowed tools, no skills.
  // Subprocess env scrubbed of CLAUDECODE_* so the SDK uses direct
  // Anthropic auth (mirrors orchestrator/index.ts buildSdkEnv).
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_') || k === 'CLAUDECODE' || k === 'CLAUDE_PLUGIN_DATA') {
      continue;
    }
    env[k] = v;
  }
  env.ANTHROPIC_API_KEY = config.ANTHROPIC_API_KEY!;

  const options: Options = {
    systemPrompt: req.systemPrompt,
    model: config.ANTHROPIC_MODEL,
    mcpServers: {},
    allowedTools: [],
    permissionMode: 'dontAsk',
    settingSources: [],
    tools: [],
    maxTurns: 1,
    effort: 'low',
    env,
    stderr: (data) => {
      if (config.LOG_LEVEL === 'debug') {
        console.error(`[sdk:chat] ${data.trimEnd()}`);
      }
    },
  };

  let text = '';
  for await (const message of query({ prompt: req.userMessage, options })) {
    if (message.type !== 'result') continue;
    if (message.subtype === 'success') {
      text = message.result;
      break;
    }
    throw new Error(
      `composeReply: SDK chat error subtype=${message.subtype}` +
        (message.errors?.length ? ` errors=${message.errors.join('; ')}` : ''),
    );
  }
  return text;
}

async function invokeChatBedrock(config: Config, req: ChatInvokeArgs): Promise<string> {
  const apiKey = config.AWS_BEARER_TOKEN_BEDROCK || config.BEDROCK_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_PROVIDER=bedrock but AWS_BEARER_TOKEN_BEDROCK or BEDROCK_API_KEY is unset');
  }

  const region = config.BEDROCK_TEXT_REGION || config.AWS_REGION;
  const modelId = config.BEDROCK_TEXT_MODEL_ID;
  if (!modelId) {
    throw new Error('LLM_PROVIDER=bedrock but BEDROCK_TEXT_MODEL_ID is unset');
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
    throw new Error(`bedrock chat error: ${response.status} ${await response.text()}`);
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
    throw new Error(`bedrock chat returned no text: ${JSON.stringify(data)}`);
  }

  return text;
}

async function invokeChatFreeside(
  config: Config,
  req: ChatInvokeArgs,
): Promise<string> {
  const url = `${config.FREESIDE_BASE_URL}/api/agents/invoke`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.FREESIDE_API_KEY && { 'x-api-key': config.FREESIDE_API_KEY }),
    },
    body: JSON.stringify({
      agent: 'default',
      modelAlias: config.FREESIDE_AGENT_MODEL,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userMessage },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`freeside agent-gateway chat error: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}

function invokeChatStub(req: ChatInvokeArgs): string {
  // Voice-shaped canned replies — keeps STUB_MODE smoke testing meaningful
  // (operators can verify the dispatch + ledger + chunk pipeline without
  // burning Anthropic credits or risking voice drift in tests).
  const id = req.character.id;
  if (id === 'satoshi') {
    return 'the ledger acknowledges stub mode. attention is the asset; you brought yours. that is the relevant transaction.';
  }
  if (id === 'ruggy') {
    return [
      'yo, ruggy here, stub-mode (no llm wired).',
      ``,
      `you said: "${truncate(req.userMessage, 120)}"`,
      ``,
      `wire ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic to get the real voice. stay groovy.`,
    ].join('\n');
  }
  return `[stub reply from ${req.character.displayName ?? req.character.id}]`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// ──────────────────────────────────────────────────────────────────────
// Chunk splitting (Discord 2000-char message limit)
// ──────────────────────────────────────────────────────────────────────

/**
 * Split content into Discord-safe chunks, preferring natural break points.
 * Order: paragraph (\n\n) → line (\n) → sentence (. ) → word ( ) → hard cut.
 *
 * Pattern source: `~/Documents/GitHub/ruggy-moltbot/src/handlers/chat.ts:192-238`
 * (splitLongMessage). Same shape, no functional changes.
 */
export function splitForDiscord(content: string, maxLength: number): string[] {
  if (content.length <= maxLength) return [content];

  const out: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      out.push(remaining);
      break;
    }

    let splitAt = maxLength;
    const paragraph = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraph > maxLength * 0.5) {
      splitAt = paragraph + 2;
    } else {
      const line = remaining.lastIndexOf('\n', maxLength);
      if (line > maxLength * 0.5) {
        splitAt = line + 1;
      } else {
        const sentence = remaining.lastIndexOf('. ', maxLength);
        if (sentence > maxLength * 0.5) {
          splitAt = sentence + 2;
        } else {
          const word = remaining.lastIndexOf(' ', maxLength);
          if (word > maxLength * 0.5) {
            splitAt = word + 1;
          }
        }
      }
    }

    out.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  // Filter empty chunks — whitespace-only LLM output or trim-on-boundary
  // edge cases can yield empty strings, which Discord rejects with 400
  // (bridgebuilder F10 2026-04-30).
  return out.filter((c) => c.length > 0);
}
