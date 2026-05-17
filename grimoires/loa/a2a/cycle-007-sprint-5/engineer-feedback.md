# Engineer Feedback — Sprint 5 — Dashboard UI + SSE-Behind-Flag

**Date:** 2026-05-17
**Reviewer:** Senior Tech Lead (review-sprint skill)
**Sprint:** cycle-007 sprint-5 — Dashboard UI Extension + SSE-Behind-Flag + AC-RT-001
**Implementation commit:** `d924bba`
**Verdict:** **CHANGES_REQUIRED** (2 blocking · 5 non-blocking)

---

## Overall Assessment

Strong implementation overall. The defense-in-depth layering for AC-RT-001 (`hostname:'127.0.0.1'` bind + Host allowlist + per-session bearer token via HttpOnly+SameSite=Strict cookie) reads exactly as the SDD §2.6 design intends. 15 well-shaped tests + 1020/0/1 full-suite regression + clean cycle-007 lints + clean typecheck across both new + modified files.

Two real gaps surfaced on adversarial pass — both small fixes, neither structural. Iterating to address them is cheaper than the alternative (deferring or amending the spec).

---

## Critical Issues (BLOCKING — must fix before approval)

### 🔴 ISSUE-1 · AC-T5.5-B "poll cadence suppressed" not honored

**AC quote** (sprint.md:566-567): `"Enabled (LOA_DASH_SSE=1): EventSource attaches · new row triggers flash · poll cadence suppressed"`

**Current behavior:** `scripts/dashboard.ts:735-737` — `attachSse()` opens the EventSource but `setInterval(refresh, 2000)` at line 770 runs unconditionally. The 2s poll continues alongside SSE for the entire session, even when SSE is delivering rows incrementally.

**Engineer's defense** (sprint-5-COMPLETED.md AC-T5.5-B status downgrade): _"the 2s poll catches any rows the scan-tick missed (and provides the rejections/baselines/violations data which aren't on the SSE channel)"_. This is reasoning that arrives AT the deviation — but the AC was the spec, and rejections/baselines/violations data continuing to poll is fine. The SPECIFIC AC is that the `/api/llm-trace` polling stops when SSE owns that channel. Currently it doesn't — the 5-endpoint `refresh()` fires every 2s regardless of SSE state.

**Required fix:** Gate the periodic refresh on SSE connection state. ~5 LoC client-side. Approximate shape:

```js
let pollHandle = setInterval(refresh, 2000);
function attachSse() {
  if (!SSE_ENABLED) return;
  const es = new EventSource('/sse', { withCredentials: true });
  es.onopen = () => {
    // Per AC-T5.5-B: poll cadence suppressed for the llm-trace channel when SSE connects.
    // We keep refresh wired only for non-llm-trace tabs (rejections/baselines/violations).
    clearInterval(pollHandle);
    pollHandle = setInterval(refreshNonTraceTabs, 2000);
  };
  es.onerror = () => {
    // Fall back to full poll cadence when SSE disconnects.
    clearInterval(pollHandle);
    pollHandle = setInterval(refresh, 2000);
  };
  // ... existing handlers
}
```

Update the AC-T5.5-B test to verify: after SSE connects, no further `/api/llm-trace` requests fire within a 5s window.

**Severity:** Blocking. Acceptance criterion text was direct; the deviation was solo-judged.

---

### 🔴 ISSUE-2 · AC-RT-010 test does not prove prior connection was actually closed

**AC quote** (sprint.md:571): `"AC-RT-010 reconnect-storm fixture: 5 connections with same token cap-at-1 + evict prior · OK"`

**Current test** (`scripts/dashboard.test.ts:271-290`): Opens 5 sequential SSE connections with the same token; asserts each returns 200. This proves "the global cap isn't tripped" but does NOT prove "the prior connection was evicted." A race between `evictSameTokenConnections` and the `start()` callback could leave both connections alive in the clients Map — the test wouldn't catch it.

**Adversarial scenario:** If `evictSameTokenConnections` runs but `controller.close()` throws (e.g., because the controller is in an unusual state from a prior partial enqueue), the catch block swallows it AND the `sseClients.delete(id)` still runs. But the underlying ReadableStream's consumer (the browser EventSource) wouldn't see a close. The result: orphaned stream + map entry deleted. Future eviction passes can't find it.

