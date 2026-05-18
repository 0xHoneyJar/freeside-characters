/**
 * cycle-008 T2.3a · FR-15a invariant validation function.
 *
 * Per sprint plan §4 T2.3a (moved upstream from S4 T4.3 per BB-IMP-001
 * dependency-fix · 2026-05-18). Validates `fragment_sources[]` against
 * the 4 FR-15a invariants:
 *
 *   (a) Sorted by `prompt_offset[0]` ascending
 *   (b) No overlap — each character in exactly one fragment_source
 *   (c) Layer field constrained to 5-element enum
 *   (d) Prompt_offset within `template_region` bounds (NOT in userMessage)
 *
 * Pure function · Effect-shaped · `Effect.fail(BuildPromptError(...))` on violation.
 */

import { Effect } from 'effect';

import { BuildPromptError } from './build-prompt-error.ts';

export interface FragmentSource {
  readonly layer: 'persona' | 'voice' | 'tool' | 'medium' | 'environment';
  readonly source_file: string;
  readonly source_lines: readonly [number, number];
  readonly prompt_offset: readonly [number, number];
  readonly fragment_kind: string;
}

const VALID_LAYERS: ReadonlyArray<FragmentSource['layer']> = [
  'persona',
  'voice',
  'tool',
  'medium',
  'environment',
];

export interface ValidateFragmentSourcesArgs {
  readonly fragmentSources: ReadonlyArray<FragmentSource>;
  /** Bounds of the template-substituted region in the final systemPrompt. */
  readonly templateRegion: readonly [number, number];
}

export function validateFragmentSourcesInvariants(
  args: ValidateFragmentSourcesArgs,
): Effect.Effect<void, BuildPromptError, never> {
  return Effect.gen(function* () {
    const { fragmentSources, templateRegion } = args;
    const [regionStart, regionEnd] = templateRegion;

    let prevEnd = -1;
    for (const fs of fragmentSources) {
      // (c) Layer enum check
      if (!VALID_LAYERS.includes(fs.layer)) {
        yield* Effect.fail(
          new BuildPromptError({
            kind: 'fragment-sources-invariant-violation',
            detail: `invalid layer enum value '${fs.layer}' (expected one of ${VALID_LAYERS.join(', ')})`,
          }),
        );
      }

      const [start, end] = fs.prompt_offset;

      // (d) Bounds check — must fall within template_region
      if (start < regionStart || end > regionEnd) {
        yield* Effect.fail(
          new BuildPromptError({
            kind: 'fragment-sources-invariant-violation',
            detail: `fragment '${fs.fragment_kind}' prompt_offset [${start}, ${end}] outside template_region [${regionStart}, ${regionEnd}]`,
          }),
        );
      }

      if (start >= end) {
        yield* Effect.fail(
          new BuildPromptError({
            kind: 'fragment-sources-invariant-violation',
            detail: `fragment '${fs.fragment_kind}' prompt_offset has zero or negative length: [${start}, ${end}]`,
          }),
        );
      }

      // (a) Ascending order + (b) No overlap
      if (start < prevEnd) {
        yield* Effect.fail(
          new BuildPromptError({
            kind: 'fragment-sources-invariant-violation',
            detail: `fragment '${fs.fragment_kind}' overlaps previous fragment (start=${start} < prev_end=${prevEnd})`,
          }),
        );
      }

      prevEnd = end;
    }
  });
}
