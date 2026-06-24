# cycle-007 · agent debuggability through medium-aware substrate-presentation layering · PRD

> **Cycle**: cycle-007
> **Working title**: agent-debuggability
> **Date**: 2026-05-16
> **Status**: candidate (pre-SDD · post `/plan-and-analyze` interview)
> **Predecessor**: cycle-006-substrate-presentation (merged 2026-05-16 · `3324a8d` on main · ledger status `candidate`)
> **Branch target**: `feat/cycle-007-agent-debuggability` (cut from `origin/main` @ `3324a8d` · 2026-05-16)
> **Depends on**: cycle-006 merge in main · `@0xhoneyjar/medium-registry@^0.2.0` (unchanged) · Bun ≥1.1 · TypeScript strict
> **Persona**: ARCH (Ostrom) + craft lens (Alexander) for plan · BARTH for implement

---

## Metadata

| field | value |
|---|---|
| origin | two production bugs from cycle-006 canary fire (2026-05-16): (1) voice produced "el-dorado" instead of "El Dorado" (kebab substrate ID leaked into prose) · (2) 30d snapshot misaligned on Discord Android mobile despite correct math (Android `gg sans` proportional-fallback regression breaks ASCII-space monospace assumption) |
| operator directive 2026-05-16 (kickoff) | "the dashboard surfaces the layering it enforces · each trace row carries explicit layer markers · when operator pastes a row to me in chat, I IMMEDIATELY know which layer to fix" |
| operator latitude grants | "you can question the question · work on whatever you want in addition · % unreported · be crazy creative loving mad agent ai stuff" |
| load-bearing doctrine | `chat-medium-presentation-boundary` (vault · active · cycle-006 closed substrate/presentation seam) · `discord-as-material` (CLAUDE.md non-negotiables — escape-underscore, embed-fallback-content, mobile-40char-wrap) |
| upstream packages (consume only · do not modify) | `@0xhoneyjar/medium-registry@^0.2.0` (consumed in `deliver/embed.ts:17-22`) · loa-hounfour TypeBox schemas (no change) · loa-straylight memory governance (no change) |
| closes (cycle-006 production canary) | two-bug pair as FR-1 (zone canonicalization · symptom-to-class) + FR-2 (figure-space numeric padding · symptom-to-class) |
| inputs (already authored · this PRD hardens) | `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` (D1-D6 decisions) · `grimoires/loa/specs/enhance-cycle-007-agent-debuggability.md` (build doc · sprint sequence) · `grimoires/loa/context/track-2026-05-16-cycle-007-agent-debuggability-kickoff.md` (kickoff session) |
| kickoff handoff packet | `.run/compose/20260516-8b993e/envelopes/final.kickoff.handoff.json` |

---

## 1. Problem & Vision

### 1.1 problem statement

Cycle-006 shipped clean substrate/presentation/voice/medium-render layering, voice-memory production-wiring, and a substrate-native trace dashboard at `localhost:3001`. The canary fire (2026-05-16) revealed two production bugs that expose where cycle-006 stops short:

- **Bug A · zone canonicalization** — the LLM said `"el-dorado"` (kebab substrate ID) instead of `"El Dorado"` (canonical display name) in a digest post. Root cause: TWO zone-display registries (`score/types.ts::ZONE_FLAVOR` + `live/discord-render.live.ts::ZONE_LABEL`) with no `resolveZoneDisplayName` function and no sanitizer that detects kebab leakage in voice output. The substrate ID has no boundary preventing its leak through unchecked interpolation paths (`compose/voice-brief.ts::ZONE_VOICE_CONTEXT` etc).

- **Bug B · 30d snapshot mobile misalignment** — values right-align mathematically (verified at col 15) but Discord's Android client renders embed code blocks in `gg sans` (proportional fallback · community-reported regression), breaking ASCII-space monospace assumption. The padding character is `' '` (U+0020 ASCII space) instead of `' '` (U+2007 FIGURE SPACE) which is digit-width-invariant across font fallback per OpenType tabular figures.

Both are symptoms of a deeper gap: **the presentation layer doesn't know enough about its target medium, and the trace surface doesn't make layer-of-origin obvious enough for the agent (Loa) to fix bugs from a pasted JSON blob**.

> **BB REFRAME-3 disposition (accept-minor · 2026-05-17)**: Bug A and Bug B are TWO INDEPENDENT CLASSES of bugs that surface as "presentation looks wrong":
> - **Class A · substrate-identifier-leakage-through-voice** (the kebab leak · canonical-resolver + sanitizer + CI lint problem · NOT about Discord at all)
> - **Class B · medium-specific-rendering-divergence** (the figure-space misalignment · medium-knowledge + descriptor extension problem)
>
> Plus a **shared DX substrate** (envelope + CLI + dashboard) that makes both classes diagnosable. This framing makes S1 (Class A) and S3 (Class B) independently valuable — their value does NOT depend on the dashboard shipping. The "medium-aware layering" frame in the cycle title holds them together rhetorically, but the work itself has THREE deliverables, not one.

> Source: cycle-006 canary 2026-05-16 · operator-witnessed · two-bug pair triaged in kickoff session `track-2026-05-16-cycle-007-agent-debuggability-kickoff.md`.

### 1.2 vision

After cycle-007, **the dashboard becomes the developer-experience anchor that hardens substrate-vs-presentation discipline in code**. Concretely:

> **BB REFRAME-1 disposition (accept-minor · 2026-05-17)**: To be more precise — the **dashboard is the WITNESS** to layer discipline; the **FORCE FUNCTIONS** are INV-12 (CI lint at SOURCE), the trace envelope (universal layer tagging · type-enforced per INV-14), and the agent CLI surface (paste-to-Loa). The dashboard surfaces and teaches the discipline; the substrate enforces it. This distinction matters: substrate is load-bearing · UI is the celebration. S5 dashboard work is craft-polish, not cycle-spine.

- Every JSONL trace write carries a non-optional `layer` + `layer_op` marker. The dashboard renders rows with a 3px colored left-border encoding the LAYER. Operator memorizes the 4-color encoding (substrate-cool-blue · voice-warm-gold · presentation-sage-green · medium-render-lavender) within 3 minutes of use.
- An agent-first CLI surface (`bun run trace:*`) lets Loa (and any future teammate agent) read traces without HTTP detour. The killer subcommand `trace:explain <pasted-json>` parses a pasted trace row and identifies the producing layer + file:line in one inference step.
- The presentation renderer reads medium-specific knobs (`codeBlockMonoCharWidth`, `digitWidthSpaceChar`, `mobileProportionalWrap`) from a descriptor extension instead of hardcoded constants. Hardcoded `1024 / 6000 / 19 / 40 / 38` constants in render code are forbidden after S3.
- The voice layer can no longer leak kebab substrate IDs into prose — `detectKebabZoneIds(text)` runs in the sanitize chain and logs violations (V1 log-only · V2 auto-substitute pending evidence).
- The two production bugs (zone canon · figure-space padding) are CLASSES solved at the architectural layer, not point fixes.

> Operator quote 2026-05-16: "the dashboard becomes the force function for proper substrate ↔ voice ↔ presentation ↔ medium-render separation."

### 1.3 why now

