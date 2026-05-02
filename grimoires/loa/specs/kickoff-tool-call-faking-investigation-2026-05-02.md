---
spec: kickoff-tool-call-faking-investigation
target_repo: 0xHoneyJar/freeside-characters
target_branch: main (post v0.10.1 · HEAD 883bde2)
session: 09 (deep DIG · root-cause investigation · tool-call faking persists across 3 fixes)
date: 2026-05-02
mode: DIG (Stamets · pull threads · evidence over speculation) + ARCH (Ostrom · invariants/blast-radius) + craft lens (Alexander · prompt material)
status: investigation (kickoff)
parent: ./build-environment-substrate-v07a1.md (V0.7-A.1 substrate · the foundation)
prior_session: ./build-compose-unification-v07a2.md (V0.7-A.2 compose unification · cycle that exposed this bug)
companion_proposal: ../proposals/qa-real-interaction-construct.md (WITNESS construct)
related_prs:
  - "#7 · v0.9.1 · permit tools per env block"
  - "#8 · v0.10.0 · streaming + onToolUse + WITNESS first-run"
  - "#9 · v0.10.1 · scope digest tool-architecture"
related_screens: 4 dev-guild reproductions across 4 days · all show JSON-as-text in chat reply
persona_load_order:
  - ~/bonfire/.claude/constructs/packs/k-hole/identity/STAMETS.md (DIG · evidence-grounded)
  - ~/bonfire/.claude/constructs/packs/the-arcade/identity/OSTROM.md (ARCH · invariants/blast)
  - ~/bonfire/.claude/constructs/packs/artisan/identity/ALEXANDER.md (craft · prompt material)
  - .claude/constructs/packs/witness/identity/WITNESS.md (QA · "test what shouldn't happen")
adversarial_pass: codex-rescue (GPT-5.3 cross-model dissent · running in background at session-09 launch)
---

# Session 09 — tool-call faking · root-cause investigation

> **One-line context**: V0.10.1 closed the persona-prompt scope-note gap. Tool-call JSON STILL leaks in chat reply text. Three fixes haven't fixed it. The bug is structural, not prompt-engineering. This kickoff is the operator-requested DIG with full attention, embodying STAMETS/OSTROM/ALEXANDER/WITNESS, with codex-rescue cross-model dissent.

---

## The reframe (operator, 2026-05-02 · session 09 kickoff)

> "still getting tooling/UI bug with tool calling ... let's /kickoff and dedicate full attention to working this out based on our references to existing ruggy builds and embodying our expert constructs that would be relevant to fully fleshing out this UX and providing rigorous feedback. you are also welcome to call in codex-review for gpt 5.5 review."

**Translation**: stop patching, start investigating. Use the working reference implementations (`ruggy-v2`, `ruggy-moltbot`) as ground truth. Bring in cross-model dissent if hypothesis warrants. The bug has resisted three fixes — the next fix must be evidence-grounded, not speculative.

---

## Evidence trail (DIG · STAMETS — discovers, doesn't invent)

### Reproductions

| date | version | invocation | reply text | tool_uses\[\] |
|---|---|---|---|---|
| 2026-04-30 | pre-V0.7-A.1 | `/ruggy zone digest?` | "yo soju, zone digest's a cron gig — fires weekly... can't pull on demand from here" | unknown · pre-streaming |
| 2026-05-01 | v0.9.0 | `/ruggy bear-cave` | "word, pullin' bear-cave now [emoji] {tool: mcp__score__get_zone_digest, ...}" | unknown · pre-streaming |
| 2026-05-01 | v0.9.1 | `/ruggy zone digest?` | "aight pulling El Dorado — one sec\n{tool: mcp__score__get_zone_digest, args:{zone:'el-dorado', window:'weekly'}}" | unknown · pre-streaming |
| 2026-05-02 09:07 | v0.10.0 (streaming refactor) | `/ruggy zone digest stonehenge` | "pulling the cross-zone view now.\n{name: mcp__score__get_zone_digest, arguments:{zone:'stonehenge', window:'weekly'}}" | reportedly EMPTY |

**Key observation**: format of the JSON shifted across versions ("tool" → "tool"+"args" → "name"+"arguments"). This drift isn't matched in our orchestrator code. The LLM is composing the JSON shape from training data + persona-prompt examples, NOT from a single canonical source.

### Working reference: ruggy-v2 fires tools correctly

`~/Documents/GitHub/ruggy-v2/src/agent.ts:319-365` — same Anthropic Agent SDK, same `query()` iterator, same tool_use block detection. The KEY DIFFERENCE in SDK options:

