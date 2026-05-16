---
title: SDD — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.4
simstim_id: simstim-20260514-348dce09
phase: architecture
date: 2026-05-14
prd_ref: grimoires/loa/prd.md (v0.4)
flatline_integrated: [SKP-001-snapshot, SKP-002-credentials, SKP-003-readonly+timeout+effect-boundary, SKP-004-contract-tests]
---

> **v0.4 changelog** — integrates Flatline SDD review (2026-05-14, 3-model, 76% agreement, $0): 7 HIGH_CONSENSUS + 2 of 3 DISPUTED accepted + 7 BLOCKERS all resolved. Surgical edits: §1.3 gains per-character delivery resolution (SKP-003) · §1.5 snapshot protocol diffs deterministic-surface-only (SKP-001 CRIT 855). New **§11 Flatline SDD v0.4 review integration** consolidates the rest — eval API/data-model contracts, token + per-token request-signing, read-only DB role + score-tool allowlist, Q2/Q4 regression semantics, routing-safety ownership, Phase 0 sequencing. One cosmetic finding (IMP-012, section order) skipped.
>
> **v0.3 changelog** — revised against PRD v0.4 (2026-05-14). Adds **§9 World-Grounding architecture** (`RoomManifestPort` · `ZoneId→RoomId` wire-compat adapter · env.ts re-grounding · codex-mcp validation seam · caretaker fold-in + activation gate — FR-15..FR-20). Adds **§10 Flatline SDD-blocker resolutions** — closes the 6 PRD-blocker Overrides: eval-service isolation + shared replay store (§10.1) · token-bootstrap contract (§10.2) · dry-run port-swap confirmed + deployed-endpoint test (§10.3) · elevated-token contract (§10.4). De-duplicates the §4.3 `POST /eval/token` block.
>
> **v0.2 changelog** — integrates 5 substantive Flatline SDD-review findings (2026-05-13, 3-model cheval-routed, $0 cost):
> - **Behavioral snapshot protocol PRE-refactor** (SKP-001 CRIT 880) → new §1.5: golden-snapshot capture before Phase 0 begins; manual snapshots are the regression net during refactor before eval harness exists
> - **Eval mode read-only enforcement** (SKP-003 CRIT 870, 830) → §5.3 expanded: per-adapter read-only mechanism + contract tests prove the invariant
> - **Async eval execution** (SKP-003 HIGH 780) → §4.3 revised: POST returns 202 + job-id; GET /eval/result/:job-id for polling (solves proxy-timeout problem on long runs)
> - **Effect/Promise boundary convention** (SKP-003 HIGH 760) → new §1.6: every Effect-exported function wraps to `Promise<Result<X, E>>` at the module boundary; lint rule enforces
> - **Contract tests per port** (SKP-004 HIGH 720) → new §6.1: shared `*.contract.test.ts` that BOTH live and mock adapters must pass; catches interface-vs-implementation drift

# Software Design Document

## 1. System architecture overview

### 1.1 Three architectural layers

```
┌──────────────────────────────────────────────────────────────────┐
│  COMPOSITION ROOT  (apps/bot/src/runtime.ts)                      │
│  one site · wires every port → live or mock adapter               │
│  Layer-style composition (without Effect at this layer)           │
└──────────────────────────┬───────────────────────────────────────┘
                           │ provides
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOMAIN + PORTS  (packages/persona-engine/src/<module>/{domain,   │
│                                                    ports}/)       │
│  pure types · pure functions · port interfaces (*.port.ts)        │
│  zero side effects · zero runtime deps · grep-enumerable          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ implemented by
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  EDGES  (packages/persona-engine/src/<module>/{live,mock}/)       │
│  *.live.ts · side-effecting adapters (HTTP, DB, Discord, SDK)     │
│  *.mock.ts · deterministic test/eval adapters                     │
│  Effect.tryPromise + typed error channel ONLY in Phase 0-2 modules│
└──────────────────────────────────────────────────────────────────┘
```

Per `construct-effect-substrate` doctrine: the four-folder pattern + suffix-as-type + single-effect-provide-site. Pattern lands first (all phases); Effect lands surgically (Phase 0-2 only).

### 1.2 Effect surgical adoption boundary

Effect's typed error channel + `Effect.tryPromise` are the **load-bearing primitives** for making failures loud at type-check time, not runtime. Surgical adoption means:

| Module | Effect? | Why |
|---|---|---|
| `compose/agent-gateway` (LLM gateway) | ✅ Effect | LLM failures cascade silently today (Bedrock empty result, rate limit, content-too-large). Typed `LLMError` discriminated union makes every failure case visible at the call site. |
| `score/client` (MCP transport) | ✅ Effect | Stale-cache + schema-version-mismatch + transport-error are 3 distinct failures with different remediation. Typed `ScoreError` distinguishes them. |
| `orchestrator/freeside_auth` (identity DB) | ✅ Effect | `db_unavailable`, `unknown_wallet`, `additional_wallets_ambiguous` need distinct handling; typed errors make ALL THREE handled visibly. |
| `deliver/client`, `deliver/webhook`, `deliver/post` | ❌ Plain TS | Discord errors are coarse (rate limit / forbidden / not found); existing error handling is adequate. |
| `cron/scheduler` | ❌ Plain TS | Cron failures don't cascade into user-visible content. Plain try/catch suffices. |
| `voice/config-loader`, `persona/loader` | ❌ Plain TS | File-read failures at boot are fatal anyway; Effect adds ceremony without value. |
| `codex`, `rosenzu`, `emojis` (MCP servers) | ❌ Plain TS | Internal MCP tool registration; failures localized. |

**The boundary rule**: Effect is for modules where failures need to be SURFACED LOUDLY across multiple consumers. Plain TS for modules where failures are local + handled at the call site.

