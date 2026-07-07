# Recall Wedge — Live Dixie Discord Smoke-Test Acceptance

> **Phase 41D** (docs / smoke-test acceptance only). Date: 2026-05-30.
> Companion to
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`
> (Phase 41C operational runbook — the governing procedure this
> acceptance records a run of),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` (Phase 41A
> decision gate — the authority this acceptance preserves without
> expanding),
> `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate — the live client seam, its env, and its classification
> vocabulary),
> `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` (Phase 39E
> harness-demo smoke-test acceptance — the redacted-evidence template
> this report follows), and
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix).
>
> This document records the controlled operator smoke test that was run
> **after** Phase 41C, against a real Discord guild, with the live
> `/recall-wedge-live-demo` command wired to a live Dixie deployment. It
> does **not** add or authorize new code. It is the acceptance record for
> a single, controlled dev / operator demo run — nothing more.
>
> It does not expand the Phase 41A authorization. Anything Phase 41A /
> 41C blocked stays blocked here (see §K). This acceptance is for
> **controlled live-Dixie Discord wiring and safe fail-closed
> rendering** — it is **not** acceptance of served recall memory (see
> §G, §H). If a step seems to require reaching past those boundaries, the
> answer is to stop and open the next decision gate (§N) — not to relax
> it from this acceptance.

---

## A. Status and decision

Phase 41D is **docs / smoke-test acceptance only**.

- It **records the controlled operator smoke test** run after Phase 41C,
  in one configured Discord guild, against a live Dixie deployment.
- It **does not add or authorize new code.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 41D.
- It **does not authorize production rollout.**
- It **does not claim public recall.**
- It **does not claim served memory** — the live run reached the Dixie
  seam and fail-closed safely; no recall content was served (§G, §H).
- It **does not claim Finn integration is healthy** — Finn was
  intentionally unreachable during the run (§D).
- It **does not authorize public channel-visible recall.**
- It **does not authorize** memory admission, candidate-memory writes,
  "remember this," Telegram, private chat, storage / admission,
  production auth / consent, LLM rewriting, character voice, or public
  renderer expansion.

### A.1 Decision sentence

**Phase 41D accepts `/recall-wedge-live-demo` as successfully
smoke-tested for controlled dev / operator Discord use against a live
Dixie deployment: guild-scoped operator-gated invocation, authenticated
live reach to the Dixie `/api/recall/intake` seam, ephemeral
safe-classified output, and fail-closed rendering when the upstream
estate / storage state is unseeded — with no served recall content, no
memory admission, no public rollout, and no raw-material leak.**

This acceptance is conditional on the boundaries restated in §H (what
Phase 41D does not prove) and §K (blocked work remains blocked). Partial
compliance does not satisfy this acceptance.

### A.2 Naming note (binding for this document)

- **"Freeside Characters"** is the current Discord app / this repo / the
  Railway project and service that runs the bot. The current bot
  identity is **"loa."**
- **"Dixie"** is the upstream live Recall Wedge service this run reached.
- **"Finn"** (`loa_finn`) is the upstream Dixie depends on for a healthy
  overall state; it was intentionally pointed at a placeholder URL for
  this run, so the overall Dixie health was degraded by design (§D).
- The bare word **"Freeside"** is **not** used here to name the current
  app. "Freeside platform" is reserved for the future broader platform
  and is out of scope for this acceptance.

---

## B. Source evidence

This acceptance is grounded in the following artifacts (the same set the
Phase 41C runbook operationalizes — no new code path is introduced or
accepted here):

- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the governing operating procedure for
  every step performed in this smoke test (its §F–§N).
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the authority the smoke test preserves without
  expanding.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config and classification
  vocabulary the rendered output narrows into.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  Phase 41B live command handler. Source of the env gate helpers, the
  fixed deterministic input, the lazy live-client loader (only after the
  Discord gates pass), the classification → render decision, the single
  generic refusal string (`recall-wedge-live-demo is not available
  here.`), the ephemeral-only response builder, and the final
  banned-substring no-leak scan.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests; the local evidence behind
  the static posture.
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeLiveDemoCommand` (guild-scoped-only registration,
  fail-closed on both env gates, never global).
