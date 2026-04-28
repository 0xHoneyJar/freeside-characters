# Changelog

## [0.1.0] — 2026-04-28

### Added
- Initial scaffold (`apps/bot/` + `packages/protocol/` + `docs/`)
- Canonical persona at `apps/bot/src/persona/ruggy.md` (distilled from 5 prior repos + Discord-as-Material gemini research)
- Stub mode for local dev (`STUB_MODE=true`) — synthetic `ActivitySummary` + canned LLM digest
- Webhook-based Discord delivery (no `discord.js` dependency in V1)
- Weekly cron schedule (Sunday UTC midnight, configurable via env)
- Discord markdown sanitization (underscore escape per persona doc rules)
- Embed builder with graceful `message.content` fallback
- Persona loader that builds the system prompt from `ruggy.md`

### Architecture decisions
- V1 = polling (no NATS). When zerker's `GET /v1/activity-summary` ships, swap stub for real call.
- V1 = webhook delivery (no Gateway send, no MCI privilege required).
- V1 = no slash commands. `/ruggy digest`, `/ruggy silence` defer to V2.

### Known stubs (waiting on)
- score-api `GET /v1/activity-summary` (zerker, RFC #191)
- freeside agent-gateway integration (jani, already shipped — needs API key)
- Discord application registration + webhook URL (soju)

### Refs
- [loa-freeside#191](https://github.com/0xHoneyJar/loa-freeside/issues/191) — score-vault RFC
- `~/bonfire/grimoires/bonfire/context/freeside-bot-topology-score-vault-rfc-2026-04-28.md` — full RFC
- `~/bonfire/grimoires/bonfire/context/ruggy-canonical-persona-2026-04-28.md` — persona source
