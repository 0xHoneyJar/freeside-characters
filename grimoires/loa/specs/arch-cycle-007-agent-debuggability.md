# ARCH · cycle-007 — Agent Debuggability Through Medium-Aware Substrate-Presentation Layering

> **Mode**: ARCH (Ostrom) + craft lens (Alexander)
> **Date**: 2026-05-16
> **Predecessor cycle**: cycle-006 (substrate-presentation refactor · merged at `3324a8d`)
> **Frame**: The dashboard becomes the force function for proper layer separation. Two production bugs from cycle-006's canary fire serve as the canary surface this cycle solves end-to-end.
> **Status**: candidate · awaits `/plan-and-analyze` to harden into PRD

---

## Pre-Plan · Structural Decisions

Six decisions land before the arch doc commits to shape. Each carries an option set, recommendation, reversibility.

### D1 · Canonical zone-display-name resolver (load-bearing)

**Decision**: Where does `el-dorado → "El Dorado"` happen, and how many places hold the map?

**Today**: TWO registries side by side.
- `score/types.ts::ZONE_FLAVOR[zone].name` → `"El Dorado"` (no dimension suffix)
- `live/discord-render.live.ts::ZONE_LABEL[zone]` → `"⛏️ El Dorado (NFT)"` (with emoji + dimension)
- `persona/loader.ts:267-268` correctly substitutes `ZONE_FLAVOR.name` for `{{ZONE_NAME}}` in prompts
- But: nothing prevents the LLM from receiving raw kebab IDs through other interpolation paths (e.g., `compose/voice-brief.ts::ZONE_VOICE_CONTEXT` is keyed by ZoneId; the values currently contain display-name prose but the boundary is unchecked)
- And: no SINGLE function `resolveZoneDisplayName(zoneId): string` to call as a sanitize step

**Options**:
- (a) Promote `ZONE_FLAVOR` to canonical. `ZONE_LABEL` becomes a derived view: `${flavor.emoji} ${flavor.name}${dimensionParen}`.
- (b) Keep both, document each one's authority strictly (ZONE_LABEL for Discord-rich display, ZONE_FLAVOR.name for prose).
- (c) Move both to a new `domain/zone-registry.ts` that owns the entire zone-display contract.

**Recommendation**: (c). New file. Both existing registries delete; everyone imports from `domain/zone-registry.ts`. Adds: `resolveZoneDisplayName(zoneId): string`, `resolveZoneRichLabel(zoneId): string`, `detectKebabZoneIds(text): ZoneId[]`. The last is the sanitizer hook for FR-1 (voice contamination detection).

**Reversibility**: cheap. Pure rename + import update. ~30 files touch this.

### D2 · Trace envelope with explicit layer markers (the cycle's spine)

**Decision**: Every JSONL trace write gets a common envelope identifying which LAYER produced it and which OPERATION within that layer.

**Today**:
- `apps/bot/.run/llm-trace.jsonl` — has zone + post_type + character_id + path('sdk'|'fetch') but no layer field
- `apps/bot/.run/voice-memory/<stream>/*.jsonl` — has stream + zone + key but no layer field
- `apps/bot/.run/score-snapshot-rejections.jsonl` — has zone + reason but no layer field
- `.run/audit.jsonl` — tool invocation auditing, no zone context
- `grimoires/loa/a2a/trajectory/*.jsonl` — skill-execution traces, no layer field

The fundamental gap (per operator quote): *"when the operator copies a trace row to me, I IMMEDIATELY know which layer to fix"*. Without explicit markers, every paste requires me to grep + reason about which file the data came from.

**Options**:
- (a) Add `layer` + `layer_op` fields to each existing schema individually.
- (b) Wrap all existing writers in a shared `traceEnvelope(layer, op, payload)` helper that injects fields uniformly.
- (c) Build a new unified `.run/trace.jsonl` that all writers also append to, deprecating per-stream files.

