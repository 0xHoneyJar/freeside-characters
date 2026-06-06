# Admission Wedge — Dixie v1 probe mirror-refresh / adapter compatibility gate

> **Phase 45H** (Freeside Characters-side docs / decision only). Date:
> 2026-06-05. Follows Freeside Characters **Phase 45G / PR #173**
> (`docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — the Dixie
> probe adapter acceptance / next-lane decision gate) and **Phase 45F / PR #172**
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + `.test.ts` and the local mirrored probes under
> `docs/admission-wedge/dixie-probes/` — the test-only / docs-fixture-bound
> no-op adapter / validator over the Dixie **draft v0** probes), over Dixie
> **Phase 33E / PR #122**
> (`../loa-dixie/docs/admission-wedge/fixtures/` — the **draft v1** probe
> hardening / vocabulary refinement, which Phase 45G's §9 / Option D handoff
> recommended). Companion to
> `docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` (Phase 45E),
> `docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md` (Phase 45D), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix — its §7
> live-memory-admission gates and §8 prohibitions govern everything this gate
> points toward).
>
> This document **decides how Freeside Characters should respond to Dixie's
> Phase 33E v1 probe hardening.** It is **not** a mirror refresh, **not** an
> adapter constant change, **not** a test change, **not** a fixture / mirrored
> probe JSON mutation, and **not** a runtime wiring. It implements nothing. It
> introduces no source, test, fixture JSON, mirrored Dixie probe, package,
> lockfile, config, CI, or generated change; no runtime Discord behavior; no
> Discord command; no live Dixie admission route; no live Dixie call; no
> network call; no storage write; no Straylight store; no memory write. It does
> **not** rename any local fixture label, **does not** mutate any reducer reason
> code, **does not** refresh the local v0 mirrors to v1, **does not** widen the
> adapter's supported probe version, and **does not** freeze a final schema. It
> does **not** claim Dixie Phase 33E is a production schema, and it does **not**
> claim Freeside Characters owns the Dixie or Straylight vocabulary. If a step
> seems to require reaching past these boundaries, the answer is to open the
> separate later phase that owns it (decision-map §7 / §8) — not to relax it
> from this decision.

---

## 1. Phase title and status

**Phase 45H — Admission Wedge Dixie v1 probe mirror-refresh / adapter
compatibility gate.**

- Phase 45H is a **Freeside Characters-side docs / decision-only artifact.** It
  produces this decision plus the smallest possible cross-reference notes in
  the docs named in §15. It introduces no source, test, fixture JSON, mirrored
  Dixie probe, package, lockfile, config, CI, or generated change.
- Phase 45H **follows Dixie Phase 33E / PR #122** (the draft v1 probe hardening
  / vocabulary refinement) and **Freeside Characters Phase 45G / PR #173** (the
  adapter acceptance / next-lane decision gate, whose §9 / Option D recommended
  the upstream Dixie Phase 33D/33E hardening this decision now reacts to). It
  reads both as evidence.
- Phase 45H **does not refresh the local mirrors.** The five local mirrored
  Dixie probes under `docs/admission-wedge/dixie-probes/` stay pinned to
  `dixie_admission_wedge_probe_v0` exactly as Phase 45F landed them; no probe
  JSON is edited.
- Phase 45H **does not change adapter constants, tests, fixtures, the reducer,
  or the runner.** `SUPPORTED_DIXIE_PROBE_VERSION` stays
  `dixie_admission_wedge_probe_v0`; the Phase 45F adapter / test, the Phase 44A
  reducer, the Phase 44C runner, and the Phase 43C fixtures remain exactly as
  landed.
- Phase 45H **wires no runtime behavior and authorizes no live admission.** No
  live Dixie call, no live Dixie admission route, no Discord command, no
  storage, no auth / consent — none of it is added, implied, or unblocked.
- Phase 45H **does not freeze a final / canonical / production schema.** Dixie
  Phase 33E is explicit that its probes are **draft v1 — NOT frozen, NOT
  canonical, NOT a route contract** (`schema_final: false`,
  `canonical_schema: false`, `route_contract: false`). This decision preserves
  that, and every local fixture / reducer / runner / adapter label remains a
  valid **local proof label** owned by Freeside Characters, while the canonical
  live vocabulary stays owned upstream (Straylight), not by Freeside Characters.

---

## 2. Source chain

This decision is grounded in, and scoped entirely within, the accepted
Admission Wedge ladder plus the Dixie `33` series. **These artifacts are
evidence only; Phase 45H modifies none of them except for the small
cross-reference addenda named in §15, and it does not edit `../loa-dixie` at
all.**

Freeside Characters:

- **Phase 45E / PR #171** —
  `docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md`. The Dixie probe
  reconciliation / local alignment decision: maps each Dixie Phase 33C draft v0
  probe to the local proof stack (clean at the semantic level, naming / shape
  deltas only), preserves the local labels as proof labels, and selects a
  narrow, future-gated, test-only / docs-fixture-bound no-op adapter / validator
  lane (Phase 45F).
- **Phase 45F / PR #172** —
  `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) and the local mirrored probes under
  `docs/admission-wedge/dixie-probes/`. The Dixie probe no-op adapter /
  validator over **v0 local mirrors**: a pure, local, test-only semantic mapping
  layer that maps the five Dixie probe scenarios onto the local proof scenarios
  and proves semantic equivalence against the existing Phase 44A reducer over
  the Phase 43C fixtures, without any runtime wiring or live Dixie call.