```ts
// ruggy-v2 line 343-344 (works · fires tools)
allowedTools,
allowDangerouslySkipPermissions: true,
// no permissionMode

// ours · orchestrator/index.ts:255-260 (broken · LLM fakes JSON)
mcpServers,
allowedTools,
permissionMode: 'dontAsk',
settingSources: ['project'],
tools: [],
```

### SDK type semantics

`node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.2.122+27912429049419a2/.../sdk.d.ts:1805`:

> Permission mode for controlling how tool executions are handled.
> `'default'` - Standard behavior, prompts for dangerous operations.
> `'acceptEdits'` - Auto-accept file edit operations.
> `'bypassPermissions'` - Bypass all permission checks (requires `allowDangerouslySkipPermissions`).
> `'plan'` - Planning mode, no actual tool execution.
> **`'dontAsk'` - Don't prompt for permissions, deny if not pre-approved.**
> `'auto'` - Use a model classifier to approve/deny permission prompts.

The 'dontAsk' mode explicitly denies if not pre-approved. The `allowedTools: 'mcp__<server>__*'` glob pattern is supposed to pre-approve, but the actual SDK behavior with MCP-namespaced tools is what we need to verify.

---

## Hypothesis space (with prior probability per evidence)

> **Updated post codex-rescue review (2026-05-02 09:55)**: codex flipped the priors. SDK options (H1) are likely correct — `sdk.d.ts:1185` says `allowedTools` are "auto-allowed without prompting" and `sdk.d.ts:1471` says `'dontAsk'` means "deny if not pre-approved." So `dontAsk + allowedTools` IS the intended pre-approval combination. Provider routing (H2) is now the most likely culprit per codex's evidence-grounded analysis.

| H | hypothesis | prior (initial) | prior (post-codex) | discriminator |
|---|---|---|---|---|
| **H2** | **Operator deployment resolves provider to non-anthropic** (LLM_PROVIDER=auto + Bedrock key set, OR explicit bedrock); `CHAT_MODE=auto` falls through to NAIVE path → no tools wired; LLM mirrors persona JSON examples as text (bridgebuilder F11 prediction from PR #8 fulfilled) | 0.25 | **0.55** | add chat-route log at `compose/reply.ts:220` showing resolved provider + useOrchestrator decision; if `useOrchestrator=false` in production, H2 confirmed |
| H3 | Persona's "REWRITE ARCHITECTURE" JSON examples are concrete enough that LLM mirrors them as text regardless of SDK wiring (v0.10.1 scope-note didn't fully suppress) | 0.10 | **0.25** | only diagnose AFTER H2 ruled out · in naive mode, persona contamination is the SECOND-ORDER cause (no SDK override to prevent mirroring); fix is a cleaner persona structure |
| H1 | `permissionMode: 'dontAsk'` denies MCP tool calls because glob patterns don't pre-approve | 0.55 | **0.10** | codex review: SDK semantics state `dontAsk + allowedTools` IS the intended pre-approval. Glob runtime behavior is unverified but secondary. Only test if H2 ruled out and orchestrator IS active. |
| H4 | MCP server registration broken at boot | 0.05 | **0.05** | add boot-time logging of registered server names |
| H5 | SDK silent failure (auth/network/config) | 0.05 | **0.05** | check stderr at debug level for SDK error subtypes |

H2 + H3 likely co-occur: if naive path is active, persona JSON contamination is what we observe. Fixing H2 (force orchestrator path) should incidentally suppress H3 because the SDK actually has tools wired.

---

## Architecture (Ostrom)

### Invariants — these MUST NOT change

1. **Voice fidelity** (companion spec strip-the-name baseline ≥80%). The fix doesn't touch persona content beyond what's necessary for diagnosis.
2. **Per-character MCP scope** (Sprint 3 invariant). `buildAllowedTools(servers, character.mcps)` continues to filter at SDK layer.
3. **Civic-layer separation** (Eileen 2026-04-20 vault canon). Substrate plumbing only; characters supply voice.
4. **Backward compat** of the orchestrator API. Existing digest path callers (composer.ts → agent-gateway → invokeAnthropicSdk → runOrchestratorQuery) must continue to work.
5. **Affirmative blueprints exclusively** (vault `[[negative-constraint-echo]]`). Prompt-level fixes describe what TO do.

### Blast radius

