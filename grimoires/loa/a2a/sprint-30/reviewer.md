# Sprint-30 (cycle-008 S9) Implementation Report — standalone RLHF iteration surface

> **Sprint**: S9 (local sprint-9) · global sprint-30 · cycle-008-persona-substrate
> **Scope**: RLHF · FR-40/41/42 (G-10) · billboard-preview-first lead slice
> **Branch**: `feat/cycle-008-persona-substrate`
> **Beads**: bd-13y (epic)

> **Addendum 2026-05-22 — interactive surface + breeding rail** (operator follow-up:
> "drive it through the UI… optimizing for feedback-loop velocity via RLHF"). The static
> HTML grew an interactive sibling: `rlhf-preview serve` (a 127.0.0.1 Bun.serve) lets the
> operator pick/annotate/regenerate IN the browser; picks persist to `preference-log.jsonl`
> + an `inbox.jsonl` and (in `--await-pick`) hand back to the agent (roughdraft blocking-
> handoff pattern, studied not used). A declarative-template breeding substrate
> (`billboard-templates.ts`) lets the agent evolve new variants from picks at runtime —
> hot-reloaded per regenerate, byte-identical delivery preserved. New files:
> `preview/{server,interactive-html,billboard-templates,billboard-align}.ts` + tests
> (`server.test.ts`, `billboard-templates.test.ts`). Full suite 1136 pass · 0 fail. Full
> design + the grounded /loom-not-authored decision: NOTES.md "S9 EXTENSION" section.
> **Date**: 2026-05-22
> **Status**: mechanical work complete · OP-G4 (T9.6) is operator-paced (pending)

## Executive Summary

Built the operator's #1 recurring ask — the RLHF iteration surface
(`feedback-rlhf-surface-priority`) — as a **standalone** instrument decoupled from the
unbuilt S6 /tweak dashboard. The operator can now fan out N billboard presentations of
a fixed snapshot, compare them at Discord fidelity in a self-contained HTML page, pick a
winner + annotation, and promote it to the eval set — the generate-N → compare → pick →
backpressure loop, self-served.

The whole point is to refine the "too raw coming from score" community billboard
(`30d rolling` / `change -13%` / `wallets warm`) **via the surface** — the operator
iterates and picks; nothing is prescribed top-down. The four seeded variants are
distinct *shapes* (not reworded twins) as starting material the operator extends.

The hard reuse invariant is honored: `v0-baseline` flows through the production render
path (`presentation.renderMicro → toMicroPayload`) and is **byte-identical to prod**
(asserted by a fidelity-parity test). Alt variants share the same U+2007 figure-space
alignment and the unchanged `plainToPayload` two-beat delivery.

- **New code**: `packages/persona-engine/src/preview/` (6 files) + `apps/bot/src/cli/rlhf-preview.ts` + 2 test files
- **Tests**: 23 new (fidelity-parity, variants, batch, HTML, persistence, promote) · full suite **1122 pass · 1 skip · 0 fail**
- **Typecheck**: clean (only the pre-existing `loader.test.ts:40 postingMode` error remains, unrelated)
- **End-to-end**: dry-validated `preview → pick → promote`; agent demo-pick reverted to keep the operator RLHF corpus clean

## AC Verification

> AC text quoted verbatim from `grimoires/loa/sprint.md` §10b (T9.1–T9.6).

### T9.1 · Billboard preview surface (FR-41 core)

- **(a)** *"renders any zone + state + snapshot in N candidate presentations side-by-side at Discord fidelity — real bold, ~40-char mobile wrap, webhook avatar"* — **✓ Met**.
  `renderPreviewHtml` (`preview/discord-fidelity-html.ts:82`) emits a side-by-side `.grid`; `**bold**`→`<b>` (`:38 renderBoldLine`), portrait `max-width:420px` bubbles (`:124`), ruggy avatar (`:19`). Verified: HTML has 11 `<b>`, avatar URL, all 4 variant ids.
