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
import type { ZoneId } from '../score/index.ts';
import type { PostType, EventTrigger } from '../compose/post-types.ts';

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
  /** cycle-008 slice 2b · the live moment an event-driven pop-in is reacting to (axis + event
   * class). Set only for router-fired micros; absent for the digest/weaver crons. */
  eventTrigger?: EventTrigger;
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
  /** cycle-008 slice 2a · primary character id for the event-driven router decision in the stir
   * tier (ledger entries + inter-character coord). Defaults to 'ruggy' (repo primary). */
  characterId?: string;
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
  const { config, zones, onFire, characterId = 'ruggy' } = args;
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

  // ─── 2. Pop-in (cycle-008 slice 2a) ─────────────────────────────────
  // The blind random-die-roll pop-in cron was DELETED here. Pop-ins are now
  // EVENT-DRIVEN: the stir tier (§4 below) consults the router on each tick
  // and fires a micro only when real on-chain activity crosses the kansei
  // thresholds (router-gated by refractory + daily-cap, so louder data not
  // louder cadence — invariant #3). lore_drop/question/callout no longer
  // auto-fire (operator prune 2026-05-23: keep digest + micro + weaver).
  // POP_IN_* config fields are retained but no longer drive a cron.

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

  // ─── 4. Ambient stir tier (cycle-003 · NEW) ─────────────────────────
  // Per D1 + D19: stir tier polls on-chain events hourly, NEVER affects
  // digest cron path (independent error boundary). Stir is invisible
  // by default — only updates the kansei sibling channel.
  // env: EVENT_HEARTBEAT_ENABLED (default true), EVENT_HEARTBEAT_EXPR (default "0 * * * *")
  const stirEnabled = process.env.EVENT_HEARTBEAT_ENABLED !== 'false';
  if (stirEnabled) {
    const stirExpr = process.env.EVENT_HEARTBEAT_EXPR ?? '0 * * * *';
    if (cron.validate(stirExpr)) {
      tasks.push(
        cron.schedule(
          stirExpr,
          async () => {
            // Lazy import — keeps scheduler.ts compileable even if ambient
            // module is removed/disabled later.
            try {
              const ambientMod = await import('../ambient/scheduler-task.ts');
              const lynchMod = await import('../orchestrator/rosenzu/lynch-primitives.ts');
              for (const zone of zones) {
                // skip if another cadence holds the zone lock
                if (zoneLocks.has(zone)) continue;
                const profile = (lynchMod as { ZONE_PROFILES?: Record<string, { primitive: 'node' | 'district' | 'edge' | 'path' | 'inner_sanctum' }> }).ZONE_PROFILES?.[zone];
                const primitive = profile?.primitive ?? 'node';
                const result = await ambientMod.runStirTick(zone, primitive, characterId);
                if (result.error) {
                  console.warn(`ambient-stir: zone=${zone} error=${result.error}`);
                } else if (result.events_fetched > 0) {
                  console.log(
                    `ambient-stir: zone=${zone} fetched=${result.events_fetched} quarantined=${result.quarantined}`,
                  );
                }
                // cycle-008 slice 2a · event-driven pop-in (replaces the deleted blind §2 cadence).
                // The slow stir tick above ran UNLOCKED (so it never blocks/drops the weekly digest
                // or weaver cron). The ledger CLAIM + the post run together under the zone lock here:
                // commit the fire first, post only if we won the slot. If the lock is contended
                // (digest/weaver firing) this whole block is dropped — nothing is committed, so no
                // phantom budget is consumed (FAGAN slice-2a). POP_IN_ENABLED stays the operator
                // kill switch for pop-in POSTS (the old §2 cron honored it); EVENT_HEARTBEAT_ENABLED
                // is the separate "no stir tier at all" knob.
                if (config.POP_IN_ENABLED && result.fireIntent) {
                  const intent = result.fireIntent;
                  await withZoneLock(
                    zone,
                    async () => {
                      const won = await ambientMod.commitFireDecision(intent.decision);
                      if (won)
                        await onFire({
                          zone,
                          postType: intent.postType,
                          // slice 2b · carry the live moment to the micro voice (semantic, not numeric).
                          eventTrigger: { axis: intent.triggeringAxis, eventClass: intent.eventClass },
                        });
                    },
                    `event-pop-in (${intent.triggeringAxis ?? 'gravity'})`,
                  );
                }
              }
            } catch (err) {
              // NFR-10: stir failures NEVER cascade into digest path
              console.warn(`ambient-stir top-level failure: ${err instanceof Error ? err.message : String(err)}`);
            }
          },
          { timezone: 'UTC' },
        ),
      );
    } else {
      console.warn(`ambient-stir: invalid EVENT_HEARTBEAT_EXPR "${stirExpr}" — stir tier disabled`);
    }
  }

  return handles;
}
