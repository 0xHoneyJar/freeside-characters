# Admission Wedge — Dixie probe adapter acceptance / next-lane decision gate

> **Phase 45G** (Freeside Characters-side docs / decision only). Date:
> 2026-06-05. Follows Freeside Characters **Phase 45F / PR #172**
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + `.test.ts` and the local mirrored probes under
> `docs/admission-wedge/dixie-probes/` — the test-only / docs-fixture-bound
> no-op adapter / validator) and **Phase 45E / PR #171**
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — the Dixie probe
> reconciliation / local alignment decision whose §10–§11 authorized the
> Phase 45F lane), over Dixie **Phase 33C / PR #120**
> (`../loa-dixie/docs/admission-wedge/fixtures/` — the canonical **draft v0**
> Admission Wedge contract probe set + validator + README). Companion to
> `docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md` (Phase 45D),
> `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md` (Phase 45C),
> `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 45A),
> `docs/admission-wedge/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` (Phase 44D),
> `docs/admission-wedge/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` (Phase 44B),
> `docs/admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md` (Phase 43B),
> `docs/admission-wedge/fixtures/README.md` (Phase 43C), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix — §7
> live-memory-admission gates and §8 prohibitions govern everything this gate
> points toward).
>
> This document **accepts** the bounded proof Phase 45F landed and **selects
> the next lane**. It is **not** a new adapter, **not** a probe mutation,
> **not** a reducer / runner / adapter code change, and **not** a runtime
> wiring. It implements nothing. It introduces no source, test, fixture JSON,
> mirrored Dixie probe, package, lockfile, config, CI, or generated change; no
> runtime Discord behavior; no Discord command; no live Dixie admission route;
> no Straylight store; no admission path; no memory write; no storage; no
> network call. It does **not** rename any local fixture label, **does not**
> mutate any reducer reason code, and **does not** freeze a final schema. It
> does **not** claim Dixie Phase 33C is a production schema, and it does
> **not** claim Freeside Characters owns the Dixie or Straylight vocabulary.
> If a step seems to require reaching past these boundaries, the answer is to
> open the separate later gate that owns it (decision-map §7 / §8) — not to
> relax it from this decision.

> **Phase 45H status note (added later).** The Dixie probe hardening this gate
> recommended (§9 / Option D) landed upstream as **Dixie Phase 33E / PR #122**
> (draft **v1** — `dixie_admission_wedge_probe_v1`, all five scenarios
> preserved, no sixth probe, still `schema_final: false`). Freeside Characters'
> response is gated, not silent: **Phase 45H**
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md`, docs / decision only)
> records the Dixie v1 / Freeside v0 state, keeps the local mirrors and adapter
> pinned to **v0** (the adapter still fails closed on v1), and selects a future
> **Phase 45I** test-only / docs-fixture-bound mirror-refresh / adapter-
> compatibility slice. No mirror was refreshed, no adapter constant widened, no
> v1 compatibility claimed, and no live lane unblocked.

> **Phase 45I status note (added later).** The Phase 45I slice Phase 45H
> selected has since **landed** (test-only / docs-fixture-bound): it refreshed
> the five local mirrored Dixie probes to **draft v1**
> (`dixie_admission_wedge_probe_v1`, mirroring Dixie Phase 33E / PR #122 — all
> five scenarios preserved, no sixth mirror), bumped the adapter's
> `SUPPORTED_DIXIE_PROBE_VERSION` to `dixie_admission_wedge_probe_v1` (v0 now
> fails closed as an unsupported / historical version), and rewrote the adapter
> test to prove the v1 mappings, the v1 hardening fields, semantic equivalence
> against the Phase 44A reducer over the Phase 43C fixtures, the unsupported-
> version fail-closed, no-leak over v1 outputs, and the not-wired / not-exported
> guards. **The acceptance this gate (45G) records still stands**: the adapter
> remains a test-only / docs-fixture-bound semantic bridge — v1 compatibility in
> tests is **not** production readiness, no runtime wiring or package export was
> added, no live Dixie call was made, no live admission was authorized, no local
> proof fixture / label / reducer reason code was mutated, and no `../loa-dixie`
> file was edited. Dixie Phase 33E stays a **draft v1** (not production schema),
> and Freeside Characters does not own the Dixie / Straylight vocabulary.