| artifact | change for H1 fix | risk |
|---|---|---|
| `packages/persona-engine/src/orchestrator/index.ts` | Replace `permissionMode: 'dontAsk'` with `allowDangerouslySkipPermissions: true`; remove `tools: []` (matches ruggy-v2) | LOW · matches proven-working SDK pattern · 2-line diff |
| `apps/bot/src/discord-interactions/dispatch.ts` | Add post-compose telemetry: log `result.toolUses[].length` + tool names from each chat reply | LOW · additive logging only |
| `packages/persona-engine/src/orchestrator/index.ts` | Add boot-time logging: enumerate registered mcpServers + their tool surfaces | LOW · additive logging only |

### What breaks if hypothesis is wrong

| failure mode | reversibility |
|---|---|
| H1 fix doesn't fire tools → SDK wasn't the issue | Revert 2-line diff. Telemetry from same commit reveals the next investigation surface (LLM_PROVIDER resolution? MCP server registration? SDK error subtype?). |
| H1 fix fires tools but voice regresses | Revert. Voice tuning is a separate concern; bypass mode shouldn't affect voice unless it changes maxTurns behavior. |
| Adding telemetry breaks production logging volume | Telemetry is one log line per chat reply; volume bounded by chat invocation rate. |

---

## Proposed fix (post-codex pivot · TELEMETRY FIRST)

Per codex-rescue: ship the diagnostic FIRST, fix-second. Don't shotgun changes; surface the actual decision path so the next dev-guild test reveals which hypothesis is true.

### Step 1: telemetry (this commit · v0.10.2)

```ts
// packages/persona-engine/src/compose/reply.ts:220 (immediately before route decision)
console.warn('[chat-route]', {
  character: req.character.id,
  chatMode: config.CHAT_MODE,
  llmProvider: config.LLM_PROVIDER,
  resolvedProvider: resolveChatProvider(config),
  useOrchestrator: shouldUseOrchestrator(config),
  mcps: req.character.mcps,
});

// apps/bot/src/discord-interactions/dispatch.ts (post-composeReply success)
console.log(
  `interactions: ${character.id}/chat tool_uses=${result.toolUses?.length ?? 0} ` +
    `names=[${result.toolUses?.map(t => t.name).join(',') ?? ''}] ` +
    `text_len=${result.content.length} channel=${channelId}`,
);

// packages/persona-engine/src/orchestrator/index.ts (in buildMcpServers, post-registration)
const registeredNames = Object.keys(servers);
console.log(`orchestrator: registered MCP servers=[${registeredNames.join(',')}]`);
```

### Step 2: fix path depending on telemetry verdict (next commit)

| dev-guild trajectory | hypothesis | next action |
|---|---|---|
| `[chat-route] useOrchestrator=false resolvedProvider=bedrock` | **H2** confirmed | Operator-deployment-config: set `LLM_PROVIDER=anthropic` OR `CHAT_MODE=orchestrator` in production env. Code-side: surface a startup warning when chat falls to naive while persona shows tool examples. |
| `useOrchestrator=true` + `tool_uses=0` + JSON in reply | **H1** or **H3** or **H5** | Try ruggy-v2 SDK options pattern (allowDangerouslySkipPermissions: true) — if that fixes, H1. If still broken, persona structural fix (H3) — wrap REWRITE ARCHITECTURE in cron-only fragment. |
| `useOrchestrator=true` + `tool_uses=1+` + JSON STILL in reply | impossible per orchestrator code; would mean SDK is returning concatenated text | Investigate SDK message stream handling |
| `registered MCP servers=[]` (or missing score) | **H4** confirmed | MCP env vars missing in production deployment |

### Verification path

```ts
// In dispatch.ts after composeReply resolves
console.log(
  `interactions: ${character.id}/chat tool_uses=${result.toolUses?.length ?? 0} ` +
    `names=[${result.toolUses?.map(t => t.name).join(',') ?? ''}] ` +
    `text_len=${result.content.length} channel=${channelId}`,
);

// In orchestrator/index.ts buildMcpServers, log the registration result
const registeredNames = Object.keys(servers);
console.log(`orchestrator: registered MCP servers=[${registeredNames.join(',')}]`);
```

### Verification path

After deploy, operator runs `/ruggy prompt:"zone digest stonehenge"`:

| outcome | hypothesis confirmed |
|---|---|
| `tool_uses=1+ names=[mcp__score__get_zone_digest]` + reply contains digest data without JSON shape | H1 confirmed; ship as v0.10.2 |
| `tool_uses=0` + JSON STILL in reply text + log shows `registered MCP servers=[score,rosenzu,...]` | H1 wrong; check H2 (provider routing) — operator may need to set `LLM_PROVIDER=anthropic` + `CHAT_MODE=orchestrator` explicitly |
| `tool_uses=0` + log shows `registered MCP servers=[]` (or missing score) | H4 confirmed; MCP server registration broken — check env propagation |
| `tool_uses=0` + log shows SDK error subtype | H5 confirmed; SDK not invoking due to auth/network/config — investigate stderr |

