# Recall Wedge — Live Dixie Discord Decision Gate

> **Phase 41A** (docs / decision gate only). Companion to
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate),
> `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` (Phase 40A
> post-smoke-test decision gate),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` (Phase 40B internal
> demo guide),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` (Phase 39E
> smoke-test acceptance),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` (Phase 39D
> operational runbook),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` (Phase 39A
> controlled-surface decision gate),
> `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` (Phase 38B
> harness acceptance), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option
> matrix).
>
> This document is a **decision gate**. It follows Phase 40B and selects
> the next meaningful proof boundary: whether the Discord surface may
> ever consume a **live Dixie Recall Wedge result** under the same tight
> gates that govern the existing harness demo. It decides the safe
> future *shape* of that work. It does **not** implement it.
>
> It does not change `/recall-wedge-demo`. It does not add or authorize
> live Dixie-backed Discord recall. It does not add or authorize public
> channel-visible recall. It does not add memory admission,
> candidate-memory writes, or "remember this." It adds no Telegram /
> private chat / storage / admission / production auth / consent / LLM /
> voice / public renderer expansion. If a step seems to require reaching
> past those boundaries, the answer is to open the separate later gate
> that owns it — not to relax it from this decision.

---

## A. Status and decision

Phase 41A is **docs / decision gate only**.

- Phase 41A **follows Phase 40B** (the internal demo guide).
- It **does not implement live Dixie-backed Discord recall.** No source,
  test, package, lockfile, fixture, config, CI, or generated change is
  introduced by Phase 41A.
- It **does not change `/recall-wedge-demo`.**
- It **does not add or authorize public channel-visible recall.**
- It **does not add memory admission.**
- It **does not add candidate-memory writes.**
- It **does not add "remember this."**
- It **does not add** Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, or public
  renderer expansion.

### A.1 Decision sentence

**Phase 41A authorizes only a future Phase 41B decision/implementation
slice for a separate dev/operator-only `/recall-wedge-live-demo` command
that may consume the existing Phase 37C live Dixie client after Discord
gates pass; `/recall-wedge-demo` remains harness-backed,
public-channel-visible recall remains blocked, and memory admission
remains blocked.**

This authorization is conditional. It selects the next decision
boundary only — it does not implement Phase 41B, and it does not
pre-approve any Phase 41B PR. A future Phase 41B carries its own scope
(§F), its own required gates (§G), its own input / output boundaries
(§H, §I), its own lazy-load / network boundary (§J), its own logging
boundary (§K), and its own acceptance criteria (§M). Everything Phase
39A / 39D / 39E / 40A / 40B blocked stays blocked here (§O).

### A.2 Phase 41B / 41C note — implemented, then documented; Phase 41D is the future acceptance

> Added by Phase 41C
> (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`).

- **Phase 41B implemented the separate command.** The
  `/recall-wedge-live-demo` command (disabled-by-default,
  guild-scoped-only registration, operator-gated, ephemeral-only, fixed
  deterministic input, no options, lazy Phase 37C live-client load only
  after the Discord gates pass, safe classification / outcome / route /
  reason output, final no-leak scan, generic fail-closed refusal) is
  merged via PR #137 under the §F–§M constraints.
- **Phase 41C documents the operational procedure.** It is the docs-only
  runbook for safely configuring, registering, invoking,
  fail-closed-testing, disabling, removing, and capturing evidence for
  the live command. It changes no runtime behavior.
- **Phase 41D is the future smoke-test acceptance** if a controlled live
  run occurs — a docs-only redacted report similar to the Phase 39E
  harness-demo acceptance. **Ladder note:** §N below predates Phase 41B
  and labels that future acceptance "Phase 41C"; the ladder advanced one
  slot (41B = implementation, 41C = runbook), so read §N's "Phase 41C
  smoke-test acceptance" as **Phase 41D**.
- **No new authorization beyond Phase 41A / 41B.** Phase 41C and the
  future Phase 41D add no runtime scope; everything §O blocks stays
  blocked.

### A.3 Phase 41D note — controlled live-Dixie Discord smoke test accepted; safe wiring only

> Added by Phase 41D
> (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`),
> 2026-05-30.

