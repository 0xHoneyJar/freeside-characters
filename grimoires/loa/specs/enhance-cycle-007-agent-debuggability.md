# Session N+1 · cycle-007 — Agent Debuggability Through Medium-Aware Layering

> The dashboard becomes the force function for proper substrate ↔ voice ↔ presentation ↔ medium-render separation. Two production bugs from cycle-006's canary fire (zone-name leak + Discord mobile font regression) become the canary surface this cycle solves end-to-end.

## Context

Cycle-006 just merged (`3324a8d` on main) — substrate-presentation refactor with 9 sprints, 4 Red Team ACs closed, 8 Flatline BLOCKERs integrated. The result: clean domain/ports/live/mock layering, a working voice-memory primitive across 8 streams, and a substrate-native trace dashboard at `localhost:3001`.

Two bugs from the production canary fire reveal where the cycle-006 framework stops short:

1. **Voice produces non-canonical zone names** — LLM said "el-dorado" instead of "El Dorado". The kebab substrate ID leaked into prose. No sanitizer catches it.
2. **30d snapshot misaligned on Discord mobile** — values right-align mathematically (verified at col 15) but Discord's Android client falls back to `gg sans` for code blocks (community-reported regression), breaking ASCII-space monospace assumption.

Both are symptoms of a deeper gap: the presentation layer doesn't know enough about its target medium, and the trace surface doesn't make layer-of-origin obvious enough for an agent (me) to fix bugs from a pasted JSON blob.

The cycle-007 frame chosen by operator: **the dashboard surfaces the layering it enforces**. Each trace row carries explicit layer markers. When operator pastes a row to me in chat, I IMMEDIATELY know which layer to fix. The dashboard becomes the developer-experience anchor that hardens substrate-vs-presentation discipline in code.

## Load Order

Read these in order BEFORE writing code:

1. `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` — full architecture decisions D1-D6, blast radius, Alexander craft specs, Barth scope cuts
2. `grimoires/loa/cycles/cycle-006-substrate-presentation/COMPLETED.md` — what cycle-006 delivered, the spec deviations, the 4 Red Team ACs + 8 Flatline BLOCKERs already closed
3. `grimoires/loa/NOTES.md` — Decision Logs (cycle-006 sprint review · Red Team · earlier session continuity)
4. `CLAUDE.md` + `.claude/loa/CLAUDE.loa.md` — project-specific rules, especially "Discord-as-Material" non-negotiables and the construct-boundary table
5. `packages/persona-engine/src/live/discord-render.live.ts` — `renderSnapshotField` (lines 42-63) is the FR-2 root-cause site
6. `packages/persona-engine/src/score/types.ts` — `ZONE_FLAVOR` + `ZONE_LABEL` (the dual-registry inconsistency D1 closes)
7. `packages/persona-engine/src/observability/llm-trace.ts` — current trace schema, what's missing (D2 envelope)
8. `scripts/dashboard.ts` — current dashboard surface, where the layer-color encoding extends (D4)

## Persona

Load the ARCH mode + craft lens:
- `.claude/constructs/packs/the-arcade/identity/OSTROM.md` — ARCH structural thinking
- `.claude/constructs/packs/artisan/identity/ALEXANDER.md` — craft specification

The Ostrom-Alexander pair is right for cycle-007 because half the work is structural (canonical resolver, layer envelope, descriptor extension) and half is craft (dashboard UI, CLI human-format output, color-as-information encoding).

When sprint-implementing: drop ARCH, load BARTH (`the-arcade/identity/BARTH.md`) for ship discipline.

## What to Build (sprint sequence)

### Sprint 0 — Calibration spike (1 task · 0.5 day)

**Validate D1 before committing**: spike `git grep -rE "ZONE_FLAVOR|ZONE_LABEL" packages apps scripts` across the full repo. Surface every call site. If callers exist outside `packages/persona-engine/src/`, the consolidation needs broader migration than D1's recommendation assumes. Surface findings before S1 commits.

**Acceptance**: `sprint-0-COMPLETED.md` lists every call site. Operator confirms scope (or expands it).

**Deliverable**: `scripts/spike-zone-registry-callers.ts` (auto-deletes at sprint close · NET 0 LoC).

### Sprint 1 — D1 zone-registry canonicalization (4 tasks · 1 day)

