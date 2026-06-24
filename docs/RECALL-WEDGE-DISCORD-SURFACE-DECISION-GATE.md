# Recall Wedge — Controlled Discord Surface Decision Gate

> **Phase 39A** (docs / decision / implementation-contract only).
> Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract),
> `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` (Phase 36A
> live-boundary decision),
> `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` (Phase 36D
> readiness checkpoint),
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` (Phase 36E cross-repo
> request / handoff),
> `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` (Phase 37A
> reconciliation),
> `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate),
> `docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` (Phase 37D
> multi-surface boundary gate), and
> `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` (Phase 38B
> multi-surface harness acceptance; the prerequisite decision point
> that authorized only this Phase 39A gate).
>
> This document is a **gate decision**. It does not implement a
> Discord command, it does not authorize Telegram, private chat,
> storage / admission, public renderer expansion, live Dixie-backed
> Discord recall, LLM rewriting, character voice, or production
> rollout. It accepts Phase 38B as the prerequisite decision point and
> defines the exact constraints under which a future **Phase 39B** may
> add a tightly gated dev-only Discord slash command that renders the
> Phase 38A multi-surface harness output.
>
> No code, package, lockfile, fixture JSON, validator, adapter,
> runner, live-client, Discord interaction wiring, command
> registration, Telegram bot wiring, private-chat client, live Dixie /
> Straylight / Finn integration, production storage, live memory
> admission, positive `authorized_private_session` projection,
> `authorized_private_session` renderer, `public_telegram` renderer,
> LLM/voice rewrite, character voice, or CI/generated-file changes
> are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this document, re-open the boundary doc, the
> live-boundary decision, the readiness checkpoint, the cross-repo
> request, the Phase 37A reconciliation, the Phase 37B live Dixie
> client gate, the Phase 37D multi-surface boundary gate, and the
> Phase 38B multi-surface harness acceptance — do not silently expand
> scope from this gate.

---

## A. Status and decision

Phase 39A is **docs / decision / implementation-contract only**.

- It accepts **Phase 38B** as the prerequisite decision point —
  the only artifact that authorized this Phase 39A decision gate.
- It authorizes only a future **Phase 39B** implementation under the
  constraints stated in this document. Every constraint is binding.
  Partial compliance does not authorize Phase 39B.
- It does not itself add Discord command code. No source, test,
  fixture, package, lockfile, config, CI, or generated change is
  introduced by Phase 39A.
- It does not authorize Telegram, private chat, storage / admission,
  public renderer expansion, live Dixie-backed Discord recall, LLM
  rewriting, character voice, or production rollout.
- It authorizes Phase 39B only if every constraint in this document
  is followed end-to-end.

### A.1 Decision sentence

**Phase 39A authorizes only a future Phase 39B tightly gated
dev-only, guild-scoped, operator-invoked Discord slash command that
renders Phase 38A harness output; it does not authorize live
Dixie-backed Discord recall, public channel-visible recall, Telegram,
private chat, storage / admission, production auth / consent, public
renderer expansion, LLM rewriting, character voice, or production
rollout.**

This authorization is conditional on the boundaries restated in §C
(authorized scope), §D (visibility), §E (command name), §F
(delivery), §G (input source), §H (renderer), §I (banned output
fields), §J (auth / consent non-claims), §K (logs / diagnostics), §L
(validation / static guards), §M (rollback / removal), and §N (still
blocked after Phase 39A). Partial compliance does not authorize
Phase 39B.

---

## B. Source evidence

This gate is grounded in the following artifacts:

- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase
  38B multi-surface harness acceptance; the prerequisite decision
  point that authorized only this Phase 39A decision gate. §A.1, §H,
  and §I of that doc define the floor questions Phase 39A must
  answer; this gate answers them.
