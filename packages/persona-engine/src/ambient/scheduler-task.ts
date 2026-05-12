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
import {
  ambientRuntime,
  isAmbientStirDisabled,
  getAmbientStirDisableReasons,
} from "./runtime.ts";
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

  // BB pass-4 F10 closure: if boot-time endpoint validation disabled the
  // stir tier (production with misconfigured codex/auth MCPs), no-op
  // cleanly. Caller's NFR-10 error boundary already ensures digest cron
  // is unaffected, but skipping here avoids hammering broken endpoints.
  if (isAmbientStirDisabled()) {
    return {
      zone,
      events_fetched: 0,
      cursor_advanced: false,
      quarantined: 0,
      error: `ambient-stir disabled at boot: ${getAmbientStirDisableReasons().join("; ")}`,
    };
  }

  const cursor = _loadCursor(zone, now);

  // BB pass-4 F1 closure: cursor write moves INSIDE the Effect.gen so the
  // sequence (sink.write + cursor advance) commits as one unit. If
  // sink.write throws, the cursor is not advanced. NFR-14 transactional
  // semantics now hold within a single fiber (cross-process safety still
  // depends on the singleton invariant — NFR-21 — until proper-lockfile
  // installs).
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
      // First-tick + no-events no-op. Touch cursor's updated_at only —
      // event_time stays at the initial value so the next overlap-window
      // fetch still queries from the original since_ts. (BB pass-4 F2.)
      const idleCursor: EventCursor = {
        ...cursor,
        updated_at: now,
      };
      _saveCursor(idleCursor);
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

    // F1 transactional commit: sink write FIRST, then cursor save. If
    // sink.write throws, the Effect propagates the failure and the cursor
    // is never advanced; the next tick reprocesses the same window.
    yield* _(sink.write(tickOutput.stir));

    // BB pass-4 F2 closure: on idle ticks (zero events fetched), do NOT
    // advance event_time. The 6h score-mibera ingestion ceiling means
    // chain events with old `occurred_at` can arrive late in bronze;
    // advancing event_time on idle would skip them at the next fetch.
    // Only `updated_at` moves on idle. event_time advances only when real
    // events were processed (using fetched.nextCursor from the score-mcp
    // response).
    if (fetched.events.length > 0) {
      _saveCursor(fetched.nextCursor);
    } else {
      const idleCursor: EventCursor = {
        ...cursor,
        updated_at: now,
      };
      _saveCursor(idleCursor);
    }

    return {
      events_fetched: fetched.events.length,
      cursor_advanced: fetched.events.length > 0,
      quarantined: fetched.quarantinedCount,
    };
  });

  try {
    // BB pass-5 F8: cast type now matches the Effect return exactly
    // (no dangling nextCursor since cursor save is internalized).
    const result = (await ambientRuntime.runPromise(program)) as {
      events_fetched: number;
      cursor_advanced: boolean;
      quarantined: number;
    };
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
