# freeside-ruggy

Persona-layer Discord bot for the HoneyJar ecosystem. Watches mibera-dimensions activity via score-api and posts weekly digests in Ruggy's voice.

## Critical context

- **Persona name**: `ruggy` (lowercase, voice surface)
- **Repo name**: `freeside-ruggy` (this repo)
- **Discord username**: `Ruggy`
- **Layer**: persona (per `vault/wiki/concepts/two-layer-bot-model.md`)
- **NOT the freeside bot** — sietch (`loa-freeside/themes/sietch`) is. Don't add utility commands here.

## Stack (V1)

- **Runtime**: Bun
- **Language**: TypeScript (strict)
- **Validation**: Zod
- **Discord delivery**: webhooks (no `discord.js` in V1)
- **Schedule**: cron (weekly, Sunday UTC midnight)
- **Stubs**: full stub mode for local dev — set `STUB_MODE=true` in `.env` to generate synthetic `ActivitySummary` and skip real LLM calls

## When working in this repo

### Persona is sacred

The canonical persona at `apps/bot/src/persona/ruggy.md` is the source of truth for Ruggy's voice. Changes require:
1. Update the canonical doc at `~/bonfire/grimoires/bonfire/context/ruggy-canonical-persona-2026-04-28.md` first
2. Sync into this repo
3. Update `vault/wiki/entities/ruggy.md` if the change affects identity

Never edit `apps/bot/src/persona/ruggy.md` without syncing back to bonfire grimoires.

### Discord-as-Material rules

The persona doc has a "Discord-as-Material" section that's NON-NEGOTIABLE. The format/sanitize.ts and format/embed.ts modules implement those rules. Don't bypass them. Specifically:

- **Underscore escape is mandatory** before sending any text to Discord (handled in `format/sanitize.ts`). Onchain identifiers like `mibera_acquire` will italicize-mid-word otherwise.
- **`message.content` ALWAYS populated** when sending an embed (graceful fallback for users with embeds disabled).
- **Mobile word-wrap is ~40 chars** in code blocks. Don't generate ANSI lines wider than that.

### Voice rules (the LLM follows these via system prompt; YOU should too in code comments / commits)

- Lowercase invariant — comments, commit messages, log lines
- No corporate-bot tells in user-facing strings (banned: 🚀💯🎉🔥🤑💎🙌💪⚡️✨🌟 — use the allowed dictionary in persona/ruggy.md)
- Numbers from data, voice from persona — never hardcode example figures in production paths

## Two-layer-bot model invariants

- This bot has its own Discord application (own user, own token, own webhook)
- Sietch lives separately in `loa-freeside/themes/sietch` — handles auth/onboard/score-lookup
- No command overlap between sietch and ruggy
- `/agent` stays in sietch (generic LLM); ruggy's voice is scoped to channels only

## Don't do

- Add `discord.js` for V1 (webhook is enough)
- Add slash commands in V1 (defer to V2)
- Add a database (V1 is stateless polling; if state is needed, ask first)
- Re-implement score logic locally (always call score-api)
- Re-implement LLM logic locally (always call freeside agent-gateway)
- Generate persona content in code (always load from persona/ruggy.md)

## RFC + doctrine refs

- Topology + score-vault: `loa-freeside#191`
- Persona doctrine: `vault/wiki/entities/ruggy.md`
- Two-layer model: `vault/wiki/concepts/two-layer-bot-model.md`
- Naming: `vault/wiki/concepts/loa-org-naming-conventions.md`
- Score contracts: `vault/wiki/concepts/score-vault.md`
- Source RFC: `~/bonfire/grimoires/bonfire/context/freeside-bot-topology-score-vault-rfc-2026-04-28.md`

## Test the loop locally

```bash
bun install
cp .env.example .env
# leave DISCORD_WEBHOOK_URL blank for dry-run (logs to stdout)
# OR set it to a test webhook URL in a test channel
STUB_MODE=true bun run dev
```

Stub mode generates a synthetic `ActivitySummary`, runs it through a stub LLM that returns a canned digest, and either dry-runs or posts to webhook. Validates the entire pipeline without external dependencies.
