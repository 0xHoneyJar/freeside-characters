# Recall Wedge — Post-Acceptance Admission Wedge Decision Gate

> **Phase 43A** (docs / decision gate only). Date: 2026-05-31. Companion
> to
> `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` (Phase 42D
> seeded live Discord smoke acceptance — the accepted controlled
> dev/operator served live recall result this gate builds on, and whose
> Phase 42D §N.b recommended this gate),
> `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` (Phase 42A
> seeded live estate / storage decision gate — the authority that scoped
> the seeded dev/operator estate lane Phase 42D served),
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`
> (Phase 41C operational runbook — the controlled procedure the served
> proof reused, and whose §R.1 operational caveats carry forward),
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` (Phase 41A
> live-Dixie Discord decision gate — the live-command shape and gates the
> Recall Wedge path preserves), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix,
> whose §7 live-memory-admission gates govern everything this gate points
> toward).
>
> This document is a **decision gate**. It selects the next product wedge
> after the Recall Wedge MVP was accepted as served (Phase 42D): the
> **Admission Wedge** — the missing write/admission half of the Recall
> Wedge's read/recall half. It decides *which wedge is next* and the safe
> future *shape* of that wedge's design work. It does **not** implement
> it, and it does **not** authorize a full production memory / admission /
> storage stack.
>
> It adds no source, test, package, lockfile, fixture, config, CI, or
> generated change. It does not add or change any Discord command, any
> Dixie route, any Straylight store, any seed, any admission path, any
> memory write, any "remember this" surface, or any character voice /
> renderer. It does not authorize production admission, public
> remember-this, Discord history ingestion, cross-user consent, or
> production rollout. If a step seems to require reaching past those
> boundaries, the answer is to open the separate later gate that owns it —
> not to relax it from this decision.

---

## A. Status and decision

Phase 43A is **docs / decision gate only**.

