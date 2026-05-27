# Recall Wedge — live Dixie readiness / cross-repo contract checkpoint

> **Phase 36D** (docs-only). Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract), and
> `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A live-boundary
> decision).
>
> This document is a **checkpoint**, not implementation. It records what
> must exist on the Dixie side, or as a cross-repo decision, before
> freeside-characters can add a live Dixie client or treat the recorded
> Dixie envelope fixtures under `docs/recall-wedge/fixtures/dixie-envelope/`
> as anything more than sample v0 contract probes.
>
> No code, package, lockfile, Discord wiring, Telegram wiring, live
> Dixie / Straylight / Finn integration, production storage, live memory
> admission, `authorized_private_session` projection or renderer,
> `public_telegram` renderer, LLM/voice rewrite, or character voice
> changes are introduced here.
>
> **This phase does not authorize live Dixie implementation.** It defines
> the artifacts and decisions required *before* any live client work
> can begin. If a later phase reaches for anything currently gated,
> deferred, or rejected here, re-open the boundary doc and the
> live-boundary decision — do not silently expand scope from this
> checkpoint.

---

## 1. Status after Phase 36C

The fixture-bound + recorded-envelope-bound Recall Wedge ladder is
merged through:

- **Phase 33A** — boundary decision doc
  (`docs/RECALL-WEDGE-MEMORY-MVP.md`).
- **Phase 33B** — reviewed seed memory packet + projected DTO fixtures
  (operator-private, public-discord, character-boundary-referral) +
  no-leak fixture validator
  (`docs/recall-wedge/fixtures/`,
  `docs/recall-wedge/fixtures/validate-fixtures.mjs`).
- **Phase 33C** — deterministic public-safe Recall Wedge renderer with
  fail-closed input scan and rendered-output leak guard
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`).
- **Phase 33D** — fixture-bound cross-interface continuity demo binding
  the four MVP proof properties
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`).
- **Phase 34A** — final MVP acceptance handoff
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
- **Phase 36B** — expanded recorded Dixie envelope corpus +
  adapter / validator tests (refusal-unauthorized, session-bearing,
  authorized-private negative target, public-telegram negative target,
  malformed-missing-payload, malformed-missing-target).
- **Phase 36C** — dev/operator runner over the recorded Dixie envelope
  fixture corpus
  (`packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`,
  `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.test.ts`).

### Current proof, summarized

- **Recorded Dixie envelope corpus exists** under
  `docs/recall-wedge/fixtures/dixie-envelope/` — synthetic, explicitly
  versioned (`recall_wedge.dixie_envelope.v0`), each carrying a
  `non_production_authorization_note`. The corpus covers public-safe,
  referral/downgrade, session-bearing, refusal/unauthorized,
  authorized-private negative target, public-telegram negative target,
  malformed-missing-payload, malformed-missing-target, and
  unknown-version shapes.
- **The fixture validator requires a positive/negative corpus.**
  `docs/recall-wedge/fixtures/validate-fixtures.mjs` enforces fixture
  invariants — `synthetic`, `fixture_kind`, `input_envelope_kind`,
  supported / intentionally-unsupported `envelope_version`,
  `non_production_authorization_note` — across the recorded fixture
  set.
- **The pure adapter narrows envelopes to local projected DTOs.**
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  is synchronous, in-memory, no network, no Discord/Telegram/Dixie/
  Finn/Straylight/storage/LLM imports. It is the only narrowing
  boundary from a Dixie-shaped envelope to a Recall Wedge projected
  DTO.
- **The public-safe renderer renders positive public fixtures.** Phase
  33C `renderPublicRecallProjection` consumes only the local projected
  DTO; the public renderer never reads a raw Dixie envelope.
- **Negative fixtures fail closed.** Unknown version, wrong
  `input_envelope_kind`, missing `target_projection`, missing
  `public_recall_payload`, unknown outcome, missing referral fields,
  authorized-private target, public-telegram target, and any banned
  private/raw/debug material in source fields or reconstructed
  projection all map to stable adapter or renderer error codes — never
  to a public render.
- **The runner formats public output separately from INTERNAL /
  operator-only fail-closed summaries.** Phase 36C
  `run-dixie-envelope-demo.ts` clearly partitions positive renderable
  fixtures (public rendered output) from negative fail-closed fixtures
  (adapter error class + stable error code, surfaced only under the
  INTERNAL / operator-only proof section).
- **No live Dixie exists.** No live Dixie client, no network call, no
  Dixie SDK dependency, no `@loa/dixie` / `@loa/straylight` / Finn
  integration, no production storage, no live memory admission.

---

## 2. The problem

The current blocker for moving past the recorded-envelope-bound proof
is contract authority.

- **freeside-characters has recorded Dixie-shaped envelope probes.**
  The `dixie-envelope/` fixtures are synthetic JSON checked into
  *this* repo. They were authored to exercise the adapter's narrowing
  boundary, fail-closed paths, refusal/downgrade shapes, public no-leak
  invariants, and to drive the Phase 36C operator runner.
- **These are not production schema authority.** The recorded fixtures
  are sample v0 contract probes. They do not define what a live Dixie
  endpoint actually returns, what fields are required vs optional,
  what versioning policy Dixie commits to, what auth/caller model
  applies, or what tenant/session boundaries hold across Dixie users.
- **Live Dixie truth must come from the Dixie side or a cross-repo
  decision.** Envelope-shape authority belongs on the Dixie side —
  via a Dixie-repo schema doc, an OpenAPI / RPC artifact, or an
  explicit cross-repo decision recording who owns the live envelope
  contract. Memory authority belongs to Straylight. freeside-characters
  owns surface frame, public-safe renderer, projected DTO, and the
  narrowing adapter — not the wire contract.
- **Adding a live Dixie client before that contract exists would make
  freeside-characters invent the contract.** Whatever envelope shape
  the live client assumes would, by inertia, become the contract Dixie
  is held to — exactly the inversion called out in the live-boundary
  decision §7a (recorded fixtures are examples, not schema authority).
  Once a freeside-characters live client ships against a guessed
  envelope, every Dixie change becomes a freeside-characters break,
  and the cross-repo ownership question is silently answered the
  wrong way.

---

## 3. Decision

This phase records the following decision in writing.

- **Do not add a live Dixie client yet.** No network-touching Dixie
  code, no `@loa/dixie` dependency, no `@loa/straylight` dependency,
  no Finn integration, no live envelope fetch path, in any phase
  preceding the live-Dixie precondition gate (§6).
- **The next live-Dixie-related work must first obtain a Dixie-owned
  or explicitly cross-repo-accepted envelope contract.** That contract
  is the precondition; live client work is not. Implementation phases
  may not skip ahead. freeside-characters may *draft* a request or
  handoff document asking for that contract — but a freeside-authored
  draft is **not** the live contract, and a freeside-authored draft
  alone is **not** sufficient to authorize a live client. The
  authoritative response must be Dixie-owned (a Dixie-repo schema /
  OpenAPI / RPC artifact, or a Dixie-side contract document) or
  explicitly accepted/signed off cross-repo (e.g. a shared decision
  artifact both sides treat as authoritative). Inertia does not
  promote a freeside draft into a contract.
- **freeside-characters may continue fixture-bound work, but it must
  not treat local recorded fixtures as canonical production schema.**
  Adding more recorded fixtures, version variants, adapter dispatch
  entries, validator rules, or runner output does not promote any
  shape to "the live contract." Promotion requires the §4 Dixie-side
  artifact / cross-repo-accepted decision. Local recorded fixtures are
  reconciliation inputs and sample probes — not a baseline that Dixie
  must match.

The decision here is conservative on purpose. The Recall Wedge ladder
has reached a point where the next step is either (a) extending the
local proof along a dimension the adapter already understands, or (b)
crossing the cross-repo boundary to a producer the adapter does not
own. (b) requires a contract document that does not yet exist.

---

## 4. Required Dixie-side / cross-repo artifact

Before any live Dixie client work in freeside-characters, the
following must be defined and owned outside this repo — either in a
Dixie-side artifact (schema doc, OpenAPI/RPC artifact, repo-level
contract document) or as an explicit cross-repo-accepted decision.

A freeside-authored request, handoff doc, or draft (such as the §8
text below) is **not** itself the live contract. freeside-characters
can own local adapter compatibility docs and request drafts; the
canonical live Dixie envelope schema must be Dixie-owned or
explicitly cross-repo accepted. A shared cross-repo location is
acceptable **only** if both sides treat the artifact at that location
as authoritative — co-location is not the same as authority.

- **Endpoint or RPC shape.** Concrete path or RPC name, transport
  (HTTP/JSON, gRPC, WebSocket, etc.), method, content type, and any
  required headers.
- **Envelope versioning.** A canonical `envelope_version` string,
  semantics of `v0` → `v1` transitions (additive only,
  breaking-with-shim, hard cut), and the rule for unknown future
  versions on the consumer side.
- **Request envelope fields.** Exact required and optional fields, types,
  encoding, and any caller/tenant/session identifiers carried on
  request.
- **Response envelope fields.** Exact required and optional fields,
  types, encoding, and the partition of public-bound vs
  operator/internal-only fields. Public-bound fields must be
  enumerable and named.
- **Success / refusal / error outcomes.** Distinct outcome shapes for
  successful recall, referral/downgrade, refusal (e.g. unauthorized,
  not-found, partial-recall), and operational error
  (rate-limited, malformed, internal). Each outcome carries a stable
  classification a consumer adapter can map without raw-body bleed.
- **Auth / caller model.** How the consumer authenticates to Dixie,
  the caller identity Dixie sees, the rule for representing the
  freeside-characters substrate's continuity actor without leaking
  internal identifiers (multi-surface contract §9 allowlist), and
  what happens when auth is missing or insufficient.
- **Tenant / community / session boundary.** Which tenant or
  community owns a session, whether tenants are isolated at the
  envelope layer, how cross-tenant requests are refused, and whether
  Dixie performs tenant routing or whether the caller declares a
  tenant.
- **`sessionId` / `messageId` semantics.** Lifetime, scope, rotation
  policy, the rule that they are operational identifiers and not
  memory identifiers (multi-surface contract §5), and the rule that
  they never appear on a public surface.
- **Idempotency / retry semantics.** Whether a Recall Wedge call is
  safe to retry, how duplicate calls are deduplicated, whether retries
  may produce different projections for the same logical request, and
  whether the caller is expected to carry an idempotency key.
- **Operational logging / redaction expectations.** What logging
  (Dixie-side and consumer-side) is expected, what must be redacted
  before logging, and the rule that operational logs never carry raw
  hidden / private / debug / source material.
- **No raw hidden / private / debug / source material in public-bound
  responses.** A guarantee in writing — and ideally enforced
  Dixie-side — that public-bound response fields cannot carry raw
  reasons, debug payloads, hidden estate material, private assertion
  IDs, source material, actor identifiers, raw chat-log contents, or
  raw operator diagnostic payloads. The freeside-characters adapter
  enforces a no-leak scan; Dixie must not rely on it as the only
  defense.
- **Audit / receipt expectations.** What audit evidence (request IDs,
  timestamps, redacted summaries) is recorded, where it lives, who
  can challenge / revoke / forget, and the rule that audit records
  never carry raw Dixie material.
- **Compatibility expectations with the Recall Wedge projected DTO
  adapter.** A statement of which response-envelope fields map to
  which projected-DTO fields (and which are dropped at the narrowing
  boundary by design), so that the live envelope and the local DTO
  remain reconcilable as Dixie evolves.

Until the items above exist in writing on the Dixie side or as a
cross-repo-accepted decision, the live envelope contract does not
exist — regardless of what happens to be checked into
`docs/recall-wedge/fixtures/dixie-envelope/` in this repo.

### 4a. Contract artifact acceptance criteria

A live Dixie contract artifact is acceptable for the purposes of §6
only if it explicitly defines, in writing, all of the following. This
list is the bar; partial coverage does not promote a draft to a
contract.

- **Artifact owner / approver.** Named Dixie-side owner (or
  cross-repo signer) who approves changes to the contract. A
  freeside-characters author cannot self-approve; the owner must be
  Dixie-side or jointly named cross-repo.
- **Artifact location.** Canonical URL or repo path where the
  artifact lives. If the location is shared cross-repo, both sides
  must declare it authoritative.
- **Version string.** Canonical `envelope_version` identifier and
  the rule for selecting it on a live request/response.
- **Change / deprecation policy.** Rules for additive changes,
  breaking-with-shim transitions, hard cuts, deprecation windows,
  and how consumers are notified.
- **Canonical request fields.** Required and optional fields, types,
  encoding, and any caller / tenant / session / idempotency
  identifiers carried on request.
- **Canonical response fields.** Required and optional fields,
  types, encoding, and the partition of public-bound vs
  operator/internal-only fields. Public-bound fields must be named
  and enumerable.
- **Canonical success / refusal / error examples.** Concrete sample
  envelopes (success, referral/downgrade, refusal — including
  unauthorized / not-found / partial-recall — and operational error
  — including rate-limited / malformed / internal). Examples must be
  Dixie-owned or cross-repo accepted (see §4b).
- **Live `input_envelope_kind`.** The canonical
  `input_envelope_kind` value(s) used on live traffic, distinct from
  any recorded/probe fixture kind (see §4c).
- **Transport status vs envelope outcome mapping.** Explicit mapping
  from transport-level status (HTTP status, gRPC status, etc.) to
  envelope-level outcome (success / refusal / error class), so a
  consumer adapter never has to infer outcome from status alone or
  vice versa.
- **Service authentication model.** How freeside-characters (the
  *service*) authenticates *to Dixie* — credential type, rotation,
  scope, and behavior on missing/insufficient service auth. This is
  distinct from end-user authorization (see §4e).
- **End-user authorization / consent / delegation model.** How the
  end user / caller's authorization to receive recall is
  established, represented on the wire, and enforced. Includes
  consent capture, delegation (if any), and revocation semantics.
  Service authentication does **not** subsume this; both must be
  represented separately.
- **Tenant / community / session boundary.** Which tenant, community,
  or session a request is bound to; isolation guarantees at the
  envelope layer; cross-tenant refusal behavior; whether Dixie or
  the caller declares the tenant.
- **`sessionId` / `messageId` and snake_case alias handling.**
  Canonical form (camelCase or snake_case), permitted aliases
  (`session_id` / `message_id`, and any tenant/community/thread ID
  aliases), and the rule that they are operational identifiers and
  not memory identifiers (see §4f).
- **Redaction / public-bound response rules.** Written guarantee
  that public-bound response fields cannot carry raw private /
  hidden / debug / source / operator material, plus the upstream
  minimization rule (see §4d).
- **Idempotency / retry semantics.** Whether a Recall Wedge call is
  safe to retry, deduplication policy, whether retries may produce
  different projections for the same logical request, and whether
  the caller is expected to carry an idempotency key.
- **Audit / receipt semantics.** What audit evidence (request IDs,
  timestamps, redacted summaries) is recorded, where it lives, who
  can challenge / revoke / forget, and the rule that audit records
  never carry raw Dixie material.
- **Conformance tests or contract vectors.** A set of Dixie-owned
  (or cross-repo accepted) contract vectors / conformance tests
  that a consumer adapter can run against to prove compatibility
  beyond "the local adapter still passes its local fixtures."

If any item above is missing from the artifact, it does not satisfy
§6. Local recorded fixtures and adapter test pass-rate are **not**
substitutes for any of the items above.

### 4b. Dixie-owned examples supersede local recorded fixtures

Local recorded fixtures under
`docs/recall-wedge/fixtures/dixie-envelope/` are reconciliation
inputs and sample probes — they are **not** a schema baseline that
Dixie must match. If Dixie-owned canonical examples (per §4 /
§4a) differ from the local v0 probes, the divergence is resolved
in Dixie's favor:

- Dixie-side contract truth supersedes local probes.
- The future reconciliation phase (post-§4 artifact) updates
  freeside-characters fixtures, adapter dispatch, validator rules,
  and tests to match the Dixie-owned contract — not the other way
  around.
- A freeside-characters reviewer must not reject a Dixie-owned
  contract on the grounds that "our local fixtures don't match."
  The local fixtures change.

### 4c. Live `input_envelope_kind` requirement

The recorded fixture corpus uses
`input_envelope_kind = recorded_dixie_recall_envelope`. That kind is
a fixture/probe marker — it identifies the input as a recorded
synthetic probe, not as live Dixie traffic.

- A live Dixie path **must** define a distinct live
  `input_envelope_kind` (e.g., `live_dixie_recall_envelope`, name
  to be decided by the §4 contract), or **must** explicitly document
  on the wire how live traffic is distinguished from recorded
  probes.
- Production traffic **must not** be labelled
  `recorded_dixie_recall_envelope` merely to satisfy the current
  freeside-characters adapter dispatch
  (`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`).
- The adapter's existing dispatch on
  `recorded_dixie_recall_envelope` is for fixture/probe input only.
  Adding a live kind requires the §4 artifact and a distinct
  adapter dispatch entry — not silent reuse of the recorded kind.

### 4d. Public-bound live response rule

Public-bound live Dixie responses must minimize at the source — not
merely be sanitized at the consumer adapter:

- Public-bound live Dixie response envelopes should not carry raw,
  private, hidden, debug, operator, or source-material fields **at
  all** where avoidable. The default for any field that is not
  explicitly designated public-bound is to omit it from the
  public-bound response, not include-and-rely-on-downstream-drop.
- The freeside-characters adapter
  (`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`)
  remains the narrowing boundary — and the
  `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` no-leak scan in
  `render-public-recall.ts` remains the renderer's fail-closed
  defense — but neither is an excuse for upstream public-bound
  responses to carry unnecessary raw / internal / operator fields.
- "The adapter will drop it" is **not** an acceptable reason for
  Dixie to include private / debug / operator material on a
  public-bound envelope. Defense in depth assumes upstream is
  already minimized.

### 4e. Service authentication vs end-user authorization

These are two contracts, not one. The §4 / §4a artifact must
represent each separately:

- **Service authentication to Dixie** proves only that
  freeside-characters (the substrate / service) is permitted to
  call Dixie. It identifies the *caller service*, not the *end
  user*. A successful service authentication does **not** authorize
  any particular recall.
- **End-user / caller authorization, consent, and delegation** is
  a distinct contract. It establishes whether the end user (or
  delegated caller) is authorized to receive a given recall, what
  consent was captured, what scope applies, and how revocation
  propagates.
- A live client can be technically service-authenticated to Dixie
  and still be **privacy-invalid** for a given recall request. The
  §4 contract must make the difference explicit and must specify
  refusal behavior when service auth is present but end-user
  authorization / consent is missing or insufficient.

### 4f. Operational identifiers are not memory identity

Operational identifiers — including but not limited to:

- `sessionId` / `messageId`,
- snake_case aliases `session_id` / `message_id`,
- tenant IDs / community IDs,
- thread IDs,
- any other transport-level or routing-level alias

— are operational/session identifiers, **not** memory identity.
Their presence on a request or response:

- does **not** authorize recall (auth is §4e);
- does **not** identify a memory, an assertion, a continuity actor,
  or any Straylight-side memory entity;
- **must not** leak into public output, regardless of which
  spelling or alias is used.

The §4 contract must enumerate the canonical form, the permitted
aliases, and the redaction rule. The freeside-characters adapter
and renderer must reject leakage of any spelling / alias.

---

## 5. What freeside-characters owns vs does not own

This boundary is restated here because the inertia risk is real:
recorded fixtures that survive several phases can quietly come to be
treated as if they were the production schema, and this repo can
quietly come to be treated as if it owned the contract. It does not.

### freeside-characters owns

- **Discord / persona / public surface constraints.** The substrate's
  public-facing rules — explicit invocation only, no ambient/passive
  recall, public-safe output allowlist, anti-spam invariants — are
  this repo's responsibility.
- **Local projected DTO fixtures.** The
  `docs/recall-wedge/fixtures/projected-dto/` shapes are owned here
  because they describe what the public renderer is allowed to
  consume.
- **Public-safe renderer.** Phase 33C
  `renderPublicRecallProjection` (with its
  `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` no-leak scan and fail-closed
  contract) is owned here.
- **Adapter from Dixie-safe envelope to local projected DTO.** Phase
  35D `dixie-envelope-adapter.ts` is owned here. The adapter's job is
  to *narrow* a Dixie-shaped envelope to a local projected DTO; it
  does not define the Dixie envelope.
- **Recorded contract probes.** The recorded fixtures under
  `docs/recall-wedge/fixtures/dixie-envelope/` are owned here as
  *probes* — synthetic samples used to exercise the adapter, the
  validator, the public renderer through the adapter, and the
  operator runner.
- **Dev / operator runners.** Phase 35B `run-demo.ts` and Phase 36C
  `run-dixie-envelope-demo.ts` are owned here as dev/operator-gated
  proof surfaces, not as production endpoints.

### freeside-characters does not own

- **Canonical Dixie live envelope schema.** The wire-level
  envelope contract — what fields a live Dixie response carries, in
  what types, with what versioning policy — is owned by Dixie or by
  a cross-repo decision. Not by this repo.
- **Production Straylight memory semantics.** What counts as a
  memory, how memories are stored, indexed, retrieved, and decayed
  is owned by Straylight. Recall Wedge in this repo is a read-side
  *frame*, not a memory authority.
- **Admission authority.** Who is authorized to admit an assertion,
  what counts as consent, how revocation propagates — all owned
  outside this repo per the multi-surface contract §10 memory
  admission boundary.
- **Production storage.** Postgres / object storage / vector index /
  Redis / any backing store is owned by the production substrate,
  not freeside-characters. The runner and adapter operate in-memory
  by design.
- **Finn runtime / session execution.** Finn session lifecycles,
  routing, and execution semantics are owned by Finn. The Dixie
  envelope is the consumer-facing artifact; Finn internals are not
  this repo's concern.
- **Production auth / consent.** Identity binding (Discord ↔ Dixie ↔
  Telegram ↔ Loa-side authorized identity), consent capture, signer
  / admission authority, and challenge/revoke/forget are owned
  outside this repo.

If a future phase finds itself defining anything in the "does not
own" list, that phase has crossed a repo boundary it should not be
crossing alone — re-open the boundary doc.

---

## 6. Required live-Dixie preconditions

Before a live Dixie client can land in freeside-characters, every
item below must hold. These are not soft preferences; they are the
gate.

- **A Dixie-side artifact or cross-repo decision exists.** Per §4
  above. The artifact must enumerate endpoint shape, request/response
  envelope fields, success/refusal/error outcomes, auth/caller
  model, tenant/session boundary, sessionId/messageId semantics,
  idempotency/retry semantics, operational logging/redaction
  expectations, no-raw-private guarantees, audit/receipt expectations,
  and adapter compatibility expectations.
- **Envelope version is known.** A canonical `envelope_version`
  string identifies the live contract, and the freeside-characters
  adapter dispatches on it explicitly.
- **Unknown versions fail closed.** The adapter rejects unknown future
  `envelope_version` values with the existing
  `unsupported_dixie_envelope_version` error code; no fallback
  parsing, no inference from neighbouring fields.
- **Auth / caller assumptions are explicit.** The live client's
  authentication mode, identity representation to Dixie, and behavior
  on missing/insufficient auth are written down. No inferring
  identity from `sessionId` / `messageId`.
- **Tenant / session boundary is explicit.** Which tenant or
  community a request is bound to, how cross-tenant requests are
  refused, and how the boundary is represented on the wire are
  written down.
- **Raw Dixie response never reaches the public renderer.** The
  Phase 35D narrowing-boundary invariant carries forward: only the
  adapter reads the envelope; the public renderer reads only the
  local projected DTO.
- **Adapter remains the narrowing boundary.** No code path reads the
  envelope outside the adapter — not the renderer, not the runner,
  not a surface frame, not a command handler, not a logger.
- **Local fallback / refusal behavior is specified.** What happens
  when Dixie is unreachable, partially responding, or returning a
  malformed envelope. Default must be refusal/downgrade, not a
  synthesized fallback that a user could mistake for memory.
- **Tests exist using recorded fixtures before live calls.** The
  recorded fixture corpus must continue to drive adapter and
  renderer regressions, including any new shapes the live contract
  introduces. Live calls do not replace the recorded proof — they
  ride on top of it.
- **No memory admission side effects.** No live Dixie call may write
  to candidate or admitted memory. Recall is read-only; admission is
  post-MVP and out of scope here.

If any precondition is missing, the live client does not land. Work
remains pre-live and recorded-envelope-bound.

---

## 7. What not to do

This section restates the lines this checkpoint does not let later
phases cross without re-opening the boundary doc and the live-boundary
decision.

- **No live Dixie client in this PR or in any phase preceding the §6
  preconditions.**
- **No treating recorded fixtures as production schema.** The
  recorded `dixie-envelope/` fixtures are sample v0 contract probes,
  per live-boundary decision §7a. They must not be cited in code
  comments, commit messages, or user-facing copy as "the Dixie
  envelope schema."
- **No inferring auth model from operational identifiers.** Including
  `sessionId` / `messageId`, snake_case `session_id` / `message_id`,
  tenant / community IDs, thread IDs, and any aliases. These are
  operational/session identifiers. The service authentication model
  (§4e) and end-user authorization / consent / delegation model
  (§4e) are explicit contract items — not something to be
  reverse-engineered from field names. Their presence on a request
  does not authorize a recall.
- **No treating operational identifiers as memory identity.**
  Including `sessionId` / `messageId`, snake_case `session_id` /
  `message_id`, tenant / community IDs, thread IDs, and any aliases.
  These are operational/session identifiers. Memory identity
  (continuity actor, assertion identity, Straylight-side memory
  entity) is not the same surface, and the multi-surface contract §5
  plus this checkpoint's §4f prohibit the conflation. Operational
  identifiers must not leak into public output regardless of which
  spelling or alias is used.
- **No letting raw Dixie responses reach the public renderer.** The
  adapter is the only narrowing boundary; the renderer reads only
  the local projected DTO.
- **No adding Discord or Telegram surface at the same time as a live
  Dixie client.** Each is its own gate. Bundling them inverts the
  proof order — the surface ships before the envelope contract is
  exercised end-to-end.
- **No adding storage or admission at the same time as a live Dixie
  client.** Storage availability does not imply admission permission;
  admission is the load-bearing decision and is post-MVP per
  live-boundary decision §6 and post-MVP decision map §7.
- **No `authorized_private_session` renderer.** Gated on
  multi-surface contract §5a authorized-private DTO gate.
- **No `public_telegram` renderer.** Gated on multi-surface contract
  §8a future-renderer warning.
- **No character voice on recall output.** Recall billboards remain
  voiceless per boundary doc §12 voice posture and post-MVP decision
  map §3 Option F.

---

## 8. Cross-repo handoff draft

The text below is a **draft request** — a freeside-authored ask for
the Dixie side to produce or sign off on a contract. It is intended
to be copied later into a Dixie-side issue or cross-repo handoff
document. It is not an issue, and no issue is opened by this phase.
Edit freely before use; the structure below is the minimum
information freeside-characters needs from the Dixie side or as a
cross-repo-accepted decision before a live Recall Wedge client can
land.

> **Important:** this draft is a *request*, not a contract. A
> freeside-authored draft cannot satisfy §4 / §4a / §6 by itself.
> The authoritative response must be Dixie-owned or explicitly
> cross-repo accepted. Inertia (e.g., a draft sitting in a shared
> repo for several phases without Dixie sign-off) does not promote
> the draft into a contract.

---

> **Title (draft):** Recall Wedge — live Dixie envelope contract
> request
>
> **Context.** freeside-characters has shipped a fixture-bound +
> recorded-envelope-bound Recall Wedge ladder
> (Phases 33A–36C). Recorded Dixie-shaped envelope fixtures exist
> under `docs/recall-wedge/fixtures/dixie-envelope/`, with a pure
> narrowing adapter at
> `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`,
> a public-safe renderer at
> `packages/persona-engine/src/recall-wedge/render-public-recall.ts`,
> and a dev/operator runner at
> `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`.
> The recorded fixtures are sample v0 contract probes, not production
> schema. Before a live Dixie client can land in
> freeside-characters, the contract below must be defined Dixie-side
> or as a cross-repo decision.
>
> **Asks.**
>
> - **Live Recall Wedge / Dixie envelope contract.** Single
>   document or artifact identifying the canonical request/response
>   envelope shape used by Dixie for Recall Wedge calls.
> - **Version string.** Canonical `envelope_version` identifier and
>   versioning policy (v0 → v1 transitions, breaking-with-shim
>   policy, unknown-version semantics).
> - **Endpoint path or RPC name.** Concrete transport, method, path
>   or RPC name, content type, required headers.
> - **Request fields.** Required and optional fields, types,
>   encoding, including any caller / tenant / session identifiers.
> - **Response fields.** Required and optional fields, types,
>   encoding. Public-bound fields must be enumerated separately
>   from operator-only / internal-only fields.
> - **Refusal / error fields.** How refusals (unauthorized,
>   not-found, partial-recall, rate-limited, malformed, internal)
>   are represented, and how each maps to a stable consumer-side
>   classification with no raw-body bleed.
> - **Auth / caller semantics.** How the consumer authenticates,
>   the caller identity Dixie sees, behavior on missing/insufficient
>   auth, and the rule for representing freeside-characters'
>   continuity actor without leaking internal identifiers.
> - **Tenant / session semantics.** Tenant ownership of a session,
>   tenant isolation at the envelope layer, cross-tenant refusal
>   behavior, and whether Dixie or the caller declares the tenant.
> - **Sample success / refusal / error envelopes.** Dixie-owned (or
>   cross-repo accepted) concrete JSON (or equivalent encoding)
>   examples. The future reconciliation phase compares these
>   Dixie-owned examples to the recorded fixtures under
>   `docs/recall-wedge/fixtures/dixie-envelope/` and updates the
>   local probes if needed — Dixie-owned examples supersede local
>   probes per §4b. Local probes are reconciliation inputs, not a
>   baseline Dixie must match.
> - **Redaction / no-raw-private-material guarantees.** Written
>   guarantee that public-bound response fields do not carry raw
>   reasons, debug payloads, hidden estate material, private
>   assertion IDs, source material, actor identifiers, raw chat-log
>   contents, or raw operator diagnostic payloads.
> - **Idempotency / retry semantics.** Whether a Recall Wedge call
>   is safe to retry, how duplicates are deduplicated, whether
>   retries can produce different projections for the same logical
>   request, and whether the caller is expected to carry an
>   idempotency key.
> - **Audit / receipt semantics.** What audit evidence is recorded,
>   where it lives, who can challenge / revoke / forget, and the
>   rule that audit records do not carry raw Dixie material.
>
> **Out of scope for this ask.** Production storage, live memory
> admission, identity binding solved, `authorized_private_session`
> renderer, `public_telegram` renderer, character voice — these
> remain post-MVP per the freeside-characters Recall Wedge ladder.

---

The draft above is the minimum content for a future Dixie-side
issue or cross-repo handoff document. **No issue is opened by this
phase.**

---

## 8a. Phase 37B addendum — Phase 37A became reconciliation; Phase 37B is the operator/dev-only spike gate

> Added by Phase 37B
> (`docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`). Targeted
> addendum, not a rewrite of this section. Updates the meaning of
> "Phase 37A" referenced in §9 below.

Status update for the live-Dixie readiness ladder:

- **Phase 37A became reconciliation, not a live client spike.** See
  `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md`. The "Phase
  37A — live Dixie client spike" alternative described in §9 below
  did not happen; instead, Phase 37A consumed Dixie Phase 32E
  (`../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`)
  and Dixie Phase 32F
  (`../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`)
  as external contract evidence and reconciled the local recorded
  Dixie envelope fixtures and the local pure adapter against that
  evidence.
- **Phase 37B is the gate for a future Phase 37C operator/dev-only
  live Dixie client spike.** See
  `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`. Phase 37B does not
  itself add live code; it defines what the next code phase is
  permitted to do, route-bound to `POST /api/recall/intake`,
  isolated from the recorded fixture adapter, and operator/dev-only.
- **All public surface, Telegram, `authorized_private_session`,
  `public_telegram`, storage / admission, Finn audit wiring, and
  character voice work remains blocked.** Each remains gated on its
  own decision artifact (multi-surface contract §5a / §8a / §10;
  this checkpoint §6 / §10; post-MVP decision map §6 / §7). Phase
  37B does not relax any of those gates.

When reading §9 below, treat "Phase 37A — live Dixie client spike"
as a planning sketch that the ladder did not follow; the live-client
spike is now the future Phase 37C, gated by Phase 37B, and only
authorized under the Phase 37B constraints.

---

## 9. Recommended next phase

Two acceptable next-phase shapes, depending on how the team wants to
separate the checkpoint from the cross-repo handoff text.

- **Preferred: Phase 36E — cross-repo Dixie contract request /
  handoff document.** A short doc whose body is the §8 handoff
  draft, expanded as needed. The handoff/request itself may be
  authored and owned in this repo (or in a shared cross-repo
  location); however, the handoff document is **not** the
  authoritative live contract — it is a freeside-authored *request*
  for one. The contract that satisfies §4 / §4a / §6 must be
  Dixie-owned or explicitly cross-repo accepted, not authored
  unilaterally in this repo. A shared cross-repo location for the
  contract is acceptable only if both sides treat the artifact at
  that location as authoritative. Keeps the checkpoint and the
  handoff separable; the checkpoint does not become an issue body
  by inertia, and the handoff does not promote itself to a contract
  by inertia.
- **Alternative: Phase 37A — live Dixie client spike, only after a
  Dixie-side contract exists.** A small, dev/operator-gated spike
  exercising the live envelope against the recorded-fixture
  baseline as a reconciliation input — not as a schema baseline
  Dixie must match (§4b). The future reconciliation phase
  compares the Dixie-owned contract / examples to the existing
  local probes and updates local probes, adapter dispatch,
  validator rules, and tests if the Dixie-owned shape differs.
  Authorized **only** when the §6 preconditions hold — notably the
  §4 Dixie-owned or cross-repo-accepted artifact. Not authorized
  by this phase.

**If no Dixie-side contract is available yet, stay pre-live.** The
recorded-envelope-bound Recall Wedge ladder may continue to extend
inside its existing boundaries — additional recorded fixture shapes,
adapter / validator hardening, runner formatting refinements — but a
live Dixie client does not land.

---

## 10. Non-goals

Explicitly rejected by this checkpoint. None of the following are
authorized; if a later phase needs any, re-open the boundary doc and
the live-boundary decision first.

- **live Dixie** (no live client, no network call, no `@loa/dixie`
  dependency, no `@loa/straylight` dependency, no Finn integration
  in any phase preceding the §6 preconditions);
- **live Discord** (no live recall command in any guild; the
  substrate's `/ruggy` and `/satoshi` persona invocations are
  unaffected and unrelated);
- **live Telegram** (no Telegram bot wiring, no Telegram identity
  binding, no Telegram renderer);
- **production storage** (no Postgres, no object store, no vector
  index, no Redis behind any Recall Wedge path);
- **live memory admission** (no admission as a side effect of any
  surface, runner, or live Dixie call);
- **production auth / consent solved** (this checkpoint does not
  claim or authorize identity binding, consent capture, signer
  authority, or cross-user access);
- **`authorized_private_session` renderer** (gated on multi-surface
  contract §5a authorized-private DTO gate);
- **`public_telegram` renderer** (gated on multi-surface contract
  §8a future-renderer warning per-surface contract);
- **character voice on recall output** (recall billboards remain
  voiceless);
- **recorded fixtures as schema authority** (recorded
  `dixie-envelope/` fixtures are sample v0 contract probes only,
  per live-boundary decision §7a);
- **operational identifiers as memory identity** (`sessionId` /
  `messageId`, snake_case `session_id` / `message_id`, tenant /
  community IDs, thread IDs, and any aliases are operational /
  session identifiers — not memory identifiers — per multi-surface
  contract §5 and this checkpoint's §4f);
- **freeside-authored draft as live Dixie contract** (a
  freeside-characters draft, request, or handoff document is not
  itself the authoritative live contract; the contract that
  satisfies §4 / §4a / §6 must be Dixie-owned or explicitly
  cross-repo accepted, per §3, §4, and §9);
- **service authentication treated as end-user authorization**
  (service authentication to Dixie does not authorize any
  particular recall; end-user authorization / consent / delegation
  is a distinct contract per §4e);
- **`recorded_dixie_recall_envelope` on production traffic**
  (`recorded_dixie_recall_envelope` is a fixture/probe
  `input_envelope_kind` only; live traffic must use a distinct
  live `input_envelope_kind` per §4c, not silently reuse the
  recorded kind to satisfy the existing adapter dispatch);
- **public-bound responses carrying raw / internal / operator
  fields on the assumption the adapter will drop them** (per §4d,
  upstream public-bound envelopes must be minimized at the source;
  "the adapter will drop it" is not a justification for including
  unnecessary raw / private / debug / operator material on a
  public-bound response).

---

## 11. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates.
- `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` — Phase 35C
  multi-surface contract spec; surface taxonomy (§4), authorized
  private session contract (§5), authorized-private DTO gate (§5a),
  Discord public contract (§6), Telegram contract (§7), Telegram-
  specific authorization gates (§7e), surface-specific output rules
  (§8), future-renderer warning (§8a), Dixie / Recall Wedge envelope
  relationship (§9), Dixie adapter requirements (§9a), memory
  admission boundary (§10).
- `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` — Phase 36A
  live-boundary decision; recorded-fixtures-not-schema-authority
  (§7a); live-Dixie precondition gate (§7).
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
