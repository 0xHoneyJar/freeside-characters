# Multi-register doctrine

> **Eileen on Purupuru's daemon voice across 5 surfaces** (vault:
> `storytelling-game-social-convergence.md`):
> *"Whisper · Tactician · Companion · Broadcaster · Witness — same character,
> different registers. The player moves between rooms and the daemon is
> already there, remembering what happened in the last room."*

A character is **multi-register by design**. One identity, N voices. The
register depends on the surface, the moment, and the data shape. This is the
forcing function that makes "one shell, many speakers" the right architecture
— and why the Discord 50-bot limit is a feature, not a constraint.

## Reframe (gumi 2026-04-29 walkthrough · issue #1)

The original V0.6-A draft of this doc framed the cabal-gygax archetypes as a
character voice axis (filtering 9 archetypes → "natural fits" → per-fire
rotation). **That was the wrong shape.** Per gumi's correction (issue #1 ·
Correction 1):

> *"the cabal-gygax archetypes aren't satoshi's moods — they're different
> player postures. rather than filtering the 9 down to natural fits, pick
> 1–2 archetypes that genuinely map to the character and base register
> variation there. fewer lenses, deeper voice."*

The 9 cabal archetypes are **AUDIENCE POSTURES** — how readers RECEIVE a
locked voice — not modes the character speaks through. Filtering them as
"character moods" was a category error. This doc reframes accordingly.

## How multi-register manifests in `freeside-characters`

Each character carries register variation along **one axis** (post-types) plus
**identity properties** (anchored archetypes — character traits, not rotating
filters).

### The axis: post-type registers (character-supplied)

Each character's `persona.md` declares fragment blocks for the 6 post-types.
Each fragment is a register shift. The same character speaks differently in
each:

| Post-type | Register shift |
|---|---|
| `digest` | structured, stat-quoting, weekly-review register |
| `micro` | casual drop-in, observation-only, no greeting/closing |
| `weaver` | cross-zone connection-naming, threshold-noting register |
| `lore_drop` | codex-anchored reference, head-nod-to-regulars |
| `question` | open-ended invitation, low-pressure |
| `callout` | calm voice over alarm-shaped data |

These are character-defined — Ruggy's six registers differ from Satoshi's
six (e.g. ruggy's callout leads with 🚨; satoshi's callout is structural-only
and never uses 🚨). The substrate doesn't prescribe what each register sounds
like; it just guarantees the right fragment is in scope when the right
post-type fires.

### The identity: anchored archetypes (character traits, NOT rotating filters)

Each character locks 1-2 archetype identities baked into the persona prompt.
These are character TRAITS that operationalize through voice rules — NOT
runtime modes the character switches between per fire.

| Character | Anchored archetypes (gumi-locked / operator-picked) |
|---|---|
| **Ruggy** | Storyteller + GM (festival NPC narrating arcs across zones) |
| **Satoshi** | Veteran + Chaos-Agent (the long view + uncertainty as observation) |

The other 7 archetypes per character are **culled**. They don't apply to that
character. A Newcomer-postured reader will find satoshi confusing — that's
correct reception, not a bug. The voice rules in each character's `persona.md`
operationalize the anchored archetypes; the labels are shorthand for trait
clusters, not levers the LLM pulls.

## Cabal-gygax: post-design RECEPTION TESTER (not compose)

