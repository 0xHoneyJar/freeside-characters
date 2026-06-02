# Admission Wedge — Runner Acceptance / Next-Lane Decision Gate

> **Phase 44D** (docs / decision only). Date: 2026-06-02. Companion to
> `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` (Phase 44B reducer
> acceptance / next-lane gate — the gate that accepted the Phase 44A
> reducer and *selected* the Phase 44C runner this gate now accepts),
> `docs/ADMISSION-WEDGE-MVP-DESIGN.md` (Phase 43B design — the candidate /
> admission packet shapes, the §D invariant, and the §H / §I / §J proof
> obligations the proof stack discharges *in code*),
> `docs/admission-wedge/fixtures/README.md` (Phase 43C fixture /
> operator-contract — the deterministic candidate → transition → admitted →
> recall-proof graph the reducer reduces and the runner reads), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything this
> gate points toward).
>
> This document is a **decision gate**. It accepts Phase 44C (the
> fixture-bound dev/operator reducer runner, merged via PR #158) as the
> local runner proof, decides the next lane, and selects it — and it
> **implements nothing**. It adds no source, test, fixture JSON, package,
> lockfile, config, CI, or generated change; no runtime Discord behavior;
> no Discord command; no Dixie route; no Straylight store; no admission
> path; no memory write; no storage. If a step seems to require reaching
> past these boundaries, the answer is to open the separate later gate that
> owns it — not to relax it from this decision.

---

## 1. Phase title and status

**Phase 44D — Admission Wedge runner acceptance / next-lane decision
gate.**

- Phase 44D is **docs / decision only.** It produces this acceptance /
  decision gate and, where useful, the smallest possible cross-reference
  back-notes in the Phase 44B reducer-acceptance gate, the Phase 43B
  design, the Phase 43C fixture README, and the Phase 35A decision map. It
  introduces no source, test, fixture JSON, package, lockfile, config, CI,
  or generated change.
- **No implementation is authorized by this PR.** Phase 44D accepts the
  Phase 44C runner as a fixture-bound local proof and *selects* the next
  lane (a future Phase 45A); it does **not** implement that lane, and it
  pre-approves no future PR.
- Phase 44D **changes no runtime behavior.** No Discord command, no
  dispatch / startup / command-registration change, no public renderer
  change, no package export change, no live client change. The runner
  accepted here remains imported only by its own test and its local
  `import.meta.main` CLI guard, exactly as Phase 44C landed it.
- Phase 44D **does not claim the admission wedge is proven as a product.**
  What is accepted is a pure, local, fixture-bound runner over an
  already-accepted, fixture-bound, pure reducer — not a live admission
  implementation, not production memory, and not a user-facing write path
  (§3, §4).

---

## 2. Decision source

This gate is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder. **These source / doc artifacts are evidence only;
Phase 44D modifies none of them except for the small cross-reference
addenda named in §11.**

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
  acceptance / next-lane decision gate (docs / decision only). It accepts
  the Phase 44A reducer as the fixture-bound local reducer proof, ranks
  the next-lane options, and **selects Phase 44C — a fixture-bound
  dev/operator reducer runner** (its Option A) under bounded scope (§8.1)
  and acceptance criteria (§9). It implements nothing.
- **Phase 44C / PR #158** —
  `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`). The fixture-bound dev/operator reducer runner: a local
  script / test-only runner that *reads* the existing Phase 43C fixtures
  and *calls* the existing Phase 44A reducer to print operator-safe
  scenario summaries for the five Admission Wedge scenarios. It is the
  artifact this gate accepts.

Phase 44D inherits the Phase 43A / 43B / 44B authority boundary verbatim:
it may *accept* a fixture-bound local runner proof and *select* a
docs / cross-repo contract request as the next lane; it may **not**
authorize production admission, public remember-this, Discord history
ingestion, a live Dixie admission route, or a full production Straylight
admission / storage / auth / consent architecture.

---