- **Phase 45G / PR #173** —
  `docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md`. The adapter
  acceptance / next-lane decision gate: accepts the bounded Phase 45F proof,
  states what it does *not* prove, keeps the adapter dead-ended from runtime,
  and selects **Dixie probe hardening** (its §9 / Option D) as the recommended
  next lane — a cross-repo handoff recommendation, not a Freeside Characters
  implementation authorization.

Dixie:

- **Phase 33C / PR #120** — `../loa-dixie/docs/admission-wedge/fixtures/`. The
  canonical fixture / probe **draft v0**: five synthetic, public-safe probe
  JSONs, a dependency-free validator, and a README. Non-runtime; no live route,
  storage, auth, or admission; no schema freeze.
- **Phase 33D / PR #121** —
  `../loa-dixie/docs/ADMISSION-WEDGE-PROBE-HARDENING-GATE.md`. The probe
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
> (`33C`/`33D`/`33E`) is distinct from any Freeside Characters `33A` and from
> the Freeside Characters `43B–45H` Admission Wedge sequence. Dixie `33E` and
> the Freeside Characters phases are independent labels in separate
> repositories and must not be conflated; Dixie Phase 33A §9 lists cross-repo
> phase numbering as an open reconciliation item, and this decision does not
> resolve it.

Phase 45H inherits the Phase 45E / 45G authority boundary verbatim: it may
*record the Dixie v1 / Freeside v0 state* and *classify and select the next
lane*; it may **not** authorize production admission, public remember-this,
Discord message-history ingestion, a live Dixie admission route, a package
export, or a full production Straylight admission / storage / auth / consent
architecture, and it may **not** decide anything on Dixie's or Straylight's
behalf.

---

## 3. Purpose

- **Dixie Phase 33E bumped the draft probes from v0 to v1.** The five Dixie
  probes now carry `probe_version: dixie_admission_wedge_probe_v1` (from
  `dixie_admission_wedge_probe_v0`), `hardening_phase: "33E"`, the explicit
  non-final markers `schema_final: false` / `canonical_schema: false` /
  `route_contract: false`, and a set of draft hardening placeholders (§4).
- **Freeside Characters Phase 45F local mirrors still pin v0.** The five mirror
  JSONs under `docs/admission-wedge/dixie-probes/` still carry
  `probe_version: dixie_admission_wedge_probe_v0` and a `_local_mirror` marker
  that names Dixie **Phase 33C** as their canonical source.
- **The Freeside Characters adapter currently supports v0 mirrors and fails
  closed on unknown versions.** Its `SUPPORTED_DIXIE_PROBE_VERSION` constant is
  `dixie_admission_wedge_probe_v0`; any other `probe_version` returns a sealed
  fail-closed result with reason code `unknown_probe_version`. The adapter
  reads the local v0 mirrors, not the live Dixie files.
- **Phase 45H decides whether and how Freeside should refresh local mirrors /
  adapter compatibility in a future phase.** It records the v1 / v0 state, the
  per-probe compatibility, the adapter version options, and selects a future,
  separately-gated implementation lane.
