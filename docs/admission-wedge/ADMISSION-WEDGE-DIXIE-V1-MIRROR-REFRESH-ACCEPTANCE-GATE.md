# Admission Wedge — Dixie v1 mirror-refresh acceptance / next-lane decision gate

> **Phase 45J** (Freeside Characters-side docs / decision only). Date:
> 2026-06-06. Follows Freeside Characters **Phase 45I / PR #176**
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + `.test.ts` and the refreshed local mirrored probes under
> `docs/admission-wedge/dixie-probes/` — the test-only / docs-fixture-bound
> Dixie v1 mirror-refresh / adapter-compatibility implementation), **Phase 45H /
> PR #174** (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md` — the docs /
> decision gate that selected Phase 45I), and **Phase 45G / PR #173**
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — the adapter
> acceptance / next-lane decision gate), over Dixie **Phase 33E / PR #122**
> (`../loa-dixie/docs/admission-wedge/fixtures/` — the **draft v1** probe
> hardening / vocabulary refinement). Companion to
> `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` (Phase 45E),
> `docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md` (Phase 45D), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix — its §7
> live-memory-admission gates and §8 prohibitions govern everything this gate
> points toward).
>
> This document **accepts** the bounded proof Phase 45I landed and **selects the
> next lane**. It is **not** a new adapter, **not** a mirror mutation, **not** a
> test change, **not** a fixture / mirrored Dixie probe JSON mutation, **not** a
> reducer / runner / adapter code change, and **not** a runtime wiring. It
> implements nothing. It introduces no source, test, fixture JSON, mirrored Dixie
> probe, package, lockfile, config, CI, or generated change; no runtime Discord
> behavior; no Discord command; no live Dixie admission route; no live Dixie
> call; no network call; no storage write; no Straylight store; no memory write.
> It does **not** rename any local fixture label, **does not** mutate any reducer
> reason code, **does not** export the adapter, **does not** widen the adapter's
> supported probe version, and **does not** freeze a final schema. It does
> **not** claim Dixie Phase 33E is a production schema, and it does **not** claim
> Freeside Characters owns the Dixie or Straylight vocabulary. If a step seems to
> require reaching past these boundaries, the answer is to open the separate
> later phase that owns it (decision-map §7 / §8) — not to relax it from this
> decision.

---

## 1. Phase title and status

**Phase 45J — Admission Wedge Dixie v1 mirror-refresh acceptance / next-lane
decision gate.**

- Phase 45J is a **Freeside Characters-side docs / decision-only artifact.** It
  produces this acceptance decision plus the smallest possible cross-reference
  notes in the docs named in §15. It introduces no source, test, fixture JSON,
  mirrored Dixie probe, package, lockfile, config, CI, or generated change.
- Phase 45J **follows Freeside Characters Phase 45I / PR #176** (the test-only /
  docs-fixture-bound Dixie v1 mirror-refresh / adapter-compatibility
  implementation) and **Dixie Phase 33E / PR #122** (the draft v1 probe
  hardening / vocabulary refinement the Phase 45I refresh mirrors). It reads both
  as evidence.
- Phase 45J **does not implement new adapter behavior.** It writes no validator,
  no adapter, no new test, and no new mirrored probe. It only *accepts* the
  bounded proof Phase 45I landed and *selects* the next lane.
- Phase 45J **does not mutate mirrors or probes, change tests, change reducer /
  runner / adapter code, or wire runtime.** The Phase 45I-refreshed v1 mirrors,
  the Phase 45I adapter / test, the Phase 44A reducer, the Phase 44C runner, and
  the Phase 43C fixtures remain exactly as landed. No package surface is
  exported. No live admission is authorized.
- Phase 45J **does not freeze a final schema.** Dixie Phase 33E is explicit that
  its probes are **draft v1 — NOT frozen, NOT canonical, NOT a route contract**
  (`schema_final: false`, `canonical_schema: false`, `route_contract: false`);
  the Phase 45I adapter / mirrors preserve that, and this acceptance preserves it
  again. Every local fixture / reducer / runner / adapter label remains a valid
  **local proof label** owned by Freeside Characters, while the canonical live
  vocabulary stays owned upstream (Straylight), not by Freeside Characters.

