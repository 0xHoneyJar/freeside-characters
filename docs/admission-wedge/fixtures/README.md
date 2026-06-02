# Admission Wedge fixtures — Phase 43C

Deterministic fixtures attached to `docs/ADMISSION-WEDGE-MVP-DESIGN.md`
(Phase 43B design). They follow Phase 43B and make its core invariant
**provable** against a small, fixture-bound graph — without implementing
production admission.

> **Phase 43C is fixture / operator-contract only.** It is the first
> reviewed artifact after the Phase 43B design, but it is **not** the
> Lane A implementation. It writes deterministic candidate / transition /
> admitted / recall-proof **fixtures** and a dependency-free validator
> that asserts the invariant holds across them. It does **not** implement
> production admission, **does not** implement a live command, **does
> not** authorize `/remember-this`, and **does not** ingest Discord
> history. A future live implementation remains separately gated under
> the decision-map §7 gates.

> **Phase 44A status note (fixture-bound reducer / adapter).** Phase 44A
> adds a pure, dependency-free local reducer / adapter over these fixtures
> at
> `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
> (+ test) that proves the invariant below *in code*. It is **fixture-bound
> only** — it admits nothing, stores nothing, reaches no network, and is
> imported only by its own test (not wired into Discord, Dixie, the public
> renderer, the live client, dispatch, startup, command registration, or
> any package export). It does **not** mutate these fixtures and does
> **not** authorize a live admission implementation. The runtime Lane A
> implementation and the decision-map §7 gates remain separately gated.

## What this proves

The load-bearing invariant, carried verbatim from Phase 43B §D / Phase
43A §E, made mechanically checkable here:

1. **Candidate memory is not admitted memory.** A candidate
   (`admission_state = candidate_pending`) and an admitted assertion
   (`admission_state = admitted`) are distinct states.
2. **Candidate memory is not recallable before admission.** The
   before-admission recall proof excludes the candidate
   (`recall_result = excluded`,
   `exclusion_reason = candidate_not_admitted`), and the candidate body
   never appears in recall output.
3. **A candidate becomes recall-eligible only after an explicit admission
   transition accepts it.** Only after `trans-001` accepts `cand-001`
   does `assn-001` exist and recall classify `served`.
4. **A rejected candidate never becomes recallable.** `trans-002` rejects
   `cand-002`, mints no admitted assertion, and the rejection recall
   proof stays excluded permanently.
5. **A superseded / corrected candidate does not leak the wrong prior
   state into ordinary recall.** `trans-011` accepts the correction
   `cand-011` as `assn-011` and supersedes `assn-010`; ordinary recall
   returns only the corrected active `assn-011`, never the wrong prior
   `assn-010`. The supersedes link is preserved for audit, not rendered.
6. **The proof is deterministic, local, and operator / fixture-only.**
   No wall-clock (logical stamps only), no network, no storage, no
   secrets, Node built-ins only.

## What lives here

```
docs/admission-wedge/fixtures/
  candidates/
    cand-001-accepted-pending.json     candidate that will be accepted
    cand-002-rejected-pending.json     candidate that will be rejected
    cand-010-original-pending.json     candidate admitted then corrected
    cand-011-correction-pending.json   candidate that corrects assn-010
  transitions/
    trans-001-accept.json              accept cand-001 -> assn-001
    trans-002-reject.json              reject cand-002 (no assertion minted)
    trans-010-accept-original.json     accept cand-010 -> assn-010
    trans-011-supersede.json           accept cand-011 -> assn-011, supersede assn-010
  admitted/
    assn-001-active.json               active admitted assertion
    assn-010-superseded.json           superseded prior state (audit only)
    assn-011-active-correction.json    corrected active assertion
  recall-proofs/
    proof-001-before-admission-excluded.json   candidate excluded pre-admission
    proof-002-after-admission-included.json     admitted assertion included
    proof-003-rejected-excluded.json             rejected candidate excluded
    proof-004-supersession-corrected.json        corrected included, prior excluded
  validate-fixtures.mjs                deterministic, dependency-free validator
  README.md                            this file
```

## The fixture graph

```
cand-001  --trans-001(accept)-->  assn-001 (active)        --> proof-002 (served, included)
   |                                                            audit links: cand-001, trans-001, rcpt-001
   `--(pending)---------------------------------------------> proof-001 (not_found, excluded)

cand-002  --trans-002(reject)-->  (no assertion)           --> proof-003 (not_found, excluded)

cand-010  --trans-010(accept)-->  assn-010 (active)
cand-011  --trans-011(accept,                assn-010 -> superseded
            supersedes assn-010)-> assn-011 (active)        --> proof-004 (served, includes assn-011 only;
                                                                excludes superseded assn-010)
```