- Cycle-006 just merged. The trace dashboard substrate IS there (`scripts/dashboard.ts` · localhost:3001). Extending it for layering discipline is cheap NOW while the cycle-006 frame is fresh.
- The two production bugs are LIVE in user-facing posts — every digest fire reproduces them until shipped.
- The "paste-trace-to-Loa" workflow is operator-named and recurring. Without explicit layer markers, every paste costs me a grep + reasoning round-trip. The CLI debug surface compounds across every future cycle.
- The dashboard's force-function frame composes with future cycles: cycle-008+ pattern detection on the layered trace stream (e.g. "voice produced kebab ID 4× this week in shape-A-all-quiet") becomes a one-day addition once cycle-007 lands the substrate.

---

## 2. Goals & Success Metrics

### 2.1 goals

- **G-1** Close Bug A at SOURCE (no kebab in LLM prompt · CI-lint-enforced via INV-12) + DETECT at SINK (sanitizer logs voice output violations). V1 substitution is log-only per SR-1; V2 substitution policy decision is calendarized to S6+24h evidence review (per Flatline IMP-001). PRD does NOT claim user-side substitution closure in V1 — users may still see kebab leaks for ≤24h while evidence accrues, mitigated by SOURCE-side CI lint preventing NEW interpolation sites from leaking.
- **G-2** Close Bug B (numeric mobile alignment) at the CLASS level — figure-space (U+2007) padding gated by medium descriptor, hardcoded render constants migrated to `metricsForMedium()`.
- **G-3** Every JSONL trace write carries a `layer` + `layer_op` + `emitted_at` envelope. Backwards compat: readers tolerate absent fields for pre-cycle-007 rows.
- **G-4** Agent-first CLI surface ships 5 subcommands (`trace:latest`, `trace:layer`, `trace:get`, `trace:voice`, `trace:explain`) sharing readers with the dashboard.
- **G-5** Dashboard UI surfaces the layer-color encoding (4-color border) and detail-panel layer split. SSE transport for layer-color flash on new event ships behind `LOA_DASH_SSE=1` feature flag (default 2s poll).
- **G-6** Cycle-006 orchestrator-port leak closure (7 orchestrator files importing `to*Payload` directly from `live/discord-webhook.live.ts` route through `PresentationPort` instead).
- **G-7** Operator-attested DX: pastes a buggy trace row to Loa → Loa identifies the layer-of-origin + likely file:line in one inference step. Recorded as evidence at cycle close.

### 2.2 success metrics

