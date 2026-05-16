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

function plainToPayload(message: PlainMessage): DigestPayload {
  const factsLine = message.truthFields.join(' · ');
  const content = message.voiceContent
    ? [message.voiceContent, factsLine].filter(Boolean).join('\n')
    : factsLine;
  return { content, embeds: [] };
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
