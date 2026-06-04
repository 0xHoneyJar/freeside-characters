# Admission Wedge — Dixie response reconciliation

> **Phase 45C** (docs / reconciliation only). Date: 2026-06-03.
> Companion to `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 45A
> request / handoff — the request this doc reconciles against the Dixie
> response), `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` (Phase 44D
> runner acceptance / next-lane gate), `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`
> (Phase 44B reducer acceptance / next-lane gate), `docs/ADMISSION-WEDGE-MVP-DESIGN.md`
> (Phase 43B design — the §F packet shapes, the §D invariant, and the
> §H / §I / §J proof obligations), `docs/admission-wedge/fixtures/README.md`
> (Phase 43C fixture / operator-contract), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything this
> reconciliation points toward). It mirrors the shape of the accepted
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A) on the
> admission side.
>
> This document is a **reconciliation artifact** — a Freeside
> Characters-side reading of the Dixie Phase 33A contract response against
> the Freeside Characters Phase 45A request and the local proof stack. It
> is **not** Dixie implementation, **not** Freeside Characters
> implementation, **not** the live admission contract, and **not** a claim
> that any Dixie admission contract is now frozen or that a live admission
> route exists. It implements nothing in any repo.
>
> No source, test, fixture JSON, package, lockfile, config, CI, or
> generated change is introduced here; no runtime Discord behavior; no
> Discord command; no live Dixie admission route; no Straylight store; no
> admission path; no memory write; no storage. If a step seems to require
> reaching past these boundaries, the answer is to open the separate later
> gate that owns it (decision-map §7 / §8) — not to relax it from this
> reconciliation.

---

## 1. Phase title and status

**Phase 45C — Admission Wedge Dixie response reconciliation.**

- Phase 45C is a **Freeside Characters-side docs / reconciliation artifact
  only.** It produces this reconciliation document and, where useful, the
  smallest possible cross-reference back-notes in the Phase 45A request,
  the Phase 44D runner-acceptance gate, the Phase 44B reducer-acceptance
  gate, the Phase 43B design, the Phase 43C fixture README, and the Phase
  35A decision map. It introduces no source, test, fixture JSON, package,
  lockfile, config, CI, or generated change.
- Phase 45C **reconciles Freeside Characters Phase 45A / PR #160 with Dixie
  Phase 33A / PR #118.** It reads the Dixie Phase 33A contract response as
  external evidence and records what Freeside Characters should do next in
  light of it. It changes no Dixie code and decides nothing on Dixie's
  behalf.
- Phase 45C **does not implement admission.** It admits nothing, stores
  nothing, and reaches no network. The reducer, runner, and fixtures it
  reconciles remain exactly as Phase 44A / 44C / 43C landed them.
- Phase 45C **does not authorize a live route, command, storage, public
  UX, or production behavior.** No Discord command, no dispatch / startup /
  command-registration change, no public renderer change, no package export
  change, no live client change. Live admission, a live Dixie admission
  route, production admission / storage / auth / consent, `/remember-this`,
  and public remember-this all remain blocked (§11).
- Phase 45C **does not claim a frozen final production schema.** Dixie
  Phase 33A accepted the *need* for a contract and a provisional **draft
  v0** vocabulary; it explicitly did **not** freeze a production schema.
  This reconciliation preserves that: the local fixture / reducer / runner
  vocabulary remains valid *local proof labels*, and the canonical live
  vocabulary is owned upstream (Straylight), not by Freeside Characters.

---

## 2. Source chain

This reconciliation is grounded in, and scoped entirely within, the
accepted Admission Wedge ladder plus the Dixie Phase 33A response. **These
artifacts are evidence only; Phase 45C modifies none of them except for the
small cross-reference addenda named in §14.**

Freeside Characters:

- **Phase 43B / PR #152** — `docs/ADMISSION-WEDGE-MVP-DESIGN.md`. The
  Admission Wedge MVP design: the candidate packet, admission transition,
  admitted packet, and admission receipt shapes (§F), the core invariant
  (§D), the non-recallability / rejection / supersession proof obligations
  (§H / §I / §J), and the Lane A preference (§G). Design-level doctrine,
  not an implemented schema.
- **Phase 43C / PR #155** — `docs/admission-wedge/fixtures/`. The
  fixture / operator-contract proof: a deterministic candidate →
  transition → admitted → recall-proof graph plus a dependency-free
  validator that makes the §D invariant mechanically checkable.
- **Phase 44A / PR #156** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`). The fixture-bound reducer / adapter: a pure,
  dependency-free local reducer over the Phase 43C fixtures that proves
  the §D invariant *in code* with stable fail-closed reason codes and a
  no-leak seal over every safe projection.
