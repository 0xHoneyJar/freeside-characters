# Recall Wedge — live-boundary decision

> **Phase 36A** (docs-only). Companion to
> `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance),
> `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map),
> and `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` (Phase 35C
> multi-surface contract).
>
> This document is a **decision doc**, not implementation. It picks the
> next direction after Phase 35D and records why. No code, package,
> lockfile, Discord wiring, Telegram wiring, live
> Dixie/Straylight/Finn integration, production storage, live memory
> admission, or LLM/voice rewrite changes are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this doc, re-open the boundary doc — do not silently
> expand scope from this decision.

---

## 1. Status after Phase 35D

The fixture-bound Recall Wedge ladder is complete through 35D:

- **Phase 33A** — boundary decision doc
  (`docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md`).
- **Phase 33B** — reviewed seed memory packet + projected DTO fixtures
  (operator-private, public-discord, character-boundary-referral) +
  no-leak fixture validator
  (`docs/recall-wedge/fixtures/`,
  `docs/recall-wedge/fixtures/validate-fixtures.mjs`).
- **Phase 33C** — deterministic public-safe Recall Wedge renderer with
  fail-closed input scan and rendered-output leak guard
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`).
- **Phase 33D** — fixture-bound cross-interface continuity demo binding
  all four proof properties
  (`packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`).
- **Phase 34A** — final MVP acceptance handoff
  (`docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md`).
- **Phase 35A** — post-MVP decision map
  (`docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md`).
- **Phase 35B** — explicit dev/operator demo runner
  (`packages/persona-engine/src/recall-wedge/run-demo.ts`).
- **Phase 35C** — multi-surface interaction contract
  (`docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md`).
- **Phase 35D** — recorded Dixie envelope fixtures + pure adapter +
  adapter unit tests
  (`docs/recall-wedge/fixtures/dixie-envelope/*`,
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts`,
  `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`).

### What Phase 35D specifically proves

- Recorded Dixie-safe envelope fixtures exist on disk under
  `docs/recall-wedge/fixtures/dixie-envelope/`, with explicit
  `envelope_version`, `input_envelope_kind`, synthetic flag, and
  non-production authorization note. Three fixtures cover a normal
  public envelope, a referral/downgrade envelope, and an unknown-version
  envelope used to drive fail-closed tests.
- The Dixie envelope adapter is a **pure local function**: synchronous,
  in-memory, no network, no Discord/Telegram/Dixie/Finn/Straylight/
  storage/LLM imports, verified by a static-import test.
- The adapter is the **only narrowing boundary** from Dixie-shaped
  envelope to local projected DTO. The Phase 33C public renderer is
  bound to the projected-DTO contract, and a regression test proves
  the renderer rejects raw envelopes.
- The adapter **fails closed** on:
  - non-object input (`not_object`);
  - missing or unknown `envelope_version`
    (`missing_dixie_envelope_version` / `unsupported_dixie_envelope_version`);
  - wrong `input_envelope_kind`;
  - missing `target_projection` or `public_recall_payload`;
  - unknown outcome / missing referral fields;
  - unsupported targets — `authorized_private_session`
    (`authorized_private_projection_not_implemented`) and
    `public_telegram` (`public_telegram_projection_not_implemented`);
  - banned private/raw/debug material in any allowed source field
    or in the reconstructed projection
    (`banned_private_material_in_projection`), with a pre-normalization
    scan that catches contamination *before* the
    finite-non-negative-int filter could erase it from
    `public_reason_counts`.
- Raw Dixie envelope material — `raw_dixie_debug`, `raw_session_trace`,
  `source_material`, `PRIVATE_SENTINEL_*`, `session_id`, `message_id`,
  `continuity_actor_id` — never reaches the public renderer, proven by
  source-fixture sentinel-presence tests (so the proof cannot become
  vacuous) and adapted-DTO + rendered-output banned-substring scans.
- `public_telegram` and `authorized_private_session` remain **not
  implemented**. Both fail closed with stable error codes; neither has
  a renderer in this repo.

The accepted §1 ladder + §35D adapter form the **last fully
fixture-bound, pre-live boundary** before any live integration. Phase
36A is where the live-boundary direction is decided.

---

## 2. Decision to make

After Phase 35D, the next implementation phase must pick a direction.
The candidate paths are:

- **A — recorded-envelope-bound Dixie/session path** (still
  pre-live, dev/operator-gated): expand recorded Dixie envelope
  fixtures and the adapter/validator/test surface around them, then
  optionally add a thin dev/operator runner over the Phase 35D
  adapter. No positive `authorized_private_session` projection. No
  `authorized_private_session` renderer. No live Dixie network call.
  "Private" here means **public-safe, refusal, downgrade, or
  fail-closed** recorded envelope cases, not a positive private
  rendering.
- **B — fixture-only public Discord demo**: tightly gated slash-command
  demo, fixture-bound, public-safe renderer only.
- **C — fixture-only Telegram demo**: equivalent fixture-bound demo on
  the Telegram surface (group public-safe, or DM with no authorized
  upgrade).
- **D — live Dixie client**: replace recorded fixtures with calls to a
  Dixie-safe envelope endpoint.
- **E — production storage / admission design**: canonical store
  + admission path + signer / audit / challenge / revoke.

Any of A–E can be argued for. This doc picks one and records why the
others are blocked or premature.

---

## 3. Recommendation

**The next implementation phase (Phase 36B) should be a
**recorded-envelope-bound Dixie/session path** — Option A — kept
dev/operator/private and recorded-envelope-bound, before any
public/community surface and before any live Dixie network call.**

What "recorded-envelope-bound Dixie/session path" means here, exactly:

- **Recorded envelope expansion + adapter/validator/test work first**;
  a thin dev/operator runner is optional and only after that proof
  exists.
- **No positive `authorized_private_session` projection** is
  authorized. The Phase 35D adapter's negative `authorized_private_session`
  fail-closed (`authorized_private_projection_not_implemented`)
  remains in force. Recorded fixtures may *target*
  `authorized_private_session` only to exercise that negative path.
- **No `authorized_private_session` renderer** is authorized.
- **No `public_telegram` renderer** is authorized.
- **No live Dixie network call** is authorized.
- The "private" in this path means **public-safe, refusal,
  downgrade, or fail-closed** recorded envelope cases — never a
  positive private rendering.

Rationale:

- Dixie/Finn are the **expected** chat/session envelope direction,
  but Phase 36A does **not** prove live Dixie/Finn readiness. Current
  repo work proves recorded Dixie-shaped envelopes and a pure adapter,
  not live Dixie/Finn availability. Treating the recorded shape as
  the natural axis to extend follows the existing proof; it does not
  imply Dixie is ready to be called over a wire.
- Phase 35D already shipped the pure adapter and recorded envelope
  fixtures. The shortest credible next step is to expand that work
  along the dimension the adapter already understands — recorded
  envelopes — rather than open a new public surface that needs
  command registration, identity binding, public no-leak guards, and
  user-facing copy decisions before the envelope contract is even
  exercised end-to-end.
- The **multi-surface contract §5a authorized-private DTO gate** is
  **unsatisfied**. Until that gate ships, no `authorized_private_session`
  renderer can land. A recorded-envelope-bound Phase 36B can
  productively expand fixtures, add refusal/downgrade shapes, and
  exercise the existing public-safe renderer through the adapter —
  without ever crossing the multi-surface contract §5a authorized-
  private DTO gate or producing a positive `authorized_private_session`
  projection.
- A recorded-envelope/dev-gated path keeps blast radius minimal. No
  Discord application changes. No Telegram bot wiring. No
  `apps/bot/src/discord-interactions/*` changes. No production data
  path. Mistakes surface in operator-only output, not in a public
  channel.

**Phase 36B should not be**: live Discord, live Telegram, live Dixie,
or production storage/admission. Those are addressed in §4–§7 below
and remain blocked.

---

## 4. Why not Discord first

A live Discord recall command — even a tightly gated fixture-bound
demo — introduces a coordinated set of risks that Phase 36B should not
be carrying alongside live-boundary work:

- **Command registration scope** — global vs guild, dev guild vs
  public guild, and whether the command is published at all. This is a
  one-way decision once published globally, and reversing it is
  visible to every user of the bot.
- **Guild visibility** — once a slash command is registered in a
  shared guild, members see it in the picker. Even a fixture-bound
  demo command surfaces as if it were live, and "fixture-bound" is
  not visible in the Discord command list.
- **Public-channel delivery** — ephemeral vs public delivery, rate
  limiting, and the multi-surface contract §6 anti-spam rules
  (explicit invocation only, no ambient listening, no passive recall,
  no automatic memory admission). The substrate already enforces
  anti-spam invariants for the existing `/ruggy` and `/satoshi`
  commands; adding a recall command without first stabilizing the
  envelope path would couple Recall Wedge to those operational gates
  before the contract is exercised.
- **Operational logging risk** — Discord's interaction logs, our
  per-fire JSONL caches, and any future audit log must be redacted of
  raw Dixie material, raw reasons, actor identifiers, and assertion
  IDs. Without an end-to-end exercise of the adapter through dev
  output first, log-redaction discipline is harder to specify.
- **User-expectation risk** — once a public surface answers a recall
  query, users assume the substrate has memory of *them*, even if the
  fixture-bound label says otherwise. Public surfaces should land
  after the private path proves the contract.
- **Post-MVP decision map §5a Discord operational gates** —
  registration scope, dev visibility, kill switch, admin-only
  invocation, ephemeral-vs-public delivery, redacted logs,
  fixture-bound labeling, public no-leak tests, no ambient/passive,
  no admission — all apply. Each is satisfiable, but bundling all of
  them into Phase 36B alongside the first live-boundary work would be
  too large a single phase.

Fixture-only Discord remains a defensible alternative path — see §11.
It is just not the immediate next step.

---

## 5. Why not Telegram first

Telegram is in scope as a target surface class
(`docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` §3, §7), but it
introduces frame-decision risks Discord does not:

- **DM identity / authorization ambiguity** — a Telegram DM may behave
  like an `authorized_private_session` *only* after caller
  authorization is established (multi-surface contract §7a). Without
  identity binding, the DM falls back to public-safe behavior or
  refusal (§7b). Identity binding to a Loa-side authorized identity
  is unspecified and not solved by Phase 35D.
- **Group / public chat behavior** — Telegram groups behave like
  public Discord (`recall_interface=public_telegram`,
  `render_surface=telegram_group_character`) and need the same
  public-surface gates plus a *new renderer*. The Phase 33C renderer
  is Discord-specific by construction (multi-surface contract §8a);
  reusing it on Telegram is not authorized without an explicit
  per-surface contract, no-leak guard, and test pass.
- **Anonymous admin / channel-as-poster ambiguity** — Telegram
  groups carry caller-identity ambiguity Discord does not (anonymous
  admin posts, channel-as-poster posts). The default must be refusal
  when identity is ambiguous (multi-surface contract §7e), and that
  refusal contract is unwritten in code.
- **Privacy mode implications** — Telegram bot privacy mode controls
  visibility of group messages, which interacts with the no-ambient,
  no-passive rules.
- **Group-to-DM transition** — surfaces don't silently inherit
  authorization across context (multi-surface contract §7e). This is
  a non-trivial state-machine and needs design before live Telegram.

Telegram should wait until adapter/render contracts are stable for at
least one private surface and identity-binding assumptions are
specified.

---

## 6. Why not production storage / admission yet

Storage and admission are the load-bearing decisions of any live
memory system. They are deliberately deferred per
post-MVP decision map §3 Option D and §7 (live memory admission
gates), and they remain deferred:

- **Storage availability ≠ admission permission.** Putting Postgres
  + object storage + a vector index in front of the adapter does not
  decide *who is authorized to admit* an assertion, *what counts as
  consent*, or *how revocation propagates*. Storage without admission
  rules is a write target, not a memory authority.
- **Admission needs a Straylight-owned path.** Per
  `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` §5 (read/recall only), §6
  (Discord interaction logs are not memory by default), and §14
  (production storage); post-MVP decision map §7 (live memory
  admission gates); and multi-surface contract §10 (memory admission
  boundary):
  - explicit authorization (signer / admission authority);
  - recorded, auditable consent assumptions;
  - signer / admission authority — who is allowed to admit on whose
    behalf;
  - audit — every admission produces a verifiable record;
  - challenge / revoke / forget — admitted assertions can be
    challenged, revoked, forgotten;
  - canonical storage with derived retrieval indexes only (the vector
    index is not the source of truth).
- **Bundling storage with the first live-ish surface is too large.**
  A surface demo that ships a storage path implicitly answers
  questions about retention, identity, signer authority, and
  challenge that have not been designed. Once shipped, those become
  defaults that are hard to roll back.
- **Phase 35D does not require any storage decision.** The adapter
  reads JSON in memory and produces an in-memory projection. Phase
  36B can extend that without writing to candidate or admitted
  memory. Admission stays exactly where it is — out of scope.

Storage / admission is its own design phase, not a sub-task of the
first live-ish surface.

---

## 7. Dixie / private-session boundary — what must be decided before live Dixie

A live Dixie client (post-MVP decision map §3 Option C / §6 live
Dixie gates) requires the following to be decided in writing before
any network-touching code lands. None of these are decided here;
this section names the gate.

- **Endpoint / envelope shape** — exact request/response shape for a
  Recall Wedge envelope. Phase 35D fixtures **exercise one sample
  recorded v0 shape** (`recall_wedge.dixie_envelope.v0`) without
  treating it as production schema authority; a live client needs a
  stable contract documented on the Dixie side and reconciled with
  this repo's recorded fixtures.
- **Dixie-side owning artifact / sign-off** — before this repo
  treats any recorded fixture version as a live contract, the live
  Dixie endpoint / envelope shape **must be documented or owned on
  the Dixie side** (a Dixie-repo schema doc, an OpenAPI / RPC
  artifact, or an explicit cross-repo decision recording who owns
  the live envelope contract). freeside-characters recorded fixtures
  are **examples / contract probes**, not the production envelope
  schema authority. Live contract truth must come from a Dixie-side
  artifact, endpoint contract, or cross-repo decision — not from
  whatever shape happens to be checked into this repo's
  `dixie-envelope/` directory.
- **Envelope versioning** — `envelope_version` field semantics, how
  v0 → v1 transitions are gated (additive only, breaking-with-shim,
  or hard cut), and how the adapter handles unknown future versions
  beyond the current `unsupported_dixie_envelope_version` fail-closed
  shape.
- **Auth / caller model** — how the Dixie client authenticates, who
  the caller is from Dixie's perspective, and how the
  freeside-characters substrate's continuity actor is named to Dixie
  *without* exposing the internal `continuity_actor_id` to public
  output (multi-surface contract §9 allowlist).
- **Tenant / community / session boundary** — which tenant or
  community owns a session, whether tenants are isolated at the
  envelope layer, and how cross-tenant requests are refused.
- **`sessionId` / `messageId` handling** — these are operational
  identifiers, not memory identifiers (multi-surface contract §5).
  Their lifetime, scope, and rotation policy must be specified, plus
  the rule that they never appear on a public surface.
- **Refusal / error semantics** — what Dixie returns on
  unauthorized / not-found / rate-limited / partial-recall, and how
  the adapter maps each to a stable error code with no raw Dixie
  body bleed.
- **Idempotency / retry behavior** — whether a Recall Wedge call is
  safe to retry, how duplicate calls are deduplicated, and whether
  retries can produce different projections for the same logical
  request.
- **No raw Dixie passthrough** — the live adapter must remain the
  narrowing boundary. The renderer never reads a Dixie response
  directly. This is a Phase 35D-shaped invariant carried forward.
- **Adapter remains narrowing boundary** — even with a live
  endpoint, the adapter is the only component that reads the Dixie
  envelope. Renderers, runners, surface frames, command handlers,
  and logs all consume the local projected DTO, not the live
  envelope.
- **Local fallback behavior** — what happens when Dixie is
  unreachable, partially responding, or returning a malformed
  envelope. Default must be refusal/downgrade, not a synthesized
  fallback that a user could mistake for memory.
- **Audit / receipt expectations** — what evidence (request IDs,
  timestamps, redacted summaries) is recorded, where it lives, and
  the rule that audit records never carry raw Dixie material.

Phase 36B can be specified and implemented (privately, against
recorded envelopes) without any of the above being final. A live
client cannot.

### 7a. Recorded fixtures are examples, not schema authority

This sub-section is load-bearing for the §7 gate above and is called
out explicitly because the inertia risk is real: a recorded fixture
that survives several phases can quietly come to be treated as if it
were the production schema. It is not.

- **Recorded Dixie envelope fixtures under
  `docs/recall-wedge/fixtures/dixie-envelope/` are sample v0 contract
  probes.** They exist to exercise the adapter's narrowing boundary,
  fail-closed paths, refusal/downgrade shapes, and public no-leak
  invariants. They do **not** define the live envelope.
- **They are not canonical production schema authority.** The
  freeside-characters repo does not own the Dixie envelope schema.
  Memory authority remains with Straylight; envelope-shape authority
  remains on the Dixie side once a Dixie-owned artifact exists
  (§7 above).
- **They must not become production schema by inertia.** Adding more
  recorded fixtures, version bumps, or adapter dispatch entries does
  not promote any of those shapes to "the live contract." Promotion
  requires the §7 Dixie-side owning artifact / sign-off gate.
- **A future live-Dixie phase must reconcile recorded fixtures with
  a Dixie-owned contract.** Where the two diverge, the Dixie-owned
  contract wins; the recorded fixtures are updated, deprecated, or
  retired. The adapter's `unsupported_dixie_envelope_version`
  fail-closed remains the safety net while reconciliation is in
  progress.

Phase 36B may add more recorded fixtures (§10). It must not represent
those fixtures as the production envelope schema, in code, in
comments, in commit messages, or in user-facing copy.

---

## 8. Authorized-private remains blocked

This restates the multi-surface contract §5 (authorized private
session contract) and the multi-surface contract §5a authorized-
private DTO gate: no `authorized_private_session` renderer is
authorized in any phase before the multi-surface contract §5a
authorized-private DTO gate is satisfied.

- `authorized_private_session` is **not implemented**. The Phase 35D
  adapter fails closed with code
  `authorized_private_projection_not_implemented` for that target.
- **No private renderer exists yet.** The Phase 33C renderer is bound
  to `recall_interface=public_discord` /
  `render_surface=discord_public_character`. It is not authorized for
  private rendering, and reusing it for private targets would silently
  leak the public allowlist's structural assumptions into private
  surfaces.
- Before authorized-private recall lands, a future phase **must**
  satisfy the multi-surface contract §5a authorized-private DTO gate
  by defining and shipping:
  - the minimum authorized-private projected DTO shape (separate from
    the public-safe DTO and separate from `operator_private`);
  - the explicit allowlist of fields permitted in an authorized-private
    DTO;
  - the explicit denylist (at minimum: `raw_reasons`, debug payloads,
    hidden estate material, private assertion IDs, source material,
    actor identifiers, raw chat log contents, raw operator diagnostic
    payloads);
  - downgrade / refusal behavior when caller authorization is absent
    or insufficient;
  - tests for authorized vs unauthorized private sessions;
  - a structural guarantee that private DTOs cannot include any field
    whose presence implies admission, and that the adapter never
    writes to candidate or admitted memory as a side effect of
    producing the DTO.
- **Authorized-private does NOT mean a raw estate / debug / source
  dump.** "Broader context" is whatever is *explicitly approved* for
  `authorized_private_session` in the multi-surface contract §5a
  authorized-private DTO gate above. Until that approval exists,
  "broader" is empty.

Phase 36B may produce **negative** `authorized_private_session`
recorded fixtures (i.e. fixtures that target
`authorized_private_session` only to exercise the adapter's
fail-closed `authorized_private_projection_not_implemented` path) and
refusal/downgrade recorded fixtures. It must not produce a positive
`authorized_private_session` projection and must not produce an
authorized-private renderer.

---

## 9. Public surfaces remain blocked

This restates the multi-surface contract §6 (Discord public contract)
and §7 (Telegram contract), plus post-MVP decision map §5 (decision
gates before any live Discord command) and §5a (Discord command
operational gates): no live public surface is authorized by this
doc.

- **No live Discord recall command yet.** The substrate's existing
  Discord shell carries `/ruggy` and `/satoshi` persona invocations.
  No recall command is registered, and none is authorized by Phase
  36A.
- **No Telegram bot wiring yet.** No Telegram application, no
  Telegram identity binding, no Telegram renderer.
- **No `public_telegram` renderer yet.** The Phase 33C renderer is
  Discord-specific by construction. A `public_telegram` renderer
  needs its own no-leak / fail-closed / no-raw-debug invariants and
  test surface (multi-surface contract §8a future-renderer warning).
- **No public surface receives raw Dixie envelope material.** This
  invariant survives any phase. The adapter is the only component
  that reads the envelope; renderers consume the projected DTO only.
- **Public surfaces require, before going live:**
  - explicit invocation only (no ambient, no passive);
  - public-safe renderer with strict allowlist;
  - public-safe error / refusal contract;
  - no `raw_reasons` / debug / private IDs / actor identifiers in
    output;
  - no live memory admission as side effect;
  - `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`-style no-leak tests;
  - command registration scope decision, dev/guild visibility
    decision, kill switch, admin-only invocation if demo, ephemeral
    vs public delivery decision, redacted operational logging,
    fixture-bound labeling in user-facing copy
    (post-MVP decision map §5 live-Discord gates and §5a Discord
    operational gates).
- **Surface adapters do not own memory.** This rule survives any
  surface (Discord, Telegram, web private chat).

---

## 10. Proposed next implementation phase

**Phase 36B — recorded Dixie envelope expansion + adapter / validator
tests, with optional thin operator runner.**

### 10a. Required ordering inside Phase 36B

Phase 36B has an explicit internal order. The order matters because
adding a runner before the recorded-envelope and adapter/validator
proof exists would invert the dependency: the runner would shape the
fixture set instead of the fixture set shaping the runner.

1. **Expand recorded Dixie envelope fixtures first** — pure JSON
   under `docs/recall-wedge/fixtures/dixie-envelope/`. Synthetic.
   `non_production_authorization_note` present. Each fixture
   self-describes its `envelope_version`, `input_envelope_kind`,
   and `target_projection`.
2. **Extend the validator and the adapter tests.** The fixture
   invariants — `synthetic`, `fixture_kind`,
   `input_envelope_kind`, supported / intentionally-unsupported
   `envelope_version`, `non_production_authorization_note` — must
   be enforced by `docs/recall-wedge/fixtures/validate-fixtures.mjs`
   and exercised by
   `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts`.
   Any new fixture that the adapter can or must reject lands with a
   matching adapter test.
3. **Only after step 2 lands, optionally add a thin dev/operator
   runner mode** over those recorded envelopes — a small extension
   to the existing Phase 35B `run-demo.ts` style, output labeled
   clearly as fixture-bound and dev-only. The runner is a
   *consumer* of the proof from steps 1–2, not a substitute for it.

### 10b. Suggested fixture expansions

These shapes are appropriate for step 1 above. Each one extends what
the adapter already understands without crossing a renderer boundary
the adapter is not allowed to cross.

- **Refusal / unauthorized envelope** — recorded shapes representing
  a Dixie response where the caller is not authorized for the
  requested view. The adapter narrows these to a public-safe refusal
  or rejects per the multi-surface contract §5a authorized-private
  DTO gate later. No positive `authorized_private_session` projection
  is produced.
- **Downgrade / referral envelope variants** — additional referral
  shapes beyond the existing `recorded-referral-recall-envelope.v0`
  fixture (e.g. different referral targets, different referral
  messages, denied-or-refused with no referral target).
- **Session-bearing `sessionId` / `messageId` envelopes** — recorded
  shapes carrying operational identifiers to exercise the adapter's
  stripping of operational identifiers from the projected DTO. These
  test the rule that `sessionId`/`messageId` are operational
  identifiers, not memory identifiers (multi-surface contract §5).
- **Malformed / missing-fields envelopes** — recorded shapes with
  missing `target_projection`, missing `public_recall_payload`,
  unknown `outcome`, missing referral target, missing referral
  message, etc. Each one drives a specific adapter fail-closed code.
- **Unsupported version envelope variants** — recorded shapes with
  additional unknown `envelope_version` values to exercise
  `unsupported_dixie_envelope_version` across more than one literal.
- **Negative `authorized_private_session` target** — recorded shapes
  whose `target_projection.recall_interface=authorized_private_session`,
  used **only** to exercise the adapter's fail-closed
  `authorized_private_projection_not_implemented` path. These do
  **not** authorize an authorized-private projection; they only
  prove the negative path stays negative.
- **Negative `public_telegram` target** — recorded shapes whose
  `target_projection.recall_interface=public_telegram`, used only to
  exercise the adapter's fail-closed
  `public_telegram_projection_not_implemented` path.

### 10c. Required boundaries for Phase 36B

These are not soft preferences; they are the lines Phase 36B does
not cross.

- **No positive `authorized_private_session` projection** — the
  Phase 35D adapter's negative fail-closed
  (`authorized_private_projection_not_implemented`) remains in force.
  Phase 36B does not produce a positive
  `authorized_private_session` DTO from any envelope. Multi-surface
  contract §5a authorized-private DTO gate must be satisfied first.
- **No `authorized_private_session` renderer.**
- **No `public_telegram` renderer.**
- **No Discord command wiring** (no changes under
  `apps/bot/src/discord-interactions/*`, no command registration).
- **No Telegram command wiring.**
- **No live Dixie network call** — recorded fixtures only. A live
  Dixie client requires the §7 gate above (including the Dixie-side
  owning artifact / sign-off), and that decision lands in **a later
  live-Dixie decision phase**, not in Phase 36B.
- **No production storage or admission.**
- **No LLM / voice rewrite.**
- **No character-voiced recall output.**

If a refusal-shaped fixture or thin dev runner reveals that the
adapter's contract needs sharpening, that sharpening lands inside
Phase 36B. If it reveals a live-boundary decision that Phase 36A did
not anticipate, Phase 36B stops and Phase 36A is reopened.

---

## 11. Alternative path if the team wants a public demo first

If the team prefers a public surface demo before extending the
recorded-envelope-bound Dixie/session path, the safe alternative is
**Phase 36B-alt — fixture-only Discord or Telegram demo**, satisfying
all of the following:

- **Clearly labeled fixture-bound** in user-facing copy. The label
  must appear in the demo output itself, not only in a description
  field.
- **Must not imply live memory.** Demo copy must distinguish
  "fixture-bound demonstration" from "actual recall of you."
- **No admission as side effect.** The demo does not write to
  candidate or admitted memory under any path.
- **No live Dixie.** The demo runs against the Phase 35D adapter +
  recorded envelope fixtures only.
- **No production storage.** No Postgres, no object store, no
  vector index, no Redis. In-memory only.
- **Public renderer only.** For Discord: Phase 33C
  `renderPublicRecallProjection`. For Telegram: a new
  Telegram-specific renderer satisfying the multi-surface contract
  §8a future-renderer warning's no-leak / fail-closed / no-raw-debug
  invariants, with its own tests. Reusing the Discord renderer on
  Telegram is not authorized.
- **No character voice.** Voiceless data billboards only
  (boundary doc §12 voice posture, post-MVP decision map §3 Option F).
- **Command operational gates satisfied.** Post-MVP decision map §5a
  Discord operational gates: registration scope, dev visibility, kill
  switch, admin-only invocation, ephemeral-vs-public delivery,
  redacted logs, fixture-bound labeling, public no-leak tests, no
  ambient/passive, no admission. For Telegram, additionally
  multi-surface contract §7e Telegram-specific authorization gates:
  identity binding, account unlink/revocation, group-to-DM transition
  handling, privacy mode implications, anonymous admin ambiguity,
  explicit authorization mode per invocation.

**36B-alt is allowed but not recommended.** It does not extend the
envelope contract proof in any new direction and adds operational
gates that the recorded-envelope-bound Dixie/session path does not
require.

---

## 12. Decision table

| Path | Benefit | Risk | Missing prerequisites | Recommended status |
|------|---------|------|------------------------|---------------------|
| **A — recorded-envelope-bound Dixie/session path** (recorded envelope expansion + adapter/validator/tests; optional thin operator runner) | Extends the Phase 35D envelope contract along its natural axis (recorded-shape). Stays dev/operator/private. No new operational gates. Smallest blast radius. Exercises refusal/downgrade/fail-closed shapes before any surface uses them. | Doesn't deliver a user-visible demo. May feel like "more fixtures." Recorded fixtures must not drift into being treated as production schema (§7a). | None for the recorded path itself. The multi-surface contract §5a authorized-private DTO gate is **only** required if a positive `authorized_private_session` projection or renderer is built; Phase 36B builds neither. | **Recommended Phase 36B.** Pre-live, dev-gated, recorded-envelope-bound. |
| **B — fixture-only Discord demo** | Visible end-to-end public-surface demo. Familiar shape. | Discord registration scope is one-way; user-expectation risk; couples to public-surface operational gates before envelope contract is end-to-end-exercised. | Post-MVP decision map §5a Discord operational gates, `apps/bot/src/discord-interactions/*` discipline, fixture-bound user-facing copy. | **Allowed alternative (36B-alt).** Not recommended as the immediate next step. |
| **C — fixture-only Telegram demo** | Adds a second public surface. | Brings DM identity-binding, group/public-chat ambiguity, anonymous-admin ambiguity, group-to-DM transition, and privacy-mode questions. Needs a new renderer (no reusing Phase 33C). | Multi-surface contract §7a–§7e Telegram-specific gates, plus a new Telegram-specific public renderer with multi-surface contract §8a future-renderer-warning-equivalent no-leak / fail-closed tests. | **Defer.** Telegram waits until adapter/render contracts and identity-binding are specified. |
| **D — live Dixie client** | Moves toward real cross-repo architecture. Pins envelope shape against a real producer. | Auth, envelope stability, failure handling, tenant boundary, retry semantics — all unspecified. Premature without the §7 live-Dixie gate (including the Dixie-side owning artifact / sign-off). | Post-MVP decision map §6 live-Dixie gates + this doc §7 (including §7a fixtures-not-schema-authority): endpoint/envelope shape, Dixie-side owning artifact, versioning, auth/caller model, tenant boundary, sessionId/messageId handling, refusal/error semantics, idempotency/retry, audit/receipt expectations. | **Defer to a later live-Dixie decision phase.** Recorded envelope fixtures + adapter (Phase 35D) precede live client; no live client authorized by Phase 36A. |
| **E — production storage / admission design** | Required for any live memory. Records the offline integration contract for storage. | Bundling storage with first live-ish surface is too large. Storage availability does not imply admission permission. Admission is the load-bearing decision. | Boundary doc §5 (read/recall only), §6 (Discord logs not memory), §14 (production storage); post-MVP decision map §7 (live memory admission gates); multi-surface contract §10 (memory admission boundary): signer / admission authority, consent assumptions, audit, challenge/revoke/forget, canonical store + derived indexes only. | **Defer.** Separate design phase, never bundled with surface work. |

---

## 13. Non-goals

Explicitly rejected by this decision. None of the following are
authorized; if a later phase needs any, re-open the boundary doc
first.

- **live Discord recall command (live or fixture-bound) bundled into
  Phase 36B** — still fixture-bound only is allowed as 36B-alt, but
  not as the recommended 36B;
- **live Telegram recall surface** — neither group nor DM, in any
  mode;
- **live Dixie client** — recorded envelope fixtures + adapter
  (Phase 35D) are the live-Dixie precondition; live client is not
  authorized here;
- **live memory admission** — no Discord, Telegram, web, or Dixie
  invocation may write to candidate or admitted memory as a side
  effect;
- **`authorized_private_session` renderer** — gated on the
  multi-surface contract §5a authorized-private DTO gate; not
  authorized in Phase 36A or 36B;
- **positive `authorized_private_session` projection** — Phase 36B
  may produce *negative* recorded fixtures that target
  `authorized_private_session` to exercise the adapter's
  fail-closed `authorized_private_projection_not_implemented` path;
  it must not produce a positive `authorized_private_session` DTO
  from any envelope;
- **`public_telegram` renderer** — gated on multi-surface contract
  §8a future-renderer warning per-surface contract;
- **ambient recall** — no surface listens to channel/group traffic
  to drive recall;
- **passive recall** — no scheduled or ambient recall on any surface;
- **production cross-user authorization solved** — this doc does not
  claim or authorize production identity binding, consent, or
  cross-user access;
- **character-voiced recall** — recall billboards remain voiceless
  per boundary doc §12 voice posture and post-MVP decision map §3
  Option F;
- **chat logs as governed memory** — Discord, Telegram, web, and
  Dixie/Finn session logs are interaction records, not governed
  memory; admission is post-MVP;
- **separate memory silos per surface** — there is one continuity
  actor / shared substrate; surfaces are frames, not silos
  (multi-surface contract §2);
- **production storage bundled with surface demo** — storage is its
  own design phase;
- **silently reusing the Discord renderer on a non-Discord surface** —
  multi-surface contract §8a future-renderer warning's per-surface
  no-leak / fail-closed / no-raw-debug invariants must be
  independently satisfied;
- **treating recorded Dixie envelope fixtures as the production
  envelope schema** — recorded fixtures are sample v0 contract
  probes only (§7a); the Dixie-side owning artifact / sign-off
  defines the live contract.

---

## 14. Cross-references

- `docs/recall-wedge/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/recall-wedge/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/recall-wedge/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A
  post-MVP option matrix and decision gates this doc extends.
- `docs/recall-wedge/RECALL-WEDGE-MULTI-SURFACE-CONTRACT.md` — Phase 35C
  multi-surface contract spec; surface taxonomy (§4), authorized
  private session contract (§5), authorized-private DTO gate (§5a),
  Discord public contract (§6), Telegram contract (§7), Telegram-
  specific authorization gates (§7e), surface-specific output rules
  (§8), future-renderer warning (§8a), Dixie / Recall Wedge envelope
  relationship (§9), Dixie adapter requirements (§9a), memory
  admission boundary (§10).
- `docs/recall-wedge/fixtures/README.md` — fixture set, including
  Phase 35D `dixie-envelope/` fixtures.
- `docs/recall-wedge/fixtures/validate-fixtures.mjs` — Phase 33B/35D
  fixture validator.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts` —
  Phase 33C public-safe renderer.
- `packages/persona-engine/src/recall-wedge/demo-cross-interface.ts` —
  Phase 33D fixture-bound cross-interface continuity demo.
- `packages/persona-engine/src/recall-wedge/run-demo.ts` — Phase 35B
  explicit dev/operator demo runner.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.ts` —
  Phase 35D pure Dixie envelope adapter.
- `packages/persona-engine/src/recall-wedge/dixie-envelope-adapter.test.ts` —
  Phase 35D adapter regression gate.
