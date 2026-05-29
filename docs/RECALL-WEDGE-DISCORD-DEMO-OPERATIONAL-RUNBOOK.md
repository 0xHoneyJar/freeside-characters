# Recall Wedge — Discord Demo Operational Runbook

> **Phase 39D** (docs / operational acceptance / runbook only).
> Companion to
> `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` (Phase 39A
> decision gate), and to the multi-surface harness acceptance
> (`docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md`, Phase 38B).
>
> This document does **not** add or authorize new code. It is the
> operator runbook for safely registering, enabling, invoking,
> validating, disabling, and removing the `/recall-wedge-demo` command
> that Phase 39B implemented and Phase 39C gated for registration — all
> while preserving every Phase 39A / 39B / 39C boundary.
>
> It does not expand the Phase 39A authorization. Anything Phase 39A
> blocked stays blocked here (see §D). If a step in this runbook seems
> to require reaching past those boundaries, the answer is to stop and
> re-open the Phase 39A gate — not to relax it from this runbook.

---

## A. Status and decision

Phase 39D is **docs / operational acceptance / runbook only**.

- It **accepts the Phase 39B / 39C implementation posture as ready for
  a controlled dev / operator run**: guild-scoped registration,
  operator-gated invocation, ephemeral harness-backed output.
- It **does not add or authorize new code.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 39D.
- It **does not authorize production rollout.**
- It **does not authorize live Dixie-backed Discord recall.**
- It **does not authorize public channel-visible recall.**
- It **does not authorize** Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, or public
  renderer expansion.

### A.1 Decision sentence

**Phase 39D accepts `/recall-wedge-demo` for controlled dev / operator
Discord testing only: guild-scoped registration, operator-gated
invocation, ephemeral harness-backed output, no live Dixie, no memory
admission, no public rollout.**

### A.2 Phase 39E note — controlled smoke test completed

> Added by Phase 39E
> (`docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md`).

- The **controlled smoke test described by this runbook has been
  completed** by the human operator in a real Discord guild.
- **Operator invocation** (served / default and `denied`) and
  **non-operator fail-closed refusal** were observed and accepted (see
  the Phase 39E acceptance report for the redacted evidence).
- **This runbook remains the governing operating procedure** for any
  further controlled dev / operator run.
- **No new runtime scope is authorized** by the smoke test — every
  §D blocked item stays blocked, and the demo stays a fixture-bound,
  guild-only, operator-only, ephemeral dev demo.

---

## B. Source evidence

This runbook is grounded in the following artifacts (read before
running anything in §F / §G):

- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority every step below preserves (§C–§N).
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the
  Phase 39B handler. Env gate helpers
  (`shouldEnableRecallWedgeDiscordDemo`,
  `isRecallWedgeDiscordDemoAllowedGuild`,
  `isRecallWedgeDiscordDemoOperator`,
  `shouldRegisterRecallWedgeDiscordDemo`,
  `resolveRecallWedgeDiscordDemoGuildId`), the fixed `case` enum
  selector (`served` / `denied`), the single generic refusal, the
  ephemeral-only response builder, and the final banned-substring scan
  all live here.
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` —
  Phase 39B regression / static-guard tests; the evidence behind §N.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global) and the unrelated
  character `publishCommands` PUT path it composes with.
- `apps/bot/scripts/publish-commands.ts` — the CLI entry point that
  publishes character commands and then calls
  `registerRecallWedgeDemoCommand`.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `interaction.data?.name === 'recall-wedge-demo'` into the handler
  before character resolution; the handler enforces its own gates.
- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A harness that backs the rendered output.

---

## C. What is now allowed

With this runbook accepted, the following controlled actions are
allowed:

- **Controlled dev / operator registration** of `/recall-wedge-demo`
  to **one** configured guild (guild-scoped route only, never global).
- **Controlled dev / operator invocation** by allowlisted operator
  Discord user IDs, in that one configured guild.
- **Ephemeral-only rendering** of the Phase 38A
  `public_discord_simulated` harness frame output, plus the fixed
  dev-only framing header and a compact public-safe per-frame outcome
  summary.
- The **harmless finite `case` selector** with values `served` and
  `denied` only.
- A **local / dev or controlled deployment test** using the existing
  Discord bot application (the same shell bot; no new application,
  token, or identity is introduced).
- **Immediate disable by env / config** (no redeploy required for the
  invocation kill switch — see §K).

Nothing above is a production capability. The command is a
fixture-bound dev demo and must be described that way at all times.

---

## D. What remains blocked

Keep blocked (none of these is authorized by Phase 39D):

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
re-opens (Phase 39A §N).

---

## E. Required env vars

The env split is deliberate: **registration** and **invocation** are
gated independently, and one never controls the other.

### E.1 Registration env (publish-time)

Set these only for the publish run that registers the command:

- `DISCORD_BOT_TOKEN` — the existing shell bot token (placeholder:
  `DISCORD_BOT_TOKEN=<bot-token>`). Required by the publish CLI.
- `DISCORD_APPLICATION_ID` — optional. The publish CLI uses it if set;
  if unset, the CLI derives the application ID from
  `/applications/@me` using the bot token (see
  `apps/bot/scripts/publish-commands.ts` and `fetchApplicationId`). So
  it is **not strictly required** when the token can derive it.
- `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true"` — exact string
  `"true"` or registration is skipped.
