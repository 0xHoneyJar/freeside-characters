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

          // BB review F-006 (2026-05-16): shape derivation MUST match the
          // real `selectLayoutShape` gates (rank ≥ 90 + p95.reliable). Using
          // `topFactors.length > 0` as a proxy lied to the LLM — every non-
          // empty zone got `B-one-dim-hot` guidance, even when no factor was
          // substrate-licensed. Filter to TRULY permitted factors first,
          // then derive shape from THAT count.
          const permittedFactors = snapshot.topFactors
            .filter((factor) => {
              const stats = factor.factorStats;
              if (!stats) return false;
              const rank = stats.magnitude?.current_percentile_rank;
              const p95Reliable = stats.magnitude?.percentiles?.p95?.reliable;
              return rank !== null && rank !== undefined && rank >= 90 && p95Reliable === true;
            })
            .slice(0, 3)
            .map((factor) => ({
              display_name: factor.displayName,
              stats: factor.factorStats!,
            }));

          // Shape is now derived from the SAME data that licenses the LLM
          // narrative. No mismatch possible.
          const shape = permittedFactors.length === 0 ? 'A-all-quiet' : 'B-one-dim-hot';
          span.setAttribute('voice.shape', shape);
          span.setAttribute('voice.permitted_count', permittedFactors.length);

          const brief = buildVoiceBrief({
            zone: snapshot.zone,
            shape,
            isNoClaimVariant: false,
            permittedFactors,
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