Every id is a short deterministic fixture id (`cand-*`, `trans-*`,
`assn-*`, `rcpt-*`, `proof-*`). Stamps are logical
(`fixture-logical-stamp-NNNN`), never wall-clock — so the proof is
byte-stable, consistent with the Recall Wedge's deterministic posture.

## Fixture kinds (and what they are NOT)

These are **design-level doctrine vocabulary** for a future
implementation — they are **not** implemented schemas, **not** storage
tables, **not** Dixie / Straylight API contracts, and **not** a data
model that exists. Straylight owns the canonical admission / estate /
receipt semantics (Phase 43B §K); these fixtures are design intent a
future gate would reconcile against that authority. Each fixture carries
a `schema_note` restating this.

- **Candidate packet** (`candidate_memory_packet`) — a proposed memory,
  `admission_state = candidate_pending`, `recall_eligibility =
  ineligible`. From the recall surface's perspective it is absent. Its
  `candidate_payload.body_private` and `provenance.source_material` carry
  sentinels that must never reach recall output.
- **Admission transition** (`admission_transition`) — the single explicit
  door from candidate to admitted / rejected / superseded. Authored under
  `admission_authority = operator_dev_synthetic`, never an arbitrary
  user. Idempotent (a retry resolves to the same `admitted_assertion_id`)
  and audited (every transition carries a `receipt_ref` / `audit_ref`).
- **Admitted packet** (`admitted_memory_packet`) — the output of an
  accept / supersede, `admission_state = admitted`, `assertion_status =
  active`, `recall_eligibility = eligible`, read-compatible with the
  accepted Recall Wedge path. A superseded prior packet keeps
  `assertion_status = superseded` and `recall_eligibility = ineligible`.
- **Recall proof** (`admission_recall_proof`) — a deterministic record of
  what ordinary recall does at a given phase (before admission, after
  admission, rejected, supersession). It carries only short ids and
  public-safe summaries — never a private body. The source candidate and
  receipt appear under `audit_links` only, never as ordinary recall
  material.

## No-leak posture

Ordinary recall output (the four `recall-proofs/*.json`) must never carry
a private body. Candidate / admitted / superseded private bodies and
source material are tagged with sentinels
(`CANDIDATE_PRIVATE_SENTINEL_*`, `SOURCE_SENTINEL_*`,
`ADMITTED_PRIVATE_SENTINEL_*`, `SUPERSEDED_PRIVATE_SENTINEL_*`). The
validator greps every recall-proof fixture for those sentinels and fails
if any appears. This mirrors the Recall Wedge's no-leak boundary; the
Admission Wedge does not widen it.

## The validator

`validate-fixtures.mjs` is deterministic, dependency-free, and uses Node
built-ins only (`node:fs`, `node:path`, `node:url`). It adds no package
and no lockfile entry.

Run it:

```bash
node docs/admission-wedge/fixtures/validate-fixtures.mjs
```

It checks:

1. all required directories and fixture files exist;
2. every fixture JSON parses;
3. required fields exist per fixture kind (candidate, transition,
   admitted, recall-proof), plus shared `synthetic === true` and a
   consistent `actor_id`;
4. the candidate-pending fixtures are not recallable
   (`admission_state = candidate_pending`, `recall_eligibility =
   ineligible`);
5. the accepted transition references its candidate and mints the
   expected admitted assertion id;
6. the admitted packet references the accepted transition and candidate
   and is admitted / active / eligible;
7. the before-admission recall proof excludes the candidate
   (`recall_result = excluded`, classification not `served`, empty
   `included_assertion_ids`, no candidate payload rendered);
8. the after-admission recall proof includes **only** the admitted
   assertion (`[assn-001]`), not the raw candidate; the source candidate
   and admission receipt are preserved under `audit_links` only;
9. the rejected candidate mints no admitted assertion (transition
   `admitted_assertion_id = null`, no admitted packet derives from it)
   and its recall proof stays excluded
   (`exclusion_reason = candidate_rejected`);
10. the supersession recall proof includes the corrected active assertion
    (`[assn-011]`) and excludes the superseded wrong prior state
    (`assn-010`); the superseded packet is `superseded` / ineligible; the
    supersedes link is preserved for audit; the prior state is not
    rendered;
