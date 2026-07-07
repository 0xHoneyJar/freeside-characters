# Recall Wedge — Multi-Surface Harness Acceptance

> **Phase 38B** (docs / audit / acceptance only). Companion to
> `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A
> live-boundary decision),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint),
> `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E cross-repo
> request / handoff),
> `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A
> reconciliation),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate), and
> `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` (Phase 37D
> multi-surface boundary gate; the gate Phase 38A cleared).
>
> This document is an **acceptance checkpoint**. It does not implement
> code, it does not authorize real Discord / Telegram / private-chat
> surfaces, it does not authorize production storage, admission,
> consent, Finn audit wiring, LLM rewriting, character-voiced recall
> output, public renderer expansion, or live Dixie calls inside the
> Phase 38A harness. It accepts Phase 38A as the fixture/injected-result
> multi-surface Recall Wedge boundary harness and authorizes only a
> future Phase 39A decision phase — not implementation — about whether
> to design a controlled public/dev-only Discord surface.
>
> No source / test / package / lockfile / fixture JSON / config / CI /
> generated changes are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the live-boundary
> decision, the readiness checkpoint, the cross-repo request, the Phase
> 37A reconciliation, the Phase 37B live Dixie client gate, and the
> Phase 37D multi-surface boundary gate — do not silently expand scope
> from this acceptance.

---

## A. Status and decision

Phase 38B is **docs / audit / acceptance only**.

- It accepts **Phase 38A** as the fixture/injected-result multi-surface
  Recall Wedge boundary harness.
- It does not add or authorize real Discord, Telegram, private chat,
  storage / admission, public renderer expansion, live Dixie calls,
  LLM rewriting, or character voice.
- It does not modify Phase 38A harness source or tests.
- It does not invoke or modify the Phase 37C live Dixie client.
- It does not add direct Finn runtime / audit wiring.
- It authorizes only a future **Phase 39A decision phase** about
  whether to design a controlled public/dev-only Discord surface.

### A.1 Decision sentence

**Phase 38B accepts Phase 38A as the fixture/injected-result
multi-surface Recall Wedge boundary proof and authorizes only a future
Phase 39A decision gate for a controlled public/dev-only Discord
surface; it does not authorize Discord implementation, Telegram,
private chat, storage/admission, public renderer expansion, LLM
rewriting, or character voice.**

This acceptance is conditional on the boundaries restated in §G
(remaining blocked work), §H (Phase 39A decision-gate shape), and §I
(Phase 39A non-authorization). Partial compliance does not satisfy this
acceptance.

---

## B. Source evidence

This acceptance is grounded in the following artifacts:

- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` — Phase 37D
  multi-surface boundary gate; the gate that authorized Phase 38A and
  defined its scope, surface taxonomy, allowed and disallowed behavior,
  and harness acceptance criteria.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — Phase 38A harness module; consumes injected /
  `LiveDixieRecallResult`-shaped values and emits the per-frame
  projection / refusal matrix.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`
  — Phase 38A harness regression tests; binds every claim in §C below
  and the §H acceptance criteria of the Phase 37D gate to assertions.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A post-MVP
  option matrix and decision gates; §5a Discord command operational
  gates; Phase 37B / 37D addenda governing the next implementation
  phase.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the basis on which Phase 37C was authorized; the gate
  Phase 37C cleared.

Phase 38A added exactly two files (the harness module and its test
file). No other source, test, fixture, package, lockfile, config, CI,
or generated file was changed by Phase 38A. Phase 38B adds no source,
test, fixture, package, lockfile, config, CI, or generated file at all.

---

## C. What Phase 38A proves

Phase 38A's harness and tests prove all of the following, mechanically,
with deterministic evidence already shipped in this repo:

- **one shared continuity actor / one shared recall result, multiple
  frames** — a single `(continuity_actor_id, recall_result)` value is
  evaluated across every frame in the surface taxonomy;
- **the required six-frame taxonomy exists** — `operator_dev`,
  `public_discord_simulated`, `public_telegram_simulated`,
  `authorized_private_session_simulated`, `private_chat_simulated`, and
  `character_frame_public` are all modeled by the harness, matching
  the Phase 37D §F taxonomy;
- **`operator_dev` receives operator-safe / internal diagnostic
  projection** — operator output includes operator-safe classification
  details and operator-only diagnostic context, partitioned the same
  way Phase 37C's runner partitions output;
- **`public_discord_simulated` receives deterministic public-safe
  output or refusal** — output is strictly inside the public-safe
  allowlist used by `render-public-recall.ts`, and refusals follow a
  stable shape;
- **`public_telegram_simulated` fails closed** — the harness asserts a
  stable refusal shape; no positive billboard is produced; no
  Telegram-specific renderer is created;
- **`authorized_private_session_simulated` fails closed** — the harness
  asserts a stable refusal shape; no positive private DTO is produced;
  no production private renderer is created;
- **`private_chat_simulated` is taxonomy-only / unimplemented /
  fail-closed** — the frame is represented by the harness but does not
  become live integration; no transport, no identity binding, no
  consent capture;
- **`character_frame_public` is deterministic public-safe / referral-
  style only** — any positive output is allowlist-bound and
  referral-style (boundary-referral) or empty; no model is invoked;
  no persona-styled prose is emitted;
- **raw / private / debug / source / operational IDs do not appear in
  public-bound or operator-public outputs** — `session_id`,
  `message_id`, `session_thread_id`, `tenant_id`, `community_id` (and
  camelCase aliases), and the same banned-substring posture used by
  the Phase 33B no-leak validator and `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`
  are scanned against every public-bound frame's output;
- **the no-leak proof is non-vacuous** — contaminated values are
  present in the harness's *input*, so the absence of those values in
  the *output* is a real boundary assertion, not a tautology against an
  empty input;
- **identical output across all surfaces is rejected** — the harness
  asserts the projection matrix is non-degenerate; if every frame
  returns the same output, the proof has collapsed and the test fails;
- **the harness contains no network, no live-client, no Discord, no
  Telegram, no storage, no LLM, no Finn, no `@loa/dixie`, and no
  `@loa/straylight` integration** — these are blocked by static guards
  and by the harness's own self-contained shape (no external imports
  in the harness source).

---

## D. What Phase 38A does not prove

Phase 38A's harness must not be marketed (in code comments, in PRs,
in operator output, or in docs) as proving any of the following.
These are **out of scope** for the harness and remain in scope for
later, separately authorized phases:

- Discord command UX;
- Discord bot permissions;
- Discord guild / channel visibility;
- Discord kill-switch / operational gates;
- Telegram support of any kind;
- private chat support of any kind;
- real Dixie reachability;
- real service-token validity;
- production auth / consent;
- live memory admission;
- storage (Postgres canonical, vector index, object storage, Redis,
  candidate-memory paths, admitted-memory paths);
- real user comprehension of public billboards or refusal text;
- production readiness of any surface.

If a later phase needs proof of any item above, it must propose a
phase that *names* the proof it intends to deliver and the gates it
must clear; it must not stretch the Phase 38A harness to cover that
ground.

---

## E. Audit assessment

The Phase 38B audit answers the following questions and accepts the
answers below.

- **Scope** — only two files were added by Phase 38A:
  `multi-surface-recall-harness.ts` and
  `multi-surface-recall-harness.test.ts`. No other source, test,
  fixture JSON, package manifest, lockfile, config, CI, or generated
  file was changed.
- **Harness boundary** — the harness module is self-contained: no
  imports from the live Dixie client, the recorded Dixie envelope
  adapter, the public renderer, the Discord delivery path, the
  Telegram path, any storage layer, any LLM client, or the
  persona-engine compose path. The harness consumes injected /
  `LiveDixieRecallResult`-shaped values constructed locally.
- **Surface taxonomy** — all six required frames in Phase 37D §F are
  modeled: `operator_dev`, `public_discord_simulated`,
  `public_telegram_simulated`, `authorized_private_session_simulated`,
  `private_chat_simulated`, and `character_frame_public`.
- **Input / output** — input is a local
  `LiveDixieRecallResult`-shaped value without importing the live
  client. Output is a structured per-frame projection / refusal matrix
  consumable by tests.
- **Frame behavior** — each frame matches the Phase 37D §F contract:
  `operator_dev` receives operator-safe / internal diagnostic
  projection; `public_discord_simulated` receives deterministic
  public-safe output or refusal; `public_telegram_simulated` fails
  closed; `authorized_private_session_simulated` fails closed;
  `private_chat_simulated` is taxonomy-only / unimplemented /
  fail-closed; `character_frame_public` is deterministic public-safe /
  referral-style only.
- **No-leak** — a banned-substring scanner runs against every
  public-bound frame's output, using the same posture as the Phase
  33B no-leak validator and `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`.
  Contaminated values are placed in the input so the no-leak proof is
  non-vacuous.
- **Non-degenerate matrix** — a uniform / identical-output-across-all-
  surfaces matrix is rejected by an explicit harness assertion.
- **Static guards** — blocked imports and blocked primitives (live
  client invocation, network primitives, Discord / Telegram / storage
  / LLM modules) are guarded by tests.
- **Regression safety** — Phase 37C live client and runner regressions
  remain green; recorded Dixie envelope adapter and runner regressions
  remain green; the Phase 33C public renderer regressions remain green.
  Phase 38A neither mutates these modules nor changes their tests.

The audit verdict is **ACCEPT**. No required patch was identified by
the audit pass. No Phase 37D §G / §H constraint was found to be
violated.

---

## F. Validation evidence

Recorded validation results for Phase 38A (verified at acceptance
time):

- **fixture validator** (`node docs/recall-wedge/fixtures/validate-fixtures.mjs`)
  — 122 passed, 0 failed.
- **Phase 38A harness tests**
  (`bun test packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`)
  — 52 passed, 0 failed, 806 `expect()` calls.
- **Phase 37C live client / runner regressions**
  (`live-dixie-client.test.ts` + `run-live-dixie-recall-demo.test.ts`)
  — 104 passed, 0 failed, 437 `expect()` calls.
- **recorded Dixie regressions**
  (`dixie-envelope-adapter.test.ts` + `run-dixie-envelope-demo.test.ts`)
  — 215 passed, 0 failed, 700 `expect()` calls.
- **public renderer regressions**
  (`render-public-recall.test.ts`) — 30 passed, 0 failed, 77
  `expect()` calls.
- **`git diff --check`** — clean.
- **Codex audit** — ACCEPT, no required patch.

These are the validation results that justify the §A.1 decision
sentence. They do not establish anything in §D (what Phase 38A does
not prove).

---

## G. Remaining blocked work

The following remain explicitly blocked by Phase 38B. None may be
introduced inside Phase 39A; each is gated on a later, separately
authorized phase:

- **Discord command wiring** for Recall Wedge (any guild, any
  visibility);
- **Telegram bot wiring** (any chat type, any visibility);
- **private chat integration** (any transport, any identity binding,
  any consent capture);
- **public renderer expansion** beyond the current
  `render-public-recall.ts` contract (any additional surface,
  additional fields, or loosened minimization);
- **positive `public_telegram` support** (renderer, DTO, or fixture);
- **positive `authorized_private_session` support** (renderer, DTO,
  or fixture);
- **live Dixie calls inside the Phase 38A harness** (Phase 37C remains
  the only live Dixie seam, and the harness does not call it);
- **production storage / admission** (Postgres, vector index, object
  storage, Redis, candidate-memory paths, admitted-memory paths);
- **live memory admission** as a side effect of any harness or
  surface code path;
- **"remember this" from public chat** (no public-chat-driven
  candidate-memory promotion);
- **production auth / consent implementation** (no identity binding,
  no consent capture, no signer authority, no cross-user access);
- **direct Finn runtime / audit wiring**;
- **LLM rewriting** of recall output (no model invocation by the
  harness or any surface);
- **character-voiced recall summaries** (no persona-styled prose
  generated from recall results);
- **production rollout** of Recall Wedge.

If a later phase needs any item above, it must propose a phase naming
the item, the proof obligation it carries, and the decision artifact
it re-opens.

---

## H. Phase 39A decision-gate shape

**Phase 39A is the next allowed phase. Phase 39A is a decision /
gate phase, not implementation.** Phase 39A may decide whether to
authorize a future **Phase 39B** tightly gated dev-only Discord
command for Recall Wedge.

Phase 39A must answer at least the following questions before
authorizing any Phase 39B implementation:

- **surface visibility** — is the Discord surface dev-only, guild-only,
  operator-only, or public-visible?
- **command name** — what command name (and namespace, if any) is
  allowed?
- **kill switch / env gate** — what env var or config gate is required
  to disable the command without redeploy?
- **delivery shape** — is output ephemeral or channel-visible?
- **input source** — does the command consume fixture / injected
  harness output, Phase 37C live client output, or both? If both, what
  separates the two paths and which is the default?
- **renderer path** — what exact renderer path is allowed (today
  `render-public-recall.ts` is the only public-safe renderer; Phase
  39A must name what is in scope and what is not);
- **banned output fields** — what banned output fields remain blocked
  (raw reasons, debug payloads, private identifiers, actor identifiers,
  operational IDs, hidden estate material), confirming the §C / §D
  boundaries continue to hold;
- **auth / consent claim not being made** — what auth / consent claim
  is explicitly *not* being made by the dev-only command (no
  production authorization, no production consent capture, no
  cross-user access);
- **logs / diagnostics** — what operator logs and diagnostics are
  safe to emit, with the same redaction posture as Phase 37C's runner;
- **validation / static guards** — what tests and static guards Phase
  39B must include (harness regression, no-leak scan, banned-import
  guards, kill-switch behavior under disabled state);
- **rollback / removal path** — what rollback or removal path exists
  if the dev-only command must be retracted (env-flag-off, command
  de-registration, code revert).

These questions are the floor, not the ceiling. Phase 39A may add
further gates; it may not relax the §G blocked-work list.

---

## I. Phase 39A non-authorization

**Phase 38B does not authorize Phase 39B implementation.**

- Phase 39A itself must be a decision / gate phase, not implementation.
- **No Discord command code may be added until Phase 39A is merged
  and explicitly authorizes Phase 39B.** Phase 38B's authorization
  ends at "Phase 39A may decide" — it does not extend to "Phase 39B
  may implement."
- Phase 39A must satisfy every item in §H before authorizing Phase
  39B; partial compliance does not authorize Phase 39B.
- Telegram, private chat, storage / admission, Finn audit wiring,
  LLM rewriting, and character-voiced recall output remain later,
  separately authorized phases. Each is gated on its own decision
  artifact.

If a draft of Phase 39A finds it cannot answer §H without first doing
implementation, the answer is to defer Phase 39A — not to relax the
gate.

### I.1 Phase 39A addendum — first controlled Discord surface shape decided

> Added by Phase 39A
> (`docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md`).
> Targeted addendum to the Phase 39A decision-gate section, not a
> rewrite.

Status as of Phase 39A:

- **Phase 39A decides the first controlled Discord surface shape.**
  It answers every §H question of this acceptance doc and tightens
  the §5a Discord command operational gates of
  `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` for the dev-only
  Discord demo command.
- **Phase 39A authorizes future Phase 39B only as
  dev-only / guild-scoped / operator-invoked / ephemeral /
  harness-backed.** The chosen command name is
  `/recall-wedge-demo`. Phase 39B is gated on
  `RECALL_WEDGE_DISCORD_DEMO_ENABLED="true"` plus a guild-ID
  allowlist plus an operator-user-ID allowlist; registration is
  gated on `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true"`
  and is guild-scoped only.
