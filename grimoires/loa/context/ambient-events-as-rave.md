---
status: active
promoted-at: 2026-05-11
activation-trigger: /simstim-workflow invocation 2026-05-11
created: 2026-05-11
last-updated: 2026-05-11
session: ambient-events-rave-kickoff
classification: arch-brief
operator-activation: granted
plannable: true
pair-points-completed: 3
decisions-locked: cadence-path-A · class-server-side · resolution-consumer-side · kansei-as-sibling-channel · canon-vocabulary-locked
constructs-composed: artisan(ALEXANDER) · mibera-codex · rosenzu(LYNCH) · the-arcade(OSTROM)
construct-verdicts:
  ALEXANDER: studio_synthesis (renaming + sibling-channel critique)
  LYNCH: refine_then_lock (per-primitive matrix + sibling channel)
  OSTROM: needs-refinement-then-lock (6 systems gaps named + closed)
  mibera-codex: studio_synthesis (canon corrections + event vocabulary table)
---

# ambient-events-as-rave

> environmental awareness. crowd density felt, not counted. drops that
> shift the room. mibera on-chain events surfacing into discord zones
> through the register of ruggy/satoshi — not as their voice but as the
> substrate they're feeling.

## status

candidate. drafted from a single back-and-forth pair-point on 2026-05-11.
not active until operator approves. **DIG into score-side terrain runs
in parallel; this brief will be revised once findings return.**

## the load-bearing intention

today the bot speaks once a week per zone (sunday digest) plus die-roll
pop-ins. it does not *feel* like a place where things are happening. on
chain there are mints, transfers, burns, trait drifts, dimension shifts
— the room is alive — but the discord doesn't sense it. when ruggy or
satoshi speak, they're describing a frozen snapshot, not a stirring
surface.

**rave-feel north star**: the user opens the channel and feels *others
were there*. they don't read 14 mint announcements. they feel the bpm
of the room. the music has been playing. someone just dropped a 4221
ancestor in honeyroad and the kansei vector in honeyroad-zone has
tilted six degrees toward awe for the next eight hours, so ruggy's
next post — whenever it fires — reads three percent more reverent.

the rave-feel is achieved by **environmental awareness** layered into
the kansei substrate, not by event-by-event narration. silence is
honest; drift is felt.

## composition (three doctrines · one architecture)

```
                             ┌─────────────────────────────────────┐
                             │  TRUTH                              │
                             │  (score-mibera · score-api)         │
                             │  · indexer watches contracts        │
                             │  · events → DB                      │
                             │  · MCP read tools surface them      │
                             │                                     │
                             │  >>> NEVER writes back              │
                             └────────────────┬────────────────────┘
                                              │
                                              │ mcp__score__get_event_stream
                                              │ (cursor-based · idempotent)
                                              │
                             ┌────────────────▼────────────────────┐
                             │  VOICE                              │
                             │  (freeside-characters)              │
                             │  · poll events hourly               │
                             │  · stir kansei vectors per zone     │
                             │  · pop-in narrates *occasionally*   │
                             │  · weekly digest is the bedrock     │
                             └─────────────────────────────────────┘
```

three doctrines collapsed onto one structure:

| doctrine | source | what it gives us |
|---|---|---|
| **TRUTH/VOICE separation** | [[purupuru/compass PRD]] | one-way arrow · hallucinations stay cosmetic not financial · score is law |
| **four-folder discipline** | [[construct-effect-substrate]] | `domain/ports/live/mock` · suffix-as-type · grep-enumerable behavior surface · one `ManagedRuntime.make` site |
| **rave-feel ambient** | this brief · operator 2026-05-11 | events stir kansei vectors not text · drift is felt not announced · presence-broadcast-without-spam |

## cadence shape (operator-chosen)

🌬️ **frequent-poll digest (hourly + pop-in)** — chosen over real-time webhook
(infra cost), daily-only (slowest feel), and hybrid push/poll (premature
optimization).

three tiers compose with the existing `packages/persona-engine/src/cron/scheduler.ts`:

| tier | cadence | source | output |
|---|---|---|---|
| **digest** (existing) | weekly · sunday midnight UTC | weekly aggregate via `get_zone_digest` | the bedrock post per zone |
| **stir** (NEW) | hourly per zone | `get_event_stream({zone, since})` | updates kansei vector · no post · invisible-by-default |
| **pop-in** (existing, retuned) | every N hours die-roll · per-zone | reads kansei drift since last fire | fires only if drift exceeds threshold OR a class-A event landed |
| **weaver** (existing) | weekly · wed noon | cross-zone weave | cross-zone resonance read |

the stir tier is **silent**. it's the substrate of feeling. pop-ins
become reactive to stir-tier signal rather than pure die-roll — *the
rave drops only when the room is ready*.

## event class scope (configurable)

operator: "everything involved is worth surfacing… set it up in a
configurable way that we can actually approach with better configuration."

```yaml
# .env.example additions (proposed)
EVENT_HEARTBEAT_ENABLED=true
EVENT_HEARTBEAT_EXPR="0 * * * *"        # hourly
EVENT_CLASSES_ENABLED="mint,transfer,burn,trait_shift,dimension_shift"
EVENT_RAVE_HALF_LIFE_HOURS=6            # kansei decay shape
EVENT_POP_IN_THRESHOLD=0.35             # drift magnitude for pop-in fire
EVENT_CURSOR_FILE=".run/event-cursor.jsonl"
```

