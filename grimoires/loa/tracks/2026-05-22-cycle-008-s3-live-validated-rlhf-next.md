---
date: 2026-05-22
cycle: cycle-008-persona-substrate
sprint: S3 (global sprint-24) shipped slice + voice · S9 (global sprint-30) = NEXT
mode: SHIP → (next) ARCH/FEEL via RLHF instrument
status: S3 visible+voice slice live-validated · S9 RLHF surface is the priority next build
---

# Track · cycle-008 S3 live-validated · RLHF surface is next

## What shipped this session (4 commits on feat/cycle-008-persona-substrate)

- `d7ca65d` plan — amendment (4 threads → FR-38..43, ledger+beads reconciled)
- `8ea9b46` T3.8 cadence-honest data + T3.9 two-beat billboard
- `224163a` T3.2 LOA_PROMPT_BUILDER flag + T3.3 cron voice → buildPrompt (canonical)
- `3d9002f` fix — scope persona tool-use to chat (canonical voice stops leaking tool calls)

Suite 1099 pass · 0 fail. Both typechecks clean (1 pre-existing `loader.test.ts` error).

## Live validation (railway, prod env)

- Canonical voice is LIVE in prod (`LOA_PROMPT_BUILDER=canonical`), validated on the
  actual prod LLM path (`LLM_PROVIDER=bedrock` · `eu.anthropic.claude-opus-4-7`).
- Real post fired to owsley-lab (THJ · channel 1497617952831176777, verified target):
  - **before** (one muddy message): "the lab is cooling, 352 events drifted through… ·
    🧪 Owsley Lab (Onchain) · 352 events / 30d · 15 active wallets" (voice leaks stats)
  - **after** (two messages, 0.5s apart, both as ruggy via Pattern-B webhook):
    - beat 1: "Liquid Backing humming in Owsley Lab again, quiet weight on the dial."
      (clean voice · ZERO numbers · stats-out-of-voice)
    - beat 2: bold billboard `30d rolling 352 / change -13% / wallets warm 15`
- The real two-message delivery works (`deliverZoneDigest` beatsOf loop · webhook-shell branch).

## The refinement goal (operator, 2026-05-22)

> "this is closer but … the messages need to be smoothened out since they are too raw
> coming from score. Community facing needs to be refined."

The billboard labels are **score internals surfaced raw**: `30d rolling` (jargon),
`change -13%` (no framing · reads alarmist), `wallets warm` (jargony). Community needs
**legible, non-alarmist, refined** presentation. This is the GOAL — NOT to be prescribed
top-down, but ITERATED via the RLHF surface (below). It's the first real refinement target.

## NEXT (priority): build the RLHF surface — S9, standalone

> "I still need my RLHF surface to be able to iterate on this."

S9 is fully scoped (`sprint.md §10b` · T9.1–T9.6 · global sprint-30). The amendment says the
preview surface ships FIRST as the unblocker. **Decouple from S6** (the /tweak dashboard,
unbuilt) — build a standalone instrument now. MVP (FR-40/41/42):

1. **generate-N** (FR-40): for a fixed zone+snapshot, fan out N candidate two-beats —
   N voice generations (canonical path · temp/prompt variance) × billboard format variants.
2. **compare + pick** (FR-41): render the N candidates side-by-side at **Discord fidelity**
   (real bold · ~40-char wrap · webhook avatar) — a self-contained HTML page is the fastest
   fidelity surface (no S6 dependency); terminal summary alongside.
3. **annotate + persist** (FR-41/42): operator picks a winner + writes why → append to
   `preference-log.jsonl` (schema `rlhf-preference-v0`, already seeded). Promote winner to
   `evals/snapshots/` (the backpressure · regression substrate).
4. **RLHF spine** (FR-42 · cycle-009): the accumulated picks calibrate an LLM-as-judge.

Reuse — do NOT re-implement: `buildPrompt` (canonical voice) + `plainToPayload`/
`buildSubstrateFacts` (the two-beat render · one render fn, two callers per T9.1 AC-b).

## Open shape decision (for the build)

CLI + Discord-fidelity HTML (fastest · no S6 dep · recommended) vs full dashboard (S6-based ·
richer · slower) vs terminal-only (fastest · no fidelity). Operator to steer.

## Housekeeping / follow-ups (small)

- `describeLlmMode` (apps/bot/src/index.ts:388) has no Bedrock branch → banner says
  `UNCONFIGURED` in prod though Bedrock works. 3-line cosmetic fix.
- reaction-bar attach fails under `railway run` (token context) — local-only artifact, not prod.
- The armed natural-cron watch (ScheduleWakeup) — disposition pending operator (manual fire
  satisfied "see it live"; the scheduler path itself still unexercised, owsley ~days out).
