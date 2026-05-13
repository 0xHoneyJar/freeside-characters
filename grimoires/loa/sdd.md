---
title: SDD — composable substrate refactor + agent-runnable eval harness
status: draft
version: 0.1
simstim_id: simstim-20260513-b7126e67
phase: architecture
date: 2026-05-13
prd_ref: grimoires/loa/prd.md (v0.2)
---

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

### 4.3 Eval endpoint API contract

```
POST /eval/run
Headers:
  X-Eval-Token:  <short-lived-token>           (issued by /eval/token)
  X-Eval-Sig:    HMAC-SHA256(canonical_input)  (signed body+timestamp+nonce)
  X-Eval-TS:     <unix-seconds>                (±5min window)
  X-Eval-Nonce:  <random-uuid>                 (replay protection)
  Content-Type:  application/json

Body:
  { "fixture_id": "...", "opts": { "regenerate_baseline": false } }

Responses:
  200 OK · EvalResult JSON
  400 Bad Request · invalid body / unknown fixture
  401 Unauthorized · missing/invalid token
  403 Forbidden · token expired / kill switch active / nonce reused / timestamp out of window
  413 Payload Too Large · body > 64KiB
  429 Too Many Requests · rate-limited
  503 Service Unavailable · upstream (Bedrock, score-mcp, freeside_auth) unavailable
```

```
POST /eval/token (operator-only)
Headers:
  X-Eval-Operator-Token: <long-lived-operator-creds>  (env-loaded from operator-side secret manager OR Railway CLI session)
  Content-Type:  application/json

Body:
  { "ttl_seconds": 1800, "scope": "all" | "fixture-allowlist:...", "caller_id": "agent-zksoju-session-..." }

Response:
  200 OK · { "token": "...", "expires_at": "...", "scope": "...", "caller_id": "..." }
```

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

### 5.2 No-production-side-effects test (FR-10b)

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

## 6. Scalability + performance

| Concern | Approach |
|---|---|
| Eval run time | Fixtures run in parallel up to N=4 (configurable); per-fixture timeout = 60s; full-run timeout = 10min |
| Per-eval cost | Budget = $0.50/fixture typical; hard cap $5/run; refuse-to-start if budget exceeded |
| Audit log size | `.run/eval-audit.jsonl` rotates daily; archived to `.run/eval-audit-YYYY-MM-DD.jsonl.gz` |
| Memory in eval mode | Captured-sink uses bounded ring buffer (last 100 posts retained for inspection) |
| Bedrock rate limits | Eval runner respects 429 with exponential backoff; honors retry-after header |

## 7. Open design questions (for Flatline SDD review)

1. **Effect interop with non-Effect callers**: Phase 0-2 modules use Effect. The composition root and other modules use plain TS. Where exactly does the Effect-to-Promise translation boundary live? Likely: at each Effect-module's exported API. Document the convention.
2. **Soft-scoring LLM consistency**: Haiku 4.5 is cheap but may be non-deterministic. Should soft-scoring use temperature=0 + seed-pinning? Or accept some noise and report variance over N=3 runs?
3. **Fixture corpus governance**: Who owns the canonical fixture set? Operator gates inclusion, but who suggests new fixtures? Agent? Operator? Both?
4. **Baseline drift**: When the persona prompt changes intentionally (e.g., today's gap-closure update), all baselines invalidate. How does the harness distinguish "intentional change → update baseline" from "regression → flag"? Operator-flagged baseline-refresh markers in fixture metadata?
5. **CI integration**: should every PR auto-fire scoped evals? Or eval-on-demand only? (Restating PRD Open Q5)

## 8. Out of scope (per PRD)

Multi-tenant eval · real-time eval-as-a-service · cross-character A/B · imagegen path · public eval dashboard · cycle-005+ scope expansion.
