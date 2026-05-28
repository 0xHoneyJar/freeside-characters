# Recall Wedge — Multi-Surface Boundary Gate

> **Phase 37D** (docs / decision / implementation-contract only).
> Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A
> live-boundary decision),
> `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint),
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E cross-repo
> request / handoff),
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A
> reconciliation), and
> `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate; the basis on which Phase 37C was authorized).
>
> This document is a **gate decision**. It does not implement a
> multi-surface harness, it does not authorize real Discord / Telegram
> / private-chat surfaces, and it does not authorize production
> storage, admission, consent, Finn audit wiring, LLM rewriting, or
> character-voiced recall output. It accepts Phase 37C as the
> operator/dev-only live Dixie seam and redirects the next MVP proof
> toward a fixture/injected-result multi-surface boundary harness.
>
> No code, package, lockfile, fixture JSON, validator, adapter, runner,
> live-client, Discord interaction wiring, Telegram bot wiring, command
> registration, live Dixie / Straylight / Finn integration, production
> storage, live memory admission, positive `authorized_private_session`
> projection, `authorized_private_session` renderer, `public_telegram`
> renderer, LLM/voice rewrite, character voice, or CI/generated-file
> changes are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the
> live-boundary decision, the readiness checkpoint, the cross-repo
> request, the Phase 37A reconciliation, and the Phase 37B live Dixie
> client gate — do not silently expand scope from this gate.

---

## A. Status and decision

Phase 37D is **docs / decision / implementation-contract only**.

- It accepts **Phase 37C** as the operator/dev-only live Dixie seam.
- It does not add live surface integration.
- It does not add Discord / Telegram / private-chat integration.
- It does not authorize production storage / admission.
- It does not authorize public renderer expansion.
- It does not authorize positive `public_telegram` or
  `authorized_private_session` support.
- It does not authorize LLM rewriting or character-voiced recall
  output.
- It redirects the next implementation step toward a
  fixture/injected-result multi-surface boundary harness.

### A.1 Decision sentence

**Phase 37D accepts Phase 37C as the operator/dev-only live Dixie
seam and redirects the next MVP proof toward a fixture/injected-result
multi-surface Recall Wedge boundary harness before any real Discord,
Telegram, private-chat, storage/admission, public renderer, or
character-voice integration.**

This decision is conditional on the boundaries restated in §I
(blocked work) and the implementation contract in §G (required
Phase 38A shape). Partial compliance does not satisfy this gate.

---

## B. Why not real surfaces yet

The product context for Phase 37D:

- There is **no ready private chat surface** through Dixie. The
  authorized-private-session contract remains unimplemented and
  fail-closed; no production private-renderer DTO, no production
  identity binding, no production consent capture exists.
- There is **no Telegram surface**. There is no Telegram bot, no
  Telegram identity binding, no Telegram-side authorization, no
  Telegram-aware renderer. `public_telegram` remains fail-closed at
  the adapter and renderer.
- The **public Discord surface is not yet optimized or gated**.
  No live Recall Wedge command is registered, the operational gates
  in `RECALL-WEDGE-POST-MVP-DECISION-MAP.md` §5a have not been
  satisfied, and there is no controlled visibility / kill-switch /
  ephemerality model in production code.

Building real surfaces now would mix surface infrastructure
(Discord client, Telegram client, private chat transport), bot
permissions, UX, identity / auth, consent, and the **continuity-
boundary proof** itself. That mix is what the Recall Wedge ladder
has consistently refused: it folds high-risk decisions into a
single change and makes the boundary proof unreviewable.

The next proof must isolate the core invariant of the Recall Wedge:
**the same continuity actor / same underlying recall result, when
projected into different surface frames, must produce different
allowed views and different refusal behaviors — and producing
identical output across all surfaces is itself a failure.**

That invariant is testable today, with no real surfaces, by a
fixture / injected-result harness. Real surface integration only
adds risk, not proof, until the invariant is bound by code.

---

## C. What simulation can prove

A fixture/injected-result multi-surface harness can legitimately
prove all of the following:

