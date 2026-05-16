---
title: Sprint Plan — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.4
simstim_id: simstim-20260514-348dce09
phase: planning
date: 2026-05-14
prd_ref: grimoires/loa/prd.md (v0.4)
sdd_ref: grimoires/loa/sdd.md (v0.4)
total_sprints: 10 (Sprint 1-10 · semantic labels S0/S1A/S1B/S2/S2W/S3A/S3B/S4/S5/S6 retained in titles + task-ID prefixes)
estimated_duration: 18-25 working days
flatline_integrated: [SKP-001-strict-schema+character-enum+scored-threshold, SKP-002-S1-split, SKP-003-rename-split+ip-allowlist+pg-pool-isolation, SKP-004-eval-job-persistence, SKP-005-dryrun-to-S1A+token-lifecycle]
---

> **v0.6 changelog** — Sprint 1 (S0) reconciled with SDD §1.5 → **fully agent-runnable, no operator gate**. The prior "operator Discord-side captures" framing contradicted the post-Flatline SDD §1.5, which established that the regression net diffs the *deterministic surface* (code-determined: embed structure, footer regex, tool-call sequence + identity, `content`-populated invariant, no-leak checks) with the LLM adapter *pinned* to a recorded fixture — raw prose is not diffed. The deterministic surface is capturable via the repo's existing local CLI entrypoints (`bun run digest:once` etc.), so operator-triggered Discord capture is unnecessary *for the regression-net function*. Production-fidelity prose snapshots remain an optional, non-blocking operator follow-up. This removes the only HITL gate at the start of the plan — `/run sprint-plan` is now autonomously executable end-to-end.
>
> **v0.5 changelog** — renumbered sprint headers to `## Sprint N:` (1–10) for `/run sprint-plan` discovery compatibility (its discovery regex is `^## Sprint [0-9]+:` — pure-numeric, colon-delimited; the prior `## Sprint N ·` headers + split-sprint IDs were undiscoverable). Semantic labels (S0/S1A/S1B/S2/S2W/S3A/S3B/S4/S5/S6) retained in every title; **task-ID prefixes inside each section are unchanged** (S1A.T1, S2W.T1, etc. — self-consistent within their sprint). Mapping: **1=S0 · 2=S1A · 3=S1B · 4=S2 · 5=S2W · 6=S3A · 7=S3B · 8=S4 · 9=S5 · 10=S6**. No task content changed.
>
> **v0.4 changelog** — integrates Flatline sprint review (2026-05-14, 3-model, 53% agreement, $0): 7 HIGH_CONSENSUS + 6 of 7 DISPUTED accepted + 10 BLOCKERS resolved. Surgical consistency fixes: intro sprint count (6→10), dependency graph (+S2W +S6, READY-FOR-MERGE moved to S6), S1B topology reconciliation (separate Railway service from the start — resolves the T1-T9-vs-T10 contradiction), S1B duration (2→3.5d, risk HIGH), S6.T3 explicit caretaker IDs. New **Flatline Sprint v0.4 integration** section adds S0.T7 (capture provenance), S1A.T18-T19 (variance protocol + fixture front-loading), S1B.T18-T19 (threat model + Pg ownership), S6.T8 (E2E activation test), S5 re-scope + cycle-gate, CC.6-CC.8. One finding skipped (IMP-015, `would_integrate: false`).
>
> **v0.3 changelog** — revised against PRD v0.4 + SDD v0.4 (2026-05-14). Adds **Sprint 2W · World-grounding core** (ZoneId→RoomId rename + RoomManifestPort + env.ts re-grounding — FR-15/16/17/18, rides Phase 1) and **Sprint 6 · Caretaker fold-in** (codex-mcp validation + 5-caretaker fold-in + activation gate — FR-19/20). Adds an **S1B addendum** (S1B.T10-T17) absorbing the SDD §10/§11 blocker resolutions — separate eval Railway service, shared nonce store, full token-bootstrap + per-token request-signing, elevated-token contract, HMAC canonical string, read-only DB role, score-tool-allowlist. total_sprints 8 → 10.
>
> **v0.2 changelog** — integrates 6 Flatline sprint-plan-review findings (2026-05-13, 3-model cheval-routed, $0 cost):
> - **SKP-002 CRIT 920 / SKP-001 CRIT 850** → **Sprint 1 split into S1A + S1B**. S1A ships LLM gateway port + local recorded-fixture runner (no HTTP endpoint, no Railway). S1B ships Railway eval endpoint + token issuance + async jobs. S1A parity gate required before any endpoint exposure. Also moves `DryRunDeliveryAdapter` stub to S1A (was blocked by Sprint 4 dependency).
> - **SKP-001 CRIT 880** → **Scored threshold replaces exact-equality** in eval parity check. New artifact: `evals/thresholds.yaml` committed in S1A defines per-fixture-type minimum hard/soft scores (hard ≥ 0.85, soft ≥ 0.70 default). S1A.T17 passes if fixtures exceed thresholds, NOT if outputs match snapshot byte-for-byte.
> - **SKP-001 CRIT 950 + 860** → **Strict S0 schema + explicit character enumeration**. No '8 characters × 3 prompts' aspirational counts. S0 captures only currently-deployed characters with structured artifacts: raw Discord JSON + rendered markdown + tool-call trace + environment metadata + character version + prompt + timestamp + deterministic filename.
> - **SKP-002 HIGH 780 / SKP-005 CRIT 850** → **Sprint 3 split into S3A + S3B**. S3A: identity port behind existing `freeside_auth` namespace (zero behavioral change). S3B: rename to `freeside_identity` + alias + deprecation tests + config migration. Separates port lift from rename concerns.
> - **SKP-003 HIGH 710 + 760, SKP-005 HIGH 760** → **Eval endpoint hardening adds to S1B**: IP allowlist (Railway private networking OR CIDR allowlist for operator IPs), eval-mode Pg connection pool isolated from live pool with ROLLBACK in finally, token TTL ≤24h, `POST /eval/token/revoke` endpoint, hash-stored tokens in ring buffer.
> - **SKP-004 HIGH 780 + 740** → **Eval job state persistence**: `.run/eval-jobs/` is ephemeral on Railway (lost on container restart). Move job state to existing Postgres instance OR Railway Volume. Acceptance criterion explicit: job state survives container restart.