- `apps/bot/scripts/publish-commands.ts` — the publish CLI entry point.
- `apps/bot/src/discord-interactions/dispatch.ts` — routes
  `recall-wedge-live-demo` as a distinct command name, with bot-author
  and webhook-author drop guards.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  Phase 37C operator/dev-only live Dixie client; the only live-egress
  seam reached during this run.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  harness-demo smoke-test acceptance; the redacted-evidence template
  this report follows.

---

## C. Test environment and redaction posture

- The test was performed in **one configured Discord guild** using the
  existing **Freeside Characters** shell bot application (identity
  "loa"); no new application, token, or identity was introduced.
- Dixie was deployed to **Railway** and reachable at its public Railway
  URL; the **Freeside Characters service** received the live Dixie env
  (§E) on the same Railway project.
- The raw Discord **bot token, guild ID, command ID, application ID, and
  user IDs are intentionally not recorded** in this document.
- The raw **Dixie base URL, service token, tenant ID, caller actor ID,
  request-key prefix, the minted Dixie JWT, the dev wallet, any admin /
  allowlist key, the Postgres connection string, and all Railway service
  / project identifiers are intentionally not recorded.**
- **Raw Dixie response bodies are not pasted** — only the narrowed,
  classifier-controlled summary shape is recorded (§F). In particular,
  no `raw_reasons`, no bounded-store scope detail, no tenant / debug
  material, and no upstream payload appear here.
- **Screenshots / images are not committed** with this acceptance.
- Evidence is recorded as **redacted operator observations** — what was
  seen, not the operational identifiers or secrets that produced it.
- **No secrets were pasted** into this report (consistent with the Phase
  41C runbook §M / §Q no-secrets posture and the handler's no-leak
  scan).

This redaction posture is deliberate: it mirrors the runbook's
evidence-capture rules (runbook §M) and the no-leak banned-substring
posture the handler enforces. The acceptance is meaningful *because* the
operator observed the gated, fail-closed behavior — not because raw IDs,
tokens, or payloads were copied here.

---

## D. Live Dixie deployment preconditions (redacted)

Recorded (redacted) deployment observations, in the order they occurred:

- Dixie was **deployed to Railway** and became reachable at its public
  Railway URL.
- `GET /api/health` returned **HTTP 200**.
- the **Dixie service and its Postgres were healthy.**
- the **overall health was reported degraded / unhealthy only because
  the Finn dependency (`loa_finn`) was intentionally unreachable** via a
  placeholder Finn URL — a deliberate precondition of this run, not a
  defect. This run does **not** claim Finn integration is healthy.
- `POST /api/recall/intake` **without auth returned HTTP 401
  "Authentication required."**
- a **dev wallet was allowlisted in Dixie** (the wallet value is not
  recorded).
- a **short-lived Dixie JWT was minted locally, not printed**, and
  **verified against Dixie with HTTP 200** (the token is not recorded).
- an **authenticated direct `POST /api/recall/intake` reached the
  Straylight seam** and returned a **`seam.storage_unavailable`**
  condition, because the live estate / storage state is **unseeded**.

These preconditions establish that the live Dixie deployment was real,
healthy at the service / Postgres layer, correctly rejecting
unauthenticated calls, and reachable with a valid short-lived token —
while the **served-recall path was not yet available** because the
estate / storage state is unseeded (§G). The degraded overall health is
attributable solely to the intentionally-unreachable Finn placeholder.

---

## E. Freeside Characters live-Dixie wiring (redacted)

The **Freeside Characters** service "freeside characters" received the
live Dixie env (placeholder names only; **no values recorded**):

- `RECALL_WEDGE_DIXIE_BASE_URL`
- `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`
- `RECALL_WEDGE_DIXIE_TENANT_ID`
- `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID`
- `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`

This is the env shape the Phase 41C runbook §D / §I documents: the
`RECALL_WEDGE_LIVE_DISCORD_DEMO_*` Discord gates plus the separate Phase
37C `RECALL_WEDGE_DIXIE_*` client config. The Discord gates govern
*whether Discord may reach the client*; the `RECALL_WEDGE_DIXIE_*` env
governs *how the client authenticates to Dixie*. No value of either set
is recorded here.

---

## F. Live invocation result — safe fail-closed classification

Recorded (redacted) observations for the operator invocation:

- `/recall-wedge-live-demo` was registered to the configured guild and
  **manually re-registered after restart** (see §L caveat) so the
  dev-only live command was present.
- the operator invoked `/recall-wedge-live-demo` in the configured
  Discord guild.
- the response was **ephemeral / operator-visible** (only the operator
  saw it).
- the Discord output returned a **safe classification**:
  - `classification: upstream_unavailable`
  - `outcome:        upstream_unavailable`
  - `route:          /api/recall/intake`
  - `reason:         seam.storage_unavailable`
- the Discord output **did not expose**:
  - `raw_reasons`;
  - the raw Dixie payload / response body;
  - bounded-store scope detail;
  - tenant / debug material;
  - JWT / token / service-token material;
  - stack traces;
  - private identifiers / raw IDs.

This is the runbook §J.1 category-2 shape: the fixed dev-only live
framing plus a narrowed `classification` / `outcome` / `route` / `reason`
summary, with a stable classifier-controlled reason code and no raw
upstream material. The upstream seam's `storage_unavailable` condition
was classified into the Phase 37C `upstream_unavailable` vocabulary and
rendered as a public-safe / operator-safe summary — exactly the
fail-closed behavior the Phase 41A §I output decision and the runbook
§J.2 require.

### F.1 Observed safe Discord output shape (illustrative, redacted)

The observed output matched this narrowed shape (illustrative — the
framing is fixed in code; the four data lines are classifier-controlled):

```
recall-wedge-live-demo · live Dixie dev demo (not production recall)
gated · operator-only · ephemeral · phase 37c live Dixie client output

classification: upstream_unavailable
outcome:        upstream_unavailable
route:          /api/recall/intake
reason:         seam.storage_unavailable
```

Nothing beyond this narrowed shape was visible: no served recall body,
no raw reasons, no payload, no IDs, no tokens, no stack trace.

---

## G. What Phase 41D proves

Phase 41D proves, from the controlled operator smoke test, that:

- **Dixie can be deployed live** (Railway, public URL) with a healthy
  service and Postgres, returning **HTTP 200** on `GET /api/health`;
- the Dixie intake seam **rejects unauthenticated calls** (`HTTP 401`)
  and **accepts a valid short-lived token** (verified `HTTP 200`),
  proving the auth boundary works at the seam;
- the **Freeside Characters live command can be wired to live Dixie**
  via the `RECALL_WEDGE_DIXIE_*` + `RECALL_WEDGE_LIVE_DISCORD_DEMO_*`
  env (§E);
- an **allowlisted operator can invoke `/recall-wedge-live-demo` in the
  configured guild** and the live path reaches the Dixie
  `/api/recall/intake` seam;
- when the upstream estate / storage state is unseeded, the seam's
  `seam.storage_unavailable` condition is **classified safely as
  `upstream_unavailable`** and **rendered fail-closed** as an ephemeral
  operator-safe summary;
- the **user-visible output avoids `raw_reasons`, raw Dixie payload,
  bounded-store scope detail, tenant / debug material, JWT / token
  material, stack traces, and private IDs**;
- the run **served no recall content**, **admitted no memory**, **made no
  production auth / consent claim**, and **produced no public-channel
  output**.

These are observations about *this controlled run*. They confirm the
Phase 41C runbook procedure works end-to-end against a real Dixie
deployment under the gates, and that the seam fails closed safely when
recall content is unavailable. They do not extend the proof past §H.

---

## H. What Phase 41D does not prove

Phase 41D does **not** prove any of the following. These remain in scope
only for later, separately authorized phases:

- **served recall memory** — the run reached the seam and fail-closed on
  `seam.storage_unavailable`; **no recall content was served**;
- production readiness;
- public rollout readiness;
- public recall / public channel-visible recall;
- production auth / consent;
- cross-user recall authorization / consent;
- live memory admission;
- candidate-memory admission;
- persistent production storage / admission (the live estate / storage
  state is unseeded — see §J);
- a healthy Finn integration (Finn was intentionally unreachable — §D);
- Telegram support;
- private chat support;
- LLM rewriting;
- character voice;
- broad Discord UX readiness;
- long-running operational stability;
- de-registration automation;
- a long-lived or production-grade Dixie service-token / JWT path (the
  token used was short-lived and manually minted — §L).

