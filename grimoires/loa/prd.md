---
title: PRD — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.2
simstim_id: simstim-20260513-b7126e67
phase: discovery
date: 2026-05-13
authors: [zksoju (operator), claude-opus-4-7 (agent)]
prior_cycle_archive: grimoires/loa/cycles/cycle-003/
flatline_integrated: [SKP-001, SKP-002, SKP-003, SKP-004]
---

> **v0.2 changelog** — integrates Flatline PRD review findings (2026-05-13, 3-model cheval-routed, $0 cost):
> - SKP-001 CRIT (910) → eval endpoint security contract (HMAC canonicalization, timestamp window, nonce/replay, rate limits, payload size limits, fixture allowlist, audit logs, secret rotation, kill switch)
> - SKP-002 HIGH (760) → bootstrap mechanism specified (Railway-issued short-lived signed eval tokens; operator's local agent never holds the long-lived HMAC secret)
> - SKP-003 CRIT (870) → eval execution is **read-only / no-delivery by default**; isolated eval ledgers; Discord write surfaces hard-blocked at port level; tests prove no production-visible side effects
> - SKP-004 HIGH (740) → phased migration with vertical-slice acceptance gates (one port end-to-end before lifting the rest)
> - Operator clarification: Effect adoption is **surgical, not wholesale** — introduced at load-bearing failure surfaces (LLM gateway, score-mcp, freeside_auth) where loud error surfacing matters. Rest of code stays on plain TS with four-folder discipline.

# Product Requirements Document

## Why

**Immune system engineering.** Today's freeside-characters codebase mixes pure logic (composers, formatters, headline-lock) with side-effecting adapters (HTTP, DB, LLM SDK calls, Discord I/O) at every layer. Bug-detection happens *after* deploy — three production bugs surfaced in a single session (tool-call markup leak, emoji-shortcode failure, stale `computed_at`) because there was no agent-runnable verification loop between code change and Discord-observed output.

The operator's framing: *"score is substrate (data accuracy paramount) · characters are framing, persona, and voicing layer · creative freedom in expression but tools and schemas are cleanly defined contracts."* This PRD makes that framing structural: push side effects to the edges (per `construct-effect-substrate` doctrine — four-folder pattern, ports/live/mock, single-effect-provide-site) AND give the agent (me) a regression-detecting eval harness that exercises every LLM-output surface.

The arch refactor lands FIRST so the eval harness can target clean seams (ports, not implementations). The eval harness is the *proof* the refactor preserved behavior.

## Users

| Primary | Secondary |
|---|---|
| **The agent (Claude Opus 4.7 et al.)** — must be able to run eval against production credentials *without those credentials ever loading into the local agent environment*. Hard constraint from operator. | **The operator (zkSoju)** — final reviewer; runs `/eval` slash command or eval-CLI from local terminal, sees structured pass/fail/regression report, surfaces gradients (what got better, what got worse). |

The eval harness is **not** a unit-test framework — it's a behavioral verification surface for non-deterministic LLM outputs. Gradients matter more than binary pass/fail.

## Goals

1. **Refactor freeside-characters to the four-folder doctrine** (`domain/ports/live/mock`) for every module that crosses an I/O boundary. Score-MCP, freeside_auth, codex, rosenzu, deliver/webhook, compose/agent-gateway, orchestrator — each gets a typed port + live adapter + mock for tests.
2. **Single-effect-provide-site** for the whole runtime: one composition root in `apps/bot/src/runtime.ts` (or equivalent) that wires every port to its live adapter once. Replaceable for eval contexts.
3. **Ship an agent-runnable eval harness** that covers every LLM-output surface (digest · micro · weaver · lore_drop · question · callout · reply — 7 fragments × N characters):
   - Loads behavioral fixtures (synthetic + production-snapshotted).
   - Fires each fixture through the production system on Railway (using prod Bedrock credentials).
   - Captures full structured output (embed body · footer · tool calls · timing).
   - Scores outputs against fixture expectations (hard checks: no tool-markup leak, no raw emoji shortcodes, identity-chain applied; soft checks: voice register, factor name accuracy, in-budget word counts).
   - Compares against baseline runs to surface regressions per metric per fixture.
   - Reports in agent-readable + operator-readable format.
4. **Production credentials never leave Railway.** Eval harness invokes Railway via authenticated HTTP endpoint; Railway-side executes against prod env; results stream back as structured JSON.

## Functional Requirements

### Refactor (arch first · phased migration per SKP-004)

- **FR-1**: Every external dependency (score-mcp, freeside_auth DB, Bedrock LLM, Discord, codex, rosenzu, emojis-registry, image-storage) has a typed port in `*.port.ts`.
- **FR-2**: Every port has a `*.live.ts` adapter (the side-effecting implementation) and a `*.mock.ts` adapter (deterministic for tests + eval).
- **FR-3**: Domain types and pure functions live in `domain/` and `system/` (composers, formatters, headline-lock, sanitize, emoji-translate).
- **FR-4**: Composition root at one site wires ports → live adapters. Eval context wires ports → mock or recorded-live adapters.
- **FR-5**: No `import { ... } from 'discord.js'` outside `deliver/live/` and `interactions/live/`. Same for `pg`, `@anthropic-ai/claude-agent-sdk`, etc.
- **FR-6**: Existing tests continue to pass. New ports get integration tests against mocks.
- **FR-6a · Phased vertical-slice migration** (per SKP-004 HIGH): the refactor ships in **5 ordered phases**, each gated by acceptance criteria. **Phase 0 must complete and pass eval BEFORE Phase 1 begins.**

  | Phase | Module(s) | Acceptance gate |
  |---|---|---|
  | **0 · Pilot vertical slice** | `compose/agent-gateway` (LLM gateway — highest-leverage, most-prone-to-failure surface) | Port defined · live adapter + mock + composition-root wired · existing tests green · 1 fixture exists for digest path · eval harness runs the fixture against live + mock; outputs match |
  | **1 · Score boundary** | `score/client` | Port + live + mock + fixtures for all 4 zones · eval includes pulse-tool calls · cycle-021 type mirrors imported through port |
  | **2 · Identity boundary** | `orchestrator/freeside_auth` | Port + live + mock · `resolve_wallet`/`resolve_wallets` covered · DB connection pool lifecycle isolated; mock returns deterministic handles for fixtures |
  | **3 · Delivery boundary** | `deliver/client`, `deliver/webhook`, `deliver/post` | Ports for bot + webhook + dispatch · DryRunDeliveryPort wired by default in eval · existing Discord write surfaces hard-blocked at port boundary |
  | **4 · Side surfaces** | `cron/scheduler`, `voice/config-loader`, `persona/loader`, codex/rosenzu/emojis servers | Each ported using the 5-command lift recipe (cp exemplar trio → sed-rename → wire into composition root → cp test → verify) |

  **Rollback criteria per phase**: phase reverts cleanly (single git revert) if either (a) existing test suite fails on a non-flaky test, OR (b) eval harness flags >2 regressions per fixture vs phase-pre-baseline.

- **FR-6b · Effect surgical adoption** (per operator framing 2026-05-13): Effect is introduced ONLY in load-bearing failure surfaces where loud error surfacing matters most. The rest of the codebase stays on plain TS with the four-folder pattern (matching `ambient/`'s existing shape — pattern without Effect). Effect-adopted modules:
  - **`compose/agent-gateway`** (Phase 0 pilot) — typed error channel for LLM provider failures (rate limit, content-too-large, auth, malformed response). Loud failure mode is critical for digest cron.
  - **`score/client`** (Phase 1) — typed error channel for MCP transport failures, stale cache, schema-version mismatches.
  - **`orchestrator/freeside_auth`** (Phase 2) — typed error channel for DB unavailability, unresolvable wallet, additional_wallets edge cases.

  Other phases (3, 4) stay on plain TS unless the operator promotes a specific module to Effect after seeing the Phase 0-2 ergonomics.

### Eval Harness

- **FR-7**: Fixture format (`*.fixture.yaml` in `evals/fixtures/`): named fixture, post_type (digest|micro|weaver|...), character, input (ZoneDigest stub or chat prompt + context), expected (hard checks + soft heuristics).
- **FR-8**: Production-replay capability: snapshot a real Discord message → reverse-engineer fixture (input + ground-truth output). Operator marks fixtures as canonical.
- **FR-9**: CLI/agent entry: `evals run [--fixture <id>] [--character <id>] [--surface <post_type>]`. Default = run all.
- **FR-10**: Railway-side execution endpoint: `POST /eval/run`. **Full endpoint security contract** (per SKP-001 CRIT):
  - HMAC-SHA256 signed payload using a long-lived secret stored ONLY in Railway env (`EVAL_HMAC_SECRET`).
  - Canonicalized signing input (method + path + timestamp + nonce + body sha256).
  - Timestamp window: ±5 minutes (rejects stale + future-dated requests).
  - Nonce-based replay protection: in-memory LRU cache of recent nonces (10 min TTL).
  - Per-caller rate limit: 10 requests / minute / caller-id.
  - Request payload size limit: 64 KiB (rejects oversized prompt-injection attempts).
  - **Fixture-allowlist execution**: endpoint accepts a fixture ID, NOT arbitrary prompts. Arbitrary-prompt mode requires `?freeform=1` flag + an operator-only token (separate from agent token).
  - Structured audit log per invocation at `.run/eval-audit.jsonl` (caller-id, fixture-id, timestamp, latency, cost, errors).
  - Kill switch: `EVAL_ENDPOINT_DISABLED=true` env flag halts all eval execution; the bot continues normal operation.
  - Secret rotation: secret roll requires Railway redeploy; old secret accepted for 24h grace window for in-flight rotations.
- **FR-10a · Agent invocation path** (per SKP-002 HIGH): the agent never holds the long-lived HMAC secret. Instead, agent invokes a **short-lived signed eval token** issued by an operator-controlled mechanism (one of three paths, ranked by operator preference):
  - **Path A** (recommended): operator runs `bun run apps/bot/scripts/issue-eval-token.ts --ttl 30m` locally; this calls Railway via existing auth to mint a 30-min token; operator pastes token to agent; agent uses token for that session only.
  - **Path B**: GitHub Actions / OIDC-mediated invocation — agent triggers a workflow that signs requests using GitHub-issued OIDC identity tied to repo permissions.
  - **Path C**: Railway CLI command execution from operator's terminal directly (`railway run --service ... bun run apps/bot/scripts/run-eval.ts`) — operator-driven, no agent invocation.
- **FR-10b · Read-only / no-delivery by default** (per SKP-003 CRIT): the eval execution path wires Discord-delivery ports to a `DryRunDeliveryPort` (captures intended output, never sends). MCP write-side tools (if any exist) are disabled at the port level — eval-mode `RuntimePort` returns a no-op write. Tests in `evals/__tests__/no-production-side-effects.test.ts` verify the eval runtime cannot:
  - Send a Discord message (webhook or bot)
  - Mutate `midi_profiles` or any DB table
  - Call `mcp__score__*` mutations (if/when score-mibera ships mutation tools)
  - Consume more than the per-eval token budget (FR-14)
  Side-effecting fixtures explicitly opt-IN via `fixture.side_effects: true` + operator-issued elevated token.
- **FR-11**: Scoring layer (hard): regex-based checks for known leak patterns (tool-markup, raw shortcodes), wallet-resolution rate, factor-name accuracy.
- **FR-12**: Scoring layer (soft): LLM-judge for voice register, in-budget word counts, factor verb-form accuracy. Uses smaller/cheaper model for scoring than primary.
- **FR-13**: Baseline + regression detection: each run produces a JSON artifact; next run diffs against the previous baseline; flagged regressions per metric per fixture.
- **FR-14**: Cost budget: every eval run records actual token usage. Hard cap per run (default $5, configurable). Refuse to start if budget exceeded.

## Non-Goals

- ❌ Replacing existing unit tests (they continue to live in `*.test.ts` alongside their target files; eval is behavioral, tests are structural).
- ❌ Auto-generating fixtures from production logs (operator approves canonical fixtures manually — keeps the signal clean).
- ❌ Continuous-eval cron (not yet — runs are agent-triggered or operator-triggered; cron is a future cycle).
- ❌ Cross-character comparison ("is satoshi better than ruggy") — eval is per-character behavioral verification, not benchmarking.
- ❌ Refactoring score-mibera or other repos (substrate is locked; freeside-characters-only refactor).
- ❌ Front-loading the entire codebase into the refactor — only modules that cross I/O boundaries OR are eval-surface-adjacent.

## Constraints

- **Operator's hard constraint**: Production Bedrock credentials must NEVER load into the local agent or operator environment. Railway-side execution only. HMAC-shared-secret auth for the eval endpoint is the operator-managed surface.
- **Backward compatibility**: The refactor must not break existing production behavior — every external surface (Discord posts, MCP responses, slash-command replies) keeps current shape.
- **Zone-aware**: 4 zones (stonehenge, bear-cave, el-dorado, owsley-lab) × 7 post-types × multiple characters = large eval surface; the harness must scale tractably (lazy fixture loading, parallelizable execution).
- **Cost discipline**: Eval runs must be cheap enough to run often (per-PR ideally). Bedrock + scoring LLM costs add up — hard budget gate is FR-14.
- **Test infrastructure changes** (per `construct-fagan` pattern P5): if eval test infra swallows errors, real failures get hidden. Defensive try/catch in eval setup is a FAGAN-class anti-pattern.

## Success Metrics

| Metric | Target |
|---|---|
| Modules with formal `domain/ports/live/mock` shape | ≥80% of `packages/persona-engine/src/` modules that cross I/O boundaries (currently ~15%) |
| `import discord.js` / `import pg` / `import @anthropic-ai/...` outside live adapters | 0 |
| LLM-output surfaces covered by eval | 7/7 (digest, micro, weaver, lore_drop, question, callout, reply) |
| Eval run cost (per full run) | ≤$5 USD typical, ≤$15 hard cap |
| Eval run time (per full run) | ≤10 min typical |
| Regression-detection latency (code change → eval signal) | ≤1 invocation (agent-triggered) |
| Existing test coverage preservation | 641/641 tests still green (current baseline) |
| Production bugs reproducible via fixture | All 3 from 2026-05-13 session (B1/B2/B3) covered by named fixtures |

## Risks + Dependencies

| Risk | Mitigation |
|---|---|
| **Refactor breaks production** during transition | Each port migration ships behind a `live`-only adapter first; mock comes after; existing tests must stay green at each commit |
| **Eval costs spiral** (multi-character × multi-surface × Bedrock) | Hard budget gate (FR-14), per-fixture token estimates, lazy-eval subsets (run only changed character/surface) |
| **Drift between eval harness mock and production live** | Hand-port-with-drift pattern (per `construct-effect-substrate`): CI diffs port interface vs live + mock at every PR |
| **Operator's hard constraint conflicts with rapid iteration** | Railway endpoint is the single mechanism — once it exists, agent + operator both invoke via shared HTTP surface. No local-credential paths shipped |
| **Soft-scoring LLM-judge produces inconsistent scores** | Lock scoring model + prompt version; record both in eval output for reproducibility |
| **Fixture corpus grows unbounded** | Per-cycle review: prune fixtures that no longer signal; canonical fixtures only |

## Dependencies

- `construct-effect-substrate` (doctrine pack at `0xHoneyJar/construct-effect-substrate`) — reference architecture, not a runtime dep.
- `construct-fagan` (just merged P18 doctrine) — eval scoring layer may invoke FAGAN-class pattern checks as one scoring channel.
- Existing `cycle-021` pulse tools (merged today) — eval fixtures will exercise these alongside legacy `get_zone_digest`.
- Railway production environment (Bedrock keys, score-mibera MCP key, freeside_auth DB) — the eval endpoint runs against this.
- `loa#879` upstream bug (`claude_headless_adapter` env-leak) — not blocking, but operator-OAuth shim used in this session as a workaround pattern.

## Open Questions (for Flatline + operator review)

1. **Refactor migration order**: which port should land first? Score-MCP (highest churn, most leverage)? Or freeside_auth (cleanest current boundary)?
2. **Eval scoring LLM**: which model? Smaller-cheaper-Anthropic? Or independent provider (GPT-5-mini, Gemini-Flash) to avoid same-vendor bias?
3. **Fixture format**: YAML + Markdown front-matter? Or pure JSON? Or TypeScript modules?
4. **Production-replay**: do we need to record real production digests verbatim, or is synthetic fixture coverage sufficient?
5. **CI integration**: should every PR auto-fire a scoped eval against changed surfaces? Or eval-on-demand only?

## Out of scope (revisit in future cycles)

- Multi-tenant eval (other guilds beyond THJ)
- Real-time eval-as-a-service (always-on monitoring)
- Cross-character A/B testing
- Eval for image-generation paths (satoshi imagegen, ruggy avatar)
- Public eval dashboard (eval results visible to community)