- Phase 43A **follows Phase 42D** (the accepted controlled dev/operator
  seeded live recall proof, merged via PR #150).
- It **does not implement an admission wedge.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 43A.
- It **does not add or change any Discord command**, including
  `/recall-wedge-live-demo`, `/recall-wedge-demo`, or any future
  `/remember-this`.
- It **does not add a live Dixie admission route**, a Straylight
  production store, a candidate-memory write, a memory write from
  Discord, or any admission path.
- It **does not authorize production memory admission.**
- It **does not authorize public remember-this**, automatic memory from
  chat, Discord history ingestion, or a full production Straylight
  admission / storage / auth / consent architecture.
- It **does not claim an admission wedge is proven** — that proof is the
  *target* of a future phase, not a result of this one (§F, §O).
- It **does not add** user-facing admission UX, cross-user consent, LLM
  rewriting, character voice admission / rendering, or forget / revoke /
  correction implementation.

### A.1 Decision sentence

**Phase 43A selects the Admission Wedge MVP as the next wedge after
Recall Wedge MVP acceptance, and authorizes only future decision / design
work for a controlled dev/operator admission proof — it does not authorize
production admission, public remember-this, Discord history ingestion, or
a full production Straylight admission / storage / auth / consent
architecture.**

This authorization is conditional. It selects the next product wedge and
its safe design boundary only — it does not implement the admission wedge,
and it does not pre-approve any future PR. A future admission-wedge phase
(referred to below as **Phase 43B**) carries its own scope (§H), its own
taxonomy and invariants (§E, §G), its own required acceptance criteria
(§I), and remains subject to the decision-map §7 (live memory admission
gates). Everything Phase 41A / 41C / 41D / 42A / 42D blocked stays blocked
here (§N).

### A.2 Naming note (binding for this document)

- **"Freeside Characters"** is the current Discord app / this repo / the
  Railway project and service that runs the bot. The current bot identity
  is **"loa."**
- **"Dixie"** is the deployed Recall Wedge service the live command
  reaches (`POST /api/recall/intake`); eventually it would be the service
  route / policy / auth boundary for admission too (§J).
- **"Straylight"** is the memory / continuity substrate behind Dixie — the
  authority that holds an estate and returns a governed recall result, and
  the authority that would eventually own canonical admission / estate /
  receipt semantics (§J). Straylight, not Freeside Characters, owns the
  admission boundary.
- **"Finn"** (`loa_finn`) is an upstream Dixie depends on for a healthy
  overall state. Finn integration is **outside this gate** (§N); an
  admission-wedge proof does not require, and does not claim, a healthy
  Finn.
- The bare word **"Freeside"** is **not** used here to name the current
  app. **"Freeside platform"** is reserved for the future broader platform
  and is out of scope for this gate.
- **"Recall Wedge"** is the accepted read/recall half (recall an
  already-admitted or seeded continuity state). **"Admission Wedge"** is
  the proposed write/admission half (a candidate memory becomes admitted
  continuity state through a governed admission transition). They are two
  bounded wedges, not one production system.

### A.3 Phase ladder reconciliation (read first)

The Recall Wedge ladder is accepted through Phase 42D. Summarized so a
future reader does not re-derive it:

- **Phase 42A** (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`)
  selected a seeded dev/operator live estate as the next MVP need and
  labelled the future seeded-estate lane "a future Phase 42B."
- **The seeded lane resolved across the substrate boundary** as Dixie-side
  seeding (direct Dixie Phase 32K v4b seeded smoke) + Freeside Characters
  Phase 42B (safe pre-Dixie gate diagnostics) + Phase 42C (seeded request
  / signature alignment).
- **Phase 42D** (`docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`,
  PR #150) accepted that sequence as a controlled dev/operator seeded live
  recall: an operator invoked `/recall-wedge-live-demo`, the live client
  reached Dixie, Dixie read the seeded dev/operator estate, Straylight
  returned a governed `served` result, and Freeside Characters rendered an
  ephemeral operator-safe summary with no leak.
- **Phase 43A** — *this* decision gate. Phase 42D §N.b recommended a
  docs-only Admission Wedge decision gate as the next product wedge; this
  document is that gate. It selects the wedge; it does not open admission.

So where Phase 42D §N.b says "open a docs-only Admission Wedge decision
gate," read **this document (Phase 43A)**. This gate is the decision that
precedes admission-wedge design; it is not the design and it is not the
implementation.

---

## B. Source evidence

This decision gate is grounded in the following artifacts. **These source
/ test files are evidence only; Phase 43A modifies none of them.** No new
code path is introduced or authorized here.

Decision-doc / acceptance / runbook evidence:

- `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; the accepted served result this
  gate builds on, and the source of the recommendation (Phase 42D §N.b) to open
  this gate. Gains a Phase 43A note.
- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; the authority that scoped
  the seeded dev/operator estate lane (its §E served target, §F seed
  constraints, §H acceptance criteria) Phase 42D served. Gains a Phase 43A
  note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the controlled register / enable / invoke
  / fail-closed / disable / evidence procedure the served proof reused, and
  the §R.1 operational caveats this gate inherits (§L). Gains a Phase 43A
  note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the separate `/recall-wedge-live-demo` command shape and
  its gates, the read-side primitive an admission wedge's recall-after-
  admission step would reuse unchanged.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config and the classification
  vocabulary the rendered output narrows into.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  §7 (live memory admission gates) is the standing gate an admission wedge
  must satisfy, and §8 (what not to do next) the standing prohibitions it
  must respect. Gains a Phase 43A addendum.

Source / test evidence (read only; **Phase 43A modifies none of these**):

- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  live command handler; the read-side primitive an admission-wedge proof's
  recall-after-admission step would exercise unchanged.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  the live command regression / static-guard tests.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  operator/dev-only live Dixie client; the only live-egress seam and the
  classification vocabulary the served render narrows into.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  the live client tests.

State clearly:

- these source / test files are **evidence only**;
- **Phase 43A modifies none of them**;
- Phase 43A introduces no new source, test, fixture, package, lockfile,
  config, CI, or generated file.

---

## C. Proven state before Phase 43A

The Recall Wedge ladder is accepted through Phase 42D. The standing
position this gate starts from:

- **The Recall Wedge MVP live seeded proof is accepted (Phase 42D, PR
  #150).** A controlled dev/operator path proved that an already-admitted
  or seeded continuity state can be recalled safely through a live Discord
  surface: `/recall-wedge-live-demo` returned `classification = served`,
  `outcome = served`, `route = /api/recall/intake`, `reason = served`;
  Freeside Characters / loa called the live Dixie recall-intake against the
  Phase 32K seeded dev/operator estate; output was guild-scoped,
  operator-gated, ephemeral, and public-safe.
- **What that accepted — and only that.** It accepted controlled
  dev/operator seeded live recall only. It did **not** accept production
  memory admission, user chat becoming memory, remember-this / candidate
  writes, Discord history ingestion, durable production storage, production
  auth / consent, cross-user sharing, public rollout, public-channel
  recall, Telegram / private-chat surfaces, LLM rewriting, character voice
  rendering, or a forget / revoke / correction UI (Phase 42D §H, §K).
- **The proof is read-side only.** The seeded estate was placed by a
  Straylight-owned admission path on the Dixie side (direct Dixie Phase 32K
  v4b seeding) — *not* by anything in this repo, and *not* by an end user.
  The Recall Wedge proved recall; it did not prove how memory comes to
  exist.

The standing position after Phase 42D: **the recall (read) half is proven
for controlled dev/operator seeded continuity; the admission (write) half
is unproven.** The product is not real memory until there is a governed
path for something to *become* memory.

---

## D. Why the Admission Wedge is the next wedge

- **Recall Wedge proves read/recall.** The accepted Phase 42D result shows
  that already-admitted or seeded continuity state can be recalled safely
  through a live Discord surface, narrowed to public/operator-safe fields,
  ephemeral and operator-gated.
- **Admission Wedge is the missing write/admission half.** The Recall Wedge
  recalls memory that *already exists*. It says nothing about how memory
  comes to exist. Until there is a governed path for a candidate to *become*
  admitted continuity state, the product is a reader over a state someone
  else seeded by hand — not memory.
- **The product is not real memory until there is a governed path for
  something to become memory.** "Memory" implies both halves: something can
  be admitted, and something admitted can be recalled. Phase 42D delivered
  the second half for seeded state. The Admission Wedge is the first half.
- **But this must be built as a bounded second wedge, not a giant
  production system.** The temptation after a served recall is to jump
  straight to production Straylight: durable storage, production auth,
  consent, user ingestion, public remember-this. That is not the next step.
  The next step is the *smallest governed admission transition* that can be
  proven safely under dev/operator authority and then recalled through the
  already-accepted Recall Wedge path. Admission is a wedge, not a platform.
- **The Recall Wedge path is the reuse point.** Because recall-after-
  admission reuses the accepted Phase 41B / 42C live command and the Phase
  37C client unchanged, the admission wedge only needs to prove the
  *transition* (candidate → admitted) safely; the recall half is already
  accepted. This is exactly why admission is a bounded next wedge and not a
  rewrite.

---

## E. Core invariant

The load-bearing invariant for any future admission wedge:

> **Candidate memory is not admitted memory. Candidate memory must not be
> recallable as governed continuity until an explicit admission transition
> accepts it.**

Consequences that follow, and that a future admission-wedge phase must
preserve:

- **No implicit promotion.** There is no path by which a candidate becomes
  admitted continuity without an explicit, recorded admission transition.
  Raw → candidate → admitted are distinct states with an explicit gate
  between candidate and admitted (decision-map §7).
- **Candidate is not recallable as governed continuity.** Before the
  admission transition accepts it, a candidate must not surface through the
  Recall Wedge path as governed memory. A candidate that has not been
  admitted is, from the recall surface's perspective, not there.
- **Rejected candidates never become recallable.** A candidate that is
  rejected (or superseded / corrected) must not later surface as admitted
  continuity. Rejection is terminal for that candidate's recallability.
- **The admission transition is the only door.** The transition is
  explicit, governed, authored under dev/operator (or eventually
  consent-backed) authority, and produces an audit record (§G). There is no
  side door — not Discord chat, not history ingestion, not a passive
  listener.

This invariant is doctrine, not a code schema. A future phase implements
it; this gate only fixes it as the rule the implementation may not relax.

---

## F. Proposed Admission Wedge MVP proof

The proof a future admission-wedge phase must aim to deliver — and which
Phase 43A authorizes the lane toward, without delivering it here — is a
controlled dev/operator demonstration of the full admission → recall arc:

1. **A controlled dev/operator candidate memory is created from a
   deterministic source.** A reviewed, deterministic candidate (or a few)
   is produced from a fixed dev/operator source — not from user chat, not
   from Discord history, not generated at runtime.
2. **It is held as candidate only.** The candidate exists as a candidate
   and is **not** recallable as governed continuity (§E). A recall attempt
   against the not-yet-admitted candidate returns the safe not-found /
   fail-closed result, exactly as Phase 41D / 42D fail-closed behavior
   requires.
3. **An explicit operator/dev admission action accepts it.** A deliberate,
   reviewed admission transition — invoked under dev/operator authority,
   not implicit, not automatic — accepts the candidate.
4. **The admitted result becomes governed continuity state.** The accepted
   candidate becomes governed continuity state or a deterministic admitted
   packet / estate update, owned by a Straylight-owned admission path (§J).
   The transition produces an admission receipt / audit event (§G).
5. **Recall Wedge later recalls it safely.** The same accepted Recall Wedge
   path (the Phase 41B / 42C live command + Phase 37C client, unchanged)
   recalls the now-admitted state and classifies it `served`.
6. **Discord / Freeside Characters renders only the safe authorized recall
   summary.** The recall-after-admission output is the same ephemeral,
   operator-gated, narrowed `classification` / `outcome` / `route` /
   `reason` summary Phase 42D accepted — no raw candidate payload, no
   admitted-packet body, no receipt body, no source material, no IDs /
   tokens / debug material.

This is an **admission-then-recall** proof: a candidate that did not exist
as governed continuity becomes admitted continuity through one explicit
governed transition, and is then recalled through the already-accepted
read path. It is **not** production admission, **not** public
remember-this, **not** user-chat ingestion, and **not** a durable
production store — it is a controlled dev/operator demonstration that the
admission transition is safe and that the invariant (§E) holds end to end.

---

## G. Candidate vs admitted taxonomy

Defined at a **decision / product / architecture level** — this is
doctrine for a future design, **not** a code schema and **not** a database
shape. A future admission-wedge design (Phase 43B, §M) owns the concrete
shape; this gate fixes the vocabulary it must use:

- **Candidate memory** — a proposed memory that has been nominated but not
  yet accepted. It is not governed continuity and is **not recallable** as
  such (§E). It may originate only from a reviewed deterministic
  dev/operator source in the MVP wedge.
- **Admitted memory** — a candidate that an explicit admission transition
  has accepted. It is governed continuity state, recallable through the
  Recall Wedge path, and was produced through a Straylight-owned admission
  path.
- **Rejected candidate** — a candidate an admission transition declined.
  It never becomes recallable as governed continuity (§E) and leaves an
  auditable record of who rejected it, when, and why (decision-map §7).
- **Superseded / corrected candidate** — a candidate (or an admitted
  assertion) that a later candidate replaces or corrects. The product must
  define what happens to the prior version's recallability; in the MVP
  wedge this is a doctrine question, not an implemented forget / revoke /
  correction UI (which stays blocked, §N).
- **Admission receipt / audit event** — the verifiable record every
  admission transition produces: that a specific candidate was admitted (or
  rejected), under whose authority, when. Recall renders **none** of this
  raw; it is audit, not public content.
- **Admission source** — where a candidate came from. In the MVP wedge,
  only a reviewed deterministic dev/operator source / fixture. Never
  Discord history, never user chat, never a runtime-generated corpus.
- **Admission authority** — who is allowed to admit. In the MVP wedge,
  synthetic or operator/dev authority only (§K). Never an arbitrary user
  admitting arbitrary memory on anyone's behalf.
- **Visibility / rendering class** — the partition between what is governed
  continuity (recallable, and then only as a narrowed public/operator-safe
  summary) and what is raw / candidate / debug / source / receipt material
  (never rendered to Discord or any public surface). The Recall Wedge's
  no-leak boundary (Phase 41A §I) is the enforcement point; admission must
  not widen it.

The taxonomy exists so a future design starts from a shared vocabulary and
the §E invariant is expressible in it. It deliberately stops short of
field names, table shapes, or API contracts — those belong to Phase 43B's
design, under decision-map §7.

---

## H. Implementation lanes to compare

Four lanes a future admission-wedge phase could take, ranked by safety.
Phase 43A authorizes **none** of them as implementation — it ranks them so
a future phase commits to one under its own gate:

- **Lane A — fixture / operator admission packet lane (safest first).** A
  reviewed deterministic dev/operator candidate packet is admitted through
  a Straylight-owned admission path into a controlled dev/operator estate,
  producing a deterministic admitted packet / estate update and an
  admission receipt; the Recall Wedge then recalls it. No live user
  ingestion, no Discord command for admission, no production store. This is
  the smallest proof of the §E invariant and the §F arc, and is the
  **recommended first lane** for any future admission-wedge phase.
- **Lane B — dev/operator-only explicit candidate command lane (possible
  later).** A dev-only, gated, operator-authority command that creates a
  candidate and (separately) admits it — a `/remember-this`-shaped
  affordance restricted to dev/operator authority. This is **riskier than
  Lane A** because it introduces a command surface for candidate creation;
  it must not be the first lane and must be **separately gated** if pursued
  at all. A dev-only `/remember-this` is a later follow-up, not the MVP
  wedge's starting point.
- **Lane C — automatic Discord chat ingestion lane (blocked).** Treating
  Discord messages, history, or channel content as candidate memory.
  **Blocked** (§N, decision-map §7 / §8). No ambient listening, no
  history-as-memory, no chat becoming memory.
- **Lane D — full production Straylight admission / storage / auth /
  consent lane (blocked for now).** Durable production estate storage,
  production auth, cross-user consent, public remember-this, public
  rollout. **Blocked for now** — this is the platform the wedge is
  deliberately *not* (§D). It is reachable only by satisfying decision-map
  §7 in full under its own much-later gate.

The ranking encodes the thesis of §D: prove the admission transition in
the **smallest, safest** lane (A) first; treat any command surface (B) as a
separately gated follow-up; and hold chat ingestion (C) and full
production (D) blocked.

---

## I. Required future acceptance criteria

A future Admission Wedge MVP is acceptable only if it demonstrates, in a
controlled dev/operator run, **all** of the following:

- **candidate is not recallable before admission** — a recall attempt
  against a not-yet-admitted candidate returns the safe not-found /
  fail-closed result; the candidate does not surface as governed
  continuity (§E);
- **explicit admission transition is required** — the candidate becomes
  admitted only through a deliberate, governed admission action; there is
  no implicit / automatic promotion;
- **admission receipt exists** — the transition produces a verifiable
  admission receipt / audit event (who admitted, when, which candidate);
- **admitted state can be recalled through Recall Wedge** — after
  admission, the same accepted Recall Wedge path recalls the admitted state
  and classifies it `served`;
- **public / Discord rendering remains safe** — every recall response is
  ephemeral, operator-gated, guild-scoped, and passes the no-leak scan;
- **rejected candidates do not become recallable memory** — a rejected (or
  superseded / corrected) candidate never surfaces as admitted continuity;
- **no raw candidate / debug / private material leaks in public render** —
  the recall output exposes no raw candidate payload, no admitted-packet
  body, no receipt body, no admission-source material, no IDs / tokens /
  tenant / debug material, no stack traces, and no private identifiers;
- **no Discord history ingestion unless separately gated** — no message /
  channel content becomes a candidate or an admission source absent its own
  separate gate;
- **no production rollout claim** — the acceptance claims a controlled
  dev/operator admission proof only, not production memory, durable
  production storage, production auth / consent, or public rollout.

The acceptance must be a redacted docs-only report (the Phase 41D / 42D /
39E template): redacted operator observations only, no screenshots, no raw
IDs / tokens / payloads / receipts.

---

## J. Cross-repo boundaries

Discussed at a **decision level** only. Phase 43A authorizes implementation
in **no** repo; it names where responsibility would eventually sit so a
future design does not put it in the wrong place:

- **Straylight** — would eventually own the canonical admission / estate /
  receipt semantics: what a candidate is, what admission means, what an
  admitted packet / estate update is, and what an admission receipt
  records. Straylight is the admission authority and the canonical store;
  Freeside Characters is a frame over it, never the admission record or the
  source of truth (decision-map §7).
- **Dixie** — would eventually own the service route / policy / auth
  boundary for admission, the way it already owns the `POST
  /api/recall/intake` route for recall. An admission route, its policy, and
  its auth boundary are Dixie's to define when a future gate authorizes
  them.
- **Freeside Characters** — would eventually be the live Discord surface /
  controlled operator demo for an admission proof, the way it is the live
  recall surface today. It renders only the safe authorized recall summary;
  it does not become the admission authority, the admission record, or the
  canonical store.

**But do not authorize implementation in any repo in this phase.** This
section is a boundary sketch for a future design, not a work order. A
future admission-wedge phase must re-open the gate that owns the item
(decision-map §7) before any repo implements anything.

---

## K. Posture (storage / consent-auth / public surface)

The standing postures a future admission-wedge phase inherits unchanged:

### K.1 Storage posture

- **Do not jump to full durable production storage.** For the next wedge, a
  fixture or dev/operator **deterministic packet** store may be enough to
  prove the §F arc and the §E invariant.
- **Durable Postgres-backed production estate storage remains later** — it
  is not authorized by this gate and is reachable only under a later gate
  that satisfies decision-map §7 (Postgres canonical, vector index as
  derived retrieval only, never source of truth).

### K.2 Consent / auth posture

- **Cross-user consent and production auth remain blocked.**
- **Admission Wedge MVP uses synthetic or operator/dev authority only.**
- **No claim that arbitrary user memory can be admitted** — the MVP wedge
  admits only reviewed deterministic dev/operator candidates under
  dev/operator authority; it makes no production consent / identity claim.

### K.3 Public surface posture

- **No public-channel output.**
- **No public remember-this.**
- **No automatic memory from chat.**
- **No hidden ambient listening.**
- **No raw candidate payloads in public / Discord output** — every recall
  render stays the narrowed, no-leak, ephemeral operator-safe summary.

---

## L. Operational caveats inherited

These caveats from the Phase 42D run (acceptance §L, runbook §R.1 / §R.3)
carry forward. They are **operational irritants for repeating the
controlled live path**, not the admission-wedge design question — but a
future admission proof that reuses the live recall path will hit them:

- **short-lived Dixie JWT** — the service token / JWT used to reach the
  live seam was manually minted and short-lived; it must be refreshed for
  future demos. An expired token surfaces as a safe classification or the
  generic refusal, never a leak.
- **Dixie allowlist may need re-adding after restart** — the dev wallet
  allowlist in Dixie may be runtime / in-memory and may need re-adding
  after a Dixie redeploy / restart.
- **Freeside command registration can be overwritten by startup
  auto-publish** — the startup auto-publish path can remove the gated
  dev-only live command from the configured guild; the command must be
  (re-)published after a restart, and Freeside Characters should not be
  restarted again between registration and invocation.
- **current live recall proof is dev/operator only** — the accepted Phase
  42D proof is a controlled dev/operator seeded live recall; any admission
  proof that reuses it inherits that scope and may not silently widen it.

None of these changes the admission-wedge question: even with a durable
token, a stable allowlist, and durable command registration, the product
still has no governed write path until an admission wedge proves one.

---

## M. Recommended next phase

- **Recommended next: Phase 43B — Admission Wedge MVP design (docs / design
  only or fixture-design only).** Suggested doc:
  `docs/ADMISSION-WEDGE-MVP-DESIGN.md`. It should:
  - define the **candidate / admission packet shape** and the §G taxonomy
    in concrete (but still design-level) terms;
  - define the **admission transition** (the explicit candidate → admitted
    door) and the **admission receipt / audit event**;
  - define **acceptance tests** (the §I criteria made concrete) **before
    implementation**;
  - prefer **Lane A** (fixture / operator admission packet, §H) as the
    first proof;
  - keep storage at fixture / dev-operator deterministic packet (§K.1);
  - keep authority synthetic / operator-dev only (§K.2);
  - keep every public surface posture (§K.3) intact.
  **Phase 43B must not implement the admission wedge** — it defines the
  candidate / admission packet shape and acceptance tests first; a later
  Phase 43C (or equivalent) would implement Lane A under its own reviewed
  PR and the decision-map §7 gates.
- **Phase 43C and beyond** would be the first reviewed implementation
  (Lane A fixture / operator admission packet), with the §I acceptance
  criteria, only after 43B's design is accepted. A dev-only
  `/remember-this` (Lane B) is a later, **separately gated**, riskier
  follow-up — not 43B, not the MVP wedge's first step.

Prefer a **narrow docs/design or fixture spike first** (Phase 43B) over any
implementation. Do **not** implement the admission wedge in Phase 43A, and
do not let Phase 43B slide into implementation before its design and
acceptance tests are accepted.

---

## N. Blocked work remains blocked

The following remain explicitly blocked. **None is authorized by Phase
43A** (this carries forward the Phase 42D §K / Phase 42A §L / Phase 41A §O
blocked-work lists, plus the items Phase 43A's own scope bars):

- production memory admission;
- source code, tests, or package / lockfile changes in Phase 43A;
- a Discord command implementation (including any `/remember-this`);
- a live Dixie admission route;
- a Straylight production store;
- memory writes from Discord;
- a "remember this" affordance / surface;
- user-facing admission UX;
- automatic memory from chat / chat becoming memory;
- arbitrary user memory writes;
- Discord message-history ingestion as memory or admission source;
- live Discord message ingestion;
- hidden / ambient listening;
- candidate-memory writes (Phase 43A writes none; a future controlled
  dev/operator candidate → admitted transition may only be *designed*
  under its own separate gate, never implemented by this phase);
- freeform recall query input;
- cross-user consent;
- cross-user / Person-B-to-Person-A memory access or sharing;
- public recall;
- public channel-visible recall / output;
- public remember-this;
- public / production rollout;
- durable production / Postgres-backed estate storage;
- production auth / consent;
- a full production Straylight admission / storage / auth / consent
  architecture;
- mutation of `/recall-wedge-demo` or `/recall-wedge-live-demo` into an
  admission command;
- global registration;
- Telegram;
- private chat;
- direct Finn runtime / audit wiring beyond existing seams;
- LLM rewriting;
- character voice admission / rendering;
- forget / revoke / correction implementation;
- public renderer expansion;
- raw candidate / debug / private material in any public / Discord output.

If a later phase needs any item above, it must propose a phase naming the
item, the proof obligation it carries, and the decision artifact it
re-opens. Phase 43A authorizes none of them; a future admission-wedge phase
is explicitly barred from the blocked lanes (§H lanes C / D) and from
everything above.

---

## O. What Phase 43A proves / does not prove

**Proves (selects):**

- only that the **next product wedge is selected** — the Admission Wedge
  MVP, the write/admission half, is the chosen next wedge after Recall
  Wedge MVP acceptance, ahead of jumping to full production Straylight;
- that the **core invariant is fixed** — candidate memory is not admitted
  memory, and a candidate is not recallable as governed continuity until an
  explicit admission transition accepts it (§E);
- that the **safe future shape is bounded** — Lane A (fixture / operator
  admission packet) first, dev/operator authority only, fixture / packet
  storage, every public surface posture preserved (§H, §K);
- that the **Phase 42D recall proof is preserved** — recall-after-admission
  reuses the accepted Recall Wedge path unchanged, and the fail-closed
  baseline remains a required regression (§I).

**Does not prove:**

- that an admission wedge works (that is the future target — §F);
- production memory admission;
- user chat becoming memory;
- remember-this / candidate-memory writes;
- Discord history ingestion;
- durable production storage;
- production auth / consent;
- cross-user consent / sharing;
- public rollout;
- public-channel recall;
- Telegram / private-chat surfaces;
- LLM rewriting;
- character voice admission / rendering;
- a forget / revoke / correction UI;
- a healthy Finn integration;
- generalized agent memory solved.

---

## P. Acceptance criteria for Phase 43A

Phase 43A is acceptable if:

- the **decision doc is added** (this file);
- the **decision map is updated** with a targeted Phase 43A addendum
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **Phase 42D acceptance is updated / cross-referenced** with a Phase
  43A note (`docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`);
- the **Phase 42A gate is updated / cross-referenced** with a Phase 43A
  note (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`);
- the **Phase 41C runbook is updated / cross-referenced** with a Phase 43A
  note (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs / tokens / JWTs / admin keys / service tokens /
  wallets / Postgres URLs / live service URLs / Railway IDs / Discord
  snowflakes / seeded assertion IDs** are committed;
- **no raw Dixie request / response bodies** (including `raw_reasons`,
  recall pack, receipt, or any admission packet body) are pasted;
- **no production rollout claim** and **no admission-wedge acceptance
  claim** is made;
- **no admission is implemented** — the admission wedge is selected as a
  future wedge only;
- **all blocked work remains blocked** (§N).

---

## Q. Next decision options

Phase 43A itself authorizes none of the following — it only selects the
Admission Wedge as the next product wedge. Each option carries its own
proof obligation and re-opens its own decision artifact:

- **a. Phase 43B — Admission Wedge MVP design (docs / design or
  fixture-design only).** The recommended next step (§M): define the
  candidate / admission packet shape, the admission transition, the
  admission receipt, and the §I acceptance tests, preferring Lane A.
  **Recommended next.**
- **b. Phase 43C+ — Lane A fixture / operator admission packet
  implementation.** The first reviewed implementation, only after 43B's
  design is accepted, under decision-map §7. Its own decision artifact and
  PR.
- **c. Separate dev-only `/remember-this` (Lane B) gate.** A riskier
  command-surface follow-up; only under its own separate gate, never as the
  MVP wedge's first step.
- **d. Stop and preserve Phase 42D as the resting state.** Treat the
  accepted controlled dev/operator seeded live recall as the resting state
  and take no further wedge action; public rollout stays blocked.

**Recommended:** option **a** (Phase 43B Admission Wedge MVP design), with
option **b** sequenced after it under its own gate, option **c** held as a
separately gated later follow-up, and option **d** as the always-available
stop. Phase 43A authorizes none of them; the next phase is the place to
commit to one.

---

## R. Cross-references

- `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; the accepted served recall this
  gate builds on, and the source of the recommendation to open this gate;
  gains a Phase 43A note.
- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; the authority that scoped the
  seeded lane Phase 42D served; gains a Phase 43A note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the controlled procedure the served proof
  reused and the §R.1 caveats this gate inherits (§L); gains a Phase 43A
  note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the live-command shape and gates the recall-after-
  admission step reuses unchanged.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, env config, and classification
  vocabulary the recall output narrows into.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  §7 (live memory admission gates) is the standing gate any admission wedge
  must satisfy, §8 the standing prohibitions; gains a Phase 43A addendum.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the live
  recall handler; the read-side primitive a recall-after-admission proof
  exercises unchanged (unchanged by Phase 43A).
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` — the
  live command regression / static-guard tests (unchanged by Phase 43A).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  live Dixie client; the only live-egress seam and the classification
  vocabulary the recall render narrows into (unchanged by Phase 43A).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  the live client tests (unchanged by Phase 43A).
