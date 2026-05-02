# Agent Working Memory (NOTES.md)

> This file persists agent context across sessions and compaction cycles.
> Updated automatically by agents. Manual edits are preserved.

## Active Sub-Goals
<!-- Current objectives being pursued -->

- **V0.7-A.1 environment substrate** — kickoff brief at `grimoires/loa/specs/build-environment-substrate-v07a1.md`. Phase A (Loa mount) shipped via commit `daed064`. Sprint plan complete at `grimoires/loa/sprint.md` covering Phases B-E (required) + F (optional). 31 beads created across 5 epics; cycle-001 active in ledger. Next: `/build` (Sprint 1 — Channel-Zone Reverse Map).

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
| 2026-05-02 | sprint-planner | Initialized cycle-001 ledger; authored sprint.md decomposing spec Phases B-E (required) + F (optional) into 5 sprints; created 31 beads (5 epics + 26 tasks) with full dependency graph; auto-assigned 5 cycle goals (G-1..G-5) from spec invariants/done-bar; 5 ready issues at start-line (Sprint 1's first tasks + Sprint 5 epic) |

## Decision Log
<!-- Major decisions with rationale -->

| Date | Decision | Rationale | Decided By |
|------|----------|-----------|------------|
| 2026-05-01 | Submodule mode mount (not checkout) pinned to v1.108.0 | Matches bonfire's pattern; sharing one Loa version across operator repos avoids drift; pin allows controlled bumps via `git submodule update --remote .loa` | operator + ARCH (Ostrom) |
| 2026-05-01 | Phase A ships as standalone PR; substrate work (Phases B-E) deferred to follow-up sessions inside this repo | Clean workflow boundary — once Loa is mounted, B-E run through `/sprint-plan` + `/implement` gates with beads tracking. Avoids "while-I'm-here" scope creep on a framework-mount PR (Barth scope discipline) | operator + SHIP (Barth) |
| 2026-05-02 | Treat the kickoff brief as combined PRD+SDD instead of running /plan-and-analyze + /architect anew | Spec frontmatter declares `external_work_plan: true`; spec already contains invariants, blast radius, component specs, build sequence, and verify-gates. Synthesizing a separate PRD/SDD would dilute the operator's authored brief without adding signal. Sprint plan cites spec lines directly | sprint-planner |
| 2026-05-02 | Sprint = phase 1:1 (5 sprints not bundled) | Each phase has independent revert boundary per spec invariant lines 113-114; bundling Phase B+C or D+E would dilute "stop at phase boundary if voice fidelity regresses" gate from spec line 567 | sprint-planner |
| 2026-05-02 | Phase F kept as Sprint 5 OPTIONAL (not deleted) | Spec explicitly notes operator-approval-gated; promoting it to OPTIONAL keeps the bead-tracked surface visible without blocking cycle completion. Excluding it would lose discoverability of the empirical-density task | sprint-planner |
| 2026-05-02 | Auto-assigned goal IDs G-1..G-5 from spec invariants/done-bar (lines 78-86, 569, 609) | Spec phrases done-bar as paragraph without explicit IDs; protocol requires explicit IDs; assignment logged to trajectory for traceability | sprint-planner |
| 2026-05-02 | `buildEnvironmentContext` takes resolved `zone: ZoneId \| undefined` instead of spec-shown `channelId + config` | Spec's `compose/environment.ts` example called `getZoneForChannel(args.config, args.channelId)` internally, but Sprint 1 placed `getZoneForChannel` in `apps/bot/src/lib/channel-zone-map.ts` (workspace direction prevents persona-engine from importing apps/bot). Bot dispatcher (Sprint 3 / Phase D) owns the channelId→zone resolution; environment.ts gets the resolved zone. Output block shape (the integration contract for the LLM) is unchanged. | sprint-2-implementer |
