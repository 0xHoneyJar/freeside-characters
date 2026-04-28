import { z } from 'zod';

const ConfigSchema = z.object({
  // stub mode
  STUB_MODE: z.string().default('true').transform((v) => v === 'true'),

  // score-api
  SCORE_API_URL: z.string().url().default('https://score-api-production.up.railway.app'),
  SCORE_API_KEY: z.string().optional(),

  // freeside agent-gateway
  FREESIDE_BASE_URL: z.string().url().default('https://api.freeside.0xhoneyjar.xyz'),
  FREESIDE_API_KEY: z.string().optional(),
  FREESIDE_AGENT_MODEL: z.enum(['cheap', 'fast-code', 'reviewer', 'reasoning', 'architect']).default('reasoning'),

  // discord
  DISCORD_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

  // target
  WORLD_ID: z.string().default('mibera'),
  APP_ID: z.string().default('midi'),
  DIGEST_CADENCE: z.enum(['weekly', 'daily', 'manual']).default('weekly'),
  DIGEST_DAY: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).default('sunday'),
  DIGEST_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(0),

  // meta
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
  return !config.DISCORD_WEBHOOK_URL || config.DISCORD_WEBHOOK_URL === '';
}
