# Admission Wedge — Dixie-side contract request / handoff

> **Phase 45A** (docs / cross-repo request only). Date: 2026-06-02.
> Companion to `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` (Phase 44D
> runner acceptance / next-lane gate — the gate that accepted the Phase
> 44C runner and *selected* this request as Phase 45A),
> `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` (Phase 44B reducer
> acceptance / next-lane gate), `docs/ADMISSION-WEDGE-MVP-DESIGN.md`
> (Phase 43B design — the §F packet shapes, the §D invariant, and the
> §H / §I / §J proof obligations), `docs/admission-wedge/fixtures/README.md`
> (Phase 43C fixture / operator-contract), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything
> this request points toward). It mirrors the shape of the accepted
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E) on the
> admission side.
>
> This document is a **request / handoff artifact** — a Freeside
> Characters-side ask *to* the Dixie / Straylight owners (or an explicitly
> cross-repo-accepted contract forum). It is **not** Dixie implementation,
> **not** Freeside Characters implementation, **not** the live admission
> contract, and **not** a claim that any Dixie admission contract already
> exists. It implements nothing in any repo.
>
> No source, test, fixture JSON, package, lockfile, config, CI, or
> generated change is introduced here; no runtime Discord behavior; no
> Discord command; no live Dixie admission route; no Straylight store; no
> admission path; no memory write; no storage. If a step seems to require
> reaching past these boundaries, the answer is to open the separate later
> gate that owns it (decision-map §7 / §8) — not to relax it from this
> request.

---

## 1. Phase title and status

**Phase 45A — Dixie-side Admission Wedge contract request / handoff.**

- Phase 45A is a **Freeside Characters-side docs / cross-repo-request
  artifact only.** It produces this request / handoff document and, where
  useful, the smallest possible cross-reference back-notes in the Phase
  44D runner-acceptance gate, the Phase 44B reducer-acceptance gate, the
  Phase 43B design, the Phase 43C fixture README, and the Phase 35A
  decision map. It introduces no source, test, fixture JSON, package,
  lockfile, config, CI, or generated change.
- Phase 45A is **not Dixie implementation.** It changes no Dixie code,
  defines no Dixie schema, and opens no Dixie issue or PR automatically.
  It packages a request that the Dixie / Straylight owners (or a
  cross-repo forum) would answer *later*, on their authority, not this
  one's.
- **No live admission implementation is authorized by this PR.** Phase 45A
  hands off the accepted Freeside Characters proof stack and enumerates
  the contract decisions it needs; it does **not** implement a live
  admission lane in any repo, and it pre-approves no future PR.
- Phase 45A **changes no runtime behavior.** No Discord command, no
  dispatch / startup / command-registration change, no public renderer
  change, no package export change, no live client change. The reducer and
  runner the request hands off remain imported only by their own tests and
  the runner's local `import.meta.main` CLI guard, exactly as Phase 44A /
  44C landed them.
- Phase 45A **does not claim a Dixie admission contract already exists.**
  No canonical admission / estate / receipt contract has been requested
  of, defined by, or accepted by Dixie / Straylight prior to this request.
  This document is the *request* for one; an unmet request leaves every
  blocked lane blocked.

---

## 2. Source chain

This request is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder. **These artifacts are evidence only; Phase 45A
modifies none of them except for the small cross-reference addenda named
in §12.**

- **Phase 43B / PR #152** — `docs/ADMISSION-WEDGE-MVP-DESIGN.md`. The
  Admission Wedge MVP design: the candidate packet, admission transition,
  admitted packet, and admission receipt shapes (§F), the core invariant
  (§D), the non-recallability / rejection / supersession proof obligations
  (§H / §I / §J), and the Lane A preference (§G). Design-level doctrine,
  not an implemented schema.
- **Phase 43C / PR #155** — `docs/admission-wedge/fixtures/`. The
  fixture / operator-contract proof: a deterministic candidate →
  transition → admitted → recall-proof graph plus a dependency-free
  validator that makes the §D invariant mechanically checkable. Fixture /
  operator-contract only — no runtime, no command, no live admission
  route, no storage.
