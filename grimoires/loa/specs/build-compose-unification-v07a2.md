---
spec: build-compose-unification-v07a2
target_repo: 0xHoneyJar/freeside-characters
target_branch: main (post v0.9.1 + PR #8 streaming)
external_work_plan: true
session: 08 (kickoff · V0.7-A.2 compose-path unification)
date: 2026-05-02
mode: ARCH (Ostrom · invariants/blast-radius) + craft lens (Alexander · prompt material) + SHIP discipline (Barth · scope cuts)
status: kickoff (planned)
parent_brief: ./build-environment-substrate-v07a1.md (V0.7-A.1 · the substrate this builds on)
prior_session: ./build-environment-substrate-v07a1.md (cycle-001 · shipped via #6 + #7)
companion_proposal: ../proposals/qa-real-interaction-construct.md (QA construct paired with this cycle)
related:
  - PR #8 — feat(chat-mode): stream tool_use events + Claude-style progressive UX (combine into this cycle)
persona_load_order:
  - ~/bonfire/.claude/constructs/packs/the-arcade/identity/OSTROM.md
  - ~/bonfire/.claude/constructs/packs/artisan/identity/ALEXANDER.md
  - ~/bonfire/.claude/constructs/packs/the-arcade/identity/BARTH.md
---

# Session 08 — compose-path unification (V0.7-A.2)

> **One-line context**: V0.7-A.1 made the env substrate load-bearing (each character knows where it is, who's around, which tools to reach for). V0.7-A.2 finishes the argument: digest and chat are the SAME compose primitive with different env shapes, not two parallel pipelines. One `compose()` entry-point + one prompt builder, fragment selection driven by env, voice-fidelity gate intact.

---

## The reframe (operator, 2026-05-02)

> "I'm also not sure why chat mode is different than digest mode. I really think they should be two in the same thing. The digest is simply just a different type of chat, and the types of chat are informative or based on the environment that it's in. If it's like a chat window, then it would be super short, but there are times where the agent can be more verbose or have different expression methods."

**Translation**: post-shape (digest broadcast vs slash-reply vs micro vs weaver vs lore_drop vs question vs callout) is one DIMENSION of environment, not a different code path. The substrate's env block already encodes WHO/WHERE/WHAT'S HAPPENING; "what kind of utterance is this" is just another env field. Two parallel composers (`composeForCharacter` + `composeReply`) and two parallel prompt builders (`buildPromptPair` + `buildReplyPromptPair`) are historical accumulation from the V0.4-V0.7 evolution, not architectural necessity.

The reframe is **substrate over feature redux**: V0.7-A.1 made the env block real; V0.7-A.2 collapses the consumers onto it.

---

## Substrate findings (dig synthesis)

### What's already unified (Sprint 3 / Phase D · V0.7-A.1)

`packages/persona-engine/src/orchestrator/index.ts` — both digest and chat now share `runOrchestratorQuery`, per-character `mcps` whitelist via `buildAllowedTools`, and the same SDK stream (PR #8 makes the stream observable). This is the structural seam the unification builds on.

### What's still forked

| Surface | Digest | Chat | Why forked today |
|---|---|---|---|
| Composer entrypoint | `composeForCharacter` (composer.ts:composeZonePost) | `composeReply` (reply.ts) | Historical — digest predates V0.7-A; chat got bolted on alongside |
| Prompt builder | `buildPromptPair` (persona/loader.ts:171) | `buildReplyPromptPair` (persona/loader.ts:365+) | ~80% shared code; differences are fragment-vs-CONVERSATION_MODE_OVERRIDE + zone-payload-vs-transcript |
| Fragment selection | `loadFragment(personaPath, postType)` for 6 PostTypes | Hardcoded `CONVERSATION_MODE_OVERRIDE` constant | "reply" was never promoted to a real PostType |
| Output shape | Discord embed (broadcast) | Plain text + chunks (conversational) | Delivery shape — downstream of compose, but currently couples upward |
| Exemplars (ICE) | Loaded via `buildExemplarBlock` | Disabled (`exemplars = ''` per bridgebuilder F20 reasoning) | Voice-fidelity decision; preserved per-shape |
| Trust surface | Cron-driven (no user input) | User-triggered (prompt injection risk) | Real difference — but expressible as env property |
| Latency budget | Fire-and-forget | 14m30s timeout | Real difference — but expressible as env property |

### Voice-fidelity is the load-bearing constraint

Per spec line 567 + companion `satoshi-ruggy-experiment-validation.md`: "Stop at any phase boundary if voice fidelity regresses." Per-post-type fragments encode operator + Eileen + gumi voice-tuning over 6 cycles of iteration. Collapsing fragments into "let the LLM infer shape from env" risks register drift without explicit discipline.

**Resolution**: keep all 6 PostType fragments AND the CONVERSATION_MODE_OVERRIDE; promote 'reply' to a real PostType (loads its own fragment); env.shape becomes the fragment selector. Unification is at the COMPOSE LEVEL, not the FRAGMENT LEVEL — voice-tuning surface preserved unchanged.

### Per-post-type CONVERSATION_MODE_OVERRIDE alignment (carry from PR #8)

PR #8 fixes a sub-instance of this exact problem: chat-mode override said "tools out of scope" while orchestrator wired tools. Same shape: fragment-level instruction contradicting compose-level reality. The unification surfaces the same risk for ALL fragments — each fragment must agree with the env-driven compose path, OR the fragment must be the fragment-shape governing voice (the env block carries operational signals separately).

---

## Architecture (Ostrom)

### Invariants — these MUST NOT change

1. **Civic-layer separation** (Eileen 2026-04-20 vault canon): substrate governs cadence/delivery/MCP; characters supply voice. The unified compose stays system-agent — it doesn't speak.
2. **Voice fidelity ≥80% strip-the-name informal** (companion spec baseline). Per-fragment voice tuning is preserved across the unification — Eileen + gumi sign-off gates the merge.
3. **Per-character MCP scope** (Sprint 3 invariant). `buildAllowedTools(servers, character.mcps)` continues to filter at SDK layer regardless of which compose path called.
4. **Affirmative blueprints exclusively** (vault `[[negative-constraint-echo]]`). Fragment text describes what TO do; never what NOT to. Unification touches fragment dispatch, not fragment content.
5. **No new fragment shapes** (Barth scope cut). The 6 existing PostTypes + 'reply' is the complete set. Adding new shapes is a separate cycle (e.g., DM register, multi-turn reasoning, etc.).
6. **PR #8 streaming + onToolUse stays load-bearing**. The unification doesn't reach above the orchestrator boundary; tool-use events flow through unchanged.
7. **Backward compat at substrate boundary**. Existing `composeForCharacter` and `composeReply` exports remain (thin shims that delegate to the unified `compose()`); apps/bot consumers don't change. V0.8.0 tag for shims; V1.0.0 removal.

### Blast radius

| artifact | change | risk |
|---|---|---|
| `packages/persona-engine/src/compose/index.ts` | NEW · unified `compose()` entrypoint + `ComposeArgs` / `ComposeResult` types | LOW · pure function · delegates to existing primitives |
| `packages/persona-engine/src/persona/loader.ts` | Merge `buildPromptPair` + `buildReplyPromptPair` into `buildPrompt(args)` taking env-typed shape | MEDIUM · single shared substitution chain · two callers collapse into one |
| `packages/persona-engine/src/compose/post-types.ts` | Promote `'reply'` to PostType union; add per-shape spec | LOW · additive |
| `packages/persona-engine/src/compose/composer.ts` | `composeZonePost` becomes thin shim → `compose({invocation: 'cron-digest', ...})` | LOW · pure delegation |
| `packages/persona-engine/src/compose/reply.ts` | `composeReply` becomes thin shim → `compose({invocation: 'slash-reply', ...})` | MEDIUM · routing decision (CHAT_MODE) lifts to `compose()` |
| `packages/persona-engine/src/compose/environment.ts` | Add `invocation: 'cron' \| 'slash-reply' \| ...` field to env block builder | LOW · additive · existing callers unaffected |
| `apps/character-{ruggy,satoshi}/persona.md` | Add 'reply' fragment block (lifted from existing `CONVERSATION_MODE_OVERRIDE`); existing 6 fragments untouched | LOW · prose move · fragment content byte-identical |
| `apps/bot/src/discord-interactions/dispatch.ts` | (no change · still calls composeReply shim) | NONE |
| `apps/bot/src/index.ts` | (no change · still calls composeForCharacter shim) | NONE |

**Total**: 1 NEW file, 5 MODIFIED, 2 CONFIG (persona.md × 2). Public substrate API stays stable via shims.

### What breaks if I'm wrong

| failure mode | reversibility |
|---|---|
| Fragment selection logic differs from existing prompt builders → voice drift | Fragment content is byte-identical; only dispatch changed. Revert dispatch logic, behavior restored. |
| Promoting 'reply' to PostType breaks exhaustive switches (e.g., outputInstruction) | TypeScript catches at compile time; switches updated as part of the change. |
| `compose()` signature insufficiently expressive for some env shape | Args interface is structural; extend with new fields, no breaking change. |
| Shim-vs-direct-call migration issue in apps/bot | Shims preserve existing call sites; no migration needed for V0.7-A.2 ship. |
| Voice fidelity regresses despite fragment-level preservation | Stop at Phase E checkpoint per spec gate; revert dispatch; iterate via /voice workshop. |

---

## Component specifications (Alexander craft lens)

### `compose/index.ts` — material specification

**Material**: pure-function entrypoint. Takes `ComposeArgs` (character + environment + prompt + options); returns `ComposeResult` (text + chunks + meta + toolUses). Routing decision (CHAT_MODE auto/orchestrator/naive) lifts here from `compose/reply.ts`.

```ts
// packages/persona-engine/src/compose/index.ts

export type Invocation =
  | { type: 'cron-digest'; postType: PostType; zone: ZoneId; window: 'weekly' | 'daily' }
  | { type: 'cron-pop-in'; postType: PostType; zone: ZoneId }
  | { type: 'cron-weaver'; postType: PostType }
  | { type: 'slash-reply'; channelId: string; ephemeral: boolean }
  | { type: 'message-create'; channelId: string };  // V0.7-A.3+ future

export interface ComposeEnvironment {
  invocation: Invocation;
  zone?: ZoneId;
  recentMessages?: RecentMessage[];
  otherCharactersHere?: string[];
  /** Optional override for "now" — deterministic snapshot tests (passes through to env builder). */
  nowMs?: number;
}

export interface ComposeArgs {
  config: Config;
  character: CharacterConfig;
  environment: ComposeEnvironment;
  /** The "user message" — for cron, this is the structured payload (raw_stats etc.) rendered as text;
   *  for slash-reply, this is the user's prompt; for message-create, the message content. */
  prompt: string;
  /** Optional invoker metadata — used for ledger entries on slash-reply path. */
  invoker?: { id: string; username: string };
  options?: { historyDepth?: number };
  onToolUse?: (event: ToolUseEvent) => void;
}

export interface ComposeResult {
  text: string;
  chunks: string[];
  meta?: Record<string, unknown>;
  toolUses?: ToolUseEvent[];
  contextUsed: { ledgerSize: number; durationMs: number };
}

export async function compose(args: ComposeArgs): Promise<ComposeResult | null>;
```

**Rhythm**: one function, one args bag, one result. The `Invocation` discriminated union encodes "what kind of utterance is this" at the type level; switch-exhaustiveness keeps shape selection honest.

**Color-as-information**: `invocation.type` reads as the verb of the call ("cron-digest", "slash-reply"). The PostType for cron-shaped invocations stays nested inside `Invocation`, preserving the existing 6-fragment surface.

### `persona/loader.ts` — unified `buildPrompt`

**Material**: merge `buildPromptPair` + `buildReplyPromptPair` into `buildPrompt(args)`. Same template-loading + substitution chain (already shared); branch on `env.invocation.type` for fragment selection + user-half rendering.

```ts
export interface BuildPromptArgs {
  character: CharacterConfig;
  environment: ComposeEnvironment;
  prompt: string;
  history?: ReplyTranscriptEntry[];  // populated for slash-reply
  zonePayload?: ZoneDigestPayload;   // populated for cron paths
  environmentContext?: string;       // built upstream by compose/environment.ts
}

export function buildPrompt(args: BuildPromptArgs): { systemPrompt: string; userMessage: string };
```

**Rhythm**: one function. Internal switch on `env.invocation.type` selects fragment + user-half builder. Substitution table is the single source of truth for placeholder resolution.

**Backward compat**: `buildPromptPair(args)` and `buildReplyPromptPair(args)` remain as thin shims that delegate to `buildPrompt(...)` with the appropriate env shape. Marked `@deprecated` for removal in V1.0.0.

### Fragment promotion: `'reply'` becomes a PostType

```ts
// compose/post-types.ts
export type PostType =
  | 'digest' | 'micro' | 'weaver' | 'lore_drop' | 'question' | 'callout'
  | 'reply';  // V0.7-A.2 — chat-mode shape promoted to PostType
```

**Persona.md change** (both ruggy + satoshi):

Lift the existing `CONVERSATION_MODE_OVERRIDE` content (already in `persona/loader.ts:291`) into a real `<!-- @FRAGMENT: reply -->` block in each character's persona.md. Content is BYTE-IDENTICAL to today's override (modulo the v0.9.1 affirmative-blueprint tool guidance). Voice tuning preserved unchanged.

The existing 6 fragments stay untouched. 'reply' joins them as the 7th. `loadFragment(personaPath, 'reply')` works the same way `loadFragment(personaPath, 'digest')` does today.

### Shim layer: `composeForCharacter` + `composeReply`

```ts
// composer.ts — shim
export async function composeZonePost(args: LegacyZonePostArgs): Promise<ZonePostResult> {
  const result = await compose({
    config: args.config,
    character: args.character,
    environment: {
      invocation: { type: 'cron-digest', postType: args.postType, zone: args.zone, window: args.window },
      zone: args.zone,
    },
    prompt: renderZonePayloadAsPrompt(args.zonePayload),
  });
  return mapToZonePostResult(result);
}

// reply.ts — shim
export async function composeReply(args: ReplyComposeArgs): Promise<ReplyComposeResult | null> {
  return compose({
    config: args.config,
    character: args.character,
    environment: {
      invocation: { type: 'slash-reply', channelId: args.channelId, ephemeral: args.options?.ephemeral ?? false },
      zone: args.zone,
      recentMessages: /* loaded from ledger as before */,
      otherCharactersHere: args.otherCharactersHere,
    },
    prompt: args.prompt,
    invoker: { id: args.authorId, username: args.authorUsername },
    onToolUse: args.onToolUse,
    options: { historyDepth: args.options?.historyDepth },
  });
}
```

**Why shims**: apps/bot consumers continue to compile + work without code changes. Migration to direct `compose()` calls is a follow-up cleanup PR (V0.7-A.3+).

---

## Build sequence (Barth — V1 ship scope)

Five phases. Phases A-C are mechanical (refactor); Phase D is the voice-fidelity verify gate; Phase E is shim cleanup (deferrable).

### Phase A — Promote 'reply' PostType + lift CONVERSATION_MODE_OVERRIDE to fragment (~30min)

**Files**:
- `packages/persona-engine/src/compose/post-types.ts` (extend PostType union)
- `apps/character-ruggy/persona.md` (add `<!-- @FRAGMENT: reply -->` block)
- `apps/character-satoshi/persona.md` (add `<!-- @FRAGMENT: reply -->` block)
- `packages/persona-engine/src/persona/loader.ts` (add 'reply' case to `outputInstruction`)

**Pattern**: lift the CONVERSATION_MODE_OVERRIDE constant content into per-character persona.md fragments. Content is byte-identical (post-v0.9.1 affirmative-blueprint tool guidance). The constant in loader.ts becomes unused (removable in Phase E).

**Verify**: `bun typecheck` clean; existing chat-mode behavior identical (smoke verification).

### Phase B — Unified `buildPrompt(args)` (~1h)

**Files**:
- `packages/persona-engine/src/persona/loader.ts` (NEW `buildPrompt` function; existing builders become thin shims)
- `packages/persona-engine/src/compose/post-types.ts` (helper to map `Invocation` → `PostType` for fragment loading)

**Pattern**: extract the shared substitution chain into `buildPrompt`. Branch on `args.environment.invocation.type` for user-half rendering (zonePayload vs transcript+prompt). Existing callers unchanged (shims).

**Verify**: snapshot test — `buildPrompt` with cron-digest env produces byte-identical output to `buildPromptPair`; `buildPrompt` with slash-reply env produces byte-identical output to `buildReplyPromptPair`. New smoke at `apps/bot/scripts/smoke-build-prompt.ts`.

### Phase C — Unified `compose()` entrypoint (~1h)

**Files**:
- `packages/persona-engine/src/compose/index.ts` (NEW)
- `packages/persona-engine/src/compose/composer.ts` (`composeZonePost` becomes shim)
- `packages/persona-engine/src/compose/reply.ts` (`composeReply` becomes shim)
- `packages/persona-engine/src/index.ts` (export `compose`, `ComposeArgs`, `ComposeResult`)

**Pattern**: lift CHAT_MODE routing decision + ledger handling + chunk splitting into `compose()`. Existing entrypoints become thin delegations.

**Verify**: existing smokes (smoke-zone-map, smoke-environment, smoke-chat-routing, smoke-persona-environment) pass unchanged. New smoke `smoke-compose-unified.ts` exercises `compose()` directly with both invocation types.

### Phase D — Voice fidelity gate (~30min · operator-bounded)

**Files**: N/A (verification only)

**Pattern**: 3 stub-mode dry-run digests per character + 3 dry-run chats per character (12 samples total). Substrate plumbing check against the unified path. Real-LLM voice fidelity check is operator-bounded (gumi blind-judge per companion spec strip-the-name baseline ≥80%).

**Verify**: Eileen async review of fragment lift (bytes-identical confirmation); operator dev-guild test for live LLM behavior; gumi blind-judge sign-off.

🛑 Stop at this phase if voice fidelity regresses. Per spec gate.

### Phase E — Shim removal (DEFERRABLE · V0.7-A.3 or V1.0.0)

**Files**: `composer.ts`, `reply.ts`, all apps/bot callers

**Pattern**: migrate apps/bot direct callers from `composeForCharacter`/`composeReply` to `compose()`. Remove shims.

**Phase E is OUT OF SCOPE for V0.7-A.2 ship**. Shims preserve V0.6-V0.7 callers indefinitely; cleanup is its own cycle.

---

## Combine with PR #8 (operator request)

PR #8 (`feat(chat-mode): stream tool_use events + Claude-style progressive UX`) and this cycle's V0.7-A.2 work BOTH touch the chat compose path + orchestrator. Operator wants them combined for one QA pass.

**Combined branch**: `feat/chat-tool-streaming` (extends with Phase A-D commits stacked on PR #8's existing commit `56400a3`).

**Combined PR**: PR #8 description gets updated to cover both V0.7-A.2 phases + the streaming refactor. Bridgebuilder reviews combined diff. One QA cycle covers the unified surface.

**Risk**: bigger PR for review. Mitigation: per-phase commits with clean revert boundaries; reviewer.md walks each phase's AC; QA construct (companion proposal) generates real-interaction QA scenarios for the operator.

---

## What NOT to build (Barth scope cut)

- ❌ **Removing the CONVERSATION_MODE_OVERRIDE constant** — keep it through Phase D as a fallback; remove in Phase E.
- ❌ **New PostType shapes** (DM, multi-turn reasoning, etc.) — V0.7-A.3+ kickoff.
- ❌ **Migrating apps/bot direct callers** — Phase E, deferrable.
- ❌ **Persona-template restructure** — fragments stay where they are; only one new fragment added per character.
- ❌ **Per-character LLM provider override** — already deferred per V0.7-A.1.
- ❌ **CONVERSATION_MODE_OVERRIDE editing** — content stays byte-identical; only relocated to fragment block.
- ❌ **Zod schemas for `ComposeArgs`** — TypeScript types only; runtime validation is the LLM SDK's job.
- ❌ **Cross-character coordination via shared file** — V0.7-B+ (carry from V0.7-A.1 scope cuts).
- ❌ **"While I'm here..." cleanups** — banned. Phase scope is locked.

---

## Verify (session exit gate)

| check | how |
|---|---|
| Phase A | persona.md fragments load correctly; `bun typecheck` clean; existing chat-mode behavior byte-identical via smoke regression |
| Phase B | `buildPrompt` snapshot output matches `buildPromptPair` + `buildReplyPromptPair` outputs for fixed inputs |
| Phase C | `compose()` snapshot output matches `composeForCharacter` + `composeReply` outputs; cross-sprint smoke regression green |
| Phase D | 3 dry-run digests + 3 dry-run chats per character; voice fidelity holds; Eileen async sign-off; gumi blind-judge ≥80% |
| ALL | workspace `bun run typecheck` clean; `bun run apps/bot/scripts/smoke-*.ts` (all smokes) green; per-character MCP scope honored; PR #8 streaming behavior preserved |

🛑 **Stop at Phase D if voice fidelity regresses**.

🎯 **Done-bar**: one `compose()` entrypoint + one `buildPrompt` builder; 'reply' is a real PostType; fragment-level voice tuning preserved unchanged; PR #8 streaming continues to surface tool calls; existing apps/bot callers unaffected via shims; QA construct (companion proposal) used to generate operator-facing real-interaction scenarios.

---

## Coordination needed

1. **Eileen** — async review of Phase A fragment lift (confirm CONVERSATION_MODE_OVERRIDE-to-fragment relocation is byte-identical content); ratify the affirmative-blueprint persona prose lift.
2. **Gumi** — async sign-off on voice-fidelity gate (Phase D · gumi blind-judge strip-the-name baseline). Pairs with V0.7-A.1 cycle-001 deferred verification.
3. **Operator** — confirm scope cuts (Barth's NO list); ratify combine-with-PR#8 branching strategy; approve QA construct invocation as the validation primitive.
4. **PR #8 verification** — dev-guild test of streaming + onToolUse must land before Phase D voice-fidelity gate (don't refactor on top of suspected SDK behavior).

---

## Distillation candidates (post-stabilization · already named)

- `[[unified-compose]]` vault doctrine — substrate is one composer + env-driven shape selection; consumers vary by invocation, not by entrypoint. Generalizes beyond freeside-characters to any agent runtime where the same primitive serves multiple delivery surfaces.
- `compose-shim-pattern` — gradual-migration template using thin delegating shims to preserve consumer compatibility while consolidating internal architecture. Companion to `[[gateway-as-registry]]`.

---

## Key references

| topic | file / URL |
|---|---|
| parent cycle (V0.7-A.1) | `./build-environment-substrate-v07a1.md` |
| QA construct proposal | `../proposals/qa-real-interaction-construct.md` |
| PR #8 (combine into this cycle) | https://github.com/0xHoneyJar/freeside-characters/pull/8 |
| compose entrypoints (forked today) | `packages/persona-engine/src/compose/composer.ts` (digest) · `packages/persona-engine/src/compose/reply.ts` (chat) |
| prompt builders (forked today) | `packages/persona-engine/src/persona/loader.ts:171` (`buildPromptPair`) · `:365+` (`buildReplyPromptPair`) |
| CONVERSATION_MODE_OVERRIDE | `packages/persona-engine/src/persona/loader.ts:291+` |
| PostType union | `packages/persona-engine/src/compose/post-types.ts` |
| companion voice-fidelity spec | `~/bonfire/grimoires/bonfire/specs/satoshi-ruggy-experiment-validation.md` |
| vault: civic-layer doctrine | `~/vault/wiki/concepts/agent-native-civic-architecture.md` |
| vault: continuous-metadata-as-daemon-substrate | `~/vault/wiki/concepts/continuous-metadata-as-daemon-substrate.md` |
| vault: metadata-as-integration-contract | `~/vault/wiki/concepts/metadata-as-integration-contract.md` |
| vault: reading-the-room | `~/vault/wiki/concepts/reading-the-room.md` |
| vault: negative-constraint-echo (HIGH-impact) | `~/vault/wiki/concepts/negative-constraint-echo.md` |

---

⏱ **Estimated**: 3-4 hours for Phases A-D (sprint scope). Phase E (shim removal) deferred to V0.7-A.3+.

🎯 **Done-bar**: chat and digest are the same `compose()` invocation with different env shapes; voice fidelity holds; PR #8 streaming continues to surface tool calls; operator runs the QA construct against the combined PR for real-interaction validation.

🌀 **Distillation candidates** (post-stabilization):
- `[[unified-compose]]` — env-driven shape selection as portable doctrine
- `compose-shim-pattern` — gradual-migration template using delegating shims