---

## 2. Source chain

This decision is grounded in, and scoped entirely within, the accepted Admission
Wedge ladder plus the Dixie `33` series. **These artifacts are evidence only;
Phase 45J modifies none of them except for the small cross-reference addenda
named in §15, and it does not edit `../loa-dixie` at all.**

Freeside Characters:

- **Phase 45E / PR #171** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md`. The Dixie probe
  reconciliation / local alignment decision: maps each Dixie Phase 33C draft v0
  probe to the local proof stack (clean at the semantic level, naming / shape
  deltas only), preserves the local labels as proof labels, and selects a narrow,
  future-gated, test-only / docs-fixture-bound no-op adapter / validator lane
  (Phase 45F).
- **Phase 45F / PR #172** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) and the local mirrored probes under
  `docs/admission-wedge/dixie-probes/`. The Dixie probe no-op adapter / validator
  over **v0 local mirrors**: a pure, local, test-only semantic mapping layer that
  maps the five Dixie probe scenarios onto the local proof scenarios and proves
  semantic equivalence against the existing Phase 44A reducer over the Phase 43C
  fixtures, without any runtime wiring or live Dixie call.
- **Phase 45G / PR #173** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md`. The adapter
  acceptance / next-lane decision gate: accepts the bounded Phase 45F proof,
  states what it does *not* prove, keeps the adapter dead-ended from runtime, and
  selects **Dixie probe hardening** (its §9 / Option D) as the recommended next
  lane — a cross-repo handoff recommendation, not a Freeside Characters
  implementation authorization.
- **Phase 45H / PR #174** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md`. The Dixie v1 probe
  mirror-refresh / adapter-compatibility **decision gate**: records the Dixie
  v1 / Freeside v0 state, the per-probe compatibility (its §7 matrix), and the
  adapter version options (§8), keeps the local mirrors and adapter pinned to v0,
  and selects a future, separately-gated **Phase 45I** test-only /
  docs-fixture-bound mirror-refresh / adapter-compatibility slice (its §10,
  Option A). It refreshed no mirror and widened no adapter constant.
- **Phase 45I / PR #176** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) and the refreshed local mirrored probes under
  `docs/admission-wedge/dixie-probes/`. The Dixie v1 mirror-refresh / adapter
  compatibility **implementation** (test-only / docs-fixture-bound): refreshes
  the five local mirrors from draft v0 to draft v1
  (`dixie_admission_wedge_probe_v1`, mirroring Dixie Phase 33E), bumps the
  adapter's `SUPPORTED_DIXIE_PROBE_VERSION` to v1 (v0 now fails closed), and
  rewrites the adapter test to prove the v1 mappings, the v1 hardening fields,
  semantic equivalence against the Phase 44A reducer over the Phase 43C fixtures,
  the unsupported-version fail-closed, no-leak over v1 outputs, and the
  not-wired / not-exported guards. **This is the artifact Phase 45J accepts.**

Dixie:

- **Phase 33C / PR #120** — `../loa-dixie/docs/admission-wedge/fixtures/`. The
  canonical fixture / probe **draft v0**: five synthetic, public-safe probe
  JSONs, a dependency-free validator, and a README. Non-runtime; no live route,
  storage, auth, or admission; no schema freeze.
- **Phase 33D / PR #121** —
  `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-PROBE-HARDENING-GATE.md`. The probe
  hardening / contract vocabulary refinement gate: records the hardening topics
  the draft v0 probes need before any route design (its §5 A–L table), decides
  **not** to mutate the v0 probes in that phase, and selects a future draft-v1
  hardening lane (its §7).
- **Phase 33E / PR #122** —
  `../loa-dixie/docs/admission-wedge/fixtures/` (+ the Phase 33D gate's §12
  status note). The probe hardening **draft v1** / vocabulary refinement: bumps
  the five probes to `dixie_admission_wedge_probe_v1`, adds draft hardening
  placeholders, hardens the validator, and **preserves all five Phase 33C
  semantic scenarios with no sixth probe**. Still non-runtime; still no schema
  freeze.

