/**
 * Digest orchestrator (cycle-005 S5 · combines deferrals from S2/S3/S4).
 *
 * Pure function that composes one zone's digest payload using the
 * substrate-driven pipeline:
 *
 *   1. buildFactorStatsMap(dimension)        ← S1
 *   2. inspectProse(draft, map, factors)     ← S1
 *   3. selectLayoutShape(args)                ← S3
 *   4. branch on shape:
 *        A-all-quiet     → silence-register style + tally
 *        B-one-dim-hot   → buildPulseDimensionPayload for the hot dim
 *        C-multi-dim-hot → buildPulseDimensionPayload (NO-CLAIM variant
 *                          suppresses voice header/outro)
 *   5. each transform wrapped in OTEL child span of `chat.invoke` outer span
 *
 * V1 routing invariant: gate runs digest-only (NOT chat-mode). Chat-mode
 * skip is structural — `composeReplyWithEnrichment` does not call this
 * function.
 *
 * V1 contract: text returned to renderer is BYTE-IDENTICAL to LLM draft
 * regardless of gate violations (telemetry-only). Mode `skip` returns
 * `null` (caller drops the post). Mode `silence` forces shape A.
 */

import { SpanStatusCode, type Tracer, type Span } from '@opentelemetry/api';
import type {
  PulseDimensionBreakdown,
  ZoneId,
} from '../score/types.ts';
import {
  buildFactorStatsMap,
  inspectProse,
  resolveProseGateMode,
  draftHash,
  type ProseGateValidation,
  type ProseGateMode,
} from '../deliver/prose-gate.ts';
import {
  buildPulseDimensionPayload,
  type DigestPayload,
} from '../deliver/embed.ts';
import { moodEmojiForFactor } from '../deliver/mood-emoji.ts';
import {
  selectLayoutShape,
  isNoClaimVariant,
  type LayoutShape,
  type SelectLayoutShapeArgs,
} from './layout-shape.ts';
import { getTracer } from '../observability/otel-layer.ts';

const CHARACTER_ID = 'ruggy';

export interface ComposeDigestArgs {
  /** The zone receiving the post. */
  zone: ZoneId;
  /** Hot-dimension breakdown (from `get_dimension_breakdown` per cycle-005 r4 amendment: window=30 for dim-channels). */
  dimension: PulseDimensionBreakdown;
  /** All zone breakdowns (for layout shape selection). */
  allZones: ReadonlyMap<ZoneId, PulseDimensionBreakdown | undefined>;
  /** LLM-composed voice surface — pure caller-supplied. */
  voice: { header?: string; outro?: string };
  /** The full LLM draft (header + outro joined or otherwise constructed) — what the gate inspects. */
  draft: string;
  /** Optional override tracer (tests pass OtelTest's tracer). */
  tracer?: Tracer;
}

export interface ComposeDigestResult {
  /** The Discord payload OR null when mode=skip + HIGH violations. */
  payload: DigestPayload | null;
  /** The shape selected by `selectLayoutShape`. */
  shape: LayoutShape;
  /** The prose-gate validation produced by `inspectProse`. */
  validation: ProseGateValidation;
  /** Resolved mode at time of compose (log/skip/silence). */
  mode: ProseGateMode;
  /** True when shape is C and zero zones have permittedClaims (renderer suppresses voice). */
  isNoClaim: boolean;
}

/**
 * Compose one zone's digest payload + emit OTEL chat.invoke span tree.
 *
 * Spans emitted:
 *   chat.invoke (root)
 *     compose.translate-emoji   (placeholder for chat-mode parity; digest has no emoji translate)
 *     compose.prose-gate         (event: prose_gate.violation per HIGH violation)
 *     compose.select-layout      (attribute: shape)
 *     compose.build-payload      (attribute: layout_shape, no_claim_variant)
 *
 * Returns `null` payload when mode=skip + HIGH violations exist (caller
 * drops the post · OTEL event `prose_gate.zone_post_skipped` emitted).
 */