T1.1 · Author `packages/persona-engine/src/domain/zone-registry.ts`:
```typescript
import { ZONE_IDS, type ZoneId, type ZoneDimension } from '../score/types.ts';

export interface ZoneDisplayRecord {
  readonly id: ZoneId;
  readonly emoji: string;
  readonly displayName: string;        // "El Dorado"  — for prose
  readonly dimension: ZoneDimension;
  readonly richLabel: string;          // "⛏️ El Dorado (NFT)" — for Discord headlines
}

export const ZONE_REGISTRY: Readonly<Record<ZoneId, ZoneDisplayRecord>> = {
  // ... pull from current ZONE_FLAVOR + ZONE_LABEL · canonicalize the schema
};

export function resolveZoneDisplayName(zone: ZoneId): string;
export function resolveZoneRichLabel(zone: ZoneId): string;
export function detectKebabZoneIds(text: string): ZoneId[];
```

T1.2 · Tests (`domain/zone-registry.test.ts`) — 4 zones + kebab-detector edge cases (case-insensitive, word-boundary, in-code-block escaping).

T1.3 · Migrate `live/discord-render.live.ts` ZONE_LABEL constant → `resolveZoneRichLabel()` call.

T1.4 · Audit `compose/voice-brief.ts` ZONE_VOICE_CONTEXT for kebab leak. Audit `persona/loader.ts:267` — already correct, just sanity-check.

**Acceptance**: 0 `git grep ZONE_LABEL` hits outside the test file. All voice paths use `resolveZoneDisplayName`. Tests green.

### Sprint 2 — D2 trace envelope (4 tasks · 1 day)

T2.1 · Author `packages/persona-engine/src/observability/trace-envelope.ts`:
```typescript
export type TraceLayer = 'substrate' | 'presentation' | 'voice' | 'medium-render' | 'orchestrator';
export interface TraceEnvelope { layer: TraceLayer; layer_op: string; emitted_at: string; }
export function wrapTraceEntry<T>(layer: TraceLayer, layer_op: string, payload: T): T & TraceEnvelope;
```

T2.2 · Wrap `compose/agent-gateway.ts::writeLlmTraceEntry` callsites (2 of them) with envelope.

T2.3 · Wrap `live/voice-memory.live.ts::appendEntry` + `forgetUser` audit writes with envelope.

T2.4 · Wrap `live/score-mcp.live.ts::recordRejection` with envelope.

**Acceptance**: every JSONL write in `.run/` produced after this sprint includes `layer` + `layer_op` + `emitted_at`. Backwards compat: readers tolerate absent fields for pre-cycle-007 rows.

### Sprint 3 — D3 medium extensions (3 tasks · 1 day)

T3.1 · Author `packages/persona-engine/src/deliver/medium-extensions.ts`:
```typescript
import { DISCORD_WEBHOOK_DESCRIPTOR } from '@0xhoneyjar/medium-registry';

export interface ExtendedMediumMetrics {
  readonly codeBlockMonoCharWidth: number;
  readonly codeBlockMobileFallbackRisk: 'high' | 'low' | 'none';
  readonly digitWidthSpaceChar: string;
  readonly mobileProportionalWrap: number;
  readonly emojiWidthInMonospace: 1 | 2;
}

export const DISCORD_EXTENDED: ExtendedMediumMetrics = {
  codeBlockMonoCharWidth: 38,        // discord.js#3030 wrap-at-40 minus 2 safety
  codeBlockMobileFallbackRisk: 'high', // Android sans-serif regression
  digitWidthSpaceChar: ' ',     // FIGURE SPACE
  mobileProportionalWrap: 40,
  emojiWidthInMonospace: 2,
};

export function metricsForMedium(medium: MediumCapability): ExtendedMediumMetrics;
```

T3.2 · Tests (`deliver/medium-extensions.test.ts`) — figure space invariant (`' '.length === 1`), Discord-extended descriptor, fallback to CLI defaults for CLI medium.

T3.3 · Update `live/discord-render.live.ts::renderSnapshotField` to consume `metricsForMedium(...).digitWidthSpaceChar` for padding + `codeBlockMonoCharWidth` for value cap. (D5 implementation point.)

**Acceptance**: digest fired against Discord with `BEDROCK_USE_SDK=1` produces a snapshot field where every value-end column matches verifiable via `.run/llm-trace.jsonl` byte-comparison. Operator screenshots from mobile show aligned columns.

### Sprint 4 — D4 trace CLI (5 tasks · 1.5 days)

T4.1 · Author `scripts/lib/trace-readers.ts` extracting from `scripts/dashboard.ts` (shared between dashboard + CLI).

T4.2 · Author `scripts/trace.ts` with 5 subcommands per D4:
```bash
bun run trace:latest [--zone X] [--layer L]
bun run trace:get --run-id Y
bun run trace:layer --layer L [--zone X]
bun run trace:voice --zone X [--format human|json]
bun run trace:explain <pasted-json>
```

