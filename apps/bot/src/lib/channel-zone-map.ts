/**
 * channel-zone-map — canonical channel↔zone reverse map (Sprint 1 / Phase B).
 *
 * The forward direction (`zone → channelId`) lives at
 * `packages/persona-engine/src/config.ts:166-177` (`getZoneChannelId`). The
 * reverse direction (`channelId → ZoneId`) was missing — without it, no chat
 * handler could answer "which codex location am I in?" without a hand-rolled
 * lookup. This module fills that gap.
 *
 * Pure TypeScript, no runtime deps. Both functions are pure and synchronous.
 *
 * Spec: grimoires/loa/specs/build-environment-substrate-v07a1.md (Phase B)
 */

import type { Config, ZoneId } from '@freeside-characters/persona-engine';
import {
  ALL_ZONES,
  ZONE_REGISTRY,
  getZoneChannelId,
} from '@freeside-characters/persona-engine';

/**
 * Resolve a Discord channel ID to its codex zone, if any.
 *
 * Delegates to `getZoneChannelId` in a single-pass scan over `ALL_ZONES` so
 * the forward map (config.ts) stays the single source of truth. If a future
 * env-key rename happens, only `getZoneChannelId` needs updating.
 *
 * Returns `undefined` for channels outside the four codex-mapped zones.
 */
export function getZoneForChannel(config: Config, channelId: string): ZoneId | undefined {
  return ALL_ZONES.find((zone) => getZoneChannelId(config, zone) === channelId);
}

/**
 * Return zone metadata (emoji + display name + dimension) for prompt-block
 * grounding. Sync read from `ZONE_REGISTRY` in `packages/persona-engine/src/domain/zone-registry.ts`.
 *
 * cycle-007 S1/T1.3: migrated from ZONE_FLAVOR → ZONE_REGISTRY (canonical resolver).
 * API contract preserved · returns same `{name, dimension, emoji}` shape via field-aliasing.
 *
 * Task 1.2 decision (V1): sync constant. The async-MCP variant
 * (codex-mcp `lookup_zone`) becomes available only once chat-mode wires
 * through the orchestrator (Phase D / Sprint 3); until then, `ZONE_REGISTRY`
 * is the canonical zone-anchor source.
 */
export function getCodexAnchorForZone(
  zone: ZoneId,
): { name: string; dimension: string; emoji: string } {
  const record = ZONE_REGISTRY[zone];
  return { name: record.displayName, dimension: record.dimension, emoji: record.emoji };
}
