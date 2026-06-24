# Recall Wedge — cross-repo Dixie contract request / handoff

> **Phase 36E** (docs-only). Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A live-boundary
> decision), and
> `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint).
>
> This document is a **request / handoff artifact**, not implementation
> and **not the live contract**. It is a freeside-authored ask for a
> Dixie-owned (or explicitly cross-repo-accepted) live Recall Wedge
> envelope contract. A freeside-authored draft cannot satisfy the
> readiness checkpoint's §4 / §4a / §6 by itself. Live Dixie client
> work in this repo remains blocked until a Dixie-owned or explicitly
> cross-repo-accepted contract exists and the local recorded fixtures,
> adapter, validator, and tests are reconciled against it.
>
> No code, package, lockfile, fixture, validator, adapter, runner,
> Discord interaction wiring, Telegram bot wiring, command
> registration, live Dixie / Straylight / Finn integration,
> `@loa/dixie` / `@loa/straylight` dependency, production storage, live
> memory admission, positive `authorized_private_session` projection,
> `authorized_private_session` renderer, `public_telegram` renderer,
> LLM/voice rewrite, or character voice changes are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the live-boundary
> decision, and the readiness checkpoint — do not silently expand scope
> from this request.

---

## 1. Status and purpose

This is **Phase 36E**, and it is **docs-only**. Its purpose is to put
in writing — in a form that can be lifted into a Dixie-side issue, a
Straylight-side spec, or an explicitly cross-repo-accepted decision
artifact — the contract items, canonical examples, and clarifications
freeside-characters needs from the Dixie side before any live Recall
Wedge client can land in this repo.

This phase does not open an issue, does not open a PR, does not modify
any code, and does not author the live contract itself.

### Recall Wedge phase ladder

The fixture-bound + recorded-envelope-bound Recall Wedge ladder
preceding this phase:

- **Phase 33A** — boundary doc
  (`docs/RECALL-WEDGE-MEMORY-MVP.md`).
- **Phase 33B** — seed memory packet + projected DTO fixtures
  (operator-private, public-discord, character-boundary-referral) +
  no-leak fixture validator
  (`docs/recall-wedge/fixtures/`,
  `docs/recall-wedge/fixtures/validate-fixtures.mjs`).
- **Phase 33C** — deterministic public-safe Recall Wedge renderer
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`).
- **Phase 33D** — fixture-bound cross-interface continuity demo
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`).
- **Phase 34A** — MVP acceptance handoff
  (`docs/RECALL-WEDGE-MVP-ACCEPTANCE.md`).
- **Phase 35A** — post-MVP decision map
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`).
- **Phase 35B** — explicit dev/operator demo runner
  (`packages/persona-engine/src/recall-wedge/run-demo.ts`).
- **Phase 35C** — multi-surface interaction contract
  (`docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md`).
- **Phase 35D** — recorded Dixie envelope fixtures + pure adapter +
  adapter unit tests
  (`docs/recall-wedge/fixtures/dixie-envelope/*`,
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`,
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`).
- **Phase 36A** — live-boundary decision
  (`docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md`).
- **Phase 36B** — expanded recorded Dixie envelope corpus + adapter /
  validator regression tests (refusal-unauthorized, session-bearing,
  authorized-private negative target, public-telegram negative target,
  malformed-missing-payload, malformed-missing-target).
- **Phase 36C** — dev/operator runner over the recorded Dixie envelope
  fixture corpus
  (`packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`,
  `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts`).
- **Phase 36D** — live Dixie readiness / cross-repo contract checkpoint
  (`docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md`).
- **Phase 36E** — *this* cross-repo Dixie contract request / handoff.

---

## 2. What freeside-characters has already proven

A summary of the local proof, restated here so the cross-repo recipient
of this request does not have to read the full ladder to know what
already exists on the freeside-characters side. None of this proof
constitutes a live contract; it constitutes the local narrowing /
fail-closed surface the live contract must be reconciled against.

- **A recorded Dixie-shaped envelope corpus exists** under
  `docs/recall-wedge/fixtures/dixie-envelope/`. Each fixture is
  synthetic, explicitly versioned (`recall_wedge.dixie_envelope.v0`),
  carries a `non_production_authorization_note`, and uses a
  fixture/probe `input_envelope_kind` of
  `recorded_dixie_recall_envelope`.
- **Positive fixtures exist.** The corpus includes a normal public
  envelope, a referral/downgrade envelope, a refusal/unauthorized
  envelope, and a session-bearing public envelope (used to prove
  operational identifiers do not leak into the projected DTO or
  rendered public text).
