# Recall Wedge — Live Dixie Discord Demo Operational Runbook

> **Phase 41C** (docs / operational runbook only). Companion to
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` (Phase 41A
> decision gate, which selected the separate-command shape),
> `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate),
> `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` (Phase 39D
> operational runbook for the harness demo),
> `docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` (Phase 40B internal
> demo guide for the harness demo),
> `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` (Phase 39E
> harness-demo smoke-test acceptance — the template for a later live
> acceptance), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix).
>
> This document is the **operator runbook** for safely configuring,
> registering, invoking, fail-closed-testing, disabling, removing, and
> capturing evidence for the `/recall-wedge-live-demo` command that
> **Phase 41B implemented** (PR #137). It does **not** add or authorize
> new code, and it does **not** itself record smoke-test acceptance.
>
> It uses **redacted placeholders only**. No real Discord IDs, command
> IDs, app IDs, user IDs, tokens, tenant identifiers, caller actor
> identifiers, request-key prefixes, screenshots, or images appear here,
> and none should be added. If a step in this runbook seems to require
> reaching past a Phase 41A / 41B boundary, the answer is to stop and
> re-open the gate that owns it — not to relax it from this runbook.

---

> ## Phase ladder reconciliation (read first)
>
> The Phase 41A gate doc's §N was written before Phase 41B landed and
> calls the future smoke-test acceptance "Phase 41C." The ladder has
> since advanced one slot:
>
> - **Phase 41A** — live-Dixie Discord decision gate (merged).
> - **Phase 41B** — `/recall-wedge-live-demo` implementation (merged, PR
>   #137).
> - **Phase 41C** — *this* operational runbook (docs-only).
> - **Phase 41D** — the **future** smoke-test acceptance report, after a
>   human operator runs the controlled live Discord / Dixie test.
>
> So where Phase 41A §N says "Phase 41C smoke-test acceptance," read
> **Phase 41D**. This runbook is the operator procedure that precedes
> that acceptance; it is not the acceptance.

---

## A. Status and scope

Phase 41C is **docs / operational runbook only**.

- Phase 41C **follows the Phase 41B implementation** (the
  `/recall-wedge-live-demo` command, merged via PR #137).
- It **does not change `/recall-wedge-live-demo`** (handler,
  registration, dispatch, render path, or tests).
- It **does not change `/recall-wedge-demo`** (the harness demo).
- It **does not add runtime behavior.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 41C.
- It **does not authorize production rollout.**
- It **does not authorize public channel-visible recall.**
- It **does not authorize** memory admission, candidate-memory writes,
  "remember this," Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, or public
  renderer expansion.
- It **prepares the controlled operator procedure** for a later **Phase
  41D** smoke-test acceptance.

### A.1 Decision / status sentence

**Phase 41C makes `/recall-wedge-live-demo` operationally testable by
documenting the controlled setup, registration, invocation, fail-closed,
disable, and evidence-capture procedure; it does not itself record
smoke-test acceptance or authorize production use.**

This runbook is conditional on every boundary restated in §N (pass /
fail) and §S (blocked work). Writing how to test the live demo safely
does not expand what the demo is allowed to do — everything Phase 39A /
39D / 39E / 40A / 40B / 41A blocked stays blocked here.

---

## B. Source evidence

This runbook is grounded in the following artifacts. **These source /
test files are evidence only; Phase 41C modifies none of them.**

Decision-doc / runbook evidence:

- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; selected the separate `/recall-wedge-live-demo`
  command, its gates (§G), input boundary (§H), output boundary (§I),
  lazy-load boundary (§J), and logging boundary (§K). Gains a Phase 41C
  note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config (§G) and classification
  vocabulary (§I). Gains a tiny Phase 41C cross-reference.
- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook for the **harness** demo; the register / enable /
  invoke / disable / remove pattern this runbook mirrors for the live
  command.
- `docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` — Phase 40B internal
  demo guide for the **harness** demo; remains separate from this
  runbook.
- `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  harness-demo smoke-test acceptance; the redacted-evidence template a
  later Phase 41D should follow.

Source / test evidence (read only; **Phase 41C modifies none of
these**):

- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  Phase 41B live command handler. Source of the env gate helpers
  (`shouldEnableRecallWedgeLiveDiscordDemo`,
  `shouldRegisterRecallWedgeLiveDiscordDemo`,
  `resolveRecallWedgeLiveDiscordDemoGuildId`,
  `parseRecallWedgeLiveDiscordDemoOperatorIds`,
  `isRecallWedgeLiveDiscordDemoAllowedGuild`,
  `isRecallWedgeLiveDiscordDemoOperator`), the fixed deterministic input
  (`RECALL_WEDGE_LIVE_DEMO_FIXED_INPUT`), the lazy live-client loader, the
  classification → render decision, the single generic refusal string
  (`recall-wedge-live-demo is not available here.`), the ephemeral-only
  response builder, and the final banned-substring no-leak scan.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests (fail-closed paths,
  no-options, ephemeral-only, no-leak, no-memory-admission, lazy-load).
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the Phase
  39B **harness** demo handler; harness-backed, never imports the live
  client. Confirms the two commands are distinct.
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C harness-demo regression / static-guard tests.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `recall-wedge-demo` and `recall-wedge-live-demo` as **distinct**
  command names, with bot-author and webhook-author drop guards.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeLiveDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global) and the separate
  `registerRecallWedgeDemoCommand` for the harness command.
- `apps/bot/scripts/publish-commands.ts` — the publish CLI entry point;
  publishes character commands, then the harness demo, then the live
  demo (each behind its own gate).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  Phase 37C operator/dev-only live Dixie client; its env config, the
  `POST /api/recall/intake` route, the classification vocabulary, the
  idempotency-key behavior, and the exported banned-substring helper.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  — the Phase 37C operator/dev-only runner (separate CLI path; not the
  Discord command path).
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`
  — Phase 37C runner regression tests.

State clearly:

- these source / test files are **evidence only**;
- **Phase 41C modifies none of them**;
- Phase 41C introduces no new source, test, fixture, package, lockfile,
  config, CI, or generated file.

---

## C. Command inventory — two separate commands, never conflated

There are **two distinct Recall Wedge demo commands**. They have
separate names, separate handlers, separate env gates, and separate
registration paths. **They must not be conflated.**

### C.1 `/recall-wedge-demo` (harness demo · Phase 39B / 39C)

- **harness-backed** — renders the Phase 38A multi-surface harness from a
  fixed fixture;
- **controlled dev / operator demo**;
- **guild-scoped** registration only;
- **operator-gated** invocation only;
- **ephemeral** responses only;
- **no live Dixie** — provably never imports the Phase 37C live client.

Governed by the Phase 39D runbook
(`docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`) and the Phase
40B internal guide. Its env gates are `RECALL_WEDGE_DISCORD_DEMO_*`.
**This runbook does not change it.**

### C.2 `/recall-wedge-live-demo` (live demo · Phase 41B)

- **live Dixie dev / operator demo** — calls the Phase 37C live client
  after gates pass;
- **separate command** — does not alias, mutate, or replace the harness
  demo;
- **disabled by default**;
- **guild-scoped** registration only;
- **operator-gated** invocation only;
- **ephemeral** responses only;
- **fixed input only** — a code-reviewed synthetic operator/dev probe;
- **no command options** — the registration payload's `options` is `[]`;
- **no freeform query** — no interaction option is read;
- **no Discord history** — no message / channel content is read;
- **no memory admission** — no candidate write, no "remember this";
- **Phase 37C live Dixie client loaded only after the Discord gates
  pass** (lazy dynamic import on the fully-gated path).

Governed by *this* runbook. Its env gates are
`RECALL_WEDGE_LIVE_DISCORD_DEMO_*`.

### C.3 They must not be conflated

- The harness demo is **fixture proof**; the live demo is **live producer
  proof**. Keeping two names keeps those visibly distinct.
- The two commands have **independent gates** — enabling, registering, or
  disabling one never affects the other.
- `dispatch.ts` routes them as distinct command names. Do not describe
  the harness demo as a live demo or vice versa, and do not use the
  Phase 39D / 40B harness docs as the live-demo procedure (see §S).

---

## D. Environment variable inventory

**Placeholders only.** Do not include real values anywhere — not in
chat, PRs, docs, screenshots, logs, or issue comments.

### D.1 Discord registration gates (live command, publish-time)

- `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS` — must be the exact
  string `"true"` or the live command is not registered.
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID` — the single guild the live
  command is registered to. Missing / blank → not registered (no global
  fallback).

### D.2 Discord invocation gates (live command, bot runtime)

- `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED` — must be the exact string
  `"true"` or every invocation fails closed.
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID` — must match
  `interaction.guild_id` or the invocation fails closed (use the same
  guild ID as registration).
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS` — comma-separated
  allowlist of operator Discord user IDs; the invoker must be in it or
  the invocation fails closed (an empty allowlist fails closed).

### D.3 Discord bot / app env

- `DISCORD_BOT_TOKEN` — the existing shell bot token. Required by the
  publish CLI and the bot runtime.
- `DISCORD_APPLICATION_ID` — **optional**; the publish CLI derives it
  from `/applications/@me` using the bot token if unset.

### D.4 Phase 37C live Dixie client env / config (bot runtime)

Read by the Phase 37C client, **not** by the Discord command directly —
the command only reaches the client after the Discord gates pass.

- `RECALL_WEDGE_DIXIE_BASE_URL` — base URL of the Dixie deployment.
  Required.
- `RECALL_WEDGE_DIXIE_SERVICE_TOKEN` — service authentication material.
  Required. **Secret.**
- `RECALL_WEDGE_DIXIE_TENANT_ID` — tenant / community / estate scope.
  Required.
- `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID` — operator-provided caller /
  end-user identifier. Required.
- `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX` — prefix used when generating
  `Idempotency-Key` values. Required.
- `RECALL_WEDGE_DIXIE_TIMEOUT_MS` — **optional** per-request HTTP timeout
  (the client defaults conservatively if unset).

### D.5 Redaction rules (binding)

- **Do not** paste secrets into chat, PRs, docs, screenshots, logs, or
  issue comments.
- **Do not** record the raw bot token, service token, guild ID, app ID,
  command ID, user ID, tenant ID, caller actor ID, or request-key prefix
  in docs.
- Use placeholders only:
  - `<DEV_GUILD_ID>`
  - `<OPERATOR_USER_ID>`
  - `<DISCORD_APPLICATION_ID>`
  - `<DIXIE_BASE_URL>`
  - `<DIXIE_TENANT_ID_REDACTED>`
  - `<DIXIE_CALLER_ACTOR_ID_REDACTED>`
  - `<REQUEST_KEY_PREFIX_REDACTED>`

### D.6 Env semantics (binding)

- The enable / register values must be the **exact lowercase string
  `"true"`**. `TRUE`, `True`, `1`, `yes`, and any whitespace variant
  (e.g. `" true"`) all fail closed.
- A **missing guild ID fails closed** at both registration and
  invocation; registration never falls back to global.
- An **empty (or unset) operator allowlist fails closed** at invocation.
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS` controls
  **registration only**; `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`
  controls **invocation only**. Neither controls the other.
- The live command's `RECALL_WEDGE_LIVE_DISCORD_DEMO_*` gates are
  **separate** from the harness command's `RECALL_WEDGE_DISCORD_DEMO_*`
  gates and never reuse them.

---

## E. Preflight checklist

Before doing anything in §F–§L:

- [ ] Local repo on `main` and up to date.
- [ ] PR #137 merged (the Phase 41B implementation).
- [ ] `/recall-wedge-live-demo` source / test present
      (`apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` and
      `.test.ts`).
- [ ] Live command **disabled by default**
      (`RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED` not set to `"true"` until
      you intend to test).
- [ ] Correct Discord **application** selected (the same shell bot).
- [ ] Correct **dev guild** selected (an internal / low-risk server).
- [ ] **Operator user ID verified** for the account that will invoke.
- [ ] **Bot is installed** in the dev guild.
- [ ] **Railway / runtime env access** available to set invocation env.
- [ ] **Phase 37C Dixie service credentials** available to the operator
      (out-of-tree secret store; never committed).
- [ ] **No public channel demo planned.**
- [ ] **No screenshots will be committed.**
- [ ] **A non-operator account is available** if testing fail-closed
      (§K).
- [ ] **Rollback / disable path understood** before registration (§O).

---

## F. Local validation before the live test

Run these from the repo root. They are safe and offline (no live Dixie
call). Do not run broad unrelated suites.

```bash
git switch main
git pull --ff-only origin main
node docs/recall-wedge/fixtures/validate-fixtures.mjs
bun test apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts
bun test apps/bot/src/discord-interactions/recall-wedge-demo.test.ts
bun test packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts
# optional regression:
bun test packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts
```

Expected latest known passing shape (carried forward; re-confirm
locally):

- fixture validator: **122 passed / 0 failed**;
- live demo tests: **134 passed / 0 failed / 530 expect() calls**;
- harness demo regression: **116 passed / 0 failed / 339 expect()
  calls**;
- live Dixie client + runner regressions: **104 passed / 0 failed / 437
  expect() calls**;
- harness regression (optional): **52 passed / 0 failed / 806 expect()
  calls**.

If any figure diverges, stop and investigate before the live test — do
not register or invoke against a failing local baseline.

---

## G. Local redacted Discord token / app preflight

A safe operator procedure to confirm credentials **without printing any
value**. Run privately; print only `present`, `OK`, `matches yes/NO`, and
redacted-present markers. **Never print the token or any raw ID.**

1. **Confirm env presence** (prints only `present` / `MISSING`):

   ```bash
   # prints "present" or "MISSING", never the value
   [ -n "$DISCORD_BOT_TOKEN" ] && echo "DISCORD_BOT_TOKEN: present" || echo "DISCORD_BOT_TOKEN: MISSING"
   [ -n "$DISCORD_APPLICATION_ID" ] && echo "DISCORD_APPLICATION_ID: present" || echo "DISCORD_APPLICATION_ID: (optional, unset)"
   ```

2. **Confirm the bot token is valid** (prints only `OK` / `FAIL`, never
   the body):

   ```bash
   # prints "users/@me: OK" or "users/@me: FAIL" — no IDs, no token
   curl -s -o /dev/null -w "%{http_code}" \
     -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
     https://discord.com/api/v10/users/@me \
     | grep -q '^200$' && echo "users/@me: OK" || echo "users/@me: FAIL"
   ```

3. **Verify the app matches** if `DISCORD_APPLICATION_ID` is provided
   (prints only `matches yes/NO`, never the ID):

   ```bash
   # compares the running bot's application id to the provided one,
   # printing only "app match: yes" / "app match: NO" — never the id
   APP_FROM_API=$(curl -s -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
     https://discord.com/api/v10/oauth2/applications/@me \
     | sed -n 's/.*"id":"\([0-9]*\)".*/\1/p' | head -n1)
   if [ -n "$DISCORD_APPLICATION_ID" ]; then
     [ "$APP_FROM_API" = "$DISCORD_APPLICATION_ID" ] \
       && echo "app match: yes" || echo "app match: NO"
   else
     echo "app match: skipped (DISCORD_APPLICATION_ID unset; derived at publish)"
   fi
   ```

Rules:

- **Do not print** the token.
- **Do not paste** raw IDs into docs. The snippets above are written to
  emit only status words; keep them that way.

---

## H. Register `/recall-wedge-live-demo` to the dev guild

Registration runs through the existing publish CLI (Phase 41C adds no
script). Use placeholder env values only.

1. **Confirm the deploy source is merged main after PR #137.** The live
   handler (Phase 41B) and the guild-scoped live registration gate must
   both be present.
2. **Set the required local / shell env** for this one publish run:
   - `DISCORD_BOT_TOKEN` — the shell bot token;
   - `DISCORD_APPLICATION_ID` — optional (derived from the token if
     unset);
   - `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS=true` — exact
     `"true"` only;
   - `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID=<DEV_GUILD_ID>` — required;
     missing / blank fails closed with **no global fallback**.
3. **Run the publish command:**

   ```bash
   DISCORD_BOT_TOKEN=<bot-token> \
   DISCORD_APPLICATION_ID=<DISCORD_APPLICATION_ID> \
   RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS=true \
   RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID=<DEV_GUILD_ID> \
     bun run apps/bot/scripts/publish-commands.ts
   ```

   The script publishes the normal character command set first, then the
   harness demo (only if **its** `RECALL_WEDGE_DISCORD_DEMO_*` gates are
   set), then the live demo. The live registration is a separate
   guild-scoped POST — it is not part of the global command set and can
   never reach the global route.
4. **Expected redacted output shapes:**
   - registered:
     `publish-commands: registered dev-only /recall-wedge-live-demo → guild [redacted] (id [redacted])`
   - gate not set to exact `"true"`:
     `publish-commands: /recall-wedge-live-demo NOT registered (gate_disabled)`
   - guild ID missing / blank:
     `publish-commands: /recall-wedge-live-demo NOT registered (no_guild)`
   - **never** a global registration of the live command.
5. **Verify scope.** Confirm `/recall-wedge-live-demo` appears **only in
   the configured guild** (via the Discord client or the guild commands
   API for `<DEV_GUILD_ID>`), and not as a global command. **Do not
   record raw command / guild / app IDs** when noting the result.

---

## I. Configure Railway / runtime invocation env

Set these on the running bot environment (Railway or the running
process). **Placeholders only — never real values.**

Discord live command gates:

- `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED=true`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID=<DEV_GUILD_ID>`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS=<OPERATOR_USER_ID>`

Phase 37C Dixie env:

- `RECALL_WEDGE_DIXIE_BASE_URL=<DIXIE_BASE_URL>`
- `RECALL_WEDGE_DIXIE_SERVICE_TOKEN=<SECRET>`
- `RECALL_WEDGE_DIXIE_TENANT_ID=<DIXIE_TENANT_ID_REDACTED>`
- `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID=<DIXIE_CALLER_ACTOR_ID_REDACTED>`
- `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX=<REQUEST_KEY_PREFIX_REDACTED>`
- `RECALL_WEDGE_DIXIE_TIMEOUT_MS=<OPTIONAL_TIMEOUT_MS>`

Notes:

- **After env changes, redeploy / restart the bot** so the runtime picks
  them up.
- The command **refuses (generic ephemeral refusal) if the Discord gates
  are missing** — before any client load or network call.
- If the **Dixie env is missing / invalid**, the command returns a
  **safe classified config summary** (`missing_required_env` /
  `invalid_config`, with no env names or values) or the generic refusal —
  never an env name, value, or raw error.
- **Do not expose env values** in screenshots or logs.

---

## J. Invoke `/recall-wedge-live-demo` as an allowlisted operator

- In the **configured dev guild only**.
- From the **allowlisted operator account**.
- Run: `/recall-wedge-live-demo`
- **No options** — there is nowhere to type a memory / query / private
  context, and none is read.
- The response is **ephemeral** (only the operator sees it).

### J.1 Expected safe output categories

**1. served / safe live summary.** The fixed dev-only framing plus a
narrowed summary:

```
recall-wedge-live-demo · live Dixie dev demo (not production recall)
gated · operator-only · ephemeral · phase 37c live Dixie client output

classification: served
outcome:        served
route:          /api/recall/intake
reason:         <stable reason code>
```

- live Dixie dev framing (explicitly "not production recall");
- `classification: served`;
- `route: /api/recall/intake`;
- a stable reason code (classifier-controlled, not raw upstream text).

**2. safe refusal / classification.** A narrowed, public-safe summary for
any of these classifications (same framing + `classification` / `outcome`
/ `route` / `reason` lines):

- `denied_or_forbidden`
- `needs_review`
- `ingress_invalid_request`
- `service_unauthorized`
- `tenant_or_session_mismatch`
- `rate_limited`
- `upstream_unavailable`
- `missing_required_env`
- `invalid_config`

with **no raw env names / values**, no raw Dixie payload, and no raw
error. (For the two config classes, the reason is forced to the bare
class name so an env name can never ride along.)

**3. generic refusal.** Acceptable for unsafe / network / unsupported /
no-leak / client-failure paths:

```
recall-wedge-live-demo is not available here.
```

### J.2 What must fail closed to the generic refusal

- `unsupported_response_shape`
- `network_error`
- `unsafe_idempotency_key_reuse`
- any unknown / unclassified outcome
- a thrown live client or a failed lazy load
- any banned-substring (contaminated output) hit on the final content

These never render a summary — they collapse to the single generic
ephemeral refusal.

---

## K. Non-operator fail-closed test

- From a **different Discord account not in the operator allowlist**, in
  the configured guild, run: `/recall-wedge-live-demo`
- **Expected:** `recall-wedge-live-demo is not available here.`
- **ephemeral only**;
- **no live Dixie output**;
- **no safe summary**;
- **no raw IDs / secrets**;
- **no indication of which gate failed** (the refusal is identical for
  disabled / wrong-guild / non-operator / empty-allowlist).

A non-operator must never reach the live client — the gates are evaluated
before any client load or network egress.

---

## L. Optional disabled-gate test

- Set `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED` away from the exact string
  `"true"` (e.g. unset it, or `false`).
- **Redeploy / restart** the bot.
- As the operator, invoke: `/recall-wedge-live-demo`
- **Expected:** the generic ephemeral refusal
  (`recall-wedge-live-demo is not available here.`), with no client load
  and no network call.
- **Restore the env only if continuing the test.**

---

## M. Evidence capture for the future Phase 41D

Record (redacted only):

- registration command present in configured guild: **yes / no**;
- global registration observed: **no** (must be no);
- operator invocation result category: **served / safe refusal / generic
  refusal**;
- response ephemeral: **yes / no**;
- non-operator refusal passed: **yes / no**;
- no raw IDs / tokens / private fields visible: **yes / no**;
- no memory admission language: **yes / no**;
- no production auth / consent claim: **yes / no**;
- no public channel-visible output: **yes / no**.

Do **not** record:

- raw Discord token;
- raw service token;
- raw guild ID;
- raw app ID;
- raw command ID;
- raw user ID;
- raw tenant ID;
- raw caller actor ID;
- raw request-key prefix;
- screenshots / images / binary evidence;
- raw Dixie payload;
- raw error body;
- headers;
- request body.

These observations are the redacted inputs to a later Phase 41D
acceptance report — **Phase 41C does not record acceptance.**

---

## N. Pass / fail criteria

**Pass if:**

- local validation passes (§F);
- the command is registered **only in the configured guild**;
- the command is **not observed globally**;
- an allowlisted operator gets **ephemeral safe output** (served / safe
  refusal) **or** the generic fail-closed output;
- a non-operator gets the **generic ephemeral refusal**;
- **no raw IDs / tokens / private fields / operator diagnostics / raw
  Dixie payload** are visible;
- **no freeform query path** is present;
- **no Discord history input** is read;
- **no memory admission** occurs;
- **no production auth / consent claim** is made;
- **no public-channel-visible output** is produced.

**Fail if:**

- the command registers globally;
- the command appears in the wrong guild;
- a non-operator gets a live summary;
- the response is public channel-visible;
- output leaks a raw Dixie payload or raw error;
- output leaks env names / values, tokens, IDs, tenant / caller
  identifiers, headers, request body, or stack traces;
- output claims production recall, memory admission, consent, or public
  launch;
- the command accepts freeform input or reads Discord history.

If any fail condition appears, stop, do not screenshot, disable
invocation (§O), and triage (§P).

---

## O. Disable / rollback / removal

- **Disable invocation** — set
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED` away from the exact string
  `"true"` and redeploy / restart. Every invocation then returns the
  generic ephemeral refusal.
- **Stop future registration** — set
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS` away from the exact
  string `"true"`. Future publishes will not register or update the live
  command (this does not remove an already-registered command).
- **Remove the command manually** — because the live command is
  guild-scoped only, removing it from the one configured guild removes it
  entirely. Use the Discord Developer Portal / client, or a scoped
  `DELETE` against the specific guild command ID. **Placeholders only;
  never paste a real token into docs or chats:**

  ```bash
  # Placeholders only. Do NOT paste a real bot token anywhere shareable.
  curl -X DELETE \
    -H "Authorization: Bot <bot-token>" \
    "https://discord.com/api/v10/applications/<DISCORD_APPLICATION_ID>/guilds/<DEV_GUILD_ID>/commands/<command-id>"
  ```

  (Phase 41C adds no script for this — the curl above is documentation
  only.)
- **Do not remove `/recall-wedge-demo`** unless separately intended — the
  harness demo is a distinct command with distinct gates.
- **Rotate tokens immediately** if any secret was exposed (bot token,
  service token).
- **No data migration is required** — the live command admits no memory
  and writes no storage, so removal is registration / config only.

---

## P. Troubleshooting

Concise triage. Keep secrets and raw IDs out of chat and docs throughout.

- **Command does not appear** — likely not registered in the configured
  guild, or you are in the wrong guild. Re-run §H with the exact
  `"true"` register gate and correct `<DEV_GUILD_ID>`; guild commands can
  take a moment to appear.
- **Command appears but operator gets a generic refusal** — an invocation
  gate is failing closed. Check `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`
  is the exact `"true"`, `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID` matches
  the guild, and the operator's ID is in
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`. The refusal is
  intentionally generic.
  - **Phase 42B safe diagnostic (operator logs only).** To see *which*
    pre-Dixie gate tripped without changing the generic refusal, read the
    runtime's operator log for the single line
    `interactions: recall-wedge-live-demo pre-dixie gate refusal · …`. It
    carries **booleans + a stable reason code only** — `enabled_gate`,
    `guild_gate`, `operator_gate`, `has_configured_guild`,
    `has_interaction_guild`, `has_operator_allowlist`, `has_invoker_id`,
    and `refusal_code` (one of `disabled` / `missing_or_wrong_guild` /
    `empty_allowlist` / `non_operator` / `missing_invoker` /
    `unknown_gate_refusal`). It logs **no** guild / user / channel /
    command IDs, **no** operator allowlist contents, **no** tokens, **no**
    Dixie URL / token, **no** env names or values, and **no** raw
    interaction / Dixie payload or stack trace. Map the code:
    `disabled` → fix the enable flag (exact `"true"`);
    `missing_or_wrong_guild` → fix the configured / interaction guild
    (see `has_configured_guild` vs `has_interaction_guild` to tell which
    side is missing); `empty_allowlist` → set the operator allowlist;
    `non_operator` → the invoker is not allowlisted; `missing_invoker` →
    no invoker id was present on the interaction. The Discord-facing
    refusal stays the single generic string regardless.
- **Command appears but returns a safe config summary** — the Discord
  gates passed but the Dixie env is missing / invalid. Set / fix the
  `RECALL_WEDGE_DIXIE_*` env (§D.4 / §I) and redeploy. The summary names
  no env, by design.
- **Command returns a generic refusal after gates pass** — likely an
  `unsupported_response_shape` / `network_error` /
  `unsafe_idempotency_key_reuse` / unknown classification, a thrown
  client, a failed lazy load, or a no-leak-scan hit. Check Dixie
  reachability and the `RECALL_WEDGE_DIXIE_*` config; the refusal does
  not reveal which.
- **Command registered under the wrong app** — if published with a
  different application's token / app ID than the running bot, the
  running bot will not own it. Re-publish (§H) with the correct
  application and remove the stray registration (§O).
- **Bot token auth fails** — `users/@me` returns non-200 (§G). The token
  is wrong / expired; fix the env and re-run.
- **Application ID mismatch** — §G's app-match check prints `NO`. The
  provided `DISCORD_APPLICATION_ID` does not match the running bot's
  app; unset it (let the CLI derive it) or correct it.
- **Railway env not restarted** — env changes only take effect after the
  runtime picks them up. Redeploy / restart and re-test.
- **Dixie base URL invalid** — likely surfaces as `invalid_config` (safe
  summary) or a generic refusal. Fix `RECALL_WEDGE_DIXIE_BASE_URL`.
- **Dixie service token invalid** — likely `service_unauthorized` (safe
  summary). Fix `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`; rotate if exposed.
- **Tenant / caller mismatch** — likely `tenant_or_session_mismatch`
  (safe summary). Confirm `RECALL_WEDGE_DIXIE_TENANT_ID` /
  `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID` are the intended scope.
- **Rate limited / guard cap** — likely `rate_limited` (safe summary).
  Wait and retry; do not loop-invoke.
- **Non-operator gets output** — this is a **fail** (§N). Disable
  invocation immediately (§O) and check the operator allowlist.
- **Output not ephemeral** — this is a **fail** (§N). Every path is
  ephemeral, so a non-ephemeral message means a different command /
  surface produced it. Stop and confirm what was invoked.
- **Suspected leak** — treat as a **fail**. Stop, do not screenshot,
  disable invocation (§O), and rotate any exposed secret. Capture only a
  redacted note for Phase 41D.

---

## Q. Operator redaction rules

- **Never paste secrets** into ChatGPT, Claude, Codex, GitHub, PRs,
  issues, logs, docs, screenshots, or Discord screenshots.
- When describing status, print only **`present`**, **`OK`**,
  **`matches yes/no`**, **redacted-present** markers, and the
  **placeholders** from §D.5.
- **Raw IDs must be redacted** in any written report (guild, app,
  command, user, tenant, caller actor IDs; request-key prefix).
- **Screenshots should not be committed.** Ideally do not take them; if
  needed for private debugging, keep them out of the repo and redact
  before sharing.

---

## R. Future Phase 41D smoke-test acceptance

- **Phase 41D should happen only after a controlled live run** of this
  procedure.
- Phase 41D should be a **docs-only smoke-test acceptance report**
  (similar to the Phase 39E harness-demo acceptance).
- It should **record redacted operator observations** (the §M evidence).
- It should **state what passed / failed** (against §N).
- It should **not include** screenshots / raw IDs / secrets.
- It should **not authorize** public rollout, memory admission,
  public-channel-visible recall, Telegram / private chat, LLM / voice, or
  production auth / consent.

> ### Phase 41D acceptance note — done (2026-05-30)
>
> Added by Phase 41D
> (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`).
>
> - **A controlled live run of this procedure has occurred and is
>   accepted.** A human operator deployed Dixie live (Railway, healthy
>   service + Postgres, `GET /api/health` → 200), wired the **Freeside
>   Characters** service with the live Dixie env (§D / §I), registered
>   `/recall-wedge-live-demo` to the configured guild, and invoked it as
>   an allowlisted operator.
> - **The live path reached the Dixie `/api/recall/intake` seam and
>   fail-closed safely.** The authenticated intake returned
>   `seam.storage_unavailable` (unseeded live estate / storage); the
>   command classified it as `upstream_unavailable` and rendered the
>   ephemeral §J.1 category-2 safe summary — **no `raw_reasons`, no raw
>   payload, no bounded-store scope, no tenant / debug / JWT / token /
>   stack-trace / private-ID exposure.**
> - **Accepted scope: safe live wiring + fail-closed rendering, not
>   served recall.** Served recall is blocked on the unseeded estate /
>   storage state (acceptance §J). The run claims no production rollout,
>   no public recall, no served memory, no healthy Finn integration
>   (Finn was intentionally unreachable), and no cross-user auth /
>   consent.
> - **The two operational caveats in §R.1 below were load-bearing in the
>   run:** the startup auto-publish path can erase the dev-only live
>   command (register after restart, do not restart before invocation),
>   and the manually minted Dixie JWT is short-lived (refresh + restart
>   if expired). They are now confirmed against a real run, not just
>   anticipated.
> - **This runbook still records no acceptance itself** — the acceptance
>   lives in the Phase 41D report; this note only points to it.

### R.1 Operational caveats confirmed by the Phase 41D run

The Phase 41D run confirmed two operational caveats are load-bearing.
Restated together here for anyone repeating the smoke test:

- **R.1.a — startup auto-publish can remove the dev-only live command.**
  The startup auto-publish path bulk-syncs the normal command set and
  **can remove `/recall-wedge-live-demo`** from the configured guild —
  this is a newly-surfaced caveat from the Phase 41D run, not previously
  called out in this runbook. For smoke: **register the live command
  after the restart (§H), and do not restart Freeside Characters again
  before invocation.** In the Phase 41D run the command was manually
  re-registered after restart for exactly this reason.
- **R.1.b — the manually minted Dixie JWT is short-lived.** The service
  token / JWT used to reach the seam (the `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`
  material in §D.4 / §I) is short-lived and manually minted. **Before
  repeating the smoke test, refresh the token and restart Freeside
  Characters if it has expired.** An expired token surfaces as a safe
  classification (e.g. `service_unauthorized`) or the generic refusal —
  never a leak — but it will not exercise the seam reach. Disable /
  rotation handling is in §O.

### R.2 Phase 42A note — seeded live estate is the next MVP need; both §R.1 caveats are secondary

> Added by Phase 42A
> (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`), 2026-05-30.

- **Phase 42A is docs / decision gate only.** It changes nothing in this
  runbook's procedure and authorizes no code. A future served-recall
  smoke would reuse §F–§N of this runbook unchanged.
- **Phase 42A ranks a seeded dev/operator live estate / storage fixture
  as the next MVP need** — the only lane that moves the Phase 41D result
  from safe live failure to a safe served live recall. The two §R.1
  caveats are **operational irritants, ranked below seeding**:
  service-token hardening (§R.1.b) is secondary and only if it becomes a
  hard blocker for repeated smoke; command-registration hardening
  (§R.1.a, the startup-auto-publish erasure) is third. Both stay behind
  their own separate decisions.
- **Public rollout, production memory admission, served memory as a
  capability, and everything in §S remain blocked.** Seeded live memory,
  if a future phase implements it, must be a reviewed operator/dev
  fixture — not Discord history ingestion, not "remember this," not
  candidate-memory admission.

### R.3 Phase 42D note — this procedure produced a served seeded recall; accepted as a controlled dev/operator proof

> Added by Phase 42D
> (`docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`),
> 2026-05-31.

- **A controlled seeded run of this procedure has occurred and is
  accepted (docs-only).** After the Dixie-side seeded estate work (direct
  Dixie Phase 32K v4b seeded smoke) and the Freeside Characters Phase 42B
  (safe pre-Dixie gate diagnostics) / Phase 42C (seeded request /
  signature alignment) work, an operator reused §F–§N of this runbook
  unchanged, published `/recall-wedge-live-demo` after the restart, and
  invoked it in the configured guild.
- **This time the live path returned `served`, not the §R fail-closed.**
  The direct Dixie precondition passed (allowlist HTTP 201, token verify
  HTTP 200, recall HTTP 200, `outcome = served`, pack present, receipt
  present, raw reasons absent), and the gated live command rendered the
  §J.1 served-category ephemeral summary (`classification` / `outcome` /
  `route` / `reason` — all `served` / `/api/recall/intake`) with **no
  `raw_reasons`, no raw payload, no recall pack body, no receipt body, no
  IDs / tokens / tenant / debug / stack-trace exposure.**
- **Accepted scope: a controlled dev/operator seeded live recall, not
  production memory.** The served result came from a reviewed dev/operator
  seed admitted through a Straylight-owned path. The run claims no
  production rollout, no production memory admission, no user-chat
  ingestion, no public recall, no cross-user consent / sharing, and no
  healthy Finn integration.
- **The §R.1 caveats remain load-bearing, joined by two seeded-run
  specifics.** Confirmed against this run: the manually minted Dixie JWT
  is short-lived and **must be refreshed for future demos** (§R.1.b); the
  startup auto-publish path can **overwrite the live command registration**
  so `/recall-wedge-live-demo` must be **published after a restart**
  (§R.1.a). New seeded-run caveats: the **Dixie wallet allowlist may be
  runtime / in-memory** and may need re-adding after a Dixie redeploy /
  restart; **Freeside Characters must be restarted after setting a fresh
  Dixie token**; and the **direct Dixie v4b smoke should be re-run before
  future Discord demos** if the environment has changed.
- **This runbook still records no acceptance itself** — the seeded
  acceptance lives in the Phase 42D report; this note only points to it.

---

## S. Blocked work remains blocked

None of the following is authorized by Phase 41C (carried forward from
Phase 41A §O / Phase 40A / 39E / runbook §D, plus this runbook's own
scope bars):

- mutation of `/recall-wedge-demo` into a live command;
- public channel-visible recall;
- global registration;
- production / public rollout;
- freeform recall query input;
- Discord message history as memory input;
- memory admission;
- candidate-memory writes;
- "remember this";
- Telegram;
- private chat;
- storage / admission;
- production auth / consent;
- direct Finn runtime / audit wiring beyond existing seams;
- LLM rewriting;
- character voice;
- public renderer expansion;
- positive `public_telegram` support;
- positive `authorized_private_session` support.

If a later phase needs any item above, it must propose a phase naming the
item, the proof obligation it carries, and the decision artifact it
re-opens.

---

## T. Acceptance criteria for Phase 41C

Phase 41C is acceptable if:

- the **runbook is added** (this file);
- the **decision map is updated** with a targeted Phase 41C addendum
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **Phase 41A gate is updated or cross-referenced** with a Phase 41C
  note (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs** are committed;
- the runbook **does not record smoke-test acceptance**;
- the runbook **points to a future Phase 41D** for acceptance;
- **no runtime scope is authorized or changed.**

---

## U. Cross-references

- `docs/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; the redacted report for the
  controlled seeded run of this procedure that returned `served` from a
  seeded dev/operator estate. This runbook's §R.3 records its note.
- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; selects a seeded
  dev/operator estate as the next MVP need toward a safe served live
  recall, and ranks both §R.1 caveats below seeding. This runbook's §R.2
  records its note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; the redacted report for the controlled live
  run of this procedure (safe wiring + fail-closed, no served recall).
  This runbook's §R gains the Phase 41D acceptance note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; gains a Phase 41C note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config and classification
  vocabulary; gains a tiny Phase 41C cross-reference.
- `docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` — Phase 39D
  operational runbook for the harness demo (separate command, separate
  gates).
- `docs/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` — Phase 40B internal
  demo guide for the harness demo (separate; not the live-demo
  procedure).
- `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  harness-demo smoke-test acceptance; the Phase 41D template.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  gains a Phase 41C addendum.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — Phase
  41B live handler, env gates, fixed input, lazy load, render, no-leak
  scan (unchanged by Phase 41C).
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests (unchanged by Phase 41C).
- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — Phase 39B
  harness handler (separate command; unchanged by Phase 41C).
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` — Phase
  39B / 39C harness regression / static-guard tests (unchanged by Phase
  41C).
- `apps/bot/src/discord-interactions/dispatch.ts` — routes the two
  commands as distinct names (unchanged by Phase 41C).
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeLiveDemoCommand` (guild-scoped-only; unchanged by
  Phase 41C).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point
  (unchanged by Phase 41C).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — Phase
  37C live Dixie client; the only live-egress seam (unchanged by Phase
  41C).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C client tests (unchanged by Phase 41C).
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  — Phase 37C operator/dev-only runner (separate CLI path; unchanged by
  Phase 41C).
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.test.ts`
  — Phase 37C runner regression tests (unchanged by Phase 41C).