- **The future Phase 41D anticipated in §A.2 / §N has occurred and is
  accepted (docs-only).** A human operator deployed Dixie live (Railway,
  healthy service + Postgres), wired the **Freeside Characters** service
  with the live Dixie env, registered `/recall-wedge-live-demo` to one
  configured guild, and invoked it as an allowlisted operator.
- **Accepted scope: safe live wiring + fail-closed rendering, not served
  recall.** The authenticated `/api/recall/intake` call reached the
  Straylight seam and returned `seam.storage_unavailable` (unseeded live
  estate / storage); the command classified it as `upstream_unavailable`
  and rendered an ephemeral operator-safe summary with no raw reasons,
  payload, IDs, or tokens — exactly the §I output / §J lazy-load / §K
  logging boundaries this gate set.
- **No new authorization.** Phase 41D adds no runtime scope. It claims no
  production rollout, no public recall, no served memory, no healthy Finn
  integration, and no cross-user auth / consent. Everything §O blocks
  stays blocked; served recall is blocked on the unseeded estate /
  storage state.
- **Ladder note:** §N below (written before Phase 41B landed) calls this
  acceptance "Phase 41C"; read it as **Phase 41D**, consistent with the
  §A.2 ladder reconciliation.

### A.4 Phase 42A note — seeded live estate selected as the next MVP need; this gate's live-command shape preserved

> Added by Phase 42A
> (`docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`), 2026-05-30.

- **Phase 42A is a separate docs-only decision gate** that selects the
  next MVP need *after* Phase 41D: a seeded dev/operator live estate /
  storage fixture, so the live path can prove a safe served live recall
  result. It implements nothing and seeds nothing.
- **It preserves everything this gate set.** A future seeded-estate proof
  reuses the separate `/recall-wedge-live-demo` command and its §F scope,
  §G env gates, §H fixed/finite input boundary, §I response-narrowing /
  no-leak output boundary, §J lazy-load boundary, and §K logging
  boundary — unchanged. Seeding adds a governed `served` case; it does
  not relax any boundary here.
- **Nothing this gate blocked is unblocked.** Everything in §O remains
  blocked. Seeded live memory must be a reviewed operator/dev fixture,
  not user chat ingestion; production memory admission, public recall,
  cross-user auth / consent, and public channel-visible recall stay
  blocked behind separate later gates. Phase 42A makes no served-memory
  acceptance claim.

### A.5 Phase 42D note — this gate's live-command shape served a seeded recall, accepted as a controlled dev/operator proof

> Added by Phase 42D
> (`docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`),
> 2026-05-31.

- **The separate `/recall-wedge-live-demo` command this gate scoped served
  a seeded recall and is accepted (docs-only).** After Dixie-side seeding
  (direct Dixie Phase 32K v4b seeded smoke) and Freeside Characters Phase
  42B (safe pre-Dixie gate diagnostics) / Phase 42C (seeded request /
  signature alignment), an allowlisted operator invoked the command in the
  configured guild and received `classification` / `outcome` / `route` /
  `reason` all `served` / `/api/recall/intake`.
- **Every §F–§K boundary this gate set was preserved.** The run used the
  separate command (§E / §F), the separate `RECALL_WEDGE_LIVE_DISCORD_DEMO_*`
  gates plus the separate `RECALL_WEDGE_DIXIE_*` client config (§G), the
  fixed / finite seeded input (§H), the Phase 37C classifier + final
  no-leak scan on the output (§I), the lazy live-client load only after the
  Discord gates pass (§J), and the safe-reason-code logging posture (§K).
  Seeding added a governed `served` case; it did not relax any boundary
  here. Phase 42C only aligned the request / signature *shape* the §H
  fixed/finite input takes, within the §H boundary.
