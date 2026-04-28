/**
 * Cron scheduler for the weekly digest.
 *
 * Default: Sunday UTC midnight (`0 0 * * 0`). Configurable via env:
 *   DIGEST_DAY=sunday|monday|...|saturday
 *   DIGEST_HOUR_UTC=0..23
 *   DIGEST_CADENCE=weekly|daily|manual
 */

import cron from 'node-cron';
import type { Config } from '../config.ts';

const DAY_TO_CRON: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ScheduleHandle {
  expression: string;
  task: cron.ScheduledTask;
  stop: () => void;
}

export function scheduleDigest(
  config: Config,
  onFire: () => Promise<void>,
): ScheduleHandle | null {
  if (config.DIGEST_CADENCE === 'manual') {
    console.log('ruggy: cadence=manual — no cron scheduled. trigger via `bun run digest:once`.');
    return null;
  }

  const hour = config.DIGEST_HOUR_UTC;
  const dow = DAY_TO_CRON[config.DIGEST_DAY] ?? 0;

  const expression =
    config.DIGEST_CADENCE === 'daily'
      ? `0 ${hour} * * *` // every day at HH:00 UTC
      : `0 ${hour} * * ${dow}`; // weekly at HH:00 UTC on chosen DOW

  if (!cron.validate(expression)) {
    throw new Error(`invalid cron expression: ${expression}`);
  }

  const task = cron.schedule(
    expression,
    async () => {
      try {
        await onFire();
      } catch (err) {
        console.error('ruggy: digest fire failed:', err);
      }
    },
    { timezone: 'UTC' },
  );

  return {
    expression,
    task,
    stop: () => task.stop(),
  };
}
