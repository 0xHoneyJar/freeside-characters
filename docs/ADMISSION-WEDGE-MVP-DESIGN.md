# Admission Wedge MVP — Design

> **Phase 43B** (docs / design only). Date: 2026-05-31. Companion to
> `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`
> (Phase 43A — the decision gate that *selected* the Admission Wedge as
> the next product wedge and authorized only this design work),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything
> this design points toward; §5o / §9 already forward-reference this
> doc), and
> `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` (Phase 42D —
> the accepted controlled dev/operator served live recall this design
> reuses unchanged for its recall-after-admission step).
>
> This document is a **design**. It defines, at a design / doctrine
> level, the candidate / admission packet shapes, the admission
> transition, the admission receipt / audit event, and the concrete
> acceptance tests for a future Admission Wedge MVP — **before** any
> implementation. It selects no PR, writes no candidate, admits no
> memory, and authorizes no implementation.
>
> It adds **no** source, test, package, lockfile, fixture, config, CI, or
> generated change. It adds **no** Discord command (including any
> `/remember-this`), **no** Dixie route, **no** Straylight store, **no**
> seed, **no** admission path, **no** memory write, **no** storage, **no**
> public remember-this surface, **no** Discord history ingestion, **no**
> user-facing admission UX, **no** production auth / consent, **no** LLM /
> voice behavior, and **no** forget / revoke / correction UI. The shapes
> below are design-level vocabulary, not implemented schemas, not storage
> tables, not API contracts. If a step seems to require reaching past
> these boundaries, the answer is to open the separate later gate that
> owns it — not to relax it from this design.

---

## A. Phase title and status

**Phase 43B — Admission Wedge MVP design.**

- Phase 43B is **docs / design only.** It produces this design doc and,
  if strictly necessary for navigation, the smallest possible
  cross-reference back-notes in the Phase 43A gate and the decision map.
  It introduces no source, test, package, lockfile, fixture, config, CI,
  or generated change.
- Phase 43B **does not implement the Admission Wedge.** It defines the
  candidate / admission packet shapes, the admission transition, the
  admission receipt, and the acceptance tests at a design level. A later
  **Phase 43C (or equivalent)** would be the first reviewed
  implementation, under its own gate and the decision-map §7 gates — not
  this phase.
- Phase 43B **adds no admission and no storage.** No candidate is
  written, no candidate is admitted, no estate is created, no packet is
  persisted. The packet shapes here are doctrine for a future design,
  not a data model that exists.
- Phase 43B **does not authorize** production memory admission, public
  remember-this, automatic memory from Discord chat, Discord
  message-history ingestion, durable production storage, production auth
  / consent, cross-user sharing, public rollout, a live Dixie admission
  route, a Straylight production store, LLM rewriting, character voice
  admission / rendering, or a forget / revoke / correction UI. All remain
  blocked (§M).
- Phase 43B **does not claim the Admission Wedge is proven.** That proof
  is the target of a future implementation phase, not a result of this
  design (§L, §N).

---

## B. Decision source

This design is authorized by, and scoped entirely within, the Phase 43A
decision gate.

- **Phase 43A** —
  `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`,
  merged via **PR #151**. Phase 43A selected the Admission Wedge MVP as
  the next product wedge after Recall Wedge MVP acceptance, fixed the
  core invariant (§E there / §D here), sketched the candidate-vs-admitted
  taxonomy (§G there / §E here), ranked the implementation lanes (§H
  there / §G here), and recommended exactly this design doc as Phase 43B
  (§M there). Its §M lists what a Phase 43B design "should" do; this doc
  is the discharge of that list and may not exceed it.
- **Phase 42D** —
  `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`, merged via
  **PR #150**. The accepted controlled dev/operator seeded live recall.
  Its served result (`classification = served`, `outcome = served`,
  `route = /api/recall/intake`, `reason = served`, rendered ephemeral and
  operator-gated) is the read-side primitive this design reuses unchanged
  for recall-after-admission (§F, §G).
- **Phase 35A** — `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`. Its §7
  (decision gates before live memory admission) is the standing gate any
  admission work must satisfy; its §8 (what not to do next) is the
  standing prohibition list; its §5o / §9 already name
  `docs/ADMISSION-WEDGE-MVP-DESIGN.md` as the Phase 43B target. This
  design is subordinate to §7 / §8.

Phase 43B inherits Phase 43A's authority boundary verbatim: it may
*design* a controlled dev/operator admission proof; it may **not**
authorize production admission, public remember-this, Discord history
ingestion, or a full production Straylight admission / storage / auth /
consent architecture.

