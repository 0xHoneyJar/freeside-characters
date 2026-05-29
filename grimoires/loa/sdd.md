# cycle-009 · onboarding-character (freeside verify bot) · SDD

> **Software Design Document**
> **Cycle**: cycle-009-onboarding-character
> **Date**: 2026-05-29 (/simstim Phase 3 Architecture output)
> **Status**: DRAFT · derives from `grimoires/loa/prd.md` (FR-1..14 + §9) · ready for Phase 3.5/4 review
> **Mode**: ARCH (Ostrom) + craft (Alexander)
> **Grounding**: verified seams — `apps/bot/src/discord-interactions/dispatch.ts:193` · `quest-dispatch.ts` (type-3/5) · identity-api (`identity-api-production-317b.up.railway.app`) · sietch `verify.routes.ts` + `identity-api-link.ts` (fork sources) · CV2 palette (discord.js 14.26.4)

---

## 1. Architecture overview

A **CollabLand-style verify bot** that lives inside freeside-characters as an **interaction-context** surface (distinct from the Pattern-B webhook narrators). One persistent CV2 verify card → `custom_id` interaction → secure signed handoff to a co-located Bun verify page → SIWE against the freeside auth API → freeside `user_id` linked → verified role granted.

```
                 THJ verify channel
                 ┌───────────────────────────┐
                 │  [Verify Wallet]  (CV2)    │  custom_id=onboard:verify
                 └─────────────┬─────────────┘
                               │ type-3 MESSAGE_COMPONENT
        ┌──────────────────────▼───────────────────────────┐  apps/bot
        │ interactions endpoint (Bun.serve :3001, Ed25519)  │
        │  dispatch.ts:193  → isOnboarding → onboarding-dispatch
        └──────┬───────────────────────────────────┬────────┘
               │ pre-check (resolveByDiscord)       │ issue HMAC state token
               │                                    │ → ephemeral reply w/ verify URL (FR-9)
        ┌──────▼──────┐                      ┌──────▼─────────────────────────┐
        │ freeside-   │                      │ Bun verify surface (co-located │
        │ auth client │◄─────────────────────│  on bot Bun.serve · /verify/*) │
        │ (Effect-TS, │  challenge/verify/   │  forked from sietch verify.rts │
        │  svc-token) │  link/resolve        │  validate token → SIWE → link  │
        └──────┬──────┘                      └──────┬─────────────────────────┘
               │ POST /v1/link (worldSlug=mibera)   │ on success (same process)
               ▼                                    ▼
        identity-api spine                   role-grant service
        (user_id · wallet↔discord)           (discord.js REST · @verified)
```

**Layer placement** (per `[[multi-axis-daemon-architecture]]`): the bot is axis-1/L2 participation surface but **interaction-context** + **user-auth** — the third shape. Substrate (token + auth client + role-grant) lives in `packages/persona-engine/src/onboarding/`; the Discord wiring extends `apps/bot/src/discord-interactions/`; the functional persona (light flavor) at `apps/character-onboarding/`.

## 2. Components

| # | Component | Path (new/extend) | Responsibility | FRs |
|---|---|---|---|---|
| C1 | **Verify-card renderer** | `persona-engine/src/onboarding/verify-card.ts` (new) | CV2 Container + `custom_id` "Verify Wallet" button (NOT a URL button) | FR-1, FR-9 |
| C2 | **Onboarding dispatch** | `apps/bot/src/discord-interactions/onboarding-dispatch.ts` (new) + `dispatch.ts:193` `isOnboarding` hook | route `onboard:verify` custom_id; pre-check; issue token; ephemeral reply | FR-2, FR-7, FR-9, FR-13 |
| C3 | **State-token service** | `persona-engine/src/onboarding/state-token.ts` (new) | mint + verify one-time HMAC-signed handoff tokens | FR-9 |
| C4 | **Bun verify surface** | `apps/bot/src/verify/` (new route group on the existing Bun.serve) — forked from sietch `verify.routes.ts` | validate token → **Discord OAuth2 (confirm opener == token.discord_id, RT-8)** → wallet connect + SIWE → call auth client; public page holds no secret, server-only `/complete` | FR-3, FR-10, RT-8 |
| C5 | **freeside-auth client** | `persona-engine/src/onboarding/freeside-auth-client.ts` (new, Effect-TS) | typed wrapper: resolveByDiscord / challenge / verify / link / resolveByWallet; holds svc-token (server-only). **Clean standalone module — promotable to a shared `@freeside/*` package later** if more verify consumers appear (Bridgebuilder REFRAME-2: no premature shared pkg while sietch retires) | FR-4, FR-5, FR-11, FR-14 |
| C6 | **Role-grant service** | `persona-engine/src/onboarding/role-grant.ts` (new) | assign @verified via discord.js REST; conflict gate; reconciliation | FR-6, FR-12, FR-13 |
| C7 | **Persona (light)** | `apps/character-onboarding/persona.md` (new · name TBD) | functional CollabLand register; in-character error copy | FR-8, FR-14 |

