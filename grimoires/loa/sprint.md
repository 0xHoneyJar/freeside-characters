---
title: Sprint Plan — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.2
simstim_id: simstim-20260513-b7126e67
phase: planning
date: 2026-05-13
prd_ref: grimoires/loa/prd.md (v0.2)
sdd_ref: grimoires/loa/sdd.md (v0.2)
total_sprints: 8 (S0 + S1A + S1B + S2 + S3A + S3B + S4 + S5)
estimated_duration: 14-20 working days
flatline_integrated: [SKP-001-strict-schema+character-enum+scored-threshold, SKP-002-S1-split, SKP-003-rename-split+ip-allowlist+pg-pool-isolation, SKP-004-eval-job-persistence, SKP-005-dryrun-to-S1A+token-lifecycle]
---

> **v0.2 changelog** — integrates 6 Flatline sprint-plan-review findings (2026-05-13, 3-model cheval-routed, $0 cost):
> - **SKP-002 CRIT 920 / SKP-001 CRIT 850** → **Sprint 1 split into S1A + S1B**. S1A ships LLM gateway port + local recorded-fixture runner (no HTTP endpoint, no Railway). S1B ships Railway eval endpoint + token issuance + async jobs. S1A parity gate required before any endpoint exposure. Also moves `DryRunDeliveryAdapter` stub to S1A (was blocked by Sprint 4 dependency).
> - **SKP-001 CRIT 880** → **Scored threshold replaces exact-equality** in eval parity check. New artifact: `evals/thresholds.yaml` committed in S1A defines per-fixture-type minimum hard/soft scores (hard ≥ 0.85, soft ≥ 0.70 default). S1A.T17 passes if fixtures exceed thresholds, NOT if outputs match snapshot byte-for-byte.
> - **SKP-001 CRIT 950 + 860** → **Strict S0 schema + explicit character enumeration**. No '8 characters × 3 prompts' aspirational counts. S0 captures only currently-deployed characters with structured artifacts: raw Discord JSON + rendered markdown + tool-call trace + environment metadata + character version + prompt + timestamp + deterministic filename.
> - **SKP-002 HIGH 780 / SKP-005 CRIT 850** → **Sprint 3 split into S3A + S3B**. S3A: identity port behind existing `freeside_auth` namespace (zero behavioral change). S3B: rename to `freeside_identity` + alias + deprecation tests + config migration. Separates port lift from rename concerns.
> - **SKP-003 HIGH 710 + 760, SKP-005 HIGH 760** → **Eval endpoint hardening adds to S1B**: IP allowlist (Railway private networking OR CIDR allowlist for operator IPs), eval-mode Pg connection pool isolated from live pool with ROLLBACK in finally, token TTL ≤24h, `POST /eval/token/revoke` endpoint, hash-stored tokens in ring buffer.
> - **SKP-004 HIGH 780 + 740** → **Eval job state persistence**: `.run/eval-jobs/` is ephemeral on Railway (lost on container restart). Move job state to existing Postgres instance OR Railway Volume. Acceptance criterion explicit: job state survives container restart.

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

**Acceptance criteria**:
- [ ] `evals/snapshots/README.md` documents the schema BEFORE first capture
- [ ] ≥4 digest snapshots (one per zone: stonehenge, bear-cave, el-dorado, owsley-lab)
- [ ] ≥5 alt-post-type snapshots (one each: micro, weaver, lore_drop, question, callout) on ruggy
- [ ] **Chat-mode snapshots**: 2 currently-active characters (ruggy, satoshi) × 3 representative prompts = 6 snapshots minimum. Additional characters (munkh/kaori/nemu/akane/ren/ruan) get 1 chat snapshot each if their slash command is deployed (verify via `railway logs ... | grep "synced.*commands"` from earlier session)
- [ ] All snapshots conform to schema above; failed-conformance snapshots rejected
- [ ] All snapshots committed with operator's `canonical: true` marker
- [ ] Total snapshot count documented in `evals/snapshots/MANIFEST.md`

**Out of scope for S0**: any code changes; refactor begins Sprint 1A.

---

## Sprint 1A · Phase 0 pilot — LLM gateway port + LOCAL eval runner

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

## Sprint 1B · Eval HTTP endpoint + token issuance + persistent job state

**Duration**: 2 days · **Owner**: agent · **Risk**: medium (production surface; security gates)

**Purpose** (per Flatline SKP-002 CRIT 920): expose the local eval runner from S1A as a Railway-side HTTP endpoint. Adds remote-invocation surface, token issuance, async jobs with persistent storage. **S1A must pass acceptance gate first.**

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

## Sprint 3A · Phase 2 part 1 — identity port (behind existing namespace)

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

## Sprint 3B · Phase 2 part 2 — rename freeside_auth → freeside_identity

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

## Dependencies + sequencing (v0.2)

```
S0 (snapshot baseline · operator-canonical)
  │
  ▼
S1A (LLM gateway port + LOCAL eval runner · NO Railway)
  │  └── load-bearing — parity gate before exposing endpoint
  ▼
S1B (eval HTTP endpoint + tokens + Pg job state)
  │
  ▼
S2 (score boundary)
  │
  ▼
S3A (identity port behind existing namespace)
  │
  ▼
S3B (rename freeside_auth → freeside_identity + alias + deprecation)
  │
  ▼
S4 (delivery boundary + DryRunDeliveryAdapter full impl)
  │
  ▼
S5 (side surfaces + composition root cleanup) ──→ READY-FOR-MERGE
```

**Strict sequential per Flatline SDD review** — parallelization is OUT (was an option in v0.1; v0.2 removes it). Reasoning: each sprint's eval-against-baseline gate depends on the prior sprint's behavior being locked. Parallel work creates non-determinism in baselines.

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