### B.1 Naming note (binding for this document)

Carried from Phase 43A §A.2 so a future reader does not re-derive it:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  Discord app / this repo / the Railway project and service that runs the
  bot. The current bot identity is **"loa."** The bare word "Freeside" is
  **not** used here to name the current app.
- **"Freeside platform"** is reserved for the future broader platform and
  is out of scope for this design.
- **"Dixie"** is the deployed Recall Wedge service the live command
  reaches (`POST /api/recall/intake`); it would eventually own the
  service route / policy / auth boundary for admission too (§K).
- **"Straylight"** is the memory / continuity substrate behind Dixie — the
  authority that would eventually own canonical admission / estate /
  receipt semantics (§K). Straylight, not Freeside Characters, owns the
  admission boundary.
- **"Finn"** (`loa_finn`) is an upstream Dixie depends on for a healthy
  overall state. Finn is **not production-wired** for any wedge here, and
  this design neither requires nor claims a healthy Finn integration.
- **"Recall Wedge"** is the accepted read/recall half. **"Admission
  Wedge"** is the proposed write/admission half this doc designs. They
  are two bounded wedges, not one production system.

---

## C. Problem statement

- **The Recall Wedge proved governed read / recall.** Phase 42D accepted
  a controlled dev/operator path in which an already-admitted or seeded
  continuity state was recalled safely through a live Discord surface:
  Freeside Characters / loa invoked `/recall-wedge-live-demo`, the live
  client reached Dixie, Straylight returned a governed `served` result
  against the seeded dev/operator estate, and the surface rendered an
  ephemeral, operator-gated, public-safe summary with no leak. That is
  the read half, and only the read half.
- **The Admission Wedge is the missing governed write / admission half.**
  The Recall Wedge recalls memory that *already exists*. It says nothing
  about how memory comes to exist. The Phase 42D seeded estate was placed
  by a Straylight-owned admission path on the Dixie side — not by anything
  in this repo, and not by an end user. So the product today is a reader
  over a state someone else seeded by hand.
- **The product is not real memory until there is a governed path for
  something to *become* memory.** "Memory" implies both halves: something
  can be admitted, and something admitted can be recalled. The Admission
  Wedge designs the first half — the governed transition by which a
  candidate becomes admitted continuity — so that the already-accepted
  Recall Wedge path can then recall it.
- **And it must stay a bounded wedge, not a production platform.** The
  temptation after a served recall is to jump straight to production
  Straylight: durable storage, production auth, consent, user ingestion,
  public remember-this. That is explicitly *not* this design. This design
  defines the *smallest governed admission transition* that can later be
  proven safely under dev/operator authority and then recalled through
  the accepted Recall Wedge path. Admission is a wedge, not a platform.

---

## D. Core invariant

The load-bearing invariant, carried unchanged from Phase 43A §E. A future
implementation phase may not relax it:

> **Candidate memory is not admitted memory. Candidate memory is not
> recallable as governed continuity. Candidate memory becomes recallable
> only after an explicit admission transition accepts it.**

The three clauses, stated as design rules the packet shapes (§F) and the
Lane A design (§G) must make expressible and provable:

- **Candidate memory is not admitted memory.** A candidate and an
  admitted assertion are distinct states. The mere existence of a
  candidate does not make it usable, trustworthy, or continuity-bearing;
  a candidate that exists is still *only* a proposal. Existence is not
  admission, and existence is not safety.
- **Candidate memory is not recallable as governed continuity.** Before
  the admission transition accepts it, a candidate must not surface
  through the Recall Wedge path as governed memory. From the recall
  surface's perspective a not-yet-admitted candidate is *not there*: a
  recall attempt against it returns the safe not-found / fail-closed
  result (the Phase 41D / 42D fail-closed behavior), never a served
  payload.
- **Candidate memory becomes recallable only after an explicit admission
  transition.** There is exactly one door from candidate to admitted: a
  deliberate, governed, recorded admission transition (§F.2) authored
  under dev/operator authority. No implicit promotion. No side door —
  not Discord chat, not history ingestion, not a passive listener, not a
  runtime corpus. Raw → candidate → admitted are distinct states with an
  explicit gate between candidate and admitted (decision-map §7).

Two corollaries that the proofs in §H–§J discharge:

- **Rejected candidates never become recallable** (§I). Rejection is
  terminal for that candidate's recallability.