- **Phase 44A / PR #156** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`). The fixture-bound reducer / adapter: a pure,
  dependency-free local reducer over the Phase 43C fixtures that proves
  the §D invariant *in code* (classify candidate · apply transition ·
  project recall proof · reduce scenario) with stable fail-closed reason
  codes and a no-leak seal over every safe projection.
- **Phase 44B / PR #157** —
  `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`. The reducer
  acceptance / next-lane decision gate. It accepted the Phase 44A reducer
  as the fixture-bound local reducer proof and selected Phase 44C (a
  fixture-bound dev/operator reducer runner) as the next lane. It
  implemented nothing.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: a local
  script / test-only runner that *reads* the Phase 43C fixtures and
  *calls* the Phase 44A reducer to print operator-safe scenario summaries
  for the five Admission Wedge scenarios.
- **Phase 44D / PR #159** —
  `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`. The runner
  acceptance / next-lane decision gate. It accepted the Phase 44C runner
  as the fixture-bound local runner proof and *selected this Phase 45A —
  the Dixie-side Admission Wedge contract request / handoff* — as the next
  lane (its §7), under the bounded scope in its §8 and the acceptance
  criteria in its §9. Phase 44D implemented nothing and authorized no
  implementation in any repo.

Phase 45A inherits the Phase 43A / 43B / 44B / 44D authority boundary
verbatim: it may *author a docs / cross-repo contract request* and
*enumerate* the decisions Dixie / Straylight would own; it may **not**
authorize production admission, public remember-this, Discord
message-history ingestion, a live Dixie admission route, or a full
production Straylight admission / storage / auth / consent architecture,
and it may **not** decide on Dixie's behalf.

---

## 3. Purpose of this request

State plainly what this artifact is for, so a cross-repo reader does not
over-read it.

- **Freeside Characters has a local proof stack for Admission Wedge
  semantics.** The §D invariant is mechanically checkable (Phase 43C
  validator), proven *in code* over a deterministic fixture graph (Phase
  44A reducer), and operator-inspectable through safe scenario summaries
  (Phase 44C runner). That stack is local, fixture-bound, and pure — it
  admits nothing and reaches no network.
- **A future live admission lane cannot proceed by inventing the contract
  inside Freeside Characters.** The §D shapes are Freeside Characters-side
  *design intent*; they are not an agreed cross-repo contract. Straylight
  would own the canonical admission / estate / receipt semantics, and
  Dixie would own the live admission service route / policy / auth
  boundary (Phase 43B §K). Freeside Characters is a frame over that
  substrate, not the admission authority or the canonical record.
- **Dixie or a cross-repo contract owner must define or accept the live
  admission contract before any live route / client / storage / command
  work.** Until a Dixie-owned (or explicitly cross-repo-accepted) contract
  artifact exists, the live admission lane stays blocked. A
  Freeside-authored draft does not promote itself into the contract
  through inertia.
- **This request packages the Freeside Characters proof stack and asks for
  contract decisions.** It summarizes what already exists locally (§5) and
  enumerates the concrete decisions the contract must settle (§6), framed
  as questions for the owner to answer — not answers Freeside Characters
  has supplied.
- **It authorizes no implementation.** Requesting a contract is not the
  same as having one. This document opens no route, writes no memory, adds
  no command, and changes no Dixie code. Every blocked lane stays blocked
  (§8).

---

## 4. Core invariant to carry into the Dixie contract

The load-bearing invariant, carried unchanged from Phase 43B §D / Phase
43A §E. Any Dixie-owned or cross-repo-accepted admission contract must
preserve it; a contract that relaxes it is not acceptable as a successor
to this request.

> **Candidate memory is not admitted memory. Candidate memory is not
> recallable as governed continuity. Candidate memory becomes recallable
> only after an explicit admission transition accepts it.**

The clauses the contract must keep expressible and enforceable:

- **Candidate memory is not admitted memory.** A candidate and an admitted
  assertion are distinct states. A candidate that exists is still *only* a
  proposal; existence is neither admission nor safety.
- **Candidate memory is not recallable as governed continuity before
  explicit admission.** Before the admission transition accepts it, a
  candidate must not surface through the accepted Recall Wedge path as
  governed memory. From the recall surface's perspective a not-yet-admitted
  candidate is absent.