### 1.3 Composition root design

Single composition root at `apps/bot/src/runtime.ts`. The world is wired exactly once:

```typescript
// apps/bot/src/runtime.ts (sketch)
import * as ScorePort from '@persona-engine/score/ports/score.port';
import { LiveScoreAdapter } from '@persona-engine/score/live/score.live';
import { MockScoreAdapter } from '@persona-engine/score/mock/score.mock';
// ... ports for: llm-gateway, identity, delivery, scheduler, persona-loader, etc.

export type RuntimeMode = 'live' | 'eval' | 'test';

export function buildRuntime(mode: RuntimeMode, config: RuntimeConfig): Runtime {
  switch (mode) {
    case 'live': return {
      score: LiveScoreAdapter(config.scoreMcp),
      llm:   LiveLLMAdapter(config.llmProvider),
      identity: LiveIdentityAdapter(config.dbUrl),
      delivery: LiveDeliveryAdapter(config.discord),
      // ...
    };
    case 'eval': return {
      score: LiveScoreAdapter(config.scoreMcp),     // read-only against prod
      llm:   LiveLLMAdapter(config.llmProvider),    // live for behavioral signal
      identity: LiveIdentityAdapter(config.dbUrl),  // read-only
      delivery: DryRunDeliveryAdapter(config.captureSink),  // NEVER WRITES
      // ...
    };
    case 'test': return {
      score: MockScoreAdapter(config.testFixtures),
      llm:   MockLLMAdapter(config.testFixtures),
      identity: MockIdentityAdapter(config.testFixtures),
      delivery: NullDeliveryAdapter(),
      // ...
    };
  }
}
```

CI gate: `grep -rE "buildRuntime\(" --include="*.ts" packages/ apps/` returns 0 or 1 (excluding tests).

**Per-character port resolution** (per Flatline SDD SKP-003 HIGH 720): `delivery` is NOT a single runtime-wide adapter — the composition root resolves it as a function of `CharacterId`:

```typescript
// runtime.delivery is a resolver, not a bare adapter:
deliveryFor: (characterId: CharacterId) => DeliveryPort
```

In `live` mode, `deliveryFor(id)` returns `LiveDeliveryAdapter` for activated characters and `DryRunDeliveryAdapter` for `activated: false` caretakers (the §9.5 activation gate). In `eval` mode, `deliveryFor` always returns `DryRunDeliveryAdapter`. The activation-gate filter runs INSIDE the composition root — the single place that reads `character.activated`. Contract test (`runtime.contract.test.ts`) proves an `activated: false` caretaker's resolved delivery port is dry-run even in `live` mode.

### 1.5 Behavioral snapshot protocol (pre-refactor regression net)

Per Flatline SKP-001 CRIT (880): the eval harness is the proof, but the eval harness ships in Phase 0 alongside the agent-gateway refactor. Until then, the refactor needs a SIMPLER regression net.

**Protocol** (before Phase 0 begins):
1. Trigger one digest per zone (× 4 zones), one chat reply per character (× 8 characters), and one each of micro / weaver / lore_drop / question / callout via the deployed Railway bot.
2. Capture the FULL Discord-rendered output (content + embed body + footer + tool-call sequence + timing) to `evals/snapshots/pre-refactor/`.
3. Commit snapshots as canonical golden files. These ARE the seed corpus for eval fixtures (Phase 0+).
4. Every refactor commit (each port-lift) re-runs the same triggers and diffs **only the deterministic surface** against the golden snapshot — embed presence, footer regex, tool-call sequence + identity, `content`-populated invariant, no-leak-pattern checks. Raw LLM prose (word choice, embed body text) is NOT diffed — it is non-deterministic and would false-positive every run (Flatline SDD SKP-001 CRIT 855). For the prose surface, the LLM adapter is pinned to a **recorded fixture** during snapshot diffing so the only variable is the refactor. A deterministic-surface diff = STOP refactor and investigate.
5. Snapshots are operator-canonical. Agent cannot regenerate them autonomously; agent can only compare against them.

This protocol is OFFLINE (no eval HTTP endpoint required — uses existing Discord cron + slash commands). Cheap enough to run before every Phase commit.

### 1.6 Effect-to-Promise boundary convention

Per Flatline SKP-003 HIGH (760): Effect-exported APIs cannot leak into plain-TS callers as raw `Effect<X, E>`, or `Effect.runPromise` without error mapping silently re-converts typed errors to untyped throws.

**Convention** (enforced by ESLint custom rule):

```typescript
// INSIDE compose/agent-gateway/ (an Effect-adopted module):
//   Internal implementation uses Effect freely
const invokeInternal = (args: InvokeArgs): Effect.Effect<LLMResponse, LLMError> => ...

// AT THE MODULE EXPORT BOUNDARY:
//   Wrap to Promise<Result<X, E>> using neverthrow's Result pattern
export async function invoke(args: InvokeArgs): Promise<Result<LLMResponse, LLMError>> {
  return Effect.runPromise(
    Effect.either(invokeInternal(args)).pipe(
      Effect.map((either) =>
        Either.isLeft(either) ? err(either.left) : ok(either.right)
      )
    )
  );
}
```

Callers see `Result<X, E>` — explicit error handling, no thrown exceptions. The Effect runtime is INTERNAL to the module; the boundary is the export.

**Lint rule** (`.eslintrc.boundary.json` — custom rule `no-effect-export`):
- Module files at the export boundary (`index.ts` or any file matching `live/*.live.ts`) cannot export functions whose return type contains `Effect<` or `Layer<`.
- Internal files (`live/_internal/*.ts`) are unrestricted.

### 1.4 Eval harness architecture

