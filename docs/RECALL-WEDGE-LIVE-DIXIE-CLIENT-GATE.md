# Recall Wedge — Live Dixie Client Gate Decision

> **Phase 37B** (docs / decision / implementation-contract only).
> Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A live-boundary
> decision),
> `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint),
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E cross-repo
> request / handoff), and
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A
> reconciliation).
>
> This document is a **gate decision**. It does not implement a live
> Dixie client. It does not authorize public Discord or Telegram
> behavior. It does not authorize production storage, admission, or
> consent implementation. It does not authorize public renderer
> expansion. It defines the conditions under which a future code-only
> phase (Phase 37C) may implement a tightly scoped operator/dev-only
> live Dixie client spike against
> `POST /api/recall/intake`.
>
> No code, package, lockfile, fixture JSON, validator, adapter, runner,
> Discord interaction wiring, Telegram bot wiring, command
> registration, live Dixie / Straylight / Finn integration,
> `@loa/dixie` / `@loa/straylight` runtime dependency, production
> storage, live memory admission, positive
> `authorized_private_session` projection,
> `authorized_private_session` renderer, `public_telegram` renderer,
> LLM/voice rewrite, character voice, or CI/generated-file changes are
> introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the
> live-boundary decision, the readiness checkpoint, the cross-repo
> request, and the Phase 37A reconciliation — do not silently expand
> scope from this gate.

---

## A. Status and decision

Phase 37B is **docs / decision / implementation-contract only**.

- It does not add live code.
- It does not authorize public Discord or Telegram behavior.
- It does not authorize production storage or admission.
- It does not authorize public renderer expansion.
- It does not authorize positive `public_telegram` or
  `authorized_private_session` renderer support.
- It does not authorize character-voiced recall output.
- It does authorize the next code phase, **Phase 37C**, to implement a
  tightly scoped operator/dev-only live Dixie client spike against
  `POST /api/recall/intake`, **only if** every constraint in this
  document is followed.

### A.1 Decision sentence

**Phase 37B authorizes a future Phase 37C operator/dev-only live Dixie
client spike against Dixie `POST /api/recall/intake`; it does not
authorize Discord/Telegram command wiring, public renderer expansion,
production storage/admission, positive `public_telegram` or
`authorized_private_session` support, or character-voiced recall
output.**

This authorization is conditional. Every constraint in §C
(allowed scope), §D (disallowed scope), §E (architecture), §G (env /
config), §H (request / idempotency), §I (response classification), §J
(relationship to recorded fixtures), and §K (required tests / static
guards) must hold. Partial compliance does not satisfy this gate.

---

## B. Source evidence

This gate is grounded in the following artifacts:

- `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A) —
  reconciles local recorded Dixie envelope fixtures and the local pure
  adapter against Dixie Phase 32E / 32F as external contract evidence.
- `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  (Dixie Phase 32E) — governing Dixie Recall Wedge route contract
  for `POST /api/recall/intake`.
- `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  (Dixie Phase 32F) — cross-repo readiness checkpoint over Phase 32E.

Established by those artifacts and re-stated here so future readers
do not have to re-derive:

- **Dixie Phase 32E governs `POST /api/recall/intake`.** It defines
  the route, the served-body shape, the denied / refused mapping,
  the per-estate mutex idempotency / replay behavior, the
  `Idempotency-Key` ingress requirement, the HTTP no-leak posture,
  and the explicit non-ownership boundary.
- **Dixie Phase 32F unblocks reconciliation only.** Phase 32F is
  explicit: Phase 32E is sufficient to unblock a downstream
  freeside-characters contract-reconciliation phase against Dixie's
  documented route, but is **not** sufficient to unblock live network
  calls, Discord / Telegram command wiring, production storage /
  admission, public renderer expansion, or direct Finn runtime /
  audit wiring.
- **Phase 37A completed the reconciliation.** Local recorded
  fixtures remain valid as synthetic non-production probes; they
  are not promoted to Dixie schema authority; production traffic
  must not use `recorded_dixie_recall_envelope`; the local adapter
  remains the only narrowing boundary for recorded probe input;
  unknown envelope versions and `authorized_private_session` /
  `public_telegram` targets remain fail-closed.