- **An accepted admission transition creates or references an admitted
  assertion.** There is exactly one door from candidate to admitted: a
  deliberate, governed, recorded admission transition authored under
  synthetic / operator-dev authority. No implicit promotion, no side door.
- **A rejected candidate never becomes recallable.** Rejection is terminal
  for that candidate's recallability; a rejected candidate has no path back
  to admitted without a *new*, separately authored transition against a
  *new* candidate.
- **Supersession / correction preserves auditability while ordinary recall
  includes only the corrected active assertion.** A supersede mints the
  corrected active assertion and records the supersedes link for audit;
  ordinary recall returns only the corrected assertion and excludes the
  wrong prior state, which is never rendered as active recall material.
- **Fail-closed paths must not leak raw candidate / private payload.** Every
  fail-closed and every safe projection is sealed: it carries a stable
  reason code and a safe summary, never a raw candidate body, source
  material, private sentinel, long id, hex address, URL, or key.

---

## 5. Freeside Characters proof stack summary

A summary of what already exists on the Freeside Characters side, restated
so the recipient of this request does not have to read the full ladder.
**None of this proof constitutes a live contract**; it is the local
narrowing / fail-closed surface a future live admission contract would be
reconciled against.

- **43B design — taxonomy and invariant.** `docs/ADMISSION-WEDGE-MVP-DESIGN.md`
  defines, at a design / doctrine level, the candidate packet, admission
  transition, admitted packet, and admission receipt shapes (§F); the
  candidate / admitted / rejected / superseded taxonomy (§E); and the §D
  invariant. These are design-level vocabulary, **not** implemented
  schemas, storage tables, or Dixie / Straylight API contracts.
- **43C fixtures — the candidate / transition / admitted / recall-proof
  contract.** `docs/admission-wedge/fixtures/` holds a deterministic
  fixture graph (four candidates, four transitions, three admitted
  assertions, four recall proofs) plus a dependency-free validator
  (`validate-fixtures.mjs`, Node built-ins only) that asserts the §D
  invariant across them: candidate-pending is not recallable; an accepted
  transition mints the expected admitted assertion; the rejected candidate
  mints nothing and stays excluded; supersession includes only the
  corrected active assertion and excludes the wrong prior state; and no
  recall-proof fixture leaks a private-body sentinel. Stamps are logical
  (`fixture-logical-stamp-NNNN`), never wall-clock.
- **44A reducer — the §D invariant proven in code, fail-closed / no-leak.**
  `admission-wedge-fixture-reducer.ts` is a pure, dependency-free local
  reducer over the Phase 43C fixtures (classify candidate · apply
  transition · project recall proof · reduce scenario). It reaches no
  network, clock, env, or filesystem. It carries stable fail-closed reason
  codes and a `scanForUnsafeProjection` no-leak seal over every safe
  projection, so a raw candidate body, private sentinel, long id, hex
  address, URL, or PEM key can never leave through a safe field.
- **44C runner — operator-readable safe summaries over the fixture
  scenarios.** `run-admission-wedge-fixture-demo.ts` *reads* the Phase 43C
  fixtures and *calls* the Phase 44A reducer to print safe per-scenario
  summaries for the five scenarios (before-admission excluded; accepted /
  admitted included; rejected excluded; supersession corrected-only; a
  synthetic in-memory malformed candidate that fails closed). Each summary
  carries only a scenario name, an outcome enum, a stable reason code,
  short fixture ids, an audit-link presence boolean, and a canned
  one-liner — every summary sealed through the reducer's no-leak scan.
- **44D gate — accepts the local proof and selects this Dixie contract
  request.** `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` accepts the
  end-to-end local proof stack (fixtures → reducer → runner) as a complete
  *local* proof of the §D invariant's inspectability, and selects this
  Phase 45A docs / cross-repo Dixie contract request as the next lane. It
  accepts the local proof as **neither** production admission, **nor** live
  Dixie admission, **nor** a user-facing write path.

---

## 6. Contract decision requests for Dixie / cross-repo owner

