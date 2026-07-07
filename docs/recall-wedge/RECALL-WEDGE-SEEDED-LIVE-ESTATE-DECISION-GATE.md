# Recall Wedge — Seeded Live Estate / Storage Decision Gate

> **Phase 42A** (docs / decision gate only). Date: 2026-05-30. Companion
> to
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` (Phase
> 41D smoke-test acceptance — the safe-live-failure result this gate
> builds on),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`
> (Phase 41C operational runbook — the controlled procedure the served
> proof would reuse),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` (Phase 41A
> live-Dixie Discord decision gate — the authority that scoped the
> separate live command),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate — the live client seam, its env, and its classification
> vocabulary), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix,
> whose §6 live-Dixie-client gates and §7 live-memory-admission gates
> still govern any seeding / storage work this gate points toward).
>
> This document is a **decision gate**. It selects the next meaningful
> proof boundary after Phase 41D: how to get from a **safe live failure**
> (the live command reached Dixie and fail-closed on an unseeded estate)
> to a **safe served live recall** — using a **seeded dev/operator live
> estate / storage fixture**, not user chat ingestion and not production
> memory admission. It decides the safe future *shape* of that work. It
> does **not** implement it.
>
> It does not seed any estate. It does not add storage, an adapter, a
> migration, a script, a CLI command, Discord behavior, or production
> auth. It does not change `/recall-wedge-live-demo` or
> `/recall-wedge-demo`. It does not authorize production memory admission,
> public recall, or public channel-visible recall. It adds no Telegram /
> private chat / LLM / character voice / public renderer expansion. If a
> step seems to require reaching past those boundaries, the answer is to
> open the separate later gate that owns it — not to relax it from this
> decision.

---

## A. Status and decision

Phase 42A is **docs / decision gate only**.

- Phase 42A **follows Phase 41D** (the controlled live-Dixie Discord
  smoke-test acceptance, merged via PR #145).
- It **does not implement seeded live estate / storage.** No source,
  test, package, lockfile, fixture, config, CI, or generated change is
  introduced by Phase 42A.
- It **does not seed any estate**, add any adapter / migration / seed
  script / CLI command, or change any Discord behavior.
- It **does not change `/recall-wedge-live-demo`** (handler,
  registration, dispatch, render path, or tests).
- It **does not change `/recall-wedge-demo`** (the harness demo).
- It **does not authorize production memory admission.**
- It **does not authorize public recall** or **public channel-visible
  recall.**
- It **does not claim served live recall is proven** — that proof is the
  *target* of a future phase, not a result of this one (§E, §K).
- It **does not add** candidate-memory writes, "remember this," Discord
  message-history ingestion, Telegram, private chat, storage / admission
  UI, production auth / consent, cross-user auth / consent, LLM
  rewriting, character voice, or public renderer expansion.

### A.1 Decision sentence

**Phase 42A authorizes only a future seeded-live-estate / storage
design / implementation lane for controlled dev / operator smoke — a
tightly scoped, reviewed, deterministic seed of a dev/operator live
estate so the live `/recall-wedge-live-demo` path can prove a *safe
served live recall result* — and does not authorize production memory
admission, candidate-memory writes, Discord chat ingestion, cross-user
auth / consent, or public recall.**

This authorization is conditional. It selects the next decision
boundary only — it does not implement the seed lane, and it does not
pre-approve any future PR. A future seeded-estate phase (referred to
below as **Phase 42B**) carries its own scope (§G), its own seed
constraints (§F), its own required acceptance criteria (§H), and remains
subject to the decision-map §6 (live Dixie client gates) and §7 (live
memory admission gates). Everything Phase 41A / 41C / 41D blocked stays
blocked here (§L).

### A.2 Naming note (binding for this document)

- **"Freeside Characters"** is the current Discord app / this repo / the
  Railway project and service that runs the bot. The current bot
  identity is **"loa."**
- **"Dixie"** is the deployed recall-intake service the live command
  reaches (`POST /api/recall/intake`).
- **"Straylight"** is the memory / continuity substrate behind Dixie —
  the authority that would hold a seeded estate and return a governed
  recall result.
- **"Finn"** (`loa_finn`) is an upstream Dixie depends on for a healthy
  overall state. Finn integration is **outside this gate** (§I, §L); a
  seeded served-recall proof does not require, and does not claim, a
  healthy Finn.
- The bare word **"Freeside"** is **not** used here to name the current
  app. **"Freeside platform"** is reserved for the future broader
  platform and is out of scope for this gate.

### A.3 Phase 42D note — the seeded lane this gate selected has been served and accepted (controlled dev/operator proof)

> Added by Phase 42D
> (`docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`),
> 2026-05-31.

- **The seeded-estate lane this gate authorized (§A.1, §M.a) has been
  exercised and accepted as served (docs-only).** It resolved across the
  substrate boundary as: Dixie-side seeding (direct Dixie Phase 32K v4b
  seeded smoke) + Freeside Characters Phase 42B (safe pre-Dixie gate
  diagnostics) + Phase 42C (seeded request / signature alignment),
  accepted as Phase 42D. Read this gate's "future Phase 42B" as realized
  by that sequence.
- **The accepted target proof of §E was delivered.** The controlled
  operator `/recall-wedge-live-demo` path reached live Dixie with the
  Phase 42C seeded-aligned request, Dixie read the seeded dev/operator
  estate, Straylight returned a governed served result classified
  `served`, and Freeside Characters rendered only the ephemeral
  operator-safe `classification` / `outcome` / `route` / `reason` lines
  with no raw / private / debug / source material — exactly the §E target
  and §H acceptance criteria.
- **No §F seed constraint was relaxed.** The seed remained a reviewed
  deterministic dev/operator fixture admitted through a Straylight-owned
  path — not user chat ingestion, not production admission, not candidate
  writes, not cross-user, not public-channel-visible. The direct Dixie
  precondition confirmed a pack and receipt present and raw reasons absent;
  no pack / receipt / raw-reasons body was reproduced in Discord or in any
  doc.
- **Nothing this gate blocked is unblocked.** Everything in §L remains
  blocked. Phase 42D makes **no** production-memory, production-admission,
  durable-storage, user-chat-ingestion, or public-recall acceptance claim;
  it accepts a controlled dev/operator seeded live recall only. Its
  recommended next step is a **docs-only Admission Wedge decision gate**,
  not production rollout.

### A.4 Phase 43A note — the Admission Wedge is the next wedge after the seeded recall this gate enabled was accepted

> Added by Phase 43A
> (`docs/recall-wedge/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`),
> 2026-05-31.

- **This gate's seeded lane proved the read/recall half; Phase 43A selects
  the write/admission half as the next wedge.** The seeded dev/operator
  estate this gate authorized (§A.1) was served and accepted (Phase 42D,
  §A.3). Phase 43A reads that as: recall is proven for seeded / already-
  admitted continuity, so the **Admission Wedge MVP** — how a candidate
  *becomes* admitted continuity through an explicit governed transition — is
  the next product wedge.
- **Phase 43A is docs / decision gate only.** It implements no admission;
  it adds no source, test, command, Dixie route, Straylight store, seed, or
  memory write. Its core invariant: **candidate memory is not admitted
  memory, and a candidate is not recallable as governed continuity until an
  explicit admission transition accepts it.** It does not authorize
  production admission, public remember-this, Discord history ingestion, or
  a full production Straylight architecture.
- **This gate's seed constraints (§F) anticipate the boundary.** §F already
  bars candidate-memory admission, "no raw → candidate → admitted flow" on
  the *recall* side; the Admission Wedge is the separately gated place where
  a controlled dev/operator candidate → admitted transition may eventually
  be *designed* — under decision-map §7, never by relaxing this gate.
  Everything in §L of this gate remains blocked.

---

## B. Source evidence

This decision gate is grounded in the following artifacts. **These
source / test files are evidence only; Phase 42A modifies none of
them.** No new code path is introduced or authorized here.

Decision-doc / acceptance / runbook evidence:

- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; records that the authenticated live intake
  reached the Straylight seam and returned `seam.storage_unavailable`
  (unseeded live estate / storage), classified `upstream_unavailable`
  and rendered fail-closed. Its §J names the unseeded estate / storage as
  the current blocker for served recall, and its §N.d offers "design a
  seeded live estate / storage path" as a next option. Gains a Phase 42A
  note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the controlled register / enable /
  invoke / fail-closed / disable / evidence procedure a served-recall
  proof would reuse unchanged, plus the §R.1 operational caveats (§I).
  Gains a Phase 42A note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; scoped the separate `/recall-wedge-live-demo` command,
  its env gates (§G), input boundary (§H), output boundary (§I),
  lazy-load boundary (§J), and logging boundary (§K), all of which a
  served-recall proof must preserve. Gains a Phase 42A note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config and the classification
  vocabulary the rendered output narrows into.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  Option D (production storage / admission design) and §7 (live memory
  admission gates) and §6 (live Dixie client gates) are the standing
  gates this lane stays inside. Gains a Phase 42A addendum.

Source / test evidence (read only; **Phase 42A modifies none of
these**):

- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  Phase 41B live command handler. Source of the env gates, the fixed
  deterministic input, the lazy live-client load only after the Discord
  gates pass, the classification → render decision, the single generic
  refusal string, the ephemeral-only response builder, and the final
  banned-substring no-leak scan. A served-recall proof exercises this
  path unchanged.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  Phase 37C operator/dev-only live Dixie client; the only live-egress
  seam, the `POST /api/recall/intake` route, and the classification
  vocabulary (`served`, `denied_or_forbidden`, `needs_review`,
  `ingress_invalid_request`, `service_unauthorized`,
  `tenant_or_session_mismatch`, `rate_limited`, `upstream_unavailable`,
  `unsupported_response_shape`, `network_error`, plus the pre-network
  classes `missing_required_env`, `invalid_config`,
  `unsafe_idempotency_key_reuse`). A served-recall proof needs only the
  `served` classification to begin appearing — no new classification is
  required.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests.

State clearly:

- these source / test files are **evidence only**;
- **Phase 42A modifies none of them**;
- Phase 42A introduces no new source, test, fixture, package, lockfile,
  config, CI, or generated file.

---

## C. Proven state before Phase 42A

The Recall Wedge ladder is accepted through Phase 41D. Summarized so a
future reader does not re-derive it:

- **Phase 37C proved an operator/dev-only live Dixie client seam.** The
  live client and its runner call Dixie's `POST /api/recall/intake`,
  classify the response into a narrow local result type, and partition
  operator output. They are the only live Dixie seam in the repo.
- **Phase 41A selected the separate-command shape.** Live-Dixie Discord
  work must use `/recall-wedge-live-demo`, never mutate the harness
  `/recall-wedge-demo`, under disabled-by-default / guild-scoped /
  operator-gated / ephemeral gates.
- **Phase 41B implemented `/recall-wedge-live-demo`** (PR #137):
  disabled-by-default, guild-scoped-only registration, operator-gated,
  ephemeral-only, fixed deterministic input, no options, lazy live-client
  load only after the Discord gates pass, classification → safe summary
  render, final no-leak scan, generic fail-closed refusal.
- **Phase 41C documented the controlled operational procedure** for the
  live command (register / enable / invoke / fail-closed / disable /
  remove / evidence-capture), redacted placeholders only.
- **Phase 41D accepted a controlled live-Dixie Discord smoke test** (PR
  #145, 2026-05-30). A human operator deployed Dixie live (Railway,
  healthy service + Postgres, `GET /api/health` → 200), wired the
  **Freeside Characters** service with the live Dixie env, registered
  `/recall-wedge-live-demo` to one configured guild, and invoked it as an
  allowlisted operator. The authenticated intake reached the Straylight
  seam and returned `seam.storage_unavailable`; the command classified it
  as `upstream_unavailable` and rendered an ephemeral operator-safe
  summary with **no raw reasons, no raw payload, no IDs / tokens / tenant
  / debug material**.
- **Phase 41D proved the pipe, not served recall.** It proved live
  command wiring, Dixie reach, the auth path (unauthenticated `401`,
  valid short-lived token `200`), fail-closed classification, and no-leak
  Discord rendering. It explicitly **did not prove served recall** — the
  live estate / storage state is unseeded, so the seam fail-closed
  (acceptance §J).

The standing position after Phase 41D: **the pipe works; served live
recall memory is still not proven.** The blocker is the unseeded live
estate / storage state.

---

## D. Why seeded live estate / storage is the next MVP need

- **Phase 41D proves safe live failure.** The end-to-end controlled path
  — operator invokes `/recall-wedge-live-demo` in the configured guild →
  the gated handler lazily loads the Phase 37C client → the client
  authenticates to live Dixie → Dixie reaches the Straylight seam → the
  seam reports storage unavailable → the result is classified
  `upstream_unavailable` → Discord renders an ephemeral operator-safe
  summary with no leak — is demonstrated and accepted. The failure was
  the *designed, safe* failure, not a defect.
- **MVP still needs a safe served live recall result.** A safe failure is
  necessary but not sufficient. The remaining MVP question is whether the
  same controlled path can, against a real live estate, return a
  **governed non-empty recall result** and render only public/operator-
  safe fields — i.e. prove `served`, not only `upstream_unavailable`.
- **The current blocker is unseeded live estate / storage.** The seam
  fail-closed *because there is nothing to recall*. Until a small,
  reviewed, deterministic memory exists in a dev/operator live estate,
  the served path cannot be exercised — no amount of command-registration
  or token-lifetime work changes that.
- **Therefore the next meaningful MVP step is a seeded dev/operator live
  estate / storage fixture**, not command-registration hardening and not
  service-token hardening. Those are operational irritants (§I) that
  improve repeatability; they do not move the proof from "safe failure"
  to "safe served recall." Seeding does.
- **Seeded live memory must be a reviewed operator/dev fixture, not user
  chat ingestion.** The seed is a deliberate, code-reviewed, deterministic
  assertion (or a few) placed into one narrowly scoped dev/operator
  estate — never Discord history, never "remember this," never arbitrary
  user writes, never the production admission pipeline. The point is to
  prove *recall* against governed memory, not to open an admission path.

---

## E. Accepted target proof (served live recall)

The proof a future seeded-estate phase must aim to deliver — and which
Phase 42A authorizes the lane toward, without delivering it here — is:

1. **Controlled operator invocation reaches live Dixie.** The live
   `/recall-wedge-live-demo` command (or an equivalent controlled
   operator path) is invoked by an allowlisted operator in the configured
   guild, passes the Discord gates, lazily loads the Phase 37C client, and
   the client calls live Dixie at `POST /api/recall/intake` — the same
   wiring Phase 41D already accepted.
2. **Dixie reads from a seeded live estate.** Instead of fail-closing on
   an empty estate, Dixie reads a seeded dev/operator estate containing
   the reviewed deterministic assertion(s).
3. **Straylight returns a governed non-empty recall response.** The
   substrate returns a governed, non-empty served recall result (or an
   equivalent served recall result), classified `served` by the Phase 37C
   classifier — not `upstream_unavailable` / `seam.storage_unavailable`.
4. **Freeside Characters renders only public / operator-safe fields.**
   The handler narrows the result through the Phase 37C classifier and the
   final no-leak scan and renders an **ephemeral** operator-safe summary
   (the fixed dev framing plus `classification` / `outcome` / `route` /
   `reason` and only allowlisted served fields).
5. **No raw / private / debug / source material leaks.** The rendered
   output contains no `raw_reasons`, no raw Dixie payload, no
   bounded-store scope detail, no tenant / debug material, no JWT / token
   / service-token material, no stack traces, no private identifiers, and
   no raw assertion IDs.

This is a **served live recall** proof: the same fail-closed-safe pipe,
now returning safe served content from a seeded estate. It is **not**
production recall, **not** public recall, **not** cross-user recall, and
**not** memory admission — it is a controlled dev/operator demonstration
that the served path is safe when there is something governed to recall.

---

## F. Seed constraints

A future seeded-estate phase may seed live memory only under **all** of
the following constraints:

- **one dev/operator estate, or a single narrowly scoped fixture
  estate** — not a shared production estate, not a multi-tenant estate,
  not an arbitrary user's estate;
- **one or a few reviewed deterministic assertions** — a small, fixed,
  code-reviewed set whose recall output is predictable; not a corpus, not
  scraped content, not generated-at-runtime memory;
- **no arbitrary user memory writes** — the seed is authored and reviewed
  by an operator/dev, never accepted from end users;
- **no Discord history ingestion** — no message / channel content is read
  into the seed or into any recall input;
- **no candidate-memory admission** — the seed is a reviewed fixture, not
  a candidate-review / promotion pipeline; no raw → candidate → admitted
  flow is opened;
- **no production storage / admission UI** — no operator-facing admission
  console, no "remember this" surface, no end-user write path;
- **no cross-user sharing** — the seeded estate is reachable only by the
  controlled operator/dev caller; no Person B reads Person A's memory;
- **no public-channel-visible recall** — every recall stays ephemeral /
  operator-gated, exactly as Phase 41D requires;
- **no LLM rewriting or character voice rewriting** — the served summary
  is the deterministic narrowed render, never a persona-voiced or
  model-rewritten paraphrase.

The principle: the seed is the **minimum governed memory** needed to make
the *recall* path return `served` safely — a reviewed dev/operator
fixture, scoped as narrowly as possible, with every Phase 41D boundary
preserved.

---

## G. Allowed future implementation shape (not implemented here)

A future seeded-estate phase **may consider** the following shape. Phase
42A authorizes the *lane*, not the PR — nothing below is implemented or
pre-approved by this gate:

- **a narrow seed mechanism may be considered** — for example a
  fixture / migration / operator script that places the reviewed
  deterministic assertion(s) into the dev/operator estate via a
  Straylight-owned admission path. The mechanism is part of the future
  phase's own design, subject to decision-map §6 and §7.
- **it must be deterministic** — the same seed input produces the same
  estate state and the same `served` recall result every time.
- **it must be reviewed** — the seeded assertion(s) and the seed
  mechanism are code-reviewed before any acceptance; no
  generated-at-runtime or unreviewed memory enters the estate.
- **it must be idempotent and safe to rerun** — running the seed twice
  must not duplicate assertions, must not corrupt the estate, and must not
  silently re-admit; reruns converge to the same state.
- **it must not store secrets in the repo** — no service token, JWT, dev
  wallet, admin / allowlist key, Postgres connection string, or any
  credential is committed.
- **it must not commit live IDs / tokens / URLs / keys** — no live Dixie
  base URL, tenant ID, caller actor ID, request-key prefix, guild / app /
  command / user ID, or Railway identifier appears in the repo; the repo's
  `.env.example` may list variable **names** only.
- **it must include tests / guards before any PR acceptance** — at
  minimum: the seed is deterministic and idempotent under rerun; no
  secret / live ID is committed; the served render still passes the
  no-leak scan; the Phase 41D fail-closed behaviors (no-auth, invalid /
  expired token, unseeded estate) are preserved as regression guards.
- **the Straylight-owned admission boundary holds** — even a dev/operator
  seed is admitted through a Straylight-owned path; Freeside Characters
  does not become the admission authority, the admission record, or the
  canonical store (decision-map §7). Characters remain frames over the
  substrate, not independent estates.

If the future phase finds it cannot seed without opening production
admission, cross-user access, Discord ingestion, or a "remember this"
surface, it has crossed this gate's boundary and must re-open the gate
that owns the item (decision-map §7) before proceeding.

---

## H. Required future acceptance criteria

A future seeded-estate phase is acceptable only if it demonstrates, in a
controlled dev/operator run, that:

- **no-auth still fails closed** — an unauthenticated
  `POST /api/recall/intake` is still rejected (`HTTP 401`), and the
  Discord path never leaks on a no-auth condition;
- **invalid / expired service token still fails closed** — an invalid or
  expired token surfaces as a safe classification (e.g.
  `service_unauthorized`) or the generic refusal, never raw upstream text
  and never a leak;
- **unseeded estate still returns safe failure** — against an empty / not
  -yet-seeded estate, the seam still fail-closes (`upstream_unavailable` /
  `seam.storage_unavailable`) exactly as Phase 41D accepted; seeding adds
  the served case without removing the safe-failure case;
- **seeded estate returns a safe served recall / governed recall
  result** — against the seeded dev/operator estate, the same controlled
  path returns a `served` classification with governed non-empty content;
- **Discord output is ephemeral / operator-gated and leak-free** — every
  response is ephemeral, reachable only by an allowlisted operator in the
  configured guild, and passes the final no-leak scan;
- **non-operators still get the generic refusal** — a non-operator (or a
  disabled / wrong-guild / empty-allowlist path) still receives the single
  generic ephemeral refusal, with no served content and no indication of
  which gate tripped;
- **no leak in the served output** — the served Discord output contains
  **no** `raw_reasons`, raw Dixie payload, bounded-store scope detail,
  tenant / debug material, JWT / token / service-token material, stack
  traces, private identifiers, or **raw assertion IDs**.

The acceptance must be a redacted docs-only smoke-test report (the Phase
41D / Phase 39E template): redacted operator observations only, no
screenshots, no raw IDs / tokens / payloads.

---

## I. Operational caveats inherited from Phase 41D

These caveats from the Phase 41D run (acceptance §L, runbook §R.1) are
carried forward. They are **operational irritants for repeating the
smoke test, not the main MVP blocker** — the main blocker is the unseeded
estate (§D), which is why seeding is ranked first (§J):

- **startup auto-publish can erase the dev-only live command** — the
  startup auto-publish path bulk-syncs the normal command set and can
  remove `/recall-wedge-live-demo` from the configured guild. For a smoke
  run: register the live command after the restart and do not restart
  Freeside Characters again before invocation (in the Phase 41D run it was
  manually re-registered after restart for exactly this reason). A tiny
  operational patch to make the gated live-command registration survive
  the bulk sync is **registration hardening**, ranked third (§J).
- **the manually minted Dixie JWT is short-lived** — the service token /
  JWT used to reach the seam was manually minted and short-lived. Before
  repeating, refresh the token and restart if it has expired; an expired
  token surfaces as a safe classification or the generic refusal, never a
  leak, but it will not exercise the seam reach. A longer-lived / safer
  dev service-token path is **service-token hardening**, ranked second and
  only if it becomes a hard blocker for repeated smoke (§J).

Neither caveat changes the served-recall question: even with a perfectly
durable command registration and a long-lived token, the seam still
fail-closes until the estate is seeded.

---

## J. Priority ranking

The MVP priority order this gate locks:

1. **Seeded live estate / storage — first.** It is the only item that
   moves the proof from "safe live failure" to "safe served live recall."
   This is the lane Phase 42A authorizes (a future Phase 42B).
2. **Service-token hardening — second, only if needed for
   repeatability.** A longer-lived / safer dev service-token path
   (Phase 41D acceptance §N.e) is secondary; it must remain behind a
   **separate decision** unless it becomes a hard blocker for repeated
   smoke runs (e.g. the short-lived JWT makes the seeded proof
   impractical to reproduce). It is not authorized by this gate.
3. **Command-registration hardening — third.** The tiny operational patch
   so startup auto-publish does not erase the gated dev command (Phase
   41D acceptance §N.c) is operationally useful but lower MVP priority
   than proving served live recall. It must remain behind its **own
   separate decision** and is not authorized by this gate.
4. **Public rollout — remains blocked throughout.** Public recall, served
   memory as a shipped capability, public channel-visible recall,
   production memory admission, and cross-user auth / consent stay blocked
   behind their own separate later gates (§L) regardless of how 1–3
   sequence.

---

## K. What Phase 42A proves / does not prove

**Proves:**

- only the **next MVP boundary is selected** — a seeded dev/operator live
  estate / storage fixture is the chosen next step, ahead of token
  hardening and registration hardening;
- **served live recall may be pursued only through a seeded dev/operator
  fixture under the Phase 41D gates** — never via user chat ingestion,
  never via production admission, never public-channel-visible;
- the **Phase 41D safe-failure result is preserved** — the unseeded-estate
  fail-closed behavior remains the accepted baseline and a required
  regression (§H).

**Does not prove:**

- served live recall works (that is the future target — §E);
- production recall;
- production memory admission;
- public rollout;
- public channel-visible recall;
- cross-user recall authorization / consent;
- candidate-memory admission;
- a healthy Finn integration;
- Telegram / private chat;
- LLM / character voice;
- a long-lived / production-grade Dixie service token;
- durable command registration across restart;
- generalized agent memory solved.

---

## L. Blocked work remains blocked

The following remain explicitly blocked. **None is authorized by Phase
42A** (this carries forward the Phase 41D §K / Phase 41A §O blocked-work
list, plus the items Phase 42A's own scope bars):

- production memory admission;
- candidate-memory writes;
- "remember this";
- arbitrary user memory writes;
- Discord message-history ingestion as memory input;
- live Discord message ingestion;
- freeform recall query input;
- cross-user auth / consent;
- cross-user / Person-B-to-Person-A recall;
- public recall;
- public channel-visible recall;
- served recall memory as a shipped / accepted capability (Phase 42A
  authorizes the *proof lane*, not a capability claim);
- production / public rollout;
- mutation of `/recall-wedge-demo` into a live command;
- global registration;
- production auth / consent;
- production storage / admission UI;
- Telegram;
- private chat;
- direct Finn runtime / audit wiring beyond existing seams;
- LLM rewriting;
- character voice;
- public renderer expansion;
- positive `public_telegram` support;
- positive `authorized_private_session` support.

If a later phase needs any item above, it must propose a phase naming the
item, the proof obligation it carries, and the decision artifact it
re-opens. Phase 42A authorizes none of them; a future seeded-estate phase
is explicitly barred from all of them (§F).

---

## M. Next decision options

Phase 42A itself authorizes none of the following — it only selects the
seeded-estate lane as the next MVP need. Each option carries its own
proof obligation and re-opens its own decision artifact:

- **a. Phase 42B — seeded live estate / storage design or fixture
  spike.** The authorized next lane (§J.1): design and, in a later
  reviewed PR, implement a tightly scoped, deterministic, idempotent
  dev/operator seed (§F, §G) so the live path can prove a safe served
  recall result (§E), with the §H acceptance criteria. Subject to
  decision-map §6 / §7. **Recommended next.**
- **b. Separate token-hardening gate.** A longer-lived / safer dev
  service-token path (§J.2), only if it becomes a hard blocker for
  repeating the seeded smoke. Its own decision artifact.
- **c. Separate command-registration-hardening gate.** The tiny
  operational patch so startup auto-publish does not erase the gated dev
  command (§J.3, Phase 41D §N.c). Its own decision artifact, with its own
  tests / static guards.
- **d. Stop and preserve Phase 41D as safe-failure acceptance.** Treat the
  accepted safe-live-failure result as the resting state and take no
  further live action; public rollout stays blocked (§J.4).

**Recommended:** option **a** (Phase 42B seeded live estate / storage),
with options **b** and **c** sequenced later only under their own gates,
and option **d** as the always-available stop. Phase 42A authorizes none
of them; the next phase is the place to commit to one.

---

## N. Acceptance criteria for Phase 42A

Phase 42A is acceptable if:

- the **decision doc is added** (this file);
- the **decision map is updated** with a targeted Phase 42A addendum
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **Phase 41D acceptance is updated / cross-referenced** with a Phase
  42A note
  (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`);
