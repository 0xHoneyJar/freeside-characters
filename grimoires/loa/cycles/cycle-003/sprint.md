# Sprint Plan — ambient-events-as-rave (cycle-003)

> **Version**: 1.0
> **Date**: 2026-05-11
> **Author**: simstim Phase 5 planner
> **PRD**: `grimoires/loa/prd.md`
> **SDD**: `grimoires/loa/sdd.md`
> **Brief**: `grimoires/loa/context/ambient-events-as-rave.md` (active)
> **Previous cycle baselines preserved**: `sprint-v07a1.md` · `sprint-v07a4.md`

## 0 · context

freeside-characters Phase 3 of the cross-repo ambient-events
implementation. Phase 1 (score-mibera MCP tool additions + class
taxonomy) is a parallel companion cycle in the score-mibera repo;
mocks let Phase 3 start before Phase 1 lands.

Brief carries 24 locked decisions (D1–D24) from 3 pair-points.
PRD + SDD adds 32 NFRs across resilience, security, deployment,
canon enforcement. Flatline 3-model review (cheval-headless) caught
18 blockers across PRD+SDD; operator pre-approved auto-integrations
+ blocker overrides.

## 1 · sprint shape

**4 sprints · estimated 18 tasks · single-track sequential** with
soft parallelism inside each sprint.

| sprint | scope | task count | risk | dependencies |
|---|---|---|---|---|
| **S1** domain + ports + wallet resolver scaffold | SMALL | 4 | LOW | none |
| **S2** live + mock adapters + circuit breaker | MEDIUM | 5 | MEDIUM | S1 |
| **S3** systems + runtime + scheduler integration | LARGE | 5 | MEDIUM | S2 |
| **S4** chat-mode + silence-register + tests + BUTTERFREEZONE | MEDIUM | 4 | LOW | S3 |

soft-parallel inside S2: live adapters can land independently; CI
gates each.

## Sprint 1: Domain + Ports + Wallet Resolver Scaffold

**Goal**: pure-schema + Context.Tag service interfaces, no runtime.
the four-folder discipline made enumerable via `find` + suffix-as-type.

**Tasks**:

### S1.T1 · domain primitives + event schema (FR-3.1 + 3.4 + 3.6)

- write `packages/persona-engine/src/ambient/domain/event.ts` (sealed
  MiberaEvent discriminated union · canon-named per D7)
- write `packages/persona-engine/src/ambient/domain/pulse.ts` (KansaiStir
  + GravityChannel + STIR_FLOOR + HALF_LIFE_HOURS + GRAVITY_WINDOW_MINUTES)
- write `packages/persona-engine/src/ambient/domain/cursor.ts`
  (EventCursor compound key + EventCursorSeen + bloom filter struct)

**AC**:
- `Schema.decodeUnknownSync(MiberaEvent)` parses 7 fixture events
  (one per class) without error
- `Schema.encodeSync(KansaiStir)` accepts negative press values
  (inner_sanctum support per IMP-001 fix)
- `SchemaVersion` Pattern accepts `1.0.0`, `1.2.3`, `1.99.0` and
  rejects `2.0.0`, `0.9.0`, `1.0`

### S1.T2 · canon vocabulary + forbidden-word FAGAN regex (FR-3.5 + S6)

- write `packages/persona-engine/src/ambient/domain/canon-vocabulary.ts`
- table includes all 7 EventClass entries with `chain_word`, `canon_words`,
  `forbidden` arrays
- export `FORBIDDEN_REGEX` constant
- write `packages/persona-engine/tests/ambient/canon-vocabulary.test.ts`
  with property-based generation tests (IMP-009 fix)
- **corpus pin** (Flatline upgraded SKP-003 720): false-positive corpus
  lives at `packages/persona-engine/tests/ambient/fixtures/canon-corpus.txt`
  — 200 lines of English ranging from existing ruggy/satoshi narration
  fragments to neutral test sentences. property test seed = `1337` (fixed
  for determinism). corpus size + provenance reviewed at S4.T4.

**AC**:
- 100-iteration property test (seed 1337) confirms FORBIDDEN_REGEX
  matches each forbidden word AND zero false-positives on the 200-line
  corpus
- table contains all canon translations from brief §canon-vocabulary
  table verbatim

### S1.T3 · class + primitive weights + budgets (FR-3.2 + 3.3 + 3.7)

- write `packages/persona-engine/src/ambient/domain/class-weights.ts`
  (chain-class → axis delta + bypass-probability · D16 locks 0.7)
