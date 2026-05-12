# Software Design Document — ambient-events-as-rave

> **cycle**: cycle-003 (assigned at sprint-plan)
> **generated**: 2026-05-11 via `/simstim-workflow` Phase 3
> **PRD**: `grimoires/loa/prd.md` (this cycle's PRD)
> **deep-context**: `grimoires/loa/context/ambient-events-as-rave.md` (active)
> **whole-project baseline**: `grimoires/loa/sdd-ride-baseline.md` (preserved)

## 0 · scope

this SDD designs the **freeside-characters Phase 3 implementation** of
the ambient-events surface. it covers:

- domain model · ports · adapters layout
- data shape (events, kansei stir, cursors, ledger)
- API contracts (score-mcp consumer + codex-mcp consumer)
- runtime composition (single `ManagedRuntime.make` site)
- scheduler integration
- resilience contracts (NFR-7 through NFR-25)
- deployment topology (singleton invariant)

it references — but does not duplicate — the **score-mibera Phase 1
SDD** (separate concern; lives in score-mibera repo per its
companion cycle).

## 1 · system architecture (one-page diagram)

```
        ┌────────────────────────────────────────────────────────────────┐
        │                          TRUTH PLANE                            │
        │                                                                  │
        │  ┌──────────────┐  Trigger.dev   ┌──────────────────────────┐   │
        │  │ Envio indexer│ ──── 6h ────▶  │ score-mibera             │   │
        │  │ (external)   │                │   Bronze: midi_onchain_  │   │
        │  └──────────────┘                │           events (PG)    │   │
        │                                  │   class-mapping table    │   │
        │                                  │   MCP server v1.2.0:     │   │
        │                                  │     get_events_since     │   │
        │                                  │     get_event_by_id      │   │
        │                                  │     get_recent_mints     │   │
        │                                  │     list_event_classes   │   │
        │                                  └──────┬───────────────────┘   │
        └─────────────────────────────────────────│──────────────────────┘
                                                  │
                                  read-only MCP   │ HTTP
                                  no writes back  │
                                                  ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                          VOICE PLANE                             │
        │                       (freeside-characters)                      │
        │                                                                   │
        │   stir-tier cron (hourly)                                         │
        │        │                                                          │
        │        ▼                                                          │
        │   ┌─────────────────┐    ┌──────────────────┐                    │
        │   │ event-source    │───▶│ pulse.system.ts  │                    │
        │   │ .live.ts        │    │  per-primitive   │                    │
        │   │ (MCP wrapper)   │    │  weighted delta  │                    │
        │   └─────────────────┘    └────────┬─────────┘                    │
        │                                    │                              │
        │                                    ▼                              │
        │                          ┌──────────────────┐                    │
        │                          │ pulse-sink.live  │  writes stir as    │
        │                          │ (rosenzu state)  │  SIBLING channel   │
        │                          └────────┬─────────┘  NOT mutating feel │
        │                                    │                              │
        │                                    ▼                              │
        │                          ┌──────────────────┐                    │
        │                          │ router.system.ts │  per-axis OR-gate  │
        │                          │  + refractory    │  + daily cap       │
        │                          │  + inter-char    │  + stochastic A    │
        │                          │  + ledger write  │                    │
        │                          └────────┬─────────┘                    │
        │                                    │ fire decision               │
        │                                    ▼                              │
        │   pop-in cron (existing, retuned)  ─────▶  composer  ──▶ Discord │
        │                                                                   │
        │   weekly digest cron (UNCHANGED · NFR-19: NEVER stir-gated)       │
        │                                                                   │
        └───────────────────────────────────────────────────────────────────┘
```

## 2 · module layout (four-folder discipline)

**lifted from**: [construct-effect-substrate · patterns/domain-ports-live.md](https://github.com/0xHoneyJar/construct-effect-substrate)

```
packages/persona-engine/src/ambient/
├── domain/                    pure schema · no runtime
│   ├── event.ts               sealed Effect Schema discriminated union
│   ├── class-weights.ts       chain-class → axis delta (CANON locked)
│   ├── primitive-weights.ts   lynch primitive → axis weight matrix
│   ├── pulse.ts               KansaiStir + GravityChannel + decay
│   ├── canon-vocabulary.ts    chain-word → mibera-canon table + FAGAN forbidden words
│   ├── cursor.ts              EventCursor (compound: event_time + id)
│   └── budgets.ts             refractory + daily-cap + inter-char coord types
├── ports/                     Context.Tag service interfaces
│   ├── event-source.port.ts   EventFeed.Service
│   ├── pulse-sink.port.ts     PulseSink.Service
│   ├── mibera-resolver.port.ts  codex enrichment
│   ├── wallet-resolver.port.ts  CLAUDE.md wallet redaction (FR-3.27 NEW)
│   ├── circuit-breaker.port.ts  persistent CB state (NFR-28 NEW)
│   └── pop-in-ledger.port.ts  ledger writer
├── live/                      production Layer.succeed adapters
│   ├── event-source.live.ts   wraps mcp__score__get_events_since
│   ├── pulse-sink.live.ts     writes to rosenzu sibling channel
│   ├── mibera-resolver.live.ts  wraps mcp__codex__lookup_mibera + cache
│   ├── wallet-resolver.live.ts  wraps mcp__freeside_auth__resolve_wallet + cache (NEW)
│   ├── circuit-breaker.live.ts  flock'd .run/circuit-breaker.jsonl (NEW)
│   └── pop-in-ledger.live.ts  atomic-rename jsonl writer
├── mock/                      test Layer.succeed adapters
│   ├── event-source.mock.ts
│   ├── pulse-sink.mock.ts
│   ├── mibera-resolver.mock.ts
│   ├── wallet-resolver.mock.ts
│   ├── circuit-breaker.mock.ts
│   └── pop-in-ledger.mock.ts
├── pulse.system.ts            events → stir delta (per-frame transform)
├── router.system.ts           stir → fire decision (OR-gate + budgets)
└── runtime.ts                 single ManagedRuntime.make site
```

## 3 · data models

### 3.1 · MiberaEvent (sealed discriminated union)

```ts
// packages/persona-engine/src/ambient/domain/event.ts
import { Schema } from "effect";

export const EventId = Schema.Brand("EventId")(Schema.String);
export const Wallet = Schema.Brand("Wallet")(Schema.String);
export const TokenId = Schema.Brand("TokenId")(Schema.Number);
export const ZoneId = Schema.Literal(
  "stonehenge", "bear-cave", "el-dorado", "owsley-lab"
);
export const ChainBlockNumber = Schema.Brand("ChainBlockNumber")(Schema.Number);
export const Timestamp = Schema.DateTimeUtc;
// Forward-compatible version per Flatline IMP-008 · accepts 1.x not just 1.0.0
export const SchemaVersion = Schema.String.pipe(
  Schema.pattern(/^1\.\d+\.\d+$/)
);

// Canon-named variants per D7. each carries enough payload for narration
// without an extra round-trip to score (except codex enrichment).
export const AwakeningEvent = Schema.TaggedStruct("AwakeningEvent", {
  id: EventId,                  // = bronze id = tx_hash + log_index
  zone: ZoneId,
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,    // "mibera" | "fracture-*" | "tarot" | …
  occurred_at: Timestamp,
  block_number: ChainBlockNumber,
  schema_version: SchemaVersion,   // Pattern(/^1\./) — forward-compat for 1.x bumps
});

export const CrossWalletsEvent = Schema.TaggedStruct("CrossWalletsEvent", {
  id: EventId,
  zone: ZoneId,
  from_wallet: Wallet,
  to_wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  occurred_at: Timestamp,
  block_number: ChainBlockNumber,
  schema_version: SchemaVersion,   // Pattern(/^1\./) — forward-compat for 1.x bumps
});

export const ReturnToSourceEvent = Schema.TaggedStruct("ReturnToSourceEvent", {
  id: EventId,
  zone: ZoneId,
  wallet: Wallet,
  token_id: TokenId,
  collection: Schema.String,
  occurred_at: Timestamp,
  block_number: ChainBlockNumber,
  schema_version: SchemaVersion,   // Pattern(/^1\./) — forward-compat for 1.x bumps
});

// ... RevealEvent · BackingEvent · CommittedEvent · FractureEvent
// (same shape pattern)

export const MiberaEvent = Schema.Union(
  AwakeningEvent,
  CrossWalletsEvent,
  ReturnToSourceEvent,
  // RevealEvent, BackingEvent, CommittedEvent, FractureEvent
);
export type MiberaEvent = Schema.Schema.Type<typeof MiberaEvent>;
```

### 3.2 · KansaiStir + GravityChannel

```ts
// packages/persona-engine/src/ambient/domain/pulse.ts
import { Schema } from "effect";

export const STIR_FLOOR = 0.05;        // NFR-floor per D18
export const HALF_LIFE_HOURS = 6;       // D-default

// Press is signed: positive in node/district/edge/path (event density above
// baseline), negative in inner_sanctum (events inverted per D11 — sacred
// quiet means fewer-events-amplifies). Floor + ceiling reflect signed space.
// Flatline IMP-001 schema-fix: Schema.between(-Infinity, Infinity); the
// effective range is bounded by per-primitive weights * event volume,
// but the schema does not constrain (avoids decode failure when
// inner_sanctum produces negative press).
export const KansaiStir = Schema.Struct({
  zone: ZoneId,
  press: Schema.Number,                                          // signed (negative valid for inner_sanctum)
  strangers: Schema.Number.pipe(Schema.between(STIR_FLOOR, 1)),
  gravity: GravityChannel,
  drift: Schema.Number.pipe(Schema.between(STIR_FLOOR, 1)),
  computed_at: Timestamp,
});
export type KansaiStir = Schema.Schema.Type<typeof KansaiStir>;

// Window semantics per Flatline IMP-002:
//   "within_window" = significant_event_at >= computed_at - GRAVITY_WINDOW_MINUTES
//   default GRAVITY_WINDOW_MINUTES = 60. configurable via env.
//   transient flag turns OFF on the FIRST tick where the window has elapsed.
//   ONE tick of fire, then off (not a decay curve · D21).
export const GRAVITY_WINDOW_MINUTES = 60;

export const GravityChannel = Schema.Struct({
  last_significant_event_within_window: Schema.Boolean,
  significant_event_class: Schema.NullOr(EventClass),
  significant_event_at: Schema.NullOr(Timestamp),
});
export type GravityChannel = Schema.Schema.Type<typeof GravityChannel>;
```

### 3.3 · EventCursor (compound key per NFR-12/13)

```ts
// packages/persona-engine/src/ambient/domain/cursor.ts
import { Schema } from "effect";

export const REPLAY_WINDOW_SECONDS = 60;    // NFR-13 overlap window

export const EventCursor = Schema.Struct({
  zone: Schema.NullOr(ZoneId),    // null = global cursor
  event_time: Timestamp,           // primary order key
  event_id: EventId,               // tiebreaker (NFR-12 compound)
  updated_at: Timestamp,
});
export type EventCursor = Schema.Schema.Type<typeof EventCursor>;

export const EventCursorSeen = Schema.Struct({
  // ring buffer for NFR-13 dedup · 5000 IDs (~24h at ~200 events/day baseline)
  // spillover (NFR-27): if event volume exceeds buffer capacity within
  // REPLAY_WINDOW_SECONDS, fallback to bloom filter persisted at
  // .run/event-cursor-bloom.dat (false-positive rate 0.1%).
  ids: Schema.Array(EventId).pipe(Schema.maxItems(5000)),
  bloom_filter_path: Schema.OptionFromNullOr(Schema.String),
  bloom_filter_size: Schema.Number,    // bits; default 65536
  bloom_filter_hashes: Schema.Number,  // hash functions; default 7
});
```

### 3.4 · per-primitive weight matrix (LYNCH)

```ts
// packages/persona-engine/src/ambient/domain/primitive-weights.ts
type LynchPrimitive = "node" | "district" | "edge" | "path" | "inner_sanctum";

export const PRIMITIVE_AXIS_WEIGHTS: Record<LynchPrimitive, AxisWeights> = {
  node:           { press: 1.0, strangers: 0.4, gravity: 0.6, drift: 0.8 },
  district:       { press: 0.5, strangers: 0.7, gravity: 0.3, drift: 1.0 },
  edge:           { press: 0.9, strangers: 0.9, gravity: 0.9, drift: 0.6 },
  inner_sanctum:  { press: -1.0, strangers: 0.5, gravity: 1.0, drift: 0.4 },
  // ^ negative press = density inversion (D11 · fewer events higher weight)
  path:           { press: 0.7, strangers: 0.5, gravity: 0.4, drift: 0.7 },
};

// edge transfer-class additional bump per D12
export const EDGE_TRANSFER_BOOST = 0.3;   // 0.2 → 0.5
```

### 3.5 · canon vocabulary table

```ts
// packages/persona-engine/src/ambient/domain/canon-vocabulary.ts
import type { EventClass } from "./event-class.js";

export interface CanonTranslation {
  chain_word: string;
  canon_words: string[];   // preferred-first
  forbidden: string[];      // FAGAN-checkable
}

export const CANON_TABLE: Record<EventClass, CanonTranslation> = {
  awakening: {
    chain_word: "mint",
    canon_words: ["awakening", "emergence", "arrival-from-Kaironic-time"],
    forbidden: [],
  },
  cross_wallets: {
    chain_word: "transfer",
    canon_words: ["crossed-wallets", "passed-through", "changed-hands"],
    forbidden: ["migration"],     // explicit per mibera-codex
  },
  return_to_source: {
    chain_word: "burn",
    canon_words: ["return-to-source", "refusal", "pouring-back", "return-to-the-bear-cave"],
    forbidden: ["sacrifice"],     // explicit per mibera-codex
  },
  reveal: {
    chain_word: "trait_shift",
    canon_words: ["reveal", "further-initiation", "phase-progression"],
    forbidden: [],
  },
  backing: {
    chain_word: "loan",
    canon_words: ["backing", "posted-as-backing", "held-by-council"],
    forbidden: [],
  },
  committed: {
    chain_word: "stake",
    canon_words: ["committed-to-the-rave", "held-by-treasury"],
    forbidden: [],
  },
  fracture: {
    chain_word: "badge",
    canon_words: ["Fracture", "proof-of-presence"],
    forbidden: [],
  },
};

// FAGAN gate: this regex MUST find zero matches in src/ambient/
export const FORBIDDEN_REGEX = /sacrifice|migration|founder.*archetype|\bera\b|\bmolecule\b/;
```

### 3.5.1 · wallet redaction (NEW · Flatline SKP-001 CRITICAL · CLAUDE.md compliance)

per CLAUDE.md "Don't do" rule: *"Cite raw `0x…` wallets in prose without
first calling `mcp__freeside_auth__resolve_wallet`"*. the SDD's data
flow (BronzeEvent.wallet → router → composer → Discord) violates this
unless we wire resolution.

```ts
// packages/persona-engine/src/ambient/domain/wallet-identity.ts
import { Schema } from "effect";

export const WalletIdentity = Schema.Struct({
  wallet_address: Wallet,          // raw 0x…
  discord_handle: Schema.NullOr(Schema.String),
  display_handle: Schema.NullOr(Schema.String),
  mibera_id: Schema.NullOr(Schema.Number),
  resolved_at: Timestamp,
});

// Narration cache key: wallet_address. Cache TTL: 10 minutes.
// Cache size: 200 entries LRU.
// Cache miss path: live resolver MCP call with 5s timeout (NFR-7).
// Cache miss + resolver failure path: redact wallet in narration to
// "an anonymous keeper" / "someone" — NEVER leak raw 0x…
```

### 3.6 · Budget primitives (NFR-7–11 · refractory + cap)

```ts
// packages/persona-engine/src/ambient/domain/budgets.ts
export const Budget = Schema.Struct({
  zone: ZoneId,
  // refractory: last fire timestamp per zone (D15)
  last_fire_at: Schema.NullOr(Timestamp),
  refractory_hours: Schema.Number,
  // daily cap: count of fires today per zone (D15)
  today_utc_date: Schema.String,   // "YYYY-MM-DD"
  today_fire_count: Schema.Number,
  daily_cap: Schema.Number,
  // inter-character coordination: which character last fired (D17)
  last_character_id: Schema.NullOr(Schema.String),
});
```

## 4 · API contracts

### 4.1 · score-mcp consumer (read-only · TRUTH plane)

Bot consumes these tools from `score-mibera` (Phase 1 contract):

```ts
// FR-1.1 ──── 
mcp__score__get_events_since({
  since_ts: string,        // ISO-8601, e.g. "2026-05-11T18:00:00Z"
  since_id?: string,       // optional tiebreaker for NFR-12 compound key
  limit?: number,          // default 100, max 500
  zone?: ZoneId,           // optional filter
  classes?: EventClass[],  // optional filter (server-side)
}): Promise<{
  events: BronzeEvent[];   // sorted by (event_time DESC, id DESC)
  next_cursor: { event_time: string; event_id: string };
  has_more: boolean;
}>

// FR-1.2 ──── 
mcp__score__get_event_by_id({ event_id: string }): Promise<BronzeEvent | null>

// FR-1.3 ──── 
mcp__score__get_recent_mints({
  collection?: "mibera" | "fracture-*" | "tarot",
  limit?: number,          // default 20, max 100
}): Promise<{
  events: AwakeningEventLike[];
  next_cursor: ...;
}>

// FR-1.4 ──── 
mcp__score__list_event_classes(): Promise<{
  classes: Array<{
    enum_key: EventClass;
    display_name: string;
    category_keys: string[];   // bronze category_keys this maps from
    schema_version: string;
  }>;
}>
```

The wire shape `BronzeEvent` mirrors `midi_onchain_events`:

```ts
export interface BronzeEvent {
  id: string;                  // tx_hash + log_index PK
  category_key: string;        // 52 values (server-mapped to EventClass)
  event_class: EventClass;     // server-derived per FR-1.5 mapping table
  zone: ZoneId | null;         // null = no zone routing
  wallet: string;
  metadata: Record<string, unknown>;   // includes tokenId, collection, etc.
  tx_hash: string;
  block_number: number;
  occurred_at: string;         // ISO-8601
  schema_version: string;      // "1.0.0"
}
```

### 4.2 · codex-mcp consumer (enrichment · narration only)

```ts
// Only called from router.system.ts at pop-in narration time.
// Stir tier does NOT enrich (cheap).
mcp__codex__lookup_mibera({ id: number }): Promise<{
  id: number;
  archetype: "Freetekno" | "Milady" | "Chicago/Detroit" | "Acidhouse";
  ancestor: string;
  element: "Fire" | "Water" | "Earth" | "Air";   // 4-element western per D6
  time_period: string;     // "Modern" (NOT "era" per D5)
  drug: string;            // "St. John's Wort" (NOT "molecule" per D5)
  swag_rank: "SSS" | "SS" | "S" | "A" | "B" | "C" | "F";
  sun_sign: string;
  moon_sign: string;
  ascending_sign: string;
  // … visual traits (28 keys total)
} | null>;
```

Resolver caches recent lookups in-memory (60-item LRU, 5-minute TTL).

### 4.3 · freeside-auth-mcp consumer (wallet identity · narration only · CLAUDE.md)

```ts
// Called from router.system.ts BEFORE composer renders narration.
// REQUIRED per CLAUDE.md don't-do rule. Bypassing this is a P0 audit fail.
mcp__freeside_auth__resolve_wallet({ wallet: string }): Promise<{
  wallet_address: string;
  discord_handle: string | null;       // "@someone"
  display_handle: string | null;       // "Some Name"
  mibera_id: number | null;            // primary mibera owned
  midi_profile_url: string | null;
} | null>;
```

Resolver caches in-memory (200-item LRU · 10-minute TTL · NFR-29).
Cache miss + MCP failure → fall back to anonymized identity (`{handle:
"an anonymous keeper"}`) NOT raw `0x…`.

### 4.4 · transport security (NEW · Flatline SKP-002 CRITICAL · NFR-30)

MCP dependencies require explicit endpoint allowlist + TLS verification:

```yaml
# Configured via env vars · validated at boot
SCORE_MCP_URL: "https://score-api-production.up.railway.app/mcp"
CODEX_MCP_URL: "https://codex.honeyjar.xyz/mcp"
FREESIDE_AUTH_MCP_URL: "https://auth.freeside.xyz/mcp"

# At startup, ambient runtime validates:
#   1. ALL URLs use https:// (rejects http: at parse)
#   2. ALL hostnames in MCP_ENDPOINT_ALLOWLIST (env or config)
#   3. TLS cert chain validates (no skipCertVerify)
```

Boot-time failure on allowlist mismatch crashes with explicit error.
No runtime override.

## 5 · runtime composition (single `ManagedRuntime.make`)

```ts
// packages/persona-engine/src/ambient/runtime.ts
import { Layer, ManagedRuntime } from "effect";
import { EventSourceLive } from "./live/event-source.live.js";
import { PulseSinkLive } from "./live/pulse-sink.live.js";
import { MiberaResolverLive } from "./live/mibera-resolver.live.js";
import { PopInLedgerLive } from "./live/pop-in-ledger.live.js";

// Composition root. Single Effect.provide site (FAGAN gate S9).
export const AmbientLayer = Layer.mergeAll(
  EventSourceLive,
  PulseSinkLive,
  MiberaResolverLive,
  PopInLedgerLive,
);

export const ambientRuntime = ManagedRuntime.make(AmbientLayer);
// Note: ManagedRuntime.make appears EXACTLY ONCE across src/ambient/
```

Scheduler entry:

```ts
// packages/persona-engine/src/cron/scheduler.ts (extended)
const stirTask = cron.schedule(
  process.env.EVENT_HEARTBEAT_EXPR ?? "0 * * * *",
  async () => {
    await ambientRuntime.runPromise(
      Effect.gen(function* (_) {
        for (const zone of ZONES) {
          yield* _(withZoneLock(zone, () => stirTickEffect(zone), "stir"));
        }
      })
    );
  },
  { name: "ambient-stir" },
);

// Existing digest cron remains UNCHANGED (NFR / D19 invariant).
```

## 6 · resilience patterns (NFR-7 through NFR-25)

| NFR | mechanism | implementation |
|---|---|---|
| **NFR-7 timeouts** | per-call abort signal | `Effect.timeout(15000)` on score-mcp · `Effect.timeout(5000)` on codex-mcp |
| **NFR-8 retries** | exponential backoff + full jitter | `Effect.retry(Schedule.exponential("1 second", 2).pipe(Schedule.intersect(Schedule.recurs(3))))` |
| **NFR-9 circuit breaker** | per-tier consecutive-failure counter | in-memory counter on `EventSourceLive`; 5 failures → degraded mode; 30-min cooldown via `Effect.schedule` |
| **NFR-10 non-blocking digest** | independent error boundaries | digest cron task wraps own `try/catch`; stir cron failures contained |
| **NFR-11 unknown class quarantine** | `Either` decode at boundary | `Schema.decodeUnknownEither(EventClass)` · Left → quarantine + metric |
| **NFR-12/13 compound cursor + replay** | `(event_time, id)` ordering + overlap window | cursor.live.ts reads/writes both fields; query subtracts REPLAY_WINDOW_SECONDS |
| **NFR-14 high-watermark** | transactional cursor advance | cursor.live writes ONLY after pulse+ledger writes succeed; uses tmp-file + atomic rename |
| **NFR-15 late-arrival policy** | `occurred_at < cursor - 6h` rejection | router rejects with `late_arrival` metric; never stirs |
| **NFR-16 restart replay** | bootstrap from cursor - 6h | on `ambientRuntime` start, replay events; rebuild stir vector |
| **NFR-17 bypass precedence** | router decision tree | OR-gate threshold check → refractory check → daily cap → inter-char → bypass roll |
| **NFR-18 bypass observability** | ledger entry per roll | every router decision writes `{decision: "bypassed"\|"queued"\|"capped"\|"fired"\|"suppressed"}` |
| **NFR-19/20 ledger retention** | month-boundary rotation | `pop-in-ledger.live.ts` renames at first write of new month |
| **NFR-21–25 singleton** | flock-based file locking | wraps every `.run/*.jsonl` write; startup acquires flock on cursor file with `LOCK_EX \| LOCK_NB`; failure crashes with NFR-25 message |
| **NFR-26 atomic ledger** | tmp-file + atomic rename for every append | `pop-in-ledger.live.ts` writes to `.tmp.<rand>` then `fs.renameSync` to canonical path; rotation does same for monthly archive |
| **NFR-27 dedup spillover** | bloom filter persistence | when ring buffer would evict beyond REPLAY_WINDOW horizon, write evicted IDs to `.run/event-cursor-bloom.dat`; bloom queried before declaring "unseen" |
| **NFR-28 circuit breaker persistence** | `.run/circuit-breaker.jsonl` | counter state persists across restarts; cooldown timer resumes correctly |
| **NFR-29 wallet redaction** | resolver call mandatory before narration | router invokes `walletResolver.resolve(wallet)` before composer; cache miss + MCP failure → anonymize, never leak `0x…` |
| **NFR-30 MCP transport security** | endpoint allowlist + TLS verify | startup validates every `*_MCP_URL` against allowlist; cert chain validated; no skipCertVerify in any code path |
| **NFR-31 reorg-aware late-arrival** | dedup catches re-emitted events on reorg | indexer reorgs replay events with same `(tx_hash, log_index)` → same `id` → dedup catches; reject path only for events older than `cursor - 6h` AND not in dedup buffer |
| **NFR-32 graceful shutdown** | `ManagedRuntime.dispose()` on SIGTERM | scheduler handlers register `process.on("SIGTERM", () => runtime.dispose())`; in-flight stir tick completes; cursor + ledger flushed; flocks released cleanly |

### 7.0 · graceful shutdown (NEW · NFR-32)

singleton + `stop → start` upgrade means brief downtime is unavoidable
(operator-decided per PRD §9.1). minimize impact:

- `process.on("SIGTERM", () => ambientRuntime.dispose())` registers a
  graceful drain. in-flight stir tick completes (~30s budget); cursor
  + ledger flushed via atomic-rename; flocks released cleanly.
- digest cron handler registers its own SIGTERM hook; the two are
  independent (no shared mutex during shutdown).
- ECS task health-check `unhealthy` for ≤ 60s during upgrade; alerts
  fire only after 120s threshold.
- Discord-side gateway disconnect is benign — bot reconnects on
  re-start; no message loss because messages are not queued client-side.

## 7 · deployment topology (NFR-21–25 singleton invariant)

```
   ╔══════════════════════ ECS / Railway ═══════════════════════╗
   ║                                                             ║
   ║  freeside-characters service                                ║
   ║  ┌─────────────────────────────────┐                        ║
   ║  │  bun run start                  │   task_count: 1        ║
   ║  │  ├── Discord gateway client     │   (CI-checked)         ║
   ║  │  ├── scheduler (3 cadences):    │                        ║
   ║  │  │   ├── digest (weekly)        │   restart policy:      ║
   ║  │  │   ├── stir (hourly · NEW)    │   ON_FAILURE only      ║
   ║  │  │   └── pop-in (existing)      │                        ║
   ║  │  ├── HTTP /webhooks/discord     │   health: tcp /3000    ║
   ║  │  └── ambientRuntime (one inst.) │                        ║
   ║  └─────────────────────────────────┘                        ║
   ║                  │                                          ║
   ║                  ▼ (file system)                            ║
   ║  ┌─────────────────────────────────┐                        ║
   ║  │  /app/.run/                     │   persistent volume    ║
   ║  │    event-cursor.jsonl           │                        ║
   ║  │    event-cursor-seen.jsonl      │                        ║
   ║  │    pop-in-ledger.jsonl          │                        ║
   ║  │    pop-in-ledger.2026-05.jsonl  │   rotated monthly      ║
   ║  └─────────────────────────────────┘                        ║
   ║                                                             ║
   ║  blue/green deployment: deferred (NFR-24)                   ║
   ║  upgrade strategy: stop old → start new (brief downtime)    ║
   ║                                                             ║
   ╚═════════════════════════════════════════════════════════════╝
```

`docs/DEPLOY.md` MUST document `task_count: 1` (or equivalent) as
the deployment invariant. CI gate greps deployment templates.

## 8 · security architecture

minimal new surface, but tightened post-Flatline:

- **score-mcp dependency**: read-only; existing `MCP_KEY` already
  configured for `mcp__score__*` calls
- **codex-mcp dependency**: read-only; existing setup
- **freeside-auth-mcp dependency** (NEW per NFR-29): read-only; existing
  `mcp__freeside_auth__resolve_wallet` setup; required for every
  narration that references a wallet
- **MCP endpoint allowlist** (NFR-30 NEW): every `*_MCP_URL` validated
  against `MCP_ENDPOINT_ALLOWLIST` at boot; TLS chain verified;
  `http://` rejected at parse; no skipCertVerify anywhere
- **`.run/` file write paths**: chmod 600; bot user only
- **wallet redaction invariant** (NFR-29 NEW): raw `0x…` wallet
  addresses MUST NEVER appear in narration prose. enforced at three
  layers: (1) `router.system.ts` calls walletResolver before composer
  invocation; (2) composer's `format/sanitize.ts` regex-guards
  `\b0x[a-fA-F0-9]{40}\b` (existing pattern, now load-bearing); (3) CI
  step greps narration test snapshots for raw `0x…` pattern
- **NO new secrets / API keys** introduced by this cycle
- **Discord side**: ambient pop-ins flow through existing
  `format/sanitize.ts` (Discord-as-Material rules) and webhook delivery

## 9 · stack decisions

| concern | choice | rationale |
|---|---|---|
| runtime | Bun (existing) | no change; ambient runs inside existing process |
| schema | Effect Schema (existing) | composes with existing emojis/expression Schema migration; gives us decoding at MCP boundary + sealed unions |
| effect system | Effect 3.x (existing) | one `ManagedRuntime.make` site per construct-effect-substrate |
| MCP client | `@modelcontextprotocol/sdk` (existing via score-mcp wiring) | no new dependency |
| cron | `node-cron` (existing) | extend `scheduler.ts` with new task; no new lib |
| file locking | `proper-lockfile` (locks via lockfile-dir convention) | NEW small dep; cross-platform; chosen over `fs.flock` for Linux/macOS parity per R-SDD-2. config: `realpath` paths + `stale: 30000` (auto-cleanup zombie lockfiles after 30s) |
| circuit breaker storage | `.run/circuit-breaker.jsonl` (NEW per NFR-28) | tiny JSONL · last-write-wins · operator-readable when triaging |
| bloom filter (dedup spillover) | `bloom-filters` (npm) | ~3KB · pure JS · serializable to `.run/event-cursor-bloom.dat` for NFR-27 |
| persistence | JSONL + flock under singleton invariant (NFR-21) | preserves NG7 |
| tests | bun:test (existing) | unit + integration; mock adapters fulfill ports |

**new dependencies**: `proper-lockfile` (or equivalent flock wrapper). zero infra deps.

## 10 · test strategy

- **unit**: each port has a corresponding `*.mock.ts`; tests reach for
  the Mock layer via `Layer.provide(EventSourceMock)`. coverage target
  ≥85% per NFR-5.
- **integration**: full ambientRuntime against mock score-mcp + mock
  codex-mcp; assert end-to-end stir → router → ledger flow.
- **property-based**: canon-vocabulary FAGAN regex against generated
  prose fragments (random English text padded with codex vocab).
- **regression**: existing 174 tests run; expected zero changes.
- **E2E** (manual): `bun run digest:once` validates digest unchanged;
  `LLM_PROVIDER=stub bun run ambient:tick` (new CLI) validates stir tier.

## 11 · operational tooling

- **observability**: trajectory writes per cron tick to
  `.run/ambient-trajectory.jsonl` `{tick_ts, events_fetched,
  stir_state_per_zone, decisions_made, latency_ms, mcp_failures}`
- **debugging CLIs**:
  - `bun run ambient:tick --zone bear-cave` — one-shot stir tick
  - `bun run ambient:show-stir` — dump current stir vector all zones
  - `bun run ambient:replay --since 2026-05-10T00:00:00Z` — replay from
    cursor (idempotency test in prod)
- **metrics surfaces**: stir_state, mcp_failures, quarantine_count,
  pop_in_count per (zone, character), fire decisions histogram

## 12 · risks (SDD-level — see PRD §9 for product-level)

- **R-SDD-1**: Effect 3.x migration of `compose/reply.ts` for D23
  injection may interact badly with existing chat-mode path. *mitigation*:
  add chat-mode integration test in suite before D23 implementation.
- **R-SDD-2**: `flock` semantics differ between Linux/macOS; advisory
  vs mandatory locks differ. *mitigation*: use `proper-lockfile`
  abstraction; tested on macOS dev + ECS Linux prod.
- **R-SDD-3**: `ambientRuntime` interleave with existing scheduler.ts
  zone locks (`withZoneLock`) — overlapping critical section risk.
  *mitigation*: use the same `zoneLocks` Map; document interaction.
- **R-SDD-4**: Schema migration of `KansaiVector` consumers (existing
  callers of `furnish_kansei`) when D4 sibling field added. *mitigation*:
  additive shape; existing callers unaffected.

## 12.1 · Flatline SDD blocker override log (operator pre-approved 2026-05-11)

| blocker | severity | decision | resolution |
|---|---|---|---|
| **SKP-001 (950)** stop-then-start downtime + SPOF | CRITICAL | **REJECT** | operator-decided singleton in PRD §9.1; graceful shutdown (NFR-32) minimizes; downtime ~30s does not materially harm 6h-drop rave-feel. |
| **SKP-001 (910)** singleton lacks runtime leader election guarantee | CRITICAL | **ACCEPT** | NFR-25 fail-loud crash on flock acquisition failure; CI deployment template check on `task_count: 1`; no runtime election needed under invariant. |
| **SKP-001 (900)** raw wallet 0x… in narration violates CLAUDE.md | CRITICAL | **ACCEPT (LOAD-BEARING)** | added wallet-resolver port + NFR-29; mandatory resolver call before composer; multi-layer enforcement (router + sanitize + CI). |
| **SKP-002 (870)** MCP transport security undefined | CRITICAL | **ACCEPT** | added NFR-30 + §8 endpoint allowlist + TLS verify at boot. |
| **SKP-003 (770)** late-arrival drops reorg events | HIGH | **ACCEPT** | added NFR-31 reorg-aware dedup; same tx_hash+log_index → same id → caught by buffer. |
| **SKP-003 (750)** proper-lockfile semantics quirks | HIGH | **ACCEPT** | §9 pins `proper-lockfile` + `stale: 30000` config; R-SDD-2 already flagged Linux/macOS parity. |
| **SKP-002 (750)** circuit-breaker in-memory lost on restart | HIGH | **ACCEPT** | added NFR-28 + circuit-breaker.port.ts + .live.ts persisting state. |
| **SKP-004 (730)** 5000-ID dedup ring no spillover | HIGH | **ACCEPT** | added NFR-27 + bloom filter persistence (~65kbit · ~0.1% FP). |
| **SKP-004 (720)** NFR-16 6h replay bound brittle for >6h downtime | HIGH | **ACCEPT** | document recovery via `bun run ambient:replay --since <ts>` CLI + alert on stir vector reset; stir loss bounded by 6h half-life. |
| **SKP-005 (710)** ledger atomic-write not specified | HIGH | **ACCEPT** | added NFR-26 tmp-file + rename for every append; rotation does same. |
| **SKP-002 (variable)** schema_version Literal blocks 1.x bumps | HIGH | **ACCEPT** | changed §3.1 Literal → Pattern(/^1\.\d+\.\d+$/); forward-compat for any 1.x. |

DISPUTED items (Flatline IMP-013–015):

| disputed | gpt | opus | decision |
|---|---|---|---|
| **IMP-013** split late-arrival from decay half-life | 640 | 0 | ACCEPT — added separate `EVENT_LATE_ARRIVAL_HOURS` env (default 6) decoupled from `EVENT_RAVE_HALF_LIFE_HOURS` (default 6). |
| **IMP-014** missed-tick behavior during deploy | 560 | 0 | ACCEPT — documented in §7.0 graceful shutdown. |
| **IMP-015** metrics export path undefined | 585 | 0 | DEFER — existing trajectory pattern is the sink; explicit metrics export is V0.8 concern. |

## 12.2 · Flatline HIGH_CONSENSUS auto-integrations (remaining)

| finding | resolution location |
|---|---|
| **IMP-001 (917)** signed/non-negative press mismatch | §3.2 KansaiStir schema unbounded; comment explains primitive inversion |
| **IMP-002 (902)** window semantics for gravity | §3.2 GRAVITY_WINDOW_MINUTES = 60 + transient-one-tick rule |
| **IMP-003 (860)** zoneLocks shared across cadences | use existing `withZoneLock`; stir-tier blocks if digest/pop-in holds; documented in R-SDD-3 mitigation |
| **IMP-004 (802)** ledger-write/cursor-advance gap | NFR-14 transactional advance + NFR-26 atomic ledger writes close the gap |
| **IMP-005 (840)** backfill behavior under high event volume | limit `get_events_since.limit` to 500 server-side (FR-1.1); paginated; cursor advances per page; NFR-15 rejects events older than `cursor - 6h` to bound replay |
| **IMP-006 (867)** ManagedRuntime not disposed on shutdown | NFR-32 graceful shutdown with `runtime.dispose()` |
| **IMP-009 (775)** regex policy without corpus tests | §10 test strategy bullet — property-based generation: random English text padded with codex vocab tests FAGAN regex for false positives + false negatives |
| **IMP-012 (775)** cache staleness on reveal/burn events | mibera-resolver cache TTL = 5min; reveal-class event in router invalidates cache for that token_id explicitly via `walletResolver.invalidate(wallet)` + `miberaResolver.invalidate(tokenId)` |

## 13 · sequencing dependencies

```
score-mibera Phase 1 (FR-1.1–1.7)
        │
        │ score-mcp@1.2.0 published
        │
        ▼
freeside-characters Phase 3 (FR-3.1–3.26) — single sprint, see grimoires/loa/sprint.md
```

Phase 3 can begin against mocks before Phase 1 publishes; integration
test gate requires Phase 1 live.

---

> **next phase**: FLATLINE SDD review via cheval on this document.