**Required fix:** Strengthen the test to read from the PRIOR connection's reader after the new connection arrives. Assert it returns `done: true` within a 500ms window. Example:

```ts
test('5 connections evict prior · prior reader sees done=true after eviction', async () => {
  const s = await spawnDashboard({ LOA_DASH_SSE: '1' });
  try {
    const firstCtl = new AbortController();
    const first = await fetch(`${s.baseUrl}/sse`, {
      headers: { 'x-loa-dash-token': FIXTURE_TOKEN, accept: 'text/event-stream' },
      signal: firstCtl.signal,
    });
    const firstReader = first.body!.getReader();
    await Promise.race([firstReader.read(), Bun.sleep(150)]); // consume hello

    // Open a second connection with the same token. This must evict `first`.
    const secondCtl = new AbortController();
    const second = await fetch(`${s.baseUrl}/sse`, {
      headers: { 'x-loa-dash-token': FIXTURE_TOKEN, accept: 'text/event-stream' },
      signal: secondCtl.signal,
    });
    expect(second.status).toBe(200);

    // The PRIOR reader should now see done=true (eviction → controller.close()).
    const evictionProof = await Promise.race([
      firstReader.read(),
      Bun.sleep(1_000).then(() => ({ done: false, value: undefined } as ReadableStreamReadResult<Uint8Array>)),
    ]);
    expect(evictionProof.done).toBe(true);
    firstCtl.abort();
    secondCtl.abort();
  } finally { killSpawn(s); }
});
```

Consider also: if the `controller.close()` in `evictSameTokenConnections` is moved inside a `try { ... } catch { /* ... */ }` (currently the case), the underlying stream cancel logic may not propagate. Verify the close path actually reaches the browser by reading the stream after eviction in the test.

**Severity:** Blocking. The reconnect-storm defense IS the entire AC-RT-010 concern. A test that doesn't prove eviction can't certify the defense works.

---

## Non-Blocking Concerns (recommend fix · do not block approval)

### 🟡 ISSUE-3 · `lastSeenRunIds` unbounded growth

**Location:** `scripts/dashboard.ts:572` — `const lastSeenRunIds = new Set<string>();`

**Concern:** The Set is never bounded. A dashboard left running for days will accumulate every run_id it ever saw. Each entry is ~36 chars + Set overhead → ~80 bytes. At 100 LLM calls/hour over 7 days → 17K entries → 1.4MB. Not catastrophic, but a slow leak class that grows with usage.

**Recommendation:** Cap at, say, 50K entries with FIFO eviction. When `lastSeenRunIds.size > 50_000`, convert to array, slice off the oldest 10K, rebuild. Or use a LRU cache helper.

**Severity:** Low. Dashboards rarely run 24/7 in operator workflow.

---

### 🟡 ISSUE-4 · `tokenFingerprint` uses last-12-char slice rather than crypto hash

**Location:** `scripts/dashboard.ts:213-219`

**Concern:** The fingerprint is the literal last 12 characters of the bearer token. For a UUID (36 chars), that's `${hex8}-${hex4}` of the random suffix. If the fingerprint ever surfaces in logs (e.g., a server error mentioning the client id alongside the fingerprint), an attacker who can see those logs gains 48 bits of the token. The token is 122 bits of entropy total; losing 48 brings it to 74 bits — still cryptographically strong, but the leak is unnecessary.

**Recommendation:** Use a SHA-256 hash of the token, truncated to 12 hex chars. This breaks any reversibility while preserving the "same token → same fingerprint" property.

```ts
import { createHash } from 'node:crypto';
function tokenFingerprint(req: Request): string {
  const raw = (req.headers.get('x-loa-dash-token') ?? parseCookie(req, COOKIE_NAME)) ?? '';
  if (!raw) return '';
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
```

**Severity:** Low. The fingerprint isn't currently logged anywhere; the risk is latent.

---

### 🟡 ISSUE-5 · Cookie `Path=/` is more permissive than necessary

**Location:** `scripts/dashboard.ts:172-174`

**Concern:** `Path=/` means the cookie attaches to EVERY request to this origin, including future static asset paths or any new endpoints added later. The defense-in-depth principle suggests cookies should have minimum scope.

**Recommendation:** Set `Path=/` for now (HTML page IS at `/`, so the cookie must reach it) but add a comment explaining why. If the dashboard later splits into `/` (HTML) + `/api` (data) + `/sse` (events), revisit and consider a 2-cookie split (one for HTML, one for API).

