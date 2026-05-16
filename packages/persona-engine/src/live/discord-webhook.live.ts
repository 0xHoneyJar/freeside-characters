import type { DigestMessage } from '../domain/digest-message.ts';
import type { DigestPayload } from '../deliver/embed.ts';

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
