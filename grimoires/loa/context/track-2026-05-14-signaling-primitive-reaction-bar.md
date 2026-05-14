---
title: signaling primitive — reaction-bar for community "what sticks" feedback
status: candidate
mode: pre-planning
created: 2026-05-14
source_session: discord-exchange-2026-05-14 + /goal completion-cycle-004
expiry: until reaction-bar ships OR operator revokes
use_label: usable
boundaries:
  - does not require verifier-primitives (score-mibera#115) — independent
  - presentation-layer feature; lives in this repo
  - low-stakes experiment; reaction counts inform doctrine, do not gate behavior
related-issues:
  - 0xHoneyJar/score-mibera#115 (verifier primitives — separate concern, complementary)
  - 0xHoneyJar/freeside-characters#74 (cycle-021 enrichment vs deterministic — deferred until verifier)
---

# track · reaction-bar signaling primitive

## frame

Operator (2026-05-14): *"Discord channel has operators + community members + community managers on the same surface. It's not like an isolated surface, so in a way this is a community and this is a group of people who care about a specific (not everyone's going to care about the same thing), but I think there'll be things that will stand out to us as time goes on and people continue to interact with it."*

The verifier-primitives doctrine (score-mibera#115) addresses **truth** of claims. This track addresses **stickiness** — which posts resonate with which audience tiers — by adding a minimal community-signaling surface that doesn't require additional agent intelligence to interpret.

## the primitive

**Three seed reactions on every digest:**

| Reaction | Meaning | Audience signal |
|---|---|---|
| 🙌 | "useful · landed for me" | the post earned its space |
| 🤔 | "interesting but unclear" | the post's signal is real but the framing missed |
| 💤 | "didn't carry — noise" | the post added volume without adding value |

Bot auto-reacts with these three on every digest post; community members add their reaction; bot tallies.

**Optionally** (operator-decided) — a fourth `🪲` (bug · raw data wrong) reaction to capture verifier-class failures separately from voice-class noise, so when score-mibera#115's verifier exists, the 🪲 tally informs which claim-types most often fail.

## what it surfaces

Per-digest:
- aggregate reaction counts across the three (+ optional 🪲)
- normalized "engagement ratio" — `(reactions / channel_active_members)` over the 7d window

Per-zone (rolling 4 weeks):
- which zones get the most 🙌 vs 💤 ratio
- whether enrichment posts (Sunday) outperform a hypothetical deterministic-card alternative (when both exist post-cycle-021#74)

Per-claim-type (when verifier ships):
- which claim-types correlate with 🙌 vs 💤
- whether 🪲 tally aligns with verifier `partial` / `fail` verdicts

## implementation notes

- **Auto-react path**: existing webhook-shell + Discord.js Gateway can call `message.react(emoji)` after each digest send. Defense-in-depth check: webhook-shell already has bot-author-skip per `apps/bot/src/discord-interactions/dispatch.ts` (anti-spam invariant per CLAUDE.md), so adding reactions from the same bot is safe.
- **Aggregation**: append `.run/reactions/<digest_id>.json` (gitignored) with `{digest_id, zone, post_type, reactions: {emoji: count}, timestamp}` per digest. Aggregate via a small script (`apps/bot/scripts/reaction-tally.ts`) — operator-runnable.
- **Surfacing**: operator-only `/digest-tally` slash command returns last 4 weeks rolling. NOT a community-facing surface; this is operator intel.
- **No agent intervention**: agents don't read the reaction tally to compose differently. Operator reads the tally, decides doctrine drift, updates persona prompts manually. This is a **HITL feedback loop**, not an autonomous-self-tuning loop.

## non-goals

- ❌ Agents auto-tuning behavior based on reaction counts (creates a feedback loop the LLM can't reason about cleanly; doctrine drift becomes invisible)
- ❌ Public surfacing of "👎 you didn't like this" — adversarial register; not what the community wants from a participation agent
- ❌ Reactions as a verifier surface (verifier lives on substrate per score-mibera#115; reactions are stickiness, not truth)
- ❌ Per-character reactions (the bot is one identity from the community's view; reaction-bar is per-post not per-character)

## open questions

1. **Three reactions or four** — add 🪲 from day one, or wait until verifier ships and we know what claim-types fail?
2. **Per-message or per-thread** — auto-react on the parent digest message, or thread the reactions to keep the channel clean?
3. **Visibility of tally** — operator-only via slash command (current default), or surfaced inline in the next digest's footer ("last digest: 12🙌 · 3🤔 · 0💤")?
4. **Cross-character tally** — when satoshi posts, same reaction-bar? Or character-specific (satoshi's silent-register doesn't ask for engagement)?
5. **Sample size for inference** — how many digests before the reaction signal is meaningful? 4 weeks × 4 zones = 16 posts/month; with low channel-active count, signal-to-noise might be poor.

## sequencing

This is independent of cycle-004 (substrate refactor + eval harness) and independent of score-mibera#115 (verifier primitives). Could ship anytime as a small standalone PR.

**Recommended order if pursued**:
1. Add 3 reactions auto-react on digest send (~30 LoC in deliver layer)
2. Add `.run/reactions/` tally writer (~50 LoC)
3. Add `apps/bot/scripts/reaction-tally.ts` aggregator (~80 LoC)
4. Operator runs after 4 weeks; reads signal; updates doctrine
5. If verifier ships (score-mibera#115), add 🪲 + correlate 🪲 tally with verifier verdicts

## activation receipts

- operator framing 2026-05-14 (Discord exchange + /goal completion) — usable, expiry: this conversation + downstream design
- doctrinal context: 0xHoneyJar/score-mibera#115 (filed 2026-05-14) — companion verifier doctrine
- related: freeside-characters#74 (cycle-021 surface disposition, deferred)
