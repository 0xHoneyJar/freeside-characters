# cycle-009 · onboarding-character (freeside verify bot) · PRD

> **Product Requirements Document**
> **Cycle**: cycle-009-onboarding-character
> **Working title**: onboarding character — the freeside verify bot
> **Date**: 2026-05-29 (drafted · /simstim Phase 1 Discovery output)
> **Status**: DRAFT · iterating (operator: "still thinking through the onboarding; iterate before prod") · ready for Phase 2 Flatline PRD review
> **Branch target**: `cycle-009-onboarding-character` (cut from latest main)
> **Owner**: operator (zksoju) drives product + auth decisions · Loa drives execution
> **Mode**: ARCH (Ostrom) + craft (Alexander) · the-arcade (BARTH scope) + artisan
> **Depends on**: cycle-008-persona-substrate (archived 2026-05-29) · the freeside auth cluster spine (identity-api, deployed)
> **Grounding**: `[[project_cv2-onboarding-direction]]` (resolved direction) + the freeside-auth-API recon 2026-05-29 + `[[themes-vs-personas-clean-separation]]`

---

## 1. Problem & Goal

THJ has no first-class, voice-coherent onboarding surface. sietch's Dune/BGT wizard is theme-coupled and (per recon) its `/onboard` isn't even wired in prod. New members landing in the THJ guild have no clean "verify → join" path tied to the **freeside identity spine**.

**Goal:** ship a **CollabLand-style verify bot** — a dedicated onboarding character that lives in the THJ verify channel, runs a *very simple* verify-to-join flow, and is the single owner of THJ onboarding (replacing sietch's verify/onboard for THJ). It authenticates the user against the **freeside auth API**, creates/links a **freeside account (user_id)**, verifies their wallet, and grants access — **idempotently** (already-verified users are recognized, not re-prompted).

This is the **third bot shape** named in `[[project_cv2-onboarding-direction]]`: not a Pattern-B webhook narrator (ruggy/satoshi), but an **interaction-context** bot — user-auth + buttons + ephemeral + stateful.

## 2. Users & Stakeholders

| Who | Need |
|---|---|
| **New THJ member** | A dead-simple "click → connect wallet → you're in" flow; never asked to re-verify if already linked. |
| **Returning/already-verified member** | Recognized instantly; no friction. |
| **Operator (zksoju)** | Owns the freeside identity spine; wants onboarding tied to the freeside account/ID + profile-linking, not a siloed Discord role check. |
| **The cluster (freeside auth)** | Every verify produces a canonical `user_id` + linked (wallet, discord) row in the identity spine. |

## 3. Success Metrics

- A new member completes verify (button → connected wallet → role granted) in **≤ 3 interactions**, ending with a freeside `user_id` linked to their (wallet, discord).
- An already-linked member clicking verify gets an immediate "you're already verified" (idempotent), **zero** redundant wallet prompts.
- Every successful verify writes a spine row via `POST /v1/link/verified-wallet` (auditable; `idempotent`/`conflict_resolved` recorded).
- Zero unsolicited messages (anti-spam invariant holds — the bot only acts on the verify button / `/verify`-class interactions).

## 4. Functional Requirements

**FR-1 · Verify message in the verify channel.** The bot posts (and can refresh) a persistent CollabLand-style verify card in the THJ verify channel — a Components-V2 Container (`type 17`) with a **"Verify Wallet" button** (`ActionRow`+`Button`). Copy is functional + warm (CollabLand register), not a chatty persona.

**FR-2 · Idempotent pre-check (via identity-api `resolveByDiscord`).** On click, before any wallet prompt, the bot calls `GET /v1/resolve/account/discord/{discord_id}` (canonical identity-spine lookup). If a `user_id` returns → ephemeral "you're already verified ✓", ensure the verified role is present, stop. **DEPENDENCY (operator decision 2026-05-29):** chose the canonical resolve over a bot-side cache — this endpoint is identity-api **Phase-2 (unbuilt today)**, so v1's clean idempotent check is gated on it shipping (see §7). No `.run/` cache fallback per this decision.

**FR-3 · Wallet connect + SIWE sign (forked Bun web surface).** For a new member, the button opens a **bot-hosted verify page** (a Bun web app, session keyed to `discord_id`), **forked from sietch's `verify.routes.ts`** (SIWE challenge + signature validation — proven + partially working) so the onboarding bot owns it cleanly rather than depending on the sietch it replaces. The page: connect wallet (wagmi/Dynamic) → `POST /v1/auth/challenge` (nonce) → user signs (SIWE) → `POST /v1/auth/verify` → `user_id` + session. *(A wallet can't sign inside a Discord modal — the connect/sign step is a web handoff, the CollabLand pattern; the seed of the future Blink/rendering-layer direction, a plain Bun page for v1.)*

**FR-4 · Create + link the freeside account.** On verified signature, call `POST /v1/link/verified-wallet { worldSlug: 'mibera', discordId, walletAddress }` → creates the spine row (freeside `user_id`) if new, updates if existing. **`worldSlug='mibera'`** (operator decision — consistent with existing identity-api world usage: shadow-mint + `freeside_auth`). Idempotent; surfaces `conflict_resolved` (`wallet_rebound`/`discord_rebound`) for audit.

