# Admission Wedge — Dixie probe reconciliation / local alignment decision gate

> **Phase 45E** (Freeside Characters-side docs / decision only). Date:
> 2026-06-04. Follows Freeside Characters **Phase 45D / PR #163**
> (`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md` — contract
> reconciliation matrix / fixture-probe alignment gate) and Dixie **Phase
> 33C / PR #120** (`../loa-dixie/docs/admission-wedge/fixtures/` — the
> canonical **draft v0** Admission Wedge contract probe set + validator +
> README). Companion to `docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`
> (Phase 45C), `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 45A),
> `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` (Phase 44D),
> `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` (Phase 44B),
> `docs/ADMISSION-WEDGE-MVP-DESIGN.md` (Phase 43B), `docs/admission-wedge/fixtures/README.md`
> (Phase 43C), and `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A
> option matrix — §7 live-memory-admission gates and §8 prohibitions govern
> everything this gate points toward).
>
> This document **reconciles** Freeside Characters' local proof stack
> against the Dixie Phase 33C **draft v0** probes and **decides the next
> local alignment lane**. It is **not** a local adapter, **not** a fixture
> mutation, **not** a reducer / runner code change, and **not** a runtime
> wiring. It implements nothing. It introduces no source, test, fixture
> JSON, package, lockfile, config, CI, or generated change; no runtime
> Discord behavior; no Discord command; no live Dixie admission route; no
> Straylight store; no admission path; no memory write; no storage; no
> network call. It does **not** rename any local fixture label, **does not**
> mutate any reducer reason code, and **does not** freeze a final schema. It
> does **not** claim Dixie Phase 33C is a production schema, and it does
> **not** claim Freeside Characters owns the Dixie or Straylight vocabulary.
> If a step seems to require reaching past these boundaries, the answer is to
> open the separate later gate that owns it (decision-map §7 / §8) — not to
> relax it from this decision.

---

## 1. Phase title and status

**Phase 45E — Admission Wedge Dixie probe reconciliation / local alignment
decision.**

- Phase 45E is a **Freeside Characters-side docs / decision-only artifact.**
  It produces this decision plus the smallest possible cross-reference
  back-notes in the docs named in §15. It introduces no source, test,
  fixture JSON, package, lockfile, config, CI, or generated change.
- Phase 45E **follows Freeside Characters Phase 45D / PR #163** (contract
  reconciliation matrix / fixture-probe alignment gate) **and Dixie Phase
  33C / PR #120** (canonical fixture/probe draft). It reads both as evidence:
  Phase 45D selected a Phase 45E "fixture-probe alignment decision /
  Dixie-first handoff" lane, and Dixie Phase 33C is the Dixie-authored draft
  probe set that lane was waiting for.
- Phase 45E **does not implement a local adapter.** It writes no validator,
  no adapter, no test that consumes the Dixie probes. It only *reconciles*
  the existing local proof artifacts against the Dixie draft and *decides*
  the next lane.
- Phase 45E **does not mutate fixtures, change reducer / runner code, or wire
  runtime.** The Phase 43C fixtures, the Phase 44A reducer, and the Phase 44C
  runner remain exactly as landed. No live admission is authorized.
- Phase 45E **does not freeze a final schema.** Dixie Phase 33C is explicit
  that its probes are **draft v0 — NOT frozen** (`schema_final: false`); this
  decision preserves that. Every local fixture / reducer / runner label
  remains a valid **local proof label**, and the canonical live vocabulary is
  owned upstream (Straylight), not by Freeside Characters.

---

## 2. Source chain

This decision is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder plus the Dixie `33` series. **These artifacts are
evidence only; Phase 45E modifies none of them except for the small
cross-reference addenda named in §15, and it does not edit `../loa-dixie` at
all.**

Freeside Characters:

- **Phase 43B / PR #152** — `docs/ADMISSION-WEDGE-MVP-DESIGN.md`. The
  Admission Wedge MVP design: candidate / transition / admitted / receipt
  packet shapes (§F), the core invariant (§D), and the non-recallability /
  rejection / supersession proof obligations (§H / §I / §J).
- **Phase 43C / PR #155** — `docs/admission-wedge/fixtures/`. The
  fixture / operator-contract proof: a deterministic candidate → transition
  → admitted → recall-proof graph plus a dependency-free validator.
- **Phase 44A / PR #156** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`). The fixture-bound reducer / adapter: a pure,
  dependency-free local reducer that proves the §D invariant *in code* with
  17 stable reason codes and a no-leak seal.
