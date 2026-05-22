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
// cycle-008 T3.3 · canonical cron voice path (buildPrompt · persona.md).
import { Effect } from 'effect';
import { parsePromptBuilder } from '../config.ts';
import { buildPrompt, BuildPromptError } from '../persona/loader.ts';

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

          // cycle-008 T3.2/T3.3 · select the cron voice builder. Default-legacy
          // keeps production on buildVoiceBrief until the operator opts in.
          const builder = parsePromptBuilder(config.LOA_PROMPT_BUILDER);
          span.setAttribute('voice.prompt_builder', builder);

          let systemPrompt: string;
          let userMessage: string;

          if (builder === 'canonical') {
            // T3.3 · canonical path — buildPrompt(persona.md). Active factors
            // sourced from snapshot.topFactors (the unfiltered factor_trends
            // surface · NOT cycle-005-gated permittedFactors). priorWeekHint
            // flows INTO buildPrompt ({{PRIOR_WEEK_HINT}} placeholder). The
            // systemPrompt is used directly — buildPrompt's template owns the
            // untrusted-content instruction (mirrors compose/reply.ts; no append).
            const built = await Effect.runPromise(
              buildPrompt({
                character,
                shape: {
                  kind: 'cron',
                  zoneId: snapshot.zone,
                  postType: ctx.postType ?? 'micro',
                },
                activeFactors: snapshot.topFactors.map((f) => ({ displayName: f.displayName })),
                priorWeekHint: ctx.priorWeekHint ?? '',
              }).pipe(
                Effect.tapError((err) =>
                  Effect.sync(() => {
                    if (err instanceof BuildPromptError) {
                      span.setAttribute(
                        'voice.build_prompt_error',
                        `${BuildPromptError.categoryFor(err.kind)}:${err.kind}`,
                      );
                      console.error(
                        `[voice] BuildPromptError category=${BuildPromptError.categoryFor(err.kind)} kind=${err.kind}`,
                        err.detail ?? '',
                      );
                    }
                  }),
                ),
              ),
            );
            systemPrompt = built.systemPrompt;
            userMessage = built.userMessage;
          } else {
            // legacy path (default · prod-safe) — engineering-prose buildVoiceBrief.
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
            // FLATLINE-SKP-001/CRITICAL · cycle-006 sprint review. System prompt
            // MUST contain the verbatim instruction telling the LLM to treat
            // <untrusted-content> markers as inert. (Canonical path gets this
            // from the persona.md template instead.)
            systemPrompt = `${brief.system}\n\n${UNTRUSTED_CONTENT_LLM_INSTRUCTION}`;
            userMessage = ctx.priorWeekHint
              ? `${brief.user}\n\n${ctx.priorWeekHint}`
              : brief.user;
          }

          const response = await invoke(config, {
            character,
            systemPrompt,
            userMessage,
            modelAlias: config.FREESIDE_AGENT_MODEL,
            zoneHint: snapshot.zone,
            postTypeHint: ctx.postType ?? 'digest',
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