- write `packages/persona-engine/src/ambient/domain/primitive-weights.ts`
  (lynch primitive → axis weight matrix per LYNCH D10/D11/D12 table)
- write `packages/persona-engine/src/ambient/domain/budgets.ts`
  (Budget schema · refractory + daily-cap + inter-character coord types)

**AC**:
- `PRIMITIVE_AXIS_WEIGHTS["inner_sanctum"].press === -1.0` (inversion)
- `PRIMITIVE_AXIS_WEIGHTS["edge"].gravity === 0.9` AND transfer
  class-bump is +0.3 (FR-3.3 D12)
- Budget schema decode succeeds on fixture with `today_fire_count: 0`

### S1.T4 · ports (Context.Tag interfaces only · NO impl)

- `packages/persona-engine/src/ambient/ports/event-source.port.ts`
- `packages/persona-engine/src/ambient/ports/pulse-sink.port.ts`
- `packages/persona-engine/src/ambient/ports/mibera-resolver.port.ts`
- `packages/persona-engine/src/ambient/ports/wallet-resolver.port.ts` (NEW · NFR-29)
- `packages/persona-engine/src/ambient/ports/circuit-breaker.port.ts` (NEW · NFR-28)
- `packages/persona-engine/src/ambient/ports/pop-in-ledger.port.ts`

**AC**:
- FAGAN gate: `find packages/persona-engine/src/ambient/ports -name '*.port.ts' | wc -l == 6`
- each port file exports a `Context.Tag` with a Service shape
- type-only imports from `domain/`; nothing from `effect` outside `Schema` + `Context`

**S1 deliverable**: green typecheck across new files; zero runtime code
written; FAGAN suffix counts correct.

## Sprint 2: Live + Mock Adapters + Circuit Breaker

**Goal**: every port has a matching `*.live.ts` (production) and
`*.mock.ts` (test) layer. STUB_MODE-compatible.

### S2.T1 · event-source.live + mock (FR-3.12)

- `live/event-source.live.ts` wraps `mcp__score__get_events_since` with
  NFR-7 timeout + NFR-8 retry + NFR-11 unknown-class quarantine logic
- `mock/event-source.mock.ts` produces deterministic stream from
  fixture JSON file
- tests: cursor advance correctness · timeout fires at 15s · retry
  backoff sequence matches contract

**AC**: 100% pass rate against fixture events; mock returns 0/1/many
events on demand; live adapter handles `unknown_event_class` → routes
to quarantine bucket per NFR-11

### S2.T2 · pulse-sink.live + mock (FR-3.13 · D4)

- `live/pulse-sink.live.ts` writes stir as SIBLING channel on rosenzu
  state · NEVER mutates `KansaiVector.feel` · derives motion/shadow/
  density/warmth biases via D24 categorical bumps (no numeric leak)
- **sibling channel = NEW field `KansaiVector.stir_modulation`** (per
  Flatline upgraded SKP-002 740 disambiguation). schema-extend, not
  schema-mutate. baseline `feel` field unchanged. extension lands in
  `rosenzu/lynch-primitives.ts` as part of S3.T5.
- `mock/pulse-sink.mock.ts` collects writes in-memory for assertions

**AC**:
- modifying stir writes ONLY to `kansaiVector.stir_modulation` (new
  field). assertion: `kansaiVector.feel === baseline.feel` after every
  test
- derived biases are STRINGS like `"400ms pulse"`, never numbers
- D24 categorical bump verified via 20 fixture stir states → bias strings

### S2.T3 · mibera-resolver + wallet-resolver live + mock (FR-3.14 + FR-3.27)

- `live/mibera-resolver.live.ts` wraps `mcp__codex__lookup_mibera`
  (60-LRU · 5-min TTL · IMP-012 invalidation on reveal/burn class)
- `live/wallet-resolver.live.ts` wraps `mcp__freeside_auth__resolve_wallet`
  (200-LRU · 10-min TTL · NFR-29 anonymize-on-failure fallback)
- corresponding mocks return deterministic identities + can be primed
  with cache-hit / cache-miss / mcp-failure scenarios

**AC**:
- wallet-resolver mock-failure path returns `{handle: "an anonymous keeper",
  display_handle: null, mibera_id: null}` (NEVER `0x…`)
- mibera-resolver fields match D5/D6/D7 corrections: `time_period`
  not `era`, `drug` not `molecule`, archetype ∈ {Freetekno, Milady,
  Chicago/Detroit, Acidhouse}, element ∈ {Fire, Water, Earth, Air}

