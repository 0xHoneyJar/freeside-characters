// cycle-008 S9 (g30) · FR-41 persistence + FR-42 backpressure.
//
// Two zero-infra (JSONL / markdown · no DB, per CLAUDE.md "Don't do: add a database")
// sinks that close the RLHF loop:
//   1. appendPreferenceRecord → preference-log.jsonl  — the operator's pick + why,
//      structured as `rlhf-preference-v0` (round-trip-identical to the seeded record).
//      This corpus is the cycle-009 LLM-as-judge's calibration signal.
//   2. promoteToEvals → evals/snapshots/<id>.md         — the winner as a byte-snapshot
//      golden, in the same human-readable format as cycle-008-two-beat-owsley-lab.md.
//      The next format edit is then checked against the operator's own past pick.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import type { Candidate, RenderBatch } from './render-candidate.ts';

/** Repo-relative defaults (resolved from cwd; the CLI runs from repo root). */
export const PREFERENCE_LOG_PATH =
  'grimoires/loa/cycles/cycle-008-persona-substrate/preference-log.jsonl';
export const EVALS_SNAPSHOTS_DIR = 'evals/snapshots';

/** v1 richness — a cardinal rating + free-text rationale for ONE candidate. */
export interface PreferenceRating {
  readonly variant: string;
  /** 1-5 (cardinal · from a reaction). Optional — a reply-only "why" (no reaction) is still
   *  feedback and must not be dropped. Combined with `chosen` + `why` = the rich RLHF signal. */
  readonly score?: number;
  readonly why?: string;
}

/**
 * `rlhf-preference-v0` (pick + annotation) and `rlhf-preference-v1` (per-candidate ratings).
 * v1 adds `ratings[]` — the cardinal score + NL rationale for EVERY candidate, not just the
 * winner. `chosen` (the argmax) + `ranking` stay populated so v1 is a strict superset of v0:
 * a Bradley-Terry reward model reads the pairwise order; an LLM-judge reads the whys.
 */
export interface PreferenceRecord {
  readonly ts: string;
  readonly loop: string;
  readonly zone: string;
  readonly state: string;
  readonly snapshot: {
    readonly events_30d: number;
    /** the fresh "since last post" delta — DEFERRED (voice-memory unwired · T3.8 AC-a); 0 placeholder. */
    readonly since_last: number;
    readonly active_wallets: number;
  };
  readonly candidates: ReadonlyArray<string>;
  readonly chosen: string;
  readonly ranking: ReadonlyArray<string> | null;
  readonly annotation: string;
  /** v1: per-candidate cardinal ratings (absent on v0 records). */
  readonly ratings?: ReadonlyArray<PreferenceRating>;
  readonly elicited_by: string;
  readonly operator: string;
  readonly schema: 'rlhf-preference-v0' | 'rlhf-preference-v1';
}

export interface BuildPreferenceInput {
  readonly batch: RenderBatch;
  readonly chosen: string;
  readonly annotation: string;
  readonly ranking?: ReadonlyArray<string> | null;
  readonly operator?: string;
  readonly elicitedBy?: string;
  readonly ts?: string;
}

/** Derive a `rlhf-preference-v0` record from a rendered batch + the operator's pick. */
export function buildPreferenceRecord(input: BuildPreferenceInput): PreferenceRecord {
  const { batch } = input;
  const s = batch.snapshot;
  const candidateIds = batch.candidates.map((c) => c.variantId);
  if (!candidateIds.includes(input.chosen)) {
    throw new Error(
      `chosen variant "${input.chosen}" is not in this batch — candidates: ${candidateIds.join(', ')}`,
    );
  }
  const state = s.deltaPct === null || Math.abs(s.deltaPct) < 1 ? 'all-quiet' : 'active';
  return {
    ts: input.ts ?? new Date().toISOString().slice(0, 10),
    loop: 'billboard-format',
    zone: s.zone,
    state,
    snapshot: {
      events_30d: s.totalEvents,
      since_last: 0,
      active_wallets: s.activeWallets ?? 0,
    },
    candidates: candidateIds,
    chosen: input.chosen,
    ranking: input.ranking ?? null,
    annotation: input.annotation,
    elicited_by: input.elicitedBy ?? 'rlhf-preview-tool-FR41',
    operator: input.operator ?? 'zksoju',
    schema: 'rlhf-preference-v0',
  };
}

export interface BuildRatedInput {
  readonly batch: RenderBatch;
  readonly ratings: ReadonlyArray<PreferenceRating>;
  readonly operator?: string;
  readonly elicitedBy?: string;
  readonly ts?: string;
}

/**
 * Build a `rlhf-preference-v1` record from per-candidate ratings. `chosen` = the argmax
 * score (first on tie), `ranking` = variants by score desc, `annotation` = the winner's
 * why — so v1 is a strict superset of v0 (every downstream reader still works) while
 * carrying the cardinal scores + per-candidate rationales the reward model/judge wants.
 */