**FR-5 · Profile linking.** The link binds **wallet ↔ discord** under one `user_id`. (Display-name/nym/pfp linking is Phase-2 `/v1/profile`, out of v1 scope — see Non-Goals.)

**FR-6 · Role grant + reveal.** After `user_id` returns, assign the THJ "verified" role (Discord `guild.members.edit`) and confirm via ephemeral reply. v1 grants a single verified role; tier/badge ladders are out of scope.

**FR-7 · Interaction wiring.** The bot extends the existing HTTP interaction endpoint via `apps/bot/src/discord-interactions/dispatch.ts:193` (an `isOnboarding` early-detect mirroring `isQuest`), reusing the proven type-3 (button) / type-5 (modal-submit) handling in `quest-dispatch.ts`. No gateway change (verified safe: gateway client is `Guilds`-intent only).

**FR-8 · In-character error register.** Failures speak in the bot's functional register ("couldn't reach the verifier, try again in a moment"), never raw errors — consistent with the repo's voice rules.

## 4a. Flatline-integrated hardening (Phase-2 · 3-voice review, 83% agreement, full confidence)

The adversarial pass (gemini tertiary skeptic + opus/gpt consensus) surfaced a security class the v1 draft under-specified. Integrated as binding requirements:

**FR-9 · Secure interaction→web handoff (CRITICAL · SKP-001/002, 880-910).** The verify button MUST be a **custom_id interaction** — NOT a URL button (a URL button fires no interaction event and cannot identify the clicker). On click, the bot's interaction handler runs the FR-2 pre-check, then returns an **ephemeral** reply carrying a **one-time, short-lived, HMAC-signed state token** encoding `{discord_id, nonce, expiry, interaction_id, guild_id}` — never a raw/guessable `discord_id`. The Bun verify page MUST validate that token server-side before `/v1/auth/challenge`. Prevents binding the wrong Discord user to a wallet (account-takeover) — the load-bearing correctness fix.

**FR-10 · SIWE replay protection (CRITICAL · IMP-003/SKP-004, 910).** Challenge/sign/verify MUST enforce **single-use nonce + expiry + domain(origin) binding + chain-id binding** per EIP-4361. Before forking sietch's `verify.routes.ts`, audit it for these + document what "partially working" means / what's broken.

**FR-11 · Service-token security (CRITICAL · IMP-008/SKP-002/003/005).** The `X-Service-Token`/Bearer for `/v1/link/verified-wallet` (privileged — mints spine rows binding arbitrary discord↔wallet) MUST be **server-side only, never in the browser bundle**, held only by the link-issuing handler, scoped, in a secret manager (not committed), rotatable, with an **audit log on every `/v1/link` call**. Separate read(resolve) and write(link) clients.

**FR-12 · Conflict-resolution policy (HIGH · IMP-006/SKP-003).** Define role-grant behavior per `conflict_resolved`: `null` (fresh) → grant; `wallet_rebound`/`discord_rebound` → **block the role grant pending operator review** (a rebind is security-sensitive — possible takeover). Specify the operator-review + revocation path.

**FR-13 · State reconciliation (IMP-005/SKP-003).** On the FR-2 idempotent pre-check: if the member resolves to a `user_id` but LACKS the verified role, **re-attempt the role grant** before confirming — don't just stop (the earlier link succeeded but the role grant may have failed).

**FR-14 · identity-api outage UX (IMP-010).** Specify retry policy + an in-character "verifier's unreachable, try again shortly" message + structured logs when the freeside auth API is down — onboarding's first impression must fail gracefully.

## 5. Non-Goals (v1 boundaries)

- **No chatty persona.** Functional CollabLand-register bot, not a ruggy/satoshi-style narrator (per "design like CollabLand").
- **No email/OAuth/phone auth.** SIWE only (Phase-2+ multi-method is deferred).
- **No nym/display-name/pfp.** `/v1/profile` is Phase-2 (400 today); v1 shows wallet short-form or `user_id`.
- **No tier/badge ladder, no channel scaffolding.** That's theme (sietch) work; v1 grants one verified role.
- **No Telegram, no Blink client.** CV2-spine scope only; the verify page is a plain hosted web page (Blink is a future cycle).
- **No multi-wallet management UI** in v1 (links one wallet; identity-api website handles more later).
- **Not a sietch feature.** This is a standalone interaction-context character that *replaces* sietch onboarding for THJ.

## 6. Technical Constraints