### S2.T4 · circuit-breaker + pop-in-ledger live + mock (NFR-26 + NFR-28 · crash-consistency)

- `live/circuit-breaker.live.ts` writes state to
  `.run/circuit-breaker.jsonl` with `flock`; recovers on restart;
  truncated-line corruption tolerated (parse-by-line, skip malformed,
  log to trajectory)
- `live/pop-in-ledger.live.ts` atomic tmp-write + rename appends; monthly
  rotation; flock guards every write (NFR-26); on partial write
  detection (line lacks closing `}` on parse), skip + log
- bloom-filter dedup spillover via `bloom-filters` npm pkg into
  `.run/event-cursor-bloom.dat` (NFR-27)
- **bloom filter persistence atomic-write** (Flatline upgraded SKP-003
  730): bloom serialization via tmp-file + rename like ledger; on
  corrupted load, fall back to empty bloom + emit `bloom_recovery_reset`
  trajectory event; never crash on bloom load failure
- **bloom I/O cadence** (Flatline upgraded SKP-003 720): bloom flushed
  every N=50 inserts OR every stir-tick (whichever first) — bounds I/O;
  configurable via `EVENT_BLOOM_FLUSH_EVERY_N`
- mocks operate in-memory

**AC**:
- ledger rotation triggered at month-boundary fixture test
- circuit breaker counter persists across simulated restart
- circuit breaker survives a fixture with truncated last line (recovers
  state up to the last well-formed line)
- bloom filter false-positive rate ≤ 0.1% over 10k inserts test
- bloom filter survives crash mid-write fixture (loads cleanly with
  reset event emitted; or loads last-saved snapshot)

### S2.T5 · install + pin new deps

- `bun add proper-lockfile bloom-filters`
- pin both in package.json with explicit versions
- `proper-lockfile` config: `stale: 30000` (auto-cleanup zombie locks)
- update `BUTTERFREEZONE.md` dep section

**AC**: `bun install` succeeds; no security advisories; both libs
imported only in `ambient/live/` paths

**S2 deliverable**: every port has live + mock; tests pass; new deps
installed and BUTTERFREEZONE updated.

## Sprint 3: Systems + Runtime + Scheduler Integration

**Goal**: wire the per-frame transforms (pulse.system, router.system)
and compose the ambient runtime; extend the cron scheduler with the
stir tier; extend rosenzu's `furnish_kansei` to emit stir sibling field.

### S3.T1 · pulse.system.ts (FR-3.17)

- events → stir delta with per-primitive weights (D10)
- inner_sanctum density-inversion (D11)
- edge transfer-class boost (D12)
- gravity transient flag fire on class-A landing (D21)
- decay function with HALF_LIFE_HOURS half-life + STIR_FLOOR epsilon (D18)

**AC**:
- given 5 mint events in stonehenge over 1 hour: press > baseline,
  gravity flag set, strangers reflects unique wallets
- given 1 burn in owsley-lab: press goes NEGATIVE (inversion), gravity
  flag fires, awe weight peaks
- given no events: stir decays toward STIR_FLOOR, gravity flag clears
  after GRAVITY_WINDOW_MINUTES

### S3.T2 · router.system.ts (FR-3.18 · OSTROM core)

- per-axis OR-gate threshold check (D14)
- refractory + daily cap (D15)
- inter-character coordination (D17 · shared per-zone refractory) —
  implementation via `pop-in-ledger.live.ts` query (see S3.T2a NEW)
- stochastic class-A bypass with 0.7 probability (D16)
- emits decision: `bypassed | queued | capped | fired | suppressed`
- writes ledger entry per decision (NFR-18)

**AC**:
- 10 mints in 1h in same zone → fires once, then refractory; cap honored
- shared mibera burn event across two characters → exactly one fires
  (lex-min character_id wins · S4 verification)
- gravity-class with bypass roll 0.5 → bypasses threshold; with 0.8 →
  does not bypass
- per-axis triggering passed to narration in `triggering_axis` field

### S3.T2a · shared inter-character refractory implementation (NEW · Flatline upgraded SKP-001 860)

original sprint plan claimed "lex-min character_id wins" but never
explicitly implemented the shared-refractory mechanism. this task
closes the gap.

- extend `live/pop-in-ledger.live.ts` with query API:
  `getLastFire({zone, after_ts}): Promise<LedgerEntry | null>` — reads
  the most recent fire entry across ALL characters for the given zone
