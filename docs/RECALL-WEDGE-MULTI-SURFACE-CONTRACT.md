# Recall Wedge — multi-surface interaction contract

> **Phase 35C** (docs-only). Companion to
> `docs/RECALL-WEDGE-MEMORY-MVP.md` (Phase 33A boundary doc),
> `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` (Phase 34A acceptance), and
> `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` (Phase 35A decision map).
>
> This document is a **contract spec**, not implementation. It defines
> how the same continuity-bearing AI agent can be addressed from
> multiple interactive surfaces while preserving surface-specific
> authorization and public-safety boundaries. No code, package,
> lockfile, Discord wiring, Telegram wiring, live
> Dixie/Straylight/Finn integration, production storage, live memory
> admission, or LLM/voice rewrite changes are introduced here.
>
> If a later phase reaches for anything currently gated, deferred, or
> rejected by this spec, re-open the boundary doc — do not silently
> expand scope from this contract.

---

## 1. Status and purpose

The fixture-bound Recall Wedge MVP is **accepted**
(`docs/RECALL-WEDGE-MVP-ACCEPTANCE.md`, Phase 34A). Phase 35B added an
explicit dev/operator demo runner over the accepted Phase 33D
cross-interface demo
(`packages/persona-engine/src/recall-wedge/run-demo.ts`).

This spec is the **next contract before live integration**. It defines
the multi-surface interaction shape that any subsequent live-ish proof
must satisfy. It does not approve any live surface, any live envelope,
any live admission, or any voice rewrite — it states what the contract
must look like *if and when* such work is approved by a later phase
through the gates already recorded in
`RECALL-WEDGE-POST-MVP-DECISION-MAP.md` §5, §5a, §6, §7.

This spec is fixture-bound by construction. Where it names live
elements (Dixie session envelopes, live Discord commands, Telegram
adapters), those names are **contract-level placeholders**: the spec
records the boundary they must respect; it does not authorize building
them.

---

## 2. Same-agent invariant

All interactive surfaces named in this spec address **one
continuity-bearing actor** running over **one shared app/substrate**.
This restates and extends the boundary-doc §2 invariant for the
multi-surface case.

- **One continuity actor** — the `freeside-characters` substrate (and,
  in cross-repo terms, the wider Loa-Straylight continuity-bearing
  agent it speaks for) is the single internal actor whose memory is
  recalled. There is exactly one continuity actor across all surfaces;
  no surface owns its own actor identity.
- **Shared app-substrate** — surfaces share the same substrate. They
  do not run independent substrates that happen to look similar.
- **Surface adapters do not own memory** — every surface adapter
  (Discord adapter, Telegram adapter, private web/Dixie adapter) is a
  pure interface frame. It does not store governed memory, does not
  promote raw traffic to memory, and does not mutate governed memory
  as a side effect of being invoked. Memory authority remains with
  Straylight (boundary doc §3).
- **Discord, Telegram, and private web chat are interface frames** —
  they are surfaces over the substrate, in the same family as the
  existing `operator_private` / `public_discord` /
  `character_boundary_referral` projections from Phase 33B. Adding a
  new surface adds a new frame; it does not add a new actor.
- **Characters/personas remain frames, not independent estates** —
  consistent with boundary doc §2 and decision-map §2: characters
  (`ruggy`, `satoshi`, future) are persona / knowledge-boundary frames
  over the shared substrate. They are not independent Straylight
  estates and do not own per-character memory silos. This rule
  survives the addition of Telegram and private-web/Dixie surfaces:
  the new surfaces also do not turn characters into independent
  estates.

If a later phase proposes giving any surface or character its own
memory store, its own admission authority, or its own continuity
actor, that is a boundary-doc reopening — not an extension of this
spec.

---

## 3. Minimum surface requirement

Any future live-ish proof must include **at least two interactive
surfaces** drawn from at least one of each class below:

- **at least one authorized-private surface** — a surface where
  caller authorization is established and the rendered output may
  include broader authorized context per the §5a DTO gate
  (`authorized_private_session`);
- **at least one public/community surface** — a surface where the
  rendered output is restricted to the public-safe billboard /
  referral allowlist (boundary doc §9, today enforced by
  `render-public-recall.ts`).

A proof that uses only an authorized-private surface, or only a
public surface, does not satisfy this spec — the cross-surface
boundary is part of what is being proven.

**Preferred eventual target:**

- private web chat session, optionally consuming a recorded Dixie
  recall envelope (one authorized-private surface,
  `render_surface=web_private_chat`);
- public Discord (one public/community surface,
  `render_surface=discord_public_character`);
- Telegram DM **or** Telegram group (a second surface — Telegram
  group is `render_surface=telegram_group_character` (public
  Telegram); Telegram DM is `render_surface=telegram_dm_public_safe`
  by default and `render_surface=telegram_dm_authorized_private`
  only after caller authorization is established — see §7).

The minimum requirement is two interactive surfaces across the two
classes; the preferred target is three, spanning private web,
public Discord, and Telegram.

