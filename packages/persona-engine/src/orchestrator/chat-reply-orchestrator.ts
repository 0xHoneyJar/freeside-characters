// cycle-006 S5 T5.4 · chat-reply orchestrator.
//
// BB design-review F-002 closure: this file STRUCTURALLY does NOT import
// `ProseGatePort` or `prose-gate`. V1 routing invariant ("prose-gate is
// digest-only") becomes a file-boundary fact, not a config flip. Any future
// V1.5 promotion is a real architecture change, not a null-adapter swap.
//
// Red Team AC-RT-007 foundation: composeChatReply takes `guildId` as a
// required argument so downstream voice-memory wiring (S6) uses the
// (guildId, channelId, userId) 3-tuple key. The signature itself is the
// foundation; schema enforcement on VoiceMemoryEntry lands in S6.
//
// S5 implementation strategy: this orchestrator delegates to the existing
// `composeReplyWithEnrichment` for the LLM-call mechanics + grail-ref guard
// + image attachment logic (cycle-005 behavior). S6 wires voice-memory into
// the orchestrator. The legacy `composeReplyWithEnrichment` is retained as
// the implementation surface; this orchestrator is the new ENTRY POINT that
// dispatch.ts will migrate to.

import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ChatReplyMessage } from '../domain/chat-reply-message.ts';
import {
  composeReplyWithEnrichment,
  type ReplyComposeArgs,
  type EnrichedReplyResult,
} from '../compose/reply.ts';

export interface ChatReplyArgs {
  /** Guild context — REQUIRED for AC-RT-007 tuple-key construction in S6. */
  readonly guildId: string;
  /** Discord channel ID. */
  readonly channelId: string;
  /** Discord user ID (the requester). */
  readonly userId: string;
  /** User prompt text. */
  readonly prompt: string;
}

export interface ChatReplyResult {
  readonly message: ChatReplyMessage;
  /** Pass-through of cycle-005 EnrichedReplyResult fields callers may need. */
  readonly enriched: EnrichedReplyResult;
}

export async function composeChatReply(
  config: Config,
  character: CharacterConfig,
  args: ChatReplyArgs,
): Promise<ChatReplyResult | null> {
  // S5: delegate to cycle-005 composeReplyWithEnrichment for the LLM call +
  // grail-ref guard + image attachment. S6 wires voice-memory read/write
  // around this delegation using keyForChatReply(guildId, channelId, userId).
  const replyArgs: ReplyComposeArgs = {
    config,
    character,
    channelId: args.channelId,
    userId: args.userId,
    userMessage: args.prompt,
  } as unknown as ReplyComposeArgs;

  const enriched = await composeReplyWithEnrichment(replyArgs);
  if (!enriched) return null;

  const message: ChatReplyMessage = {
    voiceContent: enriched.content,
    files: enriched.payload.files,
    cacheHits: enriched.payload.cacheHits,
  };
  return { message, enriched };
}