# Sprint Plan

> **10 sprints, numbered 1–10** for `/run sprint-plan` discovery. Semantic labels retained in titles + task-ID prefixes — mapping: **1=S0 · 2=S1A · 3=S1B · 4=S2 · 5=S2W · 6=S3A · 7=S3B · 8=S4 · 9=S5 · 10=S6**. **Sprint 1 (S0) is mandatory pre-refactor regression-net work** (per Flatline SDD SKP-001 CRIT) and is **agent-runnable** via the repo's local CLI entrypoints (reconciled with SDD §1.5 — see v0.6 changelog; no operator gate). Sprints 2–9 each ship a vertical-slice port migration with explicit acceptance gates; **Sprint 5 (S2W)** rides Phase 1 with the world-grounding core (FR-15/16/17/18); **Sprint 10 (S6)** is the caretaker fold-in (FR-19/20), last because it depends on every safety seam below it. Per PRD FR-6a, each sprint must pass its gate before the next starts. Per simstim discipline, `/run sprint-plan` orchestrates sprints sequentially with review+audit cycle + circuit breaker.

## Sprint 1: Behavioral snapshot baseline — pre-refactor regression net (was S0)

**Duration**: 0.5-1 day · **Owner**: agent (operator review optional, non-blocking) · **Risk**: low

**Purpose**: Capture the **deterministic surface** of current output for every (character × post-type) combination as golden files — the cheap regression net DURING refactor, BEFORE the eval harness exists. The corpus seeds the Sprint 2+ eval fixture set.

> **Reconciled with SDD §1.5** (v0.6): the regression net diffs the *deterministic surface* — embed presence, footer regex, tool-call sequence + identity, `content`-populated invariant, no-leak-pattern checks — NOT raw LLM prose (non-deterministic; pinned to a recorded fixture per §1.5). The deterministic surface is **code-determined**, so capturing it via the repo's local CLI entrypoints (`bun run digest:once` etc., pinned/stub adapter) is equivalent to production-Discord capture *for the regression-net function*. Sprint 1 is therefore **fully agent-runnable — no operator gate**. (Optional, non-blocking: the operator MAY later add production-fidelity prose snapshots; they are not the regression signal and do not gate the cycle.)

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S0.T1 | Create `evals/snapshots/pre-refactor/` directory structure | agent | 5min |
| S0.T2 | Capture one digest per zone (× 4 current zones) via `LLM_PROVIDER=stub bun run digest:once` with a pinned config; record the **deterministic surface** (embed structure + footer + tool-call sequence + `content` invariant + no-leak checks) into `evals/snapshots/pre-refactor/<character>-<zone>-digest.snapshot.yaml` | agent | 45min |
| S0.T3 | Capture micro / weaver / lore_drop / question / callout for ruggy (× 5 post types) via the equivalent local CLI triggers — same deterministic-surface capture | agent | 45min |
| S0.T4 | Capture chat-mode replies via the local `composeReply` path (stub provider) — ruggy + satoshi × 3 representative prompts each, +1 each for the other deployed characters | agent | 45min |
| S0.T5 | Document the capture protocol in `evals/snapshots/README.md` (how to add snapshots, how they become Sprint 2 fixtures, the deterministic-surface contract) | agent | 15min |
| S0.T6 | Commit golden snapshots with `canonical: true` for the deterministic surface (agent-canonical — code-determined, operator-review-independent). Optional non-blocking follow-up: operator adds production-fidelity prose snapshots | agent | 15min |
| S0.T7 | Capture provenance (per Flatline Sprint SKP-002 + SKP-012): every snapshot carries `capture_id` + bot commit SHA + adapter identity + timestamp; redaction pass (secret scan, wallet/handle scrub) before write — committed-safe format only | agent | 30min |

**Snapshot schema** (per Flatline SKP-001 CRIT 860, mandatory before captures begin):

```yaml
# evals/snapshots/<character>-<post_type>-<zone-or-slug>-<timestamp>.snapshot.yaml
schema_version: "1.0.0"
character: "ruggy"
character_version: "v0.6.0-A"          # from bot boot log
post_type: "digest"
zone: "bear-cave"                       # optional, post-type-dependent
canonical: false                        # operator flips to true after review
captured_at: "2026-05-XX..."
captured_by: "operator"

input:
  prompt: null                          # chat-mode only
  zone_digest_payload: { ... }          # JSON from get_zone_digest (operator-supplied)
  trigger: "cron weekly" | "/ruggy <prompt>" | "manual"

output:
  raw_discord_payload: { ... }          # full JSON from Discord API
  rendered_markdown: "yo Bear Cave..."  # rendered embed body
  tool_call_trace:                       # from Railway logs
    - tool: "mcp__score__get_zone_digest"
      args: { ... }
      latency_ms: 312
  environment:
    LLM_PROVIDER: "bedrock"
    STUB_MODE: false
    ANTHROPIC_MODEL: "claude-opus-4-7"
```

**Currently-deployed character enumeration** (per Flatline SKP-001 CRIT 950 — no aspirational counts):

Per `apps/character-*` directories: **ruggy, satoshi, munkh, kaori, nemu, akane, ren, ruan**. 8 characters total. S0 snapshots cover only deployed characters; if any character is added/removed mid-cycle, S0 expands/contracts explicitly.