- **Phase 44B / PR #157** — `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`.
  The reducer acceptance / next-lane gate. Accepted Phase 44A; selected
  Phase 44C.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: reads the
  Phase 43C fixtures and calls the Phase 44A reducer to print operator-safe
  summaries across five scenarios (before-admission excluded · accepted
  included · rejected excluded · supersession corrected-only · a synthetic
  in-memory `malformed_fail_closed`).
- **Phase 44D / PR #159** — `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`.
  The runner acceptance / next-lane gate. Accepted Phase 44C; selected
  Phase 45A.
- **Phase 45A / PR #160** — `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`.
  The Dixie-side contract request / handoff: summarizes the proof stack,
  carries the §D invariant, and enumerates the A–J contract decisions for the
  Dixie / Straylight owners to define or accept *later*.
- **Phase 45C / PR #162** —
  `docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`. The Dixie response
  reconciliation: reads Dixie Phase 33A against the Phase 45A request and the
  local proof stack at the narrative level.
- **Phase 45D / PR #163** —
  `docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`. The field-level
  reconciliation matrix: converts the Phase 45C narrative into explicit
  vocabulary (§5), field/shape (§6), and A–J contract-area (§7) tables, and
  selects a **Dixie-first** Phase 45E lane (its §11) — recommending Freeside
  Characters wait for, or reconcile against, a Dixie-authored fixture/probe
  rather than guess.

Dixie:

- **Phase 33A / PR #118** — `../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`.
  The Dixie-side Admission Wedge contract response / acceptance gate. It
  records what Dixie will **own**, **defer**, and **block**; accepts the
  *need* for a contract and a provisional **draft v0** vocabulary; and
  explicitly does **not** freeze a production schema or implement a route.
- **Phase 33B / PR #119** —
  `../loa-dixie/docs/ADMISSION-WEDGE-FIXTURE-PROBE-ALIGNMENT-DECISION.md`. The
  Dixie fixture/probe ownership decision: decides **Dixie-first** ownership
  of the first canonical contract probe, defines the minimum future probe set
  (§6), the schema surfaces (§7), and the vocabulary directions (§8).
  Authorizes a future Phase 33C; implements no fixture.
- **Phase 33C / PR #120** — `../loa-dixie/docs/admission-wedge/fixtures/`. The
  canonical **draft v0** Admission Wedge contract probes: five synthetic,
  public-safe probe JSONs (`candidate-pending-not-recallable.json`,
  `accept-candidate-to-admitted-assertion.json`,
  `reject-candidate-no-assertion.json`,
  `supersede-with-corrected-assertion.json`,
  `malformed-or-unsafe-payload-fail-closed.json`), a dependency-free,
  Node-built-ins-only validator, and a README. It is **non-runtime**: no live
  route, storage, auth, or admission behavior, and **no schema freeze**.

> **Cross-repo phase-numbering note.** Dixie's `33` series (`33A`/`33B`/`33C`)
> is distinct from any Freeside Characters `33A` and from the Freeside
> Characters `43B–45E` Admission Wedge sequence. Dixie `33C` and the Freeside
> Characters phases are independent labels in separate repositories and must
> not be conflated; Dixie Phase 33A §9 lists cross-repo phase numbering as an
> open reconciliation item, and this decision does not resolve it.

Phase 45E inherits the Phase 45D / 45C authority boundary verbatim: it may
*reconcile the probes against the local proof stack* and *classify and select
the next lane*; it may **not** authorize production admission, public
remember-this, Discord message-history ingestion, a live Dixie admission
route, or a full production Straylight admission / storage / auth / consent
architecture, and it may **not** decide anything on Dixie's behalf.

---

## 3. Reconciliation purpose

- **Freeside Characters had local proof labels and local fixtures.** The
  Phase 43C fixture graph, the Phase 44A reducer's 17 stable reason codes,
  and the Phase 44C runner summaries proved the §D invariant *in code* — but
  with **local proof labels** (`candidate_pending`, `admitted`, `rejected`,
  `superseded`, `candidate_not_admitted`, …), not canonical live contract
  vocabulary.
- **Dixie now owns a first draft v0 contract probe set.** Per the Phase 33B
  Dixie-first ownership decision, Dixie Phase 33C authored the first canonical
  contract probe proposal (§4). It is a Dixie-owned **draft**, aligned to
  Straylight-owned canonical vocabulary where it exists.
- **Phase 45E decides how Freeside Characters should align next without
  mutating local proof artifacts yet.** It maps each Dixie probe to the local
  proof stack, records the vocabulary / field decisions, and selects a narrow
  future local lane — it changes no fixture, reducer, or runner.
