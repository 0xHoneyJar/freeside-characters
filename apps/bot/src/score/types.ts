/**
 * Score-MCP contract types — mirrors zerker's `feature/score-mcp` branch
 * at score-api/src/mcp/schemas/raw-stats.ts (RAW_STATS_SCHEMA_VERSION 1.0.0).
 *
 * These types are kept in sync until the score-vault repo lands and we can
 * import from `@score-vault/ports`. Until then, these mirror what zerker's
 * MCP server returns from `get_zone_digest`.
 */

export const RAW_STATS_SCHEMA_VERSION = '1.0.0';

// ──────────────────────────────────────────────────────────────────────
// Zones (festival metaphor — zerker's flavor choice)
// ──────────────────────────────────────────────────────────────────────
//
// CURRENT ZONES (4 postable):
//   - stonehenge:  cross-dim hub / leaderboard center (NOT a dimension)
//   - bear-cave:   og dimension       (LIVE)
//   - el-dorado:   nft dimension      (LIVE — discord display: "agora")
//   - owsley-lab:  onchain dimension  (LIVE)
//
// FUTURE ZONES (per operator 2026-04-30 — prep for 5 dims + hub = 6):
//   - tl  → Timeline / HÖR        (NOT LIVE in score yet — 5th zone TBD)
//   - irl → Poppy Field           (NOT LIVE in score yet — 6th zone TBD)
// When score-mibera adds tl/irl scoring + Eileen names the Discord
// channels, expand:
//   ZoneId, ZONE_IDS, ZONE_TO_DIMENSION, ZONE_FLAVOR
//   apps/bot/src/agent/rosenzu/lynch-primitives.ts (vocab + KANSEI)
//   .env.example (DISCORD_CHANNEL_<NEW> per server)
//
// midi's Dimension type is `og | nft | onchain | tl | irl`; ruggy
// currently maps only the 3 live + hub. Drift is intentional — channels
// don't exist for tl/irl yet, so the zones aren't postable.

export type ZoneId = 'stonehenge' | 'bear-cave' | 'el-dorado' | 'owsley-lab';
export type DimensionId = 'og' | 'nft' | 'onchain';
export type ZoneDimension = DimensionId | 'overall';

export const ZONE_IDS: readonly ZoneId[] = [
  'stonehenge',
  'bear-cave',
  'el-dorado',
  'owsley-lab',
] as const;

export const ZONE_TO_DIMENSION = {
  stonehenge: 'overall',
  'bear-cave': 'og',
  'el-dorado': 'nft',
  'owsley-lab': 'onchain',
} as const satisfies Record<ZoneId, ZoneDimension>;

export const ZONE_FLAVOR = {
  stonehenge: { emoji: '🗿', name: 'stonehenge', dimension: 'overall' },
  'bear-cave': { emoji: '🐻', name: 'bear-cave', dimension: 'og' },
  'el-dorado': { emoji: '⛏️', name: 'el-dorado', dimension: 'nft' },
  'owsley-lab': { emoji: '🧪', name: 'owsley-lab', dimension: 'onchain' },
} as const satisfies Record<ZoneId, { emoji: string; name: string; dimension: ZoneDimension }>;

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && (ZONE_IDS as readonly string[]).includes(value);
}

// ──────────────────────────────────────────────────────────────────────
// raw_stats v1.0.0 (mirrors score-api raw-stats.ts)
// ──────────────────────────────────────────────────────────────────────

export interface TopMover {
  wallet: string;        // 0x[40 hex chars]
  rank_delta: number;    // signed int
  dimension: DimensionId;
  prior_rank: number | null;
  current_rank: number | null;
  ens?: string;
}

export interface Spotlight {
  wallet: string;
  reason: 'rank_climb' | 'new_badge';
  details: Record<string, unknown>;
}

export interface FactorTrend {
  factor_id: string;     // 'og:sets', 'nft:mibera', 'onchain:lp_provide'
  current_count: number;
  baseline_avg: number;
  multiplier: number;    // current vs baseline
}

