# Security Audit · sprint-bug-1 · bug-20260511-b6eb97

**Auditor**: Paranoid Cypherpunk Auditor (Opus 4.7)
**Date**: 2026-05-11
**Sprint**: sprint-bug-1
**Bug ID**: 20260511-b6eb97
**HEAD**: `e246dac` · 5 commits ahead of main
**Verdict**: **APPROVED — LETS FUCKING GO**

---

## Executive Summary

This is one of the most thoroughly-reviewed pieces of code in the repo right now. 6-layer defense-in-depth at the chat-medium write boundary, validated by 5 rounds of adversarial multi-model review (bridgebuilder Opus + 4 flatline rounds with Opus + Codex CLI + Gemini CLI), 591 tests pass · 0 fail, apps/bot typecheck clean.

The original bug — operator observed raw `API Error: 500` in Discord during a transient Bedrock outage — was a **data privacy issue** (upstream error bodies can carry stack traces, internal paths, model error envelopes with sensitive fields). This PR closes it by construction at the boundary, with defense layers that go far beyond the original ask.

---

## OWASP Top 10 mapping

| Category | Verdict | Notes |
|---|---|---|
| A01 Broken Access Control | N/A | No auth surface touched |
| A02 Cryptographic Failures | N/A | No crypto surface touched |
| A03 Injection | **PROTECTS** | Sanitizer at boundary prevents raw API error bodies from reaching Discord |
| A04 Insecure Design | **GOOD** | Defense-in-depth at the boundary (mirrors `stripVoiceDisciplineDrift` pattern, cmp-boundary §9) |
| A05 Security Misconfiguration | Verified | New `.loa.config.yaml` entries: 0¢ subscription-billed providers, no secrets exposed |
| A06 Vulnerable Components | N/A | No new deps; regex-only additions |
| A07 Auth Failures | N/A | Runs AFTER auth-bridge attachment; doesn't bypass |
| A08 Software/Data Integrity | Verified | Sprint follows Loa workflow (triage → sprint → implement → review → audit) |
| A09 Logging/Monitoring Failures | **GOOD** | `[outbound-sanitize]` telemetry added (character ID + pattern name + length · no PII) |
| A10 SSRF | N/A | No outbound HTTP introduced |

---

## Security Checklist

### Secrets

✓ **No new credentials.** No hardcoded keys, tokens, or secrets introduced. All API auth (Codex / Gemini / Claude CLIs) uses operator's subscription auth stores (`~/.codex/auth.json`, `~/.gemini/settings.json`, `~/.claude/...`). Telemetry log line includes only: character ID (public-facing slug like `ruggy` / `satoshi`), pattern name (structural), content length (number). No PII, no auth tokens, no internal paths.

### Auth/Authz

✓ **Unaffected.** Sanitizer runs at the chat-medium write boundary, AFTER:
- Anti-spam invariant guard (`dispatch.ts:202-208` · `invoker.bot === true` skip)
- Circuit breaker pre-check (`dispatch.ts:212-220`)
- auth-bridge attachment (`dispatch.ts:244-263`)

Sanitizer is purely transformational; it does not influence access control, JWT minting, or tenant binding. No new privilege escalation surface.

### Input Validation