If a later phase needs proof of any item above, it must propose a phase
that *names* the proof it intends to deliver and the gate it must clear
— it must not stretch this smoke-test acceptance to cover that ground.

---

## I. Security / no-leak assessment

- **No secrets recorded.** No bot token, Dixie service token, minted
  JWT, dev wallet, admin / allowlist key, or Postgres connection string
  appears in this document or in any committed artifact for this phase.
- **No raw IDs recorded.** No guild, app, command, user, tenant, caller
  actor, or Railway service / project identifier, and no request-key
  prefix, appears here.
- **No raw upstream material recorded.** No `raw_reasons`, no raw Dixie
  response body, no bounded-store scope detail, no headers, and no
  request body appear here.
- **The minted Dixie JWT was not printed** during the run; it was minted
  locally and verified by HTTP status only.
- **Discord output was fail-closed and narrowed.** The operator-visible
  output exposed only the four classifier-controlled summary lines
  (§F) — no payload, no IDs, no tokens, no stack trace — consistent with
  the handler's final banned-substring no-leak scan
  (`recall-wedge-live-demo.ts`) and the Phase 41A §I / §K output and
  logging boundaries.
- **Ephemeral only.** Every observed response was ephemeral
  (operator-visible), consistent with the runbook §N pass criteria.
- **No screenshots / images committed.**

The assessment: this run produced **no leak** of secrets, raw IDs, or
raw upstream material, and the Discord surface fail-closed safely. The
redaction posture of this document matches the no-leak posture the
handler enforces at runtime.

---

## J. Current blocker for served recall

- **The live estate / storage state is unseeded.** The authenticated
  intake call reached the Straylight seam and returned
  `seam.storage_unavailable`; the live command classified this as
  `upstream_unavailable` and fail-closed.
- **This is the current blocker for served recall:** until the live
  estate / storage state is seeded (and the seeding / admission path is
  itself designed and gated — see decision-map §7), the live command can
  prove **safe reach and safe fail-closed**, but it cannot prove **served
  recall content**.
- **This blocker is expected and safe.** Fail-closing on an unseeded
  upstream is the designed behavior, not a defect. Acceptance of *this*
  run is acceptance of the wiring and the fail-closed render — not of
  served memory.

---

## K. Blocked work remains blocked

The following remain explicitly blocked. None is authorized by Phase
41D (this restates the Phase 41A §O / Phase 41C §S blocked-work list,
carried forward unchanged):

- mutation of `/recall-wedge-demo` into a live command;
- public channel-visible recall;
- public recall;
- served recall memory as an accepted capability;
- global registration;
- production / public rollout;
- freeform recall query input;
- Discord message history as memory input;
- memory admission;
- candidate-memory writes;
- "remember this";
- Telegram;
- private chat;
- storage / admission (the unseeded estate / storage blocker — §J);
- production auth / consent;
- cross-user auth / consent;
- direct Finn runtime / audit wiring beyond existing seams;
- LLM rewriting;
- character voice;
- public renderer expansion;
- positive `public_telegram` support;
- positive `authorized_private_session` support.

If a later phase needs any item above, it must propose a phase naming
the item, the proof obligation it carries, and the decision artifact it
re-opens.

---

## L. Operational caveats

These are load-bearing for anyone repeating the smoke test.

### L.1 Startup auto-publish can remove the dev-only live command

- The startup auto-publish path **bulk-syncs the normal command set**,
  which **can remove the dev-only live command** (`/recall-wedge-live-demo`)
  from the configured guild.
- **For the smoke test: register `/recall-wedge-live-demo` after the
  restart, and do not restart Freeside Characters again before
  invocation.** A restart between registration and invocation can erase
  the dev-only command, leaving nothing to invoke.
- In this run, the command was **manually re-registered after restart**
  for exactly this reason (§F).

### L.2 The manually minted Dixie JWT is short-lived

- The Dixie service token / JWT used for the live reach was **manually
  minted and short-lived.**
- **Before repeating the smoke test, refresh the token and restart
  Freeside Characters if the token has expired.** An expired token will
  surface as a safe classification (e.g. `service_unauthorized`) or the
  generic refusal — never a leak — but it will not exercise the seam
  reach this run demonstrated.
