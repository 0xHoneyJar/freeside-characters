/**
 * Prose-gate V1 (cycle-005 · sibling to grail-ref-guard).
 *
 * Three regex denylist rules tied to mechanical `factor_stats` substrate
 * checks. Returns `{text, validation}` with text UNCHANGED. Telemetry-only
 * this cycle — V1.5 adds register-map + soft-enforce; V2 adds cross-family
 * LLM-as-judge + regenerate-with-refusal.
 *
 * V1 routing invariant (SDD §5 · cycle-005): the gate runs in the DIGEST
 * path only. The chat-mode `composeReplyWithEnrichment` path does NOT call
 * `inspectProse`; chat-mode gate is V1.5 destination per PRD §Accepted V1
 * Limitations A2. This module exports a pure function — the caller is
 * responsible for routing.
 *
 * Closes PRD-FR-2 + SDD §Component 1 spec. Sibling pattern: `grail-ref-guard.ts`.
 */

import type { FactorStats } from '../score/types.ts';

const PROXIMITY_WINDOW_CHARS = 200;

/**
 * Internal regex rule: a denylist pattern paired with a mechanical-check
 * predicate against `FactorStats`. The predicate runs ONLY after the regex
 * matches AND a factor can be attributed via proximity. `no-factor-context`
 * is the fallback when attribution fails — the regex matched but the gate
 * cannot authoritatively flag without statistical grounding.
 */
interface ProseGateRule {
  name: string;
  pattern: RegExp;
  check: (stats: FactorStats) => boolean;
  reason: 'cohort-singleton' | 'percentile-unreliable' | 'rank-below-threshold' | 'rank-null';
}

/**
 * Three regex rules per SDD §Component 1 lines 108-131. Each rule uses
 * `gi` flag (case-insensitive · global) and `\b` word-boundary anchors to
 * defend against morphological variation. The mechanical-check predicate
 * is what discriminates regex-match from violation — a draft can mention
 * "the cohort" and not be flagged unless `cohort.unique_actors <= 1`.
 */
const PROSE_GATE_RULES: readonly ProseGateRule[] = [
  {
    name: 'cluster-claim',
    pattern: /\b(coordinated\s+clusters?|lockstep|lock-step|same\s+wallets?|cohorts?)\b/gi,
    check: (stats) => (stats.cohort.unique_actors ?? Infinity) <= 1,
    reason: 'cohort-singleton',
  },
  {
    name: 'p99-rare',
    pattern: /\b(p99[-\s]rare|tail\s+events?|top\s+decile)\b/gi,
    check: (stats) =>
      !stats.magnitude.percentiles.p99.reliable ||
      (stats.magnitude.current_percentile_rank ?? 0) < 95,
    reason: 'percentile-unreliable',
  },
  {
    name: 'structural-shift',
    pattern: /\b(structural\s+shifts?|unprecedented|breakouts?|breaking\s+patterns?)\b/gi,
    check: (stats) =>
      stats.magnitude.current_percentile_rank === null ||
      (stats.magnitude.current_percentile_rank ?? 0) < 90,
    reason: 'rank-below-threshold',
  },
];

export type ProseGateMode = 'log' | 'skip' | 'silence';

export interface ProseGateViolation {
  pattern: string;
  factor_id: string | null;
  reason:
    | 'cohort-singleton'
    | 'percentile-unreliable'
    | 'rank-below-threshold'
    | 'rank-null'
    | 'no-factor-context';
  /** Which factor names appeared in proximity (operator debugging surface). */
  proximity_factors: readonly string[];
}

export interface ProseGateValidation {
  matched_patterns: readonly { pattern: string; span: readonly [number, number] }[];
  violations: readonly ProseGateViolation[];
}

/**
 * Orchestrator-augmented type (digest path applies after reading
 * `resolveProseGateMode()` + counting HIGH-severity violations). NOT
 * populated by `inspectProse`. Closes flatline blockers PRD-SKP-001
 * [740] r2 + SDD-SKP-009 [720] r3 (responsibility split).
 */
