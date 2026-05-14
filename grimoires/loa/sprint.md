---
title: Sprint Plan — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.1
simstim_id: simstim-20260513-b7126e67
phase: planning
date: 2026-05-13
prd_ref: grimoires/loa/prd.md (v0.2)
sdd_ref: grimoires/loa/sdd.md (v0.2)
total_sprints: 6
estimated_duration: 12-18 working days
---

# Sprint Plan

> 6 sprints. **Sprint 0 is mandatory pre-refactor regression-net work** (per Flatline SDD SKP-001 CRIT). Sprints 1-5 each ship a vertical-slice port migration with explicit acceptance gates. Per PRD FR-6a, each sprint must pass its gate before the next sprint starts. Per simstim discipline, `/run sprint-plan` orchestrates sprints sequentially with review+audit cycle + circuit breaker.

## Sprint 0 · Behavioral snapshot baseline (pre-refactor regression net)

**Duration**: 0.5-1 day · **Owner**: agent + operator (canonical approval) · **Risk**: low

**Purpose**: Capture current production-equivalent output for every (character × post-type) combination as golden files. This is the cheap regression net DURING refactor, BEFORE the eval harness exists. The corpus seeds the Sprint 1+ eval fixture set.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S0.T1 | Create `evals/snapshots/pre-refactor/` directory structure | agent | 5min |
| S0.T2 | Trigger one digest per zone (× 4) via deployed Railway bot — capture full Discord-rendered output (content + embed + footer + tool-call sequence) into `evals/snapshots/pre-refactor/<character>-<zone>-digest-<timestamp>.md` | operator (Discord-side) | 30min |
| S0.T3 | Trigger micro / weaver / lore_drop / question / callout for ruggy (× 5 post types) — same capture format | operator | 45min |
| S0.T4 | Trigger /ruggy + /satoshi + /mongolian + 5 other characters' chat-mode replies (each with 3 representative prompts) — capture format | operator | 30min |
| S0.T5 | Document capture protocol in `evals/snapshots/README.md` (how to add new snapshots, how snapshots become fixtures in Sprint 1) | agent | 15min |
| S0.T6 | Commit golden snapshots — operator marks each as canonical (front-matter `canonical: true` + operator signature) | operator + agent | 15min |

**Acceptance criteria**:
- [ ] ≥4 digest snapshots (one per zone)
- [ ] ≥5 alt-post-type snapshots (micro/weaver/lore_drop/question/callout)
- [ ] ≥24 chat-mode snapshots (8 characters × 3 prompts)
- [ ] All snapshots committed with operator's `canonical: true` marker
- [ ] `evals/snapshots/README.md` documents protocol

**Out of scope for S0**: any code changes; refactor begins Sprint 1.

---

## Sprint 1 · Phase 0 pilot — agent-gateway port + eval harness foundation

**Duration**: 2-3 days · **Owner**: agent · **Risk**: medium-high (first port lift; new patterns)

**Purpose**: Pilot the four-folder pattern + surgical Effect adoption on the LLM gateway. Ship the eval-harness HTTP endpoint + token issuance + fixture runner + scorer. This is the load-bearing sprint — proves the pattern + ships the regression-detection infrastructure.

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
| S1.T10 | Implement eval harness foundation: `evals/src/{fixture-loader,runner,score-hard,score-soft,compare,reporter}.ts` | agent | 4h |
| S1.T11 | Implement eval HTTP endpoint: `apps/bot/src/eval/handler.ts` (HMAC verify + token check + timestamp + nonce + rate-limit + fixture-allowlist + audit log) | agent | 4h |
| S1.T12 | Implement async job pattern: `POST /eval/run` returns 202 + job_id; `GET /eval/result/:job_id` polls; `.run/eval-jobs/<id>.json` state | agent | 2h |
| S1.T13 | Implement `apps/bot/scripts/issue-eval-token.ts` (operator-local CLI) + `POST /eval/token` Railway endpoint | agent | 2h |
| S1.T14 | Implement `apps/bot/scripts/run-eval.ts` (agent/operator CLI: signs request, POSTs, polls, renders report) | agent | 2h |
| S1.T15 | Convert at least 6 Sprint 0 snapshots into eval fixtures (`evals/fixtures/*.fixture.yaml`); each maps a snapshot to hard + soft scoring criteria | agent | 2h |
| S1.T16 | Write `evals/__tests__/no-production-side-effects.test.ts` per SDD §5.4 (proves eval-mode runtime CANNOT write Discord / DB / mutate state) | agent | 2h |
| S1.T17 | Run full eval harness against all Sprint-0 snapshots; verify pre-refactor parity (live adapter output ≡ pre-refactor snapshot) | agent | 1h |
| S1.T18 | Update PRD/SDD with any learnings (Decision Log entries in `grimoires/loa/NOTES.md`) | agent | 30min |

