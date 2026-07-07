# Admission Wedge — local mirrored Dixie probes (Phase 45F → 45I)

> **Phase 45F** (Freeside Characters-side, test-only / docs-fixture-bound)
> authored these mirrors as **draft v0**; **Phase 45I** (2026-06-06) refreshed
> them to **draft v1**. These five JSON files are **local mirrors** of the Dixie
> **Phase 33E / PR #122 draft v1** Admission Wedge contract probes
> (`dixie_admission_wedge_probe_v1`), copied here only so a local, pure, no-op
> adapter / validator
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + its test) can prove the Dixie probe scenarios map to the current Freeside
> Characters local Admission Wedge proof semantics — **without** any runtime
> wiring and **without** any live Dixie call.

## What these are

- **Local mirrors for the Phase 45F/45I adapter tests.** They exist so the
  adapter test can read a probe shape and prove semantic alignment to the local
  proof stack.
- **Canonical source is Dixie Phase 33E / PR #122**
  (`../loa-dixie/docs/admission-wedge/fixtures/`) — the draft v1 probe set that
  hardened the original Phase 33C / PR #120 draft v0 probes. These mirrors are
  **not** canonical upstream truth; the Dixie copy is authoritative. If the two
  ever disagree, the Dixie copy wins and these mirrors are stale.
- **Draft v1, non-runtime, not final schema.** Every probe carries
  `probe_version: dixie_admission_wedge_probe_v1`, `status: draft_contract_probe`,
  `hardening_phase: "33E"`, `schema_final: false`, `canonical_schema: false`,
  `route_contract: false`, `runtime_enabled: false`,
  `production_admission: false`, `public_safe: true`. Nothing here is frozen or
  final, and these are explicitly **not** a canonical or production schema.
- Each file additionally carries a top-level `_local_mirror` marker block that
  records that it is a Freeside-local mirror, its canonical Dixie source, its
  draft / non-runtime status, and that Phase 45I refreshed it from draft v0 to
  draft v1. The adapter ignores `_local_mirror`; it is there for human readers
  and to make the mirror's status unambiguous on disk.

## What these are NOT

- **Local mirrors do not create any Freeside Characters runtime behavior.** They
  are static JSON read only by a test. No source path imports them, no command
  reads them, no renderer touches them, and no package surface exports them.
- They are **not** a live Dixie call, a live Dixie admission route, storage,
  auth / consent, a public `remember-this`, Discord history ingestion, user chat
  becoming memory, or any production behavior. None of those is added, implied,
  or unblocked by mirroring these probes. V1 compatibility in these tests is
  **not** production readiness.
- They are **not** a rename of, or a mutation to, any local fixture under
  `docs/admission-wedge/fixtures/` and they change no reducer reason code. The
  local proof labels remain local proof labels; the Dixie probe labels remain
  Dixie-owned draft v1 labels. Neither set is a frozen final schema, and Freeside
  Characters does not own the Dixie or Straylight vocabulary.

## The five mirrored probes

| File | Dixie `scenario_id` | Local scenario it aligns to |
|------|---------------------|-----------------------------|
| `candidate-pending-not-recallable.json` | `candidate_pending_not_recallable` | `before_admission_excluded` |
| `accept-candidate-to-admitted-assertion.json` | `accept_candidate_to_admitted_assertion` | `accepted_admitted_included` |
| `reject-candidate-no-assertion.json` | `reject_candidate_no_assertion` | `rejected_excluded` |
| `supersede-with-corrected-assertion.json` | `supersede_with_corrected_assertion` | `supersession_corrected_only` |
| `malformed-or-unsafe-payload-fail-closed.json` | `malformed_or_unsafe_payload_fail_closed` | `malformed_fail_closed` |

These are exactly the five Phase 33C semantic scenarios, preserved unchanged in
meaning across the Dixie v0 → v1 hardening — there is **no** sixth mirror. The
local scenario names are the Phase 44C runner's
(`run-admission-wedge-fixture-demo.ts`) scenario labels; the alignment is proven
in the adapter test against the existing Phase 44A reducer / 44C runner output.

## Phase 45I draft-v1 hardening (mirrored from Dixie Phase 33E)

The refreshed mirrors carry Dixie Phase 33E's draft hardening placeholders — all
draft / non-final, never on the public surface:

- **Draft v1 metadata** — `probe_version: dixie_admission_wedge_probe_v1`,
  `hardening_phase: "33E"`, and the explicit non-final markers
  `schema_final: false` / `canonical_schema: false` / `route_contract: false`.
