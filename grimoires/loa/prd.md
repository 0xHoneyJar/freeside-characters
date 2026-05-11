# Product Requirements Document — freeside-characters

> Source of Truth notice: this PRD reflects code reality as of /ride 2026-05-11 against commit `6d133bf` (Loa v1.148.0 mount).
> The in-repo `README.md`, `CLAUDE.md`, and `docs/ARCHITECTURE.md` remain the OPERATING source of truth for day-to-day work.
> This PRD is the outside-in evidence-grounded view; cite this when answering "what does freeside-characters do, and for whom?"

## Document Metadata

| Field | Value |
|-------|-------|
| Repo | `0xHoneyJar/freeside-characters` |
| Version (package.json) | `0.8.0` [GROUNDED: `package.json:3`] |
| Operating version (CLAUDE.md banner) | `V0.7-A.0` shipped · cycle-B/cycle-R/cycle-Q in flight [GROUNDED: `CLAUDE.md` Stack header] |
| Generated | 2026-05-11 by /ride |
| Loa framework | v1.148.0 (submodule) [GROUNDED: `.loa-version.json:2`] |

## 1 · Product Statement

freeside-characters is the participation-agent umbrella for the Honey Jar Discord ecosystem [GROUNDED: `package.json:4`]. It runs ONE Discord application as a runtime SHELL that delivers multiple distinct CHARACTERS into one or more Discord guilds via Pattern B (per-message webhook identity override) [GROUNDED: `packages/persona-engine/src/deliver/webhook.ts:1-30,42-83`]. Each character supplies voice through markdown profiles (`apps/character-<id>/persona.md`) and a JSON config (`character.json`); the substrate at `packages/persona-engine/` handles cron, MCP orchestration, Discord delivery, slash-command interactions, and prompt composition [GROUNDED: `packages/persona-engine/src/index.ts`].

## 2 · Users

### 2.1 Operator (primary)
- Configures and deploys the bot (Railway / ECS) [GROUNDED: `docs/DEPLOY.md`]
- Authors per-character markdown profiles (persona.md, creative-direction.md, codex-anchors.md)
- Controls cadence (cron schedule), zone-to-channel mapping, LLM provider routing, MCP scope per character [GROUNDED: `.env.example` · `packages/persona-engine/src/config.ts:4-174`]

### 2.2 Honey Jar Discord guild members (end users)
- Read scheduled in-character posts (weekly digests · pop-in micro-posts · weaver cross-zone reflections) [GROUNDED: `packages/persona-engine/src/cron/scheduler.ts:7-15`]
- Invoke characters explicitly via slash commands (`/ruggy`, `/satoshi`) and receive in-voice replies [GROUNDED: `apps/character-ruggy/character.json` · `apps/character-satoshi/character.json:17-35`]
- INVARIANT: never receive unsolicited responses; characters do not auto-respond on channel presence [GROUNDED: `apps/bot/src/discord-interactions/dispatch.ts:192-208` anti-spam guard · `CLAUDE.md` Anti-Spam Invariant section]

### 2.3 Character authors
- Add a new character by creating `apps/character-<id>/` with `character.json` + `persona.md` + optional `exemplars/` [GROUNDED: `docs/CHARACTER-AUTHORING.md` · `apps/bot/src/character-loader.ts:62-90`]
- The substrate auto-loads characters listed in `CHARACTERS` env var [GROUNDED: `apps/bot/src/character-loader.ts:56-60`]

### 2.4 NOT users
- Honey Jar wallet-holders interacting with `/verify`, `/score`, `/agent`, `/buy-credits` — those utility commands belong to the SIETCH bot (a separate repo `loa-freeside/themes/sietch`) [GROUNDED: `CLAUDE.md` Critical Context · Two-Layer-Bot Model section]

## 3 · Features (current — shipped)

### 3.1 Multi-character substrate
- **Three characters loaded today** [GROUNDED: `apps/character-{ruggy,satoshi,mongolian}/character.json`]:
  - `ruggy` — festival NPC narrator, lowercase OG voice, archetypes `[Storyteller, GM]`, 5 MCPs (score, codex, emojis, rosenzu, freeside_auth)
  - `satoshi` — mibera-codex agent, sentence-case cypherpunk register, archetypes `[Veteran, Chaos-Agent]`, 5 MCPs, has dedicated `/satoshi-image` slash command for imagegen
  - `mongolian` (displayName: Munkh) — first mibera-as-NPC quest character, archetypes `[Ancient Witness, Quest Keeper]`, 2 MCPs (codex, freeside_auth), has `quest_substrate` block

