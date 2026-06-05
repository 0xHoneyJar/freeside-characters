# Recall Wedge — post-MVP integration decision map

> **Phase 35A** (docs-only). Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc) and
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance).
>
> This document is a **decision map**, not implementation. It records
> which kinds of post-MVP work are allowed next, which remain blocked,
> and the sequence that avoids collapsing the architecture into live
> Discord memory, generic app logging, or production auth/storage too
> early. No code, package, lockfile, Discord wiring, live
> Dixie/Straylight/Finn integration, production storage, live memory
> admission, or LLM/voice rewrite changes are introduced here.
>
> If a later phase reaches for anything below that is currently gated,
> deferred, or rejected, re-open the boundary doc — do not silently
> expand scope from this map.

---

## 1. Status after MVP acceptance

The fixture-bound Recall Wedge MVP is **accepted** through the
following ladder:

- **Phase 33A** — boundary decision doc (`docs/RECALL-WEDGE-MEMORY-MVP.md`).
- **Phase 33B** — reviewed seed memory packet, projected DTO fixtures
  (operator-private, public-discord, character-boundary-referral), and
  no-leak fixture validator
  (`docs/recall-wedge/fixtures/validate-fixtures.mjs`).
- **Phase 33C** — deterministic public-safe Recall Wedge renderer
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`)
  with fail-closed input scan + rendered-output leak guard.
- **Phase 33D** — fixture-bound cross-interface continuity demo
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`)
  binding all four proof properties.
- **Phase 34A** — final acceptance handoff
  (`docs/RECALL-WEDGE-MVP-ACCEPTANCE.md`).

The accepted proof, in summary:

- one shared continuity-bearing app/substrate — the
  `freeside-characters` substrate is the single continuity actor;
- reviewed synthetic already-admitted memory fixtures — the seed
  packet self-describes as `synthetic: true`,
  `fixture_kind: reviewed_seed_memory_packet`,
  `admission_state: already_admitted`, with Straylight named as
  authority;
- same seed fixture across projected views — every projected DTO
  references the seed by `source_seed_fixture`;
- same internal continuity actor across seed + projected DTOs — every
  projected DTO carries the same `continuity_actor_id` as the seed;
- different authorized views — operator-private, public-discord, and
  character-boundary-referral are demonstrably distinct projections of
  the same packet;
- operator-private not publicly renderable — the public-safe renderer
  rejects it with `wrong_recall_interface` (or, on contamination,
  `banned_private_material_in_input`);
- public Discord normal view + character-boundary referral view both
  render safely — deterministic billboards strictly inside the §9
  allowlist;
- public output no-leak — strict allowlist plus the demo's
  defense-in-depth `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` guard;
- no live integration — no Discord client wiring beyond what already
  exists, no live Dixie/Straylight/Finn, no production storage, no
  live admission of new memory.

---

## 2. Non-negotiable boundaries that still hold

These survive every post-MVP option below. None may be relaxed without
re-opening `docs/RECALL-WEDGE-MEMORY-MVP.md`:

- no live Discord-to-memory admission by default;
- Discord logs are raw source / candidate memory only (never governed
  memory by default, per boundary doc §6);
- feedback / corrections / reactions are not governed memory by
  default;
- Mibera / onchain stats are external data / tool output (mibera-codex,
  score-mcp) unless explicitly admitted via a future governed
  admission path;
- GitHub / repo fixtures are not production memory storage —
  Straylight remains the memory authority (boundary doc §4);
- characters are persona / knowledge-boundary frames over the shared
  substrate, **not** independent Straylight estates;
- no production cross-user authorization or consent claim;
- no arbitrary Person B access to Person A's memory;
- no character-voiced recall until separately approved (boundary doc
  §12 — voiceless data billboards only);
- public renderers must not dump `raw_reasons`, debug payloads,
  private identifiers, assertion IDs, hidden estate material, or
  actor identifiers (boundary doc §9, enforced by
  `render-public-recall.ts` allowlist + `demo-cross-interface.ts`
  `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`).

---

## 3. Post-MVP option matrix

Each option is a candidate post-MVP direction. **Recommended status**
states whether the option is a likely near-term step, possible after
prerequisites, or deferred until upstream decisions land.

| Option | Example | Pros | Cons | Recommended status |
|--------|---------|------|------|---------------------|
| **A — explicit dev/operator recall demo surface** | CLI or dev-only script that runs the existing Phase 33D cross-interface demo and prints the safe public output for human inspection. | Low risk; proves operator usability; no Discord/auth/storage; reuses accepted artifacts. | Not a user-facing product surface; doesn't extend the proof, only its ergonomics. | **Likely first implementation step (Phase 35B candidate).** |
| **B — explicit Discord slash-command demo, fixture-bound only** | Slash command (e.g. `/recall-demo`) that renders the fixture-bound public Recall Wedge billboard — not live memory. | Demonstrates the Discord surface end-to-end; familiar shape for operators / reviewers. | Risk of being misread as live memory; must be clearly labeled demo/fixture-bound; couples to Discord wiring earlier than necessary. | **Possible after Option A and an explicit public-surface contract spec; must satisfy §5a Discord command operational gates.** |
| **C — live Dixie client integration** | Replace local fixtures with calls to a Dixie-safe envelope endpoint. | Moves toward real cross-repo architecture; pins the envelope shape against a real producer. | Requires auth, envelope stability, failure handling, tenant/user boundary decisions. | **Defer until interface contract and auth assumptions are locked (cross-repo decision).** |
| **D — production storage / admission design** | Postgres for canonical estate / assertion / audit / receipt store; object storage for raw blobs; vector index as **derived retrieval only**; Redis for idempotency / cache / session. | Needed for any live memory; records an offline integration contract without assigning semantic ownership to freeside-characters. | Too large to bundle with a Discord surface; needs its own design phase and review. | **Separate design phase, not immediate implementation.** |
| **E — Discord interaction logs as candidate memory** | Explicit "remember this" intent or correction capture as **candidate memory only** (never auto-admitted). | Begins the live memory pipeline behind explicit intent. | Requires admission, consent, signer/authorization, audit, forget/revoke, candidate review. | **Post storage/admission design only. Blocked on D.** |
| **F — character-voiced recall summaries** | LLM/persona rewrite of the safe recall billboard. | Better user experience long-term. | Increases leakage and prompt-injection risk; couples voice discipline to memory safety; breaks determinism of proof. | **Defer until the deterministic surface is proven in a live-safe setting.** |
| **G — onchain stats admission** | Admit Mibera / onchain holder stats as governed assertions. | Connects existing external data to continuity. | External tool output should not automatically become memory; requires admission path and review. | **Only through an explicit admission path later. Blocked on D + E.** |
| **H — recorded Dixie envelope contract fixtures + adapter tests** | Recorded/versioned Dixie-safe envelope samples on disk; pure adapter from Dixie-safe envelope to local projected DTO; adapter unit tests; offline / fixture-bound only; no live Dixie client; no network; no production storage; no live admission. | Prepares the live Dixie path without calling Dixie; tests the narrowing boundary from Dixie-safe envelope to local public DTO; prevents raw Dixie response material from reaching the public renderer; creates an offline contract path toward Straylight/Dixie integration. | Requires stable enough envelope expectations; can drift if Dixie route contract changes; does not prove live Dixie availability or auth. | **Add after public-surface contract work and before live Dixie client. Candidate Phase 35D or 36A depending on whether a fixture-only Discord demo is prioritized.** |

---

## 4. Recommended sequence

The recommended sequence below is conservative by design. It keeps each
PR small enough to review in isolation and refuses to bundle the
high-risk decisions (live admission, live Dixie, voice rewrite) into
the same change.

### Phase 35B — explicit dev/operator recall demo runner (Option A)

