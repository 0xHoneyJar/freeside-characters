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
import type { PostType } from '../compose/post-types.ts';

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

/**
 * Per-zone fire lock — prevents concurrent fires for the same zone when
 * multiple cron tasks (digest/pop-in/weaver) align in time.
 *
 * Per codex-rescue F4: scheduler races on zone state when schedules
 * coincide. Lock per-zone; queued fires drop if already busy.
 */
const zoneLocks = new Map<ZoneId, Promise<void>>();

async function withZoneLock(
  zone: ZoneId,
  fn: () => Promise<void>,
  source: string,
): Promise<void> {
  if (zoneLocks.has(zone)) {
    console.log(`scheduler: ${source} for ${zone} dropped — already firing`);
    return;
  }
  const promise = fn().finally(() => zoneLocks.delete(zone));
  zoneLocks.set(zone, promise);
  await promise;
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
            await withZoneLock(zone, () => onFire({ zone, postType: 'digest' }), 'digest cron');
          }
        },
        { timezone: 'UTC' },
      ),
    );
  }

  // ─── 2. Pop-in random cadence ───────────────────────────────────────
  if (config.POP_IN_ENABLED) {
    const interval = Math.max(1, config.POP_IN_INTERVAL_HOURS);
    const expr = `0 */${interval} * * *`;

    handles.popInExpression = expr;
    tasks.push(
      cron.schedule(
        expr,
        async () => {
          for (const zone of zones) {
            if (Math.random() > config.POP_IN_PROBABILITY) continue;
            const popInTypes: PostType[] = ['micro', 'lore_drop', 'question'];
            const postType = popInTypes[Math.floor(Math.random() * popInTypes.length)]!;
            await withZoneLock(zone, () => onFire({ zone, postType }), `pop-in (${postType})`);
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
          const zone = config.WEAVER_PRIMARY_ZONE;
          await withZoneLock(zone, () => onFire({ zone, postType: 'weaver' }), 'weaver cron');
        },
        { timezone: 'UTC' },
      ),
    );
  }

  return handles;
}