- **Interaction-context, not webhook.** Modals/buttons/ephemeral require the bot's HTTP interactions endpoint (`DISCORD_PUBLIC_KEY`-gated, `index.ts:492`). Seam = `dispatch.ts:193` + `quest-dispatch.ts` type-3/5.
- **freeside auth API (production endpoints):** `POST /v1/auth/challenge`, `POST /v1/auth/verify`, `POST /v1/link/verified-wallet`, `GET /v1/resolve/wallet/{addr}`, `GET /.well-known/jwks.json` at `identity-api-production-317b.up.railway.app`. Bearer / `X-Service-Token` for the link write.
- **Anti-spam invariant (load-bearing):** the character never responds unsolicited; only the verify button + explicit verify interactions trigger it; drop bot-authored interactions.
- **CV2 palette:** Container/TextDisplay/Section/Button/ActionRow (+ Separator), `IS_COMPONENTS_V2 = 1<<15` (no content/embeds when set). discord.js 14.26.4 (full palette available).
- **Reuse, don't reinvent:** sietch's `verify.routes.ts` (SIWE + signature validation) + `identity-api-link.ts` are the reference for the web surface + the link client.

## 7. Risks & Dependencies

| Risk / Dependency | Impact | Mitigation |
|---|---|---|
| **`resolveByDiscord` is the chosen idempotent path but Phase-2/unbuilt** | v1's idempotent pre-check (FR-2) GATED on identity-api `GET /v1/resolve/account/discord/{id}` | **TRACKED BLOCKING DEPENDENCY** (IMP-001/SKP-004) — file identity-api issue w/ owner + target date + contract (response schema · error states · acceptance tests). **Deployment gate:** dev proceeds, but no live THJ deploy until it ships. **Slip-fallback (tripwire):** if the date slips, fall back to `resolveByWallet`-after-connect (degraded idempotency — re-prompts connect once) so v1 stays shippable. |
| **`/v1/profile` returns 400** (Phase-2 unbuilt) | No nym/pfp in welcome | v1 shows wallet short-form; nym is a fast-follow |
| **Web verify surface must exist** | SIWE needs a hosted connect/sign page | Reuse/adapt sietch's `verify.routes.ts`; minimal hosted page for v1 |
| **"Replaces sietch" = reimplement mechanics** | Role-grant + verify logic must move | Port from sietch `onboarding.ts` (role assignment) + `identity-api-link.ts` (link); keep THJ-scoped |
| **identity-api maturity** (deployed 2026-05-25, Phase-1) | Some flows Phase-2 | v1 uses only the production Phase-1 endpoints (challenge/verify/link/resolve-wallet) |
| **Operator still iterating the flow** | Requirements may shift | PRD marked DRAFT/iterating; lock the flow before Phase-7 implementation |
| **Naming/persona authorship** | New character identity | Functional bot (light flavor); name TBD; respects persona-authorship gate |

## 8. Decisions (2026-05-29 discovery) + what's still open

**Resolved via AskUserQuestion:**
1. **World slug** = `mibera` (consistent with existing identity-api world usage).
2. **Web verify surface** = **fork** sietch's `verify.routes.ts` into the bot's own **Bun web app** (it's partially working; own it since sietch is retired for THJ).
3. **Role grant** = v1 owns a **single "verified" role** grant; tier/mibera mapping = v2.
4. **Idempotent** = canonical `GET /v1/resolve/account/discord/{id}` (identity-api Phase-2). Correctness over a bot-side cache → **hard dependency** (§7).

**Defaulted (revisit if needed):**
- **Bot name/face** — placeholder app dir `apps/character-onboarding`; name + face TBD (persona-authorship gate).
- **Dynamic coexistence** — v1 = always fresh SIWE connect (no existing-session detection); revisit when Dynamic is wired to identity-api.
- **Sietch retirement** — a v1 implementation step: turn sietch verify off for THJ as the new bot goes on (same guild, avoid double-verify).

**Still genuinely open (firm before Phase-7 build):**
- Where the forked Bun verify page is **hosted** (the bot's existing `Bun.serve` interactions process vs a separate web service).
- The **cutover sequencing** for sietch→new-bot in the live THJ guild.
- The **`resolveByDiscord` dependency**: does identity-api ship it on a timeline that fits v1, or do we re-open the cache fallback?

## 9. Cutover runbook (sietch → onboarding bot · IMP-004/SKP-005)

Live-guild auth cutover with rollback — avoid the double-verify race + stranded mid-flow users:
1. **Dry-run** the full flow in a test guild.
2. Deploy the new bot to THJ with its **verify card hidden** (not posted).
3. **Hide sietch's** verify card / disable its verify path for THJ.
4. **Reveal** the new bot's verify card.
5. **Monitor** `/v1/link/verified-wallet` for N days (operator-set) — success rate + `conflict_resolved` events.
6. **Decommission** sietch's `onboarding.ts` verify for THJ.

Rollback at any step: re-hide the new card + re-enable sietch's. Trigger: link success < threshold OR any account-misbinding.

---

*Phase 1 Discovery + Phase 2 Flatline-integrated (3-voice, 83% agreement, full confidence, $0 headless). FR-1..8 = v1 spine; FR-9..14 + §9 = security/correctness hardening from the adversarial pass. Open: §8 + the 2 disputed items (IMP-011 persona-name governance · IMP-012 central slug validation). Next: Phase 3 Architecture (SDD).*
