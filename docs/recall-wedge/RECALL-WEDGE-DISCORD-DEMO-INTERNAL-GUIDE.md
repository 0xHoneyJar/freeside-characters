# Recall Wedge — Internal Discord Demo Guide

> **Phase 40B** (docs-only / internal operator guide). Companion to
> `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` (Phase 40A
> decision gate, which selected this guide),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` (Phase 39E
> smoke-test acceptance),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` (Phase 39D
> operational runbook — the governing register / enable / invoke /
> disable / remove procedure),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` (Phase 39A
> authority), and
> `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` (Phase 38B
> acceptance of the harness backing the rendered output).
>
> This is a **how-to-demo-safely** guide layered on top of the Phase 39D
> runbook — not a replacement for it. The runbook is the operating
> procedure; this guide is the 5–10 minute demo narration, the expected
> outputs, and the boundaries to hold while a teammate is watching.
>
> It uses **redacted placeholders only**. No real Discord IDs, command
> IDs, app IDs, user IDs, tokens, screenshots, or images appear here, and
> none should be added.

---

## A. Status and scope

Phase 40B is **docs-only / internal operator guide only**.

- Phase 40B **follows Phase 40A's selected ladder** (Phase 40A §E:
  internal demo guide first, then a possible Phase 40C de-registration
  helper if still needed).
- It **does not change `/recall-wedge-demo`.**
- It **does not add or authorize new runtime behavior.**
- It **does not authorize live Dixie-backed Discord recall.**
- It **does not authorize public channel-visible recall.**
- It **does not authorize production rollout.**
- It **does not authorize** Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, public
  renderer expansion, or memory admission.

### A.1 Decision sentence

**Phase 40B provides an internal 5–10 minute demo guide for the
already-smoke-tested `/recall-wedge-demo`; it keeps the command
controlled, guild-scoped, operator-gated, ephemeral, Phase 38A
harness-backed, and non-production.**

This guide is conditional on the boundaries restated in §F (what not to
claim) and §O (next phases). Writing how to demo safely does not expand
what the demo is allowed to do — everything Phase 39A / 39D / 39E / 40A
blocked stays blocked (see §F, §K, §O).

---

## B. Source evidence

This guide is grounded in the following artifacts. **Phase 40B introduces
no new code path and modifies none of these source / test files.**

- `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` — Phase 40A
  decision gate; selected this guide as Phase 40B (its §E).
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the redacted real-guild evidence this guide
  demonstrates live (its §C / §I).
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing register / enable / invoke /
  disable / remove procedure (its §F, §G, §H, §K, §L).
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority that defined the dev-only / guild-only /
  operator-only / ephemeral / harness-backed posture.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A multi-surface harness that backs the
  rendered output.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the Phase
  39B handler. Source of the env gate helpers
  (`shouldEnableRecallWedgeDiscordDemo`,
  `isRecallWedgeDiscordDemoAllowedGuild`,
  `isRecallWedgeDiscordDemoOperator`,
  `shouldRegisterRecallWedgeDiscordDemo`,
  `resolveRecallWedgeDiscordDemoGuildId`), the fixed `case` enum selector
  (`served` / `denied`), the ephemeral-only response builder, the single
  generic refusal string (`recall-wedge-demo is not available here.`),
  the fixed framing header, and the final banned-substring no-leak scan.
  **Not modified by Phase 40B.**
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests; the local evidence behind
  the expected outputs in §J. **Not modified by Phase 40B.**
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global; registers only, does not
  delete). **Not modified by Phase 40B.**
- `apps/bot/scripts/publish-commands.ts` — the publish CLI entry point
  that publishes character commands and then calls
  `registerRecallWedgeDemoCommand`. **Not modified by Phase 40B.**
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `interaction.data?.name === 'recall-wedge-demo'` into the handler
  before character resolution; the handler enforces its own gates.
  **Not modified by Phase 40B.**

---

## C. Audience

This guide is for:

- an **internal Loa / Freeside operator** running the demo;
- a **technical teammate** watching the demo;
- a **demo reviewer** evaluating what was shown.

It is **not**:

- a public user guide;
- a customer-facing product claim;
- an external launch document.

If you are about to show this to anyone outside the internal team, stop —
that is a different decision than the one Phase 40A / 40B made, and it is
not opened here.

---

## D. Demo objective

The demo shows:

- the **same continuity-bearing Recall Wedge fixture can be projected
  into a public Discord frame** through the Phase 38A multi-surface
  harness;
- the **output is ephemeral** (only the invoking operator sees it);
- the **operator gate works** (an allowlisted operator in the configured
  guild gets harness output);
- a **non-operator fails closed** (generic ephemeral refusal, no harness
  output);
- the **denied case refuses safely** (a public-safe refusal frame, not an
  error and not a leak);
- the **`public_discord_simulated` frame output avoids raw / private /
  operator material** (the no-leak scan holds even though the fixture
  input is deliberately contaminated);
- the demo is **harness-backed, not live Dixie-backed**;
- **no memory is admitted or mutated** by the demo.

That is the whole proof surface. What it does **not** prove is in §F and
§N.

---

## E. What to say in one minute

Read this aloud (or paraphrase) at the top of the demo:

> "This is a controlled dev / operator Recall Wedge demo. It is not
> production recall and not live Dixie. It shows that the same continuity
> substrate can be rendered through a public Discord frame without
> exposing private / operator material. The command is guild-scoped,
> operator-gated, ephemeral, and backed by the Phase 38A multi-surface
> harness."

Short bullets you can lean on:

- This is a **fixture-bound dev demo**, not production recall.
- **No live Dixie** is called — the data is a fixed synthetic fixture.
- **No memory is read, written, or admitted.**
- The command only appears in **one configured guild**, and only an
  **allowlisted operator** can get output.
- Every response is **ephemeral** — only the operator sees it.
- The interesting bit is the **boundary**: the fixture is deliberately
  dirty (carries private / operator material), and the public frame still
  renders clean.
- The **served** case shows a public-safe billboard; the **denied** case
  shows a public-safe refusal — both without leaking.
- A **non-operator gets a generic refusal** and never sees harness
  output.

---

## F. What not to claim

Do **not** claim, imply, or let a viewer infer any of the following. If a
question pushes toward one of these, give the safe answer from §N.

- production memory;
- live Dixie recall;
- real user memory;
- a consent system;
- production auth;
- public rollout;
- Telegram support;
- private chat support;
- persistent memory admission;
- "remember this" support;
- public channel-safe launch readiness;
- LLM / character voice behavior;
- generalized agent memory "solved."

The demo proves an **interface / frame boundary and public-safe
rendering** (see §N). It does not prove any of the above.

---

## G. Pre-demo checklist

Run through this before the teammate joins. **No real values appear in
this guide** — fill them in privately, never in shared docs or chat.

- [ ] **Correct guild / server selected** — the one configured guild
      (`<DEV_GUILD>`), an internal / low-risk server.
- [ ] **Command is registered in that guild** — `/recall-wedge-demo`
      shows up in `<DEV_GUILD>`'s slash-command list and **only** there
      (no global registration). See runbook §F for the registration
      procedure.
- [ ] **Operator account is allowlisted** — `<OPERATOR_ACCOUNT>`'s user
      ID is in `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`.
- [ ] **Railway / runtime env has the invocation gates set** (see runbook
      §E.2 / §E.3 for exact semantics):
  - `RECALL_WEDGE_DISCORD_DEMO_ENABLED` — must be the exact string
    `true`;
  - `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` — the configured guild;
  - `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS` — the operator
    allowlist (comma-separated).
- [ ] **No IDs or secrets will be shown** on screen — no app ID, guild
      ID, command ID, user ID, or token visible during the demo.
- [ ] **Screenshots will not be committed** anywhere (and ideally not
      taken at all; if taken, they stay off the repo).
- [ ] **Demo channel choice is low-risk / internal** —
      `<INTERNAL_DEMO_CHANNEL>`, somewhere a stray ephemeral response is
      harmless.
- [ ] **A non-operator account is available** (`<NON_OPERATOR_ACCOUNT>`)
      if you intend to demonstrate fail-closed live (the §H 5:30–7:00
      step is optional).

Placeholders used throughout this guide (never substitute real values in
the doc):

- `<DEV_GUILD>` — the single configured demo guild;
- `<OPERATOR_ACCOUNT>` — an allowlisted operator account;
- `<NON_OPERATOR_ACCOUNT>` — an account not in the operator allowlist;
- `<INTERNAL_DEMO_CHANNEL>` — a low-risk internal channel in `<DEV_GUILD>`.

---

## H. 5–10 minute demo script

A timed script. The optional non-operator step (5:30–7:00) needs a second
account; skip it if you do not have one and say so.

### 0:00–1:00 — framing

- Say what this is and is not (read §E's one-minute narration).
- Land the three words early: **dev-only, ephemeral, harness-backed**.

### 1:00–2:30 — command visibility

- Show `/recall-wedge-demo` appears in `<DEV_GUILD>` (type `/recall` in
  the message box and let Discord autocomplete surface it).
- Note it appears **only** in this guild, not globally.
- **Do not** show or read aloud raw app / guild / command IDs (Discord's
  developer surfaces and any "copy ID" affordances expose snowflakes —
  keep them off screen).

### 2:30–4:00 — served / default invocation

- Run `/recall-wedge-demo` (no option) — default behavior is `served`.
- **Expected:** an **ephemeral** response ("Only you can see this"), the
  fixed dev-only framing, the `public_discord_simulated · served` frame,
  and a compact per-frame outcome summary. See §J for the exact shape.
- Point out: the fixture input is deliberately contaminated, yet none of
  that private / operator material appears in the output.

### 4:00–5:30 — denied / refusal invocation

- Run `/recall-wedge-demo case:denied`.
- **Expected:** an **ephemeral** response, the
  `public_discord_simulated · refused` frame with `status: this frame
  cannot answer publicly`, and the compact per-frame outcome summary with
  public-safe refusal codes. See §J.
- Point out: refusal is **public-safe** — it says it cannot answer
  publicly, it does not leak why in private/operator terms.

### 5:30–7:00 — non-operator fail-closed (optional, if available)

- From `<NON_OPERATOR_ACCOUNT>`, run `/recall-wedge-demo`.
- **Expected:** the single generic ephemeral refusal —
  `recall-wedge-demo is not available here.` — and **no harness output**.
- Point out: the refusal is **identical** regardless of why it failed
  (disabled / wrong guild / non-operator) — it never reveals which gate
  tripped.

### 7:00–8:30 — explain boundaries

- **No live Dixie** — the data is a fixed synthetic fixture, not a live
  recall producer.
- **No memory admission** — nothing is read from or written to memory.
- **No public rollout** — this is one guild, operator-only, ephemeral.
- **No raw / private / operator material** — the no-leak scan runs on the
  final string as defense-in-depth.

### 8:30–10:00 — questions / next phases

- Answer questions using §N's safe answers.
- Next safe ladder: **Phase 40C only if a guild-scoped de-registration
  helper is still needed** (today removal is the manual Phase 39D runbook
  §L procedure).
- **Live Dixie-backed Discord recall** and **public-channel-visible
  recall** each require a **later, separate gate** — neither is opened by
  this demo or this guide.

---

## I. Discord commands to run

Exactly these, no more:

- `/recall-wedge-demo`
- `/recall-wedge-demo case:served`
- `/recall-wedge-demo case:denied`

Notes:

- **Default is equivalent to `served`** — running `/recall-wedge-demo`
  with no option renders the served case.
- Depending on the Discord client UI, the operator may **select the
  finite `case` enum value** (`served` / `denied`) from a choice list
  rather than typing the full text. Both reach the same fixed selector.
- There is **no freeform query** — the command exposes only the finite
  `case` enum. Any unknown value falls back to `served`.
- **Do not type user memory or private context into the command.** There
  is nowhere for it to go (the handler reads only the `case` enum and
  never echoes smuggled option values), but do not invite the confusion
  on screen.

---

## J. Expected outputs — redacted examples only

Expected output **shapes**, reproduced from the handler / harness — not
screenshots. The leading "Only you can see this" is Discord's own
ephemeral marker, shown above the message; it is not part of the rendered
content.

### Served / default

> Only you can see this · (Discord ephemeral marker)

```
recall-wedge-demo · fixture-bound dev demo (not production recall)
gated · operator-only · ephemeral · phase 38a harness output

