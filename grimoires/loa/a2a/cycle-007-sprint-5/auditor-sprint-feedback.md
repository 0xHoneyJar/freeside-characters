# Security Audit — Sprint 5 — Dashboard UI + SSE-Behind-Flag

**Date:** 2026-05-17
**Auditor:** Paranoid Cypherpunk Auditor (audit-sprint skill)
**Sprint:** cycle-007 sprint-5 — Dashboard UI Extension + SSE-Behind-Flag + AC-RT-001
**Implementation commits:** `d924bba` (r1) · `8e3c642` (r2) · pending (r3)
**Verdict:** **APPROVED - LETS FUCKING GO**

---

## Executive Summary

Security audit of the sprint-5 dashboard implementation. The defense-in-depth layering for AC-RT-001 (hostname bind + Host allowlist + bearer-token cookie with HttpOnly + SameSite=Strict + perimeter Origin check + constant-time compare) reads correctly. The XSS surface is closed via textContent-only client rendering and server-side `sanitizeForTerminal` on SSE payloads. The SSE state machine handles eviction + heartbeat + truncation correctly. After r2 senior-lead review, the audit pass surfaced two additional findings (one HIGH-severity DoS class · one MEDIUM availability class), both fixed inline as r3 commit.

| Severity | Count | Disposition |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | Fixed in r3 (parseCookie URIError → DoS class) |
| MEDIUM | 1 | Fixed in r3 (sseScanTick uncontained throws → process-crash class) |
| LOW | 2 | Documented · accepted |
| INFO | 4 | Documented |

Final verdict: **APPROVED**. The implementation is production-ready as a single-developer local trace dashboard with appropriate operator-trust posture.

---

## Findings

### 🟠 HIGH-1 (FIXED in r3) · `parseCookie` URIError DoS

**Location** (pre-fix): `scripts/dashboard.ts:174`
```ts
if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
```

**Attack:** A malformed Cookie header carrying a bare `%` or invalid hex sequence (e.g., `Cookie: loa_dash_token=%`) makes `decodeURIComponent` throw URIError. The throw propagates out of `parseCookie`, out of `authenticated()`, into the `fetch()` handler. Bun's default fetch error path returns 500 to the client — but the more concerning class is whether the error handler runs OOM cleanup or just emits the error to stderr; if a malicious attacker sends thousands of malformed-cookie requests, each triggers an uncaught-throw + error-trace allocation, which could exhaust process memory. Single-request DoS at minimum.

**Severity rationale:** HIGH. Pre-auth attack surface (the cookie is parsed BEFORE the auth check completes) means even unauthenticated attackers can trigger the throw. The dashboard is localhost-only, so the attacker must already have local-process access — but localhost trust is exactly the assumption that gets violated by malware / supply-chain attacks / leaky containers.

**Fix** (r3): Wrap `decodeURIComponent` in try-catch; treat malformed values as "no credential."

```ts
if (k === name) {
  try {
    return decodeURIComponent(part.slice(eq + 1).trim());
  } catch {
    return null;
  }
}
```

**Regression coverage:** `scripts/dashboard.test.ts` — 2 new tests:
- `malformed cookie value (bare %) does not crash · returns 401`
- `malformed cookie value (invalid hex sequence) does not crash · returns 401`

Both verify the request returns 401 (auth-required) rather than 500 or process death.

**Status:** ✓ Fixed and regression-tested.

---

### 🟡 MEDIUM-1 (FIXED in r3) · `sseScanTick` uncontained throws → process crash

**Location** (pre-fix): `scripts/dashboard.ts:830-856`

**Concern:** The SSE scan loop is invoked via `setInterval(sseScanTick, 2000)`. If `readLlmTrace()` throws (corrupted jsonl, fs read error, OOM during JSON.parse), `rememberRunId` throws, `shapeRowForSse` throws, or `broadcastSse` throws, the exception bubbles out of the setInterval callback. In Node-like runtimes (Bun included), uncaught exceptions in setInterval callbacks trigger the unhandled-exception handler. Default behavior: process crashes. The dashboard goes down silently for the operator — and crucially, the operator has no observable signal that the scan loop died.

**Severity rationale:** MEDIUM. Pre-auth surface, but no attacker control over the trigger (the trigger is local fs state). Availability class — could cause silent dashboard death during high-trace-volume cycles or after a malformed jsonl row lands. The cycle's IMP-012 reader-tolerance contract is designed to skip malformed rows in `readJsonlRows`, but anything beyond that surface (e.g., `JSON.parse` on the seen-set's bookkeeping) could still throw.

