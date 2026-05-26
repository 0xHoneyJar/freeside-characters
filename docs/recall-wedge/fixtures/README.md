# Recall Wedge fixtures — Phase 33B

Deterministic fixtures attached to `docs/RECALL-WEDGE-MEMORY-MVP.md`
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
  validate-fixtures.mjs                  phase 33b no-leak fixture validator
  README.md                              this file
```

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

## Phase 33B no-leak fixture validator

`validate-fixtures.mjs` is a deterministic, dependency-free, Node-
compatible validator that locks the Phase 33B invariants in place.

Run it:

```bash
node docs/recall-wedge/fixtures/validate-fixtures.mjs
```

It checks:

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

The validator exits 0 on success and nonzero on any failure. It is
fixture-only — it does not import Straylight types, it does not call a
live Dixie client, and it does not attempt rendering. Renderer
implementation is Phase 33C; the cross-interface continuity demo is
Phase 33D.

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
- **33B — these fixtures**
- 33C — public-safe Recall Wedge renderer + no-leak validator
- 33D — cross-interface continuity demo
- 34A — final MVP acceptance handoff

If a later phase needs anything beyond what these fixtures shape, re-open
the 33A doc — do not silently expand scope here.