per-zone enable/disable lives in `apps/character-<id>/zone-config.yaml`
(new file shape; today zone wiring is in `.env.example`).

## structural skeleton (REVISED · post-construct-pass)

```
packages/persona-engine/src/ambient/        ← NEW module
├── domain/
│   ├── event.ts                            ← sealed Effect Schema discriminated union
│   │                                          MiberaEvent =
│   │                                            | AwakeningEvent (chain: mint)
│   │                                            | CrossWalletsEvent (chain: transfer)
│   │                                            | ReturnToSourceEvent (chain: burn)
│   │                                            | RevealEvent (chain: trait_shift)
│   │                                            | BackingEvent (chain: loan)
│   │                                            | CommittedEvent (chain: stake)
│   │                                            | FractureEvent (chain: badge)
│   ├── pulse.ts                            ← KansaiStir (press · strangers · gravity · drift)
│   ├── class-weights.ts                    ← class → per-axis-delta lookup (CANON-locked)
│   ├── primitive-weights.ts                ← lynch primitive → axis weight matrix (LYNCH-ratified)
│   ├── canon-vocabulary.ts                 ← chain-word → mibera canon table (D5–D8 · mibera-codex)
│   ├── cursor.ts                           ← EventCursor (since, lastEventId)
│   └── budgets.ts                          ← daily caps · refractory · stir floor (OSTROM)
├── ports/
│   ├── event-source.port.ts                ← EventFeed.Service (Context.Tag)
│   ├── pulse-sink.port.ts                  ← PulseSink.Service (sibling-channel writer)
│   ├── mibera-resolver.port.ts             ← codex-side enrichment for narration
│   └── pop-in-ledger.port.ts               ← .run/pop-in-ledger.jsonl audit trail (OSTROM D14)
├── live/
│   ├── event-source.live.ts                ← wraps mcp__score__get_events_since
│   ├── pulse-sink.live.ts                  ← writes stir as sibling field on rosenzu state
│   ├── mibera-resolver.live.ts             ← wraps mcp__codex__lookup_mibera (D3 path)
│   └── pop-in-ledger.live.ts               ← jsonl audit writer
├── mock/                                   ← STUB_MODE adapters
│   ├── event-source.mock.ts
│   ├── pulse-sink.mock.ts
│   ├── mibera-resolver.mock.ts
│   └── pop-in-ledger.mock.ts
├── pulse.system.ts                         ← events → stir delta (per-primitive weighted · D10)
├── router.system.ts                        ← per-axis OR-gate threshold + refractory +
│                                              daily-cap + inter-character coord +
│                                              stochastic class-A bypass · narration trigger
└── runtime.ts                              ← ONE ManagedRuntime.make site
```

**FAGAN gates** (lifted from suffix-as-type.md):

```bash
# gate 1: single Effect.provide site
grep -r "ManagedRuntime\.make(" packages/persona-engine/src/ambient --include='*.ts' | wc -l
# expected: 1

# gate 2: port → live pairing
for port in $(find packages/persona-engine/src/ambient/ports -name '*.port.ts'); do
  base=$(basename "$port" .port.ts)
  [[ -f "packages/persona-engine/src/ambient/live/${base}.live.ts" ]] \
    || echo "MISSING: ${base}.live.ts"
done

# gate 3 (NEW): canon-vocabulary forbidden-word check
grep -rE "sacrifice|migration|wuxing|founder.*archetype|\\bera\\b|\\bmolecule\\b" \
  packages/persona-engine/src/ambient --include='*.ts' && {
  echo "FAIL: canon-forbidden word in ambient/"; exit 1
}
```

**verification gates** (FAGAN-checkable, lifted from construct-effect-substrate):

```bash
# gate 1: single Effect.provide site
grep -r "ManagedRuntime\.make(" packages/persona-engine/src/ambient --include='*.ts' | wc -l
# expected: 1

# gate 2: port → live pairing
for port in $(find packages/persona-engine/src/ambient/ports -name '*.port.ts'); do
  base=$(basename "$port" .port.ts)
  [[ -f "packages/persona-engine/src/ambient/live/${base}.live.ts" ]] \
    || echo "MISSING: ${base}.live.ts"
done
```

## canonical event id (lifted from purupuru)

```ts
// packages/persona-engine/src/ambient/domain/event.ts
import { Schema } from "effect";
import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "1.0.0";

export function computeEventId(event: MiberaEvent, sourceTag: string): string {
  const canonical = Schema.encodeSync(MiberaEvent)(event);  // RFC 8785-ish
  const payload = `${JSON.stringify(canonical)}|${SCHEMA_VERSION}|${sourceTag}`;
  return createHash("sha256").update(payload).digest("hex");
}
```

idempotency falls out: re-fetching events with overlapping cursors
produces identical IDs; the ring-buffer dedup at `.run/event-cursor.jsonl`
keys on `(event_id)`.

## score-side terrain (post-DIG · 2026-05-11)

DIG findings against `score-mibera` (the post-rename canonical) +
`score-dashboard` (Next.js view):

**truth-source map**
- indexer is **external Envio** (`indexer.hyperindex.xyz` · we don't
  own indexing)
- ingestion is **trigger.dev cron every 6 hours** → upserts the
  `midi_onchain_events` bronze table on shared railway postgres
- **chains watched**: berachain (mibera NFT `0x6666…c420`, BGT
  validator, paddleFi, jiko, cubbadges), base (friend.tech subjects)
