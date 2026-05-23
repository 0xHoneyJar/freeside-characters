/**
 * cycle-008 T2.1 · BuildPromptError tagged error class.
 *
 * Per Flatline-SDD IMP-003 + BB-MED-001 + sprint plan §2.1.
 * Effect-TS Data.TaggedError pattern matches existing usage in
 * `packages/persona-engine/src/ambient/*` + `compose/llm-gateway/*`.
 *
 * Three categories distinguish handler behavior in claude-sdk.live.ts:
 *   INPUT             — caller-provided · retry won't help · halt this fire · no alert
 *   STRUCTURAL        — persona.md or template broken · halt + alert (likely recent edit)
 *   INVARIANT-VIOLATION — internal buildPrompt drift · halt + alert + page (code bug)
 */

import { Data } from 'effect';

import type { PostType } from '../compose/post-types.ts';

export class BuildPromptError extends Data.TaggedError('BuildPromptError')<{
  readonly kind:
    // INPUT errors (caller-provided · retry won't help)
    | 'missing-cron-arg' // cron shape but cycle-008 arg undefined
    | 'aggregate-stat-leakage' // NFR-9 · runtime guard rejected input
    // STRUCTURAL errors (persona.md or template invalid)
    | 'template-section-missing' // persona.md missing `## System prompt template`
    | 'input-payload-marker-missing' // template missing `═══ INPUT PAYLOAD ═══`
    | 'fragment-not-found' // `<!-- @FRAGMENT: <post-type> -->` absent
    | 'fragment-end-marker-missing'
    // INVARIANT-VIOLATION errors (internal bug · alert-worthy)
    | 'fragment-sources-invariant-violation';
  readonly argName?: string;
  readonly personaPath?: string;
  readonly postType?: PostType;
  readonly sample?: string; // aggregate-stat-leakage: offending text
  readonly detail?: string; // fragment-sources-invariant-violation: which invariant
}> {
  static categoryFor(
    kind: BuildPromptError['kind'],
  ): 'INPUT' | 'STRUCTURAL' | 'INVARIANT-VIOLATION' {
    switch (kind) {
      case 'missing-cron-arg':
      case 'aggregate-stat-leakage':
        return 'INPUT';
      case 'template-section-missing':
      case 'input-payload-marker-missing':
      case 'fragment-not-found':
      case 'fragment-end-marker-missing':
        return 'STRUCTURAL';
      case 'fragment-sources-invariant-violation':
        return 'INVARIANT-VIOLATION';
    }
  }
}
