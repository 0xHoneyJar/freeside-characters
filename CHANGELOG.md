# Changelog

## [0.6.0-D phase 1] — 2026-04-30

### Webhook-shell delivery primitive (Pattern B)

Substrate gains the canonical multi-identity Discord pattern: ONE Discord application
acts as the runtime shell hosting N characters via per-channel webhooks with
per-message `username` + `avatar_url` override. Per Eileen's `puruhani-as-spine.md`
canon: *"the Discord App becomes the interface/runtime shell."* Reference
implementation: PluralKit's "Members within Systems" model.

Doctrinal alignment AND operational survival — the shell pattern is the only
architecture that survives Discord's hard 50-bot-per-guild ceiling, established by
gemini deep research dig 2026-04-30. Pattern A (one app per character) hits the
ceiling at N=51; Pattern B scales infinitely within one shell.

### Added
- `packages/persona-engine/src/deliver/webhook.ts` — webhook delivery primitive.
  `getOrCreateChannelWebhook(client, channelId)` is idempotent (fetch by name + bot
  owner, create if missing). `sendViaWebhook(webhook, character, payload)` puppets
  per-character identity with `username` + `avatarURL` override.
  `invalidateWebhookCache()` for "unknown webhook" recovery (admin deletes via UI).
- `CharacterConfig` extended with `webhookAvatarUrl?` and `webhookUsername?` fields.
  Target URL hierarchy per SDD §0.2 + operator pick:
  `https://assets.0xhoneyjar.xyz/freeside-characters/<id>/avatar.png`.
  Until that CDN cycle reaches `/freeside-characters/`, any stable HTTPS URL works.
- `apps/bot/src/character-loader.ts` reads new fields from `character.json`.
- DEPLOY.md fully rewritten for Pattern B shape — 1 bot account · 2 services
  (prod-ruggy on main · staging-shell on staging hosting BOTH characters).
  OAuth permission update documented (`MANAGE_WEBHOOKS` required).

### Changed
- `deliverZoneDigest(config, character, zone, payload)` — now takes character.
  Delivery priority: webhook-shell → bot.send (when no webhookAvatarUrl) →
  legacy webhook fallback → dry-run.
- `DeliveryResult.via` gains `'webhook-shell' | 'webhook-fallback'` values.
- Dry-run banner now per-character: `── ruggy · stonehenge · DRY-RUN`.
- Repo description updated to `one shell, many speakers · discord persona umbrella for the honey jar`.
- README on main retitled with branch-state callout pointing to staging for V0.6+.

### Verified
- `bun run typecheck` clean across both packages.
- `CHARACTERS=ruggy STUB` digest:once → dry-run banner per-character correct.
- `CHARACTERS=satoshi STUB` digest:once → same.
- Pattern B path falls back gracefully to bot.send when `webhookAvatarUrl` is null.

### Deferred to V0.6-D phase 2 (post-observation iteration)
- `apps/bot/src/router.ts` — Gateway message listener + content-name parser.
  Design question: when satoshi is mentioned, what does he POST? Probably a new
  compose path that accepts user-message context.
- `apps/bot/src/reaction-handler.ts` — PluralKit-canonical ❓ reaction protocol.
  React ❓ to a webhook post → DM the reactor with the true author identity +
  codex anchor.
- Per-webhook burst queue with token-bucket + `Retry-After` header parsing for
  the 5-requests-per-2-seconds rate limit.
- File-based JSONL memory v1 with 4-way matrix (human↔agent · agent→world ·
  world→agent · agent↔agent). Cross-character read for ruggy → satoshi reference.

### Operator action required before staging deploy
- Grant `MANAGE_WEBHOOKS` to the ruggy bot (re-invite via OAuth URL OR per-channel
  permission grant in guild settings).
- Upload character avatars to a stable HTTPS endpoint (S3, GitHub raw, or Discord
  CDN). Until `assets.0xhoneyjar.xyz/freeside-characters/<id>/avatar.png` is live,
  a temp URL works.
- Set `webhookAvatarUrl` in each `apps/character-<id>/character.json` once
  uploaded.

### Known sidenote
- Irys URL `gateway.irys.xyz/7rpvw.../satoshi.png` is dead per operator 2026-04-30.
  Codex grail #4488 references this URL; needs codex-side fix when fresh upload
  lands at canonical path.

## [0.6.0-A] — 2026-04-29

### Substrate extraction — civic-layer split

Pulls the system-agent layer (cron, MCP orchestration, Discord delivery, score-mcp client,
persona+exemplar loading) out of `apps/bot/src` into a dedicated workspace package
`@freeside-characters/persona-engine`. Characters become participation-agent profiles
under `apps/character-<id>/` (markdown + JSON only, no runtime code). The bot shrinks
to a thin character-loader + dispatch entry.

