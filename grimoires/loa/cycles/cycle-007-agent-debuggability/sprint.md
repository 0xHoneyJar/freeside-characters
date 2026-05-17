# Sprint Plan — cycle-007 · agent debuggability through medium-aware substrate-presentation layering

> **Version**: 1.0
> **Date**: 2026-05-17
> **Author**: planning-sprints skill (Loa-embodied · ARCH/Ostrom + craft/Alexander · BARTH for ship discipline)
> **PRD**: `grimoires/loa/cycles/cycle-007-agent-debuggability/prd.md`
> **SDD**: `grimoires/loa/cycles/cycle-007-agent-debuggability/sdd.md`
> **Predecessor**: cycle-006-substrate-presentation (MERGED 2026-05-16 · `3324a8d` on main · ledger `candidate`)
> **Target branch**: `feat/cycle-007-agent-debuggability` (cut from `origin/main` @ `3324a8d` · 2026-05-16)
> **Mode**: autonomous · `/run sprint-plan` then per-sprint `/run sprint-N` · BARTH persona
> **Quality gates integrated**:
> - Flatline PRD Phase 2 (2026-05-17): 13 amendments — INV-12 lint · INV-13 schema-freeze · forward-only envelope · CLI 5-subcommand surface · SSE-behind-flag
> - BB design review Phase 3.5 (2026-05-17): 16 amendments + 5 visions — INV-14 type-enforced append · NFKC Unicode + dash-substitution · manifest-based lint · UnknownZoneError + assertNeverZone · richLabel cycle-008 follow-up
> - Flatline SDD Phase 4 (2026-05-17): 14 amendments — STDIN streaming · ReDoS bench · UnknownZoneError caller-safety · Host check · CRITICAL lint-logic-flaw fix
> - Red Team SDD Phase 4.5 (2026-05-17): 5 ACs (AC-RT-001..005) + 2 quick-fixes + 4 V2 visions — DNS rebinding bearer token (INV-16) · manifest monotonic (INV-17) · ANSI escape sanitize (INV-18) · TS-AST lint rewrite · nested-key sanitizer (INV-15)

---

## 0 · Context

cycle-006 just merged: clean substrate/presentation/voice/medium-render layering · voice-memory production-wiring · trace dashboard at `localhost:3001`. Two production bugs from the canary fire (kebab leak in voice prose · Discord Android mobile column misalignment) become FR-1 + FR-2 of this cycle.

cycle-007 ships **agent debuggability**: every JSONL trace write carries a layer envelope · agent-first CLI surface reads traces without HTTP detour · dashboard surfaces the layering through 4-color border encoding · CI lint at SOURCE + sanitizer at SINK closes Bug A class · figure-space padding + medium descriptor extension closes Bug B class · orchestrator port hygiene closes cycle-006 leak surface.

> From PRD §1.2: "After cycle-007, **the dashboard becomes the developer-experience anchor that hardens substrate-vs-presentation discipline in code**" (with BB REFRAME-1 accept-minor clarification: the dashboard is the WITNESS · INV-12 + envelope + CLI are the FORCE FUNCTIONS · S5 is craft-polish, not cycle-spine).

> From SDD §1: "Cycle-007 extends the cycle-006 honeycomb with three new substrates: (1) zone-display canonical registry, (2) trace envelope, (3) medium-aware presentation knobs · plus two surfaces (agent-first trace CLI · dashboard UI extension)."

### Quality-gate integration summary

| Gate | Phase | Findings | Amendments | INVs added |
|---|---|---|---|---|
| Flatline PRD | 2 | 14 (6 HIGH + 2 DISPUTED + 6 BLOCKERs) | 13 integrated · 0 deferred | INV-12 (lint) · INV-13 (schema freeze) |
| BB design review | 3.5 | 22 (5 HIGH + 5 MEDIUM + 3 REFRAME + 3 SPEC + 4 PRAISE + 2 VISION) | 16 integrated · 3 REFRAME accept-minor · 3 SPEC + 2 VISION → captured | INV-14 (type-enforced append) |
| Flatline SDD | 4 | 15 (5 HIGH + 4 DISPUTED + 6 BLOCKERs) | 14 integrated · 1 LOW deferred | none (hardens existing) |
| Red Team SDD | 4.5 | 10 attacks (3 THEORETICAL + 7 CREATIVE_ONLY) | 5 ACs + 2 quick-fixes · 4 deferred-as-V2-visions | INV-15 (nested-key sanitizer) · INV-16 (bearer token + Host) · INV-17 (manifest monotonic) · INV-18 (ANSI safe-render) |

**Total INVs**: 18 (3 inherited from cycle-006 + 7 added pre-Phase-2 + 8 added across quality gates).

### Red-Team-derived acceptance criteria (5 ACs)

Promoted to sprint-level acceptance criteria per cycle-006 precedent ("Loa you decide for all"):

- **AC-RT-001 (780)** · DNS rebinding bypass of SSE localhost bind → S5/T5.5 bearer token + Host header check (INV-16)
- **AC-RT-002 (760)** · INV-12 manifest narrowing in PR → S1/T1.6 monotonic check + CODEOWNERS + git-history-aware lint (INV-17)
- **AC-RT-003 (740)** · ANSI escape injection via trace:explain human format → S4/T4.4 + S5/T5.4 scripts/lib/safe-render.ts (INV-18)
- **AC-RT-004 (700)** · INV-12 lint bypass via JS string escapes → S1/T1.5 TS-AST scanner REWRITE (operator FORK-attested)
- **AC-RT-005 (420)** · Nested layer field spoof → S2 wrapTraceEntry sanitizeNestedReservedKeys (INV-15)

### Preconditions (must hold before S0 fires)

**HARD** (S0.T0.1 verifies; STOP on fail):

1. **cycle-006 MERGED in main** — `git log origin/main -1` returns `3324a8d` or descendant. Per ledger: `cycle-006-substrate-presentation.status === 'candidate'` (post-merge, pre-archive).
2. **Branch cut from main** — `git rev-parse --abbrev-ref HEAD` returns `feat/cycle-007-agent-debuggability` AND `git merge-base HEAD origin/main` returns `3324a8d`.
3. **medium-registry pinned at ^0.2.0** — `jq '.dependencies."@0xhoneyjar/medium-registry"' packages/persona-engine/package.json` returns `"^0.2.0"` (unchanged · INV-7).
4. **Trace dashboard substrate present** — `test -f scripts/dashboard.ts` AND dashboard daemon starts cleanly on `localhost:3001` (cycle-006 deliverable).

**SOFT** (S0 surfaces; SHOULD address before S3):

5. **Operator availability for S0/T0.2 mobile screenshots** — Discord Android device accessible to operator for typography spike capture. If unavailable at S0, T0.2 produces fixture URLs · operator captures at S3-start (1-day slip risk).
6. **Operator availability for S5 dashboard visual attestation** — operator visually verifies 4-color layer encoding teachable in <3 min. If unavailable, S5/T5.4 deferred to S8 cycle-close E2E.
7. **Operator availability for FR-7 E2E paste-row-to-Loa workflow** — cycle-close acceptance · operator pastes trace row to Loa via chat · Loa identifies layer in 1 inference step.

---

## Sprint Overview

| sprint | scope | tasks | LoC | risk | parallel-with | RT-ACs |
|---|---|---|---|---|---|---|
| S0 | Calibration spikes (zone-registry callers + Discord Android typography fixture) | 2 | spike-scripts (auto-delete on close) | LOW · 1 day | — | — |
| S1 | D1 zone-registry + INV-12 TS-AST lint + manifest + CODEOWNERS + monotonic check | 6 | ~+280 / ~-30 | MEDIUM (renames ~30 files + new TS lint) | — | AC-RT-002, AC-RT-004 |
| S2 | D2 trace envelope (type-enforced) + sanitizer + 5 callsite wraps + INV-15 nested-key sanitizer + INV-14 audit script | 5 | ~+180 / ~-20 | LOW | parallel with S1 sub-tasks | AC-RT-005 |
| S3 | D3 medium extensions + D5 figure-space padding + 3 render-site swaps | 3 | ~+160 / ~-50 | MEDIUM (production render path) | depends on S0/T0.2 + S2 | — |
| S4 | D4 trace CLI (5 subcommands · STDIN streaming · row selectors · safe-render integration) | 5 | ~+560 | MEDIUM | depends on S2 | AC-RT-003 (T4.4 safe-render shared) |
| S5 | Dashboard UI extension (4-color border · detail panel · SSE-behind-flag + bearer token + Host check + safe-render) | 5 | ~+420 | MEDIUM (UX + new auth surface) | depends on S2 + S4 (shared trace-readers) | AC-RT-001 (T5.5 bearer + Host), AC-RT-003 (T5.4 SSE safe-render) |
| S6 | FR-1 sanitizer hook (detectKebabZoneIds at sanitize chain) | 2 | ~+60 | LOW (log-only V1) | depends on S1 | — |
| S7 | Orchestrator port cleanup (cycle-006 G-6 closure) | 2 | ~+50 / ~-40 | LOW (mechanical) | parallel with S3-S6 | — |
| S8 | Cycle close (E2E + BB round 3 + canary + ledger flip + COMPLETED.md) | 5 | ~+50 | LOW | depends on all | — |