```
                           ┌────────────────────────────────┐
                           │  Agent (Claude Opus 4.7)       │
                           │  OR Operator (zksoju)          │
                           └─────────────┬──────────────────┘
                                         │ 1. request token
                                         ▼
                           ┌────────────────────────────────┐
                           │  Operator-local CLI            │
                           │  bun run apps/bot/scripts/     │
                           │       issue-eval-token.ts      │
                           │  (uses operator's auth)        │
                           └─────────────┬──────────────────┘
                                         │ 2. signed token (30m TTL)
                                         ▼
                           ┌────────────────────────────────┐
                           │  Agent uses token              │
                           │  HMAC-sign request             │
                           └─────────────┬──────────────────┘
                                         │ 3. POST /eval/run
                                         │    body: { fixture_id, opts }
                                         │    headers: { X-Eval-Token, X-Sig, X-Nonce, X-TS }
                                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │  Railway · freeside-characters bot                          │
        │  ┌─────────────────────────────────────────────────────┐  │
        │  │  Eval endpoint handler                              │  │
        │  │  - verify HMAC + token + timestamp window           │  │
        │  │  - check nonce against LRU (replay prevention)      │  │
        │  │  - rate-limit per caller-id                         │  │
        │  │  - lookup fixture in allowlist                      │  │
        │  └────────────────────┬────────────────────────────────┘  │
        │                       │ 4. buildRuntime('eval', ...)       │
        │                       ▼                                    │
        │  ┌─────────────────────────────────────────────────────┐  │
        │  │  Composition root (eval mode)                       │  │
        │  │  - score: LiveScoreAdapter (read against prod)      │  │
        │  │  - llm: LiveLLMAdapter (Bedrock via prod creds)     │  │
        │  │  - identity: LiveIdentityAdapter (read midi_profiles)│ │
        │  │  - delivery: DryRunDeliveryAdapter (capture, never  │  │
        │  │    sends Discord)                                   │  │
        │  └────────────────────┬────────────────────────────────┘  │
        │                       │ 5. compose post per fixture        │
        │                       ▼                                    │
        │  ┌─────────────────────────────────────────────────────┐  │
        │  │  Scorer                                              │  │
        │  │  - hard checks (regex: no tool-markup, no raw emoji)│  │
        │  │  - soft checks (LLM-judge: register, word count,    │  │
        │  │    factor accuracy)                                  │  │
        │  │  - compare against fixture's expected_facts         │  │
        │  └────────────────────┬────────────────────────────────┘  │
        │                       │ 6. EvalResult                      │
        │                       ▼                                    │
        │  ┌─────────────────────────────────────────────────────┐  │
        │  │  Audit log (.run/eval-audit.jsonl)                  │  │
        │  └─────────────────────────────────────────────────────┘  │
        └──────────────────────┬──────────────────────────────────────┘
                               │ 7. JSON response with EvalResult
                               ▼
                       Agent / Operator
                       (compares with previous baseline,
                        renders regression report)
```

## 2. Component breakdown

### 2.1 New components (eval-side)

