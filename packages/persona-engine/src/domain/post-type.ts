// cycle-006 S1 T1.7 / refined S3 · canonical PostType discriminated union.
//
// Aligns with existing compose/post-types.ts (user-facing post-type enum).
// `pop-in` is a CADENCE TRIGGER (not a post-type) — pop-in firings dispatch
// to micro / lore_drop / question per popInFits in compose/post-types.ts.
//
// FLATLINE-SKP-003/HIGH "8 streams" reconciliation: voice-memory stream
// names are a SEPARATE enumeration (S6 lands `VoiceMemoryStream` with 8
// values incl. `pop-in` for cadence-narrative continuity). PostType is the
// 7-type user-facing routing key the composer/orchestrators dispatch on.

export type PostType =
  | 'digest'
  | 'chat-reply'
  | 'micro'
  | 'weaver'
  | 'lore_drop'
  | 'question'
  | 'callout';

export const POST_TYPES: readonly PostType[] = [
  'digest',
  'chat-reply',
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

/**
 * Voice-memory stream names — 8 streams per FLATLINE-SKP-003/HIGH closure
 * (NOTES.md Decision Log cycle-006 sprint review). Includes `pop-in` as the
 * cadence-narrative continuity stream (separate from any single post type).
 * Defined here as a forward-reference; S6 wires the runtime allowlist into
 * live/voice-memory.live.ts::pathFor for AC-RT-001 path-traversal defense.
 */
export type VoiceMemoryStream =
  | 'digest'
  | 'chat-reply'
  | 'pop-in'
  | 'micro'
  | 'weaver'
  | 'lore_drop'
  | 'question'
  | 'callout';

export const VOICE_MEMORY_STREAMS: readonly VoiceMemoryStream[] = [
  'digest',
  'chat-reply',
  'pop-in',
  'micro',
  'weaver',
  'lore_drop',
  'question',
  'callout',
] as const;