- **No new authorization.** Phase 42D adds no runtime scope. It accepts a
  controlled dev/operator seeded live recall only — no production rollout,
  no production memory admission, no durable production storage, no
  user-chat ingestion, no public recall, no cross-user auth / consent, and
  no healthy Finn integration. Everything §O blocks stays blocked; the
  recommended next step is a docs-only Admission Wedge decision gate.

---

## B. Source evidence

This decision gate is grounded in the following artifacts. **These
source / test files are evidence only; Phase 41A modifies none of
them.** No new code path is introduced or authorized here.

Decision-doc evidence:

- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the authority that scoped the Phase 37C operator/dev-only
  live client and listed its required tests / static guards (its §C–§K).
  Gains a Phase 41A note; not rewritten.
- `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` — Phase 40A
  post-smoke-test decision gate; selected Phase 40B then a possible
  Phase 40C. Gains a Phase 41A note.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` — Phase 40B internal
  demo guide; the operator-facing how-to-demo-safely artifact for the
  harness demo. Gains a Phase 41A note.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the redacted real-guild evidence for the
  harness demo.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing register / enable / invoke /
  disable / remove procedure for the harness demo.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  controlled-surface decision gate; the authority that defined the
  dev-only / guild-only / operator-only / ephemeral / harness-backed
  posture.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A multi-surface harness that backs the
  current demo's rendered output.

Source / test evidence (read only; **Phase 41A modifies none of
these**):

- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the Phase
  39B handler. Source of the env gate helpers
  (`shouldEnableRecallWedgeDiscordDemo`,
  `isRecallWedgeDiscordDemoAllowedGuild`,
  `isRecallWedgeDiscordDemoOperator`,
  `shouldRegisterRecallWedgeDiscordDemo`,
  `resolveRecallWedgeDiscordDemoGuildId`), the fixed `case` enum selector
  (`served` / `denied`), the ephemeral-only response builder, the single
  generic refusal string (`recall-wedge-demo is not available here.`),
  the fixed framing header, and the final banned-substring no-leak scan.
  It is harness-backed and **does not import the Phase 37C live client.**
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests, including the static guard
  that the handler never imports the live Dixie client.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  Phase 37C operator/dev-only live Dixie client. Source of the live
  intake path constant (`LIVE_DIXIE_CLIENT_INTAKE_PATH =
  "/api/recall/intake"`), the env config it reads (§G), and the
  classification vocabulary it narrows responses into (§I).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests proving missing-env fail-closed, unknown-shape
  fail-closed, service-auth-vs-end-user-auth separation, idempotency-key
  requirement, and no-leak of raw / private / debug / source fields.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  — the Phase 37C operator/dev-only runner over the live client;
  partitioned operator output; no Discord / Telegram / storage / LLM
  dispatch.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`
  — Phase 37C runner regression tests against fake / stub classifiers
  (no real network) proving no public-bound leak, no command
  registration, no storage write, and partitioned output.

State clearly:

- these source / test files are **evidence only**;
- **Phase 41A modifies none of them**;
- Phase 41A introduces no new source, test, fixture, package, lockfile,
  config, CI, or generated file.

---

## C. Proven state before Phase 41A

The Recall Wedge ladder is accepted through Phase 40B. Summarized so a
future reader does not re-derive it:

- **Phase 37C proved an operator/dev-only live Dixie client seam.** The
  live client (`live-dixie-client.ts`) and its runner
  (`run-live-dixie-recall-demo.ts`) call Dixie's
  `POST /api/recall/intake`, classify the response into a narrow local
  result type, and partition operator output. They are the **only** live
  Dixie seam in the repo, and they are **not reachable from Discord**.
