# Admission Wedge — Reducer Acceptance / Next-Lane Decision Gate

> **Phase 44B** (docs / decision only). Date: 2026-06-02. Companion to
> `docs/ADMISSION-WEDGE-MVP-DESIGN.md` (Phase 43B design — the candidate /
> admission packet shapes, the §D invariant, and the §H / §I / §J proof
> obligations this gate accepts as proven *in code*),
> `docs/admission-wedge/fixtures/README.md` (Phase 43C fixture /
> operator-contract — the deterministic candidate → transition → admitted →
> recall-proof graph the reducer reduces), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix —
> §7 live-memory-admission gates and §8 prohibitions govern everything this
> gate points toward).
>
> This document is a **decision gate**. It accepts Phase 44A (the
> fixture-bound reducer / adapter, merged via PR #156) as the local
> reducer proof, decides the next lane, and selects it — and it
> **implements nothing**. It adds no source, test, fixture JSON, package,
> lockfile, config, CI, or generated change; no runtime Discord behavior;
> no Discord command; no Dixie route; no Straylight store; no admission
> path; no memory write; no storage. If a step seems to require reaching
> past these boundaries, the answer is to open the separate later gate that
> owns it — not to relax it from this decision.

---

## 1. Phase title and status

**Phase 44B — Admission Wedge reducer acceptance / next-lane decision
gate.**

- Phase 44B is **docs / decision only.** It produces this acceptance /
  decision gate and, where useful, the smallest possible cross-reference
  back-notes in the Phase 43B design, the Phase 43C fixture README, and
  the Phase 35A decision map. It introduces no source, test, fixture JSON,
  package, lockfile, config, CI, or generated change.
- **No implementation is authorized by this PR.** Phase 44B accepts the
  Phase 44A reducer as a fixture-bound local proof and *selects* the next
  lane (a future Phase 44C); it does **not** implement that lane, and it
  pre-approves no future PR.
- Phase 44B **changes no runtime behavior.** No Discord command, no
  dispatch / startup / command-registration change, no public renderer
  change, no package export change, no live client change. The reducer
  accepted here remains imported only by its own test, exactly as Phase
  44A landed it.
- Phase 44B **does not claim the admission wedge is proven as a product.**
  What is accepted is a pure, local, fixture-bound reducer that proves the
  §D invariant *in code* — not a live admission implementation, not
  production memory, and not a user-facing write path (§3, §4).

---

## 2. Decision source

This gate is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder. **These source / doc artifacts are evidence only;
Phase 44B modifies none of them except for the small cross-reference
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
  codes and a no-leak seal over every safe projection. It is the artifact
  this gate accepts.

Phase 44B inherits the Phase 43A / 43B authority boundary verbatim: it may
*accept* a fixture-bound local reducer proof and *select* a fixture-bound
local runner as the next lane; it may **not** authorize production
admission, public remember-this, Discord history ingestion, a live Dixie
admission route, or a full production Straylight admission / storage / auth
/ consent architecture.

---

## 3. What Phase 44A proved

Phase 44A accepted a pure, local, dependency-free reducer / adapter over
the Phase 43C fixtures. It proves, *in code* and against a deterministic
fixture graph:

- **candidate memory is not admitted memory** — a candidate
  (`admission_state = candidate_pending`) classifies as a proposal: not
  admitted, not recall-eligible, not ordinary recall material, distinct
  from any admitted assertion;
- **candidate memory is not recallable before explicit admission** — the
  before-admission recall projection excludes the candidate
  (`recall_result = excluded`, reason `candidate_not_admitted`, empty
  included set, no rendered candidate payload);
- **an accepted transition mints an admitted assertion** — only after an
  explicit accept transition (linked candidate ↔ transition ↔ assertion)
  does the reducer emit an admitted / active / recall-eligible assertion,
  classified `served` on the after-admission recall projection;
- **a rejected transition mints no admitted assertion and remains
  excluded** — a reject mints nothing (a reject that mints, or that is
  handed an admitted assertion, fails closed), and the rejected recall
  projection stays excluded (reason `candidate_rejected`);
- **supersession / correction recalls only the corrected active assertion
  while preserving audit / provenance** — a supersede accept mints the
  corrected active assertion, records the supersedes link for audit, and
  the recall projection includes only the corrected assertion while
  excluding the wrong prior state; the prior state is never rendered as
  active ordinary recall material;
- **malformed / unsafe fixture inputs fail closed** — non-objects, wrong
  `fixture_kind` / unsupported `fixture_version`, missing required fields,
  broken candidate ↔ transition ↔ assertion linkage, an accept with no
  minted assertion, a reject that mints one, and a candidate that claims
  recall-eligibility before admission all resolve to a stable fail-closed
  reason code rather than a partial or thrown result;
- **fail-closed details are sealed through stable reason-code rendering
  and leak nothing** — every fail-closed `detail` is derived only from its
  stable reason code, never from raw input; the no-leak seal scans every
  safe projection and every fail-closed output and refuses to emit raw
  sentinels, long id runs, hex addresses, URLs, or PEM private keys.

The Phase 44A test suite pins these behaviors (57 tests / 858 assertions
at acceptance), including non-vacuous fixture-sanity checks (the fixtures
genuinely carry the private sentinels the reducer must never leak) and
static source guards (the reducer imports nothing, reaches no network / fs
/ env / clock, and makes no live-admission claim).

---

## 4. What Phase 44A did not prove

Stated explicitly so a future reader does not over-read the acceptance.
Phase 44A is a fixture-bound reducer, and **none** of the following is
implemented, authorized, or claimed by it (nor by this gate):

- **no live admission implementation** — the reducer admits nothing,
  stores nothing, and reaches no network; it is pure over already-parsed
  fixture-like objects;
- **no live Dixie admission route** — there is no live Dixie admission
  route, and none is built or authorized;
- **no Discord command** — the reducer is wired into no Discord command,
  dispatch, startup, or command registration;
- **no `/remember-this`** — no `/remember-this` (public or dev-only)
  exists or is authorized;
- **no production storage** — no production storage exists; the reducer
  persists nothing;
- **no production auth / consent** — production auth / consent is not
  built and is not claimed solved;
- **no user chat becoming memory** — user chat does not become memory; no
  chat-to-candidate or chat-to-admitted path exists;
- **no public rollout** — there is no public rollout and no
  public-channel-visible surface;
- **no Finn production wiring** — Finn is not production-wired for this
  wedge, and the reducer neither requires nor claims a healthy Finn
  integration;
- **no LLM / voice behavior** — the reducer performs no LLM rewriting and
  renders no character voice; it emits deterministic structured output
  only.

---

## 5. Acceptance decision

**Phase 44B accepts Phase 44A (PR #156) as sufficient proof for the
following, and only the following:**

- **fixture-bound reducer semantics** — the reducer correctly models the
  §D invariant over the Phase 43C fixture graph (candidate → transition →
  admitted → recall projection);
- **the local reducer input / output contract** — the reducer's stable
  reason codes, its accept / reject / supersede outcomes, and its
  excluded / included recall projections are accepted as the local
  contract Phase 44C may build a runner over;
- **fail-closed malformed-input behavior** — malformed, mismatched, or
  unsafe fixture inputs resolve to stable fail-closed reason codes, never
  a partial or thrown result;
- **safe projection / no-leak posture for reducer output** — every safe
  projection and every fail-closed detail is sealed against raw sentinels,
  long ids, hex addresses, URLs, and PEM keys;
- **preserving the candidate / admitted / rejected / superseded
  distinctions** — the four states stay distinct, and the wrong prior
  state never surfaces as active ordinary recall material.

**Phase 44B does not accept Phase 44A as any of the following:**

- **not** production admission;
- **not** runtime / production storage;
- **not** a public (or any) Discord command;
- **not** a user-facing write path.

The acceptance is bounded to the fixture-bound local reducer. It changes
no runtime behavior and authorizes no implementation beyond the next lane
selected in §7, under that lane's own boundaries (§8) and acceptance
criteria (§9).

---

## 6. Next-lane options

The candidate next lanes, classified. Phase 44B authorizes **none** as
implementation; it ranks them so the selection in §7 is explicit.

- **Option A — fixture-bound dev/operator reducer runner. *Recommended
  next.*** A local script / test-only runner over the existing Phase 43C
  fixtures and the Phase 44A reducer. It would print operator-safe
  scenario summaries for human inspection. It would **not** call Discord,
  Dixie, storage, the network, an LLM, or production auth. It is the
  smallest step that improves operator ergonomics over the accepted
  reducer proof without extending the proof's blast radius — the analogue
  of the accepted Recall Wedge Phase 35B dev/operator runner.
- **Option B — exported package surface for the reducer. *Defer.*** Adding
  the reducer to a package export. Too early unless another package
  genuinely needs it: an export can accidentally imply API stability for
  what is still fixture-bound doctrine. Defer until a concrete in-repo
  consumer justifies it, and then under its own justification (§8).
- **Option C — Dixie-side admission contract request / handoff. *Later.***
  A docs-level contract request to the Straylight / Dixie owners for
  canonical admission / estate / receipt semantics (analogous to the
  existing Recall Wedge Dixie contract-request / reconciliation docs).
  Sequenced **after** a local runner clarifies the operator workflow and
  the expected outputs, so the contract request reflects a real
  fixture-bound shape rather than a guess.
- **Option D — live Dixie admission route gate. *Blocked.*** A live Dixie
  admission route. **Blocked.** It requires a separate decision and an
  auth / storage / consent design, and the route / policy / auth boundary
  is Dixie-owned (and Straylight-owned for the canonical semantics). Not
  reachable from this gate.
- **Option E — dev/operator explicit candidate command. *Blocked /
  separately gated.*** A dev/operator-only command that creates a
  candidate (the Lane B `/remember-this`-shaped affordance from the design
  doc §G). Must be **separately gated** and **must not** be conflated with
  a public `/remember-this`. Not authorized here.
- **Option F — stop and harden docs / tests. *Available.*** Treat the
  Phase 44A reducer plus this gate as the resting state and take no
  implementation action — available if we decide the fixture-bound
  admission lane is sufficiently proven for now. Always available as the
  stop.

---

## 7. Selected next lane

**Phase 44C — fixture-bound dev/operator reducer runner (Option A).**

Phase 44B selects Option A as the next lane: a future fixture-bound local
runner over the existing Phase 43C fixtures and the Phase 44A reducer that
prints operator-safe scenario summaries. Option B is deferred, Option C is
sequenced after the runner clarifies the operator workflow, Options D and
E are blocked / separately gated, and Option F (stop) remains
always-available. Phase 44B authorizes only the bounded Phase 44C scope in
§8 — it does not implement it.

---

## 8. Phase 44C authorization boundaries

Phase 44B authorizes only a future fixture-bound local runner over the
**existing** Phase 43C fixtures and the **existing** Phase 44A reducer.

### 8.1 Allowed future Phase 44C scope

- a local dev/operator **script or test-only runner**;
- reads the existing Phase 43C fixture JSON (it does **not** add, mutate,
  or regenerate fixtures);
- calls the existing Phase 44A reducer (it does **not** modify the
  reducer's semantics);
- prints **safe scenario summaries**, one per accepted scenario:
  - before-admission — candidate excluded;
  - accepted / admitted — included;
  - rejected — excluded;
  - supersession — corrected included only, prior excluded;
  - unsafe / malformed input — fail-closed;
- may include **tests for the runner's output** (deterministic,
  no-leak-asserting, in the existing `bun test` pattern);
- may include **docs / a runbook for local operator usage** (how to run
  the runner and read its output).

### 8.2 Explicitly NOT authorized for Phase 44C

- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord history ingestion;
- user chat becoming memory;
- a live Dixie admission route;
- storage writes;
- production auth / consent;
- network calls;
- package exports (unless separately justified by a concrete in-repo
  consumer, under its own decision);
- public renderer changes;
- dispatch / startup / command-registration changes;
- LLM / voice behavior;
- Finn production wiring.

The runner is an ergonomics layer over an already-accepted, fixture-bound,
pure reducer. It must not become a live surface, a write path, or an
export by stealth. If a later phase needs any item in §8.2, it must open
the gate that owns it (decision-map §7 / §8) — Phase 44B authorizes none
of them.

---

## 9. Required acceptance criteria for a future Phase 44C

A future Phase 44C is acceptable only if it passes **all** of the
following:

- `git diff --check` is clean;
- the recall fixture validator passes
  (`node docs/recall-wedge/fixtures/validate-fixtures.mjs`);
- the admission fixture validator passes
  (`node docs/admission-wedge/fixtures/validate-fixtures.mjs`);
- the reducer test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.test.ts`);
- the runner test passes, if a runner test is added;
- the multi-surface harness regression passes
  (`bun test packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`);
- the live-Dixie client / runner regression passes
  (`bun test packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`)
  — proving the runner introduced no live-egress regression;
- a forbidden-claim scan finds no hits except negated blockers (the
  runner / its docs claim no production admission, no production storage,
  no production auth / consent, no public remember-this, no Discord
  history ingestion, no chat-becomes-memory, no live Dixie admission
  route, and no Finn production wiring);
- the runner's safe output carries **no raw IDs / secrets / sentinels** —
  no private-body sentinels, long id runs, hex addresses, URLs, JWTs, or
  PEM keys, exactly as the Phase 44A reducer seal enforces.

The Phase 44C acceptance, if recorded, should be a docs report consistent
with the accepted ladder template (redacted operator observations only; no
screenshots; no raw IDs / tokens / payloads / receipts).

---

## 10. Naming rules

Preserved verbatim from Phase 43B §B.1 / Phase 43C; binding for this
document:

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
  admission by this gate.

---

## 11. Cross-references

Minimal status / cross-reference back-notes are added to the three docs
below (small addenda only; the old docs are not rewritten):

- `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — Phase 43B design (PR #152). Gains
  a one-line Phase 44B note in its §O cross-references that this gate
  accepts the Phase 44A reducer and selects a fixture-bound Phase 44C
  runner.
- `docs/admission-wedge/fixtures/README.md` — Phase 43C fixture /
  operator-contract (PR #155). Gains a one-line Phase 44B cross-reference
  note.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix.
  Gains a targeted §5p Phase 44B addendum and a one-line §9 status note;
  §7 (live-memory-admission gates) and §8 (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 44B**):

- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156); the artifact
  accepted here.
- `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A decision gate (PR #151); the authority that selected the
  Admission Wedge and ranked the lanes (its §H) this gate's §6 narrows to
  the post-reducer state.
- `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  accepted controlled dev/operator seeded live recall (PR #150); the
  read-side primitive a future recall-after-admission proof would reuse
  unchanged, well beyond this gate.

---

## 12. Phase 44C status note — fixture-bound dev/operator reducer runner added

> Added by Phase 44C, 2026-06-02. Status note only; the decision in §5–§9
> is unchanged and the §8.2 boundaries stay in force.

Phase 44C implements the Option A lane this gate selected (§7), inside the
§8.1 scope and under the §8.2 boundaries:

- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — a local dev/operator runner that *reads* the existing
  Phase 43C fixtures, *calls* the existing Phase 44A reducer
  (`reduceAdmissionFixtureScenario`), and prints operator-safe scenario
  summaries for the five §8.1 scenarios:
  - `before_admission_excluded` — candidate excluded before admission;
  - `accepted_admitted_included` — admitted assertion included;
  - `rejected_excluded` — rejected candidate excluded, nothing minted;
  - `supersession_corrected_only` — corrected active included, prior excluded;
  - `malformed_fail_closed` — a synthetic, in-memory malformed candidate
    (carrying a private sentinel + a long-id run, never written to fixture
    JSON) routed through the same reducer entry point, proving fail-closed
    behavior without leaking its unsafe input.
- Each summary carries only safe fields: scenario name, outcome
  (`excluded` / `included` / `fail_closed`), a stable reducer reason code,
  short fixture ids (included / excluded), an audit-link **presence**
  boolean (never the raw audit body), and a canned one-line summary. Every
  summary is sealed through the Phase 44A reducer's `scanForUnsafeProjection`
  no-leak scan.
- It runs the existing acceptance set: `git diff --check` clean, both
  fixture validators pass, the Phase 44A reducer test passes, the new runner
  test passes, and the multi-surface + live-Dixie regressions pass
  (proving no live-egress regression).

Phase 44C does **not** authorize live admission, a Discord command,
`/remember-this`, public remember-this, Discord history ingestion, user
chat becoming memory, storage writes, production auth / consent, a live
Dixie admission route, network calls, package exports, public renderer
changes, dispatch / startup / command-registration changes, LLM / voice
behavior, or Finn production wiring. The runner is imported only by its own
test and the local `import.meta.main` CLI guard; it is not exported from the
package surface and is wired into no runtime path. The §8.2 boundaries and
the decision-map §7 / §8 gates remain in force.

---

## 13. Phase 44D status note — runner accepted; next lane is a Dixie-side contract request (Phase 45A)

> Added by Phase 44D, 2026-06-02. Status note only; the decision in §5–§9
> is unchanged and the §8.2 boundaries stay in force.

The Phase 44C runner this gate selected (§7) has been accepted by **Phase
44D** (`docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`, docs / decision
only). Phase 44D accepts the runner as the fixture-bound operator-readable
proof over the existing fixtures and reducer, and selects **Phase 45A — a
Dixie-side Admission Wedge contract request / handoff** (a docs / cross-repo
request artifact that hands the proof stack to Dixie / Straylight and asks
them to define or accept a live admission contract *later*) as the next
lane. Phase 44D implements nothing and authorizes no implementation in any
repo; live Dixie admission, a Dixie-owned admission contract, production
admission / storage / auth / consent, a public command, `/remember-this`,
and Finn production wiring all remain blocked. The §8.2 boundaries and the
decision-map §7 / §8 gates stay in force.

---

## 14. Phase 45A status note — Dixie-side contract request authored

> Added by Phase 45A
> (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`), 2026-06-02. Status
> note only; the decision in §5–§9 is unchanged and the §8.2 boundaries
> stay in force.

The Phase 44C runner accepted by Phase 44D
(`docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`) has since been handed
off by **Phase 45A** (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`,
docs / cross-repo request only). Phase 45A summarizes the proof stack this
gate's reducer acceptance anchors (43B design · 43C fixtures · 44A
reducer · 44C runner), carries the §D invariant, and asks the Dixie /
Straylight owners to define or accept a live admission contract *later*. It
implements nothing in any repo, changes no Dixie code, accepts no contract,
and does **not** claim a Dixie admission contract already exists. The §8.2
boundaries and the decision-map §7 / §8 gates stay in force.