> **Cross-repo phase-numbering note.** Dixie's `33` series
> (`33C`/`33D`/`33E`) is distinct from any Freeside Characters `33A` and from the
> Freeside Characters `43B–45J` Admission Wedge sequence. Dixie `33E` and the
> Freeside Characters phases are independent labels in separate repositories and
> must not be conflated; Dixie Phase 33A §9 lists cross-repo phase numbering as
> an open reconciliation item, and this decision does not resolve it.

Phase 45J inherits the Phase 45E / 45G / 45H authority boundary verbatim: it may
*accept the bounded Phase 45I proof* and *classify and select the next lane*; it
may **not** authorize production admission, public remember-this, Discord
message-history ingestion, a live Dixie admission route, a package export, or a
full production Straylight admission / storage / auth / consent architecture, and
it may **not** decide anything on Dixie's or Straylight's behalf.

---

## 3. What Phase 45I proved

Phase 45I is accepted as proving **only** the following, all of it bounded to the
local proof stack and the refreshed v1 mirrored Dixie probes:

- **The local mirrored Dixie probes now track Dixie Phase 33E draft v1.** The
  five mirror JSONs under `docs/admission-wedge/dixie-probes/` carry
  `probe_version: dixie_admission_wedge_probe_v1`, `status:
  draft_contract_probe`, `hardening_phase: "33E"`, and the explicit non-final
  markers `schema_final: false` / `canonical_schema: false` /
  `route_contract: false` / `runtime_enabled: false` /
  `production_admission: false` / `public_safe: true`, plus a `_local_mirror`
  marker naming Dixie Phase 33E / PR #122 as canonical source.
- **All five semantic scenarios are preserved.**
  `candidate_pending_not_recallable`, `accept_candidate_to_admitted_assertion`,
  `reject_candidate_no_assertion`, `supersede_with_corrected_assertion`, and
  `malformed_or_unsafe_payload_fail_closed` are unchanged in meaning across the
  v0 → v1 bump.
- **No sixth mirror was added.** Exactly five mirror JSON files exist; the
  Phase 45I test asserts the directory contains the five expected files and no
  more.
- **v0 mirrors were replaced by v1 mirrors.** The refresh rewrote the existing
  five mirror files in place to draft v1; it did not keep a parallel v0 mirror
  set.
- **v0 is now historical / unsupported / fail-closed.** The historical
  `dixie_admission_wedge_probe_v0` version is named in the adapter only so its
  fail-closed posture is explicit; it is no longer accepted.
- **The adapter supports `dixie_admission_wedge_probe_v1`.**
  `SUPPORTED_DIXIE_PROBE_VERSION` is `dixie_admission_wedge_probe_v1`.
- **The adapter fails closed on v0 and unknown future versions.** Any
  `probe_version` other than v1 — including the historical v0 and a future v999 —
  returns a sealed fail-closed result with reason code `unknown_probe_version`,
  never echoing the raw version string. The adapter dual-supports nothing.
- **Version validation happens before metadata validation.** The adapter checks
  `probe_kind`, then `probe_version`, and only then the metadata booleans /
  scenario / public surface; an unsupported version fails closed on the version
  check before any later validation can mask it.
- **The adapter rejects `canonical_schema: true` and `route_contract: true`.** A
  probe claiming `schema_final` / `canonical_schema` / `route_contract` /
  `runtime_enabled` / `production_admission`, or that is not `public_safe`, fails
  closed; the adapter never accepts a probe that claims a canonical / live-route
  contract.
- **All five mappings still hold:**
  - `candidate_pending_not_recallable` → `before_admission_excluded`
  - `accept_candidate_to_admitted_assertion` → `accepted_admitted_included`
  - `reject_candidate_no_assertion` → `rejected_excluded`
  - `supersede_with_corrected_assertion` → `supersession_corrected_only`
  - `malformed_or_unsafe_payload_fail_closed` → `malformed_fail_closed`

  The local scenario names are the Phase 44C runner's scenario labels; the
  adapter re-emits them from adapter-owned constants, never from raw probe input.