T4.3 · Wire `bun run trace:*` aliases into root `package.json` scripts.

T4.4 · Tests (`scripts/trace.test.ts`) — each subcommand · JSON output schema · human-format markdown snapshot.

T4.5 · Document the operator-facing UX in `docs/trace-cli.md` — copy-paste examples, the canonical "paste a buggy row to Loa" workflow.

**Acceptance**: I (Loa) successfully use `bun run trace:explain <pasted-row>` and correctly identify the producing layer + file:line for a synthetic bug fixture. Operator confirms ergonomics.

### Sprint 5 — Dashboard UI extension (4 tasks · 1.5 days)

T5.1 · `scripts/dashboard.ts` consumes `scripts/lib/trace-readers.ts` (shared with CLI).

T5.2 · Layer-color encoding per Alexander spec — 4 colors (`oklch(64%/0.10/230)` substrate · `oklch(72%/0.14/80)` voice · `oklch(70%/0.10/160)` presentation · `oklch(68%/0.10/320)` medium-render). 3px left border on each row.

T5.3 · Detail panel layer split — when a row is selected, panels for substrate/voice/presentation/medium-render populate side-by-side or stacked (whichever fits viewport). Cross-layer connectors per Alexander spec.

T5.4 · Visual regression test fixtures — checked-in screenshots of the dashboard with synthetic trace data. Operator-attested at sprint close.

**Acceptance**: operator visual-verifies the layer-color encoding is teachable in <3 minutes of use. The "paste-to-Loa" UX is concrete.

### Sprint 6 — FR-1 sanitizer hook (2 tasks · 0.5 day)

T6.1 · Add `detectKebabZoneIds` call in `deliver/sanitize.ts::stripVoiceDisciplineDrift` chain. LOG-ONLY in V1 — don't auto-substitute. Emit OTEL `voice.kebab_zone_leak_detected` event with violation count + sample.

T6.2 · Test: feed synthetic voice "el-dorado wakes from a long sleep" → sanitizer logs violation BUT passes the text through unchanged (V1 logging policy).

**Acceptance**: 24 hours of cron-fired digests produces a clean log of every kebab-zone-id mention in voice output. Operator decides V2 auto-substitution policy with this evidence.

### Sprint 7 — Orchestrator port cleanup (2 tasks · 0.5 day · cycle-006 leak closure)

T7.1 · Extract `toDigestPayload`, `toMicroPayload`, `toLoreDropPayload`, `toQuestionPayload`, `toWeaverPayload`, `toCalloutPayload`, `toChatReplyPayload` imports — all currently import directly from `live/discord-webhook.live.ts` in 7 orchestrator files. Route through `PresentationPort` instead.

T7.2 · `composer-router.test.ts` extended to verify no `to*Payload` import survives in `orchestrator/*.ts`.

**Acceptance**: `bash scripts/audit-substrate-presentation-seam.sh --strict-composer` exits 0. Orchestrator files import ONLY from `ports/`.

### Sprint 8 — Cycle close (5 tasks · 0.5 day)

T8.1 · COMPLETED.md cycle summary, lessons distilled, evidence-based decisions, operator-paced follow-ups documented.

T8.2 · E2E acceptance: operator fires digest → opens dashboard → sees layer-color encoded rows → clicks row → sees layer-split detail → copies a row → pastes to me → I identify layer correctly. Recorded as evidence.

T8.3 · Bridgebuilder round 3 review.

T8.4 · Operator-attested production canary on Discord mobile (verifies FR-2 figure-space fix).

T8.5 · Ledger flip cycle-007 `candidate → archived`.

## Design Rules (Alexander · craft compliance)

- All trace events are typed by LAYER (substrate · voice · presentation · medium-render · orchestrator). The layer field is non-optional, freezable, and rendered as a 3px colored border on every dashboard row.
- ZONE_FLAVOR + ZONE_LABEL are DELETED. `domain/zone-registry.ts::ZONE_REGISTRY` is the canonical map. Any place that displays a zone in prose calls `resolveZoneDisplayName`. Any place that displays a zone as a Discord-rich-headline calls `resolveZoneRichLabel`.
- `renderSnapshotField` padding character is `' '` (U+2007 FIGURE SPACE), NOT ASCII `' '`. Reasoning: U+2007 is OpenType-tabular-figure-width-invariant across font fallback. Discord mobile's `gg sans` regression cannot break alignment built from figure spaces.
- Renderer reads ALL medium-specific numeric constants from `metricsForMedium(medium)`. Hardcoded `1024`, `6000`, `19`, `40`, `38` constants in render code are forbidden after S3.
- The CLI human-format output uses inline glyphs (▣ ◈ ◆ ▶) for layer indication. NO ANSI color in human format unless TTY-detected (operator may pipe to `pbcopy` for paste-to-chat — color codes mangle the markdown).
- The dashboard color palette uses oklch · NOT hex · NOT rgb · NOT named-colors. The 4 layer accent colors are checked-in fixtures.
- Visual regression test fixtures live at `scripts/dashboard-fixtures/*.png` and are operator-attested at S5 close.