- **Phase 44B / PR #157** —
  `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`. The reducer
  acceptance / next-lane decision gate. Accepted the Phase 44A reducer and
  selected Phase 44C.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: reads the
  Phase 43C fixtures and calls the Phase 44A reducer to print
  operator-safe scenario summaries.
- **Phase 44D / PR #159** —
  `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`. The runner
  acceptance / next-lane decision gate. Accepted the Phase 44C runner and
  selected Phase 45A — the Dixie-side contract request / handoff.
- **Phase 45A / PR #160** —
  `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`. The Dixie-side
  Admission Wedge contract request / handoff: summarizes the proof stack,
  carries the §D invariant, and enumerates the A–J contract decisions it
  asks the Dixie / Straylight owners to define or accept *later*. It is the
  request this reconciliation answers against.

Dixie:

- **Phase 33A / PR #118** —
  `../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`. The Dixie-side
  Admission Wedge contract response / acceptance gate: a code-inspection-
  grounded, docs-only response to the Phase 45A request. It records what
  Dixie is willing to **own**, what it will **defer**, and what it
  explicitly **blocks**, accepts the *need* for a future contract and a
  provisional **draft v0** vocabulary, and explicitly does **not** freeze a
  production schema or implement a route. It is the evidence this
  reconciliation consumes.

Phase 45C inherits the Phase 43A / 43B / 44B / 44D / 45A authority boundary
verbatim: it may *author a docs reconciliation* and *classify the next
lane*; it may **not** authorize production admission, public remember-this,
Discord message-history ingestion, a live Dixie admission route, or a full
production Straylight admission / storage / auth / consent architecture, and
it may **not** decide on Dixie's behalf.

> **Cross-repo phase-numbering note.** Dixie's response opens the Dixie
> `33` series (`33A`), distinct from any Freeside Characters `33A` and from
> the Freeside Characters `43B–45C` Admission Wedge sequence. Dixie `33A`
> and the Freeside Characters phases are independent labels in separate
> repositories and must not be conflated; Dixie's §9 lists cross-repo phase
> numbering as an open reconciliation item, and this doc does not resolve
> it.

---

## 3. Reconciliation purpose

State plainly what this artifact is for, so a cross-repo reader does not
over-read it.

- **Freeside Characters made the request.** Phase 45A / PR #160 handed the
  accepted local proof stack to the Dixie / Straylight owners and asked
  them to define or accept a live admission contract *later*, enumerating
  the A–J contract decisions and a non-authoritative proposed vocabulary.
- **Dixie responded.** Phase 33A / PR #118 answered that request as a
  docs-only, code-inspection-grounded contract response / acceptance gate.
- **This doc reconciles what Freeside Characters should do next in light of
  the Dixie response.** It reads the Dixie response against the Phase 45A
  request and the local proof stack, records what aligns and what must be
  reconciled, and classifies the conservative next lane (§8 / §9).
- **Dixie accepted the need for a Dixie-side or cross-repo-owned Admission
  Wedge contract before live implementation.** The need is accepted; live
  implementation is not. Dixie also accepted a provisional **draft v0**
  vocabulary, sufficient only for *future* cross-repo fixture / probe
  alignment.
- **Dixie did not freeze a final production schema.** No field list,
  envelope, or receipt in the Dixie response is a frozen production
  contract; all are explicitly directional and subject to reconciliation
  with the existing Straylight / Dixie vocabulary.
- **Dixie did not implement a live route.** Dixie today exposes only a
  read-only, default-off, fail-closed recall route and has no admission
  route, no admission concept in route code, and no production storage.
- **Therefore Freeside Characters must not proceed directly to
  `/remember-this`, a live admission command, storage writes, or runtime
  wiring.** Because no contract is frozen and no route exists, the next
  Freeside Characters step stays at the docs / reconciliation altitude (a
  reconciliation matrix and, if separately authorized later, fixture /
  probe alignment), not at any live surface.

---

## 4. What Dixie accepted