- A longer-lived / safer dev service-token path is **not** solved by
  this run (§H) and is offered as a next-decision option (§N.e).

---

## M. Operator acceptance checklist

The operator confirmed every item below during the smoke test:

- [x] Dixie deployed to Railway and reachable at its public URL;
- [x] `GET /api/health` returned HTTP 200;
- [x] Dixie service and Postgres healthy;
- [x] overall health degraded only due to the intentional Finn
      placeholder (no Finn-healthy claim);
- [x] unauthenticated `POST /api/recall/intake` returned HTTP 401;
- [x] dev wallet allowlisted in Dixie;
- [x] short-lived Dixie JWT minted locally, not printed, verified HTTP
      200;
- [x] authenticated intake reached the Straylight seam and returned
      `seam.storage_unavailable` (unseeded estate / storage);
- [x] Freeside Characters service wired with the live Dixie env (§E);
- [x] `/recall-wedge-live-demo` manually re-registered after restart;
- [x] operator invocation returned the safe classification
      (`upstream_unavailable` / `seam.storage_unavailable`);
- [x] response ephemeral / operator-visible;
- [x] no raw_reasons / raw payload / bounded-store scope / tenant /
      debug / JWT / token / stack-trace / private-ID exposure;
- [x] no served recall content;
- [x] no memory admission language;
- [x] no production auth / consent claim;
- [x] no public-channel-visible output;
- [x] screenshots not committed;
- [x] secrets / raw IDs / tokens not recorded.

---

## N. Next decision options

Phase 41D itself authorizes none of the following — it only accepts the
controlled live-Dixie Discord smoke-test result. Each option carries its
own proof obligation and re-opens its own decision artifact:

- **a. Stop and preserve this as controlled smoke acceptance.** Treat
  this run as the accepted state and take no further live action.
- **b. Docs-only runbook hardening for repeatable smoke.** Tighten the
  Phase 41C runbook so the §L caveats (auto-publish erasure, short-lived
  token) are checklist steps, with no runtime change.
- **c. Tiny operational patch so live dev command registration is not
  erased by startup auto-publish** when the registration gate is true —
  a narrow change to the publish / startup path so a true
  `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS` gate survives the
  bulk sync. This is a code change and would carry its own gate / tests
  (it is **not** authorized here).
- **d. Design a seeded live estate / storage path** so the seam can
  serve recall content — gated by decision-map §7 (admission / storage)
  and §6 (live Dixie client), since served recall is the current blocker
  (§J).
- **e. Design a longer-lived / safer dev service-token path** so the
  smoke test does not depend on a short-lived manually minted JWT (§L.2).
- **f. Keep public rollout blocked.** The default and recommended
  posture: public recall, served memory, and public-channel-visible
  output stay blocked behind separate later gates (§K).

**Recommended:** option **a** or **b** now (preserve + optionally harden
docs), with options **c / d / e** sequenced later under their own gates,
and option **f** held throughout. Phase 41D authorizes none of them; the
next phase is the place to weigh them.

### N.1 Phase 42A note — seeded live estate selected as the next MVP need

> Added by Phase 42A
> (`docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`), 2026-05-30.

- **Phase 42A picked option `d` above** — "design a seeded live estate /
  storage path" — as the next MVP need, ahead of option `c`
  (registration hardening) and option `e` (service-token hardening). The
  unseeded estate / storage state recorded in §J is the blocker to served
  recall; seeding is the only lane that moves the proof from this safe
  live failure to a safe served live recall.
- **Phase 42A is docs / decision gate only.** It authorizes a future
  seeded-estate lane (a future Phase 42B) under tight seed constraints
  (one dev/operator estate, a few reviewed deterministic assertions,
  deterministic / reviewed / idempotent, no committed secrets or live
  IDs, tests / guards before any PR) — a reviewed operator/dev fixture,
  **not** user chat ingestion. It implements nothing and seeds nothing.
- **Nothing this acceptance blocked is unblocked.** Service-token
  hardening (§N.e) and registration hardening (§N.c) stay behind their
  own separate decisions; production memory admission, public recall,
  served memory as a capability, and everything in §K remain blocked.
  Phase 42A makes no served-memory acceptance claim.

### N.2 Phase 42D note — the §N.d seeded lane was taken; the safe failure here advanced to a safe served recall