Freeside Characters asks the Dixie / Straylight owners (or, where
applicable, the cross-repo forum that owns this surface) to define or
accept the items below. This list is the bar a future contract artifact
must clear; partial coverage does not promote a draft into a contract.
**Every item is a question for the owner — not an answer Freeside
Characters has decided.**

### A. Candidate intake envelope

Asked of the Dixie / cross-repo owner to define:

- the route or interface name, if any later (Freeside Characters proposes
  none and reaches none today);
- the envelope kind and version string, and the rule for selecting them;
- the tenant / estate / actor binding (which estate a candidate is bound
  to, and how the actor is named);
- candidate id rules (format, uniqueness, who assigns them);
- source kind and source ref rules (where a candidate may originate; in
  the proof stack, only a reviewed deterministic dev/operator fixture, and
  never a runtime-generated corpus);
- the proposed assertion class vocabulary;
- the visibility class / public-safe rendering boundary;
- the candidate payload boundary (which fields are private-body and never
  rendered);
- the admission state vocabulary;
- the required provenance fields;
- idempotency key expectations (so the same candidate intake is safe to
  retry without minting duplicates);
- the no-leak response behavior on intake (what an intake acknowledgment
  may and may not echo back).

### B. Explicit admission transition

Asked for contract decisions on:

- the transition kind and version;
- the admission decision vocabulary (e.g. accept / reject / supersede);
- admission authority / signer / service-actor requirements (who is
  allowed to admit, and how that authority is represented);
- the policy validation boundary (what policy check gates a transition,
  and where it runs);
- the relationship between candidate id, transition id, and admitted
  assertion id (how the three are linked and cross-checked);
- receipt / audit requirements (every transition produces exactly one
  verifiable record);
- the fail-closed reason codes for a refused or malformed transition.

### C. Admitted assertion shape

Asked for contract decisions on:

- the assertion kind and version;
- the admitted assertion id;
- the assertion class / status vocabulary;
- the source candidate reference;
- the admission transition reference;
- the recall eligibility field;
- the provenance / audit links;
- the visibility / rendering class;
- whether the admitted assertion shape aligns with the existing Recall
  Wedge assertion expectations (so an admitted assertion is read-compatible
  with the accepted recall path without widening it).

### D. Rejection transition

Asked for:

- the rejected state vocabulary;
- the guarantee that no admitted assertion is minted on rejection;
- the rejection receipt / audit fields (who rejected, when via a logical
  stamp, why);
- the recall exclusion reason;
- whether rejection is terminal or appealable later (and if appealable,
  through what *new* candidate / transition, never a silent reversal).

### E. Supersession / correction transition

Asked for:

- the superseded assertion reference;
- the corrected assertion reference;
- the active-vs-superseded recall behavior;
- audit / provenance preservation across the correction;
- the ordinary-recall no-leak rule for the wrong prior state (it is never
  rendered as active recall material);
- whether correction is admission-only here, or also a future forget /
  revoke / correction lane (the latter stays blocked and separately gated,
  §8).

### F. Admission receipt / audit fields

Asked for:

- the receipt id;
- the decision time (a deterministic / logical stamp, not a wall-clock
  read, to keep any future proof byte-stable);
- the authority actor / service;
- the policy decision reason;
- the candidate reference;
- the admitted / rejected / superseded assertion reference;
- the recall eligibility result;
- the public-safe summary;
- the private / audit-only detail boundary;
- the rule that no raw candidate payload appears in the public response.

### G. Recall eligibility boundary

Asked of Dixie to define, so the boundary between candidate and recallable
governed continuity is unambiguous:

- candidate pending = not recall eligible;
- admitted active assertion = recall eligible under policy;
- rejected candidate = not recall eligible;
- superseded assertion = not ordinary-recall eligible;
- corrected active assertion = ordinary recall eligible;
- challenged / revoked / forgotten interaction — if known, define it; if
  not, explicitly defer it to a separately gated forget / revoke /
  correction lane.

### H. Service auth vs end-user authorization

Asked to distinguish, separately and explicitly (these are two contracts,
not one — service authentication does not subsume end-user authorization):