**Total**: 35 tasks · ~+1760 / ~-140 → ~+1620 net LoC · 8-9 working days · MEDIUM-to-LARGE.

**Compared to PRD §10 estimate (32 tasks · +1370 LoC)**: +3 tasks from Phase 4.5 RT (T1.5 lint rewrite as TS · T1.6 manifest+CODEOWNERS+monotonic · S5/T5.5 SSE extended with bearer-token+Host) + ~+250 LoC for RT counter-designs (TS-AST scanner ~+100 · safe-render.ts ~+40 · bearer-token+Host ~+60 · sanitizeNestedReservedKeys ~+15 · monotonic lint ~+35).

---

## Sprint 0: Calibration Spikes (1 day · 2 tasks · LOW risk · auto-delete on close)

**Goal**: De-risk D1 (zone-registry) by surfacing all call sites · de-risk D5 (figure-space) by empirically validating padding char choice on Discord Android.

### T0.1 — Zone-registry call-site audit
**Scope**: SMALL · ~30 LoC · auto-delete on cycle close
**File**: `scripts/spike-zone-registry-callers.ts` (NEW)
**Implementation**:
- Run `git grep -rnE "ZONE_FLAVOR|ZONE_LABEL" packages apps scripts`
- Output Markdown table to `sprint-0-COMPLETED.md` with `file:line · variable · context · proposed-replacement`
- Surface if any callers exist OUTSIDE `packages/persona-engine/src/` (D1 scope expansion trigger)