- **A corrected / superseded candidate must not leak its wrong prior
  state into ordinary recall** (§J). Supersession replaces what is
  recallable; it does not surface the superseded version as governed
  continuity.

This invariant is doctrine, not a code schema. This phase fixes it as the
rule a future implementation may not relax; it does not implement it.

---

## E. Taxonomy

Defined at a design / product / architecture level — concrete vocabulary
for a future implementation, **not** a database shape and **not** an API
contract. This is Phase 43A §G made one level more concrete; it still
stops short of being storage.

- **Candidate memory** — a proposed memory that has been nominated but
  not yet accepted. It is not governed continuity and is **not
  recallable** as such (§D). In the MVP wedge it may originate **only**
  from a reviewed deterministic dev/operator source (a fixture). A
  candidate carries an `admission_state` of `candidate`.
- **Admitted memory** — a candidate that an explicit admission transition
  has accepted. It is governed continuity state, recallable through the
  accepted Recall Wedge path, and was produced through a Straylight-owned
  admission path. An admitted packet carries an `admission_state` of
  `admitted` and is shaped so the existing Recall Wedge read path can
  read it exactly as it reads the Phase 42D seeded `already_admitted`
  estate.
- **Rejected candidate** — a candidate an admission transition declined.
  It carries an `admission_state` of `rejected`, never becomes recallable
  as governed continuity (§D, §I), and leaves an auditable record of who
  rejected it, when (a deterministic stamp, §F.4), and why.
- **Superseded / corrected candidate** — a candidate (or a previously
  admitted assertion) that a later admitted assertion replaces or
  corrects. It carries an `admission_state` of `superseded` and is linked
  to its successor. The wrong / prior version must not surface through
  ordinary recall (§J); in the MVP wedge this is governed by doctrine and
  the admitted-vs-superseded partition, **not** by an implemented forget
  / revoke / correction UI (which stays blocked, §M).
- **Admission source** — where a candidate came from. In the MVP wedge,
  **only** a reviewed deterministic dev/operator source / fixture. Never
  Discord history, never user chat, never a runtime-generated corpus. The
  source descriptor is audit material; it is never rendered to any public
  surface.
- **Admission authority** — who is allowed to admit. In the MVP wedge,
  **synthetic or operator/dev authority only.** Never an arbitrary user
  admitting arbitrary memory on anyone's behalf. The authority is named
  in the admission transition and the receipt; it is never rendered to
  any public surface.
- **Admission receipt / audit event** — the verifiable record every
  admission transition produces: that a specific candidate was admitted
  (or rejected, or marked superseded), under whose authority, when
  (deterministic stamp), and against which prior version where relevant.
  Recall renders **none** of this raw; it is audit, not public content.
- **Visibility / rendering class** — the partition between what is
  governed continuity (recallable, and then only as a narrowed
  public/operator-safe summary) and what is raw / candidate / debug /
  source / receipt / authority material (never rendered to Discord or any
  public surface). The Recall Wedge's existing no-leak boundary (Phase
  41A §I, enforced by the live client's banned-substring scan) is the
  enforcement point; admission **must not widen it.** Candidate bodies,
  source material, authority identifiers, and receipt bodies all sit on
  the never-rendered side of this partition.

---

## F. Minimal doctrine-level packet shapes

> **Design-level only.** The blocks below are *doctrine vocabulary* for a
> future design — field-level shapes so Phase 43C starts from a shared
> picture. They are **not** implemented schemas, **not** storage tables,
> **not** Straylight or Dixie API contracts, and **not** a data model
> that exists. No file, fixture, or store is created by this phase.
> Straylight (§K) owns the canonical shapes; these are the design intent
> a future gate would reconcile against Straylight's authority. Field
> names deliberately mirror the *existing* Recall Wedge fixture
> vocabulary (`admission_state`, `continuity_actor_id`, assertion
> `kind` / `boundary` / `summary_public` / `body_private`) so an admitted
> packet is readable by the accepted recall path without changing it.

### F.1 Candidate packet

A proposed memory, not yet admitted, not recallable. Illustrative shape:

```
candidate packet (design-level; admission_state = "candidate")
- packet_kind:          "candidate_memory_packet"
- admission_state:      "candidate"            # never recallable
- candidate_id:         deterministic id (fixture-assigned, e.g. "cand-001")
- continuity_actor_id:  the shared freeside-characters app / substrate
- admission_source:     reviewed deterministic dev/operator fixture descriptor
                        (NEVER discord history / user chat / runtime corpus)
- proposed_assertions:  [ assertion-shaped entries, see below ]
- created_stamp:        deterministic logical stamp (NOT wall-clock; §F.4)
```

