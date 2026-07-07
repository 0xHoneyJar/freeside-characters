# Recall Wedge — Dixie Contract Reconciliation for Recorded Fixtures

> **Phase 37A** (docs-only). Companion to
> `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A live-boundary
> decision),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint), and
> `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E cross-repo
> request / handoff).
>
> This document is a **fixture / contract reconciliation artifact**.
> It is not implementation, not a live contract, and not a live-client
> spike. It consumes the Dixie-side Phase 32E route contract and the
> Dixie-side Phase 32F readiness checkpoint as **external contract
> evidence** and reconciles the local recorded Dixie envelope fixtures
> and the local pure adapter assumptions against that evidence.
>
> No code, package, lockfile, fixture, validator, adapter, runner,
> Discord interaction wiring, Telegram bot wiring, command
> registration, live Dixie / Straylight / Finn integration,
> `@loa/dixie` / `@loa/straylight` runtime dependency, production
> storage, live memory admission, positive `authorized_private_session`
> projection, `authorized_private_session` renderer, `public_telegram`
> renderer, LLM/voice rewrite, or character voice changes are
> introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the live-boundary
> decision, the readiness checkpoint, the cross-repo request, and the
> Dixie-side Phase 32E / 32F artifacts before silently expanding scope
> from this reconciliation.

---

## 1. Status and purpose

This is **Phase 37A**, and it is **docs / fixture reconciliation
only**.

Phase 37A exists because Dixie has now answered the cross-repo Phase
36E request:

- Dixie Phase 32E published the governing **Dixie Recall Wedge route
  contract** at
  `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`.
- Dixie Phase 32F published the **cross-repo readiness checkpoint** at
  `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`.

Phase 32F is explicit that the route contract unblocks **downstream
contract reconciliation only**, not live integration. The downstream
reconciliation is Phase 37A.

Phase 37A answers a single question: now that Dixie has a route-
contract artifact, **what may the local recorded Dixie envelope
fixtures and the local pure adapter still claim, and what must they
not claim?**

The answer, summarized: the local fixtures remain **recorded local
probe envelopes** that drive adapter no-leak and fail-closed proof.
They are **not Dixie schema authority**, **not live route responses**,
and **not production traffic**. Phase 37A reconciles their identity
against Phase 32E / 32F as a fixture-bound pre-live surface.

Phase 37A does **not**:

- add a live Dixie client;
- add network calls;
- add Discord command wiring;
- add Telegram rendering;
- add public renderer expansion;
- add `public_telegram` positive renderer support;
- add `authorized_private_session` positive renderer support;
- add production storage or admission;
- add live memory admission;
- add auth / consent implementation;
- add character voice or LLM rewriting on recall output;
- alter Straylight semantic ownership;
- alter Dixie HTTP / BFF route ownership.

---

## 2. Dixie contract evidence consumed

Phase 37A consumes two Dixie-side documents as external contract
evidence, in the form they exist on Dixie main today:

- `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  — the **governing Dixie Recall Wedge route contract**.
- `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  — the **cross-repo readiness checkpoint** over Phase 32E for
  freeside-characters reconciliation.

What these documents establish (re-stated here so future readers do
not have to re-derive it):

- **Phase 32E is the governing Dixie route contract.** It defines the
  route, the served-body shape, the denied / refused mapping, the
  idempotency / replay behavior, the `Idempotency-Key` requirement,
  the HTTP no-leak posture, the explicit non-ownership boundary, and
  the test evidence matrix from Dixie Phases 32A–32D.
- **Route under contract.** Dixie owns
  **`POST /api/recall/intake`** as the BFF route that consumes and
  serves Straylight recall-intake responses.
- **Phase 32F unblocks reconciliation only.** Phase 32F is docs-only
  and is explicit that Phase 32E is sufficient to unblock a downstream
  freeside-characters contract-reconciliation phase against Dixie's
  documented route, but is **not** sufficient to unblock live network
  calls, Discord / Telegram command wiring, production storage /
  admission, public renderer expansion, or direct Finn runtime / audit
  wiring. Phase 37A is exactly that downstream reconciliation phase.
