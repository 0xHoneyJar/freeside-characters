---
title: boundary-aware fagan / immune system construct — sketch
status: candidate · exploratory
created: 2026-05-13
source_session: pr-review · score-mibera#109 + handoff letter to freeside-cli agent
companion-to: 2026-05-13-to-freeside-cli-agent.md
expiry: when prototyped OR operator revokes
use_label: usable
boundaries:
  - exploratory sketch, not a spec — operator hasn't approved building
  - does not commit to a construct authoring cycle
  - cites doctrine that IS canon (vault paths included)
---

# sketch · boundary-aware fagan / immune system construct

## the gap this fills

the auth/identity/profile/score boundary doctrine is canon (4+ vault
docs since 2026-04-16, operator-confirmed 2026-04-29). but **the
doctrine is inert** — it doesn't fire when an agent or human is about
to propose a tool/field/schema that crosses the boundary.

result: same confusion surfaces every 2-4 weeks (SatanElRudo bug class,
2026-04-29 boundary lock, 2026-05-13 PR #109 violation).

## the proposal in one line

a small construct that runs on identity/auth/profile/score-touching PRs,
asserts the four canonical boundaries, cites vault on violation, and is
**vocal but not blocking** (overridable with stated reason → audit trail).

## the four boundaries it asserts

| # | boundary | source doctrine | symptom of violation |
|---|---|---|---|
| 1 | score-mcp never emits handles | `vault/wiki/concepts/score-vs-identity-boundary.md` (operator-confirmed 2026-04-29) | `resolve_identities`-shaped tools on score-mibera; handle / discord / mibera_id fields in score responses |
| 2 | credential / identity / session are separate layers | `vault/wiki/concepts/freeside-as-identity-spine.md` | freeside-auth resolving wallet sigs directly; auth lib issuing canonical user IDs |
| 3 | profiles are per-brand, keyed by canonical user_id | `vault/wiki/concepts/sign-in-with-thj.md` + ADR-038 | shared profile table across brands; profile fields on freeside spine |
| 4 | session JWTs use canonical user_id, never provider-internal IDs | `vault/wiki/concepts/cross-app-session-contamination.md` | `sub` claim = Dynamic `env_id`; shared cookie domain + separate profile tables |

## three possible shapes

### shape A — fagan extension (smallest)

new `boundary-doctrine` register in `construct-fagan`. fires on PRs that
touch a configured set of paths (auth surfaces, identity surfaces, score
surfaces). emits structured findings citing vault. composes with existing
fagan review pipeline.

pros: lowest cost, reuses existing fagan infrastructure, single PR comment surface
cons: tied to PR moments only — doesn't fire on a tool proposal in chat or a doc draft

### shape B — standalone construct ("guardian", "warden", whatever)

new construct in the constructs ecosystem. ships with the four boundary
checks, a citation engine (vault lookup), and a permissive-override flag
that requires reason text. fires on:
- PR creation (via GH webhook or workflow)
- pre-commit (optional, for local boundary checks)
- on-demand (`/guardian boundary-check <file>`)

pros: lives anywhere doctrine lives, not just PRs
cons: more to build; needs its own lifecycle

### shape C — pattern in `construct-honeycomb-substrate`

extends the honeycomb-substrate doctrine pack with a "boundary doctrine"
pattern. ships the four-boundary check as a pattern entry. consumers
adopt by following the pattern recipe (the four-folder + suffix-as-type
discipline + boundary tests at every seam).

pros: lives where architectural doctrine already lives; cycle-aware
cons: pattern is descriptive, not enforcing — needs to be wired with
tests or fagan to actually fire

## my hunch

**shape A first** (fagan extension), with shape B as a v2 if the firing
moments need to expand. shape C can capture the pattern as documentation
in parallel — they're not exclusive.

reason: fagan is already in use. the cost of adding a register is small.
if it catches PR #109-shaped proposals before they're posted, that's
enough payoff to justify it. if it needs to expand later, we know what
direction.

## what the citation looks like (mock)

a violation finding from shape A might read:

```
[BOUNDARY-DOCTRINE] score-vs-identity violation

file: src/mcp/tools/resolve-identities.ts
finding: tool emits `display_name`, `discord_id`, `mibera_id` from
         score-mibera response shape

doctrine: vault/wiki/concepts/score-vs-identity-boundary.md
quote: "score-mcp ships factor metadata (UNIX self-description).
        identity (wallet → handle) lives in freeside. they cross
        paths but never conflate."
operator-confirmed: 2026-04-29

remediation:
- if identity enrichment is the use case, route through freeside-identity
  (currently `freeside_auth` MCP, rename in flight)
- if score-mibera needs identity for its own internal joins, fine — but
  do not emit identity in the public MCP response surface

override: to proceed despite this finding, add `boundary-doctrine-override:
"<reason>"` to PR description. override goes to audit log.
```

## open questions

- where does the construct live — score-mibera repo, loa-freeside, construct-honeycomb-substrate, freeside-characters, or its own pack?
- what's the citation engine read path? (vault is operator-local; can't read it from CI)
  - option: vendor the four doctrine docs into the construct as `lore/` resources, version them, refresh on cycle
  - option: doctrine becomes a published artifact (RFC pages, GH issues, etc.) the construct can fetch
- which paths trigger the check? (config-driven, but needs sane defaults — likely `**/mcp/tools/*`, `**/auth/**`, `**/identity/**`, `**/score-*/**`)
- override audit trail — where does it live? L4 trust ledger? simple `.run/boundary-overrides.jsonl`?

## work needed before this can build

1. operator approves the shape (A / B / C / something else)
2. agreement with freeside-cli agent on where this lives
3. probably a 2-cycle build: cycle-1 ships shape A with vendored doctrine; cycle-2 adds shape B firing surfaces and an override audit trail

## related

- companion handoff letter: `grimoires/loa/handoffs/2026-05-13-to-freeside-cli-agent.md`
- doctrine quoted: vault/wiki/concepts/{score-vs-identity-boundary, freeside-as-identity-spine, sign-in-with-thj, cross-app-session-contamination}.md
- construct ecosystem: `0xHoneyJar/construct-fagan`, `0xHoneyJar/construct-honeycomb-substrate`
