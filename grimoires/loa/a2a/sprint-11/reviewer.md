# sprint-11 (cycle-005 S5) · implementation report

> **Cycle**: cycle-005-ruggy-leaderboard · S5 (OTEL + digest orchestrator + accumulated deferrals from S2/S3/S4)
> **Global**: sprint-11 · **Bead**: bd-uo1
> **Date**: 2026-05-16 · **Author**: implement skill (autonomous · operator-routed (A) authorize bun add + full S5 minus operator-attested canary)

## Executive summary

Shipped the OTEL substrate + digest orchestrator that combines all S2/S3/S4 deferrals into a single pure function `composeDigestForZone`. Span tree (`chat.invoke` root + 3 transform child spans + `prose_gate.violation` events) verified via memory-exporter test. 9 OTEL tests pass; full suite 764 pass · 1 skip · 0 fail. Zero regressions.

**T5.7 dev-guild canary + T5.E2E goal validation DEFERRED** to operator-attested session — these are hard operator-bound steps per kaironic-time protocol. Cycle stays "active" until canary lands.

## AC Verification

| AC | Verbatim text | Status | Evidence |
|---|---|---|---|
| AC-S5.1 (PRD AC-7) | OTEL `chat.invoke` span captures ALL transform stages as child spans (verified via memory-exporter test) | ✓ Met | `otel-test.test.ts:97-135` — chat.invoke root + 3 named children (compose.prose-gate · compose.select-layout · compose.build-payload). Parent-context match verified via spanContext()/parentSpanContext.spanId. |
| AC-S5.2 (PRD AC-9) | composeReply chat-mode AND digest path both emit OTEL spans; chat-mode `chat.invoke` span correlates with `prose_gate.violation` events when fired | ⚠ Partial | Digest path emits ✓ (`digest.ts:99-186`). Chat-mode (`composeReplyWithEnrichment`) NOT wired — V1 routing invariant per SDD §5 makes gate digest-only; chat-mode OTEL spans are V1.5 destination. Documented in Decision Log. |
| AC-S5.3 (PRD AC-4) | when gate flags a violation: console.warn (S1) + OTEL span event (S5) both emit; prose text unchanged (V1 contract) | ✓ Met | `digest.ts:117-127` emits both (`rootSpan.addEvent('prose_gate.violation', ...)` + `console.warn(...)`). Idempotency at S1's `prose-gate.ts:175` returns text byte-identical. Test at `otel-test.test.ts:139-167`. |
| AC-S5.4 | `OTEL_EXPORTER_OTLP_ENDPOINT` env var documented in `.env.example`; absence-of-endpoint case handled (BatchSpanProcessor buffers; never blocks chat compose) | ✓ Met | `.env.example` lines added (OTEL_EXPORTER_OTLP_ENDPOINT + SERVICE_VERSION + PROSE_GATE_ON_VIOLATION + MOOD_EMOJI_DISABLED + LEADERBOARD_MAX_FACTORS). `otel-layer.ts:55` constructs OTLPTraceExporter with `url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT` (undefined → exporter buffers + drops). |
| AC-S5.5 | OTEL cardinality bounded: pattern enum (~3 values), reason enum (~4 values), factor_id bounded by score-mibera catalog (~28 factors) | ✓ Met | `otel-test.test.ts:212-237` asserts pattern ∈ {cluster-claim, p99-rare, structural-shift} + reason ∈ {cohort-singleton, percentile-unreliable, rank-below-threshold, rank-null, no-factor-context}. Full-draft-text-leak negative at `:241-269`. |
| AC-S5.6 | dev-guild canary post visually validates: card body matches dashboard mirror, voice layer is 1-line header + 1-line outro, per-row emojis render correctly, no engineering jargon leaks | ⏸ [ACCEPTED-DEFERRED] | Operator-attested step. Decision Log entry confirms deferral to operator session. Cycle stays "active". |
| AC-S5.7 | E2E goal validation per Appendix C: all 5 cycle goals (G-1..G-5) traced to delivered surfaces; any unvalidated goal blocks cycle close | ⚠ Partial | G-2 (gate flags FR-5 cases) ✓ via S1 test suite. G-3 (OTEL spans queryable) ✓ via memory-exporter test. G-4 (V1 contract — prose text UNCHANGED) ✓ via S1 idempotency + S5 `otel-test.test.ts:359-378` payload-content-doesn't-leak-draft. G-1 (leaderboard 85-95% pixels) + G-5 (canary green) require operator visual sign-off — deferred. |

