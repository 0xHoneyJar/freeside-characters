# Recall Wedge — Post-Smoke-Test Decision Gate

> **Phase 40A** (docs / decision gate only). Companion to
> `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` (Phase 39E
> smoke-test acceptance),
> `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` (Phase 39D
> operational runbook),
> `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` (Phase 39A
> decision gate), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option
> matrix).
>
> This document is a **decision gate**. It follows Phase 39E
> smoke-test acceptance and decides the next safe ladder. It does not
> add or authorize new runtime behavior, it does not change
> `/recall-wedge-demo`, and it does not implement Phase 40B or Phase
> 40C — it only selects them as the next steps.
>
> It does not expand the Phase 39A authorization. Anything Phase 39A /
> 39D / 39E blocked stays blocked here (see §I). If a step seems to
> require reaching past those boundaries, the answer is to open the
> separate later gate that owns it — not to relax it from this
> decision.

---

## A. Status and decision

Phase 40A is **docs / decision gate only**.

- Phase 40A **follows Phase 39E smoke-test acceptance**.
- It **does not add or authorize new runtime behavior.** No source,
  test, package, lockfile, fixture, config, CI, or generated change is
  introduced by Phase 40A.
- It **does not change `/recall-wedge-demo`.**
- It **does not authorize production rollout.**
- It **does not authorize live Dixie-backed Discord recall.**
- It **does not authorize public channel-visible recall.**
- It **does not authorize** Telegram, private chat, storage /
  admission, production auth / consent, LLM rewriting, character voice,
  or public renderer expansion.

### A.1 Decision sentence

**Phase 40A keeps `/recall-wedge-demo` as a controlled dev/operator
demo and selects the next safe ladder as Phase 40B internal demo guide
followed, if still needed, by Phase 40C guild-scoped de-registration
helper; live Dixie-backed Discord recall and public-channel-visible
recall remain blocked behind later gates.**

This decision is conditional on the boundaries restated in §F (why not
live Dixie yet), §G (why not public recall yet), and §I (blocked work
remains blocked). Selecting a step here is not authorizing its
implementation — Phase 40B and Phase 40C each carry their own scope and
acceptance, defined in §E, and neither is implemented by Phase 40A.

---

## B. Source evidence

This decision gate is grounded in the following artifacts (no new code
path is introduced or authorized here):

