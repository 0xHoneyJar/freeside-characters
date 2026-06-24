# Architecture Overview — freeside-characters

> One-page system diagram + data flow. /reality command consumers cite this for "how does it work."

## System layers

```
                            apps/bot/                            packages/persona-engine/
                 (thin Discord runtime shell)                    (SUBSTRATE — system-agent layer)
        ─────────────────────────────────                ──────────────────────────────────────
   ┌── cron (node-cron · 3 cadences)──────────────────►   compose/composer.ts ──── full MCP
   │                                                       │                          maxTurns 12
   │   slash POST /webhooks/discord (Bun.serve)──Ed25519──►compose/reply.ts ──── single-turn OR orchestrator
   │   │ (anti-spam guard · auth-bridge · circuit-breaker)│                          per-character MCP scope
   │   ↓                                                   │
   │   quest interception (cycle-Q) ──────────────────────►quest-runtime (memory / production / disabled)
   │                                                       │
   ↓                                                       ↓
   ┌─────────────── Pattern B delivery ───────────────────┐
   │  webhook.ts: per-channel webhook with per-message    │
   │  username + avatarURL override (PluralKit-style)     │
   └──────────────────────────────────────────────────────┘
                              ↓
                       Discord channel
                       (one shell, many speakers)
```

## Two pipelines, one substrate

**Write side** — cron tick fires `onFire({zone, postType})` → `composeForCharacter(...)` → full MCP composer with maxTurns 12 → `buildPostPayload(...)` → `deliverZoneDigest(...)` → Pattern B webhook or fallback.

**Read side** — Discord POSTs signed interaction → `server.ts` Ed25519-verifies → `dispatch.ts` applies anti-spam + circuit breaker + auth-bridge → defers ACK within 3s → async `composeReply(...)` → `sendChatReplyViaWebhook(...)` → DELETE deferred placeholder.

**Quest side** — same intake as read-side, but `isQuestInteraction(interaction)` short-circuits to `quest-dispatch.ts` before character routing.

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun ≥1.1 |
| Language | TypeScript strict |
| LLM SDK | `@anthropic-ai/claude-agent-sdk` (digest + chat-mode-orchestrator paths) |
| Discord write | `discord.js` Gateway + Webhook |
| Discord read | `Bun.serve` HTTP at `/webhooks/discord` |
| Cron | `node-cron` (UTC) with per-zone fire-lock |
| Validation | Zod (env, prompt args) |
| Postgres | `pg.Pool` via `lib/pg-pool-builder.ts` (auth-bridge + quest production mode) |
| AWS | Bedrock (text + image) when `LLM_PROVIDER=bedrock` |
| Media | Bedrock Stability for `/satoshi-image`; medium-registry capabilities for output shape |

## Boundary contract

`packages/persona-engine/src/types.ts:48-197` — `CharacterConfig` is the ONLY supported interface from characters to substrate. Characters cannot import substrate internals. The substrate cannot read from `apps/character-<id>/` directly — it goes through `character-loader.ts`.

## State (intentionally minimal)

| State | Lives in | Persistence |
|-------|----------|-------------|
| Configuration | `process.env` (Zod-validated) | env file |
| Characters | `apps/character-<id>/` files | filesystem (read-only at boot) |
| Score data | score-mcp (external, zerker) | external |
| Wallet identity | midi_profiles via Pg | external (read-through) |
| Conversation context | `conversation/ledger.ts` in-process Map | NONE (lost on restart) |
| Webhook cache | `deliver/webhook.ts` in-process Map | NONE |
| Circuit breaker | `dispatch.ts` in-process Map | NONE |
| Auth context | `dispatch.ts` per-interaction Map | NONE (auto-evicted) |
| Auth context cap | 500 entries (FIFO eviction) | — |
| Quest state | `quest-runtime` (memory: in-process · production: Pg) | mode-dependent |

There is NO local database (per CLAUDE.md Don't Do).

## Key invariants

1. **Anti-spam** — characters NEVER respond unsolicited (bot-author skip · webhook-author skip · only explicit user invocation triggers).
2. **Persona is sacred** — `apps/character-<id>/persona.md` is voice source of truth; never edit without syncing back to bonfire grimoires.
3. **Discord-as-Material** — underscore-escape mandatory · `message.content` always populated · mobile word-wrap ~40 chars.
4. **Substrate ≠ character** — characters never import from substrate internals; boundary is `CharacterConfig`.
5. **Per-zone fire-lock** — when cron cadences align in time, the second fire drops (no concurrent zone fires).
6. **Token-expiry guard** — 14m30s `Promise.race` on chat compose; PATCH after 15:00 returns 404.
7. **Fail-closed quest precondition** — production quest mode throws at boot if `TENANT_<TENANT>_DATABASE_URL` is missing.
