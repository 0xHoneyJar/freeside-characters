---
proposal: qa-real-interaction-construct
status: draft
date: 2026-05-02
author: operator + claude-opus (session 08)
companion_spec: ../specs/build-compose-unification-v07a2.md
related_pr: 8 (feat/chat-tool-streaming · combined-with-V0.7-A.2)
---

# QA Real-Interaction Construct (proposal · working name: WITNESS)

> **One-line**: a construct that takes shipped work + generates operator-facing real-interaction QA scenarios — the things to actually go DO in the deployed environment to validate a cycle. Distinct from internal review/audit gates; this is the bridge between "merged" and "actually true in the world."

---

## The gap this fills

The cycle-001 (V0.7-A.1 environment substrate) close revealed it directly:

- `/audit-sprint` runs INTERNAL security review (paranoid cypherpunk reading the diff)
- `/review-sprint` runs INTERNAL adversarial review (senior lead vs implementer)
- `/bridgebuilder-review` runs CROSS-MODEL adversarial review (multi-model dissent on the PR)

All three are **diff-bound**. None of them tell the operator: "go open Discord and try `/ruggy zone digest?` — here's what to look for, here's how to capture it, here's what to do if it fails."

V0.7-A.1 cycle close had 5 explicit operator-bounded items:
1. Eileen async review of persona prose
2. Bonfire-sync canonical persona docs
3. Dev-guild deployment for live tool-invocation
4. Ratify CHAT_MODE=auto default
5. /voice workshop scheduling

These are "real-interaction surfaces to try out" — they require human + deployed environment + side-effect checks. The dev-guild QA test that surfaced the v0.9.1 bug (ruggy emitting tool-call JSON as text) was operator-improvised — no construct guided the test, no checklist generated, no expected-vs-actual triage path. The bug was caught BUT the discovery was ad-hoc.

**WITNESS** (working name) generates that checklist mechanically from the shipped work.

---

## Construct shape

### Identity (persona — placeholder)

Working name: **WITNESS**. The figure who picks up the work fresh, tries the unusual paths, captures observations (not hypotheses), and hands findings back as actionable.

Other persona candidates (operator picks):
- **TIRESIAS** — seer who walks between built-and-deployed, sees what others miss
- **PYRRHO** — skeptic; questions every claim, captures only what's observed
- **CASSANDRA** — truth-teller who surfaces findings before they cascade

The persona register is:
- **Action-oriented**: each scenario = a real thing to do, not a thought experiment
- **Sceptical of claims**: "the auditor said X is fine — but did anyone actually test X with real keys?"
- **Capture-first**: observations + screenshots > opinions
- **Triage-aware**: each scenario has a "what to do if it fails" branch

NOT an analyst. NOT a planner. A field tester with an opinion.

### Inputs

```yaml
qa_real_interaction_construct:
  inputs:
    - cycle_artifacts:
        sprint_plan: grimoires/loa/sprint.md
        cycle_completed_files: grimoires/loa/a2a/sprint-*/COMPLETED
        notes_decision_log: grimoires/loa/NOTES.md
        deferred_acs: collected from sprint.md `⏸ DEFERRED` markers + reviewer.md operator-bounded notes
    - pr_diff: gh pr diff <number>
    - bridgebuilder_findings: from PR comment + grimoires/loa/a2a/{sprint}/adversarial-review.json (if present)
    - deployment_context:
        env: dev | prod (operator selects)
        target_chars: ruggy, satoshi (or specific subset)
        target_zones: stonehenge, bear-cave, el-dorado, owsley-lab (or subset)
        env_vars: declared but not validated (operator confirms which are set)
```

### Outputs

A markdown checklist at `grimoires/loa/qa/qa-cycle-{name}-{date}.md`:

```markdown
# QA Real-Interaction Checklist · cycle-N · {date}

## Surfaces to try ({M} scenarios)

### 🪩 Surface 1 — `/ruggy prompt:"zone digest stonehenge"`

**What to look for**:
- 🟢 Ruggy posts in lowercase (no Title Case section headers)
- 🟢 Reply grounds in stonehenge identity (not generic)
- 🟢 Trajectory log shows `mcp__score__get_zone_digest` invocation
- 🟢 Progressive Discord PATCH shows `📊 pulling zone digest…` during round-trip (post PR #8)
- 🟢 Final message contains real digest data (event count, miberas, factor moves)

**Capture**:
- Screenshot the Discord message
- Save trajectory log: `grimoires/loa/qa/captures/cycle-N-surface-1-trajectory.jsonl`

**If it fails**:
- ❌ Tool-call JSON leaks in message → check PR #8 streaming refactor merged + deployed
- ❌ Generic non-grounded reply → env block missing in system prompt; check `getZoneForChannel` resolution at dispatch.ts:243
- ❌ "Cables got crossed" / in-character error → check ANTHROPIC_API_KEY + MCP_KEY env vars; CHAT_MODE resolution

**Goal contribution**: G-1 (zone identity), G-2 (chat MCP scope), G-3 (rosenzu place+moment)

---

### 🐝 Surface 2 — `/satoshi prompt:"who is the grail of crossings?"`

(... same shape ...)

---

## Coordination scenarios

### 🤝 Eileen async review handoff

(Steps to share the PR + persona diff with Eileen, what to ask, how to log her sign-off in NOTES.md)

### 🎨 Gumi blind-judge strip-the-name

(Steps to generate 3 dry-run digests + 3 chats per character, package for gumi's review, capture verdict)

---

## Triage matrix

If `🟢 expected behavior` but capture shows `❌ unexpected`:

| symptom | likely cause | next step |
|---|---|---|
| Tool-call JSON leaks | streaming refactor not deployed OR LLM faking calls | check `tool_uses[]` count in trajectory; if 0, persona-prompt fake (separate fix) |
| Voice register drifts | per-fragment tuning regressed | revert + iterate via /voice workshop |
| Tool fires but no data in reply | SDK round-trip incomplete | check maxTurns + 14m30s timeout; trajectory will show error subtype |
```