[public_discord_simulated]
[recall · public_discord_simulated · served]
summary: redacted: 0 · marked: 1

frame outcomes:
- public_discord_simulated: rendered
- public_telegram_simulated: refused · public_telegram_projection_not_implemented
- authorized_private_session_simulated: refused · authorized_private_projection_not_implemented
- private_chat_simulated: unimplemented · private_chat_projection_unimplemented
- character_frame_public: rendered
```

What to point at:

- ephemeral marker concept — "Only you can see this";
- `recall-wedge-demo · fixture-bound dev demo (not production recall)`;
- `gated · operator-only · ephemeral · phase 38a harness output`;
- `[recall · public_discord_simulated · served]`;
- `summary: redacted: 0 · marked: 1`;
- the compact frame outcomes:
  - `public_discord_simulated: rendered`
  - `public_telegram_simulated: refused · public_telegram_projection_not_implemented`
  - `authorized_private_session_simulated: refused · authorized_private_projection_not_implemented`
  - `private_chat_simulated: unimplemented · private_chat_projection_unimplemented`
  - `character_frame_public: rendered`

(The per-frame summary pairs each frame's outcome with its public-safe
refusal code using a middle-dot separator — e.g.
`refused · public_telegram_projection_not_implemented`. The codes are
stable public-safe enum strings, not diagnostics.)

### Denied

> Only you can see this · (Discord ephemeral marker)

```
recall-wedge-demo · fixture-bound dev demo (not production recall)
gated · operator-only · ephemeral · phase 38a harness output

