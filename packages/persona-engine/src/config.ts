import { z } from 'zod';
import type { ZoneId } from './score/types.ts';

const ConfigSchema = z.object({
  // ─── stub mode ────────────────────────────────────────────────────────
  STUB_MODE: z.string().default('true').transform((v) => v === 'true'),

  // ─── explicit LLM provider (V0.4 — codex-rescue F1: replace implicit
  // key-presence inference; fail loud if intent is ambiguous) ────────────
  /** stub | anthropic | freeside | auto (auto = back-compat: anthropic key
   *  wins → stub → freeside, matching V0.3 behavior). Defaults to 'auto'
   *  for back-compat; recommend explicit value in production. */
  LLM_PROVIDER: z.enum(['stub', 'anthropic', 'freeside', 'auto']).default('auto'),

  // ─── score-mcp (zerker — production data path) ────────────────────────
  SCORE_API_URL: z.string().url().default('https://score-api-production.up.railway.app'),
  SCORE_API_KEY: z.string().optional(),
  MCP_KEY: z.string().optional(),

  // ─── freeside agent-gateway (jani — production LLM path) ──────────────
  FREESIDE_BASE_URL: z.string().url().default('https://api.freeside.0xhoneyjar.xyz'),
  FREESIDE_API_KEY: z.string().optional(),
  FREESIDE_AGENT_MODEL: z.enum(['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect']).default('reasoning'),

  // ─── anthropic-direct (V0 LLM testing) ────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

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