- **Dixie Phase 33C probes are draft v0, non-runtime, not production schema,
  and not final frozen names.** They carry `schema_final: false`,
  `runtime_enabled: false`, `production_admission: false`, `public_safe: true`
  on every probe, and the Dixie README states the names are a *proposal* for
  cross-repo review, with final naming reconciled at a later, separately-gated
  phase.
- **Freeside Characters should not proceed to live command / client / storage
  work from either the local proof labels or the Dixie draft probes yet.**
  The local labels are proof labels; the Dixie probes are a draft proposal.
  Neither is a frozen live contract. Live admission, a Discord command, and
  `/remember-this` remain blocked behind the decision-map §7 / §8 gates.

This decision is the map of *where the two sides already agree* and *what a
future local alignment lane would do*. It is not the move.

---

## 4. Dixie Phase 33C summary

Dixie Phase 33C authored five draft contract probes under
`../loa-dixie/docs/admission-wedge/fixtures/`, one per invariant scenario.
Each is a single JSON object sharing one envelope: a synthetic `input` (which
may carry a private `unsafe_marker:` token), a modeled
transition / assertion / recall projection, a private `audit` object, and a
clean `public_response` — and the Dixie validator proves the `public_response`
never leaks private material.

The five probes (Dixie `scenario_id`):

- **`candidate_pending_not_recallable`** — a candidate exists as canonical
  `proposed`; no admission transition; no admitted assertion; `recall_eligible`
  is `false`; the payload is not echoed in the public projection.
- **`accept_candidate_to_admitted_assertion`** — a candidate is accepted via
  an `admit_assertion` transition linking candidate → admitted assertion
  (canonical status `active`); it becomes recall-eligible under policy; a
  receipt / audit split exists; the raw payload is not echoed.
- **`reject_candidate_no_assertion`** — a candidate is denied (canonical
  `transition_denied` audit event); **no** admitted assertion is minted; the
  candidate stays non-recallable; a rejection receipt exists on the audit
  boundary; the public response is safe.
- **`supersede_with_corrected_assertion`** — a prior assertion moves to
  canonical `superseded`; a corrected assertion is `active`; ordinary recall
  includes the corrected active assertion **only**; the superseded prior
  remains audit / provenance only; the public response is safe.
- **`malformed_or_unsafe_payload_fail_closed`** — a malformed / unsafe input
  fails closed with a stable reason code from the existing Dixie refusal
  family (`ingress.invalid_request`); **no** admitted assertion is minted; no
  raw payload, unsafe marker, source material, or stack trace appears in the
  public response.

Dixie's probes are:

- `probe_kind: admission_wedge_contract_probe`;
- `probe_version: dixie_admission_wedge_probe_v0`;
- draft / non-final — every probe carries `schema_final: false`,
  `runtime_enabled: false`, `production_admission: false`, `public_safe: true`;
- synthetic short IDs only (`cand_demo_001`, `assn_demo_001`, `trans_demo_001`,
  `rcpt_demo_001`, …);
- validated by Dixie's docs-only, dependency-free validator
  (`../loa-dixie/docs/admission-wedge/fixtures/validate-fixtures.mjs`, Node
  built-ins only, no app/route imports, no network / storage / env).

Dixie marks which terms are **canonical (aligned)** — Straylight-owned and
adopted as-is (`AssertionStatus.proposed`, `AssertionStatus.active`,
`AssertionStatus.superseded`, transition `admit_assertion`, audit events
`assertion_admitted` / `transition_denied`, `RecallUseInstruction`) and which
are **draft (Dixie-proposed)** link / receipt field names
(`source_candidate_id`, `admission_transition_id`, `admitted_assertion_id`,
`supersedes_assertion_id`, `superseded_by_assertion_id`,
`recall_use_instruction`, `rendered_candidate_payload`, `receipt_public_ref`),
plus the Dixie-owned refusal codes (`ingress.invalid_request`,
`seam.class_validation_failed`). Final naming is deferred and unfrozen.

---

## 5. Invariant reconciliation

The load-bearing invariant is **unchanged** and is now proven / reconciled
across three independent surfaces:

- the **Freeside Characters local proof stack** — the Phase 43C validator
  across the fixture graph, the Phase 44A reducer over already-parsed fixture
  objects with 17 stable reason codes and a no-leak seal, and the Phase 44C
  runner's operator-safe summaries;
- the **Dixie Phase 33A response** — which accepted the invariant as a
  standing requirement any future Dixie Admission Wedge contract must
  preserve, framed as an admission-side extension of the Recall Wedge posture
  already in force on the Dixie side;