- **Pending vs denied** — the pending probe's public outcome
  (`accepted_as_proposed`, `candidate_state: proposed`) carries no
  denied/rejected vocabulary; the rejection probe binds `transition_denied` to an
  explicit denied transition. The distinction must not collapse.
- **Signer / authority (draft)** — transition-bearing probes carry
  `authority_signer_type_draft`, `authority_scope_draft`, and
  `authority_binding_final: false`. Not a production-auth claim.
- **Idempotency (draft)** — every probe carries an `idempotency` block
  (`idempotency_key_draft` / `idempotency_scope_draft` / `idempotency_final: false`).
  Idempotency semantics are not final.
- **Receipt / audit split** — a `receipt_split` block declares the boundary
  (`public_receipt_ref` / `audit_receipt_ref` / `audit_private` /
  `public_audit_detail`); `public_receipt_ref` is `null` for the pending and
  fail-closed probes that mint no public receipt.
- **Synthetic binding** — `synthetic_binding: true`,
  `identity_binding_final: false`; tenant/estate/actor ids stay in the private
  `input` / `audit` sections.
- **Straylight primitive review marker** —
  `straylight_primitive_review: "required_before_route_design"` and
  `straylight_primitive_review_complete: false`; the review is required before
  any route design and has not occurred.

## Refresh / reconciliation

These mirrors are a point-in-time copy of `dixie_admission_wedge_probe_v1`. They
should be **refreshed or reconciled only through a future gate** if the Dixie
probes change again (a later Dixie probe version, or a further Dixie hardening).
Do not hand-edit them to diverge from the Dixie source; if the Dixie probes move,
open the mirror-refresh gate that owns the refresh rather than silently editing
here. This directory carries **no live Dixie calls, no storage, no auth, no
`remember-this`, no Discord ingestion, and no production behavior.**

> **Phase 45I status note.** Phase 45I
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md`) refreshed these five
> mirrors from **draft v0** to **draft v1** to track Dixie **Phase 33E / PR #122**,
> and updated the adapter / test to expect `dixie_admission_wedge_probe_v1`
> (v0 is now an unsupported / historical version that fails closed with
> `unknown_probe_version`). All five scenarios are preserved and there is no
> sixth mirror. Phase 45I added **no** runtime behavior, no live Dixie call, no
> storage, no auth, no Discord ingestion, no `/remember-this`, no package export,
> and no production behavior; it authorizes no live admission. Any future Dixie
> probe version change requires a future mirror-refresh gate.
>
> **Phase 45H historical note.** Dixie's v1 hardening landed as Phase 33E /
> PR #122; Phase 45H
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md`, docs / decision only)
> recorded the Dixie v1 / Freeside v0 state and **deferred** the refresh to a
> gated Phase 45I — which has since performed it (see the Phase 45I note above).
>
> **Phase 45J status note.** Phase 45J
> (`docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-ACCEPTANCE-GATE.md`, docs /
> decision only) **accepts** the Phase 45I refresh: these refreshed v1 mirrors are
> accepted as test-only / docs-fixture-bound mirrors only — still **not** canonical
> upstream truth (the Dixie Phase 33E copy wins on any disagreement), still no
> runtime behavior, no live Dixie call, and no production behavior. Phase 45J
> selects **Dixie Phase 33F — Admission Wedge route-contract readiness gate** as
> the recommended next lane. Any future Dixie probe version change still requires a
> future mirror-refresh gate.

## Provenance

- `../loa-dixie/docs/admission-wedge/fixtures/README.md` — Dixie Phase 33C → 33E
  draft v0 → draft v1 probe set + validator (canonical source). Read only; not
  edited from this repo.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md` — the Phase 45H decision
  gate (and its Phase 45I status note) governing this v0 → v1 mirror refresh.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — Phase 45E
  reconciliation / next-lane decision; its §10–§11 authorize this narrow,
  test-only Phase 45F no-op adapter / validator lane.
- `docs/admission-wedge/fixtures/README.md` — the Phase 43C local fixture /
  operator-contract these mirrors are aligned against (unchanged; the adapter
  renames and mutates nothing there).
- `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) — the Phase 45F (v0) → Phase 45I (v1) pure, local, no-op
  adapter / validator and its test that consume these mirrors.
- `docs/admission-wedge/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — Phase 45G
  acceptance / next-lane gate. Accepts the Phase 45F adapter that consumes these
  mirrors as a **test-only / docs-fixture-bound semantic bridge** (these mirrors
  stay local mirrors, not canonical upstream truth) and recommended Dixie probe
  hardening as the next lane — which landed as Dixie Phase 33E and is now
  mirrored here by Phase 45I. Mutates none of the local fixtures; authorizes no
  runtime wiring or adapter export.