**Acceptance criteria (Phase 0 gate)**:
- [ ] `compose/llm-gateway/` has `domain/`, `ports/`, `live/`, `mock/` directories with files
- [ ] `llm-gateway.contract.test.ts` exists and passes for both live + mock adapters
- [ ] Existing test suite 641/641 still green (no regressions on Sprint 0 snapshots)
- [ ] Eval HTTP endpoint deployed on Railway (auth gates verified)
- [ ] `bun run apps/bot/scripts/run-eval.ts --fixture <id>` works end-to-end against Railway
- [ ] No-production-side-effects test passes (proves DryRunDeliveryAdapter wired)
- [ ] At least 6 fixtures in `evals/fixtures/` corresponding to Sprint-0 snapshots
- [ ] Eval baseline JSON committed at `evals/baselines/baseline-2026-05-XX.json`
- [ ] `bun run typecheck` + `bun test` both green

**Verification**: agent runs `bun run apps/bot/scripts/run-eval.ts --fixture all` from local; report shows no regressions vs baseline.

**Rollback criteria**: revert if any of (a) existing tests fail, (b) eval vs Sprint-0 snapshot diff exceeds 2 metrics per fixture, (c) Railway endpoint security gates fail any test.

---

## Sprint 2 · Phase 1 — score boundary port migration

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

## Sprint 3 · Phase 2 — identity boundary port migration

**Duration**: 2 days · **Owner**: agent · **Risk**: medium (DB stateful)

**Purpose**: Lift `orchestrator/freeside_auth/server.ts` into `auth/{domain,ports,live,mock}/` shape. Effect-adopted. Critical doctrine: this is the FREESIDE-IDENTITY boundary (see grimoires/loa/context/track-2026-05-13-freeside-identity-rename.md). The rename happens in this sprint.

### Tasks

| ID | Task | Owner | Estimate |
|---|---|---|---|
| S3.T1 | Rename module: `orchestrator/freeside_auth/` → `orchestrator/freeside_identity/` (transitional alias for back-compat) | agent | 1h |
| S3.T2 | Define `identity.port.ts` covering `resolveWallet`, `resolveWallets` (batch), `resolveHandleToWallet`, `resolveMiberaIdToWallet` + IdentityError union | agent | 1h |
| S3.T3 | Lift Pg pool + query logic into `live/pg-midi-profiles.live.ts`. Eval-mode wraps queries in `BEGIN READ ONLY` per SDD §5.3 | agent | 3h |
| S3.T4 | Implement `mock/handle-map.mock.ts` — deterministic wallet→handle map from fixtures | agent | 1.5h |
| S3.T5 | Migrate all callers; update `character.json::tool_invocation_style` to reference `freeside_identity` (if MCP namespace changes) | agent | 2h |
| S3.T6 | Write contract tests | agent | 2h |
| S3.T7 | Eval pass against Sprint-0 snapshots | agent | 30min |

**Acceptance criteria**: identity ported + renamed · Pg eval-mode is read-only (verified by side-effects test) · all tests green.

---

## Sprint 4 · Phase 3 — delivery boundary port migration

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

## Sprint 5 · Phase 4 — side surfaces port migration

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

## Cross-cutting tasks (every sprint)

| ID | Task | When |
|---|---|---|
| CC.1 | Run snapshot capture against current `main` for any new (character × post-type) combo introduced mid-cycle | Per new fixture |
| CC.2 | Update `grimoires/loa/NOTES.md` Decision Log with any deviations from SDD | Per sprint completion |
| CC.3 | Re-run eval harness against ALL fixtures (not just newly added) before merging each sprint's PR | Per sprint completion |
| CC.4 | Bridgebuilder review on each sprint's PR (uses cheval/OAuth shim chain) | Per sprint PR |
| CC.5 | If eval surfaces regression: STOP sprint, root-cause, fix BEFORE merging | Per regression |

## Dependencies + sequencing

```
S0 (snapshot baseline)
  │
  ▼
S1 (agent-gateway + eval harness)  ← load-bearing; everything downstream depends on this
  │
  ├─→ S2 (score) ──┐
  │                │
  ├─→ S3 (identity)│
  │                ├─→ S4 (delivery) ──→ S5 (side surfaces) ──→ READY-FOR-MERGE
  └─→ S2/S3 can parallelize after S1 ships, but operator may prefer sequential for review surface
```

Operator decision: **sequential** vs **parallel S2/S3**. Default: sequential per simstim discipline. Parallel only if operator + agent both have bandwidth.

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