## What NOT to Build (Barth · ship discipline)

- ❌ No renderer for Telegram, CLI, or Web mediums (medium-extensions DESIGNS for them but doesn't deliver other adapters).
- ❌ No time-travel replay (CLI can READ traces but not RE-EXECUTE them).
- ❌ No per-zone different voice models.
- ❌ No port change for dashboard (3001 stays).
- ❌ No `.run/audit.jsonl` refactor (Loa framework owns it).
- ❌ No trace envelope schema versioning beyond v1 implicit.
- ❌ No upstream PR to freeside-mediums during this cycle — propose AT cycle close.
- ❌ No `detectKebabZoneIds` auto-substitution (V2 only after V1 log evidence).

## Verify

Cycle-007 acceptance = ALL of:

```bash
# Sprint 0
bash scripts/spike-zone-registry-callers.ts && cat sprint-0-COMPLETED.md  # surfaces complete

# Sprint 1
git grep -E "ZONE_FLAVOR|ZONE_LABEL" packages apps | grep -v zone-registry.ts | grep -v test.ts | wc -l  # → 0
bun test packages/persona-engine/src/domain/zone-registry.test.ts  # green

# Sprint 2
bun run --cwd apps/bot digest:once  # one fire
jq -e '.layer' apps/bot/.run/llm-trace.jsonl | wc -l  # all rows have layer field

# Sprint 3
bun test packages/persona-engine/src/deliver/medium-extensions.test.ts  # green
# Operator screenshot of Discord mobile post · column alignment visually confirmed

# Sprint 4
bun run trace:latest --zone bear-cave  # returns latest row JSON
bun run trace:explain '<paste a real row>'  # returns layer + file:line identification

# Sprint 5
# Open http://localhost:3001 · click row · see layer-split detail · color-coded border

# Sprint 6
grep '"voice.kebab_zone_leak_detected"' apps/bot/.run/*.jsonl  # entries exist post-cron-cycle

# Sprint 7
bash scripts/audit-substrate-presentation-seam.sh
LOA_SEAM_AUDIT_STRICT_COMPOSER=1 bash scripts/audit-substrate-presentation-seam.sh  # both exit 0

# Sprint 8
grep "ARCHIVED" grimoires/loa/cycles/cycle-007-agent-debuggability/COMPLETED.md
jq -r '.cycles[] | select(.id == "cycle-007-agent-debuggability") | .status' grimoires/loa/ledger.json  # "archived"
```

## Key References

| Topic | File |
|---|---|
| Cycle arch decisions | `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` |
| Cycle-006 (predecessor · COMPLETED) | `grimoires/loa/cycles/cycle-006-substrate-presentation/COMPLETED.md` |
| Decision logs · operator-attested | `grimoires/loa/NOTES.md` |
| FR-2 root cause site | `packages/persona-engine/src/live/discord-render.live.ts:42-63` |
| FR-1 root cause site | `packages/persona-engine/src/score/types.ts::ZONE_FLAVOR` + `live/discord-render.live.ts::ZONE_LABEL` (the dual-registry) |
| Trace schema (today) | `packages/persona-engine/src/observability/llm-trace.ts::LlmTraceEntry` |
| Dashboard surface | `scripts/dashboard.ts` |
| Medium descriptor (npm dep) | `@0xhoneyjar/medium-registry@0.2.0` (consumed in `deliver/embed.ts:17-22`) |
| freeside-mediums repo (upstream propose at close) | https://github.com/0xHoneyJar/freeside-mediums |
| Discord-as-Material rules (non-negotiable) | `CLAUDE.md` |
| Loa framework rules | `.claude/loa/CLAUDE.loa.md` |

---

> Next session: `/plan-and-analyze` against this build doc to harden into PRD. Then `/architect` → `/sprint-plan` → `/simstim`. The arch doc + this build doc are the input — the PRD will codify operator-attested decisions on the 6 open questions in arch-cycle-007 §"Open Questions for /plan-and-analyze".