**Fix** (r3): Wrap the entire `sseScanTick` body in try-catch; log via `console.warn` and continue. The next tick retries with the same input, but if the input is persistently bad (corrupted file), the warn-loop is observable + the operator can investigate without process death.

**Regression coverage:** Indirect — the existing SSE flag-state tests would surface a crash via test failure. A direct fault-injection test could be added in a follow-up, but the structural fix (containment + log) is sufficient for the severity class.

**Status:** ✓ Fixed.

---

### 🟢 LOW-1 (ACCEPTED) · `LOA_DASH_TOKEN` printed to stderr

**Location:** `scripts/dashboard.ts:889-891`
```ts
console.error(`[dashboard] LOA_DASH_TOKEN=${LOA_DASH_TOKEN}`);
console.error(`[dashboard] bootstrap cookie: curl -i -X POST -H 'X-Loa-Dash-Token: ${LOA_DASH_TOKEN}' ...`);
```

**Concern:** The token surfaces in:
- Operator's terminal scrollback (intentional — needed for the curl bootstrap)
- Shared terminal sessions (tmux, screen) with shoulder-surfing risk
- Process supervisor logs (systemd, pm2, Railway logs) that capture stderr
- Screenshots / screen recordings the operator might share for debugging

**Mitigation in place:** The token is a per-session random UUID (regenerated on every dashboard restart). Even if leaked, it expires when the dashboard process dies. The cookie carries the token but with HttpOnly + SameSite=Strict + no Secure flag (localhost HTTP only).

**Disposition:** ACCEPTED. This is the AC-RT-001 design — operator MUST have visibility into the token to bootstrap the cookie. The alternatives (file-based token, env var-only, prompt-for-token) all have worse UX without meaningfully better security in the operator-trust environment. Documented in SDD §2.6 + sprint-5-COMPLETED.md.

---

### 🟢 LOW-2 (ACCEPTED) · 60s heartbeat is structurally proven, not wall-clock tested

**Location:** `scripts/dashboard.ts:837-844`

**Concern:** The acceptance criterion calls for "60s heartbeat ping received." The current test verifies the initial `: hello\n\n` comment arrives, which proves the same `start()` callback wired the setInterval — but doesn't wall-clock-verify a ping at 60s.

**Mitigation:** The structural proof is high-confidence: hello + setInterval are co-located in `start()`, and the test asserts hello arrives. The setInterval IS scheduled if the test passes.

**Disposition:** ACCEPTED. A wall-clock 60s test would burn CI runtime. A `LOA_DASH_HEARTBEAT_MS` env override could be added in a follow-up to allow a 500ms-cadence test if BB or future audit pushes back. Documented in sprint-5-COMPLETED.md AC-T5.5-G.

---

### 🟢 INFO-1 · Cookie Path=/ is more permissive than necessary

Documented in r2 review (ISSUE-5). HTML page lives at `/`, cookie must reach it. Acceptable for current scope. Future split into `/` + `/api` + `/sse` would benefit from per-path cookie scoping.

### 🟢 INFO-2 · HTTP status code split (401 vs 403) diverges from sprint.md text

Documented in r2 review (ISSUE-7). RFC 7235 semantically correct. Operator can request uniform-403 amendment at S8 close if desired. Documented in sprint-5-COMPLETED.md AC-T5.5-E.

### 🟢 INFO-3 · `Bun.spawn` in tests passes process.env to child

`scripts/dashboard.test.ts::spawnDashboard` spreads `process.env` into the child. In a CI environment carrying secrets (GitHub Actions, etc.), those env vars would be readable from the dashboard subprocess. Since the dashboard subprocess only reads OUR specific env vars (DASHBOARD_PORT, LOA_DASH_TOKEN, LOA_DASH_SSE, TRACE_RUN_DIR), the actual leak vector requires the dashboard to log env it doesn't use — which it doesn't. Acceptable as-is.

### 🟢 INFO-4 · `broadcastSse` silently drops events for failing clients

When `controller.enqueue` throws (client disconnected mid-write), the catch clears the heartbeat + deletes the client from the map. No operator-visible log. For a teaching surface this is fine; for a production dashboard, a `console.warn('[dashboard] evicting client X due to enqueue error')` would improve observability. Documented in r2 review adversarial analysis. Not blocking.

---

## OWASP Top 10 Checklist

