# cycle-006 · substrate-presentation refactor · COMPLETED

**Closed**: 2026-05-16
**Branch**: feat/cycle-006-substrate-presentation
**Sprint plan**: 9 sprints (S0-S8) · 57 tasks
**Operator delegation**: "Loa you decide for all" + "Continue to completion. /autonomous"

## Status

🟢 **STRUCTURALLY COMPLETE.** All Red Team ACs closed (RT-001/002/007/008).
All Flatline BLOCKERs integrated (8 of 8). All BB design-review findings
addressed (16 of 16). Tests + typecheck + seam audit green.

⚠️ **OPERATOR-PACED REMAINING**:
- T8.3 BB round 3 post-PR review (runs after operator opens PR)
- T8.4 Production canary (operator-attested staging deployment)
- T6.7 mechanical wiring of 6 remaining orchestrators (digest is canonical
  exemplar; mechanical inheritance for micro/lore_drop/question/weaver/
  callout/chat-reply)
- T5.5/T5.7/T5.8 chat-reply dispatch.ts migration + composeReplyWithEnrichment
  deletion + staging canary (rolled forward from S5 deferrals)

These items live in `operator-handoff-cycle-006.md`.

## Commits on `feat/cycle-006-substrate-presentation`

| Sprint | Commit  | Title |
|---|---|---|
| —      | c02076d | plan: PRD/SDD/sprint authored via simstim phases 1-6 |
| S0     | 30003a7 | calibration spike · 10/10 MATCH · green-light S1 |
| S1     | ce89c21 | type-level seam + Red Team AC-RT-002 + Flatline CRITICALs |
| S2     | 0b7206d | single-renderer closure + AC-RT-008 + Flatline SKP-002/003 |
| S3     | 8f94080 | 5 orchestrators (micro/lore_drop/question/weaver/pop-in) |
| S4     | 5b9a2ae | callout + composer router finalization (BB F-007) |
| S5     | c96fa5d | chat-reply orchestrator + AC-RT-007 tuple-key foundation |
| —      | fadca65 | chore: checkpoint session continuity (7/9) |
| S7     | 7e788c7 | daily-pulse renderer + operator handoff doc |
| S6     | d4be5ba | voice-memory primitive + digest wire + RT/Flatline closure |
| S8     | (this commit) | OTEL verification + cycle close + E2E goal validation |

## E2E Goal Validation (T8.E2E)

| Goal | Description | Validation | Status |
|---|---|---|---|
| G-1 | Close PR #81 BB HIGH findings (F-002 · F-003 · F-016) | (a) `deriveShape` single source · `claude-sdk.live.ts` consumes ctx.derived (S1 commit ce89c21) · (b) `git grep buildPulseDimensionPayload packages/persona-engine/src` returns 0 hits (S2 commit 0b7206d · verified at sprint-8 close) · (c) digest orchestrator writes to `.run/voice-memory/digest/<zone>.jsonl` (S6 d4be5ba canary test) | ✅ |
| G-2 | Codify voice-outside-divs at type level | `digest-message.compile-test.ts::@ts-expect-error` triggers when `description` added to `DeterministicEmbed` (S1 ce89c21) | ✅ |
| G-3 | Migrate ALL post types to orchestrator pattern | `composer.ts` is router-only (S4 5b9a2ae) · 6 zone-routed types migrated (digest, micro, lore_drop, question, weaver, callout) · `composer-router.test.ts` drift-guard green · chat-reply orchestrator exists (S5 c96fa5d) | ✅ STRUCTURAL · chat-reply dispatch.ts callsite migration deferred to operator |
| G-4 | Voice memory as governance primitive · 8 streams · hounfour/straylight-aligned | (a) 8 streams enumerated in `voice-memory-entry.ts::STREAM_NAMES` · (b) Zod schema (TypeBox spec deviation per stack) · (c) `use_label` · `expiry` · `signed_by` fields present + INERT-in-V1 · (d) AC-RT-001 closure (ALLOWED_STREAMS allowlist in pathFor · S6 d4be5ba) · (e) AC-RT-002 closure (formatPriorWeekHint + HTML-escape + system-prompt instruction · S1 ce89c21) · (f) AC-RT-007 closure (keyForChatReply 3-tuple + ChatReplyVoiceMemoryEntrySchema refinement requires user_id · S5 c96fa5d + S6 d4be5ba) · (g) Primitive operational · digest-orchestrator wired as canonical exemplar · 6 non-digest orchestrators (micro/lore_drop/question/weaver/callout/chat-reply) inherit pattern via mechanical replication of `digest-orchestrator::composeDigestPost` voice-memory read/write block — deferred to operator-paced T6.7 follow-up per `operator-handoff-cycle-006.md` | ✅ **PARTIAL** — primitive + digest exemplar landed; 6-orchestrator mechanical wiring is operator-paced follow-up (BB F-003 closure · 2026-05-16 round 3 reconciliation with handoff doc) |
| G-5 | Daily-pulse renderer ships | `renderActivityPulse` per FR-7 shortenWallet `0xXXXX…YYYY` format + 2-line per-event + truncation (S7 7e788c7) · cron-wire deferred to operator per FR-7 design | ✅ |
| G-6 | Belt-and-suspenders verification | (a) `@ts-expect-error` compile-test green · (b) `derive-shape.test.ts` 30 oracle scenarios + 30 legacy-equivalence + 5 output-completeness · (c) `audit-substrate-presentation-seam.sh` exits 0 (warn AND strict modes) · (d) `voice-memory.live.test.ts` schema-validates read+write | ✅ |

