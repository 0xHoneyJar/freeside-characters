/**
 * Ambient events domain — sealed discriminated union for on-chain mibera events.
 *
 * Source of truth: grimoires/loa/context/ambient-events-as-rave.md (active)
 *
 * Canon-named variants per D7 (mibera-codex translation):
 *   chain word    → canon name              → discriminator tag
 *   mint          → awakening               → AwakeningEvent
 *   transfer      → crossed-wallets         → CrossWalletsEvent
 *   burn          → return-to-source        → ReturnToSourceEvent
 *   trait_shift   → reveal                  → RevealEvent
 *   loan          → backing                 → BackingEvent
 *   stake         → committed               → CommittedEvent
 *   badge         → fracture (soulbound)    → FractureEvent
 *
 * Idempotency: each event carries `id` = bronze table PK = tx_hash + log_index.
 * Cursor design uses `(occurred_at, id)` compound key for NFR-12/13 dedup.
 *
 * Forward-compat: schema_version uses Pattern(/^1\.\d+\.\d+$/) so 1.x bumps
 * from score-mibera do not break the consumer (Flatline SDD IMP-008 fix).
 */

import { Schema } from "effect";

// ─── Branded primitives ──────────────────────────────────────────────

export const EventId = Schema.String.pipe(Schema.brand("EventId"));
export type EventId = Schema.Schema.Type<typeof EventId>;

export const Wallet = Schema.String.pipe(Schema.brand("Wallet"));
export type Wallet = Schema.Schema.Type<typeof Wallet>;

export const TokenId = Schema.Number.pipe(Schema.brand("TokenId"));
export type TokenId = Schema.Schema.Type<typeof TokenId>;

export const ChainBlockNumber = Schema.Number.pipe(
  Schema.brand("ChainBlockNumber"),
);
export type ChainBlockNumber = Schema.Schema.Type<typeof ChainBlockNumber>;

// Discord zone identifiers (current 4-zone deployment).
// Mirrors lynch-primitives.ts zone slugs.
export const ZoneId = Schema.Literal(
  "stonehenge",
  "bear-cave",
  "el-dorado",
  "owsley-lab",
);
export type ZoneId = Schema.Schema.Type<typeof ZoneId>;

// ISO-8601 UTC timestamp string. (DateTimeUtc would be ideal but the Effect
// version of this codebase uses plain `Schema.String` with ISO-8601 format
// at the boundary; downstream code parses via `new Date()`.)
export const Timestamp = Schema.String;
export type Timestamp = Schema.Schema.Type<typeof Timestamp>;

// Forward-compatible version: accepts 1.x not just 1.0.0 (Flatline IMP-008).
export const SchemaVersion = Schema.String.pipe(
  Schema.pattern(/^1\.\d+\.\d+$/),
);
export type SchemaVersion = Schema.Schema.Type<typeof SchemaVersion>;

// EventClass enum — derived from score-mibera authoritative taxonomy (FR-3.26).
// At boot, consumer validates this against mcp__score__list_event_classes()
// response; unknown classes route to quarantine per NFR-11.
export const EventClass = Schema.Literal(
  "awakening",
  "cross_wallets",
  "return_to_source",
  "reveal",
  "backing",
  "committed",
  "fracture",
);
export type EventClass = Schema.Schema.Type<typeof EventClass>;

// ─── Sealed discriminated union ──────────────────────────────────────

const _BaseEventFields = {
  id: EventId,
  zone: Schema.NullOr(ZoneId), // null = no zone routing
  occurred_at: Timestamp,
  block_number: ChainBlockNumber,
  schema_version: SchemaVersion,
} as const;

export const AwakeningEvent = Schema.Struct({
  _tag: Schema.Literal("AwakeningEvent"),
  event_class: Schema.Literal("awakening"),
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String, // "mibera" | "fracture-*" | "tarot" | …
  ..._BaseEventFields,
});
export type AwakeningEvent = Schema.Schema.Type<typeof AwakeningEvent>;

export const CrossWalletsEvent = Schema.Struct({
  _tag: Schema.Literal("CrossWalletsEvent"),
  event_class: Schema.Literal("cross_wallets"),
  from_wallet: Wallet,
  to_wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  ..._BaseEventFields,
});
export type CrossWalletsEvent = Schema.Schema.Type<typeof CrossWalletsEvent>;

export const ReturnToSourceEvent = Schema.Struct({
  _tag: Schema.Literal("ReturnToSourceEvent"),
  event_class: Schema.Literal("return_to_source"),
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  ..._BaseEventFields,
});
export type ReturnToSourceEvent = Schema.Schema.Type<
  typeof ReturnToSourceEvent
>;

export const RevealEvent = Schema.Struct({
  _tag: Schema.Literal("RevealEvent"),
  event_class: Schema.Literal("reveal"),
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  reveal_phase: Schema.Number, // 1..10 per fractures/README.md phases
  ..._BaseEventFields,
});
export type RevealEvent = Schema.Schema.Type<typeof RevealEvent>;

export const BackingEvent = Schema.Struct({
  _tag: Schema.Literal("BackingEvent"),
  event_class: Schema.Literal("backing"),
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  notional_wei: Schema.String, // wei-as-string to avoid Number precision loss
  ..._BaseEventFields,
});
export type BackingEvent = Schema.Schema.Type<typeof BackingEvent>;

export const CommittedEvent = Schema.Struct({
  _tag: Schema.Literal("CommittedEvent"),
  event_class: Schema.Literal("committed"),
  wallet: Wallet,
  token_id: Schema.NullOr(TokenId), // null when staking $BERA / $HONEY, not a mibera
  amount_wei: Schema.String,
  ..._BaseEventFields,
});
export type CommittedEvent = Schema.Schema.Type<typeof CommittedEvent>;

export const FractureEvent = Schema.Struct({
  _tag: Schema.Literal("FractureEvent"),
  event_class: Schema.Literal("fracture"),
  wallet: Wallet,
  fracture_id: Schema.String, // soulbound Fracture identifier
  collection: Schema.String,
  ..._BaseEventFields,
});
export type FractureEvent = Schema.Schema.Type<typeof FractureEvent>;

export const MiberaEvent = Schema.Union(
  AwakeningEvent,
  CrossWalletsEvent,
  ReturnToSourceEvent,
  RevealEvent,
  BackingEvent,
  CommittedEvent,
  FractureEvent,
);
export type MiberaEvent = Schema.Schema.Type<typeof MiberaEvent>;

// Gravity class — the "felt with weight" events (D16 stochastic bypass).
// Mints + burns are class-A; other classes use per-axis threshold path.
export const GRAVITY_CLASSES: ReadonlyArray<EventClass> = [
  "awakening",
  "return_to_source",
] as const;

export function isGravityClass(c: EventClass): boolean {
  return GRAVITY_CLASSES.includes(c);
}
