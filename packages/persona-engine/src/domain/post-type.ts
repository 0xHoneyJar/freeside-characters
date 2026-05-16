// cycle-006 S1 T1.7 · canonical PostType discriminated union.
// Resolves FLATLINE-SKP-003/HIGH post-type count inconsistency (sprint review).
// Single source of truth: 8 streams. `pulse` is NOT a separate stream — daily-pulse
// uses the `digest` stream tagged via `subtype: 'pulse'` per OQ-4 default.

export type PostType =
  | 'digest'
  | 'chat-reply'
  | 'pop-in'
  | 'micro'
  | 'weaver'
  | 'lore_drop'
  | 'question'
  | 'callout';

export const POST_TYPES: readonly PostType[] = [
  'digest',
  'chat-reply',
  'pop-in',
  'micro',
  'weaver',
  'lore_drop',
  'question',
  'callout',
] as const;

export function isPostType(value: unknown): value is PostType {
  return typeof value === 'string' && (POST_TYPES as readonly string[]).includes(value);
}

/** Compile-time exhaustiveness helper — invoke in default branches of switch(postType). */
export function assertNeverPostType(_value: never): never {
  throw new Error(`unhandled PostType: ${String(_value)}`);
}