- `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the redacted operator evidence this decision
  reads from (§C summarizes it).
- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing operating procedure that still
  applies after Phase 40A (§H).
- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority this decision preserves without
  expanding.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option
  matrix; gains a Phase 40A addendum.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the Phase
  39B handler. Source of the env gate helpers
  (`shouldEnableRecallWedgeDiscordDemo`,
  `isRecallWedgeDiscordDemoAllowedGuild`,
  `isRecallWedgeDiscordDemoOperator`,
  `shouldRegisterRecallWedgeDiscordDemo`,
  `resolveRecallWedgeDiscordDemoGuildId`), the fixed `case` enum
  selector (`served` / `denied`), the ephemeral-only response builder,
  the single generic refusal string
  (`recall-wedge-demo is not available here.`), and the final
  banned-substring scan. **Not modified by Phase 40A.**
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests; the local evidence behind
  the static posture. **Not modified by Phase 40A.**
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global). It **registers only**
  (POST to the guild commands route); it does not delete. **Not
  modified by Phase 40A.**
- `apps/bot/scripts/publish-commands.ts` — the publish CLI entry point
  that publishes character commands and then calls
  `registerRecallWedgeDemoCommand`. **Not modified by Phase 40A.**
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `interaction.data?.name === 'recall-wedge-demo'` into the handler
  before character resolution; the handler enforces its own gates.
  **Not modified by Phase 40A.**

---

## C. Inputs from Phase 39E

Phase 39E recorded a controlled operator smoke test in one configured
Discord guild, using redacted observations only (no raw IDs / tokens /
screenshots committed). Carried forward into this decision:

- **Registration passed** — `/recall-wedge-demo` registered to the
  configured guild.
- **The guild command API showed `/recall-wedge-demo` present** in the
  configured guild's command list.
- **No global registration was observed** — the command appeared only
  in the configured guild, consistent with the guild-scoped-only
  registration path.
- **Served / default invocation passed** — an allowlisted operator
  received ephemeral Phase 38A `public_discord_simulated` harness
  output with the fixed dev-only framing and compact per-frame outcome
  summary.
- **`case:denied` invocation passed** — the public surface returned
  public-safe refusal-style output
  (`[recall · public_discord_simulated · refused]`), not an error and
  not a leak.
- **Non-operator fail-closed passed** — a different account, not in the
  operator allowlist, received the single generic ephemeral refusal
  (`recall-wedge-demo is not available here.`).
- **Output was ephemeral** on every path (success and refusal).
- **No live Dixie** was used by the smoke test.
- **No memory admission** occurred.
- **No public rollout** occurred.

These are observations about that one controlled run. They confirm the
runbook procedure works end-to-end in a real guild under the gates;
they do not extend the proof past Phase 39E §I.

---

## D. Decision options considered

The six options Phase 39E §N left open, each assessed for value, risk,
and the decision taken here.

### Option 1 — keep the demo as-is for controlled operator demos

- **Value:** zero new risk; the smoke test already proved the
  controlled dev / operator demo works end-to-end under the gates. The
  command stays available for repeat demos without any change.
- **Risk:** none beyond the already-accepted posture; the demo remains
  fixture-bound, guild-only, operator-only, and ephemeral.
- **Decision:** **accepted as the current operating state.** This is
  the baseline Phase 40A preserves; the other options are layered on
  top of it, not in place of it.

### Option 2 — write a short internal demo guide

- **Value:** captures *how to demo safely* as an operator-facing
  artifact, separate from the Phase 39D runbook (which is the operating
  procedure for register / enable / invoke / disable / remove). A short
  guide lowers the chance an operator improvises past a boundary during
  a live demo and standardizes what to say and what not to claim.
- **Risk:** low; docs-only, no code, must use redacted placeholders and
  must preserve the no-live-Dixie / no-memory-admission /
  no-public-rollout posture.
- **Decision:** **selected as Phase 40B.** See §E.

### Option 3 — add a de-registration helper

- **Value:** today removal is manual (Phase 39D runbook §L — Discord
  Developer Portal / client, a scoped `DELETE` against the specific
  guild command ID, or reverting the Phase 39B / 39C commits). A
  narrow, guild-scoped helper would make teardown less error-prone.
- **Risk:** it is code, so it carries more risk than a doc: a
  de-registration helper that is not strictly guild-scoped could
  global-delete, and one wired wrong could touch the runtime handler.
  It must be guild-scoped only, must not global-delete, must not change
  handler behavior, must include tests / static guards, and must use
  placeholders / no secrets.
- **Decision:** **selected as Phase 40C, after Phase 40B, if still
  needed.** It is sequenced behind the guide because the guide may show
  manual removal is sufficient. See §E.

### Option 4 — move toward live Dixie-backed Discord recall under a new gate

- **Value:** would connect the Discord surface to a real recall
  producer rather than the Phase 38A harness — the long-term direction
  if Discord recall is ever to be more than a demo.
- **Risk:** high. The Phase 37C live Dixie client exists only as an
  operator/dev-only seam; the Phase 39B / 39C / 39E Discord demo is
  harness-backed only. Wiring live Dixie into Discord changes the input
  source, the auth / authorization posture, request / response
  classification, no-leak obligations, error / refusal behavior, logs,
  env, and rollback all at once.
- **Decision:** **explicitly not selected now.** It requires a separate
  later live-Dixie Discord recall gate (§F). It must not be smuggled in
  through a demo-guide or de-registration phase.

### Option 5 — move toward public-channel-visible recall under a new gate

- **Value:** would let recall output be seen by a channel rather than
  only the invoking operator — necessary for any non-demo audience.
- **Risk:** high. The current demo is ephemeral-only. Public
  channel-visible output changes the blast radius and the
  screenshot / share risk, and it needs its own decisions on channel
  allowlists, content policy, no-leak proof, moderator / operator
  expectations, refusal language, and rollback.
- **Decision:** **explicitly not selected now.** It requires a separate
  later public-channel-visible recall gate (§G).

### Option 6 — stop and harden operational docs

- **Value:** consolidates the operational posture before doing anything
  else.
- **Risk:** low, but largely redundant — Phase 39D (runbook) and Phase
  39E (acceptance) already hardened the operational and acceptance
  docs.
- **Decision:** **partially satisfied by Phase 39D / 39E; not selected
  as the only next step.** A short internal demo guide (Option 2 /
  Phase 40B) is the better operational hardening artifact than a
  general docs-stop, because it adds the missing *how-to-demo-safely*
  surface rather than re-hardening what 39D / 39E already cover.

---

## E. Selected ladder

Phase 40A selects the following ladder. **Neither phase is implemented
by Phase 40A.**

### Phase 40B — Internal Discord Recall Wedge Demo Guide

- **docs-only;**
- **operator-facing;**
- **no code** (no source, test, package, lockfile, fixture, config, CI,
  or generated change);
- **no screenshots / raw IDs / secrets;**
- should explain **how to demo safely in 5–10 minutes;**
- should include **what to say and what not to claim** (e.g. "this is a
  fixture-bound dev demo, not production recall; no live Dixie, no
  memory admission, no public rollout");
- should use **only redacted placeholders** (guild ID, operator ID,
  app ID, command ID, token — all placeholders, never real values);
- should **preserve the no-live-Dixie / no-memory-admission /
  no-public-rollout posture** and the dev-only / guild-only /
  operator-only / ephemeral framing;
- is a guide layered on top of the Phase 39D runbook, not a replacement
  for it.

> **Phase 40B fulfilled** (`docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md`).
> The selected internal-guide step is now in the repo: a docs-only,
> operator-facing 5–10 minute demo guide with what-to-say /
> what-not-to-claim guidance and redacted-placeholder expected outputs.
> **Phase 40B authorizes no implementation / runtime scope** — it adds
> no source / test / package / lockfile / fixture / config / CI /
> generated change and does not touch `/recall-wedge-demo`. **Phase 40C
> remains only a possible next step, if still needed** (the Phase 39D
> runbook §L manual removal may suffice). **Live Dixie-backed Discord
> recall and public-channel-visible recall remain blocked** behind
> separate later gates (§F, §G, §I).

### Phase 40C — Guild-Scoped De-Registration Helper Gate / Implementation

- **only after Phase 40B;**
- may be a **decision gate** or a **narrow implementation slice**, only
  **if still needed** (the Phase 40B guide may show manual removal per
  Phase 39D runbook §L is sufficient);
- if implementation, it **must be guild-scoped only;**
- it **must not global-delete anything;**
- it **must not touch runtime handler behavior** (no change to
  `recall-wedge-demo.ts` invocation gates / rendering / refusal);
- it **must not add live Dixie;**
- it **must not add public recall;**
- it **must include tests / static guards** (the same
  guild-scoped-only / never-global posture the Phase 39C registration
  path proves);
- it **must use placeholders / no secrets;**
- it **must not add package / lockfile changes** unless a concrete
  blocker appears and is named in that phase.

---

## F. Why not live Dixie-backed Discord recall yet

- The **Phase 37C live Dixie client exists as an operator/dev-only
  seam** — it is the only live Dixie path in the repo, and it is not
  reachable from Discord. The Phase 39B / 39C / 39E Discord demo is
  **harness-backed only**: the Phase 39B handler renders the Phase 38A
  multi-surface harness and explicitly does not import the Phase 37C
  live client or runner.
- The **smoke test proved the Discord surface gate, not live Dixie
  recall.** Phase 39E confirmed registration, operator-gated
  invocation, ephemeral harness output, public-safe refusal, and
  non-operator fail-closed — all over fixture-bound harness output. It
  did not exercise, and does not prove, any live recall path.
- **Live Dixie-backed Discord recall requires a separate gate** that
  decides, at minimum: the input source; the auth / authorization
  posture; request / response classification; no-leak output proof;
  error / refusal behavior; logs; env; and rollback. (These line up
  with the Phase 35A decision-map §6 live-Dixie gates and the Phase 39A
  boundaries.)
- It **must not be smuggled in** through a demo-guide (Phase 40B) or a
  de-registration phase (Phase 40C). Those phases are explicitly barred
  from adding live Dixie.

---

## G. Why not public-channel-visible recall yet

- The **current demo is ephemeral-only.** Every path through the Phase
  39B handler — success and refusal — returns an ephemeral response;
  there is no non-ephemeral path.
- **Public channel-visible recall changes blast radius and
  screenshot / share risk.** What only the invoking operator can see
  today would become visible to a channel, and durable / shareable,
  the moment output is made public.
- **Public output would need a separate decision** on: channel
  allowlists; content policy; no-leak proof for a public audience;
  moderator / operator expectations; refusal language; and rollback.
- It therefore **remains blocked** behind its own later
  public-channel-visible recall gate, and is not opened by Phase 40A,
  40B, or 40C.

---

## H. Operational posture after Phase 40A

- **`/recall-wedge-demo` may remain registered** in the configured
  guild for controlled dev / operator demos.
- **Invocation remains gated by runtime env:**
  - `RECALL_WEDGE_DISCORD_DEMO_ENABLED`
  - `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`
  - `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`
- **Registration updates remain gated by:**
  - `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS`
  - `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`
- **Disable and removal still follow the Phase 39D runbook** — disable
  invocation (runbook §K.1), disable registration (runbook §K.2), and
  manual removal (runbook §L). There is no de-registration helper in
  the repo today, and Phase 40A adds none.
- **Phase 39E smoke-test acceptance remains the evidence of real
  Discord behavior.** Phase 40A adds no new runtime evidence; it
  decides the ladder only.

---

## I. Blocked work remains blocked

The following remain explicitly blocked. None is authorized by Phase
40A (this restates the Phase 39E §J / runbook §D blocked-work list,
carried forward unchanged):

- global registration;
- production / public rollout;
- public channel-visible recall;
- live Dixie-backed Discord recall;
- freeform memory / recall query input;
- Discord message history as memory input;
- memory admission;
- candidate-memory writes;
- "remember this" from Discord;
- Telegram;
- private chat;
- storage / admission;
- production auth / consent;
- direct Finn runtime / audit wiring;
- LLM rewriting;
- character voice;
- public renderer expansion;
- positive `public_telegram` support;
- positive `authorized_private_session` support.

If a later phase needs any item above, it must propose a phase naming
the item, the proof obligation it carries, and the decision artifact it
re-opens. Phase 40B and Phase 40C are explicitly barred from any of
them.

---

## J. Acceptance criteria for Phase 40A

Phase 40A is acceptable if:

- the **decision document is added** (this file);
- the **decision map is updated** with a targeted Phase 40A addendum;
- the **Phase 39E acceptance is updated or cross-referenced** with the
  Phase 40A decision where useful;
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs** are committed;
- the **selected ladder is Phase 40B internal guide then possible Phase
  40C de-registration helper;**
- **live Dixie-backed Discord recall and public-channel-visible recall
  remain blocked behind separate later gates.**

---

## K. Cross-references

- `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  smoke-test acceptance; the input evidence; gains a Phase 40A note.
- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing operating procedure that still
  applies (disable / removal).
- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority this decision preserves.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option
  matrix; gains a Phase 40A addendum.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  handler and env gates (unchanged by Phase 40A).
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C regression / static-guard tests (unchanged by Phase 40A).
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration;
  registers only, does not delete; unchanged by Phase 40A).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point
  (unchanged by Phase 40A).
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `/recall-wedge-demo` to the handler (unchanged by Phase 40A).
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  live-Dixie Discord decision gate; opens the separate-command live-Dixie
  decision lane (see the Phase 41A note below).

---

## L. Phase 41A note — Phase 40B fulfilled; 40C deferred; a separate live-Dixie Discord decision lane opened

> Added by Phase 41A
> (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`). Short note,
> not a rewrite of this gate.

- **Phase 40B fulfilled the internal demo guide step** selected in §E
  (`docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md`).
- **Phase 40C remains optional / deferred.** The Phase 39D runbook §L
  manual removal is sufficient; no current blocker requires a helper.
- **Phase 41A opens a separate live-Dixie Discord decision lane only as a
  decision gate** — it selects, for any future live-Dixie Discord work, a
  separate dev/operator-only command `/recall-wedge-live-demo` under
  strict disabled-by-default / guild-scoped / operator-gated /
  ephemeral / no-freeform / no-history / no-memory-admission gates that
  may call the Phase 37C live client only after Discord gates pass. It
  implements nothing.
- **`/recall-wedge-demo` remains harness-backed** and is not mutated into
  a live command.
- **No runtime scope is added** by Phase 41A — no source / test / package
  / lockfile / fixture / config / CI / generated change. Live
  Dixie-backed Discord recall and public-channel-visible recall remain
  blocked behind separate later gates (§F, §G, §I).