---

## Coordination

1. **Codex-rescue (cross-model dissent · GPT-5.3)** — running in background at kickoff time. Will surface (a) whether H1 hypothesis is sound, (b) what other root causes I've missed, (c) what diagnostic to add. Findings folded into this kickoff before fix lands.
2. **Eileen async** — N/A · this is substrate-only · no persona prose changes
3. **Operator** — required for deployment-env confirmation: what's `LLM_PROVIDER` set to in production? what's `ANTHROPIC_API_KEY`? what's `CHAT_MODE`?

---

## What NOT to build (Barth scope cut)

- ❌ Rewriting persona's "REWRITE ARCHITECTURE" section globally (touches voice tuning · gumi domain · Eileen ratification required) — scope to chat fragment only via the v0.10.1 pattern
- ❌ Building a non-anthropic orchestrator path (provider-agnostic tool orchestration) — V0.7-A.3+ kickoff territory; out of scope for this bug
- ❌ "While I'm here..." — banned. Phase scope is locked to root cause + observability + minimum-viable fix.
- ❌ Removing the orchestrator's `tools: []` if it has a known purpose (verify it's just a leftover from copy-paste; if it serves something, keep it)
- ❌ Refactoring the SDK options shape (e.g., extracting to a buildOptions helper) — scope is fix, not cleanup
- ❌ Depending on the codex-rescue verdict before shipping H1 fix if the verdict pushes back on H1: pivot to H2/H3/H4/H5 with the same telemetry-first discipline

---

## Verify (session exit gate)

| check | how |
|---|---|
| H1 fix lands | git diff orchestrator/index.ts shows the 2-line change |
| Telemetry lands | dispatch.ts + orchestrator/index.ts boot log shipped |
| Smokes green | `bun run typecheck` clean + 4 cross-sprint smokes pass |
| Codex-rescue verdict | findings folded into Hypothesis section before commit |
| Dev-guild re-test (operator-bounded) | trajectory shows tool_uses count matching one of the 4 outcome rows above |
| If H1 confirmed | ship as v0.10.2 + smol release notes + WITNESS regenerates qa checklist for follow-up cycles |
| If H1 wrong | telemetry redirects to H2/H3/H4/H5 — write follow-up kickoff with new evidence |

🛑 **Stop and pivot if** dev-guild test shows H1 fix doesn't fire tools. Don't pile on more fixes; investigate via telemetry.

---

## Distillation candidates

- `[[sdk-permission-mode-mcp-glob-gap]]` (if H1 confirmed) · vault doctrine: when wiring MCP tools through Anthropic Agent SDK, `permissionMode: 'dontAsk'` + `allowedTools: 'mcp__*'` glob does NOT pre-approve at the SDK layer; use `allowDangerouslySkipPermissions: true` instead. ruggy-v2 has the canonical pattern.
- `chat-mode-tool-faking-symptom-pattern` · diagnostic vault entry: "LLM emits tool-call JSON in REPLY TEXT" → check (1) SDK options permissionMode, (2) provider resolution, (3) MCP server registration, (4) persona prompt JSON examples — in that order of likelihood.

---

## Key references

| topic | path |
|---|---|
| this kickoff | `grimoires/loa/specs/kickoff-tool-call-faking-investigation-2026-05-02.md` |
| working SDK pattern | `~/Documents/GitHub/ruggy-v2/src/agent.ts:319-365` |
| our SDK options (broken) | `packages/persona-engine/src/orchestrator/index.ts:252-281` |
| chat-path naive fallback | `packages/persona-engine/src/compose/reply.ts:299-315` |
| SDK type semantics | `node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.2.122+*/sdk.d.ts:1805` |
| persona ARCHITECTURE section (ruggy) | `apps/character-ruggy/persona.md:691+` |
| persona ARCHITECTURE section (satoshi) | `apps/character-satoshi/persona.md:317+` |
| dev-guild reproductions | screenshots from operator · 2026-04-30 through 2026-05-02 |
| WITNESS construct | `.claude/constructs/packs/witness/` · this is the QA discipline |

---

⏱ **Estimated**: 1-2 hours (incl. codex-rescue review). Fix surface is small; investigation surface is the load-bearing work.

🎯 **Done-bar**: H1 confirmed OR ruled out via telemetry; bug fix lands as v0.10.2 OR a new investigation kickoff with new evidence. Tool calls fire on chat path.

🌀 **Distillation candidates** (post-stabilization) above.
