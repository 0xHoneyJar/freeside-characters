# Recall Wedge memory MVP — freeside-characters boundary

> **Phase 33A** (docs-only). This document locks the cross-interface memory
> MVP boundary as it applies to `freeside-characters`. No code, package, or
> wiring changes are made in this phase. Phases 33B → 34A implement against
> the decisions recorded here.

This is a **decision-locking** doc. It records what the MVP must prove, what
this repo's surface contributes to that proof, and — critically — what the MVP
deliberately does **not** attempt. If a later phase reaches for something
listed under "non-goals" or "deferred", the answer is: re-open this doc and
move it explicitly, not silently.

---

## 1. What the MVP must prove

The Loa-Straylight Recall Wedge MVP proof is **continuity, not only rendering**.

It is **not sufficient** to frame the MVP as:

> "a fixture renders safely."

That is necessary but not sufficient. The MVP must prove all of:

- **one continuity-bearing AI entity / app / substrate** — a single actor whose
  memory is recalled across interfaces;
- **memory represented as already-admitted governed memory** — assertions that
  Straylight has authoritatively accepted (not raw chat, not candidate memory);
- **at least two interface frames** — the same actor reached from more than
  one surface;
- **different authorized views under different frames** — the recall envelope
  yields demonstrably different output depending on the requesting frame;
- **public-safe rendering in the Discord character-chat surface** — what
  reaches the public channel is sanitized to the boundary that surface allows.

The cross-interface demo (Phase 33D) must show that **the same continuity
actor and memory packet** can yield **different authorized views**, e.g.:

- `operator_private` — broader context, more reasons exposed;
- `public_discord` — redacted / excluded / referral-safe output;
- `character_frame` — may **redirect** to another character if the request is
  outside that character's boundary.

If the demo only renders the same summary in two places, **it does not prove
the Recall Wedge boundary** and the phase has not landed.

---

## 2. freeside-characters role

`freeside-characters` is documented for the MVP as:

- the current Discord character-chat surface;
- one shared app / substrate;
- multiple character / persona / knowledge-boundary frames;
- per-character Discord identity / rendering (Pattern B webhook overlay);
- explicit user-triggered slash command surface (`/ruggy`, `/satoshi`);
- **no ambient autonomous recall**.

**Authoritative wording:**

> For the MVP, the continuity-bearing entity is the shared
> `freeside-characters` app/substrate. Characters are persona and
> knowledge-boundary frames over that substrate, not independent autonomous
> actor estates.

What this repo **does not** claim, and what the MVP does **not** prove:

- that each character has an independent brain;
- that each character has an independent Straylight estate;
- that the system proves multi-agent autonomy;
- that the system proves live agent memory ingestion.

This is consistent with the existing civic-layer split (`docs/CIVIC-LAYER.md`):
the substrate is the governor; characters are speakers/frames over it.

---

## 3. Repo responsibility map

| Repo / system          | Owns                                                                  | Status for MVP                                            |
|------------------------|-----------------------------------------------------------------------|-----------------------------------------------------------|
| Straylight             | governed memory / continuity semantics                                | authority — types and admission live here                 |
| Dixie                  | safe served-route / BFF envelope                                      | authority — public-safe envelope shape                    |
| `freeside-characters`  | current public Discord character-chat surface                          | one of the two MVP interface frames                       |
| `loa-freeside`         | future product / community / backend integration                       | **deferred** — out of MVP scope                           |
| Finn                   | runtime / audit / enforcement candidate                                | **deferred** — only adopt if a concrete gap appears        |

No Finn integration, no `loa-freeside` integration, no live Dixie client, and
no production storage are required for MVP acceptance unless a concrete
blocker appears in 33B/C/D.

---

## 4. GitHub packets / memory fixtures

For the MVP, GitHub may hold deterministic memory packets. Every packet is
framed as:

- reviewed seed memory;
- synthetic only;
- already-admitted Straylight memory fixture;
- **not** runtime storage;
- **not** raw Discord chat history;
- **not** a production memory database.

**Authoritative wording:**

> GitHub stores reviewed memory fixtures for the MVP; Straylight remains the
> memory authority.

Each packet must self-describe with wording equivalent to:

> This packet represents already-admitted Straylight memory for deterministic
> MVP proof.

We do **not** say "memory is stored in GitHub." Memory authority is
Straylight; GitHub holds reviewed fixtures whose admission has already
occurred upstream of the demo.

---

## 5. Read / recall only

