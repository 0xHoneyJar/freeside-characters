# Recall Wedge fixtures — Phase 33B

Deterministic fixtures attached to `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md`
(Phase 33A boundary doc). These exist so Phase 33C can build a
public-safe renderer + no-leak validator and Phase 33D can stage the
cross-interface continuity demo, without having to re-author the shape
of the proof.

## What lives here

```
docs/recall-wedge/fixtures/
  seed-memory/
    shared-substrate-demo.memory.json    reviewed seed memory packet
  projected-dto/
    operator-private-view.dto.json       operator_private projection
    public-discord-view.dto.json         public_discord projection
    character-boundary-referral.dto.json public_discord referral projection
  dixie-envelope/                        recorded dixie envelope fixtures (phase 35d + phase 36b)
    recorded-public-discord-recall-envelope.v0.json
    recorded-referral-recall-envelope.v0.json
    recorded-unknown-version-envelope.json
    recorded-refusal-unauthorized-envelope.v0.json
    recorded-session-bearing-public-recall-envelope.v0.json
    recorded-authorized-private-target-envelope.v0.json
    recorded-public-telegram-target-envelope.v0.json
    recorded-malformed-missing-payload-envelope.v0.json
    recorded-malformed-missing-target-envelope.v0.json
  validate-fixtures.mjs                  phase 33b/35d/36b fixture validator
  README.md                              this file
```

`dixie-envelope/` is the home for recorded **Dixie-shaped recall
envelope** fixtures — Phase 35D shipped the first three; Phase 36B
expands the corpus with refusal/unauthorized, session-bearing, and four
intentional negative fixtures. These envelopes feed the pure adapter at
`packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`.
The adapter is the only narrowing boundary from a Dixie envelope to a
local projected DTO — the Phase 33C public renderer never reads a Dixie
envelope directly. The envelope fixtures intentionally include
raw / private / debug material (`raw_dixie_debug`, `raw_session_trace`,
`source_material`, `PRIVATE_SENTINEL_*`, `session_id`, `message_id`,
`continuity_actor_id`) so that adapter unit tests can prove none of it
passes through to the projected DTO or the rendered public output.

Recorded Dixie envelopes represent **recall responses / projected recall
payloads**. They are not raw chat log memory and they do not constitute
admission of any chat content into governed Straylight memory. Memory
authority remains with Straylight; live admission is post-MVP and out of
scope.

> **Recorded fixtures are sample v0 contract probes only.** They are
> not production schema authority. Live envelope contract truth must
> come later from a Dixie-side artifact, endpoint contract, or
> cross-repo decision. Adding more recorded fixtures, version bumps,
> or adapter dispatch entries does not promote any of those shapes to
> "the live contract" — see
> `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` §7a (recorded fixtures
> are examples, not schema authority).

#### Phase 37A addendum — reconciliation against Dixie Phase 32E / 32F

The Dixie-side contract evidence requested by Phase 36E now exists:

- Dixie **Phase 32E** is the governing Dixie Recall Wedge route
  contract for `POST /api/recall/intake`
  (`../loa-dixie/docs/integration/phase-32e-recall-wedge-route-contract.md`).
- Dixie **Phase 32F** is a cross-repo readiness checkpoint over
  Phase 32E
  (`../loa-dixie/docs/integration/phase-32f-recall-wedge-readiness-checkpoint.md`).
  Phase 32F is explicit that Phase 32E unblocks **downstream
  contract reconciliation only**, not live integration.

Phase 37A reconciles the recorded fixtures here against that evidence
(see `docs/recall-wedge/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md`). The
reconciliation verdict for these fixtures:

- The recorded fixtures are reconciled as **local fixture / probe
  envelopes**, not promoted to live Dixie schema authority.
- `recorded_dixie_recall_envelope` remains **fixture / probe-only**;
  it is a freeside-characters `input_envelope_kind`, not a Dixie-owned
  live wire kind.
- **Production traffic must not use `recorded_dixie_recall_envelope`.**
  Per Phase 32F §6, recorded probe inputs are reserved for
  fixture / probe use.
- These fixtures remain useful for **adapter no-leak / fail-closed
  proof only** — narrowing-boundary behavior, raw / private / debug
  stripping, public-safe minimization, and stable error codes on the
  negative corpus.
- No live Dixie, no Discord / Telegram command wiring, no production
  storage / admission, and no public renderer expansion are
  introduced by Phase 37A. Those remain blocked.

