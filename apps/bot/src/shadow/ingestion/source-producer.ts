/**
 * ingestion/source-producer.ts — the hexagonal ingestion port (cycle-010 S1.1; SDD §4.1).
 *
 * DEVIATION (logged in NOTES.md per [[feedback_spec_deviation_pattern]]): the SDD
 * specified `produce: (world) => Effect.Effect<ShadowEvent[], ProducerError>`.
 * Implemented as a plain `async` function; per-producer timeout + fail-isolation
 * are applied at the orchestrator (§4.3). Same error/timeout semantics, less
 * ceremony for a stub-backed sprint; an Effect migration is a follow if the
 * repo's Effect surface grows here.
 *
 * VOICELESS: types + a tagged error. No persona, no I/O.
 */
import type { ShadowEvent, SourceKind } from "./shadow-mode-contract.ts";

/** The world wiring a producer needs (SDD §4.1). */
export interface WorldRef {
  readonly community_id: string;
  readonly world_slug: string;
  readonly guild_id: string;
  readonly namespace_prefix: string;
  readonly watched_contracts: ReadonlyArray<string>;
  readonly score_community_slug: string;
}

/** Whether a producer's failure degrades the whole run (SDD §4.1 / SKP-002). */
export type Criticality = "required" | "optional";

/** Tagged producer error (the error surface the orchestrator isolates). */
export class ProducerError extends Error {
  readonly _tag = "ProducerError";
  constructor(
    readonly kind: SourceKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProducerError";
  }
}

/**
 * One ingestion angle. `produce` reads a real source and maps it to the
 * substrate's already-defined `ShadowEvent`s. READ-ONLY against the source.
 */
export interface SourceProducer {
  readonly kind: SourceKind;
  readonly criticality: Criticality;
  /** When in the two-phase pipeline this producer runs (SDD §4.3). */
  readonly phase: "A" | "B";
  produce(world: WorldRef): Promise<ReadonlyArray<ShadowEvent>>;
}
