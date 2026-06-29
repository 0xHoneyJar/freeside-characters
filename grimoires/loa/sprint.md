# Sprint Plan — Multi-Angle Member-Graph Ingestion (cycle-010 candidate)

> **Sprint Plan** · `/simstim` `simstim-20260629-22e34aa2` · derives from `prd.md` (FR-1..9, G1..5) + `sdd.md` (§4.1..4.6, §7) · 2026-06-29
> Consume strategy **Z** (in-process reducer). Reviewed: PRD flatline · SDD Bridgebuilder · SDD flatline (all $0, 100% agreement).

## Pre-Sprint-1 gates (⛔ resolve before code lands — both surfaced by review)

| Gate | What | Source | Resolution | Owner |
|---|---|---|---|---|
| **GATE-PKG** (D-1) | `@freeside/shadow-mode-{service,protocol}` importable | Flatline SKP-003/820 | **SPIKED 2026-06-29: both are `private:true`, unpublished (npm 404), v0.1.0; loa-freeside is a *separate pnpm monorepo*, this repo is Bun — no `workspace:*` bridge.** Needs a decided mechanism: (a) publish to private registry (GitHub Packages) from substrate, (b) git-subdir dep, or (c) vetted protocol mirror + CI schema-hash pin. **All but (b) touch substrate-side.** | **operator decision** (cross-repo coupling) |
| **GATE-HOLDER** (R-1) | `holders(contract)` query exists | BB BR-2/HIGH | Spike sonar belt-hasura GraphQL `Token` entity; if absent → G3 degrades to identity-linked-wallets-only + file sonar Token-port issue | agent (spike) + operator (live endpoint) |

Both gates are **investigation, not build** — first work of Sprint 1, **time-boxed ≤4h each** (Flatline SKP-004/720), with a **stop-or-rescope decision recorded in NOTES.md before S1.1** (SKP-001/840). Concrete fail actions:
- **GATE-PKG fail** → stub the substrate import behind a local interface matching the grounded `ShadowLedger`/`ILedgerStore` symbols (§2 SDD); cycle proceeds against the stub, real wiring becomes a follow once the consume mechanism is decided. **Exit criteria:** exact package source · expected exported symbols · schema-hash verify command · recorded fallback.
- **GATE-HOLDER fail** → S2.1 is **skipped** and **degraded G2/G3 (identity-linked-wallets-only) becomes the sprint definition, not a side condition**; sonar Token-port issue filed.

## Sprint 1 — Ingestion core + Discord angle (the spine)

Goal: the in-process ledger fed by the Discord producer, with the locked invariants tested. Proves the loop end-to-end on the one source that already works.

| Task | AC |
|---|---|
| S1.0 | **GATE-PKG + GATE-HOLDER** resolved; outcomes recorded in NOTES.md decision-log; G2/G3 scope confirmed or degraded. |
| S1.1 | `WorldRef` + `SourceProducer` port + `Criticality` (SDD §4.1). `@freeside-characters/member-ingestion` barrel (BR-3). |
| S1.2 | `makeEvent` envelope builder. **`event_id` = sha256(JSON.stringify([name, community_id, source, canonicalPayload]))** — array-encoded, NOT pipe-delimited (Flatline SKP-001/840: pipe preimage collides, e.g. `name='a\|b',cid='c'` ≡ `name='a',cid='b\|c'`). `canonicalPayload` uses a **specified canonical JSON** (RFC-8785/JCS-style: sorted keys, omit `undefined`, no insignificant whitespace, defined number form; SKP-003/730) — reuse a JCS helper, don't hand-roll. Timestamp-free. AC: golden (identical inputs → identical id), counter (distinct payload → distinct id), **aliased-field test** (`['a\|b','c']` ≠ `['a','b\|c']`), cross-runtime fixture. |
| S1.3 | In-process ledger host `new ShadowLedger(new InMemoryLedgerStore())` + `ProjectionReader` over `getMemberGraph`/`getUnresolved`/`getDivergences`. |
| S1.4 | `IngestionOrchestrator` **two-phase execution** (parallel A: discord+onchain → await commits → serial B: identity) (SDD §4.3). AC: mechanical ordering test (discord/on-chain subjects present before any `identity.*.linked` ingested). |
| S1.5 | `DiscordRosterProducer` wrapping `member-source.live.ts` → `discord.member.snapshot.v1` + `incumbent.role.observed.v1`; per-producer `Effect.timeout(30s)`. |
| S1.6 | **Enforcement test (load-bearing):** zero `RoleWriter` calls across ingest/projection/render (SDD §4.4/§6). Idempotency re-run test → all `status: 'duplicate'`. |

## Sprint 2 — On-chain + identity angles + reconciliation (gated on GATE-HOLDER)

Goal: the multi-angle graph — `wallet_only` subjects from chain, `identity_user` from links, conflict-safe.