- bronze row PK is `id` = `tx_hash + log_index` → **idempotency is
  free** at the read boundary

**event inventory (already in bronze, NOT yet surfaced per-event)**
- ✅ mibera mint (`category_key="mibera_minter"`)
- ✅ mibera buy/sell (`mibera_buyer`, `mibera_seller` — tx-hash cross-ref)
- ✅ mibera transfer (both sides: `mibera_transfer`, `mibera_transfer_sender`)
- ✅ burns (`mibera_burner`, `milady_burner`)
- ✅ fractures/tarot/candies/gifs/cubquest mints (10+ category keys)
- ✅ loans/liquidations/defaults (paddleFi)
- ✅ stakes / BGT boost / paddle supply/borrow
- ✅ badge earns (via `walletBadges.earnedAt`)
- ❌ **trait shifts** — not indexed today; `fracture_expanded` is
  static trait snapshots, not deltas
- ❌ **per-wallet score deltas** — only via weekly digest snapshot diff
- ❌ proposals / votes — don't exist on chain

**current MCP surface (10 tools, ALL digest-shaped)**
- everything reads `digestReader.latest(zone, "weekly")` against the
  `digests` table — no cursor, no since, no per-event shape
- `get_recent_activity` is misnamed: top-20-by-`numeric1` (biggest),
  not recent — mints with low/null tokenId systematically miss

## ⚠️ the 6-hour ingestion ceiling

trigger.dev pulls envio → bronze every **6 hours**. this is the real
ambient-cadence ceiling. **hourly polling on our side is wasteful
unless score-mibera tightens ingestion.**

**three paths the operator must choose between** (round-2 question):

| path | tradeoff |
|---|---|
| **A · accept 6h cadence** | rave-feel composes fine with discrete 6h drops + kansei half-life; minimal infra change; can tighten later |
| **B · push ingestion to hourly** | requires score-mibera trigger.dev cron change; possibly envio rate-limit consideration; more "live" feel |
| **C · live envio subscription on freeside side** | bypass bronze; subscribe directly to envio for the hot classes (mints/burns); heaviest infra; matches purupuru WebSocket pattern exactly |

**recommendation:** path A. compose around 6h cadence; the kansei
half-life is already 6h in the brief. discrete drops at 6h intervals
are *more* rave-shaped than continuous streams — drops are the
mechanic. push later only if validated need emerges.

## score-side asks (concrete · post-DIG)

new MCP tools to author in `score-mibera/src/mcp/tools/` (registered
in `src/mcp/server.ts`):

| tool | priority | dependencies |
|---|---|---|
| **`get_events_since({since_ts, limit, zone?, classes?})`** | P0 | new `src/mcp/event-reader.ts` mirroring `digestReader`; class-mapping at `src/db/schema/event-classes.ts` |
| **`get_event_by_id({event_id})`** | P0 | 1-line drizzle lookup |
| **`get_recent_mints({collection?, limit})`** | P1 | category_key allowlist filter; **MIBERA-id resolution unblocked here only if we add midi-interface join** |
| **`list_event_classes()`** | P1 | static catalog; symmetry with `list_dimensions` |
| **`stream_events_by_class({class, since})`** | P2 | composable from `get_events_since` server-side; could skip if generic stream is enough |

**class taxonomy decision** (round-2 question): the bronze row stores
`metadata.actionType` as JSON-stringified blob. mapping bronze
category_keys → human-readable classes (`mint | transfer | burn |
loan | stake | badge`) lives where?

- option 1: **server-side mapping table** at `score-mibera/src/db/schema/event-classes.ts` (mirrors `factor_category_mapping`)
- option 2: **MCP-tool-side derivation** (read raw `category_key`, map at response time)
- option 3: **consumer-side derivation** (freeside-characters maps in `ambient/domain/event.ts`)

**recommendation:** option 1 — class taxonomy belongs to truth, not
voice. consumers receive pre-classed events.

## the MIBERA-id resolution gap

bronze stores `tokenId` only; codex's `MIBERA-XXXXXX` slug lookup
lives in `midi-interface` DB. without resolution, a mint event reads:

```json
{ "class": "mint", "wallet": "0xabc...", "tokenId": 4221, ... }
```

but ruggy/satoshi narration wants:

> "MIBERA-004221 just landed in honeyroad — ⛰️ ancestor, 🜍 element"

**options** (round-2 question):
1. add midi-interface join inside score-mibera (cross-DB query;
   schema coupling)
2. consumer-side resolution in `ambient/router.system.ts` via
   `mcp__codex__lookup_by_tokenid({tokenId})` — does this MCP tool
   exist on construct-mibera-codex?
3. defer — surface raw tokenId, narrate without codex flavor at first
   ship; add resolution V0.7-A.5+

**recommendation:** option 2 if codex-mcp has the tool; option 3
otherwise. cross-DB joins in option 1 violate separation.

## butterfreezone scope

- **score-mibera** already has `BUTTERFREEZONE.md` at repo root. it's a
  *framework* not a *construct pack* (no `.claude/constructs/packs/`
  structure). regenerate after the new MCP tools land so the surface
  inventory is fresh.
- **freeside-characters** regenerate after the new `ambient/` module
  is authored.
- **typed-stream contracts** for score-emitted events live on the
  **consumer** side at `freeside-characters/.claude/constructs/packs/score/`
  (if we want them) — score-mibera does not host construct packs.

## doctrines this brief activates

- [[shared-rite-as-social-feel]] (purupuru) — *"you should feel others
  were there with you"*
