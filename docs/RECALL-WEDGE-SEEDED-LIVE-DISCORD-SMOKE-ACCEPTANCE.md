# Recall Wedge — Seeded Live Discord Smoke Acceptance

> **Phase 42D** (docs / smoke-test acceptance only). Date: 2026-05-31.
> Companion to
> `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` (Phase 42A
> seeded live estate / storage decision gate — the authority that
> selected the seeded dev/operator estate lane this acceptance records the
> served result of),
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` (Phase
> 41D live-Dixie Discord smoke-test acceptance — the safe-fail-closed
> result this acceptance advances to a safe served result, and the
> redacted-evidence template this report follows),
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`
> (Phase 41C operational runbook — the governing procedure this seeded
> run reused unchanged),
> `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` (Phase 41A
> decision gate — the live-command shape and gates this acceptance
> preserves without expanding),
> `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` (Phase 37B live Dixie
> client gate — the live client seam, its env, and its classification
> vocabulary, including the `served` class this run exercised), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A option matrix).
>
> This document records the controlled dev / operator smoke test that was
> run **after** the Dixie-side seeded estate work (direct Dixie Phase 32K
> seeded smoke) and the Freeside Characters Phase 42B / 42C client-side
> alignment, against a real Discord guild, with the live
> `/recall-wedge-live-demo` command wired to a live Dixie deployment whose
> estate was seeded with a reviewed deterministic dev/operator fixture. It
> does **not** add or authorize new code. It is the acceptance record for
> a single, controlled dev / operator seeded demo run — nothing more.
>
> It does not expand the Phase 41A / 42A authorizations. Anything Phase
> 41A / 41C / 41D / 42A blocked stays blocked here (see §K). This
> acceptance is for a **controlled dev/operator seeded live recall that
> was safely summarized in Discord** — it is **not** acceptance of
> production memory, memory admission, user chat ingestion, or public
> recall (see §H, §J). If a step seems to require reaching past those
> boundaries, the answer is to stop and open the next decision gate (§N) —
> not to relax it from this acceptance.

---

## A. Status and decision

Phase 42D is **docs / smoke-test acceptance only**.

- It **records the controlled dev / operator seeded smoke test** run
  after the Dixie-side seeded estate work and the Freeside Characters
  Phase 42B / 42C alignment, in one configured Discord guild, against a
  live Dixie deployment whose estate was seeded.
- It **does not add or authorize new code.** No source, test, package,
  lockfile, fixture, config, CI, or generated change is introduced by
  Phase 42D.
- It **does not authorize production rollout.**
- It **does not claim production memory admission** — the seeded estate
  is a reviewed dev/operator fixture admitted through a Straylight-owned
  path, not the production admission pipeline (§J).
- It **does not claim user chat became memory** — no Discord history, no
  "remember this," and no candidate-memory write was exercised (§H).
- It **does not claim public recall** — every response was ephemeral /
  operator-visible (§F, §I).
- It **does not authorize** Telegram, private chat, cross-user consent /
  sharing, LLM rewriting, character voice, forget / revoke / correction
  UI, or public renderer expansion.

### A.1 Decision sentence

**Phase 42D accepts the controlled dev/operator live Discord seeded-recall
smoke as passed: Freeside Characters / loa invoked the live Dixie
recall-intake seam and received a safe `served` result from a seeded
dev/operator continuity estate — guild-scoped, operator-gated, ephemeral,
with no `raw_reasons`, no raw Dixie payload, no pack / receipt body, no
token / JWT, no stack trace, and no public-channel-visible output — and
this is accepted as a controlled dev/operator seeded live recall proof,
not as production memory, memory admission, user-chat ingestion, or public
recall.**

This acceptance is conditional on the boundaries restated in §H (what
Phase 42D does not prove) and §K (blocked work remains blocked). Partial
compliance does not satisfy this acceptance.

### A.2 Naming note (binding for this document)

