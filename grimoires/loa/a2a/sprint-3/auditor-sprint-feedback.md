# Security Audit: Sprint 3 — Chat-Mode MCP Wiring (Phase D)

**Date:** 2026-05-02
**Auditor:** Paranoid Cypherpunk Auditor Agent
**Sprint:** sprint-3 (cycle-001 / V0.7-A.1 environment substrate)
**Implementation Commit:** 1cc076d
**Verdict:** APPROVED - LETS FUCKING GO

---

## Audit Summary

Sprint 3 expands the chat-mode tool surface from zero (V0.7-A.0) to per-character MCP scope. The trust-boundary changes are:

1. **MCP servers now reachable from chat path** — score-mcp, codex-mcp, rosenzu, emojis, freeside_auth, imagegen (per-character scoped). Previously chat had no tool surface at all.
2. **Per-character isolation enforced at SDK layer** — `buildAllowedTools(servers, character.mcps)` filters at `permissionMode: 'dontAsk'`. The model literally cannot invoke unallowed tools.

The expansion is structurally bounded (whitelist via existing isolation primitive) and SECURITY-NEUTRAL: the tool surfaces themselves were already audited at V0.8.0; chat path now just consumes them. No new auth surfaces, no new credentials, no new external endpoints.

---

## Security Checklist Results

| Category | Status | Evidence |
|----------|--------|----------|
| **Secrets / Credentials** | PASS | No hardcoded credentials in any new/modified file. `CHAT_MODE` is a routing flag, not a credential. Existing keys (ANTHROPIC_API_KEY, MCP_KEY, CODEX_MCP_URL) flow through V0.8.0-audited paths. |
| **Auth / Authorization** | PASS | Per-character MCP scope enforced via `buildAllowedTools` whitelist + SDK `permissionMode: 'dontAsk'`. Ruggy cannot invoke imagegen; satoshi cannot invoke score. Smoke verifies at `apps/bot/scripts/smoke-chat-routing.ts:51-90`. |
| **Input Validation** | PASS | Routing decision (`shouldUseOrchestrator`) reads only `config.CHAT_MODE` (Zod-enum-validated) and `LLM_PROVIDER` resolution. No user-controlled input flows into the routing branch. |
| **Data Privacy / PII** | PASS | Recent message content already truncated at 80 chars by Sprint 2's environment builder (`compose/environment.ts:104`). Sprint 3 doesn't add new PII flows; environment context is built once at the caller and carried through both routing paths identically. |
| **API Security** | PASS | No new external endpoints. The orchestrator path uses `@anthropic-ai/claude-agent-sdk`'s `query()` (already audited at V0.8.0); naive path unchanged. CHAT_MODE flag is opt-in; safe defaults. |
| **Error Handling** | PASS | `runOrchestratorQuery` throws `ANTHROPIC_API_KEY required` when explicit `CHAT_MODE=orchestrator` is set without anthropic — surfaces config errors LOUDLY rather than silently degrading. The `auto` default avoids this surprise via provider check upstream (`compose/reply.ts:163`). |
| **Dependencies / Supply Chain** | PASS | Zero new external deps. All imports are workspace-local (`@freeside-characters/persona-engine` modules) plus existing pinned `@anthropic-ai/claude-agent-sdk`. |
| **Code Quality** | PASS | Workspace `bun run typecheck` clean. Routing logic is 8 lines; minimal surface. |

---

## OWASP Top 10 (2021) Sweep

| Category | Applicable | Finding |
|----------|------------|---------|
| A01: Broken Access Control | No (defense-in-depth strong) | Per-character MCP scope is the access-control mechanism. Whitelist-only via SDK `permissionMode: 'dontAsk'`. Ruggy cannot pivot to satoshi's imagegen even if persona prompt instructed it; SDK layer rejects. |
| A02: Cryptographic Failures | No | No crypto operations |
| A03: Injection | No | No SQL/command/template injection. The user prompt flows into `userMessage` and is processed by the LLM as text; standard prompt-injection threat applies (defense layers documented in Sprint 2 audit). |
| A04: Insecure Design | No | Design surfaces all routing decisions in code; no implicit policy. The CHAT_MODE flag is auditable. |
| A05: Security Misconfiguration | No | Defaults are safe: `auto` mode falls back to naive on non-anthropic providers; explicit `orchestrator` errors LOUDLY when misconfigured. Cannot accidentally enable tooled chat without provider support. |
| A06: Vulnerable Components | No | No new dependencies; supply-chain surface unchanged. |
| A07: Identification & Authentication Failures | No | No auth surface introduced. |
| A08: Software & Data Integrity Failures | No | No deserialization, no untrusted code execution. |
| A09: Security Logging & Monitoring Failures | No | Per-character MCP scope drops are logged once per fire (`orchestrator/index.ts:206-209`) with character-id + dropped-server-list — operator-visible if a typo lands in character.json. |
| A10: Server-Side Request Forgery | No | No outbound HTTP from new code; tool calls go via existing pinned MCP endpoints. |

