# cycle-009 · onboarding-character (freeside verify bot) · Sprint Plan

> **Sprint Plan** · /simstim Phase 5 · derives from `prd.md` (FR-1..14, §9) + `sdd.md` (C1..7, H-1..8, RT-1..10)
> **Date**: 2026-05-29 · **Status**: DRAFT (ready for Phase 6 Flatline-sprint review)
> **Global numbering**: continues from cycle-008 (last global = 30) → cycle-009 = global **31–35**
> **Branch**: `cycle-009-onboarding-character`
> **Mode**: ARCH + craft · test-first where unit-testable (substrate), integration-tested for the verify flow

## Dependency (cross-repo · gates deploy)

**DEP-A · identity-api `GET /v1/resolve/account/discord/{id}`** (FR-2 idempotent pre-check). Phase-2/unbuilt. **File identity-api issue** (owner + target date + response schema + error states + acceptance tests). **Deployment gate:** dev proceeds; no live THJ deploy until it ships. **Slip-fallback:** `resolveByWallet`-after-connect (degraded idempotency) keeps v1 shippable.

## Sprint sequence

| local | global | scope | risk | gates |
|---|---|---|---|---|
| sprint-1 | 31 | CORE substrate (token + auth client) | MEDIUM | — |
| sprint-2 | 32 | INTERACTION (verify card + dispatch) | MEDIUM | DEP-A (pre-check; slip-fallback if not ready) |
| sprint-3 | 33 | WEB VERIFY (Bun surface · OAuth · SIWE) | HIGH | S3.0 SIWE audit gate |
| sprint-4 | 34 | LINK + ROLE (account + grant + policy) | HIGH | — |
| sprint-5 | 35 | CUTOVER + persona | MEDIUM | DEP-A (deploy gate) · §9 runbook |

---

## Sprint 1: [g31] CORE substrate — `packages/persona-engine/src/onboarding/`

- **T1.1 State-token service (C3, H-1/H-2/H-6/RT-2).** Opaque-id URL token; server-side state `{discord_id,nonce,exp,iid,gid}` keyed by opaque id; HMAC w/ `ONBOARDING_STATE_SECRET` (≥32B CSPRNG, env, `kid` for rotation); atomic `O_EXCL`/`mkdir` per-id claim consume; `.run/onboarding-*.jsonl` writes per-field JSON-encoded + wallet `^0x[0-9a-fA-F]{40}$` validated.
  - **AC:** mint→validate round-trips; expired/replayed/forged tokens rejected; concurrent consume of one token → exactly one winner (test the O_EXCL claim); no raw interpolation into jsonl (injection test). Unit-tested, no network.
- **T1.2 freeside-auth client (C5, FR-4/5/11/14, RT-3).** Effect-TS typed wrapper: `resolveByDiscord` (DEP-A), `resolveByWallet`, `challenge`, `verify`, `link(worldSlug:'mibera')`; svc-token server-only; **error layer redacts headers/token** (RT-3, allowlist-serialize); bounded retry + idempotency key (RT-8/H-8); in-character outage error (FR-14).
  - **AC:** each endpoint typed + tested against fixtures/mocks; a forced TaggedError NEVER contains the svc-token (redaction test); retry bounded + idempotent. Unit-tested.

## Sprint 2: [g32] INTERACTION — `apps/bot/src/discord-interactions/`

- **T2.1 Verify-card renderer (C1, FR-1/FR-9, RT-6).** CV2 Container + `custom_id="onboard:verify"` Button (NOT URL button); reserved `onboard:` prefix.
  - **AC:** renders via the gallery (add to POST_TYPE_GALLERY); button is custom_id; IS_COMPONENTS_V2 flag set.
- **T2.2 Onboarding dispatch (C2, FR-2/7/13, H-3, RT-6).** `isOnboarding` early-detect at `dispatch.ts:193` (mirror `isQuest`, validate provenance); **unconditional `deferReply({ephemeral})`** then pre-check via C5.resolveByDiscord → (linked+role→"verified✓") / (linked+no-role→re-grant→"restored✓", FR-13) / (new→mint token, editReply with verify URL); anti-spam drop bot-authored.
  - **AC:** the 3 pre-check branches; never exceeds the 3s ACK (deferReply first); bot-authored interactions dropped; custom_id collision from a foreign component rejected. Integration-tested via the interaction seam.

## Sprint 3: [g33] WEB VERIFY — `apps/bot/src/verify/` (forked from sietch `verify.routes.ts`)

- **T3.0 SIWE audit GATE (H-4/RT-1) — blocks the fork.** Audit sietch `verify.routes.ts`: server-side single-use nonce · `domain`==static `VERIFY_ORIGIN` · `chainId` pinned · `expirationTime`≤5m · URI/authority bound (EIP-4361). Document "partially working" gaps. **No fork until green.**
  - **AC:** a written audit verdict against the 5 criteria; gaps listed.
- **T3.1 Verify page + Discord OAuth2 (C4, FR-3, RT-8).** `GET /verify/:token` validates token (C3) → **Discord OAuth2 login → require `oauth.discord_id==token.discord_id`** → render wagmi/Dynamic connect; `Referrer-Policy:no-referrer`; no secret in client bundle.
  - **AC:** invalid/expired token rejected; OAuth mismatch (wrong Discord user) rejected (ATK-001 test); client bundle contains no svc-token.
