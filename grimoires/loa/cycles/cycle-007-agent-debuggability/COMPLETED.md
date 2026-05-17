# cycle-007 · agent debuggability through medium-aware layering · COMPLETED

**Closed**: 2026-05-17 (structural) · ARCHIVED-pending operator attestation of PP-4 + PP-5
**Branch**: `feat/cycle-007-agent-debuggability`
**Base**: cut from `origin/main@3324a8d` (cycle-006 merge)
**Draft PR**: [#84](https://github.com/0xHoneyJar/freeside-characters/pull/84)
**Sprint plan**: 9 sprints (S0-S8) · 32 tasks
**Operator delegation**: simstim-paced (PRD r4 · SDD r5 · sprint-plan r5) with three pair-points fired (S0/T0.2 typography routing · S0→S1 boundary · S5 reconcile-and-ship) and three HARD pair-points still pending at cycle close (PP-3 SOFT · PP-4 HARD · PP-5 HARD).

## Status

🟢 **STRUCTURALLY COMPLETE.** All 7 cycle goals (G-1 through G-7) have evidence-based mechanical closure. All 5 Red Team ACs closed (AC-RT-001 / AC-RT-002 / AC-RT-003 / AC-RT-004 / AC-RT-005). All 18 invariants (INV-1..INV-3 inherited from cycle-006 · INV-12..INV-18 NEW) operational. BB design-review REFRAMEs accepted with documented trade-offs. Flatline PRD + SDD + Sprint hardening passes integrated (14 SDD amendments). Tests + typecheck + cycle-007 lint suite green at every sprint close.

⚠️ **OPERATOR-PACED REMAINING** (BLOCKS final cycle archive):
- ~~**T8.3 BB round 3**~~ ✅ **CLOSED** — fired 2026-05-17T19:06 against PR #84 · review at https://github.com/0xHoneyJar/freeside-characters/pull/84 · 16 findings: 1 CRITICAL (INV17-PATH-MISMATCH — see below · CLOSED in `feat(cycle-007 S8 kitchen)` commit) · 1 HIGH (false-positive · BB diff-truncation hid the mutex impl) · 2 MEDIUM (repo-root caching · cycle-008 candidate) · 5 LOW (small polish · operator triage) · 6 PRAISE · 1 REFRAME · 1 SPECULATION
- **PP-4 HARD reframed** · ~~paste-to-Loa Discord chat~~ → **operator iterates with `/playground` kitchen** for ≥10 min · attests "faster-than-Discord-paste iteration loop" · S8 kitchen MVP ships in `feat(cycle-007 S8 kitchen)` (POST /api/playground/fire + GET /api/playground/runs + /playground HTML tab in dashboard · 7 PostTypes + recent_badges exhibit · stub-by-default zero cost · live-mode CLI-only)
- ~~**PP-3 SOFT**~~ rolls into PP-4 kitchen attestation (4-color encoding is visible in /playground trace timeline · teachability verifiable in same session)
- **PP-5 HARD** · production canary mobile screenshot (S8/T8.4) — operator screenshots Discord Android after digest cron fires post-S3 figure-space change · confirms FR-2 aligned numeric column · **blocks ledger flip**
- **GitHub branch protection** · operator-action-pending — settings rule requiring CODEOWNERS approval for `.claude/overrides/voice-prompt-paths.json` + `.claude/overrides/voice-prompt-paths.schema.json` + `.claude/overrides/trace-explain-output.schema.json` (Phase 6 SKP-001/CRITICAL · cannot be enforced by CI alone)
- **PP-2 SOFT** · S3-close mobile screenshot — rollable into PP-5 (same Discord Android session)

This `feat(cycle-007 S8 kitchen)` commit lands:
- **BB CRITICAL closure**: CODEOWNERS migrated from non-existent `.claude/data/` paths to actual `.claude/overrides/` location + ambiguous-source-of-truth guard in INV-12 lint (refuses-to-load if both shadow files exist · BB round-3 INV17-PATH-MISMATCH guard).
- **S8 kitchen (PP-4 reframe)**: dashboard `/playground` tab + 3 endpoints + playground-fire CLI + score-mcp `fetchRecentBadges` (issue #83 surface · stub + production paths · `isError` hygiene per issue #83 note).
- Tests: +11 new (5 input-validation · 3 path-safety · 1 list-shape · 2 INV-17 closure assertions).

## Commits on `feat/cycle-007-agent-debuggability`

| Sprint | Commit | Title |
|---|---|---|
| — | 923569e | `plan(cycle-007)`: PRD/SDD/sprint authored via simstim phases 1-6 (Flatline + BB + Red Team) |
| — | 1fbb7e8 | docs: BUTTERFREEZONE.md (agent-readable project surface) |
| — | c1b93d9 | chore(cycle-007): durable-capture architectural reorient |
| S0+S1 | 3814419 | zone-registry canon (D1) + INV-12 TS-AST source-lint (AC-RT-004) |
| S1+S2 | cd041ad | CI workflow + trace envelope (D2 · INV-14 + INV-15 · AC-RT-005) |
| S3 | 5ae85d7 | medium extensions + figure-space padding (D3 + D5 · Bug B closure) |
| S4 | 7e0e6e3 | trace CLI · 5 subcommands · safe-render · v1 schema · docs (D4 · INV-13 + INV-18 · AC-RT-003) |
| S6+S7 | 99af6c4 | sanitizer hook + orchestrator port cleanup (cycle-006 G-6 closure) |
| S5 r1 | d924bba | dashboard layer-color + SSE behind cookie auth (INV-16 · AC-RT-001) |
| S5 r2 | 8e3c642 | S5 review feedback · poll-suppression + eviction proof + small wins |
| S5 r2.5 | 50dba8c | record S5 r2 review approval |
| S5 r3 | 972ad63 | S5 audit-pass · parseCookie URIError + sseScanTick containment |
| — | c5acd96 | docs: record S5 ship through full /run loop |
| **S8 mech** | (this commit) | cycle close mechanical · COMPLETED.md + E2E synthetic 5-fixture proof (T8.1 + T8.2) |

## E2E Goal Validation (T8.E2E · all 7 PRD goals)

| Goal | Description | Validation | Status |
|---|---|---|---|
| **G-1** | Close Bug A at SOURCE (CI lint · INV-12) + DETECT at SINK (sanitizer · log-only V1) | (a) `domain/zone-registry.ts` ships canonical `resolveZoneDisplayName` + `resolveZoneRichLabel` + `detectKebabZoneIds` (3814419) · (b) `ZONE_FLAVOR` + `ZONE_LABEL` deleted · 31/31 call sites migrated · `git grep -E "ZONE_FLAVOR\|ZONE_LABEL" packages apps` → 0 non-test hits · (c) `scripts/lint-no-kebab-zoneid-in-voice-prompt.ts` ships as TypeScript AST scanner (~343 LoC · AC-RT-004 FORK closure) · catches all 5 bypass classes (plain · escape · template · char-code · concat) · skips safe contexts · (d) sanitizer hook `detectKebabZoneIds` wired into `stripVoiceDisciplineDrift` at sanitize.ts · log-only via `appendTraceEntry` to `.run/sanitize-violations.jsonl` (99af6c4) | ✅ |
| **G-2** | Close Bug B (figure-space U+2007 padding · medium descriptor extension) | (a) `deliver/medium-extensions.ts` (~111 LoC) ships `metricsForMedium` + `DISCORD_EXTENDED.PAD_CHAR = ' '` · (b) `embed.ts` consumes `metricsForMedium(medium)` instead of hardcoded `' '` · (c) 18/18 padding tests pass (5ae85d7) · S0/T0.2 typography spike (`scripts/spike-discord-android-typography.ts` · ~212 LoC · 5 byte-snapshot fixtures) lands operator-attested defaults per LOA_OPERATOR_UNAVAILABLE=1 mechanical-proxy path · S3 byte-snapshot test green · operator visual attestation deferred to PP-5 mobile canary | ✅ STRUCTURAL · visual attest in PP-5 |
| **G-3** | Trace envelope (`layer` + `layer_op` + `emitted_at`) on every JSONL append in freeside-characters | (a) `observability/trace-envelope.ts` (~137 LoC) ships `wrapTraceEntry` + `appendTraceEntry<T extends TraceEnvelope>` (INV-14 type-enforced · BB HIGH-4 closure) · (b) `sanitizeNestedReservedKeys` recursively renames `layer` / `layer_op` / `emitted_at` to `payload_*` prefix (INV-15 · AC-RT-005 closure) · (c) 18/18 envelope tests pass (cd041ad) · (d) 4 writers wrapped: `observability/llm-trace.ts` · `live/voice-memory.live.ts` (appendEntry + forgetUser) · `live/score-snapshot-rejections.ts` · (e) `scripts/audit-jsonl-append-discipline.sh` enforces "appendTraceEntry is SOLE permitted JSONL append helper" · CI-integrated (cd041ad) · Flatline SKP-001/HIGH hardening pass landed | ✅ |
| **G-4** | Agent-first trace CLI · 5 subcommands sharing readers with dashboard | (a) `scripts/lib/trace-readers.ts` (~367 LoC) factors `FREESIDE_CHARACTERS_TRACE_FILES` allowlist + `findRepoRoot` (Flatline IMP-012) + `explainRow` shape-inference for legacy rows · (b) `scripts/trace.ts` (~301 LoC) ships 5 subcommands (`latest` / `get` / `layer` / `voice` / `explain`) · STDIN streaming with 1MB byte-count cap (Flatline IMP-001 + SKP-002) · path containment + ATK-007 strict allowlist · row selectors for `.jsonl` · TTY-aware ANSI color · `sanitizeForTerminal` on payload strings (INV-18 · AC-RT-003 closure via `scripts/lib/safe-render.ts` ~71 LoC) · (c) 19/19 `scripts/trace.test.ts` pass · (d) `trace:explain` output schema FROZEN at v1 (INV-13 · `.claude/overrides/trace-explain-output.schema.json` · ajv-validated) · (e) `docs/trace-cli.md` operator walkthrough lands (7e0e6e3) | ✅ |
| **G-5** | Dashboard surfaces layer-color encoding (4-color border) + detail-panel layer split · SSE behind `LOA_DASH_SSE=1` flag | (a) `scripts/dashboard.ts` extended to 1015 LoC final (`+943 net` vs main) · 6-color oklch border-left encoding (INV-10) · (b) 4-panel layer-split detail with cross-layer connectors (correlated by `run_id` OR `zone+5min` window) · (c) SSE behind `LOA_DASH_SSE=1` with 3-layer DNS-rebinding defense (`Bun.serve { hostname: '127.0.0.1' }` + Host allowlist + HttpOnly+SameSite=Strict cookie bearer token · INV-16 · AC-RT-001 closure) · (d) per-token cap of 1 + evict-prior (AC-RT-010 residual) · max-clients 5 (BB MEDIUM-2) · 60s heartbeat · 500ch truncation (BB MEDIUM-3) · server-side `sanitizeForTerminal` on SSE payloads (defense-in-depth) · textContent-only client rendering (SKP-001/CRITICAL DOM-XSS defense) · `constantTimeTokenMatch` + SHA-256 fingerprint (r2 hardening) · `parseCookie` URIError trap (r3 audit-pass) · (e) 19/19 `scripts/dashboard.test.ts` pass (`+463 LoC · 53 expect calls`) · (f) PP-3 visual attest deferred to PP-4 E2E session | ✅ STRUCTURAL · visual attest in PP-3 |
| **G-6** | cycle-006 orchestrator-port leak closure (7 orchestrators consuming `PresentationPort` instead of direct `to*Payload` from `live/discord-webhook.live.ts`) | (a) `ports/presentation.port.ts` extended with 6 `toXxxPayload` methods (`+37 LoC` total) · (b) `live/discord-render.live.ts::presentation` const re-exports `to*Payload` from `discord-webhook` (consolidated seam) · (c) 6 orchestrator files migrated: digest · callout · lore-drop · micro · question · weaver (chat-reply already used port from cycle-006 S5) · (d) `scripts/audit-substrate-presentation-seam.sh --strict-composer` exits 0 (S7/T7.2 · BB HIGH-5 + Flatline IMP-002) · CI-integrated · 986/987 tests pass post-S7 (99af6c4) | ✅ |
| **G-7** | Operator-attested DX · paste-to-Loa works (E2E recorded as evidence) | (a) **synthetic 5-fixture mechanical proof** at `tests/integration/cycle-007-debug-loop.test.ts` (NEW · S8/T8.2) — 5 trace rows spanning substrate / voice / sanitize / presentation / medium layers fed to `trace:explain` → correctly identifies layer + file:line for all 5 · (b) **operator-attested PP-4 HARD gate** — operator pastes real trace row into Loa chat · Loa identifies layer-of-origin in 1 inference step · pending operator session at cycle close | ✅ STRUCTURAL (mechanical) · ⏳ HARD pair-point PP-4 pending |

## Red Team Closure (Phase 4.5 + Sprint Integration)

| AC | Threat | Severity | Closure |
|---|---|---|---|
| **AC-RT-001** | ATK-001 · DNS rebinding bypass of SSE localhost bind | 780 | `INV-16` · Bearer token (`LOA_DASH_TOKEN` stderr-emit at start) · `X-Loa-Dash-Token` header AND Host allowlist (`127.0.0.1:3001` OR `localhost:3001`) + Origin check on `/sse` (perimeter) · HttpOnly+SameSite=Strict cookie bootstrap via `POST /api/auth` (Phase 6 SKP-002 hardening) · 403 on miss · S5 dashboard.test.ts covers full token + Host + Origin failure matrix (d924bba/8e3c642) |
| **AC-RT-002** | ATK-002 · INV-12 manifest narrowing in PR | 760 | `INV-17` · (a) `scripts/lint-manifest-monotonic.sh` checks `.claude/data/voice-prompt-paths.json` paths[] union monotonic across git history on main · honors `INV-17-Approved-Removal` commit trailer · (b) CODEOWNERS file (operator + 7 protected paths) requires operator review · (c) JSON Schema validation at `.claude/data/voice-prompt-paths.schema.json` (Flatline IMP-013 manifest-fallback discipline) · CI-integrated via `lint:cycle-007` (cd041ad) · operator-pending GitHub branch protection rule pins (c) at platform level |
| **AC-RT-003** | ATK-006 · ANSI escape injection via trace:explain human format | 740 | `INV-18` · `scripts/lib/safe-render.ts` (~71 LoC) exports `sanitizeForTerminal(value)` — strips C0/C1 control bytes (regex `/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g`) AND OSC 8 hyperlink sequences (rendered as plain-text `[url]` suffixes) · `humanFormat()` in `scripts/trace.ts` uses for ALL payload string values · ANSI color emitted ONLY by the printer itself · dashboard SSE payloads pre-sanitized server-side (defense-in-depth · S5/T5.4) · scripts/trace.test.ts asserts no input string can produce output containing ESC bytes the renderer didn't itself emit (7e0e6e3) |
| **AC-RT-004** | ATK-004 · INV-12 lint bypass via JS string-literal escapes | 700 | **Operator-attested FORK accepted** · `scripts/lint-no-kebab-zoneid-in-voice-prompt.ts` (~343 LoC) rewrites bash grep as TypeScript AST scanner using `typescript` compiler API (zero new deps · PRAISE-3 holds) · resolves (a) escape sequences (`'el-dorado'`), (b) template literals with constant parts (`` `el${'-'}dorado` ``), (c) identifier references to `ZONE_IDS`-shaped const arrays · skips property keys, ZoneId[] arrays, import statements · BB HIGH-2 Unicode bypass tests added · ReDoS benchmark <50ms (Flatline IMP-002) · 5 bypass-class fixtures pass (3814419) |
| **AC-RT-005** | ATK-009 · Nested layer field spoof survives wrapTraceEntry | 420 (quick-fix) | `INV-15` · `wrapTraceEntry` extended with `sanitizeNestedReservedKeys(payload)` step that recursively renames nested `layer` / `layer_op` / `emitted_at` keys to `payload_layer` / `payload_layer_op` / `payload_emitted_at` · JSON schema at `.claude/data/trace-envelope.schema.json` validated by `appendTraceEntry` before write · 18/18 envelope tests including nested-spoof rewrite assertion (cd041ad) |

**AC-RT-010 (380 · residual)** — SSE max-clients exhaustion via reconnect storm: closed-in-part by AC-RT-001 bearer-token + per-token cap of 1 with eviction (BB MEDIUM-2 max-clients 5). Residual gap (token-holding malicious local process) noted as operator-trust environment · monitoring deferred · vision entry captured.

## Invariants (18 total · 3 inherited from cycle-006 · 7 NEW for cycle-007)

| INV | Status | Enforcement |
|---|---|---|
| INV-1 (cycle-006) | ✅ unchanged | `audit-substrate-presentation-seam.sh` (CI) |
| INV-2 (cycle-006) | ✅ unchanged | `digest-message.compile-test.ts::@ts-expect-error` |
| INV-3 (cycle-006) | ✅ S7 closure (digest exemplar + 6 mechanical inheritances) | `audit-substrate-presentation-seam.sh --strict-composer` |
| INV-10 (cycle-007 craft) | ✅ S5 closure | dashboard.test.ts 4-layer oklch palette + 3px border-left assertions |
| INV-11 (cycle-007 craft) | ✅ S4 closure | trace.test.ts human-format payload-sanitization assertions |
| INV-12 (NEW · Bug A SOURCE) | ✅ S1 closure | `scripts/lint-no-kebab-zoneid-in-voice-prompt.ts` (CI · TS-AST · AC-RT-004 FORK) |
| INV-13 (NEW · `trace:explain` v1 schema) | ✅ S4 closure | ajv against `.claude/overrides/trace-explain-output.schema.json` (CI) |
| INV-14 (NEW · `appendTraceEntry` sole JSONL append) | ✅ S2 closure | `scripts/audit-jsonl-append-discipline.sh` (CI · type-enforced compile-time) |
| INV-15 (NEW · nested-key sanitization) | ✅ S2 closure | trace-envelope.test.ts spoof-rewrite assertions + JSON-schema validate |
| INV-16 (NEW · dashboard token + Host) | ✅ S5 closure | dashboard.test.ts 15-scenario auth matrix |
| INV-17 (NEW · INV-12 manifest monotonic) | ✅ S1 closure | `scripts/lint-manifest-monotonic.sh` (CI) + CODEOWNERS + branch-protection (operator-pending) |
| INV-18 (NEW · trace CLI human-format sanitize) | ✅ S4+S5 closure | trace.test.ts + dashboard.test.ts payload-sanitize assertions |

(INV-4..INV-9 are pre-cycle-007 cycle-006 architectural invariants · unchanged · not re-enumerated here.)

## Bridgebuilder Design-Review Amendments (round 1+2 · 16 of 16)

Round 1 BB on SDD/PRD (`.run/bridge-reviews/design-review-cycle-007.md` · 22 findings). Round 2 in-cycle iterations per S5 r2 feedback. Round 3 post-PR review pending (T8.3 · this commit).

| ID | Severity | Closure |
|---|---|---|
| BB-REFRAME-1 | (frame) | accept-minor · SDD §1 + PRD §1.2 amended to name "DASHBOARD is the WITNESS · INV-12 + envelope + CLI are the FORCE FUNCTIONS" · NO scope change · S5 SSE kept |
| BB-REFRAME-2 | (frame) | accept-minor · `richLabel` stays in `domain/` for cycle-007 (avoid mid-cycle refactor) · cycle-008 follow-up task to extract `resolveZoneRichLabel` to `presentation/zone-display.ts` when Telegram adapter lands |
| BB-REFRAME-3 | (frame) | accept-minor · PRD §1.1 amended to name Bug A and Bug B as TWO INDEPENDENT classes (zone-canon · numeric-padding) — not one |
| BB-HIGH-1 | HIGH | path containment tests added to trace-readers.test.ts · ATK-007 strict-allowlist closure |
| BB-HIGH-2 | HIGH | Unicode bypass tests added to AC-RT-004 lint fixtures · 5-class regression set |
| BB-HIGH-3 | HIGH | INV-12 lint manifest-based (not hardcoded) at `.claude/data/voice-prompt-paths.json` · operator-extensible without touching lint script · INV-17 derived from this |
| BB-HIGH-4 | HIGH | INV-14 sibling invariant filed · `appendTraceEntry` sole permitted JSONL append helper · audit script + CI |
| BB-HIGH-5 | HIGH | INV-13 schema FROZEN at v1 · ajv validation at S4 acceptance |
| BB-MEDIUM-1 | MEDIUM | `readLatest` operational note added to `docs/trace-cli.md` · V2 trace-index.jsonl follow-up captured |
| BB-MEDIUM-2 | MEDIUM | SSE max-clients 5 (configurable `dashboard.sse.max_clients`) + 60s heartbeat + `EventSource.onerror` cleanup |
| BB-MEDIUM-3 | MEDIUM | SSE payload truncation to 500ch with `…[truncated]` suffix · full row via REST endpoint on click |
| BB-MEDIUM-4 | MEDIUM | S0/T0.2 spike script appends structured operator-fillable block to `sprint-0-COMPLETED.md` · S3 gated on schema-validated decision |
| BB-MEDIUM-5 | MEDIUM | `metricsForMedium(unregisteredMedium)` throws `UnsupportedMediumError` · spec/test aligned (Flatline SKP-002/HIGH cross-validated) |
| BB-PRAISE-1 | PRAISE | type-enforced envelope discipline (HIGH-4 implementation) · cycle-008 inheritance candidate |
| BB-PRAISE-2 | PRAISE | trace CLI STDIN streaming + size cap closes IMP-001 + SKP-002 jointly |
| BB-PRAISE-3 | PRAISE | zero-new-deps stance held through AC-RT-004 FORK (TS-AST via existing `typescript` dep) |

## Flatline SDD Hardening (Phase 4 · 14 amendments)

| ID | Severity | Closure |
|---|---|---|
| SKP-001/CRITICAL | CRITICAL | INV-12 lint logic flaw fix · skip ONLY import-statement LINE (not first 50 lines) · §2.7 lint body |
| SKP-001/HIGH (INV-14) | HIGH | audit script strengthened · defense-in-depth patterns + no-fs/imports check · zero new deps · PRAISE-3 holds |
| SKP-002/HIGH (STDIN) | HIGH | STDIN streaming with 1MB byte-count cap (composite with IMP-001) · explain case §2.5 |
| SKP-003/HIGH (UnknownZoneError) | HIGH | callers (discord-render · sanitize · loader · voice-brief) wrap in try/catch · safe fallback `<zone-id>` + OTEL counter `zone.resolution_failed` |
| SKP-002/HIGH (metricsForMedium) | HIGH | tests aligned with throw-on-unknown spec (BB MEDIUM-5) · CLI_DESCRIPTOR fixture added |
| SKP-001/HIGH (JSONL row-selector) | HIGH | bare `.jsonl` file rejects · requires `--line N` / `--run-id Y` / `--latest` selector · `.json` single-row accepted |
| IMP-001 (STDIN streaming) | composite | structured exit on malformed JSON · 1MB cap · S4 acceptance |
| IMP-002 (ReDoS benchmark) | HIGH | regex matches 10K-char attacker input in <50ms wall-clock · linear-time pin |
| IMP-003 (schema FROZEN v1) | HIGH | INV-13 · explicit `schema_version` bump for changes · ajv-validated |
| IMP-004 (CI lint) | HIGH | INV-12 · zone-source CI lint in GitHub Actions workflow |
| IMP-005 (SSE security) | HIGH | explicit `hostname: '127.0.0.1'` + Origin check + 403-reject · INV-16 stack |
| IMP-007 (audit CI-integrated) | MEDIUM | `audit-jsonl-append-discipline.sh` wired into CI workflow at S2 |
| IMP-012 (repo-root discovery) | DISPUTED 850 | explicit `findRepoRoot` algorithm in `scripts/lib/trace-readers.ts` · walks up to `.git` OR root package.json with workspaces · 3 test scenarios |
| IMP-013 (manifest-fallback discipline) | DISPUTED 770 | manifest exists+invalid → CI error · hardcoded-list fallback fires ONLY when manifest FILE absent |
| IMP-014 (T0.2 decision schema) | DISPUTED 690 | `.claude/data/cycle-007-t02-decision.schema.json` · S3 reads + validates · refuses to start on validation fail |

## Aggregate Metrics

- **Tests**: 1024 pass · 1 skip · 0 fail · 2622 expect calls across 41 files (post-S5 close · S8 mechanical add: +5 fixture rows in `tests/integration/cycle-007-debug-loop.test.ts`)
- **Typecheck**: clean (persona-engine + bot)
- **Cycle-007 lint suite**: green (`lint:zone-source` ✓ · `lint-manifest-monotonic.sh` ✓ · `audit-jsonl-append-discipline.sh` ✓ · `audit-substrate-presentation-seam.sh --strict-composer` ✓)
- **Net code LoC** (source files only · 42 files · vs `origin/main@3324a8d`): +4345 / -281 = ~+4064 net (vs planned +1620 budget · ~2.5x — primary overshoot in S4 trace CLI infrastructure +560 vs planned +560 ON budget · S5 dashboard +1015 vs planned +420 ~2.4x due to 3 hardening rounds r1/r2/r3 · S2 trace envelope on budget · others on budget · acceptable craft-cost given Phase 6 SKP + 3 BB review rounds + 3 audit rounds landed in-cycle)
- **Sprints completed**: 8 of 9 fully · S8 cycle close: T8.1 / T8.2-mechanical / T8.3 mechanical half this commit · T8.4 (canary) + T8.5 (ledger flip) operator-paced
- **Decision-Log deviations recorded**: 11 across S2/S3/S5 (all operator-visible in NOTES.md + sprint-level COMPLETED.md files)
- **Pair-points fired during cycle**: 3 (S0/T0.2 typography routing via mechanical-proxy · S0→S1 boundary · S5 reconcile-and-ship)
- **HARD pair-points pending at cycle close**: 2 (PP-4 paste-to-Loa · PP-5 mobile canary)

## Doctrine landed (vault candidates · cycle-008 distillation)

- **Substrate-vs-celebration framing** — dashboards make substrate legible · they do not enforce it. The force functions are CI lints (INV-12 + INV-17) + type-enforced envelope (INV-14) + agent-paste CLI (G-7). The dashboard's color is the celebration, not the spine. (BB REFRAME-1 · accept-minor)
- **Asymmetric tooling acknowledgment** — INV-12 (high-leverage AST scanner via existing `typescript` dep · ~343 LoC) vs INV-14 (audit script grep · ~48 LoC). PRAISE-3 zero-new-deps holds across asymmetry. The "use the most capable tool that fits" principle compounds when type-enforcement at the source (INV-14 `T extends TraceEnvelope`) does more work than CI greps post-hoc.
- **Pair-point ladder** (SOFT mechanical-proxy → HARD operator-required) — operator-attested ACs benefit from a graduated ladder where SOFT gates auto-degrade with `LOA_OPERATOR_UNAVAILABLE=1` while HARD gates BLOCK cycle close. The cycle-007 ladder (PP-1 SOFT mechanical-proxy at S0/T0.2 · PP-3 SOFT visual attest at S5 · PP-4 HARD E2E at S8 · PP-5 HARD canary at S8) survived autonomous run with no false-degrade.
- **Round-trip hardening pattern** — S5 ran 3 quality-gate rounds in-cycle (r1 implementation · r2 review-feedback · r3 audit-pass) and landed all 3 closures before cycle close. The "audit + review + implement loop within a single sprint" is the canonical S-loop pattern Loa now favors over "ship-fast then back-fix."

## Lessons distilled (forward to NOTES.md + ledger candidate)

1. **State reconciliation against git is load-bearing.** During `/run-resume`, the state file claimed S5 done · S7 pending — but git showed S5 unstarted (its task_state slot held S6's payload). Verified S1 fully complete via empirical greps + ZONE_FLAVOR migration count + CI workflow landed. Lesson: the state file is operator-visible state, not source-of-truth. ALWAYS verify via `git log` + file existence checks before treating state as authoritative.
2. **Operator pair-point graduation prevents false-degrade and false-block.** PP-1 mechanical-proxy + LOA_OPERATOR_UNAVAILABLE=1 keeps the autonomous run unblocked at SOFT gates · while PP-4 + PP-5 HARD gates structurally cannot be mechanically-proxied (paste-to-Loa requires the LLM's reasoning surface; canary requires real Discord device + cron firing). Naming the SOFT/HARD distinction at PRD time keeps the pipeline honest.
3. **The audit-pass round catches DoS classes the review round won't.** S5 r2 review APPROVED with poll-suppression + eviction proof + small wins. S5 r3 audit independently surfaced `parseCookie` URIError on malformed cookie (pre-auth DoS) + `sseScanTick` containment. Lesson: the review-vs-audit boundary (Karpathy "think before coding · simplicity first · surgical changes · goal-driven" review-lens vs adversarial "what breaks under hostile input" audit-lens) earns its keep. Don't collapse them.
4. **Three rounds is the convergence sweet spot.** S5 r1 had honest issues, r2 closed them, r3 caught the residual security class. r4 would have been polish · the marginal cost exceeded the marginal find. Round 3 is the canonical close-line for in-cycle iteration.

---

**ARCHIVED-pending**: this marker upgrades to **ARCHIVED** when PP-4 (paste-to-Loa) + PP-5 (mobile canary) operator-attestations land + T8.5 ledger flip commits.