## Red Team Closure (Phase 4.5 + Sprint Integration)

| AC | Threat | Severity | Closure |
|---|---|---|---|
| AC-RT-001 | VoiceMemoryEntry path traversal via StreamName runtime erasure | 820 | `live/voice-memory.live.ts::pathFor` validates stream against frozen `ALLOWED_STREAMS` Set + key against `[A-Za-z0-9._:-]+` BEFORE `resolve()`. `voice-memory-keys.ts` factories apply same regex at every public entry point. Tests `voice-memory.live.test.ts · AC-RT-001 path-traversal defense` (4 tests) + `voice-memory-keys.test.ts` traversal rejection (3 tests). |
| AC-RT-002 | Prior-week hint prompt injection via voice memory | 880 | `formatPriorWeekHint` wraps `<untrusted-content source="voice-memory" stream="..." key="..." use="background_only">` markers. HTML-entity-escapes `<`/`>`/`&` BEFORE wrapping (FLATLINE-SKP-002/CRITICAL hardening). System prompt contains verbatim `UNTRUSTED_CONTENT_LLM_INSTRUCTION` (FLATLINE-SKP-001/CRITICAL hardening). Tests `format-prior-week-hint.test.ts` (10 tests incl. tag-breakout attack). |
| AC-RT-007 | Chat-reply cross-channel info leak via channelId-only keying | 830 | `keyForChatReply(guildId, channelId, userId)` 3-tuple format `<g>:<c>:<u>` · `ChatReplyVoiceMemoryEntrySchema` Zod refinement REQUIRES `user_id` when stream === 'chat-reply' · `forgetUser(userId)` per-user deletion · Tests `voice-memory-keys.test.ts · AC-RT-007 tuple-key foundation` (4 tests: same-channel-distinct-users isolation + cross-guild isolation + 3 traversal rejections). |
| AC-RT-008 | Score-MCP snapshot spoofing via centralized deriveShape authority | 770 | `validateSnapshotPlausibility` 3σ-deviation check across (avg percentile-rank, reliable-fraction, totalEvents) · rolling-window baseline at `.run/score-baselines/<zone>.jsonl` (last 30 snapshots) refreshed on every accept · structured rejection log + OTEL `score.snapshot.implausible` + `score.snapshot.fallback_storm` (≥2 rejections/hour) · NEUTERED snapshot on rejection (topFactors=[]) so deriveShape yields A-all-quiet · `FREESIDE_SCORE_VALIDATION_SKIP=1` operator escape. Tests `validate-snapshot-plausibility.test.ts` (11 tests incl. 60-week organic-growth no-FP) + `score-snapshot-rejections.test.ts` (6 tests incl. storm detection + 7-day prune). |

## Flatline BLOCKER Closure (Phase 6 · 8 of 8)

| ID | Severity | Closure |
|---|---|---|
| SKP-002/CRITICAL | HTML-escape inside `<untrusted-content>` | `escapeForUntrustedContent` in `format-prior-week-hint.ts` escapes `<`/`>`/`&` BEFORE wrapping (S1 ce89c21) |
| SKP-001/CRITICAL | Markers are convention, not enforcement | System prompt MUST contain `UNTRUSTED_CONTENT_LLM_INSTRUCTION` verbatim · snapshot-tested in `format-prior-week-hint.test.ts` (S1 ce89c21) |
| SKP-001/HIGH | Multi-process mutex protection | `assertSingleProcess` checks `.pid` file + `process.kill(pid, 0)` liveness · emits `voice_memory.multi_process_violation` OTEL event · fail-closes write (S6 d4be5ba) |
| SKP-001/HIGH | S1 oracle vs S0 legacy-equivalence gap | `derive-shape.test.ts · legacy equivalence (T1.8)` 30 scenarios with inlined `legacySelectLayoutShape` (after S2 deleted the module) · permanent regression guard (S1 ce89c21 + S2 0b7206d retrofit) |
| SKP-002/HIGH | validateSnapshotPlausibility silent fallback | OTEL `score.snapshot.implausible` event on rejection + structured `.run/score-snapshot-rejections.jsonl` Decision Log + `score.snapshot.fallback_storm` storm alert (S2 0b7206d) |
| SKP-003/HIGH | Static baseline rejects organic growth | Rolling-window baseline (last 30 snapshots, refresh on accept) · 60-week +10%/week organic-growth test 0 false-positives (S2 0b7206d) |
| SKP-003/HIGH | Post-type count inconsistency | Single canonical `PostType` (7 values · user-facing) + `VoiceMemoryStream` (8 values · voice-memory) cleanly separated in `domain/post-type.ts` (S1 ce89c21 / S3 8f94080 refinement) |
| SKP-004/HIGH | Voice-memory privacy/retention | 90-day TTL on all entries (`expiry` field skipped on read when past) + `forgetUser` per-user deletion + `.run/voice-memory-deletions.jsonl` audit log + `user_id` optional schema field + chat-reply schema refinement requires user_id (S6 d4be5ba) |