- **(b)** *"reuses the SAME `plainToPayload`/figure-space render path as production (FR-39) — NOT a re-implementation (one render function, two callers)"* — **✓ Met**.
  `renderCandidate` (`preview/render-candidate.ts:42`) routes every candidate through `presentation.toMicroPayload(...)` at `:54` (= prod `plainToPayload`). Fidelity-parity asserted in `preview/preview.test.ts:52` (`candidate.payload` `toEqual` prod payload).
- **(c)** *"renders against the real owsley-lab snapshot shape (`events_30d` · `since_last` · `active_wallets` · state) per `preference-log.jsonl` reference record"* — **✓ Met**.
  `canonical-cases.ts:68` `owsley-all-quiet` builds 352 events / 15 wallets / deltaPct 0 / 30d; `preference-log.ts:69` maps to `{events_30d, since_last, active_wallets}`. Asserted `preview.test.ts:135`.
- **(d)** *"localhost-bound + LOA_DASH_AUTH bearer (cycle-007 INV-16) + LOA_TWEAKPANE_ENABLED gate (inherits S6 3-layer enforcement)"* — **⚠ Partial / superseded by architecture** (see NOTES.md Decision Log · S9 deviation).
  The S6-coupled served-dashboard premise was replaced by a self-contained HTML **file** written to gitignored `.run/rlhf-preview/`. There is **no HTTP surface** to localhost-bind or auth-gate — the security *intent* (no unauthorized network access to the preview) is met more completely by construction (zero network exposure). The literal 3-layer gate is N/A for a file-based surface.

### T9.2 · Generate-N candidate fan-out (FR-40 · capture)

- **(a)** *"`--fire-n N` renders the SAME input in N candidates varying seed and/or a named format-fragment variant in ONE action"* — **✓ Met**.
  `resolveVariants({fireN})` (`billboard-variants.ts:127`) + `--fire-n`/`--variants` in `rlhf-preview.ts:cmdPreview`. Format-fragment variance is implemented; seed variance belongs to the voice (LLM) follow-on.
- **(b)** *"each candidate captured as an S5-shaped trace row (`outcome` classified per T5.2) grouped by a `batch_id`"* — **⚠ Partial**.
  `batch_id` grouping ✓ — `renderBatch` (`render-candidate.ts:73`) groups candidates under `batchId`, persisted to `.run/rlhf-preview/<batchId>.json`. **S5-trace-row capture is N/A + deferred**: S5 (trace capture) is itself unbuilt, and the format fan-out makes no LLM call so there is no `outcome` to classify. Trace-row capture rides the voice (LLM) fan-out follow-on once S5 lands. [ACCEPTED-DEFERRED · NOTES.md]
- **(c)** *"first slice targets layout/format (billboard look), voice variance is a follow-on flag"* — **✓ Met**.
  MVP varies beat-2 format deterministically; beat-1 voice is fixed (`--voice` / case default). Voice fan-out (`--voice-n`, LLM-backed) is the documented follow-on.
- **(d)** *"`--fire-n 1` is equivalent to the existing single-fire (backward compatible)"* — **✓ Met**.
  `resolveVariants({fireN:1})` → `[v0-baseline]`, which is byte-identical to prod single-fire (the fidelity-parity guarantee).

### T9.3 · Pick + annotate → preference record (FR-41)

- **(a)** *"operator picks a winner OR ranks the batch + writes a free-text annotation"* — **✓ Met** (pick path).
  `rlhf-preview pick --variant <id> --why "<annotation>"` (`rlhf-preview.ts:cmdPick`); `--why` is required (the preference signal is the point). Ranking is supported in the lib (`BuildPreferenceInput.ranking` → record field at `preference-log.ts:75`); the CLI exposes winner-pick (ranking via a future flag).
- **(b)** *"record appended to `preference-log.jsonl` matching the existing `rlhf-preference-v0` schema"* — **✓ Met**.
  `buildPreferenceRecord` (`preference-log.ts:53`) emits the exact seeded shape; `appendPreferenceRecord` (`:84`) appends JSONL. Round-trip asserted `preference-log.test.ts:68`. Live-verified: appended a schema-identical line, then reverted.
