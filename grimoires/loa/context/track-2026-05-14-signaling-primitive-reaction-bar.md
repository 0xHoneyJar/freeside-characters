---
title: signaling primitive — reaction-bar for community "what sticks" feedback
status: shipped-v1 · review-integrated
mode: implementation
created: 2026-05-14
last_updated: 2026-05-14 (post KEEPER + OSTROM dual review)
source_session: discord-exchange-2026-05-14 + /goal completion-cycle-004 + /goal reaction-bar-e2e
expiry: until reaction-bar ships OR operator revokes
use_label: usable
boundaries:
  - does not require verifier-primitives (score-mibera#115) — independent
  - presentation-layer feature; lives in this repo
  - low-stakes experiment; reaction counts inform doctrine, do not gate behavior
related-issues:
  - 0xHoneyJar/score-mibera#115 (verifier primitives — separate concern, complementary)
  - 0xHoneyJar/freeside-characters#74 (cycle-021 enrichment vs deterministic — deferred until verifier)
v1_shipped:
  - packages/persona-engine/src/deliver/reaction-bar.ts (130+ LoC)
  - packages/persona-engine/src/deliver/reaction-bar.test.ts (14 tests)
  - apps/bot/scripts/digest-tally.ts (operator-side tally with baseline+delta+sample-warning)
  - packages/persona-engine/src/config.ts (DIGEST_REACTION_BAR_ENABLED env)
  - packages/persona-engine/src/deliver/post.ts (wire-in to webhook-shell + bot-fallback paths)
---

# track · reaction-bar signaling primitive

## frame

Operator (2026-05-14): *"Discord channel has operators + community members + community managers on the same surface. It's not like an isolated surface, so in a way this is a community and this is a group of people who care about a specific (not everyone's going to care about the same thing), but I think there'll be things that will stand out to us as time goes on and people continue to interact with it."*

The verifier-primitives doctrine (score-mibera#115) addresses **truth** of claims. This track addresses **stickiness** — which posts resonate with which audience tiers — by adding a minimal community-signaling surface that doesn't require additional agent intelligence to interpret.

## the primitive (v1 shipped 2026-05-14)

**Three seed reactions on every digest** — final set after KEEPER + OSTROM dual review:

| Reaction | Meaning | Audience signal |
|---|---|---|
| 👀 | "useful · noticed · landed" | invitation register; in ruggy's voice already |
| 🤔 | "interesting but unclear" | signal real but framing missed |
| 🪲 | "bug · data wrong" | verification-class signal (pairs with score-mibera#115) |

**Pre-review draft had 💤 (noise/skip)** as the third slot. **Removed** during KEEPER review (2026-05-14): bot-seeding 💤 reads as preemptive judgment ("we think this might be bad"), adversarial to ruggy's "let it land or don't" voice. **The fix**: don't seed 💤; let community SILENCE speak for "didn't carry." Posts with 0 reactions across all 3 categories ARE the noise signal — silence is data.

**🪲 shipped day-one** (instead of deferred) per OSTROM review (2026-05-14): deferring 🪲 until the verifier (score-mibera#115) ships means months of retroactive data loss. When verifier eventually lands, 🪲 history exists to correlate with `partial`/`fail` verdicts.

Bot auto-reacts with these three on every digest post; community members add their reaction; operator runs `bun run apps/bot/scripts/digest-tally.ts [--days N]` to read aggregate.

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

## KEEPER + OSTROM dual review (2026-05-14)

After v1 implementation landed, ran rigorous dual-construct review per operator goal ("get rigorous feedback from KEEPER and THE ARCADE for quality and clarity · focus on practicality and usefulness").

### Integrated (shipped this revision)

| Concern | Source | Resolution |
|---|---|---|
| 💤 reads as preemptive judgment; adversarial to ruggy voice | KEEPER | Removed 💤 from set; SILENCE = noise signal instead |
| Deferring 🪲 = retroactive data loss when verifier ships | OSTROM | Added 🪲 day-one; tally script counts it; correlates with score-mibera#115 when that lands |
| No structural memory — tally is snapshot, not trend | KEEPER | Added baseline+delta comparison vs prior window in `digest-tally.ts` |
| Sample-size cliff (16 posts/month) — single member skew | KEEPER | Added `renderSampleSizeWarning()` flagging tallies below 8-digest noise floor |
| `≤5 emoji` is suggestion, not invariant — Goodhart drift risk | OSTROM | TS-level conditional-type compile-time enforcement + runtime test |
| Operator opacity — community doesn't know tally → doctrine, not ranking | OSTROM | Tally output includes "On reading the tally (operator doctrine)" section with pin-this-to-channel guidance |

### Deferred with rationale (NOT shipped — bigger than this slice)

| Concern | Source | Rationale for defer | Where it lives |
|---|---|---|---|
| Reactions are LEAST load-bearing signal — replies/threads/mentions tell richer stories | KEEPER | Adding thread-depth tracking is a substantial refactor; v1 ships the cheapest signal; richer tally is cycle-N+2 work | Track-file note · revisit when reaction-only signal proves too thin |
| Extractive economy — community gives data, gets nothing back; one-way arrow | OSTROM | Reciprocity mechanics (personalized rank · highlights · transparency) require richer infrastructure (per-user state, recognition UI). Real concern but beyond v1 scope. Could be a cycle-N+2 follow-up: "what does the community get back from clicking?" | Track-file note · open question for next cycle planning |
| Reddit-upvote failure mode (bandwagon/herding · early reactions anchor) | OSTROM | Mitigation is community-side framing, not code: pin a channel message explaining "reactions inform doctrine, don't rank posts." This is operator-action, not implementation. | Documented in tally output's doctrine section · operator must surface to community |
| 8-week minimum read before patterns are real (vs 4-week default) | KEEPER | Operator decision — `--days 56` is the option; default stays 28 to match expected operator-cadence. Document in tally README. | Tally accepts `--days N` — operator chooses window |

## Sample tally output (post-review revisions)

```
# Reaction-bar tally (last 28 days · 3 digests)

## ⚠ Sample-size warning (KEEPER 2026-05-14 review)
Only 3 digests with reaction-bar in window.
Threshold for meaningful pattern emergence: ≥8 digests + ≥3 active reactors.
At this scale, a single heavily-engaged member skews the tally.
Read as anecdote, not pattern. Extend window with --days N or wait for more posts.

## Per-digest detail
| zone | timestamp | 👀 | 🤔 | 🪲 | community total |
|------|-----------|----|----|----|----|
| bear-cave | 2026-05-12 | 4 | 1 | 0 | 2 |
...

## Per-zone aggregate (rolling window)
...

## Delta vs prior window (KEEPER 2026-05-14 structural-memory fix)
| metric | current | prior | Δ count | Δ % |
| 👀 | 6 | 4 | +2 | +50% |
| 🤔 | 2 | 1 | +1 | +100% |
| 🪲 | 0 | 0 | 0 | (0→0) |
| community total | 5 | 2 | +3 | +150% |

## On reading the tally (operator doctrine)
Per OSTROM 2026-05-14 review: this tally informs **doctrine**, not ranking. ...
```

## Test coverage

14 tests in `reaction-bar.test.ts` across 7 describe blocks:
- happy path (4 tests · attaches all 3 in order · order matches const · CLAUDE.md banned-list compliance · v1 length · KEEPER 💤-removal · OSTROM 🪲-day-one · OSTROM Goodhart-invariant)
- channel failures (2 tests · null channel · non-text-based)
- message-fetch failures (1 test)
- per-reaction failures (2 tests · one fails / all fail)
- verbose mode (1 test)

Full test suite: **674/674 green** (was 660 baseline · +14 from this primitive).

## E2E status

- ✅ Unit: 14 tests pass · mock client verifies the full Discord API surface
- ✅ Integration: `LLM_PROVIDER=stub bun run digest:once` runs all 4 zones without regression (reactions wire only fires on real-post path, skipped in dry-run by design)
- ⏸ Live Discord: requires `DISCORD_BOT_TOKEN` + production deploy. Next Railway redeploy + next Sunday cron will exercise the live path. Tally script ready to run thereafter (`bun run apps/bot/scripts/digest-tally.ts --days 28`).