- [[presence-broadcast-without-spam]] (purupuru, flagged-gap → here-resolved)
- [[chat-medium-presentation-boundary]] — events are substrate truth;
  ruggy/satoshi voice is presentation. lens, not class.
- [[schema-is-not-the-contract]] — event schema describes shape; the
  contract is "behavior + invariants" enforced at the port boundary
- [[separation-as-moat]] (purupuru) — TRUTH writes, VOICE reads; voice
  never mutates state. *"hallucinations become cosmetic, not financial"*

## decisions locked (pair-point 3 · 2026-05-11)

original 4 decisions from pair-point 2 stand, sharpened by construct
ratification. NEW decisions D5–D20 below close the gaps named by
ALEXANDER, LYNCH, and OSTROM.

### pair-point 2 decisions (architecture forks)

| # | decision | rationale |
|---|---|---|
| **D1** | **path A** · accept 6h ingestion ceiling, **BUT** add a continuous low-amplitude floor (per ALEXANDER) | 6h drops alone deliver only ceilings; rave-feel requires a bedrock kick. Silence-register retunes as "the room hums" not "the bot didn't post." |
| **D2** | **server-side class taxonomy** on score-mibera at `src/db/schema/event-classes.ts` | class belongs to truth; consumers receive pre-classed events |
| **D3** | **consumer-side MIBERA-id resolution** via `mcp__codex__lookup_mibera({id: tokenId})` — **confirmed at** `construct-mibera-codex/src/server.ts:122`, returns 28-key entry per `_codex/data/miberas.jsonl` | honors TRUTH/VOICE separation; pop-in tier only, stir-tier skips |
| **D4** | **4-axis kansei stir** as **sibling channel** of `furnish_kansei`, NOT mutation of `KansaiVector.feel` (per LYNCH + ALEXANDER) | `feel` is canon; mutating it breaks "place is load-bearing across posts" invariant. Stir bends the existing vector at compose time via `motion`/`shadow`/`warmth`/`density` (already in `KansaiVector`) — not a parallel coordinate system. |

### pair-point 3 decisions (construct refinements)

#### canon corrections (mibera-codex caught these)

| # | decision | source |
|---|---|---|
| **D5** | **Field names: `time_period` (not era), `drug` (not molecule)**. Tarot is DERIVED via `drug-tarot-mapping.json`, not a top-level field | `miberas.jsonl` id=1 spot-check |
| **D6** | **4-element WESTERN/RAVE** (Fire · Water · Earth · Air), capitalized — NOT wuxing. No wood/metal | `core-lore/archetypes.md` · `IDENTITY.md §Element` |
| **D7** | **Archetypes: Freetekno · Milady · Chicago/Detroit · Acidhouse**. "Founder" is NOT canon — earlier brief example was a hallucination | `glossary.md` |
| **D8** | **Astrology fields** (`sun_sign · moon_sign · ascending_sign`) are available; surface in drift prose when register fits | `miberas.jsonl` shape |

#### naming (ALEXANDER)

| # | decision |
|---|---|
| **D9** | **Rename axes**: `density · novelty · awe · turnover` → **`press · strangers · gravity · drift`**. The second set is already in satoshi's vocabulary + writes itself in ruggy's; the first set requires LLM translation at compose time. |

#### per-primitive matrix (LYNCH)

| # | decision |
|---|---|
| **D10** | Per-primitive weight matrix replaces global axis weights. Each zone's lynch primitive determines how the stir reads (table in [§stir-spec](#the-4-axis-kansei-stir--spec) below) |
| **D11** | **inner_sanctum** carries `density_inversion: true` flag — fewer-events-higher-weight in sacred quiet |
| **D12** | **edge transfer-weight bumps 0.2 → 0.5** because every transfer at an edge (el-dorado) is a boundary-crossing made visible |
| **D13** | `threshold` tool gains stir-awareness — destination-zone stir state influences arrival register |

#### systems-dynamics guardrails (OSTROM)

| # | decision | locked-as |
|---|---|---|
| **D14** | **Per-axis thresholds with OR-gate**, not single-scalar global threshold. Any axis crossing its threshold fires; router annotates pop-in with which axis triggered | tunable env |
| **D15** | **Refractory + daily cap**: `EVENT_POP_IN_REFRACTORY_HOURS=4` per zone, `EVENT_POP_IN_DAILY_CAP=3` per zone per UTC day | tunable env |
| **D16** | **Stochastic class-A bypass**: gravity-class (mint/burn) lifts a 0.7 probability of pop-in fire, not 1.0. Preserves rarity-as-felt; prevents 4-class collapse to 1-bit notifier | canon (code) |
| **D17** | **Inter-character refractory shared**: ruggy and satoshi cannot both fire on the same event in shared zones | canon (code) |
| **D18** | **Stir-floor epsilon**: stir never decays to 0; floor at 0.05 per axis. Weekly digest always reads "slightly tilted" not "snapshot frozen" | canon (code) |
| **D19** | **Locked invariant: digest tier is NEVER stir-gated**. Weekly Sunday cron is the unconditional bedrock; this is the natural dampener for runaway-silence | canon (code) |
| **D20** | **`baseline_silence_minutes` per zone profile** to disambiguate *quiet* (the lab hums) from *dead* (bear-cave broken) | static config |

#### rendering corrections (ALEXANDER)