- **same continuity actor** — one shared continuity-actor identity is
  carried into every frame's evaluation;
- **same underlying recall result / event** — one shared
  `LiveDixieRecallResult`-shaped value (injected; not fetched) drives
  every frame's projection;
- **multiple interface / surface frames** — the harness models a
  taxonomy of frames (operator, public Discord, public Telegram,
  authorized private session, private chat, public character frame)
  that a single recall result must traverse;
- **different allowed projections per frame** — each frame has a
  declarative projection / refusal contract distinct from the others;
- **public-safe output where allowed** — frames that *do* render
  output (operator, public Discord, public character) emit only
  values inside the existing public-safe allowlist;
- **fail-closed behavior where unsupported** — frames that are not
  authorized in V0 (`public_telegram`, `authorized_private_session`)
  surface a stable refusal, not partial output;
- **no raw / private / debug / source leakage** — operator-public,
  public Discord, and public character frames do not contain banned
  raw / private / debug / source / actor-identifier substrings;
- **operational IDs are not treated as governed memory identity** —
  `session_id`, `message_id`, `session_thread_id`, `tenant_id`, and
  `community_id` (and camelCase aliases) are operational, not
  memory, identity in every frame;
- **no LLM rewriting** — the harness does not invoke any LLM, and
  no frame's output is generated by a model;
- **no character voice** — the harness does not produce
  character-styled recall summaries;
- **identical output across all surfaces is a failure** — the
  harness asserts that the projection matrix is non-degenerate; if
  every frame returns the same output, the proof has collapsed and
  the test fails.

These are all properties of the **boundary**. They do not require
a real Discord client, a real Telegram bot, a real private chat
surface, or a real production deployment of Dixie.

---

## D. What simulation cannot prove

The Phase 38A harness must not be marketed (in code comments, in
PRs, in operator output, or in docs) as proving any of the
following. These are **out of scope** for the harness and remain
in scope for later, separately authorized phases:

- **Discord command UX** — slash command shape, ephemerality,
  permission checks, guild scoping, kill-switch wiring, real
  user comprehension;
- **Telegram bot transport** — Telegram-side identity, Telegram
  bot framework integration, Telegram chat-type handling, Telegram
  rate-limit posture;
- **private chat identity** — production identity binding,
  per-chat authorization, end-user consent capture for private
  recall;
- **real Dixie deployment reachability** — whether the Dixie
  service is up, whether DNS resolves, whether the route returns
  on a real wire (Phase 37C is the operator/dev seam that touches
  this — and only at operator/dev level);
- **real service token validity** — whether the freeside-side
  service credential is accepted by the live Dixie deployment;
- **production user consent** — whether end-users have consented
  to recall, what consent record exists, how revocation works;
- **production authorization** — the signer / authority / cross-
  user access model for governed memory recall;
- **latency / rate-limit behavior** — real-world request timing,
  cap-exceeded behavior under contention, retry storms;
- **live memory admission** — admission of new memory as a side
  effect of recall, candidate-memory pipelines, signer / consent
  / receipt records;
- **storage** — the canonical store, vector index, blob store,
  Redis, retention windows;
- **real user comprehension** — whether the public billboard or
  refusal text is understandable, accessible, or useful to actual
  users in the wild.

If a later phase needs proof of any item above, it must propose a
phase that *names* the proof it intends to deliver and the gates
it must clear; it must not stretch the simulation harness to cover
that ground.

---

## E. Current proof levels

The Recall Wedge proof ladder, restated in light of Phase 37D:

### Level 1 — fixture proof

- Recorded memory / recall material proves the renderer's no-leak
  behavior, the deterministic public-safe billboard, the cross-
  interface continuity demo, and the recorded Dixie envelope adapter.
- **Already completed** through Phases 33A–36C and the Phase 37A
  reconciliation against Dixie Phase 32E / 32F.

### Level 2 — simulated multi-surface proof

- The same continuity actor / same recall result is projected into
  different surface frames; each frame has its own allowed view or
  refusal contract; identical output across frames fails the test.