- **Tests prove the v1 hardening fields.** The Phase 45I test asserts, on the
  mirror JSON, the pending-vs-denied distinction (pending is `proposed` /
  `accepted_as_proposed` and carries no rejection vocabulary; reject binds
  `transition_denied` to an explicit denied transition), the draft signer /
  authority fields (`authority_signer_type_draft` / `authority_scope_draft` /
  `authority_binding_final: false`) on transition-bearing probes, the non-final
  `idempotency` placeholder, the synthetic identity-binding markers
  (`synthetic_binding: true` / `identity_binding_final: false`), the
  receipt / audit split (`receipt_split` with a null public ref where no public
  receipt is minted), the Straylight primitive-review marker
  (`required_before_route_design`, `straylight_primitive_review_complete:
  false`), and the `route_contract` / `canonical_schema` / `schema_final` false
  metadata.
- **Tests prove semantic equivalence via the Phase 44A reducer over the
  Phase 43C fixtures.** Each scenario's `outcomeClassification` and
  `localReasonCode` are cross-checked against the Phase 44A reducer's actual
  output over the same fixture plans the Phase 44C runner uses — a cross-check
  against the existing reducer, not a reimplementation of the invariant.
- **Tests prove no-leak behavior.** Every adapter result (success and
  fail-closed) and its formatted summary is scanned for raw payload, unsafe
  markers, source material, private sentinels, raw probe / tenant / estate /
  actor / receipt / idempotency / authority material, URLs, JWT / PEM /
  `Bearer` / `sk-` / long-id / `0x` hex / stack-trace material, and finds none;
  success results carry only constant strings.
- **Runtime / export guards show the adapter remains dead-ended from runtime.**
  The test asserts the adapter imports only the pure Phase 44A reducer; reaches
  no Discord / dispatch / startup / command-registration / renderer / live-Dixie /
  Straylight / LLM / storage / fs / net / env / clock path; is referenced by no
  source file other than its own test; and is **not** listed in the
  `package.json` exports map.

That is the **entire** scope of what Phase 45I proves. It is a bounded,
test-only semantic bridge between the Dixie draft v1 probes and the local proof
stack — nothing more.

---

## 4. What Phase 45I did not prove

Stated clearly so a future reader does not over-read the Phase 45I adapter /
mirrors. Phase 45I does **not** prove, authorize, imply, or unblock any of the
following:

- a production schema;
- a live admission route;
- route-contract readiness by itself;
- a storage model;
- production auth / consent;
- end-user authorization;
- Discord command safety;
- `/remember-this` UX;
- public remember-this;
- Discord history ingestion;
- user chat becoming memory;
- durable memory admission;
- package API stability;
- final vocabulary;
- final field names;
- final idempotency semantics;
- production signer / authority semantics;
- production tenant / estate / actor identity binding;
- a completed Straylight primitive review;
- a forget / revoke / correction UI;
- runtime rollout.

Phase 45I proves that the two sides *agree at the semantic level today, across
Dixie's v0 → v1 hardening*. It proves nothing about whether either side's names,
fields, storage, authority, idempotency, or routes are ready for production, and
it is not evidence of production readiness. **v1 compatibility in tests is not
production readiness.**

---

## 5. Acceptance decision

- **Phase 45I is accepted only as a test-only / docs-fixture-bound v1 mirror and
  adapter compatibility proof.** It is accepted for exactly what §3 records and
  for nothing in §4.
- **The adapter remains local proof infrastructure, not runtime infrastructure.**
  It is a pure mapping layer consumed only by its own test; it is not, and is not
  accepted as, any part of a runtime path.
- **The mirrored Dixie probes remain local mirrors for tests, not canonical
  upstream truth.** The Dixie Phase 33E copy is authoritative; if the two ever
  disagree, the Dixie copy wins and the local mirrors are stale.
- **Dixie remains the canonical upstream owner for the probe draft.** Freeside
  Characters mirrors the Dixie probe set; it does not own or define it.
- **Straylight remains the canonical primitive / substrate vocabulary owner where
  applicable** — the assertion-lifecycle, admission, estate, receipt, and
  signer / authority semantics the Dixie probes align to are Straylight-owned.
- **Freeside Characters does not own the Dixie or Straylight vocabulary.** The
  local proof labels (Phase 43C fixture values, Phase 44A reducer reason codes,
  Phase 44C runner scenario labels) stay local proof labels; the Dixie probe
  labels stay Dixie-owned draft v1 labels. Neither set is a frozen final schema.