- the **Phase 41C runbook is updated / cross-referenced** with a Phase
  42A note
  (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`);
- the **Phase 41A gate is updated / cross-referenced** with a Phase 42A
  note (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs / tokens / JWTs / admin keys / service tokens /
  Postgres URLs / live service URLs / Railway IDs** are committed;
- **no raw Dixie response bodies** (including `raw_reasons` detail) are
  pasted;
- **no production rollout claim** and **no served-memory acceptance
  claim** is made;
- **no seeded storage is implemented** — the seed lane is authorized as a
  future phase only;
- **all blocked work remains blocked** (§L).

---

## O. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` —
  Phase 43A Admission Wedge decision gate; selects the Admission Wedge MVP
  (the write/admission half) as the next product wedge after the seeded
  recall this gate enabled was accepted; §A.4 records its note.
- `docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; records the served result of the
  seeded-estate lane this gate selected (Dixie-side Phase 32K seeding +
  Freeside Characters Phase 42B / 42C, accepted as Phase 42D); §A.3
  records its note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; the safe-live-failure result and the
  unseeded-estate blocker this gate builds on; gains a Phase 42A note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the controlled procedure a served-recall
  proof reuses; gains a Phase 42A note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the live-command shape and gates a served-recall proof
  preserves; gains a Phase 42A note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, its env config, and its
  classification vocabulary.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  Option D / §6 / §7 are the standing gates this lane stays inside; gains
  a Phase 42A addendum.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — Phase
  41B live handler, env gates, fixed input, lazy load, render, no-leak
  scan (unchanged by Phase 42A; exercised unchanged by a future seeded
  proof).
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests (unchanged by Phase 42A).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — Phase
  37C live Dixie client; the only live-egress seam and the classification
  vocabulary the served render narrows into (unchanged by Phase 42A).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests (unchanged by Phase 42A).