Each `proposed_assertion` mirrors the existing seed-memory assertion
vocabulary, but is *proposed*, not admitted:

```
proposed assertion (design-level)
- proposed_assertion_id: deterministic id
- kind:                  observation | preference | context | operator_private_note
- boundary:              public_safe | operator_private
- summary_public:        public-safe summary string | null
- body_private:          private body (NEVER rendered; never recallable while candidate)
- source_material:       provenance text (audit only; never rendered)
- character_frame_scope: [ frames this would apply to, e.g. ruggy / satoshi ]
```

A candidate packet is, from the recall surface's perspective, **absent**:
the Recall Wedge path must return the safe not-found / fail-closed result
for it (§H).

### F.2 Admission transition

The single explicit door from candidate → admitted (or → rejected, or →
superseded). Illustrative shape:

```
admission transition (design-level; the ONLY promotion door)
- transition_kind:   "admission_transition"
- transition_id:     deterministic id
- candidate_ref:     candidate_id this transition acts on
- decision:          "admit" | "reject" | "supersede"
- admission_authority: synthetic / operator-dev authority descriptor
                       (NEVER an arbitrary user; audit only, never rendered)
- supersedes_ref:    prior admitted/candidate id (only when decision = "supersede")
- decided_stamp:     deterministic logical stamp (§F.4)
- reason:            short reason label (audit; public-safe label only if surfaced)
```

Properties this shape must preserve:

- **Explicit and deliberate.** A transition is authored, never inferred.
  There is no transition produced by ambient channel traffic, by a
  passive listener, or as a side effect of recall.
- **Idempotent.** Admitting the same candidate twice must not produce two
  admitted assertions; a retry must not silently re-admit (decision-map
  §7 duplicate / idempotency gate).
- **Audited.** Every transition produces exactly one admission receipt
  (§F.4), whether the decision is admit, reject, or supersede.

### F.3 Admitted packet

The output of an `admit` (or `supersede`) transition: governed continuity
state, recallable through the accepted Recall Wedge path. Shaped to be
read-compatible with the Phase 42D `already_admitted` seed estate:

```
admitted packet (design-level; admission_state = "admitted")
- packet_kind:         "admitted_memory_packet"
- admission_state:     "admitted"             # recallable as governed continuity
- continuity_actor_id: the shared freeside-characters app / substrate
- admitted_from:       candidate_id this packet was admitted from
- admission_receipt_ref: receipt_id of the transition that admitted it (§F.4)
- assertions:          [ admitted assertion-shaped entries ]
- supersedes_ref:      prior admitted id this replaces (only for a supersede admit)
```

The admitted `assertions` reuse the *same* assertion vocabulary the
accepted Recall Wedge already reads (`kind` / `boundary` /
`summary_public` / `body_private` / `source_material` /
`character_frame_scope`). Only `boundary = public_safe`,
`summary_public` content is ever eligible for the narrowed recall render;
`body_private` and `source_material` stay on the never-rendered side of
the visibility partition (§E), exactly as today.

### F.4 Admission receipt / audit event

The verifiable record every transition produces. Audit, not public
content — recall renders none of it raw.

```
admission receipt / audit event (design-level)
- receipt_kind:       "admission_receipt"
- receipt_id:         deterministic id
- transition_ref:     transition_id this receipt records
- candidate_ref:      candidate_id acted on
- decision:           "admit" | "reject" | "supersede"
- admission_authority: who admitted/rejected (audit only; never rendered)
- decided_stamp:      deterministic logical stamp (NOT wall-clock)
- supersedes_ref:     prior id (only on supersede)
- outcome_ref:        admitted_packet id (on admit/supersede) | null (on reject)
```

Design note on determinism: to keep the future proof byte-stable and
fixture-driven (consistent with the Recall Wedge's deterministic
posture), receipt and packet stamps are **deterministic logical stamps**
supplied by the fixture / transition (e.g. a monotonic sequence or a
fixture-provided timestamp), not a live wall-clock read. This is a design
property, not an implemented clock.

### F.5 Recall proof link

How the shapes above tie back to the **accepted, unchanged** Recall Wedge
read path — this is the seam that makes admission a *bounded* wedge rather
than a rewrite:

- **Before admission (candidate or rejected):** a recall attempt resolves
  to **not-found / fail-closed**. In the accepted live client's
  classification vocabulary this is *not* `served`; it is the safe
  not-found / denied / fail-closed family the Phase 42D path already
  renders as a generic, no-leak ephemeral summary. The candidate's
  `body_private` / `source_material` never appear.
