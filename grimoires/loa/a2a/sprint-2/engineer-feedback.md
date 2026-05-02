# Senior Lead Review: Sprint 2 — Environment Context Builder + Rosenzu `read_room` (Phase C)

**Date:** 2026-05-02
**Reviewer:** Senior Tech Lead Reviewer Agent
**Sprint:** sprint-2 (cycle-001 / V0.7-A.1 environment substrate)
**Implementation Commit:** f2f7b87
**Verdict:** All good (with noted concerns)

---

## Overall Assessment

Sprint 2 is the largest sprint in the cycle (8 tasks, +832/-16 lines, 13 files changed) and lands cleanly. Three layers compose: rosenzu's moment-half (3 derivation helpers + 6th tool), environment-context builder (NEW), and persona-loader wiring (`{{ENVIRONMENT}}` placeholder). Per-character `tool_invocation_style` is a discrete L2 metadata field as the metadata-as-integration-contract doctrine requires — the L3 daemon-NFT lift seam stays clean.

The architectural deviation in AC-2.5 (taking `zone` instead of `channelId + config`) is well-reasoned and properly logged to the Decision Log in NOTES.md. The behavioral output is unchanged; the integration contract for the LLM consumer (the `## Environment` block shape) holds.

**Karpathy verification:**
- Think Before Coding: AC-2.5 deviation surfaced explicitly in reviewer.md AND NOTES.md ✓
- Simplicity First: `buildEnvironmentContext` is sync (not Promise<string>) because the inline derivation has no I/O ✓
- Surgical Changes: existing 5 rosenzu tools bytes-untouched (only header comment block updated 5→6) ✓
- Goal-Driven: smoke maps explicitly to spec line 412 fixtures + AC behavior assertions ✓

**AC Verification gate:** all 9 ACs walked verbatim. AC-2.5 marked `✓ Met` with documented signature deviation (decision logged); no `Partial` or `Not met` markers.

---

## Adversarial Analysis

### Concerns Identified

1. **`buildEnvironmentContext` signature change was unilateral** (`packages/persona-engine/src/compose/environment.ts:55-63`)
   The implementer changed the spec-shown `{channelId, config}` shape to `{zone}` without operator consultation. The reasoning is correct (workspace direction prevents persona-engine from importing apps/bot), but spec deviation that ripples through how callers invoke a substrate function is exactly the kind of thing that should ideally surface for operator approval before commit. Mitigated by clear NOTES.md decision log entry (line 36 of NOTES.md as of f2f7b87). Non-blocking — Sprint 3 will be the first caller, no migration cost.

2. **`composeTonalWeight` modifies `feel` string with edge case** (`packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts:644`)
   The output `feel` is `${baseKansei.feel} · room ${temperature}`. If `baseKansei.feel` is empty (theoretical — all current `ZONE_SPATIAL` entries have non-empty `feel`), the output becomes ` · room hot` with a leading separator. Not currently a problem; flag for future tunability.

3. **Smoke-style snapshot is not a real snapshot** (`apps/bot/scripts/smoke-environment.ts:166-172`)
   The snapshot section asserts specific line content (line 1 = `## Environment`, line 2 = identity-line literal). A wording-only change (e.g., reformatting `{name} ({dimension} dimension)` to `{name} · {dimension} dimension`) would pass the smoke but break downstream LLM parsing if the LLM has been calibrated on the current shape. A real `toMatchSnapshot()` test would catch this. Aligns with the deferred bun-test recommendation; not blocking for this sprint.

4. **`tool_invocation_style` has no length validation** (`packages/persona-engine/src/types.ts:134`)
   Field is `string` typed, no max length. An operator could write a 2000-char monologue that blows the environment block's 300-token target. No enforcement at the type or runtime layer. Mitigated in practice by the doctrine ("per-tool one-line max"), but could surface as drift over time. Logged for follow-up; non-blocking for V1.

5. **`read_room` SDK round-trip unverified** (`packages/persona-engine/src/orchestrator/rosenzu/server.ts:170-208`)
   The tool registration is structurally correct (Zod schema + `ok()` envelope), and the helpers it calls are unit-smoked. But end-to-end SDK invocation (the LLM actually calling `mcp__rosenzu__read_room` mid-turn and getting a parseable response) hasn't been exercised. Sprint 3's chat-mode wiring is the natural exercise point. Risk: Zod schema corner cases (e.g., `default(20)` interaction with `optional()`) could produce SDK-side errors that bypass unit smokes. Acknowledged in reviewer.md Known Limitations.

### Assumptions Challenged