- **Phase 45H itself does not perform that refresh.** No mirror JSON is
  rewritten to v1, no adapter constant is widened, and no test is added or
  changed here. The decision is the artifact; the refresh is future work.

---

## 4. Dixie v1 summary

What Dixie Phase 33E changed, read from the Dixie probe JSONs and the Phase 33D
gate's §12 status note (read-only evidence; not modified by this phase):

- **All five semantic scenarios preserved.** `candidate_pending_not_recallable`,
  `accept_candidate_to_admitted_assertion`, `reject_candidate_no_assertion`,
  `supersede_with_corrected_assertion`, and
  `malformed_or_unsafe_payload_fail_closed` are unchanged in meaning — none was
  removed, renamed, or split.
- **No sixth probe.** Phase 33E added none.
- **`probe_version: dixie_admission_wedge_probe_v1`** (the bump from v0) and
  `status: draft_contract_probe`.
- **`hardening_phase: "33E"`.**
- **`schema_final: false`.**
- **`canonical_schema: false`.**
- **`route_contract: false`.**
- **`runtime_enabled: false`.**
- **`production_admission: false`.**
- **`public_safe: true`.**
- **Hardening additions (all draft / non-final placeholders).** The v1 probes
  add or sharpen: a **pending-vs-denied** distinction (a no-transition candidate
  is `proposed`, not denied; `transition_denied` is bound to an explicit
  rejection transition); **rejected transition semantics** (an explicit denied
  `admit_assertion` transition); **admitted assertion linkage** (candidate →
  transition → admitted assertion, status canonical `active`);
  **supersession / corrected-active relation** (the `(superseded, active)` pair
  plus a supersede link, recall includes the corrected active only); **malformed
  fail-closed** (stable public `ingress.invalid_request` reason, no raw echo);
  the **public / private no-leak boundary** (a `receipt_split` block plus a
  validator no-leak sweep); **draft signer / authority fields**
  (`authority_signer_type_draft`, `authority_scope_draft`,
  `authority_binding_final: false`); **synthetic binding** (`synthetic_binding:
  true`, `identity_binding_final: false`); **idempotency placeholders** (an
  `idempotency` block with `idempotency_key_draft`, `idempotency_scope_draft`,
  `idempotency_final: false`); a **receipt / audit split** (`receipt_split` with
  `public_receipt_ref` / `audit_receipt_ref` / `audit_private` /
  `public_audit_detail`); **recall eligibility** (a boolean `recall_eligible`
  paired with the canonical `RecallUseInstruction` signal); and a **Straylight
  primitive review marker** (`straylight_primitive_review:
  "required_before_route_design"`, `straylight_primitive_review_complete:
  false`).

> Phase 33E's own README and gate are explicit that these are draft placeholders
> — not final idempotency semantics, not production auth, not production identity
> binding, not a completed Straylight review, and not a frozen schema. Phase 45H
> reads them as draft v1 evidence and treats them the same way.

---

## 5. Current Freeside Characters status

- **Local mirrored Dixie probes under `docs/admission-wedge/dixie-probes/`
  remain v0.** Each mirror carries `probe_version:
  dixie_admission_wedge_probe_v0`, the v0 marker set (`schema_final: false`,
  `runtime_enabled: false`, `production_admission: false`, `public_safe: true`),
  and a `_local_mirror` block naming Dixie **Phase 33C** as canonical source.
  The v0 mirrors already carry **some** of the authority vocabulary:
  `authority_signer_type_draft` is present in the transition block of the three
  transition-bearing mirrors
  (`accept-candidate-to-admitted-assertion.json`,
  `reject-candidate-no-assertion.json`, and
  `supersede-with-corrected-assertion.json`), because those scenarios needed a
  draft signer marker on the admission / supersession transition at the v0
  point in time. What the v0 mirrors do **not** carry are the fields Dixie v1
  adds or sharpens: `authority_scope_draft` and `authority_binding_final` (the
  rest of the draft signer / authority set beyond the already-present
  `authority_signer_type_draft`); the expanded `idempotency` placeholders
  (`idempotency_key_draft` / `idempotency_scope_draft` / `idempotency_final`);
  the receipt / audit split markers (`receipt_split` and its public / private
  receipt refs); the synthetic binding markers (`synthetic_binding` /
  `identity_binding_final`); the Straylight primitive review markers
  (`straylight_primitive_review` / `straylight_primitive_review_complete`); and
  the stricter non-final route / canonical-schema metadata (`canonical_schema`,
  `route_contract`, `hardening_phase`). The v0 mirrors are therefore not
  authority-vocabulary-free; they are missing the v1-only / v1-sharpened
  hardening fields.