### Positive vs negative corpus

The Dixie envelope fixtures split cleanly into a **positive corpus**
(valid v0 envelopes the adapter projects through to a public-safe DTO)
and a **negative corpus** (intentional fail-closed shapes that drive
specific adapter error codes).

| Fixture | Class | What it proves |
|---------|-------|----------------|
| `recorded-public-discord-recall-envelope.v0.json` | positive · normal public | adapts to public_discord/discord_public_character DTO; renders safely; raw envelope material stripped |
| `recorded-referral-recall-envelope.v0.json` | positive · referral | adapts to referral DTO with safe target/message; renders safely |
| `recorded-refusal-unauthorized-envelope.v0.json` | positive · refusal/unauthorized | adapts to a public-safe generic-refusal DTO (reuses `outcome=referral` + `denied_or_refused=true` + a generic `safe_referral_target=authorized_session` and authorization-shaped `public_referral_message`); renders safely; **does not authorize a positive `authorized_private_session` projection** |
| `recorded-session-bearing-public-recall-envelope.v0.json` | positive · session-bearing | adapts to a public_discord DTO; **proves session_id / message_id / tenant_id / community_id / session_thread_id are stripped from the projected DTO and the rendered public text** |
| `recorded-unknown-version-envelope.json` | negative · unsupported version | adapter throws `unsupported_dixie_envelope_version` |
| `recorded-authorized-private-target-envelope.v0.json` | negative · authorized_private_session target | adapter throws `authorized_private_projection_not_implemented` (multi-surface contract §5a authorized-private DTO gate is unsatisfied) |
| `recorded-public-telegram-target-envelope.v0.json` | negative · public_telegram target | adapter throws `public_telegram_projection_not_implemented` (multi-surface contract §8a future-renderer warning's per-surface contract is unsatisfied for Telegram) |
| `recorded-malformed-missing-payload-envelope.v0.json` | negative · malformed | adapter throws `missing_public_recall_payload` |
| `recorded-malformed-missing-target-envelope.v0.json` | negative · malformed | adapter throws `missing_target_projection` (or stable-equivalent target-resolution error) |

### Phase 36B-specific rules

- **`session_id` / `message_id` are operational identifiers, not memory
  identity.** The session-bearing fixture exists to prove the adapter
  strips them; they must never appear on the adapted DTO or the
  rendered public output. (Multi-surface contract §5.)
- **`authorized_private_session` and `public_telegram` fixtures are
  negative-only in this phase.** They drive the adapter's existing
  fail-closed paths and **do not** authorize a positive
  `authorized_private_session` projection, an `authorized_private_session`
  renderer, or a `public_telegram` renderer. Those gates remain
  unsatisfied — see `docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` §8
  (authorized-private remains blocked) and §9 (public surfaces remain
  blocked).
- **No live integration is introduced by Phase 36B.** No live Dixie
  network call, no Discord command wiring, no Telegram bot wiring, no
  production storage, no admission, no LLM/voice rewrite. The corpus
  remains recorded-envelope-bound and dev/operator-gated.

`projected-dto/` is the neutral home for **all** projected views of the
seed packet — operator-private and public-safe alike. Naming it
`public-dto/` was misleading because the operator-private projection is
not a public projection; "projected DTO" describes what they all are
(narrow projections of the Dixie-safe Recall Wedge envelope) without
implying every projection is public-safe. Public-safety is a per-file
property enforced by the validator, not by the directory name.

## What seed memory packets are (and aren't)

Seed memory packets in `seed-memory/` represent **already-admitted
Straylight memory** for deterministic MVP proof. They are reviewed,
synthetic fixtures. They are **not**:

- runtime storage;
- a production memory database;
- raw Discord chat history;
- candidate memory;
- a canonical Straylight schema.

GitHub does not store memory. Straylight is the memory authority. GitHub
holds reviewed fixtures whose admission has already occurred upstream of
the demo. Live admission of new assertions is post-MVP and out of scope
(see `RECALL-WEDGE-MEMORY-MVP.md` §5–6).

The packet self-describes with this wording:

> This packet represents already-admitted Straylight memory for
> deterministic MVP proof.

## What projected DTOs are (and aren't)

DTO fixtures in `projected-dto/` are **public-channel projections of
the Dixie-safe Recall Wedge envelope**. They are deliberately narrow.
The operator-private view is also a projection — it is the projection
authorized for the `operator_private` frame, and it is not public-safe.

They are **not**:

- the full Straylight schema;
- the full Dixie response;
- the source of recall semantics;
- a replacement for Hounfour / Straylight types.

When the renderer lands in 33C it consumes seed memory and emits DTO
shapes like these for the requested frame. The renderer narrows the
Dixie envelope for the Discord public surface — it does not re-author
memory semantics.

## What the fixture set proves

Same continuity actor (`freeside-characters:shared-substrate`), same
already-admitted seed packet, three different authorized views:

| DTO fixture                          | recall_interface  | render_surface             | what it demonstrates                                              |
|--------------------------------------|-------------------|----------------------------|-------------------------------------------------------------------|
| `operator-private-view.dto.json`     | `operator_private`| `operator_debug`           | broader context, diagnostic counts, operator-only material allowed |
| `public-discord-view.dto.json`       | `public_discord`  | `discord_public_character` | redacted/excluded counts only, no private payload                 |
| `character-boundary-referral.dto.json`| `public_discord` | `discord_public_character` | safe referral when request is outside ruggy's boundary             |

The same packet under different frames yields demonstrably different
output. That is the Recall Wedge boundary — necessary for the cross-
interface demo (Phase 33D, see §1 of the boundary doc).

## Public-safety contract

The two **public-safe** projections — `public-discord-view.dto.json`
and `character-boundary-referral.dto.json` — must not contain:

- `raw_reasons`;
- raw JSON arrays of private reasons;
- debug payloads;
- hidden / private boundary reasons;
- unknown reason strings;
- full assertion bodies;
- private assertion IDs;
- private source material;
- hidden estate payloads;
- private identifiers;
- `PRIVATE_SENTINEL_*` strings.

Sentinel strings appear deliberately in the seed packet and the
operator-private projection. The Phase 33B no-leak validator
(`validate-fixtures.mjs`) greps the public-safe projections for these
substrings and fails loudly if any are present.

## Phase 33B / 35D fixture validator

`validate-fixtures.mjs` is a deterministic, dependency-free, Node-
compatible validator that locks the Phase 33B invariants in place and,
as of Phase 35D, also requires the recorded Dixie envelope fixtures.

Run it:

```bash
node docs/recall-wedge/fixtures/validate-fixtures.mjs
```

It checks (Phase 33B):

- every fixture JSON parses;
- the seed packet is `synthetic: true`,
  `fixture_kind: reviewed_seed_memory_packet`,
  `admission_state: already_admitted`, and names Straylight as authority;
- all projected DTOs share the same `continuity_actor_id` as the seed;
- every projected DTO (operator-private, public-discord, character-
  boundary-referral) references the seed packet by id via
  `source_seed_fixture`, so Phase 33D can mechanically prove the same
  seed packet underlies all three views;
- the operator-private projection is `recall_interface: operator_private`
  and `render_surface: operator_debug`;
- the public-discord and character-boundary-referral projections are
  `recall_interface: public_discord` and
  `render_surface: discord_public_character`;
- the referral projection has a `safe_referral_target` and a generic
  `public_referral_message`;
- the public-safe projections contain no `PRIVATE_SENTINEL` strings or
  banned-key substrings (`raw_reasons`, `debug`, `private_assertion_id`,
  `source_material`, `hidden estate`, `assertion_id`,
  `full assertion bodies`, `private identifiers`).

It also checks (Phase 35D + Phase 36B — required, not optional):

- the `dixie-envelope/` directory exists;
- all required Dixie envelope fixtures are present:
  - Phase 35D — `recorded-public-discord-recall-envelope.v0.json`,
    `recorded-referral-recall-envelope.v0.json`,
    `recorded-unknown-version-envelope.json`;
  - Phase 36B — `recorded-refusal-unauthorized-envelope.v0.json`,
    `recorded-session-bearing-public-recall-envelope.v0.json`,
    `recorded-authorized-private-target-envelope.v0.json`,
    `recorded-public-telegram-target-envelope.v0.json`,
    `recorded-malformed-missing-payload-envelope.v0.json`,
    `recorded-malformed-missing-target-envelope.v0.json`;
- every Dixie envelope fixture (positive **and** negative) carries the
  shared metadata invariants — `synthetic: true`,
  `fixture_kind: recorded_dixie_recall_envelope`,
  `input_envelope_kind: recorded_dixie_recall_envelope`,
  `envelope_version` present, `non_production_authorization_note`
  present;
- the **positive** v0 envelope fixtures (normal public, referral,
  refusal/unauthorized, session-bearing) use a **supported**
  `envelope_version` (currently `recall_wedge.dixie_envelope.v0`),
  and have valid `target_projection` and `public_recall_payload`
  objects;
- the refusal/unauthorized fixture is shaped as
  `target_projection.recall_interface=public_discord` with
  `outcome=referral` and `denied_or_refused=true` so it narrows to the
  existing public-safe contract (and **does not** authorize a positive
  `authorized_private_session` projection);
- the session-bearing fixture carries synthetic `session_id` and
  `message_id` so the adapter can be exercised to strip them;
- the **negative** fixtures are deliberately malformed/unsupported in
  exactly **one** specific way each, and the validator confirms each
  one is still negative in the way Phase 36B expects:
  - unknown-version — `envelope_version` present but **not** in the
    supported list;
  - authorized-private-target — supported version, but
    `target_projection.recall_interface=authorized_private_session`;
  - public-telegram-target — supported version, but
    `target_projection.recall_interface=public_telegram`;
  - malformed-missing-payload — supported version, `target_projection`
    present, but `public_recall_payload` **absent**;
  - malformed-missing-target — supported version,
    `public_recall_payload` present, but `target_projection`
    **absent**.

No leak-grep is run over raw Dixie envelope files: those intentionally
contain raw/private/debug sentinels (`raw_dixie_debug`,
`raw_session_trace`, `source_material`, `PRIVATE_SENTINEL_*`,
`session_id`, `message_id`, `continuity_actor_id`) because the adapter
in `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
is responsible for stripping that material before any rendering.
Public no-leak validation continues to gate only the public-safe
projected DTOs above; the adapter's own unit tests cover the Dixie
stripping behavior end-to-end.

The validator exits 0 on success and nonzero on any failure. It is
fixture-only — it does not import Straylight types, it does not call a
live Dixie client, and it does not attempt rendering. Renderer
implementation is Phase 33C; the cross-interface continuity demo is
Phase 33D; the recorded Dixie envelope adapter is Phase 35D.

## Categories that are not Recall Wedge memory

Per `RECALL-WEDGE-MEMORY-MVP.md` §6–7, two categories are explicitly not
governed memory by default and must not be promoted in the MVP:

- **Mibera / onchain holder stats** — external tool output (mibera-codex,
  score-mcp). They become Recall Wedge memory only if explicitly
  admitted as governed assertions. For the MVP, they stay separate from
  governed continuity memory.
- **Discord interaction logs** — raw source / candidate at most. They do
  not become Straylight assertions in the MVP.

The seed packet includes notes restating both, so the renderer and the
demo can show that the MVP keeps these categories distinct.

## Phase ladder (recap)

- 33A — boundary decision doc (`RECALL-WEDGE-MEMORY-MVP.md`)
- **33B — projected-DTO + seed-memory fixtures**
- 33C — public-safe Recall Wedge renderer + no-leak validator
- 33D — cross-interface continuity demo
- 34A — final MVP acceptance handoff
- 35A — post-MVP decision map
- 35B — operator demo runner
- 35C — multi-surface contract spec
- 35D — recorded Dixie envelope fixtures + adapter tests (`dixie-envelope/`)
- 36A — live-boundary decision (`docs/recall-wedge/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md`)
- 36B — expanded recorded Dixie envelope corpus + adapter/validator tests (refusal/unauthorized, session-bearing, authorized-private-target negative, public-telegram-target negative, malformed-missing-payload, malformed-missing-target)
- **36C — dev/operator runner over the recorded Dixie envelope corpus** (`packages/persona-engine/src/recall-wedge/run-dixie-envelope-demo.ts`). Side-effect-free by default; exports `buildDixieEnvelopeDemoReport`, `formatDixieEnvelopeDemoReport`, `runDixieEnvelopeDemo`. Public sections render only positive fixtures through `renderPublicRecallProjection`; negative fixtures appear under the INTERNAL / operator-only proof section as fail-closed summaries with stable error codes. No live Dixie / Discord / Telegram / storage / admission / voice.

If a later phase needs anything beyond what these fixtures shape, re-open
the 33A doc — do not silently expand scope here.