## Tasks Completed

### T5.1 — package install
- **Files**: `packages/persona-engine/package.json` (deps added)
- **Approach**: operator-authorized `bun add @opentelemetry/api@1.9.1 @opentelemetry/sdk-node@0.218.0 @opentelemetry/sdk-trace-base@2.7.1 @opentelemetry/sdk-trace-node@2.7.1 @opentelemetry/exporter-trace-otlp-http@0.218.0 @opentelemetry/resources@2.7.1 @opentelemetry/semantic-conventions@1.41.1`. 134 packages installed in 806ms. No peer-dep conflict with Effect 3.21.2.

### T5.2 — `observability/otel-layer.ts` (production)
- **File**: `packages/persona-engine/src/observability/otel-layer.ts` (~85 lines)
- **Approach**: SOFT-4 fallback path (cycle-004 substrate absent · per S0 spike). `@opentelemetry/api` direct + `NodeTracerProvider` + `BatchSpanProcessor` + `OTLPTraceExporter`. Idempotent init via `initOtelLive()` singleton. `getTracer()` is the canonical accessor.

### T5.3 — `observability/otel-test.ts` (test exporter)
- **File**: `packages/persona-engine/src/observability/otel-test.ts` (~60 lines)
- **Approach**: separate `NodeTracerProvider` with `SimpleSpanProcessor` + `InMemorySpanExporter` for synchronous span capture. Returns `OtelTestHandle` with `tracer`, `exporter`, `reset()`, `getFinishedSpans()`.

### T5.4 — wire transform-stage spans (the deferral consolidator)
- **File**: `packages/persona-engine/src/compose/digest.ts` (~250 lines)
- **Approach**: `composeDigestForZone(args)` is the orchestrator that combines S1 (`buildFactorStatsMap` + `inspectProse`) + S2 (`buildPulseDimensionPayload`) + S3 (`selectLayoutShape` + `isNoClaimVariant`) + S4 (`moodEmojiForFactor`). Each transform wrapped in OTEL span via `withSpan` helper. Mode routing (log/skip/silence) at orchestrator layer per SDD §1 ProseGateOutcome.shape_override responsibility split.

### T5.5 — wire `dispatch.ts` slash-command outer span
- **Status**: ⏸ [ACCEPTED-DEFERRED] — same V1 routing invariant as AC-S5.2. V1.5 destination.

### T5.6 — memory-exporter test
- **File**: `packages/persona-engine/src/observability/otel-test.test.ts` (~380 lines · 9 tests)
- **Test groups**: chat.invoke span tree (AC-S5.1) · prose_gate.violation event (AC-S5.3) · cardinality bounds (AC-S5.5 NFR-4) · mode-aware behavior (skip/silence routing) · V1 contract (text byte-identical).

### T5.7 — dev-guild canary
- **Status**: ⏸ [ACCEPTED-DEFERRED] — operator-attested step. Cycle stays "active" until canary lands.

### T5.E2E — goal validation
- **Status**: ⚠ Partial — G-2/G-3/G-4 ✓ via test surfaces; G-1/G-5 require operator visual sign-off. Pin G-1 to S2 snapshot + S5 canary; G-5 to T5.7 deliverable.

## Technical Highlights

- **OTEL `@opentelemetry/api` direct path** per SOFT-4 fallback (cycle-004 absent). Sync `withSpan` helper avoids Effect.Tracer complexity for V1.
- **Span tree shape**: `chat.invoke` root → 3 child spans (one per transform stage) + N `prose_gate.violation` events on root → bounded cardinality per NFR-4.
- **Pure orchestrator** — `composeDigestForZone` takes typed inputs + tracer override; tests inject `OtelTest`'s tracer for deterministic assertions.
- **Cron path NOT modified** — the orchestrator function is callable from `cron/scheduler.ts` whenever operator wires the integration (intentional separation: behavior change requires operator-attested commit, not autonomous run).
- **Mode-aware orchestrator** — `skip` mode returns `payload: null` (caller drops the post); `silence` mode forces shape A (emits `prose_gate.shape_a_fallback` event). Both verified by memory-exporter test.
- **Telemetry hygiene** — `draft_hash` (8-char) appears in span events; full draft text never enters span attributes. Verified by negative-assertion test.