Honors Eileen's civic-layer doctrine (`agent-native-civic-architecture.md`,
`puruhani-as-spine.md`): system agents (governors) and participation agents (speakers)
must not blur. Boundary enforced via package imports, filesystem ownership, and the
`CharacterConfig` type contract.

### Added
- `packages/persona-engine/` — substrate package with public API barrel (compose,
  schedule, deliverZoneDigest, loadConfig + types). Cabal-gygax prompt genericized
  (no longer references "ruggy" specifically).
- `apps/character-ruggy/` — Ruggy's persona profile extracted as markdown + JSON.
  Contains `character.json`, `persona.md` (was `ruggy.md`), `creative-direction.md`,
  `exemplars/`, `ledger.md`, `README.md`.
- `apps/bot/src/character-loader.ts` — filesystem reader. Reads `CHARACTERS` env
  (default `ruggy`), parses `apps/character-<id>/character.json`, returns
  `CharacterConfig[]` for substrate dispatch.
- `docs/CIVIC-LAYER.md` — load-bearing structural doctrine with violation patterns.
- `docs/CHARACTER-AUTHORING.md` — how to add a new character. Folder shape, persona.md
  conventions (system-prompt template, fragment markers, placeholders), enable via
  `CHARACTERS` env, smoke-test recipe.
- `docs/MULTI-REGISTER.md` — Eileen's same-character-different-registers doctrine, the
  6 × 9 register slot combinatorics, character-stage → daemon-stage trajectory.

### Changed
- Workspace metadata renamed: `freeside-ruggy@0.1.0` → `freeside-characters@0.6.0`
  (root); `@freeside-ruggy/bot` → `@freeside-characters/bot@0.6.0`;
  `@freeside-ruggy/protocol` → `@freeside-characters/protocol@0.6.0`. Repo on disk
  stays `freeside-ruggy` per Q1 — defer per-character repo split until experimentation
  justifies.
- Persona loader + exemplar loader now character-aware: accept `CharacterConfig`,
  cache keyed per-path / per (id, post-type). Composer / agent-gateway / orchestrator
  thread `CharacterConfig` through.
- Emojis MCP cache path: `process.cwd()/.run/emoji-recent.jsonl` (was substrate-relative;
  broke on package move).

### Verification
- `bun run typecheck` clean across `persona-engine` + `bot` packages.
- `STUB_MODE=true LLM_PROVIDER=stub` digest:once produces V0.5-E-equivalent output
  across all 4 zones (same colors, voice register, embed structure).
- `CHARACTERS=ruggy` (explicit), unset (defaults to ruggy), and unknown-id (fails loud
  with clear path-pointer error) all behave correctly.
- All file moves use `git mv` — history preserved.

### Daemon trajectory note (V0.7+, NOT V0.6 work)
Per Eileen's `puruhani-as-spine.md` canon, characters elevate to daemons when ALL of:
dNFT mint machinery + ERC-6551 token-bound accounts + state-transition handlers +
designed-voice templates + memory ledger land. Until then, character-stage with the
codex grail page (or analogous canonical text) as identity anchor is the right shape.
"freeside-daemons" terminology is intentionally NOT introduced — that vocabulary
belongs to Eileen's puruhani-daemon canon.

## [unreleased] — 2026-04-29

### Docs
- Rewrote `README.md` to reflect V0.5-E reality — superseded V1-era webhook + polling framing.
  Surfaces: persona-layer-bot positioning (vs sietch operations layer), tripartite construct
  composition (rosenzu · arneson · cabal-gygax + codex + emojis + freeside_auth + score),
  six post types + three cadences, four festival zones, the "Ruggy is one consumer of score,
  not the only one" framing, and the extractability story for sibling personas.
- Rewrote `CLAUDE.md` agent guidance — V0.5-E stack (Claude Agent SDK, in-bot MCPs,
  discord.js Gateway), construct boundaries table, "don't do" updated for the persona-layer
  invariants.
- Rewrote `docs/ARCHITECTURE.md` — V0.5-E architecture diagram with SDK runtime, in-bot MCPs,
  cabal-gygax subagent, arneson skill loading. Module responsibilities, dependency rules,
  swap-out matrix, future shape, and a construct-extractability checklist.
- Updated GitHub repo description + topics to surface the persona-layer + reference-implementation framing for discoverability.
- **Smol+weaver pass** (2026-04-29) — README + ARCHITECTURE.md ASCII diagrams converted to
  Mermaid (interactive on GitHub since 2022, mobile-friendly, follows the rendering-mermaid
  skill's portability rules — middle-dot inline separators, classDef vocabulary). Prose
  tightened to lowercase casual register. Repo layout collapsed into `<details>`. Construct
  table emoji-anchored. Added `construct-extractability` Mermaid for the sibling-persona
  scaffold/variable split.

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