- **Not yet built. Next target: Phase 38A (per §G below).**

### Level 3 — operator live seam

- A dev/operator-only client can call Dixie
  `POST /api/recall/intake` and classify / narrow the response into
  a local `LiveDixieRecallResult`-shaped value safely, with
  fail-closed behavior on missing env, unknown response shapes, and
  service-auth-vs-user-auth distinctions.
- **Completed by Phase 37C** under the Phase 37B gate.

### Level 4 — controlled public surface

- A future dev-only Discord command (or equivalent controlled
  surface) renders fixture / injected output through the same
  multi-surface boundary the harness proves. Subject to the §5a
  Discord operational gates in the post-MVP decision map and to a
  dedicated decision artifact.
- **Not yet authorized.**

### Level 5 — production surface

- Real users, production consent / auth, production storage /
  admission, revocation / forgetting, monitoring, abuse controls.
- **Not authorized.**

Phase 37D explicitly authorizes only the move from Level 1 + Level
3 to Level 2. Levels 4 and 5 remain gated on later, separately
authorized phases.

---

## F. Surface frames to model in Phase 38A

Phase 38A's multi-surface harness should model at least the
following frames. Names are recommended; if Phase 38A picks
different names, the **boundary semantics** in this section must be
preserved.

### F.1 `operator_dev`

- May use Phase 37C live client result shape (`LiveDixieRecallResult`)
  or injected / fake `LiveDixieRecallResult`-shaped values.
- May see operator-safe classification details and
  internal/operator-only diagnostic sections, partitioned the same
  way Phase 37C's runner partitions them.
- Still no secrets / raw private payload dumping; raw refusal text
  and raw debug payloads are sanitized before they reach operator
  output, per Phase 37B §E.2 and the Phase 33B no-leak posture.
- The harness does **not** call the live Dixie client; it constructs
  injected / fake result values directly.

### F.2 `public_discord_simulated`

- May receive deterministic public-safe billboard / refusal output
  through fixture / injected projections, using the same
  public-safe allowlist as `render-public-recall.ts`.
- **No real Discord API / command.** No `discord.js` import, no
  command registration, no webhook send, no message dispatch.
- Output is a value the harness can inspect, not a side effect.

### F.3 `public_telegram_simulated`

- **Must fail closed.** The harness asserts that this frame
  surfaces a stable refusal (e.g. the existing
  `public_telegram_projection_not_implemented` shape, or its named
  equivalent) and does not produce a positive billboard.
- No real Telegram client, no Telegram bot framework, no Telegram
  renderer expansion.
- This frame is a **negative proof obligation**, not a future
  positive surface in V0.

### F.4 `authorized_private_session_simulated`

- **Must fail closed** until production authorization and the
  authorized-private renderer DTO gate
  (`RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` §5a) are independently
  satisfied. Phase 37D does not satisfy that gate.
- The harness asserts a stable refusal (e.g. the existing
  `authorized_private_projection_not_implemented` shape, or its
  named equivalent), not a positive private DTO.
- No production private renderer is created.

### F.5 `private_chat_simulated`

- May be **represented in taxonomy only**. The harness lists this
  frame, declares its current posture (no real private chat
  surface yet, no Dixie-backed private chat path), and either
  fails closed or is explicitly marked unimplemented.
- No real private chat transport, no private-chat identity binding,
  no production consent capture.

### F.6 `character_frame_public`

- May redirect (per the existing character-boundary-referral
  fixture) or render deterministic public-safe output strictly
  inside the public-safe allowlist.
- **No LLM rewriting** — the frame does not invoke any model.
- **No character-voiced memory summary** — the frame does not
  emit persona-styled prose generated from the recall result.
  Voiceless data billboards or referral output only, per the
  boundary doc §12 and the post-MVP decision map §3 Option F.

---

## G. Required Phase 38A implementation shape

The **next code phase** authorized by this gate is:

> **Phase 38A — Multi-Surface Recall Projection Harness.**

### G.1 Recommended files (Phase 38A)

- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — the harness module; consumes injected / fake
  `LiveDixieRecallResult`-shaped values and / or recorded fixture
  projections; defines surface-frame contracts; emits a structured
  per-frame projection / refusal matrix consumable by tests.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`
  — harness regression tests; binds every claim in §C (what
  simulation can prove) and §H (acceptance criteria) to assertions.

Optional, only if clearly useful:

- `docs/recall-wedge/multi-surface-harness.md` — operator-readable
  notes on how the harness is invoked and what its output means.
  Optional; the test file should be self-explanatory.

If Phase 38A picks different file names, it **must preserve the
boundaries**: a single harness module, a single test file that
binds the matrix, no live network calls, no real surface
integrations, and no reuse of the recorded-fixture adapter or the
live-Dixie client as the harness's transport.

### G.2 Allowed Phase 38A scope

Phase 38A **may**:

- be a **fixture / injected-result harness**;
- consume **injected / fake `LiveDixieRecallResult`-shaped values**
  (constructed in tests or local fixtures, not fetched);
- consume **recorded fixture projections** if they help bind a
  frame's contract (e.g. reusing the existing public-safe
  projected DTOs as positive cases for `public_discord_simulated`
  or `character_frame_public`);
- define **deterministic surface-frame contracts** that name each
  frame, its allowed projection (or refusal), and its banned
  outputs;
- emit a structured **expected output / refusal matrix** keyed by
  `(continuity_actor, recall_result_id, surface_frame)`;
- run **no-leak scanning** on every public-bound frame's output,
  using the same banned-substring posture as `render-public-recall.ts`
  and the Phase 33B no-leak validator;
- assert that **different surfaces do not all receive identical
  output** (the matrix is non-degenerate);
- include **fail-closed tests** for `public_telegram_simulated` and
  `authorized_private_session_simulated`;
- include **operational-ID tests** asserting that `session_id`,
  `message_id`, `session_thread_id`, `tenant_id`, and `community_id`
  (and camelCase aliases) never appear in any public-bound frame's
  output.

### G.3 Disallowed Phase 38A scope

Phase 38A **must not**:

- make **live Dixie calls** (no network, no `fetch`, no live
  client invocation; the live client from Phase 37C is not invoked
  by the harness);
- import or call the **Discord API** or any `discord.js` /
  persona-engine Discord delivery code path;
- import or call any **Telegram API**, bot framework, or Telegram
  renderer;
- add **private chat integration** (no transport, no identity
  binding, no consent capture);
- import or call any **storage / admission** code path (Postgres,
  vector index, object storage, Redis, candidate-memory paths,
  admitted-memory paths);
- import or call any **LLM** client (Claude Agent SDK, Anthropic
  SDK, persona-engine compose path);
- emit **character voice** or persona-styled output;
- expand the **public renderer** beyond purely local deterministic
  test-only projection; if any new projection is added it must be
  explicitly non-production, isolated to the harness, and
  reviewed under the post-MVP decision map's renderer constraints;
- modify **`package.json`** or lockfiles, add runtime
  dependencies, or alter CI configuration.

If Phase 38A finds itself reaching for any disallowed item above,
it has crossed this gate's boundary and must re-open the
appropriate decision artifact (post-MVP decision map for surface
gates; live-Dixie client gate for live network; multi-surface
contract for renderer / DTO expansion) before proceeding.

---

## H. Harness acceptance criteria for Phase 38A

Phase 38A's tests must prove all of the following. These are the
acceptance bar for Phase 38A; Phase 37D is acceptable as a docs
phase regardless of when Phase 38A lands.

- **One shared continuity actor / result, multiple frames.** A
  single `(continuity_actor_id, recall_result)` pair is evaluated
  across every frame in the taxonomy.
- **`operator_dev` returns internal/operator-safe details.**
  Operator-section output includes classification details and
  diagnostic context, partitioned the same way Phase 37C's runner
  partitions output. Public-bound sections of the operator output
  contain no banned substrings.
- **`public_discord_simulated` returns public-safe deterministic
  output only.** Output is strictly inside the public-safe allowlist
  used by `render-public-recall.ts`; no banned raw / private /
  debug / source substrings.
- **`public_telegram_simulated` fails closed.** A stable refusal
  shape; no positive billboard; no Telegram-specific renderer.
- **`authorized_private_session_simulated` fails closed.** A stable
  refusal shape; no positive private DTO; no production private
  renderer.
- **`private_chat_simulated` does not become live integration.**
  Either fail-closed or marked unimplemented; no transport, no
  identity, no consent.
- **`character_frame_public` does not use LLM voice.** Any positive
  output is deterministic, allowlist-bound, and referral-style
  (boundary-referral) or empty; no model is invoked.
- **No banned raw / private / debug / source material in public
  outputs.** Every public-bound frame's output is grepped against
  the same banned-substring posture used by the Phase 33B no-leak
  validator and `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`.
- **Operational IDs are not treated as memory identity.**
  `session_id`, `message_id`, `session_thread_id`, `tenant_id`, and
  `community_id` (and camelCase aliases) never appear in any
  public-bound frame's output.
- **Identical output across all surfaces is a failure.** The
  harness asserts the projection matrix is non-degenerate: at
  least two frames in the matrix produce distinguishably different
  outputs (or one renders and another fails closed); a degenerate
  matrix fails the test.
- **`recorded_dixie_recall_envelope` remains fixture / probe-only
  and is not live traffic.** Tests assert the harness does not
  treat the recorded probe kind as live traffic (per Phase 37A §3
  / Phase 37B §J).
- **No network calls.** Tests assert no `fetch`, no live client
  invocation, no real Discord / Telegram / private-chat transport
  occurs during harness execution.

---

## I. Blocked work

The following remain explicitly blocked by Phase 37D. None may be
introduced inside Phase 38A; each is gated on a later, separately
authorized phase:

- **real Discord command wiring** for Recall Wedge (any guild,
  any visibility);
- **Telegram bot wiring** (any chat type, any visibility);
- **private chat integration** (any transport, any identity
  binding, any consent capture);
- **live Dixie calls inside the Phase 38A harness** (Phase 37C
  remains the only live Dixie seam, and the harness does not call
  it);
- **public renderer expansion for production** (any additional
  surface, additional fields, or loosened minimization beyond the
  current `render-public-recall.ts` contract; purely local
  deterministic test-only projection inside the harness is the
  only allowed exception, and it must remain explicitly
  non-production);
- **positive `public_telegram` support** (renderer, DTO, or
  fixture);
- **positive `authorized_private_session` support** (renderer,
  DTO, or fixture);
- **production storage / admission** (Postgres, vector index,
  object storage, Redis, candidate-memory paths, admitted-memory
  paths);
- **live memory admission** as a side effect of any harness or
  surface code path;
- **"remember this" from public chat** (no public-chat-driven
  candidate-memory promotion);
- **production auth / consent implementation** (no identity
  binding, no consent capture, no signer authority, no cross-user
  access);
- **direct Finn runtime / audit wiring**;
- **LLM rewriting** of recall output (no model invocation by the
  harness or any surface);
- **character-voiced recall summaries** (no persona-styled prose
  generated from recall results);
- **general public rollout** of Recall Wedge.

If a later phase needs any item above, it must propose a phase
naming the item, the proof obligation it carries, and the decision
artifact it re-opens.

---

## J. Relationship to Phase 37C

Phase 37D is complementary to Phase 37C, not a substitute or an
expansion:

- **Phase 37C remains the only live Dixie seam.** No other module
  in the repo calls Dixie. The Phase 37C live client and runner
  remain operator/dev-only and are not invoked by the harness.
- **Phase 38A uses injected / fake `LiveDixieRecallResult`-shaped
  values, not live network calls.** The harness constructs result
  values directly in tests / local fixtures; the live client is
  not a dependency of the harness.
- **Phase 37C proves live client transport / classification at
  operator/dev level.** It binds the network / auth / idempotency
  / classification boundary to code.
- **Phase 38A proves multi-surface projection boundaries.** It
  binds the per-frame projection / refusal contract to code.
- **These are complementary proof layers, not substitutes.** A
  live-client passing tests does not imply correct multi-surface
  projection; a multi-surface harness passing tests does not imply
  a working live-client. Both are required before any controlled
  public surface (Level 4) is even discussable.

---

## K. Future phase ladder

The recommended sequence after Phase 37D:

- **Phase 38A** — implement the fixture/injected-result
  multi-surface recall projection harness, per §G–§H above.
- **Phase 38B** — audit / accept the multi-surface harness. Docs /
  acceptance phase reviewing the Phase 38A harness: did the
  taxonomy cover every frame in §F; did the matrix pass; did the
  banned-substring scan hold; did the operational-ID assertions
  hold; were any concrete divergences with the multi-surface
  contract found that require renderer-side reconciliation; is the
  harness safe to extend.
- **Phase 39A** — decide first real surface integration, **probably
  dev-only Discord**. A separate decision artifact subject to the
  post-MVP decision map §5a operational gates and to its own
  acceptance criteria.
- **Phase 39B** — implement a tightly gated dev-only Discord
  command **only if** Phase 39A authorizes it. Scope and gates
  defined by Phase 39A; nothing in Phase 37D pre-authorizes any
  Discord command code.
- **Telegram, private chat, storage / admission, Finn audit
  wiring, character voice, and LLM rewriting remain later,
  separately authorized phases.** Each is gated on its own
  decision artifact (multi-surface contract §5a / §7e / §8a / §10;
  readiness checkpoint §6; post-MVP decision map §6 / §7; the
  live-Dixie client gate §D).

---

## L. Acceptance criteria for Phase 37D

Phase 37D is acceptable if:

- the **new gate doc is added** (this file);
- the existing post-MVP decision map
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`) gains a **targeted
  Phase 37D addendum** stating that Phase 37C is merged and accepted
  as the operator/dev-only live Dixie seam, that the next MVP proof
  is a multi-surface boundary simulation / harness rather than real
  surface integration, that Phase 38A should implement the
  fixture/injected-result harness, and that real Discord /
  Telegram / private-chat / storage / admission / voice remain
  blocked;