> **Phase 45J status note (added later).** The Phase 45I v1 mirror-refresh /
> adapter-compatibility slice has since been **accepted** by **Phase 45J**
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-ACCEPTANCE-GATE.md`, docs /
> decision only) as a test-only / docs-fixture-bound v1 proof, and Phase 45J
> selects **Dixie Phase 33F — Admission Wedge route-contract readiness gate** as
> the recommended next lane (cross-repo handoff to Dixie, not route design and not
> a Freeside Characters implementation authorization). The acceptance this gate
> (45G) records still stands: the adapter remains a test-only / docs-fixture-bound
> semantic bridge — no runtime wiring, no package export, no live Dixie call, no
> live admission, and Freeside Characters does not own the Dixie / Straylight
> vocabulary.

---

## 1. Phase title and status

**Phase 45G — Admission Wedge Dixie probe adapter acceptance / next-lane
decision gate.**

- Phase 45G is a **Freeside Characters-side docs / decision-only artifact.**
  It produces this acceptance decision plus the smallest possible
  cross-reference notes in the docs named in §14. It introduces no source,
  test, fixture JSON, mirrored Dixie probe, package, lockfile, config, CI, or
  generated change.
- Phase 45G **follows Freeside Characters Phase 45F / PR #172** (the Dixie
  probe no-op adapter / validator) and **Phase 45E / PR #171** (the Dixie
  probe reconciliation / local alignment decision whose §10–§11 selected and
  bounded the Phase 45F lane), over **Dixie Phase 33C / PR #120** (the
  canonical draft v0 contract probe set). It reads all three as evidence.
- Phase 45G **does not implement new adapter behavior.** It writes no
  validator, no adapter, no new test, and no new mirrored probe. It only
  *accepts* the bounded proof Phase 45F landed and *selects* the next lane.
- Phase 45G **does not mutate fixtures or probes, change reducer / runner /
  adapter code, or wire runtime.** The Phase 43C fixtures, the Phase 44A
  reducer, the Phase 44C runner, the Phase 45F adapter, and the Phase 45F
  mirrored probes remain exactly as landed. No live admission is authorized.
- Phase 45G **does not freeze a final schema.** Dixie Phase 33C is explicit
  that its probes are **draft v0 — NOT frozen** (`schema_final: false`); the
  Phase 45F adapter preserves that, and this acceptance preserves it again.
  Every local fixture / reducer / runner / adapter label remains a valid
  **local proof label**, and the canonical live vocabulary is owned upstream
  (Straylight), not by Freeside Characters.

---

## 2. Source chain

This decision is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder plus the Dixie `33` series. **These artifacts are
evidence only; Phase 45G modifies none of them except for the small
cross-reference addenda named in §14, and it does not edit `../loa-dixie` at
all.**

Freeside Characters:

- **Phase 43B / PR #152** — `docs/admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md`. The
  Admission Wedge MVP design: candidate / transition / admitted / receipt
  packet shapes, the core invariant (§D), and the non-recallability /
  rejection / supersession proof obligations.
- **Phase 43C / PR #155** — `docs/admission-wedge/fixtures/`. The
  fixture / operator-contract proof: a deterministic candidate → transition →
  admitted → recall-proof graph plus a dependency-free validator.
- **Phase 44A / PR #156** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`). The fixture-bound reducer / adapter: a pure,
  dependency-free local reducer that proves the §D invariant *in code* with
  stable reason codes and a no-leak seal.