## 3. Data flow — the verify sequence

```
1. member clicks [Verify Wallet] (custom_id=onboard:verify)
2. → interactions endpoint (Ed25519-verified) → dispatch.ts isOnboarding → C2
3. C2 anti-spam guard (drop bot-authored) → pre-check via C5.resolveByDiscord(discord_id):
     a. linked + has @verified  → ephemeral "verified ✓", stop                  (FR-2)
     b. linked + no @verified    → C6 re-grant → ephemeral "restored ✓", stop    (FR-13)
     c. not linked               → C3 mint token {discord_id,nonce,exp,iid,guild}
                                    → ephemeral reply: "verify here ⟶ <one-time URL>" (FR-9)
4. member opens URL → C4 validates token (HMAC + expiry + one-time)             (FR-9)
5. C4: connect wallet (wagmi/Dynamic) → C5.challenge(wallet) → SIWE sign → C5.verify(nonce,sig) (FR-10)
6. C4 → C5.link({worldSlug:'mibera', discordId, walletAddress}) → {user_id, conflict_resolved} (FR-4)
7. conflict gate (FR-12): null → continue · wallet_rebound|discord_rebound → BLOCK + operator-review
8. (same process) → C6 grant @verified → audit-log the link (FR-11) → confirm to member (FR-6)
```

**Callback model:** C4 (verify surface) is **co-located on the bot's Bun.serve process** → on link success it invokes C6 directly (no cross-process webhook). Resolves the §8 hosting-topology item (IMP-002). **Hardened internal boundary (Bridgebuilder REFRAME-1, accept-minor):** the public `GET /verify/:token` page handler holds **NO secret** (serves the connect/sign client only); the service-token + `/v1/link` write + role-grant execute **only** in the server-side `POST /verify/:token/complete` handler; **strict CORS**; the service-token never appears in any client bundle. (Full process isolation — a separate verify service + signed callback — was weighed and deferred to v2.)

## 4. Data models / schemas

**State-token (C3) — the secure handoff (FR-9):**
```
payload = base64url(JSON{ v:1, did:discord_id, nonce:uuid, iid:interaction_id,
                          gid:guild_id, exp:unix+300 })
token   = payload + "." + base64url(HMAC_SHA256(payload, ONBOARDING_STATE_SECRET))
```
- One-time: `nonce` recorded in `.run/onboarding-nonces.jsonl` (consumed-set; repo has no DB by design); expiry 5 min.
- Validated server-side in C4 before any auth call. `did` is signed, not client-supplied.

**freeside-auth (C5) — identity-api contracts (production Phase-1):**
```
POST /v1/auth/challenge  { walletAddress, scheme:"siwe" } → { nonce, message }
POST /v1/auth/verify     { nonce, signature, walletAddress, scheme } → { user_id, primary_wallet, session{token,expires_at} }
POST /v1/link/verified-wallet { worldSlug:"mibera", discordId, walletAddress } → { ok, user_id, idempotent, conflict_resolved }   [X-Service-Token]
GET  /v1/resolve/wallet/{addr} → { user_id, ... } | 404
GET  /v1/resolve/account/discord/{id} → { user_id, ... }   ⚠ PHASE-2 (dependency, FR-2)
```