- the **Dixie Phase 33C draft probes** — which now make the same invariant
  mechanically checkable on the Dixie side (each probe references its
  load-bearing `inv*` clauses and the Dixie validator enforces them).

The invariant (carried unchanged from Phase 43B §D / Phase 45A §4 / Phase 45C
§5 / Phase 45D §4 and matching Dixie Phase 33A §4 / Phase 33B §5):

- **candidate memory is not admitted memory** — a candidate is a proposal,
  not governed continuity;
- **candidate memory is not recallable before explicit admission** — a
  candidate must never appear in an ordinary recall result before an
  admission transition accepts it;
- **an accepted transition creates or references an admitted assertion** —
  acceptance is the only path from candidate to admitted; it is explicit,
  authority-bound, and auditable;
- **a rejected candidate never becomes recallable** — rejection is terminal
  for recall eligibility (subject only to a future, separately-gated
  appeal / correction path, never a silent reversal);
- **supersession / correction preserves auditability while ordinary recall
  includes only the corrected active assertion** — the prior superseded state
  remains available for audit / provenance but is excluded from ordinary
  recall;
- **fail-closed paths do not leak raw candidate / private payload** — on any
  error, rejection, or malformed input, the public response carries a stable
  reason code and a safe summary only, never the raw candidate body, private
  sentinels, internal store text, or operational identifiers.

The invariant is the stable cross-repo anchor. Every reconciliation cell below
is a question about *naming and shape* — never about whether the invariant
holds. **Reconciliation changes names and field shapes; it never relaxes this
invariant.**

---

## 6. Probe-to-local scenario reconciliation

Each Dixie Phase 33C probe is mapped to its Freeside Characters local
proof equivalent. **Alignment status** records whether the *semantics* agree
(they do, on every row); the **Mismatch / nuance** column records the naming
or shape difference a future local alignment would reconcile; the **Future
local action** column names work for a *separately authorized* later phase.
No fixture, reducer, or runner changes here.

| Dixie Phase 33C probe | Freeside Characters local fixture / proof equivalent | Alignment status | Mismatch / nuance | Future local action |
|---|---|---|---|---|
| **A. `candidate_pending_not_recallable`** | Before-admission exclusion proof: `recall-proofs/proof-001-before-admission-excluded.json` (`recall_result = excluded`, `exclusion_reason = candidate_not_admitted`) + the candidate `candidates/cand-001-accepted-pending.json` (`admission_state = candidate_pending`, `recall_eligibility = ineligible`); Phase 44A `projectAdmissionRecallProof` before-admission case | aligned (semantics) — a candidate exists but is **not** admitted and **not** recallable; payload not echoed | Dixie uses the canonical `proposed` candidate-state direction (`public_response.candidate_state = "proposed"`); the local `candidate_pending` is a **local proof label** carried on `admission_state` | map `candidate_pending` ↔ Dixie `proposed` at a future local adapter / validator; do **not** rename now |
| **B. `accept_candidate_to_admitted_assertion`** | Accepted / admitted-included proof: `transitions/trans-001-accept.json` (`admission_decision = accepted`, mints `assn-001`) + `admitted/assn-001-active.json` (`assertion_status = active`, `recall_eligibility = eligible`) + `recall-proofs/proof-002-after-admission-included.json` (`included_assertion_ids = ["assn-001"]`); Phase 44A accept case | aligned (semantics) — accepted transition links candidate → an active admitted assertion that is recall-eligible; raw payload not echoed | Dixie uses the canonical `admit_assertion` transition / `assertion_admitted` audit event with resulting status `active`; the local `admitted` + `active` labels (`admission_state = admitted` alongside `assertion_status = active`) are **local proof labels** | map the local accept / `admitted` labels onto the Dixie `admit_assertion` act + `active` status at a future adapter; preserve the act-vs-status split |
| **C. `reject_candidate_no_assertion`** | Rejected-excluded proof: `transitions/trans-002-reject.json` (`admission_decision = rejected`, `admitted_assertion_id = null`) + `recall-proofs/proof-003-rejected-excluded.json` (`recall_result = excluded`, `exclusion_reason = candidate_rejected`); Phase 44A reject case | aligned (semantics) — **no** admitted assertion is minted; the rejected candidate stays non-recallable; rejection receipt on the audit boundary; public response safe | Dixie anchors rejection on the canonical `transition_denied` audit event (a denied `admit_assertion`); the local `rejected` / `candidate_rejected` are **local proof labels** | map the local rejection labels onto `transition_denied`; **preserve the pending-vs-denied distinction** (`candidate_not_admitted` is *pending, never decided*, not the same as an explicit denial — see §7) |
| **D. `supersede_with_corrected_assertion`** | Supersession corrected-only proof: `transitions/trans-011-supersede.json` (accept with `supersedes_assertion_id = assn-010`) + `admitted/assn-010-superseded.json` (`assertion_status = superseded`, `recall_eligibility = ineligible`) + `admitted/assn-011-active-correction.json` (`assertion_status = active`, `supersedes_assertion_id = assn-010`) + `recall-proofs/proof-004-supersession-corrected.json` (`included_assertion_ids = ["assn-011"]`, `excluded_assertion_ids = ["assn-010"]`); Phase 44A supersede case | aligned (semantics) — only the corrected active assertion appears in ordinary recall; the superseded prior remains audit / provenance only | Dixie expresses correction as the canonical `(superseded, active)` pair plus a supersede link, not a coined status; the local `corrected_active` / `corrected_active_assertion` inclusion label may **not** become a canonical status | map the local corrected-active label onto the canonical `(superseded, active)` pair at a future adapter; do not promote `corrected_active` to a status |
| **E. `malformed_or_unsafe_payload_fail_closed`** | Fail-closed / unsupported-shape / unsafe-projection proof: Phase 44A reducer fail-closed codes (`unsupported_fixture_shape`, `unsafe_candidate_payload_projection`, `unsafe_private_sentinel_projection`, …) + the Phase 44C runner's in-memory synthetic `malformed_fail_closed` scenario + the Phase 43C validator's banned-material / sentinel grep | aligned (semantics) — a stable fail-closed reason and **no** public leak; no assertion minted | Dixie's probe uses the `ingress.invalid_request` (refusal-family) public `reason_code`; the local reducer emits **local** reason codes (`unsupported_fixture_shape`, the `unsafe_*` no-leak codes) | map the local fail-closed reason codes onto the Dixie refusal family (`ingress.invalid_request` / `seam.class_validation_failed`) at a future adapter |