- **After an `admit` transition:** the admitted packet (§F.3) is governed
  continuity the same shape the Recall Wedge already reads. A recall then
  resolves to `classification = served` / `outcome = served` /
  `route = /api/recall/intake` — the **same** accepted result Phase 42D
  produced, rendered the **same** ephemeral, operator-gated, narrowed
  way, with no new fields and no widened render.
- **The recall path is unchanged.** Recall-after-admission reuses the
  Phase 41B / 42C live command and the Phase 37C client *as-is*. The
  Admission Wedge proves only the *transition*; the recall half is
  already accepted. The no-leak boundary that guards recall today is the
  same boundary that guards recall-after-admission — admission must not
  add a field that path would render.

These shapes are design intent. They are owned canonically by Straylight
(§K); this phase neither implements nor stores them.

---

## G. Lane A design (fixture / operator admission packet)

Lane A is the **safest first lane** from Phase 43A §H and the lane this
design commits to as the shape a future Phase 43C would implement. The
other lanes stay where Phase 43A put them: Lane B (a dev-only
`/remember-this`-shaped candidate command) is a riskier, **separately
gated**, later follow-up; Lane C (automatic Discord chat ingestion) and
Lane D (full production Straylight admission / storage / auth / consent)
are **blocked** (§M). Lane A introduces no live user ingestion, no Discord
command for admission, and no production store.

The Lane A arc, as a design (each step is *designed* here, **not**
implemented):

1. **Deterministic fixture candidate.** A reviewed, deterministic
   dev/operator candidate packet (§F.1) is authored as a fixture — a
   fixed source, not user chat, not Discord history, not generated at
   runtime. It exists as a candidate (`admission_state = "candidate"`)
   and nothing more.
2. **Held as candidate only / non-recallable.** Before any transition the
   candidate is not recallable as governed continuity (§D). A recall
   attempt against it returns the safe not-found / fail-closed result
   (§F.5, §H) — never `served`, never a candidate body.
3. **Explicit admission transition.** A deliberate, reviewed admission
   transition (§F.2) — invoked under synthetic / operator-dev authority,
   not implicit, not automatic, not from chat — accepts the candidate
   (`decision = "admit"`). The transition is idempotent and produces
   exactly one admission receipt (§F.4).
4. **Deterministic admitted output.** The accepted candidate becomes a
   deterministic admitted packet (§F.3) / estate update, owned by a
   Straylight-owned admission path (§K), read-compatible with the
   accepted recall path. The receipt records who admitted it, when
   (deterministic stamp), and which candidate.
5. **Recall after admission.** The **same** accepted Recall Wedge path
   (Phase 41B / 42C live command + Phase 37C client, unchanged) recalls
   the now-admitted state and classifies it `served`, rendering the same
   ephemeral, operator-gated, narrowed `classification` / `outcome` /
   `route` / `reason` summary Phase 42D accepted — no raw candidate
   payload, no admitted-packet body, no receipt body, no source material,
   no authority identifier, no IDs / tokens / debug material.

Lane A posture (carried from Phase 43A §K, unchanged):

- **Storage:** fixture / dev-operator **deterministic packet** only.
  Durable Postgres-backed production estate storage is **not** in Lane A
  and remains later, reachable only under a gate that satisfies
  decision-map §7 (Postgres canonical, vector index as derived retrieval
  only). This phase adds no storage at all; Lane A's *implementation*
  would use only fixture / deterministic packets.
- **Authority:** synthetic / operator-dev only. No claim that arbitrary
  user memory can be admitted; no production consent / identity claim.
- **Public surface:** no public-channel output, no public remember-this,
  no automatic memory from chat, no ambient listening, no raw candidate
  payloads in any public / Discord output.

Lane A is the smallest proof of the §D invariant and the §F.5 recall
link. It is a controlled dev/operator demonstration that the admission
transition is safe — **not** production admission, **not** public
remember-this, **not** user-chat ingestion, **not** a durable production
store.

---

## H. Non-recallability proof (before admission)

The first proof obligation a future Lane A implementation must discharge,
designed here as a concrete test target:

- **Given** a deterministic candidate packet (§F.1) that has **not** been
  through an admission transition,
- **when** the accepted Recall Wedge path attempts to recall against it,
- **then** the result is the safe **not-found / fail-closed** family —
  *not* `classification = served` — and the rendered output is the
  generic, no-leak, ephemeral, operator-gated summary the Phase 42D
  fail-closed path already produces.