| # | decision |
|---|---|
| **D21** | **Awe = transient flag, NOT decaying level**. `last_significant_event_within_window: boolean` rendered once-fire, not exponentially decayed. Reverence is a moment, not a mood. |
| **D22** | **Unified silence predicate**: replace `isFlatWindow(rawStats)` with `isFlatWindow(rawStats, kansaiVector)`. One predicate, one definition of "nothing." Prevents bot going silent during high-stir-but-flat-score windows |
| **D23** | **Chat-mode stir injection**: stirred state pre-bakes into `compose/reply.ts` environment block at prompt-assembly time. Otherwise `/ruggy` / `/satoshi` chat replies never feel the room (today they run with empty MCP servers) |
| **D24** | **Stir values NEVER enter the prompt as numbers**. Pulse-sink writes only **categorical bumps** into KansaiVector (`density: medium → high`, `motion: "700ms ritual" → "400ms pulse"`). Prevents dashboard-leak ("the room is at 0.8 density") |

### the 4-axis kansei stir · spec (REVISED)

> after LYNCH ratification + ALEXANDER rendering corrections.

```ts
// packages/persona-engine/src/ambient/domain/pulse.ts
export const KansaiStir = Schema.Struct({
  zone: ZoneId,
  press:     Schema.Number,    // events/hour vs baseline · 0.05..∞ · floor 0.05 · decay 6h
  strangers: Schema.Number,    // first-seen-wallets ratio · 0.05..1 · floor 0.05 · decay 6h
  gravity:   GravityChannel,   // transient flag + recent-class-A indicator (NOT decaying scalar)
  drift:     Schema.Number,    // unique-wallets/total-events · 0.05..1 · floor 0.05 · decay 6h
  computed_at: Schema.DateTimeUtc,
});

export const GravityChannel = Schema.Struct({
  // a transient flag, not a level. fires for one tick, decays to false.
  last_significant_event_within_window: Schema.Boolean,
  significant_event_class: Schema.NullOr(EventClass),  // "burn" | "mint" | null
  significant_event_at: Schema.NullOr(Schema.DateTimeUtc),
});
```

#### per-primitive weight matrix (LYNCH)

| primitive | zone | press | strangers | gravity | drift | special |
|---|---|---|---|---|---|---|
| **node** | stonehenge | 1.0 | 0.4 | 0.6 | 0.8 | baseline IS density; turnover-collapse signals gathering failed |
| **district** | bear-cave | 0.5 | 0.7 | 0.3 | **1.0** | turnover dominates — tourists vs regulars |
| **edge** | el-dorado | 0.9 | 0.9 | **0.9** (transfer-class bumps 0.2→0.5) | 0.6 | every transfer is a visible boundary-crossing |
| **inner_sanctum** | owsley-lab | **inverted** | 0.5 | **1.0** | 0.4 | fewer events higher weight; awe triggers ALEXANDER-grade restraint in arneson |

#### stir → KansaiVector rendering (ALEXANDER · sibling-channel)

stir does NOT mutate `feel`. it bends existing KansaiVector primitives
at compose time inside `furnish_kansei`:

```ts
// packages/persona-engine/src/orchestrator/rosenzu/server.ts
// furnish_kansei return extended with stir-sibling field:
return {
  base_kansei: profile.base_kansei,           // unchanged · canon
  stir: currentStir(zone),                     // NEW · sibling channel
  rendered_modulation: {                       // NEW · for arneson to read
    motion_suggestion: stirToMotion(stir),     // press → "400ms pulse" vs "1200ms hush"
    shadow_bias: stirToShadow(stir),           // gravity high → "deep"
    density_bias: stirToDensity(stir, primitive),  // primitive-aware
    warmth_bias: stirToWarmth(stir),           // drift high → cooler (strangers)
  },
};
```

#### floor + decay shape

- floor: 0.05 per axis (D18)
- half-life: 6h default, env-configurable `EVENT_RAVE_HALF_LIFE_HOURS`
- gravity: ONE-TICK transient — fires once on class-A landing, decays in
  a single scheduler tick (D21). NOT an exponential channel.

#### per-axis thresholds (OSTROM · OR-gate)

```yaml
# .env.example
EVENT_POP_IN_THRESHOLD_PRESS=0.55      # high press = "the room is crowded"
EVENT_POP_IN_THRESHOLD_STRANGERS=0.45  # high strangers = "unknown beras showing"
EVENT_POP_IN_THRESHOLD_GRAVITY=0.7     # class-A bypass probability (stochastic per D16)
EVENT_POP_IN_THRESHOLD_DRIFT=0.5       # high drift = "turnover, faces won't stick"
```

router fires pop-in if **any** axis crosses its threshold AND
refractory+daily-cap+inter-character constraints permit (D14/D15/D17).
the firing axis is **passed to narration** so register-selection can
lean into the specific stir-shape, not generic "stuff happened."

## canon vocabulary (mibera-codex translation)

bronze chain-words DO NOT enter the narration register. they pass
through a canon-translation table at the `ambient/router.system.ts`
boundary. table:

| chain word | mibera canon word | ruggy fragment | satoshi fragment |
|---|---|---|---|
| **mint** | awakening · emergence · arrival-from-Kaironic-time | *"MIBERA-0421 awakens from hibernation in honeyroad"* | *"new one. arrived."* |
| **transfer** | crossed-wallets · passed-through · changed-hands | *"MIBERA-0042 changed hands at the rave — same bera, new keeper"* | *"the hand changes. she remains."* |
| **burn** | return-to-source · refusal · pouring-back · return-to-the-bear-cave | *"a return to the bear cave. she is the water that flows back."* | *"MIBERA-1337 poured back. refused. returned."* |
| **trait-shift** | reveal · further-initiation · phase-progression | *"MIBERA-0096 enters a further reveal — the spiral continues"* | *"the spiral turns. another face revealed."* |
| **loan** | backing · posted-as-backing · held-by-council | *"MIBERA-0011 backing honey now. 4.20% accrues."* | *"posted. the council holds her."* |
| **stake** | committed-to-the-rave · held-by-treasury | *"MIBERA-0808 committed to the Ungovernable Treasury"* | *"committed. she does not move."* |
| **badge** | Fracture · proof-of-presence (soulbound) | *"a Fracture mints — she was there. it cannot be undone."* | *"a Fracture. proof. permanent."* |