- extend `router.system.ts` decision tree: BEFORE checking
  per-character refractory, query `getLastFire({zone, after_ts:
  now - refractoryHours})`. if any character fired within refractory,
  this character SKIPS (writes `decision: "yielded_to_character_X"`
  ledger entry).
- if NO character fired in the refractory window, this character
  proceeds with its own threshold/cap/bypass checks. ties (same
  millisecond from two characters) resolved by lex-min `character_id`
  via atomic check-then-write under flock (NFR-22).
- D17 invariant: across 14-day fixture, no zone has ruggy + satoshi
  firing within `EVENT_POP_IN_REFRACTORY_HOURS` of each other.

**AC**:
- shared ledger query returns most recent fire across ruggy + satoshi
- two characters fire on same shared event → exactly one ledger entry
  per refractory window (lex-min wins · ledger shows
  `yielded_to_character_X` for the loser)
- test: simulate ruggy fires at T=0, satoshi attempts T=1h with
  refractory=4h → satoshi yields; satoshi attempts T=5h → fires
- flock serializes check-then-write to prevent race between two
  simultaneous fires

### S3.T3 · runtime.ts + ambientRuntime composition (FR-3.19 · S9 FAGAN)

- write `runtime.ts` with `Layer.mergeAll` of all 6 Live layers
- export single `ManagedRuntime.make(AmbientLayer)`
- FAGAN gate: `grep -r "ManagedRuntime\.make(" packages/persona-engine/src/ambient | wc -l == 1`
- SIGTERM handler registered: `runtime.dispose()` (NFR-32)

**AC**:
- FAGAN gate passes in CI
- SIGTERM during stir tick test: in-flight Effect completes; flocks released
- `Layer.provide(AmbientLayerMock)` test composition compiles + runs

### S3.T4 · scheduler integration (FR-3.20)

- extend `packages/persona-engine/src/cron/scheduler.ts` with `stirTask`
- cron expression `EVENT_HEARTBEAT_EXPR` (default `"0 * * * *"`)
- task wraps `ambientRuntime.runPromise(stirTickEffect(zone))` for each zone
- uses existing `withZoneLock` (R-SDD-3 mitigation · documents interaction
  with digest + pop-in cron)
- digest cron handler UNCHANGED · D19 invariant assertion: stir cron
  failure does NOT affect digest path (separate try/catch boundary)

**AC**:
- regression test: existing digest cron fires once on Sunday; pop-in
  cron behavior unchanged
- stir tier no-ops when bronze returns 0 new events
- stir tier failure (mock MCP error) does NOT raise from digest task

### S3.T5 · rosenzu/server.ts extension (FR-3.21)

- `furnish_kansei` return gains `stir` sibling field (D4)
- `furnish_kansei` return gains `rendered_modulation` with derived bias
  fields (categorical strings per D24)
- `threshold` tool gains destination-stir awareness (D13)
- `audit_spatial_threshold` UNCHANGED (LYNCH explicit per D13 caveat)

**AC**:
- existing callers of `furnish_kansei` continue to work (additive shape)
- new field validated by Effect Schema
- threshold tool output includes `arrival.stir_register` when destination
  zone has non-baseline stir

**S3 deliverable**: ambient module composes; scheduler fires stir tier
hourly; rosenzu serves stir-aware data.

## Sprint 4: Chat-Mode + Silence-Register + Tests + BUTTERFREEZONE

**Goal**: surface stir state into chat-mode replies (D23); evolve
silence-register with bedrock-kick mode (D1); regression test sweep;
regenerate BUTTERFREEZONE.

### S4.T1 · chat-mode stir injection (FR-3.22 · D23)

- extend `packages/persona-engine/src/compose/reply.ts` to read current
  stir state via `ambientRuntime.runPromise(getCurrentStir(zone))`
- inject pre-baked categorical stir representation into environment
  block at prompt assembly time
- empty MCP servers list UNCHANGED (chat-mode invariant)

**AC**:
- `/ruggy "hello"` in stonehenge with stir-press-high → environment
  block includes derived bias strings (e.g. `"motion: 400ms pulse"`)
- regression: chat-mode latency unchanged within 100ms tolerance
- regression: existing 174 tests still pass

### S4.T2 · silence-register unification + bedrock-kick (FR-3.23 · D22 + D1)

- replace `isFlatWindow(rawStats)` with `isFlatWindow(rawStats, kansaiVector)`
  in `packages/persona-engine/src/expression/silence-register.ts`