---

## Specific Adversarial Probes

### Per-Character Scope Bypass

- The whitelist filter at `orchestrator/index.ts:155-157` uses `Array.includes` against `characterMcps`. There's no way for a tool name not in the list to slip through — the model can request anything, but the SDK rejects unallowed tool calls before execution.
- **Tested**: `apps/bot/scripts/smoke-chat-routing.ts:51-90` verifies the canonical fixture (ruggy: 5 MCPs without imagegen; satoshi: 2 MCPs without 4 others). All assertions green.
- **Tested**: declared-but-unregistered names (e.g., character.json says `imagegen` but env-gate disabled) silently drop from allowedTools — operator-visible warning logged (orchestrator/index.ts:206-209).

### CHAT_MODE Tampering

- `CHAT_MODE` is a Zod-enum field on `Config`. Invalid values (e.g., `CHAT_MODE=evil`) fail Zod parsing at `loadConfig` time and prevent boot. No string-injection risk.
- `shouldUseOrchestrator` reads `config.CHAT_MODE` directly with strict equality. No regex, no substring matching.

### Provider Lock-In Implications

- The orchestrator path is anthropic-SDK-only. If an attacker manipulates `LLM_PROVIDER` env to `anthropic` without a valid key, the `auto` mode resolves to `'anthropic'` (via `resolveChatProvider`'s anthropic branch), then `runOrchestratorQuery` throws `'ANTHROPIC_API_KEY required'`. Hard fail — no silent degradation, no credential leak.
- Conversely: forcing `CHAT_MODE=naive` on an anthropic deployment downgrades to V0.7-A.0 single-turn shape. Loss of functionality, not loss of security.

### `routeChatLLM` Argument Validation

- `ChatInvokeArgs` is TypeScript-typed: `character`, `systemPrompt`, `userMessage`, optional `zone`. No untyped data sinks.
- Both branches of the router (`runOrchestratorQuery` and `invokeChat`) consume the same args; no discrepancy.

### Smoke Test Side Effects

- `smoke-chat-routing.ts` uses mock `McpServerConfig` objects (`{} as McpServerConfig`). No real SDK calls, no I/O. Safe to run in CI.

---

## Per-Character Trust Boundary Assessment

- **ruggy chat-mode**: gains access to score-mcp (PUBLIC ZoneDigest data), codex-mcp (public-read codex), emojis MCP (in-process curated emoji set), rosenzu (in-process spatial data), freeside_auth (wallet→handle resolver). The most sensitive of these is `freeside_auth`, which queries `midi_profiles` for identity links. Existing CLAUDE.md rule applies: "Never cite raw 0x… wallets in prose without first calling `mcp__freeside_auth__resolve_wallet`." Sprint 3 doesn't change this rule; persona prompts continue to enforce it.

- **satoshi chat-mode**: gains access to codex-mcp + imagegen-mcp. Imagegen calls AWS Bedrock Stability for image generation — costs incurred per call. CHAT_MODE=auto means satoshi (likely Bedrock-provider chat) FALLS BACK to naive (no tools). So satoshi's chat won't actually invoke imagegen unless the operator explicitly sets `LLM_PROVIDER=anthropic` for satoshi, which would also mean satoshi text generation is on anthropic. This is a deployment-config concern, not a code concern.

No CRITICAL, HIGH, MEDIUM, or LOW findings.

---

## Decision

**APPROVED - LETS FUCKING GO**

Sprint 3's expansion of the chat-mode tool surface is structurally bounded (whitelist enforcement at SDK layer), provider-aware (auto-mode prevents misconfiguration surprises), and audit-trail-preserving (drop warnings logged, CHAT_MODE flag opt-in).

Sprint 3 status → COMPLETED.
Cycle-001 ledger: sprint-3 → completed.
beads bd-9j5 + 6 task beads → labeled `security-approved`.

Sprint 4 (Phase E) is up next: persona prose + E2E validation (live tool invocation per AC-3.1, AC-3.2 + voice-fidelity baseline).

---

*Generated by Paranoid Cypherpunk Auditor Agent · cycle-001 · 2026-05-02*
