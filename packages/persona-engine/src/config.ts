import { z } from 'zod';
import type { ZoneId } from './score/types.ts';

const ConfigSchema = z.object({
  // ─── stub mode ────────────────────────────────────────────────────────
  STUB_MODE: z.string().default('true').transform((v) => v === 'true'),

  // ─── explicit LLM provider (V0.4 — codex-rescue F1: replace implicit
  // key-presence inference; fail loud if intent is ambiguous) ────────────
  /** stub | anthropic | freeside | bedrock | auto (auto = back-compat:
   *  anthropic key wins → stub → freeside, matching V0.3 behavior).
   *  Bedrock is opt-in only; auto does NOT fall back to bedrock by design.
   *  Defaults to 'auto' for back-compat; recommend explicit value in production. */
  LLM_PROVIDER: z.enum(['stub', 'anthropic', 'freeside', 'bedrock', 'auto']).default('auto'),

  // ─── score-mcp (zerker — production data path) ────────────────────────
  SCORE_API_URL: z.string().url().default('https://score-api-production.up.railway.app'),
  SCORE_API_KEY: z.string().optional(),
  MCP_KEY: z.string().optional(),

  // ─── codex-mcp (gumi — mibera-codex lookup, public, no auth) ──────────
  /**
   * HTTP base URL of the codex MCP server. When set, the orchestrator
   * registers `mcp__codex__*` tools (lookup_zone, lookup_archetype,
   * lookup_factor, lookup_grail, lookup_mibera, list_zones,
   * list_archetypes, validate_world_element).
   *
   * Local dev: `http://localhost:3000` (run `bun run http` in
   * `0xHoneyJar/construct-mibera-codex`). Railway: TBD when Path B ships.
   * No auth header — codex is public-read.
   */
  CODEX_MCP_URL: z.string().url().optional(),

  // ─── freeside agent-gateway (jani — production LLM path) ──────────────
  FREESIDE_BASE_URL: z.string().url().default('https://api.freeside.0xhoneyjar.xyz'),
  FREESIDE_API_KEY: z.string().optional(),
  FREESIDE_AGENT_MODEL: z.enum(['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect']).default('reasoning'),

  // ─── AWS Bedrock (Eileen's local-satoshi path · LLM_PROVIDER=bedrock) ─
  /** AWS Bedrock API key (newer Bedrock auth method · long-lived bearer). */
  AWS_BEARER_TOKEN_BEDROCK: z.string().optional(),
  /** Alternate Bedrock auth · either AWS_BEARER_TOKEN_BEDROCK or this. */
  BEDROCK_API_KEY: z.string().optional(),
  /** Bedrock model id (e.g. anthropic.claude-sonnet-4-5-20250929-v1:0).
   *  Per-deploy override; Eileen sets this to her region's available model. */
  BEDROCK_MODEL_ID: z.string().optional(),
  /** Bedrock Stability model id for imagegen (e.g.
   *  stability.stable-image-ultra-v1:0 or stability.stable-diffusion-xl-v1).
   *  Separate from BEDROCK_MODEL_ID (chat-mode Claude). When set together
   *  with AWS_REGION, the orchestrator registers the imagegen MCP. */
  BEDROCK_STABILITY_MODEL_ID: z.string().optional(),
  /** AWS region for Bedrock runtime. Eileen sets to her access region. */
  AWS_REGION: z.string().optional(),

  // ─── anthropic-direct (V0 LLM testing) ────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Default flipped sonnet-4-6 → opus-4-7 (operator pick 2026-04-30 ·
   *  V0.7-A.0 ship pass · highest voice-fidelity model for both digest
   *  and chat-mode pipelines). Override via env when a per-deploy cost
   *  tradeoff calls for sonnet/haiku. */
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-7'),

  // ─── discord delivery — bot client OR webhook fallback ────────────────
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

  // ─── per-zone channel mapping (used when DISCORD_BOT_TOKEN is set) ────
  DISCORD_CHANNEL_STONEHENGE: z.string().optional(),
  DISCORD_CHANNEL_BEAR_CAVE: z.string().optional(),
  DISCORD_CHANNEL_EL_DORADO: z.string().optional(),
  DISCORD_CHANNEL_OWSLEY_LAB: z.string().optional(),

  // ─── target / cadence ─────────────────────────────────────────────────
  ZONES: z.string().optional(),
  /** One-shot post-type override (used by digest-once CLI; ignored by scheduler). */
  POST_TYPE: z.enum(['digest', 'micro', 'weaver', 'lore_drop', 'question', 'callout']).optional(),
  /** When true, digest-once picks a random post type per zone instead of using POST_TYPE. */
  MIX: z.string().default('false').transform((v) => v === 'true'),

  // ─── digest backbone (weekly Sunday) ──────────────────────────────────
  DIGEST_CADENCE: z.enum(['weekly', 'daily', 'manual']).default('weekly'),
  DIGEST_DAY: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).default('sunday'),
  DIGEST_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(0),

  // ─── pop-in random cadence (the arcade move) ──────────────────────────
  /** When true, scheduler fires random pop-ins between digests. */
  POP_IN_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  /** Hours between pop-in checks (each check rolls a die per zone). */
  POP_IN_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).default(6),
  /** Per-zone per-tick probability (0..1) of firing a pop-in. Default 0.1
   *  (~1-2 pops/day across 4 zones at 6h ticks). Lowered V0.4 — operator
   *  feedback: don't make ruggy annoying or too persistent. */
  POP_IN_PROBABILITY: z.coerce.number().min(0).max(1).default(0.1),

  // ─── weaver weekly mid-week (cross-zone) ──────────────────────────────
  WEAVER_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  WEAVER_DAY: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).default('wednesday'),
  WEAVER_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(12),
  /** Where weaver posts land — usually stonehenge (cross-zone observatory). */
  WEAVER_PRIMARY_ZONE: z.enum(['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab']).default('stonehenge'),

  // ─── V0.7-A.0 — Discord Interactions endpoint (slash commands) ────────
  /** Ed25519 public key from Discord developer portal. When unset the
   *  interactions server doesn't start (digest cron path is unaffected). */
  DISCORD_PUBLIC_KEY: z.string().optional(),
  /** Port the interactions HTTP server binds to (default 3001). */
  INTERACTIONS_PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // ─── meta ─────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('config validation failed:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}

export function isDryRun(config: Config): boolean {
  if (config.DISCORD_BOT_TOKEN) return false;
  return !config.DISCORD_WEBHOOK_URL || config.DISCORD_WEBHOOK_URL === '';
}

export function getZoneChannelId(config: Config, zone: ZoneId): string | undefined {
  switch (zone) {
    case 'stonehenge':
      return config.DISCORD_CHANNEL_STONEHENGE;
    case 'bear-cave':
      return config.DISCORD_CHANNEL_BEAR_CAVE;
    case 'el-dorado':
      return config.DISCORD_CHANNEL_EL_DORADO;
    case 'owsley-lab':
      return config.DISCORD_CHANNEL_OWSLEY_LAB;
  }
}

export function selectedZones(config: Config): ZoneId[] {
  const all: ZoneId[] = ['stonehenge', 'bear-cave', 'el-dorado', 'owsley-lab'];
  if (!config.ZONES) return all;
  const requested = config.ZONES.split(',').map((s) => s.trim()).filter(Boolean) as ZoneId[];
  return requested.filter((z) => all.includes(z));
}