## Aggregate Metrics

- Tests: **908 pass** · 0 fail · 1 skip · 2315 expect calls across 53 files
- Typecheck: clean (persona-engine + bot)
- Seam audit: OK (both warn-mode and strict-mode)
- ~1700 net LoC change · delete-heavy in S2 · additive in S1/S3/S6

## Spec Deviations (per `feedback_spec_deviation_pattern`)

1. **fast-check → bun:test hand-crafted fixtures** (S1) — fast-check not in
   deps. 30 hand-crafted scenarios spanning all 4 decision-tree branches.
2. **TypeBox → Zod for VoiceMemoryEntry** (S6) — Zod already in stack per
   CLAUDE.md. Same shape; same semantic guards.
3. **sanitizeMemoryText pulled S6 → S1** — co-located with
   `formatPriorWeekHint` (T1.5) since both share the sanitize-then-wrap
   defensive pattern.
4. **chat-reply orchestrator delegates to legacy** (S5) — full cutover
   (dispatch.ts callsite + composeReplyWithEnrichment deletion + canary)
   deferred to operator-paced post-merge work to avoid high-traffic
   regression risk.
5. **6 non-digest orchestrators not yet voice-memory-wired** (S6) — digest
   is the canonical exemplar. Mechanical inheritance pattern documented in
   `digest-voice-memory.test.ts` for replication.
6. **CI workflow not wired** (S2) — no `.github/workflows/` directory in
   repo. `bun run lint:seam` is the operator-runnable equivalent.

## Lessons (for cycle-007+ inheritance)

1. **Single canonical truth + test-only oracle**: BB design-review F-001's
   "two clocks" pattern closed via `deriveShape` (live) + `oracleShape`
   (test-only). The test oracle is NOT a parallel production impl; it's
   a hand-crafted reference that re-derives from the english spec. Pattern
   extends to future shape/derivation modules.
2. **HTML escape FIRST, then wrap markers** (RT-002/SKP-002): markers are
   convention; escape is structural. Any `<untrusted-content>` wrapper
   MUST escape the inner content's `<`/`>`/`&` before wrapping. Without
   escape, the markers are tag-breakout-vulnerable.
3. **System-prompt instruction backs convention** (SKP-001): when relying
   on markers, the LLM must be instructed to treat marker content as inert
   data. Snapshot-test the instruction string to prevent drift.
4. **Rolling-window baselines over static** (SKP-003): substrate-quality
   sanity checks must refresh against recent history, not static
   commit-time fixtures, or they will reject legitimate organic growth.
5. **Single-process invariants need runtime detection** (SKP-001/multi-proc):
   document the invariant in the file header AND emit a multi-process
   violation event + fail-close at runtime. Documentation alone isn't
   enough when ops topology changes.
6. **Pull primitives forward when co-location demands** (sanitizeMemoryText):
   if S1's `formatPriorWeekHint` needs a sanitizer that S6's `voice-memory.
   live.ts` also needs, land the sanitizer in the earlier sprint and let
   the later sprint inherit. Spec deviation is fine; document it.
7. **Calibration spikes catch architectural drift cheap** (S0): 0.5-day
   spike validating equivalence between legacy (cycle-005) and new
   (cycle-006) shape derivation surfaced zero drift across 10 fixtures.
   That zero-drift result green-lit S1's migration with high confidence.

## Operator-paced completion items

See `operator-handoff-cycle-006.md` for the full list. High-priority:

1. Open PR for `feat/cycle-006-substrate-presentation` → wait for BB round 3
2. Production canary (one digest cron in THJ guild) — visual sign-off
3. Mechanical wiring of 6 remaining orchestrators (digest pattern inheritance)
4. Chat-reply dispatch.ts callsite migration (T5.5/T5.7 from S5 deferral)
5. Ledger flip: `cycle-006-substrate-presentation.status: archived`
