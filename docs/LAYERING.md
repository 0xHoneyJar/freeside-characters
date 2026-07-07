# Layering — membranes, not moats

> For any agent or human working in this repo: read this before you decide where
> a new thing lives. It exists so the character/voice layer is never applied to
> the CM-data surface, and so we don't dig microservice moats before we have
> users to justify them.

## Two axes (WHO × WHAT)

This repo hosts two orthogonal things that share a repo by history, not by nature:

| Axis | What it is | Speaks? | Lives in |
|---|---|---|---|
| **WHO** — the character daemon | living personas: chat replies, the weekly digest billboard, event pop-ins | ✅ voice | `apps/character-*`, `persona-engine/src/{voice,persona,compose,orchestrator,ambient,expression,preview}` |
| **WHAT** — the CM-data surface | verify wallet↔discord, tier→role assignment, member-graph ingestion | ❌ voiceless | `apps/bot/src/{shadow,verify}`, `persona-engine/src/onboarding` |

The WHAT surface is **CM-controlled and voiceless by design** — its user-facing
output (verify cards, role-change notices) is community-manager-configured
templates, never persona-generated. A character never derives from CM data; CM
data never wears a character's voice. That is the boundary. **Characters is not
applied to the CM-data surface.**

## Membranes, not moats

There are two kinds of boundary, and confusing them is the disease:

- A **membrane** is a boundary of *meaning* — a type contract + a lint + discipline.
  Cheap. You want many, early, razor-sharp. An agent reads a membrane to know
  *what it is allowed to be* in this file.
- A **moat** is a boundary of *deployment* — a separate repo / service / release.
  Expensive: you pay the network tax, the versioning tax, the eventual-consistency
  tax, the ops tax. You want few, late, and **pulled apart by a real force**, never
  pushed apart by a prediction.

**Premature microservices = digging moats where you needed membranes.** You pay
the distributed-systems tax to buy legibility a lint rule would have given you for
free. With no users, no force justifies a moat.

**A clean membrane is a pre-dug moat that costs nothing until you fill it.** The
WHO/WHAT seam here is already clean (the ops surface imports zero voice modules —
see `scripts/lint-who-what-membrane.sh`). That cleanliness *is* the asset: it makes
a future split a mechanical afternoon, not a surgery. We hold the option; we don't
exercise it early.

## When the moat gets dug (the forces to watch for)

Extract WHAT into its own building only when a real force strikes:

- **A CM wants to deploy a character into their Discord as a feature** — without
  taking our ops stack. (This is the WHO-as-product force. When it lands, `characters`
  wants to be a standalone deployable.)
- **The CM-data spine needs independent scale or lifecycle** — its likely home is
  `shadow-mode-api` (already exists in `loa-freeside`; graduates to its own building
  if/when it earns it).

Until a force strikes: keep it here, keep the membrane sharp. Do **not** feed the
`loa-freeside` monolith (which is itself narrowing to platform + operating surface).

## The immune mechanism

Docs rot; guards don't. The membrane is enforced executably:

- `scripts/lint-who-what-membrane.sh` — fails if the ops surface imports the voice
  layer. Run it directly today; wire it as `lint:membrane` in CI when you want teeth.
- Sibling: `scripts/audit-substrate-presentation-seam.sh` (`lint:seam`) — the
  substrate↔presentation membrane, already CI-gated.

Related crystallization: `grimoires/loa/context/2026-07-06-ops-extraction-seam.md`
(the measured seam + the deferred-extraction posture).
