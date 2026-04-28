# freeside-ruggy

> Ruggy — diagnostic intelligence + activity reporter for the HoneyJar ecosystem. Posts weekly digests of mibera-dimensions activity to Discord. Persona layer in the [two-layer-bot-model](#topology) — sietch is the base utility bot; ruggy is the persona.

```
┌─ freeside backend (jani) ────────────────────────────┐
│  agent-gateway · IScoreServiceClient · NATS · MCP    │
└─────────────────────┬────────────────────────────────┘
                      │
              score-vault contracts
                      │
       ┌──────────────┴──────────────┐
       │                             │
  score-api (zerker)            ruggy bot (THIS REPO)
  ─ /v1/activity-summary        ─ cron-driven weekly digest
  ─ /v1/recent-activity (V2)    ─ pulls summary
  ─ NATS publisher (V2)         ─ LLM-rewrite via agent-gw
                                ─ posts to #midi-watch via webhook
```

**Persona name**: `ruggy` (lowercase, voice surface)
**Repo name**: `freeside-ruggy` (attachment-prefix doctrine — attaches to Freeside)
**Discord application**: `Ruggy` (proper case, app username)

## Status

- 🟡 V1 in flight — scaffolded 2026-04-28
- 🔴 awaiting zerker's `GET /v1/activity-summary` on score-api
- 🔴 awaiting jani's reactions to [score-vault RFC #191](https://github.com/0xHoneyJar/loa-freeside/issues/191)
- 🟢 persona doc canonical (see `apps/bot/src/persona/ruggy.md`)
- 🟢 scaffold runs end-to-end with stub data

## Quick start (with stubs)

```bash
bun install
cp .env.example .env
# fill in DISCORD_WEBHOOK_URL to actually post; leave blank for dry-run
bun run dev
```

Stub mode (default) generates a synthetic `ActivitySummary`, hits a local LLM mock, and either dry-runs or posts to the configured webhook. Validates the loop end-to-end without depending on score-api or freeside.

## Architecture (V1)

```
┌──────────────────────────────────────────────────────────┐
│ apps/bot/src/                                            │
│                                                          │
│   index.ts          ─ entry point, wires up cron         │
│   config.ts         ─ env loading + validation (zod)     │
│                                                          │
│   cron/                                                  │
│     scheduler.ts    ─ weekly cron (Sunday UTC midnight)  │
│                                                          │
│   score/                                                 │
│     client.ts       ─ HTTP client to score-api           │
│     types.ts        ─ ActivitySummary (mirrors           │
│                       score-vault contract)              │
│                                                          │
│   llm/                                                   │
│     agent-gateway.ts ─ freeside agent-gw HTTP client     │
│     digest.ts        ─ composes persona + summary → LLM  │
│                                                          │
│   persona/                                               │
│     ruggy.md        ─ canonical persona (system prompt   │
│                       template lives here)               │
│     loader.ts       ─ parses persona.md → system prompt  │
│                                                          │
│   format/                                                │
│     sanitize.ts     ─ Discord markdown escape           │
│                       (underscores, asterisks)           │
│     embed.ts        ─ build digest embed + graceful     │
│                       fallback message.content           │
│                                                          │
│   discord/                                               │
│     webhook.ts      ─ POST to Discord webhook URL        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

V1 deliberately uses **webhooks** (not Gateway / `discord.js`) for delivery — simpler, no MCI privilege required, matches Sentry/PagerDuty/GitHub bot patterns. Slash commands (`/ruggy digest`, `/ruggy silence`) defer to V2 when bot needs interaction surface.

## Persona

The canonical persona doc lives at `apps/bot/src/persona/ruggy.md`. It includes:

- Lowercase invariant + 5 core truths
- Voice patterns (say/don't-say table)
- Energy modes (chill / focused / encouraging)
- Banned vocabulary
- Discord-as-Material section (markdown subset, ANSI codes, sparse emoji dictionary, hybrid embed/content delivery)
- Sample voice outputs (4 cases: normal / quiet / spike / thin-data)
- Paste-ready system prompt template

The bot loads it at boot and feeds it as the system prompt into freeside's agent-gateway.

## Sequencing

| Phase | What | Owner | Status |
|---|---|---|---|
| **V1 Scaffold** | Repo skeleton + stubs end-to-end | soju | 🟢 done 2026-04-28 |
| Persona load + system-prompt build | soju | 🟢 done |
| Stub `ActivitySummary` generation | soju | 🟢 done |
| Stub LLM call (returns canned digest) | soju | 🟢 done |
| Discord webhook send (or dry-run) | soju | 🟢 done |
| Weekly cron | soju | 🟢 done |
| **V1 Live** | Replace stubs with real endpoints | | |
| Real `GET /v1/activity-summary` on score-api | zerker | 🔴 awaiting |
| Freeside agent-gateway integration (real LLM) | jani | 🟢 already shipped |
| Discord application registration | soju | 🟡 pending |
| Webhook URL configured for #midi-watch | soju | 🟡 pending |
| ECS deploy via Freeside | soju + jani | 🟡 pending |
| **V2** | NATS subscriber + MCP client + slash commands | | deferred |
| **V3** | Bot template extraction for sibling personas | | deferred |

## Deploy (V1, when ready)

Targets `freeside-ruggy.0xhoneyjar.xyz` via Freeside ECS. Same pattern as `world-mibera.tf` — copy to `world-freeside-ruggy.tf` in loa-freeside, populate secrets, push image. See `docs/DEPLOY.md` (when written).

## RFC + handoffs

- **Topology + score-vault RFC**: [loa-freeside#191](https://github.com/0xHoneyJar/loa-freeside/issues/191)
- **Source-of-truth RFC doc**: `~/bonfire/grimoires/bonfire/context/freeside-bot-topology-score-vault-rfc-2026-04-28.md`
- **Two-layer bot model doctrine**: `vault/wiki/concepts/two-layer-bot-model.md`
- **Naming doctrine**: `vault/wiki/concepts/loa-org-naming-conventions.md`

## Topology

`freeside-ruggy` is a persona-layer bot per the [two-layer bot model](https://github.com/0xHoneyJar/loa-freeside/issues/191):

- 🟦 **Sietch** = base utility bot (jani-managed). One per guild. Handles `/verify`, `/onboard`, `/score`, `/badges`, `/agent`, `/buy-credits`, `/alerts`. The "must-have" infra layer.
- 🟧 **Ruggy & siblings** = persona layer (per-world owners). Zero-or-many per guild. Channel posts, proactive digests, npc voice. The "want-to-have" responsibility layer.

Different cadences. Different blast radii. Different ownership. No command overlap.

## License

AGPL-3.0 (matching loa-freeside).
