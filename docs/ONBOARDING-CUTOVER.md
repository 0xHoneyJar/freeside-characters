# Onboarding Cutover Runbook (sietch → freeside onboarding character)

> cycle-009 · sprint-5 (g35) · T5.2 · PRD §9 · RT-9/RT-10
> **Status: NOT YET EXECUTED.** This is the operator-run cutover procedure. The build is complete
> and DEP-A-gated; execution is a deliberate, monitored, operator act — not autonomous.

## Pre-flight gates (ALL must be green before step 1)

- [ ] **DEP-A** — identity-api `GET /v1/resolve/account/discord/{id}` shipped, OR
      `ONBOARDING_IDEMPOTENT_MODE=resolve-by-wallet` set (degraded idempotency · IMP-002).
- [ ] **Discord OAuth2 app** registered: client id/secret, redirect URI `=${VERIFY_ORIGIN}/verify/oauth/callback`
      added to the app's OAuth2 → Redirects list. (`identify` scope only.)
- [ ] **Env complete** (onboarding stays OFF until all present):
      `VERIFY_ORIGIN` · `DISCORD_OAUTH_CLIENT_ID` · `DISCORD_OAUTH_CLIENT_SECRET` ·
      `IDENTITY_SERVICE_TOKEN` · `DISCORD_BOT_TOKEN` · `ONBOARDING_VERIFIED_ROLE_ID` ·
      `ONBOARDING_STATE_SECRET` (≥32B CSPRNG) · `ONBOARDING_CHAIN_ID` (default 80094).
- [ ] **TLS / public origin** — `VERIFY_ORIGIN` resolves over HTTPS to the bot's `/verify/*` routes
      (Railway/ECS reverse proxy → `INTERACTIONS_PORT`).
- [ ] **Bot role hierarchy** — the bot's top role is ABOVE `ONBOARDING_VERIFIED_ROLE_ID`, and the bot
      has `MANAGE_ROLES`. (Otherwise grants 403 → `role_granted:false` silently.)
- [ ] **Boot log shows** `onboarding: ENABLED · verify @ … · idempotent-mode=…`.

## RT-10 — bot-token hygiene (do this BEFORE go-live)

- [ ] Rotate `DISCORD_BOT_TOKEN` if it has ever been pasted into a chat/log/PR.
- [ ] Confirm the token is set ONLY in the host secret store (Railway/ECS), never committed.
- [ ] `IDENTITY_SERVICE_TOKEN` + `ONBOARDING_STATE_SECRET` likewise — secret store only.
- [ ] Verify `/health` does NOT echo any secret (it returns only counters).

## The 6-step cutover

1. **Dry-run in a test guild.** Point a non-prod guild at the bot. Post the verify card
   (`POST_TYPE_GALLERY` → `verify`, or admin-post `buildVerifyCard()`). Click → OAuth → connect →
   sign → confirm: role granted, `/health` `onboarding.verified` increments, no errors.
2. **Post the hidden card in prod.** Post the verify card to the prod onboarding channel with the
   channel still hidden from @everyone (staging visibility — ops only).
3. **Hide sietch verify.** Disable sietch's THJ `/verify` surface (sietch side) so the two never
   run concurrently (no double-verify · AC T5.2). Confirm sietch verify is dark.
4. **Reveal.** Unhide the onboarding channel / verify card to @everyone.
5. **Monitor N days.** Watch `/health` `onboarding` counters: `verified` climbing, `oauth_mismatch`
   ~0 (spikes = leaked-URL probing · ATK-001 working), `link_outage` ~0 (spikes = identity-api
   trouble → FR-14), `conflict` reviewed (drain `.run/onboarding-review.jsonl`). Also tail the
   structured `onboarding.verify event=…` logs.
6. **Decommission sietch verify** once the monitor window is clean.

## RT-9 — phishing residual (user education)

A verify flow trains users to "connect wallet + sign on a website" — the exact phishing pattern.
Mitigations baked in + to communicate:

- The ONLY canonical verify origin is `VERIFY_ORIGIN`. State it in the channel + pinned message.
- The verify URL is ephemeral (the bot DMs/ephemerally replies it; it is NOT posted publicly) and
  expires in 5 min. Tell users: a verify link that didn't come from your own button click is fake.
- The page NEVER asks for a seed phrase / private key / funds — only a `personal_sign` of a
  human-readable message. Say so explicitly.

## Rollback

**Trigger:** `oauth_mismatch` or `link_outage` sustained spike · grant failures · any report of a
mis-bound wallet.

1. Set `verifyRuntime` off — unset any one required env var (e.g. `VERIFY_ORIGIN`) + restart →
   onboarding `DISABLED`, verify routes 404, dispatch no-op. (Digest cron unaffected — disjoint.)
2. Re-enable sietch verify (reverse step 3).
3. Triage `.run/onboarding-audit.jsonl` + `.run/onboarding-review.jsonl` for any bad links; the
   identity-api link is idempotent + conflict-policied, so a rebound is queued, not auto-applied.

## Rollback matrix (T5.4)

| symptom | counter | first action |
|---|---|---|
| strangers binding wallets | `oauth_mismatch` ↑ | confirm ATK-001 rejects (403); check for leaked-URL source |
| nobody completing | `verify_root` ↑ but `verified` flat | check OAuth redirect URI + role hierarchy (403 grants) |
| identity-api down | `link_outage` ↑ | FR-14 in-character holds; flip `resolve-by-wallet` if DEP-A regressed |
| many pending reviews | `conflict` ↑ | drain `onboarding-review.jsonl`; confirm FR-12 policy |