- **Phase 38A / 38B proved multi-surface projection harness
  boundaries.** The Phase 38A harness binds the same continuity actor /
  same recall result to a taxonomy of surface frames
  (`operator_dev`, `public_discord_simulated`,
  `public_telegram_simulated`, `authorized_private_session_simulated`,
  `private_chat_simulated`, `character_frame_public`) and asserts each
  frame's allowed projection or fail-closed refusal. Phase 38B accepted
  it. The harness consumes injected / fake `LiveDixieRecallResult`-shaped
  values; it does not call the Phase 37C live client and makes no network
  call.
- **Phase 39B / 39C implemented a controlled Discord harness command and
  registration gate.** Phase 39B added the `/recall-wedge-demo` handler
  (guild-scoped, operator-gated, ephemeral, fixed `case` enum selector,
  generic refusal, banned-substring no-leak scan). Phase 39C added the
  disabled-by-default, guild-scoped-only registration gate. The handler
  renders Phase 38A harness output and **does not import the Phase 37C
  live client.**
- **Phase 39E proved a real Discord smoke test for `/recall-wedge-demo`.**
  A human operator ran the Phase 39D smoke test in one configured guild
  (redacted observations only): guild-scoped registration with no global,
  operator-gated ephemeral harness output for `served` and `denied`, and
  the single generic ephemeral refusal for a non-operator.
- **Phase 40A selected Phase 40B then a possible Phase 40C.** Phase 40B
  added the internal demo guide; Phase 40C (a guild-scoped
  de-registration helper) remains optional / deferred.
- **Phase 40B added the internal demo guide** — an operator-facing
  how-to-demo-safely artifact layered on the Phase 39D runbook.
- **The existing `/recall-wedge-demo` is harness-backed only.** It renders
  the Phase 38A multi-surface harness from a fixed fixture; it does not
  call live Dixie.
- **No current Discord command calls live Dixie.** The only live Dixie
  path is the Phase 37C operator/dev-only client / runner, which no
  Discord surface imports or invokes.

---

## D. Why not Phase 40C now

Phase 40A selected Phase 40B (done) and then a *possible* Phase 40C — a
guild-scoped de-registration helper — **only if still needed**. Phase
41A does not do 40C now, for these reasons:

- **Phase 40C is optional operational cleanup.** It would make teardown
  less error-prone, but it does not extend the proof and is not on any
  critical path.
- **Manual disable / removal already exists through the Phase 39D
  runbook.** Disable invocation (runbook §K.1), disable registration
  (runbook §K.2), and manual removal (runbook §L — Discord Developer
  Portal / client, a scoped `DELETE` against the specific guild command
  ID with placeholders only, or reverting the Phase 39B / 39C commits)
  cover teardown today. The Phase 40B guide §M points back to that
  procedure.
- **No current blocker requires a helper.** Nothing in the accepted state
  is blocked on automated de-registration; the manual procedure is
  sufficient for the controlled demo posture.
- **The more valuable next proof is whether Discord can safely consume
  live Dixie output under the same tight gates.** That question — not
  teardown ergonomics — is the meaningful next boundary, so Phase 41A
  opens that decision lane (Phase 41B) instead of doing 40C.
- **Phase 40C remains available later.** If manual de-registration
  becomes risky or annoying, Phase 40C can be picked up as its own phase
  under the constraints Phase 40A §E already set (guild-scoped only, no
  global-delete, no handler-behavior change, tests / static guards, no
  secrets).

---

## E. Separate command decision

- **Future live-Dixie Discord work must not silently replace the harness
  output of `/recall-wedge-demo`.** The accepted harness demo is the
  smoke-tested, operator-facing artifact; turning it into a live producer
  in place would erase the boundary between fixture proof and live proof.
- **Future implementation should use a separate command name:
  `/recall-wedge-live-demo`.**