| Component | Path | Responsibility |
|---|---|---|
| Eval endpoint handler | `apps/bot/src/eval/handler.ts` | HTTP request validation (HMAC, timestamp, nonce, rate-limit, fixture-allowlist) |
| Token issuer CLI | `apps/bot/scripts/issue-eval-token.ts` | Operator-local; calls Railway `/eval/token` (auth'd via operator credential) to mint short-lived signed tokens |
| Fixture loader | `evals/src/fixture-loader.ts` | Reads `evals/fixtures/*.fixture.yaml`; validates against schema |
| Fixture runner | `evals/src/runner.ts` | For each fixture: invoke composer in eval-mode runtime; capture full output (embed body + footer + tool calls + timing) |
| Hard scorer | `evals/src/score-hard.ts` | Regex-based deterministic checks (no leak patterns, wallet-resolution rate, factor names) |
| Soft scorer | `evals/src/score-soft.ts` | LLM-judge prompts (register fidelity, in-budget word count, factor verb-form accuracy); uses Claude Haiku 4.5 for cost |
| Result comparator | `evals/src/compare.ts` | Diffs current run against prior baseline; flags regressions per metric per fixture |
| Reporter | `evals/src/reporter.ts` | Outputs Markdown report + structured JSON; agent-readable + operator-readable |
| Eval CLI entry | `apps/bot/scripts/run-eval.ts` | Operator's local CLI: prompts for token (or accepts as arg), signs request, POSTs to Railway, renders report |
| DryRunDeliveryAdapter | `packages/persona-engine/src/deliver/eval/dry-run.adapter.ts` | Implements DeliveryPort but captures output to in-memory sink instead of Discord |

### 2.2 Refactored components (per phase)

Each phase delivers a `*.port.ts` + `*.live.ts` + `*.mock.ts` trio matching the existing `ambient/` template.

**Phase 0 (pilot)** — `compose/agent-gateway`:
- `compose/ports/llm-gateway.port.ts` — interface: `invoke(args) → Effect<LLMResponse, LLMError>`
- `compose/live/anthropic.live.ts`, `compose/live/bedrock.live.ts`, `compose/live/freeside.live.ts`, `compose/live/stub.live.ts`
- `compose/mock/recorded.mock.ts` — replays recorded LLM outputs from fixtures

**Phase 1** — `score/client`:
- `score/ports/score.port.ts` — interface for all 14 score-mcp tools
- `score/live/mcp-http.live.ts` — MCP-over-HTTP wrapper (current code lifted into adapter)
- `score/mock/recorded.mock.ts` — replays canned digest responses

**Phase 2** — `orchestrator/freeside_auth`:
- `auth/ports/identity.port.ts` — interface: `resolveWallet`, `resolveWallets`, `resolveHandle`, `resolveMiberaId`
- `auth/live/pg-midi-profiles.live.ts` — current Pg implementation as adapter
- `auth/mock/handle-map.mock.ts` — deterministic wallet→handle map for fixtures

**Phase 3** — delivery:
- `deliver/ports/delivery.port.ts` — interface: `postEmbed(channelId, embed)`, `postWebhook(...)`, etc.
- `deliver/live/discord-bot.live.ts`, `deliver/live/discord-webhook.live.ts`
- `deliver/mock/captured-sink.mock.ts` — captures intended posts (used by eval)
- `deliver/eval/dry-run.adapter.ts` — eval-mode adapter that wraps captured-sink

**Phase 4** — side surfaces (cron, voice config, persona loader, codex/rosenzu/emojis): standard 5-command lift per module.

## 3. Tech stack

| Layer | Tech | Justification |
|---|---|---|
| Runtime | Bun (≥1.1) | Existing — no change |
| Language | TypeScript strict | Existing — no change |
| Pattern | `domain/ports/live/mock` four-folder | `construct-effect-substrate` doctrine; `ambient/` proves pattern works on plain TS |
| Effect adoption | Surgical (Phase 0-2 modules) | Typed error channel for load-bearing failures; plain TS elsewhere |
| Eval HTTP transport | Bun.serve + Web Crypto API | Existing Bun-native runtime; Web Crypto handles HMAC-SHA256 + signing |
| Auth | HMAC-SHA256 + short-lived signed tokens | Operator-controlled mechanism; no long-lived secret in agent env |
| Fixture format | YAML with frontmatter + Markdown body | Human-readable; operator can edit fixtures by hand; `js-yaml` already in deps |
| Soft scoring LLM | Claude Haiku 4.5 (via Bedrock) | Cheap (≤$0.001/call) + same vendor as primary (consistency); recorded in audit log |
| Hard scoring | Regex + structural checks | Deterministic, zero LLM dep |
| Audit log | JSONL at `.run/eval-audit.jsonl` | Append-only; per-line one invocation; grep-friendly |

## 4. Data models / schemas

### 4.1 Fixture schema (`evals/schemas/fixture.schema.json`)

```yaml
# Example fixture
schema_version: "1.0.0"
id: "ruggy-bear-cave-digest-normal-week"
character: "ruggy"
post_type: "digest"
zone: "bear-cave"          # optional, post-type-dependent
input:
  zone_digest:             # ZoneDigest payload (matches score/types.ts)
    zone: "bear-cave"
    window: "weekly"
    raw_stats: { ... }
  chat_prompt: null        # only for post_type=reply
expected:
  hard_checks:
    - no_tool_markup: true
    - no_raw_emoji_shortcodes: true
    - identity_chain_applied: true   # all wallets must be resolved or fallback-truncated
    - footer_format: '^digest · computed at .+ · zone:bear-cave$'
  soft_checks:
    - register: "lowercase casual"
    - word_count: { min: 80, max: 140 }
    - factor_names_must_appear: ["og:sets"]   # at least one canonical factor
    - cold_factor_callout: optional
  prohibited_substrings:
    - "<tool_use>"
    - "Composing now."
    - "I'll fire the tools first."
side_effects: false        # eval execution must be no-op for delivery
```

### 4.2 EvalResult schema

```typescript
type EvalResult = {
  schema_version: "1.0.0";
  fixture_id: string;
  run_id: string;
  timestamp: string;       // ISO-8601
  runtime_mode: "eval";
  caller: { id: string; type: "agent" | "operator" };

  output: {
    embed_body: string;
    embed_color: number;
    footer: string;
    tool_calls: Array<{ tool: string; latency_ms: number }>;
    total_compose_ms: number;
  };

  scores: {
    hard: { passed: number; failed: number; details: Array<{ check: string; pass: boolean; reason?: string }> };
    soft: { register_score: number; word_count_score: number; ... };
  };

  cost: {
    primary_llm_tokens: { input: number; output: number };
    primary_llm_cost_usd: number;
    scorer_llm_tokens: { input: number; output: number };
    scorer_llm_cost_usd: number;
    total_usd: number;
  };

  regressions: Array<{ metric: string; previous: number; current: number; delta: number }>; // vs baseline
};
```

### 4.3 Eval endpoint API contract (async job pattern)

Per Flatline SKP-003 HIGH (780): synchronous HTTP for full eval runs hits proxy timeouts (Railway / Cloudflare both ~30-60s); a 7-fixture × N-character run takes minutes. **Async job pattern**:

```
POST /eval/run  (kick off job)
Headers:
  X-Eval-Token:  <short-lived-token>           (issued by /eval/token)
  X-Eval-Sig:    HMAC-SHA256(canonical_input)  (signed body+timestamp+nonce)
  X-Eval-TS:     <unix-seconds>                (±5min window)
  X-Eval-Nonce:  <random-uuid>                 (replay protection)
  Content-Type:  application/json

Body:
  { "fixture_ids": ["...", "..."] | "all" | "scope:digest", "opts": { ... } }

Responses:
  202 Accepted · { "job_id": "...", "estimated_duration_ms": 180000 }
  400 / 401 / 403 / 413 / 429 (same as before)
```

```
GET /eval/result/:job_id  (poll for result)
Headers:
  X-Eval-Token:  <same-token-as-kick-off>
  X-Eval-Sig:    HMAC-SHA256("GET" + path + ts)
  X-Eval-TS:     <unix-seconds>

Responses:
  200 OK · job state — { "status": "queued" | "running" | "completed" | "failed",
                          "progress": { "completed": N, "total": M },
                          "result": EvalResult | null,
                          "logs_tail": "..." }
  404 Not Found · unknown job-id OR token-scope mismatch (different caller's job)
```

Job state lives in `.run/eval-jobs/<job_id>.json` on the eval service's Railway volume; eviction after 1h. Long-poll variant (`?wait=30s` query param) supported — server blocks up to N seconds before responding.

```
POST /eval/token (operator-only)
Headers:
  X-Eval-Operator-Token: <long-lived-operator-creds>  (operator-local secret manager OR Railway CLI session)
  Content-Type:  application/json

Body:
  { "ttl_seconds": 1800, "scope": "all" | "fixture-allowlist:...", "caller_id": "agent-zksoju-session-..." }

Response:
  200 OK · { "token": "...", "token_id": "...", "expires_at": "...", "scope": "...", "caller_id": "..." }
```

> The full token-bootstrap contract — operator-token verification, signing-key location, claims, `token_id`/revocation, audit — is specified in **§10.2**. The elevated-token variant for `side_effects: true` fixtures is **§10.4**.

## 5. Security design

### 5.1 Defense layers

| Threat | Defense |
|---|---|
| Stolen agent token used after agent session ends | 30-min TTL on tokens; nonce-based replay protection |
| Operator's long-lived secret leaks | Only on Railway; operator session token path (FR-10a Path A); rotated via Railway redeploy |
| Endpoint becomes prompt-injection / cost-drain attack surface | Fixture-allowlist execution (no arbitrary prompts unless explicit `?freeform=1` + elevated token); rate limits; payload size cap; cost budget per request |
| Eval accidentally writes to Discord / DB | `DryRunDeliveryAdapter` at port level; DB ports return `mode === 'eval'`-guarded read-only adapters; tests in `evals/__tests__/no-production-side-effects.test.ts` prove this |
| Eval triggers Bedrock at unbounded cost | Per-request cost budget (FR-14); kill switch env flag |
| Audit gap (can't trace eval activity) | Append-only `.run/eval-audit.jsonl` with caller-id, fixture-id, timestamp, cost; never deleted |

### 5.3 Per-adapter read-only enforcement matrix

Per Flatline SKP-003 CRIT (830): read-only behavior must be enforced **technically per adapter**, not by convention. Each port has eval-mode behavior specified:

| Port | Live behavior | Eval-mode behavior | Technical enforcement |
|---|---|---|---|
| `delivery.port.ts` | `postEmbed(channel, embed)` writes to Discord | Returns captured object; never calls discord.js | `DryRunDeliveryAdapter` is a fresh class; eval-mode `buildRuntime` wires it INSTEAD OF Live; no shared mutable state |
| `score.port.ts` | MCP HTTP calls to score-mibera | Identical calls (read-only by tool semantics) | Score-mibera's tools that mutate (none currently; cycle-021 is read-only) would be filtered at eval-side; allowlist of "safe-to-call-in-eval" tool names |
| `identity.port.ts` | Pg `SELECT FROM midi_profiles WHERE wallet_address = $1` | Same query inside `BEGIN READ ONLY; ...; COMMIT` transaction wrapper | Pg connection is wrapped in eval mode; any write attempt fails with `ERROR: cannot execute UPDATE in a read-only transaction` |
| `llm-gateway.port.ts` | Bedrock / Anthropic call with prod creds | Identical (LLM calls are inherently stateless / read-only) | None needed — LLM provides no mutation surface |
| `scheduler.port.ts` | Registers cron tasks | Eval-mode adapter is no-op (no cron registration) | `EvalSchedulerAdapter` has empty `register` method |
| `webhook-write.port.ts` (if separate) | Discord webhook POST | Captures to ring buffer instead | `DryRunWebhookAdapter` |

### 5.4 No-production-side-effects test (FR-10b)

```typescript
// evals/__tests__/no-production-side-effects.test.ts (sketch)
describe('eval runtime: no production side effects', () => {
  test('DryRunDeliveryAdapter does not call discord.js', () => {
    const runtime = buildRuntime('eval', testConfig);
    // assert delivery port's underlying client is the captured sink
    expect(runtime.delivery._type).toBe('dry-run');
  });
  test('all mutation tools are no-ops in eval mode', () => { ... });
  test('Pg connection in eval mode wraps execute in read-only transaction', () => { ... });
});
```

## 6. Contract-test pattern per port

Per Flatline SKP-004 HIGH (720): each port has a SHARED contract test suite that BOTH live and mock adapters must pass. Catches interface-vs-implementation drift before it reaches runtime.

```typescript
// packages/persona-engine/src/score/score.contract.test.ts
import { describe, test, expect } from 'bun:test';
import { LiveScoreAdapter } from './live/score.live';
import { MockScoreAdapter } from './mock/score.mock';
import type { ScorePort } from './ports/score.port';

const adapters: Array<[name: string, factory: () => ScorePort]> = [
  ['live', () => LiveScoreAdapter(testLiveConfig)],
  ['mock', () => MockScoreAdapter(testMockFixtures)],
];

describe.each(adapters)('ScorePort contract (%s adapter)', (name, factory) => {
  test('get_zone_digest returns ZoneDigest shape', async () => {
    const port = factory();
    const digest = await port.getZoneDigest('bear-cave');
    expect(digest.zone).toBe('bear-cave');
    expect(digest.window).toBe('weekly');
    expect(typeof digest.computed_at).toBe('string');
    // ... full shape check
  });

  test('emits LLMError on transport failure', async () => { ... });
  test('emits SchemaError on version mismatch', async () => { ... });
});
```

CI gates: `grep -rE "\.contract\.test\.ts" packages/` enumerates contracts; each must contain `describe.each(adapters)` to verify both live + mock run through the same tests.

## 7. Scalability + performance

| Concern | Approach |
|---|---|
| Eval run time | Fixtures run in parallel up to N=4 (configurable); per-fixture timeout = 60s; full-run timeout = 10min |
| Per-eval cost | Budget = $0.50/fixture typical; hard cap $5/run; refuse-to-start if budget exceeded |
| Audit log size | `.run/eval-audit.jsonl` rotates daily; archived to `.run/eval-audit-YYYY-MM-DD.jsonl.gz` |
| Memory in eval mode | Captured-sink uses bounded ring buffer (last 100 posts retained for inspection) |
| Bedrock rate limits | Eval runner respects 429 with exponential backoff; honors retry-after header |

## 8. Open design questions (post Flatline SDD review)

1. ~~**Effect interop with non-Effect callers**~~ ✅ RESOLVED — §1.6 specifies the convention: every Effect-exported function wraps to `Promise<Result<X, E>>` at the module boundary via `Effect.runPromise(Effect.either(...))`. Lint rule enforces.
2. **Soft-scoring LLM consistency**: Haiku 4.5 is cheap but may be non-deterministic. Should soft-scoring use temperature=0 + seed-pinning? Or accept some noise and report variance over N=3 runs?
3. **Fixture corpus governance**: Who owns the canonical fixture set? Operator gates inclusion, but who suggests new fixtures? Agent? Operator? Both?
4. **Baseline drift**: When the persona prompt changes intentionally (e.g., today's gap-closure update), all baselines invalidate. How does the harness distinguish "intentional change → update baseline" from "regression → flag"? Operator-flagged baseline-refresh markers in fixture metadata?
5. **CI integration**: should every PR auto-fire scoped evals? Or eval-on-demand only? (Restating PRD Open Q5)

## 9. World-Grounding architecture (FR-15..FR-20)

The consumer-shaped slice. freeside-characters consumes the Room chain; it never scaffolds (server scaffolding = `discord-deploy` zone, freeside-cli#14).

### 9.1 `RoomManifestPort` (FR-16)

Four-folder, born into the refactor discipline:

```
packages/persona-engine/src/world/
├── domain/room.ts                 # RoomId, Room, RoomManifest types (pure)
├── ports/room-manifest.port.ts
├── live/purupuru.rooms.live.ts    # reads worlds/purupuru.rooms.ts
└── mock/room-manifest.mock.ts     # deterministic fixture set
```

`Room` entry shape (per SKP-004 HIGH — `channelId` alone is unsafe in a multi-guild bot):

```typescript
interface Room {
  roomId: RoomId;            // 'gateway-cafe' | 'sky-eyes-dome' | ...
  worldId: string;           // 'purupuru'
  guildId: string;           // '1495534680617910396'
  manifestVersion: string;   // semver — the shape contract with discord-deploy
  displayName: string;       // '☕gateway-cafe'
  emoji: string;
  archetype: SpatialRoomId;  // node | district | edge | inner_sanctum — ACTIVE (env.ts)
  kind: RoomKind;            // Doors | Landing | Identity | Depth — DECLARED, not consumed
  channelId: string;
  homeCharacter?: CharacterId;
}
```

v1 `live` adapter reads a local `worlds/purupuru.rooms.ts` shaped to `world-manifest.schema.json` `$defs/Room`. Future `live` swaps to the resolved server-manifest from the `discord-deploy` zone — `manifestVersion` is the shape contract that makes the swap safe.

**Routing-safety guard** (per SKP-004 HIGH): a pure `assertRoutable(character, room)` runs before every delivery — validates `character.world === room.worldId`, `room.guildId` matches the delivering client's guild, `room.channelId` is in the resolved manifest. Cross-world posting throws `CrossWorldRoutingError` unless `character.roamer === true`. Tested in `world/world.contract.test.ts`.

### 9.2 `ZoneId → RoomId` rename + wire-compat adapter (FR-15)

The rename is internal-only. The seam:

```
external score-mcp wire shape          internal
─────────────────────────────          ────────
{ "zone": "stonehenge", ... }   ◄──►   RoomId 'gateway-cafe'
get_zone_digest(zone)            via    ScoreWireAdapter   →  getRoomDigest(roomId)
```

`ScoreWireAdapter` (in `score/live/`) is the ONLY place that knows the external `zone` vocabulary — it maps `zone ↔ roomId` via a static table. Mapping tests (`score/wire-compat.test.ts`) prove `get_zone_digest` + the cycle-021 pulse tools round-trip the old wire shape → internal `RoomId` with zero external-contract drift. `.env`: new `ROOM_*` keys added; legacy zone-named `DISCORD_CHANNEL_*` keys honored for a deprecation window via a config-shim.

### 9.3 env.ts re-grounding (FR-18)

`compose/environment.ts` `buildEnvironmentContext` reads `RoomManifestPort` (injected, not imported) for Room identity. `ROOM_FLAVOR` (place name, emoji, kind) and `ROOM_SPATIAL` (archetype) replace `ZONE_FLAVOR` / `ZONE_SPATIAL`. The `deriveTemperature` / `deriveSocialDensity` logic is UNCHANGED — `archetype` stays the active driver. The `{{ENVIRONMENT}}` block now reads e.g. *"You are in ☕gateway-cafe, the Gateway Cafe — base of Sora Tower, where visitors first arrive (node · Landing)."*

### 9.4 codex-mcp validation seam (FR-19)

A `CodexValidationPort` — `validateWorldElement(kind, name) → { match: 'exact'|'fuzzy'|'none', canonical?, gapLogged }`. `live` adapter calls `construct-mibera-codex`'s `codex-mcp` `validate_world_element`; until `construct-purupuru-codex` ships, v1 `live` stubs against the local `purupuru.rooms.ts`. **Never rejects** — `none` matches log a coverage-gap to `.run/codex-gaps.jsonl` and the caller proceeds. Wired into compose + fixture-load paths.

### 9.5 Caretaker fold-in + activation gate (FR-20)

The 5 caretaker `character.json` scaffolds are enumerated via `CHARACTERS` env. Each carries `world: 'purupuru'`, `homeRoom: <RoomId>`, `activated: boolean`. **Activation gate**: `buildRuntime` filters the roster — a caretaker with `activated: false` is loaded but its delivery port is forced to `DryRunDeliveryAdapter` regardless of runtime mode. Promotion to `activated: true` requires (a) ≥1 passing eval fixture for that persona's hard-check suite, (b) explicit operator edit of `character.json`. ruggy/satoshi/mongolian carry `roamer: true`, no `homeRoom`.

## 10. Flatline SDD-blocker resolutions (PRD v0.4 Override carry-forward)

The 6 PRD blockers Override'd to "SDD required coverage." Each resolved here; Phase 4 Flatline-SDD re-reviews closure.

### 10.1 Railway eval-service isolation + shared replay/rate-limit store (SKP-001 CRIT 835 · SKP-001 HIGH 790 · SKP-004 HIGH 730)

**Isolation**: the eval endpoint runs as a **separate Railway service** (`freeside-characters-eval`), NOT in the live digest bot's process. Same repo + image, distinct entrypoint (`apps/bot/src/eval-server.ts`) running `buildRuntime('eval', ...)`. The live bot's cron/gateway never imports the eval server. This removes the Bedrock-rate-budget / event-loop / in-memory-ledger contention class entirely. Assumption stated explicitly: the eval service runs **single-instance** (`replicas = 1` in `railway.json`), asserted at boot.

**Shared replay/rate-limit store**: nonce cache + per-caller rate-limit move OUT of process memory into a durable store — Railway-attached Redis, or a SQLite file on the Railway volume if Redis is not provisioned (`EVAL_NONCE_STORE=redis|sqlite`). Nonce key = `sha256(caller_id + token_id + nonce)`, TTL 10min. Survives redeploys; correct even if the single-instance assumption is later relaxed. The in-memory LRU is explicitly dev-only (`NODE_ENV !== 'production'`).

### 10.2 Token-bootstrap contract (SKP-002 CRIT 860)

`POST /eval/token` — full contract (resolves the §4.3 draft):

- **Caller**: operator only. Authenticated by `X-Eval-Operator-Token` — a long-lived credential that lives ONLY in the operator's local secret manager (or Railway CLI session); never in the agent environment, never committed.
- **Verification**: the eval service verifies `X-Eval-Operator-Token` against `EVAL_OPERATOR_TOKEN_HASH` (Railway env — stores the hash, not the token).
- **Signing key**: short-lived tokens are signed with `EVAL_TOKEN_SIGNING_KEY` (Railway env, distinct from the HMAC request-signing secret). Token is JWT-like — `{ caller_id, token_id, scope, fixture_allowlist?, freeform: false, aud: 'eval', iat, exp }`, HMAC-SHA256 signed.
- **Claims**: `exp` ≤ 30min from `iat`; `scope` ∈ {`all`, `fixture-allowlist:<ids>`}; `freeform` defaults `false`.
- **Revocation**: `token_id` (jti) embedded; a revocation set in the shared store (§10.1) is checked on every `/eval/run`. Operator revokes via `POST /eval/token/revoke`.
- **Audit**: every mint + every use logged to `.run/eval-audit.jsonl` (caller-id, token-id, scope, timestamp).
- **Invariant test**: `evals/__tests__/no-long-lived-secret-in-agent.test.ts` proves the agent-invocation path (`issue-eval-token.ts`) never reads `EVAL_HMAC_SECRET` or `EVAL_TOKEN_SIGNING_KEY`.

### 10.3 Dry-run port-swap mechanism (SKP-002 CRIT 850)

**Resolved by §1.3 — confirmed sufficient.** The eval-context composition is NOT per-request re-wiring; it is a **dedicated eval entrypoint** (`apps/bot/src/eval-server.ts`) calling `buildRuntime('eval', ...)` exactly once at boot — wiring `DryRunDeliveryAdapter` per §5.3. No path exists by which the eval service holds a live delivery adapter. **Added acceptance test** (closes the blocker's "prove the *deployed* endpoint" gap): `evals/__tests__/deployed-endpoint-is-dry-run.test.ts` hits the *running* eval service's `/eval/health`, which returns `{ runtime_mode: 'eval', delivery_adapter: 'dry-run' }`; the test fails if a deployed eval service ever reports `live` delivery.

### 10.4 Elevated-token contract (SKP-009 HIGH 735)

`side_effects: true` fixtures require an **elevated token** — a distinct claim shape:

- `{ ..., elevated: true, fixture_allowlist: [<explicit ids>], allowed_ports: [<explicit>], max_cost_usd, operator_identity, aud: 'eval-elevated' }`
- Minted only via `POST /eval/token?elevated=1` with an extra operator confirmation step.
- The eval runtime runs a `side_effects: true` fixture ONLY if the token has `elevated: true` AND the fixture id ∈ `fixture_allowlist` AND every port the fixture touches ∈ `allowed_ports`.
- **Invariant test**: `evals/__tests__/normal-token-cannot-run-side-effects.test.ts` — a normal token against a `side_effects: true` fixture returns `403`.

## 11. Flatline SDD v0.4 review integration (2026-05-14)

3-model Flatline SDD review: 7 HIGH_CONSENSUS + 3 DISPUTED + 7 BLOCKERS, 76% agreement, $0. All actionable findings resolved here or in the surgical edits noted (§1.3 per-character delivery, §1.5 deterministic-surface snapshot diff). One DISPUTED finding (IMP-012, section-order cosmetics, score 520) skipped as non-blocking.

### 11.1 Eval API + data-model contract gaps (IMP-001, IMP-003, IMP-004, IMP-006, IMP-007)

- **IMP-001** — the §1.4 diagram encodes pre-isolation topology. Authoritative topology is §10.1 (eval runs as a **separate Railway service**) + §4.3 (async job pattern). The §1.4 diagram is illustrative of the *token flow* only; §10.1 + §4.3 are the normative topology + execution semantics.
- **IMP-003** — `POST /eval/run` accepts multiple `fixture_ids`; `GET /eval/result/:job_id` therefore returns a **collection** — `{ run_id, per_fixture: EvalFixtureResult[], summary: { passed, failed, regressions_total } }`. `EvalFixtureResult` is the per-fixture shape (the former singular §4.2 `EvalResult`, renamed).
- **IMP-004** — **Baseline data model** at `evals/baselines/<fixture-id>.baseline.json`: `{ fixture_id, baseline_version, n_samples, per_metric: { metric_id: { mean, variance, tolerance } }, captured_at, source_run_ids[] }`. Keyed by `fixture_id`; `baseline_version` increments on operator-promoted refresh.
- **IMP-006** — `EvalFixtureResult.soft_scores` schema is fixed (not a placeholder) in `evals/schemas/eval-result.schema.json`: `{ voice_register, word_budget_adherence, factor_verb_accuracy, ... }` — each a `0-1` float.
- **IMP-007** — the fixture schema (§4.1) gains `side_effects: boolean` (default `false`) and, when `true`, `allowed_ports: string[]` — the explicit allowlist §10.4's elevated-token enforcement checks against. A `side_effects: true` example ships in `evals/fixtures/_examples/`.

### 11.2 Token + request-signing contract (IMP-005, SKP-001 CRIT 900, SKP-002 HIGH 760)

- **IMP-005 + SKP-001 (CRIT 900)** — token-signing model resolved single: short-lived eval tokens are minted AND verified server-side on the eval service (`EVAL_TOKEN_SIGNING_KEY`, Railway env); the agent never holds signing material. **Request signing**: the minted token carries a per-token `request_signing_secret` (random 256-bit, generated at mint, stored server-side keyed by `token_id`, returned to the operator once in the mint response). The agent uses *that per-token secret* for `X-Eval-Sig` — never a long-lived shared HMAC secret. Token expiry/revocation invalidates its `request_signing_secret`. Test: `expired-token-cannot-sign.test.ts` proves an expired/revoked token's signature is rejected.
- **SKP-002 (HIGH 760)** — HMAC canonical string is exactly: `method + "\n" + normalized_path + "\n" + sorted_query_params + "\n" + X-Eval-TS + "\n" + X-Eval-Nonce + "\n" + sha256(body) + "\n" + content_type`. Cross-language golden signature fixtures ship in `evals/fixtures/_signing/`.

### 11.3 Read-only enforcement hardening (SKP-003 HIGH 740, SKP-002 HIGH 770)

- **SKP-003 (HIGH 740)** — the eval service connects to the production DB with a **dedicated read-only role** (`freeside_eval_ro`, `default_transaction_read_only=on` at role level). The §5.3 transaction wrapper stays as defense-in-depth, not the primary guard — credential-level least privilege is the primary mechanism.
- **SKP-002 (HIGH 770)** — the eval-safe score-mcp tool allowlist is a **concrete version-pinned artifact**: `evals/score-tool-allowlist.json` (enumerates `get_zone_digest` + the cycle-021 pulse tools, all read-only). The eval-mode `ScoreAdapter` is **fail-closed** — any tool not on the allowlist is refused. A contract test fails when score-mcp advertises a tool absent from the allowlist (catches cycle-022+ mutating-tool drift).

### 11.4 Regression semantics — Q2 + Q4 resolved (SKP-007 HIGH 745, IMP-011 DISPUTED→accept)

§8 Open Questions Q2 (soft-scoring non-determinism) and Q4 (baseline drift) are RESOLVED — they cannot stay open because the harness ships in Phase 0:

- **Soft-scorer determinism**: the soft-score LLM-judge runs at `temperature=0` with a pinned model + prompt version (both recorded in `EvalFixtureResult`). Residual variance is absorbed by the N-sample baseline's tolerance band (PRD FR-13).
- **Baseline refresh / intentional change**: fixture metadata gains `baseline_version`. An intentional persona change → operator bumps `baseline_version` in the affected fixtures, which **explicitly re-baselines** rather than flagging a regression. A run whose fixture `baseline_version` exceeds the stored baseline's version triggers a *re-baseline prompt*, not a regression flag. This is the operator-controlled marker IMP-011 + SKP-007 both asked for.

### 11.5 Routing-safety ownership (IMP-013 DISPUTED→accept)

`assertRoutable` (defined §9.1) is owned by the `world/` module — `world/system/routing-guard.ts`, a pure function — and called by the per-character delivery resolver (§1.3) at the single delivery entrypoint. No delivery path can bypass it.

### 11.6 Phase 0 sequencing (IMP-002)

Explicit ordering: the §1.5 behavioral snapshot protocol runs **before Phase 0 begins** — it is the pre-eval-harness regression net. Phase 0 then builds the `compose/agent-gateway` port + the eval harness foundation. Once Phase 0's eval harness can run the agent-gateway fixture, the snapshot protocol is *superseded* by the eval harness for that surface, and retired surface-by-surface as each later phase lands. Snapshot net and eval harness never run as redundant gates — snapshot is the bridge until eval exists per-surface.

## 12. Out of scope (per PRD)

Multi-tenant eval · real-time eval-as-a-service · cross-character A/B · imagegen path · public eval dashboard · cycle-005+ scope expansion.