| metric | target | verification |
|---|---|---|
| Bug A (zone canon · SOURCE) — CI lint detects 0 kebab ZoneId literals in voice-prompt-producing files outside the registry | 0 hits | `bash scripts/lint-no-kebab-zoneid-in-voice-prompt.sh` exits 0 (S1 acceptance gate · INV-12) |
| Bug A (zone canon · SINK) — sanitizer detection rate over 24h | 100% detection rate; substitution policy deferred to V2 per IMP-001 calendarized review (S6+24h) | `grep '"voice.kebab_zone_leak_detected"' apps/bot/.run/llm-trace.jsonl` + cross-check against operator-injected kebab fixtures |
| Bug B (figure-space) — mobile digest renders aligned column | operator screenshots from Discord Android show aligned values · byte-snapshot from `.run/llm-trace.jsonl` confirms U+2007 at expected positions (SKP-002 hardening) | S0/T0.2 typography spike validates choice empirically before S3 commits (SKP-003) · S3 acceptance + byte-snapshot test |
| Trace envelope coverage | every JSONL row appended post-S2 to **freeside-characters-owned** trace files carries `layer` + `layer_op` + `emitted_at` | `jq -e '.layer'` on EXPLICIT allowlist: `apps/bot/.run/llm-trace.jsonl` + `apps/bot/.run/voice-memory/**/*.jsonl` + `apps/bot/.run/score-snapshot-rejections.jsonl` (excludes Loa-owned `.run/audit.jsonl` and pre-cycle-007 rows per SKP-001/CRITICAL) |
| Zone registry consolidation | 0 `git grep ZONE_FLAVOR\|ZONE_LABEL` hits outside `domain/zone-registry.ts` + tests | `git grep -E "ZONE_FLAVOR\|ZONE_LABEL" packages apps \| grep -v zone-registry.ts \| grep -v test.ts \| wc -l` → 0 |
| CLI agent-paste-to-Loa works | Loa correctly identifies layer + file:line from a pasted trace row in 1 inference step | E2E acceptance recorded at S8 close |
| Dashboard color encoding teachable | operator visual-verifies the 4-color encoding is teachable in <3 minutes of use | S5 operator-attested |
| Orchestrator port hygiene | no `to*Payload` import survives in `orchestrator/*.ts` | `bash scripts/audit-substrate-presentation-seam.sh --strict-composer` exits 0 |
| Hardcoded render constants migrated | 0 hardcoded `1024 / 6000 / 19 / 40 / 38` in `live/discord-render.live.ts` or `deliver/embed.ts` | grep search · S3 acceptance |
| LoC budget | ~+1400 / ~-200 → ~+1200 net (vs arch's +1300 estimate, +100 for SSE-flag T5.5) | `git diff --stat` cycle-007 branch vs main |
| BB round 3 review verdict | APPROVED or PRAISE-only findings | `/bridgebuilder-review` at S8 |
| Test suite | 0 regressions · +N new tests (medium-extensions, zone-registry, trace-envelope, trace-CLI, visual-regression fixtures) | full suite passes at every sprint close |

### 2.3 timeline

- **S0** Calibration spikes — (a) T0.1 zone-registry call-site audit + (b) T0.2 Discord Android typography fixture (U+2007 / U+2008 / U+00A0 / code-block alternatives) per SKP-003 (1 day · 2 tasks · auto-delete on cycle close)
- **S1** D1 zone-registry canonicalization (1 day · 4 tasks)
- **S2** D2 trace envelope retrofit (1 day · 4 tasks)
- **S3** D3 medium extensions + D5 figure-space padding (1 day · 3 tasks)
- **S4** D4 trace CLI (1.5 days · 5 tasks)
- **S5** Dashboard UI extension + SSE-behind-flag (1.5 days · 5 tasks · was 4 + 1 for SSE)
- **S6** FR-1 sanitizer hook (½ day · 2 tasks)
- **S7** Orchestrator port cleanup — cycle-006 leak closure (½ day · 2 tasks)
- **S8** Cycle close — E2E + BB round 3 + canary + ledger flip (½ day · 5 tasks)

**Estimate**: 9 sprints · ~32 tasks · ~7.5-8 working days. Matches arch doc estimate (7-9 sprints · MEDIUM-to-LARGE). Deviations from arch doc's sprint-task count: (a) +1 task in S5 (SSE-behind-flag · OP-Q4) · (b) +1 task in S0 (Discord Android typography spike · SKP-003 Flatline closure).

---

## 3. User & Stakeholder Context

### 3.1 primary stakeholders

- **Operator (soju)** · holds the substrate-presentation doctrine + chat-medium-presentation-boundary vault concept · authored kickoff frame "the dashboard surfaces the layering it enforces" · approves cycle gates · attests E2E acceptance criteria.
- **Future agents working in the repo (including Loa-next-session)** · explicit DX target. The CLI surface + layer-color encoding + envelope markers exist so that an agent fed a pasted trace row identifies the producing layer without ambiguity.
- **Loa (this session)** · MUST be able to consume the CLI surface from chat context. The `trace:explain` UX is operator-named "killer feature."
- **Discord users in THJ guild** · downstream consumers of ruggy + satoshi posts. Cycle-007 closes 2 visible bugs (kebab leakage in prose · mobile column misalignment).

### 3.2 secondary stakeholders

- **Codex / Bridgebuilder / Flatline multi-model reviewers** · gate cycle-007 merge at S8. Round 3 BB review must be APPROVED or PRAISE-only.
- **freeside-mediums upstream maintainer** · cycle-007 produces a local extension (`deliver/medium-extensions.ts`) with a cycle-close upstream proposal package. Coordination happens AFTER cycle close, not during.
- **score-mibera substrate team** · consumed unchanged. No upstream changes proposed.

### 3.3 stakeholders deliberately NOT in scope

- **Telegram / CLI / Web medium renderers** · `medium-extensions.ts` DESIGNS for them but cycle-007 delivers Discord-extended descriptor only.
- **Purupuru caretakers + Tsuheji wuxing system** · separate guild · separate persona set · cycle-004 territory. cycle-007 is mibera/THJ-only.
- **Time-travel replay** · CLI can READ traces but not RE-EXECUTE them. V2 work.
- **Per-zone different voice models** · tempting "while I'm here" — explicitly out of scope per arch doc.
- **`.run/audit.jsonl` refactor** · owned by Loa framework, not freeside-characters substrate.

---

## 4. Functional Requirements

### FR-1 · zone canonicalization (closes Bug A · G-1)

**4.1.1** A new file `packages/persona-engine/src/domain/zone-registry.ts` shall be the canonical map of ZoneId → display name + emoji + dimension + rich-label. Schema:

```typescript
export interface ZoneDisplayRecord {
  readonly id: ZoneId;
  readonly emoji: string;
  readonly displayName: string;        // "El Dorado"  — for prose
  readonly dimension: ZoneDimension;
  readonly richLabel: string;          // "⛏️ El Dorado (NFT)" — for Discord headlines
}
export const ZONE_REGISTRY: Readonly<Record<ZoneId, ZoneDisplayRecord>>;
export function resolveZoneDisplayName(zone: ZoneId): string;  // MUST throw if zone not in registry — never returns silent string (IMP-011)
export function resolveZoneRichLabel(zone: ZoneId): string;    // same throw contract
export function detectKebabZoneIds(text: string): ZoneId[];
```

Per Flatline IMP-011 (850 GPT/Gem · Opus=0 cheval-empty), `resolveZoneDisplayName` and `resolveZoneRichLabel` MUST throw `UnknownZoneError` when passed a zone not in `ZONE_REGISTRY`. The TS-exhaustiveness check (`assertNever`-style) guards compile-time, the runtime throw guards dynamic ZoneId values (e.g., from score-MCP). Test pins both behaviors.

**4.1.2** `score/types.ts::ZONE_FLAVOR` and `live/discord-render.live.ts::ZONE_LABEL` shall be DELETED. All call sites import from `domain/zone-registry.ts`.

**4.1.3** Every voice-facing zone interpolation (`persona/loader.ts:267`, `compose/voice-brief.ts::ZONE_VOICE_CONTEXT`, any new call site) shall route through `resolveZoneDisplayName`. The LLM prompt SHALL NOT contain raw kebab ZoneId strings.

**4.1.4** `deliver/sanitize.ts::stripVoiceDisciplineDrift` (or sibling step in the sanitize chain) shall call `detectKebabZoneIds(voiceText)`. On hit, emit OTEL event `voice.kebab_zone_leak_detected` with `{ violations: ZoneId[], sample: string }`. V1 LOG-ONLY — do NOT auto-substitute (SR-1 holds · Flatline SKP-001/HIGH disposition: hold log-only + add CI guard per OP-Q5 Phase 2). V2 substitution policy decision calendarized to S6+24h evidence review (per Flatline IMP-001) — explicit cycle-close deliverable, not perpetual deferral.

**4.1.5** `detectKebabZoneIds` SHALL match kebab IDs case-insensitively at word boundaries (`\b<zone>\b`) AND skip false-positive contexts per Flatline IMP-002:
- Fenced code blocks (`` ` ``...`` ` `` or `` ``` ``)
- Discord emoji syntax (`:zone-name:` or `<:zone-name:id>` custom emoji)
- URL path segments (anything inside `https?://[^\s]*`)
- Inline code (`` `text` ``)
- Markdown link targets (`[text](url)` — inside `(url)` portion)

Test fixture coverage: each false-positive class verified with a passing case (no detection) AND a negative case (kebab in prose → detection).

### FR-2 · figure-space numeric padding + medium descriptor extension (closes Bug B · G-2)

**4.2.1** A new file `packages/persona-engine/src/deliver/medium-extensions.ts` shall extend the upstream `MediumCapability` with locally-owned rendering metrics:

```typescript
export interface ExtendedMediumMetrics {
  readonly codeBlockMonoCharWidth: number;        // Discord desktop: 38 (discord.js#3030 wrap-40 minus 2 safety)
  readonly codeBlockMobileFallbackRisk: 'high' | 'low' | 'none';
  readonly digitWidthSpaceChar: string;           // ' ' (U+2007 FIGURE SPACE) for Discord; ' ' for CLI
  readonly mobileProportionalWrap: number;        // ~40 per discord.js#3030
  readonly emojiWidthInMonospace: 1 | 2;          // 2 for Discord
}
export const DISCORD_EXTENDED: ExtendedMediumMetrics;
export function metricsForMedium(medium: MediumCapability): ExtendedMediumMetrics;
```

Per Flatline SKP-002/HIGH (760), the `digitWidthSpaceChar` value for Discord MUST be expressed as the explicit Unicode escape `' '` (not the literal glyph) so the source byte-content is unambiguous to readers and to the test suite. A test that asserts only `' '.length === 1` is insufficient because ASCII space and U+2007 are both length-1 codepoints; tests MUST use `codePointAt(0) === 0x2007`.

**4.2.2** `live/discord-render.live.ts::renderSnapshotField` shall:
- Consume `metricsForMedium(medium).digitWidthSpaceChar` for `padEnd` + `padStart` padding (Discord → U+2007 FIGURE SPACE).
- Consume `metricsForMedium(medium).codeBlockMonoCharWidth` for value-column width cap.
- NOT contain hardcoded `1024 / 6000 / 19 / 40 / 38` after S3.

**4.2.3** All medium-specific numeric knobs in `deliver/embed.ts` + `live/discord-render.live.ts` shall route through `metricsForMedium()`. Hardcoded fallback constants permitted only in the descriptor definition file itself.

**4.2.4** Tests (`deliver/medium-extensions.test.ts` + `live/discord-render.live.test.ts`) shall pin (per Flatline SKP-002/HIGH + IMP-006 hardening):
- `DISCORD_EXTENDED.digitWidthSpaceChar.codePointAt(0) === 0x2007` (codepoint identity · NOT length comparison)
- `DISCORD_EXTENDED.digitWidthSpaceChar !== ' '` (ASCII-space negative assertion)
- Byte-snapshot of `renderSnapshotField(sampleSnapshot, DISCORD_EXTENDED)` output asserting U+2007 bytes (`0xE2 0x80 0x87` UTF-8) appear at expected padding positions
- DISCORD_EXTENDED descriptor matches recorded mobile-fallback risk against the S0/T0.2 typography spike screenshot evidence

**4.2.5** CLI medium descriptor (if needed for trace CLI output) shall fall back to ASCII space (`digitWidthSpaceChar: ' '`) — terminal renderers don't need digit-width invariance.

### FR-3 · trace envelope (G-3)

**4.3.1** A new file `packages/persona-engine/src/observability/trace-envelope.ts` shall export:

```typescript
export type TraceLayer = 'substrate' | 'presentation' | 'voice' | 'medium-render' | 'orchestrator';
export interface TraceEnvelope { layer: TraceLayer; layer_op: string; emitted_at: string; }
export function wrapTraceEntry<T>(layer: TraceLayer, layer_op: string, payload: T): T & TraceEnvelope;
```

**4.3.2** Every JSONL writer in `packages/persona-engine/src/` shall wrap its payload via `wrapTraceEntry` before append. Specifically:
- `compose/agent-gateway.ts::writeLlmTraceEntry` (2 callsites) → `('voice', 'bedrock-converse'|'sdk-call', payload)`
- `live/voice-memory.live.ts::appendEntry` → `('voice', 'memory-write', entry)`
- `live/voice-memory.live.ts::forgetUser` → `('voice', 'memory-forget', { stream, key })`
- `live/score-mcp.live.ts::recordRejection` → `('substrate', 'snapshot-rejection', rejection)`
- Future trace writes added during cycle-007 (e.g. sanitize-violation log) shall also use the envelope.

**4.3.3** Envelope is **forward-only** — cycle-006 traces remain raw. Readers (`scripts/lib/trace-readers.ts`, dashboard, CLI) shall tolerate absent `layer` / `layer_op` / `emitted_at` fields and render `layer: 'unknown'` for legacy rows. NO migration script on existing `.run/*.jsonl` files (per operator-attested decision Phase 1 · 2026-05-16).

Per Flatline SKP-001/CRITICAL (870) + IMP-012 (820 GPT/Gem): envelope-coverage validation in acceptance commands SHALL operate on an explicit file allowlist of freeside-characters-OWNED trace files:
- `apps/bot/.run/llm-trace.jsonl`
- `apps/bot/.run/voice-memory/**/*.jsonl`
- `apps/bot/.run/score-snapshot-rejections.jsonl`

The acceptance command SHALL exclude `.run/audit.jsonl` (Loa-framework-owned) AND SHALL filter by `emitted_at >= <cutoff-timestamp>` to skip pre-cycle-007 rows that lack the envelope (per OP-Q2 forward-only). The reader-tolerance contract is verified at S2 acceptance with a checked-in fixture containing both pre-envelope (cycle-006) and post-envelope (cycle-007) rows — the reader must return `layer: 'unknown'` for the former without error.

**4.3.4** Envelope schema is FROZEN at v1 for cycle-007. Additional fields (e.g. `trace_id`, `parent_span_id`) deferred to cycle-008+. No versioning sentinel in v1 (implicit).

### FR-4 · trace CLI (G-4)

**4.4.1** A new file `scripts/lib/trace-readers.ts` shall extract reader functions from `scripts/dashboard.ts` for shared consumption by dashboard + CLI.

**4.4.2** A new file `scripts/trace.ts` shall implement 5 subcommands:

```bash
bun run trace:latest [--zone X] [--layer L]      # most-recent N entries (default 10)
bun run trace:get --run-id Y                     # by run_id / trace UUID
bun run trace:layer --layer L [--zone X]         # filter by layer (substrate|voice|presentation|medium-render|orchestrator)
bun run trace:voice --zone X [--format human|json] # voice-specific reader (prompt + response + tokens)
bun run trace:explain [--file <path>]            # parse a trace row, identify layer + likely file:line
```

Per Flatline SKP-002/HIGH (780), `trace:explain` SHALL read the trace row from STDIN by default — NEVER from a positional argument (shell-quoting breaks on backticks, embedded quotes, spaces, etc.). Canonical invocations:
```bash
pbpaste | bun run trace:explain                       # macOS clipboard paste
bun run trace:explain --file ./row.json               # file source
echo '<json>' | bun run trace:explain                 # piped echo
bun run trace:explain < .run/llm-trace-row.json       # redirect
```

The positional-arg form is REJECTED with a clear usage error ("trace:explain reads from stdin or --file; positional arg unsupported due to shell-escaping risk").

**4.4.3** Each subcommand SHALL output JSON by default conforming to a stable schema (per Flatline IMP-003 · 870 avg). Schema file at `.claude/data/trace-explain-output.schema.json` is the contract; downstream Loa behavior (and the cycle-007 E2E acceptance test FR-7.1) depend on schema stability. Schema versioning: v1 frozen for cycle-007; future schema changes require explicit `schema_version` bump.

`--format human` outputs markdown with inline glyphs (`▣ substrate · ◈ voice · ◆ presentation · ▶ medium-render`) and NO ANSI color unless TTY-detected AND `NO_COLOR` env unset.

**4.4.4** `package.json` shall register `trace:*` script aliases at the repo root.

**4.4.5** A docs file `docs/trace-cli.md` shall document the operator-facing UX with copy-paste examples — specifically the "paste-buggy-row-to-Loa" workflow.

**4.4.6** Tests (`scripts/trace.test.ts`) shall verify each subcommand's JSON output schema + human-format markdown snapshot.

### FR-5 · dashboard UI extension + SSE-behind-flag (G-5)

**4.5.1** `scripts/dashboard.ts` shall consume `scripts/lib/trace-readers.ts` (shared with CLI). No duplicate reader logic.

**4.5.2** Each trace row in the dashboard shall render a 3px left border colored by LAYER per the Alexander-spec palette:
- substrate → `oklch(64% 0.10 230)` (cool blue)
- voice → `oklch(72% 0.14 80)` (warm gold)
- presentation → `oklch(70% 0.10 160)` (sage green)
- medium-render → `oklch(68% 0.10 320)` (lavender)

**4.5.3** Detail panel shall split horizontally (or stack vertically, viewport-adaptive) by layer when a row is selected. Each layer-panel inherits its layer color on the top-border (1px subtle). Cross-layer connector lines render in the OTHER layer's color when an event has cross-layer attributes.

**4.5.4** SSE transport SHALL be added behind `LOA_DASH_SSE=1` env flag. Default behavior remains 2-second polling. When SSE is enabled:
- Server endpoint at `/sse` streams `data: <jsonl-row>\n\n` events on each new trace write.
- Client uses `EventSource` to subscribe; new rows animate into the table with a layer-color-flash (200ms ease-out on border-left brightness boost).
- Disabled by default to preserve Barth scope-discipline (SSE adds ~100-150 LoC + 1 sprint task at S5/T5.5).

Per Flatline IMP-005 (730), S5/T5.5 acceptance tests MUST verify all three flag states (per IMP-005 hardening):
- **Default path** (`LOA_DASH_SSE` unset): dashboard uses 2s poll · no `/sse` endpoint requests · no EventSource attempts (regression guard against silent SSE-on default)
- **Enabled path** (`LOA_DASH_SSE=1`): EventSource attaches to `/sse` · new rows trigger layer-color flash · poll cadence suppressed
- **Rollback path** (`LOA_DASH_SSE=1` then unset + restart): dashboard reverts cleanly to poll · no EventSource leftover state · no stale `/sse` connection

**4.5.5** Visual regression test fixtures shall live at `scripts/dashboard-fixtures/*.png`. Operator-attested at S5 close. Replaces the need for headless-browser visual diffing this cycle (V2 work).

**4.5.6** Dashboard port remains `3001`. Process model unchanged (daemon).

### FR-6 · orchestrator port cleanup (G-6 · cycle-006 leak closure)

**4.6.1** All 7 orchestrator files currently importing `toDigestPayload`, `toMicroPayload`, `toLoreDropPayload`, `toQuestionPayload`, `toWeaverPayload`, `toCalloutPayload`, `toChatReplyPayload` directly from `live/discord-webhook.live.ts` shall route through `PresentationPort` instead. Orchestrators import from `ports/` ONLY.

**4.6.2** `composer-router.test.ts` shall be extended to assert no `to*Payload` import survives in `orchestrator/*.ts` (regex test against the orchestrator file set).

**4.6.3** `bash scripts/audit-substrate-presentation-seam.sh --strict-composer` shall exit 0 at S7 close.

### FR-7 · E2E debuggability validation (G-7)

**4.7.1** At cycle close, the operator shall:
1. Fire a digest (cron-mode or one-shot).
2. Open dashboard at `localhost:3001`.
3. Verify layer-color-encoded rows render correctly.
4. Click a row → verify layer-split detail panel populates.
5. Copy a row to Loa via chat.
6. Loa correctly identifies layer-of-origin in one inference step (no grep, no clarifying question).

**4.7.2** Recorded as evidence in `grimoires/loa/cycles/cycle-007-agent-debuggability/COMPLETED.md` at S8.

---

## 5. Non-Functional Requirements / Invariants (Ostrom)

| ID | invariant | enforcement |
|---|---|---|
| INV-1 | Substrate (`domain/` + `ports/`) MUST NOT depend on presentation details | cycle-006 BB F-001 closure remains pinned · audit script |
| INV-2 | Presentation MAY know medium-specific quirks but routes through descriptor capabilities, NOT hardcoded conditionals | `metricsForMedium()` is the boundary · grep for hardcoded constants |
| INV-3 | Voice (LLM call) MUST NEVER see substrate-shape identifiers in prompt | `resolveZoneDisplayName` at all interpolation sites · sanitizer detects + logs |
| INV-4 | Trace events MUST carry explicit `layer` + `layer_op` markers | `wrapTraceEntry` is the only allowed JSONL append path post-S2 |
| INV-5 | Dashboard data MUST be agent-CLI-readable | `scripts/trace.ts` is first-class · readers shared in `trace-readers.ts` |
| INV-6 | Backwards compat: all existing JSONL schemas + OTEL spans + cycle-006 paths preserved | envelope is additive · readers tolerate absent fields |
| INV-7 | `@0xhoneyjar/medium-registry` upstream API stays stable at `^0.2.0` | local extension at `deliver/medium-extensions.ts` · upstream proposal AT cycle close only |
| INV-8 | All trace events typed by LAYER (5-value enum, freezable) | `TraceLayer` is a string-literal union · no runtime mutation |
| INV-9 | `renderSnapshotField` padding character is `' '` (U+2007), NOT ASCII `' '` | medium descriptor + test pinning `' '.length === 1` |
| INV-10 | Dashboard color palette uses oklch · NOT hex · NOT rgb · NOT named-colors | code review + lint |
| INV-11 | CLI human-format output uses inline glyphs · NO ANSI color unless TTY-detected | code review · `--format human` test |
| INV-12 | Voice-prompt-producing files SHALL NOT contain raw kebab ZoneId string literals outside `domain/zone-registry.ts` (Flatline IMP-004 · closes Bug A at SOURCE) | `scripts/lint-no-kebab-zoneid-in-voice-prompt.sh` runs in CI · grep for `"el-dorado"|"bear-cave"|<any-kebab-zoneId>` in `compose/**`, `persona/**`, `live/claude-sdk.live.ts` returns 0 hits (except inside import statements from zone-registry) · added to GitHub Actions workflow at S1 |
| INV-13 | `trace:explain` JSON output schema is FROZEN at v1 for cycle-007 · changes require explicit `schema_version` bump (Flatline IMP-003) | schema file at `.claude/data/trace-explain-output.schema.json` · downstream consumers (Loa chat, E2E test) lock against this · BB HIGH-5 ajv validation test at S4 acceptance |
| INV-14 | `appendTraceEntry<T extends TraceEnvelope>` is the SOLE permitted JSONL append helper in `packages/persona-engine/src/` · direct `Bun.write` / `fs.appendFile` calls on `.jsonl` paths in this package are forbidden (BB HIGH-4 type-enforcement extension of INV-4) | audit script `scripts/audit-jsonl-append-discipline.sh` exits 0 at S2 close · type system blocks non-wrapped values at compile time |

---

## 6. Design Decisions (D1-D6 frozen + 4 operator-attested Phase 1)

### Pre-PRD (from arch doc · `arch-cycle-007-agent-debuggability.md`)

| ID | decision | option chosen | reversibility |
|---|---|---|---|
| D1 | Canonical zone-display-name resolver | **(c) New `domain/zone-registry.ts`** — both existing registries delete · everyone imports from new file | cheap · pure rename + import update · ~30 files |
| D2 | Trace envelope with explicit layer markers | **(b) Additive envelope** via `wrapTraceEntry(layer, op, payload)` helper · zero schema break | medium · taxonomy is just text · re-tag rewriters |
| D3 | Medium awareness extends the descriptor | **(b) Local extension** at `deliver/medium-extensions.ts` · upstream propose at cycle close | high · local extension can shed if upstream lands |
| D4 | CLI surface for agent debug access | **(c) Both** — `scripts/trace.ts` wraps same readers as dashboard via `scripts/lib/trace-readers.ts` | trivial · scripts are pure FS reads |
| D5 | Force-format numeric values via figure space | **(b) Keep right-align math · swap ASCII space for U+2007 figure space** · cap width at 38 per discord.js#3030 | trivial · constant change |
| D6 | The two bugs are FR-1 + FR-2 of cycle-007 | **Accepted** — each FR independently scoped · cycle-level value clusters both around dashboard-as-force-function frame | NA — frame decision |

### Phase 1 operator-attested (this PRD · 2026-05-16)

| ID | open question | operator decision | rationale |
|---|---|---|---|
| OP-Q1 | Branch strategy | **Cut `feat/cycle-007-agent-debuggability` from origin/main NOW** (before PRD commits) | Ostrom: boundary-as-governance · claim scope early |
| OP-Q2 | Trace envelope retroactive? | **Forward-only** | Honors INV-6 (backwards compat) · cycle-006 traces stay raw |
| OP-Q3 | CLI subcommand set | **5 as proposed**: `trace:latest`, `trace:layer`, `trace:get`, `trace:voice`, `trace:explain` | Intent-clarity over surface-economy · matches arch D4 |
| OP-Q4 | Dashboard real-time updates | **SSE behind `LOA_DASH_SSE=1` flag** (default 2s poll) — operator deferred to Loa | Alexander craft preserved (color-flash for those who opt in) · Barth ships safe default · Ostrom governance via env gate |

### Self-resolved by build doc (no operator decision needed)

| ID | open question | resolution | source |
|---|---|---|---|
| SR-1 | `detectKebabZoneIds` auto-substitute or log-only? | **Log-only in V1** · V2 policy after 24h evidence (calendarized to S6+24h per IMP-001) | build doc S6 · reaffirmed by Flatline SKP-001/HIGH Phase 2 (operator: hold log-only + add CI guard) |
| SR-2 | Upstream timing for freeside-mediums proposal | **At cycle close** with evidence package | arch doc INV-7 |

### Phase 2 Flatline-integrated (2026-05-17 · 3-model consensus · Opus + GPT-5.5 + Gemini-3.1-pro · 83% agreement)

6 HIGH_CONSENSUS auto-integrated · 2 DISPUTED integrated per cycle-006 pattern (Opus=0 cheval-headless empty per `feedback_multimodel_via_clis`) · 5 unique BLOCKERs (1 CRITICAL · 4 HIGH) accepted with sprint/PRD amendments:

| ID | severity | amendment landed | location |
|---|---|---|---|
| IMP-001 | HIGH (820) | V2-1 substitution policy calendarized to S6+24h evidence review (not perpetual deferral) | §4.1.4 · §V2-1 |
| IMP-002 | HIGH (845) | `detectKebabZoneIds` false-positive allowlist (Discord emoji syntax · code blocks · URLs · markdown links) | §4.1.5 |
| IMP-003 | HIGH (870) | `trace:explain` JSON output schema FROZEN at v1 · file at `.claude/data/trace-explain-output.schema.json` · INV-13 | §4.4.3 · INV-13 |
| IMP-004 | HIGH (800) | INV-12: CI lint guard against kebab ZoneId literals in voice-prompt-producing files · S1 acceptance gate | INV-12 · §11 Sprint-1 |
| IMP-005 | HIGH (730) | S5/T5.5 acceptance: default-path + enabled-path + rollback-path tests | §4.5.4 |
| IMP-006 | HIGH (820) | Byte-level + ASCII-space-negative + U+2007-codepoint assertion in render-test | §4.2.4 |
| IMP-011 | DISPUTED→ACCEPT (850 GPT/Gem) | `resolveZoneDisplayName` MUST throw `UnknownZoneError` on missing zone · TS-exhaustiveness AND runtime throw | §4.1.1 |
| IMP-012 | DISPUTED→ACCEPT (820 GPT/Gem) | S2 reader-tolerance fixture: checked-in pre-envelope + post-envelope rows · reader returns `layer: 'unknown'` for former | §4.3.3 |
| **SKP-001/CRITICAL** | 870 | S2/S8 acceptance narrowed to explicit freeside-characters-owned file allowlist (excludes `.run/audit.jsonl` · filters by `emitted_at >= cutoff`) | §2.2 metrics · §4.3.3 · §11 Sprint-2 |
| **SKP-002/HIGH** | 780 | `trace:explain` reads from STDIN (or `--file <path>`) — positional arg rejected with usage error · pbpaste idiom canonical | §4.4.2 |
| **SKP-002/HIGH** | 760 | `digitWidthSpaceChar` expressed as `' '` escape · test uses `codePointAt(0) === 0x2007` + ASCII-negative + byte-snapshot | §4.2.1 · §4.2.4 |
| **SKP-001/HIGH ×2** | 750 | OP-Q5 Phase 2 decision: HOLD log-only at SINK + add CI guard (INV-12) at SOURCE · G-1 language amended to acknowledge ≤24h user-visibility window | §2.1 G-1 · INV-12 |
| **SKP-003/HIGH** | 710 | OP-Q6 Phase 2 decision: ADD S0/T0.2 Discord Android typography spike (U+2007 / U+2008 / U+00A0 / code-block fixture) BEFORE S3 commits | §2.3 timeline · §10 sprint table |

Full Flatline JSON archived at `.run/flatline-prd-cycle-007.log`.

### Phase 3.5 Bridgebuilder design review integrated (2026-05-17 · 22 findings · 0 CRITICAL · 5 HIGH · 5 MEDIUM · 3 REFRAME · 3 SPECULATION · 4 PRAISE · 2 VISION · score 35)

Operator-attested 3 REFRAMEs (all accept-minor) + Loa-applied 5 HIGH + 5 MEDIUM (all accept) + 3 SPECULATION deferred-as-vision + 2 VISION auto-captured:

| ID | sev | amendment | location |
|---|---|---|---|
| BB-REFRAME-1 | accept-minor | dashboard reframed as WITNESS; INV-12 + envelope + CLI named as FORCE FUNCTIONS; S5 = craft-polish not spine | PRD §1.2 + SDD §1 |
| BB-REFRAME-2 | accept-minor | richLabel stays in domain/ for cycle-007 + cycle-008 follow-up to extract to presentation/zone-display.ts | SDD §2.1 |
| BB-REFRAME-3 | accept-minor | Bug A (Class A: substrate-leakage) + Bug B (Class B: medium-divergence) + shared DX substrate distinguished | PRD §1.1 |
| BB-HIGH-1 | accept | trace:explain --file: realpath canonicalize + repo-root containment + .run/**/*.jsonl or .json allowlist | SDD §2.5 |
| BB-HIGH-2 | accept | detectKebabZoneIds NFKC + Unicode dash substitution (U+2010-U+2015 + U+2212 → ASCII hyphen) | SDD §2.1 |
| BB-HIGH-3 | accept | INV-12 lint manifest-based (`.claude/data/voice-prompt-paths.json`) | SDD §2.7 |
| BB-HIGH-4 | accept | INV-14: type-enforced JSONL append (`appendTraceEntry<T extends TraceEnvelope>`) | SDD §2.2 + INV-14 |
| BB-HIGH-5 | accept | ajv schema-validation snapshot test in scripts/trace.test.ts | SDD §2.5 |
| BB-MEDIUM-1 | accept | reader-scan operational note in docs/trace-cli.md · V2 indexed manifest | SDD §2.4 |
| BB-MEDIUM-2 | accept | SSE max-clients=5 (configurable) + 60s heartbeat | SDD §2.6 T5.5 |
| BB-MEDIUM-3 | accept | SSE payload truncation: prompt/response → 500ch | SDD §2.6 T5.5 |
| BB-MEDIUM-4 | accept | T0.2 spike structured decision-capture block in sprint-0-COMPLETED.md | SDD §2.8 |
| BB-MEDIUM-5 | accept | metricsForMedium throws UnsupportedMediumError on unregistered | SDD §2.3 |
| BB-PRAISE-1..4 | celebrate | SOURCE+SINK split · assertNeverZone · no-deps · operator-attested fixtures | BB review prose |
| BB-SPEC-1..3 | defer-vision | Trace envelope → Loa primitive · OTEL bridge · color-encodes-layer doctrine | grimoires/loa/visions/vision-001/002/003 |
| BB-VISION-1,2 | auto-capture | "Dashboards are witnesses" · "Two-bug pair as catalyst" | grimoires/loa/visions/vision-004/005 |

New INVs added: INV-14 (type-enforced JSONL append). Total INVs: 14 (was 13 post-Flatline; +1 from BB HIGH-4).

Full BB review prose at `.run/bridge-reviews/design-review-cycle-007.md` · parsed findings at `.run/bridge-reviews/design-review-cycle-007.json`.

### Deferred to V2 (post-cycle-007)

| ID | item | reason |
|---|---|---|
| V2-1 | Auto-substitution policy for `detectKebabZoneIds` | Requires 24h evidence from V1 log-only |
| V2-2 | Upstream propose to freeside-mediums (v0.3.0) | Cross-org coordination · packaged after cycle-007 close |
| V2-3 | Per-operator dashboard config (which layers default-on) | Premature without usage data |
| V2-4 | `trace:diff --against <prior-run>` (regression hunting) | Out of cycle-007 scope · CLI surface frozen at 5 |
| V2-5 | Auto-tag agent-paste with layer + fuzzy file:line | Stretch goal · `trace:explain` ships the manual version |
| V2-6 | Replay-from-trace functionality | V2 territory — explicitly cut in arch doc |
| V2-7 | `trace:summary` (daily/weekly layer-health one-liner) | Per arch "Operator Latitude 20% exploration" callout · may slip in as the unreported-% if budget permits but NOT in cycle scope |

---

## 7. Out of Scope (Barth)

Explicitly NOT in cycle-007:

- ❌ Renderer for Telegram, CLI, or Web mediums (medium-extensions DESIGNS for them; cycle-007 ships Discord-extended only)
- ❌ Time-travel replay (CLI READS traces; cannot RE-EXECUTE)
- ❌ Per-zone different voice models
- ❌ Dashboard port change (3001 stays · daemon model unchanged)
- ❌ `.run/audit.jsonl` refactor (Loa framework owns it)
- ❌ Trace envelope schema versioning beyond v1 implicit
- ❌ Upstream PR to freeside-mediums during this cycle — propose AT cycle close only
- ❌ `detectKebabZoneIds` auto-substitution (V1 log-only; V2 after evidence)
- ❌ Migration of existing pre-cycle-007 `.run/*.jsonl` to envelope schema (forward-only · OP-Q2)
- ❌ Headless-browser visual-regression diffing (V2 · S5 uses checked-in PNG fixtures with operator attestation)
- ❌ Heavy framework introduction in dashboard (vanilla JS + Bun.serve stays · SSE adds EventSource client-side only)
- ❌ `trace:diff`, `trace:summary`, `bun link` global install — frozen out of cycle scope

---

## 8. Risks & Mitigation

| risk | probability | impact | mitigation |
|---|---|---|---|
| `ZONE_FLAVOR` consolidation has hidden callers outside persona-engine | medium | medium | **S0 calibration spike** — `git grep -rE "ZONE_FLAVOR\|ZONE_LABEL" packages apps scripts` before D1 commits · scope expands if callers found |
| U+2007 figure space rendering varies in non-Discord clients | low | low | Constrained to `discord-render.live.ts` · descriptor-gated · CLI medium uses ASCII fallback |
| Trace envelope schema grows fields each cycle, becomes unstable | medium | medium | Envelope FROZEN at v1 spec (FR-4 only adds `layer + layer_op + emitted_at`) · future additions deferred to cycle-008+ |
| CLI surface explodes in scope (operator wants 10+ subcommands) | high | low | Cycle scope FROZEN to 5 subcommands · explicit cut · V2 backlog · `trace:summary` permitted only as unreported-% if budget allows |
| Dashboard UI rewrite blows budget | medium | medium | UI changes scope-fenced to: layer-color encoding + detail-panel layer split + SSE-behind-flag · NO new framework · vanilla JS + Bun.serve · SSE strictly opt-in |
| `detectKebabZoneIds` triggers false positives on legitimate kebab refs (file paths in error messages) | medium | low | Detector is LOG-ONLY in V1 · no auto-substitution · operator reviews log before V2 policy |
| BB design review surfaces unforeseen architectural concerns | medium | medium | Run `/simstim` with `bridgebuilder_design_review.enabled: true` BEFORE S1 commits (Phase 3.5 · same as cycle-006) |
| SSE adds non-trivial test surface (EventSource mocking, server lifecycle) | low | low | SSE is opt-in via env flag · default path (polling) tested by existing infrastructure · SSE test surface limited to T5.5 |
| Mobile-screenshot operator-attestation logistics (S3 acceptance) | low | medium | Operator pre-confirms availability for screenshot capture at S3 close · fallback: defer mobile-attestation to S8 cycle-close |
| Dual-clone divergence between Documents/GitHub + bonfire | low | low | This PRD authored in Documents/GitHub · operator syncs to bonfire via existing topology (APFS clones / hardlinks per memory) |
| Bug A user-visibility window (≤24h kebab leaks) in V1 | medium | low | Flatline SKP-001/HIGH addressed: V1 closes SOURCE (CI lint INV-12 prevents NEW interpolation sites) + DETECTS at SINK (sanitizer log) · user-visible substitution deferred to V2 with calendarized S6+24h review (IMP-001) · operator accepts trade-off Phase 2 OP-Q5 |
| U+2007 figure-space assumption fails on Android | medium | high | Flatline SKP-003 addressed: S0/T0.2 typography spike validates choice empirically against Discord Android render BEFORE S3 commits · fallback paths (U+2008 / U+00A0 / code-block alternatives) staged for spike comparison |
| Flatline `trace:explain` schema drift breaks downstream Loa | low | medium | Flatline IMP-003 addressed: INV-13 freezes v1 schema · file at `.claude/data/trace-explain-output.schema.json` is the contract · `schema_version` bump required for changes |
| Future code adds kebab ZoneId literal to voice-prompt path (regression) | medium | medium | Flatline IMP-004 addressed: INV-12 CI lint guard fails build on regression · runs on every PR · S1 acceptance gate |

---

## 9. Dependencies

| dependency | version / state | purpose |
|---|---|---|
| cycle-006 (substrate-presentation refactor) | MERGED 2026-05-16 · `3324a8d` on main · ledger `candidate` | predecessor · provides `ports/live/mock` layering · trace dashboard substrate at `localhost:3001` |
| `@0xhoneyjar/medium-registry` | `^0.2.0` (unchanged · INV-7) | upstream MediumCapability · consumed in `deliver/embed.ts:17-22` · cycle-007 extends via local shim |
| `discord.js` | unchanged | Discord write side · Pattern B webhook shell |
| `@anthropic-ai/claude-agent-sdk` | unchanged | digest voice path (Bedrock converse) |
| `@aws-sdk/client-bedrock-runtime` | unchanged · cycle-006 wired | Bedrock primary voice transport |
| `@raindrop-ai/bedrock` | unchanged · cycle-006 wrap | OTEL span around Bedrock call |
| Bun | `≥1.1` (unchanged) | runtime |
| TypeScript | strict mode (unchanged) | type-level enforcement |
| `node-cron` | unchanged | digest cron cadences |
| Zod | unchanged | validation |
| loa-hounfour TypeBox schemas | consume-only | upstream framework |
| loa-straylight memory governance | consume-only | upstream framework |

NO new npm dependencies. Local extension pattern (D3 recommendation b) avoids upstream churn during this cycle.

---

## 10. Sprint Outline

Detailed sprint plan lands in `grimoires/loa/sprint.md` after `/architect` + `/sprint-plan`. Outline here for PRD review:

| sprint | scope | tasks | LoC | risk | red_team_acs |
|---|---|---|---|---|---|
| S0 | Calibration spikes — T0.1 zone-registry call-site audit · T0.2 Discord Android typography fixture (SKP-003) | 2 | spike-scripts (auto-delete on close) | LOW · 1 day | — |
| S1 | D1 zone-registry canonicalization | 4 | ~+180 / ~-30 | MEDIUM (renames in ~30 files) | — |
| S2 | D2 trace envelope retrofit | 4 | ~+110 | LOW | — |
| S3 | D3 medium extensions + D5 figure-space padding | 3 | ~+140 / ~-40 | MEDIUM (production render path) | — |
| S4 | D4 trace CLI (5 subcommands) | 5 | ~+490 | MEDIUM | — |
| S5 | Dashboard UI extension + SSE-behind-flag | 5 (was 4 + T5.5 SSE) | ~+350 | MEDIUM (UX-load-bearing) | — |
| S6 | FR-1 sanitizer hook (detectKebabZoneIds) | 2 | ~+60 | LOW (log-only V1) | — |
| S7 | Orchestrator port cleanup (cycle-006 leak closure) | 2 | ~+50 / ~-40 | LOW (mechanical) | — |
| S8 | Cycle close — E2E + BB round 3 + canary + ledger flip | 5 | ~+50 | LOW | — |

**Total**: 32 tasks · ~+1480 / ~-110 → ~+1370 net LoC (above arch's +1300 estimate by ~70 LoC: +100 for SSE-flag at S5/T5.5 · +20 for INV-12 CI lint at S1 · -50 for spike scripts auto-delete · spikes net 0)

---

## 11. Cycle-Level Acceptance Criteria

Cycle-007 closes at S8 when ALL of the following pass:

### Sprint-0 (calibration)
```bash
# T0.1 zone-registry call-site audit
bash scripts/spike-zone-registry-callers.ts && cat sprint-0-COMPLETED.md   # surfaces complete · operator-confirmed
# T0.2 Discord Android typography fixture (SKP-003)
bun run scripts/spike-discord-android-typography.ts   # generates rendered fixture across U+2007 / U+2008 / U+00A0 / code-block alts
# Operator visually picks the working padding char from captured Android screenshots BEFORE S3 begins
```

### Sprint-1 (zone registry + INV-12)
```bash
git grep -E "ZONE_FLAVOR|ZONE_LABEL" packages apps | grep -v zone-registry.ts | grep -v test.ts | wc -l   # → 0
bun test packages/persona-engine/src/domain/zone-registry.test.ts   # green (includes UnknownZoneError throw test per IMP-011)
bash scripts/lint-no-kebab-zoneid-in-voice-prompt.sh   # exits 0 (INV-12 · IMP-004 · Bug A SOURCE-side closure)
```

### Sprint-2 (trace envelope)
```bash
bun run --cwd apps/bot digest:once   # one fire (records post-S2 emitted_at cutoff)
# Narrowed allowlist per SKP-001/CRITICAL — explicit files only, exclude Loa-owned audit.jsonl, filter by cutoff
for f in apps/bot/.run/llm-trace.jsonl apps/bot/.run/voice-memory/**/*.jsonl apps/bot/.run/score-snapshot-rejections.jsonl; do
  jq --arg cutoff "$S2_CUTOFF_TIMESTAMP" -e 'select(.emitted_at >= $cutoff) | .layer' "$f" | wc -l
done
# Reader-tolerance: checked-in pre-envelope fixture returns layer: 'unknown' without error (IMP-012)
bun test packages/persona-engine/src/observability/trace-envelope-reader.test.ts   # green
```

### Sprint-3 (medium extensions + figure space)
```bash
bun test packages/persona-engine/src/deliver/medium-extensions.test.ts   # green (codePointAt(0) === 0x2007 · ASCII-negative · byte-snapshot per SKP-002/IMP-006)
# Operator screenshot of Discord MOBILE post · column alignment visually confirmed (validates S0/T0.2 spike conclusion)
```

### Sprint-4 (trace CLI)
```bash
bun run trace:latest --zone bear-cave    # returns latest row JSON
bun run trace:explain '<paste a real row>'   # returns layer + likely file:line identification
```

### Sprint-5 (dashboard UI + SSE-flag)
```bash
# Open http://localhost:3001 · click row · see layer-split detail · color-coded border
# Operator visual-verifies 4-color encoding teachable in <3 min
# SSE: LOA_DASH_SSE=1 bun run dashboard → EventSource attaches · new rows flash layer color
```

### Sprint-6 (sanitizer hook)
```bash
# SINK-side detection — operator injects test fixture kebab into voice output to verify detection fires
grep '"voice.kebab_zone_leak_detected"' apps/bot/.run/llm-trace.jsonl   # entries exist for injected fixture
# V2-1 substitution policy review trigger calendarized: S6 close + 24h cron-fired digests → operator reviews log → decide V2 substitution allowlist (per IMP-001)
# SOURCE-side already enforced by INV-12 CI lint at S1 — Bug A leak surface closed at compile time
```

### Sprint-7 (orchestrator cleanup)
```bash
bash scripts/audit-substrate-presentation-seam.sh   # exits 0
LOA_SEAM_AUDIT_STRICT_COMPOSER=1 bash scripts/audit-substrate-presentation-seam.sh   # exits 0
```

### Sprint-8 (cycle close)
```bash
grep "ARCHIVED" grimoires/loa/cycles/cycle-007-agent-debuggability/COMPLETED.md
jq -r '.cycles[] | select(.id == "cycle-007-agent-debuggability") | .status' grimoires/loa/ledger.json   # "archived"
# E2E: operator pastes trace row → Loa identifies layer-of-origin in 1 inference step · recorded as evidence
# BB round 3: APPROVED or PRAISE-only
```

### Definition of Done

- All FRs implemented and tested.
- All INVs respected (verified by audit scripts + code review).
- 31 tasks closed in beads with `br` lifecycle.
- BB round 3 review = APPROVED.
- Operator-attested mobile screenshot confirms FR-2 (Bug B).
- Operator-attested E2E (FR-7) confirms layer-paste workflow.
- Ledger entry flips `active → candidate` at S8 sprint-close · `candidate → archived` after operator sign-off.
- COMPLETED.md authored with cycle summary, lessons distilled, evidence-based decisions, operator-paced follow-ups documented.

---

## 12. References

| topic | path |
|---|---|
| Arch decisions D1-D6 | `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` |
| Build doc (sprint sequence + design rules) | `grimoires/loa/specs/enhance-cycle-007-agent-debuggability.md` |
| Kickoff session track | `grimoires/loa/context/track-2026-05-16-cycle-007-agent-debuggability-kickoff.md` |
| Kickoff handoff packet | `.run/compose/20260516-8b993e/envelopes/final.kickoff.handoff.json` |
| Predecessor cycle-006 (COMPLETED) | `grimoires/loa/cycles/cycle-006-substrate-presentation/COMPLETED.md` |
| Cycle-006 PRD (template precedent) | `grimoires/loa/cycles/cycle-006-substrate-presentation/prd.md` |
| Decision logs · operator-attested | `grimoires/loa/NOTES.md` |
| FR-2 root cause site | `packages/persona-engine/src/live/discord-render.live.ts:42-63` |
| FR-1 root cause site | `packages/persona-engine/src/score/types.ts::ZONE_FLAVOR` + `live/discord-render.live.ts::ZONE_LABEL` |
| Trace schema (today) | `packages/persona-engine/src/observability/llm-trace.ts::LlmTraceEntry` |
| Dashboard surface | `scripts/dashboard.ts` |
| Medium descriptor upstream | `@0xhoneyjar/medium-registry@0.2.0` (consumed in `deliver/embed.ts:17-22`) |
| freeside-mediums upstream | https://github.com/0xHoneyJar/freeside-mediums |
| Discord-as-Material rules (non-negotiable) | `CLAUDE.md` § Discord-as-Material |
| Loa framework rules | `.claude/loa/CLAUDE.loa.md` |
| OperatorOS v3.2 (this session) | `/Users/zksoju/.claude/CLAUDE.md` |
| Vault doctrine: chat-medium-presentation-boundary | `~/vault/wiki/concepts/chat-medium-presentation-boundary.md` (operator-activated 2026-05-16) |
| discord.js#3030 (mobile wrap) | https://github.com/discordjs/discord.js/issues/3030 |
| Discord Android sans-serif regression (community report) | Discord support 4407328946839 |

---

**Status**: candidate · POST `/simstim` Phase 2 Flatline review (3-model · 14 findings · 13 amendments integrated · operator-attested 2026-05-17) · awaits Phase 3 SDD authoring → Phase 3.5 BB design review → Phase 4 Flatline SDD → Phase 4.5 Red Team SDD → Phase 5 sprint plan → Phase 6 Flatline sprint → Phase 7 `/run sprint-plan`.
**Next phase**: SDD authoring at `grimoires/loa/sdd.md` (Phase 3 · ARCH/Ostrom + craft/Alexander).