**Net reading:** all five Dixie probes map cleanly onto the local proof stack
at the *semantic* level — the invariant holds identically on both sides. The
only deltas are **naming and shape**, exactly the reconciliation a future local
adapter / validator would perform. Two nuances must be carried forward
explicitly: the **pending-vs-denied distinction** (probe A vs probe C) and the
fact that **`corrected_active` is a direction, not a canonical status** (probe
D).

---

## 7. Vocabulary reconciliation decision

- **Local Freeside Characters labels remain valid proof labels.** The Phase
  43C fixture field values and the Phase 44A reducer reason codes stay exactly
  as landed; they proved the invariant in code and continue to.
- **Dixie Phase 33C labels are the first Dixie-owned draft contract probe
  labels.** They align to Straylight-owned canonical vocabulary where it
  exists and mark Dixie-proposed link / receipt names as draft.
- **Neither set is final production schema.** Dixie Phase 33C is
  `schema_final: false`; the canonical live vocabulary is Straylight-owned and
  unfrozen.
- **Freeside Characters should not rename local fixture labels yet.**
- **Freeside Characters should not mutate reducer reason codes yet.**
- **A future local adapter / validator should map between local proof labels
  and Dixie probe labels without forcing immediate renames** — a mapping
  layer, not a rename, preserves the local proof chain while proving semantic
  equivalence.

**Decision-for-now table** (the "Dixie probe direction" column restates the
Dixie Phase 33C README vocabulary table and Phase 33A §6.1; it is the
canonical *direction*, not a frozen name):

| Local label | Dixie probe direction | Decision for now |
|---|---|---|
| `candidate_pending` | canonical `proposed` / candidate-state direction (`AssertionStatus.proposed`) | map later; **do not rename now** |
| `admitted` / `admitted_active_assertion` | the act = transition `admit_assertion` + audit event `assertion_admitted`; the status = canonical `active` (no bare `admitted` status upstream) | map later; preserve the act-vs-status split |
| `rejected` / `candidate_rejected` | `transition_denied`-family (a denied `admit_assertion`) | map later; **preserve pending-vs-denied nuance** |
| `candidate_not_admitted` | pending exclusion (a `proposed` candidate with no transition), **not** denial | **preserve the distinction** — not a synonym of `transition_denied` |
| `superseded` | canonical `superseded` (`AssertionStatus.superseded`) | **likely aligned** — exact canonical match; cite Straylight as owner |
| `corrected_active` / `corrected_active_assertion` | active corrected assertion direction — the `(superseded, active)` pair + supersede link, not a coined status | map later; do not promote to a status |
| `unsupported_fixture_shape` | `ingress.invalid_request` / `seam.class_validation_failed` (class-validation / invalid-request family) | adapter mapping later |
| `unsafe_candidate_payload_projection` | no-leak / unsafe-projection family (Dixie Phase 32K no-leak posture) | adapter mapping later |