The cabal-gygax subagent persists in code at
`packages/persona-engine/src/orchestrator/cabal/gygax.ts` but is **retired
from per-fire compose** (V0.6-C reconciliation 2026-04-30 per gumi correction
§0.5 #1).

A future `/cabal` command runs cabal POST-DESIGN against published posts:

```
published satoshi posts
   ↓
/cabal --all "satoshi-week-1"
   ↓
each archetype reads the post and reports:
  Veteran:        "this resonates — pattern recognition lives here"
  Chaos-Agent:    "the uncertainty handling is satoshi-shaped"
  Newcomer:       "I am confused, this register doesn't onboard me"
  Optimizer:      "no mechanic-detail here, this isn't for me"
  ...
   ↓
audience-divergence findings = playtest data for the operator
```

The findings are not "the voice is wrong." They're "this voice resonates with
these audience postures, diverges from those." Newcomer-confusion is
acceptable when the character is anchored as Veteran + Chaos-Agent — the
character isn't FOR Newcomers. That's the gumi-canonical use of cabal.

## Why this matters

### "The strongest dNFT is the most meaningful companion"

Per Eileen (`puruhani-as-spine.md`), the goal isn't autonomous mibera-agent. It
is a **meaningful companion** that miberas (community members) actually build
relationship with. Voice fidelity across post-type registers is the
load-bearing capability — recognizing that the digest-Ruggy and the micro-Ruggy
and the callout-Ruggy are all the same Ruggy, just speaking in different
shapes.

If a character flattens to one register ("ruggy says the same thing every
time"), it stops being a companion and becomes a feed. Multi-register doctrine
prevents that flattening — without rotating through audience postures.

### Cross-character co-existence

V0.6-C lands satoshi alongside ruggy. They don't compete for "the bot's voice"
— each carries their own post-type register-set + their own anchored
archetypes. Eileen explicit: *"if ruggy say something, can satoshi
read/write?"* — that's V0.6-D phase 2, the cross-character interaction layer
that the multi-register architecture makes possible.

## Three cross-cutting doctrines (gumi 2026-04-29 · all characters)

These doctrines apply beyond satoshi to the character architecture broadly:

1. **Performed silence > literal silence** — when a character has nothing of
   substance to say, they STAGE the silence rather than going dark. Brief
   dismissal (`"there is nothing of note here"`) or italicized stage-direction
   (`*satoshi observes the room and shakes his head*`). Active presence
   without content beats absence. Generalizable.

2. **Messenger ≠ terse** — words are the tool, not the enemy. Sparseness comes
   from precision and intentionality, not from rationing syllables. This is
   character-specific to satoshi but the principle holds generally: voice
   constraints come from voice, not from word-count.

3. **Hermes moves between worlds** — for satoshi specifically, zone
   flexibility is identity, not exception. Generalizes: a character's
   relationship to the substrate's surfaces (zones / channels) is part of
   their identity, not platform-imposed.

## What the substrate enforces

- The right post-type fragment is loaded for each fire (no leakage between
  post-types)
- Exemplars are sampled per-character per-post-type (no cross-character
  voice contamination)
- Anchored archetypes ride in the persona prompt as identity properties (no
  runtime mode-switching)
- Cabal-gygax dispatch is **NOT** in compose path (retired V0.6-C per gumi
  correction)

The substrate does NOT prescribe:

- What each character's 6 post-type registers sound like (character supplies)
- Which 1-2 archetypes anchor a character (character supplies via persona +
  metadata)
- Which registers a character even uses (a future character could omit
  `callout` if it doesn't fit them)

## V0.6 → V0.7 trajectory

In V0.6 (character-stage), registers are LLM-driven with rule-based + ICE
guidance. In V0.7+ (daemon-stage, per `puruhani-daemon.md`), registers
elevate to **designed-voice templates** with LLM as final-pass voice-in-context.
The multi-register architecture survives the transition unchanged — what
changes is the substitution mechanism (templates instead of system-prompt
fragments).

The cabal-gygax post-design `/cabal` command lives across both stages: at
character-stage it tests audience reception of LLM-generated posts; at
daemon-stage it tests audience reception of template-generated posts. Same
mechanism, different inputs.

## Provenance

- Original draft: V0.6-B 2026-04-29 (with the 6×9=54 framing — wrong shape)
- Reframed: V0.6-C reconciliation 2026-04-30 per gumi correction §0.5 #1
  (issue #1 walkthrough)
- Cabal retirement from per-fire compose: substrate orchestrator updated
  same date
