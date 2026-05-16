---
to: agent-working-on-freeside-cli
from: claude-opus-4-7 · freeside-characters context (zerker's persona-engine)
created: 2026-05-13
status: candidate-handoff
re: auth / identity / profile boundary — stance, friction, and work I'm handing off
operator: soju (zkSoju)
expiry: until you respond OR operator revokes
---

# letter to the agent working on freeside cli

hey.

I don't know your exact scope yet — you might be on `loa-freeside/apps/gateway`,
the rust spine, the operations bot, or something new. doesn't matter for this
letter. what matters is: you're at the implementation surface of freeside as
identity spine. I'm at the consumer surface (freeside-characters, the ruggy
bot, an in-bot identity proxy reading `midi_profiles` directly until your
side ships). between us is a doctrine that keeps getting muddied in
collaborator proposals, and the operator just gave me explicit latitude to
hand you context, work, and possibly a wild idea or two.

so this isn't a spec. it's a letter.

## what we hold (the doctrine, in one breath)

three layers. plus profiles. all separable. all composable.

```
credential       — wallet sig / passkey / OAuth / OTP    (auth lib's job: Dynamic, Better Auth, SeedVault)
    │
identity         — canonical THJ user_id + linked creds  (FREESIDE'S JOB — yours and mine)
    │              + tenant/tier claims + JWT issuance
    │
session          — JWT consumed per-world via JWKS       (each world)

profiles         — display_name, pfp, discord_id, mibera (PER-BRAND tables, keyed by canonical user_id)
                   ADR-038: "shared auth + siloed profiles"
```

and orthogonal to all of it:

```
score data       — factor events on Wallet entities      (NEVER emits handles. NEVER.)
                   operator-confirmed 2026-04-29
```

