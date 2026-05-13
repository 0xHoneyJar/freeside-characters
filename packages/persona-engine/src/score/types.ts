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
  stonehenge: { emoji: '🗿', name: 'Stonehenge', dimension: 'overall' },
  'bear-cave': { emoji: '🐻', name: 'Bear Cave', dimension: 'og' },
  'el-dorado': { emoji: '⛏️', name: 'El Dorado', dimension: 'nft' },
  'owsley-lab': { emoji: '🧪', name: 'Owsley Lab', dimension: 'onchain' },
} as const satisfies Record<ZoneId, { emoji: string; name: string; dimension: ZoneDimension }>;

/**
 * Display-cased dimension names — used in prose where the dimension reads as
 * a proper noun ("the Onchain dimension"), not as a kebab routing key.
 * The DimensionId type stays lowercase for routing/code parity.
 */
export const DIMENSION_NAME = {
  og: 'OG',
  nft: 'NFT',
  onchain: 'Onchain',
  overall: 'Overall',
} as const satisfies Record<ZoneDimension, string>;

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

// ══════════════════════════════════════════════════════════════════════
// Cycle-021 ruggy-pulse-mcp — 4 new pulse-shaped tools (score-mibera PR #111)
// ══════════════════════════════════════════════════════════════════════
//
// Hand-mirrored from score-mibera/src/mcp/tools/* + the *.v1.json response
// schemas at score-mibera/src/mcp/schemas/. All four tools emit
// `schema_version: '1.0.0'` and an ISO-8601 `generated_at`. Wire-format
// stability: `schema_version` is a pinned const, not a pattern.
//
// Cadence ownership: operator-scheduled (cron-wired), not agent-chosen.
// Ruggy's persona prompt selects WHICH tool to call given a fired schedule;
// it does NOT decide WHEN to post. Window param + generated_at support any
// operator cadence (weekly summary / daily recap / hourly ticker).

export type PulseWindow = 7 | 30 | 90;
export type PulseDimension = 'og' | 'nft' | 'onchain';

// ──────────────────────────────────────────────────────────────────────
// get_community_counts — windowed KPI snapshot
// ──────────────────────────────────────────────────────────────────────

export interface CommunityCountsCoreFields {
  active_members: number;       // active_in_window
  active_7d: number;             // always-7d definitional signal
  new_in_window: number;
  inactive_30d: number;
  recently_churned: number;
  stickiness: number | null;     // active_7d / active_30d (DAU/MAU)
}

export interface CommunityCountsNullableFields {
  active_members: number | null;
  active_7d: number | null;
  new_in_window: number | null;
  inactive_30d: number | null;
  recently_churned: number | null;
  stickiness: number | null;
}

export interface GetCommunityCountsArgs {
  window: PulseWindow;
}