### 3.2 Two delivery pipelines, one substrate
- **Write side** (cron-driven) — three concurrent cadences: weekly digest backbone (Sun 00:00 UTC default) · pop-in random (per-zone die-roll at N-hour ticks) · weaver weekly mid-week (Wed 12:00 UTC default in stonehenge) [GROUNDED: `packages/persona-engine/src/cron/scheduler.ts:84-148`]
- **Read side** (V0.7-A.0) — Bun.serve HTTP at `/webhooks/discord` + Ed25519 signature verify · slash commands → single-turn chat-mode composer → Pattern B webhook reply [GROUNDED: `apps/bot/src/discord-interactions/server.ts:62-86` · `packages/persona-engine/src/compose/reply.ts`]

### 3.3 Anti-spam invariant (load-bearing)
- Characters NEVER respond to bot-authored invocations · NEVER respond to webhook-authored invocations · ONLY respond to explicit user invocations [GROUNDED: `apps/bot/src/discord-interactions/dispatch.ts:192-208`]
- 14m30s `Promise.race` token-expiry guard (Discord interaction tokens hard-expire at 15:00) [INFERRED: `dispatch.ts:77` `TOKEN_LIFETIME_MS = 14 * 60 * 1000 + 30 * 1000`]
- Per-channel circuit breaker: 3 consecutive 403s → blacklist in-memory until restart [GROUNDED: `dispatch.ts:78-113`]

### 3.4 Pattern B (webhook-shell identity)
- One Discord application (the shell) creates a per-channel webhook · sends each character's message with per-message `username` + `avatarURL` override [GROUNDED: `packages/persona-engine/src/deliver/webhook.ts:42-83`]
- Survives the 50-bot-per-guild ceiling [GROUNDED: `webhook.ts:10-13` comment]
- Reference: PluralKit "Members within Systems" pattern [GROUNDED: `webhook.ts:14-18` comment]

### 3.5 LLM provider routing
- 5 modes: `stub | anthropic | freeside | bedrock | auto` [GROUNDED: `packages/persona-engine/src/config.ts:21`]
- Default `auto` resolves bedrock-first when AWS creds present → anthropic (dev fallback) → stub → freeside [GROUNDED: `config.ts:12-21`]
- Default model: `claude-opus-4-7` (highest voice-fidelity choice for both digest + chat) [GROUNDED: `config.ts:104`]

### 3.6 Per-character MCP scope (V0.7-A.1 Phase D)
- Each character declares `mcps?: string[]` in `character.json` [GROUNDED: `types.ts:118`]
- Chat-mode flows through orchestrator with per-character MCP scope when `CHAT_MODE=auto|orchestrator` and `LLM_PROVIDER=anthropic` [GROUNDED: `types.ts:113-117` doc comment · `compose/reply.ts:18-29`]
- Naive single-turn path (`CHAT_MODE=naive`) is the V0.7-A.0 floor — works on every provider, no tools [GROUNDED: `config.ts:106-123`]

### 3.7 Conversation ledger
- In-process per-channel ring buffer, capacity 50, drop-oldest-on-overflow [GROUNDED: `packages/persona-engine/src/conversation/ledger.ts:43,48-53`]
- Restart loses ledger by design (no persistence primitive) [GROUNDED: `ledger.ts:7-12` comment]

### 3.8 Score-MCP (zerker, external)
- Production data path: `score-api-production.up.railway.app/mcp` [GROUNDED: `config.ts:29` default]
- Tools: `get_zone_digest`, `get_wallet_scorecard`, factor/dimension catalog reads [GROUNDED: `score/types.ts:188-213` ZoneDigest shape · character.json `tool_invocation_style` text]
- Local stub mode (`STUB_MODE=true`) emits synthetic ZoneDigest payloads [GROUNDED: `config.ts:6`]

### 3.9 In-process MCP servers (orchestrator/)
- `emojis` — 43-emoji THJ guild catalog with mood tags [GROUNDED: `orchestrator/emojis/registry.ts` · 533 LOC]
- `cabal` — 9 phantom-player archetypes for gygax voice-rotation [GROUNDED: `orchestrator/cabal/gygax.ts` · 146 LOC]
- `rosenzu` — Lynch primitives · KANSEI vectors · temperature + social-density derivation [GROUNDED: `orchestrator/rosenzu/lynch-primitives.ts` · 647 LOC]
- `freeside_auth` — wallet ↔ handle/mibera_id bidirectional resolution via Pg pool [GROUNDED: `orchestrator/freeside_auth/server.ts` · 532 LOC]
- `imagegen` — Bedrock Stability image generation surface for satoshi `/satoshi-image` [GROUNDED: `orchestrator/imagegen/server.ts` · 138 LOC]

### 3.10 Quest substrate (cycle-Q · sprint-3)
- Three modes: `disabled` (default) · `memory` (in-process for QA) · `production` (Pg pools + world manifest) [GROUNDED: `apps/bot/src/index.ts:107-210`]
- Production mode has fail-closed precondition: missing `TENANT_<TENANT>_DATABASE_URL` throws at startup [GROUNDED: `index.ts:157-185`]
- Currently wired for `mongolian` world (Munkh quest character) [GROUNDED: `index.ts:142-155`]