export interface RecentEvent {
  event_id: string;      // uuid
  wallet: string;
  factor_id: string;
  raw_value: number;
  timestamp: string;     // ISO-8601
}

export interface RankChanges {
  climbed: TopMover[];
  dropped: TopMover[];
  entered_top_tier: TopMover[];
  exited_top_tier: TopMover[];
}

/**
 * Score raw_stats — supports v1.0.0 and v2.0.0.
 *
 * v2 (score-mibera PR #75, merged 2026-04-29) renamed sample-derived
 * counts and ADDED real window totals:
 *   total_events  → top_event_count   (sample-derived, capped)
 *   active_wallets → top_wallet_count (sample-derived, unique)
 *   NEW: window_event_count  (actual total events in window)
 *   NEW: window_wallet_count (actual unique wallets in window)
 *
 * Score's parseRow auto-migrates v1 → v2 on read, so consumers see
 * v2 shape post-deploy. We treat all v1 fields as optional + carry
 * v2 fields as the canonical surface. RuntimeShape branch on
 * schema_version when we need to disambiguate.
 */
export interface RawStats {
  schema_version: '1.0.0' | '2.0.0';
  /** v2: real total events in window. v1: same as top_event_count (sample). */
  window_event_count?: number;
  /** v2: real unique wallets in window. v1: same as top_wallet_count (sample). */
  window_wallet_count?: number;
  /** v2: count of events surfaced in `top_events` (sample). v1 emitted as `total_events`. */
  top_event_count?: number;
  /** v2: unique wallets across `top_events` + `rank_changes` (sample). v1 emitted as `active_wallets`. */
  top_wallet_count?: number;
  /** v1 alias — score-mcp v1.1.0 emits this. Migrate to top_event_count on read. */
  total_events?: number;
  /** v1 alias — score-mcp v1.1.0 emits this. Migrate to top_wallet_count on read. */
  active_wallets?: number;
  top_movers: TopMover[];
  top_events: RecentEvent[];
  spotlight: Spotlight | null;
  rank_changes: RankChanges;
  factor_trends: FactorTrend[];
}

/** Helpers to read counts regardless of v1/v2 shape. */
export function getWindowEventCount(stats: RawStats): number {
  return stats.window_event_count ?? stats.top_event_count ?? stats.total_events ?? 0;
}

export function getWindowWalletCount(stats: RawStats): number {
  return stats.window_wallet_count ?? stats.top_wallet_count ?? stats.active_wallets ?? 0;
}

export function getTopEventCount(stats: RawStats): number {
  return stats.top_event_count ?? stats.total_events ?? 0;
}

export function getTopWalletCount(stats: RawStats): number {
  return stats.top_wallet_count ?? stats.active_wallets ?? 0;
}

// ──────────────────────────────────────────────────────────────────────
// Narrative shape (score-analyst's pre-written measured voice)
// ──────────────────────────────────────────────────────────────────────

export type NarrativeSectionKind = 'movers' | 'spotlight' | 'trend';

export interface NarrativeSection {
  kind: NarrativeSectionKind;
  body: string;          // ≤80 words, may contain {{stats.<path>}} placeholders post-substituted
}

export interface NarrativeShape {
  headline: string;      // ≤100 chars
  sections: NarrativeSection[];
}

// ──────────────────────────────────────────────────────────────────────
// MCP tool: get_zone_digest response
// ──────────────────────────────────────────────────────────────────────

export interface ZoneDigest {
  zone: ZoneId;
  window: 'weekly';
  computed_at: string;            // ISO-8601
  window_start: string;
  window_end: string;
  stale: boolean;
  schema_version: string;
  /** Score-analyst's first-pass narrative — already number-substituted, fact-checked */
  narrative: NarrativeShape | null;
  narrative_error?: string | null;
  narrative_error_hint?: string | null;
  /** Deterministic data; ruggy can cite anything here without inventing */
  raw_stats: RawStats;
}

// ──────────────────────────────────────────────────────────────────────
// MCP tool: get_zone_digest input
// ──────────────────────────────────────────────────────────────────────

export interface GetZoneDigestArgs {
  zone: ZoneId;
  window?: 'weekly';
}