- **Phase 44B / PR #157** — `docs/admission-wedge/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`.
  The reducer acceptance / next-lane gate. Accepted Phase 44A; selected
  Phase 44C.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: reads the
  Phase 43C fixtures and calls the Phase 44A reducer to print operator-safe
  summaries across five scenarios (before-admission excluded · accepted
  included · rejected excluded · supersession corrected-only · a synthetic
  in-memory `malformed_fail_closed`).
- **Phase 44D / PR #159** — `docs/admission-wedge/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`.
  The runner acceptance / next-lane gate. Accepted Phase 44C; selected
  Phase 45A.
- **Phase 45A / PR #160** — `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`.
  The Dixie-side contract request / handoff: summarizes the proof stack,
  carries the §D invariant, and enumerates the A–J contract decisions for the
  Dixie / Straylight owners to define or accept *later*.
- **Phase 45C / PR #162** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`. The Dixie response
  reconciliation: reads Dixie Phase 33A against the Phase 45A request and the
  local proof stack at the narrative level.
- **Phase 45D / PR #163** —
  `docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`. The field-level
  reconciliation matrix / fixture-probe alignment gate: converts the Phase 45C
  narrative into explicit vocabulary, field/shape, and A–J contract-area
  tables, and selects a **Dixie-first** Phase 45E lane.
- **Phase 45E / PR #171** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md`. The Dixie probe
  reconciliation / local alignment decision: maps each Dixie Phase 33C probe
  to the local proof stack (clean at the semantic level, naming/shape deltas
  only), preserves the local labels as proof labels, and selects a narrow,
  future-gated, test-only / docs-fixture-bound no-op adapter / validator lane
  (its §10 selection, §11 boundaries) — **Phase 45F**.
- **Phase 45F / PR #172** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) and the local mirrored probes under
  `docs/admission-wedge/dixie-probes/`. The Dixie probe no-op adapter /
  validator: a pure, local, test-only / docs-fixture-bound semantic mapping
  layer that maps the five Dixie probe scenarios onto the current local proof
  scenarios and proves semantic equivalence against the existing Phase 44A
  reducer over the Phase 43C fixtures. **This is the artifact Phase 45G
  accepts.**

Dixie:

- **Phase 33A / PR #118** — `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`.
  The Dixie-side Admission Wedge contract response / acceptance gate. Records
  what Dixie will **own**, **defer**, and **block**; accepts the *need* for a
  contract and a provisional **draft v0** vocabulary; and explicitly does
  **not** freeze a production schema or implement a route.
- **Phase 33B / PR #119** —
  `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-FIXTURE-PROBE-ALIGNMENT-DECISION.md`. The
  Dixie fixture/probe ownership decision: decides **Dixie-first** ownership of
  the first canonical contract probe, defines the minimum future probe set
  (§6), the schema surfaces (§7), and the vocabulary / field decisions
  (§8 / §9) a future Phase 33C must decide or defer.
- **Phase 33C / PR #120** — `../loa-dixie/docs/admission-wedge/fixtures/`. The
  canonical **draft v0** Admission Wedge contract probes: five synthetic,
  public-safe probe JSONs, a dependency-free validator, and a README. It is
  **non-runtime**: no live route, storage, auth, or admission behavior, and
  **no schema freeze**.

> **Cross-repo phase-numbering note.** Dixie's `33` series (`33A`/`33B`/`33C`)
> is distinct from any Freeside Characters `33A` and from the Freeside
> Characters `43B–45G` Admission Wedge sequence. Dixie `33C` and the Freeside
> Characters phases are independent labels in separate repositories and must
> not be conflated; Dixie Phase 33A §9 lists cross-repo phase numbering as an
> open reconciliation item, and this decision does not resolve it.

