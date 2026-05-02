# Security Audit: Sprint 2 — Environment Context Builder + Rosenzu `read_room` (Phase C)

**Date:** 2026-05-02
**Auditor:** Paranoid Cypherpunk Auditor Agent
**Sprint:** sprint-2 (cycle-001 / V0.7-A.1 environment substrate)
**Implementation Commit:** f2f7b87
**Verdict:** APPROVED - LETS FUCKING GO

---

## Audit Summary

Sprint 2 surface is +832 lines across 13 files. The substantive code surface is three layers: rosenzu derivation helpers (3 pure functions, no I/O), the 6th rosenzu tool registration (Zod-validated inputs, deterministic output), and `compose/environment.ts` (sync pure-function string assembly). No new external dependencies, no I/O sinks, no auth surface, no untrusted data flowing into security-sensitive paths.

The character.json data additions (`tool_invocation_style` field) are operator-authored prose — trusted at the substrate trust boundary.

---

## Security Checklist Results

| Category | Status | Evidence |
|----------|--------|----------|
| **Secrets / Credentials** | PASS | grep across all new/modified files for `api_key\|secret\|password\|0x[a-f0-9]{40}\|sk-\|gh[ps]_\|AKIA` returns 0 matches. Operator prose in `tool_invocation_style` is bounded vocabulary (no credentials) and reviewed for content. |
| **Auth / Authorization** | N/A | No auth surface introduced. All trust boundaries (Discord interaction Ed25519 verification, Config env vars) unchanged from V0.8.0. |
| **Input Validation** | PASS | `read_room` tool inputs Zod-validated at `packages/persona-engine/src/orchestrator/rosenzu/server.ts:172-185`: `zone` is enum, `recent_message_count` is number 0-50, `recent_message_summary` is bounded string, `presence` is string array, `minutes_since_last_post` is number. All optional except zone. `buildEnvironmentContext` inputs are TypeScript-typed (compile-time enforcement). |
| **Data Privacy / PII** | PASS | `recentMessages[].content` truncated at 80 chars per message before injection (`compose/environment.ts:104` via `truncate()` helper), bounding any leaked PII volume. `presence` list captures usernames only — no wallet addresses, no `mibera_id`. Channel zone identity uses public emoji + display name. |
| **API Security** | N/A | No new HTTP endpoints, no outbound network calls. The `read_room` tool runs in-process via `createSdkMcpServer` (existing rosenzu pattern, no IPC boundary). |
| **Error Handling** | PASS | All new functions are pure — no throws from `deriveTemperature` / `deriveSocialDensity` / `composeTonalWeight` / `buildEnvironmentContext` / `summarizeRecent` / `minutesSince` / `uniq`. The `read_room` tool returns `ok({...})` envelope unconditionally; any input-validation failure surfaces as an SDK-side Zod parse error (caller's domain, not ours). |
| **Dependencies / Supply Chain** | PASS | Zero new external deps. Imports only from in-workspace modules: `@anthropic-ai/claude-agent-sdk` (already present, pinned via existing rosenzu), `zod` (already present), local relative imports within `packages/persona-engine/`. |
| **Code Quality** | PASS | Workspace `bun run typecheck` clean. All new code is pure-function or pure-data; no global state, no side effects beyond return values. |

---

## OWASP Top 10 (2021) Sweep

| Category | Applicable | Finding |
|----------|------------|---------|
| A01: Broken Access Control | No | No access-control surface |
| A02: Cryptographic Failures | No | No crypto operations |
| A03: Injection | No | No SQL/command/LDAP injection vectors. The `recent_message.content` field flows into LLM context as TEXT, not as instruction; standard prompt-injection risk applies (see §Prompt Injection Considerations below) but is not a code-injection vulnerability. |
| A04: Insecure Design | No | Design is minimal-surface, pure-function. Layering deviation (zone-pass-in vs channelId-resolve-internally) is documented in NOTES.md and reviewed in adversarial analysis. |
| A05: Security Misconfiguration | No | No config changes; reads existing `Config` from V0.8.0. |
| A06: Vulnerable Components | No | No new dependencies; `@anthropic-ai/claude-agent-sdk` and `zod` already audited at V0.8.0 ship. |
| A07: Identification & Authentication Failures | No | No auth surface |
| A08: Software & Data Integrity Failures | No | No deserialization, no untrusted code execution. JSON parsing of character.json is from operator-authored files (trusted). |
| A09: Security Logging & Monitoring Failures | No | New code has no logging surface in production path. Smoke uses `console.log` for fixture data only (no PII). |
| A10: Server-Side Request Forgery | No | No outbound HTTP, no URL construction |

---

## Prompt Injection Considerations

The `recent_message_summary` field passed to `read_room` and `recent_messages[].content` flowing into `buildEnvironmentContext` originate from end-user Discord messages. They flow into the LLM context as TEXT, with the following defense layers:

1. **Truncation** (`environment.ts:104` and `:138`) — per-message content capped at 80 chars; summary `recent_message_summary` capped at 120 chars. Bounds the volume of any injection attempt that lands in the prompt.
2. **Separation** — recent context lands in the `## Environment` block as `Recent room context: [alice] hi · [bob] hey` — clearly framed as observation, not instruction. The LLM has been calibrated (via persona templates) to read environment as context.
3. **Persona dominance** — the persona template's voice anchors and codex anchors arrive in the system half BEFORE the environment block in template order; persona governs voice regardless of environment content.

This is the standard prompt-injection threat for any LLM-with-context system; Sprint 2 doesn't expand the surface. The truncation + separation pattern matches existing chat-mode handling at `composeReply`.

**No CRITICAL or HIGH findings.** This is documented as a known characteristic of LLM-context architecture, not a Sprint 2-introduced vulnerability.

---

## Specific Adversarial Probes

### Zod Schema Edge Cases

- `recent_message_count: z.number().min(0).max(50).default(20)` — caller-passed values outside [0, 50] surface as Zod parse errors (caller domain). Defaults work as expected (omitting the field defaults to 20). No bypass via type confusion.
- `presence: z.array(z.string()).optional()` — empty array vs undefined both produce `social_density === 'solo'` via `presence?.length ?? 0`. No NPE risk.

### `String.prototype.replace` Special Sequences

- `loader.ts:236, 250, 404` substitutes `environment` content via `.replace(/\{\{ENVIRONMENT\}\}/g, environment)`. If `environment` contained `$&` or `$1`, JS replacement-string semantics would substitute the matched placeholder text (`{{ENVIRONMENT}}`) or empty (no capture group), respectively. Cosmetic issue at most — no security implication. Consistent with existing substitution patterns at `loader.ts:240-247` for voiceAnchors, codexAnchors, codex, etc.; not a Sprint 2 regression.

### Mutation by Reference

- `getCodexAnchorForZone` (Sprint 1) returns `ZONE_FLAVOR[zone]` by reference — flagged in Sprint 1 audit. Same pattern in Sprint 2: `compose/environment.ts:73` reads `ZONE_FLAVOR[args.zone]` directly and uses fields by access (no return). No new mutation surface.

### Recursive Substitution

- The substitution chain in `loader.ts` performs multiple `.replace()` calls in sequence. If the `environment` content contained `{{CODEX_PRELUDE}}` literally, that placeholder is positioned BEFORE `{{ENVIRONMENT}}` in the chain (line 242 vs 244 in digest path) — so by the time `{{ENVIRONMENT}}` is substituted, the codex prelude has already been resolved. The new substitution does NOT trigger re-resolution. Verified by reading the substitution order: `POST_TYPE_GUIDANCE → MOVEMENT → VOICE_ANCHORS → CODEX_ANCHORS → CODEX_PRELUDE → ENVIRONMENT → EXEMPLARS → ZONE_*`. Safe.

### Smoke Test Side Effects

- `smoke-environment.ts` is hermetic — no I/O beyond `console.log` and `process.exit`. Stub `personaPath: '/dev/null/persona.md'` is never read (the smoke doesn't call `loadSystemPrompt`). Safe to run in CI.

---

## Architectural Observations (advisory)

The AC-2.5 signature deviation (taking resolved `zone` instead of `channelId + config`) was reviewed in `engineer-feedback.md` adversarial analysis. From a security perspective: removing direct access to `Config` from `buildEnvironmentContext` REDUCES the attack surface — the function no longer has access to the env-var-loaded credential bag. Defense-in-depth bonus: callers cannot accidentally leak Config fields into the environment block.

This is a SECURITY-POSITIVE deviation, not a security concern.

---

## Decision

**APPROVED - LETS FUCKING GO**

No CRITICAL, HIGH, MEDIUM, or LOW findings. Sprint 2 is cleared for completion.

Sprint 2 status → COMPLETED.
Cycle-001 ledger: sprint-2 → completed.
beads bd-266 + 8 task beads → labeled `security-approved`.

Next: Sprint 3 (Phase D — chat-mode MCP wiring, MEDIUM-risk). Sprint 3's auditor will need to assess the chat-mode tool surface (per-character MCP isolation: ruggy gets score+codex+emojis+rosenzu+freeside_auth; satoshi gets codex+imagegen).

---

*Generated by Paranoid Cypherpunk Auditor Agent · cycle-001 · 2026-05-02*