- new mode: when stir is below threshold BUT baseline_silence_minutes
  hasn't been crossed → bedrock-kick low-amplitude post
- "the room hums" templates added to `apps/character-ruggy/silence-register.md`
- distinct register vs full silence: bedrock-kick implies presence,
  silence implies absence

**AC**:
- bedrock-kick fires when stir-low + baseline_silence_minutes / 4 elapsed
- silence-register suppresses post when baseline_silence_minutes exceeded
- 3 bedrock-kick fixture templates approved by ALEXANDER lens spot-check

### S4.T3 · per-zone baseline_silence_minutes (FR-3.24 · D20 · LYNCH)

- extend `rosenzu/lynch-primitives.ts` zone profiles with
  `baseline_silence_minutes` field
- defaults: stonehenge (node) 240min · bear-cave (district) 360min ·
  el-dorado (edge) 180min · owsley-lab (inner_sanctum) 720min
- field documented in lynch-primitives schema

**AC**: existing zone profile loads unchanged; new field accessible;
silence-register reads it correctly

### S4.T4 · config + .env.example + BUTTERFREEZONE + S6/S9 gates

- `.env.example` additions per FR-3.25 list (all 11 env vars)
- BUTTERFREEZONE.md regenerated at repo root reflecting new ambient/
  module + new MCP tools consumed
- CI step added for FAGAN gates:
  - `grep -rE "sacrifice|migration|founder.*archetype|\bera\b|\bmolecule\b" packages/persona-engine/src/ambient --include='*.ts'` → exit-zero match-zero
  - `grep -r "ManagedRuntime\.make(" packages/persona-engine/src/ambient --include='*.ts' | wc -l` → expect 1
  - `grep -E "task_count:\s*1|replicas:\s*1" docs/DEPLOY.md` → expect non-zero match (NFR-23)
- update `docs/DEPLOY.md` with singleton invariant declaration

**AC**: all FAGAN gates green in CI; .env.example documents all new
vars with comments; BUTTERFREEZONE references new `ambient/` paths

**S4 deliverable**: cycle implementation feature-complete; CI green;
ready for review-sprint + audit-sprint.

## 5.1 · Flatline SPRINT blocker triage (upgraded triad · gpt-5.5 + gemini-3.1-pro · 2026-05-11)

re-ran with upgraded models per operator request. `gpt-5.5-pro` had
cycle-102 transport disconnects; fell back to `gpt-5.5`. found 6
HIGH_CONSENSUS · 3 DISPUTED · 8 BLOCKERS · 75% agreement (vs prior
6/5/7 · 66% with gpt-5.3-codex + gemini-2.5-pro).

| blocker | severity | decision | resolution |
|---|---|---|---|
| **SKP-001 (860)** inter-character coord lacks impl task | CRITICAL | **ACCEPT (LOAD-BEARING)** | added S3.T2a · explicit shared-refractory implementation via ledger query |
| **SKP-001 (850)** singleton invariant violation during rolling deployments | CRITICAL | **REJECT** | duplicate of SDD §12.1 SKP-001 (950) — operator-decided singleton w/ graceful shutdown (NFR-32); rolling deploys explicitly NG (NFR-24) |
| **SKP-002 (740)** "SIBLING channel" ambiguity | HIGH | **ACCEPT** | S2.T2 clarified — sibling = NEW field `KansaiVector.stir_modulation`; schema extends not mutates |
| **SKP-003 (730)** circuit-breaker/ledger/bloom crash consistency | HIGH | **ACCEPT** | S2.T4 expanded — atomic tmp-write+rename for all three; truncated-line tolerance; bloom corruption recovery via reset event |
| **SKP-003 (720)** bloom I/O bottleneck | HIGH | **ACCEPT** | S2.T4 added flush cadence (N=50 or per-tick); env-configurable |
| **SKP-003 (720)** FORBIDDEN_REGEX corpus provenance | HIGH | **ACCEPT** | S1.T2 pinned to `tests/ambient/fixtures/canon-corpus.txt` (200 lines · seed 1337) |

HIGH_CONSENSUS auto-integrated (5 items):
- **IMP-001 (895)** cycle-level Definition of Done → §6 acceptance gates section below already serves; added cycle-completion checklist
- **IMP-002 (870)** bloom restart compat + deterministic FP → covered by S2.T4 expansion above
- **IMP-003 (827)** resolver failure symmetry → expand S2.T3 AC (mock and live behave same on failure)
- **IMP-005 (845)** tie-break rule traceability → S3.T2a explicit (lex-min character_id under flock)
- **IMP-011 (785)** decay shape fixture → S3.T1 added explicit fixture in AC