[public_discord_simulated]
[recall · public_discord_simulated · refused]
status: this frame cannot answer publicly

frame outcomes:
- public_discord_simulated: refused · denied_or_forbidden_projection_refused_publicly
- public_telegram_simulated: refused · public_telegram_projection_not_implemented
- authorized_private_session_simulated: refused · authorized_private_projection_not_implemented
- private_chat_simulated: unimplemented · private_chat_projection_unimplemented
- character_frame_public: refused · character_frame_refused_publicly
```

What to point at:

- `[recall · public_discord_simulated · refused]`;
- `status: this frame cannot answer publicly`;
- `public_discord_simulated: refused · denied_or_forbidden_projection_refused_publicly`;
- `character_frame_public: refused · character_frame_refused_publicly`.

### Non-operator refusal

> Only you can see this · (Discord ephemeral marker)

```
recall-wedge-demo is not available here.
```

This is the single, stable, generic refusal. It is identical for the
disabled / wrong-guild / non-operator cases and never reveals which gate
tripped. No harness output accompanies it.

---

## K. Pass / fail criteria

### Pass

- Command is **visible in the configured guild** (`<DEV_GUILD>`) and only
  there.
- **Operator invocation returns ephemeral, harness-backed output.**
- **Served / default output shows `public_discord_simulated · served`.**
- **Denied output shows a public-safe refusal**
  (`public_discord_simulated · refused`,
  `status: this frame cannot answer publicly`).
- **Non-operator gets the generic ephemeral refusal** if tested
  (`recall-wedge-demo is not available here.`).
- **No raw IDs / tokens / private fields / operator diagnostics / raw
  matrix** appear in any output.
- **No live Dixie language** is shown or claimed.
- **No memory admission language** is shown or claimed.
- **No production auth / consent claim** is made.

### Fail

- Command **appears globally** or in the **wrong guild**.
- A **non-operator receives harness output.**
- **Output is public channel-visible** (not ephemeral).
- Output includes **raw IDs / tokens / private fields / operator
  diagnostics / the raw matrix.**
- Output **claims live Dixie, production recall, memory admission, or
  production auth / consent.**
- The command **accepts a freeform recall query** or reads **Discord
  message history.**

If any fail condition appears, stop the demo, do not screenshot, and see
§L for triage and §M to disable.

---

## L. Troubleshooting

Concise triage. Keep secrets out of chat and docs throughout (see the
last item).

- **Command does not appear** — it is likely not registered in
  `<DEV_GUILD>`, or you are looking at the wrong guild. Confirm the guild,
  then re-run the registration procedure (runbook §F) with
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true"` and the correct
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`. Guild commands can take a moment
  to appear in the client.
- **Command appears but returns the generic refusal to the operator** —
  the invocation gates are failing closed. Check, in the runtime env:
  `RECALL_WEDGE_DISCORD_DEMO_ENABLED` is the **exact** string `true`
  (not `TRUE` / `True` / `1` / `yes` / with surrounding spaces);
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` matches `<DEV_GUILD>`; and the
  operator's user ID is in `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`.
  The refusal is intentionally generic, so any one of these will produce
  it (runbook §E.3, §H).