**Acceptance**: 
- `bash scripts/spike-zone-registry-callers.ts` runs cleanly
- `sprint-0-COMPLETED.md` contains the call-site table
- Operator confirms scope (or expands if hidden callers found in apps/* or scripts/*)

**Dependency**: HARD precondition #1-4 verified

### T0.2 — Discord Android typography spike (SKP-003 closure)
**Scope**: SMALL · ~115 LoC (was ~100 · +15 for Discord API verify per Phase 6 SKP-001/HIGH) · auto-delete on cycle close · Flatline IMP-014 structured decision-capture
**File**: `scripts/spike-discord-android-typography.ts` (NEW)

**HARD precondition step 0** (Phase 6 SKP-001/HIGH · operator memory `feedback_env_channel_world_mismatch`):
Before ANY webhook POST, call Discord API `GET /channels/{DISCORD_CHANNEL_TEST_ID}` and assert `guild_id` matches explicit `TEST_GUILD_ID_ALLOWLIST` constant in this script. On mismatch, refuse to post with structured error: `T0.2 ABORTED: channel ${id} resolves to guild ${actual} not in allowlist ${expected}`. Closes the env/channel-mismatch class confirmed on 2026-05-16.

**Implementation**:
- Step 0: Discord API verify (above)
- Step 1: Generate synthetic Discord embed with 5 padding variants: ASCII space · U+2007 FIGURE SPACE · U+2008 PUNCTUATION SPACE · U+00A0 NO-BREAK SPACE · code-block alternative
- Step 2: POST to test Discord channel via webhook (uses `.env.example` test channel · NOT production · ONLY AFTER step 0 verification passes)
- Operator captures Android screenshots to `.run/cycle-007-s0-t02-typography/<variant>.png`
- Append structured decision-capture block to `sprint-0-COMPLETED.md` per IMP-014 JSON Schema at `.claude/data/cycle-007-t02-decision.schema.json`:
  ```yaml
  chosen_padding_char: " "   # operator-filled
  evidence_paths: [".run/cycle-007-s0-t02-typography/figure-space.png"]
  rationale: "U+2007 renders identically to digit width on Android gg sans fallback"
  fallback_chain: [" ", " ", "code-block-wrap"]
  ```

**Acceptance**:
- Spike script runs · 5 variants posted · operator captures screenshots
- Structured decision block validates against schema
- S3 implementation reads block · refuses to start if block missing/invalid

**Dependency**: HARD precondition #1-4 + SOFT precondition #5 (operator Android device access)

**Sprint close**:
- Scripts auto-delete from `scripts/` (preserved in git history)
- `sprint-0-COMPLETED.md` persists in `grimoires/loa/cycles/cycle-007-agent-debuggability/`

---

## Sprint 1: D1 Zone-Registry + INV-12 TS-AST Lint + Manifest (1.5 days · 6 tasks · MEDIUM risk)

**Goal**: Single canonical zone-display registry · INV-12 SOURCE-side enforcement via TS-AST scanner · manifest-based file allowlist with monotonic + CODEOWNERS protection.

### T1.1 — Author zone-registry.ts
**Scope**: MEDIUM · ~120 LoC
**File**: `packages/persona-engine/src/domain/zone-registry.ts` (NEW)
**Per SDD §2.1**: Implement `ZONE_REGISTRY`, `ZoneDisplayRecord`, `resolveZoneDisplayName` (throws `UnknownZoneError` per IMP-011), `resolveZoneRichLabel` (same throw contract), `detectKebabZoneIds` with NFKC + Unicode-dash-substitution (BB HIGH-2) + false-positive allowlist (IMP-002), `UnknownZoneError`, `assertNeverZone` exhaustiveness helper.

**Acceptance**:
- All public API matches SDD §2.1 type signatures
- `Object.freeze(ZONE_REGISTRY)` enforced
- Inline JSDoc names IMP-002 + BB HIGH-2 + IMP-011 amendments
- BB REFRAME-2 trade-off comment present (richLabel Discord-coupling note + cycle-008 follow-up reference)

### T1.2 — zone-registry tests (incl. Unicode bypass + ReDoS bench)
**Scope**: MEDIUM · ~150 LoC
**File**: `packages/persona-engine/src/domain/zone-registry.test.ts` (NEW)
**Per SDD §2.1 tests**: Every ZoneId has entry · resolveZoneDisplayName throws on unknown (IMP-011) · detectKebabZoneIds case-insensitivity · all 5 false-positive allowlist contexts · BB HIGH-2 Unicode bypass tests (U+2010, U+2014, U+2013, U+2212) · Flatline IMP-002 (845) ReDoS benchmark (10K-char pathological input <50ms wall-clock).

**Acceptance**:
- `bun test packages/persona-engine/src/domain/zone-registry.test.ts` exits 0
- All 16+ test cases pass
- ReDoS benchmark assertion passes on CI runner (within 50ms wall-clock)

### T1.3 — Migrate ZONE_LABEL + ZONE_FLAVOR callers (SKP-003 safety wrap)
**Scope**: MEDIUM · ~+30 / ~-30 LoC (mostly migration)
**Files**:
- `packages/persona-engine/src/score/types.ts` (DELETE `ZONE_FLAVOR`, keep `ZONE_IDS` + `ZoneDimension` re-export)
- `packages/persona-engine/src/live/discord-render.live.ts` (DELETE `ZONE_LABEL`, use `resolveZoneRichLabel` wrapped in try/catch per SKP-003)
- `packages/persona-engine/src/persona/loader.ts:267` (use `resolveZoneDisplayName` wrapped in try/catch)
- `packages/persona-engine/src/compose/voice-brief.ts` (audit ZONE_VOICE_CONTEXT · interpolations through `resolveZoneDisplayName` wrapped in try/catch)

**SKP-003 safety pattern** (per SDD §2.1):
```typescript
let displayName: string;
try { displayName = resolveZoneDisplayName(zone); }
catch (e) {
  if (e instanceof UnknownZoneError) {
    otelCounter('zone.resolution_failed').inc({ zone: e.attemptedZone, caller: 'discord-render' });
    displayName = String(zone);
  } else { throw e; }
}
```

**Acceptance**:
- `git grep -E "ZONE_FLAVOR|ZONE_LABEL" packages apps | grep -v zone-registry.ts | grep -v test.ts | wc -l` → 0
- All caller paths import from `domain/zone-registry.ts`
- All production-path callers wrap in try/catch with `otelCounter('zone.resolution_failed')` + safe fallback

### T1.4 — Caller try/catch tests (SKP-003)
**Scope**: SMALL · ~50 LoC
**File**: `packages/persona-engine/src/live/discord-render.live.test.ts` (extend) + sibling tests
**Per SDD §2.1**: Tests verify both the throw (registry-internal) AND the catch (caller resilience). Fixture: pass unknown ZoneId · assert no crash · OTEL counter fires · output contains fallback raw kebab string.

**Acceptance**:
- All caller test files include UnknownZoneError-resilience fixtures
- `bun test` shows 0 unhandled exceptions for unknown-zone cases
- OTEL counter mock verifies `zone.resolution_failed` increment

### T1.5 — INV-12 TS-AST lint (AC-RT-004 · operator FORK-accepted)
**Scope**: LARGE · ~+100 LoC TS · replaces ~60 LoC bash sketch
**Files**:
- `scripts/lint-no-kebab-zoneid-in-voice-prompt.ts` (NEW · replaces the bash sketch in SDD §2.7)
- `scripts/lint-no-kebab-zoneid-in-voice-prompt.test.ts` (NEW · tests bypass-class coverage)
- `package.json` `lint:zone-source` script alias updated
- `.github/workflows/ci.yml` step added at S1 close

**Per SDD §2.7 + Red Team AC-RT-004**: Use TypeScript compiler API (already in deps via `typescript@^5.7.2` · PRAISE-3 zero-new-deps holds). Resolve string literals through:
- (a) escape sequences (`'el-dorado'` decoded)
- (b) template literals with constant parts (`` `el${'-'}dorado` ``)
- (c) identifier references to `ZONE_IDS`-shaped const arrays
- (d) `String.fromCharCode(...)` chains (numeric → string evaluation)

**Acceptance**:
- Reads manifest at `.claude/data/voice-prompt-paths.json` (Flatline IMP-013 fallback discipline) — fails CI if manifest schema invalid · falls back to hardcoded only if file absent
- Lint detects synthetic bypass fixtures: `'el-dorado'`, `\`el${'-'}dorado\``, `String.fromCharCode(101,108,45,...)`, identifier `const z = 'el-dorado'`
- `bun run lint:zone-source` exits 0 on clean code · exits 1 on injected violation with file:line report
- CI step runs on every PR · blocks merge on violation
- Flatline SKP-001/CRITICAL fix preserved: skip ONLY import-statement LINE, flag literals on all other lines

### T1.6 — Manifest + CODEOWNERS + monotonic check (AC-RT-002 · INV-17)
**Scope**: MEDIUM · ~+90 LoC bash + 1 CODEOWNERS file + manifest + schema
**Files**:
- `.claude/data/voice-prompt-paths.json` (NEW · the manifest)
- `.claude/data/voice-prompt-paths.schema.json` (NEW · JSON Schema for manifest)
- `scripts/lint-manifest-monotonic.sh` (NEW · git-history-aware monotonic check · ~50 LoC)
- `CODEOWNERS` (NEW or EXTEND · operator `@zksoju` required for review on manifest changes)
- `.github/workflows/ci.yml` (extend with monotonic check step)

**Per SDD §2.7 + Red Team AC-RT-002 + INV-17**:
- Manifest schema enforces `paths: string[]`, `exclude: string[]`, `description: string`
- `lint-manifest-monotonic.sh` walks `git log origin/main -- .claude/data/voice-prompt-paths.json` · asserts paths[] length monotonically non-decreasing OR removal commit has CODEOWNERS approval signed-off-by trailer
- Git-history-aware lint variant: scan paths that were EVER in the manifest at any commit on main (defends against PR-narrowing-then-leak class)
- CODEOWNERS entry: `.claude/data/voice-prompt-paths.json @zksoju` (operator review required)

**Acceptance**:
- Manifest validates against schema
- Monotonic check passes on current state
- Synthetic test PR removing a path FAILS CI with explicit "manifest narrowing without CODEOWNERS approval" error
- CODEOWNERS file present and recognized by GitHub
- Git-history-aware lint scans union of historical paths[] + current paths[]

**Sprint close**:
- T1.1-T1.4 complete (zone registry + tests + caller migration + safety tests)
- T1.5 complete (TS-AST lint + CI integration)
- T1.6 complete (manifest + CODEOWNERS + monotonic check + git-history scan)
- 0 `ZONE_FLAVOR`/`ZONE_LABEL` hits outside zone-registry.ts
- `bun run lint:zone-source` clean · `bash scripts/lint-manifest-monotonic.sh` clean
- CI green

---

## Sprint 2: D2 Trace Envelope (Type-Enforced) + INV-15 + INV-14 Audit (1.5 days · 5 tasks · LOW risk)

**Goal**: Every JSONL writer wraps payloads via `wrapTraceEntry` (or fails to compile) · INV-14 enforces SOLE-helper discipline · INV-15 sanitizes nested reserved keys · forward-only · readers tolerate absent fields for pre-cycle-007 rows.

### T2.1 — Author trace-envelope.ts + appendTraceEntry (type-enforced) + nested-key sanitizer
**Scope**: MEDIUM · ~90 LoC
**File**: `packages/persona-engine/src/observability/trace-envelope.ts` (NEW)
**Per SDD §2.2 + BB HIGH-4 + AC-RT-005 + INV-14 + INV-15**:
- Export `TRACE_LAYERS` (frozen const tuple), `TraceLayer` type, `TraceEnvelope` interface
- Export `wrapTraceEntry<T>(layer, layer_op, payload)` with envelope-wins spread order + `sanitizeNestedReservedKeys` recursive sanitizer (INV-15 · AC-RT-005)
- Export `isTraceEnvelope` type guard
- Export `appendTraceEntry<T extends TraceEnvelope>(filePath, entry)` — SOLE permitted JSONL append helper (INV-14 · BB HIGH-4)
- Document semantics per Flatline IMP-003: best-effort · no fsync · no locking · single-process invariant

**Acceptance**:
- All exports match SDD §2.2 type signatures
- TraceLayer enum frozen at 5 values
- appendTraceEntry signature requires `T extends TraceEnvelope` (compile-time check)
- sanitizeNestedReservedKeys recursion depth bound at 32 (defense against JSON-bomb-style nesting per ATK-008 deferred-V2)

### T2.2 — trace-envelope tests + INV-15 nested-key spoof tests
**Scope**: MEDIUM · ~100 LoC
**File**: `packages/persona-engine/src/observability/trace-envelope.test.ts` (NEW)
**Per SDD §2.2 + INV-15 test row in §3**:
- `wrapTraceEntry('substrate', 'score-fetch', { zone: 'el-dorado' })` returns `{ zone, layer, layer_op, emitted_at }`
- `emitted_at` is valid ISO 8601
- `isTraceEnvelope` returns `false` for pre-cycle-007 fixture (absent `layer` field)
- TraceLayer enum freeze test
- **INV-15 nested-key spoof test (AC-RT-005)**: `wrapTraceEntry('voice','test', {metadata:{layer:'orchestrator'}})` → top-level `layer === 'voice'` AND `metadata.payload_layer === 'orchestrator'` (sanitized · spoof rewritten)
- Recursion depth bound test (32 levels)
- appendTraceEntry type-error test (synthetic call without TraceEnvelope intersection fails compile · `@ts-expect-error` pinning)

**Acceptance**:
- `bun test packages/persona-engine/src/observability/trace-envelope.test.ts` exits 0

### T2.3 — Wrap 5 JSONL writers (S2 sweep)
**Scope**: MEDIUM · ~+40 / ~-15 LoC (callsite migrations)
**Files**:
- `compose/agent-gateway.ts::writeLlmTraceEntry` (2 sites · `('voice','bedrock-converse'|'sdk-call', payload)`)
- `live/voice-memory.live.ts::appendEntry` (`('voice','memory-write',entry)`)
- `live/voice-memory.live.ts::forgetUser` (`('voice','memory-forget',{stream,key,reason})`)
- `live/score-mcp.live.ts::recordRejection` (`('substrate','snapshot-rejection',rejection)`)
- `deliver/sanitize.ts::stripVoiceDisciplineDrift` (NEW write at S6 · `('presentation','sanitize-violation',{violations,sample})`) — DEFER actual write to S6 · just confirm import here

**Per SDD §2.2 Modifications-elsewhere table**:
- All existing direct `fs.appendFile`/`Bun.write` calls on `.jsonl` paths in `packages/persona-engine/src/` migrate to `appendTraceEntry`
- Compiler enforces `T & TraceEnvelope` requirement · code that doesn't wrap fails to compile

**Acceptance**:
- All 4 active writers (deliver/sanitize.ts is S6 · just import-ready here) use appendTraceEntry
- TypeScript build clean
- Runtime smoke: `bun run --cwd apps/bot digest:once` produces JSONL rows with envelope fields

### T2.4 — INV-14 audit script (BB HIGH-4 hardened per Flatline SKP-001/HIGH)
**Scope**: MEDIUM · ~+60 LoC bash
**Files**:
- `scripts/audit-jsonl-append-discipline.sh` (NEW)
- `.github/workflows/ci.yml` (extend with audit step · Flatline IMP-007)

**Per SDD §2.2 INV-14 hardening + Flatline SKP-001/HIGH defense-in-depth patterns**:
- Pattern 1: `appendFile.*\.jsonl|fs\.write.*\.jsonl|createWriteStream.*\.jsonl`
- Pattern 2: `Bun\.write.*\.jsonl.*append` (binding-form-agnostic · also catches `const writer = Bun.write`)
- Pattern 3: `import.*'fs'|import.*'node:fs'|import.*'fs/promises'` outside `packages/persona-engine/src/observability/`
- Exit 0 on clean · exit 1 with violation report on any hit · CI integration

**Acceptance**:
- Audit script runs in CI at every PR
- Synthetic test: introducing `import { appendFile } from 'fs/promises'` in `compose/agent-gateway.ts` triggers exit 1 with location report
- Audit script for `packages/persona-engine/src/observability/trace-envelope.ts` itself returns 0 (allowed)

### T2.5 — Reader-tolerance fixture (Flatline IMP-012)
**Scope**: SMALL · ~50 LoC
**File**: `packages/persona-engine/src/observability/trace-envelope-reader.test.ts` (NEW)
**Per Flatline IMP-012 + SDD §2.4 reader-tolerance**:
- Fixture: mixed JSONL file containing pre-cycle-007 row (absent envelope) + post-cycle-007 row (with envelope)
- Reader returns `layer: 'unknown'` for legacy row · `layer: 'voice'` (or actual) for tagged row
- No throw on legacy row · no crash · `warnings` field populated

**Acceptance**:
- Test passes
- Reader exports a tolerant decoding path that downstream CLI + dashboard consume

**Sprint close**:
- Every JSONL writer wraps via `appendTraceEntry`
- TS compile-time check enforces `T & TraceEnvelope`
- Audit script exits 0 in CI
- `bun run --cwd apps/bot digest:once` produces JSONL rows with `.layer` field on every line of the explicit allowlist (Flatline SKP-001/CRITICAL narrowing)

---

## Sprint 3: D3 Medium Extensions + D5 Figure-Space Padding (1 day · 3 tasks · MEDIUM risk)

**Goal**: Renderer reads medium-specific knobs from descriptor · figure-space (U+2007) padding closes Bug B mobile alignment class · hardcoded `1024 / 6000 / 19 / 40 / 38` constants forbidden after S3.

**Prerequisite**: S0/T0.2 structured decision-capture block present in `sprint-0-COMPLETED.md` · S2 trace envelope in place (for renderer trace emissions).

### T3.1 — Author medium-extensions.ts (incl. metricsForMedium throws-on-unknown)
**Scope**: MEDIUM · ~90 LoC
**File**: `packages/persona-engine/src/deliver/medium-extensions.ts` (NEW)
**Per SDD §2.3 + BB MEDIUM-5 + Flatline SKP-002/HIGH spec-test alignment**:
- `ExtendedMediumMetrics` interface with all 5 fields
- `DISCORD_EXTENDED` const (frozen) with `digitWidthSpaceChar: ' '` (explicit escape · Flatline SKP-002 hardening)
  - Value sourced from S0/T0.2 operator decision-capture block (default ` ` unless operator override)
- `CLI_EXTENDED` const (frozen) with ASCII space
- `metricsForMedium(medium)` returns `DISCORD_EXTENDED` for Discord descriptor · `CLI_EXTENDED` for explicitly-registered `id === 'cli'` · THROWS `UnsupportedMediumError` otherwise (BB MEDIUM-5)
- `UnsupportedMediumError` class exported

**Acceptance**:
- All exports match SDD §2.3
- `Object.freeze(DISCORD_EXTENDED)` enforced
- S3 implementation reads + validates S0/T0.2 decision block via `ajv` against `.claude/data/cycle-007-t02-decision.schema.json`
- Refuses to start if decision block missing/invalid

### T3.2 — medium-extensions tests (codepoint + ASCII-negative + byte-snapshot)
**Scope**: MEDIUM · ~80 LoC
**File**: `packages/persona-engine/src/deliver/medium-extensions.test.ts` (NEW)
**Per SDD §2.3 + 2.4 + Flatline SKP-002 + BB IMP-006**:
- `DISCORD_EXTENDED.digitWidthSpaceChar.codePointAt(0) === 0x2007` (codepoint identity · NOT length comparison)
- `DISCORD_EXTENDED.digitWidthSpaceChar !== ' '` (ASCII-negative assertion)
- `DISCORD_EXTENDED.digitWidthSpaceChar.length === 1` (sanity)
- `metricsForMedium(DISCORD_WEBHOOK_DESCRIPTOR) === DISCORD_EXTENDED`
- `metricsForMedium(unregisteredMedium)` throws `UnsupportedMediumError` (per BB MEDIUM-5 + Flatline SKP-002/HIGH alignment)
- `CLI_DESCRIPTOR` fixture: `metricsForMedium(CLI_DESCRIPTOR) === CLI_EXTENDED`
- DISCORD_EXTENDED frozen (mutation throws in strict mode)

**Acceptance**:
- `bun test packages/persona-engine/src/deliver/medium-extensions.test.ts` exits 0

### T3.3 — discord-render.live.ts migration (D5 figure-space + D3 medium-aware) + byte-snapshot test
**Scope**: MEDIUM · ~+40 / ~-50 LoC (replace hardcoded constants)
**Files**:
- `packages/persona-engine/src/live/discord-render.live.ts` (MODIFY `renderSnapshotField` + sibling field renderers)
- `packages/persona-engine/src/live/discord-render.live.test.ts` (EXTEND with byte-snapshot test)
- `packages/persona-engine/src/deliver/embed.ts` (audit hardcoded `1024 / 6000 / 19 / 40 / 38` · migrate to `metricsForMedium()`)

**Per SDD §2.3 modifications + IMP-006 byte-snapshot test**:
- `renderSnapshotField` consumes `metricsForMedium(medium).digitWidthSpaceChar` for padding
- `codeBlockMonoCharWidth` for value-column width cap
- 0 hardcoded numeric constants remain in render code after migration
- Byte-snapshot test asserts U+2007 bytes (`0xE2 0x80 0x87` UTF-8) appear at expected padding positions

**Acceptance**:
- `git grep -nE "padEnd\(.*' '|padStart\(.*' '" packages/persona-engine/src/live/discord-render.live.ts | wc -l` → 0 (no ASCII space padding)
- Hardcoded `1024 / 6000 / 19 / 40 / 38` removed from `live/discord-render.live.ts` + `deliver/embed.ts`
- Byte-snapshot test passes
- Operator screenshots from Discord Android show aligned numeric column (validates S0/T0.2 spike conclusion)

**Sprint close**:
- All 3 tasks complete
- FR-2 (Bug B) closed at CLASS level — figure-space padding gated by medium descriptor · operator-attested mobile rendering aligned

---

## Sprint 4: D4 Trace CLI (1.5 days · 5 tasks · MEDIUM risk)

**Goal**: Agent-first CLI surface · 5 subcommands · STDIN-streaming reader + 1MB cap · row-selector for JSONL · safe-render for human format · schema-validated `trace:explain` output.

### T4.1 — Extract trace-readers.ts (shared with dashboard)
**Scope**: MEDIUM · ~140 LoC
**File**: `scripts/lib/trace-readers.ts` (NEW)
**Per SDD §2.4**:
- Export `readLatest`, `readByRunId`, `readByLayer`, `readVoice`, `explainRow`
- Export `FREESIDE_CHARACTERS_TRACE_FILES` allowlist const (Flatline SKP-001/CRITICAL narrowing · ATK-007 quick-fix)
- Export `ExplainedRow` interface (schema-versioned per INV-13)
- Path resolution via `findRepoRoot()` (Flatline IMP-012 algorithm)

**Acceptance**:
- All exports match SDD §2.4
- Path resolution returns absolute paths from repo root
- Reader-tolerance for absent envelope fields (Flatline IMP-012)

### T4.2 — Author trace.ts (5 subcommands · STDIN streaming · row selectors · ATK-007 strict allowlist)
**Scope**: LARGE · ~280 LoC
**File**: `scripts/trace.ts` (NEW)
**Per SDD §2.5 + Flatline IMP-001/SKP-002/SKP-001 + Red Team ATK-007**:
- 5 subcommands: `latest`, `get`, `layer`, `voice`, `explain`
- STDIN streaming reader with 1MB byte-count limit (NOT `await Bun.stdin.text()`)
- Malformed JSON exits 5 with structured error
- `--file` argument: realpath-canonicalized + repo-root containment (`findRepoRoot()`) + STRICT membership against `FREESIDE_CHARACTERS_TRACE_FILES` (ATK-007 quick-fix replaces broad `.jsonl|.json` regex)
- Fixture `.json` loading requires `LOA_TRACE_TEST_MODE=1` env (ATK-007 test-mode gate)
- `.jsonl` files require `--line N | --run-id Y | --latest` row selector (Flatline SKP-001/HIGH)
- Positional arg rejected with exit 2 (Flatline SKP-002 STDIN-first)

### T4.3 — Wire trace:* script aliases
**Scope**: SMALL · ~10 LoC
**File**: `package.json` (MODIFY scripts section)
**Per SDD §2.5 Package.json script aliases block**: Add `trace:latest`, `trace:get`, `trace:layer`, `trace:voice`, `trace:explain` aliases.

**Acceptance**: `bun run trace:latest --help` shows usage

### T4.4 — Tests + safe-render.ts (AC-RT-003 · INV-18) + ajv schema-validation snapshot (BB HIGH-5)
**Scope**: LARGE · ~+220 LoC (140 tests + 80 safe-render)
**Files**:
- `scripts/trace.test.ts` (NEW · tests for all 5 subcommands)
- `scripts/lib/safe-render.ts` (NEW · ~80 LoC · INV-18)
- `scripts/lib/safe-render.test.ts` (NEW)
- `.claude/data/trace-explain-output.schema.json` (NEW · INV-13 schema)

**Per SDD §2.5 tests + Red Team AC-RT-003 + BB HIGH-5**:

`safe-render.ts`:
- Export `sanitizeForTerminal(value: string): string` — strips C0/C1 control bytes via `/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g` · renders OSC 8 hyperlinks as plain-text `[url]` suffixes
- Used by `scripts/trace.ts::humanFormat()` for ALL payload string values

`trace.test.ts`:
- Each subcommand returns expected JSON shape
- trace:explain JSON output validates against `.claude/data/trace-explain-output.schema.json` (BB HIGH-5 ajv snapshot test)
- Positional arg → exit 2
- 2MB STDIN → exit 4 (Flatline IMP-001)
- Malformed JSON → exit 5 (Flatline IMP-001)
- `.jsonl` without selector → exit 3 (Flatline SKP-001/HIGH)
- `--file /etc/passwd` → exit 3 (BB HIGH-1)
- `--file ../outside-repo.json` → exit 3 (BB HIGH-1 realpath)
- `--file <not-in-FREESIDE_CHARACTERS_TRACE_FILES>` → exit 3 (Red Team ATK-007 strict allowlist)
- `--file fixture.json` without `LOA_TRACE_TEST_MODE=1` → exit 3 (Red Team ATK-007 test-mode gate)
- Human format: no ANSI bytes in output for payload containing `\x1b]0;hijack\x07` (Red Team AC-RT-003)
- `findRepoRoot()` algorithm tests (Flatline IMP-012)

**Acceptance**:
- All test cases pass
- AC-RT-003 validated by terminal-escape-injection fixture

### T4.5 — docs/trace-cli.md (operator-facing UX walkthrough)
**Scope**: SMALL · ~100 LoC markdown
**File**: `docs/trace-cli.md` (NEW)
**Per SDD §2.5 docs**: Copy-paste examples · pbpaste-to-Loa workflow walkthrough · operational notes (MEDIUM-1 reader-scan ~200-500ms after 3 months · V2 indexed manifest follow-up).

**Acceptance**:
- Doc covers all 5 subcommands with example invocations
- Operator-attested as readable in <5 min

**Sprint close**:
- All 5 tasks complete
- Loa (operator-attested) successfully uses `bun run trace:explain` on a synthetic bug fixture and correctly identifies producing layer + file:line

---

## Sprint 5: Dashboard UI Extension + SSE-Behind-Flag + AC-RT-001 Bearer Token (1.5 days · 5 tasks · MEDIUM risk)

**Goal**: Layer-color border encoding · detail-panel layer split · SSE behind feature flag with bearer token + Host header check + safe-render for streamed payloads · visual regression fixtures operator-attested.

**Prerequisite**: S2 (trace envelope) + S4 (trace-readers.ts extracted to lib).

### T5.1 — Dashboard consumes trace-readers.ts (extraction)
**Scope**: SMALL · ~+20 / ~-80 LoC (deduplication)
**File**: `scripts/dashboard.ts` (MODIFY · imports from `scripts/lib/trace-readers.ts`)

**Acceptance**: No duplicate reader logic between dashboard.ts and trace.ts

### T5.2 — Layer-color border encoding (Alexander oklch palette · INV-10)
**Scope**: MEDIUM · ~+80 LoC HTML/CSS
**Files**: `scripts/dashboard.ts` (or sibling `.html` template) · CSS variable definitions per SDD §2.6
**Per SDD §2.6**: 3px left border per row · oklch palette (6 colors: substrate cool-blue · voice warm-gold · presentation sage-green · medium-render lavender · orchestrator dim-purple · unknown neutral-grey) · checked-in CSS file fixtures.

**Acceptance**:
- Dashboard renders rows with 3px left border colored per layer
- Hover state: 80ms ease-out background fade · NOT translate-y (Alexander spec)
- Selection state: instant border-left activation · no animation

### T5.3 — Detail panel layer split + cross-layer connectors
**Scope**: MEDIUM · ~+150 LoC
**File**: `scripts/dashboard.ts` (extend detail panel rendering)
**Per SDD §2.6**: Detail panel splits horizontally (or stacks viewport-adaptive) by layer · cross-layer connector lines render in OTHER layer's color · panel expand/collapse 200ms ease-out on max-height + opacity.

**Acceptance**:
- Click on row populates layer-split detail panels
- Cross-layer connectors visible for events with cross-layer attributes
- Operator-attested visual layout

### T5.4 — Visual regression fixtures + safe-render integration (AC-RT-003)
**Scope**: MEDIUM · ~+50 LoC fixtures + integration
**Files**:
- `scripts/dashboard-fixtures/*.png` (NEW · checked-in operator-attested screenshots)
- `scripts/dashboard.ts` (integrate `scripts/lib/safe-render.ts::sanitizeForTerminal` for SSE-streamed payload string values per AC-RT-003 server-side defense-in-depth)

**Per SDD §2.6 + AC-RT-003**: Dashboard pre-sanitizes SSE payloads before transmission (browser-side may have XSS protection but server pre-sanitizes per cycle-007 craft policy).

**Acceptance**:
- Visual regression fixtures checked in
- Operator attests 4-color encoding teachable in <3 min
- SSE-streamed payload with embedded `\x1b]0;hijack\x07` arrives sanitized at browser

### T5.5 — SSE-behind-flag + **HttpOnly cookie auth** + Host check (AC-RT-001 · INV-16) + max-clients + heartbeat + truncation
**Scope**: LARGE · ~+145 LoC (was ~100 pre-RT · +20 for bearer/Host · +25 for Phase 6 SKP-002 cookie bootstrap replacing query-param)
**Files**:
- `scripts/dashboard.ts` (extend with SSE endpoint · LOA_DASH_TOKEN generation · Host header check · max-clients · heartbeat)
- `scripts/dashboard.test.ts` (NEW · all 3 SSE flag-states + AC-RT-001 + AC-RT-010 tests)

**Per SDD §2.6 + Flatline IMP-005 + Red Team AC-RT-001 + Red Team AC-RT-010 + BB MEDIUM-2 + BB MEDIUM-3**:

Server-side:
- `Bun.serve({ hostname: '127.0.0.1', port: 3001 })` explicit · NEVER `'0.0.0.0'` (IMP-005)
- Generate `LOA_DASH_TOKEN = crypto.randomUUID()` at server start · print to stderr (AC-RT-001)
- **Phase 6 SKP-002 cookie bootstrap** (replaces query-param approach):
  - On initial `GET /` (dashboard HTML page): server requires `X-Loa-Dash-Token` header OR Cookie `loa_dash_token` matching · if neither present, return 401 with stderr-token-copy-instructions
  - On 401 → operator copies token from stderr · sends `curl -H "X-Loa-Dash-Token: ..." http://localhost:3001/api/auth` which sets HttpOnly + SameSite=Strict cookie `loa_dash_token` (no Secure flag for localhost HTTP)
  - Subsequent dashboard tab + SSE + REST requests carry cookie automatically · EventSource uses `withCredentials: true`
  - Cookie NEVER readable from JS · NEVER visible in DevTools Network tab URL · NEVER logged by proxies
- `/sse` + ALL `/api/*` endpoints require valid cookie OR `X-Loa-Dash-Token` header (defense-in-depth for `curl` operator usage) · 403 on miss/mismatch (AC-RT-001 · INV-16)
- Host header validation: reject any request with Host not in `{127.0.0.1:3001, localhost:3001}` (AC-RT-001 DNS rebinding defense)
- Origin check on `/sse`: reject non-localhost origins (IMP-005)
- Max-clients: 5 per token cap (BB MEDIUM-2) + per-token cap of 1 + forcible eviction of prior connections for same token (AC-RT-010)
- 60s heartbeat (`event: ping\n\n`) + client cleanup on `EventSource.onerror` (BB MEDIUM-2)
- SSE payload truncation: `prompt`/`response`/large strings → 500ch with `[truncated]` suffix · full row via REST `/api/llm-trace?run-id=Y` (BB MEDIUM-3)
- SSE payload passes through `sanitizeForTerminal()` before transmission (AC-RT-003 defense-in-depth)

Client-side:
- `if (window.__LOA_DASH_SSE__) new EventSource('/sse', { withCredentials: true }).onmessage = (ev) => animateRow(JSON.parse(ev.data))` (cookie auto-attached)
- **Phase 6 SKP-001/CRITICAL XSS**: payload strings rendered via `.textContent` ONLY (NEVER `.innerHTML`) · `safe-render.ts::sanitizeForBrowser(html)` available for any deliberate HTML rendering paths
- Layer-color flash: 200ms ease-out on border-left brightness boost

**Acceptance**:
- 3-path flag test (IMP-005 hardening):
  - Default (LOA_DASH_SSE unset): no `/sse` requests · no EventSource attempts
  - Enabled (LOA_DASH_SSE=1): EventSource attaches · new rows flash layer color · poll suppressed
  - Rollback (set then unset+restart): clean revert to poll · no leftover state
- AC-RT-001 DNS-rebinding fixture test: synthetic request with `Host: attacker.example` returns 403
- AC-RT-001 token test: request without token returns 403 · with wrong token returns 403 · with correct token succeeds
- AC-RT-010 reconnect-storm fixture: 5 connections with same token cap-at-1 + evict prior · OK
- BB MEDIUM-2 heartbeat test: 60s ping received
- BB MEDIUM-3 truncation test: 10KB prompt arrives truncated to 500ch with `[truncated]` suffix
- AC-RT-003 ANSI escape test: `\x1b]0;hijack\x07` in payload arrives sanitized to browser

**Sprint close**:
- All 5 tasks complete
- Operator visual-attestation: dashboard color encoding teachable in <3 min
- SSE behind flag works in default + enabled + rollback states with full AC-RT-001 + AC-RT-010 + BB MEDIUM-2/3 hardening

---

## Sprint 6: FR-1 Sanitizer Hook (0.5 day · 2 tasks · LOW risk · log-only V1)

**Goal**: `detectKebabZoneIds` runs in sanitize chain · log-only · cycle-006 SR-1 + Flatline SKP-001/HIGH disposition.

**Prerequisite**: S1 (zone-registry with `detectKebabZoneIds` available).

### T6.1 — Sanitizer hook in stripVoiceDisciplineDrift
**Scope**: SMALL · ~30 LoC
**Files**:
- `packages/persona-engine/src/deliver/sanitize.ts` (MODIFY `stripVoiceDisciplineDrift` to add detectKebabZoneIds call)
- Emits OTEL event `voice.kebab_zone_leak_detected` with `{ violations: ZoneId[], sample: string }` (sample truncated to 200 chars)
- Wraps via `appendTraceEntry('presentation', 'sanitize-violation', payload)` per S2 INV-14
- V1 LOG-ONLY · does NOT auto-substitute

**Acceptance**: Sanitizer logs violation, passes text through unchanged

### T6.2 — Sanitizer tests + V2 calendarized review trigger (IMP-001)
**Scope**: SMALL · ~30 LoC
**File**: `packages/persona-engine/src/deliver/sanitize.test.ts` (EXTEND)
**Per Flatline IMP-001 calendarized review**: 
- Synthetic test: voice text containing `"el-dorado wakes"` → sanitizer logs violation, returns text unchanged
- False-positive tests: `:el-dorado:` (Discord emoji), `` `el-dorado` `` (code), `https://example.com/el-dorado` (URL) → no violation logged
- BB HIGH-2 Unicode bypass tests: `el‐dorado` (U+2010), `el—dorado` (U+2014) → violations logged

**Sprint close**:
- Sanitizer hook live in production cron path
- IMP-001 V2 review trigger: at S6+24h, operator reviews `apps/bot/.run/llm-trace.jsonl` for `voice.kebab_zone_leak_detected` events · decides V2 substitution policy (with allowlist for legitimate kebab content)
- SOURCE-side INV-12 (S1) already closes the leak surface at compile time · sanitizer is SINK-side observation

---

## Sprint 7: Orchestrator Port Cleanup (0.5 day · 2 tasks · LOW risk · mechanical · cycle-006 G-6 closure)

**Goal**: 7 orchestrator files stop importing `to*Payload` directly from `live/discord-webhook.live.ts` · route through `PresentationPort` instead.

**Independent**: can run parallel to S3-S6.

### T7.1 — Migrate 7 orchestrators to PresentationPort
**Scope**: MEDIUM · ~+30 / ~-40 LoC (mechanical rewrites)
**Files** (7 orchestrators per SDD/PRD):
- digest, pop-in, weaver, micro, lore_drop, question, callout, chat-mode-reply
- Each MODIFY: replace `import { toXxxPayload } from '../live/discord-webhook.live.ts'` with `import { PresentationPort } from '../ports/...'` and route through port

### T7.2 — composer-router.test.ts extension + audit script update
**Scope**: SMALL · ~30 LoC
**Files**:
- `packages/persona-engine/src/composer-router.test.ts` (EXTEND)
- `scripts/audit-substrate-presentation-seam.sh` (verify `--strict-composer` flag exit 0)

**Acceptance**:
- `bash scripts/audit-substrate-presentation-seam.sh --strict-composer` exits 0
- `git grep "to.*Payload" packages/persona-engine/src/orchestrator | grep -v import.*ports` → 0 matches
- Test regex assertion confirms no `to*Payload` import in orchestrator/*.ts

**Sprint close**:
- Cycle-006 G-6 leak closed
- Orchestrators import ONLY from `ports/`

---

## Sprint 8: Cycle Close (0.5 day · 5 tasks · LOW risk)

**Goal**: COMPLETED.md cycle summary · BB round 3 review · operator-attested production canary · ledger flip `active → candidate`.

### T8.1 — COMPLETED.md cycle summary
**Scope**: MEDIUM · ~400 LoC markdown
**File**: `grimoires/loa/cycles/cycle-007-agent-debuggability/COMPLETED.md` (NEW)
**Per cycle-006 precedent**: cycle summary · lessons distilled · evidence-based decisions · operator-paced follow-ups · all 18 INVs status · all 5 RT ACs status · all 16 BB amendments status · all 14 Flatline SDD amendments status.

### T8.2 — E2E acceptance (FR-7 paste-row-to-Loa workflow)
**Scope**: SMALL · ~50 LoC
**File**: `tests/integration/cycle-007-debug-loop.test.ts` (NEW) + manual operator session
**Per SDD §3 + PRD §4.7**:
- Synthetic test: 5 fixture trace rows spanning all 5 layers · `trace:explain` correctly identifies layer + file:line for each
- Manual operator E2E: fire digest → open dashboard → see layer-color rows → click row → see layer-split detail → copy row to Loa via chat → Loa identifies layer-of-origin in 1 inference step
- Recorded as evidence in COMPLETED.md

### T8.3 — BB round 3 review
**Scope**: SMALL · ~30 min operator time
**Per cycle-006 precedent**: `/bridgebuilder-review` on the cycle-007 PR → APPROVED or PRAISE-only findings.

### T8.4 — Operator-attested production canary (FR-2 mobile screenshot)
**Scope**: SMALL · ~15 min operator time
**Per SDD §5 rollout step 4**: Operator screenshots Discord Android after S3 close → confirms FR-2 acceptance (aligned numeric column)

### T8.5 — Ledger flip cycle-007 `active → candidate`
**Scope**: SMALL · 1 commit
**File**: `grimoires/loa/ledger.json` (MODIFY cycle-007 entry · status `active` → `candidate` · add `candidate_at` ISO timestamp)

**Sprint close**:
- All 5 tasks complete
- COMPLETED.md with ARCHIVED marker after operator sign-off
- Ledger entry flips to `candidate` (and to `archived` once operator sign-off)
- PR merged

---

## Cross-cutting concerns

### Beads integration (if enabled)

Per Loa beads-first architecture: each sprint corresponds to a beads epic. Tasks registered via `br` lifecycle:
- `br create epic` per sprint (S0..S8)
- `br create task` per task within epic
- `br in-progress` / `br closed` lifecycle per task

If beads not available: TaskCreate/TaskUpdate falls back to session display.

### Parallelization opportunities

- **S0 tasks T0.1 + T0.2 parallel** (independent · both spike scripts · can run concurrently if operator has Android device available)
- **S1 internal**: T1.1+T1.2 must complete before T1.3+T1.4 (zone-registry exists before callers migrate). T1.5+T1.6 parallel with T1.3+T1.4 (lint+manifest independent of caller migration).
- **S2 parallel with S1 sub-tasks**: T2.1+T2.2 (trace-envelope authoring) can run before S1 lands · T2.3 (callsite wraps) must wait for S2 + S1 (callers should be safe-wrapped first)
- **S3 depends on S0/T0.2 + S2**: typography decision + envelope in place
- **S4 + S5 parallel after S2**: both consume `trace-readers.ts` extracted at S4/T4.1 + S5/T5.1
- **S6 depends on S1**: needs detectKebabZoneIds
- **S7 INDEPENDENT**: can run any time (parallel with S3-S6)

### Circuit-breaker triggers (halt autonomous run)

- **AC-RT-001 / 002 / 003 / 004 / 005 test failure**: HALT · operator triage required
- **INV-12 lint produces false-positive blocking the cycle**: HALT · operator reviews exception → adds to allowlist OR rewrites lint logic
- **INV-14 audit script flags genuine bypass that audit-author cannot fix in 30 min**: HALT · operator decides
- **`bash scripts/audit-substrate-presentation-seam.sh --strict-composer` fails at S7**: HALT · investigate which orchestrator still leaks
- **Operator screenshot at S3 close shows misalignment STILL OCCURS with U+2007**: HALT · pivot to U+2008 / U+00A0 / code-block fallback (staged at S0/T0.2)
- **BB round 3 returns REQUEST_CHANGES verdict**: HALT · operator reviews findings → integrate or defer

### Rollback strategy (per SDD §5)

- D1 zone-registry: `git revert` if S0/T0.1 hidden callers found
- D5 figure-space: change one constant in DISCORD_EXTENDED back to ` ` (ASCII) — informed by S3 acceptance
- D3 medium-extensions: local extension shed-able if upstream pushes back at cycle close
- Dashboard SSE: unset `LOA_DASH_SSE` env, restart daemon
- Sanitizer hook: log-only — no rollback needed

### LoC budget tracking

| sprint | net LoC | running total |
|---|---|---|
| S0 | 0 (auto-delete) | 0 |
| S1 | +250 | +250 |
| S2 | +160 | +410 |
| S3 | +110 | +520 |
| S4 | +560 | +1080 |
| S5 | +420 | +1500 |
| S6 | +60 | +1560 |
| S7 | +10 | +1570 |
| S8 | +50 | +1620 |

**Total: ~+1620 net LoC** (vs arch's original +1300 estimate · +320 from 3 quality-gate phases). Within PRD §2.2 success-metric budget tolerance.

---

## References

| topic | path |
|---|---|
| PRD | `grimoires/loa/cycles/cycle-007-agent-debuggability/prd.md` |
| SDD | `grimoires/loa/cycles/cycle-007-agent-debuggability/sdd.md` (1083 lines · 18 INVs · 11 sections) |
| Arch decisions D1-D6 | `grimoires/loa/specs/arch-cycle-007-agent-debuggability.md` |
| Build doc | `grimoires/loa/specs/enhance-cycle-007-agent-debuggability.md` |
| Kickoff handoff | `.run/compose/20260516-8b993e/envelopes/final.kickoff.handoff.json` |
| Predecessor cycle-006 | `grimoires/loa/cycles/cycle-006-substrate-presentation/` |
| Decision logs | `grimoires/loa/NOTES.md` (5 cycle-007 Decision Log sections · Phase 1 · 2 · 3.5 · 4 · 4.5) |
| Flatline PRD review | `.run/flatline-prd-cycle-007.log` |
| BB design review | `.run/bridge-reviews/design-review-cycle-007.md` (+ parsed JSON) |
| Flatline SDD review | `.run/flatline-sdd-cycle-007.log` |
| Red Team SDD | `.run/redteam-sdd-cycle-007.log` (run id `rt-1778988389-8bf58521`) |
| Vision entries (5 captured) | `grimoires/loa/visions/entries/vision-001..005.md` |

---

---

## Flatline Sprint Review Integration (Phase 6 · 2026-05-17)

3-model Flatline (Opus + GPT-5.5 + Gemini-3.1-pro · 53% agreement · 113s · $0 cheval) returned 19 findings on the 743-line sprint plan: 4 HIGH_CONSENSUS + 7 DISPUTED (6 Opus=0 known empty per `feedback_multimodel_via_clis`) + 8 BLOCKERs (2 CRITICAL + 6 HIGH). All 18 actionable findings integrated below. 1 LOW (IMP-009 screenshot retention) deferred to cycle-close cleanup note. 1 strategic fork (SKP-002 SSE auth bootstrap) operator-resolved: **minimal cookie bootstrap** (HttpOnly + SameSite=Strict, no Secure flag for localhost).

### Integrated amendments

| ID | sev | amendment | sprint impact |
|---|---|---|---|
| IMP-001 (800) | HIGH | LoC budget arithmetic audit · updated table below (was missing +20 from T2.5 reader-tolerance fixture · running total off-by-one in earlier rows) | LoC table fixed below |
| **IMP-002 (885)** | CRITICAL | Operator-attestation **degraded/blocking path** explicit: if operator unavailable for S0/T0.2 mobile screenshot → T0.2 produces local PNG fixtures · S3 acceptance test uses byte-snapshot ONLY (no visual confirmation · SOFT-degraded gate) · S5 visual attestation slips to S8 E2E if operator-unavailable at S5 close · **S8 cycle close BLOCKS on operator mobile screenshot AND E2E paste-to-Loa test** (no degraded path for cycle-close itself) | new §"Operator Pair-Points" + S0+S3+S5+S8 acceptance amended |
| IMP-003 (800) | HIGH | Shared-file ordering note: `live/discord-render.live.ts` touched by S1/T1.3 (zone migration) + S3/T3.3 (figure-space + medium-aware constants). SEQUENCE: S1/T1.3 MUST complete BEFORE S3/T3.3. If S7/T7.1 also touches the file (check at S7 start), sequence: S1 → S3 → S7 OR explicit merge check | S1/T1.3 + S3/T3.3 acceptance: "no concurrent edits to discord-render.live.ts in flight" |
| IMP-004 (810) | HIGH | INV-13 schema-freeze enforcement: CI job diffs `.claude/data/trace-explain-output.schema.json` against git HEAD on main · ANY substantive change requires `schema_version` bump (regex check `"schema_version": "[0-9]+"`) · CODEOWNERS entry on schema file to operator | S4/T4.4 acceptance + CI workflow + CODEOWNERS extended |
| IMP-009 (480 DISPUTED LOW) | LOW | Screenshot retention: `.run/cycle-007-s0-t02-typography/*.png` cleanup task in S8 (gitignored or moved to cycle archive at sprint close) | S8 cleanup note (~1 line) |
| IMP-010 (840 DISPUTED) | HIGH | Runtime manifest test for INV-12 lint: T1.5 acceptance includes synthetic test that lint reads `.claude/data/voice-prompt-paths.json` dynamically (test runtime edits manifest · lint behavior changes accordingly) | S1/T1.5 acceptance amended |
| **IMP-011 (880 DISPUTED)** | CRITICAL | **Pair-points for operator-attested ACs**: 5 gates (S0/T0.2, S3-close, S5/T5.4, S8/T8.2, S8/T8.4). Each has (a) mechanical proxy test that runs autonomously, (b) HARD-or-SOFT classification, (c) explicit `operator-resume-on` instruction. `/run sprint-plan` halts at pair-points and surfaces for HITL. | new §"Operator Pair-Points" |
| **IMP-012 (910 DISPUTED)** | CRITICAL | Schema-file creation tasks ADDED. Referenced schemas without creation tasks: 4 files. Each creation is now an explicit task at: S0/T0.2 (`cycle-007-t02-decision.schema.json`), S1/T1.6 (`voice-prompt-paths.schema.json`), S2/T2.1 (`trace-envelope.schema.json` for INV-15), S4/T4.4 (`trace-explain-output.schema.json` for INV-13) | each task acceptance: "schema file created and committed" |
| IMP-013 (700 DISPUTED) | HIGH | S7 disjointness clarification: S7 touches ONLY `orchestrator/*.ts` files (import-statement migrations). S3 touches `live/discord-render.live.ts`. S2 touches `src/observability/*` + 5 writer files. S6 touches `deliver/sanitize.ts`. **Zero file overlap between S7 and S2/S3/S6** → safe to run parallel. Note added to S7 cross-cutting concerns. | S7 narrative updated |
| IMP-014 (760 DISPUTED) | HIGH | INV-to-task traceability table added at end of sprint plan · each of 18 INVs maps to specific sprint/task and acceptance gate | new §"INV Traceability Matrix" |
| IMP-015 (780 DISPUTED) | HIGH | Canary attestation gating: S8/T8.5 ledger flip BLOCKS until S8/T8.4 (production canary) attested. COMPLETED.md ARCHIVED marker BLOCKS until ALL of: T8.1 + T8.2 + T8.3 + T8.4 + canary post visible in test channel for ≥1 cron cycle without regression | S8 acceptance amended |
| **SKP-001/CRITICAL (850) XSS** | CRITICAL | `sanitizeForTerminal` does NOT close DOM XSS. Dashboard MUST use `.textContent` / `.innerText` for ALL streamed payload string values (NEVER `.innerHTML`). XSS test fixtures added: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `javascript:` URLs, SVG onload, attribute injection. `safe-render.ts` adds separate `sanitizeForBrowser(html: string)` HTML-escape function for any path that needs HTML rendering. | S4/T4.4 + S5/T5.4 acceptance amended |
| **SKP-001/CRITICAL (850) CODEOWNERS** | CRITICAL | CI signed-off-by check forgeable. **Move enforcement to GitHub branch protection + CODEOWNERS required-reviews** (operator one-time repo config: branch protection rule on main requires CODEOWNERS approval for `.claude/data/voice-prompt-paths.json`). CI keeps ONLY the mechanical monotonic check. Sprint plan adds operator-action: "configure GitHub branch protection before S1 close." | S1/T1.6 amended · new operator-action item |
| **SKP-002/HIGH (780+760) SSE auth bootstrap** | HIGH | **Operator-attested: minimal cookie bootstrap** (HttpOnly + SameSite=Strict cookie set on first GET / · EventSource uses `withCredentials: true` · cookie not in DevTools/proxy logs). Replaces `?token=` query param approach. ~25 LoC vs original ~10. | S5/T5.5 redesigned |
| **SKP-003/HIGH (720) Concurrent write interleaving** | HIGH | `appendTraceEntry` uses in-memory promise-chain mutex to serialize ALL writes within process · guarantees atomic line appends · ~15 LoC. NOT a file lock (still single-process invariant per FR-3 + IMP-003) · just sequencing async writes. | S2/T2.1 amended |
| **SKP-001/HIGH (720) S0/T0.2 Discord webhook channel verification** | HIGH | **Operator memory `feedback_env_channel_world_mismatch` (2026-05-16) confirms this risk** (DISCORD_CHANNEL_* may lie about guild). T0.2 spike script MUST call Discord API `GET /channels/{id}` BEFORE posting · assert `guild_id` matches explicit test-guild allowlist constant in script · refuse to post on mismatch with structured error. Promoted from SOFT to HARD precondition (T0.2 step 0). | S0/T0.2 amended |
| **SKP-007/HIGH (720) TS-AST lint scope** | HIGH | TS-AST lint scope acknowledged-incomplete: lint catches string-literal + template + char-code · MAY miss object property access (`config.zones["el-dorado"]`), runtime helper imports, JSON config data. Counter: defense-in-depth via SINK-side prompt-inspection tests at S2/S6 — fixtures construct kebab via various indirection patterns · assert final composed prompt to LLM gateway is kebab-free | S1/T1.5 acknowledgment + S6/T6.2 amended with SINK-side tests |

### Operator Pair-Points (IMP-011 critical · new section)

cycle-007 has 5 operator-pair-point gates where autonomous `/run sprint-plan` MUST halt and surface for HITL attestation:

| pair-point | sprint | HARD/SOFT | mechanical proxy (autonomous fallback) | operator gate |
|---|---|---|---|---|
| **PP-1** | S0/T0.2 close | SOFT | If `LOA_OPERATOR_UNAVAILABLE=1`: skip Discord POST · generate local PNG fixtures · decision-capture defaults `chosen_padding_char: ' '` (U+2007) | operator captures Android screenshots OR confirms "use fixtures · S3 mobile gate degraded" |
| **PP-2** | S3 close | SOFT | byte-snapshot test on rendered output (asserts U+2007 bytes at expected positions) passes mechanically | operator screenshots Discord Android post · confirms aligned column OR triggers fallback chain (U+2008 → U+00A0 → code-block) from T0.2 fallback_chain |
| **PP-3** | S5/T5.4 close | SOFT | visual regression fixture diff (checked-in PNGs) passes | operator visual-verifies 4-color encoding teachable in <3 min OR defers to S8/T8.2 E2E |
| **PP-4** | S8/T8.2 E2E | **HARD** | synthetic 5-layer fixture test passes mechanically (Loa-identifies-layer for 5 fixture rows) | operator pastes real trace row to Loa via chat · confirms Loa identifies layer-of-origin in 1 inference step · **BLOCKS cycle close** |
| **PP-5** | S8/T8.4 production canary | **HARD** | digest cron fires post-S3 · no regressions in monitoring | operator-attested Discord mobile screenshot of post-S3 production digest · **BLOCKS ledger flip** |

If operator unavailable at any pair-point: `/run sprint-plan` sets `state: PAUSED_HITL` in `.run/sprint-plan-state.json` · cycle-007 ledger entry `pair_point_pending: <PP-id>` · operator runs `/run-resume` after attestation. PP-4 and PP-5 are HARD (cycle-007 cannot close without them) · PP-1/2/3 have explicit SOFT-degraded paths.

### Updated LoC budget (post-Flatline-sprint amendments)

| sprint | net LoC | running total | delta from prior |
|---|---|---|---|
| S0 | 0 (auto-delete · spikes) + 15 (Discord API verify in T0.2) | 15 | +15 (SKP-001 Discord verify) |
| S1 | +280 (was 250 · +20 runtime manifest test IMP-010 + +10 schema creation IMP-012) | 295 | +30 |
| S2 | +200 (was 160 · +15 mutex SKP-003 + +25 trace-envelope schema IMP-012 + S2/T2.5 reader-tolerance) | 495 | +40 |
| S3 | +110 (unchanged) | 605 | 0 |
| S4 | +600 (was 560 · +25 XSS fixtures SKP-001/CRITICAL + +15 schema-freeze CI IMP-004) | 1205 | +40 |
| S5 | +445 (was 420 · +25 cookie auth + XSS textContent + safe-render extension) | 1650 | +25 |
| S6 | +75 (was 60 · +15 SINK-side prompt-inspection tests SKP-007) | 1725 | +15 |
| S7 | +10 (unchanged) | 1735 | 0 |
| S8 | +60 (was 50 · +10 canary gating IMP-015 + INV traceability matrix IMP-014) | 1795 | +10 |

**Total: ~+1795 net LoC** (vs PRD §10 estimate +1370 · +425 from all 4 quality-gate phases). Within tolerance for MEDIUM-to-LARGE cycle.

### INV Traceability Matrix (IMP-014 · new section)

| INV | source | enforcement task | acceptance gate |
|---|---|---|---|
| INV-1 (cycle-006) | substrate-presentation seam | S7/T7.2 audit script | `bash scripts/audit-substrate-presentation-seam.sh --strict-composer` exits 0 |
| INV-2 (cycle-006) | DeterministicEmbed no description | preserved · no new enforcement | compile-time |
| INV-3 (cycle-006) | orchestrator returns domain message type | S7/T7.1 migration | grep for `to*Payload` outside ports/ returns 0 |
| INV-4..11 (cycle-006) | preserved | inherited | unchanged |
| INV-12 (Flatline IMP-004) | no-kebab-zoneid lint | S1/T1.5 TS-AST lint (AC-RT-004) + S1/T1.6 manifest | `bun run lint:zone-source` exits 0 on PRs + CI integration + manifest schema valid |
| INV-13 (Flatline IMP-003+IMP-004) | trace:explain schema freeze | S4/T4.4 ajv schema validation + IMP-004 schema-freeze CI test + CODEOWNERS | ajv pass against fixture outputs · schema_version not silently changed · CODEOWNERS attests |
| INV-14 (BB HIGH-4) | sole JSONL append helper | S2/T2.4 audit script + appendTraceEntry type signature | `bash scripts/audit-jsonl-append-discipline.sh` exits 0 + type-check passes |
| INV-15 (RT AC-RT-005) | nested-key sanitizer | S2/T2.1 sanitizeNestedReservedKeys + S2/T2.2 test | nested-spoof test passes |
| INV-16 (RT AC-RT-001) | bearer-cookie + Host check | S5/T5.5 cookie auth + Host check | DNS-rebinding fixture returns 403 · auth flow test green · cookie set HttpOnly+SameSite=Strict |
| INV-17 (RT AC-RT-002) | manifest monotonic + CODEOWNERS | S1/T1.6 monotonic + GitHub branch protection (operator config) | `bash scripts/lint-manifest-monotonic.sh` exits 0 + GitHub config attested |
| INV-18 (RT AC-RT-003) | ANSI safe-render + DOM textContent | S4/T4.4 safe-render + S5/T5.4 textContent mandate + XSS fixtures | terminal-escape + XSS fixtures pass · no .innerHTML on payload strings |

### Operator one-time actions (before S1 close)

Per SKP-001/CRITICAL CODEOWNERS amendment, operator must complete BEFORE S1 close:

1. **GitHub branch protection rule on main**: require CODEOWNERS approval for changes to `.claude/data/voice-prompt-paths.json` AND `.claude/data/trace-explain-output.schema.json`.
2. **CODEOWNERS file** committed at S1 (this PR) listing `@zksoju` as owner for the 2 manifest/schema files.
3. **GitHub repo setting attested in COMPLETED.md** with screenshot evidence at S8.

If operator does not complete step 1 by S1 close: ledger entry `operator_action_pending: github_branch_protection: true` · S8 cycle-close BLOCKS until attested.

---

**Status**: candidate · POST Phase 6 Flatline sprint review (19 findings · 18 integrated · 1 LOW deferred · operator-attested 2026-05-17) · awaits Phase 7 `/run sprint-plan` autonomous implementation.
