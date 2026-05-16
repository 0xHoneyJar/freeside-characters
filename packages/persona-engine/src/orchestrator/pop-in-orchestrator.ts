import type { Config } from '../config.ts';
import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import type { ScoreFetchPort } from '../ports/score-fetch.port.ts';
import type { VoiceGenPort } from '../ports/voice-gen.port.ts';
import type { PresentationPort } from '../ports/presentation.port.ts';
import { composeMicroPost, type MicroPostResult } from './micro-orchestrator.ts';
import { composeLoreDropPost, type LoreDropPostResult } from './lore-drop-orchestrator.ts';
import { composeQuestionPost, type QuestionPostResult } from './question-orchestrator.ts';

/**
 * Pop-in is a CADENCE trigger (random spawn between digests), not a discrete
 * post type. The orchestrator picks one of (micro | lore_drop | question) per
 * the existing `pickPopInType` weighting in compose/post-types.ts and dispatches.
 *
 * Voice-memory for pop-in narrative continuity uses the 'pop-in' stream
 * (S6 wires this; for S3 the dispatched orchestrator uses its own stream).
 */

export type PopInSubType = 'micro' | 'lore_drop' | 'question';
export type PopInResult = MicroPostResult | LoreDropPostResult | QuestionPostResult;

export interface PopInOrchestratorDeps {
  readonly score?: ScoreFetchPort;
  readonly voice?: VoiceGenPort;
  readonly presentation?: PresentationPort;
  /** Test-injectable type selector. Defaults to round-robin by zone hash. */
  readonly pickType?: (zone: ZoneId) => PopInSubType;
}

const DEFAULT_TYPES: readonly PopInSubType[] = ['micro', 'lore_drop', 'question'];

function defaultPickType(zone: ZoneId): PopInSubType {
  // Deterministic mod-3 over zone string hash. Real cadence weighting lives
  // in compose/post-types.ts::pickPopInType; S6 wires that in.
  let h = 0;
  for (const c of zone) h = (h * 31 + c.charCodeAt(0)) | 0;
  return DEFAULT_TYPES[Math.abs(h) % DEFAULT_TYPES.length]!;
}

export async function composePopInPost(
  config: Config,
  character: CharacterConfig,
  zone: ZoneId,
  deps: PopInOrchestratorDeps = {},
): Promise<PopInResult> {
  const sub: PopInSubType = (deps.pickType ?? defaultPickType)(zone);
  switch (sub) {
    case 'micro':
      return composeMicroPost(config, character, zone, deps);
    case 'lore_drop':
      return composeLoreDropPost(config, character, zone, deps);
    case 'question':
      return composeQuestionPost(config, character, zone, deps);
  }
}
