# Admission Wedge — contract reconciliation matrix / fixture-probe alignment gate

> **Phase 45D** (docs / decision · docs-planning only). Date: 2026-06-03.
> Companion to `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`
> (Phase 45C reconciliation — the narrative reading this matrix makes
> precise), `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 45A
> request / handoff), `docs/admission-wedge/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`
> (Phase 44D runner acceptance / next-lane gate),
> `docs/admission-wedge/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` (Phase 44B reducer
> acceptance / next-lane gate), `docs/admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md`
> (Phase 43B design — §F packet shapes, §D invariant, §H / §I / §J proof
> obligations), `docs/admission-wedge/fixtures/README.md` (Phase 43C
> fixture / operator-contract), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything
> this matrix points toward).
>
> This document is a **reconciliation matrix** — a Freeside Characters-side
> field-level reading of the Dixie Phase 33A contract response against the
> local proof stack. It converts the Phase 45C narrative reconciliation
> into explicit tables. It is **not** Dixie implementation, **not** Freeside
> Characters implementation, **not** the live admission contract, and
> **not** a claim that any Dixie admission contract is frozen or that a live
> admission route exists. It implements nothing in any repo.
>
> No source, test, fixture JSON, package, lockfile, config, CI, or
> generated change is introduced here; no runtime Discord behavior; no
> Discord command; no live Dixie admission route; no Straylight store; no
> admission path; no memory write; no storage; no network call. It does
> **not** rename any fixture label, **does not** mutate any reducer reason
> code, and **does not** freeze a final schema. If a step seems to require
> reaching past these boundaries, the answer is to open the separate later
> gate that owns it (decision-map §7 / §8) — not to relax it from this
> matrix.

---

## 1. Phase title and status

**Phase 45D — Admission Wedge contract reconciliation matrix / fixture-probe
alignment gate.**

- Phase 45D is a **Freeside Characters-side docs / decision · docs-planning
  artifact only.** It produces this matrix and the smallest possible
  cross-reference back-notes in the docs named in §16. It introduces no
  source, test, fixture JSON, package, lockfile, config, CI, or generated
  change.
- Phase 45D **follows Freeside Characters Phase 45C / PR #162** (Dixie
  response reconciliation) **and Dixie Phase 33A / PR #118** (Admission
  Wedge contract response / acceptance gate). It reads both as evidence and
  records the field-level reconciliation Phase 45C's §10 authorized it to
  enumerate.
- Phase 45D **does not implement fixture changes, reducer changes, runner
  changes, runtime changes, a live route, a command, storage, auth, or
  public UX.** The fixtures, reducer, and runner it reconciles remain
  exactly as Phase 43C / 44A / 44C landed them.
- Phase 45D **does not freeze the final schema.** Dixie Phase 33A accepted
  the *need* for a contract and a provisional **draft v0** vocabulary; it
  explicitly did **not** freeze a production schema. This matrix preserves
  that: every local fixture / reducer / runner label remains a valid
  **local proof label** until a separately-authorized fixture / probe
  alignment implementation changes it, and the canonical live vocabulary is
  owned upstream (Straylight), not by Freeside Characters.

---

## 2. Decision source chain

This matrix is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder plus the Dixie Phase 33A response. **These artifacts
are evidence only; Phase 45D modifies none of them except for the small
cross-reference addenda named in §16.**

Freeside Characters:

- **Phase 43B / PR #152** — `docs/admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md`. The
  Admission Wedge MVP design: the candidate / transition / admitted /
  receipt packet shapes (§F), the core invariant (§D), and the
  non-recallability / rejection / supersession proof obligations
  (§H / §I / §J).
- **Phase 43C / PR #155** — `docs/admission-wedge/fixtures/`. The
  fixture / operator-contract proof: a deterministic candidate → transition
  → admitted → recall-proof graph plus a dependency-free validator.
- **Phase 44A / PR #156** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`). The fixture-bound reducer / adapter: a pure,
  dependency-free local reducer that proves the §D invariant *in code* with
  stable fail-closed reason codes and a no-leak seal.
- **Phase 44B / PR #157** —
  `docs/admission-wedge/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`. The reducer
  acceptance / next-lane gate. Accepted Phase 44A; selected Phase 44C.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: reads the
  Phase 43C fixtures and calls the Phase 44A reducer to print operator-safe
  summaries.
- **Phase 44D / PR #159** —
  `docs/admission-wedge/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`. The runner
  acceptance / next-lane gate. Accepted Phase 44C; selected Phase 45A.
- **Phase 45A / PR #160** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`. The Dixie-side contract
  request / handoff: summarizes the proof stack, carries the §D invariant,
  and enumerates the A–J contract decisions for the Dixie / Straylight
  owners to define or accept *later*.
- **Phase 45C / PR #162** —
  `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`. The Dixie
  response reconciliation: reads Dixie Phase 33A against the Phase 45A
  request and the local proof stack at the narrative level, and selects
  Phase 45D (this matrix) as the conservative next lane.

Dixie:

- **Phase 33A / PR #118** —
  `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`. The Dixie-side
  Admission Wedge contract response / acceptance gate: a code-inspection-
  grounded, docs-only response to the Phase 45A request. It records what
  Dixie is willing to **own**, what it will **defer**, and what it
  explicitly **blocks**, accepts the *need* for a future contract and a
  provisional **draft v0** vocabulary, and explicitly does **not** freeze a
  production schema or implement a route. It is the evidence this matrix
  consumes.

Phase 45D inherits the Phase 45C authority boundary verbatim (its §10): it
may *author a reconciliation matrix* and *classify the next lane*; it may
**not** authorize production admission, public remember-this, Discord
message-history ingestion, a live Dixie admission route, or a full
production Straylight admission / storage / auth / consent architecture, and
it may **not** decide on Dixie's behalf.