- **Negative fixtures exist.** The corpus also includes an
  unknown-version envelope, an authorized-private-target envelope, a
  public-telegram-target envelope, a malformed-missing-payload
  envelope, and a malformed-missing-target envelope. Each is
  intentionally crafted to fail closed at the adapter with a stable
  error code.
- **The fixture validator requires the corpus.**
  `docs/recall-wedge/fixtures/validate-fixtures.mjs` enforces fixture
  invariants — `synthetic`, `fixture_kind`, `input_envelope_kind`,
  supported / intentionally-unsupported `envelope_version`,
  `non_production_authorization_note` — across the recorded fixture
  set, including its positive/negative split.
- **A pure adapter narrows recorded envelopes to local projected
  DTOs.**
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  is synchronous, in-memory, no network, no Discord/Telegram/Dixie/
  Finn/Straylight/storage/LLM imports. It is the only narrowing
  boundary from a Dixie-shaped envelope to a Recall Wedge projected
  DTO.
- **The public-safe renderer renders positive public fixtures.** The
  Phase 33C `renderPublicRecallProjection` consumes only the local
  projected DTO. The public renderer never reads a Dixie envelope
  directly.
- **Negative fixtures fail closed.** Unknown version, wrong
  `input_envelope_kind`, missing `target_projection`, missing
  `public_recall_payload`, unknown outcome, missing referral fields,
  authorized-private target, public-telegram target, and any banned
  private/raw/debug material in source fields or in the reconstructed
  projection all map to stable adapter or renderer error codes — never
  to a public render.
- **The dev/operator runner partitions output.** The Phase 36C
  runner separates positive renderable fixtures (public-safe rendered
  output) from negative fail-closed fixtures (adapter error class +
  stable error code, surfaced only under the INTERNAL / operator-only
  proof section).
- **No live Dixie exists.** No live Dixie client, no network call,
  no Dixie SDK dependency, no `@loa/dixie` / `@loa/straylight` / Finn
  integration, no production storage, no live memory admission, no
  Discord interaction wiring of Recall Wedge, no Telegram bot wiring
  of Recall Wedge.

---

## 3. Explicit non-authority statement

This document is **not** the live Recall Wedge / Dixie envelope
contract. The recipient of this request must read the following
clauses as load-bearing.

- **This handoff/request is not the contract.** It is a
  freeside-authored ask. A freeside-authored draft cannot satisfy the
  readiness checkpoint's §4 / §4a / §6 by itself. The authoritative
  response must be Dixie-owned (a Dixie-repo schema doc, OpenAPI / RPC
  artifact, or Dixie-side contract document) or explicitly cross-repo
  accepted (a shared decision artifact both sides treat as
  authoritative).
- **Local recorded fixtures are sample v0 probes only.** The fixtures
  under `docs/recall-wedge/fixtures/dixie-envelope/` are synthetic
  contract probes authored to exercise the adapter's narrowing
  boundary, fail-closed paths, refusal / downgrade shapes, public
  no-leak invariants, and the dev/operator runner. They are
  **not** production schema authority and **not** a baseline that
  Dixie must match.
- **Local fixtures are reconciliation inputs.** Once a Dixie-owned or
  explicitly cross-repo-accepted contract exists, the local recorded
  fixtures are compared against the Dixie-owned canonical examples and
  updated to match. They do not survive as schema authority through
  inertia.
- **Dixie-owned or explicitly cross-repo-accepted examples
  supersede local probes.** If a Dixie-owned contract or sample
  envelope differs from the local v0 probe, the divergence is resolved
  in Dixie's favor. A freeside-characters reviewer must not reject a
  Dixie-owned contract on the grounds that "our local fixtures don't
  match." The local fixtures change.
- **freeside-characters must update fixtures, adapter, validator,
  and tests if the Dixie-owned contract differs.** Adapter dispatch
  entries (e.g., `input_envelope_kind`), envelope version handling,
  outcome / refusal / error mapping, source-field allowlist,
  public-bound field allowlist, and adapter / validator / runner tests
  are all subject to the Dixie-owned contract once it exists. None of
  them is frozen by Phase 36B / 36C.
- **Production traffic must not fake
  `recorded_dixie_recall_envelope`.** That kind is reserved for
  fixture/probe input, per readiness checkpoint §4c. Live traffic
  must use a distinct live `input_envelope_kind` defined by the
  Dixie-owned contract; live traffic must never be labelled with the
  recorded kind merely to satisfy the existing adapter dispatch.

---

## 4. Requested Dixie-owned contract artifact

freeside-characters asks Dixie (or, where applicable, the cross-repo
forum that owns this surface) to provide or accept an artifact that
defines, in writing, all of the items below. This list is the bar.
Partial coverage does not promote a draft into a contract; readiness
checkpoint §4a is the acceptance bar.

