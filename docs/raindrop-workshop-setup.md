# Raindrop Workshop — local OTEL surface for freeside-characters

Live trace UI for the Claude Agent SDK call surface. Watch tokens, tool
calls, and decisions stream into a local browser dashboard as cron fires.

## What's wired

`packages/persona-engine/src/observability/raindrop-instrumentation.ts`
provides `resolveQuery()` — a drop-in replacement for `query()` from
`@anthropic-ai/claude-agent-sdk`. Two call sites use it:

- `compose/reply.ts:978` (chat-reply path)
- `orchestrator/index.ts:461` (digest agent loop)

Without the Raindrop package installed (`@raindrop-ai/claude-agent-sdk`),
both fall back to the raw SDK transparently. Zero behavior change in
production until the operator opts in.

## Operator setup (~5 min)

### 1. Install the Workshop daemon

```bash
curl -fsSL https://raindrop.sh/install | bash
```

OR build from source:

```bash
git clone https://github.com/raindrop-ai/workshop.git
cd workshop && bun install && bun run dev
```

### 2. Install the Raindrop Claude Agent SDK wrapper

```bash
cd packages/persona-engine
bun add @raindrop-ai/claude-agent-sdk
```

This is an optional dep — the instrumentation module dynamically imports it
with a fail-open guard.

### 3. Start the daemon

```bash
raindrop workshop
# → opens http://localhost:5899 in your browser
```

### 4. Fire any traced command

```bash
# local stub digest — no network
LLM_PROVIDER=stub bun run digest:once

# real Anthropic call · traces flow to Workshop UI
NODE_ENV=development bun run digest:once
```

Traces appear in the Workshop UI immediately. Each digest fire shows:
- The system prompt + user message
- Token-by-token streaming output
- `voice.shape` + `voice.permitted_count` span attributes (from
  `claude-sdk.live.ts`)
- `voice_memory.read` + `voice_memory.write` events
  (from `digest-orchestrator.ts`)
- `score.snapshot.implausible` + `fallback_storm` events
  (from `score-mcp.live.ts`)
- Any `voice_memory.multi_process_violation` events
  (from `voice-memory.live.ts`)

## Env vars

| Var | Purpose | Default |
| --- | --- | --- |
| `RAINDROP_DISABLED` | Skip instrumentation entirely (fallback to raw SDK) | unset |
| `RAINDROP_DEBUG` | Log init failures to stderr | unset |
| `RAINDROP_WRITE_KEY` | Stream to Raindrop Cloud in addition to local | unset (local-only) |
| `RAINDROP_LOCAL_DEBUGGER` | Override Workshop daemon URL | `http://localhost:5899` |
| `FREESIDE_CHARACTER_ID` | userId tag for Raindrop UI grouping | `freeside-character` |

## Production posture

Workshop is **local-first** by design. The default mode does not egress
prompts or completions outside the operator's workstation. The Raindrop
Cloud sync (writeKey) is opt-in and only relevant if the team wants a
shared production dashboard later.

For cron-running production characters (Railway), keep `RAINDROP_DISABLED=1`
unless the daemon is reachable from the host. The fail-open guard ensures
no degradation, but skipping the wrap avoids the dynamic-import roundtrip.

## Why this surface

- **Local-first**: traces never leave workstation in default mode
- **Effect-TS compatible**: when we add Effect-Layer wrapping (cycle-007+),
  Workshop already understands the `@effect/opentelemetry` OTLP shape
- **Coding-agent integration**: Claude Code can read traces via Workshop's
  MCP-style API for `/instrument-agent` and `/setup-agent-replay` flows
- **No vendor lock**: MIT licensed open source · 536 stars · self-hostable

Reference: https://github.com/raindrop-ai/workshop
