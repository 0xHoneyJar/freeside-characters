/**
 * EventFeed mock adapter — deterministic STUB_MODE stream.
 *
 * Returns events from an in-memory fixture array, advancing the cursor
 * per call. Designed for tests + STUB_MODE local dev (no MCP_KEY needed).
 */

import { Effect, Layer } from "effect";
import { EventFeed } from "../ports/event-source.port.ts";
import type { MiberaEvent } from "../domain/event.ts";
import type { EventCursor } from "../domain/cursor.ts";

interface MockEventSourceState {
  events: ReadonlyArray<MiberaEvent>;
  cursor_position: number;
}

const _state: MockEventSourceState = {
  events: [],
  cursor_position: 0,
};

export function seedMockEvents(events: ReadonlyArray<MiberaEvent>): void {
  _state.events = events;
  _state.cursor_position = 0;
}

export function resetMockEvents(): void {
  _state.events = [];
  _state.cursor_position = 0;
}

export const EventSourceMock = Layer.succeed(
  EventFeed,
  EventFeed.of({
    fetchSince: (params) =>
      Effect.sync(() => {
        // simple per-call slice; cursor advances by the limit
        const sliceStart = _state.cursor_position;
        const sliceEnd = Math.min(
          sliceStart + params.limit,
          _state.events.length,
        );
        const events = _state.events.slice(sliceStart, sliceEnd);
        _state.cursor_position = sliceEnd;

        const last = events[events.length - 1];
        const nextCursor: EventCursor = last
          ? {
              zone: params.cursor.zone,
              event_time: last.occurred_at,
              event_id: last.id,
              updated_at: new Date().toISOString(),
            }
          : params.cursor;

        return {
          events,
          nextCursor,
          hasMore: sliceEnd < _state.events.length,
          quarantinedCount: 0,
        };
      }),
  }),
);