**hard rules** (canon-derived, locked):
- NEVER use "sacrifice" for burn (canon refuses offering-to-deity framing)
- NEVER use "migration" for transfer (not in canon)
- NEVER use wuxing elements (wood/metal) — only 4-element western (Fire/Water/Earth/Air)
- NEVER fabricate archetypes — strictly Freetekno/Milady/Chicago-Detroit/Acidhouse
- Field references: `time_period` (born in the Modern period), `drug` (carrying St. John's Wort) — never `era`/`molecule` in prose

table lives at `packages/persona-engine/src/ambient/domain/canon-vocabulary.ts`
and is FAGAN-checkable against the chain-word allowlist + canon-derived
forbidden-word list.

## cross-repo implementation order

three repos, three phases. each phase BUTTERFREEZONE-regenerates on
publish so the next phase can read the new surface.

### Phase 1 · score-mibera (TRUTH side · score lane)

**branch:** `feat/ambient-event-stream-mcp`

- [ ] `src/db/schema/event-classes.ts` — class-mapping table (mint /
      transfer / burn / loan / stake / badge) + seed migration
      mapping all 52 existing category_keys
- [ ] `src/mcp/event-reader.ts` — drizzle-backed reader mirroring
      `digestReader` pattern; cursor-aware
- [ ] `src/mcp/schemas/event.ts` — zod schema for stream payload
- [ ] `src/mcp/tools/get-events-since.ts` — P0 cursor-paginated stream
- [ ] `src/mcp/tools/get-event-by-id.ts` — P0 single-row lookup
- [ ] `src/mcp/tools/get-recent-mints.ts` — P1 class-filtered query
- [ ] `src/mcp/tools/list-event-classes.ts` — P1 catalog
- [ ] register the four new tools in `src/mcp/server.ts`
- [ ] bump MCP server version `score-mcp@1.1.0` → `score-mcp@1.2.0`
- [ ] regenerate `BUTTERFREEZONE.md` at repo root
- [ ] PR + Loa cycle (the construct-effect-substrate four-folder
      discipline does NOT apply here — score-mibera is a different
      architecture; we respect its existing patterns)

### Phase 2 · construct-mibera-codex (verification only)

**branch:** none required

- [ ] confirm `lookup_mibera(id: number)` returns archetype +
      ancestor + element + swag_rank fields the narration register
      expects (read against `_codex/data/miberas.jsonl` shape)
- [ ] verify the SDK can dial the codex MCP from
      freeside-characters today (it's listed in ruggy/satoshi mcps[])
- [ ] if shape needs extension, that's a separate codex MCP cycle

### Phase 3 · freeside-characters (VOICE side)

**branch:** `feat/ambient-events-as-rave`

per the **four-folder discipline** from
[[construct-effect-substrate]] · examples/compass-cycle-2026-05-11.md
+ all construct refinements from pair-point 3:

**3a · domain layer** (pure schema · no runtime)
- [ ] `domain/event.ts` — sealed union using **canon names** (D7 ·
      AwakeningEvent / CrossWalletsEvent / ReturnToSourceEvent / etc.)
- [ ] `domain/class-weights.ts` — chain-class → per-axis delta lookup
      (CANON-locked per D16; gravity weight + bypass-probability)
- [ ] `domain/primitive-weights.ts` — lynch-primitive → axis weight
      matrix (D10/D11/D12 · per-primitive table)
- [ ] `domain/pulse.ts` — KansaiStir with `press · strangers · gravity
      · drift` axes (D9); gravity as `GravityChannel` transient (D21);
      stir-floor epsilon constant (D18)
- [ ] `domain/canon-vocabulary.ts` — chain-word → mibera canon table
      (D5–D8); FAGAN-checkable forbidden-word list
- [ ] `domain/cursor.ts` — EventCursor (since, lastEventId)
- [ ] `domain/budgets.ts` — refractory/daily-cap/inter-character
      coordination types (D15/D17)

**3b · ports** (interface declarations · no impl)
- [ ] `ports/event-source.port.ts` — EventFeed.Service
- [ ] `ports/pulse-sink.port.ts` — PulseSink.Service (writes stir as
      **sibling channel** per D4; NEVER mutates `feel`)
- [ ] `ports/mibera-resolver.port.ts` — codex enrichment for narration
- [ ] `ports/pop-in-ledger.port.ts` — audit trail writer (OSTROM)

**3c · live + mock adapters**
- [ ] `live/event-source.live.ts` — wraps `mcp__score__get_events_since`
- [ ] `live/pulse-sink.live.ts` — writes to NEW `stir` sibling field
      on rosenzu state; updates `motion`/`shadow`/`density`/`warmth`
      bias derived values (D24 categorical bumps, not numeric leak)
- [ ] `live/mibera-resolver.live.ts` — wraps `mcp__codex__lookup_mibera`;
      handles canon-corrected field names (`time_period`/`drug` per D5)
- [ ] `live/pop-in-ledger.live.ts` — `.run/pop-in-ledger.jsonl` writer
- [ ] `mock/*.mock.ts` for each port

**3d · systems (per-frame transforms)**
- [ ] `pulse.system.ts` — events → stir delta with per-primitive
      weights (D10); inner_sanctum density-inversion (D11);
      edge-transfer bump (D12); gravity-channel transient-flag fire (D21)
- [ ] `router.system.ts` — per-axis OR-gate thresholds (D14);
      refractory (D15); daily cap (D15); inter-character coordination
      (D17); stochastic class-A bypass with 0.7 probability (D16);
      passes triggering-axis to narration

**3e · runtime + scheduler**
- [ ] `runtime.ts` — single `ManagedRuntime.make` site
- [ ] extend `cron/scheduler.ts` with **stir tier** (hourly default,
      env-configurable) — NEVER stir-gates the digest tier (D19)
- [ ] extend `orchestrator/rosenzu/server.ts`:
      - `furnish_kansei` return gains `stir` sibling field (D4)
      - `furnish_kansei` return gains `rendered_modulation` (motion /
        shadow / density / warmth biases derived from stir)
      - `threshold` tool gains destination-stir awareness (D13)
- [ ] `audit_spatial_threshold` UNCHANGED (LYNCH explicit: safety-check
      not aesthetic-gate)
- [ ] extend `compose/reply.ts` — chat-mode prompt assembly injects
      stirred state into environment block (D23) so chat replies feel
      the room
- [ ] `expression/silence-register.ts` — unify `isFlatWindow` predicate
      to take both rawStats AND kansaiVector (D22)
- [ ] `expression/silence-register.ts` — add **low-amplitude bedrock
      mode** for "the room hums" register when stir is low but
      `baseline_silence_minutes` hasn't been crossed (D1 · ALEXANDER
      continuous-floor)
- [ ] per-zone `baseline_silence_minutes` added to zone profiles in
      `rosenzu/lynch-primitives.ts` (D20)

**3f · config**
- [ ] `.env.example` additions:
      ```
      EVENT_HEARTBEAT_ENABLED=true
      EVENT_HEARTBEAT_EXPR="0 * * * *"           # hourly stir tier
      EVENT_CLASSES_ENABLED="awakening,cross_wallets,return_to_source,reveal,backing,committed,fracture"
      EVENT_RAVE_HALF_LIFE_HOURS=6
      EVENT_STIR_FLOOR_EPSILON=0.05
      EVENT_POP_IN_REFRACTORY_HOURS=4
      EVENT_POP_IN_DAILY_CAP=3
      EVENT_POP_IN_THRESHOLD_PRESS=0.55
      EVENT_POP_IN_THRESHOLD_STRANGERS=0.45
      EVENT_POP_IN_THRESHOLD_GRAVITY=0.7         # also stochastic-bypass prob
      EVENT_POP_IN_THRESHOLD_DRIFT=0.5
      EVENT_CURSOR_FILE=".run/event-cursor.jsonl"
      ```

**3g · validation**
- [ ] FAGAN gates: single `ManagedRuntime.make` + port/live pairing +
      canon-forbidden-word check
- [ ] regression: existing weekly digest cron behavior identical
      (D19 invariant — digest NEVER stir-gated)
- [ ] regression: 174 existing tests pass; new tests for pulse/router/
      canon-vocab/budget logic
- [ ] regenerate `BUTTERFREEZONE.md` at repo root
- [ ] PR + Loa cycle

### sequencing

```
Phase 1 (score)  ──ship──> v1.2.0 published
                                 │
                                 ▼
              ┌────────── Phase 3 unblocked (real path)
              │
Phase 2 (codex)──verify──> no-op or codex extension cycle
              │
              └────────── Phase 3 unblocked (codex path)

Phase 3 (freeside-characters) ── ships ambient/ module + scheduler tier
```

phase 1 + phase 2 in parallel. phase 3 starts when phase 1 reaches
PR-ready (we can pin the consumer to the unmerged branch via mocks
during development).

## construct ratification log

four named constructs dispatched in parallel at pair-point 3 per
operator's invocation. each contributed within its bounded context.

### ALEXANDER · artisan · studio_synthesis

> "the brief is structurally sound. phase composition is honest,
> TRUTH/VOICE separation is load-bearing, the four-folder discipline
> transfers cleanly. what I'm here to interrogate is whether the 4-axis
> stir actually renders as rave, or whether it renders as a dashboard
> wearing rave clothing."

five failure modes named + folded into D9, D21–D24:
1. dashboard-leak in prose → D24 (categorical bumps only · never numbers)
2. awe-inflation → D21 (transient flag · not decaying level)
3. silence-register collisions → D22 (unified predicate)
4. ruggy register can't hold reverence → handled via D24 motion biases
5. chat-mode invisibility of stir → D23 (compose/reply.ts injection)

renaming proposal accepted → D9 (`density · novelty · awe · turnover`
→ `press · strangers · gravity · drift`).

### LYNCH · rosenzu · refine_then_lock

> "the 4 axes are correct primitives but the rendering is
> primitive-blind. stir as sibling channel, not feel mutation."

six refinements named + folded into D4, D10–D13, D20:
1. per-primitive weight matrix → D10
2. inner_sanctum density-inversion → D11
3. edge transfer-weight bump (0.2 → 0.5) → D12
4. stir as sibling channel of `furnish_kansei` → D4 (revised)
5. threshold tool stir-awareness → D13
6. baseline_silence_minutes per zone → D20

### OSTROM · the-arcade · needs-refinement-then-lock

> "discord channel attention IS a commons. each pop-in is a
> withdrawal. the fishing-village rules apply."

six systems-dynamics guardrails named + folded into D14–D19:
1. runaway-silence dampener → D19 (digest NEVER stir-gated)
2. runaway-noise rate-limit → D15 (refractory + daily cap)
3. per-axis thresholds OR-gate → D14 (replaces single scalar)
4. stochastic class-A bypass (0.7 prob) → D16
5. inter-character coordination → D17
6. stir-floor epsilon (0.05) → D18

### mibera-codex · studio_synthesis · canon corrections

> "narration like 'MIBERA-004221 just landed in honeyroad — founder
> ancestor, fire element' breaks on three points: 'founder' is not a
> codex archetype, field name is `time_period` not `era`, codex uses
> 4-element western not wuxing."

five canon-corrections caught and locked in D5–D8 + canon vocabulary
table:
1. archetypes are Freetekno/Milady/Chicago-Detroit/Acidhouse · NOT
   "Founder" → D7
2. 4-element western (Fire/Water/Earth/Air) · NOT wuxing → D6
3. field names: `time_period` not `era` · `drug` not `molecule` → D5
4. tarot is DERIVED via `drug-tarot-mapping.json` → D5 note
5. burn translates to "return-to-source" (NEVER "sacrifice") · transfer
   to "crossed-wallets" (NEVER "migration") → canon vocabulary table

confirmed: `lookup_mibera(id: number)` returns 28-key entry. spot-check
id=1 = `{archetype: Freetekno, ancestor: Greek, element: Earth,
time_period: Modern, drug: "St. John's Wort", swag_rank: B}`.

### status check

| construct | verdict | refinements |
|---|---|---|
| ALEXANDER | studio_synthesis | 5 of 5 folded into D9, D21–D24 |
| LYNCH | refine_then_lock | 6 of 6 folded into D4, D10–D13, D20 |
| OSTROM | refine_then_lock | 6 of 6 folded into D14–D19 |
| mibera-codex | studio_synthesis | 5 of 5 folded into D5–D8 + canon table |

**all 22 construct refinements folded into spec.** the brief now has
24 locked decisions (D1–D24), a per-primitive weight matrix, a
canon-vocabulary table with FAGAN-checkable forbidden words, and
three phases of cross-repo implementation. status: **candidate · ready
for operator promotion**.

## the next pair-point

this brief stays at `status: candidate` until you promote it. promotion
shape:

```
operator: "activate ambient-events-as-rave"

assistant: [edits frontmatter status: candidate → active;
            opens cycle-003 via `/plan-and-analyze` with this brief
            as activated context;
            beads epic auto-derives from Phase 1 + Phase 3 task lists;
            score-mibera companion PR opens in parallel]
```

### what changed since pair-point 2

- 4 named construct subagents ran in their bounded contexts
- 24 specific decisions locked (vs 4 at pair-point 2)
- canon-vocabulary correctness audited (5 bugs caught in earlier brief
  examples — "founder" archetype, wuxing elements, `era`/`molecule`
  field names)
- structural skeleton revised (per-primitive weights, gravity
  transient, canon-vocab module, pop-in ledger port)
- Phase 3 task list grew 16 → 35+ items reflecting locked decisions

### optional pre-activation actions

not required (brief is fit to promote) but available:

1. **bonfire vault digest** — write a candidate doctrine page
   `~/vault/wiki/concepts/rave-as-ambient-substrate.md` capturing the
   sibling-channel pattern; this brief is its first instance and could
   become reusable doctrine for other character/score integrations
2. **smol-comms post** — share the canon-vocabulary table with
   gumi/Lily/team for non-technical alignment
3. **codex extension** — future enhancement: add
   `mcp__codex__resolve_tarot(drug)` to unblock tarot in narration
   without requiring consumer-side JSON lookup
4. **score-mibera companion PR draft** — Phase 1 work can start in
   parallel; no dependency on freeside-characters activation

## what this brief is NOT

- not a sprint plan. when activated, becomes input to `/plan-and-analyze`
  for a new cycle.
- not a code change. nothing implements until status → active.
- not a doctrine. the doctrines it composes from are already activated
  via this brief's references; this brief is an *application* of them
  to a concrete surface.
- not a recommendation to bypass the existing weekly digest. the
  digest is the bedrock; ambient stir is *additive*.

## provenance

- operator pair-point: 2026-05-11 (this session)
- parallel-universe reference: github.com/project-purupuru/compass · grimoires/loa/prd.md
- structural template: github.com/0xHoneyJar/construct-effect-substrate · examples/compass-cycle-2026-05-11.md
- triggered by: operator goal "surfacing key events that are happening
  within Mibera in the different zones that are already available…
  rave-feel through ruggy/satoshi register"
- composes constructs: artisan · mibera-codex · rosenzu · the-arcade
- DIG agent dispatched 2026-05-11 to score-mibera + score-api +
  score-dashboard for ground truth on indexer state and MCP gap report