export interface ProseGateOutcome extends ProseGateValidation {
  /** Set to 'A' to force the per-zone Shape A render regardless of
   *  permitted_claims/rank — populated by the digest orchestrator when
   *  `mode='silence'` AND HIGH-violations exist. */
  shape_override?: 'A';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve the closest factor display_name within `PROXIMITY_WINDOW_CHARS`
 * before/after `matchSpan`. Longest-match-first prevents short factor
 * names from shadowing multi-word ones (e.g. "Boosted Validator" vs
 * "Validator").
 *
 * Returns `{factor_id: null, proximity_factors: []}` when no factor name
 * appears in the window. Caller decides whether to emit a violation with
 * `reason: 'no-factor-context'`.
 */
function attributeFactor(
  draft: string,
  matchSpan: readonly [number, number],
  factors: readonly { id: string; display_name: string }[],
): { factor_id: string | null; proximity_factors: readonly string[] } {
  const start = Math.max(0, matchSpan[0] - PROXIMITY_WINDOW_CHARS);
  const end = Math.min(draft.length, matchSpan[1] + PROXIMITY_WINDOW_CHARS);
  const window = draft.slice(start, end);
  const sorted = [...factors].sort((a, b) => b.display_name.length - a.display_name.length);
  const found: { factor_id: string; display_name: string; pos: number }[] = [];
  for (const f of sorted) {
    if (!f.display_name) continue;
    const re = new RegExp(`\\b${escapeRegex(f.display_name)}\\b`, 'i');
    const m = re.exec(window);
    if (m) found.push({ factor_id: f.id, display_name: f.display_name, pos: m.index + start });
  }
  found.sort(
    (a, b) => Math.abs(a.pos - matchSpan[0]) - Math.abs(b.pos - matchSpan[0]),
  );
  return {
    factor_id: found[0]?.factor_id ?? null,
    proximity_factors: found.map((f) => f.display_name),
  };
}

/**
 * Inspect a draft for prose-gate violations. PURE function: returns
 * `{text, validation}` with `text` byte-identical to input (NFR-2
 * idempotency · AC-S1.1).
 *
 * For each rule, every regex match runs through `attributeFactor` to
 * resolve a `factor_id`. When attribution succeeds, the mechanical
 * `check(stats)` predicate decides whether to emit a violation. When
 * attribution fails (no factor names in proximity window), a violation
 * with `reason: 'no-factor-context'` is emitted — the caller can decide
 * informational-vs-HIGH severity (V1 always treats as informational per
 * SDD §1.186).
 *
 * Historic factors (catalog status:'historic' · no `factor_stats`) are
 * skipped silently: `factorStatsByFactorId.get(factor_id)` returns
 * undefined → no rule check fires → no violation (AC-S1.5).
 */
export function inspectProse(
  draft: string,
  factorStatsByFactorId: ReadonlyMap<string, FactorStats>,
  factors: readonly { id: string; display_name: string }[],
): { text: string; validation: ProseGateValidation } {
  const matched: { pattern: string; span: readonly [number, number] }[] = [];
  const violations: ProseGateViolation[] = [];

  for (const rule of PROSE_GATE_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(draft)) !== null) {
      const span: readonly [number, number] = [m.index, m.index + m[0].length];
      matched.push({ pattern: rule.name, span });

      const attribution = attributeFactor(draft, span, factors);
      if (attribution.factor_id === null) {
        violations.push({
          pattern: rule.name,
          factor_id: null,
          reason: 'no-factor-context',
          proximity_factors: attribution.proximity_factors,
        });
        continue;
      }
      const stats = factorStatsByFactorId.get(attribution.factor_id);
      if (!stats) continue; // historic factor — skip silently per AC-S1.5
      if (rule.check(stats)) {
        violations.push({
          pattern: rule.name,
          factor_id: attribution.factor_id,
          reason: rule.reason,
          proximity_factors: attribution.proximity_factors,
        });
      }
    }
  }

  return { text: draft, validation: { matched_patterns: matched, violations } };
}

/**
 * Read `PROSE_GATE_ON_VIOLATION` env var. Defaults to `'log'` (telemetry-
 * only · V1 contract). Invalid values silently fall back to `'log'`.
 * Closes SDD-SKP-001 [760] · kill-switch handling.
 */
export function resolveProseGateMode(): ProseGateMode {
  const m = (process.env.PROSE_GATE_ON_VIOLATION || 'log').toLowerCase();
  if (m === 'skip' || m === 'silence' || m === 'log') return m;
  return 'log';
}

/**
 * Compose `factorStatsByFactorId` + `factors` array from a
 * get_dimension_breakdown response. The breakdown shape is
 * `{dimensions: [{top_factors: [...], cold_factors: [...]}]}` per S0
 * spike observation (envelope is wrapped in `dimensions` array; SDD §1
 * pseudocode flattens it for the gate).
 *
 * Historic factors (no `factor_stats`) are intentionally INCLUDED in the
 * `factors` array (so the attribution resolver can still find them by
 * name) but OMITTED from the map (so the rule check sees no stats and
 * skips). This is the V1 contract for historic-factor handling.
 *
 * Closes SDD §1 factor-attribution algorithm + T1.5 helper requirement.
 */
export function buildFactorStatsMap<
  F extends { factor_id: string; display_name: string; factor_stats?: FactorStats },
>(captured: { top_factors?: readonly F[]; cold_factors?: readonly F[] }): {
  factorStatsByFactorId: ReadonlyMap<string, FactorStats>;
  factors: readonly { id: string; display_name: string }[];
} {
  const allFactors = [
    ...(captured.top_factors ?? []),
    ...(captured.cold_factors ?? []),
  ];
  const map = new Map<string, FactorStats>();
  for (const f of allFactors) {
    if (f.factor_stats) map.set(f.factor_id, f.factor_stats);
  }
  const factors = allFactors.map((f) => ({ id: f.factor_id, display_name: f.display_name }));
  return { factorStatsByFactorId: map, factors };
}

/**
 * Compute an 8-char SHA-256 prefix of the draft for telemetry hygiene.
 * Used in `console.warn` lines so operators can correlate violations
 * across logs without leaking the full draft text (NFR-3 · AC-S1.6).
 *
 * Lives here (not in a shared util) so prose-gate's telemetry footprint
 * is self-contained. The 8-char prefix is sufficient for grep-correlation
 * within a single zone's hour-window — collision risk is acceptable.
 */
export function draftHash(draft: string): string {
  // Bun + Node 20+ ship the WebCrypto API; fall back to a deterministic
  // non-crypto digest if subtle is unavailable (test environments).
  // We avoid `crypto.subtle` since it's async; this is sync + acceptable
  // entropy for telemetry (NOT a security signal).
  let h = 0x811c9dc5;
  for (let i = 0; i < draft.length; i++) {
    h ^= draft.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  // 8 hex chars
  return h.toString(16).padStart(8, '0');
}
