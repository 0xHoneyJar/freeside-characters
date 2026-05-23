---
status: active
promoted: 2026-05-22 (operator authorized formalization via /sprint-plan)
cycle: cycle-008-persona-substrate
type: amendment
title: voice-fidelity + preference-loop gaps
mode: ARCH (Ostrom) + craft lens (Alexander)
constructs: the-arcade (BARTH scope) + artisan (ALEXANDER) + observer (KEEPER for the loop)
source: operator live-test 2026-05-22 (owsley-lab micro screenshot) + issue #85 comment (score-api-types@0.6.0)
grounded: 2026-05-22 (file:line throughout — read-then-write, no inference)
owner: operator (zksoju) approves promotion · Loa executes
---

# cycle-008 amendment · voice-fidelity + preference-loop gaps

> **What this is.** Four threads the operator surfaced in-flow on 2026-05-22, mapped
> onto cycle-008's existing 9-sprint plan, decomposed into requirements + sprint
> placement + design forks. **Status: candidate.** Nothing here is active until the
> operator approves promotion and the forks (§4) are decided.

## 0 · coverage map — 4 threads × cycle-008's current plan

cycle-008's vision (`prd.md §0`) is already *voice-fidelity + the instrument to tune it*:
stats-out-of-voice, governance-vs-voice separation, observable boundary. The backbone
(S3 cron→`buildPrompt`) and scaffold (S4 trace schema, S5 trace capture, S6 `/tweak`
playground) are planned. These four threads are the **delivery-layer + preference-loop**
sitting on top.

| # | thread | cycle-008 status | where it lands |
|---|--------|------------------|----------------|
| 1 | window ≠ cadence | **PARTIAL** — voice-half (ruggy citing "352 events") fixed by S3 stats-out-of-voice; **card-half (footer "352 / 30d" on a ~daily cadence) is a GAP** | new FR-38 → amend S3 |
| 2 | voice/dense collapse into one msg | **GAP** — `"two message" 0 · "bold" 0` hits across prd/sdd/sprint. It's the *delivery-layer* form of governance-vs-voice separation, which cycle-008 only does at the *prompt* layer | new FR-39 → amend S3 (delivery) |
| 3 | eval/annotation loop | **PARTIAL** — S6 `/tweak` gives single-fire + sliders + presets; S5 gives machine outcome classification. Missing half: `"annotat" 0 · "preference" 0 · "side-by-side" 0` — the generate-N → pick → annotate → backpressure loop | new FR-40..42 → enhance S6 + new S9 |
| 4 | #85 score-api-types cutover | **ADJACENT** — S3 T3.1 *verifies* score-mcp schema but doesn't adopt the package; `"score-api-types" 0` | new FR-43 → new task near S3 |

## 1 · the reframe (load-bearing)

`#1` and `#2` are **symptoms** — both are voice/render tweaks. `#3` is the **instrument**
that makes `#1`/`#2` evidence-based instead of vibes-based. Top labs don't eyeball one
Discord screenshot — they fan out N candidates against a fixed input, pick/rank, and let
that preference data exert *backpressure* on the prompt. cycle-008 already builds the
trace capture (S5) + playground (S6). The preference loop is the missing layer that turns
"does this look right?" into "candidate B won 7/8 — promote it to the eval set."

## 2 · new requirements (grounded in code)

### FR-38 · cadence-honest card window  *(thread #1, card-half)*

**Problem.** The owsley-lab micro post (`discord-render.live.ts:221` `buildSubstrateFacts`
→ `:228` `renderMicro`) renders `snapshot.windowDays = 30` (set in
`live/score-mcp.live.ts:164,195` per the cycle-005 r4 amendment — at 7d, dim-channels
return zero factors). On a ~daily/6h cadence (`config.ts` `POP_IN_INTERVAL_HOURS` default
6 · or `DIGEST_CADENCE=daily`), a 30-day rolling total **barely moves post-to-post** — it's
not "what happened since you last heard from me." Bonus drift: the digest path uses
`PULSE_WINDOW_DAYS = 7` (`digest-orchestrator.ts:36`) while micro shows `30` — the
"two clocks" pattern cycle-006 was meant to close.

**Desired.** Separate the **licensing window** (how far back to decide what's worth
narrating — stays 30d for density) from the **reporting headline** (the number the reader
sees — reflects the cadence). The deterministic card shows a fresh, cadence-honest figure;
the 30d figure, if shown at all, is clearly labeled rolling context, not "today."

**Note — the voice-half is already covered.** ruggy citing "352 events drifted through"
in prose violates stats-out-of-voice (`prd.md §0`), which **S3's `buildPrompt` migration
already fixes** (cron stops running `voice-brief.ts`). FR-38 is *only* the card body.

