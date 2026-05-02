@.claude/loa/CLAUDE.loa.md

# freeside-characters

> Loa framework loads first via the `@` import above; project-specific guidance below takes precedence per Loa's user-overrides convention.

Participation-agent umbrella for the Honey Jar ecosystem. Substrate
(`packages/persona-engine`) handles cron, MCP orchestration, Discord
delivery (Pattern B shell + per-character webhook identity), and
slash-command interactions. Characters (`apps/character-<id>`) supply
voice — currently `ruggy` (festival NPC narrator) and `satoshi`
(mibera-codex agent).

See `README.md` for the full picture. This file is for agents working IN this repo.

## Critical context

- **Repo**: `freeside-characters` (formerly `freeside-ruggy` · V0.6 multi-character umbrella)
- **Substrate vs character split**: substrate doesn't speak, characters don't talk to Discord. Boundary at `packages/persona-engine/src/types.ts` (`CharacterConfig`) — see `docs/CIVIC-LAYER.md`.
- **Discord shell**: ONE bot account (currently `Ruggy#1157` · transitional name; rename to neutral "Freeside" deferred to V0.7-A.6) acts as the shell. Per-message webhook overrides (Pattern B) deliver each character with its own face.
- **NOT the freeside operations bot** — sietch (`loa-freeside/themes/sietch`) handles `/verify`, `/onboard`, `/score`, `/agent`, `/buy-credits`. The slash commands here are PERSONA invocations (`/ruggy`, `/satoshi`), not utility commands.
- **Multi-character routing** — V0.6-A: digest cron always routes to `characters[0]` (primary). V0.6-D will add per-fire affinity routing. V0.7-A.3+ will add @-mention routing for messageCreate.

## Stack (V0.7-A.0, current)

- **Runtime**: Bun (≥1.1)
- **Language**: TypeScript (strict)
- **LLM**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) via `packages/persona-engine/src/orchestrator/` (digest path) and `packages/persona-engine/src/compose/reply.ts` (chat-mode path · single-turn, no MCPs)
- **Discord write side**: `discord.js` Gateway (Pattern B shell) + per-character webhook identity (PluralKit-style)
- **Discord read side (V0.7-A.0)**: Bun.serve HTTP endpoint at `/webhooks/discord` · Ed25519-verified slash commands · in-process per-channel ledger
- **Schedule**: `node-cron` — three concurrent cadences (digest backbone · pop-in random · weaver weekly)
- **Validation**: Zod
- **Stubs**: `LLM_PROVIDER=stub` for canned outputs; `STUB_MODE=true` for synthetic ZoneDigests

## When working in this repo

### Persona is sacred