- Reasons:
  - **preserves the accepted harness demo** — `/recall-wedge-demo` stays
    exactly what Phase 39E accepted and Phase 40B documented;
  - **avoids confusing fixture proof with live producer proof** — two
    names keep "this is a fixed fixture" and "this called a live
    producer" visibly distinct to operators and reviewers;
  - **keeps registration / runtime / env gates separable** — the live
    command gets its own env gates (§G), so it can be registered,
    enabled, and torn down independently;
  - **allows disabling the live path without disabling the harness demo**
    — turning the live command off must never affect the harness demo,
    and vice versa;
  - **makes audit and operator language clearer** — every log line,
    refusal, and guide sentence can name which command and which posture
    (harness vs live) without ambiguity.

---

## F. Future Phase 41B allowed scope

A future Phase 41B is **possibly allowed**, and only under **all** of the
following constraints. Phase 41A authorizes Phase 41B as a decision /
implementation *slice*, not as an approved PR:

- **dev/operator-only;**
- **disabled by default;**
- **guild-scoped registration only;**
- **operator-gated invocation only;**
- **ephemeral-only responses;**
- **separate command `/recall-wedge-live-demo`;**
- **no mutation to `/recall-wedge-demo`** (handler, registration,
  dispatch, or rendering);
- **no public channel-visible output;**
- **no freeform recall query;**
- **no Discord message history input;**
- **no memory admission;**
- **no candidate-memory writes;**
- **no "remember this";**
- **no production auth / consent claim;**
- **no Telegram / private chat;**
- **no LLM rewriting or character voice;**
- **no public renderer expansion;**
- **no package / lockfile changes** unless a concrete blocker appears and
  is named in that phase;
- **must include tests / static guards if implementation happens** (at
  minimum the §M acceptance criteria).

If Phase 41B finds itself reaching for any item Phase 41A blocks (§O), it
has crossed this gate's boundary and must re-open the gate that owns the
item before proceeding.

---

## G. Future Phase 41B required gates

Phase 41B's env / config gates must be **separate live-command gates, not
reuse of the harness command gates.** The harness demo's gates
(`RECALL_WEDGE_DISCORD_DEMO_ENABLED`, `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`,
`RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`,
`RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS`) must keep governing only
`/recall-wedge-demo`. The live command gets its own:

- **`RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`** must be the exact string
  `"true"` to enable invocation (fail-closed on any other value, including
  `TRUE` / `True` / `1` / `yes` / surrounding whitespace / unset).
- **`RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS`** must be the exact
  string `"true"` before the live command is registered.
- **`RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID`** must be present and
  non-empty; it scopes both registration and invocation to one guild.
- **`RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`** must be present
  and non-empty; it is the operator invocation allowlist.

Also:

- **Phase 37C live Dixie client config / secrets remain separate** and
  must follow the existing live Dixie client gate / runbook. The Phase
  37C client reads its own env — `RECALL_WEDGE_DIXIE_BASE_URL`,
  `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`, `RECALL_WEDGE_DIXIE_TENANT_ID`,
  `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID`,
  `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX`, and optional
  `RECALL_WEDGE_DIXIE_TIMEOUT_MS` — per
  `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` §G. Phase 41B does not
  redefine those; it gates *whether Discord may reach the client*, not
  *how the client authenticates to Dixie*.
- **No tokens, service credentials, app IDs, guild IDs, command IDs, or
  user IDs may be recorded** in docs, logs, PRs, or screenshots. The
  repo's `.env.example` may list variable **names**; it must not list
  values.
- **Registration must never fall back to global if the guild ID is
  missing.** A missing or empty `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID`
  fails closed — no registration — the same never-global posture the
  Phase 39C registration path proves for the harness command.

---

## H. Live Dixie request / input decision

Future Phase 41B:

- **must not accept arbitrary freeform recall text;**
- **must not read Discord message history;**
- **must not use Discord channel content as recall input;**
- **must not admit user text as memory** (no candidate write, no
  admission, no "remember this");