**Acceptance (sketch).** (a) card headline reflects the cadence window OR a since-last-post
delta; (b) licensing/factor-density logic unchanged (still 30d); (c) digest + micro report
the same clock (close the two-clocks drift); (d) byte-snapshot regression test in
`evals/snapshots/`.

### FR-39 · voice/substrate delivery split  *(thread #2)*

**Problem.** `plainToPayload` (`live/discord-webhook.live.ts:30`) joins `voiceContent` +
`truthFields` into ONE Discord message via `[voice, factsLine].join('\n')`. Voice (warm,
character) and substrate (neutral, mechanical) collapse into one visual block — the exact
layer-collapse the governance-vs-voice doctrine (`prd.md §0`) warns against, but at the
delivery layer.

**Desired.** Two messages: msg1 = ruggy's voice (prose only); msg2 = the dense substrate
block, **bold**. The seam becomes visible: voice is one layer, truth is another. Applies to
the `plainToPayload` post-types (micro · lore_drop · question).

**Acceptance (sketch).** (a) micro/lore_drop/question deliver as two messages; (b) dense
block bold; (c) `message.content` always populated (Discord-as-Material fallback, per
`CLAUDE.md`); (d) underscore-escape preserved (`sanitize.ts`); (e) double-notification
behavior decided (see Fork B).

### FR-40 · generate-N candidate fan-out  *(thread #3, the loop — capture)*

**Problem.** S6's `/tweak` fires ONE candidate per click (`sprint.md §8 T6.4`
`playground-fire.ts --tweak`). No way to fan out N variants (seed/temp/prompt-fragment
variance) against a fixed input in one action.

**Desired.** A "fire N" mode: same input, N candidates (varying seed and/or a named
prompt-fragment variant), each captured as an S5 trace row (`outcome` already classified
per `sprint.md §7 T5.2`), grouped by a `batch_id`.

### FR-41 · side-by-side compare + pick + annotate  *(thread #3 — elicitation)*

**Desired.** Dashboard view (`scripts/dashboard.ts`, the S6 surface) renders a batch's N
candidates side-by-side (reusing the INV-10 oklch encoding + embed preview from `T6.5`).
Operator picks a winner (or ranks), and writes a free-text annotation ("too analyst",
"warmth landed", "stat leaked into voice"). Pick + annotation persist as a **preference
record** (JSONL, mirrors `compose/voice-memory.ts` zero-infra pattern).

### FR-42 · backpressure — preference → eval set + regression signal  *(thread #3 — the close)*

**Desired.** A picked+annotated winner can be **promoted to `evals/snapshots/`** as a
golden case (the existing regression substrate). Annotations accumulate as a labeled
corpus. This is the backpressure: the next prompt edit is validated against the operator's
own past picks. (V2 LLM-as-judge bootstrapped from these picks is a cycle-009 candidate —
see Fork C.)

### FR-43 · score-api-types package adoption  *(thread #85)*