export function composeDigestForZone(args: ComposeDigestArgs): ComposeDigestResult {
  const tracer = args.tracer ?? getTracer();
  const draftHashed = draftHash(args.draft);

  return tracer.startActiveSpan(
    'chat.invoke',
    {
      attributes: {
        'character.id': CHARACTER_ID,
        'zone.id': args.zone,
        'draft.hash': draftHashed,
        'draft.len': args.draft.length,
      },
    },
    (rootSpan): ComposeDigestResult => {
      try {
        // 1. prose-gate (S1)
        const validation = withSpan(tracer, 'compose.prose-gate', { 'draft.hash': draftHashed }, () => {
          const { factorStatsByFactorId, factors } = buildFactorStatsMap(args.dimension);
          return inspectProse(args.draft, factorStatsByFactorId, factors).validation;
        });

        const mode = resolveProseGateMode();
        const highViolations = validation.violations.filter((v) => v.reason !== 'no-factor-context');

        // Emit prose_gate.violation as events on the root span (NFR-4 cardinality)
        if (highViolations.length > 0) {
          for (const v of highViolations) {
            rootSpan.addEvent('prose_gate.violation', {
              pattern: v.pattern,
              factor_id: v.factor_id ?? 'null',
              reason: v.reason,
              character_id: CHARACTER_ID,
              draft_hash: draftHashed,
              mode,
            });
          }
          console.warn(
            `[prose-gate] character=${CHARACTER_ID} mode=${mode} violations=${highViolations.length} draft_hash=${draftHashed}`,
          );
        }

        if (mode === 'skip' && highViolations.length > 0) {
          rootSpan.addEvent('prose_gate.zone_post_skipped', {
            zone: args.zone,
            draft_hash: draftHashed,
          });
          rootSpan.setStatus({ code: SpanStatusCode.OK });
          return {
            payload: null,
            shape: 'A-all-quiet',
            validation,
            mode,
            isNoClaim: false,
          };
        }

        // 2. layout-shape (S3)
        const layoutArgs = buildLayoutArgs(args);
        const shape = withSpan(tracer, 'compose.select-layout', {}, () => selectLayoutShape(layoutArgs));
        const noClaim = isNoClaimVariant(layoutArgs);
        rootSpan.setAttribute('layout.shape', shape);
        rootSpan.setAttribute('layout.no_claim', noClaim);

        // Silence-mode forces shape A (inline override · BB review F-005 2026-05-16: the
        // ProseGateOutcome envelope SDD originally specified was vestigial and got removed).
        const effectiveShape: LayoutShape =
          mode === 'silence' && highViolations.length > 0 ? 'A-all-quiet' : shape;
        if (effectiveShape !== shape) {
          rootSpan.addEvent('prose_gate.shape_a_fallback', { zone: args.zone, draft_hash: draftHashed });
        }

        // 3. build payload (S2 + S4 callers wired)
        const payload = withSpan(
          tracer,
          'compose.build-payload',
          { 'layout.shape': effectiveShape, 'layout.no_claim': noClaim },
          () => {
            if (effectiveShape === 'A-all-quiet') {
              return buildShapeAPayload(args);
            }
            // Shape B + C: deterministic card body + voice (suppressed in NO-CLAIM)
            const voiceOn = !noClaim;
            return buildPulseDimensionPayload(args.dimension, args.zone, 30, {
              moodEmoji: moodEmojiForFactor,
              proseGate: validation,
              ...(voiceOn && args.voice.header ? { header: args.voice.header } : {}),
              ...(voiceOn && args.voice.outro ? { outro: args.voice.outro } : {}),
            });
          },
        );

        if (noClaim) {
          rootSpan.addEvent('prose_gate.zone_data_no_voice', {
            zone: args.zone,
            draft_hash: draftHashed,
          });
        }

        rootSpan.setStatus({ code: SpanStatusCode.OK });
        return {
          payload,
          shape: effectiveShape,
          validation,
          mode,
          isNoClaim: noClaim,
        };
      } catch (err) {
        rootSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        rootSpan.end();
      }
    },
  );
}

/**
 * Build `selectLayoutShape` args from the per-zone breakdown map. Each
 * zone's `permittedClaims` is currently a derived count (sum of factors
 * with rank ≥ 90 + reliable percentile) — V1 placeholder until score-
 * mibera ships an explicit "permission" envelope. The function is pure
 * + testable independent of the substrate.
 */
function buildLayoutArgs(args: ComposeDigestArgs): SelectLayoutShapeArgs {
  const zones: ZoneId[] = [];
  const permittedClaimsByZone = new Map<ZoneId, number>();
  const topRankByZone = new Map<ZoneId, number | null>();
  const totalEventsByZone = new Map<ZoneId, number>();
  for (const [zone, dim] of args.allZones) {
    zones.push(zone);
    if (!dim) {
      permittedClaimsByZone.set(zone, 0);
      topRankByZone.set(zone, null);
      totalEventsByZone.set(zone, 0);
      continue;
    }
    const topRank =
      dim.top_factors[0]?.factor_stats?.magnitude?.current_percentile_rank ?? null;
    const permitted = dim.top_factors.filter(
      (f) =>
        (f.factor_stats?.magnitude?.current_percentile_rank ?? 0) >= 90 &&
        f.factor_stats?.magnitude?.percentiles?.p95?.reliable === true,
    ).length;
    permittedClaimsByZone.set(zone, permitted);
    topRankByZone.set(zone, topRank);
    totalEventsByZone.set(zone, dim.total_events);
  }
  return { zones, permittedClaimsByZone, topRankByZone, totalEventsByZone };
}

/**
 * Shape-A renderer: minimal payload with no card body. Voice surface
 * (header/outro) is the entire post. V1 lands the simple form; the
 * silence-register module (`expression/silence-register.ts`) is the
 * S5/V1.5 wire-point for richer "italicized stage direction" rendering.
 */
function buildShapeAPayload(args: ComposeDigestArgs): DigestPayload {
  const descParts: string[] = [];
  if (args.voice.header) descParts.push(args.voice.header);
  if (args.voice.outro) descParts.push(args.voice.outro);
  return {
    content: `[${args.zone}] quiet week`,
    embeds: [
      {
        ...(descParts.length > 0 ? { description: descParts.join('\n') } : {}),
      },
    ],
  };
}

/**
 * Helper: wrap a synchronous function in an OTEL span. Records exceptions,
 * sets status, ends the span automatically.
 */
function withSpan<T>(
  tracer: Tracer,
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => T,
): T {
  return tracer.startActiveSpan(name, { attributes }, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