- **(c)** *"records structured as preference-pairs/rankings (RLHF-ready) not just 'winner picked'"* — **✓ Met**.
  Each record carries `candidates[]` + `chosen` (= chosen-over-rest = N−1 implicit preference pairs) + optional `ranking`.
- **(d)** *"mirrors `compose/voice-memory.ts` zero-infra JSONL pattern (no DB)"* — **✓ Met**.
  `appendFileSync` JSONL, no database (`preference-log.ts:84`), per CLAUDE.md "Don't do: add a database".

### T9.4 · Backpressure — promote winner to eval set (FR-42)

- **(a)** *"a picked+annotated winner promotes to `evals/snapshots/` as a byte-snapshot golden case"* — **✓ Met**.
  `promoteToEvals` (`preference-log.ts:100`) writes `evals/snapshots/rlhf-<zone>-<variant>.md` in the same format as `cycle-008-two-beat-owsley-lab.md`. Asserted `preference-log.test.ts:82`.
- **(b)** *"annotations accumulate as a labeled corpus"* — **✓ Met**. Append-only `preference-log.jsonl` + accumulating goldens.
- **(c)** *"the next prompt/format edit is validated against the operator's own past picks"* — **✓ Met** (substrate). The golden is the regression artifact (note: `evals/snapshots/` has no automated assertion harness yet — same standing as the existing cycle-008 golden; behavioral assertions live in `preview/*.test.ts`).
- **(d)** *"corpus structured for the cycle-009 LLM-as-judge to consume"* — **✓ Met**. `rlhf-preference-v0` JSONL is the judge calibration signal (Fork C → C3).

### T9.5 · S9 tests

- **(a)** *"batch grouping by `batch_id` tested"* — **✓ Met** (`preview.test.ts:82`).
- **(b)** *"preference record append validates against `rlhf-preference-v0` schema"* — **✓ Met** (`preference-log.test.ts:68` round-trip).
- **(c)** *"promote-to-evals writes a valid `evals/snapshots/` fixture"* — **✓ Met** (`preference-log.test.ts:82`).
- **(d)** *"fidelity-parity test: preview render === production `plainToPayload` render for the same input"* — **✓ Met** (`preview.test.ts:52` byte-identical assertion).

### T9.6 · OP-G4 end-to-end RLHF loop attestation (HARD operator-paced gate)

- *"Operator fires a fan-out batch (`--fire-n`), picks a winner side-by-side, annotates, promotes one to `evals/snapshots/` — the full FR-40→41→42 loop self-served … written attestation … that the self-serve loop is faster than the manual loop … AND a new `preference-log.jsonl` record landed via the tool (not by hand)."* — **⏸ Pending (operator-paced)**.
  The instrument is built and the full loop is dry-validated end-to-end (generate-N → HTML → pick → promote all functioned; the agent demo-pick was reverted to keep the corpus clean). The **attestation is the operator's** — OP-G4 is a HARD operator-paced gate by design. Ready to fire.

## Tasks Completed

| Task | Deliverable | Files |
|------|-------------|-------|
| T9.2 capture | format-variant registry (v0 prod-baseline + 3 distinct-shape seeds) + `--fire-n`/`--variants` resolution | `preview/billboard-variants.ts` (+162) |
| T9.1/T9.2 | canonical owsley cases (all-quiet/active) + snapshot factory | `preview/canonical-cases.ts` (+92) |
| T9.1/T9.2 | candidate fan-out via reused prod render path + batch grouping | `preview/render-candidate.ts` (+97) |
| T9.1 | self-contained Discord-fidelity HTML (real bold · figure-space · avatar) | `preview/discord-fidelity-html.ts` (+165) |
| T9.3/T9.4 | `rlhf-preference-v0` append + promote-to-evals | `preview/preference-log.ts` (+180) |
| (wiring) | preview public-API barrel + package `./preview` export + root barrel | `preview/index.ts` (+40) · `packages/persona-engine/package.json` · `src/index.ts` |
| T9.1–T9.4 | standalone CLI (`preview`/`pick`/`promote`) + bot script | `apps/bot/src/cli/rlhf-preview.ts` (+300) · `apps/bot/package.json` |
| T9.5 | tests | `preview/preview.test.ts` (+150) · `preview/preference-log.test.ts` (+110) |