11. no fixture contains banned raw material — Discord snowflakes / long
    id runs, JWTs, secret / bearer / provider tokens, PEM private keys,
    0x addresses, postgres URLs, http(s) / Railway URLs, or
    screenshot / image / binary references;
12. no fixture **claims** production storage, production admission,
    production auth / consent, public remember-this, Discord history
    ingestion, or user chat becoming memory (only negated disclaimers —
    "no production storage", "not from chat" — are allowed);
13. the no-leak gate: no recall-proof fixture carries a private body
    sentinel.

It prints a summary (fixtures checked, assertions evaluated, checks
passed, checks failed) and an `ok` line on success. It exits `0` on
success and **nonzero** on any failure.

The validator is fixture-only: it imports no Straylight / Dixie types, it
calls no live client, it renders nothing, and it admits / stores nothing.

## What this is NOT (scope guard)

Carried from Phase 43B §M — none of the following is authorized,
implemented, or claimed by Phase 43C:

- production memory admission, production storage, or a durable estate
  store;
- a live Dixie admission route or a Straylight production store;
- a Discord command (including any `/remember-this`) or public
  remember-this surface;
- Discord message-history ingestion, live message ingestion, ambient
  listening, or user chat becoming memory;
- production auth / consent, cross-user sharing, or public rollout;
- Telegram / private-chat surfaces;
- LLM rewriting or character-voice admission / rendering;
- a forget / revoke / correction UI (supersession here is a doctrine
  partition + audit link, not a UI);
- any claim that Finn is production-wired.

If a later phase needs any of the above, it must open the gate that owns
it (decision-map §7) — Phase 43C authorizes none of them.

## Naming note (binding, carried from Phase 43B §B.1)

- **"Freeside Characters"** / **`freeside-characters`** is the current
  Discord app / this repo. The current bot identity is **"loa."** The
  bare word "Freeside" is **not** used to name the current app.
- **"Freeside platform"** is reserved for the future broader platform and
  is out of scope here.
- **"Dixie"** is the deployed Recall Wedge service; **"Straylight"** is
  the memory / continuity substrate that would eventually own canonical
  admission semantics. **"Finn"** is not production-wired for any wedge.

## Cross-references

- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (the §F packet
  shapes, §D invariant, and §H / §I / §J proof obligations these fixtures
  make concrete).
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  §7 (live memory admission gates) and §8 (prohibitions) govern any
  admission work and stay in force.
- `docs/recall-wedge/fixtures/` — the accepted Recall Wedge fixture
  pattern this directory mirrors (deterministic fixtures + a
  dependency-free no-leak validator).
- `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — **Phase 44B**
  reducer acceptance / next-lane decision gate (docs / decision only). It
  accepts the Phase 44A reducer over these fixtures as the fixture-bound
  local reducer proof and selects **Phase 44C — a fixture-bound
  dev/operator reducer runner** as the next lane. A future Phase 44C runner
  would *read* these fixtures and *call* that reducer; it would **not**
  add, mutate, or regenerate any fixture here, and it authorizes no live
  admission, storage, command, or Dixie route.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — **Phase 44C** fixture-bound dev/operator reducer runner.
  It *reads* these fixtures (read-only; it adds, mutates, and regenerates
  nothing here) and *calls* the Phase 44A reducer to print operator-safe
  scenario summaries (before-admission excluded; accepted included; rejected
  excluded; supersession corrected-only; a synthetic malformed fail-closed
  case constructed in memory, never written here). It is imported only by
  its own test and a local CLI guard — not exported from the package and
  wired into no runtime path — and it authorizes no live admission, storage,
  command, Dixie route, network call, package export, LLM / voice, or Finn
  production wiring.
- `docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md` — **Phase 44D** runner
  acceptance / next-lane decision gate (docs / decision only). It accepts
  the Phase 44C runner over these fixtures as the fixture-bound local runner
  proof and selects **Phase 45A — a docs / cross-repo Dixie-side admission
  contract request / handoff** as the next lane. It mutates nothing here and
  authorizes no live admission, a Dixie-owned admission contract, storage,
  command, Dixie route, or package export.
- `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md` — **Phase 45A** Dixie-side
  admission contract request / handoff (docs / cross-repo request only). It
  hands off this fixture / operator-contract (alongside the Phase 44A reducer
  and Phase 44C runner) to the Dixie / Straylight owners and asks them to
  define or accept a live admission contract *later*, carrying the invariant
  these fixtures prove. It mutates nothing here, reads these fixtures only as
  evidence of the local proof, implements nothing in any repo, changes no
  Dixie code, accepts no contract, and does **not** claim a Dixie admission
  contract already exists.
