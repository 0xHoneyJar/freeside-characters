# cycle-005 Flatline Blocker Triage

3-model flatline (opus + gpt-5.5 + gemini-3.1-pro) · 15 blockers across PRD/SDD/Sprint.

All blockers came from the gemini skeptic pass; opus + gpt-5.5 skeptics had findings below the 700 threshold.

Themes ordered by max severity descending:

## [850] Discord 1024-char field cap conflict with AC-2 (no truncation)

**occurrences:** 2 (prd, sprint)

### PRD SKP-001 (sev 850)

**concern:** AC-2 mandates 'ALL active factors... (no truncation)' but also requires fitting 'within Discord 1024-char field cap'. If the generated text for active factors exceeds 1024 characters, the Discord API ...

**rec:** Define explicit truncation, chunking, or pagination logic (e.g., capping at top N factors, or splitting across multiple embed fields) to guarantee the payload remains under the 1024-character limit....

### SPRINT SKP-002 (sev 750)

**concern:** Fail-fast on Discord 1024-character field limit blocks entire cron job...

**rec:** Implement automatic truncation (with a '...and X more' warning) or automatic pagination into multiple Discord embed fields instead of failing the payload build....


## [850] Layout shape selector has undefined case (permittedClaims=0 + multi-zone rank≥90)

**occurrences:** 1 (sprint)

### SPRINT SKP-001 (sev 850)

**concern:** Incomplete layout decision tree matrix leaves edge cases undefined...

**rec:** Explicitly define the layout shape for the case where `permittedClaims === 0` but multiple zones have `rank >= 90` (e.g., assign it to Shape C or create a specific Shape D)....


## [760] V1 telemetry-only allows known-bad prose to ship for 2-4 wks

**occurrences:** 3 (prd, prd, sdd)

### PRD SKP-001 (sev 720)

**concern:** Telemetry-only V1 gate provides no user-facing protection — operator-witnessed drift (sequential-mint chain, forced 'structural shift', fake 'p99-rare') continues to ship to Discord unmodified for the...

**rec:** Add an operator-controlled kill-switch env var (e.g., `PROSE_GATE_ON_VIOLATION=log|skip|silence`) that defaults to `log` (current V1 contract) but allows escalation to `skip` (drop the post) or `silence` (downgrade to shape-A) without waiting for V1.5. Document the kill-switch in NOTES.md and surfac...

### PRD SKP-001 (sev 760)

**concern:** V1 is telemetry-only, so the specific public prose failures the cycle is meant to prevent can still ship to Discord unchanged....

**rec:** Add an explicit go/no-go statement that V1 accepts continued public drift, or add a minimal runtime mitigation such as fallback to deterministic card-only output when a HIGH-confidence violation is detected....

### SDD SKP-001 (sev 760)

**concern:** The prose-gate is telemetry-only, so claims that are known to be unsupported can still be delivered to Discord unchanged....

**rec:** Define a V1 blocking or downgrade policy for at least high-confidence violations, or explicitly require staging-only telemetry until observed violation rates are understood....


## [750] factor_id attribution ambiguity in inspectProse

**occurrences:** 4 (prd, sdd, sdd, sdd)

### PRD SKP-003 (sev 705)

**concern:** The prose-gate does not define how matched phrases map to a specific factor_id when a draft contains multiple factors....

**rec:** Define the association algorithm: per-row inspection, line-scoped factor IDs, nearest preceding factor label, or explicit structured draft segments before text rendering....

### SDD SKP-002 (sev 735)

**concern:** Factor attribution for prose violations is unresolved and marked TBD, making the core validation semantics ambiguous....

**rec:** Specify a deterministic factor-reference algorithm before implementation, including behavior for zero, one, and multiple referenced factors, and add tests for each case....

### SDD SKP-001 (sev 750)

**concern:** Misattribution of Factor Stats in Regex Rules...

**rec:** Implement a proximity-based lookup: extract the nearest factor name mentioned within the same sentence or paragraph as the regex match to determine the correct factor_id, or default to 'unknown' if ambiguous....

### SDD SKP-001 (sev 720)

**concern:** factor_id resolution in inspectProse is unspecified (TBD) — V1 ambiguity between 'first factor referenced by name' vs 'all active factors' creates non-deterministic violation semantics...

**rec:** Resolve the TBD before merge. Pick one deterministic mapping (recommend: match factor_id by name-mention proximity in draft within an N-token window; fall back to 'no factor_id' when no name appears, emit reason='no-factor-context'). Add this to the schema and write a regression test that pins the c...


## [750] Substrate API failure / timeout fallback unspecified

**occurrences:** 1 (prd)

### PRD SKP-002 (sev 750)

**concern:** FR-1 assumes the substrate API calls (`get_dimension_breakdown` and `get_community_counts`) will always succeed. There is no defined error handling for timeouts, 5xx errors, or network partitions....

**rec:** Add explicit fallback behavior: define whether the job should retry with exponential backoff, skip the broadcast entirely, or post a degraded 'no data available' shape....


## [720] Chat-mode gate scope contradiction (AC-9 vs Open Q #3)

**occurrences:** 1 (prd)

### PRD SKP-002 (sev 720)

**concern:** Chat-mode gate scope is internally inconsistent....

**rec:** Resolve the contract: either remove chat-mode prose-gate expectations from AC-9 or explicitly require chat-mode gate invocation under defined conditions....


## [720] S0 precondition gate manual-only (needs T0.0 auto-check)

**occurrences:** 2 (sprint, sprint)

### SPRINT SKP-001 (sev 720)

**concern:** S0 precondition gate has no automated verification — plan asserts PR #77 merged, score-mibera 1.1.0 in prod, and cycle-004 substrate landed, but no task explicitly verifies these before S0 fires beyon...

**rec:** Add T0.0 as the first task: an automated precondition check script that (a) greps for `FactorStats` export in score/types.ts, (b) calls score-mcp `/health` or version endpoint to confirm 1.1.0, (c) checks `git log main..` for cycle-004 merge commit. Exit non-zero on any failure; S0 cannot proceed....

### SPRINT SKP-001 (sev 720)

**concern:** The plan contains contradictory gating around cycle-004: it is listed as a hard precondition requiring STOP if absent, but later S5 allows falling back to direct OpenTelemetry API if cycle-004 is not ...

**rec:** Make cycle-004 status a single explicit gate: either hard-block S0/S5 until merged, or formally define the fallback path with acceptance criteria, tests, and follow-up scope....


## [710] Hardcoded emoji 🔥👀⚡☁️ vs registry-only rule

**occurrences:** 1 (sdd)

### SDD SKP-003 (sev 710)

**concern:** The SDD proposes hardcoded mood emojis including 🔥 and ⚡, which conflicts with the repository's voice rules banning those user-facing emoji tells and requiring emoji selection through the registry....

**rec:** Replace hardcoded emojis with approved registry-mediated mood tags or confirm an explicit operator exception in the PRD/SDD before implementation....