- `docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` — Phase 37D
  multi-surface boundary gate; surface-frame taxonomy (§F), allowed
  / disallowed Phase 38A scope (§G.2 / §G.3), and harness
  acceptance criteria (§H). The Phase 38A harness this gate's
  Phase 39B implementation contract leans on lives under that gate.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A post-MVP
  option matrix and decision gates; §5a Discord command operational
  gates; Phase 37B / 37D / 38B addenda governing the next
  implementation phase. §5a is restated and tightened by this gate.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live
  Dixie client gate; the basis on which Phase 37C was authorized.
  This gate explicitly does **not** authorize Discord use of the
  Phase 37C live client.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — Phase 38A harness module; the only data path Phase 39B may
  render from.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`
  — Phase 38A harness regression tests; the contract the harness
  output is bound to.
- Inspected Discord command / registration source paths:
  - `apps/bot/src/discord-interactions/dispatch.ts` (interaction
    dispatch);
  - `apps/bot/src/discord-interactions/types.ts` (`MessageFlags`,
    `DiscordInteraction*` types, `EPHEMERAL = 64`);
  - `apps/bot/scripts/publish-commands.ts` (CLI entry for
    registration);
  - `apps/bot/src/lib/publish-commands.ts` (`buildCommandSet`,
    per-character `chat` / `satoshi-image` / `quest` commands).

---

## C. Phase 39B authorized scope

Phase 39B is authorized only to add a **tightly gated dev-only
Discord slash command** that renders Phase 38A harness output.

Phase 39B **may**:

- add **one** Discord slash command;
- register that command **guild-scoped only**, not globally;
- gate invocation to **dev / operator-only** users, by env-driven
  allowlist;
- ship the command **disabled by default**, requiring an explicit
  env / config kill switch to enable;
- read from the Phase 38A multi-surface harness output as the
  **only** data path;
- emit **ephemeral** Discord responses only;
- add tests and static guards proving every constraint in §D–§M;
- add the minimal source files required to implement the gated
  dev-only command and tests.

Phase 39B **must not**:

- invoke the Phase 37C live Dixie client
  (`packages/persona-engine/src/recall-wedge/live-dixie-client.ts`)
  or its runner
  (`packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`);
- accept user-supplied freeform recall queries;
- admit memory, write candidate memory, or in any way create a
  "remember this" affordance from Discord;
- invoke any LLM (no `@anthropic-ai/*`, no `openai`, no Claude Agent
  SDK; no persona-styled prose; no character voice);
- claim production auth / consent of any kind;
- integrate Telegram, private chat, storage / admission, Finn
  runtime / audit, or any other surface;
- mutate `packages/persona-engine/src/recall-wedge/render-public-recall.ts`,
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`,
  the Phase 38A harness, or the Phase 38A harness tests;
- modify `package.json`, lockfiles, fixture JSON, or CI;
- create generated files.

If Phase 39B finds itself reaching for any disallowed item above,
the answer is to defer Phase 39B — not to relax this gate.

---

## D. Discord surface visibility

Phase 39B's command is locked to:

- **dev-only** — never advertised, never user-discoverable beyond
  the operator allowlist;
- **guild-scoped** — registration must target a single allowed
  guild ID; **never** globally registered;
- **operator-invoked only** — only env-allowlisted user IDs may
  invoke the command; non-operator invocations must fail closed
  with a generic, no-leak refusal;
- **disabled by default** — every gating env / config flag below
  must default to off; missing env / config must fail closed.

The disabled / unauthorized path must itself be ephemeral and
generic (no internal classification leaked to the rejected caller).

### D.1 Required env / config gates

Phase 39B must implement, at minimum, the following env gates. Names
are repo-consistent with the `RECALL_WEDGE_*` prefix already used by
Phase 37B / 37C envs (see
`docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` §F and
`packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
for the pattern). Phase 39B may rename to match a closer existing
repo convention if inspection at implementation time finds one, but
it must document the final names chosen and preserve the
fail-closed-by-default rule for every gate.

- `RECALL_WEDGE_DISCORD_DEMO_ENABLED` — exact string `"true"` or
  the command fails closed at invocation time. Any other value (or
  unset) disables the command.
- `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` (or repo-consistent
  equivalent) — the single allowed guild ID. If the invoking
  `interaction.guild_id` does not match, the command fails closed.
  If unset, the command fails closed.
- `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS` (or
  repo-consistent equivalent) — comma-separated allowlist of
  operator Discord user IDs allowed to invoke. If the
  invoker (`member.user.id` or `user.id`) is not in the
  allowlist, the command fails closed. If unset or empty, the
  command fails closed.
- `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` — exact string
  `"true"` before the command is allowed to register. If the
  Phase 39B implementation touches command registration at all,
  registration must be skipped unless this gate is set, and
  registration must target the
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` only.

Missing env / config must fail closed at every layer (registration,
dispatch, render). Fail-closed responses must not leak which gate
tripped — the user-visible response is a single stable refusal
string; the precise gate is recorded only in operator-side logs
under §K.

---

## E. Command name / namespace

**Chosen command name: `/recall-wedge-demo`.**

The repo's existing slash commands (per
`apps/bot/src/lib/publish-commands.ts`) are:

- per-character `chat`-style commands keyed on character id —
  today `ruggy`, `satoshi` (and their analogues for any future
  character);
- `satoshi-image` (Satoshi-only image command);
- `quest` (`browse` / `accept` / `submit` / `status` subcommands).

`/recall-wedge-demo` does not collide with any of those names. If a
future character is named `recall` or `recall-wedge` or `demo`,
Phase 39B must rename to a non-conflicting repo-consistent name and
record the rename here. The shape of the rule survives the rename:
one command, no aliases, no broad memory namespace.

Naming rules (binding for Phase 39B):

- **one command only** — no companion commands, no multi-name
  registration;
- **no command aliases** — the command may not be registered under
  multiple names, and Phase 39B may not add a "memory" / "remember"
  alias;
- **no broad "memory" or "remember" command** — the command name
  must not imply general memory or recall capability;
- **command description must include dev-only / gated / demo
  wording** — the user-visible description must make it explicit
  that the command is a fixture-bound dev demo, not production
  recall, and is gated to operators;
- **no command may imply production memory, production recall, or
  user consent** — the description, options, and any localized
  strings must avoid wording like "your memory", "remembered",
  "saved", "stored", "consent", "admitted", or anything that would
  read as a production capability claim.

Phase 39B may add at most a single string option for harmless demo
selectors (e.g., choosing which Phase 38A harness fixture to render);
it must not add a freeform memory / recall query option (see §G).

---

## F. Delivery shape

Phase 39B delivery is locked to:

- **ephemeral response only** — every Phase 39B Discord response
  must set `flags |= MessageFlags.EPHEMERAL` (= 64), per
  `apps/bot/src/discord-interactions/types.ts`. Ephemerality is
  chosen at first response per Discord's contract and may not be
  converted to channel-visible mid-flight;
- **no channel-visible output** — there is no code path that
  produces a non-ephemeral message for this command, including
  edits, follow-ups, and PATCH `@original` responses;
- **no DM delivery** — the command does not open a DM, does not
  fall back to DM, and does not write to a DM channel;
- **no follow-up broadcasts** — no follow-up POSTs, no scheduled
  posts derived from the invocation;
- **no webhook posting** — the command must not use the
  per-character webhook identity path (Pattern B) used by digest
  delivery;
- **no scheduled / ambient posting** — the command does not run on
  any cron cadence, is not invoked by any scheduler, and is not
  invoked from any ambient listener;
- **no passive listening** — the command does not subscribe to
  `messageCreate` and does not read channel history.

The disabled / unauthorized path **must also be ephemeral and
generic**. It must not include a stack trace, a banned-substring
reason, an env-gate name, or any operator-only diagnostic. It must
not differ between "feature disabled", "wrong guild", and
"non-operator user" — the user-visible refusal string is the same.

---

## G. Input source

Phase 39B input source is locked to:

- **Phase 38A harness output only** — the only data the command
  may render comes from the multi-surface recall harness at
  `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`;
- **a deterministic built-in demo input or a fixture / injected
  value shaped for the harness** — no live data, no live envelope,
  no live reach into Dixie. Acceptable input shapes are the same
  `LiveDixieRecallResult`-shaped value the harness already
  consumes in tests, or a small fixed set of named demo selectors
  (e.g., a `case` enum) that map to harness-internal canned
  inputs;
- **no Phase 37C live Dixie client invocation** — the command must
  not import `live-dixie-client.ts` or `run-live-dixie-recall-demo.ts`;
- **no live Dixie call** — no `fetch` / `undici` / `http(s)` to
  any Dixie URL, no service token reading, no `RECALL_WEDGE_DIXIE_*`
  env consumption beyond the demo-gating envs in §D.1;
- **no arbitrary user prompt text as memory or recall request** —
  the command does not accept `prompt` / `query` / `text` /
  `message` / `q` options that would be interpreted as recall
  intent;
- **no Discord message history as memory input** — the command
  does not read `messageCreate` history, does not fetch channel
  messages, and does not inspect the invoking message thread;
- **no `recorded_dixie_recall_envelope` as live traffic** — the
  string remains a synthetic non-production probe; the command
  does not promote it to live transport.

User slash-command options, if any, are limited to **harmless demo
selectors** — small enums or boolean flags scoped to harness
fixture choice. They are not freeform memory queries and may not
be wired to anything other than the harness's internal selector.

---

## H. Renderer / output path

Phase 39B output is locked to:

- **the Phase 38A matrix's `public_discord_simulated` frame
  output, plus fixed dev-only framing text** — no other frame's
  positive output is rendered to the user;
- **optional compact list of other frames' outcomes / refusal
  codes** — Phase 39B may include a short summary line listing
  the per-frame outcome (e.g., `public_telegram_simulated:
  refusal:<code>`) only if every value listed is public-safe and
  passes the §I no-leak scan. Phase 39B must not dump the whole
  matrix and must not expose any field that would fail §I;
- **no `operator_dev` diagnostics in user-visible output** —
  operator-only classification, operator-only diagnostic context,
  and any internal projection of the harness must not reach the
  Discord response;
- **no internal / operator-only diagnostics in user-visible
  output** — `raw_reasons`, debug payloads, banned substrings, and
  operational identifiers must not be rendered;
- **no mutation of `render-public-recall.ts`** — Phase 39B does
  not touch the Phase 33C public-safe renderer;
- **no mutation of `dixie-envelope-adapter.ts`** — Phase 39B does
  not touch the Phase 35D adapter;
- **no public renderer expansion** — Phase 39B does not add a new
  public renderer, does not loosen the existing renderer's
  allowlist, and does not introduce a Telegram, private-chat, or
  authorized-private renderer;
- **same banned-substring / no-leak posture as Phase 33B / 33C** —
  the final Discord response (including any framing text) must be
  scanned with the same `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` posture
  used by `render-public-recall.ts` tests and the Phase 33B
  validator before sending. A scan failure must produce a generic
  ephemeral refusal, not a leaky error.

The fixed dev-only framing text must explicitly label the response
as a fixture-bound, gated dev demo (per §E command-description
rule restated at message body level).

---

## I. Banned output fields

Restating the banned public output posture for Phase 39B. The final
Discord response (`content`, `embeds[*]`, framing text, summary
lines, refusal text — anything reaching the user) must not contain
any of:

- `PRIVATE_SENTINEL`
- `raw_reasons`
- `raw_dixie_debug`
- `raw_session_trace`
- `debug`
- `operator_private`
- `private_assertion`
- `private assertion`
- `private_assertion_id`
- `assertion_id`
- `source_material`
- `hidden estate`
- full assertion bodies
- private identifiers
- `session_id`
- `message_id`
- `tenant_id`
- `community_id`
- `session_thread_id`
- `continuity_actor_id`
- `actor:`
- `freeside-characters:shared-substrate`
- `sessionId`
- `messageId`
- `tenantId`
- `communityId`
- `sessionThreadId`
- `continuityActorId`
- service token values
- the Discord bot token (`DISCORD_BOT_TOKEN` and any equivalent)
- Discord user IDs in user-visible output (operator-side redacted /
  hashed diagnostics may exist per §K, but no raw user ID may
  reach the user-visible response — including the invoker's own
  ID)
- guild IDs in user-visible output (same rule — operator-side
  redacted / hashed diagnostics only)

This list is the floor, not the ceiling. Any field that would fail
the Phase 33B no-leak validator or the
`PUBLIC_OUTPUT_BANNED_SUBSTRINGS` scan used by the existing
public-safe renderer is also banned here; the §H scan is what
enforces this list end-to-end.

---

## J. Auth / consent non-claims

Phase 39B explicitly does not prove or claim:

- **production auth** — operator / dev allowlists are deployment
  gates, not governed Straylight authorization. The command does
  not establish a production auth flow, does not bind identity,
  and does not issue / consume a session token;
- **production consent** — the command does not capture user
  consent, does not record any consent decision, and does not
  imply that consent has been collected;
- **cross-user recall** — the command does not authorize one user
  to read another user's memory; there is no notion of "memory" in
  the command's scope at all;
- **memory admission** — the command does not admit memory, does
  not promote candidate memory, and does not write to any
  candidate or admitted store;
- **candidate memory creation** — the command does not nominate
  any input as candidate memory; it neither logs candidate-memory
  rows nor enqueues admission jobs;
- **"remember this" from Discord** — there is no path from the
  Discord command, the invoker's prior messages, or channel
  context into a memory write of any kind;
- **production private session** — the command does not establish
  a private session, does not bind a thread to a memory scope, and
  does not invoke the `authorized_private_session_simulated` frame
  positively;
- **Straylight authorization** — operator / dev allowlists in §D.1
  are deployment-side filters, not Straylight-issued authorities;
  Straylight remains the memory authority per
  `docs/RECALL-WEDGE-MEMORY-MVP.md` §4.

If a Phase 39B reviewer reads any of the above into the
implementation, the implementation has overstepped this gate.

---

## K. Logs / diagnostics

Operator-side logs and diagnostics for Phase 39B are locked to:

- **may include**: command invoked (name only), classification
  (e.g., `enabled` / `disabled` / `wrong_guild` / `non_operator`),
  selected demo path (the harness selector chosen), enabled /
  disabled status, stable refusal codes (the same refusal-code
  posture as `PublicRecallRenderError`);
- **must not include**: raw harness input, the raw Phase 38A
  matrix, `operator_dev` diagnostics, service tokens (Dixie or
  otherwise), the Discord bot token, raw actor IDs (the
  `continuity_actor_id` and camelCase aliases), operational IDs
  (`session_id`, `message_id`, `tenant_id`, `community_id`,
  `session_thread_id`, and camelCase aliases), Discord message
  IDs, channel IDs, guild IDs, or user IDs **in raw form**.
  Redacted / hashed / prefix-truncated forms (e.g.,
  `user:hash:abcd1234`) may be emitted to operator logs only if
  Phase 39B documents the redaction transform and proves it does
  not round-trip to the raw value. Raw IDs must never appear;
- **must not dump the final response if it contains any sensitive
  material** — the §H banned-substring scanner runs before any
  log line that would include the response body;
- **errors must be stable / generic** — operator logs may carry a
  refusal code, but the user-visible error must be the single
  stable string from §F. Internal stack traces must not be
  forwarded to Discord and must be redacted before being logged
  if they reference any §I banned field.

These rules align with the §5a Discord command operational gates
in `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (redacted
operational logging; no `raw_reasons` / actor identifiers / private
fields).

---

## L. Required Phase 39B validation / static guards

Phase 39B must include tests / static guards that prove **every**
item below. Each item is a binding acceptance criterion for Phase
39B; missing any one of them must block Phase 39B acceptance.

- **disabled by default** — without
  `RECALL_WEDGE_DISCORD_DEMO_ENABLED="true"`, the command fails
  closed and emits the §F generic ephemeral refusal;
- **exact env gate enables it** — exactly the literal string
  `"true"` enables the command; `"True"`, `"1"`, `"TRUE"`, and any
  other truthy-looking value do not;
- **wrong guild fails closed** — invocations from a guild ID
  outside `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` (and from DMs, and
  with `guild_id` unset) fail closed with the §F generic refusal;
- **non-operator user fails closed** — invocations from a user ID
  outside `RECALL_WEDGE_DISCORD_DEMO_OPERATOR_USER_IDS` fail closed
  with the §F generic refusal;
- **output is ephemeral** — every successful response sets
  `flags |= MessageFlags.EPHEMERAL` (= 64); a static guard
  verifies the response builder always sets the bit;
- **no channel-visible response path exists** — no code path in
  the Phase 39B module produces a response without the EPHEMERAL
  flag; a guard test asserts there is no branch that omits it;
- **no live Dixie client import** — a static guard asserts the
  Phase 39B module does not import
  `packages/persona-engine/src/recall-wedge/live-dixie-client.ts`
  or `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`;
- **no live Dixie network call** — a static guard asserts the
  module does not call `fetch` / `undici` / `http(s)` to a Dixie
  URL and does not consume `RECALL_WEDGE_DIXIE_*` envs other than
  the §D.1 demo-gating envs;
- **no Telegram / private-chat / storage / Finn / LLM imports** —
  a static guard asserts the module does not import `telegraf` /
  `grammy` / any Telegram client; does not import any private-chat
  client; does not import `pg` / `redis` / object storage / vector
  index modules; does not import `@loa/dixie` / `@loa/straylight`
  / Finn modules; does not import `@anthropic-ai/*` / `openai` /
  the Claude Agent SDK;
- **no memory admission / candidate-memory writes** — a static
  guard asserts the module does not call any candidate-memory or
  admitted-memory write API and does not enqueue admission jobs;
- **no "remember this" behavior** — a static guard asserts no
  branch in the module nominates Discord input as candidate
  memory;
- **no public renderer mutation** — a static guard asserts
  `render-public-recall.ts`, `dixie-envelope-adapter.ts`, the
  Phase 38A harness, and the Phase 38A harness tests are not
  modified by the Phase 39B diff;
- **final Discord output passes banned-substring scan** — every
  successful response is scanned with the same
  `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` posture as
  `render-public-recall.ts` and falls back to the §F generic
  refusal on scan failure; tests cover both the clean-pass and
  contaminated-fallback cases;
- **disabled / unauthorized responses are generic and no-leak** —
  refusal text under disabled / wrong-guild / non-operator paths
  matches a single stable string and passes the §I banned-substring
  scan;
- **command registration is gated and guild-scoped if registration
  is touched** — if Phase 39B touches `publish-commands.ts` or any
  registration entry point, registration is skipped unless
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS="true"`, and the
  registration call uses the
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` guild scope (never global);
- **rollback path can disable command by env / config** — flipping
  `RECALL_WEDGE_DISCORD_DEMO_ENABLED` away from `"true"` causes
  the command to fail closed without redeploy.

---

## M. Rollback / removal path

Phase 39B's rollback path is:

- **disable invocation by env** — set
  `RECALL_WEDGE_DISCORD_DEMO_ENABLED` to anything other than
  `"true"` (including unsetting it). The command fails closed at
  invocation time with the §F generic refusal. No redeploy
  required;
- **block registration by env** — set
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` to anything other
  than `"true"`. New deployments do not register the command;
- **de-register the command from the guild** — use the existing
  command publishing / de-registration mechanism in
  `apps/bot/scripts/publish-commands.ts` /
  `apps/bot/src/lib/publish-commands.ts` to remove
  `/recall-wedge-demo` from
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID`. Because the command is
  guild-scoped only, removing it from that one guild removes it
  entirely;
- **revert the Phase 39B commit** — if env-disable plus
  de-registration is not sufficient (e.g., a code path leaked
  beyond the command), revert the Phase 39B commit. There is no
  persisted memory, candidate memory, storage row, or admission
  record produced by Phase 39B, so rollback is code-only and does
  not require a data migration.

The rollback path mirrors the §5a Discord command operational
gates' kill-switch requirement: env-flag-off must disable the
command without redeploy.

---

## N. Still blocked after Phase 39A

The following remain explicitly blocked by Phase 39A. None may be
introduced inside Phase 39B; each is gated on a later, separately
authorized phase:

- **live Dixie-backed Discord recall** — Phase 37C remains the
  operator/dev-only live Dixie seam; Phase 39B does not invoke it;
- **public channel-visible recall** — Phase 39B is ephemeral-only;
  any non-ephemeral surface is later, separate work;
- **production / public Discord rollout** — global registration,
  user-discoverable commands, and production-tier permissions
  remain blocked;
- **Telegram** of any kind (no bot, no API client, no renderer);
- **private chat** of any kind (no transport, no identity binding,
  no consent capture);
- **storage / admission** (no Postgres, no vector index, no
  object storage, no Redis, no candidate-memory or admitted-memory
  write paths);
- **live memory admission** as a side effect of any Phase 39B
  code path;
- **"remember this" from Discord** (no public-chat-driven or
  ephemeral-driven candidate-memory promotion);
- **production auth / consent** implementation;
- **direct Finn runtime / audit wiring**;
- **LLM rewriting** of recall output (no model invocation);
- **character voice** for recall output (no persona-styled prose);
- **positive `public_telegram` support** (no renderer, DTO, or
  fixture);
- **positive `authorized_private_session` support** (no renderer,
  DTO, or fixture).

If a later phase needs any item above, it must propose a phase
naming the item, the proof obligation it carries, and the decision
artifact it re-opens.

---

## O. Phase 39B implementation contract

Phase 39B may add only the **minimal source files** required to
implement the gated dev-only command and tests. Recommended file
locations are based on the inspected Discord command shape
(`apps/bot/src/discord-interactions/dispatch.ts`,
`apps/bot/src/lib/publish-commands.ts`,
`apps/bot/scripts/publish-commands.ts`) but are **subject to
existing app structure** at implementation time. Phase 39B may
choose nearer-fit paths if inspection reveals a better repo-
consistent location, and must record the chosen paths in the
Phase 39B PR description.

Conservative likely paths:

- `apps/bot/src/discord-interactions/recall-wedge-demo.ts` — the
  gated dev-only command handler module (env-gate parsing,
  dispatch entry, response builder, banned-substring scan
  integration);
- `apps/bot/src/discord-interactions/recall-wedge-demo.test.ts` —
  Phase 39B regression / static-guard tests covering every item
  in §L;
- a small (≤ a few lines) wiring change in
  `apps/bot/src/discord-interactions/dispatch.ts` that routes
  `interaction.data?.name === 'recall-wedge-demo'` into the new
  handler, gated by the same env / allowlist checks the handler
  enforces internally;
- if the Phase 39B implementation chooses to register the
  command, a small wiring change in
  `apps/bot/src/lib/publish-commands.ts` (or
  `apps/bot/scripts/publish-commands.ts`) gated on
  `RECALL_WEDGE_DISCORD_DEMO_REGISTER_COMMANDS` and the
  `RECALL_WEDGE_DISCORD_DEMO_GUILD_ID` guild scope, with no global
  registration path.

Phase 39B **must not** change `package.json` or any lockfile unless
a concrete blocker appears at implementation time; if such a
blocker appears, Phase 39B must stop and a separate decision must
be made before adding a dependency. Phase 39B must not add CI or
generated files.

### O.1 Phase 39D note — operational runbook for the implemented command

> Added by Phase 39D
> (`docs/RECALL-WEDGE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`).
> Targeted note near the Phase 39B implementation contract / rollback,
> not a rewrite of this gate.

- **Phase 39B and Phase 39C implemented the handler and the
  registration gate.** Phase 39B added the dev-only
  `/recall-wedge-demo` handler
  (`apps/bot/src/discord-interactions/recall-wedge-demo.ts`); Phase
  39C added the disabled-by-default, guild-scoped-only registration
  path (`registerRecallWedgeDemoCommand` in
  `apps/bot/src/lib/publish-commands.ts`, wired in
  `apps/bot/scripts/publish-commands.ts`), which never falls back to
  the global route.
- **Phase 39D is the operational runbook** for safely
  enabling, registering, invoking, validating, disabling, and removing
  the command — the §F delivery shape, §D / §D.1 visibility / env
  gates, §K logs posture, and §M rollback / removal path restated as
  operator steps.
- **The operational runbook does not expand the Phase 39A
  authorization.** Everything blocked by §N stays blocked; the runbook
  authorizes controlled dev / operator testing only, with no live
  Dixie, no memory admission, and no public rollout.

---

## P. Acceptance criteria for Phase 39A

Phase 39A is acceptable if:

- the **new decision doc is added** (this file);
- the existing multi-surface harness acceptance
  (`docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md`) gains
  a **targeted Phase 39A addendum** stating that Phase 39A
  decides the first controlled Discord surface shape, that Phase
  39A authorizes future Phase 39B only as
  dev-only / guild-scoped / operator-invoked / ephemeral /
  harness-backed, and that Phase 39A does not authorize live
  Dixie-backed Discord recall or public rollout;
- the existing post-MVP decision map
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`) gains a
  **targeted Phase 39A addendum** stating that Phase 39A chooses
  the next implementation as a dev-only Discord harness demo
  (not production recall), that Phase 39B is allowed only under
  this gate, and that live Dixie-backed Discord, Telegram,
  private chat, storage / admission, auth / consent, LLM, and
  voice remain blocked;
- **no source / test / package / lockfile / fixture / config / CI
  / generated changes** are made by Phase 39A;
- the docs clearly **authorize only Phase 39B under the
  constraints in §C–§N** of this gate;
- the docs clearly **do not authorize live Dixie-backed Discord
  recall, public rollout, Telegram, private chat, storage /
  admission, public renderer expansion, LLM rewriting, or
  character voice**;
- the docs clearly **keep all non-Discord surfaces blocked** per
  §N.

---

## Q. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates; §5a Discord command
  operational gates; gains a Phase 39A addendum.
- `docs/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` — Phase 35C
  multi-surface contract.
- `docs/RECALL-WEDGE-LIVE-BOUNDARY-DECISION.md` — Phase 36A
  live-boundary decision.
- `docs/RECALL-WEDGE-LIVE-DIXIE-READINESS-CHECKPOINT.md` — Phase
  36D readiness checkpoint.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-REQUEST.md` — Phase 36E
  cross-repo request / handoff.
- `docs/RECALL-WEDGE-DIXIE-CONTRACT-RECONCILIATION.md` — Phase 37A
  reconciliation against Dixie Phase 32E / 32F.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live
  Dixie client gate; the gate Phase 37C cleared. Phase 39A does
  not authorize Discord use of the Phase 37C live client.
- `docs/RECALL-WEDGE-MULTI-SURFACE-BOUNDARY-GATE.md` — Phase 37D
  multi-surface boundary gate. Phase 39A is the Phase 39A
  decision point that gate's §K.1 Phase 38B addendum points to.
- `docs/RECALL-WEDGE-MULTI-SURFACE-HARNESS-ACCEPTANCE.md` — Phase
  38B multi-surface harness acceptance; the prerequisite decision
  point for this gate; gains a Phase 39A addendum.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.ts`
  — Phase 38A multi-surface harness module; Phase 39B's only
  data path.
- `packages/persona-engine/src/recall-wedge/multi-surface-recall-harness.test.ts`
  — Phase 38A multi-surface harness regression tests.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts`
  — Phase 33C public-safe renderer; not mutated by Phase 39A
  or 39B.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`
  — Phase 35D recorded Dixie envelope adapter; not mutated by
  Phase 39A or 39B.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts`
  (Phase 37C) — operator/dev-only live Dixie client; **not**
  invoked by Phase 39B.
- `packages/persona-engine/src/recall-wedge/run-live-dixie-recall-demo.ts`
  (Phase 37C) — operator/dev-only live Dixie runner; **not**
  invoked by Phase 39B.
- `apps/bot/src/discord-interactions/dispatch.ts` — current
  interaction dispatch; recommended Phase 39B routing point.
- `apps/bot/src/discord-interactions/types.ts` — `MessageFlags`,
  `DiscordInteraction*` types, `EPHEMERAL = 64`.
- `apps/bot/scripts/publish-commands.ts` — CLI entry for command
  registration.
- `apps/bot/src/lib/publish-commands.ts` — `buildCommandSet`,
  per-character / `satoshi-image` / `quest` command set; the
  inspected non-conflicting set against which `/recall-wedge-demo`
  was chosen.