**Acceptance criteria** (all agent-verifiable — no operator gate):
- [ ] `evals/snapshots/README.md` documents the schema + the deterministic-surface contract BEFORE first capture
- [ ] ≥4 digest snapshots (one per current zone: stonehenge, bear-cave, el-dorado, owsley-lab — S0 captures CURRENT pre-refactor code; the `ZoneId→RoomId` rename + the 6-Room expansion land in Sprint 5/S2W, which re-keys + expands the snapshot set)
- [ ] ≥5 alt-post-type snapshots (one each: micro, weaver, lore_drop, question, callout) on ruggy
- [ ] **Chat-mode snapshots**: ruggy + satoshi × 3 representative prompts = 6 minimum; +1 each for the other deployed characters (mongolian/kaori/nemu/akane/ren/ruan)
- [ ] All snapshots conform to the schema; failed-conformance snapshots rejected
- [ ] All snapshots carry `canonical: true` for the deterministic surface + full provenance (S0.T7)
- [ ] Total snapshot count documented in `evals/snapshots/MANIFEST.md`

**Out of scope for S0**: any code changes; refactor begins Sprint 1A.

---

## Sprint 2: Phase 0 pilot — LLM gateway port + LOCAL eval runner (was S1A)

**Duration**: 2-3 days · **Owner**: agent · **Risk**: medium-high (first port lift; new patterns)