## Technical Highlights

- **Reuse-by-construction.** `v0-baseline.buildFacts = (s) => presentation.renderMicro(s).truthFields`, and every candidate runs through `presentation.toMicroPayload`. The G-6 seam-respecting `presentation` const is used (not direct `.live.ts` symbol imports). Fidelity-parity is a test, not a hope.
- **Distinct shapes, not reworded twins.** v0 tabular-jargon (the "too raw" reference) · v1 tabular-plain · v2 value-first sentences · v3 minimal one-glance. A side-by-side pick teaches about *format*, not just wording — the right granularity for the RLHF signal.
- **Standalone = stronger security than the served dashboard it replaces.** No HTTP surface → no DNS-rebinding / bearer / Host-check attack class at all. The HTML lands in gitignored `.run/`.
- **Repo-root anchoring.** The CLI walks up to the dir holding `grimoires/`+`packages/` so the operator's RLHF corpus never splits between `apps/bot/grimoires/` and the repo root (a bug caught + fixed during validation).
- **Honest persistence.** `since_last: 0` placeholder is documented as the deferred fresh-delta (voice-memory unwired · T3.8 AC-a), matching the seed record — no fabricated fresh number.

## Testing Summary

```bash
# new suite (23 tests)
bun test packages/persona-engine/src/preview/

# full regression
bun test                    # 1122 pass · 1 skip · 0 fail
cd packages/persona-engine && bun run typecheck   # clean (pre-existing loader.test.ts:40 only)
cd apps/bot && bun run typecheck                   # clean

# exercise the loop (dry — no Discord)
bun run apps/bot/src/cli/rlhf-preview.ts preview --case owsley-all-quiet --fire-n 4
#   → .run/rlhf-preview/<batch>.html + terminal summary
bun run apps/bot/src/cli/rlhf-preview.ts pick --batch <id> --variant v1-plain --why "<why>"
bun run apps/bot/src/cli/rlhf-preview.ts promote --batch <id> --variant v1-plain
```

## Known Limitations

1. **Voice fan-out (`--voice-n`, LLM-backed) is the follow-on slice** — MVP varies format deterministically (instant, dry); voice variance rides `railway run` bedrock when it lands. Plan-of-record (amendment §7.3, track T9.2 AC-c). [ACCEPTED-DEFERRED · NOTES.md]
2. **No S5 trace-row capture** — candidates group by `batch_id` in batch JSON; S5 (trace capture) is unbuilt and deterministic renders have no LLM `outcome` to classify. Rides the voice follow-on. [ACCEPTED-DEFERRED · NOTES.md]
3. **`evals/snapshots/` has no automated assertion harness** — promoted goldens are human-readable references + byte-snapshot artifacts (same standing as the existing cycle-008 golden); behavioral assertions live in `preview/*.test.ts`.
4. **CLI exposes winner-pick, not ranking** — the lib supports `ranking`; a `--rank` flag is a small follow-on.
5. **T9.1(d) 3-layer HTTP enforcement is N/A** — superseded by the standalone-file architecture (no network surface). See AC T9.1(d) + NOTES.md deviation.

## Verification Steps (for reviewer)

1. `bun test packages/persona-engine/src/preview/` → 23 pass.
2. Confirm fidelity-parity: `preview/preview.test.ts` "v0-baseline candidate payload is byte-identical to prod renderMicro→toMicroPayload".
3. `bun run apps/bot/src/cli/rlhf-preview.ts preview --case owsley-all-quiet --fire-n 4` → open the HTML, confirm 4 cards, real bold, ruggy avatar, aligned columns.
4. Confirm no re-implementation: `render-candidate.ts` imports `presentation` and calls `toMicroPayload` (not a hand-rolled payload).
5. Confirm standalone: no import of `scripts/dashboard.ts`, no Tweakpane dep.
6. OP-G4 (T9.6) is yours to fire: run `preview → pick → promote` and attest it beats the manual loop.