Therefore Phase 37B can decide whether the next phase may be the
first live client spike. The decision is in §A.1.

---

## C. Allowed Phase 37C scope

The future Phase 37C code phase, if pursued, **may**:

- add a new isolated live client module dedicated to live Dixie
  recall-intake calls;
- add a new operator/dev-only runner that drives the live client from
  explicit operator-provided inputs;
- add new tests and static guards proving every requirement in §K;
- target the route **`POST /api/recall/intake`** and only that route;
- read configuration **only** from explicit environment variables /
  config values listed (or named-equivalents of) §G;
- generate or accept an `Idempotency-Key` per request, per §H;
- classify HTTP responses into a **local narrow result type** before
  any other module reads them, per §I;
- print or report **operator/dev-only** output;
- treat service authentication and end-user recall authorization as
  separate concerns, per §E and §I.

Phase 37C **must not**:

- call or import any Discord client (`discord.js`, Discord
  interactions endpoint, Pattern B webhook code, persona-engine
  Discord delivery code, or any other Discord surface);
- call or import any Telegram client, bot framework, or renderer;
- register, modify, or publish any slash command;
- call or import storage / admission code paths (Postgres,
  object storage, vector index, Redis, any candidate-memory or
  admitted-memory code path);
- call or import any LLM client (Claude Agent SDK, Anthropic SDK,
  any persona-engine compose path);
- emit character voice or any persona-styled output;
- modify the existing recorded fixture adapter
  (`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`)
  to become the live client;
- reuse `recorded_dixie_recall_envelope` as a live wire kind or as a
  marker on production traffic;
- consume the Dixie response anywhere outside the live client's
  classifier;
