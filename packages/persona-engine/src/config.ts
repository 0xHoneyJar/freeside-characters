import { z } from 'zod';
import type { ZoneId } from './score/types.ts';

const ConfigSchema = z.object({
  // ─── stub mode ────────────────────────────────────────────────────────
  STUB_MODE: z.string().default('true').transform((v) => v === 'true'),

  // ─── explicit LLM provider (V0.4 — codex-rescue F1: replace implicit
  // key-presence inference; fail loud if intent is ambiguous) ────────────
  /** stub | anthropic | freeside | bedrock | auto.
   *
   *  V0.12 auto-rule (operator-named 2026-05-01 · cost-bearing default):
   *  bedrock-first when AWS env present (AWS_BEARER_TOKEN_BEDROCK or
   *  BEDROCK_API_KEY) → anthropic (dev/local fallback when ANTHROPIC_API_KEY
   *  is set) → stub (STUB_MODE=true) → freeside. ANTHROPIC_API_KEY remains
   *  an explicit opt-in for dev — set `LLM_PROVIDER=anthropic`, or unset
   *  the AWS bedrock env vars in your dev shell.
   *
   *  Defaults to 'auto'; recommend an explicit value in production for
   *  legibility (silences the boot-log notice). */
  LLM_PROVIDER: z.enum(['stub', 'anthropic', 'freeside', 'bedrock', 'auto']).default('auto'),

  // ─── score-mcp (zerker — production data path) ────────────────────────
  // Direct path (V0.5-): SCORE_API_URL=https://score-api-production.up.railway.app, MCP_KEY set, SCORE_BEARER unset.
  // Gateway path (V0.7+): SCORE_API_URL=https://mcp.0xhoneyjar.xyz/score, MCP_KEY + SCORE_BEARER both set.
  // The gateway is registry-shaped: it declares each upstream's auth via the federation manifest;
  // callers compose the request from the declaration. SCORE_BEARER passes the gateway gate;
  // X-MCP-Key (sourced from MCP_KEY) satisfies the upstream's announced auth.
  SCORE_API_URL: z.string().url().default('https://score-api-production.up.railway.app'),
  SCORE_API_KEY: z.string().optional(),
  MCP_KEY: z.string().optional(),
  /** Bearer for the freeside-mcp-gateway gate. Matches the gateway's
   *  `TENANT_SCORE_API_KEY` env. Unset = direct route (no gateway gate). */
  SCORE_BEARER: z.string().optional(),

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

  // ─── amazon bedrock-native ────────────────────────────────────────────
  AWS_REGION: z.string().default('eu-central-1'),
  AWS_BEARER_TOKEN_BEDROCK: z.string().optional(),
  BEDROCK_API_KEY: z.string().optional(),

  BEDROCK_TEXT_REGION: z.string().default('us-west-2'),
  BEDROCK_TEXT_MODEL_ID: z.string().optional(),
  BEDROCK_STABILITY_MODEL_ID: z.string().optional(),

  BEDROCK_IMAGE_REGION: z.string().default('us-east-1'),
  BEDROCK_IMAGE_TEXT_TO_IMAGE_REGION: z.string().default('us-west-2'),

  BEDROCK_IMAGE_DEFAULT_ACTION: z.enum([
    'text-to-image',
    'style-transfer',
    'style-guide',
    'search-and-replace',
    'search-and-recolor',
    'remove-background',
    'outpaint',
    'inpaint',
    'fast-upscale',
    'erase-object',
    'creative-upscale',
    'control-structure',
    'control-sketch',
    'conservative-upscale',
  ]).default('text-to-image'),

  BEDROCK_IMAGE_TEXT_TO_IMAGE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_STYLE_TRANSFER_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_STYLE_GUIDE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_SEARCH_AND_REPLACE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_SEARCH_AND_RECOLOR_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_REMOVE_BACKGROUND_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_OUTPAINT_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_INPAINT_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_FAST_UPSCALE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_ERASE_OBJECT_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_CREATIVE_UPSCALE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_CONTROL_STRUCTURE_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_CONTROL_SKETCH_MODEL_ID: z.string().optional(),
  BEDROCK_IMAGE_CONSERVATIVE_UPSCALE_MODEL_ID: z.string().optional(),

  // ─── anthropic-direct (V0 LLM testing) ────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Default flipped sonnet-4-6 → opus-4-7 (operator pick 2026-04-30 ·
   *  V0.7-A.0 ship pass · highest voice-fidelity model for both digest
   *  and chat-mode pipelines). Override via env when a per-deploy cost
   *  tradeoff calls for sonnet/haiku. */
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-7'),

  /**
   * V0.7-A.1 Phase D — chat-mode tool surface routing.
   *
   *   `auto` (default)   — Use orchestrator path when LLM_PROVIDER resolves
   *                        to anthropic (full per-character MCP scope at
   *                        chat time). Fall back to naive `invokeChat()`
   *                        for stub/freeside/bedrock providers.
   *   `orchestrator`     — Force orchestrator path. Errors at runtime if
   *                        the resolved provider isn't anthropic.
   *   `naive`            — Force the V0.7-A.0 single-turn path (no MCPs,
   *                        no tools). Revert hatch when chat-mode tool use
   *                        regresses voice fidelity or otherwise misbehaves.
   *
   * The orchestrator path is what closes the operator's "ChatGPT-natural
   * tool use" gap (per kickoff 2026-05-01). The naive path is the V0.7-A.0
   * floor — works on every provider, no tools.
   */
  CHAT_MODE: z.enum(['auto', 'orchestrator', 'naive']).default('auto'),

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