- **The Phase 45F adapter is test-only / docs-fixture-bound.** It is a pure
  mapping layer imported only by its own test; the test reads the mirror JSON
  from disk and passes the parsed objects in.
- **The adapter is not runtime-wired and not package-exported.** Static guards
  in the Phase 45F test prove it imports only the pure Phase 44A reducer; reaches
  no Discord / dispatch / startup / command-registration / renderer / live-Dixie
  / LLM / fs / net / env / clock path; is referenced by no source file other
  than its own test; and is absent from the `package.json` exports map.
- **The adapter currently treats unknown probe versions as fail-closed.** Its
  `SUPPORTED_DIXIE_PROBE_VERSION` is `dixie_admission_wedge_probe_v0`; a probe
  whose `probe_version` is anything else (including
  `dixie_admission_wedge_probe_v1`) returns a sealed fail-closed result with
  reason code `unknown_probe_version`, never echoing the raw version string.
- **Freeside reads local mirrors, not live Dixie files.** Nothing in this repo
  reads `../loa-dixie` at runtime or test time; the adapter test reads only the
  local mirror copies under `docs/admission-wedge/dixie-probes/`.
- **Therefore Dixie v1 does not break Freeside runtime or tests immediately.**
  There is no runtime path to break, and the adapter test still runs against the
  unchanged v0 mirrors. The Dixie v1 bump changes nothing in this repo until a
  future phase chooses to refresh.
- **However, Freeside is now stale relative to Dixie's current probe draft.**
  The canonical upstream draft is v1; the local mirrors are a point-in-time v0
  copy. The mirrors remain valid as historical / local proof mirrors, but they
  no longer reflect Dixie's current draft.

---

## 6. Compatibility decision

- **Freeside should not silently mutate the v0 mirrors inside this decision
  gate.** Refreshing mirror JSON or widening the adapter is a deliberate,
  separately-gated change — not something to slip into a decision doc.
- **Freeside should add an explicit future mirror-refresh / adapter
  compatibility implementation phase** (Phase 45I, §10) rather than refreshing
  here.
- **Until that future phase lands, the Freeside v0 mirrors remain valid
  historical / local proof mirrors only.** They prove the Phase 45F semantic
  bridge held at the v0 point in time; they are not the current Dixie draft.
- **Freeside must not claim v1 compatibility yet.** No artifact in this repo has
  been exercised against `dixie_admission_wedge_probe_v1`; the adapter still
  fails closed on it by design.
- **Freeside must not consume Dixie v1 fixtures in runtime.** There is no
  runtime consumer, and none is authorized.
- **Freeside must not widen adapter support silently.**
  `SUPPORTED_DIXIE_PROBE_VERSION` stays v0 until a future phase explicitly
  decides and proves the v1 (or dual-version) handling.

---

## 7. Probe compatibility matrix

Each row maps a Dixie v1 probe to its Freeside v0 mirror / adapter scenario,
records whether the public surface the adapter reads is preserved across the v0→v1
bump, names the new v1 hardening fields, and states the future Phase 45I action.
**No row authorizes or performs a change in this phase**; the "Future 45I action"
column is a recommendation for a later, separately-gated phase.

