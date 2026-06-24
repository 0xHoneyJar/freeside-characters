# Recall Wedge MVP — final acceptance handoff

> **Phase 34A** (docs-only). Closes the Recall Wedge MVP work in
> `freeside-characters` against the boundary doc at
> `docs/RECALL-WEDGE-MEMORY-MVP.md`. No code, package, lockfile, Discord
> wiring, live Dixie/Straylight/Finn integration, production storage, live
> memory admission, or LLM/voice rewrite changes are introduced in this
> phase.

This is an **acceptance-locking** doc. It records what the fixture-bound
MVP proves, what it deliberately does **not** prove, where the evidence
lives in this repo, how to re-run that evidence, and the verdict.
Post-MVP work is listed as options, not commitments — anything reaching
beyond the boundary doc must re-open `RECALL-WEDGE-MEMORY-MVP.md` rather
than silently expanding scope here.

---

## 1. Phase ladder completed

| Phase | Scope                                                                                              | Status   |
|-------|-----------------------------------------------------------------------------------------------------|----------|
| 33A   | boundary decision doc — `freeside-characters` cross-interface memory MVP model                       | landed   |
| 33B   | reviewed seed memory packet + projected DTO fixtures (operator-private, public-discord, referral) + no-leak fixture validator | landed   |
| 33C   | deterministic public-safe Recall Wedge renderer + fail-closed input scan + rendered-output leak guard | landed   |
| 33D   | fixture-bound cross-interface continuity demo + assertions binding all four proof properties         | landed   |
| 34A   | **this doc** — final MVP acceptance handoff                                                         | this PR  |

---

## 2. What the MVP proves

The fixture-bound MVP proves all of the following, mechanically, with
deterministic evidence already shipped in this repo:

- one shared continuity-bearing app/substrate — the
  `freeside-characters` substrate is the single continuity actor;
- character/persona frames, not independent Straylight estates —
  `ruggy` and `satoshi` are persona/knowledge-boundary frames over the
  shared substrate;
- reviewed synthetic already-admitted memory fixtures — the seed
  packet self-describes as
  `synthetic: true`,
  `fixture_kind: reviewed_seed_memory_packet`,
  `admission_state: already_admitted`,
  and names Straylight as the memory authority;
- same seed fixture across projected views — every projected DTO
  references the seed packet by `source_seed_fixture`;
- same internal continuity actor across seed + projected DTOs — every
  projected DTO carries the same `continuity_actor_id` as the seed;
- different authorized views — operator-private, public-discord, and
  character-boundary-referral are demonstrably distinct projections of
  the same packet;
- operator-private view not publicly renderable — the public-safe
  renderer rejects it with `wrong_recall_interface` (or, if its
  operator-only material is contaminated into a public frame,
  `banned_private_material_in_input`);
- public Discord normal view renderable — the public-safe renderer
  emits a deterministic billboard for the public-discord projection;
- character-boundary referral view renderable — the renderer emits a
  deterministic referral billboard with `safe_referral_target` and a
  generic `public_referral_message`;
- public-safe renderer output contains summary/counts/labels/referral/
  refusal-safe fields only — strict §9 allowlist;
- public renderer fails closed on contaminated public-framed DTO input
  — a deep input scan rejects the projection before any rendering when
  any banned private substring is found at any depth, in keys or string
  values;
- public output does not expose `raw_reasons`, private sentinels,
  assertion IDs, source material, debug payloads, hidden estate
  material, private identifiers, `actor:` lines, or
  `continuity_actor_id` — this is enforced by the renderer's allowlist
  plus the cross-interface demo's defense-in-depth output guard
  (`PUBLIC_OUTPUT_BANNED_SUBSTRINGS` in `demo-cross-interface.ts`);
- Discord interaction logs and onchain stats remain outside governed
  memory by default — the seed packet self-notes both categories as
  not-admitted-by-default per §6–§7 of the boundary doc.

---

## 3. What the MVP does not prove

Explicitly out of scope. If a later phase needs any of the following,
re-open `RECALL-WEDGE-MEMORY-MVP.md` first; do not silently expand scope:

- production cross-user authorization;
- production consent workflow;
- arbitrary Person B access to Person A's memory;
- live Discord-to-memory admission;
- candidate memory to Straylight assertion admission;
- durable production memory storage;
- live Dixie client;
- live Straylight package integration;
- live Finn runtime enforcement;
- character-independent Straylight estates;
- multi-agent autonomy;
- character-voiced recall;
- production Discord command wiring;
- onchain stats as governed memory unless explicitly admitted.