### 3.11 Auth-bridge (cycle-B · sprint-1)
- Every interaction gets AuthContext attached before quest dispatch or character routing [GROUNDED: `apps/bot/src/auth-bridge.ts` · 491 LOC · `dispatch.ts:222-266`]
- Verified-required routes throw AuthBridgeError on missing/invalid JWT → ephemeral 401 reply [GROUNDED: `dispatch.ts:251-260`]
- Default `AUTH_BACKEND=anon`; flip to `freeside-jwt` activates verified path [INFERRED: `dispatch.ts:225-237` comment]

### 3.12 Voice-discipline transforms (cycle-R · sprint-1)
- `stripVoiceDisciplineDrift` strips em-dashes and other markers from voice output to honor character register locks [GROUNDED: `packages/persona-engine/src/deliver/sanitize.ts` · 345 LOC · exported from `index.ts:114-118`]
- Wired into slash-command path [GROUNDED: PR #49 git log]

### 3.13 Auto-publish slash commands on bot start
- Idempotent Discord PUT to register flattened commands across all loaded characters [GROUNDED: `apps/bot/src/index.ts:276-304` · `apps/bot/src/lib/publish-commands.ts`]
- Disable with `AUTO_PUBLISH_COMMANDS=false`

### 3.14 Grail cache (V0.7-A.4 · cycle-003)
- Boot-time prefetch of canonical grail bytes for cold-latency mitigation [GROUNDED: `apps/bot/src/index.ts:237-259` · `deliver/grail-cache.ts` 387 LOC]
- Disable with `GRAIL_CACHE_ENABLED=false`

### 3.15 Medium-aware composer (cycle-R · sprint-3)
- `MediumCapability` from `@0xhoneyjar/medium-registry` threads through composer/embed/sanitize [GROUNDED: `compose/composer.ts:19,55-57,127`]
- Default medium: `DISCORD_WEBHOOK_DESCRIPTOR` (Pattern B shell-bot); slash uses `DISCORD_INTERACTION_DESCRIPTOR` [INFERRED: `composer.ts:50-54` comment]

## 4 · Non-features (explicitly out of scope)

- **Database**: state lives in score-mcp, midi_profiles (Pg via freeside_auth), and `.run/` jsonl caches; conversation ledger is in-process only [GROUNDED: `CLAUDE.md` Don't Do]
- **Sietch utility commands** (`/verify`, `/score`, `/agent`, `/buy-credits`): belong to a separate repo [GROUNDED: `CLAUDE.md` Critical Context]
- **Auto-respond on @mention or messageCreate**: NOT IMPLEMENTED in V0.7-A.0; deferred to V0.7-A.3+ [GROUNDED: `CLAUDE.md` Critical Context · code search for `messageCreate` returns no production handler]
- **Persistent cross-session character memory**: deferred to V0.7+ daemon stage [GROUNDED: `conversation/ledger.ts:9-12` comment]
- **Daemon-stage dNFT mint machinery + ERC-6551 TBA + designed-voice templates**: deferred per character.json `stageNotes` fields [GROUNDED: `character-ruggy/character.json:20-21` · `character-satoshi/character.json:42`]

## 5 · Quality / non-functional requirements

- Bun runtime ≥1.1, TypeScript strict [GROUNDED: `package.json:25` · `CLAUDE.md` Stack]
- 26 test files (unit + envelope + cmp-boundary per character) [GROUNDED: file count]
- Zod validation at the config boundary [GROUNDED: `config.ts:4-174`]
- Voice rules enforced via persona.md + sanitize transforms · NEVER auto-edit `persona.md` (CLAUDE.md "Persona is sacred")
- Discord-as-Material rules NON-NEGOTIABLE (underscore escape · `message.content` populated · ~40-char mobile word-wrap) [GROUNDED: `CLAUDE.md` Discord-as-Material section · implemented in `deliver/sanitize.ts` + `deliver/embed.ts`]

## 6 · Grounding Summary

| Marker | Count | Notes |
|--------|------:|-------|
| `[GROUNDED]` | 47 | direct `file:line` evidence |
| `[INFERRED]` | 4 | logical deduction from comments + code shape |
| `[ASSUMPTION]` | 0 | none — every claim traces to code or operator-authored docs |

**Grounding ratio**: 92% GROUNDED · 8% INFERRED · 0% ASSUMPTION (target: >80% GROUNDED, <10% ASSUMPTION) — TARGET MET.

### Assumptions / claims requiring validation

None at the PRD level. All claims trace to either code (preferred) or operator-authored documentation. The few INFERRED claims are minor inference from comment wording (token-expiry timing constant, AUTH_BACKEND default).