- **T3.2 SIWE + complete handler (FR-10, RT-1/RT-7/RT-5).** `POST /verify/:token/complete` (server-only): SIWE `challenge→verify` (static-origin domain, RT-1); CSRF Origin/Host vs static config (RT-7); single transaction validate→verify→link→consume-claim→grant (RT-5 TOCTOU).
  - **AC:** Host-header substitution rejected (ATK-006 test); forked-host SIWE signature useless (RT-1 test); claim consumed only post-link; concurrent /complete → one winner (ATK-002 test).

## Sprint 4: [g34] LINK + ROLE — `packages/persona-engine/src/onboarding/`

- **T4.1 Link + account (FR-4/5).** `C5.link({worldSlug:'mibera',discordId,walletAddress})` → `{user_id, conflict_resolved}`; audit-log every link (RT-3 redacted).
  - **AC:** fresh link creates user_id; idempotent replay → `idempotent:true`; link logged (no secret).
- **T4.2 Role-grant + conflict policy (C6, FR-6/12, H-5/RT-4).** `conflict_resolved==null`→grant @verified; `wallet_rebound`/`discord_rebound`→**provisional: no role, record to `.run/onboarding-review.jsonl` + audit, surface "pending review"** (RT-4); the gate is on role+review, not the spine write.
  - **AC:** null→role granted; rebound→no role + review-queue entry + "pending review" reply; review entries well-formed (RT-2). 
- **T4.3 Outage UX (FR-14).** identity-api down → in-character message + bounded retry + structured log.
  - **AC:** simulated outage → graceful in-character failure, no raw error, logged.

## Sprint 5: [g35] CUTOVER + persona — FINAL

- **T5.1 Persona (C7, FR-8).** `apps/character-onboarding/persona.md` — functional CollabLand register (light flavor), in-character error copy. Name TBD (persona-authorship gate).
  - **AC:** persona loads; error copy in register; respects authorship gate.
- **T5.2 Cutover runbook (§9, RT-9/RT-10).** Execute the 6-step sietch→bot cutover (dry-run test guild → hidden card → hide sietch → reveal → monitor N days → decommission); bot-token hygiene (RT-10); canonical-link/user-education for phishing residual (RT-9); rollback trigger.
  - **AC:** dry-run passes in a test guild; rollback documented + rehearsed; sietch THJ verify disabled cleanly (no double-verify).
- **T5.3 DEP-A integration.** Wire resolveByDiscord (or the slip-fallback); flip the deployment gate when identity-api ships it.
  - **AC:** idempotent pre-check live (resolveByDiscord) OR slip-fallback active + documented.

---

## Traceability

FR-1..14 + H-1..8 + RT-1..10 + §9 all map to a task above (T1.1→H-1/2/6/RT-2 · T1.2→FR-4/5/11/14,RT-3 · T2.1→FR-1/9,RT-6 · T2.2→FR-2/7/13,H-3,RT-6 · T3.0→H-4/RT-1 · T3.1→FR-3,RT-8 · T3.2→FR-10,RT-1/5/7 · T4.1→FR-4/5 · T4.2→FR-6/12,H-5/RT-4 · T4.3→FR-14 · T5.1→FR-8 · T5.2→§9,RT-9/10 · T5.3→FR-2/DEP-A). Security ACs are first-class (the Red-Team findings became build tasks, per §4.5 design).

## Flatline-sprint integration (Phase-6 · 72% agreement, full confidence, $0)

- **DEP-A concretized (IMP-001/SKP-001):** the identity-api issue MUST carry owner + target-date + escalation path + the contract (response schema · error states · acceptance tests) — not just "file it". (T5.3 AC.)
- **Slip-fallback executable (IMP-002/SKP-002):** add flag `ONBOARDING_IDEMPOTENT_MODE=resolve-by-discord|resolve-by-wallet`; trigger = DEP-A date slip; degraded UX = re-prompts connect once; the deploy-gate relaxes to "fallback-mode allowed" if chosen — resolves the fallback-vs-gate conflict. (T2.2/T5.3 AC.)
- **SIWE-audit pass/fail (IMP-003/SKP-003):** T3.0 — a gap in {server-side single-use nonce · domain-pin · chainId-pin · ≤5m expiry} BLOCKS the fork; cosmetic gaps → remediation task; persist the verdict to `grimoires/loa/a2a/`.
- **Cross-system partial-failure (IMP-009/SKP-003):** /complete is NOT atomic across 5 systems — per-step compensation: validate-token → SIWE-verify (no side-effect) → link (idempotent, identity-api owns) → **consume-claim AFTER link** (pre-link failure leaves token reusable) → role-grant (FR-13 re-grant on next click if grant fails post-link). (T3.2/T4.2 AC.)
- **OAuth2 binding (SKP-004):** RT-8's Discord OAuth needs `state` param (CSRF) · Secure/HttpOnly/SameSite session cookie · callback replay protection · single-use code. (T3.1 AC.)
- **Observability (IMP-006/007) → NEW T5.4:** centralize verify metrics (attempt/success/conflict/outage counters + structured logs + alerts) for the cutover monitor + an explicit rollback matrix.
- **Multi-instance nonce store (SKP-001 CRITICAL 880) — DEFAULT single-instance v1:** `O_EXCL` claim is single-process-correct; v1 deploys ONE bot service (matches current Railway posture) so it holds. Documented edge: a container restart mid-verify (≤5m window) loses the in-flight claim → user retries (minor). Shared store (identity-api-backed nonce / Redis) = the multi-instance upgrade, tracked not v1. **[operator: confirm single-instance v1]**
- **Deferred (opus-aligned):** central custom_id registry (IMP-011 — RT-6 prefix-ownership suffices); persona naming (IMP-010 — placeholdered).

*Phase 5+6 output. Next: Phase 7 implementation via `/run sprint-N` (NEVER direct `/implement`).*