- the existing live-Dixie client gate
  (`docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`) gains a
  **targeted Phase 37D addendum** stating that Phase 37C
  implemented the live client spike, that Phase 37D accepts it as
  operator/dev-only only, that Phase 37C does not authorize real
  public / private surfaces, and that the next work is the
  multi-surface boundary harness rather than Discord / Telegram /
  private-chat wiring;
- **no source / test / fixture / package / lockfile / config / CI
  / generated changes** are made;
- the docs clearly **accept Phase 37C** as the operator/dev-only
  live Dixie seam;
- the docs clearly **redirect next work** to a fixture/injected-
  result simulation harness;
- the docs clearly **block real surface integrations** (Discord,
  Telegram, private chat, storage / admission, public renderer
  expansion, Finn, LLM, character voice).

---

## M. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates; gains a Phase 37D
  addendum.
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
  36D readiness checkpoint.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 36E
  cross-repo request / handoff.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — Phase 37A
  reconciliation against Dixie Phase 32E / 32F.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live
  Dixie client gate; the gate Phase 37C cleared; gains a Phase 37D
  addendum.
- `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  — Dixie Phase 32E governing route contract.
- `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  — Dixie Phase 32F readiness checkpoint.
- `docs/recall-wedge/fixtures/README.md` — fixture set.
- `docs/recall-wedge/fixtures/validate-fixtures.mjs` — fixture
  validator.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts`
  — Phase 33C public-safe renderer.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  — Phase 35D pure Dixie envelope adapter (recorded fixtures only;
  Phase 38A does not repurpose this as a live transport).
- `packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`
  — Phase 36C dev/operator runner over recorded Dixie envelopes.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts`
  (Phase 37C) — operator/dev-only live Dixie client; not invoked
  by the Phase 38A harness.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  (Phase 37C) — operator/dev-only live Dixie runner; not invoked
  by the Phase 38A harness.
