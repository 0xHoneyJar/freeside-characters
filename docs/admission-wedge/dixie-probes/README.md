# Admission Wedge — local mirrored Dixie probes (Phase 45F)

> **Phase 45F** (Freeside Characters-side, test-only / docs-fixture-bound).
> Date: 2026-06-04. These five JSON files are **local mirrors** of the Dixie
> Phase 33C **draft v0** Admission Wedge contract probes, copied here only so a
> local, pure, no-op adapter / validator
> (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
> + its test) can prove the Dixie probe scenarios map to the current Freeside
> Characters local Admission Wedge proof semantics — **without** any runtime
> wiring and **without** any live Dixie call.

## What these are

- **Local mirrors for Phase 45F adapter tests.** They exist so the adapter test
  can read a probe shape and prove semantic alignment to the local proof stack.
- **Canonical source is Dixie Phase 33C / PR #120**
  (`../loa-dixie/docs/admission-wedge/fixtures/`). These mirrors are **not**
  canonical upstream truth; the Dixie copy is authoritative. If the two ever
  disagree, the Dixie copy wins and these mirrors are stale.
- **Draft v0, non-runtime, not final schema.** Every probe carries
  `probe_version: dixie_admission_wedge_probe_v0`, `schema_final: false`,
  `runtime_enabled: false`, `production_admission: false`, `public_safe: true`.
  Nothing here is frozen or final.
- Each file additionally carries a top-level `_local_mirror` marker block that
  records that it is a Freeside-local mirror, its canonical Dixie source, and
  its draft / non-runtime status. The adapter ignores `_local_mirror`; it is
  there for human readers and to make the mirror's status unambiguous on disk.

## What these are NOT

- **Local mirrors do not create any Freeside Characters runtime behavior.** They
  are static JSON read only by a test. No source path imports them, no command
  reads them, no renderer touches them, and no package surface exports them.
- They are **not** a live Dixie call, a live Dixie admission route, storage,
  auth / consent, a public `remember-this`, Discord history ingestion, user chat
  becoming memory, or any production behavior. None of those is added, implied,
  or unblocked by mirroring these probes.
- They are **not** a rename of, or a mutation to, any local fixture under
  `docs/admission-wedge/fixtures/` and they change no reducer reason code. The
  local proof labels remain local proof labels; the Dixie probe labels remain
  Dixie-owned draft v0 labels. Neither set is a frozen final schema, and Freeside
  Characters does not own the Dixie or Straylight vocabulary.

## The five mirrored probes

| File | Dixie `scenario_id` | Local scenario it aligns to |
|------|---------------------|-----------------------------|
| `candidate-pending-not-recallable.json` | `candidate_pending_not_recallable` | `before_admission_excluded` |
| `accept-candidate-to-admitted-assertion.json` | `accept_candidate_to_admitted_assertion` | `accepted_admitted_included` |
| `reject-candidate-no-assertion.json` | `reject_candidate_no_assertion` | `rejected_excluded` |
| `supersede-with-corrected-assertion.json` | `supersede_with_corrected_assertion` | `supersession_corrected_only` |
| `malformed-or-unsafe-payload-fail-closed.json` | `malformed_or_unsafe_payload_fail_closed` | `malformed_fail_closed` |

The local scenario names are the Phase 44C runner's
(`run-admission-wedge-fixture-demo.ts`) scenario labels; the alignment is proven
in the adapter test against the existing Phase 44A reducer / 44C runner output.

## Refresh / reconciliation

These mirrors are a point-in-time copy of `dixie_admission_wedge_probe_v0`. They
should be **refreshed or reconciled only through a future gate** if the Dixie
probes change (a later Dixie probe version, or a Dixie Phase 33D hardening). Do
not hand-edit them to diverge from the Dixie source; if the Dixie probes move,
open the reconciliation gate that owns the refresh rather than silently editing
here. This directory carries **no live Dixie calls, no storage, no auth, no
`remember-this`, no Discord ingestion, and no production behavior.**

> **Phase 45H status note (added later).** Dixie has since hardened the draft
> probes to **v1** (`dixie_admission_wedge_probe_v1`, Dixie Phase 33E / PR #122
> — all five scenarios preserved, no sixth probe). These mirrors **remain v0**
> historical / local proof mirrors; they were **not** refreshed. Freeside
> Characters' gated response is `docs/ADMISSION-WEDGE-DIXIE-V1-MIRROR-REFRESH-GATE.md`
> (Phase 45H, docs / decision only), which defers the v1 mirror refresh /
> adapter compatibility to a future, separately-gated **Phase 45I**.

## Provenance

- `../loa-dixie/docs/admission-wedge/fixtures/README.md` — Dixie Phase 33C draft
  v0 probe set + validator (canonical source). Read only; not edited from this
  repo.
- `docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md` — Phase 45E
  reconciliation / next-lane decision; its §10–§11 authorize this narrow,
  test-only Phase 45F no-op adapter / validator lane.
- `docs/admission-wedge/fixtures/README.md` — the Phase 43C local fixture /
  operator-contract these mirrors are aligned against (unchanged; the adapter
  renames and mutates nothing there).
- `packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  (+ `.test.ts`) — the Phase 45F pure, local, no-op adapter / validator and its
  test that consume these mirrors.
- `docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md` — Phase 45G
  acceptance / next-lane gate. Accepts the Phase 45F adapter that consumes
  these mirrors as a **test-only / docs-fixture-bound semantic bridge** (these
  mirrors stay local mirrors, not canonical upstream truth) and recommends
  Dixie Phase 33D probe hardening as the next lane. Mutates none of these
  mirrors; authorizes no runtime wiring or adapter export.
