---
date: 2026-05-23
type: tend-pass
status: complete
mode: TEND (KEEPER) + craft lens
construct: fagan (thorough · multimodel panel) + observer
topic: wield FAGAN-thorough on cycle-008 capability-wiring + repo hygiene
---

# FAGAN-thorough TEND pass — cycle-008 capability-wiring

Thread A of the 2026-05-23 FAGAN-flatline kickoff: **the tool, now wielded.**
FAGAN-thorough (built earlier today) reviewed the 6-commit capability-wiring diff;
findings fixed under the panel's own gate (FAGAN re-reviews the fix · typecheck + tests green).

## Panel run 1 — the cycle-008 diff (71 files · 2137 lines)

**Width: 2 voices (composer-reviewer DROPPED — cursor adapter returned no valid JSON).**
The "three model" config is live in `.loa.config.yaml` but composer isn't landing —
honest-headcount design held (never substituted). Verdict: **CHANGES_REQUIRED**.

| # | severity | file:line | voice(s) | status |
|---|---|---|---|---|
| 1 | major | `enriched-render.ts` spotlight handle | gpt (major) + opus (cleanup) | FIXED |
| 2 | major | `digest-orchestrator.ts:232` resolve timeout | opus-skeptic (lone) | FIXED |
| 3 | cleanup | `schema-drift.test.ts` version exhaustiveness | gpt | FIXED |
| 4 | cleanup | allowed_mentions defensive note | opus | already defended (see below) |

### Finding 1 — unescaped identity → Discord (sanitize-invariant violation)
`pickSpotlightDisplay` resolves an external identity (`handle ?? discord_username ?? mibera_id`)
that was rendered into a Components V2 TextDisplay via `**${who}**` with **only `stripEmDashes`** —
no markdown escape. Reviewers framed it as a mass-ping vector.

