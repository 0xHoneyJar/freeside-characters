import type { DigestMessage } from '../domain/digest-message.ts';
import type { DigestPayload } from '../deliver/embed.ts';
import type {
  MicroMessage,
  LoreDropMessage,
  QuestionMessage,
  WeaverMessage,
  CalloutMessage,
  PlainMessage,
  EmbedMessage,
} from '../domain/post-messages.ts';

export function toDigestPayload(message: DigestMessage): DigestPayload {
  return {
    content: message.voiceContent,
    embeds: [
      {
        color: message.truthEmbed.color,
        fields: message.truthEmbed.fields.map((field) => ({ ...field })),
        ...(message.truthEmbed.footer ? { footer: message.truthEmbed.footer } : {}),
      },
    ],
  };
}

// cycle-006 S3 · per-post-type webhook mappers. Embed-less variants (micro,
// lore_drop, question) join voice + facts into message.content (no embeds[]).
// Embed-bearing variants (weaver, callout) follow toDigestPayload pattern.

/**
 * cycle-008 T3.9 · two-beat delivery. Beat 1 = the agent voice (`voiceContent`).
 * Beat 2 = the data billboard (`truthFields`), each line BOLD. The two ship as
 * SEPARATE Discord messages (via `DigestPayload.secondary`) so voice and
 * substrate read as distinct surfaces — not the muddy middle that "reads too bot".
 *
 * Bold is per-line (`**…**`) because markdown bold does not span newlines; the
 * U+2007 figure-space column alignment baked into `truthFields` by
 * `buildSubstrateFacts` survives inside bold (figure-space is digit-width there
 * too). NOT a code block — code blocks ignore `**bold**`, and bold was the
 * explicit operator ask.
 *
 * `content` is ALWAYS populated (Discord-as-Material fallback): when voice is
 * absent the billboard becomes the primary single message (no `secondary`).
 */
function plainToPayload(message: PlainMessage): DigestPayload {
  const billboard = message.truthFields
    .filter((line) => line.length > 0)
    .map((line) => `**${line}**`)
    .join('\n');
  if (!message.voiceContent) {
    return { content: billboard || '·', embeds: [] };
  }
  return {
    content: message.voiceContent,
    embeds: [],
    secondary: { content: billboard, embeds: [] },
  };
}

function embedToPayload(message: EmbedMessage): DigestPayload {
  return {
    content: message.voiceContent,
    embeds: [
      {
        color: message.truthEmbed.color,
        fields: message.truthEmbed.fields.map((field) => ({ ...field })),
        ...(message.truthEmbed.footer ? { footer: message.truthEmbed.footer } : {}),
      },
    ],
  };
}

export function toMicroPayload(message: MicroMessage): DigestPayload {
  return plainToPayload(message);
}

export function toLoreDropPayload(message: LoreDropMessage): DigestPayload {
  return plainToPayload(message);
}

export function toQuestionPayload(message: QuestionMessage): DigestPayload {
  return plainToPayload(message);
}

export function toWeaverPayload(message: WeaverMessage): DigestPayload {
  return embedToPayload(message);
}

export function toCalloutPayload(message: CalloutMessage): DigestPayload {
  return embedToPayload(message);
}

// cycle-006 S5 · chat-reply payload mapper. Text-only path (no embed)
// since interaction surfaces render plain content. Files/attachments
// flow through the EnrichedPayload upstream; this mapper is a thin
// projection of voiceContent → content.
import type { ChatReplyMessage } from '../domain/chat-reply-message.ts';

export function toChatReplyPayload(message: ChatReplyMessage): DigestPayload {
  return { content: message.voiceContent, embeds: [] };
}