- **Do not export the adapter.**
- **Do not wire it into runtime.**
- **Do not proceed to live admission from this proof alone.**

This acceptance changes no code, no test, no fixture, no mirror, and no probe. It
records that the bounded proof is sufficient for its bounded purpose and stops
there.

---

## 6. Current invariant status

The load-bearing invariant is **unchanged** and remains intact across all three
surfaces it now touches:

- the **Freeside Characters local proof stack** — the Phase 43C validator across
  the fixture graph, the Phase 44A reducer with its stable reason codes and
  no-leak seal, and the Phase 44C runner's operator-safe summaries;
- the **Dixie Phase 33E draft v1 probes** — each probe references its
  load-bearing invariant clauses and the Dixie validator enforces them;
- the **Phase 45I adapter tests** — which cross-check each Dixie v1 probe
  scenario against the Phase 44A reducer's output and prove no-leak / fail-closed
  over the adapter's own results.

The invariant (carried verbatim from Phase 43B §D / Phase 45A §4 / Phase 45C §5 /
Phase 45D §4 / Phase 45E §5 / Phase 45G §6, and matching Dixie Phase 33A §4 /
Phase 33B §5):

- **candidate memory is not admitted memory** — a candidate is a proposal, not
  governed continuity;
- **candidate memory is not recallable before explicit admission** — a candidate
  must never appear in an ordinary recall result before an admission transition
  accepts it;
- **an accepted transition creates or references an admitted assertion** —
  acceptance is the only path from candidate to admitted; it is explicit,
  authority-bound, and auditable;
- **a rejected candidate never becomes recallable** — rejection is terminal for
  recall eligibility (subject only to a future, separately-gated
  appeal / correction path, never a silent reversal);
- **supersession / correction preserves auditability while ordinary recall
  includes only the corrected active assertion** — the prior superseded state
  remains available for audit / provenance but is excluded from ordinary recall;
- **fail-closed paths do not leak raw candidate / private payload** — on any
  error, rejection, or malformed input, the public response carries a stable
  reason code and a safe summary only, never the raw candidate body, private
  sentinels, internal store text, or operational identifiers.

The invariant is the stable cross-repo anchor. Phase 45I's mirror-refresh changed
the probe version string and added draft hardening placeholders; it changed the
invariant nowhere, and this acceptance only confirms the invariant holds
identically on both sides across the v0 → v1 bump.

---

## 7. Current adapter / probe state

Recorded so a future reader knows exactly where the artifacts sit after this
acceptance (none of this is changed by Phase 45J):

- **Local mirrors:** `dixie_admission_wedge_probe_v1` (five files, draft v1,
  Phase 33E provenance).
- **Adapter supported version:** `dixie_admission_wedge_probe_v1`.
- **v0:** historical / unsupported / fail-closed (`unknown_probe_version`, no
  echo).
- **Package export:** absent.
- **Runtime wiring:** absent.
- **Live Dixie calls:** absent.
- **Discord command:** absent.
- **Storage writes:** absent.
- **Production admission:** absent.

---

## 8. Remaining risks / open questions

Carried forward unchanged from Phase 45E §6 / §7, Phase 45G §7, Phase 45H §4, and
the Dixie Phase 33D §5 / 33E hardening evidence. These are *design / naming /
shape* questions a future, separately-gated phase would resolve — none of them is
resolved or relaxed here:

- **Route contract is still not designed.** No request / response shape, no
  handler, no live route exists or is authorized; the probes are static JSON, not
  a served contract.
- **Storage model is still not designed.** No durable admission store exists;
  admission storage remains gated upstream.
- **Production auth / consent is still not designed.** Service auth is not
  end-user consent; no production consent mechanism for admitting candidate
  memory exists.
- **Idempotency semantics are still draft.** The v1 probes carry an
  `idempotency` placeholder block (`idempotency_final: false`); final idempotency
  semantics are not decided.
- **Signer / authority semantics are still draft.** The v1 probes carry
  `authority_signer_type_draft` / `authority_scope_draft` /
  `authority_binding_final: false`; authority naming and binding remain draft and
  are not a production auth claim.