**Severity:** Low. Acceptable as-is; flagging for future architecture.

---

### 🟡 ISSUE-6 · Origin check applies only to `/sse`, not `/api/*` endpoints

**Location:** `scripts/dashboard.ts:128-134` (`originAllowed`) called only at `scripts/dashboard.ts:592`.

**Concern:** Host header validation catches DNS-rebinding for ALL endpoints. Origin check is layered for `/sse` only. A future attacker page that bypasses Host validation (somehow) could still hit `/api/*` endpoints with a cookie if the browser is convinced to send it. SameSite=Strict prevents this in practice, but Origin layering is cheap belt-and-suspenders.

**Recommendation:** Move the Origin check into the auth gate, applied to all authenticated endpoints. ~3 LoC.

**Severity:** Low. SameSite=Strict + Host validation are the load-bearing defenses.

---

### 🟡 ISSUE-7 · HTTP status code split (401 vs 403) diverges from sprint.md text

**Location:** `scripts/dashboard.ts:148-172` (401 on auth-missing) vs `scripts/dashboard.ts:615-617` (403 on Host-attack).

**Engineer rationale:** RFC 7235 distinguishes 401 (credentials required) from 403 (forbidden despite credentials). The split is semantically correct.

**Concern:** Sprint.md says "returns 403" for token failures across the board. The engineer made the split solo — arguably this should have been an operator pair-point because the AC text is direct.

**Recommendation:** Either:
- (a) Align to sprint.md and return 403 across the board (loses RFC semantics but matches contract);
- (b) Document the split as a sprint amendment in `sprint-5-COMPLETED.md` "Open Questions for Reviewer" (current state — already done) and request operator sign-off at S8 close;
- (c) Add a config flag to toggle behavior, defaulting to RFC-correct.

**Severity:** Low. Behavioral envelope ("unauthorized requests refused") matches spec; only the code differs. Already documented in COMPLETED.md.

---

## Adversarial Analysis

### Concerns Identified

1. **Concurrent eviction race in `evictSameTokenConnections`** (`scripts/dashboard.ts:228-238`): The function iterates `sseClients` map; if a new connection's `start()` callback adds to the map mid-iteration, the new client could be evicted by its own siblings. Bun's JS runtime is single-threaded so this is mostly theoretical — but worth a brief comment that the eviction operates on the snapshot of `sseClients` at function-entry time.

2. **`broadcastSse` failure mode silently drops events for failing clients** (`scripts/dashboard.ts:241-256`): When `controller.enqueue` throws, the catch clears the heartbeat and deletes the client from the map. But the operator never sees this happen — there's no log line saying "evicting client X due to enqueue error." For a teaching surface this is acceptable; for a production-monitored dashboard this would be noisy-but-better-than-silent. Worth a `console.warn` in the catch.

3. **Cross-layer connector logic is unobservable when 0 correlations exist** (`scripts/dashboard.ts:451-481`): If `relatedRowsByRunOrZone` returns empty arrays, the only visible UI signal is the dimmed-other-layer-panels (opacity 0.55). The operator might miss the cross-layer connector concept entirely. Consider: when 0 correlations, dim panels harder (opacity 0.3) so the contrast is more legible.

### Assumptions Challenged

- **Assumption**: Bun's `Response.body` is async-iterable (used in the truncation test at `scripts/dashboard.test.ts:280`).
- **Risk if wrong**: Test would hang on the for-await loop instead of returning. Bun's docs say yes, but this is a runtime contract that could change.
- **Recommendation**: The test's `Promise.race(...)` against a 15s sleep provides a hard timeout, so worst case is a 15s test failure. Acceptable. No action needed.

- **Assumption**: `crypto.randomUUID()` produces a token strong enough for session-bound auth (`scripts/dashboard.ts:48`).
- **Risk if wrong**: Predictable tokens enable token-guessing attacks. RFC 4122 v4 UUIDs are 122 bits of entropy from a cryptographic RNG, which is sufficient for non-persistent session credentials.
- **Recommendation**: Already secure. Document the entropy choice in a comment near the LOA_DASH_TOKEN const so future maintainers know.

### Alternatives Not Considered