Phase 45G inherits the Phase 45E / 45D authority boundary verbatim: it may
*accept the bounded Phase 45F proof* and *classify and select the next lane*;
it may **not** authorize production admission, public remember-this, Discord
message-history ingestion, a live Dixie admission route, a package export, or
a full production Straylight admission / storage / auth / consent
architecture, and it may **not** decide anything on Dixie's behalf.

---

## 3. What Phase 45F proved

Phase 45F is accepted as proving **only** the following, all of it bounded to
the local proof stack and the mirrored Dixie probes:

- **The mirrored Dixie Phase 33C probe fixtures can be represented locally for
  tests.** Five local mirror JSONs under `docs/admission-wedge/dixie-probes/`
  carry the Dixie draft v0 probe shape (`probe_kind:
  admission_wedge_contract_probe`, `probe_version:
  dixie_admission_wedge_probe_v0`, `schema_final: false`, `runtime_enabled:
  false`, `production_admission: false`, `public_safe: true`) plus a
  `_local_mirror` marker, and the adapter test reads them as static JSON.
- **The local no-op adapter maps all five Dixie probe scenarios to the current
  Freeside Characters local proof scenarios.** The mappings, exactly as landed
  in the Phase 45F adapter, are:

  - `candidate_pending_not_recallable` → `before_admission_excluded`
  - `accept_candidate_to_admitted_assertion` → `accepted_admitted_included`
  - `reject_candidate_no_assertion` → `rejected_excluded`
  - `supersede_with_corrected_assertion` → `supersession_corrected_only`
  - `malformed_or_unsafe_payload_fail_closed` → `malformed_fail_closed`

  The local scenario names are the Phase 44C runner's scenario labels; the
  adapter re-emits them from adapter-owned constants, never from raw probe
  input.
- **Semantic equivalence is proven against the current local proof stack via
  the existing Phase 44A reducer over the Phase 43C fixtures.** The adapter
  test cross-checks each scenario's `outcomeClassification` and
  `localReasonCode` against the Phase 44A reducer's output over the same
  fixture plans the Phase 44C runner uses — it is a cross-check against the
  existing reducer, not a reimplementation of the invariant.
- **No-leak behavior is proven over serialized adapter results and formatted
  summaries.** The test scans every adapter result (success and fail-closed)
  and its formatted output for raw payload, unsafe markers, source material,
  private sentinels, raw probe / tenant / estate / actor / receipt ids, URLs,
  JWT / PEM / `Bearer` / `sk-` / long-id / `0x` hex / stack-trace material, and
  finds none; success results carry only constant strings.
- **Malformed / unsafe adapter input fails closed without raw echo.** Non-object
  input, a wrong `probe_version`, an unknown `scenario_id`, a probe claiming
  `runtime_enabled` / `production_admission`, a public surface that contradicts
  the mapped scenario, and a probe that renders the candidate payload each fail
  closed with a stable adapter reason code, and the fail-closed `detail` is
  sealed by reason code so no injected value is echoed.
- **Static guards show the adapter is not runtime-wired.** The test asserts the
  adapter imports only the pure Phase 44A reducer; imports no Discord /
  dispatch / startup / command-registration; imports no public renderer / live
  Dixie client / Dixie / Straylight module; imports no LLM SDK / storage and
  reaches no fs / net / env / clock; is referenced by no source file other than
  its own test; and is **not** listed in the package.json exports map.
- **Nothing pre-existing changed.** No existing local fixtures, reducer reason
  codes, runner behavior, package exports, or runtime command changed, and no
  `../loa-dixie` repo file was changed by Phase 45F.

That is the **entire** scope of what Phase 45F proves. It is a bounded
semantic bridge between the Dixie draft v0 probes and the local proof stack —
nothing more.

---

## 4. What Phase 45F did not prove

Stated clearly so a future reader does not over-read the Phase 45F adapter.
Phase 45F does **not** prove, authorize, imply, or unblock any of the
following:

- a production schema;
- a live admission route;
- live Dixie route readiness;
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
- Straylight primitive alignment beyond draft probe semantics;
- a forget / revoke / correction UI;
- runtime rollout.