What the proof must show, field by field:

- the candidate is **absent / denied / not included** in the recall
  result — it does not appear as a served assertion, a count, or a public
  summary;
- no `body_private`, `source_material`, `candidate_id`,
  `proposed_assertion_id`, or admission-source material appears in any
  rendered output (the existing no-leak banned-substring boundary catches
  these unchanged);
- the candidate's existence does **not** imply it is safe or usable: a
  candidate that exists is still absent from governed recall (§D).

This is the baseline the whole invariant rests on: *existence is not
recallability.* It reuses the accepted fail-closed behavior; it does not
invent a new refusal.

---

## I. Rejection proof

The second proof obligation, designed here as a concrete test target:

- **Given** a candidate packet that an admission transition has
  **declined** (`decision = "reject"`, §F.2), producing a rejection
  receipt (§F.4),
- **when** the accepted Recall Wedge path attempts to recall against it
  (before, during, or after the rejection),
- **then** the candidate **never** surfaces as admitted continuity — the
  recall result is the safe not-found / fail-closed family, exactly as in
  §H, and stays that way permanently.

What the proof must show:

- **rejection is terminal for recallability** — a rejected candidate has
  no path back to `admission_state = "admitted"` without a *new*,
  separately authored admission transition against a *new* candidate;
  the reject decision cannot be silently reversed into a served recall;
- **the rejection is audited, not rendered** — the rejection receipt
  records who rejected, when (deterministic stamp), and why; none of that
  receipt body is ever rendered to a public / Discord surface;
- **no leakage on the rejected path** — the rejected candidate's
  `body_private` / `source_material` / authority identifiers never appear
  in any output; the no-leak boundary holds on the rejection path exactly
  as on the recall path.

Rejection proves the negative half of the invariant: the door (§F.2) can
say *no*, and *no* means never-recallable.

---

## J. Supersession / correction proof

The third proof obligation, designed here as a concrete test target:

- **Given** an admitted assertion A1 (admitted via a prior transition),
  and a later candidate C2 that **corrects** it,
- **when** an admission transition with `decision = "supersede"` and
  `supersedes_ref = A1` admits C2 as a new admitted packet A2 (§F.2,
  §F.3),
- **then** ordinary recall returns the **corrected** state (A2) and does
  **not** leak the wrong prior state (A1) as governed continuity.

What the proof must show:

- **the corrected state supersedes cleanly** — after the supersede
  transition, a recall resolves to `served` against A2; the
  `supersedes_ref` links A2 → A1 for audit;
- **the wrong prior state does not leak into ordinary recall** — A1, once
  superseded (`admission_state = "superseded"`), does not surface through
  the ordinary Recall Wedge path as governed continuity; the recall
  surface sees the corrected state, not the mistake;
- **supersession is a doctrine partition, not a forget / revoke UI** — in
  the MVP wedge, "what happens to the prior version" is resolved by the
  admitted-vs-superseded visibility partition (§E) and the
  `supersedes_ref` link, **not** by an implemented forget / revoke /
  correction UI (which stays blocked, §M). The superseded record may
  remain for audit; it is simply not recallable as ordinary governed
  continuity.

Supersession proves the invariant survives *change*: correcting memory
must not surface the thing being corrected.

---

## K. Cross-repo responsibility notes

Stated at a **decision / boundary level** only. This phase authorizes
implementation in **no** repo; it names where responsibility would
eventually sit so a future design does not put it in the wrong place
(carried from Phase 43A §J, decision-map §7).

- **Straylight eventually owns the primitive.** Straylight would
  eventually own the canonical admission / estate / receipt semantics:
  what a candidate is, what admission means, what an admitted packet /
  estate update is, and what an admission receipt records. The §F shapes
  are **design intent that Straylight's canonical semantics would own and
  reconcile** — Straylight is the admission authority and the canonical
  store. Freeside Characters is a frame over it, never the admission
  record or the source of truth.
- **Dixie route / policy may come later.** Dixie would eventually own the
  service route / policy / auth boundary for admission, the way it
  already owns `POST /api/recall/intake` for recall. An admission route,
  its policy, and its auth boundary are Dixie's to define **when a future
  gate authorizes them** — not in this design and not in Lane A's first
  implementation, which uses fixtures / deterministic packets, not a live
  admission route.
- **Freeside Characters remains a controlled operator surface later, not
  the primitive owner.** Freeside Characters / loa would eventually be the
  live Discord surface / controlled operator demo for an admission proof,
  the way it is the live recall surface today. It renders only the safe
  authorized recall summary; it does **not** become the admission
  authority, the admission record, or the canonical store. It is a frame,
  not the substrate.

