import type { Tracer } from '@opentelemetry/api';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { DigestSnapshot } from '../domain/digest-snapshot.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import { getTracer } from '../observability/otel-layer.ts';
import { invoke } from '../compose/agent-gateway.ts';
import { buildVoiceBrief, parseVoiceResponse } from '../compose/voice-brief.ts';
import { stripVoiceDisciplineDrift, escapeDiscordMarkdown } from '../deliver/sanitize.ts';

export function createClaudeSdkLive(
  config: Config,
  character: CharacterConfig,
  tracer: Tracer = getTracer(),
): VoiceGenPort {
  return {
    generateDigestVoice: (snapshot) =>
      tracer.startActiveSpan('voice.invoke', async (span) => {
        try {
          span.setAttribute('character.id', character.id);
          span.setAttribute('zone.id', snapshot.zone);
          const brief = buildVoiceBrief({
            zone: snapshot.zone,
            shape: snapshot.topFactors.length === 0 ? 'A-all-quiet' : 'B-one-dim-hot',
            isNoClaimVariant: false,
            permittedFactors: snapshot.topFactors
              .filter((factor) => factor.factorStats)
              .slice(0, 3)
              .map((factor) => ({
                display_name: factor.displayName,
                stats: factor.factorStats!,
              })),
            silencedFactors: [],
            totalEvents: snapshot.totalEvents,
            windowDays: snapshot.windowDays,
            previousPeriodEvents: snapshot.previousPeriodEvents,
          });
          const response = await invoke(config, {
            character,
            systemPrompt: brief.system,
            userMessage: brief.user,
            modelAlias: config.FREESIDE_AGENT_MODEL,
            zoneHint: snapshot.zone,
            postTypeHint: 'digest',
          });
          return sanitizeVoiceAugment(parseVoiceResponse(response.text));
        } catch (err) {
          span.recordException(err as Error);
          throw err;
        } finally {
          span.end();
        }
      }),
  };
}

function sanitizeVoiceAugment(augment: VoiceAugment): VoiceAugment {
  return {
    header: sanitizeVoiceLine(augment.header),
    outro: sanitizeVoiceLine(augment.outro),
  };
}

function sanitizeVoiceLine(line: string): string {
  if (!line) return '';
  return escapeDiscordMarkdown(
    stripVoiceDisciplineDrift(line, { postType: 'digest', mediumId: 'discord-webhook' }),
  );
}

