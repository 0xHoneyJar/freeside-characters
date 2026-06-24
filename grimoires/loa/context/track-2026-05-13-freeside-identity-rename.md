---
title: freeside_auth → freeside_identity construct rename + auth/profiles split clarification
status: candidate
mode: pre-planning
created: 2026-05-13
source_session: pr-review · score-mibera#109 cycle-021 proposal reply
expiry: when rename ships OR operator revokes
use_label: usable
boundaries:
  - does not affect score-mibera cycle-021 (the PR reply signals "rename in flight" only)
  - does not break ruggy persona — rename is transitional with alias period
  - does not touch the upstream freeside-as-identity-spine doctrine — only the local construct naming
related-doctrine:
  - vault/wiki/concepts/freeside-as-identity-spine.md (the spine doctrine — three-layer credential/identity/session split)
  - vault/wiki/concepts/score-vs-identity-boundary.md (operator-confirmed 2026-04-29)
  - vault/wiki/concepts/sign-in-with-thj.md (shared auth + siloed profiles)
  - vault/wiki/concepts/cross-app-session-contamination.md (the SatanElRudo bug class)
  - vault/wiki/entities/better-auth.md (credential layer evaluation)
---

# track · freeside_auth → freeside_identity rename

## frame

PR #109 reply (2026-05-13) signaled "renaming `freeside_auth` in flight
to clarify the auth-vs-profiles split." This file holds the architectural
context that triggered the rename so it doesn't evaporate.

operator framing (2026-05-13 in-session):
> "auth and profiles separate cleanly … freeside-identity makes the most
> sense … a combination they go together but also built in a composable
> way that allows for separation … we have had so many conflicts around
> auth/profiles getting muddied in the past."

## the architectural shape

per `vault/wiki/concepts/freeside-as-identity-spine.md`, three layers:

| layer | what | who owns |
|---|---|---|
| **credential** | wallet signature / passkey / OAuth token / email OTP | auth lib (Dynamic, Better Auth, SeedVault) |
| **identity** | canonical THJ user_id + linked credentials + tenant/tier claims | **freeside (this construct)** |
| **session** | JWT cookie / bearer consumed by a world | each world via JWKS verify |

current `freeside_auth` MCP serves the **identity** layer — wallet → handle,
discord_id, mibera_id, pfp_url resolution from `midi_profiles`. it does
NOT authenticate credentials. naming → `freeside_identity` matches what
it actually does and aligns with the spine doctrine.

## scope

- rename construct directory + manifest: `freeside_auth/` → `freeside_identity/`
- rename MCP server name: `mcp__freeside_auth__*` → `mcp__freeside_identity__*`
- rename methods if needed (resolve_wallet stays; resolve_handle_to_wallet stays — the tool names are fine, only the MCP namespace shifts)
- update ruggy persona tool_invocation_style references
- update all internal call sites
- transition period: alias `freeside_auth` → `freeside_identity` for N weeks so external consumers can migrate
- update vault `score-vs-identity-boundary.md` references

## not in scope

- shipping the actual `loa-freeside/apps/gateway` remote MCP (long-tail; this construct stays in-bot until that lands)
- changing the `midi_profiles` schema or read path
- adding new credential sources (Better Auth integration is its own track)
- merging credential + identity layers (the whole point is to keep them separate)

## why this matters beyond cosmetic

PR #109's `resolve_identities` proposal happened partly because the
boundary between auth/identity/profiles is currently muddied in names.
clean names → fewer collaborator-side mistakes → less doctrine policing.

per `cross-app-session-contamination.md`, the SatanElRudo bug (2026-02-17)
came from exactly this confusion — provider-keyed JWT + separate profile
tables. naming discipline is one of the small levers that prevents the
class from recurring.

## open questions for soju

- transitional alias period — 2 weeks? 1 cycle? operator preference?
- single PR or split (rename core + persona updates separately)?
- coordinate with `construct-honeycomb-substrate` (the doctrine pack) — does it want a pattern entry for "boundary-clarifying renames"?

## activation receipts

- `vault/wiki/concepts/freeside-as-identity-spine.md` — usable, boundaries: frames the rename rationale only
- `vault/wiki/concepts/score-vs-identity-boundary.md` — usable, boundaries: justifies why score-mibera doesn't get to emit identity
- `vault/wiki/concepts/sign-in-with-thj.md` — background_only, boundaries: long-term direction, not blocking this rename
