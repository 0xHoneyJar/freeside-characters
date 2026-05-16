// cycle-006 S3 T3.1 · domain message types for 5 migrated post types.
// Each follows SDD §3.3 split: voiceContent (message.content surface) +
// truthEmbed (DeterministicEmbed · substrate fields) OR truthFields
// (raw lines for embed-less variants per compose/post-types.ts uses_embed).
//
// Embed-less post types per compose/post-types.ts:
//   micro · lore_drop · question  → use truthFields (plain content lines)
// Embed-bearing post types:
//   weaver · callout              → use truthEmbed
// Pop-in is a CADENCE wrapper (not a renderer) — see pop-in-orchestrator.ts.

import type { DeterministicEmbed } from './digest-message.ts';

/** Embed-less message — voice + plain truth lines. */
export interface PlainMessage {
  readonly voiceContent: string;
  /** Substrate facts as plain text lines (no embed wrapper). */
  readonly truthFields: ReadonlyArray<string>;
}

/** Embed-bearing message — voice + structured truth fields. */
export interface EmbedMessage {
  readonly voiceContent: string;
  readonly truthEmbed: DeterministicEmbed;
}

// micro: 1-3 sentences, casual drop-in
export type MicroMessage = PlainMessage;

// lore_drop: codex-anchored reference, plain content
export type LoreDropMessage = PlainMessage;

// question: open-ended invitation, plain content
export type QuestionMessage = PlainMessage;

// weaver: cross-zone connection, embed
export type WeaverMessage = EmbedMessage;

// callout: anomaly alert, embed (used by S4)
export type CalloutMessage = EmbedMessage;