- **Artifact owner / approver.** Named Dixie-side owner (or
  jointly-named cross-repo signer) who approves changes to the
  contract. A freeside-characters author cannot self-approve.
- **Artifact location.** Canonical URL or repo path where the
  artifact lives. A shared cross-repo location is acceptable only if
  both sides explicitly treat the artifact at that location as
  authoritative; co-location alone is not authority.
- **Version string.** Canonical `envelope_version` identifier and the
  rule for selecting it on a live request/response.
- **Change / deprecation policy.** Rules for additive changes,
  breaking-with-shim transitions, hard cuts, deprecation windows, and
  consumer notification.
- **Endpoint path or RPC name.** Concrete path or RPC name; a clear
  statement of whether the live surface is HTTP/JSON, gRPC, WebSocket,
  or another transport.
- **HTTP / RPC transport status mapping, if applicable.** Explicit
  mapping from transport-level status (HTTP status code, gRPC status,
  etc.) to envelope-level outcome (success / refusal / error class), so
  that the consumer adapter never has to infer outcome from status
  alone, or vice versa.
- **Live `input_envelope_kind`.** The canonical
  `input_envelope_kind` value(s) used on live traffic, distinct from
  the existing `recorded_dixie_recall_envelope` fixture/probe kind.
- **Request fields.** Required and optional fields, types, encoding,
  and any caller / tenant / session / idempotency identifiers carried
  on request.
- **Response fields.** Required and optional fields, types, encoding,
  and the partition of public-bound vs operator-only / internal-only
  fields. Public-bound fields must be named and enumerable.
- **Success outcome shape.** Exact shape of a successful recall
  response envelope, including which fields are public-bound.
- **Refusal / denial outcome shape.** Exact shape of a refusal /
  denial response envelope, including unauthorized, not-found,
  partial-recall variants, and how each maps to a stable consumer-side
  classification with no raw-body bleed.
- **Error outcome shape.** Exact shape of operational error
  envelopes — rate-limited, malformed, internal — and how each maps to
  a stable consumer-side classification.
- **Auth / caller model.** Top-level statement that there are two
  contracts here, not one — see §6 of this document for the full
  decomposition. The artifact must address both service authentication
  and end-user authorization; neither subsumes the other.
- **Service authentication model.** How freeside-characters (the
  *service*) authenticates *to Dixie* — credential type, rotation,
  scope, and behavior on missing/insufficient service auth.
- **End-user authorization / consent / delegation model.** How the
  end-user / caller's authorization to receive recall is established,
  represented on the wire, and enforced. Includes consent capture,
  delegation (if any), and revocation semantics.
- **Tenant / community / session boundary.** Which tenant, community,
  or session a request is bound to; isolation guarantees at the
  envelope layer; cross-tenant refusal behavior; and whether Dixie or
  the caller declares the tenant.
- **`sessionId` / `messageId` and snake_case alias handling.**
  Canonical form (camelCase or snake_case), permitted aliases
  (`session_id` / `message_id` and any tenant / community / thread ID
  aliases), and the rule that they are operational identifiers and not
  memory identifiers.
- **Operational identifier redaction expectations.** What logging
  (Dixie-side and consumer-side) is expected, what must be redacted
  before logging, and the rule that operational logs never carry raw
  hidden / private / debug / source material.
- **Idempotency / retry semantics.** Whether a Recall Wedge call is
  safe to retry, deduplication policy, whether retries can produce
  different projections for the same logical request, and whether the
  caller is expected to carry an idempotency key.
- **Audit / receipt expectations.** What audit evidence (request IDs,
  timestamps, redacted summaries) is recorded, where it lives, who can
  challenge / revoke / forget, and the rule that audit records do not
  carry raw Dixie material.
- **Conformance tests or contract vectors.** Dixie-owned (or
  cross-repo accepted) contract vectors / conformance tests that a
  consumer adapter can run against to prove compatibility — beyond
  "the local adapter still passes its local fixtures."

If any item above is missing, the artifact does not satisfy the
readiness checkpoint and does not authorize live client work in
freeside-characters.

---

## 5. Public-bound response requirements

freeside-characters asks Dixie to clarify, in the contract artifact,
the following about public-bound responses. Phase 35D's adapter and
Phase 33C's renderer enforce a fail-closed no-leak posture on the
consumer side; that posture is defense-in-depth, not a substitute for
upstream minimization.

- **Are public-bound responses minimized at the source?** That is, is
  the default for any field not explicitly designated public-bound to
  be omitted from the public-bound response, rather than included and
  relied-on-downstream-to-drop?
- **Which fields are guaranteed absent from public-bound response
  envelopes?** A named, enumerated list. Examples likely included:
  raw chat-log contents, raw operator diagnostic payloads, hidden
  estate material, private assertion IDs, source material, actor
  identifiers, debug payloads.