**Recommendation**: (b) — additive envelope, zero schema break, agents filter on `layer`. Implementation: `observability/trace-envelope.ts` exports:
```typescript
export type TraceLayer = 'substrate' | 'presentation' | 'voice' | 'medium-render' | 'orchestrator';
export interface TraceEnvelope { layer: TraceLayer; layer_op: string; emitted_at: string; }
export function wrapTraceEntry<T>(layer: TraceLayer, layer_op: string, payload: T): T & TraceEnvelope;
```
Every JSONL writer wraps via this helper before append.

**Reversibility**: medium. If the taxonomy proves wrong, the layer field is just text — re-tag and rewrite the readers.

### D3 · Medium awareness extends the descriptor (NOT freeside-mediums upstream yet)

**Decision**: The renderer reads medium-specific rendering metrics from a descriptor instead of hardcoded constants.

**Today**:
- `@0xhoneyjar/medium-registry@0.2.0` is in deps but only `hasCapability(medium, 'embed')` is consulted
- Discord-specific numbers (1024-char field cap, 6000-char embed cap, 19 max factors, etc.) hardcoded in `deliver/embed.ts` + `live/discord-render.live.ts`
- No knowledge of: mobile word-wrap (~40 chars · per discord.js#3030), monospace-mobile regression (Android sans-serif fallback), figure-space (U+2007) digit-width invariance

**Options**:
- (a) Extend `MediumCapability` in upstream freeside-mediums (v0.3.0 minor bump · A7 additive · operator coordinates with mediums repo maintainer).
- (b) Local extension shim in freeside-characters · upstream propose at cycle close (matches "We consume hounfour/straylight not upstream anything" memo pattern).
- (c) Local-only · skip upstream.

**Recommendation**: (b). Local extension at `packages/persona-engine/src/deliver/medium-extensions.ts`. New fields:
```typescript
{
  codeBlockMonoCharWidth: number;        // Discord desktop Consolas: ~63
  codeBlockMobileFallbackRisk: 'high' | 'low' | 'none';  // Discord Android: high
  digitWidthSpaceChar: string;           // ' ' (ascii) or ' ' (figure space)
  mobileProportionalWrap: number;        // ~40 chars per discord.js#3030
  emojiWidthInMonospace: 1 | 2;          // Discord embed: 2
}
```
At cycle close, surface these as an upstream proposal to freeside-mediums maintainer. Don't gate cycle on it.

**Reversibility**: high. Local extension can shed if upstream lands.

### D4 · CLI surface for agent debug access (THE force function)

**Decision**: I (and any future teammate agent) get first-class CLI access to trace data, not just the HTTP API.

**Today**:
- Dashboard at localhost:3001 exposes `/api/llm-trace`, `/api/voice-memory`, etc.
- I can `curl localhost:3001/api/llm-trace | jq` but the workflow is unergonomic
- No memorable command names · no filters · no human-readable formatting for chat-paste

**Options**:
- (a) New `scripts/trace.ts` with subcommands. Pure FS reads. JSON by default · `--format human` for me.
- (b) Dashboard HTTP API doubles as CLI source (curl pattern).
- (c) Both — `scripts/trace.ts` wraps the same readers the dashboard uses.

**Recommendation**: (c). Co-locate readers in `scripts/lib/trace-readers.ts`. Dashboard + CLI both consume. Surface:
```bash
bun run trace:latest --zone el-dorado                    # most-recent entry
bun run trace:layer --layer voice --zone el-dorado       # filter to voice events
bun run trace:get --run-id 0abc...                       # by ID
bun run trace:voice --zone el-dorado --format human      # markdown copy-paste block
bun run trace:explain --row <pasted json>                # parses paste, identifies layer
```

The last command is the killer feature: operator pastes a buggy trace; CLI tells them exactly which layer + which file:line to edit. Agents (me) parse the same JSON without the markdown wrapper.

**Reversibility**: trivial. Scripts are pure FS reads — delete if pattern fails.

### D5 · Force-format numeric values via figure space (FR-2 root cause)

**Decision**: Pad numeric values with U+2007 (FIGURE SPACE) instead of ASCII space. Cap value column at fixed width informed by the medium descriptor.

**Today** (`live/discord-render.live.ts:42-63`): `padEnd(9, ' ')` for labels, `padStart(6, ' ')` for values. ASCII space throughout. Math right-aligns at col 15.

**Why it breaks**: ASCII space is the same width as a digit ONLY in monospace contexts. Discord's Android client (per support forum post 4407328946839) has a documented regression where embed code blocks render in `gg sans` (proportional) instead of Consolas (monospace). In proportional rendering, ASCII space ≈ half a digit width — values shift left. **U+2007 is defined to equal digit-width regardless of font** (OpenType tabular figures invariant).

**Options**:
- (a) Drop right-align entirely · left-align after a colon separator.
- (b) Keep right-align math · swap ASCII space for U+2007 figure space in the padding character.
- (c) Use fixed-display-width digit formatting (leading zeros like `004`).

**Recommendation**: (b). Smallest change, preserves operator's right-align intent for cross-row numeric comparison, hardens against Discord mobile font regression. Cap line width at 38 chars per discord.js#3030 wrap-at-40 + 2-char safety.

**Reversibility**: trivial. Change a constant.

### D6 · The two bugs are FR-1 and FR-2 of cycle-007

**FR-1** (voice canonicalization · D1 + D2): The "el-dorado" mention is the SYMPTOM. The cycle-007 framework solves it AND the class of bugs it represents (LLM output unsupervised by canonical-display dictionary).

**FR-2** (numeric alignment · D3 + D5): The misalignment is the SYMPTOM. The cycle-007 framework solves it AND the class of bugs (Discord mobile/desktop rendering divergence that hardcoded numbers can't survive).

**Reversibility framing**: each FR is independently scoped. FR-1 lands without D3/D5. FR-2 lands without D1/D2. The CYCLE-LEVEL value is that both decisions cluster around the same dashboard-as-force-function frame — fixing in isolation misses the architectural payoff.

---

## Invariants (Ostrom · "what must NOT change")

1. **Substrate (domain/ + ports/) MUST NOT depend on presentation details.** A `domain/derive-shape.ts` change must NEVER require touching `live/discord-render.live.ts`. cycle-006's BB F-001 closure pinned this; cycle-007 keeps it.

2. **Presentation (live/, deliver/) MAY know medium-specific quirks but routes through descriptor capabilities, NOT hardcoded conditionals.** Today: `hasCapability(medium, 'embed')` only. Cycle-007 extends to ALL medium-specific knobs.

3. **Voice (LLM call) MUST NEVER see substrate-shape identifiers in prompt.** Always resolved display names. FR-1 enforces. Sanitization layer detects + warns on violation.

4. **Trace events MUST carry explicit layer markers.** When operator copies a trace row to chat, the agent (me) MUST be able to identify the producing layer without ambiguity.

5. **Dashboard data MUST be agent-CLI-readable.** Not just web UI. The cycle's force function depends on agents (me) being first-class consumers of the trace surface.

6. **Backwards compat: all existing JSONL schemas + OTEL spans + cycle-006 paths preserved.** Cycle-007 is additive. The trace envelope WRAPS existing payloads; doesn't replace fields.

7. **`@0xhoneyjar/medium-registry` upstream API stays stable.** Local extension lives in `packages/persona-engine/src/deliver/medium-extensions.ts`. Upstream proposal happens at cycle close, not during.

---

## Blast Radius

**NEW files** (zero risk):

| Path | Purpose | Est. LoC |
|---|---|---|
| `packages/persona-engine/src/domain/zone-registry.ts` | Canonical zone display registry · `resolveZoneDisplayName`, `detectKebabZoneIds` (D1) | ~100 |
| `packages/persona-engine/src/domain/zone-registry.test.ts` | Tests · all 4 zones · kebab detection edge cases | ~80 |
| `packages/persona-engine/src/observability/trace-envelope.ts` | Layer-marker envelope helper (D2) | ~60 |
| `packages/persona-engine/src/observability/trace-envelope.test.ts` | Tests · envelope shape · layer enum | ~50 |
| `packages/persona-engine/src/deliver/medium-extensions.ts` | Local MediumCapability extension fields (D3) | ~80 |
| `packages/persona-engine/src/deliver/medium-extensions.test.ts` | Tests · DISCORD_EXTENDED descriptor · digit-width-space invariant | ~60 |
| `scripts/lib/trace-readers.ts` | Shared trace reader functions (used by dashboard + CLI) | ~120 |
| `scripts/trace.ts` | CLI debug surface · subcommands (D4) | ~250 |
| `scripts/trace.test.ts` | Tests · each subcommand · JSON + human formatting | ~120 |
| `tests/integration/cycle-007-debug-loop.test.ts` | End-to-end test: simulated buggy trace → CLI → operator-copyable identification | ~150 |

**MODIFIED files** (audit list · changes are surgical):

| Path | Change | Risk |
|---|---|---|
| `packages/persona-engine/src/score/types.ts` | Delete `ZONE_FLAVOR` · point at `domain/zone-registry.ts` re-export · backwards-compat type alias | low |
| `packages/persona-engine/src/live/discord-render.live.ts` | (a) replace `ZONE_LABEL` constant with `resolveZoneRichLabel()` call (D1) · (b) swap ASCII space for U+2007 in `renderSnapshotField` padding (D5) · (c) read `codeBlockMonoCharWidth` from medium descriptor (D3) | medium · highest cycle-007 churn point |
| `packages/persona-engine/src/compose/voice-brief.ts` | Audit ZONE_VOICE_CONTEXT for kebab leak · use resolveZoneDisplayName at any zone interpolation | low |
| `packages/persona-engine/src/compose/agent-gateway.ts` | Wrap `writeLlmTraceEntry` call with `wrapTraceEntry('voice', 'bedrock-converse', ...)` | low · 2 callsites |
| `packages/persona-engine/src/live/voice-memory.live.ts` | Wrap appendEntry/forgetUser audit with envelope | low |
| `packages/persona-engine/src/live/score-mcp.live.ts` | Wrap recordRejection with envelope | low |
| `packages/persona-engine/src/observability/llm-trace.ts` | Extend `LlmTraceEntry` with `layer` + `layer_op` fields (additive · readers tolerate absence) | low |
| `packages/persona-engine/src/deliver/sanitize.ts` | Add `detectKebabZoneIds` sanitizer hook · log on violation (don't auto-substitute · operator-decide policy at cycle close) | medium · voice layer surface |
| `scripts/dashboard.ts` | Extract readers to `scripts/lib/trace-readers.ts` · add layer filter to UI · color-code rows by layer | medium · UX-load-bearing |
| All 7 orchestrator files | Extract `toXxxPayload` imports through PresentationPort (cycle-006 leak closure) | low · mechanical |
| `packages/persona-engine/package.json` | No new deps · all local | none |
| `grimoires/loa/NOTES.md` | Decision Log entries for D1-D6 | none |

**DELETED files**:
- None planned. cycle-007 is additive.

**DEPENDENCY changes**:
- No new npm deps. Local extension pattern (D3 recommendation b).
- `@0xhoneyjar/medium-registry` stays at `^0.2.0` (upstream propose at cycle close).

**Net LoC estimate**: ~+1500 / ~-200 → ~+1300

**Sprint scope estimate**: 7-9 sprints (MEDIUM-to-LARGE cycle · similar to cycle-006 shape).

---

## Data Architecture (trace flow diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBSTRATE LAYER                                                            │
│  ──────────────                                                             │
│    score-mcp.live.ts                                                        │
│      → fetchValidatedDigestSnapshot()                                       │
│        → wrapTraceEntry('substrate', 'score-fetch', snapshot)               │
│        → wrapTraceEntry('substrate', 'plausibility-check', result)          │
│        → recordRejection() if !ok                                           │
│          ↓                                                                  │
│    domain/derive-shape.ts                                                   │
│      → deriveShape({snapshot, crossZone})                                   │
│        → wrapTraceEntry('substrate', 'shape-derivation', derived)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VOICE LAYER (nondeterministic)                                             │
│  ──────────────                                                             │
│    voice-memory.live.ts → readRecent (prior week context)                   │
│      → wrapTraceEntry('voice', 'memory-read', prior)                        │
│    orchestrator/format-prior-week-hint.ts → wrap in <untrusted-content>     │
│      → wrapTraceEntry('voice', 'sanitize-prior-hint', wrapped)              │
│    claude-sdk.live.ts → generateDigestVoice(snapshot, ctx)                  │
│      → resolveZoneDisplayName(zone)  // D1 enforcement                      │
│      → wrapTraceEntry('voice', 'bedrock-converse', { in, out, tokens })     │
│      → llm-trace.jsonl append                                               │
│    voice-memory.live.ts → appendEntry (write back · sanitized)              │
│      → wrapTraceEntry('voice', 'memory-write', entry)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (deterministic post-voice)                              │
│  ──────────────                                                             │
│    deliver/sanitize.ts                                                      │
│      → stripVoiceDisciplineDrift                                            │
│      → escapeDiscordMarkdown                                                │
│      → detectKebabZoneIds(text)  // D1 sanitizer · FR-1 closure             │
│        → wrapTraceEntry('presentation', 'sanitize', { violations })         │
│    discord-render.live.ts                                                   │
│      → resolveZoneRichLabel(zone)  // D1                                    │
│      → renderSnapshotField  // D5: U+2007 padding · medium-cap width        │
│      → wrapTraceEntry('presentation', 'render-digest', message)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MEDIUM-RENDER LAYER (delivery)                                             │
│  ──────────────                                                             │
│    discord-webhook.live.ts → toDigestPayload (bytes for wire)               │
│      → wrapTraceEntry('medium-render', 'discord-webhook', payload)          │
│    medium descriptor consulted: codeBlockMonoCharWidth · etc (D3)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  Discord client  │
                              │  (mobile/desktop)│
                              └──────────────────┘

ALL events flow to:
  apps/bot/.run/llm-trace.jsonl  · layer-tagged
  apps/bot/.run/voice-memory/*   · layer-tagged
  apps/bot/.run/score-snapshot-rejections.jsonl  · layer-tagged

CLI surface:
  scripts/trace.ts → reads from .run/* → outputs JSON or markdown
  scripts/dashboard.ts → reads from .run/* → serves HTML at :3001
  Both share scripts/lib/trace-readers.ts
```

---

## Component Specifications (Alexander · craft lens)

The cycle's force function is the dashboard. Alexander's lens: every surface element must teach the operator something about the substrate beneath it.

### Trace row · layer-color encoding

**Material**:
- Base row · `--bg-elev` (#16181c)
- Border-left · 3px · color encodes LAYER:
  - substrate → `oklch(64% 0.10 230)` (cool blue · "data flowing in")
  - voice → `oklch(72% 0.14 80)` (warm gold · "creative output")
  - presentation → `oklch(70% 0.10 160)` (sage green · "shaping")
  - medium-render → `oklch(68% 0.10 320)` (lavender · "out to wire")
- Active row · `--bg-hover` (#1e2126) + bold left border

**Rhythm**: 12px vertical padding between rows. 16px horizontal. Information density: zone-id (heavy weight) · post-type (light) · timestamp (mono · dim) · layer-glyph (12px · accent).

**Weight**: zone-id at 13px/500 weight. layer-op at 11px/400. Timestamp at 11px/400 in mono · dim text.

**Motion**: row hover · 80ms ease-out background fade · NOT translate-y (page jitter). Selection · instant border-left activation · no animation (the click IS the affirmation).

**Color-as-information**: 4 layer colors are LOAD-BEARING. Operator memorizes them after 3 minutes of use. When they paste a row to me, I read the layer-color implicitly from the JSON · they read it visually. Same channel · different medium.

### Detail panel · layer-tab structure

Detail panel splits horizontally by layer. Each layer renders its own panel ordered by the data flow (substrate → voice → presentation → medium-render). When operator clicks a row, only the panels relevant to THAT layer's data populate; others collapse.

**Material**: each panel · `--bg` + 1px border. Headers · 11px uppercase letter-spaced.

**Rhythm**: 20px gap between panel groups. Within a panel · 8px between fields.

**Weight**: panel title (uppercase · 11px · dim) · field key (mono · 12px · dim) · field value (mono · 12px · regular). Hierarchy through color · not size.

**Motion**: panel expand/collapse · 200ms ease-out on max-height + opacity. No layout shift outside the panel.

**Color-as-information**: each panel inherits its layer's accent color on the top-border (subtle · 1px). When an event has CROSS-LAYER attributes (e.g., a substrate event that triggered a voice fallback), a thin connector line in the OTHER layer's color appears on the right edge. Operator sees "this substrate event caused something in voice" without reading the JSON.

### CLI output (`scripts/trace.ts --format human`)

**Material**: pure terminal. No color codes by default (operator may pipe to chat). Layer denoted by inline glyph: `▣ substrate · ◈ voice · ◆ presentation · ▶ medium-render`.

**Rhythm**: 2-line blocks. Line 1: glyph + layer + op + timestamp. Line 2: most-important payload field. Blank line between rows.

**Weight**: glyph at the start is 100% of the visual attention. No bold (terminal). No size variation. Density carried by spacing alone.

**Motion**: none. Terminal is static. The READ is the motion.

**Color-as-information**: When TTY detected (and `NO_COLOR` env not set), each glyph wears its layer color. Pipe to file → strips. Pipe to `pbcopy` → strips (clean markdown for me).

---

## Shipping Scope (Barth)

### V1 · Ship This Cycle (S0-S7)

**Must land**:
1. `domain/zone-registry.ts` + canonical resolvers (D1)
2. `observability/trace-envelope.ts` + retroactive wrap of llm-trace + voice-memory + score-rejections (D2)
3. `scripts/lib/trace-readers.ts` + `scripts/trace.ts` CLI (D4)
4. `deliver/medium-extensions.ts` + DISCORD_EXTENDED with codeBlockMonoCharWidth + digitWidthSpaceChar (D3)
5. `live/discord-render.live.ts` swap to U+2007 padding (D5)
6. `deliver/sanitize.ts::detectKebabZoneIds` hook (FR-1)
7. Dashboard UI extension · layer-color encoding · detail panel structure (the FORCE FUNCTION)

**Acceptance criteria for cycle close**:
- Operator-attested: paste a buggy trace row to me · I correctly identify the layer-of-origin in one inference step (no grep · no guessing)
- FR-1 verified: a digest fire produces voice output containing only canonical zone names (sanitize log shows zero `detectKebabZoneIds` violations OR violations are deliberately allowed via documented exception)
- FR-2 verified: a digest fire on Discord MOBILE renders aligned numeric column · operator screenshot confirms

### V2 · After Feedback

**Maybe later**:
- Upstream propose to freeside-mediums (extensions land in v0.3.0 upstream)
- Per-operator dashboard config (which layers to show by default)
- Diff-mode in CLI (`trace:diff --against <prior-run>` for regression hunting)
- Auto-tag agent-paste with layer + likely-file-line via fuzzy match
- Replay-from-trace functionality (the Raindrop Workshop pattern · but for OUR trace shape)

### CUT from V1 (Barth's discipline)

**Explicitly NOT in cycle-007**:
- ❌ Renderer for Telegram/CLI/Web mediums (medium-extensions designs for it but doesn't deliver other adapters)
- ❌ Time-travel replay (CLI can READ traces but not RE-EXECUTE them)
- ❌ Per-zone different voice models (a tempting "while I'm here" — out of scope)
- ❌ Migration of dashboard to a different port or process model (3001 stays · daemon model unchanged)
- ❌ Refactor of audit.jsonl (touched by Loa framework · not freeside-characters substrate)
- ❌ Schema versioning for trace envelope (v1 is implicit · v2 problem can wait)

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `ZONE_FLAVOR` consolidation has hidden callers outside persona-engine | medium | medium | S0 spike: `git grep -r ZONE_FLAVOR\|ZONE_LABEL` across all packages + apps + scripts before D1 commits |
| U+2007 figure space rendering varies in non-Discord clients | low | low | Constrained to discord-render.live.ts · descriptor-gated · CLI medium uses ASCII fallback |
| Trace envelope schema grows fields each cycle, becomes unstable | medium | medium | Envelope freeze at v1 spec · cycle-007 ONLY adds layer+layer_op+emitted_at · future additions deferred to cycle-008+ |
| CLI surface explodes in scope (operator wants 10+ subcommands) | high | low | Cycle scope frozen to 5 subcommands · explicit cut · V2 backlog |
| Dashboard UI rewrite blows budget | medium | medium | UI changes scope-fenced to: layer-color encoding + detail-panel layer split. No new framework. Keep vanilla JS + Bun.serve. |
| `detectKebabZoneIds` triggers false positives on legitimate kebab references (e.g., file paths in error messages) | medium | low | Detector is LOG-ONLY in V1 · no auto-substitution · operator reviews log before deciding policy in V2 |
| BB design review surfaces unforeseen architectural concerns | medium | medium | Run /simstim with `bridgebuilder_design_review.enabled: true` BEFORE S1 commits (same as cycle-006 · phase 3.5) |

---

## Open Questions for `/plan-and-analyze`

These don't have settled answers and should be operator-decided during PRD authoring:

1. **Should the trace envelope be RETROACTIVE on existing JSONL files?** (Rewrite vs forward-only.) Lean: forward-only · cycle-006 traces are pre-envelope · cycle-007 onwards are tagged.

2. **Should `detectKebabZoneIds` auto-substitute or only log?** Lean: log-only in V1 · auto-substitute is V2 once we trust the detector.

3. **CLI: subcommand set?** Proposed 5 · operator should validate the surface area is what they ACTUALLY want for debug sessions (`trace:latest`, `trace:layer`, `trace:get`, `trace:voice`, `trace:explain`).

4. **Dashboard real-time updates?** Currently 2s poll. Worth upgrading to SSE for the layer-color flash on new event? Or is poll fine?

5. **Should the CLI be installable as a global Bun script** (`bun link` → `freeside-trace ...`)? Or stays project-local? Affects how the operator runs it from non-project dirs.

6. **Upstream timing for freeside-mediums proposal**: at cycle close, with what evidence package? Or defer to a cross-org coordination session?

---

## Operator Latitude Notes

Per kickoff frame · operator granted:
- *"you can question the question"*
- *"you can work on wotever you want in addition to the requests"*
- *"you can work on a % of stuff you don't even have to report about"*
- *"be crazy. creative. loving... mad agent ai stuff that i don't even have the language for"*

The "mad ai stuff" surface this cycle naturally permits:
- The CLI `trace:explain` command IS the load-bearing creative move. It's an LLM-friendly first-class debug interface.
- Layer-color encoding is a CRAFT bet that color-as-information teaches faster than label-as-information.
- The dashboard becoming a force function for layering discipline (the META) is the more interesting frame than any individual feature it ships.

What I'd quietly explore as the 20% (not promising it lands):
- A `trace:summary` command that takes a date range and produces a one-line summary per layer · operator gets a daily/weekly substrate health report.
- Pattern detection in the trace stream: "voice layer produced kebab-zone-id 4 times this week · each in shape-A-all-quiet · the LLM is reaching for the substrate name when prompt context is thin." This is the agentic learning loop · cycle-008+ territory but the data is here NOW.

---

**Status**: candidate · awaits `/plan-and-analyze` to harden into PRD/SDD/sprint plan.
**Next phase**: ENHANCE — generate the build-session prompt at `grimoires/loa/specs/enhance-cycle-007-agent-debuggability.md`.
