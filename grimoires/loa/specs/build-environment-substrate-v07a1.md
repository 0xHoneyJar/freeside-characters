---
spec: build-environment-substrate-v07a1
target_repo: 0xHoneyJar/freeside-characters
target_branch: main (post v0.8.0 ship · 1391b13)
external_work_plan: true   # Loa not mounted on target yet — Phase A mounts; subsequent artifacts migrate to freeside-characters/grimoires/loa/specs/
session: 06 (kickoff · V0.7-A.1 environment substrate)
date: 2026-05-01
mode: ARCH (Ostrom · invariants/blast-radius) + craft lens (Alexander · prompt material) + SHIP discipline (Barth · scope cuts)
status: kickoff (planned)
parent_brief: ./listener-router-substrate.md
prior_session: ./build-listener-substrate-v07a0.md (V0.7-A.0 slash commands shipped)
companion_spec: ./satoshi-ruggy-experiment-validation.md (voice-fidelity validation continues in parallel)
related:
  - ./kickoff-substrate-prep-eileen-2026-04-30.md (substrate prep — items #1, #2, #3 all shipped via 0.8.0)
  - ../research/gemini-deep-research-output-multi-character-bot-substrate-2026-04-30.md (production patterns)
persona_load_order:
  - ~/bonfire/.claude/constructs/packs/the-arcade/identity/OSTROM.md
  - ~/bonfire/.claude/constructs/packs/artisan/identity/ALEXANDER.md
  - ~/bonfire/.claude/constructs/packs/the-arcade/identity/BARTH.md
---

# Session 06 — Agent environment substrate (V0.7-A.1)

> **One-line context**: V0.6 shipped digest-only Pattern B. V0.7-A.0 shipped slash commands + chat-reply path. V0.8.0 (Eileen) shipped Bedrock chat + Bedrock Stability imagegen + per-character MCP scoping + per-character commands. **What's missing**: agents are write-aware (post into channels) but not **environment-aware** — they don't know which Mibera Codex location they're in, who else is here, or how to invoke their tools naturally per ChatGPT-style. This session builds the thin awareness substrate that closes the gap.

---

## The reframe (operator, 2026-05-01)

> "agents to be kind of more aware of their environment ... within the Discord context, it's important that we're very clear about how the different channels represent different locations within the Mibera Codex ... having it feel directionally aligned with the daemon means that there's actual awareness and spatial awareness ... very similar to how ChatGPT works from a user perspective, a lot of these things happen automatically."

**Translation**: build the substrate that lets each character know **where they are**, **what tools they have**, **who else is here**, and **how their personality should govern tool invocation**. ChatGPT does this implicitly via system-prompt + tool inference — we replicate the pattern grounded in the substrate we already have (codex MCP, rosenzu MCP, score MCP, character.json, channel↔zone wiring).

The reframe is **substrate over feature**: not a new product surface, but the foundation that makes future surfaces feel natural.

---

## Substrate findings (dig synthesis)

### Critical gap: chat-mode bypasses MCPs

`packages/persona-engine/src/compose/reply.ts:14, 204-208` — the chat-reply path **does not register MCP servers**. This is the structural reason the agents feel un-tool-aware in chat: they literally don't have access to score / codex / rosenzu / imagegen during slash-command replies. Digest path uses orchestrator (full MCP suite); chat path uses naive `invokeChat()` (no tools).

**Fix**: wire chat-mode through the orchestrator with the character's declared `mcps` scope. Ruggy chats with score+codex+emojis+rosenzu+freeside_auth; Satoshi chats with codex+imagegen. The personality + environment context guides invocation; the MODEL decides when.

### Rosenzu IS the spatial substrate (already) · extending into temporal/social = "read_room"

`packages/persona-engine/src/orchestrator/rosenzu/server.ts:45-66+` exposes 5 tools (Kevin Lynch lens — node / district / edge / path / inner_sanctum + KANSEI palette + threshold-as-door): `get_current_district`, `audit_spatial_threshold`, `fetch_landmarks`, `furnish_kansei`, `threshold`. **Spatial half of the lens.**

**Operator reframe (2026-05-01)**: Discord awareness should integrate with **"reading the room"** — the temporal/social counterpart to spatial awareness. Same Lynch lens applied to the **moment-shape** of a channel: who's here · how warm is the activity · what's the tonal weight right now · what's the recent vibe.

**Resolution**: rosenzu adds a 6th tool — `read_room({zone, recent_message_count, recent_message_summary, presence, minutes_since_last_post})` — that derives the temporal/social read from substrate-assembled inputs. **Place** (district + landmarks + KANSEI baseline) **+ Moment** (temperature + density + tonal weight + vibe hint) is the rosenzu-canonical pair. Phase C extends rosenzu and the environment-context builder pre-calls it for inline grounding (model can also re-call mid-turn if it wants a fresh read).

### Reverse channel→zone map missing

`config.ts:166-177` (`getZoneChannelId(zone) → channelId`) is the **forward** direction only. The reverse (`getZoneForChannel(channelId) → ZoneId`) doesn't exist. Without it, no chat handler can answer "which codex location am I in?" without a hand-rolled lookup. Phase B builds the canonical reverse.

### Persona prompt has injection seams (already)

`persona/loader.ts:236-248` (digest) + `:392-399+` (reply) substitute placeholders like `{{CODEX_PRELUDE}}`, `{{VOICE_ANCHORS}}`, `{{CODEX_ANCHORS}}`, `{{EXEMPLARS}}`. Adding `{{ENVIRONMENT}}` slots into the same machinery. **No new infrastructure** — extend the substitution table.

### Per-character MCP scoping LIVE (V0.8.0)

`orchestrator/index.ts:150-159` (`buildAllowedTools`) already filters by `character.mcps`. Ruggy: `[score, codex, emojis, rosenzu, freeside_auth]`. Satoshi: `[codex, imagegen]`. The schema works. Chat-mode wiring inherits this filter for free.

### Webhook density isn't the wall (Pattern B headroom verified)

- Discord webhook count cap per channel: ~10-15 (older sources say 10; current widely-cited 15). Operator's "10" is plausible.
- **But Pattern B uses ONE shell webhook with per-message identity override.** PluralKit proxies hundreds of identities through 1 webhook per channel. Identity density is uncapped at the substrate level.
- The actual ceiling: **5 messages / 5 sec channel-wide rate** (~60 msg/min, shared bucket across senders). Plus 5 req/2sec per webhook execute.
- For 10+ character experiment: Pattern B is fine. Constraint is firing rate, not identity count.

---

## Architecture (Ostrom)

### Invariants — these MUST NOT change

1. **Civic-layer separation** (Eileen 2026-04-20 vault canon): substrate (system-agent) governs cadence/delivery/MCP; characters (participation-agent) supply voice. The environment substrate stays system-agent — it doesn't speak.
2. **Pattern B is canonical** (one shell, per-message identity override). Identity density is decoupled from webhook count. We do NOT split into per-character webhooks.
3. **Persona governs invocation style; environment provides context; tools are the surface.** Three orthogonal axes; never collapse into each other.
4. **Construct ecosystem is the canonical capability spine.** Each capability the agents have IS a construct: **rosenzu = place + moment** (Lynch spatial + temporal/social via `read_room`), codex = lore, score = activity, imagegen = expression. Mount Loa to make this explicit.
5. **Memory deferred to V0.7-B+.** This substrate carries no per-character ledger. Recent room context (last-N messages per channel) IS allowed — that's not memory, it's reading the room.
6. **Slash commands stay primary surface for V0.7-A.1.** Tupperbox/MidJourney pattern: minimize friction, match user expectation. Chat-as-conversational comes via slash → reply (already V0.7-A.0).
7. **Affirmative blueprints, never negative fences** (Gemini DR / vault `[[negative-constraint-echo]]`). Persona prompts describe what TO do, never what NOT to. The environment substrate inherits this discipline.

### Blast radius

| artifact | change | risk |
|---|---|---|
| `apps/bot/src/lib/channel-zone-map.ts` | NEW · canonical reverse map | LOW · pure derivation from existing env vars |
| `packages/persona-engine/src/compose/environment.ts` | NEW · `buildEnvironmentContext(character, channelId)` builder | LOW · pure function, no side effects |
| `packages/persona-engine/src/persona/loader.ts` | ADD `{{ENVIRONMENT}}` placeholder + substitution | LOW · additive to existing substitution table |
| `packages/persona-engine/src/compose/reply.ts` | WIRE through orchestrator with character.mcps scope (currently bypasses MCPs entirely) | **MEDIUM** · changes chat path's tool surface |
| `apps/character-{ruggy,satoshi}/character.json` | ADD optional `tool_invocation_style: string` | LOW · additive |
| `apps/character-{ruggy,satoshi}/persona.md` | TWEAK to reference environment naturally | LOW · prose · /voice workshop territory |
| `freeside-characters/` (root) | NEW · Loa mount via `/mount` (Phase A) | MEDIUM · framework integration · reversible |
| `apps/bot/scripts/density-experiment.ts` | NEW · 10+ character Pattern B smoke (Phase F · optional) | LOW · scratch script · no prod path |

**Total**: 4 NEW files, 3 MODIFIED, 1 framework mount. No deletions. Proxy / Pattern B / digest path bytes-untouched.

### What breaks if I'm wrong

| failure mode | reversibility |
|---|---|
| reverse map wrong → wrong zone metadata leaks into chat | `getZoneForChannel` is pure; fix env var or map; no migration |
| chat-mode MCP wiring breaks `composeReply` | feature-flag the orchestrator path via env (`CHAT_MODE=orchestrator\|naive`); fall back to naive |
| persona drifts because environment context too verbose | environment builder has a max-token cap; trim from least-canonical first (recent activity) |
| 10-character density experiment hits 5-msg/5-sec rate | already known constraint; backoff documented; no production path involved |
| Loa mount conflicts with existing scripts | mount in feature branch first; verify dev workflow; merge or revert |

Reversibility is policy. Every change in this session is one revert from the previous state.

---

## Component specifications (Alexander craft lens)

### `channel-zone-map.ts` — material specification

**Material**: pure TypeScript, no runtime deps. Reads `config.SCORE_API_URL` schema once at module load. Exports two pure functions.

```ts
// apps/bot/src/lib/channel-zone-map.ts
import type { Config } from '@freeside-characters/persona-engine/config';
import type { ZoneId } from '@freeside-characters/persona-engine/types';

const ZONE_CHANNEL_FORWARD: Record<ZoneId, keyof Config> = {
  'stonehenge': 'DISCORD_CHANNEL_STONEHENGE',
  'bear-cave': 'DISCORD_CHANNEL_BEAR_CAVE',
  'el-dorado': 'DISCORD_CHANNEL_EL_DORADO',
  'owsley-lab': 'DISCORD_CHANNEL_OWSLEY_LAB',
};

export function getZoneForChannel(config: Config, channelId: string): ZoneId | undefined {
  for (const [zone, envKey] of Object.entries(ZONE_CHANNEL_FORWARD)) {
    if (config[envKey as keyof Config] === channelId) return zone as ZoneId;
  }
  return undefined;
}

export function getCodexAnchorForZone(zone: ZoneId): { name: string; dimension: string; emoji: string } {
  // pulls from packages/persona-engine/src/score/types.ts ZONE_TO_DIMENSION + zone metadata
  // (or hits codex-mcp lookup_zone at runtime if CODEX_MCP_URL set — see Phase D below)
}
```

**Rhythm**: function-pair shape — forward lookup + reverse lookup. Symmetric.

**Color-as-information**: zones HAVE colors (codex grail palettes). The reverse map exposes them so the environment context can include "this zone's color signature is X" if the character cares (rosenzu does; satoshi might cite it gnomically; ruggy might emoji-flag it).

### `environment.ts` — the awareness substrate

**Material**: pure-function builder. Takes (character config, channelId, optional recent messages) → returns a structured prompt-fragment string.

```ts
// packages/persona-engine/src/compose/environment.ts

export function buildEnvironmentContext(args: {
  character: CharacterConfig;
  channelId: string;
  config: Config;
  recentMessages?: ConversationMessage[];  // last-N from channel ledger
  otherCharactersHere?: string[];          // from CHARACTERS env split
}): string {
  const zone = getZoneForChannel(args.config, args.channelId);
  const codexAnchor = zone ? getCodexAnchorForZone(zone) : null;

  // structured block — concise, scannable, parseable by the LLM
  return [
    `## Environment`,
    zone
      ? `You are in ${codexAnchor?.emoji ?? ''} #${zone} — ${codexAnchor?.name ?? 'this zone'} (${codexAnchor?.dimension ?? '—'} dimension).`
      : `You are in a Discord channel outside the codex-mapped zones.`,
    args.otherCharactersHere?.length
      ? `Other characters present: ${args.otherCharactersHere.join(', ')}.`
      : `You are the only character in this channel right now.`,
    args.character.tool_invocation_style
      ? `Tool guidance: ${args.character.tool_invocation_style}`
      : null,
    args.recentMessages?.length
      ? `Recent room context: ${args.recentMessages.slice(-5).map(m => `[${m.author}] ${m.content.slice(0, 80)}`).join(' · ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}
```

**Rhythm**: `## Environment` heading + 4-5 lines. Short. Parses cleanly. No prose paragraphs.

**Weight**: this block is REFERENCE for the LLM, not voice. It sits ABOVE the character's persona block. Persona dominates voice; environment grounds context.

**Motion**: zero. Static at the start of each LLM invocation. Cached per (character, channel, recent-message-window).

**Color-as-information**: emojis from the codex zone (🪩 stonehenge, 🐻 bear-cave, etc.) act as zone-identity anchors. They're also the rosenzu beat-prefixes, so character output that picks them up reads as "I know where I am."

### Persona loader extension (`persona/loader.ts`)

Add `{{ENVIRONMENT}}` to the substitution table. Position: after `{{CODEX_PRELUDE}}` and before `{{VOICE_ANCHORS}}` — environment context grounds the LLM before voice anchors lock the register.

```ts
// in buildPromptPair() and buildReplyPromptPair()
const env = args.environmentContext ?? '';  // optional — not all callers know channel
return template
  .replace('{{CODEX_PRELUDE}}', codexPrelude)
  .replace('{{ENVIRONMENT}}', env)
  .replace('{{VOICE_ANCHORS}}', voiceAnchors)
  // ... rest unchanged
```

**Backward compat**: if a persona template doesn't include `{{ENVIRONMENT}}`, the substitution is a no-op — empty replacement. Existing prompts continue working unchanged.

### Chat-mode MCP wiring (`compose/reply.ts`)

**The critical fix**. Currently chat path bypasses MCPs (line 14, 204-208 comment says "Chat-mode bypasses MCPs entirely by design"). That design was V0.7-A.0 minimum-viable. V0.7-A.1 promotes the design: chat goes through orchestrator with character-scoped MCPs.

```ts
// in composeReply()
import { runOrchestratorQuery } from '../orchestrator/index.js';

// instead of: const result = await invokeChat(promptPair);
const result = await runOrchestratorQuery({
  promptPair,
  character: args.character,           // already has .mcps[]
  config: args.config,
  postType: 'chat',                    // NEW — orchestrator branches
  conversationHistory: args.recentMessages,
});
```

**Orchestrator extension**: `runOrchestratorQuery` accepts `postType: 'chat'`. For chat, system prompt includes environment context (via `buildEnvironmentContext`); tools are filtered by `character.mcps` (existing); model is the per-character-LLM-provider (anthropic / freeside / bedrock per `LLM_PROVIDER`).

**ChatGPT-natural invocation comes from this**: the model has tools attached, the persona declares invocation style, the environment provides context. Model decides when to call. No hand-rolled classifier.

### `tool_invocation_style` — character-level guidance

Each character.json gets an OPTIONAL `tool_invocation_style: string` describing **how the persona prefers to use tools**. This is operator-authored prose — affirmative blueprints, no fences.

```jsonc
// apps/character-ruggy/character.json
{
  "id": "ruggy",
  ...
  "mcps": ["score", "codex", "emojis", "rosenzu", "freeside_auth"],
  "tool_invocation_style": "Use score for zone-stat questions and digest-shaped factual queries. Use codex when someone names an archetype/grail/factor and you want to ground the reference. Use rosenzu when you describe spatial transitions or zone-to-zone movement. Use emojis composition for vibe-flag punctuation. Use freeside_auth when wallet identity comes up. Use imagegen sparingly — only when describing a zone-shift visually adds something words can't. Default to text; tools augment."
}

// apps/character-satoshi/character.json
{
  "id": "satoshi",
  ...
  "mcps": ["codex", "imagegen"],
  "tool_invocation_style": "Use codex when a grail or archetype reference would land more accurately. Use imagegen at natural pause points where a visual metaphor amplifies the gnomic close. You are a messenger between worlds — your tools help you cite cleanly across zones, not perform expertise. The dense-block register holds; imagegen is the punctuation."
}
```

This text gets injected into the environment block (via `buildEnvironmentContext`). It's NOT in the persona — persona is voice; this is invocation-style guidance.

**Why character-level not persona-level**: the persona file should stay voice-fidelity-locked (per gumi's /voice workshop discipline). Tool-invocation guidance is operational; it changes when tools change. Keeping it in character.json lets us iterate on tool guidance without touching the persona.

---

## Build sequence (Barth — V1 ship scope)

Six phases. Phase A is independent (Loa mount). Phases B-E are the substrate proper. Phase F is optional density experiment.

### Phase A — Mount Loa on freeside-characters (~1h)

**Why first**: enables construct integration discipline + grimoire authoring + access to construct ecosystem (archivist for memory primitives, keeper for observation, etc.). Operator explicit ask.

**Steps**:

1. Stand at `~/Documents/GitHub/freeside-characters/` (current branch: `main`)
2. Run `/mount` (the loa-setup skill) — wizard prompts for project shape
3. **Project profile to declare**: this is a **Discord-character runtime** repo. Adopt minimal construct set:
   - **archivist** (memory architecture — for V0.7-B's character ledger)
   - **observer** (KEEPER — runtime observation; pairs with smoke + cross-character experiments)
   - **artisan** (ALEXANDER — voice/material craft; pairs with /voice workshops)
   - **the-arcade** (OSTROM/BARTH — structural review + scope discipline for cycles)
   - SKIP: gtm-collective (not needed), k-hole (research-mode; out-of-scope for character runtime)
4. Verify: `cat .loa.config.yaml`, `ls .claude/`, `ls grimoires/loa/`, `cat BUTTERFREEZONE.md`
5. **Update CLAUDE.md** to reflect freeside-characters reality (current CLAUDE.md exists — Loa wraps around it)
6. Migrate any existing `docs/AGENTS.md` and architecture refs into `grimoires/loa/specs/`
7. Run `/butterfreezone` to seed the BFZ canon
8. Verify: gateway is mounted; subsequent kickoffs in this repo write to `freeside-characters/grimoires/loa/specs/`

**Verify**:
- `~/Documents/GitHub/freeside-characters/.loa.config.yaml` exists
- `bun run typecheck` still clean (Loa shouldn't touch package code)
- `git log -1 --stat` shows mount commit pattern (`mount: install loa framework v1.107.x` or similar)

**Blast radius**: framework only. No source code changes. Reversible by `git revert` of the mount commit.

**Commit**: dedicated PR `feat(loa): mount loa framework on freeside-characters` — separate concern from environment substrate.

---

### Phase B — channel-zone reverse map (~30min)

**Files**:
- `apps/bot/src/lib/channel-zone-map.ts` (NEW)

**Pattern**: pure functions. Forward map already in `config.ts:166-177`. New file builds reverse + adds zone-metadata accessor.

**Implementation** (paste from §Component specs above; ~40 lines).

**Verify**:
- Unit smoke: `bun run --cwd apps/bot tsx scripts/smoke-zone-map.ts` (NEW · 10 lines · asserts forward+reverse round-trip)
- `getZoneForChannel(config, '1234567890')` returns `undefined` for unknown
- `getZoneForChannel(config, env.DISCORD_CHANNEL_STONEHENGE)` returns `'stonehenge'`

**Blast radius**: 1 file, 1 NEW. Zero existing code touched.

---

### Phase C — environment context builder + rosenzu read_room (~1.5h)

**Files**:
- `packages/persona-engine/src/orchestrator/rosenzu/server.ts` (extend with `read_room` tool)
- `packages/persona-engine/src/orchestrator/rosenzu/lynch-primitives.ts` (add `deriveTemperature`, `deriveSocialDensity`, `composeTonalWeight` helpers)
- `packages/persona-engine/src/compose/environment.ts` (NEW · pre-calls rosenzu.read_room internally)
- `packages/persona-engine/src/persona/loader.ts` (extend substitution table)
- `apps/character-{ruggy,satoshi}/character.json` (add `tool_invocation_style` field)

**Pattern A — extend rosenzu with `read_room` tool**:

```ts
// in rosenzu/server.ts — 6th tool registration
tool(
  'read_room',
  'Reads the temporal/social state of a zone-mapped channel right now. Returns activity temperature (cold/cool/warm/hot), social density (solo/paired/cluster/crowd), tonal weight against the zone KANSEI baseline, and a brief vibe hint. Pair with get_current_district (place) for full place+moment grounding before composing any reply.',
  {
    zone: ZoneSchema,
    recent_message_count: z.number().min(0).max(50).default(20),
    recent_message_summary: z.string().optional().describe('substrate-assembled summary of last-N messages'),
    presence: z.array(z.string()).optional().describe('user/character handles currently active'),
    minutes_since_last_post: z.number().optional(),
  },
  async ({ zone, recent_message_count, recent_message_summary, presence, minutes_since_last_post }) => {
    const profile = ZONE_SPATIAL[zone as SpatialZoneId];
    const temperature = deriveTemperature(recent_message_count, minutes_since_last_post);
    const social_density = deriveSocialDensity(presence?.length ?? 0);
    const tonal_weight = composeTonalWeight(profile.base_kansei, temperature);

    return ok({
      zone,
      temperature,           // cold | cool | warm | hot
      social_density,        // solo | paired | small-cluster | crowd
      tonal_weight,          // KANSEI palette adjusted for temperature
      presence: presence ?? [],
      recent_vibe_hint: recent_message_summary
        ? `${profile.archetype} register · ${recent_message_summary.slice(0, 120)}`
        : null,
      grounding: `${profile.archetype} · ${profile.era} · currently ${temperature}`,
    });
  },
),
```

**Pattern B — environment.ts pre-calls room read inline**:

```ts
// packages/persona-engine/src/compose/environment.ts
import { rosenzuServer } from '../orchestrator/rosenzu/server.js';

export async function buildEnvironmentContext(args: {
  character: CharacterConfig;
  channelId: string;
  config: Config;
  recentMessages?: ConversationMessage[];
  otherCharactersHere?: string[];
}): Promise<string> {
  const zone = getZoneForChannel(args.config, args.channelId);
  const codexAnchor = zone ? getCodexAnchorForZone(zone) : null;

  // pre-fetch the room read (substrate assembles args; rosenzu tool derives)
  const roomRead = zone
    ? await callRosenzuTool('read_room', {
        zone,
        recent_message_count: args.recentMessages?.length ?? 0,
        recent_message_summary: summarizeRecent(args.recentMessages),
        presence: [...(args.otherCharactersHere ?? []), ...(args.recentMessages?.map(m => m.author) ?? [])].filter(uniq),
        minutes_since_last_post: minutesSince(args.recentMessages?.at(-1)?.timestamp),
      })
    : null;

  return [
    `## Environment`,
    zone
      ? `You are in ${codexAnchor?.emoji ?? ''} #${zone} — ${codexAnchor?.name ?? 'this zone'} (${codexAnchor?.dimension ?? '—'} dimension).`
      : `You are in a Discord channel outside the codex-mapped zones.`,
    roomRead
      ? `Room read: ${roomRead.temperature} · ${roomRead.social_density} · ${roomRead.grounding}${roomRead.recent_vibe_hint ? ' · ' + roomRead.recent_vibe_hint : ''}`
      : null,
    args.otherCharactersHere?.length
      ? `Other characters present: ${args.otherCharactersHere.join(', ')}.`
      : null,
    args.character.tool_invocation_style
      ? `Tool guidance: ${args.character.tool_invocation_style}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}
```

**The model can ALSO re-call `rosenzu.read_room` mid-turn** if it wants a fresh read after a pause or context shift — the inline pre-fetch is a starting frame, not a frozen snapshot.

**Persona-template extension**: each character's persona template gets `{{ENVIRONMENT}}` placeholder positioned between `{{CODEX_PRELUDE}}` and `{{VOICE_ANCHORS}}`. If a character template doesn't reference it, no-op (empty substitution).

**Verify**:
- Unit smoke for new derivation helpers: `deriveTemperature(20, 1) === 'hot'` · `deriveSocialDensity(5) === 'small-cluster'` · `composeTonalWeight(base, 'hot')` returns warmer KANSEI delta
- `rosenzu.read_room` callable via mock-agent: returns structured `{temperature, social_density, tonal_weight, presence, recent_vibe_hint, grounding}`
- `buildEnvironmentContext({character: ruggy, channelId: STONEHENGE_ID, config})` returns block containing zone emoji + room-read line + ruggy's `tool_invocation_style`
- Unknown channelId fallback: graceful "outside the codex-mapped zones" with no room-read line (rosenzu only called when zone resolves)
- `bun run typecheck` clean
- Snapshot test on environment block: stable output for fixed input

**Blast radius**: 1 NEW file (environment.ts), 2 MODIFIED files (rosenzu server + lynch-primitives), 1 MODIFIED (persona/loader.ts), 2 CONFIG files (character.json). Rosenzu's existing 5 tools are bytes-untouched — `read_room` is purely additive.

**Distillation hook**: rosenzu now serves both halves of the lens — **place (Lynch spatial) + moment (Lynch temporal/social)**. The combined pattern is a candidate for promotion into `[[reading-the-room]]` vault doctrine post-stabilization.

---

### Phase D — chat-mode MCP wiring (~1.5h · MEDIUM-risk)

**Files**:
- `packages/persona-engine/src/compose/reply.ts` (refactor)
- `packages/persona-engine/src/orchestrator/index.ts` (extend `runOrchestratorQuery` to accept `postType: 'chat'`)

**Critical**: this is the substrate change that closes the operator's actual gap. Chat path currently has zero tool surface. After this phase, chat replies have access to the full per-character MCP scope.

**Pattern**:

1. Extend `OrchestratorQueryRequest` type with `postType: 'digest' | 'chat'` and optional `conversationHistory`.
2. In `runOrchestratorQuery`:
   - If `postType === 'chat'`: build environment context via `buildEnvironmentContext`, inject into system prompt
   - If `postType === 'digest'`: existing behavior unchanged
   - Both branches: `allowedTools = buildAllowedTools(servers, character.mcps)` (already exists)
3. In `composeReply`: replace `invokeChat(promptPair)` with `runOrchestratorQuery({postType: 'chat', ...})`
4. **Feature flag**: env `CHAT_MODE=orchestrator|naive` — default `orchestrator` once verified, fall back to `naive` if regression

**Verify**:
- Chat smoke: `/ruggy prompt:"what's stonehenge looking like this week?"` invoked locally; expect ruggy to call `mcp__score__get_zone_digest` (visible in trajectory log) before replying
- `/satoshi prompt:"who is the grail of crossings?"` → satoshi calls `mcp__codex__lookup_grail`
- Per-character isolation holds: ruggy chat doesn't have imagegen tool (not in his mcps); satoshi chat doesn't have score
- No double-invocation (digest path stays separate)
- Backward compat: setting `CHAT_MODE=naive` reverts to V0.8.0 behavior (no tool calls in chat)

**Blast radius**: 2 files MODIFIED. The orchestrator extension is additive (new branch on `postType`). The reply.ts change is a delegation flip. Reversible via env flag.

---

### Phase E — persona-prose iteration (~30min)

**Files**:
- `apps/character-ruggy/persona.md` (tweak)
- `apps/character-satoshi/persona.md` (tweak)

**Why**: the environment block now appears in the system prompt. The persona should be aware that environment exists (in voice-fidelity terms — "you know where you are; reference it naturally") and should NOT duplicate the environment context (avoid redundant zone-naming).

**Pattern**: minimal edits. Reference the environment block once in voice instruction. Affirmative blueprint, no fences.

**Ruggy add**:
> "An environment block at the top of your context tells you which zone you're in and what you have access to. Reference the zone naturally — your factor knowledge composes with the location. Don't restate the environment; let it color your voice."

**Satoshi add**:
> "Your context begins with an environment block describing the zone and tools available. Cite the zone obliquely when it strengthens a grail reference. Don't enumerate tools or environment — your gnomic register handles awareness without commentary."

**/voice workshop pairing**: per the companion spec (`satoshi-ruggy-experiment-validation.md`), persona changes should run through the gumi-correct /voice workshop. **Defer the workshop** for this kickoff — Phase E lands a minimal seed; iteration belongs to a /voice cycle.

**Verify**:
- 3 dry-run digests + 3 dry-run chats per character: format/voice fidelity holds (strip-the-name informal: ≥80% per gumi blind-judge)
- No fence creep ("never mention zone explicitly" — that's negative-constraint-echo bait)

**Blast radius**: 2 prose files. Reversible.

---

### Phase F — webhook density experiment (~1h · OPTIONAL)

**Files**:
- `apps/bot/scripts/density-experiment.ts` (NEW · scratch)

**Goal**: empirically measure Pattern B character density per channel. Operator hypothesis: 10 characters; gemini DR says 5 msg/5 sec channel-wide. Verify.

**Method**:

1. Set up a private test channel (operator's dev guild)
2. Pre-register 12 distinct character "identities" in code (no DB; in-memory)
3. Fire 12 sequential `executeWebhook` calls with distinct `username`+`avatar_url` per call
4. Measure: success rate, time-to-completion, any 429 responses, any rate-limit headers
5. Repeat with concurrent fire (Promise.all)
6. Document findings → vault page `[[discord-pattern-b-density]]`

**Verify**:
- Sequential 12-character fire succeeds within bucket (5/5sec → spreads across ~12-15 seconds)
- Concurrent fire hits 429; backoff handler kicks in; eventual success
- Username 80-char ceiling enforced (per gemini DR)

**Outcome**: empirical answer to "can we run 10+ characters in a channel?" + vault doctrine page documenting Pattern B headroom.

**Blast radius**: scratch script only. No production path.

---

## Design rules (Alexander craft lens)

### The environment block as material

- **Position**: above persona, below codex prelude. Grounds context before voice anchors lock register.
- **Size budget**: target ≤300 tokens. Hard cap at 500. If exceeded, drop "recent activity" first (least canonical), then "other characters here."
- **Format**: structured headed block (`## Environment`), 4-6 lines, scannable. NOT prose paragraphs.
- **Vocabulary**: zone names use canonical slugs (stonehenge, bear-cave, el-dorado, owsley-lab) PLUS the codex emoji. Never invent zone names; never abbreviate.
- **Color-as-information**: zone emojis at the start of zone references serve as visual anchor. Match codex zone palette.
- **Rhythm**: each line is one fact. No nested bullets. The LLM parses better when the structure is flat.

### Tool-invocation guidance as material

- **Affirmative blueprints exclusively** (vault `[[negative-constraint-echo]]`): "use codex for grail references" not "don't make up grail names."
- **Per-tool one-line max**: brevity is precision. Long guidance reads as fence; short reads as posture.
- **Persona-flavored vocabulary**: ruggy's guidance can use "yo / peep"; satoshi's stays editorial. The TONE of the guidance should match the character so the LLM reads it as continuation of voice, not external instruction.
- **Default to text; tools augment**: every guidance should end with this floor. Image-gen / score / codex are NOT default modes — they're invoked when they add something words don't.

### Chat-mode tool feedback (Discord UX)

- **Typing indicator** during tool round-trip (port from moltbot per `[[listener-router-substrate]]`): `POST /channels/{id}/typing` fire-and-forget.
- **No tool-call exposure in reply**: the user sees character text. The fact that ruggy hit score-mcp is invisible (logged in trajectory, not surfaced).
- **Image-gen reply shape**: when imagegen fires, the character's text reply ACCOMPANIES the image (caption-shape, not standalone image). This matches ChatGPT model — text + image is one unit.

### Webhook delivery hygiene (per Gemini DR)

- 80-char cap on dynamic webhook username (Discord hardware reject). Verify in code.
- Bot-author skip + webhook_id check at earliest ingestion (cross-bot reply-loop prevention).
- 14m30s timeout wrapper on LLM round-trips (avoid orphan-PATCH on expired interaction tokens).
- Circuit breaker: 3 consecutive 403s on a channel webhook → blacklist channel ID + halt processing.

---

## What NOT to build (Barth scope cut)

- ❌ **Per-character memory ledger** — V0.7-B+. The substrate carries no persistent memory. Recent room context (read-only) is the floor; per-character durable state is its own kickoff.
- ❌ **Cross-character coordination via shared file** (Ralph Wiggum / OpenClaw pattern) — V0.7-B+. Defer until two-character chat shows actual collision.
- ❌ **PAA voice-fidelity CI** — V0.8+ per the companion spec; this kickoff doesn't add automated voice classifiers.
- ❌ **Image-gen autoprompt classifier** — out of substrate. Persona iteration governs invocation; if model under-invokes, tune `tool_invocation_style`. No regex / keyword matcher.
- ❌ **New zones** (tl, irl) — score-mibera doesn't back them yet. Future.
- ❌ **MessageContent intent / general listener** — V0.7-A.2 (per parent brief). This kickoff stays in slash-command surface.
- ❌ **DM environment** — V0.7-A.x. Slightly different shape (no zone, only DM intimacy register). Defer.
- ❌ **Per-character LLM provider override** — already deferred per kickoff-substrate-prep §out-of-scope.
- ❌ **dAMP-96 personality derivation** — its own kickoff; depends on Phase D landing first.
- ❌ **"While I'm here, let me also..."** — banned. Phase scope is locked. Polish backlog goes to `grimoires/loa/agenda/` once Loa mounts.

---

## Verify (session exit gate)

| check | how |
|---|---|
| Phase A | `~/Documents/GitHub/freeside-characters/.loa.config.yaml` exists; `bun typecheck` clean; mount commit on its own branch/PR |
| Phase B | `bun tsx apps/bot/scripts/smoke-zone-map.ts` round-trips forward+reverse; unknown channelId returns undefined |
| Phase C | rosenzu `read_room` tool registered + unit smokes for `deriveTemperature` / `deriveSocialDensity` / `composeTonalWeight`; snapshot test on `buildEnvironmentContext` produces stable output (incl. room-read line); `bun typecheck` clean; persona templates substitute `{{ENVIRONMENT}}` correctly; rosenzu existing 5 tools bytes-untouched |
| Phase D | `/ruggy prompt:"zone digest?"` invokes `mcp__score__get_zone_digest` (visible in trajectory); `/satoshi prompt:"grail?"` invokes `mcp__codex__lookup_grail`; `CHAT_MODE=naive` reverts to v0.8.0 behavior |
| Phase E | 3 dry-run digests + 3 dry-run chats per character; voice fidelity holds; no fence creep |
| Phase F (optional) | density-experiment.ts smoke; vault page `[[discord-pattern-b-density]]` filed with empirical findings |
| ALL | `bun run typecheck` clean (workspace-wide); `bun test` clean; per-character MCP scope honored |

🛑 **Stop at any phase boundary if voice fidelity regresses** (per companion spec strip-the-name baseline). Phases A-C are independently safe; Phase D has revert-via-env-flag escape hatch.

🎯 **Done-bar**: agents naturally invoke score / codex / rosenzu / imagegen during chat replies (per ChatGPT-model). Voice fidelity holds (≥80% strip-the-name informal). Loa mounted. Environment context legible in trajectory logs.

---

## §coordination needed

1. **Eileen** — review Phase E persona prose (gumi-correct discipline); confirm `tool_invocation_style` text for satoshi reads as continuation of his register, not external instruction. /voice workshop is the longer-form follow-up.
2. **Gumi** — async awareness; this kickoff doesn't touch codex authority, but rosenzu zone metadata pulls from her domain. The codex-mcp `lookup_zone` tool will be the canonical data source once Phase D wires chat-mode access.
3. **Operator** — confirm scope cuts (Barth's NO list); ratify Loa construct selection (archivist + observer + artisan + the-arcade); approve Phase F experiment in dev guild.
4. **Density experiment safe channel** — operator provisions a test channel in dev guild. NOT a public production channel (avoid spam noise).

---

## Key references

| topic | file / URL |
|---|---|
| parent brief | `~/bonfire/grimoires/bonfire/specs/listener-router-substrate.md` |
| V0.7-A.0 build doc (prior session) | `~/bonfire/grimoires/bonfire/specs/build-listener-substrate-v07a0.md` |
| companion experiment spec | `~/bonfire/grimoires/bonfire/specs/satoshi-ruggy-experiment-validation.md` |
| substrate prep + Eileen items | `~/bonfire/grimoires/bonfire/specs/kickoff-substrate-prep-eileen-2026-04-30.md` |
| gemini deep research findings | `~/bonfire/grimoires/bonfire/research/gemini-deep-research-output-multi-character-bot-substrate-2026-04-30.md` |
| persona/loader.ts injection seams | `packages/persona-engine/src/persona/loader.ts:171-272` (digest), `:365-399+` (chat) |
| chat path (current MCP-bypass) | `packages/persona-engine/src/compose/reply.ts:14, 204-208` |
| orchestrator + buildAllowedTools | `packages/persona-engine/src/orchestrator/index.ts:150-159` |
| rosenzu spatial tools | `packages/persona-engine/src/orchestrator/rosenzu/server.ts:45-66+` |
| forward zone-channel map | `packages/persona-engine/src/config.ts:166-177` |
| vault: civic-layer doctrine | `~/vault/wiki/concepts/agent-native-civic-architecture.md` |
| vault: pattern-b-shell-bot | `~/vault/wiki/concepts/pattern-b-shell-bot.md` |
| vault: negative-constraint-echo (HIGH-impact) | `~/vault/wiki/concepts/negative-constraint-echo.md` |
| vault: explicit-invocation-anti-spam | `~/vault/wiki/concepts/explicit-invocation-anti-spam.md` |
| vault: midi-as-storytelling-register | `~/vault/wiki/concepts/midi-as-storytelling-register.md` |
| vault: gateway-as-registry (registry-broadcast doctrine) | `~/vault/wiki/concepts/gateway-as-registry.md` (filed 2026-05-01) |
| target repo | `~/Documents/GitHub/freeside-characters` |
| operator harness env vars | `OPERATOR_API_KEY`, `TENANT_SCORE_API_KEY`, `SCORE_BEARER`, `CODEX_MCP_URL` |

---

⏱ **Estimated**: 4-5 hours for Phases A-E (sprint scope). Phase F is optional, ~1h. /voice workshop iteration on Phase E is its own follow-up cycle.

🎯 **Done-bar**: agents are environment-aware in chat replies; tools fire naturally per persona+context; Loa mounted; voice fidelity holds.

🌀 **Distillation candidates** (post-stabilization):
- `[[reading-the-room]]` vault doctrine — rosenzu's place+moment pair (Lynch spatial × KANSEI temporal/social) as a portable lens for any agent runtime that needs environment grounding. The 6-tool rosenzu surface becomes the reference implementation.
- `discord-awareness` construct — channel↔location mapping + environment-context-builder + tool-invocation-style schema as a composable surface. Composes with rosenzu (place + moment) + observer (KEEPER · runtime-observation) + archivist (memory architecture for V0.7-B character ledger).