- **How are raw / private / debug / operator / source fields
  represented, if at all?** If they exist on a non-public-bound surface
  of the envelope, where do they live, and how is that surface
  unambiguously distinguished from the public-bound surface so the
  consumer adapter can never mistake one for the other?
- **Can public-bound envelopes avoid returning raw hidden / private /
  debug / source material entirely?** That is, is the contract able to
  state that public-bound response envelopes never carry such
  material — making the adapter's no-leak scan a defense-in-depth
  check, not a primary boundary?
- **How does refusal / denial avoid leaking private reasons?** What is
  the contract for refusal-reason representation that makes refusal
  envelopes informative enough for the consumer to classify, but
  generic enough that a public render of a refusal cannot leak the
  hidden reason that justified it?
- **How should unknown / unsupported versions be reported?** What does
  the live wire say when the consumer sends an unknown version, when
  Dixie returns an unknown version, and how should the consumer
  adapter classify each?

To make the boundary unambiguous: the freeside-characters adapter
remains the narrowing boundary, and the renderer's
`PUBLIC_OUTPUT_BANNED_SUBSTRINGS` no-leak scan remains a fail-closed
defense — but **"the adapter will drop it" is not a sufficient reason
for upstream public-bound responses to include unnecessary raw /
private / debug / operator material**. Defense in depth assumes
upstream is already minimized.

---

## 6. Service authentication vs end-user authorization

freeside-characters asks Dixie to clarify, separately and explicitly,
the following. These are two contracts, not one. The §4 / readiness-
checkpoint §4e split must be preserved on the wire and in any
contract artifact.

- **How does freeside-characters authenticate as a service?** Credential
  type (token / mTLS / signed request / other), credential rotation
  policy, credential scope, and behavior on missing or insufficient
  service auth.
- **How is the end-user / caller represented?** Is there a caller
  identity carried alongside the service credential? How is it carried
  (header, request field, signed token), what identity space is it
  drawn from (Discord ID, Loa-side authorized identity, opaque ID,
  other), and how is anonymity / pseudonymity handled?
- **How is caller authorization to receive recall represented?** What
  field, claim, or policy decision establishes that *this* end-user
  / caller is authorized to receive *this* recall — distinct from the
  service being authorized to *call* Dixie at all?
- **Are consent / delegation assumptions included?** If so, how are
  they captured, scoped, and revoked? If consent is not part of this
  envelope at all, where does it live, and what does the envelope
  assume about it?
- **How is authorization failure represented?** What does the
  refusal / denial envelope look like when the service is properly
  authenticated but the end-user is not authorized for this recall?
  What stable classification does the consumer adapter receive?
- **How do service-authenticated but user-unauthorized calls fail
  closed?** Concretely: what is the wire shape, what is the consumer's
  obligation (refuse / downgrade / suppress), and what is forbidden
  (e.g., partial recall leaking authorized fragments to an unauthorized
  caller)?

To restate the rule load-bearingly: **service authentication does not
equal user recall authorization.** A live client can be technically
service-authenticated to Dixie and still be privacy-invalid for a given
recall request. The contract must make this difference explicit.

---

## 7. Session / tenant / identity semantics

freeside-characters asks Dixie to clarify the following. These items
overlap with §4 but are stated separately because the operational-vs-
memory-identity distinction is load-bearing across the multi-surface
contract (§5 of `RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md`) and the
readiness checkpoint §4f.

- **`sessionId` / `messageId` semantics.** Lifetime, scope, rotation
  policy, and the wire-level rule that they are operational identifiers
  carried on the envelope.
- **`session_id` / `message_id` aliases.** Whether snake_case aliases
  exist on the wire, whether they are normalized at any layer, and how
  the consumer adapter is expected to treat each spelling.
- **Tenant / community / session / thread identifiers.** Which IDs
  exist, where they live in the request and response envelopes, what
  each scopes (a community vs a single thread vs a per-message
  routing), and how they relate to one another.
- **Are these IDs stable operational IDs only?** That is, are they
  guaranteed never to identify a memory, an assertion, a continuity
  actor, or any Straylight-side memory entity?
- **Can any of them ever act as memory identity?** If so, where is
  that documented, what are the rules, and what is the safe consumer
  posture in the meantime?
- **How should cross-session continuity be represented?** If a
  continuity-bearing actor is reached from multiple sessions across
  multiple surfaces (per the multi-surface contract §2 same-agent
  invariant), what envelope-level mechanism ties them together — and
  is it distinct from the operational session/message IDs?
- **How do retries / idempotency interact with session / message
  IDs?** Do retried calls reuse session / message IDs? Are duplicates
  detected on the IDs, on an idempotency key, or on something else?

