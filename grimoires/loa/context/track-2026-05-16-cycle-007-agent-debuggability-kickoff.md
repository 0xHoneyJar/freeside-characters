---
session: cycle-007 · kickoff
date: 2026-05-16
type: kickoff
status: planned
predecessor: cycle-006 (merged 3324a8d · candidate · awaits operator-paced canary)
---

# Track · cycle-007 — Agent Debuggability Through Medium-Aware Layering (kickoff)

## Scope

- Dashboard becomes the force function for substrate ↔ voice ↔ presentation ↔ medium-render layer discipline
- Two production bugs from cycle-006 canary fire (zone-name leak · Discord mobile font regression) are FR-1 + FR-2 the cycle solves end-to-end
- Trace events get explicit `layer` markers so a pasted JSON row tells me which layer to fix in one inference step
- New CLI surface (`scripts/trace.ts`) for agent-readable trace access — operator can copy-paste rows to chat without grep
- Medium-aware rendering: pull `@0xhoneyjar/medium-registry` deeper into the renderer · extend locally with Discord-specific metrics · upstream propose at cycle close
- Canonical zone-display-name resolver (`domain/zone-registry.ts`) ends the ZONE_FLAVOR/ZONE_LABEL dual-registry inconsistency

## Artifacts

- Architecture: `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` (decisions D1-D6 · blast radius · Alexander craft specs · Barth scope cuts · open questions)
- Build doc: `grimoires/loa/specs/enhance-cycle-007-agent-debuggability.md` (sprint sequence S0-S8 · load order · acceptance criteria · verify commands)

## Prior session

cycle-006 substrate-presentation refactor shipped 9 sprints across 4 Red Team ACs (RT-001/002/007/008) + 8 Flatline BLOCKERs + 16 BB design-review findings. PR #82 merged at `3324a8d` on main. Status: `candidate` — flips to `archived` after operator-paced production canary + mechanical wiring of 6 remaining orchestrators (digest is canonical exemplar · pattern documented in `digest-voice-memory.test.ts`).

Closing posture: substrate-native trace dashboard at `localhost:3001` is the seed for cycle-007's force function. Two canary bugs are LIVE — operator chose to fold them into cycle-007 as the canary surface rather than patch in isolation.

## Decisions made (preplan)

- **D1** — single canonical zone-display registry at `domain/zone-registry.ts` · `ZONE_FLAVOR` + `ZONE_LABEL` deleted · `resolveZoneDisplayName` + `resolveZoneRichLabel` + `detectKebabZoneIds` exported
- **D2** — `observability/trace-envelope.ts::wrapTraceEntry(layer, op, payload)` wraps ALL JSONL writes additively (existing schemas tolerate absence)
- **D3** — local `deliver/medium-extensions.ts` extends `MediumCapability` with `codeBlockMonoCharWidth` · `digitWidthSpaceChar` · `mobileProportionalWrap` · `emojiWidthInMonospace` · etc. Upstream propose at cycle close (not during)
- **D4** — `scripts/trace.ts` CLI: 5 subcommands (`latest` · `get` · `layer` · `voice` · `explain`) · `--format human` for chat-paste · the load-bearing agent-debug interface
- **D5** — U+2007 FIGURE SPACE replaces ASCII space as padding char in `renderSnapshotField` (OpenType tabular-figure invariant survives Discord mobile sans-serif regression)
- **D6** — the two bugs are FR-1 + FR-2 · scoped independently · cycle's payoff is the architectural pattern that catches the CLASS of each bug

## Invariants

1. Substrate (domain/, ports/) MUST NOT depend on presentation
2. Presentation routes through descriptor capabilities · no hardcoded medium conditionals
3. Voice (LLM call) MUST NEVER see substrate-shape identifiers in prompt
4. Trace events MUST carry explicit layer markers (no agent-side grep required)
5. Dashboard data MUST be agent-CLI-readable
6. Backwards compat: all existing JSONL · OTEL spans · cycle-006 paths preserved (additive only)
7. `@0xhoneyjar/medium-registry` upstream stable · local extension only this cycle

## Sprint shape (proposed)

```
S0 · calibration spike       (1 task · 0.5d)
S1 · zone-registry D1        (4 tasks · 1d)
S2 · trace envelope D2       (4 tasks · 1d)
S3 · medium extensions D3    (3 tasks · 1d · FR-2 closure point)
S4 · trace CLI D4            (5 tasks · 1.5d · the agent-debug surface)
S5 · dashboard UI extension  (4 tasks · 1.5d · force-function surface)
S6 · FR-1 sanitizer hook     (2 tasks · 0.5d · LOG-ONLY · V1)
S7 · orchestrator port cleanup (2 tasks · 0.5d · cycle-006 leak closure)
S8 · cycle close             (5 tasks · 0.5d)
─────────────────────────────────────────────
total: 30 tasks · ~7-8 working days · MEDIUM-to-LARGE
```

## Open questions for /plan-and-analyze

1. Trace envelope retroactive vs forward-only? (Lean: forward-only)
2. `detectKebabZoneIds` auto-substitute or log-only? (Lean: log-only V1 · V2 decides w/ evidence)
3. CLI subcommand set fixed at 5? (Operator validation needed)
4. Dashboard SSE vs 2s poll? (Marginal · poll fine for V1)
5. CLI bun-link global vs project-local? (Operator preference)
6. freeside-mediums upstream timing at cycle close · with what evidence? (Operator-coordinated)

## Operator latitude granted

- "you can question the question"
- "you can work on wotever you want in addition to the requests"
- "you can work on a % of stuff you don't even have to report about"
- "be crazy. creative. loving... mad agent ai stuff that i don't even have the language for"

The mad-AI 20% candidates (not promised):
- `trace:summary` daily/weekly layer-health report
- Pattern detection on the trace stream ("voice produced kebab-zone-id 4 times this week · all in shape-A-all-quiet · LLM reaches for substrate names when prompt context thin")

## Substrate kickoff trail

- run_id · `20260516-8b993e`
- trail file · `.run/compose/20260516-8b993e/orchestrator.jsonl`
- phase events captured · `kickoff_init` · `phase_exit:dig` · `phase_enter:preplan_arch`
- Phase 5 will emit final handoff packet to `.run/compose/20260516-8b993e/envelopes/final.kickoff.handoff.json` (if `surface-envelope.sh` available)