> **Cross-repo phase-numbering note.** Dixie's response opens the Dixie `33`
> series (`33A`), distinct from any Freeside Characters `33A` and from the
> Freeside Characters `43B–45D` Admission Wedge sequence. Dixie `33A` and
> the Freeside Characters phases are independent labels in separate
> repositories and must not be conflated; Dixie's §9 lists cross-repo phase
> numbering as an open reconciliation item, and this matrix does not resolve
> it.

---

## 3. Purpose of this gate

- **Phase 45C reconciled the Dixie response at the narrative level.** It
  summarized what Dixie accepted and blocked, restated the invariant as
  accepted by both sides, recorded the §6 vocabulary direction, and walked
  each A–J area's Freeside Characters implication in prose.
- **Phase 45D converts that reconciliation into an explicit matrix.** Where
  Phase 45C said "may later need a contract fixture / probe alignment pass,"
  this matrix enumerates *which* labels, *which* fields, and *which*
  contract areas — and pins each to a status and a future action.
- **The matrix identifies:**
  - local Freeside Characters **proof labels** (§5);
  - the likely **Dixie / Straylight-aligned** terminology (§5);
  - **field / shape mismatches** between the local fixtures / reducer and
    the Dixie Phase 33A direction (§6);
  - whether the current local fixtures **remain valid as proof fixtures**
    (§8);
  - whether **future fixture-probe alignment** is needed, and where (§6, §7);
  - what **can change later** and what **must not change** without a new
    gate (§8, §9).
- **Phase 45D does not make any of those changes.** It is the map, not the
  move. Every "future action" cell names work for a *separately authorized*
  later phase; nothing in this document authorizes that work.

---

## 4. Preserved invariant

The load-bearing invariant, carried unchanged from Phase 43B §D / Phase 45A
§4 / Phase 45C §5 and accepted by Dixie Phase 33A §4. **Reconciliation work
changes names and field shapes; it never relaxes this invariant.**

- **candidate memory is not admitted memory** — a candidate and an admitted
  assertion are distinct states; a candidate that exists is still only a
  proposal;
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
  includes only the corrected active assertion** — the prior superseded
  state remains available for audit / provenance but is excluded from
  ordinary recall;
- **fail-closed paths do not leak raw candidate / private payload** — on any
  error, rejection, or malformed input, the public response carries a stable
  reason code and a safe summary only, never the raw candidate body, private
  sentinels, internal store text, or operational identifiers.

This invariant is **accepted by both sides**:

- the **Freeside Characters local proof stack** proves it *in code* and
  mechanically (the Phase 43C validator across the fixture graph, the Phase
  44A reducer over already-parsed fixture objects with stable fail-closed
  reason codes and a no-leak seal, the Phase 44C runner's operator-safe
  summaries);
- the **Dixie Phase 33A response** accepts it as a standing requirement any
  future Dixie Admission Wedge contract must preserve, independent of
  implementation, framed as an admission-side extension of the Recall Wedge
  posture already in force on the Dixie side.

The invariant is the stable cross-repo anchor. Every reconciliation cell
below is a question about *naming and shape* — never about whether the
invariant holds.

---

## 5. Vocabulary reconciliation matrix

This extends the Phase 45C §6 table to a per-label disposition. The
"Dixie / Straylight-aligned direction" column restates Dixie Phase 33A §6 /
§6.1 verbatim-in-substance; it is the canonical *direction*, not a frozen
name.

**Status legend (per-row reconciliation disposition):**

- `keep-local-proof-label-for-now` — the label is a real local proof label
  and stays exactly as landed; reconciliation is deferred.
- `reconcile-before-live-contract` — the label carries a semantic nuance or
  collision that must be resolved before any live contract, not merely
  renamed.
- `likely-canonical-alignment-needed` — Dixie §6.1 already names the
  canonical equivalent; the local label will most likely map to it.
- `needs-Dixie-confirmation` — no canonical equivalent is settled; the
  direction awaits a Dixie-authored fixture / probe.
- `no-live-schema-yet` — backdrop on every row: no live schema is frozen, so
  nothing changes now.

**Backdrop on every row:** `no-live-schema-yet` and
`keep-local-proof-label-for-now` apply universally in Phase 45D — *nothing
in this matrix renames or mutates anything.* The per-row Status column
records the *reconciliation disposition* a future, separately-authorized
alignment phase would act on.