- **Alternative**: Use Bun's built-in `routes` API (e.g., `routes: { '/api/auth': ..., '/sse': ... }`) instead of the single `fetch()` handler with manual path dispatch.
- **Tradeoff**: `routes` gives per-route definitions that are more declarative + can use Bun's route-pattern matching. The single `fetch()` handler is more flexible for cross-route middleware (auth + Host + Origin checks layered in front of every route uniformly).
- **Verdict**: Current approach is justified — the cross-cutting auth/Host gates are easier to apply uniformly with a single handler. Bun routes would require per-route boilerplate to enforce the gates.

- **Alternative**: Move SSE state into a dedicated module (`scripts/lib/sse-state.ts`) for testability + reusability.
- **Tradeoff**: Cleaner separation but adds an indirection. The SSE state is small (~40 LoC) and tightly coupled to dashboard.ts's `readLlmTrace` and `shapeRowForSse`.
- **Verdict**: Acceptable inlined for now. Extract if a second SSE consumer materializes (none planned).

---

## Karpathy Principles Verification

| Principle | Verdict | Notes |
|---|---|---|
| **Think Before Coding** | ✓ | Assumptions documented in sprint-5-COMPLETED.md (6 deviations listed). |
| **Simplicity First** | ✓ | One file rewrite. No new abstractions beyond what trace-readers.ts already exposed. ~900 LoC for 5 tasks is on-budget. |
| **Surgical Changes** | ⚠ | The dashboard.ts diff is +752/-154, which IS substantial — but unavoidable given the cookie auth + SSE state + layer-split detail all touch the same file. No drive-by unrelated changes detected. |
| **Goal-Driven** | ✓ | 15 tests have specific assertions tied to ACs; the AC verification table in COMPLETED.md walks each AC verbatim. |

---

## Complexity Analysis

| Function | Lines | Complexity | Verdict |
|---|---|---|---|
| `dashboard.ts::handleSse` | ~55 | Medium · 2-level nesting | OK |
| `dashboard.ts::sseScanTick` | ~25 | Low | OK |
| `dashboard.ts::Bun.serve.fetch` | ~50 | Medium · linear router | OK · could extract route table |
| `client::renderTraceDetail` | ~80 | Medium · panel construction | OK |
| `client::renderLayerGrid` | ~30 | Low | OK |

No function exceeds the 50-line threshold meaningfully. No deep nesting (>3). No duplicate code patterns. No circular imports.

---

## Documentation Verification

| Item | Status | Notes |
|---|---|---|
| CHANGELOG entry | N/A | Cycle-007 doesn't update root CHANGELOG; cycle-wide `COMPLETED.md` lands at S8/T8.1. |
| CLAUDE.md for new commands | N/A | No new commands. |
| Security code has comments | ✓ | `scripts/dashboard.ts:88-90` (constant-time match), `:116-117` (Host validation rationale), `:132-134` (Origin null = same-origin), `:170-174` (cookie flags rationale). |
| README for user-facing features | N/A | Dashboard is operator-facing; usage block at file head. |
| SDD for architecture changes | ⚠ | The cookie-bootstrap path deviates from SDD §2.6 (which still describes query-param auth). Sprint.md is the canonical post-Phase-6 evolution. Recommend updating SDD §2.6 in a follow-up to mark the query-param section as superseded. |

---

## Subagent Reports

No `grimoires/loa/a2a/subagent-reports/` entries exist for sprint-5. `/validate` was not run; not blocking.

---

## Next Steps

1. **Fix ISSUE-1** (poll suppression). ~5 LoC client-side change.
2. **Fix ISSUE-2** (AC-RT-010 test strengthening). ~30 LoC test addition.
3. (Optional) Address ISSUE-3 (FIFO cap on lastSeenRunIds) and ISSUE-4 (SHA-256 fingerprint). Both small wins.
4. Re-run `bun test scripts/dashboard.test.ts` → should be 16/0 with the strengthened AC-RT-010 test.
5. Re-run `bun test` → should remain 1020+ pass / 0 fail.
6. Commit with `feat(cycle-007 S5 r2): address poll-suppression + AC-RT-010 eviction proof`.

After re-implementation, /review-sprint sprint-5 re-runs and (assuming the 2 blocking items are resolved) approves with "All good."

---

## What I would say to the engineer in 3 sentences

> Strong implementation — the defense-in-depth layering is exactly right. Two items missed: poll-suppression was in the AC text and got argued-around rather than implemented, and the AC-RT-010 test verifies "no failure" without verifying "eviction happened." Both are small fixes; iterate, re-run, and we ship.