**Purpose** (per Flatline SKP-002 CRIT 920 sprint split): Pilot the four-folder pattern + surgical Effect adoption on the LLM gateway. Ship LOCAL eval-runner with recorded-fixture support — NO HTTP endpoint, NO Railway, NO tokens. Proves the pattern locally before exposing any production surface. S1B follows after S1A's parity gate passes.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S1.T1 | Add `neverthrow` (Result type) + `effect` deps to `packages/persona-engine/package.json` | agent | 15min |
| S1.T2 | Create `packages/persona-engine/src/compose/llm-gateway/{domain,ports,live,mock}/` directories | agent | 5min |
| S1.T3 | Define `llm-gateway.port.ts` with `invoke()` signature returning `Promise<Result<LLMResponse, LLMError>>`; `LLMError` is a discriminated union (`RateLimitError` · `EmptyResponseError` · `AuthError` · `MalformedResponseError` · `TransportError`) | agent | 1h |
| S1.T4 | Lift existing `compose/agent-gateway.ts` provider routers into `live/{anthropic,bedrock,freeside,stub}.live.ts` adapters. Each adapter uses Effect INTERNALLY; exports a Promise<Result<...>> boundary per SDD §1.6 | agent | 4h |
| S1.T5 | Implement `mock/recorded.mock.ts` — replays canned LLM responses from fixtures | agent | 1h |
| S1.T6 | Add `apps/bot/src/runtime.ts` composition root with `buildRuntime('live' \| 'eval' \| 'test', config)` factory; wire llm-gateway port → live adapter | agent | 2h |
| S1.T7 | Migrate all existing callers of `compose/agent-gateway.ts::invoke` to use new port-based runtime (the composer + reply.ts + any other call sites) | agent | 2h |
| S1.T8 | Add ESLint custom rule `no-effect-export` (per SDD §1.6) | agent | 1h |
| S1.T9 | Write `score.contract.test.ts` for llm-gateway port (live + mock both run through `describe.each`); covers all LLMError variants | agent | 2h |
| S1A.T10 | Implement eval harness foundation: `evals/src/{fixture-loader,runner,score-hard,score-soft,compare,reporter}.ts` | agent | 4h |
| S1A.T11 | Implement `evals/thresholds.yaml` (per SKP-001 CRIT 880) — per-fixture-type thresholds: hard ≥ 0.85, soft ≥ 0.70 default; operator-tunable per fixture | agent | 30min |
| S1A.T12 | Stub `DryRunDeliveryAdapter` (per SKP-001 CRIT 850) — bare delivery-port stub at `packages/persona-engine/src/deliver/eval/dry-run-stub.adapter.ts`; captures to ring buffer; full Sprint 4 implementation later | agent | 1h |
| S1A.T13 | Convert at least 6 Sprint 0 snapshots into eval fixtures (`evals/fixtures/*.fixture.yaml`); each maps a snapshot to hard + soft scoring criteria | agent | 2h |
| S1A.T14 | Implement `apps/bot/scripts/run-eval-local.ts` (LOCAL CLI: invokes eval runner against recorded-mock adapter using fixtures, NO Railway) | agent | 1.5h |
| S1A.T15 | Write `evals/__tests__/no-production-side-effects.test.ts` (structural test per SKP-005 HIGH 760 alternative: verifies eval-mode runtime's delivery slot is NOT live discord adapter; full behavioral test waits for Sprint 4) | agent | 1.5h |
| S1A.T16 | Run local eval against all Sprint-0 snapshots using MOCK adapter; verify scored thresholds pass (hard ≥ 0.85, soft ≥ 0.70) | agent | 1h |
| S1A.T17 | Update PRD/SDD with any learnings (Decision Log entries in `grimoires/loa/NOTES.md`) | agent | 30min |

**Acceptance criteria (Phase 0 LOCAL gate — S1A only)**:
- [ ] `compose/llm-gateway/` has `domain/`, `ports/`, `live/`, `mock/` directories with files
- [ ] `llm-gateway.contract.test.ts` exists and passes for both live + mock adapters
- [ ] Existing test suite 641/641 still green
- [ ] `evals/thresholds.yaml` committed with default per-fixture-type thresholds
- [ ] `DryRunDeliveryAdapter` stub exists at `deliver/eval/dry-run-stub.adapter.ts`
- [ ] At least 6 fixtures in `evals/fixtures/` corresponding to Sprint-0 snapshots
- [ ] `bun run apps/bot/scripts/run-eval-local.ts --fixture all` works end-to-end against MOCK adapter
- [ ] All fixtures exceed their thresholds (hard ≥ 0.85, soft ≥ 0.70 by default)
- [ ] Structural no-side-effects test passes (eval-mode delivery slot ≠ live discord adapter)
- [ ] `bun run typecheck` + `bun test` both green

**Verification**: agent runs `bun run apps/bot/scripts/run-eval-local.ts --fixture all` from local; report shows all thresholds met. NO Railway dependencies tested.

**Rollback criteria**: revert if any of (a) existing tests fail, (b) any fixture falls below its threshold, (c) Effect/Promise boundary lint rule fails, (d) DryRun stub leaks any side effect in structural test.

---

## Sprint 3: Eval HTTP endpoint + token issuance + persistent job state (was S1B)

**Duration**: 3.5 days · **Owner**: agent · **Risk**: HIGH (production-adjacent remote-execution surface; security gates; 19 tasks incl. the SDD §10/§11 addendum + threat model — per Flatline Sprint IMP-003, the original 2-day estimate predated the addendum)

**Purpose** (per Flatline SKP-002 CRIT 920): expose the local eval runner from S1A as a Railway-side HTTP endpoint. Adds remote-invocation surface, token issuance, async jobs with persistent storage. **S1A must pass acceptance gate first.**

> **Topology reconciliation** (Flatline Sprint SKP-002 HIGH 730): S1B builds the eval endpoint as a **separate Railway service from the start** — `apps/bot/src/eval-server.ts`, NOT an in-process `apps/bot/src/eval/handler.ts`. Where T1-T9 below say `eval/handler.ts`, read `eval-server.ts` — the addendum T10 topology is authoritative and T1-T9 target it directly. There is no in-process intermediate state.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S1B.T1 | Implement eval HTTP endpoint: `apps/bot/src/eval/handler.ts` (HMAC verify + token check + timestamp + nonce + rate-limit + fixture-allowlist + audit log) | agent | 4h |
| S1B.T2 | Per SKP-003 HIGH 710: add **IP allowlist** at endpoint (Railway private networking OR CIDR allowlist from env `EVAL_IP_ALLOWLIST`). Default deny; explicit allow only | agent | 1h |
| S1B.T3 | Per SKP-004 HIGH 740: implement eval job state in **Postgres** (new table `eval_jobs` migrated via SQL) — `.run/eval-jobs/` is ephemeral on Railway containers; Pg gives persistence + concurrent access | agent | 3h |
| S1B.T4 | Implement async job pattern: `POST /eval/run` returns 202 + job_id; `GET /eval/result/:job_id` polls Pg `eval_jobs` table | agent | 2h |
| S1B.T5 | Implement `apps/bot/scripts/issue-eval-token.ts` (operator-local CLI) + `POST /eval/token` Railway endpoint | agent | 2h |
| S1B.T6 | Per SKP-005 HIGH 760: **token TTL ≤24h** (env `EVAL_TOKEN_MAX_TTL_SECS`); `POST /eval/token/revoke` endpoint; hash-stored tokens in Pg ring buffer with max N (env `EVAL_TOKEN_RING_SIZE`); doc lifecycle in `docs/EVAL-AUTH.md` | agent | 2h |
| S1B.T7 | Implement `apps/bot/scripts/run-eval.ts` (remote-CLI: signs request, POSTs to Railway, polls, renders report) | agent | 2h |
| S1B.T8 | Run remote eval against all S1A fixtures via Railway endpoint; verify scored thresholds pass via LIVE adapter (LIVE provider + replayed fixtures); separate test target from S1A's MOCK-only run | agent | 1h |
| S1B.T9 | Deploy to Railway; verify endpoint is reachable from operator IP only (test from non-allowlisted IP fails) | operator + agent | 1h |

**Acceptance criteria (Phase 0 REMOTE gate)**:
- [ ] `POST /eval/run` deployed on Railway, returns 202 + job_id
- [ ] `GET /eval/result/:job_id` polls job state from Pg (survives container restart — verified by Railway redeploy mid-run)
- [ ] `POST /eval/token` issues hash-stored tokens with TTL ≤24h
- [ ] `POST /eval/token/revoke` works (revoked tokens fail subsequent requests)
- [ ] IP allowlist verified: request from non-allowlisted IP returns 403
- [ ] `bun run apps/bot/scripts/run-eval.ts --fixture all` works end-to-end against Railway
- [ ] All fixtures' LIVE-adapter outputs exceed thresholds
- [ ] `docs/EVAL-AUTH.md` documents token lifecycle (issue → use → expire/revoke)

**Verification**: agent obtains short-lived token from operator, runs full eval against Railway, observes all fixtures pass thresholds, can revoke token + verify subsequent request fails.

**Rollback criteria**: revert if (a) any auth gate test fails, (b) Pg eval_jobs storage corrupts state, (c) IP allowlist bypassable.

### S1B addendum — SDD v0.4 blocker-resolution tasks

Absorbs SDD §10 + §11.2/§11.3 (the PRD-blocker Overrides + the Flatline-SDD blockers).

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S1B.T10 | Stand up the eval endpoint as a **separate Railway service** (`freeside-characters-eval`, distinct entrypoint `apps/bot/src/eval-server.ts`, `replicas=1` asserted at boot) — NOT in the live bot process (SDD §10.1) | agent + operator | 3h |
| S1B.T11 | Move nonce + rate-limit state to a **shared store** (`EVAL_NONCE_STORE=redis|sqlite`, key `sha256(caller_id+token_id+nonce)`, TTL 10min) — survives redeploys (SDD §10.1) | agent | 2h |
| S1B.T12 | Full token-bootstrap contract (SDD §10.2 + §11.2): `EVAL_OPERATOR_TOKEN_HASH` verification · `EVAL_TOKEN_SIGNING_KEY` · JWT-like claims · `token_id`/jti revocation set in shared store · per-token `request_signing_secret` for `X-Eval-Sig` (agent never holds long-lived signing material) | agent | 4h |
| S1B.T13 | Elevated-token contract (SDD §10.4): `?elevated=1` mint + operator confirmation · `side_effects`/`allowed_ports` enforcement · test `normal-token-cannot-run-side-effects.test.ts` (403) | agent | 2h |
| S1B.T14 | HMAC canonical string fixed exactly per SDD §11.2 + cross-language golden signature fixtures in `evals/fixtures/_signing/` | agent | 1h |
| S1B.T15 | Dedicated read-only prod DB role `freeside_eval_ro` (`default_transaction_read_only=on`); §5.3 transaction wrapper kept as defense-in-depth (SDD §11.3) | agent + operator | 1h |
| S1B.T16 | `evals/score-tool-allowlist.json` (version-pinned) + fail-closed eval-mode `ScoreAdapter` + contract test for score-mcp tool drift (SDD §11.3) | agent | 1h |
| S1B.T17 | `evals/__tests__/deployed-endpoint-is-dry-run.test.ts` — hits running eval service `/eval/health`, asserts `{ runtime_mode: 'eval', delivery_adapter: 'dry-run' }` (SDD §10.3) | agent | 1h |

---

## Sprint 4: Phase 1 — score boundary port migration (was S2)

**Duration**: 2 days · **Owner**: agent · **Risk**: medium

**Purpose**: Lift `score/client.ts` into `score/{domain,ports,live,mock}/` shape. Effect-adopted (typed error channel for transport/stale/schema failures).

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S2.T1 | Apply 5-command lift recipe: cp llm-gateway template → sed-rename → wire into runtime.ts | agent | 1h |
| S2.T2 | Define `score.port.ts` covering all 14 score-mcp tools (get_zone_digest + 10 legacy + 4 cycle-021 pulse) + ScoreError discriminated union | agent | 2h |
| S2.T3 | Lift `score/client.ts` MCP-over-HTTP code into `score/live/mcp-http.live.ts`; Effect-wrap for typed errors | agent | 3h |
| S2.T4 | Implement `score/mock/recorded.mock.ts` — replays canned digest responses + cycle-021 pulse responses from fixtures | agent | 2h |
| S2.T5 | Implement `score/mock/synthetic.mock.ts` — replaces existing `generateStubZoneDigest` with port-conforming adapter | agent | 1h |
| S2.T6 | Migrate all callers of `fetchZoneDigest` to use port-based runtime | agent | 2h |
| S2.T7 | Write `score.contract.test.ts` (live + mock both run through `describe.each`) | agent | 2h |
| S2.T8 | Add fixtures for all 4 cycle-021 pulse tools (covers gap analysis from earlier session) | agent | 2h |
| S2.T9 | Run eval harness; verify no regressions in any Sprint-0 snapshot | agent | 30min |

**Acceptance criteria**: `score/` ported · contract tests passing on both adapters · eval clean vs baseline · existing tests green.

---

## Sprint 5: World-grounding core — rides Phase 1, FR-15/16/17/18 (was S2W)

**Duration**: 2.5 days · **Owner**: agent · **Risk**: medium (typed-enum rename across ~10 files; wire-compat with score-mcp)

**Purpose**: The consumer-shaped world-grounding slice. Runs immediately after Sprint 2 because `ZoneId` lives in the exact files Sprint 2 ports (`score/types.ts`, `rosenzu/lynch-primitives.ts`). freeside-characters consumes the Room chain; it never scaffolds (server scaffolding = `discord-deploy` zone, freeside-cli#14).

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S2W.T1 | `ZoneId → RoomId` rename: typed enum + `ZONE_FLAVOR→ROOM_FLAVOR` + `ZONE_SPATIAL→ROOM_SPATIAL` + `ALL_ZONES→ALL_ROOMS` across `score/types.ts`, `rosenzu/lynch-primitives.ts`, `config.ts`, `compose/composer.ts`, `ambient/domain/{event,primitive-weights,canon-vocabulary}.ts` + tests (FR-15) | agent | 3h |
| S2W.T2 | `ScoreWireAdapter` (`score/live/`) — the only place that knows the external `zone` vocabulary; static `zone↔roomId` table; `score/wire-compat.test.ts` proves `get_zone_digest` + pulse tools round-trip old wire shape → `RoomId` with zero external-contract drift (FR-15, SDD §9.2) | agent | 2h |
| S2W.T3 | `.env` config-shim: new `ROOM_*` keys; legacy `DISCORD_CHANNEL_*` zone-named keys honored for a deprecation window (FR-15, SDD §9.2) | agent | 1h |
| S2W.T4 | `world/` four-folder module: `domain/room.ts` + `ports/room-manifest.port.ts` + `live/purupuru.rooms.live.ts` + `mock/room-manifest.mock.ts`. `Room` entry carries `roomId`/`worldId`/`guildId`/`manifestVersion`/`archetype`/`kind`/`channelId`/`homeCharacter?` (FR-16, SDD §9.1) | agent | 3h |
| S2W.T5 | `worlds/purupuru.rooms.ts` — the 6 Rooms with channel IDs (PRD Appendix A), shaped to `world-manifest.schema.json` `$defs/Room` (FR-17) | agent | 1h |
| S2W.T6 | `assertRoutable` routing-safety guard (`world/system/routing-guard.ts`) — pure fn, validates character→world→guild→channel coherence; `CrossWorldRoutingError` unless `roamer` (SDD §9.1, §11.5) + `world/world.contract.test.ts` | agent | 2h |
| S2W.T7 | `env.ts` re-grounding: `buildEnvironmentContext` reads `RoomManifestPort` (injected); `ROOM_FLAVOR`/`ROOM_SPATIAL` carry Tsuheji place data; `deriveTemperature`/`deriveSocialDensity` unchanged (FR-18, SDD §9.3) | agent | 2h |
| S2W.T8 | Run eval harness + snapshot diff; verify no regressions vs Sprint-0 baseline (the rename is behavior-preserving) | agent | 30min |

**Acceptance criteria**: `ZoneId` fully retired internally · `ScoreWireAdapter` round-trip tests green (zero external drift) · `world/` four-folder module + contract tests green · `assertRoutable` rejects cross-world posting · env.ts emits Tsuheji Room identity · eval clean vs baseline · existing tests green.

**Rollback criteria**: revert if (a) any `wire-compat.test.ts` proves external score-mcp contract drift, (b) eval flags >2 regressions per fixture (the rename must be behavior-preserving).

---

## Sprint 6: Phase 2 part 1 — identity port, behind existing namespace (was S3A)

**Duration**: 1.5 days · **Owner**: agent · **Risk**: low-medium

**Purpose** (per Flatline SKP-002 HIGH 780 split): lift `orchestrator/freeside_auth/server.ts` into `auth/{domain,ports,live,mock}/` shape WITHOUT renaming the MCP namespace. Zero behavioral change. Sprint 3B handles the rename + alias + deprecation.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S3A.T1 | Define `identity.port.ts` covering `resolveWallet`, `resolveWallets` (batch), `resolveHandleToWallet`, `resolveMiberaIdToWallet` + IdentityError union | agent | 1h |
| S3A.T2 | Per SKP-003 HIGH 760: lift Pg pool + query logic into `live/pg-midi-profiles.live.ts`. **Eval-mode uses ISOLATED Pg connection pool** (separate from live pool) — never shares idle connections; ROLLBACK in finally for every checkout regardless of error path | agent | 3h |
| S3A.T3 | Eval-mode wraps queries in `BEGIN READ ONLY` per SDD §5.3 | agent | 1h |
| S3A.T4 | Implement `mock/handle-map.mock.ts` — deterministic wallet→handle map from fixtures | agent | 1.5h |
| S3A.T5 | Migrate all callers to use port-based runtime (MCP namespace stays `freeside_auth`) | agent | 2h |
| S3A.T6 | Write contract tests covering live + mock; explicitly test READ-ONLY enforcement (attempt UPDATE in eval-mode → assert error) | agent | 2h |
| S3A.T7 | Eval pass against Sprint-0 snapshots | agent | 30min |

**Acceptance criteria**: identity ported (S3A no rename) · isolated Pg pool · READ ONLY enforced + tested · all tests green · no MCP namespace change.

---

## Sprint 7: Phase 2 part 2 — rename freeside_auth → freeside_identity (was S3B)

**Duration**: 1 day · **Owner**: agent · **Risk**: medium (consumer-facing rename; back-compat critical)

**Purpose** (per Flatline SKP-005 CRIT 850): split rename from port lift. Now that the port is in place, rename the namespace cleanly with explicit deprecation tests.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S3B.T1 | Rename module: `orchestrator/freeside_auth/` → `orchestrator/freeside_identity/` | agent | 30min |
| S3B.T2 | Update MCP tool prefixes: `mcp__freeside_auth__*` → `mcp__freeside_identity__*` in MCP server registration | agent | 1h |
| S3B.T3 | Add **transitional alias**: server registers BOTH `freeside_auth` (deprecated) AND `freeside_identity` (canonical) tool prefixes; alias warns on use via stderr log | agent | 1.5h |
| S3B.T4 | Update `character.json::tool_invocation_style` for all 8 characters to reference `freeside_identity` (keep `freeside_auth` mentions in deprecation comments) | agent | 1h |
| S3B.T5 | Add deprecation test: invoke `mcp__freeside_auth__resolve_wallet` → assert succeeds + emits deprecation warning to stderr | agent | 1h |
| S3B.T6 | Document deprecation window in `grimoires/loa/NOTES.md` (Decision Log) + propose removal cycle (e.g., cycle-N+2) | agent | 30min |
| S3B.T7 | Eval pass — verify chat-mode + digest path both work via new namespace; alias proven to work for old namespace | agent | 30min |

**Acceptance criteria**: rename complete · alias works · deprecation warning emitted on old namespace · all 8 character personas updated · removal window documented · all tests + eval green.

---

## Sprint 8: Phase 3 — delivery boundary port migration (was S4)

**Duration**: 2-3 days · **Owner**: agent · **Risk**: medium-high (largest blast radius — discord.js is everywhere)

**Purpose**: Lift `deliver/{client,webhook,post}.ts` into proper port + adapters. The `DryRunDeliveryAdapter` (load-bearing for eval safety) ships here.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S4.T1 | Define `delivery.port.ts` covering `postEmbed`, `postWebhook`, `postPlain` + DeliveryError union | agent | 1h |
| S4.T2 | Lift `deliver/client.ts` (discord.js Gateway) into `live/discord-bot.live.ts` | agent | 3h |
| S4.T3 | Lift `deliver/webhook.ts` into `live/discord-webhook.live.ts` (Pattern B per-character identity) | agent | 2h |
| S4.T4 | Lift `deliver/post.ts` (routing) into `live/delivery-dispatcher.live.ts` + pure `domain/delivery-router.ts` (router logic) | agent | 3h |
| S4.T5 | Implement `mock/captured-sink.mock.ts` — captures intended posts to ring buffer | agent | 1h |
| S4.T6 | Implement `eval/dry-run.adapter.ts` — eval-mode wrapper that uses captured-sink | agent | 1h |
| S4.T7 | Verify no `import { ... } from 'discord.js'` outside `deliver/live/` (FR-5 success metric) | agent | 1h |
| S4.T8 | Write contract tests | agent | 2h |
| S4.T9 | Eval pass | agent | 30min |

**Acceptance criteria**: delivery ported · discord.js imports confined to `deliver/live/` · DryRunDeliveryAdapter proves no-side-effects test passes.

---

## Sprint 9: Phase 4 — side surfaces port migration (was S5)

**Duration**: 2-3 days · **Owner**: agent · **Risk**: low-medium

**Purpose**: Port the remaining I/O-crossing modules (cron, voice config, persona loader, codex/rosenzu/emojis servers). All plain TS (no Effect — per SDD §1.2 boundary).

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S5.T1 | Lift `cron/scheduler.ts` into `cron/{ports,live,mock}/`. Mock = no-op for eval mode | agent | 2h |
| S5.T2 | Lift `voice/config-loader.ts` into `voice/{domain,ports,live,mock}/` | agent | 1.5h |
| S5.T3 | Lift `persona/loader.ts` into `persona/{domain,ports,live,mock}/` | agent | 1.5h |
| S5.T4 | Port `orchestrator/codex/`, `orchestrator/rosenzu/`, `orchestrator/emojis/` MCP servers behind a unified `mcp-server.port.ts` (each construct exports a server-factory; runtime wires them once) | agent | 4h |
| S5.T5 | Port `orchestrator/imagegen/bedrock-client.ts` into `imagegen/{ports,live,mock}/` (Bedrock LLM provider, image surface) | agent | 2h |
| S5.T6 | Final composition-root cleanup: verify `apps/bot/src/runtime.ts` is the ONLY `buildRuntime(...)` site | agent | 1h |
| S5.T7 | CI gate: add `scripts/check-single-runtime.sh` (per construct-effect-substrate single-effect-provide-site) | agent | 1h |
| S5.T8 | Expand fixture corpus to cover all 7 post types × representative characters | agent | 3h |
| S5.T9 | Run full eval harness across all fixtures; commit final baseline | agent | 1h |

**Acceptance criteria (cycle completion gate)**:
- [ ] All FR-1 through FR-14 from PRD satisfied
- [ ] 100% of modules crossing I/O boundaries have `*.port.ts` + `*.live.ts` adapters
- [ ] `bun test` 641+ tests green (existing baseline preserved)
- [ ] Eval harness covers 7/7 LLM-output post types
- [ ] No regressions vs Sprint-0 snapshots
- [ ] Single composition root (CI-verified)
- [ ] `import { ... } from 'discord.js' \| 'pg' \| '@anthropic-ai/...'` outside live adapters = 0
- [ ] PR posted with full Bridgebuilder review (multi-model)

---

## Sprint 10: Caretaker fold-in — FR-19/20 (was S6)

**Duration**: 2 days · **Owner**: agent · **Risk**: medium (live-guild delivery surface — gated by activation)

**Purpose**: Fold the 5 KIZUNA caretakers into the runtime roster, bound to home Rooms. Depends on S2W (`RoomManifestPort`) + S4 (per-character delivery resolution). Last sprint — the caretakers only go live after every safety seam below them is in place.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S6.T1 | `CodexValidationPort` four-folder module — `validateWorldElement(kind,name)` → `{match,canonical?,gapLogged}`; `live` calls `codex-mcp validate_world_element`, v1 stubs against local `purupuru.rooms.ts`; **never rejects** — `none` logs to `.run/codex-gaps.jsonl` (FR-19, SDD §9.4) | agent | 3h |
| S6.T2 | Wire `CodexValidationPort` into compose + fixture-load paths | agent | 2h |
| S6.T3 | Caretaker `character.json` updates — explicit IDs (lowercase, matching `apps/character-<id>/` dir names): `akane`, `kaori`, `nemu`, `ren`, `ruan` each get `world: 'purupuru'` + `homeRoom: <RoomId>` (per PRD Appendix A) + `activated: false`; `ruggy`, `satoshi`, `mongolian` get `roamer: true` (FR-20, SDD §9.5) | agent | 1h |
| S6.T4 | Roster enumeration via `CHARACTERS` env includes the 5 caretakers; `buildRuntime` activation-gate filter forces `DryRunDeliveryAdapter` for `activated: false` (FR-20, SDD §1.3, §9.5) | agent | 2h |
| S6.T5 | `runtime.contract.test.ts` extended: proves an `activated: false` caretaker resolves to dry-run delivery even in `live` mode | agent | 1h |
| S6.T6 | Eval fixtures for each caretaker persona's hard-check suite (the activation prerequisite) | agent | 3h |
| S6.T7 | Run full eval across all 8 characters × surfaces; verify caretakers produce in-voice output under dry-run; no cross-world routing leaks | agent | 1h |

**Acceptance criteria**: `CodexValidationPort` wired + never-rejects verified · 5 caretakers roster-enumerated · activation gate proven (dry-run in `live` until `activated: true`) · per-caretaker eval fixtures exist + pass hard-checks · no cross-world routing leak.

**Note**: flipping any caretaker to `activated: true` is an explicit operator action AFTER this sprint — not a task here. This sprint makes activation *safe*; it does not activate.

**Rollback criteria**: revert if (a) any caretaker delivery escapes dry-run while `activated: false`, (b) `assertRoutable` lets a caretaker post cross-world, (c) `CodexValidationPort` ever rejects instead of gap-logging.

---

## Cross-cutting tasks (every sprint)

| ID | Task | When |
|---|---|---|
| CC.1 | Run snapshot capture against current `main` for any new (character × post-type) combo introduced mid-cycle | Per new fixture |
| CC.2 | Update `grimoires/loa/NOTES.md` Decision Log with any deviations from SDD | Per sprint completion |
| CC.3 | Re-run eval harness against ALL fixtures (not just newly added) before merging each sprint's PR | Per sprint completion |
| CC.4 | Bridgebuilder review on each sprint's PR (uses cheval/OAuth shim chain) | Per sprint PR |
| CC.5 | If eval surfaces regression: STOP sprint, root-cause, fix BEFORE merging | Per regression |

## Dependencies + sequencing (v0.4)

```
Sprint 1  · S0  (snapshot baseline · operator-canonical · operator-gated)
  │
  ▼
Sprint 2  · S1A (LLM gateway port + LOCAL eval runner · NO Railway)
  │  └── load-bearing — parity gate before exposing endpoint
  ▼
Sprint 3  · S1B (eval endpoint as a SEPARATE Railway service + tokens + Pg job state)
  │
  ▼
Sprint 4  · S2  (score boundary)
  │
  ▼
Sprint 5  · S2W (world-grounding core · ZoneId→RoomId + RoomManifestPort + env.ts — rides Phase 1)
  │  └── runs immediately after Sprint 4 — shares the exact files Sprint 4 ports
  ▼
Sprint 6  · S3A (identity port behind existing namespace)
  │
  ▼
Sprint 7  · S3B (rename freeside_auth → freeside_identity + alias + deprecation)
  │
  ▼
Sprint 8  · S4  (delivery boundary + DryRunDeliveryAdapter + per-character delivery resolver)
  │
  ▼
Sprint 9  · S5  (side surfaces + composition root cleanup)
  │
  ▼
Sprint 10 · S6  (caretaker fold-in · codex-mcp validation + 5 caretakers + activation gate) ──→ READY-FOR-MERGE
```

**Strict sequential per Flatline SDD review** — parallelization is OUT. Each sprint's eval-against-baseline gate depends on the prior sprint's behavior being locked. The cycle is READY-FOR-MERGE only after **S6** — NOT after S5 (per Flatline Sprint IMP-005: S5 completing does not close the cycle while FR-15..FR-20 are still landing in S2W + S6).

## Flatline Sprint v0.4 integration (2026-05-14)

3-model Flatline sprint review: 7 HIGH_CONSENSUS + 7 DISPUTED + 10 BLOCKERS, 53% agreement, $0. Consistency bugs fixed surgically (intro sprint count, dependency graph S2W+S6, S1B topology reconciliation, S1B duration, S6.T3 IDs). Remaining findings resolved as task additions below. One DISPUTED finding skipped: IMP-015 (precise rename file-list — `would_integrate: false`; code-search + tests are the source of truth).

### New / amended tasks

**S1A — eval foundation hardening:**
- **S1A.T18** (SKP-001 CRIT 820 + SKP-004 740): define the **variance protocol** in `evals/thresholds.yaml` — each fixture runs N times (default 5); thresholds expressed as a confidence band / "min over N"; per-fixture-type acceptable variance documented. Hard-checks are deterministic structural assertions; soft-score uses pinned model+version+prompt+temperature=0 with scorer traces in the report. This is the sprint-side reference to SDD §11.4 — every later sprint's "eval clean vs baseline" gate means *within the variance band*, not exact match.
- **S1A.T19** (SKP-003 HIGH 740): **front-load fixture conversion** — convert ALL conformant Sprint-0 snapshots to fixtures in S1A, not just 6. Every sprint runs the full corpus.

**S0 — capture provenance:**
- **S0.T7** (SKP-002 HIGH 790 + SKP-012 710): every snapshot carries a `capture_id` propagated through trigger → Railway logs → Discord output → snapshot filename, plus bot boot commit SHA, deployed service version, model identifier, request timestamp. Snapshots without a complete provenance chain are rejected. Apply the redaction policy (secret scan, token/hash exclusion, wallet/user-handle scrubbing) BEFORE any snapshot is written — committed-safe format only.

**S1B — threat model + Pg ownership:**
- **S1B.T18** (SKP-006 CRIT 860): before implementation, write the eval-service **threat model + abuse-case test matrix** — required negative tests for expired token, revoked token, bad signature, replayed nonce, timestamp skew, non-allowlisted IP, unauthorized elevated mode, forbidden fixture, forbidden port, service restart during active job. All green before S1B's acceptance gate.
- **S1B.T19** (SKP-007 HIGH 720 + IMP-010): Postgres ownership — name the migration tool + migration-file location + rollback plan + schema namespace + indexes + retention policy + role permissions for `eval_jobs` / token storage / revocation set / nonce state / `freeside_eval_ro`. Boot-time schema-version check on the eval service.

**S5 — re-scope + cycle-gate:**
- **S5.T8 re-scoped** (SKP-003): net-new post-type fixture coverage ONLY (the full Sprint-0 corpus is already converted in S1A.T19).
- **S5 acceptance amended** (IMP-005): S5 completing is NOT cycle-complete — its marker reads "side-surface refactor complete," not "cycle complete." READY-FOR-MERGE is after S6.

**S6 — E2E activation safety:**
- **S6.T8** (SKP-010 HIGH 730): end-to-end **live-mode dry-run integration test** per inactive caretaker — loads the real `character.json`, builds the runtime in `live` mode, composes a post, attempts delivery, asserts NO Discord/webhook client is instantiated or called (proves no delivery path bypasses the resolver via direct imports).

### Cross-cutting amendments

- **CC.6** (IMP-006): beads task creation from this sprint plan is a MANDATORY gate before any sprint's implementation begins — `/run sprint-plan` creates the beads epic + task graph first; a sprint with no beads tasks does not start.
- **CC.7** (IMP-012): the FR-14 cost-budget gate runs BEFORE any full eval run in every sprint's eval task — estimated cost checked against the hard cap first.
- **CC.8** (IMP-009 + IMP-014): every sprint task carries an explicit one-line verification statement; task IDs are unique and contiguous within each sprint (audit/beads traceability).
- **IMP-007**: fixture post-type enumeration is the 7 PRD surfaces exactly — digest · micro · weaver · lore_drop · question · callout · reply.
- **IMP-013**: S1B.T15's `freeside_eval_ro` role is the connection identity cross-referenced by all Pg-touching tasks (S1B.T3/T11/T19).
- **IMP-011**: S0's deployed-slash-command availability check is an explicit precondition — S0.T1 verifies the deployed bot's slash commands respond before capture begins.

## Risks (additional to PRD §Risks)

| Risk | Mitigation |
|---|---|
| Effect's learning curve slows S1 | If S1 takes >5 days, halt and reassess; consider deferring Effect adoption to a later cycle |
| Sprint-0 snapshots become canonical too quickly (locked in wrong-state output) | Operator must explicitly mark each snapshot `canonical: true`; un-canonical snapshots are advisory |
| Cycle-Q (`quest` infrastructure) lands during this cycle and creates merge conflicts | Coordinate with operator: if quest work is also active, sequence cycles back-to-back rather than overlapping |
| Eval cost spirals during S1 (running fixtures + scoring while iterating) | FR-14 budget gate; aggressive `--fixture <single-id>` testing during iteration; full-run only at sprint completion |

## Out of scope (revisit next cycle or later)

- CI auto-fire eval on every PR (this cycle ships eval; auto-CI integration is cycle-N+1)
- Public fixture generation (operator-canonical only this cycle)
- Multi-tenant eval (THJ-only this cycle)
- Imagegen behavioral evals (path exists but no fixtures; cycle-N+1)
- Sprint plan re-architecture mid-cycle (sprints are sequential per simstim; defer any rework to next cycle)
