---
title: cycle-020 sprint-1 deferred tasks — T2/T8 clearance (operator-owned)
status: candidate
mode: pre-planning
created: 2026-05-13
source_session: pr-review · score-mibera#109 cycle-021 proposal reply
expiry: when T2 + T8 land on score-mibera OR cycle-020 sprint-2 ships without them OR operator revokes
use_label: usable
boundaries:
  - does not commit to a sprint scope on freeside-characters side
  - work lives on score-mibera repo, not here — this file is a tracking pointer
  - sequencing dependency for score-mibera cycle-021 kickoff (committed in PR #109 reply)
related-cycles:
  - score-mibera cycle-020 sprint-1 (in flight, operator-blocked tasks)
  - score-mibera cycle-021 (proposal stage, blocked on this clearance)
---

# track · cycle-020 sprint-1 T2/T8 clearance

## frame

PR #109 reply (2026-05-13) committed to clearing two operator-owned tasks
on score-mibera before zerker kicks off cycle-021:

- **S1.T2** — hand-classification of 200 category_keys
- **S1.T8** — staging apply

Both block cycle-020 sprint-2 patterns (`feature-flag.ts` + `tools-list-contract.test.ts`)
that cycle-021 wants to inherit. Sequencing answer "B" in the PR reply
makes this clearance the actual gate, not the calendar 1.5-day estimate.

## scope

- read score-mibera sprint-1 doc to refresh on T2 + T8 actual requirements
- complete T2 (200-key hand-classification)
- complete T8 (staging apply)
- signal completion in score-mibera repo (issue / comment / sprint marker)

## not in scope (yet)

- cycle-021 implementation on score-mibera side (zerker's work after this clears)
- freeside-characters follow-up PR (waits for cycle-021 flag flip)
- T2 methodology refinement (this is the v1 pass, not the optimized one)

## open questions for soju

- where do the 200 category_keys live? (score-mibera grimoires? google sheet? a generated artifact?)
- does T8 (staging apply) require ops access I don't have, or just the classification output?
- is there a deadline pressure from zerker, or is this self-paced?

## activation receipts

- `vault/wiki/concepts/score-vs-identity-boundary.md` — usable for this cycle, boundaries: frames cycle-021 pushback only