This is a contract requirement, not an authorization. Each surface
still passes through its own gates in
`RECALL-WEDGE-POST-MVP-DECISION-MAP.md` §5, §5a, §6, §7 before going
live.

---

## 4. Surface taxonomy

The boundary doc §8 defined a small MVP vocabulary
(`source_interface` ∈ {`discord_public`, `github_seed`,
`operator_fixture`}, `recall_interface` ∈ {`operator_private`,
`public_discord`, `web_chat_fixture`}, `render_surface` ∈
{`discord_public_character`, `operator_debug`}). Multi-surface work
extends that vocabulary while preserving the existing tokens.

> **Placeholder note.** The exact names below are **contract-level
> placeholders** unless they already appear in shipped code or
> fixtures. Implemented tokens today are the boundary-doc §8 set —
> `discord_public`, `github_seed`, `operator_fixture`,
> `operator_private`, `public_discord`, `web_chat_fixture`,
> `discord_public_character`, `operator_debug`. Anything else listed
> below is a name proposal that a later phase may rename when it
> lands; the *boundary* the name describes is the contract.

**`source_interface`** — where the interaction originated:

- `private_web_chat` — private web chat session (caller-authorized);
- `discord_public` — public Discord channel (already implemented
  token);
- `telegram_dm` — Telegram direct message;
- `telegram_group` — Telegram group / public chat;
- `operator_fixture` — operator-side fixture / dev runner (already
  implemented token);
- `github_seed` — reviewed seed memory packet origin (already
  implemented token).

> **Note.** `dixie_chat_session` is *not* listed here. Dixie/Finn
> chat-session envelopes are an **input envelope kind** (see
> `input_envelope_kind` below), not a primitive interaction source.
> A Dixie session envelope can be carried over any of the above
> sources (e.g. `private_web_chat` carrying a `dixie_session_envelope`).
> Treating Dixie as a `source_interface` would conflate envelope
> shape with origin and weaken the taxonomy.

**`input_envelope_kind`** — the shape of the input the adapter is
narrowing from, orthogonal to `source_interface`:

- `direct_surface_input` — a direct surface invocation (slash command
  payload, raw message text) with no Dixie session wrapping;
- `dixie_session_envelope` — a Dixie/Finn-style chat-session envelope
  carrying `sessionId`/`messageId` and session context; an
  interaction/session record, **not** governed memory;
- `recorded_dixie_recall_envelope` — a recorded Dixie envelope used
  as a Phase 35D fixture; represents a Recall Wedge response /
  reference projection, **not** raw chat log memory;
- `fixture_projection` — a static projected DTO (the Phase 33B
  fixture shape).

Clarifications:

- Dixie/Finn chat-session envelopes can carry `sessionId`,
  `messageId`, and session context.
- The envelope kind is **not** the memory owner. Carrying a Dixie
  envelope does not turn the adapter into a memory authority.
- Dixie/Finn session records are interaction/session records, not
  governed Straylight memory (§5, §10).
- Recorded Dixie envelopes for Phase 35D represent recall/session
  envelope fixtures or projected recall responses — they do not
  represent raw chat log memory and do not constitute admission of
  any chat content into governed memory.

**`recall_interface`** — the authorized recall frame in which the
substrate is being asked to project memory:

- `authorized_private_session` — caller-authorized private recall
  frame (web private chat, Telegram DM after caller authorization is
  established); broader authorized context allowed only after
  authorization is established and only through fields explicitly
  approved for `authorized_private_session` in a later phase;
- `public_discord` — public Discord frame (already implemented
  token); public-safe billboard/referral only;
- `public_telegram` — public Telegram frame (Telegram group / public
  chat, and unauthenticated Telegram DM fallback); public-safe
  billboard/referral only;
- `operator_private` — operator-only diagnostic frame (already
  implemented token); operator/internal diagnostic proof data,
  never publicly renderable, never end-user authorized.

> **`authorized_private_session` ≠ `operator_private`.** The two
> frames are distinct and must not share renderer assumptions.
> `authorized_private_session` is an end-user / caller authorized
> private recall interface, gated by caller authorization that has
> not yet been designed (§5, §5a). `operator_private` is operator /
> internal diagnostic proof data, never authorized for end users.
> A renderer authorized for one is **not** authorized for the
> other; future renderers must be approved per-frame.

**`render_surface`** — the concrete rendering target the recall
output is destined for:

- `web_private_chat` — rendered into a private web chat session;
- `discord_public_character` — rendered as a public Discord character
  message (already implemented token);
- `telegram_dm_authorized_private` — rendered into a Telegram DM
  **after caller authorization is established**; consumes only
  `authorized_private_session` projections;
- `telegram_dm_public_safe` — rendered into a Telegram DM **without
  established caller authorization**; consumes only `public_telegram`
  projections under the public-safe billboard rules;
- `telegram_group_character` — rendered as a Telegram group / public
  chat message;
- `operator_debug` — rendered into operator-only debug output (already
  implemented token).

**Mapping rules (contract-level):**