**Do not authorize implementation in any repo in this phase.** This
section is a boundary sketch for a future design, not a work order. A
future admission-wedge phase must re-open the gate that owns the item
(decision-map §7) before any repo implements anything.

---

## L. Acceptance criteria for Phase 43B

Phase 43B (this design) is acceptable if **all** of the following hold:

- the **design doc is added** (this file, `docs/ADMISSION-WEDGE-MVP-DESIGN.md`);
- it **defines the candidate / admission packet shapes** at a design
  level — candidate packet, admission transition, admitted packet,
  admission receipt, and the recall proof link (§F) — explicitly framed
  as doctrine, **not** as implemented schemas, storage, or API contracts;
- it **defines the explicit admission transition** (the candidate →
  admitted door) and the **admission receipt / audit event** (§F.2, §F.4);
- it **makes the §I-of-43A acceptance criteria concrete as test targets
  before implementation** — non-recallability before admission (§H),
  rejection (§I), and supersession / correction (§J);
- it **prefers Lane A** (fixture / operator admission packet) as the
  first proof and holds Lanes C / D blocked, Lane B separately gated
  later (§G, §M);
- it **keeps storage at fixture / dev-operator deterministic packet**,
  **authority synthetic / operator-dev only**, and **every public-surface
  posture intact** (§G);
- it **preserves the core invariant** verbatim: candidate memory is not
  admitted memory, is not recallable as governed continuity, and becomes
  recallable only after an explicit admission transition (§D);
- it **reuses the accepted Recall Wedge path unchanged** for
  recall-after-admission and preserves the fail-closed baseline as a
  required regression (§F.5, §H);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no command / Dixie route / Straylight store / seed / admission path /
  memory write / storage** is added;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs / tokens / JWTs / admin keys / service tokens /
  wallets / Postgres URLs / live service URLs / Railway IDs / Discord
  snowflakes / seeded assertion IDs** appear in this doc;
- **no raw Dixie request / response bodies, recall packs, receipts, or
  admission packet bodies** are pasted (the §F shapes are field-name
  doctrine, not recorded payloads);
- **no production rollout claim**, **no production admission claim**, and
  **no admission-wedge acceptance claim** is made — the wedge is
  *designed*, not proven;
- it **does not imply** Finn is production-wired, that production storage
  / admission exists, that candidate memory is safe or usable merely by
  existing, that Discord chat becomes memory, or that user consent / auth
  is solved;
- **all blocked work remains blocked** (§M).

The acceptance of a *future* Admission Wedge MVP implementation (a later
phase, not this one) must additionally be a redacted docs-only report (the
Phase 41D / 42D / 39E template): redacted operator observations only, no
screenshots, no raw IDs / tokens / payloads / receipts.

---

## M. Blocked work