---

## 4. Acceptance evidence

All evidence lives at stable paths in this repo.

**Decision doc (Phase 33A):**

- `docs/RECALL-WEDGE-MEMORY-MVP.md`

**Fixtures + no-leak validator (Phase 33B):**

- `docs/recall-wedge/fixtures/README.md`
- `docs/recall-wedge/fixtures/validate-fixtures.mjs`
- `docs/recall-wedge/fixtures/seed-memory/shared-substrate-demo.memory.json`
- `docs/recall-wedge/fixtures/projected-dto/operator-private-view.dto.json`
- `docs/recall-wedge/fixtures/projected-dto/public-discord-view.dto.json`
- `docs/recall-wedge/fixtures/projected-dto/character-boundary-referral.dto.json`

**Public-safe renderer (Phase 33C):**

- `packages/persona-engine/src/recall-wedge/render-public-recall.ts`
- `packages/persona-engine/src/recall-wedge/render-public-recall.test.ts`

**Cross-interface continuity demo (Phase 33D):**

- `packages/persona-engine/src/recall-wedge/demo-cross-interface.ts`
- `packages/persona-engine/src/recall-wedge/demo-cross-interface.test.ts`

---

## 5. Validation commands

Re-run any time to re-verify the MVP locally.

**Fixture invariants + no-leak grep:**

```bash
node docs/recall-wedge/fixtures/validate-fixtures.mjs
```

Expected: `ok — all phase 33b fixture invariants hold; no public-side leaks detected.` (exit 0).

**Renderer + cross-interface demo unit tests:**

```bash
cd packages/persona-engine && bun test src/recall-wedge/
```

Expected: all `render-public-recall.test.ts` and `demo-cross-interface.test.ts` cases pass.

**Recall-wedge–scoped typecheck signal:**

```bash
bun run typecheck 2>&1 | grep -E 'recall-wedge|render-public-recall|demo-cross-interface' || true
```

Expected: no recall-wedge / `render-public-recall` / `demo-cross-interface` diagnostics emitted.

> Note: the repo-wide `bun run typecheck` currently has pre-existing
> unrelated failures outside Recall Wedge areas. Phase 33C and 33D
> audits both confirmed that no recall-wedge, `render-public-recall`,
> or `demo-cross-interface` typecheck diagnostics are produced; the
> grep above re-verifies that signal in isolation.

---

## 6. Acceptance verdict

**Accepted as fixture-bound Recall Wedge MVP proof.**

The phase ladder 33A → 33D is complete. The Phase 33A boundary doc, the
Phase 33B fixtures, the Phase 33C public-safe renderer, and the Phase
33D cross-interface continuity demo together prove — deterministically,
without any live Discord / Dixie / Straylight / Finn integration — that
one shared continuity-bearing substrate, projected through different
authorized frames, yields demonstrably different views with public-safe
output strictly inside the §9 allowlist and fail-closed treatment of
contaminated public-framed input. Everything beyond that boundary is
post-MVP and gated on the boundary doc.

---

## 7. Recommended post-MVP next options

Listed as options, not commitments. Each requires re-opening
`RECALL-WEDGE-MEMORY-MVP.md` (or, where indicated, a cross-repo decision)
before implementation.

- **Wire renderer into an explicit dev-only command/demo surface** —
  e.g. an operator-only invocation that loads the projected DTO fixture
  and prints the public-safe billboard. Keeps the anti-spam invariant
  intact (explicit invocation only).
- **Add a live Dixie client** — only after explicit authorization,
  storage, and admission decisions land. Until then, the projected DTO
  shape remains the contract surface.
- **Design a governed admission path for Discord interaction logs** —
  candidate memory pipeline, signer/authorization, audit trail. Today
  Discord traffic is raw interaction source by default.
- **Design production storage** — Postgres for canonical estate /
  assertion / audit / receipt store; object storage for raw source
  blobs; pgvector or vector index as derived retrieval aid only;
  Redis for idempotency / cache / session.
- **Decide if/when character-voiced recall is allowed** — MVP is
  deliberately voiceless billboards (§12). A post-MVP decision must
  weigh persona coupling, prompt-injection / leakage risk, and
  determinism of proof.
- **Decide if/when onchain stats may be admitted as governed
  assertions** — today they remain external tool output (mibera-codex,
  score-mcp), not Recall Wedge memory.
- **Produce a cross-repo handoff for Straylight / Dixie / Freeside
  integration** — the repo-side boundary is now stable enough to be the
  surface contract for that conversation.
