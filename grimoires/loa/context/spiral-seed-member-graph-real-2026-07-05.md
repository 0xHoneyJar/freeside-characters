# spiral seed — member graph: real + queryable (ingestion + onboarding spine)

status: candidate · operator-ratified shape 2026-07-05 · feeds spiral-harness --seed-context (first 4KB injected)

## mission

when the bot installs into ANY guild, it operates shadow-mode-first: observes the doors members arrive through (discord roster, on-chain holdings, identity links), fills the canonical member graph via the shadow-mode ledger, and grants progressive, REVERSIBLE benefits. no per-world hardcoding — fc serves the layer of worlds via contracts (registerCommunity is the primitive).

## settle probe (success criterion — kaironic termination trusts this)

"who is X?" — given a discord handle OR wallet, one lookup returns the stitched identity: wallets, roles, holdings, labels — trust-badged, grounded in real ledger observations, noise shed. a cycle that makes this answer BETTER (more angles stitched, fewer unknowns, live data replacing stub data) beats a cycle that adds surface area.

## ratified decisions (operator 2026-07-05 — do not relitigate)

1. ledger seam = SERVICE BOUNDARY. fc talks to shadow-mode (loa-freeside PR #316/#430, merged) as a deployed service, never imports the pnpm package. the existing stub port (`apps/bot/src/shadow/ingestion/ledger-host.ts` + `shadow-mode-contract.ts`) becomes a live client behind the SAME contract. cross-repo work is out of scope (spiral is single-repo): if the service lacks a reachable transport, build the client + degrade gracefully behind the port and FILE the gap — do not vendor the package.
2. surface = ingestion + onboarding as one motion. NOT a query CLI or dashboard. progressive benefits + reversibility are the product.
3. world-agnostic: worlds are config/contract entries. no THJ/purupuru/pythenian special-casing in code paths.

## grounded state (post PR #186 merge to main, 2026-07-05)

- `apps/bot/src/shadow/ingestion/` — 3-angle ingestion merged: `discord.member.snapshot.v1`, `sonar.wallet.attributed.v1` (97 holders live-proven), `identity.*.linked`. two-phase orchestrator (parallel discord+onchain → barrier → serial identity). collision-safe event_id; takeover-safe conflict pre-check + quarantine (`.run/shadow/<cid>-quarantine.jsonl`).
- deferred from cycle-010 (the work list): swap GATE-PKG stub → real seam; wire LIVE discord/identity readers (producers currently inject network-free readers); durable ledger beyond in-process stub.
- beads in scope: `bd-fsl` (conflict taxonomy v2 + resolution UX) and `bd-t55` (apply transaction + revert + ceremony) — these ARE the reversibility machinery. opportunistic if a cycle converges early: `bd-i9f` (/quest awaits postgres before ACK → 3s timeout), `bd-1aa` (buildPrompt Effect-TS).

## boundaries (non-negotiable)

- voiceless: ingestion/onboarding never speaks in-character; substrate blocks use neutral mechanical vocabulary (governance-vs-voice separation).
- anti-spam invariant survives every phase: characters never respond unsolicited; no new auto-respond triggers.
- no sietch duplication (`/verify`, `/score` stay in sietch). no new database in fc (durable state belongs to the ledger service). no local score/LLM reimplementation.
- new error surfaces use `Effect.Effect<Result, TaggedError>` over native throws, migrated whole-module.
- shadow-first: degraded run suppresses enforcement/go-live; zero-RoleWriter enforcement stays tested.

## known weakest link (verify in cycle 1 discovery)

merged code ≠ running service: shadow-mode may not be DEPLOYED with a reachable transport yet. cycle 1 must ground the actual transport (URL/auth) before wiring; if absent, ship the live-client-behind-port with contract tests + a filed gap, and let later cycles bind it.
