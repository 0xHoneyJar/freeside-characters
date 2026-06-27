# Eileen Daily Implementation Agent Mode Agent

This file is the repo-local runbook for the daily GPT-5.5 Thinking implementation agent. The daily agent prompt must explicitly read this file before editing this repo. This file is intentionally separate from `AGENTS.md`; it is a workflow contract for converting Daily Deep Research Report issues into additive implementation PRs.

## Repository responsibility

`0xHoneyJar/freeside-characters` owns character/persona/Discord civic-layer work: persona-engine substrate, character apps, register locks, event/digest/chat surfaces, MCP-fed character delivery, participation-agent UX, and anti-spam invariants.

This repo is not the place for Freeside product billing/access control, Straylight estate semantics, Dixie BFF routes, Hounfour schema packages, Finn experiment verdicts, Aleph research-précis doctrine, or Arcturus revenue-oracle logic.

## Eligible input

Only implement from a Daily Deep Research Report issue or follow-up plan-audit issue/comment that contains:

- `PROPOSED_NEXT_LANE_SEED`
- candidate ID
- repo-fit reasoning
- acceptance criteria
- rollback path
- `VERDICT: ACCEPT_PLAN`

If the candidate lacks `VERDICT: ACCEPT_PLAN`, the agent may perform in-run plan audit only for docs, fixtures, tests, or checkers. Runtime/public-UX behavior requires explicit external acceptance.

## Selection rule

Pick at most one candidate per run. Prefer work that strengthens traceability, persona boundaries, anti-spam behavior, or safe delivery without changing public character behavior.

Priority order:

1. docs-only civic/persona guidance
2. fixture-only event/digest/chat examples
3. test-only anti-spam or rendering coverage
4. checker/validator-only additions
5. default-off provenance or delivery adapters

## Additive-only policy

Nothing currently working may stop functioning.

Allowed by default:

- new docs
- new examples/fixtures
- new tests
- new validation/checker scripts
- default-off tracing/provenance envelopes
- public-safe rendering checks

Forbidden without explicit Eileen approval:

- deleting files
- changing default character voice
- changing public Discord behavior
- adding ambient auto-replies
- changing anti-spam invariants
- broad refactors
- unrelated dependency upgrades
- secrets or real env changes
- sibling repo mutation
- deployment changes
- auto-merge
- closing source issues

## Freeside Characters-specific stop conditions

Stop and return `VERDICT: NEEDS_HUMAN` if the candidate would:

- allow channel presence alone to trigger replies
- make bot/webhook author messages trigger character responses
- change scheduled digest from voiceless to voiced by default
- alter public-facing character persona without explicit approval
- leak private provenance or tool context into public Discord output

## Implementation steps

1. Read this file, README/package scripts, and relevant docs near the target surface.
2. Inspect the source issue and confirm `VERDICT: ACCEPT_PLAN`.
3. Check for obvious duplicate open issues/PRs.
4. Write a short plan: selected candidate, implementation class, allowed files, forbidden surfaces, checks, rollback.
5. Create a branch named `daily-impl/YYYY-MM-DD-freeside-characters-<candidate>`.
6. Implement exactly one candidate with a minimal diff.
7. Run relevant checks from the repo.
8. Open a draft PR.
9. Add `CODEX AUDIT REQUEST` to the PR body.
10. Comment: `@codex review for additive-only scope violations, accidental public Discord behavior changes, anti-spam invariant regressions, failing or missing tests, rollback clarity, repo-boundary violations, and security/privacy regressions`.
11. Do not merge and do not close the source issue.

## PR body requirements

The PR must include:

- source issue
- candidate ID
- implementation class
- what changed
- what did not change
- checks run
- skipped or failing checks
- rollback path
- Codex audit request

## Final run report

Report the selected repo, source issue, branch, PR URL, files changed, checks run, Codex review status, blockers, and whether any boundary was approached.