- **may use one of:**
  1. **a fixed deterministic operator/dev request shape** aligned to the
     Phase 37C live client (the same explicit operator-provided
     tenant / caller / request-key inputs the Phase 37C client / runner
     already construct), or
  2. **a finite enum selector over pre-reviewed request shapes** (the
     same shape as the harness command's fixed `served` / `denied`
     `case` enum — a small, closed set, never a text field),

  **but only if** the request source is code-reviewed and tests prove
  **no freeform query path exists** — no Discord option that accepts
  arbitrary text reaches the request builder, and no Discord message
  content is read into the request.
- **References, not invented secrets:** the Phase 37C client's request
  construction and its config names are documented in
  `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` §G / §H and implemented in
  `packages/persona-engine/src/recall-wedge/live-dixie-client.ts`. Phase
  41B references those; it does not invent secret values, and it does not
  record any real value in docs / logs / PRs.

The principle: the **only** inputs that can reach the live Dixie request
from Discord are a fixed shape or a finite pre-reviewed enum chosen by an
allowlisted operator — never user-authored text and never channel
history.

---

## I. Live Dixie response / output decision

Future Phase 41B:

- **must not dump raw Dixie responses;**
- **must narrow / classify the live Dixie result before rendering** —
  reuse the Phase 37C classifier (the exported
  `LIVE_DIXIE_RECALL_CLASSIFICATIONS` vocabulary in
  `live-dixie-client.ts`: `served`, `denied_or_forbidden`,
  `needs_review`, `ingress_invalid_request`, `service_unauthorized`,
  `tenant_or_session_mismatch`, `rate_limited`, `upstream_unavailable`,
  `unsupported_response_shape`, `network_error`, plus the pre-network
  config / safety classes `missing_required_env`, `invalid_config`, and
  `unsafe_idempotency_key_reuse`) so only the narrow local result type,
  never raw response material, reaches the Discord render path. The three
  pre-network classes (`missing_required_env`, `invalid_config`,
  `unsafe_idempotency_key_reuse`) are emitted *before* any HTTP round-trip
  and map directly onto the §J fail-closed-before-egress requirement;
- **must run a no-leak scan over the final Discord output** — the same
  banned-substring posture used by the harness handler's final scan and
  by `render-public-recall.ts` / the Phase 33B no-leak validator;
- **must expose only public-safe or operator-safe summaries;**
- **must not expose** `raw_reasons`, debug payloads, source fields,
  private identifiers, raw assertion IDs, service errors, stack traces,
  tokens, or operational IDs;
- **unknown response shapes must fail closed** — `unsupported_response_shape`
  renders a generic ephemeral refusal, never a best-effort parse;
- **Dixie 4xx / 5xx / network errors must fail closed** — classified
  (`service_unauthorized`, `ingress_invalid_request`,
  `tenant_or_session_mismatch`, `rate_limited`, `upstream_unavailable`,
  `network_error`) and rendered as a public-safe / operator-safe summary
  or a generic ephemeral refusal, never raw upstream text;
- **guard / cap / rate-limit conditions must be classified safely**
  (e.g. cap-exceeded refusals collapse into `rate_limited`) and rendered
  without raw upstream messages;
- **if a response cannot be safely narrowed, render a generic ephemeral
  refusal or a public-safe operator summary** — never the raw response.

The principle: between live Dixie and the Discord render path sits the
Phase 37C classifier plus a final no-leak scan; nothing raw, private,
debug, or upstream-error-shaped survives to the ephemeral operator
response.

---

## J. Lazy-load / network boundary

Future Phase 41B implementation must:

- **evaluate Discord enabled / guild / operator gates before
  importing / calling the live Dixie client** — the `enabled`,
  `guild`, and `operator` checks run first, and only an allowlisted
  operator in the configured guild on an enabled command reaches the
  live path;
- **make no live Dixie request on disabled, wrong-guild, non-operator, or
  empty-allowlist paths** — every refused path returns the generic
  ephemeral refusal with zero network egress;
