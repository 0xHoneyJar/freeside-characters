/**
 * Cron scheduler — three concurrent cadences.
 *
 *   1. Weekly digest backbone (Sunday UTC midnight default) — fires
 *      one digest per zone. Per persona "the keeper move" — what
 *      accumulated since last check.
 *
 *   2. Pop-in random cadence (every N hours; per-zone die-roll) — fires
 *      0..1 non-digest pop-in per zone per tick. Per persona "the arcade
 *      move" — surprise > schedule.
 *
 *   3. Weaver weekly mid-week (Wednesday noon UTC default) — fires one
 *      cross-zone weaver post in primary zone (default stonehenge). Per
 *      persona "the weaver move" — connections nobody asked for.
 *
 * All three are independent; can be enabled/disabled separately.
 */

import cron from 'node-cron';
import type { Config } from '../config.ts';
import type { ZoneId } from '../score/types.ts';
import type { PostType } from '../llm/post-types.ts';

const DAY_TO_CRON: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface FireRequest {
  zone: ZoneId;
  postType: PostType;
}

export interface SchedulerHandles {
  digestExpression?: string;
  popInExpression?: string;
  weaverExpression?: string;
  tasks: cron.ScheduledTask[];
  stop: () => void;
}

export interface ScheduleArgs {
  config: Config;
  zones: ZoneId[];
  /** Called for each zone+postType the scheduler decides to fire. */
  onFire: (req: FireRequest) => Promise<void>;
}

export function schedule(args: ScheduleArgs): SchedulerHandles {
  const { config, zones, onFire } = args;
  const tasks: cron.ScheduledTask[] = [];
  const handles: SchedulerHandles = {
    tasks,
    stop: () => tasks.forEach((t) => t.stop()),
  };

  // ─── 1. Weekly digest ───────────────────────────────────────────────
  if (config.DIGEST_CADENCE !== 'manual') {
    const hour = config.DIGEST_HOUR_UTC;
    const dow = DAY_TO_CRON[config.DIGEST_DAY] ?? 0;
    const expr =
      config.DIGEST_CADENCE === 'daily' ? `0 ${hour} * * *` : `0 ${hour} * * ${dow}`;
    if (!cron.validate(expr)) throw new Error(`invalid digest cron: ${expr}`);

    handles.digestExpression = expr;
    tasks.push(
      cron.schedule(
        expr,
        async () => {
          for (const zone of zones) {
            try {
              await onFire({ zone, postType: 'digest' });
            } catch (err) {
              console.error(`scheduler: digest ${zone} failed:`, err);
            }
          }
        },
        { timezone: 'UTC' },
      ),
    );
  }

  // ─── 2. Pop-in random cadence ───────────────────────────────────────
  if (config.POP_IN_ENABLED) {
    const interval = Math.max(1, config.POP_IN_INTERVAL_HOURS);
    const expr = `0 */${interval} * * *`; // every N hours on the hour

    handles.popInExpression = expr;
    tasks.push(
      cron.schedule(
        expr,
        async () => {
          for (const zone of zones) {
            // Per-zone die-roll
            if (Math.random() > config.POP_IN_PROBABILITY) continue;
            // Random non-digest, non-weaver type for pop-ins
            const popInTypes: PostType[] = ['micro', 'lore_drop', 'question'];
            const postType = popInTypes[Math.floor(Math.random() * popInTypes.length)]!;
            try {
              await onFire({ zone, postType });
            } catch (err) {
              console.error(`scheduler: pop-in ${zone}/${postType} failed:`, err);
            }
          }
        },
        { timezone: 'UTC' },
      ),
    );
  }

  // ─── 3. Weaver weekly mid-week ──────────────────────────────────────
  if (config.WEAVER_ENABLED) {
    const hour = config.WEAVER_HOUR_UTC;
    const dow = DAY_TO_CRON[config.WEAVER_DAY] ?? 3;
    const expr = `0 ${hour} * * ${dow}`;

    handles.weaverExpression = expr;
    tasks.push(
      cron.schedule(
        expr,
        async () => {
          try {
            await onFire({ zone: config.WEAVER_PRIMARY_ZONE, postType: 'weaver' });
          } catch (err) {
            console.error('scheduler: weaver failed:', err);
          }
        },
        { timezone: 'UTC' },
      ),
    );
  }

  return handles;
}