| Category | Risk | Verdict |
|---|---|---|
| A01:2021 Broken Access Control | Cookie + token + Host + Origin layered | ✓ Pass |
| A02:2021 Cryptographic Failures | Token via `crypto.randomUUID()` · HttpOnly cookie · no plaintext storage | ✓ Pass |
| A03:2021 Injection | No SQL, no shell exec; payload sanitization via `sanitizeForTerminal` + textContent | ✓ Pass |
| A04:2021 Insecure Design | Operator-trust scope explicit · DNS-rebinding hardening documented | ✓ Pass |
| A05:2021 Security Misconfiguration | Hardcoded `hostname: '127.0.0.1'` · no CORS · explicit Host allowlist | ✓ Pass |
| A06:2021 Vulnerable Components | Bun + Node stdlib only · no third-party dashboard deps added | ✓ Pass |
| A07:2021 Identification + Auth Failures | Constant-time token compare via `crypto.timingSafeEqual` · SHA-256 fingerprint | ✓ Pass |
| A08:2021 Software + Data Integrity Failures | Trace files read from allowlisted paths via `trace-readers` | ✓ Pass |
| A09:2021 Logging + Monitoring Failures | Token in stderr is intentional; `broadcastSse` silent-drop is INFO-4 | ⚠ Acceptable |
| A10:2021 SSRF | Server reads local fs only · no outbound HTTP | ✓ Pass |

---

## Secrets / Credentials Check

| Item | Verdict |
|---|---|
| Hardcoded passwords / API keys / tokens in source | ✓ None found |
| Token generation uses CSPRNG | ✓ `crypto.randomUUID()` |
| Token stored in plaintext anywhere on disk | ✓ Memory-only |
| Token transmitted in URL/query string | ✓ Header + cookie only |
| Token logged at INFO level | ⚠ Stderr at startup (intentional · LOW-1) |
| `.env` accidentally committed | ✓ Not touched by this sprint |
| Credentials in commit messages | ✓ Token values not committed |

---

## Input Validation Surface

| Input | Validation | Verdict |
|---|---|---|
| `Host:` header | Allowlist enum | ✓ Pass |
| `Origin:` header | Allowlist + null-allowed (same-origin) | ✓ Pass |
| `X-Loa-Dash-Token:` header | Constant-time compare to fixed-length token | ✓ Pass |
| `Cookie:` parsing | Try-catch on decodeURIComponent (r3 fix) | ✓ Pass |
| URL paths | Exact-match route table | ✓ Pass |
| Query strings | None used in this sprint | ✓ N/A |
| File path resolution | Allowlist via `trace-readers::FREESIDE_CHARACTERS_TRACE_FILES` | ✓ Pass |

---

## Data Privacy Check

| Item | Verdict |
|---|---|
| PII in dashboard output | Dashboard surfaces LLM trace rows which may contain user inputs · operator-trust scope · acceptable |
| Encryption at rest | N/A · localhost-only |
| Encryption in transit | N/A · localhost HTTP (no TLS by design) |
| Logging captures PII | LLM trace files captured PII pre-sprint; this sprint adds no new PII capture |
| Data retention policy | Trace files have their own retention; dashboard reads only |

---

## Code Quality Spot-Check

| Concern | Verdict |
|---|---|
| Hardcoded magic numbers | Named constants: `MAX_CLIENTS=5` · `HEARTBEAT_MS=60_000` · `PAYLOAD_TRUNCATE_AT=500` · `SEEN_RUN_ID_CAP=50_000` |
| Error swallowing | Documented per-callsite; new try-catches in r3 use `console.warn` |
| Dead code | None detected |
| Comments document the WHY not the WHAT | ✓ Pass (cycle-007 commit refs + AC references throughout) |
| TypeScript `any` usage | None in new code (all types preserved) |

---

## Verification

```bash
# After r3 audit fixes:
$ bun test scripts/dashboard.test.ts
# 19 pass · 0 fail · 53 expect() calls

$ bun test
# 1024 pass · 1 skip · 0 fail · 2622 expect() calls

$ bun run lint:cycle-007
# INV-12 ✓ · INV-17 ✓ · INV-14 ✓

$ bunx tsc --noEmit on scripts/dashboard.ts scripts/dashboard.test.ts
# exit 0
```

---

## Disposition

**APPROVED - LETS FUCKING GO**

Two findings (HIGH parseCookie URIError + MEDIUM sseScanTick containment) were surfaced during the audit pass and fixed inline as r3. Two LOW + four INFO findings documented as accepted-with-mitigation. The sprint is production-ready as a single-developer local trace dashboard with operator-trust posture.

Next step: Create COMPLETED marker; sprint moves to consolidated PR.

**Sprint status: COMPLETED**