> **Pending-vs-denied is load-bearing.** A candidate that simply has no
> admission transition is `proposed` (Dixie probe A) and is **not** the same
> as an explicit `transition_denied` (Dixie probe C). The local
> `candidate_not_admitted` reason code carries the *pending* sense, while
> `candidate_rejected` carries the *denied* sense. Dixie deliberately keeps
> these on separate probes; a future local adapter must preserve the
> distinction rather than collapse the synonym set. (Dixie flags the local
> `rejected` / `candidate_not_admitted` / `candidate_rejected` triple as a
> synonym collision, but `candidate_not_admitted` is semantically *pending*,
> not *denied* — that nuance must survive any mapping.)

This decision **renames nothing** and **mutates no reducer code**. The
"decision for now" column describes a *separately-authorized* later phase's
mapping work.

---

## 8. Field / shape reconciliation decision

A future Freeside-side adapter / validator (Phase 45F, §10–§11) would need to
compare the following field / shape surfaces between the local fixtures /
reducer and the Dixie Phase 33C probes. **Nothing is compared, added,
renamed, or re-typed here** — this is the inventory of where that future,
separately-authorized lane would look. (This refines Phase 45D §6 against the
now-concrete Dixie probe shapes.)

- **candidate id / idempotency semantics** — local `candidate_id` is a short
  fixture id (`cand-001`); Dixie uses synthetic short ids (`cand_demo_001`).
  Neither models a service-issued idempotency key; idempotency is expressed
  locally only via a deterministic `admitted_assertion_id` + a prose
  `idempotency_note`. The idempotency-key semantics remain open (Phase 45D
  §6.1 gap; Dixie Phase 33A §9.6).
- **tenant / estate / actor binding** — local synthetic
  `actor_id = freeside-characters:shared-substrate` /
  `estate_id = estate-operator-dev-001`; Dixie synthetic `tenant_id` /
  `estate_id` / `proposing_actor_id`. Both are audit-only and synthetic;
  session-derived binding is a future contract decision, not modeled here.
- **source kind / ref public-vs-audit boundary** — local `source_kind` /
  `source_ref` (a fixture path) with `provenance.source_material` carrying a
  `SOURCE_SENTINEL`; Dixie carries `source_kind` / `source_ref` only on the
  private `input` / `audit` sections. The public-safe-vs-audit-only split is
  the surface to confirm.
- **`proposed_assertion_class` / `AssertionClass` validation** — local
  `proposed_assertion_class` values are union members (`observation`,
  `preference`) but there is **no validation binding** locally; Dixie probe E
  proves the malformed case (`not_a_valid_class_demo`) fails closed.
- **admission_authority / `SignerType` alignment** — local
  `admission_authority = operator_dev_synthetic` is **not** a canonical
  `SignerType` member (Phase 45D §6.2 mismatch); Dixie probes use a
  `authority_signer_type_draft: "policy_service"` placeholder (itself marked
  draft). Authority-naming reconciliation is future work.
- **transition / id / admitted-assertion link fields** — local
  `transition_id` → `candidate_id` → `admitted_assertion_id`; Dixie
  `admission_transition_id` / `source_candidate_id` / `admitted_assertion_id`
  (the Dixie link names are explicitly **draft**). The linkage *shape* matches;
  the field *names* reconcile later.
- **receipt / audit public-private split** — local carries only a `receipt_ref`
  / `audit_ref` id (`rcpt-001`); Dixie carries a `receipt_public_ref` on the
  public response and a full `admission_receipt` / `supersession_receipt` on
  the private `audit` object. The field-level public/audit inventory is open
  (Phase 45D §F; Dixie Phase 33A §9.3 / §9.10).
- **recall eligibility representation** — local `recall_eligibility` is binary
  (`eligible` / `ineligible`); Dixie pairs a boolean `recall_eligible` with the
  canonical `recall_use_instruction` (`usable` … `do_not_use_for_action`). The
  binary → "under policy" + use-instruction reconciliation is future work.
- **`rendered_candidate_payload` false / no-leak posture** — local recall
  proofs carry `rendered_candidate_payload: false`; Dixie carries the same
  boolean `false` on every `public_response`. **Aligned** — this is the
  load-bearing no-leak boolean on both sides.
- **public response safe reason codes** — local reducer emits 17 stable codes
  (incl. `unsupported_fixture_shape` and the `unsafe_*` no-leak codes); Dixie
  uses `ingress.invalid_request` on the public fail-closed path. Both reconcile
  to the canonical refusal family.