Phase 45F proves that the two sides *agree at the semantic level today*. It
proves nothing about whether either side's names, fields, storage, authority,
or routes are ready for production, and it is not evidence of production
readiness.

---

## 5. Acceptance decision

- **Phase 45F is accepted only as a test-only / docs-fixture-bound semantic
  bridge.** It is accepted for exactly what §3 records and for nothing in §4.
- **The adapter is acceptable as local proof infrastructure, not runtime
  infrastructure.** It is a pure mapping layer consumed only by its own test;
  it is not, and is not accepted as, any part of a runtime path.
- **The mirrored Dixie probes are local mirrors for tests, not canonical
  upstream truth.** The Dixie Phase 33C copy is authoritative; if the two ever
  disagree, the Dixie copy wins and the local mirrors are stale.
- **Local Freeside proof labels remain proof labels.** The Phase 43C fixture
  values, the Phase 44A reducer reason codes, and the Phase 44C runner scenario
  labels stay exactly as landed.
- **Dixie probe labels remain draft v0** (`dixie_admission_wedge_probe_v0`,
  `schema_final: false`).
- **Neither label set is final production schema.**
- **Do not rename local fixtures yet.**
- **Do not mutate reducer reason codes yet.**
- **Do not export the adapter yet.**
- **Do not wire it into runtime.**

This acceptance changes no code, no test, no fixture, and no probe. It records
that the bounded proof is sufficient for its bounded purpose and stops there.

---

## 6. Invariant status

The load-bearing invariant is **unchanged** and remains intact across all
three surfaces it now touches:

- the **Freeside Characters local proof stack** — the Phase 43C validator
  across the fixture graph, the Phase 44A reducer with its stable reason codes
  and no-leak seal, and the Phase 44C runner's operator-safe summaries;
- the **Dixie Phase 33C draft probes** — each probe references its load-bearing
  invariant clauses and the Dixie validator enforces them;
- the **Phase 45F adapter tests** — which cross-check each Dixie probe scenario
  against the Phase 44A reducer's output and prove no-leak / fail-closed over
  the adapter's own results.

The invariant (carried verbatim from Phase 43B §D / Phase 45A §4 / Phase 45C
§5 / Phase 45D §4 / Phase 45E §5, and matching Dixie Phase 33A §4 / Phase 33B
§5):

- **candidate memory is not admitted memory** — a candidate is a proposal, not
  governed continuity;
- **candidate memory is not recallable before explicit admission** — a
  candidate must never appear in an ordinary recall result before an admission
  transition accepts it;
- **an accepted transition creates or references an admitted assertion** —
  acceptance is the only path from candidate to admitted; it is explicit,
  authority-bound, and auditable;
- **a rejected candidate never becomes recallable** — rejection is terminal for
  recall eligibility (subject only to a future, separately-gated
  appeal / correction path, never a silent reversal);
- **supersession / correction preserves auditability while ordinary recall
  includes only the corrected active assertion** — the prior superseded state
  remains available for audit / provenance but is excluded from ordinary
  recall;
- **fail-closed paths do not leak raw candidate / private payload** — on any
  error, rejection, or malformed input, the public response carries a stable
  reason code and a safe summary only, never the raw candidate body, private
  sentinels, internal store text, or operational identifiers.

The invariant is the stable cross-repo anchor. Phase 45F's acceptance changes
names and shapes nowhere; it only confirms the invariant holds identically on
both sides.

---

## 7. Remaining known nuances

Carried forward unchanged from Phase 45E §6 / §7 and the Phase 45F adapter's
own comments. These are *naming / shape* nuances a future, separately-gated
phase would reconcile — none of them is resolved or relaxed here:

- **`candidate_not_admitted` is pending exclusion, not denial.** A candidate
  with no admission transition is *pending* (Dixie probe A /
  `candidate_pending_not_recallable`), which is **not** the same as an explicit
  denial.