- **Source hierarchy.** Straylight remains the semantic owner of
  Recall Wedge policy, envelope semantics, tenant redaction, actor-
  private exclusion, contested marking, revocation, forgetting,
  receipt-hash computation, and denied-recall reason vocabulary. Dixie
  owns the HTTP / BFF route behavior — ingress refusals, idempotency /
  replay under the per-estate mutex, HTTP status mapping for served /
  denied / `needs_review`, and the route-level no-leak posture. Dixie
  is not the semantic owner of governed memory or admission.
- **Service auth vs end-user recall authorization.** The two contracts
  are explicitly distinct: a service-authenticated request can still
  be recall-forbidden via a `403`-class refusal envelope. Downstream
  consumers must classify those refusals as **user-authorization**
  failures, not service-auth failures.
- **Public-bound minimization at source.** Public-bound responses must
  be minimized at the source before reaching public renderers.
  "the adapter will drop it" is **not** a sufficient reason to pass
  unnecessary raw / private / operator / source fields downstream.
- **`recorded_dixie_recall_envelope` is a freeside-side fixture /
  probe kind.** It is not a Dixie-owned schema label and is not a
  live wire kind. Production traffic must not be labelled
  `recorded_dixie_recall_envelope`; any live-wire `input_envelope_kind`
  must be reconciled against Phase 32E and any future Dixie route-
  expansion phase, not against the recorded probe kind.

---

## 3. Reconciliation verdict

The local recorded Dixie envelope corpus
(`docs/recall-wedge/fixtures/dixie-envelope/`) and the local pure
adapter
(`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`)
are reconciled against Phase 32E / 32F as follows:

- The existing `recorded_dixie_recall_envelope` fixtures **remain
  valid as local, synthetic, non-production probes**. They are
  reviewed, deterministic, and useful for adapter proof.
- They are **not promoted** to Dixie schema authority. Phase 32E does
  not adopt `recorded_dixie_recall_envelope` as a live wire kind, and
  Phase 32F is explicit that production traffic must not use the
  recorded probe kind.
- They are **not full Phase 32E HTTP request / response fixtures**.
  Phase 32E describes a `POST /api/recall/intake` HTTP surface with
  served-body / refusal-envelope shapes, idempotency / replay
  behavior, and `Idempotency-Key` ingress requirements. The local
  recorded envelopes are **Dixie-shaped recall-payload probes**, not
  live HTTP request bodies, response bodies, or refusal envelopes
  from that route. They predate the route-contract artifact and do
  not attempt to mirror the route-level HTTP surface.
- They **must not** be used as production traffic. They have no
  production authorization context (each carries a
  `non_production_authorization_note`) and they intentionally embed
  raw / private / debug sentinel material so the adapter can be
  proven to strip it.
- They **remain useful** because they prove the adapter narrowing
  boundary, fail-closed behavior, no-leak / no raw / no private / no
  debug projection, public-safe minimization at the adapter seam, and
  the negative-corpus error codes
  (`unsupported_dixie_envelope_version`,
  `authorized_private_projection_not_implemented`,
  `public_telegram_projection_not_implemented`,
  `missing_public_recall_payload`, and the
  missing-target stable-equivalent error).
- **No fixture JSON needs to be changed in this phase.** No concrete
  inconsistency was found between any individual fixture's shape and
  Phase 32E / 32F. Phase 32E does not redefine the local probes; it
  defines the live HTTP route surface, which the local probes do not
  claim to be.
- **No adapter source needs to be changed in this phase.** No
  concrete inconsistency was found between the adapter's narrowing
  contract and Phase 32E / 32F. The adapter operates only over
  in-memory recorded envelope data, never calls a network, never
  imports `@loa/dixie` or `@loa/straylight` runtime, and continues to
  fail closed on unsupported versions and on
  `authorized_private_session` / `public_telegram` targets — all of
  which Phase 32F explicitly leaves blocked.
