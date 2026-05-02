# Agent Working Memory (NOTES.md)

> This file persists agent context across sessions and compaction cycles.
> Updated automatically by agents. Manual edits are preserved.

## Active Sub-Goals
<!-- Current objectives being pursued -->

- **V0.7-A.1 environment substrate** — kickoff brief at `grimoires/loa/specs/build-environment-substrate-v07a1.md`. Phases B-E still to ship after this Phase A (mount) PR lands. Spec is the canonical sprint-plan input for the next session inside this repo.

## Discovered Technical Debt
<!-- Issues found during implementation that need future attention -->

- **`docs/` ↔ `grimoires/loa/specs/legacy-imports/` duplication** — mount PR copied AGENTS.md, ARCHITECTURE.md, CIVIC-LAYER.md, MULTI-REGISTER.md, CHARACTER-AUTHORING.md into legacy-imports/ without removing originals. Follow-up cleanup: pick canonical home (likely grimoires/), rewrite intra-repo references, delete duplicates. Track as separate PR.

## Blockers & Dependencies
<!-- External factors affecting progress -->

## Session Continuity
<!-- Key context to restore on next session -->
| Timestamp | Agent | Summary |
|-----------|-------|---------|
| 2026-05-01 | mounting-framework | Mounted Loa v1.108.0 as submodule; State Zone initialized; CLAUDE.md gained `@.claude/loa/CLAUDE.loa.md` import; build-environment-substrate-v07a1.md ported into grimoires/loa/specs/ |

## Decision Log
<!-- Major decisions with rationale -->

| Date | Decision | Rationale | Decided By |
|------|----------|-----------|------------|
| 2026-05-01 | Submodule mode mount (not checkout) pinned to v1.108.0 | Matches bonfire's pattern; sharing one Loa version across operator repos avoids drift; pin allows controlled bumps via `git submodule update --remote .loa` | operator + ARCH (Ostrom) |
| 2026-05-01 | Phase A ships as standalone PR; substrate work (Phases B-E) deferred to follow-up sessions inside this repo | Clean workflow boundary — once Loa is mounted, B-E run through `/sprint-plan` + `/implement` gates with beads tracking. Avoids "while-I'm-here" scope creep on a framework-mount PR (Barth scope discipline) | operator + SHIP (Barth) |