**Role-map config (C6):** `{ guildId, verifiedRoleId }` (v1 single role; env or a small config). `user_id → roles[]` mapping is the v2 seam.

## 5. API contracts

- **Consumed:** identity-api (§4). Bearer/`X-Service-Token` only on the link write; resolve/challenge/verify need no service token.
- **Bot interaction endpoint:** existing `Bun.serve` (`index.ts:492`, `DISCORD_PUBLIC_KEY`-gated, Ed25519). New: `custom_id` `onboard:verify` handled in C2 via the `isOnboarding` early-detect at `dispatch.ts:193` (mirrors `isQuest`); reuses `quest-dispatch.ts` type-3 handling. Ephemeral responses (flag `1<<6`).
- **Bun verify routes (C4, forked):** `GET /verify/:token` (validate → render connect/sign page), `POST /verify/:token/complete` (server-side SIWE verify + link + role-grant trigger). All server-side; the page's client JS never sees the service token.

## 6. Security design (FR-9..14 → mechanisms)

| FR | Threat | Mechanism |
|---|---|---|
| FR-9 | wrong-user wallet binding / takeover | `custom_id` interaction (server knows the clicker) → HMAC-signed one-time state token (signed `discord_id`, not client-supplied); server-side validation in C4 |
| FR-10 | SIWE replay / cross-user | EIP-4361: single-use nonce (identity-api-issued), expiry, domain(origin) + chain-id binding. **Pre-fork audit** of sietch `verify.routes.ts` for these. |
| FR-11 | svc-token leak (mints arbitrary links) | token in secret manager/env; held only by C5 server-side; never in C4's client bundle; audit-log every link (caller + result); separate read/write clients |
| FR-12 | rebind = takeover | C5.link `conflict_resolved` gate in C6: block grant on `wallet_rebound`/`discord_rebound` → operator-review queue |
| FR-13 | linked-but-unroled drift | C2 pre-check re-grants if `user_id` resolves but role absent |
| FR-14 | identity-api outage | C5 retry (bounded) + in-character failure copy + structured logs |

Anti-spam invariant (load-bearing): C2 drops bot-authored interactions (defense-in-depth on `bot:true` + webhook-author signature); the bot acts ONLY on `onboard:*` custom_ids — never unsolicited.

## 6a. Flatline-SDD hardening (Phase-4 · 3-voice, 50% agreement [opus flagged over-spec], full confidence, $0)

The gemini skeptic deepened the security model; integrated, refining §2/§4/§6:

**H-1 · Opaque handoff token, NOT signed-identity-in-URL (CRITICAL · SKP-001, 910).** Revise FR-9/C3: the verify URL carries ONLY an **opaque random id** (≥16 bytes CSPRNG); the `{discord_id, nonce, exp, interaction_id, guild_id}` lives **server-side**, keyed by that id. The URL is a bearer *reference*, not a signed-identity payload — mitigates URL leak (history/logs/referrer/screenshot/forward) binding a wallet to the signed discord_id. Add `Referrer-Policy: no-referrer`; never log full URLs; consume at first use.

**H-2 · Atomic nonce consume (CRITICAL · SKP-001/002, 860).** Revise C3 store: append-only `.run/*.jsonl` has no atomic consume (concurrent/restart unsafe). Use an **`O_EXCL`/`mkdir` per-token-id claim file** (single-writer, fsync — honors the no-DB rule) as the atomic consume gate; the state record sits beside it. (bun:sqlite or identity-api-backed are alternatives if multi-instance lands.)

**H-3 · Unconditional `deferReply` (CRITICAL · SKP-001 + IMP-006, 850).** Revise C2: `deferReply({ephemeral:true})` IMMEDIATELY on `onboard:verify` (before any network call), then `editReply` with the URL — never risk the 3-second interaction ACK window.

**H-4 · SIWE pre-fork audit = a GATE, not an open item (CRITICAL · SKP-002, 820).** Promote FR-10's audit to a hard gate before forking sietch `verify.routes.ts`. Acceptance criteria: server-side single-use nonce · `domain` == verify origin · `chainId` pinned · `expirationTime` ≤ 5m · URI/authority bound (EIP-4361).