The following remain explicitly blocked. **None is authorized by Phase
43B** (this carries forward Phase 43A §N, decision-map §7 / §8, plus the
items this phase's own scope bars):

- production memory admission;
- source code, tests, or package / lockfile changes in Phase 43B;
- any storage (fixture, deterministic packet, Postgres, vector, or
  otherwise) — this phase adds none;
- a Discord command implementation (including any `/remember-this`);
- a live Dixie admission route;
- a Straylight production store;
- memory writes from Discord;
- a "remember this" affordance / surface (public or otherwise);
- public remember-this;
- user-facing admission UX;
- automatic memory from chat / Discord chat becoming memory;
- arbitrary user memory writes;
- Discord message-history ingestion as memory or admission source;
- live Discord message ingestion;
- hidden / ambient listening;
- candidate-memory writes (Phase 43B writes none; a future controlled
  dev/operator candidate → admitted transition may only be *implemented*
  under its own separate gate, never by this phase);
- freeform recall query input;
- cross-user consent;
- cross-user / Person-B-to-Person-A memory access or sharing;
- production auth / consent;
- public recall / public channel-visible recall or output;
- public / production rollout;
- durable production / Postgres-backed estate storage;
- a full production Straylight admission / storage / auth / consent
  architecture;
- mutation of `/recall-wedge-demo` or `/recall-wedge-live-demo` into an
  admission command;
- global registration;
- Telegram;
- private chat;
- direct Finn runtime / audit wiring beyond existing seams (Finn is not
  production-wired and this design neither requires nor claims it);
- LLM rewriting;
- character voice admission / rendering;
- forget / revoke / correction implementation (supersession is doctrine
  here, §J — not a UI);
- public renderer expansion;
- raw candidate / debug / private / source / receipt / authority material
  in any public / Discord output.

If a later phase needs any item above, it must propose a phase naming the
item, the proof obligation it carries, and the decision artifact it
re-opens. Phase 43B authorizes none of them; Lane A's *implementation* is
explicitly barred from the blocked lanes (§G lanes C / D) and from
everything above.

---

## N. Next possible Phase 43C options

Phase 43B authorizes **none** of the following — it is a design, and it
opens no implementation. Each option carries its own proof obligation and
re-opens its own decision artifact under the decision-map §7 gates:

- **a. Phase 43C — Lane A fixture / operator admission packet
  implementation.** The first reviewed implementation of the §G Lane A
  arc and the §H / §I / §J proofs, only after this design is accepted,
  under decision-map §7 and its own reviewed PR. It would write
  deterministic candidate / admitted / receipt *fixtures* and the
  transition that moves between them under synthetic / operator-dev
  authority — fixture / deterministic packet only, no production store,
  no Discord admission command, no live admission route. **The
  recommended sequel — but it is not authorized here.** *Status note: a
  Phase 43C **fixture / operator-contract** now exists at
  `docs/admission-wedge/fixtures/` — it proves the §D invariant against a
  deterministic fixture graph with a dependency-free validator, but it is
  contract-only and is **not** this Lane A implementation; the runtime
  Lane A implementation remains separately gated.*
- **b. Phase 43C-alt — Straylight / Dixie cross-repo contract request
  first.** Before any implementation, a docs-level contract request to
  Straylight (canonical admission / estate / receipt semantics) and Dixie
  (admission route / policy / auth boundary) — analogous to the existing
  Recall Wedge Dixie contract request / reconciliation docs — so the §F
  shapes are reconciled against the canonical owner (§K) before code
  exists. A possible precondition to option (a).
- **c. Separate dev-only `/remember-this` (Lane B) gate.** A riskier
  command-surface follow-up that introduces candidate creation through a
  gated dev-only command. Only under its **own separate gate**, never as
  the MVP wedge's first step, never folded into 43C's first Lane A
  implementation.
- **d. Stop and preserve the current state as the resting state.** Treat
  the accepted Phase 42D controlled dev/operator seeded live recall, plus
  this 43B design, as the resting state and take no implementation
  action; public rollout, production admission, and every blocked item
  (§M) stay blocked.

These options are recorded for orientation. Phase 43B commits to none of
them and authorizes no implementation; the *next* phase is the place to
commit to one, under its own gate.

---

## O. Cross-references

- `docs/admission-wedge/fixtures/` — **Phase 43C** Admission Wedge
  fixture / operator-contract (added after this design). It makes the §D
  invariant and the §H / §I / §J proof obligations mechanically checkable
  against a small deterministic candidate → transition → admitted →
  recall-proof fixture graph, with a dependency-free validator. It is
  **fixture / operator-contract only** — **not** the §N(a) Lane A
  implementation, **no** runtime, **no** Discord command, **no** live
  admission route, **no** storage. The Lane A implementation remains a
  later, separately gated phase.
- `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A decision gate (PR #151); the authority that selected the
  Admission Wedge and recommended this design (its §M). This design
  discharges that recommendation and may not exceed its boundary.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  §7 (live memory admission gates) and §8 (prohibitions) govern any
  admission work; §5o / §9 forward-reference this doc as the Phase 43B
  target.
- `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  accepted controlled dev/operator seeded live recall (PR #150); the
  read-side primitive this design reuses unchanged for
  recall-after-admission.
- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; the authority that scoped
  the seeded dev/operator estate Phase 42D served (storage posture
  inherited via §G).
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  live-Dixie Discord decision gate; the `/recall-wedge-live-demo` command
  shape and the no-leak boundary the recall-after-admission step reuses
  unchanged.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, env config, and the classification
  vocabulary (`served` and the not-found / fail-closed family) the §F.5
  recall proof link narrows into.
- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc; the
  raw-vs-candidate-vs-admitted separation and "Discord interaction logs
  are not memory by default" posture this design preserves.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  live recall handler; the read-side primitive a future
  recall-after-admission proof exercises unchanged (**unchanged by Phase
  43B**).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  operator/dev-only live Dixie client; the only live-egress seam, the
  classification vocabulary §F.5 reuses, and the no-leak banned-substring
  boundary admission must not widen (**unchanged by Phase 43B**).
