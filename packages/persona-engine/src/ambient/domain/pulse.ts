/**
 * Ambient pulse domain — KansaiStir + GravityChannel.
 *
 * The 4-axis stir delta (D9 · ALEXANDER rename: press · strangers · gravity · drift)
 * bends the existing KansaiVector at compose time. Stir lives on a SIBLING
 * channel (D4 · NEVER mutates KansaiVector.feel).
 *
 * Per-axis semantics:
 *   - press     events/hour vs baseline · SIGNED (positive in node/district/edge/path,
 *                 NEGATIVE in inner_sanctum per D11 density inversion · Flatline IMP-001)
 *   - strangers first-seen-wallets ratio · 0.05..1
 *   - gravity   transient flag (NOT decaying scalar · D21 ALEXANDER fix)
 *   - drift     unique-wallets/total-events · 0.05..1
 *
 * Decay: 6h half-life default (Flatline IMP-013 split late-arrival from decay).
 * Floor: 0.05 per axis (D18 · OSTROM stir-floor epsilon · NEVER decays to 0).
 *
 * Source of truth: grimoires/loa/sdd.md §3.2 + §3.4
 */

import { Schema } from "effect";
import { ZoneId, EventClass, Timestamp } from "./event.ts";

// ─── Constants ───────────────────────────────────────────────────────

/** Per-axis stir floor — bounds decay (D18). Weekly digest always reads
 * "slightly tilted" rather than "snapshot frozen". */
export const STIR_FLOOR = 0.05;

/** Decay half-life in hours (default; env-overridable via
 * `EVENT_RAVE_HALF_LIFE_HOURS`). */
export const HALF_LIFE_HOURS_DEFAULT = 6;

/** Window after which gravity transient turns OFF (Flatline IMP-002).
 * env-overridable via `EVENT_GRAVITY_WINDOW_MINUTES`. */
export const GRAVITY_WINDOW_MINUTES_DEFAULT = 60;

// ─── GravityChannel — transient flag (D21) ───────────────────────────

/**
 * Per D21 ALEXANDER fix: gravity is a TRANSIENT one-tick flag, not a
 * decaying scalar. Fires on class-A landing (mint or burn), then the
 * next scheduler tick where (now - significant_event_at) >
 * GRAVITY_WINDOW_MINUTES clears it.
 *
 * Reverence is a moment, not a mood — Flatline IMP-002 + ALEXANDER F2.
 */
export const GravityChannel = Schema.Struct({
  last_significant_event_within_window: Schema.Boolean,
  significant_event_class: Schema.NullOr(EventClass),
  significant_event_at: Schema.NullOr(Timestamp),
});
export type GravityChannel = Schema.Schema.Type<typeof GravityChannel>;

export const GRAVITY_CHANNEL_EMPTY: GravityChannel = {
  last_significant_event_within_window: false,
  significant_event_class: null,
  significant_event_at: null,
};

// ─── KansaiStir — sibling channel of KansaiVector (D4) ───────────────

/**
 * Per Flatline SDD IMP-001 fix: `press` is SIGNED (Schema.Number unbounded).
 * inner_sanctum produces NEGATIVE press values via primitive-weights matrix
 * (D11 density-inversion); the schema must not constrain that range or
 * decode fails when inner_sanctum events land.
 *
 * Strangers / gravity / drift are bounded [STIR_FLOOR, 1].
 */
export const KansaiStir = Schema.Struct({
  zone: ZoneId,
  press: Schema.Number, // SIGNED — Flatline IMP-001 fix
  strangers: Schema.Number.pipe(Schema.between(STIR_FLOOR, 1)),
  gravity: GravityChannel,
  drift: Schema.Number.pipe(Schema.between(STIR_FLOOR, 1)),
  computed_at: Timestamp,
});
export type KansaiStir = Schema.Schema.Type<typeof KansaiStir>;

/** Baseline stir vector — what every zone starts at + decays toward (D18 floor). */
export function emptyStir(zone: ZoneId, now: Timestamp): KansaiStir {
  return {
    zone,
    press: STIR_FLOOR,
    strangers: STIR_FLOOR,
    gravity: GRAVITY_CHANNEL_EMPTY,
    drift: STIR_FLOOR,
    computed_at: now,
  };
}

// ─── Decay function ──────────────────────────────────────────────────

/**
 * Exponential decay toward STIR_FLOOR with the configured half-life.
 *
 * For axis x at time t, with half-life T and elapsed dt:
 *   x(t + dt) = STIR_FLOOR + (x(t) - STIR_FLOOR) * 0.5^(dt / T)
 *
 * The floor is preserved per D18 — value never decays below STIR_FLOOR.
 * For SIGNED press (inner_sanctum negative values), decay pulls toward
 * STIR_FLOOR from above OR below.
 */
export function decayValue(
  current: number,
  elapsedHours: number,
  halfLifeHours: number = HALF_LIFE_HOURS_DEFAULT,
): number {
  if (halfLifeHours <= 0) return STIR_FLOOR;
  const decayFactor = Math.pow(0.5, elapsedHours / halfLifeHours);
  const delta = (current - STIR_FLOOR) * decayFactor;
  return STIR_FLOOR + delta;
}

/** Check whether a gravity-channel's transient window has elapsed. */
export function isGravityWindowElapsed(
  channel: GravityChannel,
  now: Timestamp,
  windowMinutes: number = GRAVITY_WINDOW_MINUTES_DEFAULT,
): boolean {
  if (!channel.last_significant_event_within_window) return true;
  if (!channel.significant_event_at) return true;
  const elapsedMs =
    Date.parse(now) - Date.parse(channel.significant_event_at);
  return elapsedMs > windowMinutes * 60_000;
}