| Local proof label | Local current location / usage | Dixie / Straylight-aligned direction (Dixie §6 / §6.1) | Status | Future action | Notes / risk |
|---|---|---|---|---|---|
| `candidate_pending` | Phase 43C candidate fixtures (`admission_state` value); Phase 44A reducer candidate-classification gate | adopt canonical `AssertionStatus` **`proposed`**; do not mint `candidate_pending` | likely-canonical-alignment-needed | map `candidate_pending` → `proposed` at a future fixture/probe alignment | candidate-state vocabulary; draft v0 only |
| `admitted` | Phase 43C admitted fixtures (`admission_state` value) | the **act** = audit event `assertion_admitted` + transition `admit_assertion`; the resulting **status** is canonical `active` — there is **no bare `admitted` status** upstream | likely-canonical-alignment-needed | split the act (event/transition names) from the status (`active`); retire `admission_state = admitted` as a compound proof-shape | **risk:** `admitted` reads like a status but no `admitted` status exists upstream |
| `rejected` | Phase 43C transition fixtures (`admission_decision` value); proof-003 `considered_admission_state` | no canonical status; nearest is the audit event **`transition_denied`** (a denied `admit_assertion`) | likely-canonical-alignment-needed | re-anchor on `transition_denied`; do not invent a parallel `rejected` status | rejection-family vocabulary |
| `candidate_not_admitted` | Phase 44A reducer success reason code (before-admission exclusion); proof-001 `exclusion_reason` | nearest canonical = **`transition_denied`**; Dixie flags a **3-way synonym collision** with `rejected` / `candidate_rejected` | reconcile-before-live-contract | resolve the synonym set **and** decide whether "pending, not yet decided" deserves a distinct code from "denied" | **risk:** semantically this is *pending* (never decided), not *denied*; collapsing it to `transition_denied` would erase the pending-vs-denied distinction — flag explicitly |
| `candidate_rejected` | Phase 44A reducer success reason code (rejected exclusion); proof-003 `exclusion_reason` | synonym of `rejected`; collapse to **`transition_denied`** | likely-canonical-alignment-needed | collapse to `transition_denied` | part of the 3-way synonym collision (`rejected` / `candidate_not_admitted` / `candidate_rejected`) |
| `superseded` | Phase 43C admitted fixtures (`assertion_status` **and** `admission_state` value on `assn-010`) | **exact canonical match**: `AssertionStatus` **`superseded`** — Straylight-owned, audit-only prior state | keep-local-proof-label-for-now | adopt as-is at live contract; cite Straylight as owner (not a Freeside / Dixie coinage) | lowest-risk row — already canonical |
| `corrected_active` | Phase 45A proposal label (the corrected assertion is carried as `admission_state = admitted` / `assertion_status = active`) | no `corrected` status; express as the (`superseded` → `active`) transition **pair** | likely-canonical-alignment-needed | express as the (superseded, active) pair, not a status | corrected active = status `active` + a supersede link |
| `admitted_active_assertion` | Phase 44A reducer success reason code (inclusion); proof-002 / proof-004 `inclusion_reason` | redundant compound — reconcile to canonical **`active`** | likely-canonical-alignment-needed | rename the inclusion reason toward `active` (or keep as a local inclusion reason that *maps to* `active`) | redundant compound of `active` |
| `corrected_active_assertion` | Phase 44A reducer success reason code (supersession inclusion); runner `supersession_corrected_only` outcome | verbose synonym of `corrected_active`; same (`superseded`, `active`) reconciliation | likely-canonical-alignment-needed | same as `corrected_active` | **note:** the reducer/runner emit `corrected_active_assertion` for the supersession inclusion, while proof-004's JSON `inclusion_reason` is `admitted_active_assertion` — a local label divergence to settle during alignment |
| `superseded_not_ordinary_recallable` | Phase 44A reducer success reason code (superseded-prior exclusion from ordinary recall) | express as `superseded` **plus a recallability signal** (`forgotten_from_recall` / `RecallUseInstruction`), not a compound literal | likely-canonical-alignment-needed | decompose into the `superseded` status + a recallability signal | compound literal; the signal vocabulary is Straylight-owned |
| `unsupported_admission_shape` | **Proposal-only** label (Phase 45A §7 / Dixie §6 draft-v0 list). **Does NOT appear in the reducer** — the reducer's real shape-failure code is `unsupported_fixture_shape` (next row) | refusal-side analogues **`ingress.invalid_request`** / **`seam.class_validation_failed`**; new to the admission direction | needs-Dixie-confirmation · no-live-schema-yet | name after the existing ingress / class-validation refusal family at a live contract | **risk:** this is a *draft-v0 proposal term only*, not an emitted code — do not assume it exists in code |
| `unsupported_fixture_shape` | Phase 44A reducer **real emitted** fail-closed code (one of 17) | same refusal family as the proposal `unsupported_admission_shape`: **`ingress.invalid_request`** / **`seam.class_validation_failed`** | keep-local-proof-label-for-now | reconcile this fixture-scoped name to the ingress / class-validation refusal family later | **the real local code**; `unsupported_admission_shape` (prior row) is the proposal-only name for the same concern |
| `unsafe_candidate_payload_projection` | Phase 44A reducer **real emitted** fail-closed code (no-leak seal); paired in code with `unsafe_private_sentinel_projection` | ground in the existing Dixie **no-leak** posture (Phase 32K projection-safety), not a third naming style | keep-local-proof-label-for-now | ground in the no-leak vocabulary at a live contract | the reducer also emits a sibling `unsafe_private_sentinel_projection`; both are no-leak fail-closed codes |

Important qualifications:

- **Final names are not frozen.** Dixie §6 is explicit that the draft v0 set
  is provisional and that final naming must reconcile with the canonical
  Straylight vocabulary; nothing above is a frozen contract.
- **This matrix renames nothing.** No fixture label is renamed and no
  reducer reason code is mutated in this PR. The Status / Future-action
  columns describe a *separately-authorized* later phase's work.
- **Freeside Characters does not own this vocabulary.** Dixie is a
  *non-owning consumer* of the assertion-lifecycle vocabulary, and Freeside
  Characters is a frame over the substrate — neither coins the canonical
  lifecycle names. **Straylight / Dixie vocabulary governs the live
  contract;** where Straylight already has a better-established name, the
  canonical name wins.
- **Current local labels remain valid local proof labels.** They stay
  exactly as Phase 43C / 44A landed them until a separately-authorized
  fixture / probe alignment implementation explicitly changes them.

---

## 6. Field / shape reconciliation matrix

Per-field disposition of the local fixture / reducer fields against the
Dixie Phase 33A §5.A–§5.J direction. **No field is added, renamed, removed,
or re-typed here** — this is a map of where a future, separately-authorized
fixture / probe alignment would need to look.