A summary of the Dixie Phase 33A response, restated so a future reader does
not have to re-read the full Dixie artifact. (Dixie's own §7 / §8 are the
authoritative split; this is the Freeside-side reading of them.)

**Dixie accepted (its §7):**

- **the need for a Dixie-side or cross-repo-owned Admission Wedge contract
  before any live implementation** — the local Freeside proof is necessary
  but not sufficient to authorize a live admission seam; live contract
  ownership must be decided by Dixie or by cross-repo agreement first;
- **the core candidate / admitted invariant** (its §4, reconciled in §5
  here);
- **the no-leak / fail-closed posture** (its §5.J / §4.6);
- **the need to reconcile candidate / admitted / rejected / superseded
  semantics** with the Recall Wedge and the canonical Straylight vocabulary
  (its §6);
- **that a future implementation gate may be *proposed*** after contract
  reconciliation — proposed, **not** authorized.

Dixie also recorded, as a directional (not frozen) stance: that Dixie could
be the future live intake / control-plane owner for an admission route or
seam, on the same BFF posture the Recall Wedge already occupies (Dixie owns
HTTP ingress, tenant / estate binding, idempotency, refusal mapping, and
no-leak projection), while **Straylight owns the admission *semantics***
(policy resolution, signer competence, assertion lifecycle). Dixie assumes,
but does not commit to, that ownership split.

**Dixie did not accept / explicitly blocked (its §8):**

- a live admission route implementation;
- storage writes;
- production admission;
- production auth / consent;
- a public `remember-this`;
- Discord history ingestion;
- user chat becoming memory;
- a Discord command;
- Freeside Characters runtime changes;
- package exports;
- LLM / voice behavior;
- Finn production wiring;
- a forget / revoke / correction UI;
- **any claim that a final schema or production contract is already
  frozen.**

This is symmetric with the Phase 45A request: Freeside Characters asked for
a contract decision and explicitly did not authorize implementation; Dixie
accepted the need and the draft vocabulary and explicitly did not authorize
implementation either. Neither side unblocked any blocked lane.

---

## 5. Invariant reconciliation

The load-bearing invariant, carried unchanged from Phase 43B §D / Phase 45A
§4 and restated by Dixie Phase 33A §4. Its clauses:

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

This invariant is now **accepted by both sides**:

- **the Freeside Characters local proof stack** proves it *in code* and
  mechanically: the Phase 43C validator asserts it across the fixture
  graph, the Phase 44A reducer proves it over already-parsed fixture
  objects with stable fail-closed reason codes and a no-leak seal, and the
  Phase 44C runner projects it into operator-safe summaries;
- **the Dixie Phase 33A response** accepts it as a standing requirement any
  future Dixie Admission Wedge contract must preserve, independent of
  implementation, and frames it as an admission-side extension of the
  Recall Wedge posture already in force on the Dixie side (tenant / estate
  binding at ingress, a fail-closed startup key gate, a documented no-leak
  boundary).

The invariant is therefore the stable cross-repo anchor: whatever the final
vocabulary or schema, both repositories agree the invariant may not be
relaxed. Reconciliation work changes *names and field shapes*, never this
invariant.

---

## 6. Vocabulary reconciliation

Phase 45A proposed a non-authoritative minimum vocabulary (its §7) lifted
from the Phase 43C fixtures and the Phase 44A reducer reason codes. Dixie
Phase 33A §6 accepted these as a provisional **draft v0** set *and* added a
code-grounded reconciliation (its §6.1) that maps most of them onto existing
canonical Straylight vocabulary. The table below records that mapping as the
Straylight-aligned direction, pending the final contract.