- pass a raw Dixie response to the existing public-safe renderer
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`)
  or to any other public surface.

The allowed scope is intentionally narrow: a single isolated module,
a single operator/dev-only runner, and the tests that bind both.

---

## D. Disallowed Phase 37C scope

The following are explicitly disallowed for Phase 37C. They remain
gated on later, separately authorized phases:

- Discord slash-command wiring (any guild, any visibility) for
  Recall Wedge;
- Telegram bot wiring (any chat type, any visibility) for Recall
  Wedge;
- public renderer expansion (additional surfaces, additional fields,
  loosened minimization);
- positive `public_telegram` renderer support;
- positive `authorized_private_session` renderer support;
- memory admission (candidate or admitted) as a side effect of any
  Phase 37C code path;
- production storage of any kind behind a live Dixie call;
- production auth / consent implementation (identity binding,
  consent capture, signer authority, cross-user access);
- direct Finn runtime / Finn audit wiring;
- LLM rewriting of recall output;
- character-voiced recall summaries;
- treating any of `session_id`, `message_id`, `session_thread_id`,
  `tenant_id`, or `community_id` (or their camelCase aliases) as
  governed memory identity;
- using `recorded_dixie_recall_envelope` for production / live
  traffic, or pretending recorded fixtures are the live wire shape.

If Phase 37C finds itself reaching for any item above, it has
crossed this gate's boundary and must re-open the readiness
checkpoint and the live-boundary decision before proceeding.

---

## E. Live client architecture

The future Phase 37C live client follows this flow, end to end:

1. **operator/dev invocation.** A human operator (or a developer
   running the runner locally) provides explicit caller / tenant /
   request-key inputs.
2. **build live Dixie recall-intake request.** Request shape is
   reconciled against Dixie Phase 32E. The freeside-characters live
   client does **not** invent envelope shape; if Phase 32E or a
   later Dixie route phase is ambiguous, the spike halts and a
   reconciliation phase precedes the live call.
3. **attach service auth material from explicit env/config.** Per
   §G. Missing service auth fails closed before any network call.
4. **attach end-user / caller authorization context from explicit
   operator-provided inputs.** Per §G. End-user authorization is
   carried separately from service auth and is never inferred from
   service auth.
5. **generate / pass `Idempotency-Key`.** Per §H. The key is bound
   to the deterministic request content; reusing a key with
   different content is treated as unsafe.
6. **POST `/api/recall/intake`.** Per Dixie Phase 32E §2. Only this
   path; no other Dixie endpoints are called by the live client.
7. **classify HTTP result.** Transport-level status, envelope-level
   outcome, refusal class, and operational error class are mapped
   into a narrow local result type before any other code reads the
   response.
8. **narrow into local operator-only live result.** The narrow
   result type is the only object the runner consumes. Raw Dixie
   response material does not propagate beyond the classifier.
9. **print operator-only report.** The runner prints a deterministic
   operator-readable report with public-bound, internal, and error
   sections clearly partitioned.
10. **no public renderer, no memory admission, no Discord/Telegram
    dispatch.** The live client never invokes the public-safe
    renderer, never writes to candidate or admitted memory, never
    sends a Discord or Telegram message, and never registers a
    command.

### E.1 Service authentication is separate from end-user recall authorization

A service-authenticated request can still be recall-forbidden. The
live client must classify these refusals as **end-user authorization
failures**, not as service-auth failures. The two contracts are
distinct on the wire (per Phase 32E / 32F) and must be distinct in
the local classifier.

### E.2 Refusal classification must not leak private reasons

When Dixie refuses a recall, the consumer-side classifier produces a
stable reason code. The live client must not surface raw refusal
reason text into operator-public output, and must never pass refusal
reason payloads into any public-bound surface (rendered or
otherwise). Refusal reasons that contain private / hidden / debug /
operator material are sanitized at classification time.

### E.3 Unknown response shapes fail closed

Any response that does not match a known classification (per §I) is
treated as `unsupported_response_shape`. The live client does not
attempt to "best-effort" parse partial / unknown shapes. The narrow
result type does not contain a free-form fallback.

---

## F. Proposed file shape for Phase 37C

The following file paths are **recommended** for the future Phase
37C code phase. Phase 37B does not create them.

- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` —
  isolated live client module; pure HTTP/JSON I/O over
  `POST /api/recall/intake`; only place that consumes a raw Dixie
  response; emits the narrow local live result type defined in §I.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  unit tests covering: missing env fails closed; unknown response
  shape fails closed; service-auth failure vs end-user
  recall-forbidden classified separately; `Idempotency-Key`
  required; raw / private / debug / source fields never reach the
  narrow result type's public-bound fields.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts` —
  operator/dev-only runner over the live client; reads operator
  inputs from CLI / env; prints a deterministic operator-readable
  report with public-bound, internal, and error sections clearly
  partitioned; invokable only when the operator opts in via
  explicit env (per §G); no Discord / Telegram / storage / LLM
  dispatch.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts` —
  runner regression tests; exercise the runner against fake/stub
  classifiers (not real network) to prove no public-bound leak,
  no command registration, no storage write, and partitioned
  output.

If Phase 37C chooses different file names, it **must preserve the
same boundaries**: the live client is isolated to a dedicated
module; the runner is a dedicated operator/dev-only entry point;
tests bind both surfaces; the existing
`dixie-envelope-adapter.ts` is not repurposed as the live client.

---

## G. Environment / config contract for future Phase 37C

The variables below are **provisional** local dev / operator
config. They are not the production auth design. The production
auth / consent contract remains unsolved; this gate does not
authorize production auth work.

Provisional variable names:

- `RECALL_WEDGE_DIXIE_BASE_URL` — base URL of the Dixie deployment
  the live client targets. Required.
- `RECALL_WEDGE_DIXIE_SERVICE_TOKEN` — service authentication
  material for freeside-characters → Dixie. (If a different
  credential type is appropriate per Dixie Phase 32E or a future
  Dixie auth doc, the variable name is replaced with a
  repo-consistent equivalent — e.g., `RECALL_WEDGE_DIXIE_API_KEY`,
  `RECALL_WEDGE_DIXIE_SIGNING_KEY`. The point is the credential is
  loaded explicitly from env/config, not embedded in code.) Required.
- `RECALL_WEDGE_DIXIE_TENANT_ID` — tenant / community / estate
  identifier used to scope the recall call. Required.
- `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID` — operator-provided caller /
  end-user identifier carried alongside the service credential.
  Required. This is **not** a Straylight-side memory identity; it
  is a transport-layer caller identifier, per the multi-surface
  contract §5 / readiness checkpoint §4f.
- `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX` — operator-provided prefix
  used when generating `Idempotency-Key` values. Required.
- `RECALL_WEDGE_DIXIE_TIMEOUT_MS` — optional per-request HTTP
  timeout in milliseconds. Optional; the live client must define a
  conservative default and document it.

### G.1 Secrets

- **No secrets are committed.** Service tokens, API keys, signing
  keys, and any other credentials live in operator-local env or in
  out-of-tree secret stores. The repo's `.env.example` may list
  variable **names**; it must not list values.
- **Missing env fails closed.** If any required variable above is
  absent or empty, the live client must refuse to issue a network
  call and surface a stable error code (per §I,
  `service_unauthorized` or a more specific equivalent).

### G.2 Production auth / consent remains unsolved

This gate explicitly does **not** authorize production auth /
consent work. The provisional variables above are local
dev/operator config for an operator/dev-only spike. They do not
constitute a production identity-binding contract. Production auth
/ consent remains gated on the readiness checkpoint §4 / §4a
items and on a separately authorized phase.

---

## H. Request / idempotency requirements

The future Phase 37C live client must satisfy the following on
every request:

- **Route is `POST /api/recall/intake`.** Per Dixie Phase 32E §2.
  No other Dixie endpoints are called.
- **`Idempotency-Key` is required.** Per Dixie Phase 32E §2.3 and
  ADR-026D §3.b. The live client generates or accepts a key per
  request; missing keys are treated as unsafe.
- **Request construction is explicit and deterministic.** Inputs
  (tenant, caller actor, request body) are constructed from
  operator-provided values and from the env config, with no
  implicit fallback. Tests must be able to construct the same
  request shape from the same inputs.
- **Reusing an `Idempotency-Key` with different request content is
  unsafe.** The live client must not silently reuse a key across
  different request bodies. Either the key is bound to the
  deterministic content of a logical request, or the operator
  generates a fresh key per logical request. Either way, accidental
  reuse with different content is treated as a programming error
  and surfaced.
- **Retry / replay semantics are documented.** Phase 37C's tests
  or operator report must document how the live client behaves
  when the same `(tenant_id, caller_actor_id, request_key)` triple
  is re-sent: which fields are expected to be identical, whether
  the cached response is treated as authoritative, and what
  happens when Dixie's per-estate mutex returns a cap-exceeded
  refusal that deliberately bypasses cache (per Dixie Phase 32E
  §2.3).
- **Request body must not treat chat logs or "remember this" text
  as admitted Straylight memory.** The live client is a read-side
  recall caller. It does not write candidate memory, does not
  admit memory, and does not promote any operator-provided input
  to "memory" status by virtue of being included in a Recall
  Wedge request. Per the boundary doc §6 and post-MVP decision
  map §3 Option E.

---

## I. Response classification requirements

The future Phase 37C live client must define a **local
classification vocabulary** and map every response into exactly
one classification before any other module reads the response.

Recommended classification names (Phase 37C may adjust the names,
but the classifier must exist and must cover at minimum the
distinctions below):

- `served` — Dixie returned a successful recall response per
  Phase 32E §2.1 served-body shape.
- `denied_or_forbidden` — end-user / caller is not authorized for
  this recall; service auth is fine. Per Phase 32F service-auth-vs-
  user-auth distinction. Maps to Dixie's `403`-class refusal
  envelope shape.
- `needs_review` — Dixie's response indicates the recall requires
  human review, contested marking, or other Straylight-side
  intervention before resolution. Per Phase 32E `needs_review`
  mapping.
- `ingress_invalid_request` — Dixie refused at ingress (missing /
  oversized `Idempotency-Key`, malformed body, or other ingress
  refusal). Per Phase 32E §2.3 / ADR-026D §3.b.
- `service_unauthorized` — service-level authentication failed
  (missing or invalid service credential).
- `tenant_or_session_mismatch` — request is bound to one tenant /
  community / session and attempts to recall content scoped to
  another, and Dixie refuses with the corresponding refusal
  envelope.
- `rate_limited` — Dixie returned a rate-limit refusal (cap-exceeded
  per Phase 32E §2.3 deliberately bypasses cache and is classified
  here).
- `upstream_unavailable` — Dixie is unreachable, returns a `5xx`
  operational error, or the response indicates an internal Dixie
  failure rather than a recall-level refusal.
- `unsupported_response_shape` — response did not match any of the
  known shapes above. **Fail-closed** — no further processing.
- `network_error` — request did not complete a round-trip
  (timeout, connection error, TLS error).

### I.1 Classifier invariants

- **Names may be adjusted in implementation, but the classifier must
  exist.** Tests must verify each distinguishable wire condition
  maps into exactly one classification.
- **Unknown response shapes fail closed.** No best-effort parsing,
  no neighbouring-field inference, no "default served" path.
- **Raw response is not sent to renderers.** The classifier produces
  a narrow local result type; only the narrow result type
  propagates beyond the live client module.
- **Public-bound raw / private / debug / source fields are not
  exposed.** The narrow result type's public-bound fields cannot
  carry raw reasons, debug payloads, hidden estate material,
  private assertion IDs, source material, actor identifiers,
  raw chat-log contents, or raw operator diagnostic payloads.
  Tests must enforce this invariant against the same banned-
  substring posture used by `render-public-recall.ts` and the
  Phase 33B no-leak validator.

### I.2 Refusal classification does not leak private reasons

When Dixie returns a refusal envelope with a refusal reason, the
live client maps the response into `denied_or_forbidden` (or the
appropriate refusal class) **without** copying raw refusal text
into operator-public output. Operators may receive a stable reason
code; private reasoning that justified the refusal stays out of
operator-public output and never reaches a public renderer.

---

## J. Relationship to recorded fixtures

The recorded fixture adapter
(`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`)
and the recorded fixture corpus
(`docs/recall-wedge/fixtures/dixie-envelope/`) remain bound to
fixture/probe input only.

- **Phase 37C must not mutate `dixie-envelope-adapter.ts` into the
  live client.** The recorded adapter is for
  `recorded_dixie_recall_envelope` only. The live client lives in a
  distinct module per §F.
- **The recorded fixture adapter remains for
  `recorded_dixie_recall_envelope` only.** Per Phase 37A
  reconciliation §3 and Dixie Phase 32F §6.
- **The live client must use a distinct live path / module.** No
  silent reuse of `recorded_dixie_recall_envelope` as a live wire
  kind. If Dixie publishes a canonical live `input_envelope_kind`,
  Phase 37C reconciles against it; otherwise Phase 37C halts
  pending the canonical live kind, per readiness checkpoint §4c.
- **Recorded fixtures remain tests for narrowing / no-leak /
  fail-closed behavior, not live traffic samples.** Phase 37C may
  use the recorded fixtures as offline regression vectors for the
  recorded adapter, but it does **not** treat them as samples of
  live traffic.

If Phase 37C identifies a concrete divergence between the live
contract and the recorded fixtures, the divergence is resolved in
Dixie's favor (per readiness checkpoint §4b and Phase 37A §2);
the local fixtures, adapter, validator, and tests change — not the
Dixie contract.

---

## K. Required tests / static guards for future Phase 37C

The future Phase 37C code PR must include tests proving each of
the following:

- **No Discord imports.** No file in the live client module or
  runner imports `discord.js`, the persona-engine Discord delivery
  code, the Pattern B webhook code, or the Discord interactions
  endpoint.
- **No Telegram imports.** No file in the live client module or
  runner imports any Telegram client, bot framework, or Telegram
  renderer code.
- **No command registration.** Phase 37C registers no slash command
  and modifies no command registration code paths.
- **No storage imports.** No file in the live client module or
  runner imports Postgres clients, object storage clients, vector
  index clients, Redis clients, or any candidate-memory or
  admitted-memory code path.
- **No LLM imports.** No file in the live client module or runner
  imports the Claude Agent SDK, Anthropic SDK, or any
  persona-engine compose path.
- **No character voice.** Phase 37C emits no character-styled
  output; runner output is operator/dev formatting only.
- **No `recorded_dixie_recall_envelope` live traffic.** The live
  client must not label live traffic with the recorded probe kind.
  Tests must assert this for every code path that constructs a
  live request body.
- **Missing env fails closed.** Tests must run the live client
  with each required env variable from §G omitted in turn and
  assert a fail-closed result without a network call.
- **Unknown response shape fails closed.** Tests must drive the
  live client with synthetic responses that do not match any
  known classification (per §I) and assert
  `unsupported_response_shape` (or the named equivalent), with no
  free-form fallback parsing.
- **Service-auth failure and end-user recall-forbidden are
  classified separately.** Tests must drive each case
  independently and assert distinct classifications
  (`service_unauthorized` vs `denied_or_forbidden` or named
  equivalents).
- **`Idempotency-Key` is required.** Tests must assert that every
  outbound request carries the header, that key reuse with
  different content is detected, and that ingress refusals on
  missing / oversized key are classified as
  `ingress_invalid_request` (or the named equivalent).
- **Raw / private / debug / source fields never reach
  operator-public output or any public renderer.** Tests must
  drive responses that embed banned-sentinel material (the same
  posture used by the Phase 33B no-leak validator and
  `render-public-recall.ts`'s `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`
  scan) and assert that the operator-public sections of the
  runner's output do not contain any of those substrings, and
  that the narrow result type's public-bound fields do not carry
  any of those substrings.

These tests are the gate Phase 37C must clear before merging.
Static guards (import-time assertions, lint rules, file-scope
greps in tests) are acceptable substitutes for behavioral tests
where appropriate, but the underlying invariant must hold either
way.

---

## L. Future phase ladder

The recommended sequence after Phase 37B:

- **Phase 37C** — operator/dev-only live Dixie client spike,
  classifier, runner, and tests. Authorized by this gate, subject
  to every constraint in §C–§K.
- **Phase 37D** — live client audit / acceptance checkpoint. A
  docs / acceptance phase reviewing the Phase 37C spike: did the
  classifier exhaustively cover Dixie's documented outcomes; did
  the operator runner partition output correctly; did the tests
  enforce every invariant in §K; were any concrete divergences
  with Phase 32E found that require Dixie-side reconciliation;
  is the spike safe to extend.
- **Phase 38A** — only if Phase 37C / 37D pass, implement the
  fixture/injected-result multi-surface Recall Wedge boundary
  harness per
  `docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md`. The harness
  consumes injected / fake `LiveDixieRecallResult`-shaped values
  and (optionally) recorded fixture projections; it does not call
  the Phase 37C live client and does not make network calls.
  Phase 38A does not authorize real Discord / Telegram /
  private-chat surface wiring.
- **Phase 38B** — harness audit / acceptance of the Phase 38A
  multi-surface boundary harness. Docs / acceptance phase only;
  does not authorize real surface wiring.
- **Phase 39A** — earliest decision point for a controlled
  public (or controlled dev-only) Discord test surface for Recall
  Wedge. Subject to its own decision gate and to the post-MVP
  decision map §5a Discord command operational gates; this gate
  does not authorize Phase 39A.
- **Phase 39B** — may implement a tightly gated dev-only Discord
  command **only if** Phase 39A explicitly authorizes it. Subject
  to every constraint Phase 39A defines and to §5a operational
  gates. Phase 39B is not authorized by this gate.
- **Telegram, private chat, `authorized_private_session`,
  `public_telegram`, storage / admission, Finn audit wiring, LLM
  rewriting, and character-voiced recall output remain later,
  separately authorized phases.** Each is gated on its own
  decision artifact (multi-surface contract §5a / §8a / §10;
  readiness checkpoint §6; post-MVP decision map §6 / §7).

### L.1 Phase 37D addendum — Phase 37C accepted as operator/dev-only seam; next work is multi-surface harness

> Added by Phase 37D
> (`docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md`). Targeted
> addendum to the future phase ladder, not a rewrite of this
> section.

Status of the ladder as of Phase 37D:

- **Phase 37C implemented the live client spike** under this
  gate — the operator/dev-only live Dixie client
  (`live-dixie-client.ts`), its tests, the operator runner
  (`run-live-dixie-recall-demo.ts`), and runner regression tests.
  Phase 37C is the only live Dixie seam in the repo.
- **Phase 37D accepts Phase 37C as operator/dev-only only.** It
  does not authorize real public / private surface integration.
  Phase 37C does not authorize Discord command wiring, Telegram
  bot wiring, private chat integration, public renderer expansion,
  positive `public_telegram` or `authorized_private_session`
  support, production storage / admission, production auth /
  consent implementation, direct Finn runtime / audit wiring,
  LLM rewriting, or character-voiced recall output.
- **The next implementation phase is the multi-surface boundary
  harness, not real surface wiring.** Phase 37D redirects the
  next MVP proof toward a fixture/injected-result multi-surface
  Recall Wedge boundary harness (Phase 38A), per
  `docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` §G–§H. The
  Phase 38A harness consumes injected / fake
  `LiveDixieRecallResult`-shaped values; it does **not** call the
  Phase 37C live client and does **not** make network calls.
- **Discord / Telegram / private-chat wiring remain blocked.**
  Phase 39A (or later) is the earliest decision point for a
  controlled dev-only Discord surface, subject to its own
  decision artifact and to the post-MVP decision map §5a
  operational gates.

This addendum does not relax any constraint in §C–§K of this gate.
It records that Phase 37C cleared this gate at operator/dev level
only and that the next implementation work is the Phase 38A
multi-surface harness.

### L.2 Phase 38B note — Phase 38A and Phase 38B did not invoke or expand the Phase 37C live client

> Added by Phase 38B
> (`docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md`).
> Short clarifying note, not a rewrite of this section.

For audit trail completeness:

- **Phase 38A did not invoke or expand the Phase 37C live client.**
  The Phase 38A multi-surface boundary harness consumed
  injected / locally-constructed `LiveDixieRecallResult`-shaped
  values; it did not import `live-dixie-client.ts`, did not call
  `runLiveDixieRecallDemo`, and did not perform any network call.
- **Phase 38B did not invoke or expand the Phase 37C live client.**
  Phase 38B is docs / audit / acceptance only and added no source,
  test, fixture, package, lockfile, config, CI, or generated change.
- **Phase 37C remains the only live Dixie seam in the repo.** The
  client and runner remain operator/dev-only. Public Discord,
  Telegram, private-chat, storage / admission, public renderer
  expansion, LLM rewriting, character-voiced recall, positive
  `public_telegram` support, and positive
  `authorized_private_session` support remain blocked under §C–§K.

This note does not relax any constraint in §C–§K of this gate; it
records continued compliance with §D, §J, and §K through the Phase
38A / 38B work.

---

## M. Acceptance criteria

Phase 37B is acceptable if:

- exactly **one new gate doc is added** (this file);
- the existing post-MVP decision map
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`) gains a **targeted
  Phase 37B addendum** narrowing the live Dixie client option to
  operator/dev-only first and citing Dixie Phase 32E / 32F and
  Phase 37A;