**Grounding correction (the spec's "false-alarm-from-thinner-context" flavor):** the send layer
ALREADY pins `allowed_mentions: { parse: [] }` (`webhook.ts:126,136,178,228`) — so `@everyone`
cannot ping. The REAL residual is markdown **distortion**: a `mibera_id` like `mibera_acquire`
italicizes mid-word — exactly the CLAUDE.md NON-NEGOTIABLE sanitize invariant.

**Fix:** wrap the handle in the sanctioned `escapeDiscordMarkdown` (`deliver/sanitize.ts`) at the
presentation boundary (per chat-medium-presentation-boundary doctrine — escape at render, not at
the data layer). Reuse, not reinvent. Maps to the recurring `auth-profiles-treated-as-trusted` seam.

### Finding 2 — dropped timeout inside the per-zone cron lock (availability)
Slice-1 swapped the HTTP-MCP call (which had a 5s AbortController) for in-process `resolveWallet`
and **dropped the timeout**. **Grounding confirms real:** `resolveWallet` does Postgres I/O on a
cache-miss (`pool.connect()` + `midi_profiles` queries · `server.ts:158-209`); node-postgres
`pool.connect()` blocks indefinitely on an exhausted pool. It runs inside the digest cron's
per-zone lock → an unbounded stall wedges that zone's ENTIRE posting pipeline. The try/catch
handles throws, not hangs. **Lone skeptic flag → held the gate (never out-voted).**

**Fix:** `Promise.race` with a 5s timeout + `finally` clear; ANON_MEMBER fallback preserved on
timeout (NFR-29). Restores the safeguard slice-1 dropped.

### Finding 3 — schema-drift version list could silently drift
`ACCEPTED_RAW_STATS_VERSIONS` manually duplicated the `RawStats['schema_version']` union with no
exhaustiveness check. **Fix:** `satisfies readonly RawStats['schema_version'][]` (blocks invalid)
+ `Exclude<...> extends never` guard (blocks missing) — a future union edit now fails to compile
until synced.

## Verification (the gate)
- `bun run typecheck` → green (both packages)
- `bun test packages/persona-engine apps/bot` → **1125 pass · 2 skip · 0 fail** (71 files)
- FAGAN-thorough re-review of the fix-delta (87 lines) → **APPROVED** · 0 blocking · 2-voice
  (composer dropped again). gpt-reviewer: APPROVED/0. opus-skeptic: APPROVED + 1 cleanup note —
  "escaping is per-call-site at spotlight `who` only; future handle() sinks would silently bypass."
  Addressed with a guard comment at the `handle` definition (no current second sink exists — spotlight
  is the only wallet-identity render in the digest path). The recursion closed clean.

## Repo hygiene (same pass)
- **beads:** closed 9 stale cycle-006 epics (S0–S8) — cycle shipped + merged (PR #84) + COMPLETED.md
  present, but cycle-close never ran `br close`. cycle-007 beads were already clean.
- **lint suite green:** INV-12 (voice-prompt kebab) · INV-17 (manifest monotonic) ·
  INV-14 (append-discipline) · substrate-presentation seam.

## Grounding corrections to the agent-A dead-code inventory (verify-before-delete held)
- **Orchestrators are NOT safe to delete:** lore_drop/question/weaver/callout/pop-in are
  production-dead (cron fires only `digest` · `apps/bot/src/index.ts:364`; micro is event-driven via
  the router) BUT still routed by `apps/bot/src/cli/playground-fire.ts` (the kitchen / RLHF dev tool).
  Agent A was wrong exactly as the spec predicted.
- **CLAUDE.md "ruggy + satoshi" is NOT clear drift:** 8 character apps have persona.md, but the live
  roster is `CHARACTERS` env (active set `["ruggy","satoshi"]`); the other 6 are persona scaffolds.

## Follow-up: composer voice FIXED → 3-voice panel earns its keep (same day)

**Root cause of the composer drop:** `lib-cursor-exec.sh` invoked `cursor-agent --mode plan` — an
AGENTIC read-only *planning* loop that explores for minutes and blew past the panel timeout (a 10KB
review prompt: >180s under `plan` vs **~65s** under `--mode ask`, single-shot Q&A). Fix: `--mode plan`
→ `--mode ask` (construct-fagan, `feat/thorough-panel`). Safety unchanged (`--sandbox enabled` + empty
mktemp cwd + diff-in-prompt = empty blast radius). NOT a JSON/extraction bug — `_fagan_extract_json`
was already robust; it was pure latency → timeout → honest drop.

**The payoff, immediately:** re-ran the panel on the SAME fix-delta the 2-voice panel had APPROVED.
With composer (Kimi, distinct corpus) landing → **3 voices · CHANGES_REQUIRED · 1 blocking · dropped:[]**.
The 3rd voice caught a real subtlety in my own timeout fix that opus+gpt missed: `Promise.race`
ABANDONS but does not CANCEL `resolveWallet`, so my comment claiming to "restore the AbortController
safeguard" overclaimed. Cross-lab independence, demonstrated on the first true 3-voice run.

**Disposition (finding-accepted, fix-rejected-with-reason):** GROUNDED that the accumulation the
finding feared can't happen — the pg pool already sets `connectionTimeoutMillis:5000` (server.ts:84),
so `pool.connect()` is bounded; abandoned ops resolve/reject within ~5s and release their client
(server.ts:238 finally). The race's real job is the UNBOUNDED query phase (no `statement_timeout`).
Fix = corrected the comment to be honest; heavy "true cancellation" rejected with reason. (Third
false-alarm-from-thin-context this session — reviewers didn't see the pool config; same shape as the
allowed_mentions catch.)

## Deferred (surfaced, not done — need operator sequencing)
- 🔀 **post-type prune** (kill the 5 kitchen orchestrators) — multi-file runtime-routing change →
  its own gated slice, not a TEND micro-fix. Operator signal = digest + micro only.
- 🔀 **`.claude/` construct-sync churn** — fagan vendored→symlink + archivist-skill deletes + new
  untracked packs. System Zone git-tracking hygiene; separate decision.
- ✅ **composer voice** — FIXED (see follow-up above); panel now runs true 3-voice.
- 🟡 **`.loa` v1.108→v1.159 bump** — shipped as its own PR (#90), OUT of the cycle-008 PR.
- 🟡 **CHANGELOG drift** — tags reached v0.11.3 with no entries (log resumes at [0.12.0]); v0.10–v0.11.3
  reconciliation is a separate hygiene task.