### Skills (operations the construct performs)

```yaml
skills:
  - generate-checklist:
      reads: cycle artifacts + PR diff + bridgebuilder findings
      writes: grimoires/loa/qa/qa-cycle-{name}-{date}.md
      personality: WITNESS register (action-first, lowercase, scoped)

  - propose-triage:
      reads: bridgebuilder findings + sprint reviewer.md + audit feedback
      writes: triage matrix sub-section
      pattern: each MEDIUM+ finding gets a "if you observe this, do that" entry

  - capture-template:
      reads: scenario list
      writes: grimoires/loa/qa/captures/.gitkeep + naming convention
      provides: standard names so capture artifacts are findable later
```

### Composition with existing constructs

| Other construct | Relation |
|---|---|
| **observer / KEEPER** | Closest sibling. KEEPER watches what users do at runtime; WITNESS generates the structured surfaces TO try. KEEPER's findings inform WITNESS's next-cycle scenarios. |
| **artisan / ALEXANDER** | Craft lens. WITNESS scenarios surface artisan-relevant observations (visual feel, register drift, polish gaps). ALEXANDER reads WITNESS captures and ratifies "is this acceptable?" |
| **bridgebuilder-review** | Adjacent. Bridgebuilder reviews the DIFF; WITNESS reviews the DEPLOYED. Findings can pair (bridgebuilder F5 "live ACs deferred" → WITNESS scenario "go run them"). |
| **/audit-sprint, /review-sprint** | Diff-bound. WITNESS extends past the diff into runtime. |
| **smol-comms-register** | Output shape. WITNESS checklists are operator-facing → use /smol register: visual-first, ≤10 lines per scenario, lowercase casual, emoji-as-handles. |

---

## Invocation pattern

```bash
# After cycle close (post-merge), generate the QA checklist:
/witness qa-cycle --pr 8 --cycle V0.7-A.1+A.2

# Or post-PR-creation but pre-merge (for combined-PR validation):
/witness qa-pr 8 --env dev --chars ruggy,satoshi
```

The construct produces the checklist; the OPERATOR runs the scenarios. Captures land in `grimoires/loa/qa/captures/`. Findings can become bug-triage inputs for the next cycle.

---

## V1 implementation surface

For V0.7-A.2 ship: hand-rolled. The QA checklist is generated by claude-opus following this proposal as a prompt template. No skill/script automation yet — the construct is a CONVENTION + a doc-generation pattern.

For V0.7-A.3+: promote to a real Loa skill at `.claude/skills/witness/` with:
- `SKILL.md` carrying the WITNESS persona + invocation rules
- `entry.sh` invoking claude-agent-sdk with PR diff + cycle artifacts as context
- Output template at `resources/templates/qa-checklist.md`

V1 lift is small (~2h); the value is in the CONVENTION more than the automation. Like /smol, the discipline matters more than the script.

---

## Open questions for operator

1. **Persona name**: WITNESS, TIRESIAS, PYRRHO, CASSANDRA, or different? The persona governs voice on the generated checklist (which the operator + collaborators read).

2. **Capture surface**: where do screenshots/logs land? Proposal: `grimoires/loa/qa/captures/{cycle}/{surface-N}-{kind}.{ext}`. Confirm or redirect.

3. **Eileen + gumi integration**: should WITNESS scenarios include explicit "share with Eileen" / "share with gumi" steps? If yes, the construct needs to know about cross-collaborator workflows.

4. **Frequency**: end-of-cycle only? Or also pre-merge (PR validation)? Or both? Affects when the construct fires.

5. **Composability with /run sprint-plan**: should `/run sprint-plan` end with a `/witness` invocation as the cycle exit gate (after `/bridgebuilder-review`)? Or stay a manual call?

---

## Why this matters now

V0.7-A.1 cycle revealed a structural gap: cycles ship "structurally complete" with operator-bounded behavioral validation. Without a construct, the validation is improvised. The v0.9.1 bug was caught by improvised dev-guild QA — but the QA itself was a one-off, not reusable, and the next cycle would re-improvise.

WITNESS makes the operator-bounded surface a first-class artifact. Each cycle ends with a checklist; each captured observation becomes provenance. The triage paths are pre-mapped, so when a scenario fails the operator already has a "next step" without re-deriving from the PR.

This is the bridge from cycle-close to confident ship.

---

## Combine-with-V0.7-A.2 (operator request)

Per session 08 reframe: V0.7-A.2 (compose unification) and PR #8 (streaming UX) are combined into one PR for one QA pass. WITNESS generates the QA checklist for that combined PR.

The first WITNESS-generated checklist is the dogfood: does the construct produce useful operator-facing surfaces for V0.7-A.2's actual ship?

If the answer is yes → promote WITNESS to a real Loa skill in V0.7-A.3.
If the answer is no → iterate on the proposal before automation.
