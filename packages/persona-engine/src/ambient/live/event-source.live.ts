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
import {
  computeOverlapSince,
  isLateArrival,
  lateArrivalRejectHoursFromEnv,
  REPLAY_WINDOW_SECONDS,
  SEEN_RING_BUFFER_MAX,
} from "../domain/cursor.ts";
import type { EventCursor } from "../domain/cursor.ts";
import { callScoreToolAmbient } from "./score-mcp-client.ts";
import { loadConfig } from "../../config.ts";

const SCORE_TIMEOUT_MS = 15_000;
const SCORE_CB_KEY = "score-mcp";

/** BB F4 closure: in-memory dedup ring for the consumer-side dedup that
 * the cursor overlap window mandates (NFR-13). Maintained per process;
 * survives across calls. Under singleton invariant (NFR-21), one ring
 * per zone (or null for global) is sufficient. */
const _seenRings: Map<string, Array<string>> = new Map();

function _seenKey(zone: EventCursor["zone"]): string {
  return zone ?? "__global__";
}

function _markSeen(zone: EventCursor["zone"], id: string): void {
  const k = _seenKey(zone);
  let ring = _seenRings.get(k);
  if (!ring) {
    ring = [];
    _seenRings.set(k, ring);
  }
  ring.push(id);
  while (ring.length > SEEN_RING_BUFFER_MAX) ring.shift();
}

function _hasSeen(zone: EventCursor["zone"], id: string): boolean {
  const ring = _seenRings.get(_seenKey(zone));
  if (!ring) return false;
  return ring.includes(id);
}

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
          // BB F4 closure: also apply late-arrival rejection (NFR-15) and
          // dedup ring filter (NFR-13) before adding to the output set.
          const decodeOne = Schema.decodeUnknownEither(MiberaEvent);
          let quarantined = 0;
          let lateRejected = 0;
          let duplicateSkipped = 0;
          const events: Array<typeof MiberaEvent.Type> = [];
          const lateArrivalCutoffHours = lateArrivalRejectHoursFromEnv();
          for (const evt of raw.events) {
            const result = decodeOne(evt);
            if (result._tag !== "Right") {
              quarantined += 1;
              continue;
            }
            const decoded = result.right;
            // NFR-13 dedup: same tx_hash+log_index → same id → already seen
            const idStr = decoded.id as unknown as string;
            if (_hasSeen(cursor.zone, idStr)) {
              duplicateSkipped += 1;
              continue;
            }
            // NFR-15 late-arrival: events older than cursor - LATE_ARRIVAL_HOURS
            if (
              isLateArrival(
                decoded.occurred_at,
                cursor.event_time,
                lateArrivalCutoffHours,
              )
            ) {
              lateRejected += 1;
              continue;
            }
            _markSeen(cursor.zone, idStr);
            events.push(decoded);
          }
          // Surface late-rejected + duplicate counters to debug logs
          if (lateRejected > 0 || duplicateSkipped > 0) {
            console.log(
              `event-source: zone=${cursor.zone ?? "global"} ` +
                `late_rejected=${lateRejected} duplicate_skipped=${duplicateSkipped}`,
            );
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
