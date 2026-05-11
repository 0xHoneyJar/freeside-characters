/**
 * EventFeed live adapter — wraps mcp__score__get_events_since.
 *
 * Resilience contract:
 *   NFR-7 timeout: 15s per-call
 *   NFR-8 retries: 3 attempts · exponential backoff (1s/2s/4s) · full jitter
 *   NFR-9 circuit breaker: 5 consecutive failures → open · 30min cooldown
 *   NFR-11 unknown class quarantine: Schema decode failure → quarantine bucket
 *   NFR-12/13 compound cursor + overlap window: applied automatically
 */

import { Effect, Layer, Schedule, Duration, Schema } from "effect";
import { EventFeed } from "../ports/event-source.port.ts";
import type { EventFeedError } from "../ports/event-source.port.ts";
import { CircuitBreaker } from "../ports/circuit-breaker.port.ts";
import { MiberaEvent } from "../domain/event.ts";
import { computeOverlapSince, REPLAY_WINDOW_SECONDS } from "../domain/cursor.ts";
import type { EventCursor } from "../domain/cursor.ts";
import { callScoreToolAmbient } from "./score-mcp-client.ts";
import { loadConfig } from "../../config.ts";

const SCORE_TIMEOUT_MS = 15_000;
const SCORE_CB_KEY = "score-mcp";

interface RawEventsResponse {
  events: ReadonlyArray<unknown>;
  next_cursor: { event_time: string; event_id: string };
  has_more: boolean;
}

export const EventSourceLive = Layer.effect(
  EventFeed,
  Effect.gen(function* (_) {
    const cb = yield* _(CircuitBreaker);

    return EventFeed.of({
      fetchSince: (params) =>
        Effect.gen(function* (_) {
          const shortCircuited = yield* _(
            cb.isShortCircuited(SCORE_CB_KEY).pipe(
              Effect.catchAll(() => Effect.succeed(false)),
            ),
          );
          if (shortCircuited) {
            return yield* _(
              Effect.fail<EventFeedError>({
                _tag: "EventFeedError",
                reason: "circuit_open",
                message: "score-mcp circuit OPEN — recover in cooldown",
              }),
            );
          }

          const config = loadConfig();
          const cursor: EventCursor = params.cursor;
          const sinceTs = computeOverlapSince(cursor, REPLAY_WINDOW_SECONDS);

          const call = Effect.tryPromise<RawEventsResponse, EventFeedError>({
            try: (signal) =>
              callScoreToolAmbient<RawEventsResponse>(
                config,
                "get_events_since",
                {
                  since_ts: sinceTs,
                  since_id: cursor.event_id,
                  limit: params.limit,
                  ...(params.zone ? { zone: params.zone } : {}),
                  ...(params.classes ? { classes: params.classes } : {}),
                },
                signal,
              ),
            catch: (e): EventFeedError => ({
              _tag: "EventFeedError",
              reason: "transport",
              message: e instanceof Error ? e.message : String(e),
            }),
          });

          const withTimeout = call.pipe(
            Effect.timeoutFail({
              duration: Duration.millis(SCORE_TIMEOUT_MS),
              onTimeout: (): EventFeedError => ({
                _tag: "EventFeedError",
                reason: "timeout",
                message: `score-mcp get_events_since exceeded ${SCORE_TIMEOUT_MS}ms`,
              }),
            }),
            Effect.retry({
              schedule: Schedule.exponential(Duration.seconds(1), 2).pipe(
                Schedule.jittered,
                Schedule.intersect(Schedule.recurs(3)),
              ),
            }),
          );

          // NFR-9 circuit breaker observability
          const raw = yield* _(
            withTimeout.pipe(
              Effect.tap(() =>
                cb.recordSuccess(SCORE_CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
              Effect.tapError(() =>
                cb.recordFailure(SCORE_CB_KEY).pipe(Effect.catchAll(() => Effect.void)),
              ),
            ),
          );

          // NFR-11 unknown-class quarantine via Either decode
          const decodeOne = Schema.decodeUnknownEither(MiberaEvent);
          let quarantined = 0;
          const events: Array<typeof MiberaEvent.Type> = [];
          for (const evt of raw.events) {
            const result = decodeOne(evt);
            if (result._tag === "Right") {
              events.push(result.right);
            } else {
              quarantined += 1;
              // surface to trajectory in S3.T4 scheduler integration
            }
          }

          const nextCursor: EventCursor = {
            zone: cursor.zone,
            event_time: raw.next_cursor.event_time,
            event_id: raw.next_cursor.event_id as never,
            updated_at: new Date().toISOString(),
          };

          return {
            events,
            nextCursor,
            hasMore: raw.has_more,
            quarantinedCount: quarantined,
          };
        }),
    });
  }),
);