export function buildRatedRecord(input: BuildRatedInput): PreferenceRecord {
  const { batch } = input;
  const s = batch.snapshot;
  const candidateIds = batch.candidates.map((c) => c.variantId);
  if (input.ratings.length === 0) throw new Error('ratings cannot be empty');
  for (const r of input.ratings) {
    if (!candidateIds.includes(r.variant)) {
      throw new Error(`rated variant "${r.variant}" not in batch — candidates: ${candidateIds.join(', ')}`);
    }
    if (r.score !== undefined && (!Number.isInteger(r.score) || r.score < 1 || r.score > 5)) {
      throw new Error(`rating score must be an integer 1-5, got ${r.score} for "${r.variant}"`);
    }
    if (r.score === undefined && !r.why?.trim()) {
      throw new Error(`rating for "${r.variant}" has neither a score nor a why`);
    }
  }
  // chosen = argmax over SCORED ratings (reaction-only is the cardinal signal); reply-only
  // whys still ride in ratings[] for the LLM-judge. If nothing was scored, chosen is empty.
  const scored = input.ratings.filter((r) => r.score !== undefined).sort((a, b) => b.score! - a.score!);
  const chosen = scored[0]?.variant ?? '';
  const chosenWhy =
    input.ratings.find((r) => r.variant === chosen)?.why ??
    input.ratings.find((r) => r.why?.trim())?.why ??
    '';
  const state = s.deltaPct === null || Math.abs(s.deltaPct) < 1 ? 'all-quiet' : 'active';
  return {
    ts: input.ts ?? new Date().toISOString().slice(0, 10),
    loop: 'billboard-format',
    zone: s.zone,
    state,
    snapshot: { events_30d: s.totalEvents, since_last: 0, active_wallets: s.activeWallets ?? 0 },
    candidates: candidateIds,
    chosen,
    ranking: scored.length > 0 ? scored.map((r) => r.variant) : null,
    annotation: chosenWhy,
    ratings: input.ratings,
    elicited_by: input.elicitedBy ?? 'rlhf-preview-ui-v1',
    operator: input.operator ?? 'zksoju',
    schema: 'rlhf-preference-v1',
  };
}

/** Append one preference record as a JSONL line. Creates the file/dir if absent. */
export function appendPreferenceRecord(record: PreferenceRecord, path: string = PREFERENCE_LOG_PATH): string {
  const abs = resolve(process.cwd(), path);
  mkdirSync(dirname(abs), { recursive: true });
  appendFileSync(abs, `${JSON.stringify(record)}\n`, 'utf8');
  return abs;
}

export interface PromoteInput {
  readonly batch: RenderBatch;
  readonly candidate: Candidate;
  readonly annotation?: string;
  /** Output dir override (tests pass a tmp dir). */
  readonly dir?: string;
}

/** Promote a winning candidate to `evals/snapshots/<id>.md` (the regression substrate). */
export function promoteToEvals(input: PromoteInput): string {
  const { batch, candidate } = input;
  const dir = input.dir ?? EVALS_SNAPSHOTS_DIR;
  const fileId = `rlhf-${batch.zone}-${candidate.variantId}`;
  const abs = resolve(process.cwd(), join(dir, `${fileId}.md`));
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, renderEvalFixture(input), 'utf8');
  return abs;
}

function renderEvalFixture(input: PromoteInput): string {
  const { batch, candidate, annotation } = input;
  const s = batch.snapshot;
  const deltaStr = s.deltaPct === null ? 'null' : String(s.deltaPct);
  // The billboard, un-bolded, for the readable reference (strip the `**`).
  const billboardPlain = candidate.billboardLines.join('\n');
  const billboardBold = candidate.billboard;
  return `# Reference fixture · cycle-008 S9 · RLHF-promoted billboard (${batch.zone} · ${candidate.variantId})

> Promoted via \`rlhf-preview promote\` from batch \`${batch.batchId}\`.
> Winning variant: **${candidate.variantId}** — ${candidate.variantLabel}.
> Snapshot: ${batch.zoneDisplay} · totalEvents ${s.totalEvents} · activeWallets ${
    s.activeWallets ?? 'undefined'
  } · windowDays ${s.windowDays} · deltaPct ${deltaStr}.
> NOTE: \`evals/snapshots/\` has no automated assertion harness yet — this is a
> human-readable reference + the byte-snapshot artifact. Behavioral assertions live in
> \`packages/persona-engine/src/preview/*.test.ts\`.
${annotation ? `>\n> Operator annotation: ${annotation}\n` : ''}
## Beat 1 — the agent (message.content)

\`\`\`
${candidate.voiceContent}
\`\`\`

- lowercase, zero numbers (stats-out-of-voice)
- ships as its own Discord message

## Beat 2 — the billboard (DigestPayload.secondary.content · bold)

\`\`\`
${billboardPlain}
\`\`\`

- value column aligned with U+2007 FIGURE SPACE (digit-width invariant, not a code block)
- delivered bold (per-line \`**…**\`), as a SEPARATE Discord message (the voice ≠ substrate seam)

## Variant rationale

${candidate.variantNote}

## Raw beat-2 bytes (as Discord receives them)

\`\`\`
${billboardBold}
\`\`\`
`;
}