- Add an explicit dev/operator Recall Wedge demo runner as a **package
  script or CLI runner** over the existing Phase 33D cross-interface
  demo
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`).
- Fixture-bound. No new fixtures required; use the accepted set under
  `docs/recall-wedge/fixtures/`.
- Explicit bans:
  - no `apps/bot/src/discord-interactions/*`;
  - no command registration;
  - no Discord API;
  - no delivery path changes;
  - no production / public API surface;
  - no live Dixie;
  - no production storage;
  - no memory admission;
  - no voice rewrite.
- Output rules:
  - public billboard output is safe by default;
  - internal proof fields (e.g. `continuity_actor_id`, `raw_reasons`,
    `source_seed_fixture`, operator-private projections) must be
    clearly marked **internal** in the runner's output;
  - internal proof fields must not be copied into public output;
  - runner output must visibly distinguish public rendered text from
    internal proof data (e.g. labeled sections / headers).
- Prints deterministic operator-readable output (the safe public
  billboards + a clearly internal note that operator-private was
  rejected).
- Re-runs the existing `validate-fixtures.mjs` and the existing
  `bun test src/recall-wedge/` suite as part of its acceptance.
- Purpose: prove humans/operators can run and inspect the accepted MVP
  proof easily, without re-reading source. **Explicitly not Discord
  command work.**

### Phase 35C — public-surface contract spec (docs-only)

- Add a docs-only spec for what a future public Recall Wedge surface
  must look like, covering:
  - what inputs are allowed (frame, caller, packet reference);
  - what output may be public (the §9 allowlist, restated for the
    public surface);
  - what errors / refusals look like (mapped to
    `PublicRecallRenderError` reason codes today);
  - what stays internal-only (operator-private projections, raw
    reasons, actor identifiers, debug payloads);
  - what telemetry / audit is safe to emit publicly vs internally;
  - explicit fixture-vs-live labeling rules for any output reaching a
    public surface.
- Still no live memory admission. Still no Discord command wiring.
- Purpose: lock the contract before any wire-level work.

### Phase 35D — pick one: recorded Dixie envelope fixtures (Option H) OR fixture-only Discord demo (Option B)

- Choose **one**:
  - **A. Recorded Dixie envelope contract fixtures + adapter tests
    (Option H)** — preferred path before any live Dixie. Adds
    versioned Dixie-safe envelope fixtures and a pure adapter from
    envelope to local projected DTO with unit tests. Offline /
    fixture-bound only.
  - **B. Tightly gated fixture-only Discord slash-command demo
    (Option B)** — optional. If chosen, must satisfy every gate in §5a
    (Discord command operational gates) below, and must remain
    fixture-bound and explicitly labeled.
- Recorded Dixie envelope fixtures (Option H) are **preferred** before
  any live Dixie work because they pin the narrowing boundary from
  Dixie-safe envelope to local public DTO without network or auth.
- A fixture-only Discord demo is **optional**. If pursued, it does
  not replace Option H — Option H still must precede live Dixie.

### Phase 36A — live envelope or storage / admission decision

- Pick whichever has become the real blocker:
  - **live Dixie envelope / client decision** (Option C) — if the
    cross-repo contract is the bottleneck. Must satisfy §6 (live Dixie
    gates), and Option H (recorded envelope fixtures + adapter tests)
    must already be in place.
  - **production storage / admission design** (Option D) — if live
    memory is what gates the next demo. Must satisfy §7 (live memory
    admission gates).
- Each is a separate design phase, not a single PR.

If after inspecting the repo a different sequence becomes obviously
better — e.g. the operator demo already exists in some form via
`scripts/` and the next real lift is the public-surface spec — propose
the change with reasons. Do not implement it from this doc.

---

## 5. Decision gates before any live Discord command

Before any **live** Discord command (anything beyond fixture-bound
Option B) is allowed, all of the following must hold:

- explicit invocation only (preserves the `CLAUDE.md` anti-spam
  invariant and boundary-doc §13);
- deterministic renderer or an approved safe renderer (today:
  `render-public-recall.ts`);
- public-safe error / refusal contract (today:
  `PublicRecallRenderError` reason codes, surfaced as generic
  user-visible refusal text);
- no `raw_reasons` / debug / private IDs in any public output;
- no actor identifiers (no `continuity_actor_id`, no `actor:` lines)
  in any public output;
- no live memory admission as a side effect;
- clear user-facing copy labeling demo output as fixture-bound, if it
  is still fixture-bound;
- tests proving no public leaks (the existing `render-public-recall.test.ts`
  + `demo-cross-interface.test.ts` patterns are the template).

---

## 5a. Discord command operational gates (separate from live-memory gates)

These are **operational** gates that apply to **any** Discord command
related to Recall Wedge — including fixture-bound demo commands. They
are distinct from §7 live-memory gates: a command can be fixture-bound
and still need every gate below. Storage availability does not imply
admission permission, and command availability does not imply live
memory.

Before any Discord command (even a fixture-bound demo command) is
allowed:

- command registration / publish scope decision (global vs guild,
  which guild, and whether the command is registered at all);
- guild / dev visibility decision (dev guild only, private guild,
  public guild);
- feature flag or kill switch (env var or config switch that disables
  the command without redeploy);
- admin / operator-only invocation if demo or private (Discord
  permissions check, allowlisted user IDs, or both);
- ephemeral vs public / channel delivery decision (ephemeral by
  default for demo / operator commands);
- redacted operational logging (no raw private fields, no actor
  identifiers, no `raw_reasons` in logs);
- explicit fixture-bound label in user-facing copy if the command is
  fixture-bound;
- tests proving public no-leak under the same `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`
  + allowlist patterns used by the existing renderer / demo tests;
- no ambient recall (command does not listen to channel traffic);
- no passive listening (no `messageCreate` reading for memory);
- no automatic memory admission (command never writes to candidate or
  admitted memory as a side effect of being invoked).

---

### 5b. Phase 37B addendum — live Dixie client narrowed to operator/dev-only first

> Added by Phase 37B
> (`docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`). Targeted
> addendum, not a rewrite of this section.

The post-MVP Option C ("live Dixie client integration") is narrowed:
the **first** live-Dixie code phase, if any, is **operator/dev-only**.
Public Discord / Telegram wiring, public renderer expansion, storage /
admission, positive `public_telegram` / `authorized_private_session`
support, and character-voiced recall output remain blocked.

Status as of Phase 37B:

- **Dixie Phase 32E / 32F now exist.**
  `../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`
  governs `POST /api/recall/intake`;
  `../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`
  unblocks downstream contract reconciliation only.
- **Phase 37A completed reconciliation.** See
  `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md`. Local
  recorded fixtures remain valid as synthetic non-production probes;
  they are not promoted to Dixie schema authority; production
  traffic must not use `recorded_dixie_recall_envelope`.
- **Phase 37B authorizes a future Phase 37C operator/dev-only live
  Dixie client spike against `POST /api/recall/intake`.** Subject
  to every constraint in `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md`.
  The spike is not Discord / Telegram wiring, not public renderer
  expansion, not storage / admission, not character-voiced.
- **Live Dixie client integration in any broader sense remains
  gated.** Option C above is narrowed to "operator/dev-only first,"
  and the readiness checkpoint §6 preconditions still apply to any
  step beyond the operator/dev spike.

If Phase 37C lands and Phase 37D accepts it, the next implementation
phase is **Phase 38A — the fixture/injected-result multi-surface
Recall Wedge boundary harness**, followed by **Phase 38B — audit /
acceptance of that harness**. Neither phase authorizes real surface
wiring. The earliest decision point for a controlled public (or
controlled dev-only) Discord test surface is **deferred to Phase 39A
or later**, subject to its own decision gate and to the §5a Discord
command operational gates. Real Discord, Telegram, private-chat,
storage / admission, and character-voiced recall output remain
blocked. None of those steps is a relaxation of this gate.

---

### 5c. Phase 37D addendum — next MVP proof is multi-surface boundary simulation, not real surface integration

> Added by Phase 37D
> (`docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md`). Targeted
> addendum, not a rewrite of this section.

Phase 37C (operator/dev-only live Dixie client and runner) **has
landed and is accepted** by Phase 37D as the only live Dixie seam
in the repo. Phase 37C does **not** authorize real public or
private surface integration.

The product context for the next MVP step is:

- there is no ready private chat surface through Dixie;
- there is no Telegram surface;
- the public Discord surface is not yet optimized or gated.

Therefore the next implementation phase is **not** real Discord /
Telegram / private-chat integration. Instead:

- **The next MVP proof is a fixture/injected-result multi-surface
  Recall Wedge boundary harness.** It binds the same continuity
  actor / same recall result to a taxonomy of surface frames
  (operator, public Discord, public Telegram, authorized private
  session, private chat, public character) and asserts each
  frame's allowed projection or fail-closed refusal.
- **Phase 38A should implement that harness.** Recommended files
  are `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  and its `.test.ts` companion. The harness consumes injected /
  fake `LiveDixieRecallResult`-shaped values and (optionally)
  recorded fixture projections — it does **not** call the Phase
  37C live client and does **not** make network calls.
- **Real Discord / Telegram / private-chat / storage / admission /
  voice remain blocked.** Each is gated on a later, separately
  authorized phase. Phase 39A is where a controlled dev-only
  Discord surface decision is made — not earlier, and not as part
  of the harness.

Detailed scope, allowed and disallowed Phase 38A behaviors, the
surface-frame taxonomy, the harness acceptance criteria, and the
post-37D phase ladder live in the Phase 37D gate doc
(`docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md`). This
addendum does not duplicate them; it only redirects the
post-MVP option matrix's **next implementation phase** away from
real surface wiring and toward the Phase 38A harness.

---

### 5d. Phase 38B addendum — multi-surface harness accepted; Phase 39A may decide a tightly gated dev-only Discord surface

> Added by Phase 38B
> (`docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md`).
> Targeted addendum, not a rewrite of this section.

Status of the next-implementation-phase question as of Phase 38B:

- **Phase 38A is merged and accepted.** The fixture/injected-result
  multi-surface Recall Wedge boundary harness
  (`packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  and its `.test.ts` companion) is in place; all six frames in the
  Phase 37D §F taxonomy (`operator_dev`, `public_discord_simulated`,
  `public_telegram_simulated`,
  `authorized_private_session_simulated`, `private_chat_simulated`,
  `character_frame_public`) are modeled.
- **The multi-surface proof is now accepted.** Phase 38B accepts the
  Phase 38A harness as the fixture/injected-result multi-surface
  Recall Wedge boundary proof. Same continuity actor / same recall
  result across multiple frames; different projections / refusals
  per frame; identical-output matrix rejected; no-leak proof
  non-vacuous; no network / live-client / Discord / Telegram /
  storage / LLM / Finn / `@loa/dixie` / `@loa/straylight`
  integration.
- **Phase 39A may decide whether to authorize a tightly gated
  dev-only Discord surface.** Phase 39A is the next allowed phase
  and is itself a decision / gate phase — not implementation.
  Phase 39A is subject to the §5a Discord command operational
  gates above and to the question list in
  `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` §H.
- **Real Discord implementation remains blocked until Phase 39A
  explicitly authorizes Phase 39B.** No Discord command code,
  Telegram code, private-chat code, storage / admission code,
  public renderer expansion, live Dixie call inside the harness,
  LLM rewriting, or character voice may be added until Phase 39A
  is merged and explicitly authorizes Phase 39B. Telegram, private
  chat, storage / admission, Finn audit wiring, LLM rewriting, and
  character-voiced recall output remain blocked.

This addendum does not duplicate the Phase 38B acceptance doc; it
only updates the post-MVP option matrix's **next-implementation-
phase** answer from "Phase 38A harness" to "Phase 39A decision
gate, not Phase 39B implementation."

---

### 5e. Phase 39A addendum — next implementation chosen as dev-only Discord harness demo, not production recall

> Added by Phase 39A
> (`docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 39A:

- **Phase 39A chooses the next implementation as a dev-only
  Discord harness demo, not production recall.** The chosen
  shape is a single guild-scoped, operator-invoked,
  ephemeral-only slash command (`/recall-wedge-demo`) that
  renders Phase 38A multi-surface harness output. It is
  fixture-bound, not live-Dixie-backed.
- **Phase 39B is allowed only under the new gate.** Phase 39B is
  authorized only if every constraint in
  `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` §C–§N
  holds: disabled-by-default env gates
  (`RECALL_WEDGE_DISCORD_DEMO_ENABLED`,
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`,
  `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`,
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS`); ephemeral
  delivery only; harness output only; no live Dixie client
  invocation; banned-substring scan on user-visible output;
  no public renderer mutation; the §5a Discord command
  operational gates of this doc tightened, not relaxed.
- **Live Dixie-backed Discord, Telegram, private chat, storage /
  admission, production auth / consent, LLM rewriting, and
  character voice remain blocked.** None is authorized by Phase
  39A. Each is gated on a later, separately authorized phase.

This addendum does not duplicate the Phase 39A gate doc; it only
updates the post-MVP option matrix's **next-implementation-phase**
answer from "Phase 39A decision gate, not Phase 39B implementation"
to "Phase 39B is allowed only under the Phase 39A gate, dev-only
Discord harness demo only."

---

### 5f. Phase 39D addendum — Phase 39B / 39C merged; operational runbook only

> Added by Phase 39D
> (`docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 39D:

- **Phase 39B and Phase 39C are merged.** The dev-only
  `/recall-wedge-demo` handler (Phase 39B) and the disabled-by-default,
  guild-scoped-only registration gate (Phase 39C) are in place.
- **Phase 39D adds only the operational runbook / acceptance path.** It
  adds no source, test, package, lockfile, fixture, config, CI, or
  generated change, and no registration / handler behavior change.
- **Controlled operator testing is allowed only under the runbook** —
  guild-scoped registration to one configured guild, operator-gated
  invocation by an allowlist, ephemeral harness-backed output, with
  immediate env / config disable.
- **Live Dixie-backed Discord recall, public rollout, public
  channel-visible recall, Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, and character voice remain
  blocked.** Phase 39D does not expand the Phase 39A authorization.

---

### 5g. Phase 39E addendum — controlled operator smoke-test accepted; demo only

> Added by Phase 39E
> (`docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 39E:

- **Phase 39E records controlled operator smoke-test acceptance.** The
  human operator ran the Phase 39D smoke test in a real Discord guild
  (redacted observations only — no raw IDs / tokens / screenshots
  committed).
- **Registration, operator invocation, served / default output, denied
  output, and non-operator fail-closed refusal all passed.**
  `/recall-wedge-demo` registered guild-scoped only (no global), the
  allowlisted operator received ephemeral Phase 38A harness-backed
  output for both `served` and `denied` cases, and a non-operator
  account received the single generic ephemeral refusal.
- **`/recall-wedge-demo` is accepted only for controlled dev / operator
  demos.** Phase 39E adds no source, test, package, lockfile, fixture,
  config, CI, or generated change, and no handler / registration
  behavior change.
- **No live Dixie-backed Discord recall, public rollout, public
  channel-visible recall, Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, or character voice is
  authorized.** Phase 39E does not expand the Phase 39A authorization.
- **The next allowed step is Phase 40A — a post-smoke-test decision
  gate** (keep the demo as-is, write an internal demo guide, add a
  de-registration helper, move toward live Dixie-backed Discord recall
  under a new gate, move toward public-channel-visible recall under a
  new gate, or stop and harden operational docs). Phase 39E authorizes
  none of those.

---

### 5h. Phase 40A addendum — post-smoke-test decision; demo kept, 40B guide then possible 40C de-registration

> Added by Phase 40A
> (`docs/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 40A:

- **Phase 40A is docs / decision only.** It adds no source, test,
  package, lockfile, fixture, config, CI, or generated change, and no
  handler / registration behavior change. It does not authorize
  implementation of the steps it selects.
- **It keeps `/recall-wedge-demo` as a controlled dev / operator
  demo** — the current operating state accepted by Phase 39E, kept
  as-is.
- **It selects Phase 40B — an internal demo guide — as the next
  step.** Docs-only, operator-facing, no code, redacted placeholders
  only, preserving the no-live-Dixie / no-memory-admission /
  no-public-rollout posture.
- **It selects Phase 40C — a guild-scoped de-registration helper — as
  the likely following step, if still needed**, only after Phase 40B.
  If implemented it must be guild-scoped only, must not global-delete,
  must not touch handler behavior, must add no live Dixie / public
  recall, and must include tests / static guards.
- **It keeps live Dixie-backed Discord recall and
  public-channel-visible recall blocked behind separate later gates.**
  The Phase 37C live client is operator/dev-only and unreachable from
  Discord; the smoke test proved the Discord surface gate, not live
  recall, and the demo is ephemeral-only. Telegram, private chat,
  storage / admission, production auth / consent, LLM rewriting, and
  character voice also remain blocked.

This addendum does not duplicate the Phase 40A gate doc; it only
updates the post-MVP option matrix's **next-implementation-phase**
answer from "Phase 40A — a post-smoke-test decision gate" to "Phase 40B
internal demo guide, then possible Phase 40C guild-scoped
de-registration helper."

---

### 5i. Phase 40B addendum — internal demo guide added; docs-only, runtime unchanged

> Added by Phase 40B
> (`docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 40B:

- **Phase 40B adds the internal demo guide** selected by Phase 40A — an
  operator-facing how-to-demo-safely artifact layered on top of the
  Phase 39D runbook.
- **It is docs-only / operator-facing.** It adds no source, test,
  package, lockfile, fixture, config, CI, or generated change.
- **It does not change runtime behavior.** No handler / registration /
  dispatch change; `/recall-wedge-demo` is untouched.
- **It keeps `/recall-wedge-demo` controlled / guild-scoped /
  operator-gated / ephemeral / harness-backed** and non-production —
  the same posture Phase 39A / 39D / 39E / 40A hold.
- **It gives a safe 5–10 minute demo script** (framing, command
  visibility, served / default, denied / refusal, optional non-operator
  fail-closed, boundaries, Q&A) plus **what-to-say / what-not-to-claim**
  guidance and redacted-placeholder expected outputs.
- **The next possible step remains Phase 40C — a guild-scoped
  de-registration helper — only if still needed**, after Phase 40B (the
  Phase 39D runbook §L manual removal may prove sufficient).
- **Live Dixie-backed Discord recall and public-channel-visible recall
  remain blocked** behind separate later gates. Telegram, private chat,
  storage / admission, production auth / consent, LLM rewriting, and
  character voice also remain blocked.

This addendum does not duplicate the Phase 40B guide; it only records
that the Phase 40A-selected internal-guide step is now fulfilled.

---

### 5j. Phase 41A addendum — live-Dixie Discord decision lane opened; separate `/recall-wedge-live-demo` command, Phase 40C deferred

> Added by Phase 41A
> (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 41A:

- **Phase 41A is docs / decision only.** It adds no source, test,
  package, lockfile, fixture, config, CI, or generated change, and no
  handler / registration / dispatch behavior change. It implements
  nothing.
- **Phase 40C de-registration helper is deferred / only-if-needed.** The
  Phase 39D runbook §L manual removal remains sufficient; no current
  blocker requires a helper. Phase 40C stays available later if manual
  de-registration becomes risky or annoying.
- **Future live Dixie-backed Discord work must use a separate command
  `/recall-wedge-live-demo`.** It must not silently replace the harness
  output of `/recall-wedge-demo`, which preserves the accepted harness
  demo, keeps fixture proof distinct from live producer proof, keeps the
  registration / runtime / env gates separable, and clarifies audit /
  operator language.
- **`/recall-wedge-demo` remains harness-backed.** It is untouched by
  Phase 41A and must not be mutated into a live command by any future
  phase.
- **A future Phase 41B may be considered** only under strict
  disabled-by-default / guild-scoped / operator-gated / ephemeral-only
  gates, with no freeform query, no Discord message history input, no
  memory admission, no candidate writes, no "remember this," no
  production auth / consent, no Telegram / private chat, no LLM / voice,
  and no public renderer expansion. It may call the Phase 37C live Dixie
  client only after the Discord gates pass, behind separate env gates
  (`RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED` /
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS` /
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID` /
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`), with response
  narrowing, a no-leak scan, and fail-closed unknown / error paths.
- **Public-channel-visible recall remains blocked** behind its own
  separate later gate, as do memory admission, Telegram, private chat,
  storage / admission, production auth / consent, LLM rewriting, and
  character voice.
- **No implementation is authorized by Phase 41A.** Phase 41B is
  authorized only as a future gated decision / implementation slice with
  its own scope, gates, and acceptance, defined in the Phase 41A gate
  doc.

This addendum does not duplicate the Phase 41A gate doc; it only updates
the post-MVP option matrix's **next-decision-lane** answer from "Phase
40B internal demo guide, then possible Phase 40C guild-scoped
de-registration helper" to "Phase 40C deferred; the next meaningful
proof boundary is a separate-command live-Dixie Discord decision (future
Phase 41B), not implemented by Phase 41A."

---

### 5k. Phase 41C addendum — live-demo operational runbook added; docs-only, runtime unchanged

> Added by Phase 41C
> (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 41C (note: Phase 41B — the separate
`/recall-wedge-live-demo` command — is merged via PR #137; Phase 41A §N
predates that and calls the future acceptance "Phase 41C," but the
ladder advanced one slot, so the future smoke-test acceptance is **Phase
41D**):

- **Phase 41C adds the operational runbook for
  `/recall-wedge-live-demo`.** It documents the controlled setup,
  registration, invocation, fail-closed, disable, removal, and
  evidence-capture procedure for the Phase 41B live command.
- **It is docs-only.** It adds no source, test, package, lockfile,
  fixture, config, CI, or generated change, and no handler /
  registration / dispatch behavior change.
- **It does not change runtime behavior.** Both `/recall-wedge-live-demo`
  and `/recall-wedge-demo` are untouched; the two commands stay distinct
  (separate names, handlers, env gates, registration paths).
- **It prepares the registration / invocation / fail-closed / disable /
  evidence procedure** — guild-scoped registration to one configured
  guild, operator-gated invocation, ephemeral safe/classified output or
  generic fail-closed refusal, with redacted-placeholder env and no
  secrets.
- **It does not record smoke-test acceptance.** A **future Phase 41D**
  may record smoke-test acceptance after a controlled live run (a
  docs-only redacted report similar to the Phase 39E harness-demo
  acceptance).
- **Public-channel-visible recall, memory admission, public rollout,
  Telegram / private chat, LLM / voice remain blocked** behind separate
  later gates. Candidate writes, "remember this," storage / admission,
  production auth / consent, direct Finn runtime / audit wiring beyond
  existing seams, and public renderer expansion also remain blocked.

This addendum does not duplicate the Phase 41C runbook; it only records
that the Phase 41B live command now has an operational runbook and that
the next acceptance step is a future Phase 41D, not Phase 41C.

### 5l. Phase 41D addendum — controlled live-Dixie Discord smoke test accepted; safe wiring + fail-closed only, no served recall

> Added by Phase 41D
> (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`).
> Targeted addendum, not a rewrite of this section.

Status as of Phase 41D (2026-05-30):

- **Phase 41D records controlled operator smoke-test acceptance for the
  live command.** A human operator deployed Dixie live (Railway, healthy
  service + Postgres, `GET /api/health` → 200), wired the **Freeside
  Characters** service with the live Dixie env, and invoked
  `/recall-wedge-live-demo` in one configured guild. The live path
  reached the Dixie `/api/recall/intake` seam and **fail-closed safely**.
- **It is docs-only.** It adds no source, test, package, lockfile,
  fixture, config, CI, or generated change, and no handler /
  registration / dispatch behavior change.
- **It accepts safe wiring + fail-closed rendering, not served recall.**
  The authenticated intake reached the Straylight seam and returned
  `seam.storage_unavailable`; the command classified it as
  `upstream_unavailable` and rendered an ephemeral operator-safe summary
  (`classification` / `outcome` / `route` / `reason`) with **no
  `raw_reasons`, no raw payload, no IDs / tokens / tenant / debug
  material**.
- **The current blocker for served recall is the unseeded live estate /
  storage state.** Until it is seeded (and the seeding / admission path
  is itself designed and gated — §7), the live command can prove safe
  reach + safe fail-closed, not served recall content.
- **No production / public claim, no Finn-healthy claim.** The run does
  not claim production rollout, public recall, served memory, healthy
  Finn integration (Finn was intentionally unreachable), persistent
  production storage / admission, or cross-user auth / consent.
- **Two documented operational caveats.** Startup auto-publish can remove
  the dev-only live command (register after restart; do not restart
  before invocation); and the manually minted Dixie JWT is short-lived
  (refresh + restart before re-running if expired).
- **Next decision options are recorded, none authorized here:** preserve
  as controlled smoke acceptance; harden the runbook (docs-only); a tiny
  operational patch so startup auto-publish does not erase the gated dev
  command; design a seeded live estate / storage path; design a
  longer-lived / safer dev service-token path; keep public rollout
  blocked.
- **Public-channel-visible recall, public recall, served memory, memory
  admission, storage / admission, production / public rollout, Telegram /
  private chat, LLM / voice, candidate writes, "remember this," cross-user
  auth / consent, direct Finn runtime / audit wiring beyond existing
  seams, and public renderer expansion all remain blocked** behind
  separate later gates.

This addendum does not duplicate the Phase 41D acceptance report; it only
records that a controlled live-Dixie Discord run was accepted for safe
wiring + fail-closed rendering, that served recall remains blocked on the
unseeded estate / storage state, and that the **recommended next phase**
answer is preserve / harden docs now, with seeded-storage and
safer-token work sequenced later under their own gates.

---

### 5m. Phase 42A addendum — next MVP need is a seeded dev/operator live estate, not registration / token hardening

> Added by Phase 42A
> (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`), 2026-05-30.
> Targeted addendum, not a rewrite of this section.

Status as of Phase 42A:

- **Phase 42A is docs / decision gate only.** It adds no source, test,
  package, lockfile, fixture, config, CI, or generated change, and no
  handler / registration / dispatch / seed / storage change. It implements
  nothing and seeds nothing.
- **It selects the next MVP need: a seeded dev/operator live estate /
  storage fixture.** Phase 41D proved the pipe works (live wiring, Dixie
  reach, auth path, fail-closed classification, no-leak Discord render)
  but fail-closed on `seam.storage_unavailable` because the live estate /
  storage state is unseeded. The next meaningful MVP step is seeding a
  tightly scoped dev/operator estate so the live path can prove a **safe
  served live recall result**, not command-registration hardening and not
  service-token hardening.
- **It authorizes only a future seeded-estate lane (a future Phase 42B).**
  The seed must be one dev/operator (or narrowly scoped fixture) estate
  with one or a few reviewed deterministic assertions, deterministic /
  reviewed / idempotent / safe-to-rerun, committing no secrets / live IDs
  / tokens / URLs / keys, with tests / guards before any PR acceptance.
  Seeded live memory must be a reviewed operator/dev fixture, **not user
  chat ingestion**. It stays inside this doc's §6 (live Dixie client) and
  §7 (live memory admission) gates.
- **The accepted target proof is served live recall:** the controlled
  operator `/recall-wedge-live-demo` path calls live Dixie, Dixie reads a
  seeded live estate, Straylight returns a governed non-empty recall
  result classified `served`, Freeside Characters renders only public /
  operator-safe fields, and no raw / private / debug / source material
  leaks.
- **Priority ranking locked:** seeded live estate / storage first;
  service-token hardening second (only if it becomes a hard blocker for
  repeated smoke, behind its own decision); command-registration
  hardening third (behind its own decision); public rollout remains
  blocked throughout.
- **Blocked work stays blocked.** Production memory admission,
  candidate-memory writes, "remember this," arbitrary user writes, live
  Discord message ingestion / history-as-memory, cross-user auth /
  consent, public recall, public channel-visible recall, served recall as
  a shipped capability, Telegram, private chat, LLM rewriting, character
  voice, public renderer expansion, and Finn integration remain blocked
  behind separate later gates. Phase 42A authorizes none of them and makes
  no served-memory acceptance claim.
- **Next decision options:** Phase 42B seeded live estate / storage design
  or fixture spike (recommended); a separate token-hardening gate; a
  separate command-registration-hardening gate; or stop and preserve Phase
  41D as safe-failure acceptance.

This addendum does not duplicate the Phase 42A gate doc; it only updates
the post-MVP option matrix's **next-MVP-need** answer from "preserve /
harden docs now, seeded-storage later" (Phase 41D §5l) to "a seeded
dev/operator live estate / storage fixture (future Phase 42B) is the
selected next MVP step, ahead of token and registration hardening, to
prove a safe served live recall result."

---

### 5n. Phase 42D addendum — controlled dev/operator seeded live recall accepted; live `served` from Discord, not fixture-only; Admission Wedge is the next product wedge

> Added by Phase 42D
> (`docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`),
> 2026-05-31. Targeted addendum, not a rewrite of this section.

Status as of Phase 42D:

- **Phase 42D is docs / smoke-test acceptance only.** It adds no source,
  test, package, lockfile, fixture, config, CI, or generated change, and no
  handler / registration / dispatch / seed / storage change. It records a
  single controlled dev/operator run.
- **The seeded-estate lane Phase 42A selected (§5m) has been exercised and
  accepted as served.** The lane resolved across the substrate boundary as:
  Dixie-side seeding (direct Dixie Phase 32K v4b seeded smoke) + Freeside
  Characters Phase 42B (safe pre-Dixie gate diagnostics) + Phase 42C
  (seeded request / signature alignment), accepted here as Phase 42D. No
  Phase 42A seed constraint was relaxed.
- **The direct Dixie Phase 32K (v4b) seeded smoke passed** (off-Discord,
  precondition): allowlist HTTP 201, token verify HTTP 200, recall HTTP
  200, `outcome = served`, recall pack present, receipt present, raw
  reasons absent.
- **The Discord `/recall-wedge-live-demo` smoke passed**: an allowlisted
  operator invoked it in the configured guild; the gated handler lazily
  loaded the Phase 37C client; the client called live Dixie with the Phase
  42C seeded-aligned request; Dixie's service token / seeded signer /
  keyring accepted the call and read the seeded dev/operator estate; the
  result classified `served` and rendered an **ephemeral** operator-safe
  summary (`classification` / `outcome` / `route` / `reason` — all
  `served` / `/api/recall/intake`).
- **No leak.** The Discord output exposed **no** `raw_reasons`, raw Dixie
  payload, recall pack body, receipt body, bounded-store scope, tenant /
  debug material, JWT / token, seeded assertion IDs, stack traces, or
  private IDs; output was guild-scoped, operator-gated, ephemeral, and
  never public-channel-visible.
- **MVP status: the live seeded recall proof is accepted as a controlled
  dev/operator seeded live recall — not as production memory, production
  memory admission, durable production storage, user-chat ingestion, or
  public recall.** The current MVP proof is now live, not fixture-only. The
  Phase 41D safe-fail-closed baseline still holds (seeding added the served
  case without removing the safe-failure case).
- **Does not prove:** production memory admission, user chat becoming
  memory, remember-this / candidate writes, Discord history ingestion,
  durable production storage, production auth / consent, cross-user consent
  / sharing, public rollout, public-channel recall, Telegram / private-chat
  surfaces, LLM rewriting, character voice rendering, or forget / revoke /
  correction UI. Everything in §5l / §5m's blocked lists and §7 remains
  blocked.
- **Recommended next decision: open a docs-only Admission Wedge decision
  gate** (e.g. `RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`),
  scoping the safe future shape of an admission wedge under the §7 gates —
  **not** full production Straylight all at once. Phase 42D implements no
  admission. Token-hardening and command-registration-hardening stay behind
  their own separate decisions; public rollout stays blocked.

This addendum does not duplicate the Phase 42D acceptance report; it only
updates the option matrix's **proven-state** answer from "seeded estate
selected as the next MVP need" (Phase 42A §5m) to "a controlled
dev/operator seeded live recall has been served through Dixie and safely
summarized in Discord, and is accepted — with the Admission Wedge
decision-gate as the recommended next product wedge."

---

### 5o. Phase 43A addendum — Admission Wedge MVP selected as the next product wedge; write/admission half, not full production Straylight

> Added by Phase 43A
> (`docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`),
> 2026-05-31. Targeted addendum, not a rewrite of this section.

Status as of Phase 43A:

- **Phase 43A is docs / decision gate only.** It adds no source, test,
  package, lockfile, fixture, config, CI, or generated change, and no
  command / Dixie route / Straylight store / seed / admission / memory
  write. It **selects the next product wedge**; it does not implement it.
- **The next wedge is the Admission Wedge MVP, not full production
  Straylight.** Recall Wedge (accepted Phase 42D, §5n) proved read/recall:
  already-admitted or seeded continuity state can be recalled safely
  through a live Discord surface. The Admission Wedge is the missing
  write/admission half: a candidate memory becomes admitted continuity
  state through an explicit governed admission transition, then is recalled
  later through the already-accepted Recall Wedge path. The product is not
  real memory until there is a governed path for something to *become*
  memory — but this is built as a **bounded second wedge**, not a giant
  production system.
- **Core invariant fixed:** candidate memory is not admitted memory;
  candidate memory must not be recallable as governed continuity until an
  explicit admission transition accepts it. No implicit promotion (consistent
  with §7's raw → candidate → admitted separation); rejected candidates
  never become recallable.
- **Implementation lanes ranked (none authorized here):** Lane A —
  fixture / operator admission packet (safest, recommended first); Lane B —
  dev/operator-only explicit candidate command (a dev-only
  `/remember-this`, riskier, separately gated, later); Lane C — automatic
  Discord chat ingestion (**blocked**, §8); Lane D — full production
  Straylight admission / storage / auth / consent (**blocked for now**,
  reachable only under §7 in full).
- **Posture held:** storage stays fixture / dev-operator deterministic
  packet (durable Postgres-backed production estate storage remains later,
  §7); authority stays synthetic / operator-dev only (cross-user consent
  and production auth remain blocked); no public-channel output, no public
  remember-this, no automatic memory from chat, no ambient listening, no raw
  candidate payloads in public output.
- **Cross-repo boundaries (decision level only, no implementation
  authorized):** Straylight would own canonical admission / estate /
  receipt semantics; Dixie would own the admission service route / policy /
  auth boundary; Freeside Characters would be the live Discord surface /
  controlled operator demo. All subject to §7 and a future gate.
- **Does not authorize:** production memory admission, public remember-this,
  Discord history ingestion, durable production storage, production auth /
  consent, cross-user sharing, public rollout, a Discord command
  implementation, a live Dixie admission route, a Straylight production
  store, memory writes from Discord, LLM rewriting, character voice
  admission / rendering, or forget / revoke / correction implementation.
  Everything in §5l / §5n's blocked lists, §7, and §8 remains in force.
- **Recommended next decision: Phase 43B — Admission Wedge MVP design
  (docs / design or fixture-design only)** (`docs/ADMISSION-WEDGE-MVP-DESIGN.md`):
  define the candidate / admission packet shape, the explicit admission
  transition, the admission receipt / audit event, and the acceptance tests
  **before** implementation, preferring Lane A — under the §7 gates. Phase
  43A implements no admission.

This addendum does not duplicate the Phase 43A gate doc; it only updates
this section's **next-wedge** answer from "Admission Wedge decision-gate
recommended" (Phase 42D §5n) to "Admission Wedge MVP selected as the next
product wedge; Phase 43B docs/design-only is the recommended next step."

---

### 5p. Phase 44B addendum — fixture-bound reducer accepted; next lane is a fixture-bound dev/operator reducer runner (Phase 44C), not a live admission implementation

> Added by Phase 44B
> (`docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`), 2026-06-02.
> Targeted addendum, not a rewrite of this section.

Status as of Phase 44B:

- **Phase 44B is docs / decision only.** It adds no source, test, fixture
  JSON, package, lockfile, config, CI, or generated change, and no
  handler / registration / dispatch / package-export change. It implements
  nothing.
- **It accepts the Phase 44A fixture-bound reducer (PR #156) as the local
  reducer proof.** Phase 44A — the pure, dependency-free reducer / adapter
  over the Phase 43C fixtures
  (`packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`)
  — is accepted as sufficient proof of fixture-bound reducer semantics, the
  local reducer input / output contract, fail-closed malformed-input
  behavior, the safe-projection / no-leak posture, and the
  candidate / admitted / rejected / superseded distinctions. It is **not**
  accepted as production admission, runtime storage, a public command, or a
  user-facing write path.
- **It selects Phase 44C — a fixture-bound dev/operator reducer runner —
  as the next lane.** A local script / test-only runner that reads the
  existing Phase 43C fixtures, calls the existing Phase 44A reducer, and
  prints operator-safe scenario summaries (before-admission excluded;
  accepted included; rejected excluded; supersession corrected-only;
  malformed fail-closed). It would add no fixtures, mutate no reducer
  semantics, and call no Discord / Dixie / storage / network / LLM /
  production auth. Exporting the reducer as a package surface is deferred;
  a Dixie-side admission contract request is sequenced after the runner; a
  live Dixie admission route and a dev/operator candidate command stay
  blocked / separately gated.
- **Live Dixie-backed admission, production storage / admission, public
  remember-this, Discord history ingestion, user chat becoming memory,
  production auth / consent, public rollout, Telegram / private chat, LLM /
  voice, a forget / revoke / correction UI, and Finn production wiring all
  remain blocked** behind separate later gates. Phase 44B expands the Phase
  43A / 43B authorization in no way, and §7 (live memory admission gates)
  and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 44B gate doc; it only updates
this section's **next-lane** answer to "the Phase 44A fixture-bound
reducer is accepted as the local reducer proof, and the next lane is a
fixture-bound dev/operator reducer runner (Phase 44C), not a live
admission implementation."

---

### 5q. Phase 44C addendum — fixture-bound dev/operator reducer runner added; runner only, no live admission

> Added by Phase 44C, 2026-06-02. Targeted addendum, not a rewrite of this
> section.

Status as of Phase 44C:

- **Phase 44C implements the Option A lane Phase 44B selected (§5p).** It
  adds a local dev/operator runner
  (`packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
  + `.test.ts`) that *reads* the existing Phase 43C fixtures and *calls* the
  existing Phase 44A reducer to print operator-safe scenario summaries
  (before-admission excluded; accepted included; rejected excluded;
  supersession corrected-only; a synthetic malformed fail-closed case
  constructed in memory, never written to fixture JSON). Each summary carries
  only safe fields — scenario name, outcome, stable reducer reason code,
  short fixture ids, an audit-link presence boolean, a canned one-liner — and
  is sealed through the reducer's own no-leak scan.
- **It mutates no fixture and reimplements no reducer semantics.** The runner
  reads the Phase 43C fixtures read-only and composes the Phase 44A reducer;
  it is the analogue of the accepted Recall Wedge Phase 35B dev/operator
  runner.
- **It is wired into no runtime path.** The runner is imported only by its
  own test and a local `import.meta.main` CLI guard; it is not exported from
  the package surface and is not reachable from Discord, Dixie, the renderer,
  dispatch, startup, or command registration.
- **Live Dixie-backed admission, production storage / admission, public
  remember-this, Discord history ingestion, user chat becoming memory,
  production auth / consent, public rollout, Telegram / private chat, LLM /
  voice, a forget / revoke / correction UI, package exports, and Finn
  production wiring all remain blocked** behind separate later gates. Phase
  44C expands the Phase 43A / 43B / 44B authorization in no way, and §7 (live
  memory admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 44C status note in
`docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` §12; it only records that
the Phase 44B-selected runner lane is now implemented as a fixture-bound
dev/operator runner, not a live admission implementation.

---

### 5r. Phase 44D addendum — fixture-bound runner accepted; next lane is a docs/cross-repo Dixie-side admission contract request (Phase 45A), not a live admission implementation

> Added by Phase 44D
> (`docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`), 2026-06-02.
> Targeted addendum, not a rewrite of this section.

Status as of Phase 44D:

- **Phase 44D is docs / decision only.** It adds no source, test, fixture
  JSON, package, lockfile, config, CI, or generated change, and no
  handler / registration / dispatch / package-export change. It implements
  nothing.
- **It accepts the Phase 44C fixture-bound dev/operator reducer runner
  (PR #158) as the local runner proof.** The runner
  (`packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`)
  — which *reads* the Phase 43C fixtures and *calls* the Phase 44A reducer
  to print operator-safe scenario summaries (before-admission excluded;
  accepted included; rejected excluded; supersession corrected-only;
  malformed fail-closed) — is accepted as sufficient proof of fixture-bound
  operator-readable runner behavior, the local demo / report output, the
  five safe scenario summaries, the no-leak runner output posture, reducer
  integration without runtime wiring, and the end-to-end local proof stack
  (fixtures → reducer → runner). It is **not** accepted as production
  admission, runtime storage, live Dixie admission, a public command, a
  user-facing write path, or platform-level admission UX.
- **It selects Phase 45A — a Dixie-side Admission Wedge contract request /
  handoff — as the next lane.** A docs / cross-repo request artifact,
  authored on the Freeside Characters side, that summarizes the proof stack
  (43B design · 43C fixtures · 44A reducer · 44C runner), enumerates the
  candidate / admitted / rejected / superseded semantics, and asks the
  Dixie / Straylight owners to define or accept a live admission contract
  *later* — carrying forward the invariant that candidate memory is not
  admitted memory until an explicit admission transition accepts it. It
  authorizes no implementation in any repo. Local hardening / an operator
  runbook is deferred; a live Dixie admission route and a dev/operator
  candidate command stay blocked / separately gated; a package export is
  deferred until a consumer requires it.
- **Live Dixie-backed admission, a Dixie-owned admission contract,
  production storage / admission, public remember-this, Discord history
  ingestion, user chat becoming memory, production auth / consent, public
  rollout, Telegram / private chat, LLM / voice, a forget / revoke /
  correction UI, package exports, and Finn production wiring all remain
  blocked** behind separate later gates. Phase 44D expands the Phase 43A /
  43B / 44B / 44C authorization in no way, and §7 (live memory admission
  gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 44D gate doc; it only updates
this section's **next-lane** answer to "the Phase 44C fixture-bound runner
is accepted as the local runner proof, and the next lane is a docs /
cross-repo Dixie-side admission contract request (Phase 45A), not a live
admission implementation."

---

### 5s. Phase 45A addendum — Dixie-side admission contract request authored; cross-repo request only, no live admission implementation

> Added by Phase 45A
> (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`), 2026-06-02.
> Targeted addendum, not a rewrite of this section.

Status as of Phase 45A:

- **Phase 45A is a docs / cross-repo request only.** It adds no source,
  test, fixture JSON, package, lockfile, config, CI, or generated change,
  and no handler / registration / dispatch / package-export change. It
  implements nothing in any repo and changes no Dixie code.
- **It authors the Phase 44D-selected lane (§5r):** a Freeside
  Characters-side request / handoff
  (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`) that summarizes the
  accepted proof stack (43B design · 43C fixtures · 44A reducer · 44C
  runner), carries the invariant that candidate memory is not admitted
  memory until an explicit admission transition accepts it, and enumerates
  the contract decisions it asks the Dixie / Straylight owners to define or
  accept *later* — candidate intake envelope, explicit admission
  transition, admitted assertion shape, rejection transition, supersession /
  correction transition, admission receipt / audit fields, recall-eligibility
  boundary, service-auth-vs-end-user-authorization distinction, storage /
  admission non-goals, and no-leak public-response requirements. It also
  carries a clearly non-authoritative proposed minimum vocabulary the owner
  must confirm, rename, or reject.
- **It does not claim a Dixie admission contract already exists**, accepts
  no contract, and authorizes no implementation. The next possible phases
  it lists but does not authorize are a Dixie-side / cross-repo contract
  acceptance or response (Phase 45B), a Freeside Characters reconciliation
  against an accepted contract (Phase 45C), and — only after a contract
  exists — a later live Dixie admission route gate and a later separately
  gated dev/operator candidate command.
- **Live Dixie-backed admission, a Dixie-owned admission contract,
  production storage / admission, public remember-this, Discord
  message-history ingestion, user chat becoming memory, production auth /
  consent, public rollout, Telegram / private chat, LLM / voice, a forget /
  revoke / correction UI, package exports, and Finn production wiring all
  remain blocked** behind separate later gates. Phase 45A expands the Phase
  43A / 43B / 44B / 44C / 44D authorization in no way, and §7 (live memory
  admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 45A request doc; it only records
that the Phase 44D-selected lane is now authored as a docs / cross-repo
Dixie-side admission contract request, not a live admission implementation.

### 5t. Phase 45C addendum — Dixie responded (Phase 33A / PR #118); Freeside reconciliation authored; reconciliation matrix is the next lane, not a live admission implementation

> Added by Phase 45C
> (`docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`), 2026-06-03.
> Targeted addendum, not a rewrite of this section.

Status as of Phase 45C:

- **Phase 45C is docs / reconciliation only.** It adds no source, test,
  fixture JSON, package, lockfile, config, CI, or generated change, and no
  handler / registration / dispatch / package-export change. It implements
  nothing in any repo and changes no Dixie code.
- **Dixie answered the Phase 45A request (§5s) with Phase 33A / PR #118**
  (`../loa-dixie/docs/ADMISSION-WEDGE-CONTRACT-RESPONSE.md`), a docs-only,
  code-inspection-grounded contract response. Dixie **accepted** the *need*
  for a Dixie-side or cross-repo-owned Admission Wedge contract before any
  live implementation, the core candidate / admitted invariant, the no-leak /
  fail-closed posture, the need to reconcile candidate / admitted / rejected /
  superseded semantics against the canonical Straylight lifecycle vocabulary
  (its §6 maps most proposed terms onto canonical names —
  `candidate_pending` → `proposed`, `admitted` → the `admit_assertion` /
  `assertion_admitted` act with resulting status `active`, `rejected` /
  `candidate_not_admitted` / `candidate_rejected` → `transition_denied`,
  `superseded` as-is), and a provisional **draft v0** vocabulary for
  *future* fixture / probe alignment.
- **Dixie did not freeze a production schema and did not implement a live
  route.** It explicitly kept storage writes, production admission /
  auth / consent, a public command, `/remember-this`, Discord history
  ingestion, chat-becomes-memory, package exports, LLM / voice, Finn
  production wiring, and a forget / revoke / correction UI blocked.
- **Phase 45C records the Freeside-side reconciliation** and selects
  **Phase 45D — a docs / decision reconciliation matrix / fixture-probe
  alignment gate** as the conservative next lane (compare the local 43C /
  44A / 44C proof stack against the Dixie 33A response; enumerate
  vocabulary / field mismatches; decide later whether to update local
  fixtures / reducer / runner labels — implementation still blocked).
- **Live Dixie-backed admission, a live Dixie admission route, a frozen
  final production schema, production storage / admission / auth / consent,
  public remember-this, Discord message-history ingestion, user chat
  becoming memory, public rollout, Telegram / private chat, LLM / voice, a
  forget / revoke / correction UI, package exports, and Finn production
  wiring all remain blocked** behind separate later gates. The current
  local fixture / reducer / runner vocabulary remains valid local proof
  labels until a future Phase 45D explicitly reconciles them. Phase 45C
  expands the Phase 43A / 43B / 44B / 44D / 45A authorization in no way, and
  §7 (live memory admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 45C reconciliation doc; it only
records that the Dixie response is now reconciled on the Freeside side and
that the next lane is a docs / decision reconciliation matrix gate, not a
live admission implementation.

### 5u. Phase 45D addendum — reconciliation matrix authored; fixture-probe alignment decision (Dixie-first) is the next lane, not an implementation

> Added by Phase 45D
> (`docs/ADMISSION-WEDGE-CONTRACT-RECONCILIATION-MATRIX.md`), 2026-06-03.
> Targeted addendum, not a rewrite of this section; §5t stays in force.

Status as of Phase 45D:

- **Phase 45D is docs / decision · docs-planning only.** It authors the
  reconciliation matrix the §5t / Phase 45C lane selected and adds small
  cross-reference back-notes; it adds no source, test, fixture JSON,
  package, lockfile, config, CI, or generated change, renames no fixture
  label, mutates no reducer reason code, and freezes no schema.
- **The matrix converts the Phase 45C narrative reconciliation into three
  explicit tables** — a per-label vocabulary matrix, a per-field
  field / shape matrix, and an A–J contract-area matrix — each pinning a
  status and a future action against the Dixie Phase 33A direction. It
  surfaces the 3-way `rejected` / `candidate_not_admitted` /
  `candidate_rejected` synonym collision, the proposal-only
  `unsupported_admission_shape` vs the emitted `unsupported_fixture_shape`,
  the missing idempotency key, and the `admission_authority` → canonical
  `SignerType` mismatch.
- **Phase 45D selects Phase 45E — a fixture-probe alignment decision /
  Dixie-first handoff (docs / decision)** as the conservative next lane,
  with a Dixie-first posture: Dixie / Straylight own the canonical
  vocabulary, and Dixie Phase 33B is the likely first canonical
  fixture / probe owner. Waiting for Dixie Phase 33B with no new Freeside
  gate is an acceptable alternative.
- **Live Dixie-backed admission, a live Dixie admission route, a frozen
  final production schema, production storage / admission / auth / consent,
  public remember-this, Discord message-history ingestion, user chat
  becoming memory, public rollout, Telegram / private chat, LLM / voice, a
  forget / revoke / correction UI, package exports, and Finn production
  wiring all remain blocked** behind separate later gates. The current local
  fixture / reducer / runner vocabulary remains valid local proof labels
  until a separately-authorized fixture / probe alignment implementation
  changes them. Phase 45D expands the prior authorization in no way, and §7
  (live memory admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 45D matrix; it only records that
the matrix is authored and that the next lane is a fixture-probe alignment
decision / Dixie-first handoff, not a live admission implementation.

---

### 5v. Phase 45E addendum — Dixie Phase 33C draft probes reconciled against the local proof stack; no-op adapter / validator (Phase 45F) is the next lane, not an implementation

> Added by Phase 45E
> (`docs/ADMISSION-WEDGE-DIXIE-PROBE-RECONCILIATION-GATE.md`), 2026-06-04.
> Targeted addendum, not a rewrite of this section; §5u stays in force.

Status as of Phase 45E:

- **Phase 45E is docs / decision only.** It authors the Dixie probe
  reconciliation / local alignment decision the §5u / Phase 45D lane selected
  and adds small cross-reference back-notes; it adds no source, test, fixture
  JSON, package, lockfile, config, CI, or generated change, renames no local
  fixture label, mutates no reducer reason code, and freezes no schema. It
  edits no `../loa-dixie` file.
- **The Dixie-first lane landed.** Dixie **Phase 33C / PR #120** authored the
  canonical **draft v0** Admission Wedge contract probe set
  (`../loa-dixie/docs/admission-wedge/fixtures/`): five synthetic, public-safe
  probes (`probe_version: dixie_admission_wedge_probe_v0`, `schema_final: false`,
  `runtime_enabled: false`, `production_admission: false`, `public_safe: true`)
  plus a dependency-free validator. Phase 45E maps each probe
  (`candidate_pending_not_recallable`,
  `accept_candidate_to_admitted_assertion`, `reject_candidate_no_assertion`,
  `supersede_with_corrected_assertion`,
  `malformed_or_unsafe_payload_fail_closed`) onto the local fixture / reducer /
  runner equivalents — clean at the semantic level, with only naming / shape
  deltas — and carries forward the pending-vs-denied nuance
  (`candidate_not_admitted` is *pending*, not denied) and that `corrected_active`
  is a direction, not a canonical status.
- **Phase 45E selects Phase 45F — a narrow, future-gated, test-only or
  docs / fixture-bound no-op Dixie probe adapter / validator** as the next
  lane: it would consume **mirrored** Dixie probe shapes and prove they map to
  the current local semantics, with **no** runtime wiring and **no** live Dixie
  calls. A local fixture-label rename is deferred until an adapter proves the
  mapping; waiting for a future Dixie Phase 33D hardening is an acceptable
  alternative.
- **Live Dixie-backed admission, a live Dixie admission route, a frozen final
  production schema, production storage / admission / auth / consent, public
  remember-this, Discord message-history ingestion, user chat becoming memory,
  public rollout, Telegram / private chat, LLM / voice, a forget / revoke /
  correction UI, package exports, and Finn production wiring all remain
  blocked** behind separate later gates. The current local fixture / reducer /
  runner vocabulary remains valid local proof labels until a separately-
  authorized fixture / probe alignment implementation changes them; Dixie Phase
  33C is a **draft v0**, not production schema, and Freeside Characters does not
  own the Dixie / Straylight vocabulary. Phase 45E expands the prior
  authorization in no way, and §7 (live memory admission gates) and §8
  (prohibitions) stay in force.

This addendum does not duplicate the Phase 45E decision; it only records that
the Dixie Phase 33C probes are reconciled against the local proof stack and
that the next lane is a narrow no-op adapter / validator (Phase 45F), not a
live admission implementation.

---

### 5w. Phase 45F addendum — no-op Dixie probe adapter / validator added; test-only / docs-fixture-bound, no runtime wiring

> Added by Phase 45F, 2026-06-04. Targeted addendum, not a rewrite of this
> section; §5v stays in force.

Status as of Phase 45F:

- **Phase 45F adds a test-only / docs-fixture-bound no-op adapter / validator
  over mirrored Dixie probes.** It implements the narrow Option A lane Phase
  45E selected (§5v): local **mirrored** copies of the Dixie Phase 33C draft v0
  probes under `docs/admission-wedge/dixie-probes/` (clearly marked local
  mirrors, not canonical upstream truth) plus a pure local adapter
  (`packages/persona-engine/src/recall-wedge/admission-wedge-dixie-probe-adapter.ts`
  + `.test.ts`) that maps the five Dixie probe scenarios
  (`candidate_pending_not_recallable` → `before_admission_excluded`,
  `accept_candidate_to_admitted_assertion` → `accepted_admitted_included`,
  `reject_candidate_no_assertion` → `rejected_excluded`,
  `supersede_with_corrected_assertion` → `supersession_corrected_only`,
  `malformed_or_unsafe_payload_fail_closed` → `malformed_fail_closed`) onto the
  current local proof scenarios.
- **It proves semantic mapping only.** The adapter is pure (no fs / network /
  env / clock / storage), imports only the pure Phase 44A reducer, and the test
  cross-checks each mapping against the existing Phase 44A reducer's output over
  the Phase 43C fixtures (the same scenario plans the Phase 44C runner uses) —
  not a reimplementation. It also proves no-leak over serialized results +
  formatted summaries and fail-closed on synthetic malformed input.
- **It does not rename local fixtures or reducer reason codes, mutates no
  fixture JSON, and runtime-wires nothing.** The adapter is imported only by its
  own test, is not exported from the package surface, and is reachable from no
  Discord / dispatch / startup / registration / renderer / live-Dixie path.
- **Live lanes remain blocked.** Live Dixie-backed admission, a live Dixie
  admission route, a frozen final production schema, production storage /
  admission / auth / consent, public remember-this, Discord message-history
  ingestion, user chat becoming memory, public rollout, Telegram / private chat,
  LLM / voice, a forget / revoke / correction UI, package exports, and Finn
  production wiring all remain blocked. Dixie Phase 33C stays a **draft v0**,
  not production schema, and Freeside Characters does not own the Dixie /
  Straylight vocabulary. Phase 45F expands the prior authorization in no way,
  and §7 (live memory admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 45F adapter; it only records that
the Phase 45E-selected no-op adapter / validator lane is now implemented as a
test-only / docs-fixture-bound mapping proof, not a live admission
implementation.

---

### 5x. Phase 45G addendum — Phase 45F adapter accepted as a test-only semantic bridge; Dixie Phase 33D probe hardening is the recommended next lane, not a Freeside implementation

> Added by Phase 45G
> (`docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md`), 2026-06-05.
> Targeted addendum, not a rewrite of this section; §5w stays in force.

Status as of Phase 45G:

- **Phase 45G is docs / decision only.** It accepts the Phase 45F adapter /
  validator and adds small cross-reference back-notes; it adds no source, test,
  fixture JSON, mirrored probe, package, lockfile, config, CI, or generated
  change, renames no local fixture label, mutates no reducer reason code,
  mutates no fixture JSON, and freezes no schema. It edits no `../loa-dixie`
  file.
- **Phase 45F is accepted as a bounded semantic bridge only.** Phase 45G
  accepts that Phase 45F proved exactly: the five Dixie probe scenarios map to
  the local proof scenarios (`candidate_pending_not_recallable` →
  `before_admission_excluded`, `accept_candidate_to_admitted_assertion` →
  `accepted_admitted_included`, `reject_candidate_no_assertion` →
  `rejected_excluded`, `supersede_with_corrected_assertion` →
  `supersession_corrected_only`, `malformed_or_unsafe_payload_fail_closed` →
  `malformed_fail_closed`), semantic equivalence against the Phase 44A reducer,
  no-leak over results / summaries, fail-closed on malformed input, and the
  not-wired / not-exported static guards. It accepts that Phase 45F proves
  **no** production schema, live route, storage, auth / consent, command,
  `/remember-this`, package API stability, or final vocabulary.
- **Phase 45G selects Dixie Phase 33D — Admission Wedge probe hardening /
  contract vocabulary refinement** as the recommended next lane: a **cross-repo
  handoff recommendation to Dixie** (not a Freeside Characters implementation
  authorization), recommending docs / decision or docs + non-runtime probe
  hardening that decides whether the draft v0 probes need stricter vocabulary /
  field / signer-authority / receipt-audit / idempotency alignment and whether a
  Straylight primitive review is required before any live route design.
  Freeside-side adapter hardening is low-value without a found gap; a package
  export and an adapter export are deferred; a live client / command is blocked.
- **Live lanes remain blocked.** Live Dixie-backed admission, a live Dixie
  admission route, a frozen final production schema, production storage /
  admission / auth / consent, a Discord command, public remember-this, Discord
  message-history ingestion, user chat becoming memory, public rollout,
  Telegram / private chat, LLM / voice, a forget / revoke / correction UI,
  package exports, adapter export, runtime wiring, and Finn production wiring
  all remain blocked. Dixie Phase 33C stays a **draft v0**, not production
  schema, and Freeside Characters does not own the Dixie / Straylight
  vocabulary. Phase 45G expands the prior authorization in no way, and §7 (live
  memory admission gates) and §8 (prohibitions) stay in force.

This addendum does not duplicate the Phase 45G decision; it only records that
the Phase 45F adapter is accepted as a bounded test-only semantic bridge and
that the recommended next lane is a cross-repo Dixie Phase 33D probe hardening,
not a Freeside Characters live admission implementation.

---

## 6. Decision gates before live Dixie client (Option C)

Before a live Dixie client is allowed, all of the following must hold:

- stable Dixie-safe Recall Wedge envelope (versioned shape, change
  policy);
- **recorded envelope fixtures first** — versioned Dixie-safe envelope
  samples on disk under `docs/recall-wedge/fixtures/` (Option H);
- **pure adapter from the versioned Dixie-safe envelope to the local
  projected DTO** — no network, no Dixie client, no I/O — implemented
  and reviewed before any live network call;
- **adapter tests before any live network call** — unit tests that
  exercise the adapter against the recorded envelope fixtures and
  prove the same `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` + §9 allowlist
  guarantees as the existing public-safe renderer tests;
- raw Dixie responses must **never** reach the public renderer — the
  adapter is the only narrowing boundary, and the public renderer
  consumes the local projected DTO, not raw envelope material;
- auth / caller model (who calls Dixie from this repo, how they
  authenticate, how failures are handled);
- tenant / community boundary (which estate / scope is being
  recalled);
- error / refusal semantics (mapped onto the renderer's reason codes
  or a stable superset);
- idempotency / retry posture (safe under repeated invocation, no
  silent admission on retry);
- no raw private material returned to the public renderer (the
  envelope must already be public-safe by the time it reaches the
  public surface);
- local fallback behavior (what happens when Dixie is unreachable —
  refusal vs. degraded billboard vs. nothing);
- audit / receipt expectations (what is logged where, with what
  retention).

---

## 7. Decision gates before live memory admission (Options E / G)

Before Discord messages, app interactions, or onchain stats become
**candidate memory** or **admitted memory**, all of the following must
hold:

- raw interaction source model (what is captured, by whom, with what
  retention);
- candidate memory model (how raw sources are nominated, reviewed,
  and either promoted or discarded);
- explicit admission path (no implicit promotion from raw → candidate
  → admitted);
- signer / authorization model (who is allowed to admit on whose
  behalf);
- consent assumptions (what the user agreed to, when, and how it is
  recorded);
- challenge / revoke / forget behavior (how a previously admitted
  assertion is challenged, revoked, or forgotten);
- audit receipt (every admission produces a verifiable record);
- storage decision (Postgres canonical, vector index as derived
  retrieval only — never as the source of truth);
- **duplicate / idempotency behavior** — admitting the same candidate
  twice must not produce two admitted assertions; retries must not
  silently re-admit;
- **candidate rejection / audit behavior** — rejected candidates leave
  an auditable record (who rejected, when, why) without becoming
  admitted memory;
- **raw source retention boundaries** — explicit retention windows for
  raw interaction sources, separate from candidate memory and from
  admitted memory; raw → candidate → admitted are separate retention
  classes;
- **Straylight-owned admission API boundary** — admission is
  performed via a Straylight-owned API; freeside-characters does not
  own the admission decision, the admission record, or the canonical
  store. Characters are frames over the substrate, not independent
  estates;
- **storage availability does not imply admission permission** — the
  presence of a Postgres / vector / Redis stack in this repo or in a
  shared environment does not, by itself, authorize this repo to
  admit memory;
- the rule that **app logs are not governed memory by default**
  remains in force (boundary doc §6).

Onchain stats (Option G) are subject to the same gates: tool output is
not memory until it has been through an explicit admission path with
the same signer / consent / audit shape.

---

## 8. What not to do next

Explicitly rejected for any near-term phase:

- do not make every Discord chat message memory;
- do not wire ambient recall;
- do not add passive listening;
- do not treat bot responses as admitted assertions;
- do not add production storage in the same PR as a Discord surface;
- do not add a live Dixie client in the same PR as memory admission;
- do not add character voice rewrite in the same PR as public recall;
- do not claim production authorization or consent is solved;
- do not make characters independent Straylight estates without a
  separate architecture decision (boundary doc §2).

These are not "discouraged" — they are out of scope until the
corresponding gates above are satisfied.

---

## 9. Recommended next phase

> **Latest status (Phase 45G, 2026-06-05 · authoritative in §5x).**
> Phase 45G has landed as a Freeside Characters-side **docs / decision
> acceptance gate**
> (`docs/ADMISSION-WEDGE-DIXIE-PROBE-ADAPTER-ACCEPTANCE-GATE.md`, §5x): it
> accepts the Phase 45F no-op Dixie probe adapter / validator **only as a
> test-only / docs-fixture-bound semantic bridge** — proving the five Dixie
> probe scenarios map onto the Phase 44A reducer scenarios with no-leak and
> fail-closed behaviour, and **nothing more** (no production schema, live
> route, storage, auth / consent, command, package API stability, or final
> vocabulary). Phase 45G adds no source, test, fixture JSON, mirrored probe,
> adapter, reducer, runner, package, lockfile, config, CI, or generated change,
> and edits no `../loa-dixie` file. Phase 45G **selects Dixie Phase 33D —
> Admission Wedge probe hardening / contract vocabulary refinement** as the
> next recommended lane: a **cross-repo handoff recommendation to Dixie**, not
> a Freeside Characters implementation authorization. **No Freeside Characters
> implementation lane is authorized**, and all live / runtime lanes — live
> Dixie-backed admission, a live Dixie admission route, a frozen production
> schema, production storage / admission / auth / consent, a Discord command,
> public remember-this, Discord history ingestion, user chat becoming memory,
> package exports, adapter export, runtime wiring, and Finn production wiring —
> **remain blocked**; §7 and §8 stay in force.
>
> **Earlier status (Phase 45F, 2026-06-04 · §5w — historical / superseded).**
> Phase 45F landed the test-only / docs-fixture-bound **no-op Dixie probe
> adapter / validator over local mirrored Dixie probes** (§5w) — local mirrors
> of the Dixie Phase 33C draft v0 probes plus a pure adapter that maps the five
> Dixie probe scenarios onto the Phase 44A reducer's scenarios and cross-checks
> them, proving semantic mapping and no-leak only. It wires nothing at runtime,
> exports nothing from the package surface, and calls no live Dixie route.
> Phase 45G (above) has since accepted it as a bounded test-only semantic
> bridge; read this and the Phase 45A / 45C / 45D status text below as
> **historical / superseded** — the ladder trail that led here, not the current
> next step.
>
> **Earlier status (Phase 45A, 2026-06-02 · §5s — historical / superseded).**
> Phase 44D selected **Phase 45A — a docs / cross-repo Dixie-side Admission
> Wedge contract request / handoff**, and that selection is now
> **satisfied**: Phase 45A is authored as this contract request / handoff
> (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`, §5s) — a Freeside
> Characters-side request that hands the accepted proof stack (43B design ·
> 43C fixtures · 44A reducer · 44C runner) to the Dixie / Straylight owners
> and asks them to define or accept a live admission contract *later*. Phase
> 45A authored only that Freeside Characters-side docs / cross-repo request /
> handoff: it implements nothing in any repo, changes no Dixie code, accepts
> no contract, and does **not** claim a Dixie admission contract already
> exists. **Phase 45A is therefore no longer a future / current recommended
> next phase; it is the current authored artifact.** Future possible phases
> remain **Phase 45B** (a Dixie-side / cross-repo response or contract
> acceptance), **Phase 45C** (a Freeside Characters reconciliation against an
> accepted contract), or — only after a contract exists — later separately
> gated live Dixie admission route / dev-operator candidate command work;
> **none of those future phases are authorized by Phase 45A.**
>
> **Update (Phase 45C, 2026-06-03 · authoritative in §5t).** Dixie has since
> answered the Phase 45A request with **Phase 33A / PR #118** (a docs-only
> contract response that accepts the *need* for a contract, the core
> invariant, the no-leak posture, and a provisional **draft v0** vocabulary,
> but freezes no production schema and implements no live route), and Phase
> 45C (`docs/ADMISSION-WEDGE-DIXIE-RESPONSE-RECONCILIATION.md`, docs /
> reconciliation only) reconciles that response on the Freeside side. The
> "Phase 45C reconciliation against an accepted contract" framing above is
> refined accordingly: the accepted artifact is a contract *response* (the
> need + a draft vocabulary), not a frozen contract. Phase 45C *then*
> selected **Phase 45D — a docs / decision reconciliation matrix /
> fixture-probe alignment gate** as the conservative next lane (historical;
> the ladder has since advanced docs-only through Phase 45D → 45E → 45F →
> **45G**, whose docs / decision acceptance gate (accepting the Phase 45F
> no-op probe adapter / validator as a test-only semantic bridge and selecting
> Dixie Phase 33D as the next cross-repo lane) is the latest status — see the
> §5x banner above and §5x; the older §5w "latest status" is **historical /
> superseded**); live admission, a live Dixie route, storage, a
> command, package exports, and Finn production wiring all remain blocked.
> The
> intervening recommendation (**Phase 44C — a fixture-bound dev/operator
> reducer runner**) is **completed**: the runner landed via PR #158 and is
> accepted by Phase 44D (§5r). The Phase 43A-era recommendation that
> follows (**Phase 43B — Admission Wedge MVP design**) is **historical and
> already completed**: the Phase 43B design was authored, the Phase 43C
> fixture contract landed via PR #155, and the Phase 44A fixture-bound
> reducer landed via PR #156 (accepted by Phase 44B, §5p). Read the
> remainder of this section as the superseded ladder trail, not the current
> next step. §7 (live memory admission gates) and §8 (prohibitions) stay in
> force; no blocked lane is unblocked.

**Phase 43A-era recommended next phase (historical / completed): Phase 43B
— Admission Wedge MVP design (docs / design or fixture-design only).**
Suggested doc: `docs/ADMISSION-WEDGE-MVP-DESIGN.md` — **now authored** (docs
/ design only): it defines the candidate / admission packet shapes, the
admission transition, the admission receipt, and the §7-governed acceptance
tests as concrete targets, preferring Lane A, and implements no admission.

> **Supersession note.** This section originally recommended **Phase 35B
> — explicit dev/operator Recall Wedge demo runner** (preserved as
> historical context below). That recommendation is **superseded.** The
> Recall Wedge ladder has since been built and accepted all the way
> through **Phase 42D** (controlled dev/operator seeded live recall served
> through Dixie and safely summarized in Discord — see §5n), and **Phase
> 43A** (`docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md`,
> see §5o) selected the **Admission Wedge MVP** — the write/admission half
> — as the next product wedge. The §5b–§5o addenda are the authoritative
> ladder record; this section's current recommendation follows them.

Per Phase 43A (§5o) and its gate doc §M, the then-recommended next phase
was **Phase 43B — Admission Wedge MVP design** (now completed; the
**Phase 44C** runner then recommended per §5p is likewise completed; and
the **Phase 45A** docs / cross-repo Dixie-side admission contract request
that Phase 44D then selected per §5r is now **authored and satisfied** —
see §5s and the current banner above. Phase 45A is no longer a future /
current recommendation; it is the current authored artifact. Future
possible phases (Phase 45B Dixie-side / cross-repo response or contract
acceptance, Phase 45C Freeside Characters reconciliation against an
accepted contract, or later separately gated live-route / candidate-command
work) remain listed but are **not authorized by Phase 45A**).
Phase 43B's scope was:

- docs / design or fixture-design only — **no implementation** of the
  admission wedge;
- define the candidate / admission packet shape and the gate doc §G
  candidate-vs-admitted taxonomy in concrete (but still design-level)
  terms;
- define the explicit admission transition (the candidate → admitted
  door) and the admission receipt / audit event;
- define the §I acceptance tests (made concrete) **before**
  implementation;
- prefer **Lane A** (fixture / operator admission packet) as the first
  proof;
- keep storage at fixture / dev-operator deterministic packet, authority
  synthetic / operator-dev only, and every public-surface posture intact;
- preserve the core invariant: candidate memory is not admitted memory,
  and a candidate is not recallable as governed continuity until an
  explicit admission transition accepts it;
- subject to §7 (live memory admission gates); everything in §8 and the
  Phase 43A §N blocked list stays blocked.

A later **Phase 43C** (or equivalent) would be the first reviewed Lane A
implementation, only after 43B's design is accepted. A dev-only
`/remember-this` (Lane B) is a separately gated, riskier, later follow-up
— not Phase 43B, not the MVP wedge's first step.

> **Status note (Phase 43C fixture / operator-contract).** A Phase 43C
> **fixture / operator-contract** now exists at
> `docs/admission-wedge/fixtures/`: deterministic candidate → transition
> → admitted → recall-proof fixtures plus a dependency-free validator
> that proves the §43A/§43B invariant (candidate is not admitted memory,
> not recallable before admission, recallable only after an explicit
> accept; rejected never recalls; supersession does not leak the wrong
> prior state). It is **contract-only** — no runtime, no command, no live
> admission route, no storage. The runtime Lane A implementation and the
> §7 live-memory-admission gates remain in force and separately gated.

> **Status note (Phase 44A fixture-bound reducer / adapter).** Phase 44A
> adds a pure, dependency-free local reducer / adapter over the Phase 43C
> fixtures at
> `packages/persona-engine/src/recall-wedge/admission-wedge-fixture-reducer.ts`
> (+ test), proving the §43A/§43B invariant *in code* against the
> already-existing fixture graph (classify candidate · apply transition ·
> project recall proof · reduce scenario, with stable fail-closed reason
> codes and a no-leak seal on every safe projection). It is **fixture-bound
> only**: it admits nothing, stores nothing, reaches no network, and is
> imported only by its own test — **not** wired into Discord, Dixie, the
> public renderer, the live client, dispatch, startup, command
> registration, or any package export. It **does not** authorize a live
> admission implementation, production admission, production storage,
> production auth / consent, public remember-this, Discord history
> ingestion, user chat becoming memory, a live Dixie admission route, or
> any Finn production wiring. The runtime Lane A implementation and the §7
> live-memory-admission gates remain in force and separately gated.

> **Status note (Phase 44B reducer acceptance / next-lane gate).** Phase
> 44B (`docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md`, docs / decision
> only) accepts the Phase 44A reducer (PR #156) as the fixture-bound local
> reducer proof and selects **Phase 44C — a fixture-bound dev/operator
> reducer runner** (a local script / test-only runner that reads the Phase
> 43C fixtures, calls the Phase 44A reducer, and prints operator-safe
> scenario summaries) as the next lane. It implements nothing; it
> authorizes no production admission, runtime storage, public command,
> user-facing write path, live Dixie admission route, or Finn production
> wiring. See §5p. The runtime Lane A implementation and the §7
> live-memory-admission gates remain in force and separately gated.

> **Status note (Phase 44C fixture-bound dev/operator reducer runner).**
> Phase 44C implements the Phase 44B-selected Option A lane: a local
> dev/operator runner
> (`packages/persona-engine/src/recall-wedge/run-admission-wedge-fixture-demo.ts`
> + test) that reads the Phase 43C fixtures, calls the Phase 44A reducer,
> and prints operator-safe scenario summaries (before-admission excluded;
> accepted included; rejected excluded; supersession corrected-only; a
> synthetic malformed fail-closed case). It mutates no fixture, reimplements
> no reducer semantics, is imported only by its own test + a local CLI guard
> (not exported, wired into no runtime path), and authorizes no live
> admission, storage, command, Dixie route, network call, package export,
> LLM / voice, or Finn production wiring. See §5q and
> `docs/ADMISSION-WEDGE-REDUCER-ACCEPTANCE-GATE.md` §12. The runtime Lane A
> implementation and the §7 live-memory-admission gates remain in force and
> separately gated.

> **Status note (Phase 44D runner acceptance / next-lane gate).** Phase
> 44D (`docs/ADMISSION-WEDGE-RUNNER-ACCEPTANCE-GATE.md`, docs / decision
> only) accepts the Phase 44C runner (PR #158) as the fixture-bound local
> runner proof — fixtures → reducer → runner, with operator-safe scenario
> summaries and a no-leak output posture — and selects **Phase 45A — a
> docs / cross-repo Dixie-side admission contract request / handoff** as the
> next lane. The Phase 45A artifact would summarize the Freeside Characters
> proof stack (43B design · 43C fixtures · 44A reducer · 44C runner),
> enumerate the candidate / admitted / rejected / superseded semantics, and
> ask the Dixie / Straylight owners to define or accept a live admission
> contract *later*; it authorizes no implementation in any repo. Phase 44D
> implements nothing; it authorizes no production admission, runtime
> storage, live Dixie admission, a Dixie-owned admission contract, a public
> command, a user-facing write path, a package export, or Finn production
> wiring. See §5r. The runtime Lane A implementation and the §7
> live-memory-admission gates remain in force and separately gated.

> **Status note (Phase 45A Dixie-side admission contract request).** Phase
> 45A (`docs/ADMISSION-WEDGE-DIXIE-CONTRACT-REQUEST.md`, docs / cross-repo
> request only) authors the Phase 44D-selected lane: a Freeside
> Characters-side request / handoff that summarizes the proof stack (43B
> design · 43C fixtures · 44A reducer · 44C runner), carries the §D
> invariant, and enumerates the candidate-intake / transition / admitted /
> rejection / supersession / receipt / recall-eligibility / auth / no-leak
> contract decisions it asks the Dixie / Straylight owners to define or
> accept *later*. It implements nothing in any repo, changes no Dixie code,
> accepts no contract, and does **not** claim a Dixie admission contract
> already exists. See §5s. The runtime Lane A implementation and the §7
> live-memory-admission gates remain in force and separately gated.

### 9.1 Historical context — superseded Phase 35B recommendation

> **Superseded.** Kept for ladder continuity only. The recommendation
> below was the original next step when this map was written at Phase 35A;
> it was carried out and the ladder has since advanced through Phase 42D
> and the Phase 43A Admission Wedge decision gate (see the supersession
> note above and §5b–§5o). Do **not** treat the following as the current
> recommended next phase.

**Original (superseded) recommended next phase: Phase 35B — explicit
dev/operator Recall Wedge demo runner.**

Suggested scope (historical):

- small / medium implementation PR;
- **package script or CLI runner** over the existing cross-interface
  demo
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`);
- prints deterministic operator-readable output, with public rendered
  text and internal proof data clearly separated and labeled;
- runs the existing validator
  (`node docs/recall-wedge/fixtures/validate-fixtures.mjs` from repo
  root) and tests
  (`cd packages/persona-engine && bun test src/recall-wedge/`);
- no `apps/bot/src/discord-interactions/*`;
- no command registration;
- no Discord API;
- no delivery path changes;
- no production / public API surface;
- no live Dixie;
- no production storage;
- no memory admission;
- no voice rewrite.

35B's value is operator ergonomics over the accepted MVP proof, not
new proof. It deliberately keeps the architectural boundaries from
collapsing while making the proof easier to inspect. **35B is
explicitly not Discord command work** — Discord command work has its
own operational gates (§5a) and is at minimum a Phase 35D Option B
question.

---

## 10. Open questions

Tracked here so future phases can pick them up without re-deriving:

- Should the first live surface be a dev/operator CLI, a dev-only
  slash command, or a private admin command?
- Who is the synthetic authorized caller in a live-ish demo (and
  what's the smallest model that lets us pretend without claiming
  production authorization)?
- When does fixture-bound become live-envelope-bound — i.e. what is
  the smallest swap from `docs/recall-wedge/fixtures/projected-dto/*`
  to a recorded Dixie envelope?
- What is the **minimum** Dixie envelope needed to satisfy the §9
  allowlist on the public side?
- What storage / admission decision blocks live memory — i.e. which
  Option D / E sub-decision is the actual long pole?
- What consent / identity model is required before any cross-user
  memory access is even discussable?
- Should the public renderer ever become character-voiced, and if so,
  under what determinism / leakage guarantees?
- Should Mibera / onchain stats ever be admitted as governed
  assertions, and through which admission path?