- service-to-service auth (how a service authenticates to Dixie);
- operator / dev service token (the controlled-authority lane);
- tenant / estate authorization (which estate a caller may admit into);
- end-user consent / authorization (whether and how an end user authorizes
  admission on their behalf);
- what can be proven in the dev / operator lane today;
- what must be separately designed for production;
- what this request does **not** solve (it does not claim production auth
  or production consent is solved, and it does not establish cross-user
  authority).

### I. Storage / admission non-goals

Asked of Dixie to preserve, in writing, as non-goals of this handoff:

- no production storage claim arises from this handoff;
- no automatic Discord chat ingestion;
- no public remember-this;
- no user chat becoming memory;
- no production auth / consent solved by this handoff;
- no cross-user sharing;
- no live writes until separately authorized.

### J. No-leak public response requirements

Asked for, so the existing no-leak boundary is not widened by admission:

- stable reason codes;
- safe public summaries;
- no raw candidate payload;
- no private sentinels;
- no raw fixture / debug body;
- no stack traces;
- no operational secrets / IDs;
- no source-material leakage;
- a fail-closed unknown / malformed response shape (generic, sealed by
  reason code).

If any item across §6 is missing from a proposed artifact, the artifact
does not satisfy this request and does not authorize live admission work in
any repo.

---

## 7. Proposed minimum contract vocabulary

> **Freeside Characters-side proposal — not Dixie authority.** The terms
> below are a non-authoritative starting vocabulary lifted from the Phase
> 43C fixture contract and the Phase 44A reducer reason codes. They are a
> proposal to anchor discussion, **not** a final schema. The Dixie /
> cross-repo owner must **confirm, rename, or reject** each term; nothing
> here is binding, and a divergence is resolved in the owner's favor.

Candidate terms (states / outcomes / reason codes), with where each
already appears locally:

- `candidate_pending` — candidate admission state (Phase 43C fixtures,
  Phase 44A reducer).
- `admitted` — admitted admission state (Phase 43C fixtures).
- `rejected` — rejected decision / state (Phase 43C fixtures).
- `superseded` — superseded prior-state status (Phase 43C fixtures).
- `corrected_active` — the corrected active state after a supersede
  (proposed label; the fixtures carry the corrected assertion as
  admitted / active).
- `candidate_not_admitted` — exclusion / reason code for a pending
  candidate before admission (Phase 44A reducer).
- `admitted_active_assertion` — inclusion reason code for an admitted
  active assertion (Phase 44A reducer).
- `candidate_rejected` — exclusion reason code for a rejected candidate
  (Phase 44A reducer).
- `superseded_not_ordinary_recallable` — reason code marking a superseded
  prior state as excluded from ordinary recall (Phase 44A reducer).
- `corrected_active_assertion` — inclusion reason code for a corrected
  active assertion after supersession (Phase 44A reducer).
- `unsupported_admission_shape` — proposed fail-closed code for an
  unsupported / malformed admission envelope. *Note:* the local Phase 44A
  reducer names this `unsupported_fixture_shape` because it operates over
  fixtures; a live contract would likely prefer an admission-framed name.
  The owner should confirm or rename.
- `unsafe_candidate_payload_projection` — fail-closed code for an attempt
  to project a raw candidate payload onto a recall surface (Phase 44A
  reducer).

This is **not** a final schema. The Dixie / cross-repo owner must confirm,
rename, or reject these terms; once a Dixie-owned (or cross-repo-accepted)
vocabulary exists, it supersedes this proposal and Freeside Characters
reconciles its local fixtures / reducer / runner / tests against it (§10).

---

## 8. What Phase 45A explicitly does not authorize

Repeated clearly so a future reader does not over-read this request. None
of the following is implemented, authorized, or claimed by Phase 45A:

- Dixie code changes;
- Freeside Characters source changes;
- a live admission route;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord message-history ingestion;
- user chat becoming memory;
- storage writes;
- production admission;
- production auth / consent;
- network calls;
- package exports;
- public renderer changes;
- dispatch / startup / command-registration changes;
- LLM rewriting / character voice;
- Finn production wiring;
- a forget / revoke / correction UI.