| Dixie v1 probe | Freeside v0 mirror / adapter scenario | Public surface preserved? | New v1 hardening fields | Future 45I action |
|---|---|---|---|---|
| **A. `candidate_pending_not_recallable`** | maps to local `before_admission_excluded`; v0 mirror present | Yes — candidate pending / excluded, `outcome: accepted_as_proposed`, `candidate_state: proposed`, no admission, no assertion, `recall_eligible: false`, payload not rendered | pending-vs-denied marker, synthetic binding, idempotency placeholder, Straylight review marker | mirror v1 and assert pending does **not** collapse to denied |
| **B. `accept_candidate_to_admitted_assertion`** | maps to local `accepted_admitted_included`; v0 mirror present | Yes — candidate → transition → admitted assertion (`active`), `recall_eligible: true`, payload not rendered | signer / authority draft (`authority_signer_type_draft` / `authority_scope_draft` / `authority_binding_final`), idempotency, receipt / audit split (`receipt_split`) | mirror v1 and assert candidate→transition→admitted linkage plus the new draft fields |
| **C. `reject_candidate_no_assertion`** | maps to local `rejected_excluded`; v0 mirror present | Yes — explicit denied transition, `outcome: denied`, no assertion, `recall_eligible: false`, payload not rendered | `transition_denied` explicitly bound to the rejection transition (`transition.outcome: denied`) | mirror v1 and preserve the pending-vs-denied distinction |
| **D. `supersede_with_corrected_assertion`** | maps to local `supersession_corrected_only`; v0 mirror present | Yes — corrected active only in ordinary recall, `recall_eligible: true`, payload not rendered | corrected-active relationship clarified as the `(superseded, active)` pair + supersede link (not a standalone status) | mirror v1 and assert prior excluded / corrected included |
| **E. `malformed_or_unsafe_payload_fail_closed`** | maps to local `malformed_fail_closed`; v0 mirror present | Yes — `outcome: refused`, `reason_code: ingress.invalid_request` (the stable Dixie refusal family), `recall_eligible: false`, payload not rendered | broader no-leak sweep + private audit markers (`private_reason_family`, `receipt_split` with null public receipt) | mirror v1 and assert fail-closed with no raw echo |

> **Public-surface note.** Across the v0→v1 bump, the public-surface values the
> Phase 45F adapter actually reads (`public_response.rendered_candidate_payload`,
> `public_response.recall_eligible`, and — for the malformed probe —
> `public_response.outcome` and `public_response.reason_code`) are preserved by
> Dixie Phase 33E. The compatibility gap is therefore **not** in the public
> surface; it is the `probe_version` string the adapter pins (v0) and the local
> mirror files (v0). A future Phase 45I that refreshes the mirrors to v1 and
> teaches the adapter the v1 version would map cleanly, but that is future,
> separately-gated work and is **not** done or proven here.

---

## 8. Adapter version decision

- **The current adapter's v0-only support remains correct until a mirror
  refresh.** The adapter reads local v0 mirrors and must keep failing closed on
  any version it has not been explicitly taught; widening it without a refresh
  would be an unproven claim.
- **A future Phase 45I should decide whether to:**
  - **support only v1** in the main adapter and keep the v0 mirrors as
    historical fixtures (the recommended default);
  - **support both v0 and v1** for a deprecation window; or
  - **add a dedicated migration / version-bridge adapter function** distinct
    from the main mapper.
- **Recommendation: support v1 in the main adapter and keep v0 either
  fail-closed or historical-only**, unless the Phase 45I tests show concrete
  value in dual-version support (for example, if the v0 historical mirror tests
  remain a useful regression anchor).
- **This decision does not settle final API stability or package exports.** The
  adapter stays un-exported; any version-handling change in Phase 45I is
  test-only / docs-fixture-bound, and final API surface remains deferred.

---

## 9. Next-lane options

The candidate next options, classified. Phase 45H authorizes **none** as
implementation; it ranks them so the selection in §10 is explicit.

- **Option A — Freeside Characters v1 mirror-refresh / adapter compatibility
  implementation.** *Recommended next.* Test-only / docs-fixture-bound. Updates
  the local mirrored Dixie probes to v1 (or adds a clearly named v1 mirror set),
  updates the adapter's expected-version handling and tests to prove v1
  compatibility, and preserves **no** runtime wiring and **no** package export.
- **Option B — Wait for Dixie v2 / further hardening.** *Acceptable but lower
  momentum*, because Dixie v1 is now the current draft. It could be chosen if v1
  is judged too unstable to mirror yet.
- **Option C — Dual v0 / v1 adapter compatibility.** *Possible* but may add
  unnecessary complexity; consider only if the historical v0 mirror tests remain
  useful as a regression anchor.
- **Option D — Live admission client or Discord command.** *Blocked.* Requires a
  live Dixie route, storage / auth / consent gates, and separate authorization
  (decision-map §7; Dixie Phase 33A §9). Not available from this gate.