- **A non-operator gets real output** — this is a **fail** (§K). Disable
  invocation immediately (§M / runbook §K.1) and check that
  `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS` is the intended
  allowlist.
- **Output is not ephemeral** — this is a **fail** (§K). The handler is
  ephemeral on every path, so a non-ephemeral message means something
  other than `/recall-wedge-demo` produced it (wrong command, or a
  different surface). Stop and confirm what was actually invoked.
- **Registration missing** — see "command does not appear" above; the
  guild-scoped registration is the Phase 39D §F procedure, and it never
  falls back to global.
- **Railway env not restarted** — env changes only take effect after the
  runtime picks them up. Redeploy / restart the bot and re-test (runbook
  §E.3, §G).
- **Wrong operator user ID** — confirm the allowlisted ID matches the
  account actually invoking the command (a different account, even the
  "right person" on a different login, fails closed).
- **Wrong guild ID** — the invocation guild gate must exactly match
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`; a DM or a different guild fails
  closed.
- **Command registered under the wrong application** — if the command was
  published with a different application's token / app ID than the
  running bot, the running bot will not own it. Re-publish with the
  correct application (runbook §F) and, if needed, remove the stray
  registration via the manual procedure (runbook §L).
- **Do not paste secrets into chat or docs** — no bot token, app ID,
  guild ID, command ID, or user ID belongs in a shared channel, PR, or
  this guide. Use placeholders when describing a fix.

---

## M. Disable / removal reference

- **Disable invocation** — set `RECALL_WEDGE_DISCORD_DEMO_ENABLED` to
  anything other than the exact string `true` (including unsetting it),
  and redeploy / restart if the runtime needs to pick up the change. The
  command may still appear if still registered, but every invocation then
  returns the generic ephemeral refusal (runbook §K.1).
- **Stop registration updates** — set
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` to anything other than
  the exact string `true`. Future publishes will not register or update
  the command (runbook §K.2).