Phase 45A is a request / handoff, not a build. It must not become a live
surface, a write path, a contract acceptance, or an export by stealth.
Requesting a contract is not the same as having one: this request
**enumerates** what Dixie / Straylight would own and decide; it does not
decide it, and an unmet request leaves every blocked lane blocked. If a
later phase needs any item above, it must open the gate that owns it
(decision-map §7 / §8) — Phase 45A authorizes none of them.

---

## 9. Success criteria for this handoff

This Phase 45A artifact succeeds if **all** of the following hold:

- it **accurately summarizes the Freeside Characters proof stack** (43B
  design · 43C fixtures · 44A reducer · 44C runner) without overstating it
  (§5);
- it **keeps the candidate / admitted invariant intact** — candidate
  memory is not admitted memory, is not recallable before admission, and
  becomes recallable only after an explicit admission transition (§4);
- it **gives the Dixie / cross-repo owner concrete contract questions**
  (§6) and a clearly non-authoritative proposed vocabulary (§7);
- it **does not claim a Dixie admission contract already exists** — this is
  the request *for* one;
- it **does not authorize implementation** in any repo;
- a **Codex audit confirms docs / cross-repo request only** — it implements
  nothing in any repo, accepts no contract, and authorizes no
  implementation.

Mechanically, the Phase 44D §9 acceptance bar applies to this artifact:

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
  — proving the request artifact introduced no live-egress regression;
- a forbidden-claim scan finds no hits except negated blockers (this
  document claims no production admission, no production storage, no
  production auth / consent, no public remember-this, no Discord
  message-history ingestion, no chat-becomes-memory, no live Dixie
  admission route, no package export, no existing Dixie admission contract,
  no changed Dixie code, and no Finn production wiring);
- the artifact carries **no raw IDs / secrets / tokens / URLs /
  screenshots / binary evidence** — no private-body sentinels, long id
  runs, hex addresses, URLs, JWTs, or PEM keys.

The Phase 45A acceptance, if recorded, should be a docs report consistent
with the accepted ladder template (redacted operator observations only; no
screenshots; no raw IDs / tokens / payloads / receipts).

---

## 10. Next possible phases

Listed for orientation. Phase 45A authorizes **none** of them; each
re-opens its own decision artifact under the decision-map §7 / §8 gates.

- **Phase 45B — Dixie-side / cross-repo contract acceptance or response
  artifact.** A Dixie-owned (or explicitly cross-repo-accepted) artifact
  that answers this request — defining or accepting the live admission
  contract. It is owned by Dixie / Straylight, not by Freeside Characters,
  and a Freeside-authored draft does not satisfy it.
- **Phase 45C — Freeside Characters reconciliation against the accepted
  contract.** After a contract exists, walk the Dixie-owned shapes against
  the local Phase 43C fixtures / Phase 44A reducer / Phase 44C runner and
  update them to match (Dixie-owned shape supersedes the local proof). No
  live client lands before reconciliation is complete.
- **Later live Dixie admission route gate — only after contract
  acceptance.** A live Dixie admission route is reachable only after a
  Dixie-owned contract, then service auth, storage / admission semantics,
  consent / auth design, and a separate decision. Blocked here.
- **Later dev/operator candidate command — only after storage / auth /
  consent boundaries are separately gated.** A dev/operator-only candidate
  affordance (the Lane B `/remember-this`-shaped command from the design
  §G) must not be conflated with a public `/remember-this`; it stays
  separately gated.
- **Stop / harden docs if no Dixie owner is ready.** Treat the local proof
  stack plus this request as the resting state and take no implementation
  action — available if no Dixie / Straylight owner is ready to respond.

---

## 11. Naming rules

Preserved verbatim from Phase 43B §B.1 / Phase 43C / Phase 44B / Phase
44D; binding for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  app / repo (the Discord app, the Railway project and service that runs
  the bot). The current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only
  and is out of scope for this request.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired. Finn is not
  production-wired for any wedge here, and this request neither requires
  nor claims a healthy Finn integration.
- Do **not** imply a **Dixie admission contract** already exists. No such
  contract has been requested of, defined by, or accepted by Dixie /
  Straylight prior to this request; this document is the request for one.