DISPUTED (3 items · gpt-only):
- **IMP-013 (820)** docs/DEPLOY.md validator gate at S4.T4 → ACCEPT (low-cost addition)
- **IMP-014 (745)** mock-only fallback for Phase 1 score-mibera dependency → ACCEPT (already mock-first in S2)
- **IMP-015 (610)** p95 latency baseline protocol → DEFER (V0.8 concern, low priority)

## 6 · acceptance gates (cycle-level)

per PRD §3 success criteria:

- **G1 environmental awareness**: validated via S4.T2 bedrock-kick
  fixture review by ALEXANDER lens
- **G2 rave-feel**: validated via S3.T1 + S3.T2 fixture test sweep
- **G3 canon-faithful narration**: validated via S1.T2 FAGAN regex
  property test + S4.T4 CI gate
- **G4 TRUTH/VOICE separation**: structural — no `writes_to_score`
  function exists in `ambient/` (grep gate)
- **G5 configurable + safe**: all env vars in .env.example; refractory
  + daily cap tested in S3.T2

verification per PRD §6.4:
- **S1**: cron log entry per hour in trajectory · validated via
  observability check
- **S2/S3**: deterministic test in S3.T2
- **S4**: shared-zone test in S3.T2
- **S6**: CI gate in S4.T4
- **S7**: post-merge 20-narration audit (operator + claude-headless)
- **S9**: CI gate in S3.T3

## 7 · dependencies + risks (sprint-level)

| sprint | dependency | risk if dependency slips |
|---|---|---|
| S1 | none | none |
| S2 | S1 | port shape changes force S2 rewrite |
| S3 | S2 | mock adapters insufficient for system test |
| S4 | S3 | stir not yet available to chat-mode path |

cross-repo:
- **score-mibera Phase 1 PR merged + score-mcp@1.2.0 published**: blocks
  S2.T1 production test; mocks support development through S3
- **construct-mibera-codex `lookup_mibera` returning expected shape**:
  confirmed at pair-point 3; no expected slip

## 8 · estimated effort

| sprint | low | high |
|---|---|---|
| S1 | 4h | 8h |
| S2 | 8h | 16h |
| S3 | 8h | 16h |
| S4 | 4h | 8h |
| **total** | **24h** | **48h** |

assumes operator + autonomous `/run sprint-plan` execution path with
review + audit cycles per sprint.

## 9 · beads epic structure (proposed)

epic: `bd-XXX` cycle-003 ambient-events-as-rave (assigned at registry init)

- `bd-XXX.S1.T1` — domain primitives + event schema
- `bd-XXX.S1.T2` — canon vocabulary + FAGAN regex
- `bd-XXX.S1.T3` — class + primitive weights + budgets
- `bd-XXX.S1.T4` — ports (Context.Tag interfaces)
- `bd-XXX.S2.T1` — event-source live + mock
- `bd-XXX.S2.T2` — pulse-sink live + mock
- `bd-XXX.S2.T3` — mibera + wallet resolver live + mock
- `bd-XXX.S2.T4` — circuit-breaker + pop-in-ledger live + mock
- `bd-XXX.S2.T5` — install + pin new deps
- `bd-XXX.S3.T1` — pulse.system.ts
- `bd-XXX.S3.T2` — router.system.ts
- `bd-XXX.S3.T2a` — shared inter-character refractory implementation (NEW)
- `bd-XXX.S3.T3` — runtime + ambientRuntime
- `bd-XXX.S3.T4` — scheduler integration
- `bd-XXX.S3.T5` — rosenzu/server.ts extension
- `bd-XXX.S4.T1` — chat-mode stir injection
- `bd-XXX.S4.T2` — silence-register unification + bedrock-kick
- `bd-XXX.S4.T3` — per-zone baseline_silence_minutes
- `bd-XXX.S4.T4` — config + .env.example + BUTTERFREEZONE + S6/S9 gates

beads dependency edges:
- S1.T1 blocks S1.T2, S1.T3, S1.T4
- S1.T4 blocks all S2 tasks
- S2.T1–T5 block S3 tasks
- S3.T3 blocks S4.T1
- S3.T5 blocks S4.T2 (silence-register reads kansei via rosenzu)
- S3.* + S4.T1–T3 block S4.T4 (BUTTERFREEZONE regen at end)

---

> **next phase**: FLATLINE SPRINT review via cheval on this document.