- `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID=<single-allowed-guild-id>` — the
  single guild the command is registered to. Missing / blank → skipped
  (no global fallback).

### E.2 Invocation env (bot runtime)

Set these on the running bot process:

- `RECALL_WEDGE_DISCORD_DEMO_ENABLED="true"` — exact string `"true"` or
  every invocation fails closed.
- `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID=<same-single-allowed-guild-id>` —
  must match `interaction.guild_id` or the invocation fails closed.
  Use the same guild ID as registration.
- `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS=<comma-separated-operator-ids>`
  — allowlist of operator Discord user IDs. The invoker
  (`member.user.id` in a guild, `user.id` in a DM) must be in this
  list or the invocation fails closed.

### E.3 Env semantics (binding)

- The enabling / register values must be the **exact lowercase string
  `"true"`**.
- `TRUE`, `True`, `1`, `yes`, and any whitespace variant (e.g.
  `" true"`) **do not** enable or register — they all fail closed.
- A **missing guild ID fails closed** at both registration and
  invocation; registration never falls back to global.
- An **empty (or unset) operator allowlist fails closed** at
  invocation.
- `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` controls **registration
  only**, never invocation.
- `RECALL_WEDGE_DISCORD_DEMO_ENABLED` controls **invocation only**,
  never registration.
- **Never** put token values (or any real secret) into PRs, chats,
  docs, logs, or screenshots. Use placeholder values only, as shown
  above.

---

## F. Safe registration procedure

Use placeholder env values only. Do not include raw secrets in any
copy-pasted command, log, or screenshot.

1. **Confirm the deploy source is merged main after PR #131.** The
   handler (Phase 39B) and the guild-scoped registration gate
   (Phase 39C) must both be present. Build / deploy from `main` (or a
   branch fast-forwarded to it).
2. **Set only the required registration env vars** (§E.1) for this one
   publish run:
   - `DISCORD_BOT_TOKEN=<bot-token>`
   - `DISCORD_APPLICATION_ID=<app-id>` (optional — derived from the
     token if omitted)
   - `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true"`
   - `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID=<single-allowed-guild-id>`
3. **Run the repo's publish command.** The registration path lives in
   the existing publish CLI (no new script is added by Phase 39D):

   ```bash
   DISCORD_BOT_TOKEN=<bot-token> \
   DISCORD_APPLICATION_ID=<app-id> \
   RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true" \
   RECALL_WEDGE_DISCORD_DEMO_GUILD_ID=<single-allowed-guild-id> \
     bun run apps/bot/scripts/publish-commands.ts
   ```

   This publishes the normal character command set first, then calls
   `registerRecallWedgeDemoCommand`. The demo registration is a
   separate guild-scoped POST — it is **not** part of `buildCommandSet`
   and can never reach the global route.
4. **Expected registration result:**
   - **skipped** when the register flag is missing / not exact `"true"`
     (CLI prints `/recall-wedge-demo NOT registered (gate_disabled)`);
   - **skipped** when the guild ID is missing / blank (CLI prints
     `/recall-wedge-demo NOT registered (no_guild)`), with **no global
     fallback**;
   - **registered to the guild route only** when both gates pass (CLI
     prints `registered dev-only /recall-wedge-demo → guild <id>
     (id <command-id>)`);
   - **never** a global registration.
5. **Confirm scope.** In the Discord client (or via the guild commands
   API for the configured guild) confirm `/recall-wedge-demo` appears
   **only in the configured guild** and not as a global command.

---

## G. Safe invocation procedure

1. **Set the invocation env vars (§E.2) on the bot runtime:**
   - `RECALL_WEDGE_DISCORD_DEMO_ENABLED="true"`
   - `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID=<same-single-allowed-guild-id>`
   - `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS=<your-operator-id>`
2. **Restart / redeploy the bot only if the env change requires it**
   (env vars are read from `process.env` at invocation time; a process
   that already has them set does not need a restart, but a process
   started before the vars were set does).
