# Civic-layer doctrine

> **Eileen 2026-04-20** (vault: `agent-native-civic-architecture.md`):
> *"Do not let system agents and participation agents blur together. If they
> blur, you get exactly the kind of legitimacy collapse that [other platforms]
> weren't about: head and power unclear, authority hard to appeal, moderation
> epistemic capture, and rule confusion between speaker and governor."*

This is the load-bearing structural commitment of `freeside-characters`. It is
not an architectural preference — it is an operator-stated principle that
pre-dates V0.6-A.

## The split

| Layer | Role | What it does | What it never does |
|---|---|---|---|
| **System agents** (governors) | institutional theme | cron, delivery, MCP orchestration, persona+exemplar loading, score-mcp client | speak; carry voice; hold character identity |
| **Participation agents** (speakers) | members / contributors | persona, voice, creative direction, exemplars, emoji affinity | govern cadence; touch Discord client; enumerate themselves |

A participation agent is a **speaker**. A system agent is a **governor**. The
two MUST NOT be conflated. Authority and appeal are different from voice and
register. When they blur, legitimacy collapses.

## How the codebase enforces it

### Package boundary (compile-time)

`packages/persona-engine/` is the **substrate** (system-agent layer). Its
public API is exposed only through `src/index.ts` (the barrel). Everything
else is internal.

`apps/character-<id>/` is the **participation-agent profile** (speaker layer).
In V0.6-A these directories contain ONLY markdown + JSON + a manifest
`character.json`. No TypeScript code. The substrate cannot be bypassed because
there's no runtime to do the bypassing in the character folder.

`apps/bot/` is the **runtime entry**. It loads characters from filesystem,
dispatches fires through the substrate. It imports the substrate via the
workspace package (`@freeside-characters/persona-engine`); it does NOT reach
into substrate internals via relative paths. Characters cannot be loaded
without the bot mediating.

### Filesystem boundary (run-time)

The substrate **never enumerates `apps/character-*/` on its own**. Discovery
of which characters exist is the bot's job (`apps/bot/src/character-loader.ts`
reads the `CHARACTERS` env var, walks to known character directories, parses
their `character.json`, and hands `CharacterConfig` values to the substrate).

If the substrate ever needs to know "which characters exist?", that's a smell —
it's reaching into the speaker layer. Route through the bot's character-loader
instead.

### Type boundary (semantic)

`CharacterConfig` (in `packages/persona-engine/src/types.ts`) is the canonical
contract:

```ts
interface CharacterConfig {
  id: string;
  personaPath: string;
  exemplarsDir?: string;
  emojiAffinity?: { primary?: 'ruggy' | 'mibera'; fallback?: 'ruggy' | 'mibera' };
  displayName?: string;
}
```

This is the legitimate boundary between layers. Anything character-specific
goes in here. Substrate functions accept `CharacterConfig`; characters supply
the underlying files.

## Violations to catch in review

Watch for these patterns — each one collapses the layer split:

1. **Character-specific code in `packages/persona-engine/`** — e.g. an
   if-statement that checks `character.id === 'ruggy'` to branch behavior.
   The substrate is character-agnostic by construction.

2. **Filesystem walks in the substrate** — e.g. `readdirSync('apps')` from
   inside persona-engine. The substrate doesn't know `apps/` exists.

3. **Substrate internals imported across packages** — e.g.
   `import { something } from '@freeside-characters/persona-engine/src/orchestrator/cabal/gygax.ts'`.
   Always import from the barrel (`@freeside-characters/persona-engine`).

4. **TS code in `apps/character-<id>/`** — characters are markdown + JSON in
   V0.6-A. If runtime logic creeps into a character folder, it should move
   to the substrate (with `CharacterConfig` injection) or to the bot.

5. **Cross-character imports** — character A imports from character B. Each
   character profile is independent; cross-character behaviors live in the
   substrate's routing layer (V0.6-D).

## Why this matters for V0.6+

When V0.7+ elevates characters to **daemons** (per Eileen's puruhani-as-spine
canon — dNFT mint, ERC-6551 TBA, designed-voice templates), the daemon will
take ownership of identity. At that point the civic-layer split must STILL
hold: the daemon is the speaker, the substrate is still the governor.

A blur today (a character that secretly governs, or a substrate that secretly
speaks) becomes an unfixable mess once mint machinery is in the loop. The
structural split now is what keeps V0.7+ tractable.
