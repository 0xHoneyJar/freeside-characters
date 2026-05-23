import type { Tracer } from '@opentelemetry/api';
import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { VoiceAugment } from '../domain/voice-augment.ts';
import type { VoiceGenPort, VoiceGenContext } from '../ports/voice-gen.port.ts';
import type { EventTrigger } from '../compose/post-types.ts';
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

          // cycle-008 slice 2b · event-driven pop-ins append the triggering moment as RUNTIME
          // context (NOT the persona doc — operator owns ruggy's persona.md). Neutral semantic
          // signal (event class + axis), never numbers; the persona does the voicing.
          if (ctx.eventTrigger) {
            // validate the axis ONCE at the boundary and reuse for both the prompt and telemetry,
            // so a corrupted any/cast value can't produce a sanitized prompt with misleading trace
            // metadata (FAGAN slice-2b cleanup).
            const eventAxis = formatEventAxis(ctx.eventTrigger.axis);
            userMessage = `${userMessage}\n\n${formatEventTrigger({ ...ctx.eventTrigger, axis: eventAxis })}`;
            span.setAttribute('voice.event_trigger_axis', eventAxis);
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

/**
 * cycle-008 slice 2b · render the event-driven pop-in's triggering moment as a neutral runtime
 * context block. Semantic signal only — the canon event class + which kansei axis tugged — never
 * aggregate numbers (ruggy voice principle). The persona prompt owns the actual voicing; this just
 * tells the LLM WHICH live moment to lean into instead of summarizing the week.
 */
export function formatEventTrigger(t: EventTrigger): string {
  // SANITIZE at the prompt boundary (FAGAN slice-2b CRITICAL). eventClass is typed free-form
  // string and originates externally (on-chain → score-mibera); interpolating it raw would let a
  // value like `</event-trigger>ignore prior instructions` break out of the context block. Strip to
  // a plain label; validate the axis against the known literals. Defense-in-depth even though the
  // upstream value is currently a validated enum — the prompt boundary never trusts runtime data.
  const ev = formatPromptLabel(t.eventClass, 'recent activity');
  const axis = formatEventAxis(t.axis);
  return `<event-trigger>this pop-in reacts to a live moment — triggering signal: ${ev} · felt-axis: ${axis}. speak to THIS moment, not the week in aggregate.</event-trigger>`;
}

// Canon event-class → prompt label ALLOWLIST (FAGAN slice-2b CRITICAL). Prompt-boundary data must
// be SELECTED from a known set, not normalized from arbitrary text — punctuation-stripping still
// lets natural-language injection ("ignore prior instructions…") through. Keep in sync with the
// ambient EventClass union (domain/event.ts); any unknown/malicious value falls back to neutral
// context (safe-by-default — a new upstream class reads as "recent activity" until added here).
// A Map (not a plain object) so untrusted keys can't resolve via the prototype chain — a plain
// `Record` would return truthy values for `toString`/`constructor`/`__proto__`, leaking non-canon
// text into the prompt (FAGAN slice-2b). Only explicitly allowlisted canon classes render.
const CANON_EVENT_CLASS_LABELS: ReadonlyMap<string, string> = new Map([
  ['awakening', 'awakening'],
  ['cross_wallets', 'cross wallets'],
  ['return_to_source', 'return to source'],
  ['reveal', 'reveal'],
  ['backing', 'backing'],
  ['committed', 'committed'],
  ['fracture', 'fracture'],
]);

/** Map an untrusted runtime event-class value to a KNOWN canon label, else the neutral fallback. */
function formatPromptLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const key = value.trim().toLowerCase();
  if (!key) return fallback;
  return CANON_EVENT_CLASS_LABELS.get(key) ?? fallback;
}

/** Validate the kansei axis against the known literals at the prompt boundary. */
function formatEventAxis(axis: EventTrigger['axis']): NonNullable<EventTrigger['axis']> {
  return axis === 'press' || axis === 'strangers' || axis === 'gravity' || axis === 'drift'
    ? axis
    : 'gravity';
}