- the existing readiness checkpoint
  (`docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md`) gains a
  **targeted Phase 37B addendum** stating that Phase 37A became
  reconciliation, that Phase 37B is the gate for a future Phase
  37C operator/dev-only live client spike, and that all public
  surface, Telegram, `authorized_private_session`, storage /
  admission, Finn, and character voice work remains blocked;
- **no source / fixture / package / lockfile / CI / generated
  changes** are made;
- the docs clearly authorize **only** a future operator/dev-only
  live client spike;
- the docs clearly keep public integrations blocked.

---

## N. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates; Phase 37B addendum.
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
- `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` — Phase
  36D readiness checkpoint; Phase 37B addendum.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 36E
  cross-repo request / handoff.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — Phase 37A
  reconciliation against Dixie Phase 32E / 32F.
- `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  — Dixie Phase 32E governing route contract.
- `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  — Dixie Phase 32F readiness checkpoint.
- `docs/recall-wedge/fixtures/README.md` — fixture set, including
  Phase 35D + Phase 36B `dixie-envelope/` fixtures.
- `docs/recall-wedge/fixtures/validate-fixtures.mjs` — Phase 33B /
  35D / 36B fixture validator.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts` —
  Phase 33C public-safe renderer.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts` —
  Phase 35D pure Dixie envelope adapter (recorded fixtures only;
  Phase 37C must not repurpose this as the live client).
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts` —
  Phase 35D / 36B adapter regression gate.
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts` —
  Phase 36C dev/operator runner over recorded Dixie envelopes
  (recorded fixtures only; Phase 37C's live runner is a distinct
  module per §F).
