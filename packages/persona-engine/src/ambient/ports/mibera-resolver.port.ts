/**
 * MiberaResolver port — codex enrichment for narration.
 *
 * Wraps mcp__codex__lookup_mibera (confirmed at construct-mibera-codex
 * src/server.ts:122). Returns 28-key MiberaEntry; we surface only the
 * narration-relevant subset here.
 *
 * Canon-corrected field names per D5/D6/D7:
 *   - time_period (NOT era)
 *   - drug (NOT molecule)
 *   - 4-element Western elements (Fire/Water/Earth/Air)
 *   - archetypes ∈ Freetekno/Milady/Chicago-Detroit/Acidhouse
 *
 * Called ONLY at narration time (pop-in tier), per pair-point 2 D3.
 * Stir-tier skips resolver — keeps hourly poll cheap.
 *
 * Cache: 60-item LRU · 5-min TTL · IMP-012 reveal/burn invalidation.
 */

import { Context, Effect } from "effect";
import type { TokenId } from "../domain/event.ts";

export interface MiberaIdentity {
  readonly tokenId: number;
  readonly archetype: "Freetekno" | "Milady" | "Chicago/Detroit" | "Acidhouse";
  readonly ancestor: string;
  readonly element: "Fire" | "Water" | "Earth" | "Air";
  readonly time_period: string;
  readonly drug: string;
  readonly swag_rank: string; // "SSS" | "SS" | "S" | "A" | "B" | "C" | "F"
  readonly sun_sign: string;
  readonly moon_sign: string;
  readonly ascending_sign: string;
}

export interface MiberaResolverError {
  readonly _tag: "MiberaResolverError";
  readonly reason: "timeout" | "not_found" | "transport";
  readonly message: string;
}

export class MiberaResolver extends Context.Tag("ambient/MiberaResolver")<
  MiberaResolver,
  {
    readonly lookup: (
      tokenId: TokenId,
    ) => Effect.Effect<MiberaIdentity | null, MiberaResolverError>;

    /** IMP-012 cache invalidation on reveal/burn events that mutate state. */
    readonly invalidate: (
      tokenId: TokenId,
    ) => Effect.Effect<void, MiberaResolverError>;
  }
>() {}
