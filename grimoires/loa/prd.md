# Product Requirements Document — Multi-Angle Member-Graph Ingestion (freeside-characters consumer)

> **cycle-010 candidate** · freeside-characters (consumer) · drafted via `/simstim` `simstim-20260629-22e34aa2` · 2026-06-29
> Altitude (operator-ratified 2026-06-29): **consumer-side, prove the substrate by consuming it.** Build the ingestion + onboarding UX in this repo, binding to the merged `shadow-mode-api` member-graph ledger (loa-freeside PR #316) rather than forking a second graph.
> Spine (operator-ratified): **the multi-angle ingestion pipeline.**
>
> **Grounding note (2026-06-29):** the substrate contract was read directly from loa-freeside `origin/main`. Two v1-draft assumptions were corrected: (1) **mediums-api is a *presentation-capability* registry** ("what can this medium render?"), **not** a guild/onboarding registry; (2) the **canonical member node already exists** in `@freeside/shadow-mode-protocol` (`ShadowSubject`) — we don't design it, we *produce events into it*. Scope shrank accordingly: the gap is the **producers + projection readers**, not the schema.

## 0. The one-sentence frame

Let a **new community** (Phytians and beyond) onboard the Freeside bot and watch its **canonical member graph fill bottom-up from whatever angle members actually arrive** — Discord roster, on-chain holdings, identity links — **without every member manually verifying and without the team being asked to do setup work** — staying voiceless and shadow-first (compute, never mutate, before go-live).

## 1. Problem

Today the member graph fills from **one angle only**: `member-source.live.ts` reads `guild.members.fetch()`, producing `GuildMemberRef` (Discord-keyed). So:

- A holder who owns the collection but **hasn't joined Discord** is invisible.
- A Discord member who **hasn't run `/verify`** has no wallet, no tier, no on-chain truth.
- A **new** community is a manual, team-driven bring-up; the infra cannot absorb a guild and proactively build its graph.

Meanwhile the substrate half is **built, merged, and explicitly unconsumed**: the `shadow-mode-api` ledger (loa-freeside PR #316, merged 2026-06-26) is a read-only/append-only service that reduces upstream events into a canonical member graph + divergences + access-audit — but its README names the gap directly: *"the spine is itself deployed-but-unconsumed."* Eileen's ratified MVP frame (loa-freeside #283): **D1** (canonical member graph / holder-quality) + **D4** (Shadow-Mode coexistence). **D4 built; D1 is the consumer-side gap.** This cycle fills it.

## 2. The substrate contract we bind to (grounded from `origin/main`)

**Canonical member node — already defined** (`@freeside/shadow-mode-protocol`, `ShadowSubject`):
`kind: 'identity_user' | 'discord_member' | 'wallet_only' | 'unresolved'` · `identity_user_id?` · `discord_user_id?` · `wallets[]` · `current_roles` / `incumbent_roles` / `freeside_roles` (coexistence) · `attribution_quality: 'verified' | 'observed_only' | 'unresolved'` (the D1 holder-quality bands) · `merge_provenance[]` (takeover-safe link history) · `pending_resplit`. **The `wallet_only` kind is exactly the "holder not in Discord yet" member.**

**The ingestion event taxonomy — already defined** (`ShadowEvent`): `DiscordMemberSnapshot` · `SonarWalletAttributed` · `IdentityWalletLinked` / `IdentityAccountLinked` / `IdentityLinkRevoked` · `IncumbentRoleObserved` · `FreesideRoleComputed` · `CommunityConfigUpdated`. **Each is one ingestion angle.**

**Produce API:** `POST /events` → fail-closed `IProducerPolicy` → `ShadowLedger.ingest`.
**Consume API:** `GET /communities/:id/member-graph` · `/unresolved` · `/shadow/divergences` · `POST /communities/:id/reports/access-audit`.
**Library form:** `@freeside/shadow-mode-service` exports `ShadowLedger`, `ILedgerStore`, `InMemoryLedgerStore`, `buildAccessAuditReport`, `createShadowRouter` — i.e. the reducer can run **in-process** in the consumer, not only behind HTTP.

## 3. Goals & success metrics

| Goal | Success metric |
|---|---|
| G1 — Absorb a community | A new community is brought up via a `CommunityConfigUpdated` registration + source wiring with **zero hand-edited app code** — only config. |
| G2 — Fill from **≥3 angles** | The graph for a world contains subjects of kind `discord_member`, `wallet_only`, **and** `identity_user` (reconciled) — i.e. produced from Discord roster, sonar attribution, and identity links. |
| G3 — Bottom-up, no-ask | A wallet that holds the collection appears as a `wallet_only` subject **before** it joins Discord or runs `/verify`, **within one ingestion cycle of on-chain detection** (cadence per OQ2). Measured by a test that seeds a holder absent from the roster and asserts a `wallet_only` subject in the projection. |
| G4 — Prove the substrate by consuming it | The consumer produces events into and reads projections from the `shadow-mode-api` ledger — closing the PR #316 deployed-but-unconsumed fast-follow. |
| G5 — Phytians onboards | Phytians (no config in this repo today) reaches a shadow-mode discrepancy report end-to-end. **Gate (per IMP-003):** if Phytians on-chain/score data is unavailable (D1), G5 **demotes to a fixture-backed demo bring-up** — the registration→ingest→discrepancy *path* is the deliverable, not live Phytians data. |

## 4. Non-goals & guardrails (load-bearing)

- **NG1 — Voiceless.** No persona inference in the ingestion/onboarding path (`onboarding-as-voiceless-building` doctrine). CM-configured CV2 surfaces only.
- **NG2 — Shadow-first.** Compute graph + discrepancy; **never mutate Discord roles** before operator go-live (D4 invariant). Mirrors the substrate's read-only/mutates-nothing-upstream guarantee.
- **NG3 — No ambient autonomy / anti-spam preserved** (Eileen #185/#182): no new auto-respond surface; ingestion is background pull/event work, not a character surface.
- **NG4 — Don't fatten one API.** Composition at the consumer (freeside-api-topology doctrine). Sonar/score/inventory stay sealed; the consumer fans them into events.
- **NG5 — No new DB in this repo.** Graph truth lives in the ledger + source APIs + existing `.run/` caches.
- **NG6 — Don't silently fork the schema.** We produce/consume `@freeside/shadow-mode-protocol`. If a field is missing, that's a flagged substrate change (R3), not a local divergence.

## 5. Users & stakeholders

- **CM** — brings up a community, reviews the discrepancy report, flips go-live; owns messaging/components.
- **Operator** — ratifies go-live; only principal who can authorize a LIVE role write (admin allowlist).
- **Members / holders** — onboarded passively (appear from on-chain as `wallet_only`) and actively (`/verify` → `identity_user`). Never spammed.
- **Substrate (loa-freeside) maintainer** — owns the ledger contract + the ceilings (R-series).

## 6. Functional requirements

**FR-1 — Community/medium bring-up (absorb a guild).** A typed registration path that introduces a new `community_id` + its Discord guild + source config, emitting `CommunityConfigUpdated`. This is the "absorb a guild" primitive. **Note:** this is *registration*, distinct from mediums-api (FR-9).

*Minimal registration payload (per SKP-004, enumerated so "zero hand-edited app code" is real, not aspirational):* `community_id` · `world_slug` · `discord_guild_id` · `namespace_prefix` (e.g. `phytian:`) · `collection_contracts[]` (the on-chain holder source) · `score_community_slug` (the tier source) · `identity_authority` (which identity-api tenant is authoritative for stitching) · required Discord permissions/intents (GuildMembers). Registration **validates prerequisites** and emits an in-character-neutral failure listing any missing field — it does not partially register.

**FR-2 — Hexagonal multi-source producers.** A `SourceProducer` port family, each adapter producing the substrate's already-defined events:
- **FR-2a — Discord roster producer** → `DiscordMemberSnapshot` (wraps existing `member-source.live.ts`).
- **FR-2b — On-chain holder producer (NEW)** → `SonarWalletAttributed`: holders of the community's collection via sonar/inventory become `wallet_only` subjects even if absent from Discord.
- **FR-2c — Identity-link producer (NEW)** → `IdentityWalletLinked` / `IdentityAccountLinked`: identity-api links stitch wallet-keyed and discord-keyed subjects (the ledger reconciles into `identity_user`).

**FR-3 — Produce into the canonical node.** Producers emit events; the ledger reduces them into `ShadowSubject`. We **do not** define the node — we conform to it. (Corrects v1-draft FR-3.)

**FR-4 — Bind to the substrate ledger.** Read `member-graph` / `unresolved` / `divergences` projections instead of holding a private graph. **Consume strategy is an open architecture fork** (OQ1): in-process library reducer (Z) vs HTTP against a deployed service (X) vs substrate-hardening-then-live (Y). Closes the PR #316 fast-follow (G4).

**FR-5 — Discrepancy over the enriched graph.** The existing discrepancy / role-board CV2 surfaces render over the multi-source canonical graph, including the new states: `wallet_only` (holder, not in Discord), `discord_member` with no holding, `unresolved`, and `attribution_quality` bands. (The "improve the UI" strand lands here.)

**FR-6 — Shadow-first + go-live unchanged.** Ingestion feeds the existing go-live orchestrator; no role mutation before operator go-live; rollback always available.

**FR-7 — Phytians bring-up.** Config-only path: register (FR-1) → produce (FR-2) → discrepancy report (FR-5), no app-code changes.

**FR-8 (stretch) — Real-time fill via NATS.** Consume guild + member lifecycle events (loa-freeside #292) so the graph updates on join/leave/mint vs pull-only. MVP pull-first; this is the push follow. **Cut condition (per IMP-005):** FR-8 is OUT of the MVP sprint unless pull-first (FR-2) lands with ≥1 sprint of budget remaining; sprint planning schedules it as a separately-acceptance-criteria'd sprint, never bundled into the MVP definition-of-done.

**FR-9 — Medium-capability binding (`IMediumBinding`).** The onboarding/discrepancy/role surfaces (FR-5) render conditioned on the delivering medium's capabilities via `mediums-api` (`@0xhoneyjar/medium-registry`) — e.g. modals are interaction-only, not webhook (the Pattern-B-shell vs interaction split). This is GitHub **#72**'s formal-port ask applied to delivery. **Scope decision pending** (OQ4): MVP may hardcode the Discord-interaction descriptor and defer true multi-medium binding.

## 6.5 Reconciliation, merge & enforcement protocol (Flatline-mandated, lock before Architecture)

Flatline scored "fail-closed is a claim, not a spec" at **920** (SKP-001) — the highest finding. The PRD locks the rules; Architecture *implements*, never *invents*, policy.

**Source authority (the merge priority when sources disagree):**
- **identity-api link** is authoritative for **wallet ↔ discord stitching** (who is whom).
- **Discord roster** is authoritative for **current role state** (`current_roles` / `incumbent_roles`).
- **on-chain (sonar/inventory)** is authoritative for **holding & tier-eligibility**.
- A subject present in only one source is valid (`wallet_only` / `discord_member`); it is *not* an error, it is the bottom-up graph working.

**Collision detection (before any stitch):** the lookup key is `(community_id, wallet)` and `(community_id, discord_user_id)`. A stitch is a collision iff the wallet is already bound to a *different* `identity_user_id`, or the discord_id is already bound to a *different* one.

**Conflict resolution — fail-closed, no silent absorb (closes the FAGAN account-takeover shape, R2):**
- On collision, **quarantine** — the subject stays `unresolved` / `pending_resplit`; **no `freeside_roles` eligibility flows from a conflicted node** and the contested alias is **frozen**, not re-pointed to the last writer (this is exactly the substrate's flagged ceiling — we must *surface* it, not inherit the re-point).
- The conflict is surfaced to the CM as an `unresolved` projection entry for human resolution; it is **never** auto-merged.
- Explicit `IdentityLinkRevoked` triggers re-split (`pending_resplit`); relink re-runs collision detection from scratch.

**Shadow-first enforcement invariant (per SKP-003/760 — a hard code boundary, not just a claim):**
- Ingestion + discrepancy paths produce **read-only projections only**. The `RoleWriter` port stays disabled unless an explicit operator-approved **LIVE `WorldLock`** exists (leverages the existing `GateCheckedRoleWriter` + `world-lock.ts` + the cross-repo import-boundary lint).
- **Acceptance test (mandatory):** assert **zero `RoleWriter` calls** on every ingestion/discrepancy/render path. This is the load-bearing test that makes NG2 mechanical.

## 7. Folded GitHub issues (operator asked to classify + tackle)

| Issue | Repo | Classification | Disposition |
|---|---|---|---|
| **#72** medium-binding seam not a zone contract (`IMediumBinding`…) | freeside-characters | **IN SCOPE (FR-9)** | Render surfaces against the medium-capability registry. MVP may scope to Discord-interaction descriptor. |
| **#292** NATS consumers for guild + member lifecycle | loa-freeside | **IN SCOPE (stretch, FR-8)** | Real-time bottom-up fill; consumer side can live here. MVP pull-first. |
| **#283** D1 Holder-Quality Signal Engine contract | loa-freeside | **CONTRACT (design, not code)** | Our producers populate `attribution_quality`; conforms to D1. Issue is operator-review, not impl. |
| **#185 / #182** Eileen daily repo research | freeside-characters | **GUARDRAIL** | Source of NG1–NG3. Not tasks. |
| #349–#364 prod-readiness / payment / registry / auditor series | loa-freeside | **OUT OF SCOPE** | Different domain. |

## 8. Risks & dependencies (the substrate ceilings are real cross-repo deps)

From the `shadow-mode-api` README "Operational ceilings" — these gate going LIVE (vs a demo):

- **R1 — Producer-auth (`source` self-asserted).** `StaticProducerPolicy` is a structural gate only; the README says *the first live emitter must wire producer-auth via identity-api svc-JWT (`SvcJwtPolicy`)*. **Our producer is that first live emitter** → triggers this requirement (substrate-side).
- **R2 — Persistence.** `InMemoryLedgerStore` is single-process/unbounded; `PostgresLedgerStore` has **no adapter and no PG test**. README: *"Do NOT back a live producer with the in-memory adapter."* → durable live consume needs the PG adapter built first (substrate-side).
- **R3 — Scope creep into substrate.** R1/R2 are loa-freeside work the operator wants to avoid. The **in-process-reducer (Z)** path sidesteps both for a shadow-compute MVP (recompute-from-sources each cycle; no durable ledger needed). Surface, don't silently build a parallel graph (the trap we're avoiding).
- **R4 — Identity reconciliation / takeover.** README flags identity-vs-identity conflict is recorded but not surfaced + alias re-points to last writer. Our identity producer (FR-2c) must fail-closed (the account-takeover-shaped bug FAGAN caught in PR #316).
- **R5 — Rate limits + pagination.** `getMemberGraph`/`getUnresolved` have no pagination; on-chain + `guild.members.fetch` are rate-limited (opcode-8 cache exists). Batch + cache; bound community size.
- **D1 — score-api world data** for Phytians tiers gates G5 (cf. score-api#221 for Purupuru).

## 9. Open questions (for Flatline + operator)

- **OQ1 — Consume strategy. ✅ RATIFIED 2026-06-29: Z — in-process reducer.** freeside-characters imports `@freeside/shadow-mode-service` (`ShadowLedger` + `InMemoryLedgerStore`) and runs the reducer in-process over real producers; renders projections from the in-process ledger. No deploy/PG/svc-JWT this cycle. **Accepted ceiling:** no persisted append-only history — divergence-over-time / durable audit-trail is a named follow-cycle (Y), not this MVP. R1/R2 substrate work deferred accordingly.
- **OQ2 — Pull-first vs event-first** ingestion for MVP (FR-2 vs FR-8 ordering). Bias: pull-first.
- **OQ3 — Phytians: real near-term target with on-chain presence, or stand-in for "Nth community"?** Affects whether G5 is a live bring-up or a demo.
- **OQ4 — mediums naming.** You named "mediums API" as the core onboarding feature, but the existing `mediums-api` is a *presentation-capability* registry, not a guild/graph pipeline. Is "mediums" your term for (a) the per-medium render binding (FR-9), (b) the community/guild absorb primitive (FR-1), or (c) both braided? This reconciliation shapes FR-1/FR-9 framing.

## 10. Flatline PRD review — reconciliation log

3-model review (opus + gpt-5.5 + gemini-3.1-pro · $0 cli-headless · 90% agreement · confidence full): 8 blockers, 6 high-consensus, 1 disputed.

**Pre-resolved by the grounding rewrite (v1→v2), before this review landed:**
- SKP-004/720 (mediums-api guild-registration unverified) — corrected: mediums-api is a *presentation-capability* registry; FR-1 is community registration, mediums is FR-9.
- SKP-002/860 + SKP-001/880 (FR-4 projection API deferred / design downstream of unknown surface) — the contract was read from `origin/main` and is documented in §2; §2 IS the demanded handshake artifact.

**Integrated this pass:**
- SKP-001/920 + SKP-002/850 + SKP-003/760(merge) + IMP-002/890 → **§6.5** reconciliation/merge/enforcement protocol.
- SKP-004/720 (registration payload) → **FR-1** minimal payload enumeration.
- SKP-003/760 (shadow-first enforcement) → **§6.5** enforcement invariant + mandatory zero-RoleWriter test.
- IMP-003/842 (G5 external-dep gate) → **G5** demote-to-demo gate.
- IMP-005/745 (FR-8 cut condition) → **FR-8** cut condition.
- IMP-008/752 (G3 measurable) → **G3** bound + test.
- IMP-004/810 (min projection surface + gap-handling) → satisfied by §2 + NG6.

**Deferred to the operator decision (IMP-001/900 + disputed IMP-011):** OQ1 consume strategy (X/Y/Z) — Flatline insists this is ratified before Architecture. IMP-011 (ledger-write rollback semantics) is contingent on OQ1 and rides with it.