Each character's voice lives at `apps/character-<id>/persona.md`. These
are the source of truth for the character's voice. Changes require:
1. Update the canonical doc in bonfire grimoires (operator's vault) first
2. Sync into this repo
3. Update `vault/wiki/entities/<id>.md` if the change affects identity

Never edit `apps/character-<id>/persona.md` without syncing back to bonfire grimoires.

### Discord-as-Material rules

The persona doc has a "Discord-as-Material" section that's NON-NEGOTIABLE. The `format/sanitize.ts` and `format/embed.ts` modules implement those rules. Don't bypass them. Specifically:

- **Underscore escape is mandatory** before sending any text to Discord (`format/sanitize.ts`). Onchain identifiers like `mibera_acquire` will italicize-mid-word otherwise.
- **`message.content` ALWAYS populated** when sending an embed (graceful fallback for users with embeds disabled).
- **Mobile word-wrap is ~40 chars** in code blocks. Don't generate ANSI lines wider than that.

### Voice rules (LLM follows these via system prompt; YOU should too in code comments / commits)

These apply to **ruggy**'s voice surface specifically. Satoshi's locked
register is different (sparse, gnomic, dense block · `apps/character-satoshi/persona.md`).

- Lowercase invariant — comments, commit messages, log lines
- No corporate-bot tells in user-facing strings (banned: 🚀💯🎉🔥🤑💎🙌💪⚡️✨🌟 — use the 43-emoji catalog in `packages/persona-engine/src/orchestrator/emojis/registry.ts`)
- Numbers from data, voice from persona — never hardcode example figures in production paths
- In-character errors only — "cables got crossed" not "I apologize for the inconvenience"

### Construct boundaries

The agent loop pulls from each construct at compose time. Maintain UNIX-like single-discipline boundaries:

| Construct | Owns | Doesn't own |
|---|---|---|
| `rosenzu` | Lynch primitives, KANSEI vectors, threshold transitions, per-fire variance via `furnish_kansei` | data triggers, identity, lore |
| `arneson` (skill) | scene-gen rules, sensory layering, in-character error register | data fetching, code paths |
| `cabal-gygax` (subagent) | lens rotation (9 phantom-player archetypes) — picks ONE per fire | composing the post itself |
| `emojis` | THJ guild emoji catalog, mood tags, recent-used cache | non-emoji formatting |
| `freeside_auth` | wallet → handle/discord/mibera_id resolution against `midi_profiles` | issuing JWTs (gateway), verifying credentials (Dynamic), caching score data (rosenzu/score-mcp) |
| `score` (remote MCP) | activity digests, factor catalogs, dimension catalogs | persona, voice, lore |
| `codex` (text prelude) | always-loaded lore, archetypes, trait vocabulary | data triggers, runtime queries |

If a new concern arises that doesn't fit any construct — ask if it's a new construct or a feature inside an existing one. The default answer should be "extend an existing construct"; new constructs need justification.

## Two-layer-bot model invariants

- This bot has its own Discord application (own user, own token, own per-zone channels)
- Sietch lives separately in `loa-freeside/themes/sietch` — handles auth/onboard/score-lookup
- **Utility commands** (verify · score · agent · buy-credits) belong in sietch; never duplicate here.
- **Persona invocation commands** (V0.7-A.0): `/ruggy <prompt>` and `/satoshi <prompt>` summon a character's voice for an explicit reply. These are NOT utility commands — they're the read-side primitive that pairs with Pattern B's write-side. See `docs/DISCORD-INTERACTIONS-SETUP.md` for the setup walkthrough.

## Anti-spam invariant (load-bearing · operator 2026-04-30)

Characters NEVER respond unsolicited. The ONLY triggers in V0.7-A.0 are
explicit `/ruggy <prompt>` or `/satoshi <prompt>` slash commands.
`apps/bot/src/discord-interactions/dispatch.ts` enforces:

- Drop on `interaction.user?.bot === true` (bot-author skip)
- Drop on webhook-author signatures (defense-in-depth per Gemini DR 2026-04-30)
- Reject unknown character names

Future phases extend this to @USER mentions and reply-to-bot detection
(V0.7-A.3+), but the rule survives every phase: no auto-respond on
channel presence, no name-string matching, no cross-character chaining.

## Don't do

- Duplicate sietch utility commands (`/verify`, `/score`, etc.) here — those stay in sietch.
- Add a database (state lives in score-mcp, midi_profiles, and `.run/` jsonl caches; conversation ledger is in-process per V0.7-A.0)
- Re-implement score logic locally (always call score-mcp)
- Re-implement LLM logic locally (digest path goes through `packages/persona-engine/src/orchestrator/`; chat-mode path through `packages/persona-engine/src/compose/reply.ts`)
- Generate persona content in code (always load from `apps/character-<id>/persona.md`)
- Hardcode emoji choices (always go through `mcp__emojis__*`)
- Cite raw `0x…` wallets in prose without first calling `mcp__freeside_auth__resolve_wallet`
- Compose digests without first calling rosenzu (spatial blindness — guarded against in arneson skill). N.B.: chat-mode replies have NO tool calls by design (`composeReply` configures the SDK with empty MCP servers).

## Deploy posture

- **Bot user**: Ruggy#1157 (transitional shell name · Discord application registered, token in `.env`)
- **Per-zone channels**: 4 channels in THJ guild, IDs in `.env.example`
- **Production data path**: score-mcp (zerker, `score-api-production.up.railway.app/mcp`)
- **Production LLM path**: Claude Agent SDK with `ANTHROPIC_API_KEY` (direct, no freeside-gateway routing currently)
- **Interactions endpoint (V0.7-A.0)**: requires `DISCORD_PUBLIC_KEY` env + Discord developer portal endpoint URL config. See `docs/DISCORD-INTERACTIONS-SETUP.md`. Disabled when `DISCORD_PUBLIC_KEY` unset (digest cron unaffected).
- **Hosting**: see `docs/DEPLOY.md` — ECS via loa-freeside is the target; Railway is a faster fallback

## RFC + doctrine refs

- Topology + score-vault: [loa-freeside#191](https://github.com/0xHoneyJar/loa-freeside/issues/191)
- Persona doctrine: `vault/wiki/entities/ruggy.md` · `vault/wiki/entities/satoshi.md`
- Two-layer model: `vault/wiki/concepts/two-layer-bot-model.md`
- Naming: `vault/wiki/concepts/loa-org-naming-conventions.md`
- Score contracts: `vault/wiki/concepts/score-vault.md`
- Construct ontology: `vault/wiki/concepts/construct-ontology.md`
- Listener-router substrate (V0.7-A→B roadmap): `~/bonfire/grimoires/bonfire/specs/listener-router-substrate.md`
- V0.7-A.0 build doc: `~/bonfire/grimoires/bonfire/specs/build-listener-substrate-v07a0.md`
- Source RFC: `~/bonfire/grimoires/bonfire/context/freeside-bot-topology-score-vault-rfc-2026-04-28.md`
- Creative direction seed: `~/bonfire/grimoires/bonfire/context/ruggy-creative-direction-seed-2026-04-29.md`

## Test the loop locally

```bash
bun install
cp .env.example .env

# pure stub — no external deps, ICE skipped, canned outputs
LLM_PROVIDER=stub bun run digest:once

# anthropic-direct — real LLM, stub data, canned ZoneDigest
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-… STUB_MODE=true bun run digest:once

# real path — score-mcp + anthropic LLM + Discord (or webhook fallback or stdout)
LLM_PROVIDER=anthropic \
  ANTHROPIC_API_KEY=… \
  STUB_MODE=false MCP_KEY=… \
  bun run digest:once
```

Validate the entire pipeline before touching production cron cadences. The `digest:once` CLI fires one post per zone and exits — useful for voice-iteration without waiting for Sunday midnight.