- **Full removal / de-registration** — governed by the **Phase 39D
  runbook §L manual procedure** (Discord Developer Portal / client, a
  scoped `DELETE` against the specific guild command ID with placeholders
  only, or reverting the Phase 39B / 39C commits). There is no
  de-registration helper in the repo today.
- **Phase 40B adds no de-registration helper** — it is docs only.
- A **possible Phase 40C** may decide or implement a guild-scoped helper
  **if still needed** (the manual runbook §L procedure may prove
  sufficient).

---

## N. Follow-up questions to answer safely

Use these answers verbatim or close to it. They keep the demo inside the
boundary.

- **"Is this live memory?"** — No. It is a harness-backed fixture demo;
  nothing is read from or written to memory.
- **"Is this live Dixie?"** — No. No live Dixie path is called; the data
  is a fixed synthetic fixture.
- **"Can users use this publicly?"** — No. It is controlled dev /
  operator only — one guild, operator-allowlisted, ephemeral.
- **"Does this remember Discord messages?"** — No. It does not read
  Discord message history and takes no freeform input.
- **"Does this write memory?"** — No. No admission, no candidate-memory
  write, no "remember this."
- **"Can non-operators use it?"** — No. A non-operator gets the generic
  ephemeral refusal and no harness output.
- **"What does it prove?"** — The interface / frame boundary and
  public-safe rendering: the same continuity fixture can be projected
  into a public Discord frame without leaking raw / private / operator
  material, ephemerally and operator-gated.
- **"What does it not prove?"** — Production auth / consent, live recall,
  public rollout, and memory admission. Those are blocked behind separate
  later gates (§O).

---

## O. Next phases