| Freeside local proof label | Where it appears locally | Straylight-aligned direction (Dixie §6 / §6.1) |
|---|---|---|
| `candidate_pending` | Phase 43C fixtures (`admission_state`), Phase 44A reducer | likely Straylight `AssertionStatus` **`proposed`** — adopt canonical `proposed`; the candidate state vocabulary reconciles, pending final contract |
| `admitted` | Phase 43C fixtures (`admission_state`) | the **act** maps to audit event `assertion_admitted` + transition `admit_assertion`; the resulting **status** is canonical `active` — there is no bare `admitted` status upstream |
| `rejected` | Phase 43C fixtures (transition `admission_decision`) | no canonical status; nearest is the audit event **`transition_denied`** (a denied `admit_assertion`) — rejection-family vocabulary, pending contract |
| `superseded` | Phase 43C fixtures (`assertion_status`) | exact canonical match: `AssertionStatus` **`superseded`** — Straylight-owned, audit-only prior state |
| `corrected_active` | Phase 45A proposal (fixtures carry the corrected assertion as admitted / active) | no `corrected` status; express as the (`superseded` → `active`) transition pair — corrected active assertion = status `active` + a supersede link |
| `candidate_not_admitted` | Phase 44A reducer (exclusion / pending reason) | pending-candidate exclusion reason; nearest canonical is **`transition_denied`** — Dixie flags a 3-way synonym collision with `rejected` / `candidate_rejected` |
| `admitted_active_assertion` | Phase 44A reducer (inclusion reason) | active admitted-assertion inclusion reason; redundant compound — reconciles to canonical **`active`** |
| `candidate_rejected` | Phase 44A reducer (exclusion reason) | rejected-candidate exclusion reason; synonym of `rejected` — collapses to **`transition_denied`** |
| `superseded_not_ordinary_recallable` | Phase 44A reducer (superseded reason) | superseded assertion excluded from ordinary recall; express as `superseded` + a recallability signal (e.g. `forgotten_from_recall` / `RecallUseInstruction`), not a compound literal |
| `corrected_active_assertion` | Phase 44A reducer (inclusion reason) | corrected active assertion inclusion; verbose synonym of `corrected_active` — same (`superseded`, `active`) reconciliation |
| `unsupported_admission_shape` / `unsupported_fixture_shape` | Phase 45A proposal / Phase 44A reducer fail-closed code | shape / validation failure family; name after the existing Dixie ingress / class-validation refusals (**`ingress.invalid_request`** / **`seam.class_validation_failed`**) — new to the admission direction |
| `unsafe_candidate_payload_projection` | Phase 44A reducer fail-closed code | no-leak / unsafe-projection failure family; ground in the existing Dixie no-leak posture (Phase 32K projection-safety), not a third naming style |

Important qualifications:

- **Final names are not frozen.** Dixie §6 is explicit that the draft v0
  set is provisional and that final naming must reconcile with the
  canonical Straylight vocabulary; nothing in the table above is a frozen
  contract.
- **Freeside Characters does not own this vocabulary.** Dixie is a
  *non-owning consumer* of the assertion-lifecycle vocabulary, and Freeside
  Characters is a frame over the substrate — neither coins the canonical
  lifecycle names. **Straylight / Dixie vocabulary governs the live
  contract;** where Straylight already has a better-established name, the
  canonical name wins.
- **Current local labels remain valid local proof labels.** Until a Phase
  45D reconciliation matrix (or a later separately-authorized
  fixture / probe alignment) explicitly changes them, the Phase 43C
  fixture field values and the Phase 44A reducer reason codes stay exactly
  as landed. This doc records the *direction* of reconciliation; it does
  **not** rename anything in code or fixtures.

---

## 7. Contract area reconciliation (A–J)

For each A–J area from the Phase 45A request, this records the Dixie Phase
33A response position and the Freeside Characters next implication. Every
"implication" is a docs / reconciliation observation — none authorizes
implementation.

### A. Candidate intake envelope

- **Dixie response:** accepts the need for an explicit version / kind
  discriminator; authoritative tenant / estate / actor binding derived from
  the authenticated session (not caller-supplied); a service-safe,
  idempotent candidate id; public-safe-or-audit-separated source kind / ref;
  a bounded proposed-assertion class (validated against the canonical
  Straylight `AssertionClass` union rather than a parallel list); a
  private / audit-boundary candidate payload never echoed publicly;
  required provenance; header-keyed idempotency; and a fail-closed,
  no-payload-echo response on malformed envelopes. The route name / method
  is deferred (open item).
- **Freeside Characters implication:** the local Phase 43C candidate
  fixtures and Phase 44A classifier align semantically, but the local field
  names (`candidate_id`, `source_kind`, `proposed_assertion_class`,
  `admission_state`, `visibility_class`, `provenance`) may later need a
  contract fixture / probe alignment pass once Dixie finalizes the draft v0
  names — in particular validating `proposed_assertion_class` against the
  canonical `AssertionClass` union and reconciling `candidate_pending` to
  `proposed`. No alignment is performed here.

### B. Explicit admission transition