- **"Dixie"** is the deployed Recall Wedge service; **"Straylight"** is the
  memory / continuity substrate that would eventually own the canonical
  admission / estate / receipt semantics. Neither is wired for admission by
  this request, and neither has accepted an admission contract.

---

## 12. Cross-references

Minimal status / cross-reference back-notes are added to the docs below
(small addenda only; the old docs are not rewritten):

- `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` — Phase 44D runner
  acceptance / next-lane gate (PR #159). Gains a one-line Phase 45A note
  that this request is the Phase 45A artifact Phase 44D selected.
- `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — Phase 44B reducer
  acceptance / next-lane gate (PR #157). Gains a one-line Phase 45A note.
- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains
  a one-line Phase 45A note in its §O cross-references.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 45A cross-reference
  note.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted §5s Phase 45A addendum and a one-line §9 status note;
  §7 (live-memory-admission gates) and §8 (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45A**):

- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer this
  request hands off.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the runner this request
  hands off.
- `docs/admission-wedge/fixtures/validate-fixtures.mjs` — Phase 43C
  dependency-free validator; the fixture / operator-contract this request
  hands off.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` /
  `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — the accepted
  Recall Wedge Dixie contract-request / reconciliation docs; the
  docs-level cross-repo-request shape this admission contract request
  mirrors (read only; unchanged here).
- `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A decision gate (PR #151); the authority that selected the
  Admission Wedge, ranked the lanes (its §H), and named the cross-repo
  responsibility boundaries (Straylight owns the canonical admission /
  estate / receipt semantics; Dixie owns the admission route / policy /
  auth boundary) this request addresses.

---

## 13. Phase 45C status note — Dixie responded; reconciliation authored

> Added by Phase 45C
> (`docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`), 2026-06-03.
> Status note only; this request's §1–§12 are unchanged.

Dixie answered this request with **Phase 33A / PR #118**
(`../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`), a docs-only,
code-inspection-grounded contract response / acceptance gate. Dixie accepted
the **need** for a Dixie-side or cross-repo-owned Admission Wedge contract
before any live implementation, accepted the §4 core invariant and the
no-leak / fail-closed posture, accepted the need to reconcile the candidate /
admitted / rejected / superseded vocabulary against the canonical Straylight
lifecycle (its §6 maps most of the §7 proposed terms onto existing canonical
names), and accepted a provisional **draft v0** vocabulary for *future*
fixture / probe alignment. Dixie did **not** freeze a final production
schema, did **not** implement a live route, and explicitly kept storage
writes, production admission / auth / consent, a public command,
`/remember-this`, Discord history ingestion, chat-becomes-memory, package
exports, LLM / voice, Finn production wiring, and a forget / revoke /
correction UI blocked. Freeside Characters' reading of that response,
the vocabulary / contract-area reconciliation, and the conservative next
lane (Phase 45D — a docs / decision reconciliation matrix gate; live work
still blocked) are recorded in
`docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`. No Dixie admission
contract is frozen and no live admission route exists; the §8 boundaries and
the decision-map §7 / §8 gates stay in force.

---

## 14. Phase 45D status note — reconciliation matrix authored

> Added by Phase 45D
> (`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`), 2026-06-03.
> Status note only; this request's §1–§12 are unchanged.

The A–J contract decisions this request enumerated (§6) and the
non-authoritative proposed vocabulary (§7) have now been reconciled against
the Dixie Phase 33A response and converted into an explicit matrix by
**Phase 45D** (`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`,
docs / decision · docs-planning only). The matrix records, per contract
area, the Dixie position, the local proof status, the field / shape
mismatch, and a future action — and flags that several §7 proposed terms
are draft-v0 only (notably `unsupported_admission_shape`, which is **not**
an emitted reducer code; the emitted code is `unsupported_fixture_shape`).
Phase 45D renames no fixture label, mutates no reducer reason code, freezes
no schema, and authorizes no implementation; it selects **Phase 45E — a
fixture-probe alignment decision / Dixie-first handoff** as the conservative
next lane. No Dixie admission contract is frozen and no live admission route
exists; the §8 boundaries and the decision-map §7 / §8 gates stay in force.
