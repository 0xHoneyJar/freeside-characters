# Reference fixture · cycle-008 T3.8/T3.9 · two-beat billboard (owsley-lab)

> Rendered from `renderMicro` → `toMicroPayload` against the 2026-05-22 owsley-lab
> case (all-quiet · totalEvents 352 · activeWallets 15 · windowDays 30 · deltaPct 0).
> NOTE: `evals/snapshots/` has no automated assertion harness yet — this is a
> human-readable reference + the byte-snapshot artifact for T3.8/T3.9 AC(f).
> Behavioral assertions live in `packages/persona-engine/src/live/two-beat.test.ts`.

## Beat 1 — the agent (message.content)

```
the lab's quiet today.
i'll keep the lamp on.
```

- lowercase, zero numbers (stats-out-of-voice)
- ships as its own Discord message

## Beat 2 — the billboard (DigestPayload.secondary.content · bold)

```
**🧪 Owsley Lab (Onchain)**
**30d rolling   352**
**wallets warm  15**
```

- each line individually `**bold**` (markdown bold spans no newlines)
- value column aligned with U+2007 FIGURE SPACE (digit-width invariant, not a code block)
- `30d rolling` label = cadence-honesty (FR-38): the window total can never be
  mistaken for "since you last looked"
- ships as a SEPARATE Discord message (the seam: voice ≠ substrate)

## Deferred (honest)

- The fresh **"since last post +N"** hero (the operator's mock) is NOT shown — it
  needs the VoiceMemoryPort wired into the render path (`digest-orchestrator.ts:70`
  stubs it; `compose/voice-memory.ts` writer is orphaned). T3.8 AC(e) graceful-
  degradation: show the labeled rolling figure, never a wrong fresh number. The
  fresh delta lights up when voice-memory is wired (rides with deferred T3.3).
- `change` row appears only when `|deltaPct| ≥ 1` (omitted here: all-quiet, deltaPct 0).
- `state: all quiet` lives in Beat 1 (voice), not the billboard (data ≠ narrative).
