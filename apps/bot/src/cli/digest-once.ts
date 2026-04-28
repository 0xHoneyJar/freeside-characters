/**
 * digest-once — fire a single digest and exit.
 *
 * Useful for: local validation, manual cadence runs, CI smoke tests,
 * cron-equivalent invocation from external schedulers (e.g., Trigger.dev,
 * GHA workflow_dispatch, AWS EventBridge target).
 *
 * Usage:
 *   bun run digest:once
 *   STUB_MODE=true bun run digest:once
 *   STUB_MODE=true DISCORD_WEBHOOK_URL=https://... bun run digest:once
 */

import { loadConfig, isDryRun } from '../config.ts';
import { composeDigest } from '../llm/digest.ts';
import { deliverDigest } from '../discord/webhook.ts';

async function main(): Promise<void> {
  const config = loadConfig();

  console.log('ruggy: digest-once · firing immediately');
  console.log(`mode: ${config.STUB_MODE ? 'STUB' : 'LIVE'} · delivery: ${isDryRun(config) ? 'DRY-RUN' : 'WEBHOOK'}`);

  const t0 = Date.now();
  const { summary, payload } = await composeDigest(config);
  console.log(`composed in ${Date.now() - t0}ms — ${summary.totals.eventCount} events, ${summary.totals.activeActors} actors`);

  const result = await deliverDigest(config, payload);
  if (result.posted) {
    console.log(`posted (status ${result.status})`);
  } else if (result.dryRun) {
    console.log('dry-run complete (set DISCORD_WEBHOOK_URL to actually post)');
  }
}

main().catch((err) => {
  console.error('ruggy digest-once failed:', err);
  process.exit(1);
});