- **Assumption**: Sprint 3's bot dispatcher will correctly call `getZoneForChannel(config, channelId)` before invoking `buildEnvironmentContext`, passing the resolved zone.
- **Risk if wrong**: If the dispatcher forgets the resolution step and passes `undefined`, every chat-mode reply gets the "outside the codex-mapped zones" fallback regardless of channel. Silent degradation.
- **Recommendation**: Sprint 3's reviewer.md must explicitly verify the resolution step is in place. A small integration test asserting "given channelId X, environment block contains zone-X identity line" would catch this. Logged as forward-carry concern for Sprint 3.

### Alternatives Not Considered

- **Alternative**: Move `getZoneForChannel` and `getCodexAnchorForZone` from `apps/bot/src/lib/` to `packages/persona-engine/src/score/` (or similar persona-engine location).
- **Tradeoff**: Lets `buildEnvironmentContext` keep the spec-shown `{channelId, config}` signature; both bot and orchestrator can call the reverse map. Cost: retroactive churn on Sprint 1's purely-additive AC, plus an import-path update in `apps/bot/scripts/smoke-zone-map.ts`.
- **Verdict**: Implementer's choice (decoupled signature, no churn) is justified. The "channel-zone-map lives where the integration point is" is a reasonable architectural rule. If Sprint 3 surfaces friction with the resolved-zone-pass pattern, this alternative is still cheap to apply later (move file + update one caller).

---

## Documentation Verification

| Item | Status | Evidence |
|------|--------|----------|
| CHANGELOG entry | Deferred | Workspace version held at 0.8.0; cycle-level CHANGELOG bump deferred to Sprint 3 (the user-visible behavioral change) |
| CLAUDE.md updates | N/A | No new commands/skills; persona invocation surface unchanged |
| Code comments | PASS | Headers cite spec lines; helper docstrings explain heuristic thresholds; deviation rationale documented at AC-2.5 + NOTES.md |
| Architecture docs | PASS | NOTES.md decision log entry for the signature deviation (entry 7); reviewer.md walks AC verification gate |
| Test coverage | PASS | 41+ assertions across 8 groups; spec line 412 fixtures green; size budget validated |
| Test infrastructure | DEFERRED | Bun test migration noted as cleanup PR opportunity (Known Limitations §1) |

---

## Previous Feedback Status

**From Sprint 1 review** (`grimoires/loa/a2a/sprint-1/engineer-feedback.md`):
- Concern 2 (smoke vs `bun test`) — DEFERRED with explicit acknowledgment in Sprint 2 reviewer.md Known Limitations §1. Rationale: smoke-script consistency over migration churn; future cleanup PR can promote both Sprint 1 and Sprint 2 smokes to `bun test` together.
- Concerns 1, 3, 4, 5 (delegation coupling, ZONE_FLAVOR aliasing, synthetic IDs, Config cast) — N/A for Sprint 2 (Sprint 1-specific).

The bun-test deferral is acceptable. A `bun test` migration PR can be queued for after Sprint 4.

---

## Decision

**Sprint 2 APPROVED** with 5 non-blocking concerns documented for forward-carry.

Most actionable concern: **Sprint 3's reviewer must validate the channel-zone resolution step is in place** in the dispatcher before calling `buildEnvironmentContext`. This is the unverified assumption from AC-2.5's signature deviation; Sprint 3 is where it lands.

Engineer's three questions answered:

1. **AC-2.5 signature deviation** — acceptable. The reasoning (workspace direction prevents persona-engine from importing apps/bot) is correct, and the alternative (moving channel-zone-map to persona-engine) is still cheap to apply later if Sprint 3 surfaces friction.

2. **Ruggy's `tool_invocation_style` dropping imagegen mention** — correct call. Spec example line 245 mentioned imagegen for ruggy, but ruggy's `mcps` array does NOT include imagegen. The character.json is the source of truth for what's available; spec sample was inaccurate. Eileen async review will confirm gumi-correctness on the prose itself.

3. **`bun test` deferral** — proceed. Sprint 3 ships chat-mode behavior change; that's the priority. Migration is a separate, cheap cleanup PR.

---

## Next Steps

1. Proceed to `/audit-sprint sprint-2` (security audit gate).
2. On audit pass → Sprint 3 (Phase D: chat-mode MCP wiring — the MEDIUM-risk sprint, the operator's actual gap).
3. Carry forward the assumption challenge from Adversarial Analysis: Sprint 3 reviewer must verify channel→zone resolution.
4. Eileen async review of ruggy/satoshi `tool_invocation_style` prose (gumi-correctness check); not blocking Sprint 3, but should land before /voice workshop in follow-up cycle.

---

*Generated by Senior Tech Lead Reviewer Agent · cycle-001 · 2026-05-02*
