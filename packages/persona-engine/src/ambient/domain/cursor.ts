/**
 * Ambient cursor domain — paginated event stream cursor with NFR-12/13 compound
 * key + overlap-window replay + bloom-filter spillover.
 *
 * Source of truth: grimoires/loa/sdd.md §3.3
 *
 * Per Flatline SDD blockers:
 *   - NFR-12 compound key `(event_time, id)` — late-arriving events ordered by
 *     timestamp could be permanently skipped if the cursor stored only `event_time`
 *   - NFR-13 overlap-window replay (default 60s) + dedup ring buffer (5000 IDs)
 *   - NFR-27 bloom-filter spillover when ring buffer wraps before REPLAY_WINDOW
 *   - NFR-14 high-watermark transactional advance (cursor advances only after
 *     pulse + ledger writes succeed)
 *   - NFR-15 late-arrival rejection: events older than `cursor - 6h`
 *   - NFR-31 reorg-aware dedup (same tx_hash + log_index → same id → caught)
 */

import { Schema } from "effect";
import { EventId, Timestamp, ZoneId } from "./event.ts";

// ─── Constants ───────────────────────────────────────────────────────

/** NFR-13 overlap window: every fetch passes
 * `event_time = cursor_event_time - REPLAY_WINDOW_SECONDS` so events with
 * timestamps that arrived after the cursor moved are still seen on the
 * next poll. Dedup at consumer via existing `id` PK. */
export const REPLAY_WINDOW_SECONDS = 60;

/** NFR-15 late-arrival reject horizon (hours). Events with `occurred_at <
 * cursor - LATE_ARRIVAL_REJECT_HOURS` are dropped — their 6h window has
 * decayed past relevance. Flatline IMP-013: split from HALF_LIFE_HOURS so
 * future tuning is independent. env-overridable via `EVENT_LATE_ARRIVAL_HOURS`. */
export const LATE_ARRIVAL_REJECT_HOURS_DEFAULT = 6;

/** Reads the late-arrival reject horizon from env. Falls back to the default
 * if unset or non-positive. Closes Flatline F4 (env var defined but not
 * consumed). */
export function lateArrivalRejectHoursFromEnv(): number {
  const raw = process.env.EVENT_LATE_ARRIVAL_HOURS;
  if (!raw) return LATE_ARRIVAL_REJECT_HOURS_DEFAULT;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return LATE_ARRIVAL_REJECT_HOURS_DEFAULT;
  }
  return parsed;
}

/** NFR-27 ring buffer cap. ~24h coverage at ~200 events/day baseline. */
export const SEEN_RING_BUFFER_MAX = 5000;

/** NFR-27 bloom filter sizing (~0.1% false-positive rate at 10k inserts). */
export const BLOOM_FILTER_SIZE_BITS = 65536;
export const BLOOM_FILTER_HASHES = 7;

/** NFR-27 bloom filter flush cadence — flush every N inserts OR per tick. */
export const BLOOM_FLUSH_EVERY_N_DEFAULT = 50;

// ─── Cursor schema ───────────────────────────────────────────────────

/**
 * NFR-12 compound key: ordering is `(event_time DESC, id DESC)`. The cursor
 * carries BOTH fields so a downstream `get_events_since` query can break
 * timestamp ties deterministically.
 *
 * `zone` is nullable — null = global cursor (rare; per-zone is the default).
 */
export const EventCursor = Schema.Struct({
  zone: Schema.NullOr(ZoneId),
  event_time: Timestamp,
  event_id: EventId,
  updated_at: Timestamp,
});
export type EventCursor = Schema.Schema.Type<typeof EventCursor>;

/**
 * NFR-13 dedup buffer (in-memory ring) + NFR-27 bloom spillover for events
 * pushed past the ring's capacity.
 *
 * On startup or reload, the ring is bootstrapped from `cursor - 6h` events
 * (NFR-16 restart replay). Bloom filter persists across restarts via
 * `.run/event-cursor-bloom.dat` and is loaded best-effort (corruption →
 * empty filter + `bloom_recovery_reset` trajectory event per Flatline
 * SDD SKP-003 closure).
 */
export const EventCursorSeen = Schema.Struct({
  ids: Schema.Array(EventId).pipe(Schema.maxItems(SEEN_RING_BUFFER_MAX)),
  bloom_filter_path: Schema.NullOr(Schema.String),
  bloom_filter_size: Schema.Number,
  bloom_filter_hashes: Schema.Number,
  inserts_since_flush: Schema.Number,
});
export type EventCursorSeen = Schema.Schema.Type<typeof EventCursorSeen>;

export function emptySeen(bloomPath: string | null = null): EventCursorSeen {
  return {
    ids: [],
    bloom_filter_path: bloomPath,
    bloom_filter_size: BLOOM_FILTER_SIZE_BITS,
    bloom_filter_hashes: BLOOM_FILTER_HASHES,
    inserts_since_flush: 0,
  };
}

// ─── Cursor mechanics (pure functions) ───────────────────────────────

/** NFR-13 overlap window: subtract REPLAY_WINDOW_SECONDS from cursor for the
 * next query's `since_ts` parameter. Pure function. */
export function computeOverlapSince(
  cursor: EventCursor,
  windowSeconds: number = REPLAY_WINDOW_SECONDS,
): string {
  const cursorMs = Date.parse(cursor.event_time);
  const sinceMs = cursorMs - windowSeconds * 1000;
  return new Date(sinceMs).toISOString();
}

/** NFR-15 late-arrival check. Returns true if the event is older than the
 * reject horizon — caller should drop + log `late_arrival`. Default
 * reads from env via `lateArrivalRejectHoursFromEnv()`. */
export function isLateArrival(
  eventTime: string,
  cursorTime: string,
  rejectHours: number = lateArrivalRejectHoursFromEnv(),
): boolean {
  const eventMs = Date.parse(eventTime);
  const cursorMs = Date.parse(cursorTime);
  return eventMs < cursorMs - rejectHours * 3600 * 1000;
}