To restate the rule load-bearingly: **session / message / tenant /
thread IDs must not be treated as memory identity by
freeside-characters unless the Dixie / Straylight contract explicitly
says so.** Until the contract says otherwise, the consumer adapter
treats every operational identifier as transport-only and rejects any
attempt to leak it into public output, regardless of which spelling or
alias is used.

---

## 8. Expected envelope examples requested

freeside-characters asks Dixie for canonical examples of each shape
below. Examples should be Dixie-owned or explicitly cross-repo
accepted; once they exist, they supersede the local recorded probes
under `docs/recall-wedge/fixtures/dixie-envelope/` (see §10
reconciliation). Local recorded probes are reconciliation inputs, not
a baseline Dixie must match.

- **Success — public-safe recall envelope.** The default success case
  for a public-bound recall.
- **Refusal / denial envelope.** A representative refusal — e.g.,
  unauthorized, not-found, partial-recall — illustrating how refusal
  reasons are represented on the wire without leaking private content
  to a public render.
- **Unsupported version error.** A wire example of how an unknown or
  unsupported `envelope_version` is reported, and how the consumer is
  expected to fail closed.
- **Missing / invalid caller authorization.** A wire example of a
  service-authenticated but user-unauthorized call (per §6), including
  the refusal envelope shape and stable classification.
- **Tenant / session mismatch.** A wire example of a request bound to
  one tenant / community / session that attempts to recall content
  scoped to another, and the corresponding refusal envelope.
- **Retry / idempotency duplicate.** A wire example of a retried call
  that Dixie deduplicates, including how the second response is
  represented (cached projection, no-op, distinct outcome).
- **Redacted public-bound response.** A wire example showing how a
  response that contains both public-bound and operator/internal-only
  surfaces is partitioned — and what the public-bound projection
  looks like once minimized at the source per §5.
- **Optional internal / operator-only diagnostic example, if any.** If
  the contract permits an operator/internal-only diagnostic envelope
  alongside the public-bound envelope, an example, **clearly marked
  non-public**, demonstrating its shape and the rule that it never
  reaches a public surface.

To restate the rule: **these examples should be Dixie-owned or
explicitly cross-repo accepted.** Local recorded examples in this repo
are reconciliation inputs only; they do not promote themselves to
canonical examples through inertia.

---

## 9. Adapter compatibility questions

freeside-characters asks Dixie the following compatibility questions.
These are scoping questions that determine the shape of the future
reconciliation phase and any later live-client spike.

- **Should freeside-characters adapt live Dixie envelopes directly into
  the existing local projected DTO shape?** That is, is the local
  `RecallWedgeProjectedDto` (and the public renderer bound to it) the
  intended consumer-side narrowing target, or is a different shape
  preferred?
- **Should there be a shared package / schema later?** For example, a
  `@loa/dixie-recall-wedge-envelope` (or equivalent) shared package
  housing the canonical envelope schema and version, consumed by both
  Dixie and freeside-characters. If yes, who owns it and where does
  it live?
- **Should the adapter continue to fail closed on unknown versions?**
  The current adapter rejects unknown / future `envelope_version`
  values with `unsupported_dixie_envelope_version`. Should this
  behavior persist as the live contract evolves, or does the contract
  prefer a different unknown-version posture (e.g., explicit shim
  versions, version-range negotiation)?
- **Should `public_telegram` and `authorized_private_session` remain
  unsupported until separate DTO gates?** The current adapter rejects
  both with stable error codes. Does Dixie expect these to be enabled
  only when the multi-surface contract §5a authorized-private DTO gate
  and §8a future-renderer warning per-surface contract are
  independently satisfied — or should the live contract address them
  upstream first?
- **Should refusal / denial continue using the existing referral /
  denied public-safe path, or should Dixie define a distinct refusal
  outcome?** Today, the adapter projects refusal/unauthorized envelopes
  onto a public-safe generic-refusal DTO that reuses
  `outcome=referral` + `denied_or_refused=true` + a generic
  `safe_referral_target=authorized_session`. Is this the intended live
  shape, or should the live contract define a distinct refusal
  envelope outcome with its own consumer-side mapping?

---

## 10. Proposed reconciliation process

What happens after Dixie responds. This section is descriptive —
freeside-characters will execute these steps in a future phase, after
the contract artifact exists. None of these steps is taken by Phase
36E.

- **Compare Dixie-owned examples against local recorded probes.** Walk
  the canonical examples requested in §8 against the recorded
  fixtures under `docs/recall-wedge/fixtures/dixie-envelope/`. Identify
  every divergence at the field, type, and outcome level.
- **Update local recorded fixtures if needed.** Where the Dixie-owned
  example differs, update the local recorded fixture to match. The
  local probes do not survive divergence; Dixie-owned shape supersedes
  per readiness checkpoint §4b.
