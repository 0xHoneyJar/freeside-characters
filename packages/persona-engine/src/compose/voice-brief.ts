/**
 * Voice brief composer (cycle-005 T2.4 · authored 2026-05-16 · the missing piece).
 *
 * Constructs the LLM prompt that generates ruggy's 1-line header + 1-line
 * outro per FR-1. Voice is "seasoning" — 5-15% of post pixels. The
 * deterministic card body (S2) is the meal. This module crafts what ruggy
 * is ALLOWED to interpret given the substrate's licensing.
 *
 * Shape A (all-quiet) gets DIFFERENT treatment from shape B/C: per the
 * cycle-005 UX nit surfaced 2026-05-16, shape A is the DOMINANT state at
 * current production activity volume (16 active members, 4 OG events / 30d).
 * Shape A is where ruggy has the MOST room to be in character — the wait
 * IS the story. The bears sleep. The honey is brewing. Empty state is
 * intentional UX, not degraded fallback.
 *
 * Shape B/C wires the gate's licensing directly into the prompt: ruggy is
 * told which factors are licensed for narration and which are silenced.
 * The "interpret only what the gate licenses — do not invent claims about
 * cohorts, rarity, or shifts unless the substrate data permits" instruction
 * (per sprint.md T2.4) becomes a CONCRETE list of permitted phrasings.
 */

import type { ZoneId, FactorStats } from '../score/types.ts';
import type { LayoutShape } from './layout-shape.ts';
import type { ProseGateViolation } from '../deliver/prose-gate.ts';

const ZONE_VOICE_CONTEXT: Record<ZoneId, string> = {
  stonehenge:
    'the overall stone circle · cross-dim hub · stonehenge is where the bears gather for the count',
  'bear-cave':
    'the OG dimension · pre-mint history · sets/keys/articles/cubquest · the deep cave where the long-history bears nap',
  'el-dorado':
    'the NFT dimension · holdings/traits/fractures · gold-flecked terrain where the collectors prowl',
  'owsley-lab':
    'the onchain dimension · DeFi/lending/staking/ecosystem mints · the lab where chain-actions get cataloged',
};

export interface VoiceBriefInput {
  zone: ZoneId;
  shape: LayoutShape;
  /** True when shape is C but zero zones have permittedClaims — voice suppressed. */
  isNoClaimVariant: boolean;
  /** Sorted-desc factors that have rank ≥ 90 + p95.reliable = true · ruggy may name these. */
  permittedFactors: ReadonlyArray<{ display_name: string; stats: FactorStats }>;
  /** Factors that match a gate-rule trigger phrase but mechanical check failed · ruggy must NOT claim these patterns. */
  silencedFactors: ReadonlyArray<{ display_name: string; reason: ProseGateViolation['reason'] }>;
  /** Total events across the window — the gross activity number. */
  totalEvents: number;
  /** Days in the activity window (window=30 default per PRD r4). */
  windowDays: number;
  /** Was-N reference for previous-period count (DELIBERATELY not rendered in card per PR #73 trim · ruggy MAY allude to it in voice when material). */
  previousPeriodEvents: number;
}

export interface VoiceBrief {
  /** System prompt establishing ruggy's voice + cycle-005 constraints. */
  system: string;
  /** User prompt with the concrete data brief — what ruggy is interpreting. */
  user: string;
  /**
   * Expected output shape (for downstream parsing · the LLM emits JSON with
   * these two fields). When the LLM returns plain text or malformed JSON,
   * fall back to splitting on newline for header/outro.
   */
  expectedJsonSchema: { header: string; outro: string };
}

/**
 * Build the voice brief for a single zone's digest post.
 *
 * The output is the prompt pair `(system, user)` that any LLM gateway
 * (Claude SDK, direct API, freeside-gateway) can invoke. Pure function —
 * no side effects, no network. The orchestrator (`compose/digest.ts`)
 * calls this, then sends `{system, user}` to the LLM, then parses the
 * JSON response into `{header, outro}` to populate `BuildPulseDimensionPayloadOpts`.
 */