| Task | AC |
|---|---|
| S2.1 | `OnChainHolderProducer` → `sonar.wallet.attributed.v1` (`edge_kind: held_at_snapshot`); `optional` criticality. **If GATE-HOLDER degraded:** skip; G3 served by identity-linked wallets only (documented). |
| S2.2 | `IdentityLinkProducer` → `identity.wallet.linked.v1` / `identity.account.linked.v1` via `freeside-auth-client.ts`. |
| S2.3 | **Conflict pre-check** (SDD §4.4): `store.findSubjectByAlias` before stitch; collision → no emit + `ConflictQuarantine`. **Atomicity (Flatline SKP-003/820):** the pre-check + `ledger.ingest` run as one **synchronous critical section** (no `await` between read and write) — `ShadowLedger.ingest` is synchronous + `withTransaction`, and Phase B is serial, so the read-check-write cannot interleave. Document this guarantee explicitly. AC: takeover test (wallet bound to identity A, link to B → no stitch, no eligibility). |
| S2.4 | **Durable quarantine** `.run/shadow/<community>-quarantine.jsonl`, append-only, replay next cycle. **Lifecycle (Flatline SKP-002/760 + IMP-003):** bounded — entries carry a `resolved`/`expires_at`; resolved or expired entries are compacted out on replay; cap per community; a re-detected-but-already-resolved conflict does not re-quarantine. AC: cycle-N entry surfaced in N+1; resolved entry not re-surfaced; cap enforced. |
| S2.5 | **Degraded posture** (SDD §4.3): required-producer failure → `degraded` run; enforcement-facing output + go-live suppressed; `IngestionRunSummary` emits `degraded`/`timed_out`/`source_freshness`. AC: required-producer-fails test asserts no eligibility. |
| S2.6 | Multi-source projection test (G2): seed roster + holders + links → assert `discord_member` + `wallet_only` + reconciled `identity_user`. Bottom-up test (G3): holder absent from roster → `wallet_only` present. |

## Sprint 3 — Render over the enriched graph + medium binding (the "UI" strand)

Goal: the CM/member-facing surfaces render the multi-source graph; FR-9.

| Task | AC |
|---|---|
| S3.1 | `discrepancy-cv2` / `public-role-board-cv2` / `member-dashboard-cv2` render over the multi-source projection, including new states: `wallet_only`, no-holding, `unresolved`, `attribution_quality` bands. Voiceless (NG1). |
| S3.2 | Degraded-run banner + source-freshness surface (from S2.5 summary). |
| S3.3 | `IMediumBinding.resolve(world)` → Discord interaction descriptor via `@0xhoneyjar/medium-registry` (FR-9 / #72); render asserts capability before modal/ephemeral. |

## Sprint 4 — Community registration + Phytians bring-up (config-only proof)

Goal: a new community onboards by config, reaching a discrepancy report (G1, G5, G7).

| Task | AC |
|---|---|
| S4.1 | `registerCommunity(payload)` — minimal payload (PRD FR-1), fail-closed validation (no partial), emits `community.config.updated.v1`. **Persistence = a runtime `world-config.json` (or `.run/` keyed config) loaded at startup — NOT runtime mutation of a `.ts` source (Flatline SKP-002/860).** **Authz (SKP-005/710): registration is privileged** — permitted caller surface only (admin CLI / operator-signed payload / sietch auth gate); AC exercises the rejection path for an unpermitted caller. |
| S4.2 | **Phytians bring-up = config entry only** (FR-7). AC: register → ingest → discrepancy report end-to-end. **G5 gate:** if Phytians on-chain/score data unavailable → fixture-backed demo (the path is the deliverable). |

## Out of this cycle (cut conditions honored)

- **FR-8 NATS real-time fill** (loa-freeside #292) — separate cycle; only if Sprint 1–4 land with ≥1 sprint budget left (IMP-005 cut condition). MVP is pull-first.
- **Y — durable ledger** (Postgres + svc-JWT) — named fast-follow; this cycle is Z (snapshot). Revisit if "watch it accumulate" demo is needed (BR-1).
- **Full multi-medium** (Telegram/CLI binding) — FR-9 is Discord-descriptor-scoped for MVP.

## Dependencies & sequencing

- GATE-PKG + GATE-HOLDER block S1.0 → everything.
- Sprint 2 depends on Sprint 1 (port + orchestrator + ledger host).
- Sprint 3 depends on Sprint 2 (the enriched projection to render).
- Sprint 4 depends on Sprint 1 (registration emits into the same ledger host); can parallelize with Sprint 3.
- D-2 (score-api Phytians world data) gates S4.2 live-vs-demo only.

## Flatline Sprint review — reconciliation

3-model ($0 cli-headless · **100% agreement** · confidence full): 8 blockers, 7 high-consensus, 0 disputed. All integrated:
- **SKP-001/840** (event_id pipe collision — a real bug) → S1.2 array-encoded hash + aliased-field AC.
- **SKP-003/730 + IMP-001/875** (canonicalJSON underspecified) → S1.2 JCS-style canonicalization spec.
- **SKP-003/820** (pre-check race) → S2.3 synchronous-critical-section atomicity guarantee.
- **SKP-002/860** (world-config.ts runtime mutation) → S4.1 `world-config.json` runtime target.
- **SKP-005/710** (registerCommunity no authz) → S4.1 permitted-caller-surface + rejection AC.
- **SKP-004/720 + IMP-004/805 + SKP-001/840** (gates no time-box/fallback/exit-criteria) → Pre-Sprint-1 gates: ≤4h time-box, concrete fail actions, recorded stop-or-rescope.
- **SKP-002/760 + IMP-003/875** (quarantine lifecycle unbounded) → S2.4 retention/expiry/cap.
- **IMP-002/872** (criticality control-plane) → already in SDD §4.1 `Criticality`.
- **IMP-005/776** (Phase B no timeout) → orchestrator max-run timeout already covers Phase B (SDD §4.3); add explicit Phase-B `Effect.timeout`.
- **IMP-006/771** (shared run-summary schema) → S2.5 `IngestionRunSummary` is the single typed contract for tests + render.
- **IMP-008/769** (consistent new-state rendering) → S3.1 ships an explicit `subject.kind/attribution_quality → render` mapping table so CM surfaces don't diverge.