- **Tenant / estate / actor binding remains synthetic and not production
  identity.** The probes carry `synthetic_binding: true` /
  `identity_binding_final: false`; ids live only on the private input / audit
  sections and are not real identity binding.
- **Receipt / audit split remains draft.** The v1 `receipt_split` block declares
  a public / private boundary as a draft direction, not a frozen receipt schema.
- **Straylight primitive review remains required or explicitly deferred before
  route design.** The v1 probes carry
  `straylight_primitive_review: "required_before_route_design"` and
  `straylight_primitive_review_complete: false`; no Straylight primitive review
  has been performed.
- **Forget / revoke / correction UI is not designed.**
- **Public / user-facing admission UX is not designed.**

---

## 9. Next-lane options

The candidate next options, classified. Phase 45J authorizes **none** as
implementation; it ranks them so the selection in §10 is explicit.

- **Option A — Freeside Characters adapter hardening.** *Possible but low value
  unless a specific gap is found.* Phase 45I already covers the v1 mappings, the
  v1 hardening fields, no-leak, unsupported-version fail-closed, and the
  runtime / export static guards. More negative tests or stricter guards add
  little without an identified gap.
- **Option B — Freeside Characters package export.** *Defer.* Exporting the
  adapter would imply API stability and a runtime surface before a route contract
  exists; there is no stable consumer contract to export against.
- **Option C — Freeside Characters live admission client or Discord command.**
  *Blocked.* Requires a Dixie route contract, storage / auth / consent gates, and
  separate authorization (decision-map §7; Dixie Phase 33A §9). Not available
  from this gate.
- **Option D — Dixie route-contract readiness gate.** *Recommended next.* Dixie
  should decide whether the v1 probes are strong enough to begin route-contract
  *design*, what a route contract would need, and what remains blocked. This is a
  cross-repo handoff recommendation, **not** route implementation.
- **Option E — Straylight primitive vocabulary review request.** *Possible
  prerequisite or subtask of the Dixie route-contract readiness gate.* Useful if
  signer / authority, idempotency, recall eligibility, or admitted-assertion
  vocabulary remains unresolved before route design.
- **Option F — Stop and preserve the proof.** *Available.* The local proof stack,
  the Phase 45I adapter over the v1 mirrors, and this acceptance are a stable
  resting state.

---

## 10. Selected next lane

**Dixie Phase 33F — Admission Wedge route-contract readiness gate (Option D).**

Phase 45J selects a **cross-repo handoff recommendation to Dixie**, not a
Freeside Characters implementation authorization. The Freeside-side semantic
bridge is now proven across the v0 → v1 hardening (Phase 45I); the next useful
work is upstream, where the canonical vocabulary, field names, signer / authority
semantics, receipt / audit shape, idempotency semantics, route contract, storage
model, and any Straylight primitive review are owned. Freeside Characters should
not design a route, coin names, export its adapter, harden its adapter
speculatively, or build a live path while the upstream draft is still a draft v1
and the route contract is undesigned.

Emphasize:

- **Phase 33F should decide whether route-contract design can begin** — i.e.
  whether the Dixie v1 probes are strong enough, and what preconditions remain.
- **Phase 33F should not implement the route.**
- **Phase 33F should not add storage / auth / live calls.**
- **Phase 33F should not freeze a final schema** unless explicitly justified and
  separately approved by Straylight / Dixie governance.

**Why not the other lanes now:** Freeside-side adapter hardening (Option A) is
low-value without an identified gap; a package export (Option B) is deferred
until a stable consumer exists; a live admission client / Discord command
(Option C) is blocked behind separate gates; a Straylight primitive vocabulary
review (Option E) is best framed as a prerequisite / subtask of the Dixie
route-contract readiness gate rather than a standalone Freeside lane; and
stopping (Option F) remains an acceptable resting state if a reviewer prefers it.

The Dixie-first posture from Phase 45D / 45E / 45G / 45H and Dixie Phase 33B / 33D
holds — Dixie / Straylight own the canonical vocabulary and the route, and
Freeside Characters reconciles against the Dixie draft rather than coining names
or designing the route.

---

## 11. Future Dixie Phase 33F boundaries

