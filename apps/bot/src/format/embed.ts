/**
 * Discord embed builder for the weekly digest.
 *
 * Per persona doc "Discord-as-Material" section:
 * - ALWAYS populate `message.content` as graceful fallback for users
 *   with embeds disabled. Silent failures are not acceptable.
 * - Sidebar color carries week-over-week direction at a glance.
 * - Inline fields > ASCII tables (mobile-resilient).
 * - Footer in subtext for muted metadata.
 */

import type { ActivitySummary } from '../score/types.ts';
import { escapeDiscordMarkdown } from './sanitize.ts';

/** Discord embed color codes (decimal) */
const COLORS = {
  green: 0x2ecc71, // up / healthy / yield-positive
  red: 0xe74c3c, // down / exploit / liquidation
  gray: 0x95a5a6, // neutral / quiet
  yellow: 0xf39c12, // partial / warning
} as const;

export interface DigestPayload {
  /** Plain-text fallback (graceful degradation when embeds disabled) */
  content: string;
  /** The rich embed (single, lean — no thumbnails, no author) */
  embeds: DiscordEmbed[];
}

export interface DiscordEmbed {
  color?: number;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

export function buildDigestPayload(
  summary: ActivitySummary,
  voice: string,
): DigestPayload {
  const direction = summary.windowComparison?.direction ?? 'flat';
  const isThin = summary.totals.eventCount < 100;

  const color = isThin
    ? COLORS.yellow
    : direction === 'up'
      ? COLORS.green
      : direction === 'down'
        ? COLORS.red
        : COLORS.gray;

  // Plain-text fallback — appears above embed; visible even if embeds disabled
  const fallback = buildFallbackContent(summary);

  // The embed body IS the LLM's voice output. Sanitize it for Discord rendering.
  const description = escapeDiscordMarkdown(voice);

  // Footer carries deterministic provenance — the "computed at" line
  const footerText = `computed at ${new Date(summary.computedAt).toISOString()} · score-mibera`;

  return {
    content: fallback,
    embeds: [
      {
        color,
        description,
        footer: { text: footerText },
      },
    ],
  };
}

/**
 * Build the graceful-fallback content line. Brief, evidence-first,
 * carries the headline counts so users with embeds disabled still see
 * the digest.
 */
function buildFallbackContent(summary: ActivitySummary): string {
  const window = summary.window;
  return `📊 ${summary.worldId} ${summary.appId ?? ''} · ${window.granularity} digest · ${summary.totals.eventCount} events`.trim();
}