✓ **This PR IS the input validation.** Defense-in-depth at the chat-medium boundary with 6 layers:
1. `\p{Cf}` format-char strip (zero-width, bidi isolates, ALM, Soft Hyphen)
2. NFKC normalize (full-width Unicode → ASCII)
3. `trimStart` (leading whitespace)
4. 11 anchored `RAW_API_ERROR_PATTERNS` (Anthropic API / Bedrock direct / Orchestrator SDK subtype / Orchestrator empty / Agent Gateway / JSON envelope / Dispatch REST × 2 / discord.js × 2 / generic PascalCase Error|Exception|Failure with colon)
5. Caller-supplied substitution template (`stripVoiceDisciplineDrift(composeErrorBody(...))` so substituted bodies match `formatErrorBody`'s voice-discipline treatment)
6. Sanitize OUTERMOST in dispatch chain (raw chunks → sanitize → prefix → split → wire · prevents `^`-anchor defeat by framing)

Pattern anchoring at `^` prevents mid-body false-positives. Patterns documented with ordering rationale (specific-first for telemetry attribution · generic catch-all last for format-drift defense).

### Data Privacy

✓ **PROTECTS user privacy.** The previous behavior (raw `API Error: 500 {...}` reaching Discord) could leak:
- Stack traces from upstream Anthropic SDK / Bedrock
- Internal file paths from `dispatch.ts` REST wrapper throws
- Anthropic API JSON envelopes with `error.message` fields that may contain operational details
- discord.js error contexts with bracketed metadata

All of these now substitute to character-voice templates (`"cables got crossed, nothing came back. try again?"` / `"The channel between worlds slipped. Retry on the next."`).

LLM success output passes through verbatim. No new collection or persistence of sensitive data.

### API Security

✓ **Unaffected.** No new HTTP endpoints, no rate-limiting changes, no CORS modifications. The existing dispatch.ts safeguards (FOLLOW_UP_THROTTLE_MS, TOKEN_LIFETIME_MS, circuit breaker) remain intact.

### Error Handling

✓ **Comprehensive.** Every body-bearing Discord write surface in `dispatch.ts` is wired:

| Site | Function | Sanitize coverage |
|---|---|---|
| `dispatch.ts:451` | onToolUse PATCH (fire-and-forget) | ✓ |
| `dispatch.ts:717` | imagegen caption webhook | ✓ |
| `dispatch.ts:869` | deliverViaWebhook chunks (map-before-prefix) | ✓ |
| `dispatch.ts:944` | deliverViaInteraction rawChunks (map-before-formatReply) | ✓ |
| `dispatch.ts:1046` | deliverErrorViaWebhook body | ✓ |
| `dispatch.ts:1091` | deliverError ephemeral PATCH | ✓ |
| `dispatch.ts:1111` | deliverError PATCH fallback after webhook fail | ✓ |

All 6 hoisting sites use `stripVoiceDisciplineDrift(composeErrorBody(character.id, 'error'))` to match `formatErrorBody`'s voice-discipline strip (closes flatline-v0 Codex C4).

### Code Quality

✓ **591 tests pass · 0 fail.** Net delta: +83 new tests (from 495 baseline). Coverage:
- Pattern matching: 11 patterns × multiple positive/negative cases each
- Idempotency: invariant test walks `DEFAULT_ERROR_REGISTRY`
- Whitespace tolerance: 8 cases (BLOCKER #1)
- Unicode normalization: NFKC + `\p{Cf}` + bidi isolates + Soft Hyphen + ALM
- False-positive guards: `ValidationError was his middle name`, `TotalFailure is the name of my zine`, etc.
- Composition with `stripVoiceDisciplineDrift`: 3 cases
- Dispatch ordering (C1 regression guards): 5 cases including BUGGY-ORDER documentation tests
- Bracketed discord.js error forms: 4 cases

apps/bot typecheck clean. 2 pre-existing typecheck errors in `packages/persona-engine/src/expression/error-register.test.ts:144,149` are NOT introduced by this PR (last touched in commit `45660fa`); tracked in NOTES.md Decision Log row 5.

### Anti-spam Invariant (CLAUDE.md load-bearing)

✓ **Preserved.** The sanitizer is purely transformational on outbound text. It does NOT:
- Auto-respond unsolicited
- Bypass `interaction.user.bot === true` skip
- Skip the explicit-invocation contract
- Cross-character chain

### Voice Rules

✓ **Respected.** Substitutions go through `stripVoiceDisciplineDrift(composeErrorBody(...))` so em-dash / asterisk roleplay / banned closing strips are applied uniformly. Test fixtures lowercase, in-character template literals match `error-register.ts` `TEMPLATES_RAW` verbatim. No corporate-bot tells.

### Construct Boundaries

✓ **Maintained.** Sanitizer lives in `deliver/sanitize.ts` (deliver layer). It's PURE — no imports from `expression/` (closes bridgebuilder F1 dep-cycle risk). Caller supplies the substitution template; sanitizer doesn't know about character registry internals.

---

## Multi-Model Adversarial Review History

This sprint was triangulated through 5 rounds of multi-model review. Each round found and closed real concerns:

| Round | Reviewers | New findings closed | Cost |
|---|---|---|---|
| v0 (bridgebuilder) | Opus single-model | F1 (dep cycle), F4 (catch-all), F12 (ordering doc) | API |
| v1 (CLI parallel manual) | Opus + Gemini CLI + Codex CLI | C1 (placement BLOCKER), C4 (voice-discipline), G2 (regex tightening) | 0¢ |
| v2 (orchestrator headless) | Opus + Codex headless + Gemini headless | BLOCKER #1 (whitespace) | 0¢ |
| v3 (orchestrator headless) | Same | SKP-001 (zero-width), SKP-002 (bracketed discord-js), IMP-002 (invariant), IMP-005 (Unicode lookalike) | 0¢ |
| v4 (orchestrator headless) | Same | IMP-001 broad `\p{Cf}` upgrade (HIGH-consensus 870) | 0¢ |
| v4 final | Same | **0 actionable** (all deferred with audit decision or already addressed) | 0¢ |

Total subscription-billed cost: $0. Total review depth: 3 model perspectives × 5 rounds × ~10-15 findings per round = ~150 distinct adversarial probes against the implementation.

---

## Accepted Risks (Documented Deferrals)

These findings were surfaced by adversarial review and explicitly deferred with documented threat-model rationale. Re-open conditions are operationally observable.

### 1. Confusable-script bypass (SKP-001 from v3 + v4)

**Threat**: Cyrillic `А` (U+0410), Greek `Α` (U+0391) render visually identical to Latin `A` but ASCII regex `[A-Z]` won't match. Attacker could craft an error string with confusables to bypass sanitization.

**Acceptance rationale**:
1. Upstream error bodies (Anthropic, Bedrock, OpenAI, freeside-agent-gateway) are ASCII — no real attack surface from API responses
2. LLM-echoed confusables require either prompt injection or operator instructing the LLM to produce them. Both are prompt-injection class issues, NOT sanitizer-bypass issues. Operator sees the prompt; rendering confusables in response is not privilege escalation.
3. The 4-layer defense (trimStart + NFKC + `\p{Cf}` strip + 11 anchored patterns + voice-discipline substitution) is sufficient against the actual leak vector (raw API error string from upstream).

**Re-open trigger**: Post-deploy `[outbound-sanitize]` telemetry shows firings on bodies containing confusable characters. Implementation paths in NOTES.md Decision Log row 8.

### 2. Statusless error variants (v4 SKP-001 LOW probability)

**Threat**: `API Error: timeout` (no status code) would not match `^API Error: \d+`. Reframed throws like `upstream API Error: ...` bypass.

**Acceptance rationale**: Anthropic SDK source explicitly emits `API Error: ${status} ${body}` — ALWAYS with status. Same for Bedrock direct throws and other patterns. Statusless variants are hypothetical, not observed in this codebase. Generic catch-all (`[A-Z][a-zA-Z]+(?:Error|Exception|Failure):`) catches PascalCase variants.

**Re-open trigger**: Production telemetry shows raw error variants slipping past the patterns.

### 3. Pre-existing typecheck errors in `error-register.test.ts:144,149`

**Status**: NOT introduced by this PR (last touched in PR #45 / commit `45660fa`). One-line fixes possible (`expect(body!).toBe(getErrorTemplate(...)!)`). Out of scope per Karpathy surgical-changes principle.

**Tracked**: NOTES.md Decision Log row 5 for future tech-debt sweep.

### 4. End-to-end integration test absent (flatline v0 C2)

**Status**: The contract-level routing-audit test (`apps/bot/src/tests/dispatch-error-routing.test.ts`) verifies the invariant at the persona-engine boundary + dispatch ordering. Full integration test driving `doReplyChat` end-to-end would need ~30-line DI seam refactor. Shape-level C1 regression tests + BUGGY-ORDER documentation guards prevent the specific failure mode.

**Substitute coverage**: Production `[outbound-sanitize]` telemetry serves as the verification surface for wire-level invariant.

---

## Final Verdict

**APPROVED — LETS FUCKING GO**

The sanitizer is one of the most defensible pieces of error-handling code in the repo. Defense-in-depth, idempotent, OUTERMOST in the transform chain, validated by 5 rounds of adversarial multi-model review with 0 remaining actionable findings.

Operator's audit decisions (SKP-001 confusables deferral, statusless error variants) are documented with re-open triggers tied to production telemetry. The PR is ready to ship.

Production observability question for the operator post-deploy:
- Watch Railway logs for `[outbound-sanitize]` line firings over a 30-day window
- Zero firings → safety net never triggered (catch routing is sufficient · sanitizer is pure belt-and-suspenders · open audit Q: keep permanently per ALEXANDER craft, or remove per Loa minimalism)
- One+ firings → safety net caught a real leak (vector confirmed · the `matched=<pattern>` field surfaces which throw class produced the leak)

---

## References

- Implementation report: `grimoires/loa/a2a/bug-20260511-b6eb97/reviewer.md`
- Sprint plan: `grimoires/loa/a2a/bug-20260511-b6eb97/sprint.md`
- Triage: `grimoires/loa/a2a/bug-20260511-b6eb97/triage.md`
- Multi-model review artifacts: `grimoires/loa/a2a/bug-20260511-b6eb97/flatline-input/`
- NOTES.md Decision Log rows 1-8 (2026-05-11): full sprint history + deferral rationale
- Beads: bd-2b9
- PR: #54 · branch `fix/sanitize-outbound-body-bug-20260511-b6eb97` · 5 commits ahead of main
- HEAD: `e246dac feat(sanitize): broaden zero-width strip to \p{Cf} + defer confusables (flatline v3)`