- **"Freeside Characters"** is the current Discord app / this repo / the
  Railway project and service that runs the bot. The current bot identity
  is **"loa."**
- **"Dixie"** is the upstream live Recall Wedge service this run reached
  (`POST /api/recall/intake`).
- **"Straylight"** is the memory / continuity substrate behind Dixie — the
  authority that holds the seeded estate and returns the governed recall
  result. Straylight, not Freeside Characters, owns the admission boundary.
- **"Finn"** (`loa_finn`) is an upstream Dixie depends on for a healthy
  overall state; Finn integration is outside this acceptance. A seeded
  served-recall result does not require, and this run does not claim, a
  healthy Finn.
- The bare word **"Freeside"** is **not** used here to name the current
  app. "Freeside platform" is reserved for the future broader platform and
  is out of scope for this acceptance.

### A.3 Phase ladder reconciliation (read first)

Phase 42A (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`)
selected a seeded dev/operator live estate as the next MVP need and
labelled the future seeded-estate lane "a future Phase 42B." The ladder
since resolved across the substrate boundary as follows; read Phase 42A's
"future Phase 42B" as realized by this sequence:

- **Dixie-side seeding (direct Dixie Phase 32K, v4b seeded smoke).** The
  seeded dev/operator estate and the served recall path were proven
  directly against live Dixie, off-Discord, before any Discord run (§D).
  The seed is a Straylight-owned admission of a reviewed deterministic
  dev/operator fixture — **not** owned or admitted by Freeside Characters.
- **Freeside Characters Phase 42B — safe pre-Dixie gate diagnostics.**
  Added safe, no-leak diagnostics on the `/recall-wedge-live-demo`
  pre-Dixie gate paths (refusal diagnostics), so a refused or
  fail-closed invocation is observable without exposing IDs, secrets, or
  upstream material.
- **Freeside Characters Phase 42C — seeded request / signature
  alignment.** Aligned `/recall-wedge-live-demo`'s request and signature
  shape to the Dixie Phase 32K-compatible seeded request shape, so the
  live command's authenticated intake matches what the seeded estate
  expects.
- **Phase 42D — this acceptance.** Records that, after the above and a
  deployment / restart / publish, the operator invoked
  `/recall-wedge-live-demo` and received `served` in Discord.

So where Phase 42A §M.a and the decision-map §5m say "a future Phase 42B
seeded live estate," read it as **Dixie-side Phase 32K seeding + Freeside
Characters Phase 42B (diagnostics) + Phase 42C (seeded-signature
alignment), accepted here as Phase 42D.** No boundary in Phase 42A's seed
constraints (§F of that gate) was relaxed by this resolution.

---

## B. Source evidence

This acceptance is grounded in the following artifacts. **No new code path
is introduced or accepted by Phase 42D** (it modifies none of these):

- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  decision gate; the authority that scoped the seeded dev/operator estate
  lane (its §E accepted target proof, §F seed constraints, §H required
  acceptance criteria). This run is the served result that lane aimed at.
  Gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; the safe-fail-closed baseline this run
  advances to a safe served result, and the redacted-evidence template
  this report follows. Gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the governing register / enable / invoke
  / evidence-capture procedure this seeded run reused unchanged, plus the
  §R.1 operational caveats (§L). Gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the separate `/recall-wedge-live-demo` command shape, its
  env gates (§G), input boundary (§H), output / no-leak boundary (§I),
  lazy-load boundary (§J), and logging boundary (§K), all preserved by
  this run. Gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client's env config and the classification
  vocabulary the rendered output narrows into, including the `served`
  class this run exercised for the first time end-to-end from Discord.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — the
  Phase 41B live command handler, as extended by Phase 42B (safe
  pre-Dixie gate diagnostics) and Phase 42C (seeded request / signature
  alignment): the env gates, the seeded deterministic input, the lazy
  live-client load only after the Discord gates pass, the classification →
  render decision, the single generic refusal string, the ephemeral-only
  response builder, and the final banned-substring no-leak scan.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B / 42B / 42C regression / static-guard tests; the local
  evidence behind the static posture.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — the
  Phase 37C operator/dev-only live Dixie client, as extended by Phase 42C
  for the seeded request / signature shape; the only live-egress seam
  reached during this run.
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C / 42C client tests.

State clearly:

- these source / test files are **evidence only**;
- **Phase 42D modifies none of them**;
- Phase 42D introduces no new source, test, fixture, package, lockfile,
  config, CI, or generated file.

---

## C. Test environment and redaction posture

- The test was performed in **one configured Discord guild** using the
  existing **Freeside Characters** shell bot application (identity "loa");
  no new application, token, or identity was introduced.
- Dixie was deployed to **Railway** and reachable at its public Railway
  URL; the **Freeside Characters service** received the live Dixie env
  (§E) on the same Railway project.
- The estate Dixie read was a **seeded dev/operator continuity estate** —
  a reviewed deterministic dev/operator fixture admitted through a
  Straylight-owned path on the Dixie side (§D, §J), **not** a production
  estate, a multi-tenant estate, an arbitrary user's estate, or anything
  derived from Discord chat.
- The raw Discord **bot token, guild ID, command ID, application ID, and
  user IDs are intentionally not recorded** in this document.
- The raw **Dixie base URL, service token, tenant ID, caller actor ID,
  request-key prefix, the minted Dixie JWT, the dev wallet / wallet
  address, any admin / allowlist key, the Postgres connection string, the
  seeded assertion IDs, and all Railway service / project identifiers are
  intentionally not recorded.**
- **Raw Dixie response bodies are not pasted** — only the narrowed,
  classifier-controlled summary shape is recorded (§F). In particular, **no
  `raw_reasons`, no recall pack body, no receipt body, no bounded-store
  scope detail, no tenant / debug material, and no upstream payload appear
  here.** The direct Dixie smoke confirmed a pack and a receipt were
  *present* (§D), but neither body is reproduced in this document or in
  Discord.
- **Screenshots / images are not committed** with this acceptance, and no
  binary evidence is attached.
- Evidence is recorded as **redacted operator observations** — what was
  seen, descriptively, not the operational identifiers, values, or secrets
  that produced it.
- **No secrets were pasted** into this report (consistent with the Phase
  41C runbook §M / §Q no-secrets posture, the Phase 42A §G no-committed-
  secrets constraint, and the handler's no-leak scan).

This redaction posture is deliberate: it mirrors the runbook's evidence-
capture rules (runbook §M), the Phase 42A seed constraints (no committed
secrets / live IDs), and the no-leak banned-substring posture the handler
enforces. The acceptance is meaningful *because* the operator observed the
gated, served, leak-free behavior — not because raw IDs, tokens, packs,
receipts, or payloads were copied here.

---

## D. Direct Dixie Phase 32K (v4b) seeded smoke — precondition (redacted)

Before any Discord run, a **direct Dixie Phase 32K (v4b) seeded smoke** was
run off-Discord against the live Dixie deployment and passed. Recorded
(redacted) observations, descriptive only:

- a **dev wallet was allowlisted in Dixie** — the allowlist call returned
  **HTTP 201** (the wallet value is not recorded);
- a **short-lived Dixie JWT was minted locally, not printed, and verified
  against Dixie with HTTP 200** (the token is not recorded);
- an **authenticated direct `POST /api/recall/intake` against the seeded
  estate returned HTTP 200** with **`outcome = served`**;
- the served result **had a recall pack present** (`has_pack = true`) and
  **had a receipt present** (`has_receipt = true`);
- the served result **exposed no raw reasons** (`has_raw_reasons = false`).

These preconditions establish that, on the Dixie side and independent of
Discord, the seeded dev/operator estate could be reached with a valid
short-lived token and returned a governed **served** recall result with a
pack and a receipt, and **without** raw reasons. This is the safe served
baseline the Discord run then exercised through the gated live command. No
pack body, receipt body, raw reasons, token, wallet, or estate identifier
is reproduced here.

---

## E. Freeside Characters live-Dixie + seeded-signature wiring (redacted)

The **Freeside Characters** service received the live Dixie env and the
Phase 42C seeded-signature alignment (placeholder names only; **no values
recorded**):

- `RECALL_WEDGE_DIXIE_BASE_URL`
- `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`
- `RECALL_WEDGE_DIXIE_TENANT_ID`
- `RECALL_WEDGE_DIXIE_CALLER_ACTOR_ID`
- `RECALL_WEDGE_DIXIE_REQUEST_KEY_PREFIX`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_ENABLED`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_REGISTER_COMMANDS`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_GUILD_ID`
- `RECALL_WEDGE_LIVE_DISCORD_DEMO_OPERATOR_USER_IDS`

This is the env shape the Phase 41C runbook §D / §I documents: the
`RECALL_WEDGE_LIVE_DISCORD_DEMO_*` Discord gates plus the separate Phase
37C `RECALL_WEDGE_DIXIE_*` client config. The Discord gates govern
*whether Discord may reach the client*; the `RECALL_WEDGE_DIXIE_*` env
governs *how the client authenticates to Dixie*. Phase 42C aligned the
**request and signature shape** the live command sends so it matches the
Dixie Phase 32K-compatible seeded request shape — no env value, request
body, or signature material is recorded here.

---

## F. Live invocation result — served seeded recall (safe classification)

Recorded (redacted) observations for the operator invocation:

- `/recall-wedge-live-demo` was registered to the configured guild and
  **published after the deployment / restart** (see §L caveat) so the
  dev-only live command was present;
- the operator invoked `/recall-wedge-live-demo` in the configured Discord
  guild;
- the response was **ephemeral / operator-visible** (only the invoking
  operator saw it);
- the Discord output returned a **safe served classification**:
  - `classification: served`
  - `outcome:        served`
  - `route:          /api/recall/intake`
  - `reason:         served`
- the Discord output **did not expose**:
  - `raw_reasons`;
  - the raw Dixie payload / response body;
  - the recall pack body;
  - the receipt body;
  - bounded-store scope detail;
  - tenant / debug material;
  - JWT / token / service-token material;
  - the seeded assertion IDs;
  - stack traces;
  - private identifiers / raw IDs.

This is the runbook §J.1 served-category shape: the fixed dev-only live
framing plus a narrowed `classification` / `outcome` / `route` / `reason`
summary, with the classifier-controlled `served` outcome and no raw
upstream material. The seeded estate's governed served recall was
classified into the Phase 37C `served` vocabulary and rendered as an
operator-safe summary — exactly the leak-free, ephemeral behavior the
Phase 41A §I output decision, the runbook §J, and the Phase 42A §E / §H
served-target boundaries require.

### F.1 Observed safe Discord output shape (illustrative, redacted)

The observed output matched this narrowed shape (illustrative — the
framing is fixed in code; the four data lines are classifier-controlled):

```
recall-wedge-live-demo · live Dixie dev demo (not production recall)
gated · operator-only · ephemeral · phase 37c live Dixie client output

classification: served
outcome:        served
route:          /api/recall/intake
reason:         served
```

Nothing beyond this narrowed shape was visible: no served recall body, no
recall pack, no receipt, no raw reasons, no payload, no IDs, no tokens, no
stack trace.

---

## G. What Phase 42D proves

Phase 42D proves, from the controlled dev / operator seeded smoke test,
that:

- **a seeded dev/operator continuity estate can be served live.** The
  direct Dixie Phase 32K (v4b) smoke reached the seeded estate with a valid
  short-lived token and returned `outcome = served` with a pack and a
  receipt present and no raw reasons (§D);
- **Freeside Characters / loa can be a live Discord surface for the Recall
  Wedge.** The gated `/recall-wedge-live-demo` command was registered and
  invoked in the configured guild, lazily loaded the Phase 37C live client
  only after the Discord gates passed, and the client called live Dixie at
  `POST /api/recall/intake` with the Phase 42C seeded-signature-aligned
  request;
- **Dixie's service token / seeded signer / keyring accepted the live
  call.** The authenticated intake from Freeside Characters was accepted by
  Dixie and reached the seeded estate, returning a governed served result;
- **the served result was classified `served` and rendered fail-safe.**
  The handler narrowed the result through the Phase 37C classifier and the
  final no-leak scan and rendered an **ephemeral** operator-safe summary
  showing only `classification` / `outcome` / `route` / `reason`;
- **no raw / private / debug / upstream material leaked.** The user-visible
  output exposed no `raw_reasons`, no raw Dixie payload, no recall pack
  body, no receipt body, no bounded-store scope detail, no tenant / debug
  material, no JWT / token / service-token material, no seeded assertion
  IDs, no stack traces, and no private IDs;
- **the command stayed guild-scoped, operator-gated, and ephemeral.** No
  public-channel-visible output was produced;
- **local Freeside Characters gates passed** before any live egress, and
  the Phase 42B safe diagnostics surfaced gate state without leaking;
- **the current MVP proof is now live, not fixture-only.** The Phase 41D
  result proved the pipe and a safe fail-closed; this run advances it to a
  **safe served live recall** from a seeded continuity estate.

These are observations about *this controlled run*. They confirm the Phase
41C runbook procedure works end-to-end against a real, **seeded** Dixie
deployment under the gates, and that the served path is safe — the served
content is governed, the render is narrowed, and nothing raw survives to
the ephemeral operator response. They do not extend the proof past §H.

---

## H. What Phase 42D does not prove

Phase 42D does **not** prove any of the following. These remain in scope
only for later, separately authorized phases:

- **production memory admission** — the served result came from a reviewed
  dev/operator seed admitted through a Straylight-owned path, not the
  production admission pipeline;
- **user chat becoming memory** — no Discord message / channel content was
  read into the seed or into any recall input;
- **remember-this / candidate-memory writes** — no candidate-review /
  promotion flow and no "remember this" surface was exercised;
- **Discord history ingestion** — none;
- **durable production storage** — the seeded estate is a controlled
  dev/operator fixture, not a production store of record;
- **production auth / consent** — the live reach used a short-lived
  manually minted token and an operator allowlist, not a production consent
  system;
- **cross-user consent / sharing** — no Person B read Person A's memory;
  the seeded estate is reachable only by the controlled operator/dev
  caller;
- **public rollout** — none;
- **public-channel recall** — every response was ephemeral / operator-
  visible;
- **Telegram / private-chat surfaces** — none;
- **LLM rewriting** — the served summary is the deterministic narrowed
  render, not a model-rewritten paraphrase;
- **character voice rendering** — the output is the fixed dev framing plus
  the four classifier lines, not a persona-voiced render;
- **forget / revoke / correction UI** — none;
- **a healthy Finn integration** — Finn integration is outside this
  acceptance and is not claimed;
- **a long-lived or production-grade Dixie service-token / JWT path** — the
  token used was short-lived and manually minted (§L).

If a later phase needs proof of any item above, it must propose a phase
that *names* the proof it intends to deliver and the gate it must clear —
it must not stretch this seeded-smoke acceptance to cover that ground.

---

## I. Security / no-leak assessment

- **No secrets recorded.** No bot token, Dixie service token, minted JWT,
  dev wallet / wallet address, admin / allowlist key, or Postgres
  connection string appears in this document or in any committed artifact
  for this phase.
- **No raw IDs recorded.** No guild, app, command, user, tenant, caller
  actor, or Railway service / project identifier, no request-key prefix,
  and no seeded assertion ID appears here.
- **No raw upstream material recorded.** No `raw_reasons`, no raw Dixie
  response body, no recall pack body, no receipt body, no bounded-store
  scope detail, no headers, and no request / signature body appear here.
- **No service URLs recorded.** The Dixie base URL and any service URL are
  not recorded.
- **The minted Dixie JWT was not printed** during the run; it was minted
  locally and verified by HTTP status only.
- **Discord output was served-safe and narrowed.** The operator-visible
  output exposed only the four classifier-controlled summary lines (§F) —
  no pack, no receipt, no payload, no IDs, no tokens, no stack trace —
  consistent with the handler's final banned-substring no-leak scan
  (`recall-wedge-live-demo.ts`) and the Phase 41A §I / §K output and
  logging boundaries.
- **Ephemeral only.** Every observed response was ephemeral (operator-
  visible), consistent with the runbook §N pass criteria.
- **No screenshots / images / binaries committed.**

The assessment: this run produced **no leak** of secrets, raw IDs, or raw
upstream material, and the Discord surface served safely. The redaction
posture of this document matches the no-leak posture the handler enforces
at runtime and the Phase 42A seed constraints.

---

## J. MVP status

- **Recall Wedge MVP live seeded recall proof is accepted.** The
  controlled dev/operator path — operator invokes `/recall-wedge-live-demo`
  in the configured guild → the gated handler lazily loads the Phase 37C
  client → the client authenticates to live Dixie with the Phase 42C
  seeded-aligned request → Dixie reads the seeded dev/operator estate →
  Straylight returns a governed served recall → Discord renders an
  ephemeral operator-safe summary with no leak — is demonstrated and
  accepted.
- **Be precise about what is accepted.** This is accepted as a **controlled
  dev/operator seeded live recall** proof. It is **not** accepted as
  production memory, production memory admission, durable production
  storage, user-chat ingestion, or public recall. The seeded estate is a
  reviewed deterministic dev/operator fixture admitted through a
  Straylight-owned path; Freeside Characters is a frame over the substrate,
  not the admission authority, the admission record, or the canonical store
  (decision-map §7).
- **The Phase 41D safe-failure baseline still holds.** Seeding added the
  served case; it did not remove the safe fail-closed case. Against an
  unseeded / empty estate, an invalid / expired token, or an unauthenticated
  call, the seam still fails closed exactly as Phase 41D accepted.

---

## K. Blocked work remains blocked

The following remain explicitly blocked. None is authorized by Phase 42D
(this restates the Phase 41A §O / Phase 41C §S / Phase 41D §K / Phase 42A
§L blocked-work lists, carried forward unchanged):

- production memory admission;
- candidate-memory writes;
- "remember this";
- arbitrary user memory writes;
- Discord message-history ingestion as memory input;
- live Discord message ingestion;
- user chat becoming memory;
- freeform recall query input;
- cross-user auth / consent;
- cross-user / Person-B-to-Person-A recall / sharing;
- public recall;
- public channel-visible recall;
- served recall memory as a shipped / production capability (Phase 42D
  accepts a controlled dev/operator seeded proof, not a capability claim);
- durable production storage;
- production / public rollout;
- mutation of `/recall-wedge-demo` into a live command;
- global registration;
- production auth / consent;
- production storage / admission UI;
- forget / revoke / correction UI;
- Telegram;
- private chat;
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

## L. Operational caveats

These are load-bearing for anyone repeating the seeded smoke test. They
carry forward the Phase 41D §L / runbook §R.1 caveats, plus the seeded-run
specifics.

### L.1 The manually minted Dixie JWT is short-lived

- The Dixie service token / JWT used for the live reach was **manually
  minted and short-lived.** **It must be refreshed for future demos.**
- An expired token surfaces as a safe classification (e.g.
  `service_unauthorized`) or the generic refusal — never a leak — but it
  will not exercise the served seam reach this run demonstrated.

### L.2 The Dixie wallet allowlist may be runtime / in-memory

- The dev wallet allowlist in Dixie **may be runtime / in-memory** and may
  need **re-adding after a Dixie redeploy / restart.** If the allowlist
  entry is gone, the live reach will fail closed safely rather than serve.

### L.3 Startup auto-publish can overwrite the live command registration

- Freeside Characters' startup auto-publish path can **overwrite the
  command registration**, removing `/recall-wedge-live-demo` from the
  configured guild. **`/recall-wedge-live-demo` must be published after a
  restart**, and Freeside Characters should not be restarted again between
  registration and invocation.

### L.4 Freeside Characters must be restarted after setting a fresh token

- Freeside Characters **must be restarted after setting a fresh Dixie
  token** so the live client picks up the new `RECALL_WEDGE_DIXIE_SERVICE_TOKEN`.

### L.5 Re-run the direct Dixie v4b smoke before future Discord demos

- If the environment has changed (Dixie redeploy, token refresh, allowlist
  reset, estate re-seed), **re-run the direct Dixie Phase 32K (v4b) smoke
  before the next Discord demo** to confirm the seeded served baseline (§D)
  still holds before exercising the Discord surface.

---

## M. Operator acceptance checklist

The operator confirmed every item below during the seeded smoke test:

- [x] direct Dixie Phase 32K (v4b) seeded smoke passed (allowlist HTTP 201,
      verify HTTP 200, recall HTTP 200, `outcome = served`, pack present,
      receipt present, raw reasons absent);
- [x] Freeside Characters service wired with the live Dixie env (§E);
- [x] Phase 42C seeded request / signature alignment in place;
- [x] `/recall-wedge-live-demo` published after the restart;
- [x] local Freeside Characters gates passed before any live egress;
- [x] operator invocation returned the safe served classification
      (`served` / `served` / `/api/recall/intake` / `served`);
- [x] response ephemeral / operator-visible;
- [x] no `raw_reasons` / raw payload / recall-pack body / receipt body /
      bounded-store scope / tenant / debug / JWT / token / stack-trace /
      seeded-assertion-ID / private-ID exposure;
- [x] no public-channel-visible output;
- [x] no production memory / admission language;
- [x] no user-chat ingestion;
- [x] screenshots / images / binaries not committed;
- [x] secrets / raw IDs / tokens / JWTs / wallets / service URLs / raw
      payloads not recorded.

---

## N. Next decision options

Phase 42D itself authorizes none of the following — it only accepts the
controlled dev/operator seeded live recall smoke result. Each option
carries its own proof obligation and re-opens its own decision artifact:

- **a. Stop and preserve this as controlled seeded-recall acceptance.**
  Treat this run as the accepted state and take no further live action.
- **b. Admission Wedge decision-gate planning (recommended next).** The
  natural next product wedge is **Admission** — how governed memory comes
  to *exist* — not full production rollout of the whole continuity stack at
  once. The recommended next step is a **docs-only decision gate**, e.g.
  `docs/RECALL-WEDGE-POST-ACCEPTANCE-ADMISSION-WEDGE-DECISION-GATE.md` (or
  similar), that scopes the safe future shape of an admission wedge under
  the decision-map §7 gates (raw → candidate → admitted separation,
  signer / consent / audit model, Straylight-owned admission boundary,
  forget / revoke behavior). **Admission is not implemented in this phase**
  — Phase 42D plans the gate, it does not open admission.
- **c. Separate token-hardening gate.** A longer-lived / safer dev
  service-token path (§L.1), only if it becomes a hard blocker for
  repeating the seeded smoke. Its own decision artifact.
- **d. Separate command-registration-hardening gate.** A tiny operational
  patch so startup auto-publish does not overwrite the gated dev command
  (§L.3). Its own decision artifact, with its own tests / static guards.
- **e. Keep public rollout blocked.** The default and recommended posture:
  public recall, served memory as a shipped capability, public-channel-
  visible output, and production admission stay blocked behind separate
  later gates (§K).

**Recommended:** option **b** (open a docs-only Admission Wedge decision
gate as the next product wedge), with option **a** as the always-available
stop, options **c / d** sequenced later only under their own gates, and
option **e** held throughout. Phase 42D authorizes none of them; the next
phase is the place to commit to one.

---

## O. Acceptance criteria for Phase 42D

Phase 42D is acceptable if:

- the **seeded live Discord smoke-test acceptance report is added** (this
  file);
- the **decision map is updated** with a targeted Phase 42D addendum
  (`docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`);
- the **Phase 42A seeded-estate gate is updated / cross-referenced** with a
  Phase 42D note
  (`docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md`);
- the **Phase 41D acceptance is updated / cross-referenced** with a Phase
  42D note
  (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md`);
- the **Phase 41C runbook is updated / cross-referenced** with a Phase 42D
  note
  (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md`);
- the **Phase 41A gate is updated / cross-referenced** with a Phase 42D
  note (`docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md`);
- **no source / test / package / lockfile / fixture / config / CI /
  generated changes** are made;
- **no screenshots / images / binary files** are committed;
- **no secrets / raw IDs / tokens / JWTs / wallets / admin keys / service
  tokens / Postgres URLs / service URLs / Railway IDs / seeded assertion
  IDs** are recorded;
- **no raw Dixie response bodies** (including `raw_reasons`, recall pack, or
  receipt) are pasted;
- **no production rollout, production memory admission, user-chat
  ingestion, or public recall claim** is made;
- **all blocked work remains blocked** (§K).

---

## P. Cross-references

- `docs/RECALL-WEDGE-SEEDED-LIVE-ESTATE-DECISION-GATE.md` — Phase 42A
  seeded live estate / storage decision gate; the authority that scoped
  this seeded lane and its served target proof / seed constraints /
  acceptance criteria; gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-SMOKE-TEST-ACCEPTANCE.md` — Phase
  41D smoke-test acceptance; the safe-fail-closed baseline this run
  advances to a safe served result, and the redacted-evidence template this
  report follows; gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DEMO-OPERATIONAL-RUNBOOK.md` —
  Phase 41C operational runbook; the governing procedure this seeded run
  reused unchanged; gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-DISCORD-DECISION-GATE.md` — Phase 41A
  decision gate; the live-command shape and gates this acceptance
  preserves; gains a Phase 42D note.
- `docs/RECALL-WEDGE-LIVE-DIXIE-CLIENT-GATE.md` — Phase 37B live Dixie
  client gate; the live client seam, env config, and classification
  vocabulary the served output narrows into.
- `docs/RECALL-WEDGE-DISCORD-DEMO-SMOKE-TEST-ACCEPTANCE.md` — Phase 39E
  harness-demo smoke-test acceptance; the original redacted-evidence
  template this lineage follows.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A option matrix;
  gains a Phase 42D addendum.
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.ts` — Phase
  41B live handler, extended by Phase 42B (safe pre-Dixie gate diagnostics)
  and Phase 42C (seeded request / signature alignment); env gates, seeded
  input, lazy load, render, no-leak scan (unchanged by Phase 42D).
- `apps/bot/src/discord-interactions/recall-wedge-live-demo.test.ts` —
  Phase 41B / 42B / 42C regression / static-guard tests (unchanged by Phase
  42D).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.ts` — Phase
  37C live Dixie client, extended by Phase 42C for the seeded request /
  signature shape; the only live-egress seam reached during this run
  (unchanged by Phase 42D).
- `packages/persona-engine/src/recall-wedge/live-dixie-client.test.ts` —
  Phase 37C / 42C client tests (unchanged by Phase 42D).
