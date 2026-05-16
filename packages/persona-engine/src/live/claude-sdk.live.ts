import type { Tracer } from '@opentelemetry/api';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { VoiceGenPort, VoiceGenContext } from '../ports/voice-gen.port.ts';
import { getTracer } from '../observability/otel-layer.ts';
import { invoke } from '../compose/agent-gateway.ts';
import { buildVoiceBrief, parseVoiceResponse } from '../compose/voice-brief.ts';
import { stripVoiceDisciplineDrift, escapeDiscordMarkdown } from '../deliver/sanitize.ts';
import { UNTRUSTED_CONTENT_LLM_INSTRUCTION } from '../orchestrator/format-prior-week-hint.ts';

export function createClaudeSdkLive(
  config: Config,
  character: CharacterConfig,
  tracer: Tracer = getTracer(),
): VoiceGenPort {
  return {
    generateDigestVoice: (snapshot, ctx: VoiceGenContext) =>
      tracer.startActiveSpan('voice.invoke', async (span) => {
        try {
          span.setAttribute('character.id', character.id);
          span.setAttribute('zone.id', snapshot.zone);
          span.setAttribute('voice.shape', ctx.derived.shape);
          span.setAttribute('voice.permitted_count', ctx.derived.permittedFactors.length);
          span.setAttribute('voice.is_no_claim_variant', ctx.derived.isNoClaimVariant);

          // cycle-006 S1 T1.6 · shape derivation moved upstream to orchestrator
          // (BB design-review F-001 closure · `deriveShape` is now the single
          // canonical source). claude-sdk.live.ts is a pure consumer of ctx.

          const brief = buildVoiceBrief({
            zone: snapshot.zone,
            shape: ctx.derived.shape,
            isNoClaimVariant: ctx.derived.isNoClaimVariant,
            permittedFactors: ctx.derived.permittedFactors.map((f) => ({
              display_name: f.displayName,
              stats: f.stats,
            })),
            silencedFactors: ctx.derived.silencedFactors.map((f) => ({
              display_name: f.displayName,
              reason: f.reason,
            })),
            totalEvents: snapshot.totalEvents,
            windowDays: snapshot.windowDays,
            previousPeriodEvents: snapshot.previousPeriodEvents,
          });

          // FLATLINE-SKP-001/CRITICAL · cycle-006 sprint review.
          // System prompt MUST contain the verbatim instruction telling the LLM
          // to treat <untrusted-content> markers as inert descriptive context.
          // Without this instruction, the markers in ctx.priorWeekHint are
          // convention only — the model may still follow injected instructions.
          const systemPrompt = `${brief.system}\n\n${UNTRUSTED_CONTENT_LLM_INSTRUCTION}`;

          const userMessage = ctx.priorWeekHint
            ? `${brief.user}\n\n${ctx.priorWeekHint}`
            : brief.user;

          const response = await invoke(config, {
            character,
            systemPrompt,
            userMessage,
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
