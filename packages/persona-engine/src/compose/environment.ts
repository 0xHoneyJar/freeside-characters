/**
 * environment context builder — V0.7-A.1 Phase C.
 *
 * Pure-function assembly of the `## Environment` system-prompt block that
 * grounds an agent in WHERE it is + WHO else is here + WHAT'S HAPPENING
 * RIGHT NOW + HOW its persona prefers to invoke tools. Substituted into
 * the persona template via `{{ENVIRONMENT}}` placeholder (digest + reply
 * paths · `persona/loader.ts`).
 *
 * Place + moment lens (rosenzu's pair):
 *   place  — zone identity (emoji + name + dimension) from ZONE_FLAVOR
 *   moment — temperature + social density + tonal grounding via the
 *            derivation helpers in lynch-primitives.ts (same logic the
 *            `mcp__rosenzu__read_room` tool exposes; LLM can re-call
 *            mid-turn for a fresh read)
 *
 * Civic-layer note: this is substrate work. The block is REFERENCE for
 * the LLM, not voice — persona governs voice; environment grounds context.
 *
 * Spec: grimoires/loa/specs/build-environment-substrate-v07a1.md (Phase C)
 */

import type { CharacterConfig } from '../types.ts';
import type { ZoneId } from '../score/types.ts';
import { ZONE_FLAVOR } from '../score/types.ts';
import {
  ZONE_SPATIAL,
  deriveSocialDensity,
  deriveTemperature,
  type SpatialZoneId,
} from '../orchestrator/rosenzu/lynch-primitives.ts';

/**
 * Minimal shape for a recent channel message — decoupled from any
 * Discord-specific entity. Callers (dispatch handler, orchestrator) supply
 * what's available; the builder degrades gracefully when fields are missing.
 */
export interface RecentMessage {
  authorUsername: string;
  content: string;
  /** ms-since-epoch · used to compute minutes-since-last-post. Optional. */
  timestampMs?: number;
}

export interface BuildEnvironmentContextArgs {
  character: CharacterConfig;
  /** Zone resolved by caller from channelId (apps/bot owns the reverse map). */
  zone: ZoneId | undefined;
  recentMessages?: RecentMessage[];
  /** Other characters loaded into the same Discord shell (CHARACTERS env). */
  otherCharactersHere?: string[];
  /** Optional override for "now" — deterministic snapshot tests. */
  nowMs?: number;
}

/**
 * Build the `## Environment` block. Returns empty string when nothing useful
 * to say (no zone + no tool guidance + no presence). Otherwise returns a
 * structured headed block: 4-6 lines, scannable, no prose paragraphs.
 *
 * Substituted into persona templates via `{{ENVIRONMENT}}` placeholder.
 * If a template doesn't reference the placeholder, this output is dropped
 * silently (the substitution is a no-op).
 *
 * Size budget per spec line 511: target ≤300 tokens, hard cap ≤500. Typical
 * output is ~80-120 tokens for a fully-populated block.
 */
export function buildEnvironmentContext(args: BuildEnvironmentContextArgs): string {
  const codexAnchor = args.zone ? ZONE_FLAVOR[args.zone] : null;
  const profile = args.zone ? ZONE_SPATIAL[args.zone as SpatialZoneId] : null;

  // moment-half: derive room read inline (same helpers `mcp__rosenzu__read_room` uses)
  let roomReadLine: string | null = null;
  if (args.zone && profile) {
    const messageCount = args.recentMessages?.length ?? 0;
    const lastTimestamp = args.recentMessages?.at(-1)?.timestampMs;
    const minutes = minutesSince(lastTimestamp, args.nowMs);
    const temperature = deriveTemperature(messageCount, minutes);

    const presence = uniq([
      ...(args.otherCharactersHere ?? []),
      ...(args.recentMessages?.map((m) => m.authorUsername) ?? []),
    ]);
    const social_density = deriveSocialDensity(presence.length);

    roomReadLine = `Room read: ${temperature} · ${social_density} · ${profile.archetype} · ${profile.era}`;
  }

  const parts: (string | null)[] = [
    args.zone && codexAnchor
      ? `You are in ${codexAnchor.emoji} #${args.zone} — ${codexAnchor.name} (${codexAnchor.dimension} dimension).`
      : `You are in a Discord channel outside the codex-mapped zones.`,
    roomReadLine,
    args.otherCharactersHere && args.otherCharactersHere.length > 0
      ? `Other characters present: ${args.otherCharactersHere.join(', ')}.`
      : null,
    args.character.tool_invocation_style
      ? `Tool guidance: ${args.character.tool_invocation_style}`
      : null,
    args.recentMessages && args.recentMessages.length > 0
      ? `Recent room context: ${args.recentMessages
          .slice(-5)
          .map((m) => `[${m.authorUsername}] ${truncate(m.content, 80)}`)
          .join(' · ')}`
      : null,
  ];

  const body = parts.filter((p): p is string => p !== null).join('\n');
  if (body === '') return '';
  return `## Environment\n${body}`;
}

/**
 * Pull a one-line summary of the most recent few messages — used as the
 * `recent_message_summary` arg to `mcp__rosenzu__read_room` when the LLM
 * (or substrate) wants to seed the room read with conversational flavor.
 *
 * Returns undefined when no messages — the tool treats missing summary as
 * "no flavor known, use archetype-only grounding."
 */
export function summarizeRecent(msgs: RecentMessage[] | undefined): string | undefined {
  if (!msgs || msgs.length === 0) return undefined;
  return msgs
    .slice(-3)
    .map((m) => `${m.authorUsername}: ${truncate(m.content, 40)}`)
    .join(' · ');
}

/**
 * Compute minutes elapsed since a millisecond timestamp. Returns undefined
 * when the timestamp is missing — caller passes that through to
 * `deriveTemperature`, which treats undefined as +Infinity (cold default).
 */
export function minutesSince(timestampMs: number | undefined, nowMs?: number): number | undefined {
  if (timestampMs === undefined) return undefined;
  const now = nowMs ?? Date.now();
  return Math.max(0, Math.floor((now - timestampMs) / 60_000));
}

/** Order-preserving array dedupe. */
export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
