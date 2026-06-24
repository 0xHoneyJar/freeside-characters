/**
 * EventFeed port — Context.Tag for the score-mcp consumer.
 *
 * Implementations:
 *   - live: wraps mcp__score__get_events_since with NFR-7/8/9/11 resilience
 *   - mock: deterministic STUB_MODE adapter for tests
 */

import { Context, Effect } from "effect";
import type { MiberaEvent, EventClass, ZoneId } from "../domain/event.ts";
import type { EventCursor } from "../domain/cursor.ts";

export interface FetchEventsParams {
  readonly cursor: EventCursor;
  readonly limit: number;
  readonly zone?: ZoneId;
  readonly classes?: ReadonlyArray<EventClass>;
}

export interface FetchEventsResult {
  readonly events: ReadonlyArray<MiberaEvent>;
  readonly nextCursor: EventCursor;
  readonly hasMore: boolean;
  /** Count of events that returned an unknown event_class (NFR-11 quarantine). */
  readonly quarantinedCount: number;
}

export interface EventFeedError {
  readonly _tag: "EventFeedError";
  readonly reason: "timeout" | "transport" | "decode" | "circuit_open";
  readonly message: string;
}

export class EventFeed extends Context.Tag("ambient/EventFeed")<
  EventFeed,
  {
    /** NFR-12/13: cursor IN → fetched events + next cursor OUT.
     * Adapter applies REPLAY_WINDOW_SECONDS overlap automatically. */
    readonly fetchSince: (
      params: FetchEventsParams,
    ) => Effect.Effect<FetchEventsResult, EventFeedError>;
  }
>() {}
