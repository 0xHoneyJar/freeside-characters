// cycle-006 S1 T1.4 · compile-time pin enforcing DeterministicEmbed has NO `description`.
//
// If a future change adds `description?: string` to DeterministicEmbed, the
// `@ts-expect-error` below will FAIL to trigger (because the assignment becomes
// valid), and `bun tsc --noEmit` will flag this file's directive as unused.
// That flag is the build failure that closes BB design-review F-002.
//
// This file contains no runtime exports — its sole purpose is the type-check.

import type { DeterministicEmbed } from './digest-message.ts';

const _violatesSeam: DeterministicEmbed = {
  color: 0,
  fields: [],
  // @ts-expect-error · DeterministicEmbed must NOT accept `description`. If
  // this directive becomes unused, the type was widened — fail the build.
  description: 'voice text smuggled into truth zone',
};

// Reference _violatesSeam so the TS compiler doesn't elide it.
export type _SeamPinReference = typeof _violatesSeam;
