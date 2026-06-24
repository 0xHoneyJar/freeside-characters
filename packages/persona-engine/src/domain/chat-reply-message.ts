// cycle-006 S5 T5.1 · chat-reply domain message.
// Replaces composeReplyWithEnrichment's EnrichedReplyResult internal shape with
// a domain type per SDD §3.3 split (voice + truth-side metadata). The
// reply path is text-content-only (no embed) — Discord interaction surface.

export interface ChatReplyMessage {
  /** Voice surface text (already sanitized via existing transforms). */
  readonly voiceContent: string;
  /** Attached files (grail images, etc) — passed through from upstream. */
  readonly files?: ReadonlyArray<unknown>;
  /** Cache hits counter (Anthropic prompt-caching telemetry). */
  readonly cacheHits?: number;
  /** Truth-side metadata — currently empty; future channel-name / dimension. */
  readonly truthFields?: ReadonlyArray<string>;
}
