/**
 * freeside-ruggy bot — entry point.
 *
 * V1 pipeline:
 *   1. Load config + persona
 *   2. Schedule weekly digest
 *   3. On fire: composeDigest → deliverDigest
 *   4. Stay up (or exit if cadence=manual)
 *
 * Locally:
 *   STUB_MODE=true bun run dev          # stub-mode loop
 *   STUB_MODE=true bun run digest:once  # one-shot dry-run
 */

import { loadConfig, isDryRun } from './config.ts';
import { composeDigest } from './llm/digest.ts';
import { deliverDigest } from './discord/webhook.ts';
import { scheduleDigest } from './cron/scheduler.ts';
import { loadSystemPrompt } from './persona/loader.ts';

const banner = `
─── ruggy · freeside-ruggy v0.1.0 ──────────────────────────────
`.trim();

async function main(): Promise<void> {
  const config = loadConfig();

  console.log(banner);
  console.log(`data:           ${config.STUB_MODE ? 'STUB (synthetic ActivitySummary)' : 'LIVE (score-api)'}`);
  console.log(`llm:            ${describeLlmMode(config)}`);
  console.log(`target:         ${config.WORLD_ID} · ${config.APP_ID}`);
  console.log(`cadence:        ${config.DIGEST_CADENCE}` + (config.DIGEST_CADENCE !== 'manual' ? ` · ${config.DIGEST_DAY} ${String(config.DIGEST_HOUR_UTC).padStart(2, '0')}:00 UTC` : ''));
  console.log(`delivery:       ${isDryRun(config) ? 'DRY-RUN (stdout only)' : 'WEBHOOK (' + config.DISCORD_WEBHOOK_URL!.slice(0, 50) + '...)'}`);

  // Sanity check: persona loads correctly
  try {
    const prompt = loadSystemPrompt();
    console.log(`persona:        loaded (${prompt.length} chars)`);
  } catch (err) {
    console.error('persona load failed:', err);
    process.exit(1);
  }

  console.log('────────────────────────────────────────────────────────────────\n');

  const fire = async (): Promise<void> => {
    const t0 = Date.now();
    console.log(`ruggy: digest fire at ${new Date().toISOString()}`);

    const { summary, payload } = await composeDigest(config);
    console.log(`ruggy: composed (${summary.totals.eventCount} events, ${summary.totals.activeActors} actors)`);

    const result = await deliverDigest(config, payload);
    if (result.posted) {
      console.log(`ruggy: posted (status ${result.status}) in ${Date.now() - t0}ms`);
    } else if (result.dryRun) {
      console.log(`ruggy: dry-run complete in ${Date.now() - t0}ms`);
    }
  };

  // schedule
  const handle = scheduleDigest(config, fire);
  if (handle) {
    console.log(`ruggy: scheduled · ${handle.expression}`);
  }

  // Always fire once on boot (so dev cycles + first-deploy validate)
  if (config.NODE_ENV === 'development' || config.DIGEST_CADENCE === 'manual') {
    console.log('ruggy: firing once on boot (dev/manual mode)');
    await fire();
  }

  if (config.DIGEST_CADENCE === 'manual') {
    console.log('ruggy: manual mode — exiting after single fire');
    process.exit(0);
  }

  // graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\nruggy: ${signal} — shutting down`);
    handle?.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function describeLlmMode(config: ReturnType<typeof loadConfig>): string {
  if (config.ANTHROPIC_API_KEY) return `anthropic-direct (${config.ANTHROPIC_MODEL})`;
  if (config.STUB_MODE) return 'STUB (canned digest)';
  if (config.FREESIDE_API_KEY) return `freeside agent-gw (${config.FREESIDE_AGENT_MODEL})`;
  return 'UNCONFIGURED';
}

main().catch((err) => {
  console.error('ruggy: fatal:', err);
  process.exit(1);
});