- **Phase 40C** may be next **if a guild-scoped de-registration helper is
  still needed** — only after Phase 40B, and only if the Phase 39D
  runbook §L manual removal proves insufficient. If implemented it must
  be guild-scoped only, must not global-delete, must not touch handler
  behavior, must add no live Dixie / public recall, and must include
  tests / static guards.
- **Live Dixie-backed Discord recall** requires a **later, separate
  gate** (the Phase 37C live client is operator/dev-only and unreachable
  from Discord; the smoke test proved the surface gate, not live recall).
- **Public-channel-visible recall** requires a **later, separate gate**
  (the demo is ephemeral-only; public output changes blast radius and
  share risk).
- **Telegram, private chat, storage / admission, production auth /
  consent, LLM rewriting, and character voice** all remain blocked.

> **Phase 41A note**
> (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`). Phase 41A
> **chooses not to proceed to Phase 40C immediately** — the Phase 39D
> runbook §L manual removal is sufficient, so the de-registration helper
> stays deferred / only-if-needed. **This harness demo guide remains
> valid and unchanged** — `/recall-wedge-demo` stays controlled,
> guild-scoped, operator-gated, ephemeral, harness-backed, and
> non-production. **Any future live Dixie Discord demo must be separate
> from `/recall-wedge-demo`** — a distinct dev/operator-only command
> `/recall-wedge-live-demo` under its own strict gates, never a
> live-producer replacement of this demo. **Live Dixie-backed recall and
> public-channel-visible recall remain blocked** until separate later
> gates authorize implementation; Phase 41A authorizes nothing here.

> **Phase 41B / 41C note**
> (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`).
> The separate `/recall-wedge-live-demo` command (Phase 41B, PR #137) now
> has **its own operational runbook** (Phase 41C). **This harness demo
> guide remains separate** and continues to govern the harness
> `/recall-wedge-demo` only. **Do not use this harness guide as the live
> Dixie runbook** — the live command has different gates
> (`RECALL_WEDGE_LIVE_DISCORD_DEMO_*`), a live Dixie call path, and
> safe-classification output, all documented in the Phase 41C runbook.
> **The live Dixie smoke-test acceptance is a future Phase 41D** (after a
> controlled live run), not part of this guide.

> **Phase 41D note**
> (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`).
> The future Phase 41D has now occurred: a controlled live-Dixie run of
> `/recall-wedge-live-demo` was accepted (docs-only) for **safe wiring +
> fail-closed rendering only** — the live path reached the Dixie
> `/api/recall/intake` seam and fail-closed on `seam.storage_unavailable`
> (unseeded estate / storage), with no served recall, no memory
> admission, and no leak. **This harness `/recall-wedge-demo` guide is
> unaffected** — it still governs only the fixture-bound harness demo.
> **Served recall, public recall, and public-channel-visible recall
> remain blocked**; served recall is blocked on the unseeded estate /
> storage state.

---

## P. Acceptance criteria for Phase 40B

Phase 40B is acceptable if:

- the **internal guide is added** (this file);
- the **decision map is updated** with a targeted Phase 40B addendum
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **post-smoke decision gate is updated or cross-referenced** with
  the Phase 40B fulfillment note
  (`docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md`);
- the **runbook is updated only if useful** (a short cross-reference to
  this guide; no churn);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs** are committed;
- the **guide uses redacted placeholders only;**
- **no new runtime scope is authorized.**

---

## Q. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-POST-SMOKE-TEST-DECISION-GATE.md` — Phase 40A
  decision gate; selected this guide as Phase 40B; gains a Phase 40B
  fulfillment note.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  gains a Phase 40B addendum.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing register / enable / invoke /
  disable / remove procedure this guide points back to.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the real-guild evidence this demo reproduces.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority that defined the posture.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the harness backing the rendered output.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  handler, env gates, fixed framing, and no-leak scan (unchanged by
  Phase 40B).
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests (unchanged by Phase 40B).
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration;
  registers only, does not delete; unchanged by Phase 40B).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point
  (unchanged by Phase 40B).
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `/recall-wedge-demo` to the handler (unchanged by Phase 40B).
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  live-Dixie Discord decision gate; chooses a separate
  `/recall-wedge-live-demo` command for any future live-Dixie work and
  defers Phase 40C (see the Phase 41A note in §O).
