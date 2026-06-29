# Software Design Document — Multi-Angle Member-Graph Ingestion (freeside-characters consumer)

> **cycle-010 candidate** · `/simstim` `simstim-20260629-22e34aa2` · 2026-06-29
> Implements `grimoires/loa/prd.md`. Consume strategy **Z (in-process reducer)** ratified 2026-06-29.
> All substrate references grounded against loa-freeside `origin/main` (PR #316 merged).

## 1. Overview & the Z decision

freeside-characters becomes the **first consumer** of the merged `shadow-mode-api` member-graph ledger by importing it as a **library** and running its reducer **in-process** — no deployed service, no Postgres, no svc-JWT. The cycle adds three things in this repo:

1. **Producers** — adapters that read real sources (Discord roster, on-chain holders, identity links) and emit the substrate's already-defined `ShadowEvent`s.
2. **An in-process ledger host** — `new ShadowLedger(new InMemoryLedgerStore())`, fed by the producers, read for projections.
3. **Projection readers + render** — the existing discrepancy/role-board CV2 surfaces render over the multi-source canonical graph.

Why Z works: shadow-mode is **compute-only and recomputed each cycle**; the in-memory ledger is rebuilt from sources per ingestion run, so the lack of durable append-only history is acceptable (it's the ratified, named fast-follow Y). Nothing is mutated upstream; nothing is persisted that needs a DB.

**Framing (BR-1, operator-conscious):** Z makes the member graph a *flow* (a recomputed snapshot each run), not a *stock* (an accumulating, history-bearing ledger). The discrepancy report is identical either way, so the MVP is unaffected — **but a "watch the graph fill as holders arrive over time" demo cannot be shown from a recomputed snapshot.** If visible accumulation is the selling artifact, that needs Y (persisted history). This cycle ships *a snapshot of coexistence*, deliberately.

## 2. Bound substrate contract (grounded)

**Library imports** (`@freeside/shadow-mode-service` + `@freeside/shadow-mode-protocol`):
- `ShadowLedger`: `constructor(store: ILedgerStore)` · `ingest(event: ShadowEvent): IngestResult` (idempotent/atomic) · `getMemberGraph(communityId): MemberGraphProjection` · `getUnresolved(communityId): ShadowSubject[]` · `getDivergences(communityId): ShadowDivergence[]` · `getConfig(communityId)`.
- `InMemoryLedgerStore` implements `ILedgerStore`.
- `buildAccessAuditReport`.

**`ShadowEvent` envelope** (`schema_version: 'shadow.event.v1'`): `{ event_id, schema_version, community_id, name, source, truth_status, observed_at, emitted_at, evidence_ref?, payload }` — Zod `.strict()`, discriminated on `name`.

**Event names + payloads the producers emit:**
| Event `name` | Producer | Key payload fields |
|---|---|---|
| `community.config.updated.v1` | Registration (FR-1) | `role_rank?`, `watched_contracts?`, `incumbent_bot_ids?` |
| `discord.member.snapshot.v1` | Discord producer (FR-2a) | `discord_user_id`, `display_name?`, `role_ids[]`, `joined_at?` |
| `sonar.wallet.attributed.v1` | On-chain producer (FR-2b) | `wallet`, `contract_address`, `edge_kind` (`minted`/`held_at_snapshot`/…), `token_id?`, `tx_hash?`, `block_number?` |
| `identity.wallet.linked.v1` | Identity producer (FR-2c) | `user_id`, `wallet`, `proof_ref?` |
| `identity.account.linked.v1` | Identity producer (FR-2c) | `user_id`, `account_kind` (`discord`…), `external_id`, `proof_ref?` |
| `incumbent.role.observed.v1` | Discord producer (coexistence) | `discord_user_id`, `incumbent`, `role_ids[]` |

**Reconciliation is in the reducer.** `ShadowLedger.ingest` resolves subjects by alias (`identityAlias(user_id)`, `discordAlias(external_id)`, `walletAlias(wallet)`) and stitches automatically. **The consumer does not re-implement stitching** — it emits well-formed events and reads the reduced graph.

## 3. Architecture — layering

```
                    ┌─────────────────────── apps/bot/src/shadow/ (extended) ──────────────────────┐
   Discord roster ──▶ DiscordRosterProducer ─┐
   sonar/inventory ─▶ OnChainHolderProducer ─┼─▶ IngestionOrchestrator ─▶ ShadowLedger.ingest()
   identity-api    ─▶ IdentityLinkProducer ──┘        (fan-in, fail-closed)        │ (in-process,
                                                                                   │  InMemoryLedgerStore)
   CommunityConfig ─▶ RegistrationProducer ──────────────────────────────────────▶│
                                                                                   ▼
                          ProjectionReader ◀── getMemberGraph / getUnresolved / getDivergences
                                   │
                                   ▼
        discrepancy-cv2 / public-role-board-cv2 / member-dashboard-cv2  (render, voiceless)
                                   │
                                   ▼  (conditioned by)  IMediumBinding (FR-9, Discord-interaction descriptor MVP)
                                   ▼
   go-live-orchestrator ─▶ GateCheckedRoleWriter (LIVE only, unchanged — NOT on ingestion path)
                          └──────────────────────────────────────────────────────────────────────┘
```

The ingestion layer is **new**; the render + go-live layers **already exist** and are reused. The hexagonal seam is the `SourceProducer` port (new) mirroring the existing `RosterSource`/`ScoreSource`/`RoleWriter` Effect-Layer pattern in `substrate.ts` + `composition-root.ts`.

## 4. Component design

### 4.1 `SourceProducer` port + adapters (FR-2)
Producers are **plain async functions** returning `Effect.Effect<ShadowEvent[], ProducerError>`, composed at the orchestrator (BR-5: reserve full Effect `Context.Tag` Layers for the I/O *clients* already Layered in `composition-root.ts`; the testability win is the function boundary, not the Layer — lower ceremony, same isolation):
```
export interface WorldRef {                        // IMP-005: define the port's input
  readonly community_id: string;                   // the ledger community key
  readonly world_slug: string;                     // e.g. 'phytian'
  readonly guild_id: string;
  readonly namespace_prefix: string;               // e.g. 'phytian:'
  readonly watched_contracts: ReadonlyArray<string>;
  readonly score_community_slug: string;
}
export type Criticality = 'required' | 'optional'; // SKP-002/780: degraded-run posture
export interface SourceProducer {
  readonly kind: SourceKind;                        // 'discord' | 'sonar' | 'identity'
  readonly criticality: Criticality;                // discord+identity required; on-chain optional iff R-1 degrades
  readonly produce: (world: WorldRef) => Effect.Effect<ReadonlyArray<ShadowEvent>, ProducerError>;
}
```
**Per-producer timeout (SKP-005/730):** every external call (`guild.members.fetch`, identity-api, sonar GraphQL) is wrapped in `Effect.timeout` (default 30s, configurable). On timeout the producer yields a `ProducerError` and is fail-isolated per §4.3 — a hung upstream never blocks the run.
**Packaging (BR-3):** the ingestion layer (this port + §4.2 envelope builder + §4.3 orchestrator) sits behind a single barrel `@freeside-characters/member-ingestion` from Sprint 1, even while physically in `apps/bot/src/shadow/`. Extraction to the future `freeside-onboarding` building is then a package move, not an N-caller refactor. **Isolation debt (BR-4, tracked):** on extraction, `member-ingestion` + the three producers + the registration path (§4.5) move out; they import no `persona-engine` voice (lint-enforced), so the cut is clean.
- **DiscordRosterProducer** (4.1a) — wraps existing `member-source.live.ts` (`guild.members.fetch`, opcode-8 cached); maps each member → `discord.member.snapshot.v1` (+ `incumbent.role.observed.v1` for Collab.Land roles). Read-only.
- **OnChainHolderProducer** (4.1b, NEW) — reads holders-of-contract for `watched_contracts` via the on-chain source (see R-1: inventory-api holders endpoint vs sonar Token entity — resolve in implementation); maps each holder → `sonar.wallet.attributed.v1` (`edge_kind: 'held_at_snapshot'`). Produces `wallet_only` subjects for holders absent from Discord (G3).
- **IdentityLinkProducer** (4.1c, NEW) — reads wallet↔account links from identity-api (`freeside-auth-client.ts`); maps → `identity.wallet.linked.v1` / `identity.account.linked.v1`. **Conflict pre-check (4.4).**

### 4.2 Envelope builder
A pure helper `makeEvent(name, payload, {community_id, source, truth_status, observed_at})` constructs the `.strict()` envelope with a deterministic `event_id`. **`event_id` scheme — LOCKED (resolves OI-3; SKP-002/850 + IMP-001/910 — was a deferred load-bearing gap):**
```
event_id = sha256( name + '|' + community_id + '|' + source + '|' + canonicalJSON(payload) )
```
**Explicitly excludes `observed_at` / `emitted_at`.** Rationale for *our* semantics: Z recomputes each cycle, so "the same holder still holds" must hash identically across runs → `status: 'duplicate'` (idempotency). A genuine state change (a role added, a wallet linked) changes `payload` → a distinct hash, so it is NOT collided away. Enforced by **golden tests**: (a) identical ingestion inputs → identical `event_id`; (b) semantically-different events → distinct `event_id`. `truth_status`: `verified` for identity-api links, `observed_only` for roster/on-chain snapshots.

### 4.3 `IngestionOrchestrator`
**Execution model — mechanically two-phase (resolves the SKP-001/870 + IMP-003/917 parallel-vs-ordering contradiction; the §4.4 conflict pre-check is load-bearing on this):**
```
Phase A (parallel): Effect.all([discordProducer, onChainProducer], { concurrency: 'unbounded' })
                    → ingest ALL phase-A events → AWAIT every ledger commit.
Phase B (serial):   THEN run identityProducer — its §4.4 pre-check now sees the committed
                    discord + on-chain subjects, so a stitch collision cannot be silently missed.
```
This is a **typed Effect pipeline, not a prose "defensive" note** — the barrier between A and B is real. **Test (mechanical, not observational):** assert the ledger contains discord + on-chain subjects *before* any `identity.*.linked` event is ingested.

**Fail-isolation + degraded posture (SKP-002/780 + IMP-006):** a producer's error drops *its* events and is captured (mirrors L5 per-source capture), but the run is marked **`degraded`** if any `criticality: 'required'` producer failed/timed-out. A degraded projection **suppresses all enforcement-facing output** (no go-live eligibility, no role-board "apply") and renders a prominent source-freshness/error banner — an incomplete graph must never look authoritative. **Orchestrator-level max-run timeout** aborts the whole run and emits `IngestionRunSummary { per_source_counts, errors, idempotency_hits, degraded, timed_out, source_freshness }`.

### 4.4 Reconciliation, merge & enforcement (PRD §6.5 → design)
- **Source authority:** identity-api authoritative for stitching; roster for role state; on-chain for holding/eligibility (encoded as `truth_status` + which producer emits which edge).
- **Conflict pre-check (closes R4 + the substrate last-writer ceiling under Z):** before emitting an `identity.*.linked` event, the orchestrator (which holds the `InMemoryLedgerStore` instance) calls the **grounded** store API `store.findSubjectByAlias(community_id, walletAlias(wallet))` / `discordAlias(external_id)` (both confirmed on `ILedgerStore` + the `*Alias` builders exported from `@freeside/shadow-mode-protocol`). If the alias already resolves to a *different* `identity_user_id`, it **does not emit the stitch**; it records a `ConflictQuarantine` entry. This runs in Phase B (§4.3), so the discord + on-chain subjects are already committed and a collision cannot be missed. We refuse to feed the reducer the conflicting stitch rather than depend on a substrate fix (R3/Z boundary).
- **Durable quarantine (SKP-004/760 + IMP-002/887):** `ConflictQuarantine` entries are **append-only-persisted** to `.run/shadow/<community_id>-quarantine.jsonl` (the repo's sanctioned `.run/` JSONL state pattern; survives process restart). On each ingestion cycle, unresolved quarantine entries are **re-surfaced** without re-detection. Test asserts an entry written in cycle N is still surfaced in cycle N+1.
- **Enforcement invariant:** the ingestion + projection + render code paths import **only** `RosterSource`/`MemberSource`/`ProjectionReader` — never `RoleWriter`. The `GateCheckedRoleWriter` stays reachable only via `go-live-orchestrator` under a LIVE `WorldLock`. Enforced by the existing cross-repo import-boundary lint + a new **mandatory test asserting zero `RoleWriter` invocations** across ingestion/discrepancy/render.

### 4.5 Community registration (FR-1)
`registerCommunity(payload)` validates the minimal payload (PRD FR-1) fail-closed (no partial registration), persists world wiring to the existing world-config seam (`world-config.ts` / `purupuru.yaml`-style manifest), and emits `community.config.updated.v1` (`watched_contracts`, `incumbent_bot_ids`, `role_rank`). Phytians (FR-7) is a config entry, not code.

### 4.6 Medium binding (FR-9, scoped)
`IMediumBinding.resolve(world) → MediumDescriptor`. MVP returns the Discord **interaction** descriptor from `@0xhoneyjar/medium-registry` (modals/buttons available — the `/role-sync` CV2 surfaces). Render adapters assert capability before using modal/ephemeral. True multi-medium (Telegram/CLI) is deferred; the port exists so #72's contract is satisfied without the full extraction.

## 5. Tech stack & dependencies

- **Runtime:** Bun; **Language:** TS strict; **Effect-TS** for the new producer/orchestrator error surfaces (whole-module, per repo convention).
- **New deps:** `@freeside/shadow-mode-service`, `@freeside/shadow-mode-protocol` (from loa-freeside `origin/main`). **D-1 ⛔ PRE-SPRINT-1 GATE (SKP-003/820):** resolve availability before Sprint 1. Preferred: a **workspace-protocol reference** against the loa-freeside monorepo (NOT a manual type mirror — that creates permanent silent drift). If a temporary mirror is truly unavoidable, wire a **schema-hash pin into CI** so any substrate divergence fails the build immediately.
- **Reused:** `member-source.live.ts`, `freeside-auth-client.ts`, `inventory-http-client.ts` / sonar GraphQL, `score/community-client.ts`, `discrepancy-cv2.ts`, `go-live-orchestrator.ts`, `composition-root.ts`, `world-lock.ts`.

## 6. Security & invariants

- **Voiceless (NG1):** no `persona-engine` voice import in any ingestion/registration/render module (lint-enforced by existing import-boundary check).
- **Shadow-first (NG2 / §4.4):** zero `RoleWriter` on ingestion path; mutation only via LIVE-gated go-live. Test-asserted.
- **Fail-closed reconciliation (R4):** conflict → quarantine/unresolved, never silent absorb; no role eligibility from conflicted nodes.
- **Anti-spam (NG3):** ingestion is background pull; emits no Discord messages; not a character surface.
- **No upstream mutation:** producers are read-only against Discord/identity/sonar; the ledger mutates nothing upstream (inherited substrate guarantee).

## 7. Testing strategy

- **Multi-source fixture (G2):** seed roster + on-chain holders + identity links → assert projection contains `discord_member`, `wallet_only`, and reconciled `identity_user` subjects.
- **Bottom-up (G3):** holder absent from roster → assert `wallet_only` subject present.
- **Conflict quarantine (R4):** wallet already bound to identity A, link attempt to identity B → assert no stitch emitted, `unresolved` row surfaced, no eligibility.
- **Enforcement (§4.4):** spy/mock `RoleWriter`; assert **zero** calls across ingestion/discrepancy/render.
- **Idempotency:** re-run ingestion → assert `status: 'duplicate'`, projection unchanged.
- **Registration (FR-1):** missing payload field → fail-closed with field-listing error; no partial state.

## 8. Risks (carried from PRD + design-surfaced)

- **R-1 (NEW, design) — on-chain holder source. ⛔ SPRINT-1 GATE (BR-2), not a task. PARTIALLY SPIKED 2026-06-29:** inventory-api **cannot** serve "holders of contract X" — it exposes only `GET /nfts/{contract}/{tokenId}` (single token) and `GET /profile/{wallet}` (one wallet pfp); there is **no reverse holder-index**. The holder-list candidate is **sonar's `Token` ownership entity via belt-hasura GraphQL** — which per memory exists in PROD Envio but is **not yet ported to the Ponder successor** (`token-entity-gap`, green-belt). **Sprint-1 gate:** confirm a `holders(contract)` GraphQL query against the live belt-hasura endpoint. **If unavailable → G3 degrades to identity-linked-wallets-only** (holders who linked via `/verify` appear as `identity_user`; pure on-chain-only holders do not) and a sonar Token-entity-port issue is filed — never worked around in-consumer.
- **R-2 — substrate alias last-writer ceiling.** Handled consumer-side by §4.4 conflict pre-check; do not depend on a substrate fix this cycle.
- **R-3 — package availability** (D-1 above).
- **R-4 — projection pagination** absent; bound to demo/Purupuru/Phytians-scale communities; large communities are a fast-follow.
- **R-5 — rate limits** on roster + on-chain reads; batch + reuse opcode-8 cache.

## 9. Open items for Bridgebuilder + Flatline SDD review

- OI-1 — Is the Effect-Layer `SourceProducer` port the right seam, or should producers be plain async fns wrapped at the orchestrator (lower ceremony)? (Architecture taste call.)
- OI-2 — Conflict quarantine: render as `unresolved` row vs a distinct CM "conflicts" surface? (UX vs reuse.)
- OI-3 — `event_id` content-hash scheme for idempotency across re-runs (must be stable; exclude timestamps).
- OI-4 — On-chain holder source decision pending R-1 spike — does it gate Sprint 1 sequencing?


## 10. Bridgebuilder design review — reconciliation

7 findings (1 REFRAME, 1 HIGH, 1 SPECULATION, 3 MEDIUM, 1 PRAISE):
- **BR-1 REFRAME** (snapshot vs accumulation) → §1 framing note. Accepted-minor; does not change MVP build (discrepancy report identical). **Surface to operator** at planning.
- **BR-2 HIGH** (on-chain holder source SPOF) → R-1 elevated to a **Sprint-1 gate**; G3 marked contingent with identity-linked-wallets-only degradation pre-written.
- **BR-3 SPECULATION** (name the package now) → §4.1 `@freeside-characters/member-ingestion` barrel from Sprint 1.
- **BR-4 MEDIUM** (extraction debt) → §4.1 isolation-debt note.
- **BR-5 MEDIUM** (Effect-Layer ceremony) → §4.1 producers are plain async fns; Layers reserved for I/O clients.
- **BR-6 PRAISE** (conflict pre-check) → no action; keep.
- **BR-7 MEDIUM** (event_id timestamp-free) → §4.2 content-hash scheme + idempotency re-run test.

## 11. Flatline SDD review — reconciliation

3-model (opus + gpt-5.5 + gemini-3.1-pro · $0 cli-headless · **100% agreement** · confidence full): 8 blockers, 7 high-consensus, 0 disputed. All integrated (technical refinements, no operator fork):
- **SKP-001/870 + IMP-003/917** (parallel-vs-ordering contradiction — the top finding, a real bug) → §4.3 mechanical two-phase execution model + ordering test.
- **SKP-001/860** (`findSubjectByAlias` ungrounded) → §4.4 grounded against `ILedgerStore` (consumer holds the store instance).
- **SKP-002/850 + IMP-001/910** (event_id deferred but load-bearing) → §4.2 LOCKED hash scheme `sha256(name|community_id|source|canonicalJSON(payload))`, timestamp-free, golden+counter tests.
- **SKP-004/760 + IMP-002/887** (quarantine non-persistent) → §4.4 `.run/shadow/<community>-quarantine.jsonl`, replay on next cycle.
- **SKP-005/730** (no timeouts) → §4.1 per-producer `Effect.timeout`(30s) + §4.3 orchestrator max-run timeout.
- **SKP-002/780 + IMP-006** (degraded projection looks authoritative) → §4.3 `degraded` posture suppresses enforcement-facing output + go-live.
- **SKP-003/820** (package availability) → §5 pre-Sprint-1 gate, workspace-protocol ref / CI schema-hash pin.
- **IMP-005/845** (`WorldRef` undefined) → §4.1 typed. **IMP-007/752** (community manifest) → FR-1 payload (PRD) + §4.5.