**Decision for now:**

- **do not mutate local fixture fields;**
- **do not import Dixie fixtures into the Freeside runtime;**
- **do not mirror Dixie probes into source code;**
- a future local adapter, if opened, should be **test-only or
  docs / fixture-bound** — never a runtime path.

---

## 9. Next-lane options

The candidate next options, classified. Phase 45E authorizes **none** as
implementation; it ranks them so the selection in §10 is explicit.

- **Option A — Freeside Characters no-op Dixie probe adapter / validator.**
  *Recommended next.* Would be local / test-only or docs / fixture-bound. It
  reads or mirrors the Dixie draft probe shapes, maps them to the current
  local reducer / runner expectations, and proves semantic alignment **without
  runtime wiring**. No live Dixie calls; no Discord command; no
  storage / auth / consent; no package exports.
- **Option B — Freeside Characters local fixture-label rename.** *Defer.* Too
  risky before an adapter proves the mapping; renames can obscure the local
  proof chain. Should follow, not precede, a proven adapter mapping.
- **Option C — Wait for Dixie Phase 33D hardening.** *Acceptable* if Dixie
  wants to revise the probes first. Not required if a Freeside-side adapter
  can remain draft / probe-bound (mapping against `dixie_admission_wedge_probe_v0`
  and re-aligning if a later probe version lands).
- **Option D — Live admission client or command.** *Blocked.* Requires a live
  route / storage / auth / consent and separate gates (decision-map §7;
  Dixie Phase 33A §9).
- **Option E — Package export.** *Deferred.* No stable consumer contract yet.
- **Option F — Stop and preserve the proof.** *Available* — the local proof
  stack plus this decision is a stable resting state.

---

## 10. Selected next lane

**Phase 45F — Admission Wedge Dixie probe no-op adapter / validator (a
narrow, future-gated, test-only or docs / fixture-bound alignment lane).**

Phase 45E selects the **implementation lane (Option A)** as the recommended
next phase, but keeps it **narrow and future-gated**: a future Phase 45F may
add a **test-only or docs / fixture-bound no-op adapter / validator** that
consumes **mirrored** Dixie probe fixture shapes and proves they map to the
current Freeside local semantics. It **must not** runtime-wire or live-call
Dixie.

The choice of the implementation lane (rather than only a further
decision / planning gate) is deliberate: the §6 probe-to-local mapping is
already clean at the semantic level, so the next useful artifact is a
test-only proof of that mapping, not another decision doc. But Phase 45E
authorizes only the *narrow, future-gated* shape in §11; it does **not** open
or implement Phase 45F here, and the conservative alternative (a
decision / planning-only gate, or simply waiting for Dixie Phase 33D — Option
C) remains acceptable if a reviewer prefers it.

**Why not the riskier lanes now:** a local fixture-label rename (Option B) is
deferred until an adapter proves the mapping; a live client / command (Option
D) and a package export (Option E) are blocked / deferred behind separate
gates. The Dixie-first posture from Phase 45D / Dixie Phase 33B holds —
Dixie / Straylight own the canonical vocabulary, and the Freeside-side lane
reconciles against the Dixie draft rather than coining names.

---

## 11. Phase 45F boundaries

If Phase 45F is opened, it is authorized only as a future **test-only or
docs / fixture-bound no-op adapter / validator**, under its own
separately-gated design / review / audit.

**Allowed future Phase 45F scope:**

- a **test-only or docs / fixture-bound** adapter / validator;
- it **may read local copied / mirrored Dixie probe JSON** or a manually
  mirrored fixture set (a Freeside-local copy, never a live fetch);
- it **may map Dixie probe scenarios to the current local reducer / runner
  semantics** (the §6 mapping, proven in a test or a docs-bound validator);
- it **may add tests proving semantic equivalence** between the mirrored Dixie
  probe shapes and the local proof stack;
- it **may add docs explaining the mapping**;
- **no package export unless separately justified.**

**Explicitly NOT authorized for Phase 45F:**

- runtime Discord behavior;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord history ingestion;
- user chat becoming memory;
- a live Dixie admission route;
- live network calls;
- storage writes;
- production admission;
- production storage;
- production auth / consent;
- package exports;
- public renderer changes;
- dispatch / startup / command-registration changes;
- LLM / voice;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze.

Phase 45F, when opened, is a narrow alignment-proof lane — not a build of any
live path. If it needs any item above, it must open the gate that owns it
(decision-map §7 / §8) — Phase 45E authorizes none of them.