- **Option E — Freeside Characters package export.** *Deferred.* There is no
  stable consumer contract; exporting the adapter would imply API stability too
  early.
- **Option F — Stop and preserve the proof.** *Available.* The local proof
  stack, the Phase 45F adapter over the v0 mirrors, and this decision are a
  stable resting state.

---

## 10. Selected next lane

**Phase 45I — Admission Wedge Dixie v1 mirror-refresh / adapter compatibility
(Option A).**

It should be a future **test-only / docs-fixture-bound implementation slice**:
it refreshes the local mirrored Dixie probes to `dixie_admission_wedge_probe_v1`
(or adds a clearly named v1 mirror set alongside the v0 historical mirrors),
teaches the adapter to expect v1 (per the §8 recommendation: support v1 in the
main adapter, keep v0 fail-closed or historical-only), and updates the adapter
tests to prove the v1 mappings, the fail-closed behavior on unsupported
versions, and no-leak over the v1 outputs — while preserving **no** runtime
wiring, **no** package export, and **no** live admission.

**Why not the other lanes now:** waiting for Dixie v2 (Option B) loses momentum
because v1 is the current draft; dual v0/v1 support (Option C) is extra
complexity to consider only if a regression-anchor need appears; a live client /
command (Option D) is blocked behind separate gates; a package export (Option E)
is deferred until a stable consumer exists; and stopping (Option F) remains an
acceptable resting state if a reviewer prefers it.

---

## 11. Future Phase 45I boundaries

These boundaries apply **if** Phase 45I is opened as the recommended
mirror-refresh / adapter-compatibility slice. They are a recommendation for that
future phase, not an authorization granted here.

**Allowed (recommended) future Phase 45I scope:**

- update the local mirrored Dixie probes to v1, **or** add a clearly named v1
  mirror set alongside the existing v0 historical mirrors (with provenance
  naming Dixie Phase 33E as the canonical source);
- update the adapter's expected-version handling
  (`SUPPORTED_DIXIE_PROBE_VERSION` and the version check);
- update the adapter tests to prove the v1 scenario mappings;
- test fail-closed behavior for unsupported / unknown probe versions;
- test no-leak behavior over the v1 outputs;
- document mirror provenance (which Dixie phase / PR each mirror copies).

**Blocked for Phase 45I (recommended):**

- runtime Discord behavior;
- a Discord command;
- `/remember-this`;
- public remember-this;
- Discord history ingestion;
- user chat becoming memory;
- a live Dixie admission route;
- live Dixie calls;
- network calls;
- storage writes;
- production admission / storage / auth / consent;
- package exports;
- renderer / dispatch / startup / command-registration changes;
- LLM / voice behavior;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze;
- Freeside Characters owning the Dixie / Straylight vocabulary.

---

## 12. What remains blocked now

Repeated clearly so a future reader does not over-read this decision. None of
the following is implemented, authorized, or claimed by Phase 45H (and none was
unblocked by Dixie Phase 33E, by Freeside Characters Phase 45F / 45G, or by any
prior phase):

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
- renderer / dispatch / startup / command-registration changes;
- LLM / voice behavior;
- Finn production wiring;
- a forget / revoke / correction UI;
- a final schema freeze;
- runtime wiring (of the adapter or anything else);
- local production memory admission.

A decision is not implementation. This doc reads the Dixie Phase 33E v1 probes
and the Freeside Phase 45F / 45G evidence and selects a future refresh lane; it
mutates no mirror, no adapter constant, no test, and no code, and it decides
nothing on Dixie's or Straylight's behalf. If a later phase needs any item
above, it must open the separately-gated phase that owns it (decision-map
§7 / §8).

---

## 13. Success criteria for Phase 45H

This Phase 45H artifact succeeds if **all** of the following hold:

- it **accurately records the Dixie v1 and Freeside v0 state** (§4, §5);
- it **does not mutate the mirrors or any code** (§1, §6);
- it **explicitly decides that the v1 refresh should be gated** (§6) rather than
  performed here;
- it **selects Phase 45I as a test-only / docs-fixture-bound implementation
  slice** (§10) without authorizing any implementation;
