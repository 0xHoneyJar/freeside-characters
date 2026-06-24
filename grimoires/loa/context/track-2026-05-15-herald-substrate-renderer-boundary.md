---
status: candidate
mode: dig+feel+arch
authored_by: claude opus 4.7 (1m) acting as OPERATOR + KEEPER + FEEL
authored_for: zksoju
operator_session: 2026-05-15
lenses: keeper · 3-plane · craft (ALEXANDER)
related_artifacts:
  - PR #73 (MERGED 2026-05-13) — cycle-021 pulse cards + dormant deterministic renderer
  - PR #77 (OPEN draft, this branch) — cycle-022 factor_stats type mirror + persona prompt
  - issue #74 — architectural deferral (cycle-021 enrichment vs deterministic cards)
  - score-mibera PR #116 (MERGED 2026-05-15) — cycle-022 verification primitives substrate (1.1.0)
  - score-mibera issue #115 — three-primitive doctrine ("type-checker for prose")
  - construct-effect-substrate — ECS ≡ Effect ≡ Hexagonal isomorphism, four-folder pattern
  - track-2026-05-13-weekly-digest-gap-analysis.md (operator's gap analysis)
  - apps/character-ruggy/silence-register.md (performed-silence doctrine)
  - vault/wiki/concepts/chat-medium-presentation-boundary.md (CMP-boundary)
  - packages/persona-engine/src/cron/scheduler.ts (the four cadences)
  - packages/persona-engine/src/config.ts (cadence defaults — pop-in/weaver default OFF)
revisions:
  - 2026-05-15 r0 — original HERALD proposal (third voiceless bear, separate cadence)
  - 2026-05-15 r1 — operator rejected HERALD, pivoted to ruggy-as-leaderboard + diagnosed cron silence as env-config bug
expiry: until shipped or explicitly retired
---

# track · 2026-05-15 · ruggy-as-leaderboard + cron silence diagnostic

> r1 supersedes r0. The HERALD proposal at the bottom remains as lineage —
> operator wanted ruggy to BE the data-clarity surface, not a separate voiceless
> third bear. This top section is the live shape.

## operator response · 2026-05-15 (verbatim, lightly trimmed)

> i mean silence in terms of i thought we wired up ruggy to cron/webhook-like sync with new updates of what's happening onchain on the score side but i have not seen any messages unprompted since (other than the digest from previous saturday). i don't know about a 3rd bear i just think ruggy for digests and data clarity should infuse X% less voice (small emojis and small additions but core data should surface through, just imagine a leaderboard in a game. it's not like there's that much personality on those).

Two distinct asks surfaced:

### thread A — diagnose cron silence (urgent · ~5-minute fix)

The KEEPER read of "silence" was wrong in r0. It's NOT performed-silence doctrine
working as designed — it's three of four cadences **never firing in production**
because their env-vars default to OFF.

Evidence from `packages/persona-engine/src/config.ts:161,170`:

```ts
POP_IN_ENABLED:  z.string().default('false').transform((v) => v === 'true'),
WEAVER_ENABLED:  z.string().default('false').transform((v) => v === 'true'),
```

And `cron/scheduler.ts:108,130`:

```ts
if (config.POP_IN_ENABLED) {  // ← false by default, scheduler skips
  ...
}
if (config.WEAVER_ENABLED) {  // ← false by default, scheduler skips
  ...
}
```

Boot log in `apps/bot/src/index.ts:73-74` distinguishes:

```
pop-ins:        every 6h · 10.0% chance/zone/tick     ← enabled
pop-ins:        disabled                              ← env var unset
```

The fourth cadence (event-heartbeat / ambient stir tier) IS enabled by default
but `scheduler.ts:151` explicitly says *"Stir is invisible by default — only
updates the kansei sibling channel."* So the heartbeat fires hourly but doesn't
post to THJ channels.

**Action for operator (you):**

1. check Railway / hosting env vars: are `POP_IN_ENABLED=true` and `WEAVER_ENABLED=true` set?
2. or read the bot boot log lines — if either says `disabled`, that's the gap
3. flip them on (env var, no code change needed) and observe:
   - weaver: next wednesday 12:00 UTC → stonehenge (single post)
   - pop-ins: ~1-2/day across 4 zones at 6h ticks × 10% probability
4. if pop-ins feel too frequent → bump `POP_IN_PROBABILITY` down (default 0.1, was lowered in V0.4 per operator feedback)

There's a secondary concern even after flipping these on: pop-ins use
`popInFits()` to skip flat-data zones (per `compose/post-types.ts:145`), so even
with cron enabled, a quiet week will still suppress pop-ins. That's the doctrine,
but operator should know it's another layer of "intentional silence" beyond the
env-var gate.

### thread B — ruggy-as-leaderboard digest shape

Operator's reframe (paraphrased): ruggy IS the data-clarity surface; HERALD as a
separate identity is over-engineering. ruggy's digest should be a game-leaderboard
shape — small emojis + small voice additions sprinkled on top of data that
carries itself. "it's not like there's that much personality on those."

This rejects the r0 third-bear shape but **keeps**:

- the dormant `buildPulseDimensionPayload` renderer from PR #73 — reactivates as ruggy's digest BODY (not as a separate post)
- the `factor_stats` consumption from PR #77 — feeds per-row emoji + permitted register
- the in-band Effect Layer prose-gate from operator's answer to Q3 — gates the voice elements that wrap the leaderboard

And **drops**:

- third webhook identity
- monday/sunday split
- HERALD avatar / name decision
- the separate `compose/herald.ts` module

#### the leaderboard shape (data-dominant · voice-as-seasoning)

```
yo team — 7 day pulse, og dim ran hot.                       ← header (1 line · gated voice · optional)

OG dimension · last 7 days
**N** events  ↓-XX.X%

Most active
🔥 Boosted Validator              29  ↓-71.8%               ← per-row emoji = gate output
👀 Burned Mibera                  12  ↑+50.0%               ← from factor_stats.cohort/magnitude
   Acquired Sets                   8  ↓-42.0%
   ...

Went quiet
☁️ Beraji Staker · CubQuest Minter · Acquired Ancestor       ← muted emoji = cold register

stay groovy 🐻                                                ← outro (1 line · always allowed)
```

The voice is:
- **header line** (1 line, lowercase, gated) — pulls from voice-grimoire stance cards but the GATE filters which cards are permitted based on factor_stats. when nothing earns interpretation → drops the header line entirely (silence-register's "italicized stage direction" template can substitute)
- **per-row emoji** (1 char per row) — operator-tunable mood-map: 🔥 for top-decile reliable factors, 👀 for high cohort-rank, ☁️ for went-quiet, no emoji when nothing is licensed. registry-driven (per-character emoji affinity), gate-permitted.
- **outro line** (1 line, lowercase) — rotates through `silence-register.md` templates or character's permanent close

The card body is **deterministic**: full ranked list, no truncation, dashboard-mirrored shape. carries 85-95% of the post's pixels. voice carries 5-15%.

#### what changes vs r0

| element | r0 (HERALD) | r1 (ruggy-as-leaderboard) |
|---|---|---|
| webhooks | 3 (ruggy + satoshi + HERALD) | 2 (ruggy + satoshi, unchanged) |
| cadence | mon HERALD card + sun ruggy digest | one fused digest per zone, saturday/sunday |
| LLM call | 0 for HERALD, 1 for ruggy | 1 for ruggy (small surface — header/outro/per-row mood only) |
| renderer | reactivated as standalone HERALD | reactivated as ruggy's body |
| voice fraction | ruggy 100% / HERALD 0% | ruggy ~10% / data ~90% |
| prose-gate | gates ruggy's interpretation prose | gates ruggy's header/outro/mood-emoji selection |
| satoshi | untouched | untouched |
| pop-in/weaver | unchanged | thread A unblocks them (env var flip) |

#### Effect Layer shape (operator confirmed in-band)

```
packages/persona-engine/src/
  ├─ score/
  │   ├─ types.ts              ← FactorStats lives here (PR #77 lands this)
  │   └─ client.ts             ← fetchDimensionBreakdown reactivates
  ├─ verify/                   ← NEW · in-band gate
  │   ├─ prose-gate.port.ts    ← port (claim → permitted register)
  │   ├─ percentile-register.live.ts ← rules: factor_stats → register tier
  │   ├─ mood-emoji.live.ts    ← rules: factor_stats → per-row emoji
  │   └─ prose-gate.mock.ts    ← stub mode + tests
  ├─ compose/
  │   └─ digest.ts             ← restructured · seasoning + card body
  └─ deliver/
      └─ embed.ts              ← buildPulseDimensionPayload reactivates HERE (not standalone)
```

The Effect single-provide-site pattern from construct-effect-substrate:
`Effect.provideService(ProseGate, ProseGateLive)` at the top of the digest
compose chain. ruggy's header/outro generation pulls from
`ProseGate.permittedStance(factor_stats)`; per-row emoji selection pulls from
`MoodEmojiRegister.forFactor(factor_stats)`.

#### mad-AI-thing surface (operator's % latitude)

LAYOUT itself adapts to what the substrate licenses. Not just prose-vocabulary.

- **all quiet** → italicized stage direction + tiny one-line tally line, no card:
  ```
  *ruggy peeks at the lab, shrugs, walks back to the cave.*

  og · 12 evts · -71%   nft · 8 evts · -42%   onchain · 5 evts · ±0
  ```

- **one dim hot** → that dim's full card + other dims' tally row:
  ```
  yo team — owsley lab just lit up.

  [full owsley card · sorted desc · factor_stats per row]

  other dims held steady:
  og · 12 evts · -71%   nft · 8 evts · -42%

  stay groovy 🐻
  ```

- **multi-dim hot** → full card per zone in that zone's channel, plus an optional
  cross-zone weaver post (if WEAVER_ENABLED — thread A unblocks this) in stonehenge.

This is the "type-checker for prose" at the LAYOUT layer. Not just refusing
words. Refusing structure when the substrate doesn't license it. Which is — and
operator may not have language for this — substrate-driven typography. The data
chooses how loud the page is.

#### what i'd ask before going further

1. operator wants to flip Railway env vars themselves OR wants me to file a follow-up issue documenting the diagnostic so it lives in beads?
2. for the per-row emojis (🔥 👀 ☁️ etc) — pull from ruggy's existing 43-emoji THJ guild catalog (in `orchestrator/emojis/registry.ts`) or use unicode standard emoji to keep the card mobile-readable across guilds? (THJ-only scope leans toward custom catalog; future portability leans standard.)
3. mood-map authorship — operator authors the rule sheet (factor_stats → emoji) directly in markdown, OR i sketch one and operator edits? this is taste territory; operator-authored is the canonical lift-pattern fit (construct-effect-substrate's lift-pattern-template.md).

---

# r0 (superseded) — herald as third voice

> Below is the original proposal. Operator rejected the third-bear direction in
> favor of ruggy-as-leaderboard (above). Preserved as lineage — the analysis of
> the substrate-vs-renderer boundary, the dormant renderer state, and the
> doctrine fit with construct-effect-substrate remain valid; only the surface
> shape changed.

## tl;dr (operator-readable in ≤8 lines)

- the digest unclarity + character silence are **two sides of one missing surface**
- cycle-022 (today) gave us "numbers, not verdicts" on the substrate side — `factor_stats` v1.1.0 per-factor empirical percentile ranks with reliability flags
- PR #77 (this branch) mirrors the types + extends ruggy's prompt but **defers the renderer decision** that issue #74 raised
- KEEPER reads the operator's "silence" two ways: (1) characters not present at all (bad) (2) characters refusing prose when prose isn't earned (good, doctrinally locked in `silence-register.md`)
- proposal: **HERALD pattern** — introduce a third, voiceless, deterministic "character" that posts the dashboard-mirrored data card on a separate weekday. it's not an agent, it's the data given dignity. ruggy gets to be gated-interpreter on sunday, knowing HERALD already said the numbers on monday. silence becomes honest because the data already spoke.
- this maps cleanly onto construct-effect-substrate's four-folder pattern (`domain/ports/live/mock`) + `hand-port-with-drift` + `doc-only-then-runtime`. PR #77 IS the doc-only step; HERALD is the runtime step.

## what's actually broken (KEEPER's read)

### substrate is fine; the surface is the problem

cycle-022 landed today. score-mibera PR #116 ships `factor_stats` v1.1.0 with three claim-type primitives (magnitude / cohort / cadence) per the doctrine zerker filed in score-mibera#115. the substrate is in better shape than the character surface has ever been in.

**but** — the consumer side (this repo, PR #77) is doc-only. it bumps the type-union and updates ruggy's `tool_invocation_style` prompt. it does NOT add a runtime gate that consumes `factor_stats.current_percentile_rank` + `magnitude.percentiles.p99.reliable` and refuses interpretation when the claim isn't earned. so right now: ruggy still drafts prose against an unbounded interpretive vocabulary; satoshi rubber-stamps; operator catches it from outside the loop. the substrate has a no-verdict test enforcing the boundary from the data side. the consumer has no symmetric type-checker.

### the digest path took a fork that bypasses the renderer

per issue #74's operator self-disclosure (2026-05-14): the dashboard-gap analysis walked the path from the data side and **independently re-derived an LLM-enrichment route** without grepping `compose/` + `deliver/` for the deterministic renderer PR #73 had just shipped. as a result:

| surface | state |
|---|---|
| `deliver/embed.ts::buildPulseDimensionPayload` (PR #73) | **dormant** — built, tested, never wired |
| `deliver/embed-pulse.test.ts` (7 describe blocks ~250 LoC) | testing dead code |
| `apps/character-ruggy/cycle-021-pulse-wiring.md` | superseded |
| `score/client.ts::fetchDimensionBreakdown` | unused |
| `score/types.ts` (4 pulse-tool interfaces) | forward-looking primitive, not consumed |
| **runtime path** | **LLM picks 1–3 factors per zone-digest within an 80–140 word prose budget** |

the LLM-enrichment path is internally consistent. it preserves ruggy's voice. it adds zero new infra. but: **it picks**. the dashboard's `/dimension/[id]` page shows ALL active factors ranked desc by volume. the renderer (PR #73) preserves that. the LLM doesn't. so readers in the THJ guild who want to see "what happened this week, all of it" — they don't.

### "character silence" is two phenomena, not one

KEEPER read of operator's "overall silence of the characters at the moment":

| read 1 (bad) | read 2 (good) |
|---|---|
| characters aren't being given enough surface to be PRESENT | characters are refusing forced prose when prose isn't earned |
| anti-spam invariant (V0.7-A.0) constrains them to only-on-summon | performed-silence doctrine (`silence-register.md`) explicitly templates "active presence without content" |
| pulse channels go dark for days at a time | the festival is breathing, not broken |

both reads are operating right now. the fix isn't picking one — it's **separating the surfaces** so each one has its own contract.

## the proposal — HERALD as the third voice

### shape

introduce a **third Discord webhook identity** in the THJ guild's per-zone channels. NOT a character in the persona-engine sense — no `persona.md`, no LLM call, no codex prelude, no voice-grimoire sampling. just a webhook face that posts the deterministic dashboard-mirrored card.

```
┌─[colored sidebar — dim color]──────────────────────────┐
│ ## OG dimension · last 7 days                          │
│ **N** events  ↓-XX.X%                                  │
│                                                        │
│ Most active                                            │
│ ```                                                    │
│ • Boosted Validator              29  ↓-71.8%           │
│ • Burned Mibera                  12  ↑+50.0%           │
│ • Acquired Sets                   8  ↓-42.0%           │
│ • ... (ALL active factors, no truncation)              │
│ ```                                                    │
│                                                        │
│ Went quiet                                             │
│ Beraji Staker · CubQuest Minter · Acquired Ancestor    │
└────────────────────────────────────────────────────────┘
```

this is **exactly the PR #73 layout** that was already locked through operator-review trim. the dormant renderer reactivates. the v1.1.0 `factor_stats` block becomes the optional second card (per-factor percentile rank + reliability flag, when permitted).

### why this works mechanically

1. **HERALD is voiceless by construction**. NO LLM call. NO MCP scope. NO prompt building. zero drift surface. the only thing it can render is whatever `factor_stats` makes available. it cannot rubber-stamp, because it cannot say.

2. **ruggy gets permission to be quiet** because the data already showed up. ruggy's sunday digest is no longer the only channel-presence event of the week. ruggy can stay in the 80–140 word prose budget and ONLY interpret what the prose-gate licenses. on weeks where nothing is interpretable → silence-register templates → "the festival is breathing." performed silence is honest because the numbers are already public.

3. **satoshi stays untouched.** locked register, sparse, gnomic. does not validate ruggy. does not comment on pulse. (satoshi remains the character whose entire register IS "the ledger acknowledges; attention is the asset"; HERALD does not undercut that — HERALD is the ledger speaking *as* the ledger, not as satoshi's interpretation of the ledger.)

4. **the prose-gate becomes load-bearing.** when ruggy DOES interpret, the gate enforces: `magnitude.current_percentile_rank ≥ 95 && magnitude.percentiles.p95.reliable === true` → "elevated, top decile" permitted. `cohort.unique_actors > 1` → "cluster" permitted. `cadence.current_gap_percentile_rank ≥ 90 + current_is_active` → "breaking pattern" permitted. **anything else → refuse the register**. the type-checker for prose that zerker's #74 comment sketched.

### cadence + channels (THJ guild specifically)

| channel | dim | monday 2pm UTC | sunday (existing) |
|---|---|---|---|
| bear-cave | og | HERALD card · `get_dimension_breakdown(7, 'og')` + factor_stats | ruggy digest · gated interpretation OR silence |
| el-dorado | nft | HERALD card · `get_dimension_breakdown(7, 'nft')` + factor_stats | ruggy digest · gated interpretation OR silence |
| owsley-lab | onchain | HERALD card · `get_dimension_breakdown(7, 'onchain')` + factor_stats | ruggy digest · gated interpretation OR silence |
| stonehenge | overall | HERALD card · `get_community_counts(7)` + `get_most_active_wallets(7, 5)` | ruggy digest · "what binds the room together" prose, gated |

**every week has guaranteed legible presence.** the HERALD cards never go quiet — even on a flat window, the card publishes "low-event week, here's exactly what happened." ruggy's variable presence layers on top.

### the construct-effect-substrate fit (this is doctrine adoption, not invention)

four-folder pattern maps cleanly:

```
packages/persona-engine/src/
  ├─ score/                                ← already exists
  │   ├─ types.ts                          ← domain (DTOs · factor_stats lives here in PR #77)
  │   ├─ client.ts                         ← live (fetchDimensionBreakdown — currently dormant)
  │   └─ codex-context.ts                  ← (codex prelude — orthogonal)
  ├─ verify/                               ← NEW · the prose-gate
  │   ├─ prose-gate.port.ts                ← port (claim → permitted register)
  │   ├─ percentile-register.live.ts       ← adapter (the actual rules — magnitude/cohort/cadence)
  │   ├─ percentile-register.mock.ts       ← adapter (for tests + stub mode)
  │   └─ claim-parser.ts                   ← domain (parse ruggy's draft for claim-types)
  ├─ compose/
  │   ├─ reply.ts                          ← already exists
  │   ├─ digest.ts                         ← already exists (ruggy's path)
  │   └─ herald.ts                         ← NEW · deterministic, no LLM
  └─ deliver/
      └─ embed.ts                          ← buildPulseDimensionPayload reactivates here
```

three patterns from construct-effect-substrate adopt directly:

1. **hand-port-with-drift** — `score/types.ts::FactorStats` is already the hand-port of `score-api/src/services/factor-stats.service.ts:57`. add a drift CI check that fails when the upstream type signature changes without a corresponding `factor_stats` mirror bump.

2. **doc-only-then-runtime** — PR #77 IS the doc-only step (type mirror + persona prompt). HERALD + prose-gate is the runtime step. the brand-type fence (the boundary between substrate truth and prose register) lives between the two cycles. construct-effect-substrate's pattern says: land the doc, let the type-system reject runtime that violates it, ship runtime in the next cycle. that's exactly here.

3. **single-effect-provide-site** — `verify/prose-gate.port.ts` gets a single Layer provider that injects `percentile-register.live` in prod and `percentile-register.mock` in tests. ruggy's compose-chain calls `Effect.provideService(ProseGate)` once at the top; everything downstream consumes the gated register without re-injection.

### why this is "mad-AI-stuff operator doesn't have language for"

KEEPER's mad-creative-loving observation:

**HERALD has no character because numbers are its character.** the brass-instrument webhook face (a sextant glyph, a compass needle, a single ƒ) sits in the THJ guild's per-zone channels every monday, posts the card, leaves. it never argues. it never interprets. it never gets caught doing shape-before-signal. it is the data given enough dignity to publish itself.

this is the soul-identity move from L7 soul-identity-doc: the file describes identity descriptively, never prescriptively. HERALD's identity-doc would say:
> i am the numbers. i do not interpret. i do not console. i do not warn. when the festival is loud, i show it loud. when the festival is quiet, i show it quiet. ruggy will interpret on sunday if interpretation is earned. if not, the silence will be ruggy's. it will never be mine — i am always the numbers, and the numbers are always something.

**the third bear is the bear that doesn't speak.** ruggy speaks when prose is earned. satoshi speaks in koans about attention as asset. HERALD doesn't speak at all — and that's the point. THJ guild gets three voices, and one of them isn't a voice. the operator's "I don't even have the language for" — this is the thing. silence-as-character. a character whose entire identity is the refusal to interpret. mibera-as-NPC doctrine but inverted: it's not the agent verified by the substrate; it's the substrate as an agent that refuses to be verified because verification implies opinion.

### what stays out of scope this proposal

- ❌ satoshi changes — locked register, no rubber-stamp role, no pulse commentary
- ❌ multi-guild rollout — focused on THJ guild only
- ❌ HERALD as LLM-driven — non-negotiable, voicelessness IS the contract
- ❌ deterministic-card replaces ruggy-digest — both run, different days, different roles
- ❌ wuxing / five-elements — mibera canon is 4-element western (Fire/Water/Earth/Air), not the purupuru cosmology
- ❌ prose-gate as a separate process — runs in-band during ruggy's compose chain via Effect Layer
- ❌ removing the existing LLM-enrichment in `tool_invocation_style` — the gate REPLACES the unbounded surface; the prompt becomes "interpret only what the gate licenses"

### what would belong in a sprint plan if approved

(this is the only place I'll let myself sketch implementation shape — keeps studio output from collapsing into a room contract.)

**phase 1 — HERALD ships** (deterministic, low risk, reactivates dormant code)
- new `compose/herald.ts` — input: zone + window + factor_stats. output: webhook payload.
- new `cron/herald-scheduler.ts` — monday 2pm UTC, per-zone, skips on `FEATURE_DISABLED` envelope
- new webhook identity in `.env.example` (HERALD_WEBHOOK_URL_OG / NFT / ONCHAIN / OVERALL)
- avatar + name lock (operator decides face/name — see AskUserQuestion below)
- reactivate `buildPulseDimensionPayload` + extend to consume `factor_stats` block when permitted
- tests: snapshot of one prod-shaped card per dim, regression guards against trimmed elements creeping back

**phase 2 — prose-gate ships** (interpretive, higher risk, locks ruggy's drift surface)
- new `verify/prose-gate.port.ts` + `percentile-register.live.ts` + `claim-parser.ts`
- new `verify/prose-gate.mock.ts` for stub mode
- ruggy's compose chain gets `Effect.provideService(ProseGate, ProseGateLive)` at top
- claim parser sweeps the drafted prose for claim-types (magnitude/cluster/cadence keywords)
- gate adjudicates per claim, returns `{permitted_register, refused_claims}`
- if `refused_claims` non-empty: regenerate with explicit refusal instruction, OR fall back to silence-register
- ruggy's `tool_invocation_style` collapses: numbers come from gate, interpretation comes from gate's permitted register, no free-text vocabulary outside the register
- tests: every operator-witnessed-drift case (sequential-mint "chain", "structural shift", "lockstep") becomes a regression case that the gate refuses

**phase 3 — cadence-interval primitive** (score-mibera side, not this repo)
- score-mibera#118 (filed, deferred) covers the weekly-grain cadence baseline
- HERALD + prose-gate can ship without it — they consume what 1.1.0 already exposes
- when it lands, HERALD's card adds an optional "cadence" line and the gate adds a `permit_cadence` rule

## three forks for the operator

i'll surface these via AskUserQuestion at the end of the chat reply. they're the load-bearing decisions:

1. **HERALD identity** — name + face. mad / charming / functional?
2. **HERALD vs ruggy cadence** — monday/sunday split, or interleaved, or operator-tunable per dim?
3. **prose-gate placement** — in-band Effect Layer during ruggy's compose (recommended) vs post-hoc validator vs operator-only telemetry first?

## what i did unreported (in line with operator's % latitude)

- read PR #73 + #77 + issue #74 + score-mibera#115 + #116 closure + construct-effect-substrate README
- traced the dormant renderer in `deliver/embed.ts` + the gap-analysis fork in `tool_invocation_style`
- mapped four-folder pattern onto the current `packages/persona-engine/src/` layout
- confirmed score-dashboard exposes `factor-list.tsx` + `factor-breakdown.tsx` + `factor-mini-sparkline.tsx` as per-dim surfaces — HERALD card mirrors that information shape
- did NOT promote any vault doctrine without activation receipt (operator's straylight discipline)
- did NOT touch any code

## one open question i'd ask if pairing in person

is "I'm not happy with the unclarity of responses with the digests" actually a digest-LEGIBILITY complaint (the LLM picks 1-3 factors arbitrarily), OR a digest-VOICE complaint (ruggy's prose feels forced when nothing's happening), OR both? the HERALD proposal addresses both, but if it's really only ONE of the two, the proposal could shrink to: just ship the prose-gate, don't introduce HERALD. operator framing on this collapses one phase or both.

## refs

- construct-effect-substrate: https://github.com/0xHoneyJar/construct-effect-substrate
  - patterns/hand-port-with-drift.md (cycle 2)
  - patterns/doc-only-then-runtime.md (cycle 2)
  - patterns/single-effect-provide-site.md (cycle 1+2)
- score-mibera#115 doctrine: type-checker for agent prose claims
- score-mibera#116 (merged 2026-05-15): cycle-022 verification primitives
- freeside-characters#74 (open): cycle-021 architectural deferral
- freeside-characters#77 (open draft, this branch): cycle-022 type mirror
- `apps/character-ruggy/silence-register.md`: performed-silence doctrine
- `packages/persona-engine/src/deliver/embed.ts::buildPulseDimensionPayload`: the dormant renderer (PR #73)

🐻 — soul-identity note: this track is descriptive. it states one operator's read of substrate state and proposes a shape. it does NOT prescribe. promotion to active context requires explicit operator approval.
