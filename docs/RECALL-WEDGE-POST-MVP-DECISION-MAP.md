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

**Recommended next phase: Phase 35B — explicit dev/operator Recall
Wedge demo runner.**

Suggested scope:

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