**H-5 · Conflict-review surface (HIGH · IMP-002/SKP-003).** Revise FR-12/C6: C5.link commits the spine row; the gate decides the ROLE grant only. Blocked rebind grants → `.run/onboarding-review.jsonl` + an audit-log kind; user gets "needs review" ephemeral. Operator-review surface = the jsonl (v1) → dashboard later.

**H-6 · Secret provisioning + rotation (HIGH · IMP-005/SKP-004).** `ONBOARDING_STATE_SECRET` ≥32 bytes CSPRNG, env/secret-manager (not committed), `kid` in the server-side state record for overlapping-secret rotation. (H-1's opaque token shrinks this surface — the MAC now protects server-side state, not a URL payload.)

**H-7 · CSRF/origin on `POST /verify/:token/complete` (HIGH · IMP-009/SKP-004).** Validate `Origin`+`Host`, reject simple-form content-types, deliberate `SameSite`; CSRF tied to the server session.

**H-8 · Retry idempotency (IMP-013).** Bounded retries (FR-14) carry idempotency keys so a successful-but-retried link isn't read as a conflict/duplicate.

**Deferred (opus-aligned · scope vs v1):** periodic role-drift reconciliation (IMP-014 — synchronous FR-13 recovery suffices); persona-identity formalization (IMP-016 — naming gated). **IMP-012 RESOLVED:** self-rendered wagmi page (see §9).

## 6b. Red-Team residual hardening (Phase-4.5 · 10 on-target attacks; #582 tooling note: domain-extractor failed → opus grounding scored 0, attacks valid)

**RT-1 · Static origin/domain pinning (ATK-006/010).** Bun.serve MUST derive the SIWE `domain` AND the CSRF Origin/Host check from a **static `VERIFY_ORIGIN` config**, never from the request (Host header / `request.url`) — closes the forked-host / Host-substitution bypass of H-4/H-7.

**RT-2 · JSONL write-injection guard (ATK-007).** Every field written to `.run/onboarding-*.jsonl` is JSON-encoded per-field (no raw interpolation); wallet validated `^0x[0-9a-fA-F]{40}$` before write — prevents newline/JSONL injection forging consume/review records.

**RT-3 · Error-serialization redaction (ATK-003).** The Effect-TS error layer (C5/C6) allowlist-serializes; `X-Service-Token`/Bearer NEVER enter a TaggedError trace or log.

**RT-4 · Rebound atomicity (ATK-008 · refines H-5).** `C5.link` commits the spine row even on `conflict_resolved!=null` — so the identity REBIND already happened when C6 blocks only the role. Treat a rebind link as **provisional**: spine row committed (idempotent), but bot records to the review queue + grants NO role + surfaces "pending review"; operator-review decides keep/revert (revert = an identity-api dependency). Document: the gate is on the role + review-flag, not the spine write.

**RT-5 · Claim→link TOCTOU (ATK-002).** Single transaction per token: validate-token → SIWE-verify → link → **consume-claim** → grant; the H-2 atomic claim is consumed only AFTER a successful link for that token+wallet (not at page-open); failure rolls back the claim.

**RT-6 · custom_id ownership (ATK-004).** `isOnboarding` matches an exact reserved `onboard:` prefix owned solely by C2; dispatch validates the component originated from the bot's own verify card before acting — no future-character collision misroute.

**RT-7 · Supply-chain posture (ATK-009).** wagmi/Dynamic version-pinned + lockfile-audited; the page bundle holds NO secret (H-1/H-7), bounding a compromised client to its own session (no service-token exfil).

**RT-8 · Ephemeral-URL leak → wallet-binding hijack (ATK-001 · CRITICAL residual).** A leaked verify URL (screen-share/OBS/push-preview/forward) lets an attacker race `/complete` with THEIR wallet → binds the **target's discord_id to the attacker's wallet** (identity-binding hijack — not mere annoyance: the target's freeside account now points at an attacker wallet). Base mitigations (short TTL ≤5m, one-time, `Referrer-Policy:no-referrer`) reduce but don't close it. **Robust fix — DECIDED (operator 2026-05-29): Discord OAuth2 on the verify page.** The page MUST complete a Discord OAuth2 login and require `oauth.discord_id == token.discord_id` BEFORE any wallet-connect/SIWE/link — a URL thief cannot authenticate as the target, fully closing ATK-001. Adds `DISCORD_OAUTH_CLIENT_ID` + `DISCORD_OAUTH_SECRET` + a `redirect_uri` on the Bun verify surface; the OAuth gate precedes wallet connect in the C4 flow.

**ATK-005 (discord-id enumeration oracle): LOW** — Discord guarantees `interaction.user` is the clicker, so an attacker can only probe their own state, not enumerate others. No change.

**RT-9 · Phishing / typo-squat residual (ATK-003, re-run).** A look-alike verify page on an attacker domain can phish a SIWE signature — but RT-1's server-side domain pinning makes a signature for the fake domain useless at the REAL endpoint, and RT-8's Discord OAuth on the real page is the trust anchor. Residual = general phishing (CollabLand-class); mitigate via the canonical verify-card link + user education. No new mechanism.

**RT-10 · Bot-token compromise → card spoofing (ATK-010, re-run).** A leaked `DISCORD_BOT_TOKEN` lets an attacker post fake verify cards — standard bot-token risk, not verify-specific. Mitigate via existing token hygiene (secret manager, rotation, least-priv); deny-rules already block agent access to credential stores.

**Tooling note (#582):** the red-team orchestrator failed twice (exit 3) — its opus-grounding gate scored all attacks 0 regardless of `--domain`, a known bug. Both runs' attacks were on-target and MANUALLY triaged (RT-1..10 above). Phase 4.5 closed via manual triage; the tool's auto-classification is unusable until #582 is fixed.

## 7. Tech stack

Bun (≥1.1) · TypeScript strict · discord.js 14.26.4 (CV2 components + interactions) · `node:crypto` (HMAC-SHA256 state token) · **Effect-TS** for C5/C6 error surfaces (`Effect.Effect<R, TaggedError>` per `[[feedback_effect_ts_new_surfaces]]`) · wagmi + Dynamic (C4 wallet connect) · identity-api (SIWE auth spine) · Zod (request validation). No new database (state in `.run/` jsonl + identity-api spine).

## 8. Scalability / performance / anti-spam

- The verify card is ONE persistent message; verify load is human-paced (no rate-limit pressure like the digest webhook path).
- State-token nonce set in `.run/onboarding-nonces.jsonl` — pruned on expiry; bounded.
- Discord interaction 3-second ack window: C2 must `deferReply` (ephemeral) if the pre-check (resolveByDiscord network call) risks >3s.
- mTLS / TLS to identity-api per the Bearer-pattern doctrine.

## 9. Dependencies + open architectural questions

- **HARD DEP** — identity-api `GET /v1/resolve/account/discord/{id}` (FR-2). Deployment-gated; slip-fallback = `resolveByWallet`-after-connect (degraded idempotency). File the identity-api issue.
- **Fork audit** — sietch `verify.routes.ts` must be audited for EIP-4361 nonce/expiry/domain/chain binding (FR-10) before fork; document "partially working" gaps.
- **Resolved (operator 2026-05-29):** (a) C4 = **self-rendered wagmi/Dynamic page** calling identity-api `/v1/auth/challenge→verify→link` directly (own origin/domain control for H-4 SIWE binding + the H-1 opaque-token handoff; no hosted modal). (b) secret provisioning → H-6. (c) operator-review queue → H-5 (`.run/onboarding-review.jsonl`). (d) cutover → PRD §9.
- **Disputed-accepted (IMP-012):** centralize the `mibera` world-slug as one constant (cross-world-contamination guard).

## 10. Component → FR traceability

C1→FR-1,9 · C2→FR-2,7,9,13 · C3→FR-9 · C4→FR-3,10 · C5→FR-4,5,11,14 · C6→FR-6,12,13 · C7→FR-8,14 · §9-cutover→PRD§9. Every FR has an owning component; every component traces to ≥1 FR.

---

*Phase 3 Architecture output. Design is grounded in the production identity-api Phase-1 endpoints + the verified bot interaction seams; §9 names the dependency + open items. Next: Phase 3.5/4 SDD review (Bridgebuilder + Flatline).*
