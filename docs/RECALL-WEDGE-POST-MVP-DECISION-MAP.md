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

If Phase 37C lands and Phase 37D accepts it, the next decision (Phase
38A) is whether to expose a controlled public Discord test surface —
not a relaxation of this gate.

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