- **keep all live network egress isolated to the Phase 37C live Dixie
  client or a narrow wrapper around it** — Discord code must not open its
  own HTTP path to Dixie; the only egress is through
  `live-dixie-client.ts`;
- **preserve tests proving refused paths do not call Dixie** — tests must
  assert that disabled / wrong-guild / non-operator / empty-allowlist
  invocations perform no network call and never import / invoke the live
  client;
- **preserve the existing `/recall-wedge-demo` static guard that it never
  imports live Dixie** — the Phase 39B handler's static guard (in
  `recall-wedge-demo.test.ts`) stays intact; the harness demo must remain
  provably harness-only even after the live command exists.

The principle: the live client is loaded / called **after** the Discord
gates pass, never before — so a refused invocation is indistinguishable
from the harness demo's refusal and touches no network.

---

## K. Logging and diagnostics boundary

Future Phase 41B:

- **no secrets in logs** — no tokens, service credentials, app / guild /
  command / user IDs;
- **no raw Dixie payloads in Discord output** — only the narrowed,
  no-leak-scanned summary reaches the operator;
- **safe operator diagnostics only if they contain no IDs / secrets /
  private fields** — stable reason codes are fine; raw upstream text,
  identifiers, and payloads are not;
- **public-facing refusal remains generic** — the same single generic
  ephemeral refusal posture the harness command uses; the refusal never
  reveals which gate tripped or why Dixie refused;
- **logs must not claim production auth / consent** — the live command is
  an operator/dev spike, not a consent system; log language must not
  imply otherwise;
- **errors should be classified with stable safe reason codes, not raw
  upstream messages** — map to the Phase 37C classification vocabulary
  (§I) and emit the code, not the upstream string / stack / payload.

---

## L. What Phase 41A proves / does not prove

**Proves:**

- only the **next decision boundary is selected** — a separate
  `/recall-wedge-live-demo` command under strict gates is the chosen
  shape for any future live-Dixie Discord work;
- **live Dixie-backed Discord recall may be explored only through a
  separate command and strict gates** — never by mutating the harness
  demo, never freeform, never public-channel-visible;
- the **existing harness demo remains intact** — `/recall-wedge-demo`
  stays exactly what Phase 39E accepted and Phase 40B documented.

**Does not prove:**

- live Dixie works from Discord;
- production recall;
- production auth / consent;
- public rollout;
- public channel-visible recall;
- memory admission;
- storage / admission;
- Telegram / private chat;
- LLM / voice;
- generalized agent memory solved.

---

## M. Future Phase 41B acceptance criteria

If Phase 41B happens, it must include:

- **a separate command implementation** (`/recall-wedge-live-demo`) **or a
  decision not to implement;**
- a **separate registration gate** (`RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS`
  + `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID`, guild-scoped only, never
  global);