## 3. What Phase 44C proved

Phase 44C accepted a local dev/operator runner — an ergonomics layer over
the accepted Phase 44A reducer and the Phase 43C fixtures. It proves, *in
code* and against the deterministic fixture graph, that an operator can
inspect the §D invariant without re-reading source. Specifically, the
runner:

- **reads the existing Phase 43C fixture JSON using Node built-ins** —
  `node:fs` / `node:path` / `node:url` only; it loads the candidate /
  transition / admitted / recall-proof fixtures from disk read-only;
- **calls the existing Phase 44A reducer** — it routes every scenario
  through `reduceAdmissionFixtureScenario` and projects its results; it
  reimplements no reducer semantics and re-declares no reducer primitive
  (verified by static source guards in the runner test);
- **emits deterministic safe summaries for the five Admission Wedge
  scenarios**, each resolving to the outcome the gate expects:
  - `before_admission_excluded` — the pending candidate (`cand-001`) is
    `excluded` before admission, reason `candidate_not_admitted`, with no
    included assertion;
  - `accepted_admitted_included` — only after an explicit accept
    (`trans-001`) is the admitted assertion (`assn-001`) `included`, reason
    `admitted_active_assertion`, with no candidate id surfaced;
  - `rejected_excluded` — the rejected candidate (`cand-002`) is
    `excluded`, reason `candidate_rejected`, with nothing minted or
    included;
  - `supersession_corrected_only` — the corrected active assertion
    (`assn-011`) is `included` and the superseded prior state (`assn-010`)
    is excluded from ordinary recall, reason `corrected_active_assertion`;
  - `malformed_fail_closed` — a synthetic, in-memory malformed candidate
    (carrying a private sentinel + a long-id run and claiming
    recall-eligibility before admission, never written to fixture JSON)
    routed through the *same* reducer entry point resolves `fail_closed`
    with a stable reason code, leaking none of its unsafe input;
- **does not mutate fixture JSON** — fixture loading is read-only; it
  adds, mutates, and regenerates nothing under `docs/admission-wedge/
  fixtures/`;
- **does not reimplement reducer semantics** — it composes the Phase 44A
  reducer; its outcomes are pinned to match the reducer's results directly
  (a projection of the reducer, not an independent oracle);
- **does not leak** raw candidate payload, private sentinels, raw fixture
  bodies, long IDs, secrets, URLs, stack traces, source material,
  screenshots / binary evidence, or private candidate text — every safe
  summary is sealed through the Phase 44A reducer's
  `scanForUnsafeProjection` no-leak scan, and the runner test asserts the
  formatted report carries no sentinel, long-id run, hex address, URL,
  JWT, PEM key, stack-frame marker, or image / binary reference;
- **is not wired into Discord, Dixie, the public renderer, the live
  client, dispatch, startup, command registration, or any package
  export** — it is imported only by its own test and a local
  `import.meta.main` CLI guard (verified by a repo-wide importer sweep and
  a package-exports check in the runner test); it reaches no network /
  clock / env.

---

## 4. What Phase 44C did not prove

Stated explicitly so a future reader does not over-read the acceptance.
Phase 44C is a fixture-bound runner over a fixture-bound reducer, and
**none** of the following is implemented, authorized, or claimed by it
(nor by this gate):

- **no live admission implementation** — the runner admits nothing,
  stores nothing, and reaches no network; it is a pure projection over
  fixture-derived reducer output;
- **no live Dixie admission route** — there is no live Dixie admission
  route, and none is built or authorized;
- **no Dixie-owned admission contract** — no canonical admission / estate
  / receipt contract has been requested of, defined by, or accepted by
  Dixie / Straylight; the §F shapes remain Freeside Characters-side design
  intent, not an agreed cross-repo contract;
- **no Discord command** — the runner is wired into no Discord command,
  dispatch, startup, or command registration;
- **no `/remember-this`** — no `/remember-this` (public or dev-only)
  exists or is authorized;