These boundaries are a **recommendation to Dixie**, not a Freeside Characters
authorization and not a decision made on Dixie's behalf. If and when Dixie opens
Phase 33F, the recommended shape is a **docs / decision gate**:

**Allowed (recommended) future Phase 33F scope:**

- a docs / decision gate;
- assess whether the Dixie v1 probes are strong enough for route-contract design;
- inventory route-contract requirements;
- identify the required Straylight primitive review questions;
- identify storage / auth / consent preconditions;
- identify idempotency requirements;
- identify the public / private response boundary requirements;
- identify receipt / audit requirements;
- identify rollback / fail-closed behavior;
- decide whether a Phase 33G should be route-contract *design* or another probe
  hardening phase.

**Blocked for Phase 33F (recommended):**

- a route / API handler implementation;
- a live admission route;
- storage writes;
- auth implementation;
- live calls;
- production admission;
- production storage / auth / consent;
- public remember-this;
- Discord ingestion;
- user chat becoming memory;
- Freeside Characters runtime changes;
- package exports;
- LLM / voice;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze unless separately authorized.

---

## 12. What remains blocked now

Repeated clearly so a future reader does not over-read this acceptance. None of
the following is implemented, authorized, or claimed by Phase 45J (and none was
unblocked by Phase 45I, by Phase 45H, by Dixie Phase 33E, or by any prior phase):

- a live admission route / live admission client;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord message-history ingestion;
- user chat becoming memory;
- storage writes;
- production admission / storage / auth / consent;
- public rollout;
- package exports;
- an adapter package export;
- renderer / dispatch / startup / command-registration changes;
- LLM / voice behavior;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze;
- runtime wiring (of the adapter or anything else);
- local production memory admission;
- a route / API handler;
- route design in Freeside Characters.

An acceptance / decision is not implementation. This doc reads the Phase 45I
evidence and selects the next lane; it decides nothing on Dixie's or Straylight's
behalf, and an accepted *test-only v1 semantic bridge* over a *draft v1 probe
set* is not a frozen contract, a route contract, or a live path. If a later phase
needs any item above, it must open the separately-gated phase that owns it
(decision-map §7 / §8).

---

## 13. Success criteria for Phase 45J

This Phase 45J artifact succeeds if **all** of the following hold:

- it **accurately accepts Phase 45I's bounded v1 proof** (§3, §5);
- it **states what Phase 45I does not prove** (§4);
- it **keeps the adapter / package / runtime dead-ended** — no export, no wiring,
  no live call authorized (§5, §7, §12);
- it **preserves all blocked lanes** (§12);
- it **selects Dixie Phase 33F as the next lane** (§10) without authorizing any
  implementation;
- it **does not modify code / tests / fixtures / probes** (§1, §12);
- **Codex / review confirms docs / decision-only scope.**

Mechanically, the accepted-ladder acceptance bar applies:

- `git diff --check` is clean;
- the recall fixture validator passes
  (`node docs/recall-wedge/fixtures/validate-fixtures.mjs`);
- the admission fixture validator passes
  (`node docs/admission-wedge/fixtures/validate-fixtures.mjs`);
- the Phase 45I adapter test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.test.ts`)
  — proving this acceptance did not perturb the artifact it accepts, and that the
  adapter still maps the **refreshed v1 mirrors**;
- the reducer test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.test.ts`);
- the runner test passes
  (`bun test packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.test.ts`);
- the multi-surface harness regression passes
  (`bun test packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`);
- the live-Dixie client / runner regression passes
  (`bun test packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`)
  — proving this decision introduced no live-egress regression;
- a forbidden-claim scan finds no hits except negated blockers (this document
  claims no route contract designed, no route design authorized in Freeside
  Characters, no live route, no production admission, no production storage, no
  solved production auth / consent, no public remember-this, no Discord history
  ingestion, no chat-becomes-memory, no Finn production wiring, no live Dixie
  admission route, no live Dixie call, no authorized package export, no adapter
  export, no frozen final schema, no claim that Dixie Phase 33E is production
  schema, no Freeside Characters ownership of the Dixie / Straylight vocabulary,
  no claim that v1 compatibility is production readiness, no claim that the
  adapter is runtime infrastructure, no claim that idempotency semantics are
  final, no claim that signer / authority semantics are production auth, no claim
  that tenant / estate / actor binding is production identity binding, no
  fixture / reducer label rename, no fixture / probe JSON mutation, no code
  change, and no runtime wiring);
