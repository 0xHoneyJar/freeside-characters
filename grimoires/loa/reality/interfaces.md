# Interfaces — freeside-characters

> External integrations, MCP servers, webhooks. Updated /ride 2026-05-11.

## External MCP servers

| Server | Tools | URL/Source | Auth |
|--------|-------|------------|------|
| `score` (zerker) | get_zone_digest, get_wallet_scorecard, factor catalog, dimension catalog | `SCORE_API_URL` (default `score-api-production.up.railway.app`) | `MCP_KEY` X-MCP-Key header (direct) + optional `SCORE_BEARER` (gateway) |
| `codex` (gumi) | lookup_zone, lookup_archetype, lookup_factor, lookup_grail, lookup_mibera, list_zones, list_archetypes, validate_world_element | `CODEX_MCP_URL` (optional) | none (public-read) |

## In-process MCP servers (`packages/persona-engine/src/orchestrator/`)

| Server | Purpose | LOC |
|--------|---------|----:|
| `emojis` | 43-emoji THJ catalog with mood tags; pick-by-mood, find-by-name, render | 533+397 |
| `cabal` | 9 phantom-player archetypes for audience-posture audit | 146 |
| `freeside_auth` | wallet↔handle/mibera_id via midi_profiles Pg | 532 |
| `imagegen` | Bedrock Stability text-to-image | 138 |
| `rosenzu` | Lynch primitives + KANSEI vectors + read_room/get_current_district/furnish_kansei | 860 |

Each declares an Effect.Schema contract under `_schema/`. Per-character `mcps?: string[]` array gates access [types.ts:118].

## External services

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Anthropic API | api.anthropic.com via SDK | LLM (when `LLM_PROVIDER=anthropic`) |
| AWS Bedrock | regional (default `eu-central-1` control · `us-west-2` text · `us-east-1` image) | LLM + imagegen (when `LLM_PROVIDER=bedrock`) |
| Freeside agent-gateway (jani) | `https://api.freeside.0xhoneyjar.xyz` | LLM with budget accounting (when `LLM_PROVIDER=freeside`) |
| Discord REST | `discord.com/api/v10` | Slash command PUT, follow-up PATCH/POST, webhook fetch/create/execute |
| Discord Gateway | websocket via discord.js | Bot client login for webhook permissions |
| Railway Postgres | per-tenant `TENANT_<TENANT>_DATABASE_URL` | Quest substrate production mode |
| Railway Postgres (mibera) | `RAILWAY_MIBERA_DATABASE_URL` | freeside_auth resolver (midi_profiles read) |
| Honey Jar CDN | `assets.0xhoneyjar.xyz` | Character avatars · grail images |

## Discord write paths

1. **Pattern B webhook** (preferred) — one webhook per channel created/cached by shell bot; per-message `username` + `avatarURL` override delivers character identity. [`deliver/webhook.ts:42-83`]
2. **discord.js bot send** (fallback) — shell account's own identity when webhook fails. [`deliver/client.ts`]
3. **Interaction PATCH @original** (ephemeral) — for `ephemeral:true` slash replies since webhooks can't be ephemeral. [`dispatch.ts` ephemeral branch]
4. **Webhook URL legacy** (single-channel fallback) — `DISCORD_WEBHOOK_URL` env. [`config.ts:127`]
5. **dry-run** (stdout) — when neither bot token nor webhook URL set. [`config.ts:187-190`]

## Discord read paths

1. **HTTP interactions** — `POST /webhooks/discord` (Bun.serve), Ed25519 verified, dispatched through `dispatch.ts`. [`server.ts`]
2. **(future)** discord.js Gateway `messageCreate` for @-mention routing — V0.7-A.3+ not yet implemented.

## Inter-character contract

Characters NEVER import from substrate internals. The boundary is the `CharacterConfig` type [types.ts:48-197]. Characters expose:
- `apps/character-<id>/character.json` (parsed by `character-loader.ts`)
- `apps/character-<id>/persona.md` (loaded by `persona/loader.ts`)
- `apps/character-<id>/exemplars/<post_type>/*.md` (loaded by `persona/exemplar-loader.ts`)
- `apps/character-<id>/cmp-boundary.test.ts` (voice-discipline regression test)
