# Architecture

V1 keeps it minimal. One bot process. Webhook delivery. Polling-based fetch. No DB. No Gateway. No slash commands.

```
┌─────────────────────────────────────────────────────────────────────┐
│ freeside-ruggy bot process (single)                                  │
│                                                                      │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ cron     │──▶│ digest   │──▶│ score    │──▶│ score-api│        │
│   │scheduler │   │ composer │   │ client   │   │ (zerker) │        │
│   └──────────┘   └────┬─────┘   └──────────┘   └──────────┘        │
│                       │                                              │
│                       ▼                                              │
│                  ┌──────────┐                                        │
│                  │ persona  │  ← apps/bot/src/persona/ruggy.md       │
│                  │ loader   │                                        │
│                  └────┬─────┘                                        │
│                       │ (system prompt + summary JSON)               │
│                       ▼                                              │
│                  ┌──────────┐                ┌──────────────────┐   │
│                  │ llm      │──────────────▶ │ freeside agent-gw│   │
│                  │ client   │                │ (jani)           │   │
│                  └────┬─────┘                └──────────────────┘   │
│                       │ (voice text)                                 │
│                       ▼                                              │
│                  ┌──────────┐   ┌──────────┐                        │
│                  │ format/  │──▶│ discord/ │                        │
│                  │ embed +  │   │ webhook  │                        │
│                  │ sanitize │   └────┬─────┘                        │
│                  └──────────┘        │                              │
│                                      ▼                              │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
                         ┌─────────────────┐
                         │ Discord webhook │
                         │ (#midi-watch)   │
                         └─────────────────┘
```

## Module responsibilities

| Module | Responsibility | External deps |
|---|---|---|
| `cron/scheduler.ts` | Schedules weekly fire | node-cron |
| `score/client.ts` | Fetch `ActivitySummary` from score-api OR generate synthetic in stub mode | fetch |
| `score/types.ts` | Mirror score-vault `ActivitySummary` contract | zod |
| `persona/ruggy.md` | Canonical persona doc — single source of truth for voice + Discord-as-Material rules | — |
| `persona/loader.ts` | Parse system-prompt-template section out of persona.md | none (Bun native) |
| `llm/agent-gateway.ts` | Call freeside `/api/agents/invoke` OR canned digest in stub mode | fetch |
| `llm/digest.ts` | Orchestrate: fetch summary → load prompt → call LLM → build payload | composes others |
| `format/sanitize.ts` | Discord markdown escape (underscore protection) | — |
| `format/embed.ts` | Build digest embed shape with graceful fallback `message.content` | — |
| `discord/webhook.ts` | POST to webhook URL OR dry-run to stdout | fetch |

## Dependency rules

- `score/*` — knows about score-api, no Discord knowledge
- `llm/*` — knows about freeside agent-gateway, no Discord knowledge
- `persona/*` — pure: reads markdown, returns strings
- `format/*` — pure: takes data + voice, returns Discord shape
- `discord/*` — knows about Discord webhooks, no LLM/score knowledge
- `digest.ts` is the ONE module that composes them all

This means swap-out is clean:
- swap stub `score/client.ts` for real call when zerker ships endpoint
- swap stub `llm/agent-gateway.ts` for real call when freeside auth provisioned
- swap webhook for Gateway-based send (V2) without touching anything else

## Stub mode

Set `STUB_MODE=true` to run the bot end-to-end without external deps:

- `score/client.ts` returns a synthetic `ActivitySummary` (varies by day-of-week to surface different digest shapes)
- `llm/agent-gateway.ts` returns canned digests matching the four sample outputs in `persona/ruggy.md` (normal / quiet / spike / thin-data)
- `discord/webhook.ts` dry-runs to stdout if `DISCORD_WEBHOOK_URL` is unset

Validates: persona load, prompt build, summary parsing, embed construction, message-content fallback, sanitization, delivery shape — without depending on score-api, freeside, or Discord auth.

## Why webhooks, not Gateway

V1 doesn't need:
- bot user mention parsing
- slash command interactions
- presence/typing indicators
- DM handling

V1 only needs to POST a digest into a channel on a schedule. Webhooks deliver this with:
- no bot user authentication
- no Message Content Intent (MCI) privilege
- no Gateway connection (less infra)
- proven pattern (Sentry, PagerDuty, GitHub all use webhooks)

V2 considers Gateway when slash commands (`/ruggy digest`, `/ruggy silence`) land.

## Why no DB in V1

V1 is stateless. The summary is fetched fresh every fire; the persona is a markdown file; the schedule is a cron expression. Nothing needs to persist between runs.

V2 may need: per-guild config (channel ID, cadence override, mute-until timestamp), digest history, error/retry state. When that day comes, add a small SQLite + Drizzle. Not before.

## Future stack additions

| Addition | Trigger | Module |
|---|---|---|
| `discord.js` | Slash commands needed | `discord/client.ts` |
| NATS subscriber | freeside ACTIVITY stream live | `score/nats-subscriber.ts` |
| MCP client | `mibera-score-mcp` deployed | `score/mcp-client.ts` |
| SQLite + Drizzle | Multi-guild OR digest history | `db/` |
| ANSI granular feed | High-frequency anomaly alerts (V2) | `format/ansi.ts` |
