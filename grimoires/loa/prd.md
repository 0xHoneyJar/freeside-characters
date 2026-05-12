# Product Requirements Document — ambient-events-as-rave

> **cycle**: cycle-003 (assigned at sprint-plan time)
> **generated**: 2026-05-11 via `/simstim-workflow`
> **deep-context source**: `grimoires/loa/context/ambient-events-as-rave.md` (status: active)
> **whole-project baseline** (preserved): `grimoires/loa/prd-ride-baseline.md`

> NOTE — repo convention: `grimoires/loa/prd.md` holds the **current cycle PRD**.
> The whole-project `/ride` baseline lives at `prd-ride-baseline.md`. Both are SoT
> within their scope.

## 0 · context

this PRD is the requirements crystallization of the ambient-events-as-rave
arch-brief, which carries **24 locked decisions (D1–D24)** across
architecture, canon, naming, per-primitive matrix, systems-dynamics, and
rendering. four construct subagents (**artisan/ALEXANDER · mibera-codex
· rosenzu/LYNCH · the-arcade/OSTROM**) ratified the brief at pair-point 3
on 2026-05-11.

**source of truth**: `grimoires/loa/context/ambient-events-as-rave.md`
**parallel-universe reference**:
[purupuru/compass PRD](https://github.com/project-purupuru/compass/blob/main/grimoires/loa/prd.md)
**structural reference**:
[construct-effect-substrate](https://github.com/0xHoneyJar/construct-effect-substrate) ·
`examples/compass-cycle-2026-05-11.md`

## 1 · problem statement

today, the freeside-characters Discord bot speaks once per zone per
week (Sunday digest) plus die-roll pop-ins. on chain there are mints,
transfers, burns, fractures, loans, stakes, badges — the room is alive
— but the Discord does not sense it. when ruggy or satoshi post, they
describe a frozen snapshot from `digestReader.latest()`, not a
stirring surface.

users open the channel and feel they are alone in a frozen room. the
bot performs absence. on-chain activity is invisible to the social
layer.

> *"On-chain games go silent the moment you close the app. We make
> them speak — in tweets, casts, discord, wherever your community
> already is."* — purupuru/compass PRD line 119

## 2 · goals

1. **G1 · environmental awareness** — users entering a Discord zone
   *feel* on-chain activity is happening, without reading event-by-event
   announcements. the room has a felt-temperature.
2. **G2 · rave-feel** — ambient is achieved through 4-axis kansei drift
   (`press · strangers · gravity · drift`) layered onto the existing
   `KansaiVector`, NOT through new dashboard prose. drops shift the
   felt-state; silence-register reads as bedrock-kick not absence.
3. **G3 · canon-faithful narration** — chain-words → mibera-canon at
   the narration boundary (mint → awakening · burn → return-to-source ·
   transfer → crossed-wallets). archetype/element/field-name correctness
   audited against the codex.
4. **G4 · TRUTH/VOICE separation** — score-mibera owns chain truth;
   bot consumes via read-only MCP. presentation never mutates state.
   hallucinations stay cosmetic, not financial.
5. **G5 · configurable + safe** — env-tunable cadence (half-life,
   refractory, daily cap, per-axis thresholds, per-zone enable); class-A
   bypass stochastic to prevent 1-bit-notifier collapse; inter-character
   coordination prevents ruggy + satoshi co-firing.

## 3 · success criteria (measurable)

- **S1** stir tier ships hourly cron with `EVENT_HEARTBEAT_ENABLED=true`
  + no-op behavior when bronze has no new events since cursor
- **S2** per-zone pop-in budget honored — pop-ins/zone/UTC-day ≤
  `EVENT_POP_IN_DAILY_CAP` (default 3)
- **S3** refractory honored — no two pop-ins same zone within
  `EVENT_POP_IN_REFRACTORY_HOURS` (default 4)
- **S4** inter-character non-coincidence — across 14 days, no zone has
  ruggy + satoshi firing on the same event (D17)
- **S5** weekly digest unaffected — Sunday cron unconditional; NOT
  stir-gated (D19)
- **S6** canon-forbidden words absent — FAGAN gate finds zero matches
  for `sacrifice|migration|founder.*archetype|\bera\b|\bmolecule\b`
  in `packages/persona-engine/src/ambient/`
- **S7** no numeric stir leak — manual spot-check of 20 pop-in
  narrations finds zero raw numeric stir scalars in user-facing text (D24)
- **S8** existing 174 tests pass + new tests for pulse/router/
  canon-vocab/budget logic; ≥85% coverage on new paths
- **S9** single `ManagedRuntime.make` site in
  `packages/persona-engine/src/ambient/` (FAGAN gate)
- **S10** BUTTERFREEZONE.md regenerated on both score-mibera (after
  Phase 1) and freeside-characters (after Phase 3)

## 4 · non-goals (explicit scope guards)

- **NG1** not tightening score-mibera Trigger.dev ingestion past 6h
  (path A in D1; follow-up cycle only if operationally validated need)
- **NG2** not building a real-time WebSocket subscription on freeside
  side (path C from pair-point 2 explicitly rejected)
- **NG3** not indexing trait shifts (score-mibera doesn't capture them;
  file-a-gap with envio team if/when needed)
- **NG4** not adding cross-DB joins on score side for MIBERA-id
  enrichment (consumer-side codex MCP path is the resolution mechanism)
- **NG5** not extending ruggy/satoshi voice rules (canon vocabulary
  table is additive translation, not register change)
- **NG6** not bypassing the existing weekly digest (digest is the
  bedrock; ambient stir is additive)
- **NG7** not introducing a new database (event cursor lives in
  `.run/event-cursor.jsonl` per existing pattern)
- **NG8** not mutating `KansaiVector.feel` (stir is sibling channel
  per D4; feel is canon)

## 5 · users and stakeholders

- **primary user** · Discord zone members in stonehenge/bear-cave/
  el-dorado/owsley-lab THJ channels — they experience the ambient
  effect when opening a channel or invoking `/ruggy` · `/satoshi`
- **operator** (zksoju) — tunes env vars, can enable/disable per-zone,
  approves canon vocabulary changes
- **canon authority** (gumi) — voice-rule authoring authority; must be
  looped in if voice register interacts with canon vocabulary
- **score lane owner** (zerker) — owns score-mibera; Phase 1 MCP tool
  additions need coordination
- **codex authority** — owns construct-mibera-codex; consumer-side
  `lookup_mibera` path is a dependency (confirmed shape OK at pair-point 3)

## 6 · functional requirements

### 6.1 · score-mibera (TRUTH side · Phase 1)

- **FR-1.1** NEW MCP tool `get_events_since({since_ts, limit, zone?,
  classes?})` cursor-paginated event stream from `midi_onchain_events`.
  idempotency via existing `id = tx_hash + log_index` PK.
- **FR-1.2** NEW MCP tool `get_event_by_id({event_id})` single-row lookup.
- **FR-1.3** NEW MCP tool `get_recent_mints({collection?, limit})` with
  category_key allowlist filter.
- **FR-1.4** NEW MCP tool `list_event_classes()` class catalog (symmetry
  with `list_dimensions`).
- **FR-1.5** NEW schema `src/db/schema/event-classes.ts` mapping all 52
  existing `category_key` values to canon class enum (D2 server-side
  taxonomy).
- **FR-1.6** MCP server version bump `score-mcp@1.1.0 → 1.2.0`.
- **FR-1.7** BUTTERFREEZONE.md regenerated.

### 6.2 · construct-mibera-codex (verification side · Phase 2)

- **FR-2.1** verify `mcp__codex__lookup_mibera({id: number})` returns
  narration fields. (already confirmed at pair-point 3; no code change
  expected; verification = automated test in Phase 3)

### 6.3 · freeside-characters (VOICE side · Phase 3)

**domain layer**

- **FR-3.1** `ambient/domain/event.ts` sealed Effect Schema discriminated
  union using canon names per D7 (AwakeningEvent / CrossWalletsEvent /
  ReturnToSourceEvent / RevealEvent / BackingEvent / CommittedEvent /
  FractureEvent)
- **FR-3.2** `ambient/domain/class-weights.ts` chain-class → per-axis
  delta lookup, gravity weight + bypass-probability, CANON-locked (D16)
- **FR-3.3** `ambient/domain/primitive-weights.ts` lynch-primitive →
  axis weight matrix per D10/D11/D12
- **FR-3.4** `ambient/domain/pulse.ts` `KansaiStir` with axes (D9);
  gravity as `GravityChannel` transient (D21); stir-floor 0.05 (D18)
- **FR-3.5** `ambient/domain/canon-vocabulary.ts` chain-word → mibera
  canon translation table; forbidden-word list FAGAN-checkable
- **FR-3.6** `ambient/domain/cursor.ts` `EventCursor`
- **FR-3.7** `ambient/domain/budgets.ts` refractory + daily-cap +
  inter-character coord (D15/D17)

**ports (Context.Tag interfaces)**

- **FR-3.8** `ambient/ports/event-source.port.ts` `EventFeed.Service`
- **FR-3.9** `ambient/ports/pulse-sink.port.ts` `PulseSink.Service`
  writes stir as sibling channel; NEVER mutates `KansaiVector.feel` (D4)
- **FR-3.10** `ambient/ports/mibera-resolver.port.ts` codex enrichment
- **FR-3.11** `ambient/ports/pop-in-ledger.port.ts`
  `.run/pop-in-ledger.jsonl` audit trail writer (OSTROM commons)

**live + mock adapters**

- **FR-3.12** `ambient/live/event-source.live.ts` wraps
  `mcp__score__get_events_since`
- **FR-3.13** `ambient/live/pulse-sink.live.ts` writes stir + derived
  motion/shadow/density/warmth bias via D24 categorical bumps
- **FR-3.14** `ambient/live/mibera-resolver.live.ts` wraps
  `mcp__codex__lookup_mibera`; canon field names per D5
- **FR-3.15** `ambient/live/pop-in-ledger.live.ts` JSONL writer
- **FR-3.16** `ambient/mock/*.mock.ts` STUB_MODE deterministic adapters
  for all four ports

**systems (per-frame transforms)**

- **FR-3.17** `ambient/pulse.system.ts` events → stir delta with
  per-primitive weights (D10), inner_sanctum density-inversion (D11),
  edge transfer-weight bump (D12), gravity transient-flag fire (D21)
- **FR-3.18** `ambient/router.system.ts` per-axis OR-gate thresholds
  (D14) + refractory + daily cap (D15) + inter-character coord (D17) +
  stochastic class-A bypass with 0.7 probability (D16); passes
  triggering-axis to narration

**runtime + scheduler**

- **FR-3.19** `ambient/runtime.ts` single `ManagedRuntime.make` site
- **FR-3.20** extend `cron/scheduler.ts` with stir tier; default
  hourly; env-configurable; NEVER stir-gates digest (D19)
- **FR-3.21** extend `orchestrator/rosenzu/server.ts`:
  - `furnish_kansei` return gains `stir` sibling field (D4)
  - `furnish_kansei` return gains `rendered_modulation` derived biases
  - `threshold` tool gains destination-stir awareness (D13)
  - `audit_spatial_threshold` UNCHANGED (LYNCH explicit · safety not
    aesthetic gate)
- **FR-3.22** extend `compose/reply.ts` chat-mode prompt assembly
  injects stirred state into environment block (D23)
- **FR-3.23** `expression/silence-register.ts` unify `isFlatWindow`
  predicate (D22); add low-amplitude bedrock-kick mode (D1 floor)
- **FR-3.24** `rosenzu/lynch-primitives.ts` add
  `baseline_silence_minutes` per zone profile (D20)

**config**

- **FR-3.25** `.env.example` additions: `EVENT_HEARTBEAT_ENABLED`,
  `EVENT_HEARTBEAT_EXPR`, `EVENT_CLASSES_ENABLED`,
  `EVENT_RAVE_HALF_LIFE_HOURS`, `EVENT_STIR_FLOOR_EPSILON`,
  `EVENT_POP_IN_REFRACTORY_HOURS`, `EVENT_POP_IN_DAILY_CAP`,
  `EVENT_POP_IN_THRESHOLD_{PRESS|STRANGERS|GRAVITY|DRIFT}`,
  `EVENT_CURSOR_FILE`

**enum source ownership** (Flatline DISPUTED IMP-012 · operator-decided)

- **FR-3.26** `EventClass` enum on freeside-characters side is **derived
  from** score-mibera's authoritative class taxonomy (FR-1.5). Derivation
  mechanism: at boot, freeside-characters calls
  `mcp__score__list_event_classes()` and validates the consumer-side
  enum against the response. mismatch (new class on score side not yet
  in freeside enum) routes through `unknown class quarantine` (NFR-11)
  and surfaces in cron metrics for operator triage. **score-mibera is
  the canon source of truth for class taxonomy**; freeside-characters
  mirrors with type-safe quarantine for drift.

### 6.4 · acceptance verification protocol (Flatline IMP-001/IMP-006 · auto-integrated)

S1–S10 success criteria need auditable pass/fail mechanisms, not interpretation:

- **S1 verification**: cron log entry per hour shows `event_count >= 0`,
  `cursor_advanced` boolean, latency ≤ 30s. Asserted via E2E test that
  mocks score-mcp with controlled event stream.
- **S2/S3 verification**: deterministic test fixture seeds 10 high-awe
  events into one zone within an hour; router fires ≤1 pop-in within
  refractory; subsequent fires only after refractory clears AND daily
  cap not exhausted. Test stores expected count vs actual.
- **S4 verification**: shared zone receives a class-A event; only one
  character (deterministically selected by lex-min character_id within
  zone) fires; the other observes the ledger entry and skips. 14-day
  observation budget: simulated via timestamp-controlled test, not
  wall-clock waits.
- **S6 verification**: CI step runs `grep -rE
  "sacrifice|migration|founder.*archetype|\bera\b|\bmolecule\b"
  packages/persona-engine/src/ambient --include="*.ts"`. Non-zero exit
  fails CI.
- **S7 verification**: scope = post-merge audit of 20 production
  pop-in narrations sampled randomly across zones over first week.
  Auditor: operator + `claude-headless` cross-check. Document audit
  results in `grimoires/loa/qa/qa-cycle-003-narration-audit.md`.
- **S9 verification**: CI step runs `grep -r "ManagedRuntime\.make("
  packages/persona-engine/src/ambient --include="*.ts" | wc -l`. Non-1
  fails CI.

## 7 · non-functional requirements

- **NFR-1 idempotency** re-fetching events with overlapping cursors
  produces identical state. dedup key = bronze `id` (= `tx_hash +
  log_index`)
- **NFR-2 zero downtime weekly digest** existing digest cron behavior
  preserved through Phase 3 deploy
- **NFR-3 MCP observability** every score-mcp call from ambient logs
  `{tool, latency_ms, event_count, cursor_advanced}` to existing
  trajectory pattern
- **NFR-4 stir state recovery** on bot restart, in-memory stir vector
  rebuilds from last 6h events (one half-life); cursor checkpoint at
  `.run/event-cursor.jsonl` survives restart
- **NFR-5 test coverage** pulse/router/canon-vocab/budgets ≥85%; 174
  existing tests remain green
- **NFR-6 FAGAN gates green** single `ManagedRuntime.make` + port/live
  pairing + canon-forbidden-word check pass in CI

### 7.1 · resilience contract (Flatline IMP-005/SKP-003 · auto-integrated)

ambient module's score-mcp and codex-mcp dependencies must specify
failure-mode behavior:

- **NFR-7 · per-call timeout budgets**:
  `score-mcp get_events_since` ≤ 15s · `codex-mcp lookup_mibera` ≤ 5s.
  exceeded → call fails, scheduler logs `mcp_timeout`, cursor NOT
  advanced.
- **NFR-8 · bounded retries with backoff**: 3 attempts max, exponential
  backoff (1s/2s/4s), full-jitter. retry counter scoped per-cron-fire.
- **NFR-9 · circuit breaker**: after 5 consecutive failures, ambient
  stir tier enters `degraded` mode — skips event fetch, kansei vector
  decays toward floor naturally. recovery: 30-min cooldown then probe.
- **NFR-10 · non-blocking from digest cron**: stir-tier failures never
  affect the weekly digest cron path. enforced by separate scheduler
  task with independent error boundary.
- **NFR-11 · unknown class quarantine**: if `event_classes` returns a
  category_key not in the consumer-side `EventClass` enum, log
  `unknown_event_class` with category_key + count, route to
  `event-classes.quarantine` bucket (does not stir kansei), surface in
  cron metrics for human triage.

### 7.2 · cursor + idempotency contract (Flatline IMP-002/IMP-004/SKP-001 · auto-integrated)

cursor design assumes monotonic-by-timestamp event ordering. real chain
indexers (Envio) can deliver events out-of-order at the millisecond level.

- **NFR-12 · compound cursor key**: cursor stores `(event_time, id)` pair
  per zone (or globally if zone is null), not just `event_time`. ordering
  is lex-sorted by `(event_time DESC, id DESC)`.
- **NFR-13 · overlap window replay**: every `get_events_since` call
  passes `event_time = cursor_event_time - REPLAY_WINDOW_SECONDS`
  (default 60s). dedup at consumer via existing `id` PK; recently-seen
  IDs cached in `.run/event-cursor-seen.jsonl` (ring buffer, 5000 IDs).
- **NFR-14 · high-watermark advance rule**: cursor advances only after
  ALL events in batch have been processed through `pulse.system.ts` AND
  written to ledger. partial batches roll back cursor on error.
- **NFR-15 · explicit late-arrival policy**: events with timestamps
  older than `cursor - 6h` are logged as `late_arrival` and rejected
  (their 6h window has decayed past relevance). prevents replay storms
  on reindexing events.
- **NFR-16 · restart replay ownership**: on bot restart, stir vector
  rebuilds from `cursor - 6h` to `cursor` (one half-life). startup cost
  bounded; logged as `stir_recovery`. cursor itself is the
  replay-checkpoint.

### 7.3 · bypass semantics (Flatline IMP-003 · auto-integrated)

class-A stochastic bypass (D16) interacts with refractory + daily cap:

- **NFR-17 · bypass precedence**: gravity-class event with `bypass_roll
  < 0.7` bypasses **per-axis threshold** check (D14 OR-gate) but does
  NOT bypass refractory (D15) or daily cap (D15). a burn during
  refractory is queued as `late_felt` candidate (becomes felt-after-the-
  fact narration if next refractory window opens within 12h).
- **NFR-18 · explicit bypass observability**: every bypass roll logged
  to `pop-in-ledger.jsonl` with `decision: "bypassed"|"queued"|"capped"`.
  enables S4 retention analysis without re-deriving from logs.

### 7.4 · pop-in-ledger retention (Flatline IMP-011 · auto-integrated)

`pop-in-ledger.jsonl` must persist long enough to support S4 verification
(14-day inter-character non-coincidence assertion):

- **NFR-19 · retention floor**: ledger retains ≥ 30 days of entries.
  rotated to `.run/pop-in-ledger.YYYY-MM.jsonl` at month boundary.
- **NFR-20 · S4 assertion source**: S4 test queries the rolled ledger
  files; not just the active file. 14-day window straddles rotation.

### 7.5 · singleton deployment invariant (Flatline BLOCKER Theme α · operator-decided)

`.run/*.jsonl` + `flock`-based file locking is correct **only under
singleton scheduling**. operator-confirmed: bot deploys as single
instance per environment. NG7 (no new database) preserved by elevating
deployment topology to an invariant.

- **NFR-21 · singleton invariant**: bot deploys as exactly ONE running
  process per environment. ECS task count = 1; Railway service replica
  count = 1; local dev = one `bun run` instance. **Multi-instance
  deployment is a NON-GOAL of this cycle**.
- **NFR-22 · file locking via `flock`**: every write to `.run/event-cursor.jsonl`,
  `.run/pop-in-ledger.jsonl`, `.run/event-cursor-seen.jsonl` uses
  `flock` (POSIX advisory locks) within the same process. cross-process
  protection comes from the singleton invariant.
- **NFR-23 · CI deployment template check**: deployment manifests
  (`docs/DEPLOY.md`, any IaC files for ECS/Railway) MUST include
  `task_count: 1` or equivalent. CI step grep-checks for this string.
- **NFR-24 · graceful blue/green deferred**: blue/green deployment (two
  instances briefly running during cutover) is out of scope for this
  cycle. follow-up cycle if needed; would require migration to
  distributed state backend (Redis/Convex evaluated and deferred).
- **NFR-25 · violation surface**: if NFR-21 is violated (operator
  accidentally scales to 2 instances), the second instance will fail
  to acquire `flock` on cursor write and CRASH at startup with clear
  error: `"singleton invariant violated — another instance holds the
  flock"`. fail-loud > fail-silent.

## 8 · constraints

- **C1 · 6h ingestion ceiling** bronze refreshes every 6h via
  Trigger.dev; stir tier polls hourly but sees fresh events at most
  every 6h. accepted in D1.
- **C2 · Loa workflow gates** all code lands via `/implement` inside
  `/run sprint-plan`; review + audit gates non-skippable
- **C3 · four-folder discipline** domain/ports/live/mock + suffix-as-
  type; single `ManagedRuntime.make` site; FAGAN-checkable structure
- **C4 · TRUTH/VOICE separation** bot never writes to score state
- **C5 · canon vocabulary lock** chain-word → mibera-canon table is
  canon-derived; changes require gumi coordination
- **C6 · Discord-as-Material rules** all outbound Discord text passes
  `format/sanitize.ts` (underscore escape, mobile wrap, fallback
  content on embeds)

## 9 · risks + dependencies

| risk | severity | mitigation |
|---|---|---|
| **R1** score-mibera Phase 1 PR slips → freeside Phase 3 mocks lag | M | mock adapters shipped first; iterate against mocks until Phase 1 lands |
| **R2** burn cluster saturates daily cap, freezes ambient for hours | M | per-axis thresholds + 0.7 stochastic class-A bypass (D14/D16); cap is correct hard limit |
| **R3** 6h ingestion ceiling makes rave-feel too sleepy | M | path B (hourly ingestion) reserved as follow-up cycle; D1 preserves option |
| **R4** LLM leaks numeric stir scalars into prose despite D24 | M | manual 20-pop-in audit (S7); FAGAN regex gate for digit-runs in narration |
| **R5** inter-character coord (D17) races at zone-shared boundary | M | shared per-zone refractory via single mutex on `pop-in-ledger.live.ts`; tested under cron-coincidence |
| **R6** canon-vocabulary lands in production before gumi review | H | FAGAN forbidden-word check alone insufficient; require gumi review on `canon-vocabulary.ts` before Phase 3 PR merge |
| **R7** post-PR validation flags D9 renaming as voice-rule violation | L | renaming is in code (KansaiStir axis names), not in user-facing prose; voice rules unaffected |

**dependencies**:

- score-mibera Phase 1 PR merged + score-mcp@1.2.0 published
- construct-mibera-codex `lookup_mibera` shape verified
- existing weekly digest cron stable through deploy

## 9.1 · Flatline blocker override log (operator-decided 2026-05-11)

| blocker | severity | decision | rationale |
|---|---|---|---|
| **SKP-001 (950)** distributed state via `.run/*.jsonl` fails containerized | CRITICAL | **OVERRIDE** | NG7 (no new database) preserved by elevating deployment to singleton invariant (NFR-21–25). file-locking via `flock` correct under invariant. cheapest path; preserves brief intent. trade-off: blue/green deferred. |
| **SKP-001 (910)** `.run/*.jsonl` split-brain multi-instance | CRITICAL | **OVERRIDE** | same as above — single-instance invariant resolves split-brain by construction. |
| **SKP-002 (880)** process-local mutex cross-host | CRITICAL | **OVERRIDE** | same as above — `flock` is process-local but invariant prevents cross-process need. |
| **SKP-001 (720)** 6h ingestion vs rave-feel goal contradiction | HIGH | **REJECT** | resolved at pair-point 2 (D1) + pair-point 3 (ALEXANDER's bedrock-kick fix). path A explicitly chosen; continuous floor via low-amplitude silence-register addresses the rationalization concern. |
| **SKP-002 (780)** G2/C1 fundamental conflict | HIGH | **REJECT** | duplicate of above — same conclusion. |
| **SKP-003 (770)** MCP failure handling underspecified | HIGH | **ACCEPT** | NFR-7 / NFR-8 / NFR-9 added. timeouts + retries + circuit breaker now contract. |
| **SKP-004 (720)** unknown category_key behavior undefined | HIGH | **ACCEPT** | NFR-11 added — unknown class quarantine + cron metric surface. |

## 10 · open questions

none load-bearing for cycle start. all 24 D-decisions locked at
pair-point 3. surfaced during construct ratification but non-blocking:

- **OQ1** property-based generation test for canon-vocabulary table
  (chain-word → only-canon-output)? · non-blocking
- **OQ2** `pop-in-ledger.jsonl` → permanent audit artifact or stay
  `.run/` ephemeral? · non-blocking
- **OQ3** stir-floor epsilon decay over Discord channel silence
  (channel-inactivity correlates with bera-inactivity)? · follow-up cycle

---

> **next phase**: FLATLINE PRD review via cheval (claude-headless +
> codex-headless + gemini-headless) on this document.