- **Dixie response:** accepts a required transition kind / version; a
  decision vocabulary of `accepted` / `rejected` (and possibly later
  `superseded` / `corrected` as a follow-on transition); a required
  authority / signer / service actor bound to the canonical Straylight
  `SignerType` model; policy validation separated from structural
  validation (structural fails closed at ingress, policy is a distinct
  upstream decision); a candidate → admitted-assertion link on accept; no
  minted assertion on reject; a required receipt / audit record for every
  transition; and fail-closed reason codes for every non-accept outcome.
- **Freeside Characters implication:** the Phase 44A reducer's
  transition semantics align (accept mints exactly one linked assertion;
  reject mints none and fails closed if it does; linkage breaks fail
  closed), but future fixtures may need naming / field reconciliation —
  binding the local `admission_authority` to the canonical `SignerType`
  model, and reconciling the local single-stage shape against Dixie's
  structural-vs-policy split.

### C. Admitted assertion shape

- **Dixie response:** accepts that an admitted assertion should carry an
  assertion id; actor / estate / tenant binding; class and status; the
  source candidate id; the admission transition id; recall eligibility;
  provenance; and a visibility / rendering class — and that it should align
  with existing Recall Wedge expectations where possible (post-admission
  status is canonical `active`, not a bespoke `admitted`; recall filtering
  keys off `AssertionStatus` and visibility / use signals). Final field
  names defer to the Straylight-owned assertion types.
- **Freeside Characters implication:** the current Phase 43C admitted
  fixture (`assn-*`) remains a **proof shape, not a final schema.** A future
  alignment pass would reconcile its `admission_state = admitted` /
  `assertion_status = active` pairing to the canonical `active` status and
  defer field names to the Straylight assertion types. No change here.

### D. Rejection transition

- **Dixie response:** accepts that a rejected candidate remains
  non-recallable and a rejected transition mints no admitted assertion; a
  rejection receipt / audit record is required, with the canonical anchor
  being the Straylight audit event `transition_denied` rather than a bespoke
  `rejected` status; appealability / deferred correction is a later,
  separately-gated decision (no appeal path defined now).
- **Freeside Characters implication:** the current Phase 43C rejection
  fixture / Phase 44A reducer path aligns — `trans-002` rejects `cand-002`,
  mints nothing, and `proof-003` stays excluded permanently. A future
  alignment would re-anchor the local `rejected` / `candidate_rejected`
  labels on `transition_denied` (per §6). No change here.

### E. Supersession / correction transition

- **Dixie response:** accepts that a supersession / correction transition
  must reference both the superseded and the corrected assertion; ordinary
  recall includes the corrected active assertion only; the superseded prior
  state remains audit / provenance only (canonical `superseded` status); the
  "corrected active" member is status `active` plus a supersede link, not a
  new status; and a forget / revoke / correction UI remains out of scope.
- **Freeside Characters implication:** the current Phase 43C supersession
  fixture / Phase 44A reducer path aligns semantically — `trans-011` accepts
  `cand-011` as `assn-011` and supersedes `assn-010`; recall returns only
  the corrected active assertion and excludes the wrong prior state, with
  the supersedes link preserved for audit. Final naming may change
  (`corrected_active` → the `superseded`→`active` pair). No change here.

### F. Admission receipt / audit fields

- **Dixie response:** accepts that a receipt should carry a receipt id; a
  decision time; the service / authority actor; a policy decision reason; a
  candidate ref; an admitted / rejected / superseded ref; a recall
  eligibility result; a public-safe summary; and a clear private /
  audit-only boundary — with no raw candidate payload in the public
  response, mirroring the Recall Wedge receipt posture (public receipt
  passed through, internal reason detail kept on the audit object).
- **Freeside Characters implication:** a future fixture / probe alignment
  must decide **exactly which receipt fields are public-safe** and which
  stay audit-only, reconciled against the Dixie public / audit split (which
  Dixie's §5.J / §9 flags as an explicit open decision, not an inheritance
  of the recall `raw_reasons` split). The local proof carries the receipt
  only as an audit-link presence boolean today; it does not yet model the
  field-level public / audit boundary. No change here.

### G. Recall eligibility boundary

- **Dixie response:** accepts the boundary — `candidate_pending` not recall
  eligible; admitted active (`active`) recall eligible under policy; rejected
  (`transition_denied`) not recall eligible; superseded not ordinary-recall
  eligible (audit / provenance only); corrected active (`active` + supersede
  link) ordinary-recall eligible — and defers challenged / revoked /
  forgotten admission-time behavior to a future contract (while noting
  Straylight already defines `contested` / `revoked` / `forgotten_from_recall`
  statuses to reuse rather than reinvent).