> **Phase 45F status note (added later).** Phase 45F acted on this lane as a
> **test-only / docs-fixture-bound no-op adapter / validator**. It adds local
> **mirrored** copies of the Dixie Phase 33C draft v0 probes under
> `docs/admission-wedge/dixie-probes/` (clearly marked local mirrors, not
> canonical upstream truth) plus a pure local adapter
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + test) that maps the five Dixie probe scenarios
> (`candidate_pending_not_recallable` → `before_admission_excluded`,
> `accept_candidate_to_admitted_assertion` → `accepted_admitted_included`,
> `reject_candidate_no_assertion` → `rejected_excluded`,
> `supersede_with_corrected_assertion` → `supersession_corrected_only`,
> `malformed_or_unsafe_payload_fail_closed` → `malformed_fail_closed`) onto the
> current local proof scenarios and proves semantic equivalence against the
> existing Phase 44A reducer / Phase 44C runner output. It **proves semantic
> mapping only**: it renames no local fixture label, mutates no reducer reason
> code, mutates no fixture JSON, calls no live Dixie, wires no runtime path, and
> is not exported from the package surface. Live admission, a live Dixie
> admission route, storage, a command, package exports, and Finn production
> wiring all stay blocked.

---

## 12. What remains blocked now

Repeated clearly so a future reader does not over-read this decision. None of
the following is implemented, authorized, or claimed by Phase 45E (and none
was unblocked by Dixie Phase 33C, by Phase 45D, or by any prior phase):

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
- any local fixture / reducer label mutation.

A reconciliation / decision is not implementation. This doc reads the evidence
and decides the next lane; it decides nothing on Dixie's behalf, and an
accepted *draft v0 probe set* is not a frozen contract. If a later phase needs
any item above, it must open the gate that owns it (decision-map §7 / §8).

---

## 13. Success criteria for Phase 45E

This Phase 45E artifact succeeds if **all** of the following hold:

- it **accurately summarizes the Dixie Phase 33C probes** (§4);
- it **maps each Dixie probe to the local Freeside proof stack** (§6);
- it **preserves the local labels as proof labels** (§7) — renaming nothing;
- it **does not mutate fixtures / reducer / runner** (§8, §12);
- it **selects a narrow future local adapter / validator lane** (§10 — Phase
  45F, Option A) without authorizing runtime implementation;
- it **does not authorize runtime implementation** in any repo (§11, §12);
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
  Dixie / Straylight vocabulary, and no fixture / reducer label rename or
  fixture JSON mutation);
- the artifact carries **no raw IDs / secrets / tokens / URLs / screenshots /
  binary evidence**.

---

## 14. Naming rules

Preserved verbatim from Phase 43B §B.1 / 43C / 44B / 44D / 45A / 45C / 45D;
binding for this document:

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
  schema.

---

## 15. Cross-references

Minimal status / cross-reference back-notes are added to the docs below
(small addenda only; the old docs are not rewritten):

- `docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md` — Phase 45D matrix
  (PR #163). Gains a one-line Phase 45E note that the Dixie-first lane it
  selected is now reconciled against Dixie Phase 33C.
- `docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md` — Phase 45C
  reconciliation (PR #162). Gains a one-line Phase 45E note.
- `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 45A request /
  handoff (PR #160). Gains a one-line Phase 45E note.
- `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` — Phase 44D runner
  acceptance / next-lane gate (PR #159). Gains a one-line Phase 45E note.
- `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — Phase 44B reducer
  acceptance / next-lane gate (PR #157). Gains a one-line Phase 45E note.
- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains a
  one-line Phase 45E note in its cross-references.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 45E cross-reference note.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted Phase 45E addendum; §7 (live-memory-admission gates) and §8
  (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45E, and
`../loa-dixie` is not editable from this repo / task**):

- `../loa-dixie/docs/admission-wedge/fixtures/` — Dixie Phase 33C draft v0
  probes + validator + README (PR #120); the external evidence this decision
  reconciles against. Read only; not modified.
- `../loa-dixie/docs/ADMISSION-WEDGE-FIXTURE-PROBE-ALIGNMENT-DECISION.md` —
  Dixie Phase 33B fixture/probe ownership decision (PR #119). Read only.
- `../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md` — Dixie Phase 33A
  contract response / acceptance gate (PR #118). Read only.
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer whose 17
  reason codes §7 reconciles. Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner whose labels a future
  Phase 45F adapter may reconcile. Unchanged here.
- `docs/admission-wedge/fixtures/validate-fixtures.mjs` — Phase 43C
  dependency-free validator; the fixture / operator-contract whose field values
  a future alignment may map. Unchanged here.