export interface GetCommunityCountsResponse extends CommunityCountsCoreFields {
  window_days: PulseWindow;
  /** Same field set, prior-period anchor. Values are null if prior data missing. */
  previous: CommunityCountsNullableFields;
  /** PoP percent change for each field. null when prior is 0 (never Infinity). */
  deltas: CommunityCountsNullableFields;
  schema_version: '1.0.0';
  generated_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// get_dimension_breakdown — per-dim activity ordering + cold factors
// ──────────────────────────────────────────────────────────────────────

export interface PulseDimensionFactor {
  factor_id: string;
  display_name: string;
  /** Verb-style action label (e.g. "Boosted Validator"). null if not set in catalog. */
  primary_action: string | null;
  total: number;
  previous: number;
  delta_pct: number | null;
  delta_count: number;
}

export interface PulseDimensionBreakdown {
  id: PulseDimension;
  display_name: string;
  total_events: number;
  previous_period_events: number;
  delta_pct: number | null;
  delta_count: number;
  /** Count of factors in this dimension's catalog with zero events in window. */
  inactive_factor_count: number;
  total_factor_count: number;
  /** ALL active factors (total > 0), sorted desc by total, factor_id ASC tie-break. */
  top_factors: PulseDimensionFactor[];
  /** ALL zero-row factors, sorted asc by display_name, factor_id ASC tie-break. */
  cold_factors: PulseDimensionFactor[];
}

export interface GetDimensionBreakdownArgs {
  window: PulseWindow;
  /** Omit (or undefined) to return all 3 dimensions; set to filter. NO 'all' literal. */
  dimension?: PulseDimension;
}

export interface GetDimensionBreakdownResponse {
  dimensions: PulseDimensionBreakdown[];
  schema_version: '1.0.0';
  generated_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// get_recent_events — flat list + by_factor roll-up
// ──────────────────────────────────────────────────────────────────────

export interface RecentEventRow {
  event_id: string;
  wallet: string;
  factor_id: string;
  factor_display_name: string;
  dimension: PulseDimension;
  category_key: string;
  /** Server-formatted human-readable string (e.g. "Minted Candies #3221"). */
  description: string;
  raw_value: number | null;
  raw_value_kind: string;
  timestamp: string;             // ISO-8601
}

export interface ByFactorRollup {
  factor_id: string;
  factor_display_name: string;
  dimension: PulseDimension;
  /** Event-volume count (not unique participants). */
  count: number;
  /** Up to 3 distinct wallets (case-preserved from first occurrence; dedup is case-insensitive). */
  sample_wallets: string[];
}

export interface GetRecentEventsArgs {
  /** Default 50, max 200. */
  limit?: number;
  dimension?: PulseDimension;
}

export interface GetRecentEventsResponse {
  events: RecentEventRow[];
  /** Grouped by factor_id, ordered by count DESC + factor_id ASC tie-break. */
  by_factor: ByFactorRollup[];
  schema_version: '1.0.0';
  generated_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// get_most_active_wallets — ranked wallets in window
// ──────────────────────────────────────────────────────────────────────

export interface MostActiveWalletEntry {
  /** 1-indexed, derived from array order. */
  rank: number;
  wallet: string;
  event_count: number;
  primary_dimension: PulseDimension;
  /** Distinct dimensions this wallet was active in. */
  dimension_count: number;
  first_event_at: string;
  last_event_at: string;
}

export interface GetMostActiveWalletsArgs {
  window: PulseWindow;
  /** Default 10, max 100. */
  limit?: number;
  /** Default 'all'. */
  dimension?: PulseDimension | 'all';
}

export interface GetMostActiveWalletsResponse {
  window_days: PulseWindow;
  wallets: MostActiveWalletEntry[];
  /** Count of all wallets matching the window+filters, before LIMIT. */
  total_candidates: number;
  schema_version: '1.0.0';
  generated_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// Pulse error envelopes (shared with all 4 tools)
// ──────────────────────────────────────────────────────────────────────
//
// Tools return either a success response (one of the *Response interfaces
// above) OR an error envelope inside `result.content[0].text`. SDK-layer
// rejections (zod parse failures) come back as JSON-RPC `error` at the
// envelope level — those never reach `result`. See score-mibera SDD §7.

export interface FeatureDisabledEnvelope {
  error: 'feature_disabled';
  code: 'FEATURE_DISABLED';
  message: string;
}

export interface UpstreamErrorEnvelope {
  error: 'upstream_error';
  code: 'UPSTREAM_ERROR';
  tool: string;
  message: string;
}

export type PulseErrorEnvelope = FeatureDisabledEnvelope | UpstreamErrorEnvelope;

/** Type-narrowing helper for pulse-tool consumers. */
export function isPulseError(v: unknown): v is PulseErrorEnvelope {
  return (
    typeof v === 'object' &&
    v !== null &&
    'code' in v &&
    ((v as { code: string }).code === 'FEATURE_DISABLED' ||
      (v as { code: string }).code === 'UPSTREAM_ERROR')
  );
}