- it **keeps all live / runtime lanes blocked** (§12);
- **Codex / review confirms docs / decision-only scope.**

Mechanically, the accepted-ladder acceptance bar applies:

- `git diff --check` is clean;
- the recall fixture validator passes
  (`node docs/recall-wedge/fixtures/validate-fixtures.mjs`);
- the admission fixture validator passes
  (`node docs/admission-wedge/fixtures/validate-fixtures.mjs`);
- the Phase 45F adapter test passes
  (`bun test packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.test.ts`)
  — proving this decision did not perturb the artifact it reasons about, and
  that the adapter still maps the **unchanged v0 mirrors**;
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
  claims no refreshed v1 mirrors, no v1 adapter support, no public
  remember-this, no Discord history ingestion, no chat-becomes-memory, no
  production admission, no production storage, no production auth / consent, no
  Finn production wiring, no live Dixie admission route, no live Dixie call, no
  authorized package export, no frozen final schema, no claim that Dixie
  Phase 33E is production schema, no Freeside Characters ownership of the
  Dixie / Straylight vocabulary, no fixture / reducer label rename, no fixture
  JSON mutation, no code change, and no runtime wiring);
- the artifact carries **no raw IDs / secrets / tokens / URLs / screenshots /
  binary evidence**.

---

## 14. Naming rules

Preserved verbatim from Phase 43B §B.1 / 43C / 44B / 44D / 45A / 45C / 45D /
45E / 45G; binding for this document:

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
- Do **not** imply the **final contract schema is frozen.** Dixie Phase 33E is
  an explicit **draft v1** (`schema_final: false`, `canonical_schema: false`,
  `route_contract: false`); it froze no production schema, and Phase 45H does
  not freeze one either.

---

## 15. Cross-references

Minimal status / cross-reference notes are added to the docs below (small
addenda only; the old docs are not rewritten, and no broad addenda are added):

- `docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — Phase 45G
  acceptance / next-lane gate (PR #173). Gains a one-line Phase 45H note that
  the Dixie probe hardening it recommended landed as Dixie Phase 33E (draft v1)
  and that the Freeside response is gated to a future Phase 45I mirror-refresh /
  adapter-compatibility slice.
- `docs/admission-wedge/dixie-probes/README.md` — Phase 45F local mirrored
  probes (PR #172). Gains a one-line Phase 45H note that the upstream Dixie
  draft is now v1 (Phase 33E), that these mirrors remain v0 historical / local
  proof mirrors, and that any refresh is deferred to a future Phase 45I.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix. Gains
  a targeted Phase 45H addendum (§5y); §7 (live-memory-admission gates) and §8
  (prohibitions) stay in force.

Other related artifacts (read only; **unchanged by Phase 45H, and
`../loa-dixie` is not editable from this repo / task**):

- `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) — Phase 45F adapter / validator (PR #172); the artifact this
  decision reasons about. Unchanged here; still pinned to
  `dixie_admission_wedge_probe_v0`.
- `docs/admission-wedge/dixie-probes/*.json` — Phase 45F local mirrored Dixie
  probes (PR #172). Unchanged here; still v0.
- `docs/admission-wedge/fixtures/` — Phase 43C fixtures + validator (PR #155).
  Unchanged here.
- `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
  (+ `.test.ts`) — Phase 44A reducer / adapter (PR #156). Unchanged here.
- `packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  (+ `.test.ts`) — Phase 44C runner (PR #158). Unchanged here.
- `docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — Phase 45E
  reconciliation / local alignment gate (PR #171). Read only.
- `../loa-dixie/docs/admission-wedge/fixtures/` — Dixie Phase 33C draft v0 →
  Phase 33E draft v1 probes + validator + README (PR #120 / PR #122); the
  canonical upstream source the local mirrors copy. Read only; not modified.
- `../loa-dixie/docs/ADMISSION-WEDGE-PROBE-HARDENING-GATE.md` — Dixie Phase 33D
  hardening-decision gate + Phase 33E status note (PR #121 / PR #122). Read
  only; not modified.
- `@loa/straylight` — semantic owner of the assertion lifecycle and the
  canonical vocabulary the Dixie probes align to. **No Straylight primitive
  review has been performed by this phase**; the Dixie v1 probes themselves
  carry `straylight_primitive_review_complete: false`.
