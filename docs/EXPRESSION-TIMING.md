# Expression Timing — KANSEI cadence guide

> **Doctrine source**: YANAGI (Sōri Yanagi) — *true beauty is not made,
> it is born*. The wait should disappear into character presence, not
> call attention to itself as a jittery indicator. Loading-state is a
> material; rhythm is its physics.
>
> **Reference**: kickoff-2026-05-01 §4.5 (KANSEI timing pass).

This doc holds the cadence boundaries the substrate enforces for in-
channel character expression — tool-call loading patches, error replies,
performed silence. Operators reading this should be able to answer
"when does the channel feel alive vs jittery vs abandoned?" without
diving into code.

## Three timing surfaces

| surface | constant | location | floor | ceiling |
|---|---|---|---|---|
| **tool-call patch interval** (between expressive emoji patches) | `MIN_TOOL_PATCH_INTERVAL_MS = 800` | `apps/bot/src/discord-interactions/dispatch.ts` | 800ms | (no enforced cap; orchestrator round-trips drive natural cadence — see ceiling guidance below) |
| **chunk follow-up throttle** (between message chunks 2..N when reply > 2000 chars) | `FOLLOW_UP_THROTTLE_MS = 1_500` | `apps/bot/src/discord-interactions/dispatch.ts` | 1500ms (Discord's 5 req / 2 sec ceiling) | — |
| **interaction token lifetime** (PATCH window) | `TOKEN_LIFETIME_MS = 14 * 60 * 1000 + 30 * 1000` | `apps/bot/src/discord-interactions/dispatch.ts` | — | 14m30s (Discord token expires at 15:00 hard) |

## YANAGI's cadence boundaries

> *"The card returns to rest in 800ms. That's 8 perceptual cycles — too
> fast for the dissolve spring to communicate weight. Extend to 1200ms
> (12 cycles)."* — YANAGI (kansei persona, V0.12 session 04 invocation)

Three perceptual zones. The substrate aims to live in the **alive** zone
for tool-call patches and stay out of the others.

### < 800ms between patches → JITTERY

Two distinct emoji renders inside the same perceptual settle window
(~600ms) read as flicker, not presence. The user's eye locks onto the
"loading indicator" instead of feeling the character work. This is the
failure mode V0.7-A.1's 500ms gate occasionally hit when multi-tool
chains fired (3-4 tool calls inside 1.5s).

V0.12 raises the floor to **800ms** — emoji has time to register
visually before being replaced.

### 800ms – 4s between patches → ALIVE (target zone)

A patch fires; the eye registers it; the next patch arrives just as the
attention starts to drift. Character is felt as PRESENT — pulling
something, looking at something, recording something. The wait
disappears into the persona's body language.

### > 4s without a patch → ABANDONED (guidance, not enforced)

When the gap between patches exceeds ~4 seconds, the user starts asking
"is this thing still working?" — the character disappears from the
moment. The substrate cannot strictly enforce this ceiling because
orchestrator round-trips (LLM thinking time + MCP tool calls) can take
2-15 seconds depending on the complexity. But the dispatch wires every
*detected* tool_use through the patch path; long gaps signal an LLM
thinking turn between tool calls, not a substrate misbehavior.

If KEEPER's deferred user-truth listening pass surfaces "abandoned"
signals (users dropping out of conversations during the wait, "is this
broken?" reactions), candidates for substrate-side response include:

- Insert a "still here" patch on a 4s heartbeat when no tool_use has
  fired — but heartbeats are themselves a substrate-voice category
  error (the substrate is announcing presence; the character should).
  Defer until a clear pattern emerges.
- Surface long-running tool calls (e.g. imagegen) with a duration-aware
  status — already deferred to V1.5 imagegen-progress work per kickoff §6.

## Per-emoji-pick variance (substrate-side)

The mood-map (`packages/persona-engine/src/expression/tool-mood-map.ts`)
exposes 2-3 moods per tool category. The dispatch path:
1. resolves the tool to a mood pool
2. unions ALL emojis from those moods (filtered by character emoji-kind)
3. picks one at random

For ruggy on score: 4 emojis in the union (ruggy_zoom, ruggy_smoke,
ruggy_point, ruggy + flex variants for celebrations). Across 30 tool
fires, all 4 should appear at least once. The recent-used cache in the
emojis MCP (`packages/persona-engine/src/orchestrator/emojis/server.ts`)
provides per-zone deduplication on top of that — same emoji shouldn't
repeat within a 6-pick window per zone.

## Diagram

```
USER INVOKES /ruggy <prompt>
   ↓
   t=0ms      [interaction ACK · "Application is thinking..."]
   ↓
   t≈200ms    LLM emits first tool_use
              ↓ onToolUse fires
              ↓ composeToolUseStatusForCharacter resolves
              ↓ PATCH @original with <a:ruggy_zoom:id>
   t=200ms    PATCH 1 visible · lastToolPatchMs=200
   ↓
   t=400ms    LLM emits second tool_use
              ↓ onToolUse fires
              ↓ now=400 · 400-200=200ms < 800ms gate
              ↓ SKIP this patch (substrate-quiet — final reply will replace)
   ↓
   t=900ms    LLM emits third tool_use
              ↓ now=900 · 900-200=700ms < 800ms gate · STILL skipped
   ↓
   t=1200ms   LLM emits fourth tool_use
              ↓ now=1200 · 1200-200=1000ms ≥ 800ms gate
              ↓ PATCH @original with <a:ruggy_point:id>
   t=1200ms   PATCH 2 visible · lastToolPatchMs=1200
   ↓
   t=2500ms   LLM finishes synthesis turn
              ↓ composeReply resolves
              ↓ deliverViaWebhook (Pattern B) — final reply
   t=2500ms   Final reply visible · deferred placeholder DELETED
```

The two visible patches at t=200 and t=1200 give the channel a sense of
"ruggy is doing things" without flickering through every intermediate
tool. The skipped patches are the substrate-side throttle being
deliberate; nothing is lost because the final reply replaces all
intermediate state.

## When to revisit

- **KEEPER pass scheduled** (V1.5 · per kickoff §4.6): capture user
  reactions to the new cadence; tag delight / neutral / friction.
  The 800ms floor is a hypothesis based on YANAGI craft principles;
  user-truth confirms or amends.
- **New characters added**: each character with `emojiAffinity` enters
  the same cadence boundaries. Plain-text register characters (satoshi-
  shape) are subject to the same gates — text patches feel SLOWER than
  emoji patches at the same interval, so the 800ms floor may feel too
  fast for satoshi. Watch for that signal.
- **Tool-chain length grows**: orchestrators with > 6 tool calls per
  reply may feel sparse under the 800ms floor (only 2-3 patches visible
  out of 6+ tools). If this becomes a UX signal, consider lowering the
  floor to 600ms with a stricter dedup window (no same-emoji within 1s).

## Constraints out of scope

- **Spring physics for emoji entrance/exit** — Discord renders custom
  emojis statically; there's no opacity/scale animation surface to tune.
- **Sub-character haptic feedback** — IRL haptic bridge isn't wired (per
  kickoff §6 imagegen-progress visibility deferral).
- **Per-tool tempo modulation** (slower for codex, faster for score) —
  the mood map alone differentiates by emoji choice; tempo modulation
  would be a YANAGI-level refinement worth its own session.