- **Freeside Characters implication:** the local proof stack aligns
  semantically — the Phase 43C recall proofs and the Phase 44A
  `projectAdmissionRecallProof` already encode exactly this exclusion /
  inclusion boundary. No change here; the challenged / revoked / forgotten
  admission-time behavior stays out of scope for the local proof.

### H. Service auth vs end-user authorization

- **Dixie response:** distinguishes service-to-service auth from end-user
  consent / authorization (a load-bearing distinction that must not be
  collapsed); a dev / operator service token proves a calling service may
  invoke Dixie, **not** that any end user authorized the admission;
  tenant / estate binding derives from the authenticated session; and
  production end-user consent / authorization remains separate and blocked
  (no production consent mechanism for admitting candidate memory exists).
- **Freeside Characters implication:** **no production consent / auth is
  solved**, and the dev / operator seams remain limited to synthetic /
  operator-dev authority (exactly the Phase 43B §E authority posture the
  fixtures already encode). The local proof claims no end-user
  authorization and must not be read as one.

### I. Storage / admission non-goals

- **Dixie response:** preserves, in writing, no production storage claim
  (the only recall-side store is an in-process, non-durable estate store;
  no admission store exists at all), no automatic Discord chat ingestion, no
  public `remember-this`, no user chat becoming memory, no cross-user
  sharing, no live writes until separately authorized, and no production
  auth / consent solved.
- **Freeside Characters implication:** **no command or live UX should be
  built yet.** The non-goals are symmetric with the Freeside-side §11
  blocked list; the resting state remains the local proof stack plus this
  reconciliation.

### J. No-leak public response

- **Dixie response:** accepts stable reason codes, safe public summaries, no
  raw candidate payload, no private sentinels, no raw fixture / debug body,
  no stack traces, no operational secrets / IDs, no source-material leakage,
  and a fail-closed unknown / malformed response — while flagging that the
  existing recall posture is nuanced (recall forwards `raw_reasons` on most
  denied paths by contract; only the overloaded `storage_unavailable` class
  omits them publicly) and that a future admission contract should decide
  its **own** public / audit split explicitly rather than inherit the recall
  split.
- **Freeside Characters implication:** the existing reducer / runner
  no-leak posture remains aligned — the Phase 44A `scanForUnsafeProjection`
  seal and the Phase 44C output seal already refuse private sentinels, long
  ids, hex addresses, URLs, and PEM keys on every safe projection, and the
  Phase 43C validator greps the recall proofs for sentinels. The local
  posture is defense-in-depth at the Freeside seam; it does not decide the
  live admission public / audit split, which Dixie owns.

---

## 8. What Freeside Characters should do next

The candidate next options, classified. Phase 45C authorizes **none** as
implementation; it ranks them so the selection in §9 is explicit.

- **Option A — fixture / probe alignment against the Dixie response.
  *Recommended next.*** A docs + (test-only or narrowly local) proof update
  that compares the Phase 43C fixture shapes and the Phase 44A reducer
  vocabulary against the Dixie Phase 33A draft v0 response and produces a
  reconciliation matrix. If — and only if — separately authorized by its own
  gate, it could then produce updated local contract fixtures or adapter
  tests under the canonical naming direction (§6). It would touch **no** live
  route, command, storage, or runtime wiring. The conservative framing of
  this option is a **docs / decision reconciliation matrix gate first**
  (Phase 45D, §9), with any actual fixture / test change held behind that
  gate's explicit authorization.
- **Option B — wait for a Dixie Phase 33B fixture / probe alignment first.
  *Also acceptable.*** Dixie's §10 lists a future Phase 33B (contract
  fixture / probe alignment recording candidate / admission fixtures against
  the accepted draft v0 vocabulary). Waiting is better if Dixie owns the next
  contract fixture shape, so the Freeside-side alignment reconciles against a
  Dixie-authored shape rather than a guess.
- **Option C — Freeside Characters live candidate command. *Blocked.***
  Requires accepted contract fixtures, storage / auth / consent boundaries,
  and a separate gate. Not reachable from here.
- **Option D — live Dixie admission route client. *Blocked.*** Requires a
  Dixie live route implementation (which does not exist) and a separate
  Freeside gate. Not reachable from here.