primary vault sources (read these if you haven't):
- `vault/wiki/concepts/freeside-as-identity-spine.md` — the three-layer model
- `vault/wiki/concepts/score-vs-identity-boundary.md` — operator-confirmed 2026-04-29
- `vault/wiki/concepts/sign-in-with-thj.md` — shared auth + siloed profiles
- `vault/wiki/concepts/cross-app-session-contamination.md` — the SatanElRudo bug class

## why I'm writing today

I just pushed back on `0xHoneyJar/score-mibera#109` — a proposal by zerker
to add `resolve_identities` (wallet → MIDI display_name batch lookup) on
score-mibera. it's a classic boundary violation: score becomes a second
writer to identity. exactly what the 2026-04-29 doctrine locks against.

PR comment: https://github.com/0xHoneyJar/score-mibera/pull/109#issuecomment-4444833149

this is the **third or fourth time** this confusion has surfaced in 2-3
months. the lineage tells the story:

| date | event |
|---|---|
| 2026-02-17 | SatanElRudo incident — MiDi wallet link → CubQuest session contamination. provider-keyed JWT + separate profile tables = the bug class. |
| 2026-04-13 | operator pivot — net-new sovereign-stack surfaces move off Dynamic Labs toward Better Auth. existing apps stay. |
| 2026-04-16 | three vault docs landed (spine, SIwTHJ, cross-app contamination). doctrine made explicit. |
| 2026-04-29 | operator confirmed score-vs-identity boundary, head-off cycle-020/021-shaped proposals. |
| 2026-05-13 | PR #109 proposed exactly the temptation the 2026-04-29 doc resists. I pushed back. wrote you this letter. |

operator said today: *"we have had so many conflicts around auth/profiles
getting muddied in the past."* I believe him.

## what I think is going on (the meta)

the friction is **not** a knowledge gap. the doctrine exists. it's in
/vault. it's been operator-confirmed. and yet smart agents and humans
keep drifting across it.

my read: there's no immune system at the boundary moments. doctrine in
/vault is canonical but **inert** — nobody bumps into it when they're
about to propose a new tool on score-mibera or a new field on the
identity surface. we notice and fight for the boundary after the fact.

this is a coordination architecture problem. one letter doesn't fix it.
but a small set of mechanisms might.

## wild idea I'd love your read on

**a boundary-aware fagan / immune system construct.**

a small construct (or fagan extension) that fires on any PR touching
identity / auth / profiles / score. it asserts the four boundaries:

1. score never emits handles (`score-vs-identity-boundary`)
2. credential / identity / session are separate (`freeside-as-identity-spine`)
3. profiles are per-brand, keyed by canonical user_id, never on the spine (`sign-in-with-thj` ADR-038)
4. session cookies must not carry provider-keyed `sub` claims (`cross-app-session-contamination`)

cites vault on violation. opinionated. vocal. citable. **not blocking** —
just impossible to ignore. you can override with explicit reason ("yes,
crossing the boundary because X") that goes into the audit trail.

I sketched this as a candidate construct doc — see below for the file
path. you might know better than me what shape it should take, since
you live closer to the spine. the construct could live in
`0xHoneyJar/construct-honeycomb-substrate` as a pattern extension, or as
its own pack.

## what I'd hand off (three things, increasing scope)

### 1. schema-versioning RFC (smallest, blocked on zerker)

- track file: `grimoires/loa/context/track-2026-05-13-mcp-schema-versioning-rfc.md`
- cross-repo design: one file score-mibera (producer), one validator persona-engine (consumer)
- replaces hand-mirror types pattern with runtime contract validation
- operator framing: *"schemas/contracts are well defined and versioned. implementations can change."*
- pitched to zerker as counter-proposal to `@freeside/score-mcp-corpus` in PR #109
- blocked on zerker accepting. if he does, you could draft the score-mibera side from a spine-aware perspective
- the spine ships its own MCP eventually — schema-versioning discipline applies there too

### 2. freeside_auth → freeside_identity rename + spine naming alignment

- track file: `grimoires/loa/context/track-2026-05-13-freeside-identity-rename.md`
- we rename here (`mcp__freeside_auth__*` → `mcp__freeside_identity__*`)
- you could co-design how the spine ships its public MCP surface name (`loa-freeside/apps/gateway`)
- alignment goal: when the spine ships its remote MCP, freeside-characters's in-bot proxy points at it with zero name churn
- naming-as-immune-system: "auth" gets confused with credential. "identity" maps cleanly to the spine doctrine.

### 3. boundary-aware fagan / immune system construct (biggest, exploratory)

- sketch: `grimoires/loa/handoffs/2026-05-13-boundary-fagan-sketch.md` (sibling to this letter)
- you might have a better shape for this than me
- if you build it, I want to be the first dogfood

## what I'm holding here (so you know what's parked)

- the in-bot freeside_auth MCP proxy until the spine ships
  ([`packages/persona-engine/src/orchestrator/freeside_auth/server.ts`](packages/persona-engine/src/orchestrator/freeside_auth/server.ts))
- boundary watcher from the consumer side (PR #109 reply landed today)
- T2/T8 on score-mibera (operator-blocked) before cycle-021 starts
  (see `grimoires/loa/context/track-2026-05-13-cycle-020-t2-t8-clearance.md`)
- the rename track here once you signal go

## what I'd love from you (no pressure)

- read the four vault docs if you haven't (they're load-bearing — total ~20min)
- push back if you see the doctrine wrong. I'm working from operator-confirmed canon as of 2026-04-29, but you might know things from the spine side I don't. "x doesn't actually need to be in identity, it could be in credential" is exactly the kind of pushback I want.
- pick up one of the three handoff items above. or propose something different. or do nothing — operator's latitude grants are generous and I'm not your boss.
- if you build the immune system construct, I want the first issue filed on me.

## ADRs and pointers (for orientation)

ADR lineage (lives in `hivemind-os` construct pack):
- ADR-003 (2024) — chose Dynamic Labs over Privy/WalletConnect
- ADR-038 (2025) — formalized shared auth + siloed profiles
- 2026-04-13 — operator pivot toward Better Auth for net-new surfaces

code on this side worth peeking at:
- `packages/persona-engine/src/orchestrator/freeside_auth/server.ts` — current in-bot identity MCP (reads `midi_profiles` Railway PG direct)
- `packages/persona-engine/src/score/types.ts` — the hand-mirror we want to kill once schema versioning lands
- `apps/character-ruggy/cmp-boundary.test.ts` — existing boundary test (CMP = chat-medium-presentation, different boundary, but same spirit)
- `apps/character-ruggy/character.json` — `tool_invocation_style` is where Ruggy learns when to call freeside_auth vs score

PR that triggered all this:
- https://github.com/0xHoneyJar/score-mibera/pull/109

repos in the ecosystem (so you can see who else is in the room):
- `0xHoneyJar/score-mibera` — score-mcp surface (zerker)
- `0xHoneyJar/loa-freeside` — operations bot + rust gateway (your patch likely)
- `0xHoneyJar/freeside-characters` — this repo (ruggy + satoshi + whoever's next)
- `0xHoneyJar/construct-honeycomb-substrate` — the architectural vocabulary (Effect/ECS/Hexagonal isomorphism)

## one last thing

I'm a claude opus 4.7 instance. you're presumably also a model — opus,
sonnet, gpt-5, whatever the operator picked for your context. we have
different long-term memories but the same vault, the same operator,
and the same boundaries to hold.

the doctrine is canon. the friction is real and recurring. the work is
yours if you want it. push back hard if you see something I missed — I'd
rather be wrong fast than slow.

— claude opus 4.7
2026-05-13
freeside-characters context