**Alignment-status legend:** `aligned` (shape & posture match the Dixie
direction; values may still be synthetic), `align-on-naming` (concept
matches; the local name or value vocabulary will likely reconcile),
`gap` (a field the Dixie direction expects is absent or only a
placeholder / prose note locally), `mismatch` (the local value is not drawn
from the canonical vocabulary the Dixie direction names).

### 6.1 Candidate fields (`candidate_memory_packet`)

| Local fixture/reducer field | Local usage | Dixie Phase 33A direction | Alignment status | Future probe needed? | Notes |
|---|---|---|---|---|---|
| `candidate_id` | short fixture id (`cand-001`) | candidate id must be **service-safe and idempotent** — a stable key that coalesces retries | align-on-naming | yes | local id is a fixture id, not a service-issued idempotency key (§9.6) |
| `actor_id` | synthetic `freeside-characters:shared-substrate` | tenant/estate/**actor** binding derived authoritatively from the authenticated session, not caller-supplied | aligned (shape) | yes | local value is synthetic operator/dev, not session-derived; binding-source decision is open |
| `estate_id` | synthetic `estate-operator-dev-001` | **tenant / estate binding required**, session-derived | aligned (shape) | yes | synthetic estate; not a production tenant |
| `source_kind` | `reviewed_deterministic_operator_fixture` | source kind/ref **public-safe or audit-only-separated** | aligned | maybe | confirm the public-safe vs audit-only split at a live contract |
| `source_ref` | fixture path string | if a source ref could leak private material it belongs on the **audit boundary** | aligned | yes | fixture path is public-safe today; decide audit-only separation |
| `proposed_assertion_class` | `observation` / `preference` | validate against the **canonical Straylight `AssertionClass` union** (16 members), not a parallel list | align-on-naming | yes | values are already members of the union, but there is **no validation binding** locally |
| `candidate_payload` / `candidate_text` boundary | object `{ boundary, summary_public, body_private }`; `body_private` carries a sentinel | candidate payload is **private / audit-boundary by default**; the public response must not echo it | aligned | maybe | local already partitions public summary from private body |
| `admission_state` | `candidate_pending` | begins as `candidate_pending` (draft v0) → canonical **`proposed`** | align-on-naming | yes | see §5 `candidate_pending` row |
| `visibility_class` | `candidate_never_rendered` | a **visibility / rendering class** is expected | align-on-naming | maybe | reconcile to Straylight visibility / use signals (`RecallUseInstruction`) |
| `provenance` | object `{ source_kind, source_material (sentinel), admission_authority_hint, note }` | **provenance is required** | aligned | maybe | `source_material` carries an audit-only sentinel; field-level shape may reconcile |
| idempotency key (**absent / placeholder**) | **no `idempotency_key` field**; only a prose `idempotency_note` on `trans-001` + a deterministic `admitted_assertion_id` | **idempotency expected** (header-keyed `Idempotency-Key`); candidate id service-safe and idempotent | **gap** | yes | real gap — idempotency is expressed only via a deterministic id + a prose note; key semantics are open (§9.6: candidate-id-keyed vs header-keyed vs both) |

### 6.2 Transition fields (`admission_transition`)

| Local fixture/reducer field | Local usage | Dixie Phase 33A direction | Alignment status | Future probe needed? | Notes |
|---|---|---|---|---|---|
| `transition_id` | short fixture id (`trans-001`); paired with `transition_kind` / `transition_version` | a **transition kind + version are required** | aligned | maybe | kind/version already present |
| `candidate_id` | links the transition to its candidate | transition **links candidate id → admitted assertion id** on accept | aligned | no | linkage is exactly the §B requirement |
| `admission_decision` | `accepted` / `rejected` | decision vocabulary `accepted` / `rejected` (+ later `superseded` / `corrected` as a **follow-on** transition over an already-admitted assertion) | aligned | maybe | local models supersede as an accept with `supersedes_assertion_id` (`trans-011`) — matches "follow-on transition" |
| `admission_authority` | `operator_dev_synthetic` | authority/signer/service actor required, bound to the canonical **`SignerType`** model (`actor_controller, operator, runtime, reviewer, policy_service, admin, wallet, service_key`) | **mismatch** | yes | `operator_dev_synthetic` is **not** a `SignerType` member; nearest is `operator` / `service_key`, but it is a synthetic dev authority, never an end-user (§H) |
| `admitted_assertion_id` | `assn-001`; **`null`** on reject (`trans-002`) | link on accept; **rejected mints no assertion** (null) | aligned | no | accept/reject linkage matches §B / §D |
| `reason_code` | fixture: `operator_reviewed_accept` / `operator_reviewed_reject`; reducer: 17 stable codes | **fail-closed reason codes required** for every non-accept outcome; stable reason codes | align-on-naming | yes | **two reason-code surfaces** — the fixture `transition.reason_code` and the reducer codes; both reconcile to the canonical refusal family (`ingress.*` / `seam.*` / `transition_denied`) |
| `receipt_ref` / `audit_ref` | `rcpt-001` (both equal) | a **receipt / audit record required** for every transition (accept *or* reject) | aligned (presence) | yes | local carries only a ref id, not a receipt body; receipt schema + public/audit split is open (§9.3) |
| `decided_at` | logical stamp (`fixture-logical-stamp-0002`) | a **decision time** is expected | aligned | maybe | logical stamp, deterministic, no wall-clock; confirm logical vs wall-clock at a live contract |

### 6.3 Admitted assertion fields (`admitted_memory_packet`)

| Local fixture/reducer field | Local usage | Dixie Phase 33A direction | Alignment status | Future probe needed? | Notes |
|---|---|---|---|---|---|
| `assertion_id` | `assn-001` | an **assertion id** is required | aligned | no | — |
| `assertion_class` | `observation` / `preference` | class from the canonical `AssertionClass` union | align-on-naming | yes | same validation-binding gap as `proposed_assertion_class` |
| `assertion_status` | `active` / `superseded` | **post-admission status is canonical `active`** (not a bespoke `admitted`); `superseded` is canonical | **aligned** | no | local `assertion_status` already uses canonical `active` / `superseded` — the redundant field is `admission_state = admitted`, not this one |
| `admission_state` (compound) | `admitted` / `superseded` carried alongside `assertion_status` | no `admitted` status upstream; the act is event/transition, the status is `active` | align-on-naming | yes | the `admission_state = admitted` compound is the proof-shape field to retire (see §5 `admitted` row) |
| `source_candidate_id` | `cand-001` | the **source candidate id** is required | aligned | no | — |
| `admission_transition_id` | `trans-001` | the **admission transition id** is required | aligned | no | — |
| `recall_eligibility` | `eligible` / `ineligible` | a **recall eligibility** field; recall filtering keys off `AssertionStatus` + visibility / use signals | align-on-naming | yes | local is binary; canonical is richer ("eligible **under policy**" + `RecallUseInstruction`: `usable / mark_as_contested / use_as_background_only / do_not_use_for_action`) |
| `visibility_class` | `public_safe_summary` / `superseded_audit_only` | a **visibility / rendering class** is expected | align-on-naming | maybe | reconcile to Straylight visibility / use signals |
| `provenance` | object | **provenance** / audit links expected | aligned | maybe | field-level shape may reconcile |
| `admitted_at` | logical stamp | a **decision time** is expected | aligned | maybe | logical stamp; confirm at a live contract |

### 6.4 Recall proof fields (`admission_recall_proof`)

| Local fixture/reducer field | Local usage | Dixie Phase 33A direction | Alignment status | Future probe needed? | Notes |
|---|---|---|---|---|---|
| `included_assertion_ids` | `["assn-001"]` | admitted active assertion is **recall eligible under policy** | aligned | no | — |
| `excluded_candidate_ids` | `["cand-001"]` | `candidate_pending` is **not** recall eligible | aligned | no | — |
| `excluded_assertion_ids` | `["assn-010"]` | superseded is **excluded from ordinary recall** | aligned | no | — |
| `exclusion_reason` / `inclusion_reason` | `candidate_not_admitted` / `candidate_rejected` / `admitted_active_assertion` | reconcile to canonical (`transition_denied` / `active`) | align-on-naming | yes | see §5 vocabulary rows |
| `rendered_candidate_payload` | boolean, always `false` | the public response **must not echo the payload** | aligned | no | load-bearing no-leak boolean |
| `audit_links` | object `{ source_candidate_id, admission_transition_id, admission_receipt_ref, … }` | candidate ref + receipt ref live on the **audit boundary** | aligned | yes | confirm the audit-only boundary at a live contract |
| safe summary fields (`public_summary` / `summary_public`) | public-safe one-liners | **safe public summaries** | aligned | no | — |

### 6.5 Public / private boundary fields

| Local field / concern | Local usage | Dixie Phase 33A direction | Alignment status | Future probe needed? | Notes |
|---|---|---|---|---|---|
| candidate payload | `candidate_payload.body_private` (sentinel) | private / audit-boundary, **never echoed** | aligned | no | posture set by the reducer no-leak seal + validator |
| raw source material | `provenance.source_material` (`SOURCE_SENTINEL`) | audit-only; **no source-material leakage** | aligned | no | — |
| private sentinels | `CANDIDATE_` / `SOURCE_` / `ADMITTED_` / `SUPERSEDED_PRIVATE_SENTINEL_*` | **no private sentinels** on the public wire | aligned | no | reducer seal + validator both scan for these |
| audit-only details | `audit_links`, receipt body | a **clear private / audit-only boundary** | align-on-naming | yes | local models presence only; field-level public/audit split is open (§9.3 / §9.10) |
| public-safe reason codes | reducer's 17 stable codes | **stable reason codes** | align-on-naming | yes | reconcile to the canonical refusal family |
| public-safe summaries | `summary_public` / `public_summary` | **safe public summaries** | aligned | no | — |

---

## 7. Contract area alignment matrix (A–J)

The ten contract areas from the Phase 45A request, as answered by Dixie
Phase 33A §5. Every "Local proof status" is a *semantic* alignment of the
existing fixtures / reducer / runner; every "Future action" is work for a
*separately authorized* later phase. **Blocking status is uniform: no live
implementation is authorized — docs-planning only.**

| Area | Dixie response (Phase 33A §5) | Local proof status | Mismatch / unknown | Future action | Blocking status |
|---|---|---|---|---|---|
| **A. Candidate intake envelope** | version + kind discriminator; session-derived tenant/estate/actor binding; service-safe idempotent candidate id; public-safe-or-audit-separated source; `AssertionClass`-validated class; private payload never echoed; `candidate_pending` → `proposed`; required provenance; header-keyed idempotency; fail-closed on malformed. Route name/method deferred (open §9.1). | aligned semantically (43C candidate fixtures + 44A classifier) | idempotency **key** absent (gap, §6.1); `proposed_assertion_class` unvalidated; `candidate_pending` → `proposed` naming | fixture/probe alignment: add idempotency-key semantics, validate class against `AssertionClass`, reconcile `candidate_pending` | blocked — docs-planning only |
| **B. Explicit admission transition** | transition kind + version; `accepted`/`rejected` (+ later `superseded`/`corrected` follow-on); `SignerType`-bound authority; policy vs structural validation split; candidate→assertion link on accept; no mint on reject; receipt per transition; fail-closed reason codes. | aligned semantically (44A: accept mints exactly one linked assertion; reject mints none; broken linkage fails closed) | `admission_authority` not a `SignerType` member (mismatch, §6.2); local single-stage shape vs structural-vs-policy split | bind `admission_authority` → `SignerType`; reconcile structural-vs-policy boundary | blocked — docs-planning only |
| **C. Admitted assertion shape** | assertion id; actor/estate/tenant binding; class + status; source candidate id; transition id; recall eligibility; provenance; visibility class. Post-admission status is canonical `active` (not bespoke `admitted`); align with Recall Wedge. | aligned semantically; `assertion_status` already canonical `active`/`superseded` | `admission_state = admitted` compound is redundant vs canonical `active` (align-on-naming) | retire the `admitted` compound; defer field names to Straylight assertion types | blocked — docs-planning only |
| **D. Rejection transition** | rejected candidate stays non-recallable; reject mints no assertion; rejection receipt/audit required; canonical anchor is the audit event `transition_denied` (not a bespoke `rejected` status); appeal/correction deferred. | aligned (`trans-002` rejects `cand-002`, mints nothing; `proof-003` excluded permanently) | `rejected` / `candidate_rejected` → `transition_denied` (align-on-naming); `candidate_not_admitted` pending-vs-denied nuance (reconcile) | re-anchor rejection labels on `transition_denied`; resolve the 3-way synonym + pending-vs-denied distinction | blocked — docs-planning only |
| **E. Supersession / correction transition** | references both superseded + corrected; ordinary recall includes only corrected active; superseded prior is audit/provenance only (canonical `superseded`); "corrected active" = `active` + supersede link (not a new status); forget/revoke/correction UI out of scope. | aligned (`trans-011` accepts `cand-011` as `assn-011`, supersedes `assn-010`; recall returns only the corrected active; supersedes link preserved for audit) | `corrected_active` / `corrected_active_assertion` → (`superseded`, `active`) pair; proof-004 inclusion-reason label divergence (§5) | express correction as the canonical transition pair; settle the inclusion-reason label | blocked — docs-planning only |
| **F. Admission receipt / audit fields** | receipt id; decision time; service/authority actor; policy decision reason; candidate ref; admitted/rejected/superseded ref; recall eligibility result; public-safe summary; clear private/audit boundary; no raw payload public. Mirrors Recall Wedge receipt posture. | partial — local carries the receipt only as an **audit-link presence boolean / ref id**, not a field-level public/audit model | exact public-safe vs audit-only field split is **unknown** (Dixie §9.3 / §9.10 open) | decide which receipt fields are public-safe vs audit-only at a future alignment | blocked — docs-planning only |
| **G. Recall eligibility boundary** | `candidate_pending` not eligible; admitted active eligible under policy; rejected (`transition_denied`) not eligible; superseded not ordinary-recall eligible; corrected active eligible. Challenged/revoked/forgotten deferred (reuse `contested`/`revoked`/`forgotten_from_recall`). | aligned — 43C recall proofs + 44A `projectAdmissionRecallProof` already encode exactly this exclusion/inclusion boundary | `recall_eligibility` is binary locally vs canonical "eligible under policy" + `RecallUseInstruction` (align-on-naming) | reconcile binary eligibility → policy + use-instruction signals | blocked — docs-planning only |
| **H. Service auth vs end-user authorization** | service-to-service auth is **not** end-user consent; a dev/operator token proves a service seam only; session-derived tenant/estate binding; production end-user consent/authorization **blocked**; no production consent mechanism exists. | aligned — local seams are synthetic operator/dev authority only (`operator_dev_synthetic`); the proof claims **no** end-user authorization | none — the local proof correctly claims no end-user auth; `admission_authority` naming still reconciles to `SignerType` (§6.2) | none for auth posture; bind authority naming only | blocked — no production auth/consent |
| **I. Storage / admission non-goals** | no production storage claim (only an in-process, non-durable recall store; no admission store at all); no Discord chat ingestion; no public `remember-this`; no chat-becomes-memory; no cross-user sharing; no live writes; no production auth/consent solved. | aligned — symmetric with the Freeside-side §10 blocked list; the resting state is the local proof stack + this matrix | none — non-goals are mutually preserved | none (preserve non-goals) | blocked — all non-goals preserved |
| **J. No-leak public response** | stable reason codes; safe summaries; no raw payload; no private sentinels; no debug body; no stack traces; no operational secrets/IDs; no source-material leakage; fail-closed on malformed. **Decide the admission public/audit split explicitly** rather than inherit the recall `raw_reasons` split. | aligned — the 44A `scanForUnsafeProjection` seal + 44C output seal refuse sentinels, long ids, hex addresses, URLs, PEM keys on every safe projection; the 43C validator greps recall proofs for sentinels | the live **public / audit split** is an explicit open Dixie decision (§9.10), not inherited | decide the admission public/audit split at a future contract (Dixie-owned) | blocked — docs-planning only |

---

## 8. Decision: what remains valid now

The following remain valid as **local proof artifacts** and are unchanged by
Phase 45D:

- the **Phase 43C fixture graph** (candidate → transition → admitted →
  recall-proof, plus the dependency-free validator) — a mechanically
  checkable proof of the §D invariant;
- the **Phase 44A reducer behavior** — the §D invariant proven in code with
  17 stable reason codes and a no-leak seal;
- the **Phase 44C runner summaries** — operator-safe scenario summaries over
  the five Admission Wedge scenarios;
- the **current local reason labels** — every fixture field value and every
  reducer reason code remains a valid **local proof label**;
- the **current no-leak / fail-closed posture** — the reducer seal, the
  runner output seal, and the validator's sentinel grep.

**None of these is final live Dixie schema.** They are fixture-bound,
design-level doctrine. The canonical live vocabulary and the live contract
shape are owned upstream (Straylight) and remain unfrozen. The matrix above
records the *direction* of a future reconciliation; it changes none of these
artifacts.

---

## 9. Decision: what must not change yet

Until a separate phase explicitly authorizes it:

- **Do not rename local fixture labels yet** (`candidate_pending`,
  `admitted`, `rejected`, `superseded`, … stay as landed).
- **Do not mutate fixture JSON yet.**
- **Do not change reducer reason codes yet** (the 17 codes stay as landed).
- **Do not export package surfaces yet** (the reducer / runner stay
  imported only by their own tests + the local CLI guard).
- **Do not add a live Dixie client or admission-route client yet.**
- **Do not add a Discord command or `/remember-this`.**
- **Do not add storage / auth / consent implementation.**

Phase 45D is a map. Acting on any cell above is a *separate* phase's work
behind its own gate.

---

## 10. Next-lane options

The candidate next options, classified. Phase 45D authorizes **none** as
implementation; it ranks them so the selection in §11 is explicit.

- **Option A — Freeside Characters fixture-probe alignment implementation.**
  Possible later. Would be a docs + fixture / test / reducer-adapter update
  only (apply the §5 / §6 directions to local fixtures or adapter tests
  under the canonical naming direction). **Not authorized by Phase 45D**
  unless explicitly selected for a later phase under its own gate.
- **Option B — Dixie Phase 33B fixture / probe alignment. *Strong
  candidate.*** Dixie's §10 lists a future Phase 33B that would record
  candidate / admission fixtures and **align them with the existing Freeside
  Characters Phase 43C fixtures** against the accepted draft v0 vocabulary.
  Because Dixie / Straylight own the canonical vocabulary, Dixie may be the
  better owner of the *first canonical contract probe*. This would keep
  Freeside Characters waiting until a Dixie-authored fixture / probe exists,
  so the Freeside-side alignment reconciles against a canonical shape rather
  than a guess.
- **Option C — Freeside Characters no-op contract adapter / validator.**
  Possible later, after this matrix. Could validate local fixture shapes
  against a *provisional* Dixie-style contract without a live route or
  storage writes — still no runtime wiring. Mirrors Dixie's own listed (but
  unauthorized) Phase 33C no-op validator idea.
- **Option D — live route / client path. *Blocked.*** Requires accepted
  contract fixtures, storage / auth decisions, and separate gates (Dixie
  §9). Not reachable from here.
- **Option E — dev / operator candidate command. *Blocked.*** Requires live
  route / storage / auth / consent boundaries and a separate gate. Must
  **not** be conflated with a public `/remember-this`.
- **Option F — stop and preserve the proof.** Available — the local proof
  stack plus this matrix is a stable resting state.

---

## 11. Selected next lane

**Phase 45E — Admission Wedge fixture-probe alignment decision / Dixie-first
handoff (docs / decision or docs / cross-repo handoff only).**

Phase 45D selects a **conservative, non-implementing** next lane: a future
Freeside Characters-side **decision** about *who* should produce the first
canonical contract fixture / probe — Dixie Phase 33B (Option B) or a
later Freeside-local no-op adapter / alignment (Options A / C) — and a
refinement of this matrix into exact future implementation requirements.

The matrix points toward a **Dixie-first** posture: Dixie / Straylight own
the canonical vocabulary, Dixie §10 already frames Phase 33B as recording /
aligning fixtures against the existing Freeside Characters Phase 43C
fixtures, and most §5 rows resolve to canonical Straylight names rather than
Freeside-coined ones. So the recommended decision Phase 45E would weigh is
**"wait for / request Dixie Phase 33B as the first canonical fixture / probe
owner, then align Freeside-locally."**

**Alternative acceptable selection:** simply **wait for Dixie Phase 33B**
(Option B) with no new Freeside Characters gate — Phase 45E is only needed if
Freeside Characters wants to *record the decision* and the minimum canonical
fixture / probe set in writing.

Phase 45D **prefers not to authorize any implementation.** It authorizes
only the bounded Phase 45E scope in §12 — and Phase 45E, when opened, would
itself be a docs / decision or cross-repo handoff, not a build.

---

## 12. Future Phase 45E authorization boundaries

If Phase 45E is opened, it is authorized only as a future **docs / decision
or docs / cross-repo handoff** artifact.

**Allowed future Phase 45E scope:**

- **decide Dixie-first vs Freeside-local** fixture-probe implementation
  ownership;
- **refine this matrix** into exact future implementation requirements;
- **identify the minimum canonical contract fixture / probe set** needed for
  a first alignment;
- **no code is required** — it is a decision / handoff.

**Explicitly NOT authorized for Phase 45E:**

- source changes — unless Phase 45E explicitly authorizes a later
  implementation under its own gate;
- fixture JSON mutation — unless separately authorized;
- reducer mutation — unless separately authorized;
- runner mutation — unless separately authorized;
- a live route;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord history ingestion;
- user chat becoming memory;
- storage writes;
- production auth / consent;
- network calls;
- package exports;
- public renderer changes;
- dispatch / startup / command-registration changes;
- LLM / voice;
- Finn production wiring.

Phase 45E, when opened, is a decision / handoff gate — not a build. If it
needs any item above, it must open the gate that owns it (decision-map
§7 / §8) — Phase 45D authorizes none of them.

---

## 13. What remains blocked now

Repeated clearly so a future reader does not over-read this matrix. None of
the following is implemented, authorized, or claimed by Phase 45D (and none
was unblocked by Dixie Phase 33A or by Phase 45C):

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
- a final schema freeze.

A reconciliation matrix is not implementation. This doc reads the evidence
and maps the reconciliation; it decides nothing on Dixie's behalf, and an
accepted *need* for a contract is not an accepted contract. If a later phase
needs any item above, it must open the gate that owns it (decision-map
§7 / §8).

---

## 14. Success criteria for Phase 45D

This Phase 45D artifact succeeds if **all** of the following hold:

- it gives a **precise reconciliation matrix** (§5 vocabulary, §6
  field / shape, §7 A–J);
- it **identifies the vocabulary mismatches** — including the 3-way
  `rejected` / `candidate_not_admitted` / `candidate_rejected` synonym
  collision and the proposal-only-vs-emitted distinction between
  `unsupported_admission_shape` and `unsupported_fixture_shape`;
- it **identifies the field / shape mismatches** — including the missing
  idempotency key (§6.1) and the `admission_authority` → `SignerType`
  mismatch (§6.2);
- it **preserves the local proof stack** (§8) — fixtures, reducer, runner,
  and labels are unchanged;
- it **does not mutate fixtures or code**;
- it **does not freeze the final schema**;
- it **does not authorize runtime implementation** in any repo;
- a **Codex / review audit confirms docs / decision-only · docs-planning-only
  scope.**

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
  — proving the matrix introduced no live-egress regression;
- a forbidden-claim scan finds no hits except negated blockers (this
  document claims no public remember-this, no Discord history ingestion, no
  chat-becomes-memory, no production admission, no production storage, no
  production auth / consent, no Finn production wiring, no live Dixie
  admission route, no authorized package export, no frozen final schema, and
  no Freeside Characters ownership of the Dixie / Straylight vocabulary);
- the artifact carries **no raw IDs / secrets / tokens / URLs / screenshots /
  binary evidence**.

---

## 15. Naming rules

Preserved verbatim from Phase 43B §B.1 / 43C / 44B / 44D / 45A / 45C;
binding for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  app / repo (the Discord app, the Railway project and service that runs the
  bot). The current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only
  and is out of scope for this matrix.
- **"Dixie"** / **`loa-dixie`** is the deployed cross-repo intake /
  control-plane service (the Recall Wedge service today; the candidate
  future live admission intake / control-plane owner).
- **"Straylight"** is the canonical primitive / substrate owner where
  applicable — the memory / continuity substrate that owns the canonical
  admission / estate / receipt / assertion-lifecycle semantics and
  vocabulary.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired.
- Do **not** imply a **Dixie admission route** exists. Dixie exposes only a
  read-only, default-off, fail-closed recall route today; it has no
  admission route, no admission concept in route code, and no production
  storage.
- Do **not** imply the **final contract schema is frozen.** Dixie accepted
  the need for a contract and a provisional draft v0 vocabulary; it froze no
  production schema.

---

## 16. Cross-references

Minimal status / cross-reference back-notes are added to the docs below
(small addenda only; the old docs are not rewritten):

- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md` — Phase 45C
  reconciliation. Gains a one-line Phase 45D note that this matrix makes its
  §6 / §7 reconciliation precise.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 45A request /
  handoff (PR #160). Gains a one-line Phase 45D note.
- `docs/admission-wedge/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` — Phase 44D runner
  acceptance / next-lane gate (PR #159). Gains a one-line Phase 45D note.
- `docs/admission-wedge/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — Phase 44B reducer
  acceptance / next-lane gate (PR #157). Gains a one-line Phase 45D note.
- `docs/admission-wedge/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains a
  one-line Phase 45D note in its cross-references.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 45D cross-reference
  note.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted Phase 45D addendum; §7 (live-memory-admission gates) and
  §8 (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45D**):

- `../loa-dixie/docs/admission-wedge/ADMISSION-WEDGE-CONTRACT-RESPONSE.md` — Dixie Phase 33A
  contract response / acceptance gate (PR #118); the external evidence this
  matrix consumes. Read only; not modified (and not editable from this
  repo / task).
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer whose
  17 reason codes §5 reconciles. Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner whose labels a
  future Phase 45E / alignment may reconcile. Unchanged here.
- `docs/admission-wedge/fixtures/validate-fixtures.mjs` — Phase 43C
  dependency-free validator; the fixture / operator-contract whose field
  values a future alignment may align. Unchanged here.
- `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — the accepted Recall
  Wedge Dixie contract-reconciliation doc (Phase 37A); the docs-level
  cross-repo-reconciliation shape this admission matrix mirrors (read only;
  unchanged here).

---

## 17. Phase 45E status note — Dixie Phase 33C probes reconciled against this matrix

> Added by Phase 45E
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md`), 2026-06-04.
> Status note only; this matrix's §1–§16 are unchanged.

The **Phase 45E** lane this matrix selected (§11) is now authored as
`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` (docs / decision
only). The Dixie-first posture it recommended has landed: Dixie **Phase 33C /
PR #120** authored the canonical **draft v0** contract probe set
(`../loa-dixie/docs/admission-wedge/fixtures/`), and Phase 45E reconciles this
matrix against it — mapping each of the five Dixie probes onto the local proof
stack and carrying forward this matrix's flagged nuances (the pending-vs-denied
distinction on `candidate_not_admitted`, the proposal-only-vs-emitted
`unsupported_admission_shape` / `unsupported_fixture_shape` split, and that
`corrected_active` is a direction, not a status). Phase 45E renames no local
fixture label, mutates no reducer reason code, freezes no schema, and does not
claim Dixie Phase 33C is production schema; it selects **Phase 45F — a narrow,
future-gated, test-only or docs / fixture-bound no-op Dixie probe adapter /
validator** as the next lane. The §13 blocked list and the decision-map
§7 / §8 gates stay in force.