## Testing

- 9 OTEL tests · 29 expect calls · `bun test otel-test.test.ts` — pass in 160ms
- Full suite from repo root: **764 pass · 1 skip · 0 fail** across 40 files (was 755 pre-S5)

## Known Limitations

1. **AC-S5.2 chat-mode OTEL spans DEFERRED to V1.5** — V1 routing invariant pins gate digest-only; chat-mode `composeReplyWithEnrichment` does NOT call into the orchestrator. Adding OTEL spans to chat-mode is scope creep this cycle.
2. **AC-S5.6 + T5.7 dev-guild canary DEFERRED to operator-attested session** — cannot be done autonomously; cycle stays "active" until operator runs the canary + records `S5-CANARY.md`.
3. **AC-S5.7 + T5.E2E G-1/G-5 DEFERRED** — operator visual sign-off required.
4. **T5.5 dispatch.ts outer span DEFERRED** — same chat-mode V1.5 destination.
5. **Cron path NOT modified** — `cron/scheduler.ts` still calls the legacy compose path. Wiring `composeDigestForZone` into the cron firing requires an operator-attested commit (live behavior change in prod-bound cron). See operator handoff note below.
6. **LoC over budget**: ~700 LoC actual vs ~80 LoC original S5 estimate. The deferral-stack from S2/S3/S4 absorbed the surplus.

## Verification Steps

```bash
# 1. Packages installed
grep "@opentelemetry/api" packages/persona-engine/package.json

# 2. New files present
ls packages/persona-engine/src/observability/{otel-layer.ts,otel-test.ts,otel-test.test.ts}
ls packages/persona-engine/src/compose/digest.ts

# 3. OTEL tests pass
bun test packages/persona-engine/src/observability/otel-test.test.ts

# 4. Full suite + regression
bun test 2>&1 | tail -3  # → 764 pass · 1 skip · 0 fail

# 5. .env.example documents OTEL endpoint
grep OTEL_EXPORTER_OTLP_ENDPOINT .env.example
```

## Operator Handoff Notes (to land cycle-005)

The autonomous run shipped the renderer + gate + orchestrator + OTEL substrate, but the cron path still calls the legacy compose path. To activate cycle-005 in production:

1. **Wire `cron/scheduler.ts::weekly digest handler`** to call `composeDigestForZone(...)` instead of the legacy `buildPostPayload(...)` path. Single integration point.
2. **Run dev-guild canary** (`bun run digest:once` against a dev channel) and visually validate per AC-S5.6 (card body matches dashboard, voice layer is 1-line header + 1-line outro, per-row emojis render, no engineering jargon).
3. **Record `S5-CANARY.md`** with screenshots/paste of the canary post + any anomalies.
4. **Confirm G-1 + G-5** goal validation per T5.E2E.
5. **Flip cycle status** `active → archived` in `grimoires/loa/ledger.json`.

If the canary surfaces visual issues, file follow-up sprints; the autonomous run's deliverables (renderer + gate + orchestrator + OTEL) hold regardless.

## Decision Log entries

1. **`bun add` operator-authorized** (2026-05-16) — installed @opentelemetry/api + sdk-node + sdk-trace-base + sdk-trace-node + exporter-trace-otlp-http + resources + semantic-conventions. Pinned versions land in package.json. No peer-dep conflicts.
2. **SOFT-4 fallback path confirmed** — `@opentelemetry/api` direct, NOT `@effect/opentelemetry`. cycle-004 not in main per S0 spike preflight.
3. **AC-S5.2 (chat-mode OTEL) + T5.5 (dispatch.ts) DEFERRED** — V1 routing invariant pins gate digest-only.
4. **AC-S5.6 + T5.7 (dev-guild canary) + AC-S5.7 (E2E goal) + T5.E2E (G-1/G-5) DEFERRED** — operator-attested.
5. **Cron path NOT modified** — intentional; behavior change requires operator-attested commit.
6. **LoC over-budget** (~700 vs ~80 spec) — absorbed S2/S3/S4 deferral-stack into a single sprint per operator-routed (A) authorization.