- **Phase 39A does not authorize live Dixie-backed Discord recall
  or public rollout.** Phase 39B may render only the Phase 38A
  harness output (`public_discord_simulated` frame plus optional
  no-leak-scanned per-frame outcome summary). It may not invoke
  the Phase 37C live Dixie client. It may not produce
  channel-visible, DM, follow-up, webhook, or scheduled output.
  It may not admit memory, accept "remember this" intent, invoke
  any LLM, or render character voice.
- **Telegram, private chat, storage / admission, production
  auth / consent, public renderer expansion, LLM rewriting, and
  character voice remain blocked** per §G of this acceptance doc
  and §N of the Phase 39A gate.

This addendum does not relax §C–§I of this acceptance doc. It
records that the Phase 39A decision point §H of this doc named has
landed and that Phase 39B is now constrained to the shape Phase 39A
defined.

---

## J. Updated ladder

The Recall Wedge phase ladder, restated in light of Phase 38B:

- **Phase 38A** — multi-surface harness implemented (landed; this
  acceptance covers it).
- **Phase 38B** — multi-surface harness accepted (this doc).
- **Phase 39A** — decide whether to authorize a controlled
  public/dev-only Discord surface for Recall Wedge. Decision / gate
  phase only; subject to §H above and to the post-MVP decision map
  §5a Discord command operational gates.
