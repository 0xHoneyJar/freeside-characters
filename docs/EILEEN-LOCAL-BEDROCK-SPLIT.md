---
spec: eileen-local-bedrock-split
repo: 0xHoneyJar/freeside-characters (public)
target_branch: main (V0.7-A.0 promoted 2026-04-30T14:30Z at 6355158)
session: 04 (planning · pre-V0.7-A.1)
date: 2026-04-30
mode: ARCH (Ostrom · separation of concerns) + SHIP (Barth · scope discipline)
status: planning · ready for tomorrow's build session
related_in_repo:
  - docs/EILEEN-LOCAL-SATOSHI.md (consumer-facing handoff for Eileen's agent)
  - docs/AGENTS.md (incoming-agent landing page)
  - docs/ARCHITECTURE.md (substrate architecture)
related_out_of_repo:
  - "~/bonfire/grimoires/bonfire/specs/listener-router-substrate.md (operator-side V0.7-A→B roadmap)"
  - "~/bonfire/grimoires/bonfire/specs/build-listener-substrate-v07a0.md (V0.7-A.0 build doc)"
---

# Eileen-local-bedrock split — clean parallel-track plan

> **One-line context**: V0.7-A.0 shipped to main. Eileen wants to run satoshi
> on her own machine using her private Bedrock API key. Operator wants to keep
> moving on V0.7-A.1+ substrate work. The split below lets both move at full
> speed without coordinating per-iteration.

---

## The split (4 dimensions)

| Dimension | Operator (soju) | Eileen | Notes |
|---|---|---|---|
| **Codebase** | `0xHoneyJar/freeside-characters` `main` | Same repo · pulls from `main` | ONE source of truth · she contributes character/voice changes via PR |
| **Discord application** | `freeside-characters` (existing · `Ruggy#1157`) | `satoshi-local` (new · she registers) | Each app owns one Interactions Endpoint URL · no portal-URL collision |
| **Deploy target** | Railway `prod-ruggy` (`prod-ruggy-production.up.railway.app`) | Her local machine + ngrok/cloudflared tunnel | Different runtimes · her bedrock key never leaves her machine |
| **LLM provider** | Anthropic-direct (`claude-opus-4-7` via SDK) | AWS Bedrock (her key · Claude on Bedrock) | Provider routing already in place · just adds `LLM_PROVIDER=bedrock` value |

**What stays unified**: persona profiles in `apps/character-<id>/` (one source
of truth · gumi-locked content respected by both), substrate code in
`packages/persona-engine/` (one shared library), bot runtime in `apps/bot/`
(one wiring layer). Eileen runs the same code; only env + Discord app +
deploy target differ.

---

## Why this shape

**Iterative speed** for Eileen:
- Edit `apps/character-satoshi/persona.md` → her local `bun --watch` reloads → invoke `/satoshi` in her Discord → see voice difference in 5 seconds. No coordination with operator. No Railway redeploy.
- Voice tuning is character-level; substrate is irrelevant to her hot-loop.

**Iterative velocity** for operator:
- V0.7-A.1 (gateway intents + messageCreate) lands on staging → deploys to prod-ruggy → THJ guild observes. Doesn't touch Eileen's local.
- Substrate changes are vetted on operator's prod-ruggy first; Eileen pulls when she's ready.

**No portal-URL collision**:
- Operator's freeside-characters app has ONE Interactions Endpoint URL pointing at Railway. While Eileen tested on 2026-04-30, slash commands routed there.
- Eileen's satoshi-local app has its OWN Endpoint URL pointing at her ngrok tunnel. Independent.
- Both apps can have `/satoshi` registered. They appear as different entries in Discord's autocomplete (different bot avatars) — minor cosmetic cost; cleaner ownership boundary.

**Bedrock key isolation**:
- Eileen's bedrock credentials live in her local `.env`. Never touches operator's Railway. Never in shared secrets.
- The Bedrock provider in this codebase is a generic capability — anyone with a Bedrock key can use it; the key never lives in source.

---

## Workflow under the split

```
operator main loop                        Eileen local loop
─────────────────────                     ─────────────────────
git pull main                             git pull main
edit substrate (persona-engine/)          edit character-satoshi/persona.md
commit · push staging                     bun --watch picks up change
railway up                                /satoshi prompt:test in HER Discord
verify on prod-ruggy/THJ                  iterate voice immediately
ff-merge staging → main                   when satisfied, commit · PR back to main
                                          (operator reviews + merges)
```

**Voice changes flow Eileen → operator via PR**:
- Eileen pushes a `eileen/voice-iteration-N` branch
- Opens PR against `main`
- Operator reviews + merges (gumi loop if persona's gumi-locked sections touched)
- Eileen's local pulls back the merged version

**Substrate changes flow operator → Eileen via main**:
- Operator's V0.7-A.1+ work merges into main
- Eileen pulls when she wants the new behavior
- No forced cadence

---

## Tomorrow's atomic items (priority order)

Ordered for build sequence — earlier items unblock later ones.

| # | Item | Lift | Unblocks |
|---|------|------|----------|
| 1 | **`LLM_PROVIDER=bedrock` provider** in `compose/reply.ts` (chat path) + `compose/agent-gateway.ts` (digest path can defer · Claude Agent SDK doesn't support Bedrock natively for tool-call paths). Uses `@aws-sdk/client-bedrock-runtime` · `InvokeModelCommand` shape with anthropic_version. Env: `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `AWS_REGION` · `BEDROCK_MODEL_ID`. | ~1h | #2 #3 |
| 2 | **`CharacterConfig.anthropicModel`** optional override · per-character model selection (Eileen's satoshi can run on a different Bedrock model than operator's THJ deploy uses). Wire through `compose/reply.ts` `invokeChatAnthropicSdk` and `agent-gateway.ts`. | ~30m | optional polish |
| 3 | **`apps/bot/scripts/satoshi-dev.ts`** easy-launcher · starts ngrok tunnel · prints Discord portal URL · runs bot with `--watch` · CHARACTERS=satoshi · LLM_PROVIDER=bedrock pre-set. One command for Eileen to type. | ~1h | Eileen's solo runs |
| 4 | **Update `docs/EILEEN-LOCAL-SATOSHI.md`** with concrete walkthrough · replace placeholder env block · screenshots if useful · troubleshoot section. | ~30m | Eileen's onboarding |
| 5 | **Eileen creates `satoshi-local` Discord application** · she handles via developer portal · gets her own bot token + Public Key · registers `/satoshi` against her test guild. | ~30m (her hands) | Independent ops |
| 6 | **First Eileen solo run** · she clones repo · sets env · runs launcher · invokes /satoshi · we observe + fix any rough edges. | ~30m (paired) | Verification |

**Optional fast-followers** (parallel-friendly, not blocking):

| # | Item | Why it fits the split |
|---|------|----------------------|
| 7 | `/usage` slash command + JSONL token tracking (operator-only · Discord user ID gate) | Both deploys benefit · cost awareness for opus/bedrock |
| 8 | Ruggy persona negative-constraint audit (preventive) | Same audit pass applied to satoshi at b84231b · ruggy could drift under future opus releases |
| 9 | Ledger LRU cap (bridgebuilder F3) | Both deploys benefit · long-running bot memory hygiene |
| 10 | `.dockerignore` `.claude` recursion fix (bridgebuilder · earlier) | Operator deploy · Eileen local doesn't use Docker |

---

## Risk / open questions

1. **Eileen's GitHub access** — write to `0xHoneyJar/freeside-characters` or fork-and-PR model? Affects #4 in the build sequence (whether her commits go to a branch in this repo or her fork).

2. **Bedrock model availability** — Eileen needs to confirm which `anthropic.claude-*` models her Bedrock access covers in her region. Per the link she shared (https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html), most regions have Claude 3 family; opus-4-7 on Bedrock may have a delayed availability window vs Anthropic-direct. If her region only has Claude 3 Sonnet, satoshi's voice on Bedrock will differ from operator's prod-ruggy on Anthropic Opus 4.7. Worth a brief side-by-side comparison post-setup.

3. **Tunnel persistence** — ngrok free-tier URLs change per session unless paid plan. Each Eileen session = re-paste URL into Discord developer portal. Friction. Cloudflared persistent tunnels (free with a domain) eliminate this. Decide tomorrow.

4. **Gumi coordination** — satoshi's persona.md has gumi-locked sections. If Eileen iterates on satoshi voice and proposes changes to those sections, the gumi-loop applies. Operator should be in the loop on those PRs. Non-blocking but worth surfacing.

---

## Decisions made tonight

- ✅ Codebase stays unified · no per-character repo split
- ✅ Discord apps split · Eileen creates her own `satoshi-local` app (option B from earlier `EILEEN-LOCAL-SATOSHI.md` triage · committed as the end-state)
- ✅ Deploy split · Eileen local + operator Railway · independent runtimes
- ✅ LLM provider split · operator on Anthropic-direct · Eileen on Bedrock · provider routing supports both
- ✅ Voice changes flow Eileen → operator via PR · gumi loop where applicable
- ✅ Substrate changes flow operator → Eileen via main pulls

## Still open (tomorrow)

- 🤔 Bedrock model selection (await Eileen's region/access spec)
- 🤔 Tunnel choice (ngrok free vs cloudflared persistent)
- 🤔 Eileen's GitHub access model (write vs fork)
- 🤔 Sequencing of #1-6 (linear vs some parallelism)

---

## §coordination needed

1. **Eileen** — share Bedrock model spec (which `anthropic.claude-*` IDs her access covers) · confirm she's good with creating her own `satoshi-local` Discord app
2. **Operator** — decide GitHub access model · decide tunnel choice
3. **Gumi** — async awareness (no action) — voice iteration will flow through PRs touching his locked content; his review loop still applies

---

## Pickup for tomorrow's session

Load order (all in-repo paths):
1. This doc (`docs/EILEEN-LOCAL-BEDROCK-SPLIT.md`) — strategic frame
2. [`docs/EILEEN-LOCAL-SATOSHI.md`](./EILEEN-LOCAL-SATOSHI.md) — consumer handoff for Eileen
3. [`docs/AGENTS.md`](./AGENTS.md) — incoming-agent landing page
4. `packages/persona-engine/src/compose/agent-gateway.ts` — provider routing pattern to extend
5. `packages/persona-engine/src/compose/reply.ts` — chat-mode SDK invocation to mirror for Bedrock
6. Eileen's Bedrock spec (when shared)

Build doc for tomorrow: `docs/BUILD-BEDROCK-PROVIDER-V07A1.md` (to be written when Eileen's spec lands).
