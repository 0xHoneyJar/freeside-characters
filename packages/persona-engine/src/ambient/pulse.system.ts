/**
 * Pulse system — events → stir delta transform.
 *
 * Per-frame transform: takes a batch of MiberaEvents + current stir state,
 * returns the new stir state with deltas applied + decay since last tick.
 *
 * Per-primitive weighted (D10 LYNCH matrix) · inner_sanctum density-inversion
 * (D11) · edge transfer-class boost (D12) · gravity transient flag (D21).
 *
 * Source of truth: grimoires/loa/sdd.md §6 NFR table + class-weights.ts
 * + primitive-weights.ts.
 */

import {
  KansaiStir,
  STIR_FLOOR,
  GRAVITY_WINDOW_MINUTES_DEFAULT,
  decayValue,
  emptyStir,
  HALF_LIFE_HOURS_DEFAULT,
} from "./domain/pulse.ts";
import type { MiberaEvent, ZoneId, EventClass } from "./domain/event.ts";
import { isGravityClass } from "./domain/event.ts";
import { CLASS_AXIS_WEIGHTS } from "./domain/class-weights.ts";
import type { AxisDelta } from "./domain/class-weights.ts";
import {
  PRIMITIVE_AXIS_WEIGHTS,
  applyPrimitiveWeights,
  type LynchPrimitive,
} from "./domain/primitive-weights.ts";

export interface PulseTickInput {
  readonly zone: ZoneId;
  readonly primitive: LynchPrimitive;
  readonly previousStir: KansaiStir | null;
  readonly previousTickAt: string | null;
  readonly newEvents: ReadonlyArray<MiberaEvent>;
  readonly now: string;
  readonly halfLifeHours?: number;
}

export interface PulseTickOutput {
  readonly stir: KansaiStir;
  readonly classesObserved: ReadonlyArray<EventClass>;
  readonly uniqueWalletsCount: number;
  readonly mostRecentGravityEvent: MiberaEvent | null;
}

function _extractWallets(events: ReadonlyArray<MiberaEvent>): Set<string> {
  const wallets = new Set<string>();
  for (const e of events) {
    switch (e._tag) {
      case "AwakeningEvent":
      case "ReturnToSourceEvent":
      case "RevealEvent":
      case "BackingEvent":
      case "FractureEvent":
        wallets.add(e.wallet as unknown as string);
        break;
      case "CrossWalletsEvent":
        wallets.add(e.from_wallet as unknown as string);
        wallets.add(e.to_wallet as unknown as string);
        break;
      case "CommittedEvent":
        wallets.add(e.wallet as unknown as string);
        break;
    }
  }
  return wallets;
}

function _accumulateDelta(
  events: ReadonlyArray<MiberaEvent>,
  primitive: LynchPrimitive,
): AxisDelta {
  let press = 0;
  let strangers = 0;
  let gravity = 0;
  let drift = 0;
  for (const e of events) {
    const classDelta = CLASS_AXIS_WEIGHTS[e.event_class];
    const isCross = e.event_class === "cross_wallets";
    const weighted = applyPrimitiveWeights(classDelta, primitive, isCross);
    press += weighted.press;
    strangers += weighted.strangers;
    gravity += weighted.gravity;
    drift += weighted.drift;
  }
  return { press, strangers, gravity, drift };
}

function _findMostRecentGravity(
  events: ReadonlyArray<MiberaEvent>,
): MiberaEvent | null {
  let latest: MiberaEvent | null = null;
  for (const e of events) {
    if (!isGravityClass(e.event_class)) continue;
    if (!latest || e.occurred_at > latest.occurred_at) latest = e;
  }
  return latest;
}

/**
 * Pure per-tick transform: previous stir + new events → new stir.
 *
 * Steps:
 *   1. Decay previous stir toward STIR_FLOOR (or set baseline if no previous)
 *   2. Accumulate per-axis deltas from new events with primitive weights
 *   3. Apply deltas additively (press is SIGNED · inner_sanctum may go negative)
 *   4. Clamp strangers/drift to [STIR_FLOOR, 1] (press unbounded per D11)
 *   5. Update gravity transient flag if any class-A event landed
 */
export function pulseTick(input: PulseTickInput): PulseTickOutput {
  const halfLife = input.halfLifeHours ?? HALF_LIFE_HOURS_DEFAULT;

  // Step 1: decay
  let base: KansaiStir;
  if (input.previousStir && input.previousTickAt) {
    const elapsedMs =
      Date.parse(input.now) - Date.parse(input.previousTickAt);
    const elapsedHours = elapsedMs / 3_600_000;
    base = {
      zone: input.zone,
      press: decayValue(input.previousStir.press, elapsedHours, halfLife),
      strangers: Math.max(
        STIR_FLOOR,
        decayValue(input.previousStir.strangers, elapsedHours, halfLife),
      ),
      gravity: input.previousStir.gravity, // gravity is transient, handled separately
      drift: Math.max(
        STIR_FLOOR,
        decayValue(input.previousStir.drift, elapsedHours, halfLife),
      ),
      computed_at: input.now,
    };
  } else {
    base = emptyStir(input.zone, input.now);
  }

  // Step 2 + 3: accumulate deltas
  const delta = _accumulateDelta(input.newEvents, input.primitive);

  const classes = new Set<EventClass>();
  for (const e of input.newEvents) classes.add(e.event_class);

  const wallets = _extractWallets(input.newEvents);
  const uniqueWallets = wallets.size;
  const totalEvents = input.newEvents.length;
  const observedDriftRatio =
    totalEvents > 0 ? uniqueWallets / totalEvents : 0;

  // Step 4 + 5
  const mostRecentGravity = _findMostRecentGravity(input.newEvents);
  const gravityChannel = mostRecentGravity
    ? {
        last_significant_event_within_window: true,
        significant_event_class: mostRecentGravity.event_class,
        significant_event_at: mostRecentGravity.occurred_at,
      }
    : base.gravity.last_significant_event_within_window
      ? // carry forward existing gravity if window not elapsed
        _gravityIfStillFresh(base.gravity, input.now)
      : base.gravity;

  const stir: KansaiStir = {
    zone: input.zone,
    press: base.press + delta.press, // SIGNED — D11 inner_sanctum may go negative
    strangers: Math.min(
      1,
      Math.max(
        STIR_FLOOR,
        base.strangers + delta.strangers + observedDriftRatio * 0.1,
      ),
    ),
    gravity: gravityChannel,
    drift: Math.min(
      1,
      Math.max(STIR_FLOOR, base.drift + delta.drift + observedDriftRatio * 0.1),
    ),
    computed_at: input.now,
  };

  return {
    stir,
    classesObserved: Array.from(classes),
    uniqueWalletsCount: uniqueWallets,
    mostRecentGravityEvent: mostRecentGravity,
  };
}

function _gravityIfStillFresh(
  channel: {
    last_significant_event_within_window: boolean;
    significant_event_class: EventClass | null;
    significant_event_at: string | null;
  },
  now: string,
  windowMinutes: number = GRAVITY_WINDOW_MINUTES_DEFAULT,
): typeof channel {
  if (!channel.significant_event_at) {
    return {
      last_significant_event_within_window: false,
      significant_event_class: null,
      significant_event_at: null,
    };
  }
  const elapsedMs = Date.parse(now) - Date.parse(channel.significant_event_at);
  if (elapsedMs > windowMinutes * 60_000) {
    return {
      last_significant_event_within_window: false,
      significant_event_class: null,
      significant_event_at: null,
    };
  }
  return channel;
}
