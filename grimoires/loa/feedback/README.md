# Voice-friction listening loop

> Append-only capture of ruggy/satoshi voice frictions surfaced during
> live use. Designed by KEEPER (construct-observer) for post-cycle-003
> continuous-capture without per-incident reporting overhead.

## What goes here

Tiny voice frictions that the team notices in Discord:

- code-fenced factor IDs that should be proper-cased names
- canon-vocabulary slips (e.g. "burn" instead of "return-to-source")
- register-mismatches (corporate tells, lowercase invariant breaks)
- factual hallucinations (invented numbers, factor IDs)
- silence-honesty breaks (claiming data without tool access)

**Not for this file**: feature requests, deploy bugs, infra issues —
those still go to GitHub issues directly.

## How to capture (5 seconds per entry)

1. Copy the ruggy/satoshi response from Discord
2. Open `voice-frictions.jsonl`
3. Append one JSON line (schema below)
4. Tag with friction-class slugs from the taxonomy
5. Save · done

That's it. No PR. No issue. No threading. The synthesis layer
(`/feedback-observe` or `/shape` weekly) does the clustering.

## Schema (5 required fields · everything else freeform)

```json
{
  "ts":            "ISO-8601 UTC",
  "captured_by":   "handle or anon",
  "character":     "ruggy | satoshi",
  "prompt":        "what the user asked",
  "response":      "what the bot said (verbatim)",
  "frictions":     ["taxonomy-class/subclass", "..."],
  "severity":      "low | medium | high",
  "source":        "discord/dev-guild | discord/community | telegram | other",
  "notes":         "optional context · 1-2 lines · why it's friction",
  "status":        "open | persona-doc-edit-pending | composer-fix-pending | resolved",
  "linked_friction": "optional · other friction id this clusters with"
}
```

## Voice-friction taxonomy (KEEPER · 8 classes)

| tag | definition | example | fix-locus |
|---|---|---|---|
| `medium-leak/codefence` | raw substrate ID in backticks where proper-cased name should render | `` `mibera_burner` `` instead of "Mibera Burner" | persona doc + sanitize.ts |
| `medium-leak/format` | discord markdown rendering issue | unescaped underscore italicizing mid-word | sanitize.ts |
| `canon-slip/forbidden-vocab` | uses a chain-word the canon-vocabulary table forbids | "sacrifice", "migration", "burn" instead of canon | canon-vocabulary.ts + persona doc canon section |
| `canon-slip/off-canon-metaphor` | improvises a metaphor not in the codex | "centrifuge" / "cauldron" if not in codex | codex-expansion OR persona doc register-bound rule |
| `register-mismatch` | breaks lowercase invariant · corporate tells · banned emoji | "I apologize for the inconvenience" · 🚀 | persona doc voice rules |
| `factual-error/invented-factor-ids` | hallucinates factor IDs without tool access | "paddle_borrower / liquid_backing activity" with no tool call | composer wiring (S4.T1) + persona doc |
| `factual-error/hallucinated-numbers` | invents stats / counts | "23 mints this week" with no data | composer / orchestrator grounding |
| `parasocial-drift` | over-engagement · model-help-bot tells | "How can I help you today?" | persona doc behavioral rules |
| `silence-honesty-break` | claims data when it doesn't have it · should have said "i don't know" | factor-name prose when no tools fired | persona doc + composer ground-truth rule |

## When does friction become a GitHub issue?

| trigger | action |
|---|---|
| same tag · 1 entry | sits in jsonl, no action |
| same tag · 2 entries · same character | annotate in `grimoires/loa/NOTES.md` decision log · no issue yet |
| same tag · 3+ entries · ≤7 days apart | `/file-gap` to GitHub with the cluster as evidence |
| same tag · 3+ entries · ≥3 characters affected | upgrade to architectural — flag for `/plan`, not `/bug` |

## Convergence cadence

Weekly (or when entries cross threshold) — operator runs:

```bash
/feedback-observe --pack observer --since 7d
```

Or, when a synthesis wrapper ships:

```bash
bun run feedback:synth
```

Emits a clustered report at `grimoires/observer/voice-frictions/report-{date}.md`.

## Seed entries

The first two seed entries from 2026-05-11 (cycle-003 merge day) are
both tagged against the same response — the "did anyone sacrifice a
mibera this week" exchange that surfaced 4 friction classes in one
reply:

1. Code-fenced hallucinated factor IDs (`medium-leak/factor-id-codefence` + `factual-error/invented-factor-ids` + `canon-slip/forbidden-vocab` + `canon-slip/off-canon-metaphor`)
2. Silence-honesty break — claimed substrate visibility without tools (`silence-honesty-break`)

Both closed-via-persona-doc-edit immediately (canon table + "don't
invent factor IDs in chat-mode" rule added to both ruggy + satoshi
persona docs). Structural fix awaits S4.T1 composer wiring.

## Future direction (KEEPER creative addition · proposal)

Voice-friction as ambient event: once S4.T1 ships, captured frictions
of severity `medium`+ could feed back into the rosenzu kansei substrate
as a "deliberation" axis tilt — making the bot internalize its own
slips before the operator fixes them. See `grimoires/loa/context/ambient-events-as-rave.md`
§"creative addition" for full rationale.
