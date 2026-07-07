---
status: candidate
mode: arch
topic: extract the ops/onboarding surface out of freeside-characters; fc → characters (voice-only)
authored: 2026-07-06
supersedes_ref: 2026-06-03-onboarding-as-separable-voiceless-building.md (reaffirms + adds measured seam)
provenance: operator-direction 2026-07-06 + [[project_onboarding-as-voiceless-building]] (operator-authored, usable)
---

# Ops-extraction seam — freeside-characters → characters (voice) + freeside building(s)

## The direction (operator, 2026-07-06)

> "The operations/onboarding bot lowkey lives in this repo. It should be moved to
> loa-freeside. Then this becomes characters-api or something eventually."

This is not new — it **reaffirms** the ratified 2026-06-03 direction
([[project_onboarding-as-voiceless-building]]): onboarding/role-dispenser is a
*voiceless, isolated, CM-controlled unit* that should extract into its own
deployable building. In-repo-now was always "OK but keep isolated."

## Question the question: not *into* loa-freeside — *out* as building(s)

"Moved to loa-freeside" reads as loose shorthand for "the Freeside/ops side, off
the characters daemon." Taken literally it fights two ratified positions:

- [[project_sietch-was-study-material]]: **loa-freeside is narrowing** to platform +
  operating surface; core APIs extract *out* as `freeside-*` buildings. Don't add
  runtime into the monolith you're shrinking.
- ADR-008 factory model: identity-api, score-api, **shadow-mode-api** already
  extracted this way.

So the precise target is **buildings**, not the loa-freeside repo:

| Half of "the ops bot" | Precise home | Status |
|---|---|---|
| **member-graph / ledger** (compose sources → graph) | `shadow-mode-api` **already exists** (loa-freeside PR #316, merged 2026-06-26) — the member-graph composition spine | home exists; bot is a would-be consumer |
| **role-sync executor** (graph → tier → Discord role write) | thin executor — folds onto shadow-mode-api's projections, or a small `freeside-onboarding` building | undecided |
| **onboarding / verify** (wallet↔discord, verified role) | `freeside-onboarding` building (freeside-X, ADR-008); mountable *without* the persona daemon | candidate |
| **the voice daemon** (chat · digest · event pop-ins) | stays — `freeside-characters` → rename `characters` (the WHO that speaks, two-axis model) | stays |

Two-axis framing ([[freeside-two-axis-model]], vault): **characters = a WHO
daemon; onboarding = a voiceless building; member-graph = a WHAT/data spine.**
They share a repo today by history, not by axis.

## The seam is clean (measured 2026-07-06 @ HEAD 90f8b14)

The 2026-06-03 isolation invariants **held** — the ops code never grew voice
tendrils. Cross-package imports from `apps/bot/src/{shadow,verify}` into
persona-engine:

```
8×  @freeside-characters/persona-engine/score/community-client   ← the named isolation debt
2×  @freeside-characters/persona-engine/onboarding               ← ops barrel, moves with it
1×  persona-engine/src/deliver/enriched-render.ts                ← one render helper
0×  voice · compose · persona · orchestrator internals           ← nothing to untangle
```

`persona-engine/src/onboarding/surface-config.ts` pulls only
`orchestrator/freeside_auth/server.ts` (a pg pool) — infra, not voice.

### What moves
| Unit | Size | Note |
|---|---|---|
| `apps/bot/src/shadow/` | 84 files · ~15.6k loc | member-graph + role-sync (the bulk) |
| `apps/bot/src/verify/` | 3 files · ~0.6k loc | onboarding web routes |
| `packages/persona-engine/src/onboarding/` | 20 files | moves as a unit |
| `apps/bot/src/cli/member-graph.ts` | 1 file | ingestion CLI |

### What must be neutralized first (the only real work)
1. **`persona-engine/src/score/community-client.ts`** — REST community score client,
   8 shadow importers. Lives in persona-engine only because the MCP score client
   does. → lift into a neutral `@freeside/score-client` pkg (or into the building).
   This is the load-bearing extraction dependency.
2. **`deliver/enriched-render.ts`** — one render helper. Copy into the building or
   share via a thin render pkg. Trivial.
3. **`orchestrator/freeside_auth/server.ts`** pg-pool — shared infra; duplicate or
   neutral-pkg.

### What stays (the `characters` daemon)
`persona-engine/src/{voice,persona,compose,orchestrator,deliver,ambient,events,score(MCP),preview,observability}` + `apps/character-*` + `apps/bot/src/discord-interactions` (chat path). The three voice surfaces (chat · digest · event) are untouched.

## ⟳ Posture correction (operator, 2026-07-06): membrane now, moat later

The operator pulled back on physical extraction — rightly. "We may be pushing the
distributed-network stuff too early. No users yet but a bunch of microservices…
do NOT boil the ocean." The layering must be **understood** (so characters is
never applied to the CM-data surface) — but understanding is a **membrane**
(type + lint + discipline), not a **moat** (repo split / service). See
[`docs/LAYERING.md`](../../../docs/LAYERING.md).

So this brief is **not** a go-extract plan. The seam measurement above is the
*asset* (a clean membrane = a free future option), not a to-do. What we do NOW is
keep the membrane sharp in place; the moat gets dug only when a real force strikes.

### Now (in-place, no distribution)
1. **Membrane guard is live** — `scripts/lint-who-what-membrane.sh` (green today;
   ops imports zero voice modules). Wire as `lint:membrane` in CI when you want teeth.
2. **Neutralize the score-client** *when convenient* — lift
   `persona-engine/src/score/community-client.ts` into a neutral score-client pkg.
   Valuable standalone (sharpens the membrane); not urgent.

### Later (only when a force pulls — do not pre-build)
- **The WHO-as-product force:** a CM wants to deploy a character into their Discord
  as a feature. That's what justifies `characters` becoming a standalone deployable.
- **The WHAT-scale force:** the CM-data spine needs independent scale/lifecycle →
  its home is **`shadow-mode-api`** (already in loa-freeside; graduates to its own
  building *if it makes sense*, per operator). `mediums-api` is a deprecation
  candidate (fold in) — operator's open question, not ours to decide here.
- Then, and only then: rename `freeside-characters` → `characters`; drop the
  `apps/character-onboarding` placeholder (the building owns that surface).

## Open questions for the operator

- **Q1** — role-sync executor: fold onto `shadow-mode-api`, or its own building? (This
  is the one real fork; the rest follows from it.)
- **Q2** — `characters` vs `characters-api`: it's a daemon, not an API surface (no
  public HTTP beyond the Discord interactions webhook). "characters" reads truer.
- **Q3** — sequence vs the live Purupuru role-sync ([[project_purupuru-tier-role-onboarding-trajectory]]):
  extract before or after that goes LIVE? Extracting first avoids re-homing live code.

## Non-goals for this brief
Not a migration. `status: candidate` — does not drive build without operator
approval + a /plan gate. Blast radius (cross-repo, new building, rename) mandates
the full pipeline.