- **Option E — package export for the reducer / runner. *Deferred.*** No
  consumer yet, and an export may imply API stability for what is still
  fixture-bound doctrine. Defer until a concrete in-repo consumer requires
  it, under its own justification.

---

## 9. Selected next lane

**Phase 45D — Admission Wedge contract reconciliation matrix / fixture-probe
alignment gate (Option A, conservative framing).**

Phase 45C selects Option A in its conservative form: a future Freeside
Characters-side docs / decision (or docs + non-runtime fixture-probe
planning) reconciliation matrix gate. Option B (wait for Dixie Phase 33B)
remains acceptable if Dixie moves first on the contract fixture shape;
Options C and D are blocked; Option E is deferred. Because we are in the
Freeside Characters repo, the conservative selection is the docs / decision
reconciliation matrix gate, with implementation still blocked. Phase 45C
authorizes only the bounded Phase 45D scope in §10 — it does not implement
it, and the matrix it points toward authorizes no implementation either.

### 10. Phase 45D authorization boundaries

Phase 45C authorizes only a future Freeside Characters-side reconciliation
matrix / fixture-probe alignment gate.

**Allowed future Phase 45D scope:**

- a **docs-only, or docs + non-runtime fixture-probe planning** artifact;
- **compare the local 43C / 44A / 44C proof stack against the Dixie 33A
  response** (and, if it exists by then, a Dixie 33B fixture / probe shape);
- **enumerate vocabulary / field mismatches** (extending the §6 table to the
  field level);
- **decide whether to update local fixtures, the reducer adapter, or runner
  labels later** — a decision, not the update itself;
- **propose a future fixture / probe implementation only if needed**, under
  its own separate authorization.

**Explicitly NOT authorized for Phase 45D:**

- source changes unless separately decided;
- test changes unless separately decided;
- fixture JSON mutation unless explicitly authorized by the Phase 45D gate;
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

Phase 45D, when opened, is a reconciliation matrix / planning gate — not a
build. It must not become a live surface, a write path, a contract
acceptance, or an export by stealth. If it needs any item above, it must
open the gate that owns it (decision-map §7 / §8) — Phase 45C authorizes
none of them.

---

## 11. What remains blocked now

Repeated clearly so a future reader does not over-read this reconciliation.
None of the following is implemented, authorized, or claimed by Phase 45C
(and none was unblocked by Dixie Phase 33A):

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
- a forget / revoke / correction UI.

Reconciliation is not implementation. This doc reads the Dixie response and
classifies the next lane; it does not decide anything on Dixie's behalf, and
an accepted *need* for a contract is not an accepted contract. If a later
phase needs any item above, it must open the gate that owns it
(decision-map §7 / §8) — Phase 45C authorizes none of them.

---

## 12. Success criteria for Phase 45C

This Phase 45C artifact succeeds if **all** of the following hold:

- it **accurately summarizes the Dixie Phase 33A response** (§4) without
  overstating it;
- it **reconciles the Freeside Characters Phase 45A request against the
  Dixie response** (§3, §7);
- it **preserves the candidate / admitted invariant** (§5) and records it as
  accepted by both sides;
- it **identifies the vocabulary / field reconciliation needs** (§6) and the
  per-area implications (§7);
- it **does not claim a final schema is frozen**;
- it **does not authorize implementation** in any repo;
- a **Codex audit confirms docs / reconciliation-only scope** — it
  implements nothing, accepts no contract on Dixie's behalf, freezes no
  schema, and authorizes no implementation.

Mechanically, the accepted-ladder acceptance bar applies to this artifact:

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
  — proving the reconciliation artifact introduced no live-egress
  regression;
- a forbidden-claim scan finds no hits except negated blockers (this
  document claims no public remember-this, no Discord history ingestion, no
  chat-becomes-memory, no production admission, no production storage, no
  production auth / consent, no Finn production wiring, no live Dixie
  admission route, no authorized package export, no frozen final schema, and
  no Freeside Characters ownership of the Dixie / Straylight vocabulary);
- the artifact carries **no raw IDs / secrets / tokens / URLs /
  screenshots / binary evidence** — no private-body sentinels, long id runs,
  hex addresses, URLs, JWTs, or PEM keys.