- **Update adapter tests if needed.** Where the recorded fixtures
  change, update the adapter unit tests under
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`
  to track the new shape, including any new `input_envelope_kind`
  dispatch entries, new error codes, or new outcome / refusal
  classifications.
- **Update validator if needed.** Where fixture invariants change
  (new `envelope_version`, new fixture kinds, new
  `input_envelope_kind`s, new banned-substring requirements), update
  `docs/recall-wedge/fixtures/validate-fixtures.mjs` and the runner
  regression test
  (`packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts`)
  accordingly.
- **Do not add a live client until fixtures, adapter, validator, and
  tests are reconciled.** Reconciliation against Dixie-owned shape is
  the precondition for a live client, not the consequence of one.
  Live calls do not replace the recorded proof — they ride on top of
  it.
- **Then consider Phase 37A — live Dixie client spike.** A small,
  dev/operator-gated spike that exercises the live envelope against
  the reconciled recorded-fixture baseline. Authorized only when the
  readiness checkpoint §6 preconditions hold, including the Dixie-owned
  or explicitly cross-repo-accepted contract artifact.

---

## 11. Copy-ready cross-repo request

The text below is a **copy-ready** request, formatted so it can be
lifted as-is into a Dixie-side issue, a Straylight-side spec body, or
a cross-repo handoff document. Copying this text does not authorize
live work — see the warning inside.

> **Important:** the text below is a *request*, not a contract. A
> freeside-authored request cannot satisfy the readiness checkpoint's
> §4 / §4a / §6 by itself. The authoritative response must be
> Dixie-owned or explicitly cross-repo accepted. Inertia (e.g., the
> request sitting in a shared issue tracker for several phases without
> Dixie sign-off) does not promote it into a contract. Live Dixie
> client work in freeside-characters remains blocked until a Dixie-owned
> or explicitly cross-repo-accepted contract artifact exists and the
> local recorded fixtures, adapter, validator, and tests are
> reconciled against it.

---

> **Title (suggested):** Recall Wedge — live Dixie envelope contract
> request
>
> **Summary.** freeside-characters asks the Dixie side (or, where
> applicable, the cross-repo forum that owns this surface) to provide
> or sign off on a canonical live Recall Wedge envelope contract
> covering request/response shape, versioning, auth, tenant / session
> boundary, refusal/error semantics, redaction, idempotency, and
> audit. This request is not the contract; it is an ask for one.
>
> **Why freeside-characters needs this.** freeside-characters has
> shipped a fixture-bound + recorded-envelope-bound Recall Wedge
> ladder (Phases 33A–36D). Recorded Dixie-shaped envelope fixtures
> exist under `docs/recall-wedge/fixtures/dixie-envelope/`, with a
> pure narrowing adapter at
> `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`,
> a public-safe renderer at
> `packages/persona-engine/src/recall-wedge/render-public-recall.ts`,
> and a dev/operator runner at
> `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`.
> Before any live Dixie client can land in freeside-characters, the
> live envelope contract must be defined Dixie-side or as a
> cross-repo decision.
>
> **Current local proof.** Recorded synthetic envelopes (positive +
> negative corpus) under
> `docs/recall-wedge/fixtures/dixie-envelope/`; pure adapter that
> narrows recorded envelopes to local projected DTOs and fails closed
> on unknown versions, wrong `input_envelope_kind`, missing
> `target_projection`, missing `public_recall_payload`, unknown
> outcome, missing referral fields, `authorized_private_session`
> target, `public_telegram` target, and any banned private/raw/debug
> material; deterministic public-safe renderer bound to the local
> projected DTO; fixture validator under
> `docs/recall-wedge/fixtures/validate-fixtures.mjs`; dev/operator
> runner that partitions positive renderable output from INTERNAL /
> operator-only fail-closed summaries. No live Dixie integration
> exists in this repo today.
>
> **Explicit non-authority warning.** Local recorded fixtures are
> sample v0 contract probes only. They are *not* production schema
> authority and *not* a baseline that Dixie must match. If the
> Dixie-owned contract differs, freeside-characters will update its
> fixtures, adapter, validator, and tests to match — not the other way
> around. Production Dixie traffic must not be labelled
> `recorded_dixie_recall_envelope`; that kind is reserved for
> fixture/probe input only.
>
> **Requested contract items.**
>
> - artifact owner / approver (Dixie-side or jointly cross-repo);
> - artifact location (canonical URL or repo path);
> - canonical `envelope_version` and version-selection rule;
> - change / deprecation policy (additive, breaking-with-shim, hard
>   cuts, deprecation windows, consumer notification);
> - endpoint path or RPC name and transport (HTTP/JSON, gRPC,
>   WebSocket, other);
> - HTTP / RPC transport status to envelope-outcome mapping;
> - live `input_envelope_kind` (distinct from
>   `recorded_dixie_recall_envelope`);
> - request fields (required / optional / types / encoding /
>   identifiers);
> - response fields (required / optional / types / encoding /
>   public-bound vs operator-only partition);
> - success outcome shape;
> - refusal / denial outcome shape (unauthorized / not-found /
>   partial-recall);
> - error outcome shape (rate-limited / malformed / internal);
> - service authentication model (credential type / rotation / scope /
>   missing-auth behavior);
> - end-user authorization / consent / delegation model;
> - tenant / community / session boundary and isolation guarantees;
> - `sessionId` / `messageId` and snake_case alias handling;
> - operational identifier redaction expectations (logs, audit);
> - idempotency / retry semantics (idempotency key, deduplication,
>   retry projection consistency);
> - audit / receipt expectations (request IDs, timestamps, redacted
>   summaries, challenge / revoke / forget);
> - conformance tests or contract vectors.
>
> **Requested canonical examples.** Dixie-owned (or cross-repo
> accepted) concrete envelopes for: success public-safe recall;
> refusal / denial; unsupported version error; missing / invalid
> caller authorization; tenant / session mismatch; retry / idempotency
> duplicate; redacted public-bound response; optional
> internal/operator-only diagnostic example, clearly marked non-public.
>
> **Blocked work in freeside-characters until this contract exists.**
>
> - Phase 37A live Dixie client spike (no live client, no network
>   call, no `@loa/dixie` / `@loa/straylight` dependency, no Finn
>   integration);
> - any positive `authorized_private_session` projection or renderer;
> - any `public_telegram` renderer;
> - any production storage or live memory admission;
> - any Discord interaction wiring or Telegram bot wiring of Recall
>   Wedge.
>
> **Acceptance criteria for the Dixie response.**
>
> - the response is Dixie-owned (a Dixie-repo schema doc, OpenAPI /
>   RPC artifact, or Dixie-side contract document) **or** explicitly
>   cross-repo accepted (a shared decision artifact both sides treat
>   as authoritative);
> - the artifact covers every item in the "requested contract items"
>   list above; partial coverage does not satisfy this request;
> - the artifact provides every example in the "requested canonical
>   examples" list above, with public-bound vs operator/internal-only
>   surfaces clearly partitioned;
> - the artifact addresses both service authentication and end-user
>   authorization separately, and explicitly states that service
>   authentication does not subsume end-user authorization;
> - the artifact addresses public-bound minimization at the source
>   (not "the consumer adapter will drop it");
> - the artifact addresses the operational-identifier vs memory-identity
>   distinction and states explicitly whether any session / message /
>   tenant / community / thread ID can ever act as memory identity;
> - the artifact addresses unknown-version semantics on both sides of
>   the wire.

---

## 11a. Phase 37B addendum — request answered; reconciliation done; future spike gated

> Added by Phase 37B
> (`docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`). Targeted
> addendum, not a rewrite of this document.

The cross-repo request authored here has been answered:

- **Dixie Phase 32E** published the governing route contract for
  `POST /api/recall/intake` at
  `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`.
- **Dixie Phase 32F** published the cross-repo readiness checkpoint
  over Phase 32E at
  `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`,
  unblocking downstream freeside-characters reconciliation only.
- **freeside-characters Phase 37A** reconciled the local recorded
  Dixie envelope fixtures and the local pure adapter against Phase
  32E / 32F. See
  `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md`.
- **freeside-characters Phase 37B** authorizes a future Phase 37C
  operator/dev-only live Dixie client spike against
  `POST /api/recall/intake`, subject to the constraints in
  `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`. Phase 37B does
  not itself add live code, and does not authorize Discord /
  Telegram wiring, public renderer expansion, storage / admission,
  positive `public_telegram` / `authorized_private_session`
  support, or character-voiced recall output.

This handoff document remains a request artifact. Phase 32E / 32F
are the authoritative contract evidence; Phase 37A is the local
reconciliation; Phase 37B is the gate for the future operator/dev
spike. Read §12 below in that light.

---

## 12. Recommended next phase

- **Preferred: Phase 37A — live Dixie client spike, only after a
  Dixie-owned or explicitly cross-repo-accepted contract exists and
  the local recorded fixtures, adapter, validator, and tests are
  reconciled against it.** A small, dev/operator-gated spike
  exercising the live envelope against the reconciled recorded-
  fixture baseline. Authorized only when the readiness checkpoint
  §6 preconditions hold — notably the §4 Dixie-owned or
  cross-repo-accepted artifact. Not authorized by Phase 36E.
- **If no Dixie-side response exists, stay pre-live.** The
  recorded-envelope-bound Recall Wedge ladder may continue to extend
  inside its existing boundaries — additional recorded fixture
  shapes, adapter / validator hardening, runner formatting
  refinements — but **do not implement a live client.** A
  freeside-authored draft, request, or handoff (including this
  document) does not promote itself into the live contract through
  inertia.

---

## 13. Non-goals

Explicitly rejected by Phase 36E. None of the following are authorized
here; if a later phase needs any, re-open the boundary doc, the
live-boundary decision, and the readiness checkpoint first.

- **implementing live Dixie** (no live client, no network call, no
  `@loa/dixie` / `@loa/straylight` dependency, no Finn integration);
- **opening an issue automatically** (Phase 36E does not open a
  Dixie-side issue or any cross-repo issue; the §11 copy-ready text is
  a *draft*, not an opened ticket);
- **claiming this handoff is the contract** (a freeside-authored
  request cannot satisfy the readiness checkpoint's §4 / §4a / §6 by
  itself; the contract must be Dixie-owned or explicitly cross-repo
  accepted);
- **treating recorded fixtures as schema authority** (recorded
  `dixie-envelope/` fixtures are sample v0 contract probes only; they
  are reconciliation inputs, not a baseline Dixie must match);
- **production storage** (no Postgres, no object store, no vector
  index, no Redis behind any Recall Wedge path);
- **live memory admission** (no admission as a side effect of any
  surface, runner, or live Dixie call; admission is post-MVP per
  live-boundary decision §6 and post-MVP decision map §7);
- **Discord command wiring of Recall Wedge** (no recall slash
  command, no recall interaction handler, no recall Pattern B
  webhook delivery; the substrate's existing `/ruggy` and `/satoshi`
  persona invocations are unaffected and unrelated);
- **Telegram bot wiring of Recall Wedge** (no Telegram bot wiring,
  no Telegram identity binding, no Telegram renderer);
- **`authorized_private_session` renderer** (gated on multi-surface
  contract §5a authorized-private DTO gate);
- **`public_telegram` renderer** (gated on multi-surface contract
  §8a future-renderer warning);
- **character voice on recall output** (recall billboards remain
  voiceless per boundary doc §12 voice posture and post-MVP decision
  map §3 Option F);
- **production auth / consent solved** (this phase does not claim or
  authorize identity binding, consent capture, signer authority, or
  cross-user access);
- **session IDs as memory identity** (`sessionId` / `messageId`,
  snake_case `session_id` / `message_id`, tenant / community IDs,
  thread IDs, and any aliases are operational / session identifiers —
  not memory identifiers — per multi-surface contract §5 and
  readiness checkpoint §4f).

---

## 14. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates.
- `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` — Phase 35C
  multi-surface contract; surface taxonomy (§4); authorized-private
  session contract (§5); authorized-private DTO gate (§5a); Discord
  public contract (§6); Telegram contract (§7); Telegram-specific
  authorization gates (§7e); surface-specific output rules (§8);
  future-renderer warning (§8a); Dixie / Recall Wedge envelope
  relationship (§9); Dixie adapter requirements (§9a); memory
  admission boundary (§10).
- `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` — Phase 36A
  live-boundary decision; recorded-fixtures-not-schema-authority
  (§7a); live-Dixie precondition gate (§7).
- `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` — Phase 36D
  readiness checkpoint; required Dixie-side / cross-repo artifact
  (§4); contract artifact acceptance criteria (§4a); Dixie-owned
  examples supersede local recorded fixtures (§4b); live
  `input_envelope_kind` requirement (§4c); public-bound live response
  rule (§4d); service authentication vs end-user authorization (§4e);
  operational identifiers are not memory identity (§4f); required
  live-Dixie preconditions (§6); cross-repo handoff draft (§8).
- `docs/recall-wedge/fixtures/README.md` — fixture set, including
  Phase 35D + Phase 36B `dixie-envelope/` fixtures.
- `docs/recall-wedge/fixtures/validate-fixtures.mjs` — Phase 33B /
  35D / 36B fixture validator.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts` —
  Phase 33C public-safe renderer.
- `packages/persona-engine/src/recall-wedge/demo-cross-interface.ts` —
  Phase 33D fixture-bound cross-interface continuity demo.
- `packages/persona-engine/src/recall-wedge/run-demo.ts` — Phase 35B
  explicit dev/operator demo runner.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts` —
  Phase 35D pure Dixie envelope adapter.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts` —
  Phase 35D / 36B adapter regression gate.
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts` —
  Phase 36C dev/operator runner over recorded Dixie envelopes.
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts` —
  Phase 36C runner regression gate.