- **Phase 39B** — implement a tightly gated dev-only Discord command
  **only if** Phase 39A explicitly authorizes it. Scope and gates
  defined by Phase 39A; nothing in Phase 38B pre-authorizes any
  Discord command code.
- **Telegram, private chat, storage / admission, Finn audit wiring,
  LLM rewriting, and character-voiced recall output remain later,
  separately authorized phases.** Each is gated on its own decision
  artifact (multi-surface contract §5a / §7e / §8a / §10; readiness
  checkpoint §6; post-MVP decision map §6 / §7; the live-Dixie client
  gate §D).

---

## K. Acceptance criteria for Phase 38B

Phase 38B is acceptable if:

- the **new acceptance doc is added** (this file);
- the existing post-MVP decision map
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`) gains a **targeted
  Phase 38B addendum** stating that Phase 38A is merged and accepted,
  that the multi-surface proof is now accepted, that Phase 39A may
  decide whether to authorize a tightly gated dev-only Discord
  surface, and that real Discord implementation, Telegram, private
  chat, storage / admission, and voice remain blocked;
- the existing multi-surface boundary gate
  (`docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md`) gains a
  **targeted Phase 38B addendum** stating that Phase 38A implemented
  the harness, that Phase 38B accepts the harness, that the next
  allowed step is the Phase 39A decision gate only, and that no Phase
  39B implementation is authorized by Phase 38B;
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made by Phase 38B;
- the docs clearly **accept Phase 38A** as the fixture/injected-result
  multi-surface Recall Wedge boundary harness;
- the docs clearly **authorize only Phase 39A decision**, not
  implementation;
- the docs clearly **block real surfaces** (Discord, Telegram,
  private chat, storage / admission, public renderer expansion, live
  Dixie calls inside the harness, Finn, LLM, character voice).

---

## L. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A post-MVP
  option matrix and decision gates; gains a Phase 38B addendum.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` — Phase 35C
  multi-surface contract; surface taxonomy; authorized-private session
  contract; Discord public contract; Telegram contract; surface-
  specific output rules; future-renderer warning; Dixie / Recall
  Wedge envelope relationship; memory admission boundary.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` — Phase 36A
  live-boundary decision.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` — Phase 36D
  readiness checkpoint.
- `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 36E cross-repo
  request / handoff.
- `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — Phase 37A
  reconciliation against Dixie Phase 32E / 32F.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live
  Dixie client gate; the gate Phase 37C cleared.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` — Phase 37D
  multi-surface boundary gate; gains a Phase 38B addendum.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  (Phase 38A) — multi-surface harness module.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`
  (Phase 38A) — multi-surface harness regression tests.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts`
  — Phase 33C public-safe renderer; not mutated by Phase 38A or 38B.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  — Phase 35D recorded Dixie envelope adapter; not mutated by Phase
  38A or 38B.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts`
  (Phase 37C) — operator/dev-only live Dixie client; not invoked by
  the Phase 38A harness; not mutated by Phase 38B.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  (Phase 37C) — operator/dev-only live Dixie runner; not invoked by
  the Phase 38A harness; not mutated by Phase 38B.