- **`transition_denied` direction is appropriate for rejected candidates, not
  pending candidates.** The Dixie `transition_denied`-family direction maps to
  the local `candidate_rejected` (Dixie probe C), and the pending-vs-denied
  distinction must survive any future mapping.
- **`corrected_active` is a direction / active corrected assertion, not
  necessarily a canonical status.** The correction is expressed canonically as
  the `(superseded, active)` pair plus a supersede link; the local
  `corrected_active` / `corrected_active_assertion` inclusion label must not be
  promoted to a canonical status.
- **`unsupported_fixture_shape` is a local proof reason code; Dixie uses
  `ingress.invalid_request` / the invalid-request family direction.** The local
  fail-closed code reconciles toward the Dixie refusal family direction, not the
  other way around.
- **`unsafe_candidate_payload_projection` maps toward the no-leak / unsafe
  projection family** (alongside `unsafe_private_sentinel_projection`) — a
  direction, not a frozen name.
- **Dixie `authority_signer_type_draft` and local `operator_dev_synthetic`
  still need future signer / authority reconciliation.** The local
  `operator_dev_synthetic` is not a canonical `SignerType` member; the Dixie
  `authority_signer_type_draft` placeholder is itself draft. Authority-naming
  reconciliation is future work.
- **Dixie probe field names remain draft v0.** The Dixie-proposed link / receipt
  field names are explicitly draft; their final naming is deferred and unfrozen.
- **Local receipt / audit / public-private split remains proof-level, not
  production.** The local fixtures carry only id-level receipt / audit refs; the
  field-level public/audit inventory is open and not modeled for production
  here.

---

## 8. Next-lane options

The candidate next options, classified. Phase 45G authorizes **none** as
implementation; it ranks them so the selection in §9 is explicit.

- **Option A — Freeside Characters adapter hardening.** *Possible.* Would add
  more negative tests, more coverage, or stricter static guards over the
  existing Phase 45F adapter. **Low value** unless a specific gap is found; the
  Phase 45F adapter already proves the five mappings, semantic equivalence,
  no-leak, fail-closed, and the not-wired static guards.
- **Option B — Freeside Characters package export.** *Defer.* There is no
  stable consumer contract, and exporting the adapter would imply API
  stability too early. Should follow, not precede, a stable consumer need.
- **Option C — Freeside Characters live admission client or Discord command.**
  *Blocked.* Requires a live Dixie route, storage / auth / consent gates, and
  separate authorization (decision-map §7; Dixie Phase 33A §9). Not available
  from this gate.
- **Option D — Dixie Phase 33D probe hardening / contract vocabulary
  refinement.** *Recommended next.* Dixie should decide whether the draft v0
  probes need stricter vocabulary / field alignment, signer / authority
  vocabulary, receipt / audit shape, idempotency semantics, and a Straylight
  primitive review before any live route design. This is a cross-repo handoff
  recommendation, not a Freeside Characters implementation lane.
- **Option E — Cross-repo live admission readiness gate.** *Later.* Not before
  Dixie probe hardening and the storage / auth / consent boundaries are
  decided.
- **Option F — Stop and preserve the proof.** *Available.* The local proof
  stack, the Phase 45F adapter, and this acceptance are a stable resting
  state.

---

## 9. Selected next lane

**Dixie Phase 33D — Admission Wedge probe hardening / contract vocabulary
refinement gate (Option D).**

Phase 45G selects a **cross-repo handoff recommendation to Dixie**, not a
Freeside Characters implementation authorization. The Freeside-side semantic
bridge is now proven (Phase 45F); the next useful work is upstream, where the
canonical vocabulary, field names, signer / authority semantics, receipt /
audit shape, idempotency semantics, and any Straylight primitive review are
owned. Freeside Characters should not coin names, harden its own adapter
speculatively, export it, or build a live path while the upstream draft v0 is
still unhardened.