> Added by Phase 42D
> (`docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md`),
> 2026-05-31.

- **The seeded-estate lane (this acceptance's §N option `d`, selected by
  Phase 42A) has been exercised and accepted as served.** The §J blocker
  recorded here — the unseeded live estate / storage state — was resolved
  by a Dixie-side seed of a reviewed deterministic dev/operator estate
  (direct Dixie Phase 32K v4b seeded smoke), paired with Freeside
  Characters Phase 42B (safe pre-Dixie gate diagnostics) and Phase 42C
  (seeded request / signature alignment), accepted as Phase 42D.
- **The same controlled path now returns `served`, not
  `upstream_unavailable`.** Where this run reached the Straylight seam and
  fail-closed on `seam.storage_unavailable` (§F), the Phase 42D run reached
  a seeded estate and returned the §F-shaped ephemeral operator-safe
  summary with `classification` / `outcome` / `route` / `reason` all
  `served` / `/api/recall/intake` — still with **no `raw_reasons`, no raw
  payload, no recall pack body, no receipt body, no IDs / tokens / tenant /
  debug / stack-trace exposure.**
- **The §F safe-fail-closed result remains the accepted baseline.** Seeding
  added the served case; it did not remove the safe-failure case. Against
  an unseeded estate, an invalid / expired token, or an unauthenticated
  call, the seam still fails closed exactly as accepted here.
- **No new authorization.** Phase 42D accepts a controlled dev/operator
  seeded live recall only — no production memory, no production memory
  admission, no durable production storage, no user-chat ingestion, no
  public recall, no cross-user consent / sharing. Everything in §K and §H
  stays in force; the recommended next step is a docs-only Admission Wedge
  decision gate, not production rollout.

---

## O. Acceptance criteria for Phase 41D

Phase 41D is acceptable if:

- the **live-Dixie Discord smoke-test acceptance report is added** (this
  file);
- the **decision map is updated** with a targeted Phase 41D addendum
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **Phase 41C runbook is updated / referenced** with a Phase 41D
  acceptance note
  (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`);
- the **Phase 41A gate is updated / referenced** with a Phase 41D note
  (`docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no secrets / raw IDs / tokens / screenshots / images** are
  committed;
- **no raw Dixie response bodies** (including `raw_reasons`) are pasted;
- **no production rollout, public recall, or served-memory claim** is
  made;
- **all blocked work remains blocked** (§K).

---

## P. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-DISCORD-SMOKE-ACCEPTANCE.md` — Phase 42D
  seeded live Discord smoke acceptance; records that the §N option `d`
  seeded lane was taken and the §J unseeded-estate blocker resolved into a
  safe served live recall (controlled dev/operator proof); §N.2 records its
  note.
- `docs/recall-wedge/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; selects the seeded
  dev/operator estate (this acceptance's §N option `d`) as the next MVP
  need toward a safe served live recall; §N.1 records its note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the governing procedure for this run;
  gains a Phase 41D acceptance note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the authority this acceptance preserves; gains a Phase
  41D note.
- `docs/recall-wedge/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, env config, and classification
  vocabulary the output narrows into.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  harness-demo smoke-test acceptance; the redacted-evidence template
  this report follows.
- `docs/recall-wedge/RECALL-WEDGE-DISCORD-DEMO-INTERNAL-GUIDE.md` — Phase 40B internal
  demo guide for the harness demo (separate command; gains a Phase 41D
  cross-reference).
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  gains a Phase 41D addendum.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — Phase
  41B live handler, env gates, fixed input, lazy load, render, no-leak
  scan (unchanged by Phase 41D).
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B regression / static-guard tests (unchanged by Phase 41D).
- `apps/bot/src/lib/publish-commands.ts` —
  `registerRecallWedgeLiveDemoCommand` (guild-scoped-only registration;
  unchanged by Phase 41D).
- `apps/bot/scripts/publish-commands.ts` — publish CLI entry point
  (unchanged by Phase 41D).
- `apps/bot/src/discord-interactions/dispatch.ts` — routes the live
  command as a distinct name (unchanged by Phase 41D).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — Phase
  37C live Dixie client; the only live-egress seam reached during this
  run (unchanged by Phase 41D).
