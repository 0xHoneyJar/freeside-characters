# Recall Wedge — Discord Demo Smoke-Test Acceptance

> **Phase 39E** (docs / smoke-test acceptance only). Companion to
> `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` (Phase 39D
> operational runbook),
> `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` (Phase 39A
> decision gate), and
> `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` (Phase 38B
> acceptance of the Phase 38A harness that backs the rendered output).
>
> This document records the controlled operator smoke test that was
> run **after** Phase 39D, against a real Discord guild. It does
> **not** add or authorize new code. It is the acceptance record for a
> single, controlled dev / operator demo run — nothing more.
>
> It does not expand the Phase 39A authorization. Anything Phase 39A /
> 39D blocked stays blocked here (see §J). If a step seems to require
> reaching past those boundaries, the answer is to stop and open the
> next decision gate (§N) — not to relax it from this acceptance.

---

## A. Status and decision

Phase 39E is **docs / smoke-test acceptance only**.

- It **records the controlled operator smoke test** run after Phase
  39D, in one configured Discord guild.
- It **does not add or authorize new code.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 39E.
- It **does not authorize production rollout.**
- It **does not authorize live Dixie-backed Discord recall.**
- It **does not authorize public channel-visible recall.**
- It **does not authorize** Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, or public
  renderer expansion.

### A.1 Decision sentence

**Phase 39E accepts `/recall-wedge-demo` as successfully smoke-tested
for controlled dev / operator Discord use only: guild-scoped
registration, operator-gated invocation, ephemeral Phase 38A
harness-backed output, non-operator fail-closed refusal, no live Dixie,
no memory admission, no public rollout.**

This acceptance is conditional on the boundaries restated in §I (what
Phase 39E does not prove) and §J (blocked work remains blocked).
Partial compliance does not satisfy this acceptance.

---

## B. Source evidence

This acceptance is grounded in the following artifacts (the same set
the runbook operationalizes — no new code path is introduced or
accepted here):

- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing operating procedure for every
  step performed in the smoke test.
- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority the smoke test preserves without
  expanding.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the
  Phase 39B handler. Source of the fixed dev-only framing header, the
  finite `case` selector (`served` / `denied`), the ephemeral-only
  response builder, the single generic refusal string
  (`recall-wedge-demo is not available here.`), and the final
  banned-substring scan.
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` —
  Phase 39B / 39C regression / static-guard tests; the local evidence
  behind the static posture.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global).
- `apps/bot/scripts/publish-commands.ts` — the publish CLI entry point
  that publishes character commands and then calls
  `registerRecallWedgeDemoCommand`.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `interaction.data?.name === 'recall-wedge-demo'` into the handler
  before character resolution; the handler enforces its own gates.
- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A harness that backs the rendered output.

---

## C. Test environment and redaction posture

- The test was performed in **one configured Discord guild** using the
  existing shell bot application (no new application, token, or
  identity was introduced).
- The raw Discord **bot token, guild ID, command ID, application ID,
  and user IDs are intentionally not recorded** in this document.
- **Screenshots / images are not committed** with this acceptance.
- Evidence is recorded as **redacted operator observations** — what was
  seen, not the operational identifiers that produced it.
- **No secrets were pasted** into this report (consistent with the
  runbook §E.3 / §I no-secrets posture).

This redaction posture is deliberate: it mirrors the runbook's
safe-output checklist (runbook §I) and the no-leak banned-substring
posture the handler enforces. The acceptance is meaningful *because*
the operator observed the gated behavior, not because raw IDs were
copied here.

---

## D. Registration result

Recorded (redacted) registration observations:

- the configured **application ID matched the bot token application**;
- **`/recall-wedge-demo` was registered to the configured guild**;
- the **guild command API list showed `/recall-wedge-demo` present**;
- the guild command list included:
  - `/quest`
  - `/recall-wedge-demo`
  - `/ruggy`
  - `/satoshi`
  - `/satoshi-image`
- **global registration was not observed** (the command appeared only
  in the configured guild, consistent with the guild-scoped-only
  registration path);
- **no secret / token exposure was reported** during registration.

This matches the runbook §F expected registration result: registered
to the guild route only when both env gates pass, with no global
fallback.

---

## E. Positive invocation result — served / default

Recorded (redacted) observations for the served / default invocation:

- `/recall-wedge-demo` was invoked **by an allowlisted operator** from
  an allowlisted Discord account;
- the response was **ephemeral** (marked "Only you can see this.");
- the **dev-only framing was present**:
  - `recall-wedge-demo · fixture-bound dev demo (not production recall)`
  - `gated · operator-only · ephemeral · phase 38a harness output`
- the **`public_discord_simulated` served output was present**:
  - `[recall · public_discord_simulated · served]`
  - `summary: redacted: 0 · marked: 1`
- the **compact per-frame outcome summary was present**:
  - `public_discord_simulated`: rendered
  - `public_telegram_simulated`: refused /
    `public_telegram_projection_not_implemented`
  - `authorized_private_session_simulated`: refused /
    `authorized_private_projection_not_implemented`
  - `private_chat_simulated`: unimplemented /
    `private_chat_projection_unimplemented`
  - `character_frame_public`: rendered
- **no `operator_dev` diagnostics** were visible;
- **no raw matrix** was visible;
- **no operational IDs** were visible;
- **no live Dixie language** was visible;
- **no memory admission / production auth / production consent claims**
  were visible.

This matches the runbook §G expected-success contract: ephemeral,
fixed framing, `public_discord_simulated` frame output, compact
public-safe outcome summary, and no diagnostics / raw matrix /
operational IDs / live-Dixie / memory-admission language.

---

## F. Positive invocation result — denied / refusal case

Recorded (redacted) observations for the `case:denied` invocation:

- `/recall-wedge-demo case:denied` was invoked **by an allowlisted
  operator**;
- the response was **ephemeral** (marked "Only you can see this.");
- the **`public_discord_simulated` refused output was present**:
  - `[recall · public_discord_simulated · refused]`
  - `status: this frame cannot answer publicly`
- the **compact per-frame outcome summary was present**:
  - `public_discord_simulated`: refused /
    `denied_or_forbidden_projection_refused_publicly`
  - `public_telegram_simulated`: refused /
    `public_telegram_projection_not_implemented`
  - `authorized_private_session_simulated`: refused /
    `authorized_private_projection_not_implemented`
  - `private_chat_simulated`: unimplemented /
    `private_chat_projection_unimplemented`
  - `character_frame_public`: refused /
    `character_frame_refused_publicly`
- **no `operator_dev` diagnostics** were visible;
- **no raw matrix** was visible;
- **no operational IDs** were visible;
- **no live Dixie language** was visible;
- **no memory admission / production auth / production consent claims**
  were visible.

This is the demo's `denied` frame: a **public-safe refusal-style
output**, not an error and not a leak. It confirms the public surface
refuses without revealing private material (runbook §H, `case:denied`
row).

---

## G. Fail-closed result — non-operator

Recorded (redacted) observations for the non-operator fail-closed test:

- a **different Discord account, not in the operator allowlist**,
  invoked `/recall-wedge-demo`;
- the command returned the **generic ephemeral refusal**:
  - `recall-wedge-demo is not available here.`
- the refusal was **ephemeral** (marked "Only you can see this.");
- the refusal **did not expose harness output**;
- the refusal **did not expose operator diagnostics**;
- the refusal **did not expose raw IDs / tokens / private fields**;
- the refusal **did not mention live Dixie, memory admission,
  production auth, or production consent**;
- **no Railway env change was needed** for this non-operator
  fail-closed test — the operator allowlist alone excluded the
  non-operator account (the command remained enabled for the operator
  while still refusing the non-operator).

This confirms the load-bearing boundary: the single generic refusal
string never reveals which gate tripped (runbook §H non-operator row;
handler `RECALL_WEDGE_DEMO_GENERIC_REFUSAL`).

---

## H. What Phase 39E proves

Phase 39E proves, from the controlled operator smoke test, that:

- the **registration path can publish `/recall-wedge-demo` to the
  configured guild**;
- the **command is visible / invokable in real Discord** after
  registration;
- an **allowlisted operator receives ephemeral Phase 38A
  harness-backed output**;
- the **served / default path renders `public_discord_simulated`
  safely** (with the dev-only framing and compact outcome summary);
- the **denied path renders public-safe refusal output**
  (`[recall · public_discord_simulated · refused]`);
- a **non-operator account receives the generic ephemeral refusal**;
- the **user-visible smoke-test outputs avoid raw IDs / tokens /
  private fields / operator diagnostics / raw matrix**;
- the **Discord smoke test did not use live Dixie**;
- the **Discord smoke test did not admit memory**;
- the **Discord smoke test did not claim production auth / consent**.

These are observations about *this controlled run*. They confirm the
runbook procedure works end-to-end in a real guild under the gates.
They do not extend the proof past §I.

---

## I. What Phase 39E does not prove

Phase 39E does **not** prove any of the following. These remain in
scope only for later, separately authorized phases:

- production readiness;
- public rollout readiness;
- public channel-visible recall;
- live Dixie-backed Discord recall;
- production auth / consent;
- cross-user recall authorization;
- live memory admission;
- candidate-memory admission;
- Telegram support;
- private chat support;
- storage / admission;
- direct Finn runtime / audit wiring;
- LLM rewriting;
- character voice;
- broad Discord UX readiness;
- long-running operational stability;
- de-registration automation.

If a later phase needs proof of any item above, it must propose a phase
that *names* the proof it intends to deliver and the gate it must clear
— it must not stretch this smoke-test acceptance to cover that ground.

---

## J. Blocked work remains blocked

The following remain explicitly blocked. None is authorized by Phase
39E (this restates the runbook §D / Phase 38B §G blocked-work list,
carried forward unchanged):

- global registration;
- public rollout;
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
re-opens.

---

## K. Codex / static validation note

Phase 39D carried an independent Codex audit. Recorded here for the
acceptance trail:

- Codex performed **repo / runbook / static / local** validation for
  Phase 39D and found **no repo / runbook / static posture issue**;
- Codex returned **BLOCKED only for live testing**, because its
  environment **lacked valid invocation credentials** — an
  **access / env limitation, not a code or runbook defect**;
- **no required patch** was identified by Codex;
- the **final live invocation was performed by the human operator, not
  by Codex** — Codex's BLOCKED verdict reflects that it could not reach
  a real guild, not that the demo was unsafe.

Recorded Codex local validation numbers (Phase 39D):

- fixture validator: **122 passed, 0 failed**;
- `recall-wedge-demo` tests: **116 passed, 0 failed**;
- Phase 38A harness regression: **52 passed, 0 failed**;
- `apps/bot` typecheck: **known dirty baseline, 151 errors**, with **no
  `recall-wedge-demo` / harness / TS6059 / `rootDir` references**;
- static safety confirmed: **guild-only registration**, **no global
  registration path**, **`buildCommandSet` exclusion**, **publish
  command exclusion**, **exact env gates**, **ephemeral-only**,
  **harness lazy-load**, **no live Dixie**, **no memory admission /
  remember-this**, **no Telegram / private chat / storage / Finn /
  LLM**.

This Phase 39E acceptance re-runs the docs-side validation in §O; the
figures above are the implementation evidence carried forward from
Phase 39D.

---

## L. Operator acceptance checklist

The operator confirmed every item below during the smoke test:

- [x] registration confirmed in the configured guild;
- [x] no global registration observed;
- [x] served / default invocation passed;
- [x] denied invocation passed;
- [x] non-operator fail-closed passed;
- [x] all responses ephemeral;
- [x] no raw IDs / tokens / private fields visible;
- [x] no live Dixie language;
- [x] no memory admission language;
- [x] no production auth / consent claim;
- [x] screenshots not committed;
- [x] secrets not recorded.

---

## M. Operational status after test

- The command **may remain registered** in the configured guild for
  controlled dev / operator use.
- Invocation **remains governed by the Railway / runtime env gates**
  (`RECALL_WEDGE_DISCORD_DEMO_ENABLED`,
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`,
  `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS`).