The recommendation is that a future Dixie Phase 33D be **docs / decision or
docs + non-runtime probe hardening only**, deciding whether to revise the
draft v0 probes before any live route design. The Dixie-first posture from
Phase 45D / 45E and Dixie Phase 33B holds — Dixie / Straylight own the
canonical vocabulary, and Freeside Characters reconciles against the Dixie
draft rather than coining names.

**Why not the other lanes now:** Freeside-side adapter hardening (Option A) is
low-value without an identified gap; a package export (Option B) is deferred
until there is a stable consumer; a live admission client / Discord command
(Option C) is blocked behind separate gates; a cross-repo live admission
readiness gate (Option E) is later, after probe hardening and storage / auth
boundaries; and stopping (Option F) remains an acceptable resting state if a
reviewer prefers it.

---

## 10. Future Dixie Phase 33D boundaries

These boundaries are a **recommendation to Dixie**, not a Freeside Characters
authorization and not a decision made on Dixie's behalf. If and when Dixie
opens Phase 33D, the recommended shape is:

**Allowed (recommended) future Phase 33D scope:**

- docs / decision or docs + **non-runtime** fixture / probe hardening only;
- refine vocabulary;
- refine field names;
- reconcile signer / authority vocabulary;
- refine the receipt / audit public-private split;
- refine idempotency semantics;
- decide whether a Straylight primitive review is required before route design;
- maybe update Dixie docs / probes / validator **if Dixie explicitly chooses to
  harden them**.

**Blocked for Phase 33D (recommended):**

- a live route;
- storage writes;
- auth implementation;
- production admission;
- production storage / auth / consent;
- public remember-this;
- Discord ingestion;
- user chat becoming memory;
- Freeside runtime changes;
- package exports;
- LLM / voice;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze unless separately authorized by Straylight / Dixie
  governance.

---

## 11. What remains blocked now

Repeated clearly so a future reader does not over-read this acceptance. None of
the following is implemented, authorized, or claimed by Phase 45G (and none was
unblocked by Phase 45F, by Phase 45E, by Dixie Phase 33C, or by any prior
phase):

- a live admission route;
- a Freeside Characters live admission client;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord message-history ingestion;
- user chat becoming memory;
- storage writes;
- production admission / storage / auth / consent;
- public rollout;
- package exports;
- renderer / dispatch / startup / command-registration changes;
- LLM / voice behavior;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze;
- any local fixture / reducer label mutation;
- an adapter package export;
- runtime wiring of the adapter.

An acceptance / decision is not implementation. This doc reads the Phase 45F
evidence and selects the next lane; it decides nothing on Dixie's behalf, and
an accepted *test-only semantic bridge* over a *draft v0 probe set* is not a
frozen contract or a live path. If a later phase needs any item above, it must
open the gate that owns it (decision-map §7 / §8).

---

## 12. Success criteria for Phase 45G

This Phase 45G artifact succeeds if **all** of the following hold:

- it **accurately accepts Phase 45F's bounded proof** (§3, §5);
- it **states what Phase 45F does not prove** (§4);
- it **keeps the adapter dead-ended from runtime** — no export, no wiring, no
  live call authorized (§5, §11);
- it **preserves all blocked lanes** (§11);
- it **selects Dixie Phase 33D as the next lane** (§9) without authorizing any
  implementation;
- it **does not modify code / tests / fixtures / probes** (§1, §11);
- **Codex / review confirms docs / decision-only scope.**

Mechanically, the accepted-ladder acceptance bar applies:

- `git diff --check` is clean;
- the recall fixture validator passes
  (`node docs/recall-wedge/fixtures/validate-fixtures.mjs`);
- the admission fixture validator passes
  (`node docs/admission-wedge/fixtures/validate-fixtures.mjs`);
