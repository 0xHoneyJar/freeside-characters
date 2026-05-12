/**
 * Scheduler integration glue — the hourly stir tick.
 *
 * Per S3.T4: called from `cron/scheduler.ts` extension. Does NOT take over
 * any existing scheduler responsibilities; runs as a new independent task.
 * D19 invariant: digest cron is NEVER stir-gated; stir tier failures NEVER
 * cascade into digest path.
 *
 * Flow per tick per zone:
 *   1. Read cursor from .run/event-cursor.jsonl
 *   2. fetchSince → new events + next cursor
 *   3. pulseTick: previous stir + events → new stir
 *   4. pulse-sink writes new stir as sibling channel
 *   5. cursor advance (NFR-14 transactional — write only after stir+ledger ok)
 */

import { Effect } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { EventFeed } from "./ports/event-source.port.ts";
import { PulseSink } from "./ports/pulse-sink.port.ts";
import { ambientRuntime } from "./runtime.ts";
import { pulseTick } from "./pulse.system.ts";
import type { ZoneId } from "./domain/event.ts";
import type { EventCursor } from "./domain/cursor.ts";
import { emptySeen, REPLAY_WINDOW_SECONDS } from "./domain/cursor.ts";
import type { LynchPrimitive } from "./domain/primitive-weights.ts";

const CURSOR_FILE_DEFAULT = ".run/event-cursor.jsonl";

interface CursorRow {
  zone: ZoneId;
  event_time: string;
  event_id: string;
  updated_at: string;
}

function _cursorPath(): string {
  return process.env.EVENT_CURSOR_FILE ?? CURSOR_FILE_DEFAULT;
}

function _loadCursor(zone: ZoneId, now: string): EventCursor {
  const file = _cursorPath();
  try {
    if (!fs.existsSync(file)) {
      return _initialCursor(zone, now);
    }
    const content = fs.readFileSync(file, "utf-8");
    const rows: Array<CursorRow> = [];
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {}
    }
    // last-write-per-zone wins
    let best: CursorRow | null = null;
    for (const r of rows) {
      if (r.zone === zone) {
        if (!best || r.updated_at > best.updated_at) best = r;
      }
    }
    if (!best) return _initialCursor(zone, now);
    return {
      zone,
      event_time: best.event_time,
      event_id: best.event_id as never,
      updated_at: best.updated_at,
    };
  } catch {
    return _initialCursor(zone, now);
  }
}

function _initialCursor(zone: ZoneId, now: string): EventCursor {
  // start from now - REPLAY_WINDOW_SECONDS so the first tick replays a small window
  const sinceMs = Date.parse(now) - REPLAY_WINDOW_SECONDS * 1000;
  return {
    zone,
    event_time: new Date(sinceMs).toISOString(),
    event_id: "" as never,
    updated_at: now,
  };
}

function _saveCursor(cursor: EventCursor): void {
  // BB F6 closure: POSIX-atomic line append; no file rewrite.
  const file = _cursorPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const row: CursorRow = {
    zone: cursor.zone!,
    event_time: cursor.event_time,
    event_id: cursor.event_id as unknown as string,
    updated_at: cursor.updated_at,
  };
  fs.appendFileSync(file, JSON.stringify(row) + "\n", { flag: "a" });
}

const STIR_TICK_LIMIT = 100;

export interface StirTickResult {
  readonly zone: ZoneId;
  readonly events_fetched: number;
  readonly cursor_advanced: boolean;
  readonly quarantined: number;
  readonly error: string | null;
}

/**
 * One stir tick for a single zone. Designed to be invoked from cron with
 * an isolated error boundary (NFR-10: never propagates failure to digest).
 */
export async function runStirTick(
  zone: ZoneId,
  primitive: LynchPrimitive,
): Promise<StirTickResult> {
  const now = new Date().toISOString();
  const cursor = _loadCursor(zone, now);

  const program = Effect.gen(function* (_) {
    const feed = yield* _(EventFeed);
    const sink = yield* _(PulseSink);
    const previousStir = yield* _(sink.read(zone));

    const fetched = yield* _(
      feed.fetchSince({
        cursor,
        limit: STIR_TICK_LIMIT,
      }),
    );

    if (fetched.events.length === 0 && previousStir === null) {
      // First-tick + no-events no-op
      return {
        events_fetched: 0,
        cursor_advanced: false,
        quarantined: fetched.quarantinedCount,
      };
    }

    // Even with zero events we still apply decay to the previous stir.
    const tickOutput = pulseTick({
      zone,
      primitive,
      previousStir,
      previousTickAt: previousStir?.computed_at ?? null,
      newEvents: fetched.events,
      now,
    });

    yield* _(sink.write(tickOutput.stir));

    return {
      events_fetched: fetched.events.length,
      cursor_advanced: fetched.events.length > 0,
      quarantined: fetched.quarantinedCount,
      nextCursor: fetched.nextCursor,
    };
  });

  try {
    const result = (await ambientRuntime.runPromise(program)) as {
      events_fetched: number;
      cursor_advanced: boolean;
      quarantined: number;
      nextCursor?: EventCursor;
    };

    // BB F1 closure: ALWAYS advance the cursor on every successful tick,
    // even when zero events landed. Otherwise the idle path keeps
    // re-querying `since_ts = initialCursor.event_time - 60s` every hour,
    // and the window drifts ever further behind real time. The advance
    // pattern: keep last-known event_id for tiebreaking; bump event_time
    // forward by REPLAY_WINDOW_SECONDS so the next call still has the
    // overlap window but isn't re-fetching the same bucket forever.
    if (result.cursor_advanced && result.nextCursor) {
      _saveCursor(result.nextCursor);
    } else {
      // Idle-path advance: roll the cursor forward to `now - REPLAY_WINDOW_SECONDS`
      // preserving the existing event_id. This means the next tick queries
      // from `now - 2 * REPLAY_WINDOW_SECONDS` (after computeOverlapSince
      // applies the standard 60s window). Steady-state correct.
      const idleAdvanceMs = Date.parse(now) - REPLAY_WINDOW_SECONDS * 1000;
      const idleCursor: EventCursor = {
        ...cursor,
        event_time: new Date(idleAdvanceMs).toISOString(),
        updated_at: now,
      };
      _saveCursor(idleCursor);
    }
    return {
      zone,
      events_fetched: result.events_fetched,
      cursor_advanced: result.cursor_advanced,
      quarantined: result.quarantined,
      error: null,
    };
  } catch (err) {
    return {
      zone,
      events_fetched: 0,
      cursor_advanced: false,
      quarantined: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Initial seen-ring helper for tests / dev tooling.
export { emptySeen };