- **no production storage** — no production storage exists; the runner
  persists nothing;
- **no production auth / consent** — production auth / consent is not
  built and is not claimed solved;
- **no user chat becoming memory** — user chat does not become memory; no
  chat-to-candidate or chat-to-admitted path exists;
- **no public rollout** — there is no public rollout and no
  public-channel-visible surface;
- **no production memory admission** — nothing has been admitted into any
  production memory; there is no production admission path;
- **no cross-user consent / auth model** — no model exists for who may
  admit memory on whose behalf; cross-user sharing is not addressed;
- **no Finn production wiring** — Finn is not production-wired for this
  wedge, and the runner neither requires nor claims a healthy Finn
  integration;
- **no LLM / voice behavior** — the runner performs no LLM rewriting and
  renders no character voice; it emits deterministic structured output
  only;
- **no forget / revoke / correction UI** — supersession remains a doctrine
  partition + audit link, not an implemented forget / revoke / correction
  surface.

---

## 5. Acceptance decision

**Phase 44D accepts Phase 44C (PR #158) as sufficient proof for the
following, and only the following:**

- **fixture-bound operator-readable runner behavior** — the runner
  correctly reads the Phase 43C fixtures and projects the Phase 44A
  reducer's results into operator-readable summaries;
- **local demo / report output over the existing fixtures and reducer** —
  the deterministic report (scope banner, per-scenario sections, internal
  proof counts, non-goals) is accepted as the local operator artifact;
- **safe operator summaries over the five Admission Wedge scenarios** —
  before-admission excluded; accepted / admitted included; rejected
  excluded; supersession corrected-only; malformed fail-closed;
- **no-leak runner output posture** — every safe summary and the formatted
  report are sealed against raw candidate payload, private sentinels, raw
  fixture bodies, long ids, hex addresses, URLs, JWTs, PEM keys, stack
  traces, and screenshot / binary references;
- **reducer integration without runtime wiring** — the runner composes the
  Phase 44A reducer (reimplementing none of its semantics) while staying
  out of Discord, Dixie, the public renderer, the live client, dispatch,
  startup, command registration, and the package export surface;
- **the end-to-end local proof stack** — fixtures → reducer → runner — is
  accepted as a complete *local* proof of the §D invariant's
  inspectability.

**Phase 44D does not accept Phase 44C as any of the following:**

- **not** production admission;
- **not** runtime storage;
- **not** live Dixie admission;
- **not** a public (or any) Discord command;
- **not** a user-facing write path;
- **not** platform-level admission UX.

The acceptance is bounded to the fixture-bound local runner and the local
proof stack beneath it. It changes no runtime behavior and authorizes no
implementation beyond the next lane selected in §7, under that lane's own
boundaries (§8) and acceptance criteria (§9).

---

## 6. Next-lane options

The candidate next lanes, classified. Phase 44D authorizes **none** as
implementation; it ranks them so the selection in §7 is explicit.

- **Option A — Dixie-side Admission Wedge contract request / handoff.
  *Recommended next.*** A docs-level, cross-repo request artifact authored
  on the Freeside Characters side that asks the Dixie / Straylight owners
  to define or accept a live admission contract *later* (analogous to the
  existing Recall Wedge Dixie contract-request / reconciliation docs). It
  would summarize the accepted Freeside Characters proof stack (43B design
  · 43C fixtures · 44A reducer · 44C runner) and enumerate what Freeside
  Characters needs from Dixie for a future live admission contract. It
  carries forward the §D invariant — **candidate memory is not admitted
  memory until an explicit admission transition accepts it** — as the
  non-negotiable the contract must preserve. It would **not** implement
  Dixie code, a live route, or any admission path. Now that the local
  proof stack clarifies the operator workflow and the expected outputs,
  the contract request can reflect a real fixture-bound shape rather than
  a guess — the sequencing Phase 44B (its §6 Option C) anticipated.
- **Option B — Freeside Characters local hardening / operator runbook.
  *Defer.*** A local hardening pass or an operator runbook for repeated
  manual demos of the runner. The local proof stack
  (fixtures → reducer → runner) is sufficient for now; this is worth doing
  only if operators need repeated manual demos. Defer until that need is
  real.
- **Option C — live Dixie admission route gate. *Blocked.*** A live Dixie
  admission route. **Blocked.** It requires a Dixie-side contract first
  (Option A), then service auth, storage / admission semantics, consent /
  auth design, and a separate decision. The route / policy / auth boundary
  is Dixie-owned (and Straylight-owned for the canonical semantics). Not
  reachable from this gate.
- **Option D — dev/operator explicit candidate command. *Blocked /
  separately gated.*** A dev/operator-only command that creates a candidate
  (the Lane B `/remember-this`-shaped affordance from the design doc §G).
  It **must not** be conflated with a public `/remember-this`, and it
  requires live contract / storage / auth choices first. Separately gated;
  not authorized here.
- **Option E — package export for the reducer / runner. *Defer.*** Adding
  the reducer or runner to a package export. Exporting implies API
  stability for what is still fixture-bound doctrine and should wait until
  a concrete in-repo consumer requires it. Defer until that consumer
  exists, and then under its own justification.
- **Option F — stop and preserve the Admission Wedge proof. *Available.***
  Treat the Phase 44C runner plus the proof stack beneath it and this gate
  as the resting state and take no implementation action — available if we
  decide the local Admission Wedge proof is enough for this milestone.
  Always available as the stop.

---

## 7. Selected next lane

**Phase 45A — Dixie-side Admission Wedge contract request / handoff
(Option A).**

Phase 44D selects Option A as the next lane: a future docs / cross-repo
request artifact, authored on the Freeside Characters side, that hands the
accepted proof stack to the Dixie / Straylight owners and asks them to
define or accept a live admission contract *later*. Option B is deferred,
Options C and D are blocked / separately gated, Option E (package export)
is deferred until a consumer requires it, and Option F (stop) remains
always-available. Phase 44D authorizes only the bounded Phase 45A scope in
§8 — it does not implement it, and the artifact it selects authorizes no
implementation in any repo.

---

## 8. Phase 45A authorization boundaries

Phase 44D authorizes only a future docs / cross-repo **request / handoff
artifact** — a Freeside Characters-side request *to* Dixie, **not** a
Dixie implementation and **not** a Freeside Characters implementation.

### 8.1 Allowed future Phase 45A scope

- a **docs-only request / handoff** artifact (a new doc, e.g.
  `docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`, plus the smallest
  cross-reference back-notes);
- **summarize the Freeside Characters proof stack** the request hands off:
  - Phase 43B design (the §F packet shapes, §D invariant, §H / §I / §J
    proof obligations);
  - Phase 43C fixtures (the deterministic candidate → transition →
    admitted → recall-proof graph + validator);
  - Phase 44A reducer (the §D invariant proven *in code* with stable
    fail-closed reason codes and a no-leak seal);
  - Phase 44C runner (the operator-readable safe summaries over the five
    scenarios);
- **define what Freeside Characters needs from Dixie** for a later live
  admission contract;
- **enumerate the candidate / admitted / rejected / superseded semantics**
  the contract must preserve;
- **request Dixie-side or cross-repo-owned contract decisions** for:
  - the candidate intake envelope;
  - the explicit admission transition;
  - the admitted assertion shape;
  - the rejection transition;
  - the supersession / correction transition;
  - the admission receipt / audit fields;
  - the recall-eligibility boundary (when an admitted assertion becomes
    recallable through the accepted Recall Wedge path);
  - the service-auth-vs-end-user-authorization distinction;
  - the storage / admission non-goals (what the contract explicitly does
    *not* cover);
  - the no-leak public-response requirements (the boundary admission must
    not widen);
- **preserve, explicitly, that the request does not authorize
  implementation** — it is a handoff and a question set, not a work order
  for any repo.

### 8.2 Explicitly NOT authorized for Phase 45A

- Dixie code changes;
- Freeside Characters source changes;
- a live admission route;
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
- LLM / voice behavior;
- Finn production wiring.

Phase 45A is a request / handoff, not a build. It must not become a live
surface, a write path, a contract acceptance, or an export by stealth.
Requesting a contract is not the same as having one: the request
**enumerates** what Dixie / Straylight would own and decide; it does not
decide it, and an unmet request leaves every blocked lane blocked. If a
later phase needs any item in §8.2, it must open the gate that owns it
(decision-map §7 / §8) — Phase 44D authorizes none of them.

---

## 9. Required acceptance criteria for a future Phase 45A

A future Phase 45A is acceptable only if it passes **all** of the
following:

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
- a forbidden-claim scan finds no hits except negated blockers (the
  request / its docs claim no production admission, no production storage,
  no production auth / consent, no public remember-this, no Discord
  history ingestion, no chat-becomes-memory, no live Dixie admission
  route, no package export, no existing Dixie admission contract, and no
  Finn production wiring);
- the request artifact carries **no raw IDs / secrets / tokens / URLs /
  screenshots / binary evidence** — no private-body sentinels, long id
  runs, hex addresses, URLs, JWTs, or PEM keys, exactly as the Phase 44A
  reducer seal and the Phase 43C validator enforce;
- a Codex audit confirms the artifact is a **docs / cross-repo request
  only** — it implements nothing in any repo, accepts no contract, and
  authorizes no implementation.

The Phase 45A acceptance, if recorded, should be a docs report consistent
with the accepted ladder template (redacted operator observations only; no
screenshots; no raw IDs / tokens / payloads / receipts).

---

## 10. Naming rules

Preserved verbatim from Phase 43B §B.1 / Phase 43C / Phase 44B; binding
for this document:

- **"Freeside Characters"** / **`freeside-characters`** is the current
  app / repo (the Discord app, the Railway project and service that runs
  the bot). The current bot identity is **"loa."**
- **"loa"** is the current Discord bot / app identity.
- **"Freeside platform"** is reserved for the future broader platform only
  and is out of scope for this gate.
- Do **not** call the current app / repo simply **"Freeside."**
- Do **not** imply **Finn** is production-wired. Finn is not
  production-wired for any wedge here, and this gate neither requires nor
  claims a healthy Finn integration.
- **"Dixie"** is the deployed Recall Wedge service; **"Straylight"** is
  the memory / continuity substrate that would eventually own the
  canonical admission / estate / receipt semantics. Neither is wired for
  admission by this gate, and neither has accepted an admission contract.

---

## 11. Cross-references

Minimal status / cross-reference back-notes are added to the docs below
(small addenda only; the old docs are not rewritten):

- `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` — Phase 44B reducer
  acceptance / next-lane gate (PR #157). Gains a one-line Phase 44D note
  that this gate accepts the Phase 44C runner it selected and selects a
  docs / cross-repo Phase 45A Dixie contract request.
- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains
  a one-line Phase 44D note in its §O cross-references.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 44D cross-reference
  note.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted §5r Phase 44D addendum and a one-line §9 status note;
  §7 (live-memory-admission gates) and §8 (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 44D**):

- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158); the artifact accepted here.
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the reducer the
  runner composes, accepted by Phase 44B.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` /
  `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — the accepted
  Recall Wedge Dixie contract-request / reconciliation docs; the
  docs-level cross-repo-request shape the selected Phase 45A admission
  contract request would mirror (read only; unchanged here).
- `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A decision gate (PR #151); the authority that selected the
  Admission Wedge, ranked the lanes (its §H), and named the cross-repo
  responsibility boundaries (Straylight owns the canonical admission /
  estate / receipt semantics; Dixie owns the admission route / policy /
  auth boundary) the selected Phase 45A request would address.