- the reducer test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.test.ts`);
- the runner test passes
  (`bun test packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.test.ts`);
- the Phase 45F adapter test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.test.ts`)
  — proving this acceptance did not perturb the artifact it accepts;
- the multi-surface harness regression passes
  (`bun test packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`);
- the live-Dixie client / runner regression passes
  (`bun test packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`)
  — proving this decision introduced no live-egress regression;
- a forbidden-claim scan finds no hits except negated blockers (this document
  claims no public remember-this, no Discord history ingestion, no
  chat-becomes-memory, no production admission, no production storage, no
  production auth / consent, no Finn production wiring, no live Dixie admission
  route, no authorized package export, no frozen final schema, no claim that
  Dixie Phase 33C is production schema, no Freeside Characters ownership of the
  Dixie / Straylight vocabulary, no fixture / reducer label rename, no fixture
  JSON mutation, no code change, no live Dixie call, and no runtime wiring);
- the artifact carries **no raw IDs / secrets / tokens / URLs / screenshots /
  binary evidence**.

---

## 13. Naming rules

Preserved verbatim from Phase 43B §B.1 / 43C / 44B / 44D / 45A / 45C / 45D /
45E; binding for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  app / repo (the Discord app, the Railway project and service that runs the
  bot). The current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only and
  is out of scope for this decision.
- **"Dixie"** / **`loa-dixie`** is the cross-repo intake / control-plane
  service (the Recall Wedge service today; the candidate future live admission
  intake / control-plane owner).
- **"Straylight"** is the canonical primitive / substrate owner where
  applicable — the memory / continuity substrate that owns the canonical
  admission / estate / receipt / assertion-lifecycle semantics and vocabulary.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired.
- Do **not** imply a **Dixie admission route** exists. Dixie exposes only a
  read-only, default-off, fail-closed recall route today; it has no admission
  route, no admission concept in route code, and no production storage.
- Do **not** imply the **final contract schema is frozen.** Dixie Phase 33C is
  an explicit **draft v0** (`schema_final: false`); it froze no production
  schema, and Phase 45F did not freeze one either.

---

## 14. Cross-references

Minimal status / cross-reference notes are added to the docs below (small
addenda only; the old docs are not rewritten, and no broad addenda are added):

- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — Phase 45E gate
  (PR #171). Gains a one-line Phase 45G note that the Phase 45F lane it
  selected is now accepted and that Dixie Phase 33D is the recommended next
  lane.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix. Gains
  a targeted Phase 45G addendum (§5x); §7 (live-memory-admission gates) and §8
  (prohibitions) stay in force.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 45G cross-reference note.
- `docs/admission-wedge/dixie-probes/README.md` — Phase 45F local mirrored
  probes (PR #172). Gains a one-line Phase 45G cross-reference note.

Other related artifacts (read only; **unchanged by Phase 45G, and
`../loa-dixie` is not editable from this repo / task**):

- `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) — Phase 45F adapter / validator (PR #172); the artifact this
  gate accepts. Unchanged here.
- `docs/admission-wedge/dixie-probes/*.json` — Phase 45F local mirrored Dixie
  probes (PR #172). Unchanged here.
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer the Phase
  45F adapter cross-checks against. Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner whose scenario labels
  the Phase 45F adapter reuses. Unchanged here.
- `docs/admission-wedge/fixtures/validate-fixtures.mjs` — Phase 43C
  dependency-free validator. Unchanged here.
- `../loa-dixie/docs/admission-wedge/fixtures/` — Dixie Phase 33C draft v0
  probes + validator + README (PR #120); the canonical upstream source the
  local mirrors copy. Read only; not modified.
- `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-FIXTURE-PROBE-ALIGNMENT-DECISION.md` —
  Dixie Phase 33B fixture/probe ownership decision (PR #119). Read only.
- `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RESPONSE.md` — Dixie Phase 33A
  contract response / acceptance gate (PR #118). Read only.