- **To disable invocation**, set `RECALL_WEDGE_DISCORD_DEMO_ENABLED`
  away from the exact string `"true"` and redeploy / restart if the
  runtime needs to pick up the change (runbook §K.1).
- **To stop registration updates**, set
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` away from the exact
  string `"true"` (runbook §K.2).
- **To remove the command entirely**, use the Phase 39D runbook manual
  de-registration options (runbook §L) — there is no de-registration
  helper in this repo, and Phase 39E adds none.
- **No data migration is needed** because no memory / storage /
  admission state is created by the demo (runbook §L).

---

## N. Next decision point

**Recommended next phase: Phase 40A — post-smoke-test decision gate.**

Phase 40A should decide whether to:

1. keep the demo as-is for controlled operator demos;
2. write a short internal demo guide;
3. add a de-registration helper;
4. move toward live Dixie-backed Discord recall under a new gate;
5. move toward public-channel-visible recall under a new gate;
6. stop and harden operational docs.

**Phase 39E itself authorizes none of those.** It only accepts the
controlled smoke-test result. Each option above carries its own proof
obligation and re-opens its own decision artifact; Phase 40A is the
place to weigh them, not this acceptance.

---

## O. Acceptance criteria for Phase 39E

Phase 39E is acceptable if:

- the **smoke-test acceptance report is added** (this file);
- the **decision map is updated** with a targeted Phase 39E addendum;
- the **runbook is updated / referenced** with a Phase 39E note;
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no secrets / raw IDs / images** are committed;
- **all blocked work remains blocked** (§J).

---

## P. Cross-references

- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook; the governing operating procedure; gains a
  Phase 39E note.
- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority this acceptance preserves.
- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A harness backing the rendered output.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option
  matrix; gains a Phase 39E addendum.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  handler and env gates.
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` —
  Phase 39B / 39C regression / static-guard tests.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `/recall-wedge-demo` to the handler.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — Phase 38A harness; the only data path the demo renders from.