The MVP is **read / recall only**. It does **not** prove:

- Discord message → candidate memory;
- candidate memory → live Straylight admission;
- durable production storage;
- live forget / revoke UI;
- live consent workflow;
- live signer authorization;
- production user identity binding;
- arbitrary Person B access to Person A's memories.

**Live memory admission is post-MVP.** Any 33B/C/D work that requires writing
new assertions, accepting candidates, or persisting beyond the fixture set is
out of scope and must be re-opened against this doc.

---

## 6. Discord interaction logs are not memory by default

A persistent confusion to head off: the existence of Discord traffic does not
mean the bot "has memory" of it.

- Discord messages are **raw interaction sources**, not governed memory by
  default.
- App / session logs may exist as **ordinary operational records** (operator
  observability, error context). They are not Straylight assertions.
- User corrections, reactions, replies, "remember this" messages, and bot
  responses are **raw signals** or **candidate memory** at most.
- They do **not** become Straylight assertions unless a future explicit
  admission path validates, authorizes, signs, and audits them.
- **The MVP does not implement that admission path.**

The anti-spam invariant in `CLAUDE.md` already keeps the bot from acting on
ambient channel traffic; this doc extends the same posture to memory: ambient
traffic is not memory, and it is not promoted to memory in V0.7-A.

---

## 7. Persona knowledge vs governed memory vs external data

The MVP must keep these categories separate. Conflating them is how the
boundary leaks.

| Category                          | What it is                                                            | Is it Recall Wedge memory? |
|-----------------------------------|------------------------------------------------------------------------|----------------------------|
| Persona files (`apps/character-<id>/persona.md`) | voice / static character configuration                  | No — voice config         |
| Knowledge libraries               | bounded static knowledge bundled with a character                      | No — static knowledge     |
| Mibera / onchain holder stats     | external data / tool output (mibera-codex, score-mcp, holder lookups)   | No — tool output          |
| Recall Wedge memory               | governed continuity assertion                                           | **Yes**                   |
| Discord messages                  | raw interaction source                                                  | No — not memory by default |

Onchain stats become Recall Wedge memory **only if** explicitly admitted as
governed assertions through Straylight's admission path. **For the MVP, keep
onchain stats separate from governed continuity memory.** Tool outputs flow
through their existing channels (score-mcp, mibera-codex MCP, etc.) and are
rendered in-voice as data — they do not enter the recall envelope.

---

## 8. Interface-frame taxonomy

A small MVP vocabulary. Deliberately under-built — extend in later phases
only with explicit cause.

| Field                  | MVP-allowed values                                             |
|------------------------|-----------------------------------------------------------------|
| `source_interface`     | `discord_public`, `github_seed`, `operator_fixture`             |
| `recall_interface`     | `operator_private`, `public_discord`, `web_chat_fixture`        |
| `render_surface`       | `discord_public_character`, `operator_debug`                    |
| `character_frame`      | `ruggy`, `satoshi` (extend as new characters land in this repo) |
| `continuity_actor_id`  | the shared `freeside-characters` app / substrate                |

This vocabulary is the contract that 33B fixtures, 33C renderer, and 33D
cross-interface demo all agree on. Do not add fields, statuses, or
sub-taxonomies in 33A.

---

## 9. Public renderer requirements (for Phase 33B / 33C — not implemented here)

These requirements are recorded so 33B/33C work has a fixed target. They are
**not** implemented in 33A.

The public renderer **may** display:

- public-safe summary;
- included / marked / redacted / excluded counts;
- known public-safe reason labels;
- generic refusal text;
- safe referral target.

The public renderer **must not** display:

- `raw_reasons`;
- raw JSON arrays;
- debug payloads;
- hidden / private boundary reasons;
- unknown reason strings;
- full assertion bodies;
- private assertion IDs;
- private source material;
- hidden estate payloads;
- private identifiers;
- raw relationships or subjects.

A 33C "no-leak validator" must mechanically enforce this list.

---

## 10. DTO decision for later phases

A local DTO is acceptable for Phase 33B / 33C **only if** it is explicitly
scoped as:

> a public-channel projection of the Dixie-safe Recall Wedge envelope.

The DTO is **not**:

- the full Straylight schema;
- the full Dixie response;
- the source of recall semantics;
- a replacement for Hounfour / Straylight types.

The DTO is **not implemented in Phase 33A**. When it is implemented, it
narrows the Dixie envelope for the Discord public surface — it does not
re-author memory semantics.

---

## 11. Character-boundary referral