- a **separate invocation gate** (`RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`
  + `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID` +
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`);
- **strict guild / operator / ephemeral behavior** on every path;
- **lazy import / call after gates** — no live client import / call
  before the Discord gates pass (§J);
- **fixed / finite input only** — a fixed deterministic request shape or a
  finite pre-reviewed enum (§H);
- **no freeform query;**
- **no Discord history input;**
- **live Dixie client integration only through the allowed seam** — the
  Phase 37C client or a narrow wrapper around it (§J);
- **response narrowing / classification** before any render (§I);
- a **no-leak scan** over the final Discord output (§I);
- **fail-closed unknown / error paths** (§I);
- **tests / static guards** for: refused paths make no network call; the
  command imports the live client only on the post-gate path; no freeform
  query path exists; no Discord history is read; the no-leak scan holds
  against contaminated responses; `/recall-wedge-demo`'s never-imports-live
  static guard still passes;
- **no source modifications outside the narrow implementation files** (the
  new live command handler / its registration / its tests — and not
  `recall-wedge-demo.ts`, `render-public-recall.ts`,
  `dixie-envelope-adapter.ts`, or the Phase 38A harness);
- **no package / lockfile changes unless justified** by a concrete named
  blocker;
- **no production claims.**

---

## N. Future Phase 41C smoke-test acceptance, if Phase 41B happens

- If Phase 41B is implemented, the next acceptance should be **Phase
  41C.**
- Phase 41C should be a **smoke-test acceptance report similar to Phase
  39E** (`docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md`).
- It should **record live registration / invocation evidence with
  redacted IDs / secrets** — guild-scoped registration with no global,
  operator-gated ephemeral output, non-operator fail-closed.
- It should **record success and fail-closed behavior** — a successful
  narrowed live result on the served path, and fail-closed behavior on
  unknown-shape / error / refusal / non-operator paths.
- It should **not include screenshots / raw IDs / tokens.**
- It should **not authorize public rollout** — Phase 41C is acceptance of
  the controlled live demo only, not a launch.

---

## O. Blocked work remains blocked

The following remain explicitly blocked. **None is authorized by Phase
41A** (this carries forward the Phase 40A §I / Phase 39E §J / runbook §D
blocked-work list, plus the items Phase 41A's own scope bars):

- mutation of `/recall-wedge-demo` into a live command;
- public channel-visible recall;
- global registration;
- production / public rollout;
- freeform recall query input;
- Discord message history as memory input;
- memory admission;
- candidate-memory writes;
- "remember this";
- Telegram;
- private chat;
- storage / admission;
- production auth / consent;
- direct Finn runtime / audit wiring beyond existing seams;
- LLM rewriting;
- character voice;
- public renderer expansion;
- positive `public_telegram` support;
- positive `authorized_private_session` support.

If a later phase needs any item above, it must propose a phase naming the
item, the proof obligation it carries, and the decision artifact it
re-opens. Phase 41A authorizes none of them, and a future Phase 41B is
explicitly barred from all of them (§F).

---

## P. Acceptance criteria for Phase 41A

Phase 41A is acceptable if:

- the **decision doc is added** (this file);
- the **decision map is updated** with a targeted Phase 41A addendum
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **live Dixie client gate is updated or cross-referenced**
  (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` gains a Phase 41A note);
- the **internal guide is updated or cross-referenced if useful**
  (`docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` gains a Phase 41A
  note);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs** are committed;
- **Phase 41B is only authorized as a future gated slice**, not
  implemented;
- **Phase 41A implements nothing.**

---

## Q. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; records that this gate's separate
  `/recall-wedge-live-demo` command served a seeded recall under every
  §F–§K boundary, accepted as a controlled dev/operator proof; §A.5
  records its note.
- `docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; selects a seeded
  dev/operator estate as the next MVP need toward a safe served live
  recall while preserving this gate's live-command shape and gates; §A.4
  records its note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; the redacted report for the controlled
  live-Dixie Discord run (safe wiring + fail-closed, no served recall);
  §A.3 records its acceptance note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the governing procedure the Phase 41D
  run followed.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, its env config, and its
  classification vocabulary; gains a Phase 41A note.
- `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` — Phase 40A
  post-smoke-test decision gate; gains a Phase 41A note.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` — Phase 40B internal
  demo guide; gains a Phase 41A note.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the harness-demo evidence; the Phase 41C
  template.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing register / enable / invoke /
  disable / remove procedure.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  controlled-surface decision gate; the authority that defined the
  posture.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the harness backing the current demo.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  gains a Phase 41A addendum.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  harness handler and env gates (unchanged by Phase 41A; not mutated by a
  future Phase 41B).
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests, including the never-imports-
  live-Dixie guard (unchanged by Phase 41A).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — Phase
  37C operator/dev-only live Dixie client (unchanged by Phase 41A; the
  only allowed live seam for a future Phase 41B).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests (unchanged by Phase 41A).
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  — Phase 37C operator/dev-only runner (unchanged by Phase 41A).
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`
  — Phase 37C runner regression tests (unchanged by Phase 41A).
