/**
 * Reply composer (V0.7-A.0) — slash-command chat-mode pipeline.
 *
 * Mirror of `composeForCharacter` for conversational replies. The substrate
 * supplies plumbing (ledger snapshot, prompt build, LLM call, chunk split);
 * the character supplies voice via persona.md.
 *
 * Civic-layer note: this is a SUBSTRATE-level composer. It speaks Discord
 * shape (chunks, character limits) and persona-engine shape (config,
 * CharacterConfig, LedgerEntry) — never both. Characters consume the
 * result through `apps/bot/src/discord-interactions/dispatch.ts`.
 *
 * V0.7-A.0 invariants honored:
 *   - No tool calls (mcpServers = {}, allowedTools = [], maxTurns: 1).
 *   - No memory primitive — ledger is in-process per channel only.
 *   - No persistent state — restart loses ledger by design.
 *   - Voice fidelity preserved via persona template + chat-mode override.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import { buildReplyPromptPair } from '../persona/loader.ts';
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
  /** Discord user id of the invoker (stored in ledger for transcript). */
  authorId: string;
  /** Discord username (or display name) of the invoker. */
  authorUsername: string;
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

  const { systemPrompt, userMessage } = buildReplyPromptPair({
    character: args.character,
    prompt: args.prompt,
    authorUsername: args.authorUsername,
    history: history.map((h) => ({
      role: h.role,
      authorUsername: h.authorUsername,
      content: h.content,
    })),
  });

  const replyText = await invokeChat(args.config, {
    character: args.character,
    systemPrompt,
    userMessage,
  });

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
// Chat-mode LLM invocation (single-turn, no MCPs, no tools)
// ──────────────────────────────────────────────────────────────────────

interface ChatInvokeArgs {
  character: CharacterConfig;
  systemPrompt: string;
  userMessage: string;
}

async function invokeChat(config: Config, req: ChatInvokeArgs): Promise<string> {
  // Provider resolution mirrors agent-gateway.ts but for chat-mode the
  // anthropic path is the canonical one. Stub returns a canned in-voice
  // reply; freeside path uses the gateway's chat shape.
  switch (resolveChatProvider(config)) {
    case 'anthropic':
      return invokeChatAnthropicSdk(config, req);
    case 'stub':
      return invokeChatStub(req);
    case 'freeside':
      return invokeChatFreeside(config, req);
  }
}

type ChatProvider = 'stub' | 'anthropic' | 'freeside';

function resolveChatProvider(config: Config): ChatProvider {
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
    case 'auto':
      if (config.ANTHROPIC_API_KEY) return 'anthropic';
      if (config.STUB_MODE) return 'stub';
      if (config.FREESIDE_API_KEY) return 'freeside';
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
    return 'the ledger acknowledges. attention is the asset; you brought yours. that is the relevant transaction.';
  }
  if (id === 'ruggy') {
    return [
      'yo — ruggy here, stub-mode (no llm wired).',
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

  return out;
}