Character frames may **decline or refer** when a request is outside their
boundary. This is part of what the cross-interface demo proves.

A referral response **may**:

- name the appropriate character or safe target;
- provide generic referral text.

A referral response **must not** reveal:

- private boundary reasons;
- private payload;
- raw memory;
- assertion IDs;
- debug payloads.

A referral is itself an "authorized view" — it is the public-safe shape of
"this frame cannot answer." It satisfies the cross-interface demo's
"different views under different frames" requirement when paired with a
broader operator-private view of the same packet.

---

## 12. Voice posture

For the MVP:

- recall summaries are **voiceless / public-safe data billboards**;
- **do not** LLM-rewrite recall summaries in character voice;
- character-voiced recall summaries are **post-MVP**.

Reasons:

- avoids voice-discipline coupling — recall correctness must be evaluable
  without persona review;
- avoids prompt-injection / leakage risk through the rewriting step;
- keeps the proof deterministic — the same packet renders byte-stable for the
  same frame.

This is a deliberate departure from the rest of this repo's surface, where
character voice is sacred. Recall billboards are explicitly outside the
voice-bearing surface for MVP.

---

## 13. Trigger posture

For the MVP: **explicit invocation only.**

Do not add or propose, for MVP:

- ambient recall;
- cron recall;
- automatic character pop-ins from memory;
- passive listening memory.

This is the same anti-spam invariant `CLAUDE.md` already enforces for replies,
re-stated for memory: nothing recalls itself. A user must explicitly summon a
recall through the surfaces 33C/33D define.

---

## 14. Production storage

Production storage is **post-MVP**. The MVP storage path is intentionally
minimal:

- GitHub memory packets;
- local deterministic fixtures;
- no real private user content;
- no live Discord memory ingestion.

The **post-MVP** likely storage path (recorded for orientation, not for
Phase 33 implementation):

- Postgres for canonical estate / assertion / audit / receipt store;
- object storage for raw source blobs;
- pgvector or vector index as derived retrieval aid only;
- Redis for idempotency / cache / session;
- GitHub only for seed packets / fixtures / docs.

---

## 15. Phase ladder

| Phase  | Scope                                                                                                |
|--------|-------------------------------------------------------------------------------------------------------|
| 33A    | docs-only boundary decision: `freeside-characters` cross-interface memory MVP model (**this doc**)     |
| 33B    | GitHub seed memory packets + local public DTO fixtures                                                |
| 33C    | public-safe Recall Wedge renderer + no-leak validator                                                 |
| 33D    | cross-interface continuity demo fixture: Discord-like source frame → other interface recall frame → public character-safe output |
| 34A    | final MVP acceptance handoff                                                                          |

No Finn, no `loa-freeside` implementation, no live Dixie client, and no
production storage before MVP acceptance unless a concrete blocker appears.

---

## 16. Acceptance criteria for this Phase 33A doc

This doc is acceptable if it clearly locks each of:

- [x] current `freeside-characters` surface reality — §2
- [x] shared app / substrate continuity actor model — §2
- [x] character / persona frames, not independent actor estates — §2
- [x] GitHub seed packet role — §4
- [x] interface-frame taxonomy — §8
- [x] read / recall MVP scope — §5
- [x] deferred live memory admission — §5, §6
- [x] deferred live Dixie client — §3, §10
- [x] public renderer requirements for Phase 33B / 33C — §9
- [x] cross-interface demo requirements for Phase 33D — §1, §11
- [x] voiceless billboard posture — §12
- [x] explicit-trigger-only posture — §13
- [x] production storage deferred — §14
- [x] exact non-goals — §1, §2, §5, §6, §7, §9, §11, §12, §13, §14

---

## Non-goals (consolidated)

For ease of citation in later phases, the consolidated non-goal list:

- proving multi-agent autonomy;
- proving independent character estates;
- proving live agent memory ingestion;
- proving Discord → candidate → admitted memory pipeline;
- proving live forget / revoke / consent / signer flows;
- proving production user identity binding;
- proving cross-user memory access;
- character-voiced recall summaries;
- ambient / cron / passive recall triggers;
- production storage;
- live Dixie client;
- Finn runtime / audit / enforcement integration;
- `loa-freeside` integration;
- treating Discord interaction logs as memory by default;
- treating onchain stats as Recall Wedge memory;
- LLM-rewriting recall envelopes in character voice.

If a 33B/C/D task requires any of the above, it must re-open this doc rather
than silently expanding scope.