- the artifact carries **no raw IDs / secrets / tokens / URLs / screenshots /
  binary evidence**.

---

## 14. Naming rules

Preserved verbatim from Phase 43B §B.1 / 43C / 44B / 44D / 45A / 45C / 45D / 45E /
45G / 45H; binding for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current app / repo
  (the Discord app, the Railway project and service that runs the bot). The
  current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only and is
  out of scope for this decision.
- **"Dixie"** / **`loa-dixie`** is the cross-repo intake / control-plane service
  (the Recall Wedge service today; the candidate future live admission intake /
  control-plane owner).
- **"Straylight"** is the canonical primitive / substrate owner where applicable
  — the memory / continuity substrate that owns the canonical admission /
  estate / receipt / assertion-lifecycle semantics and vocabulary.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired.
- Do **not** imply a **Dixie admission route** exists. Dixie exposes only a
  read-only, default-off, fail-closed recall route today; it has no admission
  route, no admission concept in route code, and no production storage.
- Do **not** imply the **final contract schema is frozen.** Dixie Phase 33E is an
  explicit **draft v1** (`schema_final: false`, `canonical_schema: false`,
  `route_contract: false`); it froze no production schema, and Phase 45J does not
  freeze one either.

---

## 15. Cross-references

Minimal status / cross-reference notes are added to the docs below (small addenda
only; the old docs are not rewritten, and no broad addenda are added):

- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md` — Phase 45H decision
  gate (PR #174) and its Phase 45I status note. Gains a one-line Phase 45J note
  that Phase 45I (which satisfied 45H's selected lane) is now accepted as a
  test-only / docs-fixture-bound v1 proof and that Dixie Phase 33F
  (route-contract readiness) is the recommended next lane.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — Phase 45G
  acceptance / next-lane gate (PR #173) and its Phase 45H / 45I status notes.
  Gains a one-line Phase 45J note that the v1 mirror-refresh (Phase 45I) is
  accepted and that the next lane is the Dixie Phase 33F route-contract readiness
  gate.
- `docs/admission-wedge/dixie-probes/README.md` — Phase 45F → 45I local mirrored
  probes (PR #172 / #176). Gains a one-line Phase 45J note that the refreshed v1
  mirrors are accepted as test-only / docs-fixture-bound mirrors (still not
  canonical upstream truth) and that any future Dixie probe version change still
  requires a future mirror-refresh gate.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix. Gains a
  targeted Phase 45J addendum (§5aa); §7 (live-memory-admission gates) and §8
  (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45J, and `../loa-dixie`
is not editable from this repo / task**):

- `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) — Phase 45F → 45I adapter / validator (PR #172 / #176); the
  artifact this decision accepts. Unchanged here; pinned to
  `dixie_admission_wedge_probe_v1`.
- `docs/admission-wedge/dixie-probes/*.json` — Phase 45I local mirrored Dixie v1
  probes (PR #176). Unchanged here; draft v1.
- `docs/admission-wedge/fixtures/` — Phase 43C fixtures + validator (PR #155).
  Unchanged here.
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer the adapter
  cross-checks against. Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner whose scenario labels
  the adapter reuses. Unchanged here.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — Phase 45E
  reconciliation / local alignment gate (PR #171). Read only.
- `../loa-dixie/docs/admission-wedge/fixtures/` — Dixie Phase 33C draft v0 →
  Phase 33E draft v1 probes + validator + README (PR #120 / PR #122); the
  canonical upstream source the local mirrors copy. Read only; not modified.
- `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-PROBE-HARDENING-GATE.md` — Dixie Phase 33D
  hardening-decision gate + Phase 33E status note (PR #121 / PR #122). Read only;
  not modified.
- `@loa/straylight` — semantic owner of the assertion lifecycle and the canonical
  vocabulary the Dixie probes align to. **No Straylight primitive review has been
  performed by this phase**; the Dixie v1 probes themselves carry
  `straylight_primitive_review_complete: false`.