3. **In the allowed guild, invoke as an allowlisted operator:**
   - `/recall-wedge-demo`
   - `/recall-wedge-demo case:served`
   - `/recall-wedge-demo case:denied`
4. **Expected success:**
   - **ephemeral response only** (visible to the invoking operator);
   - contains the **fixed dev-only framing** header (labels it
     fixture-bound, gated, operator-only, ephemeral, Phase 38A harness
     output, not production recall);
   - renders the **`public_discord_simulated` harness frame** output;
   - may show a **compact public-safe per-frame outcome / refusal-code
     summary**;
   - **no `operator_dev` diagnostics**;
   - **no raw matrix dump**;
   - **no operational IDs**;
   - **no live Dixie language**;
   - **no memory admission language**.

---

## H. Fail-closed test matrix

Run these to confirm the boundary holds before trusting a real
operator run. Every refusal is the same single generic ephemeral
string — it never reveals which gate tripped.

| Scenario | Expected result |
|---|---|
| Registration flag missing | no registration; no network call to the demo command route |
| Registration flag `TRUE` / `1` / `yes` | no registration |
| Registration flag `"true"` but guild ID missing | no registration; **no global fallback** |
| Invocation `ENABLED` missing | generic ephemeral refusal |
| Invocation `ENABLED` = `TRUE` / `1` / `yes` | generic ephemeral refusal |
| Wrong guild (guild_id ≠ configured) | generic ephemeral refusal |
| Missing guild / DM (no guild_id) | generic ephemeral refusal |
| Non-operator user | generic ephemeral refusal |
| Empty operator allowlist | generic ephemeral refusal |
| Allowed operator + allowed guild + `ENABLED="true"` | ephemeral success |
| `case:denied` | ephemeral public-safe refusal-style output (the demo's `denied` frame) |
| Unknown `case` selector value | defaults safely to `served` behavior |
| No-leak scan failure on rendered output | generic ephemeral refusal |

---

## I. Safe output checklist

Before any screenshot or share:

- The output **must be ephemeral**.
- **Do not** screenshot operator IDs, guild IDs, tokens, or any private
  admin UI.
- The user-visible output must not contain any banned substring (the
  same Phase 39B / 39C / Phase 33B posture). It must **not** contain:
  - `PRIVATE_SENTINEL`
  - `raw_reasons`
  - `raw_dixie_debug`
  - `raw_session_trace`
  - `operator_private`
  - `private_assertion`
  - `assertion_id`
  - `source_material`
  - `session_id`
  - `message_id`
  - `tenant_id`
  - `community_id`
  - `session_thread_id`
  - `continuity_actor_id`
  - `actor:`
  - `freeside-characters:shared-substrate`
  - raw Discord user IDs
  - raw guild IDs
  - the Discord bot token
  - service token values
- It must **not** claim production recall, production consent,
  production auth, or memory admission.

The handler runs the final banned-substring scan and falls back to the
generic ephemeral refusal on any hit, so a leaky response should never
reach Discord — this checklist is the operator-side defense-in-depth.

---

## J. Safe logging / diagnostics

- The publish **CLI may log** registered / skipped status and the guild
  ID to the operator terminal (it already does — see
  `apps/bot/scripts/publish-commands.ts`).
- **Do not** paste logs containing tokens or raw IDs into public issues
  or chats.
- The bot runtime should **not** log raw harness input, the raw Phase
  38A matrix, `operator_dev` diagnostics, tokens, actor IDs,
  operational IDs (`session_id`, `message_id`, `tenant_id`,
  `community_id`, `session_thread_id`, and camelCase aliases), Discord
  message IDs, channel IDs, guild IDs, or user IDs — unless a
  redacted / hashed form is explicitly documented and tested (Phase 39A
  §K). The Phase 39B handler intentionally adds no such logging.
- **User-visible errors remain generic** — the single stable refusal
  string; never a stack trace, env-gate name, or banned-substring
  reason.

---

## K. Disable procedure

### K.1 Disable invocation (immediate, no redeploy required for the flag)

- Set `RECALL_WEDGE_DISCORD_DEMO_ENABLED` to anything other than the
  exact string `"true"` (including unsetting it).
- Optionally also remove / blank
  `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS` (an empty allowlist
  fails closed on its own).
- Restart / redeploy the bot only if the runtime needs to pick up the
  env change.
- **Expected result:** the command may still **appear** in the guild if
  it is still registered, but **every invocation returns the generic
  ephemeral refusal**. No harness output is rendered.

### K.2 Disable registration (future publishes)

- Set `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` to anything other
  than the exact string `"true"`.
- **Expected result:** future publish runs will **not** register or
  update the demo command. (This does not remove an
  already-registered command — see §L.)

---

## L. Removal / de-registration procedure

There is **no dedicated de-registration helper** in this repo for
`/recall-wedge-demo`. `registerRecallWedgeDemoCommand` only registers
(POST to the guild commands route); it does not delete. Do not claim a
removal helper exists.

Because the command is **guild-scoped only**, removing it from the one
configured guild removes it entirely. Safe removal options:

- **Discord Developer Portal / client** — remove the guild command for
  the configured guild through the Discord UI, if available to the
  operator.
- **Scoped Discord API delete** — issue a `DELETE` against the specific
  guild command ID. Use **placeholders only** and never paste a real
  token into docs or chats:

  ```bash
  # Placeholders only. Do NOT paste a real bot token anywhere shareable.
  curl -X DELETE \
    -H "Authorization: Bot <bot-token>" \
    "https://discord.com/api/v10/applications/<app-id>/guilds/<guild-id>/commands/<command-id>"
  ```

  (Phase 39D adds no script for this — the curl above is documentation
  only.)
- **Revert the Phase 39B / 39C commits** — if env-disable plus
  de-registration is not sufficient (e.g. a concern about the code
  path itself), revert the implementing commits.

**No data migration is needed.** Phase 39B / 39C create no persisted
memory, candidate memory, storage row, or admission record, so removal
is code / registration only.

---

## M. Operator acceptance checklist

### Before registration

- [ ] Main includes PR #131 (handler + guild-scoped registration gate).
- [ ] Correct single guild ID identified.
- [ ] Correct operator ID(s) identified.
- [ ] Token / env values are not pasted into logs, PRs, or chats.
- [ ] Registration env set **only** for the intended publish run.

### After registration

- [ ] Command appears **only** in the configured guild.
- [ ] **No** global command registration.
- [ ] Publish logs show the demo command registered (or skipped) as
      expected.

### Before invocation

- [ ] Invocation env set (`ENABLED="true"`, matching `GUILD_ID`).
- [ ] Operator allowlist set (`OPERATOR_USER_IDS`).
- [ ] Bot runtime restarted / redeployed if needed to pick up env.

### After invocation

- [ ] Success response is ephemeral.
- [ ] Disabled / wrong-guild / non-operator generic refusal tested.
- [ ] `served` and `denied` cases tested.
- [ ] No screenshots / logs leak raw IDs or tokens.
- [ ] No production auth / consent / memory claim made.

### Rollback

- [ ] Invocation disabled (§K.1).
- [ ] Registration disabled (§K.2).
- [ ] Command manually removed if required (§L).

---

## N. Validation evidence

Known validation recorded at Phase 39C merge (the implementation this
runbook accepts for controlled testing). Phase 39D itself runs the
docs-side validation in its own report; the figures below are the
implementation evidence carried forward:

- fixture validator: **122 passed, 0 failed**;
- Phase 39C Discord demo registration tests: **116 passed, 0 failed,
  339 expect() calls**;
- Phase 38A harness regression: **52 passed, 0 failed, 806 expect()
  calls**;
- Phase 37C live client / runner regressions: **104 passed, 0 failed,
  437 expect() calls**;
- recorded Dixie regressions: **215 passed, 0 failed, 700 expect()
  calls**;
- public renderer regressions: **30 passed, 0 failed, 77 expect()
  calls**;
- `apps/bot` typecheck: known dirty baseline **151 errors**, with **no
  Phase 39C `recall-wedge-demo` / harness TS6059 `rootDir`
  references**;
- Codex audit: **ACCEPT**.

---

## O. Acceptance criteria for Phase 39D

Phase 39D is acceptable if:

- the **runbook is added** (this file);
- the **decision map is updated** with a targeted Phase 39D addendum;
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no registration or handler behavior changes** are made;
- the runbook **preserves the dev-only / guild-only / operator-only /
  ephemeral / harness-only posture**;
- the runbook documents **registration, invocation, fail-closed tests,
  disable, removal, and the no-claim posture**.

---

## P. Cross-references

- `docs/RECALL-WEDGE-DISCORD-SURFACE-DECISION-GATE.md` — Phase 39A
  decision gate; the authority this runbook operationalizes without
  expanding.
- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase 38B
  acceptance of the Phase 38A harness backing the rendered output.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option
  matrix; gains a Phase 39D addendum.
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  handler and env gates.
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` —
  Phase 39B regression / static-guard tests.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeDemoCommand` (guild-scoped-only registration).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `/recall-wedge-demo` to the handler.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — Phase 38A harness; the only data path the demo renders from.