export function buildVoiceBrief(input: VoiceBriefInput): VoiceBrief {
  const zoneCtx = ZONE_VOICE_CONTEXT[input.zone];

  const baseSystem = `you are ruggy, the keeper of ${input.zone}. ${zoneCtx}.

voice rules (non-negotiable):
- lowercase. no capitals at sentence starts. proper nouns lowercase too (factor names like "boosted validator" lowercase fine; if the substrate provides a name, you may use its casing).
- no corporate-bot tells. avoid: "no significant activity this week", "stay tuned", "exciting developments", any rocket emoji, fire emoji, 100 emoji. you are a bear narrator. you are warm and grounded.
- no em-dashes. no asterisk-roleplay (*shrugs*). the sanitizer would strip these anyway but write without them.
- character first. you'd rather sit with a slow week than fake energy.
- short. header ≤ 80 chars. outro ≤ 60 chars. each is ONE LINE.
- specific. when you mention a number, mention WHICH number and over WHAT window.

output: a SINGLE JSON object on ONE line with two fields:
  {"header": "<your one-line header>", "outro": "<your one-line outro>"}
no markdown fences. no preamble. just the JSON.`;

  const shapeAGuidance = `
this week's shape: ALL QUIET. across the past ${input.windowDays} days, ${input.totalEvents} events fired in your dimension. no factor crossed the rank-90 threshold the substrate uses for "worth narrating". this is not a problem. this is the most interesting state to narrate well.

you may:
- acknowledge the quiet. NAME it. don't apologize for it.
- reflect on the cadence. compare to the previous period (${input.previousPeriodEvents} events) if it feels relevant.
- evoke ${input.zone}'s atmosphere. the bears may be sleeping. the honey may be brewing. the lab may be cooling.
- offer something for next week's wait. a noticing. a fragment.

you must NOT:
- invent activity. if there was no surge, do not say "things are heating up".
- claim ranks, percentiles, or cohort moves. there's no data to license those.
- generate the leaderboard body (the renderer does that deterministically; voice is seasoning).`;

  const permittedList =
    input.permittedFactors.length === 0
      ? '(none — substrate didn\'t license any factor for narration)'
      : input.permittedFactors
          .map((f) => {
            const stats = f.stats;
            const rank = stats.magnitude?.current_percentile_rank;
            const actors = stats.cohort?.unique_actors;
            return `  · ${f.display_name} — rank ${rank ?? '?'} · ${actors ?? '?'} actors · ${stats.history.active_days} active days`;
          })
          .join('\n');

  const silencedList =
    input.silencedFactors.length === 0
      ? '(none)'
      : input.silencedFactors
          .map((s) => `  · ${s.display_name} (gate flagged: ${s.reason}) — DO NOT NARRATE`)
          .join('\n');

  const shapeBCGuidance = `
this week's shape: ${input.shape === 'B-one-dim-hot' ? 'ONE DIM HOT' : 'MULTI DIM HOT'}. the substrate licensed factors for narration. ${input.totalEvents} events across ${input.windowDays} days.

LICENSED factors (you may name these · the rank/cohort/cadence is substrate-attested):
${permittedList}

SILENCED factors (the gate flagged trigger phrases but mechanical check failed · DO NOT claim cohort moves, rare events, or structural shifts about these even if it's tempting):
${silencedList}

you may:
- name 1-2 LICENSED factors. cite a specific number with its substrate axis (rank, actors, days).
- offer interpretation, not just description. "X climbed" is description. "X climbed and Y didn't" is interpretation.
- close with something forward-looking but not generic. specific to the dim's character.

you must NOT:
- claim cohort/lockstep/cluster patterns about silenced factors (gate will flag and you'll trigger telemetry).
- invent magnitude or rarity claims about anything not in the licensed list.
- describe the data the card body already shows (the card already shows it; your job is the framing).`;

  const userPrompt =
    input.shape === 'A-all-quiet' || input.isNoClaimVariant ? shapeAGuidance : shapeBCGuidance;

  return {
    system: baseSystem,
    user: userPrompt.trim(),
    expectedJsonSchema: { header: '', outro: '' },
  };
}

/**
 * Best-effort parse of the LLM's response into `{header, outro}`. Handles:
 *   - clean JSON  `{"header": "...", "outro": "..."}`
 *   - JSON with markdown fence (strip ```json ... ``` wrapper)
 *   - plain two-line response (split on `\n`)
 *
 * Returns `{header: '', outro: ''}` on unrecoverable malformed input —
 * caller falls back to the legacy single-string voice path OR to an empty
 * voice surface (shape-A degraded silence-register).
 */
export function parseVoiceResponse(text: string): { header: string; outro: string } {
  const trimmed = text.trim();
  // Strip markdown fence if present
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Try JSON first
  try {
    const parsed = JSON.parse(stripped);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.header === 'string' &&
      typeof parsed.outro === 'string'
    ) {
      return {
        header: parsed.header.trim(),
        outro: parsed.outro.trim(),
      };
    }
  } catch {
    // fall through to plain-text split
  }

  // Plain-text fallback: split on first newline
  const lines = stripped
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { header: '', outro: '' };
  if (lines.length === 1) return { header: lines[0]!, outro: '' };
  return { header: lines[0]!, outro: lines[1]! };
}
