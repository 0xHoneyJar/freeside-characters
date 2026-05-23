// cycle-008 S9 (g30) · the PORT — the medium-agnostic boundary of the RLHF loop.
//
// Hexagonal architecture (operator directive 2026-05-23): the feedback loop is the CORE;
// each medium (Discord, terminal, …) is an ADAPTER at the edge depending INWARD through
// this port. The core (core/loop.ts) speaks only `RenderBatch` (candidates) and
// `CapturedFeedback` (ratings) — it never knows whether the medium is Discord or a TTY.
//
//   present(batch)      — deliver the candidates to the medium, return handles
//   capture(presented)  — collect the operator's per-candidate ratings + whys from the medium

import type { RenderBatch } from '../core/render-candidate.ts';
import type { PreferenceRating } from '../core/preference-log.ts';

/** A presented candidate in some medium — `handle` is the primary id (the rate target, e.g.
 *  the Discord anchor message). `messageIds` is every message the candidate occupies, so a
 *  reply to ANY of them (anchor or a beat) attributes its "why" to this candidate. */
export interface PresentedCandidate {
  readonly variantId: string;
  readonly handle: string;
  readonly messageIds?: ReadonlyArray<string>;
}

export interface PresentedBatch {
  readonly batchId: string;
  readonly zone: string;
  readonly presented: ReadonlyArray<PresentedCandidate>;
  /** Adapter-specific extras (channel id, etc.) — opaque to the core. */
  readonly meta?: Record<string, unknown>;
}

/** What the operator gave back, in the core's currency: per-candidate cardinal ratings + whys. */
export interface CapturedFeedback {
  readonly ratings: ReadonlyArray<PreferenceRating>;
}

/** The port every medium implements. Adapters depend on this + core; core depends only on this. */
export interface MediumAdapter {
  readonly name: string;
  present(batch: RenderBatch): Promise<PresentedBatch>;
  capture(presented: PresentedBatch): Promise<CapturedFeedback>;
}