**Problem.** `packages/persona-engine/src/score/types.ts` (206 LoC) is a local hand-roll;
zerker published `@0xhoneyjar/score-api-types@0.6.0` as the runtime-owned contract
(issue #85 comment). S3 T3.1 *verifies* score-mcp schema by hand but doesn't consume the
package.

**Desired.** Type-only adoption (`import type` = zero-runtime, no zod loaded). **Deltas from
the comment (verbatim constraints):** keep local `score-fetch.port.ts` (import data shapes
into it); `MostActiveWalletEntry` stays local (not in package until cycle-029); names that
live in >1 entity (e.g. `DimensionSummary`) are **deep-import only**
(`@0xhoneyjar/score-api-types/entities/<name>`), not the flat root barrel. The package's
JSON Schema (`/json/<entity>.v1.json`, permanent `$id`) can *feed* T3.1's verification gate.

## 3 · sprint placement (proposed)

| FR | thread | placement | est | risk |
|----|--------|-----------|-----|------|
| FR-38 | #1 card window | amend **S3** (cron path is being touched anyway) — new task T3.8 | ~½ day | LOW–MED (touches snapshot contract) |
| FR-39 | #2 delivery split | amend **S3** — new task T3.9 (delivery layer) | ~¼ day | LOW |
| FR-43 | #85 cutover | new task **T3.0** (run before T3.1; package becomes the contract source) | ~½ day | MED (type-surface swap) |
| FR-40 | #3 fan-out | enhance **S6** — T6.8 (`--fire-n` on playground-fire) | ~¼ day | LOW |
| FR-41 | #3 compare/annotate | new sprint **S9** — preference-elicitation UI + persistence | ~1 day | MED (new UI + storage) |
| FR-42 | #3 backpressure | **S9** — promote-to-evals + corpus | ~½ day | LOW |

Net: ~3.5 days added. S9 registers as the next global sprint (cycle-008 currently
sprints 21–29; close-gate advances `next_sprint_number` 21→30 per `sprint.md:473` — S9
slots before close as global sprint-30, close-gate advances to 31).

## 4 · design forks for the operator (lead with what to push back on)

**Fork A — #1 window design.** The thing to doubt: a pure cadence window (7d/24d) would
reintroduce the cycle-005 "dim-channels return zero at 7d" problem.
- **A1 (recommended): since-last-post delta.** Reuse `compose/voice-memory.ts` per-zone
  state to compute "+N events since last post." Most cadence-honest; reuses existing infra.
  Licensing stays 30d.
- A2: cadence-window headline (show 24h/7d total) + 30d as labeled context.
- A3: just relabel — keep 30d but say "30d rolling" so it stops *implying* "today." Cheapest, weakest.

**Fork B — #2 double-notification.** The thing to doubt: two messages = two Discord pings;
`POP_IN_PROBABILITY` was *lowered* explicitly so ruggy isn't annoying (`config.ts`).
- **B1 (you asked for this): two separate sends**, msg2 bold. Honors the request; costs a
  second ping. Mitigation: send msg2 with suppressed notification flag if Pattern-B webhook
  allows.
- B2: one message, voice block then a `**bold**` dense block — visual separation, single ping.

**Fork C — #3 loop ambition.** The thing to doubt: an LLM-as-judge with no calibration data
is just vibes-in-a-prompt.
- **C1 (recommended this cycle): human loop only** (FR-40/41/42). Collect operator picks +
  annotations as the ground truth.
- C2: add LLM-as-judge now (codify `voice-anchors.md` warmer/colder axis into a scorer).
- C3 (recommended overall): **C1 now, C2 in cycle-009 bootstrapped from the picks** — the
  RLHF-shaped path. Judge calibrated against real operator preferences, not guessed taste.

**Fork D — #85 sequencing.** Low stakes.
- **D1 (recommended): T3.0 before T3.1** — adopt the package, then T3.1's verification gate
  validates against the package's JSON Schema instead of hand-sampling.
- D2: standalone micro-task, decoupled from S3.

## 5 · verification deltas

- New byte-snapshot fixtures in `evals/snapshots/` for FR-38 (card window) + FR-39 (two-msg).
- FR-40..42 ride S5's trace rows + S6's dashboard; new tests for batch grouping + preference
  persistence + promote-to-evals.
- FR-43: type-check must stay green after the `score/types.ts` swap; `MostActiveWalletEntry`
  + deep-import `DimensionSummary` regression-guarded.
- OP-G-class live attestation: operator fires a fan-out batch, picks, annotates, promotes
  one to evals — end-to-end loop attestation (mirrors the cycle-007 PP-4 paste-to-Loa shape).

## 6 · next step

Operator decides Forks A–D, then this brief promotes from `candidate` → active and feeds a
`/sprint-plan` amendment that registers T3.0/T3.8/T3.9 + S9 in beads and the ledger.
No app code until that lands (`NEVER write app code outside /implement`).

## 7 · operator fork decisions + the billboard reframe (2026-05-22)

**The throughline (said three times across the forks): iteration speed on user-facing craft
is the real bottleneck.** "the iteration speed we have currently is too slow and doesn't
allow me to explore all the available ways to present." "it has to feel right — so far none
of them have landed." This makes **#3 (the preference/iteration loop) the keystone, not a
peer thread** — it's the instrument that unblocks #1/#2. Re-sequenced accordingly (§7.3).

### 7.1 · decisions

- **Fork A → separate the data-read from the voice as independently-tweakable surfaces.**
  Not a window-formula choice — a *separation* requirement. Data layer and voice layer must
  be tunable in isolation. (Cadence-honesty still applies to the data layer; FR-38 stands,
  but its framing shifts to "the data surface is its own thing.")
- **Fork B → the BILLBOARD reframe (supersedes the narrow "two messages" framing).** Two
  distinct non-chat surfaces, each *clearly itself*, never a mix:
  - **The Billboard** (scheduled digest) — "raw cleaned-up data in a billboard-like way."
    Clean, well-formatted, data-forward. Minimal/no character voice.
  - **The Pop-in** (event-driven) — "pop in to say something interesting that's happening
    on chain, with great formatting." A single notable event, surfaced well.
  - **Chat** (`/ruggy`, mentions) — ruggy is the agent. Conversational character.
  - Notifications are a non-issue ("none of them ping"). The mandate is **flexibility +
    fast iteration**, because "none have landed." FR-39 is rewritten around this.
  - **Convergence with `project-cron-post-types-pruning`:** digest → Billboard, pop-in →
    Event-spotlight. weaver / lore_drop / question / callout become prune candidates. The
    surviving two map exactly onto the operator's two non-chat surfaces.
- **Fork C → RLHF (full).** "I want to try RLHF." The preference loop (FR-40/41/42) is not
  just human-pick + promote-to-evals — it's the data-collection front-end of an RLHF-shaped
  pipeline. cycle-009 judge calibrates on the collected picks. C3 confirmed and elevated.
- **Fork D → T3.0 adopt the package before T3.1** (decided by agent, low stakes).

### 7.2 · FR rewrites driven by §7.1

- **FR-39 (was "two-message split") → "billboard + pop-in as distinct surfaces."** The cron
  route renders as a clean data Billboard (no voice mix) OR an Event-spotlight pop-in. The
  delivery layer (`live/discord-webhook.live.ts`) gains a Billboard renderer distinct from
  the voice path. The "two messages" the operator first described is one expression of this
  (agent voice msg + bold data billboard msg), but the deeper requirement is *each surface
  is unmistakably itself*.
- **FR-40/41/42 → RLHF data pipeline.** Preference records are structured as
  preference-pairs/rankings (RLHF-ready), not just "winner picked." The corpus is the
  training/calibration signal for the cycle-009 judge.

### 7.3 · re-sequencing

Because iteration speed unblocks everything else, the **iteration/preview surface leads**:

1. **S9-early (the loop, thinned to a preview-first slice):** a fast way to render the SAME
   data in N candidate presentations and pick — first for *layout/format* (billboard look),
   then for *voice*. This is the tool the operator uses to land #1/#2.
2. Then **FR-38 (data-surface cadence-honesty)** + **FR-39 (billboard/pop-in renderers)**
   land *through* that preview surface, with side-by-side evidence.
3. **FR-43 (#85)** remains independent infra, sequence near S3.
4. RLHF preference capture + promote-to-evals close the loop.

### 7.4 · manual loop fired 2026-05-22 (this is FR-41, run by hand)

Agent rendered a billboard candidate set against the real owsley-lab snapshot (352 events /
30d / 15 wallets / all-quiet) for operator side-by-side pick + annotation — demonstrating
the FR-41 elicitation loop manually before it's built. First preference record landed at
`preference-log.jsonl` (schema `rlhf-preference-v0`).

**Winner: Two-beat.** Annotation: *commits to the voice/data seam — agent voice as beat 1,
bold data billboard as beat 2; cures the "reads too bot" muddy-middle by refusing to mix.*

### 7.5 · locked two-beat spec (FR-39 concrete target)

Two sequential webhook sends (Pattern B · neither pings on the pop-in/digest cadence):

- **Beat 1 — the agent** (`voiceContent`): 1–2 short lowercase lines, **zero numbers**
  (stats-out-of-voice). All-quiet register example:
  > the lab's quiet today.
  > i'll keep the lamp on.
- **Beat 2 — the billboard** (`truthFields`, **bold**): zone header + cadence-honest data.
  ```
  🧪 OWSLEY LAB · onchain
  since last       +0          ← FR-38 hero: fresh delta (voice-memory per-zone state)
  30d rolling     352          ← rolling context, clearly secondary
  wallets warm     15
  state      all quiet
  ```

**Craft sub-decision (agent-decided, flag to push back on):** Discord code blocks give
guaranteed monospace alignment but **ignore `**bold**`**. The operator asked for bold →
render Beat 2 as **bold text with U+2007 FIGURE-SPACE column alignment** (the technique
already proven at `live/discord-render.live.ts:54` for Android `gg sans` tabular safety),
NOT a code block. Tradeoff: bold-figure-space depends on figure-space rendering (validated
in cycle-007 S3); code-block would be bulletproof-monospace but un-bold. Recommendation
stands on bold-figure-space because bold was the explicit ask.

**Open micro-decisions (defer to the preview surface, don't block):** whether to keep the
`30d rolling` row at all · exact label wording · separator between beats · the all-quiet
voice register vs an active-state register.

### 7.6 · the iteration-speed unlock (S9 lead slice)

The operator's root complaint — "iteration speed is too slow, none have landed" — is solved
by making the **billboard preview surface the FIRST thing S9 ships**: render any
zone+state+snapshot in N format variants, Discord-fidelity (real bold, ~40-char mobile
wrap, webhook avatar), pick + annotate → `preference-log.jsonl`. This turns the manual loop
fired today (§7.4) into a self-serve tool, and is the FR-40/41 capture front-end of the
RLHF pipeline (FR-42 → cycle-009 judge). Built through `/implement` (S9), not ad-hoc.
