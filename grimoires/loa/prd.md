---
title: PRD — composable substrate refactor + agent-runnable eval harness + purupuru world-grounding
status: draft
version: 0.4
simstim_id: simstim-20260514-348dce09
phase: discovery
date: 2026-05-13
authors: [zksoju (operator), claude-opus-4-7 (agent)]
prior_cycle_archive: grimoires/loa/cycles/cycle-003/
flatline_integrated: [SKP-001, SKP-002, SKP-003, SKP-004]
---

> **v0.4 changelog** — integrates Flatline PRD review (2026-05-14, 3-model opus+gpt-5.5+gemini-3.1-pro, 100% agreement, $0). **8 HIGH_CONSENSUS auto-integrated**: B1/B2/B3 defined in Success Metrics · budget-cap conflict resolved (FR-14) · Open Questions resolved · FR-10a Path A selected · non-determinism handling (FR-13) · baseline storage/promotion (FR-13) · concrete protected surface (FR-10b) · caretaker activation gate (FR-20). **11 BLOCKERS triaged**: 5 integrated here (FR-6a Phase 0 gate redefined for non-determinism · FR-13 N-sample baselines · FR-8 privacy contract · FR-16 worldId/guildId routing safety · FR-15 wire-compat clause), 6 → Override-to-SDD as required architecture coverage (see "Flatline Blocker Dispositions").
>
> **v0.3 changelog** — folds purupuru world-grounding into the cycle (operator decision 2026-05-14). The substrate refactor and the `ZoneId → RoomId` rename touch the same files — one edit, one cycle, not two. Server scaffolding (channels/roles/verification) is explicitly NOT here — it left for the `discord-deploy` zone ([freeside-cli#14](https://github.com/0xHoneyJar/freeside-cli/issues/14)). What remains in freeside-characters is small and consumer-shaped: the rename, a `RoomManifestPort`, env.ts re-grounding, codex-mcp validation, and the 5-caretaker fold-in. See FR-15..FR-20 + Appendix A. Source brief: `grimoires/loa/context/track-2026-05-14-purupuru-world-grounding.md`.
>
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

**Why world-grounding rides this cycle.** The Discord channels are still mibera-flavored (`stonehenge` / `bear-cave` / `el-dorado` / `owsley-lab`) — but freeside-characters now hosts the 5 purupuru KIZUNA caretakers, and `compose/environment.ts` feeds channel-identity into *every* persona system prompt. The fix — re-grounding the channels in the Tsuheji world — touches the *exact same files* the refactor rewrites (`score/types.ts`, `orchestrator/rosenzu/lynch-primitives.ts`, `config.ts`, `compose/composer.ts`, `ambient/domain/*`). Doing them in separate cycles means touching those files twice and building the eval harness against soon-dead zone names (the old Constraint C2). So world-grounding folds in — but *only the consumer-shaped slice*. The authority chain is **Codex → World → Server**: a per-world Codex (`construct-{world}-codex`, ships `codex-mcp`) *informs* the world-manifest, which *guides — never enforces* — a server-manifest; the server is final authority for its own instance. Server scaffolding (creating channels, roles, verification) is a **freeside zone concern** — the `discord-deploy` zone, [freeside-cli#14](https://github.com/0xHoneyJar/freeside-cli/issues/14) — NOT this cycle. freeside-characters is a pure *consumer* of the resolved Room mapping. The word `zone` goes back to the Codex (where it means a canonical lore element); freeside-characters adopts `Room` (the sealed `world-manifest.schema.json` term).

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
5. **World-ground freeside-characters as a clean consumer of the Room chain.** Rename `ZoneId → RoomId` (adopt the sealed `world-manifest.schema.json` term), introduce a `RoomManifestPort` (born into the four-folder discipline), re-ground `compose/environment.ts` in the Tsuheji places, validate Room references against `codex-mcp` (fuzzy, gap-logging, never rejecting), and fold the 5 KIZUNA caretakers into the runtime roster bound to home Rooms. freeside-characters consumes; it never scaffolds.

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
  | **0 · Pilot vertical slice** | `compose/agent-gateway` (LLM gateway — highest-leverage, most-prone-to-failure surface) | Port defined · live adapter + mock + composition-root wired · existing tests green · 1 fixture exists for digest path · eval harness runs the fixture against live + mock — **both outputs pass the same hard-check suite AND soft-score deltas fall within the per-metric tolerance band** (per SKP-003 CRIT: NOT literal equality — live LLM output is non-deterministic; tolerance model is FR-13) |
  | **1 · Score boundary + Room rename** | `score/client` · `score/types.ts` · `rosenzu/lynch-primitives.ts` | Port + live + mock + fixtures for all 6 Rooms · eval includes pulse-tool calls · cycle-021 type mirrors imported through port · **`ZoneId → RoomId` rename rides here** (FR-15 — the typed enum + `ZONE_FLAVOR`/`ZONE_SPATIAL` live in the exact files this phase ports) |
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
- **FR-8 · Production-replay capability**: snapshot a real Discord message → reverse-engineer fixture (input + ground-truth output). Operator marks fixtures as canonical. **Privacy contract** (per SKP-006 HIGH): production snapshots may capture Discord content, wallet-linked identity, or user prompts — so the replay path MUST (a) run PII redaction + wallet-address scrubbing before any snapshot is written to `evals/fixtures/`, (b) require explicit operator approval before a snapshot is marked canonical, (c) carry a retention policy — non-canonical snapshots expire after a configured window, canonical fixtures are reviewed per-cycle, (d) store snapshots gitignored (not committed), access-controlled like `.run/`. Synthetic fixtures are preferred; production-replay is opt-in per fixture.
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
- **FR-10a · Agent invocation path** (per SKP-002 HIGH · path SELECTED per IMP-004): the agent never holds the long-lived HMAC secret. Instead, agent invokes a **short-lived signed eval token**. **Path A is the selected mechanism**; B and C are recorded as alternatives, not built this cycle.
  - **Path A** (SELECTED): operator runs `bun run apps/bot/scripts/issue-eval-token.ts --ttl 30m` locally; this calls Railway via existing auth to mint a 30-min token; operator pastes token to agent; agent uses it for that session only. **The full token contract — issuer endpoint, mint-request authentication, claims (audience, fixture scope, freeform permission, expiry), signing-key location, revocation, audit logging — is SDD-specified** (Flatline Blocker SKP-002 CRIT → SDD required coverage).
  - **Path B** (not built this cycle): GitHub Actions / OIDC-mediated invocation.
  - **Path C** (not built this cycle): Railway CLI command execution from operator's terminal directly.
- **FR-10b · Read-only / no-delivery by default** (per SKP-003 CRIT): the eval execution path wires Discord-delivery ports to a `DryRunDeliveryPort` (captures intended output, never sends). MCP write-side tools (if any exist) are disabled at the port level — eval-mode `RuntimePort` returns a no-op write. Tests in `evals/__tests__/no-production-side-effects.test.ts` verify the eval runtime cannot:
  - Send a Discord message (webhook or bot)
  - Mutate `midi_profiles` or any DB table
  - Call `mcp__score__*` mutations (if/when score-mibera ships mutation tools)
  - Consume more than the per-eval token budget (FR-14)
  The four bullets above ARE the enumerated protected-surface list (per IMP-008). Side-effecting fixtures explicitly opt-IN via `fixture.side_effects: true` + operator-issued elevated token. **The eval-context port-swap mechanism** — how the eval entrypoint wires `DryRunDeliveryPort` instead of the live adapter given FR-4's single-effect-provide-site — **is SDD-specified** (Flatline Blocker SKP-002 CRIT → SDD required coverage), as is the **elevated-token contract** (allowed fixture IDs, allowed ports, max cost, TTL, required operator identity, mandatory audit fields — SKP-009 HIGH). A test proves a normal token CANNOT run a `side_effects: true` fixture.
- **FR-11**: Scoring layer (hard): regex-based checks for known leak patterns (tool-markup, raw shortcodes), wallet-resolution rate, factor-name accuracy.
- **FR-12**: Scoring layer (soft): LLM-judge for voice register, in-budget word counts, factor verb-form accuracy. Uses smaller/cheaper model for scoring than primary.
- **FR-13 · Baseline + regression detection** (expanded per IMP-006, IMP-007, SKP-005 HIGH): each run produces a JSON artifact. **Baseline storage + promotion**: baselines live at `evals/baselines/<fixture-id>.baseline.json`, version-pinned; a run is promoted to baseline only by explicit operator action (`evals baseline promote <run-id>`), never automatically. **Non-determinism handling**: the first baseline for a fixture is an **N-sample baseline** (default N=5 runs) recording, per metric, a mean + variance band. Regression flags fire only when (a) a deterministic **hard-check** metric (FR-11) changes, or (b) a **soft-score** metric (FR-12) falls outside the baseline variance band beyond the configured tolerance. A single soft-score run drifting *within* band is NOT a regression — this makes FR-6a's ">2 regressions per fixture" rollback criterion noise-resistant.
- **FR-14 · Cost budget** (caps clarified per IMP-002): every eval run records actual token usage. Two distinct thresholds: a **soft target** ($5/run default — exceeding it emits a warning, run continues) and a **hard cap** ($15/run default — run refuses to start if *estimated* cost exceeds it, aborts mid-run if *actual* cost crosses it). Both configurable. The Success Metrics "≤$5 typical / ≤$15 hard cap" row maps to these two thresholds respectively.

### World-Grounding (consumer slice · folds into the refactor's same-file edits)

> Scope discipline: the *consumer-shaped* slice only. Server scaffolding lives in `discord-deploy` ([freeside-cli#14](https://github.com/0xHoneyJar/freeside-cli/issues/14)). See the v0.3 changelog + the "Why world-grounding rides this cycle" frame.

- **FR-15 · `ZoneId → RoomId` rename**: rename the typed enum and all call sites — `score/types.ts` (`ZoneId`, `ZONE_FLAVOR` → `RoomId`, `ROOM_FLAVOR`), `orchestrator/rosenzu/lynch-primitives.ts` (`ZONE_SPATIAL`, `SpatialZoneId` → `ROOM_SPATIAL`, `SpatialRoomId`), `config.ts`, `compose/composer.ts` (`ALL_ZONES` → `ALL_ROOMS`), `ambient/domain/event.ts`, `ambient/domain/primitive-weights.ts`, `ambient/domain/canon-vocabulary.ts`, plus tests. Rides Phase 1 of FR-6a (same files the Score boundary ports). `Room` is the sealed `world-manifest.schema.json` term; `zone` returns to the Codex. **Wire-compatibility clause** (per SKP-003 HIGH): the rename is *internal only*. External score-mcp field names and tool names (`get_zone_digest`, cycle-021 pulse tools, any `zone`-shaped serialized fields) stay UNCHANGED — an adapter boundary maps the external `zone` wire-shape to the internal `RoomId` without altering external JSON. Mapping tests prove `get_zone_digest` + the pulse tools round-trip the old wire shape to internal `RoomId` with zero external-contract drift. `.env` channel-ID keys change additively (new `ROOM_*` keys; old keys honored for a deprecation window).
- **FR-16 · `RoomManifestPort`**: a typed port exposing the resolved Room set. Each entry carries `RoomId`, **`worldId`, `guildId`, `manifestVersion`** (per SKP-004 HIGH — a `channelId` alone is an unsafe routing key in a multi-guild bot), display name, emoji, `archetype` (rosenzu spatial primitive — *active*, drives env.ts), `kind` (world-funnel-topology: Doors/Landing/Identity/Depth — *declared, not yet consumed*, mirrors how `world-manifest` v1.0 "accepts but does not consume" rooms), `channelId`, `homeCharacter?`. **Routing safety**: before any delivery the runtime validates character→world→guild→channel coherence; cross-world posting is an explicit error unless the character is marked a roamer. v1 `live` adapter reads a local `worlds/purupuru.rooms.ts` shaped to `world-manifest.schema.json` `$defs/Room`; `mock` returns a deterministic fixture set; future `live` swaps to the resolved server-manifest from `discord-deploy`. Born into the four-folder discipline (FR-1..FR-4).
- **FR-17 · The 6 purupuru Rooms**: wire the Room set with Discord channel IDs (purupuru guild `1495534680617910396`) — see Appendix A. Caretaker↔Room↔archetype bindings are DIG-proposed; rosenzu `mapping-topology`/`naming-rooms` confirms them *within* Phase 1 (refinement, not a gate — operator: "directionally correct").
- **FR-18 · `env.ts` re-grounding**: `compose/environment.ts`'s `buildEnvironmentContext` emits the Tsuheji Room identity (place name, archetype, kind) into the `{{ENVIRONMENT}}` block of every persona system prompt. `ROOM_FLAVOR` / `ROOM_SPATIAL` carry the purupuru place data; the rosenzu `deriveTemperature` / `deriveSocialDensity` logic is unchanged (archetype stays the active driver).
- **FR-19 · codex-mcp validation**: Room references (in compose, in fixtures) validate against `codex-mcp`'s `validate_world_element` — fuzzy match + coverage-gap logging, **never rejecting**. Anti-hallucination on Room/place names without blocking divergence. v1 may stub against the local manifest if `construct-purupuru-codex` isn't ready; the validation *seam* ships regardless.
- **FR-20 · 5-caretaker fold-in**: wire akane/kaori/nemu/ren/ruan into the runtime roster, each bound to a home Room (Appendix A). They publish to the purupuru guild (`1495534680617910396`); ruggy/satoshi/mongolian stay roamers (THJ guild, no home Room). Per-world manifest model — purupuru-guild Rooms and THJ-guild rooms are separate manifests. The caretaker `character.json` files already exist as `stage: character` scaffolds; this FR wires them in (`CHARACTERS` env, roster enumeration), it does NOT re-author personas. **Activation gate** (per IMP-010): a newly-wired caretaker does NOT post to the live purupuru guild until it passes an explicit activation check — its persona has ≥1 eval fixture passing the hard-check suite AND the operator flips a per-character `activated: true` flag. Until activated, the caretaker is roster-enumerated but delivery-suppressed (dry-run only) — no unverified persona output reaches a live community.

## Non-Goals

- ❌ Replacing existing unit tests (they continue to live in `*.test.ts` alongside their target files; eval is behavioral, tests are structural).
- ❌ Auto-generating fixtures from production logs (operator approves canonical fixtures manually — keeps the signal clean).
- ❌ Continuous-eval cron (not yet — runs are agent-triggered or operator-triggered; cron is a future cycle).
- ❌ Cross-character comparison ("is satoshi better than ruggy") — eval is per-character behavioral verification, not benchmarking.
- ❌ Refactoring score-mibera or other repos (substrate is locked; freeside-characters-only refactor).
- ❌ Front-loading the entire codebase into the refactor — only modules that cross I/O boundaries OR are eval-surface-adjacent.
- ❌ Discord server scaffolding (channel/category/role/verification creation) — that is the `discord-deploy` zone's job ([freeside-cli#14](https://github.com/0xHoneyJar/freeside-cli/issues/14)). freeside-characters *consumes* the resolved Room mapping; it never creates Discord structure.
- ❌ Authoring the upstream purupuru world-manifest or `construct-purupuru-codex` — the v1 `RoomManifestPort` `live` adapter reads a *local* `worlds/purupuru.rooms.ts`; consuming the upstream world-manifest/registry is a future swap (FR-16).
- ❌ rosenzu hardening of the Room↔caretaker↔archetype matrix as a *blocker* — the DIG-proposed mapping (Appendix A) ships as the starting point; rosenzu `mapping-topology`/`naming-rooms` refines it *within* Phase 1.
- ❌ Renaming the bot account (currently "Loa") — deferred per operator.

## Constraints

- **Operator's hard constraint**: Production Bedrock credentials must NEVER load into the local agent or operator environment. Railway-side execution only. HMAC-shared-secret auth for the eval endpoint is the operator-managed surface.
- **Backward compatibility**: The refactor must not break existing production behavior — every external surface (Discord posts, MCP responses, slash-command replies) keeps current shape.
- **Room-aware**: 6 purupuru Rooms (Appendix A) × 7 post-types × multiple characters = large eval surface; the harness must scale tractably (lazy fixture loading, parallelizable execution). The eval surface is defined in terms of `RoomId` *after* the FR-15 rename — fixtures are authored against Room names, never the retired zone names. (This constraint supersedes the v0.2 "Zone-aware" wording, which referenced the now-retired `stonehenge`/`bear-cave`/`el-dorado`/`owsley-lab` set.)
- **Cost discipline**: Eval runs must be cheap enough to run often (per-PR ideally). Bedrock + scoring LLM costs add up — hard budget gate is FR-14.
- **Test infrastructure changes** (per `construct-fagan` pattern P5): if eval test infra swallows errors, real failures get hidden. Defensive try/catch in eval setup is a FAGAN-class anti-pattern.

## Success Metrics

| Metric | Target |
|---|---|
| Modules with formal `domain/ports/live/mock` shape | ≥80% of `packages/persona-engine/src/` modules that cross I/O boundaries (currently ~15%) |
| `import discord.js` / `import pg` / `import @anthropic-ai/...` outside live adapters | 0 |
| LLM-output surfaces covered by eval | 7/7 (digest, micro, weaver, lore_drop, question, callout, reply) |
| Eval run cost (per full run) | ≤$5 USD soft target (warn) · ≤$15 hard cap (refuse/abort) — per FR-14 |
| Eval run time (per full run) | ≤10 min typical |
| Regression-detection latency (code change → eval signal) | ≤1 invocation (agent-triggered) |
| Existing test coverage preservation | 641/641 tests still green (current baseline) |
| Production bugs reproducible via fixture | All 3 from the 2026-05-13 session covered by named fixtures — **B1** tool-call markup leak (`<tool_use>` XML reached Discord) · **B2** emoji-shortcode failure (raw `:shortcode:` not translated to guild emoji) · **B3** stale `computed_at` (digest surfaced an outdated score timestamp) |

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
- [`freeside-cli#14`](https://github.com/0xHoneyJar/freeside-cli/issues/14) — the `discord-deploy` zone definition. freeside-characters' `RoomManifestPort` is the downstream consumer of the Room mapping that zone will eventually produce; v1 ships a local manifest, swap-ready. Not a blocker for this cycle.
- `construct-mibera-codex` (`codex-mcp` · `validate_world_element`) — the anti-hallucination validation surface for Room references (FR-19). A `construct-purupuru-codex` is the eventual per-world source; not a blocker for v1.
- `world-purupuru` `lore-bible.md` — canonical source for the 6 Room names + Tsuheji place descriptions (Appendix A).

## Open Questions — resolved (per IMP-003, Flatline v0.4)

1. ~~**Refactor migration order**~~ — RESOLVED: FR-6a fixes the order (Phase 0 = `compose/agent-gateway`, then Score → Identity → Delivery → Side surfaces). No open question.
2. **Eval scoring LLM** — independent-provider small model (Gemini-Flash or GPT-5-mini) to avoid same-vendor bias with the primary Bedrock path; exact model locked in the SDD.
3. **Fixture format** — `*.fixture.yaml` (YAML), per FR-7. Decided.
4. **Production-replay** — synthetic-first; production-replay is opt-in per fixture under the FR-8 privacy contract. Verbatim recording only when synthetic coverage demonstrably misses a real failure mode.
5. **CI integration** — eval-on-demand this cycle (agent/operator-triggered). Per-PR auto-fire deferred to a future cycle (depends on the measured cost profile).

## Flatline Blocker Dispositions (v0.4 · 2026-05-14)

11 BLOCKERS from the 3-model PRD review. 5 integrated into this PRD (above). 6 are **architecture-mechanism gaps → Override, carried to the SDD as required coverage** — the SDD (Phase 3) MUST address each; they are NOT deferred to post-implementation.

| Blocker(s) | Sev | Concern | SDD must specify |
|---|---|---|---|
| SKP-001 + SKP-004 (Railway in-memory state) | CRIT 835 · HIGH 790 · HIGH 730 | nonce cache + rate-limit are in-memory — wiped on redeploy, per-replica, bypassable; eval may share the live bot process | shared nonce/rate-limit store (Redis or durable Railway store) keyed by caller-id + token-id; explicit Railway instance-count assumption; **isolated eval service/replica** separate from the live digest bot |
| SKP-002 (token bootstrap) | CRIT 860 | FR-10a Path A token minting underspecified | full token contract — issuer endpoint, mint-request auth, claims, expiry, audience, fixture scope, signing-key location, revocation, audit log; test proving the local agent never receives long-lived signing material |
| SKP-002 + SKP-009 (dry-run port-swap) | CRIT 850 · HIGH 735 | FR-10b port-swap contradicts FR-4 single-provide-site; elevated-token path undefined | the eval-context composition mechanism (dedicated eval entrypoint OR request-scoped runtime layer); acceptance test proving the *deployed* endpoint uses dry-run ports; elevated-token claim shape + a test that normal tokens can't run side-effect fixtures |

Rationale (logged): these are mechanism-specification gaps, and mechanism is the SDD's job — not a PRD-level gap, not a post-implementation defer. Phase 3 architecture treats each as mandatory SDD coverage; Phase 4 Flatline-SDD re-reviews whether the SDD closed them.

## Out of scope (revisit in future cycles)

- Multi-tenant eval (other guilds beyond THJ)
- Real-time eval-as-a-service (always-on monitoring)
- Cross-character A/B testing
- Eval for image-generation paths (satoshi imagegen, ruggy avatar)
- Public eval dashboard (eval results visible to community)

---

## Appendix A — Purupuru Rooms

The 6 Rooms `RoomManifestPort` resolves for v1 (FR-16, FR-17). Discord channel IDs are operator-created in the purupuru guild `1495534680617910396` (2026-05-14). `archetype` / `kind` / `homeCharacter` are DIG-proposed — rosenzu confirms within Phase 1 (FR-17). Canon source: `world-purupuru/grimoires/purupuru/lore-bible.md` Named Locations.

| `RoomId` | display | channelId | archetype | kind | homeCharacter |
|---|---|---|---|---|---|
| `gateway-cafe` | ☕gateway-cafe | `1498822402900230294` | node | Landing | — (shared hub) |
| `sky-eyes-dome` | 🔭sky-eyes-dome | `1498822450316578907` | inner_sanctum | Depth | `ren` (Metal 金) |
| `musubi-station` | 🚉musubi-station | `1498822480587002038` | edge | Doors | `ruan` (Water 水) |
| `golden-veil` | 🍯golden-veil | `1498822512442609694` | district | Identity | `kaori` (Wood 木) |
| `kiln-and-kettle` | 🏺kiln-and-kettle | `1504543404065947762` | district | Identity | `nemu` (Earth 土) |
| `spiderweb-mall` | 🕸️spiderweb-mall | `1504543433740652615` | district | Doors | `akane` (Fire 火) |

Roamers (no home Room, THJ guild): `ruggy`, `satoshi`, `mongolian`.

Full brief + the Codex→World→Server authority chain: `grimoires/loa/context/track-2026-05-14-purupuru-world-grounding.md`.