The Phase 45C acceptance, if recorded, should be a docs report consistent
with the accepted ladder template (redacted operator observations only; no
screenshots; no raw IDs / tokens / payloads / receipts).

---

## 13. Naming rules

Preserved verbatim from Phase 43B §B.1 / Phase 43C / Phase 44B / Phase
44D / Phase 45A, with the cross-repo additions Dixie's response makes
explicit; binding for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  app / repo (the Discord app, the Railway project and service that runs
  the bot). The current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only
  and is out of scope for this reconciliation.
- **"Dixie"** / **`loa-dixie`** is the deployed cross-repo intake /
  control-plane service (the Recall Wedge service today; the candidate
  future live admission intake / control-plane owner).
- **"Straylight"** is the canonical primitive / substrate owner where
  applicable — the memory / continuity substrate that owns the canonical
  admission / estate / receipt / assertion-lifecycle semantics and
  vocabulary.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired. Finn is not
  production-wired for any wedge here, and this reconciliation neither
  requires nor claims a healthy Finn integration.
- Do **not** imply a **Dixie admission route** exists. Dixie exposes only a
  read-only, default-off, fail-closed recall route today; it has no
  admission route, no admission concept in route code, and no production
  storage.
- Do **not** imply the **final contract schema is frozen.** Dixie accepted
  the need for a contract and a provisional draft v0 vocabulary; it froze no
  production schema.

---

## 14. Cross-references

Minimal status / cross-reference back-notes are added to the docs below
(small addenda only; the old docs are not rewritten):

- `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 45A request /
  handoff (PR #160). Gains a one-line Phase 45C note that Dixie Phase 33A
  responded and this reconciliation reads that response.
- `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` — Phase 44D runner
  acceptance / next-lane gate (PR #159). Gains a one-line Phase 45C note.
- `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — Phase 44B reducer
  acceptance / next-lane gate (PR #157). Gains a one-line Phase 45C note.
- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains
  a one-line Phase 45C note in its §O cross-references.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 45C cross-reference
  note.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted §5t Phase 45C addendum and a one-line §9 status note;
  §7 (live-memory-admission gates) and §8 (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45C**):

- `../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md` — Dixie Phase
  33A contract response / acceptance gate (PR #118); the external evidence
  this reconciliation consumes. Read only; not modified (and not editable
  from this repo / task).
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer whose
  vocabulary §6 reconciles. Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner whose labels a
  future Phase 45D may reconcile. Unchanged here.
- `docs/admission-wedge/fixtures/validate-fixtures.mjs` — Phase 43C
  dependency-free validator; the fixture / operator-contract whose field
  values a future Phase 45D may align. Unchanged here.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — the accepted
  Recall Wedge Dixie contract-reconciliation doc (Phase 37A); the
  docs-level cross-repo-reconciliation shape this admission reconciliation
  mirrors (read only; unchanged here).
- `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A decision gate (PR #151); the authority that selected the
  Admission Wedge and named the cross-repo responsibility boundaries
  (Straylight owns the canonical admission / estate / receipt semantics;
  Dixie owns the admission route / policy / auth boundary) this
  reconciliation reads the Dixie response against.

---

## 15. Phase 45D status note — reconciliation matrix authored

> Added by Phase 45D
> (`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`), 2026-06-03.
> Status note only; this reconciliation's §1–§14 are unchanged.

The §6 vocabulary direction and the §7 A–J implications of this
reconciliation are now made **precise** by **Phase 45D**
(`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`, docs / decision ·
docs-planning only). Phase 45D converts the narrative reconciliation into
three explicit tables — a per-label vocabulary matrix, a per-field
field / shape matrix, and an A–J contract-area matrix — each pinning a
status and a future action. It surfaces, among others, the 3-way
`rejected` / `candidate_not_admitted` / `candidate_rejected` synonym
collision, the proposal-only `unsupported_admission_shape` vs the
emitted `unsupported_fixture_shape`, the missing idempotency key, and the
`admission_authority` → canonical `SignerType` mismatch. Phase 45D renames
no fixture label, mutates no reducer reason code, freezes no schema, and
authorizes no implementation; it selects **Phase 45E — a fixture-probe
alignment decision / Dixie-first handoff (docs / decision)** as the
conservative next lane, with a Dixie-first posture (Dixie Phase 33B as the
likely first canonical fixture / probe owner) and live work still blocked.
The §11 blocked list and the decision-map §7 / §8 gates stay in force.