- **No public renderer behavior is expanded.** The Phase 33C public-
  safe renderer continues to render `public_discord` /
  `discord_public_character` only, and only for positive recorded
  fixtures; negative fixtures continue to surface as fail-closed
  summaries on the operator / internal proof path only.

If a later inspection finds a concrete inconsistency between a
specific fixture or a specific adapter assumption and Phase 32E /
32F, that finding belongs in a **separate** subsequent phase — it
must not be folded silently into Phase 37A's docs-only scope.

---

## 4. Mapping table — Dixie Phase 32E / 32F vs current freeside fixture / adapter state

The "Phase 37A disposition" column uses these labels:

- **keep** — current local posture is reconciled and remains as-is.
- **document-only** — local code/fixtures do not represent this
  concern; Phase 37A records that explicitly so the gap is not
  mistaken for coverage.
- **future live phase** — concern lives outside the recorded-fixtures
  surface; reconciliation defers to a later, separately authorized
  live phase.
- **not represented** — concern intentionally not represented in
  recorded fixtures or adapter; the boundary is preserved.
- **fail-closed** — adapter / validator already fails closed on this
  concern and continues to.

| Concern | Dixie contract position (Phase 32E / 32F) | Current freeside fixture / adapter position | Phase 37A disposition |
|---|---|---|---|
| route path `POST /api/recall/intake` | governing route under Phase 32E §2; `POST /api/recall/intake` is the Dixie BFF surface; Dixie owns it | recorded fixtures are Dixie-shaped recall-payload probes; the local adapter is a pure in-memory function and does not reference any HTTP path | document-only · future live phase |
| `Idempotency-Key` requirement | Phase 32E §2.3 / ADR-026D §3.b: `Idempotency-Key` header required at ingress (1–256 chars); missing or oversized → `ingress.missing_idempotency_key` refusal | recorded fixtures and adapter do not represent HTTP headers; no `Idempotency-Key` semantics in the local probe path | document-only · future live phase |
| served response body | Phase 32E §2.1: HTTP `200` with the seam response verbatim, including the enriched `RecallReceipt.redacted_counts_by_reason`; Dixie does not recompute, reorder, or omit fields | local adapter projects a Dixie-shaped envelope into a public-safe DTO consumed by the Phase 33C renderer; it does **not** project a `RecallReceipt` and does **not** claim to be the served-path body shape | document-only · future live phase |
| denied / refused response behavior | Phase 32E §2.2: Straylight denied / `needs_review` mapped through `mapSeamResponseToRefusal` to documented HTTP refusal classes (`400`/`403`/`503`); ingress refusals carry their matching `400/401/403/413/429`; never converts denial to served `200` | recorded refusal/unauthorized fixture is shaped as `target_projection.recall_interface=public_discord`, `outcome=referral`, `denied_or_refused=true`, generic safe referral target; adapter narrows to the existing public-safe contract and does not authorize a positive private projection | keep (recorded probe is consistent with Phase 32F's "service-authenticated request can still be recall-forbidden" classification) · live-wire HTTP refusal envelope shape remains future live phase |
| idempotency / replay behavior | Phase 32E §2.3: first call invokes the seam under per-estate mutex and pins the response; subsequent calls with the same `(tenant_id, caller_actor_id, request_key)` return the prior response verbatim; cap-exceeded refusals deliberately bypass cache | recorded fixtures and adapter are stateless / pure; no idempotency cache, no replay semantics; local probes never claim to model replay | document-only · future live phase |
| no-leak / public-bound minimization | Phase 32E §2.1 / §2.2: served body and refusal envelope must not leak private Straylight-side source material; Phase 32F §8: public-bound responses must be minimized at the source, "the adapter will drop it" is not sufficient upstream | adapter is the only narrowing boundary on the freeside side and strips raw / private / debug material (`raw_dixie_debug`, `raw_session_trace`, `source_material`, `PRIVATE_SENTINEL_*`, `session_id`, `message_id`, `continuity_actor_id`) before any DTO emission; the Phase 33B no-leak validator greps the public-safe projected DTOs for sentinel substrings | keep (defense-in-depth at the freeside seam; does not relax Phase 32F's "minimize at source" rule for the live route) |
| Straylight semantic ownership | Phase 32E §1 / §4 + Phase 32F §2: Straylight owns Recall Wedge policy, envelope semantics, tenant redaction, actor-private exclusion, contested marking, revocation, forgetting, receipt-hash computation, denied-recall reason vocabulary | local fixtures and adapter do not author Straylight semantics; recorded envelopes are explicitly synthetic local probes; no `@loa/straylight` runtime dependency | keep · semantic ownership unchanged |
| Dixie HTTP / BFF route ownership | Phase 32E §1 / §2 + Phase 32F §2: Dixie owns ingress refusals, idempotency / replay, HTTP status mapping for served / denied / `needs_review`, and the route-level no-leak posture | local fixtures and adapter do not author HTTP route behavior; no `@loa/dixie` runtime dependency; adapter is pure / synchronous / in-memory only | keep · route ownership unchanged |
| `recorded_dixie_recall_envelope` fixture kind | Phase 32F §6: `recorded_dixie_recall_envelope` is a freeside-characters fixture / probe `input_envelope_kind`; not Dixie-owned; not a live wire kind; production traffic must **not** be labelled `recorded_dixie_recall_envelope` | every fixture under `docs/recall-wedge/fixtures/dixie-envelope/` declares `fixture_kind: recorded_dixie_recall_envelope` and `input_envelope_kind: recorded_dixie_recall_envelope`, plus a `non_production_authorization_note`; the validator enforces these invariants | keep (boundary is correct as-is and is consistent with Phase 32F §6) |
| unknown / unsupported envelope version fail-closed behavior | Phase 32F §6: unknown or unsupported envelope / route-contract assumptions should fail closed in downstream adapters, validators, and tests | adapter throws `unsupported_dixie_envelope_version` on any version not in `SUPPORTED_DIXIE_ENVELOPE_VERSIONS`; validator requires the unknown-version negative fixture to carry `envelope_version` not in the supported list | fail-closed |
| `public_telegram` fail-closed behavior | Phase 32F §5: `public_telegram` positive renderer support remains blocked; Phase 32F §9: `public_telegram` must remain fail-closed unless the multi-surface DTO gate is independently satisfied (Phase 32E does not satisfy it) | adapter throws `public_telegram_projection_not_implemented` on `target_projection.recall_interface=public_telegram`; validator requires the negative fixture in this exact shape | fail-closed |
| `authorized_private_session` fail-closed behavior | Phase 32F §5: `authorized_private_session` positive renderer support remains blocked; Phase 32F §9: `authorized_private_session` must remain fail-closed unless the multi-surface DTO gate (`RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` §5a) is independently satisfied (Phase 32E does not satisfy it) | adapter throws `authorized_private_projection_not_implemented` on `target_projection.recall_interface=authorized_private_session`; validator requires the negative fixture in this exact shape | fail-closed |
| `session_id` / `message_id` / tenant / community / thread identifiers as operational only | Phase 32F §5: treating session IDs, message IDs, thread IDs, tenant IDs, or community IDs as governed memory identity is **blocked**; they remain operational identifiers, not memory identity | session-bearing positive fixture carries synthetic `session_id` / `message_id` / `tenant_id` / `community_id` / `session_thread_id`; adapter strips them; projected DTO and Phase 33C public render never emit them; validator and adapter tests confirm | keep · not represented as governed identity |
| public renderer exposure bans | Phase 32F §5: public renderer changes that expose raw receipts, debug payloads, hidden / private reasons, source material, actor IDs, private assertion IDs, `continuity_actor_id`, `raw_reasons`, `raw_session_trace`, `raw_dixie_debug`, hidden estate material, raw chat logs, or unredacted user / session internals are **blocked** | Phase 33B no-leak validator enforces the public-safety contract on the public-safe projected DTOs (greps for `PRIVATE_SENTINEL_*`, `raw_reasons`, `debug`, `private_assertion_id`, `source_material`, `hidden estate`, `assertion_id`, `full assertion bodies`, `private identifiers`); adapter never projects raw / private / debug fields | keep · not represented as exposed |

---

## 5. Required local fixture posture after reconciliation

Restated explicitly so that the boundary cannot drift through silent
edits:

- **`recorded_dixie_recall_envelope` remains fixture / probe-only.**
  It is a freeside-characters fixture `input_envelope_kind`. It is
  not a Dixie-owned schema label, not a live wire kind, and not a
  Dixie route response shape.
- **`envelope_version: recall_wedge.dixie_envelope.v0` remains a
  local recorded-probe version.** It is not live Dixie schema
  authority. Phase 32E governs the Dixie HTTP route; any live wire
  `input_envelope_kind` or live envelope version must be reconciled
  against Phase 32E (or a future Dixie route-expansion phase), not
  against the local recorded version.
- **Production traffic must not use `recorded_dixie_recall_envelope`.**
  Per Phase 32F §6, recorded probe inputs are reserved for
  fixture / probe use. Live traffic must use a distinct, Dixie-owned
  live `input_envelope_kind`.
- **Current positive fixtures remain `public_discord` /
  `discord_public_character` only.** No positive fixture under
  `docs/recall-wedge/fixtures/dixie-envelope/` becomes a
  `public_telegram` positive or an `authorized_private_session`
  positive in this phase.
- **Current negative fixtures for `authorized_private_session` and
  `public_telegram` remain negative.** They drive
  `authorized_private_projection_not_implemented` and
  `public_telegram_projection_not_implemented` respectively, with
  no positive renderer authorized.
- **Unknown envelope versions remain fail-closed.** Adapter throws
  `unsupported_dixie_envelope_version`; validator continues to
  require the unknown-version negative fixture to carry
  `envelope_version` not in the supported list.
- **Raw / private / debug / operational fields must not reach public
  DTOs or rendered output.** This includes
  `raw_dixie_debug`, `raw_reasons`, `raw_session_trace`,
  `source_material`, private identifiers, `continuity_actor_id`,
  actor IDs, assertion IDs, `session_id`, `message_id`,
  `tenant_id`, `community_id`, and `session_thread_id`. The adapter
  strips them at the narrowing boundary; the Phase 33B no-leak
  validator greps the public-safe projected DTOs to prove they
  never appear.

---

## 6. What remains blocked

Phase 37A is a docs / fixture reconciliation phase. It does **not**
authorize, and Phase 32F explicitly does **not** unblock, any of the
following. Each item below remains blocked:

- a live Dixie client in freeside-characters;
- network calls (HTTP, gRPC, MCP, or otherwise) to Dixie or Straylight;
- live Discord command wiring to Recall Wedge;
- live Telegram rendering of Recall Wedge output;
- `public_telegram` positive renderer support;
- `authorized_private_session` positive renderer support;
- production storage / admission;
- live chat / session memory admission;
- signer / auth / consent production binding;
- treating `session_id`, `message_id`, `session_thread_id`,
  `tenant_id`, or `community_id` as governed memory identity;
- public renderer expansion (additional surfaces, additional fields,
  loosened minimization);
- direct Finn runtime / audit wiring;
- LLM rewriting / character-voiced recall summaries.

If a later phase reaches for any of the above, it must re-open the
boundary doc (Phase 33A), the multi-surface contract (Phase 35C),
the live-boundary decision (Phase 36A), the live-Dixie readiness
checkpoint (Phase 36D), the cross-repo request (Phase 36E), and the
Dixie-side Phase 32E / 32F artifacts before silently expanding scope
from this reconciliation.

---

## 7. Future phase gates

Phase 37A does not authorize a live-client spike. A separate, later
phase may authorize one, subject to the following gates:

- **A separate phase is required.** A live-client spike must be
  proposed as its own phase after this reconciliation. Phase 37A
  itself does not roll forward into a live spike.
- **Recorded probes must not be reused as production traffic.**
  Per Phase 32F §6, `recorded_dixie_recall_envelope` is reserved for
  fixture / probe input. A live spike must use a distinct,
  Dixie-owned live `input_envelope_kind` reconciled against Phase
  32E (or any future Dixie route-expansion phase), not the local
  recorded probe kind.
- **Service auth vs end-user recall authorization must be addressed.**
  Per Phase 32F §7, the two contracts are distinct. A
  service-authenticated request can still be recall-forbidden via a
  Straylight-denied refusal envelope. The live spike must classify
  refusals as user-authorization failures, not service-auth
  failures, and must not collapse the two.
- **Idempotency-Key / retry / replay behavior must be addressed.**
  Per Phase 32E §2.3 and ADR-026D §3.b, `Idempotency-Key` is
  required at ingress, the per-estate mutex pins the response, and
  replay returns the prior response verbatim. The live spike must
  decide how the freeside-side caller generates, retries, and
  interprets `Idempotency-Key`, including how it handles cap-exceeded
  refusals that deliberately bypass the cache.
- **HTTP-response vs internal-DTO consumption must be chosen
  explicitly.** A live spike must decide whether it consumes
  Dixie's HTTP responses directly (and projects through a narrowing
  adapter) or consumes a narrowed internal client DTO (provided by a
  separate, explicitly authorized client package). Either way, the
  narrowing boundary must remain a single point in the freeside-
  side code path.
- **Public-bound minimization at source must be preserved.** Per
  Phase 32F §8, public-bound responses must be minimized at the
  source. "the adapter will drop it" is not sufficient upstream. A
  live spike must not regress the no-leak posture and must not let
  raw / private / operator / source fields reach public renderers
  on the assumption that the adapter will strip them.

---

## 8. Acceptance criteria

Phase 37A is acceptable if:

- exactly **one new reconciliation doc is added** (this file);
- the existing fixture README
  (`docs/recall-wedge/fixtures/README.md`) gains a **targeted
  Phase 37A addendum** that points to Phase 32E / 32F and restates
  that recorded fixtures are not promoted to live Dixie schema
  authority;
- **no live integration** is introduced — no live Dixie client, no
  network calls, no Discord / Telegram command wiring, no public
  renderer expansion, no production storage, no admission, no
  character voice;
- **no source code changes** are made unless a concrete
  inconsistency is found and reported — Phase 37A reports none;
- **no fixture JSON changes** are made unless a concrete
  inconsistency is found and reported — Phase 37A reports none;
- **no package or lockfile changes** are made; no `@loa/dixie` /
  `@loa/straylight` runtime dependency is added;
- **no CI or generated-file changes** are made;
- the existing fixture validator
  (`docs/recall-wedge/fixtures/validate-fixtures.mjs`) still passes;
- the existing adapter and runner tests
  (`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`,
  `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts`)
  still pass if run.

---

## 9. Cross-references

- `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  — governing Dixie Recall Wedge route contract.
- `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  — cross-repo readiness checkpoint over Phase 32E.
- `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A) — boundary doc.
- `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A) — MVP acceptance
  handoff.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A) — post-MVP
  decision map.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C) —
  multi-surface contract; the §5a authorized-private DTO gate and
  the §8a future-renderer warning remain independent of Phase 32E.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A) — live
  boundary and recorded-fixtures-not-schema-authority posture.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D)
  — readiness preconditions.
- `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E) —
  cross-repo request / handoff this reconciliation answers.
- `docs/recall-wedge/fixtures/README.md` — fixture README; gains a
  Phase 37A addendum in this phase.
- `docs/recall-wedge/fixtures/dixie-envelope/` — recorded probe
  fixtures reconciled by this phase.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  — pure narrowing adapter; reconciliation target for this phase.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`
  — adapter unit tests.
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`
  — dev / operator runner over the recorded corpus.
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts`
  — runner regression tests.
- `docs/recall-wedge/fixtures/validate-fixtures.mjs` — fixture
  validator.