- `source_interface` describes origin only and never controls
  authorization or output safety on its own;
- `input_envelope_kind` describes input shape only and never
  controls authorization or memory ownership;
- `recall_interface` controls authorization and the §9 allowlist
  applied to output;
- `render_surface` controls the concrete renderer chosen and the
  surface-specific output rules in §8;
- a single `recall_interface` may map to more than one
  `render_surface` (e.g. `authorized_private_session` →
  {`web_private_chat`, `telegram_dm_authorized_private`};
  `public_telegram` →
  {`telegram_dm_public_safe`, `telegram_group_character`});
- a single `render_surface` maps to **exactly one**
  `recall_interface`. The two Telegram DM render tokens
  (`telegram_dm_authorized_private` and `telegram_dm_public_safe`)
  are deliberately split so this rule holds: no render_surface
  silently switches its authorization frame mid-render;
- the canonical `render_surface` → `recall_interface` map is:
  - `web_private_chat` → `authorized_private_session`;
  - `discord_public_character` → `public_discord`;
  - `telegram_dm_authorized_private` → `authorized_private_session`;
  - `telegram_dm_public_safe` → `public_telegram`;
  - `telegram_group_character` → `public_telegram`;
  - `operator_debug` → `operator_private`;
- adding a new surface adds new tokens to one or more of these
  vocabularies; it does not redefine existing tokens.

---

## 5. Authorized private session contract

The private/session surface class — `web_private_chat`,
`telegram_dm_authorized_private` — has its own contract, distinct
from the public surfaces. It is the authorization-bearing surface
class. Its `recall_interface` is `authorized_private_session`.

- **Likely envelope mapping** — an authorized private session may
  consume a Dixie/Finn chat-session envelope
  (`input_envelope_kind=dixie_session_envelope`) or, in Phase 35D, a
  recorded Dixie recall envelope
  (`input_envelope_kind=recorded_dixie_recall_envelope`). Where the
  existing fixture set uses a static projected DTO
  (`fixture_projection`), the private/session adapter consumes the
  envelope and narrows it to a local projected DTO before any
  rendering.
- **`sessionId`/`messageId` may exist** — Dixie/Finn-style sessions
  may carry session-level identifiers (`sessionId`, `messageId`,
  thread/turn IDs). These are operational/session identifiers, not
  governed memory identifiers. They may be retained on the
  authorized private rendered output for caller continuity within
  the session, but they are still subject to the public-side rules
  if the same packet is later projected into a public surface.
- **Session records are interaction records, not governed memory** —
  a Dixie/Finn session log, like a Discord interaction log, is a raw
  interaction record. It is not a Straylight assertion. It does not
  become governed memory by being recorded in a session envelope; it
  becomes governed memory only via the future Straylight-owned
  admission path described in §10. No surface or adapter, including
  any authorized private session, may automatically admit private
  chat logs into governed memory as a side effect of being
  invoked.
- **Authorized private recall may carry broader context only after
  caller authorization is established** — when caller authorization
  is established for the private session, the projected DTO
  authorized for `authorized_private_session` may include broader
  context than `public_discord` allows. "Broader context" does
  **not** mean a raw estate / debug / source dump; it means
  additional fields that have been explicitly approved for
  `authorized_private_session` in a later phase.
- **Authorized private output is not `operator_private` output** —
  even an authorized `authorized_private_session` view is **not**
  equivalent to `operator_private`. `operator_private` is
  operator/internal diagnostic proof data; it is not a replacement
  for an authorized end-user private view, and an
  `authorized_private_session` renderer must not silently reuse
  `operator_private` payloads. By default, authorized private
  renders still suppress `raw_reasons`, debug payloads, hidden
  estate material, private assertion IDs, source material, and
  actor identifiers; broader authorized context is released only
  through fields explicitly approved for
  `authorized_private_session` in a later phase.

The private/session contract does **not** authorize:

- arbitrary cross-user access (one user's authorized session does not
  authorize them to recall another user's memory);
- bypass of the boundary-doc §2 same-actor invariant (an authorized
  private session does not gain access to a different continuity
  actor's memory);
- live Dixie integration (still gated by decision-map §6);
- character-voiced recall in authorized private sessions (still
  gated by decision-map §3 Option F).

### 5a. Authorized-private DTO gate (precondition for any private renderer)

Before any `authorized_private_session` renderer or adapter is
implemented in any phase, a future phase **must** define and ship
all of the following. This subsection records the gate; it does not
satisfy it.

- **Minimum authorized-private projected DTO shape** — the exact
  field set the adapter is allowed to project into for an authorized
  private session, separate from the public-safe projected DTO and
  separate from `operator_private`.
- **Allowed fields** — the explicit allowlist of fields that may
  appear in an authorized private projected DTO.
- **Forbidden fields** — the explicit denylist (at minimum:
  `raw_reasons`, debug payloads, hidden estate material, private
  assertion IDs, source material, actor identifiers, raw chat log
  contents, raw operator diagnostic payloads).
- **Downgrade / refusal behavior when caller authorization is
  absent or insufficient** — the adapter's behavior when caller
  authorization cannot be established or is insufficient for the
  requested view (refusal, public-safe downgrade per §7d, or both).
- **Tests for authorized vs unauthorized private sessions** —
  unit/contract tests proving authorized callers receive the
  approved authorized fields and unauthorized callers do **not**,
  and that the adapter fails closed on ambiguous authorization.
- **No raw hidden estate / debug / source material by default** —
  the DTO contract must enforce this by construction, not by
  reviewer vigilance.
- **No automatic admission of private chat logs into governed
  memory** — the DTO contract must not include any field whose
  presence implies admission, and the adapter must not write to
  candidate or admitted memory as a side effect of producing the
  DTO.

Until this gate is satisfied, no `authorized_private_session`
renderer is authorized — neither for web private chat nor for
Telegram DM. Phase 35D may produce recorded Dixie envelope fixtures
and adapter tests, but rendering through an
`authorized_private_session` view is gated on this DTO gate plus
decision-map §6.

Clarification:

- Broader private context is possible **only** after caller
  authorization, and **only** through the approved
  `authorized_private_session` DTO fields.
- Broader private context **does not mean** a raw estate / debug /
  source dump.

---

## 6. Discord public contract

The Discord public surface contract restates and tightens the existing
Phase 33C / 33D rules. Nothing in this section is new boundary; the
surface taxonomy in §4 simply names what already holds.

- **Explicit invocation only** — consistent with the `CLAUDE.md`
  anti-spam invariant and boundary-doc §13. A Discord recall
  invocation must be initiated by an explicit user action (slash
  command, future explicit recall command).
- **No ambient listening** — the Discord adapter does not consume
  channel traffic to drive recall. `messageCreate` is not a recall
  trigger.
- **No passive recall** — there is no scheduled or ambient recall on
  the Discord surface. Cron / pop-in / weaver cadences exist for
  digest behavior; they are not recall triggers.
- **No automatic memory admission** — a Discord recall invocation
  does not write to candidate or admitted memory as a side effect of
  being invoked.
- **Public-safe renderer only** — the Discord public surface consumes
  only `recall_interface=public_discord` /
  `render_surface=discord_public_character` projections, rendered by
  the §9-allowlisted public renderer
  (`render-public-recall.ts`).
- **No `raw_reasons`, debug payloads, private IDs, assertion IDs,
  source material, hidden estate, or actor identifiers** — same as
  boundary doc §9 and decision-map §2: Discord public output never
  contains any of these. The renderer's internal scan plus the demo's
  `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` guard already enforces this for
  fixtures; the same enforcement is required for any live surface.

A live Discord recall command, even a fixture-bound demo command,
must additionally satisfy every operational gate in decision-map §5a
(command registration scope, dev/guild visibility, kill switch,
admin-only invocation, ephemeral-vs-public delivery, redacted logs,
fixture-bound labeling, public no-leak tests, no ambient/passive,
no admission as side effect).

---

## 7. Telegram contract

Telegram is included as a target surface class in the multi-surface
proof. It has **two distinct modes** that map to different
authorization frames and to two deliberately separate
`render_surface` tokens (`telegram_dm_authorized_private` and
`telegram_dm_public_safe`) so that no single render token has to
straddle two authorization frames (§4).

### 7a. Telegram DM — authorized mode (`render_surface=telegram_dm_authorized_private`)

- A Telegram DM may behave like an `authorized_private_session`
  **only if caller authorization is established and the §5a
  authorized-private DTO gate has been satisfied** — the Telegram
  adapter must establish caller authorization (e.g. binding the
  Telegram caller to an authorized identity) before the recall
  projection is allowed to use
  `recall_interface=authorized_private_session` and
  `render_surface=telegram_dm_authorized_private`.
- The Telegram adapter is the boundary that decides which mode
  applies. It does not get to upgrade an unauthenticated DM into an
  `authorized_private_session` frame.

### 7b. Telegram DM — public-safe fallback (`render_surface=telegram_dm_public_safe`)

- **If caller authorization is missing or insufficient**, the
  Telegram DM does **not** automatically fall back to public recall.
  Instead, the surface may:
  - return a generic refusal; or
  - **only if the same content is independently allowed for the
    same caller on a public surface**, return a public-safe
    billboard / referral via `recall_interface=public_telegram` and
    `render_surface=telegram_dm_public_safe`.
- **Public-safe output is an output class, not an authorization
  grant.** A public-safe billboard rendered into a Telegram DM does
  not retroactively authorize the caller, does not bind the caller's
  identity, and does not unlock any broader context.
- Authorization absence does not unlock broader context on the basis
  of "it's a DM."

### 7c. Telegram group / public chat (`telegram_group` source_interface)

- **Behaves like Discord public** — `recall_interface=public_telegram`,
  `render_surface=telegram_group_character`, public-safe billboard /
  referral only.
- All Discord public rules in §6 apply here: explicit invocation only,
  no ambient listening, no passive recall, no automatic memory
  admission, public-safe renderer only, no `raw_reasons` / debug /
  private IDs / assertion IDs / source material / hidden estate /
  actor identifiers in output.

### 7d. Telegram-wide rules

- **Telegram DM may behave like `authorized_private_session` only
  after identity/caller authorization is established** — and only
  via `render_surface=telegram_dm_authorized_private`. There is no
  ambient upgrade.
- **Telegram group / public chat always uses `public_telegram`
  behavior** — regardless of caller identity, group membership, or
  admin status.
- **Telegram adapter must not own memory** — same rule as Discord
  and the web private / Dixie adapter (boundary doc §3, §6,
  decision-map §2). The Telegram adapter is a pure interface frame.
- **Telegram logs remain raw source / candidate memory only** —
  Telegram messages, reactions, edits, and replies are raw
  interaction sources. They are not governed memory by default.
  Same posture as Discord interaction logs (boundary doc §6).
- **Bot identity / branding** — out of scope for this spec; the
  Telegram adapter must respect the same character-frame rules as
  Discord (Pattern B-style per-character identity if applicable;
  voiceless billboards for recall).

### 7e. Telegram-specific authorization gates (future-phase)

In addition to the decision-map §5a operational gates established
for Discord, Telegram introduces authorization-shaped gaps that
**must** be named and resolved before any live Telegram surface is
authorized:

- **Telegram identity binding** — how a Telegram user identity is
  bound to a Loa-side authorized identity, with explicit recorded
  consent assumptions. No implicit binding by `from.id` alone.
- **Account unlink / revocation** — how a previously bound Telegram
  identity is unbound, including revocation of any authorized
  private context that was previously released to that binding.
- **Group-to-DM transition handling** — how an interaction begun in
  a Telegram group transitions to a DM (or vice versa) without
  silently inheriting an authorization frame across surfaces. The
  default is no inheritance; each invocation re-establishes its own
  authorization.
- **Telegram privacy mode implications** — the implications of
  Telegram's bot privacy mode (visibility of group messages) on what
  the adapter is and is not allowed to consume.
- **Anonymous admin / group context ambiguity** — handling of
  anonymous-admin posts, channel-as-poster posts, and other group
  contexts where caller identity is ambiguous. Default is to refuse
  any private/authorized treatment when identity is ambiguous.
- **Explicit authorization mode per invocation** — each Telegram
  invocation must carry, or resolve, an explicit authorization
  mode. There is no implicit "this looks private therefore
  authorized" path.
- **Telegram logs remain raw source / candidate memory only** — no
  authorization gate ever upgrades raw Telegram traffic into
  governed memory; admission still routes through §10.

**No live Telegram bot wiring is authorized by this spec.**
Authorization, if granted later, requires the decision-map §5a
operational gates (extended for Telegram) **and** the §7e
Telegram-specific gates above **and** the §5a authorized-private
DTO gate (for `telegram_dm_authorized_private`).

---

## 8. Surface-specific output rules

The output rules below restate the §9 allowlist (boundary doc) per
surface. The `authorized_private_session` rules are net-new
boundary; the others restate existing rules under the multi-surface
taxonomy. Every `render_surface` maps to exactly one
`recall_interface` (§4 mapping rules).

| recall_interface              | render_surface                       | Output rules                                                                                                                                                                                                                                                                                                          |
|-------------------------------|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `authorized_private_session`  | `web_private_chat`                   | Broader authorized context allowed **only** after caller authorization is established and **only** through fields explicitly approved for `authorized_private_session` per the §5a DTO gate. Still no `raw_reasons` / debug / hidden estate / source material / private assertion IDs / actor identifiers by default. |
| `authorized_private_session`  | `telegram_dm_authorized_private`     | Same rules as `web_private_chat` row, plus §7a (caller authorization established) and §7e (Telegram identity-binding gates) preconditions.                                                                                                                                                                            |
| `public_discord`              | `discord_public_character`           | Public-safe billboard/referral only. Strict §9 allowlist: summary / counts / labels / refusal-safe text / safe referral target/message. No `raw_reasons` / debug / private IDs / source material / actor identifiers.                                                                                                  |
| `public_telegram`             | `telegram_dm_public_safe`            | Public-safe billboard/referral only. Same allowlist as `public_discord`. Used **only** as a refusal-or-public-safe fallback when caller authorization for a Telegram DM is missing or insufficient and the same content is independently allowed for the caller on a public surface (§7b).                            |
| `public_telegram`             | `telegram_group_character`           | Public-safe billboard/referral only. Same allowlist as `public_discord`. Telegram group / public chat is always public-safe regardless of caller identity.                                                                                                                                                            |
| `operator_private`            | `operator_debug`                     | Internal proof / debug only. Never publicly renderable. Public-safe renderer rejects with `wrong_recall_interface` or `banned_private_material_in_input`. May include broader operator-only material; never reaches end users. **Never** reuses the `authorized_private_session` renderer or vice versa.              |

The table is normative for output: a row's **render_surface** never
gets to relax the rules of its **recall_interface**. A
`render_surface` is bound to its row's allowlist.

Telegram DM appears in **two** deliberately separate rows
(`telegram_dm_authorized_private` and `telegram_dm_public_safe`).
The Telegram adapter is responsible for picking the row before any
rendering occurs (§7a, §7b). Each render token still maps to
exactly one `recall_interface`; the split is what allows the §4
rule to hold.

### 8a. Future renderer warning

- The current implemented renderer
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`)
  accepts **only** `recall_interface=public_discord` and
  `render_surface=discord_public_character`. It is Discord-specific
  by construction and tested only for that frame.
- Future Telegram and authorized-private renderers
  (`telegram_dm_authorized_private`, `telegram_dm_public_safe`,
  `telegram_group_character`, `web_private_chat`) **must**
  independently satisfy equivalent **no-leak**, **fail-closed**, and
  **no-raw-debug / source / actor-ID** invariants, with their own
  test surfaces equivalent to the Discord renderer's existing tests
  (including `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` style guards adapted
  to each surface).
- Future renderers **must not silently reuse** the Discord renderer
  unless the DTO/render contract is **explicitly adapted and
  tested** for that surface and frame. In particular: an
  `authorized_private_session` renderer is not authorized to reuse
  the public-Discord renderer's allowlist as an upper bound, and a
  Telegram public-safe renderer is not authorized to reuse the
  Discord renderer's exact output shape without a per-surface test
  pass.
- An `authorized_private_session` renderer must additionally satisfy
  the §5a DTO gate; an `operator_private` renderer must remain
  separate from `authorized_private_session` per §4.

---

## 9. Dixie / Recall Wedge envelope relationship

The relationship between Dixie envelopes and the local Recall Wedge
projected DTO is the same multi-surface contract restated in
narrowing terms. This restates and extends decision-map §3 Option H
and §6.

- **Dixie may provide a chat/session envelope kind** — Dixie is the
  likely shape of `input_envelope_kind=dixie_session_envelope` (live)
  and `input_envelope_kind=recorded_dixie_recall_envelope` (Phase
  35D fixture). The envelope kind can be carried over different
  source interfaces (e.g. `private_web_chat`, future `telegram_dm`);
  the envelope kind is **not** itself a `source_interface` (§4).
- **Recall Wedge projected DTO remains the renderer input** — the
  public-safe renderer
  (`packages/persona-engine/src/recall-wedge/render-public-recall.ts`)
  consumes the projected DTO shape, not raw Dixie envelopes. Future
  authorized-private renderers will likewise consume an
  authorized-private projected DTO (§5a), not raw Dixie envelopes.
- **Raw Dixie responses must be narrowed by an adapter before any
  rendering** — a Dixie envelope never reaches a public or
  authorized-private renderer directly. A pure adapter narrows the
  Dixie envelope to a local projected DTO; the renderer consumes
  only the projected DTO. This is the same narrowing-boundary rule
  as decision-map §6.
- **Recorded Dixie envelope fixtures + adapter tests precede live
  Dixie client** — per decision-map §3 Option H and §6, the next
  Dixie-related work is recorded versioned envelope fixtures and a
  pure adapter with unit tests. No live Dixie client is authorized
  by this spec; live Dixie remains gated on decision-map §6.
- **Dixie / Finn session logs are not governed Straylight memory
  unless admitted later** — a Dixie chat-session envelope is a
  session record. Session records are interaction records (§5,
  boundary doc §6); they become governed memory only via the future
  Straylight-owned admission path described in §10.

The same narrowing rule applies to any future Telegram envelope or
private-web envelope: raw envelopes never reach a renderer;
adapters narrow them to projected DTOs first.

### 9a. Dixie adapter requirements

The Dixie adapter (Phase 35D, recorded-envelope-only; pre-live)
must satisfy the following requirements. These extend decision-map
§3 Option H / §6 and are the contract that Phase 35D adapter tests
will assert against.

- **Versioned recorded envelope fixtures** — every recorded Dixie
  envelope fixture under `docs/recall-wedge/fixtures/` carries an
  explicit envelope version field. The adapter dispatches on this
  field.
- **Fail-closed unknown version handling** — if an envelope version
  is missing, malformed, or unknown to the adapter, the adapter
  refuses to project. It does not fall back to "best effort"
  parsing; it produces a refusal projection (or raises) so that no
  unrecognized envelope ever reaches a renderer.
- **No raw passthrough to public renderer** — the adapter must
  never hand any field, sub-object, or substring of a raw Dixie
  envelope directly to the public renderer. Every renderer-bound
  field is reconstructed by the adapter from the allowed
  per-projection fieldset.
- **Adapter is the narrowing boundary** — the adapter is the only
  component allowed to read a Dixie envelope and produce a
  projected DTO. Renderers, runners, and surface frames never read
  Dixie envelopes directly.
- **Mode-specific projections from the same recorded envelope** —
  the same recorded Dixie envelope can be narrowed by the adapter
  into more than one projection, selected by the request's
  `recall_interface` / `render_surface`. Required projections:
  - **public-safe projected DTO** — for `public_discord`,
    `public_telegram` (`telegram_dm_public_safe` and
    `telegram_group_character`); same §9 allowlist as the existing
    public renderer test surface;
  - **authorized-private projected DTO** — for
    `authorized_private_session` (`web_private_chat`,
    `telegram_dm_authorized_private`); only after the §5a DTO gate
    and the relevant authorization assumptions are explicitly
    represented in the request, and only through fields approved
    for `authorized_private_session`;
  - **refusal / downgrade projection** — when caller authorization
    is missing, ambiguous, or insufficient (§7b, §7e); the adapter
    emits a refusal or, only if independently allowed for the same
    content on a public surface, a public-safe billboard;
  - **redacted operational logs** — the adapter's own diagnostic
    logs (envelope version, projection mode, refusal cause) are
    redacted of envelope contents and of any DTO field the
    selected projection forbids. Operational logs are not a
    side-channel for source material.
- **No memory admission side effects** — running the adapter on an
  envelope, or producing any of the above projections, **never**
  writes to candidate or admitted memory. Admission remains the
  §10 Straylight-owned path.

---

## 10. Memory admission boundary

This restates the boundary-doc §5–§7 admission rules across the
multi-surface case. The rule survives every additional surface.

- **Chat logs are not memory.** Web chat logs, Discord interaction
  logs, Telegram interaction logs, and Dixie/Finn session logs are
  raw interaction records. They are not Straylight assertions by
  default.
- **Discord/Telegram/web messages are raw source or candidate memory
  only.** Per boundary doc §6 — the existence of traffic does not
  imply admitted memory. Adding Telegram and private-web/Dixie
  surfaces does not change this: more surfaces = more raw sources,
  not more memory.
- **"Remember this" does not admit memory automatically.** A user
  saying "remember this" in any surface is at most a candidate-memory
  signal. It does not promote raw → candidate → admitted by itself.
- **Admission requires a future Straylight-owned path with all of
  the following:**
  - explicit authorization (signer / admission authority);
  - consent assumptions (recorded, auditable);
  - signer / admission authority (who is allowed to admit on whose
    behalf);
  - audit (every admission produces a verifiable record);
  - challenge / revoke / forget (admitted assertions can be
    challenged, revoked, forgotten);
  - storage (canonical store; vector index as derived retrieval only,
    never source of truth).

This list is the same shape as decision-map §7 (live memory admission
gates). Multi-surface does not unlock admission; it inherits the
gates.

---

## 11. Cross-surface continuity proof requirement

Any future cross-surface live-ish proof must show all of the
following, mechanically — same shape as the Phase 33D fixture-bound
proof, extended to the multi-surface case:

- **same continuity actor across at least two interactive surfaces** —
  the same internal `continuity_actor_id` underlies projections
  reached through at least two of {private web, public Discord,
  Telegram DM (authorized or public-safe), Telegram group};
- **same admitted/fixture memory source, or the same recorded Dixie
  recall envelope** — the same underlying source is projected across
  the surfaces. "Source" means an admitted Straylight assertion, a
  reviewed seed fixture, or a recorded Dixie recall envelope
  representing a Recall Wedge response/reference (not raw chat log
  memory and not a live Dixie session log). The proof does not work
  if each surface reads from a different source, and it does not
  work by treating raw chat logs as if they were governed memory;
- **different authorized views by surface** — the same source yields
  demonstrably different output depending on the recall_interface /
  render_surface selected; a proof that renders the same summary in
  two places does not satisfy this requirement (boundary doc §1);
- **no public leak** — public surfaces' rendered output passes the
  §9 allowlist + the demo's `PUBLIC_OUTPUT_BANNED_SUBSTRINGS` guard;
  no `raw_reasons`, debug payloads, private IDs, assertion IDs,
  source material, hidden estate, or actor identifiers reach any
  public surface. Equivalent no-leak guards apply to any future
  Telegram-public-safe renderer (§8a);
- **surface adapters do not mutate governed memory** — the proof's
  surface adapters read-narrow-render only; admission is not
  triggered by any cross-surface invocation.

These properties extend the Phase 33D proof
(`buildRecallWedgeCrossInterfaceDemo` already binds same-seed-fixture,
same-internal-actor, different-authorized-views, public-no-leak) into
the multi-surface case. The cross-surface proof is the multi-surface
version of the same four properties.

---

## 12. Implementation ordering

The recommended sequence below extends decision-map §4 Phase 35D /
36A. It is conservative by design and refuses to bundle high-risk
decisions.

### Phase 35D — recorded Dixie envelope contract fixtures + adapter tests

- Versioned recorded Dixie-safe envelope samples on disk under
  `docs/recall-wedge/fixtures/`.
- Pure adapter from Dixie-safe envelope to local projected DTO; no
  network, no Dixie client, no I/O beyond fixture reads.
- Adapter unit tests proving the same `PUBLIC_OUTPUT_BANNED_SUBSTRINGS`
  + §9 allowlist guarantees as the existing public-safe renderer tests.
- Offline / fixture-bound only.

This is decision-map §3 Option H, locked in as the preferred Phase
35D path. It precedes any live Dixie client.

### Phase 36A — choose first live-ish surface

Pick **one** of:

- **A. Private web / Dixie-fixture runner** — extend the Phase 35B
  runner with an `authorized_private_session` mode that consumes
  recorded Dixie envelope fixtures (Phase 35D output) through the
  adapter, projecting through an `authorized_private_session` view.
  Gated on the §5a authorized-private DTO gate. Still fixture-bound;
  the runner is not yet a live surface.
- **B. Fixture-only Discord/Telegram demo** — a tightly gated
  fixture-bound Discord and/or Telegram demo command. Must satisfy
  decision-map §5a operational gates and the §6 / §7 contract here.
  Still fixture-bound; the surface is not yet a live recall surface.

Picking neither and instead doing Option C (live Dixie) or Option D
(production storage) is allowed only if those are the real blockers
— see decision-map §4 Phase 36A.

### Live surfaces gated on prior phases

- **Live Discord/Telegram only after public-surface gates** —
  decision-map §5 (live-Discord-command general gates) and §5a
  (Discord operational gates) must be satisfied; Telegram gets an
  equivalent set of operational gates established at the time it
  goes live. No live public surface is authorized by this spec.
- **Live memory admission only after storage/admission design** —
  decision-map §7 (live memory admission gates) must be satisfied;
  the boundary-doc §10 admission shape must be designed and reviewed.
  No live admission is authorized by this spec.

The ordering rule is: **fixture work before envelope work; envelope
work before adapter work; adapter work before live surface work; live
surface work before live admission work.** Bundling these is rejected
(§13).

---

## 13. Non-goals

Explicitly rejected by this spec. None of the following are
authorized; if a later phase needs any, re-open the boundary doc
first.

- **three independent memories for web/Discord/Telegram** — there is
  one continuity actor / shared substrate; surfaces are frames, not
  silos (§2);
- **Discord bot memory** — the Discord adapter does not own memory
  (§2, §6, boundary doc §6);
- **Telegram bot memory** — the Telegram adapter does not own memory
  (§2, §7);
- **session logs as governed memory** — chat/session logs (Dixie,
  Finn, web, Discord, Telegram) are interaction records, not
  governed memory (§5, §10);
- **ambient listening** — no surface listens to channel/group traffic
  for recall (§6, §7, boundary doc §13);
- **passive recall** — no scheduled or ambient recall on any surface
  (§6, §7, boundary doc §13);
- **production auth/consent solved** — this spec does not claim or
  authorize production cross-user authorization, production consent,
  or production identity binding (§5, §10, decision-map §7);
- **character-voiced recall** — recall billboards remain voiceless
  per boundary doc §12 and decision-map §3 Option F;
- **live Dixie client without adapter tests** — recorded envelope
  fixtures + adapter tests must precede any live Dixie client (§9,
  §9a, §12, decision-map §6);
- **production storage bundled with surface demo** — surface demos
  do not ship with production storage; storage is a separate design
  phase (decision-map §4, §7);
- **`authorized_private_session` renderer without the §5a DTO
  gate** — no authorized-private renderer (web or Telegram) is
  authorized until the §5a DTO gate is satisfied;
- **`authorized_private_session` renderer reusing
  `operator_private` payloads** — the two frames are distinct (§4)
  and renderers must not be shared without an explicit per-frame
  contract;
- **silently reusing the Discord public renderer for any
  non-Discord surface** — future renderers must independently
  satisfy the §8a no-leak / fail-closed / no-raw-debug invariants;
- **upgrading an unauthenticated Telegram DM into an
  `authorized_private_session` frame** — caller authorization must
  be established (§7a, §7e); public-safe output is not an
  authorization grant (§7b);
- **treating raw chat logs as cross-surface continuity proof
  source** — the proof must use admitted/fixture memory or a
  recorded Dixie recall envelope, not raw chat logs (§11).

---

## 14. Cross-references

- `docs/RECALL-WEDGE-MEMORY-MVP.md` — Phase 33A boundary doc.
- `docs/RECALL-WEDGE-MVP-ACCEPTANCE.md` — Phase 34A acceptance.
- `docs/RECALL-WEDGE-POST-MVP-DECISION-MAP.md` — Phase 35A decision
  map (the post-MVP option matrix, decision gates, and recommended
  sequence this spec extends).
- `docs/recall-wedge/fixtures/README.md` — Phase 33B fixtures + the
  `validate-fixtures.mjs` validator.
- `packages/persona-engine/src/recall-wedge/render-public-recall.ts` —
  Phase 33C public-safe renderer (the contract surface for any public
  surface).
- `packages/persona-engine/src/recall-wedge/demo-cross-interface.ts` —
  Phase 33D fixture-bound cross-interface continuity demo.
- `packages/persona-engine/src/recall-wedge/run-demo.ts` — Phase 35B
  explicit dev/operator demo runner.
