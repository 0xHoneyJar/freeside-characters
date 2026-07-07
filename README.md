# freeside-characters

> Multi-character Discord agents on one shared substrate. A character is a folder of markdown.

![CI](https://github.com/0xHoneyJar/freeside-characters/actions/workflows/ci.yml/badge.svg)
![Bun ≥1.1](https://img.shields.io/badge/bun-%E2%89%A51.1-black)
![version 0.12.0](https://img.shields.io/badge/version-0.12.0-blue)
![private](https://img.shields.io/badge/repo-private-lightgrey)

## A character is a folder

The substrate (`packages/persona-engine`) does the plumbing — cron, MCP
orchestration, prompt composition, Discord delivery — and never speaks. A
character supplies voice and never touches Discord. The boundary is the
`CharacterConfig` contract.

```
apps/character-ruggy/
  persona.md        # the voice — source of truth
  character.json    # id, webhook identity, MCP scope
  exemplars/        # few-shot voice samples
```

```jsonc
// character.json
{
  "id": "ruggy",
  "personaFile": "persona.md",
  "webhookUsername": "ruggy",
  "mcps": ["score", "codex", "emojis", "rosenzu", "freeside_auth"]
}
```

One Discord bot wears each character's face per-message (PluralKit-style webhook
identity). Live today: **ruggy** and **satoshi** in the THJ Discord.

## Quick start

```bash
bun install
cp .env.example .env
LLM_PROVIDER=stub bun run digest:once   # end-to-end, zero external deps
```

## Add a character

A new directory (`persona.md` + `character.json`) and a `CHARACTERS=` entry — no
new repo, no code.

```bash
CHARACTERS=ruggy,<id> bun run start
```

## Three surfaces

A character speaks through exactly three surfaces — they never blend.

| Surface | Trigger | Voice |
|---|---|---|
| chat | `/ruggy` slash command | full |
| scheduled | weekly digest cron | voiceless billboard |
| event | on-chain / ambient pop-in | short |

## Docs

- [`docs/AGENTS.md`](docs/AGENTS.md) — start here for agents
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the full picture
- [`docs/LAYERING.md`](docs/LAYERING.md) — WHO×WHAT: voice vs CM-data
- [`docs/CHARACTER-AUTHORING.md`](docs/CHARACTER-AUTHORING.md) — adding a character
- [`CLAUDE.md`](CLAUDE.md) — repo conventions

Private — internal to 0xHoneyJar.
