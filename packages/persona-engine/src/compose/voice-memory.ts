/**
 * Voice memory — cross-week narrative continuity for ruggy.
 *
 * Operator latitude commit 2026-05-16: "be crazy. creative. loving... mad
 * agent ai stuff that i don't even have the language for". This module
 * gives ruggy a memory of last week's framings, so the Sunday digest is
 * not 4 isolated posts but a CONTINUOUS narration — week N references
 * week N-1 when relevant, allowing arcs to build over months.
 *
 * Storage: append-only JSONL at `.run/ruggy-voice-history.jsonl`. Each
 * entry captures (zone, iso_week, header, outro, key_numbers). On the
 * next compose, the voice-brief reads the prior entry for THIS zone
 * and includes it as context in the LLM prompt. The LLM decides
 * whether to thread continuity or pivot.
 *
 * Why JSONL not a DB: zero-infra. The cron host writes one line per
 * zone per week. After 4 weeks: 16 lines. After a year: ~210 lines.
 * Append-only · grep-able · operator can read with `tail -10`. If we
 * later want richer query, swap to sqlite without changing the producer.
 *
 * Privacy posture: voice text is the bot's own output — no user PII,
 * no wallet addresses (the gate's draft_hash protects against any
 * accidental drift). Storage stays in the project's `.run/` dir which
 * is gitignored.
 */

import { appendFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import type { ZoneId } from '../score/types.ts';
import type { LayoutShape } from './layout-shape.ts';

const DEFAULT_PATH = '.run/ruggy-voice-history.jsonl';

export interface VoiceMemoryEntry {
  /** ISO timestamp of the post that emitted this voice (compose time). */
  at: string;
  /** ISO week identifier · format: `YYYY-Www` (e.g. `2026-W20`). */
  iso_week: string;
  zone: ZoneId;
  shape: LayoutShape;
  /** What ruggy said. The actual chat-medium text. */
  header: string;
  outro: string;
  /** Salient numbers ruggy referenced. Future weeks can compare. */
  key_numbers: {
    total_events: number;
    previous_period_events: number;
    permitted_factor_names: readonly string[];
  };
}

/**
 * ISO-week computation (YYYY-Www format). The Sunday digest fires
 * Sunday UTC midnight — same iso_week for all 4 zones in one cron sweep.
 *
 * Sticks to ISO-8601 standard so external tools (jq + date) can join
 * voice history with substrate history if ever needed.
 */
export function isoWeek(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function resolveHistoryPath(custom?: string): string {
  const p = custom ?? process.env.RUGGY_VOICE_HISTORY_PATH ?? DEFAULT_PATH;
  return resolve(p);
}

/**
 * Append an entry to the JSONL history. Best-effort: errors are caught
 * and logged but never block the compose (the post matters more than
 * the memory · NFR-3 hygiene).
 */
export async function appendVoiceMemory(
  entry: VoiceMemoryEntry,
  opts: { path?: string } = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const path = resolveHistoryPath(opts.path);
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await appendFile(path, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/**
 * Read the most recent prior entry for `zone`. Returns null when:
 *   - history file doesn't exist
 *   - no entry for that zone in the file
 *   - file is malformed (best-effort · log + return null)
 *
 * Reads the file tail (last ~50 lines) by default; older entries are
 * cheap to keep but expensive to scan. If the operator wants arc
 * memory over many months, this function can grow a `--depth N` opt.
 */
export async function readLastVoiceMemory(
  zone: ZoneId,
  opts: { path?: string; maxLines?: number } = {},
): Promise<VoiceMemoryEntry | null> {
  const path = resolveHistoryPath(opts.path);
  const maxLines = opts.maxLines ?? 50;
  if (!existsSync(path)) return null;
  try {
    const text = await readFile(path, 'utf8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const recent = lines.slice(-maxLines);
    // Walk backwards through recent lines, return first match for zone
    for (let i = recent.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(recent[i]!) as VoiceMemoryEntry;
        if (entry.zone === zone) return entry;
      } catch {
        // skip malformed line · continue scanning
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format a prior-week entry as a single-line context string suitable for
 * inclusion in the voice-brief user prompt. Compact form so it doesn't
 * bloat token usage; the LLM gets enough signal to decide
 * continuity-vs-pivot but not the full prior post.
 *
 * Example output:
 *   "last week (2026-W19 · shape A): said 'the bears nap' over 26 events"
 */
export function formatPriorWeekHint(entry: VoiceMemoryEntry): string {
  const namesPart =
    entry.key_numbers.permitted_factor_names.length > 0
      ? ` · names ${entry.key_numbers.permitted_factor_names.slice(0, 3).join(', ')}`
      : '';
  return `last week (${entry.iso_week} · shape ${entry.shape}): said "${entry.header}" over ${entry.key_numbers.total_events} events${namesPart}`;
}
